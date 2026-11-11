// Собранный файл должен открываться двойным кликом (file://), без сервера.
import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

test('dist/babies-in-space/index.html работает через file://', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(resolve('dist/babies-in-space/index.html')).href);
  await page.waitForFunction(() => (window as any).__game);
  expect(errors).toEqual([]);
});
