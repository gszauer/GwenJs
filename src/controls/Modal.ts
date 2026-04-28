// Modal + Highlight — small, related compositional helpers that draw a
// canvas-spanning blocker (Modal) and a flat magenta block used for
// drag-and-drop / resize feedback (Highlight).
//
// Ports `Gwen::Controls::Modal` and `Gwen::Controls::Highlight` from
// include/Gwen/Controls/Modal.h and include/Gwen/Controls/Highlight.h.

import { Base } from './Base';
import type { Skin } from '../skin/Skin';

export class Modal extends Base {
  constructor(parent: Base | null) {
    super(parent);
    this.setKeyboardInputEnabled(true);
    this.setMouseInputEnabled(true);
    this.setShouldDrawBackground(true);
    // While a modal is up, Tab navigation is trapped inside it — the
    // canvas behind is non-interactive anyway, but this also means a
    // modal-hosted window's controls don't share the cycle with any
    // stray focusable left over outside.
    this.setTabBoundary(true);
  }

  override layout(skin: Skin): void {
    const canvas = this.getCanvas();
    if (canvas) {
      // CanvasLike doesn't currently expose width/height (T010 keeps the
      // structural interface minimal). When wired into the real Canvas
      // subclass this still resolves through `Base.width()/height()`.
      const c = canvas as unknown as { width(): number; height(): number };
      this.setBounds(0, 0, c.width(), c.height());
    }
    super.layout(skin);
  }

  override render(skin: Skin): void {
    if (this.shouldDrawBackground()) {
      skin.drawModalControl(this);
    }
  }
}

export class Highlight extends Base {
  constructor(parent: Base | null) {
    super(parent);
    this.setMouseInputEnabled(false);
  }

  override render(skin: Skin): void {
    skin.drawHighlight(this);
  }
}
