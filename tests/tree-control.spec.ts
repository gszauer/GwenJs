// T207 — TreeControl
//
// Categories covered:
//   1  Render          — #8 render produces non-background pixels
//   2  Visual baseline — Skipped: GPU/skin variance makes stable goldens impractical
//   3  State visuals   — #5 deselects others on new click; #4 multiSelect keeps prior
//   4  Pointer input   — #4 Ctrl-held keeps selection (via onNodeSelected); #5 without multi clears
//   5  Touch input     — N/A: same code path as pointer
//   6  Keyboard        — N/A: TreeControl has no custom key handlers
//   7  Events          — #4 onNamePress propagation via onNodeSelected
//   8  Resize          — N/A: scrollControl fills via Pos.Fill; layout is automatic

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T207 TreeControl', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction: isRoot true; scrollControl child; button hidden
  // =========================================================================

  test('1 — construction: isRoot true; scroll control present; title button hidden', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const tc = new G.TreeControl(canvas);
        const isRoot = tc.isRoot();
        const hasScroller = tc.getScroller() !== null;
        const buttonHidden = tc.getButton().hidden();
        tc.dispose();
        return { threw: false, isRoot, hasScroller, buttonHidden };
      } catch {
        return { threw: true, isRoot: false, hasScroller: false, buttonHidden: false };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.isRoot).toBe(true);
    expect(result.hasScroller).toBe(true);
    expect(result.buttonHidden).toBe(true);
  });

  // =========================================================================
  // 2. addNode('A') returns TreeNode as child of scrollControl's innerPanel
  // =========================================================================

  test('2 — addNode returns TreeNode; lives in scrollControl innerPanel', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tc = new G.TreeControl(canvas);
      const node = tc.addNode('Alpha');
      const isTreeNode = node instanceof G.TreeNode;
      const text = node.getText();
      const scroller = tc.getScroller();
      const inner = scroller.getInnerPanel();
      const nodeInInner = inner ? inner.children.includes(node) : false;
      tc.dispose();
      return { isTreeNode, text, nodeInInner };
    });
    expect(result.isTreeNode).toBe(true);
    expect(result.text).toBe('Alpha');
    expect(result.nodeInInner).toBe(true);
  });

  // =========================================================================
  // 3. Nested node.addNode('B') creates grandchild of the node
  // =========================================================================

  test('3 — nested addNode creates grandchildren on the parent node', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tc = new G.TreeControl(canvas);
      const parent = tc.addNode('Parent');
      const child = parent.addNode('Child');
      const isTreeNode = child instanceof G.TreeNode;
      const childText = child.getText();
      const parentChildCount = parent.getChildNodes().length;
      tc.dispose();
      return { isTreeNode, childText, parentChildCount };
    });
    expect(result.isTreeNode).toBe(true);
    expect(result.childText).toBe('Child');
    expect(result.parentChildCount).toBe(1);
  });

  // =========================================================================
  // 4. setAllowMultiSelect(true) + ctrl held: multiple nodes remain selected
  // =========================================================================

  test('4 — multiSelect + ctrlHeld: second node click does not deselect first', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tc = new G.TreeControl(canvas);
      tc.setAllowMultiSelect(true);
      const n0 = tc.addNode('A');
      const n1 = tc.addNode('B');

      // Select first node.
      n0.setSelected(true, false);

      // Simulate Ctrl held on canvas so isControlDown() returns true.
      canvas.inputKey(G.Key.Control, true);

      // Click second node's title — fires onNamePress → onNodeSelected.
      // onNodeSelected will see ctrlHeld=true and skip deselectAll.
      n1._title.onPress.emit({ controlCaller: n1._title });
      // Emit onNamePress manually since title onPress handler calls setSelected+emit.
      // Actually call onClickTitle via the title's press handler — it's registered
      // in TreeNode constructor as `_title.onPress.on(() => this.onClickTitle())`.
      // Pressing the title via onPress.emit already calls onClickTitle → setSelected(true) + onNamePress.
      // TreeControl.onNodeSelected is registered on the node's onNamePress.
      // The node was already selected=false, so clicking selects it; then onNamePress fires.

      // Reset: use a cleaner path. Just directly call the node selection + emit onNamePress.
      n1.setSelected(true, false);
      const infoN1 = { controlCaller: n1 };
      // Fire onNamePress to trigger TreeControl.onNodeSelected.
      n1.onNamePress.emit(infoN1 as any);

      const n0StillSelected = n0.isSelected();
      const n1Selected = n1.isSelected();

      // Release Ctrl.
      canvas.inputKey(G.Key.Control, false);
      tc.dispose();
      return { n0StillSelected, n1Selected };
    });
    // With Ctrl held and multiSelect enabled, deselectAll is skipped.
    expect(result.n0StillSelected).toBe(true);
    expect(result.n1Selected).toBe(true);
  });

  // =========================================================================
  // 5. Without multi-select: clicking a new node deselects siblings only;
  // the clicked node remains selected. Mirrors GWEN TreeNode.cpp:209-213
  // ordering (onNamePress fires first so onNodeSelected clears siblings
  // BEFORE the clicked node's selection state is flipped).
  // =========================================================================

  test('5 — without multiSelect: clicking new node deselects siblings only; clicked node remains selected', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tc = new G.TreeControl(canvas);
      tc.setAllowMultiSelect(false);
      const n0 = tc.addNode('A');
      const n1 = tc.addNode('B');

      // Pre-select first node.
      n0.setSelected(true, false);

      // Drive n1's title press — the real click path. onClickTitle fires
      // onNamePress (triggering TreeControl.onNodeSelected → deselectAllNodesExcept(n1))
      // THEN flips n1's selection to true.
      n1._title.onPress.emit({ controlCaller: n1._title } as any);

      const n0Selected = n0.isSelected();
      const n1Selected = n1.isSelected();
      tc.dispose();
      return { n0Selected, n1Selected };
    });
    expect(result.n0Selected).toBe(false);
    expect(result.n1Selected).toBe(true);
  });

  // =========================================================================
  // 6. clear() empties scrollControl innerPanel
  // =========================================================================

  test('6 — clear empties scrollControl innerPanel children', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tc = new G.TreeControl(canvas);
      tc.addNode('A');
      tc.addNode('B');
      tc.addNode('C');

      const scroller = tc.getScroller();
      const inner = scroller.getInnerPanel();
      const before = inner ? inner.numChildren() : -1;

      tc.clear();

      const after = inner ? inner.numChildren() : -1;
      tc.dispose();
      return { before, after };
    });
    expect(result.before).toBe(3);
    expect(result.after).toBe(0);
  });

  // =========================================================================
  // 7. getScroller() returns the scroll control
  // =========================================================================

  test('7 — getScroller returns a ScrollControl instance', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const tc = new G.TreeControl(canvas);
      const scroller = tc.getScroller();
      const isScrollControl = scroller instanceof G.ScrollControl;
      tc.dispose();
      return isScrollControl;
    });
    expect(result).toBe(true);
  });

  // =========================================================================
  // 8. Render produces non-background pixels
  // =========================================================================

  test('8 — TreeControl render produces non-background pixels', async ({ page }) => {
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

      const tc = new G.TreeControl(cvs);
      tc.setBounds(5, 5, 190, 190);
      const n = tc.addNode('Root');
      n.addNode('Child A');
      n.addNode('Child B');
      n.open();

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
