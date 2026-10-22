import { defineComponent, h, nextTick, onScopeDispose, ref, watch } from 'vue';
import type {} from '@proseline-editor/core/features';
import { useProseline } from '../context.js';
import { useController } from '../use-controller.js';

/** Opens on a click on a mention: switches it to another case form of the entity's name, or opens the entity. */
export const MentionCasePicker = defineComponent({
  name: 'MentionCasePicker',
  setup() {
    const { t, tiptap } = useProseline();
    const mentions = useController('mentions');
    const menu = ref<HTMLDivElement | null>(null);
    const onDown = (e: MouseEvent) => {
      if (!menu.value?.contains(e.target as Node)) mentions.value?.commands.closePicker();
    };
    watch(
      () => mentions.value?.state.picker,
      async (picker) => {
        document.removeEventListener('mousedown', onDown);
        if (!picker) return;
        await nextTick();
        menu.value?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
        document.addEventListener('mousedown', onDown);
      },
    );
    onScopeDispose(() => document.removeEventListener('mousedown', onDown));

    return () => {
      const picker = mentions.value?.state.picker;
      if (!mentions.value || !picker) return null;
      const { commands } = mentions.value;
      const done = () => tiptap.commands.focus();
      return h(
        'div',
        {
          ref: menu,
          role: 'menu',
          'aria-label': t('mentions.changeCase'),
          class: 'pl-mention-picker',
          style: { left: `${picker.rect.left}px`, top: `${picker.rect.bottom + 4}px` },
          onKeydown: (e: KeyboardEvent) => {
            const items = [...(menu.value?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];
            const at = items.indexOf(document.activeElement as HTMLElement);
            if (e.key === 'Escape') {
              e.preventDefault();
              commands.closePicker();
              done();
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              items[(at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
            }
          },
        },
        [
          ...picker.options.map((o) =>
            h(
              'button',
              {
                key: o.case ?? 'nom',
                type: 'button',
                role: 'menuitemradio',
                'aria-checked': String(o.case === picker.current),
                class: 'pl-mention-picker-item',
                onClick: () => {
                  commands.pickCase(o.case);
                  done();
                },
              },
              [h('span', o.text), h('span', { class: 'pl-mention-picker-case' }, t(`mentions.cases.${o.case ?? 'nom'}`))],
            ),
          ),
          picker.canOpen && h('button', { type: 'button', role: 'menuitem', class: 'pl-mention-picker-item pl-mention-open', onClick: () => commands.open() }, t('mentions.open')),
        ],
      );
    };
  },
});
