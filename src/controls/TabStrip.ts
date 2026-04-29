// TabStrip — the horizontal (or vertical) bar that holds a TabControl's
// TabButtons. Ports `Gwen::Controls::TabStrip` from
// include/Gwen/Controls/TabStrip.h + src/Controls/TabStrip.cpp.
//
// Two opt-in extensions beyond GWEN make the strip suitable as the
// "title bar with embedded tabs" for `DockedTabControl`:
//
//   * `setShowAsHeader(true)` — paint the strip with the Tab.HeaderBar
//     skin region so it reads as a window title bar; tab buttons render
//     on top via the normal child-render pass.
//   * `setDockDragControl(ctrl)` — make empty (non-button) space inside
//     the strip a drag source for the `TabWindowMove` package, with
//     `ctrl` as the package's `drawcontrol`. Replaces the previous
//     standalone `TabTitleBar` for docked panels.

import { Base } from './Base';
import type { Skin } from '../skin/Skin';
import { type DragAndDropPackage } from '../core/Structures';

export class TabStrip extends Base {
  protected _allowReorder = false;
  protected _dockDragControl: Base | null = null;
  protected _showAsHeader = false;

  constructor(parent: Base | null) {
    super(parent);
  }

  setAllowReorder(b: boolean): void {
    this._allowReorder = b;
  }

  allowReorder(): boolean {
    return this._allowReorder;
  }

  /**
   * Configure this strip as a drag source for whole-dock relocation.
   * `ctrl` is reported as the `TabWindowMove` package's `drawcontrol`
   * (typically the owning DockedTabControl) so DockBase's drop handler
   * reparents the entire tab set in one go. Pass `null` to disable.
   */
  setDockDragControl(ctrl: Base | null): void {
    this._dockDragControl = ctrl;
    if (ctrl) {
      this.setMouseInputEnabled(true);
      this.dragAndDrop_SetPackage(true, 'TabWindowMove');
    } else {
      this.dragAndDrop_SetPackage(false, '');
    }
  }

  override dragAndDrop_StartDragging(p: DragAndDropPackage, x: number, y: number): boolean {
    if (!this._dockDragControl) return false;
    p.holdoffset = this.canvasPosToLocal({ x, y });
    p.drawcontrol = this._dockDragControl;
    return true;
  }

  /**
   * Render with the Tab.HeaderBar background — turns the strip into a
   * macOS / VS Code-style title bar that hosts the tab buttons.
   */
  setShowAsHeader(b: boolean): void {
    if (this._showAsHeader === b) return;
    this._showAsHeader = b;
    this.redraw();
  }

  showsAsHeader(): boolean {
    return this._showAsHeader;
  }

  override render(skin: Skin): void {
    if (this._showAsHeader) skin.drawTabTitleBar(this);
  }

  override layout(skin: Skin): void {
    // Children (TabButtons) dock along the strip; Base::recurseLayout
    // handles the placement, we just need the hook so subclasses can
    // override cleanly.
    super.layout(skin);
  }
}
