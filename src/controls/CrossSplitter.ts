// CrossSplitter — a four-pane quadrant splitter with a vertical bar,
// horizontal bar, and centre "puck" that dragging all three moves as
// one. Ports `Gwen::Controls::CrossSplitter` from
// include/Gwen/Controls/CrossSplitter.h + src/Controls/CrossSplitter.cpp.
//
// Composition:
//   * Four user-supplied panels (setPanel 0..3) occupy the four quadrants
//     (TL = 0, TR = 1, BL = 2, BR = 3).
//   * Three `SplitterBar` controls:
//       - vertical axis bar (runs horizontally, splits vertically)
//       - horizontal axis bar (runs vertically, splits horizontally)
//       - centre puck (both axes)
//   * Fractional positions (`_hVal`, `_vVal`) store the split as 0..1
//     so a resize of the container preserves the ratio.
//
// Zoom: when one quadrant is zoomed, the other three are hidden and the
// zoomed panel expands to fill the whole container. The bars stay
// visible but sit on top of the zoomed panel (bringToFront inside
// layout).

import { Base } from './Base';
import { SplitterBar } from './SplitterBar';
import { Signal, eventInfo, type EventInfo } from '../core/Events';
import { CursorType } from '../core/Structures';
import type { Skin } from '../skin/Skin';

export class CrossSplitter extends Base {
  readonly onZoomChange = new Signal<EventInfo>();
  readonly onZoomed = new Signal<EventInfo>();
  readonly onUnZoomed = new Signal<EventInfo>();

  protected _vSplitter: SplitterBar;
  protected _hSplitter: SplitterBar;
  protected _cSplitter: SplitterBar;
  protected _panels: (Base | null)[] = [null, null, null, null];
  protected _barSize = 5;
  protected _hVal = 0.5;
  protected _vVal = 0.5;
  protected _zoomedSection = -1;

  constructor(parent: Base | null) {
    super(parent);

    this._vSplitter = new SplitterBar(this);
    this._vSplitter.setCursor(CursorType.SizeNS);
    this._vSplitter.onDragged.on(() => this.calcV());

    this._hSplitter = new SplitterBar(this);
    this._hSplitter.setCursor(CursorType.SizeWE);
    this._hSplitter.onDragged.on(() => this.calcH());

    this._cSplitter = new SplitterBar(this);
    this._cSplitter.setCursor(CursorType.SizeAll);
    this._cSplitter.onDragged.on(() => this.calcC());
  }

  // =====================================================================
  // Panel wiring
  // =====================================================================

  setPanel(i: number, p: Base | null): void {
    if (i < 0 || i > 3) return;
    if (p) p.setParent(this);
    this._panels[i] = p;
    this.invalidate();
  }

  getPanel(i: number): Base | null {
    if (i < 0 || i > 3) return null;
    return this._panels[i];
  }

  setSplitterSize(size: number): void {
    this._barSize = size;
    this.invalidate();
  }

  centerPanels(): void {
    this._hVal = 0.5;
    this._vVal = 0.5;
    this.invalidate();
  }

  // =====================================================================
  // Zoom state
  // =====================================================================

  isZoomed(): boolean {
    return this._zoomedSection !== -1;
  }

  zoom(section: number): void {
    this.unZoom();
    if (section < 0 || section > 3) return;
    this._zoomedSection = section;
    for (let i = 0; i < 4; i++) {
      const p = this._panels[i];
      if (p && i !== section) p.hide();
    }
    const info = eventInfo();
    info.controlCaller = this;
    this.onZoomed.emit(info);
    this.onZoomChange.emit(info);
    this.invalidate();
  }

  unZoom(): void {
    if (this._zoomedSection === -1) return;
    this._zoomedSection = -1;
    for (const p of this._panels) {
      if (p) p.show();
    }
    const info = eventInfo();
    info.controlCaller = this;
    this.onUnZoomed.emit(info);
    this.onZoomChange.emit(info);
    this.invalidate();
  }

  // =====================================================================
  // Drag callbacks — rewrite the fractional position from the bar's
  // current pixel offset, then invalidate so `layout` runs next tick.
  // =====================================================================

  protected calcV(): void {
    const h = this.height() - this._barSize;
    this._vVal = h > 0 ? this._vSplitter.y() / h : 0.5;
    this.calcAll();
  }

  protected calcH(): void {
    const w = this.width() - this._barSize;
    this._hVal = w > 0 ? this._hSplitter.x() / w : 0.5;
    this.calcAll();
  }

  protected calcC(): void {
    const w = this.width() - this._barSize;
    const h = this.height() - this._barSize;
    this._hVal = w > 0 ? this._cSplitter.x() / w : 0.5;
    this._vVal = h > 0 ? this._cSplitter.y() / h : 0.5;
    this.calcAll();
  }

  protected calcAll(): void {
    this.invalidate();
  }

  // =====================================================================
  // Layout
  // =====================================================================

  override layout(_skin: Skin): void {
    // Zoomed: one quadrant fills the container; bars collapse to zero
    // area but remain draggable targets after un-zoom. We skip the full
    // layout rather than trying to tuck the other panels away.
    if (this._zoomedSection !== -1) {
      const zp = this._panels[this._zoomedSection];
      if (zp) zp.setBounds(0, 0, this.width(), this.height());
      return;
    }

    const W = this.width();
    const H = this.height();
    const b = this._barSize;
    const hX = Math.floor((W - b) * this._hVal);
    const vY = Math.floor((H - b) * this._vVal);

    this._vSplitter.setBounds(0, vY, W, b);
    this._hSplitter.setBounds(hX, 0, b, H);
    this._cSplitter.setBounds(hX, vY, b, b);

    const p0 = this._panels[0];
    if (p0) p0.setBounds(0, 0, hX, vY);
    const p1 = this._panels[1];
    if (p1) p1.setBounds(hX + b, 0, W - hX - b, vY);
    const p2 = this._panels[2];
    if (p2) p2.setBounds(0, vY + b, hX, H - vY - b);
    const p3 = this._panels[3];
    if (p3) p3.setBounds(hX + b, vY + b, W - hX - b, H - vY - b);

    // Keep the drag handles above the panel content so pointer hits land
    // on the bars rather than on a panel when the cursor is on the seam.
    this._vSplitter.bringToFront();
    this._hSplitter.bringToFront();
    this._cSplitter.bringToFront();
  }
}
