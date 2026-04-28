// WindowButtons — the trio of chrome buttons on a WindowControl: close,
// maximize/restore, minimize. Ports
// `Gwen::ControlsInternal::CloseButton`,
// `Gwen::ControlsInternal::MaximizeButton`, and
// `Gwen::ControlsInternal::MinimizeButton` from
// include/Gwen/Controls/WindowButtons.h + src/Controls/WindowButtons.cpp.
//
// Each button composes Button but swaps the render method for a
// skin-specific call (draw the correct atlas slot for the state). They
// also hold a back-reference to the owning Window so the canvas can walk
// click actions back to the window (close/minimize/maximize).
//
// Design note: GWEN duplicates the signature of `CloseButton` across the
// other two. We collapse that by inheriting Maximize and Minimize from
// Close — they share state, sizing, and the window back-pointer; only
// the render differs. Maximize adds a `maximized` toggle that swaps the
// atlas slot between the "expand" and "restore" glyphs.

import { Button } from './Button';
import type { Base } from './Base';
import type { Skin } from '../skin/Skin';

// ---------- Close ----------

export class WindowCloseButton extends Button {
  protected _window: Base | null = null;

  constructor(parent: Base | null) {
    super(parent);
    this.setSize(31, 31);
    this.setText('');
    this.setTabable(false);
  }

  setWindow(w: Base): void {
    this._window = w;
  }

  getWindow(): Base | null {
    return this._window;
  }

  override render(skin: Skin): void {
    if (!this._window) return;
    skin.drawWindowCloseButton(this, this.isDepressed(), this.isHovered(), this.isDisabled());
  }
}

// ---------- Maximize / Restore ----------

export class WindowMaximizeButton extends WindowCloseButton {
  protected _maximized = false;

  constructor(parent: Base | null) {
    super(parent);
  }

  setMaximized(b: boolean): void {
    if (this._maximized === b) return;
    this._maximized = b;
    this.redraw();
  }

  isMaximized(): boolean {
    return this._maximized;
  }

  override render(skin: Skin): void {
    if (!this.getWindow()) return;
    skin.drawWindowMaximizeButton(this, this.isDepressed(), this.isHovered(), this.isDisabled(), this._maximized);
  }
}

// ---------- Minimize ----------

export class WindowMinimizeButton extends WindowCloseButton {
  constructor(parent: Base | null) {
    super(parent);
  }

  override render(skin: Skin): void {
    if (!this.getWindow()) return;
    skin.drawWindowMinimizeButton(this, this.isDepressed(), this.isHovered(), this.isDisabled());
  }
}
