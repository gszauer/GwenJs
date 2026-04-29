// DockBase — the root of GWEN's dockable-panel hierarchy. Ports
// `Gwen::Controls::DockBase` from include/Gwen/Controls/DockBase.h +
// src/Controls/DockBase.cpp.
//
// Layout model:
//   * The *root* DockBase is just an empty 200×200 container with padding.
//     It holds no DockedTabControl itself — user code plants child docks by
//     calling `getLeft() / getRight() / getTop() / getBottom()`, each of
//     which lazy-constructs a child DockBase on first access.
//   * Each *child* dock owns one DockedTabControl filling its client area
//     plus a Resizer on its inside edge (the edge that borders the parent
//     dock's fill area). Resizing a child shrinks/grows the parent's fill.
//   * Recursing deeper is natural: every child dock is itself a DockBase,
//     so `root.getLeft().getTop()` produces a nested panel.
//
// Drag-and-drop entry point:
//   * Accepts packages named `"TabButtonMove"` or `"TabWindowMove"`. The
//     drop location inside the target dock determines which edge (or fill)
//     receives the incoming tab(s).
//   * While hovering, a two-layer overlay renders directly via the
//     renderer (no skin region) — a faint full-rect wash plus a brighter
//     directional hover rect.
//
// Consolidation / redundancy:
//   * When a tab removal leaves a child dock empty, the parent hides it
//     (`onRedundantChildDock`).
//   * If an edge child becomes empty but siblings still hold tabs, the
//     parent "steals" from a sibling to keep the layout populated.
//
// Deviations from GWEN:
//   * Upstream's `m_bDropFar` is true when the pointer is in the outermost
//     20% of the dock (treated as a "drop behind existing children" hint).
//     Keeping the original intent, we rename it `_dropToBack` for clarity
//     and preserve the semantics: `true` → send the new child behind its
//     siblings; `false` → bring it to the front.
//   * Upstream calls `pAddTo->AddPage(TabButton*)`, the `TabControl::AddPage`
//     reparent overload. Our port doesn't currently expose that overload
//     publicly (it exists as `DockedTabControl.attachTabButton`, but
//     protected). Rather than touch sibling files, we inline the small
//     reparent routine here; it matches `DockedTabControl.attachTabButton`
//     byte-for-byte.
//   * `Render` is intentionally empty (upstream commented out the lined
//     rect too). The only visible output from a DockBase is the hover
//     overlay drawn by `renderOver` during a drag.

import { Base } from './Base';
import { DockedTabControl } from './DockedTabControl';
import { Resizer } from './Resizer';
import { TabButton } from './TabButton';
import { Pos } from '../core/Align';
import { eventInfo } from '../core/Events';
import {
  color,
  margin,
  point,
  rect,
  type DragAndDropPackage,
  type Rect,
} from '../core/Structures';
import type { Skin } from '../skin/Skin';

export class DockBase extends Base {
  protected _left: DockBase | null = null;
  protected _right: DockBase | null = null;
  protected _top: DockBase | null = null;
  protected _bottom: DockBase | null = null;
  protected _dockedTabControl: DockedTabControl | null = null;

  protected _drawHover = false;
  // Named after GWEN's `m_bDropFar`. When the pointer lands in the
  // outermost 20% of the dock's bounds, a dropped tab is pushed behind
  // its siblings rather than to the front.
  protected _dropToBack = false;
  protected _hoverRect: Rect = rect(0, 0, 0, 0);

  constructor(parent: Base | null) {
    super(parent);
    this.setPadding(margin(1, 1, 1, 1));
    this.setSize(200, 200);
    // Each docked region is its own keyboard-nav scope — Tab inside a
    // left/right/top/bottom dock cycles only within that dock, rather
    // than leaking into the sibling docks or the centre fill.
    this.setTabBoundary(true);
  }

  // =======================================================================
  // Lazy edge accessors
  // =======================================================================

  getLeft(): DockBase {
    return this.getChildDock(Pos.Left);
  }
  getRight(): DockBase {
    return this.getChildDock(Pos.Right);
  }
  getTop(): DockBase {
    return this.getChildDock(Pos.Top);
  }
  getBottom(): DockBase {
    return this.getChildDock(Pos.Bottom);
  }

  getTabControl(): DockedTabControl | null {
    return this._dockedTabControl;
  }

  protected getChildDock(pos: number): DockBase {
    let child = this.getFieldValue(pos);
    if (!child) {
      child = new DockBase(this);
      this.setFieldValue(pos, child);
      child.setupChildDock(pos);
    } else if (child.hidden()) {
      child.setHidden(false);
    }
    return child;
  }

  protected getFieldValue(pos: number): DockBase | null {
    if (pos === Pos.Left) return this._left;
    if (pos === Pos.Right) return this._right;
    if (pos === Pos.Top) return this._top;
    if (pos === Pos.Bottom) return this._bottom;
    return null;
  }

  protected setFieldValue(pos: number, dock: DockBase | null): void {
    if (pos === Pos.Left) this._left = dock;
    else if (pos === Pos.Right) this._right = dock;
    else if (pos === Pos.Top) this._top = dock;
    else if (pos === Pos.Bottom) this._bottom = dock;
  }

  // Installs this dock as a child at the given edge: gives it its own
  // DockedTabControl filling the client area plus a Resizer on its
  // inside edge. Only called once per child (on first creation).
  protected setupChildDock(pos: number): void {
    if (!this._dockedTabControl) {
      const tc = new DockedTabControl(this);
      // Strip stays at its TabControl default (Top) — DockedTabControl
      // promotes it to a title-bar-with-embedded-tabs role, so leaving
      // it on top is the modernized layout. (The original GWEN port
      // moved the strip to Bottom and floated a separate TabTitleBar
      // on Top; the current design merges those into one strip.)
      tc.onLoseTab.on(() => this.onTabRemoved());
      this._dockedTabControl = tc;
    }

    // Size the new child to roughly half the parent's relevant dimension
    // before docking. The DockBase constructor leaves us at 200×200,
    // which silently overflows when the host is smaller than 200 — e.g.
    // dropping on the top of a bottom-docked output strip that's only
    // 150px tall. recurseLayout's `bh -= child.height()` then goes
    // negative, the host's existing fill control collapses to a
    // zero/negative-height rect, and the new child's title bar / resizer
    // ends up clipped outside the host's render bounds. Halving the host
    // dimension produces a clean 50/50 split with the existing content
    // and keeps every patch's bounds inside the parent.
    const host = this.parent;
    if (host) {
      if (pos === Pos.Top || pos === Pos.Bottom) {
        const hh = host.height();
        if (hh > 0) this.setHeight(Math.max(40, Math.floor(hh * 0.5)));
      } else if (pos === Pos.Left || pos === Pos.Right) {
        const hw = host.width();
        if (hw > 0) this.setWidth(Math.max(40, Math.floor(hw * 0.5)));
      }
    }

    this.dock(pos);

    // Resizer attaches to the edge *opposite* the dock direction — that
    // edge borders the parent's fill strip, so dragging it is what
    // grows/shrinks this child against the fill.
    let resizerDir = Pos.Left;
    if (pos === Pos.Left) resizerDir = Pos.Right;
    else if (pos === Pos.Top) resizerDir = Pos.Bottom;
    else if (pos === Pos.Bottom) resizerDir = Pos.Top;

    const r = new Resizer(this);
    r.dock(resizerDir);
    r.setResizeDir(resizerDir);
    r.setTarget(this);
    r.setSize(2, 2);
  }

  // =======================================================================
  // Emptiness / consolidation
  // =======================================================================

  // A dock is empty when its own tab control has no tabs AND no visible
  // child dock holds anything. Matches GWEN's `IsEmpty` recursion.
  isEmpty(): boolean {
    if ((this._dockedTabControl?.tabCount() ?? 0) > 0) return false;
    if (this._left && !this._left.isEmpty()) return false;
    if (this._right && !this._right.isEmpty()) return false;
    if (this._top && !this._top.isEmpty()) return false;
    if (this._bottom && !this._bottom.isEmpty()) return false;
    return true;
  }

  protected onTabRemoved(): void {
    this.doRedundancyCheck();
    this.doConsolidateCheck();
  }

  protected doRedundancyCheck(): void {
    if (!this.isEmpty()) return;
    const p = this.parent;
    if (p instanceof DockBase) p.onRedundantChildDock(this);
  }

  protected onRedundantChildDock(child: DockBase): void {
    child.setHidden(true);
    this.doRedundancyCheck();
    this.doConsolidateCheck();
  }

  // Pulls tabs from the first non-empty child dock into this one when this
  // dock's own tab control is empty but a descendant still holds tabs.
  // Priority order matches GWEN: bottom, top, left, right.
  protected doConsolidateCheck(): void {
    if (this.isEmpty()) return;
    if (!this._dockedTabControl) return;
    if (this._dockedTabControl.tabCount() > 0) return;

    const candidates: (DockBase | null)[] = [this._bottom, this._top, this._left, this._right];
    for (const c of candidates) {
      if (c && !c.isEmpty() && c._dockedTabControl) {
        c._dockedTabControl.moveTabsTo(this._dockedTabControl);
        return;
      }
    }
  }

  // =======================================================================
  // Drop direction
  // =======================================================================

  // Partitions the pointer's local position into one of five targets:
  // Fill (centre 40% square), or one of Top/Left/Right/Bottom when the
  // pointer is closer to that edge. Anything beyond the outer 20%
  // ring flips `_dropToBack`.
  protected getDroppedTabDirection(x: number, y: number): number {
    const w = this.width();
    const h = this.height();
    if (w <= 0 || h <= 0) return Pos.Fill;

    const top = y / h;
    const left = x / w;
    const right = (w - x) / w;
    const bottom = (h - y) / h;
    const minimum = Math.min(top, left, right, bottom);
    this._dropToBack = minimum < 0.2;

    if (minimum > 0.3) return Pos.Fill;
    if (top === minimum && (!this._top || this._top.hidden())) return Pos.Top;
    if (left === minimum && (!this._left || this._left.hidden())) return Pos.Left;
    if (right === minimum && (!this._right || this._right.hidden())) return Pos.Right;
    if (bottom === minimum && (!this._bottom || this._bottom.hidden())) return Pos.Bottom;
    return Pos.Fill;
  }

  // =======================================================================
  // Drag-and-drop overrides
  // =======================================================================

  override dragAndDrop_CanAcceptPackage(p: DragAndDropPackage): boolean {
    return p.name === 'TabButtonMove' || p.name === 'TabWindowMove';
  }

  override dragAndDrop_HoverEnter(_p: DragAndDropPackage, _x: number, _y: number): void {
    this._drawHover = true;
  }

  override dragAndDrop_HoverLeave(_p: DragAndDropPackage): void {
    this._drawHover = false;
  }

  override dragAndDrop_Hover(_p: DragAndDropPackage, canvasX: number, canvasY: number): void {
    const local = this.canvasPosToLocal(point(canvasX, canvasY));
    const dir = this.getDroppedTabDirection(local.x, local.y);
    const w = this.width();
    const h = this.height();

    if (dir === Pos.Fill) {
      if (!this._dockedTabControl) {
        this._hoverRect = rect(0, 0, 0, 0);
        return;
      }
      // Copy — inner bounds are a live object on Base; we must not
      // mutate them when trimming for adjacent insets.
      const ib = this.getInnerBounds();
      this._hoverRect = rect(ib.x, ib.y, ib.w, ib.h);
      return;
    }

    // Start from render bounds, then narrow to a directional edge strip
    // sized as 25% of the matching axis.
    const bar = Math.floor((dir === Pos.Top || dir === Pos.Bottom ? h : w) * 0.25);
    if (dir === Pos.Left) this._hoverRect = rect(0, 0, bar, h);
    else if (dir === Pos.Right) this._hoverRect = rect(w - bar, 0, bar, h);
    else if (dir === Pos.Top) this._hoverRect = rect(0, 0, w, bar);
    else if (dir === Pos.Bottom) this._hoverRect = rect(0, h - bar, w, bar);

    // Adjacent-inset correction — when NOT drop-to-back, the hover
    // preview shows the space the new child would actually occupy,
    // which is trimmed by any existing visible child docks on the
    // perpendicular edges. Matches GWEN's `!m_bDropFar` branch.
    if (this._dropToBack) return;

    if (dir === Pos.Top || dir === Pos.Bottom) {
      if (this._left && !this._left.hidden()) {
        const lw = this._left.width();
        this._hoverRect.x += lw;
        this._hoverRect.w -= lw;
      }
      if (this._right && !this._right.hidden()) {
        this._hoverRect.w -= this._right.width();
      }
    } else {
      if (this._top && !this._top.hidden()) {
        const th = this._top.height();
        this._hoverRect.y += th;
        this._hoverRect.h -= th;
      }
      if (this._bottom && !this._bottom.hidden()) {
        this._hoverRect.h -= this._bottom.height();
      }
    }
  }

  override dragAndDrop_HandleDrop(p: DragAndDropPackage, canvasX: number, canvasY: number): boolean {
    const local = this.canvasPosToLocal(point(canvasX, canvasY));
    const dir = this.getDroppedTabDirection(local.x, local.y);

    let addTo: DockedTabControl | null;
    let dropChild: DockBase | null = null;
    if (dir === Pos.Fill) {
      if (!this._dockedTabControl) return false;
      addTo = this._dockedTabControl;
    } else {
      dropChild = this.getChildDock(dir);
      addTo = dropChild._dockedTabControl;
    }
    if (!addTo) return false;

    if (p.name === 'TabButtonMove') {
      const src = p.drawcontrol;
      if (!(src instanceof TabButton)) return false;
      this.attachTabButtonTo(addTo, src);
    } else if (p.name === 'TabWindowMove') {
      const src = p.drawcontrol;
      if (!(src instanceof DockedTabControl)) return false;
      // Same-source drop (e.g. dragging the bottom dock's title bar
      // back onto the bottom edge of root): no tabs to move, but we
      // still want to reorder so the user's "I want this dock at the
      // outer edge" intent takes effect. Skip the move; fall through
      // to the reorder step below.
      if (src !== addTo) src.moveTabsTo(addTo);
    } else {
      return false;
    }

    // Reorder the destination child so it claims layout priority.
    // recurseLayout iterates `_children` in array order and shrinks
    // the available area for each subsequent dock — front children
    // claim the full corner, later ones inherit the leftover strip.
    //
    // GWEN flips between sendToBack (prepend → high layout priority)
    // and bringToFront (append → low priority) based on `_dropToBack`,
    // which is true when the pointer was inside the outermost 20% of
    // the dock. Outer drops mean the user wants this to be the
    // OUTERMOST band — so it should claim the corner.
    //
    // Only reorder when we actually consumed an edge child (Fill drops
    // target the host's own tab control and don't reorder anything).
    if (dropChild) {
      if (this._dropToBack) dropChild.sendToBack();
      else dropChild.bringToFront();
    }

    this.invalidate();
    return true;
  }

  // Reparent a single TabButton (and its page) into the target
  // DockedTabControl. Mirrors GWEN's `TabControl::AddPage(TabButton*)`
  // overload — the logic is identical to DockedTabControl.attachTabButton
  // but that method is protected, and the task scope forbids touching
  // sibling files. Duplicated here as a tight, local helper.
  //
  // After the reparent, fire the *source* TabControl's `onLoseTab` so its
  // owning DockBase runs its redundancy/consolidation pass and hides the
  // now-empty dock. GWEN gets this for free via virtual `OnChildRemoved`;
  // we wire it explicitly here.
  protected attachTabButtonTo(target: DockedTabControl, btn: TabButton): void {
    const sourceTC = btn.getTabControl();
    const page = btn.getPage();
    const inner = target.getInnerPanel();
    if (page) {
      page.setParent(inner);
      page.setHidden(true);
      page.setMargin(margin(6, 6, 6, 6));
      page.dock(Pos.Fill);
    }
    btn.setParent(target.getTabStrip());
    btn.dock(Pos.Left);
    btn.sizeToContents();
    btn.setTabControl(target);
    btn.onPress.on(() => target.onTabPressedExt(btn));
    // Always press the incoming tab. See DockedTabControl.attachTabButton
    // for the rationale — the user's drag intent is "show this tab here",
    // and leaving it inactive (when target already had a current) hides
    // the just-dragged page until they click the tab manually.
    target.onTabPressedExt(btn);
    target.invalidate();

    if (sourceTC && sourceTC !== target && sourceTC instanceof DockedTabControl) {
      // If the source's current button was the one we just moved out,
      // its parent is now `target.getTabStrip()` — i.e. stale from
      // sourceTC's perspective. updateTitleBar (run on next layout)
      // would happily render that moved tab's title in the source's
      // title bar even though the page reparented along with the
      // button, so the source ends up showing "Output" header with no
      // content. Press a remaining tab to switch sourceTC over to a
      // live selection. If no tabs remain, the consolidation pass
      // below will hide the source entirely so a stale ref can't
      // surface.
      const sourceCur = sourceTC.getCurrentButton();
      if (sourceCur && sourceCur.parent !== sourceTC.getTabStrip()) {
        const remaining = sourceTC.getTabStrip().children
          .filter((c): c is TabButton => c instanceof TabButton);
        if (remaining.length > 0) sourceTC.onTabPressedExt(remaining[0]);
      }
      // Invalidate sourceTC explicitly. `invalidate()` only marks self
      // dirty (does not walk up), so the button's reparent only flagged
      // the old TabStrip — sourceTC itself stayed clean, its layout()
      // never re-ran, and its setHidden-on-tabCount<=1 logic never
      // fired. Without this, splitting one tab off a two-tab dock
      // leaves the source still showing a tab strip with a lone tab.
      sourceTC.invalidate();
      const info = eventInfo();
      info.controlCaller = sourceTC;
      sourceTC.onLoseTab.emit(info);
    }
  }

  // =======================================================================
  // Render
  // =======================================================================

  // Upstream's `Render` is a no-op (the only non-commented line draws
  // nothing). All visible output lives in `renderOver`.
  override render(_skin: Skin): void {
    // no-op per GWEN DockBase.cpp:63-67
  }

  override renderOver(skin: Skin): void {
    if (!this._drawHover) return;
    const renderer = skin.renderer;
    const rb = this.getRenderBounds();

    // Faint full-rect wash behind the directional rect.
    renderer.setDrawColor(color(255, 100, 255, 20));
    renderer.drawFilledRect(rb);

    if (this._hoverRect.w === 0) return;

    // Brighter directional preview + outline.
    renderer.setDrawColor(color(255, 100, 255, 100));
    renderer.drawFilledRect(this._hoverRect);
    renderer.setDrawColor(color(255, 100, 255, 200));
    renderer.drawLinedRect(this._hoverRect);
  }
}
