// Rectangle — a solid-colored quad. Ports
// `Gwen::Controls::Rectangle` from include/Gwen/Controls/Rectangle.h.
//
// Cheap and explicit: no skin interaction, no border, no hover state.
// Used as a divider, a backdrop, or a swatch inside ColorPicker.

import { Base } from './Base';
import type { Skin } from '../skin/Skin';
import { color, type Color } from '../core/Structures';

export class Rectangle extends Base {
  private _color: Color = color(255, 255, 255, 255);

  getColor(): Color {
    return this._color;
  }

  setColor(c: Color): void {
    this._color = { r: c.r, g: c.g, b: c.b, a: c.a };
    // Quirk: GWEN omits the redraw() here (Rectangle.h only sets the
    // field). The omission is a bug — Rectangles that only change color
    // never repaint until something else invalidates the frame. We
    // redraw explicitly so the TS port behaves correctly on-demand.
    this.redraw();
  }

  override render(skin: Skin): void {
    skin.renderer.setDrawColor(this._color);
    skin.renderer.drawFilledRect(this.getRenderBounds());
  }
}
