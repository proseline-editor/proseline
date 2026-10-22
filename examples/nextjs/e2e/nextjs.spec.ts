import { test, expect } from '@playwright/test';
import { surface, typeAtEnd } from '../../shared/e2e/helpers';

test('edits on the client, saves through a route handler, and renders on the server', async ({ page, request }) => {
  await page.goto('/');
  await expect(surface(page)).toContainText('The rain had not stopped for three days.');
  await typeAtEnd(page, ' "Saved" -- on the server.');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved');

  // A fresh load gets the stored document from the server component.
  await page.reload();
  await expect(surface(page)).toContainText('three days. “Saved” — on the server.');

  // The reading view is plain server-rendered HTML.
  const html = await (await request.get('/read')).text();
  expect(html).toContain('<h1>Chapter One</h1>');
  expect(html).toContain('“Saved” — on the server.');
});

test('exports DOCX on the server', async ({ page }) => {
  await page.goto('/');
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download DOCX' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('salt-and-tide.docx');
  const { readFileSync } = await import('node:fs');
  expect(readFileSync((await file.path())!).subarray(0, 2).toString()).toBe('PK');
});
