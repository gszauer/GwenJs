// T010 — Canvas root control
//
// Categories covered:
//   1  Render           — #13 visual baseline screenshot
//   2  Visual baseline  — #13 slate-background default.png
//   3  State visuals    — N/A: Canvas has no hover/pressed/disabled/focused visual state
//   4  Pointer input    — #14–19 mouse routing via inputMouseMoved / inputMouseButton
//   5  Touch input      — Skipped: Canvas routes touch through the same inputMouse* path as
//                         mouse (the router normalises them before they reach Canvas). Touch
//                         gesture tests live in T007 (input-router.spec.ts).
//   6  Keyboard         — #20–25 focus, inputKey, key-repeat, inputCharacter
//   7  Events           — #16–17 onHoverEnter / onHoverLeave signals
//   8  Resize           — #33 canvas.setBounds triggers child layout invalidation

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

// ---------------------------------------------------------------------------
// Before-each: load demo and wait for the first rAF frame to complete.
// This guarantees gwenCanvas is alive and the initial redraw has been consumed.
// ---------------------------------------------------------------------------

test.describe('T010 Canvas', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // Construction + invariants
  // =========================================================================

  test('1 — window.gwenCanvas is defined and is a Canvas instance', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const c = (window as any).gwenCanvas;
      return {
        defined: c !== null && c !== undefined,
        isCanvas: c instanceof G.Canvas,
        isBase: c instanceof G.Base,
      };
    });
    expect(result.defined).toBe(true);
    expect(result.isCanvas).toBe(true);
    expect(result.isBase).toBe(true);
  });

  test('2 — getCanvas() returns itself', async ({ page }) => {
    const result = await page.evaluate(() => {
      const c = (window as any).gwenCanvas;
      return c.getCanvas() === c;
    });
    expect(result).toBe(true);
  });

  test('3 — parent is null (canvas is the root)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const c = (window as any).gwenCanvas;
      return c.parent;
    });
    expect(result).toBeNull();
  });

  test('4 — default scale is 1.0', async ({ page }) => {
    const scale = await page.evaluate(() => (window as any).gwenCanvas.getScale());
    expect(scale).toBe(1.0);
  });

  test('5 — drawBackground true, backgroundColor is (122,144,144,255)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const c = (window as any).gwenCanvas;
      return {
        drawBackground: c._drawBackground,
        bg: { ...c._backgroundColor },
      };
    });
    expect(result.drawBackground).toBe(true);
    expect(result.bg).toEqual({ r: 122, g: 144, b: 144, a: 255 });
  });

  test('6 — bounds match the HTML canvas CSS size', async ({ page }) => {
    const result = await page.evaluate(() => {
      const c = (window as any).gwenCanvas;
      const el = (window as any).gwenCanvas.htmlCanvas as HTMLCanvasElement;
      const bounds = c.getBounds();
      return {
        boundsW: bounds.w,
        boundsH: bounds.h,
        cssW: el.clientWidth,
        cssH: el.clientHeight,
      };
    });
    expect(result.boundsW).toBe(result.cssW);
    expect(result.boundsH).toBe(result.cssH);
  });

  // =========================================================================
  // needsRedraw / redraw
  // =========================================================================

  test('7 — after the first rAF loop, isRedrawNeeded() is false', async ({ page }) => {
    // Wait for a second rAF frame so the initial redraw set in demo/main.ts has
    // been consumed by renderCanvas().
    await page.evaluate(() => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
    const needed = await page.evaluate(() => (window as any).gwenCanvas.isRedrawNeeded());
    expect(needed).toBe(false);
  });

  test('8 — redraw() sets isRedrawNeeded(); consumed after next rAF', async ({ page }) => {
    // Drain current dirty state.
    await page.evaluate(() => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))));

    const afterRedraw = await page.evaluate(() => {
      (window as any).gwenCanvas.redraw();
      return (window as any).gwenCanvas.isRedrawNeeded();
    });
    expect(afterRedraw).toBe(true);

    // Let the loop consume it.
    await page.evaluate(() => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
    const afterFrame = await page.evaluate(() => (window as any).gwenCanvas.isRedrawNeeded());
    expect(afterFrame).toBe(false);
  });

  // =========================================================================
  // setScale / getScale
  // =========================================================================

  test('9 — setScale(2.0) updates getScale and triggers redraw', async ({ page }) => {
    // Drain dirty first.
    await page.evaluate(() => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))));

    const result = await page.evaluate(() => {
      const c = (window as any).gwenCanvas;
      c.setScale(2.0);
      return { scale: c.getScale(), redrawNeeded: c.isRedrawNeeded() };
    });
    expect(result.scale).toBe(2.0);
    expect(result.redrawNeeded).toBe(true);

    // Restore.
    await page.evaluate(() => (window as any).gwenCanvas.setScale(1.0));
  });

  test('10 — setScale same value twice does not trigger a second redraw', async ({ page }) => {
    // Move to scale=2 so we can test no-op at that value.
    await page.evaluate(() => (window as any).gwenCanvas.setScale(2.0));
    // Drain.
    await page.evaluate(() => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))));

    const noOp = await page.evaluate(() => {
      const c = (window as any).gwenCanvas;
      c.setScale(2.0); // second call with same value
      return c.isRedrawNeeded();
    });
    expect(noOp).toBe(false);

    // Restore.
    await page.evaluate(() => (window as any).gwenCanvas.setScale(1.0));
  });

  // =========================================================================
  // setDrawBackground / setBackgroundColor
  // =========================================================================

  test('11 — setDrawBackground(false) updates the internal flag', async ({ page }) => {
    await page.evaluate(() => (window as any).gwenCanvas.setDrawBackground(false));
    const val = await page.evaluate(() => (window as any).gwenCanvas._drawBackground);
    expect(val).toBe(false);
    // Restore.
    await page.evaluate(() => (window as any).gwenCanvas.setDrawBackground(true));
  });

  test('12 — setBackgroundColor updates _backgroundColor', async ({ page }) => {
    await page.evaluate(() => {
      const G = (window as any).Gwen;
      (window as any).gwenCanvas.setBackgroundColor(G.color(200, 100, 50, 255));
    });
    const bg = await page.evaluate(() => ({ ...(window as any).gwenCanvas._backgroundColor }));
    expect(bg).toEqual({ r: 200, g: 100, b: 50, a: 255 });
    // Restore original slate color.
    await page.evaluate(() => {
      const G = (window as any).Gwen;
      (window as any).gwenCanvas.setBackgroundColor(G.color(122, 144, 144, 255));
    });
  });

  // =========================================================================
  // Visual baseline — slate-colored canvas background
  // =========================================================================

  test('13 — visual baseline: slate background fills the canvas', async ({ page }) => {
    // Let the rAF loop paint at least one frame after setup.
    await page.evaluate(() => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
    await expect(page.locator('#gwen-canvas')).toHaveScreenshot('canvas-default.png', {
      maxDiffPixelRatio: 0.02,
    });
  });

  // =========================================================================
  // Input routing — mouse moved updates hoveredControl
  // =========================================================================

  test('14 — inputMouseMoved over child sets hoveredControl to that child', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const child = new G.Base(canvas);
      child.setBounds(100, 100, 80, 50);
      // Run one layout pass so the child is in the tree.
      canvas.inputMouseMoved(120, 120, 0, 0);
      const isChild = canvas.hoveredControl === child;
      // Cleanup.
      child.dispose();
      return isChild;
    });
    expect(result).toBe(true);
  });

  test('15 — moving mouse off a child detaches hoveredControl from it', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const child = new G.Base(canvas);
      child.setBounds(100, 100, 80, 50);
      canvas.inputMouseMoved(120, 120, 0, 0); // onto child
      const hoveredOn = canvas.hoveredControl === child;
      // Move far off. With the demo populated, hover may land on another
      // control (e.g. the sidebar) rather than strictly null — the invariant
      // we test is that it's no longer `child`.
      canvas.inputMouseMoved(5, 5, -115, -115);
      const stillChild = canvas.hoveredControl === child;
      child.dispose();
      return { hoveredOn, stillChild };
    });
    expect(result.hoveredOn).toBe(true);
    expect(result.stillChild).toBe(false);
  });

  // =========================================================================
  // Input routing — onHoverEnter / onHoverLeave signals
  // =========================================================================

  test('16 — onHoverEnter fires when mouse moves onto child', async ({ page }) => {
    const fired = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const child = new G.Base(canvas);
      child.setBounds(100, 100, 80, 50);

      let enterCount = 0;
      child.onHoverEnter.on(() => { enterCount++; });

      // Move away first to ensure hoveredControl is null.
      canvas.inputMouseMoved(5, 5, 0, 0);
      // Then move onto the child.
      canvas.inputMouseMoved(120, 120, 115, 115);

      child.dispose();
      return enterCount;
    });
    expect(fired).toBeGreaterThanOrEqual(1);
  });

  test('17 — onHoverLeave fires when mouse moves off child', async ({ page }) => {
    const leaveCount = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const child = new G.Base(canvas);
      child.setBounds(100, 100, 80, 50);

      let count = 0;
      child.onHoverLeave.on(() => { count++; });

      canvas.inputMouseMoved(120, 120, 0, 0); // onto child
      canvas.inputMouseMoved(5, 5, -115, -115); // off child

      child.dispose();
      return count;
    });
    expect(leaveCount).toBeGreaterThanOrEqual(1);
  });

  // =========================================================================
  // Input routing — inputMouseButton dispatches to hovered control
  // =========================================================================

  test('18 — inputMouseButton dispatches click to hovered child', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const calls: string[] = [];
      const child = new G.Base(canvas);
      child.setBounds(100, 100, 80, 50);
      // Monkey-patch the instance to record calls.
      child.onMouseClickLeft = (x: number, y: number, pressed: boolean) => {
        calls.push(`click ${pressed} ${x} ${y}`);
      };

      canvas.inputMouseMoved(120, 120, 0, 0); // hover over child
      canvas.inputMouseButton(0, true);        // left press
      canvas.inputMouseButton(0, false);       // left release

      child.dispose();
      return calls;
    });
    // Should see at least 'click true' and 'click false'.
    expect(result.some((s: string) => s.includes('click true'))).toBe(true);
    expect(result.some((s: string) => s.includes('click false'))).toBe(true);
  });

  test('19 — double-click at same position triggers onMouseDoubleClickLeft', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const calls: string[] = [];
      const child = new G.Base(canvas);
      child.setBounds(100, 100, 80, 50);
      child.onMouseDoubleClickLeft = (x: number, y: number) => {
        calls.push(`dblclick ${x} ${y}`);
      };
      child.onMouseClickLeft = (_x: number, _y: number, pressed: boolean) => {
        calls.push(`click ${pressed}`);
      };

      canvas.inputMouseMoved(120, 120, 0, 0);

      // First click — sets lastClickTime.
      canvas.inputMouseButton(0, true);
      canvas.inputMouseButton(0, false);

      // Second click at same position, immediately — within 500ms → double-click.
      canvas.inputMouseButton(0, true);

      child.dispose();
      return calls;
    });
    expect(result.some((s: string) => s.includes('dblclick'))).toBe(true);
  });

  // =========================================================================
  // Input routing — inputKey + focus
  // =========================================================================

  test('20 — focus() sets keyboardFocus to child', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const child = new G.Base(canvas);
      child.setKeyboardInputEnabled(true);
      child.focus();
      const focused = canvas.keyboardFocus === child;
      child.blur();
      child.dispose();
      return focused;
    });
    expect(result).toBe(true);
  });

  test('21 — inputKey(Return, true) sets keyState[Return] to true', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const child = new G.Base(canvas);
      child.setKeyboardInputEnabled(true);
      child.focus();

      const Key = G.Key;
      canvas.inputKey(Key.Return, true);
      const state = canvas.keyState[Key.Return];

      canvas.inputKey(Key.Return, false);
      child.blur();
      child.dispose();
      return state;
    });
    expect(result).toBe(true);
  });

  test('22 — key-repeat: past keyNextRepeat fires onKeyPress again in doThink()', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const calls: string[] = [];
      const child = new G.Base(canvas);
      child.onKeyPress = (k: number, pressed: boolean): boolean => {
        calls.push(`key ${k} ${pressed}`);
        return true;
      };
      child.setKeyboardInputEnabled(true);
      child.focus();

      const Key = G.Key;
      // Press Return to arm keyState.
      canvas.inputKey(Key.Return, true);
      // Fast-forward keyNextRepeat to a past timestamp.
      canvas.keyNextRepeat[Key.Return] = performance.now() / 1000 - 1;
      // doThink() should fire the repeat.
      canvas.doThink();

      canvas.inputKey(Key.Return, false);
      child.blur();
      child.dispose();
      return calls;
    });
    // The initial press + at least one synthetic repeat.
    const returnPresses = result.filter(s => s.includes('true'));
    expect(returnPresses.length).toBeGreaterThanOrEqual(2);
  });

  test('23 — inputKey(Return, false) sets keyState[Return] to false', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const child = new G.Base(canvas);
      child.setKeyboardInputEnabled(true);
      child.focus();

      const Key = G.Key;
      canvas.inputKey(Key.Return, true);
      canvas.inputKey(Key.Return, false);
      const state = canvas.keyState[Key.Return];

      child.blur();
      child.dispose();
      return state;
    });
    expect(result).toBe(false);
  });

  // =========================================================================
  // Input routing — inputCharacter
  // =========================================================================

  test('24 — inputCharacter routes printable char to keyboardFocus.onChar', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const received: string[] = [];
      const child = new G.Base(canvas);
      child.onChar = (ch: string): boolean => {
        received.push(ch);
        return true;
      };
      child.setKeyboardInputEnabled(true);
      child.focus();

      canvas.inputCharacter('a');

      child.blur();
      child.dispose();
      return received;
    });
    expect(result).toContain('a');
  });

  test('25 — inputCharacter filters non-printable (control char)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      const received: string[] = [];
      const child = new G.Base(canvas);
      child.onChar = (ch: string): boolean => {
        received.push(ch);
        return true;
      };
      child.setKeyboardInputEnabled(true);
      child.focus();

      canvas.inputCharacter('\x01'); // control char — codePoint < 0x20

      child.blur();
      child.dispose();
      return received;
    });
    expect(result.length).toBe(0);
  });

  // =========================================================================
  // Delayed delete
  // =========================================================================

  test('26 — addDelayedDelete does not immediately dispose the control', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const child = new G.Base(canvas);
      child.setBounds(0, 0, 50, 50);

      canvas.addDelayedDelete(child);

      // Not yet disposed: parent reference still intact.
      const parentStillSet = child.parent === canvas;
      return parentStillSet;
    });
    expect(result).toBe(true);
  });

  test('27 — after doThink(), delayed-deleted child is disposed (parent is null)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const child = new G.Base(canvas);
      child.setBounds(0, 0, 50, 50);

      canvas.addDelayedDelete(child);
      canvas.doThink();

      // After think, dispose() was called → parent set to null.
      return child.parent;
    });
    expect(result).toBeNull();
  });

  test('28 — duplicate addDelayedDelete is a no-op (does not double-dispose)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      let disposeCount = 0;
      const child = new G.Base(canvas);
      const origDispose = child.dispose.bind(child);
      child.dispose = () => {
        disposeCount++;
        origDispose();
      };
      canvas.addDelayedDelete(child);
      canvas.addDelayedDelete(child); // duplicate — should be ignored by the Set
      canvas.doThink();

      return disposeCount;
    });
    expect(result).toBe(1);
  });

  // =========================================================================
  // Modifier queries
  // =========================================================================

  test('29 — isControlDown() true while Control is held', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      canvas.inputKey(G.Key.Control, true);
      const down = canvas.isControlDown();
      canvas.inputKey(G.Key.Control, false);
      return down;
    });
    expect(result).toBe(true);
  });

  test('30 — isControlDown() false after releasing Control', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      canvas.inputKey(G.Key.Control, true);
      canvas.inputKey(G.Key.Control, false);
      return canvas.isControlDown();
    });
    expect(result).toBe(false);
  });

  test('31 — isShiftDown() and isAltDown() track Shift and Alt keys', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      canvas.inputKey(G.Key.Shift, true);
      const shiftDown = canvas.isShiftDown();
      canvas.inputKey(G.Key.Shift, false);
      const shiftUp = canvas.isShiftDown();

      canvas.inputKey(G.Key.Alt, true);
      const altDown = canvas.isAltDown();
      canvas.inputKey(G.Key.Alt, false);
      const altUp = canvas.isAltDown();

      return { shiftDown, shiftUp, altDown, altUp };
    });
    expect(result.shiftDown).toBe(true);
    expect(result.shiftUp).toBe(false);
    expect(result.altDown).toBe(true);
    expect(result.altUp).toBe(false);
  });

  // =========================================================================
  // findKeyboardFocus — climbs to nearest keyboard-enabled ancestor
  // =========================================================================

  test('32 — click on leaf focuses nearest keyboard-enabled ancestor', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;

      // Build chain: parent (keyboard enabled) > mid (not enabled) > leaf (not enabled).
      const parent = new G.Base(canvas);
      parent.setBounds(50, 50, 200, 200);
      parent.setKeyboardInputEnabled(true);

      const mid = new G.Base(parent);
      mid.setBounds(10, 10, 100, 100);

      const leaf = new G.Base(mid);
      leaf.setBounds(5, 5, 40, 40);

      // Hover over leaf (canvas-local coords: 50+10+5+10=75,75 as center of leaf).
      canvas.inputMouseMoved(75, 75, 0, 0);
      // Simulate left press — triggers findKeyboardFocus walk.
      canvas.inputMouseButton(0, true);

      const focusedIsParent = canvas.keyboardFocus === parent;

      canvas.inputMouseButton(0, false);
      parent.dispose();
      return focusedIsParent;
    });
    expect(result).toBe(true);
  });

  // =========================================================================
  // Resize
  // =========================================================================

  test('33 — setBounds invalidates children layout', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const child = new G.Base(canvas);
      child.setBounds(0, 0, 50, 50);

      // Run layout to clear needsLayout.
      canvas.doThink();
      const before = child.needsLayout();

      // Resize canvas — onBoundsChanged calls invalidateChildren.
      const oldBounds = canvas.getBounds();
      canvas.setBounds(0, 0, oldBounds.w + 100, oldBounds.h);
      const after = child.needsLayout();

      // Restore.
      canvas.setBounds(0, 0, oldBounds.w, oldBounds.h);
      child.dispose();
      return { before, after };
    });
    expect(result.before).toBe(false);
    expect(result.after).toBe(true);
  });

  // =========================================================================
  // dispose cleanup
  // =========================================================================

  test('34 — disposing a second Canvas does not throw', async ({ page }) => {
    const threw = await page.evaluate(async () => {
      const G = (window as any).Gwen;
      try {
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = 100;
        tmpCanvas.height = 100;
        document.body.appendChild(tmpCanvas);

        const renderer = new G.WebGL2Renderer(tmpCanvas, { devicePixelRatio: 1 });
        renderer.init();
        const skin = new G.Skin(renderer);
        skin.init();
        const c2 = new G.Canvas(skin, tmpCanvas);
        c2.setBounds(0, 0, 100, 100);

        // Dispose — input listeners should be detached cleanly.
        c2.dispose();
        document.body.removeChild(tmpCanvas);
        return false;
      } catch (e) {
        return String(e);
      }
    });
    expect(threw).toBe(false);
  });

  test('34b — after dispose, _detachInput is null (listeners detached)', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const G = (window as any).Gwen;
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = 100;
      tmpCanvas.height = 100;
      document.body.appendChild(tmpCanvas);

      const renderer = new G.WebGL2Renderer(tmpCanvas, { devicePixelRatio: 1 });
      renderer.init();
      const skin = new G.Skin(renderer);
      skin.init();
      const c2 = new G.Canvas(skin, tmpCanvas);
      c2.setBounds(0, 0, 100, 100);
      c2.dispose();
      document.body.removeChild(tmpCanvas);

      return c2._detachInput;
    });
    expect(result).toBeNull();
  });
});
