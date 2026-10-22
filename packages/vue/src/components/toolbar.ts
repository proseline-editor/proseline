import { defineComponent, h } from 'vue';
import { PARAGRAPH_STYLES, type ParagraphStyleName } from '@proseline-editor/core';
import type {} from '@proseline-editor/core/features';
import { useProseline } from '../context.js';
import { useController } from '../use-controller.js';
import { useEditorState } from '../use-editor-state.js';
import { ToolbarButton } from './toolbar-button.js';
import { icons } from './icons.js';

const ALIGNMENTS = [
  ['left', 'alignLeft'],
  ['center', 'alignCenter'],
  ['right', 'alignRight'],
  ['justify', 'alignJustify'],
] as const;

const group = (...children: unknown[]) => h('div', { class: 'pl-group' }, children.flat().filter(Boolean) as never);

/** Formatting toolbar. Feature controls (styles, comments, find, style analysis) appear only when those features are enabled; the default slot adds host controls at the end. */
export const Toolbar = defineComponent({
  name: 'Toolbar',
  setup(_, { slots }) {
    const editor = useProseline();
    const { t, tiptap } = editor;
    const styles = useController('paragraphStyles');
    const find = useController('findReplace');
    const comments = useController('comments');
    const style = useController('styleAnalysis');
    const s = useEditorState((e) => ({
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
    }));
    const run = () => tiptap.chain().focus();
    const button = (label: string, onClick: () => void, icon: () => unknown, opts: { active?: boolean; disabled?: boolean } = {}) =>
      h(ToolbarButton, { label, onClick, active: opts.active, disabled: opts.disabled ?? false }, { default: icon });

    return () => {
      const v = s.value;
      const off = !v.editable;
      const st = styles.value;
      return h('div', { role: 'toolbar', 'aria-label': t('toolbar.label'), class: 'pl-toolbar' }, [
        group(
          button(t('toolbar.undo'), () => run().undo().run(), icons.undo, { disabled: off || !v.canUndo }),
          button(t('toolbar.redo'), () => run().redo().run(), icons.redo, { disabled: off || !v.canRedo }),
        ),
        group(
          button(t('toolbar.bold'), () => run().toggleBold().run(), icons.bold, { active: v.bold, disabled: off }),
          button(t('toolbar.italic'), () => run().toggleItalic().run(), icons.italic, { active: v.italic, disabled: off }),
          button(t('toolbar.underline'), () => run().toggleUnderline().run(), icons.underline, { active: v.underline, disabled: off }),
          button(t('toolbar.strike'), () => run().toggleStrike().run(), icons.strike, { active: v.strike, disabled: off }),
        ),
        group(
          ([1, 2, 3] as const).map((level) =>
            button(t('toolbar.heading', { level }), () => run().toggleHeading({ level }).run(), () => h('span', { class: 'pl-text-icon' }, `H${level}`), { active: v[`h${level}`], disabled: off }),
          ),
          st && [
            h(
              'select',
              {
                class: 'pl-select',
                'aria-label': t('toolbar.paragraphStyle'),
                value: st.state.style ?? '',
                disabled: off || !st.state.available,
                onChange: (e: Event) => st.commands.setStyle((e.target as HTMLSelectElement).value as ParagraphStyleName),
              },
              [
                st.state.style === null && h('option', { value: '' }, t('toolbar.mixed')),
                ...PARAGRAPH_STYLES.map((name) => h('option', { value: name }, t(`paragraphStyles.${name}`))),
              ],
            ),
            button(t('paragraphStyles.flush'), () => st.commands.toggleFlush(), icons.flush, { active: st.state.flush, disabled: off || !st.state.available }),
          ],
        ),
        group(
          button(t('toolbar.blockquote'), () => run().toggleBlockquote().run(), icons.blockquote, { active: v.blockquote, disabled: off }),
          button(t('toolbar.bulletList'), () => run().toggleBulletList().run(), icons.bulletList, { active: v.bulletList, disabled: off }),
          button(t('toolbar.orderedList'), () => run().toggleOrderedList().run(), icons.orderedList, { active: v.orderedList, disabled: off }),
          button(t('toolbar.sceneBreak'), () => run().setHorizontalRule().run(), icons.sceneBreak, { disabled: off }),
        ),
        group(ALIGNMENTS.map(([align, key]) => button(t(`toolbar.${key}`), () => run().setTextAlign(align).run(), icons[key], { active: v.align === align, disabled: off }))),
        comments.value?.state.allowed && group(button(t('comments.add'), () => comments.value!.commands.startComment(), icons.comment, { disabled: !comments.value.state.canComment })),
        (find.value || style.value) &&
          group(
            find.value && button(t('toolbar.find'), () => (find.value!.state.open ? find.value!.commands.close() : find.value!.commands.open()), icons.search, { active: find.value.state.open }),
            style.value && button(t('styleAnalysis.toggle'), () => style.value!.commands.toggle(), icons.style, { active: style.value.state.enabled }),
          ),
        slots.default?.(),
      ]);
    };
  },
});
