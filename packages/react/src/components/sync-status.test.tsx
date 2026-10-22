import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { createStore, defineFeature } from '@proseline-editor/core';
import { ProselineEditor } from '../proseline-editor.js';
import { ProselineContent } from '../proseline-content.js';
import { SyncStatus } from './sync-status.js';

afterEach(cleanup);

/** Stands in for @proseline-editor/sync's collaboration feature: same name, same state shape. */
const fakeCollaboration = () => {
  const store = createStore({ status: 'synced' as string, unsent: 0, peers: [] as { clientId: number; name: string; color: string }[] });
  const feature = defineFeature({
    name: 'collaboration',
    messages: {
      en: { 'collaboration.synced': 'Saved', 'collaboration.offline': 'Offline', 'collaboration.unsent': '{count} unsent', 'collaboration.peers': 'Also here: {names}' },
    },
    controller: () => ({ getState: store.getState, subscribe: store.subscribe, commands: {} }),
  });
  return { feature, store };
};

describe('<SyncStatus>', () => {
  it('renders nothing without the collaboration feature', async () => {
    const { container } = render(
      <ProselineEditor>
        <SyncStatus />
      </ProselineEditor>,
    );
    await act(async () => {});
    expect(container.querySelector('.pl-sync')).toBeNull();
  });

  it('shows the status, unsent changes and peers', async () => {
    const { feature, store } = fakeCollaboration();
    const { container } = render(
      <ProselineEditor features={[feature]}>
        <ProselineContent />
        <SyncStatus />
      </ProselineEditor>,
    );
    await act(async () => {});
    expect(screen.getByRole('status').textContent).toBe('Saved');
    act(() => store.setState({ status: 'offline', unsent: 3, peers: [{ clientId: 2, name: 'bo', color: '#f00' }] }));
    expect(screen.getByRole('status').textContent).toBe('Offline');
    expect(screen.getByText('3 unsent')).toBeTruthy();
    expect(screen.getByLabelText('Also here: bo').textContent).toBe('B');
    expect(container.querySelector('.pl-sync')?.getAttribute('data-status')).toBe('offline');
  });
});
