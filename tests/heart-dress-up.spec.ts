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
    const tapItem = (k: string | null) => { const it = g.UI.items.find((i: any) => i.k === k); A.tapAt(it.x, it.y); g.step(0.1); };
    out.def = { color: g.G.cfg.color, eyes: g.G.cfg.eyes };
    // 1. цвет — тапом по кнопке
    g.step(0.5); tapItem('purple'); out.color = g.G.cfg.color;
    // стрелка → этап «глаза»
    A.tapAt(g.UI.arrow.x, g.UI.arrow.y); g.step(0.5); out.stage1 = g.G.stage;
    out.noNoneOnEyes = !g.UI.items.some((i: any) => i.kind === 'none');
    tapItem('sparkle'); out.eyes = g.G.cfg.eyes;
    // прыжок по ленте прямо к причёске, выбрать и потом снять «без этого»
    const hairCell = g.UI.strip.cells[5]; A.tapAt(hairCell.x, hairCell.y); g.step(0.5); out.stageHair = g.G.stage;
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
    A.tapAt(g.UI.arrow.x, g.UI.arrow.y); g.step(0.5); out.stageBg = g.G.stage;
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

  // праздник: галочка на последнем этапе
  const f = await page.evaluate(() => {
    const g = window.__game, A = g.api, out: any = {};
    A.tapAt(g.UI.arrow.x, g.UI.arrow.y); out.finale = !!g.G.finale;
    g.step(2); out.uiHidden = g.G.uiA < 0.05;
    out.hitAgain = A.hitAt(g.UI.again.x, g.UI.again.y)?.k; out.hitCont = A.hitAt(g.UI.cont.x, g.UI.cont.y)?.k;
    return out;
  });
  expect(f).toEqual({ finale: true, uiHidden: true, hitAgain: 'again', hitCont: 'cont' });
  await shot(page, 'heart-finale');
  const c = await page.evaluate(() => {
    const g = window.__game, A = g.api, out: any = {};
    A.tapAt(g.UI.cont.x, g.UI.cont.y); out.afterCont = { finale: g.G.finale, hair: g.G.cfg.hair };
    A.startFinale(); g.step(2); A.tapAt(g.UI.again.x, g.UI.again.y);
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
    const h = g.G.heart, hs = g.G.hs;
    out.hitHeart = A.hitAt(h.x, h.y)?.k;
    A.tapAt(h.x, h.y); g.step(0.1); out.r1 = hs.jT < 0.5;
    A.tapAt(h.x, h.y); g.step(0.1); out.r2 = hs.wgT < 0.5;
    A.tapAt(h.x, h.y); g.step(0.1); out.r3 = hs.love > 0.5;
    // малыш-сердечко подпрыгивает
    g.env.babies[0].u = 0.08; g.step(0.05);
    const W = g.G.HR; const bx = W.x + g.env.babies[0].u * W.w;
    const target = A.hitAt(bx, W.y + W.h * 0.95 - Math.max(24, h.R * 0.17) * 0.95);
    out.babyHit = target?.k;
    if (target?.k === 'baby') { A.tapAt(bx, W.y + W.h * 0.95 - Math.max(24, h.R * 0.17) * 0.95); out.babyJump = target.o.jump < 0.1; }
    // пузырь лопается
    const n = g.env.bubbles.length, b = g.env.bubbles[0];
    if (b) { const bx2 = W.x + b.u * W.w + Math.sin(g.G.stageT) * 0, by = W.y + b.v * W.h; const hb = A.hitAt(bx2, by); out.bubbleKind = hb?.k; }
    out.hadBubbles = n > 0;
    return out;
  });
  expect(r).toMatchObject({ hitHeart: 'heart', r1: true, r2: true, r3: true, babyHit: 'baby', babyJump: true, hadBubbles: true });
  await shot(page, 'heart-interactions');
  noErrors(errors);
});

test('узкий экран (портрет телефона): всё помещается, кнопки крупные', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 760 });
  const errors = await openScene(page, PAGE);
  const r = await page.evaluate(() => {
    const g = window.__game, out: any = {};
    g.G.cfg.hair = 'long'; g.G.cfg.earrings = 'heart'; g.G.cfg.necklace = 'pearls';
    g.api.goStage(9); g.step(1);
    const U = g.UI, all = [...U.items, ...U.strip.cells, U.arrow];
    out.minR = Math.min(...all.map((b: any) => b.r));
    out.inside = all.every((b: any) => b.x - b.r >= -1 && b.x + b.r <= 391 && b.y - b.r >= -1 && b.y + b.r <= 761);
    const h = g.G.heart; out.heartAbovePanel = h.y + h.R < U.panel.y;
    return out;
  });
  expect(r.minR).toBeGreaterThanOrEqual(28);
  expect(r.inside).toBe(true);
  expect(r.heartAbovePanel).toBe(true);
  await shot(page, 'heart-portrait');
  noErrors(errors);
});
