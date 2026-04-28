import { expect, Page } from '@playwright/test';

/**
 * Typed constructor for the runtime Signal class accessed via `(window as any).Gwen.Signal`.
 * Use this to avoid TS2347 ("Untyped function calls may not accept type arguments") when
 * passing a generic type argument to a constructor obtained from `any`.
 *
 * Usage inside page.evaluate:
 *   const Signal = G.Signal as SignalCtor;
 *   const sig = new Signal<number>();
 */
export type SignalCtor = new <T = void>() => {
  on(handler: (v: T) => void): () => void;
  remove(handler: (v: T) => void): void;
  emit(v: T): void;
  clear(): void;
  readonly size: number;
};

/** Load the demo page and wait for the Gwen global to be exposed. */
export async function gotoDemo(page: Page): Promise<void> {
  await page.goto('/demo/');
  await expect
    .poll(async () => page.evaluate(() => (window as unknown as { Gwen?: { VERSION?: string } }).Gwen?.VERSION ?? null))
    .not.toBeNull();
}

/** Small helper to wait until WebGL is ready to draw. */
export async function waitForFirstFrame(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>(r => requestAnimationFrame(() => r())));
}
