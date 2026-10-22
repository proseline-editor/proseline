import type { JSONContent } from '@tiptap/core';
import type { VersionMeta, VersionStore } from './types.js';

export interface MemoryVersionStoreOptions {
  authorName?: string;
  /** Clock for timestamps (tests). */
  now?: () => Date;
}

let counter = 0;

/** An in-memory VersionStore for tests, demos and prototypes. */
export const memoryVersionStore = (options: MemoryVersionStoreOptions = {}): VersionStore => {
  const versions: { meta: VersionMeta; content: JSONContent }[] = [];
  const listeners = new Map<string, Set<() => void>>();
  const changed = (docId: string) => listeners.get(docId)?.forEach((l) => l());
  return {
    list: async (docId) => versions.filter((v) => v.meta.docId === docId).map((v) => ({ ...v.meta })).reverse(),
    save: async (docId, { content, label, auto, words }) => {
      const meta: VersionMeta = {
        id: `v-${Date.now().toString(36)}-${(++counter).toString(36)}`,
        docId,
        label,
        auto,
        words,
        createdAt: (options.now?.() ?? new Date()).toISOString(),
        ...(options.authorName ? { authorName: options.authorName } : {}),
      };
      versions.push({ meta, content: structuredClone(content) });
      changed(docId);
      return { ...meta };
    },
    load: async (versionId) => {
      const found = versions.find((v) => v.meta.id === versionId);
      if (!found) throw new Error(`No version ${versionId}`);
      return structuredClone(found.content);
    },
    remove: async (versionId) => {
      const index = versions.findIndex((v) => v.meta.id === versionId);
      if (index < 0) return;
      const [removed] = versions.splice(index, 1);
      changed(removed!.meta.docId);
    },
    subscribe: (docId, onChange) => {
      const set = listeners.get(docId) ?? new Set();
      set.add(onChange);
      listeners.set(docId, set);
      return () => {
        set.delete(onChange);
      };
    },
  };
};
