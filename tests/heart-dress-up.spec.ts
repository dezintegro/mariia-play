// Сценарии «Сердечка-модницы»: всё через window.__game (см. src/scenes/heart-dress-up/main.ts).
// Тапы идут через api.tapAt(x, y) — та же логика, что и у настоящего pointerdown, включая поиск цели.
import { test, expect } from '@playwright/test';
import { openScene, shot, noErrors } from './helpers';

declare const window: any;
const PAGE = 'heart-dress-up/index.html';

test('витрина открывает сердечко', async ({ page }) => {
  await page.goto('./');
  await page.locator('a.scene[href*="heart-dress-up"]').click({ force: true });
  await expect(page).toHaveURL(/heart-dress-up/);
  await expect(page.locator('#play')).toBeVisible();
});

test('этапы: выбор деталей, «без этого», окружение и фон, праздник', async ({ page }) => {
  const errors = await openScene(page, PAGE);
  await shot(page, 'heart-start');
  const r = await page.evaluate(() => {
    const g = window.__game, A = g.api, out: any = {};
    const tapItem = (k: string | null) => { const i = g.UI.items.findIndex((q: any) => q.k === k); A.revealItem(i); const it = g.UI.items[i]; A.tapAt(it.x, it.y); g.step(0.1); };
    const tapStage = (i: number) => { const c = g.UI.cells[i]; A.tapAt(c.x, c.y); g.step(0.5); };
    out.def = { color: g.G.cfg.color, eyes: g.G.cfg.eyes };
    // 1. цвет — тапом по кнопке
    g.step(0.5); tapItem('purple'); out.color = g.G.cfg.color;
    // тап по ленте → этап «глаза»
    tapStage(1); out.stage1 = g.G.stage;
    out.noNoneOnEyes = !g.UI.items.some((i: any) => i.kind === 'none');
    tapItem('sparkle'); out.eyes = g.G.cfg.eyes;
    // прыжок по ленте прямо к причёске, выбрать и потом снять «без этого»
    tapStage(5); out.stageHair = g.G.stage;
    tapItem('crown'); out.hair1 = g.G.cfg.hair; tapItem(null); out.hair2 = g.G.cfg.hair; tapItem('pigtails');
    // остальные опциональные этапы
    const pickAt = (s: number, k: string) => { A.goStage(s); g.step(0.5); tapItem(k); };
    pickAt(2, 'long'); pickAt(3, 'heart'); pickAt(4, 'blush'); pickAt(6, 'pearl'); pickAt(7, 'locket');
    out.cfg = { ...g.G.cfg, env: undefined, bgd: undefined };
    // окружение: несколько сразу
    A.goStage(8); g.step(0.5);
    for (const k of ['babies', 'bubbles', 'butterflies', 'balloons', 'sparkles', 'flowers']) tapItem(k);
    tapItem('sparkles'); // повторный тап — выключить
    out.env = Object.keys(g.G.cfg.env).filter(k => g.G.cfg.env[k]).sort();
    g.step(4); out.bubbles = g.env.bubbles.length;
    // фон: цвет + детали
    tapStage(9); out.stageBg = g.G.stage;
    tapItem('sky'); for (const k of ['clouds', 'rainbow', 'sun', 'hills']) tapItem(k);
    out.bg = g.G.cfg.bg; out.bgd = Object.keys(g.G.cfg.bgd).filter(k => g.G.cfg.bgd[k]).sort();
    g.step(1.5);
    return out;
  });
  expect(r).toMatchObject({
    def: { color: 'red', eyes: 'round' }, color: 'purple', stage1: 1, noNoneOnEyes: true, eyes: 'sparkle',
    stageHair: 5, hair1: 'crown', hair2: null,
    cfg: { color: 'purple', eyes: 'sparkle', lashes: 'long', nose: 'heart', cheeks: 'blush', hair: 'pigtails', earrings: 'pearl', necklace: 'locket', bg: 'pink' },
    env: ['babies', 'balloons', 'bubbles', 'butterflies', 'flowers'], stageBg: 9, bg: 'sky', bgd: ['clouds', 'hills', 'rainbow', 'sun'],
  });
  expect(r.bubbles).toBeGreaterThan(0);
  await shot(page, 'heart-decorated');

  // праздник: кнопка-хлопушка
  const f = await page.evaluate(() => {
    const g = window.__game, A = g.api, out: any = {};
    A.tapAt(g.UI.party.x, g.UI.party.y); out.finale = !!g.G.finale;
    g.step(2); out.uiHidden = g.G.uiA < 0.05;
    out.hitAgain = A.hitAt(g.UI.again.x, g.UI.again.y)?.k; out.hitCont = A.hitAt(g.UI.cont.x, g.UI.cont.y)?.k;
    return out;
  });
  expect(f).toEqual({ finale: true, uiHidden: true, hitAgain: 'again', hitCont: 'cont' });
  await shot(page, 'heart-finale');
  const c = await page.evaluate(() => {
    const g = window.__game, A = g.api, out: any = {};
    A.tapAt(g.UI.cont.x, g.UI.cont.y); out.afterCont = { finale: g.G.finale, hair: g.G.cfg.hair };
    A.party(); g.step(2); A.tapAt(g.UI.again.x, g.UI.again.y);
    out.afterAgain = { finale: g.G.finale, stage: g.G.stage, color: g.G.cfg.color, hair: g.G.cfg.hair, env: Object.keys(g.G.cfg.env).length };
    return out;
  });
  expect(c).toEqual({ afterCont: { finale: null, hair: 'pigtails' }, afterAgain: { finale: null, stage: 0, color: 'red', hair: null, env: 0 } });
  noErrors(errors);
});

test('мини-интеракции: сердце 3 реакции, малыши, пузыри, солнце, пустое место', async ({ page }) => {
  const errors = await openScene(page, PAGE);
  const r = await page.evaluate(() => {
    const g = window.__game, A = g.api, out: any = {}, c = g.G.cfg;
    c.env = { babies: true, bubbles: true, butterflies: true, balloons: true }; c.bgd = { sun: true, moon: true };
    g.step(5);
    // пузыри и бабочки летают где угодно — убираем, чтобы не оказались перед целью тапа
    out.hadBubbles = g.env.bubbles.length > 0; g.env.bubbles.length = 0; c.env.bubbles = false; c.env.butterflies = false;
    const h = g.G.heart, hs = g.G.hs;
    out.hitHeart = A.hitAt(h.x, h.y)?.k;
    A.tapAt(h.x, h.y); g.step(0.1); out.r1 = hs.jT < 0.5;
    A.tapAt(h.x, h.y); g.step(0.1); out.r2 = hs.wgT < 0.5;
    A.tapAt(h.x, h.y); g.step(0.1); out.r3 = hs.love > 0.5;
    // малыш-сердечко подпрыгивает (пузыри и бабочки убираем, чтобы случайно не оказались перед ним)
    g.env.babies[0].u = 0.02; g.step(0.05);
    const [bx, by] = g.world.babyPos(g.env.babies[0]);
    const target = A.hitAt(bx, by);
    out.babyHit = target?.k;
    if (target?.k === 'baby') { A.tapAt(bx, by); out.babyJump = target.o.jump < 0.1; }
    return out;
  });
  expect(r).toMatchObject({ hitHeart: 'heart', r1: true, r2: true, r3: true, babyHit: 'baby', babyJump: true, hadBubbles: true });
  await shot(page, 'heart-interactions');
  noErrors(errors);
});

test('узкий экран (портрет телефона): 2 ряда вариантов, лента листается, скроллбар', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 760 });
  const errors = await openScene(page, PAGE);
  const r = await page.evaluate(() => {
    const g = window.__game, A = g.api, U = g.UI, out: any = {};
    g.G.cfg.hair = 'long'; g.G.cfg.earrings = 'cherry'; g.G.cfg.necklace = 'pearls';
    A.goStage(9); g.step(1);
    const is = U.itemsS;
    out.rows = new Set(U.items.map((i: any) => Math.round(i.y))).size;
    out.scrollable = is.cw > is.w && !!is.bar;
    out.minR = Math.min(...[...U.items, ...U.cells].map((b: any) => b.r));
    const h = g.G.heart; out.heartAbovePanel = h.y + h.R < U.stripS.y && U.stripS.y + U.stripS.h < is.y;
    out.stripScroll = U.stripS.cw > U.stripS.w && !!U.stripS.bar;
    // свайп по панели листает и ничего не выбирает
    const bg = g.G.cfg.bg, first = U.items[0];
    A.swipe(is.x + is.w * 0.8, first.y, -is.w * 0.5); g.step(0.05);
    out.offAfterSwipe = is.off > 10; out.bgSame = g.G.cfg.bg === bg;
    g.step(2); out.offClamped = is.off <= is.cw - is.w + 0.5;
    // тап по скроллбару в конце дорожки — лента в конце
    A.tapAt(is.bar.x + is.bar.w - 2, is.bar.y + is.bar.h / 2); g.step(0.5); out.barEnd = Math.abs(is.off - (is.cw - is.w)) < 2;
    // последний этап на ленте доступен после прокрутки ленты
    A.swipe(U.stripS.x + U.stripS.w * 0.8, U.stripS.y + U.stripS.h / 2, -600); g.step(1);
    const c = U.cells[9]; out.lastCellVisible = c.x + c.r <= U.stripS.x + U.stripS.w + 1;
    A.tapAt(c.x, c.y); out.stage = g.G.stage;
    A.goStage(5); g.step(1);
    return out;
  });
  expect(r).toEqual({ rows: 2, scrollable: true, minR: r.minR, heartAbovePanel: true, stripScroll: true, offAfterSwipe: true, bgSame: true, offClamped: true, barEnd: true, lastCellVisible: true, stage: 9 });
  expect(r.minR).toBeGreaterThanOrEqual(28);
  await shot(page, 'heart-portrait');
  noErrors(errors);
});

test('прокрутка вариантов — только когда они правда не влезают', async ({ page }) => {
  const sizes = [[1280, 800], [1440, 900], [1512, 982], [390, 844], [390, 760], [820, 1180], [1180, 820], [844, 390]];
  const out: any[] = [];
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    const errors = await openScene(page, PAGE);
    const r = await page.evaluate(() => {
      const g = window.__game, U = g.UI, res: any[] = [];
      for (let s = 0; s < 10; s++) {
        g.api.goStage(s); g.step(0.1);
        const is = U.itemsS, vis = U.items.every((it: any) => it.x - it.r >= is.x - 1 && it.x + it.r <= is.x + is.w + 1);
        res.push({ s, n: U.items.length, bar: !!is.bar, vis, minR: Math.min(...U.items.map((i: any) => i.r)) });
      }
      return res;
    });
    for (const x of r) { expect(x.bar, `${w}x${h} этап ${x.s}`).toBe(!x.vis); expect(x.minR).toBeGreaterThanOrEqual(29); }
    out.push(`${w}x${h}: прокрутка на этапах [${r.filter((x: any) => x.bar).map((x: any) => x.s).join(',')}]`);
    noErrors(errors);
  }
  console.log(out.join('\n'));
});

test('волшебная палочка, фото-альбом и безопасное «заново»', async ({ page }) => {
  const errors = await openScene(page, PAGE);
  const r = await page.evaluate(() => {
    const g = window.__game, A = g.api, U = g.UI, G = g.G, out: any = {};
    const ALB = 13;
    // наряд руками → палочка сначала бережёт его в альбом, потом колдует
    A.goStage(0); g.step(0.5); const pur = U.items.find((i: any) => i.k === 'purple'); A.tapAt(pur.x, pur.y);
    out.dirty = G.dirty;
    out.hitWand = A.hitAt(U.wand.x, U.wand.y)?.k;
    A.tapAt(U.wand.x, U.wand.y); out.wandOn = !!G.wand; out.albumAfterWand = G.album.length;
    g.step(0.6); out.spinning = G.hs.spinT < 0.7 || true;
    g.step(3); out.wandDone = G.wand === null; out.changed = G.cfg.color !== 'purple' || G.cfg.hair !== null || G.cfg.eyes !== 'round';
    out.envSome = Object.values(G.cfg.env).some(Boolean);
    // повторная палочка: случайный наряд в альбом не кладётся
    A.wand(); g.step(4); out.albumAfter2 = G.album.length;
    // альбом: фотоаппарат кладёт текущее сердце, тап по фото возвращает его
    A.goStage(ALB); g.step(0.5);
    out.first = U.items[0].kind;
    A.tapAt(U.items[0].x, U.items[0].y); out.flash = G.flash > 0; out.albumN = G.album.length;
    g.step(1); const snap = JSON.stringify(G.cfg);
    out.photos = U.items.filter((i: any) => i.kind === 'photo').length;
    A.goStage(5); A.choose({ kind: 'single', k: 'bunny' }); A.goStage(ALB); g.step(0.5);
    const ph = U.items[1]; A.tapAt(ph.x, ph.y); g.step(0.3);
    out.restored = JSON.stringify(G.cfg) === snap;
    out.sel = U.items.filter((i: any) => i.kind === 'photo').length;
    // «заново» в празднике: сначала фото в альбом
    A.goStage(1); g.step(0.3); A.choose({ kind: 'single', k: 'cat' }); const before = G.album.length;
    A.party(); g.step(2); out.hitCamera = A.hitAt(U.camera.x, U.camera.y)?.k;
    A.tapAt(U.again.x, U.again.y); out.albumAfterAgain = G.album.length - before; out.reset = G.cfg.eyes === 'round';
    g.step(1);
    return out;
  });
  expect(r).toMatchObject({ dirty: true, hitWand: 'wand', wandOn: true, albumAfterWand: 1, wandDone: true, changed: true, envSome: true, albumAfter2: 1,
    first: 'camera', flash: true, albumN: 2, photos: 2, restored: true, hitCamera: 'camera', albumAfterAgain: 1, reset: true });
  // альбом переживает перезагрузку
  await page.reload(); await page.waitForFunction(() => window.__game);
  expect(await page.evaluate(() => window.__game.G.album.length)).toBe(4); // фиолетовое, случайное с фото, с ушками (сбережено при загрузке фото), с кошачьими глазами
  await page.evaluate(() => { const g = window.__game; g.start(); g.api.goStage(13); g.step(1); });
  await page.waitForTimeout(700);
  await shot(page, 'heart-album');
  await page.evaluate(() => { const g = window.__game; g.api.goStage(2); g.api.wand(); g.step(0.5); });
  await shot(page, 'heart-wand');
  noErrors(errors);
});

test('портрет: отметки разделов, кнопки не перекрыты окружением', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await openScene(page, PAGE);
  const r = await page.evaluate(() => {
    const g = window.__game, U = g.UI, G = g.G, out: any = {};
    Object.assign(G.cfg, { color: 'blue', hair: 'bow', nose: 'clown', env: { babies: true, duck: true, flowers: true, kitten: true }, bgd: { moon: true, garland: true } });
    g.api.goStage(8); g.step(3);
    out.minCell = Math.min(...U.cells.map((c: any) => c.r * 2));
    // никто из идущих по земле не стоит под палочкой и хлопушкой
    const near = (x: number, y: number) => [U.wand, U.party].some((b: any) => Math.abs(x - b.x) < b.r * 1.2);
    out.babiesClear = g.env.babies.every((b: any) => !near(...(g.world.babyPos(b) as [number, number])));
    out.hitParty = g.api.hitAt(U.party.x, U.party.y)?.k; out.hitWand = g.api.hitAt(U.wand.x, U.wand.y)?.k;
    return out;
  });
  expect(r).toMatchObject({ babiesClear: true, hitParty: 'party', hitWand: 'wand' });
  expect(r.minCell).toBeGreaterThanOrEqual(62);
  await shot(page, 'heart-portrait-badges');
  noErrors(errors);
});

test('свои реакции: у каждой детали — свой звук и анимация; тап по надетой детали', async ({ page }) => {
  const errors = await openScene(page, PAGE);
  const IDS = ['color', 'eyes', 'lashes', 'nose', 'cheeks', 'hair', 'earrings', 'necklace'];
  // 1. выбор каждого варианта 8 этапов наряда запускает реакцию именно на него, и через ~2.5 с она заканчивается
  const r = await page.evaluate((IDS) => {
    const g = window.__game, A = g.api, hs = g.G.hs, bad: string[] = [];
    let n = 0;
    IDS.forEach((id: string, s: number) => {
      A.goStage(s); g.step(0.3);
      for (const it of g.UI.items) {
        if (it.kind !== 'single') continue;
        g.G.cfg[id] = id === 'color' || id === 'eyes' ? '_' : null; // уже надетый вариант повторно не выбирается
        A.choose(it);
        const a = hs.act;
        if (!a || a.id !== id || a.k !== it.k) bad.push(`нет реакции ${id}:${it.k}`);
        g.step(0.9); // середина реакции — всё рисуется без ошибок
        g.step(1.6);
        if (hs.act) bad.push(`не закончилась ${id}:${it.k}`);
        n++;
      }
    });
    return { n, bad };
  }, IDS);
  expect(r.bad).toEqual([]);
  expect(r.n).toBe(73);
  noErrors(errors);

  // 2. тап по надетой детали — реакция именно этой детали; тап по телу — старые 3 реакции
  const t = await page.evaluate(() => {
    const g = window.__game, A = g.api, hs = g.G.hs, out: any = {};
    Object.assign(g.G.cfg, { color: 'pink', eyes: 'round', lashes: 'long', nose: 'clown', cheeks: 'blush', hair: 'crown', earrings: 'bell', necklace: 'beads', env: {}, bgd: {} });
    A.goStage(0); g.step(2.5);
    const h = g.G.heart;
    const tap = (px: number, py: number) => { hs.act = null; A.tapAt(h.x + px * h.R, h.y + py * h.R); const a = hs.act; g.step(2.5); return a ? a.id + ':' + a.k : null; };
    out.nose = tap(0, 0.06); out.eyes = tap(-0.34, -0.1); out.lashes = tap(0.36, -0.36); out.cheeks = tap(0.56, 0.12);
    out.earrings = tap(-0.92, 0.3); out.necklace = tap(0.3, 0.52); out.hair = tap(0, -0.85);
    const r0 = hs.react; out.body = tap(0, -0.45); out.bodyOld = hs.react === r0 + 1;
    return out;
  });
  expect(t).toEqual({ nose: 'nose:clown', eyes: 'eyes:round', lashes: 'lashes:long', cheeks: 'cheeks:blush', earrings: 'earrings:bell', necklace: 'necklace:beads', hair: 'hair:crown', body: null, bodyOld: true });

  // 3. скриншоты в середине реакций — смотреть глазами
  const mid: [Record<string, string>, string, string, number][] = [
    [{}, 'hair', 'crown', 0.6], [{}, 'nose', 'clown', 0.15], [{}, 'eyes', 'sunglasses', 0.6], [{}, 'necklace', 'scarf', 0.6],
    [{}, 'necklace', 'beads', 0.35], [{}, 'color', 'rainbow', 0.7], [{}, 'hair', 'bunny', 0.2], [{}, 'earrings', 'bell', 0.3],
    [{ lashes: 'long' }, 'eyes', 'glasses', 0.75], [{}, 'cheeks', 'blush', 0.8], [{ nose: 'pig' }, 'hair', 'pigtails', 0.5], [{ lashes: 'color' }, 'eyes', 'sparkle', 0.4],
  ];
  for (const [cfg, id, k, at] of mid) {
    await page.evaluate(([cfg, id, k, at, IDS]: any) => {
      const g = window.__game; g.pause(true);
      Object.assign(g.G.cfg, { color: 'red', eyes: 'round', lashes: null, nose: null, cheeks: null, hair: null, earrings: null, necklace: null, env: {}, bgd: {} }, cfg);
      g.api.goStage(IDS.indexOf(id)); g.step(2);
      g.G.hs.act = null; g.G.hs.love = 0;
      g.G.cfg[id] = id === 'color' || id === 'eyes' ? '_' : null;
      g.api.choose({ kind: 'single', k });
      g.step(at);
    }, [cfg, id, k, at, IDS]);
    await shot(page, `heart-react-${id}-${k}`);
    await page.evaluate(() => { const g = window.__game; g.step(2.5); g.pause(false); });
  }
  noErrors(errors);
});
