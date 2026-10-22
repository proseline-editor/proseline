import { defineComponent, h, ref } from 'vue';
import { CommentsRail, StylePanel, VersionsPanel, useProseline } from '@proseline-editor/vue';

/** The example's side panel: comments, versions and style behind tabs. */
export const Sidebar = defineComponent({
  name: 'Sidebar',
  setup() {
    const { t } = useProseline();
    const tab = ref<'comments' | 'versions' | 'style'>('comments');
    const tabButton = (id: typeof tab.value, label: string) =>
      h('button', { type: 'button', role: 'tab', 'aria-selected': String(tab.value === id), class: 'pl-text-button', onClick: () => (tab.value = id) }, label);
    return () =>
      h('div', { class: 'sidebar' }, [
        h('div', { class: 'pl-row sidebar-tabs', role: 'tablist' }, [tabButton('comments', t('comments.title')), tabButton('versions', t('versions.title')), tabButton('style', t('styleAnalysis.title'))]),
        h(tab.value === 'comments' ? CommentsRail : tab.value === 'versions' ? VersionsPanel : StylePanel),
      ]);
  },
});
