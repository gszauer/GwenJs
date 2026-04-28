// ScrollBarBar — the draggable thumb inside a ScrollBar's track. Ports
// `Gwen::ControlsInternal::ScrollBarBar` from
// include/Gwen/Controls/ScrollBar/ScrollBarBar.h +
// src/Controls/ScrollBar/ScrollBarBar.cpp.
//
// Mirrors the SliderBar pattern — the bar targets itself so drag motion
// is applied directly to its own bounds. `moveTo` is overridden to clamp
// the thumb to the track area (between the up/down or left/right scroll
// buttons), since the inherited `restrictToParent` clamp uses the full
// scrollbar bounds and would otherwise let the thumb slide under the
// buttons. The owning ScrollBar recomputes `scrolledAmount` from the
// bar's position via its `onDragged` listener.

import { Dragger } from './Dragger';
import type { Skin } from '../skin/Skin';
import type { Base } from './Base';

export class ScrollBarBar extends Dragger {
  protected _horizontal = true;

  constructor(parent: Base | null) {
    super(parent);
    this.setTarget(this);
    this.setRestrictToParent(true);
  }

  setHorizontal(b: boolean): void {
    this._horizontal = b;
  }

  isHorizontal(): boolean {
    return this._horizontal;
  }

  // Track area excludes the parent ScrollBar's two scroll buttons. For a
  // vertical bar the buttons are square w×w sitting at the top and
  // bottom; for a horizontal bar they're h×h at the left and right.
  override moveTo(x: number, y: number): void {
    const parent = this.parent;
    if (!parent) {
      super.moveTo(x, y);
      return;
    }
    if (this._horizontal) {
      const bs = parent.height();
      const minX = bs;
      const maxX = parent.width() - bs - this.width();
      if (x < minX) x = minX;
      if (x > maxX) x = maxX;
      // Lock cross-axis: the bar fills the strip thickness.
      super.moveTo(x, this.y());
    } else {
      const bs = parent.width();
      const minY = bs;
      const maxY = parent.height() - bs - this.height();
      if (y < minY) y = minY;
      if (y > maxY) y = maxY;
      super.moveTo(this.x(), y);
    }
  }

  override render(skin: Skin): void {
    skin.drawScrollBarBar(this, this._depressed, this.isHovered(), this._horizontal);
  }
}
