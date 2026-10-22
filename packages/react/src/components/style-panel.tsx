import type {} from '@proseline-editor/core/features';
import { useProseline } from '../context.js';
import { useController } from '../use-controller.js';
import { icons } from './icons.js';

export interface StylePanelProps {
  className?: string;
}

/** Style analysis: switch it on, choose checks, see counts and readability, step through issues. */
export const StylePanel = ({ className }: StylePanelProps) => {
  const { t } = useProseline();
  const style = useController('styleAnalysis');
  if (!style) return null;
  const { state, commands } = style;

  return (
    <aside className={['pl-style-panel', className].filter(Boolean).join(' ')} aria-label={t('styleAnalysis.title')}>
      <header className="pl-comments-header">
        <h2>{t('styleAnalysis.title')}</h2>
        <label className="pl-check">
          <input type="checkbox" checked={state.enabled} onChange={(e) => commands.setEnabled(e.target.checked)} />
          {t('styleAnalysis.toggle')}
        </label>
      </header>
      {!state.enabled ? (
        <p className="pl-hint">{t('styleAnalysis.off')}</p>
      ) : (
        <>
          <ul className="pl-style-checks">
            {state.available.map((check) => {
              const name = t(`styleAnalysis.check.${check}`);
              const none = !state.checks[check] || state.counts[check] === 0;
              return (
                <li key={check} className="pl-style-check">
                  <label className="pl-check">
                    <input type="checkbox" checked={state.checks[check]} onChange={(e) => commands.setCheck(check, e.target.checked)} />
                    <span className={`pl-style-swatch pl-style--${check}`} aria-hidden="true">ab</span>
                    {name}
                  </label>
                  <span className="pl-style-count">{state.counts[check]}</span>
                  <button type="button" className="pl-button" aria-label={`${t('styleAnalysis.prev')}: ${name}`} disabled={none} onClick={() => commands.prev(check)}>{icons.chevronUp}</button>
                  <button type="button" className="pl-button" aria-label={`${t('styleAnalysis.next')}: ${name}`} disabled={none} onClick={() => commands.next(check)}>{icons.chevronDown}</button>
                </li>
              );
            })}
          </ul>
          <p className="pl-style-readability" aria-live="polite">
            {state.analyzing ? (
              t('styleAnalysis.analyzing')
            ) : state.readability ? (
              <>
                {t('styleAnalysis.readability')}: <strong>{state.readability.score}</strong> · {t(`styleAnalysis.level.${state.readability.level}`)}
              </>
            ) : (
              <span className="pl-hint">{t('styleAnalysis.readabilityNone')}</span>
            )}
          </p>
        </>
      )}
    </aside>
  );
};
