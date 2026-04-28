// T300 — Layout::Position + Center
//
// Categories covered:
//   1  Render          — #6: Position itself adds no pixels (no-op render)
//   2  Visual baseline — Skipped: Position is a transparent layout container;
//                        no visual output to baseline.
//   3  State visuals   — N/A: no hover/pressed/disabled/focused states.
//   4  Pointer input   — N/A: mouse input is disabled on Position.
//   5  Touch input     — N/A: same as Pointer input.
//   6  Keyboard        — N/A: no keyboard interaction.
//   7  Events          — N/A: no user-facing signals.
//   8  Resize          — Implicitly exercised in #3 (postLayout re-positions
//                        child when parent is sized).

import { test, expect } from '@playwright/test';
import { gotoDemo } from './helpers';

test.describe('T300 Position + Center', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
  });

  // =========================================================================
  // 1. Construction — default position Pos.Left | Pos.Top
  // =========================================================================

  test('1 — new Position(canvas) does not throw; default position is Pos.Left | Pos.Top', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const pos = new G.Position(canvas);
        const p = pos.getPosition();
        const expected = G.Pos.Left | G.Pos.Top;
        pos.dispose();
        return { threw: false, position: p, expected };
      } catch {
        return { threw: true, position: -1, expected: -1 };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.position).toBe(result.expected);
  });

  // =========================================================================
  // 2. setPosition updates stored position
  // =========================================================================

  test('2 — setPosition(Pos.Center) updates getPosition()', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const pos = new G.Position(canvas);
      pos.setPosition(G.Pos.Center);
      const p = pos.getPosition();
      pos.dispose();
      return { position: p, center: G.Pos.Center };
    });
    expect(result.position).toBe(result.center);
  });

  // =========================================================================
  // 3. postLayout centers a non-docked child within the parent's inner bounds
  // =========================================================================

  test('3 — postLayout positions non-docked child to Pos.Center within parent', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      // Parent Position container: 200×200 at (0,0).
      const container = new G.Position(canvas);
      container.setBounds(0, 0, 200, 200);
      container.setPosition(G.Pos.Center);

      // Small child (no dock → Pos.None).
      const child = new G.Base(container);
      child.setSize(40, 20);

      // Drive layout so postLayout fires.
      canvas.doThink();

      const cx = child.x();
      const cy = child.y();

      container.dispose();
      return { cx, cy };
    });
    // Center of 200×200 parent: expected x=(200-40)/2=80, y=(200-20)/2=90.
    expect(result.cx).toBe(80);
    expect(result.cy).toBe(90);
  });

  // =========================================================================
  // 4. Docked children are not repositioned by postLayout
  // =========================================================================

  test('4 — docked children are skipped by postLayout (position unchanged)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const container = new G.Position(canvas);
      container.setBounds(0, 0, 200, 200);
      container.setPosition(G.Pos.Center);

      const dockedChild = new G.Base(container);
      dockedChild.setSize(40, 20);
      dockedChild.dock(G.Pos.Top); // docked — must be skipped by Position.postLayout

      canvas.doThink();

      // Docked Top: docked layout places it at x=0, y=0 spanning full width.
      // It must NOT be moved to center by postLayout.
      const dock = dockedChild.getDock();
      const cy = dockedChild.y(); // stays at 0, not repositioned to y=90

      container.dispose();
      return { dock, cy };
    });
    expect(result.dock).not.toBe(0); // Pos.None === 0
    // postLayout should not center the docked child — it stays at top.
    expect(result.cy).toBe(0);
  });

  // =========================================================================
  // 5. Center subclass default position is Pos.Center
  // =========================================================================

  test('5 — Center subclass has default position Pos.Center', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const c = new G.Center(canvas);
      const p = c.getPosition();
      c.dispose();
      return { position: p, center: G.Pos.Center };
    });
    expect(result.position).toBe(result.center);
  });

  // =========================================================================
  // 6. Position render is a no-op (adds no pixels of its own)
  // =========================================================================

  test('6 — Position render is a no-op (canvas background unchanged after adding empty Position)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const BG_R = 20, BG_G = 30, BG_B = 40;

      const htmlC = document.createElement('canvas');
      htmlC.width = 200; htmlC.height = 200;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cv = new G.Canvas(skin, htmlC);
      cv.setBounds(0, 0, 200, 200);
      cv.setDrawBackground(true);
      cv.setBackgroundColor(G.color(BG_R, BG_G, BG_B, 255));

      // Add a Position with no children — should add no pixels.
      const pos = new G.Position(cv);
      pos.setBounds(0, 0, 200, 200);

      cv.doThink();
      cv.redraw();
      cv.renderCanvas();

      const gl = renderer.gl;
      const px = new Uint8Array(4);
      // Sample the middle — should still be the background color.
      gl.readPixels(100, htmlC.height - 100 - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);

      cv.dispose();
      document.body.removeChild(htmlC);
      return { r: px[0], g: px[1], b: px[2] };
    });
    // Position itself draws nothing — pixel stays at background color.
    expect(result.r).toBeLessThan(40);
    expect(result.g).toBeLessThan(50);
    expect(result.b).toBeLessThan(60);
  });
});
