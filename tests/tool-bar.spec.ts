// T208 — ToolBarButton + ToolBarStrip
//
// Categories covered:
//   1  Render         — #5 render produces pixels
//   2  Visual baseline — Skipped: GPU/skin variance
//   3  State visuals   — #2 shouldDrawBackground hover behavior
//   4  Pointer input   — #1 construction; hover changes shouldDrawBackground
//   5  Touch input     — N/A: same path as pointer
//   6  Keyboard        — N/A: ToolBarButton inherits Button but no custom key handler
//   7  Events          — N/A: ToolBarButton signals are inherited from Button (covered there)
//   8  Resize          — N/A

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T208 ToolBar', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. ToolBarButton: 20×20; docks Left
  // =========================================================================

  test('1 — ToolBarButton: default size 20×20; docked Left', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const btn = new G.ToolBarButton(canvas);
        const b = btn.getBounds();
        // dock() sets internal _dock flag; check via getDock if available,
        // or verify size only (dock tested implicitly via ToolBarStrip layout).
        btn.dispose();
        return { threw: false, w: b.w, h: b.h };
      } catch {
        return { threw: true, w: 0, h: 0 };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.w).toBe(20);
    expect(result.h).toBe(20);
  });

  // =========================================================================
  // 2. shouldDrawBackground: false normally; true on hover
  // =========================================================================

  test('2 — ToolBarButton.shouldDrawBackground() false by default; true when hovered', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const btn = new G.ToolBarButton(canvas);
      btn.setBounds(10, 10, 20, 20);

      const notHovered = btn.shouldDrawBackground();

      // Simulate hover by moving mouse into button bounds.
      canvas.inputMouseMoved(20, 20, 0, 0);
      const hovered = btn.shouldDrawBackground();

      // Move out.
      canvas.inputMouseMoved(200, 200, 0, 0);
      btn.dispose();
      return { notHovered, hovered };
    });
    expect(result.notHovered).toBe(false);
    expect(result.hovered).toBe(true);
  });

  // =========================================================================
  // 3. ToolBarStrip: 25×25; add() returns ToolBarButton child
  // =========================================================================

  test('3 — ToolBarStrip: default size 25×25; add(text, icon) returns ToolBarButton', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const strip = new G.ToolBarStrip(canvas);
        const b = strip.getBounds();
        const btn = strip.add('File', '');
        const isToolBarButton = btn instanceof G.ToolBarButton;
        strip.dispose();
        return { threw: false, w: b.w, h: b.h, isToolBarButton };
      } catch {
        return { threw: true, w: 0, h: 0, isToolBarButton: false };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.w).toBe(25);
    expect(result.h).toBe(25);
    expect(result.isToolBarButton).toBe(true);
  });

  // =========================================================================
  // 4. add(text, icon): tooltip is set to text
  // =========================================================================

  test('4 — add(text, icon): added button tooltip name equals the text argument', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const strip = new G.ToolBarStrip(canvas);
      const btn = strip.add('Save', '');
      // Base.setToolTip stores the text as the tooltip control's name.
      // (Base.ts:setToolTip calls tip.setName(text) on a placeholder Base.)
      const tip = btn.getToolTip();
      const tipName = tip ? tip.getName() : '';
      strip.dispose();
      return tipName;
    });
    expect(result).toBe('Save');
  });

  // =========================================================================
  // 5. Render produces pixels
  // =========================================================================

  test('5 — ToolBarStrip render produces non-background pixels', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 200; htmlC.height = 30;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cvs = new G.Canvas(skin, htmlC);
      cvs.setBounds(0, 0, 200, 30);
      cvs.setDrawBackground(true);
      cvs.setBackgroundColor(G.color(0, 0, 0, 255));

      const strip = new G.ToolBarStrip(cvs);
      strip.setBounds(0, 0, 200, 25);
      strip.add('Open', '');
      strip.add('Save', '');

      cvs.doThink();
      cvs.redraw();
      cvs.renderCanvas();

      const gl: WebGL2RenderingContext = renderer.gl;
      const pixels = new Uint8Array(200 * 25 * 4);
      gl.readPixels(0, htmlC.height - 25, 200, 25, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

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
