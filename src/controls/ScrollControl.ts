// ScrollControl — a scrolling viewport that wraps an inner panel and two
// scroll bars. Ports `Gwen::Controls::ScrollControl` from
// include/Gwen/Controls/ScrollControl.h + src/Controls/ScrollControl.cpp.
//
// Composition:
//   * VerticalScrollBar   — docked Right, 15px wide.
//   * HorizontalScrollBar — docked Bottom, 15px tall.
//   * innerPanel (Base)   — carries the user's content. Installed via
//     `setInnerPanel()` so `addChild()` on the ScrollControl routes here
//     automatically (matching GWEN's `m_InnerPanel` behaviour).
//
// Deviations from GWEN:
//   * GWEN's `ContentsAreDocked` shortcut (auto-hides bars and fills inner
//     to outer size when every child is docked) is intentionally omitted;
//     GWork dropped it for the same reason — it hid subtle layout bugs
//     and user-facing code rarely needs it.
//   * GWEN's `SetHScrollRequired` / `SetVScrollRequired` path has a
//     known C++ bug (HScrollRequired leaves the bar disabled even when
//     `req == false`). We compute visibility directly from content/view
//     ratios in `updateScrollBars` instead, sidestepping the bug.
//   * GWEN uses `OnChildBoundsChanged` to retrigger scroll-bar updates
//     whenever a descendant resizes; in TS the simpler `layout()` hook
//     is sufficient because `invalidate()` bubbles through the inner
//     panel's children via Base's normal invalidation path.
//   * Inner panel offset is computed as `-scrolledAmount * overflow`
//     (overflow = max(0, content - view)). GWEN's formula factors in
//     the opposite bar's width; we subsume that by using the already-
//     reduced `viewW` / `viewH` when computing overflow.

import { Base } from './Base';
import { HorizontalScrollBar, VerticalScrollBar } from './ScrollBar';
import { Pos } from '../core/Align';
import { margin } from '../core/Structures';
import type { Skin } from '../skin/Skin';

export class ScrollControl extends Base {
  protected _vBar: VerticalScrollBar;
  protected _hBar: HorizontalScrollBar;
  protected _canScrollH = true;
  protected _canScrollV = true;
  protected _autoHideBars = false;

  constructor(parent: Base | null) {
    super(parent);
    this.setMouseInputEnabled(false);

    this._vBar = new VerticalScrollBar(this);
    this._vBar.dock(Pos.Right);
    this._vBar.setWidth(15);
    this._vBar.onBarMoved.on(() => this.invalidate());

    this._hBar = new HorizontalScrollBar(this);
    this._hBar.dock(Pos.Bottom);
    this._hBar.setHeight(15);
    this._hBar.onBarMoved.on(() => this.invalidate());

    // Inner panel carries user content. Installing it via setInnerPanel
    // makes subsequent `addChild()` on the ScrollControl route here —
    // user code stays oblivious to the extra wrapper.
    const inner = new Base(this);
    inner.setMargin(margin(5, 5, 5, 5));
    inner.setMouseInputEnabled(true);
    // SendToBack so the inner panel renders FIRST (behind the bars).
    // recurseLayout iterates children in array order — without this
    // the inner panel ends up at the end of _children (added after
    // both bars) and renders LAST, painting over the right / bottom
    // scrollbar gutters when content extends into them. Matches
    // GWEN ScrollControl.cpp:34.
    inner.sendToBack();
    this.setInnerPanel(inner);
  }

  // =====================================================================
  // Config
  // =====================================================================

  setScroll(h: boolean, v: boolean): void {
    this._canScrollH = h;
    this._canScrollV = v;
    this.invalidate();
  }

  canScrollH(): boolean {
    return this._canScrollH;
  }

  canScrollV(): boolean {
    return this._canScrollV;
  }

  setAutoHideBars(b: boolean): void {
    this._autoHideBars = b;
  }

  getVerticalScrollBar(): VerticalScrollBar {
    return this._vBar;
  }

  getHorizontalScrollBar(): HorizontalScrollBar {
    return this._hBar;
  }

  // =====================================================================
  // Scroll-to-edge helpers
  // =====================================================================

  scrollToTop(): void {
    this._vBar.setScrolledAmount(0, true);
  }

  scrollToBottom(): void {
    this._vBar.setScrolledAmount(1, true);
  }

  scrollToLeft(): void {
    this._hBar.setScrolledAmount(0, true);
  }

  scrollToRight(): void {
    this._hBar.setScrolledAmount(1, true);
  }

  clear(): void {
    const inner = this.getInnerPanel();
    if (inner) inner.removeAllChildren();
    this.invalidate();
  }

  // =====================================================================
  // Scroll-bar update pipeline
  //
  // Called from `layout()` each time the tree re-lays out. We compute
  // content extents from the inner panel's children, feed the bars, and
  // apply the resulting fractional scroll offset back to the inner panel.
  // =====================================================================

  updateScrollBars(): void {
    const inner = this.getInnerPanel();
    if (!inner) return;

    // Content size — the maximum right/bottom edge of any visible child.
    let contentW = 0;
    let contentH = 0;
    for (const c of inner.children) {
      if (!c.isVisible()) continue;
      const r = c.x() + c.width();
      const b = c.y() + c.height();
      if (r > contentW) contentW = r;
      if (b > contentH) contentH = b;
    }

    const pad = this.getPadding();
    const baseW = this.width() - pad.left - pad.right;
    const baseH = this.height() - pad.top - pad.bottom;

    // Decide bar visibility + viewport in lockstep. When auto-hide is on,
    // a bar that's hidden because its content fits should NOT reserve its
    // 15px strip — otherwise menus / lists with content that fits show a
    // dead gutter on the right edge. Iterate to a fixed point (max 2
    // passes) since hiding the V bar can free width and vice versa.
    let vHidden = !this._canScrollV;
    let hHidden = !this._canScrollH;
    let viewW = baseW - (vHidden ? 0 : this._vBar.width());
    let viewH = baseH - (hHidden ? 0 : this._hBar.height());
    for (let pass = 0; pass < 2; pass++) {
      const nextVHidden = !this._canScrollV || (this._autoHideBars && contentH <= viewH);
      const nextHHidden = !this._canScrollH || (this._autoHideBars && contentW <= viewW);
      if (nextVHidden === vHidden && nextHHidden === hHidden) break;
      vHidden = nextVHidden;
      hHidden = nextHHidden;
      viewW = baseW - (vHidden ? 0 : this._vBar.width());
      viewH = baseH - (hHidden ? 0 : this._hBar.height());
    }
    this._vBar.setHidden(vHidden);
    this._hBar.setHidden(hHidden);

    this._vBar.setContentSize(Math.max(contentH, viewH));
    this._vBar.setViewableContentSize(viewH);
    this._hBar.setContentSize(Math.max(contentW, viewW));
    this._hBar.setViewableContentSize(viewW);

    // Panel is always viewport-sized on the axis we DON'T scroll on —
    // otherwise a dock-Top child reports a wide initial size and the panel
    // grows to match, pushing content off-screen with no way to reach it
    // (since we aren't scrolling that axis). On the scroll-enabled axis we
    // grow to fit content so scrolling can reveal everything.
    const panelW = this._canScrollH ? Math.max(viewW, contentW) : viewW;
    const panelH = this._canScrollV ? Math.max(viewH, contentH) : viewH;
    const overflowH = Math.max(0, contentH - viewH);
    const overflowW = Math.max(0, contentW - viewW);
    inner.setBounds(
      pad.left + (this._canScrollH ? -this._hBar.getScrolledAmount() * overflowW : 0),
      pad.top + (this._canScrollV ? -this._vBar.getScrolledAmount() * overflowH : 0),
      panelW,
      panelH,
    );
  }

  // =====================================================================
  // Overrides
  // =====================================================================

  override layout(skin: Skin): void {
    super.layout(skin);
    this.updateScrollBars();
  }

  // postLayout runs AFTER children have laid out, so contentH/contentW
  // reflect the children's settled bounds. Re-evaluate the bars here too —
  // on the first frame, layout() sees stale child sizes (e.g. a
  // CollapsibleCategory's height is 22 until its own postLayout fits it
  // to its rows). If visibility flips here, invalidate so the next layout
  // pass re-docks children at the corrected viewport width.
  override postLayout(skin: Skin): void {
    super.postLayout(skin);
    const beforeV = this._vBar.hidden();
    const beforeH = this._hBar.hidden();
    this.updateScrollBars();
    if (this._vBar.hidden() !== beforeV || this._hBar.hidden() !== beforeH) {
      this.invalidate();
    }
  }

  override onMouseWheeled(delta: number): boolean {
    if (this._canScrollV && !this._vBar.hidden()) {
      if (
        this._vBar.setScrolledAmount(
          this._vBar.getScrolledAmount() - this._vBar.getNudgeAmount() * (delta / 60),
          true,
        )
      ) {
        return true;
      }
    }
    if (this._canScrollH && !this._hBar.hidden()) {
      if (
        this._hBar.setScrolledAmount(
          this._hBar.getScrolledAmount() - this._hBar.getNudgeAmount() * (delta / 60),
          true,
        )
      ) {
        return true;
      }
    }
    return super.onMouseWheeled(delta);
  }
}
