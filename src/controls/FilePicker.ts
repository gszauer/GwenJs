// FilePicker — composite control for selecting a single file via the
// browser's native file dialog. The picker owns a `File` reference (a
// `Blob` subclass), so callers can read the bytes directly:
//
//   const fp = new FilePicker(parent);
//   fp.setAccept('image/*');
//   fp.onFileChanged.on(() => {
//     const f = fp.getFile();
//     if (f) f.arrayBuffer().then(buf => ...);
//   });
//
// Composition (left → right):
//
//   ┌────────────────────────────────────────┬───┬──────────┐
//   │ path display (read-only TextBox)       │ ✕ │ Browse…  │
//   └────────────────────────────────────────┴───┴──────────┘
//
//   * The TextBox shows `file.name` for the current selection. It is
//     intentionally non-editable, non-focusable, and not in the tab
//     order — the canonical state lives in the File reference, not in
//     a string the user types.
//   * The clear button (✕) drops the File and empties the display.
//     Hidden when the picker is empty; appears as soon as something is
//     held (a File or a display-only name). The Browse button reflows
//     to the freed slot via the dock pass.
//   * The browse button opens the native `<input type="file">` dialog.
//
// Both buttons are tabable and respond to keyboard activation; the path
// field is not focusable.
//
// Path vs. name. Browser sandboxes don't expose a real filesystem
// path, so the display field shows `file.name` (the basename). Callers
// that need anything richer should read it from the File itself.
//
// PropertyFile compatibility. PropertyBase serialises values as
// strings, so PropertyFile uses `file?.name ?? ''` as the canonical
// value. Calling `setFileName(s)` is an "advisory display only" path
// that updates the display text without producing a File — useful for
// rehydrating a saved selection where the bytes are no longer
// available. In that state `getFile()` returns null and the user must
// re-pick to populate it.
//
// Replaces the original GWEN-style port that wrapped a free-text
// TextBox + ".." button and only returned the file name string.
//
// FolderPicker (in this same file, below) is the legacy
// `webkitdirectory`-based control and is unchanged for now.
//
// Ports `Gwen::Controls::FilePicker` from
// include/Gwen/Controls/FilePicker.h with the deviations above.

import { Base } from './Base';
import { TextBox } from './TextBox';
import { Button } from './Button';
import { Signal, eventInfo, type EventInfo } from '../core/Events';
import { Pos } from '../core/Align';
import { margin } from '../core/Structures';
import * as Dialogs from './Dialogs';

// Convert GWEN's "Label | *.ext1;*.ext2" filter into a comma-separated
// browser `accept` value (".ext1,.ext2"). Returns '' when the filter
// doesn't carry any extension tokens.
function gwenFilterToAccept(filter: string): string {
  const parts = filter.split('|');
  const exts = parts[parts.length - 1] ?? '';
  const tokens = exts.match(/\*\.[A-Za-z0-9]+/g) ?? [];
  return tokens.map((t) => t.replace('*', '')).join(',');
}

// ---------------------------------------------------------------------------
// FilePicker — file-blob picker.
// ---------------------------------------------------------------------------

export class FilePicker extends Base {
  readonly onFileChanged = new Signal<EventInfo>();

  protected _file: File | null = null;
  // Independent of `_file` so PropertyFile.setPropertyValue('foo.txt')
  // can prefill a display name without fabricating a File. When the
  // user picks a real file the two are kept in sync.
  protected _displayName = '';

  // Browser `accept` attribute. Either set directly via `setAccept`
  // ('image/*') or derived from a GWEN-style filter via `setFileType`.
  protected _accept = '';
  protected _fileType = 'Any Type | *.*';

  protected _textBox: TextBox;
  protected _clearButton: Button;
  protected _browseButton: Button;

  constructor(parent: Base | null) {
    super(parent);
    this.setSize(220, 22);

    // Order matters for `Pos.Right` docking: the first Right-docked
    // child takes the rightmost slot, the next takes the slot inboard
    // of it, etc. Browse first → it sits flush against the right edge.
    this._browseButton = new Button(this);
    this._browseButton.dock(Pos.Right);
    this._browseButton.setWidth(70);
    this._browseButton.setText('Browse…');
    this._browseButton.setMargin(margin(2, 0, 0, 0));
    this._browseButton.setTabable(true);
    this._browseButton.setKeyboardInputEnabled(true);
    // Catch sync exceptions thrown by the dialog (e.g. user-activation
    // edge cases) so they don't propagate up through Button.onPress.emit
    // and skip the `canvas.mouseFocus = null` line in
    // Button.onMouseClickLeft. A stuck mouseFocus would route every
    // subsequent click back to this button, breaking input across the
    // whole canvas — the symptom the user reported when one section's
    // picker click silently failed and the next section's stopped
    // responding.
    this._browseButton.onPress.on(() => {
      try {
        void this.openDialog().catch(() => {});
      } catch {
        // swallow — the picker stays in its previous state
      }
    });

    this._clearButton = new Button(this);
    this._clearButton.dock(Pos.Right);
    this._clearButton.setWidth(22);
    this._clearButton.setText('✕');
    this._clearButton.setMargin(margin(2, 0, 0, 0));
    this._clearButton.setTabable(true);
    this._clearButton.setKeyboardInputEnabled(true);
    // Hidden until something is held; the dock pass skips hidden
    // children so Browse… reflows flush against the right edge.
    this._clearButton.hide();
    this._clearButton.onPress.on(() => this.clear());

    this._textBox = new TextBox(this);
    this._textBox.dock(Pos.Fill);
    this._textBox.setEditable(false);
    this._textBox.setMouseInputEnabled(false);
    this._textBox.setKeyboardInputEnabled(false);
    this._textBox.setTabable(false);
  }

  // =====================================================================
  // Filter configuration
  // =====================================================================

  /** Set the browser `accept` attribute directly (e.g. 'image/*' or '.png,.jpg'). */
  setAccept(s: string): void {
    this._accept = s;
  }

  getAccept(): string {
    return this._accept;
  }

  /**
   * Set a GWEN-style filter string ("Label | *.ext1;*.ext2"). The
   * extension tokens are translated into a browser `accept` value;
   * the label is dropped (browsers don't surface it).
   */
  setFileType(s: string): void {
    this._fileType = s;
    this._accept = gwenFilterToAccept(s);
  }

  getFileType(): string {
    return this._fileType;
  }

  // =====================================================================
  // File / name accessors
  // =====================================================================

  /** Returns the currently selected File, or null if cleared. */
  getFile(): File | null {
    return this._file;
  }

  /**
   * Returns the display name. Equal to `getFile()?.name` when a real
   * file is held; otherwise whatever was last set via `setFileName`
   * (the "advisory display only" path).
   */
  getFileName(): string {
    return this._displayName;
  }

  /**
   * Replace the held File (or pass null to clear). Updates the display,
   * toggles the clear button's enabled state, and fires `onFileChanged`
   * unless `fireEvents` is explicitly false.
   */
  setFile(file: File | null, fireEvents = true): void {
    this._file = file;
    this._displayName = file ? file.name : '';
    this._textBox.setText(this._displayName);
    this._clearButton.setHidden(!this.hasContent());
    // The picker reflows when the clear button toggles visibility, so
    // invalidate ourselves to make the dock pass redo Browse's slot.
    this.invalidate();
    if (fireEvents) this.fireChanged();
  }

  /**
   * Set the display name without altering the File reference. Use this
   * to rehydrate a saved selection from a string when the bytes aren't
   * available. `getFile()` will continue to return whatever was held
   * (typically null in this scenario).
   */
  setFileName(name: string, fireEvents = true): void {
    this._displayName = name;
    this._textBox.setText(name);
    this._clearButton.setHidden(!this.hasContent());
    this.invalidate();
    if (fireEvents) this.fireChanged();
  }

  /** True iff the picker holds either a File or a non-empty display name. */
  protected hasContent(): boolean {
    return this._file !== null || this._displayName !== '';
  }

  /** Drop the held File and clear the display. Always fires `onFileChanged`. */
  clear(fireEvents = true): void {
    this.setFile(null, fireEvents);
  }

  // Property-grid aliases — kept so PropertyFile (and any future
  // serializer) treats the picker like any other property without
  // special-casing the accessor names.
  getValue(): string {
    return this.getFileName();
  }

  setValue(v: string): void {
    if (v === '') this.clear();
    else this.setFileName(v);
  }

  // =====================================================================
  // Child accessors (mainly for tests + custom styling)
  // =====================================================================

  getTextBox(): TextBox {
    return this._textBox;
  }

  getBrowseButton(): Button {
    return this._browseButton;
  }

  getClearButton(): Button {
    return this._clearButton;
  }

  // =====================================================================
  // Dialog
  // =====================================================================

  /**
   * Open the browser's native file dialog. Resolves with the picked File
   * or null on cancel / no DOM. Public so callers can trigger the dialog
   * programmatically (e.g. from a keyboard shortcut on a parent panel).
   *
   * On success the picker's state updates and `onFileChanged` fires
   * before the promise resolves — handlers can read `getFile()` directly.
   */
  async openDialog(): Promise<File | null> {
    if (typeof document === 'undefined') return null;
    const file = await openNativeFileDialog(this._accept);
    if (file) this.setFile(file);
    return file;
  }

  // =====================================================================
  // Internal
  // =====================================================================

  protected fireChanged(): void {
    const info = eventInfo();
    info.controlCaller = this;
    info.string = this._displayName;
    info.data = this._file;
    this.onFileChanged.emit(info);
  }
}

// Synthesize a transient `<input type="file">`, click it, resolve with
// the picked File or null. Hoisted to module scope so it's testable
// without instantiating a control.
//
// Why we attach the element to the DOM:
//   Calling `.click()` on a detached `<input type="file">` works in
//   most modern browsers, but a few configurations (older Safari, some
//   iOS WebViews, certain user-agent overrides) silently no-op the
//   call — the OS dialog never opens and no error is thrown. Parking
//   the element in `document.body` (off-screen, pointer-events:none)
//   for the lifetime of the dialog removes that footgun. The element
//   is removed as soon as the Promise settles either way.
export function openNativeFileDialog(accept = ''): Promise<File | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);
  return new Promise<File | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (accept) input.accept = accept;
    input.style.position = 'fixed';
    input.style.left = '-10000px';
    input.style.top = '-10000px';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
    let settled = false;
    const cleanup = (): void => {
      if (input.parentNode) input.parentNode.removeChild(input);
    };
    const settle = (file: File | null): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(file);
    };
    input.onchange = (): void => settle(input.files?.[0] ?? null);
    // `oncancel` is a 2024+ addition; supported browsers fire it when
    // the user dismisses the dialog. Where unsupported, the cleanup
    // happens on the next change/cancel that never comes — the element
    // sits off-screen until then, harmlessly.
    (input as unknown as { oncancel: (() => void) | null }).oncancel = (): void => settle(null);
    document.body.appendChild(input);
    try {
      input.click();
    } catch {
      settle(null);
    }
  });
}

// ---------------------------------------------------------------------------
// FolderPicker — unchanged; legacy `webkitdirectory`-based folder picker.
// Ports `Gwen::Controls::FolderPicker` from
// include/Gwen/Controls/FolderPicker.h. Returns just the root folder
// name string (the web sandbox doesn't expose a real path).
// ---------------------------------------------------------------------------

export class FolderPicker extends Base {
  readonly onFolderChanged = new Signal<EventInfo>();

  protected _textBox: TextBox;
  protected _button: Button;

  constructor(parent: Base | null) {
    super(parent);
    this.setSize(100, 20);

    this._button = new Button(this);
    this._button.dock(Pos.Right);
    this._button.setWidth(20);
    this._button.setText('..');
    this._button.setMargin(margin(2, 0, 0, 0));
    this._button.onPress.on(() => {
      void this.onBrowse();
    });

    this._textBox = new TextBox(this);
    this._textBox.dock(Pos.Fill);
  }

  setFolder(v: string): void {
    this._textBox.setText(v);
    const info = eventInfo();
    info.controlCaller = this;
    info.string = v;
    this.onFolderChanged.emit(info);
  }

  getFolder(): string {
    return this._textBox.getText();
  }

  getValue(): string {
    return this.getFolder();
  }

  setValue(v: string): void {
    this.setFolder(v);
  }

  getTextBox(): TextBox {
    return this._textBox;
  }

  getButton(): Button {
    return this._button;
  }

  protected async onBrowse(): Promise<void> {
    const path = await Dialogs.folderOpen(true, 'Open', '');
    if (path) this.setFolder(path);
  }
}
