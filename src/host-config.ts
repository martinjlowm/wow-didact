import { Props } from '@/element';

/**
 * The seam between the reconciler and whatever it renders into, modelled on
 * react-reconciler's HostConfig. The reconciler never names a WoW `Frame`; it
 * only ever calls these methods, so the same diffing drives the in-game host
 * and the in-memory test host from the identical code path.
 *
 * `Node` is the host's node handle: a `Region` in-game, a plain record in tests.
 * Order among a parent's children is expressed with append/insertBefore/remove
 * so a host that cares about order (the test engine) can model it, while a host
 * that positions by anchors instead of child order (WoW) can treat them as
 * reparent/show/hide.
 */
export interface HostConfig<Node> {
  /** Build a host node for `type`, unattached. `container` is its eventual
   * parent, needed by hosts (WoW) that require a parent at creation time. */
  createInstance(type: string, props: Props, container: Node): Node;

  /** Build a text node for inline string/number children. */
  createTextInstance(text: string, container: Node): Node;

  /** Apply a prop diff to a live node. Called with `{}` as prevProps on mount. */
  commitUpdate(instance: Node, prevProps: Props, nextProps: Props): void;

  /** Update a text node's content. */
  commitTextUpdate(instance: Node, prevText: string, nextText: string): void;

  /** The node's current parent, or null at the root. Used to re-render a
   * component subtree in place on setState. */
  getParent(instance: Node): Node | null;

  /** Attach `child` as the last child of `parent`; moves it if already attached. */
  appendChild(parent: Node, child: Node): void;

  /** Attach/move `child` immediately before `beforeChild` under `parent`. */
  insertBefore(parent: Node, child: Node, beforeChild: Node): void;

  /** Detach `child` from `parent`. */
  removeChild(parent: Node, child: Node): void;

  /** Called once a node has been detached and will not be reused by this tree,
   * so a host can pool or release it (WoW frames are uncollectable). */
  finalizeRemoval(instance: Node): void;
}
