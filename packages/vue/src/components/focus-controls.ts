import { defineComponent, h } from 'vue';
import type { FocusMode } from '@proseline-editor/core/features';
import { useProseline } from '../context.js';
import { useController } from '../use-controller.js';
import { ToolbarButton } from './toolbar-button.js';
import { icons } from './icons.js';

const MODES: FocusMode[] = ['off', 'paragraph', 'sentence'];
const MODE_ICON: Record<FocusMode, string> = { off: '○', paragraph: '¶', sentence: '“' };

/** Focus mode switcher plus typewriter and distraction-free toggles. Requires the focus feature. */
export const FocusControls = defineComponent({
  name: 'FocusControls',
  setup() {
    const { t } = useProseline();
    const focus = useController('focus');
    return () => {
      if (!focus.value) return null;
      const { state, commands } = focus.value;
      return h('div', { class: 'pl-group pl-focus' }, [
        ...MODES.map((mode) =>
          h(ToolbarButton, { key: mode, label: t(`focus.${mode}`), active: state.mode === mode, onClick: () => commands.setMode(mode) }, { default: () => h('span', { class: 'pl-text-icon' }, MODE_ICON[mode]) }),
        ),
        h(ToolbarButton, { label: t('focus.typewriter'), active: state.typewriter, onClick: () => commands.toggleTypewriter() }, { default: icons.typewriter }),
        h(ToolbarButton, { label: t('focus.distractionFree'), active: state.distractionFree, onClick: () => commands.toggleDistractionFree() }, { default: icons.fullscreen }),
      ]);
    };
  },
});
