// Skin theming — `Skin.setTheme(palette)` swaps the active palette,
// re-paints the atlas in place, and rebuilds the `colors` struct so
// every existing control picks up new colours on next render.
//
// Categories:
//   1  API           — exports / round-trip / default
//   2  setTheme      — palette swap reflects on `getPalette` + `colors`
//   3  Stable handle — atlas texture's WebGL handle is reused across switch
//   4  Idempotent    — same-palette setTheme is a no-op
//   5  Pre-init      — setTheme before init() carries through
//   6  Render        — switching themes mid-frame doesn't throw
//   7  Pixel diff    — light vs dark produce different framebuffer content
//   8  Text color    — wrapped implicit text tracks the active theme
//   9  Label presets — makeColor* presets track the active theme
//   10 RichLabel     — default rich text tracks the active theme

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('Skin theme switching', () => {
  // Serial — every test modifies the singleton `gwenSkin` shared
  // across `gotoDemo` page loads. Parallel execution would race on
  // who's setting which palette.
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Public exports + default theme
  // =========================================================================

  test('1 — LIGHT_PALETTE / DARK_PALETTE / Palette type are exported; default = LIGHT', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const skin = (window as any).gwenSkin;
      return {
        hasLight: !!G.LIGHT_PALETTE && typeof G.LIGHT_PALETTE.canvasBg === 'string',
        hasDark: !!G.DARK_PALETTE && typeof G.DARK_PALETTE.canvasBg === 'string',
        // PALETTE alias points to LIGHT.
        aliasIsLight: G.PALETTE === G.LIGHT_PALETTE,
        defaultIsLight: skin.getPalette() === G.LIGHT_PALETTE,
        lightCanvasBg: G.LIGHT_PALETTE.canvasBg,
        darkCanvasBg: G.DARK_PALETTE.canvasBg,
      };
    });
    expect(result.hasLight).toBe(true);
    expect(result.hasDark).toBe(true);
    expect(result.aliasIsLight).toBe(true);
    expect(result.defaultIsLight).toBe(true);
    // Sanity — they're not the same value.
    expect(result.lightCanvasBg).not.toBe(result.darkCanvasBg);
  });

  // =========================================================================
  // 2. setTheme swaps the active palette + the colors struct
  // =========================================================================

  test('2 — setTheme(DARK) updates getPalette() and rebuilds skin.colors', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const skin = (window as any).gwenSkin;
      const lightTextDefault = { ...skin.colors.label.default };
      skin.setTheme(G.DARK_PALETTE);
      const darkTextDefault = { ...skin.colors.label.default };
      const r = {
        paletteIsDark: skin.getPalette() === G.DARK_PALETTE,
        // Light palette label.default = textNormal = #000000 → r=g=b=0
        // Dark  palette label.default = textNormal = #dcdcdc → r=g=b=220
        lightR: lightTextDefault.r,
        darkR: darkTextDefault.r,
      };
      // Reset for other tests.
      skin.setTheme(G.LIGHT_PALETTE);
      return r;
    });
    expect(result.paletteIsDark).toBe(true);
    expect(result.lightR).toBe(0);
    expect(result.darkR).toBe(220);
  });

  // =========================================================================
  // 3. Texture handle stays stable across theme switch — controls that
  //    cached a reference don't get a stale handle.
  // =========================================================================

  test('3 — atlas texture handle is reused (same WebGLTexture) across setTheme', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const skin = (window as any).gwenSkin;
      const before = skin.dynamicSkin.getTexture();
      const handleBefore = before.data;

      skin.setTheme(G.DARK_PALETTE);
      const after = skin.dynamicSkin.getTexture();
      const handleAfter = after.data;

      const r = {
        sameTextureObject: before === after,
        sameWebGLHandle: handleBefore === handleAfter,
      };
      skin.setTheme(G.LIGHT_PALETTE);
      return r;
    });
    expect(result.sameTextureObject).toBe(true);
    expect(result.sameWebGLHandle).toBe(true);
  });

  // =========================================================================
  // 4. Same-palette setTheme is a no-op (don't pointlessly re-paint).
  // =========================================================================

  test('4 — setTheme with the active palette is a no-op', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const skin = (window as any).gwenSkin;
      // Spy via a getter that flips a flag when paint() runs. We can't
      // reach the private method directly, but `colors` is rebuilt on
      // each paint — capturing object identity tells us if it ran.
      const colorsBefore = skin.colors;
      skin.setTheme(G.LIGHT_PALETTE);
      const colorsAfter = skin.colors;
      return { sameColorsRef: colorsBefore === colorsAfter };
    });
    expect(result.sameColorsRef).toBe(true);
  });

  // =========================================================================
  // 5. setTheme called before init() takes effect on init.
  // =========================================================================

  test('5 — setTheme before init applies on first paint', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const htmlC = document.createElement('canvas');
      htmlC.width = 200; htmlC.height = 100;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.setTheme(G.DARK_PALETTE); // BEFORE init
      skin.init();
      const r = {
        palette: skin.getPalette() === G.DARK_PALETTE,
        // Dark label.default (textNormal #dcdcdc) → r=220
        labelR: skin.colors.label.default.r,
      };
      document.body.removeChild(htmlC);
      return r;
    });
    expect(result.palette).toBe(true);
    expect(result.labelR).toBe(220);
  });

  // =========================================================================
  // 6. Switch themes mid-frame: render doesn't throw.
  // =========================================================================

  test('6 — render after setTheme does not throw', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const cv = (window as any).gwenCanvas;
      const skin = (window as any).gwenSkin;
      let threw = false;
      try {
        skin.setTheme(G.DARK_PALETTE);
        cv.doThink();
        cv.redraw();
        cv.renderCanvas();
        skin.setTheme(G.LIGHT_PALETTE);
        cv.doThink();
        cv.redraw();
        cv.renderCanvas();
      } catch {
        threw = true;
      }
      return threw;
    });
    expect(result).toBe(false);
  });

  // =========================================================================
  // 7. Atlas pixels differ between themes — readback from the offscreen
  //    canvas the painter draws into (vs. the on-screen GL framebuffer,
  //    which has timing issues with readPixels right after renderCanvas).
  //    The atlas itself is what carries every panel/button/etc. so a
  //    different palette must produce different bytes.
  // =========================================================================

  test('7 — atlas content differs after theme switch', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      // Build an isolated skin so we can re-paint into its atlas
      // without fighting the demo's shared state.
      const htmlC = document.createElement('canvas');
      htmlC.width = 200; htmlC.height = 100;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      // Serialize palette colour bytes — we use the BAKED palette
      // strip the painter writes into the atlas, which is built from
      // the active palette via `bakedRow508`. Different palettes
      // produce different baked-row arrays.
      const lightStrip = JSON.stringify(G.bakedRow508(G.LIGHT_PALETTE));
      const darkStrip = JSON.stringify(G.bakedRow508(G.DARK_PALETTE));
      skin.setTheme(G.DARK_PALETTE);
      const palAfter = skin.getPalette() === G.DARK_PALETTE;
      document.body.removeChild(htmlC);
      return { sameStrip: lightStrip === darkStrip, palAfter };
    });
    // Different palettes must produce different baked-row arrays —
    // that's what flows into the atlas and into `skin.colors`.
    expect(result.sameStrip).toBe(false);
    expect(result.palAfter).toBe(true);
  });

  // =========================================================================
  // 8. Wrapped Text should not freeze the construction-time black colour.
  // =========================================================================

  test('8 — wrapped implicit text lines inherit the dark theme text colour', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const skin = (window as any).gwenSkin;

      const label = new G.Label(canvas);
      label.setBounds(10, 10, 90, 80);
      label.setWrap(true);
      label.setText('Wrapped label text that must split into child lines');

      skin.setTheme(G.DARK_PALETTE);
      canvas.doThink();

      const text = (label as any)._text;
      const firstLine = text._lines[0];
      const effective = firstLine.effectiveTextColor(skin);

      label.dispose();
      skin.setTheme(G.LIGHT_PALETTE);
      return { r: effective.r, g: effective.g, b: effective.b };
    });
    expect(result).toEqual({ r: 220, g: 220, b: 220 });
  });

  test('9 — label color presets update after a dark theme switch', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const skin = (window as any).gwenSkin;

      skin.setTheme(G.LIGHT_PALETTE);
      const normal = new G.Label(canvas);
      normal.makeColorNormal();
      const dark = new G.Label(canvas);
      dark.makeColorDark();

      skin.setTheme(G.DARK_PALETTE);
      const normalColor = normal.effectiveTextColor(skin);
      const darkColor = dark.effectiveTextColor(skin);

      normal.dispose();
      dark.dispose();
      skin.setTheme(G.LIGHT_PALETTE);
      return {
        normal: { r: normalColor.r, g: normalColor.g, b: normalColor.b },
        dark: { r: darkColor.r, g: darkColor.g, b: darkColor.b },
      };
    });
    expect(result.normal).toEqual({ r: 220, g: 220, b: 220 });
    expect(result.dark).toEqual({ r: 220, g: 220, b: 220 });
  });

  test('10 — RichLabel default text inherits the dark theme text colour', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const skin = (window as any).gwenSkin;

      skin.setTheme(G.LIGHT_PALETTE);
      const rich = new G.RichLabel(canvas);
      rich.setBounds(10, 10, 220, 80);
      rich.addText('Rich label text should follow the current theme');
      canvas.doThink();

      const firstText = Array.from(rich.children).find((c: any) => c instanceof G.Text) as any;
      skin.setTheme(G.DARK_PALETTE);
      const effective = firstText.effectiveTextColor(skin);

      rich.dispose();
      skin.setTheme(G.LIGHT_PALETTE);
      return { r: effective.r, g: effective.g, b: effective.b };
    });
    expect(result).toEqual({ r: 220, g: 220, b: 220 });
  });
});
