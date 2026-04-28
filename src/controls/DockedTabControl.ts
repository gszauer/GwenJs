// DockedTabControl — a TabControl variant that fills its parent and
// surfaces a TabTitleBar along the top when only a single tab is
// showing. Ports `Gwen::Controls::DockedTabControl` from
// include/Gwen/Controls/DockedTabControl.h +
// src/Controls/DockedTabControl.cpp.
//
// Behaviour:
//   * Docks `Pos.Fill` inside its parent (a window / layout slot).
//   * Enables tab-strip reordering out of the box.
//   * Hides the TabStrip when only zero or one tab exists and lets the
//     title bar stand in as the visual anchor.
//   * `moveTabsTo(target)` transplants every TabButton (and the page it
//     owns) to another DockedTabControl. Matches GWEN's equivalent,
//     which is used to merge or split docked panels.
//
// Deviations from GWEN:
//   * GWEN's title-bar drag-tears the entire TabControl into a floating
//     WindowControl; our `TabTitleBar` registers package "TabWindowMove"
//     and `DockBase.HandleDrop` reparents the tab set onto another
//     dock's edge instead. Tear-out into a free window would require
//     the WindowControl/DragAndDrop tear-out workflow which is not in
//     scope.
//   * Our port's `Signal.on()` disposer model doesn't support
//     "remove-by-handler-owner" the way GWEN's `RemoveHandler(ctrl)`
//     does. `moveTabsTo` therefore leaves stale onPress subscriptions
//     on the original TabControl attached; they no-op safely because
//     the moved page is no longer a child of the original inner panel.

import { TabControl } from './TabControl';
import { TabButton } from './TabButton';
import { TabTitleBar } from './TabTitleBar';
import { Pos } from '../core/Align';
import { eventInfo } from '../core/Events';
import { margin } from '../core/Structures';
import type { Base } from './Base';
import type { Skin } from '../skin/Skin';

export class DockedTabControl extends TabControl {
  protected _titleBar: TabTitleBar;

  constructor(parent: Base | null) {
    super(parent);
    this.dock(Pos.Fill);
    this.setAllowReorder(true);

    this._titleBar = new TabTitleBar(this);
    this._titleBar.dock(Pos.Top);
    this._titleBar.hide();
  }

  // =====================================================================
  // Title-bar controls
  // =====================================================================

  setShowTitlebar(show: boolean): void {
    this._titleBar.setHidden(!show);
  }

  updateTitleBar(): void {
    const current = this.getCurrentButton();
    if (!current) return;
    this._titleBar.setText(current.getText());
    this._titleBar.sizeToContents();
  }

  // =====================================================================
  // Move tabs between docked panels
  //
  // Snapshot the strip's children before mutating — attaching a button
  // to `target` triggers parent changes that would otherwise invalidate
  // the live iterator.
  // =====================================================================

  moveTabsTo(target: DockedTabControl): void {
    const strip = this.getTabStrip();
    const snapshot = strip.children.slice();
    let moved = false;
    for (const c of snapshot) {
      if (c instanceof TabButton) {
        target.attachTabButton(c);
        moved = true;
      }
    }
    this.invalidate();
    // Tell our owning DockBase that we lost tabs so it runs its
    // redundancy/consolidation pass and hides the now-empty source dock.
    if (moved) {
      const info = eventInfo();
      info.controlCaller = this;
      this.onLoseTab.emit(info);
    }
  }

  // Reparent an existing TabButton into this control. Mirrors GWEN's
  // `TabControl::AddPage(TabButton*)` overload.
  protected attachTabButton(btn: TabButton): void {
    // Capture the source TabControl before the reparent — afterwards
    // `btn.getTabControl()` returns `this`. We need this so we can
    // invalidate the source explicitly: `invalidate()` only marks
    // self, so the button's reparent flagged the source's TabStrip
    // but left the source DockedTabControl clean — its layout() (the
    // one that hides the strip on tabCount <= 1) wouldn't re-run,
    // leaving a lone-tab strip visible after a split.
    const sourceTC = btn.getTabControl();
    const page = btn.getPage();
    const inner = this.getInnerPanel();
    if (page) {
      page.setParent(inner);
      page.setHidden(true);
      page.setMargin(margin(6, 6, 6, 6));
      page.dock(Pos.Fill);
    }
    btn.setParent(this.getTabStrip());
    btn.dock(Pos.Left);
    btn.sizeToContents();
    btn.setTabControl(this);
    // Wire press-handling to our onTabPressed. Prior subscriptions
    // pointing at the old TabControl are intentionally left attached
    // (see header comment).
    btn.onPress.on(() => this.handleTabPress(btn));

    // Select the incoming tab when there's no live selection. "Live"
    // means the cached `_currentButton` is still a child of OUR strip —
    // a stale ref left over from a tab that was moved away (or one being
    // re-attached now) is not live, so we still need to fire the press.
    const cur = this.getCurrentButton();
    if (!cur || cur.parent !== this.getTabStrip() || cur === btn) {
      this.handleTabPress(btn);
    }

    this.invalidate();
    if (sourceTC && sourceTC !== this) {
      // Same stale-current-button cleanup as DockBase.attachTabButtonTo:
      // if the source's current pointer is still the just-moved tab
      // (parent is no longer source's strip), press a remaining tab so
      // the source's title bar / page visibility track a live tab. For
      // moveTabsTo this loop empties the source entirely; the
      // consolidation pass after the loop hides it, so the stale ref
      // wouldn't visibly bite there — but mid-loop we briefly have
      // remaining tabs, and the source might be DockedTabControl whose
      // title bar shows during that window.
      if (sourceTC instanceof DockedTabControl) {
        const sourceCur = sourceTC.getCurrentButton();
        if (sourceCur && sourceCur.parent !== sourceTC.getTabStrip()) {
          const remaining = sourceTC.getTabStrip().children
            .filter((c): c is TabButton => c instanceof TabButton);
          if (remaining.length > 0) sourceTC.onTabPressedExt(remaining[0]);
        }
      }
      sourceTC.invalidate();
    }
  }

  // Thin wrapper around the protected onTabPressed for attachTabButton.
  protected handleTabPress(btn: TabButton): void {
    // onTabPressed is protected; TypeScript allows in-class access.
    this.onTabPressed(btn);
  }

  // Public escape hatch so DockBase.attachTabButtonTo can drive tab
  // selection on this control without breaking encapsulation. Internal
  // callers should still prefer `handleTabPress`.
  onTabPressedExt(btn: TabButton): void {
    this.handleTabPress(btn);
  }

  // =====================================================================
  // Layout hook
  //
  // Hide the tab strip when there's only one tab — the title bar
  // (when visible) takes over that visual role. Keep the strip visible
  // when there are two or more tabs so the user can pick.
  // =====================================================================

  override layout(skin: Skin): void {
    const strip = this.getTabStrip();
    strip.setHidden(this.tabCount() <= 1);
    super.layout(skin);
    this.updateTitleBar();
  }
}
