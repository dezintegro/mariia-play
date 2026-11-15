// Уход за сердечком: сценарии из аудита (docs/research/2026-11-care/report.md).
// Состояние ухода — window.__care (src/scenes/heart-dress-up/care.ts).
import { test, expect, type Page } from '@playwright/test';
import { openScene, shot, noErrors } from './helpers';

declare const window: any;
const PAGE = 'heart-dress-up/index.html';

/** Помощники в странице: go(id) — открыть раздел ухода, tap(k) — нажать кнопку варианта, props() — что есть во сне */
async function setup(page: Page) {
  await page.evaluate(() => {
    const g = window.__game;
    g.pause(true);
    const first: Record<string, string> = { food: 'strawberry', bath: 'foam', sleep: 'moon' };
    // номера разделов ухода ищем один раз; дальше переход сразу, без лишнего времени
    const idx: Record<string, number> = {};
    for (let i = 0; i < g.UI.cells.length; i++) { g.api.goStage(i); const k = g.UI.items[0]?.kind === 'care' && g.UI.items[0].k; for (const id in first) if (first[id] === k) idx[id] = i; }
    g.api.goStage(0);
    window.go = (id: string) => g.api.goStage(idx[id]);
    window.tap = (k: string) => { const j = g.UI.items.findIndex((q: any) => q.k === k); g.api.revealItem(j); const it = g.UI.items[j]; g.api.tapAt(it.x, it.y); };
    window.props = () => { const C = window.__care; return { teddy: !!C.teddy, lamp: !!C.lamp, blanket: !!C.blanket, box: !!C.box }; };
    g.step(0.5);
  });
}
const NONE = { teddy: false, lamp: false, blanket: false, box: false };

for (const [w, h] of [[390, 844], [1280, 800]]) test.describe(`уход ${w}x${h}`, () => {
  test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: w, height: h }); });
  const sz = `${w}x${h}`;

  test('солнце — утро по шагам: убирает ночь целиком и уходит само; тап по солнцу не продлевает', async ({ page }) => {
    const errors = await openScene(page, PAGE); await setup(page);
    const r = await page.evaluate(() => {
      const g = window.__game, C = window.__care, out: any = {};
      window.go('sleep');
      for (const k of ['moon', 'teddy', 'nightlight', 'blanket', 'lullaby']) { window.tap(k); g.step(0.4); }
      g.step(2); out.asleep = C.sleep && C.night > 0.8; out.all = window.props();
      window.tap('sun'); g.step(0.1); out.sunUp = C.morning < 9;
      g.step(0.6); out.at07 = { box: C.box && C.box.out != null, teddyHere: !!C.teddy && C.teddy.out == null };
      g.step(1.0); out.at17 = { lamp: !C.lamp || C.lamp.out != null, sleep: C.sleep };
      g.step(1.9);
      out.after = { sleep: C.sleep, night: C.night < 0.15, props: window.props(), morning: C.morning };
      return out;
    });
    expect(r.asleep).toBe(true);
    expect(r.all).toEqual({ teddy: true, lamp: true, blanket: true, box: true });
    expect(r.sunUp).toBe(true);
    expect(r.at07).toEqual({ box: true, teddyHere: true }); // шкатулка уже закрывается, мишка ещё сидит
    expect(r.at17).toEqual({ lamp: true, sleep: false });
    expect(r.after).toEqual({ sleep: false, night: true, props: { teddy: false, lamp: false, blanket: false, box: false }, morning: 9 });
    await shot(page, `care-sun-after-${sz}`);
    noErrors(errors);
  });

  test('тап по солнышку не держит его: через 3.5 с солнца нет', async ({ page }) => {
    const errors = await openScene(page, PAGE); await setup(page);
    const r = await page.evaluate(() => {
      const g = window.__game, C = window.__care, A = g.api, out: any = { hits: 0 };
      window.go('sleep'); window.tap('moon'); g.step(2);
      window.tap('sun');
      for (let i = 0; i < 12; i++) {
        g.step(0.3);
        // где солнышко: перебираем точки правой верхней четверти области сердца
        const HR = g.G.HR; let hit = null;
        for (let y = HR.y; y < HR.y + HR.h * 0.5 && !hit; y += 8) for (let x = HR.x + HR.w * 0.5; x < HR.x + HR.w && !hit; x += 8) { const h = A.hitAt(x, y); if (h && h.what === 'sun') hit = [x, y]; }
        if (hit) { A.tapAt(hit[0], hit[1]); out.hits++; }
      }
      g.step(0.2); out.morning = C.morning; out.hitSunAfter = C.morning < 9;
      return out;
    });
    expect(r.hits).toBeGreaterThan(3);
    expect(r.morning).toBe(9);
    noErrors(errors);
  });

  test('солнце, затем сразу луна: солнца нет, снова ночь; луна по спящему не будит', async ({ page }) => {
    const errors = await openScene(page, PAGE); await setup(page);
    const r = await page.evaluate(() => {
      const g = window.__game, C = window.__care, out: any = {};
      window.go('sleep'); window.tap('moon'); g.step(2);
      window.tap('sun'); g.step(0.8);
      window.tap('moon'); g.step(0.05); out.sunGone = C.morning === 9; out.sleep = C.sleep;
      g.step(2); out.night = C.night > 0.8;
      window.tap('moon'); g.step(0.5); out.stillAsleep = C.sleep;
      return out;
    });
    expect(r).toEqual({ sunGone: true, sleep: true, night: true, stillAsleep: true });
    await shot(page, `care-sun-then-moon-${sz}`);
    noErrors(errors);
  });

  test('уход из сна: тихое пробуждение без солнца, предметы уезжают плавно; палочка и праздник будят', async ({ page }) => {
    const errors = await openScene(page, PAGE); await setup(page);
    const r = await page.evaluate(() => {
      const g = window.__game, C = window.__care, out: any = {};
      const sleepAll = () => { window.go('sleep'); for (const k of ['moon', 'teddy', 'nightlight', 'blanket', 'lullaby']) { window.tap(k); g.step(0.3); } g.step(1.5); };
      sleepAll();
      window.go('bath'); g.step(0.1);
      out.leave = { sleep: C.sleep, noSun: C.morning === 9, stillLeaving: Object.values(window.props()).some(Boolean) };
      g.step(0.6); out.leave.gone = window.props();
      g.step(2); out.leave.day = C.night < 0.1;
      // палочка будит
      sleepAll(); g.api.wand(); g.step(0.1); out.wand = { sleep: C.sleep, noSun: C.morning === 9 };
      g.step(3);
      // праздник будит, и после него у сердца ничего не осталось
      sleepAll(); g.api.party(); g.step(1); g.api.cont(); g.step(1);
      out.party = { sleep: C.sleep, props: window.props(), night: C.night < 0.1 };
      return out;
    });
    expect(r.leave).toEqual({ sleep: false, noSun: true, stillLeaving: true, gone: { teddy: false, lamp: false, blanket: false, box: false }, day: true });
    expect(r.wand).toEqual({ sleep: false, noSun: true });
    expect(r.party).toEqual({ sleep: false, props: { teddy: false, lamp: false, blanket: false, box: false }, night: true });
    noErrors(errors);
  });

  test('еда: очередь до 3, лишний тап — пружинка; не ест во сне; смешная еда дня — гримаса', async ({ page }) => {
    const errors = await openScene(page, PAGE); await setup(page);
    const r = await page.evaluate(() => {
      const g = window.__game, C = window.__care, out: any = {};
      window.go('food');
      const ks = ['apple', 'cookie', 'donut', 'candy', 'carrot'];
      for (const k of ks) { window.tap(k); g.step(0.05); }
      out.pending = C.fly.length + C.wait.length; out.bounce = !!C.bounce;
      const eaten: string[] = [];
      for (let i = 0; i < 200; i++) { g.step(0.05); if (C.eat && eaten[eaten.length - 1] !== C.eat.k) eaten.push(C.eat.k); }
      out.eaten = eaten;
      // в полёте ушли в сон — проглотил, во сне не жуёт
      window.tap('watermelon'); g.step(0.2); window.go('sleep'); window.tap('moon'); g.step(1.5);
      out.sleepEat = { eat: !!C.eat, fly: C.fly.length, wait: C.wait.length };
      // смешная еда дня — всегда гримаса, остальные — нет
      window.go('food'); g.step(1);
      window.tap(C.funny); for (let i = 0; i < 20 && !C.eat; i++) g.step(0.05); out.funnyGrim = C.eat && C.eat.grim;
      g.step(3);
      const other = ['strawberry', 'cupcake', 'icecream', 'cookie', 'watermelon', 'candy', 'apple', 'carrot', 'donut'].find(k => k !== C.funny && k !== C.fav);
      window.tap(other); for (let i = 0; i < 20 && !C.eat; i++) g.step(0.05); out.otherGrim = C.eat && C.eat.grim;
      out.funnyNotFav = C.funny !== C.fav;
      return out;
    });
    expect(r.pending).toBe(3);
    expect(r.bounce).toBe(true);
    expect(r.eaten).toEqual(['apple', 'cookie', 'donut']);
    expect(r.sleepEat).toEqual({ eat: false, fly: 0, wait: 0 });
    expect(r).toMatchObject({ funnyGrim: true, otherGrim: false, funnyNotFav: true });
    noErrors(errors);
  });

  test('еда: размеры по таблице, угощение ниже рта', async ({ page }) => {
    const errors = await openScene(page, PAGE); await setup(page);
    await page.evaluate(() => { const g = window.__game; window.go('food'); window.tap('candy'); window.tap('icecream'); window.tap('watermelon'); g.step(1.0); });
    await shot(page, `care-food-queue-${sz}`);
    await page.evaluate(() => { const g = window.__game, C = window.__care; g.step(6); C.eat = { k: 'watermelon', t: 0.3, fav: false, grim: false, bites: 1, done: false }; g.step(0); });
    await shot(page, `care-food-watermelon-${sz}`);
    noErrors(errors);
  });

  test('ванна: душ смывает пену, полотенце выключает душ, на сухом — без блеска, выход лопает пузыри', async ({ page }) => {
    const errors = await openScene(page, PAGE); await setup(page);
    const r = await page.evaluate(() => {
      const g = window.__game, C = window.__care, out: any = {};
      window.go('bath');
      window.tap('foam'); g.step(1); out.foam0 = C.foam.length;
      window.tap('foam'); g.step(0.6); out.moreFoam = C.foam.length > out.foam0 && C.foamOn;
      const before = C.foam.length;
      window.tap('shower'); g.step(0.8); out.washing = C.foam.length < before;
      g.step(2.5); out.washed = { foam: C.foam.length, foamOn: C.foamOn };
      window.tap('shower'); g.step(0.3); window.tap('towel'); g.step(0.05); out.towelOff = C.shower <= 0;
      g.step(2); out.shineWet = C.shine > 0;
      g.step(3); // блеск прошёл, сердце сухое
      window.tap('sponge'); g.step(2); out.shineDrySponge = C.shine > 0;
      window.tap('towel'); g.step(2); out.shineDryTowel = C.shine > 0;
      window.tap('soapbubbles'); window.tap('rubberduck'); window.tap('shower'); g.step(0.8);
      window.go('food'); g.step(0.05);
      out.left = { bubbles: C.bubbles.length, drops: C.drops.length, duck: !!C.duck, shower: C.shower > 0 };
      return out;
    });
    expect(r).toMatchObject({ moreFoam: true, washing: true, washed: { foam: 0, foamOn: false }, towelOff: true, shineWet: true, shineDrySponge: false, shineDryTowel: false });
    expect(r.left).toEqual({ bubbles: 0, drops: 0, duck: false, shower: false });
    noErrors(errors);
  });

  test('скриншоты ухода', async ({ page }) => {
    const errors = await openScene(page, PAGE); await setup(page);
    await page.evaluate(() => { const g = window.__game; window.go('bath'); window.tap('foam'); g.step(1); window.tap('shower'); g.step(1.2); });
    await shot(page, `care-bath-shower-${sz}`);
    await page.evaluate(() => { const g = window.__game; g.step(4); window.tap('sponge'); window.tap('rubberduck'); g.step(0.7); });
    await shot(page, `care-bath-sponge-${sz}`);
    await page.evaluate(() => { const g = window.__game; window.go('sleep'); for (const k of ['moon', 'teddy', 'nightlight', 'blanket', 'lullaby']) { window.tap(k); g.step(0.3); } g.step(2); });
    await shot(page, `care-sleep-${sz}`);
    await page.evaluate(() => { const g = window.__game; window.tap('sun'); g.step(1.0); });
    await shot(page, `care-morning-1s-${sz}`);
    await page.evaluate(() => { window.__game.step(1.0); });
    await shot(page, `care-morning-2s-${sz}`);
    noErrors(errors);
  });
});
