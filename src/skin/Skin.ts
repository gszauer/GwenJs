// Skin — dispatches control-specific draw calls against the DynamicSkin
// atlas. Ports `Gwen::Skin::Base` (include/Gwen/Skin.h) + the textured
// concrete subclass `Gwen::Skin::TexturedBase`
// (include/Gwen/Skins/TexturedBase.h).
//
// Every `drawXxx` method maps 1:1 to an upstream `DrawXxx`. The two
// internal helpers (`drawBordered` / `drawSingle`) replace GWEN's
// `Texturing::Bordered::Draw` and `Texturing::Single::Draw` — they run
// the 9-slice math on-the-fly from `RegionInfo` rather than caching it
// on a per-region struct. Doing it inline once we have the region lookup
// trades a few extra multiplications for fewer allocations and a simpler
// API that's trivial to `console.log` when something looks wrong.
//
// Circular-import note: this file type-imports `Base` for the `ctrl`
// parameter; `Base` type-imports `Skin` in turn. The cycle is pure
// type-space and erased by TypeScript, so emit contains no runtime
// references either way.

import { cloneRect, color, type Color, type Rect } from '../core/Structures';
import { rect as mkRect } from '../core/Structures';
import type { WebGL2Renderer } from '../renderer/WebGL2Renderer';
import type { Base } from '../controls/Base';
import { DynamicSkin, type RegionInfo, type SkinColors } from './DynamicSkin';
import { font, type Font } from './FontAtlas';
import { PALETTE, type Palette } from './AtlasRegions';

// Helper — convert a '#rrggbb' or '#rgb' palette string into the byte-Color
// the renderer expects. Inlined here so the skin can pull palette values
// straight off PALETTE for solid-fill draws without round-tripping through
// the atlas.
function paletteColor(hex: string): Color {
  let h = hex.startsWith('#') ? hex.slice(1) : hex;
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return color((n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff, 255);
}

// All regions live inside the 512×512 atlas.
const ATLAS_SIZE = 512;

// Half-texel inset applied to the OUTER UVs of every blit. Because the
// renderer samples LINEAR, a UV that lands exactly on a region boundary
// will blend the edge texel with the texel one column/row outside the
// region — which is unpainted (transparent) for stand-alone regions and
// completely unrelated content for regions packed against neighbours.
// Insetting by half a texel snaps the leftmost/rightmost destination
// pixels to the centres of the leftmost/rightmost in-region texels, so
// the sampler never reaches outside the region's painted footprint.
const HALF_TEXEL = 0.5 / ATLAS_SIZE;

// Patch indices used by the 9-slice variant — ordered the way GWEN's
// Texturing::Bordered::Draw lists them (reading matrix order):
//   0 TL   1 T    2 TR
//   3 L    4 C    5 R
//   6 BL   7 B    8 BR
const P_TL = 0;
const P_T = 1;
const P_TR = 2;
const P_L = 3;
const P_C = 4;
const P_R = 5;
const P_BL = 6;
const P_B = 7;
const P_BR = 8;

const WHITE: Color = color(255, 255, 255, 255);

// ---------- Class ----------

export class Skin {
  readonly renderer: WebGL2Renderer;
  readonly dynamicSkin: DynamicSkin;
  defaultFont: Font = font('Arial', 14);

  constructor(renderer: WebGL2Renderer) {
    this.renderer = renderer;
    this.dynamicSkin = new DynamicSkin(renderer);
  }

  init(): void {
    this.dynamicSkin.init();
  }

  get colors(): SkinColors {
    return this.dynamicSkin.colors;
  }

  /**
   * Swap the active palette and re-paint the atlas. Use the stock
   * `LIGHT_PALETTE` / `DARK_PALETTE` exports from `AtlasRegions`, or
   * supply your own object that satisfies the `Palette` shape.
   * Texture handle stays stable; controls keep working without
   * re-construction.
   */
  setTheme(palette: Palette): void {
    this.dynamicSkin.setTheme(palette);
  }

  getPalette(): Palette {
    return this.dynamicSkin.getPalette();
  }

  // ======================================================================
  // 9-slice + single helpers
  // ======================================================================

  // drawBordered — 9-slice blit. `patchMask`, when supplied, is a length-9
  // boolean array; `patchMask[i] === false` suppresses patch `i` (used by
  // DrawGroupBox to punch a hole where the title sits).
  private drawBordered(regionName: string, r: Rect, col: Color = WHITE, patchMask?: readonly boolean[]): void {
    const region = this.dynamicSkin.regions.get(regionName);
    if (!region) return; // Unknown region — silently skip rather than crash.
    const tex = this.dynamicSkin.getTexture();

    this.renderer.setDrawColor(col);

    const ml = region.marginLeft ?? 0;
    const mt = region.marginTop ?? 0;
    const mr = region.marginRight ?? 0;
    const mb = region.marginBottom ?? 0;

    // Outer UVs — half-texel inset so the LINEAR sampler doesn't blend
    // in transparent pixels just outside the region's painted footprint.
    const uvLeft = region.uv[0] + HALF_TEXEL;
    const uvTop = region.uv[1] + HALF_TEXEL;
    const uvRight = region.uv[2] - HALF_TEXEL;
    const uvBottom = region.uv[3] - HALF_TEXEL;

    // Special-case degenerate dst rects that are smaller than the natural
    // atlas region on *both* axes — GWEN (Texturing.h:108) uses
    // `if (r.w < width && r.h < height)` against the full region size
    // (not the margin sum), and it's an AND, not an OR. Stretch the whole
    // region as a single textured rect in that case.
    if (r.w < region.w && r.h < region.h) {
      this.renderer.drawTexturedRect(tex, r, uvLeft, uvTop, uvRight, uvBottom);
      return;
    }

    // Inner split UVs left at exact texel boundaries — both sides of the
    // split sample the same value so the soft 50/50 blend is internally
    // consistent and contained to a 1-pixel band.
    const uv0 = uvLeft;
    const uv1 = region.uv[0] + ml / ATLAS_SIZE;
    const uv2 = region.uv[2] - mr / ATLAS_SIZE;
    const uv3 = uvRight;
    const vv0 = uvTop;
    const vv1 = region.uv[1] + mt / ATLAS_SIZE;
    const vv2 = region.uv[3] - mb / ATLAS_SIZE;
    const vv3 = uvBottom;

    const rx = r.x;
    const ry = r.y;
    const rw = r.w;
    const rh = r.h;
    const midW = rw - ml - mr;
    const midH = rh - mt - mb;

    const mask = patchMask;
    const skip = (i: number): boolean => mask !== undefined && mask[i] === false;

    if (!skip(P_TL)) this.renderer.drawTexturedRect(tex, mkRect(rx, ry, ml, mt), uv0, vv0, uv1, vv1);
    if (!skip(P_T)) this.renderer.drawTexturedRect(tex, mkRect(rx + ml, ry, midW, mt), uv1, vv0, uv2, vv1);
    if (!skip(P_TR)) this.renderer.drawTexturedRect(tex, mkRect(rx + ml + midW, ry, mr, mt), uv2, vv0, uv3, vv1);
    if (!skip(P_L)) this.renderer.drawTexturedRect(tex, mkRect(rx, ry + mt, ml, midH), uv0, vv1, uv1, vv2);
    if (!skip(P_C)) this.renderer.drawTexturedRect(tex, mkRect(rx + ml, ry + mt, midW, midH), uv1, vv1, uv2, vv2);
    if (!skip(P_R)) this.renderer.drawTexturedRect(tex, mkRect(rx + ml + midW, ry + mt, mr, midH), uv2, vv1, uv3, vv2);
    if (!skip(P_BL)) this.renderer.drawTexturedRect(tex, mkRect(rx, ry + mt + midH, ml, mb), uv0, vv2, uv1, vv3);
    if (!skip(P_B)) this.renderer.drawTexturedRect(tex, mkRect(rx + ml, ry + mt + midH, midW, mb), uv1, vv2, uv2, vv3);
    if (!skip(P_BR)) this.renderer.drawTexturedRect(tex, mkRect(rx + ml + midW, ry + mt + midH, mr, mb), uv2, vv2, uv3, vv3);
  }

  private drawSingle(regionName: string, r: Rect, col: Color = WHITE): void {
    const region = this.dynamicSkin.regions.get(regionName);
    if (!region) return;
    this.renderer.setDrawColor(col);
    this.renderer.drawTexturedRect(
      this.dynamicSkin.getTexture(),
      r,
      region.uv[0] + HALF_TEXEL,
      region.uv[1] + HALF_TEXEL,
      region.uv[2] - HALF_TEXEL,
      region.uv[3] - HALF_TEXEL,
    );
  }

  private drawSingleCentered(regionName: string, r: Rect, col: Color = WHITE): void {
    const region = this.dynamicSkin.regions.get(regionName);
    if (!region) return;
    const cx = r.x + (r.w - region.w) * 0.5;
    const cy = r.y + (r.h - region.h) * 0.5;
    this.renderer.setDrawColor(col);
    this.renderer.drawTexturedRect(
      this.dynamicSkin.getTexture(),
      mkRect(cx, cy, region.w, region.h),
      region.uv[0] + HALF_TEXEL,
      region.uv[1] + HALF_TEXEL,
      region.uv[2] - HALF_TEXEL,
      region.uv[3] - HALF_TEXEL,
    );
  }

  // ======================================================================
  // Primitive symbols — ported from Skin.cpp:25-78
  // ======================================================================

  drawArrowDown(r: Rect): void {
    const x = r.w / 5.0;
    const y = r.h / 5.0;
    this.renderer.drawFilledRect(mkRect(r.x + x * 0, r.y + y * 1, x, y * 1));
    this.renderer.drawFilledRect(mkRect(r.x + x * 1, r.y + y * 1, x, y * 2));
    this.renderer.drawFilledRect(mkRect(r.x + x * 2, r.y + y * 1, x, y * 3));
    this.renderer.drawFilledRect(mkRect(r.x + x * 3, r.y + y * 1, x, y * 2));
    this.renderer.drawFilledRect(mkRect(r.x + x * 4, r.y + y * 1, x, y * 1));
  }

  drawArrowUp(r: Rect): void {
    const x = r.w / 5.0;
    const y = r.h / 5.0;
    this.renderer.drawFilledRect(mkRect(r.x + x * 0, r.y + y * 3, x, y * 1));
    this.renderer.drawFilledRect(mkRect(r.x + x * 1, r.y + y * 2, x, y * 2));
    this.renderer.drawFilledRect(mkRect(r.x + x * 2, r.y + y * 1, x, y * 3));
    this.renderer.drawFilledRect(mkRect(r.x + x * 3, r.y + y * 2, x, y * 2));
    this.renderer.drawFilledRect(mkRect(r.x + x * 4, r.y + y * 3, x, y * 1));
  }

  drawArrowLeft(r: Rect): void {
    const x = r.w / 5.0;
    const y = r.h / 5.0;
    this.renderer.drawFilledRect(mkRect(r.x + x * 3, r.y + y * 0, x * 1, y));
    this.renderer.drawFilledRect(mkRect(r.x + x * 2, r.y + y * 1, x * 2, y));
    this.renderer.drawFilledRect(mkRect(r.x + x * 1, r.y + y * 2, x * 3, y));
    this.renderer.drawFilledRect(mkRect(r.x + x * 2, r.y + y * 3, x * 2, y));
    this.renderer.drawFilledRect(mkRect(r.x + x * 3, r.y + y * 4, x * 1, y));
  }

  drawArrowRight(r: Rect): void {
    const x = r.w / 5.0;
    const y = r.h / 5.0;
    this.renderer.drawFilledRect(mkRect(r.x + x * 1, r.y + y * 0, x * 1, y));
    this.renderer.drawFilledRect(mkRect(r.x + x * 1, r.y + y * 1, x * 2, y));
    this.renderer.drawFilledRect(mkRect(r.x + x * 1, r.y + y * 2, x * 3, y));
    this.renderer.drawFilledRect(mkRect(r.x + x * 1, r.y + y * 3, x * 2, y));
    this.renderer.drawFilledRect(mkRect(r.x + x * 1, r.y + y * 4, x * 1, y));
  }

  drawCheck(r: Rect): void {
    const x = r.w / 5.0;
    const y = r.h / 5.0;
    this.renderer.drawFilledRect(mkRect(r.x + x * 0, r.y + y * 3, x * 2, y * 2));
    this.renderer.drawFilledRect(mkRect(r.x + x * 1, r.y + y * 4, x * 2, y * 2));
    this.renderer.drawFilledRect(mkRect(r.x + x * 2, r.y + y * 3, x * 2, y * 2));
    this.renderer.drawFilledRect(mkRect(r.x + x * 3, r.y + y * 1, x * 2, y * 2));
    this.renderer.drawFilledRect(mkRect(r.x + x * 4, r.y + y * 0, x * 2, y * 2));
  }

  // ======================================================================
  // Button / input bordered
  // ======================================================================

  drawGenericPanel(ctrl: Base): void {
    this.drawBordered('Panel.Normal', ctrl.getRenderBounds());
  }

  drawButton(ctrl: Base, depressed: boolean, hovered: boolean, disabled: boolean): void {
    if (disabled) {
      this.drawBordered('Input.Button.Disabled', ctrl.getRenderBounds());
      return;
    }
    if (depressed) {
      this.drawBordered('Input.Button.Pressed', ctrl.getRenderBounds());
      return;
    }
    if (hovered) {
      this.drawBordered('Input.Button.Hovered', ctrl.getRenderBounds());
      return;
    }
    this.drawBordered('Input.Button.Normal', ctrl.getRenderBounds());
  }

  drawTextBox(ctrl: Base): void {
    if (ctrl.isDisabled()) {
      this.drawBordered('TextBox.Disabled', ctrl.getRenderBounds());
      return;
    }
    if (ctrl.hasFocus()) {
      this.drawBordered('TextBox.Focus', ctrl.getRenderBounds());
    } else {
      this.drawBordered('TextBox.Normal', ctrl.getRenderBounds());
    }
  }

  // ======================================================================
  // Checkbox / radio
  // ======================================================================

  drawCheckBox(ctrl: Base, checked: boolean, _depressed: boolean): void {
    const disabled = ctrl.isDisabled();
    const key = checked
      ? disabled
        ? 'Checkbox.Disabled.Checked'
        : 'Checkbox.Active.Checked'
      : disabled
        ? 'Checkbox.Disabled.Normal'
        : 'Checkbox.Active.Normal';
    this.drawSingle(key, ctrl.getRenderBounds());
  }

  drawRadioButton(ctrl: Base, selected: boolean, _depressed: boolean): void {
    const disabled = ctrl.isDisabled();
    const key = selected
      ? disabled
        ? 'RadioButton.Disabled.Checked'
        : 'RadioButton.Active.Checked'
      : disabled
        ? 'RadioButton.Disabled.Normal'
        : 'RadioButton.Active.Normal';
    this.drawSingle(key, ctrl.getRenderBounds());
  }

  // ======================================================================
  // Window frame + title buttons
  // ======================================================================

  drawWindow(ctrl: Base, _topHeight: number, inFocus: boolean): void {
    this.drawBordered(inFocus ? 'Window.Normal' : 'Window.Inactive', ctrl.getRenderBounds());
  }

  // Window-button draws use the control's render bounds directly
  // (rather than a hardcoded 31×31 dest rect). The atlas art is 31×31,
  // but the title bar is shorter than that — drawing 31×31 inside a
  // 22px-tall dragger clips the bottom of the button. Letting the
  // skin scale the texture to the control's actual size keeps the
  // glyph fully visible regardless of the title-bar height the host
  // chose.

  drawWindowCloseButton(ctrl: Base, depressed: boolean, hovered: boolean, disabled: boolean): void {
    const r = ctrl.getRenderBounds();
    if (disabled) {
      this.drawSingle('Window.Close', r, color(255, 255, 255, 50));
      return;
    }
    if (depressed) {
      this.drawSingle('Window.Close_Down', r);
      return;
    }
    if (hovered) {
      this.drawSingle('Window.Close_Hover', r);
      return;
    }
    this.drawSingle('Window.Close', r);
  }

  drawWindowMaximizeButton(
    ctrl: Base,
    depressed: boolean,
    hovered: boolean,
    disabled: boolean,
    maximized: boolean,
  ): void {
    const r = ctrl.getRenderBounds();
    if (!maximized) {
      if (disabled) {
        this.drawSingle('Window.Maxi', r, color(255, 255, 255, 50));
        return;
      }
      if (depressed) {
        this.drawSingle('Window.Maxi_Down', r);
        return;
      }
      if (hovered) {
        this.drawSingle('Window.Maxi_Hover', r);
        return;
      }
      this.drawSingle('Window.Maxi', r);
      return;
    }
    if (disabled) {
      this.drawSingle('Window.Restore', r, color(255, 255, 255, 50));
      return;
    }
    if (depressed) {
      this.drawSingle('Window.Restore_Down', r);
      return;
    }
    if (hovered) {
      this.drawSingle('Window.Restore_Hover', r);
      return;
    }
    this.drawSingle('Window.Restore', r);
  }

  drawWindowMinimizeButton(ctrl: Base, depressed: boolean, hovered: boolean, disabled: boolean): void {
    const r = ctrl.getRenderBounds();
    if (disabled) {
      this.drawSingle('Window.Mini', r, color(255, 255, 255, 100));
      return;
    }
    if (depressed) {
      this.drawSingle('Window.Mini_Down', r);
      return;
    }
    if (hovered) {
      this.drawSingle('Window.Mini_Hover', r);
      return;
    }
    this.drawSingle('Window.Mini', r);
  }

  // ======================================================================
  // Highlight / feedback
  // ======================================================================

  drawHighlight(ctrl: Base): void {
    this.renderer.setDrawColor(color(255, 100, 255, 255));
    this.renderer.drawFilledRect(ctrl.getRenderBounds());
  }

  // Alternating-pixel focus ring. Direct port of TexturedBase.h:768.
  drawKeyboardHighlight(ctrl: Base, r: Rect, offset: number): void {
    // Localize the passed rect so we can shrink without mutating the
    // caller's data.
    const rect: Rect = {
      x: r.x + offset,
      y: r.y + offset,
      w: r.w - offset * 2,
      h: r.h - offset * 2,
    };
    this.renderer.setDrawColor(color(0, 0, 0, 255));
    let skip = true;
    const halfW = Math.floor(rect.w * 0.5);
    for (let i = 0; i < halfW; i++) {
      if (!skip) {
        this.renderer.drawPixel(rect.x + i * 2, rect.y);
        this.renderer.drawPixel(rect.x + i * 2, rect.y + rect.h - 1);
      } else {
        skip = !skip;
      }
    }
    skip = false;
    const halfH = Math.floor(rect.h * 0.5);
    for (let i = 0; i < halfH; i++) {
      if (!skip) {
        this.renderer.drawPixel(rect.x, rect.y + i * 2);
        this.renderer.drawPixel(rect.x + rect.w - 1, rect.y + i * 2);
      } else {
        skip = !skip;
      }
    }
    void ctrl;
  }

  // ======================================================================
  // Misc bordered overlays
  // ======================================================================

  drawStatusBar(ctrl: Base): void {
    this.drawBordered('StatusBar', ctrl.getRenderBounds());
  }

  drawShadow(ctrl: Base): void {
    const b = ctrl.getRenderBounds();
    const r = mkRect(b.x - 4, b.y - 4, b.w + 10, b.h + 10);
    this.drawBordered('Shadow', r);
  }

  drawToolTip(ctrl: Base): void {
    this.drawBordered('Tooltip', ctrl.getRenderBounds());
  }

  drawModalControl(ctrl: Base): void {
    if (!ctrl.shouldDrawBackground()) return;
    this.renderer.setDrawColor(this.colors.modalBackground);
    this.renderer.drawFilledRect(ctrl.getRenderBounds());
  }

  // ======================================================================
  // Scrollbar
  // ======================================================================

  drawScrollBar(ctrl: Base, isHorizontal: boolean, _depressed: boolean): void {
    this.drawBordered(isHorizontal ? 'Scroller.TrackH' : 'Scroller.TrackV', ctrl.getRenderBounds());
  }

  drawScrollBarBar(ctrl: Base, depressed: boolean, hovered: boolean, isHorizontal: boolean): void {
    if (!isHorizontal) {
      if (ctrl.isDisabled()) {
        this.drawBordered('Scroller.ButtonV_Disabled', ctrl.getRenderBounds());
        return;
      }
      if (depressed) {
        this.drawBordered('Scroller.ButtonV_Down', ctrl.getRenderBounds());
        return;
      }
      if (hovered) {
        this.drawBordered('Scroller.ButtonV_Hover', ctrl.getRenderBounds());
        return;
      }
      this.drawBordered('Scroller.ButtonV_Normal', ctrl.getRenderBounds());
      return;
    }
    if (ctrl.isDisabled()) {
      this.drawBordered('Scroller.ButtonH_Disabled', ctrl.getRenderBounds());
      return;
    }
    if (depressed) {
      this.drawBordered('Scroller.ButtonH_Down', ctrl.getRenderBounds());
      return;
    }
    if (hovered) {
      this.drawBordered('Scroller.ButtonH_Hover', ctrl.getRenderBounds());
      return;
    }
    this.drawBordered('Scroller.ButtonH_Normal', ctrl.getRenderBounds());
  }

  // dir values: Pos.Left=2 → i=0, Pos.Top=8 → i=1, Pos.Right=4 → i=2,
  // Pos.Bottom=16 → i=3 (matching the upstream array order).
  drawScrollButton(ctrl: Base, direction: number, depressed: boolean, hovered: boolean, disabled: boolean): void {
    let i = 0;
    if (direction === 8) i = 1;       // Pos.Top
    else if (direction === 4) i = 2;  // Pos.Right
    else if (direction === 16) i = 3; // Pos.Bottom
    // Pos.Left (2) stays 0.
    const state = disabled ? 'Disabled' : depressed ? 'Down' : hovered ? 'Hover' : 'Normal';
    this.drawBordered(`Scroller.Button.${state}[${i}]`, ctrl.getRenderBounds());
  }

  // ======================================================================
  // Progress bar
  // ======================================================================

  drawProgressBar(ctrl: Base, isHorizontal: boolean, progress: number): void {
    const rect = cloneRect(ctrl.getRenderBounds());
    if (isHorizontal) {
      this.drawBordered('ProgressBar.Back', rect);
      rect.w = Math.floor(rect.w * progress);
      if (rect.w > 0) this.drawBordered('ProgressBar.Front', rect);
      return;
    }
    this.drawBordered('ProgressBar.Back', rect);
    const invProgress = Math.floor(rect.h * (1 - progress));
    rect.y += invProgress;
    rect.h -= invProgress;
    this.drawBordered('ProgressBar.Front', rect);
  }

  // ======================================================================
  // Slider
  // ======================================================================

  // The 1px track + centre notches. Matches TexturedBase.h:730.
  drawSlider(ctrl: Base, isHorizontal: boolean, numNotches: number, barSize: number): void {
    if (isHorizontal) {
      const r = cloneRect(ctrl.getRenderBounds());
      r.x += barSize * 0.5;
      r.w -= barSize;
      r.y += r.h * 0.5 - 1;
      r.h = 1;
      this.renderer.setDrawColor(color(0, 0, 0, 100));
      this.drawSliderNotchesH(r, numNotches, barSize * 0.5);
      this.renderer.drawFilledRect(r);
      return;
    }
    const r = cloneRect(ctrl.getRenderBounds());
    r.y += barSize * 0.5;
    r.h -= barSize;
    r.x += r.w * 0.5 - 1;
    r.w = 1;
    this.renderer.setDrawColor(color(0, 0, 0, 100));
    this.drawSliderNotchesV(r, numNotches, barSize * 0.4);
    this.renderer.drawFilledRect(r);
  }

  // The draggable thumb — centred blit of the appropriate 15×15 single.
  drawSlideButton(ctrl: Base, depressed: boolean, horizontal: boolean): void {
    const rb = ctrl.getRenderBounds();
    const prefix = horizontal ? 'Input.Slider.H' : 'Input.Slider.V';
    if (ctrl.isDisabled()) {
      this.drawSingleCentered(`${prefix}.Disabled`, rb);
      return;
    }
    if (depressed) {
      this.drawSingleCentered(`${prefix}.Down`, rb);
      return;
    }
    if (ctrl.isHovered()) {
      this.drawSingleCentered(`${prefix}.Hover`, rb);
      return;
    }
    this.drawSingleCentered(`${prefix}.Normal`, rb);
  }

  // Alias — GWEN spells it `DrawSlideButton`; the spec notes the rename.
  // Both names route here.
  drawSliderBar(ctrl: Base, depressed: boolean, horizontal: boolean): void {
    this.drawSlideButton(ctrl, depressed, horizontal);
  }

  private drawSliderNotchesH(r: Rect, numNotches: number, dist: number): void {
    if (numNotches === 0) return;
    const spacing = r.w / numNotches;
    for (let i = 0; i < numNotches + 1; i++) {
      this.renderer.drawFilledRect(mkRect(r.x + spacing * i, r.y + dist - 2, 1, 5));
    }
  }

  private drawSliderNotchesV(r: Rect, numNotches: number, dist: number): void {
    if (numNotches === 0) return;
    const spacing = r.h / numNotches;
    for (let i = 0; i < numNotches + 1; i++) {
      this.renderer.drawFilledRect(mkRect(r.x + dist - 1, r.y + spacing * i, 5, 1));
    }
  }

  // ======================================================================
  // Combo box
  // ======================================================================

  drawComboBox(ctrl: Base, down: boolean, menuOpen: boolean): void {
    if (ctrl.isDisabled()) {
      this.drawBordered('Input.ComboBox.Disabled', ctrl.getRenderBounds());
      return;
    }
    if (down || menuOpen) {
      this.drawBordered('Input.ComboBox.Down', ctrl.getRenderBounds());
      return;
    }
    if (ctrl.isHovered()) {
      this.drawBordered('Input.ComboBox.Hover', ctrl.getRenderBounds());
      return;
    }
    this.drawBordered('Input.ComboBox.Normal', ctrl.getRenderBounds());
  }

  drawComboDownArrow(ctrl: Base, hovered: boolean, down: boolean, menuOpen: boolean, disabled: boolean): void {
    const rb = ctrl.getRenderBounds();
    if (disabled) {
      this.drawSingle('Input.ComboBox.Button.Disabled', rb);
      return;
    }
    if (down || menuOpen) {
      this.drawSingle('Input.ComboBox.Button.Down', rb);
      return;
    }
    if (hovered) {
      this.drawSingle('Input.ComboBox.Button.Hover', rb);
      return;
    }
    this.drawSingle('Input.ComboBox.Button.Normal', rb);
  }

  // ======================================================================
  // Numeric up/down
  // ======================================================================

  drawNumericUpDownButton(ctrl: Base, depressed: boolean, up: boolean): void {
    const rb = ctrl.getRenderBounds();
    const prefix = up ? 'Input.UpDown.Up' : 'Input.UpDown.Down';
    if (ctrl.isDisabled()) {
      this.drawSingleCentered(`${prefix}.Disabled`, rb);
      return;
    }
    if (depressed) {
      this.drawSingleCentered(`${prefix}.Down`, rb);
      return;
    }
    if (ctrl.isHovered()) {
      this.drawSingleCentered(`${prefix}.Hover`, rb);
      return;
    }
    this.drawSingleCentered(`${prefix}.Normal`, rb);
  }

  // ======================================================================
  // Menu
  // ======================================================================

  drawMenuStrip(ctrl: Base): void {
    // Drawn with solid-fill rects rather than a 9-slice'd atlas region —
    // the strip's body is a flat colour and the bevels are 1px lines.
    // Going through the atlas was producing a faint white smear along
    // the left edge and a darker smear along the right edge of long
    // menu bars: LINEAR sampling at the inner-split boundary blends the
    // bevel column into the centre's first dest pixels regardless of
    // the chosen margin. A direct rect blit sidesteps the atlas
    // entirely.
    //
    // Only top/bottom (horizontal) bevels are drawn. Vertical
    // left/right bevels would frame the strip in 1px white-on-grey,
    // which on a strip that extends to the canvas edges reads as a
    // "stripe" running down the side rather than an inset highlight.
    const r = ctrl.getRenderBounds();
    const renderer = this.renderer;
    // Use the active palette so theme switches re-color the strip.
    renderer.setDrawColor(paletteColor(this.dynamicSkin.getPalette().menuStripBg));
    renderer.drawFilledRect(r);
    // Top highlight (1px white).
    renderer.setDrawColor(color(255, 255, 255, 255));
    renderer.drawFilledRect(mkRect(r.x, r.y, r.w, 1));
    // Bottom shadow (1px medium grey).
    renderer.setDrawColor(color(160, 160, 160, 255));
    renderer.drawFilledRect(mkRect(r.x, r.y + r.h - 1, r.w, 1));
  }

  drawMenu(ctrl: Base, paddingDisabled: boolean): void {
    if (!paddingDisabled) {
      this.drawBordered('Menu.BackgroundWithMargin', ctrl.getRenderBounds());
      return;
    }
    this.drawBordered('Menu.Background', ctrl.getRenderBounds());
  }

  drawMenuItem(ctrl: Base, submenuOpen: boolean, checked: boolean): void {
    const rb = ctrl.getRenderBounds();
    if (submenuOpen || ctrl.isHovered()) {
      this.drawBordered('Menu.Hover', rb);
    }
    if (checked) {
      this.drawSingle('Menu.Check', mkRect(rb.x + 4, rb.y + 3, 15, 15));
    }
  }

  drawMenuRightArrow(ctrl: Base): void {
    this.drawSingle('Menu.RightArrow', ctrl.getRenderBounds());
  }

  drawMenuDivider(ctrl: Base): void {
    this.renderer.setDrawColor(color(0, 0, 0, 100));
    this.renderer.drawFilledRect(ctrl.getRenderBounds());
  }

  // ======================================================================
  // Tab
  // ======================================================================

  drawTabControl(ctrl: Base): void {
    this.drawBordered('Tab.Control', ctrl.getRenderBounds());
  }

  drawTabTitleBar(ctrl: Base): void {
    this.drawBordered('Tab.HeaderBar', ctrl.getRenderBounds());
  }

  drawTabButton(ctrl: Base, active: boolean, dir: number): void {
    if (active) {
      this.drawActiveTabButton(ctrl, dir);
      return;
    }
    // Pos constants: Bottom=16, Top=8, Left=2, Right=4.
    const rb = ctrl.getRenderBounds();
    if (dir === 16) this.drawBordered('Tab.Bottom.Inactive', rb);
    else if (dir === 8) this.drawBordered('Tab.Top.Inactive', rb);
    else if (dir === 2) this.drawBordered('Tab.Left.Inactive', rb);
    else if (dir === 4) this.drawBordered('Tab.Right.Inactive', rb);
  }

  // Active tabs extend an 8px strip into the content area so they appear
  // attached. See TexturedBase.h:569.
  private drawActiveTabButton(ctrl: Base, dir: number): void {
    const b = ctrl.getRenderBounds();
    if (dir === 16) {
      // Bottom
      this.drawBordered('Tab.Bottom.Active', mkRect(b.x, b.y - 8, b.w, b.h + 8));
      return;
    }
    if (dir === 8) {
      // Top
      this.drawBordered('Tab.Top.Active', mkRect(b.x, b.y, b.w, b.h + 8));
      return;
    }
    if (dir === 2) {
      // Left
      this.drawBordered('Tab.Left.Active', mkRect(b.x, b.y, b.w + 8, b.h));
      return;
    }
    if (dir === 4) {
      // Right
      this.drawBordered('Tab.Right.Active', mkRect(b.x - 8, b.y, b.w + 8, b.h));
      return;
    }
  }

  // ======================================================================
  // List box
  // ======================================================================

  drawListBox(ctrl: Base): void {
    this.drawBordered('Input.ListBox.Background', ctrl.getRenderBounds());
  }

  drawListBoxLine(ctrl: Base, selected: boolean, even: boolean): void {
    const rb = ctrl.getRenderBounds();
    if (selected) {
      this.drawBordered(even ? 'Input.ListBox.EvenLineSelected' : 'Input.ListBox.OddLineSelected', rb);
      return;
    }
    if (ctrl.isHovered()) {
      this.drawBordered('Input.ListBox.Hovered', rb);
      return;
    }
    this.drawBordered(even ? 'Input.ListBox.EvenLine' : 'Input.ListBox.OddLine', rb);
  }

  // ======================================================================
  // Tree
  // ======================================================================

  drawTreeControl(ctrl: Base): void {
    this.drawBordered('Tree.Background', ctrl.getRenderBounds());
  }

  drawTreeButton(ctrl: Base, open: boolean): void {
    this.drawSingle(open ? 'Tree.Minus' : 'Tree.Plus', ctrl.getRenderBounds());
  }

  // Matches the composite TreeNode rendering from TexturedBase.h:998 +
  // Skin.cpp:80. The selection highlight renders first, then the horizontal
  // line to the expand button, then (if open) the vertical run down the
  // left gutter.
  drawTreeNode(
    _ctrl: Base,
    open: boolean,
    selected: boolean,
    labelHeight: number,
    labelWidth: number,
    halfWay: number,
    lastBranch: number,
    isRoot: boolean,
  ): void {
    if (selected) {
      this.drawBordered('Selection', mkRect(17, 0, labelWidth + 2, labelHeight - 1));
    }
    this.renderer.setDrawColor(this.colors.tree.lines);
    if (!isRoot) {
      this.renderer.drawFilledRect(mkRect(8, halfWay, 16 - 9, 1));
    }
    if (!open) return;
    this.renderer.drawFilledRect(mkRect(14 + 7, labelHeight + 1, 1, lastBranch + halfWay - labelHeight));
  }

  // ======================================================================
  // Property grid
  // ======================================================================

  drawPropertyRow(ctrl: Base, labelWidth: number, beingEdited: boolean, hovered: boolean): void {
    const rect = ctrl.getRenderBounds();
    // Column strip
    const col = beingEdited
      ? this.colors.properties.column_selected
      : hovered
        ? this.colors.properties.column_hover
        : this.colors.properties.column_normal;
    this.renderer.setDrawColor(col);
    this.renderer.drawFilledRect(mkRect(0, rect.y, labelWidth, rect.h));
    // Separator line
    const line = beingEdited
      ? this.colors.properties.line_selected
      : hovered
        ? this.colors.properties.line_hover
        : this.colors.properties.line_normal;
    this.renderer.setDrawColor(line);
    this.renderer.drawFilledRect(mkRect(labelWidth, rect.y, 1, rect.h));
    // Bottom border
    this.renderer.drawFilledRect(mkRect(rect.x, rect.y + rect.h - 1, rect.w, 1));
  }

  drawPropertyTreeNode(ctrl: Base, borderLeft: number, borderTop: number): void {
    const r = ctrl.getRenderBounds();
    this.renderer.setDrawColor(this.colors.properties.border);
    this.renderer.drawFilledRect(mkRect(r.x, r.y, borderLeft, r.h));
    this.renderer.drawFilledRect(mkRect(r.x + borderLeft, r.y, r.w - borderLeft, borderTop));
  }

  // ======================================================================
  // Color display
  // ======================================================================

  // Matches TexturedBase.h:885. Draws a checkerboard under any non-opaque
  // color so alpha is visible.
  drawColorDisplay(ctrl: Base, col: Color): void {
    const rect = ctrl.getRenderBounds();
    if (col.a !== 255) {
      this.renderer.setDrawColor(color(255, 255, 255, 255));
      this.renderer.drawFilledRect(rect);
      this.renderer.setDrawColor(color(128, 128, 128, 128));
      this.renderer.drawFilledRect(mkRect(0, 0, rect.w * 0.5, rect.h * 0.5));
      this.renderer.drawFilledRect(mkRect(rect.w * 0.5, rect.h * 0.5, rect.w * 0.5, rect.h * 0.5));
    }
    this.renderer.setDrawColor(col);
    this.renderer.drawFilledRect(rect);
    this.renderer.setDrawColor(color(0, 0, 0, 255));
    this.renderer.drawLinedRect(rect);
  }

  // ======================================================================
  // Category list
  // ======================================================================

  drawCategoryHolder(ctrl: Base): void {
    this.drawBordered('CategoryList.Outer', ctrl.getRenderBounds());
  }

  drawCategoryInner(ctrl: Base, collapsed: boolean): void {
    if (collapsed) {
      this.drawBordered('CategoryList.Header', ctrl.getRenderBounds());
      return;
    }
    this.drawBordered('CategoryList.Inner', ctrl.getRenderBounds());
  }

  // ======================================================================
  // Group box
  // ======================================================================

  // Two bordered passes: the first draws the full frame except the top-
  // center strip (patch P_T / index 1) so the title label sits in an
  // empty gap; the second re-draws the top-center strip starting after
  // the text so the frame closes up to the right of the title.
  // Matches TexturedBase.h:547.
  drawGroupBox(ctrl: Base, textStart: number, textHeight: number, textWidth: number): void {
    const rect = cloneRect(ctrl.getRenderBounds());
    rect.y += Math.floor(textHeight * 0.5);
    rect.h -= Math.floor(textHeight * 0.5);
    // First pass: suppress only patch index 1 (P_T, the top-center strip
    // between the two top corners) so the frame has a gap where the
    // title label will render. Upstream TexturedBase.h:552:
    //   Draw(..., true, false, true, true, true, true, true, true, true)
    this.drawBordered('GroupBox', rect, WHITE, [true, false, true, true, true, true, true, true, true]);
    // Second pass: offset past the title text and re-draw the top-center
    // strip only (index 1). Upstream TexturedBase.h:555 calls
    //   Draw(..., false, true, false, false, false, false, false, false, false)
    rect.x += textStart + textWidth - 4;
    rect.w -= textStart + textWidth - 4;
    this.drawBordered('GroupBox', rect, WHITE, [false, true, false, false, false, false, false, false, false]);
  }

  // ======================================================================
  // Font management
  // ======================================================================

  setDefaultFont(name: string, size: number): void {
    this.defaultFont = font(name, size);
  }

  getDefaultFont(): Font {
    return this.defaultFont;
  }

  releaseFont(f: Font): void {
    this.renderer.freeFont(f);
  }
}
