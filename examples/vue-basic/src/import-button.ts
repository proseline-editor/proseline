import { defineComponent, h, ref } from 'vue';
import { importManuscript, joinDocuments } from '@proseline-editor/export';
import { useProseline } from '@proseline-editor/vue';

/** Replaces the document with an imported DOCX, Markdown or HTML file; lists what could not be imported. */
export const ImportButton = defineComponent({
  name: 'ImportButton',
  setup() {
    const editor = useProseline();
    const input = ref<HTMLInputElement | null>(null);
    const warnings = ref<string[] | null>(null);
    const load = async (file: File) => {
      const { documents, warnings: found } = await importManuscript(file, { split: 'headings' });
      editor.tiptap.commands.setContent(joinDocuments(documents));
      warnings.value = found;
    };
    return () => {
      const w = warnings.value;
      return h('div', { class: 'pl-group' }, [
        h('button', { type: 'button', class: 'pl-text-button', onClick: () => input.value?.click() }, 'Import…'),
        h('input', {
          ref: input,
          type: 'file',
          hidden: true,
          'aria-label': 'Import file',
          accept: '.docx,.md,.markdown,.html,.htm',
          onChange: (e: Event) => {
            const target = e.target as HTMLInputElement;
            const file = target.files?.[0];
            target.value = '';
            if (file) void load(file);
          },
        }),
        w && h('span', { role: 'status', class: 'pl-hint', title: w.join('\n') }, w.length ? `Imported, ${w.length} warning${w.length === 1 ? '' : 's'}` : 'Imported'),
      ]);
    };
  },
});
