// DockedTabControl — a TabControl variant that fills its parent and
// uses its tab strip *as* the window title bar. Ports
// `Gwen::Controls::DockedTabControl` from
// include/Gwen/Controls/DockedTabControl.h +
// src/Controls/DockedTabControl.cpp, with a UX modernization:
//
// Layout (vs. the original GWEN port):
//   * The tab strip is docked **Top** and renders the Tab.HeaderBar
//     skin region as its background — visually it *is* the title bar.
//   * Tab buttons sit inside the strip flush against the top edge,
//     macOS / VS Code style. Dragging empty (non-button) area on the
//     strip moves the whole dock (`TabWindowMove`).
//   * The dedicated `TabTitleBar` child is gone; the strip absorbs its
//     visual + drag-handle role.
//
// Behaviour:
//   * Docks `Pos.Fill` inside its parent (a window / layout slot).
//   * Tab-strip reordering is enabled by default.
//   * `moveTabsTo(target)` transplants every TabButton (and the page it
//     owns) to another DockedTabControl, preserving the source's
//     current selection so the visible tab survives a whole-dock drag.
//
// Deviations from GWEN:
//   * Upstream's title bar is a separate Top-docked Label that drag-tears
//     the TabControl into a floating WindowControl. We instead treat the
//     strip itself as the drag source (matching the modern web/IDE feel)
//     and our `DockBase.HandleDrop` reparents the tab set onto another
//     dock's edge instead of producing a free-floating window.
//   * Our port's `Signal.on()` disposer model doesn't support
//     "remove-by-handler-owner" the way GWEN's `RemoveHandler(ctrl)`
//     does. `moveTabsTo` therefore leaves stale onPress subscriptions
//     on the original TabControl; `TabControl.onTabPressed` short-
//     circuits when the pressed button is no longer parented to its
//     strip, so stale subscriptions are harmless.

import { TabControl } from './TabControl';
import { TabButton } from './TabButton';
import { Pos } from '../core/Align';
import { eventInfo } from '../core/Events';
import { margin } from '../core/Structures';
import type { Base } from './Base';

export class DockedTabControl extends TabControl {
  constructor(parent: Base | null) {
    super(parent);
    this.dock(Pos.Fill);
    this.setAllowReorder(true);

    // Promote the strip to "title bar with embedded tabs" mode:
    // header-bar background + whole-dock drag on empty area.
    const strip = this.getTabStrip();
    strip.setHeight(24);
    strip.setShowAsHeader(true);
    strip.setDockDragControl(this);
  }

  // =====================================================================
  // Legacy title-bar shims
  //
  // The dedicated TabTitleBar is gone — its role is played by the strip.
  // These methods are kept as no-ops so older callers (and any code
  // still wiring `setShowTitlebar(true)` from before the refactor)
  // don't error out. New code should configure the strip directly.
  // =====================================================================

  setShowTitlebar(_show: boolean): void {
    /* strip is the title bar; toggling this is a no-op now. */
  }

  updateTitleBar(): void {
    /* tab buttons render their own labels; nothing to update. */
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
    // Capture the source's current selection before the move scrambles
    // it — we want the user's currently-visible tab to remain visible
    // after the whole-dock drag completes.
    const wasCurrent = this.getCurrentButton();
    let moved = false;
    for (const c of snapshot) {
      if (c instanceof TabButton) {
        target.attachTabButton(c);
        moved = true;
      }
    }
    this.invalidate();
    if (moved) {
      // Promote the source's previous current selection in the target.
      // attachTabButton's per-tab loop only auto-selects when target
      // has no live current; with multiple tabs the first one wins,
      // so the original current would land inactive.
      if (wasCurrent && wasCurrent.parent === target.getTabStrip()) {
        target.onTabPressedExt(wasCurrent);
      }
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

    // Always press the incoming tab. The user's drag-and-drop intent is
    // "show this tab here" — leaving it inactive when the target had a
    // pre-existing current button hides the just-dragged page until the
    // user clicks the new tab manually, which feels broken. moveTabsTo
    // (whole-dock drag) compensates afterwards by re-pressing the
    // source's original current, so the multi-tab move still preserves
    // the user's selection.
    this.handleTabPress(btn);

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
}
