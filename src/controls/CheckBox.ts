// CheckBox + CheckBoxWithLabel — tick-box control and the common
// "CheckBox | LabelClickable" composite. Ports
// `Gwen::Controls::CheckBox` + `Gwen::Controls::CheckBoxWithLabel`
// from include/Gwen/Controls/CheckBox.h + src/Controls/CheckBox.cpp.
//
// CheckBox extends Button: the toggle press semantics come from Button,
// but the checked state (and its onChecked/onUnChecked/onCheckChanged
// signals) lives here. Subclasses (RadioButton) override
// `allowUncheck()` to refuse a click that would uncheck a selected
// option.
//
// GWEN's constructor quirk — `m_bChecked = true` followed by `Toggle()`
// so the initial state ends up false while "firing" OnCheckChanged
// into an empty handler list — has no effect we can observe. The TS
// port initialises to false directly; no silent-emit dance.

import { Button } from './Button';
import { LabelClickable } from './LabelClickable';
import { Base } from './Base';
import { Signal, eventInfo, type EventInfo } from '../core/Events';
import { Key } from '../core/Input';
import { Pos } from '../core/Align';
import { margin } from '../core/Structures';
import type { Skin } from '../skin/Skin';

export class CheckBox extends Button {
  readonly onChecked = new Signal<EventInfo>();
  readonly onUnChecked = new Signal<EventInfo>();
  readonly onCheckChanged = new Signal<EventInfo>();

  protected _checked = false;

  constructor(parent: Base | null) {
    super(parent);
    this.setSize(15, 15);
    this.setMouseInputEnabled(true);
  }

  // =====================================================================
  // Checked state
  // =====================================================================

  isChecked(): boolean {
    return this._checked;
  }

  setChecked(b: boolean): void {
    if (this._checked === b) return;
    this._checked = b;
    const info = this.info();
    this.onCheckChanged.emit(info);
    if (b) this.onChecked.emit(info);
    else this.onUnChecked.emit(info);
    this.redraw();
  }

  toggle(): void {
    this.setChecked(!this._checked);
  }

  /**
   * Subclasses (RadioButton) override to `false` so clicking an already-
   * checked radio doesn't deselect the group's sole selection.
   */
  protected allowUncheck(): boolean {
    return true;
  }

  // =====================================================================
  // Mouse — toggle on release if the click landed inside us while
  // depressed. We defer to Button.onMouseClickLeft for focus / onDown /
  // onUp / onPress, then layer the check-toggle behaviour on top.
  // =====================================================================

  override onMouseClickLeft(x: number, y: number, pressed: boolean): void {
    // Capture the pre-super depressed state so we only toggle on a real
    // down→up cycle. Button clears `_depressed` before returning so
    // checking it afterwards would always be false.
    const wasDepressed = this.isDepressed();
    super.onMouseClickLeft(x, y, pressed);
    if (pressed) return;
    if (!wasDepressed) return;
    if (!this.isHovered()) return;
    if (this._checked && !this.allowUncheck()) return;
    this.toggle();
  }

  // =====================================================================
  // Keyboard — Space / Return run Button's press handler (which fires
  // onPress) and then toggle the checked state, mirroring the click
  // path. allowUncheck() blocks the toggle on RadioButton when it
  // would deselect the current selection.
  // =====================================================================

  override onKeyPress(key: number, pressed = true): boolean {
    if ((key === Key.Space || key === Key.Return) && pressed && !this.isDisabled()) {
      // super fires onDown/onUp/onPress (and respects _isToggle, but
      // CheckBox doesn't use that path).
      super.onKeyPress(key, pressed);
      if (this._checked && !this.allowUncheck()) return true;
      this.toggle();
      return true;
    }
    return super.onKeyPress(key, pressed);
  }

  // =====================================================================
  // Render
  // =====================================================================

  override render(skin: Skin): void {
    skin.drawCheckBox(this, this._checked, this.isDepressed());
  }

  private info(): EventInfo {
    const i = eventInfo();
    i.controlCaller = this;
    return i;
  }
}

// ---------------------------------------------------------------------------
// CheckBoxWithLabel — a CheckBox plus a LabelClickable that toggles it
// when clicked. The label is docked Fill so it stretches to consume
// whatever space remains after the 15×15 checkbox is placed.
// ---------------------------------------------------------------------------

export class CheckBoxWithLabel extends Base {
  protected _checkbox: CheckBox;
  protected _label: LabelClickable;

  constructor(parent: Base | null) {
    super(parent);
    this.setSize(200, 19);

    this._checkbox = new CheckBox(this);
    this._checkbox.dock(Pos.Left);
    this._checkbox.setMargin(margin(0, 2, 2, 2));

    this._label = new LabelClickable(this);
    this._label.dock(Pos.Fill);
    this._label.onPress.on(() => this._checkbox.toggle());
  }

  getCheckBox(): CheckBox {
    return this._checkbox;
  }

  getLabel(): LabelClickable {
    return this._label;
  }
}
