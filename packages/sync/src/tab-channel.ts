export interface TabChannel {
  post(update: Uint8Array): void;
  close(): void;
}

/**
 * Relays a document's local updates between tabs of the same origin, so tabs converge instantly —
 * even offline. Each tab still posts only its own changes to the server.
 */
export const createTabChannel = (name: string, onUpdate: (update: Uint8Array) => void): TabChannel => {
  if (typeof BroadcastChannel === 'undefined') return { post: () => undefined, close: () => undefined };
  const channel = new BroadcastChannel(name);
  channel.onmessage = (event: MessageEvent<unknown>) => {
    if (event.data instanceof Uint8Array) onUpdate(event.data);
  };
  return {
    post: (update) => channel.postMessage(update),
    close: () => channel.close(),
  };
};
