// «Спектакль» с мячом: малыш подползает, толкает мяч ладошками или пинает ножкой,
// мяч катится и крутится, малыш ползёт следом; в последний раз — обнимает мяч,
// кувыркается вместе с ним, отпускает и хохочет, сидя на попе.
//
// Состояния b.play.st (P.s — сколько секунд в текущем):
//   crawl  — ползёт к мячу (с той стороны, откуда удобно толкать);
//   wind   — замах: ручки к груди / ножка назад, корпус назад;
//   hit    — толчок ладошками (руки вперёд, корпус вперёд) или пинок (нога в сторону мяча) → мяч катится;
//   watch  — смотрит, как катится, смеётся, машет ручками;
//   reach  — (объятие) раскрывает ручки;
//   grab   — подвигается и прижимает мяч к груди, ручки обхватывают;
//   roll   — кувырок с мячом в обнимку;
//   let    — отпускает мяч (тот отскакивает), плюх на попу;
//   laugh  — сидит и хохочет, покачиваясь;
//   up     — встаёт на четвереньки → конец.
import { S, TAU, W, ctx, rand, t } from '../../../core/canvas';
import { burst } from '../../../core/particles';
import { clamp01, ease, lerp } from '../../../core/tween';
import { RL } from '../nursery';
import { drawToy } from '../toys';
import { sfx } from '../sounds';
import { RB } from '../state';
import { ARMS_HIDDEN, SIT_DY, crawlPose, drawArm, fromPose, pivot, restHand, toPose } from './kit';

const DUR: Record<string, number> = { wind: 0.4, hit: 0.4, watch: 0.55, reach: 0.45, grab: 0.5, roll: 1.3, let: 0.5, laugh: 0.9, up: 0.35 };
const BALL_R = () => 26 * S;          // радиус мяча (drawToy('ball', 37S) → 0.7·37)
const ballCY = B => B.y - BALL_R() - B.z; // центр мяча по вертикали
const CHEST = (r: number): [number, number] => [0, r * 1.45]; // где мяч в обнимку (координаты позы)

export function ballBegin(b, L, h) {
  const P = b.play;
  P.t = P.d = 18; // запас; сценарий сам закончится раньше
  P.plan = Math.random() < 0.5 ? ['push', 'kick', 'hug'] : ['kick', 'push', 'hug'];
  P.n = 0; P.ph = 0; P.dir = 1;
  go(b, 'crawl');
  ballPose(b, 0);
}

function go(b, st) {
  const P = b.play, B = b.home.room.ball, L = bounds();
  P.st = st; P.s = 0; P.fired = false;
  if (st === 'crawl') {
    // толкаем от себя, но если впереди стена — переползаем на другую сторону
    let dir = Math.sign(B.x - b.ix) || 1;
    const ahead = dir > 0 ? L.br - B.x : B.x - L.bl;
    if (ahead < 110 * S) dir = -dir;
    P.dir = dir;
  }
  if (st === 'hit') P.contact = [B.x - P.dir * BALL_R() * 0.85, ballCY(B)];
  if (st === 'grab') { P.x0 = b.ix; P.b0 = [B.x, ballCY(B)]; B.hold = b; B.vx = 0; B.vz = 0; }
  if (st === 'roll') { P.x0 = b.ix; const room = P.dir > 0 ? L.br - b.ix : b.ix - L.bl; P.rd = Math.max(20 * S, Math.min(150 * S, room - 40 * S)); }
}

/** границы, по которым катается мяч (как в updateNursery) */
function bounds() { const d = RL().door; return { bl: d.x + d.w + 20 * S, br: W - 40 * S }; }

export function ballUpdate(b, dt, L) {
  const P = b.play, h = b.home, B = h.room.ball, vis = b.visible(), r = RB();
  P.s += dt; P.ph += dt * 9;
  const st = P.st, kind = P.plan[P.n], p = DUR[st] ? clamp01(P.s / DUR[st]) : 0;
  if (st === 'crawl') {
    const hug = kind === 'hug', tx = B.x - P.dir * (hug ? 52 : kind === 'push' ? 66 : 50) * S, ty = B.y + 6 * S;
    const dx = tx - b.ix, dy = ty - b.iy, d = Math.hypot(dx, dy);
    if (d > 3 * S) { const sp = Math.min(130 * S * dt, d); b.ix += dx / d * sp; b.iy += dy / d * sp; }
    if (Math.abs(dx) > 2) b.face = Math.sign(dx);
    if ((d < 6 * S && Math.abs(B.vx) < 70 * S && B.z < 6 * S) || P.s > 4) go(b, hug ? 'reach' : 'wind');
  } else if (st === 'hit') {
    if (!P.fired && p >= (kind === 'kick' ? 0.3 : 0.4)) {
      P.fired = true; B.vx = P.dir * rand(150, 175) * S; B.vz = (kind === 'kick' ? 300 : 140) * S; b.laugh = 1;
      if (vis) { sfx.boing(); burst(P.contact[0], P.contact[1], 'spark', 8, { size: 7, speed: 140, color: '#fff7c2' }); }
    }
    if (p >= 1) go(b, 'watch');
  } else if (st === 'wind') { if (p >= 1) go(b, 'hit'); }
  else if (st === 'watch') {
    if (P.s < dt * 1.5 && vis) sfx.giggle(1.05);
    if (p >= 1) { P.n++; go(b, 'crawl'); }
  } else if (st === 'reach') { if (p >= 1) go(b, 'grab'); }
  else if (st === 'grab') {
    b.ix = lerp(P.x0, P.b0[0], ease.inOut(p));
    if (p >= 1) {
      if (vis) { sfx.squeak(); burst(b.ix, b.iy - r * 2.7, 'heart', 6, { size: 9, speed: 110, up: -70, color: '#ff7aa8' }); }
      go(b, 'roll'); if (vis) sfx.wheee();
    }
  } else if (st === 'roll') {
    b.ix = P.x0 + P.dir * P.rd * ease.inOut(p);
    if (p >= 1) {
      // отпускаем: мяч отскакивает вперёд
      B.hold = null; const [cx] = fromPose(r, b.pose, b.ix, b.iy, ...CHEST(r));
      B.x = cx + P.dir * 10 * S; B.z = 0; B.vx = P.dir * 170 * S; B.vz = 380 * S;
      b.bounce = 1; b.laugh = 2;
      if (vis) { sfx.boing(); sfx.giggle(1.1); burst(b.ix, b.iy - r * 3.6, 'heart', 7, { size: 9, speed: 130, up: -80, color: '#ff7aa8' }); }
      go(b, 'let');
    }
  } else if (st === 'let') { if (p >= 1) { go(b, 'laugh'); if (vis) sfx.giggle(0.95); } }
  else if (st === 'laugh') { if (p >= 1) go(b, 'up'); }
  else if (st === 'up') { if (p >= 1) { P.t = 0; } }
  ballPose(b, dt);
  // пока мяч в руках — он там, где грудь малыша (для попадания пальцем и подсветки)
  if (B.hold === b) { const [cx, cy] = fromPose(r, b.pose, b.ix, b.iy, ...CHEST(r)); B.x = cx; B.z = Math.max(0, B.y - BALL_R() - cy); }
}

function ballPose(b, dt) {
  const P = b.play, B = b.home.room.ball, r = RB(), st = P.st, kind = P.plan[P.n], dir = P.dir;
  const p = DUR[st] ? clamp01(P.s / DUR[st]) : 0;
  const pose: any = { armL: ARMS_HIDDEN, armR: ARMS_HIDDEN, mood: 'open' };
  let lean = 0, piv: [number, number] = [0, r * 2.4], sit = 0, lift = 0;
  let handsAt: ((pose) => [[number, number], [number, number]]) | null = null, holdBall = false, squish = 0;
  const rest = (w: number): [[number, number], [number, number]] => [restHand(r, -1, w), restHand(r, 1, w)];
  const mix = (a, c, q): [[number, number], [number, number]] => [[lerp(a[0][0], c[0][0], q), lerp(a[0][1], c[0][1], q)], [lerp(a[1][0], c[1][0], q), lerp(a[1][1], c[1][1], q)]];
  // ладошки у груди (замах перед толчком)
  const chestHands = (): [[number, number], [number, number]] => [[dir * r * 0.05 - r * 0.25, r * 1.3], [dir * r * 0.05 + r * 0.25, r * 1.3]];
  if (st === 'crawl') {
    Object.assign(pose, crawlPose(r, Math.sign(B.x - b.ix) || dir, P.ph));
    pose.mood = 'open';
  } else if (st === 'wind' || st === 'hit' || st === 'watch') {
    if (kind === 'push') {
      if (st === 'wind') {
        const q = ease.inOut(p); lean = -dir * 0.12 * q;
        handsAt = () => mix(rest(0.3), chestHands(), q);
        pose.face = { cheeks: q * 0.6 };
      } else if (st === 'hit') {
        const e = ease.outBack(clamp01(p / 0.45)); lean = dir * lerp(-0.12, 0.28, clamp01(e));
        handsAt = (ps) => {
          const [cx, cy] = P.contact, a = toPose(r, ps, b.ix, b.iy, cx, cy - r * 0.25), c = toPose(r, ps, b.ix, b.iy, cx, cy + r * 0.25);
          return mix(chestHands(), [a, c] as any, clamp01(e));
        };
        pose.mood = p > 0.4 ? 'laugh' : 'open';
      } else {
        const q = ease.inOut(p); lean = dir * 0.28 * (1 - q);
        pose.armL = pose.armR = 1.7 + Math.sin(t * 14) * 0.25; pose.mood = 'laugh';
        handsAt = null;
      }
    } else { // пинок ножкой (той, что ближе к мячу)
      const kickL = dir < 0, key = kickL ? 'legL' : 'legR', other = kickL ? 'legR' : 'legL';
      pose.armL = pose.armR = 0.9;
      if (st === 'wind') { const q = ease.inOut(p); lean = -dir * 0.15 * q; pose[key] = -0.35 * q; pose[other] = 0.1; pose.armL = pose.armR = 0.3 + 0.9 * q; pose.face = { cheeks: q * 0.5 }; }
      else if (st === 'hit') { const e = ease.outBack(clamp01(p / 0.4)); lean = -dir * 0.22; pose[key] = lerp(-0.35, 1.3, e); pose[other] = 0.1; pose.armL = pose.armR = 1.3; pose.mood = p > 0.3 ? 'laugh' : 'open'; }
      else { const q = ease.inOut(p); lean = -dir * 0.22 * (1 - q); pose[key] = 1.3 * (1 - q); pose.armL = pose.armR = 1.7 + Math.sin(t * 14) * 0.25; pose.mood = 'laugh'; }
    }
  } else if (st === 'reach') {
    const q = ease.inOut(p); lean = dir * 0.15 * q;
    handsAt = () => mix(rest(0.3), [[-r * 1.3, r * 0.85], [r * 1.3, r * 0.85]], q);
    pose.face = { cheeks: q * 0.3 };
  } else if (st === 'grab') {
    const q = ease.inOut(p); lean = dir * 0.15 * (1 - q);
    holdBall = true; squish = ease.hump(q) * 0.1;
    handsAt = () => mix([[-r * 1.3, r * 0.85], [r * 1.3, r * 0.85]], [[-r * 0.32, r * 1.62], [r * 0.32, r * 1.56]], q);
    pose.mood = q > 0.5 ? 'love' : 'open';
  } else if (st === 'roll') {
    const e = ease.inOut(p); lean = dir * TAU * e; piv = CHEST(r); lift = ease.hump(p) * r * 1.55;
    holdBall = true; squish = 0.06;
    handsAt = () => [[-r * 0.32, r * 1.62], [r * 0.32, r * 1.56]];
    pose.legL = pose.legR = 0.9 * ease.hump(clamp01(p * 1.3)); pose.mood = 'laugh';
  } else if (st === 'let' || st === 'laugh') {
    const q = st === 'let' ? p : 1;
    sit = SIT_DY * r * (st === 'let' ? ease.spring(q) : 1);
    pose.legL = pose.legR = 1.2; pose.armL = pose.armR = 1.75 + Math.sin(t * 13) * 0.2; pose.mood = 'laugh';
    if (st === 'laugh') { lean = Math.sin(p * Math.PI * 3) * 0.14; piv = [0, r * 2.3]; }
  } else if (st === 'up') {
    const q = ease.inOut(p); sit = SIT_DY * r * (1 - q);
    pose.legL = pose.legR = lerp(1.2, 0.15, q); pose.armL = pose.armR = lerp(1.75, 0.4, q); pose.mood = q > 0.5 ? 'open' : 'laugh';
  }
  if (st !== 'crawl') { Object.assign(pose, { lean }, pivot(lean, piv[0], piv[1])); pose.dy += sit - lift; }
  if (handsAt || holdBall) {
    pose.front = (rr: number) => {
      if (holdBall) {
        let [bx, by] = CHEST(rr);
        if (st === 'grab') { const [sx, sy] = toPose(rr, pose, b.ix, b.iy, P.b0[0], P.b0[1]); const q = ease.inOut(clamp01(P.s / DUR.grab)); bx = lerp(sx, bx, q); by = lerp(sy, by, q); }
        ctx.save(); ctx.translate(bx, by); ctx.scale(1 + squish, 1 - squish); ctx.rotate(B.rot); drawToy('ball', 37 * S); ctx.restore();
      }
      if (handsAt) { const [hl, hr] = handsAt(pose); drawArm(rr, b, -1, hl[0], hl[1]); drawArm(rr, b, 1, hr[0], hr[1]); }
    };
  }
  b.pose = pose;
}

/** мяч сейчас в руках у малыша этого домика? (заодно чинит «забытый» захват) */
export function ballHeld(h) {
  const B = h.room.ball;
  if (B.hold && !(B.hold.play && B.hold.play.k === 'ball' && B.hold.home === h && !B.hold.dragged)) B.hold = null;
  return !!B.hold;
}

/** конец игры с мячом (в т.ч. досрочный): отпустить мяч */
export function ballEnd(b) {
  const B = b.home && b.home.room.ball;
  if (B && B.hold === b) { B.hold = null; B.vz = 200 * S; }
}
