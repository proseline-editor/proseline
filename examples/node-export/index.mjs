// Proseline on a server, without a browser: derive a collaborative document's content, export it
// to Markdown and DOCX, and import the DOCX back. CI also runs it on the oldest supported Node.
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import { exportManuscript, importManuscript, renderMarkdown } from '@proseline-editor/export';
import { deriveJSON, htmlToUpdate } from '@proseline-editor/sync/server';

const state = htmlToUpdate('<h1>One</h1><p>Hello <em>world</em>.</p>');
const content = deriveJSON(state);
const { text } = await renderMarkdown({ documents: [{ content }] });
assert.equal(text, '# One\n\nHello *world*.\n');
const docx = await exportManuscript({ format: 'docx', documents: [{ content }, { content: '<p>From HTML.</p>' }] });
const back = await importManuscript(new Uint8Array(await docx.blob.arrayBuffer()));
assert.deepEqual(back.warnings, []);
assert.equal(back.documents[0].content.content.length, 4); // heading, paragraph, scene break, paragraph
assert.ok(Y.encodeStateVector(new Y.Doc()).length > 0);
process.stdout.write(`Node ${process.version}: export, import and sync/server work.\n`);
