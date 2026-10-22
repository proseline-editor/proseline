'use client';

import { useState } from 'react';
import type { JSONContent } from '@tiptap/core';
import type { ProselineEditor as Editor } from '@proseline-editor/core';
import { findReplace, stats, typography } from '@proseline-editor/core/features';
import { FindReplace, ProselineContent, ProselineEditor, StatsBar, Toolbar } from '@proseline-editor/react';

/**
 * The editor is a client component. It is created after mount (no server rendering of the editing
 * surface); the server passes the stored document as `initial`.
 */
export const Manuscript = ({ initial }: { initial: JSONContent }) => {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [status, setStatus] = useState('');
  const save = async () => {
    if (!editor) return;
    setStatus('Saving…');
    const res = await fetch('/api/manuscript', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editor.getJSON()) });
    setStatus(res.ok ? 'Saved' : 'Save failed');
  };
  return (
    <ProselineEditor content={initial} features={[typography(), findReplace(), stats()]} onReady={setEditor} onChange={() => setStatus('')} className="app-editor">
      <Toolbar>
        <div className="pl-group">
          <button type="button" className="pl-text-button" onClick={() => void save()}>Save</button>
          <a className="pl-text-button" href="/api/export">Download DOCX</a>
          <a className="pl-text-button" href="/read">Read</a>
          <span role="status" className="pl-hint">{status}</span>
        </div>
      </Toolbar>
      <FindReplace />
      <ProselineContent />
      <StatsBar />
    </ProselineEditor>
  );
};
