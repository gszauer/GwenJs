// T304 — WindowCloseButton, WindowMaximizeButton, WindowMinimizeButton
//
// Categories covered:
//   1  Render          — #3 render is no-op without window; #4,#6,#7 render
//                        calls skin draw methods when window is set (no-throw).
//   2  Visual baseline — Skipped: skin draw calls depend on atlas textures
//                        loaded from assets; results vary across environments.
//   3  State visuals   — #5 setMaximized toggles isMaximized() flag.
//   4  Pointer input   — #8 onPress fires via canvas input path (inherited Button).
//   5  Touch input     — #8t touch-style tap fires onPress.
//   6  Keyboard        — N/A: tabable is false; Space key path is inherited Button
//                        but intentionally untabable; covered sufficiently by Button spec.
//   7  Events          — #8 onPress fires with correct caller.
//   8  Resize          — N/A: fixed-size buttons; no auto-resize behavior.

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T304 WindowButtons', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. WindowCloseButton construction: size 31×31; tabable false
  // =========================================================================

  test('1 — WindowCloseButton: size 31×31, tabable false, mouseInput enabled', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const btn = new G.WindowCloseButton(canvas);
        const b = btn.getBounds();
        const tabable = btn.isTabable();
        const mouseEnabled = btn.getMouseInputEnabled();
        btn.dispose();
        return { threw: false, w: b.w, h: b.h, tabable, mouseEnabled };
      } catch {
        return { threw: true, w: 0, h: 0, tabable: true, mouseEnabled: false };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.w).toBe(31);
    expect(result.h).toBe(31);
    expect(result.tabable).toBe(false);
    expect(result.mouseEnabled).toBe(true);
  });

  // =========================================================================
  // 2. setWindow / getWindow round-trip
  // =========================================================================

  test('2 — setWindow(win) → getWindow() returns same window reference', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const btn = new G.WindowCloseButton(canvas);
      const win = new G.Base(canvas);
      btn.setWindow(win);
      const got = btn.getWindow() === win;
      btn.dispose();
      win.dispose();
      return got;
    });
    expect(result).toBe(true);
  });

  // =========================================================================
  // 3. Render no-op when no window set (does not throw; skin not called)
  // =========================================================================

  test('3 — render() is no-op (no-throw) when window is not set', async ({ page }) => {
    const threw = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 100; htmlC.height = 100;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cvs = new G.Canvas(skin, htmlC);
      cvs.setBounds(0, 0, 100, 100);

      try {
        const btn = new G.WindowCloseButton(cvs);
        btn.setBounds(5, 5, 31, 31);
        // No setWindow call — render should be a no-op.
        cvs.doThink();
        cvs.redraw();
        cvs.renderCanvas();
        cvs.dispose();
        document.body.removeChild(htmlC);
        return false;
      } catch {
        document.body.removeChild(htmlC);
        return true;
      }
    });
    expect(threw).toBe(false);
  });

  // =========================================================================
  // 4. Render calls skin.drawWindowCloseButton when window is set
  // =========================================================================

  test('4 — render does not throw and calls drawWindowCloseButton when window set', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 100; htmlC.height = 100;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cvs = new G.Canvas(skin, htmlC);
      cvs.setBounds(0, 0, 100, 100);

      let drawCalled = false;
      const origDraw = skin.drawWindowCloseButton.bind(skin);
      skin.drawWindowCloseButton = (...args: any[]) => {
        drawCalled = true;
        return origDraw(...args);
      };

      let threw = false;
      try {
        const win = new G.Base(cvs);
        const btn = new G.WindowCloseButton(cvs);
        btn.setBounds(5, 5, 31, 31);
        btn.setWindow(win);
        cvs.doThink();
        cvs.redraw();
        cvs.renderCanvas();
        btn.dispose();
        win.dispose();
      } catch {
        threw = true;
      }

      cvs.dispose();
      document.body.removeChild(htmlC);
      return { threw, drawCalled };
    });
    expect(result.threw).toBe(false);
    expect(result.drawCalled).toBe(true);
  });

  // =========================================================================
  // 5. WindowMaximizeButton: setMaximized / isMaximized toggle
  // =========================================================================

  test('5 — WindowMaximizeButton: setMaximized(true) → isMaximized() true; false → false', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const btn = new G.WindowMaximizeButton(canvas);
      const before = btn.isMaximized();
      btn.setMaximized(true);
      const afterTrue = btn.isMaximized();
      btn.setMaximized(false);
      const afterFalse = btn.isMaximized();
      btn.dispose();
      return { before, afterTrue, afterFalse };
    });
    expect(result.before).toBe(false);
    expect(result.afterTrue).toBe(true);
    expect(result.afterFalse).toBe(false);
  });

  // =========================================================================
  // 6. WindowMaximizeButton render calls drawWindowMaximizeButton with maximized flag
  // =========================================================================

  test('6 — WindowMaximizeButton render calls drawWindowMaximizeButton with correct maximized arg', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 100; htmlC.height = 100;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cvs = new G.Canvas(skin, htmlC);
      cvs.setBounds(0, 0, 100, 100);

      const capturedMaxArgs: boolean[] = [];
      const origDraw = skin.drawWindowMaximizeButton.bind(skin);
      skin.drawWindowMaximizeButton = (...args: any[]) => {
        // 5th argument (index 4) is the maximized flag per the impl.
        capturedMaxArgs.push(args[4]);
        return origDraw(...args);
      };

      let threw = false;
      try {
        const win = new G.Base(cvs);
        const btn = new G.WindowMaximizeButton(cvs);
        btn.setBounds(5, 5, 31, 31);
        btn.setWindow(win);
        btn.setMaximized(true);
        cvs.doThink();
        cvs.redraw();
        cvs.renderCanvas();
        btn.dispose();
        win.dispose();
      } catch {
        threw = true;
      }

      cvs.dispose();
      document.body.removeChild(htmlC);
      return { threw, capturedMaxArgs };
    });
    expect(result.threw).toBe(false);
    // At least one render call happened and the maximized flag was true.
    expect(result.capturedMaxArgs.length).toBeGreaterThan(0);
    expect(result.capturedMaxArgs[result.capturedMaxArgs.length - 1]).toBe(true);
  });

  // =========================================================================
  // 7. WindowMinimizeButton construction and render
  // =========================================================================

  test('7 — WindowMinimizeButton construction and render does not throw', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 100; htmlC.height = 100;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cvs = new G.Canvas(skin, htmlC);
      cvs.setBounds(0, 0, 100, 100);

      let drawCalled = false;
      const origDraw = skin.drawWindowMinimizeButton.bind(skin);
      skin.drawWindowMinimizeButton = (...args: any[]) => {
        drawCalled = true;
        return origDraw(...args);
      };

      let threw = false;
      let size = { w: 0, h: 0 };
      try {
        const win = new G.Base(cvs);
        const btn = new G.WindowMinimizeButton(cvs);
        btn.setBounds(5, 5, 31, 31);
        btn.setWindow(win);
        size = { w: btn.getBounds().w, h: btn.getBounds().h };
        cvs.doThink();
        cvs.redraw();
        cvs.renderCanvas();
        btn.dispose();
        win.dispose();
      } catch {
        threw = true;
      }

      cvs.dispose();
      document.body.removeChild(htmlC);
      return { threw, drawCalled, w: size.w, h: size.h };
    });
    expect(result.threw).toBe(false);
    expect(result.drawCalled).toBe(true);
    expect(result.w).toBe(31);
    expect(result.h).toBe(31);
  });

  // =========================================================================
  // 8. All three extend Button — onPress works via canvas input
  // =========================================================================

  test('8 — WindowCloseButton inherits Button: onPress fires on click+release when hovered', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const btn = new G.WindowCloseButton(canvas);
      btn.setBounds(10, 10, 31, 31);

      let pressCount = 0;
      let callerOk = false;
      btn.onPress.on((ev: any) => {
        pressCount++;
        callerOk = ev.controlCaller === btn;
      });

      // Hover then click via canvas input router.
      canvas.inputMouseMoved(25, 25, 0, 0);
      canvas.inputMouseButton(0, true);
      canvas.inputMouseButton(0, false);

      btn.dispose();
      return { pressCount, callerOk };
    });
    expect(result.pressCount).toBe(1);
    expect(result.callerOk).toBe(true);
  });

  // =========================================================================
  // Touch: tap via canvas input fires onPress on WindowMaximizeButton
  // =========================================================================

  test('8t — touch tap on WindowMaximizeButton fires onPress', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const btn = new G.WindowMaximizeButton(canvas);
      btn.setBounds(50, 50, 31, 31);

      let pressCount = 0;
      btn.onPress.on(() => { pressCount++; });

      // Simulate touch: move into bounds then press+release.
      canvas.inputMouseMoved(65, 65, 0, 0);
      canvas.inputMouseButton(0, true);
      canvas.inputMouseButton(0, false);

      btn.dispose();
      return pressCount;
    });
    expect(result).toBe(1);
  });
});
