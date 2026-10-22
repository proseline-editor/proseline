import { describe, it, expect } from 'vitest';
import { renderHtml, bookPreset } from './index.js';
import { DOCUMENTS } from './test-fixtures.js';

describe('renderHtml', () => {
  it('writes a fragment with styles as classes, nested quotes and lists, escaped text', async () => {
    const { text } = await renderHtml({ documents: DOCUMENTS, fragment: true });
    expect(text).toBe(`<h1>Chapter One</h1>
<p>Mara counted the boats in the <em>harbour</em>.</p>
<p>"Tonight," said Ґордій. *Not* a [joke]</p>
<p class="letter">Dear brother,<br>come home.</p>
<blockquote>
<p>An old saying.</p>
</blockquote>
<ul>
<li>
<p>nets</p>
</li>
<li>
<p>rope</p>
</li>
</ul>
<p class="scene-break">* * *</p>
<p><strong>Morning came.</strong></p>
<p class="scene-break">* * *</p>
<p class="centered">The End</p>
`);
  });

  it('writes a standalone page styled by the preset, with metadata', async () => {
    const { text } = await renderHtml({ documents: DOCUMENTS, preset: 'book', metadata: { title: 'Salt & Tide', author: 'Ann Lee', language: 'en' } });
    expect(text).toMatch(/^<!doctype html>\n<html lang="en">/);
    expect(text).toContain('<title>Salt &amp; Tide</title>');
    expect(text).toContain('<meta name="author" content="Ann Lee">');
    expect(text).toContain(`font-family: "${bookPreset.font}", serif; font-size: 11pt; line-height: 1.5;`);
    expect(text).toContain('text-align: justify;');
    expect(text).toContain('h1 { break-before: page; }');
    // Book typesetting: the first paragraph after a heading or scene break is flush.
    expect(text).toContain('<p class="flush">Mara counted');
    expect(text).toContain('<p class="flush"><strong>Morning came.</strong></p>');
  });
});
