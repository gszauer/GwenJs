// T117 — RichLabel
//
// Categories covered:
//   1  Render          — #8 pixel read for colored text regions
//   2  Visual baseline — Skipped: GPU/font variance across CI
//   3  State visuals   — #8 colored runs produce distinct pixel colors
//   4  Pointer input   — N/A: RichLabel disables mouse input by default
//   5  Touch input     — N/A: same reason
//   6  Keyboard        — N/A: RichLabel has no keyboard interaction
//   7  Events          — N/A: RichLabel exposes no signals
//   8  Resize          — #7 word-wrap; #9 resize triggers reflow

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T117 RichLabel', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction + defaults
  // =========================================================================

  test('1 — construction: empty blocks; mouse input disabled', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const rl = new G.RichLabel(canvas);
        const blockCount = (rl as any)._blocks.length;
        const mouseInput = rl.getMouseInputEnabled();
        rl.dispose();
        return { threw: false, blockCount, mouseInput };
      } catch {
        return { threw: true, blockCount: -1, mouseInput: true };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.blockCount).toBe(0);
    expect(result.mouseInput).toBe(false);
  });

  // =========================================================================
  // 2. addText single span
  // =========================================================================

  test('2 — addText("Hello"): internal block count is 1; rebuildRequired true', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const rl = new G.RichLabel(canvas);

      rl.addText('Hello');
      const blockCount = (rl as any)._blocks.length;
      const rebuildRequired = (rl as any)._rebuildRequired;
      rl.dispose();
      return { blockCount, rebuildRequired };
    });
    expect(result.blockCount).toBe(1);
    expect(result.rebuildRequired).toBe(true);
  });

  // =========================================================================
  // 3. addText with embedded newline splits into text+newline+text blocks
  // =========================================================================

  test('3 — addText("Hello\\nWorld"): 3 blocks (text, newline, text)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const rl = new G.RichLabel(canvas);

      rl.addText('Hello\nWorld');
      const blocks = (rl as any)._blocks as Array<{ kind: string }>;
      const count = blocks.length;
      const kinds = blocks.map((b) => b.kind);
      rl.dispose();
      return { count, kinds };
    });
    expect(result.count).toBe(3);
    expect(result.kinds).toEqual(['text', 'newline', 'text']);
  });

  // =========================================================================
  // 4. addLineBreak adds a newline block
  // =========================================================================

  test('4 — addLineBreak(): block list gets a newline entry', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const rl = new G.RichLabel(canvas);

      rl.addText('A');
      rl.addLineBreak();
      rl.addText('B');
      const blocks = (rl as any)._blocks as Array<{ kind: string }>;
      const kinds = blocks.map((b) => b.kind);
      rl.dispose();
      return kinds;
    });
    expect(result).toEqual(['text', 'newline', 'text']);
  });

  // =========================================================================
  // 5. clear() empties blocks
  // =========================================================================

  test('5 — clear(): blocks emptied; rebuildRequired true', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const rl = new G.RichLabel(canvas);

      rl.addText('Hello');
      rl.addText('World');
      rl.clear();
      const blockCount = (rl as any)._blocks.length;
      const rebuildRequired = (rl as any)._rebuildRequired;
      rl.dispose();
      return { blockCount, rebuildRequired };
    });
    expect(result.blockCount).toBe(0);
    expect(result.rebuildRequired).toBe(true);
  });

  // =========================================================================
  // 6. After layout(), children created as Text instances
  // =========================================================================

  test('6 — after doThink(), children are created from text content', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const rl = new G.RichLabel(canvas);
      rl.setBounds(10, 10, 200, 100);
      rl.addText('Hello World');

      // Run layout.
      canvas.doThink();

      const childCount = rl.children.length;
      // Every child should be a Text instance.
      const allText = Array.from(rl.children).every((c: any) => c instanceof G.Text);
      rl.dispose();
      return { childCount, allText };
    });
    expect(result.childCount).toBeGreaterThan(0);
    expect(result.allText).toBe(true);
  });

  // =========================================================================
  // 7. Word-wrap: narrow width → multiple children at different y positions
  // =========================================================================

  test('7 — narrow width forces word-wrap: children at different y positions', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const rl = new G.RichLabel(canvas);
      // Very narrow — forces each word to its own line.
      rl.setBounds(10, 10, 30, 200);
      rl.addText('Alpha Beta Gamma Delta');

      canvas.doThink();

      const children = Array.from(rl.children) as any[];
      const yValues = children.map((c) => c.y());
      const uniqueY = new Set(yValues).size;
      rl.dispose();
      return { childCount: children.length, uniqueY };
    });
    // With a 30px-wide control, words must wrap — expect more than 1 y level.
    expect(result.childCount).toBeGreaterThan(1);
    expect(result.uniqueY).toBeGreaterThan(1);
  });

  // =========================================================================
  // 8. Colored runs: two addText calls with different colors
  // =========================================================================

  test('8 — colored runs: red and blue text produce distinct colors when rendered', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 400; htmlC.height = 80;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cvs = new G.Canvas(skin, htmlC);
      cvs.setBounds(0, 0, 400, 80);
      cvs.setDrawBackground(true);
      // Neutral grey background — distinct from both red and blue.
      cvs.setBackgroundColor(G.color(128, 128, 128, 255));

      const rl = new G.RichLabel(cvs);
      // Place near top so we have room for the font's height.
      rl.setBounds(0, 5, 400, 40);

      // Two color runs. Use a newline to put them on separate rows so
      // we can locate each color without worrying about x-position.
      rl.addText('MMMM', G.color(255, 0, 0, 255));   // red — top row
      rl.addLineBreak();
      rl.addText('MMMM', G.color(0, 0, 255, 255));    // blue — second row

      cvs.doThink();
      cvs.redraw();
      cvs.renderCanvas();

      const gl: WebGL2RenderingContext = renderer.gl;
      const W = htmlC.width;
      const H = htmlC.height;

      // Scan all rows of the rendered area (y=5..70) for red and blue pixels.
      // Each color occupies its own line so they won't overlap.
      let foundRed = false;
      let foundBlue = false;
      for (let y = 5; y < 70 && !(foundRed && foundBlue); y++) {
        const glY = H - (y + 1);
        const buf = new Uint8Array(W * 4);
        gl.readPixels(0, glY, W, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        for (let x = 0; x < W; x++) {
          const i = x * 4;
          // Red: r dominant, g+b low.
          if (buf[i] > 180 && buf[i + 1] < 100 && buf[i + 2] < 100) foundRed = true;
          // Blue: b dominant, r+g low.
          if (buf[i + 2] > 180 && buf[i] < 100 && buf[i + 1] < 100) foundBlue = true;
        }
      }

      cvs.dispose();
      document.body.removeChild(htmlC);
      return { foundRed, foundBlue };
    });
    expect(result.foundRed).toBe(true);
    expect(result.foundBlue).toBe(true);
  });

  // =========================================================================
  // 9. Resize triggers reflow: narrow → wide reduces line count
  // =========================================================================

  test('9 — resize reflows: widening reduces line count (unique y positions)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const rl = new G.RichLabel(canvas);

      // Very narrow — forces every word to its own line.
      rl.setBounds(10, 10, 30, 300);
      rl.addText('Alpha Beta Gamma Delta Epsilon');
      canvas.doThink();

      const narrowYCount = new Set(Array.from(rl.children).map((c: any) => c.y())).size;

      // Widen enough to put all words on one line — y-count should drop to 1.
      rl.setWidth(600);
      canvas.doThink();

      const wideYCount = new Set(Array.from(rl.children).map((c: any) => c.y())).size;

      rl.dispose();
      return { narrowYCount, wideYCount };
    });
    // Widening must produce strictly fewer unique y positions (fewer lines).
    expect(result.wideYCount).toBeLessThan(result.narrowYCount);
  });

  // =========================================================================
  // 10. Dispose: removes all children
  // =========================================================================

  test('10 — dispose removes RichLabel from canvas children', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const before = canvas.numChildren();
      const rl = new G.RichLabel(canvas);
      rl.addText('Some text');
      canvas.doThink();
      const during = canvas.numChildren();
      rl.dispose();
      const after = canvas.numChildren();
      return { before, during, after };
    });
    expect(result.during).toBe(result.before + 1);
    expect(result.after).toBe(result.before);
  });
});
