// T204 — ComboBox
//
// Categories covered:
//   1  Render          — #10 render produces non-background pixels
//   2  Visual baseline — Skipped: GPU/skin variance makes stable goldens impractical
//   3  State visuals   — #7 openList shows menu; #8 closeList hides menu
//   4  Pointer input   — N/A: click path routes through Button.onMouseClickLeft;
//                        toggle open/close is indirectly tested via #7/#8 API calls
//   5  Touch input     — N/A: same code path as pointer
//   6  Keyboard        — #9 Arrow down/up cycle selection
//   7  Events          — #6 selectItem fires onSelection with correct payload
//   8  Resize          — N/A: ComboBox is a fixed-size Button; no resize behavior

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T204 ComboBox', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction: 100×20; tabable; keyboard input enabled
  // =========================================================================

  test('1 — new ComboBox: 100×20; tabable; keyboard input enabled', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const cb = new G.ComboBox(canvas);
        const b = cb.getBounds();
        const tabable = cb.isTabable();
        const keyboard = cb.getKeyboardInputEnabled();
        cb.dispose();
        return { threw: false, w: b.w, h: b.h, tabable, keyboard };
      } catch {
        return { threw: true, w: 0, h: 0, tabable: false, keyboard: false };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.w).toBe(100);
    expect(result.h).toBe(20);
    expect(result.tabable).toBe(true);
    expect(result.keyboard).toBe(true);
  });

  // =========================================================================
  // 2. addItem('A') — first item becomes selected; getText() === 'A'
  // =========================================================================

  test('2 — addItem("A"): first item auto-selected; getText() === "A"', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cb = new G.ComboBox(canvas);
      const itemA = cb.addItem('A');
      const selected = cb.getSelectedItem();
      const text = cb.getText();
      const isItemA = selected === itemA;
      cb.dispose();
      return { text, isItemA };
    });
    expect(result.text).toBe('A');
    expect(result.isItemA).toBe(true);
  });

  // =========================================================================
  // 3. addItem('B') + addItem('C') — total 3 items; selected still 'A'
  // =========================================================================

  test('3 — addItem("B") + addItem("C"): 3 items total; selected still "A"', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cb = new G.ComboBox(canvas);
      cb.addItem('A');
      cb.addItem('B');
      cb.addItem('C');
      const text = cb.getText();
      const menu = (cb as any)._menu;
      const inner = menu.getInnerPanel();
      const childCount = inner ? inner.numChildren() : -1;
      cb.dispose();
      return { text, childCount };
    });
    expect(result.text).toBe('A');
    expect(result.childCount).toBe(3);
  });

  // =========================================================================
  // 4. getSelectedItem() returns the MenuItem with text 'A'
  // =========================================================================

  test('4 — getSelectedItem() returns MenuItem with text "A"', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cb = new G.ComboBox(canvas);
      cb.addItem('A');
      cb.addItem('B');
      const sel = cb.getSelectedItem();
      const isMenuItem = sel instanceof G.MenuItem;
      const text = sel ? sel.getText() : '';
      cb.dispose();
      return { isMenuItem, text };
    });
    expect(result.isMenuItem).toBe(true);
    expect(result.text).toBe('A');
  });

  // =========================================================================
  // 5. selectItemByName('nameB') — selects by name
  // =========================================================================

  test('5 — selectItemByName("nameB") selects item with name "nameB"', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cb = new G.ComboBox(canvas);
      cb.addItem('A', 'nameA');
      cb.addItem('B', 'nameB');
      cb.addItem('C', 'nameC');
      // selectItemByName fires events; suppress for isolation.
      cb.selectItemByName('nameB', false);
      const text = cb.getText();
      const sel = cb.getSelectedItem();
      const selName = sel ? sel.getName() : '';
      cb.dispose();
      return { text, selName };
    });
    expect(result.text).toBe('B');
    expect(result.selName).toBe('nameB');
  });

  // =========================================================================
  // 6. selectItem(item) fires onSelection with correct payload
  // =========================================================================

  test('6 — selectItem(item) fires onSelection; controlCaller = combo; control = item', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cb = new G.ComboBox(canvas);
      cb.addItem('A');
      const itemB = cb.addItem('B');

      let firedCount = 0;
      let callerOk = false;
      let controlOk = false;
      cb.onSelection.on((ev: any) => {
        firedCount++;
        callerOk = ev.controlCaller === cb;
        controlOk = ev.control === itemB;
      });

      cb.selectItem(itemB, true);
      const text = cb.getText();
      cb.dispose();
      return { firedCount, callerOk, controlOk, text };
    });
    expect(result.firedCount).toBe(1);
    expect(result.callerOk).toBe(true);
    expect(result.controlOk).toBe(true);
    expect(result.text).toBe('B');
  });

  // =========================================================================
  // 7. openList() shows the menu
  // =========================================================================

  test('7 — openList() makes isMenuOpen() === true', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cb = new G.ComboBox(canvas);
      cb.setBounds(10, 10, 100, 20);
      cb.addItem('A');

      const beforeOpen = cb.isMenuOpen();
      cb.openList();
      const afterOpen = cb.isMenuOpen();
      cb.dispose();
      return { beforeOpen, afterOpen };
    });
    expect(result.beforeOpen).toBe(false);
    expect(result.afterOpen).toBe(true);
  });

  // =========================================================================
  // 8. closeList() hides the menu
  // =========================================================================

  test('8 — closeList() makes isMenuOpen() === false', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cb = new G.ComboBox(canvas);
      cb.setBounds(10, 10, 100, 20);
      cb.addItem('A');

      cb.openList();
      const afterOpen = cb.isMenuOpen();
      cb.closeList();
      const afterClose = cb.isMenuOpen();
      cb.dispose();
      return { afterOpen, afterClose };
    });
    expect(result.afterOpen).toBe(true);
    expect(result.afterClose).toBe(false);
  });

  // =========================================================================
  // 9. Arrow down selects next; Arrow up selects previous
  // =========================================================================

  test('9 — onKeyDown selects next item; onKeyUp selects previous item', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cb = new G.ComboBox(canvas);
      cb.addItem('A');
      cb.addItem('B');
      cb.addItem('C');
      // Initially selected: A (index 0)

      // Arrow down: should move to B (index 1).
      cb.onKeyDown(true);
      const afterDown = cb.getText();

      // Arrow down again: should move to C (index 2).
      cb.onKeyDown(true);
      const afterDownAgain = cb.getText();

      // Arrow up: should move back to B (index 1).
      cb.onKeyUp(true);
      const afterUp = cb.getText();

      cb.dispose();
      return { afterDown, afterDownAgain, afterUp };
    });
    expect(result.afterDown).toBe('B');
    expect(result.afterDownAgain).toBe('C');
    expect(result.afterUp).toBe('B');
  });

  // =========================================================================
  // 10. Render produces non-background pixels
  // =========================================================================

  test('10 — ComboBox render produces non-background pixels', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 200; htmlC.height = 60;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cvs = new G.Canvas(skin, htmlC);
      cvs.setBounds(0, 0, 200, 60);
      cvs.setDrawBackground(true);
      cvs.setBackgroundColor(G.color(0, 0, 0, 255));

      const cb = new G.ComboBox(cvs);
      cb.setBounds(10, 20, 100, 20);
      cb.addItem('Alpha');
      cb.addItem('Beta');

      cvs.doThink();
      cvs.redraw();
      cvs.renderCanvas();

      const gl: WebGL2RenderingContext = renderer.gl;
      const pixels = new Uint8Array(200 * 60 * 4);
      gl.readPixels(0, 0, 200, 60, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

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
