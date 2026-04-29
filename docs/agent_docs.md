# GwenJs — Agent Documentation

Reference material aimed at AI coding agents (Claude, Copilot, Cursor, etc.) that need to write GwenJs code. Dense, example-first, no prose filler.

## Import

ESM (after a bundler resolves `src/index.ts` or a relative import into `dist/`):

```ts
import * as Gwen from 'gwen';
```

Classic script (bundle on page defines a global `Gwen`):

```html
<script src="dist/gwen.min.js"></script>
<script>
  const btn = new Gwen.Button(parent);
</script>
```

Every export listed here lives on that `Gwen` namespace.

## Minimal scaffold

```ts
const el = document.getElementById('gwen-canvas') as HTMLCanvasElement;
el.width = el.clientWidth; el.height = el.clientHeight;
const renderer = new Gwen.WebGL2Renderer(el); renderer.init();
const skin = new Gwen.Skin(renderer); skin.init();
const canvas = new Gwen.Canvas(skin, el);
canvas.setBounds(0, 0, el.clientWidth, el.clientHeight);
const loop = () => { canvas.doThink(); canvas.renderCanvas(); requestAnimationFrame(loop); };
requestAnimationFrame(loop);
```

## Control API table

Every public control, its direct base class, primary signals, and purpose. Constructors all take `(parent: Base | null)` unless noted; `WindowControl` also accepts `(parent, title)`.

| Class | Extends | Key signals | Purpose |
| --- | --- | --- | --- |
| `Base` | — | `onHoverEnter`, `onHoverLeave` | Root of every control. Tree + bounds + layout. |
| `Canvas` | `Base` | — | Root control. Owns renderer + skin + input. |
| `Label` | `Base` | — | Single-line text with alignment. |
| `Button` | `Label` | `onPress`, `onRightPress`, `onDown`, `onUp`, `onDoubleClick`, `onToggle`, `onToggleOn`, `onToggleOff` | Clickable + toggleable. |
| `CheckBox` | `Button` | `onChecked`, `onUnChecked`, `onCheckChanged` | Tick box. |
| `CheckBoxWithLabel` | `Base` | — (use `getCheckBox()`) | CheckBox + LabelClickable. |
| `RadioButton` | `CheckBox` | — (inherits CheckBox) | Exclusive tick, refuses uncheck. |
| `LabeledRadioButton` | `Base` | — | RadioButton + LabelClickable. |
| `RadioButtonController` | `Base` | `onSelectionChange` | Group of RadioButtons. |
| `TextBox` | `Label` | `onTextChange`, `onReturnPressed` | Single-line editable text. |
| `TextBoxNumeric` | `TextBox` | — | Digits + optional minus/decimal. |
| `TextBoxMultiline` | `TextBox` | — | Enter inserts newline. |
| `PasswordTextBox` | `TextBox` | — | Masked display. |
| `NumericUpDown` | `TextBoxNumeric` | `onChanged` | TextBox + spinner buttons. |
| `Slider` | `Base` | `onValueChanged` | Abstract; use H/V variants. |
| `HorizontalSlider` | `Slider` | — | Horizontal variant. |
| `VerticalSlider` | `Slider` | — | Vertical variant. |
| `SliderBar` | `Dragger` | — | Thumb (internal). |
| `ProgressBar` | `Label` | — | Fill bar with percent text. |
| `ImagePanel` | `Base` | — | Atlas region as an image. |
| `Rectangle` | `Base` | — | Solid colour fill. |
| `GroupBox` | `Label` | — | Bordered frame with title. |
| `StatusBar` | `Label` | — | Bottom strip. |
| `FieldLabel` | `Base` | — | Label + input in one row. |
| `LabelClickable` | `Button` | — | Hyperlink-style label. |
| `RichLabel` | `Base` | — | Multi-colour, multi-run text. |
| `Dragger` | `Base` | `onDragStart`, `onDragEnd` | Drag controller (internal). |
| `Resizer` | `Dragger` | `onResize` | Edge / corner grip. |
| `BaseScrollBar` | `Base` | `onBarMoved` | Scrollbar base. |
| `HorizontalScrollBar` | `BaseScrollBar` | — | Horizontal scrollbar. |
| `VerticalScrollBar` | `BaseScrollBar` | — | Vertical scrollbar. |
| `ScrollControl` | `Base` | — | Viewport + scrollbars. |
| `Menu` | `ScrollControl` | `onMenuClosed` | Popup menu. |
| `MenuItem` | `Button` | `onSelect`, `onMenuItemSelected`, `onChecked`, `onUnChecked`, `onCheckChanged` | Menu row. |
| `MenuDivider` | `Base` | — | Horizontal separator. |
| `MenuStrip` | `Menu` | — | Horizontal top menu bar. |
| `ComboBox` | `Button` | `onSelection` | Button + popup Menu. |
| `ListBox` | `ScrollControl` | `onRowSelected`, `onRowDoubleClick` | Selectable list. |
| `ListBoxRow` | `Button` | — (via ListBox) | Row entry. |
| `TreeNode` | `Base` | `onNamePress`, `onRightPress`, `onSelect`, `onUnselect`, `onSelectChange` | Tree row with children. |
| `TreeControl` | `TreeNode` | — (inherits) | Scrollable tree root. |
| `ToolBarButton` | `Button` | — | Toolbar icon button. |
| `ToolBarStrip` | `Base` | — | Row of ToolBarButtons. |
| `CollapsibleCategory` | `Base` | `onSelection` | Expandable category. |
| `CollapsibleList` | `ScrollControl` | — | Multi-category list. |
| `TabButton` | `Button` | — | Tab header. |
| `TabStrip` | `Base` | — | Row of tab buttons. |
| `TabTitleBar` | `Label` | — | Title bar for docked tabs. |
| `TabControl` | `Base` | `onLoseTab`, `onAddTab` | Tabbed container. |
| `DockedTabControl` | `TabControl` | — | Tab control for dock zones. |
| `DockBase` | `Base` | — | Four-edge docking host. |
| `PageControl` | `Base` | `onPageChanged` | Wizard pager. |
| `Modal` | `Base` | — | Canvas-spanning blocker. |
| `Highlight` | `Base` | — | Drop-zone indicator. |
| `Layout.Position` | `Base` | — | Anchors non-docked children. |
| `Layout.Center` | `Layout.Position` | — | Pre-centres children. |
| `Layout.Table` | `Base` | — | Row/column grid. |
| `Layout.TableRow` | `Base` | — | One row in a Table. |
| `Layout.Tile` | `Base` | — | Wrap-flow tiles. |
| `ResizableControl` | `Base` | `onResize` | Base with 8 Resizers. |
| `WindowCloseButton` | `Button` | — | Title-bar X. |
| `WindowMaximizeButton` | `Button` | — | Title-bar maximise. |
| `WindowMinimizeButton` | `Button` | — | Title-bar minimise. |
| `WindowControl` | `ResizableControl` | `onWindowClosed` | Floating window. |
| `SplitterBar` | `Dragger` | — | Splitter divider. |
| `SplitterVertical` | `Base` | — | Two-panel vertical split. |
| `SplitterHorizontal` | `Base` | — | Two-panel horizontal split. |
| `CrossSplitter` | `Base` | — | 2×2 split with zoom. |
| `ColorDisplay` | `Base` | — | Small swatch. |
| `ColorLerpBox` | `Base` | `onColorChanged` | 2D HSV box. |
| `ColorSlider` | `Base` | `onColorChanged` | Hue slider. |
| `ColorPicker` | `Base` | `onColorChanged` | RGBA sliders + numeric. |
| `HSVColorPicker` | `Base` | `onColorChanged` | LerpBox + Slider + inputs. |
| `Properties` | `Base` | — | Label/value grid. |
| `PropertyRow` | `Base` | `onChange` | One row in Properties. |
| `PropertyBase` | `Base` | `onChange` | Abstract property editor. |
| `PropertyText` | `PropertyBase` | `onChange` | String editor. |
| `PropertyCheckbox` | `PropertyBase` | `onChange` | Bool editor. |
| `PropertyNumeric` | `PropertyBase` | `onChange` | Integer stepper editor (NumericUpDown). |
| `PropertyComboBox` | `PropertyBase` | `onChange` | Enum editor. |
| `PropertyColorSelector` | `PropertyBase` | `onChange` | Colour editor with HSV popup. |
| `PropertyFile` | `PropertyBase` | `onChange` | File picker editor. |
| `PropertyFolder` | `PropertyBase` | `onChange` | Folder picker editor. |
| `PropertyTree` | `TreeControl` | — | Tree of property groups. |
| `PropertyTreeNode` | `TreeNode` | — | Tree node hosting a Properties. |
| `FilePicker` | `Base` | `onFileChanged` | File-blob picker (read-only path + clear + browse). Holds a `File` reference; `getFile()` returns the blob, `getFileName()` the basename. |
| `FolderPicker` | `Base` | `onFolderChanged` | Folder name picker (uses `webkitdirectory`). Returns the folder name only — sandboxed browsers don't expose a real path. |

## Pattern cookbook

### Build a form (Properties grid)

`Properties.add(label, value?)` creates a plain text row. For richer editors —
checkbox, numeric stepper, dropdown, colour, file/folder — use
`addRow(label, prop, value?)` and pass a constructed `PropertyBase` subclass
parented to the grid.

```ts
const props = new Gwen.Properties(parent);
props.dock(Gwen.Pos.Fill);
const name = props.add('Name', 'Unnamed');                        // PropertyText
name.onChange.on((e) => console.log('name →', e.string));

props.addRow('Enabled', new Gwen.PropertyCheckbox(props), '1');    // bool
props.addRow('Tint',    new Gwen.PropertyColorSelector(props), '255 0 0');
const stepper = new Gwen.PropertyNumeric(props);
stepper.getNumericUpDown().setMin(0);
stepper.getNumericUpDown().setMax(100);
props.addRow('Speed', stepper, '50');

const combo = new Gwen.PropertyComboBox(props);
combo.getComboBox().addItem('Linear',     'lin');
combo.getComboBox().addItem('Exponential','exp');
props.addRow('Easing', combo, 'lin');
```

For a collapsible group of grids, use `PropertyTree`:

```ts
const tree = new Gwen.PropertyTree(parent);
tree.setBounds(10, 10, 260, 320);
const general = tree.add('General');
general.add('Title', 'Untitled');
general.addRow('Enabled', new Gwen.PropertyCheckbox(general), '1');
tree.expandAll();   // open every group at startup
```

### Dock three panels

```ts
const dock = new Gwen.DockBase(canvas);
dock.dock(Gwen.Pos.Fill);
dock.getLeft().getTabControl()?.addPage('Tools');
dock.getBottom().getTabControl()?.addPage('Console');
dock.getTabControl()?.addPage('Main');
```

### Open a modal dialog

```ts
Gwen.Dialogs.query(
  canvas,
  'Save changes?',
  () => console.log('yes'),
  () => console.log('no'),
  () => console.log('cancel'),
);
```

### Context menu at pointer

```ts
const menu = new Gwen.Menu(canvas);
menu.addItem('Copy').onSelect.on(() => console.log('copy'));
menu.addItem('Paste').onSelect.on(() => console.log('paste'));
menu.open(Gwen.point(canvas.mousePosition.x, canvas.mousePosition.y));
```

### Icon gutter on a menu

The 24px left column for menu-item icons is hidden by default. Call
`setShowIconMargin(true)` on any `Menu` (or submenu) that should reserve
the column even for items without explicit icons:

```ts
const sub = parentItem.getMenu();
sub.setShowIconMargin(true);
sub.addItem('First');
sub.addItem('Second', 'icons/star.png');  // image fills the gutter
```

### Toggle-able button

```ts
const b = new Gwen.Button(parent);
b.setText('Bold');
b.setIsToggle(true);
b.onToggleOn.on(() => console.log('on'));
b.onToggleOff.on(() => console.log('off'));
```

### Button with an icon

```ts
const tex = await Gwen.ImagePanel.loadFromURL('icons/save.png', renderer);
const b = new Gwen.Button(parent);
b.setBounds(20, 20, 120, 22);
b.setText('Save');
b.setImageTexture(tex, 16, 16);            // icon left of label
// Icon-only button: pass center=true and size the button to the icon.
const iconOnly = new Gwen.Button(parent);
iconOnly.setBounds(20, 50, 28, 22);
iconOnly.setImageTexture(tex, 16, 16, true);
```

`ImagePanel` follows the same pattern: `panel.setTexture(tex)` after `loadFromURL` resolves, or `panel.setTextureFromSource(canvas, renderer)` for an in-memory `OffscreenCanvas` / `HTMLCanvasElement`.

### Slider value changes

```ts
const s = new Gwen.HorizontalSlider(parent);
s.setBounds(10, 10, 200, 20);
s.setRange(0, 100);
s.setFloatValue(50);
s.onValueChanged.on((e) => console.log('value →', (e.controlCaller as Gwen.HorizontalSlider).getFloatValue()));
```

### Pick a file and read its bytes

`FilePicker` is a composite control: a read-only path display, a clear (✕) button, and a Browse… button. The Browse… button opens the browser's native file dialog and the picker holds a real `File` reference (a `Blob` subclass) that callers can read with `arrayBuffer()` / `text()` / `stream()`. The clear button is hidden until a file (or display name) is held — the dock pass reflows Browse… flush against the right edge when there's nothing to clear, so the layout stays minimal.

```ts
const fp = new Gwen.FilePicker(parent);
fp.setBounds(20, 20, 360, 22);
fp.setAccept('image/*');                 // or fp.setFileType('Images | *.png;*.jpg')

fp.onFileChanged.on(async () => {
  const f = fp.getFile();                // File | null
  if (!f) return;                        // user cleared
  const buf = await f.arrayBuffer();
  console.log(`${f.name}: ${buf.byteLength} bytes (${f.type})`);
});
```

To load the picked file into an `ImagePanel`:

```ts
fp.onFileChanged.on(() => {
  const f = fp.getFile();
  if (!f) { panel.setTexture(Gwen.texture()); return; }
  const url = URL.createObjectURL(f);
  Gwen.ImagePanel.loadFromURL(url, renderer)
    .then((tex) => panel.setTexture(tex))
    .finally(() => URL.revokeObjectURL(url));
});
```

`PropertyFile` wraps the same picker for property grids; access the blob via `prop.getFile()`:

```ts
const props = new Gwen.Properties(parent);
props.setBounds(20, 20, 320, 60);
const row = props.addRow('Attachment', new Gwen.PropertyFile(props));
row.onChange.on(() => {
  const prop = row.getProperty() as Gwen.PropertyFile;
  console.log('attached:', prop.getFile());
});
```

Keyboard nav: the Browse and Clear buttons are tabable; the path display is not (it's read-only and the canonical state lives in the held `File`).

## Event payloads

Every signal with data uses `EventInfo`:

| Field | Type | Typical contents |
| --- | --- | --- |
| `controlCaller` | `unknown` (usually the firing control) | The control whose signal fired. |
| `control` | `unknown` | Related control (e.g. drop source, selected row). |
| `data` | `unknown` | Control-specific payload (e.g. `MenuItem` sets it to the raw item ref; `FilePicker.onFileChanged` sets it to the held `File` or `null`). |
| `string` | `string` | Text value on text-bearing controls (`PropertyText.onChange`, etc.). |
| `point` | `Point` | Pointer location when the event originated. |
| `integer` | `number` | Numeric index (selected row, key code in key events). |

Handlers receive a fresh `EventInfo` per emit. Don't retain references across frames.

## Common gotchas

- `addChild` is not idempotent. Adding the same child twice appends it twice to the children list. Always remove or reparent first.
- `setColor` arithmetic clamps to 0..255; GWEN's upstream does not. Passing out-of-range values silently saturates.
- `signal.on(fn)` returns a disposer; call it to unsubscribe. Re-subscribing the same `fn` produces two independent subscriptions.
- Disposing a control uses `.dispose()`. There are no C++-style destructors; forget to dispose and you'll leak listeners on next teardown.
- Pointer events only. Do not attach `mousedown` / `touchstart` to the canvas element — `attachInput()` already handles them and extra listeners will fight over `preventDefault`.
- `Canvas` must run `doThink()` before `renderCanvas()` each frame. Reversing the order renders last frame's layout.
- `DockBase.getLeft()` etc. lazily create child docks. Calling `getLeft()` on the fill-area's `DockedTabControl` panel does not make sense — use the parent `DockBase`.
- `WindowControl` is closable by default; call `setClosable(false)` to pin it.
- `Signal<T>` emits synchronously. Long-running handlers block the frame.
- Text input needs `canvas.focus()` (the HTML element) — the input router auto-sets `tabIndex = 0` on attach so users can click-to-focus.
- Tab navigation is scoped. `WindowControl`, `Modal`, `DockBase` (each docked region), and every `TabControl` page are tab boundaries — Tab/Shift+Tab cycles within the nearest boundary instead of leaking into siblings. Mark a custom container as a boundary with `ctrl.setTabBoundary(true)`.
- `Button` (and every subclass) is tabable + keyboard-active by default. Space and Enter on a focused button fire `onPress`; on a focused `CheckBox` / `RadioButton` they toggle. Subclasses that genuinely shouldn't take focus (`MenuItem`, `ListBoxRow`, `TabButton`, window chrome buttons, tree toggle / title) opt out via `setTabable(false)` in their own constructors.
- List-style containers consume arrows: `ListBox` (Up/Down + Home/End), `RadioButtonController` (Up/Down/Left/Right), `TabControl` (Left/Right/Up/Down + Home/End cycles tabs), `TreeControl` (Up/Down through visible nodes; Left collapses or jumps to parent; Right expands or descends). Each one is itself the single tab stop — its rows / options / pages stay non-tabable.
- `Slider.setClampToNotches(true)` snaps both the value AND the bar visual on every drag tick. Don't poll `_bar.x()` mid-drag and expect a free-form pixel — it'll be re-pinned to the nearest notch by `onMoved`.

## Minimal runnable HTML

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
  <style>html,body{margin:0;height:100%;overflow:hidden;touch-action:none}canvas{display:block;width:100vw;height:100vh}</style>
</head>
<body>
  <canvas id="c"></canvas>
  <script src="dist/gwen.min.js"></script>
  <script>
    const el = document.getElementById('c');
    el.width = el.clientWidth; el.height = el.clientHeight;
    const renderer = new Gwen.WebGL2Renderer(el); renderer.init();
    const skin = new Gwen.Skin(renderer); skin.init();
    const canvas = new Gwen.Canvas(skin, el);
    canvas.setBounds(0, 0, el.clientWidth, el.clientHeight);
    canvas.setDrawBackground(true);
    canvas.setBackgroundColor(Gwen.color(40, 40, 40, 255));
    const btn = new Gwen.Button(canvas);
    btn.setBounds(20, 20, 120, 24);
    btn.setText('Hello');
    btn.onPress.on(() => btn.setText('Clicked'));
    (function loop() { canvas.doThink(); canvas.renderCanvas(); requestAnimationFrame(loop); })();
  </script>
</body>
</html>
```
