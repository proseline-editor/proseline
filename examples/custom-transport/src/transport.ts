import { ForbiddenError, customTransport, type SyncTransport } from '@proseline-editor/sync';

const toBase64 = (bytes: Uint8Array) => btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

export interface RestSseOptions {
  /** e.g. `http://127.0.0.1:4180` */
  server: string;
  docId: string;
  /** Sent as a header; a real app sends its session token instead. */
  role: string;
}

/**
 * A `SyncTransport` for the example server: fetch for catch-up and saves, an EventSource for live
 * updates. This is all a backend has to provide; the provider handles batching, retries, offline
 * queues and read-only switching.
 */
export const restSseTransport = ({ server, docId, role }: RestSseOptions): SyncTransport => {
  const base = `${server}/docs/${encodeURIComponent(docId)}`;
  const headers = { 'Content-Type': 'application/octet-stream', 'X-Role': role };
  return customTransport({
    fetchDiff: async (stateVector) => {
      const res = await fetch(`${base}/diff?sv=${encodeURIComponent(toBase64(stateVector))}`, { headers: { 'X-Role': role } });
      if (!res.ok) throw new Error(`catch-up failed: ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    },
    postUpdate: async (update) => {
      const res = await fetch(`${base}/updates`, { method: 'POST', headers, body: update as Uint8Array<ArrayBuffer> });
      if (res.status === 403) throw new ForbiddenError();
      if (!res.ok) throw new Error(`save failed: ${res.status}`);
    },
    subscribe: (handlers) => {
      const events = new EventSource(`${base}/events`);
      events.onopen = () => handlers.onStatus(true);
      events.onerror = () => handlers.onStatus(false);
      events.addEventListener('update', (e) => handlers.onUpdate(fromBase64((e as MessageEvent<string>).data)));
      events.addEventListener('awareness', (e) => handlers.onAwareness(fromBase64((e as MessageEvent<string>).data)));
      return () => events.close();
    },
    sendAwareness: (update) => {
      void fetch(`${base}/awareness`, { method: 'POST', headers, body: update as Uint8Array<ArrayBuffer> }).catch(() => undefined);
    },
  });
};
