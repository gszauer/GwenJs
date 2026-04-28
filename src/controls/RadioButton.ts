// RadioButton + LabeledRadioButton — single-select tick box and its
// standard label composite. Ports `Gwen::Controls::RadioButton` +
// `Gwen::Controls::LabeledRadioButton` from
// include/Gwen/Controls/RadioButton.h +
// include/Gwen/Controls/LabeledRadioButton.h.
//
// RadioButton is a CheckBox with one rule flipped: `allowUncheck`
// returns false, so clicking an already-selected radio no-ops instead of
// clearing the group's sole selection. The owning RadioButtonController
// handles sibling-clearing when a new radio is checked.
//
// LabeledRadioButton is the horizontal "[o] Label" composite — a 15×15
// RadioButton docked Left and a LabelClickable docked Fill whose press
// forwards to `radioButton.setChecked(true)`.

import { CheckBox } from './CheckBox';
import { LabelClickable } from './LabelClickable';
import { Base } from './Base';
import { Pos } from '../core/Align';
import { margin } from '../core/Structures';
import { Key } from '../core/Input';
import type { Skin } from '../skin/Skin';

export class RadioButton extends CheckBox {
  constructor(parent: Base | null) {
    super(parent);
    this.setSize(15, 15);
  }

  // GWEN's RadioButton.cpp:16 — a radio refuses to uncheck itself so the
  // group always has exactly one selection.
  protected override allowUncheck(): boolean {
    return false;
  }

  override render(skin: Skin): void {
    skin.drawRadioButton(this, this.isChecked(), this.isDepressed());
  }
}

// ---------------------------------------------------------------------------
// LabeledRadioButton — RadioButton on the left, clickable label filling
// the remainder.
// ---------------------------------------------------------------------------

export class LabeledRadioButton extends Base {
  readonly radioButton: RadioButton;
  readonly label: LabelClickable;

  constructor(parent: Base | null) {
    super(parent);
    this.setSize(200, 19);

    this.radioButton = new RadioButton(this);
    this.radioButton.dock(Pos.Left);
    this.radioButton.setMargin(margin(0, 2, 2, 2));
    this.radioButton.setTabable(false);
    this.radioButton.setKeyboardInputEnabled(false);

    this.label = new LabelClickable(this);
    this.label.dock(Pos.Fill);
    this.label.setAlignment(Pos.CenterV | Pos.Left);
    this.label.setText('Radio Button');
    this.label.setTabable(false);
    this.label.setKeyboardInputEnabled(false);
    this.label.onPress.on(() => this.radioButton.setChecked(true));
  }

  select(): void {
    this.radioButton.setChecked(true);
  }

  isChecked(): boolean {
    return this.radioButton.isChecked();
  }

  // Space key toggles the radio even when focus rests on the label row
  // itself (GWEN's LabeledRadioButton delegates to its child RadioButton).
  override onKeyPress(key: number, pressed = true): boolean {
    if (pressed && key === Key.Space) {
      this.radioButton.setChecked(!this.radioButton.isChecked());
      return true;
    }
    return super.onKeyPress(key, pressed);
  }

  // Draw the focus highlight around the full row rather than just the
  // radio glyph. Matches LabeledRadioButton.cpp:21.
  override renderFocus(skin: Skin): void {
    const canvas = this.getCanvas();
    if (!canvas || canvas.keyboardFocus !== this) return;
    if (!this.isTabable()) return;
    skin.drawKeyboardHighlight(this, this.getRenderBounds(), 0);
  }
}
