import { describe, it, expect, afterEach } from 'vitest';
import { createEditor, type ProselineEditor } from '../editor.js';

let editor: ProselineEditor | null = null;
afterEach(() => editor?.destroy());

const WF = '<p>Met <span data-mention-id="c1" data-kind="character" data-label="Ґордієві" data-case="dat" class="ms-mention">Ґордієві</span> today</p>';

describe('mention node (schema)', () => {
  it('loads WorldForge mentions without the mentions feature', () => {
    editor = createEditor({ content: WF });
    const mention = editor.getJSON().content?.[0]?.content?.[1];
    expect(mention).toEqual({ type: 'mention', attrs: { id: 'c1', label: 'Ґордієві', kind: 'character', case: 'dat' } });
    expect(editor.getHTML()).toBe('<p>Met <span class="pl-mention" data-mention-id="c1" data-label="Ґордієві" data-kind="character" data-case="dat">Ґордієві</span> today</p>');
  });

  it('counts the mention as text for word counts and plain text', () => {
    editor = createEditor({ content: WF });
    expect(editor.countDoc().words).toBe(3);
    expect(editor.getText()).toBe('Met Ґордієві today');
  });
});
