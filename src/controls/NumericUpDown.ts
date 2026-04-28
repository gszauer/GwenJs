// NumericUpDown — TextBoxNumeric + docked up/down buttons that step a
// clamped integer value. Ports `Gwen::Controls::NumericUpDown` from
// include/Gwen/Controls/NumericUpDown.h + src/Controls/NumericUpDown.cpp.
//
// Composition:
//   NumericUpDown extends TextBoxNumeric so typing still produces a
//   valid numeric literal. A right-docked 13px splitter holds a pair of
//   internal buttons (Up top half, Down fill) which render via
//   `skin.drawNumericUpDownButton`.
//
// Value vs text:
//   `_value` is the authoritative integer. `setText` still runs through
//   TextBox and normal typing updates the display, but the `onTextChange`
//   handler re-reads the text and syncs `_value` if the typed value is
//   within [min, max] — typing outside the range leaves `_value` alone
//   (matching GWEN, which simply ignores out-of-bounds edits rather than
//   forcing a revert). The buttons and arrow keys always go through
//   `setValue` so they stay clamped.

import { TextBoxNumeric } from './TextBoxNumeric';
import { Button } from './Button';
import { Base } from './Base';
import { Pos } from '../core/Align';
import { Signal, eventInfo, type EventInfo } from '../core/Events';
import type { Skin } from '../skin/Skin';

// =======================================================================
// Internal button classes — private to this module.
// =======================================================================

class NumericUpDownButton_Up extends Button {
  constructor(parent: Base | null) {
    super(parent);
    this.setTabable(false);
  }

  override render(skin: Skin): void {
    skin.drawNumericUpDownButton(this, this.isDepressed(), true);
  }
}

class NumericUpDownButton_Down extends Button {
  constructor(parent: Base | null) {
    super(parent);
    this.setTabable(false);
  }

  override render(skin: Skin): void {
    skin.drawNumericUpDownButton(this, this.isDepressed(), false);
  }
}

// =======================================================================
// NumericUpDown
// =======================================================================

export class NumericUpDown extends TextBoxNumeric {
  readonly onChange = new Signal<EventInfo>();

  protected _min = 0;
  protected _max = 100;
  protected _value = 0;

  protected _upButton: NumericUpDownButton_Up;
  protected _downButton: NumericUpDownButton_Down;

  constructor(parent: Base | null) {
    super(parent);
    this.setSize(100, 20);

    // Right-docked 13px splitter hosts the two stacked buttons. Matching
    // GWEN's layout (NumericUpDown.cpp:16).
    const splitter = new Base(this);
    splitter.dock(Pos.Right);
    splitter.setWidth(13);

    this._upButton = new NumericUpDownButton_Up(splitter);
    this._upButton.dock(Pos.Top);
    this._upButton.setHeight(10);
    this._upButton.onPress.on(() => this.onPressUp());

    this._downButton = new NumericUpDownButton_Down(splitter);
    this._downButton.dock(Pos.Fill);
    this._downButton.onPress.on(() => this.onPressDown());

    this.setText('0');
    this.onTextChange.on(() => this.syncFromText());
  }

  // ---------------------------------------------------------------------
  // Min / max
  // ---------------------------------------------------------------------

  setMin(v: number): void {
    this._min = v;
  }

  setMax(v: number): void {
    this._max = v;
  }

  getMin(): number {
    return this._min;
  }

  getMax(): number {
    return this._max;
  }

  // ---------------------------------------------------------------------
  // Value
  //
  // Naming note: Label exposes `setValue(s: string)` / `getValue(): string`
  // as a generic string carrier for Property controls. TypeScript won't
  // let a subclass override those with an incompatible numeric signature
  // (C++ allows it via overload-on-parameter-type, TS does not), so the
  // numeric API lives under `setIntValue` / `getIntValue`. The inherited
  // string `getValue` / `setValue` remain functional and operate on the
  // numeric text representation.
  // ---------------------------------------------------------------------

  setIntValue(v: number): void {
    const clamped = Math.max(this._min, Math.min(this._max, Math.floor(v)));
    if (clamped === this._value) return;
    this._value = clamped;
    this.setText(String(clamped));
    this.emitChange();
  }

  getIntValue(): number {
    return this._value;
  }

  // ---------------------------------------------------------------------
  // Key / button actions
  // ---------------------------------------------------------------------

  override onKeyUp(down: boolean): boolean {
    if (down) this.setIntValue(this._value + 1);
    return true;
  }

  override onKeyDown(down: boolean): boolean {
    if (down) this.setIntValue(this._value - 1);
    return true;
  }

  private onPressUp(): void {
    this.setIntValue(this._value + 1);
  }

  private onPressDown(): void {
    this.setIntValue(this._value - 1);
  }

  // ---------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------

  /**
   * Fired whenever the inherited TextBox text changes — including our
   * own `setText` during `setValue`. We re-read the numeric value and
   * only update `_value` if the parsed integer is within [min, max].
   * Typing an out-of-range value leaves `_value` unchanged (the text
   * is not forcibly reverted, matching GWEN behaviour).
   */
  private syncFromText(): void {
    const n = Math.floor(this.getFloatFromText());
    if (isNaN(n)) return;
    if (n < this._min || n > this._max) return;
    if (n === this._value) return;
    this._value = n;
    this.emitChange();
  }

  private emitChange(): void {
    const info = eventInfo();
    info.controlCaller = this;
    this.onChange.emit(info);
  }
}
