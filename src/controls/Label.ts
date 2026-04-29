// Label — a single-line (or wrap-mode) text control. Ports
// `Gwen::Controls::Label` from include/Gwen/Controls/Label.h +
// src/Controls/Label.cpp.
//
// A Label is a thin presentational wrapper around an internal `Text`
// child: the Text owns the actual characters, font, and color, while
// Label layers alignment, text-padding, and skin-driven color presets
// (makeColorNormal / makeColorBright / makeColorDark / makeColorHighlight).
//
// Mouse input is disabled by default — labels are for display, not
// hit-testing. Subclasses (Button, Checkbox, etc.) opt back in.

import { Base } from './Base';
import { Text } from './Text';
import type { Skin } from '../skin/Skin';
import { font as mkFont, type Font } from '../skin/FontAtlas';
import { Pos } from '../core/Align';
import { margin, type Color, type Padding, type Rect } from '../core/Structures';

export class Label extends Base {
  protected _text: Text;
  protected _align: number = Pos.Left | Pos.Top;

  // When `setFontByName` is called we allocate a Font and retain it here
  // so the skin's glyph cache doesn't leak at teardown. User-supplied
  // Fonts (setFont) are the caller's responsibility.
  private _createdFont: Font | null = null;

  constructor(parent: Base | null) {
    super(parent);
    this.setMouseInputEnabled(false);
    this.setBounds(0, 0, 100, 10);

    this._text = new Text(this);
    this._text.setFont(null); // resolve lazily from skin.getDefaultFont()
    this._text.setPadding(margin(0, 0, 0, 0));

    this.setAlignment(Pos.Left | Pos.CenterV);
  }

  // =====================================================================
  // Text
  // =====================================================================

  // Promote the placeholder Base tooltip from Base.setToolTip to a real
  // text-bearing Label so Canvas can size and render it directly.
  override setToolTip(text: string): void {
    if (!text) {
      this.setToolTipControl(null);
      return;
    }
    const tip = new Label(null);
    tip.setText(text);
    // Mirror Base.setToolTip's contract: the placeholder's name was set
    // to the text, so callers (and tests) can keep using getName() to
    // recover the tooltip text.
    tip.setName(text);
    tip.setPadding(margin(5, 3, 5, 3));
    // Parent first so the inner Text can reach the skin via the
    // ancestor chain — Text.refreshSize early-returns when no skin is
    // reachable, and `sizeToContents` calls into refreshSize. Sizing
    // before parenting leaves the tip at the default 10×10 + padding,
    // which truncates the rendered tooltip to a tiny stub.
    this.setToolTipControl(tip);
    tip.sizeToContents();
  }

  setText(s: string, doEvents = true): void {
    if (this._text.getText() === s) return;
    this._text.setText(s);
    this.invalidate();
    this.redraw();
    if (doEvents) this.onTextChanged();
  }

  getText(): string {
    return this._text.getText();
  }

  textLength(): number {
    return this._text.length();
  }

  // =====================================================================
  // Alignment
  // =====================================================================

  setAlignment(a: number): void {
    if (this._align === a) return;
    this._align = a;
    this.invalidate();
  }

  getAlignment(): number {
    return this._align;
  }

  // =====================================================================
  // Font
  // =====================================================================

  setFont(f: Font): void {
    this._text.setFont(f);
    this.invalidate();
  }

  /**
   * Allocate a fresh `Font` and hand it to the internal Text. The Label
   * retains ownership so the font's atlas handle can be released when
   * the Label is disposed.
   */
  setFontByName(facename: string, size: number, bold = false): void {
    const f = mkFont(facename, size, bold);
    this._createdFont = f;
    this._text.setFont(f);
    this.invalidate();
  }

  getFont(): Font | null {
    return this._text.getFont();
  }

  // =====================================================================
  // Color
  // =====================================================================

  setTextColor(c: Color): void {
    this._text.setTextColor(c);
  }

  textColor(): Color {
    return this._text.textColor();
  }

  effectiveTextColor(skin: Skin): Color {
    return this._text.effectiveTextColor(skin);
  }

  setTextColorOverride(c: Color): void {
    this._text.setTextColorOverride(c);
  }

  // =====================================================================
  // Wrap
  // =====================================================================

  setWrap(w: boolean): void {
    this._text.setWrap(w);
    this.invalidate();
  }

  getWrap(): boolean {
    return this._text.getWrap();
  }

  // =====================================================================
  // Text padding (GWEN calls this "text padding" — independent of the
  // control's own padding, applied only inside Text).
  // =====================================================================

  setTextPadding(p: Padding): void {
    this._text.setPadding(p);
    this.invalidate();
  }

  getTextPadding(): Padding {
    return this._text.getPadding();
  }

  // =====================================================================
  // Text metric accessors
  // =====================================================================

  textWidth(): number {
    return this._text.width();
  }

  textHeight(): number {
    return this._text.height();
  }

  textRight(): number {
    return this._text.right();
  }

  textX(): number {
    return this._text.x();
  }

  textY(): number {
    return this._text.y();
  }

  // =====================================================================
  // sizeToContents — shrink-wrap to text + padding
  // =====================================================================

  sizeToContents(): void {
    const pad = this.getPadding();
    this._text.setPos(pad.left, pad.top);
    this._text.refreshSize();
    this.setSize(
      this._text.width() + pad.left + pad.right,
      this._text.height() + pad.top + pad.bottom,
    );
  }

  // =====================================================================
  // Skin color presets (label.default / bright / dark / highlight)
  // =====================================================================

  makeColorNormal(): void {
    this._text.setTextColorPreset('default');
  }

  makeColorBright(): void {
    this._text.setTextColorPreset('bright');
  }

  makeColorDark(): void {
    this._text.setTextColorPreset('dark');
  }

  makeColorHighlight(): void {
    this._text.setTextColorPreset('highlight');
  }

  // =====================================================================
  // Value aliases (GWEN exposes Get/SetValue on Label for use as a
  // generic "string carrier" by Property controls).
  // =====================================================================

  getValue(): string {
    return this.getText();
  }

  setValue(s: string): void {
    this.setText(s);
  }

  // =====================================================================
  // Layout
  // =====================================================================

  override postLayout(_skin: Skin): void {
    // Sync the inner Text's width to the Label's interior so wrap mode
    // has a real constraint — Text.refreshSizeWrap reads `this.width()`
    // for the line-break math. Without this the Text stays at its
    // 10×10 constructor default, wrap can't produce sensible lines, and
    // a TextBoxMultiline shows no text as the user types.
    if (this._text.getWrap()) {
      const pad = this.getPadding();
      const w = Math.max(1, this.width() - pad.left - pad.right);
      if (this._text.width() !== w) {
        this._text.setBounds(pad.left, pad.top, w, this._text.height());
        this._text.refreshSizeWrap();
      }
    }
    this._text.position(this._align);
  }

  // Rebuilds the text layout whenever the Label itself resizes — without
  // this, wrap-mode labels would keep their pre-resize line layout even
  // after the parent changed width.
  protected override onBoundsChanged(old: Rect): void {
    super.onBoundsChanged(old);
    if (this._text && this._text.getWrap()) {
      const pad = this.getPadding();
      const w = Math.max(1, this.width() - pad.left - pad.right);
      this._text.setBounds(pad.left, pad.top, w, this._text.height());
      this._text.refreshSizeWrap();
      this.invalidate();
    }
  }

  // =====================================================================
  // Subclass hook
  // =====================================================================

  /**
   * Fires after `setText(s, true)`. Default is a no-op; subclasses
   * (Button, MenuItem) override to re-layout internal children.
   */
  protected onTextChanged(): void {
    // no-op
  }

  // =====================================================================
  // Dispose
  // =====================================================================

  override dispose(): void {
    if (this._createdFont) {
      const skin = this.getSkinOrNull();
      if (skin) skin.releaseFont(this._createdFont);
      this._createdFont = null;
    }
    super.dispose();
  }

  private getSkinOrNull(): Skin | null {
    try {
      return this.getSkin();
    } catch {
      return null;
    }
  }
}
