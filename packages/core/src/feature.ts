import type { AnyExtension, Editor } from '@tiptap/core';
import type { Transaction } from '@tiptap/pm/state';
import { createStore, type ReadableStore } from './store.js';
import type { Locale, MessageBundles, Translator } from './i18n.js';
import type { DocCounts } from './words.js';

/** What a feature exposes to hosts and UI adapters: observable state + commands. */
export interface FeatureController<S = unknown, C extends object = object> extends ReadableStore<S> {
  readonly commands: C;
  destroy?(): void;
}

/** Events every editor emits. Features may add their own via declaration merging. */
export interface ProselineEvents {
  /** Debounced document change (see `changeDebounceMs`). */
  change: { html: string };
  /** Word delta of one of the local writer's own typing transactions (not paste, not tagged changes). */
  wordsTyped: { delta: number };
}

export interface FeatureContext {
  /** The underlying TipTap editor. */
  readonly editor: Editor;
  readonly t: Translator;
  /** Counts the current document with the editor's shared incremental counter. */
  countDoc(): DocCounts;
  /** True when a feature marks `tr` as not the local writer's work (co-authors' changes). */
  isRemote(tr: Transaction): boolean;
  on<E extends keyof ProselineEvents>(event: E, handler: (payload: ProselineEvents[E]) => void): () => void;
}

/** What a feature knows before the editor exists. */
export interface FeatureEnv {
  readonly locale: Locale;
}

export interface Feature<N extends string = string, C extends FeatureController<unknown, object> = FeatureController<unknown, object>> {
  readonly name: N;
  /** TipTap extensions installed before the editor is created (a function when they depend on the locale). */
  readonly extensions?: AnyExtension[] | ((env: FeatureEnv) => AnyExtension[]);
  /** UI strings for this feature, per locale. Hosts override them via `messages`. */
  readonly messages?: MessageBundles;
  /** Built once the editor exists. */
  readonly controller?: (ctx: FeatureContext) => C;
  /** True when the feature brings its own undo/redo (e.g. collaboration), so the built-in history is left out. */
  readonly providesHistory?: boolean;
  /** Marks transactions that are not the local writer's work (e.g. co-authors' changes), so they don't count as typed words. */
  readonly isRemoteTransaction?: (tr: Transaction) => boolean;
}

export type AnyFeature = Feature<string, FeatureController<unknown, object>>;

/** Identity helper that keeps the feature's literal name and controller type. */
export const defineFeature = <N extends string, C extends FeatureController<unknown, object>>(
  feature: Feature<N, C>,
): Feature<N, C> => feature;

/**
 * Controller whose state is derived from the editor: recomputed after every transaction and on
 * editability changes; subscribers are notified only when a field actually changed. `refresh()`
 * recomputes on demand, for state that lives outside the editor (e.g. a goal set by a command).
 */
export const createEditorController = <S extends object, C extends object>(
  editor: Editor,
  compute: () => S,
  commands: C,
): FeatureController<S, C> & { destroy(): void; refresh(): void } => {
  const store = createStore(compute());
  const update = () => store.setState(compute());
  editor.on('transaction', update);
  editor.on('update', update);
  return {
    getState: store.getState,
    subscribe: store.subscribe,
    commands,
    refresh: update,
    destroy: () => {
      editor.off('transaction', update);
      editor.off('update', update);
    },
  };
};
