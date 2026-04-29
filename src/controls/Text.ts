// Text — internal control used by Label (and future RichLabel). Ports
// `Gwen::ControlsInternal::Text` from include/Gwen/Controls/Text.h +
// src/Controls/Text.cpp.
//
// Unlike Label, Text owns no alignment or padding-wrangling logic — its
// job is purely to measure and render a run of characters using a Font.
// Callers (Label) size and position it; the renderer draws text at
// Text's local `(padding.left, padding.top)` so text padding behaves
// consistently regardless of where the control sits in its parent.
//
// Mouse input is disabled by default — Label clicks pass through to
// whatever sits under the label, matching GWEN's behavior.

import { Base } from './Base';
import { color, point, rect, type Color, type Rect } from '../core/Structures';
import type { Skin } from '../skin/Skin';
import type { Font } from '../skin/FontAtlas';

export type TextColorPreset = 'default' | 'bright' | 'dark' | 'highlight';

export class Text extends Base {
  private _text = '';
  private _textChanged = false;
  private _font: Font | null = null;

  // `_color` is the default text color (resolved from skin on first
  // render if left at the construction default); `_colorOverride` takes
  // precedence whenever its alpha is non-zero. This mirrors GWEN's
  // "override" convention: alpha 0 means "not set" so the base color
  // wins.
  private _color: Color = color(0, 0, 0, 255);
  // Whether `_color` was set explicitly by `setTextColor`. When false,
  // `render()` reads `skin.colors.label.default` instead — that lets a
  // theme switch on the active palette propagate to every Text
  // instance without reaching back through every control's
  // construction path.
  private _colorIsExplicit = false;
  private _colorPreset: TextColorPreset | null = null;
  private _colorOverride: Color = color(255, 255, 255, 0);

  private _wrap = false;
  // Child Text lines populated by `refreshSizeWrap` — one per wrapped
  // line. Each child renders its own slice; this Text's own `render`
  // early-returns in wrap mode so the children paint without overlap.
  private _lines: Text[] = [];

  constructor(parent: Base | null) {
    super(parent);
    this.setMouseInputEnabled(false);
    this._textChanged = true;
  }

  // =====================================================================
  // Text content
  // =====================================================================

  setText(s: string): void {
    if (this._text === s) return;
    this._text = s;
    this._textChanged = true;
    this.invalidate();
    this.redraw();
  }

  getText(): string {
    return this._text;
  }

  length(): number {
    return this._text.length;
  }

  // =====================================================================
  // Font
  // =====================================================================

  setFont(f: Font | null): void {
    if (this._font === f) return;
    this._font = f;
    this._textChanged = true;
    this.invalidate();
    this.redraw();
  }

  getFont(): Font | null {
    return this._font;
  }

  // =====================================================================
  // Color
  // =====================================================================

  setTextColor(c: Color): void {
    this._color = { r: c.r, g: c.g, b: c.b, a: c.a };
    this._colorIsExplicit = true;
    this._colorPreset = null;
    this.redraw();
  }

  textColor(): Color {
    if (this._colorPreset) {
      const skin = this.getSkinOrNull();
      if (skin) return this.colorForPreset(skin, this._colorPreset);
    }
    return this._color;
  }

  setTextColorPreset(preset: TextColorPreset): void {
    this._colorPreset = preset;
    this._colorIsExplicit = false;
    this.redraw();
  }

  setTextColorOverride(c: Color): void {
    this._colorOverride = { r: c.r, g: c.g, b: c.b, a: c.a };
    this.redraw();
  }

  textColorOverride(): Color {
    return this._colorOverride;
  }

  effectiveTextColor(skin: Skin): Color {
    const baseColor = this._colorPreset
      ? this.colorForPreset(skin, this._colorPreset)
      : this._colorIsExplicit
        ? this._color
        : skin.colors.label.default;
    if (!this._colorIsExplicit && this._colorOverride.a === 0 && baseColor.r > 128 && this.isDisabledInTree()) {
      return skin.colors.button.disabled;
    }
    return this._colorOverride.a === 0 ? baseColor : this._colorOverride;
  }

  // =====================================================================
  // Wrap
  // =====================================================================

  setWrap(w: boolean): void {
    if (this._wrap === w) return;
    this._wrap = w;
    this._textChanged = true;
    this.invalidate();
    this.redraw();
  }

  getWrap(): boolean {
    return this._wrap;
  }

  // =====================================================================
  // Size refresh
  // =====================================================================

  /**
   * Recompute the control's size from the current text + font. Falls back
   * to the skin's default font when no explicit font was set.
   */
  refreshSize(): void {
    this.resolveFont();
    const font = this._font;
    if (!font) {
      // No skin yet — defer until one is available.
      return;
    }
    const skin = this.getSkinOrNull();
    if (!skin) return;

    const pad = this.getPadding();
    let w = 0;
    let h = Math.max(1, font.size);
    if (this._text.length > 0) {
      const size = skin.renderer.measureText(font, this._text);
      w = size.x;
      h = size.y;
    } else {
      // GWEN's empty-text fallback: 1px wide × font height, so the caret
      // in a TextBox still has visible extent.
      w = 1;
    }

    this.setSize(
      Math.ceil(w) + pad.left + pad.right,
      Math.ceil(h) + pad.top + pad.bottom,
    );
  }

  /**
   * Wrap-mode refresh — greedy word-wrap into per-line child Text
   * controls. Uses `this.width()` as the line constraint (the host
   * Label is responsible for setting that). Each line becomes a
   * non-wrapping child Text positioned at its baseline; this Text's
   * own `render` early-returns in wrap mode so the children paint.
   */
  refreshSizeWrap(): void {
    this.resolveFont();
    const font = this._font;
    if (!font) return;
    const skin = this.getSkinOrNull();
    if (!skin) return;
    const pad = this.getPadding();
    const maxW = Math.max(1, this.width() - pad.left - pad.right);

    // Drop any existing per-line children.
    for (const ln of this._lines) ln.setParent(null);
    this._lines = [];

    if (this._text.length === 0) {
      this.setSize(this.width(), pad.top + pad.bottom + (font.size || 1));
      return;
    }

    const lineH = Math.ceil(skin.renderer.measureText(font, 'Ag').y);
    const lines: string[] = [];

    // Split on hard newlines first — a `\n` is a forced line break and
    // must NOT participate in word-wrap merging. Each resulting segment
    // is then word-wrapped against maxW. Without this step the previous
    // tokenizer treated `\n` as ordinary whitespace and the rendered
    // text ran together on a single visual line even though the caret
    // and selection (which scan for `\n` directly) reported correct
    // multi-line positions.
    const hardSegments = this._text.split('\n');
    for (let segIdx = 0; segIdx < hardSegments.length; segIdx++) {
      const segment = hardSegments[segIdx];
      // Empty segment between consecutive `\n`s (or a trailing `\n`)
      // becomes a blank line.
      if (segment.length === 0) {
        lines.push('');
        continue;
      }
      // Tokenise into runs of word + whitespace so word boundaries
      // survive the rebuild and consecutive spaces aren't collapsed.
      const tokens = segment.split(/(\s+)/).filter((t) => t.length > 0);
      let lineText = '';
      let lineWidth = 0;
      const flushLine = (): void => {
        if (lineText.length === 0) return;
        lines.push(lineText);
        lineText = '';
        lineWidth = 0;
      };
      for (const tok of tokens) {
        const isSpace = /^\s+$/.test(tok);
        const w = skin.renderer.measureText(font, tok).x;
        if (isSpace) {
          // Trailing whitespace at line end is OK (eats no width
          // measurably); trim leading whitespace at the start of a
          // new line so wrapped continuations don't indent.
          if (lineWidth + w <= maxW || lineWidth === 0) {
            if (lineWidth > 0) {
              lineText += tok;
              lineWidth += w;
            }
            continue;
          }
          flushLine();
          continue;
        }
        if (lineWidth + w > maxW && lineWidth > 0) {
          flushLine();
        }
        lineText += tok;
        lineWidth += w;
      }
      flushLine();
      // If the segment produced no flushed content (all-whitespace
      // segment that got trimmed), still emit a blank line so the
      // hard break is visible.
      if (lines.length === 0 || (segIdx > 0 && lines[lines.length - 1] !== '' && segment.trim().length === 0)) {
        lines.push('');
      }
    }

    let y = pad.top;
    for (const line of lines) {
      const t = new Text(this);
      t.setText(line.replace(/\s+$/, ''));
      t.setFont(font);
      if (this._colorPreset) t.setTextColorPreset(this._colorPreset);
      else if (this._colorIsExplicit) t.setTextColor(this._color);
      if (this._colorOverride.a !== 0) t.setTextColorOverride(this._colorOverride);
      t.setPos(pad.left, y);
      t.refreshSize();
      this._lines.push(t);
      y += lineH;
    }
    this.setSize(this.width(), y + pad.bottom);
  }

  // =====================================================================
  // Layout + render
  // =====================================================================

  override layout(_skin: Skin): void {
    if (this._textChanged) {
      if (this._wrap) this.refreshSizeWrap();
      else this.refreshSize();
      this._textChanged = false;
    }
  }

  override render(skin: Skin): void {
    if (this._wrap) return; // wrap-mode children handle their own render
    if (!this._text) return;
    this.resolveFont();
    const font = this._font;
    if (!font) return;
    // Default color tracks the active palette via `skin.colors.label.default`
    // when nothing has been set explicitly. This is what makes dark mode
    // text auto-flip to light: every Text without an explicit color
    // inherits the theme's body-text colour at render time.
    skin.renderer.setDrawColor(this.effectiveTextColor(skin));
    const pad = this.getPadding();
    skin.renderer.renderText(font, point(pad.left, pad.top), this._text);
  }

  // =====================================================================
  // Hit-test for caret positioning (used by future TextBox T200-family).
  // =====================================================================

  /**
   * Rect enclosing the character at index `i`, in local-space pixels.
   * Returns a zero-width rect at end-of-text when `i >= length`.
   */
  getCharacterPosition(i: number): Rect {
    this.resolveFont();
    const font = this._font;
    if (!font) return rect(0, 0, 0, 0);
    const skin = this.getSkinOrNull();
    if (!skin) return rect(0, 0, 0, 0);
    const pad = this.getPadding();

    const clamped = Math.max(0, Math.min(i, this._text.length));
    const prefix = this._text.substring(0, clamped);
    const tail = clamped < this._text.length ? this._text[clamped] : '';
    const prefixSize = prefix.length > 0 ? skin.renderer.measureText(font, prefix) : point(0, font.size);
    const charW = tail.length > 0 ? skin.renderer.measureText(font, tail).x : 0;

    return rect(
      pad.left + prefixSize.x,
      pad.top,
      charW,
      prefixSize.y,
    );
  }

  // =====================================================================
  // Internal helpers
  // =====================================================================

  /**
   * If no font is set, pick up the skin's default font. A no-op when a
   * font has already been assigned or when no skin is reachable yet.
   */
  private resolveFont(): void {
    if (this._font) return;
    const skin = this.getSkinOrNull();
    if (!skin) return;
    this._font = skin.getDefaultFont();
  }

  private isDisabledInTree(): boolean {
    let node: Base | null = this;
    while (node) {
      if (node.isDisabled()) return true;
      node = node.parent;
    }
    return false;
  }

  private colorForPreset(skin: Skin, preset: TextColorPreset): Color {
    switch (preset) {
      case 'bright': return skin.colors.label.bright;
      case 'dark': return skin.colors.label.dark;
      case 'highlight': return skin.colors.label.highlight;
      case 'default':
      default: return skin.colors.label.default;
    }
  }

  /**
   * Variant of getSkin() that returns null instead of throwing, for the
   * pre-attached case (Text's constructor runs before the parent is
   * wired into a skin-carrying tree).
   */
  private getSkinOrNull(): Skin | null {
    try {
      return this.getSkin();
    } catch {
      return null;
    }
  }

  /**
   * Accessor for the per-line children used by wrap mode. Currently
   * always empty — T117 will populate this as part of real word-wrap.
   */
  getLines(): readonly Text[] {
    return this._lines;
  }
}
