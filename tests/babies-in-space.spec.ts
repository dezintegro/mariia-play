// Сценарии «Малышей в космосе»: всё через window.__game (см. src/scenes/babies-in-space/main.ts).
// step(sec) прокручивает симуляцию мгновенно, без ожидания реального времени.
import { test, expect } from '@playwright/test';
import { openScene, shot, noErrors } from './helpers';

declare const window: any;

test('витрина открывает сцену', async ({ page }) => {
  await page.goto('./');
  await page.locator('a.scene').first().click({ force: true }); // карточка всё время покачивается
  await expect(page).toHaveURL(/babies-in-space/);
  await expect(page.locator('#play')).toBeVisible();
});

test('космос: выбор здания, 3 реакции малыша и планеты, желания', async ({ page }) => {
  const errors = await openScene(page);
  const r = await page.evaluate(() => {
    const g = window.__game, A = g.api, out: any = {};
    A.onTap(g.btn.house.x, g.btn.house.y, A.hit(g.btn.house.x, g.btn.house.y));
    g.step(0.3); out.pickerOpen = g.picker.open;
    const o = g.picker.opts[1]; A.onTap(o.x, o.y, A.hit(o.x, o.y));
    out.flying = g.picker.fly?.k; out.pickerAfter = g.picker.open;
    g.step(1.3); out.firstKind = g.houses[0]?.kind;
    // построенное здание пропадает из выбора, второе такое же не строится
    A.onTap(g.btn.house.x, g.btn.house.y, A.hit(g.btn.house.x, g.btn.house.y)); g.step(0.3);
    out.left = g.picker.opts.filter((q: any) => !g.houses.some((h: any) => h.kind === q.k)).map((q: any) => q.k);
    out.hitCanteen = A.hit(o.x, o.y)?.o?.k === 'canteen';
    A.launchHouse('canteen'); out.houses1 = g.houses.length;
    g.picker.open = false;
    A.launchHouse('nursery'); for (let i = 0; i < 10; i++) A.launchBaby(); g.step(2);
    out.babies = g.babies.length;
    const b = g.babies[2]; out.anims = [];
    for (let i = 0; i < 3; i++) { A.tapBaby(b); g.step(0.3); out.anims.push(b.anim ? b.anim.k : 'spin'); }
    A.tapPlanet(); A.tapPlanet(); A.tapPlanet(); g.step(0.2); out.planetHop = g.planet.hop > 0;
    g.babies.forEach((x: any) => x.wishT = 0.01); g.step(0.2);
    out.wishes = g.babies.filter((x: any) => x.wish).length;
    g.step(1);
    return out;
  });
  expect(r).toMatchObject({ pickerOpen: true, flying: 'canteen', firstKind: 'canteen', pickerAfter: false, left: ['nursery', 'bath'], hitCanteen: false, houses1: 1, babies: 16, anims: ['spin', 'dance', 'jump'], planetHop: true, wishes: 2 });
  await shot(page, 'space');
  noErrors(errors);
});

test('столовая: стульчики, кормление исполняет желание «есть»', async ({ page }) => {
  const errors = await openScene(page);
  const r = await page.evaluate(() => {
    const g = window.__game, A = g.api, out: any = {};
    A.launchHouse('canteen'); for (let i = 0; i < 6; i++) A.launchBaby(); g.step(3);
    const C = g.houses[0], kids = g.babies.filter((b: any) => b.type !== 'moon').slice(0, 2);
    for (const b of kids) { b.wish = { k: 'eat', t: 40, life: 40 }; A.startDrag(b); A.moveDrag(b, C.x, C.cy()); A.dropBaby(b, C.x, C.cy()); }
    A.enterRoom(C); g.step(1.2); out.scene = g.G.scene;
    const K = A.KL();
    kids.forEach((b: any, i: number) => { const c = K.chairs[i * 2]; A.startDrag(b); A.moveDrag(b, c.x, c.y - 150); A.dropBaby(b, c.x, c.y - 150); });
    out.inChairs = kids.filter((b: any) => b.chair).length;
    const sl = A.traySlots(K);
    for (const i of [1, 3]) A.onRoomTap(sl[i].x, sl[i].y, A.hitRoom(sl[i].x, sl[i].y));
    for (const k of ['fridge', 'stove']) A.onRoomTap(0, 0, { k });
    g.step(1.2); out.eating = kids.filter((b: any) => b.eat).length;
    // еда теперь — «спектакль» ~5.5 с (поймал → 3 укуса → животик), поэтому ждём дольше
    g.step(5.5); out.loved = kids.filter((b: any) => b.love > 0).length; out.wishesLeft = kids.filter((b: any) => b.wish).length;
    return out;
  });
  expect(r).toEqual({ scene: 'room', inChairs: 2, eating: 2, loved: 2, wishesLeft: 0 });
  await shot(page, 'canteen');
  noErrors(errors);
});

test('ясли: кроватка, лошадка, ксилофон, мяч, башня, выход через дверь', async ({ page }) => {
  const errors = await openScene(page);
  const r = await page.evaluate(() => {
    const g = window.__game, A = g.api, out: any = {};
    A.launchHouse('nursery'); for (let i = 0; i < 6; i++) A.launchBaby(); g.step(3);
    const N = g.houses[0], kids = g.babies.filter((b: any) => b.type !== 'moon').slice(0, 5);
    for (const b of kids) { A.startDrag(b); A.moveDrag(b, N.x, N.cy()); A.dropBaby(b, N.x, N.cy()); }
    A.enterRoom(N); g.step(1.2);
    const R = A.RL(), drop = (b: any, x: number, y: number) => { A.startDrag(b); A.moveDrag(b, x, y); A.dropBaby(b, x, y); };
    kids[1].wish = { k: 'sleep', t: 40, life: 40 }; kids[0].wish = { k: 'play', t: 40, life: 40 };
    drop(kids[0], R.horse.x, R.horse.y - 80); out.horse = kids[0].play?.k; out.horseLove = kids[0].love > 0;
    drop(kids[1], R.cribs[0].x, R.cribs[0].y - 60); out.crib = !!kids[1].crib; out.cribLove = kids[1].love > 0;
    drop(kids[2], R.xylo.x, R.xylo.y); out.xylo = kids[2].play?.k;
    const B = N.room.ball; drop(kids[3], B.x, B.y - 26); out.ball = kids[3].play?.k;
    g.step(1);
    const d = R.door; drop(kids[4], d.x + d.w / 2, d.y + d.h / 2); out.exited = !kids[4].home;
    g.step(6); out.kicks = kids[3].play ? kids[3].play.kicks : 'done';
    return out;
  });
  expect(r).toMatchObject({ horse: 'horse', horseLove: true, crib: true, cribLove: true, xylo: 'xylo', ball: 'ball', exited: true });
  await shot(page, 'nursery');
  noErrors(errors);
});

test('портрет (планшет): сцена рисуется без ошибок', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  const errors = await openScene(page);
  await page.evaluate(() => { const g = window.__game; g.api.launchHouse('canteen'); g.step(2); g.api.enterRoom(g.houses[0]); g.step(1.2); });
  await shot(page, 'canteen-portrait');
  noErrors(errors);
});

test('выбор малыша: веер над ракетой, выбранный вид вылетает, «сюрприз» — случайный', async ({ page }) => {
  for (const vp of [{ w: 390, h: 844, n: 'phone' }, { w: 844, h: 390, n: 'land' }, { w: 1280, h: 800, n: 'desk' }]) {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    const errors = await openScene(page);
    await page.evaluate(() => { const g = window.__game, A = g.api, L = g.btn.launch; A.onTap(L.x, L.y, A.hit(L.x, L.y)); g.step(0.6); g.pause(true); });
    await shot(page, `baby-picker-${vp.n}`);
    const r = await page.evaluate(() => {
      const g = window.__game, A = g.api, L = g.btn.launch, out: any = {}; g.pause(false);
      out.open = g.babyPicker.open; out.kinds = g.babyPicker.opts.map((o: any) => o.k);
      out.onScreen = g.babyPicker.opts.every((o: any) => o.x - o.r0 >= 0 && o.y - o.r0 >= 0 && o.x + o.r0 <= innerWidth && o.y + o.r0 <= innerHeight);
      out.bigEnough = g.babyPicker.opts.every((o: any) => o.r0 * 2 >= 60);
      out.noOverlap = g.babyPicker.opts.every((o: any, i: number, a: any[]) => i === 0 || Math.hypot(o.x - a[i - 1].x, o.y - a[i - 1].y) >= o.r0 * 2);
      const n0 = g.babies.length, got: string[] = [];
      for (const k of ['ufo', 'rocket', 'bubble', 'suit']) {
        const o = g.babyPicker.opts.find((q: any) => q.k === k), prev = o.prev;
        A.onTap(o.x, o.y, A.hit(o.x, o.y));
        const b = g.babies[g.babies.length - 1]; got.push(b.type);
        if (b !== prev || !o.prev || o.prev === prev) out.prevBad = k; // вылетел именно малыш из кнопки, на его месте новый
        g.step(0.2);
      }
      out.got = got; out.stillOpen = g.babyPicker.open;
      out.noBlink = g.babyPicker.t > 1 && g.babyPicker.idle < 0.5; // выбор не перезапускает анимацию раскрытия ряда
      const s = g.babyPicker.opts.find((q: any) => q.k === 'surprise'); A.onTap(s.x, s.y, A.hit(s.x, s.y));
      out.surprise = ['suit', 'bubble', 'ufo', 'rocket'].includes(g.babies[g.babies.length - 1].type);
      out.added = g.babies.length - n0;
      g.step(1.5);
      // повторный тап по ракете закрывает; тап мимо — тоже
      A.onTap(L.x, L.y, A.hit(L.x, L.y)); out.closedByRocket = !g.babyPicker.open;
      A.onTap(L.x, L.y, A.hit(L.x, L.y)); out.reopened = g.babyPicker.open;
      // открытие домиков закрывает веер малышей
      A.onTap(g.btn.house.x, g.btn.house.y, A.hit(g.btn.house.x, g.btn.house.y)); out.swap = !g.babyPicker.open && g.picker.open;
      g.picker.open = false;
      // до предела: веер закрывается, ракета трясётся
      while (g.babies.length < 17) A.launchBaby();
      A.onTap(L.x, L.y, A.hit(L.x, L.y)); out.full = !g.babyPicker.open && g.btn.launch.shake > 0;
      return out;
    });
    expect(r).toEqual({ open: true, kinds: ['suit', 'bubble', 'ufo', 'rocket', 'surprise'], onScreen: true, bigEnough: true, noOverlap: true,
      got: ['ufo', 'rocket', 'bubble', 'suit'], stillOpen: true, noBlink: true, surprise: true, added: 5, closedByRocket: true, reopened: true, swap: true, full: true });
    noErrors(errors);
  }
});
