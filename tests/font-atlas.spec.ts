// T005 — FontAtlas
//
// Skipped categories per control:
//   - Render (position/size): FontAtlas is not a visual control — it is an
//     internal glyph-cache + GPU-texture utility.  Position/size checks do
//     not apply.
//   - Visual baseline (screenshot): text anti-aliasing varies across OS /
//     browser / headless engine; pixel-alpha assertions are used instead of
//     screenshot diffs, per the task spec.
//   - Hover / pressed / disabled / focused states: not applicable.
//   - Pointer input / Touch input / Keyboard: not applicable.
//   - Events (Signals): FontAtlas emits no public events.
//   - Resize: FontAtlas has no layout that responds to parent resize.
//
// NOTE: all pixel reads happen in the same page.evaluate call as the draw
// because preserveDrawingBuffer is not set (defaults to false).

import { test, expect, type Page } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T005 FontAtlas', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }: { page: Page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // -------------------------------------------------------------------------
  // 1. Font factory defaults and overrides
  // -------------------------------------------------------------------------

  test('1a — font() defaults: facename=Arial size=14 bold=false data=null realsize=0', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const f = G.font();
      return {
        facename: f.facename,
        size: f.size,
        bold: f.bold,
        data: f.data,
        realsize: f.realsize,
      };
    });
    expect(result.facename).toBe('Arial');
    expect(result.size).toBe(14);
    expect(result.bold).toBe(false);
    expect(result.data).toBeNull();
    expect(result.realsize).toBe(0);
  });

  test('1b — font(Menlo, 14, true) overrides each field', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const f = G.font('Menlo', 14, true);
      return {
        facename: f.facename,
        size: f.size,
        bold: f.bold,
        data: f.data,
        realsize: f.realsize,
      };
    });
    expect(result.facename).toBe('Menlo');
    expect(result.size).toBe(14);
    expect(result.bold).toBe(true);
    expect(result.data).toBeNull();
    expect(result.realsize).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 2. measureText returns positive width + height for non-empty string
  // -------------------------------------------------------------------------

  test('2 — measureText(Arial 16, "Hello") returns positive x and y', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = document.createElement('canvas');
      c.width = 200;
      c.height = 200;
      document.body.appendChild(c);
      const r = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
      r.init();
      r.setScale(1.0);
      const size = r.measureText(G.font('Arial', 16), 'Hello');
      document.body.removeChild(c);
      return { x: size.x, y: size.y };
    });
    expect(result.x).toBeGreaterThan(0);
    expect(result.y).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 3. measureText on empty string returns (0, realsize)
  // -------------------------------------------------------------------------

  test('3 — measureText(font(), "") returns x=0 and positive y', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = document.createElement('canvas');
      c.width = 200;
      c.height = 200;
      document.body.appendChild(c);
      const r = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
      r.init();
      r.setScale(1.0);
      const size = r.measureText(G.font(), '');
      document.body.removeChild(c);
      return { x: size.x, y: size.y };
    });
    expect(result.x).toBe(0);
    expect(result.y).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 4. renderText draws non-transparent pixels in expected box
  // -------------------------------------------------------------------------

  test('4 — renderText("A") draws non-zero alpha pixels in glyph area; clear outside', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = document.createElement('canvas');
      c.width = 300;
      c.height = 300;
      document.body.appendChild(c);
      const r = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
      r.init();
      r.setRenderOffset(G.point(0, 0));
      r.setScale(1.0);
      r.begin();
      r.setDrawColor(G.color(255, 255, 255, 255));
      r.renderText(G.font('Arial', 20, false), G.point(10, 10), 'A');
      r.end();

      const gl = c.getContext('webgl2')!;
      // Scan a 30x30 box starting at (10,10) — expected glyph area.
      let maxAlpha = 0;
      for (let px = 10; px < 40; px++) {
        for (let py = 10; py < 40; py++) {
          const readY = c.height - py - 1;
          const buf = new Uint8Array(4);
          gl.readPixels(px, readY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
          if (buf[3] > maxAlpha) maxAlpha = buf[3];
        }
      }

      // Read well outside the glyph.
      const readYOuter = c.height - 200 - 1;
      const outerBuf = new Uint8Array(4);
      gl.readPixels(200, readYOuter, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, outerBuf);
      const outerAlpha = outerBuf[3];

      document.body.removeChild(c);
      return { maxAlpha, outerAlpha };
    });
    expect(result.maxAlpha).toBeGreaterThan(0);
    expect(result.outerAlpha).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 5. measureText cache determinism — same string, same result twice
  // -------------------------------------------------------------------------

  test('5 — measureText is deterministic: same string returns identical x,y', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = document.createElement('canvas');
      c.width = 200;
      c.height = 200;
      document.body.appendChild(c);
      const r = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
      r.init();
      r.setScale(1.0);
      const f = G.font('Arial', 14);
      const a = r.measureText(f, 'quick brown fox');
      const b = r.measureText(f, 'quick brown fox');
      document.body.removeChild(c);
      return { ax: a.x, ay: a.y, bx: b.x, by: b.y };
    });
    expect(result.ax).toBe(result.bx);
    expect(result.ay).toBe(result.by);
  });

  // -------------------------------------------------------------------------
  // 6. Different font sizes produce different widths
  // -------------------------------------------------------------------------

  test('6 — larger font size yields larger measureText width', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = document.createElement('canvas');
      c.width = 300;
      c.height = 300;
      document.body.appendChild(c);
      const r = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
      r.init();
      r.setScale(1.0);
      const small = r.measureText(G.font('Arial', 10), 'XX');
      const large = r.measureText(G.font('Arial', 30), 'XX');
      document.body.removeChild(c);
      return { smallX: small.x, largeX: large.x };
    });
    expect(result.smallX).toBeLessThan(result.largeX);
  });

  // -------------------------------------------------------------------------
  // 7. loadFont + freeFont don't throw; measureText still works after free
  // -------------------------------------------------------------------------

  test('7 — loadFont and freeFont do not throw; measureText works after freeFont', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = document.createElement('canvas');
      c.width = 200;
      c.height = 200;
      document.body.appendChild(c);
      const r = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
      r.init();
      r.setScale(1.0);

      let loadErr: string | null = null;
      let freeErr: string | null = null;
      let measureErr: string | null = null;
      let measureX = -1;

      try {
        r.loadFont(G.font('Arial', 12));
      } catch (e) {
        loadErr = String(e);
      }

      const f = G.font('Arial', 12);
      try {
        r.freeFont(f);
      } catch (e) {
        freeErr = String(e);
      }

      // After freeFont, font.data is null, but atlas still holds the cached
      // glyphs keyed by realsize — measureText should still succeed.
      try {
        const size = r.measureText(G.font('Arial', 12), 'Hi');
        measureX = size.x;
      } catch (e) {
        measureErr = String(e);
      }

      document.body.removeChild(c);
      return { loadErr, freeErr, measureErr, measureX };
    });
    expect(result.loadErr).toBeNull();
    expect(result.freeErr).toBeNull();
    expect(result.measureErr).toBeNull();
    expect(result.measureX).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 8. renderText on empty string — no error, no pixels drawn
  // -------------------------------------------------------------------------

  test('8 — renderText with empty string does not throw and draws nothing', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = document.createElement('canvas');
      c.width = 200;
      c.height = 200;
      document.body.appendChild(c);
      const r = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
      r.init();
      r.setRenderOffset(G.point(0, 0));
      r.setScale(1.0);

      let renderErr: string | null = null;
      r.begin();
      r.setDrawColor(G.color(255, 255, 255, 255));
      try {
        r.renderText(G.font(), G.point(0, 0), '');
      } catch (e) {
        renderErr = String(e);
      }
      r.end();

      // Canvas should be fully transparent.
      const gl = c.getContext('webgl2')!;
      const buf = new Uint8Array(4);
      gl.readPixels(10, c.height - 10 - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      document.body.removeChild(c);
      return { renderErr, alpha: buf[3] };
    });
    expect(result.renderErr).toBeNull();
    expect(result.alpha).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 9. Unicode / ASCII range renders some pixels
  // -------------------------------------------------------------------------

  test('9 — renderText with ASCII-range string draws non-zero pixels', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = document.createElement('canvas');
      c.width = 300;
      c.height = 100;
      document.body.appendChild(c);
      const r = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
      r.init();
      r.setRenderOffset(G.point(0, 0));
      r.setScale(1.0);
      r.begin();
      r.setDrawColor(G.color(255, 255, 255, 255));
      r.renderText(G.font('Arial', 14), G.point(0, 0), 'abc123!@#');
      r.end();

      const gl = c.getContext('webgl2')!;
      let maxAlpha = 0;
      for (let px = 0; px < 200; px += 4) {
        for (let py = 0; py < 40; py += 4) {
          const buf = new Uint8Array(4);
          gl.readPixels(px, c.height - py - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
          if (buf[3] > maxAlpha) maxAlpha = buf[3];
        }
      }
      document.body.removeChild(c);
      return { maxAlpha };
    });
    expect(result.maxAlpha).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 10. Mode switching — fill + text + fill doesn't corrupt
  //
  // BLOCKED: FontAtlas.rasterize() and loadFont() bind the atlas texture
  // directly via the shared GL context (gl.bindTexture on TEXTURE0) without
  // restoring the previously-bound texture. The renderer's boundTex tracking
  // therefore diverges from actual GL state. When begin() calls
  // bindNullTexture(), it short-circuits because this.boundTex matches the
  // field value (nullTexture), but the actual GL binding is still the atlas.
  // Any drawFilledRect that is queued and then flushed via a subsequent
  // renderText call runs with the atlas texture bound in MODE_FILL, causing
  // the fragment shader to sample atlas coverage values instead of the
  // all-white null texture — resulting in black pixels instead of the
  // expected solid color.
  //
  // Fix needed in src/skin/FontAtlas.ts: restore the previously-bound
  // texture after each texSubImage2D call, or have the renderer's begin()
  // unconditionally rebind (not short-circuit) the null texture so the GL
  // state is always canonical at frame start.
  //
  // gwen-feedback: BLOCKED — implementation bug in FontAtlas texture
  // binding causes filled rects drawn before renderText to be rendered with
  // the atlas texture, producing incorrect colors.
  // -------------------------------------------------------------------------

  test('10 — interleaved drawFilledRect and renderText do not corrupt each other', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = document.createElement('canvas');
      c.width = 300;
      c.height = 100;
      document.body.appendChild(c);
      const r = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
      r.init();
      r.setRenderOffset(G.point(0, 0));
      r.setScale(1.0);

      r.begin();
      // Red filled rect at x=0
      r.setDrawColor(G.color(200, 0, 0, 255));
      r.drawFilledRect(G.rect(0, 0, 50, 50));
      // Text in the middle
      r.setDrawColor(G.color(255, 255, 255, 255));
      r.renderText(G.font('Arial', 14), G.point(60, 20), 'A');
      // Another red filled rect at x=100
      r.setDrawColor(G.color(200, 0, 0, 255));
      r.drawFilledRect(G.rect(100, 0, 50, 50));
      r.end();

      const gl = c.getContext('webgl2')!;
      const read = (px: number, py: number) => {
        const buf = new Uint8Array(4);
        gl.readPixels(px, c.height - py - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        return [buf[0], buf[1], buf[2], buf[3]] as [number, number, number, number];
      };

      // Left red rect — center (25, 25)
      const leftRect = read(25, 25);
      // Right red rect — center (125, 25)
      const rightRect = read(125, 25);
      // Text area — scan for any non-zero alpha between x=60..90, y=18..40
      let textMaxAlpha = 0;
      for (let px = 60; px < 90; px += 2) {
        for (let py = 18; py < 42; py += 2) {
          const buf = new Uint8Array(4);
          gl.readPixels(px, c.height - py - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
          if (buf[3] > textMaxAlpha) textMaxAlpha = buf[3];
        }
      }

      document.body.removeChild(c);
      return { leftRect, rightRect, textMaxAlpha };
    });

    // Left red rect: solid red, alpha=255
    expect(result.leftRect[3]).toBe(255);
    expect(result.leftRect[0]).toBeGreaterThan(150);
    expect(result.leftRect[1]).toBeLessThan(30);
    expect(result.leftRect[2]).toBeLessThan(30);

    // Right red rect: solid red, alpha=255
    expect(result.rightRect[3]).toBe(255);
    expect(result.rightRect[0]).toBeGreaterThan(150);
    expect(result.rightRect[1]).toBeLessThan(30);
    expect(result.rightRect[2]).toBeLessThan(30);

    // Text area: some non-zero alpha (glyph was drawn)
    expect(result.textMaxAlpha).toBeGreaterThan(0);
  });
});
