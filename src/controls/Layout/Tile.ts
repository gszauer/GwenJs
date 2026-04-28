// Tile — flow-layout container that arranges its non-docked children into
// a left-to-right, top-to-bottom grid of fixed-size cells. Children are
// centred inside each cell (rather than top-left aligned) so mixed-size
// items still look tidy.
//
// Ports `Gwen::Controls::Layout::Tile` from include/Gwen/Controls/Layout/Tile.h.

import { Base } from '../Base';
import { Pos } from '../../core/Align';
import { point, type Point } from '../../core/Structures';
import type { Skin } from '../../skin/Skin';

export class Tile extends Base {
  protected _tileSize: Point = point(22, 22);

  constructor(parent: Base | null) {
    super(parent);
    this.dock(Pos.Fill);
  }

  setTileSize(w: number, h: number): void {
    this._tileSize = point(w, h);
    this.invalidate();
  }

  getTileSize(): Point {
    return this._tileSize;
  }

  override layout(skin: Skin): void {
    super.layout(skin);
    // NOTE: getInnerBounds() is not populated until AFTER the docking pass in
    // Base.recurseLayout, so it's (0,0,0,0) during layout(). Compute the
    // available flow area from renderBounds minus padding — same formula the
    // docking pass uses to derive inner bounds.
    const pad = this.getPadding();
    const rb = this.getRenderBounds();
    const x0 = rb.x + pad.left;
    const y0 = rb.y + pad.top;
    const innerW = rb.w - pad.left - pad.right;
    let x = x0;
    let y = y0;
    for (const c of this.children) {
      if (c.getDock() !== Pos.None) continue;
      if (c.hidden()) continue;
      const cellX = x + Math.floor((this._tileSize.x - c.width()) / 2);
      const cellY = y + Math.floor((this._tileSize.y - c.height()) / 2);
      c.setPos(cellX, cellY);
      x += this._tileSize.x;
      if (x + this._tileSize.x > x0 + innerW) {
        x = x0;
        y += this._tileSize.y;
      }
    }
  }
}
