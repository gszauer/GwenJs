// FieldLabel — a Label that pairs a short caption with an inline edit
// control docked to its right edge. Ports
// `Gwen::Controls::FieldLabel` from include/Gwen/Controls/FieldLabel.h.
//
// Layout: caption text fills the left side, the field (usually a
// TextBox or NumericUpDown) docks Right with its width locked to
// `parent.width - FIELD_WIDTH_OFFSET`. The offset is hard-coded in GWEN
// and we keep it for visual parity.

import { Base } from './Base';
import { Label } from './Label';
import { Pos } from '../core/Align';
import { margin } from '../core/Structures';
import type { Skin } from '../skin/Skin';

export class FieldLabel extends Label {
  // Matches GWEN's hard-coded label-column width. Overridable via
  // `setFieldWidthOffset` for callers that need a different ratio.
  private static DEFAULT_FIELD_WIDTH_OFFSET = 70;

  protected _field: Base | null = null;
  protected _fieldWidthOffset = FieldLabel.DEFAULT_FIELD_WIDTH_OFFSET;

  constructor(parent: Base | null) {
    super(parent);
    this.setMargin(margin(0, 1, 0, 1));
    this.setAlignment(Pos.CenterV | Pos.Left);
  }

  // =====================================================================
  // Field assignment
  // =====================================================================

  setField(ctrl: Base): void {
    this._field = ctrl;
    ctrl.setParent(this);
    ctrl.dock(Pos.Right);
  }

  getField(): Base | null {
    return this._field;
  }

  setFieldWidthOffset(px: number): void {
    if (this._fieldWidthOffset === px) return;
    this._fieldWidthOffset = px;
    this.invalidate();
  }

  // =====================================================================
  // Layout
  // =====================================================================

  override layout(skin: Skin): void {
    super.layout(skin);
    if (this._field) {
      this._field.setWidth(this.width() - this._fieldWidthOffset);
    }
  }

  // =====================================================================
  // Factory — GWEN's convenient "take any control, slap a caption on
  // the left" helper. The passed control's existing dock + bounds are
  // inherited by the new FieldLabel so the pair occupies the same space
  // the caller had already reserved for the field alone.
  // =====================================================================

  static setup(control: Base, text: string): FieldLabel {
    const parent = control.parent;
    if (!parent) {
      throw new Error('FieldLabel.setup requires control to have a parent');
    }
    const fl = new FieldLabel(parent);
    const b = control.getBounds();
    fl.setBounds(b.x, b.y, b.w, b.h);
    fl.dock(control.getDock());
    fl.setText(text);
    fl.setField(control);
    return fl;
  }
}
