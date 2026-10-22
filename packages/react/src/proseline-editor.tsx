import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createEditor, type ProselineConfig, type ProselineEditor as Editor } from '@proseline-editor/core';
import { ProselineContext } from './context.js';
import { ProselineContent } from './proseline-content.js';

export interface ProselineEditorProps extends Omit<ProselineConfig, 'element'> {
  /** Called once the editor exists (and again after a remount). */
  onReady?: (editor: Editor) => void;
  className?: string;
  /** Toolbar, panels and <ProselineContent />. Defaults to just the writing surface. */
  children?: ReactNode;
}

const noopSubscribe = () => () => undefined;
const off = () => false;

/**
 * Creates the editor and provides it to child components. Configuration is read once on mount;
 * only `editable` is applied live. Change content later through `editor.tiptap.commands`.
 */
export const ProselineEditor = ({ children, className, onReady, onChange, editable = true, ...config }: ProselineEditorProps) => {
  const [editor, setEditor] = useState<Editor | null>(null);
  const initial = useRef(config);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    const instance = createEditor({ ...initial.current, editable, onChange: (e) => onChangeRef.current?.(e) });
    setEditor(instance);
    onReadyRef.current?.(instance);
    return () => {
      instance.destroy();
      setEditor(null);
    };
    // Created once per mount by design; `editable` is synced by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable);
  }, [editor, editable]);

  const focus = editor?.feature('focus');
  const distractionFree = useSyncExternalStore(
    focus?.subscribe ?? noopSubscribe,
    focus ? () => focus.getState().distractionFree : off,
    off,
  );

  const rootClass = ['pl-root', className].filter(Boolean).join(' ');
  if (!editor) return <div className={rootClass} aria-busy="true" />;
  return (
    <ProselineContext.Provider value={editor}>
      <div className={rootClass} data-distraction-free={distractionFree || undefined}>
        {children ?? <ProselineContent />}
      </div>
    </ProselineContext.Provider>
  );
};
