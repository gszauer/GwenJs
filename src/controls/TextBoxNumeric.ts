// TextBoxNumeric — TextBox variant that restricts input to a valid
// numeric literal. Ports `Gwen::Controls::TextBoxNumeric` from
// include/Gwen/Controls/TextBox.h + src/Controls/TextBox.cpp.
//
// The filter gates individual characters *and* bulk pastes via the
// inherited `onChar` and `insertText` entry points. Rules:
//   - Digits (0-9) are always accepted.
//   - A single '-' is accepted iff it is the very first character (i.e.
//     inserted at position 0 and the existing text has no '-').
//   - A single '.' is accepted iff the existing text has no '.'.
// Anything else (including 'e' / 'E' for scientific notation, '+', or
// whitespace) is rejected, matching GWEN's behaviour.

import { TextBox } from './TextBox';
import type { Base } from './Base';

export class TextBoxNumeric extends TextBox {
  constructor(parent: Base | null) {
    super(parent);
    this.setText('0');
  }

  /**
   * Parse the current text as a floating-point number. Returns 0 for a
   * non-numeric or empty field (including a lone '-' or '.').
   */
  getFloatFromText(): number {
    const n = parseFloat(this.getText());
    return isNaN(n) ? 0 : n;
  }

  // ---------------------------------------------------------------------
  // Input gating
  // ---------------------------------------------------------------------

  override onChar(c: string): boolean {
    // Fast-reject the Tab escape the parent uses, and anything that isn't
    // a single codepoint.
    if (c === '\t' || c.length !== 1) return false;
    if (!this.isTextAllowed(c, this.getCursorPos())) return false;
    return super.onChar(c);
  }

  override insertText(s: string): void {
    if (!this.isTextAllowed(s, this.getCursorPos())) return;
    super.insertText(s);
  }

  /**
   * Returns true iff inserting `str` at `pos` would produce a still-valid
   * numeric literal. Called for both single-char typing and bulk paste.
   */
  protected isTextAllowed(str: string, pos: number): boolean {
    const existing = this.getText();
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      if (c === '-') {
        // Minus sign only valid at index 0 and only if no existing minus.
        if (i !== 0 || pos !== 0 || existing.includes('-')) return false;
      } else if (c === '.') {
        if (existing.includes('.')) return false;
      } else if (c < '0' || c > '9') {
        return false;
      }
    }
    return true;
  }
}
