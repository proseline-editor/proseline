import { useEffect, useRef, type KeyboardEvent } from 'react';
import type {} from '@proseline-editor/core/features';
import { useProseline } from '../context.js';
import { useController } from '../use-controller.js';
import { ToolbarButton } from './toolbar-button.js';
import { icons } from './icons.js';

export interface FindReplaceProps {
  className?: string;
}

/** Find & replace bar; renders while the findReplace feature is open (Mod-F or the toolbar). */
export const FindReplace = ({ className }: FindReplaceProps) => {
  const { t, tiptap } = useProseline();
  const find = useController('findReplace');
  const inputRef = useRef<HTMLInputElement>(null);
  const open = find?.state.open ?? false;

  useEffect(() => {
    if (open) inputRef.current?.select();
  }, [open]);

  if (!find || !open) return null;
  const { state, commands } = find;

  const close = () => {
    commands.close();
    tiptap.commands.focus();
  };
  const onFindKey = (e: KeyboardEvent<HTMLInputElement>) => {
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

  return (
    <div role="search" className={['pl-find', className].filter(Boolean).join(' ')}>
      <div className="pl-find-row">
        <input
          ref={inputRef}
          className="pl-input"
          aria-label={t('findReplace.find')}
          placeholder={t('findReplace.find')}
          aria-invalid={state.error ? true : undefined}
          value={state.term}
          onChange={(e) => commands.setTerm(e.target.value)}
          onKeyDown={onFindKey}
        />
        <span className="pl-find-status" aria-live="polite">{status}</span>
        <ToolbarButton label={t('findReplace.caseSensitive')} active={state.caseSensitive} onClick={() => commands.setOptions({ caseSensitive: !state.caseSensitive })}><span className="pl-text-icon">Aa</span></ToolbarButton>
        <ToolbarButton label={t('findReplace.wholeWord')} active={state.wholeWord} onClick={() => commands.setOptions({ wholeWord: !state.wholeWord })}><span className="pl-text-icon">W</span></ToolbarButton>
        <ToolbarButton label={t('findReplace.regex')} active={state.regex} onClick={() => commands.setOptions({ regex: !state.regex })}><span className="pl-text-icon">.*</span></ToolbarButton>
        <ToolbarButton label={t('findReplace.inSelection')} active={state.inSelection} onClick={() => commands.setInSelection(!state.inSelection)}><span className="pl-text-icon">[ ]</span></ToolbarButton>
        <ToolbarButton label={t('findReplace.prev')} disabled={state.total === 0} onClick={() => commands.prev()}>{icons.chevronUp}</ToolbarButton>
        <ToolbarButton label={t('findReplace.next')} disabled={state.total === 0} onClick={() => commands.next()}>{icons.chevronDown}</ToolbarButton>
        <ToolbarButton label={t('findReplace.close')} onClick={close}>{icons.close}</ToolbarButton>
      </div>
      {state.canReplace && (
        <div className="pl-find-row">
          <input
            className="pl-input"
            aria-label={t('findReplace.replaceWith')}
            placeholder={t('findReplace.replaceWith')}
            value={state.replacement}
            onChange={(e) => commands.setReplacement(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commands.replace();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                close();
              }
            }}
          />
          <button type="button" className="pl-text-button" disabled={state.total === 0} onClick={() => commands.replace()}>{t('findReplace.replace')}</button>
          <button type="button" className="pl-text-button" disabled={state.total === 0} onClick={() => commands.replaceAll()}>{t('findReplace.replaceAll')}</button>
        </div>
      )}
    </div>
  );
};
