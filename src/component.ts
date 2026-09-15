import { InternalElement } from '@/element';

/**
 * Base class for composite components. It carries no host knowledge; the
 * reconciler injects `__enqueueUpdate` when it instantiates the component, and
 * that closure re-reconciles the component's own subtree. Keeping the class
 * host-agnostic is what lets the same component render in-game and in tests.
 */
export class Component<P = {}, S = {}> {
  public state: S = {} as S;

  constructor(public props: P = {} as P) {}

  // Set by the reconciler at instantiation; unset until mounted.
  public __internalInstance?: unknown;
  public __enqueueUpdate?: () => void;

  setState(partialState: Partial<S>): void {
    this.state = Object.assign({}, this.state, partialState);
    if (this.__enqueueUpdate) {
      this.__enqueueUpdate();
    }
  }

  render(): InternalElement | null {
    throw new Error('render not implemented');
  }
}
