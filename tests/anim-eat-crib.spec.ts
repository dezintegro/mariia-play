// «Спектакли» еды (столовая) и засыпания (кроватка): шагаем симуляцией до нужных моментов,
// замораживаем кадр (__game.paused) и сохраняем крупные скриншоты в test-results/shots/.
import { test, expect, type Page } from '@playwright/test';
import { openScene, noErrors } from './helpers';

declare const window: any;
test.use({ deviceScaleFactor: 2 });

/** скриншот области вокруг точки: x — центр кадра, y — низ кадра */
async function shotAt(page: Page, name: string, box: { x: number; y: number; w: number; h: number }) {
  const vp = page.viewportSize()!;
  const x = Math.max(0, Math.min(vp.width - box.w, box.x - box.w / 2)), y = Math.max(0, Math.min(vp.height - box.h, box.y - box.h));
  await page.screenshot({ path: `test-results/shots/${name}.png`, clip: { x, y, width: box.w, height: box.h } });
}

/** столовая: один малыш в стульчике, второй на полу */
async function setupCanteen(page: Page) {
  return page.evaluate(() => {
    const g = window.__game, A = g.api; g.paused = true;
    A.launchHouse('canteen'); for (let i = 0; i < 4; i++) A.launchBaby(); g.step(3);
    const C = g.houses[0], kids = g.babies.filter((b: any) => b.type !== 'moon').slice(0, 2);
    g.babies.forEach((b: any) => { b.wishT = 999; b.wish = null; });
    for (const b of kids) { A.startDrag(b); A.moveDrag(b, C.x, C.cy()); A.dropBaby(b, C.x, C.cy()); }
    A.enterRoom(C); g.step(1.2);
    const K = A.KL(), c = K.chairs[0];
    A.startDrag(kids[0]); A.moveDrag(kids[0], c.x, c.y - 150); A.dropBaby(kids[0], c.x, c.y - 150);
    const fl = kids[1]; A.startDrag(fl); A.moveDrag(fl, K.chairs[2].x, K.by1 - 40); A.dropBaby(fl, K.chairs[2].x, K.by1 - 40);
    g.step(1.5);
    g.kids = kids;
    return { chair: { x: c.x, y: c.y }, inChair: !!kids[0].chair };
  });
}
const feed = (page: Page, slot: number) => page.evaluate((i) => { const g = window.__game, A = g.api, sl = A.traySlots(A.KL())[i]; A.onRoomTap(sl.x, sl.y, A.hitRoom(sl.x, sl.y)); }, slot);
const step = (page: Page, sec: number) => page.evaluate((s) => {
  const g = window.__game; g.step(s); const b = g.kids[0], f = g.kids[1];
  return { a: b.eat && { ph: b.eat.ph, bites: b.eat.bites }, f: f.eat && { ph: f.eat.ph }, fx: f.ix, fy: f.iy };
}, sec);

for (const vp of [{ name: '', w: 1280, h: 800 }, { name: '-portrait', w: 820, h: 1180 }]) {
  test(`еда: ловит, кусает, гладит животик; бутылочка${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    const errors = await openScene(page);
    const { chair, inChair } = await setupCanteen(page);
    expect(inChair).toBe(true);
    const box = { x: chair.x, y: chair.y + 10, w: 260, h: 300 };
    await feed(page, 1); // яблоко → малышу в стульчике (стульчик в приоритете)
    let s = await step(page, 0.7 + 0.15);
    expect(s.a).toMatchObject({ ph: 'catch', bites: 0 });
    await shotAt(page, 'eat-catch' + vp.name, box);
    s = await step(page, 1.65);                          // после первого укуса жуёт
    expect(s.a).toMatchObject({ ph: 'chew', bites: 1 });
    s = await step(page, 1.05);                          // второй укус
    expect(s.a).toMatchObject({ ph: 'chew', bites: 2 });
    await shotAt(page, 'eat-bite' + vp.name, box);
    s = await step(page, 1.75);                          // гладит животик
    expect(s.a).toMatchObject({ ph: 'tummy', bites: 3 });
    await shotAt(page, 'eat-tummy' + vp.name, box);
    await feed(page, 0);                                 // бутылочка → малышу на полу
    s = await step(page, 0.7 + 1.0 + 1.2);
    expect(s.f).toMatchObject({ ph: 'drink' });
    await shotAt(page, 'eat-bottle' + vp.name, { x: s.fx, y: s.fy + 20, w: 240, h: 260 });
    s = await step(page, 4);
    expect(s.a).toBeFalsy(); expect(s.f).toBeFalsy();
    noErrors(errors);
  });

  test(`кроватка: зевает, трёт глазки, ложится, укрывается${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    const errors = await openScene(page);
    const crib = await page.evaluate(() => {
      const g = window.__game, A = g.api; g.paused = true;
      A.launchHouse('nursery'); for (let i = 0; i < 3; i++) A.launchBaby(); g.step(3);
      const N = g.houses[0], b = g.babies.filter((x: any) => x.type !== 'moon')[0];
      g.babies.forEach((x: any) => { x.wishT = 999; x.wish = null; });
      A.startDrag(b); A.moveDrag(b, N.x, N.cy()); A.dropBaby(b, N.x, N.cy());
      A.enterRoom(N); g.step(1.2);
      const R = A.RL(), c = R.cribs[0];
      A.startDrag(b); A.moveDrag(b, c.x, c.y - 60); A.dropBaby(b, c.x, c.y - 60);
      g.kid = b;
      return { x: c.x, y: c.y };
    });
    const box = { x: crib.x, y: crib.y + 10, w: 280, h: 320 };
    const st = (sec: number) => page.evaluate((s) => { const g = window.__game; g.step(s); const b = g.kid; return { bed: !!b.bed, sleeping: b.sleeping() }; }, sec);
    let s = await st(0.5 + 0.65); expect(s).toMatchObject({ bed: true, sleeping: false });
    await shotAt(page, 'crib-yawn' + vp.name, box);
    s = await st(1.15);
    await shotAt(page, 'crib-rub' + vp.name, box);
    s = await st(1.2);
    await shotAt(page, 'crib-lie' + vp.name, box);
    s = await st(0.9);
    await shotAt(page, 'crib-blanket' + vp.name, box);
    s = await st(1.5); expect(s).toMatchObject({ bed: false, sleeping: true });
    await shotAt(page, 'crib-sleep' + vp.name, box);
    // тап по спящему: просыпается, как раньше
    const woke = await page.evaluate(() => { const g = window.__game; g.api.tapRoomBaby(g.kid); g.step(0.3); return !g.kid.sleeping(); });
    expect(woke).toBe(true);
    noErrors(errors);
  });
}
