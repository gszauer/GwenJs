// T114 — Rectangle
//
// Categories covered:
//   1  Render          — #3 pixel read confirms red fill on isolated canvas
//   2  Visual baseline — Skipped: solid color renders deterministically via
//                        pixel-read (#3) without screenshot fragility.
//   3  State visuals   — #4 semi-transparent alpha blended output
//   4  Pointer input   — N/A: Rectangle inherits Base mouse handling but has
//                        no special pointer behavior to test beyond Base.
//   5  Touch input     — N/A: same reason.
//   6  Keyboard        — N/A: no keyboard interaction.
//   7  Events          — N/A: Rectangle exposes no user-facing signals.
//   8  Resize          — N/A: Rectangle fills its bounds; layout resize is
//                        covered by the Base spec (T008).
//
// NOTE on pixel-read tests: All rendering tests use isolated canvases with
// DPR=1 so pixel coordinates are unambiguous across desktop (DPR=1) and
// mobile (DPR=3) projects. The gwenCanvas scissor clips vertex coordinates
// at dpr-scaled scissor boundaries, making gwenCanvas-based pixel reads
// non-portable across DPR values.

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

/** Create an isolated 200×200 canvas+skin+Canvas with DPR=1. */
const MAKE_ISO_CANVAS = `
  const htmlC = document.createElement('canvas');
  htmlC.width = 200; htmlC.height = 200;
  document.body.appendChild(htmlC);
  const r = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
  r.init();
  const sk = new G.Skin(r);
  sk.init();
  const cv = new G.Canvas(sk, htmlC);
  cv.setBounds(0, 0, 200, 200);
  cv.setDrawBackground(true);
  cv.setBackgroundColor(G.color(122, 144, 144, 255));
`;

test.describe('T114 Rectangle', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction + default color
  // =========================================================================

  test('1 — new Rectangle(canvas) does not throw; default color is opaque white', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const rect = new G.Rectangle(canvas);
        const c = rect.getColor();
        rect.dispose();
        return { threw: false, r: c.r, g: c.g, b: c.b, a: c.a };
      } catch {
        return { threw: true, r: 0, g: 0, b: 0, a: 0 };
      }
    });
    expect(result.threw).toBe(false);
    expect(result).toMatchObject({ r: 255, g: 255, b: 255, a: 255 });
  });

  // =========================================================================
  // 2. setColor / getColor
  // =========================================================================

  test('2 — setColor(red) round-trips via getColor', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const rect = new G.Rectangle(canvas);
      rect.setColor(G.color(255, 0, 0, 255));
      const c = rect.getColor();
      rect.dispose();
      return { r: c.r, g: c.g, b: c.b, a: c.a };
    });
    expect(result).toEqual({ r: 255, g: 0, b: 0, a: 255 });
  });

  // =========================================================================
  // 3. Rendering — pixel read confirms fill color
  // =========================================================================

  test('3 — red Rectangle renders red pixels at center (isolated DPR-1 canvas)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      // Isolated canvas with DPR=1 to avoid device-pixel-ratio scissor issues.
      const htmlC = document.createElement('canvas');
      htmlC.width = 200; htmlC.height = 200;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const canvas = new G.Canvas(skin, htmlC);
      canvas.setBounds(0, 0, 200, 200);
      canvas.setDrawBackground(true);
      canvas.setBackgroundColor(G.color(122, 144, 144, 255));

      const rect = new G.Rectangle(canvas);
      rect.setBounds(10, 10, 100, 100);
      rect.setColor(G.color(255, 0, 0, 255));

      canvas.doThink();
      canvas.redraw();
      canvas.renderCanvas();

      const gl: WebGL2RenderingContext = renderer.gl;
      const px = new Uint8Array(4);
      // Center of rect (10,10,100,100) = (60, 60). DPR=1 → device=logical.
      gl.readPixels(60, htmlC.height - 60 - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);

      canvas.dispose();
      document.body.removeChild(htmlC);
      return { r: px[0], g: px[1], b: px[2] };
    });
    expect(result.r).toBeGreaterThan(200);
    expect(result.g).toBeLessThan(60);
    expect(result.b).toBeLessThan(60);
  });

  // =========================================================================
  // 4. Semi-transparent color
  // =========================================================================

  test('4 — semi-transparent green (alpha 128) blends with background (isolated DPR-1 canvas)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const htmlC = document.createElement('canvas');
      htmlC.width = 200; htmlC.height = 200;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const canvas = new G.Canvas(skin, htmlC);
      canvas.setBounds(0, 0, 200, 200);
      canvas.setDrawBackground(true);
      canvas.setBackgroundColor(G.color(122, 144, 144, 255));

      // Background is (122, 144, 144, 255).
      // Green rect at alpha 128 blends: G channel rises above background G=144.
      const rect = new G.Rectangle(canvas);
      rect.setBounds(30, 30, 100, 100);
      rect.setColor(G.color(0, 255, 0, 128));

      canvas.doThink();
      canvas.redraw();
      canvas.renderCanvas();

      const gl: WebGL2RenderingContext = renderer.gl;
      const px = new Uint8Array(4);
      // Center of rect (30,30,100,100) = (80, 80).
      gl.readPixels(80, htmlC.height - 80 - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);

      canvas.dispose();
      document.body.removeChild(htmlC);
      return { r: px[0], g: px[1], b: px[2] };
    });
    // Green at ~50% alpha over slate (122, 144, 144):
    // blended G ≈ 0.498*255 + 0.502*144 ≈ 199, well above background G=144.
    expect(result.g).toBeGreaterThan(150);
    // Red should remain suppressed (background R=122, overlay R=0).
    expect(result.r).toBeLessThan(140);
  });

  // =========================================================================
  // 5. setColor triggers redraw implicitly
  // =========================================================================

  test('5 — setColor triggers redraw; next renderCanvas picks up new color (isolated DPR-1 canvas)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const htmlC = document.createElement('canvas');
      htmlC.width = 400; htmlC.height = 200;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const canvas = new G.Canvas(skin, htmlC);
      canvas.setBounds(0, 0, 400, 200);
      canvas.setDrawBackground(true);
      canvas.setBackgroundColor(G.color(122, 144, 144, 255));

      // First render: white rectangle.
      const rect = new G.Rectangle(canvas);
      rect.setBounds(50, 50, 100, 100);
      rect.setColor(G.color(255, 255, 255, 255));

      canvas.doThink();
      canvas.redraw();
      canvas.renderCanvas();

      const gl: WebGL2RenderingContext = renderer.gl;
      const px1 = new Uint8Array(4);
      // Center of rect (50,50,100,100) = (100, 100).
      gl.readPixels(100, htmlC.height - 100 - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px1);

      // Change color to blue (setColor calls redraw internally).
      rect.setColor(G.color(0, 0, 255, 255));
      // renderCanvas is gated on _needsRedraw — setColor must have set it.
      canvas.renderCanvas();

      const px2 = new Uint8Array(4);
      gl.readPixels(100, htmlC.height - 100 - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px2);

      canvas.dispose();
      document.body.removeChild(htmlC);
      return {
        first: { r: px1[0], g: px1[1], b: px1[2] },
        second: { r: px2[0], g: px2[1], b: px2[2] },
      };
    });
    // First pass: white.
    expect(result.first.r).toBeGreaterThan(200);
    // Second pass: blue dominant.
    expect(result.second.b).toBeGreaterThan(result.second.r);
    expect(result.second.b).toBeGreaterThan(result.second.g);
  });

  // =========================================================================
  // 6. Zero-sized rectangle — render no-op
  // =========================================================================

  test('6 — zero-sized rectangle renders without throwing', async ({ page }) => {
    const threw = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const rect = new G.Rectangle(canvas);
        rect.setBounds(0, 0, 0, 0);
        rect.setColor(G.color(255, 0, 0, 255));
        canvas.doThink();
        canvas.redraw();
        canvas.renderCanvas();
        rect.dispose();
        return false;
      } catch {
        return true;
      }
    });
    expect(threw).toBe(false);
  });
});
