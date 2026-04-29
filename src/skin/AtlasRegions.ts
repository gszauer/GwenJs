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

// ---------- Palette types ----------
//
// Two stock palettes are exported: `LIGHT_PALETTE` (the original
// Windows-XP / silver theme) and `DARK_PALETTE` (a VS Code-ish dark
// theme). `PALETTE` is kept as an alias to LIGHT for back-compat.
//
// Both palettes share the same shape (`Palette` type below). The
// active palette is stored on `DynamicSkin` and swapped at runtime via
// `Skin.setTheme(...)`; the atlas re-paints + re-uploads, controls
// keep their stable texture handle and pick up new colours on next
// render.

export interface Palette {
  readonly canvasBg: string;
  readonly panelFill: string;
  readonly panelBright: string;
  readonly panelDark: string;
  readonly panelHighlight: string;
  readonly panelBorder: string;

  readonly titleActiveTop: string;
  readonly titleActiveBottom: string;
  readonly titleInactiveTop: string;
  readonly titleInactiveBot: string;

  readonly buttonNormalTop: string;
  readonly buttonNormalBot: string;
  readonly buttonHoverTop: string;
  readonly buttonHoverBot: string;
  readonly buttonPressedTop: string;
  readonly buttonPressedBot: string;
  readonly buttonDisabled: string;
  readonly buttonBorder: string;

  readonly textboxBg: string;
  readonly textboxBorder: string;
  readonly textboxFocused: string;

  readonly selection: string;
  readonly scrollTrack: string;
  readonly scrollTrackBorder: string;
  readonly scrollThumbTop: string;
  readonly scrollThumbBot: string;
  readonly scrollThumbBorder: string;

  readonly tooltipBg: string;
  readonly tooltipBorder: string;

  readonly statusBarBg: string;
  readonly menuStripBg: string;
  readonly menuHoverBg: string;

  readonly progressBack: string;
  readonly progressFront: string;

  readonly shadow: string;

  readonly textNormal: string;
  readonly textDisabled: string;
  readonly textOnDark: string;

  readonly accent: string;

  readonly tabActiveTop: string;
  readonly tabActiveBot: string;
  readonly tabInactiveTop: string;
  readonly tabInactiveBot: string;

  readonly treeLines: string;
  readonly treeNormal: string;
  readonly treeHover: string;
  readonly treeSelected: string;

  readonly propLineNormal: string;
  readonly propLineSelected: string;
  readonly propLineHover: string;
  readonly propTitle: string;
  readonly propColumnNormal: string;
  readonly propColumnSelected: string;
  readonly propColumnHover: string;
  readonly propLabelNormal: string;
  readonly propLabelSelected: string;
  readonly propLabelHover: string;
  readonly propBorder: string;

  readonly modalBg: string;
  readonly tooltipText: string;

  readonly catHeader: string;
  readonly catHeaderClosed: string;
  readonly catLineText: string;
  readonly catLineTextHover: string;
  readonly catLineTextSelected: string;
  readonly catLineButton: string;
  readonly catLineButtonHover: string;
  readonly catLineButtonSelected: string;
  readonly catLineAltText: string;
  readonly catLineAltTextHover: string;
  readonly catLineAltTextSelected: string;
  readonly catLineAltButton: string;
  readonly catLineAltButtonHover: string;
  readonly catLineAltButtonSelected: string;
}

// ---------- Light palette (Windows-XP / silver theme — default) ----------

export const LIGHT_PALETTE: Palette = Object.freeze({
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
});

// ---------- Dark palette (VS Code-ish) ----------
//
// Tunable; refined by visual feedback. Same shape as LIGHT_PALETTE so
// `DynamicSkin` can swap one for the other at runtime without
// reaching for unset fields.

export const DARK_PALETTE: Palette = Object.freeze({
  canvasBg: '#1e1e1e',
  panelFill: '#2d2d30',
  panelBright: '#3a3a3d',
  panelDark: '#252526',
  panelHighlight: '#3e3e42',
  panelBorder: '#3f3f46',

  titleActiveTop: '#37373d',
  titleActiveBottom: '#2d2d30',
  titleInactiveTop: '#2a2a2c',
  titleInactiveBot: '#252526',

  buttonNormalTop: '#3a3a3d',
  buttonNormalBot: '#2d2d30',
  buttonHoverTop: '#4a4a52',
  buttonHoverBot: '#3a3a3d',
  buttonPressedTop: '#252526',
  buttonPressedBot: '#2d2d30',
  buttonDisabled: '#2d2d30',
  buttonBorder: '#3f3f46',

  textboxBg: '#1e1e1e',
  textboxBorder: '#3f3f46',
  textboxFocused: '#0098ff',

  selection: '#264f78',
  scrollTrack: '#1e1e1e',
  scrollTrackBorder: '#3f3f46',
  scrollThumbTop: '#4a4a52',
  scrollThumbBot: '#3a3a3d',
  scrollThumbBorder: '#5a5a62',

  tooltipBg: '#3c3c3c',
  tooltipBorder: '#5a5a62',

  statusBarBg: '#252526',
  menuStripBg: '#252526',
  menuHoverBg: '#094771',

  progressBack: '#252526',
  progressFront: '#0e7c1f',

  shadow: 'rgba(0,0,0,0.65)',

  textNormal: '#dcdcdc',
  textDisabled: '#6a6a6a',
  textOnDark: '#ffffff',

  accent: '#0098ff',

  tabActiveTop: '#3a3a3d',
  tabActiveBot: '#2d2d30',
  tabInactiveTop: '#252526',
  tabInactiveBot: '#1e1e1e',

  treeLines: '#5a5a62',
  treeNormal: '#dcdcdc',
  treeHover: '#ffffff',
  treeSelected: '#ffffff',

  propLineNormal: '#252526',
  propLineSelected: '#264f78',
  propLineHover: '#37373d',
  propTitle: '#dcdcdc',
  propColumnNormal: '#2d2d30',
  propColumnSelected: '#37468a',
  propColumnHover: '#3a3a3d',
  propLabelNormal: '#dcdcdc',
  propLabelSelected: '#ffffff',
  propLabelHover: '#ffffff',
  propBorder: '#3f3f46',

  modalBg: 'rgba(0,0,0,0.55)',
  tooltipText: '#dcdcdc',

  catHeader: '#dcdcdc',
  catHeaderClosed: '#6a6a6a',
  catLineText: '#dcdcdc',
  catLineTextHover: '#ffffff',
  catLineTextSelected: '#ffffff',
  catLineButton: '#dcdcdc',
  catLineButtonHover: '#ffffff',
  catLineButtonSelected: '#ffffff',
  catLineAltText: '#bcbcbc',
  catLineAltTextHover: '#ffffff',
  catLineAltTextSelected: '#ffffff',
  catLineAltButton: '#bcbcbc',
  catLineAltButtonHover: '#ffffff',
  catLineAltButtonSelected: '#ffffff',
});

// Back-compat alias — pre-theming code imports `PALETTE`. New code
// should reach for `LIGHT_PALETTE` / `DARK_PALETTE` explicitly.
export const PALETTE = LIGHT_PALETTE;

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

// Factories: take a Palette and return the corresponding baked-row
// arrays. Used by `DynamicSkin` so that switching themes at runtime
// rebuilds the strip from the active palette without ever falling back
// to stale Light values. The default-Light back-compat exports below
// keep the module-level `BAKED_ROW_500` / `BAKED_ROW_508` names alive
// for any external code that still imports them.

export function bakedRow508(p: Palette): readonly BakedColor[] {
  const out: BakedColor[] = [
    { name: 'Window.TitleActive', hex: '#003c74' },
    { name: 'Window.TitleInactive', hex: '#7a96b6' },
    { name: 'Button.Normal', hex: p.textNormal },
    { name: 'Button.Hover', hex: p.textNormal },
    { name: 'Tab.Active.Normal', hex: p.textNormal },
    { name: 'Tab.Active.Hover', hex: p.textNormal },
    { name: 'Tab.Inactive.Normal', hex: p.textNormal },
    { name: 'Tab.Inactive.Hover', hex: p.textNormal },
    { name: 'Label.Default', hex: p.textNormal },
    { name: 'Label.Bright', hex: p.textOnDark },
    { name: 'Tree.Lines', hex: p.treeLines },
    { name: 'Tree.Normal', hex: p.treeNormal },
    { name: 'Properties.Line_Normal', hex: p.propLineNormal },
    { name: 'Properties.Line_Selected', hex: p.propLineSelected },
    { name: 'Properties.Column_Normal', hex: p.propColumnNormal },
    { name: 'Properties.Column_Selected', hex: p.propColumnSelected },
    { name: 'Properties.Label_Normal', hex: p.propLabelNormal },
    { name: 'Properties.Label_Selected', hex: p.propLabelSelected },
    // Translucent — opaque #191919 turned the screen pitch black behind a
    // modal window, hiding the parent UI completely. The palette's
    // `modalBg` value tracks the right alpha for each theme.
    { name: 'ModalBackground', hex: p.modalBg },
    { name: 'TooltipText', hex: p.tooltipText },
    { name: 'Category.Line.Text', hex: p.catLineText },
    { name: 'Category.Line.Text_Hover', hex: p.catLineTextHover },
    { name: 'Category.Line.Button_Hover', hex: p.catLineButtonHover },
    { name: 'Category.Line.Button_Selected', hex: p.catLineButtonSelected },
    { name: 'Category.LineAlt.Text_Selected', hex: p.catLineAltTextSelected },
    { name: 'Category.LineAlt.Button', hex: p.catLineAltButton },
  ];
  for (const c of out) Object.freeze(c);
  return Object.freeze(out);
}

export function bakedRow500(p: Palette): readonly BakedColor[] {
  const out: BakedColor[] = [
    { name: 'Pad500_0', hex: '#000000' },
    { name: 'Pad500_1', hex: '#000000' },
    { name: 'Button.Down', hex: p.textNormal },
    { name: 'Button.Disabled', hex: p.textDisabled },
    { name: 'Tab.Active.Down', hex: p.textNormal },
    { name: 'Tab.Active.Disabled', hex: p.textDisabled },
    { name: 'Tab.Inactive.Down', hex: p.textNormal },
    { name: 'Tab.Inactive.Disabled', hex: p.textDisabled },
    { name: 'Label.Dark', hex: p.textNormal },
    { name: 'Label.Highlight', hex: p.textOnDark },
    { name: 'Tree.Hover', hex: p.treeHover },
    { name: 'Tree.Selected', hex: p.treeSelected },
    { name: 'Properties.Line_Hover', hex: p.propLineHover },
    { name: 'Properties.Title', hex: p.propTitle },
    { name: 'Properties.Column_Hover', hex: p.propColumnHover },
    { name: 'Properties.Border', hex: p.propBorder },
    { name: 'Properties.Label_Hover', hex: p.propLabelHover },
    { name: 'Pad500_17', hex: '#000000' },
    { name: 'Category.Header', hex: p.catHeader },
    { name: 'Category.Header_Closed', hex: p.catHeaderClosed },
    { name: 'Category.Line.Text_Selected', hex: p.catLineTextSelected },
    { name: 'Category.Line.Button', hex: p.catLineButton },
    { name: 'Category.LineAlt.Text', hex: p.catLineAltText },
    { name: 'Category.LineAlt.Text_Hover', hex: p.catLineAltTextHover },
    { name: 'Category.LineAlt.Button_Hover', hex: p.catLineAltButtonHover },
    { name: 'Category.LineAlt.Button_Selected', hex: p.catLineAltButtonSelected },
  ];
  for (const c of out) Object.freeze(c);
  return Object.freeze(out);
}

// Back-compat exports — pre-theming code reads these directly.
export const BAKED_ROW_508: readonly BakedColor[] = bakedRow508(LIGHT_PALETTE);
export const BAKED_ROW_500: readonly BakedColor[] = bakedRow500(LIGHT_PALETTE);
