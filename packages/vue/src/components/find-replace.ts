import { defineComponent, h, nextTick, ref, watch } from 'vue';
import type {} from '@proseline-editor/core/features';
import { useProseline } from '../context.js';
import { useController } from '../use-controller.js';
import { ToolbarButton } from './toolbar-button.js';
import { icons } from './icons.js';

const textIcon = (text: string) => () => h('span', { class: 'pl-text-icon' }, text);

/** Find & replace bar; renders while the findReplace feature is open (Mod-F or the toolbar). */
export const FindReplace = defineComponent({
  name: 'FindReplace',
  setup() {
    const { t, tiptap } = useProseline();
    const find = useController('findReplace');
    const input = ref<HTMLInputElement | null>(null);
    watch(
      () => find.value?.state.open,
      async (open) => {
        if (!open) return;
        await nextTick();
        input.value?.select();
      },
      { immediate: true },
    );

    return () => {
      const f = find.value;
      if (!f || !f.state.open) return null;
      const { state, commands } = f;
      const close = () => {
        commands.close();
        tiptap.commands.focus();
      };
      const onFindKey = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (e.shiftKey) commands.prev();
          else commands.next();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          close();
        }
      };
      const status = state.error
        ? t('findReplace.invalidRegex')
        : state.term && state.total === 0
          ? t('findReplace.none')
          : state.total > 0
            ? t('findReplace.count', { current: state.current, total: state.total })
            : '';
      const toggle = (label: string, active: boolean, onClick: () => void, icon: () => unknown) => h(ToolbarButton, { label, active, onClick }, { default: icon });

      return h('div', { role: 'search', class: 'pl-find' }, [
        h('div', { class: 'pl-find-row' }, [
          h('input', {
            ref: input,
            class: 'pl-input',
            'aria-label': t('findReplace.find'),
            placeholder: t('findReplace.find'),
            'aria-invalid': state.error ? 'true' : undefined,
            value: state.term,
            onInput: (e: Event) => commands.setTerm((e.target as HTMLInputElement).value),
            onKeydown: onFindKey,
          }),
          h('span', { class: 'pl-find-status', 'aria-live': 'polite' }, status),
          toggle(t('findReplace.caseSensitive'), state.caseSensitive, () => commands.setOptions({ caseSensitive: !state.caseSensitive }), textIcon('Aa')),
          toggle(t('findReplace.wholeWord'), state.wholeWord, () => commands.setOptions({ wholeWord: !state.wholeWord }), textIcon('W')),
          toggle(t('findReplace.regex'), state.regex, () => commands.setOptions({ regex: !state.regex }), textIcon('.*')),
          toggle(t('findReplace.inSelection'), state.inSelection, () => commands.setInSelection(!state.inSelection), textIcon('[ ]')),
          h(ToolbarButton, { label: t('findReplace.prev'), disabled: state.total === 0, onClick: () => commands.prev() }, { default: icons.chevronUp }),
          h(ToolbarButton, { label: t('findReplace.next'), disabled: state.total === 0, onClick: () => commands.next() }, { default: icons.chevronDown }),
          h(ToolbarButton, { label: t('findReplace.close'), onClick: close }, { default: icons.close }),
        ]),
        state.canReplace &&
          h('div', { class: 'pl-find-row' }, [
            h('input', {
              class: 'pl-input',
              'aria-label': t('findReplace.replaceWith'),
              placeholder: t('findReplace.replaceWith'),
              value: state.replacement,
              onInput: (e: Event) => commands.setReplacement((e.target as HTMLInputElement).value),
              onKeydown: (e: KeyboardEvent) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commands.replace();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  close();
                }
              },
            }),
            h('button', { type: 'button', class: 'pl-text-button', disabled: state.total === 0, onClick: () => commands.replace() }, t('findReplace.replace')),
            h('button', { type: 'button', class: 'pl-text-button', disabled: state.total === 0, onClick: () => commands.replaceAll() }, t('findReplace.replaceAll')),
          ]),
      ]);
    };
  },
});
