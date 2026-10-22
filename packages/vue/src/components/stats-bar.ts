import { defineComponent, h } from 'vue';
import type {} from '@proseline-editor/core/features';
import { useProseline } from '../context.js';
import { useController } from '../use-controller.js';

/** Word count, reading time and goal progress. Requires the stats feature. */
export const StatsBar = defineComponent({
  name: 'StatsBar',
  setup() {
    const { t } = useProseline();
    const stats = useController('stats');
    return () => {
      if (!stats.value) return null;
      const s = stats.value.state;
      return h('div', { class: 'pl-stats', 'aria-live': 'off' }, [
        h('span', t.plural('stats.words', s.words)),
        h('span', t('stats.reading', { count: s.readingMinutes })),
        h('span', t('stats.pages', { count: s.pages })),
        s.goal !== null &&
          h('span', { class: 'pl-goal' }, [
            h('progress', { max: 1, value: s.goalProgress ?? 0, 'aria-label': t('stats.goal', { value: s.words, goal: s.goal }) }),
            t('stats.goal', { value: s.words, goal: s.goal }),
          ]),
        h('span', { class: 'pl-goal' }, [
          s.sessionGoal !== null && h('progress', { max: 1, value: s.sessionProgress ?? 0 }),
          t('stats.session', { count: s.sessionGoal !== null ? `${s.sessionWords} / ${s.sessionGoal}` : s.sessionWords }),
        ]),
      ]);
    };
  },
});
