// Input router — translates browser PointerEvent / KeyboardEvent / WheelEvent
// streams into GWEN-style `inputMouse*` / `inputKey` / `inputCharacter` calls
// on a target. One unified pointer code path serves mouse, pen, and touch.
//
// Touch-specific gestures:
//   - Long-press (default 500 ms, slop 10 px) emits a synthetic right-click.
//     Because we can't know up-front whether a touchdown will become a tap,
//     drag, or long-press, we *delay* the synthetic left-down for touch
//     pointers until either movement is observed or the long-press timer
//     fires.
//   - Two-finger tap (a second touch landing while the first is still down)
//     promotes the gesture to a synthetic right-click and suppresses the
//     left-click that would otherwise bookend each finger.
//
// Browser button-number convention is preserved end-to-end (0=Left, 1=Middle,
// 2=Right). Targets that need to remap are free to do so at the call site.

// ---------- Public API ----------

export const Key = {
  Invalid: 0,
  Return: 1,
  Backspace: 2,
  Delete: 3,
  Left: 4,
  Right: 5,
  Shift: 6,
  Tab: 7,
  Space: 8,
  Home: 9,
  End: 10,
  Control: 11,
  Up: 12,
  Down: 13,
  Escape: 14,
  Alt: 15,
  Command: 16,
  Count: 17,
} as const;
export type Key = (typeof Key)[keyof typeof Key];

export interface InputTarget {
  inputMouseMoved(x: number, y: number, dx: number, dy: number): boolean;
  inputMouseButton(button: number, pressed: boolean): boolean;
  inputMouseWheel(value: number): boolean;
  inputKey(key: number, pressed: boolean): boolean;
  inputCharacter(ch: string): boolean;
  // Optional — `attachInput` only fires this when the host implements it,
  // so existing InputTargets that pre-date accelerators still compile.
  inputAccelerator?(text: string): boolean;
}

export interface InputOptions {
  longPressMs?: number;
  longPressSlopPx?: number;
}

// ---------- Helpers ----------

function mapKey(keyString: string): number {
  switch (keyString) {
    case 'Enter':
      return Key.Return;
    case 'Backspace':
      return Key.Backspace;
    case 'Delete':
      return Key.Delete;
    case 'ArrowLeft':
      return Key.Left;
    case 'ArrowRight':
      return Key.Right;
    case 'ArrowUp':
      return Key.Up;
    case 'ArrowDown':
      return Key.Down;
    case 'Shift':
      return Key.Shift;
    case 'Tab':
      return Key.Tab;
    case ' ':
      return Key.Space;
    case 'Home':
      return Key.Home;
    case 'End':
      return Key.End;
    case 'Control':
      return Key.Control;
    case 'Escape':
      return Key.Escape;
    case 'Alt':
      return Key.Alt;
    case 'Meta':
      return Key.Command;
    default:
      return Key.Invalid;
  }
}

function clientToCanvas(event: PointerEvent, element: HTMLElement): [number, number] {
  const rect = element.getBoundingClientRect();
  return [Math.round(event.clientX - rect.left), Math.round(event.clientY - rect.top)];
}

// One-shot warning so a misbehaving target doesn't spam the console every frame.
let didWarn = false;
function safeCall(fn: () => void): void {
  try {
    fn();
  } catch (err) {
    if (!didWarn) {
      didWarn = true;
      // eslint-disable-next-line no-console
      console.error('[GwenJs] InputTarget threw; further errors suppressed:', err);
    }
  }
}

// ---------- attachInput ----------

export function attachInput(
  element: HTMLElement,
  target: InputTarget,
  options?: InputOptions,
): () => void {
  const longPressMs = options?.longPressMs ?? 500;
  const longPressSlopPx = options?.longPressSlopPx ?? 10;

  // --- Element prep ---
  if (element.tabIndex < 0) element.tabIndex = 0;
  element.style.touchAction = 'none';

  // --- Closure state ---
  let prevX = 0;
  let prevY = 0;
  const pressedButtons = new Set<number>();
  const pressedKeys = new Set<number>();

  // Active pointers: every pointer currently down anywhere on `element`.
  const activePointers = new Map<number, { x: number; y: number; pointerType: string }>();

  // Long-press / touch-tap bookkeeping. Only one in flight at a time — once
  // a second touch lands we promote to a two-finger gesture and drop the
  // single-touch tracking.
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressStartX = 0;
  let longPressStartY = 0;
  let longPressPointerId: number | null = null;
  let pendingRightUp = false;

  // True iff we've actually emitted `inputMouseButton(0, true)` for the
  // current touch sequence. The emission is delayed for touch pointers so
  // that long-press and two-finger gestures can suppress it.
  let leftDownEmitted = false;

  // True iff a two-finger gesture is in progress. While set, pointer-up
  // events for either finger only emit the synthetic right-up when the last
  // finger leaves; left-clicks are suppressed.
  let twoFingerActive = false;

  // --- Helpers that close over `target` / state ---

  function emitMove(x: number, y: number): void {
    const dx = x - prevX;
    const dy = y - prevY;
    prevX = x;
    prevY = y;
    safeCall(() => {
      target.inputMouseMoved(x, y, dx, dy);
    });
  }

  function emitButton(button: number, pressed: boolean): void {
    if (pressed) pressedButtons.add(button);
    else pressedButtons.delete(button);
    safeCall(() => {
      target.inputMouseButton(button, pressed);
    });
  }

  function clearLongPress(): void {
    if (longPressTimer != null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    longPressPointerId = null;
  }

  // --- PointerEvent handlers ---

  function onPointerDown(e: PointerEvent): void {
    const [x, y] = clientToCanvas(e, element);
    prevX = x;
    prevY = y;

    // Capture so that drags continuing off-element still report.
    if (typeof element.setPointerCapture === 'function') {
      try {
        element.setPointerCapture(e.pointerId);
      } catch {
        // Some browsers throw if the pointer isn't active; ignore.
      }
    }

    activePointers.set(e.pointerId, { x, y, pointerType: e.pointerType });

    if (e.pointerType === 'touch') {
      // Second (or later) touch arrives → promote to two-finger right-click.
      if (activePointers.size >= 2) {
        // Cancel any in-flight single-touch state.
        clearLongPress();
        if (leftDownEmitted) {
          // The first finger had already promoted to a left-down (it must have
          // moved). Release it before issuing the right-down so the target
          // never sees overlapping buttons.
          emitButton(0, false);
          leftDownEmitted = false;
        }
        if (!twoFingerActive) {
          twoFingerActive = true;
          emitButton(2, true);
        }
        return;
      }

      // First touch: defer the left-down until movement or long-press timeout.
      longPressStartX = x;
      longPressStartY = y;
      longPressPointerId = e.pointerId;
      leftDownEmitted = false;
      pendingRightUp = false;
      longPressTimer = setTimeout(() => {
        longPressTimer = null;
        // Long-press fired without movement → emit synthetic right-down.
        // Skip if the target already saw a left-down (shouldn't happen, but
        // defensive in case movement raced the timer).
        if (!leftDownEmitted) {
          emitButton(2, true);
          pendingRightUp = true;
        }
      }, longPressMs);
      return;
    }

    // Mouse / pen: emit immediately, no gesture interpretation.
    emitButton(e.button, true);
  }

  function onPointerMove(e: PointerEvent): void {
    const [x, y] = clientToCanvas(e, element);

    const tracked = activePointers.get(e.pointerId);
    if (tracked !== undefined) {
      tracked.x = x;
      tracked.y = y;
    }

    // First, check whether this movement should cancel the long-press timer
    // and retroactively emit the deferred left-down.
    if (longPressTimer != null && e.pointerId === longPressPointerId) {
      const dx = x - longPressStartX;
      const dy = y - longPressStartY;
      if (dx * dx + dy * dy > longPressSlopPx * longPressSlopPx) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
        // Movement → user is dragging, not long-pressing. Emit the deferred
        // left-down now so subsequent moves and the eventual up form a
        // coherent click sequence.
        if (!leftDownEmitted && !twoFingerActive) {
          emitButton(0, true);
          leftDownEmitted = true;
        }
      }
    }

    emitMove(x, y);
  }

  function onPointerUp(e: PointerEvent): void {
    const [x, y] = clientToCanvas(e, element);
    activePointers.delete(e.pointerId);

    if (typeof element.releasePointerCapture === 'function') {
      try {
        element.releasePointerCapture(e.pointerId);
      } catch {
        // Already released or never captured.
      }
    }

    if (e.pointerType === 'touch') {
      // Two-finger right-click in flight: emit the right-up only when the
      // last finger lifts, and never emit a left event for either finger.
      if (twoFingerActive) {
        if (activePointers.size === 0) {
          emitButton(2, false);
          twoFingerActive = false;
        }
        return;
      }

      // Single-touch path. Three cases:
      //   1. Long-press already fired (pendingRightUp=true): emit right-up.
      //   2. Touch moved past slop (leftDownEmitted=true): emit left-up.
      //   3. Quick tap, neither happened: cancel the timer, emit a synthetic
      //      left down+up pair so the target sees a click.
      if (pendingRightUp) {
        emitButton(2, false);
        pendingRightUp = false;
      } else if (leftDownEmitted) {
        emitButton(0, false);
        leftDownEmitted = false;
      } else {
        clearLongPress();
        // Move to the up location first so the synthetic click reports the
        // correct coordinates.
        emitMove(x, y);
        emitButton(0, true);
        emitButton(0, false);
      }
      clearLongPress();
      return;
    }

    // Mouse / pen.
    emitButton(e.button, false);
  }

  function onPointerCancel(e: PointerEvent): void {
    activePointers.delete(e.pointerId);
    if (typeof element.releasePointerCapture === 'function') {
      try {
        element.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore.
      }
    }

    if (e.pointerType === 'touch') {
      clearLongPress();
      if (twoFingerActive && activePointers.size === 0) {
        emitButton(2, false);
        twoFingerActive = false;
      } else if (leftDownEmitted) {
        emitButton(0, false);
        leftDownEmitted = false;
      } else if (pendingRightUp) {
        emitButton(2, false);
        pendingRightUp = false;
      }
      return;
    }

    // For mouse / pen we may be holding any subset of the buttons; release
    // them all to avoid stuck state.
    for (const btn of Array.from(pressedButtons)) {
      emitButton(btn, false);
    }
  }

  function onPointerLeave(_e: PointerEvent): void {
    // Mirror GWEN's "off-canvas" sentinel.
    safeCall(() => {
      target.inputMouseMoved(-1, -1, 0, 0);
    });
    prevX = -1;
    prevY = -1;
    // Don't clear pressed buttons here — pointer capture keeps the drag alive
    // and the user expects the click to complete when they release. The blur
    // handler is the safety net.
  }

  // --- Wheel ---

  function onWheel(e: WheelEvent): void {
    if (e.ctrlKey) {
      // Pinch-zoom on macOS / trackpads arrives as wheel + ctrl. Eat it so
      // the page doesn't zoom; controls that want zoom should listen for it
      // separately.
      e.preventDefault();
      return;
    }
    e.preventDefault();
    if (e.deltaY === 0) return;
    const v = -Math.sign(e.deltaY) * 60;
    safeCall(() => {
      target.inputMouseWheel(v);
    });
  }

  function onContextMenu(e: MouseEvent): void {
    // Right-click already arrives as a pointer event; suppress the native menu.
    e.preventDefault();
  }

  // --- Keyboard ---

  function onKeyDown(e: KeyboardEvent): void {
    // Accelerator path: a non-modifier printable key with Ctrl or Meta
    // held builds a "Ctrl+Shift+N"-style string and dispatches to the
    // target before the normal inputKey/inputCharacter flow runs. The
    // browser doesn't fire `keypress` for ctrl-modified keys, so this
    // is the only place accelerators reach us.
    if (
      target.inputAccelerator &&
      (e.ctrlKey || e.metaKey) &&
      e.key.length === 1 &&
      e.key !== ' ' &&
      e.key !== 'Control' &&
      e.key !== 'Meta'
    ) {
      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
      if (e.shiftKey) parts.push('Shift');
      if (e.altKey) parts.push('Alt');
      parts.push(e.key.toUpperCase());
      const accel = parts.join('+');
      let consumed = false;
      safeCall(() => {
        consumed = target.inputAccelerator!(accel);
      });
      if (consumed) {
        e.preventDefault();
        return;
      }
    }
    const k = mapKey(e.key);
    if (k === Key.Invalid) return;
    pressedKeys.add(k);
    let consumed = false;
    safeCall(() => {
      consumed = target.inputKey(k, true);
    });
    // Suppress the browser's default if our keyboardFocus actually
    // handled the key — otherwise Tab cycles BOTH the canvas's
    // internal focus AND the browser's tab order (the user lands on
    // an element outside the canvas), arrow keys scroll the page
    // while also driving in-canvas controls, etc. Letters / digits /
    // unmodified printable keys land in `inputCharacter`'s
    // `keypress` path further down — those return false from
    // inputKey so the browser's normal text-input handling stays
    // unaffected.
    if (consumed) e.preventDefault();
  }

  function onKeyUp(e: KeyboardEvent): void {
    const k = mapKey(e.key);
    if (k === Key.Invalid) return;
    pressedKeys.delete(k);
    let consumed = false;
    safeCall(() => {
      consumed = target.inputKey(k, false);
    });
    if (consumed) e.preventDefault();
  }

  function onKeyPress(e: KeyboardEvent): void {
    if (e.key.length !== 1) return;
    const ch = e.key;
    safeCall(() => {
      target.inputCharacter(ch);
    });
  }

  // --- Blur cleanup ---

  function onBlur(): void {
    for (const btn of Array.from(pressedButtons)) {
      safeCall(() => {
        target.inputMouseButton(btn, false);
      });
    }
    pressedButtons.clear();
    for (const k of Array.from(pressedKeys)) {
      safeCall(() => {
        target.inputKey(k, false);
      });
    }
    pressedKeys.clear();
    clearLongPress();
    activePointers.clear();
    pendingRightUp = false;
    leftDownEmitted = false;
    twoFingerActive = false;
  }

  // --- Wire up ---

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerup', onPointerUp);
  element.addEventListener('pointercancel', onPointerCancel);
  element.addEventListener('pointerleave', onPointerLeave);
  element.addEventListener('pointerout', onPointerLeave);
  element.addEventListener('wheel', onWheel, { passive: false });
  element.addEventListener('contextmenu', onContextMenu);
  element.addEventListener('keydown', onKeyDown);
  element.addEventListener('keyup', onKeyUp);
  element.addEventListener('keypress', onKeyPress);
  element.addEventListener('blur', onBlur);

  return function detach(): void {
    element.removeEventListener('pointerdown', onPointerDown);
    element.removeEventListener('pointermove', onPointerMove);
    element.removeEventListener('pointerup', onPointerUp);
    element.removeEventListener('pointercancel', onPointerCancel);
    element.removeEventListener('pointerleave', onPointerLeave);
    element.removeEventListener('pointerout', onPointerLeave);
    element.removeEventListener('wheel', onWheel);
    element.removeEventListener('contextmenu', onContextMenu);
    element.removeEventListener('keydown', onKeyDown);
    element.removeEventListener('keyup', onKeyUp);
    element.removeEventListener('keypress', onKeyPress);
    element.removeEventListener('blur', onBlur);
    clearLongPress();
    activePointers.clear();
    pressedButtons.clear();
    pressedKeys.clear();
  };
}
