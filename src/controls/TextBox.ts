// TextBox — single-line editable text field. Ports
// `Gwen::Controls::TextBox` from include/Gwen/Controls/TextBox.h +
// src/Controls/TextBox.cpp.
//
// TextBox extends Label so it inherits the Text child, padding, font, and
// alignment plumbing. On top of that we layer:
//   * cursor position (`_cursorPos`) + selection anchor (`_cursorEnd`)
//   * key handling for arrow keys, Home/End, Backspace/Delete, Return
//   * pointer-driven caret placement + drag-select via mouseFocus capture
//   * blinking caret driven by the per-frame `think()` hook
//   * navigator.clipboard integration for copy/cut/paste
//
// Intentional simplifications vs GWEN:
//   * Not multi-line (TextBoxMultiline) or password (PasswordTextBox) yet.
//
// Naming deviation from the spec: the signal is `onTextChange` (singular)
// rather than `onTextChanged`, because Label already exposes a protected
// `onTextChanged()` hook and TS refuses to let a derived class shadow an
// inherited method with a field of the same name. We override Label's
// hook so every `setText` call — however the text mutates — emits through
// `onTextChange` exactly once.

import { Label } from './Label';
import { Base } from './Base';
import { Pos } from '../core/Align';
import {
  color,
  point,
  rect,
  margin,
  type Color,
  type Point,
} from '../core/Structures';
import { Signal, eventInfo, type EventInfo } from '../core/Events';
import { Key } from '../core/Input';
import type { Skin } from '../skin/Skin';
import type { Font } from '../skin/FontAtlas';
import type { Canvas } from './Canvas';

// Caret blink interval in seconds. GWEN uses 1.5s on, 0.5s off; we apply
// a simple 0.5s toggle with a 1.5s "hold after keystroke" so the caret
// is solidly visible during active typing before it starts blinking.
const CARET_HOLD_SEC = 1.5;
const CARET_BLINK_SEC = 0.5;

export class TextBox extends Label {
  readonly onTextChange = new Signal<EventInfo>();
  readonly onReturnPressed = new Signal<EventInfo>();

  protected _cursorPos = 0;
  protected _cursorEnd = 0;
  protected _editable = true;
  protected _selectAll = false;

  protected _caretColor: Color = color(30, 30, 30, 255);
  protected _nextCaretBlink = 0;
  protected _caretVisible = true;

  // Pixel offset applied to the inner Text when the caret would
  // otherwise drift past the right edge of the visible area. Updated by
  // `makeCaretVisible`, applied in `layout` after the Label's
  // `sizeToContents` resets the inner Text's position.
  protected _textOffsetX = 0;

  constructor(parent: Base | null) {
    super(parent);
    this.setSize(200, 20);
    this.setPadding(margin(4, 2, 4, 2));
    this.setMouseInputEnabled(true);
    this.setKeyboardInputEnabled(true);
    this.setTabable(true);
    this.setAlignment(Pos.Left | Pos.CenterV);
    this.setShouldDrawBackground(true);
    // No explicit setTextColor — Text falls back to
    // `skin.colors.label.default`, which tracks the active theme. The
    // earlier hardcoded #323232 looked fine on a light background but
    // was unreadable in dark mode.
  }

  // =====================================================================
  // Input-flag overrides
  // =====================================================================

  override needsInputChars(): boolean {
    return true;
  }

  // =====================================================================
  // Editable / selection queries
  // =====================================================================

  isEditable(): boolean {
    return this._editable;
  }

  setEditable(b: boolean): void {
    this._editable = b;
  }

  getCursorPos(): number {
    return this._cursorPos;
  }

  getCursorEnd(): number {
    return this._cursorEnd;
  }

  hasSelection(): boolean {
    return this._cursorPos !== this._cursorEnd;
  }

  getSelection(): string {
    if (!this.hasSelection()) return '';
    const a = Math.min(this._cursorPos, this._cursorEnd);
    const b = Math.max(this._cursorPos, this._cursorEnd);
    return this.getText().substring(a, b);
  }

  setCursorPos(i: number): void {
    const clamped = Math.max(0, Math.min(this.getText().length, i));
    if (clamped === this._cursorPos) return;
    this._cursorPos = clamped;
    this.resetCaretBlink();
    this.makeCaretVisible();
    this.redraw();
  }

  setCursorEnd(i: number): void {
    const clamped = Math.max(0, Math.min(this.getText().length, i));
    if (clamped === this._cursorEnd) return;
    this._cursorEnd = clamped;
    this.redraw();
  }

  // Adjust `_textOffsetX` so the caret is always inside the visible area.
  // Called whenever the cursor position or text content changes. Mirrors
  // GWEN's `MakeCaretVisible` — slides the text horizontally by the
  // smallest amount needed to keep the caret on-screen.
  //
  // Wrap mode (TextBoxMultiline) doesn't scroll horizontally — long
  // lines wrap instead. Skip the offset math entirely so the caret-X
  // measurement (which would otherwise treat the multi-line prefix as
  // a single run and produce a meaningless X) doesn't put the inner
  // Text into a stale offset.
  makeCaretVisible(): void {
    if (this._text.getWrap()) {
      if (this._textOffsetX !== 0) {
        this._textOffsetX = 0;
        this.invalidate();
      }
      return;
    }
    const skin = this.getSkin();
    const font = this.getFont() ?? skin.getDefaultFont();
    const pad = this.getPadding();
    const visibleW = this.width() - pad.left - pad.right;
    if (visibleW <= 0) return;
    const caretX = skin.renderer.measureText(font, this.displayedText().substring(0, this._cursorPos)).x;
    if (caretX - this._textOffsetX > visibleW - 1) {
      this._textOffsetX = caretX - visibleW + 1;
    } else if (caretX - this._textOffsetX < 0) {
      this._textOffsetX = caretX;
    }
    if (this._textOffsetX < 0) this._textOffsetX = 0;
    this.invalidate();
  }

  setSelectAllOnFocus(b: boolean): void {
    this._selectAll = b;
    if (b) this.onSelectAllAccel();
  }

  // =====================================================================
  // Visual-text hook — returns the string that's actually painted into
  // the inner Text. Defaults to `getText()`. PasswordTextBox overrides
  // to return the masked rendering so caret hit-testing, the caret-X
  // measurement in makeCaretVisible, and the caret/selection
  // measurements in renderOver all line up with the glyphs the user
  // sees on screen rather than the raw characters they typed (whose
  // widths differ from the mask glyph).
  // =====================================================================

  protected displayedText(): string {
    return this.getText();
  }

  // =====================================================================
  // Edit primitives
  // =====================================================================

  deleteText(start: number, len: number): void {
    if (!this._editable) return;
    const t = this.getText();
    const a = Math.max(0, start);
    const b = Math.min(t.length, a + len);
    if (a >= b) return;
    this.setText(t.substring(0, a) + t.substring(b));
    if (this._cursorPos >= b) {
      this._cursorPos -= b - a;
    } else if (this._cursorPos > a) {
      this._cursorPos = a;
    }
    this._cursorEnd = this._cursorPos;
    this.resetCaretBlink();
  }

  insertText(s: string): void {
    if (!this._editable) return;
    if (this.hasSelection()) this.eraseSelection();
    const t = this.getText();
    const pos = this._cursorPos;
    this.setText(t.substring(0, pos) + s + t.substring(pos));
    this._cursorPos += s.length;
    this._cursorEnd = this._cursorPos;
    this.resetCaretBlink();
  }

  eraseSelection(): void {
    if (!this.hasSelection()) return;
    const a = Math.min(this._cursorPos, this._cursorEnd);
    const b = Math.max(this._cursorPos, this._cursorEnd);
    this.deleteText(a, b - a);
    this._cursorPos = a;
    this._cursorEnd = a;
  }

  // =====================================================================
  // Character input
  // =====================================================================

  override onChar(c: string): boolean {
    if (!this._editable) return false;
    if (c === '\t' || c.length !== 1) return false;
    this.insertText(c);
    return true;
  }

  // =====================================================================
  // Key handlers — arrow keys, Home/End respect Shift for selection
  // =====================================================================

  override onKeyLeft(down: boolean): boolean {
    if (!down) return true;
    const shiftDown = this.isShiftDown();
    this.setCursorPos(this._cursorPos - 1);
    if (!shiftDown) this.setCursorEnd(this._cursorPos);
    return true;
  }

  override onKeyRight(down: boolean): boolean {
    if (!down) return true;
    const shiftDown = this.isShiftDown();
    this.setCursorPos(this._cursorPos + 1);
    if (!shiftDown) this.setCursorEnd(this._cursorPos);
    return true;
  }

  override onKeyHome(down: boolean): boolean {
    if (!down) return true;
    const shiftDown = this.isShiftDown();
    this.setCursorPos(0);
    if (!shiftDown) this.setCursorEnd(this._cursorPos);
    return true;
  }

  override onKeyEnd(down: boolean): boolean {
    if (!down) return true;
    const shiftDown = this.isShiftDown();
    this.setCursorPos(this.getText().length);
    if (!shiftDown) this.setCursorEnd(this._cursorPos);
    return true;
  }

  override onKeyBackspace(down: boolean): boolean {
    if (!down) return true;
    if (this.hasSelection()) {
      this.eraseSelection();
      return true;
    }
    if (this._cursorPos > 0) this.deleteText(this._cursorPos - 1, 1);
    return true;
  }

  override onKeyDelete(down: boolean): boolean {
    if (!down) return true;
    if (this.hasSelection()) {
      this.eraseSelection();
      return true;
    }
    if (this._cursorPos < this.getText().length) this.deleteText(this._cursorPos, 1);
    return true;
  }

  override onKeyReturn(down: boolean): boolean {
    // Fire on key-up so callers that blur us from the handler don't see
    // a stray repeat on the same Enter press.
    if (down) return true;
    this.blur();
    const info = eventInfo();
    info.controlCaller = this;
    this.onReturnPressed.emit(info);
    return true;
  }

  // =====================================================================
  // Mouse — caret placement + drag-select
  // =====================================================================

  /**
   * Best-effort character-index hit test from a TextBox-local (x, y).
   * Scans prefixes and picks the one whose right edge is closest to x.
   *
   * In wrap mode the y coordinate selects a hard-newline-delimited line
   * first (line index = floor((y - pad.top) / lineHeight)) and the
   * prefix scan runs against just that line's text — a single-line
   * substring measure for x. Without this, a click on visual line 2 or
   * 3 of a TextBoxMultiline would be hit-tested against the entire
   * source string and the caret would land somewhere on line 1 (often
   * "end of line 1" because newlines have ~0 measured width).
   *
   * y is optional for backwards compatibility with single-line callers
   * (and tests) that pass only x.
   */
  charIndexAt(localX: number, localY?: number): number {
    const text = this.displayedText();
    if (!text) return 0;
    const skin = this.getSkin();
    const font = this.getFont() ?? skin.getDefaultFont();
    const pad = this.getPadding();

    // Resolve the target line (full text for single-line, or the line
    // hit by y for wrap mode). lineStart is the index in `text` where
    // the line begins; lineText is the line's content (no '\n').
    let lineStart = 0;
    let lineText = text;
    if (this._text.getWrap() && localY !== undefined) {
      const lineH = Math.max(1, Math.ceil(skin.renderer.measureText(font, 'Ag').y));
      const lineIdx = Math.max(0, Math.floor((localY - pad.top) / lineH));
      let curLine = 0;
      while (curLine < lineIdx) {
        const nextNL = text.indexOf('\n', lineStart);
        if (nextNL === -1) break;
        lineStart = nextNL + 1;
        curLine++;
      }
      const nextNL = text.indexOf('\n', lineStart);
      const lineEnd = nextNL === -1 ? text.length : nextNL;
      lineText = text.substring(lineStart, lineEnd);
    }

    let best = 0;
    let bestDist = Math.abs(localX - pad.left);
    for (let i = 1; i <= lineText.length; i++) {
      const w = skin.renderer.measureText(font, lineText.substring(0, i)).x;
      const px = pad.left + w;
      const d = Math.abs(localX - px);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return lineStart + best;
  }

  override onMouseClickLeft(x: number, y: number, pressed: boolean): void {
    const canvas = this.getCanvas();
    if (pressed) {
      if (canvas) canvas.mouseFocus = this;
      if (this._selectAll) {
        this.onSelectAllAccel();
        this._selectAll = false;
        return;
      }
      const local = this.canvasPosToLocal(point(x, y));
      const idx = this.charIndexAt(local.x, local.y);
      this.setCursorPos(idx);
      if (!this.isShiftDown()) this.setCursorEnd(idx);
      return;
    }
    if (canvas && canvas.mouseFocus === this) canvas.mouseFocus = null;
  }

  override onMouseMoved(x: number, y: number, dx: number, dy: number): void {
    void dx;
    void dy;
    const canvas = this.getCanvas();
    if (!canvas || canvas.mouseFocus !== this) return;
    const local = this.canvasPosToLocal(point(x, y));
    const idx = this.charIndexAt(local.x, local.y);
    this.setCursorPos(idx);
  }

  override onMouseDoubleClickLeft(x: number, y: number): void {
    void x;
    void y;
    this.onSelectAllAccel();
  }

  // =====================================================================
  // Clipboard + select-all accelerators
  //
  // Exposed as the standard Base.onPaste/onCopy/onCut/onSelectAll hooks
  // so a future accelerator router (Ctrl+C/V/X/A) can route into them
  // generically. `navigator.clipboard` is used when available; failures
  // fall through silently — a TextBox with no clipboard permission is
  // still functional for local typing.
  // =====================================================================

  onSelectAllAccel(): void {
    this._cursorPos = 0;
    this._cursorEnd = this.getText().length;
    this.redraw();
  }

  override onSelectAll(): void {
    this.onSelectAllAccel();
  }

  onCopyAccel(): void {
    const sel = this.getSelection();
    if (!sel) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      // Fire-and-forget — we never await clipboard writes.
      navigator.clipboard.writeText(sel).catch(() => {
        // Clipboard access may be denied; ignore.
      });
    }
  }

  override onCopy(): void {
    this.onCopyAccel();
  }

  onCutAccel(): void {
    this.onCopyAccel();
    this.eraseSelection();
  }

  override onCut(): void {
    this.onCutAccel();
  }

  onPasteAccel(): void {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard
      .readText()
      .then((text) => {
        if (text) this.insertText(text);
      })
      .catch(() => {
        // Clipboard access may be denied; ignore.
      });
  }

  override onPaste(): void {
    this.onPasteAccel();
  }

  // =====================================================================
  // Per-frame tick — caret blink
  // =====================================================================

  override think(): void {
    super.think();
    const now = performance.now() / 1000;
    if (now >= this._nextCaretBlink) {
      this._caretVisible = !this._caretVisible;
      this._nextCaretBlink = now + CARET_BLINK_SEC;
      if (this.hasFocus()) this.redraw();
    }
  }

  // =====================================================================
  // Focus hooks — reset caret to solid state on focus, hide on blur
  // =====================================================================

  override onKeyboardFocus(): void {
    this.resetCaretBlink();
  }

  override onLostKeyboardFocus(): void {
    this._caretVisible = false;
    this.redraw();
  }

  // =====================================================================
  // Label hook override — re-emit text changes through the signal. This
  // fires whenever anyone calls `setText` on us (external or internal
  // edits), so handlers never miss a mutation path.
  // =====================================================================

  protected override onTextChanged(): void {
    super.onTextChanged();
    // Clamp cursor indices if the external setter shrunk the text out
    // from under them.
    const len = this.getText().length;
    if (this._cursorPos > len) this._cursorPos = len;
    if (this._cursorEnd > len) this._cursorEnd = len;
    this.makeCaretVisible();
    const info = eventInfo();
    info.controlCaller = this;
    this.onTextChange.emit(info);
  }

  override postLayout(skin: Skin): void {
    super.postLayout(skin);
    // Label.sizeToContents (run during layout) parks the inner Text at
    // (pad.left, pad.top); shift it left by `_textOffsetX` so long text
    // scrolls under the caret instead of running off the right edge.
    const pad = this.getPadding();
    this._text.setPos(pad.left - this._textOffsetX, pad.top);
  }

  // =====================================================================
  // Render
  // =====================================================================

  override render(skin: Skin): void {
    if (this.shouldDrawBackground()) {
      skin.drawTextBox(this);
    }
    // Intentionally do not call super: Label/Base render is a no-op and
    // the text itself is painted by the internal `Text` child during
    // the child-render pass.
  }

  override renderOver(skin: Skin): void {
    if (!this.hasFocus()) return;
    const pad = this.getPadding();
    const text = this.displayedText();
    const font = this.getFont() ?? skin.getDefaultFont();
    const off = this._textOffsetX;
    // Selection rect — drawn first so the caret sits on top.
    if (this.hasSelection()) {
      const a = Math.min(this._cursorPos, this._cursorEnd);
      const b = Math.max(this._cursorPos, this._cursorEnd);
      const xA = skin.renderer.measureText(font, text.substring(0, a)).x;
      const xB = skin.renderer.measureText(font, text.substring(0, b)).x;
      const selRect = rect(
        pad.left + xA - off,
        pad.top,
        xB - xA,
        this.height() - pad.top - pad.bottom,
      );
      skin.renderer.setDrawColor(color(50, 170, 255, 200));
      skin.renderer.drawFilledRect(selRect);
    }
    // Caret.
    if (this._caretVisible) {
      const caretX = pad.left + skin.renderer.measureText(font, text.substring(0, this._cursorPos)).x - off;
      const caretRect = rect(
        caretX,
        pad.top,
        1,
        this.height() - pad.top - pad.bottom,
      );
      skin.renderer.setDrawColor(this._caretColor);
      skin.renderer.drawFilledRect(caretRect);
    }
  }

  // =====================================================================
  // Internal helpers
  // =====================================================================

  /**
   * Stop blinking for `CARET_HOLD_SEC` seconds and show the caret. Called
   * on any caret movement or edit so the caret stays solidly visible
   * during active typing, then resumes blinking after the hold window.
   */
  private resetCaretBlink(): void {
    this._nextCaretBlink = performance.now() / 1000 + CARET_HOLD_SEC;
    this._caretVisible = true;
  }

  /** Reads shift state from the canvas; `false` when unreachable. */
  private isShiftDown(): boolean {
    const canvas = this.getCanvas() as Canvas | null;
    return canvas !== null && typeof canvas.isShiftDown === 'function' && canvas.isShiftDown();
  }
}
