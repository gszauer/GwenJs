// VertexBatch — typed-array backed vertex accumulator for the WebGL2
// renderer. Each vertex is 8 floats (32 bytes): x, y, u, v, r, g, b, a.
// The buffer is allocated once at construction and reused across frames;
// `reset()` rewinds `vertexCount` without touching the backing store.
//
// Colors are stored as floats in [0, 1]. The conversion from GWEN's
// 0..255 `Color` is the caller's responsibility so that the hot write
// path in `WebGL2Renderer.drawFilledRect` only multiplies once per
// draw call, not once per vertex.

export class VertexBatch {
  readonly capacity: number;
  readonly data: Float32Array;
  private count = 0;

  constructor(capacity = 2048) {
    this.capacity = capacity;
    this.data = new Float32Array(capacity * 8);
  }

  addVert(
    x: number,
    y: number,
    u: number,
    v: number,
    r: number,
    g: number,
    b: number,
    a: number,
  ): void {
    const i = this.count * 8;
    const d = this.data;
    d[i + 0] = x;
    d[i + 1] = y;
    d[i + 2] = u;
    d[i + 3] = v;
    d[i + 4] = r;
    d[i + 5] = g;
    d[i + 6] = b;
    d[i + 7] = a;
    this.count++;
  }

  get vertexCount(): number {
    return this.count;
  }

  get byteLength(): number {
    return this.count * 32;
  }

  get view(): Float32Array {
    return this.data.subarray(0, this.count * 8);
  }

  reset(): void {
    this.count = 0;
  }

  // `threshold` in vertices — returns true when appending another quad
  // (6 verts) would overflow. Default of 2 keeps rooms for the tail of a
  // triangle pair but the renderer almost always passes 6 explicitly.
  isFull(threshold = 2): boolean {
    return this.capacity - this.count <= threshold;
  }
}
