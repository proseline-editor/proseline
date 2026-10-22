import { test, expect, type Browser } from '@playwright/test';
import { typeAtEnd } from '../../shared/e2e/helpers';

/** Each test uses its own document so tests can run in parallel against one server. */
const docName = (title: string) => `${title.replace(/\W+/g, '-')}-${Date.now()}`;

const open = async (browser: Browser, doc: string, name: string, role = 'writer', query = '') => {
  // Separate contexts = separate users with their own IndexedDB.
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/?doc=${doc}&name=${name}&role=${role}${query}`);
  await expect(page.locator('.ProseMirror')).toBeVisible();
  return { context, page };
};

const status = (page: Awaited<ReturnType<typeof open>>['page']) => page.locator('.pl-sync [role=status]');

test('two writers share a document over REST and Server-Sent Events', async ({ browser }, info) => {
  const doc = docName(info.title);
  // Block locks off: both write into the same paragraph (react-collab tests the locks).
  const ann = await open(browser, doc, 'Ann', 'writer', '&locks=off');
  const bo = await open(browser, doc, 'Bo', 'writer', '&locks=off');
  await typeAtEnd(ann.page, 'Hello from Ann.');
  await expect(bo.page.locator('.ProseMirror')).toContainText('Hello from Ann.');
  await typeAtEnd(bo.page, ' And Bo.');
  await expect(ann.page.locator('.ProseMirror')).toContainText('Hello from Ann. And Bo.');
  await expect(status(ann.page)).toHaveText('Saved');
  await expect(ann.page.getByLabel('Also here: Bo')).toBeVisible();
});

test('a newcomer catches up from the server', async ({ browser }, info) => {
  const doc = docName(info.title);
  const ann = await open(browser, doc, 'Ann');
  await typeAtEnd(ann.page, 'Written before Bo arrived.');
  await expect(status(ann.page)).toHaveText('Saved');
  const bo = await open(browser, doc, 'Bo');
  await expect(bo.page.locator('.ProseMirror')).toContainText('Written before Bo arrived.');
});

test('edits made offline arrive after reconnecting', async ({ browser }, info) => {
  const doc = docName(info.title);
  const ann = await open(browser, doc, 'Ann');
  const bo = await open(browser, doc, 'Bo');
  await typeAtEnd(ann.page, 'Online.');
  await expect(bo.page.locator('.ProseMirror')).toContainText('Online.');
  await ann.context.setOffline(true);
  await typeAtEnd(ann.page, ' Offline.');
  await expect(status(ann.page)).not.toHaveText('Saved');
  await ann.context.setOffline(false);
  await expect(bo.page.locator('.ProseMirror')).toContainText('Online. Offline.', { timeout: 15_000 });
  await expect(status(ann.page)).toHaveText('Saved', { timeout: 15_000 });
});

test('the server refuses a revoked writer: the editor turns read-only and nothing leaks', async ({ browser }, info) => {
  const doc = docName(info.title);
  const ann = await open(browser, doc, 'Ann');
  const eve = await open(browser, doc, 'Eve', 'revoked');
  await typeAtEnd(eve.page, 'Not allowed.');
  await expect(status(eve.page)).toHaveText('Read-only — no edit access');
  await expect(eve.page.locator('.ProseMirror')).toHaveAttribute('contenteditable', 'false');
  await typeAtEnd(ann.page, 'Ann is still writing.');
  await expect(status(ann.page)).toHaveText('Saved');
  await expect(ann.page.locator('.ProseMirror')).not.toContainText('Not allowed.');
});
