import type { JSONContent } from '@tiptap/core';
import type { VersionMeta, VersionStore } from '@proseline-editor/core/features';

/** The example's VersionStore over its REST API (example-api.mjs), with change polling. */
export const restVersionStore = (base: string, authorName: string, pollMs = 1000): VersionStore => {
  const call = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(`${base}${path}`, { ...init, headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    return (res.status === 204 ? null : await res.json()) as T;
  };
  return {
    list: (docId) => call<VersionMeta[]>(`/docs/${docId}/versions`),
    save: (docId, version) => call<VersionMeta>(`/docs/${docId}/versions`, { method: 'POST', body: JSON.stringify({ ...version, authorName }) }),
    load: (versionId) => call<JSONContent>(`/versions/${versionId}`),
    remove: async (versionId) => {
      await call(`/versions/${versionId}`, { method: 'DELETE' });
    },
    subscribe: (docId, onChange) => {
      let last: number | null = null;
      const timer = setInterval(async () => {
        try {
          const version = await call<number>(`/docs/${docId}/versions-version`);
          if (last !== null && version !== last) onChange();
          last = version;
        } catch {
          // offline: try again on the next tick
        }
      }, pollMs);
      return () => clearInterval(timer);
    },
  };
};
