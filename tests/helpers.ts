import { expect, type Page } from '@playwright/test';

/** Открыть сцену, собрать ошибки консоли, нажать ▶ */
export async function openScene(page: Page, path = 'babies-in-space/index.html') {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(path);
  await page.waitForFunction(() => (window as any).__game);
  await page.evaluate(() => (window as any).__game.start());
  await page.waitForTimeout(600); // стартовый экран тает 0.5 с
  return errors;
}
export async function shot(page: Page, name: string) {
  await page.screenshot({ path: `test-results/shots/${name}.png` });
}
export function noErrors(errors: string[]) { expect(errors, errors.join('\n')).toEqual([]); }
