import type { FocusMode } from '@proseline-editor/core/features';
import { useProseline } from '../context.js';
import { useController } from '../use-controller.js';
import { ToolbarButton } from './toolbar-button.js';
import { icons } from './icons.js';

export interface FocusControlsProps {
  className?: string;
}

const MODES: FocusMode[] = ['off', 'paragraph', 'sentence'];
const MODE_ICON: Record<FocusMode, string> = { off: '○', paragraph: '¶', sentence: '“' };

/** Focus mode switcher plus typewriter and distraction-free toggles. Requires the focus feature. */
export const FocusControls = ({ className }: FocusControlsProps) => {
  const { t } = useProseline();
  const focus = useController('focus');
  if (!focus) return null;
  const { state, commands } = focus;
  return (
    <div className={['pl-group', 'pl-focus', className].filter(Boolean).join(' ')}>
      {MODES.map((mode) => (
        <ToolbarButton key={mode} label={t(`focus.${mode}`)} active={state.mode === mode} onClick={() => commands.setMode(mode)}>
          <span className="pl-text-icon">{MODE_ICON[mode]}</span>
        </ToolbarButton>
      ))}
      <ToolbarButton label={t('focus.typewriter')} active={state.typewriter} onClick={() => commands.toggleTypewriter()}>{icons.typewriter}</ToolbarButton>
      <ToolbarButton label={t('focus.distractionFree')} active={state.distractionFree} onClick={() => commands.toggleDistractionFree()}>{icons.fullscreen}</ToolbarButton>
    </div>
  );
};
