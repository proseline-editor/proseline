import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

import { caretToEnd, selectText, surface, typeAtEnd } from './helpers';

test('loads the sample and types with smart typography', async ({ page }) => {
  await page.goto('/');
  await expect(surface(page)).toContainText('The rain had not stopped');
  await typeAtEnd(page, ' "Go" -- now...');
  await expect(surface(page)).toContainText('“Go” — now…');
});

test('uses guillemets for Ukrainian and translates the UI', async ({ page }) => {
  await page.goto('/?locale=uk');
  await typeAtEnd(page, ' "Так"');
  await expect(surface(page)).toContainText('«Так»');
  await expect(page.getByRole('button', { name: 'Жирний' })).toBeVisible();
});

test('finds and replaces from the keyboard', async ({ page }) => {
  await page.goto('/');
  await surface(page).click();
  await page.keyboard.press('ControlOrMeta+f');
  const find = page.getByRole('textbox', { name: 'Find' });
  await expect(find).toBeFocused();
  await find.fill('boats');
  await expect(page.getByText('1 of 1')).toBeVisible();
  await expect(page.locator('.pl-match-current')).toHaveText('boats');
  await page.getByRole('textbox', { name: 'Replace with' }).fill('ships');
  await page.getByRole('button', { name: 'Replace all' }).click();
  await expect(surface(page)).toContainText('counted the ships');
  await page.getByRole('textbox', { name: 'Find' }).press('Escape');
  await expect(page.getByRole('search')).toBeHidden();
});

test('updates the word count while typing', async ({ page }) => {
  await page.goto('/');
  const stats = page.locator('.pl-stats');
  const before = Number((await stats.textContent())?.match(/(\d+) words/)?.[1]);
  await typeAtEnd(page, ' one two three');
  await expect(stats).toContainText(`${before + 3} words`);
  await expect(stats).toContainText('Today: 3');
});

test('dims other paragraphs in focus mode', async ({ page }) => {
  await page.goto('/');
  await surface(page).getByText('The rain had not stopped').click();
  await page.getByRole('button', { name: 'Focus paragraph' }).click();
  await expect(page.locator('.pl-dim').first()).toBeVisible();
  await expect(surface(page).getByText('The rain had not stopped')).not.toHaveClass(/pl-dim/);
});

test('comments on a selection, keeps the document clean and resolves the thread', async ({ page }) => {
  await page.goto('/');
  await selectText(page, 'harbour');
  await page.getByRole('toolbar').getByRole('button', { name: 'Comment' }).click();
  const rail = page.getByRole('complementary', { name: 'Comments' });
  await rail.getByRole('textbox', { name: 'Write a comment…' }).fill('Which harbour?');
  await rail.getByRole('button', { name: 'Comment' }).click();
  await expect(rail.getByText('Which harbour?')).toBeVisible();
  await expect(page.locator('.pl-comment')).toHaveText('harbour');
  await rail.getByRole('button', { name: 'Resolve' }).click();
  await expect(rail.getByRole('button', { name: 'Reopen' })).toBeVisible();
  await expect(page.locator('.pl-comment--resolved')).toHaveText('harbour');
});

test('saves a version, compares it with the current text and restores it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Versions' }).click();
  const panel = page.getByRole('complementary', { name: 'Versions' });
  await panel.getByRole('button', { name: 'Save version' }).click();
  await panel.getByRole('textbox', { name: 'Name (optional)' }).fill('Before edits');
  await panel.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(panel.getByText('Before edits')).toBeVisible();
  await typeAtEnd(page, ' A new ending.');
  await panel.getByRole('button', { name: 'Preview' }).click();
  await expect(panel.locator('.pl-diff ins')).toContainText('A new ending.');
  await panel.getByRole('button', { name: 'Restore' }).click();
  await expect(panel.getByText('Replace the current text with this version?')).toBeVisible();
  await panel.getByRole('button', { name: 'Restore' }).click();
  await expect(surface(page)).not.toContainText('A new ending.');
  await expect(panel.getByText('Before restore')).toBeVisible();
});

test('inserts a mention from the @ menu and switches its case', async ({ page }) => {
  await page.goto('/');
  await typeAtEnd(page, ' Ask @Ma');
  const menu = page.getByRole('listbox', { name: 'Mentions' });
  await expect(menu.getByRole('option', { name: 'Mara' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  await expect(menu).toBeHidden();
  await expect(surface(page).locator('.pl-mention', { hasText: 'Mara' })).toHaveCount(1);
  await page.keyboard.type('now.');
  await expect(surface(page)).toContainText('Ask Mara now.');

  await surface(page).locator('.pl-mention', { hasText: 'Ґордієві' }).click();
  const picker = page.getByRole('menu', { name: 'Change case' });
  await expect(picker.getByRole('menuitemradio', { name: /Ґордієві/ }).first()).toHaveAttribute('aria-checked', 'true');
  await picker.getByRole('menuitemradio', { name: /Ґордія.*genitive/ }).click();
  await expect(picker).toBeHidden();
  await expect(surface(page)).toContainText('The news reached Ґордія before');
});

test('highlights style issues and steps through them', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Style' }).click();
  const panel = page.getByRole('complementary', { name: 'Style' });
  await panel.getByRole('checkbox', { name: 'Highlight style issues' }).check();
  await typeAtEnd(page, ' She was really very tired, and the letter was written slowly.');
  await expect(surface(page).locator('.pl-style--filler')).toHaveText(['really', 'very']);
  await expect(surface(page).locator('.pl-style--passive')).toHaveText(['was written']);
  await expect(surface(page).locator('.pl-style--adverb')).toHaveText(['slowly']);
  await expect(panel.getByRole('listitem').filter({ hasText: 'Filler words' })).toContainText('2');
  await panel.getByRole('button', { name: 'Next: Passive voice' }).click();
  expect(await page.evaluate(() => getSelection()?.toString())).toBe('was written');
  await page.getByRole('button', { name: 'Highlight style issues' }).click();
  await expect(surface(page).locator('.pl-style')).toHaveCount(0);
});

test('exports the document as DOCX, Markdown and HTML', async ({ page }) => {
  await page.goto('/');
  const exportAs = async (format: string) => {
    const download = page.waitForEvent('download');
    await page.getByRole('combobox', { name: 'Export' }).selectOption(format);
    return download;
  };
  const docx = await exportAs('docx');
  expect(docx.suggestedFilename()).toBe('salt-and-tide.docx');
  const bytes = readFileSync((await docx.path())!);
  expect(bytes.subarray(0, 2).toString()).toBe('PK');
  const md = await exportAs('markdown');
  expect(md.suggestedFilename()).toBe('salt-and-tide.md');
  const text = readFileSync((await md.path())!, 'utf8');
  expect(text).toMatch(/^# Chapter One\n/);
  // Mentions are written as their current names in their case.
  expect(text).toContain('The news reached Ґордієві before the Salt Guild heard of it.');
  const html = await exportAs('html');
  expect(readFileSync((await html.path())!, 'utf8')).toContain('<title>Salt and Tide</title>');
});

test('imports DOCX and Markdown files, including its own export', async ({ page }) => {
  await page.goto('/');
  const download = page.waitForEvent('download');
  await page.getByRole('combobox', { name: 'Export' }).selectOption('docx');
  const docx = await (await download).path();
  await typeAtEnd(page, ' Typed after the export.');
  await page.getByLabel('Import file').setInputFiles(docx!);
  await expect(page.getByRole('status')).toHaveText('Imported');
  await expect(surface(page)).toContainText('The rain had not stopped for three days.');
  await expect(surface(page)).not.toContainText('Typed after the export.');
  await expect(surface(page).locator('h1')).toHaveText('Chapter One');
  await expect(surface(page).locator('hr')).toHaveCount(1);
  await expect(surface(page).locator('p[data-style="letter"]')).toContainText('Dear brother');

  await page.getByLabel('Import file').setInputFiles({ name: 'notes.md', mimeType: 'text/markdown', buffer: Buffer.from('# Notes\n\nSome *ideas*.\n\n![map](map.png)') });
  await expect(page.getByRole('status')).toHaveText('Imported, 1 warning');
  await expect(surface(page).locator('h1')).toHaveText('Notes');
  await expect(surface(page).locator('em')).toHaveText('ideas');
});

test.describe('performance @perf', () => {
  test('opens a 150k-word document fast and keeps typing responsive', async ({ page }) => {
    await page.goto('/?big=150000');
    await expect(page.locator('.pl-stats')).toContainText(/1[45]\d,?\d{3} words|1[45]\d\s?\d{3} words/);
    const readyMs = await page.evaluate(() => (window as unknown as { __proselineReadyMs: number }).__proselineReadyMs);
    expect(readyMs).toBeLessThan(Number(process.env.PL_PERF_READY_MS ?? 1000));

    await caretToEnd(page);
    // Median processing time per keystroke (ProseMirror update + React re-render) over 30
    // keystrokes; the median ignores a stray GC pause. Measured to the next macrotask, not the next
    // frame: waiting for requestAnimationFrame would add up to a 16.7 ms frame of idle time.
    const keyMs = await page.evaluate(async () => {
      const el = document.querySelector('.ProseMirror') as HTMLElement;
      const samples: number[] = [];
      const initialLength = el.textContent?.length ?? 0;
      for (let i = 0; i < 30; i++) {
        const start = performance.now();
        document.execCommand('insertText', false, 'x');
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        // Length, not position: the check must not depend on where the caret landed.
        if ((el.textContent?.length ?? 0) !== initialLength + i + 1) throw new Error('keystroke not applied');
        samples.push(performance.now() - start);
      }
      samples.sort((a, b) => a - b);
      return samples[Math.floor(samples.length / 2)] as number;
    });
    test.info().annotations.push({ type: 'perf', description: `ready ${readyMs.toFixed(0)} ms, keystroke ${keyMs.toFixed(1)} ms` });
    expect(keyMs).toBeLessThan(Number(process.env.PL_PERF_KEY_MS ?? 16));
  });

  test('analyzes the style of a 150k-word document without blocking typing', async ({ page }) => {
    await page.goto('/?big=150000&style=1');
    await page.getByRole('tab', { name: 'Style' }).click();
    const panel = page.getByRole('complementary', { name: 'Style' });
    const started = Date.now();
    await expect(panel.getByText(/^Readability: \d+/)).toBeVisible({ timeout: 10000 });
    const analysisMs = Date.now() - started;
    // Only the textblocks around the viewport are highlighted.
    expect(await surface(page).locator('.pl-style').count()).toBeLessThan(3000);
    await caretToEnd(page);
    const keyMs = await page.evaluate(async () => {
      const samples: number[] = [];
      for (let i = 0; i < 30; i++) {
        const start = performance.now();
        document.execCommand('insertText', false, 'x');
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        samples.push(performance.now() - start);
      }
      samples.sort((a, b) => a - b);
      return samples[Math.floor(samples.length / 2)] as number;
    });
    test.info().annotations.push({ type: 'perf', description: `style analysis ${analysisMs} ms, keystroke ${keyMs.toFixed(1)} ms` });
    expect(analysisMs).toBeLessThan(Number(process.env.PL_PERF_STYLE_MS ?? 3000));
    expect(keyMs).toBeLessThan(Number(process.env.PL_PERF_KEY_MS ?? 16));
  });
});
