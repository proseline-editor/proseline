import { mentionText, type CaseKey, type MatchedMentionItem } from '@proseline-editor/core/features';
import { useProseline } from '../context.js';
import { useController } from '../use-controller.js';

export interface MentionMenuProps {
  className?: string;
}

const keep = (e: { preventDefault(): void }) => e.preventDefault(); // keep focus (and the caret) in the editor

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
export const MentionMenu = ({ className }: MentionMenuProps) => {
  const { t } = useProseline();
  const mentions = useController('mentions');
  const menu = mentions?.state.menu;
  if (!mentions || !menu) return null;
  const { commands } = mentions;
  const selected = menu.items[menu.selected];
  const caseName = (c: CaseKey | null) => t(`mentions.cases.${c ?? 'nom'}`);
  const kindName = (kind: string) => {
    const key = `mentions.kind.${kind}`;
    const name = t(key);
    return name === key ? kind : name;
  };

  return (
    <div
      className={['pl-mention-menu', className].filter(Boolean).join(' ')}
      style={menu.rect ? { left: menu.rect.left, top: menu.rect.bottom + 4 } : undefined}
      onMouseDown={keep}
    >
      <div role="listbox" aria-label={t('mentions.label')} className="pl-mention-list">
        {menu.items.length === 0 && <div className="pl-mention-empty">{t(menu.loading ? 'mentions.loading' : 'mentions.empty')}</div>}
        {groupByKind(menu.items).map(([kind, rows]) => (
          <div role="group" key={kind} aria-label={kind ? kindName(kind) : undefined}>
            {kind && <div className="pl-mention-kind" aria-hidden="true">{kindName(kind)}</div>}
            {rows.map(({ item, index }) => (
              <div
                key={item.id}
                role="option"
                aria-selected={index === menu.selected}
                className="pl-mention-option"
                onMouseEnter={() => commands.select(index)}
                onClick={() => commands.choose(index)}
              >
                {item.label}
                {item.matchedCase && <span className="pl-mention-matched">{mentionText({ name: item.label, forms: item.forms ?? null }, item.matchedCase)?.text}</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
      {selected && menu.caseOptions.length > 1 && (
        <div role="radiogroup" aria-label={t('mentions.pickCase')} className="pl-mention-cases">
          {menu.caseOptions.map((c, i) => (
            <button
              key={c ?? 'nom'}
              type="button"
              role="radio"
              aria-checked={i === menu.caseIndex}
              title={caseName(c)}
              className="pl-mention-case"
              onClick={() => commands.choose(menu.selected, c)}
            >
              {mentionText({ name: selected.label, forms: selected.forms ?? null }, c)?.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
