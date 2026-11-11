import { tone } from '../../core/audio';
import { H, S, TAU, W, ctx, dist, rand, t } from '../../core/canvas';
import { circle, ell, heartPath, starPath } from '../../core/draw';
import { burst } from '../../core/particles';
import { animXf, babyMood, drawAccessory, drawHead, drawRoomBabyAt, halo } from './characters';
import { roomHead } from './room';
import { sfx } from './sounds';
import { G, RB } from './state';
import { drawToy } from './toys';
import { satisfy } from './wishes';
import { ballBegin, ballEnd, ballHeld, ballUpdate } from './anim/ball';
import { drawHorseRider, horseBegin, horseEnd, horseUpdate } from './anim/horse';

// ---------------- КОМНАТА (ЯСЛИ) ----------------
export function RL() {
  const k = S, fy = H * 0.6;
  const doorW = 125 * k, doorH = 235 * k;
  const door = { x: Math.max(16, W * 0.04), y: fy + 25 * k - doorH, w: doorW, h: doorH };
  const cw = 150 * k;
  const c2 = { x: W - cw / 2 - 24 * k, y: fy + 125 * k }, c1 = { x: c2.x - cw - 28 * k, y: fy + 125 * k };
  const win = { x: W * 0.5, y: H * 0.25, w: 240 * k, h: 175 * k };
  // в альбомной — полка высоко (под ней мобили кроваток), в портретной — под окном
  const shelfY = W > H ? Math.max(H * 0.17, 80 * k) : Math.max(H * 0.3, win.y + win.h / 2 + 70 * k);
  return {
    fy, door, cw, cribs: [c1, c2], win,
    lamp: { x: W * 0.3, y: H * 0.17 },
    shelf: { x: W * 0.8, y: shelfY, w: 220 * k },
    teddy: { x: W * 0.8 - 60 * k, y: shelfY - 30 * k },
    tower: { x: door.x + doorW * 0.6, y: H - 45 * k },
    horse: { x: W * 0.34, y: fy + 105 * k },
    xylo: { x: W * 0.52, y: H - 60 * k, w: 230 * k },
    bx0: door.x + doorW + 40 * k, bx1: Math.max(door.x + doorW + 80 * k, c1.x - cw / 2 - 20 * k), by0: fy + 70 * k, by1: H - 30 * k,
  };
}

export function xyloBars(L) {
  const p = L.xylo, n = 6, bw = p.w / n;
  return Array.from({ length: n }, (_, i) => ({ x: p.x - p.w / 2 + bw * (i + 0.5), y: p.y, w: bw * 0.78, h: (80 - i * 8) * S }));
}

export const BLOCK_COLORS = ['#ff6b6b', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff'];

export function towerRest(L) {
  const bs = 36 * S;
  return BLOCK_COLORS.map((c, i) => ({ x: L.tower.x + (i % 2 ? 4 : -4) * S, y: L.tower.y - bs * (i + 0.5), rot: i % 2 ? 0.05 : -0.04, c, i }));
}

export function cribOf(h, i) { return h.occupants().find(b => b.crib === h.room.cribs[i]); }

export function horseAng(h) { return Math.sin(t * 7) * 0.28 * h.room.horse; }

export const HORSE_SEAT = () => [-8 * S, -64 * S], CHAIR_SEAT = () => 100 * S;

export function isRider(b) { return !!(b.play && b.play.k === 'horse' && b.play.phase === 'do'); }

// ---------- игра малыша с большими игрушками ----------
export const TOYS4 = ['horse', 'xylo', 'ball', 'tower'];

export const XTUNE = [0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 0, 2, 4, 2, 0];

export function toyBusy(h, k, except?) { return h.occupants().some(b => b !== except && b.play && b.play.k === k); }

export function toyApproach(L, k, h) {
  if (k === 'horse') return [L.horse.x - 88 * S, L.horse.y + 8 * S]; // забирается сзади (anim/horse.ts)
  if (k === 'xylo') return [L.xylo.x, L.xylo.y - 24 * S];
  if (k === 'tower') return [L.tower.x + 55 * S, L.tower.y - 2 * S];
  const B = h.room.ball, bx = B.x == null ? W * 0.63 : B.x;
  return [bx + (bx > W * 0.5 ? -45 : 45) * S, H - 109 * S];
}

export function toyCenter(L, k, h) {
  if (k === 'horse') return [L.horse.x, L.horse.y - 80 * S, 95 * S];
  if (k === 'xylo') return [L.xylo.x, L.xylo.y, L.xylo.w * 0.7];
  if (k === 'tower') return [L.tower.x, L.tower.y - 90 * S, 95 * S];
  const B = h.room.ball; return [B.x, B.y - B.z - 26 * S, 60 * S];
}

export function toyAt(x, y, L, h) {
  if (dist(x, y, L.horse.x, L.horse.y - 80 * S) < 85 * S) return 'horse';
  const p = L.xylo; if (Math.abs(x - p.x) < p.w / 2 + 20 * S && Math.abs(y - p.y) < 60 * S) return 'xylo';
  const B = h.room.ball; if (B.x != null && dist(x, y, B.x, B.y - B.z - 26 * S) < 55 * S) return 'ball';
  if (Math.abs(x - L.tower.x) < 45 * S && y > L.tower.y - 200 * S && y < L.tower.y + 15 * S) return 'tower';
  return null;
}

export function knockTower(R, L, vis) {
  R.tower = towerRest(L).map(p => ({ ...p, vx: rand(-220, 220) * S, vy: rand(-380, -120) * S, vr: rand(-7, 7), floor: L.tower.y - 18 * S + rand(-10, 25) * S }));
  R.towerT = 0; if (vis) sfx.crash();
}

export function hitXylo(R, L, i, vis) {
  R.xylo[i] = 1; if (!vis) return;
  const f = [523, 587, 659, 784, 880, 1047][i]; tone(f, 0.9, { type: 'triangle', vol: 0.16 }); tone(f * 2, 0.4, { vol: 0.04 });
  const b = xyloBars(L)[i]; burst(b.x, b.y - b.h / 2, 'spark', 5, { size: 6, speed: 90, color: '#fff7c2' });
}

export function startPlay(b, k) {
  const h = b.home, L = RL(), R = h.room, d = { horse: 6, xylo: 5, ball: 9, tower: 2.6 }[k];
  b.play = { k, phase: 'do', t: d, d, clopT: 0, noteT: 0.25, n: 0, kicks: 0, kickT: 0, done: k === 'tower' && !!R.tower };
  b.ifall = false; b.awake = 3; b.laugh = 0.8;
  if (k === 'horse') horseBegin(b, L);
  else if (k === 'ball') ballBegin(b, L, h);
  else if (k === 'xylo') [b.ix, b.iy] = toyApproach(L, 'xylo', h);
  if (b.visible()) sfx.pick();
  satisfy(b, 'play');
}

export function endPlay(b, L) {
  const P = b.play, k = P.k; b.play = null; b.pose = null;
  b.iwx = b.ix; b.iwy = b.iy; b.iwT = rand(1.5, 3);
  if (k === 'horse') horseEnd(b, L, P); else if (k === 'ball') ballEnd(b);
}

export function updatePlay(b, dt, L) {
  const P = b.play, h = b.home, R = h.room, vis = b.visible();
  P.t -= dt;
  if (P.phase === 'go') {
    if (toyBusy(h, P.k, b) || P.t <= 0) { b.play = null; return; }
    const [tx, ty] = toyApproach(L, P.k, h), dx = tx - b.ix, dy = ty - b.iy, d = Math.hypot(dx, dy);
    if (d < 8 * S) startPlay(b, P.k);
    else { const sp = Math.min(75 * S * dt, d); b.ix += dx / d * sp; b.iy += dy / d * sp; if (Math.abs(dx) > 2) b.face = Math.sign(dx); }
    return;
  }
  if (P.k === 'horse') {
    horseUpdate(b, dt, L);
  } else if (P.k === 'xylo') {
    [b.ix, b.iy] = toyApproach(L, 'xylo', h);
    P.noteT -= dt; if (P.noteT <= 0) { P.noteT = 0.3; hitXylo(R, L, XTUNE[P.n++ % XTUNE.length], vis); }
  } else if (P.k === 'ball') {
    ballUpdate(b, dt, L);
  } else if (P.k === 'tower') {
    const [tx, ty] = toyApproach(L, 'tower', h); b.ix += (tx - b.ix) * Math.min(1, dt * 5); b.iy += (ty - b.iy) * Math.min(1, dt * 5); b.face = -1;
    if (!P.done && P.t < P.d - 0.5) { P.done = true; knockTower(R, L, vis); b.laugh = 1.6; b.bounce = 1; if (vis) sfx.giggle(); }
  }
  if (P.t <= 0) endPlay(b, L);
}

export function updateNursery(dt, h) {
  const R = h.room, L = RL();
  R.horse = Math.max(0, R.horse - dt * 0.5); R.teddy = Math.max(0, R.teddy - dt * 1.2);
  for (let i = 0; i < 6; i++) R.xylo[i] = Math.max(0, R.xylo[i] - dt * 4);
  for (const c of R.cribs) { c.spinV = Math.max(0, c.spinV - dt * 0.4); c.spin += (0.4 + c.spinV * 3) * dt; }
  if (R.tower) {
    R.towerT += dt;
    for (const p of R.tower) {
      if (p.rest) continue;
      p.vy += 1400 * S * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.y >= p.floor) { p.y = p.floor; if (Math.abs(p.vy) > 150 * S) { p.vy *= -0.35; p.vx *= 0.6; p.vr *= 0.5; } else p.rest = true; }
    }
    if (R.towerT > 2.8) { R.tower = null; [523, 659, 784].forEach((f, i) => tone(f, 0.2, { type: 'triangle', vol: 0.1, delay: i * 0.07 })); burst(L.tower.x, L.tower.y - 90 * S, 'spark', 12, { size: 7, speed: 120, color: '#fff7c2' }); }
  }
  const B = R.ball;
  if (B.x === null) { B.x = W * 0.63; }
  B.y = H - 115 * S;
  if (ballHeld(h)) return; // мяч в обнимку у малыша (anim/ball.ts)
  B.vz -= 1600 * S * dt; B.z += B.vz * dt;
  if (B.z < 0) { B.z = 0; if (Math.abs(B.vz) > 140 * S) { B.vz = -B.vz * 0.55; tone(180, 0.08, { vol: 0.08 }); } else B.vz = 0; }
  B.x += B.vx * dt; B.vx *= Math.pow(0.45, dt);
  const bl = L.door.x + L.door.w + 20 * S, br = W - 40 * S;
  if (B.x < bl) { B.x = bl; B.vx = Math.abs(B.vx); } if (B.x > br) { B.x = br; B.vx = -Math.abs(B.vx); }
  B.rot += B.vx * dt / (26 * S);
}

export function drawShelf(L, h) {
  const k = S, s = L.shelf, R = h.room;
  ctx.fillStyle = '#c98b5a'; ctx.fillRect(s.x - s.w / 2, s.y, s.w, 12 * k);
  ctx.fillStyle = '#a66f45'; for (const dx of [-0.35, 0.35]) { ctx.beginPath(); ctx.moveTo(s.x + dx * s.w, s.y + 12 * k); ctx.lineTo(s.x + dx * s.w, s.y + 36 * k); ctx.lineTo(s.x + dx * s.w + (dx < 0 ? 22 : -22) * k, s.y + 12 * k); ctx.fill(); }
  const bc = ['#ff6b6b', '#4cc9f0', '#ffd166'];
  bc.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(s.x + (10 + i * 16) * k, s.y - (44 - i * 4) * k, 13 * k, (44 - i * 4) * k); });
  ctx.fillStyle = '#ff9ec7'; ctx.beginPath(); ctx.roundRect(s.x + 70 * k, s.y - 26 * k, 26 * k, 26 * k, 5 * k); ctx.fill();
  ctx.strokeStyle = '#3aa66b'; ctx.lineWidth = 4 * k; ctx.lineCap = 'round';
  for (const a of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.moveTo(s.x + 83 * k, s.y - 26 * k); ctx.lineTo(s.x + 83 * k + Math.sin(a + Math.sin(t) * 0.1) * 20 * k, s.y - 50 * k); ctx.stroke(); }
  const tp = L.teddy, jump = R.teddy > 0 ? Math.abs(Math.sin(R.teddy * Math.PI * 2)) * 16 * k : 0;
  ctx.save(); ctx.translate(tp.x, tp.y - jump); ctx.rotate(R.teddy > 0 ? Math.sin(t * 16) * 0.15 : 0); drawToy('teddy', 40 * k); ctx.restore();
}

export function drawCrib(L, i, h, hover) {
  const k = S, c = L.cribs[i], st = h.room.cribs[i], cw = L.cw, x0 = c.x - cw / 2, top = c.y - 125 * k, mat = c.y - 50 * k;
  const my = top - 85 * k, px = x0 + cw - 6 * k;
  // дуга-держатель мобиля от столбика кроватки
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 6 * k; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(px, top - 14 * k); ctx.lineTo(px, my + 20 * k); ctx.quadraticCurveTo(px, my, px - 20 * k, my); ctx.lineTo(c.x, my); ctx.stroke();
  ctx.fillStyle = '#fff'; ell(c.x, my, 46 * k, 5 * k);
  const items = [];
  for (let j = 0; j < 4; j++) { const a = st.spin + j * TAU / 4; items.push({ j, x: c.x + Math.cos(a) * 42 * k, z: Math.sin(a) }); }
  items.sort((a, b) => a.z - b.z);
  for (const it of items) {
    const iy = my + 32 * k + it.z * 5 * k, s = 1 + it.z * 0.12;
    ctx.strokeStyle = 'rgba(90,60,40,0.4)'; ctx.lineWidth = 1.5 * k; ctx.beginPath(); ctx.moveTo(it.x, my); ctx.lineTo(it.x, iy - 10 * k); ctx.stroke();
    ctx.save(); ctx.translate(it.x, iy); ctx.scale(s, s);
    if (it.j === 0) { ctx.fillStyle = '#ffd166'; starPath(5, 13 * k, 6 * k); ctx.fill(); }
    else if (it.j === 1) { ctx.fillStyle = '#ff7aa8'; heartPath(12 * k); }
    else if (it.j === 2) { ctx.fillStyle = '#fff'; circle(-7 * k, 2 * k, 8 * k); circle(3 * k, -3 * k, 10 * k); circle(11 * k, 3 * k, 7 * k); }
    else { ctx.save(); ctx.beginPath(); ctx.rect(-30 * k, -30 * k, 60 * k, 60 * k); ctx.arc(5 * k, -4 * k, 10 * k, 0, TAU, true); ctx.clip('evenodd'); ctx.fillStyle = '#ffe27a'; circle(0, 0, 11 * k); ctx.restore(); }
    ctx.restore();
  }
  if (hover) { const g = ctx.createRadialGradient(c.x, mat, 10 * k, c.x, mat, cw * 0.8); g.addColorStop(0, 'rgba(255,240,150,0.6)'); g.addColorStop(1, 'rgba(255,240,150,0)'); ctx.fillStyle = g; circle(c.x, mat, cw * 0.8); }
  ctx.fillStyle = '#fbe3ef'; ctx.beginPath(); ctx.roundRect(x0 + 6 * k, top, cw - 12 * k, mat - top, [16 * k, 16 * k, 0, 0]); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 5 * k;
  for (let x = x0 + 22 * k; x < x0 + cw - 12 * k; x += 18 * k) { ctx.beginPath(); ctx.moveTo(x, top + 10 * k); ctx.lineTo(x, mat); ctx.stroke(); }
  ctx.fillStyle = '#d7f0ff'; ctx.beginPath(); ctx.roundRect(x0 + 8 * k, mat - 14 * k, cw - 16 * k, 24 * k, 8 * k); ctx.fill();
  const b = cribOf(h, i);
  if (b) {
    const [hx, hy] = roomHead(b), r = RB() * 0.8;
    ctx.fillStyle = '#fff'; ell(hx, mat - 12 * k, r * 1.1, r * 0.45);
    if (b.love > 0) halo(hx, hy, r * 2.4, b.love);
    const X = animXf(b);
    ctx.save(); ctx.translate(hx, hy + X.dy * 0.3); ctx.rotate(-0.2 + X.rot * 0.4); ctx.scale(1 + Math.sin(b.bounce * 9) * 0.1 * b.bounce, 1);
    const mood = babyMood(b);
    drawHead(r, b, mood, { x: 0, y: 0 }, { noHair: b.type === 'moon', paci: b.type === 'bubble' && mood !== 'laugh' });
    drawAccessory(r, b);
    ctx.restore();
    ctx.fillStyle = b.color; ell(c.x + cw * 0.12, mat - 10 * k + Math.sin(t * 1.5) * 1.5 * k, cw * 0.32, 22 * k);
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; for (const dx of [-0.1, 0.05, 0.2, 0.3]) circle(c.x + cw * dx, mat - 14 * k + (dx * 40 % 8) * k, 3.5 * k);
  }
  ctx.fillStyle = '#fff';
  ctx.fillRect(x0, top - 12 * k, 12 * k, c.y - top + 12 * k); ctx.fillRect(x0 + cw - 12 * k, top - 12 * k, 12 * k, c.y - top + 12 * k);
  circle(x0 + 6 * k, top - 14 * k, 9 * k); circle(x0 + cw - 6 * k, top - 14 * k, 9 * k);
  ctx.fillStyle = h.wall; ctx.beginPath(); ctx.roundRect(x0 + 6 * k, mat + 6 * k, cw - 12 * k, c.y - mat - 20 * k, 6 * k); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fill();
  ctx.fillStyle = h.roof; ctx.save(); ctx.translate(c.x, mat + (c.y - mat - 14 * k) / 2 + 3 * k); heartPath(9 * k); ctx.restore();
}

export function drawHorse(L, h) {
  const k = S, p = L.horse, a = Math.sin(t * 7) * 0.28 * h.room.horse;
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
  ctx.fillStyle = 'rgba(80,40,20,0.15)'; ell(0, 2 * k, 70 * k, 8 * k);
  ctx.strokeStyle = '#c0705a'; ctx.lineWidth = 9 * k; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, -240 * k, 238 * k, Math.PI / 2 - 0.3, Math.PI / 2 + 0.3); ctx.stroke();
  ctx.strokeStyle = '#e39a6f'; ctx.lineWidth = 8 * k;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 30 * k, -58 * k); ctx.lineTo(s * 40 * k, -8 * k); ctx.stroke(); }
  ctx.fillStyle = h.roof; ell(-50 * k, -78 * k, 12 * k, 22 * k, -0.6);
  ctx.fillStyle = '#ffb38a'; ell(0, -70 * k, 50 * k, 24 * k);
  ctx.save(); ctx.translate(38 * k, -88 * k); ctx.rotate(-0.5); ctx.fillRect(-10 * k, -30 * k, 22 * k, 40 * k); ctx.restore();
  ell(52 * k, -118 * k, 26 * k, 17 * k, 0.35);
  ctx.fillStyle = h.roof; for (let i = 0; i < 4; i++) circle(28 * k + i * 4 * k, -128 * k + i * 12 * k, 8 * k);
  ell(-2 * k, -92 * k, 22 * k, 9 * k);
  ctx.fillStyle = '#2a1b3d'; circle(56 * k, -124 * k, 3.5 * k);
  ctx.fillStyle = '#ffb38a'; ell(36 * k, -136 * k, 5 * k, 10 * k, -0.3);
  ctx.fillStyle = 'rgba(255,110,140,0.5)'; circle(66 * k, -112 * k, 5 * k);
  ctx.restore();
  const rider = h.occupants().find(isRider);
  if (rider) drawHorseRider(rider, L, h); // наездник со своей позой (anim/horse.ts)
}

export function drawBlock(p) {
  const k = S, bs = 36 * k;
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
  ctx.fillStyle = p.c; ctx.beginPath(); ctx.roundRect(-bs / 2, -bs / 2, bs, bs, 6 * k); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  if (p.i % 3 === 0) { starPath(5, 10 * k, 4.5 * k); ctx.fill(); } else if (p.i % 3 === 1) heartPath(9 * k); else circle(0, 0, 7 * k);
  ctx.restore();
}

export function drawTower(L, h) {
  const R = h.room;
  ctx.fillStyle = 'rgba(80,40,20,0.15)'; ell(L.tower.x, L.tower.y + 2 * S, 34 * S, 7 * S);
  (R.tower || towerRest(L)).forEach(drawBlock);
}

export function drawXylo(L, h) {
  const k = S, p = L.xylo, R = h.room, cols = ['#ff6b6b', '#ff9f43', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff'];
  ctx.fillStyle = 'rgba(80,40,20,0.15)'; ell(p.x, p.y + 44 * k, p.w * 0.55, 9 * k);
  ctx.fillStyle = '#8a5a3b'; ctx.fillRect(p.x - p.w / 2 - 8 * k, p.y - 26 * k, p.w + 16 * k, 8 * k); ctx.fillRect(p.x - p.w / 2 - 8 * k, p.y + 18 * k, p.w + 16 * k, 8 * k);
  xyloBars(L).forEach((b, i) => {
    const pr = R.xylo[i] * 4 * k;
    ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.roundRect(b.x - b.w / 2, b.y - b.h / 2 + pr, b.w, b.h, 6 * k); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(b.x - b.w / 2 + 4 * k, b.y - b.h / 2 + pr + 4 * k, 4 * k, b.h - 8 * k);
    ctx.fillStyle = '#ddd'; circle(b.x, b.y - b.h / 2 + 8 * k + pr, 2.5 * k); circle(b.x, b.y + b.h / 2 - 8 * k + pr, 2.5 * k);
  });
  ctx.strokeStyle = '#c98b5a'; ctx.lineWidth = 5 * k; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(p.x + p.w / 2 + 14 * k, p.y + 30 * k); ctx.lineTo(p.x + p.w / 2 + 50 * k, p.y - 5 * k); ctx.stroke();
  ctx.fillStyle = '#ff6b6b'; circle(p.x + p.w / 2 + 52 * k, p.y - 7 * k, 9 * k);
}

export function drawBall(h) {
  const k = S, B = h.room.ball;
  if (B.hold) return; // мяч рисует малыш, который его обнимает
  ctx.fillStyle = 'rgba(80,40,20,0.18)'; ell(B.x, B.y, 24 * k * (1 - Math.min(B.z / (400 * k), 0.5)), 6 * k);
  ctx.save(); ctx.translate(B.x, B.y - 26 * k - B.z); ctx.rotate(B.rot); drawToy('ball', 37 * k); ctx.restore();
}

export function hitNursery(x, y) {
  const h = G.curHouse, R = h.room, L = RL(), k = S;
  for (let i = R.bubbles.length - 1; i >= 0; i--) { const q = R.bubbles[i]; if (dist(x, y, q.x, q.y) < q.r + 10 * k) return { k: 'bubble', o: i }; }
  const d = L.door; if (x > d.x && x < d.x + d.w && y > d.y && y < d.y + d.h) return { k: 'door' };
  for (let i = 0; i < 2; i++) { const c = L.cribs[i]; if (Math.abs(x - c.x) < L.cw / 2 && y > c.y - 140 * k && y < c.y) return { k: 'crib', o: i }; }
  const B = R.ball; if (dist(x, y, B.x, B.y - B.z - 26 * k) < 40 * k) return { k: 'ball' };
  const bars = xyloBars(L); for (let i = 0; i < bars.length; i++) { const b = bars[i]; if (Math.abs(x - b.x) < b.w / 2 + 3 * k && Math.abs(y - b.y) < b.h / 2 + 6 * k) return { k: 'xylo', o: i }; }
  if (!R.tower && Math.abs(x - L.tower.x) < 30 * k && y > L.tower.y - 190 * k && y < L.tower.y + 8 * k) return { k: 'tower' };
  if (dist(x, y, L.horse.x, L.horse.y - 80 * k) < 75 * k) return { k: 'horse' };
  if (dist(x, y, L.teddy.x, L.teddy.y) < 42 * k) return { k: 'teddy' };
  return null;
}
