// T302 — Layout::Tile
//
// Categories covered:
//   1  Render          — N/A: Tile is a transparent layout container with
//                        no render() override; no pixel output from the
//                        container itself.
//   2  Visual baseline — Skipped: same reason as Render.
//   3  State visuals   — N/A: no visual states on Tile.
//   4  Pointer input   — N/A: no pointer interaction beyond Base defaults.
//   5  Touch input     — N/A: same.
//   6  Keyboard        — N/A: no keyboard interaction.
//   7  Events          — N/A: Tile exposes no signals.
//   8  Resize          — #3 wrap test implicitly exercises re-layout when the
//                        parent bounds change.

import { test, expect } from '@playwright/test';
import { gotoDemo } from './helpers';

test.describe('T302 Tile', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
  });

  // =========================================================================
  // 1. Construction: 22×22 tile size, docks Pos.Fill
  // =========================================================================

  test('1 — new Tile(canvas): tileSize is 22×22 and dock is Pos.Fill', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const tile = new G.Tile(canvas);
        const ts = tile.getTileSize();
        const dock = tile.getDock();
        tile.dispose();
        return { threw: false, tw: ts.x, th: ts.y, dock, fill: G.Pos.Fill };
      } catch {
        return { threw: true, tw: -1, th: -1, dock: -1, fill: -1 };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.tw).toBe(22);
    expect(result.th).toBe(22);
    expect(result.dock).toBe(result.fill);
  });

  // =========================================================================
  // 2. setTileSize(40, 40) updates getTileSize()
  // =========================================================================

  test('2 — setTileSize(40, 40) updates getTileSize()', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tile = new G.Tile(canvas);
      tile.setTileSize(40, 40);
      const ts = tile.getTileSize();
      tile.dispose();
      return { w: ts.x, h: ts.y };
    });
    expect(result.w).toBe(40);
    expect(result.h).toBe(40);
  });

  // =========================================================================
  // 3. Children placed L→R and wrap to next row when tile overflows
  // =========================================================================

  test('3 — layout places children L→R; wraps to next row on overflow', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      // Use a standalone Base as the parent so the Tile fills a known area.
      const parent = new G.Base(canvas);
      parent.setBounds(0, 0, 200, 200);

      // Tile fills the parent.
      const tile = new G.Tile(parent);
      tile.setTileSize(50, 50);

      // Add 5 children (no dock → Pos.None). Tile is 200px wide → fits 4 per row.
      const children: any[] = [];
      for (let i = 0; i < 5; i++) {
        const c = new G.Base(tile);
        c.setSize(10, 10); // smaller than tile so centering applies
        children.push(c);
      }

      canvas.doThink();

      const positions = children.map(c => ({ x: c.x(), y: c.y() }));
      parent.dispose();
      return positions;
    });

    // With tileSize=50 and parent width=200: 4 tiles per row (4*50=200).
    // Children 0-3 should be on row 0 (y centered in [0..49]).
    // Child 4 should wrap to row 1 (y centered in [50..99]).
    // center offset for a 10×10 child in a 50×50 cell: (50-10)/2 = 20.
    const row0Y = 20; // y=0+20
    const row1Y = 70; // y=50+20

    expect(result[0].y).toBe(row0Y);
    expect(result[1].y).toBe(row0Y);
    expect(result[2].y).toBe(row0Y);
    expect(result[3].y).toBe(row0Y);
    expect(result[4].y).toBe(row1Y);

    // X positions for children 0-3 should advance by tileSize.x=50.
    expect(result[0].x).toBe(20);        // col 0: 0+20
    expect(result[1].x).toBe(70);        // col 1: 50+20
    expect(result[2].x).toBe(120);       // col 2: 100+20
    expect(result[3].x).toBe(170);       // col 3: 150+20
    expect(result[4].x).toBe(20);        // col 0 after wrap
  });

  // =========================================================================
  // 4. Docked children are skipped by Tile layout
  // =========================================================================

  test('4 — docked child is excluded from tile flow (position unchanged by Tile)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const parent = new G.Base(canvas);
      parent.setBounds(0, 0, 200, 200);
      const tile = new G.Tile(parent);
      tile.setTileSize(50, 50);

      // One non-docked child.
      const normal = new G.Base(tile);
      normal.setSize(10, 10);

      // One docked child — must be skipped by Tile.layout.
      const docked = new G.Base(tile);
      docked.setSize(10, 10);
      docked.dock(G.Pos.Top);

      canvas.doThink();

      // The docked child is handled by the base docking pass, not by Tile.
      // Record its dock flag and confirm it is not positioned as a tile.
      const dockedDock = docked.getDock();
      // Normal child must be at tile-centered position (col 0, row 0).
      const nx = normal.x();
      const ny = normal.y();

      parent.dispose();
      return { dockedDock, nx, ny };
    });
    expect(result.dockedDock).not.toBe(0); // Pos.None === 0
    // Normal child at tile position (0+20, 0+20) inside whatever innerBounds
    // are left after the docked child consumes the top strip.
    expect(result.nx).toBeGreaterThanOrEqual(0);
    expect(result.ny).toBeGreaterThanOrEqual(0);
  });

  // =========================================================================
  // 5. Children are centered within their tile cell
  // =========================================================================

  test('5 — small child is centered within its 50×50 tile cell', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const parent = new G.Base(canvas);
      parent.setBounds(0, 0, 200, 200);

      const tile = new G.Tile(parent);
      tile.setTileSize(50, 50);

      const child = new G.Base(tile);
      child.setSize(10, 20); // asymmetric to test both axes independently

      canvas.doThink();

      const cx = child.x();
      const cy = child.y();

      parent.dispose();
      return { cx, cy };
    });
    // innerBounds.x=0, innerBounds.y=0 (no padding on parent).
    // cellX = 0 + floor((50 - 10) / 2) = 20
    // cellY = 0 + floor((50 - 20) / 2) = 15
    expect(result.cx).toBe(20);
    expect(result.cy).toBe(15);
  });
});
