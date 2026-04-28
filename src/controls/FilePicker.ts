// FilePicker + FolderPicker — composite controls that pair a TextBox
// with a "..." Button to launch the browser's native file/folder picker.
// Ports `Gwen::Controls::FilePicker` and `Gwen::Controls::FolderPicker`
// from include/Gwen/Controls/FilePicker.h + include/Gwen/Controls/FolderPicker.h.
//
// Composition:
//   * A TextBox docked `Pos.Fill` shows the current selection as an
//     editable string (users can paste or type a path even without the
//     picker).
//   * A Button docked `Pos.Right` (20px wide) with label ".." triggers
//     the system dialog via `Dialogs.fileOpen` / `Dialogs.folderOpen`.
//
// The picker dispatches an `onFileChanged` / `onFolderChanged` signal
// whenever the selection updates — either from a dialog return value or
// from a programmatic `setFileName` / `setFolder` call.
//
// Deviations from GWEN:
//   * The browser cannot return a full filesystem path for privacy; we
//     surface just the file *name* (or the root folder name for
//     `FolderPicker`). Callers that need the `File` blob itself should
//     hook the onchange event of the temporary <input> in Dialogs — a
//     richer API is deferred to a later task.
//   * `setValue` / `getValue` are aliases kept for API parity with the
//     rest of the property editors; future PropertyFilePicker bindings
//     rely on them.
//
// Platform constraints: the dialog implementation requires a DOM
// (`document`). In non-browser contexts (e.g. node-side test harness)
// the dialog functions return null and the picker keeps whatever string
// the user typed into its TextBox.
//
// Accessibility: pointer activation of the "..." button follows the
// usual Button rules — mouse, touch, and pen all land on the same
// code path.

import { Base } from './Base';
import { TextBox } from './TextBox';
import { Button } from './Button';
import { Signal, eventInfo, type EventInfo } from '../core/Events';
import { Pos } from '../core/Align';
import { margin } from '../core/Structures';
import * as Dialogs from './Dialogs';

// ---------------------------------------------------------------------------
// FilePicker — text field + browse button for a single file selection.
// ---------------------------------------------------------------------------

export class FilePicker extends Base {
  readonly onFileChanged = new Signal<EventInfo>();

  // Filter string in GWEN's "Label | *.ext" format. Passed verbatim to
  // Dialogs.fileOpen which parses the *.ext tokens into a browser
  // `accept` attribute.
  protected _fileType = 'Any Type | *.*';
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
    this._button.onPress.on(() => { void this.onBrowse(); });

    this._textBox = new TextBox(this);
    this._textBox.dock(Pos.Fill);
  }

  // =====================================================================
  // Filter configuration
  // =====================================================================

  setFileType(s: string): void {
    this._fileType = s;
  }

  getFileType(): string {
    return this._fileType;
  }

  // =====================================================================
  // File name accessors — the canonical value is the TextBox contents.
  // =====================================================================

  setFileName(v: string): void {
    this._textBox.setText(v);
    const info = eventInfo();
    info.controlCaller = this;
    info.string = v;
    this.onFileChanged.emit(info);
  }

  getFileName(): string {
    return this._textBox.getText();
  }

  // Property-editor shaped aliases — kept so a future PropertyFilePicker
  // can treat this like any other property without special-casing the
  // accessor names.
  getValue(): string {
    return this.getFileName();
  }

  setValue(v: string): void {
    this.setFileName(v);
  }

  getTextBox(): TextBox {
    return this._textBox;
  }

  getButton(): Button {
    return this._button;
  }

  // =====================================================================
  // Browse handler
  // =====================================================================

  protected async onBrowse(): Promise<void> {
    const path = await Dialogs.fileOpen(true, 'Open', '', this._fileType);
    if (path) this.setFileName(path);
  }
}

// ---------------------------------------------------------------------------
// FolderPicker — same shape as FilePicker but for directory selection.
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
    this._button.onPress.on(() => { void this.onBrowse(); });

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
