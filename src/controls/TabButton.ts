// TabButton — the clickable tab label inside a TabStrip. Ports
// `Gwen::Controls::TabButton` from include/Gwen/Controls/TabButton.h +
// src/Controls/TabButton.cpp.
//
// Each button owns a back-reference to its page (the Base that holds the
// tab's content) and the owning TabControl (typed as Base here to avoid
// a circular import — the actual type is TabControl). Pressing the
// button tells the TabControl to switch pages.

import { Button } from './Button';
import { Pos } from '../core/Align';
import { margin } from '../core/Structures';
import type { Skin } from '../skin/Skin';
import type { Base } from './Base';

export class TabButton extends Button {
  protected _page: Base | null = null;
  // Typed as Base to avoid the TabControl <-> TabButton circular type
  // import; callers cast as needed.
  protected _tabControl: Base | null = null;
  // The edge the owning TabStrip docks against (Pos.Top / Bottom /
  // Left / Right). Drives which skin region the tab renders. Named
  // `_tabDock` to avoid clashing with Base's private `_dock`.
  protected _tabDock: number = Pos.Top;

  constructor(parent: Base | null) {
    super(parent);
    this.dock(Pos.Left);
    this.setPadding(margin(3, 2, 5, 2));
    this.setTabable(false);
    // Tab buttons are the drag source for `DockBase`-style reparenting.
    // The default `dragAndDrop_StartDragging` sets `drawcontrol = this`,
    // which is exactly what `DockBase.HandleDrop` expects for the
    // "TabButtonMove" branch.
    this.dragAndDrop_SetPackage(true, 'TabButtonMove');
  }

  setPage(p: Base | null): void {
    this._page = p;
  }

  getPage(): Base | null {
    return this._page;
  }

  setTabControl(c: Base | null): void {
    this._tabControl = c;
  }

  getTabControl(): Base | null {
    return this._tabControl;
  }

  isActive(): boolean {
    return this._page !== null && !this._page.hidden();
  }

  setTabDock(d: number): void {
    this._tabDock = d;
  }

  getTabDock(): number {
    return this._tabDock;
  }

  override render(skin: Skin): void {
    skin.drawTabButton(this, this.isActive(), this._tabDock);
  }
}
