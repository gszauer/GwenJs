// T209 — CollapsibleCategory
//
// Categories covered:
//   1  Render         — #8 row alt-striping (layout logic verified)
//   2  Visual baseline — Skipped: GPU/skin variance
//   3  State visuals   — #7 collapsed height equals header height (layout result)
//   4  Pointer input   — #4 item click selects; siblings deselected
//   5  Touch input     — N/A: same path as pointer via canvas input
//   6  Keyboard        — N/A: CollapsibleCategory has no key handlers
//   7  Events          — #4 onSelection fires when item pressed
//   8  Resize          — N/A

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T209 CollapsibleCategory', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction: header button present
  // =========================================================================

  test('1 — new CollapsibleCategory: header button present; not collapsed', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const cat = new G.CollapsibleCategory(canvas);
        const hasHeader = cat._headerButton !== null && cat._headerButton !== undefined;
        const collapsed = cat.isCollapsed();
        cat.dispose();
        return { threw: false, hasHeader, collapsed };
      } catch {
        return { threw: true, hasHeader: false, collapsed: false };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.hasHeader).toBe(true);
    expect(result.collapsed).toBe(false);
  });

  // =========================================================================
  // 2. setText updates header text
  // =========================================================================

  test('2 — setText("MyCategory") updates header button text', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cat = new G.CollapsibleCategory(canvas);
      cat.setText('MyCategory');
      const text = cat.getText();
      cat.dispose();
      return text;
    });
    expect(result).toBe('MyCategory');
  });

  // =========================================================================
  // 3. add('Item1') creates a Button child
  // =========================================================================

  test('3 — add("Item1") creates a Button child; returned value is Button', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cat = new G.CollapsibleCategory(canvas);
      const btn = cat.add('Item1');
      const isButton = btn instanceof G.Button;
      // Count children: header + 1 item
      const childCount = cat.children.length;
      cat.dispose();
      return { isButton, childCount };
    });
    expect(result.isButton).toBe(true);
    // At minimum the header + 1 item child.
    expect(result.childCount).toBeGreaterThanOrEqual(2);
  });

  // =========================================================================
  // 4. Clicking an item selects it; siblings become unselected; onSelection fires
  // =========================================================================

  test('4 — clicking an item selects it; other items deselected; onSelection fires', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cat = new G.CollapsibleCategory(canvas);
      cat.setBounds(0, 0, 512, 100);
      const btn1 = cat.add('Item1');
      const btn2 = cat.add('Item2');
      const btn3 = cat.add('Item3');
      canvas.doThink();

      let selectionFired = 0;
      cat.onSelection.on(() => { selectionFired++; });

      // Press item2 via its onPress signal.
      btn2.onPress.emit({ controlCaller: btn2 });

      const sel = cat.getSelected();
      const item1Selected = btn1.getToggleState();
      const item2Selected = btn2.getToggleState();
      const item3Selected = btn3.getToggleState();

      cat.dispose();
      return { selectionFired, item1Selected, item2Selected, item3Selected, selIsBtn2: sel === btn2 };
    });
    expect(result.selectionFired).toBe(1);
    expect(result.item1Selected).toBe(false);
    expect(result.item2Selected).toBe(true);
    expect(result.item3Selected).toBe(false);
    expect(result.selIsBtn2).toBe(true);
  });

  // =========================================================================
  // 5. getSelected() returns selected button
  // =========================================================================

  test('5 — getSelected() returns the selected button; null when none selected', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cat = new G.CollapsibleCategory(canvas);
      const btn = cat.add('OnlyItem');

      const before = cat.getSelected();
      btn.onPress.emit({ controlCaller: btn });
      const after = cat.getSelected();

      cat.dispose();
      return { beforeNull: before === null, afterIsBtn: after === btn };
    });
    expect(result.beforeNull).toBe(true);
    expect(result.afterIsBtn).toBe(true);
  });

  // =========================================================================
  // 6. unselectAll() clears all
  // =========================================================================

  test('6 — unselectAll() deselects all items', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cat = new G.CollapsibleCategory(canvas);
      const btn1 = cat.add('A');
      const btn2 = cat.add('B');
      btn1.onPress.emit({ controlCaller: btn1 });
      // btn1 is now selected.
      cat.unselectAll();
      const sel = cat.getSelected();
      const b1State = btn1.getToggleState();
      const b2State = btn2.getToggleState();
      cat.dispose();
      return { selNull: sel === null, b1State, b2State };
    });
    expect(result.selNull).toBe(true);
    expect(result.b1State).toBe(false);
    expect(result.b2State).toBe(false);
  });

  // =========================================================================
  // 7. Collapsing: height shrinks to header height only
  // =========================================================================

  test('7 — collapsing (toggle header) shrinks height to header height', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cat = new G.CollapsibleCategory(canvas);
      cat.setBounds(0, 0, 512, 200);
      cat.add('Row1');
      cat.add('Row2');
      canvas.doThink();

      const expanded = cat.height();

      // Collapse by setting the toggle state to true directly, then re-layout.
      // (The header button is a toggle; postLayout reads getToggleState() to
      // decide whether to shrink. Using onPress.emit would not flip the toggle
      // because toggle only fires on the hovered+wasDepressed release path.)
      cat._headerButton.setToggleState(true);
      canvas.doThink();

      const collapsed = cat.height();
      const headerH = cat._headerButton.height();

      cat.dispose();
      return { expanded, collapsed, headerH };
    });
    // Collapsed height should equal header height.
    expect(result.collapsed).toBe(result.headerH);
    // Expanded height should be greater than header height.
    expect(result.expanded).toBeGreaterThan(result.headerH);
  });

  // =========================================================================
  // 8. Alternating row styling: first item alt=false; second alt=true
  // =========================================================================

  test('8 — alt-row striping: first item alt=false; second item alt=true', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const cat = new G.CollapsibleCategory(canvas);
      cat.setBounds(0, 0, 512, 200);
      const btn1 = cat.add('Row1');
      const btn2 = cat.add('Row2');
      const btn3 = cat.add('Row3');
      canvas.doThink();

      const alt1 = btn1.isAlt();
      const alt2 = btn2.isAlt();
      const alt3 = btn3.isAlt();
      cat.dispose();
      return { alt1, alt2, alt3 };
    });
    // First row: alt=false; second: alt=true; third: alt=false (alternating).
    expect(result.alt1).toBe(false);
    expect(result.alt2).toBe(true);
    expect(result.alt3).toBe(false);
  });
});
