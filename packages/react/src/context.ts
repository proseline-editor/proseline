import { createContext, useContext } from 'react';
import type { ProselineEditor } from '@proseline-editor/core';

export const ProselineContext = createContext<ProselineEditor | null>(null);

/** The editor of the nearest <ProselineEditor>. Throws outside one. */
export const useProseline = (): ProselineEditor => {
  const editor = useContext(ProselineContext);
  if (!editor) throw new Error('useProseline must be used inside <ProselineEditor>');
  return editor;
};
