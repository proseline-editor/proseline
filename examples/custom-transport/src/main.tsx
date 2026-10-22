import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { stats, typography } from '@proseline-editor/core/features';
import { ProselineContent, ProselineEditor, StatsBar, SyncStatus, Toolbar } from '@proseline-editor/react';
import { collaboration, createSyncProvider, type SyncProvider } from '@proseline-editor/sync';
import { indexeddbPersistence } from '@proseline-editor/sync-indexeddb';
import '@proseline-editor/react/theme.css';
import { restSseTransport } from './transport';

const params = new URLSearchParams(window.location.search);
const docId = params.get('doc') ?? 'demo';
const name = params.get('name') ?? 'Guest';
const color = params.get('color') ?? '#0f766e';
// writer | viewer (read-only by design) | revoked (thinks it can write; the server refuses).
const role = params.get('role') ?? 'writer';
const server = params.get('server') ?? 'http://127.0.0.1:4180';
// ?locks=off lets two writers type into the same paragraph at once (the e2e tests use it).
const blockLocks = params.get('locks') === 'off' ? false : undefined;

const App = () => {
  const [provider, setProvider] = useState<SyncProvider | null>(null);

  useEffect(() => {
    const p = createSyncProvider({
      docId,
      transport: restSseTransport({ server, docId, role }),
      persistence: indexeddbPersistence(),
      canWrite: role !== 'viewer',
    });
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
    <ProselineEditor features={[collaboration({ provider, user: { name, color }, blockLocks }), typography(), stats()]} placeholder="Write together…">
      <Toolbar>
        <SyncStatus />
      </Toolbar>
      <ProselineContent />
      <StatsBar />
    </ProselineEditor>
  );
};

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
