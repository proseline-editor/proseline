# Collaboration

```bash
pnpm add @proseline-editor/sync yjs
```

The `collaboration` feature binds the editor to a **sync provider**. The provider keeps a Yjs document in step with your
server and with local storage, so writing continues offline and nothing typed is lost.

## With Hocuspocus

```tsx
import { collaboration } from '@proseline-editor/sync';
import { hocuspocusProvider } from '@proseline-editor/sync-hocuspocus';
import { indexeddbPersistence } from '@proseline-editor/sync-indexeddb';
import { SyncStatus } from '@proseline-editor/react';

const provider = hocuspocusProvider({ name: 'chapter-1', url: 'wss://sync.example.com', persistence: indexeddbPersistence() });
await provider.whenReady; // create the editor once there is content (server or local copy)

<ProselineEditor features={[collaboration({ provider, user: { name: 'Ann', color: '#0f766e' } }), stats()]}>
  <Toolbar><SyncStatus /></Toolbar>
  <ProselineContent />
</ProselineEditor>
```

## With your own backend

A backend implements four functions, the `SyncTransport`:

| Function | Does |
|---|---|
| `fetchDiff(stateVector)` | Returns the Yjs update the server has that the client lacks |
| `postUpdate(update)` | Stores one update; throws `ForbiddenError` when the user may not write |
| `subscribe(handlers)` | Calls `onUpdate`, `onAwareness` and `onStatus` from your live channel; returns an unsubscribe |
| `sendAwareness(update)` | Relays presence (carets, names) |

```ts
import { createSyncProvider, customTransport } from '@proseline-editor/sync';

const provider = createSyncProvider({ docId, transport: customTransport({ fetchDiff, postUpdate, subscribe, sendAwareness }), persistence: indexeddbPersistence() });
```

The provider batches and retries posts, stores every unsent change locally before sending it, catches up after a
missed broadcast, mirrors tabs, and switches to read-only when the server refuses writes. On the server,
`@proseline-editor/sync/server` validates updates (`isValidUpdate`), merges them (`mergeUpdates`), answers catch-ups
(`diffForStateVector`) and converts Yjs to JSON or HTML (`deriveJSON`, `deriveHtml`). The
[custom-transport example](https://github.com/proseline-editor/proseline/tree/main/examples/custom-transport) is a
complete REST + Server-Sent Events backend in one small file.

## What happens with concurrent edits

- Typing in different places merges as you would expect (Yjs).
- **Structural edits** (paragraph → heading, wrapping in a quote) are delete + re-create in the ProseMirror ↔ Yjs
  binding, which on its own could drop a co-author's concurrent typing. The collaboration feature repairs it on the
  affected writer's client, and identical concurrent changes collapse into one.
- **Block locks**: while someone edits a paragraph, it is locked for everyone else ("Ann is editing"); the lock lapses
  after 10 s without edits, when the writer moves on, or leaves. Configure with `blockLocks: { idleMs }`, or turn it
  off with `blockLocks: false`.

`<SyncStatus>` shows Saved / Saving / Offline / Read-only and who else is here.
