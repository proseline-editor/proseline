import { Extension, type Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { defineFeature, type Feature, type FeatureController } from '../../feature.js';
import { createStore } from '../../store.js';
import { positionAnchoring } from './anchoring.js';
import { commentsKey, commentsPlugin, type CommentsAction, type CommentsPluginState } from './plugin.js';
import type { AnchorStrategy, CommentStore, CommentThread, Range } from './types.js';

export { positionAnchoring, findQuote, type PositionAnchor } from './anchoring.js';
export { memoryCommentStore, type MemoryComments, type MemoryCommentStoreOptions } from './memory-store.js';
export type { AnchorStrategy, Comment, CommentAnchor, CommentStore, CommentThread, NewThread, Range } from './types.js';

export interface CommentsOptions {
  store: CommentStore;
  /** Which document's threads to load. */
  docId: string;
  /** Default: position anchoring. With collaboration use `yjsAnchoring()` from @proseline-editor/sync. */
  anchoring?: AnchorStrategy;
  /** False hides commenting (threads are still shown). Default true. */
  allowComments?: boolean;
}

export interface ThreadView extends CommentThread {
  /** Where the commented text is now; null when it was deleted. */
  range: Range | null;
  orphaned: boolean;
}

export interface CommentsState {
  status: 'loading' | 'ready' | 'error';
  error: 'loadFailed' | 'saveFailed' | null;
  /** In reading order; orphaned threads last, oldest first. */
  threads: ThreadView[];
  activeId: string | null;
  /** A comment is being written for a captured selection. */
  composing: boolean;
  /** Commenting, replying, resolving and deleting are allowed (`allowComments`). */
  allowed: boolean;
  /** The selection is non-empty and commenting is allowed. */
  canComment: boolean;
}

export interface CommentsCommands {
  /** Captures the current selection for a new comment. False without a selection. */
  startComment(): boolean;
  cancelComment(): void;
  submitComment(body: string): Promise<boolean>;
  reply(threadId: string, body: string): Promise<boolean>;
  setResolved(threadId: string, resolved: boolean): Promise<boolean>;
  remove(threadId: string): Promise<boolean>;
  /** Highlights a thread and selects its text (null clears). */
  select(threadId: string | null): void;
  reload(): Promise<void>;
}

export type CommentsController = FeatureController<CommentsState, CommentsCommands>;

declare module '../../index.js' {
  interface FeatureRegistry {
    comments: CommentsController;
  }
}

const PERSIST_MS = 1000;

const pluginState = (editor: Editor): CommentsPluginState => commentsKey.getState(editor.state) as CommentsPluginState;

const dispatchAction = (editor: Editor, action: CommentsAction): void => {
  editor.view.dispatch(editor.state.tr.setMeta(commentsKey, action).setMeta('addToHistory', false));
};

const order = (threads: CommentThread[], ranges: Map<string, Range | null>): ThreadView[] => {
  const views = threads.map((t) => {
    const range = ranges.get(t.id) ?? null;
    return { ...t, range, orphaned: range === null };
  });
  const attached = views.filter((t) => t.range).sort((a, b) => a.range!.from - b.range!.from || a.createdAt.localeCompare(b.createdAt));
  const orphaned = views.filter((t) => !t.range).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return [...attached, ...orphaned];
};

/**
 * Comment threads anchored to text without touching the document: anchors live in the host's
 * store, highlights are decorations. Threads follow their text through edits, become orphaned when
 * it is deleted, and are found again by their quote when an anchor stops resolving.
 */
export const comments = (options: CommentsOptions): Feature<'comments', CommentsController> => {
  const strategy = options.anchoring ?? positionAnchoring();
  const allow = options.allowComments ?? true;
  return defineFeature({
    name: 'comments',
    extensions: [Extension.create({ name: 'proselineComments', addProseMirrorPlugins: () => [commentsPlugin(strategy)] })],
    messages: {
      en: {
        'comments.title': 'Comments', 'comments.add': 'Comment', 'comments.placeholder': 'Write a comment…', 'comments.submit': 'Comment',
        'comments.cancel': 'Cancel', 'comments.reply': 'Reply', 'comments.replyPlaceholder': 'Reply…', 'comments.resolve': 'Resolve',
        'comments.reopen': 'Reopen', 'comments.delete': 'Delete thread', 'comments.confirmDelete': 'Delete this thread?', 'comments.empty': 'No comments yet.',
        'comments.orphaned': 'Text removed', 'comments.someone': 'Someone', 'comments.selectText': 'Select text to comment on it.',
        'comments.showResolved': 'Show resolved', 'comments.loadFailed': 'Comments could not be loaded.', 'comments.saveFailed': 'The comment was not saved. Try again.',
      },
      uk: {
        'comments.title': 'Коментарі', 'comments.add': 'Коментувати', 'comments.placeholder': 'Напишіть коментар…', 'comments.submit': 'Коментувати',
        'comments.cancel': 'Скасувати', 'comments.reply': 'Відповісти', 'comments.replyPlaceholder': 'Відповідь…', 'comments.resolve': 'Вирішено',
        'comments.reopen': 'Відкрити знову', 'comments.delete': 'Видалити тред', 'comments.confirmDelete': 'Видалити цей тред?', 'comments.empty': 'Коментарів поки немає.',
        'comments.orphaned': 'Текст видалено', 'comments.someone': 'Хтось', 'comments.selectText': 'Виділіть текст, щоб прокоментувати.',
        'comments.showResolved': 'Показати вирішені', 'comments.loadFailed': 'Не вдалося завантажити коментарі.', 'comments.saveFailed': 'Коментар не збережено. Спробуйте ще раз.',
      },
      fr: {
        'comments.title': 'Commentaires', 'comments.add': 'Commenter', 'comments.placeholder': 'Écrire un commentaire…', 'comments.submit': 'Commenter',
        'comments.cancel': 'Annuler', 'comments.reply': 'Répondre', 'comments.replyPlaceholder': 'Répondre…', 'comments.resolve': 'Résoudre',
        'comments.reopen': 'Rouvrir', 'comments.delete': 'Supprimer le fil', 'comments.confirmDelete': 'Supprimer ce fil ?', 'comments.empty': 'Aucun commentaire.',
        'comments.orphaned': 'Texte supprimé', 'comments.someone': 'Quelqu’un', 'comments.selectText': 'Sélectionnez du texte pour le commenter.',
        'comments.showResolved': 'Afficher les résolus', 'comments.loadFailed': 'Impossible de charger les commentaires.', 'comments.saveFailed': 'Commentaire non enregistré. Réessayez.',
      },
    },
    controller: ({ editor }) => {
      const { store, docId } = options;
      let threads: CommentThread[] = [];
      let status: CommentsState['status'] = 'loading';
      let error: CommentsState['error'] = null;
      let composing = false;
      let destroyed = false;
      let persistTimer: ReturnType<typeof setTimeout> | null = null;

      const compute = (): CommentsState => {
        const p = pluginState(editor);
        const { from, to } = editor.state.selection;
        return {
          status,
          error,
          threads: order(threads, p.ranges),
          activeId: p.activeId,
          composing,
          allowed: allow,
          canComment: allow && from < to,
        };
      };
      const state = createStore(compute());
      const refresh = () => {
        if (!destroyed) state.setState(compute());
      };

      const pushThreads = () => {
        if (destroyed) return;
        dispatchAction(editor, { type: 'threads', threads: threads.map(({ id, anchor, resolved }) => ({ id, anchor, resolved })) });
        persistReanchored();
      };

      /** Anchors found again by their quote are saved, so the next load starts from the right place. */
      const persistReanchored = () => {
        const { reanchored } = pluginState(editor);
        if (!reanchored.size) return;
        for (const [id, anchor] of reanchored) {
          threads = threads.map((t) => (t.id === id ? { ...t, anchor } : t));
          void store.updateAnchor?.(id, anchor).catch(() => undefined);
        }
        dispatchAction(editor, { type: 'reanchoredSaved' });
      };

      /** Position anchors go stale as text moves: save the shifted ranges once edits pause. */
      const persistPositions = () => {
        if (persistTimer) clearTimeout(persistTimer);
        persistTimer = null;
        if (!strategy.persistsPositions || !store.updateAnchor) return;
        const { ranges } = pluginState(editor);
        threads = threads.map((t) => {
          const range = ranges.get(t.id);
          if (!range || (t.anchor.from === range.from && t.anchor.to === range.to)) return t;
          const anchor = strategy.create(editor.state, range);
          void store.updateAnchor?.(t.id, anchor).catch(() => undefined);
          return { ...t, anchor };
        });
      };

      const onTransaction = ({ transaction }: { transaction: { docChanged: boolean } }) => {
        persistReanchored();
        if (transaction.docChanged && strategy.persistsPositions) {
          if (persistTimer) clearTimeout(persistTimer);
          persistTimer = setTimeout(() => !destroyed && persistPositions(), PERSIST_MS);
        }
        refresh();
      };
      editor.on('transaction', onTransaction);

      const load = async () => {
        try {
          threads = await store.list(docId);
          status = 'ready';
          error = null;
        } catch {
          status = 'error';
          error = 'loadFailed';
        }
        pushThreads();
        refresh();
      };
      void load();
      const unsubscribe = store.subscribe?.(docId, () => void load());

      /** Runs a store call; on failure records `saveFailed` and resolves false. */
      const save = async (work: () => Promise<void>): Promise<boolean> => {
        try {
          await work();
          error = null;
          pushThreads();
          refresh();
          return true;
        } catch {
          error = 'saveFailed';
          refresh();
          return false;
        }
      };
      const upsert = (thread: CommentThread) => {
        threads = threads.some((t) => t.id === thread.id) ? threads.map((t) => (t.id === thread.id ? thread : t)) : [...threads, thread];
      };

      return {
        getState: state.getState,
        subscribe: state.subscribe,
        commands: {
          startComment: () => {
            const { from, to } = editor.state.selection;
            if (!allow || from >= to) return false;
            composing = true;
            dispatchAction(editor, { type: 'pending', range: { from, to } });
            return true;
          },
          cancelComment: () => {
            composing = false;
            dispatchAction(editor, { type: 'pending', range: null });
          },
          submitComment: (body: string) => {
            const range = pluginState(editor).pending;
            if (!range || !body.trim()) return Promise.resolve(false);
            return save(async () => {
              upsert(await store.create({ docId, anchor: strategy.create(editor.state, range), body: body.trim() }));
              composing = false;
              dispatchAction(editor, { type: 'pending', range: null });
            });
          },
          reply: (threadId: string, body: string) =>
            body.trim() ? save(async () => upsert(await store.reply(threadId, body.trim()))) : Promise.resolve(false),
          setResolved: (threadId: string, resolved: boolean) =>
            save(async () => {
              await store.setResolved(threadId, resolved);
              threads = threads.map((t) => (t.id === threadId ? { ...t, resolved } : t));
            }),
          remove: (threadId: string) =>
            save(async () => {
              await store.remove(threadId);
              threads = threads.filter((t) => t.id !== threadId);
            }),
          select: (threadId: string | null) => {
            const range = threadId ? pluginState(editor).ranges.get(threadId) : null;
            const tr = editor.state.tr.setMeta(commentsKey, { type: 'active', id: threadId } satisfies CommentsAction).setMeta('addToHistory', false);
            if (range) tr.setSelection(TextSelection.create(editor.state.doc, range.from, range.to)).scrollIntoView();
            editor.view.dispatch(tr);
          },
          reload: load,
        },
        destroy: () => {
          if (persistTimer) persistPositions(); // save shifted positions before going away
          destroyed = true;
          unsubscribe?.();
          editor.off('transaction', onTransaction);
        },
      };
    },
  });
};
