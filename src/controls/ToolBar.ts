// ToolBar (ToolBarButton + ToolBarStrip) — a horizontal strip of icon
// buttons. Ports `Gwen::Controls::ToolBarButton` + `Gwen::Controls::ToolBar`
// from include/Gwen/Controls/ToolBar.h + src/Controls/ToolBar.cpp.
//
// ToolBarButton draws no chrome unless hovered; the strip itself reuses
// `Skin.drawMenuStrip` for the ambient background frame.

import { Base } from './Base';
import { Button } from './Button';
import { Pos } from '../core/Align';
import { margin } from '../core/Structures';
import type { Skin } from '../skin/Skin';

// ---------------------------------------------------------------------------
// ToolBarButton — 20×20 button, draws background only on hover.
// ---------------------------------------------------------------------------

export class ToolBarButton extends Button {
  constructor(parent: Base | null) {
    super(parent);
    this.setSize(20, 20);
    this.dock(Pos.Left);
  }

  override shouldDrawBackground(): boolean {
    return this.isHovered();
  }
}

// ---------------------------------------------------------------------------
// ToolBarStrip — horizontal host for ToolBarButtons.
// ---------------------------------------------------------------------------

export class ToolBarStrip extends Base {
  constructor(parent: Base | null) {
    super(parent);
    this.setSize(25, 25);
    this.setPadding(margin(2, 2, 2, 2));
  }

  add(text: string, icon = ''): ToolBarButton {
    const b = new ToolBarButton(this);
    b.setToolTip(text);
    if (icon !== '') b.setImage(icon, false);
    return b;
  }

  override render(skin: Skin): void {
    skin.drawMenuStrip(this);
  }
}
