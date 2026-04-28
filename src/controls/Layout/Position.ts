// Position + Center — passive layout containers that re-position their
// non-docked children to a fixed alignment within their own inner bounds.
// Ports `Gwen::Controls::Layout::Position` (and the `Center` shim)
// from include/Gwen/Controls/Layout/Position.h.
//
// `Position` walks its children in `postLayout` and calls `child.position(pos)`
// on every child whose `dock` flag is `Pos.None`. `Center` is a tiny subclass
// that pre-sets `_position` to `Pos.Center`.

import { Base } from '../Base';
import { Pos } from '../../core/Align';
import type { Skin } from '../../skin/Skin';

export class Position extends Base {
  protected _position: number = Pos.Left | Pos.Top;

  constructor(parent: Base | null) {
    super(parent);
    this.setMouseInputEnabled(false);
  }

  setPosition(p: number): void {
    if (this._position === p) return;
    this._position = p;
    this.invalidate();
  }

  getPosition(): number {
    return this._position;
  }

  override postLayout(_skin: Skin): void {
    for (const c of this.children) {
      if (c.getDock() === Pos.None) {
        c.position(this._position);
      }
    }
  }
}

export class Center extends Position {
  constructor(parent: Base | null) {
    super(parent);
    this._position = Pos.Center;
  }
}
