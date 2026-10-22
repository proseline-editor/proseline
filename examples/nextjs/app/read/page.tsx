import { generateHTML } from '@tiptap/html';
import { proseExtensions } from '@proseline-editor/core';
import { loadManuscript } from '../../lib/store';

export const dynamic = 'force-dynamic';

/** A server-rendered reading view: the stored JSON as HTML, with the editor's schema and theme. */
const ReadPage = () => (
  <main className="pl-root">
    <article className="pl-content">
      <div className="ProseMirror" dangerouslySetInnerHTML={{ __html: generateHTML(loadManuscript(), proseExtensions()) }} />
    </article>
    <p className="nav">
      <a href="/">Edit</a>
    </p>
  </main>
);

export default ReadPage;
