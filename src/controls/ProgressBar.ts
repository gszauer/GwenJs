// ProgressBar — horizontal or vertical fill-to-a-fraction control.
// Ports `Gwen::Controls::ProgressBar` from
// include/Gwen/Controls/ProgressBar.h + src/Controls/ProgressBar.cpp.
//
// The bar itself is rendered by `skin.drawProgressBar` (two bordered
// blits, front + back, clipped by the current progress). The Label
// superclass handles the centred "42%" readout; `autoLabel` toggles
// whether the readout is updated automatically on every setProgress.
//
// A non-zero `cycleSpeed` makes the bar animate in `think()` — useful
// for indeterminate activity indicators. Because this control predates
// the frame-dt plumbing, we use a fixed ~16.6 ms step per tick; the
// T603 perf pass can swap that out for real delta-time once the Canvas
// exposes one.

import { Base } from './Base';
import { Label } from './Label';
import { Pos } from '../core/Align';
import { margin } from '../core/Structures';
import type { Skin } from '../skin/Skin';

export class ProgressBar extends Label {
  protected _progress = 0;
  protected _horizontal = true;
  protected _autoLabel = true;
  protected _cycleSpeed = 0;

  constructor(parent: Base | null) {
    super(parent);
    this.setMouseInputEnabled(true);
    this.setSize(128, 32);
    this.setTextPadding(margin(3, 0, 3, 0));
    this.setAlignment(Pos.Center);
    this.setText('0%');
  }

  // =====================================================================
  // Progress
  // =====================================================================

  setProgress(f: number): void {
    const clamped = f < 0 ? 0 : f > 1 ? 1 : f;
    if (clamped === this._progress) return;
    this._progress = clamped;
    if (this._autoLabel) this.setText(`${Math.floor(clamped * 100)}%`);
    this.redraw();
  }

  getProgress(): number {
    return this._progress;
  }

  // GWEN aliases setProgress as setValueFloat for use as a numeric value
  // carrier; the inherited Label.setValue(string) still works for text.
  setValueFloat(v: number): void {
    this.setProgress(v);
  }

  getValueFloat(): number {
    return this._progress;
  }

  // =====================================================================
  // Orientation
  // =====================================================================

  setVertical(): void {
    if (!this._horizontal) return;
    this._horizontal = false;
    this.redraw();
  }

  setHorizontal(): void {
    if (this._horizontal) return;
    this._horizontal = true;
    this.redraw();
  }

  isHorizontal(): boolean {
    return this._horizontal;
  }

  // =====================================================================
  // Auto label + cycle
  // =====================================================================

  setAutoLabel(b: boolean): void {
    this._autoLabel = b;
  }

  getAutoLabel(): boolean {
    return this._autoLabel;
  }

  setCycleSpeed(f: number): void {
    this._cycleSpeed = f;
  }

  getCycleSpeed(): number {
    return this._cycleSpeed;
  }

  // =====================================================================
  // Think — animates cycle mode. Fixed-step until T603 wires real dt.
  // =====================================================================

  override think(): void {
    super.think();
    if (this._cycleSpeed === 0) return;
    let p = this._progress + this._cycleSpeed * (1 / 60);
    while (p > 1) p -= 1;
    while (p < 0) p += 1;
    this.setProgress(p);
  }

  // =====================================================================
  // Render
  // =====================================================================

  override render(skin: Skin): void {
    skin.drawProgressBar(this, this._horizontal, this._progress);
  }
}
