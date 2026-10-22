import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { comments, stats, typography, versions } from '@proseline-editor/core/features';
import { ProselineContent, ProselineEditor, StatsBar, SyncStatus, Toolbar } from '@proseline-editor/react';
import { collaboration, yjsAnchoring, type SyncProvider } from '@proseline-editor/sync';
import { hocuspocusProvider } from '@proseline-editor/sync-hocuspocus';
import { indexeddbPersistence } from '@proseline-editor/sync-indexeddb';
import '@proseline-editor/react/theme.css';
import { restCommentStore } from './comment-store';
import { restVersionStore } from './version-store';
import { Sidebar } from './sidebar';

const params = new URLSearchParams(window.location.search);
const room = params.get('doc') ?? 'demo';
const name = params.get('name') ?? 'Guest';
const color = params.get('color') ?? '#0f766e';
const url = params.get('server') ?? 'ws://127.0.0.1:4174';
const api = params.get('api') ?? 'http://127.0.0.1:4176';
const pollMs = Number(params.get('pollMs') ?? 1000);
const commentStore = restCommentStore(api, { id: name, name }, pollMs);
const versionStore = restVersionStore(api, name, pollMs);
// ?locks=off disables block locks; ?lockMs=1500 shortens them (used by the e2e tests).
const blockLocks = params.get('locks') === 'off' ? false : { idleMs: Number(params.get('lockMs') ?? 10_000) };

const App = () => {
  const [provider, setProvider] = useState<SyncProvider | null>(null);

  useEffect(() => {
    const p = hocuspocusProvider({ name: room, url, persistence: indexeddbPersistence() });
    let alive = true;
    // Create the editor only once there is content to show (server catch-up or local copy).
    void p.whenReady.then(() => alive && setProvider(p));
    return () => {
      alive = false;
      p.destroy();
    };
  }, []);

  if (!provider) return <p style={{ padding: '1rem' }}>Connecting…</p>;
  return (
    <ProselineEditor
      features={[
        collaboration({ provider, user: { name, color }, blockLocks }),
        comments({ store: commentStore, docId: room, anchoring: yjsAnchoring() }),
        versions({ store: versionStore, docId: room }),
        typography(),
        stats(),
      ]}
      placeholder="Write together…"
    >
      <Toolbar>
        <SyncStatus />
      </Toolbar>
      <div className="pl-columns">
        <ProselineContent />
        <Sidebar />
      </div>
      <StatsBar />
    </ProselineEditor>
  );
};

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
