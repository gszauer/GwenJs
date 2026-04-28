// Dialogs — free functions that wrap the browser's native file/folder
// pickers, plus a `query` helper that builds a modal confirmation
// `WindowControl`. Ports `Gwen::Dialogs::FileOpen`, `Dialogs::FileSave`,
// `Dialogs::FolderOpen`, and `Dialogs::Query` from include/Gwen/Gwen.h
// (the function prototypes there; upstream has per-platform impls that
// we replace with web-native ones).
//
// Why free functions?
//   Matches GWEN's API shape — `Gwen::Dialogs::FileOpen(...)` etc. are
//   callable from anywhere without a control instance to thread a path
//   through. Consumers that want a composite control (TextBox + browse
//   button) use `FilePicker` / `FolderPicker`.
//
// Platform notes:
//   * `fileOpen` uses a transient `<input type="file">` synthesized per
//     call; the DOM reference is dropped once the Promise resolves.
//   * `fileSave` uses the File System Access API (`showSaveFilePicker`)
//     if the runtime supports it, otherwise resolves to null. Callers
//     that want a guaranteed save path can trigger a download via
//     `<a href="blob:..." download>` as a fallback — that's outside the
//     scope of this helper.
//   * `folderOpen` relies on the non-standard but widely-supported
//     `webkitdirectory` attribute. Safari (WebKit) sets
//     `webkitRelativePath` on selected files; we return the first path
//     segment as the "folder name" since full filesystem paths are
//     unavailable from the web sandbox.
//   * `query` is pure Gwen — no browser dialog involvement. It builds a
//     `WindowControl` parented to the supplied Canvas, makes it modal,
//     and wires buttons that dispatch the handlers + tear the window
//     down.

import type { Canvas } from './Canvas';
import { WindowControl } from './WindowControl';
import { Label } from './Label';
import { Button } from './Button';
import { Pos } from '../core/Align';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// GWEN's filter string uses the pattern "Label | *.ext1;*.ext2".
// Extract the *.ext tokens from the right-hand side and translate them
// into a browser `accept` attribute (comma-separated ".ext" list). The
// browser maps extensions to MIME internally, so we don't have to.
function parseAccept(filter: string): string {
  const parts = filter.split('|');
  const exts = parts[parts.length - 1] ?? '';
  const tokens = exts.match(/\*\.[A-Za-z0-9]+/g) ?? [];
  return tokens.map((t) => t.replace('*', '')).join(',');
}

// ---------------------------------------------------------------------------
// fileOpen — single-file open dialog via <input type="file">.
// ---------------------------------------------------------------------------

/**
 * Open an OS file picker for a single file.
 * @param useSystem  when false (or no DOM available) resolves to null.
 * @param _name      dialog title — browsers ignore this; parameter kept
 *                   for GWEN API parity.
 * @param _startPath starting directory — ignored by browsers for
 *                   sandboxing; kept for GWEN parity.
 * @param ext        filter string in GWEN's "Label | *.ext" format.
 * @returns the selected file's **name** (not absolute path — browsers
 *          do not expose one), or null on cancel / no-DOM.
 */
export async function fileOpen(
  useSystem: boolean,
  _name: string,
  _startPath: string,
  ext: string,
): Promise<string | null> {
  if (!useSystem || typeof document === 'undefined') return null;
  return new Promise<string | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    const accept = parseAccept(ext);
    if (accept) input.accept = accept;
    input.onchange = () => {
      const f = input.files?.[0];
      resolve(f ? f.name : null);
    };
    // `oncancel` is a 2024+ addition; if unsupported the Promise simply
    // never resolves on cancel. Users can still dismiss the dialog by
    // clicking elsewhere — the input element itself is GC-eligible as
    // soon as this scope unwinds.
    (input as unknown as { oncancel: (() => void) | null }).oncancel = () => resolve(null);
    input.click();
  });
}

// ---------------------------------------------------------------------------
// fileSave — save-as dialog via the File System Access API.
// ---------------------------------------------------------------------------

/**
 * Open an OS save-as dialog. Returns the chosen file name, or null if
 * the runtime doesn't expose `showSaveFilePicker` or the user cancels.
 *
 * Callers that need a guaranteed fallback should pair a null return
 * with a programmatic download (Blob + anchor click).
 */
export async function fileSave(
  useSystem: boolean,
  _name: string,
  _startPath: string,
  ext: string,
): Promise<string | null> {
  if (!useSystem) return null;
  const w = globalThis as unknown as {
    showSaveFilePicker?: (opts?: unknown) => Promise<{ name: string }>;
  };
  if (w.showSaveFilePicker) {
    try {
      const extMatch = ext.match(/\*\.[A-Za-z0-9]+/);
      const suggestedExt = extMatch ? extMatch[0].slice(1) : '.txt';
      const handle = await w.showSaveFilePicker({
        suggestedName: 'file' + suggestedExt,
      });
      return handle.name;
    } catch {
      // Includes user-cancel (`AbortError`) and permission failures —
      // GWEN reports both as "no file chosen".
      return null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// folderOpen — directory picker via `webkitdirectory`.
// ---------------------------------------------------------------------------

/**
 * Open a folder picker. Returns the root folder name inferred from the
 * first selected file's `webkitRelativePath`, or null on cancel.
 *
 * Browsers don't hand back an absolute filesystem path, so the
 * return value is suitable for display only — not for server-side IO.
 */
export async function folderOpen(
  useSystem: boolean,
  _name: string,
  _startPath: string,
): Promise<string | null> {
  if (!useSystem || typeof document === 'undefined') return null;
  return new Promise<string | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    (input as unknown as { webkitdirectory: boolean }).webkitdirectory = true;
    input.multiple = true;
    input.onchange = () => {
      const files = Array.from(input.files ?? []);
      if (!files.length) {
        resolve(null);
        return;
      }
      const first = (files[0] as unknown as { webkitRelativePath: string }).webkitRelativePath;
      const root = first.split('/')[0] ?? null;
      resolve(root);
    };
    (input as unknown as { oncancel: (() => void) | null }).oncancel = () => resolve(null);
    input.click();
  });
}

// ---------------------------------------------------------------------------
// query — modal confirmation dialog.
// ---------------------------------------------------------------------------

/**
 * Build a modal confirmation WindowControl centered on the supplied
 * canvas. The button layout adapts to the handlers supplied:
 *
 *   * onYes only                       → single "OK" button
 *   * onYes + onNo                     → "Yes" / "No" buttons
 *   * onYes + onNo + onCancel          → "Yes" / "No" / "Cancel" buttons
 *
 * Clicking the window's close button fires onCancel (when supplied) to
 * match GWEN's `Gwen::Dialogs::Query` semantics.
 *
 * The returned WindowControl can be dismissed programmatically via
 * `.close()` — handy for tests and time-boxed prompts.
 */
export function query(
  canvas: Canvas,
  text: string,
  onYes?: () => void,
  onNo?: () => void,
  onCancel?: () => void,
): WindowControl {
  const win = new WindowControl(canvas, 'Confirm');
  win.setSize(320, 140);

  // Centre on the canvas so the dialog lands in view regardless of
  // viewport size. The minus-160/70 match the set size above.
  const cx = canvas.width() / 2;
  const cy = canvas.height() / 2;
  win.setPos(cx - 160, cy - 70);
  win.setClosable(true);
  win.makeModal(true);

  const label = new Label(win);
  label.setBounds(10, 30, 300, 60);
  label.setText(text);
  label.setAlignment(Pos.CenterH | Pos.CenterV);
  label.setWrap(true);

  // Guard flag — both the explicit button click and the window-closed
  // signal can trigger dismissal; we only want onCancel to fire once.
  let handled = false;
  const close = (handler?: () => void): void => {
    if (handled) return;
    handled = true;
    win.destroyModal();
    win.close();
    handler?.();
  };

  if (onYes && onNo && onCancel) {
    const yes = new Button(win);
    yes.setBounds(40, 100, 80, 22);
    yes.setText('Yes');
    yes.onPress.on(() => close(onYes));

    const no = new Button(win);
    no.setBounds(130, 100, 80, 22);
    no.setText('No');
    no.onPress.on(() => close(onNo));

    const cancel = new Button(win);
    cancel.setBounds(220, 100, 80, 22);
    cancel.setText('Cancel');
    cancel.onPress.on(() => close(onCancel));
  } else if (onYes && onNo) {
    const yes = new Button(win);
    yes.setBounds(80, 100, 80, 22);
    yes.setText('Yes');
    yes.onPress.on(() => close(onYes));

    const no = new Button(win);
    no.setBounds(170, 100, 80, 22);
    no.setText('No');
    no.onPress.on(() => close(onNo));
  } else {
    const ok = new Button(win);
    ok.setBounds(130, 100, 80, 22);
    ok.setText('OK');
    ok.onPress.on(() => close(onYes));
  }

  // Window-close (X button) counts as a cancel. Guarded by the `handled`
  // flag so a Yes/No/Cancel button click that itself destroys the
  // window doesn't double-fire onCancel.
  win.onWindowClosed.on(() => {
    if (!handled && onCancel) {
      handled = true;
      onCancel();
    }
  });

  return win;
}
