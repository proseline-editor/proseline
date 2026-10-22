import { describe, it, expect, vi, afterEach } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { render, screen, cleanup, fireEvent } from '@testing-library/vue';
import { findReplace, focus } from '@proseline-editor/core/features';
import type { ProselineEditor as Editor } from '@proseline-editor/core';
import { ProselineEditor } from './proseline-editor.js';
import { ProselineContent } from './proseline-content.js';
import { useController } from './use-controller.js';
import { useProseline } from './context.js';

afterEach(cleanup);

const surface = (container: Element) => container.querySelector('.ProseMirror');

describe('<ProselineEditor>', () => {
  it('renders the content by default and emits ready', async () => {
    const onReady = vi.fn();
    const { container } = render(ProselineEditor, { props: { content: '<p>Hello</p>', onReady } });
    await nextTick();
    expect(surface(container)?.textContent).toBe('Hello');
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('places the surface where <ProselineContent /> is', async () => {
    const { container } = render(ProselineEditor, {
      props: { content: '<p>x</p>' },
      slots: { default: () => [h('header', 'top'), h(ProselineContent, { class: 'mine' })] },
    });
    await nextTick();
    const root = container.querySelector('.pl-root');
    expect(root?.firstElementChild?.tagName).toBe('HEADER');
    expect(container.querySelector('.pl-content.mine .ProseMirror')).not.toBeNull();
  });

  it('applies editable changes live and destroys the editor on unmount', async () => {
    let instance: Editor | null = null;
    const { rerender, unmount } = render(ProselineEditor, { props: { content: '<p>x</p>', onReady: (e: Editor) => (instance = e) } });
    await nextTick();
    expect(instance!.isEditable).toBe(true);
    await rerender({ editable: false });
    expect(instance!.isEditable).toBe(false);
    unmount();
    expect(instance!.tiptap.isDestroyed).toBe(true);
  });

  it('marks the root while distraction-free is on', async () => {
    let instance: Editor | null = null;
    const { container } = render(ProselineEditor, { props: { features: [focus()], onReady: (e: Editor) => (instance = e) } });
    await nextTick();
    instance!.feature('focus')!.commands.toggleDistractionFree();
    await nextTick();
    expect(container.querySelector('.pl-root')?.hasAttribute('data-distraction-free')).toBe(true);
  });
});

describe('useController', () => {
  const Probe = defineComponent({
    setup() {
      const find = useController('findReplace');
      const missing = useController('stats');
      return () =>
        h('div', [
          h('span', { 'data-testid': 'open' }, String(find.value?.state.open)),
          h('span', { 'data-testid': 'missing' }, String(missing.value)),
          h('button', { onClick: () => find.value?.commands.open() }, 'open'),
        ]);
    },
  });

  it('returns live state and null for absent features', async () => {
    render(ProselineEditor, { props: { features: [findReplace()] }, slots: { default: () => [h(Probe), h(ProselineContent)] } });
    await nextTick();
    expect(screen.getByTestId('open').textContent).toBe('false');
    expect(screen.getByTestId('missing').textContent).toBe('null');
    await fireEvent.click(screen.getByText('open'));
    expect(screen.getByTestId('open').textContent).toBe('true');
  });

  it('useProseline throws outside the provider', () => {
    const Bad = defineComponent({
      setup() {
        useProseline();
        return () => null;
      },
    });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(() => render(Bad)).toThrow(/inside <ProselineEditor>/);
  });
});
