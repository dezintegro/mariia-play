// Звук на телефоне: тап пальцем по ▶ (pointerdown пальцем — не «жест» для браузера,
// разблокировать звук можно только на touchend/click) — звук должен проснуться.
import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['Pixel 7'] });

test('тап пальцем по ▶ включает звук, и он оживает после «усыпления»', async ({ page }) => {
  await page.goto('babies-in-space/index.html');
  await page.waitForFunction(() => (window as any).__game);
  await page.tap('#play', { force: true }); // кнопка пульсирует — не ждём «стабильности»
  await expect.poll(() => page.evaluate(() => (window as any).__game.audio())).toBe('running');
  // браузер «усыпил» звук (как iOS при сворачивании) — следующий тап по сцене будит
  await page.evaluate(() => (window as any).__game.suspendAudio());
  await expect.poll(() => page.evaluate(() => (window as any).__game.audio())).toBe('suspended');
  await page.tap('#c', { position: { x: 30, y: 300 } });
  await expect.poll(() => page.evaluate(() => (window as any).__game.audio())).toBe('running');
});
