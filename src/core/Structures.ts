// Core value types — ports of Gwen/Structures.h.
//
// Design note: GWEN's `UnicodeString` (std::wstring) and `String` (std::string)
// both collapse to TypeScript `string`. No separate alias is exported; consumers
// pass plain strings everywhere. JS strings are UTF-16 and round-trip through
// the FontAtlas glyph cache without conversion.
//
// All values are `interface` + factory functions rather than classes so the
// minified output pays zero per-instance prototype/constructor cost and the
// tree-shaker drops whatever the consumer never calls.

// ---------- Point ----------

export interface Point {
  x: number;
  y: number;
}

export function point(x = 0, y = 0): Point {
  return { x, y };
}

// Upstream `Point::operator+` has a known bug (Structures.h:115) that swaps the
// operands for `y`: `Point(x + p.x, p.y + y)`. Because integer addition is
// commutative the computed result is identical, so we implement it the
// straightforward way without replicating the swap.
export function addPoint(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subPoint(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function addPointInPlace(a: Point, b: Point): void {
  a.x += b.x;
  a.y += b.y;
}

export function subPointInPlace(a: Point, b: Point): void {
  a.x -= b.x;
  a.y -= b.y;
}

export function clonePoint(p: Point): Point {
  return { x: p.x, y: p.y };
}

export function setPoint(p: Point, x: number, y: number): void {
  p.x = x;
  p.y = y;
}

// ---------- Margin / Padding ----------

export interface Margin {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

// Argument order matches GWEN's `Margin( left, top, right, bottom )` at
// Structures.h:49 — this is *not* CSS's TRBL. Callers porting upstream code
// can pass arguments straight through; new TS code should usually prefer the
// object literal `{ left, top, right, bottom }`.
export function margin(left = 0, top = 0, right = 0, bottom = 0): Margin {
  return { top, bottom, left, right };
}

export function addMargin(a: Margin, b: Margin): Margin {
  return {
    top: a.top + b.top,
    bottom: a.bottom + b.bottom,
    left: a.left + b.left,
    right: a.right + b.right,
  };
}

export function cloneMargin(m: Margin): Margin {
  return { top: m.top, bottom: m.bottom, left: m.left, right: m.right };
}

export type Padding = Margin;

// ---------- Rect ----------

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function rect(x = 0, y = 0, w = 0, h = 0): Rect {
  return { x, y, w, h };
}

export function addRect(a: Rect, b: Rect): Rect {
  return { x: a.x + b.x, y: a.y + b.y, w: a.w + b.w, h: a.h + b.h };
}

export function cloneRect(r: Rect): Rect {
  return { x: r.x, y: r.y, w: r.w, h: r.h };
}

export function rectEquals(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

export function rectLeft(r: Rect): number {
  return r.x;
}

export function rectRight(r: Rect): number {
  return r.x + r.w;
}

export function rectTop(r: Rect): number {
  return r.y;
}

export function rectBottom(r: Rect): number {
  return r.y + r.h;
}

export function rectSize(r: Rect): Point {
  return { x: r.w, y: r.h };
}

// ---------- HSV ----------

export interface HSV {
  h: number;
  s: number;
  v: number;
}

export function hsv(h = 0, s = 0, v = 0): HSV {
  return { h, s, v };
}

// ---------- Color ----------

export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

// GWEN does not clamp channel arithmetic — unsigned chars wrap on overflow.
// TS uses IEEE doubles where wrap-around doesn't exist, so we clamp
// defensively. Round-to-nearest gives better perceptual output for
// `scaleColor` than truncation.
const clampChannel = (n: number): number => Math.max(0, Math.min(255, Math.round(n)));

export function color(r = 255, g = 255, b = 255, a = 255): Color {
  return {
    r: clampChannel(r),
    g: clampChannel(g),
    b: clampChannel(b),
    a: clampChannel(a),
  };
}

export function addColor(a: Color, b: Color): Color {
  return {
    r: clampChannel(a.r + b.r),
    g: clampChannel(a.g + b.g),
    b: clampChannel(a.b + b.b),
    a: clampChannel(a.a + b.a),
  };
}

export function subColor(a: Color, b: Color): Color {
  return {
    r: clampChannel(a.r - b.r),
    g: clampChannel(a.g - b.g),
    b: clampChannel(a.b - b.b),
    a: clampChannel(a.a - b.a),
  };
}

export function scaleColor(c: Color, f: number): Color {
  return {
    r: clampChannel(c.r * f),
    g: clampChannel(c.g * f),
    b: clampChannel(c.b * f),
    a: clampChannel(c.a * f),
  };
}

export function colorEquals(a: Color, b: Color): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}

export function cloneColor(c: Color): Color {
  return { r: c.r, g: c.g, b: c.b, a: c.a };
}

// ---------- Cursor types ----------

export const CursorType = {
  Normal: 0,
  Beam: 1,
  SizeNS: 2,
  SizeWE: 3,
  SizeNWSE: 4,
  SizeNESW: 5,
  SizeAll: 6,
  No: 7,
  Wait: 8,
  Finger: 9,
  Count: 10,
} as const;
export type CursorType = typeof CursorType[keyof typeof CursorType];

// ---------- Drag-and-drop package ----------

export interface DragAndDropPackage {
  name: string;
  userdata: unknown;
  // True while the package's owner is currently being dragged; the
  // canvas-level dispatch (`Canvas.beginDrag` / `endDrag`) flips this.
  draggable: boolean;
  // The control rendered as the drag preview while a drag is active.
  // Typed as `unknown` to keep this module dependency-free; consumers
  // (Base, Canvas, DockBase) cast to `Base | null` at the use site.
  drawcontrol: unknown;
  holdoffset: Point;
}

export function dragAndDropPackage(): DragAndDropPackage {
  return {
    name: '',
    userdata: null,
    draggable: false,
    drawcontrol: null,
    holdoffset: { x: 0, y: 0 },
  };
}
