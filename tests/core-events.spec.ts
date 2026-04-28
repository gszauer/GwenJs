// T002 — Events / Signal<T>
// Tests the Signal class exported on window.Gwen.
// Categories skipped: Render, Visual baseline, State visuals, Pointer input,
//   Touch input, Keyboard, Resize — none apply to a pure event-bus primitive.

import { test, expect } from '@playwright/test';
import { gotoDemo } from './helpers';
import type { SignalCtor } from './helpers';

test.describe.configure({ mode: 'parallel' });

test.describe('T002 Signal', () => {
  test.beforeEach(async ({ page }) => { await gotoDemo(page); });

  // 1 — Basic subscribe + emit
  test('handler receives the emitted argument', async ({ page }) => {
    const received = await page.evaluate(() => {
      const Signal = (window as any).Gwen.Signal as SignalCtor;
      const sig = new Signal<number>();
      let got: number | null = null;
      sig.on((v) => { got = v; });
      sig.emit(42);
      return got;
    });
    expect(received).toBe(42);
  });

  // 2 — Multiple subscribers, insertion order
  test('multiple subscribers fire in insertion order', async ({ page }) => {
    const order = await page.evaluate(() => {
      const Signal = (window as any).Gwen.Signal as SignalCtor;
      const sig = new Signal<void>();
      const log: number[] = [];
      sig.on(() => log.push(1));
      sig.on(() => log.push(2));
      sig.on(() => log.push(3));
      sig.emit(undefined);
      return log;
    });
    expect(order).toEqual([1, 2, 3]);
  });

  // 3 — Disposer unsubscribes; calling twice is safe (idempotent)
  test('disposer unsubscribes handler', async ({ page }) => {
    const received = await page.evaluate(() => {
      const Signal = (window as any).Gwen.Signal as SignalCtor;
      const sig = new Signal<number>();
      let count = 0;
      const dispose = sig.on(() => { count++; });
      sig.emit(1);
      dispose();
      sig.emit(2);
      return count;
    });
    expect(received).toBe(1);
  });

  test('calling disposer twice is safe (idempotent)', async ({ page }) => {
    const threw = await page.evaluate(() => {
      const Signal = (window as any).Gwen.Signal as SignalCtor;
      const sig = new Signal<void>();
      let count = 0;
      const dispose = sig.on(() => { count++; });
      dispose();
      try { dispose(); return false; } catch { return true; }
    });
    expect(threw).toBe(false);
  });

  test('calling disposer twice does not affect other handlers', async ({ page }) => {
    const count = await page.evaluate(() => {
      const Signal = (window as any).Gwen.Signal as SignalCtor;
      const sig = new Signal<void>();
      let a = 0;
      let b = 0;
      const disposeA = sig.on(() => { a++; });
      sig.on(() => { b++; });
      disposeA();
      disposeA(); // second call — must not remove b
      sig.emit(undefined);
      return { a, b };
    });
    expect(count.a).toBe(0);
    expect(count.b).toBe(1);
  });

  // 4 — remove(handler) unsubscribes by reference
  test('remove() unsubscribes handler by reference', async ({ page }) => {
    const count = await page.evaluate(() => {
      const Signal = (window as any).Gwen.Signal as SignalCtor;
      const sig = new Signal<void>();
      let n = 0;
      const h = () => { n++; };
      sig.on(h);
      sig.emit(undefined);
      sig.remove(h);
      sig.emit(undefined);
      return n;
    });
    expect(count).toBe(1);
  });

  // 5 — clear() drops all
  test('clear() removes all handlers', async ({ page }) => {
    const count = await page.evaluate(() => {
      const Signal = (window as any).Gwen.Signal as SignalCtor;
      const sig = new Signal<void>();
      let n = 0;
      sig.on(() => { n++; });
      sig.on(() => { n++; });
      sig.clear();
      sig.emit(undefined);
      return n;
    });
    expect(count).toBe(0);
  });

  // 6 — size reflects handler count
  test('size reflects handler count correctly', async ({ page }) => {
    const sizes = await page.evaluate(() => {
      const Signal = (window as any).Gwen.Signal as SignalCtor;
      const sig = new Signal<void>();
      const s0 = sig.size;
      const d1 = sig.on(() => {});
      const s1 = sig.size;
      sig.on(() => {});
      const s2 = sig.size;
      d1();
      const s3 = sig.size;
      sig.clear();
      const s4 = sig.size;
      return [s0, s1, s2, s3, s4];
    });
    expect(sizes).toEqual([0, 1, 2, 1, 0]);
  });

  // 7 — Re-entrancy: clear() mid-emit does not crash and does not skip
  //     siblings that were already queued in the snapshot.
  test('handler that calls clear() mid-emit does not crash and siblings still fire', async ({ page }) => {
    const log = await page.evaluate(() => {
      const Signal = (window as any).Gwen.Signal as SignalCtor;
      const sig = new Signal<void>();
      const out: number[] = [];
      sig.on(() => { out.push(1); sig.clear(); }); // clears live list mid-emit
      sig.on(() => { out.push(2); });               // already in snapshot — must still fire
      sig.emit(undefined);
      return out;
    });
    expect(log).toEqual([1, 2]);
  });

  test('handler that calls on() mid-emit does not crash', async ({ page }) => {
    const log = await page.evaluate(() => {
      const Signal = (window as any).Gwen.Signal as SignalCtor;
      const sig = new Signal<void>();
      const out: number[] = [];
      sig.on(() => {
        out.push(1);
        sig.on(() => { out.push(99); }); // added during emit — must NOT fire this round
      });
      sig.on(() => { out.push(2); });
      sig.emit(undefined);
      return out;
    });
    // 99 must not appear — only the snapshot is iterated
    expect(log).toEqual([1, 2]);
  });

  // 8 — Two separate Signal instances don't share state
  test('two Signal instances do not share handler state', async ({ page }) => {
    const result = await page.evaluate(() => {
      const Signal = (window as any).Gwen.Signal as SignalCtor;
      const a = new Signal<number>();
      const b = new Signal<number>();
      let aVal = 0;
      let bVal = 0;
      a.on((v) => { aVal = v; });
      b.on((v) => { bVal = v; });
      a.emit(1);
      b.emit(2);
      return { aVal, bVal };
    });
    expect(result.aVal).toBe(1);
    expect(result.bVal).toBe(2);
  });

  test('clearing one Signal does not affect the other', async ({ page }) => {
    const result = await page.evaluate(() => {
      const Signal = (window as any).Gwen.Signal as SignalCtor;
      const a = new Signal<void>();
      const b = new Signal<void>();
      let aFired = false;
      let bFired = false;
      a.on(() => { aFired = true; });
      b.on(() => { bFired = true; });
      a.clear();
      a.emit(undefined);
      b.emit(undefined);
      return { aFired, bFired };
    });
    expect(result.aFired).toBe(false);
    expect(result.bFired).toBe(true);
  });

  // 9 — Emit with no subscribers is a no-op
  test('emit with no subscribers does not throw', async ({ page }) => {
    const threw = await page.evaluate(() => {
      const Signal = (window as any).Gwen.Signal as SignalCtor;
      const sig = new Signal<void>();
      try { sig.emit(undefined); return false; } catch { return true; }
    });
    expect(threw).toBe(false);
  });

  // 10 — Signal<void> — emit() with no payload; no type arg needed here
  test('Signal with no type parameter works with emit(undefined)', async ({ page }) => {
    const fired = await page.evaluate(() => {
      const sig = new (window as any).Gwen.Signal();
      let triggered = false;
      sig.on(() => { triggered = true; });
      sig.emit(undefined);
      return triggered;
    });
    expect(fired).toBe(true);
  });

  // 11 — Re-entrancy bug NOT replicated: nested emit must pass distinct payloads
  test('nested emit passes correct distinct payload to each level', async ({ page }) => {
    const payloads = await page.evaluate(() => {
      const Signal = (window as any).Gwen.Signal as SignalCtor;
      const outer = new Signal<number>();
      const inner = new Signal<number>();
      const log: number[] = [];
      outer.on((v) => {
        log.push(v); // should be 1
        inner.emit(2);
        log.push(v); // should still be 1, not corrupted by inner emit
      });
      inner.on((v) => { log.push(v); }); // should be 2
      outer.emit(1);
      return log;
    });
    // Expect [1, 2, 1] — outer payload stays 1 throughout; inner payload is 2
    expect(payloads).toEqual([1, 2, 1]);
  });
});
