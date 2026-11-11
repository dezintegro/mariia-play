// Спектакли «лошадка» и «мяч» (src/scenes/babies-in-space/anim/*): прокручиваем время через __game.step,
// замораживаем кадр (__game.pause) и снимаем ключевые моменты в test-results/shots/.
import { test, expect, type Page } from '@playwright/test';
import { openScene, noErrors } from './helpers';

declare const window: any;

/** ясли с одним малышом внутри; кадр заморожен, время идёт только через step */
async function nurseryWithBaby(page: Page) {
  const errors = await openScene(page);
  await page.evaluate(() => {
    const g = window.__game, A = g.api;
    g.pause(true);
    A.launchHouse('nursery'); g.step(2);
    const N = g.houses[0], b = g.babies.find((x: any) => x.type !== 'moon');
    A.startDrag(b); A.moveDrag(b, N.x, N.cy()); A.dropBaby(b, N.x, N.cy());
    A.enterRoom(N); g.step(1.2);
    b.wishT = 999; b.wish = null; b.anim = null; b.awake = 99; // без пузырей желаний и сна
    window.__kid = b;
  });
  return errors;
}

/** шагать по 1/60 с, пока условие не выполнится (не дольше max секунд) */
async function stepUntil(page: Page, cond: string, max = 15) {
  return page.evaluate(([cond, max]) => {
    const g = window.__game, b = window.__kid, f = new Function('b', 'g', `return (${cond});`);
    let n = 0; while (!f(b, g) && n < (max as number) * 60) { g.step(1 / 60); n++; }
    return f(b, g);
  }, [cond, max] as const);
}

/** снимок области вокруг точки (x, y) — малыш с игрушкой крупно */
async function shotAt(page: Page, name: string, x: number, y: number, w = 420, h = 340) {
  const vp = page.viewportSize()!;
  const cx = Math.max(0, Math.min(vp.width - w, x - w / 2)), cy = Math.max(0, Math.min(vp.height - h, y - h / 2));
  await page.screenshot({ path: `test-results/shots/${name}.png`, clip: { x: cx, y: cy, width: w, height: h } });
}

async function horseRun(page: Page, sfx: string) {
  const errors = await nurseryWithBaby(page);
  // малыш сам ползёт к лошадке (фаза go), потом спектакль
  const start = await page.evaluate(() => {
    const g = window.__game, b = window.__kid, L = g.api.RL();
    b.ix = L.horse.x - 150 * (Math.min(innerWidth, innerHeight) / 720); b.iy = L.horse.y + 20;
    b.play = { k: 'horse', phase: 'go', t: 9 };
    return { hx: L.horse.x, hy: L.horse.y };
  });
  expect(await stepUntil(page, "b.play && b.play.phase === 'do'", 6)).toBe(true);
  const focus = (dy = -60) => [start.hx + 30, start.hy + dy] as const;
  const at = (sec: number) => stepUntil(page, `b.play && b.play.d - b.play.t >= ${sec}`, 12);
  const info = () => page.evaluate(() => {
    const b = window.__kid, P = b.play, [hx, hy] = window.__game.api.roomHead(b);
    return { st: P && P.last, hx, hy, pose: !!b.pose, horse: window.__game.G.curHouse.room.horse };
  });

  await at(0.55); expect((await info()).st).toBe('climb'); await shotAt(page, `horse-climb${sfx}`, ...focus());
  await at(2.6); const ride = await info(); expect(ride.st).toBe('ride'); expect(ride.horse).toBeGreaterThan(0.9);
  // голова наездника — над седлом
  expect(Math.abs(ride.hx - start.hx)).toBeLessThan(60); expect(ride.hy).toBeLessThan(start.hy - 100);
  await shotAt(page, `horse-ride${sfx}`, ...focus());
  await at(6.0); expect((await info()).st).toBe('slide'); await shotAt(page, `horse-slide${sfx}`, ...focus(-40));
  await at(6.35); expect((await info()).st).toBe('land'); await shotAt(page, `horse-land${sfx}`, ...focus(-20));
  expect(await stepUntil(page, '!b.play', 3)).toBe(true);
  const end = await page.evaluate(() => ({ pose: window.__kid.pose, ix: window.__kid.ix }));
  expect(end.pose).toBeNull(); expect(end.ix).toBeGreaterThan(start.hx + 40);
  noErrors(errors);
}

async function ballRun(page: Page, sfx: string) {
  const errors = await nurseryWithBaby(page);
  const B0 = await page.evaluate(() => {
    const g = window.__game, b = window.__kid, B = g.G.curHouse.room.ball, k = Math.min(innerWidth, innerHeight) / 720;
    B.x = innerWidth * 0.45; B.vx = 0; B.vz = 0; B.z = 0;
    // кладём малыша на мяч (как пальцем) — он оказывается рядом и начинает игру
    const A = g.api; A.startDrag(b); A.moveDrag(b, B.x, B.y - 26 * k); A.dropBaby(b, B.x, B.y - 26 * k);
    b.ix = B.x - 120 * k; // пусть сначала немного проползёт
    return { x: B.x, y: B.y, plan: b.play.plan.join(',') };
  });
  const st = (cond: string) => stepUntil(page, cond, 8);
  const ballFocus = () => page.evaluate(() => { const b = window.__kid; return [b.ix + b.play.dir * 40, b.iy - 60] as [number, number]; });
  const first = B0.plan.split(',')[0];
  expect(await st("b.play.st === 'hit' && b.play.s > 0.16")).toBe(true);
  await shotAt(page, first === 'push' ? `ball-push${sfx}` : `ball-kick${sfx}`, ...(await ballFocus()));
  expect(await st("b.play.n === 1 && b.play.st === 'hit' && b.play.s > 0.16")).toBe(true);
  await shotAt(page, first === 'push' ? `ball-kick${sfx}` : `ball-push${sfx}`, ...(await ballFocus()));
  expect(await st("b.play.st === 'grab' && b.play.s > 0.45")).toBe(true);
  const held = await page.evaluate(() => window.__game.G.curHouse.room.ball.hold === window.__kid);
  expect(held).toBe(true);
  await shotAt(page, `ball-hug${sfx}`, ...(await ballFocus()));
  expect(await st("b.play.st === 'roll' && b.play.s > 0.6")).toBe(true);
  await shotAt(page, `ball-roll${sfx}`, ...(await ballFocus()));
  expect(await st("b.play.st === 'let' && b.play.s > 0.12")).toBe(true);
  await shotAt(page, `ball-let${sfx}`, ...(await ballFocus()));
  expect(await st('!b.play')).toBe(true);
  const end = await page.evaluate(() => ({ pose: window.__kid.pose, hold: window.__game.G.curHouse.room.ball.hold }));
  expect(end.pose).toBeNull(); expect(end.hold ?? null).toBeNull();
  noErrors(errors);
}

test.describe('анимации: лошадка и мяч', () => {
  test.use({ deviceScaleFactor: 2 });
  test('лошадка: залез, катается, съехал, плюх', async ({ page }) => { await horseRun(page, ''); });
  test('мяч: толкнул, пнул, обнял и кувыркнулся', async ({ page }) => { await ballRun(page, ''); });
  test('портрет: лошадка и мяч', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await horseRun(page, '-portrait');
    await ballRun(page, '-portrait');
  });
});
