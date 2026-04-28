// FontAtlas — glyph rasterizer + GPU atlas. Glyphs are drawn into an
// offscreen Canvas 2D context with `fillText`, the alpha channel is
// extracted into an R8 texture region, and a `Map` keyed by
// `face|size|bold|codepoint` maps each glyph to its UV rect + advance.
//
// One atlas page (512×512 R8) holds enough glyphs for the ASCII printable
// range across several font sizes. When the atlas runs out of room a
// single warning is logged and overflow glyphs are dropped (rendered as
// blank advances). Multi-page support is intentionally deferred — the
// production skin only ever needs one or two font sizes.
//
// Rasterization uses a single Canvas 2D context whose `font` property is
// switched per-glyph; the context is wider than tall (full atlas
// dimensions) so we can reuse it as a scratchpad without per-glyph
// allocation. Anti-aliasing writes to alpha (we draw white onto a
// transparent canvas), so we copy `imageData.data[i*4 + 3]` rather than
// the red channel.
//
// `Font.data` holds a `GlyphAtlasHandle` — an opaque cache index that
// avoids per-`renderText` map lookups for the common case of repeated
// renders with the same Font.

import type { Point } from '../core/Structures';
import { point } from '../core/Structures';
import type { WebGL2Renderer } from '../renderer/WebGL2Renderer';

// ---------- Public surface ----------

export interface Font {
  facename: string;
  size: number;
  bold: boolean;
  // Backend-private cache handle (a `GlyphAtlasHandle`) or null when not
  // yet loaded. Typed as `unknown` so the public Font interface stays
  // free of FontAtlas internals.
  data: unknown;
  realsize: number;
}

export function font(facename = 'Arial', size = 14, bold = false): Font {
  return { facename, size, bold, data: null, realsize: 0 };
}

// ---------- Internals ----------

interface GlyphEntry {
  advance: number;
  offsetY: number;
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  cellW: number;
  cellH: number;
}

// Per-Font handle stashed in `Font.data`. `lastScale` lets `measureText`
// (which has no renderer arg) return a sensible width without re-running
// `ensureFont` on every measurement. `lineHeight` is the rasterized cell
// height (fontAscent + fontDescent at the current realsize) used by
// `measureText` so that descenders ('g', 'y', 'q', 'p') aren't clipped
// when a control sizes itself to the text's reported height.
interface GlyphAtlasHandle {
  facename: string;
  size: number;
  bold: boolean;
  realsize: number;
  lastScale: number;
  lineHeight: number;
}

// 2048×2048 R8 = 4 MB on the GPU, comfortably within every WebGL2
// device's MAX_TEXTURE_SIZE (the spec guarantees ≥ 2048; modern GPUs
// support 8192+). The previous 512×512 (256 KB) inherited GWEN's
// 2010-era budget and started overflowing once we wanted to mix the
// default 14pt face with bold + larger sizes for headings; the 16×
// area bump means thousands of glyph cells per page so the cache
// never trips the "FontAtlas full" guard for typical UI text.
const ATLAS_SIZE = 2048;
const GLYPH_PADDING = 2; // 1px on each side; gutter is implicit.
const ASCII_PRINTABLE_START = 0x20;
const ASCII_PRINTABLE_END = 0x7e;

// ScreenCanvas is created lazily in case the host environment delays
// canvas availability (e.g. headless test bootstrap). The fallback to
// `document.createElement('canvas')` covers Safari < 16.4.
type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;
type AnyCtx = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

function makeScratchCanvas(w: number, h: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(w, h);
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Wrap face names containing whitespace or anything outside [A-Za-z0-9-]
// in double quotes — required by the CSS font shorthand syntax.
function quoteFacename(name: string): string {
  if (/^[A-Za-z0-9-]+$/.test(name)) return name;
  return `"${name.replace(/"/g, '\\"')}"`;
}

function buildFontString(facename: string, realsize: number, bold: boolean): string {
  const px = Math.round(realsize);
  return `${bold ? 'bold ' : ''}${px}px ${quoteFacename(facename)}, sans-serif`;
}

function glyphKey(
  facename: string,
  realsize: number,
  bold: boolean,
  codepoint: number,
): string {
  return `${facename}|${realsize}|${bold ? 1 : 0}|${codepoint}`;
}

// Extract the alpha channel from a RGBA Uint8ClampedArray into a fresh
// Uint8Array. Canvas anti-aliases white text into the alpha channel when
// the surface starts transparent, so alpha == coverage.
function rgbaAlphaToR8(rgba: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let i = 0, j = 3; i < out.length; i++, j += 4) {
    out[i] = rgba[j];
  }
  return out;
}

// Callback the atlas invokes after touching GL texture state (texSubImage2D).
// The renderer uses it to restore whatever it believed was bound before the
// atlas stomped TEXTURE0 — without this, draws queued before renderText
// would flush with the atlas still bound and sample coverage bytes through
// MODE_FILL, producing garbage colors. Type `unknown` keeps the callback
// optional; FontAtlas never reads it, only calls it.
export type TextureRestoreFn = () => void;

export class FontAtlas {
  readonly atlasSize = ATLAS_SIZE;
  readonly texture: WebGLTexture;

  private readonly gl: WebGL2RenderingContext;
  private readonly scratch: AnyCanvas;
  private readonly ctx: AnyCtx;
  private restoreBinding: TextureRestoreFn | null = null;

  private readonly cache = new Map<string, GlyphEntry | null>();

  // Row-packer state.
  private cursorX = 0;
  private cursorY = 0;
  private rowHeight = 0;

  private warnedFull = false;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.scratch = makeScratchCanvas(ATLAS_SIZE, ATLAS_SIZE);
    const ctx = this.scratch.getContext('2d', {
      willReadFrequently: true,
    }) as AnyCtx | null;
    if (!ctx) {
      throw new Error('FontAtlas: 2D context unavailable');
    }
    this.ctx = ctx;

    // Allocate the GPU atlas. Empty (zero-filled) — texSubImage2D fills
    // each cell as glyphs are rasterized.
    const tex = gl.createTexture();
    if (!tex) throw new Error('FontAtlas: createTexture failed');
    this.texture = tex;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      ATLAS_SIZE,
      ATLAS_SIZE,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      null,
    );
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  /**
   * Set the callback invoked after the atlas performs any internal
   * `gl.bindTexture` / `texSubImage2D`. The renderer registers a function
   * that re-binds whatever it last tracked, so the atlas never leaves GL
   * state in a form the renderer doesn't expect.
   */
  setTextureRestoreFn(fn: TextureRestoreFn | null): void {
    this.restoreBinding = fn;
  }

  // ---- Lifecycle ----

  ensureFont(f: Font, scale: number): void {
    const realsize = Math.max(1, f.size * scale);
    let handle = f.data as GlyphAtlasHandle | null;
    let needLineHeight = false;
    if (!handle) {
      handle = {
        facename: f.facename,
        size: f.size,
        bold: f.bold,
        realsize,
        lastScale: scale,
        lineHeight: 0,
      };
      f.data = handle;
      needLineHeight = true;
    } else {
      if (handle.realsize !== realsize) needLineHeight = true;
      handle.lastScale = scale;
      handle.realsize = realsize;
    }
    if (needLineHeight) {
      // Query the 2D context for ascent + descent at this realsize. We
      // include both 'A' and 'g' so the call exercises the alphabetic
      // baseline against a glyph with descenders, then take the per-font
      // metrics (which canvas2d returns regardless of the input string).
      this.ctx.font = buildFontString(handle.facename, realsize, handle.bold);
      this.ctx.textBaseline = 'alphabetic';
      const m = this.ctx.measureText('Ag');
      const ascent = Math.max(0, Math.ceil(m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent));
      const descent = Math.max(0, Math.ceil(m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent));
      handle.lineHeight = ascent + descent;
    }
    f.realsize = realsize;
  }

  loadFont(f: Font): void {
    // Default to scale 1 when the renderer hasn't called ensureFont yet.
    if (!f.data) this.ensureFont(f, 1);
    for (let cp = ASCII_PRINTABLE_START; cp <= ASCII_PRINTABLE_END; cp++) {
      this.getOrRasterize(f, cp);
    }
  }

  freeFont(f: Font): void {
    // Atlas glyphs survive — they're keyed by realsize and may be shared
    // with other Font instances at the same size. Only the per-Font cache
    // handle is dropped.
    f.data = null;
  }

  // ---- Drawing ----

  // Cursor accumulates in BACKING-pixel space (CSS px × DPR) and is rounded
  // once per glyph. Per-glyph rounding in CSS space (the previous approach)
  // dropped sub-pixel advances and drifted up to 1 backing pixel per
  // character — visible as uneven kerning at small sizes. Snapping every
  // glyph to integer backing pixels also keeps the LINEAR-filtered atlas
  // sampling exactly one texel per destination pixel.
  renderText(f: Font, pos: Point, text: string, renderer: WebGL2Renderer): void {
    this.ensureFont(f, renderer.getFontScale());
    const handle = f.data as GlyphAtlasHandle;
    const scale = handle.lastScale;
    let cursorBacking = pos.x * scale;
    const yBacking = pos.y * scale;
    for (let i = 0; i < text.length; i++) {
      const cp = text.charCodeAt(i);
      const entry = this.getOrRasterize(f, cp);
      if (!entry) {
        continue;
      }
      const drawW = entry.cellW - GLYPH_PADDING;
      const drawH = entry.cellH - GLYPH_PADDING;
      renderer.drawFontGlyphBacking(
        this.texture,
        Math.round(cursorBacking),
        Math.round(yBacking + entry.offsetY),
        drawW,
        drawH,
        entry.u0,
        entry.v0,
        entry.u1,
        entry.v1,
      );
      cursorBacking += entry.advance;
    }
  }

  measureText(f: Font, text: string): Point {
    if (!f.data) this.ensureFont(f, 1);
    const handle = f.data as GlyphAtlasHandle;
    const scale = handle.lastScale;
    let total = 0;
    for (let i = 0; i < text.length; i++) {
      const cp = text.charCodeAt(i);
      const entry = this.getOrRasterize(f, cp);
      if (entry) total += entry.advance;
    }
    // Use the rasterized line height (ascent + descent) rather than the
    // nominal font size — the latter tracks the em square and stops at
    // the baseline, so labels that size to it clip the bottom of glyphs
    // with descenders ('g', 'y', 'q', 'p').
    const h = handle.lineHeight > 0 ? handle.lineHeight : f.realsize;
    return point(total / scale, h / scale);
  }

  // ---- Rasterization ----

  private getOrRasterize(f: Font, codepoint: number): GlyphEntry | null {
    const handle = f.data as GlyphAtlasHandle;
    const realsize = handle.realsize;
    const key = glyphKey(handle.facename, realsize, handle.bold, codepoint);
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;
    const entry = this.rasterize(handle, codepoint);
    this.cache.set(key, entry);
    return entry;
  }

  private rasterize(handle: GlyphAtlasHandle, codepoint: number): GlyphEntry | null {
    const ctx = this.ctx;
    const ch = String.fromCharCode(codepoint);
    ctx.font = buildFontString(handle.facename, handle.realsize, handle.bold);
    // `alphabetic` baseline is the most portable: actualBoundingBox*Ascent
    // is the ink distance above the baseline, *Descent below. We draw every
    // glyph into a cell with the SAME height (the font's max ascent +
    // descent) and the SAME baseline y within the cell. That way the quad
    // uv span maps to consistent baselines across every character, and the
    // caller doesn't need per-glyph y-offsets to avoid jitter.
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'white';

    const m = ctx.measureText(ch);
    const advance = m.width;
    // Font-wide metrics are constant across glyphs at a given size — safe
    // to query per-glyph but ideal would be to cache per-font. Rounding up
    // is fine; we want the cell large enough for any glyph in this font.
    const fontAscent = Math.max(0, Math.ceil(m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent));
    const fontDescent = Math.max(0, Math.ceil(m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent));

    const cellW = Math.max(1, Math.ceil(advance) + GLYPH_PADDING);
    const cellH = Math.max(1, fontAscent + fontDescent + GLYPH_PADDING);

    if (cellW > ATLAS_SIZE) {
      return null;
    }

    // Row-pack: wrap to a new row if there's no horizontal room.
    if (this.cursorX + cellW > ATLAS_SIZE) {
      this.cursorX = 0;
      this.cursorY += this.rowHeight;
      this.rowHeight = 0;
    }
    if (this.cursorY + cellH > ATLAS_SIZE) {
      if (!this.warnedFull) {
        console.warn('FontAtlas full');
        this.warnedFull = true;
      }
      return null;
    }

    const cellX = this.cursorX;
    const cellY = this.cursorY;
    if (cellH > this.rowHeight) this.rowHeight = cellH;
    this.cursorX += cellW;

    // Render into a region of the scratch canvas the size of the cell.
    // Clear first so previous glyph residue doesn't bleed in.
    ctx.clearRect(0, 0, cellW, cellH);
    // Baseline sits at y = 1 + fontAscent for every glyph. Ascenders
    // overshoot into the top gutter only if they exceed fontAscent (rare);
    // descenders sit between baseline and y=1+fontAscent+fontDescent.
    ctx.fillText(ch, 1, 1 + fontAscent);

    let imageData: ImageData;
    try {
      imageData = ctx.getImageData(0, 0, cellW, cellH);
    } catch {
      return null;
    }
    const r8 = rgbaAlphaToR8(imageData.data, cellW, cellH);

    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      cellX,
      cellY,
      cellW,
      cellH,
      gl.RED,
      gl.UNSIGNED_BYTE,
      r8,
    );
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    // Hand GL state back to whatever the renderer expected. Without this,
    // a subsequent flushBatch would sample this atlas through MODE_FILL
    // and produce garbage colors for plain filled rects.
    if (this.restoreBinding) this.restoreBinding();

    // UVs exclude the 1px gutter on each side so neighbouring glyphs
    // don't bleed when sampled with LINEAR filtering.
    const u0 = (cellX + 1) / ATLAS_SIZE;
    const v0 = (cellY + 1) / ATLAS_SIZE;
    const u1 = (cellX + cellW - 1) / ATLAS_SIZE;
    const v1 = (cellY + cellH - 1) / ATLAS_SIZE;

    return {
      advance,
      offsetY: 0,
      u0,
      v0,
      u1,
      v1,
      cellW,
      cellH,
    };
  }
}
