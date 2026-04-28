// T211 — Tab family (TabButton + TabTitleBar + TabStrip + TabControl)
//
// Categories covered:
//   1  Render         — #11 TabButton render; #12 TabTitleBar render (no-throw)
//   2  Visual baseline — Skipped: GPU/skin variance
//   3  State visuals   — #10 TabButton.isActive() reflects page visibility
//   4  Pointer input   — #4 simulated tab button press switches pages
//   5  Touch input     — N/A: same path as pointer via canvas input
//   6  Keyboard        — N/A: TabControl has no custom key handlers
//   7  Events          — #9 onAddTab fires; #7 removePage fires onLoseTab
//   8  Resize          — N/A

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T211 TabControl', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction: empty TabControl; tabCount=0
  // =========================================================================

  test('1 — new TabControl: tabCount=0; no current button', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const tc = new G.TabControl(canvas);
        const count = tc.tabCount();
        const current = tc.getCurrentButton();
        tc.dispose();
        return { threw: false, count, currentNull: current === null };
      } catch {
        return { threw: true, count: -1, currentNull: false };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.count).toBe(0);
    expect(result.currentNull).toBe(true);
  });

  // =========================================================================
  // 2. addPage('Tab 1') — returns TabButton; tabCount=1; page visible
  // =========================================================================

  test('2 — addPage("Tab 1"): returns TabButton; tabCount=1; page shown', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tc = new G.TabControl(canvas);
      tc.setBounds(0, 0, 300, 200);

      const btn = tc.addPage('Tab 1');
      const isTabButton = btn instanceof G.TabButton;
      const count = tc.tabCount();
      const pageVisible = btn.getPage() !== null && !btn.getPage().hidden();

      tc.dispose();
      return { isTabButton, count, pageVisible };
    });
    expect(result.isTabButton).toBe(true);
    expect(result.count).toBe(1);
    expect(result.pageVisible).toBe(true);
  });

  // =========================================================================
  // 3. addPage('Tab 2'): tabCount=2; first page still visible
  // =========================================================================

  test('3 — addPage x2: tabCount=2; first page remains visible (auto-selected)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tc = new G.TabControl(canvas);
      tc.setBounds(0, 0, 300, 200);

      const btn1 = tc.addPage('Tab 1');
      const btn2 = tc.addPage('Tab 2');
      const count = tc.tabCount();
      const page1Visible = !btn1.getPage().hidden();
      const page2Visible = !btn2.getPage().hidden();

      tc.dispose();
      return { count, page1Visible, page2Visible };
    });
    expect(result.count).toBe(2);
    expect(result.page1Visible).toBe(true);
    expect(result.page2Visible).toBe(false);
  });

  // =========================================================================
  // 4. Click Tab 2's button → switches pages
  // =========================================================================

  test('4 — pressing Tab 2 button switches active page', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tc = new G.TabControl(canvas);
      tc.setBounds(0, 0, 300, 200);

      const btn1 = tc.addPage('Tab 1');
      const btn2 = tc.addPage('Tab 2');

      // Simulate pressing Tab 2's button.
      btn2.onPress.emit({ controlCaller: btn2 });

      const page1Hidden = btn1.getPage().hidden();
      const page2Visible = !btn2.getPage().hidden();
      const currentIsBtn2 = tc.getCurrentButton() === btn2;

      tc.dispose();
      return { page1Hidden, page2Visible, currentIsBtn2 };
    });
    expect(result.page1Hidden).toBe(true);
    expect(result.page2Visible).toBe(true);
    expect(result.currentIsBtn2).toBe(true);
  });

  // =========================================================================
  // 5. getCurrentButton returns active button
  // =========================================================================

  test('5 — getCurrentButton() returns the active tab button', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tc = new G.TabControl(canvas);
      tc.setBounds(0, 0, 300, 200);

      const btn1 = tc.addPage('Tab 1');
      const btn2 = tc.addPage('Tab 2');

      btn1.onPress.emit({ controlCaller: btn1 });
      const afterBtn1 = tc.getCurrentButton() === btn1;

      btn2.onPress.emit({ controlCaller: btn2 });
      const afterBtn2 = tc.getCurrentButton() === btn2;

      tc.dispose();
      return { afterBtn1, afterBtn2 };
    });
    expect(result.afterBtn1).toBe(true);
    expect(result.afterBtn2).toBe(true);
  });

  // =========================================================================
  // 6. getTab(i) returns button at index
  // =========================================================================

  test('6 — getTab(i) returns button at index i; null for out-of-range', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tc = new G.TabControl(canvas);
      tc.setBounds(0, 0, 300, 200);

      const btn0 = tc.addPage('A');
      const btn1 = tc.addPage('B');

      const got0 = tc.getTab(0);
      const got1 = tc.getTab(1);
      const got2 = tc.getTab(2);

      tc.dispose();
      return { is0: got0 === btn0, is1: got1 === btn1, is2null: got2 === null };
    });
    expect(result.is0).toBe(true);
    expect(result.is1).toBe(true);
    expect(result.is2null).toBe(true);
  });

  // =========================================================================
  // 7. removePage fires onLoseTab; tabCount decreases
  // =========================================================================

  test('7 — removePage(btn): tabCount decreases; onLoseTab fires', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tc = new G.TabControl(canvas);
      tc.setBounds(0, 0, 300, 200);

      let loseFired = 0;
      tc.onLoseTab.on(() => { loseFired++; });

      const btn1 = tc.addPage('Tab 1');
      tc.addPage('Tab 2');
      const before = tc.tabCount();

      tc.removePage(btn1);
      const after = tc.tabCount();

      tc.dispose();
      return { before, after, loseFired };
    });
    expect(result.before).toBe(2);
    expect(result.after).toBe(1);
    expect(result.loseFired).toBe(1);
  });

  // =========================================================================
  // 8. setTabStripPosition moves strip to a different dock edge
  // =========================================================================

  test('8 — setTabStripPosition(Pos.Bottom) sets strip dock to Bottom', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tc = new G.TabControl(canvas);
      tc.setBounds(0, 0, 300, 200);
      tc.addPage('Tab 1');

      tc.setTabStripPosition(G.Pos.Bottom);

      // Verify the tab button's dock was updated.
      const btn = tc.getTab(0);
      const tabDock = btn ? btn.getTabDock() : -1;
      tc.dispose();
      return { tabDock, expectedBottom: G.Pos.Bottom };
    });
    expect(result.tabDock).toBe(result.expectedBottom);
  });

  // =========================================================================
  // 9. onAddTab fires when page added
  // =========================================================================

  test('9 — onAddTab fires when addPage is called', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tc = new G.TabControl(canvas);
      tc.setBounds(0, 0, 300, 200);

      let addCount = 0;
      tc.onAddTab.on(() => { addCount++; });

      tc.addPage('A');
      tc.addPage('B');

      tc.dispose();
      return addCount;
    });
    expect(result).toBe(2);
  });

  // =========================================================================
  // 10. TabButton.isActive() reflects page visibility
  // =========================================================================

  test('10 — TabButton.isActive() true when page visible; false when hidden', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tc = new G.TabControl(canvas);
      tc.setBounds(0, 0, 300, 200);

      const btn1 = tc.addPage('Tab 1');
      const btn2 = tc.addPage('Tab 2');

      const btn1ActiveInitial = btn1.isActive();
      const btn2ActiveInitial = btn2.isActive();

      btn2.onPress.emit({ controlCaller: btn2 });

      const btn1ActiveAfter = btn1.isActive();
      const btn2ActiveAfter = btn2.isActive();

      tc.dispose();
      return { btn1ActiveInitial, btn2ActiveInitial, btn1ActiveAfter, btn2ActiveAfter };
    });
    expect(result.btn1ActiveInitial).toBe(true);
    expect(result.btn2ActiveInitial).toBe(false);
    expect(result.btn1ActiveAfter).toBe(false);
    expect(result.btn2ActiveAfter).toBe(true);
  });

  // =========================================================================
  // 11. TabButton render does not throw
  // =========================================================================

  test('11 — TabButton render does not throw', async ({ page }) => {
    const threw = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 300; htmlC.height = 200;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cvs = new G.Canvas(skin, htmlC);
      cvs.setBounds(0, 0, 300, 200);

      try {
        const tc = new G.TabControl(cvs);
        tc.setBounds(0, 0, 300, 200);
        tc.addPage('Tab 1');
        tc.addPage('Tab 2');
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
  // 12. TabTitleBar renders without throwing
  // =========================================================================

  test('12 — TabTitleBar render does not throw', async ({ page }) => {
    const threw = await page.evaluate(async () => {
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

      try {
        const bar = new G.TabTitleBar(cvs);
        bar.setBounds(0, 0, 200, 24);
        bar.setText('My Window');
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
});
