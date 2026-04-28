// ColorDisplay — a passive swatch that paints a single color with an
// optional checkerboard behind translucent alpha. Ports
// `Gwen::Controls::ColorDisplay` from include/Gwen/Controls/ColorControls.h
// + src/Controls/ColorControls.cpp.
//
// The `drawCheckers` toggle is stored locally but the current
// `Skin.drawColorDisplay` always paints the 2x2 checker when `a !== 255`
// (see Skin.ts); the flag is retained for API parity and future use.

import { Base } from './Base';
import { color, type Color } from '../core/Structures';
import type { Skin } from '../skin/Skin';

export class ColorDisplay extends Base {
  protected _color: Color = color(255, 255, 255, 255);
  protected _drawCheckers = true;

  constructor(parent: Base | null) {
    super(parent);
    this.setSize(32, 32);
    this.setMouseInputEnabled(false);
  }

  // =======================================================================
  // Color
  // =======================================================================

  setColor(c: Color): void {
    this._color = c;
    this.redraw();
  }

  getColor(): Color {
    return this._color;
  }

  // Per-channel setters — mirror GWEN's SetRed/SetGreen/SetBlue/SetAlpha.
  // All four go through `color()` so callers that pass out-of-range
  // values get clamped instead of corrupting the swatch.
  setRed(v: number): void {
    this._color = color(v, this._color.g, this._color.b, this._color.a);
    this.redraw();
  }

  setGreen(v: number): void {
    this._color = color(this._color.r, v, this._color.b, this._color.a);
    this.redraw();
  }

  setBlue(v: number): void {
    this._color = color(this._color.r, this._color.g, v, this._color.a);
    this.redraw();
  }

  setAlpha(v: number): void {
    this._color = color(this._color.r, this._color.g, this._color.b, v);
    this.redraw();
  }

  setDrawCheckers(b: boolean): void {
    this._drawCheckers = b;
    this.redraw();
  }

  getDrawCheckers(): boolean {
    return this._drawCheckers;
  }

  // =======================================================================
  // Render
  // =======================================================================

  override render(skin: Skin): void {
    skin.drawColorDisplay(this, this._color);
  }
}
