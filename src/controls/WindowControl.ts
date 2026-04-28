// WindowControl — the top-level floating window chrome. Ports
// `Gwen::Controls::WindowControl` from include/Gwen/Controls/WindowControl.h
// + src/Controls/WindowControl.cpp.
//
// Composition:
//   * Inherits from `ResizableControl` for the 8 edge/corner grab
//     handles; the Top handle is explicitly hidden because drags on the
//     title bar area should move, not resize.
//   * Owns a `Dragger` as the title bar (moves the window), a `Label`
//     for the title text, and a `WindowCloseButton` in the top-right.
//
// Deviations from GWEN:
//   * GWEN installs an inner-panel inside the window so user content
//     docks next to (not on top of) the title bar. We skip that here —
//     callers dock children with `Pos.Fill` and title-bar layout is
//     handled by the Dragger's `Pos.Top` dock. This keeps the public
//     API surface smaller; a future task can add the inner panel if
//     needed for complex window contents.
//   * `Modal` is parented to the canvas (via a Base cast from the
//     structural CanvasLike interface). `destroyModal` re-parents us to
//     the canvas too — GWEN notes the original parent is lost and
//     simply re-parents to the canvas; we follow that pattern but
//     remember `_preModalParent` for a slightly better restore.

import { ResizableControl } from './ResizableControl';
import { Dragger } from './Dragger';
import { Label } from './Label';
import { WindowCloseButton } from './WindowButtons';
import { Signal, eventInfo, type EventInfo } from '../core/Events';
import { Pos } from '../core/Align';
import { margin, point } from '../core/Structures';
import { Modal } from './Modal';
import type { Base } from './Base';
import type { Skin } from '../skin/Skin';
import type { Canvas } from './Canvas';

export class WindowControl extends ResizableControl {
  readonly onWindowClosed = new Signal<EventInfo>();

  protected _titleBar: Dragger;
  protected _title: Label;
  protected _closeButton: WindowCloseButton;
  protected _closable = true;
  protected _deleteOnClose = false;
  protected _modal: Modal | null = null;
  protected _preModalParent: Base | null = null;

  constructor(parent: Base | null, titleText = 'Window') {
    super(parent);
    this.setMinimumSize(point(100, 40));
    this.setClampMovement(true);
    this.setSize(200, 150);
    this.setMouseInputEnabled(true);
    this.setKeyboardInputEnabled(false);
    // Tab navigation traps inside the window — siblings outside the
    // window are unreachable until focus leaves it.
    this.setTabBoundary(true);

    // Title bar height matches the painted title strip in the atlas
    // (Window.Normal mt). No bottom margin — earlier code used a 24px
    // dragger + 4px bottom margin against a 32px painted title strip,
    // leaving a hard 1px separator line + an empty band visible
    // below the dragger.
    this._titleBar = new Dragger(this);
    this._titleBar.dock(Pos.Top);
    this._titleBar.setHeight(28);
    this._titleBar.setTarget(this);

    this._title = new Label(this._titleBar);
    this._title.dock(Pos.Fill);
    this._title.setAlignment(Pos.Left | Pos.CenterV);
    this._title.setPadding(margin(8, 0, 0, 0));
    this._title.setText(titleText);

    // Close button sized to fit inside the title bar with 2px
    // top/bottom insets. Skin.drawWindowCloseButton scales the 31×31
    // atlas glyph to the render bounds, so a smaller button stays
    // crisp without clipping. Width is preserved through Pos.Right
    // docking; height takes the dragger height minus margins.
    this._closeButton = new WindowCloseButton(this._titleBar);
    this._closeButton.setSize(24, 24);
    this._closeButton.dock(Pos.Right);
    this._closeButton.setMargin(margin(0, 2, 4, 2));
    this._closeButton.setWindow(this);
    this._closeButton.onPress.on(() => this.closeButtonPressed());

    // Hide the Top resizer — drags on the title bar move the window, and
    // the close button / title sit in that strip. Allowing both would
    // conflict. Matches GWEN's `GetResizer( 8 )->Hide()`.
    this.getResizer(Pos.Top)?.hide();
  }

  // =====================================================================
  // Title / chrome config
  // =====================================================================

  setTitle(s: string): void {
    this._title.setText(s);
  }

  getTitle(): string {
    return this._title.getText();
  }

  setClosable(b: boolean): void {
    this._closable = b;
    this._closeButton.setHidden(!b);
  }

  isClosable(): boolean {
    return this._closable;
  }

  setDeleteOnClose(b: boolean): void {
    this._deleteOnClose = b;
  }

  // =====================================================================
  // Z-order
  // =====================================================================

  override touch(): void {
    super.touch();
    this.bringToFront();
  }

  // True when we're the front-most WindowControl sibling. Renderers use
  // this to pick the active vs inactive chrome.
  isOnTop(): boolean {
    const p = this.parent;
    if (!p) return false;
    const siblings = p.children;
    for (let i = siblings.length - 1; i >= 0; i--) {
      const s = siblings[i];
      if (s instanceof WindowControl) return s === this;
    }
    return false;
  }

  // =====================================================================
  // Close
  // =====================================================================

  close(): void {
    this.closeButtonPressed();
  }

  protected closeButtonPressed(): void {
    this.destroyModal();
    const info = eventInfo();
    info.controlCaller = this;
    this.onWindowClosed.emit(info);
    this.setHidden(true);
    if (this._deleteOnClose) {
      const canvas = this.getCanvas() as Canvas | null;
      if (canvas && typeof canvas.addDelayedDelete === 'function') {
        canvas.addDelayedDelete(this);
      }
    }
  }

  // =====================================================================
  // Modal wrap
  // =====================================================================

  makeModal(drawBackground = true): void {
    if (this._modal) return;
    const canvas = this.getCanvas() as Canvas | null;
    if (!canvas) return;
    this._preModalParent = this.parent;
    this._modal = new Modal(canvas);
    this._modal.setShouldDrawBackground(drawBackground);
    this.setParent(this._modal);
  }

  destroyModal(): void {
    if (!this._modal) return;
    const canvas = this.getCanvas() as Canvas | null;
    // Restore our previous parent where we can. GWEN punts and always
    // reparents to the canvas; we remember `_preModalParent` for a
    // cleaner restore, falling back to the canvas otherwise.
    this.setParent(this._preModalParent ?? canvas);
    this._modal.dispose();
    this._modal = null;
    this._preModalParent = null;
  }

  // =====================================================================
  // Visibility / input
  // =====================================================================

  override setHidden(b: boolean): void {
    super.setHidden(b);
    if (!b) this.bringToFront();
  }

  override onMouseClickLeft(x: number, y: number, pressed: boolean): void {
    super.onMouseClickLeft(x, y, pressed);
    if (pressed) this.touch();
  }

  // =====================================================================
  // Render
  // =====================================================================

  override render(skin: Skin): void {
    const hasFocus = this.isOnTop();
    skin.drawWindow(this, this._titleBar.bottom(), hasFocus);
  }

  override renderUnder(skin: Skin): void {
    skin.drawShadow(this);
  }

  override renderFocus(_skin: Skin): void {
    // Windows suppress the default keyboard focus ring — they have their
    // own active / inactive frame art from `drawWindow`.
  }
}
