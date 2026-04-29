// Properties + PropertyRow + PropertyBase + PropertyText — the property
// grid (label column / value column separated by a draggable splitter).
// Ports `Gwen::Controls::Properties` (include/Gwen/Controls/Properties.h
// + src/Controls/Properties.cpp) and `Gwen::Controls::PropertyRow`
// + `Gwen::Controls::Property::Base` + `Gwen::Controls::Property::Text`
// from include/Gwen/Controls/Property/Text.h.
//
// Layout pattern:
//   * `Properties` owns a SplitterBar that slides horizontally; its x
//     position is the label-column width reported to the skin's
//     `drawPropertyRow`.
//   * Rows dock Top inside Properties so they stack.
//   * Inside each row the Label docks Left (width = splitter x) and the
//     property docks Fill. On every layout pass the row re-reads the
//     splitter x from its parent so resizing the column reshapes
//     everything automatically.

import { Base } from './Base';
import { Label } from './Label';
import { SplitterBar } from './SplitterBar';
import { TextBox } from './TextBox';
import { CheckBox } from './CheckBox';
import { ComboBox } from './ComboBox';
import { NumericUpDown } from './NumericUpDown';
import { Button } from './Button';
import { HSVColorPicker } from './HSVColorPicker';
import { Menu } from './Menu';
import { FilePicker, FolderPicker } from './FilePicker';
import { Signal, eventInfo, type EventInfo } from '../core/Events';
import { Pos } from '../core/Align';
import { CursorType, color as makeColor, margin, type Color } from '../core/Structures';
import type { Skin } from '../skin/Skin';

// ---------------------------------------------------------------------------
// PropertyBase — abstract contract every property editor implements.
// Subclasses (`PropertyText`, a future `PropertyColor`, ...) own their
// own editor child and translate its value to/from the canonical string
// representation stored in the grid.
// ---------------------------------------------------------------------------

export abstract class PropertyBase extends Base {
  readonly onChange = new Signal<EventInfo>();

  constructor(parent: Base | null) {
    super(parent);
    this.setHeight(17);
  }

  abstract getPropertyValue(): string;
  abstract setPropertyValue(v: string, fireEvents?: boolean): void;
  abstract isEditing(): boolean;
}

// ---------------------------------------------------------------------------
// PropertyText — plain string editor. Wraps a TextBox with background
// drawing disabled so it blends into the row strip.
// ---------------------------------------------------------------------------

export class PropertyText extends PropertyBase {
  protected _textbox: TextBox;

  constructor(parent: Base | null) {
    super(parent);
    this._textbox = new TextBox(this);
    this._textbox.dock(Pos.Fill);
    this._textbox.setShouldDrawBackground(false);
    this._textbox.onTextChange.on(() => {
      const info = eventInfo();
      info.controlCaller = this;
      info.string = this.getPropertyValue();
      this.onChange.emit(info);
    });
  }

  override getPropertyValue(): string {
    return this._textbox.getText();
  }

  override setPropertyValue(v: string, fireEvents = true): void {
    this._textbox.setText(v, fireEvents);
  }

  override isEditing(): boolean {
    return this._textbox.hasFocus();
  }

  getTextBox(): TextBox {
    return this._textbox;
  }
}

// ---------------------------------------------------------------------------
// PropertyCheckbox — boolean editor backed by a CheckBox. Canonical value
// is '1' for checked and '0' for unchecked, matching GWEN's
// `Property::Checkbox::GetPropertyValue()`. The row is a compact 18px
// tall to accommodate the 15px tick-box with a 1-pixel padding above.
// Accepts '1', 'true', 'TRUE', 'yes', 'YES' as truthy on set.
// ---------------------------------------------------------------------------

export class PropertyCheckbox extends PropertyBase {
  protected _cb: CheckBox;

  constructor(parent: Base | null) {
    super(parent);
    this._cb = new CheckBox(this);
    this._cb.setShouldDrawBackground(false);
    this._cb.setPos(2, 1);
    this._cb.setTabable(true);
    this._cb.setKeyboardInputEnabled(true);
    this._cb.onCheckChanged.on(() => {
      const info = eventInfo();
      info.controlCaller = this;
      info.string = this.getPropertyValue();
      this.onChange.emit(info);
    });
    this.setHeight(18);
  }

  override getPropertyValue(): string {
    return this._cb.isChecked() ? '1' : '0';
  }

  override setPropertyValue(v: string, _fireEvents = true): void {
    const truthy = v === '1' || v === 'true' || v === 'TRUE' || v === 'yes' || v === 'YES';
    this._cb.setChecked(truthy);
  }

  override isEditing(): boolean {
    return this._cb.hasFocus();
  }

  getCheckBox(): CheckBox {
    return this._cb;
  }
}

// ---------------------------------------------------------------------------
// PropertyComboBox — dropdown editor backed by a ComboBox. Canonical value
// is the selected item's `name`, matching GWEN's
// `Property::ComboBox::GetPropertyValue()`. Callers populate the choice
// list via `getComboBox().addItem(label, name)`.
// ---------------------------------------------------------------------------

export class PropertyComboBox extends PropertyBase {
  protected _cb: ComboBox;

  constructor(parent: Base | null) {
    super(parent);
    this._cb = new ComboBox(this);
    this._cb.dock(Pos.Fill);
    this._cb.setShouldDrawBackground(false);
    this._cb.setTabable(true);
    this._cb.setKeyboardInputEnabled(true);
    this._cb.onSelection.on(() => {
      const info = eventInfo();
      info.controlCaller = this;
      info.string = this.getPropertyValue();
      this.onChange.emit(info);
    });
    this.setHeight(18);
  }

  getComboBox(): ComboBox {
    return this._cb;
  }

  override getPropertyValue(): string {
    const item = this._cb.getSelectedItem();
    return item ? item.getName() : '';
  }

  override setPropertyValue(v: string, fireEvents = true): void {
    this._cb.selectItemByName(v, fireEvents);
  }

  override isEditing(): boolean {
    return this._cb.hasFocus();
  }
}

// ---------------------------------------------------------------------------
// PropertyNumeric — integer stepper editor backed by a NumericUpDown.
// Canonical value is the decimal integer as a string (matches how typed
// values round-trip through the underlying TextBoxNumeric). Out-of-range
// or non-numeric input clamps via NumericUpDown.setIntValue's range
// guard. The control's own up/down buttons live on the right; the row
// sits 18px tall to accommodate the 20-tall NumericUpDown without
// vertical clipping.
// ---------------------------------------------------------------------------

export class PropertyNumeric extends PropertyBase {
  protected _stepper: NumericUpDown;

  constructor(parent: Base | null) {
    super(parent);
    this._stepper = new NumericUpDown(this);
    this._stepper.dock(Pos.Fill);
    this._stepper.setShouldDrawBackground(false);
    this._stepper.setTabable(true);
    this._stepper.setKeyboardInputEnabled(true);
    this._stepper.onChange.on(() => {
      const info = eventInfo();
      info.controlCaller = this;
      info.string = this.getPropertyValue();
      this.onChange.emit(info);
    });
    this.setHeight(18);
  }

  getNumericUpDown(): NumericUpDown {
    return this._stepper;
  }

  override getPropertyValue(): string {
    return String(this._stepper.getIntValue());
  }

  override setPropertyValue(v: string, _fireEvents = true): void {
    const n = parseInt(v, 10);
    if (Number.isFinite(n)) this._stepper.setIntValue(n);
  }

  override isEditing(): boolean {
    return this._stepper.hasFocus();
  }
}

// ---------------------------------------------------------------------------
// PropertyRow — a label + editor row inside a Properties grid.
// ---------------------------------------------------------------------------

export class PropertyRow extends Base {
  readonly onChange = new Signal<EventInfo>();

  protected _label: Label;
  protected _property: PropertyBase | null = null;

  constructor(parent: Base | null) {
    super(parent);
    this._label = new Label(this);
    this._label.dock(Pos.Left);
    this._label.setAlignment(Pos.Left | Pos.CenterV);
    this._label.setMargin(margin(2, 0, 0, 0));
    this.setHeight(17);
  }

  getLabel(): Label {
    return this._label;
  }

  getProperty(): PropertyBase | null {
    return this._property;
  }

  setProperty(p: PropertyBase): void {
    this._property = p;
    // setParent is a no-op when `p` is already our child, but handles
    // the "detached prop constructed elsewhere then handed to us" path.
    if (p.parent !== this) p.setParent(this);
    p.dock(Pos.Fill);
    p.onChange.on(() => {
      const info = eventInfo();
      info.controlCaller = this;
      info.string = p.getPropertyValue();
      this.onChange.emit(info);
    });
  }

  isEditing(): boolean {
    return this._property ? this._property.isEditing() : false;
  }

  // =======================================================================
  // Layout — sync the label width to the parent Properties' splitter.
  // =======================================================================

  override layout(skin: Skin): void {
    super.layout(skin);
    const splitX = this.getParentSplitWidth();
    if (splitX !== null) {
      // Only the width matters for the Pos.Left docking pass; the dock
      // logic rewrites x/y anyway.
      this._label.setWidth(splitX);
    }
  }

  // =======================================================================
  // Render — delegates to skin. The hover highlight fires when either
  // the row itself or its editor is hovered.
  // =======================================================================

  override render(skin: Skin): void {
    const editing = this.isEditing();
    const hovered = this.isHovered() || (this._property ? this._property.isHovered() : false);
    const splitX = this.getParentSplitWidth();
    skin.drawPropertyRow(this, splitX !== null ? splitX : this._label.width(), editing, hovered);
  }

  // Private helper — walks up to the owning Properties, if any, and
  // returns its splitter position. Structural check (via instanceof) is
  // fine here: Properties and PropertyRow live in the same module so
  // there's no circular import concern.
  private getParentSplitWidth(): number | null {
    const p = this.parent;
    if (p instanceof Properties) return p.getSplitWidth();
    return null;
  }
}

// ---------------------------------------------------------------------------
// Properties — the grid container. Hosts a SplitterBar on top of the
// row stack; the bar's x is the label-column width.
// ---------------------------------------------------------------------------

export class Properties extends Base {
  readonly onChange = new Signal<EventInfo>();

  protected _splitter: SplitterBar;

  constructor(parent: Base | null) {
    super(parent);
    this._splitter = new SplitterBar(this);
    this._splitter.setPos(80, 0);
    this._splitter.setCursor(CursorType.SizeWE);
    this._splitter.setWidth(3);
    this._splitter.setShouldDrawBackground(false);
    this._splitter.setMouseInputEnabled(true);
    // Splitter spans the column gap rather than occupying space — its
    // 3px x its-own-height stripe shouldn't grow `sizeToChildren`'s
    // height tally, otherwise postLayout would settle on a max(rows,
    // splitter)-sized rect that doesn't shrink when rows clear out.
    // Mirrors Properties.cpp:23 (`m_SplitterBar->DoNotIncludeInSize()`).
    this._splitter.doNotIncludeInSize();
    // Splitter drags don't invalidate us automatically — the SplitterBar
    // only touches its own bounds, and `onChildBoundsChanged` is a no-op
    // on Base. We need child rows to re-layout when the split width
    // changes so their labels resize to match.
    this._splitter.onDragged.on(() => this.invalidateChildren());
  }

  getSplitWidth(): number {
    return this._splitter.x();
  }

  getSplitter(): SplitterBar {
    return this._splitter;
  }

  // Convenience factory — creates a PropertyRow with a PropertyText
  // pre-populated with `value` and wires up the onChange signal.
  add(name: string, value = ''): PropertyRow {
    const row = new PropertyRow(this);
    row.getLabel().setText(name);
    row.dock(Pos.Top);
    const prop = new PropertyText(row);
    prop.setPropertyValue(value, false);
    row.setProperty(prop);
    this.wireRow(row);
    this._splitter.bringToFront();
    return row;
  }

  // Raw version — caller supplies the PropertyBase instance. Use when
  // the property isn't a plain text field (PropertyCheckbox,
  // PropertyComboBox, PropertyColorSelector, ...). Mirrors GWEN's
  // `Properties::Add( text, prop, value )` so callers that pass a
  // value get the property's `onChange` fired with `bFireChangeEvents
  // = true`. PropertyColorSelector relies on that fire to repaint
  // its swatch from the value string.
  addRow(name: string, prop: PropertyBase, value = ''): PropertyRow {
    const row = new PropertyRow(this);
    row.getLabel().setText(name);
    row.dock(Pos.Top);
    if (prop.parent !== row) prop.setParent(row);
    row.setProperty(prop);
    prop.setPropertyValue(value, true);
    this.wireRow(row);
    this._splitter.bringToFront();
    return row;
  }

  private wireRow(row: PropertyRow): void {
    row.onChange.on((e) => {
      const info = eventInfo();
      info.controlCaller = this;
      info.control = row;
      info.string = e.string;
      this.onChange.emit(info);
    });
  }

  // =======================================================================
  // Layout — height auto-fits the row stack. Without this the grid stays
  // at Base's 10×10 default whenever its parent doesn't pre-size it (e.g.
  // a Properties grid docked Top inside a PropertyTreeNode), which makes
  // every row clip out of view. Mirrors Properties.cpp:26 PostLayout.
  // =======================================================================

  override postLayout(skin: Skin): void {
    super.postLayout(skin);
    if (this.sizeToChildren(false, true)) this.invalidateParent();
    this._splitter.setSize(3, this.height());
  }
}

// ---------------------------------------------------------------------------
// ColourButton — a compact square Button that paints a solid color
// swatch instead of the usual chrome. Ports the internal helper class
// used by `Gwen::Controls::Property::ColorSelector`.
// ---------------------------------------------------------------------------

class ColourButton extends Button {
  protected _color: Color = makeColor(255, 255, 255, 255);

  constructor(parent: Base | null) {
    super(parent);
    this.setWidth(20);
    this.setShouldDrawBackground(false);
    this.setText('');
  }

  setButtonColor(c: Color): void {
    this._color = c;
    this.redraw();
  }

  override render(skin: Skin): void {
    skin.renderer.setDrawColor(this._color);
    skin.renderer.drawFilledRect(this.getRenderBounds());
  }
}

// ---------------------------------------------------------------------------
// PropertyColorSelector — text-editable "R G B" property that also
// embeds a colour swatch button; clicking the swatch opens a popup
// HSVColorPicker. Ports `Gwen::Controls::Property::ColorSelector` from
// include/Gwen/Controls/Property/ColorSelector.h.
//
// Canonical value: "R G B" with channels in 0..255 space (e.g. "255 128 0").
// Typing into the TextBox updates the swatch live.
// ---------------------------------------------------------------------------

export class PropertyColorSelector extends PropertyText {
  protected _button: ColourButton;

  constructor(parent: Base | null) {
    super(parent);
    // GWEN parents the swatch button inside the TextBox. We deviate
    // here and parent it to `this` so the button isn't squeezed by the
    // TextBox's 4×2 text padding (which leaves only ~10px for the
    // button's height — the swatch becomes a thin sliver). Docked
    // `Right` on the PropertyColorSelector itself, the button gets
    // the row's full height minus its margin (~14px tall), matching
    // the size shown in GWEN UnitTest screenshots. The TextBox is
    // already docked Fill by PropertyText's constructor; non-Fill
    // docks are processed first, so the textbox auto-shrinks to make
    // room.
    this._button = new ColourButton(this);
    this._button.dock(Pos.Right);
    this._button.setMargin(margin(1, 1, 1, 2));
    this._button.setWidth(20);
    this._button.onPress.on(() => this.onButtonPress());
    this._textbox.onTextChange.on(() => this.updateSwatch());
    // Seed the swatch from the default value.
    this.updateSwatch();
  }

  // Open a transient Menu as the popover host for the HSV picker. Menu
  // gives us auto-hide-on-outside-click and the correct z-ordering; the
  // `deleteOnClose` flag ensures the picker gets torn down cleanly.
  protected onButtonPress(): void {
    const canvas = this.getCanvas();
    if (!canvas) return;
    const menu = new Menu(canvas as unknown as Base);
    menu.setSize(256, 180);
    menu.setDeleteOnClose(true);
    menu.setDisableIconMargin(true);

    const picker = new HSVColorPicker(menu);
    picker.setSize(256, 150);
    picker.setColor(this.parseColor(), false, true);
    picker.onColorChanged.on(() => {
      const c = picker.getColor();
      this.setPropertyValue(`${c.r} ${c.g} ${c.b}`, true);
    });

    // Drop the menu just below the swatch button.
    const canvasPos = this._button.localPosToCanvas({ x: 0, y: this._button.height() });
    menu.open(canvasPos);
    menu.bringToFront();
  }

  // Parse the canonical "R G B" string. Missing/invalid channels default
  // to 255 so an empty textbox renders as white rather than black.
  protected parseColor(): Color {
    const parts = this.getPropertyValue().split(/\s+/).map((s) => parseInt(s, 10));
    const r = Number.isFinite(parts[0]) ? parts[0] : 255;
    const g = Number.isFinite(parts[1]) ? parts[1] : 255;
    const b = Number.isFinite(parts[2]) ? parts[2] : 255;
    return makeColor(r, g, b, 255);
  }

  protected updateSwatch(): void {
    this._button.setButtonColor(this.parseColor());
  }

  getColorButton(): Button {
    return this._button;
  }
}

// ---------------------------------------------------------------------------
// PropertyFile — file-picker property editor. Wraps a FilePicker docked
// Fill. The picker holds a real `File` blob for the current selection
// (accessible via `getFile()`); the canonical string value used by the
// PropertyBase contract is `file.name`, since the grid serialises rows
// as strings. Calling `setPropertyValue('foo.txt')` rehydrates the
// display name only — the bytes are not recoverable from a name, so
// `getFile()` returns null until the user re-picks. Ports
// `Gwen::Controls::Property::File` from include/Gwen/Controls/Property/File.h.
// ---------------------------------------------------------------------------

export class PropertyFile extends PropertyBase {
  protected _picker: FilePicker;

  constructor(parent: Base | null) {
    super(parent);
    this._picker = new FilePicker(this);
    this._picker.dock(Pos.Fill);
    this._picker.onFileChanged.on(() => {
      const info = eventInfo();
      info.controlCaller = this;
      info.string = this.getPropertyValue();
      this.onChange.emit(info);
    });
    // 22 to give the picker's Browse… button enough vertical room; the
    // standard 18-tall row would clip the button label.
    this.setHeight(22);
  }

  getFilePicker(): FilePicker {
    return this._picker;
  }

  /** Convenience — same as `getFilePicker().getFile()`. */
  getFile(): File | null {
    return this._picker.getFile();
  }

  override getPropertyValue(): string {
    return this._picker.getFileName();
  }

  override setPropertyValue(v: string, _fireEvents = true): void {
    this._picker.setValue(v);
  }

  override isEditing(): boolean {
    return false;
  }
}

// ---------------------------------------------------------------------------
// PropertyFolder — folder-picker property editor. Wraps a FolderPicker
// docked Fill; canonical value is the folder name string. Ports
// `Gwen::Controls::Property::Folder` from include/Gwen/Controls/Property/Folder.h.
// ---------------------------------------------------------------------------

export class PropertyFolder extends PropertyBase {
  protected _picker: FolderPicker;

  constructor(parent: Base | null) {
    super(parent);
    this._picker = new FolderPicker(this);
    this._picker.dock(Pos.Fill);
    this._picker.onFolderChanged.on(() => {
      const info = eventInfo();
      info.controlCaller = this;
      info.string = this.getPropertyValue();
      this.onChange.emit(info);
    });
    this.setHeight(18);
  }

  getFolderPicker(): FolderPicker {
    return this._picker;
  }

  override getPropertyValue(): string {
    return this._picker.getFolder();
  }

  override setPropertyValue(v: string, _fireEvents = true): void {
    this._picker.setFolder(v);
  }

  override isEditing(): boolean {
    return false;
  }
}
