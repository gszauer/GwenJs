// RichLabel — a block-flow text control that supports multiple
// colours, fonts, and explicit line breaks within a single control.
// Ports `Gwen::Controls::RichLabel` from include/Gwen/Controls/RichLabel.h
// + src/Controls/RichLabel.cpp.
//
// Text is accumulated through `addText(str, color?, font?)` / `addLineBreak()`;
// on layout, the control splits each text block into whitespace-bounded
// tokens and flows them into wrapped lines, each rendered by its own
// child Text control. A rebuild is triggered on bounds change so the
// flow follows resizes.
//
// Mouse input is disabled by default (labels shouldn't swallow clicks
// meant for controls underneath).

import { Base } from './Base';
import { Text } from './Text';
import { color, type Color, type Rect } from '../core/Structures';
import type { Skin } from '../skin/Skin';
import type { Font } from '../skin/FontAtlas';

interface TextBlock {
  kind: 'text';
  text: string;
  color: Color;
  font: Font | null;
}

interface LineBreakBlock {
  kind: 'newline';
}

type Block = TextBlock | LineBreakBlock;

export class RichLabel extends Base {
  protected _blocks: Block[] = [];
  protected _rebuildRequired = true;
  protected _defaultColor: Color = color(255, 255, 255, 255);

  constructor(parent: Base | null) {
    super(parent);
    this.setMouseInputEnabled(false);
  }

  // =====================================================================
  // Content
  // =====================================================================

  /**
   * Append a span of text, optionally with an explicit colour / font.
   * Embedded `\n` characters become synthetic line-break blocks so the
   * caller can just pass `"Hello\nWorld"` without manually splitting.
   */
  addText(text: string, col?: Color, font?: Font): void {
    if (text.length === 0) return;
    const parts = text.split('\n');
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) this._blocks.push({ kind: 'newline' });
      if (parts[i].length > 0) {
        const src = col ?? this._defaultColor;
        this._blocks.push({
          kind: 'text',
          text: parts[i],
          color: { r: src.r, g: src.g, b: src.b, a: src.a },
          font: font ?? null,
        });
      }
    }
    this._rebuildRequired = true;
    this.invalidate();
  }

  addLineBreak(): void {
    this._blocks.push({ kind: 'newline' });
    this._rebuildRequired = true;
    this.invalidate();
  }

  clear(): void {
    this._blocks = [];
    this._rebuildRequired = true;
    this.invalidate();
  }

  setDefaultTextColor(c: Color): void {
    this._defaultColor = { r: c.r, g: c.g, b: c.b, a: c.a };
  }

  // =====================================================================
  // Layout
  // =====================================================================

  protected override onBoundsChanged(old: Rect): void {
    super.onBoundsChanged(old);
    if (old.w !== this.width()) {
      // Only width changes force a reflow; height changes don't affect wrap.
      this._rebuildRequired = true;
    }
  }

  override layout(skin: Skin): void {
    super.layout(skin);
    if (!this._rebuildRequired) return;
    this.rebuild(skin);
    this._rebuildRequired = false;
  }

  /**
   * Tear down all existing Text children and reflow the block list into
   * per-token Text controls. Words are wrapped at the control's width;
   * leading whitespace at the start of a wrapped line is discarded.
   */
  private rebuild(skin: Skin): void {
    this.removeAllChildren();

    const maxWidth = this.width();
    const defaultFont: Font | null = (() => {
      try {
        return skin.getDefaultFont();
      } catch {
        return null;
      }
    })();

    let x = 0;
    let y = 0;
    let lineHeight = 0;

    for (let bi = 0; bi < this._blocks.length; bi++) {
      const b = this._blocks[bi];
      if (b.kind === 'newline') {
        x = 0;
        y += lineHeight > 0 ? lineHeight : 1;
        lineHeight = 0;
        continue;
      }
      const font = b.font ?? defaultFont;
      const tokens = splitIntoTokens(b.text);
      for (let ti = 0; ti < tokens.length; ti++) {
        const tok = tokens[ti];
        // Measure before committing a child so we can decide whether
        // this token fits on the current line.
        let tokWidth = 0;
        let tokHeight = font ? Math.max(1, font.size) : 1;
        if (font) {
          const size = skin.renderer.measureText(font, tok);
          tokWidth = Math.ceil(size.x);
          tokHeight = Math.ceil(size.y);
        }

        // Wrap: if the token doesn't fit on the current line (and we're
        // not at x=0, where wrapping would loop forever), start a new
        // line. Pure-whitespace tokens at a fresh line are discarded so
        // wrapped text doesn't indent.
        if (x > 0 && x + tokWidth > maxWidth) {
          x = 0;
          y += lineHeight > 0 ? lineHeight : 1;
          lineHeight = 0;
          if (/^\s+$/.test(tok)) continue;
        }

        const t = new Text(this);
        if (font) t.setFont(font);
        t.setTextColor(b.color);
        t.setText(tok);
        t.refreshSize();
        t.setPos(x, y);
        x += tokWidth > 0 ? tokWidth : t.width();
        const h = tokHeight > 0 ? tokHeight : t.height();
        if (h > lineHeight) lineHeight = h;
      }
    }

    // Shrink-wrap the height so the rendered box matches the flowed
    // content. Width stays authoritative (caller-driven).
    const finalHeight = y + (lineHeight > 0 ? lineHeight : 0);
    if (finalHeight !== this.height()) {
      this.setHeight(finalHeight);
    }
  }
}

// Split a text span on whitespace runs but *keep* the whitespace chunks
// so inter-word spacing survives the flow rebuild.
function splitIntoTokens(text: string): string[] {
  const out: string[] = [];
  const re = /(\s+|\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(m[0]);
  return out;
}
