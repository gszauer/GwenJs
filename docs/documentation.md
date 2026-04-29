# GwenJs — Documentation

## 1. Introduction

GwenJs is a TypeScript port of [GWEN](https://github.com/garrynewman/GWEN), the C++ immediate-parent retained-mode GUI library originally designed for embedding in game engines. The port targets the modern web: rendering goes through WebGL2, input unifies mouse / touch / pen through PointerEvents, and the whole library ships as a single file with zero runtime dependencies.

GwenJs exists because the web platform lacks a small, self-contained GUI toolkit that renders on the GPU, handles touch as a first-class input, and doesn't drag in a framework. GWEN's control set — buttons, windows, tabs, trees, property grids, docking panels — maps cleanly onto a canvas-hosted retained-mode tree, and porting it in full kept the surface API stable for anyone who already knows the C++ library.

Key features:

- **WebGL2 rendering.** Single shader, batched triangles, scissor-based clipping.
- **Touch + desktop.** PointerEvents drive the input router; long-press synthesises a right-click, two-finger gestures surface as expected.
- **Zero runtime dependencies.** Only browser APIs. The skin atlas is rasterised at startup via an `OffscreenCanvas`, fonts via `ctx.fillText` into a glyph texture.
- **Docking.** `DockBase` + `DockedTabControl` provide IDE-style four-edge docking with tear-off tabs.
- **Full control library.** ~60 control classes: text editing, lists, trees, menus, tabs, splitters, colour pickers, property grids, modal dialogs.

The port currently has 1624 passing Playwright tests across desktop and mobile projects; the library build (`dist/gwen.min.js`) is approximately 199 KB raw / 49 KB gzipped.

## 2. Installation

The simplest path is to drop a script tag on the page:

```html
<canvas id="gwen-canvas"></canvas>
<script src="dist/gwen.min.js"></script>
```

The bundle defines a global `Gwen` namespace containing every public class and helper listed in `src/index.ts`.

To build from source:

```
cd GwenJs
npm install
npm run build
```

The build emits `dist/gwen.js` (readable + sourcemap), `dist/gwen.min.js` (production), and `dist/demo.js` (the showcase demo). `npm run build:watch` keeps a rebuild loop running.

## 3. Quick start

The minimum viable app wires a renderer, a skin, a canvas, and at least one control:

```ts
const el = document.getElementById('gwen-canvas') as HTMLCanvasElement;
el.width = el.clientWidth;
el.height = el.clientHeight;

const renderer = new Gwen.WebGL2Renderer(el);
renderer.init();
const skin = new Gwen.Skin(renderer);
skin.init();
const canvas = new Gwen.Canvas(skin, el);
canvas.setBounds(0, 0, el.clientWidth, el.clientHeight);

const btn = new Gwen.Button(canvas);
btn.setBounds(20, 20, 120, 24);
btn.setText('Click me');
btn.onPress.on(() => console.log('clicked'));

const tick = (): void => {
  canvas.doThink();
  canvas.renderCanvas();
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);
```

## 4. Core concepts

**Control tree.** Every on-screen element inherits from `Base` (`src/controls/Base.ts`). Controls form a tree through `parent` and `children`; `addChild()` and `setParent()` keep both sides in sync. Some controls install an `innerPanel` (e.g. `ScrollControl`) so later `addChild` calls flow transparently into the panel — callers still see a single logical parent.

**Layout pipeline.** Controls carry a `dock` flag (`Pos.Left`, `Pos.Right`, `Pos.Top`, `Pos.Bottom`, `Pos.Fill`, or `Pos.None`) plus `margin` and `padding`. `Canvas.doThink()` runs `recurseLayout()` once per frame, which assigns screen-space bounds to each child according to their dock order, strips consumed space for the next sibling, and recurses.

**Render pipeline.** `Canvas.renderCanvas()` clears the GL context, walks the control tree, and calls `render(skin)` on each visible control. The `Skin` dispatches atlas-sourced 9-slice blits through the `WebGL2Renderer`, which batches triangles until state change (texture swap, scissor change, end-of-frame) forces a flush.

**Events.** Controls expose a handful of `Signal<T>` objects for each notable state transition. Subscribe via `signal.on(fn)`; the returned disposer function removes the subscription. Signals are re-entrant-safe: handlers may mutate the subscriber list mid-dispatch.

**Skin dispatch.** The `Skin` class (`src/skin/Skin.ts`) has one method per visual element (`drawButton`, `drawWindow`, `drawTabButton`, ...). Subclasses can override individual draw methods to theme specific controls without touching the atlas.

## 5. Building blocks

Controls are grouped loosely into families. A one-liner each:

- **Text:** `Label`, `RichLabel`, `LabelClickable`, `FieldLabel` — non-interactive (or hyperlink-style) text.
- **Buttons:** `Button`, `CheckBox`, `CheckBoxWithLabel`, `RadioButton`, `LabeledRadioButton`, `RadioButtonController`.
- **Inputs:** `TextBox`, `TextBoxNumeric`, `TextBoxMultiline`, `PasswordTextBox`, `NumericUpDown`, `Slider` (Horizontal/Vertical), `ProgressBar`.
- **Containers:** `GroupBox`, `StatusBar`, `ImagePanel`, `Rectangle`, `ScrollControl`, `CollapsibleCategory`, `CollapsibleList`.
- **Trees / lists:** `TreeControl`, `TreeNode`, `ListBox`, `ListBoxRow`.
- **Menus:** `Menu`, `MenuItem`, `MenuDivider`, `MenuStrip`, `ComboBox`.
- **Tabs:** `TabControl`, `TabButton`, `TabStrip`, `DockedTabControl`, `PageControl`.
- **Windows:** `WindowControl`, `ResizableControl`, `WindowCloseButton`, `ToolBarStrip`, `ToolBarButton`.
- **Splitters:** `SplitterBar`, `SplitterVertical`, `SplitterHorizontal`, `CrossSplitter`.
- **Docking:** `DockBase`.
- **Colour:** `ColorPicker`, `HSVColorPicker`, `ColorLerpBox`, `ColorSlider`, `ColorDisplay`.
- **Property grid:** `Properties`, `PropertyRow`, `PropertyText`, `PropertyCheckbox`, `PropertyNumeric`, `PropertyComboBox`, `PropertyColorSelector`, `PropertyFile`, `PropertyFolder`, `PropertyTree`, `PropertyTreeNode`.
- **File pickers:** `FilePicker` (read-only path + clear + Browse…; holds a real `File` blob), `FolderPicker` (`webkitdirectory`-based).
- **Dialogs:** `Dialogs.fileOpen`, `Dialogs.fileSave`, `Dialogs.folderOpen`, `Dialogs.query`.
- **Layout helpers:** `Layout.Position`, `Layout.Center`, `Layout.Table`, `Layout.TableRow`, `Layout.Tile`.

## 6. Docking

`DockBase` is the headline composite. Each dock instance lazily allocates child dock panels on its four edges on first access. Every child dock owns a `DockedTabControl` that can receive dropped tab buttons from any other `DockedTabControl`. A four-panel layout looks like:

```ts
const dock = new Gwen.DockBase(canvas);
dock.dock(Gwen.Pos.Fill);

const left = dock.getLeft();
const top = dock.getTop();
const right = dock.getRight();

left.getTabControl()?.addPage('Tools');
top.getTabControl()?.addPage('Timeline');
right.getTabControl()?.addPage('Inspector');
dock.getTabControl()?.addPage('Scene');   // fill area
```

Each docked panel's tab strip docks **Top** and renders as a gradient header — the strip itself is the title bar with the tab buttons embedded directly inside it (VS-Code / browser style). Two drag affordances:

- **Tab button drag** (`TabButtonMove`). Grabbing a `TabButton` and dropping it onto another dock's edge / fill reparents that single tab.
- **Whole-dock drag** (`TabWindowMove`). Grabbing empty space on the strip — anywhere not covered by a tab — drags the entire `DockedTabControl` and its tabs as a unit.

Hovering with either drag in flight paints a directional highlight inside the receiving dock so the user can preview which slot will absorb the drop. Child docks hide themselves when emptied and reappear when a tab is dropped on their edge.

## 7. Custom rendering

`DynamicSkin` (`src/skin/DynamicSkin.ts`) paints every control region — button, window chrome, scrollbar, checkbox, tab — into a single 512×512 `OffscreenCanvas`, then uploads the result as one texture page. The atlas layout mirrors upstream GWEN's `DefaultSkin.png` so existing palette-probe code continues to work.

To customise, subclass `DynamicSkin` and override `drawRegion(name, ctx, x, y, w, h)` for specific region names (they are enumerated in `src/skin/AtlasRegions.ts`). More invasively, subclass `Skin` directly to change the dispatch logic — every `drawXxx` method takes the control plus optional state flags.

Colours are exposed through `skin.colors` (a structured object). Palette tweaks don't require regenerating the atlas; text and border colours are sampled at draw time.

## 8. Touch support

The input router (`src/core/Input.ts`) subscribes to PointerEvents on the canvas. Mouse, pen, and touch all drive the same `inputMouseMoved / inputMouseButton` path. Touch-specific behaviour:

- **Long-press.** Holding a single touch for 500 ms without moving more than 10 pixels synthesises a right-click.
- **Two-finger tap.** A second finger landing while one is already down promotes the gesture to a right-click, cancelling the pending left-click on the first finger.
- **Scroll / pinch.** `inputMouseWheel` receives wheel or pinch deltas; consumers like `ScrollControl` handle them transparently.

Key repeat (30 ms rate, 300 ms initial delay) is driven by the canvas think loop, so focus changes mid-hold cancel cleanly without firing into a stale target.

## 9. Keyboard navigation

Every leaf control that can take focus is in the Tab cycle by default — buttons, checkboxes, radio buttons, text boxes, sliders, combo boxes, numeric steppers. Subclasses that conceptually shouldn't be a tab stop (`MenuItem`, `ListBoxRow`, `TabButton`, window-chrome buttons, the [+]/[-] toggle and title rows on `TreeNode`) opt out via `setTabable(false)` in their own constructors.

**Activation.** Focused buttons and toggle controls react to **Space** and **Enter** the same way they react to a click. Toggle buttons (`setIsToggle(true)`) flip; `CheckBox` toggles; `RadioButton` selects (and refuses to deselect) within its group.

**Tab order is scoped.** Tab and Shift+Tab walk the focusable controls in tree order — but within the nearest *tab boundary* ancestor only. Boundaries are:

- `WindowControl` — Tab traps inside the window.
- `Modal` — same, while a modal is up.
- `DockBase` — each docked left/right/top/bottom region is its own scope.
- Each `TabControl` page (set in `addPage`) — Tab cycles only within the active page's controls.

Outside any boundary (free-floating controls parented to the canvas) the cycle is the canvas-level group, which excludes anything that already belongs to a docked region or window. Custom containers can opt in via `ctrl.setTabBoundary(true)`.

**Arrow-key navigation inside containers.** List-style containers are themselves the single tab stop and respond to arrow keys to move selection / cursor through their items:

- `ListBox` — Up/Down move selection, Home/End jump, scroll-into-view auto-adjusts the vertical scrollbar.
- `RadioButtonController` — Up/Down/Left/Right cycle through options (wrapping). The change routes through `onChecked` so siblings clear correctly.
- `TabControl` — Left/Right (and Up/Down for vertical strips) switch tabs, Home/End jump to first/last. Focus ring renders around the active `TabButton`.
- `TreeControl` — Up/Down through DFS-flattened visible nodes; Left collapses or jumps to parent; Right expands or descends to first child; Home/End jump.
- `Slider` — Left/Right (or Up/Down for vertical) step by 1 unit of the caller's range; Home/End jump to the endpoints.

Focus rings are drawn by the skin's `drawKeyboardHighlight` (an alternating-pixel border). `Slider` paints a track-aligned 12 px-tall band that overshoots the slider's left/right edges by 3 px (matching skin overshoot). The band is drawn from `renderUnder` rather than `renderFocus`, so the draggable nib (a child rendered after `render`) sits on top of the dashed band — the focus indication remains visible at the slider's edges and behind the nib instead of cutting across it.

## 10. Fonts and text

`FontAtlas` (`src/skin/FontAtlas.ts`) rasterises glyphs on demand. Each `Font` object (`font(face, size, bold)`) lazily allocates an atlas slot per glyph through `ctx.fillText` on an internal scratch canvas; the alpha channel becomes R8 atlas data. One 512×512 page holds the ASCII printable range at several sizes. The atlas falls back to blank advances when full — in practice the production skin uses one size so overflow never fires.

## 11. Browser support

WebGL2 is required. Global support is around 95% as of 2026 — a WebGL1 fallback is not planned. `OffscreenCanvas` is used opportunistically; environments without it fall back to an off-DOM `<canvas>` via `document.createElement`. All other APIs (PointerEvents, `performance.now`, `requestAnimationFrame`, `navigator.clipboard` for TextBox copy/paste) are universally available.

## 12. Limitations

- Tab tear-off drag-and-drop is functional for `DockedTabControl → DockedTabControl` within one canvas, but does not support detaching to a floating window.
- File dialogs use the browser's native `<input type="file">` and the experimental File System Access API. The web sandbox does not expose filesystem paths, so display strings are basenames only. The `FilePicker` composite control retains a `File` reference (a `Blob` subclass) for the current selection — read it via `picker.getFile()` to access the bytes.
- The skin is procedural; no upstream `.png` loader is wired in. Texture-bearing controls (`ImagePanel`, `Button.setImageTexture`) accept caller-supplied `Texture` objects produced via `ImagePanel.loadFromURL` or `renderer.loadTextureFromSource`.

## 13. Migrating from GWEN C++

Most mechanical changes are naming:

- `DrawButton` → `drawButton`, `GetText` → `getText`, `SetText` → `setText`. All methods are lowerCamelCase.
- Events become `Signal<EventInfo>`. `onPress.Add(Handler)` → `onPress.on(handler)`, and the subscribe call returns a disposer instead of requiring `.CleanLinks()`.
- Destructors (`~Foo()`) become explicit `dispose()` calls when a control is removed from its tree. Deletion cascades to children automatically.
- `enum class`es are emitted as `as const` objects (`Pos.Left`, `CursorType.Beam`) to keep minified output small. Values combine with bitwise OR.
- `Gwen::Pos::Fill` etc. are `Gwen.Pos.Fill`.
- Factory helpers (`Gwen::Point(x, y)`) become `Gwen.point(x, y)` — lowercase because TypeScript class names are reserved for classes.

The control hierarchy is preserved byte-for-byte. `Button extends Label extends Base`; `CheckBox extends Button`; `ListBoxRow extends Button`. Everything your C++ code expects still works.
