import type { Editor } from '@tiptap/core';

/**
 * Types text one character at a time through ProseMirror's handleTextInput prop, so input rules
 * fire exactly as they do for a real keyboard. Falls back to a plain insert when no rule handles it.
 */
export const typeText = (editor: Editor, text: string): void => {
  for (const ch of text) {
    const { view } = editor;
    const { from, to } = view.state.selection;
    const handled = view.someProp('handleTextInput', (f) =>
      f(view, from, to, ch, () => view.state.tr.insertText(ch, from, to)),
    );
    if (!handled) view.dispatch(view.state.tr.insertText(ch, from, to));
  }
};

/** Puts the caret at the end of the document. */
export const caretToEnd = (editor: Editor): void => {
  editor.commands.setTextSelection(editor.state.doc.content.size - 1);
};
