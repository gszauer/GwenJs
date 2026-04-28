// Color conversion + blending helpers used by the color controls
// (ColorLerpBox, ColorSlider, ColorPicker). Ports the free functions
// `Gwen::Utility::HSVToColor`, the HSV extraction path exposed via
// `Gwen::Color::ToHSV` / `ColorToHSV`, and the saturate-clamped linear
// blend `Gwen::Utility::LerpColor`.
//
// Uses the shared `HSV` interface from core/Structures so callers can
// interop with the existing `hsv()` factory.

import { color, type Color, type HSV } from './Structures';

// Extract hue/saturation/value from an RGB color. `h` is in degrees
// (0..360), `s` and `v` are 0..1. Matches the standard HSV algorithm.
export function rgbToHsv(c: Color): HSV {
  const r = c.r / 255;
  const g = c.g / 255;
  const b = c.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const v = max;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, v };
}

// Inverse of rgbToHsv. Accepts `h` in degrees (0..360) and `s`, `v` in
// 0..1; alpha is passed straight through (0..255). Result channels are
// rounded before being fed through the clamping `color()` factory, so
// out-of-range inputs won't produce invalid Color instances.
export function hsvToColor(h: number, s: number, v: number, a = 255): Color {
  if (s === 0) {
    const g = Math.round(v * 255);
    return color(g, g, g, a);
  }
  const hh = (((h % 360) + 360) % 360) / 60;
  const c = v * s;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 1) {
    r = c;
    g = x;
  } else if (hh < 2) {
    r = x;
    g = c;
  } else if (hh < 3) {
    g = c;
    b = x;
  } else if (hh < 4) {
    g = x;
    b = c;
  } else if (hh < 5) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return color(
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
    a,
  );
}

// Linear interpolation between two colors. `t` in 0..1 — 0 returns `a`,
// 1 returns `b`. Values outside that range are not clamped here; the
// clamping `color()` factory saturates the channel outputs.
export function lerpColor(a: Color, b: Color, t: number): Color {
  return color(
    Math.round(a.r + (b.r - a.r) * t),
    Math.round(a.g + (b.g - a.g) * t),
    Math.round(a.b + (b.b - a.b) * t),
    Math.round(a.a + (b.a - a.a) * t),
  );
}
