import { defineComponent, h, nextTick, ref, watch, type PropType } from 'vue';
import { relativeTime } from '@proseline-editor/core';
import type { ThreadView } from '@proseline-editor/core/features';
import { useProseline } from '../context.js';
import { useController } from '../use-controller.js';

const Thread = defineComponent({
  name: 'CommentThread',
  props: {
    thread: { type: Object as PropType<ThreadView>, required: true },
    active: { type: Boolean, required: true },
    allowed: { type: Boolean, required: true },
  },
  setup(props) {
    const { t, locale } = useProseline();
    const comments = useController('comments');
    const reply = ref('');
    const confirming = ref(false);
    const item = ref<HTMLLIElement | null>(null);
    // Clicking commented text activates the thread: bring it into view in the rail.
    watch(
      () => props.active,
      async (active) => {
        if (!active) return;
        await nextTick();
        item.value?.scrollIntoView?.({ block: 'nearest' });
      },
      { immediate: true },
    );

    return () => {
      if (!comments.value) return null;
      const { commands } = comments.value;
      const { thread, active, allowed } = props;
      const sendReply = async () => {
        if (await commands.reply(thread.id, reply.value)) reply.value = '';
      };
      const button = (label: string, onClick: () => void, extra = '') => h('button', { type: 'button', class: `pl-text-button${extra}`, onClick }, label);
      return h('li', { ref: item, class: 'pl-thread', 'data-active': active || undefined, 'data-resolved': thread.resolved || undefined, 'data-orphaned': thread.orphaned || undefined }, [
        h('button', { type: 'button', class: 'pl-quote', disabled: thread.orphaned, onClick: () => commands.select(active ? null : thread.id) }, [
          thread.orphaned && h('span', { class: 'pl-orphaned' }, t('comments.orphaned')),
          h('q', thread.anchor.quote),
        ]),
        ...thread.comments.map((c) =>
          h('div', { key: c.id, class: 'pl-comment-entry' }, [
            h('p', { class: 'pl-meta' }, [h('span', { class: 'pl-author' }, c.authorName ?? t('comments.someone')), ' · ', h('time', { datetime: c.createdAt }, relativeTime(c.createdAt, locale))]),
            h('p', { class: 'pl-body' }, c.body),
          ]),
        ),
        allowed && [
          h('form', { class: 'pl-reply', onSubmit: (e: Event) => (e.preventDefault(), void sendReply()) }, [
            h('input', { class: 'pl-input', 'aria-label': t('comments.replyPlaceholder'), placeholder: t('comments.replyPlaceholder'), value: reply.value, onInput: (e: Event) => (reply.value = (e.target as HTMLInputElement).value) }),
            h('button', { type: 'submit', class: 'pl-text-button', disabled: !reply.value.trim() }, t('comments.reply')),
          ]),
          h('div', { class: 'pl-row' }, [
            button(thread.resolved ? t('comments.reopen') : t('comments.resolve'), () => void commands.setResolved(thread.id, !thread.resolved)),
            ...(confirming.value
              ? [
                  h('span', { class: 'pl-confirm' }, t('comments.confirmDelete')),
                  button(t('comments.delete'), () => void commands.remove(thread.id), ' pl-danger'),
                  button(t('comments.cancel'), () => (confirming.value = false)),
                ]
              : [button(t('comments.delete'), () => (confirming.value = true))]),
          ]),
        ],
      ]);
    };
  },
});

/** Comment threads beside the text: composer, replies, resolve and delete. Requires the comments feature. */
export const CommentsRail = defineComponent({
  name: 'CommentsRail',
  setup() {
    const { t } = useProseline();
    const comments = useController('comments');
    const showResolved = ref(true);
    const draft = ref('');
    const composer = ref<HTMLTextAreaElement | null>(null);
    watch(
      () => comments.value?.state.composing,
      async (composing) => {
        if (!composing) return;
        await nextTick();
        composer.value?.focus();
      },
    );

    return () => {
      if (!comments.value) return null;
      const { state, commands } = comments.value;
      const shown = showResolved.value ? state.threads : state.threads.filter((th) => !th.resolved);
      const submit = async () => {
        if (await commands.submitComment(draft.value)) draft.value = '';
      };
      return h('aside', { class: 'pl-comments', 'aria-label': t('comments.title') }, [
        h('header', { class: 'pl-comments-header' }, [
          h('h2', t('comments.title')),
          h('label', { class: 'pl-check' }, [
            h('input', { type: 'checkbox', checked: showResolved.value, onChange: (e: Event) => (showResolved.value = (e.target as HTMLInputElement).checked) }),
            t('comments.showResolved'),
          ]),
        ]),
        state.error && h('p', { role: 'alert', class: 'pl-error' }, t(`comments.${state.error}`)),
        state.composing &&
          h('form', { class: 'pl-composer', onSubmit: (e: Event) => (e.preventDefault(), void submit()) }, [
            h('textarea', {
              ref: composer,
              class: 'pl-textarea',
              'aria-label': t('comments.placeholder'),
              placeholder: t('comments.placeholder'),
              value: draft.value,
              onInput: (e: Event) => (draft.value = (e.target as HTMLTextAreaElement).value),
              onKeydown: (e: KeyboardEvent) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void submit();
                } else if (e.key === 'Escape') {
                  commands.cancelComment();
                }
              },
            }),
            h('div', { class: 'pl-row' }, [
              h('button', { type: 'submit', class: 'pl-text-button pl-primary', disabled: !draft.value.trim() }, t('comments.submit')),
              h('button', { type: 'button', class: 'pl-text-button', onClick: () => commands.cancelComment() }, t('comments.cancel')),
            ]),
          ]),
        shown.length === 0 && !state.composing && h('p', { class: 'pl-hint' }, state.allowed ? t('comments.selectText') : t('comments.empty')),
        h('ol', { class: 'pl-threads' }, shown.map((thread) => h(Thread, { key: thread.id, thread, active: thread.id === state.activeId, allowed: state.allowed }))),
      ]);
    };
  },
});
