import { describe, expect, it } from 'bun:test';
import fc from 'fast-check';

import { elementArb, keyedReorderArb, treeSequenceArb } from '$/arbitraries';
import { collectIds, mount, nodeCount, shapeOfElement, shapeOfNode } from '$/helpers';

describe('reconciler invariants', () => {
  it('renders a host tree structurally equal to the element tree, after every render in a sequence', () => {
    fc.assert(
      fc.property(treeSequenceArb(), (trees) => {
        const harness = mount();
        for (const tree of trees) {
          harness.render(tree);
          const node = harness.mounted();
          expect(node).toBeDefined();
          expect(shapeOfNode(node!)).toEqual(shapeOfElement(tree));
        }
      }),
    );
  });

  it('leaves exactly as many live nodes as the current tree has, never leaking across renders', () => {
    fc.assert(
      fc.property(treeSequenceArb(), (trees) => {
        const harness = mount();
        for (const tree of trees) {
          harness.render(tree);
          expect(harness.liveNodeCount()).toBe(nodeCount(tree));
        }
      }),
    );
  });

  it('re-rendering the identical tree reuses every node and creates none', () => {
    fc.assert(
      fc.property(elementArb(3), (tree) => {
        const harness = mount();
        harness.render(tree);
        const createdAfterMount = harness.stats.created + harness.stats.createdText;
        const removedAfterMount = harness.stats.removed;

        harness.render(tree);
        expect(harness.stats.created + harness.stats.createdText).toBe(createdAfterMount);
        expect(harness.stats.removed).toBe(removedAfterMount);
        expect(shapeOfNode(harness.mounted()!)).toEqual(shapeOfElement(tree));
      }),
    );
  });

  it('unmounting frees every node and finalizes each exactly once', () => {
    fc.assert(
      fc.property(elementArb(3), (tree) => {
        const harness = mount();
        harness.render(tree);
        const totalCreated = harness.stats.created + harness.stats.createdText;

        harness.render(null);
        expect(harness.liveNodeCount()).toBe(0);
        expect(harness.stats.finalized).toBe(totalCreated);
        // Every detach in the reconciler pairs removeChild with finalizeRemoval.
        expect(harness.stats.removed).toBe(harness.stats.finalized);
      }),
    );
  });

  it('a pure keyed reorder preserves every child identity and creates or removes nothing', () => {
    fc.assert(
      fc.property(keyedReorderArb(), ({ before, after }) => {
        const harness = mount();

        harness.render(before);
        const idsBefore = collectIds(harness.mounted()!);
        const created = harness.stats.created;
        const removed = harness.stats.removed;

        harness.render(after);
        const idsAfter = collectIds(harness.mounted()!);

        // No node born or destroyed: a reorder is moves only.
        expect(harness.stats.created).toBe(created);
        expect(harness.stats.removed).toBe(removed);
        // Same identities, and the final order matches the permuted element tree.
        expect([...idsAfter].sort()).toEqual([...idsBefore].sort());
        expect(shapeOfNode(harness.mounted()!)).toEqual(shapeOfElement(after));
      }),
    );
  });
});
