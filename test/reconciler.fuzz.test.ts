import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { elementArb, treeSequenceArb } from '$/arbitraries';
import { mount, nodeCount, shapeOfElement, shapeOfNode } from '$/helpers';
import { createElement, InternalElement } from '@/element';

const KEYS = ['a', 'b', 'c', 'd', 'e', 'f'];

function keyedChild(key: string): InternalElement {
  const el = createElement('frame', { id: key }, createElement('label', {}));
  el.key = key;
  return el;
}

describe('reconciler fuzzing', () => {
  it('holds every invariant across long random render sequences', () => {
    fc.assert(
      fc.property(treeSequenceArb(4, 12), (trees) => {
        const harness = mount();
        for (const tree of trees) {
          harness.render(tree);
          // Structure matches the element tree.
          expect(shapeOfNode(harness.mounted()!)).toEqual(shapeOfElement(tree));
          // No leaks.
          expect(harness.liveNodeCount()).toBe(nodeCount(tree));
          // Every host removal is finalized: no node is orphaned live nor
          // finalized while still attached.
          expect(harness.stats.removed).toBe(harness.stats.finalized);
        }
      }),
      { numRuns: 500 },
    );
  });

  it('prepending a keyed child creates only the new subtree, never re-creating the shifted siblings', () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.constantFrom(...KEYS), { minLength: 1, maxLength: KEYS.length }), (keys) => {
        const harness = mount();

        const initial = createElement('frame', {}, ...keys.map(keyedChild));
        harness.render(initial);
        const createdAfterMount = harness.stats.created;
        const removedAfterMount = harness.stats.removed;

        // Prepend a brand-new keyed child; the existing keys all shift by one
        // index. An index-based reconciler would rebuild all of them.
        const fresh = keyedChild('__new__');
        const grown = createElement('frame', {}, fresh, ...keys.map(keyedChild));
        harness.render(grown);

        // The new child is one frame + one label => two host nodes. Nothing else
        // is created and nothing is removed.
        expect(harness.stats.created - createdAfterMount).toBe(2);
        expect(harness.stats.removed).toBe(removedAfterMount);
        expect(shapeOfNode(harness.mounted()!)).toEqual(shapeOfElement(grown));
      }),
      { numRuns: 200 },
    );
  });

  it('removing a keyed child from the middle drops only that subtree', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.constantFrom(...KEYS), { minLength: 2, maxLength: KEYS.length }),
        fc.nat(),
        (keys, dropSeed) => {
          const harness = mount();
          harness.render(createElement('frame', {}, ...keys.map(keyedChild)));
          const createdAfterMount = harness.stats.created;

          const dropAt = dropSeed % keys.length;
          const remaining = keys.filter((_, i) => i !== dropAt);
          harness.render(createElement('frame', {}, ...remaining.map(keyedChild)));

          // Nothing new created; exactly the dropped frame + its label removed.
          expect(harness.stats.created).toBe(createdAfterMount);
          expect(harness.liveNodeCount()).toBe(1 + remaining.length * 2);
          expect(harness.stats.removed).toBe(harness.stats.finalized);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('an element type change at a fixed slot replaces exactly that node', () => {
    fc.assert(
      fc.property(elementArb(2), elementArb(2), (a, b) => {
        const harness = mount();
        harness.render(a);
        harness.render(b);
        expect(shapeOfNode(harness.mounted()!)).toEqual(shapeOfElement(b));
        expect(harness.liveNodeCount()).toBe(nodeCount(b));
        expect(harness.stats.removed).toBe(harness.stats.finalized);
      }),
      { numRuns: 300 },
    );
  });
});
