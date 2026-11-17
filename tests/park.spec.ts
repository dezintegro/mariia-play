// Планета — детская площадка: малыш входит на планету как в дом; качели, горка, песочница, лужа, батут.
import { test, expect } from '@playwright/test';
import { openScene, shot, noErrors } from './helpers';

declare const window: any;

for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`площадка на планете (${vp.width}x${vp.height})`, async ({ page }) => {
    await page.setViewportSize(vp);
    const errors = await openScene(page);
    const r = await page.evaluate(() => {
      const g = window.__game, A = g.api, out: any = {};
      for (let i = 0; i < 6; i++) A.launchBaby(); g.step(3);
      const kids = g.babies.filter((b: any) => b.type !== 'moon').slice(0, 6);
      kids.forEach((b: any) => { b.wish = null; b.wishT = 999; });
      kids[0].wish = { k: 'walk', o: 'slide', t: 60, life: 60, no: 0 };
      const P = g.planet, drop = (b: any, x: number, y: number) => { A.startDrag(b); A.moveDrag(b, x, y); A.dropBaby(b, x, y); };
      for (const b of kids) drop(b, P.x, P.y);
      out.onPlanet = A.park.occupants().length;
      // тап по горке на макушке — заходим
      g.babies.filter((b: any) => !b.home).forEach((b: any) => { b.x = 30; b.y = 30; }); // чтобы никто не пролетал над горкой
      const tx = P.x, ty = P.y - P.r * 1.08; const hres = A.hit(tx, ty); out.hitPark = hres && hres.k;
      A.onTap(tx, ty, hres); g.step(1.2); out.scene = g.G.scene; out.kind = g.G.curHouse && g.G.curHouse.kind;
      return out;
    });
    expect(r).toEqual({ onPlanet: 6, hitPark: 'park', scene: 'room', kind: 'park' });
    const r2 = await page.evaluate(() => {
      const g = window.__game, A = g.api, out: any = {};
      const kids = A.park.occupants(), L = A.PL();
      const drop = (b: any, x: number, y: number) => { A.startDrag(b); A.moveDrag(b, x, y); A.dropBaby(b, x, y); };
      const swingY = L.swing.y - 60;
      drop(kids[1], L.swing.x - 40, swingY); drop(kids[2], L.swing.x + 40, swingY);
      drop(kids[0], L.slide.x, L.slide.y - 120); out.slideWish = !kids[0].wish && kids[0].love > 0;
      drop(kids[3], L.sand.x - 30, L.sand.y - 40);
      drop(kids[4], L.puddle.x, L.puddle.y - 40);
      drop(kids[5], L.tramp.x, L.tramp.y - 60);
      out.spots = kids.map((b: any) => b.spot && b.spot.k).sort();
      g.step(1.3); g.pause(true);
      return out;
    });
    expect(r2).toEqual({ slideWish: true, spots: ['puddle', 'sand', 'slide', 'swing', 'swing', 'tramp'] });
    await shot(page, `park-${vp.width}`);
    const r3 = await page.evaluate(() => {
      const g = window.__game, A = g.api, out: any = {}; g.pause(false);
      const kids = A.park.occupants(), L = A.PL();
      for (const k of ['swing', 'slide', 'sand', 'puddle', 'tramp', 'burrow', 'sky']) A.onRoomTap(L.swing.x, 20, k === 'swing' ? { k, o: 0 } : { k });
      A.onRoomTap(0, 0, { k: 'flower', o: 1 });
      g.step(2.5); out.cakes = A.park.room.cakes.length > 0; out.mud = kids[4].mud > 0;
      const c = A.park.room.cakes[0]; A.onRoomTap(c.x, c.y, { k: 'cake', o: 0 });
      out.slideRuns = kids[0].spot ? kids[0].spot.n : 'done';
      g.step(0.6); g.pause(true);
      return out;
    });
    expect(r3).toMatchObject({ cakes: true, mud: true });
    await shot(page, `park-play-${vp.width}`);
    const r4 = await page.evaluate(() => {
      const g = window.__game, A = g.api, out: any = {}; g.pause(false);
      g.step(8); const kids = A.park.occupants();
      out.puddleLeft = !kids.some((b: any) => b.spot && b.spot.k === 'puddle');
      out.mudBaby = kids.some((b: any) => b.mud > 0.5);
      // выход через ворота
      const L = A.PL(), d = L.door, hr = A.hitRoom(d.x + d.w / 2, d.y + d.h / 2); out.door = hr && hr.k;
      A.onRoomTap(d.x + d.w / 2, d.y + d.h / 2, hr); g.step(1.2); out.back = g.G.scene;
      g.pause(true); return out;
    });
    expect(r4).toEqual({ puddleLeft: true, mudBaby: true, door: 'door', back: 'space' });
    await shot(page, `park-space-${vp.width}`);
    noErrors(errors);
  });
}
