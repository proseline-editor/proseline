import { h, nextTick, type Component } from 'vue';
import { render } from '@testing-library/vue';
import type { AnyFeature, ProselineEditor as Editor } from '@proseline-editor/core';
import { ProselineEditor } from './proseline-editor.js';
import { ProselineContent } from './proseline-content.js';

export interface MountOptions {
  content?: string;
  editable?: boolean;
  features?: AnyFeature[];
  locale?: string;
  /** Components rendered after the surface (or the slot children returned by a function). */
  children?: Component[] | (() => unknown[]);
}

/** Renders <ProselineEditor> with the surface and the given components; resolves with the editor once it exists. */
export const mount = async (options: MountOptions = {}): Promise<{ editor: Editor; container: Element; rerender: (props: Record<string, unknown>) => Promise<void> }> => {
  let editor: Editor | null = null;
  const children = options.children ?? [];
  const { container, rerender } = render(ProselineEditor, {
    props: { content: options.content, editable: options.editable ?? true, features: options.features, locale: options.locale, onReady: (e: Editor) => (editor = e) },
    slots: { default: typeof children === 'function' ? children : () => [h(ProselineContent), ...children.map((c) => h(c))] },
  });
  await nextTick();
  return { editor: editor as unknown as Editor, container, rerender };
};

/** Lets pending store promises settle and Vue re-render. */
export const flush = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
};
