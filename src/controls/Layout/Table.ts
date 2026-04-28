// Table + TableRow — column-major grid laid out via per-row docking. Ports
// `Gwen::Controls::Layout::Table` and `Gwen::Controls::Layout::TableRow`
// from include/Gwen/Controls/Layout/Table.h.
//
// Composition:
//   * `TableRow` owns up to MAX_COLUMNS Label cells. The first n-1 dock
//     `Pos.Left` (so they consume a fixed column width); the last docks
//     `Pos.Fill` (so it stretches to consume the remaining row width).
//   * `Table` owns rows that dock `Pos.Top`. Per-column width overrides set
//     via `setColumnWidth` are reapplied to every row's cells in `layout`.
//   * `sizeToContents` walks each column to compute a max-content width and
//     stashes it in `_columnWidths`; the next layout pass pushes those widths
//     onto every row.

import { Base } from '../Base';
import { Label } from '../Label';
import { Signal, type EventInfo } from '../../core/Events';
import { Pos } from '../../core/Align';
import { margin, type Color } from '../../core/Structures';
import type { Skin } from '../../skin/Skin';

const MAX_COLUMNS = 16;

export class TableRow extends Base {
  readonly onRowSelected = new Signal<EventInfo>();
  protected _columnCount = 0;
  protected _even = false;
  protected _columns: (Label | null)[] = [];

  constructor(parent: Base | null) {
    super(parent);
    for (let i = 0; i < MAX_COLUMNS; i++) this._columns.push(null);
  }

  setColumnCount(n: number): void {
    if (n === this._columnCount) return;
    n = Math.min(MAX_COLUMNS, Math.max(0, n));
    for (let i = 0; i < n; i++) {
      let col = this._columns[i];
      if (!col) {
        col = new Label(this);
        col.setPadding(margin(3, 3, 3, 3));
        this._columns[i] = col;
      }
      if (i === n - 1) col.dock(Pos.Fill);
      else col.dock(Pos.Left);
    }
    this._columnCount = n;
    this.invalidate();
  }

  getColumnCount(): number {
    return this._columnCount;
  }

  setCellText(col: number, text: string): void {
    if (col < 0 || col >= this._columnCount) return;
    const c = this._columns[col];
    if (c) c.setText(text);
  }

  getCellText(col: number): string {
    if (col < 0 || col >= this._columnCount) return '';
    return this._columns[col]?.getText() ?? '';
  }

  setCellContents(col: number, ctrl: Base, enableMouse = false): void {
    if (col < 0 || col >= this._columnCount) return;
    const c = this._columns[col];
    if (!c) return;
    c.setMouseInputEnabled(enableMouse);
    ctrl.setParent(c);
  }

  getCellContents(col: number): Label | null {
    if (col < 0 || col >= this._columnCount) return null;
    return this._columns[col];
  }

  isEven(): boolean {
    return this._even;
  }

  setEven(b: boolean): void {
    this._even = b;
  }

  // Base hook — `ListBoxRow`-style subclasses override to flip a
  // selection visual; this default is a no-op so plain TableRows
  // never accidentally render selection chrome.
  setSelected(_b: boolean): void {
    // no-op
  }

  setTextColor(c: Color): void {
    for (let i = 0; i < this._columnCount; i++) {
      this._columns[i]?.setTextColor(c);
    }
  }

  sizeToContents(): void {
    let total = 0;
    let maxH = 0;
    for (let i = 0; i < this._columnCount; i++) {
      const col = this._columns[i];
      if (!col) continue;
      col.sizeToContents();
      total += col.width();
      maxH = Math.max(maxH, col.height());
    }
    this.setSize(total, maxH);
  }
}

export class Table extends Base {
  protected _columnCount = 1;
  protected _columnWidths: number[] = [];
  protected _defaultRowHeight = 22;
  protected _sizeToContents = false;

  constructor(parent: Base | null) {
    super(parent);
    for (let i = 0; i < MAX_COLUMNS; i++) this._columnWidths.push(0);
  }

  setColumnCount(n: number): void {
    this._columnCount = Math.min(MAX_COLUMNS, Math.max(1, n));
    for (const c of this.children) {
      if (c instanceof TableRow) c.setColumnCount(this._columnCount);
    }
  }

  setColumnWidth(col: number, w: number): void {
    if (col < 0 || col >= MAX_COLUMNS) return;
    this._columnWidths[col] = w;
    this.invalidate();
  }

  getColumnCount(): number {
    return this._columnCount;
  }

  getDefaultRowHeight(): number {
    return this._defaultRowHeight;
  }

  setDefaultRowHeight(h: number): void {
    this._defaultRowHeight = h;
  }

  addRow(): TableRow {
    const row = new TableRow(this);
    row.setColumnCount(this._columnCount);
    row.setHeight(this._defaultRowHeight);
    row.dock(Pos.Top);
    return row;
  }

  addRowObj(row: TableRow): void {
    row.setParent(this);
    row.setColumnCount(this._columnCount);
    row.dock(Pos.Top);
  }

  getRow(i: number): TableRow | null {
    const rows = this.children.filter((c): c is TableRow => c instanceof TableRow);
    return rows[i] ?? null;
  }

  rowCount(): number {
    return this.children.filter((c) => c instanceof TableRow).length;
  }

  remove(row: TableRow): void {
    row.setParent(null);
  }

  clear(): void {
    this.removeAllChildren();
  }

  override layout(skin: Skin): void {
    super.layout(skin);
    // Apply column widths to each row's cells; alternate even flag.
    let i = 0;
    for (const c of this.children) {
      if (c instanceof TableRow) {
        c.setEven(i % 2 === 0);
        for (let col = 0; col < this._columnCount; col++) {
          const cell = c.getCellContents(col);
          if (cell && this._columnWidths[col] > 0 && col < this._columnCount - 1) {
            cell.setWidth(this._columnWidths[col]);
          }
        }
        i++;
      }
    }
  }

  sizeToContents(): void {
    // Compute column widths as max content width per column.
    const rows: TableRow[] = this.children.filter((c): c is TableRow => c instanceof TableRow);
    for (let col = 0; col < this._columnCount; col++) {
      let max = 10;
      for (const r of rows) {
        const cell = r.getCellContents(col);
        if (cell) {
          cell.sizeToContents();
          max = Math.max(max, cell.width());
        }
      }
      this._columnWidths[col] = max;
    }
    this._sizeToContents = true;
    this.invalidate();
  }
}
