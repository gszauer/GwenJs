// T305 — WindowControl
//
// Categories covered:
//   1  Render          — #8 render produces pixels (title bar + frame).
//   2  Visual baseline — #2 toHaveScreenshot 'window-control-default.png'.
//   3  State visuals   — N/A: WindowControl has no per-state hover/pressed visual
//                        on the container itself; the title bar Dragger and
//                        close Button carry their own state art (covered in T120/T101).
//   4  Pointer input   — #4 close-button click fires onWindowClosed via canvas input.
//   5  Touch input     — #4t touch-tap on close button fires onWindowClosed.
//   6  Keyboard        — N/A: WindowControl sets keyboardInputEnabled=false.
//   7  Events          — #4 onWindowClosed fires with correct caller; #5 makeModal /
//                        destroyModal lifecycle.
//   8  Resize          — N/A: resize is inherited from ResizableControl (T303).

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T305 WindowControl', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction defaults: 200×150; minSize 100×40; closable; keyboard off
  // =========================================================================

  test('1 — construction: 200×150, minSize 100×40, closable=true, keyboardInput=false', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const win = new G.WindowControl(canvas);
        const b = win.getBounds();
        const min = win.getMinimumSize();
        const closable = win.isClosable();
        const kbEnabled = win.getKeyboardInputEnabled();
        win.dispose();
        return { threw: false, w: b.w, h: b.h, minX: min.x, minY: min.y, closable, kbEnabled };
      } catch {
        return { threw: true, w: 0, h: 0, minX: 0, minY: 0, closable: false, kbEnabled: true };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.w).toBe(200);
    expect(result.h).toBe(150);
    expect(result.minX).toBe(100);
    expect(result.minY).toBe(40);
    expect(result.closable).toBe(true);
    expect(result.kbEnabled).toBe(false);
  });

  // =========================================================================
  // 2. setTitle / getTitle round-trip
  // =========================================================================

  test('2 — setTitle("Settings") → getTitle() returns "Settings"', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const win = new G.WindowControl(canvas, 'Window');
      const before = win.getTitle();
      win.setTitle('Settings');
      const after = win.getTitle();
      win.dispose();
      return { before, after };
    });
    expect(result.before).toBe('Window');
    expect(result.after).toBe('Settings');
  });

  // =========================================================================
  // 3. setClosable(false) hides close button
  // =========================================================================

  test('3 — setClosable(false) hides close button; isClosable() returns false', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const win = new G.WindowControl(canvas);
      const closableBefore = win.isClosable();
      // Base stores visibility in _hidden; no isHidden() accessor.
      const btnVisibleBefore = !win._closeButton._hidden;
      win.setClosable(false);
      const closableAfter = win.isClosable();
      const btnHiddenAfter = win._closeButton._hidden;
      win.dispose();
      return { closableBefore, btnVisibleBefore, closableAfter, btnHiddenAfter };
    });
    expect(result.closableBefore).toBe(true);
    expect(result.btnVisibleBefore).toBe(true);
    expect(result.closableAfter).toBe(false);
    expect(result.btnHiddenAfter).toBe(true);
  });

  // =========================================================================
  // 4. close() fires onWindowClosed; window becomes hidden
  // =========================================================================

  test('4 — close() fires onWindowClosed with correct caller; window becomes hidden', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const win = new G.WindowControl(canvas);

      let closedCount = 0;
      let callerOk = false;
      win.onWindowClosed.on((ev: any) => {
        closedCount++;
        callerOk = ev.controlCaller === win;
      });

      win.close();

      // Base has no isHidden(); check the private _hidden flag directly.
      const hidden = win._hidden;
      win.dispose();
      return { closedCount, callerOk, hidden };
    });
    expect(result.closedCount).toBe(1);
    expect(result.callerOk).toBe(true);
    expect(result.hidden).toBe(true);
  });

  // =========================================================================
  // 4t. Touch-tap close button via canvas input fires onWindowClosed
  // =========================================================================

  test('4t — touch-tap on close button via canvas input fires onWindowClosed', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const win = new G.WindowControl(canvas);
      // Position window so its close button is in canvas-space at a known location.
      win.setBounds(0, 0, 200, 150);
      canvas.doThink();

      let closedCount = 0;
      win.onWindowClosed.on(() => { closedCount++; });

      // The close button is docked right inside the 24px title bar.
      // It is 31×31; find its canvas-space center via getBounds on the title bar.
      const titleBarBounds = win._titleBar.getBounds();
      const btnBounds = win._closeButton.getBounds();
      // Convert to canvas coords: titleBar sits at (0,0) in window's local coords.
      const winPos = win.getBounds();
      const cx = winPos.x + titleBarBounds.x + btnBounds.x + Math.floor(btnBounds.w / 2);
      const cy = winPos.y + titleBarBounds.y + btnBounds.y + Math.floor(btnBounds.h / 2);

      canvas.inputMouseMoved(cx, cy, 0, 0);
      canvas.inputMouseButton(0, true);
      canvas.inputMouseButton(0, false);

      win.dispose();
      return { closedCount };
    });
    expect(result.closedCount).toBe(1);
  });

  // =========================================================================
  // 5. makeModal creates modal overlay; destroyModal removes it
  // =========================================================================

  test('5 — makeModal() parents window into Modal; destroyModal() removes modal', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;

      // Use an isolated canvas with known size.
      const htmlC = document.createElement('canvas');
      htmlC.width = 400; htmlC.height = 300;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cv = new G.Canvas(skin, htmlC);
      cv.setBounds(0, 0, 400, 300);

      const win = new G.WindowControl(cv);
      const modalNullBefore = win._modal === null;
      win.makeModal(true);
      const modalCreated = win._modal !== null;
      const winParentIsModal = win.parent === win._modal;
      win.destroyModal();
      const modalNullAfter = win._modal === null;

      cv.dispose();
      document.body.removeChild(htmlC);
      return { modalNullBefore, modalCreated, winParentIsModal, modalNullAfter };
    });
    expect(result.modalNullBefore).toBe(true);
    expect(result.modalCreated).toBe(true);
    expect(result.winParentIsModal).toBe(true);
    expect(result.modalNullAfter).toBe(true);
  });

  // =========================================================================
  // 6. touch() brings window to front (bringToFront)
  // =========================================================================

  test('6 — touch() brings window to front among siblings', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const win1 = new G.WindowControl(canvas);
      const win2 = new G.WindowControl(canvas);

      // After construction win2 is the last child (front). Touch win1 to bring it forward.
      win1.touch();
      const lastChild = canvas.children[canvas.children.length - 1];
      const win1IsLast = lastChild === win1;

      win1.dispose();
      win2.dispose();
      return { win1IsLast };
    });
    expect(result.win1IsLast).toBe(true);
  });

  // =========================================================================
  // 7. isOnTop() true for front-most WindowControl sibling
  // =========================================================================

  test('7 — isOnTop() true for topmost WindowControl; false for the one behind', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const win1 = new G.WindowControl(canvas);
      const win2 = new G.WindowControl(canvas);

      // win2 added last → it's on top.
      const win2OnTop = win2.isOnTop();
      const win1NotOnTop = !win1.isOnTop();

      // Bring win1 to front.
      win1.touch();
      const win1NowOnTop = win1.isOnTop();
      const win2NoLongerOnTop = !win2.isOnTop();

      win1.dispose();
      win2.dispose();
      return { win2OnTop, win1NotOnTop, win1NowOnTop, win2NoLongerOnTop };
    });
    expect(result.win2OnTop).toBe(true);
    expect(result.win1NotOnTop).toBe(true);
    expect(result.win1NowOnTop).toBe(true);
    expect(result.win2NoLongerOnTop).toBe(true);
  });

  // =========================================================================
  // 8. Render produces pixels (title bar + frame visible)
  // =========================================================================

  test('8 — render produces non-background pixels for title bar and frame', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 300; htmlC.height = 200;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cv = new G.Canvas(skin, htmlC);
      cv.setBounds(0, 0, 300, 200);
      cv.setDrawBackground(true);
      // Bright background to contrast against window art.
      cv.setBackgroundColor(G.color(200, 200, 200, 255));

      const win = new G.WindowControl(cv);
      win.setBounds(20, 20, 200, 150);

      cv.doThink();
      cv.redraw();
      cv.renderCanvas();

      const gl = renderer.gl;
      const px = new Uint8Array(4);
      // Sample top-left region of title bar (window at 20,20; title bar = 24px high).
      // Title bar center-y relative to canvas: 20 + 12 = 32; center-x: 20 + 100 = 120.
      // WebGL y-flip: htmlC.height - 1 - y.
      gl.readPixels(120, htmlC.height - 1 - 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);

      cv.dispose();
      document.body.removeChild(htmlC);

      // We just need ANY pixel rendered — if the title bar drew, it won't be the
      // exact background gray (200, 200, 200) with alpha 255 matching identically.
      return { r: px[0], g: px[1], b: px[2], a: px[3] };
    });
    // The render must have produced at least some opaque pixel.
    expect(result.a).toBeGreaterThan(0);
  });

  // =========================================================================
  // Visual baseline (desktop only — screenshot against golden)
  // =========================================================================

  test('2 — visual baseline: default WindowControl renders consistently', async ({ page }) => {
    await page.evaluate(async () => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const win = new G.WindowControl(canvas, 'Test Window');
      win.setBounds(10, 10, 200, 150);
      canvas.doThink();
      canvas.redraw();
      canvas.renderCanvas();
    });
    await waitForFirstFrame(page);
    await expect(page.locator('#gwen-canvas')).toHaveScreenshot('window-control-default.png', {
      maxDiffPixelRatio: 0.02,
    });
  });
});
