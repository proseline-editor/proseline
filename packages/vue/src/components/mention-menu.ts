import { defineComponent, h } from 'vue';
import { mentionText, type CaseKey, type MatchedMentionItem } from '@proseline-editor/core/features';
import { useProseline } from '../context.js';
import { useController } from '../use-controller.js';

const keep = (e: Event) => e.preventDefault(); // keep focus (and the caret) in the editor

/** Groups hits by kind, keeping the provider's order of first appearance. */
const groupByKind = (items: MatchedMentionItem[]) => {
  const groups = new Map<string, { item: MatchedMentionItem; index: number }[]>();
  items.forEach((item, index) => {
    const kind = item.kind ?? '';
    groups.set(kind, [...(groups.get(kind) ?? []), { item, index }]);
  });
  return [...groups];
};

/** The @-mention menu: entities grouped by kind, with the case forms of the selected one. */
export const MentionMenu = defineComponent({
  name: 'MentionMenu',
  setup() {
    const { t } = useProseline();
    const mentions = useController('mentions');
    return () => {
      const menu = mentions.value?.state.menu;
      if (!mentions.value || !menu) return null;
      const { commands } = mentions.value;
      const selected = menu.items[menu.selected];
      const caseName = (c: CaseKey | null) => t(`mentions.cases.${c ?? 'nom'}`);
      const kindName = (kind: string) => {
        const key = `mentions.kind.${kind}`;
        const name = t(key);
        return name === key ? kind : name;
      };
      return h('div', { class: 'pl-mention-menu', style: menu.rect ? { left: `${menu.rect.left}px`, top: `${menu.rect.bottom + 4}px` } : undefined, onMousedown: keep }, [
        h('div', { role: 'listbox', 'aria-label': t('mentions.label'), class: 'pl-mention-list' }, [
          menu.items.length === 0 && h('div', { class: 'pl-mention-empty' }, t(menu.loading ? 'mentions.loading' : 'mentions.empty')),
          ...groupByKind(menu.items).map(([kind, rows]) =>
            h('div', { role: 'group', key: kind, 'aria-label': kind ? kindName(kind) : undefined }, [
              kind && h('div', { class: 'pl-mention-kind', 'aria-hidden': 'true' }, kindName(kind)),
              ...rows.map(({ item, index }) =>
                h(
                  'div',
                  { key: item.id, role: 'option', 'aria-selected': String(index === menu.selected), class: 'pl-mention-option', onMouseenter: () => commands.select(index), onClick: () => commands.choose(index) },
                  [item.label, item.matchedCase && h('span', { class: 'pl-mention-matched' }, mentionText({ name: item.label, forms: item.forms ?? null }, item.matchedCase)?.text)],
                ),
              ),
            ]),
          ),
        ]),
        selected &&
          menu.caseOptions.length > 1 &&
          h(
            'div',
            { role: 'radiogroup', 'aria-label': t('mentions.pickCase'), class: 'pl-mention-cases' },
            menu.caseOptions.map((c, i) =>
              h(
                'button',
                { key: c ?? 'nom', type: 'button', role: 'radio', 'aria-checked': String(i === menu.caseIndex), title: caseName(c), class: 'pl-mention-case', onClick: () => commands.choose(menu.selected, c) },
                mentionText({ name: selected.label, forms: selected.forms ?? null }, c)?.text,
              ),
            ),
          ),
      ]);
    };
  },
});
