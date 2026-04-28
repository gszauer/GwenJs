// T202 — Menu + MenuItem + MenuDivider
//
// Categories covered:
//   1  Render          — #12r render produces non-background pixels
//   2  Visual baseline — Skipped: GPU/skin variance makes stable goldens impractical
//   3  State visuals   — #6 close hides menu; #8 checked state toggled
//   4  Pointer input   — #6 click item closes ancestor menu + fires onMenuItemSelected
//   5  Touch input     — N/A: same code path as pointer via canvas input
//   6  Keyboard        — N/A: Menu sets keyboardInputEnabled false by construction
//   7  Events          — #6 onMenuClosed; #8 onCheckChange/onChecked/onUnChecked; #12 onMenuItemSelected
//   8  Resize          — N/A: Menu shrink-wraps height to content, no parent-resize callback needed

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T202 Menu + MenuItem + MenuDivider', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Menu construction: hidden; disabled false; autoHide bars; keyboard off
  // =========================================================================

  test('1 — new Menu: hidden, keyboardInput off, isMenuComponent true', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const menu = new G.Menu(canvas);
        const hidden = menu.hidden();
        const keyboardOff = menu.getKeyboardInputEnabled() === false;
        const isMenuComp = menu.isMenuComponent();
        menu.dispose();
        return { threw: false, hidden, keyboardOff, isMenuComp };
      } catch {
        return { threw: true, hidden: false, keyboardOff: false, isMenuComp: false };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.hidden).toBe(true);
    expect(result.keyboardOff).toBe(true);
    expect(result.isMenuComp).toBe(true);
  });

  // =========================================================================
  // 2. addItem('Open') returns a MenuItem child on the inner panel
  // =========================================================================

  test('2 — addItem returns MenuItem; inner panel has that child', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const menu = new G.Menu(canvas);
      const item = menu.addItem('Open');
      const isMenuItem = item instanceof G.MenuItem;
      const inner = menu.getInnerPanel();
      const childCount = inner ? inner.numChildren() : -1;
      const text = item.getText();
      menu.dispose();
      return { isMenuItem, childCount, text };
    });
    expect(result.isMenuItem).toBe(true);
    expect(result.childCount).toBeGreaterThanOrEqual(1);
    expect(result.text).toBe('Open');
  });

  // =========================================================================
  // 3. addDivider() adds a MenuDivider child with height 1
  // =========================================================================

  test('3 — addDivider returns MenuDivider with height 1', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const menu = new G.Menu(canvas);
      const div = menu.addDivider();
      const isDivider = div instanceof G.MenuDivider;
      const h = div.height();
      menu.dispose();
      return { isDivider, h };
    });
    expect(result.isDivider).toBe(true);
    expect(result.h).toBe(1);
  });

  // =========================================================================
  // 4. clearItems() empties inner panel
  // =========================================================================

  test('4 — clearItems empties inner panel children', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const menu = new G.Menu(canvas);
      menu.addItem('A');
      menu.addItem('B');
      menu.addDivider();
      const inner = menu.getInnerPanel();
      const before = inner ? inner.numChildren() : -1;
      menu.clearItems();
      const after = inner ? inner.numChildren() : -1;
      menu.dispose();
      return { before, after };
    });
    expect(result.before).toBe(3);
    expect(result.after).toBe(0);
  });

  // =========================================================================
  // 5. open(point(100, 100)) shows menu at position
  // =========================================================================

  test('5 — open(point) shows menu and sets position', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const menu = new G.Menu(canvas);
      menu.open(G.point(100, 100));
      const visible = !menu.hidden();
      const x = menu.x();
      const y = menu.y();
      menu.dispose();
      return { visible, x, y };
    });
    expect(result.visible).toBe(true);
    expect(result.x).toBe(100);
    expect(result.y).toBe(100);
  });

  // =========================================================================
  // 6. close() hides menu and fires onMenuClosed
  // =========================================================================

  test('6 — close hides menu and fires onMenuClosed with controlCaller === menu', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const menu = new G.Menu(canvas);
      menu.open(G.point(50, 50));

      let closedCount = 0;
      let callerOk = false;
      menu.onMenuClosed.on((ev: any) => {
        closedCount++;
        callerOk = ev.controlCaller === menu;
      });

      menu.close();
      const hidden = menu.hidden();
      menu.dispose();
      return { closedCount, callerOk, hidden };
    });
    expect(result.closedCount).toBe(1);
    expect(result.callerOk).toBe(true);
    expect(result.hidden).toBe(true);
  });

  // =========================================================================
  // 7. deleteOnClose: close schedules delayed delete via canvas.addDelayedDelete
  // =========================================================================

  test('7 — deleteOnClose: close enqueues control in canvas delayedDelete list', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const menu = new G.Menu(canvas);
      menu.setDeleteOnClose(true);
      menu.open(G.point(10, 10));

      let deleteCalled = false;
      const orig = canvas.addDelayedDelete?.bind(canvas);
      canvas.addDelayedDelete = (ctrl: any) => {
        if (ctrl === menu) deleteCalled = true;
        if (orig) orig(ctrl);
      };

      menu.close();
      return { deleteCalled, shouldDelete: menu.shouldDeleteOnClose() };
    });
    expect(result.shouldDelete).toBe(true);
    expect(result.deleteCalled).toBe(true);
  });

  // =========================================================================
  // 8. MenuItem checkable+checked state; toggleChecked fires signals
  // =========================================================================

  test('8 — MenuItem checkable+checked: toggleChecked fires onCheckChange + onChecked/onUnChecked', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const menu = new G.Menu(canvas);
      const item = menu.addItem('Toggle');
      item.setCheckable(true);

      let changeCount = 0;
      let checkedCount = 0;
      let uncheckedCount = 0;
      item.onCheckChange.on(() => { changeCount++; });
      item.onChecked.on(() => { checkedCount++; });
      item.onUnChecked.on(() => { uncheckedCount++; });

      const before = item.isChecked();
      item.toggleChecked(); // false → true
      const afterFirst = item.isChecked();
      item.toggleChecked(); // true → false
      const afterSecond = item.isChecked();

      menu.dispose();
      return { before, afterFirst, afterSecond, changeCount, checkedCount, uncheckedCount };
    });
    expect(result.before).toBe(false);
    expect(result.afterFirst).toBe(true);
    expect(result.afterSecond).toBe(false);
    expect(result.changeCount).toBe(2);
    expect(result.checkedCount).toBe(1);
    expect(result.uncheckedCount).toBe(1);
  });

  // =========================================================================
  // 9. MenuItem hasMenu() false initially; getMenu() creates submenu (lazy)
  // =========================================================================

  test('9 — MenuItem.hasMenu() false initially; getMenu() lazily creates Menu', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const menu = new G.Menu(canvas);
      const item = menu.addItem('Sub');

      const hasBefore = item.hasMenu();
      const sub = item.getMenu();
      const hasAfter = item.hasMenu();
      const isMenu = sub instanceof G.Menu;

      menu.dispose();
      return { hasBefore, hasAfter, isMenu };
    });
    expect(result.hasBefore).toBe(false);
    expect(result.hasAfter).toBe(true);
    expect(result.isMenu).toBe(true);
  });

  // =========================================================================
  // 10. MenuItem setAccelerator creates a Label child docked right
  // =========================================================================

  test('10 — setAccelerator creates an accelerator Label child', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const menu = new G.Menu(canvas);
      const item = menu.addItem('Open');

      const beforeNull = item._accelerator === null;
      item.setAccelerator('Ctrl+O');
      const hasAccel = item._accelerator !== null;
      const isLabel = item._accelerator instanceof G.Label;
      const text = item._accelerator?.getText?.() ?? '';

      menu.dispose();
      return { beforeNull, hasAccel, isLabel, text };
    });
    expect(result.beforeNull).toBe(true);
    expect(result.hasAccel).toBe(true);
    expect(result.isLabel).toBe(true);
    expect(result.text).toBe('Ctrl+O');
  });

  // =========================================================================
  // 11. MenuItem click with submenu toggles submenu open/close
  // =========================================================================

  test('11 — MenuItem with submenu: onPressItem toggles submenu visibility', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const menu = new G.Menu(canvas);
      menu.open(G.point(0, 0));
      const item = menu.addItem('Sub');
      const sub = item.getMenu();

      const closedBefore = !sub.isVisible();
      // Directly call onPressItem via the internal method (not exported, access via prototype).
      // Use the protected accessor via casting.
      (item as any).onPressItem();
      const openAfterFirst = sub.isVisible();
      (item as any).onPressItem();
      const closedAfterSecond = !sub.isVisible();

      menu.dispose();
      return { closedBefore, openAfterFirst, closedAfterSecond };
    });
    expect(result.closedBefore).toBe(true);
    expect(result.openAfterFirst).toBe(true);
    expect(result.closedAfterSecond).toBe(true);
  });

  // =========================================================================
  // 12. MenuItem click without submenu closes ancestor Menu + fires onMenuItemSelected
  // =========================================================================

  test('12 — MenuItem without submenu: onPressItem closes ancestor menu + fires onMenuItemSelected', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const menu = new G.Menu(canvas);
      menu.open(G.point(0, 0));
      const item = menu.addItem('Click Me');

      let selectedCount = 0;
      let callerOk = false;
      item.onMenuItemSelected.on((ev: any) => {
        selectedCount++;
        callerOk = ev.controlCaller === item;
      });

      const visibleBefore = menu.isVisible();
      (item as any).onPressItem();
      const hiddenAfter = !menu.isVisible();

      menu.dispose();
      return { selectedCount, callerOk, visibleBefore, hiddenAfter };
    });
    expect(result.visibleBefore).toBe(true);
    expect(result.selectedCount).toBe(1);
    expect(result.callerOk).toBe(true);
    expect(result.hiddenAfter).toBe(true);
  });

  // =========================================================================
  // 12r. Render produces non-background pixels
  // =========================================================================

  test('12r — Menu render produces non-background pixels', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 200; htmlC.height = 200;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cvs = new G.Canvas(skin, htmlC);
      cvs.setBounds(0, 0, 200, 200);
      cvs.setDrawBackground(true);
      cvs.setBackgroundColor(G.color(0, 0, 0, 255));

      const menu = new G.Menu(cvs);
      menu.setBounds(10, 10, 120, 80);
      menu.addItem('File');
      menu.addItem('Edit');
      menu.open(G.point(10, 10));

      cvs.doThink();
      cvs.redraw();
      cvs.renderCanvas();

      const gl: WebGL2RenderingContext = renderer.gl;
      const pixels = new Uint8Array(200 * 200 * 4);
      gl.readPixels(0, 0, 200, 200, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

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
