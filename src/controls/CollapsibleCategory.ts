// CollapsibleCategory — a labelled group of selectable rows with a
// collapsible header. Ports `Gwen::Controls::CollapsibleCategory` from
// include/Gwen/Controls/CategoryList.h + src/Controls/CategoryList.cpp.
//
// Composition:
//   * Header Button (toggle) — clicking collapses / expands the category.
//   * CategoryButtons       — the individual selectable rows, docked top,
//                             alternating colour, mutually exclusive.
//
// The owning CollapsibleList (future task) is kept at arm's length via
// a back-reference; today the category works standalone.

import { Base } from './Base';
import { Button } from './Button';
import { Signal, eventInfo, type EventInfo } from '../core/Events';
import { Pos } from '../core/Align';
import { margin } from '../core/Structures';
import type { Skin } from '../skin/Skin';

// ---------------------------------------------------------------------------
// CategoryButton — a single row inside a CollapsibleCategory. Carries an
// "alternate" flag so the category can stripe even/odd rows.
// ---------------------------------------------------------------------------

class CategoryButton extends Button {
  protected _alt = false;

  setAlt(b: boolean): void {
    this._alt = b;
  }

  isAlt(): boolean {
    return this._alt;
  }

  override render(skin: Skin): void {
    // Only paint a background when selected or hovered — the category's
    // own panel supplies the unselected row fill. This mirrors GWEN's
    // CategoryButton::Render which short-circuits on inactive state.
    if (this.getToggleState() || this.isHovered()) {
      super.render(skin);
    }
  }
}

// ---------------------------------------------------------------------------
// CollapsibleCategory
// ---------------------------------------------------------------------------

// Disclosure chevrons. Prepended to the header label so the
// expand/collapse state reads at a glance — modernises the look
// vs. GWEN's plain centered "Category Title".
const CHEVRON_DOWN = '▼';
const CHEVRON_RIGHT = '▶';

export class CollapsibleCategory extends Base {
  readonly onSelection = new Signal<EventInfo>();

  protected _headerButton: Button;
  // Caller-supplied title, stored separately so we can keep the
  // chevron prefix in sync without losing it on `setText`.
  protected _title = 'Category Title';

  constructor(parent: Base | null) {
    super(parent);
    this.setBounds(0, 0, 512, 20);
    this.setPadding(margin(1, 0, 1, 5));

    this._headerButton = new Button(this);
    this._headerButton.dock(Pos.Top);
    this._headerButton.setHeight(20);
    this._headerButton.setIsToggle(true);
    this._headerButton.setShouldDrawBackground(false);
    this._headerButton.setAlignment(Pos.Left | Pos.CenterV);
    // 6px left padding so the chevron breathes off the panel edge.
    this._headerButton.setPadding(margin(6, 0, 0, 0));
    this._headerButton.onPress.on(() => {
      this.updateHeaderText();
      this.invalidate();
    });
    this.updateHeaderText();
  }

  // =====================================================================
  // Config
  // =====================================================================

  setText(t: string): void {
    this._title = t;
    this.updateHeaderText();
  }

  getText(): string {
    return this._title;
  }

  // Keep the header button's label in sync with the title + current
  // collapse state. Called from setText and from the toggle handler.
  protected updateHeaderText(): void {
    const chevron = this._headerButton.getToggleState() ? CHEVRON_RIGHT : CHEVRON_DOWN;
    this._headerButton.setText(`${chevron}  ${this._title}`);
  }

  // =====================================================================
  // Rows
  // =====================================================================

  add(name: string): Button {
    const b = new CategoryButton(this);
    b.setText(name);
    b.dock(Pos.Top);
    b.setAlignment(Pos.Left | Pos.CenterV);
    b.setIsToggle(true);
    b.setTabable(false);
    b.setPadding(margin(5, 2, 2, 2));
    b.onPress.on(() => this.onItemPress(b));
    return b;
  }

  unselectAll(): void {
    for (const c of this.children) {
      if (c instanceof CategoryButton) c.setToggleState(false);
    }
  }

  getSelected(): Button | null {
    for (const c of this.children) {
      if (c instanceof CategoryButton && c.getToggleState()) return c;
    }
    return null;
  }

  // =====================================================================
  // Collapse state
  // =====================================================================

  isCollapsed(): boolean {
    return this._headerButton.getToggleState();
  }

  // =====================================================================
  // Internal
  // =====================================================================

  protected onItemPress(b: CategoryButton): void {
    this.unselectAll();
    b.setToggleState(true);
    const info = eventInfo();
    info.controlCaller = this;
    this.onSelection.emit(info);
  }

  override postLayout(skin: Skin): void {
    super.postLayout(skin);

    if (this._headerButton.getToggleState()) {
      // Collapsed — shrink the whole category to header height.
      this.setHeight(this._headerButton.height());
    } else {
      let total = this._headerButton.height();
      for (const c of this.children) {
        if (c instanceof CategoryButton && !c.hidden()) total += c.height();
      }
      const pad = this.getPadding();
      this.setHeight(total + pad.top + pad.bottom);
    }

    // Stripe alternate rows. Match GWEN's stable even/odd assignment —
    // the first row is "alt=false", flip per row thereafter.
    let alt = false;
    for (const c of this.children) {
      if (c instanceof CategoryButton) {
        c.setAlt(alt);
        alt = !alt;
      }
    }
  }

  override render(skin: Skin): void {
    skin.drawCategoryInner(this, this._headerButton.getToggleState());
  }
}
