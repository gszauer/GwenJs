// ScrollBarButton — the small arrow button at each end of a ScrollBar.
// Ports `Gwen::ControlsInternal::ScrollBarButton` from
// include/Gwen/Controls/ScrollBar/ScrollBarButton.h +
// src/Controls/ScrollBar/ScrollBarButton.cpp.
//
// A direction flag (Pos.Left / Top / Right / Bottom) tells the skin
// which arrow to render; behaviour is otherwise a plain Button.

import { Button } from './Button';
import { Pos } from '../core/Align';
import type { Skin } from '../skin/Skin';
import type { Base } from './Base';

export class ScrollBarButton extends Button {
  protected _direction: number = Pos.Top;

  constructor(parent: Base | null) {
    super(parent);
  }

  setDirection(d: number): void {
    this._direction = d;
  }

  getDirection(): number {
    return this._direction;
  }

  override render(skin: Skin): void {
    skin.drawScrollButton(this, this._direction, this.isDepressed(), this.isHovered(), this.isDisabled());
  }
}
