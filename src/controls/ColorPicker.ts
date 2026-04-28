// ColorPicker — the composite RGBA picker. Ports
// `Gwen::Controls::ColorPicker` from include/Gwen/Controls/ColorPicker.h
// + src/Controls/ColorPicker.cpp.
//
// Layout:
//   four labelled channel rows (R / G / B / A), each row containing a
//   per-channel display swatch, a HorizontalSlider (0..255), and a
//   TextBoxNumeric that mirrors the slider value. A larger result swatch
//   on the right side shows the composed color with the alpha checker.
//
// Slider and textbox stay in sync via a one-way channel update path:
// whichever control moves triggers `updateChannel`, which rewrites the
// RGBA state and calls `updateControls` to push the new numbers back
// into every visible control. This simple pattern avoids re-entrancy
// because TextBox.setText / HorizontalSlider.setFloatValue both short-
// circuit when the new value equals the current one.

import { Base } from './Base';
import { GroupBox } from './GroupBox';
import { HorizontalSlider } from './Slider';
import { TextBoxNumeric } from './TextBoxNumeric';
import { ColorDisplay } from './ColorDisplay';
import { Signal, eventInfo, type EventInfo } from '../core/Events';
import { color, type Color } from '../core/Structures';
import type { Skin } from '../skin/Skin';

type ChannelName = 'Red' | 'Green' | 'Blue' | 'Alpha';

interface ChannelRow {
  group: GroupBox;
  slider: HorizontalSlider;
  textbox: TextBoxNumeric;
  display: ColorDisplay;
}

export class ColorPicker extends Base {
  readonly onColorChanged = new Signal<EventInfo>();

  protected _color: Color = color(255, 0, 0, 255);
  // Suppresses the write-back loop while updateControls is repainting
  // the slider / textbox — without this, setFloatValue / setText on the
  // child controls would bounce a stale value back through the channel
  // handlers during initial population.
  private _suspendChannelEvents = false;

  protected _channels: Record<ChannelName, ChannelRow>;
  protected _resultSwatch: ColorDisplay;

  constructor(parent: Base | null) {
    super(parent);
    this.setSize(256, 150);

    // Rows 36px tall + 5px top margin → 5, 41, 77, 113 with last
    // row's bottom at 149, fitting inside the 150-tall picker. The
    // 36 (instead of the original 35) gives the inner panel 16 tall
    // — exactly enough for the textbox + slider, which were
    // previously clipping by a pixel against a 15-tall inner.
    const redRow = this.createChannelRow('Red', 5);
    const greenRow = this.createChannelRow('Green', 41);
    const blueRow = this.createChannelRow('Blue', 77);
    const alphaRow = this.createChannelRow('Alpha', 113);
    this._channels = { Red: redRow, Green: greenRow, Blue: blueRow, Alpha: alphaRow };

    // Result swatch — lives in its own GroupBox on the right side so the
    // "Result" title reads legibly and the alpha checker gives a hint of
    // what's behind the final color. Coordinates are relative to the
    // GroupBox's inner panel (the 32×32 swatch at (7, 5) matches GWEN's
    // ColorPicker.cpp:103).
    const resultGroup = new GroupBox(this);
    resultGroup.setPos(180, 30);
    resultGroup.setSize(60, 60);
    resultGroup.setText('Result');
    this._resultSwatch = new ColorDisplay(resultGroup);
    this._resultSwatch.setBounds(7, 5, 32, 32);
    this._resultSwatch.setDrawCheckers(true);

    this.setColor(this._color);
  }

  // =======================================================================
  // Color
  // =======================================================================

  setColor(c: Color): void {
    this._color = c;
    this.updateControls();
  }

  getColor(): Color {
    return this._color;
  }

  setAlphaVisible(visible: boolean): void {
    this._channels.Alpha.group.setHidden(!visible);
  }

  isAlphaVisible(): boolean {
    return !this._channels.Alpha.group.hidden();
  }

  // =======================================================================
  // Layout helpers
  // =======================================================================

  private createChannelRow(name: ChannelName, y: number): ChannelRow {
    const group = new GroupBox(this);
    group.setPos(5, y);
    group.setSize(160, 36);
    group.setText(name);

    // Children are positioned relative to the GroupBox's INNER PANEL,
    // which is auto-inset from the GroupBox's frame: ~6px on the
    // left/right/bottom and ~14px on the top to clear the title.
    // Earlier this file used y=15 (an absolute-position guess that
    // pre-dated the inner-panel routing) — that put every child
    // BELOW the inner panel, where they got clipped to invisible.
    // GWEN's ColorPicker.cpp:36-44 keeps these at low y values inside
    // the inner panel; we mirror that.
    const display = new ColorDisplay(group);
    display.setBounds(0, 3, 12, 12);

    // Slider squeezed to 70 to make room for a wider numeric box.
    // "255" at our 14pt Arial measures ~22px; the previous 26-wide
    // textbox left only 18px of viewable text area (after 4px text
    // padding on each side), so the value scrolled horizontally and
    // the rightmost digit got partially cut off. 36 wide gives 28px
    // of viewable text — comfortable for any 0–255 value.
    const slider = new HorizontalSlider(group);
    slider.setBounds(17, 1, 70, 15);
    slider.setRange(0, 255);
    slider.onValueChanged.on(() => this.onSliderChanged(name));

    const textbox = new TextBoxNumeric(group);
    textbox.setBounds(95, 0, 36, 16);
    textbox.setText('0');
    textbox.onTextChange.on(() => this.onTextChanged(name));

    return { group, slider, textbox, display };
  }

  // =======================================================================
  // Channel sync
  // =======================================================================

  protected updateControls(): void {
    this._suspendChannelEvents = true;
    try {
      const c = this._color;
      const red = this._channels.Red;
      red.slider.setFloatValue(c.r);
      red.textbox.setText(String(c.r));
      red.display.setColor(color(c.r, 0, 0, 255));

      const green = this._channels.Green;
      green.slider.setFloatValue(c.g);
      green.textbox.setText(String(c.g));
      green.display.setColor(color(0, c.g, 0, 255));

      const blue = this._channels.Blue;
      blue.slider.setFloatValue(c.b);
      blue.textbox.setText(String(c.b));
      blue.display.setColor(color(0, 0, c.b, 255));

      const alpha = this._channels.Alpha;
      alpha.slider.setFloatValue(c.a);
      alpha.textbox.setText(String(c.a));
      alpha.display.setColor(color(255, 255, 255, c.a));

      this._resultSwatch.setColor(c);
    } finally {
      this._suspendChannelEvents = false;
    }

    const info = eventInfo();
    info.controlCaller = this;
    this.onColorChanged.emit(info);
  }

  private onSliderChanged(name: ChannelName): void {
    if (this._suspendChannelEvents) return;
    const v = Math.round(this._channels[name].slider.getFloatValue());
    this.updateChannel(name, v);
  }

  private onTextChanged(name: ChannelName): void {
    if (this._suspendChannelEvents) return;
    const v = Math.round(this._channels[name].textbox.getFloatFromText());
    this.updateChannel(name, v);
  }

  private updateChannel(name: ChannelName, raw: number): void {
    const v = Math.max(0, Math.min(255, raw));
    const cur = this._color;
    if (name === 'Red') this._color = color(v, cur.g, cur.b, cur.a);
    else if (name === 'Green') this._color = color(cur.r, v, cur.b, cur.a);
    else if (name === 'Blue') this._color = color(cur.r, cur.g, v, cur.a);
    else this._color = color(cur.r, cur.g, cur.b, v);
    this.updateControls();
  }

  // =======================================================================
  // Render
  // =======================================================================

  // No art of our own — everything visible is a child control.
  override render(_skin: Skin): void {
    // no-op
  }
}
