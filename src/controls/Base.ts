// Base — the root of the control tree. Ports `Gwen::Controls::Base` from
// include/Gwen/Controls/Base.h + src/Controls/Base.cpp.
//
// Every control inherits from this. It owns hierarchy (parent, children,
// innerPanel), layout metadata (bounds, render-bounds, inner-bounds,
// margin, padding, dock flags), render pipeline (Render / RenderUnder /
// RenderOver / RenderFocus + RecurseLayout), and the input surface
// (mouse enter/leave/click, keyboard, drag-and-drop hooks).
//
// Circular-import strategy:
//   - This module references the `Skin` type only as a parameter in
//     virtual draw hooks. We import it with `import type` so the runtime
//     bundle stays cycle-free. Skin in turn references `Base`, but only
//     as a parameter type on its own draw methods, so `import type` on
//     that side closes the loop cleanly.
//   - Canvas-specific state (hoveredControl, keyboardFocus, mouseFocus)
//     is exposed through a minimal `CanvasLike` structural interface
//     reached via `getCanvas()`. T010 will supply a real `Canvas`
//     subclass; until then the walker simply returns the logical root
//     and all canvas-sensitive hooks no-op safely.
//
// Rules we deviate from GWEN on:
//   - C++ uses `std::list`; we use an Array. Splice cost is O(n) but the
//     child counts are small (typically <20) so it's cheaper overall.
//   - GWEN's deferred-delete (`AddDelayedDelete`) lives on Canvas
//     (`Canvas.addDelayedDelete`) and is flushed inside `Canvas.doThink`.
//     `dispose()` remains the synchronous teardown path for callers that
//     can prove they're outside any active dispatch.
//   - `OnKeyboardFocus` / `OnLostKeyboardFocus` fire synchronously in
//     `focus()` / `blur()`. GWEN is the same.

import { rect, cloneRect, rectEquals, CursorType, point, type Point, type Rect, type Margin, type Padding, type DragAndDropPackage } from '../core/Structures';
import { Signal, type EventInfo } from '../core/Events';
import { Pos } from '../core/Align';
import type { Skin } from '../skin/Skin';

// ---------- CanvasLike — the subset of Canvas this module consults ----------
//
// T010 will define a full `Canvas` class. We only need a handful of state
// fields (hovered control, keyboard focus, mouse focus) plus a `setCursor`
// hook; keeping the interface structural avoids a hard dependency cycle.

export interface CanvasLike {
  hoveredControl: Base | null;
  keyboardFocus: Base | null;
  mouseFocus: Base | null;
  firstTab: Base | null;
  nextTab: Base | null;
  tabList: Base[];
  isShiftDown(): boolean;
  setCursor(c: number): void;
  redraw(): void;
  isCanvas: true;
  // T010: called from `Base.dispose()` so the Canvas can forget any
  // stale references (hover / focus / pending delayed-delete) to a
  // control that's about to vanish. Optional because earlier phases of
  // the port pre-date the concrete Canvas.
  preDeleteCanvas?(ctrl: Base): void;
}

// ---------- Base ----------

export class Base {
  // ---- hierarchy ----
  private _parent: Base | null = null;
  private _actualParent: Base | null = null;
  protected _innerPanel: Base | null = null;
  private _children: Base[] = [];
  private _name = '';

  // ---- bounds / layout ----
  private _bounds: Rect = rect(0, 0, 10, 10);
  // Seed renderBounds to match initial bounds. Otherwise controls whose
  // bounds are never explicitly changed (inner panels of ScrollControl,
  // etc.) have a (0,0,0,0) renderBounds that collapses their children's
  // layout to zero-height strips.
  private _renderBounds: Rect = rect(0, 0, 10, 10);
  private _innerBounds: Rect = rect();
  private _margin: Margin = { top: 0, bottom: 0, left: 0, right: 0 };
  private _padding: Padding = { top: 0, bottom: 0, left: 0, right: 0 };
  private _dock: number = Pos.None;

  // ---- flags ----
  private _hidden = false;
  private _disabled = false;
  private _mouseInputEnabled = true;
  private _keyboardInputEnabled = false;
  private _tabable = false;
  private _tabBoundary = false;
  private _shouldDrawBackground = true;
  private _needsLayout = true;
  private _includeInSize = true;
  private _restrictToParent = false;

  // ---- skin / cursor / tooltip ----
  private _skin: Skin | null = null;
  private _cursor: number = CursorType.Normal;
  private _toolTip: Base | null = null;

  // ---- context menu ----
  // Stored as `Base` (not `Menu`) to avoid an import cycle: `Menu`
  // already imports `Base` as a runtime dependency, and a runtime
  // import in the other direction would loop. Callers pass a `Menu`
  // instance; Canvas narrows back to `Menu` via `instanceof` before
  // opening.
  private _contextMenu: Base | null = null;

  // Accelerator → handler bindings. Populated by `addAccelerator` (used
  // e.g. by MenuItem.setAccelerator). Canvas.inputAccelerator walks the
  // tree calling `handleAccelerator(text)` until a control consumes it.
  private _accelerators: Map<string, () => void> = new Map();

  // ---- drag-and-drop ----
  private _dragAndDropPackage: DragAndDropPackage | null = null;

  // ---- signals ----
  readonly onHoverEnter = new Signal<EventInfo>();
  readonly onHoverLeave = new Signal<EventInfo>();

  constructor(parent: Base | null, name = '') {
    this._name = name;
    if (parent) this.setParent(parent);
  }

  // =======================================================================
  // Hierarchy
  // =======================================================================

  get parent(): Base | null {
    return this._parent;
  }

  get actualParent(): Base | null {
    return this._actualParent;
  }

  setParent(p: Base | null): void {
    if (this._parent === p) return;
    if (this._parent) this._parent.removeChild(this);
    this._parent = p;
    this._actualParent = null;
    if (p) p.addChild(this);
  }

  // Children land on innerPanel when one is installed (scroll controls etc).
  // The innerPanel wiring makes the outer control look like a normal parent
  // to user code while internally routing layout through a sub-panel.
  addChild(c: Base): void {
    if (this._innerPanel) {
      this._innerPanel.addChild(c);
      return;
    }
    this._children.push(c);
    this.onChildAdded(c);
    c._actualParent = this;
  }

  removeChild(c: Base): void {
    if (this._innerPanel === c) {
      this._innerPanel = null;
    }
    if (this._innerPanel) {
      this._innerPanel.removeChild(c);
    }
    const i = this._children.indexOf(c);
    if (i !== -1) {
      this._children.splice(i, 1);
      this.onChildRemoved(c);
    }
  }

  removeAllChildren(): void {
    while (this._children.length > 0) {
      this.removeChild(this._children[0]);
    }
  }

  get children(): readonly Base[] {
    if (this._innerPanel) return this._innerPanel.children;
    return this._children;
  }

  numChildren(): number {
    return this._children.length;
  }

  getChild(i: number): Base | null {
    if (i < 0 || i >= this._children.length) return null;
    return this._children[i];
  }

  isChild(c: Base): boolean {
    return this._children.indexOf(c) !== -1;
  }

  findChildByName(name: string, recursive = false): Base | null {
    for (let i = 0; i < this._children.length; i++) {
      const ch = this._children[i];
      if (ch._name !== '' && ch._name === name) return ch;
      if (recursive) {
        const sub = ch.findChildByName(name, true);
        if (sub) return sub;
      }
    }
    return null;
  }

  // Walks up to the root; T010's Canvas subclass overrides this to return
  // `this` so controls can reach canvas-wide state.
  getCanvas(): CanvasLike | null {
    const p = this._parent;
    if (!p) return null;
    return p.getCanvas();
  }

  sendToBack(): void {
    const ap = this._actualParent;
    if (!ap) return;
    const arr = ap._children;
    if (arr.length === 0 || arr[0] === this) return;
    const i = arr.indexOf(this);
    if (i === -1) return;
    arr.splice(i, 1);
    arr.unshift(this);
    this.invalidateParent();
  }

  bringToFront(): void {
    const ap = this._actualParent;
    if (!ap) return;
    const arr = ap._children;
    if (arr.length === 0 || arr[arr.length - 1] === this) return;
    const i = arr.indexOf(this);
    if (i === -1) return;
    arr.splice(i, 1);
    arr.push(this);
    this.invalidateParent();
    this.redraw();
  }

  bringNextToControl(child: Base, before: boolean): void {
    const ap = this._actualParent;
    if (!ap) return;
    const arr = ap._children;
    const mi = arr.indexOf(this);
    if (mi !== -1) arr.splice(mi, 1);
    let i = arr.indexOf(child);
    if (i === -1) {
      this.bringToFront();
      return;
    }
    if (before) {
      i += 1;
      if (i >= arr.length) {
        this.bringToFront();
        return;
      }
    }
    arr.splice(i, 0, this);
    this.invalidateParent();
  }

  // Install `p` as the inner panel. Subsequent `addChild` calls route here.
  // GWEN subclasses set `m_InnerPanel` directly; we expose a helper so the
  // field can stay private on the outside while subclasses compose cleanly.
  protected setInnerPanel(p: Base | null): void {
    this._innerPanel = p;
  }

  getInnerPanel(): Base | null {
    return this._innerPanel;
  }

  // =======================================================================
  // Touch propagation (GWEN's Base::Touch / Base::OnChildTouched).
  //
  // Window, TreeNode, and ComboBox rely on this to bubble "you are part of
  // an interactive chain" signals up the tree — e.g. touching a menu item
  // bubbles up so the menu knows a descendant is still alive. Base's
  // default walks to the parent; subclasses override `onChildTouched` to
  // react (e.g. bring-to-front).
  // =======================================================================

  touch(): void {
    if (this._parent) this._parent.onChildTouched(this);
  }

  protected onChildTouched(_child: Base): void {
    this.touch();
  }

  // Whether this control participates in the menu accelerator / close-on-
  // outside-click chain. Walks UP the parent chain so any descendant of a
  // Menu (the popup body, its scroll container, its MenuItems) inherits
  // the truthy answer. Matches GWEN Base::IsMenuComponent (Base.cpp:903).
  isMenuComponent(): boolean {
    if (!this._parent) return false;
    return this._parent.isMenuComponent();
  }

  // True for controls that own a popup menu currently shown (ComboBox,
  // MenuItem on a strip). Canvas's outside-click `closeMenus` skips these
  // so the owner's own click handler can run and toggle its menu.
  ownsOpenMenu(): boolean {
    return false;
  }

  // Recursively asks every descendant to close any open menus. Base just
  // walks the tree; Menu overrides to actually close itself + descendants.
  // Matches GWEN Base::CloseMenus (Base.cpp:910).
  closeMenus(): void {
    for (let i = 0; i < this._children.length; i++) {
      this._children[i].closeMenus();
    }
  }

  // =======================================================================
  // Name
  // =======================================================================

  setName(s: string): void {
    this._name = s;
  }

  getName(): string {
    return this._name;
  }

  // =======================================================================
  // Bounds / layout
  // =======================================================================

  x(): number {
    return this._bounds.x;
  }
  y(): number {
    return this._bounds.y;
  }
  width(): number {
    return this._bounds.w;
  }
  height(): number {
    return this._bounds.h;
  }
  bottom(): number {
    return this._bounds.y + this._bounds.h + this._margin.bottom;
  }
  right(): number {
    return this._bounds.x + this._bounds.w + this._margin.right;
  }

  getPos(): Point {
    return { x: this._bounds.x, y: this._bounds.y };
  }

  setPos(x: number, y: number): void {
    this.setBounds(x, y, this._bounds.w, this._bounds.h);
  }

  setWidth(w: number): void {
    this.setSize(w, this._bounds.h);
  }

  setHeight(h: number): void {
    this.setSize(this._bounds.w, h);
  }

  setSize(w: number, h: number): boolean {
    return this.setBounds(this._bounds.x, this._bounds.y, w, h);
  }

  getSize(): Point {
    return { x: this._bounds.w, y: this._bounds.h };
  }

  setBounds(rOrX: Rect | number, y?: number, w?: number, h?: number): boolean {
    let nx: number;
    let ny: number;
    let nw: number;
    let nh: number;
    if (typeof rOrX === 'number') {
      nx = rOrX;
      ny = y ?? 0;
      nw = w ?? 0;
      nh = h ?? 0;
    } else {
      nx = rOrX.x;
      ny = rOrX.y;
      nw = rOrX.w;
      nh = rOrX.h;
    }
    const b = this._bounds;
    if (b.x === nx && b.y === ny && b.w === nw && b.h === nh) return false;
    const old = cloneRect(b);
    b.x = nx;
    b.y = ny;
    b.w = nw;
    b.h = nh;
    this.onBoundsChanged(old);
    return true;
  }

  getBounds(): Rect {
    return this._bounds;
  }

  getRenderBounds(): Rect {
    return this._renderBounds;
  }

  // Virtual hook — default places the render window flush with the
  // control's local origin. Subclasses with a drop-shadow or outset visual
  // expand here.
  updateRenderBounds(): void {
    this._renderBounds.x = 0;
    this._renderBounds.y = 0;
    this._renderBounds.w = this._bounds.w;
    this._renderBounds.h = this._bounds.h;
  }

  getInnerBounds(): Rect {
    return this._innerBounds;
  }

  getPadding(): Padding {
    return this._padding;
  }

  setPadding(p: Padding): void {
    const cur = this._padding;
    if (cur.left === p.left && cur.top === p.top && cur.right === p.right && cur.bottom === p.bottom) {
      return;
    }
    this._padding = { top: p.top, bottom: p.bottom, left: p.left, right: p.right };
    this.invalidate();
    this.invalidateParent();
  }

  getMargin(): Margin {
    return this._margin;
  }

  setMargin(m: Margin): void {
    const cur = this._margin;
    if (cur.left === m.left && cur.top === m.top && cur.right === m.right && cur.bottom === m.bottom) {
      return;
    }
    this._margin = { top: m.top, bottom: m.bottom, left: m.left, right: m.right };
    this.invalidate();
    this.invalidateParent();
  }

  dock(pos: number): void {
    if (this._dock === pos) return;
    this._dock = pos;
    this.invalidate();
    this.invalidateParent();
  }

  getDock(): number {
    return this._dock;
  }

  // Aligns this control within its parent's inner bounds. Matches
  // `Gwen::Controls::Base::Position` at Base.cpp:190.
  position(pos: number, xpad = 0, ypad = 0): void {
    const parent = this._parent;
    if (!parent) return;
    const bounds = parent.getInnerBounds();
    const m = this._margin;
    let x = this._bounds.x;
    let y = this._bounds.y;
    if (pos & Pos.Left) x = bounds.x + xpad + m.left;
    if (pos & Pos.Right) x = bounds.x + (bounds.w - this._bounds.w - xpad - m.right);
    if (pos & Pos.CenterH) x = bounds.x + (bounds.w - this._bounds.w) * 0.5;
    if (pos & Pos.Top) y = bounds.y + ypad;
    if (pos & Pos.Bottom) y = bounds.y + (bounds.h - this._bounds.h - ypad);
    if (pos & Pos.CenterV) y = bounds.y + (bounds.h - this._bounds.h) * 0.5;
    this.setPos(x, y);
  }

  moveTo(x: number, y: number): void {
    if (this._restrictToParent && this._parent) {
      const p = this._parent;
      const pm = p.getMargin();
      const pad = this._padding;
      if (x - pad.left < pm.left) x = pm.left + pad.left;
      if (y - pad.top < pm.top) y = pm.top + pad.top;
      if (x + this._bounds.w + pad.right > p.width() - pm.right) {
        x = p.width() - pm.right - this._bounds.w - pad.right;
      }
      if (y + this._bounds.h + pad.bottom > p.height() - pm.bottom) {
        y = p.height() - pm.bottom - this._bounds.h - pad.bottom;
      }
    }
    this.setBounds(x, y, this._bounds.w, this._bounds.h);
  }

  moveBy(dx: number, dy: number): void {
    this.moveTo(this._bounds.x + dx, this._bounds.y + dy);
  }

  setRestrictToParent(b: boolean): void {
    this._restrictToParent = b;
  }
  shouldRestrictToParent(): boolean {
    return this._restrictToParent;
  }

  doNotIncludeInSize(): void {
    this._includeInSize = false;
  }
  shouldIncludeInSize(): boolean {
    return this._includeInSize;
  }

  childrenSize(): Point {
    let x = 0;
    let y = 0;
    for (let i = 0; i < this._children.length; i++) {
      const c = this._children[i];
      if (c._hidden) continue;
      if (!c._includeInSize) continue;
      if (c.right() > x) x = c.right();
      if (c.bottom() > y) y = c.bottom();
    }
    return { x, y };
  }

  sizeToChildren(w = true, h = true): boolean {
    const size = this.childrenSize();
    size.y += this._padding.bottom;
    size.x += this._padding.right;
    return this.setSize(w ? size.x : this._bounds.w, h ? size.y : this._bounds.h);
  }

  // Minimum size floor used by Resizer and future layout clamps. GWEN exposes
  // this as a virtual so Window / Panel subclasses can enforce chrome
  // budgets; Base's default is a 1×1 square so pathological drags don't
  // collapse the target to a zero-size rect.
  getMinimumSize(): Point {
    return point(1, 1);
  }

  // =======================================================================
  // Visibility / disabled / input flags
  // =======================================================================

  setHidden(b: boolean): void {
    if (this._hidden === b) return;
    this._hidden = b;
    this.invalidate();
    this.redraw();
  }

  hidden(): boolean {
    return this._hidden;
  }

  isVisible(): boolean {
    if (this._hidden) return false;
    if (this._parent) return this._parent.isVisible();
    return true;
  }

  hide(): void {
    this.setHidden(true);
  }

  show(): void {
    this.setHidden(false);
  }

  setDisabled(b: boolean): void {
    if (this._disabled === b) return;
    this._disabled = b;
    this.redraw();
  }

  isDisabled(): boolean {
    return this._disabled;
  }

  setMouseInputEnabled(b: boolean): void {
    this._mouseInputEnabled = b;
  }

  getMouseInputEnabled(): boolean {
    return this._mouseInputEnabled;
  }

  setKeyboardInputEnabled(b: boolean): void {
    this._keyboardInputEnabled = b;
  }

  getKeyboardInputEnabled(): boolean {
    return this._keyboardInputEnabled;
  }

  needsInputChars(): boolean {
    return false;
  }

  isTabable(): boolean {
    return this._tabable;
  }

  setTabable(b: boolean): void {
    this._tabable = b;
  }

  shouldDrawBackground(): boolean {
    return this._shouldDrawBackground;
  }

  setShouldDrawBackground(b: boolean): void {
    this._shouldDrawBackground = b;
  }

  shouldClip(): boolean {
    return true;
  }

  // =======================================================================
  // Invalidation / redraw
  // =======================================================================

  invalidate(): void {
    this._needsLayout = true;
  }

  invalidateParent(): void {
    if (this._parent) this._parent.invalidate();
  }

  invalidateChildren(recursive = false): void {
    for (let i = 0; i < this._children.length; i++) {
      const c = this._children[i];
      c.invalidate();
      if (recursive) c.invalidateChildren(true);
    }
    if (this._innerPanel) {
      for (let i = 0; i < this._innerPanel._children.length; i++) {
        const c = this._innerPanel._children[i];
        c.invalidate();
        if (recursive) c.invalidateChildren(true);
      }
    }
  }

  needsLayout(): boolean {
    return this._needsLayout;
  }

  // Walks up to the canvas and marks the frame dirty. Until T010 supplies
  // a real canvas, this is a best-effort walk — safe to call pre-canvas
  // because it simply no-ops at the root.
  redraw(): void {
    const canvas = this.getCanvas();
    if (canvas) canvas.redraw();
  }

  // =======================================================================
  // Layout pipeline
  // =======================================================================

  // RecurseLayout — the heart of GWEN's docking layout. Ported line-for-
  // line from Base.cpp:747.
  recurseLayout(skin: Skin): void {
    if (this._skin) skin = this._skin;
    if (this._hidden) return;

    if (this._needsLayout) {
      this._needsLayout = false;
      this.layout(skin);
    }

    const rb = this._renderBounds;
    // Local bounds start as render bounds minus padding.
    let bx = rb.x + this._padding.left;
    let by = rb.y + this._padding.top;
    let bw = rb.w - this._padding.left - this._padding.right;
    let bh = rb.h - this._padding.top - this._padding.bottom;

    for (let i = 0; i < this._children.length; i++) {
      const child = this._children[i];
      if (child._hidden) continue;
      const iDock = child._dock;
      if (iDock & Pos.Fill) continue;

      if (iDock & Pos.Top) {
        const m = child._margin;
        child.setBounds(bx + m.left, by + m.top, bw - m.left - m.right, child.height());
        const iHeight = m.top + m.bottom + child.height();
        by += iHeight;
        bh -= iHeight;
      }
      if (iDock & Pos.Left) {
        const m = child._margin;
        child.setBounds(bx + m.left, by + m.top, child.width(), bh - m.top - m.bottom);
        const iWidth = m.left + m.right + child.width();
        bx += iWidth;
        bw -= iWidth;
      }
      if (iDock & Pos.Right) {
        const m = child._margin;
        child.setBounds(bx + bw - child.width() - m.right, by + m.top, child.width(), bh - m.top - m.bottom);
        const iWidth = m.left + m.right + child.width();
        bw -= iWidth;
      }
      if (iDock & Pos.Bottom) {
        const m = child._margin;
        child.setBounds(bx + m.left, by + bh - child.height() - m.bottom, bw - m.left - m.right, child.height());
        bh -= child.height() + m.bottom + m.top;
      }

      child.recurseLayout(skin);
    }

    this._innerBounds.x = bx;
    this._innerBounds.y = by;
    this._innerBounds.w = bw;
    this._innerBounds.h = bh;

    // Fill pass uses whatever strip is left.
    for (let i = 0; i < this._children.length; i++) {
      const child = this._children[i];
      const iDock = child._dock;
      if (!(iDock & Pos.Fill)) continue;
      const m = child._margin;
      child.setBounds(bx + m.left, by + m.top, bw - m.left - m.right, bh - m.top - m.bottom);
      child.recurseLayout(skin);
    }

    this.postLayout(skin);

    const canvas = this.getCanvas();
    if (canvas && this._tabable && !this._disabled) {
      if (!canvas.firstTab) canvas.firstTab = this;
      if (!canvas.nextTab) canvas.nextTab = this;
      canvas.tabList.push(this);
    }
    if (canvas && canvas.keyboardFocus === this) {
      canvas.nextTab = null;
    }
  }

  // Override hooks — empty by default. Canvas and custom controls override.
  layout(_skin: Skin): void {
    // no-op
  }
  postLayout(_skin: Skin): void {
    // no-op
  }

  // =======================================================================
  // Render pipeline
  // =======================================================================

  doRender(skin: Skin): void {
    if (this._skin) skin = this._skin;
    this.think();
    this.renderRecursive(skin, this._bounds);
  }

  renderRecursive(skin: Skin, cliprect: Rect): void {
    const render = skin.renderer;
    const oldOffset = render.getRenderOffset();
    render.addRenderOffset(cliprect);
    this.renderUnder(skin);
    const oldClip = cloneRect(render.clipRegion());

    if (this.shouldClip()) {
      render.addClipRegion(cliprect);
      if (!render.clipRegionVisible()) {
        render.setRenderOffset(oldOffset);
        render.setClipRegion(oldClip);
        return;
      }
    }

    render.startClip();
    this.render(skin);
    for (let i = 0; i < this._children.length; i++) {
      const c = this._children[i];
      if (c._hidden) continue;
      c.doRender(skin);
    }
    render.endClip();

    render.setClipRegion(oldClip);
    render.startClip();
    this.renderOver(skin);
    this.renderFocus(skin);
    render.endClip();
    render.setRenderOffset(oldOffset);
  }

  // Virtual render hooks. Empty by default; subclasses override.
  render(_skin: Skin): void {
    // no-op
  }
  renderUnder(_skin: Skin): void {
    // no-op
  }
  renderOver(_skin: Skin): void {
    // no-op
  }

  renderFocus(skin: Skin): void {
    const canvas = this.getCanvas();
    if (!canvas || canvas.keyboardFocus !== this) return;
    if (!this._tabable) return;
    skin.drawKeyboardHighlight(this, this._renderBounds, 3);
  }

  // =======================================================================
  // Skin
  // =======================================================================

  getSkin(): Skin {
    if (this._skin) return this._skin;
    if (this._parent) return this._parent.getSkin();
    throw new Error('Base.getSkin(): no skin set anywhere in the control tree');
  }

  setSkin(s: Skin, doChildren = false): void {
    if (this._skin === s) return;
    this._skin = s;
    this.invalidate();
    this.redraw();
    this.onSkinChanged(s);
    if (doChildren) {
      for (let i = 0; i < this._children.length; i++) {
        this._children[i].setSkin(s, true);
      }
    }
  }

  onSkinChanged(_s: Skin): void {
    // no-op
  }

  // =======================================================================
  // Coordinate conversion
  // =======================================================================

  localPosToCanvas(p: Point): Point {
    if (this._parent) {
      let x = p.x + this._bounds.x;
      let y = p.y + this._bounds.y;
      const parentInner = this._parent._innerPanel;
      if (parentInner && parentInner.isChild(this)) {
        x += parentInner.x();
        y += parentInner.y();
      }
      return this._parent.localPosToCanvas({ x, y });
    }
    return p;
  }

  canvasPosToLocal(p: Point): Point {
    if (this._parent) {
      let x = p.x - this._bounds.x;
      let y = p.y - this._bounds.y;
      const parentInner = this._parent._innerPanel;
      if (parentInner && parentInner.isChild(this)) {
        x -= parentInner.x();
        y -= parentInner.y();
      }
      return this._parent.canvasPosToLocal({ x, y });
    }
    return p;
  }

  // =======================================================================
  // Mouse
  // =======================================================================

  onMouseMoved(_x: number, _y: number, _dx: number, _dy: number): void {
    // no-op
  }

  // Mouse wheel bubbles up through actualParent (so scroll panels can grab
  // it even when a non-scrollable child is hovered).
  onMouseWheeled(delta: number): boolean {
    if (this._actualParent) return this._actualParent.onMouseWheeled(delta);
    return false;
  }

  onMouseClickLeft(_x: number, _y: number, _pressed: boolean): void {
    // no-op
  }

  onMouseClickRight(_x: number, _y: number, _pressed: boolean): void {
    // no-op
  }

  onMouseDoubleClickLeft(x: number, y: number): void {
    this.onMouseClickLeft(x, y, true);
  }

  onMouseDoubleClickRight(x: number, y: number): void {
    this.onMouseClickRight(x, y, true);
  }

  onMouseEnter(): void {
    const ev: EventInfo = {
      controlCaller: this,
      control: null,
      data: null,
      string: '',
      point: { x: 0, y: 0 },
      integer: 0,
    };
    this.onHoverEnter.emit(ev);
    this.redraw();
  }

  onMouseLeave(): void {
    const ev: EventInfo = {
      controlCaller: this,
      control: null,
      data: null,
      string: '',
      point: { x: 0, y: 0 },
      integer: 0,
    };
    this.onHoverLeave.emit(ev);
    this.redraw();
  }

  isHovered(): boolean {
    const c = this.getCanvas();
    return !!c && c.hoveredControl === this;
  }

  shouldDrawHover(): boolean {
    const c = this.getCanvas();
    if (!c) return false;
    return c.mouseFocus === this || c.mouseFocus === null;
  }

  // =======================================================================
  // Focus + keyboard
  // =======================================================================

  focus(): void {
    const canvas = this.getCanvas();
    if (!canvas) return;
    if (canvas.keyboardFocus === this) return;
    if (canvas.keyboardFocus) canvas.keyboardFocus.onLostKeyboardFocus();
    canvas.keyboardFocus = this;
    this.onKeyboardFocus();
    this.redraw();
  }

  blur(): void {
    const canvas = this.getCanvas();
    if (!canvas) return;
    if (canvas.keyboardFocus !== this) return;
    canvas.keyboardFocus = null;
    this.onLostKeyboardFocus();
    this.redraw();
  }

  hasFocus(): boolean {
    const c = this.getCanvas();
    return !!c && c.keyboardFocus === this;
  }

  onKeyboardFocus(): void {
    // no-op
  }

  onLostKeyboardFocus(): void {
    // no-op
  }

  // Dispatches a key press to the appropriate on<Key>* handler, then
  // bubbles unhandled keys to the parent. Matches Base.cpp:1042.
  onKeyPress(key: number, pressed = true): boolean {
    let handled = false;
    // Key codes must match the `Key` enum in core/Input.ts.
    switch (key) {
      case 7: handled = this.onKeyTab(pressed); break;        // Tab
      case 8: handled = this.onKeySpace(pressed); break;      // Space
      case 9: handled = this.onKeyHome(pressed); break;       // Home
      case 10: handled = this.onKeyEnd(pressed); break;       // End
      case 1: handled = this.onKeyReturn(pressed); break;     // Return
      case 2: handled = this.onKeyBackspace(pressed); break;  // Backspace
      case 3: handled = this.onKeyDelete(pressed); break;     // Delete
      case 5: handled = this.onKeyRight(pressed); break;      // Right
      case 4: handled = this.onKeyLeft(pressed); break;       // Left
      case 12: handled = this.onKeyUp(pressed); break;        // Up
      case 13: handled = this.onKeyDown(pressed); break;      // Down
      case 14: handled = this.onKeyEscape(pressed); break;    // Escape
      default: break;
    }
    if (!handled && this._parent) {
      this._parent.onKeyPress(key, pressed);
    }
    return handled;
  }

  onKeyRelease(key: number): boolean {
    return this.onKeyPress(key, false);
  }

  onChar(_ch: string): boolean {
    return false;
  }

  // Tab navigation scope. When true, Tab navigation rooted inside
  // this control stays inside it instead of leaking out to siblings
  // — used by WindowControl, Modal, DockBase, and TabControl pages.
  // The canvas itself is the outermost implicit boundary, so leaving
  // every other control at `false` keeps the existing single-cycle
  // behaviour for free-form layouts.
  isTabBoundary(): boolean {
    return this._tabBoundary;
  }

  setTabBoundary(b: boolean): void {
    this._tabBoundary = b;
  }

  onKeyTab(down: boolean): boolean {
    if (!down) return true;
    const canvas = this.getCanvas();
    if (!canvas) return true;
    const fullList = canvas.tabList;
    if (fullList.length === 0) return true;
    const reverse = canvas.isShiftDown();
    const focus = canvas.keyboardFocus;
    // Find the tab scope: the nearest ancestor that opted into being
    // a boundary. `null` means "no in-tree boundary found" — the
    // canvas itself is the implicit outermost boundary, and every
    // tabable that didn't get filtered out by some closer scope
    // belongs there.
    const scope = focus ? findTabScope(focus) : null;
    const list = scope === null
      ? fullList.filter((c) => findTabScope(c) === null)
      : fullList.filter((c) => c === scope || isWithinTabScope(c, scope));
    if (list.length === 0) return true;
    const idx = focus ? list.indexOf(focus) : -1;
    let next: Base;
    if (idx === -1) {
      next = reverse ? list[list.length - 1] : list[0];
    } else {
      const n = list.length;
      next = list[(idx + (reverse ? -1 : 1) + n) % n];
    }
    next.focus();
    this.redraw();
    return true;
  }

  onKeyReturn(_down: boolean): boolean {
    return false;
  }
  onKeySpace(_down: boolean): boolean {
    return false;
  }
  onKeyBackspace(_down: boolean): boolean {
    return false;
  }
  onKeyDelete(_down: boolean): boolean {
    return false;
  }
  onKeyRight(_down: boolean): boolean {
    return false;
  }
  onKeyLeft(_down: boolean): boolean {
    return false;
  }
  onKeyHome(_down: boolean): boolean {
    return false;
  }
  onKeyEnd(_down: boolean): boolean {
    return false;
  }
  onKeyUp(_down: boolean): boolean {
    return false;
  }
  onKeyDown(_down: boolean): boolean {
    return false;
  }
  onKeyEscape(_down: boolean): boolean {
    return false;
  }

  // =======================================================================
  // Hit test
  // =======================================================================

  // Children are walked in reverse (last = top-most). The first child that
  // claims the point wins; if none do, `this` claims iff it's mouse-enabled.
  getControlAt(x: number, y: number, onlyIfMouseEnabled = true): Base | null {
    if (this._hidden) return null;
    if (x < 0 || y < 0 || x >= this._bounds.w || y >= this._bounds.h) return null;
    for (let i = this._children.length - 1; i >= 0; i--) {
      const child = this._children[i];
      const found = child.getControlAt(x - child.x(), y - child.y(), onlyIfMouseEnabled);
      if (found) return found;
    }
    if (onlyIfMouseEnabled && !this._mouseInputEnabled) return null;
    return this;
  }

  // =======================================================================
  // Cursor + tooltip
  // =======================================================================

  setCursor(c: number): void {
    this._cursor = c;
  }

  updateCursor(): void {
    const canvas = this.getCanvas();
    if (canvas) canvas.setCursor(this._cursor);
  }

  // Accelerator (keyboard shortcut) bindings. The string is normalised to
  // a canonical form (`"Ctrl+Shift+N"`) so the lookup is case-insensitive
  // and modifier-order-insensitive.
  addAccelerator(text: string, handler: () => void): void {
    this._accelerators.set(canonicalAccelerator(text), handler);
  }

  removeAccelerator(text: string): void {
    this._accelerators.delete(canonicalAccelerator(text));
  }

  hasAccelerator(text: string): boolean {
    return this._accelerators.has(canonicalAccelerator(text));
  }

  // Walks this subtree looking for a control whose accelerator matches.
  // Returns true once a handler fires (caller stops at the first match).
  // Uses `this.children` (the getter) so we transparently descend into
  // any innerPanel (ScrollControl, Menu, etc.). Visibility is *not* a
  // gate — a closed File menu still owns its `Ctrl+N` accelerator,
  // which is the whole reason the shortcut exists.
  handleAccelerator(text: string): boolean {
    if (this._disabled) return false;
    const key = canonicalAccelerator(text);
    const h = this._accelerators.get(key);
    if (h) {
      h();
      return true;
    }
    for (const c of this.children) {
      if (c.handleAccelerator(text)) return true;
    }
    return false;
  }

  setToolTip(text: string): void {
    // Base provides a non-Label-aware fallback (text stashed on a hidden
    // child via setName). `Label.setToolTip` (T100) overrides this to
    // build a real text-bearing Label that Canvas can render.
    if (!text) {
      this.setToolTipControl(null);
      return;
    }
    const tip = new Base(null);
    tip.setName(text);
    this.setToolTipControl(tip);
  }

  setToolTipControl(c: Base | null): void {
    if (this._toolTip && this._toolTip !== c) {
      this._toolTip.setParent(null);
    }
    this._toolTip = c;
    if (c) {
      c.setParent(this);
      c.setHidden(true);
    }
  }

  getToolTip(): Base | null {
    return this._toolTip;
  }

  // =======================================================================
  // Context menu
  //
  // Each control may attach a `Menu` to be shown on right-click. When
  // the user right-clicks anywhere on the canvas, `Canvas` walks the
  // hovered-control's parent chain calling `onContextMenuRequest(x, y)`
  // and opens the first non-null `Menu` it finds. A control with no
  // explicit menu defers to its parent; `Canvas` itself extends `Base`,
  // so `canvas.setContextMenu(...)` becomes the global "background"
  // menu shown when nothing in the chain overrides.
  //
  // The field is typed `Base` to avoid a runtime import cycle (`Menu`
  // already imports `Base`); callers pass a `Menu` and `Canvas`
  // narrows back to `Menu` via `instanceof` before opening.
  // =======================================================================

  /**
   * Attach a context menu (right-click menu) to this control. Pass
   * `null` to clear. The menu is not destroyed by this call — it stays
   * around for future right-clicks until the caller disposes it.
   *
   * The menu should be parented to the canvas (or another top-level
   * container) so it draws above everything else; `Canvas` will
   * reparent automatically if needed when the menu is opened.
   */
  setContextMenu(menu: Base | null): void {
    this._contextMenu = menu;
  }

  getContextMenu(): Base | null {
    return this._contextMenu;
  }

  /**
   * Hook called by Canvas on right-click to find the menu to show.
   * Default returns the menu set via `setContextMenu`. Override this
   * to build menus dynamically (populate items based on the click
   * location, suppress for certain regions, etc.). Return `null` to
   * defer to the parent in the chain — Canvas walks up until something
   * returns a non-null menu.
   */
  onContextMenuRequest(_x: number, _y: number): Base | null {
    return this._contextMenu;
  }

  // =======================================================================
  // Protected hooks
  // =======================================================================

  protected onBoundsChanged(oldBounds: Rect): void {
    if (this._parent) this._parent.onChildBoundsChanged(oldBounds, this);
    if (this._bounds.w !== oldBounds.w || this._bounds.h !== oldBounds.h) {
      this.invalidate();
    }
    this.redraw();
    this.updateRenderBounds();
  }

  protected onChildBoundsChanged(_oldBounds: Rect, _child: Base): void {
    // no-op
  }

  protected onChildAdded(_child: Base): void {
    this.invalidate();
  }

  protected onChildRemoved(_child: Base): void {
    this.invalidate();
  }

  // =======================================================================
  // Teardown
  // =======================================================================

  dispose(): void {
    // Let the owning canvas drop any cached references (hover / focus /
    // pending delayed-delete) before we tear the subtree down. If the
    // canvas hasn't supplied `preDeleteCanvas` (older CanvasLike impls)
    // we fall through to the legacy manual null-out at the bottom.
    const rootCanvas = this.getCanvas();
    if (rootCanvas && typeof rootCanvas.preDeleteCanvas === 'function') {
      rootCanvas.preDeleteCanvas(this);
    }
    for (let i = this._children.length - 1; i >= 0; i--) {
      this._children[i].dispose();
    }
    this._children.length = 0;
    if (this._parent) {
      this._parent.removeChild(this);
      this._parent = null;
    }
    this._actualParent = null;
    this.onHoverEnter.clear();
    this.onHoverLeave.clear();
    const canvas = this.getCanvas();
    if (canvas) {
      if (canvas.hoveredControl === this) canvas.hoveredControl = null;
      if (canvas.keyboardFocus === this) canvas.keyboardFocus = null;
      if (canvas.mouseFocus === this) canvas.mouseFocus = null;
    }
  }

  // =======================================================================
  // Think (per-frame hook)
  // =======================================================================

  think(): void {
    // no-op — subclasses override for animation/timers/polling.
  }

  // =======================================================================
  // Clipboard hooks
  // =======================================================================

  onPaste(): void {
    // no-op
  }
  onCopy(): void {
    // no-op
  }
  onCut(): void {
    // no-op
  }
  onSelectAll(): void {
    // no-op
  }

  // =======================================================================
  // Drag-and-drop (giver + receiver)
  //
  // The dispatch loop lives in `Canvas.inputMouseMoved` /
  // `Canvas.inputMouseButton`: a press over a draggable control records a
  // candidate, threshold movement promotes the candidate to an active
  // drag (calling `StartDragging`), every subsequent move dispatches
  // `HoverEnter` / `Hover` / `HoverLeave` to whichever ancestor of the
  // pointer's hit-test result accepts the package, and release calls
  // `HandleDrop`. Subclasses override these hooks to opt-in (DockBase is
  // the canonical receiver; TabButton + TabTitleBar are canonical
  // sources). The base no-ops are deliberate — they let any control
  // reach the dispatch path without forcing all of them to participate.
  // =======================================================================

  dragAndDrop_SetPackage(draggable: boolean, name = '', userdata: unknown = null): void {
    if (!this._dragAndDropPackage) {
      this._dragAndDropPackage = {
        name: '',
        userdata: null,
        draggable: false,
        drawcontrol: null,
        holdoffset: { x: 0, y: 0 },
      };
    }
    this._dragAndDropPackage.draggable = draggable;
    this._dragAndDropPackage.name = name;
    this._dragAndDropPackage.userdata = userdata;
  }

  dragAndDrop_Draggable(): boolean {
    if (!this._dragAndDropPackage) return false;
    return this._dragAndDropPackage.draggable;
  }

  dragAndDrop_GetPackage(_x: number, _y: number): DragAndDropPackage | null {
    return this._dragAndDropPackage;
  }

  // Default: take ownership of the package by recording the grab offset
  // (so the drag preview hangs off the pointer at the correct anchor)
  // and pointing `drawcontrol` at this control.
  dragAndDrop_StartDragging(p: DragAndDropPackage, x: number, y: number): boolean {
    p.holdoffset = this.canvasPosToLocal({ x, y });
    p.drawcontrol = this;
    return true;
  }

  dragAndDrop_ShouldStartDrag(): boolean {
    return true;
  }

  dragAndDrop_EndDragging(_success: boolean, _x: number, _y: number): void {
    // Default: nothing. Subclasses (DockBase via the source TabControl's
    // onLoseTab) handle their own bookkeeping. Sources that need to
    // restore visual state (depressed=false on a button-like origin) can
    // override here.
  }

  dragAndDrop_HoverEnter(_p: DragAndDropPackage, _x: number, _y: number): void {
    // Default no-op; receivers (DockBase) override to set hover state.
  }

  dragAndDrop_HoverLeave(_p: DragAndDropPackage): void {
    // Default no-op; receivers override to clear hover state.
  }

  dragAndDrop_Hover(_p: DragAndDropPackage, _x: number, _y: number): void {
    // Default no-op; receivers override to update directional preview.
  }

  // Default: receivers acknowledge the drop. The actual reparenting (or
  // any other side effect) is the subclass's job — see DockBase for the
  // `TabButtonMove` / `TabWindowMove` handling.
  dragAndDrop_HandleDrop(_p: DragAndDropPackage, _x: number, _y: number): boolean {
    return true;
  }

  dragAndDrop_CanAcceptPackage(_p: DragAndDropPackage): boolean {
    return false;
  }
}

// Rect comparison exposed for diagnostics / tests.
export { rectEquals };

// Walk up `ctrl`'s ancestors looking for the nearest one with
// `isTabBoundary() === true`. Returns `null` when the chain reaches
// the canvas without finding a boundary — onKeyTab interprets that
// as "the outer canvas-level scope".
function findTabScope(ctrl: Base): Base | null {
  let p: Base | null = ctrl.parent;
  while (p) {
    if (p.isTabBoundary()) return p;
    p = p.parent;
  }
  return null;
}

// True when `scope` is in `ctrl`'s ancestor chain AND no closer
// boundary intervenes (otherwise `ctrl` would belong to a nested
// scope, not `scope`'s).
function isWithinTabScope(ctrl: Base, scope: Base): boolean {
  let p: Base | null = ctrl.parent;
  while (p) {
    if (p === scope) return true;
    if (p.isTabBoundary()) return false;
    p = p.parent;
  }
  return false;
}

// Canonicalise an accelerator string so lookup is case- and modifier-
// order-insensitive. "ctrl+n", "Ctrl+N", "N+Ctrl" all map to "CTRL+N".
function canonicalAccelerator(text: string): string {
  const parts = text.split('+').map((p) => p.trim().toUpperCase()).filter((p) => p.length > 0);
  if (parts.length === 0) return '';
  // Pull modifiers to the front in a fixed order, then the key.
  const order: Record<string, number> = { CTRL: 0, SHIFT: 1, ALT: 2, META: 3, CMD: 3 };
  parts.sort((a, b) => {
    const ai = a in order ? order[a] : 99;
    const bi = b in order ? order[b] : 99;
    if (ai === bi) return a < b ? -1 : 1;
    return ai - bi;
  });
  // Normalise CMD/META aliases.
  return parts.map((p) => (p === 'CMD' ? 'META' : p)).join('+');
}
