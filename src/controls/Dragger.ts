// Dragger — invisible drag handle used by Window (title bar), Resizer,
// Splitter, etc. Ports `Gwen::ControlsInternal::Dragger` from
// include/Gwen/Controls/Dragger.h + src/Controls/Dragger.cpp.
//
// A Dragger owns no art — composites that want visual feedback
// (Window, ResizerControl) override `render` or stack child controls on
// top. The single responsibility here is pointer tracking: claim focus
// on press, translate subsequent moves into `target.moveTo(...)`, and
// fire `onDragStart` / `onDragged` / `onDragEnd` signals.
//
// Differences from GWEN:
//   * `onDragEnd` is added for TS consumers that want explicit release
//     notification. GWEN relies on watching `MouseFocus` transitions;
//     we prefer a named signal.
//   * Double-click still fires `onDoubleClickLeft` — the GWEN API.

import { Base } from './Base';
import { Signal, eventInfo, type EventInfo } from '../core/Events';
import { point, type Point } from '../core/Structures';
import type { Skin } from '../skin/Skin';

export class Dragger extends Base {
  readonly onDragStart = new Signal<EventInfo>();
  readonly onDragged = new Signal<EventInfo>();
  readonly onDragEnd = new Signal<EventInfo>();
  readonly onDoubleClickLeft = new Signal<EventInfo>();

  protected _target: Base | null = null;
  protected _doMove = true;
  protected _depressed = false;
  protected _holdPos: Point = point();

  constructor(parent: Base | null) {
    super(parent);
    this.setMouseInputEnabled(true);
  }

  // =====================================================================
  // Config
  // =====================================================================

  setTarget(t: Base | null): void {
    this._target = t;
  }

  getTarget(): Base | null {
    return this._target;
  }

  setDoMove(b: boolean): void {
    this._doMove = b;
  }

  isDepressed(): boolean {
    return this._depressed;
  }

  // =====================================================================
  // Mouse
  // =====================================================================

  override onMouseClickLeft(x: number, y: number, pressed: boolean): void {
    if (this.isDisabled()) return;
    if (pressed) {
      // Grab canvas mouseFocus so subsequent moves route to us even
      // when the pointer slips off our bounds (matches GWEN's
      // `Gwen::MouseFocus = this`).
      const canvas = this.getCanvas();
      if (canvas) canvas.mouseFocus = this;
      this._depressed = true;
      if (this._target) {
        const p = this._target.canvasPosToLocal(point(x, y));
        this._holdPos.x = p.x;
        this._holdPos.y = p.y;
      }
      const info = eventInfo();
      info.controlCaller = this;
      this.onDragStart.emit(info);
      return;
    }

    // Released.
    this._depressed = false;
    const canvas = this.getCanvas();
    if (canvas) canvas.mouseFocus = null;
    const info = eventInfo();
    info.controlCaller = this;
    this.onDragEnd.emit(info);
  }

  override onMouseMoved(x: number, y: number, dx: number, dy: number): void {
    if (this.isDisabled()) return;
    if (!this._depressed) return;

    if (this._doMove && this._target) {
      // The target's new canvas-space position is (x, y) minus the hold
      // offset captured on press. We then translate that back into the
      // parent's local coordinate space for `moveTo`.
      let nx = x - this._holdPos.x;
      let ny = y - this._holdPos.y;
      const parent = this._target.parent;
      if (parent) {
        const local = parent.canvasPosToLocal(point(nx, ny));
        nx = local.x;
        ny = local.y;
      }
      this._target.moveTo(nx, ny);
    }

    const info = eventInfo();
    info.controlCaller = this;
    info.point = point(dx, dy);
    this.onDragged.emit(info);
  }

  override onMouseDoubleClickLeft(_x: number, _y: number): void {
    const info = eventInfo();
    info.controlCaller = this;
    this.onDoubleClickLeft.emit(info);
  }

  // =====================================================================
  // Render — intentionally empty. Dragger is a pure interaction control;
  // subclasses (Window title bar, ResizerControl) supply the art.
  // =====================================================================

  override render(_skin: Skin): void {
    // no-op per GWEN Dragger.cpp:62-65
  }
}
