import { Frame, Layer, Region } from 'wow-classic-declarations';

import { Props } from '@/element';
import { HostConfig } from '@/host-config';
import { cleanupFrame, createFrame, updateFrameProperties } from '@/wow-utils';

/**
 * The in-game HostConfig. WoW positions frames by anchor points rather than by
 * child order, so append and insertBefore collapse to reparent-and-show; the
 * value the reconciler adds here is keyed reuse, which keeps a frame's identity
 * across renders instead of leaking a fresh (uncollectable) frame per update.
 */
export const wowHost: HostConfig<Region> = {
  createInstance(type, props, container) {
    return createFrame(type, container, props as any);
  },

  createTextInstance(text, container) {
    const fontString = (container as Frame).CreateFontString(undefined, 'ARTWORK' as Layer);
    fontString.SetText(text);
    return fontString;
  },

  commitUpdate(instance, prevProps: Props, nextProps: Props) {
    updateFrameProperties(instance, prevProps as any, nextProps as any);
  },

  commitTextUpdate(instance, _prevText, nextText) {
    (instance as any).SetText(nextText);
  },

  getParent(instance) {
    return (instance.GetParent() as Region | null) || null;
  },

  appendChild(parent, child) {
    child.SetParent(parent as Frame);
    child.Show();
  },

  insertBefore(parent, child, _beforeChild) {
    // Order is anchor-driven in WoW, so a move is just a reparent; the reconciler
    // still preserves the frame, which is the point.
    child.SetParent(parent as Frame);
    child.Show();
  },

  removeChild(_parent, child) {
    child.Hide();
  },

  finalizeRemoval(instance) {
    cleanupFrame(instance);
  },
};
