import { whoosh } from '../../core/audio';
import { H, S, TAU, W, clamp, ctx, dist, rand, t } from '../../core/canvas';
import { circle, ell, heartPath, starPath } from '../../core/draw';
import { addP, burst } from '../../core/particles';
import { drawRoomBaby, drawRoomBabyAt } from './characters';
import { drawBubbles, drawDark, drawDoor, drawLamp, drawRoomBg, drawWindow, dragWish, glowSpot, hintA, hoverTarget } from './room';
import { sfx } from './sounds';
import { G, RB } from './state';
import { drawToy } from './toys';
import { satisfy } from './wishes';

// ---------------- ВАННАЯ: купаться и сидеть на горшке ----------------

export function BL() {
  const k = S, fy = H * 0.6, doorW = 125 * k, doorH = 235 * k;
  const door = { x: Math.max(16, W * 0.04), y: fy + 25 * k - doorH, w: doorW, h: doorH };
  const tw = 320 * k, th = 100 * k;
  const tub = { x: Math.min(W * 0.62, W - 24 * k - tw / 2), y: fy + 150 * k, w: tw, h: th };
  const sink = { x: door.x + doorW + 75 * k, y: fy + 30 * k };
  return {
    fy, door, tub, sink,
    win: { x: W * 0.5, y: H * 0.25, w: 240 * k, h: 175 * k }, lamp: { x: W * 0.3, y: H * 0.17 },
    potties: [{ x: W * 0.36, y: H - 50 * k }, { x: W * 0.54, y: H - 50 * k }],
    towel: { x: W - 95 * k, y: fy - 165 * k },
    bx0: door.x + doorW + 40 * k, bx1: W - 50 * k, by0: fy + 70 * k, by1: H - 30 * k,
  };
}

export const tubSlotX = (L, i) => L.tub.x + (i ? 1 : -1) * L.tub.w * 0.22;
export const tubOf = (h, i) => h.occupants().find(b => b.tub && b.tub.i === i && !b.dragged);
export const pottyOf = (h, i) => h.occupants().find(b => b.potty && b.potty.i === i && !b.dragged);
export const newBathRoom = () => ({
  tubs: [{ i: 0 }, { i: 1 }], potties: [{ i: 0, wob: 0 }, { i: 1, wob: 0 }], duck: { hop: 0, x: 0 },
  faucet: 0, sink: 0, towel: 0, bubT: 0, light: true, starT: 0, bubbles: [], doorOpen: 0, lampSwing: 0,
});

// малыш в ванне: голова над пеной, ручки плещутся
export function tickTub(b, dt, L) {
  const r = RB(), T = L.tub;
  b.ix = tubSlotX(L, b.tub.i); b.iy = T.y - T.h + r * 1.15; b.face = b.tub.i ? -1 : 1;
  b.splashT = (b.splashT ?? rand(1, 3)) - dt;
  if (b.splashT <= 0 && !b.sleeping()) {
    b.splashT = rand(2.5, 5); b.laugh = Math.max(b.laugh, 0.7);
    if (b.visible()) { splashAt(b.ix, T.y - T.h, 6); if (Math.random() < 0.5) sfx.splash(); }
  }
  b.pose = { top: foamCrown };
}
function foamCrown(r) {
  ctx.fillStyle = '#fff';
  for (const [x, y, s] of [[-0.45, -0.82, 0.3], [-0.1, -1.0, 0.36], [0.3, -0.88, 0.3], [0.58, -0.62, 0.2]]) circle(x * r, y * r + Math.sin(t * 3 + x * 5) * r * 0.03, s * r);
  ctx.fillStyle = 'rgba(160,220,255,0.6)'; circle(-0.2 * r, -1.08 * r, 0.08 * r); circle(0.38 * r, -0.98 * r, 0.06 * r);
}

// малыш на горшке: сел → тужится (надутые щёки) → «готово!» → радуется → слезает сам
export function tickPotty(b, dt, L) {
  const P = b.potty, p = L.potties[P.i], r = RB();
  P.t += dt; b.ix = p.x; b.iy = p.y - 40 * S + r * 0.3;
  if (P.t < 0.5) b.pose = { dy: -Math.sin(P.t / 0.5 * Math.PI) * 8 * S };
  else if (P.t < 2.8) {
    const q = Math.abs(Math.sin(P.t * 5));
    b.pose = { mood: 'blink', face: { cheeks: 0.55 + 0.45 * q }, dy: Math.sin(P.t * 40) * 1.2 * S, armL: 0.05, armR: 0.05 };
    P.hm = (P.hm ?? 0) - dt; if (P.hm <= 0) { P.hm = 0.75; if (b.visible()) sfx.hmm(); }
  } else {
    if (!P.done) {
      P.done = true; b.laugh = 2.5;
      if (b.visible()) { sfx.tinkle(); burst(p.x, p.y - 30 * S, 'spark', 14, { size: 8, speed: 170, color: '#ffe27a' }); }
      if (!satisfy(b, 'potty') && b.visible()) burst(b.ix, b.iy - r * 2.6, 'heart', 6, { size: 9, speed: 110, up: -60, color: '#ff7aa8' });
    }
    b.pose = { mood: 'laugh', armL: 1.9 + Math.sin(t * 14) * 0.3, armR: 1.9 + Math.sin(t * 14 + 1) * 0.3 };
    if (P.t > 6) { // слезает сам и ползёт дальше
      b.potty = null; b.pose = null; b.ix = p.x + 70 * S; b.iy = clamp(p.y - 10 * S, L.by0, L.by1); b.bounce = 1; b.iwT = 1.5;
      if (b.visible()) sfx.boop();
    }
  }
}

export function splashAt(x, y, n = 10) {
  for (let i = 0; i < n; i++) addP({ kind: 'spark', x: x + rand(-30, 30) * S, y, vx: rand(-110, 110) * S, vy: -rand(150, 300) * S, life: rand(0.5, 0.9), size: rand(4, 7) * S, color: Math.random() < 0.5 ? '#bfe9ff' : '#fff', rot: rand(0, TAU), vr: rand(-6, 6), g: 700 });
}

export function updateBath(dt, h) {
  const R = h.room, L = BL();
  R.faucet = Math.max(0, R.faucet - dt); R.sink = Math.max(0, R.sink - dt); R.towel = Math.max(0, R.towel - dt * 0.7); R.duck.hop = Math.max(0, R.duck.hop - dt * 1.4);
  for (const p of R.potties) p.wob = Math.max(0, p.wob - dt * 1.5);
  const busy = !!(tubOf(h, 0) || tubOf(h, 1));
  R.bubT -= dt;
  if (R.bubT <= 0) { // из ванны (и из крана) поднимаются мыльные пузыри — их можно лопать
    R.bubT = busy || R.faucet > 0 ? rand(0.5, 1.1) : rand(2.5, 4);
    const T = L.tub; R.bubbles.push({ x: T.x + rand(-0.4, 0.4) * T.w, y: T.y - T.h - 10 * S, r: rand(10, 22) * S, vy: -rand(25, 50) * S, ph: rand(0, TAU), life: rand(6, 9) });
  }
  if (R.faucet > 0 && Math.random() < dt * 12) { const T = L.tub, fx = T.x - T.w * 0.38; splashAt(fx, T.y - T.h, 1); }
  if (R.sink > 0 && Math.random() < dt * 4) { const s = L.sink; R.bubbles.push({ x: s.x + rand(-20, 20) * S, y: s.y - 80 * S, r: rand(8, 16) * S, vy: -rand(30, 55) * S, ph: rand(0, TAU), life: rand(5, 7) }); }
}

// ---------------- РИСОВАНИЕ ----------------
function drawTub(L, h, hv) {
  const k = S, T = L.tub, R = h.room, x0 = T.x - T.w / 2, top = T.y - T.h;
  // кран на стене
  const fx = T.x - T.w * 0.38;
  ctx.fillStyle = '#c9d3e8'; ctx.beginPath(); ctx.roundRect(fx - 6 * k, top - 75 * k, 12 * k, 60 * k, 5 * k); ctx.fill();
  ctx.beginPath(); ctx.roundRect(fx - 6 * k, top - 75 * k, 38 * k, 12 * k, 6 * k); ctx.fill();
  ctx.fillStyle = '#ff7aa8'; circle(fx, top - 82 * k, 9 * k);
  if (R.faucet > 0) { ctx.fillStyle = 'rgba(150,215,255,0.75)'; ctx.fillRect(fx + 22 * k, top - 64 * k, 8 * k, 64 * k); }
  if (hv) glowSpot(T.x, top, T.w * 0.75, 0.6);
  // внутренняя стенка и вода
  ctx.fillStyle = '#dbe9f7'; ell(T.x, top, T.w / 2, 16 * k);
  ctx.fillStyle = '#8fd3ff'; ell(T.x, top + 3 * k, T.w / 2 - 10 * k, 11 * k);
  for (let i = 0; i < 2; i++) { const b = tubOf(h, i); if (b) drawRoomBabyAt(b, b.ix, b.iy, false); }
  // корпус
  const g = ctx.createLinearGradient(0, top, 0, T.y); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e3ecf8');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x0, top, T.w, T.h, [18 * k, 18 * k, T.h * 0.5, T.h * 0.5]); ctx.fill();
  ctx.fillStyle = h.roof; ctx.globalAlpha = 0.35; ctx.fillRect(x0 + 14 * k, top + T.h * 0.42, T.w - 28 * k, 9 * k); ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffd66b'; for (const s of [-1, 1]) { ell(T.x + s * T.w * 0.36, T.y + 4 * k, 15 * k, 10 * k); }
  // пена на краю
  ctx.fillStyle = '#fff';
  for (let i = 0; i <= 12; i++) { const fx2 = x0 + 12 * k + (T.w - 24 * k) * i / 12; circle(fx2, top - 2 * k + Math.sin(t * 2 + i * 1.7) * 2 * k, (10 + (i * 37 % 7)) * k); }
  ctx.fillStyle = 'rgba(160,220,255,0.7)'; for (let i = 0; i < 5; i++) circle(x0 + T.w * (0.15 + i * 0.18), top - 10 * k + Math.sin(t * 3 + i) * 2 * k, 3 * k);
  // уточка плавает
  const D = R.duck, dx = T.x + Math.sin(t * 0.5) * T.w * 0.3, dy = top - 12 * k - Math.abs(Math.sin(D.hop * Math.PI * 3)) * 30 * k + Math.sin(t * 2.5) * 2 * k;
  D.x = dx; D.y = dy;
  ctx.save(); ctx.translate(dx, dy); ctx.scale(Math.cos(t * 0.5) > 0 ? 1 : -1, 1); ctx.rotate(Math.sin(t * 2) * 0.1); drawToy('duck', 20 * k); ctx.restore();
}

export function drawPottyShape(s, wob = 0, face = true, part: 'all' | 'back' | 'front' = 'all', hole = true) {
  // s — половина ширины горшка; центр дна в (0,0). back — спинка и задний край, front — чаша с личиком
  ctx.save(); ctx.rotate(Math.sin(wob * 18) * 0.12 * wob);
  if (part !== 'front') {
    ctx.fillStyle = '#ff8fbd'; ctx.beginPath(); ctx.roundRect(-s * 0.72, -s * 2.05, s * 1.44, s * 1.05, [s * 0.5, s * 0.5, 0, 0]); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.save(); ctx.translate(0, -s * 1.62); heartPath(s * 0.2); ctx.restore();
    ctx.fillStyle = '#ffc4dd'; ell(0, -s * 1.15, s * 1.14, s * 0.3);
    if (hole) { ctx.fillStyle = '#e8679b'; ell(0, -s * 1.13, s * 0.78, s * 0.17); }
  }
  if (part !== 'back') {
    ctx.fillStyle = '#ff9ec7'; ctx.beginPath(); ctx.moveTo(-s, -s * 1.15); ctx.lineTo(s, -s * 1.15); ctx.quadraticCurveTo(s * 0.92, 0, s * 0.55, 0); ctx.lineTo(-s * 0.55, 0); ctx.quadraticCurveTo(-s * 0.92, 0, -s, -s * 1.15); ctx.fill();
    ctx.fillStyle = '#ffc4dd'; ctx.beginPath(); ctx.ellipse(0, -s * 1.15, s * 1.14, s * 0.3, 0, 0, Math.PI); ctx.fill(); // передний край сиденья
    if (face) {
      ctx.fillStyle = '#5a2d4a'; circle(-s * 0.3, -s * 0.55, s * 0.11); circle(s * 0.3, -s * 0.55, s * 0.11);
      ctx.fillStyle = '#fff'; circle(-s * 0.27, -s * 0.59, s * 0.04); circle(s * 0.33, -s * 0.59, s * 0.04);
      ctx.strokeStyle = '#5a2d4a'; ctx.lineWidth = s * 0.08; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, -s * 0.42, s * 0.16, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
      ctx.fillStyle = 'rgba(255,90,140,0.45)'; ell(-s * 0.56, -s * 0.38, s * 0.14, s * 0.08); ell(s * 0.56, -s * 0.38, s * 0.14, s * 0.08);
    }
  }
  ctx.restore();
}

function drawPotty(L, i, h, hv) {
  const k = S, p = L.potties[i], R = h.room, s = 40 * k, b = pottyOf(h, i);
  if (hv) glowSpot(p.x, p.y - 40 * k, 90 * k, 0.6);
  ctx.fillStyle = 'rgba(80,40,20,0.15)'; ell(p.x, p.y + 2 * k, s * 1.1, 8 * k);
  const wob = R.potties[i].wob;
  ctx.save(); ctx.translate(p.x, p.y); drawPottyShape(s, wob, true, 'back', !b); ctx.restore();
  if (b) drawRoomBabyAt(b, b.ix, b.iy, false);
  ctx.save(); ctx.translate(p.x, p.y); drawPottyShape(s, wob, true, 'front'); ctx.restore();
  if (b && b.potty.done && b.potty.t < 4) { // звёздочки «молодец!»
    for (let j = 0; j < 3; j++) { const a = t * 3 + j * TAU / 3; ctx.save(); ctx.translate(p.x + Math.cos(a) * 55 * k, p.y - 40 * k + Math.sin(a) * 18 * k); ctx.fillStyle = '#ffe27a'; starPath(5, 8 * k, 3.5 * k); ctx.fill(); ctx.restore(); }
  }
}

function drawSink(L, h) {
  const k = S, s = L.sink, R = h.room;
  // зеркало
  ctx.fillStyle = '#fff'; circle(s.x, s.y - 175 * k, 44 * k);
  ctx.fillStyle = '#cfefff'; circle(s.x, s.y - 175 * k, 37 * k);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 5 * k; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(s.x - 18 * k, s.y - 190 * k); ctx.lineTo(s.x - 4 * k, s.y - 204 * k); ctx.stroke();
  ctx.save(); ctx.translate(s.x + 22 * k, s.y - 150 * k); ctx.rotate(t * 0.8); ctx.fillStyle = '#ffe27a'; starPath(4, 7 * k, 2.5 * k); ctx.fill(); ctx.restore();
  // ножка и раковина
  ctx.fillStyle = '#e8eef8'; ctx.beginPath(); ctx.roundRect(s.x - 13 * k, s.y - 70 * k, 26 * k, 70 * k, 8 * k); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(s.x, s.y - 78 * k, 50 * k, 26 * k, 0, 0, Math.PI); ctx.fill();
  ctx.fillStyle = '#dbe9f7'; ell(s.x, s.y - 80 * k, 50 * k, 11 * k);
  ctx.fillStyle = '#c9d3e8'; ctx.beginPath(); ctx.roundRect(s.x - 4 * k, s.y - 112 * k, 8 * k, 28 * k, 4 * k); ctx.fill();
  ctx.beginPath(); ctx.roundRect(s.x - 4 * k, s.y - 112 * k, 24 * k, 8 * k, 4 * k); ctx.fill();
  if (R.sink > 0) { ctx.fillStyle = 'rgba(150,215,255,0.8)'; ctx.fillRect(s.x + 12 * k, s.y - 104 * k, 6 * k, 24 * k); }
  // мыло-пузырёк
  ctx.fillStyle = '#c9a7ff'; ctx.beginPath(); ctx.roundRect(s.x - 40 * k, s.y - 104 * k, 18 * k, 24 * k, 5 * k); ctx.fill();
  ctx.fillStyle = '#9b7be0'; ctx.fillRect(s.x - 35 * k, s.y - 112 * k, 8 * k, 8 * k);
}

function drawTowel(L, h) {
  const k = S, w = L.towel, R = h.room, sw = Math.sin(t * 6) * 0.25 * R.towel;
  ctx.fillStyle = '#c9d3e8'; ctx.beginPath(); ctx.roundRect(w.x - 55 * k, w.y - 6 * k, 110 * k, 10 * k, 5 * k); ctx.fill();
  ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(sw);
  ctx.fillStyle = h.roof; ctx.beginPath(); ctx.roundRect(-42 * k, 0, 84 * k, 120 * k, [4 * k, 4 * k, 12 * k, 12 * k]); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(-42 * k, 85 * k, 84 * k, 8 * k); ctx.fillRect(-42 * k, 99 * k, 84 * k, 4 * k);
  ctx.fillStyle = '#fff'; ctx.translate(0, 45 * k); heartPath(12 * k);
  ctx.restore();
}

export function drawBathRoom(h) {
  const L = BL(), R = h.room, hv = hoverTarget(), wk = dragWish();
  drawRoomBg(L, h); drawWindow(L, h); drawTowel(L, h); drawSink(L, h); drawDoor(L, h, hv.door); drawLamp(L, h);
  if (wk === 'bath' && hv.tub == null && !(tubOf(h, 0) && tubOf(h, 1))) glowSpot(L.tub.x, L.tub.y - L.tub.h, L.tub.w * 0.7, hintA());
  if (wk === 'potty') L.potties.forEach((p, i) => { if (!pottyOf(h, i) && hv.potty !== i) glowSpot(p.x, p.y - 40 * S, 85 * S, hintA()); });
  const items = [{ y: L.tub.y, d: () => drawTub(L, h, hv.tub != null) }];
  L.potties.forEach((p, i) => items.push({ y: p.y, d: () => drawPotty(L, i, h, hv.potty === i) }));
  for (const b of h.occupants()) if (!b.tub && !b.potty && !b.dragged) items.push({ y: b.iy, d: () => drawRoomBaby(b) });
  items.sort((a, b) => a.y - b.y).forEach(it => it.d());
  drawBubbles(R); drawDark(L, R);
  for (const b of h.occupants()) if (b.dragged) drawRoomBaby(b);
}

export function hitBath(x, y) {
  const h = G.curHouse, R = h.room, L = BL(), k = S;
  for (let i = R.bubbles.length - 1; i >= 0; i--) { const q = R.bubbles[i]; if (dist(x, y, q.x, q.y) < q.r + 10 * k) return { k: 'bubble', o: i }; }
  const d = L.door; if (x > d.x && x < d.x + d.w && y > d.y && y < d.y + d.h) return { k: 'door' };
  if (R.duck.x && dist(x, y, R.duck.x, R.duck.y) < 34 * k) return { k: 'duck' };
  for (let i = 0; i < 2; i++) { const p = L.potties[i]; if (dist(x, y, p.x, p.y - 30 * k) < 52 * k) return { k: 'potty', o: i }; }
  const T = L.tub; if (Math.abs(x - T.x) < T.w / 2 && y > T.y - T.h - 95 * k && y < T.y + 10 * k) return { k: 'tub' };
  const s = L.sink; if (Math.abs(x - s.x) < 52 * k && y > s.y - 225 * k && y < s.y) return { k: 'sink' };
  const w = L.towel; if (Math.abs(x - w.x) < 55 * k && y > w.y - 10 * k && y < w.y + 125 * k) return { k: 'towel' };
  return null;
}

export function onBathTap(h, hres) {
  const R = h.room, L = BL(), k = S;
  switch (hres.k) {
    case 'duck': R.duck.hop = 1; sfx.squeak(); burst(R.duck.x, R.duck.y, 'heart', 5, { size: 8, speed: 90, up: -60, color: '#ffd84d' }); return true;
    case 'tub': R.faucet = 2.2; sfx.splash(); splashAt(L.tub.x, L.tub.y - L.tub.h, 12); return true;
    case 'potty': R.potties[hres.o].wob = 1; sfx.boing(); return true;
    case 'sink': R.sink = 2; sfx.splash(); return true;
    case 'towel': R.towel = 1; whoosh(0.4, 0.12); burst(L.towel.x, L.towel.y + 50 * k, 'spark', 6, { size: 6, speed: 90, color: '#fff' }); return true;
  }
  return false;
}

export function bathDropAt(h, L, x, y): any {
  const T = L.tub;
  if (Math.abs(x - T.x) < T.w / 2 + 10 * S && y > T.y - T.h - 170 * S && y < T.y + 10 * S) {
    const order = Math.abs(x - tubSlotX(L, 0)) < Math.abs(x - tubSlotX(L, 1)) ? [0, 1] : [1, 0];
    for (const i of order) if (!tubOf(h, i)) return { tub: i };
  }
  for (let i = 0; i < 2; i++) { const p = L.potties[i]; if (Math.abs(x - p.x) < 60 * S && y > p.y - 190 * S && y < p.y + 10 * S && !pottyOf(h, i)) return { potty: i }; }
  return {};
}

export function dropInBath(b, h, tg) {
  const R = h.room, L = BL();
  if (tg.tub != null) {
    b.tub = R.tubs[tg.tub]; b.splashT = 1.2; b.laugh = 1.5; b.bounce = 1;
    tickTub(b, 0, L); sfx.splash(); splashAt(b.ix, L.tub.y - L.tub.h, 14);
    satisfy(b, 'bath'); return true;
  }
  if (tg.potty != null) {
    b.potty = { i: tg.potty, t: 0, done: false }; R.potties[tg.potty].wob = 0.6; b.bounce = 1;
    tickPotty(b, 0, L); sfx.pick(); return true;
  }
  return false;
}

// значки: кнопка выбора здания, желания
export function drawBathIcon(s) {
  // ванночка с пеной и уточкой; s — радиус значка
  ctx.fillStyle = '#fff';
  for (const [x, y, r] of [[-0.42, -0.08, 0.2], [-0.15, -0.2, 0.25], [0.15, -0.16, 0.22], [0.42, -0.06, 0.18]]) circle(x * s, y * s, r * s);
  ctx.save(); ctx.translate(-s * 0.05, -s * 0.38); ctx.rotate(Math.sin(t * 3) * 0.12); drawToy('duck', s * 0.24); ctx.restore();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(-s * 0.62, -s * 0.05, s * 1.24, s * 0.52, [s * 0.08, s * 0.08, s * 0.26, s * 0.26]); ctx.fill();
  ctx.fillStyle = '#8fd3ff'; ctx.fillRect(-s * 0.5, s * 0.12, s, s * 0.07);
  ctx.fillStyle = '#ffd66b'; circle(-s * 0.4, s * 0.5, s * 0.08); circle(s * 0.4, s * 0.5, s * 0.08);
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; circle(s * 0.5, -s * 0.5, s * 0.08); circle(s * 0.3, -s * 0.62, s * 0.05);
}

export function drawPottyIcon(s) {
  // милый горшочек с личиком и сердечком
  ctx.save(); ctx.rotate(Math.sin(t * 2.5) * 0.08); ctx.translate(0, s * 0.58); drawPottyShape(s * 0.64, 0, true); ctx.restore();
  ctx.save(); ctx.translate(s * 0.6, -s * 0.52 + Math.sin(t * 3) * s * 0.04); ctx.fillStyle = '#ff5d8f'; heartPath(s * 0.14); ctx.restore();
  ctx.save(); ctx.translate(-s * 0.62, -s * 0.45); ctx.rotate(t); ctx.fillStyle = '#ffd66b'; starPath(4, s * 0.1, s * 0.04); ctx.fill(); ctx.restore();
}
