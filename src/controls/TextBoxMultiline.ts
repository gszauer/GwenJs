// TextBoxMultiline — TextBox variant that allows Return to insert a
// newline and supports Up/Down arrow navigation across lines. Ports
// `Gwen::Controls::TextBoxMultiline` (include/Gwen/Controls/TextBox.h +
// src/Controls/TextBox.cpp).
//
// Known limitations:
//   - The inherited TextBox.renderOver draws a single selection rect; a
//     cross-line selection will render as one flat band spanning the
//     bounding box of the selection endpoints rather than as per-line
//     rects. Tracked for future polish — does not affect correctness of
//     the underlying selection state.
//   - Wrap is enabled by default so the Label's internal Text child can
//     size itself vertically; word-wrap proper lands with T117's RichLabel
//     refactor, so today long soft-wrapped lines fall back to single-line
//     measurement. Explicit '\n' breaks work correctly.
//   - Caret measurement via `measureText` treats the full string as a
//     single run; on a multi-line string the caret will sit past the
//     end of the last visible line rather than on the actual caret row.
//     This will be fixed once Text.ts learns about line breaks.
//
// Column preservation on Up/Down mirrors GWEN: we remember the caret's
// byte-offset within its current line and jump to `min(col, prevLineLen)`
// on the target line.

import { TextBox } from './TextBox';
import { Pos } from '../core/Align';
import { color, rect } from '../core/Structures';
import type { Base } from './Base';
import type { Skin } from '../skin/Skin';

export class TextBoxMultiline extends TextBox {
  constructor(parent: Base | null) {
    super(parent);
    this.setWrap(true);
    this.setAlignment(Pos.Left | Pos.Top);
  }

  // ---------------------------------------------------------------------
  // Key handling
  // ---------------------------------------------------------------------

  override onKeyReturn(down: boolean): boolean {
    // Fire on key-down so newlines appear immediately, the same way typing
    // any other character does.
    if (down) this.insertText('\n');
    return true;
  }

  override onKeyUp(down: boolean): boolean {
    if (!down) return true;
    this.moveCaretVertically(-1);
    return true;
  }

  override onKeyDown(down: boolean): boolean {
    if (!down) return true;
    this.moveCaretVertically(1);
    return true;
  }

  override onKeyHome(down: boolean): boolean {
    if (!down) return true;
    const text = this.getText();
    const pos = this.getCursorPos();
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    this.setCursorPos(lineStart);
    if (!this.isShiftHeld()) this.setCursorEnd(lineStart);
    return true;
  }

  override onKeyEnd(down: boolean): boolean {
    if (!down) return true;
    const text = this.getText();
    const pos = this.getCursorPos();
    let lineEnd = text.indexOf('\n', pos);
    if (lineEnd === -1) lineEnd = text.length;
    this.setCursorPos(lineEnd);
    if (!this.isShiftHeld()) this.setCursorEnd(lineEnd);
    return true;
  }

  // ---------------------------------------------------------------------
  // Caret + selection render
  //
  // Replaces TextBox.renderOver, which measures the caret X across the
  // *entire* string and renders the caret quad as full-textbox-height —
  // both wrong for a multi-line edit. We scan to the cursor's line via
  // hard-break boundaries, measure the X within that line only, and
  // size the caret to one font line height.
  //
  // Soft-wrapped lines (text that wraps because it's too wide) still
  // collapse to their hard-break-only position; per-soft-line tracking
  // lands with the RichLabel refactor (T117).
  // ---------------------------------------------------------------------

  override renderOver(skin: Skin): void {
    if (!this.hasFocus()) return;
    const pad = this.getPadding();
    const font = this.getFont() ?? skin.getDefaultFont();
    const text = this.getText();
    const lineH = Math.max(1, Math.ceil(skin.renderer.measureText(font, 'Ag').y));
    const cursorPos = this.getCursorPos();
    const cursorEnd = this.getCursorEnd();

    // Resolve a position into (lineIndex, prefixWithinLine).
    const locate = (pos: number): { line: number; prefix: string } => {
      const before = text.substring(0, pos);
      const lastNewline = before.lastIndexOf('\n');
      const lineStart = lastNewline + 1;
      let line = 0;
      for (let i = 0; i < lastNewline + 1; i++) if (before[i] === '\n') line++;
      return { line, prefix: text.substring(lineStart, pos) };
    };

    // Selection — single-line rect when both ends share a line, otherwise
    // a flat band covering full lines between the endpoints. Imperfect
    // when start/end land on different lines (renders as one continuous
    // stripe) but visibly tracks the user's intent.
    if (cursorPos !== cursorEnd) {
      const a = Math.min(cursorPos, cursorEnd);
      const b = Math.max(cursorPos, cursorEnd);
      const la = locate(a);
      const lb = locate(b);
      const xA = skin.renderer.measureText(font, la.prefix).x;
      const xB = skin.renderer.measureText(font, lb.prefix).x;
      skin.renderer.setDrawColor(color(50, 170, 255, 200));
      if (la.line === lb.line) {
        skin.renderer.drawFilledRect(rect(pad.left + xA, pad.top + la.line * lineH, xB - xA, lineH));
      } else {
        // Top partial line, full middle lines, bottom partial line.
        const fullW = this.width() - pad.left - pad.right;
        skin.renderer.drawFilledRect(rect(pad.left + xA, pad.top + la.line * lineH, fullW - xA, lineH));
        for (let l = la.line + 1; l < lb.line; l++) {
          skin.renderer.drawFilledRect(rect(pad.left, pad.top + l * lineH, fullW, lineH));
        }
        skin.renderer.drawFilledRect(rect(pad.left, pad.top + lb.line * lineH, xB, lineH));
      }
    }

    if (this._caretVisible) {
      const here = locate(cursorPos);
      const caretX = pad.left + skin.renderer.measureText(font, here.prefix).x;
      const caretY = pad.top + here.line * lineH;
      skin.renderer.setDrawColor(skin.colors.label.default);
      skin.renderer.drawFilledRect(rect(caretX, caretY, 1, lineH));
    }
  }

  // ---------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------

  /**
   * Move caret up (`direction === -1`) or down (`direction === 1`) by one
   * line while preserving the caret's column (character offset within the
   * line). When Shift is held the selection anchor stays in place so the
   * user can grow/shrink a selection; otherwise the anchor follows.
   */
  private moveCaretVertically(direction: -1 | 1): void {
    const text = this.getText();
    const pos = this.getCursorPos();
    const curLineStart = text.lastIndexOf('\n', pos - 1) + 1;
    const col = pos - curLineStart;

    if (direction === -1) {
      if (curLineStart === 0) return; // already on first line
      const prevLineEnd = curLineStart - 1;
      const prevLineStart = text.lastIndexOf('\n', prevLineEnd - 1) + 1;
      const prevLineLen = prevLineEnd - prevLineStart;
      const newPos = prevLineStart + Math.min(col, prevLineLen);
      this.setCursorPos(newPos);
      if (!this.isShiftHeld()) this.setCursorEnd(newPos);
      return;
    }

    // direction === 1
    let nextLineStart = text.indexOf('\n', pos);
    if (nextLineStart === -1) return; // already on last line
    nextLineStart += 1;
    let nextLineEnd = text.indexOf('\n', nextLineStart);
    if (nextLineEnd === -1) nextLineEnd = text.length;
    const nextLineLen = nextLineEnd - nextLineStart;
    const newPos = nextLineStart + Math.min(col, nextLineLen);
    this.setCursorPos(newPos);
    if (!this.isShiftHeld()) this.setCursorEnd(newPos);
  }

  /** Reads shift state from the canvas; `false` when unreachable. */
  private isShiftHeld(): boolean {
    const canvas = this.getCanvas();
    if (!canvas) return false;
    // Canvas exposes `isShiftDown()` but CanvasLike (the structural
    // interface Base sees) does not. Duck-type the lookup so this file
    // never imports Canvas directly.
    const fn = (canvas as { isShiftDown?: () => boolean }).isShiftDown;
    return typeof fn === 'function' ? fn.call(canvas) : false;
  }
}
