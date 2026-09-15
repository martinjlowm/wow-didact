import { describe, expect, it } from 'bun:test';

import { mount, shapeOfNode } from '$/helpers';
import { Component } from '@/component';
import { createElement, TEXT_ELEMENT } from '@/element';

describe('element construction', () => {
  it('drops boolean and nullish children and turns strings and numbers into text', () => {
    const el = createElement('frame', {}, 'hi', 42, false, null, undefined, createElement('label', {}));
    const children = el.props.children!;
    expect(children.map((c) => c.type)).toEqual([TEXT_ELEMENT, TEXT_ELEMENT, 'label']);
    expect(children[0].props.nodeValue).toBe('hi');
    expect(children[1].props.nodeValue).toBe('42');
  });

  it('lifts key out of props so it never reaches a host setter', () => {
    const el = createElement('frame', { key: 7, width: 10 });
    expect(el.key).toBe('7');
    expect('key' in el.props).toBe(false);
    expect(el.props.width).toBe(10);
  });

  it('flattens a single array child argument', () => {
    const list = [createElement('label', {}), createElement('label', {})];
    const el = createElement('frame', {}, list);
    expect(el.props.children!.length).toBe(2);
  });
});

describe('host and text rendering', () => {
  it('renders text nodes as leaf host nodes and updates their content in place', () => {
    const harness = mount();
    harness.render(createElement('frame', {}, 'first'));
    const textNode = harness.mounted()!.children[0];
    expect(textNode.type).toBe(TEXT_ELEMENT);
    expect(textNode.text).toBe('first');

    harness.render(createElement('frame', {}, 'second'));
    expect(harness.mounted()!.children[0].id).toBe(textNode.id);
    expect(harness.mounted()!.children[0].text).toBe('second');
    expect(harness.stats.updatedText).toBeGreaterThan(0);
  });
});

class Box extends Component<{ label: string }> {
  render() {
    return createElement('frame', { title: this.props.label }, createElement('label', { text: this.props.label }));
  }
}

describe('composite components', () => {
  it('mounts a composite as the host tree it renders', () => {
    const harness = mount();
    harness.render(createElement(Box, { label: 'hello' }));
    expect(shapeOfNode(harness.mounted()!)).toEqual({
      type: 'frame',
      text: null,
      props: { title: 'hello' },
      children: [{ type: 'label', text: null, props: { text: 'hello' }, children: [] }],
    });
  });

  it('updates a composite in place when its props change', () => {
    const harness = mount();
    harness.render(createElement(Box, { label: 'a' }));
    const frameId = harness.mounted()!.id;

    harness.render(createElement(Box, { label: 'b' }));
    expect(harness.mounted()!.id).toBe(frameId);
    expect(harness.mounted()!.props.title).toBe('b');
    expect(harness.stats.created).toBe(2); // frame + label, once
  });
});

describe('setState', () => {
  it('re-renders the component subtree in place, preserving the host node', () => {
    let captured!: Counter;
    class Counter extends Component<{}, { n: number }> {
      state = { n: 0 };
      constructor(props: {}) {
        super(props);
        captured = this;
      }
      render() {
        return createElement('frame', { count: this.state.n });
      }
    }

    const harness = mount();
    harness.render(createElement(Counter, {}));
    const id = harness.mounted()!.id;
    expect(harness.mounted()!.props.count).toBe(0);

    captured.setState({ n: 5 });
    expect(harness.mounted()!.id).toBe(id);
    expect(harness.mounted()!.props.count).toBe(5);
    expect(harness.liveNodeCount()).toBe(1);
  });

  it('replaces the host node when setState changes the rendered element type', () => {
    let captured!: Swap;
    class Swap extends Component<{}, { alt: boolean }> {
      state = { alt: false };
      constructor(props: {}) {
        super(props);
        captured = this;
      }
      render() {
        return this.state.alt ? createElement('button', {}) : createElement('frame', {});
      }
    }

    const harness = mount();
    harness.render(createElement(Swap, {}));
    expect(harness.mounted()!.type).toBe('frame');
    const removedBefore = harness.stats.removed;

    captured.setState({ alt: true });
    expect(harness.mounted()!.type).toBe('button');
    expect(harness.liveNodeCount()).toBe(1);
    expect(harness.stats.removed).toBe(removedBefore + 1);
  });
});

describe('duplicate sibling keys', () => {
  it('renders the correct structure and leaks nothing even though identity is undefined', () => {
    const dup = () => {
      const el = createElement('label', {});
      el.key = 'same';
      return el;
    };
    const harness = mount();
    harness.render(createElement('frame', {}, dup(), dup(), dup()));
    expect(harness.mounted()!.children.map((c) => c.type)).toEqual(['label', 'label', 'label']);
    expect(harness.liveNodeCount()).toBe(4);

    // Re-render: structure holds and no node is orphaned in the host tree.
    harness.render(createElement('frame', {}, dup(), dup()));
    expect(harness.mounted()!.children.length).toBe(2);
    expect(harness.liveNodeCount()).toBe(3);
    expect(harness.stats.removed).toBe(harness.stats.finalized);
  });
});

describe('keyed identity', () => {
  it('follows the key, not the position, when children are reordered', () => {
    const harness = mount();
    const a = () => {
      const el = createElement('frame', { tag: 'A' });
      el.key = '1';
      return el;
    };
    const b = () => {
      const el = createElement('button', { tag: 'B' });
      el.key = '2';
      return el;
    };

    harness.render(createElement('frame', {}, a(), b()));
    const parent = harness.mounted()!;
    const idA = parent.children[0].id;
    const idB = parent.children[1].id;

    harness.render(createElement('frame', {}, b(), a()));
    const after = harness.mounted()!;
    expect(after.children[0].id).toBe(idB);
    expect(after.children[1].id).toBe(idA);
    expect(after.children.map((c) => c.props.tag)).toEqual(['B', 'A']);
  });
});
