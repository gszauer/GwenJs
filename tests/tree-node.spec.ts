// T206 — TreeNode
//
// Categories covered:
//   1  Render         — #10 render produces pixels
//   2  Visual baseline — Skipped: GPU/skin variance
//   3  State visuals   — Skipped: selection highlight is skin-drawn; no separate pixel test
//   4  Pointer input   — #8 double-click title toggles open/close
//   5  Touch input     — N/A: same path as pointer via canvas input
//   6  Keyboard        — N/A: TreeNode has no key handlers
//   7  Events          — #4 onSelect/onSelectChange fire; #5 deselectAll propagates
//   8  Resize          — N/A

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T206 TreeNode', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction: no children, toggle hidden
  // =========================================================================

  test('1 — new TreeNode: no children; toggle button hidden; not open', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const node = new G.TreeNode(canvas);
        canvas.doThink();
        const childCount = node.getChildNodes().length;
        const toggleHidden = node._toggleButton.hidden();
        const isOpen = node.isOpen();
        node.dispose();
        return { threw: false, childCount, toggleHidden, isOpen };
      } catch {
        return { threw: true, childCount: -1, toggleHidden: false, isOpen: false };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.childCount).toBe(0);
    expect(result.toggleHidden).toBe(true);
    expect(result.isOpen).toBe(false);
  });

  // =========================================================================
  // 2. addNode('child1') — returns TreeNode; toggle visible after layout
  // =========================================================================

  test('2 — addNode creates child TreeNode; toggle button becomes visible', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const node = new G.TreeNode(canvas);
      const child = node.addNode('child1');
      canvas.doThink();
      const isTreeNode = child instanceof G.TreeNode;
      const childCount = node.getChildNodes().length;
      const toggleVisible = !node._toggleButton.hidden();
      node.dispose();
      return { isTreeNode, childCount, toggleVisible };
    });
    expect(result.isTreeNode).toBe(true);
    expect(result.childCount).toBe(1);
    expect(result.toggleVisible).toBe(true);
  });

  // =========================================================================
  // 3. open() / close() / toggle() / isOpen()
  // =========================================================================

  test('3 — open/close/toggle/isOpen state machine', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const node = new G.TreeNode(canvas);
      node.addNode('c1');

      const initial = node.isOpen();
      node.open();
      const afterOpen = node.isOpen();
      node.close();
      const afterClose = node.isOpen();
      node.toggle();
      const afterToggleOpen = node.isOpen();
      node.toggle();
      const afterToggleClose = node.isOpen();

      node.dispose();
      return { initial, afterOpen, afterClose, afterToggleOpen, afterToggleClose };
    });
    expect(result.initial).toBe(false);
    expect(result.afterOpen).toBe(true);
    expect(result.afterClose).toBe(false);
    expect(result.afterToggleOpen).toBe(true);
    expect(result.afterToggleClose).toBe(false);
  });

  // =========================================================================
  // 4. setSelected(true) fires onSelect + onSelectChange
  // =========================================================================

  test('4 — setSelected(true) fires onSelect and onSelectChange', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const node = new G.TreeNode(canvas);

      let selectCount = 0;
      let changeCount = 0;
      let callerOk = false;
      node.onSelect.on((ev: any) => {
        selectCount++;
        callerOk = ev.controlCaller === node;
      });
      node.onSelectChange.on(() => { changeCount++; });

      node.setSelected(true);
      const selected = node.isSelected();
      node.dispose();
      return { selectCount, changeCount, selected, callerOk };
    });
    expect(result.selectCount).toBe(1);
    expect(result.changeCount).toBe(1);
    expect(result.selected).toBe(true);
    expect(result.callerOk).toBe(true);
  });

  // =========================================================================
  // 5. deselectAll recursively unselects
  // =========================================================================

  test('5 — deselectAll() unselects node and all descendants', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const root = new G.TreeNode(canvas);
      const child = root.addNode('child');
      const grandchild = child.addNode('grandchild');

      root.setSelected(true, false);
      child.setSelected(true, false);
      grandchild.setSelected(true, false);

      root.deselectAll();

      const rootSel = root.isSelected();
      const childSel = child.isSelected();
      const grandSel = grandchild.isSelected();
      root.dispose();
      return { rootSel, childSel, grandSel };
    });
    expect(result.rootSel).toBe(false);
    expect(result.childSel).toBe(false);
    expect(result.grandSel).toBe(false);
  });

  // =========================================================================
  // 6. expandAll opens all descendants
  // =========================================================================

  test('6 — expandAll opens root and all descendant nodes', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const root = new G.TreeNode(canvas);
      const child = root.addNode('child');
      child.addNode('grandchild');

      root.expandAll();

      const rootOpen = root.isOpen();
      const childOpen = child.isOpen();
      root.dispose();
      return { rootOpen, childOpen };
    });
    expect(result.rootOpen).toBe(true);
    expect(result.childOpen).toBe(true);
  });

  // =========================================================================
  // 7. setSelectable(false): setSelected(true) does nothing
  // =========================================================================

  test('7 — setSelectable(false): setSelected(true) does not select', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const node = new G.TreeNode(canvas);
      node.setSelectable(false);

      let fired = 0;
      node.onSelect.on(() => { fired++; });
      node.setSelected(true);

      const selected = node.isSelected();
      node.dispose();
      return { selected, fired };
    });
    expect(result.selected).toBe(false);
    expect(result.fired).toBe(0);
  });

  // =========================================================================
  // 8. Double-click title toggles open/close (only when children exist)
  // =========================================================================

  test('8 — double-click title toggles open when node has children; no-op otherwise', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const nodeWithChild = new G.TreeNode(canvas);
      nodeWithChild.addNode('c');

      const nodeEmpty = new G.TreeNode(canvas);

      // Trigger double-click on the title button.
      nodeWithChild._title.onDoubleClick.emit({ controlCaller: nodeWithChild._title });
      const openAfterDbl = nodeWithChild.isOpen();

      nodeEmpty._title.onDoubleClick.emit({ controlCaller: nodeEmpty._title });
      const emptyOpen = nodeEmpty.isOpen();

      nodeWithChild.dispose();
      nodeEmpty.dispose();
      return { openAfterDbl, emptyOpen };
    });
    // node with children should open; empty node should stay closed.
    expect(result.openAfterDbl).toBe(true);
    expect(result.emptyOpen).toBe(false);
  });

  // =========================================================================
  // 9. getChildNodes returns inner-panel children
  // =========================================================================

  test('9 — getChildNodes() returns array of added child nodes', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const node = new G.TreeNode(canvas);
      node.addNode('a');
      node.addNode('b');
      node.addNode('c');
      const count = node.getChildNodes().length;
      node.dispose();
      return count;
    });
    expect(result).toBe(3);
  });

  // =========================================================================
  // 10. Render produces pixels
  // =========================================================================

  test('10 — TreeNode render produces non-background pixels', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const G = (window as any).Gwen;

      const htmlC = document.createElement('canvas');
      htmlC.width = 200; htmlC.height = 100;
      document.body.appendChild(htmlC);
      const renderer = new G.WebGL2Renderer(htmlC, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const cvs = new G.Canvas(skin, htmlC);
      cvs.setBounds(0, 0, 200, 100);
      cvs.setDrawBackground(true);
      cvs.setBackgroundColor(G.color(0, 0, 0, 255));

      const node = new G.TreeNode(cvs);
      node.setBounds(5, 5, 190, 20);
      node.setText('Root');
      node.addNode('Child1');

      cvs.doThink();
      cvs.redraw();
      cvs.renderCanvas();

      const gl: WebGL2RenderingContext = renderer.gl;
      const pixels = new Uint8Array(200 * 100 * 4);
      gl.readPixels(0, 0, 200, 100, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

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
