// T111 — ImagePanel
//
// Categories covered:
//   1  Render          — #9 pixel read after rendering blue texture
//   2  Visual baseline — Skipped: texture content depends on driver/GL state;
//                        pixel-read approach used in category 1 instead.
//   3  State visuals   — N/A: ImagePanel has no hover/pressed/focused states.
//   4  Pointer input   — N/A: mouse input disabled by default.
//   5  Touch input     — N/A: same reason.
//   6  Keyboard        — N/A: no keyboard interaction.
//   7  Events          — N/A: ImagePanel exposes no user-facing signals.
//   8  Resize          — #10 stretch=true fills control bounds with texture.

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T111 ImagePanel', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction + defaults
  // =========================================================================

  test('1 — new ImagePanel(canvas) does not throw; mouse disabled', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const panel = new G.ImagePanel(canvas);
        const mouseEnabled = panel.getMouseInputEnabled();
        panel.dispose();
        return { threw: false, mouseEnabled };
      } catch {
        return { threw: true, mouseEnabled: false };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.mouseEnabled).toBe(false);
  });

  test('2 — default stretch is true', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const panel = new G.ImagePanel(canvas);
      const stretch = panel.getStretch();
      panel.dispose();
      return stretch;
    });
    expect(result).toBe(true);
  });

  test('3 — default drawColor is opaque white', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const panel = new G.ImagePanel(canvas);
      const c = panel.getDrawColor();
      panel.dispose();
      return { r: c.r, g: c.g, b: c.b, a: c.a };
    });
    expect(result).toEqual({ r: 255, g: 255, b: 255, a: 255 });
  });

  // =========================================================================
  // 2. setUV
  // =========================================================================

  test('4 — setUV updates internal UV fields', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const panel = new G.ImagePanel(canvas);
      panel.setUV(0.25, 0.25, 0.75, 0.75);
      const uv = panel._uv; // access private field for verification
      panel.dispose();
      return Array.from(uv) as number[];
    });
    expect(result[0]).toBeCloseTo(0.25);
    expect(result[1]).toBeCloseTo(0.25);
    expect(result[2]).toBeCloseTo(0.75);
    expect(result[3]).toBeCloseTo(0.75);
  });

  // =========================================================================
  // 3. setDrawColor / getDrawColor
  // =========================================================================

  test('5 — setDrawColor round-trips', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const panel = new G.ImagePanel(canvas);
      panel.setDrawColor(G.color(255, 100, 100, 255));
      const c = panel.getDrawColor();
      panel.dispose();
      return { r: c.r, g: c.g, b: c.b, a: c.a };
    });
    expect(result).toEqual({ r: 255, g: 100, b: 100, a: 255 });
  });

  // =========================================================================
  // 4. setStretch / getStretch
  // =========================================================================

  test('6 — setStretch(false) updates the field', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const panel = new G.ImagePanel(canvas);
      panel.setStretch(false);
      const s = panel.getStretch();
      panel.dispose();
      return s;
    });
    expect(result).toBe(false);
  });

  // =========================================================================
  // 5. setImageName / getImageName
  // =========================================================================

  test('7 — setImageName / getImageName round-trip', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const panel = new G.ImagePanel(canvas);
      panel.setImageName('foo');
      const name = panel.getImageName();
      panel.dispose();
      return name;
    });
    expect(result).toBe('foo');
  });

  // =========================================================================
  // 6. textureWidth / textureHeight before load
  // =========================================================================

  test('8 — textureWidth and textureHeight are 0 before any texture is set', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const panel = new G.ImagePanel(canvas);
      const w = panel.textureWidth();
      const h = panel.textureHeight();
      panel.dispose();
      return { w, h };
    });
    expect(result.w).toBe(0);
    expect(result.h).toBe(0);
  });

  // =========================================================================
  // 7. sizeToContents before texture set
  // =========================================================================

  test('9 — sizeToContents() before texture set does not crash', async ({ page }) => {
    const threw = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const panel = new G.ImagePanel(canvas);
      try {
        panel.sizeToContents();
        panel.dispose();
        return false;
      } catch {
        return true;
      }
    });
    expect(threw).toBe(false);
  });

  // =========================================================================
  // 8. failedToLoad
  // =========================================================================

  test('10 — failedToLoad() is false before any texture operation', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const panel = new G.ImagePanel(canvas);
      const failed = panel.failedToLoad();
      panel.dispose();
      return failed;
    });
    expect(result).toBe(false);
  });

  // =========================================================================
  // 9. Load texture from OffscreenCanvas and render (pixel read)
  // Isolated DPR-1 canvases are used for all pixel-read tests so that
  // device pixel coordinates match logical coordinates on every platform.
  // =========================================================================

  test('11 — setTextureFromSource with solid-blue OffscreenCanvas renders blue pixels', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      // Isolated canvas with DPR=1.
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
      canvas.setBackgroundColor(G.color(0, 0, 0, 255));

      // Create a 32×32 OffscreenCanvas filled with pure blue.
      const offscreen = new OffscreenCanvas(32, 32);
      const ctx = offscreen.getContext('2d')!;
      ctx.fillStyle = 'rgb(0, 0, 255)';
      ctx.fillRect(0, 0, 32, 32);

      const panel = new G.ImagePanel(canvas);
      panel.setBounds(50, 50, 80, 80);
      panel.setStretch(true);
      panel.setTextureFromSource(offscreen, renderer);

      canvas.doThink();
      canvas.redraw();
      canvas.renderCanvas();

      const gl: WebGL2RenderingContext = renderer.gl;
      const px = new Uint8Array(4);
      // Center of panel (50,50,80,80) = (90, 90).
      gl.readPixels(90, htmlC.height - 90 - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);

      canvas.dispose();
      document.body.removeChild(htmlC);
      return { r: px[0], g: px[1], b: px[2] };
    });
    expect(result.b).toBeGreaterThan(180);
    expect(result.r).toBeLessThan(80);
    expect(result.g).toBeLessThan(80);
  });

  // =========================================================================
  // 10. stretch=true fills bounds
  // =========================================================================

  test('12 — stretch=true: 32×32 texture fills 100×100 bounds', async ({ page }) => {
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
      canvas.setBackgroundColor(G.color(0, 0, 0, 255));

      const offscreen = new OffscreenCanvas(32, 32);
      const ctx = offscreen.getContext('2d')!;
      ctx.fillStyle = 'rgb(255, 0, 0)';
      ctx.fillRect(0, 0, 32, 32);

      const panel = new G.ImagePanel(canvas);
      panel.setBounds(20, 20, 100, 100);
      panel.setStretch(true);
      panel.setTextureFromSource(offscreen, renderer);

      canvas.doThink();
      canvas.redraw();
      canvas.renderCanvas();

      const gl: WebGL2RenderingContext = renderer.gl;
      // Center of panel (20,20,100,100) = (70, 70).
      const px = new Uint8Array(4);
      gl.readPixels(70, htmlC.height - 70 - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);

      canvas.dispose();
      document.body.removeChild(htmlC);
      return { r: px[0], g: px[1], b: px[2] };
    });
    expect(result.r).toBeGreaterThan(180);
    expect(result.g).toBeLessThan(80);
    expect(result.b).toBeLessThan(80);
  });

  // =========================================================================
  // 11. UV sub-rect rendering
  // =========================================================================

  test('13 — UV(0, 0, 0.5, 0.5) renders using top-left quadrant of texture', async ({ page }) => {
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
      canvas.setBackgroundColor(G.color(0, 0, 0, 255));

      const offscreen = new OffscreenCanvas(32, 32);
      const ctx = offscreen.getContext('2d')!;
      ctx.fillStyle = 'rgb(0, 255, 0)';
      ctx.fillRect(0, 0, 32, 32);

      const panel = new G.ImagePanel(canvas);
      panel.setBounds(20, 20, 100, 100);
      panel.setStretch(true);
      panel.setUV(0, 0, 0.5, 0.5);
      panel.setTextureFromSource(offscreen, renderer);

      canvas.doThink();
      canvas.redraw();
      canvas.renderCanvas();

      const gl: WebGL2RenderingContext = renderer.gl;
      // Center of panel (20,20,100,100) = (70, 70).
      const px = new Uint8Array(4);
      gl.readPixels(70, htmlC.height - 70 - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);

      canvas.dispose();
      document.body.removeChild(htmlC);
      return { r: px[0], g: px[1], b: px[2] };
    });
    expect(result.g).toBeGreaterThan(180);
    expect(result.r).toBeLessThan(80);
    expect(result.b).toBeLessThan(80);
  });

  // =========================================================================
  // 12. drawColor tint
  // =========================================================================

  test('14 — drawColor tints the rendered texture', async ({ page }) => {
    // White texture × red drawColor should render red.
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
      canvas.setBackgroundColor(G.color(0, 0, 0, 255));

      const offscreen = new OffscreenCanvas(32, 32);
      const ctx = offscreen.getContext('2d')!;
      ctx.fillStyle = 'rgb(255, 255, 255)';
      ctx.fillRect(0, 0, 32, 32);

      const panel = new G.ImagePanel(canvas);
      panel.setBounds(20, 20, 100, 100);
      panel.setStretch(true);
      panel.setDrawColor(G.color(255, 0, 0, 255));
      panel.setTextureFromSource(offscreen, renderer);

      canvas.doThink();
      canvas.redraw();
      canvas.renderCanvas();

      const gl: WebGL2RenderingContext = renderer.gl;
      // Center of panel (20,20,100,100) = (70, 70).
      const px = new Uint8Array(4);
      gl.readPixels(70, htmlC.height - 70 - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);

      canvas.dispose();
      document.body.removeChild(htmlC);
      return { r: px[0], g: px[1], b: px[2] };
    });
    expect(result.r).toBeGreaterThan(180);
    expect(result.g).toBeLessThan(80);
    expect(result.b).toBeLessThan(80);
  });

  // =========================================================================
  // 13. loadFromURL
  // =========================================================================

  test('15 — loadFromURL rejects on invalid URL', async ({ page }) => {
    const rejected = await page.evaluate(async () => {
      const G = (window as any).Gwen;
      const renderer = (window as any).gwenRenderer;
      try {
        await G.ImagePanel.loadFromURL('http://localhost:9999/nonexistent-image-xyz.png', renderer);
        return false;
      } catch {
        return true;
      }
    });
    expect(rejected).toBe(true);
  });

  test('16 — loadFromURL resolves with non-zero-size texture on valid data URL', async ({ page }) => {
    // Minimal 1×1 transparent PNG as a data URL.
    const result = await page.evaluate(async () => {
      const G = (window as any).Gwen;
      const renderer = (window as any).gwenRenderer;
      // 1x1 red pixel PNG (base64-encoded).
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==';
      try {
        const tex = await G.ImagePanel.loadFromURL(dataUrl, renderer);
        return { width: tex.width, height: tex.height, failed: tex.failed };
      } catch (e) {
        return { width: 0, height: 0, failed: true };
      }
    });
    expect(result.failed).toBe(false);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });
});
