import { defineComponent, h, onScopeDispose, shallowRef } from 'vue';
import type { FeatureController, FeatureRegistry } from '@proseline-editor/core';
import { useProseline } from '../context.js';

/** The part of the collaboration feature's state this component reads (from @proseline-editor/sync). */
interface CollaborationStateLike {
  status: 'connecting' | 'synced' | 'syncing' | 'offline' | 'error' | 'local';
  unsent: number;
  peers: { clientId: number; name: string; color: string }[];
}

/**
 * Save/sync status and the other writers present. Requires the `collaboration` feature from
 * @proseline-editor/sync; renders nothing without it.
 */
export const SyncStatus = defineComponent({
  name: 'SyncStatus',
  setup() {
    const editor = useProseline();
    const controller = editor.feature('collaboration' as keyof FeatureRegistry) as FeatureController<CollaborationStateLike> | undefined;
    const state = shallowRef(controller?.getState() ?? null);
    if (controller) onScopeDispose(controller.subscribe(() => (state.value = controller.getState())));
    return () => {
      const s = state.value;
      if (!s) return null;
      const { t } = editor;
      return h('div', { class: 'pl-sync', 'data-status': s.status }, [
        h('span', { class: 'pl-sync-dot', 'aria-hidden': 'true' }),
        h('span', { role: 'status' }, t(`collaboration.${s.status}`)),
        s.unsent > 0 && s.status !== 'syncing' && h('span', { class: 'pl-sync-unsent' }, t('collaboration.unsent', { count: s.unsent })),
        s.peers.length > 0 &&
          h(
            'span',
            { class: 'pl-peers', 'aria-label': t('collaboration.peers', { names: s.peers.map((p) => p.name).join(', ') }) },
            s.peers.map((p) => h('span', { key: p.clientId, class: 'pl-peer', title: p.name, style: { backgroundColor: p.color } }, p.name.slice(0, 1).toUpperCase())),
          ),
      ]);
    };
  },
});
