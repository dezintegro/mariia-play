// Сон по модели «место → нужда → предметы → развязка и след» (docs/research/2026-11-care/report.md, разделы 2 и 3.3).
// Состояние — window.__care.sleep (src/scenes/heart-dress-up/care/sleep.ts), следы — window.__traces.
import { test, expect, type Page } from '@playwright/test';
import { openScene, shot, noErrors } from './helpers';

declare const window: any;
const PAGE = 'heart-dress-up/index.html';

/** go(id) — открыть раздел ухода, tap(k) — кнопка варианта, tapObj(what) — тап по предмету сна на сцене */
async function setup(page: Page) {
  await page.evaluate(() => {
    const g = window.__game;
    g.pause(true);
    const first: Record<string, string> = { food: 'strawberry', bath: 'foam', sleep: 'moon' };
    const idx: Record<string, number> = {};
    for (let i = 0; i < g.UI.cells.length; i++) { g.api.goStage(i); const k = g.UI.items[0]?.kind === 'care' && g.UI.items[0].k; for (const id in first) if (first[id] === k) idx[id] = i; }
    g.api.goStage(0);
    window.go = (id: string) => g.api.goStage(idx[id]);
    window.tap = (k: string) => { const j = g.UI.items.findIndex((q: any) => q.k === k); g.api.revealItem(j); const it = g.UI.items[j]; g.api.tapAt(it.x, it.y); };
    // найти на сцене точку, где под пальцем предмет сна what, и тапнуть
    window.find = (what: string) => {
      const HR = g.G.HR;
      for (let y = HR.y; y < HR.y + HR.h; y += 6) for (let x = HR.x; x < HR.x + HR.w; x += 6) { const h = g.api.hitAt(x, y); if (h && h.sec === 'sleep' && h.what === what) return [x, y]; }
      return null;
    };
    window.tapObj = (what: string) => { const p = window.find(what); if (p) g.api.tapAt(p[0], p[1]); return !!p; };
    g.step(0.5);
  });
}

for (const [w, h] of [[390, 844], [1280, 800]]) test.describe(`сон ${w}x${h}`, () => {
  test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: w, height: h }); });
  const sz = `${w}x${h}`;

  test('место: вечер и кроватка при входе, сердце зевает; при выходе всё уезжает', async ({ page }) => {
    const errors = await openScene(page, PAGE); await setup(page);
    const r = await page.evaluate(() => {
      const g = window.__game, Z = window.__care.sleep, out: any = {};
      window.go('sleep'); let yawned = false;
      for (let i = 0; i < 30; i++) { g.step(0.05); if (Z.yawn < 9) yawned = true; }
      out.enter = { eve: Z.eve > 0.9, bed: !!Z.bed, yawned, sleep: Z.sleep };
      window.tap('blanket'); window.tap('teddy'); g.step(0.5);
      window.go('food'); g.step(0.1); out.leaving = { bed: Z.bed && Z.bed.out != null, teddy: Z.teddy && Z.teddy.out != null };
      g.step(2); out.gone = { bed: !!Z.bed, teddy: !!Z.teddy, blanket: !!Z.blanket, eve: Z.eve < 0.02, lull: Z.lull };
      return out;
    });
    expect(r.enter).toEqual({ eve: true, bed: true, yawned: true, sleep: false });
    expect(r.leaving).toEqual({ bed: true, teddy: true });
    expect(r.gone).toEqual({ bed: false, teddy: false, blanket: false, eve: true, lull: 0 });
    noErrors(errors);
  });

  test('сонливость: предметы копят её один раз, веки опускаются, при ≥0.8 засыпает само', async ({ page }) => {
    const errors = await openScene(page, PAGE); await setup(page);
    const r = await page.evaluate(() => {
      const g = window.__game, Z = window.__care.sleep, out: any = {};
      window.go('sleep'); g.step(0.1);
      const d0 = Z.drowsy;
      window.tap('blanket'); g.step(0.05); out.blanket = +(Z.drowsy - d0).toFixed(2);
      window.tap('blanket'); window.tap('blanket'); g.step(0.05); out.again = +(Z.drowsy - d0).toFixed(2); // повторно — подоткнуть, не копит
      window.tap('nightlight'); g.step(0.05); out.lamp = +(Z.drowsy - d0).toFixed(2);
      g.step(2); out.lid = Z.lid > 0.3; out.awake = !Z.sleep;
      window.tap('lullaby'); g.step(0.05); out.atLull = Z.drowsy >= 0.8;
      g.step(2.5); out.asleep = Z.sleep;
      return out;
    });
    expect(r.blanket).toBeCloseTo(0.3, 1);
    expect(r.again).toBeCloseTo(0.3, 1);
    expect(r.lamp).toBeCloseTo(0.5, 1);
    expect(r).toMatchObject({ lid: true, awake: true, atLull: true, asleep: true });
    await shot(page, `sleep-auto-${sz}`);
    noErrors(errors);
  });

  test('сонливость копится и сама, пока рядом уютное; зевки чаще', async ({ page }) => {
    const errors = await openScene(page, PAGE); await setup(page);
    const r = await page.evaluate(() => {
      const g = window.__game, Z = window.__care.sleep;
      window.go('sleep'); window.tap('teddy'); window.tap('nightlight'); g.step(0.1);
      let yawns = 0, was = false;
      for (let i = 0; i < 300 && !Z.sleep; i++) { g.step(0.1); const y = Z.yawn < 9; if (y && !was) yawns++; was = y; }
      return { asleep: Z.sleep, yawns };
    });
    expect(r.asleep).toBe(true);
    expect(r.yawns).toBeGreaterThan(2);
    noErrors(errors);
  });

  test('предмет × состояние: луна, одеяло, мишка, ночник, шкатулка', async ({ page }) => {
    const errors = await openScene(page, PAGE); await setup(page);
    const r = await page.evaluate(() => {
      const g = window.__game, Z = window.__care.sleep, T = window.__traces, out: any = {};
      window.go('sleep'); g.step(0.5);
      // бодрствует
      window.tap('teddy'); g.step(1.5); window.tap('teddy'); g.step(0.1); out.hugAwake = Z.teddy.hug < 0.5 && !Z.sleep;
      window.tap('lullaby'); g.step(0.2); out.lullAwake = Z.lull;
      window.tap('nightlight'); g.step(0.2); const h0 = Z.lamp.hue; window.tap('nightlight'); out.hue = Z.lamp.hue - h0; window.tapObj('lamp'); out.hueObj = Z.lamp.hue - h0;
      // луна укладывает
      window.tap('moon'); g.step(1.5); out.moonSleeps = Z.sleep;
      out.lullAsleep = Z.lull;
      // луна по спящему — подмигивает и сон-облачко
      window.tap('moon'); g.step(0.1); out.dream1 = Z.dream && Z.dream.k; out.wink = Z.wink < 0.5; out.stillAsleep = Z.sleep;
      g.step(1.5); window.tapObj('moon'); g.step(0.1); out.dream2 = Z.dream && Z.dream.k;
      out.dreamKeys = Object.keys(T.dreams).sort();
      // одеяло во сне: подоткнуть и бормочет
      window.tap('blanket'); g.step(1.2); window.tap('blanket'); g.step(0.05); out.tuck = Z.blanket.tuck > 0.8 && Z.stir < 0.2 && Z.sleep;
      // мишка во сне: тоже спит, прижимается, сердце не просыпается
      window.tapObj('teddy'); g.step(0.1); out.teddyAsleep = Z.teddy.nuz < 0.5 && Z.sleep;
      window.tapObj('box'); g.step(0.1); out.boxAsleep = Z.box.boost > 0 && Z.sleep;
      return out;
    });
    expect(r).toMatchObject({ hugAwake: true, lullAwake: 1, hue: 1, hueObj: 2, moonSleeps: true, lullAsleep: 0.55, wink: true, stillAsleep: true, tuck: true, teddyAsleep: true, boxAsleep: true });
    expect(r.dreamKeys).toEqual(['stars', 'teddy']);
    expect(r.dream1).toBe('teddy');
    expect(r.dream2).toBe('stars');
    await shot(page, `sleep-dream-${sz}`);
    noErrors(errors);
  });

  test('колыбельную играет только шкатулка', async ({ page }) => {
    const errors = await openScene(page, PAGE); await setup(page);
    const r = await page.evaluate(() => {
      const g = window.__game, Z = window.__care.sleep;
      window.go('sleep'); window.tap('moon'); g.step(1); const noBox = Z.lull;
      window.tap('lullaby'); g.step(0.2); const box = Z.lull;
      return { noBox, box };
    });
    expect(r).toEqual({ noBox: 0, box: 0.55 });
    noErrors(errors);
  });

  test('развязка: после сна ~60 с «выспалось», след переживает смену раздела', async ({ page }) => {
    const errors = await openScene(page, PAGE); await setup(page);
    const r = await page.evaluate(() => {
      const g = window.__game, Z = window.__care.sleep, T = window.__traces, out: any = {};
      window.go('sleep'); window.tap('moon'); g.step(0.5); window.tap('sun'); g.step(4); out.short = T.rested; // поспал мало — не выспалось
      window.tap('moon'); g.step(4); window.tap('sun'); g.step(4);
      out.rested = T.rested > 50 && T.rested < 60; out.day = Z.eve < 0.05; out.bed = !!Z.bed;
      window.go('food'); g.step(1); out.inFood = T.rested > 40;
      return out;
    });
    expect(r).toEqual({ short: 0, rested: true, day: true, bed: false, inFood: true });
    await shot(page, `sleep-rested-food-${sz}`);
    const r2 = await page.evaluate(() => { const g = window.__game, T = window.__traces; g.step(60); return T.rested; });
    expect(r2).toBe(0);
    noErrors(errors);
  });

  test('раскладка: мишка и шкатулка на кроватке у кончика сердца, не под кнопками; одеяло поверх', async ({ page }) => {
    const errors = await openScene(page, PAGE); await setup(page);
    const r = await page.evaluate(() => {
      const g = window.__game, Z = window.__care.sleep, G = g.G;
      window.go('sleep'); for (const k of ['teddy', 'lullaby', 'blanket', 'nightlight']) window.tap(k); g.step(1);
      const t = window.find('teddy'), b = window.find('box');
      const zs = [G.zones.wand, G.zones.party];
      const clear = (p: number[] | null) => !!p && zs.every((z: any) => Math.hypot(p[0] - z.x, p[1] - z.y) > z.r);
      return { teddy: !!t, box: !!b, teddyRight: t && t[0] > G.heart.x, boxLeft: b && b[0] < G.heart.x, clear: clear(t) && clear(b), low: !!t && t[1] > G.heart.y + 0.3 * G.heart.R };
    });
    expect(r).toEqual({ teddy: true, box: true, teddyRight: true, boxLeft: true, clear: true, low: true });
    await shot(page, `sleep-evening-${sz}`);
    await page.evaluate(() => { const g = window.__game; window.tap('moon'); g.step(2.5); });
    await shot(page, `sleep-night-${sz}`);
    noErrors(errors);
  });
});
