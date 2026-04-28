// T007 — Input router
// Tests the attachInput / Key API exported on window.Gwen.
//
// Categories covered:
//   1  Key constants
//   2  Mouse buttons
//   3  Pointer move + delta
//   4  Wheel (normal, inverse, pinch)
//   5  Keyboard known keys
//   6  keypress → inputCharacter
//   7  contextmenu preventDefault
//   8  Long-press → right-click
//   9  Long-press cancelled by movement
//  10  Touch tap → left click
//  11  Two-finger tap → right-click
//  12  pointerleave sentinel
//  13  blur cleanup
//  14  detach removes listeners
//  15  options override defaults
//  16  tabIndex set on attach
//
// Render / visual-baseline / resize categories skipped — the input router
// does not render anything and has no layout concerns.

import { test, expect } from '@playwright/test';
import { gotoDemo } from './helpers';

test.describe.configure({ mode: 'parallel' });

// ---------------------------------------------------------------------------
// Shared page bootstrap snippet — injected once per test via page.evaluate.
// Creates a 200×200 div at a fixed viewport position (top:100, left:100)
// and wires up a recording InputTarget.  Returns a helper that reads the
// recorded call log so far.
// ---------------------------------------------------------------------------

/** Call record shape returned from the browser context. */
type CallRec = { method: string; args: unknown[] };

/**
 * Setup script run inside the browser.
 * Injects:
 *   window.__div          — the 200×200 div (already in document)
 *   window.__calls        — mutable CallRec[]
 *   window.__detach       — the detach function returned by attachInput
 *   window.__attachInput  — re-exposes Gwen.attachInput for option-override tests
 *   window.__resetCalls   — clears the call log
 *
 * The element is positioned at viewport (100, 100) so:
 *   element-local x = clientX - 100
 *   element-local y = clientY - 100
 */
const SETUP_SCRIPT = `
  (() => {
    const G = window.Gwen;

    // Tear down previous run if any.
    if (window.__detach) { try { window.__detach(); } catch {} }
    if (window.__div)    { try { document.body.removeChild(window.__div); } catch {} }

    const div = document.createElement('div');
    div.style.cssText =
      'position:fixed;top:100px;left:100px;width:200px;height:200px;background:#123;';
    document.body.appendChild(div);
    window.__div = div;

    const calls = [];
    window.__calls = calls;
    window.__resetCalls = () => { calls.length = 0; };

    const target = {
      inputMouseMoved(x, y, dx, dy) { calls.push({ method:'inputMouseMoved', args:[x,y,dx,dy] }); return false; },
      inputMouseButton(btn, pressed) { calls.push({ method:'inputMouseButton', args:[btn,pressed] }); return false; },
      inputMouseWheel(val)           { calls.push({ method:'inputMouseWheel', args:[val] }); return false; },
      inputKey(key, pressed)         { calls.push({ method:'inputKey', args:[key,pressed] }); return false; },
      inputCharacter(ch)             { calls.push({ method:'inputCharacter', args:[ch] }); return false; },
    };

    window.__detach = G.attachInput(div, target);
    window.__attachInput = (opts) => {
      if (window.__detach) window.__detach();
      calls.length = 0;
      window.__detach = G.attachInput(div, target, opts);
    };
  })();
`;

// Helper: setup + return the calls array reference path in evaluate.
async function setup(page: Parameters<typeof gotoDemo>[0]): Promise<void> {
  await gotoDemo(page);
  await page.evaluate(SETUP_SCRIPT);
}

/** Read the current call log from the page. */
async function getCalls(page: Parameters<typeof gotoDemo>[0]): Promise<CallRec[]> {
  return page.evaluate(() => JSON.parse(JSON.stringify((window as any).__calls)) as CallRec[]);
}

/** Filter helpers. */
function mouseButtonCalls(calls: CallRec[]): CallRec[] {
  return calls.filter(c => c.method === 'inputMouseButton');
}
function movedCalls(calls: CallRec[]): CallRec[] {
  return calls.filter(c => c.method === 'inputMouseMoved');
}
function wheelCalls(calls: CallRec[]): CallRec[] {
  return calls.filter(c => c.method === 'inputMouseWheel');
}
function keyCalls(calls: CallRec[]): CallRec[] {
  return calls.filter(c => c.method === 'inputKey');
}
function charCalls(calls: CallRec[]): CallRec[] {
  return calls.filter(c => c.method === 'inputCharacter');
}

// ===========================================================================
// 1 — Key constants
// ===========================================================================
test.describe('T007 Input router — 1 Key constants', () => {
  test.beforeEach(async ({ page }) => { await gotoDemo(page); });

  test('all Key constants have expected numeric values', async ({ page }) => {
    const key = await page.evaluate(() => (window as any).Gwen.Key as Record<string, number>);
    expect(key.Invalid).toBe(0);
    expect(key.Return).toBe(1);
    expect(key.Backspace).toBe(2);
    expect(key.Delete).toBe(3);
    expect(key.Left).toBe(4);
    expect(key.Right).toBe(5);
    expect(key.Shift).toBe(6);
    expect(key.Tab).toBe(7);
    expect(key.Space).toBe(8);
    expect(key.Home).toBe(9);
    expect(key.End).toBe(10);
    expect(key.Control).toBe(11);
    expect(key.Up).toBe(12);
    expect(key.Down).toBe(13);
    expect(key.Escape).toBe(14);
    expect(key.Alt).toBe(15);
    expect(key.Command).toBe(16);
    expect(key.Count).toBe(17);
  });
});

// ===========================================================================
// 2 — Mouse button maps directly
// ===========================================================================
test.describe('T007 Input router — 2 Mouse buttons', () => {
  test.beforeEach(async ({ page }) => { await setup(page); });

  test('left button (0) pointerdown fires inputMouseButton(0, true)', async ({ page }) => {
    await page.evaluate(() => {
      const div = (window as any).__div as HTMLElement;
      div.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true,
        button: 0, buttons: 1, pointerType: 'mouse', isPrimary: true,
        clientX: 150, clientY: 150,
      }));
    });
    const calls = await getCalls(page);
    const btn = mouseButtonCalls(calls);
    expect(btn.length).toBeGreaterThanOrEqual(1);
    expect(btn[0].args).toEqual([0, true]);
  });

  test('right button (2) fires inputMouseButton(2, true) immediately, no delay', async ({ page }) => {
    await page.evaluate(() => {
      const div = (window as any).__div as HTMLElement;
      div.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true,
        button: 2, buttons: 2, pointerType: 'mouse', isPrimary: true,
        clientX: 150, clientY: 150,
      }));
    });
    const calls = await getCalls(page);
    const btn = mouseButtonCalls(calls);
    expect(btn.length).toBeGreaterThanOrEqual(1);
    expect(btn[0].args).toEqual([2, true]);
  });
});

// ===========================================================================
// 3 — Pointer move emits inputMouseMoved with correct delta
// ===========================================================================
test.describe('T007 Input router — 3 Pointer move delta', () => {
  test.beforeEach(async ({ page }) => { await setup(page); });

  test('move after down reports element-local coords and correct delta', async ({ page }) => {
    // Element is at viewport (100, 100). clientX 110 → local x=10, clientY 110 → local y=10.
    // Then move to clientX 130, clientY 150 → local x=30, y=50. dx=20, dy=40.
    await page.evaluate(() => {
      const div = (window as any).__div as HTMLElement;
      div.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true,
        button: 0, buttons: 1, pointerType: 'mouse', isPrimary: true,
        clientX: 110, clientY: 110,
      }));
      div.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true, cancelable: true,
        button: -1, buttons: 1, pointerType: 'mouse', isPrimary: true,
        clientX: 130, clientY: 150,
      }));
    });
    const calls = await getCalls(page);
    const moved = movedCalls(calls);
    expect(moved.length).toBeGreaterThanOrEqual(1);
    const last = moved[moved.length - 1];
    expect(last.args).toEqual([30, 50, 20, 40]);
  });
});

// ===========================================================================
// 4 — Wheel
// ===========================================================================
test.describe('T007 Input router — 4 Wheel', () => {
  test.beforeEach(async ({ page }) => { await setup(page); });

  test('deltaY 120 → inputMouseWheel(-60)', async ({ page }) => {
    await page.evaluate(() => {
      const div = (window as any).__div as HTMLElement;
      div.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true, cancelable: true,
        deltaY: 120, deltaMode: 0,
      }));
    });
    const calls = await getCalls(page);
    const w = wheelCalls(calls);
    expect(w.length).toBe(1);
    expect(w[0].args).toEqual([-60]);
  });

  test('deltaY -120 → inputMouseWheel(+60)', async ({ page }) => {
    await page.evaluate(() => {
      const div = (window as any).__div as HTMLElement;
      div.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true, cancelable: true,
        deltaY: -120, deltaMode: 0,
      }));
    });
    const calls = await getCalls(page);
    const w = wheelCalls(calls);
    expect(w.length).toBe(1);
    expect(w[0].args).toEqual([60]);
  });

  test('wheel with ctrlKey (pinch) does NOT call inputMouseWheel', async ({ page }) => {
    await page.evaluate(() => {
      const div = (window as any).__div as HTMLElement;
      div.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true, cancelable: true,
        deltaY: 120, deltaMode: 0,
        ctrlKey: true,
      }));
    });
    const calls = await getCalls(page);
    const w = wheelCalls(calls);
    expect(w.length).toBe(0);
  });
});

// ===========================================================================
// 5 — Keyboard — known keys emit inputKey
// ===========================================================================
test.describe('T007 Input router — 5 Keyboard known keys', () => {
  test.beforeEach(async ({ page }) => { await setup(page); });

  test('keydown Enter fires inputKey(1, true)', async ({ page }) => {
    await page.evaluate(() => {
      const div = (window as any).__div as HTMLElement;
      div.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }));
    });
    const calls = await getCalls(page);
    const k = keyCalls(calls);
    expect(k.length).toBeGreaterThanOrEqual(1);
    expect(k[0].args).toEqual([1, true]);
  });

  test('keyup Enter fires inputKey(1, false)', async ({ page }) => {
    await page.evaluate(() => {
      const div = (window as any).__div as HTMLElement;
      div.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Enter' }));
    });
    const calls = await getCalls(page);
    const k = keyCalls(calls);
    expect(k.length).toBeGreaterThanOrEqual(1);
    expect(k[0].args).toEqual([1, false]);
  });

  test('keydown F5 (unmapped) does NOT call inputKey', async ({ page }) => {
    await page.evaluate(() => {
      const div = (window as any).__div as HTMLElement;
      div.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'F5' }));
    });
    const calls = await getCalls(page);
    const k = keyCalls(calls);
    expect(k.length).toBe(0);
  });
});

// ===========================================================================
// 6 — keypress → inputCharacter
// ===========================================================================
test.describe('T007 Input router — 6 keypress to inputCharacter', () => {
  test.beforeEach(async ({ page }) => { await setup(page); });

  test("keypress 'a' fires inputCharacter('a')", async ({ page }) => {
    await page.evaluate(() => {
      const div = (window as any).__div as HTMLElement;
      div.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, cancelable: true, key: 'a' }));
    });
    const calls = await getCalls(page);
    const ch = charCalls(calls);
    expect(ch.length).toBeGreaterThanOrEqual(1);
    expect(ch[0].args).toEqual(['a']);
  });

  test("keypress 'Enter' (length > 1) does NOT call inputCharacter", async ({ page }) => {
    await page.evaluate(() => {
      const div = (window as any).__div as HTMLElement;
      div.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, cancelable: true, key: 'Enter' }));
    });
    const calls = await getCalls(page);
    const ch = charCalls(calls);
    expect(ch.length).toBe(0);
  });
});

// ===========================================================================
// 7 — contextmenu is preventDefault'd
// ===========================================================================
test.describe('T007 Input router — 7 contextmenu preventDefault', () => {
  test.beforeEach(async ({ page }) => { await setup(page); });

  test('contextmenu event is defaultPrevented', async ({ page }) => {
    const prevented = await page.evaluate(() => {
      const div = (window as any).__div as HTMLElement;
      const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 150, clientY: 150 });
      div.dispatchEvent(ev);
      return ev.defaultPrevented;
    });
    expect(prevented).toBe(true);
  });
});

// ===========================================================================
// 8 — Long-press on touch → right-click
// ===========================================================================
test.describe('T007 Input router — 8 Long-press touch right-click', () => {
  test.beforeEach(async ({ page }) => { await setup(page); });

  test('600ms touch hold fires inputMouseButton(2, true)', async ({ page }) => {
    // Dispatch pointerdown (touch), wait 600ms in the browser event loop, then check calls.
    await page.evaluate(() => {
      const div = (window as any).__div as HTMLElement;
      div.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true,
        pointerId: 1, button: 0, buttons: 1,
        pointerType: 'touch', isPrimary: true,
        clientX: 150, clientY: 150,
      }));
    });
    // Wait longer than the default 500ms long-press threshold.
    await page.waitForTimeout(600);
    const calls = await getCalls(page);
    const btn = mouseButtonCalls(calls);
    expect(btn.some(c => c.args[0] === 2 && c.args[1] === true)).toBe(true);
    // Left-down must NOT have fired.
    expect(btn.some(c => c.args[0] === 0 && c.args[1] === true)).toBe(false);
  });

  test('pointerup after long-press fires inputMouseButton(2, false)', async ({ page }) => {
    await page.evaluate(() => {
      const div = (window as any).__div as HTMLElement;
      div.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true,
        pointerId: 1, button: 0, buttons: 1,
        pointerType: 'touch', isPrimary: true,
        clientX: 150, clientY: 150,
      }));
    });
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      const div = (window as any).__div as HTMLElement;
      div.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true, cancelable: true,
        pointerId: 1, button: 0, buttons: 0,
        pointerType: 'touch', isPrimary: true,
        clientX: 150, clientY: 150,
      }));
    });
    const calls = await getCalls(page);
    const btn = mouseButtonCalls(calls);
    // Right up must appear after right down.
    const rightDown = btn.findIndex(c => c.args[0] === 2 && c.args[1] === true);
    const rightUp   = btn.findIndex(c => c.args[0] === 2 && c.args[1] === false);
    expect(rightDown).toBeGreaterThanOrEqual(0);
    expect(rightUp).toBeGreaterThan(rightDown);
  });
});

// ===========================================================================
// 9 — Long-press cancelled by movement
// ===========================================================================
test.describe('T007 Input router — 9 Long-press cancelled by move', () => {
  test.beforeEach(async ({ page }) => { await setup(page); });

  test('move > slop cancels long-press; no right-click after remaining wait', async ({ page }) => {
    await page.evaluate(() => {
      const div = (window as any).__div as HTMLElement;
      div.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true,
        pointerId: 1, button: 0, buttons: 1,
        pointerType: 'touch', isPrimary: true,
        clientX: 150, clientY: 150,
      }));
    });
    // 100ms later, move >10px slop.
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      const div = (window as any).__div as HTMLElement;
      div.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true, cancelable: true,
        pointerId: 1, button: -1, buttons: 1,
        pointerType: 'touch', isPrimary: true,
        clientX: 150, clientY: 180, // 30px > 10px slop
      }));
    });
    // Wait well past the 500ms threshold.
    await page.waitForTimeout(500);
    const calls = await getCalls(page);
    const btn = mouseButtonCalls(calls);
    expect(btn.some(c => c.args[0] === 2 && c.args[1] === true)).toBe(false);
  });

  test('pointerup after cancelled long-press emits left click sequence', async ({ page }) => {
    await page.evaluate(() => {
      const div = (window as any).__div as HTMLElement;
      div.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true,
        pointerId: 1, button: 0, buttons: 1,
        pointerType: 'touch', isPrimary: true,
        clientX: 150, clientY: 150,
      }));
    });
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      const div = (window as any).__div as HTMLElement;
      div.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true, cancelable: true,
        pointerId: 1, button: -1, buttons: 1,
        pointerType: 'touch', isPrimary: true,
        clientX: 150, clientY: 180,
      }));
      div.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true, cancelable: true,
        pointerId: 1, button: 0, buttons: 0,
        pointerType: 'touch', isPrimary: true,
        clientX: 150, clientY: 180,
      }));
    });
    const calls = await getCalls(page);
    const btn = mouseButtonCalls(calls);
    // Left-down appears (emitted retroactively on move), then left-up on pointerup.
    expect(btn.some(c => c.args[0] === 0 && c.args[1] === true)).toBe(true);
    expect(btn.some(c => c.args[0] === 0 && c.args[1] === false)).toBe(true);
    const leftDown = btn.findIndex(c => c.args[0] === 0 && c.args[1] === true);
    const leftUp   = btn.findIndex(c => c.args[0] === 0 && c.args[1] === false);
    expect(leftUp).toBeGreaterThan(leftDown);
  });
});

// ===========================================================================
// 10 — Touch tap (no long-press) emits left click
// ===========================================================================
test.describe('T007 Input router — 10 Touch tap left click', () => {
  test.beforeEach(async ({ page }) => { await setup(page); });

  test('quick tap emits left down then left up, no right-click', async ({ page }) => {
    await page.evaluate(() => {
      const div = (window as any).__div as HTMLElement;
      div.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true,
        pointerId: 1, button: 0, buttons: 1,
        pointerType: 'touch', isPrimary: true,
        clientX: 200, clientY: 200,
      }));
    });
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      const div = (window as any).__div as HTMLElement;
      div.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true, cancelable: true,
        pointerId: 1, button: 0, buttons: 0,
        pointerType: 'touch', isPrimary: true,
        clientX: 200, clientY: 200,
      }));
    });
    const calls = await getCalls(page);
    const btn = mouseButtonCalls(calls);
    expect(btn.some(c => c.args[0] === 0 && c.args[1] === true)).toBe(true);
    expect(btn.some(c => c.args[0] === 0 && c.args[1] === false)).toBe(true);
    // Order: down before up.
    const leftDown = btn.findIndex(c => c.args[0] === 0 && c.args[1] === true);
    const leftUp   = btn.findIndex(c => c.args[0] === 0 && c.args[1] === false);
    expect(leftUp).toBeGreaterThan(leftDown);
    // No right-click calls.
    expect(btn.some(c => c.args[0] === 2)).toBe(false);
  });
});

// ===========================================================================
// 11 — Two-finger tap → right-click
// ===========================================================================
test.describe('T007 Input router — 11 Two-finger tap right-click', () => {
  test.beforeEach(async ({ page }) => { await setup(page); });

  test('second touch while first is down emits right-down', async ({ page }) => {
    await page.evaluate(() => {
      const div = (window as any).__div as HTMLElement;
      // First finger down.
      div.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true,
        pointerId: 1, button: 0, buttons: 1,
        pointerType: 'touch', isPrimary: true,
        clientX: 150, clientY: 150,
      }));
      // Second finger down immediately.
      div.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true,
        pointerId: 2, button: 0, buttons: 1,
        pointerType: 'touch', isPrimary: false,
        clientX: 200, clientY: 200,
      }));
    });
    const calls = await getCalls(page);
    const btn = mouseButtonCalls(calls);
    expect(btn.some(c => c.args[0] === 2 && c.args[1] === true)).toBe(true);
  });

  test('right-up only fires after last finger lifts', async ({ page }) => {
    await page.evaluate(() => {
      const div = (window as any).__div as HTMLElement;
      div.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true,
        pointerId: 1, button: 0, buttons: 1,
        pointerType: 'touch', isPrimary: true,
        clientX: 150, clientY: 150,
      }));
      div.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true,
        pointerId: 2, button: 0, buttons: 1,
        pointerType: 'touch', isPrimary: false,
        clientX: 200, clientY: 200,
      }));
    });
    const callsAfterDown = await getCalls(page);
    const btnAfterDown = mouseButtonCalls(callsAfterDown);
    expect(btnAfterDown.some(c => c.args[0] === 2 && c.args[1] === false)).toBe(false);

    // Lift first finger — right-up should NOT fire yet.
    await page.evaluate(() => {
      const div = (window as any).__div as HTMLElement;
      div.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true, cancelable: true,
        pointerId: 1, button: 0, buttons: 0,
        pointerType: 'touch', isPrimary: true,
        clientX: 150, clientY: 150,
      }));
    });
    const callsAfterFirst = await getCalls(page);
    const btnAfterFirst = mouseButtonCalls(callsAfterFirst);
    expect(btnAfterFirst.some(c => c.args[0] === 2 && c.args[1] === false)).toBe(false);

    // Lift second finger — right-up fires now.
    await page.evaluate(() => {
      const div = (window as any).__div as HTMLElement;
      div.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true, cancelable: true,
        pointerId: 2, button: 0, buttons: 0,
        pointerType: 'touch', isPrimary: false,
        clientX: 200, clientY: 200,
      }));
    });
    const callsFinal = await getCalls(page);
    const btnFinal = mouseButtonCalls(callsFinal);
    const rightDown = btnFinal.findIndex(c => c.args[0] === 2 && c.args[1] === true);
    const rightUp   = btnFinal.findIndex(c => c.args[0] === 2 && c.args[1] === false);
    expect(rightDown).toBeGreaterThanOrEqual(0);
    expect(rightUp).toBeGreaterThan(rightDown);
  });
});

// ===========================================================================
// 12 — pointerleave emits synthetic off-canvas mouseMove(-1,-1,0,0)
// ===========================================================================
test.describe('T007 Input router — 12 pointerleave sentinel', () => {
  test.beforeEach(async ({ page }) => { await setup(page); });

  test('pointerleave fires inputMouseMoved(-1, -1, 0, 0)', async ({ page }) => {
    // First establish a prevX/Y by doing a move so the delta is deterministic.
    await page.evaluate(() => {
      const div = (window as any).__div as HTMLElement;
      // Seed prevX/prevY to -1 via a leave and re-enter, or simply fire leave directly
      // and let it hardcode -1,-1,0,0 from the initial prevX=0,prevY=0 position.
      // The implementation hardcodes the sentinel values directly; it does not compute delta.
      div.dispatchEvent(new PointerEvent('pointerleave', {
        bubbles: false, cancelable: false,
        pointerType: 'mouse', isPrimary: true,
        clientX: 150, clientY: 150,
      }));
    });
    const calls = await getCalls(page);
    const moved = movedCalls(calls);
    expect(moved.length).toBeGreaterThanOrEqual(1);
    const last = moved[moved.length - 1];
    expect(last.args).toEqual([-1, -1, 0, 0]);
  });
});

// ===========================================================================
// 13 — blur cleanup releases pressed buttons and keys
// ===========================================================================
test.describe('T007 Input router — 13 blur cleanup', () => {
  test.beforeEach(async ({ page }) => { await setup(page); });

  test('blur after mouse down fires inputMouseButton(0, false)', async ({ page }) => {
    await page.evaluate(() => {
      const div = (window as any).__div as HTMLElement;
      div.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true,
        button: 0, buttons: 1, pointerType: 'mouse', isPrimary: true,
        clientX: 150, clientY: 150,
      }));
      div.dispatchEvent(new FocusEvent('blur', { bubbles: false }));
    });
    const calls = await getCalls(page);
    const btn = mouseButtonCalls(calls);
    // There should be a down(0,true) followed by a cleanup up(0,false).
    expect(btn.some(c => c.args[0] === 0 && c.args[1] === false)).toBe(true);
  });

  test('blur after keydown fires inputKey(key, false) for each held key', async ({ page }) => {
    await page.evaluate(() => {
      const div = (window as any).__div as HTMLElement;
      div.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }));
      div.dispatchEvent(new FocusEvent('blur', { bubbles: false }));
    });
    const calls = await getCalls(page);
    const k = keyCalls(calls);
    // down(1,true) then up(1,false) from blur.
    const keyDown = k.findIndex(c => c.args[0] === 1 && c.args[1] === true);
    const keyUp   = k.findIndex(c => c.args[0] === 1 && c.args[1] === false);
    expect(keyDown).toBeGreaterThanOrEqual(0);
    expect(keyUp).toBeGreaterThan(keyDown);
  });
});

// ===========================================================================
// 14 — detach removes all listeners
// ===========================================================================
test.describe('T007 Input router — 14 detach removes listeners', () => {
  test.beforeEach(async ({ page }) => { await setup(page); });

  test('no events reach target after detach', async ({ page }) => {
    await page.evaluate(() => {
      // Detach first.
      (window as any).__detach();
      // Then fire a pointer move.
      const div = (window as any).__div as HTMLElement;
      div.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true, cancelable: true,
        button: -1, buttons: 0, pointerType: 'mouse', isPrimary: true,
        clientX: 150, clientY: 150,
      }));
    });
    const calls = await getCalls(page);
    expect(movedCalls(calls).length).toBe(0);
  });

  test('detach: no button events after remove', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__detach();
      const div = (window as any).__div as HTMLElement;
      div.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true,
        button: 0, buttons: 1, pointerType: 'mouse', isPrimary: true,
        clientX: 150, clientY: 150,
      }));
    });
    const calls = await getCalls(page);
    expect(mouseButtonCalls(calls).length).toBe(0);
  });
});

// ===========================================================================
// 15 — options override defaults (longPressMs / longPressSlopPx)
// ===========================================================================
test.describe('T007 Input router — 15 Options override', () => {
  test.beforeEach(async ({ page }) => { await setup(page); });

  test('longPressMs:200 fires right-click at 250ms', async ({ page }) => {
    // Re-attach with custom options.
    await page.evaluate(() => {
      (window as any).__attachInput({ longPressMs: 200, longPressSlopPx: 50 });
    });
    await page.evaluate(() => {
      const div = (window as any).__div as HTMLElement;
      div.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true,
        pointerId: 1, button: 0, buttons: 1,
        pointerType: 'touch', isPrimary: true,
        clientX: 150, clientY: 150,
      }));
    });
    await page.waitForTimeout(250);
    const calls = await getCalls(page);
    const btn = mouseButtonCalls(calls);
    expect(btn.some(c => c.args[0] === 2 && c.args[1] === true)).toBe(true);
  });

  test('longPressSlopPx:50 — 30px move does NOT cancel long-press', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__attachInput({ longPressMs: 200, longPressSlopPx: 50 });
    });
    await page.evaluate(() => {
      const div = (window as any).__div as HTMLElement;
      div.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true,
        pointerId: 1, button: 0, buttons: 1,
        pointerType: 'touch', isPrimary: true,
        clientX: 150, clientY: 150,
      }));
      // 30px move — within the 50px custom slop.
      div.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true, cancelable: true,
        pointerId: 1, button: -1, buttons: 1,
        pointerType: 'touch', isPrimary: true,
        clientX: 150, clientY: 180,
      }));
    });
    await page.waitForTimeout(250);
    const calls = await getCalls(page);
    const btn = mouseButtonCalls(calls);
    // Timer was NOT cancelled by the small move, so right-down should have fired.
    expect(btn.some(c => c.args[0] === 2 && c.args[1] === true)).toBe(true);
  });
});

// ===========================================================================
// 16 — tabIndex is set on attach
// ===========================================================================
test.describe('T007 Input router — 16 tabIndex', () => {
  test.beforeEach(async ({ page }) => { await gotoDemo(page); });

  test('attachInput sets tabIndex >= 0 on element that had tabIndex < 0', async ({ page }) => {
    const tabIndex = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const div = document.createElement('div');
      // Ensure it starts with a negative tabIndex (default for non-interactive elements).
      div.tabIndex = -1;
      document.body.appendChild(div);
      const before = div.tabIndex;
      G.attachInput(div, {
        inputMouseMoved: () => false,
        inputMouseButton: () => false,
        inputMouseWheel: () => false,
        inputKey: () => false,
        inputCharacter: () => false,
      });
      const after = div.tabIndex;
      document.body.removeChild(div);
      return { before, after };
    });
    expect(tabIndex.before).toBe(-1);
    expect(tabIndex.after).toBeGreaterThanOrEqual(0);
  });
});
