import type { CommentStore, CommentThread } from '@proseline-editor/core/features';

/**
 * The example's CommentStore over its tiny REST API (comments-api.mjs). Other writers' changes are
 * picked up by polling a per-document change counter.
 */
export const restCommentStore = (base: string, author: { id: string; name: string }, pollMs = 1000): CommentStore => {
  const call = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(`${base}${path}`, { ...init, headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    return (res.status === 204 ? null : await res.json()) as T;
  };
  return {
    list: (docId) => call<CommentThread[]>(`/docs/${docId}/threads`),
    create: ({ docId, anchor, body }) => call<CommentThread>(`/docs/${docId}/threads`, { method: 'POST', body: JSON.stringify({ anchor, body, author }) }),
    reply: (threadId, body) => call<CommentThread>(`/threads/${threadId}/replies`, { method: 'POST', body: JSON.stringify({ body, author }) }),
    setResolved: async (threadId, resolved) => {
      await call(`/threads/${threadId}`, { method: 'PATCH', body: JSON.stringify({ resolved }) });
    },
    remove: async (threadId) => {
      await call(`/threads/${threadId}`, { method: 'DELETE' });
    },
    updateAnchor: async (threadId, anchor) => {
      await call(`/threads/${threadId}`, { method: 'PATCH', body: JSON.stringify({ anchor }) });
    },
    subscribe: (docId, onChange) => {
      let last: number | null = null;
      const timer = setInterval(async () => {
        try {
          const version = await call<number>(`/docs/${docId}/version`);
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
