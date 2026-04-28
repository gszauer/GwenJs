// TreeNode — a single expandable row inside a tree control. Ports
// `Gwen::Controls::TreeNode` from include/Gwen/Controls/TreeNode.h +
// src/Controls/TreeNode.cpp.
//
// Composition (matches upstream):
//   * ToggleButton — the [+] / [-] square in the gutter.
//   * Button       — the clickable title row (text + optional image).
//   * Base         — the inner panel that hosts child TreeNodes; hidden
//                    until `open()` toggles the node.
//
// The connector-line art (vertical gutter line, horizontal branch line,
// selection highlight) is drawn by the skin in `renderOver` so it sits
// on top of any docked children rendered by `render`.

import { Base } from './Base';
import { Button } from './Button';
import { Signal, eventInfo, type EventInfo } from '../core/Events';
import { Pos } from '../core/Align';
import { margin } from '../core/Structures';
import type { Skin } from '../skin/Skin';
import type { TreeControl } from './TreeControl';

// ---------------------------------------------------------------------------
// ToggleButton — the [+]/[-] square. Renders nothing of its own besides
// the skin's tree-button glyph; clicks flip the open flag.
// ---------------------------------------------------------------------------

class ToggleButton extends Button {
  protected _open = false;

  constructor(parent: Base | null) {
    super(parent);
    this.setSize(15, 15);
    this.setTabable(false);
    this.setShouldDrawBackground(false);
    // Note: no self-toggle handler. The parent TreeNode subscribes to
    // onPress and calls toggle() — which routes through open()/close()
    // and back into setOpen here, so _open stays in sync without a
    // double-flip.
  }

  isOpen(): boolean {
    return this._open;
  }

  setOpen(b: boolean): void {
    if (this._open === b) return;
    this._open = b;
    this.redraw();
  }

  override render(skin: Skin): void {
    skin.drawTreeButton(this, this._open);
  }

  // GWEN suppresses the focus ring on the tree button (TreeNode.cpp:23).
  override renderFocus(_skin: Skin): void {
    // no-op
  }
}

// ---------------------------------------------------------------------------
// TreeNodeText — the clickable title row. Mirrors GWEN's `TreeNodeText`
// (TreeNode.cpp:31). The only added behaviour over plain Button is the
// per-render colour update so the text remains legible against the
// selected/hover backgrounds — the default dark Button text reads as
// near-invisible on top of the blue Selection rect.
// ---------------------------------------------------------------------------

class TreeNodeText extends Button {
  constructor(parent: Base | null) {
    super(parent);
    this.setAlignment(Pos.Left | Pos.CenterV);
    this.setShouldDrawBackground(false);
    this.setTabable(false);
  }

  override render(skin: Skin): void {
    if (this.isDisabled()) {
      this.setTextColor(skin.colors.button.disabled);
    } else if (this.isDepressed() || this.getToggleState()) {
      this.setTextColor(skin.colors.tree.selected);
    } else if (this.isHovered()) {
      this.setTextColor(skin.colors.tree.hover);
    } else {
      this.setTextColor(skin.colors.tree.normal);
    }
    super.render(skin);
  }
}

// ---------------------------------------------------------------------------
// TreeNode
// ---------------------------------------------------------------------------

export class TreeNode extends Base {
  readonly onNamePress = new Signal<EventInfo>();
  readonly onRightPress = new Signal<EventInfo>();
  readonly onSelectChange = new Signal<EventInfo>();
  readonly onSelect = new Signal<EventInfo>();
  readonly onUnselect = new Signal<EventInfo>();

  protected _toggleButton: ToggleButton;
  protected _title: Button;
  protected _innerPanelChildren: Base;

  protected _selected = false;
  protected _selectable = true;
  protected _root = false;
  // Reference to the owning TreeControl. Propagated by `addNode` so
  // every node — including deeply nested ones — can call back into the
  // tree's selection / consolidation logic. Without it, only top-level
  // nodes were wired to the TreeControl's onNodeSelected handler, so
  // clicking a nested node never deselected its siblings (or the rest
  // of the tree). Mirrors GWEN's `m_TreeControl` field.
  protected _treeControl: TreeControl | null = null;

  // Indent width for child rows — matches TreeNode.cpp's `TreeIndentation`.
  protected static readonly INDENT = 14;

  constructor(parent: Base | null) {
    super(parent);

    this._toggleButton = new ToggleButton(this);
    this._toggleButton.setPos(0, 0);
    // Pressing the [+]/[-] glyph flips this node's open state — which
    // calls setOpen() back on the toggle and shows/hides the
    // child-panel. Without this wiring the click only flipped the
    // glyph's local _open flag and the child rows stayed visible.
    this._toggleButton.onPress.on(() => this.toggle());

    this._title = new TreeNodeText(this);
    this._title.dock(Pos.Top);
    this._title.setMargin(margin(16, 0, 0, 0));
    this._title.onPress.on(() => this.onClickTitle());
    this._title.onDoubleClick.on(() => this.onDoubleClickTitle());
    this._title.onRightPress.on((e) => this.onRightPress.emit(e));

    this._innerPanelChildren = new Base(this);
    this._innerPanelChildren.dock(Pos.Top);
    this._innerPanelChildren.setMargin(margin(TreeNode.INDENT, 1, 0, 0));
    this._innerPanelChildren.hide();
    // NOTE: GWEN sets `m_InnerPanel = m_InnerPanel` here so child
    // controls route into the collapsible body (matters for
    // PropertyTreeNode + Properties). We deliberately do NOT mirror
    // that on the base class because `TreeControl` extends `TreeNode`
    // and creates its `ScrollControl` as a child of `this` BEFORE its
    // own `setInnerPanel(scrollControl)` runs — if the base set the
    // inner panel here, the ScrollControl would land inside the hidden
    // `_innerPanelChildren` and the whole tree would vanish.
    // Subclasses that genuinely want GWEN's child-routing (just
    // PropertyTreeNode today) opt in themselves.
  }

  // Hook for subclasses that want GWEN's "children land in the
  // collapsible inner panel" behaviour. Calling this in the subclass
  // constructor (after super) routes any later `new X(node)` calls
  // into `_innerPanelChildren`, which is what drives the toggle's
  // visibility and `expandAll`'s show/hide cycle.
  protected enableInnerPanelRouting(): void {
    this.setInnerPanel(this._innerPanelChildren);
  }

  // =====================================================================
  // Text
  // =====================================================================

  setText(s: string): void {
    this._title.setText(s);
  }

  getText(): string {
    return this._title.getText();
  }

  // =====================================================================
  // Child nodes
  // =====================================================================

  addNode(label: string): TreeNode {
    const child = new TreeNode(this._innerPanelChildren);
    child.dock(Pos.Top);
    child.setText(label);
    // Propagate the TreeControl reference + notify it of the new node
    // so its onNodeSelected handler subscribes to this child's
    // onNamePress. Without this, only top-level nodes (added via
    // TreeControl.addNode, which wires onNamePress directly) reach
    // the tree's deselect-all path — clicking a nested node leaves
    // siblings under different parents still selected, producing
    // the "one selection per level" bug. Matches GWEN
    // TreeNode.cpp:94-99.
    if (this._treeControl) {
      child.setTreeControl(this._treeControl);
      this._treeControl.onNodeAdded(child);
    }
    return child;
  }

  getChildNodes(): readonly Base[] {
    return this._innerPanelChildren.children;
  }

  getButton(): Button {
    return this._title;
  }

  setTreeControl(tc: TreeControl): void {
    this._treeControl = tc;
  }

  getTreeControl(): TreeControl | null {
    return this._treeControl;
  }

  // =====================================================================
  // Open / close
  // =====================================================================

  isOpen(): boolean {
    return this._toggleButton.isOpen();
  }

  open(): void {
    this._toggleButton.setOpen(true);
    this._innerPanelChildren.show();
    this.invalidate();
  }

  close(): void {
    this._toggleButton.setOpen(false);
    this._innerPanelChildren.hide();
    this.invalidate();
  }

  toggle(): void {
    if (this.isOpen()) this.close();
    else this.open();
  }

  expandAll(): void {
    this.open();
    for (const c of this._innerPanelChildren.children) {
      if (c instanceof TreeNode) c.expandAll();
    }
  }

  // =====================================================================
  // Selection
  // =====================================================================

  setSelectable(b: boolean): void {
    this._selectable = b;
  }

  isSelectable(): boolean {
    return this._selectable;
  }

  isSelected(): boolean {
    return this._selected;
  }

  setSelected(b: boolean, fireEvents = true): void {
    if (!this._selectable) return;
    if (this._selected === b) return;
    this._selected = b;
    this._title.setToggleState(b);
    if (fireEvents) {
      const info = eventInfo();
      info.controlCaller = this;
      this.onSelectChange.emit(info);
      if (b) this.onSelect.emit(info);
      else this.onUnselect.emit(info);
    }
  }

  deselectAll(): void {
    this.setSelected(false, false);
    for (const c of this._innerPanelChildren.children) {
      if (c instanceof TreeNode) c.deselectAll();
    }
  }

  setRoot(b: boolean): void {
    this._root = b;
  }

  isRoot(): boolean {
    return this._root;
  }

  // =====================================================================
  // Internal handlers
  // =====================================================================

  protected onClickTitle(): void {
    // GWEN order (TreeNode.cpp:209-213): fire onNamePress FIRST so the
    // tree-control's onNodeSelected handler can deselect siblings without
    // clobbering this node's fresh selection state set below.
    const info = eventInfo();
    info.controlCaller = this;
    this.onNamePress.emit(info);
    this.setSelected(!this._selected);
  }

  protected onDoubleClickTitle(): void {
    if (this._innerPanelChildren.children.length > 0) this.toggle();
  }

  // =====================================================================
  // Layout + render
  // =====================================================================

  override layout(skin: Skin): void {
    // Mirror GWEN's TreeNode::Layout: when the inner panel has no
    // children we hide the toggle and the panel itself; otherwise we
    // show the toggle and size the panel to fit its children.
    // Without the size-to-children step the panel stays at Base's
    // 10×10 default and the docked rows beneath the title clip out of
    // view (PropertyTreeNode hits this — its Properties grid lives
    // inside the inner panel).
    if (this._innerPanelChildren.children.length === 0) {
      this._toggleButton.setHidden(true);
      this._toggleButton.setToggleState(false);
      this._innerPanelChildren.setHidden(true);
    } else {
      this._toggleButton.setHidden(false);
      this._innerPanelChildren.sizeToChildren(false, true);
    }
    super.layout(skin);
  }

  override postLayout(skin: Skin): void {
    super.postLayout(skin);
    // Inner-panel children dock Top inside _innerPanelChildren but that
    // Base doesn't self-size, so it stays at the default height and the
    // ancestor clip region chops the last child's text off. Size it to
    // its children first, then size THIS node to fit the grown panel.
    this._innerPanelChildren.sizeToChildren(false, true);
    this.sizeToChildren(false, true);
    // Strict vertical centering — matches GWEN TreeNode.cpp:112.
    // The skin's horizontal connector line is drawn at the toggle's
    // centre Y (passed as `halfWay` from render() below), so a
    // strictly-centred toggle has the connector running through
    // exactly the centre of the [+]/[-] glyph.
    const titleH = this._title.height();
    const togH = this._toggleButton.height();
    this._toggleButton.setPos(0, Math.max(0, Math.floor((titleH - togH) / 2)));
  }

  // Selection highlight + connector lines paint BEFORE the children
  // (the title Button is the one rendering the actual text). Earlier
  // versions of this file called drawTreeNode from renderOver, which
  // runs AFTER the children — so the opaque blue Selection rect was
  // painted on top of the title text and made the selected row
  // unreadable. Matches GWEN TreeNode.cpp:76 (DrawTreeNode lives in
  // Render(), not in a renderOver-equivalent hook).
  override render(skin: Skin): void {
    // `lastBranch` is the Y of the LAST CHILD's top — not the bottom
    // of the inner panel container. The skin draws the vertical
    // connector from just below the title down to `lastBranch +
    // halfWay`, which lands on the last child's centerline so the
    // line forms an L into the last leaf rather than running off the
    // bottom of the panel. Matches GWEN TreeNode.cpp:80-83.
    let lastBranch = 0;
    const childNodes = this._innerPanelChildren.children;
    if (childNodes.length > 0) {
      const last = childNodes[childNodes.length - 1];
      lastBranch = this._innerPanelChildren.y() + last.y();
    }
    skin.drawTreeNode(
      this,
      this.isOpen(),
      this._selected,
      this._title.height(),
      this._title.textWidth(),
      this._toggleButton.y() + Math.floor(this._toggleButton.height() / 2),
      lastBranch,
      this._root,
    );
  }
}
