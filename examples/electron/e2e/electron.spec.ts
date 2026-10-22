import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { caretToEnd, paste, surface, typeAtEnd } from '../../shared/e2e/helpers';

const appDir = fileURLToPath(new URL('..', import.meta.url));
const fixture = (name: string) => readFileSync(new URL(`../../../packages/core/test/paste/${name}.html`, import.meta.url), 'utf8');

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  // CI's Linux runners cannot use Chromium's sandbox; locally the app runs as shipped.
  app = await electron.launch({ args: [appDir, ...(process.env.CI ? ['--no-sandbox'] : [])] });
  page = await app.firstWindow();
  await expect(surface(page)).toContainText('The rain had not stopped for three days.');
});

test.afterEach(async () => {
  await app.close();
});

test('types, pastes from Word and composes with an IME inside Electron', async () => {
  await typeAtEnd(page, ' "Go" -- now...');
  await expect(surface(page)).toContainText('“Go” — now…');

  await caretToEnd(page);
  await page.keyboard.press('Enter');
  await paste(page, fixture('word'), 'Mara counted the boats in the harbour.');
  await expect(surface(page).locator('ul > li')).toHaveText(['nets', 'rope']);

  await typeAtEnd(page, ' ');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: '´', selectionStart: 1, selectionEnd: 1 });
  await cdp.send('Input.insertText', { text: 'é' });
  await expect(surface(page)).toContainText('and left. é');
});

test('saves the manuscript as Word through the main process', async () => {
  const file = join(mkdtempSync(join(tmpdir(), 'proseline-')), 'manuscript.docx');
  // Answer the native save dialog in the main process.
  await app.evaluate(({ dialog }, path) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: path })) as typeof dialog.showSaveDialog;
  }, file);
  await typeAtEnd(page, ' Saved from the desktop.');
  await page.getByRole('button', { name: 'Save as Word…' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved manuscript.docx');
  expect(existsSync(file)).toBe(true);
  expect(readFileSync(file).subarray(0, 2).toString()).toBe('PK');
});

test('opens a Markdown file from disk', async () => {
  const file = join(mkdtempSync(join(tmpdir(), 'proseline-')), 'notes.md');
  writeFileSync(file, '# Notes\n\nOpened *from disk*.\n');
  await app.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [path] })) as typeof dialog.showOpenDialog;
  }, file);
  await page.getByRole('button', { name: 'Open…' }).click();
  await expect(page.getByRole('status')).toHaveText('Opened notes.md');
  await expect(surface(page).locator('h1')).toHaveText('Notes');
  await expect(surface(page).locator('em')).toHaveText('from disk');
});
