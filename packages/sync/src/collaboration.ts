import type { Transaction } from '@tiptap/pm/state';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import { ySyncPluginKey, yUndoPluginKey } from '@tiptap/y-tiptap';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { VERSION_RESTORE } from '@proseline-editor/core/features';
import { createStore, defineFeature, type Feature, type FeatureController } from '@proseline-editor/core';
import type { SyncProvider, SyncState } from './types.js';
import { guardStructuralMerges } from './structural-merge.js';
import { createBlockLocks, type BlockLock, type BlockLocksOptions, type LockRefusal } from './block-locks.js';

/** Yjs fragment holding the prose. WorldForge uses the same name, so its documents open unchanged. */
export const DEFAULT_FIELD = 'prosemirror';

export interface CollaborationUser {
  name: string;
  /** CSS color for this writer's caret and selection. */
  color: string;
  [key: string]: unknown;
}

export interface CollaborationOptions {
  provider: SyncProvider;
  /** Shown on this writer's caret to co-authors. Omit to hide carets entirely. */
  user?: CollaborationUser;
  field?: string;
  /** Hard per-block locks while someone edits (default on, 10 s idle). `false` disables them. */
  blockLocks?: BlockLocksOptions | false;
}

export interface Peer {
  clientId: number;
  name: string;
  color: string;
}

export interface CollaborationState extends SyncState {
  /** Other writers currently in the document. */
  peers: Peer[];
  /** Blocks other writers are editing right now (they refuse local changes). */
  locks: BlockLock[];
  /** The last local edit refused because of a lock. */
  lastRefusal: LockRefusal | null;
}

export type CollaborationController = FeatureController<CollaborationState, Record<string, never>>;

declare module '@proseline-editor/core' {
  interface FeatureRegistry {
    collaboration: CollaborationController;
  }
}

interface SyncMeta {
  isChangeOrigin?: boolean;
  isUndoRedoOperation?: boolean;
}

/** Co-authors' changes arrive through y-sync; the writer's own undo/redo does too but is local work. */
export const isRemoteYjsTransaction = (tr: Transaction): boolean => {
  const meta = tr.getMeta(ySyncPluginKey) as SyncMeta | undefined;
  return !!meta?.isChangeOrigin && !meta.isUndoRedoOperation;
};

const peersOf = (provider: SyncProvider): Peer[] => {
  const peers: Peer[] = [];
  provider.awareness.getStates().forEach((state, clientId) => {
    const user = (state as { user?: Partial<CollaborationUser> }).user;
    if (clientId !== provider.doc.clientID && user?.name) peers.push({ clientId, name: user.name, color: user.color ?? '#888' });
  });
  return peers.sort((a, b) => a.clientId - b.clientId);
};

/**
 * A co-author's caret with no text inside: the name is drawn by CSS from `data-name`. TipTap's
 * default puts the name in a text node, which leaks into the document's DOM text (textContent,
 * screen readers, the browser's find-in-page).
 */
const renderCaret = (user: Record<string, unknown>): HTMLElement => {
  const caret = document.createElement('span');
  caret.className = 'collaboration-carets__caret';
  caret.setAttribute('data-name', String(user.name ?? ''));
  caret.style.setProperty('--pl-caret-color', String(user.color ?? '#888'));
  return caret;
};

/**
 * A version restore is its own undo step: Yjs' UndoManager would merge it with edits made within
 * its capture window. Stop capturing just before the restore is written and again right after.
 */
const restoreUndoBoundary = Extension.create({
  name: 'proselineRestoreUndoBoundary',
  addProseMirrorPlugins: () => {
    let pending = false;
    return [
      new Plugin({
        key: new PluginKey('proselineRestoreUndoBoundary'),
        filterTransaction: (tr, state) => {
          if (tr.getMeta(VERSION_RESTORE)) {
            yUndoPluginKey.getState(state)?.undoManager.stopCapturing();
            pending = true;
          }
          return true;
        },
        // Plugin views update in order, so y-sync has written the restore by now.
        view: () => ({
          update: (view) => {
            if (!pending) return;
            pending = false;
            yUndoPluginKey.getState(view.state)?.undoManager.stopCapturing();
          },
        }),
      }),
    ];
  },
});

const samePeers = (a: Peer[], b: Peer[]): boolean =>
  a.length === b.length && a.every((p, i) => p.clientId === b[i]?.clientId && p.name === b[i]?.name && p.color === b[i]?.color);

/**
 * Real-time co-editing over any SyncProvider: binds the editor to the Y.Doc, shows co-authors'
 * carets, scopes undo to the local writer, and turns the editor read-only when the provider loses
 * write access. Create the editor after `provider.whenReady`.
 */
export const collaboration = ({ provider, user, field = DEFAULT_FIELD, blockLocks }: CollaborationOptions): Feature<'collaboration', CollaborationController> => {
  // Locks need the translated label and the editor's editability, which only the controller knows.
  let label = (name: string) => `${name} is editing`;
  let canClaim = () => !provider.getState().readOnly;
  const locks =
    blockLocks === false
      ? null
      : createBlockLocks(provider.awareness, { ...blockLocks, label: (name) => label(name), canClaim: () => canClaim() });
  return defineFeature({
    name: 'collaboration',
    providesHistory: true,
    isRemoteTransaction: isRemoteYjsTransaction,
    extensions: [
      Collaboration.configure({ document: provider.doc, field }),
      ...(user ? [CollaborationCaret.configure({ provider: { awareness: provider.awareness }, user, render: renderCaret })] : []),
      ...(locks ? [locks.extension] : []),
      restoreUndoBoundary,
    ],
    messages: {
      en: {
        'collaboration.connecting': 'Connecting…', 'collaboration.synced': 'Saved', 'collaboration.syncing': 'Saving…',
        'collaboration.offline': 'Offline — changes are kept', 'collaboration.error': 'Read-only — no edit access',
        'collaboration.local': 'Saved on this device', 'collaboration.unsent': '{count} unsent', 'collaboration.peers': 'Also here: {names}',
        'collaboration.lockedBy': '{name} is editing',
      },
      uk: {
        'collaboration.connecting': 'Підключення…', 'collaboration.synced': 'Збережено', 'collaboration.syncing': 'Збереження…',
        'collaboration.offline': 'Офлайн — зміни збережено локально', 'collaboration.error': 'Лише читання — немає права редагувати',
        'collaboration.local': 'Збережено на цьому пристрої', 'collaboration.unsent': 'Не надіслано: {count}', 'collaboration.peers': 'Також тут: {names}',
        'collaboration.lockedBy': '{name} редагує',
      },
      fr: {
        'collaboration.connecting': 'Connexion…', 'collaboration.synced': 'Enregistré', 'collaboration.syncing': 'Enregistrement…',
        'collaboration.offline': 'Hors ligne — modifications conservées', 'collaboration.error': 'Lecture seule — pas de droit d’édition',
        'collaboration.local': 'Enregistré sur cet appareil', 'collaboration.unsent': '{count} non envoyées', 'collaboration.peers': 'Aussi présents : {names}',
        'collaboration.lockedBy': '{name} modifie',
      },
    },
    controller: ({ editor, t }) => {
      label = (name) => t('collaboration.lockedBy', { name });
      canClaim = () => !provider.getState().readOnly && editor.isEditable;
      const compute = (): CollaborationState => ({
        ...provider.getState(),
        peers: peersOf(provider),
        locks: locks?.getLocks() ?? [],
        lastRefusal: locks?.getLastRefusal() ?? null,
      });
      const store = createStore(compute());
      const update = () => {
        const next = compute();
        const prev = store.getState();
        store.setState(samePeers(prev.peers, next.peers) ? { ...next, peers: prev.peers } : next);
        if (next.readOnly && editor.isEditable) editor.setEditable(false);
      };
      update();
      const stopGuard = guardStructuralMerges(provider.doc);
      const offProvider = provider.subscribe(update);
      const offLocks = locks?.subscribe(update);
      provider.awareness.on('change', update);
      return {
        getState: store.getState,
        subscribe: store.subscribe,
        commands: {},
        destroy: () => {
          stopGuard();
          offProvider();
          offLocks?.();
          locks?.destroy();
          provider.awareness.off('change', update);
        },
      };
    },
  });
};
