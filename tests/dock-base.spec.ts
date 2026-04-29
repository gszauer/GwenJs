// T309 — DockBase (headline feature)
//
// Categories covered:
//   1  Render          — #18 renderOver no-throw with _drawHover=true
//   2  Visual baseline — Skipped: DockBase.render() is a no-op per spec
//   3  State visuals   — #14 _drawHover toggled by HoverEnter/HoverLeave
//   4  Pointer input   — N/A: DnD is tested via direct method calls (DnD infra not yet wired)
//   5  Touch input     — N/A: same path as pointer
//   6  Keyboard        — N/A: DockBase has no custom key handlers
//   7  Events          — #13 dragAndDrop_CanAcceptPackage; #17 HandleDrop creates child dock
//   8  Resize          — N/A: layout is dock-driven; resize goes through Base.recurseLayout

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T309 DockBase', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction: no edge children; no dockedTabControl; isEmpty=true
  // =========================================================================

  test('1 — new DockBase: no edge children; _dockedTabControl is null', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const dock = new G.DockBase(canvas);
        const leftNull = (dock as any)._left === null;
        const rightNull = (dock as any)._right === null;
        const topNull = (dock as any)._top === null;
        const bottomNull = (dock as any)._bottom === null;
        const tabCtrlNull = (dock as any)._dockedTabControl === null;
        dock.dispose();
        return { threw: false, leftNull, rightNull, topNull, bottomNull, tabCtrlNull };
      } catch {
        return { threw: true, leftNull: false, rightNull: false, topNull: false, bottomNull: false, tabCtrlNull: false };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.leftNull).toBe(true);
    expect(result.rightNull).toBe(true);
    expect(result.topNull).toBe(true);
    expect(result.bottomNull).toBe(true);
    expect(result.tabCtrlNull).toBe(true);
  });

  // =========================================================================
  // 2. isEmpty() true initially
  // =========================================================================

  test('2 — isEmpty() returns true on a freshly constructed DockBase', async ({ page }) => {
    const isEmpty = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const dock = new G.DockBase(canvas);
      const result = dock.isEmpty();
      dock.dispose();
      return result;
    });
    expect(isEmpty).toBe(true);
  });

  // =========================================================================
  // 3. getLeft() lazy-creates a child DockBase; same instance on repeat call
  // =========================================================================

  test('3 — getLeft() creates a child DockBase; repeated calls return same instance', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const dock = new G.DockBase(canvas);

      const left1 = dock.getLeft();
      const left2 = dock.getLeft();

      const isInstance = left1 instanceof G.DockBase;
      const sameInstance = left1 === left2;

      dock.dispose();
      return { isInstance, sameInstance };
    });
    expect(result.isInstance).toBe(true);
    expect(result.sameInstance).toBe(true);
  });

  // =========================================================================
  // 4. Created child has getTabControl() non-null (a DockedTabControl)
  // =========================================================================

  test('4 — child DockBase from getLeft() has a non-null DockedTabControl', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const dock = new G.DockBase(canvas);

      const leftChild = dock.getLeft();
      const tc = leftChild.getTabControl();
      const isDockedTabControl = tc instanceof G.DockedTabControl;

      dock.dispose();
      return { tcNotNull: tc !== null, isDockedTabControl };
    });
    expect(result.tcNotNull).toBe(true);
    expect(result.isDockedTabControl).toBe(true);
  });

  // =========================================================================
  // 5. Created child is docked Left relative to parent (Pos.Left)
  // =========================================================================

  test('5 — getLeft() child is docked with Pos.Left', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const dock = new G.DockBase(canvas);

      const leftChild = dock.getLeft();
      // _dock is the private dock field on Base
      const dockValue = (leftChild as any)._dock;
      const posLeft = G.Pos.Left;

      dock.dispose();
      return { dockValue, posLeft };
    });
    expect(result.dockValue).toBe(result.posLeft);
  });

  // =========================================================================
  // 6. getRight(), getTop(), getBottom() work analogously to getLeft()
  // =========================================================================

  test('6 — getRight/getTop/getBottom each create a child DockBase with a DockedTabControl', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const dock = new G.DockBase(canvas);

      const right = dock.getRight();
      const top = dock.getTop();
      const bottom = dock.getBottom();

      const checks = {
        rightIsDock: right instanceof G.DockBase,
        topIsDock: top instanceof G.DockBase,
        bottomIsDock: bottom instanceof G.DockBase,
        rightHasTc: right.getTabControl() instanceof G.DockedTabControl,
        topHasTc: top.getTabControl() instanceof G.DockedTabControl,
        bottomHasTc: bottom.getTabControl() instanceof G.DockedTabControl,
        rightDock: (right as any)._dock === G.Pos.Right,
        topDock: (top as any)._dock === G.Pos.Top,
        bottomDock: (bottom as any)._dock === G.Pos.Bottom,
      };

      dock.dispose();
      return checks;
    });
    expect(result.rightIsDock).toBe(true);
    expect(result.topIsDock).toBe(true);
    expect(result.bottomIsDock).toBe(true);
    expect(result.rightHasTc).toBe(true);
    expect(result.topHasTc).toBe(true);
    expect(result.bottomHasTc).toBe(true);
    expect(result.rightDock).toBe(true);
    expect(result.topDock).toBe(true);
    expect(result.bottomDock).toBe(true);
  });

  // =========================================================================
  // 7. Adding a tab to a left child: child has 1 tab; child is not empty
  // =========================================================================

  test('7 — addPage on left child tabControl: tabCount=1; child.isEmpty()=false', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const dock = new G.DockBase(canvas);
      dock.setBounds(0, 0, 400, 300);

      const leftChild = dock.getLeft();
      const tc = leftChild.getTabControl();
      tc.addPage('Left Content');

      const tabCount = tc.tabCount();
      const childEmpty = leftChild.isEmpty();

      dock.dispose();
      return { tabCount, childEmpty };
    });
    expect(result.tabCount).toBe(1);
    expect(result.childEmpty).toBe(false);
  });

  // =========================================================================
  // 8. After adding a tab to a child, root isEmpty() returns false
  // =========================================================================

  test('8 — root isEmpty() returns false after tab added to left child', async ({ page }) => {
    const rootEmpty = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const dock = new G.DockBase(canvas);
      dock.setBounds(0, 0, 400, 300);

      dock.getLeft().getTabControl().addPage('Content');

      const empty = dock.isEmpty();
      dock.dispose();
      return empty;
    });
    expect(rootEmpty).toBe(false);
  });

  // =========================================================================
  // 9. getDroppedTabDirection: center point returns Pos.Fill
  // =========================================================================

  test('9 — getDroppedTabDirection at center returns Pos.Fill', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const dock = new G.DockBase(canvas);
      // Default size is 200×200; center is (100, 100).
      dock.setSize(200, 200);

      const dir = (dock as any).getDroppedTabDirection(100, 100);
      dock.dispose();
      return { dir, fill: G.Pos.Fill };
    });
    expect(result.dir).toBe(result.fill);
  });

  // =========================================================================
  // 10. getDroppedTabDirection near left edge returns Pos.Left when _left absent
  // =========================================================================

  test('10 — getDroppedTabDirection near left edge returns Pos.Left when no left child', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const dock = new G.DockBase(canvas);
      dock.setSize(200, 200);

      // x=5 is very close to the left edge; y=100 is vertical center.
      const dir = (dock as any).getDroppedTabDirection(5, 100);
      dock.dispose();
      return { dir, posLeft: G.Pos.Left };
    });
    expect(result.dir).toBe(result.posLeft);
  });

  // =========================================================================
  // 11. Same left-edge position returns Pos.Fill when _left already exists
  // =========================================================================

  test('11 — near left edge returns Pos.Fill when left child already exists', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const dock = new G.DockBase(canvas);
      dock.setSize(200, 200);

      // Create the left child (it will not be hidden).
      dock.getLeft();

      // Same position as test 10 — but now _left exists and is not hidden,
      // so the left branch is skipped and the method falls through to Fill.
      const dir = (dock as any).getDroppedTabDirection(5, 100);
      dock.dispose();
      return { dir, fill: G.Pos.Fill };
    });
    expect(result.dir).toBe(result.fill);
  });

  // =========================================================================
  // 12. dragAndDrop_CanAcceptPackage returns true for TabButtonMove
  // =========================================================================

  test('12 — dragAndDrop_CanAcceptPackage returns true for TabButtonMove', async ({ page }) => {
    const accepts = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const dock = new G.DockBase(canvas);
      const pkg = { name: 'TabButtonMove', userdata: null, draggable: true, drawcontrol: null, holdoffset: { x: 0, y: 0 } };
      const result = dock.dragAndDrop_CanAcceptPackage(pkg);
      dock.dispose();
      return result;
    });
    expect(accepts).toBe(true);
  });

  // =========================================================================
  // 13. dragAndDrop_CanAcceptPackage returns false for unknown package name
  // =========================================================================

  test('13 — dragAndDrop_CanAcceptPackage returns false for unknown package name', async ({ page }) => {
    const accepts = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const dock = new G.DockBase(canvas);
      const pkg = { name: 'Other', userdata: null, draggable: true, drawcontrol: null, holdoffset: { x: 0, y: 0 } };
      const result = dock.dragAndDrop_CanAcceptPackage(pkg);
      dock.dispose();
      return result;
    });
    expect(accepts).toBe(false);
  });

  // =========================================================================
  // 14. dragAndDrop_HoverEnter toggles _drawHover to true
  // =========================================================================

  test('14 — dragAndDrop_HoverEnter sets _drawHover to true', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const dock = new G.DockBase(canvas);

      const before = (dock as any)._drawHover;
      const pkg = { name: 'TabButtonMove', userdata: null, draggable: true, drawcontrol: null, holdoffset: { x: 0, y: 0 } };
      dock.dragAndDrop_HoverEnter(pkg, 50, 50);
      const after = (dock as any)._drawHover;

      dock.dispose();
      return { before, after };
    });
    expect(result.before).toBe(false);
    expect(result.after).toBe(true);
  });

  // =========================================================================
  // 15. dragAndDrop_HoverLeave toggles _drawHover back to false
  // =========================================================================

  test('15 — dragAndDrop_HoverLeave sets _drawHover back to false', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const dock = new G.DockBase(canvas);

      const pkg = { name: 'TabButtonMove', userdata: null, draggable: true, drawcontrol: null, holdoffset: { x: 0, y: 0 } };
      dock.dragAndDrop_HoverEnter(pkg, 50, 50);
      const afterEnter = (dock as any)._drawHover;

      dock.dragAndDrop_HoverLeave(pkg);
      const afterLeave = (dock as any)._drawHover;

      dock.dispose();
      return { afterEnter, afterLeave };
    });
    expect(result.afterEnter).toBe(true);
    expect(result.afterLeave).toBe(false);
  });

  // =========================================================================
  // 16. Removing all tabs from a child leaves it isEmpty=true
  // =========================================================================

  test('16 — removing the only tab from left child: child isEmpty() returns true', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const dock = new G.DockBase(canvas);
      dock.setBounds(0, 0, 400, 300);

      const leftChild = dock.getLeft();
      const tc = leftChild.getTabControl();
      const btn = tc.addPage('Tab A');

      const emptyBefore = leftChild.isEmpty();

      tc.removePage(btn);

      const emptyAfter = leftChild.isEmpty();

      dock.dispose();
      return { emptyBefore, emptyAfter };
    });
    expect(result.emptyBefore).toBe(false);
    expect(result.emptyAfter).toBe(true);
  });

  // =========================================================================
  // 17. dragAndDrop_HandleDrop with TabButtonMove near left edge creates
  //     a new left child containing the dropped tab
  // =========================================================================

  test('17 — HandleDrop with TabButtonMove near left edge: new left child gets the tab', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      // Source: a standalone DockBase with a tab we will drag.
      const srcDock = new G.DockBase(canvas);
      srcDock.setBounds(0, 0, 400, 300);
      const srcLeft = srcDock.getLeft();
      const srcTc = srcLeft.getTabControl();
      const tabBtn = srcTc.addPage('Dropped');

      // Target: a fresh DockBase with known bounds (200×200 at origin).
      const tgtDock = new G.DockBase(canvas);
      tgtDock.setBounds(0, 0, 200, 200);

      // canvasX=5 is near the left edge of a 200-wide dock (x/w = 0.025 < 0.3).
      // canvasPosToLocal on tgtDock (parent=canvas, which is the root) subtracts
      // tgtDock's own bounds offset from the passed canvas coords, then asks the
      // parent (canvas) for its canvasPosToLocal. Canvas has no parent so the
      // chain terminates there. With tgtDock at x=0 the local x == canvas x.
      const canvasX = 5;
      const canvasY = 100;

      const pkg = {
        name: 'TabButtonMove',
        userdata: null,
        draggable: true,
        drawcontrol: tabBtn,
        holdoffset: { x: 0, y: 0 },
      };

      const dropped = tgtDock.dragAndDrop_HandleDrop(pkg, canvasX, canvasY);

      // After drop, the left child of tgtDock should now hold the moved tab.
      const leftChild = (tgtDock as any)._left;
      const leftTc = leftChild ? leftChild.getTabControl() : null;
      const tabCountAfter = leftTc ? leftTc.tabCount() : 0;

      srcDock.dispose();
      tgtDock.dispose();

      return { dropped, tabCountAfter };
    });
    expect(result.dropped).toBe(true);
    expect(result.tabCountAfter).toBe(1);
  });

  // =========================================================================
  // 18. renderOver does not throw when _drawHover is true
  // =========================================================================

  test('18 — renderOver does not throw when _drawHover is active', async ({ page }) => {
    const threw = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 400; htmlC.height = 300;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cvs = new G.Canvas(skin, htmlC);
      cvs.setBounds(0, 0, 400, 300);
      cvs.setDrawBackground(true);
      cvs.setBackgroundColor(G.color(0, 0, 0, 255));

      try {
        const dock = new G.DockBase(cvs);
        dock.setBounds(0, 0, 400, 300);

        // Trigger hover state.
        const pkg = { name: 'TabButtonMove', userdata: null, draggable: true, drawcontrol: null, holdoffset: { x: 0, y: 0 } };
        dock.dragAndDrop_HoverEnter(pkg, 200, 150);

        cvs.doThink();
        cvs.redraw();
        cvs.renderCanvas();

        cvs.dispose();
        document.body.removeChild(htmlC);
        return false;
      } catch {
        cvs.dispose();
        document.body.removeChild(htmlC);
        return true;
      }
    });
    expect(threw).toBe(false);
  });

  // =========================================================================
  // 19. Regression: dragging the source's current tab to a new edge keeps
  //     the moved page visible in its new dock. The source TC's stale
  //     `_currentButton` cleanup used to call `oldPage.hide()` even when
  //     the page had been reparented to another inner panel, leaving the
  //     destination dock visibly empty until re-docked.
  // =========================================================================

  test('19 — dragging current tab from a multi-tab dock keeps moved page visible in destination', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      // Source dock with TWO tabs; T1 is the current selection.
      const srcDock = new G.DockBase(canvas);
      srcDock.setBounds(0, 0, 400, 300);
      const srcChild = srcDock.getLeft();
      const srcTc = srcChild.getTabControl();
      const t1 = srcTc.addPage('T1');
      const t2 = srcTc.addPage('T2');
      // addPage selects the first tab automatically; press T1 explicitly
      // to make the bug repro deterministic if that ever changes.
      (srcTc as any).onTabPressed(t1);

      // Target dock with no children — drop near top edge to create one.
      const tgtDock = new G.DockBase(canvas);
      tgtDock.setBounds(0, 0, 200, 200);

      const pkg = {
        name: 'TabButtonMove', userdata: null, draggable: true,
        drawcontrol: t1, holdoffset: { x: 0, y: 0 },
      };
      // y = 5 → near top edge (y/h = 0.025 < 0.3, < left/right/bottom).
      tgtDock.dragAndDrop_HandleDrop(pkg, 100, 5);

      const dropChild = (tgtDock as any)._top;
      const dstTc = dropChild ? dropChild.getTabControl() : null;
      const dstPage = t1.getPage();

      const r = {
        dstTabCount: dstTc ? dstTc.tabCount() : -1,
        dstCurrent: dstTc ? dstTc.getCurrentButton() === t1 : false,
        dstPageHidden: dstPage ? dstPage.hidden() : null,
        srcCurrent: srcTc.getCurrentButton() === t2,
        srcPageHidden: t2.getPage() ? t2.getPage().hidden() : null,
      };

      srcDock.dispose();
      tgtDock.dispose();
      return r;
    });
    expect(result.dstTabCount).toBe(1);
    expect(result.dstCurrent).toBe(true);
    // The moved page must be visible in its new home — this is the bug.
    expect(result.dstPageHidden).toBe(false);
    // Source promoted its remaining tab to current.
    expect(result.srcCurrent).toBe(true);
    expect(result.srcPageHidden).toBe(false);
  });

  // =========================================================================
  // 20. Regression: TabWindowMove (whole-dock drag) preserves the source's
  //     current selection in the destination. moveTabsTo's per-tab loop
  //     attaches in array order; without explicitly re-pressing the
  //     source's previous current at the end, the *first* tab wins.
  // =========================================================================

  test('20 — TabWindowMove preserves source current selection in destination', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      // Source dock with two tabs; explicitly press T2 so it's current.
      const srcDock = new G.DockBase(canvas);
      srcDock.setBounds(0, 0, 400, 300);
      const srcChild = srcDock.getLeft();
      const srcTc = srcChild.getTabControl();
      const t1 = srcTc.addPage('T1');
      const t2 = srcTc.addPage('T2');
      (srcTc as any).onTabPressed(t2);

      // Drop the SOURCE TC (TabWindowMove) onto the target's bottom edge.
      const tgtDock = new G.DockBase(canvas);
      tgtDock.setBounds(0, 0, 200, 200);

      const pkg = {
        name: 'TabWindowMove', userdata: null, draggable: true,
        drawcontrol: srcTc, holdoffset: { x: 0, y: 0 },
      };
      // y = 195 → near bottom edge.
      tgtDock.dragAndDrop_HandleDrop(pkg, 100, 195);

      const dropChild = (tgtDock as any)._bottom;
      const dstTc = dropChild ? dropChild.getTabControl() : null;
      const r = {
        dstTabCount: dstTc ? dstTc.tabCount() : -1,
        dstCurrentIsT2: dstTc ? dstTc.getCurrentButton() === t2 : false,
        t1Hidden: t1.getPage() ? t1.getPage().hidden() : null,
        t2Hidden: t2.getPage() ? t2.getPage().hidden() : null,
      };

      srcDock.dispose();
      tgtDock.dispose();
      return r;
    });
    expect(result.dstTabCount).toBe(2);
    // Source's current tab (T2) must remain current in the destination.
    expect(result.dstCurrentIsT2).toBe(true);
    // T2's page is the visible one; T1 sits hidden behind it.
    expect(result.t2Hidden).toBe(false);
    expect(result.t1Hidden).toBe(true);
  });

  // =========================================================================
  // 21. Single-tab drop onto a dock that already has a live current tab:
  //     the dragged tab should be promoted to active (user intent), and
  //     the previously-current tab's page hides cleanly.
  // =========================================================================

  test('21 — TabButtonMove onto a populated dock promotes the dragged tab to active', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const srcDock = new G.DockBase(canvas);
      srcDock.setBounds(0, 0, 400, 300);
      const srcTc = srcDock.getLeft().getTabControl();
      const tNew = srcTc.addPage('Incoming');

      // The drop target is a child dock (not the root) — only child
      // docks own a `_dockedTabControl`, so a Fill drop has somewhere
      // to land.
      const tgtRoot = new G.DockBase(canvas);
      tgtRoot.setBounds(0, 0, 200, 200);
      const tgtChild = tgtRoot.getRight();
      const tgtTc = tgtChild.getTabControl();
      const tExisting = tgtTc.addPage('Existing');

      const pkg = {
        name: 'TabButtonMove', userdata: null, draggable: true,
        drawcontrol: tNew, holdoffset: { x: 0, y: 0 },
      };
      // Drop in the center of tgtChild → Pos.Fill → attaches to tgtTc.
      const cb = tgtChild.getBounds();
      const cx = cb.x + cb.w / 2;
      const cy = cb.y + cb.h / 2;
      tgtChild.dragAndDrop_HandleDrop(pkg, cx, cy);

      const r = {
        currentIsIncoming: tgtTc.getCurrentButton() === tNew,
        incomingPageHidden: tNew.getPage() ? tNew.getPage().hidden() : null,
        existingPageHidden: tExisting.getPage() ? tExisting.getPage().hidden() : null,
      };

      srcDock.dispose();
      tgtRoot.dispose();
      return r;
    });
    expect(result.currentIsIncoming).toBe(true);
    expect(result.incomingPageHidden).toBe(false);
    expect(result.existingPageHidden).toBe(true);
  });

  // =========================================================================
  // 22. Stale onPress subscriptions don't corrupt prior-host TC state.
  //     A tab moved A → B carries an A-side onPress subscription that fires
  //     when clicked in B; the defensive parent-check in
  //     TabControl.onTabPressed must short-circuit before A mutates its
  //     own current selection or hides one of A's local pages.
  // =========================================================================

  test('22 — clicking a moved tab does not touch its previous TC state', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      // A: holds T1 (current) + T2.
      const dockA = new G.DockBase(canvas);
      dockA.setBounds(0, 0, 400, 300);
      const tcA = dockA.getLeft().getTabControl();
      const t1 = tcA.addPage('T1');
      const t2 = tcA.addPage('T2');
      (tcA as any).onTabPressed(t1);

      // B: empty new dock; we'll move T2 there.
      const dockB = new G.DockBase(canvas);
      dockB.setBounds(0, 0, 200, 200);

      const pkg = {
        name: 'TabButtonMove', userdata: null, draggable: true,
        drawcontrol: t2, holdoffset: { x: 0, y: 0 },
      };
      dockB.dragAndDrop_HandleDrop(pkg, 5, 100); // near left → creates B.left

      // Before clicking: A has T1 current and T1's page visible.
      const beforeA = {
        cur: tcA.getCurrentButton() === t1,
        t1Hidden: t1.getPage()?.hidden(),
      };

      // Now click T2 (which lives in B). The stale A-side onPress
      // subscription would fire too — without the defensive
      // parent-check, it would hide T1's page in A.
      t2.onPress.emit({
        controlCaller: t2, control: null, data: null, string: '', point: { x: 0, y: 0 }, integer: 0,
      });

      const afterA = {
        cur: tcA.getCurrentButton() === t1,
        t1Hidden: t1.getPage()?.hidden(),
      };

      dockA.dispose();
      dockB.dispose();
      return { beforeA, afterA };
    });
    // A must look identical before and after the click on B's tab.
    expect(result.afterA.cur).toBe(true);
    expect(result.afterA.t1Hidden).toBe(false);
    expect(result.beforeA).toEqual(result.afterA);
  });
});
