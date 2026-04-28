// CollapsibleList — a vertical scrolling stack of CollapsibleCategory
// panels with cross-category single-selection. Ports
// `Gwen::Controls::CategoryList` from include/Gwen/Controls/CategoryList.h
// + src/Controls/CategoryList.cpp.
//
// Composition:
//   * Extends ScrollControl — long category lists scroll vertically.
//     `setScroll(false, true)` disables the horizontal bar;
//     `setAutoHideBars(true)` keeps the bar hidden when content fits.
//   * Each `add()` creates a `CollapsibleCategory` docked Top inside the
//     scroll viewport's inner panel. The category's own `onSelection`
//     signal bubbles up; we then unselect every other category so only
//     one row across the whole list is highlighted at a time.
//
// Deviations from GWEN: none material — the behaviour mirrors upstream's
// CategoryList::OnCategorySelected exactly.

import { ScrollControl } from './ScrollControl';
import { CollapsibleCategory } from './CollapsibleCategory';
import { Button } from './Button';
import { Signal, type EventInfo } from '../core/Events';
import { Pos } from '../core/Align';
import { margin } from '../core/Structures';
import type { Skin } from '../skin/Skin';
import type { Base } from './Base';

export class CollapsibleList extends ScrollControl {
  readonly onSelection = new Signal<EventInfo>();

  constructor(parent: Base | null) {
    super(parent);
    this.setAutoHideBars(true);
    this.setScroll(false, true);
    this.setMargin(margin(1, 0, 1, 1));
  }

  // =====================================================================
  // Categories
  // =====================================================================

  add(name: string): CollapsibleCategory {
    const cat = new CollapsibleCategory(this.getInnerPanel() ?? this);
    cat.setText(name);
    cat.dock(Pos.Top);
    cat.onSelection.on((e) => this.onCategorySelection(e));
    return cat;
  }

  // =====================================================================
  // Selection
  // =====================================================================

  unselectAll(): void {
    const inner = this.getInnerPanel();
    if (!inner) return;
    for (const c of inner.children) {
      if (c instanceof CollapsibleCategory) c.unselectAll();
    }
  }

  getSelected(): Button | null {
    const inner = this.getInnerPanel();
    if (!inner) return null;
    for (const c of inner.children) {
      if (c instanceof CollapsibleCategory) {
        const s = c.getSelected();
        if (s) return s;
      }
    }
    return null;
  }

  // =====================================================================
  // Internal — fired by each category when one of its rows is picked.
  // We unselect every OTHER category so cross-list selection stays
  // exclusive, then re-emit the event to our own subscribers.
  // =====================================================================

  protected onCategorySelection(e: EventInfo): void {
    const source = e.controlCaller;
    const inner = this.getInnerPanel();
    if (!inner) return;
    for (const c of inner.children) {
      if (c instanceof CollapsibleCategory && c !== source) {
        c.unselectAll();
      }
    }
    this.onSelection.emit(e);
  }

  // =====================================================================
  // Render
  // =====================================================================

  override render(skin: Skin): void {
    skin.drawCategoryHolder(this);
  }
}
