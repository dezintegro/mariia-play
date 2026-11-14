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
    g.env.babies[0].u = 0.08; g.step(0.05);
    const W = g.G.HR; const bx = W.x + g.env.babies[0].u * W.w;
    const target = A.hitAt(bx, W.y + W.h * 0.95 - Math.max(24, h.R * 0.17) * 0.95);
    out.babyHit = target?.k;
    if (target?.k === 'baby') { A.tapAt(bx, W.y + W.h * 0.95 - Math.max(24, h.R * 0.17) * 0.95); out.babyJump = target.o.jump < 0.1; }
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
    const h = g.G.heart; out.heartAbovePanel = h.y + h.R < is.y;
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
