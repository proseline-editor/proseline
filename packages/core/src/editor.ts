import { Editor, type AnyExtension, type Content, type JSONContent } from '@tiptap/core';
import { proseExtensions } from './schema/extensions.js';
import { createTranslator, type Locale, type Messages, type Translator } from './i18n.js';
import { createEmitter } from './events.js';
import { coreMessages } from './locales.js';
import { createDocCounter, isTypingTransaction, type DocCounts } from './words.js';
import type { AnyFeature, FeatureContext, FeatureController, ProselineEvents } from './feature.js';
import type { FeatureRegistry } from './index.js';

export interface ProselineConfig {
  /** Mount point. Omit when a UI adapter places the editor (React/Vue): it starts in a detached element. */
  element?: HTMLElement;
  /** Initial document: HTML or ProseMirror JSON. */
  content?: Content;
  editable?: boolean;
  locale?: Locale;
  /** Overrides for any UI string in the current locale. */
  messages?: Messages;
  placeholder?: string;
  features?: AnyFeature[];
  /** Extra TipTap extensions, installed after the prose schema and features. */
  extensions?: AnyExtension[];
  /** Called with the editor after changes settle (see `changeDebounceMs`). */
  onChange?: (editor: ProselineEditor) => void;
  /** Debounce for `onChange` and the `change` event. Default 500 ms. */
  changeDebounceMs?: number;
  /** Receives errors thrown by event handlers and controllers. Default: rethrown asynchronously. */
  onError?: (error: unknown) => void;
}

export interface ProselineEditor {
  /** Escape hatch: the underlying TipTap editor. */
  readonly tiptap: Editor;
  readonly t: Translator;
  readonly locale: Locale;
  readonly isEditable: boolean;
  /** The controller of an enabled feature, or undefined when the feature is not configured. */
  feature<K extends keyof FeatureRegistry>(name: K): FeatureRegistry[K] | undefined;
  hasFeature(name: string): boolean;
  on<E extends keyof ProselineEvents>(event: E, handler: (payload: ProselineEvents[E]) => void): () => void;
  getHTML(): string;
  getJSON(): JSONContent;
  getText(): string;
  countDoc(): DocCounts;
  setEditable(editable: boolean): void;
  /** Flushes a pending change notification, then tears everything down. */
  destroy(): void;
}

const rethrowAsync = (error: unknown): void => {
  setTimeout(() => {
    throw error;
  });
};

export const createEditor = (config: ProselineConfig = {}): ProselineEditor => {
  const features = config.features ?? [];
  const seen = new Set<string>();
  for (const feature of features) {
    if (seen.has(feature.name)) throw new Error(`Proseline: feature "${feature.name}" is configured twice`);
    seen.add(feature.name);
  }

  const locale = config.locale ?? 'en';
  const onError = config.onError ?? rethrowAsync;
  const t = createTranslator(locale, [
    coreMessages,
    ...features.map((f) => f.messages ?? {}),
    config.messages ? { [locale]: config.messages } : {},
  ]);
  const emitter = createEmitter<ProselineEvents>(onError);
  const counter = createDocCounter();

  const tiptap = new Editor({
    // Without an element TipTap mounts into a detached <div> that UI adapters adopt (EditorContent).
    // Passing `element: null` would skip creating the view entirely.
    ...(config.element ? { element: config.element } : {}),
    content: config.content ?? '',
    editable: config.editable ?? true,
    extensions: [
      ...proseExtensions({ placeholder: config.placeholder, history: !features.some((f) => f.providesHistory) }),
      ...features.flatMap((f) => (typeof f.extensions === 'function' ? f.extensions({ locale }) : (f.extensions ?? []))),
      ...(config.extensions ?? []),
    ],
  });

  const remoteChecks = features.flatMap((f) => (f.isRemoteTransaction ? [f.isRemoteTransaction] : []));
  const ctx: FeatureContext = {
    editor: tiptap,
    t,
    countDoc: () => counter(tiptap.state.doc),
    isRemote: (tr) => remoteChecks.some((isRemote) => isRemote(tr)),
    on: (event, handler) => emitter.on(event, handler),
  };
  const controllers = new Map<string, FeatureController<unknown, object>>();
  for (const feature of features) {
    if (feature.controller) controllers.set(feature.name, feature.controller(ctx));
  }

  tiptap.on('transaction', ({ transaction }) => {
    if (!isTypingTransaction(transaction) || ctx.isRemote(transaction)) return;
    const delta = counter(transaction.doc).words - counter(transaction.before).words;
    if (delta !== 0) emitter.emit('wordsTyped', { delta });
  });

  let changeTimer: ReturnType<typeof setTimeout> | null = null;
  const notifyChange = () => {
    changeTimer = null;
    try {
      config.onChange?.(editor);
    } catch (error) {
      onError(error);
    }
    emitter.emit('change', { html: tiptap.getHTML() });
  };
  tiptap.on('update', ({ transaction }) => {
    if (!transaction.docChanged) return; // setEditable() also emits 'update'
    if (changeTimer) clearTimeout(changeTimer);
    changeTimer = setTimeout(notifyChange, config.changeDebounceMs ?? 500);
  });

  let destroyed = false;
  const editor: ProselineEditor = {
    tiptap,
    t,
    locale,
    get isEditable() {
      return tiptap.isEditable;
    },
    feature: (name) => controllers.get(name as string) as FeatureRegistry[typeof name] | undefined,
    hasFeature: (name) => seen.has(name),
    on: (event, handler) => emitter.on(event, handler),
    getHTML: () => tiptap.getHTML(),
    getJSON: () => tiptap.getJSON(),
    getText: () => tiptap.getText(),
    countDoc: ctx.countDoc,
    setEditable: (editable) => tiptap.setEditable(editable),
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      if (changeTimer) {
        clearTimeout(changeTimer);
        notifyChange();
      }
      controllers.forEach((c) => c.destroy?.());
      controllers.clear();
      emitter.clear();
      tiptap.destroy();
    },
  };
  return editor;
};
