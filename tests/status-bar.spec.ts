// T113 — StatusBar
//
// Categories covered:
//   1  Render          — #4 pixel read confirms skin draws something
//   2  Visual baseline — Skipped: GPU/skin variance across CI
//   3  State visuals   — N/A: StatusBar has no interactive states
//   4  Pointer input   — N/A: StatusBar accepts mouse but has no click behavior
//   5  Touch input     — N/A: same
//   6  Keyboard        — N/A
//   7  Events          — N/A: StatusBar exposes no signals
//   8  Resize          — N/A: docked Pos.Bottom; no explicit resize behavior

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T113 StatusBar', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction + defaults
  // =========================================================================

  test('1 — new StatusBar(canvas): height 22; docked Pos.Bottom', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const sb = new G.StatusBar(canvas);
        const h = sb.getBounds().h;
        const dock = sb.getDock();
        sb.dispose();
        return { threw: false, h, dock, bottom: G.Pos.Bottom };
      } catch {
        return { threw: true, h: 0, dock: 0, bottom: 0 };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.h).toBe(22);
    expect(result.dock).toBe(result.bottom);
  });

  // =========================================================================
  // 2. addControl with right=true docks Right
  // =========================================================================

  test('2 — addControl(child, true) docks child to Right', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const sb = new G.StatusBar(canvas);
      const child = new G.Base(null);
      sb.addControl(child, true);
      const dock = child.getDock();
      sb.dispose();
      return { dock, right: G.Pos.Right };
    });
    expect(result.dock).toBe(result.right);
  });

  // =========================================================================
  // 3. addControl with right=false docks Left
  // =========================================================================

  test('3 — addControl(child, false) docks child to Left', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const sb = new G.StatusBar(canvas);
      const child = new G.Base(null);
      sb.addControl(child, false);
      const dock = child.getDock();
      sb.dispose();
      return { dock, left: G.Pos.Left };
    });
    expect(result.dock).toBe(result.left);
  });

  // =========================================================================
  // 4. Visual: render produces non-black pixels
  // =========================================================================

  test('4 — render: status bar draws non-black content', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 400; htmlC.height = 60;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cvs = new G.Canvas(skin, htmlC);
      cvs.setBounds(0, 0, 400, 60);
      cvs.setDrawBackground(true);
      cvs.setBackgroundColor(G.color(0, 0, 0, 255));

      const sb = new G.StatusBar(cvs);
      // StatusBar docks to Pos.Bottom; with parent height 60 and statusBar
      // height 22 it should occupy y=38..60 in logical coordinates.

      cvs.doThink();
      cvs.redraw();
      cvs.renderCanvas();

      const gl: WebGL2RenderingContext = renderer.gl;
      // Sample in the status bar region: y=45 (logical), x=200.
      const px = 200, py = 45;
      const glY = htmlC.height - (py + 1);
      const pixels = new Uint8Array(4);
      gl.readPixels(px, glY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      cvs.dispose();
      document.body.removeChild(htmlC);
      return { r: pixels[0], g: pixels[1], b: pixels[2], a: pixels[3] };
    });
    const hasContent = result.r > 0 || result.g > 0 || result.b > 0;
    expect(hasContent).toBe(true);
  });

  // =========================================================================
  // 5. Default padding is 2,2,2,2
  // =========================================================================

  test('5 — default padding is 2 on all sides', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const sb = new G.StatusBar(canvas);
      const p = sb.getPadding();
      sb.dispose();
      return { top: p.top, bottom: p.bottom, left: p.left, right: p.right };
    });
    expect(result.top).toBe(2);
    expect(result.bottom).toBe(2);
    expect(result.left).toBe(2);
    expect(result.right).toBe(2);
  });

  // =========================================================================
  // 6. setText + render does not throw
  // =========================================================================

  test('6 — setText("Ready") + render does not throw', async ({ page }) => {
    const threw = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 400; htmlC.height = 60;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cvs = new G.Canvas(skin, htmlC);
      cvs.setBounds(0, 0, 400, 60);

      try {
        const sb = new G.StatusBar(cvs);
        sb.setText('Ready');
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
});
