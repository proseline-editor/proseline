import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { caretToEnd, multiClick, paste, surface, typeAtEnd } from './helpers';

// Clipboard HTML as Google Docs and Word put it on the clipboard (also the core unit-test fixtures).
const fixture = (name: string) => readFileSync(new URL(`../../../packages/core/test/paste/${name}.html`, import.meta.url), 'utf8');

test('types Ukrainian text with its typography', async ({ page }) => {
  await page.goto('/?locale=uk');
  await typeAtEnd(page, ` "Добрий вечір," — сказав п'ятий гість. Ґанок, їжа, є.`);
  await expect(surface(page)).toContainText('«Добрий вечір,» — сказав п’ятий гість. Ґанок, їжа, є.');
});

test('selects with the mouse and the keyboard, and formats or replaces the selection', async ({ page }) => {
  await page.goto('/');
  await multiClick(page, 'boats', 2, 'boats');
  await page.getByRole('toolbar').getByRole('button', { name: 'Bold' }).click();
  await expect(surface(page).locator('strong')).toHaveText('boats');

  await multiClick(page, 'harbour', 3, 'The rain had not stopped for three days. Mara stood at the window and counted the boats in the harbour.');
  await page.keyboard.type('Replaced.');
  await expect(surface(page).locator('p').first()).toHaveText('Replaced.');

  await caretToEnd(page);
  await page.keyboard.type(' Tail');
  for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.type('end');
  await expect(surface(page)).toContainText('heard of it. end');
});

test('pastes from Google Docs: formatting kept, blank lines and break marks cleaned up', async ({ page }) => {
  await page.goto('/');
  await caretToEnd(page);
  await page.keyboard.press('Enter');
  await paste(page, fixture('google-docs'), 'Mara counted the boats in the harbour.');
  await expect(surface(page).locator('strong', { hasText: 'boats' })).toHaveCount(1);
  await expect(surface(page).locator('em', { hasText: 'harbour' })).toHaveCount(1);
  await expect(surface(page).locator('h2')).toHaveText('Chapter Two');
  await expect(surface(page).locator('hr')).toHaveCount(2); // the sample's scene break and the pasted one
  await expect(surface(page).locator('li')).toHaveText(['nets']);
  // No hard break is left where Google Docs marks an empty line (empty paragraphs hold only ProseMirror's own filler).
  await expect(surface(page).locator('p br:not(.ProseMirror-trailingBreak)')).toHaveCount(0);
});

test('pastes from Word: lists become lists, Office markup disappears', async ({ page }) => {
  await page.goto('/');
  await caretToEnd(page);
  await page.keyboard.press('Enter');
  await paste(page, fixture('word'), 'Mara counted the boats in the harbour.');
  await expect(surface(page).locator('ul > li')).toHaveText(['nets', 'rope']);
  await expect(surface(page).locator('ol > li')).toHaveText(['first', 'second']);
  await expect(surface(page)).toContainText('“Go,” she said — and left.');
  await expect(surface(page)).not.toContainText('·');
  await expect(surface(page).locator('hr')).toHaveCount(2);
});

test('composes text through an input method, including a dead key', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Playwright drives IME composition through the Chrome DevTools Protocol only');
  await page.goto('/?locale=uk');
  await typeAtEnd(page, ' ');
  const cdp = await page.context().newCDPSession(page);
  // A composed syllable, as a phonetic or CJK-style input method sends it.
  await cdp.send('Input.imeSetComposition', { text: 'ґ', selectionStart: 1, selectionEnd: 1 });
  await cdp.send('Input.imeSetComposition', { text: 'ґа', selectionStart: 2, selectionEnd: 2 });
  await cdp.send('Input.insertText', { text: 'ґанок' });
  // A dead key: ´ is shown while composing, then e commits é.
  await cdp.send('Input.imeSetComposition', { text: '´', selectionStart: 1, selectionEnd: 1 });
  await cdp.send('Input.insertText', { text: 'é' });
  await page.keyboard.type(' "так"');
  await expect(surface(page)).toContainText('heard of it. ґанокé «так»');
  const stats = page.locator('.pl-stats');
  await expect(stats).toContainText('Сьогодні: 2');
});
