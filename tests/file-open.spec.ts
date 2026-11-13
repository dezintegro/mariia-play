// Собранный файл должен открываться двойным кликом (file://), без сервера.
import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

for (const scene of ['babies-in-space', 'heart-dress-up']) {
  test(`dist/${scene}/index.html работает через file://`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(resolve(`dist/${scene}/index.html`)).href);
    await page.waitForFunction(() => (window as any).__game);
    expect(errors).toEqual([]);
  });
}
