// PasswordTextBox — TextBox variant that stores the real text privately
// and displays a masked version (each character replaced with a fixed
// mask glyph). Ports `Gwen::Controls::TextBoxPassword` from
// include/Gwen/Controls/TextBox.h + src/Controls/TextBox.cpp.
//
// Design:
//   The real text is owned here in `_realText`. The inherited Label's
//   internal Text child is kept in sync with the masked rendering of
//   that buffer via `refreshMaskedText`, which calls `super.setText`
//   with `doEvents = false` so Label/TextBox's `onTextChanged` chain
//   does not fire (the masked text mutation is an implementation
//   detail, not a user-visible change). We emit our own `onTextChange`
//   event whenever `_realText` actually changes.
//
// Key routing — the TextBox base's editing primitives (`insertText`,
// `deleteText`, selection) all go through `this.getText()` and either
// `setText` or direct `this._text` manipulation. Because we override
// `getText`, `setText`, `insertText`, and `deleteText`, every code path
// that mutates the field routes through this class and correctly
// re-masks.
//
// Caret hit-test + render align with the masked rendering — see the
// `displayedText` override below. `onCopy` / `onCut` are also disabled
// so the real text never reaches the system clipboard, matching
// GWEN's "password copy is disabled" behaviour.

import { TextBox } from './TextBox';
import { eventInfo } from '../core/Events';
import type { Base } from './Base';

export class PasswordTextBox extends TextBox {
  protected _realText = '';
  protected _passwordChar = '*';

  constructor(parent: Base | null) {
    super(parent);
  }

  // ---------------------------------------------------------------------
  // Public knobs
  // ---------------------------------------------------------------------

  /** Set the mask glyph. Empty string resets to the default ('*'). */
  setPasswordChar(c: string): void {
    const next = c.length > 0 ? c[0] : '*';
    if (next === this._passwordChar) return;
    this._passwordChar = next;
    this.refreshMaskedText();
  }

  getPasswordChar(): string {
    return this._passwordChar;
  }

  // ---------------------------------------------------------------------
  // Text accessors — the override pair that keeps the real vs displayed
  // text distinct.
  // ---------------------------------------------------------------------

  /** Returns the unmasked text. */
  override getText(): string {
    return this._realText;
  }

  /**
   * Returns the masked rendering — used by TextBox's caret hit-test
   * (`charIndexAt`), horizontal-scroll math (`makeCaretVisible`), and
   * caret/selection draw (`renderOver`). Without this override the
   * base class measures against the unmasked real text, and any time
   * the mask glyph's width differs from the underlying characters'
   * widths (almost always: '*' vs lowercase letters) the visible
   * caret drifts off the glyph the user clicked — most obvious at
   * end-of-text where a click on the trailing whitespace area lands
   * the caret well past the last visible mask glyph.
   */
  protected override displayedText(): string {
    return this._passwordChar.repeat(this._realText.length);
  }

  /** Sets the unmasked text; display updates via `refreshMaskedText`. */
  override setText(s: string, doEvents = true): void {
    if (this._realText === s) return;
    this._realText = s;
    this.refreshMaskedText();
    // Clamp cursor indices to the new text length.
    const len = s.length;
    if (this.getCursorPos() > len) this.setCursorPos(len);
    if (this.getCursorEnd() > len) this.setCursorEnd(len);
    if (doEvents) this.emitTextChange();
  }

  // ---------------------------------------------------------------------
  // Edit primitives — route every mutation through `_realText`.
  // ---------------------------------------------------------------------

  override insertText(s: string): void {
    if (!this.isEditable()) return;
    if (this.hasSelection()) this.eraseSelection();
    const pos = this.getCursorPos();
    const next = this._realText.substring(0, pos) + s + this._realText.substring(pos);
    this._realText = next;
    this.refreshMaskedText();
    this.setCursorPos(pos + s.length);
    this.setCursorEnd(this.getCursorPos());
    this.emitTextChange();
  }

  override deleteText(start: number, len: number): void {
    if (!this.isEditable()) return;
    const t = this._realText;
    const a = Math.max(0, start);
    const b = Math.min(t.length, a + len);
    if (a >= b) return;
    this._realText = t.substring(0, a) + t.substring(b);
    this.refreshMaskedText();
    const cursor = this.getCursorPos();
    if (cursor >= b) this.setCursorPos(cursor - (b - a));
    else if (cursor > a) this.setCursorPos(a);
    this.setCursorEnd(this.getCursorPos());
    this.emitTextChange();
  }

  // ---------------------------------------------------------------------
  // Clipboard — deliberately disabled so the real password never hits
  // the system clipboard.
  // ---------------------------------------------------------------------

  override onCopy(): void {
    // intentionally empty
  }

  override onCut(): void {
    // intentionally empty
  }

  // ---------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------

  /**
   * Push the current masked rendering of `_realText` into the inherited
   * Label's Text child. We pass `doEvents = false` so Label doesn't
   * invoke TextBox's `onTextChanged` hook (which would re-emit our
   * `onTextChange` signal with the masked payload).
   */
  private refreshMaskedText(): void {
    const masked = this._passwordChar.repeat(this._realText.length);
    super.setText(masked, false);
  }

  private emitTextChange(): void {
    const info = eventInfo();
    info.controlCaller = this;
    this.onTextChange.emit(info);
  }
}
