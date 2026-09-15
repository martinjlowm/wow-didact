import fc from 'fast-check';

import { createElement, createTextElement, InternalElement } from '@/element';

// Small, colliding alphabets so generated trees actually exercise reuse (same
// type) vs replace (different type) and keyed vs positional matching, rather
// than every node being unique.
const TYPES = ['frame', 'button', 'texture', 'label'];
const KEY_POOL = ['a', 'b', 'c', 'd', 'e'];
const PROP_KEYS = ['x', 'y', 'w', 'h', 'enabled'];

const propValueArb = fc.oneof(fc.integer({ min: 0, max: 9 }), fc.string({ maxLength: 4 }), fc.boolean());
const propsArb = fc.dictionary(fc.constantFrom(...PROP_KEYS), propValueArb, { maxKeys: 3 });

const textElementArb = fc.string({ maxLength: 5 }).map((value) => createTextElement(value));

function hostElementArb(childArb: fc.Arbitrary<InternalElement>, maxChildren: number): fc.Arbitrary<InternalElement> {
  const childrenArb = maxChildren === 0 ? fc.constant<InternalElement[]>([]) : fc.array(childArb, { maxLength: maxChildren });
  return fc
    .record({
      type: fc.constantFrom(...TYPES),
      key: fc.option(fc.constantFrom(...KEY_POOL), { nil: null }),
      props: propsArb,
      children: childrenArb,
    })
    .map(({ type, key, props, children }) => {
      // Enforce React's contract that sibling keys are unique: a duplicate key
      // falls back to positional matching (null), so generated trees stay valid
      // and identity-preservation properties are meaningful.
      const seen: { [k: string]: true } = {};
      for (const child of children) {
        if (child.key !== null) {
          if (seen[child.key]) {
            child.key = null;
          } else {
            seen[child.key] = true;
          }
        }
      }
      const element = createElement(type, props, ...children);
      element.key = key;
      return element;
    });
}

/** An arbitrary host/text element tree bounded by `depth`. */
export function elementArb(depth: number): fc.Arbitrary<InternalElement> {
  if (depth <= 0) {
    return fc.oneof(textElementArb, hostElementArb(fc.constant(createTextElement('')), 0));
  }
  return fc.oneof(textElementArb, hostElementArb(elementArb(depth - 1), 4));
}

/** A sequence of independent trees, to be rendered in turn into one root. */
export function treeSequenceArb(depth = 3, maxLength = 6): fc.Arbitrary<InternalElement[]> {
  return fc.array(elementArb(depth), { minLength: 1, maxLength });
}

/**
 * A parent whose children all carry distinct keys, plus a permutation of those
 * same children. Rendering the first then the second is a pure reorder, so the
 * reconciler must preserve every child's identity.
 */
export function keyedReorderArb(): fc.Arbitrary<{ before: InternalElement; after: InternalElement }> {
  return fc
    .uniqueArray(fc.constantFrom(...KEY_POOL), { minLength: 2, maxLength: KEY_POOL.length })
    .chain((keys) =>
      fc.record({
        keys: fc.constant(keys),
        types: fc.array(fc.constantFrom(...TYPES), { minLength: keys.length, maxLength: keys.length }),
        permutation: shuffleArb(keys.length),
      }),
    )
    .map(({ keys, types, permutation }) => {
      const children = keys.map((key, i) => {
        const el = createElement(types[i], { id: key });
        el.key = key;
        return el;
      });
      const before = createElement('frame', {}, ...children);
      const after = createElement('frame', {}, ...permutation.map((i) => children[i]));
      return { before, after };
    });
}

/** A permutation of [0, n) as an array of indices. */
function shuffleArb(n: number): fc.Arbitrary<number[]> {
  const indices = Array.from({ length: n }, (_, i) => i);
  return fc.shuffledSubarray(indices, { minLength: n, maxLength: n });
}
