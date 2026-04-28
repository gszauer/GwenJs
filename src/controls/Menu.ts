// Menu + MenuDivider — popup menu with MenuItem children. Ports
// `Gwen::Controls::Menu` from include/Gwen/Controls/Menu.h +
// src/Controls/Menu.cpp.
//
// Composition:
//   * Extends ScrollControl — long menus scroll vertically. `setScroll(false,
//     true)` disables the horizontal bar; `setAutoHideBars(true)` keeps both
//     bars out of sight when the menu fits its inner panel.
//   * Children land on the ScrollControl's innerPanel automatically (the
//     usual `addChild` → `_innerPanel` redirect installed by ScrollControl).
//
// Deviations from GWEN:
//   * Upstream's `OnHoverItem` auto-opens submenus when the mouse hovers an
//     item. We defer that to a later task — MVP menus open submenus via
//     click only.
//   * `CloseMenus()` / `Canvas::CloseMenus()` walk the full control tree in
//     GWEN to close every menu-component. For MVP we close from the item
//     itself by walking up its parent chain and closing each Menu ancestor;
//     same outcome for the common "click an item, menus vanish" flow.

import { Base } from './Base';
import { ScrollControl } from './ScrollControl';
import { MenuItem } from './MenuItem';
import { Signal, eventInfo, type EventInfo } from '../core/Events';
import { Pos } from '../core/Align';
import { margin, point, type Point } from '../core/Structures';
import type { Skin } from '../skin/Skin';
import type { Canvas } from './Canvas';

export class Menu extends ScrollControl {
  readonly onMenuClosed = new Signal<EventInfo>();
  // Icon gutter is hidden by default — call setShowIconMargin(true) to
  // reserve a 24px column for menu-item icons. Most menus don't use icons,
  // so the saved horizontal space tightens the popup.
  protected _disableIconMargin = true;
  protected _deleteOnClose = false;
  // Floor for sizeToContents; tunable via setMinimumWidth so a
  // ComboBox can make its popup at least as wide as the combo.
  protected _minimumWidth = 100;

  constructor(parent: Base | null) {
    super(parent);
    this.setBounds(0, 0, 10, 10);
    this.setPadding(margin(2, 2, 2, 2));
    this.setDisabled(false);
    this.setAutoHideBars(true);
    this.setScroll(false, true);
    this.hide();
    this.setKeyboardInputEnabled(false);
  }

  // Menus register as menu-components so the canvas's outside-click
  // close-menus walk leaves clicks-inside-menus alone. Base.isMenuComponent
  // walks UP the parent chain so descendants (MenuItems, the inner scroll
  // container) inherit the truthy answer.
  override isMenuComponent(): boolean {
    return true;
  }

  // Whether hovering an item in this menu should auto-open its submenu.
  // Regular menus always do; MenuStrip narrows to "only when the strip
  // already has another menu open" so the bar isn't twitchy on first
  // mouse-over.
  shouldHoverOpenMenu(): boolean {
    return true;
  }

  // Hover handler wired by addItem. Fires when the pointer enters a child
  // MenuItem; we open its submenu (closing siblings first) when the host
  // menu wants hover-driven opens.
  onHoverItem(ctrl: Base | null): void {
    if (!this.shouldHoverOpenMenu()) return;
    if (!(ctrl instanceof MenuItem)) return;
    if (ctrl.isMenuOpen()) return;
    this.closeAll();
    if (ctrl.hasMenu()) ctrl.openMenu();
  }

  // Close-on-outside-click hook called by Canvas. Closes any open submenus
  // hosted by this menu's items, then hides the menu itself if visible.
  override closeMenus(): void {
    super.closeMenus();
    this.closeAll();
    if (this.isVisible()) this.close();
  }

  // =====================================================================
  // Configuration
  // =====================================================================

  setDisableIconMargin(b: boolean): void {
    this._disableIconMargin = b;
  }

  // Inverse alias — call setShowIconMargin(true) to reserve a 24px icon
  // gutter on the left side of every item, false to hide it. Equivalent
  // to setDisableIconMargin(!b) but reads more naturally at the call site.
  setShowIconMargin(b: boolean): void {
    this._disableIconMargin = !b;
  }

  isIconMarginDisabled(): boolean {
    return this._disableIconMargin;
  }

  isIconMarginVisible(): boolean {
    return !this._disableIconMargin;
  }

  setDeleteOnClose(b: boolean): void {
    this._deleteOnClose = b;
  }

  shouldDeleteOnClose(): boolean {
    return this._deleteOnClose;
  }

  // =====================================================================
  // Items
  // =====================================================================

  addItem(name: string, icon = '', accelerator = ''): MenuItem {
    const inner = this.getInnerPanel() ?? this;
    const item = new MenuItem(inner);
    // Match GWEN Menu.cpp:OnAddItem padding so the row's docked accelerator
    // sits at (item.right - 4) and the text room reserves a 24px icon
    // gutter via setTextPadding (independent of the item's own padding).
    item.setPadding(margin(2, 4, 4, 4));
    item.setText(name);
    if (icon) item.setImage(icon);
    if (accelerator) item.setAccelerator(accelerator);
    item.dock(Pos.Top);
    // Right text padding doubles as the gap between item text and the
    // docked accelerator/arrow. 12px keeps them visually separated even
    // when the menu's overall width is shrink-wrapped to its widest item.
    item.setTextPadding(margin(this._disableIconMargin ? 0 : 24, 0, 12, 0));
    item.setAlignment(Pos.CenterV | Pos.Left);
    item.sizeToContents();
    item.onHoverEnter.on((e) => this.onHoverItem(e.controlCaller as Base | null));
    this.invalidate();
    return item;
  }

  addDivider(): MenuDivider {
    const inner = this.getInnerPanel() ?? this;
    const d = new MenuDivider(inner);
    d.dock(Pos.Top);
    d.setMargin(margin(this._disableIconMargin ? 0 : 24, 0, 4, 0));
    return d;
  }

  clearItems(): void {
    const inner = this.getInnerPanel();
    if (inner) inner.removeAllChildren();
    this.invalidate();
  }

  // =====================================================================
  // Open / close
  // =====================================================================

  open(pos?: Point): void {
    this.show();
    this.bringToFront();
    const canvas = this.getCanvas() as Canvas | null;
    const p = pos ?? canvas?.mousePosition ?? point(0, 0);
    this.setPos(p.x, p.y);
  }

  close(): void {
    this.hide();
    const info = eventInfo();
    info.controlCaller = this;
    this.onMenuClosed.emit(info);
    if (this._deleteOnClose) {
      const canvas = this.getCanvas() as Canvas | null;
      if (canvas && typeof canvas.addDelayedDelete === 'function') {
        canvas.addDelayedDelete(this);
      }
    }
  }

  // Closes every open submenu reachable through child items (not this
  // menu itself — matches GWEN Menu::CloseAll, Menu.cpp:100). Hovering a
  // sibling item inside a popup must NOT hide the popup; only the popup's
  // own `close()` does that.
  closeAll(): void {
    const inner = this.getInnerPanel();
    if (!inner) return;
    for (const c of inner.children) {
      if (c instanceof MenuItem) c.closeMenu();
    }
  }

  // True when any of this menu's items has its submenu open. Mirrors GWEN
  // Menu::IsMenuOpen (Menu.cpp:113) — the strip relies on this returning
  // false when no dropdown is showing, so it can gate hover-driven opens.
  // The popup-visibility check used to live here but conflated "the popup
  // is showing" with "a child submenu is open" — wrong for the strip,
  // which is permanently visible.
  isMenuOpen(): boolean {
    const inner = this.getInnerPanel();
    if (!inner) return false;
    for (const c of inner.children) {
      if (c instanceof MenuItem && c.isMenuOpen()) return true;
    }
    return false;
  }

  // =====================================================================
  // Render
  // =====================================================================

  override render(skin: Skin): void {
    skin.drawMenu(this, this._disableIconMargin);
  }

  override renderUnder(skin: Skin): void {
    super.renderUnder(skin);
    skin.drawShadow(this);
  }

  // =====================================================================
  // Layout — match upstream by shrink-wrapping height to child sum,
  // clamped to the canvas bottom so long menus don't spill off-screen.
  // =====================================================================

  override layout(skin: Skin): void {
    // Width first: the shrink-wrap below needs items to report a real
    // height, and items get their final height from their own
    // sizeToContents which depends on their text metrics. Size the menu
    // wide enough for the widest item before the dock pass runs.
    this.sizeToContents();
    const inner = this.getInnerPanel();
    if (inner) {
      let h = 0;
      for (const c of inner.children) {
        if (!c.isVisible()) continue;
        h += c.height();
      }
      const canvas = this.getCanvas() as Canvas | null;
      if (canvas && this.y() + h > canvas.height()) {
        h = canvas.height() - this.y();
      }
      const pad = this.getPadding();
      this.setSize(this.width(), h + pad.top + pad.bottom);
    }
    super.layout(skin);
  }

  // GWEN's Menu::Layout walks items once to call each item's SizeToContents
  // and then picks the widest; LayoutSizeToContents (an auxiliary method)
  // does the menu-wide width pass. We fold both into one method — called
  // from layout above — so the visible width always tracks the longest
  // item's natural width. Minimum width of 100 matches upstream feel.
  //
  // ScrollControl.updateScrollBars sets the inner panel to the menu's full
  // viewport width (no vbar gutter when bars auto-hide and content fits),
  // so docked items end up exactly menu.width wide. Adding the menu's own
  // padding here is the only overhead the items don't already account for.
  sizeToContents(): void {
    const inner = this.getInnerPanel();
    if (!inner) return;
    let maxW = this._minimumWidth;
    for (const c of inner.children) {
      if (!c.isVisible()) continue;
      if (typeof (c as Base & { sizeToContents?: () => void }).sizeToContents === 'function') {
        (c as Base & { sizeToContents: () => void }).sizeToContents();
      }
      const w = c.width();
      if (w > maxW) maxW = w;
    }
    const pad = this.getPadding();
    const total = maxW + pad.left + pad.right;
    if (total !== this.width()) {
      this.setWidth(total);
    }
  }

  // Floor for sizeToContents — the menu can grow wider than this when
  // an item demands more space, but it won't shrink below it. ComboBox
  // sets this to its own width before opening the popup so the menu
  // is always at least as wide as the combo (matching the OS-native
  // behaviour); sub-menus and free-standing menus keep the default
  // 100px floor.
  setMinimumWidth(w: number): void {
    this._minimumWidth = Math.max(0, w);
    this.invalidate();
  }

  getMinimumWidth(): number {
    return this._minimumWidth;
  }
}

// ---------------------------------------------------------------------------
// MenuDivider — a 1px horizontal rule between menu items.
// ---------------------------------------------------------------------------

export class MenuDivider extends Base {
  constructor(parent: Base | null) {
    super(parent);
    this.setHeight(1);
  }

  override render(skin: Skin): void {
    skin.drawMenuDivider(this);
  }
}
