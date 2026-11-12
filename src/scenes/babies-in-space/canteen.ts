import { H, S, TAU, W, clamp, ctx, dist, easeOutBack, rand, t } from '../../core/canvas';
import { circle, ell, heartPath, starPath } from '../../core/draw';
import { addP, burst } from '../../core/particles';
import { drawRoomBaby, drawRoomBabyAt } from './characters';
import { CHAIR_SEAT } from './nursery';
import { dragWish, drawBubbles, drawDark, drawDoor, drawLamp, drawRoomBg, drawWindow, hintA, hoverTarget, roomHead } from './room';
import { sfx } from './sounds';
import { G, RB } from './state';
import { drawToy } from './toys';
import { catchPos, startEat } from './anim/eat';

export function chairOf(h, i) { return h.occupants().find(b => b.chair === h.room.chairs[i]); }

// ---------- СТОЛОВАЯ ----------
export const FOODS = ['bottle', 'apple', 'banana', 'bowl', 'cookie'];

export function KL() {
  const k = S, fy = H * 0.6, doorW = 125 * k, doorH = 235 * k;
  const door = { x: Math.max(16, W * 0.04), y: fy + 25 * k - doorH, w: doorW, h: doorH };
  const x0 = door.x + doorW + 75 * k, x1 = W - 70 * k, cy = fy + 160 * k;
  return {
    fy, door, win: { x: W * 0.5, y: H * 0.25, w: 240 * k, h: 175 * k }, lamp: { x: W * 0.3, y: H * 0.17 },
    chairs: [0, 1, 2].map(i => ({ x: x0 + (x1 - x0) * (i + 0.5) / 3, y: cy })),
    fridge: { x: W - 75 * k, y: fy + 20 * k, w: 115 * k, h: 215 * k },
    stove: { x: door.x + doorW + 72 * k, y: fy + 18 * k },
    tray: { x: W * 0.55, y: H - 48 * k, w: Math.min(450 * k, W - 2 * (door.x + doorW * 0.5)) },
    bx0: door.x + doorW + 40 * k, bx1: W - 50 * k, by0: fy + 70 * k, by1: H - 30 * k,
  };
}

export function traySlots(L) { const p = L.tray, n = FOODS.length, sw = p.w / n; return FOODS.map((_, i) => ({ x: p.x - p.w / 2 + sw * (i + 0.5), y: p.y - 44 * S })); }

export function drawFood(kind, s) {
  if (kind === 'bottle') { drawToy('bottle', s * 0.8); return; }
  if (kind === 'apple') {
    ctx.fillStyle = '#ff5d5d'; circle(-s * 0.28, s * 0.05, s * 0.55); circle(s * 0.28, s * 0.05, s * 0.55); ell(0, s * 0.25, s * 0.7, s * 0.5);
    ctx.strokeStyle = '#7a4a2a'; ctx.lineWidth = s * 0.12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -s * 0.38); ctx.lineTo(s * 0.08, -s * 0.72); ctx.stroke();
    ctx.fillStyle = '#5cc96b'; ell(s * 0.3, -s * 0.64, s * 0.26, s * 0.12, -0.5);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ell(-s * 0.35, -s * 0.08, s * 0.11, s * 0.2, 0.4);
  } else if (kind === 'banana') {
    ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.moveTo(-s * 0.85, -s * 0.45); ctx.quadraticCurveTo(-s * 0.2, s * 0.95, s * 0.85, -s * 0.3);
    ctx.quadraticCurveTo(-s * 0.1, s * 0.4, -s * 0.85, -s * 0.45); ctx.fill();
    ctx.fillStyle = '#e8b923'; ctx.beginPath(); ctx.moveTo(-s * 0.7, -s * 0.2); ctx.quadraticCurveTo(-s * 0.15, s * 0.65, s * 0.7, -s * 0.12); ctx.quadraticCurveTo(-s * 0.15, s * 0.5, -s * 0.7, -s * 0.2); ctx.fill();
    ctx.fillStyle = '#7a5a2a'; circle(-s * 0.85, -s * 0.45, s * 0.08); circle(s * 0.85, -s * 0.3, s * 0.07);
  } else if (kind === 'bowl') {
    ctx.fillStyle = '#fff1c9'; ell(0, -s * 0.05, s * 0.8, s * 0.24);
    ctx.fillStyle = '#ff5d73'; circle(-s * 0.28, -s * 0.12, s * 0.11); ctx.fillStyle = '#9b5de5'; circle(s * 0.12, -s * 0.1, s * 0.1); ctx.fillStyle = '#ff9ec7'; circle(-s * 0.02, -s * 0.2, s * 0.08);
    ctx.strokeStyle = '#c9d3ea'; ctx.lineWidth = s * 0.15; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(s * 0.3, -s * 0.05); ctx.lineTo(s * 0.8, -s * 0.75); ctx.stroke();
    ctx.fillStyle = '#c9d3ea'; ell(s * 0.86, -s * 0.84, s * 0.17, s * 0.11, -0.9);
    ctx.fillStyle = '#8fd3ff'; ctx.beginPath(); ctx.moveTo(-s * 0.88, -s * 0.05); ctx.quadraticCurveTo(-s * 0.82, s * 0.78, 0, s * 0.75); ctx.quadraticCurveTo(s * 0.82, s * 0.78, s * 0.88, -s * 0.05); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ell(-s * 0.45, s * 0.25, s * 0.1, s * 0.2, 0.5);
  } else {
    ctx.fillStyle = '#c98a45'; circle(0, 0, s * 0.72); ctx.fillStyle = '#e8b06a'; circle(-s * 0.04, -s * 0.04, s * 0.62);
    ctx.fillStyle = '#6b4226'; for (const [x, y] of [[-0.3, -0.25], [0.25, -0.3], [0.05, 0.1], [-0.3, 0.3], [0.32, 0.25]]) circle(s * x, s * y, s * 0.1);
  }
}

export function mouthPos(b) { const [hx, hy] = roomHead(b); return [hx, hy + RB() * 0.4]; }

export function pickEater(h) {
  const c = h.occupants().filter(b => !b.dragged && !b.eat && !b.eatPending && !b.ifall);
  const score = b => (b.wish && b.wish.k === 'eat' ? 10 : 0) + (b.chair ? 5 : 0) + Math.random();
  c.sort((a, b) => score(b) - score(a)); return c[0] || null;
}

export function feedFrom(h, i) {
  const R = h.room, L = KL(), f = R.foods[i], sl = traySlots(L)[i];
  if (f.gone > 0) { sfx.boop(); return; }
  const b = pickEater(h);
  if (!b) { f.hop = 1; sfx.boing(); burst(sl.x, sl.y, 'spark', 8, { size: 7, speed: 120, color: '#fff7c2' }); return; }
  f.gone = 1.8; b.eatPending = true; b.awake = 3;
  R.flying.push({ k: f.k, x0: sl.x, y0: sl.y, b, p: 0 });
  sfx.pick(); burst(sl.x, sl.y, 'spark', 6, { size: 6, speed: 100, color: '#fff7c2' });
}

export function updateCanteen(dt, h) {
  const R = h.room, L = KL();
  R.fridge = Math.max(0, R.fridge - dt); R.pot = Math.max(0, R.pot - dt);
  for (const c of R.chairs) c.wob = Math.max(0, c.wob - dt * 1.5);
  for (const f of R.foods) { f.gone = Math.max(0, f.gone - dt); f.hop = Math.max(0, f.hop - dt * 1.5); }
  R.steamT -= dt;
  if (R.steamT <= 0) { R.steamT = R.pot > 0 ? 0.07 : 0.45; addP({ kind: 'smoke', x: L.stove.x + rand(-12, 12) * S, y: L.stove.y - 140 * S, vx: rand(-10, 10) * S, vy: -rand(30, 60) * S, life: 1.4, size: rand(5, 9) * S, color: '#fff', rot: 0, vr: 0, g: 0 }); }
  for (const F of R.flying) {
    F.p += dt / 0.7;
    if (F.b.dragged || F.b.home !== h) { F.done = true; F.b.eatPending = false; const [x, y] = foodXY(F); burst(x, y, 'spark', 8, { size: 6, speed: 100, color: '#fff' }); continue; }
    if (F.p >= 1) { F.done = true; F.b.eatPending = false; startEat(F.b, F.k); }
  }
  R.flying = R.flying.filter(F => !F.done);
}

export function foodXY(F) {
  const p = clamp(F.p, 0, 1), [mx, my] = catchPos(F.b), e = p * p * (3 - 2 * p);
  return [F.x0 + (mx - F.x0) * e, F.y0 + (my - F.y0) * e - Math.sin(p * Math.PI) * 130 * S];
}

export function drawFridge(L, h) {
  const k = S, f = L.fridge, R = h.room, x0 = f.x - f.w / 2, y0 = f.y - f.h, fz = f.h * 0.3;
  const o = clamp(Math.min((1.6 - R.fridge) * 5, R.fridge * 3), 0, 1) * (R.fridge > 0 ? 1 : 0);
  ctx.fillStyle = 'rgba(80,40,20,0.15)'; ell(f.x, f.y, f.w * 0.6, 8 * k);
  ctx.fillStyle = '#dff1ff'; ctx.beginPath(); ctx.roundRect(x0, y0, f.w, f.h, 18 * k); ctx.fill();
  // внутри
  const iy = y0 + fz + 8 * k, ih = f.h - fz - 20 * k;
  ctx.fillStyle = '#fff8d6'; ctx.beginPath(); ctx.roundRect(x0 + 8 * k, iy, f.w - 16 * k, ih, 8 * k); ctx.fill();
  ctx.fillStyle = '#e6d9a8'; for (const q of [0.35, 0.7]) ctx.fillRect(x0 + 8 * k, iy + ih * q, f.w - 16 * k, 4 * k);
  ctx.save(); ctx.translate(x0 + f.w * 0.3, iy + ih * 0.35 - 14 * k); drawFood('apple', 12 * k); ctx.restore();
  ctx.save(); ctx.translate(x0 + f.w * 0.68, iy + ih * 0.35 - 20 * k); drawToy('bottle', 14 * k); ctx.restore();
  ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.moveTo(x0 + f.w * 0.25, iy + ih * 0.7); ctx.lineTo(x0 + f.w * 0.65, iy + ih * 0.7); ctx.lineTo(x0 + f.w * 0.65, iy + ih * 0.7 - 22 * k); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ff9ec7'; ell(x0 + f.w * 0.5, iy + ih * 0.92, 22 * k, 10 * k);
  // дверца (открывается)
  ctx.save(); ctx.translate(x0, 0); ctx.scale(1 - o * 0.85, 1);
  ctx.fillStyle = '#f2f9ff'; ctx.beginPath(); ctx.roundRect(0, y0 + fz + 4 * k, f.w, f.h - fz - 4 * k, [0, 0, 18 * k, 18 * k]); ctx.fill();
  ctx.fillStyle = '#b8c9e6'; ctx.fillRect(f.w - 18 * k, y0 + fz + 22 * k, 7 * k, 50 * k);
  ctx.fillStyle = '#ff7aa8'; ctx.save(); ctx.translate(f.w * 0.35, y0 + fz + 50 * k); heartPath(12 * k); ctx.restore();
  ctx.fillStyle = '#ffd166'; ctx.save(); ctx.translate(f.w * 0.5, y0 + fz + 95 * k); ctx.rotate(0.2); starPath(5, 13 * k, 6 * k); ctx.fill(); ctx.restore();
  ctx.restore();
  // морозилка с мордочкой
  ctx.fillStyle = '#f2f9ff'; ctx.beginPath(); ctx.roundRect(x0, y0, f.w, fz, [18 * k, 18 * k, 0, 0]); ctx.fill();
  ctx.fillStyle = '#b8c9e6'; ctx.fillRect(f.w - 18 * k + x0, y0 + fz - 30 * k, 7 * k, 22 * k);
  ctx.strokeStyle = '#3a5a7a'; ctx.lineWidth = 3.5 * k; ctx.lineCap = 'round';
  const fx = f.x - 6 * k, fyy = y0 + fz * 0.45;
  if (o > 0) { ctx.fillStyle = '#3a5a7a'; circle(fx - 16 * k, fyy, 4 * k); circle(fx + 16 * k, fyy, 4 * k); ctx.fillStyle = '#c93d5c'; ell(fx, fyy + 14 * k, 7 * k, 6 * k); }
  else { for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(fx + s * 16 * k, fyy, 5 * k, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke(); } ctx.beginPath(); ctx.arc(fx, fyy + 8 * k, 7 * k, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,130,150,0.45)'; ell(fx - 28 * k, fyy + 9 * k, 6 * k, 4 * k); ell(fx + 28 * k, fyy + 9 * k, 6 * k, 4 * k);
  ctx.fillStyle = '#b8c9e6'; ctx.fillRect(x0 + 12 * k, f.y - 4 * k, 12 * k, 10 * k); ctx.fillRect(x0 + f.w - 24 * k, f.y - 4 * k, 12 * k, 10 * k);
}

export function drawStove(L, h) {
  const k = S, p = L.stove, R = h.room, w = 112 * k, sh = 90 * k, top = p.y - sh;
  ctx.fillStyle = 'rgba(80,40,20,0.15)'; ell(p.x, p.y, w * 0.6, 8 * k);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(p.x - w / 2, top, w, sh, 10 * k); ctx.fill();
  ctx.fillStyle = '#d9dde8'; ctx.fillRect(p.x - w / 2, top, w, 10 * k);
  ctx.fillStyle = '#3a2f5a'; ctx.beginPath(); ctx.roundRect(p.x - w * 0.36, top + 30 * k, w * 0.72, 44 * k, 8 * k); ctx.fill();
  const g = ctx.createRadialGradient(p.x, top + 60 * k, 2 * k, p.x, top + 60 * k, 35 * k); g.addColorStop(0, `rgba(255,170,80,${0.55 + Math.sin(t * 5) * 0.1})`); g.addColorStop(1, 'rgba(255,170,80,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(p.x - w * 0.36, top + 30 * k, w * 0.72, 44 * k, 8 * k); ctx.fill();
  ctx.fillStyle = h.roof; for (const dx of [-0.3, 0, 0.3]) circle(p.x + w * dx, top + 20 * k, 5 * k);
  // кастрюлька
  const pw = 78 * k, ph = 44 * k, py = top - ph;
  ctx.fillStyle = h.roof; ctx.beginPath(); ctx.roundRect(p.x - pw / 2, py, pw, ph, [4 * k, 4 * k, 14 * k, 14 * k]); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(p.x - pw / 2 + 8 * k, py + 8 * k, 7 * k, ph - 16 * k);
  ctx.strokeStyle = h.roof; ctx.lineWidth = 6 * k; ctx.beginPath(); ctx.moveTo(p.x - pw / 2 - 12 * k, py + 12 * k); ctx.lineTo(p.x - pw / 2, py + 12 * k); ctx.moveTo(p.x + pw / 2, py + 12 * k); ctx.lineTo(p.x + pw / 2 + 12 * k, py + 12 * k); ctx.stroke();
  const lid = R.pot > 0 ? Math.abs(Math.sin(R.pot * Math.PI * 4)) * 14 * k : 0, lr = R.pot > 0 ? Math.sin(t * 30) * 0.12 : 0;
  ctx.save(); ctx.translate(p.x, py - lid); ctx.rotate(lr);
  ctx.fillStyle = '#d9dde8'; ell(0, 0, pw * 0.56, 9 * k); ctx.fillStyle = '#ffd66b'; circle(0, -9 * k, 7 * k);
  ctx.restore();
}

export function drawChair(L, i, h, glow) {
  const k = S, c = L.chairs[i], st = h.room.chairs[i], seatY = c.y - CHAIR_SEAT();
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(Math.sin(t * 22) * st.wob * 0.07); ctx.translate(-c.x, -c.y);
  if (glow) { const g = ctx.createRadialGradient(c.x, seatY - 30 * k, 10 * k, c.x, seatY - 30 * k, 120 * k); g.addColorStop(0, `rgba(255,240,150,${glow})`); g.addColorStop(1, 'rgba(255,240,150,0)'); ctx.fillStyle = g; circle(c.x, seatY - 30 * k, 120 * k); }
  ctx.fillStyle = 'rgba(80,40,20,0.15)'; ell(c.x, c.y, 55 * k, 8 * k);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 9 * k; ctx.lineCap = 'round';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(c.x + s * 20 * k, seatY + 8 * k); ctx.lineTo(c.x + s * 46 * k, c.y - 4 * k); ctx.stroke(); }
  ctx.lineWidth = 6 * k; ctx.beginPath(); ctx.moveTo(c.x - 36 * k, c.y - 45 * k); ctx.lineTo(c.x + 36 * k, c.y - 45 * k); ctx.stroke();
  ctx.fillStyle = h.roof; ctx.beginPath(); ctx.roundRect(c.x - 36 * k, seatY - 100 * k, 72 * k, 108 * k, [28 * k, 28 * k, 8 * k, 8 * k]); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.roundRect(c.x - 26 * k, seatY - 90 * k, 52 * k, 80 * k, [22 * k, 22 * k, 6 * k, 6 * k]); ctx.fill();
  const b = chairOf(h, i);
  if (b && !b.dragged) drawRoomBabyAt(b, c.x, seatY - 14 * k, false);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(c.x - 40 * k, seatY - 4 * k, 80 * k, 18 * k, 7 * k); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 5 * k; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(c.x + s * 44 * k, seatY - 36 * k); ctx.lineTo(c.x + s * 36 * k, seatY); ctx.stroke(); }
  ctx.fillStyle = '#ffe9b0'; ctx.beginPath(); ctx.roundRect(c.x - 56 * k, seatY - 44 * k, 112 * k, 13 * k, 6 * k); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(c.x - 52 * k, seatY - 34 * k, 104 * k, 3 * k);
  ctx.restore();
}

export function drawTray(L, h) {
  const k = S, p = L.tray, R = h.room;
  ctx.fillStyle = 'rgba(80,40,20,0.15)'; ell(p.x, p.y + 30 * k, p.w * 0.55, 9 * k);
  ctx.fillStyle = '#a66f45'; for (const dx of [-0.42, 0.42]) ctx.fillRect(p.x + p.w * dx - 7 * k, p.y, 14 * k, 30 * k);
  ctx.fillStyle = '#c98b5a'; ctx.beginPath(); ctx.roundRect(p.x - p.w / 2 - 12 * k, p.y - 14 * k, p.w + 24 * k, 22 * k, 9 * k); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(p.x - p.w / 2, p.y - 10 * k, p.w, 4 * k);
  traySlots(L).forEach((sl, i) => {
    const f = R.foods[i];
    ctx.fillStyle = '#fff'; ell(sl.x, p.y - 15 * k, Math.min(38 * k, p.w / 10.5), 10 * k);
    if (f.gone > 0.4) return;
    const sc = f.gone > 0 ? Math.max(0.01, easeOutBack(1 - f.gone / 0.4)) : 1, hop = f.hop > 0 ? Math.abs(Math.sin(f.hop * Math.PI * 3)) * 26 * k : 0;
    ctx.save(); ctx.translate(sl.x, sl.y - hop + Math.sin(t * 2 + i) * 2 * k); ctx.rotate(f.hop > 0 ? Math.sin(t * 20) * 0.2 : 0); ctx.scale(sc, sc); drawFood(f.k, 32 * k); ctx.restore();
  });
}

export function drawCanteen(h) {
  const L = KL(), R = h.room, hv = hoverTarget(), wk = dragWish();
  drawRoomBg(L, h); drawWindow(L, h); drawFridge(L, h); drawDoor(L, h, hv.door); drawLamp(L, h);
  const items = [{ y: L.stove.y, d: () => drawStove(L, h) }, { y: L.tray.y + 10 * S, d: () => drawTray(L, h) }];
  L.chairs.forEach((c, i) => items.push({ y: c.y, d: () => drawChair(L, i, h, hv.chair === i ? 0.6 : wk === 'eat' && !chairOf(h, i) ? hintA() : 0) }));
  for (const b of h.occupants()) if (!b.chair && !b.dragged) items.push({ y: b.iy, d: () => drawRoomBaby(b) });
  items.sort((a, b) => a.y - b.y).forEach(it => it.d());
  for (const F of R.flying) { const [x, y] = foodXY(F); ctx.save(); ctx.translate(x, y); ctx.rotate(F.p * TAU); drawFood(F.k, (30 - Math.min(1, F.p) * 8) * S); ctx.restore(); }
  drawBubbles(R); drawDark(L, R);
  for (const b of h.occupants()) if (b.dragged) drawRoomBaby(b);
}

export function hitCanteen(x, y) {
  const h = G.curHouse, R = h.room, L = KL(), k = S;
  for (let i = R.bubbles.length - 1; i >= 0; i--) { const q = R.bubbles[i]; if (dist(x, y, q.x, q.y) < q.r + 10 * k) return { k: 'bubble', o: i }; }
  const d = L.door; if (x > d.x && x < d.x + d.w && y > d.y && y < d.y + d.h) return { k: 'door' };
  const sl = traySlots(L); for (let i = 0; i < sl.length; i++) if (dist(x, y, sl[i].x, sl[i].y) < Math.max(50 * k, 32)) return { k: 'food', o: i };
  for (let i = 0; i < 3; i++) { const c = L.chairs[i]; if (Math.abs(x - c.x) < 58 * k && y > c.y - 210 * k && y < c.y + 5 * k) return { k: 'chair', o: i }; }
  const f = L.fridge; if (Math.abs(x - f.x) < f.w / 2 && y > f.y - f.h && y < f.y) return { k: 'fridge' };
  const st = L.stove; if (Math.abs(x - st.x) < 60 * k && y > st.y - 150 * k && y < st.y) return { k: 'stove' };
  return null;
}
