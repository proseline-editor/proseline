import type { JSONContent } from '@tiptap/core';
import type { CommentThread } from '@proseline-editor/core/features';
import type { ExportDocument } from './types.js';

// Shared test input: a chapter heading and two scenes with every kind of content.
export const p = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content });
export const t = (text: string, marks: string[] = []): JSONContent => ({ type: 'text', text, ...(marks.length ? { marks: marks.map((type) => ({ type })) } : {}) });
const li = (...content: JSONContent[]): JSONContent => ({ type: 'listItem', content });

export const thread: CommentThread = {
  id: 't1',
  docId: 's1',
  anchor: { type: 'position', quote: 'harbour' },
  resolved: false,
  createdAt: '2026-10-20T10:00:00Z',
  comments: [
    { id: 'c1', authorId: 'u1', authorName: 'Ann Lee', body: 'Which harbour?', createdAt: '2026-10-20T10:00:00Z' },
    { id: 'c2', authorId: 'u2', authorName: 'Bo', body: 'The old one.\nNorth side.', createdAt: '2026-10-20T11:00:00Z' },
  ],
};

export const DOCUMENTS: ExportDocument[] = [
  { title: 'Chapter One', level: 1 },
  {
    content: {
      type: 'doc',
      content: [
        p(t('Mara counted the boats in the '), t('harbour', ['italic']), t('.')),
        p(t('"Tonight," said '), { type: 'mention', attrs: { id: 'g', label: 'Ґордій', kind: 'character', case: null } }, t('. *Not* a [joke]')),
        { type: 'paragraph', attrs: { style: 'letter' }, content: [t('Dear brother,'), { type: 'hardBreak' }, t('come home.')] },
        { type: 'blockquote', content: [p(t('An old saying.'))] },
        { type: 'bulletList', content: [li(p(t('nets'))), li(p(t('rope')))] },
      ],
    },
    comments: [thread],
  },
  { content: { type: 'doc', content: [p(t('Morning came.', ['bold'])), { type: 'horizontalRule' }, { type: 'paragraph', attrs: { style: 'centered' }, content: [t('The End')] }] } },
];
