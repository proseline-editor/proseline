import type { ReactNode } from 'react';

export interface ToolbarButtonProps {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
}

/** Icon button with an accessible name, pressed state and tooltip. */
export const ToolbarButton = ({ label, onClick, active, disabled, children }: ToolbarButtonProps) => (
  <button
    type="button"
    className="pl-button"
    aria-label={label}
    title={label}
    aria-pressed={active === undefined ? undefined : active}
    disabled={disabled}
    // Keep the editor selection: buttons must not steal focus on mousedown.
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
  >
    {children}
  </button>
);
