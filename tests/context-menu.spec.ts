// Context menus — right-click handling on `Base.setContextMenu`.
//
// Categories:
//   1  API           — set / get / clear via setContextMenu
//   2  Right-click   — pressing button=2 over a control with a menu opens it
//   3  Bubbling      — a child without a menu defers to its parent's menu
//   4  Global        — Canvas-level menu fires when nothing in the chain has one
//   5  Override hook — onContextMenuRequest can return a dynamic Menu
//   6  Cancellation  — returning null bubbles further; only one menu shows
//   7  Reparent      — menu parented elsewhere is auto-reparented to canvas

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('Context menu', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. setContextMenu / getContextMenu round-trip; clearing returns null.
  // =========================================================================

  test('1 — setContextMenu / getContextMenu / clear round-trip', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const ctrl = new G.Base(canvas);
      const before = ctrl.getContextMenu();
      const menu = new G.Menu(canvas);
      ctrl.setContextMenu(menu);
      const afterSet = ctrl.getContextMenu() === menu;
      ctrl.setContextMenu(null);
      const afterClear = ctrl.getContextMenu();
      ctrl.dispose();
      return { before, afterSet, afterClear };
    });
    expect(result.before).toBeNull();
    expect(result.afterSet).toBe(true);
    expect(result.afterClear).toBeNull();
  });

  // =========================================================================
  // 2. Right-clicking a control with a context menu opens it at the cursor.
  // =========================================================================

  test('2 — right-click opens the control\'s context menu at the cursor position', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const target = new G.Base(canvas);
      target.setBounds(10, 10, 200, 200);
      target.setMouseInputEnabled(true);

      const menu = new G.Menu(canvas);
      menu.addItem('Cut');
      menu.addItem('Copy');
      menu.addItem('Paste');
      target.setContextMenu(menu);

      const cx = 50, cy = 50;
      canvas.inputMouseMoved(cx, cy, 0, 0);
      canvas.inputMouseButton(2, true);
      canvas.inputMouseButton(2, false);

      const r = {
        visible: !menu.hidden(),
        atX: menu.x(),
        atY: menu.y(),
      };
      target.dispose();
      menu.dispose();
      return r;
    });
    expect(result.visible).toBe(true);
    expect(result.atX).toBe(50);
    expect(result.atY).toBe(50);
  });

  // =========================================================================
  // 3. Bubbling: a child without its own menu defers to the parent's menu.
  // =========================================================================

  test('3 — child without context menu bubbles up to the parent\'s menu', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const parent = new G.Base(canvas);
      parent.setBounds(0, 0, 300, 300);
      parent.setMouseInputEnabled(true);
      const child = new G.Base(parent);
      child.setBounds(10, 10, 100, 100);
      child.setMouseInputEnabled(true);

      const parentMenu = new G.Menu(canvas);
      parentMenu.addItem('Parent action');
      parent.setContextMenu(parentMenu);

      // Right-click in the child's area.
      canvas.inputMouseMoved(40, 40, 0, 0);
      canvas.inputMouseButton(2, true);
      canvas.inputMouseButton(2, false);

      const r = { parentMenuShown: !parentMenu.hidden() };
      parent.dispose();
      parentMenu.dispose();
      return r;
    });
    expect(result.parentMenuShown).toBe(true);
  });

  // =========================================================================
  // 4. Canvas-level global: nothing in the chain has a menu, canvas does.
  //     The global fires on right-click anywhere there's no override.
  // =========================================================================

  test('4 — canvas global context menu opens when no chain control overrides', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const globalMenu = new G.Menu(canvas);
      globalMenu.addItem('Global option');
      canvas.setContextMenu(globalMenu);

      // Right-click at a coordinate inside both desktop (1280×800) and
      // mobile (iPhone 13 ~390×844) canvases. The walk bubbles through
      // whichever demo control catches the hit and lands on the canvas
      // itself, which carries the global menu.
      canvas.inputMouseMoved(200, 400, 0, 0);
      canvas.inputMouseButton(2, true);
      canvas.inputMouseButton(2, false);

      const visible = !globalMenu.hidden();
      // Cleanup.
      canvas.setContextMenu(null);
      globalMenu.dispose();
      return visible;
    });
    expect(result).toBe(true);
  });

  // =========================================================================
  // 5. onContextMenuRequest override: a control can build menus dynamically
  //    or return a different menu than the stored one.
  // =========================================================================

  test('5 — onContextMenuRequest override returns a dynamic menu', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const dynamicMenu = new G.Menu(canvas);
      dynamicMenu.addItem('From hook');

      const target = new G.Base(canvas);
      target.setBounds(10, 10, 200, 200);
      target.setMouseInputEnabled(true);
      // Override the hook directly on the instance.
      (target as any).onContextMenuRequest = () => dynamicMenu;

      canvas.inputMouseMoved(50, 50, 0, 0);
      canvas.inputMouseButton(2, true);
      canvas.inputMouseButton(2, false);

      const visible = !dynamicMenu.hidden();
      target.dispose();
      dynamicMenu.dispose();
      return visible;
    });
    expect(result).toBe(true);
  });

  // =========================================================================
  // 6. A null return from a control's hook bubbles up; the parent's menu
  //    wins. Confirms the chain walk doesn't stop on the first control.
  // =========================================================================

  test('6 — null from inner hook bubbles to outer parent\'s menu', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const parent = new G.Base(canvas);
      parent.setBounds(0, 0, 300, 300);
      parent.setMouseInputEnabled(true);
      const child = new G.Base(parent);
      child.setBounds(10, 10, 100, 100);
      child.setMouseInputEnabled(true);
      // Child explicitly returns null — defers to parent.
      (child as any).onContextMenuRequest = () => null;

      const parentMenu = new G.Menu(canvas);
      parentMenu.addItem('Parent');
      parent.setContextMenu(parentMenu);

      canvas.inputMouseMoved(40, 40, 0, 0);
      canvas.inputMouseButton(2, true);
      canvas.inputMouseButton(2, false);

      const r = { visible: !parentMenu.hidden() };
      parent.dispose();
      parentMenu.dispose();
      return r;
    });
    expect(result.visible).toBe(true);
  });

  // =========================================================================
  // 7. Auto-reparenting: a menu created with a non-canvas parent is
  //    moved onto the canvas when shown so it draws above everything.
  // =========================================================================

  test('7 — menu created with non-canvas parent is auto-reparented to canvas', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const target = new G.Base(canvas);
      target.setBounds(10, 10, 200, 200);
      target.setMouseInputEnabled(true);

      // Create the menu parented to `target` (the wrong place — clipped
      // to target's bounds and drawn beneath siblings).
      const menu = new G.Menu(target);
      menu.addItem('Item');
      target.setContextMenu(menu);

      canvas.inputMouseMoved(50, 50, 0, 0);
      canvas.inputMouseButton(2, true);
      canvas.inputMouseButton(2, false);

      const r = {
        visible: !menu.hidden(),
        parentIsCanvas: menu.parent === canvas,
      };
      target.dispose();
      menu.dispose();
      return r;
    });
    expect(result.visible).toBe(true);
    expect(result.parentIsCanvas).toBe(true);
  });

  // =========================================================================
  // 8. No menu anywhere — right-click is a no-op (just passes through to
  //    the existing onMouseClickRight hooks). Sanity check that the new
  //    chain walk doesn't throw or produce visual artefacts.
  // =========================================================================

  test('8 — no menu in the chain: right-click passes through cleanly', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      // Make sure canvas has no global menu (the demo doesn't set one,
      // but be explicit for the test).
      canvas.setContextMenu(null);
      const target = new G.Base(canvas);
      target.setBounds(10, 10, 100, 100);
      target.setMouseInputEnabled(true);

      let threw = false;
      try {
        canvas.inputMouseMoved(40, 40, 0, 0);
        canvas.inputMouseButton(2, true);
        canvas.inputMouseButton(2, false);
      } catch {
        threw = true;
      }
      target.dispose();
      return threw;
    });
    expect(result).toBe(false);
  });
});
