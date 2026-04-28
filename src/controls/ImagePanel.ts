// ImagePanel — draws a texture (full or sub-rect) inside its bounds.
// Ports `Gwen::Controls::ImagePanel` from include/Gwen/Controls/ImagePanel.h.
//
// GWEN's version wraps `LoadTexture(name)` which goes through the
// renderer's filename resolver — that path is off-limits here (zero
// runtime deps, no external assets), so we add an explicit
// `loadFromURL` static for HTTP-loaded images and `setTextureFromSource`
// for callers that already hold an `HTMLImageElement` / `ImageBitmap` /
// `OffscreenCanvas`. Callers that have an already-uploaded Texture
// (e.g. a slice of the skin atlas) can use `setTexture` directly.

import { Base } from './Base';
import type { Skin } from '../skin/Skin';
import type { WebGL2Renderer } from '../renderer/WebGL2Renderer';
import { color, rect, type Color } from '../core/Structures';
import { texture as makeTexture, type Texture } from '../renderer/Texture';

export class ImagePanel extends Base {
  private _texture: Texture = makeTexture();
  private _uv: [number, number, number, number] = [0, 0, 1, 1];
  private _drawColor: Color = color(255, 255, 255, 255);
  private _stretch = true;

  constructor(parent: Base | null) {
    super(parent);
    this.setMouseInputEnabled(false);
  }

  // =====================================================================
  // Texture assignment
  // =====================================================================

  /**
   * Assign an already-uploaded Texture directly. The caller retains
   * ownership — ImagePanel does not `freeTexture` on dispose.
   */
  setTexture(t: Texture): void {
    this._texture = t;
    this.redraw();
  }

  /**
   * Upload `source` into a freshly allocated Texture and assign it.
   * Intended for callers that hold an already-decoded image (e.g.
   * from `createImageBitmap` or an in-memory `OffscreenCanvas`).
   */
  setTextureFromSource(source: TexImageSource, renderer: WebGL2Renderer): void {
    const t = makeTexture();
    renderer.loadTextureFromSource(t, source);
    this._texture = t;
    this.redraw();
  }

  getTexture(): Texture {
    return this._texture;
  }

  /**
   * Async helper: fetch + decode + upload an image from a URL. Resolves
   * with the uploaded Texture on success. On failure the returned
   * Texture has `failed = true` and the promise rejects so callers can
   * either bubble the error or fall back to a placeholder.
   *
   * We use `Image` (not `fetch` + `createImageBitmap`) so CORS and
   * SVG handling match what a browser does for `<img>`.
   */
  static loadFromURL(url: string, renderer: WebGL2Renderer): Promise<Texture> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = (): void => {
        const t = makeTexture(url);
        renderer.loadTextureFromSource(t, img);
        resolve(t);
      };
      img.onerror = (): void => {
        const t = makeTexture(url);
        t.failed = true;
        reject(new Error(`Failed to load image: ${url}`));
      };
      img.src = url;
    });
  }

  // =====================================================================
  // UV sub-rect
  // =====================================================================

  setUV(u1: number, v1: number, u2: number, v2: number): void {
    this._uv[0] = u1;
    this._uv[1] = v1;
    this._uv[2] = u2;
    this._uv[3] = v2;
    this.redraw();
  }

  // =====================================================================
  // Draw color + stretch
  // =====================================================================

  setDrawColor(c: Color): void {
    this._drawColor = { r: c.r, g: c.g, b: c.b, a: c.a };
    this.redraw();
  }

  getDrawColor(): Color {
    return this._drawColor;
  }

  setStretch(b: boolean): void {
    if (this._stretch === b) return;
    this._stretch = b;
    this.redraw();
  }

  getStretch(): boolean {
    return this._stretch;
  }

  // =====================================================================
  // Texture name (diagnostic / asset tracking)
  // =====================================================================

  setImageName(s: string): void {
    this._texture.name = s;
  }

  getImageName(): string {
    return this._texture.name;
  }

  // =====================================================================
  // Dimension accessors
  // =====================================================================

  textureWidth(): number {
    return this._texture.width;
  }

  textureHeight(): number {
    return this._texture.height;
  }

  failedToLoad(): boolean {
    return this._texture.failed;
  }

  /**
   * Shrink the control to match the texture's natural size. A no-op when
   * the texture is still 0×0 (e.g. pre-load).
   */
  sizeToContents(): void {
    if (this._texture.width === 0 || this._texture.height === 0) return;
    this.setSize(this._texture.width, this._texture.height);
  }

  // =====================================================================
  // Render
  // =====================================================================

  override render(skin: Skin): void {
    skin.renderer.setDrawColor(this._drawColor);
    const r = this._stretch
      ? this.getRenderBounds()
      : rect(0, 0, this._texture.width, this._texture.height);
    skin.renderer.drawTexturedRect(
      this._texture,
      r,
      this._uv[0],
      this._uv[1],
      this._uv[2],
      this._uv[3],
    );
  }
}
