import { inject, type InjectionKey, type ShallowRef } from 'vue';
import type { ProselineEditor } from '@proseline-editor/core';

export const PROSELINE: InjectionKey<ShallowRef<ProselineEditor | null>> = Symbol('proseline');

/** The editor of the nearest <ProselineEditor>. Throws outside one (children render once the editor exists). */
export const useProseline = (): ProselineEditor => {
  const editor = inject(PROSELINE, null)?.value;
  if (!editor) throw new Error('useProseline must be used inside <ProselineEditor>');
  return editor;
};
