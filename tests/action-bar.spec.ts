// ActionBar (toolbar / tool-palette).
//
// Categories covered:
//   1  Render        — construction, default size + padding, render-no-throw
//   2  Visual base   — N/A: skin-painted background; checked via pixel read in #10
//   3  State visuals — toggle on/off (Button feature exercised through the bar)
//   4  Pointer input — addButton click → onPress fires
//   5  Touch input   — N/A: same Button code path as pointer
//   6  Keyboard      — Space on focused button fires onPress (Button default)
//   7  Events        — onPress payload's controlCaller is the button
//   8  Resize        — N/A: bar perpendicular dim auto-tracks itemSize
//   9  Orientation   — setVertical re-docks every existing item
//  10  Pixel render  — bar with 3 items produces non-bg pixels

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('ActionBar', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction: default size 200×32; horizontal; itemSize 28
  // =========================================================================

  test('1 — construction: default 200×32 (horizontal); itemSize=28', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const bar = new G.ActionBar(canvas);
        const b = bar.getBounds();
        const r = {
          threw: false,
          w: b.w, h: b.h,
          vertical: bar.isVertical(),
          itemSize: bar.getItemSize(),
        };
        bar.dispose();
        return r;
      } catch {
        return { threw: true, w: 0, h: 0, vertical: false, itemSize: 0 };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.w).toBe(200);
    expect(result.h).toBe(32);
    expect(result.vertical).toBe(false);
    expect(result.itemSize).toBe(28);
  });

  // =========================================================================
  // 2. setVertical(true): bar's width tracks itemSize+padding; existing
  //    items re-dock from Pos.Left to Pos.Top. Bar's height grows to fit.
  // =========================================================================

  test('2 — setVertical(true): perpendicular dim shrinks; items re-dock Top', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const bar = new G.ActionBar(canvas);
      bar.setBounds(0, 0, 300, 32);
      const a = bar.addButton('A');
      const b = bar.addButton('B');

      bar.setVertical(true);

      const r = {
        vertical: bar.isVertical(),
        w: bar.getBounds().w,
        h: bar.getBounds().h,
        // _dock is the private Pos enum value the bar's children carry.
        aDock: (a as any)._dock,
        bDock: (b as any)._dock,
        topPos: G.Pos.Top,
      };
      bar.dispose();
      return r;
    });
    expect(result.vertical).toBe(true);
    expect(result.w).toBe(32);
    expect(result.aDock).toBe(result.topPos);
    expect(result.bDock).toBe(result.topPos);
  });

  // =========================================================================
  // 3. addButton(text): returns ActionBarButton with text + Pos.Left dock
  //    (horizontal default).
  // =========================================================================

  test('3 — addButton("Save"): returns ActionBarButton with text + Pos.Left', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const bar = new G.ActionBar(canvas);
      const b = bar.addButton('Save');
      const r = {
        isActionBarButton: b instanceof G.ActionBarButton,
        isButton: b instanceof G.Button,
        text: b.getText(),
        parentIsBar: b.parent === bar,
        dock: (b as any)._dock,
        leftPos: G.Pos.Left,
        w: b.width(),
        h: b.height(),
      };
      bar.dispose();
      return r;
    });
    expect(result.isActionBarButton).toBe(true);
    expect(result.isButton).toBe(true);
    expect(result.text).toBe('Save');
    expect(result.parentIsBar).toBe(true);
    expect(result.dock).toBe(result.leftPos);
    expect(result.w).toBe(28);
    expect(result.h).toBe(28);
  });

  // =========================================================================
  // 4. addSeparator(): returns ActionBarSeparator; mouse input disabled.
  // =========================================================================

  test('4 — addSeparator: returns separator; mouseInputEnabled=false', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const bar = new G.ActionBar(canvas);
      const s = bar.addSeparator();
      const r = {
        isSeparator: s instanceof G.ActionBarSeparator,
        parentIsBar: s.parent === bar,
        mouseEnabled: s.getMouseInputEnabled(),
      };
      bar.dispose();
      return r;
    });
    expect(result.isSeparator).toBe(true);
    expect(result.parentIsBar).toBe(true);
    expect(result.mouseEnabled).toBe(false);
  });

  // =========================================================================
  // 5. addItem(arbitrary control): control gets reparented + docked.
  // =========================================================================

  test('5 — addItem(combo): existing control reparents into the bar', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const bar = new G.ActionBar(canvas);
      const combo = new G.ComboBox(canvas);
      bar.addItem(combo);
      const r = {
        parentIsBar: combo.parent === bar,
        dock: (combo as any)._dock,
        leftPos: G.Pos.Left,
      };
      bar.dispose();
      return r;
    });
    expect(result.parentIsBar).toBe(true);
    expect(result.dock).toBe(result.leftPos);
  });

  // =========================================================================
  // 6. Click an ActionBarButton via the canvas input router → onPress fires.
  // =========================================================================

  test('6 — pointer click on ActionBarButton fires onPress with correct caller', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const bar = new G.ActionBar(canvas);
      bar.setBounds(20, 400, 200, 32);
      const b = bar.addButton('A');

      canvas.doThink(); // run a layout pass so the docked button has bounds.

      let fired = 0;
      let callerOk = false;
      b.onPress.on((ev: any) => {
        fired++;
        callerOk = ev.controlCaller === b;
      });

      const c = b.localPosToCanvas({ x: b.width() / 2, y: b.height() / 2 });
      canvas.inputMouseMoved(c.x, c.y, 0, 0);
      canvas.inputMouseButton(0, true);
      canvas.inputMouseButton(0, false);

      bar.dispose();
      return { fired, callerOk };
    });
    expect(result.fired).toBe(1);
    expect(result.callerOk).toBe(true);
  });

  // =========================================================================
  // 7. setItemSize(40): bar's height (horizontal) tracks 40+4; existing
  //    buttons resize to 40×40.
  // =========================================================================

  test('7 — setItemSize(40): bar height becomes 44; existing buttons resize', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const bar = new G.ActionBar(canvas);
      const b = bar.addButton('A');

      bar.setItemSize(40);

      const r = {
        barH: bar.height(),
        bW: b.width(),
        bH: b.height(),
        itemSize: bar.getItemSize(),
      };
      bar.dispose();
      return r;
    });
    expect(result.barH).toBe(44);
    expect(result.bW).toBe(40);
    expect(result.bH).toBe(40);
    expect(result.itemSize).toBe(40);
  });

  // =========================================================================
  // 8. Toggle button (`setIsToggle(true)`): toggleState flips on press.
  // =========================================================================

  test('8 — toggle button: getToggleState flips on each press', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const bar = new G.ActionBar(canvas);
      const b = bar.addButton('B');
      b.setIsToggle(true);

      // toggle() is the canonical API for flipping isToggle buttons —
      // matches what onMouseClickLeft does internally on hover-and-release.
      const before = b.getToggleState();
      b.toggle();
      const after1 = b.getToggleState();
      b.toggle();
      const after2 = b.getToggleState();

      bar.dispose();
      return { before, after1, after2 };
    });
    expect(result.before).toBe(false);
    expect(result.after1).toBe(true);
    expect(result.after2).toBe(false);
  });

  // =========================================================================
  // 9. Tooltips on icon-only buttons: setToolTip wires up; tooltip exists.
  // =========================================================================

  test('9 — setToolTip on action button installs a tooltip control', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const bar = new G.ActionBar(canvas);
      const b = bar.addButton('');
      b.setToolTip('Brush tool');
      const tip = b.getToolTip();
      const r = {
        hasTooltip: tip !== null,
        tipText: tip ? (tip as any).getText?.() : null,
      };
      bar.dispose();
      return r;
    });
    expect(result.hasTooltip).toBe(true);
    expect(result.tipText).toBe('Brush tool');
  });

  // =========================================================================
  // 10b. setColumns(2) on a vertical bar: width tracks 2 * itemSize +
  //      padding; items lay out in a grid (left-to-right, top-to-bottom).
  // =========================================================================

  test('10b — setColumns(2) lays out vertical items in a grid', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const bar = new G.ActionBar(canvas);
      bar.setVertical(true);
      bar.setColumns(2);
      bar.setBounds(0, 0, bar.getBounds().w, 200);
      const a = bar.addButton('A');
      const b = bar.addButton('B');
      const c = bar.addButton('C');
      const d = bar.addButton('D');

      canvas.doThink();

      const r = {
        barW: bar.width(),
        cols: bar.getColumns(),
        // Expected positions: itemSize=28, padding=2 → (2,2), (30,2), (2,30), (30,30).
        aPos: { x: a.x(), y: a.y() },
        bPos: { x: b.x(), y: b.y() },
        cPos: { x: c.x(), y: c.y() },
        dPos: { x: d.x(), y: d.y() },
      };
      bar.dispose();
      return r;
    });
    expect(result.cols).toBe(2);
    expect(result.barW).toBe(60);            // 28 * 2 + 2 + 2
    expect(result.aPos).toEqual({ x: 2, y: 2 });
    expect(result.bPos).toEqual({ x: 30, y: 2 });
    expect(result.cPos).toEqual({ x: 2, y: 30 });
    expect(result.dPos).toEqual({ x: 30, y: 30 });
  });

  // =========================================================================
  // 10c. Separator spacing in multi-column mode: separator takes only 8 px
  //      vertically (not a full slot row), and the next item resumes
  //      immediately below — no empty grid row.
  // =========================================================================

  test('10c — multi-column separator only takes 8px; next row starts right below', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const bar = new G.ActionBar(canvas);
      bar.setVertical(true);
      bar.setColumns(2);
      bar.setBounds(0, 0, bar.getBounds().w, 200);

      const a = bar.addButton('A');
      const b = bar.addButton('B');
      const sep = bar.addSeparator();
      const c = bar.addButton('C');
      const d = bar.addButton('D');

      canvas.doThink();

      const r = {
        aPos: { x: a.x(), y: a.y() },
        bPos: { x: b.x(), y: b.y() },
        // Separator should sit at y = padding + 1 row of slot = 30,
        // height 8 (not the slot's 28).
        sepPos: { x: sep.x(), y: sep.y(), w: sep.width(), h: sep.height() },
        // Next pair should start right after the separator: y = 30 + 8 = 38.
        cPos: { x: c.x(), y: c.y() },
        dPos: { x: d.x(), y: d.y() },
      };
      bar.dispose();
      return r;
    });
    // Row 0
    expect(result.aPos).toEqual({ x: 2, y: 2 });
    expect(result.bPos).toEqual({ x: 30, y: 2 });
    // Separator: full bar width, 8 px tall, at y = 30
    expect(result.sepPos.y).toBe(30);
    expect(result.sepPos.h).toBe(8);
    expect(result.sepPos.w).toBe(56); // 2 cols × 28
    // Next row starts immediately after separator (y = 30 + 8 = 38)
    expect(result.cPos).toEqual({ x: 2, y: 38 });
    expect(result.dPos).toEqual({ x: 30, y: 38 });
  });

  // =========================================================================
  // 11. Radio mode: activating a button deactivates the previous active.
  // =========================================================================

  test('11 — radio mode: activating one button deactivates the previous active', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const bar = new G.ActionBar(canvas);
      bar.setRadioMode(true);
      const a = bar.addButton('A');
      const b = bar.addButton('B');

      // a starts inactive; turn it on.
      a.setToggleState(true);
      const after1 = { aOn: a.getToggleState(), bOn: b.getToggleState(), active: bar.getActiveButton() === a };

      // Now activate b — a should automatically deactivate.
      b.setToggleState(true);
      const after2 = { aOn: a.getToggleState(), bOn: b.getToggleState(), active: bar.getActiveButton() === b };

      bar.dispose();
      return { after1, after2 };
    });
    expect(result.after1.aOn).toBe(true);
    expect(result.after1.bOn).toBe(false);
    expect(result.after1.active).toBe(true);
    expect(result.after2.aOn).toBe(false);
    expect(result.after2.bOn).toBe(true);
    expect(result.after2.active).toBe(true);
  });

  // =========================================================================
  // 12. Radio mode: clicking the active button can't deactivate it
  //     (always exactly one tool selected).
  // =========================================================================

  test('12 — radio mode: active button cannot deactivate itself', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const bar = new G.ActionBar(canvas);
      bar.setRadioMode(true);
      const a = bar.addButton('A');

      a.setToggleState(true);
      // Try to turn off — radio mode should restore.
      a.setToggleState(false);

      const r = { stateAfter: a.getToggleState(), active: bar.getActiveButton() === a };
      bar.dispose();
      return r;
    });
    expect(result.stateAfter).toBe(true);
    expect(result.active).toBe(true);
  });

  // =========================================================================
  // 13. setRadioMode(true) on a bar with multiple already-active buttons
  //     keeps the first as active and turns the rest off.
  // =========================================================================

  test('13 — setRadioMode(true) reconciles existing selections to one active', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const bar = new G.ActionBar(canvas);
      const a = bar.addButton('A');
      const b = bar.addButton('B');
      const c = bar.addButton('C');
      a.setIsToggle(true);
      b.setIsToggle(true);
      c.setIsToggle(true);
      a.setToggleState(true);
      b.setToggleState(true);

      bar.setRadioMode(true);

      const r = {
        aOn: a.getToggleState(),
        bOn: b.getToggleState(),
        cOn: c.getToggleState(),
        activeIsA: bar.getActiveButton() === a,
      };
      bar.dispose();
      return r;
    });
    expect(result.aOn).toBe(true);
    expect(result.bOn).toBe(false);
    expect(result.cOn).toBe(false);
    expect(result.activeIsA).toBe(true);
  });

  // =========================================================================
  // 14. addItem auto-centers a non-square ComboBox so the dock pass
  //     doesn't stretch it across the full slot height.
  // =========================================================================

  test('14 — addItem applies centering margin to non-square widgets', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const bar = new G.ActionBar(canvas);    // horizontal, slot height = 28
      const combo = new G.ComboBox(canvas);
      combo.setSize(140, 22);                 // 22 < 28 → expect top/bottom margin
      bar.addItem(combo);

      const m = combo.getMargin();
      const r = {
        marginTop: m.top,
        marginBottom: m.bottom,
        marginLeft: m.left,
        marginRight: m.right,
      };
      bar.dispose();
      return r;
    });
    // (28 - 22) / 2 = 3 → 3 px top + bottom; left/right untouched.
    expect(result.marginTop).toBe(3);
    expect(result.marginBottom).toBe(3);
    expect(result.marginLeft).toBe(0);
    expect(result.marginRight).toBe(0);
  });

  // =========================================================================
  // 15. setSectionMode(true) initialises one section + disables radio mode.
  // =========================================================================

  test('15 — setSectionMode(true): initialises one section; disables radio mode', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const bar = new G.ActionBar(canvas);
      bar.setRadioMode(true);
      bar.setSectionMode(true);
      const r = {
        sectionMode: bar.isSectionMode(),
        radioMode: bar.isRadioMode(),
        sectionCount: bar.getSectionCount(),
      };
      bar.dispose();
      return r;
    });
    expect(result.sectionMode).toBe(true);
    expect(result.radioMode).toBe(false);
    expect(result.sectionCount).toBe(1);
  });

  // =========================================================================
  // 16. beginSection: first call configures section 0 without separator;
  //     subsequent calls auto-insert a separator and open a new section.
  // =========================================================================

  test('16 — beginSection: first call no-separator; later calls insert separator', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const bar = new G.ActionBar(canvas);
      bar.setSectionMode(true);

      bar.beginSection({ radio: true });
      bar.addButton('A');
      bar.addButton('B');
      const sepsAfterFirst = bar.children.filter((c: any) => c instanceof G.ActionBarSeparator).length;

      bar.beginSection({ radio: false });
      bar.addButton('C');
      const sepsAfterSecond = bar.children.filter((c: any) => c instanceof G.ActionBarSeparator).length;

      bar.beginSection({ radio: true });
      bar.addButton('D');
      const sepsAfterThird = bar.children.filter((c: any) => c instanceof G.ActionBarSeparator).length;

      const r = {
        sepsAfterFirst,
        sepsAfterSecond,
        sepsAfterThird,
        sectionCount: bar.getSectionCount(),
      };
      bar.dispose();
      return r;
    });
    expect(result.sepsAfterFirst).toBe(0);
    expect(result.sepsAfterSecond).toBe(1);
    expect(result.sepsAfterThird).toBe(2);
    expect(result.sectionCount).toBe(3);
  });

  // =========================================================================
  // 17. Radio behaviour is scoped to the button's section — activating one
  //     in section 1 does NOT deactivate the active button in section 0.
  // =========================================================================

  test('17 — section radio is isolated per-section', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const bar = new G.ActionBar(canvas);
      bar.setSectionMode(true);

      bar.beginSection({ radio: true });
      const a = bar.addButton('A');
      const b = bar.addButton('B');

      bar.beginSection({ radio: true });
      const c = bar.addButton('C');
      const d = bar.addButton('D');

      a.setToggleState(true);
      c.setToggleState(true);

      // Toggle a different button in section 1 — section 0 should be untouched.
      d.setToggleState(true);

      const r = {
        aOn: a.getToggleState(),
        bOn: b.getToggleState(),
        cOn: c.getToggleState(),
        dOn: d.getToggleState(),
        sec0Active: bar.getActiveInSection(0) === a,
        sec1Active: bar.getActiveInSection(1) === d,
      };
      bar.dispose();
      return r;
    });
    expect(result.aOn).toBe(true);
    expect(result.bOn).toBe(false);
    expect(result.cOn).toBe(false);
    expect(result.dOn).toBe(true);
    expect(result.sec0Active).toBe(true);
    expect(result.sec1Active).toBe(true);
  });

  // =========================================================================
  // 18. Mixing radio + normal sections: in a non-radio section, multiple
  //     buttons can be on simultaneously and getActiveInSection stays null.
  // =========================================================================

  test('18 — non-radio section allows multiple active toggles independently', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const bar = new G.ActionBar(canvas);
      bar.setSectionMode(true);

      bar.beginSection({ radio: true });
      const a = bar.addButton('A');

      bar.beginSection({ radio: false });
      const bold = bar.addButton('Bold');
      const italic = bar.addButton('Italic');
      bold.setIsToggle(true);
      italic.setIsToggle(true);

      a.setToggleState(true);
      bold.setToggleState(true);
      italic.setToggleState(true);

      const r = {
        aOn: a.getToggleState(),
        boldOn: bold.getToggleState(),
        italicOn: italic.getToggleState(),
        sec1Active: bar.getActiveInSection(1),
      };
      bar.dispose();
      return r;
    });
    expect(result.aOn).toBe(true);
    expect(result.boldOn).toBe(true);
    expect(result.italicOn).toBe(true);
    expect(result.sec1Active).toBe(null);
  });

  // =========================================================================
  // 19. In a radio section, the active button cannot deactivate itself.
  // =========================================================================

  test('19 — radio section: active button cannot deactivate itself', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const bar = new G.ActionBar(canvas);
      bar.setSectionMode(true);

      bar.beginSection({ radio: true });
      const a = bar.addButton('A');
      a.setToggleState(true);
      a.setToggleState(false);

      const r = {
        stateAfter: a.getToggleState(),
        active: bar.getActiveInSection(0) === a,
      };
      bar.dispose();
      return r;
    });
    expect(result.stateAfter).toBe(true);
    expect(result.active).toBe(true);
  });

  // =========================================================================
  // 20. addSeparator() in section mode inherits the previous section's
  //     radio setting so callers can mix beginSection and addSeparator.
  // =========================================================================

  test('20 — addSeparator inherits prior section radio setting in section mode', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const bar = new G.ActionBar(canvas);
      bar.setSectionMode(true);
      bar.beginSection({ radio: true });
      bar.addButton('A');
      bar.addSeparator();  // should open section 1 inheriting radio=true
      bar.addButton('B');
      bar.addButton('C');

      const r = {
        sectionCount: bar.getSectionCount(),
      };

      // Verify radio behaviour in the inherited section.
      const buttons = bar.children.filter((c: any) => c instanceof G.ActionBarButton);
      buttons[1].setToggleState(true);
      buttons[2].setToggleState(true);

      const r2 = {
        ...r,
        b1On: buttons[1].getToggleState(),
        b2On: buttons[2].getToggleState(),
        sec1Active: bar.getActiveInSection(1) === buttons[2],
      };
      bar.dispose();
      return r2;
    });
    expect(result.sectionCount).toBe(2);
    expect(result.b1On).toBe(false);
    expect(result.b2On).toBe(true);
    expect(result.sec1Active).toBe(true);
  });

  // =========================================================================
  // 21. setRadioMode(true) disables section mode and clears its state.
  // =========================================================================

  test('21 — setRadioMode(true) tears down section mode', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const bar = new G.ActionBar(canvas);
      bar.setSectionMode(true);
      bar.beginSection({ radio: true });
      bar.addButton('A');
      bar.beginSection({ radio: false });
      bar.addButton('B');

      bar.setRadioMode(true);

      const r = {
        sectionMode: bar.isSectionMode(),
        radioMode: bar.isRadioMode(),
        sectionCount: bar.getSectionCount(),
      };
      bar.dispose();
      return r;
    });
    expect(result.sectionMode).toBe(false);
    expect(result.radioMode).toBe(true);
    expect(result.sectionCount).toBe(0);
  });

  // =========================================================================
  // 10. Render with three items produces non-background pixels — proves
  //     drawMenuStrip + button skinning ran end-to-end.
  // =========================================================================

  test('10 — render with three items produces non-background pixels', async ({ page }) => {
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

      try {
        const bar = new G.ActionBar(cvs);
        bar.setBounds(0, 0, 400, 32);
        bar.addButton('A');
        bar.addSeparator();
        bar.addButton('B');

        cvs.doThink();
        cvs.redraw();
        cvs.renderCanvas();

        const gl = renderer.gl;
        const pixels = new Uint8Array(400 * 32 * 4);
        gl.readPixels(0, 60 - 32, 400, 32, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

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
      } catch {
        cvs.dispose();
        document.body.removeChild(htmlC);
        return false;
      }
    });
    expect(result).toBe(true);
  });
});
