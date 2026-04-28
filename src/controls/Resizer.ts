// Resizer — an edge/corner handle that grows and shrinks a target
// control. Ports `Gwen::ControlsInternal::Resizer` from
// include/Gwen/Controls/Resizer.h + src/Controls/Resizer.cpp.
//
// Resizer composes Dragger for the press-and-move capture; it then
// translates pointer deltas into target bounds changes depending on
// which edge(s) were grabbed.
//
// Simplification vs GWEN: the upstream implementation computes the
// target's new rect by walking canvas-space coordinates and subtracting
// the captured hold offset. That algorithm cancels out the hold offset
// on every frame, so we collapse it to the straightforward dx/dy delta
// the Canvas already gives us via `onMouseMoved(_, _, dx, dy)`. The
// minimum-size clamp ensures a pathological drag can't invert the rect.

import { Dragger } from './Dragger';
import { Signal, eventInfo, type EventInfo } from '../core/Events';
import { Pos } from '../core/Align';
import { CursorType } from '../core/Structures';
import type { Base } from './Base';

export class Resizer extends Dragger {
  readonly onResize = new Signal<EventInfo>();
  protected _resizeDir: number = Pos.Left;

  constructor(parent: Base | null) {
    super(parent);
    this.setResizeDir(Pos.Left);
    this.setSize(6, 6);
  }

  // =====================================================================
  // Direction — sets which edge(s)/corner this handle grabs, and picks
  // the matching cursor.
  // =====================================================================

  setResizeDir(dir: number): void {
    this._resizeDir = dir;
    // Corners first — mixed Left/Top or Right/Bottom means a NW-SE diagonal,
    // while Right/Top or Left/Bottom is NE-SW.
    if ((dir & Pos.Left) && (dir & Pos.Top)) {
      this.setCursor(CursorType.SizeNWSE);
      return;
    }
    if ((dir & Pos.Right) && (dir & Pos.Bottom)) {
      this.setCursor(CursorType.SizeNWSE);
      return;
    }
    if ((dir & Pos.Right) && (dir & Pos.Top)) {
      this.setCursor(CursorType.SizeNESW);
      return;
    }
    if ((dir & Pos.Left) && (dir & Pos.Bottom)) {
      this.setCursor(CursorType.SizeNESW);
      return;
    }
    if (dir & (Pos.Left | Pos.Right)) {
      this.setCursor(CursorType.SizeWE);
      return;
    }
    if (dir & (Pos.Top | Pos.Bottom)) {
      this.setCursor(CursorType.SizeNS);
      return;
    }
  }

  getResizeDir(): number {
    return this._resizeDir;
  }

  // =====================================================================
  // Drag → resize
  // =====================================================================

  override onMouseMoved(_x: number, _y: number, dx: number, dy: number): void {
    if (this.isDisabled()) return;
    if (!this._depressed) return;
    const t = this._target;
    if (!t) return;

    const b = t.getBounds();
    const min = t.getMinimumSize();
    let nx = b.x;
    let ny = b.y;
    let nw = b.w;
    let nh = b.h;

    if (this._resizeDir & Pos.Left) {
      const newW = Math.max(min.x, nw - dx);
      // Keep the right edge anchored: shift x by the actual delta absorbed.
      nx = b.x + (b.w - newW);
      nw = newW;
    } else if (this._resizeDir & Pos.Right) {
      nw = Math.max(min.x, nw + dx);
    }

    if (this._resizeDir & Pos.Top) {
      const newH = Math.max(min.y, nh - dy);
      ny = b.y + (b.h - newH);
      nh = newH;
    } else if (this._resizeDir & Pos.Bottom) {
      nh = Math.max(min.y, nh + dy);
    }

    t.setBounds(nx, ny, nw, nh);

    const info = eventInfo();
    info.controlCaller = this;
    this.onResize.emit(info);
  }
}
