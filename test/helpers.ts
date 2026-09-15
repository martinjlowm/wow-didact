import { InternalElement, TEXT_ELEMENT } from '@/element';
import { createReconciler } from '@/reconciler';
import { createTestHost, TestHost, TestNode } from '@/hosts/test-host';

/** A host-tree/element-tree shape stripped to what should match: type, text,
 * own props and ordered children. Keys are deliberately excluded; they steer
 * reuse, not the resulting structure. */
export interface Shape {
  type: string;
  text: string | null;
  props: { [k: string]: unknown };
  children: Shape[];
}

function ownProps(props: { [k: string]: unknown }): { [k: string]: unknown } {
  const copy: { [k: string]: unknown } = {};
  for (const key of Object.keys(props)) {
    if (key !== 'children' && key !== 'nodeValue') {
      copy[key] = props[key];
    }
  }
  return copy;
}

/** The shape an element tree of host/text elements should render into. */
export function shapeOfElement(element: InternalElement): Shape {
  if (element.type === TEXT_ELEMENT) {
    return { type: TEXT_ELEMENT, text: element.props.nodeValue ?? '', props: {}, children: [] };
  }
  if (typeof element.type !== 'string') {
    throw new Error('shapeOfElement expects host/text elements only');
  }
  const children = element.props.children || [];
  return { type: element.type, text: null, props: ownProps(element.props), children: children.map(shapeOfElement) };
}

/** The shape an actual rendered node currently holds. */
export function shapeOfNode(node: TestNode): Shape {
  return { type: node.type, text: node.text, props: node.props, children: node.children.map(shapeOfNode) };
}

/** Number of host nodes a host/text element tree expands to. */
export function nodeCount(element: InternalElement): number {
  if (element.type === TEXT_ELEMENT) {
    return 1;
  }
  const children = element.props.children || [];
  return 1 + children.reduce((sum, child) => sum + nodeCount(child), 0);
}

export function collectIds(node: TestNode): number[] {
  const ids: number[] = [];
  const walk = (n: TestNode) => {
    for (const child of n.children) {
      ids.push(child.id);
      walk(child);
    }
  };
  walk(node);
  return ids;
}

export interface Harness extends TestHost {
  renderer: ReturnType<typeof createReconciler<TestNode>>;
  render(element: InternalElement | null): void;
  /** The single child under the root (the mounted tree), or undefined. */
  mounted(): TestNode | undefined;
}

export function mount(): Harness {
  const testHost = createTestHost();
  const renderer = createReconciler<TestNode>(testHost.host);
  return {
    ...testHost,
    renderer,
    render(element) {
      renderer.render(element, testHost.root);
    },
    mounted() {
      return testHost.root.children[0];
    },
  };
}
