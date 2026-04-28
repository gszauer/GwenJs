// GroupBox — a titled frame with an inner panel for child content.
// Ports `Gwen::Controls::GroupBox` from include/Gwen/Controls/GroupBox.h
// + src/Controls/GroupBox.cpp.
//
// The skin renders the frame in two passes (see `Skin.drawGroupBox`) so
// the title text sits in a gap in the top border. Children added to a
// GroupBox land on its inner panel — Base's `addChild` walks the
// `_innerPanel` redirect automatically, so user code just does
// `new SomeControl(groupBox)` and it ends up in the right place.

import { Base } from './Base';
import { Label } from './Label';
import { Pos } from '../core/Align';
import { margin } from '../core/Structures';
import type { Skin } from '../skin/Skin';

export class GroupBox extends Label {
  protected _innerMarginPx = 6;
  protected _inner: Base;

  constructor(parent: Base | null) {
    super(parent);
    this.setAlignment(Pos.Top | Pos.Left);
    this.setTextPadding(margin(10, 0, 0, 0));
    this.setMouseInputEnabled(true);

    // Install the inner panel. Base.addChild redirects subsequent children
    // through `_innerPanel` so the ordinary `new Foo(groupBox)` idiom
    // places them inside the frame.
    const inner = new Base(this);
    inner.dock(Pos.Fill);
    this._inner = inner;
    this.setInnerPanel(inner);
  }

  // =====================================================================
  // Inner margin
  // =====================================================================

  setInnerMargin(px: number): void {
    if (this._innerMarginPx === px) return;
    this._innerMarginPx = px;
    this.invalidate();
  }

  getInnerMargin(): number {
    return this._innerMarginPx;
  }

  // The inner panel itself, for callers that want to configure it
  // directly (set a color, override docking, etc).
  override getInnerPanel(): Base {
    return this._inner;
  }

  // =====================================================================
  // Layout
  // =====================================================================

  override layout(skin: Skin): void {
    super.layout(skin);
    if (!this._inner) return;
    const th = this.textHeight();
    const m = this._innerMarginPx;
    this._inner.setMargin(margin(m, Math.floor(th / 2) + m, m, m));
  }

  // =====================================================================
  // Render
  // =====================================================================

  override render(skin: Skin): void {
    skin.drawGroupBox(this, this.textX(), this.textHeight(), this.textWidth());
  }
}
