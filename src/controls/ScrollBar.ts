// ScrollBar family — BaseScrollBar + HorizontalScrollBar + VerticalScrollBar.
// Ports `Gwen::ControlsInternal::BaseScrollBar`,
// `Gwen::Controls::HorizontalScrollBar`, and
// `Gwen::Controls::VerticalScrollBar` from
// include/Gwen/Controls/ScrollBar/ScrollBar.h +
// include/Gwen/Controls/ScrollBar/HorizontalScrollBar.h +
// include/Gwen/Controls/ScrollBar/VerticalScrollBar.h (and their .cpp files).
//
// Design:
//   * The three classes are tightly coupled (both subclasses reach into
//     the base's two buttons + bar), so they ship in one file.
//   * `_scrolledAmount` is normalized 0..1. H/V subclasses translate
//     that to the bar's pixel position inside the track during `layout`.
//   * When the user drags the bar, we reverse the mapping in
//     `recomputeFromBarPosition` and fire `onBarMoved`. The owning
//     scrolling container (T201 ScrollControl, etc.) subscribes.

import { Base } from './Base';
import { ScrollBarBar } from './ScrollBarBar';
import { ScrollBarButton } from './ScrollBarButton';
import { Signal, eventInfo, type EventInfo } from '../core/Events';
import { Pos } from '../core/Align';
import { point } from '../core/Structures';
import type { Skin } from '../skin/Skin';

// ---------------------------------------------------------------------------
// BaseScrollBar — shared state for the two orientation subclasses.
// ---------------------------------------------------------------------------

export abstract class BaseScrollBar extends Base {
  readonly onBarMoved = new Signal<EventInfo>();

  protected _scrollButtons: [ScrollBarButton, ScrollBarButton];
  protected _bar: ScrollBarBar;

  // Track-area press state — held while a page-nudge click is in progress.
  protected _depressed = false;

  protected _contentSize = 0;
  protected _viewableContentSize = 0;
  protected _nudgeAmount = 20;
  // Normalized 0..1 scroll position.
  protected _scrolledAmount = 0;

  constructor(parent: Base | null) {
    super(parent);
    this.setBounds(0, 0, 15, 15);

    this._scrollButtons = [new ScrollBarButton(this), new ScrollBarButton(this)];
    this._bar = new ScrollBarBar(this);
    // Drag drives scrolledAmount via the orientation-specific recomputer,
    // then emits onBarMoved to listeners.
    this._bar.onDragged.on(() => {
      this.recomputeFromBarPosition();
      this.barMovedNotification();
    });
  }

  // =====================================================================
  // Config
  // =====================================================================

  setContentSize(s: number): void {
    if (this._contentSize === s) return;
    this._contentSize = s;
    this.invalidate();
  }

  setViewableContentSize(s: number): void {
    if (this._viewableContentSize === s) return;
    this._viewableContentSize = s;
    this.invalidate();
  }

  getContentSize(): number {
    return this._contentSize;
  }

  getViewableContentSize(): number {
    return this._viewableContentSize;
  }

  setNudgeAmount(n: number): void {
    this._nudgeAmount = n;
  }

  getScrolledAmount(): number {
    return this._scrolledAmount;
  }

  // Matches `BaseScrollBar::GetNudgeAmount` — track-click nudges by one
  // page (viewable/content); button nudges by the fixed nudge pixel
  // count expressed as a fraction of the content size.
  getNudgeAmount(): number {
    const denom = this._contentSize <= 0 ? 1 : this._contentSize;
    if (this._depressed) return this._viewableContentSize / denom;
    return this._nudgeAmount / denom;
  }

  setScrolledAmount(amount: number, forceUpdate: boolean): boolean {
    if (amount < 0) amount = 0;
    else if (amount > 1) amount = 1;
    if (amount === this._scrolledAmount && !forceUpdate) return false;
    this._scrolledAmount = amount;
    this.invalidate();
    this.barMovedNotification();
    return true;
  }

  barMovedNotification(): void {
    const info = eventInfo();
    info.controlCaller = this;
    this.onBarMoved.emit(info);
  }

  // =====================================================================
  // Orientation hooks — implemented by H/V subclasses.
  // =====================================================================

  /** Pulls the bar's current pixel position back into `_scrolledAmount`. */
  protected abstract recomputeFromBarPosition(): void;

  abstract override render(skin: Skin): void;
}

// ---------------------------------------------------------------------------
// HorizontalScrollBar
// ---------------------------------------------------------------------------

export class HorizontalScrollBar extends BaseScrollBar {
  constructor(parent: Base | null) {
    super(parent);
    this._bar.setHorizontal(true);
    this._scrollButtons[0].setDirection(Pos.Left);
    this._scrollButtons[1].setDirection(Pos.Right);
    this._scrollButtons[0].onPress.on(() => this.scrollToLeft());
    this._scrollButtons[1].onPress.on(() => this.scrollToRight());
  }

  scrollToLeft(): void {
    this.setScrolledAmount(this._scrolledAmount - this.getNudgeAmount(), true);
  }

  scrollToRight(): void {
    this.setScrolledAmount(this._scrolledAmount + this.getNudgeAmount(), true);
  }

  override layout(skin: Skin): void {
    super.layout(skin);
    const bs = this.height(); // square buttons fill the strip height
    this._scrollButtons[0].setBounds(0, 0, bs, bs);
    this._scrollButtons[1].setBounds(this.width() - bs, 0, bs, bs);

    // Bar size — minimum half a button so it stays grabbable.
    let barW = 0;
    if (this._contentSize > 0 && this._viewableContentSize > 0) {
      barW = Math.max(bs * 0.5, (this._viewableContentSize / this._contentSize) * (this.width() - bs * 2));
    }
    const trackW = this.width() - bs * 2;
    const travel = trackW - barW;
    const barX = bs + this._scrolledAmount * Math.max(0, travel);
    this._bar.setBounds(barX, 0, barW, this.height());
  }

  protected override recomputeFromBarPosition(): void {
    const bs = this.height();
    const trackW = this.width() - bs * 2;
    const travel = trackW - this._bar.width();
    if (travel <= 0) {
      this._scrolledAmount = 0;
      return;
    }
    const raw = (this._bar.x() - bs) / travel;
    this._scrolledAmount = raw < 0 ? 0 : raw > 1 ? 1 : raw;
  }

  override onMouseClickLeft(x: number, y: number, pressed: boolean): void {
    if (!pressed) {
      this._depressed = false;
      const canvas = this.getCanvas();
      if (canvas && canvas.mouseFocus === this) canvas.mouseFocus = null;
      return;
    }
    this._depressed = true;
    const canvas = this.getCanvas();
    if (canvas) canvas.mouseFocus = this;

    const local = this.canvasPosToLocal(point(x, y));
    if (local.x < this._bar.x()) {
      this.setScrolledAmount(this._scrolledAmount - this.getNudgeAmount(), true);
    } else if (local.x > this._bar.x() + this._bar.width()) {
      this.setScrolledAmount(this._scrolledAmount + this.getNudgeAmount(), true);
    }
  }

  override render(skin: Skin): void {
    skin.drawScrollBar(this, true, this._depressed);
  }
}

// ---------------------------------------------------------------------------
// VerticalScrollBar
// ---------------------------------------------------------------------------

export class VerticalScrollBar extends BaseScrollBar {
  constructor(parent: Base | null) {
    super(parent);
    this._bar.setHorizontal(false);
    this._scrollButtons[0].setDirection(Pos.Top);
    this._scrollButtons[1].setDirection(Pos.Bottom);
    this._scrollButtons[0].onPress.on(() => this.scrollToTop());
    this._scrollButtons[1].onPress.on(() => this.scrollToBottom());
  }

  scrollToTop(): void {
    this.setScrolledAmount(this._scrolledAmount - this.getNudgeAmount(), true);
  }

  scrollToBottom(): void {
    this.setScrolledAmount(this._scrolledAmount + this.getNudgeAmount(), true);
  }

  override layout(skin: Skin): void {
    super.layout(skin);
    const bs = this.width();
    this._scrollButtons[0].setBounds(0, 0, bs, bs);
    this._scrollButtons[1].setBounds(0, this.height() - bs, bs, bs);

    let barH = 0;
    if (this._contentSize > 0 && this._viewableContentSize > 0) {
      barH = Math.max(bs * 0.5, (this._viewableContentSize / this._contentSize) * (this.height() - bs * 2));
    }
    const trackH = this.height() - bs * 2;
    const travel = trackH - barH;
    const barY = bs + this._scrolledAmount * Math.max(0, travel);
    this._bar.setBounds(0, barY, this.width(), barH);
  }

  protected override recomputeFromBarPosition(): void {
    const bs = this.width();
    const trackH = this.height() - bs * 2;
    const travel = trackH - this._bar.height();
    if (travel <= 0) {
      this._scrolledAmount = 0;
      return;
    }
    const raw = (this._bar.y() - bs) / travel;
    this._scrolledAmount = raw < 0 ? 0 : raw > 1 ? 1 : raw;
  }

  override onMouseClickLeft(x: number, y: number, pressed: boolean): void {
    if (!pressed) {
      this._depressed = false;
      const canvas = this.getCanvas();
      if (canvas && canvas.mouseFocus === this) canvas.mouseFocus = null;
      return;
    }
    this._depressed = true;
    const canvas = this.getCanvas();
    if (canvas) canvas.mouseFocus = this;

    const local = this.canvasPosToLocal(point(x, y));
    if (local.y < this._bar.y()) {
      this.setScrolledAmount(this._scrolledAmount - this.getNudgeAmount(), true);
    } else if (local.y > this._bar.y() + this._bar.height()) {
      this.setScrolledAmount(this._scrolledAmount + this.getNudgeAmount(), true);
    }
  }

  override render(skin: Skin): void {
    skin.drawScrollBar(this, false, this._depressed);
  }
}
