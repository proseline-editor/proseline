import { EditorContent } from '@tiptap/react';
import { useProseline } from './context.js';

export interface ProselineContentProps {
  className?: string;
}

/** The writing surface. Place it anywhere inside <ProselineEditor>; rendered by default when there are no children. */
export const ProselineContent = ({ className }: ProselineContentProps) => {
  const editor = useProseline();
  return <EditorContent editor={editor.tiptap} className={['pl-content', className].filter(Boolean).join(' ')} />;
};
