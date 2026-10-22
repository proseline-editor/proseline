import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './index.js';
import { DOCUMENTS, p, t } from './test-fixtures.js';

describe('renderMarkdown', () => {
  it('writes headings, emphasis, escapes, breaks, quotes, lists and scene breaks', async () => {
    const { text, warnings } = await renderMarkdown({ documents: DOCUMENTS, resolveMention: () => 'Gordiy' });
    expect(warnings).toEqual([]);
    expect(text).toBe(`# Chapter One

Mara counted the boats in the *harbour*.

"Tonight," said Gordiy. \\*Not\\* a \\[joke\\]

Dear brother,\\
come home.

> An old saying.

- nets

- rope

* * *

**Morning came.**

* * *

The End
`);
  });

  it('keeps delimiters off edge spaces, escapes line starts and encodes link targets', async () => {
    const { text } = await renderMarkdown({
      documents: [{ content: { type: 'doc', content: [
        p(t('so '), t(' very ', ['bold']), t('loud')),
        p(t('# not a heading')),
        p({ type: 'text', text: 'site', marks: [{ type: 'link', attrs: { href: 'https://x.test/a (b)' } }] }),
        p({ type: 'text', text: 'bad', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }),
      ] } }],
      sceneBreak: '#',
    });
    expect(text).toBe('so  **very** loud\n\n\\# not a heading\n\n[site](https://x.test/a%20%28b%29)\n\nbad\n');
  });
});
