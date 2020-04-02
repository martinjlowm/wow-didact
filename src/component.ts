import { Frame } from 'wow-classic-declarations';

import { InternalElement } from '@/element';
import { Instance, reconcile } from '@/reconciler';

function updateInstance(internalInstance: Instance): void {
  const parentDom = internalInstance.hostFrame.GetParent() as Frame;
  const element = internalInstance.element;
  if (parentDom) {
    reconcile(parentDom, internalInstance, element);
  } else {
    throw 'Tried to reconcile instance with no dom.parentDom';
  }
}

export class Component<P = {}, S = {}> {
  public state: S = {} as S;
  constructor(public props: P = {} as P) {}

  private __internalInstance!: Instance;

  setState(partialState: Partial<S>): void {
    this.state = Object.assign({}, this.state, partialState);
    updateInstance(this.__internalInstance);
  }

  render(): InternalElement | null {
    throw 'render not implemented';
  }
}
