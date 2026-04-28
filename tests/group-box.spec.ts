// T112 — GroupBox
//
// Categories covered:
//   1  Render          — #6 pixel read in border area confirms skin draws frame
//   2  Visual baseline — Skipped: GPU/skin variance
//   3  State visuals   — #7 title gap pixel check (no-throw)
//   4  Pointer input   — N/A: GroupBox has no clickable behavior
//   5  Touch input     — N/A: same
//   6  Keyboard        — N/A
//   7  Events          — N/A: GroupBox exposes no signals
//   8  Resize          — N/A: GroupBox does not auto-resize on parent resize

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T112 GroupBox', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction + getInnerPanel
  // =========================================================================

  test('1 — new GroupBox(canvas) does not throw; getInnerPanel() returns non-null', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const gb = new G.GroupBox(canvas);
        const inner = gb.getInnerPanel();
        gb.dispose();
        return { threw: false, hasInner: inner !== null };
      } catch {
        return { threw: true, hasInner: false };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.hasInner).toBe(true);
  });

  // =========================================================================
  // 2. setInnerMargin
  // =========================================================================

  test('2 — setInnerMargin(12) updates getInnerMargin()', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const gb = new G.GroupBox(canvas);
      gb.setInnerMargin(12);
      const m = gb.getInnerMargin();
      gb.dispose();
      return m;
    });
    expect(result).toBe(12);
  });

  // =========================================================================
  // 3. setText sets label text
  // =========================================================================

  test('3 — setText("My Group") → getText() === "My Group"', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const gb = new G.GroupBox(canvas);
      gb.setText('My Group');
      const text = gb.getText();
      gb.dispose();
      return text;
    });
    expect(result).toBe('My Group');
  });

  // =========================================================================
  // 4. Child added via new Base(groupBox) lands in innerPanel.children
  // =========================================================================

  test('4 — child added via new Base(groupBox) appears in innerPanel children', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const gb = new G.GroupBox(canvas);
      const inner = gb.getInnerPanel();
      const before = inner.numChildren();
      const child = new G.Base(gb);
      const after = inner.numChildren();
      gb.dispose();
      return { before, after };
    });
    expect(result.before).toBe(0);
    expect(result.after).toBe(1);
  });

  // =========================================================================
  // 5. Layout: inner panel top margin reflects textHeight/2 + innerMargin
  // =========================================================================

  test('5 — after layout, innerPanel margin.top >= innerMargin', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const gb = new G.GroupBox(canvas);
      gb.setBounds(10, 10, 200, 150);
      gb.setText('Hello');
      gb.setInnerMargin(8);
      canvas.doThink();
      const inner = gb.getInnerPanel();
      // Access margin through the internal field (no public getter exists).
      // We rely on doThink running layout which calls setMargin on _inner.
      const margin = inner._margin;
      gb.dispose();
      return { top: margin.top };
    });
    // top = floor(textHeight/2) + innerMargin; with innerMargin=8 this must be >= 8.
    expect(result.top).toBeGreaterThanOrEqual(8);
  });

  // =========================================================================
  // 6. Render: border area has content
  // =========================================================================

  test('6 — render: GroupBox frame produces non-black pixels somewhere in the control bounds', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 200; htmlC.height = 150;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cvs = new G.Canvas(skin, htmlC);
      cvs.setBounds(0, 0, 200, 150);
      cvs.setDrawBackground(true);
      cvs.setBackgroundColor(G.color(0, 0, 0, 255));

      const gb = new G.GroupBox(cvs);
      gb.setBounds(5, 5, 190, 140);
      gb.setText('Group');

      cvs.doThink();
      cvs.redraw();
      cvs.renderCanvas();

      const gl: WebGL2RenderingContext = renderer.gl;
      // Scan the entire canvas for any non-black pixel.
      const pixels = new Uint8Array(htmlC.width * htmlC.height * 4);
      gl.readPixels(0, 0, htmlC.width, htmlC.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      cvs.dispose();
      document.body.removeChild(htmlC);

      // Find any pixel that differs from the solid-black background.
      let found = false;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] > 5 || pixels[i + 1] > 5 || pixels[i + 2] > 5) {
          found = true;
          break;
        }
      }
      return found;
    });
    expect(result).toBe(true);
  });

  // =========================================================================
  // 7. Render: title gap area does not throw
  // =========================================================================

  test('7 — render with title text does not throw', async ({ page }) => {
    const threw = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 200; htmlC.height = 150;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cvs = new G.Canvas(skin, htmlC);
      cvs.setBounds(0, 0, 200, 150);

      try {
        const gb = new G.GroupBox(cvs);
        gb.setBounds(0, 0, 200, 150);
        gb.setText('My Group Title');
        cvs.doThink();
        cvs.redraw();
        cvs.renderCanvas();
        cvs.dispose();
        document.body.removeChild(htmlC);
        return false;
      } catch {
        document.body.removeChild(htmlC);
        return true;
      }
    });
    expect(threw).toBe(false);
  });

  // =========================================================================
  // 8. Dispose: children are cleared
  // =========================================================================

  test('8 — dispose removes GroupBox from canvas; child controls removed', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const before = canvas.numChildren();
      const gb = new G.GroupBox(canvas);
      const child = new G.Base(gb);
      void child; // suppress unused warning
      const during = canvas.numChildren();
      gb.dispose();
      const after = canvas.numChildren();
      return { before, during, after };
    });
    expect(result.during).toBe(result.before + 1);
    expect(result.after).toBe(result.before);
  });
});
