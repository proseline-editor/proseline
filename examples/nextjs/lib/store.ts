import type { JSONContent } from '@tiptap/core';

// The example keeps one manuscript in server memory. A real app stores ProseMirror JSON (or, with
// collaboration, Yjs updates) in its database.
const SAMPLE: JSONContent = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Chapter One' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'The rain had not stopped for three days.' }] },
  ],
};

// On globalThis: Next bundles route handlers and pages separately, each with its own copy of this
// module, but they run in one server process.
const store = globalThis as typeof globalThis & { proselineManuscript?: JSONContent };

export const loadManuscript = (): JSONContent => store.proselineManuscript ?? SAMPLE;
export const saveManuscript = (content: JSONContent): void => {
  store.proselineManuscript = content;
};
