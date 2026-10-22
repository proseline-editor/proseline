import type { ReactNode } from 'react';
import { useEditorState } from '@tiptap/react';
import { PARAGRAPH_STYLES, type ParagraphStyleName } from '@proseline-editor/core';
import type {} from '@proseline-editor/core/features';
import { useProseline } from '../context.js';
import { useController } from '../use-controller.js';
import { ToolbarButton } from './toolbar-button.js';
import { icons } from './icons.js';

export interface ToolbarProps {
  className?: string;
  /** Extra controls appended at the end (e.g. host-specific buttons). */
  children?: ReactNode;
}

const ALIGNMENTS = [
  ['left', 'alignLeft'],
  ['center', 'alignCenter'],
  ['right', 'alignRight'],
  ['justify', 'alignJustify'],
] as const;

/** Formatting toolbar. Feature controls (styles, find) appear only when those features are enabled. */
export const Toolbar = ({ className, children }: ToolbarProps) => {
  const editor = useProseline();
  const { t, tiptap } = editor;
  const styles = useController('paragraphStyles');
  const find = useController('findReplace');
  const comments = useController('comments');
  const style = useController('styleAnalysis');
  const s = useEditorState({
    editor: tiptap,
    selector: ({ editor: e }) => ({
      editable: e.isEditable,
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      h1: e.isActive('heading', { level: 1 }),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      blockquote: e.isActive('blockquote'),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      align: (['left', 'center', 'right', 'justify'] as const).find((a) => e.isActive({ textAlign: a })) ?? 'left',
    }),
  });
  if (!s) return null;
  const off = !s.editable;
  const run = () => tiptap.chain().focus();

  return (
    <div role="toolbar" aria-label={t('toolbar.label')} className={['pl-toolbar', className].filter(Boolean).join(' ')}>
      <div className="pl-group">
        <ToolbarButton label={t('toolbar.undo')} disabled={off || !s.canUndo} onClick={() => run().undo().run()}>{icons.undo}</ToolbarButton>
        <ToolbarButton label={t('toolbar.redo')} disabled={off || !s.canRedo} onClick={() => run().redo().run()}>{icons.redo}</ToolbarButton>
      </div>
      <div className="pl-group">
        <ToolbarButton label={t('toolbar.bold')} active={s.bold} disabled={off} onClick={() => run().toggleBold().run()}>{icons.bold}</ToolbarButton>
        <ToolbarButton label={t('toolbar.italic')} active={s.italic} disabled={off} onClick={() => run().toggleItalic().run()}>{icons.italic}</ToolbarButton>
        <ToolbarButton label={t('toolbar.underline')} active={s.underline} disabled={off} onClick={() => run().toggleUnderline().run()}>{icons.underline}</ToolbarButton>
        <ToolbarButton label={t('toolbar.strike')} active={s.strike} disabled={off} onClick={() => run().toggleStrike().run()}>{icons.strike}</ToolbarButton>
      </div>
      <div className="pl-group">
        {([1, 2, 3] as const).map((level) => (
          <ToolbarButton key={level} label={t('toolbar.heading', { level })} active={s[`h${level}`]} disabled={off} onClick={() => run().toggleHeading({ level }).run()}>
            <span className="pl-text-icon">H{level}</span>
          </ToolbarButton>
        ))}
        {styles && (
          <>
            <select
              className="pl-select"
              aria-label={t('toolbar.paragraphStyle')}
              value={styles.state.style ?? ''}
              disabled={off || !styles.state.available}
              onChange={(e) => styles.commands.setStyle(e.target.value as ParagraphStyleName)}
            >
              {styles.state.style === null && <option value="">{t('toolbar.mixed')}</option>}
              {PARAGRAPH_STYLES.map((name) => (
                <option key={name} value={name}>{t(`paragraphStyles.${name}`)}</option>
              ))}
            </select>
            <ToolbarButton label={t('paragraphStyles.flush')} active={styles.state.flush} disabled={off || !styles.state.available} onClick={() => styles.commands.toggleFlush()}>{icons.flush}</ToolbarButton>
          </>
        )}
      </div>
      <div className="pl-group">
        <ToolbarButton label={t('toolbar.blockquote')} active={s.blockquote} disabled={off} onClick={() => run().toggleBlockquote().run()}>{icons.blockquote}</ToolbarButton>
        <ToolbarButton label={t('toolbar.bulletList')} active={s.bulletList} disabled={off} onClick={() => run().toggleBulletList().run()}>{icons.bulletList}</ToolbarButton>
        <ToolbarButton label={t('toolbar.orderedList')} active={s.orderedList} disabled={off} onClick={() => run().toggleOrderedList().run()}>{icons.orderedList}</ToolbarButton>
        <ToolbarButton label={t('toolbar.sceneBreak')} disabled={off} onClick={() => run().setHorizontalRule().run()}>{icons.sceneBreak}</ToolbarButton>
      </div>
      <div className="pl-group">
        {ALIGNMENTS.map(([align, key]) => (
          <ToolbarButton key={align} label={t(`toolbar.${key}`)} active={s.align === align} disabled={off} onClick={() => run().setTextAlign(align).run()}>{icons[key]}</ToolbarButton>
        ))}
      </div>
      {comments?.state.allowed && (
        <div className="pl-group">
          <ToolbarButton label={t('comments.add')} disabled={!comments.state.canComment} onClick={() => comments.commands.startComment()}>{icons.comment}</ToolbarButton>
        </div>
      )}
      {(find || style) && (
        <div className="pl-group">
          {find && <ToolbarButton label={t('toolbar.find')} active={find.state.open} onClick={() => (find.state.open ? find.commands.close() : find.commands.open())}>{icons.search}</ToolbarButton>}
          {style && <ToolbarButton label={t('styleAnalysis.toggle')} active={style.state.enabled} onClick={() => style.commands.toggle()}>{icons.style}</ToolbarButton>}
        </div>
      )}
      {children}
    </div>
  );
};
