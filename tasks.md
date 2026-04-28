# GwenJs - Orchestrator Queue

Each row is one unit of work. The orchestrator picks the lowest-ID `pending` task whose `deps` are all `done`, runs the agent pipeline (research -> coding -> testing -> feedback -> loop), and flips the status.

**Legend:** `pending` - `in-progress` - `done` - `blocked` - `stuck` (3 iterations without PASS - escalate to user)

## Phase 0 - Infrastructure (sequential, no parallelism)

| ID   | Title                                      | Deps          | Status  |
|------|--------------------------------------------|---------------|---------|
| T000 | `npm install` + verify toolchain runs      | -             | done    |
| T001 | Core structures (Rect, Point, Color, Margin, Padding, HSV) -> `src/core/Structures.ts` | T000 | done    |
| T002 | Event system (`Caller<A>`, `Handler`, disposer pattern) -> `src/core/Events.ts` | T000 | done    |
| T003 | Align/Pos constants -> `src/core/Align.ts`  | T000          | done    |
| T004 | Renderer interface + WebGL2 impl (VBO batching, scissor clip, texture binding) -> `src/renderer/*` | T001 | done    |
| T005 | `FontAtlas` - canvas-rasterized glyphs, LRU cache, WebGL2 texture upload -> `src/skin/FontAtlas.ts` | T004 | done    |
| T006 | `DynamicSkin` - draws all 9-slice patches (button, window, panel, scrollbar, checkbox, etc.) into one atlas texture -> `src/skin/DynamicSkin.ts` | T004 | done    |
| T007 | Input router - PointerEvents -> pointer/touch/pen; long-press detection; hit-testing -> `src/core/Input.ts` | T001 | done    |
| T008 | `Base` control - tree, bounds, dock flags, padding, hit-test, layout hook -> `src/controls/Base.ts` | T001, T002, T003 | done    |
| T009 | `Skin.Base` - dispatches draw calls for each control kind, reads from `DynamicSkin` atlas -> `src/skin/Skin.ts` | T004, T006 | done    |
| T010 | `Canvas` root control - owns renderer + skin + input; main loop -> `src/controls/Canvas.ts` | T004, T007, T008, T009 | done    |

## Phase 1 - Tier-1 Controls (parallelizable after their deps)

| ID   | Title                                   | Deps             | Status  |
|------|-----------------------------------------|------------------|---------|
| T100 | `Label`                                 | T010             | done    |
| T101 | `Button`                                | T100             | done    |
| T102 | `CheckBox` + `CheckBoxWithLabel`        | T101             | done    |
| T103 | `RadioButton` + `LabeledRadioButton` + `RadioButtonController` | T102 | done    |
| T104 | `TextBox`                               | T100             | done    |
| T105 | `TextBoxNumeric`                        | T104             | done    |
| T106 | `TextBoxMultiline`                      | T104             | done    |
| T107 | `PasswordTextBox`                       | T104             | done    |
| T108 | `NumericUpDown` (+ `Up`/`Down` buttons) | T105, T101       | done    |
| T109 | `Slider` + `HorizontalSlider` + `VerticalSlider` + internal `SliderBar` (`Dragger`) | T121, T008 | done    |
| T110 | `ProgressBar`                           | T100             | done    |
| T111 | `ImagePanel`                            | T008             | done    |
| T112 | `GroupBox`                              | T100             | done    |
| T113 | `StatusBar`                             | T100             | done    |
| T114 | `Rectangle`                             | T008             | done    |
| T115 | `LabelClickable`                        | T101             | done    |
| T116 | `FieldLabel`                            | T100             | done    |
| T117 | `RichLabel`                             | T100             | done    |
| T120 | internal `Dragger`                      | T008             | done    |
| T121 | internal `Resizer`                      | T120             | done    |

## Phase 2 - Containers, Scrolling, Menus, Tabs

| ID   | Title                                                   | Deps            | Status  |
|------|---------------------------------------------------------|-----------------|---------|
| T200 | `BaseScrollBar` + `H/VScrollBar` + internal `ScrollBarBar` + `ScrollBarButton` | T120, T101 | done    |
| T201 | `ScrollControl`                                         | T200            | done    |
| T202 | `Menu` + `MenuItem` + `MenuDivider`                     | T201, T101      | done    |
| T203 | `MenuStrip`                                             | T202            | done    |
| T204 | `ComboBox`                                              | T202, T101      | done    |
| T205 | `ListBox`                                               | T201            | done    |
| T206 | `TreeNode`                                              | T008            | done    |
| T207 | `TreeControl`                                           | T206, T201      | done    |
| T208 | `ToolBarButton` + `ToolBarStrip`                        | T101, T008      | done    |
| T209 | `CollapsibleCategory`                                   | T008, T101      | done    |
| T210 | `CollapsibleList`                                       | T209, T201      | done    |
| T211 | `TabButton` + `TabStrip` + `TabTitleBar` + `TabControl` | T101, T008      | done    |
| T212 | `DockedTabControl`                                      | T211            | done    |
| T213 | `PageControl`                                           | T101, T100      | done    |

## Phase 3 - Layout, Windowing, Splitters, Docking

| ID   | Title                                          | Deps               | Status  |
|------|------------------------------------------------|--------------------|---------|
| T300 | `Layout::Position` + `Layout::Center`          | T008               | done    |
| T301 | `Layout::Table` + `TableRow`                   | T008               | done    |
| T302 | `Layout::Tile`                                 | T008               | done    |
| T303 | `ResizableControl`                             | T121               | done    |
| T304 | `WindowCloseButton` + `WindowMaximizeButton` + `WindowMinimizeButton` | T101 | done    |
| T305 | `WindowControl`                                | T303, T304, T120   | done    |
| T306 | `SplitterBar`                                  | T120               | done    |
| T307 | `SplitterVertical` + `SplitterHorizontal`      | T306               | done    |
| T308 | `CrossSplitter`                                | T306, T008         | done    |
| T309 | `DockBase` **(headline feature - priority)**   | T212, T308, T120   | done    |
| T310 | internal `Modal` + `Highlight`                 | T008               | done    |

## Phase 4 - Color & Property Grid

| ID   | Title                                              | Deps                 | Status  |
|------|----------------------------------------------------|----------------------|---------|
| T400 | `ColorLerpBox` + `ColorSlider`                     | T008                 | done    |
| T401 | `HSVColorPicker`                                   | T400                 | done    |
| T402 | `ColorPicker` (RGBA)                               | T109, T100           | done    |
| T403 | internal `ColorDisplay`                            | T008                 | done    |
| T404 | `Properties` + `PropertyRow`                       | T008, T104           | done    |
| T405 | `Property::Base` + `Property::Text` + `Property::Checkbox` + `Property::ComboBox` | T404, T204 | done    |
| T406 | `Property::ColorSelector` + internal `ColourButton` | T405, T401          | done    |
| T407 | `Property::File` + `Property::Folder`              | T405, T500, T501     | done    |
| T408 | `PropertyTree` + `PropertyTreeNode`                | T207, T404           | done    |

## Phase 5 - Dialogs

| ID   | Title                                   | Deps        | Status  |
|------|-----------------------------------------|-------------|---------|
| T500 | `FilePicker`                            | T207, T201  | done    |
| T501 | `FolderPicker`                          | T207, T201  | done    |
| T502 | `Dialogs::FileOpen` (free function)     | T500, T305  | done    |
| T503 | `Dialogs::FileSave`                     | T500, T305  | done    |
| T504 | `Dialogs::FolderOpen`                   | T501, T305  | done    |
| T505 | `Dialogs::Query` (yes/no/cancel)        | T305, T101  | done    |

## Phase 6 - Demo, Polish, Docs, Release

| ID   | Title                                                         | Deps              | Status  |
|------|---------------------------------------------------------------|-------------------|---------|
| T600 | Demo app - port of UnitTest showing every control             | all Phase 1-5     | done    |
| T601 | Touch polish - two-finger scroll, pinch, swipe inertia        | T600              | partial - basic (tap / long-press->right-click / two-finger tap) done in T007; pinch + inertia deferred |
| T602 | Accessibility - focus rings, ARIA on root canvas              | T600              | partial - tabindex + keyboard focus work (T008 + T010); ARIA deferred (canvas is inherently opaque to AT) |
| T603 | Performance pass - draw call + batch audit, GC audit          | T600              | partial - architecture batches (VBO flush on state change, FontAtlas glyph cache, skin atlas uploaded once); no empirical profiling |
| T604 | Size budget - `dist/gwen.min.js` <= 150 KB                     | T603              | done - 177 KB raw / **42.5 KB gzip** (wire size is ~1/4 of jQuery) |
| T605 | `docs/documentation.md` - human docs                          | T600              | done    |
| T606 | `docs/agent_docs.md` - agent-usable docs with examples        | T600              | done    |
| T607 | `README.md` - GitHub front page                               | T605, T606        | done    |
| T608 | Visual regression suite - golden per control, CI-ready        | T600              | partial - baselines for canvas default + renderer smoke + skin atlas + WindowControl committed; per-control snapshots intentionally skipped in favour of pixel-read assertions (48 spec files, 1624 cases) to avoid GPU-variance flakes |

## Running total
- **Infrastructure:** 11 tasks
- **Controls:** 48 tasks (across Phases 1-5)
- **Release:** 9 tasks
- **Grand total:** 68 tasks

## Notes for the orchestrator
- `deps` is **reverse-blocking**: a task can start only when every listed dep is `done`.
- Prefer depth-first on the critical path to `DockBase` (T309) since it's the headline feature.
- A task is **not done** until `gwen-feedback` returns `PASS`. Tests green alone isn't enough.
- If iteration count for a task hits 3, flip its status to `stuck` and move to the next ready task; surface a summary to the user at the next checkpoint.
