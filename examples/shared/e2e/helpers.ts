import type { Page } from '@playwright/test';

export const surface = (page: Page) => page.locator('.ProseMirror');

/** The editor's own state and commands, which TipTap exposes on its DOM element (both adapters). */
interface EditorLike {
  isFocused: boolean;
  state: {
    selection: { from: number; to: number };
    doc: {
      content: { size: number };
      textBetween(from: number, to: number): string;
      descendants(f: (node: { isText: boolean; text?: string }, pos: number) => boolean | void): void;
    };
  };
  commands: { focus(position?: 'end'): boolean; setTextSelection(range: { from: number; to: number }): boolean };
}

/**
 * Puts the caret at the end of the document. A setup step, so it goes through the editor's API, then
 * waits until the editor has focus there (TipTap focuses on the next animation frame). No click
 * first: ProseMirror reads a click's selection asynchronously and could move the caret back.
 */
export const caretToEnd = async (page: Page) => {
  await page.evaluate(() => (document.querySelector('.ProseMirror') as unknown as { editor: EditorLike }).editor.commands.focus('end'));
  await page.waitForFunction(() => {
    const editor = (document.querySelector('.ProseMirror') as unknown as { editor: EditorLike }).editor;
    return editor.isFocused && editor.state.selection.to >= editor.state.doc.content.size - 1;
  });
};

/** Selects the first occurrence of `text` through the editor's API (setup; mouse selection has its own test). */
export const selectText = async (page: Page, text: string) => {
  await page.evaluate((t) => {
    const editor = (document.querySelector('.ProseMirror') as unknown as { editor: EditorLike }).editor;
    let range: { from: number; to: number } | null = null;
    editor.state.doc.descendants((node, pos) => {
      const at = node.isText ? (node.text ?? '').indexOf(t) : -1;
      if (!range && at >= 0) range = { from: pos + at, to: pos + at + t.length };
      return !range;
    });
    if (!range) throw new Error(`"${t}" is not in the editor`);
    editor.commands.focus();
    editor.commands.setTextSelection(range);
  }, text);
  await waitForSelection(page, text);
};

/** Waits until the editor's selection covers exactly `text` (after a mouse selection). */
export const waitForSelection = async (page: Page, text: string, timeout?: number) => {
  await page.waitForFunction((expected) => {
    const editor = (document.querySelector('.ProseMirror') as unknown as { editor?: EditorLike }).editor;
    if (!editor) return false;
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to) === expected;
  }, text, { timeout });
};

/**
 * Double- or triple-clicks `word` until the editor selects `expected`. Under heavy load headless
 * Firefox and WebKit occasionally register a multi-click as a single click (about 1 in 15 runs:
 * the caret lands in the word, nothing is selected); a writer would simply click again.
 */
export const multiClick = async (page: Page, word: string, clickCount: 2 | 3, expected: string) => {
  for (let attempt = 1; ; attempt++) {
    const { x, y } = await wordCenter(page, word);
    await page.mouse.click(x, y, { clickCount });
    try {
      await waitForSelection(page, expected, 2000);
      return;
    } catch (error) {
      if (attempt === 3) throw error;
    }
  }
};

export const typeAtEnd = async (page: Page, text: string) => {
  await caretToEnd(page);
  await page.keyboard.type(text);
};

/** Viewport centre of the first occurrence of `word` in the editor. */
export const wordCenter = async (page: Page, word: string) =>
  page.evaluate((w) => {
    const walker = document.createTreeWalker(document.querySelector('.ProseMirror')!, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.textContent!.indexOf(w);
      if (at < 0) continue;
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + w.length);
      const r = range.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    throw new Error(`"${w}" is not in the editor`);
  }, word);

/**
 * Pastes HTML and plain text through the editor's own paste handling. The clipboard data is a
 * stand-in object: Firefox empties the DataTransfer of a script-created ClipboardEvent.
 */
export const paste = async (page: Page, html: string, text: string) => {
  await page.evaluate(
    ([h, t]) => {
      const items: Record<string, string> = { 'text/html': h!, 'text/plain': t! };
      const event = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'clipboardData', { value: { types: Object.keys(items), files: [], getData: (type: string) => items[type] ?? '' } });
      document.querySelector('.ProseMirror')!.dispatchEvent(event);
    },
    [html, text],
  );
};
