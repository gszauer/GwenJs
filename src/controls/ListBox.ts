// ListBox + ListBoxRow — scrollable vertical list of selectable text
// rows. Ports `Gwen::Controls::ListBox` from
// include/Gwen/Controls/ListBox.h + src/Controls/ListBox.cpp.
//
// Composition:
//   * Extends ScrollControl — long lists scroll vertically. Rows dock to
//     the inner panel so they flow top-down; the inner panel's natural
//     height drives the scroll extent.
//   * ListBoxRow is a Button subclass with selection state + even/odd
//     striping. It's not exported — callers interact only with `ListBox`.
//
// Multi-select uses shift-click: holding shift adds the clicked row to the
// selection (it never toggles off an already-selected row); a plain click
// clears the selection and selects only the clicked row.

import { Base } from './Base';
import { ScrollControl } from './ScrollControl';
import { Button } from './Button';
import { Signal, eventInfo, type EventInfo } from '../core/Events';
import { Pos } from '../core/Align';
import { margin } from '../core/Structures';
import type { Skin } from '../skin/Skin';
import type { Canvas } from './Canvas';

// ---------------------------------------------------------------------------
// ListBoxRow — one selectable row. Internal to this module.
// ---------------------------------------------------------------------------

export class ListBoxRow extends Button {
  protected _selected = false;
  protected _even = false;
  protected _listBox: ListBox;

  constructor(listBox: ListBox) {
    // Parent to the listbox — Base.addChild will route through its inner
    // panel automatically (ScrollControl installed one in its constructor).
    super(listBox);
    this._listBox = listBox;
    this.setPadding(margin(5, 0, 0, 0));
    this.setAlignment(Pos.Left | Pos.CenterV);
    this.setHeight(18);
    this.setShouldDrawBackground(false);
    this.setTabable(false);
  }

  isSelected(): boolean {
    return this._selected;
  }

  setSelected(b: boolean): void {
    if (this._selected === b) return;
    this._selected = b;
    this.redraw();
  }

  isEven(): boolean {
    return this._even;
  }

  setEven(b: boolean): void {
    this._even = b;
  }

  getListBox(): ListBox {
    return this._listBox;
  }

  override onMouseClickLeft(x: number, y: number, pressed: boolean): void {
    const wasDepressed = this.isDepressed();
    super.onMouseClickLeft(x, y, pressed);
    if (!pressed) return;
    if (!wasDepressed) {
      // Fresh press — read shift state and notify the listbox.
      const canvas = this.getCanvas() as Canvas | null;
      const shift = canvas !== null && typeof canvas.isShiftDown === 'function' && canvas.isShiftDown();
      this._listBox.onRowClicked(this, shift);
    }
  }

  override render(skin: Skin): void {
    skin.drawListBoxLine(this, this._selected, this._even);
  }
}

// ---------------------------------------------------------------------------
// ListBox
// ---------------------------------------------------------------------------

export class ListBox extends ScrollControl {
  readonly onRowSelected = new Signal<EventInfo>();
  protected _multiSelect = false;
  protected _rows: ListBoxRow[] = [];

  constructor(parent: Base | null) {
    super(parent);
    this.setMargin(margin(1, 1, 1, 1));
    this.setScroll(false, true);
    this.setAutoHideBars(true);
    const inner = this.getInnerPanel();
    if (inner) inner.setPadding(margin(2, 2, 2, 2));
    // Listbox is the tab stop; arrow keys move selection between rows
    // (rows themselves stay non-tabable so the cycle doesn't pause on
    // every entry).
    this.setTabable(true);
    this.setKeyboardInputEnabled(true);
  }

  // =====================================================================
  // Configuration
  // =====================================================================

  setAllowMultiSelect(b: boolean): void {
    this._multiSelect = b;
  }

  allowMultiSelect(): boolean {
    return this._multiSelect;
  }

  // =====================================================================
  // Items
  // =====================================================================

  addItem(label: string, name = ''): ListBoxRow {
    const row = new ListBoxRow(this);
    row.setText(label);
    row.setName(name);
    row.dock(Pos.Top);
    row.setEven(this._rows.length % 2 === 0);
    this._rows.push(row);
    this.invalidate();
    return row;
  }

  clear(): void {
    const inner = this.getInnerPanel();
    if (inner) inner.removeAllChildren();
    this._rows.length = 0;
    this.invalidate();
  }

  getRows(): readonly ListBoxRow[] {
    return this._rows;
  }

  // =====================================================================
  // Selection
  // =====================================================================

  unselectAll(): void {
    for (const r of this._rows) r.setSelected(false);
  }

  getSelectedRow(): ListBoxRow | null {
    for (const r of this._rows) if (r.isSelected()) return r;
    return null;
  }

  getSelectedRows(): ListBoxRow[] {
    return this._rows.filter((r) => r.isSelected());
  }

  getSelectedRowName(): string {
    const row = this.getSelectedRow();
    return row ? row.getName() : '';
  }

  setSelectedRow(row: ListBoxRow, clearOthers = true): void {
    if (clearOthers) this.unselectAll();
    row.setSelected(true);
    const info = eventInfo();
    info.controlCaller = this;
    info.control = row;
    info.string = row.getText();
    this.onRowSelected.emit(info);
  }

  // Dispatched from ListBoxRow's click handler. Per GWEN ListBox.cpp:122-129,
  // shift+click ADDS to the selection (never toggles off); a plain click
  // clears prior selections and selects only the clicked row.
  onRowClicked(row: ListBoxRow, shiftHeld: boolean): void {
    const clear = !(this._multiSelect && shiftHeld);
    this.setSelectedRow(row, clear);
  }

  // =====================================================================
  // Keyboard nav — Up/Down moves the single-selection cursor; Home/End
  // jump to the first/last row. Multi-select isn't extended via keyboard
  // (mouse + Shift remains the way to grow a selection).
  // =====================================================================

  override onKeyUp(down: boolean): boolean {
    if (down) this.moveSelection(-1);
    return true;
  }

  override onKeyDown(down: boolean): boolean {
    if (down) this.moveSelection(1);
    return true;
  }

  override onKeyHome(down: boolean): boolean {
    if (down && this._rows.length > 0) this.selectIndex(0);
    return true;
  }

  override onKeyEnd(down: boolean): boolean {
    if (down && this._rows.length > 0) this.selectIndex(this._rows.length - 1);
    return true;
  }

  private moveSelection(delta: number): void {
    if (this._rows.length === 0) return;
    const cur = this.getSelectedRow();
    const idx = cur ? this._rows.indexOf(cur) : -1;
    let next: number;
    if (idx === -1) next = delta > 0 ? 0 : this._rows.length - 1;
    else next = Math.max(0, Math.min(this._rows.length - 1, idx + delta));
    this.selectIndex(next);
  }

  private selectIndex(i: number): void {
    const row = this._rows[i];
    if (!row) return;
    this.setSelectedRow(row, true);
    this.scrollRowIntoView(row);
  }

  // Adjusts the vertical scroll so that `row` is fully visible. For a
  // typical 18px row in a viewport-sized listbox this is a no-op when the
  // row is already on-screen.
  private scrollRowIntoView(row: ListBoxRow): void {
    const inner = this.getInnerPanel();
    if (!inner) return;
    const vbar = this.getVerticalScrollBar();
    // overflow = inner.height() - viewportH (when positive). When negative
    // there's no scrolling to do.
    const viewportH = this.height() - this.getPadding().top - this.getPadding().bottom;
    const overflow = inner.height() - viewportH;
    if (overflow <= 0) return;
    const rowTop = row.y();
    const rowBottom = rowTop + row.height();
    const scrolled = vbar.getScrolledAmount();
    const visTop = scrolled * overflow;
    const visBottom = visTop + viewportH;
    if (rowTop < visTop) {
      vbar.setScrolledAmount(rowTop / overflow, true);
    } else if (rowBottom > visBottom) {
      vbar.setScrolledAmount((rowBottom - viewportH) / overflow, true);
    }
  }

  // Glob-style selection — `*` matches any run, `?` matches a single char.
  // Regex metacharacters in `pattern` are escaped before the glob chars are
  // re-introduced, so patterns like `"(file)-*.txt"` round-trip cleanly.
  selectByString(pattern: string, clearOthers = true): void {
    if (clearOthers) this.unselectAll();
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('^' + escaped.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    for (const r of this._rows) {
      if (re.test(r.getText())) {
        r.setSelected(true);
        const info = eventInfo();
        info.controlCaller = this;
        info.control = r;
        info.string = r.getText();
        this.onRowSelected.emit(info);
      }
    }
  }

  // =====================================================================
  // Render
  // =====================================================================

  override render(skin: Skin): void {
    skin.drawListBox(this);
  }
}
