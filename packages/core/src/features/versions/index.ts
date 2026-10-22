import type { Editor, JSONContent } from '@tiptap/core';
import type { Transaction } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';
import { defineFeature, type Feature, type FeatureController } from '../../feature.js';
import { createStore } from '../../store.js';
import { NO_WORD_COUNT } from '../../words.js';
import { diffDocs, diffSummary, type DiffBlock } from './diff.js';
import type { VersionMeta, VersionStore } from './types.js';

export { diffDocs, diffSummary, type DiffBlock, type DiffPart } from './diff.js';
export { memoryVersionStore, type MemoryVersionStoreOptions } from './memory-store.js';
export type { NewVersion, VersionMeta, VersionStore } from './types.js';

/** Transaction meta set on a restore, so other plugins can recognise (or refuse) it. */
export const VERSION_RESTORE = 'proseline:versionRestore';

export interface VersionsOptions {
  store: VersionStore;
  docId: string;
  /**
   * Take an automatic snapshot this long after the first local edit since the last snapshot.
   * Default 10 minutes; `false` turns it off. Only the writer who edited takes it.
   */
  autoSnapshotMs?: number | false;
  /** False hides saving, restoring and deleting (viewers can still browse and compare). Default true. */
  allowChanges?: boolean;
}

export interface VersionPreview extends VersionMeta {
  content: JSONContent;
  /** From this version to the current document. */
  diff: DiffBlock[];
  summary: { insertedWords: number; deletedWords: number };
}

export interface VersionsState {
  status: 'loading' | 'ready' | 'error';
  error: 'loadFailed' | 'saveFailed' | 'restoreRefused' | null;
  /** Newest first. */
  versions: VersionMeta[];
  preview: VersionPreview | null;
  /** A save, load or restore is in progress. */
  busy: boolean;
  allowed: boolean;
  /** The store can delete versions. */
  canRemove: boolean;
}

export interface VersionsCommands {
  snapshot(label?: string | null): Promise<boolean>;
  /** Loads a version for preview and comparison. */
  open(versionId: string): Promise<boolean>;
  close(): void;
  /** Saves the current text as "Before restore", then replaces the document with the version (one undoable change). */
  restore(versionId: string): Promise<boolean>;
  remove(versionId: string): Promise<boolean>;
  reload(): Promise<void>;
}

export type VersionsController = FeatureController<VersionsState, VersionsCommands>;

declare module '../../index.js' {
  interface FeatureRegistry {
    versions: VersionsController;
  }
}

const DEFAULT_AUTO_MS = 10 * 60_000;

const toDoc = (editor: Editor, content: JSONContent) => editor.schema.nodeFromJSON(content);

/**
 * Snapshots of the document in the host's VersionStore (ProseMirror JSON): named and automatic
 * snapshots, read-only preview, word-level comparison with the current text, and restore as an
 * ordinary — synced, undoable — change preceded by a "Before restore" snapshot.
 */
export const versions = (options: VersionsOptions): Feature<'versions', VersionsController> =>
  defineFeature({
    name: 'versions',
    messages: {
      en: {
        'versions.title': 'Versions', 'versions.save': 'Save version', 'versions.namePlaceholder': 'Name (optional)', 'versions.saveConfirm': 'Save',
        'versions.cancel': 'Cancel', 'versions.automatic': 'Automatic', 'versions.beforeRestore': 'Before restore', 'versions.empty': 'No versions yet.',
        'versions.preview': 'Preview', 'versions.closePreview': 'Close preview', 'versions.showVersion': 'Version', 'versions.compare': 'Compare with current',
        'versions.restore': 'Restore', 'versions.confirmRestore': 'Replace the current text with this version?', 'versions.delete': 'Delete version',
        'versions.confirmDelete': 'Delete this version?', 'versions.words.one': '{count} word', 'versions.words.other': '{count} words',
        'versions.changes': '+{inserted} / −{deleted} words since', 'versions.coAuthors': 'Others are writing here: restoring replaces their text too.',
        'versions.loadFailed': 'Versions could not be loaded.', 'versions.saveFailed': 'The version was not saved. Try again.',
        'versions.restoreRefused': 'Someone is editing part of this text. Try again when they pause.',
      },
      uk: {
        'versions.title': 'Версії', 'versions.save': 'Зберегти версію', 'versions.namePlaceholder': 'Назва (необов’язково)', 'versions.saveConfirm': 'Зберегти',
        'versions.cancel': 'Скасувати', 'versions.automatic': 'Автоматична', 'versions.beforeRestore': 'Перед відновленням', 'versions.empty': 'Версій поки немає.',
        'versions.preview': 'Переглянути', 'versions.closePreview': 'Закрити перегляд', 'versions.showVersion': 'Версія', 'versions.compare': 'Порівняти з поточною',
        'versions.restore': 'Відновити', 'versions.confirmRestore': 'Замінити поточний текст цією версією?', 'versions.delete': 'Видалити версію',
        'versions.confirmDelete': 'Видалити цю версію?', 'versions.words.one': '{count} слово', 'versions.words.few': '{count} слова', 'versions.words.many': '{count} слів', 'versions.words.other': '{count} слова',
        'versions.changes': '+{inserted} / −{deleted} слів відтоді', 'versions.coAuthors': 'Тут пишуть інші: відновлення замінить і їхній текст.',
        'versions.loadFailed': 'Не вдалося завантажити версії.', 'versions.saveFailed': 'Версію не збережено. Спробуйте ще раз.',
        'versions.restoreRefused': 'Хтось редагує частину тексту. Спробуйте, коли він зробить паузу.',
      },
      fr: {
        'versions.title': 'Versions', 'versions.save': 'Enregistrer une version', 'versions.namePlaceholder': 'Nom (facultatif)', 'versions.saveConfirm': 'Enregistrer',
        'versions.cancel': 'Annuler', 'versions.automatic': 'Automatique', 'versions.beforeRestore': 'Avant restauration', 'versions.empty': 'Aucune version.',
        'versions.preview': 'Aperçu', 'versions.closePreview': 'Fermer l’aperçu', 'versions.showVersion': 'Version', 'versions.compare': 'Comparer avec l’actuelle',
        'versions.restore': 'Restaurer', 'versions.confirmRestore': 'Remplacer le texte actuel par cette version ?', 'versions.delete': 'Supprimer la version',
        'versions.confirmDelete': 'Supprimer cette version ?', 'versions.words.one': '{count} mot', 'versions.words.many': '{count} mots', 'versions.words.other': '{count} mots',
        'versions.changes': '+{inserted} / −{deleted} mots depuis', 'versions.coAuthors': 'D’autres écrivent ici : la restauration remplace aussi leur texte.',
        'versions.loadFailed': 'Impossible de charger les versions.', 'versions.saveFailed': 'Version non enregistrée. Réessayez.',
        'versions.restoreRefused': 'Quelqu’un modifie une partie du texte. Réessayez quand il fait une pause.',
      },
    },
    controller: (ctx) => {
      const { editor, t } = ctx;
      const { store, docId } = options;
      const allowed = options.allowChanges ?? true;
      const autoMs = options.autoSnapshotMs === undefined ? DEFAULT_AUTO_MS : options.autoSnapshotMs;
      const state = createStore<VersionsState>({
        status: 'loading',
        error: null,
        versions: [],
        preview: null,
        busy: false,
        allowed,
        canRemove: allowed && !!store.remove,
      });
      let destroyed = false;
      let dirty = false;
      let autoTimer: ReturnType<typeof setTimeout> | null = null;
      const set = (patch: Partial<VersionsState>) => {
        if (!destroyed) state.setState(patch);
      };

      const load = async () => {
        try {
          set({ versions: await store.list(docId), status: 'ready', error: null });
        } catch {
          set({ status: 'error', error: 'loadFailed' });
        }
      };
      void load();
      const unsubscribe = store.subscribe?.(docId, () => void load());

      const save = async (label: string | null, auto: boolean): Promise<VersionMeta | null> => {
        try {
          const meta = await store.save(docId, { content: editor.getJSON(), label, auto, words: ctx.countDoc().words });
          dirty = false;
          set({ versions: [meta, ...state.getState().versions.filter((v) => v.id !== meta.id)], error: null });
          return meta;
        } catch {
          set({ error: 'saveFailed' });
          return null;
        }
      };

      /** The preview's comparison follows the live document. */
      const rediff = () => {
        const preview = state.getState().preview;
        if (!preview) return;
        const diff = diffDocs(toDoc(editor, preview.content), editor.state.doc);
        set({ preview: { ...preview, diff, summary: diffSummary(diff) } });
      };

      const onTransaction = ({ transaction }: { transaction: Transaction }) => {
        if (!transaction.docChanged) return;
        if (state.getState().preview) rediff();
        if (!allowed || autoMs === false || ctx.isRemote(transaction) || transaction.getMeta(VERSION_RESTORE)) return;
        dirty = true;
        if (!autoTimer) {
          autoTimer = setTimeout(() => {
            autoTimer = null;
            if (dirty && !destroyed) void save(null, true);
          }, autoMs);
        }
      };
      editor.on('transaction', onTransaction);

      return {
        getState: state.getState,
        subscribe: state.subscribe,
        commands: {
          snapshot: async (label?: string | null) => {
            if (!allowed) return false;
            set({ busy: true });
            const saved = await save(label?.trim() ? label.trim() : null, false);
            set({ busy: false });
            return saved !== null;
          },
          open: async (versionId: string) => {
            const meta = state.getState().versions.find((v) => v.id === versionId);
            if (!meta) return false;
            set({ busy: true });
            try {
              const content = await store.load(versionId);
              const diff = diffDocs(toDoc(editor, content), editor.state.doc);
              set({ preview: { ...meta, content, diff, summary: diffSummary(diff) }, busy: false, error: null });
              return true;
            } catch {
              set({ busy: false, error: 'loadFailed' });
              return false;
            }
          },
          close: () => set({ preview: null }),
          restore: async (versionId: string) => {
            if (!allowed) return false;
            set({ busy: true });
            try {
              const content = await store.load(versionId);
              const safety = await save(t('versions.beforeRestore'), true);
              if (!safety) return false;
              const before = editor.state.doc;
              const node = toDoc(editor, content);
              // Its own undo step, never merged with the edits just before it.
              const tr = closeHistory(editor.state.tr);
              tr.replaceWith(0, before.content.size, node.content).setMeta(NO_WORD_COUNT, true).setMeta(VERSION_RESTORE, true);
              editor.view.dispatch(tr);
              if (editor.state.doc === before && !before.eq(node)) {
                // Refused (e.g. a co-author holds a lock): drop the snapshot we just took for it.
                if (store.remove) {
                  await store.remove(safety.id).catch(() => undefined);
                  set({ versions: state.getState().versions.filter((v) => v.id !== safety.id) });
                }
                set({ error: 'restoreRefused' });
                return false;
              }
              set({ preview: null, error: null });
              return true;
            } catch {
              set({ error: 'saveFailed' });
              return false;
            } finally {
              set({ busy: false });
            }
          },
          remove: async (versionId: string) => {
            if (!allowed || !store.remove) return false;
            try {
              await store.remove(versionId);
              const { preview } = state.getState();
              set({ versions: state.getState().versions.filter((v) => v.id !== versionId), preview: preview?.id === versionId ? null : preview, error: null });
              return true;
            } catch {
              set({ error: 'saveFailed' });
              return false;
            }
          },
          reload: load,
        },
        destroy: () => {
          destroyed = true;
          if (autoTimer) clearTimeout(autoTimer);
          unsubscribe?.();
          editor.off('transaction', onTransaction);
        },
      };
    },
  });
