// GwenJs — TypeScript port of the GWEN C++ GUI library.
// Entry point. Modules are filled in by the orchestrator per tasks.md.

export const VERSION = '0.0.1';

// T001 — core value types (Point, Margin/Padding, Rect, HSV, Color,
// CursorType, DragAndDropPackage).
export * from './core/Structures';

// T002 — Signal<T> event system + EventInfo payload.
export * from './core/Events';

// T003 — Pos flags + Align helpers.
export * from './core/Align';

// T004 — Renderer (abstract) + WebGL2 implementation + Texture + VertexBatch.
export * from './renderer/Texture';
export * from './renderer/Renderer';
export * from './renderer/Batch';
export * from './renderer/WebGL2Renderer';

// T005 — FontAtlas (glyph cache + R8 atlas texture) + Font interface.
export * from './skin/FontAtlas';

// T006 — DynamicSkin (procedural UI atlas) + region descriptors.
export * from './skin/AtlasRegions';
export * from './skin/DynamicSkin';

// T007 — PointerEvents → InputTarget routing, Key codes, long-press.
export * from './core/Input';

// T008 — Base control (tree, bounds, docking, layout, render hooks, events).
export * from './controls/Base';

// T009 — Skin (~40 draw methods dispatched via DynamicSkin atlas).
export * from './skin/Skin';

// T010 — Canvas root control (renderer + skin + input, per-frame loop).
export * from './controls/Canvas';

// T100 — Label (single-line text + alignment) + internal Text renderer.
export * from './controls/Text';
export * from './controls/Label';

// T111 — ImagePanel.
export * from './controls/ImagePanel';

// T114 — Rectangle (solid-color fill).
export * from './controls/Rectangle';

// T120 — Dragger (internal drag controller; base of splitters/sliders/scrollbar bars).
export * from './controls/Dragger';

// T101 — Button (clickable, toggle, signals, image child).
export * from './controls/Button';

// T110 — ProgressBar.
export * from './controls/ProgressBar';

// T112 — GroupBox (labeled frame with inner panel).
export * from './controls/GroupBox';

// T113 — StatusBar (bottom strip with docked children).
export * from './controls/StatusBar';

// T116 — FieldLabel (label bound to an input field, form layout).
export * from './controls/FieldLabel';

// T121 — Resizer (internal; resize handle for ResizableControl).
export * from './controls/Resizer';

// T115 — LabelClickable (hyperlink-style; no background, finger cursor).
export * from './controls/LabelClickable';

// T102 — CheckBox + CheckBoxWithLabel.
export * from './controls/CheckBox';

// T117 — RichLabel (word-wrap multi-color runs).
export * from './controls/RichLabel';

// T109 — Slider family (Slider + SliderBar + HorizontalSlider + VerticalSlider).
export * from './controls/Slider';

// T103 — RadioButton + LabeledRadioButton + RadioButtonController.
export * from './controls/RadioButton';
export * from './controls/RadioButtonController';

// T104 — TextBox (single-line editable with caret + selection + clipboard).
export * from './controls/TextBox';

// T105 — TextBoxNumeric (digits + optional single minus + single decimal).
export * from './controls/TextBoxNumeric';

// T106 — TextBoxMultiline (Enter inserts newline, Up/Down navigate lines).
export * from './controls/TextBoxMultiline';

// T107 — PasswordTextBox (real text hidden behind mask character).
export * from './controls/PasswordTextBox';

// T108 — NumericUpDown (integer TextBox + up/down spinner buttons).
export * from './controls/NumericUpDown';

// T200 — ScrollBar infrastructure (BaseScrollBar + H/VScrollBar + internal bar/button).
export * from './controls/ScrollBarBar';
export * from './controls/ScrollBarButton';
export * from './controls/ScrollBar';

// T206 — TreeNode (tree entry with toggle + title + inner children panel).
export * from './controls/TreeNode';

// T208 — ToolBarButton + ToolBarStrip.
export * from './controls/ToolBar';

// ActionBar — flexible toolbar (horizontal quick-action / vertical tool palette).
export * from './controls/ActionBar';

// T209 — CollapsibleCategory (expandable category with toggle header + item rows).
export * from './controls/CollapsibleCategory';

// T211 — Tab family (TabButton + TabStrip + TabTitleBar + TabControl).
export * from './controls/TabTitleBar';
export * from './controls/TabButton';
export * from './controls/TabStrip';
export * from './controls/TabControl';

// T213 — PageControl (wizard pager with Back/Next/Finish).
export * from './controls/PageControl';

// T201 — ScrollControl (viewport with H+V scrollbars).
export * from './controls/ScrollControl';

// T212 — DockedTabControl (TabControl for dock zones with title bar).
export * from './controls/DockedTabControl';

// T202 — Menu + MenuDivider + MenuItem.
export * from './controls/Menu';
export * from './controls/MenuItem';

// T205 — ListBox + ListBoxRow.
export * from './controls/ListBox';

// T207 — TreeControl (TreeNode root wrapping a ScrollControl).
export * from './controls/TreeControl';

// T203 — MenuStrip (horizontal Menu docked top).
export * from './controls/MenuStrip';

// T204 — ComboBox (Button with dropdown Menu).
export * from './controls/ComboBox';

// T210 — CollapsibleList (ScrollControl hosting multiple CollapsibleCategory).
export * from './controls/CollapsibleList';

// T300 — Layout::Position + Center (anchors children to Pos flags).
export * from './controls/Layout/Position';

// T301 — Layout::Table + TableRow (classic row/column grid).
export * from './controls/Layout/Table';

// T302 — Layout::Tile (wrap-flow fixed-size tiles).
export * from './controls/Layout/Tile';

// T310 — Modal + Highlight (internal; modal overlay + drag-hover indicator).
export * from './controls/Modal';

// T303 — ResizableControl (Base with 8 Resizer handles).
export * from './controls/ResizableControl';

// T304 — WindowCloseButton + WindowMaximizeButton + WindowMinimizeButton.
export * from './controls/WindowButtons';

// T306 — SplitterBar (Dragger-based divider).
export * from './controls/SplitterBar';

// T305 — WindowControl (resizable floating window with title bar + close).
export * from './controls/WindowControl';

// T307 — SplitterVertical + SplitterHorizontal (2-panel splits).
export * from './controls/Splitters';

// T308 — CrossSplitter (2×2 panel grid with 3 splitter bars + zoom).
export * from './controls/CrossSplitter';

// T309 — DockBase (headline feature: 4 edge drop zones + DockedTabControl center).
export * from './controls/DockBase';

// Color helpers (HSV conversion + lerp).
export * from './core/ColorUtil';

// T403 — ColorDisplay (internal; small color swatch).
export * from './controls/ColorDisplay';

// T400 — ColorLerpBox + ColorSlider (primitives for HSV picker).
export * from './controls/ColorControls';

// T402 — ColorPicker (RGBA sliders + numeric + swatch).
export * from './controls/ColorPicker';

// T404 + T405 — Properties + PropertyRow + PropertyBase/Text/Checkbox/ComboBox.
export * from './controls/Properties';

// T401 — HSVColorPicker (LerpBox + Slider + swatches + RGB inputs).
export * from './controls/HSVColorPicker';

// T408 — PropertyTree + PropertyTreeNode.
export * from './controls/PropertyTree';

// T500 + T501 — FilePicker + FolderPicker.
export * from './controls/FilePicker';

// T502-T505 — Dialogs (fileOpen, fileSave, folderOpen, query).
export * as Dialogs from './controls/Dialogs';
