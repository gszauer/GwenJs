// ResizableControl — a rectangular control ringed by eight Resizer
// handles, one per edge and corner. Ports
// `Gwen::ControlsInternal::ResizableControl` from
// include/Gwen/Controls/ResizableControl.h + src/Controls/ResizableControl.cpp.
//
// The eight handles are keyed by their direction bitmask (e.g.
// `Pos.Left | Pos.Top` for the NW corner). Each Resizer points at the
// parent ResizableControl as its target, so pointer drags grow or shrink
// us rather than the handle. The layout pass anchors the handles to the
// current edges every tick so resizing and docking stay in sync.
//
// Simplification vs GWEN:
//   * GWEN uses a templated `std::map<int, Resizer*>`. We keep a
//     `Map<number, Resizer>` for ergonomic lookup in tests; the runtime
//     cost is negligible for eight entries.
//   * `setBounds` clamps width/height against `_minSize` so external
//     callers (e.g. docking code) honour the same floor the Resizer does.
//     GWEN enforces this via virtual `GetMinimumSize()`; we override it
//     to return `_minSize` so both paths converge.
//   * `onResize` fires once per delta. GWEN additionally calls the
//     `OnResized` virtual — we forward to the same hook so subclasses
//     (e.g. `WindowControl`) can reshape chrome.
//
// Corner size matches GWEN's 6 px grab budget; edges fill the remainder.

import { Base } from './Base';
import { Resizer } from './Resizer';
import { Signal, eventInfo, type EventInfo } from '../core/Events';
import { Pos } from '../core/Align';
import { point, type Point, type Rect } from '../core/Structures';
import type { Skin } from '../skin/Skin';

export class ResizableControl extends Base {
  readonly onResize = new Signal<EventInfo>();
  protected _minSize: Point = point(5, 5);
  protected _clampMovement = false;
  protected _resizers: Map<number, Resizer> = new Map();

  constructor(parent: Base | null) {
    super(parent);
    const directions = [
      Pos.Left | Pos.Top,
      Pos.Top,
      Pos.Right | Pos.Top,
      Pos.Left,
      Pos.Right,
      Pos.Left | Pos.Bottom,
      Pos.Bottom,
      Pos.Right | Pos.Bottom,
    ];
    for (const dir of directions) {
      const r = new Resizer(this);
      r.setResizeDir(dir);
      r.setTarget(this);
      r.onResize.on((e) => this.onResizerMoved(e));
      this._resizers.set(dir, r);
    }
    this.setKeyboardInputEnabled(true);
  }

  // =====================================================================
  // Config
  // =====================================================================

  setMinimumSize(p: Point): void {
    this._minSize = p;
  }

  override getMinimumSize(): Point {
    return this._minSize;
  }

  setClampMovement(b: boolean): void {
    this._clampMovement = b;
  }

  shouldClampMovement(): boolean {
    return this._clampMovement;
  }

  disableResizing(): void {
    for (const r of this._resizers.values()) {
      r.setMouseInputEnabled(false);
    }
  }

  getResizer(dir: number): Resizer | null {
    return this._resizers.get(dir) ?? null;
  }

  // =====================================================================
  // Bounds — clamp width/height against the minimum floor so every caller
  // (layout passes, external setters, Resizer drags) honours the same limit.
  // =====================================================================

  override setBounds(rOrX: Rect | number, y?: number, w?: number, h?: number): boolean {
    if (typeof rOrX === 'number') {
      const nx = rOrX;
      const ny = y ?? 0;
      const nw = Math.max(this._minSize.x, w ?? 0);
      const nh = Math.max(this._minSize.y, h ?? 0);
      return super.setBounds(nx, ny, nw, nh);
    }
    const r = rOrX;
    return super.setBounds(r.x, r.y, Math.max(this._minSize.x, r.w), Math.max(this._minSize.y, r.h));
  }

  // =====================================================================
  // Resizer signal fan-out — emit our own onResize + invoke the virtual
  // so subclasses can fix up child layout.
  // =====================================================================

  protected onResizerMoved(_e: EventInfo): void {
    const info = eventInfo();
    info.controlCaller = this;
    this.onResize.emit(info);
    this.onResized();
  }

  /** Subclass hook. GWEN calls this `OnResized`. */
  protected onResized(): void {
    // no-op
  }

  // =====================================================================
  // Layout — anchor the eight handles to the current edges every tick.
  // Corners occupy a fixed 6x6 square; edges take what's left.
  // =====================================================================

  override layout(skin: Skin): void {
    super.layout(skin);
    const w = this.width();
    const h = this.height();
    const corner = 6;
    const edgeW = Math.max(0, w - corner * 2);
    const edgeH = Math.max(0, h - corner * 2);

    this._resizers.get(Pos.Left | Pos.Top)?.setBounds(0, 0, corner, corner);
    this._resizers.get(Pos.Top)?.setBounds(corner, 0, edgeW, corner);
    this._resizers.get(Pos.Right | Pos.Top)?.setBounds(w - corner, 0, corner, corner);
    this._resizers.get(Pos.Left)?.setBounds(0, corner, corner, edgeH);
    this._resizers.get(Pos.Right)?.setBounds(w - corner, corner, corner, edgeH);
    this._resizers.get(Pos.Left | Pos.Bottom)?.setBounds(0, h - corner, corner, corner);
    this._resizers.get(Pos.Bottom)?.setBounds(corner, h - corner, edgeW, corner);
    this._resizers.get(Pos.Right | Pos.Bottom)?.setBounds(w - corner, h - corner, corner, corner);

    // Handles must paint and route input on top of any child content.
    for (const r of this._resizers.values()) r.bringToFront();
  }
}
