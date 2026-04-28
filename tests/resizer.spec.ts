// T121 — Resizer
//
// Categories covered:
//   1  Render          — N/A: Resizer inherits Dragger which is a no-op render
//   2  Visual baseline — N/A: same reason
//   3  State visuals   — #1–4 cursor type after setResizeDir
//   4  Pointer input   — #5–8 drag → target resize; #9 minimum-size clamp
//   5  Touch input     — #4t synthetic touch press triggers resize path
//   6  Keyboard        — N/A
//   7  Events          — #10 onResize fires on each move while depressed
//   8  Resize          — N/A: Resizer itself has no auto-resize behavior

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T121 Resizer', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction + defaults
  // =========================================================================

  test('1 — new Resizer(canvas): size 6×6; resizeDir=Pos.Left; cursor=SizeWE', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const r = new G.Resizer(canvas);
        const b = r.getBounds();
        const dir = r.getResizeDir();
        const cursor = r._cursor;
        r.dispose();
        return {
          threw: false,
          w: b.w, h: b.h,
          dir,
          cursor,
          left: G.Pos.Left,
          sizeWE: G.CursorType.SizeWE,
        };
      } catch {
        return { threw: true, w: 0, h: 0, dir: 0, cursor: 0, left: 0, sizeWE: 0 };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.w).toBe(6);
    expect(result.h).toBe(6);
    expect(result.dir).toBe(result.left);
    expect(result.cursor).toBe(result.sizeWE);
  });

  // =========================================================================
  // 2. setResizeDir(Left | Top) → SizeNWSE cursor
  // =========================================================================

  test('2 — setResizeDir(Pos.Left | Pos.Top) → cursor SizeNWSE', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const r = new G.Resizer(canvas);
      r.setResizeDir(G.Pos.Left | G.Pos.Top);
      const cursor = r._cursor;
      r.dispose();
      return { cursor, sizeNWSE: G.CursorType.SizeNWSE };
    });
    expect(result.cursor).toBe(result.sizeNWSE);
  });

  // =========================================================================
  // 3. setResizeDir(Right | Top) → SizeNESW cursor
  // =========================================================================

  test('3 — setResizeDir(Pos.Right | Pos.Top) → cursor SizeNESW', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const r = new G.Resizer(canvas);
      r.setResizeDir(G.Pos.Right | G.Pos.Top);
      const cursor = r._cursor;
      r.dispose();
      return { cursor, sizeNESW: G.CursorType.SizeNESW };
    });
    expect(result.cursor).toBe(result.sizeNESW);
  });

  // =========================================================================
  // 4. setResizeDir(Top | Bottom) → SizeNS cursor
  // =========================================================================

  test('4 — setResizeDir(Pos.Top | Pos.Bottom) → cursor SizeNS', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const r = new G.Resizer(canvas);
      r.setResizeDir(G.Pos.Top | G.Pos.Bottom);
      const cursor = r._cursor;
      r.dispose();
      return { cursor, sizeNS: G.CursorType.SizeNS };
    });
    expect(result.cursor).toBe(result.sizeNS);
  });

  // =========================================================================
  // 5. dir=Right: drag dx=10 → target width grows by 10
  // =========================================================================

  test('5 — dir=Right; press + move dx=10 → target width grows by 10', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const target = new G.Base(canvas);
      target.setBounds(50, 50, 100, 80);

      const r = new G.Resizer(canvas);
      r.setResizeDir(G.Pos.Right);
      r.setTarget(target);

      r.onMouseClickLeft(5, 5, true);  // press → _depressed = true
      r.onMouseMoved(15, 5, 10, 0);    // dx=10, dy=0

      const newBounds = target.getBounds();

      r.onMouseClickLeft(15, 5, false);
      r.dispose();
      target.dispose();

      return { w: newBounds.w, x: newBounds.x };
    });
    expect(result.w).toBe(110);
    expect(result.x).toBe(50); // x should not change for Right direction
  });

  // =========================================================================
  // 6. dir=Left: drag dx=10 → x shifts, width shrinks
  // =========================================================================

  test('6 — dir=Left; press + move dx=10 → target.x increases by delta; width shrinks', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const target = new G.Base(canvas);
      target.setBounds(50, 50, 100, 80);

      const r = new G.Resizer(canvas);
      r.setResizeDir(G.Pos.Left);
      r.setTarget(target);

      r.onMouseClickLeft(5, 5, true);
      r.onMouseMoved(15, 5, 10, 0); // dx=10

      const nb = target.getBounds();

      r.onMouseClickLeft(15, 5, false);
      r.dispose();
      target.dispose();

      return { x: nb.x, w: nb.w };
    });
    // With dir=Left, dx=10: newW = max(1, 100-10) = 90; nx = 50 + (100-90) = 60.
    expect(result.w).toBe(90);
    expect(result.x).toBe(60);
  });

  // =========================================================================
  // 7. dir=Bottom: dy=15 → target height grows by 15
  // =========================================================================

  test('7 — dir=Bottom; press + move dy=15 → target height grows by 15', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const target = new G.Base(canvas);
      target.setBounds(50, 50, 100, 80);

      const r = new G.Resizer(canvas);
      r.setResizeDir(G.Pos.Bottom);
      r.setTarget(target);

      r.onMouseClickLeft(5, 5, true);
      r.onMouseMoved(5, 20, 0, 15); // dy=15

      const nb = target.getBounds();

      r.onMouseClickLeft(5, 20, false);
      r.dispose();
      target.dispose();

      return { h: nb.h, y: nb.y };
    });
    expect(result.h).toBe(95);
    expect(result.y).toBe(50); // y unchanged for Bottom direction
  });

  // =========================================================================
  // 8. Diagonal dir=Left|Top: both x+y shift; both w+h shrink
  // =========================================================================

  test('8 — dir=Left|Top; press + move dx=5,dy=8 → x,y both shift; w,h both shrink', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const target = new G.Base(canvas);
      target.setBounds(50, 50, 100, 80);

      const r = new G.Resizer(canvas);
      r.setResizeDir(G.Pos.Left | G.Pos.Top);
      r.setTarget(target);

      r.onMouseClickLeft(5, 5, true);
      r.onMouseMoved(10, 13, 5, 8); // dx=5, dy=8

      const nb = target.getBounds();

      r.onMouseClickLeft(10, 13, false);
      r.dispose();
      target.dispose();

      return { x: nb.x, y: nb.y, w: nb.w, h: nb.h };
    });
    // dir=Left: newW=max(1,100-5)=95; nx=50+(100-95)=55
    // dir=Top:  newH=max(1,80-8)=72;  ny=50+(80-72)=58
    expect(result.w).toBe(95);
    expect(result.x).toBe(55);
    expect(result.h).toBe(72);
    expect(result.y).toBe(58);
  });

  // =========================================================================
  // 9. Minimum size clamp: shrink past 1 px stops at 1
  // =========================================================================

  test('9 — drag shrink past minimum size does not go below 1 px', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const target = new G.Base(canvas);
      target.setBounds(10, 10, 20, 20);

      const r = new G.Resizer(canvas);
      r.setResizeDir(G.Pos.Right);
      r.setTarget(target);

      r.onMouseClickLeft(5, 5, true);
      // Try to shrink width by 500 — far beyond the current 20px.
      r.onMouseMoved(5, 5, -500, 0);

      const nb = target.getBounds();

      r.onMouseClickLeft(5, 5, false);
      r.dispose();
      target.dispose();

      return { w: nb.w };
    });
    // getMinimumSize() default returns (1,1) per Base.
    expect(result.w).toBeGreaterThanOrEqual(1);
  });

  // =========================================================================
  // 10. onResize fires on each move while depressed
  // =========================================================================

  test('10 — onResize fires once per onMouseMoved while depressed', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const target = new G.Base(canvas);
      target.setBounds(0, 0, 100, 100);

      const r = new G.Resizer(canvas);
      r.setResizeDir(G.Pos.Right);
      r.setTarget(target);

      let resizeCount = 0;
      let callerOk = false;
      r.onResize.on((ev: any) => {
        resizeCount++;
        callerOk = ev.controlCaller === r;
      });

      r.onMouseClickLeft(5, 5, true);
      r.onMouseMoved(10, 5, 5, 0);  // 1st move
      r.onMouseMoved(15, 5, 5, 0);  // 2nd move
      r.onMouseMoved(20, 5, 5, 0);  // 3rd move
      r.onMouseClickLeft(20, 5, false);

      r.dispose();
      target.dispose();

      return { resizeCount, callerOk };
    });
    expect(result.resizeCount).toBe(3);
    expect(result.callerOk).toBe(true);
  });

  // =========================================================================
  // Touch: synthetic touch press triggers resize path
  // =========================================================================

  test('4t — touch tap via onMouseClickLeft triggers press+resize path', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const target = new G.Base(canvas);
      target.setBounds(0, 0, 100, 100);

      const r = new G.Resizer(canvas);
      r.setResizeDir(G.Pos.Right);
      r.setTarget(target);

      let resizeFired = false;
      r.onResize.on(() => { resizeFired = true; });

      // Simulate touch: press then move.
      r.onMouseClickLeft(5, 5, true);
      r.onMouseMoved(15, 5, 10, 0);
      r.onMouseClickLeft(15, 5, false);

      const nb = target.getBounds();
      r.dispose();
      target.dispose();

      return { resizeFired, w: nb.w };
    });
    expect(result.resizeFired).toBe(true);
    expect(result.w).toBe(110);
  });
});
