// LabelClickable — a Button without the button chrome. Ports
// `Gwen::Controls::LabelClickable` from include/Gwen/Controls/LabelClickable.h +
// src/Controls/LabelClickable.cpp.
//
// Reuses Button for hover/press/signal semantics but suppresses the
// background render entirely — visually it reads as a plain Label, yet
// still fires `onPress` and shows the "clickable" cursor. Used by
// CheckBoxWithLabel, RadioButton rows, and Menu accelerators.

import { Button } from './Button';
import { Pos } from '../core/Align';
import { CursorType } from '../core/Structures';
import type { Skin } from '../skin/Skin';
import type { Base } from './Base';

export class LabelClickable extends Button {
  constructor(parent: Base | null) {
    super(parent);
    this.setShouldDrawBackground(false);
    this.setIsToggle(false);
    this.setCursor(CursorType.Finger);
    this.setAlignment(Pos.Left | Pos.CenterV);
  }

  // LabelClickable never paints a button body. Intentionally empty.
  override render(_skin: Skin): void {
    // no-op — text renders through the inherited Label `postLayout` path.
  }
}
