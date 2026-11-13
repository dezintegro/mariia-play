// Ванная: купание в ванне и горшок исполняют новые желания; выбор зданий — по одному каждого вида.
import { test, expect } from '@playwright/test';
import { openScene, shot, noErrors } from './helpers';

declare const window: any;

test('выбор здания: кнопка улетает и становится зданием, всего по одному', async ({ page }) => {
  const errors = await openScene(page);
  await page.evaluate(() => { const g = window.__game, A = g.api; A.onTap(g.btn.house.x, g.btn.house.y, A.hit(g.btn.house.x, g.btn.house.y)); g.step(0.4); g.pause(true); });
  await shot(page, 'picker-3');
  const r = await page.evaluate(() => {
    const g = window.__game, A = g.api; g.pause(false); g.picker.open = false;
    const kinds: string[] = [];
    for (const k of ['bath', 'nursery', 'canteen']) {
      A.onTap(g.btn.house.x, g.btn.house.y, A.hit(g.btn.house.x, g.btn.house.y)); g.step(0.4);
      const o = g.picker.opts.find((q: any) => q.k === k); A.onTap(o.x, o.y, A.hit(o.x, o.y));
      if (k === 'canteen') { g.step(0.6); g.pause(true); return { kinds, mid: true }; }
      g.step(1.4); kinds.push(g.houses[g.houses.length - 1].kind);
    }
  });
  await shot(page, 'picker-fly');
  const r2 = await page.evaluate(() => {
    const g = window.__game, A = g.api; g.pause(false); g.step(1.2);
    A.onTap(g.btn.house.x, g.btn.house.y, A.hit(g.btn.house.x, g.btn.house.y)); g.step(0.3);
    return { kinds: g.houses.map((h: any) => h.kind), open: g.picker.open, shake: g.btn.house.shake > 0 };
  });
  expect(r).toEqual({ kinds: ['bath', 'nursery'], mid: true });
  expect(r2).toEqual({ kinds: ['bath', 'nursery', 'canteen'], open: false, shake: true });
  await shot(page, 'houses-3');
  noErrors(errors);
});

test('ванная: купание и горшок исполняют желания', async ({ page }) => {
  const errors = await openScene(page);
  await page.evaluate(() => {
    const g = window.__game, A = g.api;
    A.launchHouse('bath'); for (let i = 0; i < 6; i++) A.launchBaby(); g.step(3);
    const kids = g.babies.filter((b: any) => b.type !== 'moon').slice(0, 4);
    kids[0].wish = { k: 'potty', t: 40, life: 40 }; kids[1].wish = { k: 'bath', t: 40, life: 40 };
    g.step(0.6); g.pause(true);
  });
  await shot(page, 'wish-potty-bath');
  const r = await page.evaluate(() => {
    const g = window.__game, A = g.api, out: any = {}; g.pause(false);
    const B = g.houses[0], kids = g.babies.filter((b: any) => b.type !== 'moon').slice(0, 4);
    for (const b of kids) { A.startDrag(b); A.moveDrag(b, B.x, B.cy()); A.dropBaby(b, B.x, B.cy()); }
    A.enterRoom(B); g.step(1.2); out.scene = g.G.scene;
    const L = A.BL();
    const drop = (b: any, x: number, y: number) => { A.startDrag(b); A.moveDrag(b, x, y); A.dropBaby(b, x, y); };
    drop(kids[0], L.potties[0].x, L.potties[0].y - 80);
    drop(kids[2], L.potties[1].x, L.potties[1].y - 80);
    drop(kids[1], L.tub.x - 60, L.tub.y - L.tub.h - 60);
    drop(kids[3], L.tub.x + 60, L.tub.y - L.tub.h - 60);
    out.onPotty = kids.filter((b: any) => b.potty).length; out.inTub = kids.filter((b: any) => b.tub).length;
    out.bathDone = !kids[1].wish;
    g.step(1.5);
    return out;
  });
  expect(r).toEqual({ scene: 'room', onPotty: 2, inTub: 2, bathDone: true });
  await page.evaluate(() => window.__game.pause(true));
  await shot(page, 'bath-pushing');
  const r2 = await page.evaluate(() => {
    const g = window.__game, A = g.api, out: any = {}; g.pause(false);
    const kids = g.babies.filter((b: any) => b.type !== 'moon').slice(0, 4);
    g.step(1.6); out.pottyDone = !kids[0].wish && kids[0].love > 0;
    g.pause(true); return out;
  });
  await shot(page, 'bath-done');
  const r3 = await page.evaluate(() => {
    const g = window.__game, A = g.api, out: any = {}; g.pause(false);
    const kids = g.babies.filter((b: any) => b.type !== 'moon').slice(0, 4);
    for (const k of ['duck', 'tub', 'sink', 'towel']) A.onRoomTap(0, 0, { k });
    A.onRoomTap(0, 0, { k: 'potty', o: 0 });
    A.tapRoomBaby(kids[1]);
    g.step(4); out.offPotty = kids.filter((b: any) => b.potty).length; out.stillTub = kids.filter((b: any) => b.tub).length;
    g.pause(true); return out;
  });
  expect(r2).toEqual({ pottyDone: true });
  expect(r3).toEqual({ offPotty: 0, stillTub: 2 });
  await shot(page, 'bath');
  noErrors(errors);
});

test.describe('портрет', () => {
  test.use({ viewport: { width: 820, height: 1180 } });
  test('ванная в портретной ориентации', async ({ page }) => {
    const errors = await openScene(page);
    await page.evaluate(() => {
      const g = window.__game, A = g.api;
      A.launchHouse('bath'); for (let i = 0; i < 4; i++) A.launchBaby(); g.step(3);
      const B = g.houses[0], kids = g.babies.filter((b: any) => b.type !== 'moon').slice(0, 3);
      for (const b of kids) { A.startDrag(b); A.moveDrag(b, B.x, B.cy()); A.dropBaby(b, B.x, B.cy()); }
      A.enterRoom(B); g.step(1.2);
      const L = A.BL(), drop = (b: any, x: number, y: number) => { A.startDrag(b); A.moveDrag(b, x, y); A.dropBaby(b, x, y); };
      drop(kids[0], L.potties[0].x, L.potties[0].y - 80); drop(kids[1], L.tub.x, L.tub.y - L.tub.h - 60);
      g.step(1.5); g.pause(true);
    });
    await shot(page, 'bath-portrait');
    noErrors(errors);
  });
});
