import { Component } from '@/component';
import { createElement, InternalElement } from '@/element';
import { wowHost } from '@/hosts/wow-host';
import { createReconciler } from '@/reconciler';

// The in-game renderer: the reconciler bound to the WoW host. Tests build their
// own renderer over the in-memory host instead of touching this one.
const wowRenderer = createReconciler(wowHost);

export function render(element: InternalElement, container: import('wow-classic-declarations').Region): void {
  wowRenderer.render(element, container);
}

export default { createElement, Component, render };

export { createElement, Component, render };
