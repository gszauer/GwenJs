// ColorLerpBox + ColorSlider — the two interactive surfaces that
// together form the GWEN HSV color picker. Port
// `Gwen::Controls::ColorLerpBox` and `Gwen::Controls::ColorSlider` from
// include/Gwen/Controls/ColorControls.h + src/Controls/ColorControls.cpp.
//
// ColorLerpBox bakes a 64×64 saturation/value gradient into an
// OffscreenCanvas + GPU texture once per hue change, then renders it
// stretched to the control's bounds — LINEAR sampling smooths the
// 64-step gradient into a continuous Photoshop-style picker. Earlier
// versions painted a single flat fill (the MVP placeholder) while
// the cursor and selected-color math used the right per-pixel HSV
// values, so clicks landed on the correct colour despite the box
// looking solid.

import { Base } from './Base';
import { Signal, eventInfo, type EventInfo } from '../core/Events';
import { color, point, rect, type Color, type Point } from '../core/Structures';
import { hsvToColor, rgbToHsv } from '../core/ColorUtil';
import { texture as makeTexture, type Texture } from '../renderer/Texture';
import type { Skin } from '../skin/Skin';
import type { WebGL2Renderer } from '../renderer/WebGL2Renderer';

// Resolution of the baked gradient. 64×64 is enough — LINEAR sampling
// blurs the steps into a continuous gradient even when the box is
// rendered ~3× larger (200ish pixels). Bumping higher buys nothing
// visible and just costs more bake time on each hue change.
const LERP_BAKE_SIZE = 64;

// Make the right kind of canvas for the bake. Prefer OffscreenCanvas
// (worker-friendly + no DOM cost); fall back to a detached <canvas>
// for environments without it.
function makeLerpCanvas(): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(LERP_BAKE_SIZE, LERP_BAKE_SIZE);
  }
  const c = document.createElement('canvas');
  c.width = LERP_BAKE_SIZE;
  c.height = LERP_BAKE_SIZE;
  return c;
}

// ---------------------------------------------------------------------------
// ColorLerpBox — 2D saturation/value surface at a fixed hue. The cursor
// position encodes (s, v); the selected color is hue+s+v.
// ---------------------------------------------------------------------------

export class ColorLerpBox extends Base {
  readonly onSelectionChanged = new Signal<EventInfo>();

  protected _cursorPos: Point = point(0, 0);
  protected _hue = 0;
  protected _depressed = false;

  // Baked saturation/value gradient texture for the current hue.
  // `_textureDirty` is flagged whenever the hue changes; the next
  // render() re-bakes and re-uploads. The texture handle itself is
  // reused across hue changes — only the source pixels swap.
  private _texture: Texture = makeTexture('ColorLerpBox');
  private _textureDirty = true;

  constructor(parent: Base | null) {
    super(parent);
    this.setSize(128, 128);
    this.setMouseInputEnabled(true);
  }

  // =======================================================================
  // Color
  // =======================================================================

  // `onlyHue=true` matches GWEN's default: SetColor from a hue slider
  // only updates the hue channel, leaving the cursor (s, v) untouched.
  // Callers restoring a saved state pass `false` so the cursor also
  // snaps to the new saturation/value.
  setColor(c: Color, onlyHue = true): void {
    const hsv = rgbToHsv(c);
    if (this._hue !== hsv.h) {
      this._hue = hsv.h;
      this._textureDirty = true;
    }
    if (!onlyHue) {
      this._cursorPos = point(
        Math.round(hsv.s * this.width()),
        Math.round((1 - hsv.v) * this.height()),
      );
    }
    this.emitSelectionChanged();
    this.redraw();
  }

  setHue(h: number): void {
    if (this._hue === h) return;
    this._hue = h;
    this._textureDirty = true;
    this.emitSelectionChanged();
    this.redraw();
  }

  getHue(): number {
    return this._hue;
  }

  getSelectedColor(): Color {
    return this.getColorAtPos(this._cursorPos.x, this._cursorPos.y);
  }

  getColorAtPos(x: number, y: number): Color {
    // Use (w-1)/(h-1) as the denominator so the cursor at (w-1, h-1)
    // — the bottom-right pixel — maps to s=1, v=0 (pure black).
    // Earlier division by `width()` capped the bottom-right at
    // s=(w-1)/w ≈ 0.992 and v=1/h ≈ 0.008, producing colours like
    // (2, 0, 0) where the user expected (0, 0, 0).
    const w = this.width();
    const h = this.height();
    const s = w > 1 ? x / (w - 1) : 0;
    const v = h > 1 ? 1 - y / (h - 1) : 0;
    return hsvToColor(this._hue, s, v, 255);
  }

  getCursorPos(): Point {
    return { x: this._cursorPos.x, y: this._cursorPos.y };
  }

  // =======================================================================
  // Mouse
  // =======================================================================

  override onMouseClickLeft(x: number, y: number, pressed: boolean): void {
    this._depressed = pressed;
    const canvas = this.getCanvas();
    if (canvas) canvas.mouseFocus = pressed ? this : null;
    if (pressed) this.updateCursorFromCanvasPos(x, y);
  }

  override onMouseMoved(x: number, y: number, _dx: number, _dy: number): void {
    if (this._depressed) this.updateCursorFromCanvasPos(x, y);
  }

  // =======================================================================
  // Render
  // =======================================================================

  override render(skin: Skin): void {
    if (this._textureDirty) {
      this.bakeTexture(skin.renderer);
      this._textureDirty = false;
    }
    skin.renderer.setDrawColor(color(255, 255, 255, 255));
    skin.renderer.drawTexturedRect(this._texture, this.getRenderBounds());
    skin.renderer.setDrawColor(color(0, 0, 0, 255));
    skin.renderer.drawLinedRect(this.getRenderBounds());
    // Cursor marker — drawn at the actual cursor position. shouldClip
    // returns false (see below) so the 6×6 marker stays visible even
    // when the cursor sits on the box's edge: the rect extends past
    // the box's bounds and renders against the parent picker's clip.
    // The HSVColorPicker insets this control by 3px so the marker
    // never bumps into the picker's outer clip either.
    const cur = this.getSelectedColor();
    const avg = (cur.r + cur.g + cur.b) / 3;
    skin.renderer.setDrawColor(avg < 170 ? color(255, 255, 255, 255) : color(0, 0, 0, 255));
    skin.renderer.drawLinedRect(rect(this._cursorPos.x - 3, this._cursorPos.y - 3, 6, 6));
  }

  // The cursor marker can extend up to 3px past every edge — let it
  // render against the parent's clip rather than the box's own,
  // so the indicator stays fully visible at any cursor position.
  override shouldClip(): boolean {
    return false;
  }

  override dispose(): void {
    // Free the GL texture if we still have a reference to a renderer
    // — getCanvas() returns the structural CanvasLike (no `renderer`
    // surface), so duck-type the field. If the canvas is gone or the
    // GL context torn down already, the texture will be cleaned up
    // alongside it.
    const canvas = this.getCanvas() as unknown as { renderer?: WebGL2Renderer } | null;
    const renderer = canvas?.renderer;
    if (renderer && this._texture.data) renderer.freeTexture(this._texture);
    super.dispose();
  }

  // Re-rasterize the saturation/value gradient at the current hue and
  // re-upload it as a GPU texture. Called on first render and whenever
  // the hue changes. Saturation runs across X (0 left → 1 right);
  // value runs across Y (1 top → 0 bottom). We compute hsvToColor for
  // every pixel — at LERP_BAKE_SIZE = 64 that's only 4096 pixels, so
  // the work is negligible even on hue-slider drag.
  private bakeTexture(renderer: WebGL2Renderer): void {
    const off = makeLerpCanvas();
    const ctx = off.getContext('2d') as
      | OffscreenCanvasRenderingContext2D
      | CanvasRenderingContext2D
      | null;
    if (!ctx) return;
    const img = ctx.createImageData(LERP_BAKE_SIZE, LERP_BAKE_SIZE);
    const data = img.data;
    const N = LERP_BAKE_SIZE - 1;
    let i = 0;
    for (let y = 0; y < LERP_BAKE_SIZE; y++) {
      const v = 1 - y / N;
      for (let x = 0; x < LERP_BAKE_SIZE; x++) {
        const s = x / N;
        const c = hsvToColor(this._hue, s, v, 255);
        data[i++] = c.r;
        data[i++] = c.g;
        data[i++] = c.b;
        data[i++] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // loadTextureFromSource reuses the existing GL handle when one
    // is already attached to the Texture, so re-baking on hue change
    // costs only the texImage2D upload — no GL allocation churn.
    renderer.loadTextureFromSource(this._texture, off as TexImageSource);
  }

  // =======================================================================
  // Internals
  // =======================================================================

  protected updateCursorFromCanvasPos(canvasX: number, canvasY: number): void {
    const local = this.canvasPosToLocal(point(canvasX, canvasY));
    this._cursorPos = point(
      Math.max(0, Math.min(this.width() - 1, local.x)),
      Math.max(0, Math.min(this.height() - 1, local.y)),
    );
    this.emitSelectionChanged();
    this.redraw();
  }

  private emitSelectionChanged(): void {
    const info = eventInfo();
    info.controlCaller = this;
    this.onSelectionChanged.emit(info);
  }
}

// ---------------------------------------------------------------------------
// ColorSlider — vertical hue ribbon. The selected y-offset picks a pure
// hue at s=1, v=1. The caller (typically ColorPicker) reads the hue
// back and feeds it into a ColorLerpBox.
// ---------------------------------------------------------------------------

export class ColorSlider extends Base {
  readonly onSelectionChanged = new Signal<EventInfo>();

  protected _selectedDist = 0;
  protected _depressed = false;

  constructor(parent: Base | null) {
    super(parent);
    this.setSize(32, 128);
    this.setMouseInputEnabled(true);
  }

  // =======================================================================
  // Color
  // =======================================================================

  setColor(c: Color): void {
    const hsv = rgbToHsv(c);
    this._selectedDist = Math.round((hsv.h / 360) * this.height());
    this.emitSelectionChanged();
    this.redraw();
  }

  getSelectedColor(): Color {
    return this.getColorAtHeight(this._selectedDist);
  }

  getColorAtHeight(y: number): Color {
    // Use (h-1) as the denominator so the bottom pixel maps cleanly
    // to hue=360° (which wraps to red, matching the top). Dividing
    // by `height()` capped the bottom at hue ≈ 357° instead.
    const H = this.height();
    const hue = H > 1 ? (y / (H - 1)) * 360 : 0;
    return hsvToColor(hue, 1, 1, 255);
  }

  getSelectedDist(): number {
    return this._selectedDist;
  }

  // =======================================================================
  // Mouse
  // =======================================================================

  override onMouseClickLeft(x: number, y: number, pressed: boolean): void {
    void x;
    this._depressed = pressed;
    const canvas = this.getCanvas();
    if (canvas) canvas.mouseFocus = pressed ? this : null;
    if (pressed) this.updateSliderFromCanvasY(y);
  }

  override onMouseMoved(_x: number, y: number, _dx: number, _dy: number): void {
    if (this._depressed) this.updateSliderFromCanvasY(y);
  }

  // =======================================================================
  // Render
  // =======================================================================

  override render(skin: Skin): void {
    // MVP — draw a 1px row per pixel of height at the pure hue for that
    // row. O(height) fills per frame; acceptable for the small sizes
    // (typical 128px) we expect, but T603 will replace with a single
    // textured quad once the offscreen gradient pipeline lands.
    const renderer = skin.renderer;
    const w = this.width();
    const h = this.height();
    for (let y = 0; y < h; y += 1) {
      renderer.setDrawColor(this.getColorAtHeight(y));
      renderer.drawFilledRect(rect(5, y, w - 10, 1));
    }
    // Position indicator — a horizontal bar spanning the full slider
    // with a small black tab on each side. Drawn at the actual
    // selected position so the tab tracks the cursor 1:1; shouldClip
    // returns false (see below) so the indicator at the top or
    // bottom edge can extend past the slider's bounds and render
    // against the parent picker's clip. The HSVColorPicker insets
    // this control by 3px from the picker top to give the tab room.
    const drawY = this._selectedDist - 3;
    renderer.setDrawColor(color(0, 0, 0, 255));
    renderer.drawFilledRect(rect(0, drawY, 5, 5));
    renderer.drawFilledRect(rect(w - 5, drawY, 5, 5));
    renderer.drawFilledRect(rect(0, drawY + 2, w, 1));
  }

  // Same shouldClip override as ColorLerpBox — the position-indicator
  // tab extends 3px past the slider's top and bottom at the
  // extremes, so render it against the parent's clip.
  override shouldClip(): boolean {
    return false;
  }

  // =======================================================================
  // Internals
  // =======================================================================

  protected updateSliderFromCanvasY(canvasY: number): void {
    const local = this.canvasPosToLocal(point(0, canvasY));
    this._selectedDist = Math.max(0, Math.min(this.height() - 1, local.y));
    this.emitSelectionChanged();
    this.redraw();
  }

  private emitSelectionChanged(): void {
    const info = eventInfo();
    info.controlCaller = this;
    this.onSelectionChanged.emit(info);
  }
}
