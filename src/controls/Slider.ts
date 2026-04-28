// Slider + SliderBar + HorizontalSlider + VerticalSlider. Ports
// `Gwen::Controls::Slider`, `Gwen::ControlsInternal::SliderBar`,
// `Gwen::Controls::HorizontalSlider`, and `Gwen::Controls::VerticalSlider`
// from include/Gwen/Controls/Slider.h + src/Controls/Slider.cpp +
// include/Gwen/Controls/HorizontalSlider.h +
// include/Gwen/Controls/VerticalSlider.h.
//
// The four classes are tightly coupled (SliderBar is the thumb Slider
// owns; the two orientation subclasses differ only in axis handling),
// so they share one file.
//
// Differences from GWEN:
//   * We keep `_value` in the 0..1 normalized range internally to
//     avoid repeated (max-min) multiplies; `getFloatValue()` returns
//     the caller's scaled value, `setFloatValue()` accepts it.
//   * Click-through on the track is implemented by manually driving
//     the internal SliderBar's onMouseClickLeft so the bar grabs
//     `canvas.mouseFocus` for us — GWEN does the same via its
//     `m_SliderBar->OnMouseClickLeft(...)` call.
//   * Home / End are mapped to min / max; arrow keys step by 1 unit
//     of the caller's scaled range, not of the 0..1 normalized range,
//     matching GWEN's `Key_Left`/`Key_Right` handling.

import { Base } from './Base';
import { Dragger } from './Dragger';
import { Signal, eventInfo, type EventInfo } from '../core/Events';
import { point, rect } from '../core/Structures';
import type { Skin } from '../skin/Skin';

// ---------------------------------------------------------------------------
// SliderBar — the draggable thumb inside a Slider's track.
// ---------------------------------------------------------------------------

export class SliderBar extends Dragger {
  protected _horizontal = true;

  constructor(parent: Base | null) {
    super(parent);
    // The bar moves itself (GWEN: `SetTarget(this)`). restrictToParent
    // keeps the bar clamped inside the Slider when dragged past the
    // track edges.
    this.setTarget(this);
    this.setRestrictToParent(true);
  }

  setHorizontal(b: boolean): void {
    this._horizontal = b;
  }

  isHorizontal(): boolean {
    return this._horizontal;
  }

  override render(skin: Skin): void {
    skin.drawSlideButton(this, this._depressed, this._horizontal);
  }
}

// ---------------------------------------------------------------------------
// Slider — abstract base for horizontal / vertical variants.
// ---------------------------------------------------------------------------

export abstract class Slider extends Base {
  readonly onValueChanged = new Signal<EventInfo>();

  protected _bar: SliderBar;
  protected _min = 0;
  protected _max = 1;
  // Normalized 0..1 position of the bar along the track.
  protected _value = 0;
  protected _numNotches = 5;
  protected _clampToNotches = false;

  constructor(parent: Base | null) {
    super(parent);
    this.setBounds(0, 0, 32, 128);
    this._bar = new SliderBar(this);
    this._bar.onDragged.on(() => this.onMoved());
    this.setTabable(true);
    this.setKeyboardInputEnabled(true);
  }

  // =====================================================================
  // Range + value
  // =====================================================================

  setRange(min: number, max: number): void {
    this._min = min;
    this._max = max;
  }

  getMin(): number {
    return this._min;
  }

  getMax(): number {
    return this._max;
  }

  setFloatValue(v: number, forceUpdate = false): void {
    const span = this._max - this._min;
    let normalized = span === 0 ? 0 : (v - this._min) / span;
    if (normalized < 0) normalized = 0;
    else if (normalized > 1) normalized = 1;
    if (this._clampToNotches && this._numNotches > 0) {
      normalized = Math.floor(normalized * this._numNotches + 0.5) / this._numNotches;
    }
    if (normalized === this._value && !forceUpdate) return;
    this._value = normalized;
    const info = eventInfo();
    info.controlCaller = this;
    this.onValueChanged.emit(info);
    this.invalidate();
    this.redraw();
  }

  getFloatValue(): number {
    return this._min + this._value * (this._max - this._min);
  }

  // =====================================================================
  // Notches
  // =====================================================================

  setNotchCount(n: number): void {
    this._numNotches = n;
  }

  getNotchCount(): number {
    return this._numNotches;
  }

  setClampToNotches(b: boolean): void {
    this._clampToNotches = b;
    // Re-snap to honour the new flag.
    this.setFloatValue(this.getFloatValue(), true);
  }

  isClampedToNotches(): boolean {
    return this._clampToNotches;
  }

  // =====================================================================
  // Keyboard — arrows step by 1 unit of the caller's range; Home/End
  // jump to the endpoints. Matches GWEN's Slider.cpp:34.
  // =====================================================================

  override onKeyLeft(down: boolean): boolean {
    if (down) this.setFloatValue(this.getFloatValue() - 1);
    return true;
  }

  override onKeyRight(down: boolean): boolean {
    if (down) this.setFloatValue(this.getFloatValue() + 1);
    return true;
  }

  override onKeyUp(down: boolean): boolean {
    if (down) this.setFloatValue(this.getFloatValue() + 1);
    return true;
  }

  override onKeyDown(down: boolean): boolean {
    if (down) this.setFloatValue(this.getFloatValue() - 1);
    return true;
  }

  override onKeyHome(down: boolean): boolean {
    if (down) this.setFloatValue(this._min);
    return true;
  }

  override onKeyEnd(down: boolean): boolean {
    if (down) this.setFloatValue(this._max);
    return true;
  }

  // =====================================================================
  // Subclass contract
  //
  // `calculateValue` computes the current normalized 0..1 value from
  // the SliderBar's pixel position inside the track. `onMoved` is the
  // shared handler that converts that normalized value back into the
  // caller's scaled range and emits onValueChanged.
  // =====================================================================

  protected abstract calculateValue(): number;

  // Re-pin the SliderBar's pixel position to match `_value`. Subclasses
  // implement the orientation-specific math (mirrors what `layout()`
  // does, but eagerly so a notch-snap doesn't have to wait for the
  // next layout pass).
  protected abstract snapBarToValue(): void;

  protected onMoved(): void {
    const normalized = this.calculateValue();
    const real = this._min + normalized * (this._max - this._min);
    this.setFloatValue(real);
    // When clamping to notches, every mousemove that lands inside an
    // already-current notch's snap zone short-circuits in
    // `setFloatValue` (value unchanged → no invalidate → no layout →
    // bar stays where the Dragger last moved it). Force the bar back
    // to the snap position so the visual matches `_value`.
    if (this._clampToNotches) this.snapBarToValue();
  }
}

// ---------------------------------------------------------------------------
// HorizontalSlider — thumb runs along the control's width.
// ---------------------------------------------------------------------------

export class HorizontalSlider extends Slider {
  // Thumb size in pixels — 15 matches the Input.Slider.H.* single atlas
  // regions in DynamicSkin.
  private static readonly BAR_SIZE = 15;

  constructor(parent: Base | null) {
    super(parent);
    this._bar.setHorizontal(true);
  }

  protected calculateValue(): number {
    const track = this.width() - HorizontalSlider.BAR_SIZE;
    if (track <= 0) return 0;
    return this._bar.x() / track;
  }

  protected snapBarToValue(): void {
    this._bar.moveTo(this._value * (this.width() - HorizontalSlider.BAR_SIZE), 0);
  }

  override onMouseClickLeft(x: number, y: number, pressed: boolean): void {
    if (!pressed) return;
    // Translate click into local coords, park the bar under the cursor,
    // then forward the press to the bar so it grabs canvas.mouseFocus
    // and starts tracking drag on its own.
    const local = this.canvasPosToLocal(point(x, y));
    this._bar.moveTo(local.x - this._bar.width() * 0.5, this._bar.y());
    this._bar.onMouseClickLeft(x, y, pressed);
    this.onMoved();
  }

  override layout(skin: Skin): void {
    super.layout(skin);
    this._bar.setSize(HorizontalSlider.BAR_SIZE, this.height());
    this._bar.moveTo(this._value * (this.width() - HorizontalSlider.BAR_SIZE), 0);
  }

  override render(skin: Skin): void {
    skin.drawSlider(
      this,
      true,
      this._clampToNotches ? this._numNotches : 0,
      this._bar.width(),
    );
  }

  // Track-aligned focus ring — a 5px-tall band (matching the notch
  // tick height) centered on the slider, extended 3px outside the
  // slider on each side so the left/right edges land in clean
  // negative space rather than on top of the nib at min/max value.
  // `renderFocus` runs with the parent's clip active (see
  // Base.renderRecursive), so drawing at negative x is safe.
  override renderFocus(skin: Skin): void {
    const canvas = this.getCanvas();
    if (!canvas || canvas.keyboardFocus !== this) return;
    if (!this.isTabable()) return;
    const cy = Math.floor(this.height() / 2);
    skin.drawKeyboardHighlight(this, rect(-3, cy - 2, this.width() + 6, 5), 0);
  }
}

// ---------------------------------------------------------------------------
// VerticalSlider — thumb runs along the control's height. Value maps so
// "up" is greater (1 at top, 0 at bottom) to match GWEN's convention.
// ---------------------------------------------------------------------------

export class VerticalSlider extends Slider {
  private static readonly BAR_SIZE = 15;

  constructor(parent: Base | null) {
    super(parent);
    this._bar.setHorizontal(false);
  }

  protected calculateValue(): number {
    const track = this.height() - VerticalSlider.BAR_SIZE;
    if (track <= 0) return 0;
    return 1 - this._bar.y() / track;
  }

  protected snapBarToValue(): void {
    this._bar.moveTo(0, (1 - this._value) * (this.height() - VerticalSlider.BAR_SIZE));
  }

  override onMouseClickLeft(x: number, y: number, pressed: boolean): void {
    if (!pressed) return;
    const local = this.canvasPosToLocal(point(x, y));
    this._bar.moveTo(this._bar.x(), local.y - this._bar.height() * 0.5);
    this._bar.onMouseClickLeft(x, y, pressed);
    this.onMoved();
  }

  override layout(skin: Skin): void {
    super.layout(skin);
    this._bar.setSize(this.width(), VerticalSlider.BAR_SIZE);
    this._bar.moveTo(0, (1 - this._value) * (this.height() - VerticalSlider.BAR_SIZE));
  }

  override render(skin: Skin): void {
    skin.drawSlider(
      this,
      false,
      this._clampToNotches ? this._numNotches : 0,
      this._bar.height(),
    );
  }

  // See HorizontalSlider.renderFocus — same idea, vertical orientation:
  // a 5px-wide band centered on the slider's width and extended 3px
  // past the top and bottom.
  override renderFocus(skin: Skin): void {
    const canvas = this.getCanvas();
    if (!canvas || canvas.keyboardFocus !== this) return;
    if (!this.isTabable()) return;
    const cx = Math.floor(this.width() / 2);
    skin.drawKeyboardHighlight(this, rect(cx - 2, -3, 5, this.height() + 6), 0);
  }
}
