// T001 — Structures
// Tests pure-logic factory functions and arithmetic helpers exported on window.Gwen.
// Categories skipped: Render (no DOM), Visual baseline (no canvas output),
//   State visuals, Pointer input, Touch input, Keyboard, Resize — none apply to
//   pure value types.

import { test, expect } from '@playwright/test';
import { gotoDemo } from './helpers';

test.describe.configure({ mode: 'parallel' });

// ---------------------------------------------------------------------------
// Helpers — type aliases used by page.evaluate return values
// ---------------------------------------------------------------------------

type Pt  = { x: number; y: number };
type Mg  = { left: number; top: number; right: number; bottom: number };
type Rc  = { x: number; y: number; w: number; h: number };
type Cl  = { r: number; g: number; b: number; a: number };
type Hv  = { h: number; s: number; v: number };

// ---------------------------------------------------------------------------
// T001.1 — point
// ---------------------------------------------------------------------------

test.describe('T001 Structures — point', () => {
  test.beforeEach(async ({ page }) => { await gotoDemo(page); });

  test('default args produce {x:0, y:0}', async ({ page }) => {
    const p = await page.evaluate(() => (window as any).Gwen.point() as { x: number; y: number });
    expect(p).toEqual({ x: 0, y: 0 });
  });

  test('explicit args are stored correctly', async ({ page }) => {
    const p = await page.evaluate(() => (window as any).Gwen.point(3, 7) as Pt);
    expect(p).toEqual({ x: 3, y: 7 });
  });

  test('addPoint returns sum of both components', async ({ page }) => {
    const r = await page.evaluate(() => {
      const G = (window as any).Gwen;
      return G.addPoint(G.point(1, 2), G.point(10, 20)) as Pt;
    });
    expect(r).toEqual({ x: 11, y: 22 });
  });

  test('addPoint is commutative (catches GWEN y-swap bug not replicated)', async ({ page }) => {
    const same = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const a = G.point(3, 7);
      const b = G.point(5, 2);
      const ab = G.addPoint(a, b);
      const ba = G.addPoint(b, a);
      return ab.x === ba.x && ab.y === ba.y;
    });
    expect(same).toBe(true);
  });

  test('subPoint returns difference', async ({ page }) => {
    const r = await page.evaluate(() => {
      const G = (window as any).Gwen;
      return G.subPoint(G.point(10, 20), G.point(3, 7)) as Pt;
    });
    expect(r).toEqual({ x: 7, y: 13 });
  });

  test('addPointInPlace mutates the first argument', async ({ page }) => {
    const r = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const a = G.point(1, 2);
      G.addPointInPlace(a, G.point(4, 6));
      return a as Pt;
    });
    expect(r).toEqual({ x: 5, y: 8 });
  });

  test('subPointInPlace mutates the first argument', async ({ page }) => {
    const r = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const a = G.point(10, 20);
      G.subPointInPlace(a, G.point(3, 5));
      return a as Pt;
    });
    expect(r).toEqual({ x: 7, y: 15 });
  });

  test('clonePoint returns a distinct object with equal fields', async ({ page }) => {
    const r = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const orig = G.point(4, 9);
      const clone = G.clonePoint(orig);
      clone.x = 999; // mutate clone — original must not change
      return { origX: orig.x, cloneX: clone.x, equalFields: orig.x === 4 };
    });
    expect(r.equalFields).toBe(true);
    expect(r.origX).toBe(4);
    expect(r.cloneX).toBe(999);
  });

  test('setPoint mutates the target object', async ({ page }) => {
    const r = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const p = G.point(0, 0);
      G.setPoint(p, 7, 13);
      return p as Pt;
    });
    expect(r).toEqual({ x: 7, y: 13 });
  });
});

// ---------------------------------------------------------------------------
// T001.2 — margin
// ---------------------------------------------------------------------------

test.describe('T001 Structures — margin', () => {
  test.beforeEach(async ({ page }) => { await gotoDemo(page); });

  test('default args produce all-zero margin', async ({ page }) => {
    const m = await page.evaluate(() => (window as any).Gwen.margin() as Mg);
    expect(m).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
  });

  test('constructor order (left, top, right, bottom) is preserved', async ({ page }) => {
    const m = await page.evaluate(() => (window as any).Gwen.margin(1, 2, 3, 4) as Mg);
    expect(m.left).toBe(1);
    expect(m.top).toBe(2);
    expect(m.right).toBe(3);
    expect(m.bottom).toBe(4);
  });

  test('addMargin sums all four fields', async ({ page }) => {
    const r = await page.evaluate(() => {
      const G = (window as any).Gwen;
      return G.addMargin(G.margin(1, 2, 3, 4), G.margin(10, 20, 30, 40)) as Mg;
    });
    expect(r).toEqual({ left: 11, top: 22, right: 33, bottom: 44 });
  });

  test('cloneMargin returns distinct object with equal fields', async ({ page }) => {
    const r = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const orig = G.margin(5, 6, 7, 8);
      const clone = G.cloneMargin(orig);
      clone.left = 999;
      return { origLeft: orig.left, equal: orig.left === 5 };
    });
    expect(r.equal).toBe(true);
    expect(r.origLeft).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// T001.3 — rect
// ---------------------------------------------------------------------------

test.describe('T001 Structures — rect', () => {
  test.beforeEach(async ({ page }) => { await gotoDemo(page); });

  test('default args produce all-zero rect', async ({ page }) => {
    const r = await page.evaluate(() => (window as any).Gwen.rect() as Rc);
    expect(r).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });

  test('explicit args stored correctly', async ({ page }) => {
    const r = await page.evaluate(() => (window as any).Gwen.rect(1, 2, 10, 20) as Rc);
    expect(r).toEqual({ x: 1, y: 2, w: 10, h: 20 });
  });

  test('addRect sums all four fields', async ({ page }) => {
    const r = await page.evaluate(() => {
      const G = (window as any).Gwen;
      return G.addRect(G.rect(1, 2, 3, 4), G.rect(10, 20, 30, 40)) as Rc;
    });
    expect(r).toEqual({ x: 11, y: 22, w: 33, h: 44 });
  });

  test('cloneRect returns distinct object with equal fields', async ({ page }) => {
    const r = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const orig = G.rect(5, 6, 7, 8);
      const clone = G.cloneRect(orig);
      clone.x = 999;
      return { origX: orig.x, equal: orig.x === 5 };
    });
    expect(r.equal).toBe(true);
    expect(r.origX).toBe(5);
  });

  test('rectEquals returns true for identical rects', async ({ page }) => {
    const same = await page.evaluate(() => {
      const G = (window as any).Gwen;
      return G.rectEquals(G.rect(1, 2, 3, 4), G.rect(1, 2, 3, 4));
    });
    expect(same).toBe(true);
  });

  test('rectEquals returns false when any field differs', async ({ page }) => {
    const results = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const base = G.rect(1, 2, 3, 4);
      return [
        G.rectEquals(base, G.rect(9, 2, 3, 4)),
        G.rectEquals(base, G.rect(1, 9, 3, 4)),
        G.rectEquals(base, G.rect(1, 2, 9, 4)),
        G.rectEquals(base, G.rect(1, 2, 3, 9)),
      ] as boolean[];
    });
    expect(results).toEqual([false, false, false, false]);
  });

  test('rectLeft returns x', async ({ page }) => {
    const v = await page.evaluate(() => (window as any).Gwen.rectLeft((window as any).Gwen.rect(5, 10, 20, 30)));
    expect(v).toBe(5);
  });

  test('rectTop returns y', async ({ page }) => {
    const v = await page.evaluate(() => (window as any).Gwen.rectTop((window as any).Gwen.rect(5, 10, 20, 30)));
    expect(v).toBe(10);
  });

  test('rectRight returns x + w', async ({ page }) => {
    const v = await page.evaluate(() => (window as any).Gwen.rectRight((window as any).Gwen.rect(5, 10, 20, 30)));
    expect(v).toBe(25);
  });

  test('rectBottom returns y + h', async ({ page }) => {
    const v = await page.evaluate(() => (window as any).Gwen.rectBottom((window as any).Gwen.rect(5, 10, 20, 30)));
    expect(v).toBe(40);
  });

  test('rectSize returns Point {x: w, y: h}', async ({ page }) => {
    const s = await page.evaluate(() => (window as any).Gwen.rectSize((window as any).Gwen.rect(5, 10, 20, 30)) as Pt);
    expect(s).toEqual({ x: 20, y: 30 });
  });
});

// ---------------------------------------------------------------------------
// T001.4 — hsv
// ---------------------------------------------------------------------------

test.describe('T001 Structures — hsv', () => {
  test.beforeEach(async ({ page }) => { await gotoDemo(page); });

  test('default args produce {h:0, s:0, v:0}', async ({ page }) => {
    const h = await page.evaluate(() => (window as any).Gwen.hsv() as Hv);
    expect(h).toEqual({ h: 0, s: 0, v: 0 });
  });

  test('explicit args stored correctly', async ({ page }) => {
    const h = await page.evaluate(() => (window as any).Gwen.hsv(180, 0.5, 0.75) as Hv);
    expect(h).toEqual({ h: 180, s: 0.5, v: 0.75 });
  });
});

// ---------------------------------------------------------------------------
// T001.5 — color
// ---------------------------------------------------------------------------

test.describe('T001 Structures — color', () => {
  test.beforeEach(async ({ page }) => { await gotoDemo(page); });

  test('default is opaque white {r:255, g:255, b:255, a:255}', async ({ page }) => {
    const c = await page.evaluate(() => (window as any).Gwen.color() as Cl);
    expect(c).toEqual({ r: 255, g: 255, b: 255, a: 255 });
  });

  test('explicit args stored correctly', async ({ page }) => {
    const c = await page.evaluate(() => (window as any).Gwen.color(10, 20, 30, 40) as Cl);
    expect(c).toEqual({ r: 10, g: 20, b: 30, a: 40 });
  });

  test('addColor clamps to 255 on overflow', async ({ page }) => {
    const c = await page.evaluate(() => {
      const G = (window as any).Gwen;
      return G.addColor(G.color(200, 200, 200, 200), G.color(100, 100, 100, 100)) as Cl;
    });
    expect(c).toEqual({ r: 255, g: 255, b: 255, a: 255 });
  });

  test('addColor without overflow sums correctly', async ({ page }) => {
    const c = await page.evaluate(() => {
      const G = (window as any).Gwen;
      return G.addColor(G.color(10, 20, 30, 40), G.color(1, 2, 3, 4)) as Cl;
    });
    expect(c).toEqual({ r: 11, g: 22, b: 33, a: 44 });
  });

  test('subColor clamps to 0 on underflow', async ({ page }) => {
    const c = await page.evaluate(() => {
      const G = (window as any).Gwen;
      return G.subColor(G.color(10, 10, 10, 10), G.color(200, 200, 200, 200)) as Cl;
    });
    expect(c).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  test('subColor without underflow subtracts correctly', async ({ page }) => {
    const c = await page.evaluate(() => {
      const G = (window as any).Gwen;
      return G.subColor(G.color(100, 80, 60, 40), G.color(10, 20, 30, 5)) as Cl;
    });
    expect(c).toEqual({ r: 90, g: 60, b: 30, a: 35 });
  });

  test('scaleColor(color(100,100,100,100), 0.5) returns {r:50,g:50,b:50,a:50}', async ({ page }) => {
    const c = await page.evaluate(() => {
      const G = (window as any).Gwen;
      return G.scaleColor(G.color(100, 100, 100, 100), 0.5) as Cl;
    });
    expect(c).toEqual({ r: 50, g: 50, b: 50, a: 50 });
  });

  test('scaleColor clamps to 255 when factor > 1 causes overflow', async ({ page }) => {
    const c = await page.evaluate(() => {
      const G = (window as any).Gwen;
      return G.scaleColor(G.color(100, 100, 100, 100), 5) as Cl;
    });
    expect(c).toEqual({ r: 255, g: 255, b: 255, a: 255 });
  });

  test('colorEquals returns true for identical colors', async ({ page }) => {
    const same = await page.evaluate(() => {
      const G = (window as any).Gwen;
      return G.colorEquals(G.color(10, 20, 30, 40), G.color(10, 20, 30, 40));
    });
    expect(same).toBe(true);
  });

  test('colorEquals returns false when any channel differs', async ({ page }) => {
    const results = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const base = G.color(10, 20, 30, 40);
      return [
        G.colorEquals(base, G.color(99, 20, 30, 40)),
        G.colorEquals(base, G.color(10, 99, 30, 40)),
        G.colorEquals(base, G.color(10, 20, 99, 40)),
        G.colorEquals(base, G.color(10, 20, 30, 99)),
      ] as boolean[];
    });
    expect(results).toEqual([false, false, false, false]);
  });

  test('cloneColor returns distinct object with equal channels', async ({ page }) => {
    const r = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const orig = G.color(10, 20, 30, 40);
      const clone = G.cloneColor(orig);
      clone.r = 999;
      return { origR: orig.r, equal: orig.r === 10 };
    });
    expect(r.equal).toBe(true);
    expect(r.origR).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// T001.6 — CursorType
// ---------------------------------------------------------------------------

test.describe('T001 Structures — CursorType', () => {
  test.beforeEach(async ({ page }) => { await gotoDemo(page); });

  test('all named values have expected numbers', async ({ page }) => {
    const ct = await page.evaluate(() => (window as any).Gwen.CursorType as Record<string, number>);
    expect(ct.Normal).toBe(0);
    expect(ct.Beam).toBe(1);
    expect(ct.SizeNS).toBe(2);
    expect(ct.SizeWE).toBe(3);
    expect(ct.SizeNWSE).toBe(4);
    expect(ct.SizeNESW).toBe(5);
    expect(ct.SizeAll).toBe(6);
    expect(ct.No).toBe(7);
    expect(ct.Wait).toBe(8);
    expect(ct.Finger).toBe(9);
    expect(ct.Count).toBe(10);
  });

  test('CursorType.Count === 10', async ({ page }) => {
    const count = await page.evaluate(() => (window as any).Gwen.CursorType.Count as number);
    expect(count).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// T001.7 — dragAndDropPackage
// ---------------------------------------------------------------------------

test.describe('T001 Structures — dragAndDropPackage', () => {
  test.beforeEach(async ({ page }) => { await gotoDemo(page); });

  test('factory returns expected defaults', async ({ page }) => {
    const pkg = await page.evaluate(() => (window as any).Gwen.dragAndDropPackage() as {
      name: string; userdata: unknown; draggable: boolean; drawcontrol: unknown; holdoffset: Pt;
    });
    expect(pkg.name).toBe('');
    expect(pkg.userdata).toBeNull();
    expect(pkg.draggable).toBe(false);
    expect(pkg.drawcontrol).toBeNull();
    expect(pkg.holdoffset).toEqual({ x: 0, y: 0 });
  });
});
