// WebGL2Renderer — the project's only production backend. Draws every
// control through a single shader program; batches triangles in a
// reusable `VertexBatch` until a state change (texture, clip, end-of-
// frame) forces a flush.
//
// State-change flushes are the *only* reason we ever call `drawArrays`.
// Callers that respect the batch (e.g. many adjacent `drawFilledRect`s
// with the same color) pay one GL call per frame.

import type { Color, Point, Rect } from '../core/Structures';
import { FontAtlas, type Font } from '../skin/FontAtlas';
import { Renderer } from './Renderer';
import type { Texture } from './Texture';
import { VertexBatch } from './Batch';

const VERT_SRC = `#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;
layout(location=1) in vec2 aUv;
layout(location=2) in vec4 aColor;
uniform mat4 uProjection;
out vec2 vUv;
out vec4 vColor;
void main() {
  gl_Position = uProjection * vec4(aPos, 0.0, 1.0);
  vUv = aUv;
  vColor = aColor;
}`;

const FRAG_SRC = `#version 300 es
precision highp float;
in vec2 vUv;
in vec4 vColor;
uniform sampler2D uTex;
uniform int uMode;
out vec4 fragColor;
void main() {
  vec4 s = texture(uTex, vUv);
  if (uMode == 2) fragColor = vec4(vColor.rgb, s.r * vColor.a);
  else fragColor = s * vColor;
}`;

// Mode constants. Mode 0 (fill) and mode 1 (textured) are mathematically
// identical when the 1x1 white texture is bound — we keep the split so
// the font atlas (mode 2) can sample its R8 coverage texture in the
// same shader program.
const MODE_FILL = 0;
const MODE_TEXTURED = 1;
const MODE_FONT = 2;

// 8192 verts × 32 B = 256 KiB VBO, orphan-and-upload once per frame.
// Earlier 2048-vert cap forced multiple drawArrays flushes per frame
// for content-rich UIs; 8192 fits ~1366 quads in a single draw call,
// covering even a busy demo without any GL-call increase.
const VBO_CAPACITY_VERTS = 8192;

export interface WebGL2RendererOptions {
  alpha?: boolean;
  devicePixelRatio?: number;
}

export class WebGL2Renderer extends Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext;
  private readonly dpr: number;

  private program: WebGLProgram | null = null;
  private uProjectionLoc: WebGLUniformLocation | null = null;
  private uTexLoc: WebGLUniformLocation | null = null;
  private uModeLoc: WebGLUniformLocation | null = null;

  private vao: WebGLVertexArrayObject | null = null;
  private vbo: WebGLBuffer | null = null;

  private readonly batch = new VertexBatch(VBO_CAPACITY_VERTS);

  private nullTexture: WebGLTexture | null = null;
  private boundTex: WebGLTexture | null = null;
  private lastMode = MODE_FILL;

  private fontAtlas: FontAtlas | null = null;

  // Cached draw-color components in [0, 1] — avoid per-vertex division.
  private dr = 1;
  private dg = 1;
  private db = 1;
  private da = 1;

  constructor(canvas: HTMLCanvasElement, options?: WebGL2RendererOptions) {
    super();
    this.canvas = canvas;
    this.dpr = options?.devicePixelRatio ?? (globalThis.devicePixelRatio || 1);

    const gl = canvas.getContext('webgl2', {
      alpha: options?.alpha ?? true,
      premultipliedAlpha: false,
      antialias: false,
      depth: false,
      stencil: false,
    });
    if (!gl) {
      throw new Error('WebGL2 is not available in this browser/context');
    }
    this.gl = gl;
  }

  // -------- Lifecycle --------

  init(): void {
    const { gl } = this;

    const program = this.buildProgram(VERT_SRC, FRAG_SRC);
    this.program = program;
    gl.useProgram(program);

    this.uProjectionLoc = gl.getUniformLocation(program, 'uProjection');
    this.uTexLoc = gl.getUniformLocation(program, 'uTex');
    this.uModeLoc = gl.getUniformLocation(program, 'uMode');
    gl.uniform1i(this.uTexLoc, 0);
    gl.uniform1i(this.uModeLoc, MODE_FILL);

    const vao = gl.createVertexArray();
    if (!vao) throw new Error('createVertexArray failed');
    this.vao = vao;
    gl.bindVertexArray(vao);

    const vbo = gl.createBuffer();
    if (!vbo) throw new Error('createBuffer failed');
    this.vbo = vbo;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.batch.data.byteLength, gl.DYNAMIC_DRAW);

    // Stride = 32 B, offsets 0 / 8 / 16.
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 32, 8);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16);

    // 1x1 white null texture — bound whenever we draw a solid fill.
    const nt = gl.createTexture();
    if (!nt) throw new Error('createTexture failed');
    this.nullTexture = nt;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, nt);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([255, 255, 255, 255]),
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.boundTex = nt;

    this.updateProjection();

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);

    // Font atlas after the null texture is bound — its constructor binds
    // its own texture, then we restore the null texture below.
    this.fontAtlas = new FontAtlas(gl);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.nullTexture);
    this.boundTex = this.nullTexture;

    // Whenever the atlas uploads a new glyph it stomps TEXTURE0 with its
    // own texture. Register a restorer so it hands state back to us (and
    // any queued MODE_FILL batch flushes correctly).
    this.fontAtlas.setTextureRestoreFn(() => {
      const tex = this.boundTex;
      if (tex) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
      }
    });
  }

  begin(): void {
    const { gl, canvas } = this;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Orphan: hint the driver that any in-flight reads from the previous
    // frame can be discarded once they finish.
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.batch.data.byteLength, gl.DYNAMIC_DRAW);

    this.batch.reset();
    this.bindNullTexture();
    this.setMode(MODE_FILL);
  }

  end(): void {
    this.flushBatch();
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
    this.updateProjection();
  }

  // -------- State --------

  setDrawColor(c: Color): void {
    this.m_drawColor = c;
    this.dr = c.r / 255;
    this.dg = c.g / 255;
    this.db = c.b / 255;
    this.da = c.a / 255;
  }

  // -------- Primitives --------

  drawFilledRect(r: Rect): void {
    if (this.lastMode !== MODE_FILL || this.boundTex !== this.nullTexture) {
      this.flushBatch();
      this.bindNullTexture();
      this.setMode(MODE_FILL);
    }
    const t = this.translateRect(r);
    this.writeQuad(t.x, t.y, t.w, t.h, 0, 0, 1, 1);
  }

  drawTexturedRect(
    tex: Texture,
    r: Rect,
    u1 = 0,
    v1 = 0,
    u2 = 1,
    v2 = 1,
  ): void {
    const glTex =
      tex.data instanceof WebGLTexture ? (tex.data as WebGLTexture) : null;
    if (!glTex || tex.failed) {
      this.drawMissingImage(r);
      return;
    }
    if (this.lastMode !== MODE_TEXTURED || this.boundTex !== glTex) {
      this.flushBatch();
      this.bindTex(glTex);
      this.setMode(MODE_TEXTURED);
    }
    const t = this.translateRect(r);
    this.writeQuad(t.x, t.y, t.w, t.h, u1, v1, u2, v2);
  }

  // -------- Clipping --------

  startClip(): void {
    this.flushBatch();
    const { gl, canvas } = this;
    const r = this.m_rectClipRegion;
    const s = this.m_scale * this.dpr;
    const px = Math.round(r.x * s);
    const pw = Math.round(r.w * s);
    const ph = Math.round(r.h * s);
    // WebGL scissor is bottom-left; GWEN's coordinate space is top-left.
    const sy = canvas.height - Math.round((r.y + r.h) * s);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(px, sy, pw, ph);
  }

  endClip(): void {
    this.flushBatch();
    this.gl.disable(this.gl.SCISSOR_TEST);
  }

  // -------- Textures --------

  // String-URL loading is not wired yet — the production path is
  // `loadTextureFromSource`, which `DynamicSkin` (T006) calls with an
  // already-rasterized OffscreenCanvas. A future HTTP/image loader task
  // can extend this to honour `texture.name`.
  loadTexture(t: Texture): void {
    t.failed = true;
  }

  loadTextureFromSource(t: Texture, source: TexImageSource): void {
    const { gl } = this;
    // Reuse the existing GL handle when the Texture already has one
    // (callers that update content frequently — like the ColorLerpBox
    // re-baking its saturation/value gradient on every hue change —
    // would otherwise leak a fresh handle per upload).
    let handle: WebGLTexture | null = t.data instanceof WebGLTexture ? t.data : null;
    const isNew = handle === null;
    if (!handle) {
      handle = gl.createTexture();
      if (!handle) {
        t.failed = true;
        return;
      }
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, handle);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      source,
    );
    if (isNew) {
      // Sampler params are GL-handle-bound state that survives across
      // texImage2D calls, so only set them on first upload.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    // Derive dimensions from the source when available.
    const w =
      (source as { width?: number }).width ??
      (source as { videoWidth?: number }).videoWidth ??
      0;
    const h =
      (source as { height?: number }).height ??
      (source as { videoHeight?: number }).videoHeight ??
      0;

    t.data = handle;
    t.width = w;
    t.height = h;
    t.failed = false;

    // Re-bind whatever was active before this upload.
    if (this.boundTex) {
      gl.bindTexture(gl.TEXTURE_2D, this.boundTex);
    }
  }

  freeTexture(t: Texture): void {
    if (t.data instanceof WebGLTexture) {
      this.gl.deleteTexture(t.data);
    }
    t.data = null;
    t.failed = false;
  }

  // -------- Fonts --------

  override loadFont(f: Font): void {
    this.fontAtlasOrThrow().loadFont(f);
  }

  override freeFont(f: Font): void {
    this.fontAtlasOrThrow().freeFont(f);
  }

  override measureText(f: Font, text: string): Point {
    const atlas = this.fontAtlasOrThrow();
    atlas.ensureFont(f, this.getScale() * this.dpr);
    return atlas.measureText(f, text);
  }

  override renderText(f: Font, pos: Point, text: string): void {
    this.fontAtlasOrThrow().renderText(f, pos, text, this);
  }

  // Exposed for the FontAtlas so it can rasterize at backing-pixel
  // resolution (CSS px × DPR) even when the caller's scale is 1.
  getFontScale(): number {
    return this.m_scale * this.dpr;
  }

  /**
   * @internal
   * Emits a textured quad sampling from the font atlas's R8 texture.
   * Coordinates are in pre-translation logical space; this method runs
   * `translate` + scale itself, mirroring `drawTexturedRect`. Rounding
   * here is in CSS-pixel space — fine for backwards-compat callers but
   * `drawFontGlyphBacking` is preferred for crisp text.
   */
  drawFontGlyph(
    atlasTexture: WebGLTexture,
    x: number,
    y: number,
    w: number,
    h: number,
    u0: number,
    v0: number,
    u1: number,
    v1: number,
  ): void {
    if (this.lastMode !== MODE_FONT || this.boundTex !== atlasTexture) {
      this.flushBatch();
      this.bindTex(atlasTexture);
      this.setMode(MODE_FONT);
    }
    const [tx, ty] = this.translate(x, y);
    const tw = Math.ceil(w * this.m_scale);
    const th = Math.ceil(h * this.m_scale);
    this.writeQuad(tx, ty, tw, th, u0, v0, u1, v1);
  }

  /**
   * @internal
   * Emits a font-atlas quad whose position + size are already expressed in
   * backing pixels (CSS px × DPR). FontAtlas accumulates the per-glyph
   * cursor in backing-pixel space and rounds once per glyph, so the inputs
   * are integers; we convert back to CSS for the projection (which still
   * uses CSS dims) by dividing by DPR. The result is a quad whose corners
   * project to integer backing pixels, so the atlas's per-glyph cells
   * sample exactly one texel per destination pixel under LINEAR filtering.
   */
  drawFontGlyphBacking(
    atlasTexture: WebGLTexture,
    xBacking: number,
    yBacking: number,
    wBacking: number,
    hBacking: number,
    u0: number,
    v0: number,
    u1: number,
    v1: number,
  ): void {
    if (this.lastMode !== MODE_FONT || this.boundTex !== atlasTexture) {
      this.flushBatch();
      this.bindTex(atlasTexture);
      this.setMode(MODE_FONT);
    }
    const dpr = this.dpr;
    // Render offset is integer CSS pixels; adding it before snapping keeps
    // the snapped position in the parent control's frame of reference.
    const cssX = xBacking / dpr + this.m_renderOffset.x;
    const cssY = yBacking / dpr + this.m_renderOffset.y;
    const tx = Math.round(cssX * dpr) / dpr;
    const ty = Math.round(cssY * dpr) / dpr;
    const tw = wBacking / dpr;
    const th = hBacking / dpr;
    this.writeQuad(tx, ty, tw, th, u0, v0, u1, v1);
  }

  private fontAtlasOrThrow(): FontAtlas {
    if (!this.fontAtlas) {
      throw new Error('WebGL2Renderer.init() not yet called');
    }
    return this.fontAtlas;
  }

  // -------- Internals --------

  private writeQuad(
    x: number,
    y: number,
    w: number,
    h: number,
    u1: number,
    v1: number,
    u2: number,
    v2: number,
  ): void {
    if (this.batch.isFull(6)) {
      this.flushBatch();
    }
    const r = this.dr;
    const g = this.dg;
    const b = this.db;
    const a = this.da;
    const x2 = x + w;
    const y2 = y + h;
    const bp = this.batch;
    bp.addVert(x, y, u1, v1, r, g, b, a);
    bp.addVert(x2, y, u2, v1, r, g, b, a);
    bp.addVert(x, y2, u1, v2, r, g, b, a);
    bp.addVert(x2, y, u2, v1, r, g, b, a);
    bp.addVert(x2, y2, u2, v2, r, g, b, a);
    bp.addVert(x, y2, u1, v2, r, g, b, a);
  }

  private flushBatch(): void {
    if (this.batch.vertexCount === 0) return;
    const { gl } = this;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.batch.view);
    gl.drawArrays(gl.TRIANGLES, 0, this.batch.vertexCount);
    this.batch.reset();
  }

  // Always binds unconditionally. FontAtlas (and any other code that owns
  // a WebGLTexture) is free to call `gl.bindTexture` on its own during
  // uploads; the renderer's `boundTex` field is only a batching hint for
  // the callers in `drawFilledRect` / `drawTexturedRect` / `drawFontGlyph`
  // (to decide whether to flush). At the point we actually commit to a
  // new binding, we must issue the GL call unconditionally — otherwise
  // the GL state can silently disagree with `boundTex`.
  private bindNullTexture(): void {
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.nullTexture);
    this.boundTex = this.nullTexture;
  }

  private bindTex(handle: WebGLTexture): void {
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, handle);
    this.boundTex = handle;
  }

  private setMode(mode: number): void {
    if (this.lastMode === mode) return;
    this.lastMode = mode;
    this.gl.uniform1i(this.uModeLoc, mode);
  }

  // Top-left origin, Y-down. Callers feed in CSS-logical coordinates
  // (`canvas.setBounds` in the demo, pixel-read tests that don't multiply
  // by DPR, etc.) — so the projection's W/H is the canvas's CSS size, not
  // its backing-pixel size. `gl.viewport` still uses backing pixels (set
  // in `begin()` and `resize()`), which upscales the projection's NDC
  // output to cover the full high-DPI drawing buffer. Falls back to
  // `canvas.width` when clientWidth is 0 (isolated test canvases built
  // without DOM layout, which set backing directly with no CSS).
  private updateProjection(): void {
    const { gl, canvas } = this;
    const w = canvas.clientWidth || canvas.width || 1;
    const h = canvas.clientHeight || canvas.height || 1;
    // Column-major, as expected by uniformMatrix4fv with transpose=false.
    //   [ 2/w   0    0   -1 ]
    //   [  0  -2/h   0    1 ]
    //   [  0    0   -1    0 ]
    //   [  0    0    0    1 ]
    const m = new Float32Array([
      2 / w, 0, 0, 0,
      0, -2 / h, 0, 0,
      0, 0, -1, 0,
      -1, 1, 0, 1,
    ]);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.uProjectionLoc, false, m);
  }

  private buildProgram(vertSrc: string, fragSrc: string): WebGLProgram {
    const { gl } = this;
    const vs = this.compileShader(gl.VERTEX_SHADER, vertSrc);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fragSrc);
    const prog = gl.createProgram();
    if (!prog) throw new Error('createProgram failed');
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(prog) ?? '(no log)';
      gl.deleteProgram(prog);
      throw new Error(`shader link failed: ${log}`);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return prog;
  }

  private compileShader(type: number, src: string): WebGLShader {
    const { gl } = this;
    const sh = gl.createShader(type);
    if (!sh) throw new Error('createShader failed');
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh) ?? '(no log)';
      gl.deleteShader(sh);
      throw new Error(`shader compile failed: ${log}`);
    }
    return sh;
  }
}
