// RadioButtonController — container that turns a bag of LabeledRadioButtons
// into a mutually-exclusive single-select group. Ports
// `Gwen::Controls::RadioButtonController` from
// include/Gwen/Controls/RadioButtonController.h +
// src/Controls/RadioButtonController.cpp.
//
// Each `addOption` docks a fresh LabeledRadioButton to the top of the
// controller and subscribes to its `onChecked` signal. When one fires we
// walk the child list and clear every sibling, leaving the source
// selected; then we emit `onSelectionChange` so consumers can react.

import { Base } from './Base';
import { LabeledRadioButton } from './RadioButton';
import { Signal, eventInfo, type EventInfo } from '../core/Events';
import { Pos } from '../core/Align';
import { margin } from '../core/Structures';

export class RadioButtonController extends Base {
  readonly onSelectionChange = new Signal<EventInfo>();
  protected _selected: LabeledRadioButton | null = null;

  constructor(parent: Base | null) {
    super(parent);
    // The controller is the single tab stop for the whole radio group;
    // arrow keys cycle the selection between the LabeledRadioButton
    // children, which themselves stay non-tabable.
    this.setTabable(true);
    this.setKeyboardInputEnabled(true);
  }

  addOption(text: string, optionalName = ''): LabeledRadioButton {
    const lrb = new LabeledRadioButton(this);
    lrb.setName(optionalName);
    lrb.label.setText(text);
    lrb.dock(Pos.Top);
    lrb.setMargin(margin(0, 1, 0, 1));
    lrb.setKeyboardInputEnabled(false);
    lrb.setTabable(false);
    lrb.radioButton.onChecked.on(() => this.onRadioChecked(lrb));
    this.invalidate();
    return lrb;
  }

  getSelected(): LabeledRadioButton | null {
    return this._selected;
  }

  getSelectedName(): string {
    return this._selected ? this._selected.getName() : '';
  }

  // =====================================================================
  // Keyboard nav — Up/Down (and Left/Right for mirror-symmetry with
  // horizontal layouts) move selection between options. Wraps at ends.
  // =====================================================================

  override onKeyUp(down: boolean): boolean {
    if (down) this.moveSelection(-1);
    return true;
  }

  override onKeyDown(down: boolean): boolean {
    if (down) this.moveSelection(1);
    return true;
  }

  override onKeyLeft(down: boolean): boolean {
    if (down) this.moveSelection(-1);
    return true;
  }

  override onKeyRight(down: boolean): boolean {
    if (down) this.moveSelection(1);
    return true;
  }

  private getOptions(): LabeledRadioButton[] {
    return this.children.filter((c): c is LabeledRadioButton => c instanceof LabeledRadioButton);
  }

  private moveSelection(delta: number): void {
    const opts = this.getOptions();
    if (opts.length === 0) return;
    const cur = this._selected;
    const idx = cur ? opts.indexOf(cur) : -1;
    let next: number;
    if (idx === -1) next = delta > 0 ? 0 : opts.length - 1;
    else next = (idx + delta + opts.length) % opts.length;
    // Setting the radio's checked flag fires onChecked, which routes
    // through `onRadioChecked` and clears every sibling for us.
    opts[next].radioButton.setChecked(true);
  }

  private onRadioChecked(source: LabeledRadioButton): void {
    // Uncheck every sibling so the group holds exactly one selection.
    const kids = this.children;
    for (let i = 0; i < kids.length; i++) {
      const c = kids[i];
      if (c instanceof LabeledRadioButton && c !== source) {
        c.radioButton.setChecked(false);
      }
    }
    this._selected = source;
    const info = eventInfo();
    info.controlCaller = this;
    this.onSelectionChange.emit(info);
  }
}
