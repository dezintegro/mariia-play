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
    tapStage(6); out.stageHair = g.G.stage;
    tapItem('crown'); out.hair1 = g.G.cfg.hair; tapItem(null); out.hair2 = g.G.cfg.hair; tapItem('pigtails');
    // остальные опциональные этапы
    const pickAt = (s: number, k: string) => { A.goStage(s); g.step(0.5); tapItem(k); };
    pickAt(2, 'long'); pickAt(3, 'heart'); pickAt(4, 'cat'); pickAt(5, 'blush'); pickAt(7, 'pearl'); pickAt(8, 'locket');
    out.cfg = { ...g.G.cfg, env: undefined, bgd: undefined };
    // окружение: несколько сразу
    A.goStage(9); g.step(0.5);
    for (const k of ['babies', 'bubbles', 'butterflies', 'balloons', 'sparkles', 'flowers']) tapItem(k);
    tapItem('sparkles'); // повторный тап — выключить
    out.env = Object.keys(g.G.cfg.env).filter(k => g.G.cfg.env[k]).sort();
    g.step(4); out.bubbles = g.env.bubbles.length;
    // фон — только цвета неба (один выбор), пейзаж — детали (несколько сразу)
    tapStage(10); out.stageBg = g.G.stage;
    out.bgKinds = [...new Set(g.UI.items.map((i: any) => i.kind))];
    tapItem('sky');
    tapStage(11); out.stageLand = g.G.stage;
    out.landKinds = [...new Set(g.UI.items.map((i: any) => i.kind))];
    for (const k of ['clouds', 'rainbow', 'sun', 'hills', 'moon']) tapItem(k);
    tapItem('moon'); // повторный тап — убрать
    out.bg = g.G.cfg.bg; out.bgd = Object.keys(g.G.cfg.bgd).filter(k => g.G.cfg.bgd[k]).sort();
    g.step(1.5);
    return out;
  });
  expect(r).toMatchObject({
    def: { color: 'red', eyes: 'round' }, color: 'purple', stage1: 1, noNoneOnEyes: true, eyes: 'sparkle',
    stageHair: 6, hair1: 'crown', hair2: null,
    cfg: { color: 'purple', eyes: 'sparkle', lashes: 'long', nose: 'heart', mouth: 'cat', cheeks: 'blush', hair: 'pigtails', earrings: 'pearl', necklace: 'locket', bg: 'pink' },
    env: ['babies', 'balloons', 'bubbles', 'butterflies', 'flowers'], stageBg: 10, bgKinds: ['bgcolor'], stageLand: 11, landKinds: ['none', 'bgd'], bg: 'sky', bgd: ['clouds', 'hills', 'rainbow', 'sun'],
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
    A.goStage(6); g.step(1);
    const is = U.itemsS;
    out.rows = new Set(U.items.map((i: any) => Math.round(i.y))).size;
    out.scrollable = is.cw > is.w && !!is.bar;
    out.minR = Math.min(...[...U.items, ...U.cells].map((b: any) => b.r));
    const h = g.G.heart; out.heartAbovePanel = h.y + h.R < U.stripS.y && U.stripS.y + U.stripS.h < is.y;
    out.stripScroll = U.stripS.cw > U.stripS.w && !!U.stripS.bar;
    // свайп по панели листает и ничего не выбирает
    const hair = g.G.cfg.hair, first = U.items[0];
    A.swipe(is.x + is.w * 0.8, first.y, -is.w * 0.5); g.step(0.05);
    out.offAfterSwipe = is.off > 10; out.bgSame = g.G.cfg.hair === hair;
    g.step(2); out.offClamped = is.off <= is.cw - is.w + 0.5;
    // тап по скроллбару в конце дорожки — лента в конце
    A.tapAt(is.bar.x + is.bar.w - 2, is.bar.y + is.bar.h / 2); g.step(0.5); out.barEnd = Math.abs(is.off - (is.cw - is.w)) < 2;
    // последний этап на ленте доступен после прокрутки ленты
    A.swipe(U.stripS.x + U.stripS.w * 0.8, U.stripS.y + U.stripS.h / 2, -600); g.step(1);
    const c = U.cells[11]; out.lastCellVisible = c.x + c.r <= U.stripS.x + U.stripS.w + 1;
    A.tapAt(c.x, c.y); out.stage = g.G.stage;
    A.goStage(6); g.step(1);
    return out;
  });
  expect(r).toEqual({ rows: 2, scrollable: true, minR: r.minR, heartAbovePanel: true, stripScroll: true, offAfterSwipe: true, bgSame: true, offClamped: true, barEnd: true, lastCellVisible: true, stage: 11 });
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
      for (let s = 0; s < 12; s++) {
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
    const ALB = 15;
    // наряд руками → палочка его не трогает, поэтому и в альбом перед ней ничего не кладётся
    A.goStage(0); g.step(0.5); const pur = U.items.find((i: any) => i.k === 'purple'); A.tapAt(pur.x, pur.y);
    out.dirty = G.dirty; out.hand = [...G.byHand];
    out.hitWand = A.hitAt(U.wand.x, U.wand.y)?.k;
    const before = JSON.stringify(G.cfg);
    A.tapAt(U.wand.x, U.wand.y); out.wandOn = !!G.wand; out.albumAfterWand = G.album.length;
    out.noColorClick = !G.wand.seq.some((q: any) => q[0] === 'color');
    g.step(3); out.wandDone = G.wand === null; out.changed = JSON.stringify(G.cfg) !== before; out.color = G.cfg.color;
    out.envSome = Object.values(G.cfg.env).some(Boolean);
    A.wand(); g.step(4); out.albumAfter2 = G.album.length; out.dirtyAfterWand = G.dirty;
    // альбом: фотоаппарат кладёт текущее сердце (вместе с метками «моё»), тап по фото возвращает его
    A.goStage(ALB); g.step(0.5);
    out.first = U.items[0].kind;
    A.tapAt(U.items[0].x, U.items[0].y); out.flash = G.flash > 0; out.albumN = G.album.length;
    out.photoHand = G.album[0].hand;
    g.step(1); const snap = JSON.stringify(G.cfg);
    out.photos = U.items.filter((i: any) => i.kind === 'photo').length;
    A.goStage(6); A.choose({ kind: 'single', k: G.cfg.hair === 'bunny' ? 'crown' : 'bunny' }); A.goStage(ALB); g.step(0.5);
    out.handBeforeLoad = [...G.byHand].sort();
    const ph = U.items[1]; A.tapAt(ph.x, ph.y); g.step(0.3);
    out.restored = JSON.stringify(G.cfg) === snap; out.handAfterLoad = [...G.byHand];
    // «заново» в празднике: сначала фото в альбом, метки «моё» снимаются
    A.goStage(1); g.step(0.3); A.choose({ kind: 'single', k: G.cfg.eyes === 'cat' ? 'glasses' : 'cat' }); const n0 = G.album.length;
    A.party(); g.step(2); out.hitCamera = A.hitAt(U.camera.x, U.camera.y)?.k;
    A.tapAt(U.again.x, U.again.y); out.albumAfterAgain = G.album.length - n0; out.reset = G.cfg.eyes === 'round'; out.handAfterAgain = G.byHand.size;
    g.step(1);
    return out;
  });
  expect(r).toMatchObject({ dirty: true, hand: ['color'], hitWand: 'wand', wandOn: true, albumAfterWand: 0, noColorClick: true, wandDone: true, changed: true, color: 'purple', envSome: true,
    albumAfter2: 0, dirtyAfterWand: true, first: 'camera', flash: true, albumN: 1, photoHand: ['color'], photos: 1,
    handBeforeLoad: ['color', 'hair'], restored: true, handAfterLoad: ['color'], hitCamera: 'camera', albumAfterAgain: 1, reset: true, handAfterAgain: 0 });
  // альбом и снятые метки переживают перезагрузку
  await page.reload(); await page.waitForFunction(() => window.__game);
  expect(await page.evaluate(() => [window.__game.G.album.length, window.__game.G.byHand.size])).toEqual([3, 0]); // фото с фотоаппарата, с ушками (сбережено при загрузке фото), с кошачьими глазами
  await page.evaluate(() => { const g = window.__game; g.start(); g.api.goStage(15); g.step(1); });
  await page.waitForTimeout(700);
  await shot(page, 'heart-album');
  await page.evaluate(() => { const g = window.__game; g.api.goStage(2); g.api.wand(); g.step(0.5); });
  await shot(page, 'heart-wand');
  noErrors(errors);
});

test('палочка не трогает разделы, выбранные руками (и после перезагрузки); метка «моё»; «заново» снимает метки', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await openScene(page, PAGE);
  const r = await page.evaluate(() => {
    const g = window.__game, A = g.api, U = g.UI, G = g.G, out: any = {};
    const tapItem = (k: string | null) => { const i = U.items.findIndex((q: any) => q.k === k); A.revealItem(i); const it = U.items[i]; A.tapAt(it.x, it.y); g.step(0.1); };
    A.goStage(0); g.step(0.3); tapItem('green');
    A.goStage(6); g.step(0.3); tapItem(null);        // «без этого» руками — тоже выбор
    A.goStage(10); g.step(0.3); tapItem('pink');     // повторный тап по уже выбранному цвету фона — тоже «моё»
    A.goStage(11); g.step(0.3); tapItem('moon');
    out.hand = [...G.byHand].sort();
    const keep = () => G.cfg.color === 'green' && G.cfg.hair === null && G.cfg.bg === 'pink' && JSON.stringify(G.cfg.bgd) === '{"moon":true}';
    let ok = 0, other = new Set<string>();
    for (let i = 0; i < 25; i++) {
      A.wand();
      if (G.wand && G.wand.seq.some((q: any) => ['color', 'hair', 'bg', 'bgd'].includes(q[0]))) out.badClick = true;
      g.step(3.5); if (keep()) ok++; other.add(G.cfg.eyes + G.cfg.nose + G.cfg.necklace);
    }
    out.ok = ok; out.variety = other.size > 5;
    A.goStage(0); g.step(1.5);
    return out;
  });
  expect(r).toEqual({ hand: ['bg', 'color', 'hair', 'land'], ok: 25, variety: true });
  await shot(page, 'heart-hand-badges-390x844');

  // после перезагрузки метки на месте, палочка их по-прежнему обходит
  await page.reload(); await page.waitForFunction(() => window.__game);
  const r2 = await page.evaluate(() => {
    const g = window.__game, A = g.api, G = g.G, out: any = {}; g.start();
    out.hand = [...G.byHand].sort();
    let ok = 0;
    for (let i = 0; i < 10; i++) { A.wand(); g.step(3.5); if (G.cfg.color === 'green' && G.cfg.hair === null && G.cfg.bgd.moon && Object.keys(G.cfg.bgd).filter(k => G.cfg.bgd[k]).length === 1) ok++; }
    out.ok = ok;
    // руками выбрано всё: палочка крутит сердце и смеётся, но наряд не меняет
    for (const id of ['color', 'eyes', 'lashes', 'nose', 'mouth', 'cheeks', 'hair', 'earrings', 'necklace', 'env', 'bg', 'land']) G.byHand.add(id);
    const snap = JSON.stringify(G.cfg);
    A.wand(); out.spin = G.hs.spinT < 0.1; out.noWandSeq = G.wand === null; g.step(3); out.same = JSON.stringify(G.cfg) === snap;
    // «заново» снимает все метки — палочка снова меняет всё
    A.restart(); out.handAfterRestart = G.byHand.size; g.step(1);
    const fresh = JSON.stringify(G.cfg); A.wand(); out.wandWorks = !!G.wand; g.step(3.5); out.changedAfterRestart = JSON.stringify(G.cfg) !== fresh;
    return out;
  });
  expect(r2).toEqual({ hand: ['bg', 'color', 'hair', 'land'], ok: 10, spin: true, noWandSeq: true, same: true, handAfterRestart: 0, wandWorks: true, changedAfterRestart: true });
  await page.reload(); await page.waitForFunction(() => window.__game);
  expect(await page.evaluate(() => window.__game.G.byHand.size)).toBe(0);
  noErrors(errors);
});

test('метка «моё» на ноутбуке: лента из 16 разделов', async ({ page }) => {
  const errors = await openScene(page, PAGE);
  const r = await page.evaluate(() => {
    const g = window.__game, A = g.api, U = g.UI, G = g.G;
    A.goStage(0); A.choose({ kind: 'single', k: 'blue' }); A.goStage(11); A.choose({ kind: 'bgd', k: 'rainbow' });
    A.wand(); g.step(4); A.goStage(10); g.step(1);
    const ss = U.stripS;
    return { n: U.cells.length, fits: ss.cw <= ss.w, minCell: Math.min(...U.cells.map((c: any) => c.r * 2)), hand: [...G.byHand].sort() };
  });
  expect(r.n).toBe(16);
  expect(r.minCell).toBeGreaterThanOrEqual(60);
  expect(r.hand).toEqual(['color', 'land']);
  console.log(`1280x800: лента ${r.fits ? 'влезает без прокрутки' : 'листается'}, ячейка ${r.minCell.toFixed(0)}px`);
  await shot(page, 'heart-hand-badges-1280x800');
  noErrors(errors);
});

test('портрет: отметки разделов, кнопки не перекрыты окружением', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await openScene(page, PAGE);
  const r = await page.evaluate(() => {
    const g = window.__game, U = g.UI, G = g.G, out: any = {};
    Object.assign(G.cfg, { color: 'blue', hair: 'bow', nose: 'clown', env: { babies: true, duck: true, flowers: true, kitten: true }, bgd: { moon: true, garland: true } });
    g.api.goStage(9); g.step(3);
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
  const IDS = ['color', 'eyes', 'lashes', 'nose', 'mouth', 'cheeks', 'hair', 'earrings', 'necklace'];
  // 1. выбор каждого варианта 9 этапов наряда запускает реакцию именно на него, и через ~2.5 с она заканчивается
  const r = await page.evaluate((IDS) => {
    const g = window.__game, A = g.api, hs = g.G.hs, bad: string[] = [];
    let n = 0;
    IDS.forEach((id: string, s: number) => {
      A.goStage(s); g.step(0.3);
      for (const it of g.UI.items) {
        if (it.kind !== 'single') continue;
        g.G.cfg[id] = id === 'color' || id === 'eyes' || id === 'mouth' ? '_' : null; // уже надетый вариант повторно не выбирается
        A.choose(it);
        const a = hs.act;
        if (!a || a.id !== id || a.k !== it.k) bad.push(`нет реакции ${id}:${it.k}`);
        if (!g.hasReaction(id, it.k)) bad.push(`нет своей реакции (звук+анимация) ${id}:${it.k}`);
        g.step(0.9); // середина реакции — всё рисуется без ошибок
        g.step(1.6);
        if (hs.act) bad.push(`не закончилась ${id}:${it.k}`);
        n++;
      }
    });
    return { n, bad };
  }, IDS);
  expect(r.bad).toEqual([]);
  expect(r.n).toBe(97);
  noErrors(errors);

  // 2. тап по надетой детали — реакция именно этой детали; тап по телу — старые 3 реакции
  const t = await page.evaluate(() => {
    const g = window.__game, A = g.api, hs = g.G.hs, out: any = {};
    Object.assign(g.G.cfg, { color: 'pink', eyes: 'round', lashes: 'long', nose: 'clown', mouth: 'gap', cheeks: 'blush', hair: 'crown', earrings: 'bell', necklace: 'beads', env: {}, bgd: {} });
    A.goStage(0); g.step(2.5);
    const h = g.G.heart;
    const tap = (px: number, py: number) => { hs.act = null; A.tapAt(h.x + px * h.R, h.y + py * h.R); const a = hs.act; g.step(2.5); return a ? a.id + ':' + a.k : null; };
    out.nose = tap(0, 0.06); out.mouth = tap(0.05, 0.28); out.eyes = tap(-0.34, -0.1); out.lashes = tap(0.36, -0.36); out.cheeks = tap(0.56, 0.12);
    out.earrings = tap(-0.92, 0.3); out.necklace = tap(0.3, 0.52); out.hair = tap(0, -0.85);
    const r0 = hs.react; out.body = tap(0, -0.45); out.bodyOld = hs.react === r0 + 1;
    return out;
  });
  expect(t).toEqual({ nose: 'nose:clown', mouth: 'mouth:gap', eyes: 'eyes:round', lashes: 'lashes:long', cheeks: 'cheeks:blush', earrings: 'earrings:bell', necklace: 'necklace:beads', hair: 'hair:crown', body: null, bodyOld: true });

  // 3. скриншоты в середине реакций — смотреть глазами
  const mid: [Record<string, string>, string, string, number][] = [
    [{}, 'hair', 'crown', 0.6], [{}, 'nose', 'clown', 0.15], [{}, 'eyes', 'sunglasses', 0.6], [{}, 'necklace', 'scarf', 0.6],
    [{}, 'necklace', 'beads', 0.35], [{}, 'color', 'rainbow', 0.7], [{}, 'hair', 'bunny', 0.2], [{}, 'earrings', 'bell', 0.3],
    [{ lashes: 'long' }, 'eyes', 'glasses', 0.75], [{}, 'cheeks', 'blush', 0.8], [{ nose: 'pig' }, 'hair', 'pigtails', 0.5], [{ lashes: 'color' }, 'eyes', 'sparkle', 0.4],
    [{ nose: 'dot' }, 'mouth', 'lips', 0.5], [{ nose: 'mustache', necklace: 'bowtie' }, 'mouth', 'fang', 0.2], [{ nose: 'strawberry' }, 'mouth', 'o', 0.5],
  ];
  for (const [cfg, id, k, at] of mid) {
    await page.evaluate(([cfg, id, k, at, IDS]: any) => {
      const g = window.__game; g.pause(true);
      Object.assign(g.G.cfg, { color: 'red', eyes: 'round', lashes: null, nose: null, mouth: 'smile', cheeks: null, hair: null, earrings: null, necklace: null, env: {}, bgd: {} }, cfg);
      g.api.goStage(IDS.indexOf(id)); g.step(2);
      g.G.hs.act = null; g.G.hs.love = 0;
      g.G.cfg[id] = id === 'color' || id === 'eyes' || id === 'mouth' ? '_' : null;
      g.api.choose({ kind: 'single', k });
      g.step(at);
    }, [cfg, id, k, at, IDS]);
    await shot(page, `heart-react-${id}-${k}`);
    await page.evaluate(() => { const g = window.__game; g.step(2.5); g.pause(false); });
  }
  noErrors(errors);
});

test('палитра в тон: на каждом цвете сердца все детали и их реакции рисуются без ошибок', async ({ page }) => {
  const errors = await openScene(page, PAGE);
  const r = await page.evaluate(() => {
    const g = window.__game, G = g.G, IDS = ['eyes', 'lashes', 'nose', 'mouth', 'cheeks', 'hair', 'earrings', 'necklace'];
    let n = 0;
    // варианты берём из панели каждого этапа
    const all: [string, string][] = [];
    IDS.forEach((id: string) => { g.api.goStage(['color', ...IDS].indexOf(id)); g.step(0.05); for (const it of g.UI.items) if (it.kind === 'single') all.push([id, it.k]); });
    g.api.goStage(0); g.step(0.05);
    for (const color of g.colors) {
      Object.assign(G.cfg, { color, eyes: 'round', lashes: 'long', nose: 'dot', mouth: 'smile', cheeks: 'blush', hair: 'bow', earrings: 'pearl', necklace: 'pearls' });
      for (const [id, k] of all) {
        G.cfg[id] = k; G.hs.act = { id, k, t: 0.6 }; g.step(1 / 60); n++; // кадр в середине реакции
      }
      G.hs.act = null; G.hs.blink = 0.5; G.hs.love = 1; G.hs.mouth = 1; g.step(1 / 60); G.hs.love = 0; // открытый рот, моргание и «влюблённость» на последнем наряде
    }
    return { n, colors: g.colors.length, variants: all.length };
  });
  expect(r.colors).toBeGreaterThanOrEqual(12);
  expect(r.variants).toBe(87);
  expect(r.n).toBe(r.colors * r.variants);
  noErrors(errors);
});

test('палочка собирает образы из наборов: много раз подряд без ошибок, детали — из панели', async ({ page }) => {
  const errors = await openScene(page, PAGE);
  const r = await page.evaluate(() => {
    const g = window.__game, G = g.G, A = g.api, bad: string[] = [];
    const STG = ['color', 'eyes', 'lashes', 'nose', 'mouth', 'cheeks', 'hair', 'earrings', 'necklace'];
    const opts: Record<string, string[]> = {};
    STG.forEach((id, s) => { A.goStage(s); g.step(0.05); opts[id] = g.UI.items.filter((i: any) => i.kind === 'single').map((i: any) => i.k); });
    // наборы — только из существующих вариантов
    for (const set of g.SETS) for (const id of STG) if (!opts[id].includes(set[id])) bad.push(`набор ${set.name}: ${id}=${set[id]}`);
    // wandCfg: 400 раз; больше половины — узнаваемый набор (совпадает с набором минимум в 5 деталях)
    let fromSet = 0;
    for (let i = 0; i < 400; i++) {
      const c = A.wandCfg();
      for (const id of STG) if (c[id] != null && !opts[id].includes(c[id])) bad.push(`wandCfg ${id}=${c[id]}`);
      if (g.SETS.some((s: any) => STG.filter(id => s[id] === c[id]).length >= 5)) fromSet++;
    }
    // настоящая палочка 40 раз подряд
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      A.wand(); g.step(3);
      if (G.wand) bad.push('палочка не закончила');
      seen.add(STG.map(id => G.cfg[id]).join('|'));
    }
    return { bad, fromSet, distinct: seen.size };
  });
  expect(r.bad).toEqual([]);
  expect(r.fromSet).toBeGreaterThan(200);
  expect(r.fromSet).toBeLessThan(370);
  expect(r.distinct).toBeGreaterThan(20);
  await shot(page, 'heart-wand-set');
  noErrors(errors);
});

test('рот: выбирается, звёздочка не на улыбке, открывается; старое сохранение без рта работает', async ({ page }) => {
  // старое сохранение: без поля mouth и с номером этапа «старой» ленты (без stageId)
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
    localStorage.setItem('mariia-play:heart-dress-up', JSON.stringify({ cfg: { color: 'blue', eyes: 'cat', nose: 'pig', env: {}, bgd: {} }, stage: 3, album: [{ id: 1, cfg: { color: 'pink', eyes: 'round', env: {}, bgd: {} } }] }));
  });
  const errors = await openScene(page, PAGE);
  const r = await page.evaluate(() => {
    const g = window.__game, A = g.api, U = g.UI, G = g.G, out: any = {};
    out.loaded = { color: G.cfg.color, mouth: G.cfg.mouth, album: G.album[0].cfg.mouth, hand: G.byHand.size, photoHand: G.album[0].hand };
    const mi = g.UI.cells.findIndex((c: any) => c.i === 4); out.mi = mi;
    A.tapAt(U.cells[4].x, U.cells[4].y); g.step(0.5);
    out.noNone = !U.items.some((i: any) => i.kind === 'none'); out.n = U.items.length;
    out.selSmile = U.items.findIndex((i: any) => i.k === 'smile') === 0;
    const it = U.items.find((i: any) => i.k === 'tongue'); A.revealItem(U.items.indexOf(it)); A.tapAt(it.x, it.y);
    out.mouth = G.cfg.mouth; out.act = G.hs.act && G.hs.act.id + ':' + G.hs.act.k;
    g.step(2.5);
    // открытый рот во всех вариантах — без ошибок
    for (const k of g.UI.items.map((i: any) => i.k)) for (const m of [0.3, 1]) { G.cfg.mouth = k; G.hs.mouth = m; g.step(1 / 60); }
    G.cfg.mouth = 'tongue'; g.step(1);
    return out;
  });
  expect(r).toEqual({ loaded: { color: 'blue', mouth: 'smile', album: 'smile', hand: 0, photoHand: [] }, mi: 4, noNone: true, n: 10, selSmile: true, mouth: 'tongue', act: 'mouth:tongue' });
  await shot(page, 'heart-mouth');
  noErrors(errors);
});

test('старое сохранение с общим «фоном»: открывается на «фоне», детали пейзажа на месте', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
    localStorage.setItem('mariia-play:heart-dress-up', JSON.stringify({ cfg: { color: 'pink', bg: 'night', bgd: { moon: true, castle: true }, env: {} }, stage: 10, stageId: 'bg', album: [], dirty: true }));
  });
  const errors = await openScene(page, PAGE);
  const r = await page.evaluate(() => {
    const g = window.__game, G = g.G, U = g.UI;
    g.step(0.5);
    const bgCell = U.cells.findIndex((c: any) => c.i === 10);
    return { stage: G.stage, bg: G.cfg.bg, bgd: Object.keys(G.cfg.bgd).sort(), hand: G.byHand.size, items: U.items.length, bgCell };
  });
  expect(r).toEqual({ stage: 10, bg: 'night', bgd: ['castle', 'moon'], hand: 0, items: 8, bgCell: 10 });
  await shot(page, 'heart-old-bg-save');
  noErrors(errors);
});

// Уход: еда, ванна, сон. Состояние ухода — window.__care .food / .bath / .sleep (care/).
for (const [w, h] of [[1280, 800], [390, 844]]) test(`уход: еда, ванна, сон (${w}x${h})`, async ({ page }) => {
  await page.setViewportSize({ width: w, height: h });
  const errors = await openScene(page, PAGE);
  const sz = `${w}x${h}`;
  // ЕДА: каждое угощение летит ко рту, сердце жуёт
  const food = await page.evaluate(() => {
    const g = window.__game, A = g.api, C = window.__care, out: any = { eats: 0, flew: 0 };
    const si = [...Array(20).keys()].find((i: number) => { A.goStage(i); g.step(0.05); return g.UI.items[0]?.k === 'strawberry'; });
    out.stage = si; g.step(0.5);
    const n = g.UI.items.length; out.n = n;
    for (let j = 0; j < n; j++) {
      A.revealItem(j); const it = g.UI.items[j]; A.tapAt(it.x, it.y);
      if (C.food.fly.length) out.flew++;
      g.step(0.75); if (C.food.eat) out.eats++;
      g.step(3.0); // смешная еда дня дольше (гримаса), иначе следующее ждёт в очереди
    }
    out.favFound = C.food.favFound;
    // ещё раз — снимок во время жевания
    A.revealItem(1); const it = g.UI.items[1]; A.tapAt(it.x, it.y); g.step(1.0);
    out.chewing = !!C.food.eat && C.food.eat.bites >= 1 && C.food.eat.bites < 3;
    return out;
  });
  expect(food.n).toBeGreaterThanOrEqual(6);
  expect(food.flew).toBe(food.n);
  expect(food.eats).toBe(food.n);
  expect(food.favFound).toBe(true);
  expect(food.chewing).toBe(true);
  await shot(page, `heart-care-food-${sz}`);

  // ВАННА: пена (лопается тапом), уточка, душ, пузыри, губка, полотенце
  const tapK = `(k) => { const g = window.__game, j = g.UI.items.findIndex(q => q.k === k); g.api.revealItem(j); const it = g.UI.items[j]; g.api.tapAt(it.x, it.y); }`;
  const bath = await page.evaluate((tapK) => {
    const g = window.__game, A = g.api, C = window.__care, out: any = {}, tap = eval(tapK);
    g.step(3); A.goStage(g.G.stage + 1); g.step(0.5);
    out.isBath = g.UI.items[0]?.k === 'foam';
    tap('foam'); g.step(1); out.foamOn = C.bath.foamOn; out.foam0 = C.bath.foam.length;
    out.foamSel = g.UI.items.find((q: any) => q.k === 'foam') && C.bath.foamOn;
    const c = C.bath.foam[0], H = g.G.heart, px = H.x + c.fx * H.R, py = H.y + c.fy * H.R;
    out.hitFoam = A.hitAt(px, py)?.what; A.tapAt(px, py); out.foam1 = C.bath.foam.length;
    tap('rubberduck'); g.step(0.6); out.duck = !!C.bath.duck;
    tap('shower'); g.step(0.8); out.shower = C.bath.shower > 0 && C.bath.drops.length > 0;
    tap('soapbubbles'); g.step(1.2); out.bubbles = C.bath.bubbles.length;
    const b = C.bath.bubbles.find((q: any) => q.t > 0.3), bx = b.x + Math.sin(b.ph) * b.r * 0.4, n = C.bath.bubbles.length;
    out.hitBubble = A.hitAt(bx, b.y)?.what; A.tapAt(bx, b.y); out.bubblePopped = C.bath.bubbles.length === n - 1;
    tap('sponge'); g.step(0.6); out.sponge = !!C.bath.sponge;
    return out;
  }, tapK);
  expect(bath).toMatchObject({ isBath: true, foamOn: true, hitFoam: 'foam', duck: true, shower: true, sponge: true, hitBubble: 'bubble', bubblePopped: true });
  expect(bath.foam1).toBe(bath.foam0 - 1);
  await shot(page, `heart-care-bath-${sz}`);
  const bath2 = await page.evaluate((tapK) => {
    const g = window.__game, C = window.__care, out: any = {}, tap = eval(tapK);
    g.step(2); tap('towel'); g.step(2); out.foamAfterTowel = C.bath.foam.length; out.foamOn = C.bath.foamOn; out.shine = C.bath.shine > 0;
    tap('rubberduck'); out.duckOff = !C.bath.duck;
    return out;
  }, tapK);
  expect(bath2).toEqual({ foamAfterTowel: 0, foamOn: false, shine: true, duckOff: true });

  // СОН: луна укладывает, тап по сердцу — сонно моргает, солнышко будит, уход с раздела будит
  const sleep = await page.evaluate((tapK) => {
    const g = window.__game, A = g.api, C = window.__care, out: any = {}, tap = eval(tapK);
    A.goStage(g.G.stage + 1); g.step(0.5);
    out.isSleep = g.UI.items[0]?.k === 'moon';
    tap('moon'); g.step(2); out.sleep = C.sleep.sleep; out.night = C.sleep.night > 0.5;
    for (const k of ['teddy', 'nightlight', 'blanket', 'lullaby']) tap(k);
    g.step(1.5);
    out.on = { teddy: !!C.sleep.teddy, lamp: !!C.sleep.lamp, blanket: !!C.sleep.blanket, box: !!C.sleep.box };
    const H = g.G.heart; out.hitHeart = A.hitAt(H.x, H.y + H.R * 0.15)?.k;
    A.tapAt(H.x, H.y + H.R * 0.15); g.step(0.5); out.stillAsleep = C.sleep.sleep; out.stir = C.sleep.stir < 1;
    // звёздочки ночника отвечают на тап
    // звёзды случайные — какие-то могут прятаться за фонариком или кнопкой; хотя бы большинство должны ловить тап
    const L = C.sleep.lamp, A2 = g.G.HR;
    const hits = L.stars.filter((st: any) => { const u = ((st.u + L.t * 0.008) % 1 + 1) % 1; return A.hitAt(A2.x + 0.04 * A2.w + u * A2.w * 0.92, A2.y + st.v * A2.h)?.what === 'star'; }).length;
    out.hitStar = hits >= L.stars.length / 2;
    return out;
  }, tapK);
  expect(sleep).toMatchObject({ isSleep: true, sleep: true, night: true, on: { teddy: true, lamp: true, blanket: true, box: true }, hitHeart: 'heart', stillAsleep: true, stir: true, hitStar: true });
  await page.evaluate(() => window.__game.step(1.5));
  await shot(page, `heart-care-sleep-${sz}`);
  const wake = await page.evaluate((tapK) => {
    const g = window.__game, A = g.api, C = window.__care, out: any = {}, tap = eval(tapK);
    tap('sun'); g.step(0.3); out.awakeBySun = !C.sleep.sleep; g.step(3);
    tap('moon'); g.step(1); out.asleepAgain = C.sleep.sleep;
    A.goStage(0); g.step(0.5); out.wokeOnLeave = !C.sleep.sleep; out.cleared = !C.sleep.teddy && !C.sleep.lamp && !C.sleep.box;
    g.step(3); out.dayAgain = C.sleep.night < 0.1;
    return out;
  }, tapK);
  expect(wake).toEqual({ awakeBySun: true, asleepAgain: true, wokeOnLeave: true, cleared: true, dayAgain: true });
  noErrors(errors);
});
