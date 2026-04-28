// StatusBar — a thin horizontal strip docked at the bottom of its
// parent. Ports `Gwen::Controls::StatusBar` from
// include/Gwen/Controls/StatusBar.h + src/Controls/StatusBar.cpp.
//
// StatusBar inherits Label so it can carry a "main" text string; hosts
// typically dock extra child controls (text fields, spinner overlays)
// to the left or right via `addControl`.

import { Base } from './Base';
import { Label } from './Label';
import { Pos } from '../core/Align';
import { margin } from '../core/Structures';
import type { Skin } from '../skin/Skin';

export class StatusBar extends Label {
  constructor(parent: Base | null) {
    super(parent);
    this.setHeight(22);
    this.dock(Pos.Bottom);
    this.setPadding(margin(2, 2, 2, 2));
    this.setAlignment(Pos.Left | Pos.CenterV);
    this.setMouseInputEnabled(true);
  }

  // Dock a pre-built control onto the status bar. `right=true` pins it
  // to the trailing edge; otherwise it docks to the leading edge.
  addControl(ctrl: Base, right = false): void {
    ctrl.setParent(this);
    ctrl.dock(right ? Pos.Right : Pos.Left);
  }

  override render(skin: Skin): void {
    skin.drawStatusBar(this);
  }
}
