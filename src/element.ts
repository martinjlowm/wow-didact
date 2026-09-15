/** @noSelfInFile */

import { Component } from '@/component';

export interface ComponentClass {
  new (props: any): Component;
}

export interface Props {
  children?: InternalElement[];
  nodeValue?: string;
  [k: string]: any;
}

export interface InternalElement {
  type: string | ComponentClass;
  props: Props;
  // Extracted out of props so it never reaches a host setter (a stray `key`
  // prop would hit WoW's SetKey and assert). Null means "position is the key".
  key: string | null;
}

export type RawChild = InternalElement | string | number | boolean | null | undefined;

export const TEXT_ELEMENT = 'TEXT_ELEMENT';

function isElement(child: RawChild): child is InternalElement {
  return child != null && typeof child === 'object' && !!(child as InternalElement).type;
}

export function createElement(
  type: string | ComponentClass,
  config?: (Props & { key?: string | number }) | null,
  ...rawChildren: Array<RawChild | RawChild[]>
): InternalElement {
  const props: Props = {};
  let key: string | null = null;

  if (config) {
    for (const name of Object.keys(config)) {
      if (name === 'key') {
        key = config.key == null ? null : `${config.key}`;
      } else if (name !== 'children') {
        props[name] = config[name];
      }
    }
  }

  // TypeScript's JSX factory emit passes children as rest arguments; a `{list}`
  // expression arrives as a single array argument, so flatten one level.
  const flattened: RawChild[] = [];
  for (const child of rawChildren) {
    if (Array.isArray(child)) {
      for (const nested of child) {
        flattened.push(nested);
      }
    } else {
      flattened.push(child);
    }
  }

  props.children = flattened
    .filter((c): c is InternalElement | string | number => {
      // Booleans and nullish are conditional-render noise (`cond && <x/>`), drop
      // them; strings and numbers become text nodes; everything else must be an
      // element or it is malformed and dropped.
      if (c == null || typeof c === 'boolean') {
        return false;
      }
      return typeof c === 'string' || typeof c === 'number' || isElement(c);
    })
    .map((c) => (isElement(c) ? c : createTextElement(`${c}`)));

  return { type, props, key };
}

export function createTextElement(value: string): InternalElement {
  return { type: TEXT_ELEMENT, props: { nodeValue: value }, key: null };
}
