import { test, expect, type Browser, type Page } from '@playwright/test';

/** Each test uses its own document so tests can run in parallel against one server. */
const docName = (title: string) => `${title.replace(/\W+/g, '-')}-${Date.now()}`;

const writer = async (browser: Browser, doc: string, name: string, color: string, query = '') => {
  // Separate contexts = separate users with their own IndexedDB.
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/?doc=${doc}&name=${name}&color=${encodeURIComponent(color)}${query}`);
  await expect(page.locator('.ProseMirror')).toBeVisible();
  return { context, page };
};

/**
 * ProseMirror reads caret moves made by clicks and navigation keys on the async `selectionchange`
 * event. Commands such as Enter act on its state, so pause briefly after each move — far faster
 * than a person, slower than Playwright's back-to-back input.
 */
const settleCaret = (page: Page) => page.waitForTimeout(100);

const typeAtEnd = async (page: Page, text: string) => {
  await page.locator('.ProseMirror').click();
  await settleCaret(page);
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+ArrowDown' : 'Control+End');
  await settleCaret(page);
  await page.keyboard.type(text);
};

const status = (page: Page) => page.locator('.pl-sync [role=status]');

/** Text of the first element matching `selector`, without co-authors' carets (widgets inside the text). */
const prose = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
    const copy = el.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('.collaboration-carets__caret').forEach((caret) => caret.remove());
    return copy.textContent;
  });

test('two writers see each other text, carets and presence', async ({ browser }, info) => {
  const doc = docName(info.title);
  const ann = await writer(browser, doc, 'Ann', '#0f766e');
  const bo = await writer(browser, doc, 'Bo', '#b45309');
  await typeAtEnd(ann.page, 'Hello from Ann');
  await expect(bo.page.locator('.ProseMirror')).toContainText('Hello from Ann');
  await expect(bo.page.getByLabel('Also here: Ann')).toBeVisible();
  await expect(bo.page.locator('.collaboration-carets__caret[data-name="Ann"]')).toBeVisible();
  await expect(status(ann.page)).toHaveText('Saved');
  // Ann's paragraph is locked for Bo, but Enter at its end starts a new paragraph.
  await typeAtEnd(bo.page, '\nAnd Bo.');
  await expect(ann.page.locator('.ProseMirror p').nth(1)).toHaveText('And Bo.');
});

test('edits made offline arrive after reconnecting', async ({ browser }, info) => {
  const doc = docName(info.title);
  const ann = await writer(browser, doc, 'Ann', '#0f766e');
  const bo = await writer(browser, doc, 'Bo', '#b45309');
  await typeAtEnd(ann.page, 'online.');
  await expect(bo.page.locator('.ProseMirror')).toContainText('online.');
  await ann.context.setOffline(true);
  await typeAtEnd(ann.page, ' written offline');
  await expect(status(ann.page)).not.toHaveText('Saved');
  await bo.page.waitForTimeout(1000);
  await expect(bo.page.locator('.ProseMirror')).not.toContainText('written offline');
  await ann.context.setOffline(false);
  await expect(bo.page.locator('.ProseMirror')).toContainText('online. written offline', { timeout: 15_000 });
  await expect(status(ann.page)).toHaveText('Saved', { timeout: 15_000 });
});

test('edits survive closing the tab while offline', async ({ browser }, info) => {
  const doc = docName(info.title);
  const ann = await writer(browser, doc, 'Ann', '#0f766e');
  const bo = await writer(browser, doc, 'Bo', '#b45309');
  await ann.context.setOffline(true);
  await typeAtEnd(ann.page, 'never sent before closing');
  await ann.page.waitForTimeout(300); // let IndexedDB commit
  await ann.page.close();
  await ann.context.setOffline(false);
  const reopened = await ann.context.newPage();
  await reopened.goto(`/?doc=${doc}&name=Ann`);
  await expect(reopened.locator('.ProseMirror')).toContainText('never sent before closing');
  await expect(bo.page.locator('.ProseMirror')).toContainText('never sent before closing', { timeout: 15_000 });
});

test('text typed while a co-author turns the paragraph into a heading is kept', async ({ browser }, info) => {
  // Locks off: this checks the merge repair that covers races and offline edits.
  const doc = docName(info.title);
  const ann = await writer(browser, doc, 'Ann', '#0f766e', '&locks=off');
  const bo = await writer(browser, doc, 'Bo', '#b45309', '&locks=off');
  await typeAtEnd(ann.page, 'Chapter one');
  await expect(bo.page.locator('.ProseMirror')).toContainText('Chapter one');
  // Make the two edits truly concurrent: Ann's change is held back until Bo has typed.
  await ann.context.setOffline(true);
  await ann.page.getByRole('button', { name: 'Heading 2' }).click();
  await typeAtEnd(bo.page, ': the storm');
  await bo.page.waitForTimeout(500);
  await ann.context.setOffline(false);
  for (const page of [ann.page, bo.page]) {
    await expect.poll(() => prose(page, '.ProseMirror h2'), { timeout: 15_000 }).toBe('Chapter one: the storm');
  }
});

test('a paragraph being edited is locked for co-authors until its writer pauses', async ({ browser }, info) => {
  const doc = docName(info.title);
  const ann = await writer(browser, doc, 'Ann', '#0f766e', '&lockMs=2000');
  const bo = await writer(browser, doc, 'Bo', '#b45309', '&lockMs=2000');
  await typeAtEnd(ann.page, 'Ann is writing this');
  const locked = bo.page.locator('.pl-locked');
  await expect(locked).toHaveAttribute('data-locked-label', 'Ann is editing');
  await locked.click();
  await bo.page.keyboard.type('X');
  await expect(bo.page.locator('.pl-locked-flash')).toBeVisible();
  await bo.page.waitForTimeout(300);
  expect(await prose(ann.page, '.ProseMirror p')).toBe('Ann is writing this');
  // Ann pauses: after 2 s the lock lapses and Bo can edit.
  await expect(locked).toHaveCount(0, { timeout: 5000 });
  await bo.page.locator('.ProseMirror p').first().click();
  await settleCaret(bo.page);
  await bo.page.keyboard.press('End');
  await settleCaret(bo.page);
  await bo.page.keyboard.type('!');
  await expect.poll(() => prose(ann.page, '.ProseMirror p'), { timeout: 5000 }).toBe('Ann is writing this!');
});

test('comment threads are shared between writers', async ({ browser }, info) => {
  const doc = docName(info.title);
  const ann = await writer(browser, doc, 'Ann', '#0f766e', '&pollMs=200');
  const bo = await writer(browser, doc, 'Bo', '#b45309', '&pollMs=200');
  await typeAtEnd(ann.page, 'Shared text here');
  await expect(bo.page.locator('.ProseMirror')).toContainText('Shared text here');
  await ann.page.locator('.ProseMirror').getByText('Shared text here').dblclick({ position: { x: 5, y: 5 } });
  await settleCaret(ann.page);
  await ann.page.getByRole('toolbar').getByRole('button', { name: 'Comment' }).click();
  const annRail = ann.page.getByRole('complementary', { name: 'Comments' });
  await annRail.getByRole('textbox', { name: 'Write a comment…' }).fill('Ann asks');
  await annRail.getByRole('button', { name: 'Comment' }).click();
  const boRail = bo.page.getByRole('complementary', { name: 'Comments' });
  await expect(boRail.getByText('Ann asks')).toBeVisible();
  await expect(bo.page.locator('.pl-comment')).toHaveText('Shared');
  await boRail.getByRole('textbox', { name: 'Reply…' }).fill('Bo answers');
  await boRail.getByRole('button', { name: 'Reply' }).click();
  await expect(annRail.getByText('Bo answers')).toBeVisible();
  await expect(annRail.getByText('Bo', { exact: true })).toBeVisible();
});

test('a restored version reaches every writer', async ({ browser }, info) => {
  const doc = docName(info.title);
  const ann = await writer(browser, doc, 'Ann', '#0f766e', '&pollMs=200&lockMs=1000');
  const bo = await writer(browser, doc, 'Bo', '#b45309', '&pollMs=200&lockMs=1000');
  await typeAtEnd(ann.page, 'The first draft.');
  await expect(bo.page.locator('.ProseMirror')).toContainText('The first draft.');
  await ann.page.getByRole('tab', { name: 'Versions' }).click();
  const panel = ann.page.getByRole('complementary', { name: 'Versions' });
  await panel.getByRole('button', { name: 'Save version' }).click();
  await panel.getByRole('textbox', { name: 'Name (optional)' }).fill('Draft');
  await panel.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(panel.getByText('Draft', { exact: true })).toBeVisible();
  await typeAtEnd(bo.page, '\nBo adds a line.');
  await expect(ann.page.locator('.ProseMirror')).toContainText('Bo adds a line.');
  await ann.page.waitForTimeout(1500); // Bo's block lock lapses
  await panel.getByRole('button', { name: 'Restore' }).click();
  await expect(panel.getByRole('alert')).toHaveText('Others are writing here: restoring replaces their text too.');
  await panel.getByRole('button', { name: 'Restore' }).click();
  await expect(bo.page.locator('.ProseMirror')).not.toContainText('Bo adds a line.');
  await expect.poll(() => prose(bo.page, '.ProseMirror p')).toBe('The first draft.');
});
