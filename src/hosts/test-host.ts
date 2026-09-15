import { Props, TEXT_ELEMENT } from '@/element';
import { HostConfig } from '@/host-config';

/**
 * An in-memory rendering engine: a HostConfig backed by a plain node tree, so
 * the reconciler can be driven and its output asserted without a running game
 * client. Every node carries a stable `id` (identity survives reuse) and the
 * host records operation counts, which is what the property and fuzz suites
 * check the reconciler against.
 */
export interface TestNode {
  id: number;
  type: string;
  props: { [k: string]: unknown };
  text: string | null;
  parent: TestNode | null;
  children: TestNode[];
}

export interface HostStats {
  created: number;
  createdText: number;
  updated: number;
  updatedText: number;
  appended: number;
  inserted: number;
  removed: number;
  finalized: number;
}

export interface TestHost {
  host: HostConfig<TestNode>;
  root: TestNode;
  stats: HostStats;
  /** Live count of nodes still attached under the root (leak detector). */
  liveNodeCount(): number;
}

function propsWithoutChildren(props: Props): { [k: string]: unknown } {
  const copy: { [k: string]: unknown } = {};
  for (const key of Object.keys(props)) {
    if (key !== 'children' && key !== 'nodeValue') {
      copy[key] = props[key];
    }
  }
  return copy;
}

function detach(child: TestNode): void {
  const parent = child.parent;
  if (!parent) {
    return;
  }
  const at = parent.children.indexOf(child);
  if (at !== -1) {
    parent.children.splice(at, 1);
  }
  child.parent = null;
}

export function createTestHost(): TestHost {
  let nextId = 0;
  const stats: HostStats = {
    created: 0,
    createdText: 0,
    updated: 0,
    updatedText: 0,
    appended: 0,
    inserted: 0,
    removed: 0,
    finalized: 0,
  };

  const root: TestNode = { id: nextId++, type: '#root', props: {}, text: null, parent: null, children: [] };
  const finalized = new Set<number>();

  const host: HostConfig<TestNode> = {
    createInstance(type, _props, _container) {
      stats.created++;
      return { id: nextId++, type, props: {}, text: null, parent: null, children: [] };
    },

    createTextInstance(text, _container) {
      stats.createdText++;
      return { id: nextId++, type: TEXT_ELEMENT, props: {}, text, parent: null, children: [] };
    },

    commitUpdate(instance, _prevProps, nextProps) {
      stats.updated++;
      instance.props = propsWithoutChildren(nextProps);
    },

    commitTextUpdate(instance, _prevText, nextText) {
      stats.updatedText++;
      instance.text = nextText;
    },

    getParent(instance) {
      return instance.parent;
    },

    appendChild(parent, child) {
      stats.appended++;
      detach(child);
      parent.children.push(child);
      child.parent = parent;
    },

    insertBefore(parent, child, beforeChild) {
      stats.inserted++;
      detach(child);
      const at = parent.children.indexOf(beforeChild);
      const target = at === -1 ? parent.children.length : at;
      parent.children.splice(target, 0, child);
      child.parent = parent;
    },

    removeChild(parent, child) {
      stats.removed++;
      const at = parent.children.indexOf(child);
      if (at !== -1) {
        parent.children.splice(at, 1);
      }
      child.parent = null;
    },

    finalizeRemoval(instance) {
      stats.finalized++;
      finalized.add(instance.id);
    },
  };

  function liveNodeCount(): number {
    let count = 0;
    const walk = (node: TestNode) => {
      for (const child of node.children) {
        count++;
        walk(child);
      }
    };
    walk(root);
    return count;
  }

  return { host, root, stats, liveNodeCount };
}
