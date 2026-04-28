// T004 — WebGL2 Renderer
//
// Skipped categories per control:
//   - Pointer input / Touch input / Keyboard: Not applicable — the renderer
//     is a drawing API with no interactive controls.
//   - Events: No public Signal events are emitted by the renderer.
//
// Key constraint: WebGL2 defaults to preserveDrawingBuffer=false, meaning the
// drawing buffer is implementation-defined after the browser composites it.
// readPixels is only reliable when called within the same JS task as the draw.
// All pixel spot-checks therefore happen inside a single page.evaluate that
// both draws and reads before yielding to the event loop.

import { test, expect, type Page } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

// ---------------------------------------------------------------------------
// Test-level helper: assert RGBA channels within ±tolerance
// ---------------------------------------------------------------------------

function expectPixelNear(
  actual: [number, number, number, number],
  expected: [number, number, number, number],
  tolerance = 3,
  label = '',
): void {
  const [ar, ag, ab, aa] = actual;
  const [er, eg, eb, ea] = expected;
  const msg = label ? ` (${label})` : '';
  expect(Math.abs(ar - er), `red channel${msg}`).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(ag - eg), `green channel${msg}`).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(ab - eb), `blue channel${msg}`).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(aa - ea), `alpha channel${msg}`).toBeLessThanOrEqual(tolerance);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('T004 WebGL2 Renderer', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }: { page: Page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // -------------------------------------------------------------------------
  // 1. Context + init
  // -------------------------------------------------------------------------

  test('1a — renderer exposes a WebGL2RenderingContext', async ({ page }) => {
    const isGL2 = await page.evaluate(() => {
      const c = document.getElementById('gwen-canvas') as HTMLCanvasElement;
      const ctx = c.getContext('webgl2');
      return ctx instanceof WebGL2RenderingContext;
    });
    expect(isGL2).toBe(true);
  });

  test('1b — new WebGL2Renderer on fresh canvas does not throw', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      try {
        const c = document.createElement('canvas');
        c.width = 200;
        c.height = 200;
        document.body.appendChild(c);
        const r = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
        r.init();
        document.body.removeChild(c);
        return 'ok';
      } catch (e) {
        return String(e);
      }
    });
    expect(result).toBe('ok');
  });

  test('1c — missing WebGL2 throws descriptive error', async ({ page }) => {
    const msg = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = document.createElement('canvas');
      c.width = 200;
      c.height = 200;
      // Override getContext so it refuses webgl2.
      // Cast to any to bypass the overloaded-signature constraint.
      const original = c.getContext.bind(c);
      (c as any).getContext = (id: string, ...args: unknown[]) => {
        if (id === 'webgl2') return null;
        return (original as (id: string, ...a: unknown[]) => unknown)(id, ...args);
      };
      try {
        new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
        return 'no-throw';
      } catch (e) {
        return String(e);
      }
    });
    expect(msg).toContain('WebGL2');
  });

  // -------------------------------------------------------------------------
  // 2. Smoke render — pixel spot-checks
  //
  // The demo draws (scale=1, offset=(0,0)):
  //   blue  rect(40,40,200,120)  → physical px (40,40)-(240,160)
  //   red   rect(260,40,80,80)   → physical px (260,40)-(340,120)
  //
  // readPixels must happen in the same JS task as the draw (preserveDrawingBuffer
  // is false). We redraw on a fresh isolated canvas here; the demo canvas
  // screenshot still uses the composited result for the visual baseline test.
  // -------------------------------------------------------------------------

  test('2a — pixel inside blue rect is approximately (60,90,150,255)', async ({ page }) => {
    const pixel = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = document.createElement('canvas');
      c.width = 600;
      c.height = 400;
      document.body.appendChild(c);
      const r = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
      r.init();
      r.begin();
      r.setDrawColor(G.color(60, 90, 150, 255));
      r.drawFilledRect(G.rect(40, 40, 200, 120));
      r.end();
      // readPixels immediately, before yielding to event loop.
      const gl = c.getContext('webgl2')!;
      const px = 60;
      const readY = c.height - 60 - 1;
      const buf = new Uint8Array(4);
      gl.readPixels(px, readY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      document.body.removeChild(c);
      return [buf[0], buf[1], buf[2], buf[3]] as [number, number, number, number];
    });
    expectPixelNear(pixel, [60, 90, 150, 255], 3, 'blue rect');
  });

  test('2b — pixel inside red rect is approximately (200,80,80,255)', async ({ page }) => {
    const pixel = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = document.createElement('canvas');
      c.width = 600;
      c.height = 400;
      document.body.appendChild(c);
      const r = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
      r.init();
      r.begin();
      r.setDrawColor(G.color(200, 80, 80, 255));
      r.drawFilledRect(G.rect(260, 40, 80, 80));
      r.end();
      const gl = c.getContext('webgl2')!;
      const px = 280;
      const readY = c.height - 60 - 1;
      const buf = new Uint8Array(4);
      gl.readPixels(px, readY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      document.body.removeChild(c);
      return [buf[0], buf[1], buf[2], buf[3]] as [number, number, number, number];
    });
    expectPixelNear(pixel, [200, 80, 80, 255], 3, 'red rect');
  });

  test('2c — pixel at undrawn location has alpha === 0', async ({ page }) => {
    // With alpha:true and premultipliedAlpha:false, undrawn canvas pixels are
    // transparent. Verify this by drawing a small rect and sampling outside it.
    const alpha = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = document.createElement('canvas');
      c.width = 600;
      c.height = 400;
      document.body.appendChild(c);
      const r = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
      r.init();
      r.begin();
      r.setDrawColor(G.color(60, 90, 150, 255));
      r.drawFilledRect(G.rect(40, 40, 200, 120));
      r.end();
      const gl = c.getContext('webgl2')!;
      // Sample at (500, 350) — well outside the drawn rect.
      const readY = c.height - 350 - 1;
      const buf = new Uint8Array(4);
      gl.readPixels(500, readY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      document.body.removeChild(c);
      return buf[3];
    });
    expect(alpha).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 3. Visual screenshot baseline (composited result from the demo draw)
  // -------------------------------------------------------------------------

  test('3 — smoke render visual baseline', async ({ page }) => {
    await expect(page.locator('#gwen-canvas')).toHaveScreenshot('smoke-default.png', {
      maxDiffPixelRatio: 0.02,
    });
  });

  // -------------------------------------------------------------------------
  // 4. VertexBatch capacity
  // -------------------------------------------------------------------------

  test('4 — VertexBatch capacity, isFull, reset', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const batch = new G.VertexBatch(10);

      for (let i = 0; i < 9; i++) {
        batch.addVert(i, i, 0, 0, 1, 1, 1, 1);
      }
      const count9 = batch.vertexCount as number;
      const full9 = batch.isFull(2) as boolean; // capacity(10) - count(9) = 1 ≤ 2 → true

      batch.addVert(9, 9, 0, 0, 1, 1, 1, 1);
      const count10 = batch.vertexCount as number;
      const full10 = batch.isFull(0) as boolean; // 10 - 10 = 0 ≤ 0 → true

      batch.reset();
      const countAfterReset = batch.vertexCount as number;

      return { count9, full9, count10, full10, countAfterReset };
    });

    expect(result.count9).toBe(9);
    expect(result.full9).toBe(true);
    expect(result.count10).toBe(10);
    expect(result.full10).toBe(true);
    expect(result.countAfterReset).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 5. setRenderOffset and setScale — draw + read in the same evaluate
  // -------------------------------------------------------------------------

  test('5a — setRenderOffset shifts subsequent draws', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = document.createElement('canvas');
      c.width = 200;
      c.height = 200;
      document.body.appendChild(c);
      const r = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
      r.init();
      r.begin();
      r.setRenderOffset(G.point(10, 20));
      r.setDrawColor(G.color(255, 0, 128, 255));
      // drawFilledRect(rect(0,0,50,50)) with offset(10,20) → physical (10,20,50,50)
      r.drawFilledRect(G.rect(0, 0, 50, 50));
      r.end();

      const gl = c.getContext('webgl2')!;
      const read = (px: number, py: number) => {
        const readY = c.height - py - 1;
        const buf = new Uint8Array(4);
        gl.readPixels(px, readY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        return [buf[0], buf[1], buf[2], buf[3]];
      };

      const inside = read(15, 25); // physical (15,25) inside (10,20)-(60,70)
      const outside = read(5, 5);  // physical (5,5) outside the rect

      document.body.removeChild(c);
      return { inside, outside };
    });

    expectPixelNear(
      result.inside as [number, number, number, number],
      [255, 0, 128, 255],
      3,
      'inside offset rect',
    );
    expect(result.outside[3]).toBe(0);
  });

  test('5b — setScale enlarges drawn rects', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = document.createElement('canvas');
      c.width = 200;
      c.height = 200;
      document.body.appendChild(c);
      const r = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
      r.init();
      r.begin();
      r.setRenderOffset(G.point(0, 0));
      r.setScale(2.0);
      r.setDrawColor(G.color(0, 200, 100, 255));
      // rect(0,0,10,10) with scale=2 → physical (0,0,20,20)
      r.drawFilledRect(G.rect(0, 0, 10, 10));
      r.end();

      const gl = c.getContext('webgl2')!;
      const read = (px: number, py: number) => {
        const readY = c.height - py - 1;
        const buf = new Uint8Array(4);
        gl.readPixels(px, readY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        return [buf[0], buf[1], buf[2], buf[3]];
      };

      const inside = read(15, 15); // physical (15,15) inside (0,0,20,20)
      const outside = read(25, 25); // physical (25,25) outside

      document.body.removeChild(c);
      return { inside, outside };
    });

    expectPixelNear(
      result.inside as [number, number, number, number],
      [0, 200, 100, 255],
      3,
      'inside scaled rect',
    );
    expect(result.outside[3]).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 6. Clip region — startClip / endClip
  // -------------------------------------------------------------------------

  test('6 — startClip restricts drawing to clip region', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = document.createElement('canvas');
      c.width = 300;
      c.height = 300;
      document.body.appendChild(c);
      const r = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
      r.init();
      r.begin();
      r.setRenderOffset(G.point(0, 0));
      r.setScale(1);
      r.setClipRegion(G.rect(50, 50, 100, 100));
      r.startClip();
      r.setDrawColor(G.color(180, 60, 240, 255));
      r.drawFilledRect(G.rect(0, 0, 300, 300));
      r.endClip();
      r.end();

      const gl = c.getContext('webgl2')!;
      const read = (px: number, py: number) => {
        const readY = c.height - py - 1;
        const buf = new Uint8Array(4);
        gl.readPixels(px, readY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        return [buf[0], buf[1], buf[2], buf[3]];
      };

      const inside = read(75, 75);  // (75,75) inside clip rect(50,50,100,100)
      const outside = read(25, 25); // (25,25) outside clip region

      document.body.removeChild(c);
      return { inside, outside };
    });

    expectPixelNear(
      result.inside as [number, number, number, number],
      [180, 60, 240, 255],
      3,
      'inside clip',
    );
    expect(result.outside[3]).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 7. Clip region visibility
  // -------------------------------------------------------------------------

  test('7 — clipRegionVisible returns false for zero-size region', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = document.createElement('canvas');
      c.width = 100;
      c.height = 100;
      document.body.appendChild(c);
      const r = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
      r.init();

      r.setClipRegion(G.rect(0, 0, 0, 0));
      const falseCase = r.clipRegionVisible() as boolean;

      r.setClipRegion(G.rect(0, 0, 10, 10));
      const trueCase = r.clipRegionVisible() as boolean;

      document.body.removeChild(c);
      return { falseCase, trueCase };
    });

    expect(result.falseCase).toBe(false);
    expect(result.trueCase).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 8. translate and translateRect helpers
  // -------------------------------------------------------------------------

  test('8 — translate and translateRect with offset+scale', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = document.createElement('canvas');
      c.width = 200;
      c.height = 200;
      document.body.appendChild(c);
      const r = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
      r.init();

      r.setRenderOffset(G.point(10, 20));
      r.setScale(2);

      // translate(5, 5): (5+10)*2=30, (5+20)*2=50 → ceil → [30, 50]
      const translated = r.translate(5, 5) as [number, number];

      // translateRect(rect(5,5,10,10)): x=30, y=50, w=ceil(10*2)=20, h=20
      const tr = r.translateRect(G.rect(5, 5, 10, 10)) as { x: number; y: number; w: number; h: number };

      document.body.removeChild(c);
      return { translated, tr };
    });

    expect(result.translated).toEqual([30, 50]);
    expect(result.tr).toEqual({ x: 30, y: 50, w: 20, h: 20 });
  });

  // -------------------------------------------------------------------------
  // 9. addClipRegion quirk — replaces x/y with render offset before intersect
  // -------------------------------------------------------------------------

  test('9 — addClipRegion uses render offset, not incoming x/y; caller rect unmutated', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = document.createElement('canvas');
      c.width = 800;
      c.height = 800;
      document.body.appendChild(c);
      const r = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
      r.init();

      r.setRenderOffset(G.point(100, 100));
      r.setClipRegion(G.rect(0, 0, 500, 500));

      const incoming = G.rect(50, 50, 200, 200);
      r.addClipRegion(incoming);

      const clip = r.clipRegion() as { x: number; y: number; w: number; h: number };
      const callerUnmutated = (incoming.x === 50) && (incoming.y === 50);

      document.body.removeChild(c);
      return {
        clip: { x: clip.x, y: clip.y, w: clip.w, h: clip.h },
        callerUnmutated,
      };
    });

    // addClipRegion replaces x/y with renderOffset (100,100), keeps w/h=200,200.
    // Intersects with existing clip (0,0,500,500) → result is (100,100,200,200).
    expect(result.clip).toEqual({ x: 100, y: 100, w: 200, h: 200 });
    expect(result.callerUnmutated).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 10. drawShavedCornerRect and drawLinedRect (default Renderer impls)
  // -------------------------------------------------------------------------

  test('10 — drawShavedCornerRect and drawLinedRect produce correct pixels', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = document.createElement('canvas');
      c.width = 300;
      c.height = 300;
      document.body.appendChild(c);
      const r = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
      r.init();

      r.begin();
      r.setRenderOffset(G.point(0, 0));
      r.setScale(1);

      // drawShavedCornerRect at (20, 20, 60, 60).
      r.setDrawColor(G.color(255, 200, 0, 255));
      r.drawShavedCornerRect(G.rect(20, 20, 60, 60));

      // drawLinedRect at (120, 20, 60, 60).
      r.setDrawColor(G.color(0, 150, 255, 255));
      r.drawLinedRect(G.rect(120, 20, 60, 60));

      r.end();

      const gl = c.getContext('webgl2')!;
      const read = (px: number, py: number) => {
        const readY = c.height - py - 1;
        const buf = new Uint8Array(4);
        gl.readPixels(px, readY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        return [buf[0], buf[1], buf[2], buf[3]] as [number, number, number, number];
      };

      // drawShavedCornerRect: top edge at col 22 (not corner) should be drawn.
      const shavedEdge = read(22, 20);
      // drawShavedCornerRect: exact corner (20,20) is cut — should be transparent.
      const shavedCorner = read(20, 20);

      // drawLinedRect: top edge center.
      const linedEdge = read(150, 20);
      // drawLinedRect: interior — transparent.
      const linedInterior = read(150, 40);

      document.body.removeChild(c);
      return { shavedEdge, shavedCorner, linedEdge, linedInterior };
    });

    // Shaved edge: drawn, yellow (r≈255, g≈200).
    expect(result.shavedEdge[3]).toBe(255);
    expect(result.shavedEdge[0]).toBeGreaterThan(200);

    // Shaved corner: transparent.
    expect(result.shavedCorner[3]).toBe(0);

    // Lined edge: drawn, blue (b≈255).
    expect(result.linedEdge[3]).toBe(255);
    expect(result.linedEdge[2]).toBeGreaterThan(200);

    // Lined interior: transparent.
    expect(result.linedInterior[3]).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 11. Resize — viewport and projection update after renderer.resize()
  // -------------------------------------------------------------------------

  test('11 — resize updates canvas and allows drawing at new dimensions', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = document.createElement('canvas');
      c.width = 200;
      c.height = 200;
      document.body.appendChild(c);
      const r = new G.WebGL2Renderer(c, { devicePixelRatio: 1 });
      r.init();

      // Resize to 400×300.
      r.resize(400, 300);

      r.begin();
      r.setRenderOffset(G.point(0, 0));
      r.setScale(1);
      r.setDrawColor(G.color(100, 200, 50, 255));
      // Draw at (300,200,80,80) — only reachable in the new 400×300 bounds.
      r.drawFilledRect(G.rect(300, 200, 80, 80));
      r.end();

      const newW = c.width as number;
      const newH = c.height as number;

      const gl = c.getContext('webgl2')!;
      const px = 320;
      const py = 220;
      const readY = newH - py - 1;
      const buf = new Uint8Array(4);
      gl.readPixels(px, readY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);

      document.body.removeChild(c);
      return { newW, newH, pixel: [buf[0], buf[1], buf[2], buf[3]] };
    });

    expect(result.newW).toBe(400);
    expect(result.newH).toBe(300);
    expectPixelNear(
      result.pixel as [number, number, number, number],
      [100, 200, 50, 255],
      3,
      'pixel after resize',
    );
  });
});
