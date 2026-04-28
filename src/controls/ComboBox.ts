// ComboBox — a Button that pops up a Menu of selectable items. Ports
// `Gwen::Controls::ComboBox` from include/Gwen/Controls/ComboBox.h +
// src/Controls/ComboBox.cpp.
//
// Composition:
//   * Extends Button — selected text rendered via the inherited Label.
//   * `_arrow` (ComboBoxDownArrow) — a Button child docked Right that
//     paints the down-chevron from the skin atlas. Mouse input is disabled
//     so clicks fall through to the parent ComboBox.
//   * `_menu` (Menu) — popup parented to the canvas so it can float over
//     anything; reparented on every `openList()` so a relocated combo
//     still pops up against the correct canvas.
//
// Selection: addItem returns a MenuItem; the first item added becomes the
// initial selection (without firing `onSelection`). Selecting via mouse,
// keyboard arrows, or `selectItem*` fires `onSelection` unless the call
// site opts out.
//
// Deviations from GWEN:
//   * Up/Down arrow keys cycle through items (prev/next) inline rather
//     than opening the dropdown — matches the upstream behaviour.
//   * `closeList()` uses `Menu.hide()` rather than `Menu.close()` so the
//     popup vanishes without firing `onMenuClosed`. Combo callers care
//     about `onSelection`, not menu lifecycle events.

import { Button } from './Button';
import { Menu } from './Menu';
import { MenuItem } from './MenuItem';
import { Signal, eventInfo, type EventInfo } from '../core/Events';
import { Pos } from '../core/Align';
import { margin } from '../core/Structures';
import type { Skin } from '../skin/Skin';
import type { Base } from './Base';
import type { Canvas } from './Canvas';

// ---------------------------------------------------------------------------
// ComboBoxDownArrow — internal child that draws the dropdown chevron.
// Mouse input disabled so clicks fall through to the owning ComboBox.
// ---------------------------------------------------------------------------

class ComboBoxDownArrow extends Button {
  protected _combo: ComboBox;

  constructor(combo: ComboBox) {
    super(combo);
    this._combo = combo;
    this.setSize(15, 15);
    this.setMouseInputEnabled(false);
    this.setTabable(false);
  }

  override render(skin: Skin): void {
    skin.drawComboDownArrow(
      this,
      this._combo.isHovered(),
      this._combo.isDepressed(),
      this._combo.isMenuOpen(),
      this._combo.isDisabled(),
    );
  }
}

// ---------------------------------------------------------------------------
// ComboBox
// ---------------------------------------------------------------------------

export class ComboBox extends Button {
  readonly onSelection = new Signal<EventInfo>();

  protected _menu: Menu;
  protected _arrow: ComboBoxDownArrow;
  protected _selectedItem: MenuItem | null = null;

  constructor(parent: Base | null) {
    super(parent);
    this.setSize(100, 20);
    this.setTabable(true);
    this.setKeyboardInputEnabled(true);
    this.setAlignment(Pos.Left | Pos.CenterV);
    this.setTextPadding(margin(3, 0, 3, 0));

    // Menu is parented to the canvas so it floats above any clip region.
    // If we have no canvas yet (constructed before being attached), we
    // fall back to `this` and reparent on first `openList()`.
    const canvas = this.getCanvas() as Canvas | null;
    this._menu = new Menu(canvas ?? this);
    this._menu.setDisableIconMargin(true);
    this._menu.setTabable(false);
    this._menu.hide();

    this._arrow = new ComboBoxDownArrow(this);
    this._arrow.dock(Pos.Right);
    this._arrow.setMargin(margin(0, 4, 4, 4));
  }

  // =====================================================================
  // Items
  // =====================================================================

  addItem(label: string, name = ''): MenuItem {
    const item = this._menu.addItem(label);
    item.setName(name);
    item.onMenuItemSelected.on(() => this.onItemSelected(item));
    if (!this._selectedItem) this.onItemSelected(item, false);
    return item;
  }

  clearItems(): void {
    this._menu.clearItems();
    this._selectedItem = null;
  }

  getSelectedItem(): MenuItem | null {
    return this._selectedItem;
  }

  selectItem(item: MenuItem, fireEvents = true): void {
    this.onItemSelected(item, fireEvents);
  }

  selectItemByName(name: string, fireEvents = true): void {
    const inner = this._menu.getInnerPanel();
    if (!inner) return;
    for (const c of inner.children) {
      if (c instanceof MenuItem && c.getName() === name) {
        this.onItemSelected(c, fireEvents);
        return;
      }
    }
  }

  // =====================================================================
  // Open / close
  // =====================================================================

  openList(): void {
    const canvas = this.getCanvas() as Canvas | null;
    if (canvas) this._menu.setParent(canvas);
    const pos = this.localPosToCanvas({ x: 0, y: this.height() });
    // Width starts at the combo's width; the menu's sizeToContents
    // (run on the next layout pass) can grow it WIDER if an item
    // exceeds the combo, but `setMinimumWidth` floors it at the
    // combo's width so a long combo with short item labels doesn't
    // produce a popup narrower than the combo.
    this._menu.setMinimumWidth(this.width());
    this._menu.setSize(this.width(), 0);
    this._menu.open(pos);
    this._menu.bringToFront();
  }

  closeList(): void {
    this._menu.hide();
  }

  isMenuOpen(): boolean {
    return this._menu.isVisible();
  }

  // The ComboBox owns its dropdown — Canvas's outside-click closeMenus
  // walk skips owners so this control's own toggle handler runs on click.
  override ownsOpenMenu(): boolean {
    return this._menu.isVisible();
  }

  // =====================================================================
  // Mouse
  // =====================================================================

  override onMouseClickLeft(x: number, y: number, pressed: boolean): void {
    super.onMouseClickLeft(x, y, pressed);
    if (pressed && this.isHovered()) {
      if (this.isMenuOpen()) this.closeList();
      else this.openList();
    }
  }

  // =====================================================================
  // Keyboard — Up/Down cycle through items inline.
  // =====================================================================

  override onKeyUp(down: boolean): boolean {
    if (!down) return true;
    const items = this.menuItems();
    if (items.length === 0) return true;
    const idx = this._selectedItem ? items.indexOf(this._selectedItem) : 0;
    const next = idx > 0 ? items[idx - 1] : items[items.length - 1];
    this.onItemSelected(next, true);
    return true;
  }

  override onKeyDown(down: boolean): boolean {
    if (!down) return true;
    const items = this.menuItems();
    if (items.length === 0) return true;
    const idx = this._selectedItem ? items.indexOf(this._selectedItem) : -1;
    const next = idx < items.length - 1 ? items[idx + 1] : items[0];
    this.onItemSelected(next, true);
    return true;
  }

  private menuItems(): MenuItem[] {
    const inner = this._menu.getInnerPanel();
    if (!inner) return [];
    const out: MenuItem[] = [];
    for (const c of inner.children) {
      if (c instanceof MenuItem) out.push(c);
    }
    return out;
  }

  // =====================================================================
  // Internal — selection handler shared by mouse + keyboard + API.
  // =====================================================================

  protected onItemSelected(item: MenuItem, fireEvents = true): void {
    this._selectedItem = item;
    this.setText(item.getText());
    this.closeList();
    if (fireEvents) {
      const info = eventInfo();
      info.controlCaller = this;
      info.control = item;
      this.onSelection.emit(info);
    }
  }

  // =====================================================================
  // Render
  // =====================================================================

  override render(skin: Skin): void {
    skin.drawComboBox(this, this.isDepressed(), this.isMenuOpen());
  }
}
