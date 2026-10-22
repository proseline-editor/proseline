import Paragraph from '@tiptap/extension-paragraph';

/** Semantic paragraph styles. `body` is the default and is not written to HTML. */
export const PARAGRAPH_STYLES = ['body', 'epigraph', 'letter', 'centered'] as const;
export type ParagraphStyleName = (typeof PARAGRAPH_STYLES)[number];

export const isParagraphStyle = (value: unknown): value is ParagraphStyleName =>
  typeof value === 'string' && (PARAGRAPH_STYLES as readonly string[]).includes(value);

/**
 * Paragraph with two attributes:
 * - `firstLineIndent` (WorldForge-compatible, `data-indent="false"` when off) — the book convention
 *   of a flush opening paragraph;
 * - `style` — semantic style rendered as `data-style`, mapped to named styles on export.
 */
export const ProseParagraph = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      firstLineIndent: {
        default: true,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-indent') !== 'false',
        renderHTML: (attrs: Record<string, unknown>) => (attrs.firstLineIndent ? {} : { 'data-indent': 'false' }),
      },
      style: {
        default: 'body',
        parseHTML: (el: HTMLElement) => {
          const value = el.getAttribute('data-style');
          return isParagraphStyle(value) ? value : 'body';
        },
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.style && attrs.style !== 'body' ? { 'data-style': String(attrs.style) } : {},
      },
    };
  },
});
