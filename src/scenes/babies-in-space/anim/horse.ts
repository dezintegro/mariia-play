// «Спектакль» с лошадкой-качалкой: малыш подползает, забирается в седло,
// качается, держась за шею, потом съезжает на пол, плюхается на попу и уползает.
//
// Фазы (b.play.phase === 'do', время = P.d − P.t):
//   climb  — тянется ручками к шее лошадки, подтягивается, перекидывает ножку, садится;
//   ride   — качается вместе с лошадкой, ручки на гриве, ножки болтаются в такт, смеётся, «цок-цок»;
//   slide  — отпускает гриву, ручки вверх, «уиии» — съезжает вперёд по боку лошадки;
//   land   — плюх на попу с пружинкой, ручки вверх;
//   up     — встаёт на четвереньки (дальше обычное ползание, см. horseEnd).
// Всё рисуется в системе координат лошадки (начало — точка качания на полу, см. drawHorseRider).
import { S, clamp, ctx, rand, t } from '../../../core/canvas';
import { burst } from '../../../core/particles';
import { ease, lerp, phaseAt, phasesDur, type Phase, clamp01 } from '../../../core/tween';
import { drawRoomBabyAt } from '../characters';
import { RL, horseAng } from '../nursery';
import { sfx } from '../sounds';
import { RB } from '../state';
import { ARMS_HIDDEN, SIT_DY, drawArm, fromPose, pivot, restHand, toPose } from './kit';
import { tone } from '../../../core/audio';

export const HORSE_PHASES: Phase[] = [['climb', 1.0], ['ride', 4.4], ['slide', 0.8], ['land', 0.9], ['up', 0.35]];

// точки в системе лошадки (в единицах S): седло (ступни сидящего), куда приземляется,
// за что держится: когда забирается — за седло, когда катается — за гриву/шею
const SEAT = () => [-14 * S, -62 * S];
const LAND = () => [84 * S, 12 * S];
const SADDLE_GRIP = () => [[-20 * S, -90 * S], [2 * S, -95 * S]];
const MANE_GRIP = () => [[12 * S, -92 * S], [28 * S, -106 * S]];
const ARMS_UP = 1.75; // ручки вверх «ура» (выше — спрячутся за головой)

export function horseBegin(b, L) {
  const P = b.play;
  P.d = P.t = phasesDur(HORSE_PHASES);
  // откуда начинаем забираться: где малыш сейчас (подполз или его положили сверху)
  P.f0 = [clamp(b.ix - L.horse.x, -100 * S, 110 * S), clamp(b.iy - L.horse.y, -140 * S, 12 * S)];
  P.last = ''; P.gig = 0; P.clopT = 0.3;
  horsePose(b, 0);
}

/** кадр логики: фаза, поза, звуки, качание лошадки */
export function horseUpdate(b, dt, L) {
  const P = b.play, R = b.home.room, vis = b.visible(), el = P.d - P.t, ph = phaseAt(el, HORSE_PHASES);
  if (ph.name !== P.last) { P.last = ph.name; enter(b, ph.name, L, vis); }
  if (ph.name === 'climb') R.horse = Math.max(0, R.horse - dt * 3);
  else if (ph.name === 'ride') {
    R.horse = Math.min(1, ph.p * 4.4 / 0.5);
    P.clopT -= dt; if (P.clopT <= 0) { P.clopT = 0.9; if (vis) sfx.clop(); }
    // пару раз за поездку — смешок и сердечки
    if (P.gig < 2 && ph.p * 4.4 > 1.4 + P.gig * 1.6) {
      P.gig++; b.laugh = 1;
      if (vis) { sfx.giggle(1.1); const [hx, hy] = riderHead(b); burst(hx, hy - RB() * 0.5, 'heart', 4, { size: 8, speed: 90, up: -70, color: '#ff7aa8' }); }
    }
  } else if (ph.name === 'slide') R.horse = Math.min(R.horse, 1 - ease.inOut(ph.p));
  horsePose(b, el);
}

function enter(b, name, L, vis) {
  if (!vis) return;
  const [hx, hy] = riderHead(b);
  if (name === 'climb') tone(330, 0.22, { type: 'triangle', slide: 470, vol: 0.1 });
  else if (name === 'ride') { sfx.pick(); sfx.giggle(); burst(hx, hy, 'spark', 8, { size: 7, speed: 120, color: '#fff7c2' }); }
  else if (name === 'slide') sfx.wheee();
  else if (name === 'land') {
    b.bounce = 1; sfx.boing(); sfx.giggle(1.05);
    const [lx, ly] = LAND(); burst(L.horse.x + lx, L.horse.y + ly, 'spark', 10, { size: 7, speed: 150, color: '#fff7c2' });
  }
}

/** поза и место малыша (в системе лошадки) в момент el от начала спектакля */
function horsePose(b, el) {
  const P = b.play, r = RB(), ph = phaseAt(el, HORSE_PHASES), p = ph.p;
  const [sx, sy] = SEAT(), [lx, ly] = LAND(), [f0x, f0y] = P.f0;
  let fx = sx, fy = sy, att = 1, shadow = false;
  // ладошки: grip 0..1 — от «свободного» положения (подъём wave) к точкам на лошадке (смесь седло→грива по mane)
  let grip = 0, mane = 1, wave = 0.3;
  const pose: any = { armL: ARMS_HIDDEN, armR: ARMS_HIDDEN, mood: 'laugh' };
  let lean = 0, piv: [number, number] = [0, r * 2.4], sit = 0;
  if (ph.name === 'climb') {
    // 0..0.35 — тянется ручками к седлу; дальше подтягивается и перекидывает ножку
    const a = ease.inOut(clamp01(p / 0.35)), q = ease.inOut(clamp01((p - 0.35) / 0.65));
    fx = lerp(f0x, sx, q); fy = lerp(f0y, sy, q) - ease.hump(q) * 24 * S;
    const dir = Math.sign(sx - f0x) || 1, near = dir > 0 ? 'legR' : 'legL', far = dir > 0 ? 'legL' : 'legR';
    lean = dir * 0.3 * a * (1 - q) + dir * 0.1 * q;
    grip = a; mane = 0;
    pose[near] = 0.5 * q + ease.hump(q) * 1.2; pose[far] = 0.5 * q + ease.hump(q) * 0.2;
    pose.mood = 'open'; pose.face = { cheeks: ease.hump(q) * 0.8 };
    shadow = q < 0.25;
  } else if (ph.name === 'ride') {
    const s = Math.sin(t * 7 + 0.8), sec = p * 4.4;
    grip = 1; mane = ease.inOut(clamp01(sec / 0.4)); // перехватывается с седла на гриву
    lean = 0.1 - horseAng(b.home) * 0.35; piv = [0, r * 2.1];
    pose.legL = 0.5 + s * 0.3; pose.legR = 0.5 - s * 0.3;
    pose.headTilt = Math.sin(t * 7) * 0.1;
  } else if (ph.name === 'slide') {
    // первые 30% — отпускает гриву и поднимает ручки, потом едет вниз
    const a = ease.inOut(clamp01(p / 0.3)), q = ease.in(clamp01((p - 0.15) / 0.85));
    fx = lerp(sx, lx, q); fy = lerp(sy, ly, q);
    grip = 1 - a; wave = ARMS_UP;
    lean = lerp(0.1, -0.3 * ease.hump(q), a); piv = [0, r * 2.1];
    pose.legL = pose.legR = 0.5 + 0.5 * ease.out(a);
    if (a >= 1) { grip = -1; pose.armL = pose.armR = ARMS_UP + Math.sin(t * 12) * 0.2; }
    shadow = q > 0.6;
  } else if (ph.name === 'land') {
    fx = lx; fy = ly; att = 0; shadow = true; grip = -1;
    sit = SIT_DY * r * ease.spring(p);
    pose.legL = pose.legR = lerp(1.0, 1.25, ease.out(p));
    pose.armL = pose.armR = ARMS_UP + Math.sin(t * 12) * 0.2;
  } else {
    fx = lx; fy = ly; att = 0; shadow = true; grip = -1;
    const q = ease.inOut(p);
    sit = SIT_DY * r * (1 - q);
    pose.legL = pose.legR = lerp(1.25, 0.15, q);
    pose.armL = pose.armR = lerp(ARMS_UP, 0.4, q);
    pose.mood = q > 0.5 ? 'open' : 'laugh';
  }
  Object.assign(pose, { lean }, pivot(lean, piv[0], piv[1]));
  pose.dy += sit;
  if (grip >= 0) {
    const S0 = SADDLE_GRIP(), M = MANE_GRIP(), g = [0, 1].map(i => [lerp(S0[i][0], M[i][0], mane), lerp(S0[i][1], M[i][1], mane)]);
    pose.front = (rr: number) => hands(rr, b, pose, fx, fy, g, grip, wave);
  }
  P.fx = fx; P.fy = fy; P.att = att; P.shadow = shadow;
  b.pose = pose;
}

/** ладошки на лошадке (точки g в её системе) при grip = 1 или в «свободном» положении при grip = 0 */
function hands(r, b, pose, fx, fy, g, grip, wave) {
  for (const side of [-1, 1] as const) {
    const [gx, gy] = g[side < 0 ? 0 : 1], [tx, ty] = toPose(r, pose, fx, fy, gx, gy), [rx, ry] = restHand(r, side, wave);
    drawArm(r, b, side, lerp(rx, tx, grip), lerp(ry, ty, grip));
  }
}

/** нарисовать наездника (вызывается из drawHorse, после самой лошадки) */
export function drawHorseRider(b, L, h) {
  const P = b.play, p = L.horse;
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(horseAng(h) * (P.att ?? 1));
  drawRoomBabyAt(b, P.fx ?? 0, P.fy ?? 0, !!P.shadow);
  ctx.restore();
}

/** центр головы наездника в мире (для попадания пальцем и пузыря желания) */
export function riderHead(b): [number, number] {
  const P = b.play, p = RL().horse, r = RB();
  const [x, y] = fromPose(r, b.pose || {}, P.fx ?? 0, P.fy ?? 0, 0, 0), a = horseAng(b.home) * (P.att ?? 1);
  return [p.x + x * Math.cos(a) - y * Math.sin(a), p.y + x * Math.sin(a) + y * Math.cos(a)];
}

/** конец: малыш на полу рядом с лошадкой, уползает по своим делам */
export function horseEnd(b, L, P) {
  const [lx, ly] = LAND();
  b.ix = L.horse.x + lx; b.iy = L.horse.y + ly;
  b.iwx = clamp(b.ix + rand(70, 150) * S, L.bx0, L.bx1); b.iwy = clamp(b.iy + rand(-10, 50) * S, L.by0, L.by1); b.iwT = rand(2.5, 4);
}
