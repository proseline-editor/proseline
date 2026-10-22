import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { findReplace, focus } from '@proseline-editor/core/features';
import type { ProselineEditor as Editor } from '@proseline-editor/core';
import { ProselineEditor } from './proseline-editor.js';
import { ProselineContent } from './proseline-content.js';
import { useController } from './use-controller.js';
import { useProseline } from './context.js';

afterEach(cleanup);

const surface = (container: HTMLElement) => container.querySelector('.ProseMirror');

describe('<ProselineEditor>', () => {
  it('renders the content by default and calls onReady', async () => {
    const onReady = vi.fn();
    const { container } = render(<ProselineEditor content="<p>Hello</p>" onReady={onReady} />);
    await act(async () => {});
    expect(surface(container)?.textContent).toBe('Hello');
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('places the surface where <ProselineContent /> is', async () => {
    const { container } = render(
      <ProselineEditor content="<p>x</p>">
        <header>top</header>
        <ProselineContent className="mine" />
      </ProselineEditor>,
    );
    await act(async () => {});
    const root = container.querySelector('.pl-root');
    expect(root?.firstElementChild?.tagName).toBe('HEADER');
    expect(container.querySelector('.pl-content.mine .ProseMirror')).not.toBeNull();
  });

  it('applies editable changes live', async () => {
    let instance: Editor | null = null;
    const { rerender } = render(<ProselineEditor content="<p>x</p>" onReady={(e) => (instance = e)} />);
    await act(async () => {});
    expect(instance!.isEditable).toBe(true);
    rerender(<ProselineEditor content="<p>x</p>" editable={false} onReady={(e) => (instance = e)} />);
    await act(async () => {});
    expect(instance!.isEditable).toBe(false);
  });

  it('destroys the editor on unmount', async () => {
    let instance: Editor | null = null;
    const { unmount } = render(<ProselineEditor onReady={(e) => (instance = e)} />);
    await act(async () => {});
    unmount();
    expect(instance!.tiptap.isDestroyed).toBe(true);
  });

  it('marks the root while distraction-free is on', async () => {
    let instance: Editor | null = null;
    const { container } = render(<ProselineEditor features={[focus()]} onReady={(e) => (instance = e)} />);
    await act(async () => {});
    act(() => instance!.feature('focus')!.commands.toggleDistractionFree());
    expect(container.querySelector('.pl-root')?.hasAttribute('data-distraction-free')).toBe(true);
  });
});

describe('useController', () => {
  const Probe = () => {
    const find = useController('findReplace');
    const missing = useController('stats');
    return (
      <div>
        <span data-testid="open">{String(find?.state.open)}</span>
        <span data-testid="missing">{String(missing)}</span>
        <button onClick={() => find?.commands.open()}>open</button>
      </div>
    );
  };

  it('returns live state and null for absent features', async () => {
    render(
      <ProselineEditor features={[findReplace()]}>
        <Probe />
        <ProselineContent />
      </ProselineEditor>,
    );
    await act(async () => {});
    expect(screen.getByTestId('open').textContent).toBe('false');
    expect(screen.getByTestId('missing').textContent).toBe('null');
    act(() => screen.getByText('open').click());
    expect(screen.getByTestId('open').textContent).toBe('true');
  });

  it('useProseline throws outside the provider', () => {
    const Bad = () => {
      useProseline();
      return null;
    };
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Bad />)).toThrow(/inside <ProselineEditor>/);
  });
});
