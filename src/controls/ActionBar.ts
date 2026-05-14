// ActionBar — flexible toolbar for icon buttons, dropdowns, and other
// quick-action items. Designed for two common roles:
//
//   * **Horizontal "quick action" bar** (default) — sits on top of a
//     view (e.g. above a 3D viewport, or as a Word-style Bold/Italic
//     row). Items dock Left.
//   * **Vertical "tool palette"** — Photoshop-style side strip of
//     icon-only tools. Items dock Top. Multi-column variants
//     (`setColumns(2)`) lay items out in a grid for tighter screens.
//
// Children: any `Base`. The `addButton(text, icon?)` /
// `addSeparator()` / `addItem(ctrl)` helpers cover the common cases.
// The bar reuses `Skin.drawMenuStrip` for its background so it shares
// the visual language of the menu / status bars elsewhere in the app.
//
// Sizing model: the bar's perpendicular dimension (height in horizontal
// mode, width in vertical mode) is locked to `itemSize * cols + padding * 2`.
// The other dimension is caller-controlled — usually full width via
// `dock(Pos.Top)` or full height via `dock(Pos.Left)`. Items are
// `itemSize × itemSize` squares; the dock pass stretches them across
// the perpendicular axis automatically (single-column mode), or the
// custom `layout()` positions them in a grid (multi-column mode).
//
// Radio mode: `setRadioMode(true)` enforces a Photoshop-style
// "exactly one tool active at a time" rule across the bar's
// `ActionBarButton` children. Each button is auto-flagged as a toggle;
// activating one deactivates the previously-active button, and clicking
// the active one re-activates it (you can't end up with no tool
// selected). Useful for tool palettes; ignored when off.
//
// Section mode: `setSectionMode(true)` lets each separator delimit an
// independent group of items. Each section is configured at construction
// via `beginSection({ radio })`: a radio section keeps exactly one of its
// own buttons active (independent of other sections); a normal section
// behaves like an unconstrained group of toggles / one-shot buttons. The
// first `beginSection` call configures the implicit section 0; later
// calls auto-insert a separator and open a fresh section. Radio mode and
// section mode are mutually exclusive — turning either on disables the
// other.
//
// Action bars compose freely with the rest of the layout system:
// dockable into a `DockBase`, parentable to a `WindowControl`, or just
// dropped onto a canvas as a free-floating bar.

import { Base } from './Base';
import { Button } from './Button';
import { Pos } from '../core/Align';
import { color, margin, rect } from '../core/Structures';
import type { Skin } from '../skin/Skin';
import type { Texture } from '../renderer/Texture';

const DEFAULT_ITEM_SIZE = 28;
const BAR_PADDING = 2;

// ---------------------------------------------------------------------------
// ActionBarButton — square Button subclass. Carries Button's full
// feature set (text, icon, toggle, hover/depressed states, keyboard
// activation) with sizing pre-tuned for an action bar slot.
// ---------------------------------------------------------------------------

export class ActionBarButton extends Button {
  constructor(parent: Base | null) {
    super(parent);
    this.setSize(DEFAULT_ITEM_SIZE, DEFAULT_ITEM_SIZE);
    this.setText('');
  }
}

// ---------------------------------------------------------------------------
// ActionBarSeparator — thin Base that paints a single dividing line.
// Orientation is inferred from its docked size: tall-and-narrow → draw
// a vertical line (used in horizontal bars); wide-and-short → draw a
// horizontal line (used in vertical bars). The bar's `addSeparator`
// pre-sizes it so the dock pass produces the right aspect.
// ---------------------------------------------------------------------------

export class ActionBarSeparator extends Base {
  constructor(parent: Base | null) {
    super(parent);
    this.setSize(8, 8);
    this.setMouseInputEnabled(false);
  }

  override render(skin: Skin): void {
    const r = this.getRenderBounds();
    skin.renderer.setDrawColor(color(140, 140, 140, 255));
    if (r.h > r.w) {
      // Tall — vertical line down the middle (horizontal-bar separator).
      const cx = r.x + Math.floor(r.w / 2);
      skin.renderer.drawFilledRect(rect(cx, r.y + 4, 1, Math.max(0, r.h - 8)));
    } else {
      // Wide — horizontal line across the middle (vertical-bar separator).
      const cy = r.y + Math.floor(r.h / 2);
      skin.renderer.drawFilledRect(rect(r.x + 4, cy, Math.max(0, r.w - 8), 1));
    }
  }
}

// ---------------------------------------------------------------------------
// ActionBar
// ---------------------------------------------------------------------------

interface ActionBarSection {
  radio: boolean;
  active: ActionBarButton | null;
}

export class ActionBar extends Base {
  protected _vertical = false;
  protected _itemSize = DEFAULT_ITEM_SIZE;
  protected _columns = 1;
  protected _radioMode = false;
  protected _activeButton: ActionBarButton | null = null;
  protected _sectionMode = false;
  // Sections are populated only while `_sectionMode` is on. Index 0 is
  // the implicit first section; each subsequent separator opens one more.
  protected _sections: ActionBarSection[] = [];

  constructor(parent: Base | null) {
    super(parent);
    this.setPadding(margin(BAR_PADDING, BAR_PADDING, BAR_PADDING, BAR_PADDING));
    this.setSize(200, this._itemSize + BAR_PADDING * 2);
  }

  // =====================================================================
  // Orientation
  // =====================================================================

  setVertical(b: boolean): void {
    if (this._vertical === b) return;
    this._vertical = b;
    if (b) this.setSize(this._itemSize * this._columns + BAR_PADDING * 2, Math.max(this.height(), 100));
    else this.setSize(Math.max(this.width(), 100), this._itemSize + BAR_PADDING * 2);
    this.relayoutItems();
  }

  isVertical(): boolean {
    return this._vertical;
  }

  // =====================================================================
  // Item size
  // =====================================================================

  setItemSize(px: number): void {
    if (this._itemSize === px) return;
    this._itemSize = px;
    if (this._vertical) this.setWidth(px * this._columns + BAR_PADDING * 2);
    else this.setHeight(px + BAR_PADDING * 2);
    for (const c of this.children) {
      if (c instanceof ActionBarButton) c.setSize(px, px);
    }
    this.invalidate();
  }

  getItemSize(): number {
    return this._itemSize;
  }

  // =====================================================================
  // Columns (multi-column tool palettes — only meaningful when vertical)
  // =====================================================================

  /**
   * Set the number of columns for vertical (tool-palette) mode. With
   * `n > 1` the bar's width tracks `itemSize * n + 2*padding` and items
   * flow left-to-right then top-to-bottom in the grid (Photoshop-style
   * two-column toolbox). A no-op visually in horizontal mode but the
   * value is preserved across orientation flips.
   */
  setColumns(n: number): void {
    const cols = Math.max(1, Math.floor(n));
    if (this._columns === cols) return;
    this._columns = cols;
    if (this._vertical) this.setWidth(this._itemSize * cols + BAR_PADDING * 2);
    this.relayoutItems();
  }

  getColumns(): number {
    return this._columns;
  }

  // =====================================================================
  // Radio mode (single-active toggle — Photoshop-style tool selection)
  // =====================================================================

  /**
   * Enable / disable single-active toggle behaviour. While radio mode is
   * on:
   *   - Every `ActionBarButton` child is auto-flagged as a toggle.
   *   - Activating one button deactivates whichever was previously
   *     active.
   *   - Clicking the active button re-activates it — radio mode keeps
   *     exactly one tool selected at all times once the first is
   *     chosen.
   */
  setRadioMode(b: boolean): void {
    if (this._radioMode === b) return;
    this._radioMode = b;
    if (!b) return;
    // Section mode and radio mode are mutually exclusive: enabling radio
    // mode tears down section bookkeeping and treats the whole bar as a
    // single radio group.
    this._sectionMode = false;
    this._sections = [];
    // Promote existing buttons to toggleable; pick the first
    // already-on as the active and turn the rest off.
    let firstActive: ActionBarButton | null = null;
    for (const c of this.children) {
      if (c instanceof ActionBarButton) {
        c.setIsToggle(true);
        if (c.getToggleState() && !firstActive) firstActive = c;
      }
    }
    this._activeButton = firstActive;
    for (const c of this.children) {
      if (c instanceof ActionBarButton && c !== firstActive && c.getToggleState()) {
        c.setToggleState(false);
      }
    }
  }

  isRadioMode(): boolean {
    return this._radioMode;
  }

  // =====================================================================
  // Section mode — separators delimit independent groups; each section
  // can be a radio group or a normal mixed group.
  // =====================================================================

  /**
   * Turn section mode on or off. While on, each separator added to the
   * bar marks a section boundary, and each section can independently be
   * a radio group (one active button) or a normal group (independent
   * toggles / one-shots). Use `beginSection({ radio })` to declare a
   * section's behaviour explicitly. Enabling section mode disables radio
   * mode (and vice versa).
   */
  setSectionMode(b: boolean): void {
    if (this._sectionMode === b) return;
    this._sectionMode = b;
    if (!b) {
      this._sections = [];
      return;
    }
    this._radioMode = false;
    // Initialise with a single section spanning whatever's already in
    // the bar. Defaults to non-radio so legacy buttons keep their
    // existing independent behaviour.
    this._sections = [{ radio: false, active: null }];
    // Walk children: every existing separator opens an additional
    // section. Keeps the bookkeeping consistent if section mode is
    // toggled after the bar is partially populated.
    for (const c of this.children) {
      if (c instanceof ActionBarSeparator) {
        this._sections.push({ radio: false, active: null });
      }
    }
  }

  isSectionMode(): boolean {
    return this._sectionMode;
  }

  /**
   * Open a new section. The first call configures the implicit section 0
   * (no separator inserted); each subsequent call inserts an
   * `ActionBarSeparator` and starts a fresh section. Buttons added after
   * this call belong to the newly-opened section until the next
   * `beginSection` / `addSeparator`.
   *
   * Auto-enables section mode if it isn't already on.
   */
  beginSection(opts: { radio?: boolean } = {}): void {
    if (!this._sectionMode) this.setSectionMode(true);
    const radio = opts.radio ?? false;
    // First-section path: no separator yet, no buttons yet → just
    // configure section 0 in place. Detects "first" by content rather
    // than section count so callers can call `beginSection` once at the
    // top of construction without worrying about whether they've added
    // anything.
    const noContent = !this.children.some(
      (c) => c instanceof ActionBarButton || c instanceof ActionBarSeparator,
    );
    if (noContent && this._sections.length === 1) {
      this._sections[0].radio = radio;
      return;
    }
    // Otherwise insert a separator (which itself pushes a new section)
    // and reconfigure the section it just opened.
    this.addSeparator();
    this._sections[this._sections.length - 1].radio = radio;
  }

  getSectionCount(): number {
    return this._sections.length;
  }

  /**
   * The active button within `idx`, or null if that section has no
   * active button (either it's a normal section, or the user hasn't
   * clicked anything in it yet).
   */
  getActiveInSection(idx: number): ActionBarButton | null {
    if (idx < 0 || idx >= this._sections.length) return null;
    return this._sections[idx].active;
  }

  /**
   * Which section index does `btn` live in? Walks children in z-order
   * counting separators. Returns -1 if `btn` isn't a child.
   */
  protected sectionIndexFor(btn: ActionBarButton): number {
    let idx = 0;
    for (const c of this.children) {
      if (c === btn) return idx;
      if (c instanceof ActionBarSeparator) idx++;
    }
    return -1;
  }

  /**
   * Programmatically promote `btn` to the active selection (or pass
   * `null` to clear). Honours the radio rule: previous active is
   * deactivated. Called automatically by the radio enforcement when a
   * user clicks a button. In section mode the previous-active scope is
   * the button's own section, not the whole bar.
   */
  setActiveButton(btn: ActionBarButton | null): void {
    if (this._sectionMode) {
      if (!btn) return;
      const idx = this.sectionIndexFor(btn);
      if (idx < 0 || !this._sections[idx].radio) return;
      const prev = this._sections[idx].active;
      if (prev === btn) return;
      this._sections[idx].active = btn;
      btn.setToggleState(true);
      if (prev && prev !== btn) prev.setToggleState(false);
      return;
    }
    if (this._activeButton === btn) return;
    const prev = this._activeButton;
    this._activeButton = btn;
    if (btn) btn.setToggleState(true);
    if (prev && prev !== btn) prev.setToggleState(false);
  }

  getActiveButton(): ActionBarButton | null {
    return this._activeButton;
  }

  // =====================================================================
  // Item construction
  // =====================================================================

  /**
   * Add a square action button. Pass an icon Texture to use the icon
   * mode (centred image, no text); pass `text` to label it. Both can
   * be combined. In radio mode the button is auto-flagged as a toggle.
   */
  addButton(text = '', icon?: Texture): ActionBarButton {
    const b = new ActionBarButton(this);
    if (text) b.setText(text);
    if (icon) {
      const iconPx = Math.max(8, this._itemSize - 8);
      b.setImageTexture(icon, iconPx, iconPx, true);
    }
    b.setSize(this._itemSize, this._itemSize);
    this.attachRadioHandlers(b);
    if (this._radioMode) {
      b.setIsToggle(true);
    } else if (this._sectionMode) {
      // Auto-toggle inside a radio section so the click immediately
      // participates in the section's one-of selection.
      const last = this._sections[this._sections.length - 1];
      if (last && last.radio) b.setIsToggle(true);
    }
    this.dockChild(b);
    return b;
  }

  /**
   * Add a thin divider between two groups of items. In section mode this
   * also opens a new section, inheriting the radio setting of the section
   * it just closed (use `beginSection` to override).
   */
  addSeparator(): ActionBarSeparator {
    const s = new ActionBarSeparator(this);
    s.setSize(8, 8);
    this.dockChild(s);
    if (this._sectionMode) {
      const prev = this._sections[this._sections.length - 1];
      this._sections.push({ radio: prev ? prev.radio : false, active: null });
    }
    return s;
  }

  /**
   * Add an arbitrary control as an item — useful for drop-downs
   * (`ComboBox`), label readouts, or custom widgets. The control's
   * perpendicular dimension is auto-centered with margin so non-square
   * widgets (a 22-tall ComboBox in a 28-tall slot, say) don't get
   * visually stretched by the dock pass.
   */
  addItem<T extends Base>(ctrl: T): T {
    if (ctrl.parent !== this) ctrl.setParent(this);
    const slot = this._itemSize;
    if (this._vertical) {
      const w = ctrl.width();
      if (w > 0 && w < slot) {
        const inset = Math.floor((slot - w) / 2);
        ctrl.setMargin(margin(inset, 0, inset, 0));
      }
    } else {
      const h = ctrl.height();
      if (h > 0 && h < slot) {
        const inset = Math.floor((slot - h) / 2);
        ctrl.setMargin(margin(0, inset, 0, inset));
      }
    }
    this.dockChild(ctrl);
    return ctrl;
  }

  // =====================================================================
  // Internal — radio enforcement
  // =====================================================================

  // Subscribe once per button. Handlers bail when neither radio mode
  // nor a radio section applies, so we can wire all buttons
  // unconditionally and just flip the flag at the bar level when needed.
  protected attachRadioHandlers(btn: ActionBarButton): void {
    btn.onToggleOn.on(() => {
      if (this._sectionMode) {
        const idx = this.sectionIndexFor(btn);
        if (idx < 0 || !this._sections[idx].radio) return;
        const prev = this._sections[idx].active;
        if (prev === btn) return;
        this._sections[idx].active = btn;
        if (prev) prev.setToggleState(false);
        return;
      }
      if (!this._radioMode) return;
      const prev = this._activeButton;
      if (prev === btn) return;
      this._activeButton = btn;
      if (prev) prev.setToggleState(false);
    });
    btn.onToggleOff.on(() => {
      if (this._sectionMode) {
        const idx = this.sectionIndexFor(btn);
        if (idx < 0 || !this._sections[idx].radio) return;
        // Active button can't deactivate itself in a radio section —
        // restore. Mirrors the legacy radio-mode rule.
        if (this._sections[idx].active === btn) btn.setToggleState(true);
        return;
      }
      if (!this._radioMode) return;
      if (this._activeButton === btn) btn.setToggleState(true);
    });
  }

  // =====================================================================
  // Internal — docking / layout helpers
  // =====================================================================

  protected dockChild(c: Base): void {
    if (this._vertical && this._columns > 1) {
      // Multi-column: positioning is done in `layout()`. Mark
      // non-docked so the parent dock pass leaves the child alone.
      c.dock(Pos.None);
    } else {
      c.dock(this._vertical ? Pos.Top : Pos.Left);
    }
  }

  protected relayoutItems(): void {
    for (const c of this.children) this.dockChild(c);
    this.invalidate();
  }

  // =====================================================================
  // Layout — multi-column grid for vertical tool palettes. Single-column
  // mode relies on the dock pass; multi-column mode positions items
  // manually so they flow left-to-right then top-to-bottom.
  // =====================================================================

  override layout(skin: Skin): void {
    super.layout(skin);
    if (!this._vertical || this._columns <= 1) return;
    const pad = this.getPadding();
    const slot = this._itemSize;
    const x0 = pad.left;
    // Track Y directly rather than via a cell index — the previous
    // implementation advanced by `cols` cells per separator (= a full
    // slot row of 28 px) even though the separator only takes 8 px,
    // leaving a visible empty row after each divider.
    let y = pad.top;
    let col = 0;
    for (const c of this.children) {
      if (c.hidden()) continue;
      if (c instanceof ActionBarSeparator) {
        // Wrap to the start of a fresh row if we're mid-row, then the
        // separator spans the full bar width as an 8 px band.
        if (col !== 0) {
          y += slot;
          col = 0;
        }
        c.setBounds(x0, y, slot * this._columns, 8);
        y += 8;
        continue;
      }
      c.setBounds(x0 + col * slot, y, slot, slot);
      col++;
      if (col >= this._columns) {
        col = 0;
        y += slot;
      }
    }
  }

  // =====================================================================
  // Render — reuse the existing menu-strip background so the action bar
  // matches the visual language of MenuStrip / ToolBar. A custom skin
  // region would be a future refinement.
  // =====================================================================

  override render(skin: Skin): void {
    skin.drawMenuStrip(this);
  }
}
