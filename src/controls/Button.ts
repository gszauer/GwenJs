// Button — the canonical clickable control. Ports
// `Gwen::Controls::Button` from include/Gwen/Controls/Button.h +
// src/Controls/Button.cpp.
//
// Button composes a Label (via inheritance) for centred text, adds a
// depressed/hovered/disabled render state, optional toggle behaviour, and
// an optional child ImagePanel for icons. Input-wise it responds to left
// and right clicks, double-click, and the Space key when focused.

import { Base } from './Base';
import { Label } from './Label';
import { ImagePanel } from './ImagePanel';
import { Signal, eventInfo, type EventInfo } from '../core/Events';
import { Key } from '../core/Input';
import { Pos } from '../core/Align';
import { margin, color, type Color } from '../core/Structures';
import type { Skin } from '../skin/Skin';
import type { Texture } from '../renderer/Texture';

export class Button extends Label {
  readonly onPress = new Signal<EventInfo>();
  readonly onRightPress = new Signal<EventInfo>();
  readonly onDown = new Signal<EventInfo>();
  readonly onUp = new Signal<EventInfo>();
  readonly onDoubleClick = new Signal<EventInfo>();
  readonly onToggle = new Signal<EventInfo>();
  readonly onToggleOn = new Signal<EventInfo>();
  readonly onToggleOff = new Signal<EventInfo>();

  protected _depressed = false;
  protected _isToggle = false;
  protected _toggleState = false;
  protected _centerImage = false;
  protected _image: ImagePanel | null = null;

  constructor(parent: Base | null) {
    super(parent);
    this.setMouseInputEnabled(true);
    // Buttons join the tab cycle by default — modern web a11y
    // expectation. GWEN's upstream defaulted these false (2010-era
    // game-UI conservatism); subclasses that genuinely shouldn't
    // take focus (TabButton, MenuItem, ListBoxRow, WindowCloseButton)
    // explicitly setTabable(false) in their own constructors to
    // override.
    this.setKeyboardInputEnabled(true);
    this.setTabable(true);
    this.setSize(100, 20);
    this.setAlignment(Pos.Center);
    this.setTextPadding(margin(3, 0, 3, 0));
    this.setShouldDrawBackground(true);
  }

  // =====================================================================
  // State queries + setters
  // =====================================================================

  isDepressed(): boolean {
    return this._depressed;
  }

  setDepressed(b: boolean): void {
    if (this._depressed === b) return;
    this._depressed = b;
    this.redraw();
  }

  isToggle(): boolean {
    return this._isToggle;
  }

  setIsToggle(b: boolean): void {
    this._isToggle = b;
  }

  getToggleState(): boolean {
    return this._toggleState;
  }

  setToggleState(b: boolean): void {
    if (this._toggleState === b) return;
    this._toggleState = b;
    const info = eventInfo();
    info.controlCaller = this;
    this.onToggle.emit(info);
    if (b) this.onToggleOn.emit(info);
    else this.onToggleOff.emit(info);
    this.redraw();
  }

  toggle(): void {
    this.setToggleState(!this._toggleState);
  }

  // =====================================================================
  // Image
  // =====================================================================

  setImage(name: string, center = false): void {
    if (!this._image) {
      this._image = new ImagePanel(this);
      this._image.setName('ButtonImage');
      this._image.setMouseInputEnabled(false);
    }
    this._image.setImageName(name);
    this._centerImage = center;
    this.invalidate();
  }

  // Assign an already-uploaded Texture to the button's icon slot. The
  // optional w/h size the ImagePanel; if omitted the texture's natural
  // dimensions are used.
  setImageTexture(t: Texture, w?: number, h?: number, center = false): void {
    if (!this._image) {
      this._image = new ImagePanel(this);
      this._image.setName('ButtonImage');
      this._image.setMouseInputEnabled(false);
    }
    this._image.setTexture(t);
    const iw = w ?? t.width;
    const ih = h ?? t.height;
    if (iw > 0 && ih > 0) this._image.setSize(iw, ih);
    this._centerImage = center;
    this.invalidate();
  }

  setImageAlpha(f: number): void {
    if (!this._image) return;
    this._image.setDrawColor(color(255, 255, 255, Math.round(f * 255)));
  }

  // =====================================================================
  // Render
  // =====================================================================

  override render(skin: Skin): void {
    if (!this.shouldDrawBackground()) return;
    const drawDepressed = (this._depressed && this.isHovered()) || (this._isToggle && this._toggleState);
    const hovered = this.isHovered() && !drawDepressed;
    skin.drawButton(this, drawDepressed, hovered, this.isDisabled());
  }

  // =====================================================================
  // Mouse
  // =====================================================================

  override onMouseClickLeft(_x: number, _y: number, pressed: boolean): void {
    if (this.isDisabled()) return;
    const info = eventInfo();
    info.controlCaller = this;
    const canvas = this.getCanvas();
    if (pressed) {
      if (canvas) canvas.mouseFocus = this;
      this._depressed = true;
      this.onDown.emit(info);
    } else {
      const wasDepressed = this._depressed;
      if (this.isHovered() && wasDepressed) {
        if (this._isToggle) this.toggle();
        this.onPress.emit(info);
      }
      if (canvas) canvas.mouseFocus = null;
      this._depressed = false;
      this.onUp.emit(info);
    }
    this.redraw();
  }

  override onMouseClickRight(_x: number, _y: number, pressed: boolean): void {
    if (this.isDisabled()) return;
    if (!pressed) return;
    const info = eventInfo();
    info.controlCaller = this;
    this.onRightPress.emit(info);
  }

  override onMouseDoubleClickLeft(x: number, y: number): void {
    this.onMouseClickLeft(x, y, true);
    const info = eventInfo();
    info.controlCaller = this;
    this.onDoubleClick.emit(info);
  }

  // =====================================================================
  // Keyboard — Space and Return both trigger a press when focused,
  // matching the modern web/desktop convention. Honours _isToggle so
  // a toggleable button (Bold, Italic, etc.) flips its state via
  // keyboard the same way it does via mouse.
  // =====================================================================

  override onKeyPress(key: number, pressed = true): boolean {
    if ((key === Key.Space || key === Key.Return) && pressed && !this.isDisabled()) {
      if (this._isToggle) this.toggle();
      const info = eventInfo();
      info.controlCaller = this;
      this.onPress.emit(info);
      return true;
    }
    return super.onKeyPress(key, pressed);
  }

  // Fires the press signal without any input gating — used by accelerator
  // handlers (menu shortcuts, enter-as-default-button).
  acceleratePressed(): void {
    const info = eventInfo();
    info.controlCaller = this;
    this.onPress.emit(info);
  }

  // Convenience GWEN helper — wires `handler` straight into `onPress`.
  setAction(handler: (e: EventInfo) => void): void {
    this.onPress.on(handler);
  }

  // =====================================================================
  // Layout
  // =====================================================================

  override sizeToContents(): void {
    super.sizeToContents();
    if (this._image) {
      const h = this._image.height() + 4;
      if (this.height() < h) this.setHeight(h);
    }
  }

  override postLayout(skin: Skin): void {
    super.postLayout(skin);
    if (this._image) {
      if (this._centerImage) {
        this._image.position(Pos.Center);
      } else {
        this._image.position(Pos.Left | Pos.CenterV, 4, 0);
      }
    }
  }

  // Keep the public surface minimal: expose the image's draw color via a
  // thin setter so hosts don't have to unwrap the internal ImagePanel.
  setImageColor(c: Color): void {
    if (!this._image) return;
    this._image.setDrawColor(c);
  }
}
