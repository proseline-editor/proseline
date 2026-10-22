import { useSyncExternalStore } from 'react';
import type { FeatureController, FeatureRegistry } from '@proseline-editor/core';
import { useProseline } from '../context.js';

/** The part of the collaboration feature's state this component reads (from @proseline-editor/sync). */
interface CollaborationStateLike {
  status: 'connecting' | 'synced' | 'syncing' | 'offline' | 'error' | 'local';
  unsent: number;
  peers: { clientId: number; name: string; color: string }[];
}

export interface SyncStatusProps {
  className?: string;
}

const noopSubscribe = () => () => undefined;
const none = () => null;

/**
 * Save/sync status and the other writers present. Requires the `collaboration` feature from
 * @proseline-editor/sync; renders nothing without it.
 */
export const SyncStatus = ({ className }: SyncStatusProps) => {
  const editor = useProseline();
  const controller = editor.feature('collaboration' as keyof FeatureRegistry) as FeatureController<CollaborationStateLike> | undefined;
  const state = useSyncExternalStore(controller?.subscribe ?? noopSubscribe, controller?.getState ?? none, controller?.getState ?? none);
  if (!state) return null;
  const { t } = editor;
  return (
    <div className={['pl-sync', className].filter(Boolean).join(' ')} data-status={state.status}>
      <span className="pl-sync-dot" aria-hidden="true" />
      <span role="status">{t(`collaboration.${state.status}`)}</span>
      {state.unsent > 0 && state.status !== 'syncing' && <span className="pl-sync-unsent">{t('collaboration.unsent', { count: state.unsent })}</span>}
      {state.peers.length > 0 && (
        <span className="pl-peers" aria-label={t('collaboration.peers', { names: state.peers.map((p) => p.name).join(', ') })}>
          {state.peers.map((p) => (
            <span key={p.clientId} className="pl-peer" title={p.name} style={{ backgroundColor: p.color }}>
              {p.name.slice(0, 1).toUpperCase()}
            </span>
          ))}
        </span>
      )}
    </div>
  );
};
