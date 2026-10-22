import { defineComponent, h, nextTick, onMounted, onScopeDispose, ref, shallowRef, watch, type PropType } from 'vue';
import { DOMSerializer } from '@tiptap/pm/model';
import type { JSONContent } from '@tiptap/core';
import { relativeTime, type FeatureController, type FeatureRegistry } from '@proseline-editor/core';
import type { DiffBlock, VersionMeta } from '@proseline-editor/core/features';
import { useProseline } from '../context.js';
import { useController } from '../use-controller.js';

/** Number of co-authors present, if the collaboration feature (@proseline-editor/sync) is installed. */
const usePeerCount = () => {
  const editor = useProseline();
  const c = editor.feature('collaboration' as keyof FeatureRegistry) as FeatureController<{ peers: unknown[] }> | undefined;
  const count = shallowRef(c?.getState().peers.length ?? 0);
  if (c) onScopeDispose(c.subscribe(() => (count.value = c.getState().peers.length)));
  return count;
};

/** Read-only rendering of a version with the editor's own schema (same look as the writing surface). */
const VersionContent = defineComponent({
  name: 'VersionContent',
  props: { content: { type: Object as PropType<JSONContent>, required: true } },
  setup(props) {
    const { tiptap } = useProseline();
    const el = ref<HTMLDivElement | null>(null);
    const draw = () => {
      if (!el.value) return;
      const fragment = DOMSerializer.fromSchema(tiptap.schema).serializeFragment(tiptap.schema.nodeFromJSON(props.content).content);
      el.value.replaceChildren(fragment);
    };
    onMounted(draw);
    watch(() => props.content, draw);
    return () => h('div', { ref: el, class: 'ProseMirror pl-version-content' });
  },
});

const diffView = (diff: DiffBlock[]) =>
  h(
    'div',
    { class: 'ProseMirror pl-diff' },
    diff.map((block, i) => {
      if (block.kind === 'horizontalRule') return h('hr', { key: i, 'data-status': block.status });
      // Lists and quotes render as paragraphs; data-container lets the theme indent them.
      const tag = block.kind === 'heading' ? `h${block.level ?? 3}` : 'p';
      return h(
        tag,
        { key: i, 'data-status': block.status, 'data-container': block.container },
        block.parts.map((part, j) => h(part.op === 'insert' ? 'ins' : part.op === 'delete' ? 'del' : 'span', { key: j }, part.text)),
      );
    }),
  );

/** Snapshots: save, browse, compare with the current text, restore, delete. Requires the versions feature. */
export const VersionsPanel = defineComponent({
  name: 'VersionsPanel',
  setup() {
    const { t, locale } = useProseline();
    const versions = useController('versions');
    const peers = usePeerCount();
    const naming = ref(false);
    const name = ref('');
    const nameInput = ref<HTMLInputElement | null>(null);
    const mode = ref<'version' | 'compare'>('compare');
    const confirm = ref<{ action: 'restore' | 'delete'; id: string } | null>(null);
    watch(naming, async (on) => {
      if (!on) return;
      await nextTick();
      nameInput.value?.focus();
    });

    return () => {
      if (!versions.value) return null;
      const { state, commands } = versions.value;
      const preview = state.preview;
      const save = async () => {
        if (await commands.snapshot(name.value)) {
          name.value = '';
          naming.value = false;
        }
      };
      const label = (v: VersionMeta) => v.label ?? t('versions.automatic');
      const text = (content: string, onClick: () => void, attrs: Record<string, unknown> = {}) => h('button', { type: 'button', class: 'pl-text-button', onClick, ...attrs }, content);

      return h('aside', { class: 'pl-versions', 'aria-label': t('versions.title') }, [
        h('header', { class: 'pl-comments-header' }, [h('h2', t('versions.title')), state.allowed && !naming.value && text(t('versions.save'), () => (naming.value = true))]),
        naming.value &&
          h('form', { class: 'pl-reply', onSubmit: (e: Event) => (e.preventDefault(), void save()) }, [
            h('input', { ref: nameInput, class: 'pl-input', 'aria-label': t('versions.namePlaceholder'), placeholder: t('versions.namePlaceholder'), value: name.value, onInput: (e: Event) => (name.value = (e.target as HTMLInputElement).value) }),
            h('button', { type: 'submit', class: 'pl-text-button pl-primary', disabled: state.busy }, t('versions.saveConfirm')),
            text(t('versions.cancel'), () => (naming.value = false)),
          ]),
        state.error && h('p', { role: 'alert', class: 'pl-error' }, t(`versions.${state.error}`)),
        preview &&
          h('section', { class: 'pl-preview', 'aria-label': t('versions.preview') }, [
            h('div', { class: 'pl-row pl-preview-head' }, [h('strong', label(preview)), text('×', () => commands.close(), { 'aria-label': t('versions.closePreview') })]),
            h('div', { class: 'pl-row', role: 'tablist' }, [
              text(t('versions.compare'), () => (mode.value = 'compare'), { role: 'tab', 'aria-selected': String(mode.value === 'compare') }),
              text(t('versions.showVersion'), () => (mode.value = 'version'), { role: 'tab', 'aria-selected': String(mode.value === 'version') }),
            ]),
            ...(mode.value === 'compare'
              ? [h('p', { class: 'pl-meta' }, t('versions.changes', { inserted: preview.summary.insertedWords, deleted: preview.summary.deletedWords })), diffView(preview.diff)]
              : [h(VersionContent, { content: preview.content })]),
          ]),
        state.versions.length === 0 && h('p', { class: 'pl-hint' }, t('versions.empty')),
        h(
          'ol',
          { class: 'pl-threads' },
          state.versions.map((v) => {
            const confirming = confirm.value?.id === v.id ? confirm.value.action : null;
            const open = preview?.id === v.id;
            return h('li', { key: v.id, class: 'pl-thread pl-version', 'data-active': open || undefined }, [
              h('p', { class: 'pl-body' }, [h('strong', label(v))]),
              h('p', { class: 'pl-meta' }, [h('time', { datetime: v.createdAt }, relativeTime(v.createdAt, locale)), ' · ', t.plural('versions.words', v.words), v.authorName ? ` · ${v.authorName}` : '']),
              confirming
                ? h('div', { class: 'pl-row' }, [
                    h('span', { class: 'pl-confirm' }, confirming === 'restore' ? t('versions.confirmRestore') : t('versions.confirmDelete')),
                    confirming === 'restore' && peers.value > 0 && h('span', { role: 'alert', class: 'pl-warning' }, t('versions.coAuthors')),
                    h(
                      'button',
                      {
                        type: 'button',
                        class: ['pl-text-button', confirming === 'delete' ? 'pl-danger' : 'pl-primary'].join(' '),
                        disabled: state.busy,
                        onClick: () => {
                          confirm.value = null;
                          void (confirming === 'restore' ? commands.restore(v.id) : commands.remove(v.id));
                        },
                      },
                      confirming === 'restore' ? t('versions.restore') : t('versions.delete'),
                    ),
                    text(t('versions.cancel'), () => (confirm.value = null)),
                  ])
                : h('div', { class: 'pl-row' }, [
                    text(t('versions.preview'), () => (open ? commands.close() : void commands.open(v.id)), { 'aria-pressed': String(open) }),
                    state.allowed && text(t('versions.restore'), () => (confirm.value = { action: 'restore', id: v.id })),
                    state.canRemove && text(t('versions.delete'), () => (confirm.value = { action: 'delete', id: v.id })),
                  ]),
            ]);
          }),
        ),
      ]);
    };
  },
});
