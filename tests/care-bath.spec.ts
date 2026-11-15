// Ванна по модели «место → нужда → предметы → развязка» (docs/research/2026-11-care/report.md, 2 и 3.2).
// Состояние — window.__care.bath (src/scenes/heart-dress-up/care/bath.ts), общие следы — window.__traces.
import { test, expect, type Page } from '@playwright/test';
import { openScene, shot, noErrors } from './helpers';

declare const window: any;
const PAGE = 'heart-dress-up/index.html';

/** go(id) — открыть раздел ухода, tap(k) — кнопка варианта, B() — состояние ванны, dirty() — «давно не мылось» */
async function setup(page: Page) {
  await page.evaluate(() => {
    const g = window.__game;
    g.pause(true);
    const first: Record<string, string> = { food: 'strawberry', bath: 'foam', sleep: 'moon' };
    const idx: Record<string, number> = {};
    for (let i = 0; i < g.UI.cells.length; i++) { g.api.goStage(i); const k = g.UI.items[0]?.kind === 'care' && g.UI.items[0].k; for (const id in first) if (first[id] === k) idx[id] = i; }
    g.api.goStage(0); g.step(3);
    window.go = (id: string) => g.api.goStage(idx[id]);
    window.tap = (k: string) => { const j = g.UI.items.findIndex((q: any) => q.k === k); g.api.revealItem(j); const it = g.UI.items[j]; g.api.tapAt(it.x, it.y); };
    window.B = () => window.__care.bath;
    window.dirty = () => { const B = window.__care.bath; B.spots.length = 0; B.since = 999; };
    window.clean = () => { const B = window.__care.bath; B.spots.length = 0; B.since = 0; };
    g.step(0.5);
  });
}

for (const [w, h] of [[390, 844], [1280, 800]]) test.describe(`ванна ${w}x${h}`, () => {
  test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: w, height: h }); });
  const sz = `${w}x${h}`;

  test('место: ванна въезжает с водой, не налезает на кнопки и не выходит за область сердца; при выходе — слив, отряхивание, уезжает', async ({ page }) => {
    const errors = await openScene(page, PAGE); await setup(page);
    const r = await page.evaluate(() => {
      const g = window.__game, G = g.G, out: any = {};
      window.dirty(); window.go('bath'); g.step(0.1); out.sliding = window.B().tub > 0 && window.B().tub < 1;
      g.step(0.8); out.tub = window.B().tub; out.level = window.B().level;
      const pts: [number, number][] = window.B().outline, A = G.HR, z = G.zones;
      out.npts = pts.length;
      out.dbg = JSON.stringify({ A, pts: pts.map(p => p.map(Math.round)) }); out.inside = pts.every(([x, y]) => x >= A.x - 1 && x <= A.x + A.w + 1 && y <= A.y + A.h + 1);
      // точка в многоугольнике (контур ванны) или на расстоянии меньше радиуса кнопки от контура
      const inPoly = (px: number, py: number) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) c = !c; } return c; };
      out.buttons = [z.wand, z.party].map((b: any) => !inPoly(b.x, b.y) && pts.every(([x, y]) => Math.hypot(x - b.x, y - b.y) > b.r));
      // сердце в воде нижней третью: верх воды ниже центра сердца, но выше кончика
      const H = G.heart; out.waterline = (pts[4][1] - H.y) / H.R;
      // уход: вода сливается, сердце отряхивается, ванна уезжает
      window.tap('shower'); g.step(1); out.wetBefore = window.B().wet > 0;
      window.go('food'); g.step(0.05);
      out.draining = !!window.B().drain && window.B().tub === 1;
      g.step(1.4); out.shaking = window.B().shake < 1.1; out.levelAfterDrain = window.B().level;
      g.step(1.2); out.dryAfterShake = window.B().wet === 0;
      g.step(0.5); out.tubGone = window.B().tub === 0;
      return out;
    });
    expect(r.sliding).toBe(true);
    expect(r.tub).toBe(1);
    expect(r.level).toBeGreaterThan(0.5);
    expect(r.npts).toBeGreaterThan(10);
    expect(r.inside, r.dbg).toBe(true);
    expect(r.buttons).toEqual([true, true]);
    expect(r.waterline).toBeGreaterThan(0.1);
    expect(r.waterline).toBeLessThan(0.45);
    expect(r).toMatchObject({ wetBefore: true, draining: true, shaking: true, levelAfterDrain: 0, dryAfterShake: true, tubGone: true });
    noErrors(errors);
  });

  test('нужда: давно не мылось — 3–5 пятнышек, душ отмывает; чистое — без пятен; следы еды становятся пятнышками', async ({ page }) => {
    const errors = await openScene(page, PAGE); await setup(page);
    const r = await page.evaluate(() => {
      const g = window.__game, out: any = {};
      window.dirty(); window.go('bath'); g.step(1);
      out.n = window.B().spots.length;
      out.kinds = window.B().spots.every((s: any) => ['dust', 'paint', 'paw'].includes(s.kind));
      // сердце намекает: смотрит на пятнышко
      g.step(0.8); out.hint = window.B().hint >= 0;
      window.tap('shower'); g.step(2.4); out.afterShower = window.B().spots.length; out.since = window.B().since < 3;
      g.step(3); window.go('food'); g.step(4);
      // снова в ванну сразу — сердце чистое, пятен нет
      window.go('bath'); g.step(0.5); out.cleanAgain = window.B().spots.length;
      // следы еды: крошки и кремовые усы → пятнышки, следы обнулены
      window.go('food'); g.step(4);
      window.__traces.crumbs = 0.6; window.__traces.cream = 1;
      window.go('bath'); g.step(0.5);
      out.fromFood = window.B().spots.map((s: any) => s.kind).sort();
      out.tracesTaken = !window.__traces.crumbs && !window.__traces.cream;
      return out;
    });
    expect(r.n).toBeGreaterThanOrEqual(3);
    expect(r.n).toBeLessThanOrEqual(5);
    expect(r.kinds).toBe(true);
    expect(r.hint).toBe(true);
    expect(r.afterShower).toBe(0);
    expect(r.since).toBe(true);
    expect(r.cleanAgain).toBe(0);
    expect(r.fromFood).toEqual(['cream', 'crumb', 'crumb']);
    expect(r.tracesTaken).toBe(true);
    noErrors(errors);
  });

  test('предметы: пена в 3 стадии, губка оттирает пятна, на сухом полотенце — «ку-ку», уточка брызгается, пальцем по пятну', async ({ page }) => {
    const errors = await openScene(page, PAGE); await setup(page);
    const r = await page.evaluate(() => {
      const g = window.__game, A = g.api, H = g.G.heart, out: any = {};
      window.dirty(); window.go('bath'); g.step(1);
      // губка на сухом: скрипит и оттирает каждое пятнышко наполовину
      const n = window.B().spots.length;
      window.tap('sponge'); g.step(n * 0.9 + 0.3);
      out.dryHalf = window.B().spots.length === n && window.B().spots.every((s: any) => s.dirt > 0.3 && s.dirt < 0.7);
      // пальцем по сухому пятну — чуть бледнеет; губка второй раз — пятен нет
      const s0 = window.B().spots[0], d0 = s0.dirt, x = H.x + s0.fx * H.R, y = H.y + s0.fy * H.R;
      out.hitSpot = A.hitAt(x, y)?.what; A.tapAt(x, y); out.fingerDry = s0.dirt < d0;
      window.tap('sponge'); g.step(window.B().spots.length * 0.9 + 0.3); out.spongeClean = window.B().spots.length;
      // пена: 1 — тело, 2 — причёска, 3 — борода и усы, 4 — ещё пены
      window.tap('foam'); g.step(0.6); out.st1 = [window.B().foamN, window.B().foam.every((c: any) => c.part === 'body')];
      window.tap('foam'); g.step(0.8); out.st2 = [window.B().foamN, window.B().foam.some((c: any) => c.part === 'hair')];
      window.tap('foam'); g.step(0.8); out.st3 = [window.B().foamN, window.B().foam.some((c: any) => c.part === 'beard')];
      const k = window.B().foam.length; window.tap('foam'); g.step(0.5); out.st4 = window.B().foam.length > k;
      out.suds = window.B().suds > 0.3;
      // полотенце в пене: вытирает, и пены нет
      window.tap('towel'); g.step(1.8); out.towelFoam = window.B().foam.length;
      // сухое полотенце — «ку-ку», без блеска
      window.B().glow = 0; window.tap('towel'); out.kukuDry = window.B().towel?.dry; g.step(1.2); out.kuku = !!window.B().towel?.kuku; g.step(0.5); out.kukuGlow = window.B().glow;
      // уточка в воде: тап — брызги, сердце мокрое
      window.tap('rubberduck'); g.step(0.6);
      out.duck = !!window.B().duck; const B = window.B(), dk = B.duck;
      out.wet0 = B.wet;
      // где уточка — ищем перебором
      let hit: number[] | null = null;
      for (let yy = H.y; yy < H.y + 1.2 * H.R && !hit; yy += 4) for (let xx = H.x - 1.3 * H.R; xx < H.x + 1.3 * H.R && !hit; xx += 4) if (A.hitAt(xx, yy)?.what === 'duck') hit = [xx, yy];
      if (hit) A.tapAt(hit[0], hit[1]);
      out.duckHit = !!hit; out.duckWet = window.B().wet > 0 && dk.jump < 0.1;
      out.dream = typeof window.__traces.dreams.duck === 'function';
      // тап по воде и по стенке ванны
      g.step(1);
      out.water = A.hitAt(H.x - 0.45 * H.R, H.y + 0.38 * H.R)?.what;
      out.tub = A.hitAt(H.x, H.y + 0.85 * H.R)?.what;
      return out;
    });
    expect(r.dryHalf).toBe(true);
    expect(r.hitSpot).toBe('spot');
    expect(r.fingerDry).toBe(true);
    expect(r.spongeClean).toBe(0);
    expect(r.st1).toEqual([1, true]);
    expect(r.st2).toEqual([2, true]);
    expect(r.st3).toEqual([3, true]);
    expect(r.st4).toBe(true);
    expect(r.suds).toBe(true);
    expect(r.towelFoam).toBe(0);
    expect(r.kukuDry).toBe(true);
    expect(r.kuku).toBe(true);
    expect(r.kukuGlow).toBe(0);
    expect(r).toMatchObject({ duck: true, duckHit: true, duckWet: true, dream: true, water: 'water', tub: 'tub' });
    noErrors(errors);
  });

  test('слив уносит пену и пузыри, потом душ снова наполняет; пустой слив — «чпок»', async ({ page }) => {
    const errors = await openScene(page, PAGE); await setup(page);
    const r = await page.evaluate(() => {
      const g = window.__game, out: any = {};
      window.clean(); window.go('bath'); g.step(1);
      window.tap('foam'); window.tap('soapbubbles'); window.tap('shower'); g.step(0.3);
      window.tap('drain'); g.step(0.05); out.draining = !!window.B().drain; out.showerOff = window.B().shower <= 0;
      g.step(1.5); out.after = { level: window.B().level, foam: window.B().foam.length, bubbles: window.B().bubbles.length, drain: window.B().drain, suds: window.B().suds };
      window.tap('drain'); g.step(0.05); out.emptyDrain = window.B().drain;
      window.tap('shower'); g.step(2.5); out.refilled = window.B().level > 0.6;
      return out;
    });
    expect(r).toEqual({ draining: true, showerOff: true, after: { level: 0, foam: 0, bubbles: 0, drain: null, suds: 0 }, emptyDrain: null, refilled: true });
    noErrors(errors);
  });

  test('развязка: чисто и сухо после мокрого — блестит ~90 с, и в других разделах', async ({ page }) => {
    const errors = await openScene(page, PAGE); await setup(page);
    const r = await page.evaluate(() => {
      const g = window.__game, out: any = {};
      window.dirty(); window.go('bath'); g.step(1);
      // мокрое, но пятна ещё есть: вытерли — блеска нет
      window.tap('rubberduck'); g.step(0.5);
      window.B().wet = 30; window.tap('towel'); g.step(1.8); out.dirtyGlow = window.B().glow;
      window.tap('shower'); g.step(2.6); out.clean = window.B().spots.length; out.wet = window.B().wet > 0;
      window.tap('towel'); g.step(1.8); out.glow = window.B().glow > 85; out.dry = window.B().wet;
      window.go('food'); g.step(30); out.glowFood = window.B().glow > 50;
      window.go('sleep'); g.step(30); out.glowSleep = window.B().glow > 20;
      g.step(40); out.glowEnd = window.B().glow;
      return out;
    });
    expect(r).toEqual({ dirtyGlow: 0, clean: 0, wet: true, glow: true, dry: 0, glowFood: true, glowSleep: true, glowEnd: 0 });
    noErrors(errors);
  });

  test('скриншоты ванны', async ({ page }) => {
    const errors = await openScene(page, PAGE); await setup(page);
    await page.evaluate(() => { const g = window.__game; window.dirty(); window.go('bath'); g.step(1.5); window.tap('rubberduck'); g.step(1); });
    await shot(page, `bath-spots-${sz}`);
    await page.evaluate(() => { const g = window.__game; window.tap('foam'); g.step(0.5); window.tap('foam'); g.step(0.5); window.tap('foam'); g.step(1); });
    await shot(page, `bath-foam3-${sz}`);
    await page.evaluate(() => { const g = window.__game; window.tap('shower'); g.step(1.0); });
    await shot(page, `bath-shower-${sz}`);
    await page.evaluate(() => { const g = window.__game; g.step(3); });
    await shot(page, `bath-wet-${sz}`);
    await page.evaluate(() => { const g = window.__game; window.tap('drain'); g.step(0.7); });
    await shot(page, `bath-drain-${sz}`);
    await page.evaluate(() => { const g = window.__game; g.step(1.5); window.tap('towel'); g.step(1.9); });
    await shot(page, `bath-glow-${sz}`);
    await page.evaluate(() => { const g = window.__game; window.tap('towel'); g.step(0.7); });
    await shot(page, `bath-kuku-${sz}`);
    await page.evaluate(() => { const g = window.__game; g.step(1); window.tap('shower'); g.step(1); window.go('food'); g.step(1.5); });
    await shot(page, `bath-exit-shake-${sz}`);
    await page.evaluate(() => { const g = window.__game; g.step(3); });
    await shot(page, `bath-glow-in-food-${sz}`);
    noErrors(errors);
  });
});
