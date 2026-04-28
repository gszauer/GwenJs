// HSVColorPicker — a composite HSV color picker. Ports
// `Gwen::Controls::HSVColorPicker` from include/Gwen/Controls/HSVColorPicker.h
// + src/Controls/HSVColorPicker.cpp.
//
// Composition (fixed layout, matches GWEN):
//   * ColorLerpBox (128×128)        — 2D saturation/value surface.
//   * ColorSlider  (32×128)         — vertical hue ribbon.
//   * ColorDisplay "after"  (48×24) — live swatch of the current selection.
//   * ColorDisplay "before" (48×24) — reference swatch of the initial color.
//   * R / G / B numeric inputs with labels.
//
// Update cycle: any interactive source (lerp box drag, slider drag, or typed
// R/G/B) produces a new Color which is pushed back into the other controls
// via `updateControls`. The `onColorChanged` signal fires on every
// user-driven change; `setColor(_, _, reset=true)` seeds the initial
// reference swatch without firing.
//
// Deviations: GWEN's SetColor parameter order is (color, onlyHue, reset);
// we keep that shape here for parity. The numeric inputs accept only
// integers (0..255) because `getFloatFromText` strips non-numeric input at
// the TextBoxNumeric layer.

import { Base } from './Base';
import { ColorLerpBox, ColorSlider } from './ColorControls';
import { ColorDisplay } from './ColorDisplay';
import { Label } from './Label';
import { TextBoxNumeric } from './TextBoxNumeric';
import { Signal, eventInfo, type EventInfo } from '../core/Events';
import { color, type Color } from '../core/Structures';

export class HSVColorPicker extends Base {
  readonly onColorChanged = new Signal<EventInfo>();

  protected _lerpBox: ColorLerpBox;
  protected _slider: ColorSlider;
  protected _before: ColorDisplay;
  protected _after: ColorDisplay;
  protected _rBox: TextBoxNumeric;
  protected _gBox: TextBoxNumeric;
  protected _bBox: TextBoxNumeric;
  protected _defaultColor: Color = color(0, 0, 0, 255);

  // Guards the text/setColor loop: writing a new R/G/B into the numeric
  // boxes via `updateControls` must not re-enter `onNumericTyped`.
  private _suspendNumeric = false;

  constructor(parent: Base | null) {
    super(parent);
    this.setSize(256, 150);

    // Inset the lerp box and slider by 3px from the picker's top-left
    // — both controls' position indicators (the 6×6 cursor square
    // and the 5×5 hue tab) extend up to 3px past their bounds. With
    // shouldClip=false on both, the overflow renders against the
    // picker's clip; the inset gives that clip just enough room so
    // an indicator at (0, 0) inside the child still falls inside
    // the picker.
    this._lerpBox = new ColorLerpBox(this);
    this._lerpBox.setPos(3, 3);
    this._lerpBox.setSize(128, 128);
    this._lerpBox.onSelectionChanged.on(() => this.onLerpBoxChanged());

    this._slider = new ColorSlider(this);
    this._slider.setPos(128 + 3 + 5, 3);
    this._slider.setSize(32, 128);
    this._slider.onSelectionChanged.on(() => this.onSliderChanged());

    // Right column: swatches (after / before) on top, R/G/B numerics
    // below. Aligned at x=173 — 5px right of the slider (matching the
    // 5px gap between the lerp box and slider on the other side).
    // R/G/B sit lower in the column so the B box's bottom edge lines
    // up with the slider's bottom edge (slider ends at y=131; B is
    // 16 tall starting at y=115). Textbox width is 48 to match the
    // swatch width above so the right column reads as one stack.
    this._after = new ColorDisplay(this);
    this._after.setPos(173, 5);
    this._after.setSize(48, 24);

    this._before = new ColorDisplay(this);
    this._before.setPos(173, 28);
    this._before.setSize(48, 24);

    this._rBox = this.makeNumeric('R', 173, 75);
    this._gBox = this.makeNumeric('G', 173, 95);
    this._bBox = this.makeNumeric('B', 173, 115);

    // Seed initial state — `reset=true` copies into the "before" swatch.
    this.setColor(color(255, 0, 0, 255), false, true);
  }

  // =======================================================================
  // Color accessors
  // =======================================================================

  getColor(): Color {
    return this._lerpBox.getSelectedColor();
  }

  getDefaultColor(): Color {
    return this._defaultColor;
  }

  /**
   * Pushes a new color into the picker.
   * @param c        the new RGBA color
   * @param onlyHue  when true, the lerp-box cursor (s, v) is left alone —
   *                 the slider drives hue only. Pass false for a full reset.
   * @param reset    copies `c` into the default/"before" swatch so the
   *                 user can compare against the pre-interaction color.
   */
  setColor(c: Color, onlyHue = true, reset = false): void {
    if (reset) {
      this._defaultColor = c;
      this._before.setColor(c);
    }
    this._slider.setColor(c);
    this._lerpBox.setColor(c, onlyHue);
    this.updateControls(c);
  }

  // =======================================================================
  // Internal handlers
  // =======================================================================

  protected onLerpBoxChanged(): void {
    const c = this._lerpBox.getSelectedColor();
    this.updateControls(c);
    const info = eventInfo();
    info.controlCaller = this;
    this.onColorChanged.emit(info);
  }

  protected onSliderChanged(): void {
    const c = this._slider.getSelectedColor();
    // Hue-only update — the lerp-box cursor position is preserved, so the
    // user's saturation/value selection survives a hue tweak.
    this._lerpBox.setColor(c, true);
  }

  protected onNumericTyped(): void {
    if (this._suspendNumeric) return;
    const r = Math.round(this._rBox.getFloatFromText());
    const g = Math.round(this._gBox.getFloatFromText());
    const b = Math.round(this._bBox.getFloatFromText());
    const c = color(
      Math.max(0, Math.min(255, r)),
      Math.max(0, Math.min(255, g)),
      Math.max(0, Math.min(255, b)),
      255,
    );
    // `onlyHue=false` snaps the lerp-box cursor to the typed s/v; reset
    // stays false because typing into R/G/B shouldn't clobber the
    // reference swatch.
    this.setColor(c, false, false);
    const info = eventInfo();
    info.controlCaller = this;
    this.onColorChanged.emit(info);
  }

  // Repaints the numeric inputs and the "after" swatch. Wrapped in a
  // suspend flag so the setText calls don't bounce back through
  // `onNumericTyped` while we're the one driving the update.
  protected updateControls(c: Color): void {
    this._after.setColor(c);
    this._suspendNumeric = true;
    this._rBox.setText(String(c.r));
    this._gBox.setText(String(c.g));
    this._bBox.setText(String(c.b));
    this._suspendNumeric = false;
  }

  // =======================================================================
  // Construction helpers
  // =======================================================================

  private makeNumeric(labelText: string, x: number, y: number): TextBoxNumeric {
    // Textbox is 48px wide — matches the swatch width above so the
    // right-side column (after / before / R / G / B) shares a clean
    // left + right edge. R/G/B label sits to the right.
    const tb = new TextBoxNumeric(this);
    tb.setPos(x, y);
    tb.setSize(48, 16);
    tb.onTextChange.on(() => this.onNumericTyped());
    const label = new Label(this);
    label.setPos(x + 52, y);
    label.setSize(20, 16);
    label.setText(labelText);
    return tb;
  }
}
