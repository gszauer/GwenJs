// T006 — DynamicSkin
//
// Skipped categories per control:
//   - Pointer input / Touch input / Keyboard: Not applicable — DynamicSkin is
//     a data/drawing API with no interactive controls.
//   - Events: No public Signal events are emitted by DynamicSkin.
//   - State visuals (hover/pressed/disabled/focused): The skin paints into a
//     static atlas at init time; individual state variants are baked as separate
//     atlas regions, not runtime state changes.
//   - Resize: The atlas is fixed-size (512×512); layout is not affected by
//     parent container resize.
//
// All GL reads happen inside the same page.evaluate call as the draw to keep
// them within the same JS task (preserveDrawingBuffer=false).

import { test, expect, type Page } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

// ---------------------------------------------------------------------------
// Helper: fresh 256×256 canvas + renderer + skin, all in one evaluate block.
// Returns a handle expression string for reuse.
// ---------------------------------------------------------------------------

test.describe('T006 DynamicSkin', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }: { page: Page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // -------------------------------------------------------------------------
  // 1. Instantiation + init doesn't throw
  // -------------------------------------------------------------------------

  test('1 — new DynamicSkin + init does not throw', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      try {
        const c = document.createElement('canvas');
        c.width = 256;
        c.height = 256;
        document.body.appendChild(c);
        const renderer = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
        renderer.init();
        const skin = new G.DynamicSkin(renderer);
        skin.init();
        document.body.removeChild(c);
        return { ok: true, defined: skin !== null && skin !== undefined };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    });
    expect(result.ok, result.ok ? '' : (result as any).error).toBe(true);
    expect(result.defined).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 2. Atlas texture exists after init
  // -------------------------------------------------------------------------

  test('2 — getTexture() returns 512×512 non-null texture named DynamicSkin', async ({ page }) => {
    const tex = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      document.body.appendChild(c);
      const renderer = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.DynamicSkin(renderer);
      skin.init();
      const t = skin.getTexture();
      const result = {
        width: t.width as number,
        height: t.height as number,
        failed: t.failed as boolean,
        name: t.name as string,
        dataNotNull: t.data !== null,
      };
      document.body.removeChild(c);
      return result;
    });
    expect(tex.width).toBe(512);
    expect(tex.height).toBe(512);
    expect(tex.failed).toBe(false);
    expect(tex.name).toBe('DynamicSkin');
    expect(tex.dataNotNull).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 3. Regions map is populated and non-empty
  // -------------------------------------------------------------------------

  test('3a — regions map has more than 90 entries', async ({ page }) => {
    const size = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      document.body.appendChild(c);
      const renderer = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.DynamicSkin(renderer);
      skin.init();
      const sz = skin.regions.size as number;
      document.body.removeChild(c);
      return sz;
    });
    expect(size).toBeGreaterThan(90);
  });

  test('3b — Input.Button.Normal is a bordered region with nonzero bounds and 4-element uv', async ({ page }) => {
    const region = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      document.body.appendChild(c);
      const renderer = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.DynamicSkin(renderer);
      skin.init();
      const r = skin.regions.get('Input.Button.Normal');
      const result = r == null ? null : {
        type: r.type as string,
        x: r.x as number,
        y: r.y as number,
        w: r.w as number,
        h: r.h as number,
        uvLength: (r.uv as number[]).length,
        uvAllNumbers: (r.uv as number[]).every((v: number) => typeof v === 'number'),
        uvInRange: (r.uv as number[]).every((v: number) => v >= 0 && v <= 1),
      };
      document.body.removeChild(c);
      return result;
    });
    expect(region).not.toBeNull();
    expect(region!.type).toBe('bordered');
    expect(region!.x).toBeGreaterThan(0);
    expect(region!.w).toBeGreaterThan(0);
    expect(region!.h).toBeGreaterThan(0);
    expect(region!.uvLength).toBe(4);
    expect(region!.uvAllNumbers).toBe(true);
    expect(region!.uvInRange).toBe(true);
  });

  test('3c — Window.Close is a single-type region', async ({ page }) => {
    const type = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      document.body.appendChild(c);
      const renderer = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.DynamicSkin(renderer);
      skin.init();
      const r = skin.regions.get('Window.Close');
      const result = r == null ? null : r.type as string;
      document.body.removeChild(c);
      return result;
    });
    expect(type).toBe('single');
  });

  test('3d — NonExistent.Name returns undefined', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      document.body.appendChild(c);
      const renderer = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.DynamicSkin(renderer);
      skin.init();
      const r = skin.regions.get('NonExistent.Name');
      document.body.removeChild(c);
      return r === undefined;
    });
    expect(result).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 4. UV math correctness
  // -------------------------------------------------------------------------

  test('4a — Input.Button.Normal UV matches atlas rect (480, 0, 31, 31)', async ({ page }) => {
    const uv = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      document.body.appendChild(c);
      const renderer = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.DynamicSkin(renderer);
      skin.init();
      const r = skin.regions.get('Input.Button.Normal');
      const result = r ? [...(r.uv as number[])] : null;
      document.body.removeChild(c);
      return result;
    });
    expect(uv).not.toBeNull();
    const expected = [480 / 512, 0 / 512, (480 + 31) / 512, (0 + 31) / 512];
    const eps = 1e-5;
    for (let i = 0; i < 4; i++) {
      expect(Math.abs(uv![i] - expected[i])).toBeLessThan(eps);
    }
  });

  test('4b — Window.Close UV matches atlas rect (32, 448, 31, 31)', async ({ page }) => {
    const uv = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      document.body.appendChild(c);
      const renderer = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.DynamicSkin(renderer);
      skin.init();
      const r = skin.regions.get('Window.Close');
      const result = r ? [...(r.uv as number[])] : null;
      document.body.removeChild(c);
      return result;
    });
    expect(uv).not.toBeNull();
    const expected = [32 / 512, 448 / 512, 63 / 512, 479 / 512];
    const eps = 1e-5;
    for (let i = 0; i < 4; i++) {
      expect(Math.abs(uv![i] - expected[i])).toBeLessThan(eps);
    }
  });

  // -------------------------------------------------------------------------
  // 5. Bordered regions have 4 margin values
  // -------------------------------------------------------------------------

  test('5 — Input.Button.Normal has all 4 margin fields as numbers (marginLeft = 8)', async ({ page }) => {
    const margins = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      document.body.appendChild(c);
      const renderer = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.DynamicSkin(renderer);
      skin.init();
      const r = skin.regions.get('Input.Button.Normal');
      const result = r == null ? null : {
        marginLeft: r.marginLeft,
        marginTop: r.marginTop,
        marginRight: r.marginRight,
        marginBottom: r.marginBottom,
        allNumbers:
          typeof r.marginLeft === 'number' &&
          typeof r.marginTop === 'number' &&
          typeof r.marginRight === 'number' &&
          typeof r.marginBottom === 'number',
      };
      document.body.removeChild(c);
      return result;
    });
    expect(margins).not.toBeNull();
    expect(margins!.marginLeft).toBe(8);
    expect(margins!.allNumbers).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 6. Colors object has expected nested structure
  // -------------------------------------------------------------------------

  test('6a — skin.colors.button has normal/hover/down/disabled and they are opaque Colors', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      document.body.appendChild(c);
      const renderer = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.DynamicSkin(renderer);
      skin.init();
      const btn = skin.colors.button;
      const isColor = (v: any) =>
        v != null &&
        typeof v.r === 'number' && typeof v.g === 'number' &&
        typeof v.b === 'number' && typeof v.a === 'number' &&
        v.r >= 0 && v.r <= 255 && v.g >= 0 && v.g <= 255 &&
        v.b >= 0 && v.b <= 255 && v.a >= 0 && v.a <= 255;
      const res = {
        hasNormal: btn != null && isColor(btn.normal),
        hasHover: btn != null && isColor(btn.hover),
        hasDown: btn != null && isColor(btn.down),
        hasDisabled: btn != null && isColor(btn.disabled),
        normalAlpha: btn?.normal?.a as number,
      };
      document.body.removeChild(c);
      return res;
    });
    expect(result.hasNormal).toBe(true);
    expect(result.hasHover).toBe(true);
    expect(result.hasDown).toBe(true);
    expect(result.hasDisabled).toBe(true);
    expect(result.normalAlpha).toBe(255);
  });

  test('6b — skin.colors.window has titleActive and titleInactive with valid RGBA', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      document.body.appendChild(c);
      const renderer = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.DynamicSkin(renderer);
      skin.init();
      const w = skin.colors.window;
      const isColor = (v: any) =>
        v != null &&
        typeof v.r === 'number' && typeof v.g === 'number' &&
        typeof v.b === 'number' && typeof v.a === 'number' &&
        v.r >= 0 && v.r <= 255 && v.g >= 0 && v.g <= 255 &&
        v.b >= 0 && v.b <= 255 && v.a >= 0 && v.a <= 255;
      const res = {
        hasTitleActive: isColor(w?.titleActive),
        hasTitleInactive: isColor(w?.titleInactive),
      };
      document.body.removeChild(c);
      return res;
    });
    expect(result.hasTitleActive).toBe(true);
    expect(result.hasTitleInactive).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 7. Atlas texture is actually populated (visually non-empty)
  // -------------------------------------------------------------------------

  test('7 — drawing full atlas produces at least 8 distinct rgb tuples in a 25-pixel sample grid', async ({ page }) => {
    // Uses a 5×5 grid (25 samples) and a threshold of 8 to stay robust across
    // GPU drivers and DPR variants while still catching a degenerate all-black
    // or single-color atlas (which would score 1 or 2).
    const distinctCount = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      document.body.appendChild(c);
      const renderer = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.DynamicSkin(renderer);
      skin.init();

      renderer.begin();
      renderer.setRenderOffset(G.point(0, 0));
      renderer.setScale(1);
      renderer.setDrawColor(G.color(255, 255, 255, 255));
      renderer.drawTexturedRect(skin.getTexture(), G.rect(0, 0, 256, 256), 0, 0, 1, 1);
      renderer.end();

      const gl = c.getContext('webgl2')!;
      const buf = new Uint8Array(4);
      const seen = new Set<string>();
      const gridN = 5;
      const step = 256 / gridN;
      for (let row = 0; row < gridN; row++) {
        for (let col = 0; col < gridN; col++) {
          const px = Math.floor(col * step + step / 2);
          const py = Math.floor(row * step + step / 2);
          // WebGL readPixels y=0 is bottom; flip to CSS top-left origin.
          const readY = c.height - py - 1;
          gl.readPixels(px, readY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
          // Round to nearest 16 to tolerate GPU linear filtering.
          const r = Math.round(buf[0] / 16) * 16;
          const g = Math.round(buf[1] / 16) * 16;
          const b = Math.round(buf[2] / 16) * 16;
          seen.add(`${r},${g},${b}`);
        }
      }
      document.body.removeChild(c);
      return seen.size;
    });
    expect(distinctCount).toBeGreaterThanOrEqual(8);
  });

  // -------------------------------------------------------------------------
  // 8. Visual screenshot baseline (the atlas itself)
  // -------------------------------------------------------------------------

  test('8 — skin atlas visual baseline screenshot', async ({ page }) => {
    // Draw the full atlas onto the demo canvas so the screenshot is stable.
    await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = document.getElementById('gwen-canvas') as HTMLCanvasElement;
      const renderer = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.DynamicSkin(renderer);
      skin.init();
      renderer.begin();
      renderer.setRenderOffset(G.point(0, 0));
      renderer.setScale(1);
      renderer.setDrawColor(G.color(255, 255, 255, 255));
      // Draw a 512×512 region — canvas may be smaller but that's fine.
      renderer.drawTexturedRect(skin.getTexture(), G.rect(0, 0, 512, 512), 0, 0, 1, 1);
      renderer.end();
    });
    await expect(page.locator('#gwen-canvas')).toHaveScreenshot('skin-atlas.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  // -------------------------------------------------------------------------
  // 9. No console errors on init
  // -------------------------------------------------------------------------

  test('9 — no console.error calls during a normal DynamicSkin init', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      document.body.appendChild(c);
      const renderer = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.DynamicSkin(renderer);
      skin.init();
      document.body.removeChild(c);
    });

    // Give any async console messages a chance to flush.
    await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => r())));

    expect(errors).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // 10. REGIONS array is frozen / immutable
  // -------------------------------------------------------------------------

  // BUG REPORT (gwen-feedback): REGIONS is exported as `readonly RegionDescriptor[]`
  // but not wrapped with Object.freeze(). TypeScript's `readonly` is compile-time only;
  // at runtime the array is mutable and Object.isFrozen() returns false.
  // Fix: change the export to `export const REGIONS = Object.freeze([...] as const)`
  // or wrap after declaration: `Object.freeze(REGIONS)`.

  test('10a — Gwen.REGIONS is exported and non-empty', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      return {
        defined: Array.isArray(G.REGIONS),
        length: G.REGIONS.length as number,
      };
    });
    expect(result.defined).toBe(true);
    expect(result.length).toBeGreaterThan(90);
  });

  // T007 iteration — AtlasRegions.ts now calls Object.freeze on REGIONS, so
  // this assertion passes. Kept enabled to guard against future regressions.
  test('10b — Gwen.REGIONS is Object.freeze()d', async ({ page }) => {
    const frozen = await page.evaluate(() => {
      const G = (window as any).Gwen;
      return Object.isFrozen(G.REGIONS) as boolean;
    });
    // This assertion currently fails: frozen === false.
    // gwen-feedback: src/skin/AtlasRegions.ts must call Object.freeze(REGIONS).
    expect(frozen).toBe(true);
  });
});
