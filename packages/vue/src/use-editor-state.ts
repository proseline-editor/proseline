import { onScopeDispose, shallowRef, type ShallowRef } from 'vue';
import type { Editor } from '@tiptap/core';
import { useProseline } from './context.js';

const shallowEqual = (a: Record<string, unknown>, b: Record<string, unknown>) => Object.keys(a).every((key) => Object.is(a[key], b[key]));

/** A selection of the TipTap editor's state (active marks, can-undo…), recomputed on every transaction. */
export const useEditorState = <T extends Record<string, unknown>>(select: (editor: Editor) => T): ShallowRef<T> => {
  const { tiptap } = useProseline();
  const state = shallowRef(select(tiptap)) as ShallowRef<T>;
  const update = () => {
    const next = select(tiptap);
    if (!shallowEqual(next, state.value)) state.value = next;
  };
  // `update` also fires on setEditable, which changes no state but the editable flag.
  tiptap.on('transaction', update);
  tiptap.on('update', update);
  onScopeDispose(() => {
    tiptap.off('transaction', update);
    tiptap.off('update', update);
  });
  return state;
};
