// Canvas — the root control. Ports `Gwen::Controls::Canvas`
// (include/Gwen/Controls/Canvas.h + src/Controls/Canvas.cpp).
//
// GWEN keeps canvas-wide state (hovered control, keyboard focus, mouse
// focus, key repeat, double-click tracking, delayed deletes) on file-
// static globals in Canvas.cpp. We promote every one of those globals to
// an instance field so a single page can host several independent Canvas
// trees without them stomping each other.
//
// Responsibilities:
//   - Own the `Skin` + `WebGL2Renderer` handles used by every descendant.
//   - Drive the per-frame lifecycle: `doThink()` (layout + key-repeat +
//     delayed-delete flush) and `renderCanvas()` (clear + recurseLayout
//     + `doRender`).
//   - Implement `InputTarget` so the router from `core/Input.ts` can
//     deliver pointer / key / char events directly.
//   - Translate control-level `_cursor` values into a browser
//     `canvas.style.cursor`.
//
// Circular-import strategy:
//   `Base` can't depend on the concrete `Canvas` class (Canvas ⊂ Base
//   already). Base declares a structural `CanvasLike` interface and
//   reaches Canvas state through `getCanvas()`. `Canvas` implements
//   `CanvasLike` and overrides `getCanvas()` to return `this`, so the
//   dependency graph stays acyclic at the value level.

import { Base, type CanvasLike } from './Base';
import type { Skin } from '../skin/Skin';
import type { WebGL2Renderer } from '../renderer/WebGL2Renderer';
import { CursorType, color, point, type Color, type Point } from '../core/Structures';
import { attachInput, Key, type InputTarget } from '../core/Input';

// --- Constants (Canvas.cpp top-of-file) -----------------------------------

// Upper bound on how close (in seconds) two clicks can be and still count
// as a double-click. GWEN's C++ value is 0.5.
const DOUBLE_CLICK_SPEED = 0.5;

// Inter-press key-repeat delay and the initial pause before the repeat
// begins. Matches Canvas.cpp:8.
const KEY_REPEAT_RATE = 0.03;
const KEY_REPEAT_DELAY = 0.3;

// Five = mouse buttons 0..4 (L, M, R, X1, X2). Matches GWEN.
const MAX_MOUSE_BUTTONS = 5;

// Pixel distance the pointer must travel after a press before a drag
// actually begins. Matches GWEN's `Gwen::DragAndDrop` threshold so a
// single-pixel jiggle on a click doesn't turn into an unwanted drag.
const DRAG_START_THRESHOLD = 5;

// Convert `performance.now()` (ms) to seconds, matching GWEN's
// `Platform::GetTimeInSeconds()`.
function nowSec(): number {
  return performance.now() / 1000;
}

// Map a CursorType value onto a CSS cursor keyword.
function cursorToCss(c: number): string {
  switch (c) {
    case CursorType.Beam: return 'text';
    case CursorType.SizeNS: return 'ns-resize';
    case CursorType.SizeWE: return 'ew-resize';
    case CursorType.SizeNWSE: return 'nwse-resize';
    case CursorType.SizeNESW: return 'nesw-resize';
    case CursorType.SizeAll: return 'move';
    case CursorType.No: return 'not-allowed';
    case CursorType.Wait: return 'wait';
    case CursorType.Finger: return 'pointer';
    case CursorType.Normal:
    default:
      return 'default';
  }
}

// ---------- Canvas --------------------------------------------------------

export class Canvas extends Base implements InputTarget, CanvasLike {
  readonly isCanvas: true = true;

  readonly skin: Skin;
  readonly renderer: WebGL2Renderer;
  readonly htmlCanvas: HTMLCanvasElement;

  // --- Canvas-wide input state (was file-statics in GWEN) ---

  hoveredControl: Base | null = null;
  keyboardFocus: Base | null = null;
  mouseFocus: Base | null = null;
  firstTab: Base | null = null;
  nextTab: Base | null = null;
  // Full ordered list of tabable controls under this canvas, rebuilt
  // every frame in `recurseLayout`. Used by `Base.onKeyTab` to walk
  // both forward (Tab) and backward (Shift+Tab); `firstTab`/`nextTab`
  // are kept for back-compat with anything that still reads them.
  tabList: Base[] = [];

  // Drag-and-drop dispatch state. `dragCandidate` is set on left-button
  // press over a draggable control; `dragStarted` flips once the pointer
  // has moved past `DRAG_START_THRESHOLD` so a stationary click never
  // triggers a drag. `dragHoverTarget` is the deepest acceptor under the
  // pointer during an active drag. Cleared on release.
  dragCandidate: Base | null = null;
  dragPackage: ReturnType<Base['dragAndDrop_GetPackage']> = null;
  // Tracks the control we hid in `beginDrag` so the layout reflows around
  // it. Restored by `endDrag` (see `restoreDragHiddenSource`).
  private dragHiddenSource: Base | null = null;
  private dragHiddenSourceWasHidden = false;
  dragStartPos: Point = point(0, 0);
  dragStarted = false;
  dragHoverTarget: Base | null = null;

  mousePosition: Point = point(0, 0);
  keyState: boolean[];
  keyNextRepeat: number[];
  keyRepeatTarget: Base | null = null;

  leftMouseDown = false;
  rightMouseDown = false;
  lastClickTime: number[];
  lastClickPos: Point = point(0, 0);

  // --- Canvas-specific state ---

  private _drawBackground = false;
  private _backgroundColor: Color = color(255, 255, 255, 255);
  private _needsRedraw = true;
  private _scale = 1.0;
  private readonly _delayedDelete = new Set<Base>();
  private readonly _delayedDeleteList: Base[] = [];
  private _detachInput: (() => void) | null = null;

  // Track last applied CSS cursor so we don't thrash `style.cursor` on
  // every pointer-move. Browsers throttle these writes internally but the
  // equality check is basically free.
  private _lastAppliedCursor = -1;

  constructor(skin: Skin, htmlCanvas: HTMLCanvasElement) {
    super(null);
    this.skin = skin;
    this.renderer = skin.renderer;
    this.htmlCanvas = htmlCanvas;
    this.setSkin(skin);

    // Seed the key-state scratch arrays to Key.Count entries.
    this.keyState = new Array<boolean>(Key.Count).fill(false);
    this.keyNextRepeat = new Array<number>(Key.Count).fill(0);
    this.lastClickTime = new Array<number>(MAX_MOUSE_BUTTONS).fill(-1);

    // Attach PointerEvents / keyboard / wheel routing. The disposer is
    // invoked from `dispose()` so a page can tear the canvas down and
    // drop every listener cleanly.
    this._detachInput = attachInput(htmlCanvas, this);
  }

  // ======================================================================
  // Canvas identity
  // ======================================================================

  // Tighten the return type from `Base`'s `CanvasLike | null`. Covariant
  // narrowing — TS allows this on override because `Canvas` is a
  // `CanvasLike`.
  override getCanvas(): Canvas {
    return this;
  }

  // Top-level redraw latch. GWEN walks up to the canvas; the canvas's
  // implementation just sets a flag rather than recursing.
  override redraw(): void {
    this._needsRedraw = true;
  }

  isRedrawNeeded(): boolean {
    return this._needsRedraw;
  }

  // ======================================================================
  // Scale + background
  // ======================================================================

  setScale(s: number): void {
    if (this._scale === s) return;
    this._scale = s;
    this.renderer.setScale(s);
    this.redraw();
  }

  getScale(): number {
    return this._scale;
  }

  setDrawBackground(b: boolean): void {
    this._drawBackground = b;
  }

  setBackgroundColor(c: Color): void {
    this._backgroundColor = { r: c.r, g: c.g, b: c.b, a: c.a };
  }

  // ======================================================================
  // Cursor
  // ======================================================================

  // Base calls `canvas.setCursor(_cursor)` inside `updateCursor`. We map
  // GWEN's CursorType onto a CSS keyword and only touch `style.cursor`
  // when the value actually changes.
  override setCursor(c: number): void {
    if (this._lastAppliedCursor === c) return;
    this._lastAppliedCursor = c;
    this.htmlCanvas.style.cursor = cursorToCss(c);
  }

  // ======================================================================
  // Bounds
  // ======================================================================

  // When the canvas itself resizes, every child needs a fresh layout
  // pass. Base's `onBoundsChanged` would only invalidate when w/h
  // changed; at the canvas level even a pure translation is rare, so
  // always invalidate.
  protected override onBoundsChanged(old: { x: number; y: number; w: number; h: number }): void {
    super.onBoundsChanged(old);
    this.invalidate();
    this.invalidateChildren(true);
    this.redraw();
  }

  // ======================================================================
  // Per-frame lifecycle
  // ======================================================================

  // doThink — called once per frame by the host, before `renderCanvas`.
  // Matches Canvas.cpp:99 (`DoThink`).
  doThink(): void {
    this.processDelayedDeletes();
    if (this.hidden()) return;

    // Reset tab traversal scratch — `recurseLayout` repopulates them as it
    // visits focusable descendants.
    this.firstTab = null;
    this.nextTab = null;
    this.tabList = [];

    // GWEN flushes delayed-delete twice, once before and once after
    // layout. Controls deleted from a `think()` hook get cleaned up
    // before we render the next frame.
    this.processDelayedDeletes();
    this.recurseLayout(this.skin);

    if (this.nextTab == null) this.nextTab = this.firstTab;

    // --- Key-repeat tick ---
    // If the focused control went away (hidden or disabled keyboard),
    // clear the focus so we don't try to dispatch to a dead target.
    if (this.mouseFocus && !this.mouseFocus.isVisible()) {
      this.mouseFocus = null;
    }
    if (this.keyboardFocus && (!this.keyboardFocus.isVisible() || !this.keyboardFocus.getKeyboardInputEnabled())) {
      this.keyboardFocus = null;
    }

    if (this.keyboardFocus) {
      const now = nowSec();
      for (let i = 0; i < Key.Count; i++) {
        if (this.keyState[i] && this.keyRepeatTarget !== this.keyboardFocus) {
          // Focus moved mid-hold → cancel the synthetic repeat rather
          // than firing keys at the new target.
          this.keyState[i] = false;
          continue;
        }
        if (this.keyState[i] && now > this.keyNextRepeat[i]) {
          this.keyNextRepeat[i] = now + KEY_REPEAT_RATE;
          this.keyboardFocus.onKeyPress(i, true);
        }
      }
    }

    this.updateHoveredControl();
  }

  // renderCanvas — runs the full render pass. Callers should check
  // `isRedrawNeeded()` first if they want to elide unchanged frames.
  renderCanvas(): void {
    if (!this._needsRedraw) return;
    this._needsRedraw = false;

    const r = this.renderer;
    r.begin();

    // Layout may have changed between think and render; be safe.
    this.recurseLayout(this.skin);

    r.setClipRegion(this.getRenderBounds());
    r.setRenderOffset(point(-this.x(), -this.y()));
    r.setScale(this._scale);

    if (this._drawBackground) {
      r.setDrawColor(this._backgroundColor);
      r.drawFilledRect(this.getRenderBounds());
    }

    this.doRender(this.skin);

    this.renderToolTip();
    this.renderDragPreview();

    r.end();
  }

  // Tooltip overlay — drawn last so it floats above every other control.
  // Triggered by `hoveredControl` having a `_toolTip` child that wasn't
  // suppressed by a setToolTipControl(null). Uses a Label-backed tooltip
  // when available (set via Label.setToolTip); falls back to rendering
  // the placeholder Base's `name` as plain text.
  private renderToolTip(): void {
    const hovered = this.hoveredControl;
    if (!hovered || hovered === this) return;
    const tip = hovered.getToolTip();
    if (!tip) return;

    // Position near the cursor with a small offset, then clamp to canvas.
    const pad = 12;
    let tw = tip.width();
    let th = tip.height();
    if (tw <= 0 || th <= 0) {
      // Fallback for the Base placeholder: measure the name text.
      const text = tip.getName();
      if (!text) return;
      const size = this.skin.renderer.measureText(this.skin.getDefaultFont(), text);
      tw = size.x + 10;
      th = size.y + 6;
    }
    let tx = this.mousePosition.x + pad;
    let ty = this.mousePosition.y + pad + 8;
    if (tx + tw > this.width()) tx = this.width() - tw - 2;
    if (ty + th > this.height()) ty = this.mousePosition.y - th - 4;
    if (tx < 2) tx = 2;
    if (ty < 2) ty = 2;
    tip.setPos(tx, ty);
    // Reveal, render, re-hide so the tooltip never participates in the
    // normal layout / hit-test passes.
    const wasHidden = tip.hidden();
    tip.setHidden(false);
    // skin.drawToolTip uses tip.getRenderBounds() = (0, 0, w, h) and
    // draws via the renderer (which adds its current offset). Without
    // shifting the offset to the tip's canvas position the 9-slice
    // background paints at world (0, 0) — only the text inside
    // tip.doRender lands at the cursor, leaving a stray fragment of
    // glyph at the actual tooltip position. Set the offset around the
    // background draw, then restore so doRender's own offset add (which
    // is relative to the offset at entry) lands the text correctly.
    const renderer = this.skin.renderer;
    const savedOffset = renderer.getRenderOffset();
    renderer.setRenderOffset(point(savedOffset.x + tx, savedOffset.y + ty));
    this.skin.drawToolTip(tip);
    renderer.setRenderOffset(savedOffset);
    tip.doRender(this.skin);
    tip.setHidden(wasHidden);
  }

  // Drag preview — renders the dragged source at the pointer offset
  // recorded when the drag started (`p.holdoffset`). Provides visual
  // feedback that mirrors what GWEN's DragAndDrop manager draws.
  private renderDragPreview(): void {
    if (!this.dragStarted || !this.dragPackage) return;
    const dc = this.dragPackage.drawcontrol as Base | null;
    if (!dc) return;
    const ho = this.dragPackage.holdoffset;
    const renderer = this.skin.renderer;
    const w = dc.width();
    const h = dc.height();
    if (w <= 0 || h <= 0) return;

    // We want dc to render with its top-left at (mouse - holdoffset).
    // dc.doRender → renderRecursive adds dc._bounds to the renderer
    // offset (and not the rest of the parent chain — we're rendering
    // dc as a free-floating ghost, not in its layout slot). So the
    // pre-call offset we need is target - dc._bounds: the addRenderOffset
    // step then lands the renderer on `target` exactly.
    //
    // The previous version subtracted `dc.localPosToCanvas({0,0})` —
    // i.e. the sum of every ancestor's bounds plus dc's own — which
    // over-corrected by the ancestor offset and pushed the ghost away
    // from the cursor.
    const oldOffset = renderer.getRenderOffset();
    const targetX = this.mousePosition.x - ho.x;
    const targetY = this.mousePosition.y - ho.y;
    renderer.setRenderOffset(point(targetX - dc.x(), targetY - dc.y()));
    dc.doRender(this.skin);
    renderer.setRenderOffset(oldOffset);
  }

  // ======================================================================
  // Hover
  // ======================================================================

  updateHoveredControl(): void {
    // While a drag is in progress, hover tracking is frozen. Both the
    // per-frame think() tick and inputMouseMoved would otherwise raycast
    // and fire onMouseLeave / onMouseEnter on whatever sits under the
    // cursor — list-box rows, menu items, file-menu buttons — visibly
    // highlighting them as the user passes over looking for a drop
    // target. The drop-target search is the dragAndDrop_HoverEnter/Leave
    // dispatch in updateDragHover, which only touches controls that
    // accept the package. Self-guarding here protects both call sites
    // (think() also calls into this every frame).
    if (this.dragStarted) return;

    // getControlAt walks children; when the mouse is outside every child
    // it returns null (the canvas itself is mouse-enabled but we treat
    // "hover on the canvas root" as "no control hovered").
    const mx = this.mousePosition.x;
    const my = this.mousePosition.y;
    let candidate: Base | null = null;
    const raw = this.getControlAt(mx - this.x(), my - this.y());
    if (raw && raw !== this) candidate = raw;

    if (candidate !== this.hoveredControl) {
      const old = this.hoveredControl;
      // Null the hovered ref before firing leave so observers querying
      // `getCanvas().hoveredControl` see a consistent snapshot.
      this.hoveredControl = null;
      if (old) old.onMouseLeave();
      this.hoveredControl = candidate;
      if (candidate) candidate.onMouseEnter();
    }

    // A control that captured the drag (mouseFocus) preempts the
    // raycast result — so drag-threshold states stay sticky.
    if (this.mouseFocus && this.mouseFocus.getCanvas() === this) {
      this.hoveredControl = this.mouseFocus;
    }
  }

  // ======================================================================
  // Focus helpers
  // ======================================================================

  // Climb from `start` to find the first ancestor that wants keyboard
  // input. Matches Canvas.cpp:InputMouseButton behaviour.
  private findKeyboardFocus(start: Base): Base | null {
    let node: Base | null = start;
    while (node) {
      if (node.getKeyboardInputEnabled()) {
        node.focus();
        return node;
      }
      node = node.parent;
    }
    if (this.keyboardFocus) this.keyboardFocus.blur();
    return null;
  }

  // ======================================================================
  // Delayed delete
  // ======================================================================

  addDelayedDelete(ctrl: Base): void {
    if (this._delayedDelete.has(ctrl)) return;
    this._delayedDelete.add(ctrl);
    this._delayedDeleteList.push(ctrl);
  }

  // Called from Base.dispose via CanvasLike so we can forget a control
  // that's going away right now. Without this, `processDelayedDeletes`
  // would call `dispose()` on something already disposed.
  preDeleteCanvas(ctrl: Base): void {
    if (this._delayedDelete.has(ctrl)) {
      this._delayedDelete.delete(ctrl);
      const i = this._delayedDeleteList.indexOf(ctrl);
      if (i !== -1) this._delayedDeleteList.splice(i, 1);
    }
    if (this.hoveredControl === ctrl) this.hoveredControl = null;
    if (this.keyboardFocus === ctrl) this.keyboardFocus = null;
    if (this.mouseFocus === ctrl) this.mouseFocus = null;
  }

  private processDelayedDeletes(): void {
    if (this._delayedDeleteList.length === 0) return;
    // Snapshot + clear first — disposers may enqueue further deletes,
    // which should be handled on the next tick.
    const snapshot = this._delayedDeleteList.slice();
    this._delayedDelete.clear();
    this._delayedDeleteList.length = 0;
    for (let i = 0; i < snapshot.length; i++) {
      snapshot[i].dispose();
    }
    this.redraw();
  }

  // Convenience for host code that wants to nuke every child in one
  // call without tearing down the Canvas itself.
  releaseChildren(): void {
    const kids = this.children.slice();
    for (let i = 0; i < kids.length; i++) {
      kids[i].dispose();
    }
  }

  // ======================================================================
  // Dispose
  // ======================================================================

  override dispose(): void {
    if (this._detachInput) {
      this._detachInput();
      this._detachInput = null;
    }
    this.releaseChildren();
    super.dispose();
  }

  // ======================================================================
  // InputTarget — raw input from core/Input.ts
  // ======================================================================

  inputMouseMoved(x: number, y: number, dx: number, dy: number): boolean {
    if (this.hidden()) return false;
    this.mousePosition = point(x, y);

    // Drag-candidate threshold check — promotes a press-armed candidate
    // to an active drag once the pointer travels far enough.
    if (this.dragCandidate && !this.dragStarted) {
      const ddx = x - this.dragStartPos.x;
      const ddy = y - this.dragStartPos.y;
      if (ddx * ddx + ddy * ddy >= DRAG_START_THRESHOLD * DRAG_START_THRESHOLD) {
        this.beginDrag(x, y);
      }
    }

    // While a drag is in progress, suppress the regular hover/move
    // dispatch entirely. updateHoveredControl would otherwise raycast
    // against whatever sits under the cursor and fire onMouseLeave /
    // onMouseEnter on it — list-box rows, menu items, file-menu
    // buttons, etc. — making them visibly highlight as the user drags
    // over them looking for a drop target. The drop-target search is
    // handled separately by updateDragHover, which fires the
    // dragAndDrop_HoverEnter/Leave hooks only on controls that accept
    // the package. We still need to flag a redraw so the ghost follows
    // the cursor — the renderCanvas loop short-circuits on
    // !_needsRedraw, and with hover Enter/Leave silenced nothing else
    // schedules one.
    if (this.dragStarted) {
      this.updateDragHover(x, y);
      this.redraw();
      return true;
    }

    this.updateHoveredControl();
    const hovered = this.hoveredControl;
    if (!hovered || hovered === this) return false;
    hovered.onMouseMoved(x, y, dx, dy);
    hovered.updateCursor();
    return true;
  }

  // Drag-and-drop dispatch helpers.
  private beginDrag(x: number, y: number): void {
    if (!this.dragCandidate) return;
    const pkg = this.dragCandidate.dragAndDrop_GetPackage(x, y);
    if (!pkg || !pkg.draggable) {
      this.dragCandidate = null;
      return;
    }
    if (!this.dragCandidate.dragAndDrop_StartDragging(pkg, x, y)) {
      this.dragCandidate = null;
      return;
    }
    this.dragPackage = pkg;
    this.dragStarted = true;

    // Clear any pre-drag hover state. Otherwise whichever control
    // happened to be under the cursor at the moment the drag-threshold
    // was crossed (e.g. an Output line the user moved across on the
    // way out of the title bar) stays "hovered" for the duration of
    // the drag and renders highlighted underneath the moving ghost.
    if (this.hoveredControl && this.hoveredControl !== this) {
      const old = this.hoveredControl;
      this.hoveredControl = null;
      old.onMouseLeave();
    }

    // Hide the source so the layout reflows around the now-empty slot
    // for as long as the drag lasts. For TabWindowMove the drawcontrol
    // is the DockedTabControl filling its parent DockBase — hiding the
    // DockBase is what actually frees space at the root layout level
    // (hiding the DockedTabControl alone leaves an empty bordered
    // dock occupying the strip). For TabButtonMove (and any other
    // package) hiding the drawcontrol itself is enough: the host
    // TabStrip / panel collapses around the missing button. The
    // explicit `dc.doRender` call inside `renderDragPreview` ignores
    // the `_hidden` flag, so the ghost still renders at the pointer.
    const dc = pkg.drawcontrol as Base | null;
    if (dc) {
      const target = pkg.name === 'TabWindowMove' && dc.parent ? dc.parent : dc;
      this.dragHiddenSource = target;
      this.dragHiddenSourceWasHidden = target.hidden();
      target.setHidden(true);
    }
  }

  private updateDragHover(x: number, y: number): void {
    if (!this.dragPackage) return;
    // Hit-test independent of mouseFocus so the dragged control's own
    // capture doesn't make it the drop target.
    const raw = this.getControlAt(x - this.x(), y - this.y());
    let target: Base | null = raw === this ? null : raw;
    while (target) {
      if (target !== this.dragCandidate && target.dragAndDrop_CanAcceptPackage(this.dragPackage)) {
        break;
      }
      target = target.parent;
    }
    if (target !== this.dragHoverTarget) {
      if (this.dragHoverTarget) this.dragHoverTarget.dragAndDrop_HoverLeave(this.dragPackage);
      this.dragHoverTarget = target;
      if (target) target.dragAndDrop_HoverEnter(this.dragPackage, x, y);
    }
    if (target) target.dragAndDrop_Hover(this.dragPackage, x, y);
  }

  private endDrag(x: number, y: number): void {
    if (!this.dragStarted || !this.dragCandidate || !this.dragPackage) {
      this.dragCandidate = null;
      this.dragPackage = null;
      this.dragStarted = false;
      this.dragHoverTarget = null;
      this.restoreDragHiddenSource(false, '');
      return;
    }
    let success = false;
    if (this.dragHoverTarget) {
      success = this.dragHoverTarget.dragAndDrop_HandleDrop(this.dragPackage, x, y);
      this.dragHoverTarget.dragAndDrop_HoverLeave(this.dragPackage);
    }
    this.dragCandidate.dragAndDrop_EndDragging(success, x, y);
    this.restoreDragHiddenSource(success, this.dragPackage.name);
    this.dragCandidate = null;
    this.dragPackage = null;
    this.dragStarted = false;
    this.dragHoverTarget = null;
  }

  // Reverse the `setHidden(true)` from `beginDrag`. For a TabWindowMove
  // we only leave the source DockBase hidden if the drop emptied it
  // (consolidation already hid it on the way out — restoring would
  // put an empty bordered dock back on screen). A SAME-source drop
  // (re-docking the same dock onto its own edge to claim corner
  // priority) reaches HandleDrop's "skip the move" branch — the dock
  // still has all its tabs, so we restore visibility. Cancelled
  // drags, single-tab moves, and non-dock drags all also restore.
  private restoreDragHiddenSource(success: boolean, packageName: string): void {
    const target = this.dragHiddenSource;
    if (!target) return;
    this.dragHiddenSource = null;
    let leaveHidden = false;
    if (success && packageName === 'TabWindowMove') {
      // Only leave hidden when the source actually has nothing left.
      // Duck-type the isEmpty check — Canvas can't import DockBase
      // (would create a cycle through Base), but every drag source we
      // hide on a TabWindowMove is one.
      const maybeDock = target as { isEmpty?: () => boolean };
      leaveHidden = typeof maybeDock.isEmpty === 'function' && maybeDock.isEmpty();
    }
    if (!leaveHidden) {
      target.setHidden(this.dragHiddenSourceWasHidden);
    }
  }

  inputMouseButton(button: number, pressed: boolean): boolean {
    if (this.hidden()) return false;

    // Drag-release short-circuit: when a drag is in progress and the
    // user releases the left mouse button, route directly to endDrag
    // and stop. The drop target was tracked separately as
    // dragHoverTarget, so we don't need a live hoveredControl — and
    // beginDrag clears hoveredControl on purpose to keep stray
    // controls from staying highlighted underneath the ghost. Without
    // this short-circuit the early-return below (`!hovered` →
    // `return false`) eats the release and the drop never fires.
    if (button === 0 && !pressed && this.dragStarted) {
      this.leftMouseDown = false;
      this.endDrag(this.mousePosition.x, this.mousePosition.y);
      return true;
    }

    const hovered = this.hoveredControl;

    // Close any open menus when the user presses outside them. Skip when
    // the press lands on a menu component (descendant of a Menu) or on a
    // control that owns its own visible menu (ComboBox, strip MenuItem) —
    // those forward the click to their own toggle handler. Matches
    // GWEN inputhandler.cpp:194 and ports the close-on-outside-click path.
    if (pressed && (!hovered || (!hovered.isMenuComponent() && !hovered.ownsOpenMenu()))) {
      this.closeMenus();
    }

    if (!hovered || !hovered.isVisible() || hovered === this) return false;
    if (button >= MAX_MOUSE_BUTTONS) return false;

    if (button === 0) this.leftMouseDown = pressed;
    else if (button === 2) this.rightMouseDown = pressed;

    // Double-click detection: same pixel, same button, within the
    // configured window. GWEN uses an *exact* pixel match — no slop.
    const now = nowSec();
    const isDouble =
      pressed &&
      this.lastClickPos.x === this.mousePosition.x &&
      this.lastClickPos.y === this.mousePosition.y &&
      (now - this.lastClickTime[button]) < DOUBLE_CLICK_SPEED;

    if (pressed && !isDouble) {
      this.lastClickTime[button] = now;
      this.lastClickPos = { x: this.mousePosition.x, y: this.mousePosition.y };
    }

    if (pressed) {
      // Don't reroute keyboard focus through the menu chain. Clicking
      // a MenuStrip item (File / Edit / Help) or a MenuItem otherwise
      // walks up looking for a keyboard-input-enabled ancestor; menu
      // controls don't take keyboard input, so the walk falls off the
      // top and blurs whatever was focused. That kills the TextBox /
      // TextBoxMultiline selection-render gate (`if (!hasFocus()) return`
      // in renderOver), so a user with selected text who clicks Edit
      // sees their selection vanish even though `_cursorPos` /
      // `_cursorEnd` are still set internally. Skip the focus reroute
      // for menu components + menu owners (ComboBox, strip MenuItems);
      // their own click handlers run regardless.
      if (!hovered.isMenuComponent() && !hovered.ownsOpenMenu()) {
        this.findKeyboardFocus(hovered);
      }
    }

    // Drag-and-drop arming + release. On left-press, walk up from the
    // hovered control looking for one whose package is draggable — that
    // becomes the drag candidate; the threshold check in inputMouseMoved
    // promotes it to an active drag. On left-release, finalise any
    // active drag (HandleDrop on the current hover target).
    if (button === 0) {
      if (pressed) {
        let scan: Base | null = hovered;
        while (scan && !scan.dragAndDrop_Draggable()) scan = scan.parent;
        if (scan) {
          this.dragCandidate = scan;
          this.dragStartPos = { x: this.mousePosition.x, y: this.mousePosition.y };
          this.dragStarted = false;
        }
      } else {
        if (this.dragStarted) {
          this.endDrag(this.mousePosition.x, this.mousePosition.y);
        } else {
          this.dragCandidate = null;
        }
      }
    }

    hovered.updateCursor();

    // GWEN's "touch" propagation: any press tells the hovered control's
    // ancestor chain that interaction happened here, so containers like
    // WindowControl can bring themselves to front. Base.touch walks to
    // parent.onChildTouched which by default re-invokes touch on the
    // parent — controls that care (WindowControl) override the hook.
    if (pressed) hovered.touch();

    const mx = this.mousePosition.x;
    const my = this.mousePosition.y;
    switch (button) {
      case 0: // Left
        if (pressed && isDouble) {
          hovered.onMouseDoubleClickLeft(mx, my);
        } else {
          hovered.onMouseClickLeft(mx, my, pressed);
        }
        break;
      case 2: // Right
        if (pressed && isDouble) {
          hovered.onMouseDoubleClickRight(mx, my);
        } else {
          hovered.onMouseClickRight(mx, my, pressed);
        }
        break;
      default:
        // 1 = middle, 3/4 = X1/X2 — GWEN ignores these.
        break;
    }
    return true;
  }

  inputMouseWheel(val: number): boolean {
    if (this.hidden()) return false;
    const hovered = this.hoveredControl;
    if (!hovered || hovered.getCanvas() !== this) return false;
    hovered.onMouseWheeled(val);
    return true;
  }

  inputKey(key: number, pressed: boolean): boolean {
    if (this.hidden()) return false;
    if (key <= Key.Invalid || key >= Key.Count) return false;

    const target = this.keyboardFocus && this.keyboardFocus.isVisible() && this.keyboardFocus.getCanvas() === this
      ? this.keyboardFocus
      : null;

    // Return whether the target actually consumed the key. The router
    // in core/Input.ts uses this to decide whether to preventDefault
    // on the DOM event — Tab, arrow keys, space, etc. otherwise drive
    // BOTH our internal focus / scroll machinery AND the browser's
    // default (focus cycles out of the canvas, page scrolls, etc.).
    let consumed = false;
    if (pressed && !this.keyState[key]) {
      this.keyState[key] = true;
      this.keyNextRepeat[key] = nowSec() + KEY_REPEAT_DELAY;
      this.keyRepeatTarget = target;
      if (target) consumed = target.onKeyPress(key, true);
    } else if (!pressed && this.keyState[key]) {
      this.keyState[key] = false;
      if (target) consumed = target.onKeyRelease(key);
      // Intentionally do *not* clear `keyRepeatTarget` — GWEN doesn't
      // either (Canvas.cpp:221), and it lets a release fire against
      // the original target even after focus moved.
    }

    // Tab is special-cased: it always cycles canvas-internal focus
    // via Base.onKeyTab (which routes through `firstTab` / `nextTab`),
    // but a control that has no specific handler returns `false` from
    // onKeyPress's default branch, so the browser's tab-out-of-canvas
    // default would still fire and the user's focus would jump out
    // of the canvas in addition to cycling inside it. Treat Tab as
    // consumed unconditionally when there's a focused target.
    if (target && key === Key.Tab) consumed = true;

    return consumed;
  }

  inputCharacter(ch: string): boolean {
    if (this.hidden()) return false;
    const cp = ch.codePointAt(0);
    if (cp === undefined || cp < 0x20) return false;
    const target = this.keyboardFocus;
    if (!target || !target.isVisible() || target.getCanvas() !== this || this.isControlDown()) {
      return false;
    }
    target.onChar(ch);
    return true;
  }

  // Walk the visible control tree for a control with a matching
  // accelerator binding (added via `Base.addAccelerator`). First match
  // wins — typically a MenuItem whose `setAccelerator(text)` registered
  // the binding. The standard clipboard / select-all shortcuts route
  // straight to a text-input keyboard-focus target before the tree
  // walk so a focused TextBox eats Ctrl+C/X/V/A even when a menu item
  // also bound those keys.
  inputAccelerator(text: string): boolean {
    if (this.hidden()) return false;
    const focus = this.keyboardFocus;
    if (focus && focus.isVisible() && focus.needsInputChars()) {
      switch (text) {
        case 'Ctrl+C':
          focus.onCopy();
          return true;
        case 'Ctrl+X':
          focus.onCut();
          return true;
        case 'Ctrl+V':
          focus.onPaste();
          return true;
        case 'Ctrl+A':
          focus.onSelectAll();
          return true;
      }
    }
    return this.handleAccelerator(text);
  }

  // ======================================================================
  // Modifier queries
  // ======================================================================

  isKeyDown(key: number): boolean {
    if (key < 0 || key >= Key.Count) return false;
    return this.keyState[key];
  }

  isControlDown(): boolean {
    return this.keyState[Key.Control] || this.keyState[Key.Command];
  }

  isShiftDown(): boolean {
    return this.keyState[Key.Shift];
  }

  isAltDown(): boolean {
    return this.keyState[Key.Alt];
  }
}

// Re-export the constant for tests / tooling that want to tune the
// double-click window.
export { DOUBLE_CLICK_SPEED, KEY_REPEAT_RATE, KEY_REPEAT_DELAY, MAX_MOUSE_BUTTONS };
