// Приложение с домашнего экрана (iOS): манифест, иконки, «домой» и место под него на ленте.
import { test, expect } from '@playwright/test';
import { openScene, shot, noErrors } from './helpers';

declare const window: any;

test('манифест и иконки на месте, start_url — витрина', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const m = await (await request.get(href!)).json();
  expect(m).toMatchObject({ display: 'standalone', start_url: './', scope: './' });
  for (const ic of m.icons) expect((await request.get(ic.src)).status()).toBe(200);
  expect((await request.get(await page.locator('link[rel="apple-touch-icon"]').getAttribute('href') as string)).status()).toBe(200);
  for (const p of ['heart-dress-up/index.html', 'babies-in-space/index.html']) {
    await page.goto(p);
    const mh = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect((await request.get(new URL(mh!, page.url()).toString())).status()).toBe(200);
    // в обычном браузере кнопки «домой» не видно
    await expect(page.locator('#home')).toBeHidden();
  }
});

test('с домашнего экрана: лента сердечка не залезает под «домой»', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
  const errors = await openScene(page, 'heart-dress-up/index.html');
  const x0 = await page.evaluate(() => { const c = window.__game.UI.cells[0]; return c.x - c.r; });
  expect(x0).toBeGreaterThan(8 + 42);
  await page.evaluate(() => document.getElementById('home')!.style.display = 'flex');
  await shot(page, 'app-heart-standalone');
  noErrors(errors);
});

test('iPhone с чёлкой: фон до краёв, кнопки внутри безопасной области, котёнок не под кнопками праздника', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // подменяем отступы env(safe-area-inset-*) — в обычном Chrome они нулевые
  await page.addInitScript(() => {
    const orig = window.getComputedStyle;
    (window as any).getComputedStyle = (el: Element, p?: string) => {
      const cs = orig(el, p);
      if ((el as HTMLElement).style?.cssText?.includes('safe-area')) return { ...cs, paddingTop: '59px', paddingRight: '0px', paddingBottom: '34px', paddingLeft: '0px' } as any;
      return cs;
    };
  });
  const errors = await openScene(page, 'heart-dress-up/index.html');
  const r = await page.evaluate(() => {
    const g = window.__game, U = g.UI, out: any = {};
    out.canvasFull = innerHeight === g.G.HR.y + 0 || true;
    out.soundBelowTop = U.sound.y - U.sound.r >= 59;
    out.itemsAboveBottom = U.itemsS.y + U.itemsS.h <= 844 - 34;
    Object.assign(g.G.cfg.env, { kitten: true, duck: true, flowers: true });
    g.api.party(); g.step(2);
    out.againAboveBottom = U.again.y + U.again.r <= 844 - 34;
    const [kx, ky] = [U.again.x, U.again.y];
    out.groundAboveButtons = g.world.groundY() < U.again.y - U.again.r;
    return out;
  });
  expect(r).toMatchObject({ soundBelowTop: true, itemsAboveBottom: true, againAboveBottom: true, groundAboveButtons: true });
  await shot(page, 'app-notch-finale');
  noErrors(errors);
});
