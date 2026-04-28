// T203 — MenuStrip
//
// Categories covered:
//   1  Render          — #6 render produces non-background pixels
//   2  Visual baseline — Skipped: GPU/skin variance makes stable goldens impractical
//   3  State visuals   — #3 close() is a no-op (strip stays visible); #5 height fixed after layout
//   4  Pointer input   — N/A: MenuStrip itself is an always-visible container; item clicks covered by MenuItem
//   5  Touch input     — N/A: same code path as pointer
//   6  Keyboard        — N/A: MenuStrip inherits Menu's keyboardInputEnabled=false
//   7  Events          — N/A: strip has no own signals; item signals covered by MenuItem tests
//   8  Resize          — #5 layout() override suppresses auto-shrink so height stays 22

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T203 MenuStrip', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction: 200×22; docked Top; icon margin disabled
  // =========================================================================

  test('1 — new MenuStrip: 200×22; docked Top; icon margin disabled; visible', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const strip = new G.MenuStrip(canvas);
        const b = strip.getBounds();
        const dock = strip.getDock();
        const iconMarginDisabled = strip.isIconMarginDisabled();
        const visible = !strip.hidden();
        strip.dispose();
        return { threw: false, w: b.w, h: b.h, dock, topFlag: G.Pos.Top, iconMarginDisabled, visible };
      } catch {
        return { threw: true, w: 0, h: 0, dock: 0, topFlag: 0, iconMarginDisabled: false, visible: false };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.w).toBe(200);
    expect(result.h).toBe(22);
    expect(result.dock).toBe(result.topFlag);
    expect(result.iconMarginDisabled).toBe(true);
    expect(result.visible).toBe(true);
  });

  // =========================================================================
  // 2. addItem('File') returns MenuItem docked Left with isOnStrip() === true
  // =========================================================================

  test('2 — addItem("File") returns MenuItem; docked Left; isOnStrip() true', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const strip = new G.MenuStrip(canvas);
      const item = strip.addItem('File');
      const isMenuItem = item instanceof G.MenuItem;
      const dock = item.getDock();
      const onStrip = item.isOnStrip();
      const text = item.getText();
      strip.dispose();
      return { isMenuItem, dock, leftFlag: G.Pos.Left, onStrip, text };
    });
    expect(result.isMenuItem).toBe(true);
    expect(result.dock).toBe(result.leftFlag);
    expect(result.onStrip).toBe(true);
    expect(result.text).toBe('File');
  });

  // =========================================================================
  // 3. close() is a no-op — strip stays visible
  // =========================================================================

  test('3 — close() does not hide the strip', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const strip = new G.MenuStrip(canvas);
      const visibleBefore = !strip.hidden();
      strip.close();
      const visibleAfter = !strip.hidden();
      strip.dispose();
      return { visibleBefore, visibleAfter };
    });
    expect(result.visibleBefore).toBe(true);
    expect(result.visibleAfter).toBe(true);
  });

  // =========================================================================
  // 4. addItem('Edit') — second item added; inner panel has two children
  // =========================================================================

  test('4 — addItem("Edit") adds second item; inner panel has two children', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const strip = new G.MenuStrip(canvas);
      strip.addItem('File');
      strip.addItem('Edit');
      const inner = strip.getInnerPanel();
      const childCount = inner ? inner.numChildren() : -1;
      strip.dispose();
      return { childCount };
    });
    expect(result.childCount).toBe(2);
  });

  // =========================================================================
  // 5. layout() is a no-op — height remains 22 after doThink
  // =========================================================================

  test('5 — layout() suppresses auto-shrink; height stays 22 after doThink', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const strip = new G.MenuStrip(canvas);
      strip.addItem('File');
      strip.addItem('Edit');
      canvas.doThink();
      const h = strip.height();
      strip.dispose();
      return h;
    });
    expect(result).toBe(22);
  });

  // =========================================================================
  // 6. Render produces non-background pixels
  // =========================================================================

  test('6 — MenuStrip render produces non-background pixels', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 400; htmlC.height = 60;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cvs = new G.Canvas(skin, htmlC);
      cvs.setBounds(0, 0, 400, 60);
      cvs.setDrawBackground(true);
      cvs.setBackgroundColor(G.color(0, 0, 0, 255));

      const strip = new G.MenuStrip(cvs);
      strip.addItem('File');
      strip.addItem('Edit');

      cvs.doThink();
      cvs.redraw();
      cvs.renderCanvas();

      const gl: WebGL2RenderingContext = renderer.gl;
      const pixels = new Uint8Array(400 * 60 * 4);
      gl.readPixels(0, 0, 400, 60, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      cvs.dispose();
      document.body.removeChild(htmlC);

      let hasContent = false;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] > 10 || pixels[i + 1] > 10 || pixels[i + 2] > 10) {
          hasContent = true;
          break;
        }
      }
      return hasContent;
    });
    expect(result).toBe(true);
  });
});
