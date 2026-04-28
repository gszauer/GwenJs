// TabTitleBar — the narrow header strip above a TabControl that shows
// the currently-active tab's title and can be dragged to tear the
// TabControl loose into its own window. Ports
// `Gwen::Controls::TabTitleBar` from include/Gwen/Controls/TabTitleBar.h +
// src/Controls/TabTitleBar.cpp.
//
// Dragging the title bar starts a "TabWindowMove" package whose
// `drawcontrol` points at the *owning* TabControl, so a `DockBase` drop
// reparents the whole tab set in one go (vs. a TabButton drag, which
// only moves a single tab).

import { Label } from './Label';
import { margin, type DragAndDropPackage } from '../core/Structures';
import type { Skin } from '../skin/Skin';
import type { Base } from './Base';

export class TabTitleBar extends Label {
  constructor(parent: Base | null) {
    super(parent);
    this.setMouseInputEnabled(true);
    this.setTextPadding(margin(5, 2, 5, 2));
    this.setPadding(margin(1, 2, 1, 2));
    this.dragAndDrop_SetPackage(true, 'TabWindowMove');
  }

  // Make the parent DockedTabControl the drag's drawcontrol so DockBase's
  // "TabWindowMove" branch can reparent the whole tab set.
  override dragAndDrop_StartDragging(p: DragAndDropPackage, x: number, y: number): boolean {
    p.holdoffset = this.canvasPosToLocal({ x, y });
    p.drawcontrol = this.parent;
    return p.drawcontrol !== null;
  }

  override render(skin: Skin): void {
    skin.drawTabTitleBar(this);
  }
}
