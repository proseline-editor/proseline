import { test, expect } from '@playwright/test';

test('the home page leads to the guide', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Proseline');
  await page.getByRole('link', { name: 'Get started' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Getting started' })).toBeVisible();
});

test('the guide includes the tested feature example', async ({ page }) => {
  await page.goto('guide/write-a-feature');
  await expect(page.locator('.vp-doc')).toContainText("name: 'sceneCount'");
  await expect(page.locator('.vp-doc')).toContainText("describe('the guide\\'s sceneCount feature'");
});

test('the API reference lists every package with its documentation', async ({ page }) => {
  await page.goto('reference/core');
  await expect(page.locator('h3#createeditor')).toBeVisible();
  await expect(page.locator('.vp-doc')).toContainText('Cleans HTML pasted from Word and Google Docs');
  for (const name of ['@proseline-editor/react', '@proseline-editor/vue', '@proseline-editor/sync', '@proseline-editor/export']) {
    await expect(page.locator('.VPSidebar').getByRole('link', { name, exact: true })).toBeVisible();
  }
});

test('the playground runs the React and Vue examples', async ({ page }) => {
  await page.goto('playground');
  for (const title of ['Proseline playground (React)', 'Proseline playground (Vue)']) {
    const frame = page.frameLocator(`iframe[title="${title}"]`);
    await expect(frame.locator('.ProseMirror')).toContainText('The rain had not stopped');
    await expect(frame.getByRole('button', { name: 'Bold' })).toBeVisible();
  }
});
