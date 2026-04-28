// MenuItem — a single row inside a Menu. Ports
// `Gwen::Controls::MenuItem` from include/Gwen/Controls/MenuItem.h +
// src/Controls/MenuItem.cpp.
//
// MenuItem extends Button: the click/hover/focus plumbing comes from
// Button, but the item-specific behaviour (lazy submenu, checkable
// state, accelerator label, strip-vs-submenu positioning) lives here.
//
// Deviations from GWEN:
//   * GWEN's `OnPress` override closes menus via `GetCanvas()->CloseMenus()`
//     which walks the control tree for menu-components. MVP in TS walks
//     the direct parent chain instead and closes each Menu ancestor's
//     siblings via `closeAll()`. Same outcome for the common tree shape.
//   * The right-arrow glyph for submenu items is rendered directly via
//     `skin.drawMenuRightArrow` on a small docked Base — upstream uses a
//     dedicated `RightArrow` subclass whose only job is to call that draw
//     method, so an inline Base with a render override is equivalent.

import { Button } from './Button';
import { Menu } from './Menu';
import { Label } from './Label';
import { Base } from './Base';
import { Signal, eventInfo, type EventInfo } from '../core/Events';
import { Pos } from '../core/Align';
import { margin } from '../core/Structures';
import type { Skin } from '../skin/Skin';
import type { Canvas } from './Canvas';

// Tiny decorative child — a skin-drawn right-pointing arrow that marks
// an item as having a submenu. Matches GWEN's private `RightArrow` class.
class RightArrow extends Base {
  constructor(parent: Base | null) {
    super(parent);
    this.setMouseInputEnabled(false);
  }
  override render(skin: Skin): void {
    skin.drawMenuRightArrow(this);
  }
}

export class MenuItem extends Button {
  readonly onMenuItemSelected = new Signal<EventInfo>();
  readonly onChecked = new Signal<EventInfo>();
  readonly onUnChecked = new Signal<EventInfo>();
  readonly onCheckChange = new Signal<EventInfo>();

  protected _menu: Menu | null = null;
  protected _checkable = false;
  protected _checked = false;
  protected _onStrip = false;
  protected _accelerator: Label | null = null;
  protected _acceleratorText = '';
  protected _submenuArrow: RightArrow | null = null;

  constructor(parent: Base | null) {
    super(parent);
    // Padding is applied per-host (Menu uses (2, 4, 4, 4); MenuStrip uses
    // (10, 0, 10, 0)). Constructor only sets a sane default height so an
    // un-hosted item still renders.
    this.setHeight(22);
    this.setShouldDrawBackground(false);
    this.setTabable(false);
    this.setAlignment(Pos.CenterV | Pos.Left);
  }

  // Includes accelerator + submenu-arrow widths so the host menu's
  // shrink-wrap can reserve space for the right-aligned controls. Matches
  // GWEN MenuItem::SizeToContents (MenuItem.cpp:181).
  override sizeToContents(): void {
    super.sizeToContents();
    if (this._accelerator) {
      this._accelerator.sizeToContents();
      this.setWidth(this.width() + this._accelerator.width());
    }
    if (this._submenuArrow) {
      this.setWidth(this.width() + this._submenuArrow.width());
    }
  }

  // ComboBox / MenuItem own the menu they pop up. Canvas's outside-click
  // close-menus walk skips controls that own a visible menu so a click on
  // the owner reaches its own toggle handler.
  override ownsOpenMenu(): boolean {
    return this._menu !== null && this._menu.isVisible();
  }

  // =====================================================================
  // Checkable state
  // =====================================================================

  isCheckable(): boolean {
    return this._checkable;
  }

  setCheckable(b: boolean): void {
    this._checkable = b;
  }

  isChecked(): boolean {
    return this._checked;
  }

  setChecked(b: boolean): void {
    if (b === this._checked) return;
    this._checked = b;
    const info = eventInfo();
    info.controlCaller = this;
    this.onCheckChange.emit(info);
    if (b) this.onChecked.emit(info);
    else this.onUnChecked.emit(info);
    this.redraw();
  }

  toggleChecked(): void {
    this.setChecked(!this._checked);
  }

  // =====================================================================
  // Strip / submenu
  // =====================================================================

  setOnStrip(b: boolean): void {
    this._onStrip = b;
  }

  isOnStrip(): boolean {
    return this._onStrip;
  }

  hasMenu(): boolean {
    return this._menu !== null;
  }

  // Lazy submenu construction — GWEN creates the Menu on first access so
  // leaf items don't pay the allocation cost. We parent the submenu to the
  // canvas so it can float on top of its owning menu's clip region.
  getMenu(): Menu {
    if (!this._menu) {
      const canvas = this.getCanvas() as Canvas | null;
      this._menu = new Menu(canvas ?? null);
      this._menu.hide();
      if (!this._onStrip) {
        this._submenuArrow = new RightArrow(this);
        this._submenuArrow.setSize(15, 15);
        this._submenuArrow.dock(Pos.Right);
      }
      this.invalidate();
    }
    return this._menu;
  }

  isMenuOpen(): boolean {
    return this._menu !== null && this._menu.isVisible();
  }

  openMenu(): void {
    if (!this._menu) return;
    // Strip items act as a menu bar — only one strip dropdown open at a
    // time. Close sibling strip items' menus before showing our own.
    if (this._onStrip && this.parent) {
      for (const sibling of this.parent.children) {
        if (sibling === this) continue;
        if (sibling instanceof MenuItem && sibling.isOnStrip() && sibling.isMenuOpen()) {
          sibling.closeMenu();
        }
      }
    }
    this._menu.show();
    this._menu.bringToFront();
    // Strip items open downward; submenus open to the right.
    const basePos = this.localPosToCanvas({ x: 0, y: 0 });
    if (this._onStrip) {
      this._menu.setPos(basePos.x, basePos.y + this.height() + 1);
    } else {
      this._menu.setPos(basePos.x + this.width(), basePos.y);
    }
  }

  closeMenu(): void {
    if (!this._menu) return;
    // Hide the popup AND close any cascading submenus underneath it.
    // Matches GWEN MenuItem::CloseMenu (MenuItem.cpp:154).
    this._menu.close();
    this._menu.closeAll();
  }

  toggleMenu(): void {
    if (this.isMenuOpen()) this.closeMenu();
    else this.openMenu();
  }

  // =====================================================================
  // Accelerator label
  // =====================================================================

  setAccelerator(text: string): void {
    if (this._accelerator) {
      if (this._acceleratorText) this.removeAccelerator(this._acceleratorText);
      this._accelerator.dispose();
      this._accelerator = null;
      this._acceleratorText = '';
    }
    if (!text) return;
    this._accelerator = new Label(this);
    this._accelerator.dock(Pos.Right);
    this._accelerator.setAlignment(Pos.Right | Pos.CenterV);
    this._accelerator.setMargin(margin(0, 0, 4, 0));
    this._accelerator.setText(text);
    // Register the binding so Canvas.inputAccelerator can route Ctrl+N
    // (etc.) straight to this item. Routes through `acceleratePressed`
    // which fires onPress + onMenuItemSelected without any input gating.
    this.addAccelerator(text, () => this.acceleratePressed());
    this._acceleratorText = text;
  }

  // Fires the press signal *and* closes any open menus, so a Ctrl+N
  // shortcut behaves like a click on the item — onPress fires, the
  // selected event fires, and any menus that were tucking the item
  // disappear. Overrides Button.acceleratePressed.
  override acceleratePressed(): void {
    super.acceleratePressed();
    this.onPressItem();
  }

  // =====================================================================
  // Mouse — extend Button's left-click with submenu / close-menus logic.
  // =====================================================================

  override onMouseClickLeft(x: number, y: number, pressed: boolean): void {
    const wasDepressed = this.isDepressed();
    super.onMouseClickLeft(x, y, pressed);
    if (pressed) return;
    if (!wasDepressed) return;
    if (!this.isHovered()) return;
    this.onPressItem();
  }

  // Press handler — GWEN spells this `OnPress`; in the TS port we keep
  // Button's `onPress` signal semantics intact and do the item-specific
  // work in `onPressItem` invoked from the mouse-up branch above.
  protected onPressItem(): void {
    if (this.hasMenu()) {
      this.toggleMenu();
      return;
    }
    if (!this._onStrip) {
      if (this._checkable) this.toggleChecked();
      const info = eventInfo();
      info.controlCaller = this;
      this.onMenuItemSelected.emit(info);
      // Selecting a leaf item closes every open menu in this canvas tree.
      // Mirrors GWEN MenuItem.cpp:111's `GetCanvas()->CloseMenus()` call.
      const canvas = this.getCanvas() as Base | null;
      if (canvas) canvas.closeMenus();
    }
  }

  // =====================================================================
  // Render
  // =====================================================================

  override render(skin: Skin): void {
    skin.drawMenuItem(this, this.isMenuOpen(), this._checkable && this._checked);
    // Upstream TextColorOverride hack — keep the accelerator's text colour
    // matched to ours when hovered / checked.
    if (this._accelerator) {
      this._accelerator.setTextColorOverride(this.textColor());
    }
  }
}
