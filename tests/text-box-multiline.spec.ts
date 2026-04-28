// T106 — TextBoxMultiline
//
// Categories covered:
//   1  Render          — #7 pixel read: multiline control produces pixels
//   2  Visual baseline — Skipped: GPU/font/skin variance across CI machines
//   3  State visuals   — Skipped: no distinct visual states beyond TextBox
//   4  Pointer input   — Skipped: inherits from TextBox
//   5  Touch input     — Skipped: inherits from TextBox
//   6  Keyboard        — onKeyReturn (#2–#3), Up/Down arrows (#4), Home/End (#5)
//   7  Events          — inherits TextBox onTextChange; verifies newline insertion
//   8  Resize          — N/A: fixed-size control
//
// Brittle notes:
//   • Up/Down arrow navigation (#4) depends on cursor position within the text.
//     We set text and cursor manually to avoid font-metric dependency.
//     The implementation uses lastIndexOf('\n') for line arithmetic, so pure
//     string offsets are deterministic regardless of rendering.

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T106 TextBoxMultiline', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction — wrap enabled, alignment Top|Left
  // =========================================================================

  test('1 — new TextBoxMultiline(canvas): wrap=true; alignment=Left|Top', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const tb = new G.TextBoxMultiline(canvas);
        const wrap = tb.getWrap();
        // Pos.Left=2, Pos.Top=8 → combined = 10
        const alignment = tb.getAlignment();
        const PosLeft = 1 << 1; // 2
        const PosTop  = 1 << 3; // 8
        const hasLeft = (alignment & PosLeft) !== 0;
        const hasTop  = (alignment & PosTop)  !== 0;
        tb.dispose();
        return { threw: false, wrap, hasLeft, hasTop };
      } catch {
        return { threw: true, wrap: false, hasLeft: false, hasTop: false };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.wrap).toBe(true);
    expect(result.hasLeft).toBe(true);
    expect(result.hasTop).toBe(true);
  });

  // =========================================================================
  // 2. onKeyReturn(true) inserts '\n' into the text
  // =========================================================================

  test('2 — onKeyReturn(true): inserts newline into text', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tb = new G.TextBoxMultiline(canvas);
      tb.setText('hello');
      tb.setCursorPos(5);
      tb.setCursorEnd(5);
      const ret = tb.onKeyReturn(true);
      const text = tb.getText();
      tb.dispose();
      return { ret, text };
    });
    expect(result.ret).toBe(true);
    expect(result.text).toContain('\n');
    expect(result.text).toBe('hello\n');
  });

  // =========================================================================
  // 3. onKeyReturn(false) returns true but does NOT blur (no side effect from
  //    the base TextBox.onKeyReturn blur — multiline overrides this to a no-op
  //    because Enter is a content character, not a submit action).
  // =========================================================================

  test('3 — onKeyReturn(false): returns true; does not modify text', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tb = new G.TextBoxMultiline(canvas);
      tb.setText('hello');
      tb.setCursorPos(5);
      tb.setCursorEnd(5);
      const ret = tb.onKeyReturn(false); // key-up
      const text = tb.getText();
      tb.dispose();
      return { ret, text };
    });
    expect(result.ret).toBe(true);
    expect(result.text).toBe('hello'); // no newline inserted on key-up
  });

  // =========================================================================
  // 4. Up/Down arrows navigate to correct column on previous/next line
  // =========================================================================

  test('4a — onKeyUp: moves cursor to previous line, preserving column', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tb = new G.TextBoxMultiline(canvas);
      // "abc\nde\nfghi"
      //  0123 456 78901
      // Line 0: "abc" (0–2), newline at 3
      // Line 1: "de"  (4–5), newline at 6
      // Line 2: "fghi" (7–10)
      tb.setText('abc\nde\nfghi');
      // Place cursor at col 3 on line 2 (pos=10, 'i')
      tb.setCursorPos(10);
      tb.setCursorEnd(10);
      tb.onKeyUp(true);
      const posAfterUp = tb.getCursorPos();
      tb.dispose();
      // Line 1 "de" has length 2; col 3 clamped to 2 → pos = 4+2 = 6 (end of "de")
      return { posAfterUp };
    });
    // line 1 starts at 4, len=2, col min(3,2)=2 → pos=6
    expect(result.posAfterUp).toBe(6);
  });

  test('4b — onKeyDown: moves cursor to next line, preserving column', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tb = new G.TextBoxMultiline(canvas);
      // "ab\ncde"
      //  01  2345
      // Line 0: "ab" (0–1), newline at 2
      // Line 1: "cde" (3–5)
      tb.setText('ab\ncde');
      // Place cursor at col 1 on line 0 (pos=1, 'b')
      tb.setCursorPos(1);
      tb.setCursorEnd(1);
      tb.onKeyDown(true);
      const posAfterDown = tb.getCursorPos();
      tb.dispose();
      // Line 1 starts at 3, col=1 → pos=4 ('d')
      return { posAfterDown };
    });
    expect(result.posAfterDown).toBe(4);
  });

  test('4c — onKeyUp at first line: no movement', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tb = new G.TextBoxMultiline(canvas);
      tb.setText('hello');
      tb.setCursorPos(3);
      tb.setCursorEnd(3);
      tb.onKeyUp(true);
      const pos = tb.getCursorPos();
      tb.dispose();
      return pos;
    });
    expect(result).toBe(3); // no change — already on first line
  });

  test('4d — onKeyDown at last line: no movement', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tb = new G.TextBoxMultiline(canvas);
      tb.setText('hello');
      tb.setCursorPos(3);
      tb.setCursorEnd(3);
      tb.onKeyDown(true);
      const pos = tb.getCursorPos();
      tb.dispose();
      return pos;
    });
    expect(result).toBe(3); // no change — already on last line
  });

  // =========================================================================
  // 5. Home/End go to line start/end (not whole-text boundaries)
  // =========================================================================

  test('5a — onKeyHome: moves to line start, not text start', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tb = new G.TextBoxMultiline(canvas);
      // "abc\nde"
      //  01 2  34
      // Line 1 "de" starts at index 4
      tb.setText('abc\nde');
      tb.setCursorPos(5); // mid-second-line
      tb.setCursorEnd(5);
      tb.onKeyHome(true);
      const pos = tb.getCursorPos();
      tb.dispose();
      return pos;
    });
    expect(result).toBe(4); // line 1 starts at 4, not 0
  });

  test('5b — onKeyEnd: moves to line end, not text end', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tb = new G.TextBoxMultiline(canvas);
      // "ab\ncde"
      //  01  234
      // Line 0 ends before the '\n' at index 2
      tb.setText('ab\ncde');
      tb.setCursorPos(1); // mid-first-line
      tb.setCursorEnd(1);
      tb.onKeyEnd(true);
      const pos = tb.getCursorPos();
      tb.dispose();
      return pos;
    });
    expect(result).toBe(2); // first-line end = index of '\n'
  });

  // =========================================================================
  // 6. insertText with multi-line string preserves newlines
  // =========================================================================

  test('6 — insertText("line1\\nline2"): newlines preserved in text', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tb = new G.TextBoxMultiline(canvas);
      tb.setText('');
      tb.setCursorPos(0);
      tb.setCursorEnd(0);
      tb.insertText('line1\nline2');
      const text = tb.getText();
      tb.dispose();
      return text;
    });
    expect(result).toBe('line1\nline2');
    expect(result.split('\n')).toHaveLength(2);
  });

  // =========================================================================
  // 7. Render produces pixels
  // =========================================================================

  test('7 — render: TextBoxMultiline produces non-background pixels', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 220; htmlC.height = 80;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cvs = new G.Canvas(skin, htmlC);
      cvs.setBounds(0, 0, 220, 80);
      cvs.setDrawBackground(true);
      cvs.setBackgroundColor(G.color(0, 0, 0, 255));

      const tb = new G.TextBoxMultiline(cvs);
      tb.setBounds(10, 10, 200, 60);
      tb.setText('line1\nline2');

      cvs.doThink();
      cvs.redraw();
      cvs.renderCanvas();

      const gl: WebGL2RenderingContext = renderer.gl;
      const W = 200; const H = 60;
      const glY = htmlC.height - (10 + H);
      const pixels = new Uint8Array(W * H * 4);
      gl.readPixels(10, glY, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      cvs.dispose();
      document.body.removeChild(htmlC);

      let hasContent = false;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] > 10 || pixels[i + 1] > 10 || pixels[i + 2] > 10) {
          hasContent = true;
          break;
        }
      }
      return hasContent;
    });
    expect(result).toBe(true);
  });
});
