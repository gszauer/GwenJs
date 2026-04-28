// PageControl — a wizard-style multi-page panel with Back / Next /
// Finish buttons along the bottom. Ports `Gwen::Controls::PageControl`
// from include/Gwen/Controls/PageControl.h + src/Controls/PageControl.cpp.
//
// Page count is fixed at configure time; pages are plain Base controls
// allocated up-front and shown one at a time. The control strip at the
// bottom hosts the navigation buttons and a "Page N of M" label.

import { Base } from './Base';
import { Button } from './Button';
import { Label } from './Label';
import { Signal, eventInfo, type EventInfo } from '../core/Events';
import { Pos } from '../core/Align';
import { margin } from '../core/Structures';

// Hard-cap the page count — upstream PageControl.h defines MAX_PAGES=64.
const MAX_PAGES = 64;

export class PageControl extends Base {
  readonly onPageChanged = new Signal<EventInfo>();
  readonly onFinish = new Signal<EventInfo>();

  protected _pages: (Base | null)[] = new Array(MAX_PAGES).fill(null);
  protected _pageCount = 0;
  protected _currentPage = -1;
  protected _useFinish = false;

  protected _backButton: Button;
  protected _nextButton: Button;
  protected _finishButton: Button;
  protected _label: Label;
  protected _controlStrip: Base;

  constructor(parent: Base | null) {
    super(parent);

    this._controlStrip = new Base(this);
    this._controlStrip.dock(Pos.Bottom);
    this._controlStrip.setHeight(24);
    this._controlStrip.setMargin(margin(10, 10, 10, 10));

    this._backButton = new Button(this._controlStrip);
    this._backButton.dock(Pos.Left);
    this._backButton.setWidth(70);
    this._backButton.setText('Back');
    this._backButton.onPress.on(() => this.previousPage());

    this._nextButton = new Button(this._controlStrip);
    this._nextButton.dock(Pos.Right);
    this._nextButton.setWidth(70);
    this._nextButton.setText('Next');
    this._nextButton.onPress.on(() => this.nextPage());

    this._finishButton = new Button(this._controlStrip);
    this._finishButton.dock(Pos.Right);
    this._finishButton.setWidth(70);
    this._finishButton.setText('Finish');
    this._finishButton.onPress.on(() => this.finish());
    this._finishButton.hide();

    this._label = new Label(this._controlStrip);
    this._label.dock(Pos.Fill);
    this._label.setAlignment(Pos.CenterV | Pos.Left);
  }

  // =====================================================================
  // Configuration
  // =====================================================================

  setPageCount(n: number): void {
    if (n > MAX_PAGES) n = MAX_PAGES;
    if (n < 0) n = 0;
    for (let i = 0; i < n; i++) {
      if (!this._pages[i]) {
        const p = new Base(this);
        p.dock(Pos.Fill);
        p.hide();
        this._pages[i] = p;
      }
    }
    this._pageCount = n;
    // Force a refresh on the next showPage even if we're already on 0.
    this._currentPage = -1;
    if (n > 0) this.showPage(0);
  }

  getPageCount(): number {
    return this._pageCount;
  }

  // =====================================================================
  // Navigation
  // =====================================================================

  showPage(i: number): void {
    if (i === this._currentPage) return;
    if (i < 0 || i >= this._pageCount) return;

    for (let k = 0; k < this._pageCount; k++) {
      const p = this._pages[k];
      if (p) p.setHidden(k !== i);
    }
    this._currentPage = i;

    // Hide (not disable) the boundary buttons — the user wants no
    // ghost button on the first page's Back slot or the last page's
    // Next slot. When `useFinishButton` is true, the last page swaps
    // Next out for Finish instead of leaving the slot empty.
    const isFirst = i === 0;
    const isLast = i === this._pageCount - 1;
    this._backButton.setHidden(isFirst);
    if (this._useFinish) {
      this._nextButton.setHidden(isLast);
      this._finishButton.setHidden(!isLast);
    } else {
      this._finishButton.hide();
      this._nextButton.setHidden(isLast);
    }

    this._label.setText(`Page ${i + 1} of ${this._pageCount}`);

    const info = eventInfo();
    info.controlCaller = this;
    info.integer = i;
    info.control = this._pages[i];
    this.onPageChanged.emit(info);
  }

  getPageNumber(): number {
    return this._currentPage;
  }

  getPage(i: number): Base | null {
    if (i < 0 || i >= this._pageCount) return null;
    return this._pages[i] ?? null;
  }

  getCurrentPage(): Base | null {
    if (this._currentPage < 0) return null;
    return this._pages[this._currentPage] ?? null;
  }

  nextPage(): void {
    this.showPage(this._currentPage + 1);
  }

  previousPage(): void {
    this.showPage(this._currentPage - 1);
  }

  finish(): void {
    const info = eventInfo();
    info.controlCaller = this;
    this.onFinish.emit(info);
  }

  // =====================================================================
  // Finish-button toggle
  // =====================================================================

  setUseFinishButton(b: boolean): void {
    if (this._useFinish === b) return;
    this._useFinish = b;
    // Refresh button visibility for the current page.
    if (this._currentPage >= 0) {
      const i = this._currentPage;
      // Force showPage to re-run its visibility logic without bailing on
      // the "already on this page" early-return.
      this._currentPage = -1;
      this.showPage(i);
    }
  }

  getUseFinishButton(): boolean {
    return this._useFinish;
  }

  // =====================================================================
  // Button accessors
  // =====================================================================

  nextButton(): Button {
    return this._nextButton;
  }

  backButton(): Button {
    return this._backButton;
  }

  finishButton(): Button {
    return this._finishButton;
  }

  label(): Label {
    return this._label;
  }
}
