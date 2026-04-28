// TreeControl — the root of a tree. Ports `Gwen::Controls::TreeControl`
// from include/Gwen/Controls/TreeControl.h + src/Controls/TreeControl.cpp.
//
// TreeControl is a TreeNode whose title row is hidden and whose children
// land on an internal ScrollControl. Upstream achieves the layout swap
// with `BaseClass::BaseClass::Layout` (skipping TreeNode's layout to reach
// Base's), which TypeScript can't express directly. Instead we:
//   * Install the ScrollControl as this control's innerPanel so subsequent
//     `new TreeNode(this)` reparenting flows into it.
//   * Hide the synthetic title button so the root has no visible row.
//   * Accept TreeNode's default layout for the node itself — with the
//     title hidden and child rows on the scroll control, the observable
//     behaviour matches upstream for MVP.
//
// Multi-select works as in the ListBox: holding the platform "ctrl" key
// (Control on Win/Linux, Command on macOS — both mapped through
// `Canvas.isControlDown()`) keeps the previous selection when a new row
// is clicked. Without it, any name-press deselects siblings first.

import { Base } from './Base';
import { TreeNode } from './TreeNode';
import { ScrollControl } from './ScrollControl';
import { Pos } from '../core/Align';
import type { EventInfo } from '../core/Events';
import type { Skin } from '../skin/Skin';
import type { Canvas } from './Canvas';

export class TreeControl extends TreeNode {
  protected _scrollControl: ScrollControl;
  protected _allowMultiSelect = false;

  constructor(parent: Base | null) {
    super(parent);
    // Each node tracks the owning tree via `_treeControl` — set this
    // first so the synthetic root TreeControl reports itself when
    // queried. Mirrors GWEN TreeControl.cpp:17 (`m_TreeControl = this`).
    this.setTreeControl(this);
    // The synthetic title button / toggle live on the root; hide them so
    // the tree itself has no visible header row.
    this.getButton().hide();
    // ScrollControl hosts all top-level nodes. `Pos.Fill` lets it expand
    // to the tree's full bounds.
    this._scrollControl = new ScrollControl(this);
    this._scrollControl.dock(Pos.Fill);
    this._scrollControl.setAutoHideBars(true);
    this._scrollControl.setScroll(false, true);
    // Route subsequent addChild calls (including `addNode`'s TreeNode
    // allocation) through the scroll control's own innerPanel.
    this.setInnerPanel(this._scrollControl);
    this.setRoot(true);
    // The tree itself is the keyboard tab stop; arrow keys move the
    // selection between visible (expanded-into-view) nodes. Individual
    // TreeNodes stay non-tabable so the cycle doesn't pause on each row.
    this.setTabable(true);
    this.setKeyboardInputEnabled(true);
  }

  // =====================================================================
  // Configuration
  // =====================================================================

  setAllowMultiSelect(b: boolean): void {
    this._allowMultiSelect = b;
  }

  allowMultiSelect(): boolean {
    return this._allowMultiSelect;
  }

  getScroller(): ScrollControl {
    return this._scrollControl;
  }

  // =====================================================================
  // Nodes
  // =====================================================================

  override addNode(label: string): TreeNode {
    const inner = this._scrollControl.getInnerPanel();
    const node = new TreeNode(inner ?? this._scrollControl);
    node.dock(Pos.Top);
    node.setText(label);
    // Top-level nodes — set the root flag so the skin skips the
    // horizontal connector that would otherwise dangle to the left
    // of the title with nothing to connect to. Matches GWEN
    // TreeNode.cpp:93 (`node->SetRoot( gwen_cast<TreeControl>(this) != NULL )`).
    node.setRoot(true);
    node.setTreeControl(this);
    this.onNodeAdded(node);
    return node;
  }

  // Called by both TreeControl.addNode (top-level) and TreeNode.addNode
  // (nested) so EVERY node — at any depth — has its onNamePress wired
  // back to the tree's deselect-all logic. Without this nested nodes
  // never notify the tree, so clicks on them leave selections in
  // sibling subtrees intact ("one selection per level" bug).
  // Matches GWEN TreeControl.cpp:62.
  onNodeAdded(node: TreeNode): void {
    node.onNamePress.on((e) => this.onNodeSelected(e));
  }

  clear(): void {
    const inner = this._scrollControl.getInnerPanel();
    if (inner) inner.removeAllChildren();
    this.invalidate();
  }

  // The actual top-level nodes live inside the scroll control's
  // viewport, not inside `_innerPanelChildren` (which is the unused
  // base-TreeNode field). Override the inherited iterators so
  // selection / expansion / queries actually reach the visible tree.
  override getChildNodes(): readonly Base[] {
    return this._scrollControl.getInnerPanel()?.children ?? [];
  }

  override deselectAll(): void {
    for (const c of this.getChildNodes()) {
      if (c instanceof TreeNode) c.deselectAll();
    }
  }

  override expandAll(): void {
    for (const c of this.getChildNodes()) {
      if (c instanceof TreeNode) c.expandAll();
    }
  }

  // =====================================================================
  // Selection
  // =====================================================================

  // Match GWEN TreeControl.cpp:66: a single-select tree clears EVERY
  // selection (including the caller's, which then flips back via the
  // SetSelected toggle that runs after onNamePress returns — see
  // TreeNode.onClickTitle). The previous "deselect except caller"
  // path produced the wrong toggle behaviour for already-selected
  // nodes and only iterated the top-level scroll children, leaving
  // selections in nested subtrees stuck.
  protected onNodeSelected(_info: EventInfo): void {
    if (this._allowMultiSelect) {
      const canvas = this.getCanvas() as Canvas | null;
      const ctrlHeld = canvas !== null && typeof canvas.isControlDown === 'function' && canvas.isControlDown();
      if (ctrlHeld) return;
    }
    this.deselectAll();
  }

  // =====================================================================
  // Keyboard nav
  //
  // Up/Down move through visible (expanded-into-view) nodes; Left
  // collapses the current node or jumps to its parent if already
  // collapsed; Right expands a closed node or descends into the first
  // child if already open. Home/End jump to the first / last visible
  // node.
  // =====================================================================

  override onKeyUp(down: boolean): boolean {
    if (down) this.moveSelection(-1);
    return true;
  }

  override onKeyDown(down: boolean): boolean {
    if (down) this.moveSelection(1);
    return true;
  }

  override onKeyLeft(down: boolean): boolean {
    if (down) this.collapseOrJumpToParent();
    return true;
  }

  override onKeyRight(down: boolean): boolean {
    if (down) this.expandOrDescend();
    return true;
  }

  override onKeyHome(down: boolean): boolean {
    if (down) {
      const list = this.flattenVisible();
      if (list.length > 0) this.selectNode(list[0]);
    }
    return true;
  }

  override onKeyEnd(down: boolean): boolean {
    if (down) {
      const list = this.flattenVisible();
      if (list.length > 0) this.selectNode(list[list.length - 1]);
    }
    return true;
  }

  // Walk visible (DFS) — root's children first, descending only into
  // open nodes. The root itself is hidden, so we start from its
  // children.
  private flattenVisible(): TreeNode[] {
    const out: TreeNode[] = [];
    const visit = (node: TreeNode): void => {
      out.push(node);
      if (!node.isOpen()) return;
      for (const c of node.getChildNodes()) {
        if (c instanceof TreeNode) visit(c);
      }
    };
    for (const c of this.getChildNodes()) {
      if (c instanceof TreeNode) visit(c);
    }
    return out;
  }

  private findCurrentSelected(list: TreeNode[]): TreeNode | null {
    for (const n of list) if (n.isSelected()) return n;
    return null;
  }

  private moveSelection(delta: number): void {
    const list = this.flattenVisible();
    if (list.length === 0) return;
    const cur = this.findCurrentSelected(list);
    const idx = cur ? list.indexOf(cur) : -1;
    let next: number;
    if (idx === -1) next = delta > 0 ? 0 : list.length - 1;
    else next = Math.max(0, Math.min(list.length - 1, idx + delta));
    this.selectNode(list[next]);
  }

  private selectNode(node: TreeNode): void {
    this.deselectAll();
    node.setSelected(true);
  }

  private collapseOrJumpToParent(): void {
    const list = this.flattenVisible();
    const cur = this.findCurrentSelected(list);
    if (!cur) return;
    if (cur.isOpen() && cur.getChildNodes().length > 0) {
      cur.close();
      return;
    }
    // Already collapsed (or leaf) — find the parent TreeNode in the list
    // and jump there. The DFS list places parent immediately before the
    // first descendant, so we walk back until we find a node whose
    // visible-children include `cur`.
    const idx = list.indexOf(cur);
    for (let i = idx - 1; i >= 0; i--) {
      const candidate = list[i];
      if (this.isAncestor(candidate, cur)) {
        this.selectNode(candidate);
        return;
      }
    }
  }

  private expandOrDescend(): void {
    const list = this.flattenVisible();
    const cur = this.findCurrentSelected(list);
    if (!cur) {
      if (list.length > 0) this.selectNode(list[0]);
      return;
    }
    const kids = cur.getChildNodes();
    if (kids.length === 0) return;
    if (!cur.isOpen()) {
      cur.open();
      return;
    }
    // Already open — jump to first child.
    for (const c of kids) {
      if (c instanceof TreeNode) {
        this.selectNode(c);
        return;
      }
    }
  }

  private isAncestor(maybeParent: TreeNode, child: TreeNode): boolean {
    for (const c of maybeParent.getChildNodes()) {
      if (c === child) return true;
      if (c instanceof TreeNode && this.isAncestor(c, child)) return true;
    }
    return false;
  }

  // =====================================================================
  // Render
  // =====================================================================

  override render(skin: Skin): void {
    if (this.shouldDrawBackground()) skin.drawTreeControl(this);
  }
}
