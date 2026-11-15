// Уход — еда по модели «место → нужда → предметы → развязка и след» (src/scenes/heart-dress-up/care/food.ts).
// Состояние — window.__care.food; следы на сердце — window.__care.food.traces (общие, их читают и другие разделы).
import { test, expect, type Page } from '@playwright/test';
import { openScene, shot, noErrors } from './helpers';

declare const window: any;
const PAGE = 'heart-dress-up/index.html';

/** go(id) — открыть раздел ухода, tap(k) — нажать кнопку варианта, eatNow(k) — дать и дождаться, пока предмет у рта, finish() — доесть, clean() — стереть следы */
async function setup(page: Page) {
  await page.evaluate(() => {
    const g = window.__game, C = window.__care;
    g.pause(true);
    const first: Record<string, string> = { food: 'strawberry', bath: 'foam', sleep: 'moon' };
    const idx: Record<string, number> = {};
    for (let i = 0; i < g.UI.cells.length; i++) { g.api.goStage(i); const k = g.UI.items[0]?.kind === 'care' && g.UI.items[0].k; for (const id in first) if (first[id] === k) idx[id] = i; }
    g.api.goStage(0);
    window.go = (id: string) => g.api.goStage(idx[id]);
    window.tap = (k: string) => { const j = g.UI.items.findIndex((q: any) => q.k === k); g.api.revealItem(j); const it = g.UI.items[j]; g.api.tapAt(it.x, it.y); };
    window.eatNow = (k: string) => { window.tap(k); for (let i = 0; i < 200 && C.food.eat?.k !== k; i++) g.step(0.05); return C.food.eat; };
    window.finish = () => { for (let i = 0; i < 200 && (C.food.eat || C.food.fly.length || C.food.wait.length); i++) g.step(0.05); };
    window.clean = () => { const T = C.food.traces; T.crumbs = T.cream = T.milk = 0; };
    g.step(0.5);
  });
}

for (const [w, h] of [[390, 844], [1280, 800]]) test.describe(`еда ${w}x${h}`, () => {
  test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: w, height: h }); });
  const sz = `${w}x${h}`;

  test('место: столик и слюнявчик въезжают и уезжают; столик не под кнопками; облачко с любимой едой', async ({ page }) => {
    const errors = await openScene(page, PAGE); await setup(page);
    const r = await page.evaluate(() => {
      const g = window.__game, C = window.__care, F = C.food, G = g.G, out: any = {};
      window.go('food'); g.step(0.6);
      out.place = !!F.place && F.place.out == null; out.cloud = !!F.cloud; out.lick = !!F.lick;
      const geo = F.geo(), z = G.zones, R = G.heart.R;
      // столик между палочкой и хлопушкой: прямоугольник стола не задевает круги кнопок
      const clear = (b: any) => { const dx = Math.max(geo.hx - geo.half - b.x, 0, b.x - (geo.hx + geo.half)), dy = Math.max(geo.ty - 0.1 * R - b.y, 0, b.y - (geo.ty + 0.3 * R)); return Math.hypot(dx, dy) > b.r; };
      out.tableClear = { wand: clear(z.wand), party: clear(z.party) };
      out.inHR = geo.hx - geo.half >= G.HR.x && geo.hx + geo.half <= G.HR.x + G.HR.w && geo.ty + 0.3 * R <= G.HR.y + G.HR.h + 1;
      out.plateOnTable = geo.pr <= geo.half;
      const [cx, cy, cr] = F.cloudPos(), s = z.sound;
      out.cloudClear = Math.hypot(cx - s.x, cy - s.y) > s.r + cr && cx + cr <= G.HR.x + G.HR.w && cy - cr >= G.HR.y;
      const hc = g.api.hitAt(cx, cy); out.cloudHit = hc && hc.what;
      const hb = g.api.hitAt(geo.hx, G.heart.y + 0.55 * R); out.bibHit = hb && hb.what;
      const ht = g.api.hitAt(geo.hx + geo.half * 0.7, geo.ty + 0.02 * R); out.tableHit = ht && ht.what;
      g.step(6); out.cloudGone = !F.cloud;
      window.go('bath'); g.step(0.1); out.leaving = !!F.place && F.place.out != null;
      g.step(0.6); out.gone = !F.place;
      return out;
    });
    expect(r).toEqual({ place: true, cloud: true, lick: true, tableClear: { wand: true, party: true }, inHR: true, plateOnTable: true, cloudClear: true,
      cloudHit: 'cloud', bibHit: 'bib', tableHit: 'table', cloudGone: true, leaving: true, gone: true });
    noErrors(errors);
  });

  test('еда летит на тарелку, с тарелки ко рту; хрустящее — крошки, кремовое — усы; след переживает смену раздела', async ({ page }) => {
    const errors = await openScene(page, PAGE); await setup(page);
    const r = await page.evaluate(() => {
      const g = window.__game, C = window.__care, F = C.food, out: any = {};
      window.go('food'); g.step(0.5);
      window.tap('cookie'); g.step(0.3); out.toPlate = F.fly.length === 1 && F.fly[0].park >= 0;
      g.step(0.35); out.onPlate = F.wait.length === 1 || (F.fly.length === 1 && F.fly[0].park < 0);
      window.finish(); out.crumbs = F.traces.crumbs > 0; out.full = F.full;
      window.eatNow('cupcake'); window.finish(); out.cream = F.traces.cream > 0;
      window.go('bath'); g.step(2); out.keep = F.traces.crumbs > 0 && F.traces.cream > 0;
      return out;
    });
    expect(r).toEqual({ toPlate: true, onPlate: true, crumbs: true, full: 1, cream: true, keep: true });
    noErrors(errors);
  });

  test('сытость: голодный урчит; после 4-го — вздох, круглее, «ик»; дальше ест медленно; через минуту спадает', async ({ page }) => {
    const errors = await openScene(page, PAGE); await setup(page);
    const r = await page.evaluate(() => {
      const g = window.__game, C = window.__care, F = C.food, out: any = {};
      window.go('food'); g.step(9); out.rumbled = F.rumbleT < 9;
      for (const k of ['strawberry', 'candy', 'watermelon']) { window.eatNow(k); window.finish(); }
      out.full3 = F.full;
      const E = window.eatNow('donut'); out.lastNotSlow = !E.slow;
      for (let i = 0; i < 60 && !F.sated; i++) g.step(0.05);
      out.sated = !!F.sated; g.step(0.4); out.round = F.round > 0.5;
      let hics = 0; for (let i = 0; i < 100; i++) { const h = F.hicT; g.step(0.05); if (F.hicT < h) hics++; }
      out.hics = hics;
      g.step(9); out.noRumbleFull = F.rumbleT > 8;
      const S = window.eatNow('cookie'); out.slow = !!S.slow; window.finish(); out.stillFull = F.full;
      g.step(70); out.later = F.full < 4; out.round2 = F.round < 0.3;
      g.step(20); out.hungry = F.full;
      return out;
    });
    expect(r).toEqual({ rumbled: true, full3: 3, lastNotSlow: true, sated: true, round: true, hics: 3, noRumbleFull: true, slow: true, stillFull: 4, later: true, round2: true, hungry: 0 });
    noErrors(errors);
  });

  test('предмет × состояние: стакан и салфетка у голодного, сытого и испачканного', async ({ page }) => {
    const errors = await openScene(page, PAGE); await setup(page);
    const r = await page.evaluate(() => {
      const g = window.__game, C = window.__care, F = C.food, T = F.traces, out: any = {};
      window.go('food'); g.step(0.5);
      // голоден, чистый: стакан — молочные усы; салфетка — щекотно и животик урчит
      window.eatNow('glass'); window.finish(); out.glassHungry = { milk: T.milk };
      window.clean();
      const N0 = window.eatNow('napkin'); out.napkinClean = N0.mess; let rum = false;
      for (let i = 0; i < 60; i++) { const r0 = F.rumbleT; g.step(0.05); if (F.rumbleT < r0) rum = true; } out.napkinRumble = rum;
      // испачкан: стакан смывает крошки, салфетка вытирает всё
      window.eatNow('cookie'); window.finish(); out.crumbs = T.crumbs > 0;
      window.eatNow('glass'); window.finish(); out.glassMessy = { crumbs: T.crumbs, milk: T.milk };
      window.eatNow('cupcake'); window.finish();
      const N = window.eatNow('napkin'); out.napkinMess = N.mess; window.finish(); out.napkinMessy = { crumbs: T.crumbs, cream: T.cream, milk: T.milk };
      // испачканный ест: облизывает усы
      window.eatNow('icecream'); window.finish(); const c1 = T.cream;
      const M = window.eatNow('strawberry'); out.foodMess = M.mess; window.finish(); g.step(1.5); out.licked = T.cream < c1;
      // сыт: стакан — медленно и «ик»; салфетка по чистому — щекотно и «ик»
      window.clean(); F.full = 4; F.idle = 0;
      const S = window.eatNow('glass'); out.glassFull = S.slow; let hic = false; for (let i = 0; i < 60; i++) { const h = F.hicT; g.step(0.05); if (F.hicT < h) hic = true; } out.glassHic = hic;
      window.clean();
      window.eatNow('napkin'); hic = false; for (let i = 0; i < 60; i++) { const h = F.hicT; g.step(0.05); if (F.hicT < h) hic = true; } out.napkinHic = hic;
      out.fullNotCounted = F.full;
      return out;
    });
    expect(r).toEqual({
      glassHungry: { milk: 1 }, napkinClean: false, napkinRumble: true, crumbs: true, glassMessy: { crumbs: 0, milk: 1 },
      napkinMess: true, napkinMessy: { crumbs: 0, cream: 0, milk: 0 }, foodMess: true, licked: true,
      glassFull: true, glassHic: true, napkinHic: true, fullNotCounted: 4,
    });
    noErrors(errors);
  });

  test('скриншоты еды', async ({ page }) => {
    const errors = await openScene(page, PAGE); await setup(page);
    await page.evaluate(() => { const g = window.__game; window.go('food'); g.step(0.8); });
    await shot(page, `food-enter-${sz}`);
    await page.evaluate(() => { const g = window.__game; window.tap('cookie'); window.tap('cupcake'); window.tap('glass'); g.step(1.0); });
    await shot(page, `food-plate-${sz}`);
    await page.evaluate(() => { window.finish(); window.__game.step(0.3); });
    await shot(page, `food-traces-${sz}`);
    await page.evaluate(() => { const g = window.__game, C = window.__care; C.food.full = 3; window.eatNow('apple'); for (let i = 0; i < 60 && !C.food.sated; i++) g.step(0.05); g.step(0.6); });
    await shot(page, `food-sated-${sz}`);
    await page.evaluate(() => { const g = window.__game; window.finish(); g.step(3); window.eatNow('donut'); g.step(0.9); });
    await shot(page, `food-slow-${sz}`);
    await page.evaluate(() => { const g = window.__game; window.finish(); window.eatNow('napkin'); g.step(0.5); });
    await shot(page, `food-napkin-${sz}`);
    await page.evaluate(() => { const g = window.__game; window.finish(); window.eatNow('glass'); g.step(0.8); });
    await shot(page, `food-glass-${sz}`);
    await page.evaluate(() => { const g = window.__game; window.finish(); window.eatNow('cookie'); window.finish(); window.go('bath'); g.step(1); });
    await shot(page, `food-trace-in-bath-${sz}`);
    noErrors(errors);
  });
});
