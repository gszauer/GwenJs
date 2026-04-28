// PropertyTree + PropertyTreeNode — a tree whose leaves are Properties
// grids. Ports `Gwen::Controls::PropertyTree` + `Gwen::Controls::PropertyTreeNode`
// from include/Gwen/Controls/PropertyTree.h + src/Controls/PropertyTree.cpp.
//
// The tree hosts one PropertyTreeNode per group; each node's body is a
// Properties instance docked Top so the grid expands to the node's width.
// The skin's `drawPropertyTreeNode` paints the characteristic L-shaped
// border along the node's left + top edge, giving the grid a subtle
// outset from the tree's gutter.

import { TreeControl } from './TreeControl';
import { TreeNode } from './TreeNode';
import { Properties } from './Properties';
import { Base } from './Base';
import { Pos } from '../core/Align';
import type { Skin } from '../skin/Skin';

// ---------------------------------------------------------------------------
// PropertyTreeNode — a TreeNode that draws a property-tree border instead
// of relying on the normal tree branch lines. The border's left edge
// aligns with the inner-panel's x offset (TreeIndentation in GWEN) so
// the Properties grid sits flush against it.
//
// Deviates from the original GWEN `Render` replacement by still calling
// `super.render()` — the TreeNode render has no body in our port (draws
// happen in `renderOver`), but keeping the call preserves any future
// base-class behaviour.
// ---------------------------------------------------------------------------

export class PropertyTreeNode extends TreeNode {
  constructor(parent: Base | null) {
    super(parent);
    // Route subsequent `new Properties(node)` into the collapsible
    // body so the toggle / expand / size-to-children cycle in
    // TreeNode.layout actually has something to operate on. Without
    // this opt-in, Properties would land directly on the node,
    // sit alongside the title, and the toggle button would stay
    // hidden because `_innerPanelChildren.children.length === 0`.
    this.enableInnerPanelRouting();
  }

  override render(skin: Skin): void {
    super.render(skin);
    // Mirror Gwen::Controls::PropertyTreeNode::Render: border origin is
    // the inner-panel's local position (matches m_InnerPanel->X()/Y()).
    const inner = this._innerPanelChildren;
    skin.drawPropertyTreeNode(this, inner.x(), inner.y());
  }
}

// ---------------------------------------------------------------------------
// PropertyTree
// ---------------------------------------------------------------------------

export class PropertyTree extends TreeControl {
  constructor(parent: Base | null) {
    super(parent);
  }

  /**
   * Creates a collapsible group headed by `name` and returns the
   * Properties grid that owns the rows inside it.
   */
  add(name: string): Properties {
    const host = this.getScroller().getInnerPanel() ?? this;
    const node = new PropertyTreeNode(host);
    node.setText(name);
    // Dock the node Top so it stretches to the scroll-panel width and
    // stacks vertically — without this both the node and the Properties
    // grid inside it stay at Base's 10×10 default and collapse out of
    // view. Mirrors PropertyTree.cpp:21 (`node->Dock( Pos::Top )`).
    node.dock(Pos.Top);
    const props = new Properties(node);
    props.dock(Pos.Top);
    return props;
  }

  /**
   * Walks the top-level nodes and returns the Properties grid under the
   * one whose title matches `name`, or null if no such node exists.
   */
  findProperties(name: string): Properties | null {
    const inner = this.getScroller().getInnerPanel();
    if (!inner) return null;
    for (const n of inner.children) {
      if (n instanceof PropertyTreeNode && n.getText() === name) {
        for (const c of n.children) {
          if (c instanceof Properties) return c;
        }
      }
    }
    return null;
  }
}
