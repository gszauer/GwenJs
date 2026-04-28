// TabStrip — the horizontal (or vertical) bar that holds a TabControl's
// TabButtons. Ports `Gwen::Controls::TabStrip` from
// include/Gwen/Controls/TabStrip.h + src/Controls/TabStrip.cpp.
//
// Child docking handles layout; we add an `allowReorder` flag so a later
// drag-and-drop task can enable tab shuffling without touching this
// file again.

import { Base } from './Base';
import type { Skin } from '../skin/Skin';

export class TabStrip extends Base {
  protected _allowReorder = false;

  constructor(parent: Base | null) {
    super(parent);
  }

  setAllowReorder(b: boolean): void {
    this._allowReorder = b;
  }

  allowReorder(): boolean {
    return this._allowReorder;
  }

  override layout(skin: Skin): void {
    // Children (TabButtons) dock along the strip; Base::recurseLayout
    // handles the placement, we just need the hook so subclasses can
    // override cleanly.
    super.layout(skin);
  }
}
