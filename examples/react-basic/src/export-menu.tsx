import { exportManuscript, type ExportFormat } from '@proseline-editor/export';
import { mentionText, type CommentStore } from '@proseline-editor/core/features';
import { useProseline } from '@proseline-editor/react';
import { ENTITIES } from 'example-shared/sample';

const FORMATS: [ExportFormat, string][] = [
  ['docx', 'Word (.docx)'],
  ['markdown', 'Markdown (.md)'],
  ['html', 'Web page (.html)'],
];

/** Downloads the document as DOCX, Markdown or HTML, with its comments and mentions resolved. */
export const ExportMenu = ({ commentStore }: { commentStore: CommentStore }) => {
  const editor = useProseline();
  const run = async (format: ExportFormat) => {
    const { blob, extension } = await exportManuscript({
      format,
      documents: [{ content: editor.getJSON(), comments: await commentStore.list('sample') }],
      resolveMention: (id, mentionCase) => {
        const entity = ENTITIES.find((e) => e.id === id);
        return entity ? mentionText({ name: entity.label, forms: entity.forms ?? null }, mentionCase)?.text : null;
      },
      metadata: { title: 'Salt and Tide', author: 'Ann Lee', language: editor.t.locale },
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `salt-and-tide.${extension}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return (
    <div className="pl-group">
      <select
        className="pl-select"
        aria-label="Export"
        value=""
        onChange={(e) => {
          if (e.target.value) void run(e.target.value as ExportFormat);
        }}
      >
        <option value="">Export…</option>
        {FORMATS.map(([format, label]) => (
          <option key={format} value={format}>{label}</option>
        ))}
      </select>
    </div>
  );
};
