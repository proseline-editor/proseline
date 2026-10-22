import { describe, it, expect, afterEach, vi } from 'vitest';
import { h, nextTick } from 'vue';
import { render, screen, cleanup, fireEvent } from '@testing-library/vue';
import { comments, memoryCommentStore, type CommentsOptions } from '@proseline-editor/core/features';
import type { ProselineEditor as Editor } from '@proseline-editor/core';
import { ProselineEditor } from '../proseline-editor.js';
import { ProselineContent } from '../proseline-content.js';
import { flush, mount } from '../test-utils.js';
import { Toolbar } from './toolbar.js';
import { CommentsRail } from './comments-rail.js';

afterEach(cleanup);

const setup = async (opts: Partial<CommentsOptions> & { locale?: string } = {}) => {
  const store = opts.store ?? memoryCommentStore({ author: { id: 'ann', name: 'Ann' } });
  const { editor } = await mount({
    content: '<p>Hello brave world</p>',
    locale: opts.locale,
    features: [comments({ store, docId: 'd', ...opts })],
    children: () => [h(Toolbar), h(ProselineContent), h(CommentsRail)],
  });
  await flush();
  return { editor, store };
};

const addComment = async (editor: Editor, body: string) => {
  editor.tiptap.commands.setTextSelection({ from: 7, to: 12 });
  await nextTick();
  await fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
  await fireEvent.update(screen.getByRole('textbox', { name: 'Write a comment…' }), body);
  await fireEvent.submit(screen.getByRole('textbox', { name: 'Write a comment…' }).closest('form')!);
  await flush();
};

describe('<CommentsRail>', () => {
  it('renders nothing without the comments feature', async () => {
    const { container } = render(ProselineEditor, { slots: { default: () => [h(CommentsRail)] } });
    await nextTick();
    expect(container.querySelector('.pl-comments')).toBeNull();
  });

  it('asks to select text when there are no threads', async () => {
    await setup();
    expect(screen.getByText('Select text to comment on it.')).toBeTruthy();
  });

  it('comments on the selection from the toolbar', async () => {
    const { editor } = await setup();
    expect((screen.getByRole('button', { name: 'Comment' }) as HTMLButtonElement).disabled).toBe(true);
    await addComment(editor, 'Why brave?');
    expect(screen.getByText('Why brave?')).toBeTruthy();
    expect(screen.getByText('brave', { selector: 'q' })).toBeTruthy();
    expect(screen.getByText('Ann')).toBeTruthy();
  });

  it('replies, resolves and hides resolved threads on request', async () => {
    const { editor } = await setup();
    await addComment(editor, 'root');
    await fireEvent.update(screen.getByRole('textbox', { name: 'Reply…' }), 'answer');
    await fireEvent.submit(screen.getByRole('textbox', { name: 'Reply…' }).closest('form')!);
    await flush();
    expect(screen.getByText('answer')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    await flush();
    expect(screen.getByRole('button', { name: 'Reopen' })).toBeTruthy();
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Show resolved' }));
    expect(screen.queryByText('root')).toBeNull();
  });

  it('deletes after confirmation', async () => {
    const { editor } = await setup();
    await addComment(editor, 'to delete');
    await fireEvent.click(screen.getByRole('button', { name: 'Delete thread' }));
    expect(screen.getByText('Delete this thread?')).toBeTruthy();
    await fireEvent.click(screen.getAllByRole('button', { name: 'Delete thread' })[0]!);
    await flush();
    expect(screen.queryByText('to delete')).toBeNull();
  });

  it('selects the commented text when the quote is clicked', async () => {
    const { editor } = await setup();
    await addComment(editor, 'note');
    editor.tiptap.commands.setTextSelection(1);
    await fireEvent.click(screen.getByText('brave', { selector: 'q' }));
    expect(editor.tiptap.state.selection).toMatchObject({ from: 7, to: 12 });
  });

  it('scrolls the active thread into view when its text is clicked', async () => {
    const { editor } = await setup();
    await addComment(editor, 'note');
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    editor.tiptap.view.someProp('handleClick', (f) => f(editor.tiptap.view, 9, new MouseEvent('click')));
    await flush();
    expect(scroll).toHaveBeenCalledWith({ block: 'nearest' });
    expect(document.querySelector('.pl-thread[data-active]')).not.toBeNull();
  });

  it('labels orphaned threads', async () => {
    const { editor } = await setup();
    await addComment(editor, 'note');
    editor.tiptap.chain().setTextSelection({ from: 6, to: 12 }).deleteSelection().run();
    await nextTick();
    expect(screen.getByText('Text removed')).toBeTruthy();
  });

  it('hides editing controls when commenting is not allowed', async () => {
    await setup({ allowComments: false });
    expect(screen.queryByRole('button', { name: 'Comment' })).toBeNull();
    expect(screen.getByText('No comments yet.')).toBeTruthy();
  });

  it('is translated', async () => {
    await setup({ locale: 'uk' });
    expect(screen.getByRole('complementary', { name: 'Коментарі' })).toBeTruthy();
  });
});
