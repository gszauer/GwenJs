// AtlasRegions — pure-data region table. Mirrors `Gwen::Skin::TexturedBase::Init`
// in `GWEN/include/Gwen/Skins/TexturedBase.h`.
//
// Two flavours of region:
//   * Bordered  — 9-slice patch. The `m` tuple is (left, top, right, bottom),
//                 matching GWEN's `Margin( left, top, right, bottom )` order at
//                 Structures.h:49.
//   * Single    — 1-slice glyph (checkboxes, arrows, window controls).
//
// Coordinates are atlas-space pixels in a 512×512 page. They are taken
// verbatim from TexturedBase.h:346-456 so the layout matches a stock
// `DefaultSkin.png` byte-for-byte.

export type RegionDescriptor =
  | {
      readonly name: string;
      readonly type: 'bordered';
      readonly x: number;
      readonly y: number;
      readonly w: number;
      readonly h: number;
      readonly m: readonly [number, number, number, number];
    }
  | {
      readonly name: string;
      readonly type: 'single';
      readonly x: number;
      readonly y: number;
      readonly w: number;
      readonly h: number;
    };

// All 118 atlas regions. Counts: 74 bordered + 44 single.
// (The spec's "93" predates the Scroller.Button array expansion to 16 cells;
// keeping faithfulness to TexturedBase.h is the explicit instruction.)
//
// The array and every descriptor are deep-frozen after construction (see
// the IIFE wrapper) so the public `Gwen.REGIONS` export cannot be mutated
// at runtime.
const RAW_REGIONS: readonly RegionDescriptor[] = [
  // ----- Frame & feedback -----
  { name: 'Shadow', type: 'bordered', x: 448, y: 0, w: 31, h: 31, m: [8, 8, 8, 8] },
  { name: 'Tooltip', type: 'bordered', x: 128, y: 320, w: 127, h: 31, m: [8, 8, 8, 8] },
  { name: 'StatusBar', type: 'bordered', x: 128, y: 288, w: 127, h: 31, m: [8, 8, 8, 8] },
  { name: 'Selection', type: 'bordered', x: 384, y: 32, w: 31, h: 31, m: [4, 4, 4, 4] },

  // ----- Panel variants -----
  { name: 'Panel.Normal', type: 'bordered', x: 256, y: 0, w: 63, h: 63, m: [16, 16, 16, 16] },
  { name: 'Panel.Bright', type: 'bordered', x: 320, y: 0, w: 63, h: 63, m: [16, 16, 16, 16] },
  { name: 'Panel.Dark', type: 'bordered', x: 256, y: 64, w: 63, h: 63, m: [16, 16, 16, 16] },
  { name: 'Panel.Highlight', type: 'bordered', x: 320, y: 64, w: 63, h: 63, m: [16, 16, 16, 16] },

  // ----- Window frames -----
  // mt keeps the painted title bar height in sync with the dragger's
  // height (WindowControl): an mt that's larger than the dragger leaves
  // an empty stripe below the title text and bakes a hard separator
  // line at the bottom of the title strip.
  { name: 'Window.Normal', type: 'bordered', x: 0, y: 0, w: 127, h: 127, m: [8, 28, 8, 8] },
  { name: 'Window.Inactive', type: 'bordered', x: 128, y: 0, w: 127, h: 127, m: [8, 28, 8, 8] },

  // ----- Window controls (Close / Maxi / Mini / Restore × 3 states) -----
  { name: 'Window.Close', type: 'single', x: 32, y: 448, w: 31, h: 31 },
  { name: 'Window.Close_Hover', type: 'single', x: 64, y: 448, w: 31, h: 31 },
  { name: 'Window.Close_Down', type: 'single', x: 96, y: 448, w: 31, h: 31 },
  { name: 'Window.Mini', type: 'single', x: 32 + 96, y: 448, w: 31, h: 31 },
  { name: 'Window.Mini_Hover', type: 'single', x: 64 + 96, y: 448, w: 31, h: 31 },
  { name: 'Window.Mini_Down', type: 'single', x: 96 + 96, y: 448, w: 31, h: 31 },
  { name: 'Window.Maxi', type: 'single', x: 32 + 96 * 2, y: 448, w: 31, h: 31 },
  { name: 'Window.Maxi_Hover', type: 'single', x: 64 + 96 * 2, y: 448, w: 31, h: 31 },
  { name: 'Window.Maxi_Down', type: 'single', x: 96 + 96 * 2, y: 448, w: 31, h: 31 },
  { name: 'Window.Restore', type: 'single', x: 32 + 96 * 2, y: 448 + 32, w: 31, h: 31 },
  { name: 'Window.Restore_Hover', type: 'single', x: 64 + 96 * 2, y: 448 + 32, w: 31, h: 31 },
  { name: 'Window.Restore_Down', type: 'single', x: 96 + 96 * 2, y: 448 + 32, w: 31, h: 31 },

  // ----- Checkbox / RadioButton glyphs -----
  { name: 'Checkbox.Active.Checked', type: 'single', x: 448, y: 32, w: 15, h: 15 },
  { name: 'Checkbox.Active.Normal', type: 'single', x: 464, y: 32, w: 15, h: 15 },
  { name: 'Checkbox.Disabled.Checked', type: 'single', x: 448, y: 48, w: 15, h: 15 },
  { name: 'Checkbox.Disabled.Normal', type: 'single', x: 464, y: 48, w: 15, h: 15 },
  { name: 'RadioButton.Active.Checked', type: 'single', x: 448, y: 64, w: 15, h: 15 },
  { name: 'RadioButton.Active.Normal', type: 'single', x: 464, y: 64, w: 15, h: 15 },
  { name: 'RadioButton.Disabled.Checked', type: 'single', x: 448, y: 80, w: 15, h: 15 },
  { name: 'RadioButton.Disabled.Normal', type: 'single', x: 464, y: 80, w: 15, h: 15 },

  // ----- Text box -----
  { name: 'TextBox.Normal', type: 'bordered', x: 0, y: 150, w: 127, h: 21, m: [4, 4, 4, 4] },
  { name: 'TextBox.Focus', type: 'bordered', x: 0, y: 172, w: 127, h: 21, m: [4, 4, 4, 4] },
  { name: 'TextBox.Disabled', type: 'bordered', x: 0, y: 193, w: 127, h: 21, m: [4, 4, 4, 4] },

  // ----- Menu -----
  { name: 'Menu.Strip', type: 'bordered', x: 0, y: 128, w: 127, h: 21, m: [1, 1, 1, 1] },
  { name: 'Menu.BackgroundWithMargin', type: 'bordered', x: 128, y: 128, w: 127, h: 63, m: [24, 8, 8, 8] },
  { name: 'Menu.Background', type: 'bordered', x: 128, y: 192, w: 127, h: 63, m: [8, 8, 8, 8] },
  { name: 'Menu.Hover', type: 'bordered', x: 128, y: 256, w: 127, h: 31, m: [8, 8, 8, 8] },
  { name: 'Menu.RightArrow', type: 'single', x: 464, y: 112, w: 15, h: 15 },
  { name: 'Menu.Check', type: 'single', x: 448, y: 112, w: 15, h: 15 },

  // ----- Tab -----
  { name: 'Tab.Control', type: 'bordered', x: 0, y: 256, w: 127, h: 127, m: [8, 8, 8, 8] },
  { name: 'Tab.Bottom.Active', type: 'bordered', x: 0, y: 416, w: 63, h: 31, m: [8, 8, 8, 8] },
  { name: 'Tab.Bottom.Inactive', type: 'bordered', x: 128, y: 416, w: 63, h: 31, m: [8, 8, 8, 8] },
  { name: 'Tab.Top.Active', type: 'bordered', x: 0, y: 384, w: 63, h: 31, m: [8, 8, 8, 8] },
  { name: 'Tab.Top.Inactive', type: 'bordered', x: 128, y: 384, w: 63, h: 31, m: [8, 8, 8, 8] },
  { name: 'Tab.Left.Active', type: 'bordered', x: 64, y: 384, w: 31, h: 63, m: [8, 8, 8, 8] },
  { name: 'Tab.Left.Inactive', type: 'bordered', x: 192, y: 384, w: 31, h: 63, m: [8, 8, 8, 8] },
  { name: 'Tab.Right.Active', type: 'bordered', x: 96, y: 384, w: 31, h: 63, m: [8, 8, 8, 8] },
  { name: 'Tab.Right.Inactive', type: 'bordered', x: 224, y: 384, w: 31, h: 63, m: [8, 8, 8, 8] },
  { name: 'Tab.HeaderBar', type: 'bordered', x: 128, y: 352, w: 127, h: 31, m: [4, 4, 4, 4] },

  // ----- Tree -----
  { name: 'Tree.Background', type: 'bordered', x: 256, y: 128, w: 127, h: 127, m: [16, 16, 16, 16] },
  { name: 'Tree.Plus', type: 'single', x: 448, y: 96, w: 15, h: 15 },
  { name: 'Tree.Minus', type: 'single', x: 464, y: 96, w: 15, h: 15 },

  // ----- Input.Button -----
  { name: 'Input.Button.Normal', type: 'bordered', x: 480, y: 0, w: 31, h: 31, m: [8, 8, 8, 8] },
  { name: 'Input.Button.Hovered', type: 'bordered', x: 480, y: 32, w: 31, h: 31, m: [8, 8, 8, 8] },
  { name: 'Input.Button.Disabled', type: 'bordered', x: 480, y: 64, w: 31, h: 31, m: [8, 8, 8, 8] },
  { name: 'Input.Button.Pressed', type: 'bordered', x: 480, y: 96, w: 31, h: 31, m: [8, 8, 8, 8] },

  // ----- Scroller arrows (4 states × 4 directions = 16) -----
  // GWEN encodes direction by row index 0..3 mapping to Left/Top/Right/Bottom
  // (DrawScrollButton in TexturedBase.h:812).
  { name: 'Scroller.Button.Normal[0]', type: 'bordered', x: 464, y: 208, w: 15, h: 15, m: [2, 2, 2, 2] },
  { name: 'Scroller.Button.Normal[1]', type: 'bordered', x: 464, y: 224, w: 15, h: 15, m: [2, 2, 2, 2] },
  { name: 'Scroller.Button.Normal[2]', type: 'bordered', x: 464, y: 240, w: 15, h: 15, m: [2, 2, 2, 2] },
  { name: 'Scroller.Button.Normal[3]', type: 'bordered', x: 464, y: 256, w: 15, h: 15, m: [2, 2, 2, 2] },
  { name: 'Scroller.Button.Hover[0]', type: 'bordered', x: 480, y: 208, w: 15, h: 15, m: [2, 2, 2, 2] },
  { name: 'Scroller.Button.Hover[1]', type: 'bordered', x: 480, y: 224, w: 15, h: 15, m: [2, 2, 2, 2] },
  { name: 'Scroller.Button.Hover[2]', type: 'bordered', x: 480, y: 240, w: 15, h: 15, m: [2, 2, 2, 2] },
  { name: 'Scroller.Button.Hover[3]', type: 'bordered', x: 480, y: 256, w: 15, h: 15, m: [2, 2, 2, 2] },
  { name: 'Scroller.Button.Down[0]', type: 'bordered', x: 464, y: 272, w: 15, h: 15, m: [2, 2, 2, 2] },
  { name: 'Scroller.Button.Down[1]', type: 'bordered', x: 464, y: 288, w: 15, h: 15, m: [2, 2, 2, 2] },
  { name: 'Scroller.Button.Down[2]', type: 'bordered', x: 464, y: 304, w: 15, h: 15, m: [2, 2, 2, 2] },
  { name: 'Scroller.Button.Down[3]', type: 'bordered', x: 464, y: 320, w: 15, h: 15, m: [2, 2, 2, 2] },
  { name: 'Scroller.Button.Disabled[0]', type: 'bordered', x: 528, y: 272, w: 15, h: 15, m: [2, 2, 2, 2] },
  { name: 'Scroller.Button.Disabled[1]', type: 'bordered', x: 528, y: 288, w: 15, h: 15, m: [2, 2, 2, 2] },
  { name: 'Scroller.Button.Disabled[2]', type: 'bordered', x: 528, y: 304, w: 15, h: 15, m: [2, 2, 2, 2] },
  { name: 'Scroller.Button.Disabled[3]', type: 'bordered', x: 528, y: 320, w: 15, h: 15, m: [2, 2, 2, 2] },

  // NOTE: The Disabled bucket lives at x=528 (>= atlas width 512) in the
  // upstream layout. We respect the source coordinates verbatim; the runtime
  // painter clamps the draw to within the canvas, so these disabled-glyph
  // cells just won't appear on the atlas page. Callers that need them
  // reuse Scroller.Button.Normal as a stand-in (DynamicSkin's
  // disabled-state shading already darkens the result enough to read).

  // ----- Scroller bars/tracks -----
  { name: 'Scroller.TrackV', type: 'bordered', x: 384, y: 208, w: 15, h: 127, m: [4, 4, 4, 4] },
  { name: 'Scroller.ButtonV_Normal', type: 'bordered', x: 400, y: 208, w: 15, h: 127, m: [4, 4, 4, 4] },
  { name: 'Scroller.ButtonV_Hover', type: 'bordered', x: 416, y: 208, w: 15, h: 127, m: [4, 4, 4, 4] },
  { name: 'Scroller.ButtonV_Down', type: 'bordered', x: 432, y: 208, w: 15, h: 127, m: [4, 4, 4, 4] },
  { name: 'Scroller.ButtonV_Disabled', type: 'bordered', x: 448, y: 208, w: 15, h: 127, m: [4, 4, 4, 4] },
  { name: 'Scroller.TrackH', type: 'bordered', x: 384, y: 128, w: 127, h: 15, m: [4, 4, 4, 4] },
  { name: 'Scroller.ButtonH_Normal', type: 'bordered', x: 384, y: 144, w: 127, h: 15, m: [4, 4, 4, 4] },
  { name: 'Scroller.ButtonH_Hover', type: 'bordered', x: 384, y: 160, w: 127, h: 15, m: [4, 4, 4, 4] },
  { name: 'Scroller.ButtonH_Down', type: 'bordered', x: 384, y: 176, w: 127, h: 15, m: [4, 4, 4, 4] },
  { name: 'Scroller.ButtonH_Disabled', type: 'bordered', x: 384, y: 192, w: 127, h: 15, m: [4, 4, 4, 4] },

  // ----- Input.ListBox -----
  { name: 'Input.ListBox.Background', type: 'bordered', x: 256, y: 256, w: 63, h: 127, m: [8, 8, 8, 8] },
  { name: 'Input.ListBox.Hovered', type: 'bordered', x: 320, y: 320, w: 31, h: 31, m: [8, 8, 8, 8] },
  { name: 'Input.ListBox.EvenLine', type: 'bordered', x: 352, y: 256, w: 31, h: 31, m: [8, 8, 8, 8] },
  { name: 'Input.ListBox.OddLine', type: 'bordered', x: 352, y: 288, w: 31, h: 31, m: [8, 8, 8, 8] },
  { name: 'Input.ListBox.EvenLineSelected', type: 'bordered', x: 320, y: 256, w: 31, h: 31, m: [8, 8, 8, 8] },
  { name: 'Input.ListBox.OddLineSelected', type: 'bordered', x: 320, y: 288, w: 31, h: 31, m: [8, 8, 8, 8] },

  // ----- Input.ComboBox -----
  { name: 'Input.ComboBox.Normal', type: 'bordered', x: 384, y: 336, w: 127, h: 31, m: [8, 8, 32, 8] },
  { name: 'Input.ComboBox.Hover', type: 'bordered', x: 384, y: 368, w: 127, h: 31, m: [8, 8, 32, 8] },
  { name: 'Input.ComboBox.Down', type: 'bordered', x: 384, y: 400, w: 127, h: 31, m: [8, 8, 32, 8] },
  { name: 'Input.ComboBox.Disabled', type: 'bordered', x: 384, y: 432, w: 127, h: 31, m: [8, 8, 32, 8] },
  { name: 'Input.ComboBox.Button.Normal', type: 'single', x: 496, y: 272, w: 15, h: 15 },
  { name: 'Input.ComboBox.Button.Hover', type: 'single', x: 496, y: 288, w: 15, h: 15 },
  { name: 'Input.ComboBox.Button.Down', type: 'single', x: 496, y: 304, w: 15, h: 15 },
  { name: 'Input.ComboBox.Button.Disabled', type: 'single', x: 496, y: 320, w: 15, h: 15 },

  // ----- Input.UpDown (numeric spinner) -----
  { name: 'Input.UpDown.Up.Normal', type: 'single', x: 384, y: 112, w: 7, h: 7 },
  { name: 'Input.UpDown.Up.Hover', type: 'single', x: 392, y: 112, w: 7, h: 7 },
  { name: 'Input.UpDown.Up.Down', type: 'single', x: 400, y: 112, w: 7, h: 7 },
  { name: 'Input.UpDown.Up.Disabled', type: 'single', x: 408, y: 112, w: 7, h: 7 },
  { name: 'Input.UpDown.Down.Normal', type: 'single', x: 384, y: 120, w: 7, h: 7 },
  { name: 'Input.UpDown.Down.Hover', type: 'single', x: 392, y: 120, w: 7, h: 7 },
  { name: 'Input.UpDown.Down.Down', type: 'single', x: 400, y: 120, w: 7, h: 7 },
  { name: 'Input.UpDown.Down.Disabled', type: 'single', x: 408, y: 120, w: 7, h: 7 },

  // ----- Progress bar -----
  { name: 'ProgressBar.Back', type: 'bordered', x: 384, y: 0, w: 31, h: 31, m: [8, 8, 8, 8] },
  { name: 'ProgressBar.Front', type: 'bordered', x: 416, y: 0, w: 31, h: 31, m: [8, 8, 8, 8] },

  // ----- Input.Slider thumbs -----
  { name: 'Input.Slider.H.Normal', type: 'single', x: 416, y: 32, w: 15, h: 15 },
  { name: 'Input.Slider.H.Hover', type: 'single', x: 416, y: 48, w: 15, h: 15 },
  { name: 'Input.Slider.H.Down', type: 'single', x: 416, y: 64, w: 15, h: 15 },
  { name: 'Input.Slider.H.Disabled', type: 'single', x: 416, y: 80, w: 15, h: 15 },
  { name: 'Input.Slider.V.Normal', type: 'single', x: 432, y: 32, w: 15, h: 15 },
  { name: 'Input.Slider.V.Hover', type: 'single', x: 432, y: 48, w: 15, h: 15 },
  { name: 'Input.Slider.V.Down', type: 'single', x: 432, y: 64, w: 15, h: 15 },
  { name: 'Input.Slider.V.Disabled', type: 'single', x: 432, y: 80, w: 15, h: 15 },

  // ----- CategoryList -----
  { name: 'CategoryList.Outer', type: 'bordered', x: 256, y: 384, w: 63, h: 63, m: [8, 8, 8, 8] },
  { name: 'CategoryList.Inner', type: 'bordered', x: 320, y: 384, w: 63, h: 63, m: [8, 21, 8, 8] },
  { name: 'CategoryList.Header', type: 'bordered', x: 320, y: 352, w: 63, h: 31, m: [8, 8, 8, 8] },

  // ----- GroupBox -----
  { name: 'GroupBox', type: 'bordered', x: 0, y: 448, w: 31, h: 31, m: [8, 8, 8, 8] },
];

// Deep-freeze: each descriptor and (for bordered types) the margin tuple.
for (const d of RAW_REGIONS) {
  if (d.type === 'bordered') Object.freeze(d.m);
  Object.freeze(d);
}
export const REGIONS: readonly RegionDescriptor[] = Object.freeze(RAW_REGIONS);

// ---------- Palette (Windows-XP / silver theme) ----------

export const PALETTE = Object.freeze({
  canvasBg: '#7a9090',
  panelFill: '#e8e8e8',
  panelBright: '#f4f4f4',
  panelDark: '#c8c8c8',
  panelHighlight: '#fafafa',
  panelBorder: '#b0b0b0',

  titleActiveTop: '#7ab4d4',
  titleActiveBottom: '#4890c4',
  titleInactiveTop: '#c8c8c8',
  titleInactiveBot: '#a0a0a0',

  buttonNormalTop: '#f0f0f0',
  buttonNormalBot: '#d0d0d0',
  buttonHoverTop: '#e0f0ff',
  buttonHoverBot: '#b8d8f0',
  buttonPressedTop: '#c0c0c0',
  buttonPressedBot: '#d8d8d8',
  buttonDisabled: '#e0e0e0',
  buttonBorder: '#909090',

  textboxBg: '#ffffff',
  textboxBorder: '#b0b0b0',
  textboxFocused: '#4890c4',

  selection: '#4890c4',
  // Scrollbars deliberately tuned for visibility — the track sits a
  // notch darker than the surrounding panel chrome (#e8e8e8 panel,
  // #c8c8c8 panelDark) so the bar reads as a clear inset; the thumb
  // is brighter than the track with a stronger top-bottom gradient
  // and a distinctly darker border so it pops as a draggable handle.
  // Earlier values (#d0d0d0 track / #e8e8e8→#c0c0c0 thumb) blurred
  // into the surrounding grey at the bar's bottom + right edges.
  scrollTrack: '#b8b8b8',
  scrollTrackBorder: '#808080',
  scrollThumbTop: '#f0f0f0',
  scrollThumbBot: '#a8a8a8',
  scrollThumbBorder: '#606060',

  tooltipBg: '#ffffcc',
  tooltipBorder: '#909090',

  statusBarBg: '#d4d0c8',
  menuStripBg: '#d4d0c8',
  menuHoverBg: '#4890c4',

  progressBack: '#d0d0d0',
  progressFront: '#00d328',

  shadow: 'rgba(0,0,0,0.47)', // ~120/255

  textNormal: '#000000',
  textDisabled: '#808080',
  textOnDark: '#ffffff',

  accent: '#4890c4',

  // Tab variants — derived from the panel/button palette so the tab
  // strip blends cleanly with the rest of the chrome.
  tabActiveTop: '#f0f0f0',
  tabActiveBot: '#d8d8d8',
  tabInactiveTop: '#c8c8c8',
  tabInactiveBot: '#a8a8a8',

  // Tree
  treeLines: '#909090',
  treeNormal: '#000000',
  treeHover: '#000000',
  treeSelected: '#ffffff',

  // Properties grid
  propLineNormal: '#ffffff',
  propLineSelected: '#4890c4',
  propLineHover: '#e0f0ff',
  propTitle: '#ffffff',
  propColumnNormal: '#e8e8e8',
  propColumnSelected: '#7ab4d4',
  propColumnHover: '#d8e8f8',
  propLabelNormal: '#000000',
  propLabelSelected: '#ffffff',
  propLabelHover: '#000000',
  propBorder: '#909090',

  // Modal & tooltip text
  modalBg: 'rgba(25,25,25,0.40)',
  tooltipText: '#000000',

  // Category
  catHeader: '#ffffff',
  catHeaderClosed: '#a0a0a0',
  catLineText: '#000000',
  catLineTextHover: '#000000',
  catLineTextSelected: '#ffffff',
  catLineButton: '#000000',
  catLineButtonHover: '#000000',
  catLineButtonSelected: '#ffffff',
  catLineAltText: '#202020',
  catLineAltTextHover: '#000000',
  catLineAltTextSelected: '#ffffff',
  catLineAltButton: '#202020',
  catLineAltButtonHover: '#000000',
  catLineAltButtonSelected: '#ffffff',
} as const);

// ---------- Baked palette strip ----------
//
// GWEN's TexturedBase samples 52 named colors out of `DefaultSkin.png` at
// fixed pixel positions — see TexturedBase.h:297-345. We bake those exact
// positions into the atlas for visual fidelity (and so existing GWEN tools
// can read the same atlas), but the runtime decode short-circuits the GPU
// readback by using this parallel TS table.
//
// Layout: two rows. Row A at y=508, Row B at y=500. Cell n is an 8×8 square
// at x = 4 + 8 * n, n in 0..25. Column index matches the upstream offset.
//
// The mapping below pairs (name → hex) in two arrays. `BAKED_ROW_508` is
// the row TexturedBase reads first (it's the visual top row in the source
// atlas, even though y=508 is below y=500 — GWEN drew it that way).

export interface BakedColor {
  readonly name: string;
  readonly hex: string;
}

// y = 508 — primary fields (bordered patches, label colors).
const RAW_BAKED_ROW_508: readonly BakedColor[] = [
  { name: 'Window.TitleActive', hex: '#003c74' },
  { name: 'Window.TitleInactive', hex: '#7a96b6' },
  { name: 'Button.Normal', hex: PALETTE.textNormal },
  { name: 'Button.Hover', hex: PALETTE.textNormal },
  { name: 'Tab.Active.Normal', hex: PALETTE.textNormal },
  { name: 'Tab.Active.Hover', hex: PALETTE.textNormal },
  { name: 'Tab.Inactive.Normal', hex: PALETTE.textNormal },
  { name: 'Tab.Inactive.Hover', hex: PALETTE.textNormal },
  { name: 'Label.Default', hex: PALETTE.textNormal },
  { name: 'Label.Bright', hex: '#ffffff' },
  { name: 'Tree.Lines', hex: PALETTE.treeLines },
  { name: 'Tree.Normal', hex: PALETTE.treeNormal },
  { name: 'Properties.Line_Normal', hex: PALETTE.propLineNormal },
  { name: 'Properties.Line_Selected', hex: PALETTE.propLineSelected },
  { name: 'Properties.Column_Normal', hex: PALETTE.propColumnNormal },
  { name: 'Properties.Column_Selected', hex: PALETTE.propColumnSelected },
  { name: 'Properties.Label_Normal', hex: PALETTE.propLabelNormal },
  { name: 'Properties.Label_Selected', hex: PALETTE.propLabelSelected },
  // Translucent — opaque #191919 turned the screen pitch black behind a
  // modal window, hiding the parent UI completely. ~40% alpha matches
  // PALETTE.modalBg and dims-without-erasing the underlying content.
  { name: 'ModalBackground', hex: 'rgba(25,25,25,0.40)' },
  { name: 'TooltipText', hex: PALETTE.tooltipText },
  { name: 'Category.Line.Text', hex: PALETTE.catLineText },
  { name: 'Category.Line.Text_Hover', hex: PALETTE.catLineTextHover },
  { name: 'Category.Line.Button_Hover', hex: PALETTE.catLineButtonHover },
  { name: 'Category.Line.Button_Selected', hex: PALETTE.catLineButtonSelected },
  { name: 'Category.LineAlt.Text_Selected', hex: PALETTE.catLineAltTextSelected },
  { name: 'Category.LineAlt.Button', hex: PALETTE.catLineAltButton },
];
for (const c of RAW_BAKED_ROW_508) Object.freeze(c);
export const BAKED_ROW_508: readonly BakedColor[] = Object.freeze(RAW_BAKED_ROW_508);

// y = 500 — secondary fields (down/disabled states, hover variants).
const RAW_BAKED_ROW_500: readonly BakedColor[] = [
  { name: 'Pad500_0', hex: '#000000' },
  { name: 'Pad500_1', hex: '#000000' },
  { name: 'Button.Down', hex: PALETTE.textNormal },
  { name: 'Button.Disabled', hex: PALETTE.textDisabled },
  { name: 'Tab.Active.Down', hex: PALETTE.textNormal },
  { name: 'Tab.Active.Disabled', hex: PALETTE.textDisabled },
  { name: 'Tab.Inactive.Down', hex: PALETTE.textNormal },
  { name: 'Tab.Inactive.Disabled', hex: PALETTE.textDisabled },
  { name: 'Label.Dark', hex: '#000000' },
  { name: 'Label.Highlight', hex: '#ffffff' },
  { name: 'Tree.Hover', hex: PALETTE.treeHover },
  { name: 'Tree.Selected', hex: PALETTE.treeSelected },
  { name: 'Properties.Line_Hover', hex: PALETTE.propLineHover },
  { name: 'Properties.Title', hex: PALETTE.propTitle },
  { name: 'Properties.Column_Hover', hex: PALETTE.propColumnHover },
  { name: 'Properties.Border', hex: PALETTE.propBorder },
  { name: 'Properties.Label_Hover', hex: PALETTE.propLabelHover },
  { name: 'Pad500_17', hex: '#000000' },
  { name: 'Category.Header', hex: PALETTE.catHeader },
  { name: 'Category.Header_Closed', hex: PALETTE.catHeaderClosed },
  { name: 'Category.Line.Text_Selected', hex: PALETTE.catLineTextSelected },
  { name: 'Category.Line.Button', hex: PALETTE.catLineButton },
  { name: 'Category.LineAlt.Text', hex: PALETTE.catLineAltText },
  { name: 'Category.LineAlt.Text_Hover', hex: PALETTE.catLineAltTextHover },
  { name: 'Category.LineAlt.Button_Hover', hex: PALETTE.catLineAltButtonHover },
  { name: 'Category.LineAlt.Button_Selected', hex: PALETTE.catLineAltButtonSelected },
];
for (const c of RAW_BAKED_ROW_500) Object.freeze(c);
export const BAKED_ROW_500: readonly BakedColor[] = Object.freeze(RAW_BAKED_ROW_500);
