// SplitterVertical + SplitterHorizontal — two-pane splitter containers.
// Port `Gwen::Controls::SplitterVertical` and
// `Gwen::Controls::SplitterHorizontal` from
// include/Gwen/Controls/Splitters.h (header-only inline in upstream).
//
// Composition:
//   * Two Base panels host the user's content. They're automatically
//     filled via `Pos.Fill` when `setPanels()` is called so callers
//     can drop their content in and forget about layout.
//   * A `SplitterBar` separates the two panels. Its drag is clamped
//     to the parent by `SplitterBar`'s own `setRestrictToParent(true)`.
//
// Design note: GWEN uses `RefreshContainers` from `PostLayout`. We do
// all the sizing in `layout` directly — `Base.recurseLayout` calls
// `layout(skin)` before recursing into children, so the child panels
// see the correct bounds on their first pass.
//
// Naming: GWEN's "SplitterVertical" splits *horizontally* (the bar
// runs across). "SplitterHorizontal" splits vertically. We preserve
// the upstream names so callers porting C++ code match up.

import { Base } from './Base';
import { SplitterBar } from './SplitterBar';
import { CursorType } from '../core/Structures';
import { Pos } from '../core/Align';
import type { Skin } from '../skin/Skin';

// ---------- SplitterVertical (horizontal bar, two stacked panels) ----------

export class SplitterVertical extends Base {
  protected _splitterBar: SplitterBar;
  protected _panels: [Base, Base];
  protected _splitterSize = 6;
  protected _size = 100;
  protected _rightSided = false;

  constructor(parent: Base | null) {
    super(parent);
    this._panels = [new Base(this), new Base(this)];
    this._splitterBar = new SplitterBar(this);
    this._splitterBar.setCursor(CursorType.SizeNS);
    this._splitterBar.onDragged.on(() => this.onSplitterMoved());
    this.setSize(100, 100);
  }

  // =====================================================================
  // Panel wiring — reparents user content into the panel slots and
  // fills them with Pos.Fill so resizes propagate automatically.
  // =====================================================================

  setPanels(a: Base | null, b: Base | null): void {
    if (a) {
      a.setParent(this._panels[0]);
      a.dock(Pos.Fill);
    }
    if (b) {
      b.setParent(this._panels[1]);
      b.dock(Pos.Fill);
    }
  }

  setScaling(rightSided: boolean, size: number): void {
    this._rightSided = rightSided;
    this._size = size;
    this.invalidate();
  }

  splitterPos(): number {
    return this._splitterBar.y();
  }

  // =====================================================================
  // Drag callback — reads the splitter's new position and updates
  // `_size` so relayout reproduces it. Direction depends on whether
  // the splitter is pinned to the near (top) or far (bottom) side.
  // =====================================================================

  protected onSplitterMoved(): void {
    if (this._rightSided) {
      this._size = this.height() - this._splitterBar.y() - this._splitterSize;
    } else {
      this._size = this._splitterBar.y();
    }
    this.invalidate();
  }

  // =====================================================================
  // Layout — place bar + two panels from `_size`.
  // =====================================================================

  override layout(skin: Skin): void {
    super.layout(skin);
    const bar = this._splitterBar;
    const barY = this._rightSided
      ? (this.height() - this._size - this._splitterSize)
      : this._size;
    bar.setBounds(0, barY, this.width(), this._splitterSize);
    this._panels[0].setBounds(0, 0, this.width(), barY);
    this._panels[1].setBounds(
      0,
      barY + this._splitterSize,
      this.width(),
      this.height() - barY - this._splitterSize,
    );
  }
}

// ---------- SplitterHorizontal (vertical bar, two side-by-side panels) ----

export class SplitterHorizontal extends SplitterVertical {
  constructor(parent: Base | null) {
    super(parent);
    this._splitterBar.setCursor(CursorType.SizeWE);
  }

  override splitterPos(): number {
    return this._splitterBar.x();
  }

  protected override onSplitterMoved(): void {
    if (this._rightSided) {
      this._size = this.width() - this._splitterBar.x() - this._splitterSize;
    } else {
      this._size = this._splitterBar.x();
    }
    this.invalidate();
  }

  // Overrides the parent's layout entirely. We don't chain to super's
  // layout because the axis is swapped — the parent would place the
  // bar horizontally, which is wrong for this subclass.
  override layout(_skin: Skin): void {
    const bar = this._splitterBar;
    const barX = this._rightSided
      ? (this.width() - this._size - this._splitterSize)
      : this._size;
    bar.setBounds(barX, 0, this._splitterSize, this.height());
    this._panels[0].setBounds(0, 0, barX, this.height());
    this._panels[1].setBounds(
      barX + this._splitterSize,
      0,
      this.width() - barX - this._splitterSize,
      this.height(),
    );
  }
}
