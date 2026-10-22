import { computed, onScopeDispose, shallowRef, type ComputedRef } from 'vue';
import type { FeatureController, FeatureRegistry } from '@proseline-editor/core';
import { useProseline } from './context.js';

type ControllerOf<K extends keyof FeatureRegistry> = FeatureRegistry[K] & FeatureController<unknown, object>;
export type StateOf<K extends keyof FeatureRegistry> = FeatureRegistry[K] extends FeatureController<infer S, object> ? S : never;
export type CommandsOf<K extends keyof FeatureRegistry> = FeatureRegistry[K] extends FeatureController<unknown, infer C> ? C : never;

/**
 * Live state + commands of a feature (a computed ref), or null when the feature is not configured.
 * Components re-render only when the controller's state changes.
 */
export const useController = <K extends keyof FeatureRegistry>(name: K): ComputedRef<{ state: StateOf<K>; commands: CommandsOf<K> } | null> => {
  const editor = useProseline();
  const controller = editor.feature(name) as ControllerOf<K> | undefined;
  const state = shallowRef(controller?.getState());
  if (controller) onScopeDispose(controller.subscribe(() => (state.value = controller.getState())));
  return computed(() => (controller ? { state: state.value as StateOf<K>, commands: controller.commands as CommandsOf<K> } : null));
};
