import { useMemo, useSyncExternalStore } from 'react';
import type { FeatureController, FeatureRegistry } from '@proseline-editor/core';
import { useProseline } from './context.js';

type ControllerOf<K extends keyof FeatureRegistry> = FeatureRegistry[K] & FeatureController<unknown, object>;
export type StateOf<K extends keyof FeatureRegistry> = FeatureRegistry[K] extends FeatureController<infer S, object> ? S : never;
export type CommandsOf<K extends keyof FeatureRegistry> = FeatureRegistry[K] extends FeatureController<unknown, infer C> ? C : never;

const noopSubscribe = () => () => undefined;
const noState = () => undefined;

/**
 * Live state + commands of a feature, or null when the feature is not configured.
 * Re-renders only when the controller's state changes.
 */
export const useController = <K extends keyof FeatureRegistry>(
  name: K,
): { state: StateOf<K>; commands: CommandsOf<K> } | null => {
  const editor = useProseline();
  const controller = editor.feature(name) as ControllerOf<K> | undefined;
  const state = useSyncExternalStore(controller?.subscribe ?? noopSubscribe, controller?.getState ?? noState, controller?.getState ?? noState);
  return useMemo(
    () => (controller ? { state: state as StateOf<K>, commands: controller.commands as CommandsOf<K> } : null),
    [controller, state],
  );
};
