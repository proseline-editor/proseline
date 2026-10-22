import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ProselineEditor as Editor } from '@proseline-editor/core';
import { findReplace, focus, paragraphStyles, stats, typography } from '@proseline-editor/core/features';
import { exportManuscript, importManuscript, joinDocuments } from '@proseline-editor/export';
import { FindReplace, FocusControls, ProselineContent, ProselineEditor, StatsBar, Toolbar } from '@proseline-editor/react';
import '@proseline-editor/react/theme.css';

const START = '<h1>Chapter One</h1><p>The rain had not stopped for three days.</p>';

const App = () => {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [status, setStatus] = useState('');

  // Files go through window.desktop (preload.cjs): the renderer has no Node access.
  const save = useCallback(async () => {
    if (!editor) return;
    const { blob } = await exportManuscript({ format: 'docx', documents: [{ content: editor.getJSON() }], metadata: { title: 'Manuscript' } });
    const path = await window.desktop.saveFile('manuscript.docx', new Uint8Array(await blob.arrayBuffer()));
    setStatus(path ? `Saved ${path.split(/[\\/]/).pop()}` : '');
  }, [editor]);

  const open = useCallback(async () => {
    if (!editor) return;
    const file = await window.desktop.openFile();
    if (!file) return;
    const { documents, warnings } = await importManuscript(new File([file.bytes as Uint8Array<ArrayBuffer>], file.name), { split: 'headings' });
    editor.tiptap.commands.setContent(joinDocuments(documents));
    setStatus(`Opened ${file.name}${warnings.length ? `, ${warnings.length} warning(s)` : ''}`);
  }, [editor]);

  // The native File menu (and its shortcuts) send the same commands.
  useEffect(() => window.desktop.onMenu((command) => void (command === 'save' ? save() : open())), [save, open]);

  return (
    <ProselineEditor content={START} features={[typography(), paragraphStyles(), findReplace(), stats(), focus()]} onReady={setEditor} className="app-editor">
      <Toolbar>
        <FocusControls />
        <div className="pl-group">
          <button type="button" className="pl-text-button" onClick={() => void open()}>Open…</button>
          <button type="button" className="pl-text-button" onClick={() => void save()}>Save as Word…</button>
          <span role="status" className="pl-hint">{status}</span>
        </div>
      </Toolbar>
      <FindReplace />
      <ProselineContent />
      <StatsBar />
    </ProselineEditor>
  );
};

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
