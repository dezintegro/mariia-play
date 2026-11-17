// Конкретные желания (какая игрушка, какая еда) и полотенце в ванной.
import { test, expect } from '@playwright/test';
import { openScene, shot, noErrors } from './helpers';

declare const window: any;

test('желания конкретные: игрушка и еда в пузыре, не то — «не-а»', async ({ page }) => {
  const errors = await openScene(page);
  const r0 = await page.evaluate(() => {
    const g = window.__game, A = g.api;
    A.launchHouse('nursery'); A.launchHouse('canteen'); for (let i = 0; i < 8; i++) A.launchBaby(); g.step(3);
    const kids = g.babies.filter((b: any) => b.type !== 'moon');
    const ws = [['play', 'horse'], ['play', 'xylo'], ['play', 'tower'], ['eat', 'banana'], ['eat', 'cookie'], ['eat', 'apple']];
    kids.slice(0, 6).forEach((b: any, i: number) => { b.wish = { k: ws[i][0], o: ws[i][1], t: 40, life: 40, no: 0 }; });
    g.step(0.6); g.pause(true);
    return true;
  });
  expect(r0).toBe(true);
  await shot(page, 'wishes-specific');
  const r = await page.evaluate(() => {
    const g = window.__game, A = g.api, out: any = {}; g.pause(false);
    // новые случайные желания «играть»/«есть» всегда с конкретным предметом
    const all = g.babies.filter((b: any) => b.type !== 'moon');
    let ok = true;
    for (let n = 0; n < 40; n++) for (const b of all) {
      b.wish = null; b.wishT = 0.01; b.love = 0; g.step(0.05);
      if (b.wish && (b.wish.k === 'play' || b.wish.k === 'eat') && !b.wish.o) ok = false;
    }
    out.allHaveObject = ok;
    all.forEach((b: any) => { b.wish = null; b.wishT = 999; });
    const N = g.houses.find((h: any) => h.kind === 'nursery'), C = g.houses.find((h: any) => h.kind === 'canteen');
    const kid = all[0], eater = all[1];
    const drop = (b: any, x: number, y: number) => { A.startDrag(b); A.moveDrag(b, x, y); A.dropBaby(b, x, y); };
    drop(kid, N.x, N.cy());
    A.enterRoom(N); g.step(1.2);
    const R = A.RL();
    kid.wish = { k: 'play', o: 'xylo', t: 60, life: 60, no: 0 };
    drop(kid, R.horse.x, R.horse.y - 80);
    out.wrongToy = { playing: kid.play?.k, wishKept: !!kid.wish, shake: kid.wish?.no > 0 };
    g.step(0.3);
    drop(kid, R.xylo.x, R.xylo.y);
    out.rightToy = { playing: kid.play?.k, wishDone: !kid.wish, love: kid.love > 0 };
    // столовая: хочет банан, дали яблоко — съел, но желание осталось; дали банан — восторг
    A.exitRoom(); g.step(1.2);
    eater.home = null; drop(eater, C.x, C.cy());
    A.enterRoom(C); g.step(1.2);
    const K = A.KL(), c = K.chairs[0];
    drop(eater, c.x, c.y - 150);
    eater.wish = { k: 'eat', o: 'banana', t: 60, life: 60, no: 0 };
    g.step(0.5); g.pause(true);
    return out;
  });
  await shot(page, 'canteen-wanted-food');
  const r2 = await page.evaluate(() => {
    const g = window.__game, A = g.api, out: any = {}; g.pause(false);
    const eater = g.babies.filter((b: any) => b.type !== 'moon')[1];
    const K = A.KL(), sl = A.traySlots(K);
    A.onRoomTap(sl[1].x, sl[1].y, A.hitRoom(sl[1].x, sl[1].y)); // яблоко
    g.step(7); out.afterApple = { wishKept: !!eater.wish };
    A.onRoomTap(sl[2].x, sl[2].y, A.hitRoom(sl[2].x, sl[2].y)); // банан
    g.step(7); out.afterBanana = { wishDone: !eater.wish };
    return out;
  });
  expect(r).toEqual({
    allHaveObject: true,
    wrongToy: { playing: 'horse', wishKept: true, shake: true },
    rightToy: { playing: 'xylo', wishDone: true, love: true },
  });
  expect(r2).toEqual({ afterApple: { wishKept: true }, afterBanana: { wishDone: true } });
  noErrors(errors);
});

test('полотенце: малыша из ванны вытирают, мокрый капает', async ({ page }) => {
  const errors = await openScene(page);
  const r = await page.evaluate(() => {
    const g = window.__game, A = g.api, out: any = {};
    A.launchHouse('bath'); for (let i = 0; i < 6; i++) A.launchBaby(); g.step(3);
    const B = g.houses[0], kids = g.babies.filter((b: any) => b.type !== 'moon').slice(0, 2);
    // летающая тарелка — проверить, что в комнате у неё нет «рожек»
    const ufo = g.babies.find((b: any) => b.type === 'ufo'); if (ufo && !kids.includes(ufo)) kids[1] = ufo;
    kids.forEach((b: any) => { b.wish = null; b.wishT = 999; });
    const drop = (b: any, x: number, y: number) => { A.startDrag(b); A.moveDrag(b, x, y); A.dropBaby(b, x, y); };
    for (const b of kids) drop(b, B.x, B.cy());
    A.enterRoom(B); g.step(1.2);
    const L = A.BL();
    drop(kids[0], L.tub.x - 60, L.tub.y - L.tub.h - 60); g.step(1);
    A.startDrag(kids[0]); out.wet = kids[0].wet > 0; A.moveDrag(kids[0], L.wrap.x, L.wrap.y - 60);
    g.step(0.5); A.dropBaby(kids[0], L.wrap.x, L.wrap.y - 60);
    out.wrapped = !!kids[0].towel;
    drop(kids[1], L.towel.x, L.towel.y + 50); out.secondNot = !kids[1].towel;
    g.step(1.6); g.pause(true);
    return out;
  });
  expect(r).toEqual({ wet: true, wrapped: true, secondNot: true });
  await shot(page, 'towel-rub');
  const r2 = await page.evaluate(() => {
    const g = window.__game, out: any = {}; g.pause(false);
    const b = g.babies.filter((x: any) => x.towel)[0];
    g.step(2.2); out.open = b.towel?.done; g.pause(true);
    return out;
  });
  await shot(page, 'towel-tada');
  const r3 = await page.evaluate(() => {
    const g = window.__game, out: any = {}; g.pause(false);
    const kid = g.babies.filter((x: any) => x.home && x.shine > 0)[0];
    g.step(1.5); out.done = !!kid && !kid.towel && !(kid.wet > 0);
    return out;
  });
  expect(r2).toEqual({ open: true });
  expect(r3).toEqual({ done: true });
  noErrors(errors);
});
