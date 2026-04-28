// Renderer — abstract base matching `Gwen::Renderer::Base`. Concrete
// backends (e.g. `WebGL2Renderer`) implement the handful of `abstract`
// methods below; everything else (clip math, render-offset translation,
// DrawLinedRect / DrawShavedCornerRect) is shared.
//
// Design note: GWEN returns `const Rect&` for clip getters; TS doesn't
// have const refs, so `clipRegion()` returns the live Rect and callers
// are trusted not to mutate it. `translateRect` — which *does* produce
// a new value every frame in the draw path — returns a fresh object.

import {
  cloneRect,
  color,
  point,
  rect,
  type Color,
  type Point,
  type Rect,
} from '../core/Structures';
import type { Font } from '../skin/FontAtlas';
import type { Texture } from './Texture';

export abstract class Renderer {
  protected m_drawColor: Color = color(255, 255, 255, 255);
  protected m_renderOffset: Point = point(0, 0);
  protected m_rectClipRegion: Rect = rect(0, 0, 0, 0);
  protected m_scale = 1.0;

  // ---- Abstract surface (concrete backends must implement) ----

  abstract init(): void;
  abstract begin(): void;
  abstract end(): void;
  abstract setDrawColor(c: Color): void;
  abstract drawFilledRect(r: Rect): void;
  abstract drawTexturedRect(
    texture: Texture,
    r: Rect,
    u1?: number,
    v1?: number,
    u2?: number,
    v2?: number,
  ): void;
  abstract startClip(): void;
  abstract endClip(): void;
  abstract loadTexture(texture: Texture): void;
  /**
   * Upload a texture from a browser TexImageSource (HTMLImageElement,
   * ImageBitmap, OffscreenCanvas, etc.). The `source` parameter is typed
   * as `unknown` here so the abstract surface doesn't force every backend
   * to depend on DOM types; `WebGL2Renderer` narrows it internally.
   */
  abstract loadTextureFromSource(texture: Texture, source: unknown): void;
  abstract freeTexture(texture: Texture): void;

  // ---- Default primitive fallbacks (ported from BaseRender.cpp) ----

  drawLinedRect(r: Rect): void {
    this.drawFilledRect(rect(r.x, r.y, r.w, 1));
    this.drawFilledRect(rect(r.x, r.y + r.h - 1, r.w, 1));
    this.drawFilledRect(rect(r.x, r.y, 1, r.h));
    this.drawFilledRect(rect(r.x + r.w - 1, r.y, 1, r.h));
  }

  drawPixel(x: number, y: number): void {
    this.drawFilledRect(rect(x, y, 1, 1));
  }

  // Matches BaseRender.cpp:57-80. We mutate a local copy of `r` — the
  // caller's Rect is untouched even though GWEN takes the parameter by
  // value and mutates it in place.
  drawShavedCornerRect(r: Rect, bSlight = false): void {
    const x = r.x;
    const y = r.y;
    const w = r.w - 1;
    const h = r.h - 1;

    if (bSlight) {
      this.drawFilledRect(rect(x + 1, y, w - 1, 1));
      this.drawFilledRect(rect(x + 1, y + h, w - 1, 1));
      this.drawFilledRect(rect(x, y + 1, 1, h - 1));
      this.drawFilledRect(rect(x + w, y + 1, 1, h - 1));
      return;
    }

    this.drawPixel(x + 1, y + 1);
    this.drawPixel(x + w - 1, y + 1);
    this.drawPixel(x + 1, y + h - 1);
    this.drawPixel(x + w - 1, y + h - 1);
    this.drawFilledRect(rect(x + 2, y, w - 3, 1));
    this.drawFilledRect(rect(x + 2, y + h, w - 3, 1));
    this.drawFilledRect(rect(x, y + 2, 1, h - 3));
    this.drawFilledRect(rect(x + w, y + 2, 1, h - 3));
  }

  drawMissingImage(r: Rect): void {
    // `Colors::Red` in GWEN is (255, 38, 0, 255).
    this.setDrawColor(color(255, 38, 0, 255));
    this.drawFilledRect(r);
  }

  // ---- Render-offset accessors ----

  setRenderOffset(p: Point): void {
    // Clone so external mutations to the caller's Point don't affect us,
    // and symmetrically so getRenderOffset() returns a snapshot callers
    // can safely retain across addRenderOffset calls (used by
    // Base.renderRecursive's save/restore of the offset around children).
    this.m_renderOffset = { x: p.x, y: p.y };
  }

  // Faithful to GWEN: the parameter is a Rect, and only (x, y) are used.
  addRenderOffset(r: Rect): void {
    this.m_renderOffset.x += r.x;
    this.m_renderOffset.y += r.y;
  }

  getRenderOffset(): Point {
    // Return a snapshot. Base.renderRecursive stores the result and later
    // calls setRenderOffset(oldOffset) to restore; returning the live
    // reference breaks that save/restore because addRenderOffset mutates
    // the same Point in place.
    return { x: this.m_renderOffset.x, y: this.m_renderOffset.y };
  }

  // ---- Coordinate translation ----

  // Returns a [x, y] tuple rather than taking int& out-params as in C++.
  // Callers destructure the result.
  translate(x: number, y: number): [number, number] {
    x += this.m_renderOffset.x;
    y += this.m_renderOffset.y;
    return [Math.ceil(x * this.m_scale), Math.ceil(y * this.m_scale)];
  }

  // Produces a new Rect — does not mutate `r`.
  translateRect(r: Rect): Rect {
    const [x, y] = this.translate(r.x, r.y);
    return {
      x,
      y,
      w: Math.ceil(r.w * this.m_scale),
      h: Math.ceil(r.h * this.m_scale),
    };
  }

  // ---- Clipping ----

  setClipRegion(r: Rect): void {
    this.m_rectClipRegion = cloneRect(r);
  }

  // Port of `Base::AddClipRegion` with its peculiar behaviour: the
  // incoming rect's (x, y) are *replaced* by the current render offset
  // before the intersection math runs. Work on a local copy so the
  // caller's Rect stays untouched.
  addClipRegion(r: Rect): void {
    const out: Rect = {
      x: this.m_renderOffset.x,
      y: this.m_renderOffset.y,
      w: r.w,
      h: r.h,
    };
    const clip = this.m_rectClipRegion;

    if (out.x < clip.x) {
      out.w -= clip.x - out.x;
      out.x = clip.x;
    }
    if (out.y < clip.y) {
      out.h -= clip.y - out.y;
      out.y = clip.y;
    }
    if (out.x + out.w > clip.x + clip.w) {
      out.w = clip.x + clip.w - out.x;
    }
    if (out.y + out.h > clip.y + clip.h) {
      out.h = clip.y + clip.h - out.y;
    }

    this.m_rectClipRegion = out;
  }

  clipRegionVisible(): boolean {
    return this.m_rectClipRegion.w > 0 && this.m_rectClipRegion.h > 0;
  }

  clipRegion(): Rect {
    return this.m_rectClipRegion;
  }

  // ---- Scale ----

  setScale(s: number): void {
    this.m_scale = s;
  }

  getScale(): number {
    return this.m_scale;
  }

  // ---- Font surface ----
  //
  // The GWEN base class has fallback `RenderText` / `MeasureText` that
  // draw placeholder rectangles so a renderer missing font support still
  // produces *something* on screen. We throw instead: backends that mean
  // to render text must wire a real implementation (e.g. `FontAtlas`),
  // and a silent fallback would mask bugs.

  loadFont(_font: Font): void {
    throw new Error('Font renderer not initialized');
  }

  freeFont(_font: Font): void {
    throw new Error('Font renderer not initialized');
  }

  renderText(_font: Font, _pos: Point, _text: string): void {
    throw new Error('Font renderer not initialized');
  }

  measureText(_font: Font, _text: string): Point {
    throw new Error('Font renderer not initialized');
  }

  // ---- Color picking ----
  //
  // GWEN's base implementation returns the supplied default. Backends
  // with a CPU-side texture copy may override this to sample `t`.
  pixelColour(_t: Texture, _x: number, _y: number, def: Color): Color {
    return def;
  }
}
