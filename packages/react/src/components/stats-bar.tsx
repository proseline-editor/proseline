import type {} from '@proseline-editor/core/features';
import { useProseline } from '../context.js';
import { useController } from '../use-controller.js';

export interface StatsBarProps {
  className?: string;
}

/** Word count, reading time and goal progress. Requires the stats feature. */
export const StatsBar = ({ className }: StatsBarProps) => {
  const { t } = useProseline();
  const stats = useController('stats');
  if (!stats) return null;
  const s = stats.state;
  return (
    <div className={['pl-stats', className].filter(Boolean).join(' ')} aria-live="off">
      <span>{t.plural('stats.words', s.words)}</span>
      <span>{t('stats.reading', { count: s.readingMinutes })}</span>
      <span>{t('stats.pages', { count: s.pages })}</span>
      {s.goal !== null && (
        <span className="pl-goal">
          <progress max={1} value={s.goalProgress ?? 0} aria-label={t('stats.goal', { value: s.words, goal: s.goal })} />
          {t('stats.goal', { value: s.words, goal: s.goal })}
        </span>
      )}
      <span className="pl-goal">
        {s.sessionGoal !== null && <progress max={1} value={s.sessionProgress ?? 0} />}
        {t('stats.session', { count: s.sessionGoal !== null ? `${s.sessionWords} / ${s.sessionGoal}` : s.sessionWords })}
      </span>
    </div>
  );
};
