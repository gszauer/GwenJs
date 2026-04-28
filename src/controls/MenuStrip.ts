// MenuStrip — horizontal menu bar that hosts top-level MenuItems whose
// submenus drop downward. Ports `Gwen::Controls::MenuStrip` from
// include/Gwen/Controls/MenuStrip.h + src/Controls/MenuStrip.cpp.
//
// Composition:
//   * Extends Menu — reuses item construction + close-all plumbing.
//   * Layout suppressed (`layout` is a no-op): Menu's vertical shrink-wrap
//     would collapse the strip's height to 0; the strip is sized once in
//     the constructor and stays that way.
//   * `close()` is a no-op: a strip persists across submenu open/close
//     cycles. Only the submenus opened from its items fire close events.
//   * `renderUnder` is a no-op: no drop shadow under the strip.
//
// Items added via `addItem` dock Left so the strip flows horizontally,
// flagged `setOnStrip(true)` so MenuItem positions its submenu downward
// (vs. to the right for nested submenus).
//
// Deviations from GWEN: none material — the strip is a thin layer on top
// of Menu and the only behavioural change is the suppressed layout/close.

import { Menu } from './Menu';
import { MenuItem } from './MenuItem';
import { Pos } from '../core/Align';
import { margin } from '../core/Structures';
import type { Skin } from '../skin/Skin';
import type { Base } from './Base';

export class MenuStrip extends Menu {
  constructor(parent: Base | null) {
    super(parent);
    this.setBounds(0, 0, 200, 22);
    this.dock(Pos.Top);
    this.setPadding(margin(5, 0, 0, 0));
    this.setDisableIconMargin(true);
    // Strip is always visible; Menu's constructor calls hide().
    this.show();
    // ScrollControl (Menu's base) creates H + V scrollbars. `layout()` is a
    // no-op on the strip, so `updateScrollBars` never runs to hide them —
    // hide them here explicitly.
    this.setScroll(false, false);
    this.getVerticalScrollBar().hide();
    this.getHorizontalScrollBar().hide();
  }

  override addItem(name: string, icon = '', accelerator = ''): MenuItem {
    const item = new MenuItem(this.getInnerPanel() ?? this);
    item.setText(name);
    if (icon) item.setImage(icon);
    if (accelerator) item.setAccelerator(accelerator);
    item.dock(Pos.Left);
    item.setPadding(margin(10, 0, 10, 0));
    item.setTextPadding(margin(5, 0, 5, 0));
    item.setOnStrip(true);
    item.sizeToContents();
    // Hover-driven submenu switching when the strip already has a menu open
    // (Windows-style menu bar behavior — see ShouldHoverOpenMenu override).
    item.onHoverEnter.on((e) => this.onHoverItem(e.controlCaller as Base | null));
    return item;
  }

  // Only auto-open submenus on hover when ANOTHER strip menu is already
  // open. First-time interaction still requires a click; once committed,
  // moving the mouse across the strip swaps which submenu is visible.
  // Matches GWEN MenuStrip::ShouldHoverOpenMenu (MenuStrip.cpp:42).
  override shouldHoverOpenMenu(): boolean {
    return this.isMenuOpen();
  }

  override close(): void {
    // Strip itself doesn't close; only its submenus do.
  }

  override closeMenus(): void {
    // Strip is always present — recurse into items so their submenus
    // close, but never hide the strip itself.
    const inner = this.getInnerPanel();
    if (inner) {
      for (const c of inner.children) {
        if (c instanceof MenuItem) c.closeMenu();
      }
    }
  }

  override layout(_skin: Skin): void {
    // Suppress Menu's vertical shrink-wrap (would collapse the strip to 0
    // because strip items dock Left, not Top — nothing contributes to the
    // vertical sum). Still run ScrollControl's inner-panel sizing so the
    // strip's docked children get the strip's full height to lay against.
    this.updateScrollBars();
  }

  override render(skin: Skin): void {
    skin.drawMenuStrip(this);
  }

  override renderUnder(_skin: Skin): void {
    // No shadow under the strip.
  }
}
