// Event system — replaces GWEN's Gwen::Event (Handler / Caller / CleanLinks /
// GlobalAdd / six overloaded Add slots) with a single `Signal<T>` plus
// closures. Consumers subscribe with `signal.on(handler)` and receive a
// disposer they call to unsubscribe. Re-entrant emits are safe: the
// subscriber list is snapshotted before iteration, so a handler that calls
// `.on()`, `.remove()`, or `.clear()` won't corrupt the in-flight dispatch.

import type { Point } from './Structures';

export type SignalHandler<T> = (arg: T) => void;
export type Disposer = () => void;

export class Signal<T = void> {
  // A plain array is the smallest and fastest container for the tiny handler
  // counts typical in UI code. We guard mutation during emit via snapshotting,
  // not copy-on-write, so steady-state subscriptions stay allocation-free.
  private handlers: SignalHandler<T>[] = [];

  on(handler: SignalHandler<T>): Disposer {
    this.handlers.push(handler);
    let disposed = false;
    return () => {
      if (disposed) return;
      disposed = true;
      const i = this.handlers.indexOf(handler);
      if (i !== -1) this.handlers.splice(i, 1);
    };
  }

  remove(handler: SignalHandler<T>): void {
    const i = this.handlers.indexOf(handler);
    if (i !== -1) this.handlers.splice(i, 1);
  }

  emit(arg: T): void {
    if (this.handlers.length === 0) return;
    // Snapshot — a handler may mutate `this.handlers` mid-dispatch.
    const snapshot = this.handlers.slice();
    for (let i = 0; i < snapshot.length; i++) {
      snapshot[i](arg);
    }
  }

  clear(): void {
    this.handlers.length = 0;
  }

  get size(): number {
    return this.handlers.length;
  }
}

// ---------- EventInfo ----------
//
// Ported from `Gwen::Event::Information`. Handlers that need structured
// payload data receive this (or a subset) via a typed `Signal<EventInfo>`.
// Controls construct one with `eventInfo()` and fill the fields they care
// about; readers must treat unused fields as default-valued.

export interface EventInfo {
  // The control that fired the event, plus an optional related one
  // (e.g. a drag source). Both stay `unknown` so this module does not
  // depend on `Base` — handler authors cast at the use site, mirroring
  // GWEN's untyped `m_pControlCaller` / `m_pControl` fields.
  controlCaller: unknown;
  control: unknown;
  data: unknown;
  string: string;
  point: Point;
  integer: number;
}

export function eventInfo(): EventInfo {
  return {
    controlCaller: null,
    control: null,
    data: null,
    string: '',
    point: { x: 0, y: 0 },
    integer: 0,
  };
}
