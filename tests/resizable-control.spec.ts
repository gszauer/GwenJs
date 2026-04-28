// T303 — ResizableControl
//
// Categories covered:
//   1  Render          — N/A: ResizableControl defers all rendering to child
//                        Resizer handles; no paint of its own.
//   2  Visual baseline — N/A: control is transparent / no dedicated skin call.
//   3  State visuals   — N/A: no per-state visual change on the container itself.
//   4  Pointer input   — #8 resizer drag fires onResize.
//   5  Touch input     — #8t touch-style drag via onMouseClickLeft triggers onResize.
//   6  Keyboard        — N/A: keyboard enabled flag set but no key handler defined.
//   7  Events          — #8 onResize signal fires with correct caller.
//   8  Resize          — #7 layout positions resizers at correct edges.

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T303 ResizableControl', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction — 8 Resizer children created
  // =========================================================================

  test('1 — new ResizableControl(canvas) creates exactly 8 Resizer children', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const rc = new G.ResizableControl(canvas);
        const resizerCount = rc._resizers.size;
        rc.dispose();
        return { threw: false, resizerCount };
      } catch {
        return { threw: true, resizerCount: 0 };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.resizerCount).toBe(8);
  });

  // =========================================================================
  // 2. setMinimumSize / getMinimumSize round-trip
  // =========================================================================

  test('2 — setMinimumSize(point(50,30)) → getMinimumSize() returns {x:50, y:30}', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const rc = new G.ResizableControl(canvas);
      rc.setMinimumSize(G.point(50, 30));
      const min = rc.getMinimumSize();
      rc.dispose();
      return { x: min.x, y: min.y };
    });
    expect(result.x).toBe(50);
    expect(result.y).toBe(30);
  });

  // =========================================================================
  // 3. setBounds clamps to minimum size
  // =========================================================================

  test('3 — setBounds(0,0,10,10) clamps to minimum size (50,30) when minimum is set', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const rc = new G.ResizableControl(canvas);
      rc.setMinimumSize(G.point(50, 30));
      rc.setBounds(0, 0, 10, 10);
      const b = rc.getBounds();
      rc.dispose();
      return { w: b.w, h: b.h };
    });
    expect(result.w).toBe(50);
    expect(result.h).toBe(30);
  });

  // =========================================================================
  // 4. setClampMovement / shouldClampMovement round-trip
  // =========================================================================

  test('4 — setClampMovement(true) → shouldClampMovement() returns true', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const rc = new G.ResizableControl(canvas);
      const before = rc.shouldClampMovement();
      rc.setClampMovement(true);
      const after = rc.shouldClampMovement();
      rc.dispose();
      return { before, after };
    });
    expect(result.before).toBe(false);
    expect(result.after).toBe(true);
  });

  // =========================================================================
  // 5. disableResizing — all resizers have mouseInputEnabled false
  // =========================================================================

  test('5 — disableResizing() sets mouseInputEnabled=false on all 8 resizers', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const rc = new G.ResizableControl(canvas);
      rc.disableResizing();
      let allDisabled = true;
      for (const r of rc._resizers.values()) {
        if (r.getMouseInputEnabled()) {
          allDisabled = false;
          break;
        }
      }
      rc.dispose();
      return allDisabled;
    });
    expect(result).toBe(true);
  });

  // =========================================================================
  // 6. getResizer(Pos.Left | Pos.Top) returns the TL corner resizer
  // =========================================================================

  test('6 — getResizer(Pos.Left | Pos.Top) returns a non-null resizer with correct dir', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const rc = new G.ResizableControl(canvas);
      const dir = G.Pos.Left | G.Pos.Top;
      const r = rc.getResizer(dir);
      const notNull = r !== null;
      const rDir = r ? r.getResizeDir() : -1;
      rc.dispose();
      return { notNull, rDir, dir };
    });
    expect(result.notNull).toBe(true);
    expect(result.rDir).toBe(result.dir);
  });

  // =========================================================================
  // 7. After layout, resizers positioned at correct edges
  // =========================================================================

  test('7 — after layout on 200×100 bounds, TL resizer at (0,0) and TR at (194,0)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const rc = new G.ResizableControl(canvas);
      rc.setBounds(0, 0, 200, 100);
      // Force a layout pass via doThink on the canvas.
      canvas.doThink();
      const corner = 6;
      const tlResizer = rc.getResizer(G.Pos.Left | G.Pos.Top);
      const trResizer = rc.getResizer(G.Pos.Right | G.Pos.Top);
      const tlBounds = tlResizer ? tlResizer.getBounds() : null;
      const trBounds = trResizer ? trResizer.getBounds() : null;
      rc.dispose();
      return {
        corner,
        tlX: tlBounds?.x ?? -1, tlY: tlBounds?.y ?? -1,
        tlW: tlBounds?.w ?? -1, tlH: tlBounds?.h ?? -1,
        trX: trBounds?.x ?? -1, trY: trBounds?.y ?? -1,
      };
    });
    // TL corner resizer should be at (0, 0) with size (6, 6).
    expect(result.tlX).toBe(0);
    expect(result.tlY).toBe(0);
    expect(result.tlW).toBe(result.corner);
    expect(result.tlH).toBe(result.corner);
    // TR corner resizer should be at (200 - 6, 0).
    expect(result.trX).toBe(200 - result.corner);
    expect(result.trY).toBe(0);
  });

  // =========================================================================
  // 8. onResize signal fires when a resizer moves
  // =========================================================================

  test('8 — onResize fires with controlCaller=rc when a resizer drag moves', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const rc = new G.ResizableControl(canvas);
      rc.setBounds(0, 0, 100, 100);

      let resizeCount = 0;
      let callerOk = false;
      rc.onResize.on((ev: any) => {
        resizeCount++;
        callerOk = ev.controlCaller === rc;
      });

      // Use the Right resizer to simulate a drag.
      const rightResizer = rc.getResizer(G.Pos.Right);
      rightResizer.onMouseClickLeft(5, 5, true);
      rightResizer.onMouseMoved(15, 5, 10, 0);
      rightResizer.onMouseClickLeft(15, 5, false);

      rc.dispose();
      return { resizeCount, callerOk };
    });
    expect(result.resizeCount).toBe(1);
    expect(result.callerOk).toBe(true);
  });

  // =========================================================================
  // Touch: simulate touch-style press + move via onMouseClickLeft
  // =========================================================================

  test('8t — touch-style drag on resizer fires onResize', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const rc = new G.ResizableControl(canvas);
      rc.setBounds(0, 0, 100, 100);

      let fired = false;
      rc.onResize.on(() => { fired = true; });

      // Simulate a touch: press then move via the Bottom resizer.
      const bottomResizer = rc.getResizer(G.Pos.Bottom);
      bottomResizer.onMouseClickLeft(5, 5, true);
      bottomResizer.onMouseMoved(5, 15, 0, 10);
      bottomResizer.onMouseClickLeft(5, 15, false);

      rc.dispose();
      return fired;
    });
    expect(result).toBe(true);
  });
});
