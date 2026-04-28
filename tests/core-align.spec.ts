// T003 — Pos flags + Align helpers
// Tests the Pos constant object and placeBelow helper exported on window.Gwen.
// Categories skipped: Render, Visual baseline, State visuals, Pointer input,
//   Touch input, Keyboard, Resize — these are pure flag constants and a
//   stateless positioning helper with no DOM or canvas output.

import { test, expect } from '@playwright/test';
import { gotoDemo } from './helpers';

test.describe.configure({ mode: 'parallel' });

test.describe('T003 Pos + Align', () => {
  test.beforeEach(async ({ page }) => { await gotoDemo(page); });

  // 1 — Every Pos constant has the expected numeric value
  test('Pos.None === 0', async ({ page }) => {
    const v = await page.evaluate(() => (window as any).Gwen.Pos.None as number);
    expect(v).toBe(0);
  });

  test('Pos.Left === 2', async ({ page }) => {
    const v = await page.evaluate(() => (window as any).Gwen.Pos.Left as number);
    expect(v).toBe(2);
  });

  test('Pos.Right === 4', async ({ page }) => {
    const v = await page.evaluate(() => (window as any).Gwen.Pos.Right as number);
    expect(v).toBe(4);
  });

  test('Pos.Top === 8', async ({ page }) => {
    const v = await page.evaluate(() => (window as any).Gwen.Pos.Top as number);
    expect(v).toBe(8);
  });

  test('Pos.Bottom === 16', async ({ page }) => {
    const v = await page.evaluate(() => (window as any).Gwen.Pos.Bottom as number);
    expect(v).toBe(16);
  });

  test('Pos.CenterV === 32', async ({ page }) => {
    const v = await page.evaluate(() => (window as any).Gwen.Pos.CenterV as number);
    expect(v).toBe(32);
  });

  test('Pos.CenterH === 64', async ({ page }) => {
    const v = await page.evaluate(() => (window as any).Gwen.Pos.CenterH as number);
    expect(v).toBe(64);
  });

  test('Pos.Fill === 128', async ({ page }) => {
    const v = await page.evaluate(() => (window as any).Gwen.Pos.Fill as number);
    expect(v).toBe(128);
  });

  test('Pos.Center === 96', async ({ page }) => {
    const v = await page.evaluate(() => (window as any).Gwen.Pos.Center as number);
    expect(v).toBe(96);
  });

  // 2 — Pos.Center equals bitwise OR of CenterV and CenterH
  test('Pos.Center === (Pos.CenterV | Pos.CenterH)', async ({ page }) => {
    const match = await page.evaluate(() => {
      const Pos = (window as any).Gwen.Pos;
      return Pos.Center === (Pos.CenterV | Pos.CenterH);
    });
    expect(match).toBe(true);
  });

  // 3 — Bitwise OR combinations
  test('Pos.Left | Pos.Top === 10', async ({ page }) => {
    const v = await page.evaluate(() => {
      const Pos = (window as any).Gwen.Pos;
      return Pos.Left | Pos.Top;
    });
    expect(v).toBe(10);
  });

  test('Pos.Right | Pos.Bottom === 20', async ({ page }) => {
    const v = await page.evaluate(() => {
      const Pos = (window as any).Gwen.Pos;
      return Pos.Right | Pos.Bottom;
    });
    expect(v).toBe(20);
  });

  test('Pos.Left | Pos.CenterV === 34', async ({ page }) => {
    const v = await page.evaluate(() => {
      const Pos = (window as any).Gwen.Pos;
      return Pos.Left | Pos.CenterV;
    });
    expect(v).toBe(34);
  });

  test('Pos.Fill | Pos.Bottom === 144', async ({ page }) => {
    const v = await page.evaluate(() => {
      const Pos = (window as any).Gwen.Pos;
      return Pos.Fill | Pos.Bottom;
    });
    expect(v).toBe(144);
  });

  // 4 — placeBelow with no border
  test('placeBelow calls setPos(ctrl.x, below.bottom) when border === 0', async ({ page }) => {
    const args = await page.evaluate(() => {
      const G = (window as any).Gwen;
      let calledWith: [number, number] | null = null;
      const ctrl = {
        x: 5,
        setPos(x: number, y: number) { calledWith = [x, y]; },
      };
      const below = { bottom: 100 };
      G.placeBelow(ctrl, below);
      return calledWith;
    });
    expect(args).toEqual([5, 100]);
  });

  test('placeBelow with border=10 calls setPos(ctrl.x, below.bottom + 10)', async ({ page }) => {
    const args = await page.evaluate(() => {
      const G = (window as any).Gwen;
      let calledWith: [number, number] | null = null;
      const ctrl = {
        x: 5,
        setPos(x: number, y: number) { calledWith = [x, y]; },
      };
      const below = { bottom: 100 };
      G.placeBelow(ctrl, below, 10);
      return calledWith;
    });
    expect(args).toEqual([5, 110]);
  });

  test('placeBelow preserves ctrl.x regardless of below.bottom', async ({ page }) => {
    const args = await page.evaluate((): [number, number] | null => {
      const G = (window as any).Gwen;
      let calledWith: [number, number] | null = null;
      const ctrl = {
        x: 77,
        setPos(x: number, y: number) { calledWith = [x, y]; },
      };
      const below = { bottom: 200 };
      G.placeBelow(ctrl, below, 5);
      return calledWith;
    });
    expect(args![0]).toBe(77);
    expect(args![1]).toBe(205);
  });

  test('placeBelow with zero below.bottom and zero border calls setPos(x, 0)', async ({ page }) => {
    const args = await page.evaluate(() => {
      const G = (window as any).Gwen;
      let calledWith: [number, number] | null = null;
      const ctrl = {
        x: 0,
        setPos(x: number, y: number) { calledWith = [x, y]; },
      };
      const below = { bottom: 0 };
      G.placeBelow(ctrl, below);
      return calledWith;
    });
    expect(args).toEqual([0, 0]);
  });
});
