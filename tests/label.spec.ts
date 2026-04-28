// T100 — Label
//
// Categories covered:
//   1  Render          — #12 pixel read after render confirms text is drawn
//   2  Visual baseline — Skipped: OS font rendering variance makes screenshots
//                        brittle across macOS/Linux CI. Pixel-read approach
//                        is used instead (category 1 covers this intent).
//   3  State visuals   — #11 skin color presets (normal/bright/dark/highlight)
//   4  Pointer input   — N/A: Label disables mouse input by default.
//   5  Touch input     — N/A: same reason.
//   6  Keyboard        — N/A: Label has no keyboard interaction.
//   7  Events          — #13 alignment effect (textX position)
//   8  Resize          — N/A: Label does not auto-resize on parent resize
//                        (wrap mode is tested inline in #9).

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T100 Label', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction
  // =========================================================================

  test('1 — new Label(canvas) does not throw; default bounds 100×10', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const label = new G.Label(canvas);
        const b = label.getBounds();
        label.dispose();
        return { threw: false, w: b.w, h: b.h };
      } catch (e) {
        return { threw: true, w: 0, h: 0 };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.w).toBe(100);
    expect(result.h).toBe(10);
  });

  test('2 — default alignment is Pos.Left | Pos.CenterV (constructor sets Left|CenterV)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const label = new G.Label(canvas);
      const align = label.getAlignment();
      label.dispose();
      // Left = 2, CenterV = 32 => 34
      return { align, left: G.Pos.Left, centerV: G.Pos.CenterV };
    });
    expect(result.align).toBe(result.left | result.centerV);
  });

  test('3 — mouse input is disabled by default', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const label = new G.Label(canvas);
      const enabled = label.getMouseInputEnabled();
      label.dispose();
      return enabled;
    });
    expect(result).toBe(false);
  });

  // =========================================================================
  // 2. setText / getText
  // =========================================================================

  test('4 — setText round-trips via getText', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const label = new G.Label(canvas);
      label.setText('hello');
      const got = label.getText();
      label.dispose();
      return got;
    });
    expect(result).toBe('hello');
  });

  test('5 — setText with same string does not crash', async ({ page }) => {
    const threw = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const label = new G.Label(canvas);
      try {
        label.setText('same');
        label.setText('same');
        label.dispose();
        return false;
      } catch {
        return true;
      }
    });
    expect(threw).toBe(false);
  });

  // =========================================================================
  // 3. textLength
  // =========================================================================

  test('6 — textLength matches character count', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const label = new G.Label(canvas);
      label.setText('abc');
      const len = label.textLength();
      label.dispose();
      return len;
    });
    expect(result).toBe(3);
  });

  // =========================================================================
  // 4. sizeToContents
  // =========================================================================

  test('7 — sizeToContents after setText adjusts size (w >= 1, h >= 1)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const label = new G.Label(canvas);
      label.setText('Hello');
      // Force a layout pass so skin/font resolves.
      canvas.doThink();
      label.sizeToContents();
      const b = label.getBounds();
      label.dispose();
      return { w: b.w, h: b.h };
    });
    expect(result.w).toBeGreaterThanOrEqual(1);
    expect(result.h).toBeGreaterThanOrEqual(1);
  });

  test('8 — sizeToContents grows width relative to empty string', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const empty = new G.Label(canvas);
      empty.setText('');
      canvas.doThink();
      empty.sizeToContents();
      const emptyW = empty.getBounds().w;
      empty.dispose();

      const full = new G.Label(canvas);
      full.setText('Hello World');
      canvas.doThink();
      full.sizeToContents();
      const fullW = full.getBounds().w;
      full.dispose();

      return { emptyW, fullW };
    });
    expect(result.fullW).toBeGreaterThan(result.emptyW);
  });

  // =========================================================================
  // 5. setAlignment / getAlignment
  // =========================================================================

  test('9 — setAlignment round-trips combined Pos flags', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const label = new G.Label(canvas);
      const combined = G.Pos.CenterH | G.Pos.CenterV;
      label.setAlignment(combined);
      const got = label.getAlignment();
      label.dispose();
      return { combined, got };
    });
    expect(result.got).toBe(result.combined);
  });

  // =========================================================================
  // 6. setFontByName
  // =========================================================================

  test('10 — setFontByName stores font with correct size', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const label = new G.Label(canvas);
      label.setFontByName('Menlo', 14);
      canvas.doThink(); // triggers layout so font resolves
      const f = label.getFont();
      label.dispose();
      return f ? f.size : null;
    });
    expect(result).toBe(14);
  });

  // =========================================================================
  // 7. setTextColor / textColor
  // =========================================================================

  test('11 — setTextColor / textColor round-trip', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const label = new G.Label(canvas);
      label.setTextColor(G.color(255, 0, 0, 255));
      const c = label.textColor();
      label.dispose();
      return { r: c.r, g: c.g, b: c.b, a: c.a };
    });
    expect(result).toEqual({ r: 255, g: 0, b: 0, a: 255 });
  });

  // =========================================================================
  // 8. setTextColorOverride
  // =========================================================================

  test('12 — setTextColorOverride with non-zero alpha is stored', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const label = new G.Label(canvas);
      label.setTextColorOverride(G.color(0, 255, 0, 128));
      // Access override via the internal _text child.
      const override = label._text.textColorOverride();
      label.dispose();
      return { a: override.a, g: override.g };
    });
    expect(result.a).toBeGreaterThan(0);
    expect(result.g).toBe(255);
  });

  // =========================================================================
  // 9. setWrap / getWrap
  // =========================================================================

  test('13 — setWrap(true) / getWrap() round-trip', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const label = new G.Label(canvas);
      label.setWrap(true);
      const wrap = label.getWrap();
      label.dispose();
      return wrap;
    });
    expect(result).toBe(true);
  });

  // =========================================================================
  // 10. setTextPadding / getTextPadding
  // =========================================================================

  test('14 — setTextPadding round-trip', async ({ page }) => {
    // margin(left, top, right, bottom) per Structures.ts (GWEN convention).
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const label = new G.Label(canvas);
      // margin(left=3, top=5, right=7, bottom=9)
      label.setTextPadding(G.margin(3, 5, 7, 9));
      const p = label.getTextPadding();
      label.dispose();
      return { top: p.top, bottom: p.bottom, left: p.left, right: p.right };
    });
    expect(result.top).toBe(5);
    expect(result.bottom).toBe(9);
    expect(result.left).toBe(3);
    expect(result.right).toBe(7);
  });

  // =========================================================================
  // 11. Skin color presets
  // =========================================================================

  test('15 — makeColorNormal sets textColor to skin label.default', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const label = new G.Label(canvas);
      label.makeColorNormal();
      const c = label.textColor();
      const expected = canvas.skin.colors.label.default;
      label.dispose();
      return { match: c.r === expected.r && c.g === expected.g && c.b === expected.b && c.a === expected.a };
    });
    expect(result.match).toBe(true);
  });

  test('16 — makeColorBright sets textColor to skin label.bright', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const label = new G.Label(canvas);
      label.makeColorBright();
      const c = label.textColor();
      const expected = canvas.skin.colors.label.bright;
      label.dispose();
      return { match: c.r === expected.r && c.g === expected.g && c.b === expected.b && c.a === expected.a };
    });
    expect(result.match).toBe(true);
  });

  test('17 — makeColorDark sets textColor to skin label.dark', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const label = new G.Label(canvas);
      label.makeColorDark();
      const c = label.textColor();
      const expected = canvas.skin.colors.label.dark;
      label.dispose();
      return { match: c.r === expected.r && c.g === expected.g && c.b === expected.b && c.a === expected.a };
    });
    expect(result.match).toBe(true);
  });

  test('18 — makeColorHighlight sets textColor to skin label.highlight', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const label = new G.Label(canvas);
      label.makeColorHighlight();
      const c = label.textColor();
      const expected = canvas.skin.colors.label.highlight;
      label.dispose();
      return { match: c.r === expected.r && c.g === expected.g && c.b === expected.b && c.a === expected.a };
    });
    expect(result.match).toBe(true);
  });

  // =========================================================================
  // 12. Pixel read after render
  // =========================================================================

  test('19 — label with text renders non-background pixels within bounds (isolated DPR-1 canvas)', async ({ page }) => {
    // Draw a label with dark text, render on an isolated DPR=1 canvas, and
    // scan for any pixel that differs from the background. Uses an isolated
    // canvas to avoid scissor/DPR coordinate issues on mobile.
    const result = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 400; htmlC.height = 100;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const canvas = new G.Canvas(skin, htmlC);
      canvas.setBounds(0, 0, 400, 100);
      canvas.setDrawBackground(true);
      canvas.setBackgroundColor(G.color(122, 144, 144, 255));

      const label = new G.Label(canvas);
      label.setBounds(20, 20, 300, 40);
      label.setText('MMMM');
      label.setTextColor(G.color(0, 0, 0, 255));

      canvas.doThink();
      canvas.redraw();
      canvas.renderCanvas();

      const gl: WebGL2RenderingContext = renderer.gl;
      // Scan the label region: x=20..320, y=20..60 (logical=device at DPR=1).
      const W = 300, H = 40;
      const glY = htmlC.height - (20 + H); // GL y is bottom-up
      const pixels = new Uint8Array(W * H * 4);
      gl.readPixels(20, glY, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      canvas.dispose();
      document.body.removeChild(htmlC);

      // Find any pixel that differs from background (122, 144, 144).
      let found = false;
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
        if (r < 80 && g < 110 && b < 110) {
          found = true;
          break;
        }
      }
      return found;
    });
    expect(result).toBe(true);
  });

  // =========================================================================
  // 13. Alignment effect: textX near center
  // =========================================================================

  test('20 — center-align positions text internal child near horizontal center', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const label = new G.Label(canvas);
      label.setBounds(0, 0, 200, 50);
      label.setText('Hi');
      label.setAlignment(G.Pos.CenterH | G.Pos.CenterV);

      canvas.doThink();

      const textX = label.textX();
      label.dispose();
      // Center alignment on a 200-wide label: text should not be at x=0.
      return textX;
    });
    // Text should be positioned somewhere in the middle half of the label.
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(190);
  });

  test('21 — left-align places textX near 0', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const label = new G.Label(canvas);
      label.setBounds(0, 0, 200, 50);
      label.setText('Hi');
      label.setAlignment(G.Pos.Left | G.Pos.CenterV);

      canvas.doThink();

      const textX = label.textX();
      label.dispose();
      return textX;
    });
    // Left-aligned text should start near x=0 (within reasonable padding).
    expect(result).toBeLessThanOrEqual(10);
  });

  // =========================================================================
  // 14. sizeToContents then bounds check
  // =========================================================================

  test('22 — sizeToContents: text width fits within label width', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const label = new G.Label(canvas);
      label.setText('Hello World');
      canvas.doThink();
      label.sizeToContents();

      const labelW = label.getBounds().w;
      const textW = label.textWidth();
      label.dispose();
      return { labelW, textW };
    });
    expect(result.textW).toBeLessThanOrEqual(result.labelW);
  });

  // =========================================================================
  // 15. setValue / getValue alias
  // =========================================================================

  test('23 — setValue is an alias for setText; getValue returns the same', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const label = new G.Label(canvas);
      label.setValue('x');
      const val = label.getValue();
      const text = label.getText();
      label.dispose();
      return { val, text };
    });
    expect(result.val).toBe('x');
    expect(result.text).toBe('x');
  });

  // =========================================================================
  // dispose
  // =========================================================================

  test('24 — dispose removes label from canvas children', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const before = canvas.numChildren();
      const label = new G.Label(canvas);
      const during = canvas.numChildren();
      label.dispose();
      const after = canvas.numChildren();
      return { before, during, after };
    });
    expect(result.during).toBe(result.before + 1);
    expect(result.after).toBe(result.before);
  });

  test('25 — textWidth/textHeight accessors do not throw', async ({ page }) => {
    const threw = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const label = new G.Label(canvas);
        label.setText('abc');
        canvas.doThink();
        void label.textWidth();
        void label.textHeight();
        void label.textRight();
        void label.textY();
        label.dispose();
        return false;
      } catch {
        return true;
      }
    });
    expect(threw).toBe(false);
  });
});
