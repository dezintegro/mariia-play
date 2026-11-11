// Спектакль «малыш строит башню из кубиков»:
//   unstack — малыш хлопает, кубики башни сами спрыгивают в кучку рядом с ним (вжух-тик-тик);
//   b0..b4  — по кубику: тянется правой ручкой к кучке → берёт → несёт к груди двумя ручками →
//             левой ручкой ставит на верх башни (для верхних кубиков подпрыгивает в невесомости) →
//             кубик приземляется с «ток», сплющивается-пружинит, башня растёт;
//   cheer   — спускается, хлопает, над башней искорки;
//   whack   — замахивается и шлёпает по башне — кубики разлетаются (обычная физика knockTower);
//   laugh   — смеётся, подпрыгивает, хлопает. Потом комната сама собирает башню (towerT в updateNursery).
// Всё — функция времени от начала игры (как у ксилофона).
import { tone } from '../../../core/audio';
import { S, ctx, t } from '../../../core/canvas';
import { circle } from '../../../core/draw';
import { burst } from '../../../core/particles';
import { ease, lerp, phaseAt, phasesDur, type Phase } from '../../../core/tween';
import { armHand } from '../characters';
import { BLOCK_COLORS, drawBlock, knockTower, towerRest } from '../nursery';
import { sfx } from '../sounds';
import { RB } from '../state';
import { type Pt, armWave, bodyForHand, clapSfx, clapWave, rigScale, rigWorld, setPose } from './rig';

const BD = 0.95; // на один кубик
export const TPHASES: Phase[] = [
  ['unstack', 0.9], ...[0, 1, 2, 3, 4].map(j => [`b${j}`, BD] as Phase), ['cheer', 1.0], ['whack', 0.7], ['laugh', 1.3],
];
export const TDUR = phasesDur(TPHASES);
const T0 = 0.9; // начало первого кубика
// доли внутри кубика: дотянулся, взял, у груди, передал, поставил
const U_REACH = 0.28, U_GRAB = 0.32, U_LIFT = 0.36, U_CHEST = 0.6, U_PASS = 0.66, U_LAND = 0.88;

/** кучка кубиков справа от малыша: два внизу + ... (номер = очередь, кубик j ставится в слот j) */
function heap(L): { x: number; y: number; rot: number }[] {
  const k = S, x = L.tower.x, f = L.tower.y - 18 * k;
  return [
    { x: x + 98 * k, y: f - 36 * k, rot: 0.06 }, { x: x + 134 * k, y: f - 36 * k, rot: -0.08 },
    { x: x + 80 * k, y: f + 2 * k, rot: -0.05 }, { x: x + 116 * k, y: f, rot: 0.04 }, { x: x + 152 * k, y: f + 2 * k, rot: 0.1 },
  ];
}
const PICK_DIR: Pt[] = [[0.85, 0.25], [0.85, 0.25], [0.55, 0.84], [0.55, 0.84], [0.55, 0.84]];
const PLACE_DIR: Pt[] = [[-0.6, 0.8], [-0.95, 0.3], [-0.85, -0.5], [-0.55, -0.83], [-0.42, -0.9]];
const IDLE = 0.3;
const CHEST = () => armWave(1, 0.02, 1); // ручки вниз — кубик между ладошками у животика
/** ладошка держит кубик за бок: смещение центра кубика от ладошки */
const OFF = () => 15 * S;

export const towerSpot = (L): Pt => [L.tower.x + 55 * S, L.tower.y - 2 * S];

export function towerStart(b, L) {
  const P = b.play, R = b.home.room;
  P.d = P.t = TDUR; P.landN = 0; P.grabN = 0; P.hopN = 0; P.clapN = 0; P.whacked = false; P.cheered = false; P.tik = 0;
  [b.ix, b.iy] = towerSpot(L); b.face = -1;
  // откуда кубики спрыгивают: из стоящей башни или оттуда, где валяются после падения
  const from = (R.tower || towerRest(L)).slice().sort((a, c) => a.i - c.i).map(p => ({ x: p.x, y: p.y, rot: p.rot }));
  R.tower = null;
  R.tb = { from, blocks: [], hands: [], wob: 0 };
}

interface St { ix: number; dy: number; armL: number; armR: number; lean?: number }
const mix = (a: St, c: St, p: number): St => ({ ix: lerp(a.ix, c.ix, p), dy: lerp(a.dy, c.dy, p), armL: lerp(a.armL, c.armL, p), armR: lerp(a.armR, c.armR, p), lean: lerp(a.lean || 0, c.lean || 0, p) });

export function towerUpdate(b, L) {
  const P = b.play, R = b.home.room, vis = b.visible(), at = P.d - P.t, ph = phaseAt(at, TPHASES), k = S;
  const [rx, iy] = towerSpot(L); b.iy = iy; b.face = -1;
  const H = heap(L), slots = towerRest(L), TB = R.tb;
  if (!TB) return; // башню уже разбили (например, игру прервали)
  const pickSt = (j: number): St => { const s = bodyForHand(1, PICK_DIR[j], [H[j].x - OFF(), H[j].y], iy); return { ix: s.ix, dy: s.dy, armR: s.wave, armL: IDLE }; };
  const placeSt = (j: number): St => { const s = bodyForHand(-1, PLACE_DIR[j], [slots[j].x + OFF(), slots[j].y], iy); return { ix: s.ix, dy: s.dy, armL: s.wave, armR: IDLE }; };
  const restSt: St = { ix: rx, dy: 0, armL: IDLE, armR: IDLE };
  let st: St = restSt, mood: string | undefined, headTilt = 0, hold: { x: number; y: number; rot: number; c: string; i: number } | null = null;
  const hands: Pt[] = [];
  let placed = 0, inHeap = [true, true, true, true, true];
  P.ph = ph.name;

  if (ph.name === 'unstack') {
    // «волшебный» хлопок → кубики прыгают в кучку, верхний первым
    st = { ...restSt, armL: ph.p < 0.4 ? clapWave(ph.p / 0.4 * 1.0 + 0.5) : IDLE, armR: ph.p < 0.4 ? clapWave(ph.p / 0.4 * 1.0 + 0.5) : IDLE };
    if (P.clapN < 1 && ph.p > 0.2) { P.clapN = 1; if (vis) clapSfx(); }
    headTilt = 0.1 * Math.sin(ph.p * Math.PI);
    inHeap = [false, false, false, false, false];
  } else if (ph.name[0] === 'b') {
    const j = ph.i - 1, u = ph.p;
    placed = j;
    for (let i = 0; i <= j; i++) inHeap[i] = false; inHeap[j] = u < U_GRAB;
    const prev = j === 0 ? restSt : placeSt(j - 1), pk = pickSt(j), pl = placeSt(j);
    const chest: St = { ix: (pk.ix + pl.ix) / 2, dy: 0, armL: CHEST(), armR: CHEST() };
    if (u < U_REACH) { st = mix(prev, pk, ease.inOut(u / U_REACH)); headTilt = -0.1 * ease.inOut(u / U_REACH); }
    else if (u < U_LIFT) { st = { ...pk, dy: pk.dy + ease.hump((u - U_REACH) / (U_LIFT - U_REACH)) * 3 * k }; headTilt = -0.1; }
    else if (u < U_CHEST) { const e = ease.inOut((u - U_LIFT) / (U_CHEST - U_LIFT)); st = mix(pk, chest, e); headTilt = lerp(-0.1, 0, e); }
    else if (u < U_PASS) { st = { ...chest, dy: Math.sin((u - U_CHEST) / (U_PASS - U_CHEST) * Math.PI) * 3 * k }; }
    else if (u < U_LAND) { const e = ease.inOut((u - U_PASS) / (U_LAND - U_PASS)); st = mix(chest, pl, e); headTilt = 0.12 * e; }
    else { st = pl; headTilt = 0.12; mood = 'laugh'; }
    if (j >= 2 && u > U_PASS) { st.armR = lerp(st.armR, 1.2, ease.hump((u - U_PASS) / (1 - U_PASS))); } // в прыжке свободная ручка для равновесия
    if (u >= U_GRAB && u < U_LAND) hold = { x: 0, y: 0, rot: 0, c: BLOCK_COLORS[j], i: j };
    else if (u >= U_LAND) placed = j + 1;
    // звуки: взял — «тык», в прыжок — «вжух», поставил — «ток»
    if (P.grabN <= j && u >= U_GRAB) { P.grabN = j + 1; if (vis) tone(620 + j * 40, 0.06, { type: 'triangle', vol: 0.08 }); }
    if (P.hopN <= j && u >= U_PASS && j >= 2) { P.hopN = j + 1; if (vis) tone(300 + j * 60, 0.3, { type: 'triangle', slide: 700 + j * 80, vol: 0.07 }); }
  } else if (ph.name === 'cheer') {
    placed = 5; inHeap = [false, false, false, false, false];
    const e = ph.p, pl = placeSt(4), ws: St = { ix: L.tower.x + 46 * k, dy: 0, armL: IDLE, armR: IDLE };
    if (e < 0.35) { const q = e / 0.35; st = { ...mix(pl, ws, ease.inOut(q)), dy: lerp(pl.dy, 0, ease.outBounce(q)) }; }
    else { const c = clapWave((e - 0.35) / 0.65 * 2.6 + 0.5); st = { ...ws, armL: c, armR: c, dy: -Math.abs(Math.sin((e - 0.35) / 0.65 * Math.PI * 2.6)) * 5 * k }; mood = 'laugh'; }
    if (!P.cheered && e > 0.3) { P.cheered = true; if (vis) { sfx.yay(); burst(slots[4].x, slots[4].y - 30 * k, 'spark', 14, { size: 8, speed: 150, color: '#ffe27a' }); } }
    const cn = Math.floor((e - 0.35) / 0.65 * 2.6 + 0.5);
    if (e > 0.35 && P.clapN < 1 + cn && cn <= 3) { P.clapN = 1 + cn; if (vis) clapSfx(1.1); }
  } else if (ph.name === 'whack') {
    placed = P.whacked ? 0 : 5; inHeap = [false, false, false, false, false];
    const e = ph.p, ws: St = { ix: L.tower.x + 46 * k, dy: 0, armL: IDLE, armR: IDLE };
    if (e < 0.45) { const q = ease.inOut(e / 0.45); st = { ...ws, armL: lerp(IDLE, 2.7, q), lean: 0.12 * q, dy: -4 * k * q }; headTilt = 0.1 * q; }
    else if (e < 0.6) { const q = ease.in((e - 0.45) / 0.15); st = { ...ws, armL: lerp(2.7, 1.0, q), lean: lerp(0.12, -0.12, q), ix: ws.ix - 6 * k * q }; }
    else { const q = (e - 0.6) / 0.4; st = { ...ws, armL: lerp(1.0, IDLE, ease.inOut(q)), lean: lerp(-0.12, 0, q), ix: ws.ix - 6 * k * (1 - q) }; mood = 'laugh'; }
    if (!P.whacked && e >= 0.58) {
      P.whacked = true; R.tb = null; knockTower(R, L, vis); b.laugh = 1.6;
      if (vis) { sfx.giggle(); burst(L.tower.x + 10 * k, L.tower.y - 60 * k, 'spark', 12, { size: 8, speed: 200, color: '#fff7c2' }); }
    }
  } else { // laugh
    const e = ph.p, c = clapWave(e * 3.2 + 0.5);
    st = { ix: L.tower.x + 46 * k, dy: -Math.abs(Math.sin(e * Math.PI * 3)) * 10 * k, armL: c, armR: c }; mood = 'laugh';
    const cn = Math.floor(e * 3.2 + 0.5);
    if (P.clapN < 10 + cn && cn <= 3) { P.clapN = 10 + cn; if (vis && cn > 0) clapSfx(1.15); }
  }

  setPose(b, { armL: st.armL, armR: st.armR, dx: st.ix - b.ix, dy: st.dy, lean: st.lean || 0, headTilt, mood,
    legL: st.dy < -15 * k ? 0.35 : 0.15, legR: st.dy < -15 * k ? 0.35 : 0.15 });

  // кубик в руке: у правой ладошки → между ладошками → у левой
  if (hold && R.tb) {
    const j = hold.i, u = ph.p, r = RB();
    const hr = rigWorld(b, ...armHand(r, 1, st.armR)), hl = rigWorld(b, ...armHand(r, -1, st.armL));
    // правая ладошка слева от кубика → кубик между ладошками → левая ладошка справа от кубика
    const half = Math.abs(armHand(r, 1, CHEST())[0]) * rigScale(b), mid: Pt = [(hr[0] + hl[0]) / 2, (hr[1] + hl[1]) / 2];
    if (u < U_LIFT) { hold.x = hr[0] + OFF(); hold.y = hr[1]; }
    else if (u < U_CHEST) { const e = ease.inOut((u - U_LIFT) / (U_CHEST - U_LIFT)); hold.x = lerp(hr[0] + OFF(), mid[0], e); hold.y = lerp(hr[1], mid[1], e); }
    else if (u < U_PASS) { [hold.x, hold.y] = mid; }
    else { const e = ease.inOut((u - U_PASS) / (U_LAND - U_PASS)); hold.x = hl[0] + lerp(half, -OFF(), e); hold.y = hl[1]; }
    hold.rot = u < U_CHEST ? lerp(H[j].rot, 0, ease.inOut((u - U_GRAB) / (U_CHEST - U_GRAB))) : lerp(0, slots[j].rot, ease.inOut((u - U_PASS) / (U_LAND - U_PASS)));
    if (u < U_PASS) hands.push(hr); if (u >= U_CHEST) hands.push(hl);
  }

  // приземления: «ток» + искорки
  if (R.tb) {
    for (let j = 0; j < 5; j++) {
      const land = T0 + j * BD + U_LAND * BD;
      if (P.landN <= j && at >= land) { P.landN = j + 1; if (vis) { tone(330 + j * 70, 0.09, { type: 'triangle', vol: 0.16 }); tone(165, 0.06, { type: 'square', vol: 0.04 }); burst(slots[j].x, slots[j].y + 16 * k, 'spark', 4, { size: 5, speed: 70, color: '#fff7c2' }); } }
    }
    // что рисовать
    const blocks: any[] = [];
    for (let j = 0; j < placed; j++) {
      const age = at - (T0 + j * BD + U_LAND * BD), sq = age >= 0 && age < 0.6 ? Math.sin(age * 22) * Math.exp(-age * 7) : 0;
      blocks.push({ ...slots[j], sq });
    }
    if (ph.name === 'unstack') {
      for (let j = 4; j >= 0; j--) {
        const dl = (4 - j) * 0.11, /* кубики перелетают над головой малыша */ q = Math.max(0, Math.min(1, (at - dl) / 0.42)), f = TB.from[j], hp = H[j], e = ease.inOut(q);
        blocks.push({ x: lerp(f.x, hp.x, e), y: lerp(f.y, hp.y, e) - ease.hump(q) * 120 * k, rot: lerp(f.rot, hp.rot, e) + ease.hump(q) * 1.2, c: BLOCK_COLORS[j], i: j, sq: 0, heap: q >= 1 });
        if (q >= 1 && !(P.tik & (1 << j))) { P.tik |= 1 << j; if (vis) tone(700 + j * 50, 0.05, { type: 'triangle', vol: 0.07 }); }
      }
      blocks.sort((a, c) => c.y - a.y);
    } else {
      const hp = H.map((p, j) => ({ ...p, c: BLOCK_COLORS[j], i: j, sq: 0 })).filter((_, j) => inHeap[j]);
      blocks.push(...hp.sort((a, c) => c.y - a.y)); // нижний ряд кучки, потом верхний
    }
    if (hold) blocks.push({ ...hold, sq: 0 });
    TB.blocks = blocks; TB.hands = hands; TB.skin = b.skin; TB.k = rigScale(b); TB.placed = placed;
  }
}

/** кадр комнаты: тап по строящейся башне качает её; если строителя унесли — башня собирается сама */
export function towerTick(dt, h, L) {
  const R = h.room; if (!R.tb) return;
  R.tb.wob = Math.max(0, R.tb.wob - dt * 1.5);
  const builder = h.occupants().some(b => b.play && b.play.k === 'tower' && b.play.phase === 'do' && !b.dragged);
  if (!builder) {
    R.tb = null;
    [523, 659, 784].forEach((f, i) => tone(f, 0.2, { type: 'triangle', vol: 0.1, delay: i * 0.07 }));
    burst(L.tower.x, L.tower.y - 90 * S, 'spark', 12, { size: 7, speed: 120, color: '#fff7c2' });
  }
}

/** тап по башне, пока её строят: она качается, но не падает */
export function towerWobble(R, vis) {
  if (!R.tb) return false;
  R.tb.wob = 1; if (vis) { tone(420, 0.08, { type: 'triangle', vol: 0.12 }); tone(520, 0.08, { type: 'triangle', vol: 0.1, delay: 0.09 }); }
  return true;
}

/** нарисовать стройку (вызывается из drawTower, когда идёт игра) */
export function drawTowerBuild(L, R) {
  const TB = R.tb, k = S, bs = 36 * k;
  for (const p of TB.blocks) {
    const wob = p.i < TB.placed && !p.heap && TB.wob > 0 ? Math.sin(t * 22) * 0.06 * TB.wob * (p.i + 1) / 3 : 0;
    ctx.save();
    if (p.sq) { const by = p.y + bs / 2; ctx.translate(p.x, by); ctx.scale(1 + p.sq * 0.22, 1 - p.sq * 0.22); ctx.translate(-p.x, -by); }
    if (wob) { const base = L.tower.y; ctx.translate(L.tower.x, base); ctx.rotate(wob); ctx.translate(-L.tower.x, -base); }
    drawBlock(p);
    ctx.restore();
  }
  // ладошки поверх кубика в руке
  ctx.fillStyle = TB.skin || '#ffdcbf';
  for (const [x, y] of TB.hands) circle(x, y, RB() * 0.17 * (TB.k || 1));
}
