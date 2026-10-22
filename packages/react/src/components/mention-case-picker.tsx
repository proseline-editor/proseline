import { useEffect, useRef } from 'react';
import type {} from '@proseline-editor/core/features';
import { useProseline } from '../context.js';
import { useController } from '../use-controller.js';

export interface MentionCasePickerProps {
  className?: string;
}

/** Opens on a click on a mention: switches it to another case form of the entity's name, or opens the entity. */
export const MentionCasePicker = ({ className }: MentionCasePickerProps) => {
  const { t, tiptap } = useProseline();
  const mentions = useController('mentions');
  const picker = mentions?.state.picker;
  const ref = useRef<HTMLDivElement>(null);
  const closePicker = mentions?.commands.closePicker;

  useEffect(() => {
    if (!picker || !closePicker) return;
    ref.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) closePicker();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [picker, closePicker]);

  if (!mentions || !picker) return null;
  const { commands } = mentions;
  const done = () => tiptap.commands.focus();

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={t('mentions.changeCase')}
      className={['pl-mention-picker', className].filter(Boolean).join(' ')}
      style={{ left: picker.rect.left, top: picker.rect.bottom + 4 }}
      onKeyDown={(e) => {
        const items = [...(ref.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];
        const at = items.indexOf(document.activeElement as HTMLElement);
        if (e.key === 'Escape') {
          e.preventDefault();
          commands.closePicker();
          done();
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          items[(at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
        }
      }}
    >
      {picker.options.map((o) => (
        <button
          key={o.case ?? 'nom'}
          type="button"
          role="menuitemradio"
          aria-checked={o.case === picker.current}
          className="pl-mention-picker-item"
          onClick={() => {
            commands.pickCase(o.case);
            done();
          }}
        >
          <span>{o.text}</span>
          <span className="pl-mention-picker-case">{t(`mentions.cases.${o.case ?? 'nom'}`)}</span>
        </button>
      ))}
      {picker.canOpen && (
        <button type="button" role="menuitem" className="pl-mention-picker-item pl-mention-open" onClick={() => commands.open()}>
          {t('mentions.open')}
        </button>
      )}
    </div>
  );
};
