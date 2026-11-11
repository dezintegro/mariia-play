// Спектакли игры с ксилофоном и башней из кубиков: шагаем симуляцию до нужных моментов
// и сохраняем кадры в test-results/shots/ (их полезно глазами посмотреть после правок).
import { test, expect, type Page } from '@playwright/test';
import { openScene, shot, noErrors } from './helpers';

declare const window: any;

/** ясли с одним малышом внутри, симуляция на паузе (кадры двигает только step) */
async function nurseryWithBaby(page: Page) {
  await page.evaluate(() => {
    const g = window.__game, A = g.api;
    A.launchHouse('nursery'); g.step(2);
    const N = g.houses[0], b = g.babies.find((x: any) => x.type !== 'moon');
    A.startDrag(b); A.moveDrag(b, N.x, N.cy()); A.dropBaby(b, N.x, N.cy());
    A.enterRoom(N); g.step(1.2);
    g.paused = true; b.wishT = 999; b.wish = null; b.love = 0;
    window.__kid = b;
  });
}
/** промотать игру малыша до момента at (секунды от начала игры) */
const runTo = (page: Page, at: number) => page.evaluate((at: number) => {
  const g = window.__game, P = window.__kid.play;
  const now = P.d - P.t; if (at > now) g.step(at - now); else g.step(0);
  return window.__kid.play ? { ph: window.__kid.play.ph, at: window.__kid.play.d - window.__kid.play.t } : null;
}, at);
/** шагать по кадру, пока условие (строка-выражение от P) не станет истинным */
const stepUntil = (page: Page, cond: string) => page.evaluate((cond: string) => {
  const g = window.__game, f = new Function('P', `return ${cond}`);
  for (let i = 0; i < 1200 && window.__kid.play && !f(window.__kid.play); i++) g.step(1 / 60);
  return !!window.__kid.play;
}, cond);

/** шагать, пока игра с игрушкой k не кончится; вернуть, снята ли поза */
const endOfPlay = (k: string) => {
  const g = window.__game, b = window.__kid;
  for (let i = 0; i < 900 && b.play && b.play.k === k; i++) g.step(1 / 60);
  return { ended: !(b.play && b.play.k === k), pose: b.pose };
};

for (const vp of [{ w: 1280, h: 800, sfx: '' }, { w: 820, h: 1180, sfx: '-portrait' }]) {
  test(`ксилофон: палочка в руке, удары по пластинкам, хлопки${vp.sfx}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    const errors = await openScene(page);
    await nurseryWithBaby(page);
    await page.evaluate(() => {
      const g = window.__game, A = g.api, R = A.RL(), b = window.__kid;
      A.startDrag(b); A.moveDrag(b, R.xylo.x, R.xylo.y); A.dropBaby(b, R.xylo.x, R.xylo.y);
    });
    expect(await page.evaluate(() => window.__kid.play?.k)).toBe('xylo');
    await runTo(page, 0.85);
    await shot(page, `xylo-grab${vp.sfx}`);
    // момент удара по самой длинной (левой) пластинке
    await stepUntil(page, 'P.hitN >= 6');
    const hit = await page.evaluate(() => {
      const P = window.__kid.play, A = window.__game.api, bar = A.RL().xylo, S = Math.min(innerWidth, innerHeight) / 720;
      const b0 = { x: bar.x - bar.w / 2 + bar.w / 12, y: bar.y, h: 80 * S };
      return { tip: P.xm.tip, b0 };
    });
    expect(Math.abs(hit.tip[0] - hit.b0.x)).toBeLessThan(6);
    expect(Math.abs(hit.tip[1] - hit.b0.y)).toBeLessThan(hit.b0.h / 2);
    await shot(page, `xylo-strike${vp.sfx}`);
    await stepUntil(page, "P.ph === 'n7'");
    await page.evaluate(() => window.__game.step(0.15));
    await shot(page, `xylo-handoff${vp.sfx}`); // палочка переходит из левой ручки в правую
    await stepUntil(page, "P.ph === 'n8'");
    await page.evaluate(() => window.__game.step(0.2));
    await shot(page, `xylo-windup${vp.sfx}`);
    await stepUntil(page, "P.ph === 'clap'");
    await page.evaluate(() => window.__game.step(0.42));
    const st = await page.evaluate(() => ({ hits: window.__kid.play.hitN, held: !!window.__kid.play.xm }));
    expect(st).toEqual({ hits: 9, held: false });
    await shot(page, `xylo-clap${vp.sfx}`);
    // игра закончилась — поза снята (дальше малыш может сам уползти к другой игрушке)
    expect(await page.evaluate(endOfPlay, 'xylo')).toEqual({ ended: true, pose: null });
    noErrors(errors);
  });

  test(`башня: малыш строит по кубику, хлопает и разбивает${vp.sfx}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    const errors = await openScene(page);
    await nurseryWithBaby(page);
    await page.evaluate(() => {
      const g = window.__game, A = g.api, R = A.RL(), b = window.__kid, x = R.tower.x, y = R.tower.y - 60;
      A.startDrag(b); A.moveDrag(b, x, y); A.dropBaby(b, x, y);
    });
    expect(await page.evaluate(() => window.__kid.play?.k)).toBe('tower');
    await runTo(page, 0.6);
    await shot(page, `tower-unstack${vp.sfx}`);
    await runTo(page, 0.9 + 2 * 0.95 + 0.5 * 0.95); // третий кубик несут к груди
    expect(await page.evaluate(() => window.__kid.home.room.tb.blocks.length)).toBe(5);
    await shot(page, `tower-lift${vp.sfx}`);
    await runTo(page, 0.9 + 4 * 0.95 + 0.85 * 0.95); // пятый кубик — в прыжке над башней
    await shot(page, `tower-place${vp.sfx}`);
    await runTo(page, 0.9 + 5 * 0.95 + 0.05);
    const placed = await page.evaluate(() => {
      const TB = window.__kid.home.room.tb, A = window.__game.api, L = A.RL(), S = Math.min(innerWidth, innerHeight) / 720;
      const top = TB.blocks.find((p: any) => p.i === 4);
      return { placed: TB.placed, dx: Math.abs(top.x - L.tower.x), y: top.y, want: L.tower.y - 36 * S * 4.5 };
    });
    expect(placed.placed).toBe(5);
    expect(placed.dx).toBeLessThan(6);
    expect(Math.abs(placed.y - placed.want)).toBeLessThan(1);
    await runTo(page, 0.9 + 5 * 0.95 + 1.0 + 0.7 * 0.66); // шлёп!
    expect(await page.evaluate(() => ({ tb: window.__kid.home.room.tb, flying: !!window.__kid.home.room.tower }))).toEqual({ tb: null, flying: true });
    await shot(page, `tower-whack${vp.sfx}`);
    expect(await page.evaluate(endOfPlay, 'tower')).toEqual({ ended: true, pose: null });
    await page.evaluate(() => window.__game.step(3)); // комната сама собирает башню
    expect(await page.evaluate(() => window.__kid.home.room.tower)).toBeNull();
    noErrors(errors);
  });
}

test('башня: тап во время стройки качает её, а если малыша унесли — башня собирается сама', async ({ page }) => {
  const errors = await openScene(page);
  await nurseryWithBaby(page);
  const r = await page.evaluate(() => {
    const g = window.__game, A = g.api, R = A.RL(), b = window.__kid, x = R.tower.x, y = R.tower.y - 60, out: any = {};
    A.startDrag(b); A.moveDrag(b, x, y); A.dropBaby(b, x, y);
    g.step(2.5);
    const hr = A.hitRoom(R.tower.x, R.tower.y - 20); out.hit = hr && hr.k;
    A.onRoomTap(R.tower.x, R.tower.y - 20, hr); out.wob = b.home.room.tb.wob > 0; out.flying = !!b.home.room.tower;
    A.startDrag(b); A.moveDrag(b, R.xylo.x + 200, R.fy + 100); A.dropBaby(b, R.xylo.x + 200, R.fy + 100);
    g.step(0.1); out.tb = b.home.room.tb; out.pose = b.pose;
    return out;
  });
  expect(r).toEqual({ hit: 'tower', wob: true, flying: false, tb: null, pose: null });
  noErrors(errors);
});
