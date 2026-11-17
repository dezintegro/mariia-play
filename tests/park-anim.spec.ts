// Площадка: кадры анимаций крупно (смотреть глазами) и фоновая игра — малыши сами идут на места.
import { test, expect, type Page } from '@playwright/test';
import { openScene, noErrors } from './helpers';

declare const window: any;
test.use({ deviceScaleFactor: 2 });

async function clip(page: Page, name: string, x: number, y: number, w: number, h: number) {
  await page.screenshot({ path: `test-results/shots/anim-${name}.png`, clip: { x: Math.max(0, x), y: Math.max(0, y), width: w, height: h } });
}

test('площадка: кадры анимаций и вход на планете', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await openScene(page);
  const P = await page.evaluate(() => {
    const g = window.__game, A = g.api;
    for (let i = 0; i < 6; i++) A.launchBaby(); g.step(3);
    const kids = g.babies.filter((b: any) => b.type !== 'moon').slice(0, 6);
    kids.forEach((b: any) => { b.wish = null; b.wishT = 999; });
    const p = g.planet; for (const b of kids.slice(0, 3)) { A.startDrag(b); A.moveDrag(b, p.x, p.y); A.dropBaby(b, p.x, p.y); }
    g.babies.filter((b: any) => !b.home).forEach((b: any) => { b.x = 30; b.y = 30; });
    g.step(0.5); g.pause(true);
    return { x: p.x, y: p.y, r: p.r };
  });
  await clip(page, 'planet-top', P.x - P.r * 1.5, P.y - P.r * 2.2, P.r * 3, P.r * 1.9);
  // вход: камера ныряет к воротам
  await page.evaluate(() => { const g = window.__game, A = g.api, p = g.planet; g.pause(false); A.onTap(p.x, p.y - p.r * 1.22, A.hit(p.x, p.y - p.r * 1.22)); g.step(0.25); g.pause(true); });
  await page.screenshot({ path: 'test-results/shots/anim-enter-zoom.png' });
  const L = await page.evaluate(() => {
    const g = window.__game, A = g.api; g.pause(false); g.step(1.2);
    const kids = A.park.occupants(); kids.forEach((b: any) => { b.iwT = 999; });
    const L = A.PL(), drop = (b: any, x: number, y: number) => { A.startDrag(b); A.moveDrag(b, x, y); A.dropBaby(b, x, y); };
    drop(kids[0], L.swing.x - 40, L.swing.y - 60); drop(kids[1], L.slide.x, L.slide.y - 120); drop(kids[2], L.sand.x - 30, L.sand.y - 40);
    A.onRoomTap(0, 0, { k: 'swing', o: 0 }); A.onRoomTap(0, 0, { k: 'swing', o: 0 });
    return L;
  });
  const k = 1280 / 1280 * Math.min(1280, 800) / 720;
  const frames: [string, number][] = [['a', 0.35], ['b', 0.4], ['c', 0.5], ['d', 0.6], ['e', 0.9], ['f', 1.2], ['g', 0.5]];
  for (const [n, dt] of frames) {
    await page.evaluate((dt) => { const g = window.__game; g.pause(false); g.step(dt); g.pause(true); }, dt);
    await clip(page, `swing-${n}`, L.swing.x - 170 * k, L.swing.y - 260 * k, 340 * k, 280 * k);
    await clip(page, `slide-${n}`, L.slide.x - 160 * k, L.slide.y - 280 * k, 340 * k, 300 * k);
  }
  await clip(page, 'sand', L.sand.x - 150 * k, L.sand.y - 190 * k, 300 * k, 210 * k);
  const r = await page.evaluate(() => {
    const g = window.__game, A = g.api, out: any = {}; g.pause(false);
    const kids = A.park.occupants(), L = A.PL(), drop = (b: any, x: number, y: number) => { A.startDrag(b); A.moveDrag(b, x, y); A.dropBaby(b, x, y); };
    for (const b of kids) drop(b, L.puddle.x, (L.swing.y + L.puddle.y) / 2); // на свободную траву
    drop(kids[0], L.puddle.x, L.puddle.y - 40); drop(kids[1], L.tramp.x, L.tramp.y - 60);
    g.step(0.75); g.pause(true);
    // малыш в прыжке на батуте ловится там, где его видно
    const b = kids[1], top = b.iy + (b.pose?.dy || 0) - 40; const hr = A.hitRoom(b.ix, top); out.catchAir = hr && hr.k === 'baby' && hr.o === b;
    return out;
  });
  expect(r).toEqual({ catchAir: true });
  await clip(page, 'puddle-tramp', L.puddle.x - 150 * k, L.tramp.y - 330 * k, L.tramp.x - L.puddle.x + 300 * k, 360 * k);
  // фоновая игра: свободные малыши сами занимают места
  const r2 = await page.evaluate(() => {
    const g = window.__game, A = g.api; g.pause(false);
    const kids = A.park.occupants(); kids.forEach((b: any) => { b.iwT = 0; b.wish = null; b.wishT = 999; });
    for (let i = 0; i < 80; i++) g.step(0.5);
    return { everPlayed: g.api.park.room.autoCount > 0, dbg: kids.map((b: any) => [b.spot && b.spot.k, !!b.goSpot, Math.round(b.ix), Math.round(b.iy), b.iwT.toFixed(1), !!b.wish, b.sleeping(), b.ifall, !!b.play, !!b.anim]) };
  });
  expect(r2.everPlayed, JSON.stringify(r2.dbg)).toBe(true);
  noErrors(errors);
});
