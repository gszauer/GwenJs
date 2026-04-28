// T213 — PageControl
//
// Categories covered:
//   1  Render         — no dedicated pixel test (layout-focused control)
//   2  Visual baseline — Skipped: GPU/skin variance
//   3  State visuals   — #5 Back/Next disabled state; #6 Finish shown on last page
//   4  Pointer input   — #4 nextPage / previousPage via button press
//   5  Touch input     — N/A: same path as pointer
//   6  Keyboard        — N/A: PageControl has no custom key handlers
//   7  Events          — #7 onFinish fires; #8 onPageChanged fires with correct index
//   8  Resize          — N/A

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T213 PageControl', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction: Back/Next/Finish/Label controls present
  // =========================================================================

  test('1 — new PageControl: Back, Next, Finish, Label controls exist', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const pc = new G.PageControl(canvas);
        const hasBack = pc.backButton() !== null;
        const hasNext = pc.nextButton() !== null;
        const hasFinish = pc.finishButton() !== null;
        const hasLabel = pc.label() !== null;
        pc.dispose();
        return { threw: false, hasBack, hasNext, hasFinish, hasLabel };
      } catch {
        return { threw: true, hasBack: false, hasNext: false, hasFinish: false, hasLabel: false };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.hasBack).toBe(true);
    expect(result.hasNext).toBe(true);
    expect(result.hasFinish).toBe(true);
    expect(result.hasLabel).toBe(true);
  });

  // =========================================================================
  // 2. setPageCount(3) creates 3 pages; shows page 0
  // =========================================================================

  test('2 — setPageCount(3): creates 3 pages; page 0 visible; others hidden', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const pc = new G.PageControl(canvas);
      pc.setBounds(0, 0, 400, 300);
      pc.setPageCount(3);

      const count = pc.getPageCount();
      const page0 = pc.getPage(0);
      const page1 = pc.getPage(1);
      const page2 = pc.getPage(2);

      const p0Visible = page0 !== null && !page0.hidden();
      const p1Hidden = page1 !== null && page1.hidden();
      const p2Hidden = page2 !== null && page2.hidden();

      pc.dispose();
      return { count, p0Visible, p1Hidden, p2Hidden };
    });
    expect(result.count).toBe(3);
    expect(result.p0Visible).toBe(true);
    expect(result.p1Hidden).toBe(true);
    expect(result.p2Hidden).toBe(true);
  });

  // =========================================================================
  // 3. getPageNumber returns current page index
  // =========================================================================

  test('3 — getPageNumber() returns index of current page', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const pc = new G.PageControl(canvas);
      pc.setBounds(0, 0, 400, 300);
      pc.setPageCount(3);

      const afterSet = pc.getPageNumber();
      pc.nextPage();
      const afterNext = pc.getPageNumber();

      pc.dispose();
      return { afterSet, afterNext };
    });
    expect(result.afterSet).toBe(0);
    expect(result.afterNext).toBe(1);
  });

  // =========================================================================
  // 4. nextPage advances; previousPage reverses
  // =========================================================================

  test('4 — nextPage() and previousPage() navigate correctly', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const pc = new G.PageControl(canvas);
      pc.setBounds(0, 0, 400, 300);
      pc.setPageCount(4);

      pc.nextPage();
      const after1 = pc.getPageNumber();
      pc.nextPage();
      const after2 = pc.getPageNumber();
      pc.previousPage();
      const after3 = pc.getPageNumber();

      pc.dispose();
      return { after1, after2, after3 };
    });
    expect(result.after1).toBe(1);
    expect(result.after2).toBe(2);
    expect(result.after3).toBe(1);
  });

  // =========================================================================
  // 5. Back hidden at page 0; Next hidden at last page (no useFinish)
  // =========================================================================

  test('5 — Back hidden at page 0; Next hidden at last page', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const pc = new G.PageControl(canvas);
      pc.setBounds(0, 0, 400, 300);
      pc.setPageCount(3);

      const backHiddenAtStart = pc.backButton().hidden();
      const nextVisibleAtStart = !pc.nextButton().hidden();

      pc.showPage(2); // last page
      const nextHiddenAtEnd = pc.nextButton().hidden();
      const backVisibleAtEnd = !pc.backButton().hidden();

      pc.dispose();
      return { backHiddenAtStart, nextVisibleAtStart, nextHiddenAtEnd, backVisibleAtEnd };
    });
    expect(result.backHiddenAtStart).toBe(true);
    expect(result.nextVisibleAtStart).toBe(true);
    expect(result.nextHiddenAtEnd).toBe(true);
    expect(result.backVisibleAtEnd).toBe(true);
  });

  // =========================================================================
  // 6. setUseFinishButton(true): on last page Next hidden, Finish shown
  // =========================================================================

  test('6 — setUseFinishButton(true): on last page Next is hidden, Finish is shown', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const pc = new G.PageControl(canvas);
      pc.setBounds(0, 0, 400, 300);
      pc.setPageCount(3);
      pc.setUseFinishButton(true);

      // On page 0 (not last): Next visible, Finish hidden.
      const nextVisibleOnFirst = !pc.nextButton().hidden();
      const finishHiddenOnFirst = pc.finishButton().hidden();

      pc.showPage(2); // last page
      const nextHiddenOnLast = pc.nextButton().hidden();
      const finishVisibleOnLast = !pc.finishButton().hidden();

      pc.dispose();
      return { nextVisibleOnFirst, finishHiddenOnFirst, nextHiddenOnLast, finishVisibleOnLast };
    });
    expect(result.nextVisibleOnFirst).toBe(true);
    expect(result.finishHiddenOnFirst).toBe(true);
    expect(result.nextHiddenOnLast).toBe(true);
    expect(result.finishVisibleOnLast).toBe(true);
  });

  // =========================================================================
  // 7. finish() fires onFinish
  // =========================================================================

  test('7 — finish() fires onFinish signal', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const pc = new G.PageControl(canvas);
      pc.setBounds(0, 0, 400, 300);
      pc.setPageCount(2);

      let finishFired = 0;
      let callerOk = false;
      pc.onFinish.on((ev: any) => {
        finishFired++;
        callerOk = ev.controlCaller === pc;
      });

      pc.finish();

      pc.dispose();
      return { finishFired, callerOk };
    });
    expect(result.finishFired).toBe(1);
    expect(result.callerOk).toBe(true);
  });

  // =========================================================================
  // 8. showPage(0) fires onPageChanged with integer=0
  // =========================================================================

  test('8 — showPage(i) fires onPageChanged with integer===i and correct page control', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const pc = new G.PageControl(canvas);
      pc.setBounds(0, 0, 400, 300);
      pc.setPageCount(3);

      const events: Array<{ integer: number; controlIsPage: boolean }> = [];
      pc.onPageChanged.on((ev: any) => {
        events.push({ integer: ev.integer, controlIsPage: ev.control === pc.getPage(ev.integer) });
      });

      // setPageCount already showed page 0; reset and show 1 explicitly.
      pc.showPage(1);

      pc.dispose();
      return events;
    });
    // The last event from showPage(1) should have integer=1.
    const lastEvent = result[result.length - 1];
    expect(lastEvent.integer).toBe(1);
    expect(lastEvent.controlIsPage).toBe(true);
  });

  // =========================================================================
  // 9. getCurrentPage() returns visible page Base
  // =========================================================================

  test('9 — getCurrentPage() returns the visible page Base', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const pc = new G.PageControl(canvas);
      pc.setBounds(0, 0, 400, 300);
      pc.setPageCount(3);

      const page0 = pc.getCurrentPage();
      const isPage0 = page0 === pc.getPage(0);

      pc.showPage(2);
      const page2 = pc.getCurrentPage();
      const isPage2 = page2 === pc.getPage(2);

      pc.dispose();
      return { isPage0, isPage2 };
    });
    expect(result.isPage0).toBe(true);
    expect(result.isPage2).toBe(true);
  });

  // =========================================================================
  // 10. MAX_PAGES = 64: setPageCount(100) clamps to 64
  // =========================================================================

  test('10 — setPageCount(100) clamps to 64 (MAX_PAGES)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const pc = new G.PageControl(canvas);
      pc.setBounds(0, 0, 400, 300);
      pc.setPageCount(100);
      const count = pc.getPageCount();
      pc.dispose();
      return count;
    });
    expect(result).toBe(64);
  });
});
