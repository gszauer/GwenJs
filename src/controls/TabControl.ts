// TabControl — a tabbed container: a TabStrip of TabButtons on one edge
// + a filling inner panel that swaps child pages as the user clicks
// tabs. Ports `Gwen::Controls::TabControl` from
// include/Gwen/Controls/TabControl.h + src/Controls/TabControl.cpp.
//
// Composition:
//   * TabStrip  — docked Top by default (setTabStripPosition to move).
//   * Inner Base — docked Fill; hosts the page Base for each tab.
//
// Each tab is represented by a TabButton (inside the strip) + a page
// Base (inside the inner panel). Only the active tab's page is visible.

import { Base } from './Base';
import { TabButton } from './TabButton';
import { TabStrip } from './TabStrip';
import { Signal, eventInfo, type EventInfo } from '../core/Events';
import { Pos } from '../core/Align';
import { margin, rect } from '../core/Structures';
import type { Skin } from '../skin/Skin';

// ---------------------------------------------------------------------------
// TabControlInner — render-only subclass of Base that draws the tab
// content panel's bordered frame. Private — callers never reach it.
// ---------------------------------------------------------------------------

class TabControlInner extends Base {
  override render(skin: Skin): void {
    skin.drawTabControl(this);
  }
}

// ---------------------------------------------------------------------------
// TabControl
// ---------------------------------------------------------------------------

export class TabControl extends Base {
  readonly onLoseTab = new Signal<EventInfo>();
  readonly onAddTab = new Signal<EventInfo>();

  protected _tabStrip: TabStrip;
  protected _inner: TabControlInner;
  protected _currentButton: TabButton | null = null;

  constructor(parent: Base | null) {
    super(parent);

    this._tabStrip = new TabStrip(this);
    this._tabStrip.dock(Pos.Top);
    this._tabStrip.setHeight(24);

    this._inner = new TabControlInner(this);
    this._inner.dock(Pos.Fill);

    // The control itself is the tab stop; Left/Right switch tabs and the
    // focus ring is drawn around the active TabButton (see renderFocus).
    this.setTabable(true);
    this.setKeyboardInputEnabled(true);
  }

  // =====================================================================
  // Page management
  // =====================================================================

  addPage(text: string, page?: Base): TabButton {
    const pageControl = page ?? new Base(this._inner);
    pageControl.setParent(this._inner);
    // 6px inset matches GWEN's TabControl::AddPage and stays consistent
    // with attachTabButton (the reparent path used by drag-to-dock). Without
    // it the page snaps tight against the bordered frame on first add and
    // then jumps to a 6px inset the moment the tab is re-docked elsewhere.
    pageControl.setMargin(margin(6, 6, 6, 6));
    pageControl.dock(Pos.Fill);
    pageControl.hide();
    // Each page is its own tab-nav scope: Tab inside the active page
    // cycles only within that page's controls. Without this, focus
    // would walk through hidden pages' controls (they're filtered out
    // of `tabList` via `_hidden`, but inactive pages briefly become
    // visible during a tab swap and that opens a leak window).
    pageControl.setTabBoundary(true);

    const btn = new TabButton(this._tabStrip);
    btn.setText(text);
    btn.setPage(pageControl);
    btn.setTabControl(this);
    btn.onPress.on(() => this.onTabPressed(btn));

    if (!this._currentButton) this.onTabPressed(btn);

    const info = eventInfo();
    info.controlCaller = this;
    this.onAddTab.emit(info);
    return btn;
  }

  removePage(btn: TabButton): void {
    const page = btn.getPage();
    if (page) page.setParent(null);
    btn.setParent(null);
    if (this._currentButton === btn) this._currentButton = null;
    const info = eventInfo();
    info.controlCaller = this;
    this.onLoseTab.emit(info);
    this.invalidate();
  }

  // =====================================================================
  // Queries
  // =====================================================================

  getTab(i: number): TabButton | null {
    const tabs = this._tabStrip.children.filter((c): c is TabButton => c instanceof TabButton);
    return tabs[i] ?? null;
  }

  tabCount(): number {
    let n = 0;
    for (const c of this._tabStrip.children) if (c instanceof TabButton) n++;
    return n;
  }

  getCurrentButton(): TabButton | null {
    return this._currentButton;
  }

  getTabStrip(): TabStrip {
    return this._tabStrip;
  }

  getInnerPanel(): Base {
    return this._inner;
  }

  // =====================================================================
  // Strip placement + reorder flag
  // =====================================================================

  setTabStripPosition(dock: number): void {
    this._tabStrip.dock(dock);
    // Each TabButton reports its dock edge so the skin can pick the
    // correct Active/Inactive region. When the strip itself flips
    // orientation, the buttons need to flip too.
    for (const c of this._tabStrip.children) {
      if (c instanceof TabButton) c.setTabDock(dock);
    }
  }

  setAllowReorder(b: boolean): void {
    this._tabStrip.setAllowReorder(b);
  }

  allowReorder(): boolean {
    return this._tabStrip.allowReorder();
  }

  // =====================================================================
  // Internal
  // =====================================================================

  // =====================================================================
  // Keyboard nav — Left/Right (and Up/Down for vertical strips, since
  // arrow expectations track the strip's orientation) cycle tabs.
  // Home/End jump to the first/last tab.
  // =====================================================================

  override onKeyLeft(down: boolean): boolean {
    if (down) this.moveTab(-1);
    return true;
  }

  override onKeyRight(down: boolean): boolean {
    if (down) this.moveTab(1);
    return true;
  }

  override onKeyUp(down: boolean): boolean {
    if (down) this.moveTab(-1);
    return true;
  }

  override onKeyDown(down: boolean): boolean {
    if (down) this.moveTab(1);
    return true;
  }

  override onKeyHome(down: boolean): boolean {
    if (down) {
      const t = this.getTab(0);
      if (t) this.onTabPressed(t);
    }
    return true;
  }

  override onKeyEnd(down: boolean): boolean {
    if (down) {
      const t = this.getTab(this.tabCount() - 1);
      if (t) this.onTabPressed(t);
    }
    return true;
  }

  private getTabs(): TabButton[] {
    return this._tabStrip.children.filter((c): c is TabButton => c instanceof TabButton);
  }

  private moveTab(delta: number): void {
    const tabs = this.getTabs();
    if (tabs.length === 0) return;
    const cur = this._currentButton;
    const idx = cur ? tabs.indexOf(cur) : -1;
    const n = tabs.length;
    const next = idx === -1 ? 0 : (idx + delta + n) % n;
    this.onTabPressed(tabs[next]);
  }

  // Render the focus ring around the active tab rather than the whole
  // control — the user reads "the active tab is selected" from the ring,
  // not "the entire tab control area is selected". TabButton coords are
  // local to its TabStrip parent, so we translate up into TabControl's
  // own frame before drawing.
  override renderFocus(skin: Skin): void {
    const canvas = this.getCanvas();
    if (!canvas || canvas.keyboardFocus !== this) return;
    if (!this.isTabable()) return;
    const btn = this._currentButton;
    if (!btn) return;
    const x = this._tabStrip.x() + btn.x();
    const y = this._tabStrip.y() + btn.y();
    skin.drawKeyboardHighlight(this, rect(x, y, btn.width(), btn.height()), 0);
  }

  protected onTabPressed(btn: TabButton): void {
    const page = btn.getPage();
    if (!page) return;
    if (this._currentButton && this._currentButton !== btn) {
      const oldPage = this._currentButton.getPage();
      if (oldPage) oldPage.hide();
    }
    page.show();
    this._currentButton = btn;
    this.invalidate();
  }
}
