import { useRef, useState } from 'react';
import { importManuscript, joinDocuments } from '@proseline-editor/export';
import { useProseline } from '@proseline-editor/react';

/** Replaces the document with an imported DOCX, Markdown or HTML file; lists what could not be imported. */
export const ImportButton = () => {
  const editor = useProseline();
  const input = useRef<HTMLInputElement>(null);
  const [warnings, setWarnings] = useState<string[] | null>(null);
  const load = async (file: File) => {
    const { documents, warnings: found } = await importManuscript(file, { split: 'headings' });
    editor.tiptap.commands.setContent(joinDocuments(documents));
    setWarnings(found);
  };
  return (
    <div className="pl-group">
      <button type="button" className="pl-text-button" onClick={() => input.current?.click()}>Import…</button>
      <input
        ref={input}
        type="file"
        hidden
        aria-label="Import file"
        accept=".docx,.md,.markdown,.html,.htm"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void load(file);
        }}
      />
      {warnings && (
        <span role="status" className="pl-hint" title={warnings.join('\n')}>
          {warnings.length ? `Imported, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}` : 'Imported'}
        </span>
      )}
    </div>
  );
};
