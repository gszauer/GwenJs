// SplitterBar — a drag handle that divides two sibling panels. Ports
// `Gwen::ControlsInternal::SplitterBar` from
// include/Gwen/Controls/SplitterBar.h + src/Controls/SplitterBar.cpp.
//
// Composition: SplitterBar is a Dragger that targets itself and stays
// inside its parent. The owning split container listens for drag moves
// and reflows the adjacent panels; the SplitterBar itself just slides
// along the allowed axis.
//
// GWEN's SplitterBar has no art; the host splitter paints around it.
// We keep that behaviour by disabling background drawing.

import { Dragger } from './Dragger';
import type { Skin } from '../skin/Skin';
import type { Base } from './Base';

export class SplitterBar extends Dragger {
  constructor(parent: Base | null) {
    super(parent);
    this.setTarget(this);
    this.setRestrictToParent(true);
    this.setShouldDrawBackground(false);
  }

  override layout(skin: Skin): void {
    super.layout(skin);
    // Re-clamp position inside the parent after any parent resize. moveTo
    // honours restrictToParent, so this snaps us back in-bounds if the
    // parent shrunk out from under our previous position.
    this.moveTo(this.x(), this.y());
  }
}
