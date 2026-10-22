import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

const BREAK_MARK = /^(?:[*#~⁂•·◆◇✦❧-]\s*){1,7}$/u;

/** True for text that writers type as a scene break: `***`, `* * *`, `#`, `⁂`, `~ ~ ~`… */
export const isBreakMark = (text: string): boolean => BREAK_MARK.test(text.trim());

const BLOCKS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'DIV', 'HR', 'TABLE']);
const WORD_LIST = /mso-list:\s*(l\d+)\s+level(\d+)/i;
const ORDERED_MARKER = /^\(?(?:\d{1,3}|[a-z]|[ivxlc]{1,5})[.)]$/i;

const unwrap = (el: Element) => el.replaceWith(...Array.from(el.childNodes));

/**
 * Word writes list items as paragraphs (`mso-list: l0 level1`) whose marker is a text span. They
 * become real nested lists; the marker decides bullets or numbers.
 */
const wordLists = (body: HTMLElement) => {
  const doc = body.ownerDocument;
  let stack: { level: number; list: HTMLElement; key: string }[] = [];
  let last: Element | null = null;
  for (const p of Array.from(body.querySelectorAll('p'))) {
    const match = WORD_LIST.exec(p.getAttribute('style') ?? '');
    if (!match) continue;
    const level = Number(match[2]);
    const ignore = p.querySelector('[style*="mso-list:Ignore"], [style*="mso-list: Ignore"]');
    const marker = (ignore?.textContent ?? '').replace(/\s+/g, '');
    ignore?.remove();
    // A new list starts unless this paragraph directly follows an item of the same Word list (l0, l1…).
    let prev = p.previousSibling;
    while (prev && prev.nodeType !== 1) prev = prev.previousSibling;
    if (prev !== last || stack[0]?.key !== match[1]) stack = [];
    const ordered = ORDERED_MARKER.test(marker) && marker !== 'o';
    while (stack.length && stack[stack.length - 1]!.level > level) stack.pop();
    let top = stack[stack.length - 1];
    if (!top || top.level < level) {
      const list = doc.createElement(ordered ? 'ol' : 'ul');
      if (top) (top.list.lastElementChild ?? top.list).append(list);
      else p.before(list);
      top = { level, list, key: match[1]! };
      stack.push(top);
    }
    const li = doc.createElement('li');
    top.list.append(li);
    p.removeAttribute('style');
    p.removeAttribute('class');
    li.append(p);
    // The next item, if it continues this list, will now follow the outermost list element.
    last = stack[0]!.list;
  }
};

/**
 * Cleans HTML pasted from Word and Google Docs before ProseMirror parses it: real lists from Word's
 * list paragraphs, no Office markup, blank lines as empty paragraphs (not hard breaks), and break
 * marks (`* * *`) as scene breaks. Formatting itself (bold, italic…) is left to the schema's rules.
 */
export const cleanPastedHTML = (html: string): string => {
  if (typeof DOMParser === 'undefined') return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const { body } = doc;
  wordLists(body);
  body.querySelectorAll('[style*="mso-list:Ignore"], [style*="mso-list: Ignore"]').forEach((el) => el.remove());
  for (const el of Array.from(body.getElementsByTagName('*'))) if (el.tagName.includes(':')) unwrap(el); // <o:p>, <w:…>
  body.querySelectorAll('br.Apple-interchange-newline').forEach((el) => el.remove());
  // Google Docs marks an empty line between blocks with a bare <br> (inside its <b> wrapper).
  for (const br of Array.from(body.querySelectorAll('br'))) {
    const between = [br.previousElementSibling, br.nextElementSibling].some((el) => el && BLOCKS.has(el.tagName));
    if (between) br.replaceWith(doc.createElement('p'));
  }
  for (const p of Array.from(body.querySelectorAll('p'))) {
    const text = p.textContent ?? '';
    if (!text.replace(/\s/g, '') && !p.querySelector('img, br')) p.replaceChildren();
    else if (isBreakMark(text) && !p.closest('li')) p.replaceWith(doc.createElement('hr'));
  }
  return body.innerHTML;
};

/** Installs `cleanPastedHTML` for every paste. Part of the prose schema's extensions. */
export const PasteCleanup = Extension.create({
  name: 'proselinePasteCleanup',
  addProseMirrorPlugins: () => [new Plugin({ key: new PluginKey('proselinePasteCleanup'), props: { transformPastedHTML: cleanPastedHTML } })],
});
