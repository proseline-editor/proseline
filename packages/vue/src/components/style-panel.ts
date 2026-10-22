import { defineComponent, h } from 'vue';
import type {} from '@proseline-editor/core/features';
import { useProseline } from '../context.js';
import { useController } from '../use-controller.js';
import { icons } from './icons.js';

/** Style analysis: switch it on, choose checks, see counts and readability, step through issues. */
export const StylePanel = defineComponent({
  name: 'StylePanel',
  setup() {
    const { t } = useProseline();
    const style = useController('styleAnalysis');
    return () => {
      if (!style.value) return null;
      const { state, commands } = style.value;
      const r = state.readability;
      return h('aside', { class: 'pl-style-panel', 'aria-label': t('styleAnalysis.title') }, [
        h('header', { class: 'pl-comments-header' }, [
          h('h2', t('styleAnalysis.title')),
          h('label', { class: 'pl-check' }, [
            h('input', { type: 'checkbox', checked: state.enabled, onChange: (e: Event) => commands.setEnabled((e.target as HTMLInputElement).checked) }),
            t('styleAnalysis.toggle'),
          ]),
        ]),
        !state.enabled
          ? h('p', { class: 'pl-hint' }, t('styleAnalysis.off'))
          : [
              h(
                'ul',
                { class: 'pl-style-checks' },
                state.available.map((check) => {
                  const name = t(`styleAnalysis.check.${check}`);
                  const none = !state.checks[check] || state.counts[check] === 0;
                  return h('li', { key: check, class: 'pl-style-check' }, [
                    h('label', { class: 'pl-check' }, [
                      h('input', { type: 'checkbox', checked: state.checks[check], onChange: (e: Event) => commands.setCheck(check, (e.target as HTMLInputElement).checked) }),
                      h('span', { class: `pl-style-swatch pl-style--${check}`, 'aria-hidden': 'true' }, 'ab'),
                      name,
                    ]),
                    h('span', { class: 'pl-style-count' }, String(state.counts[check])),
                    h('button', { type: 'button', class: 'pl-button', 'aria-label': `${t('styleAnalysis.prev')}: ${name}`, disabled: none, onClick: () => commands.prev(check) }, [icons.chevronUp()]),
                    h('button', { type: 'button', class: 'pl-button', 'aria-label': `${t('styleAnalysis.next')}: ${name}`, disabled: none, onClick: () => commands.next(check) }, [icons.chevronDown()]),
                  ]);
                }),
              ),
              h(
                'p',
                { class: 'pl-style-readability', 'aria-live': 'polite' },
                state.analyzing
                  ? t('styleAnalysis.analyzing')
                  : r
                    ? [`${t('styleAnalysis.readability')}: `, h('strong', String(r.score)), ` · ${t(`styleAnalysis.level.${r.level}`)}`]
                    : [h('span', { class: 'pl-hint' }, t('styleAnalysis.readabilityNone'))],
              ),
            ],
      ]);
    };
  },
});
