// Positioning / docking flags + Align helpers. Ports `Gwen::Pos` and the
// `Gwen::Align` free functions. The `Pos` flags combine freely with bitwise
// OR (e.g. `Pos.Left | Pos.Top`); `Pos.Center` is pre-combined for convenience.

export const Pos = {
  None: 0,
  Left: 1 << 1, // 2
  Right: 1 << 2, // 4
  Top: 1 << 3, // 8
  Bottom: 1 << 4, // 16
  CenterV: 1 << 5, // 32
  CenterH: 1 << 6, // 64
  Fill: 1 << 7, // 128
  Center: (1 << 5) | (1 << 6), // 96
} as const;
export type Pos = number; // flags combine freely — widened from the literal union

// Duck-typed parameters keep this module dependency-free. The actual
// callers always pass `Base` instances, but referencing `Base` directly
// would create an `Align ↔ Base` import cycle that buys nothing at
// runtime — the structural types here describe exactly the surface used.
export function placeBelow(
  ctrl: { setPos(x: number, y: number): void; x: number },
  below: { bottom: number },
  border = 0,
): void {
  ctrl.setPos(ctrl.x, below.bottom + border);
}
