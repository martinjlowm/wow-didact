import { Component } from '@/component';
import { InternalElement, Props, TEXT_ELEMENT } from '@/element';
import { HostConfig } from '@/host-config';

/**
 * An instantiated element. Each instance owns exactly one host node: a host or
 * text element backs its own node; a composite borrows its rendered child's node
 * (`hostNode === childInstance.hostNode`). That one-node-per-instance invariant
 * is what lets keyed reordering below treat the child list as a flat 1:1 map
 * onto host children.
 */
export interface Instance<Node> {
  hostNode: Node;
  element: InternalElement;
  key: string | null;
  // Host/text elements own these; composites leave them empty.
  childInstances: Array<Instance<Node>>;
  // Composites own these; host/text leave them null.
  publicInstance: Component | null;
  childInstance: Instance<Node> | null;
}

const EMPTY_PROPS: Props = {};

function keyFor(key: string | null, index: number): string {
  // Namespaced so an explicit key can never collide with a positional one.
  return key === null ? `i:${index}` : `k:${key}`;
}

function assertDefined<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

export interface Renderer<Node> {
  render(element: InternalElement | null, container: Node): Instance<Node> | null;
  reconcile(
    parentHostNode: Node,
    instance: Instance<Node> | null,
    element: InternalElement | null,
  ): Instance<Node> | null;
}

export function createReconciler<Node>(host: HostConfig<Node>): Renderer<Node> {
  function createPublicInstance(element: InternalElement, internalInstance: Instance<Node>): Component {
    const { type, props } = element;
    if (typeof type === 'string') {
      throw new Error('createPublicInstance called with a host element');
    }
    const publicInstance = new type(props);
    publicInstance.__internalInstance = internalInstance;
    // How a component re-renders itself: reconcile its own subtree in place
    // against the same element, so render() re-runs with the new state.
    publicInstance.__enqueueUpdate = () => {
      const parent = host.getParent(internalInstance.hostNode);
      if (parent === null) {
        throw new Error('setState on an unmounted component');
      }
      reconcile(parent, internalInstance, internalInstance.element);
    };
    return publicInstance;
  }

  function instantiate(element: InternalElement, container: Node): Instance<Node> {
    const { type, props } = element;

    if (typeof type === 'string') {
      if (type === TEXT_ELEMENT) {
        const hostNode = host.createTextInstance(props.nodeValue || '', container);
        return { hostNode, element, key: element.key, childInstances: [], publicInstance: null, childInstance: null };
      }

      const hostNode = host.createInstance(type, props, container);
      host.commitUpdate(hostNode, EMPTY_PROPS, props);

      const childElements = props.children || [];
      const childInstances = childElements.map((child) => instantiate(child, hostNode));
      // instantiate never attaches its own node to `container` (the caller owns
      // placement); it does attach its own children, which have no other owner.
      childInstances.forEach((child) => host.appendChild(hostNode, child.hostNode));

      return { hostNode, element, key: element.key, childInstances, publicInstance: null, childInstance: null };
    }

    const instance = {} as Instance<Node>;
    const publicInstance = createPublicInstance(element, instance);
    const childElement = assertDefined(publicInstance.render(), 'A component rendered null; render an element instead');
    const childInstance = instantiate(childElement, container);

    instance.hostNode = childInstance.hostNode;
    instance.element = element;
    instance.key = element.key;
    instance.childInstances = [];
    instance.publicInstance = publicInstance;
    instance.childInstance = childInstance;
    return instance;
  }

  /** Detach an instance's subtree bottom-up so a host can pool every node. */
  function unmount(instance: Instance<Node>, parentHostNode: Node): void {
    if (instance.publicInstance) {
      if (instance.childInstance) {
        unmount(instance.childInstance, parentHostNode);
      }
      return;
    }
    instance.childInstances.forEach((child) => unmount(child, instance.hostNode));
    host.removeChild(parentHostNode, instance.hostNode);
    host.finalizeRemoval(instance.hostNode);
  }

  /**
   * The insertion anchor for a placed child: the host node of the next sibling
   * that is NOT itself being placed. Those stable siblings keep their old
   * relative order (guaranteed by the lastPlacedIndex pivot), so inserting each
   * placed node before the next stable one lands it in the right spot; null
   * means append.
   */
  function anchorAfter(children: Array<Instance<Node>>, placed: boolean[], index: number): Node | null {
    for (let j = index + 1; j < children.length; j++) {
      if (!placed[j]) {
        return children[j].hostNode;
      }
    }
    return null;
  }

  function reconcileChildren(
    parentHostNode: Node,
    instance: Instance<Node>,
    element: InternalElement,
  ): Array<Instance<Node>> {
    const oldChildInstances = instance.childInstances;
    const nextChildElements = element.props.children || [];

    // Old children indexed by key-or-position, mirroring React's map fallback.
    const oldByKey: { [k: string]: { inst: Instance<Node>; index: number } } = {};
    oldChildInstances.forEach((child, i) => {
      oldByKey[keyFor(child.key, i)] = { inst: child, index: i };
    });

    const newChildInstances: Array<Instance<Node>> = [];
    const placed: boolean[] = [];
    const reusedOld: Array<Instance<Node>> = [];
    let lastPlacedIndex = 0;

    for (let newIdx = 0; newIdx < nextChildElements.length; newIdx++) {
      const childElement = nextChildElements[newIdx];
      const lookupKey = keyFor(childElement.key, newIdx);
      const match = oldByKey[lookupKey];

      // Reuse only on key AND type; a type change unmounts and rebuilds. The
      // slot is consumed on match so duplicate keys can't reuse it twice.
      if (match && match.inst.element.type === childElement.type) {
        const prevHostNode = match.inst.hostNode;
        const reconciled = assertDefined(
          reconcile(parentHostNode, match.inst, childElement),
          'reconcile returned null for a reused child',
        );
        newChildInstances.push(reconciled);
        reusedOld.push(match.inst);
        delete oldByKey[lookupKey];

        // A reused node moves if its old slot fell behind the pivot, or if the
        // reconcile swapped its host node (a composite child changed type).
        if (match.index < lastPlacedIndex || reconciled.hostNode !== prevHostNode) {
          placed.push(true);
        } else {
          lastPlacedIndex = match.index;
          placed.push(false);
        }
      } else {
        newChildInstances.push(instantiate(childElement, parentHostNode));
        placed.push(true);
      }
    }

    // Unmount by identity, not by leftover map keys: with duplicate sibling keys
    // an old child can be evicted from the map yet never reused, and it must
    // still be torn down rather than left orphaned in the host tree.
    oldChildInstances.forEach((old) => {
      if (reusedOld.indexOf(old) === -1) {
        unmount(old, parentHostNode);
      }
    });

    // Apply placements in order; anchors reference only stable (non-placed)
    // nodes, which are already correctly ordered, so one pass suffices.
    for (let i = 0; i < newChildInstances.length; i++) {
      if (!placed[i]) {
        continue;
      }
      const node = newChildInstances[i].hostNode;
      const anchor = anchorAfter(newChildInstances, placed, i);
      if (anchor === null) {
        host.appendChild(parentHostNode, node);
      } else {
        host.insertBefore(parentHostNode, node, anchor);
      }
    }

    return newChildInstances;
  }

  function reconcile(
    parentHostNode: Node,
    instance: Instance<Node> | null,
    element: InternalElement | null,
  ): Instance<Node> | null {
    if (!instance) {
      if (!element) {
        return null;
      }
      const created = instantiate(element, parentHostNode);
      host.appendChild(parentHostNode, created.hostNode);
      return created;
    }

    if (!element) {
      unmount(instance, parentHostNode);
      return null;
    }

    if (instance.element.type !== element.type) {
      const replacement = instantiate(element, parentHostNode);
      unmount(instance, parentHostNode);
      // Default to the tail; a sibling reconcile pass repositions it if order
      // matters. Root and single-child composite swaps have no siblings.
      host.appendChild(parentHostNode, replacement.hostNode);
      return replacement;
    }

    if (typeof element.type === 'string') {
      if (element.type === TEXT_ELEMENT) {
        const prevText = instance.element.props.nodeValue || '';
        const nextText = element.props.nodeValue || '';
        if (prevText !== nextText) {
          host.commitTextUpdate(instance.hostNode, prevText, nextText);
        }
        instance.element = element;
        return instance;
      }

      host.commitUpdate(instance.hostNode, instance.element.props, element.props);
      instance.childInstances = reconcileChildren(instance.hostNode, instance, element);
      instance.element = element;
      return instance;
    }

    // Composite: feed new props through render() and reconcile the result.
    const publicInstance = assertDefined(instance.publicInstance, 'composite instance without a public instance');
    publicInstance.props = element.props;
    const childElement = publicInstance.render();
    const childInstance = reconcile(parentHostNode, instance.childInstance, childElement);
    if (!childInstance) {
      throw new Error('A mounted component rendered null; render an element instead');
    }
    instance.hostNode = childInstance.hostNode;
    instance.childInstance = childInstance;
    instance.element = element;
    return instance;
  }

  let rootInstance: Instance<Node> | null = null;

  return {
    reconcile,
    render(element, container) {
      rootInstance = reconcile(container, rootInstance, element);
      return rootInstance;
    },
  };
}
