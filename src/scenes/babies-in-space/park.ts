import { tone, whoosh } from '../../core/audio';
import { H, S, TAU, W, clamp, ctx, dist, pick, rand, t } from '../../core/canvas';
import { circle, ell, heartPath, starPath } from '../../core/draw';
import { addP, burst } from '../../core/particles';
import { drawRoomBaby, drawRoomBabyAt } from './characters';
import { drawBubbles, dragWish, dragWishO, glowSpot, hintA, hoverTarget } from './room';
import { PENTA, sfx } from './sounds';
import { planet, smallStars } from './space';
import { G, RB, babies, houses } from './state';
import { satisfy } from './wishes';

// ---------------- ПЛАНЕТА: ДЕТСКАЯ ПЛОЩАДКА ----------------
// Планета — тоже «место», как дом: малыша кладут на планету — он на площадке; тап по горке на макушке — заходим.
// Места: качели (2 сиденья), горка, песочница, лужа, батут. Малыш на месте — b.spot = { k, i, t, … }.

export const PLACES = ['swing', 'slide', 'sand', 'puddle', 'tramp'];

/** «дом»-площадка: живёт на планете, в список зданий не входит */
export const park: any = {
  kind: 'park', roof: '#3fb39d', wall: '#bff3e2', door: 0, bounce: 0,
  get x() { return planet.x; }, get y() { return planet.y; },
  cy() { return planet.y - planet.r * 0.95; },
  occupants() { return babies.filter(b => b.home === park); },
  room: null as any,
};
park.room = {
  swings: [{ a: 0, ph: 0, amp: 0 }, { a: 0, ph: 1.5, amp: 0 }], slide: { wob: 0 }, cakes: [] as any[], bucket: 0,
  puddle: { rip: 0, frog: 0 }, tramp: { sag: 0, wob: 0 }, flowers: [0, 0, 0, 0, 0], burrow: 0, mini: [0, 0, 0],
  bubbles: [] as any[], light: true, starT: 0, doorOpen: 0, lampSwing: 0,
};

/** куда упал малыш в космосе: на планету (или на горку на её макушке) */
export function parkAt(x, y) {
  const P = planet;
  return dist(x, y, P.x, P.y) < P.r * 1.08 || dist(x, y, P.x, P.y - P.r * 1.05) < Math.max(P.r * 0.55, 42) ? park : null;
}
/** тап по горке на макушке планеты — зайти на площадку (тап по лицу — прежние реакции) */
export const parkDoorHit = (x, y) => dist(x, y, planet.x, planet.y - planet.r * 1.08) < Math.max(planet.r * 0.5, 40);

export function PL() {
  const k = S, port = H > W * 1.1, fy = port ? H * 0.36 : H * 0.42, gh = H - fy;
  const doorW = 125 * k, doorH = 235 * k;
  const door = { x: Math.max(16, W * 0.04), y: fy + 60 * k - doorH, w: doorW, h: doorH };
  const L: any = { fy, door, port, bx0: door.x + doorW + 30 * k, bx1: W - 40 * k, by0: fy + 80 * k, by1: H - 25 * k };
  if (port) {
    const y1 = fy + gh * 0.22, y2 = fy + gh * 0.56, y3 = H - gh * 0.06;
    Object.assign(L, {
      swing: { x: W * 0.6, y: y1 }, burrow: { x: W * 0.9, y: fy + 30 * k }, slide: { x: W * 0.36, y: y2 }, tramp: { x: W * 0.78, y: y2 },
      sand: { x: W * 0.28, y: y3 }, puddle: { x: W * 0.74, y: y3 }, flowers: [0.33, 0.45, 0.8, 0.52, 0.12].map((f, i) => ({ x: W * f, y: fy + (i < 3 ? 22 : gh * 0.36 / k) * k })),
    });
  } else {
    const y1 = fy + gh * 0.27, y3 = H - gh * 0.08;
    Object.assign(L, {
      swing: { x: W * 0.33, y: y1 }, slide: { x: W * 0.62, y: y1 }, burrow: { x: W * 0.88, y: fy + 35 * k },
      sand: { x: W * 0.2, y: y3 }, puddle: { x: W * 0.5, y: y3 }, tramp: { x: W * 0.8, y: y3 },
      flowers: [0.17, 0.47, 0.76, 0.95, 0.35].map((f, i) => ({ x: W * f, y: fy + (i < 4 ? 20 : gh * 0.55 / k) * k })),
    });
  }
  return L;
}

// геометрия мест
const SW_LEN = 150, SW_DX = 62, SW_TOP = 228;
const pivot = (L, i) => [L.swing.x + (i ? 1 : -1) * SW_DX * S, L.swing.y - SW_TOP * S];
function chute(L, u) { // горка: квадратичная кривая сверху вниз
  const s = L.slide, k = S, x0 = s.x - 70 * k, y0 = s.y - 200 * k, x1 = s.x + 5 * k, y1 = s.y - 10 * k, x2 = s.x + 135 * k, y2 = s.y - 22 * k;
  const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
  return [a * x0 + b * x1 + c * x2, a * y0 + b * y1 + c * y2];
}
const sandSlot = (L, i) => [L.sand.x + (i ? 1 : -1) * 58 * S, L.sand.y - 26 * S];
export const spotOf = (h, k, i = 0) => h.occupants().find(b => b.spot && b.spot.k === k && (b.spot.i || 0) === i && !b.dragged);
const free = (b) => { b.spot = null; b.pose = null; b.iwT = 1.5; b.bounce = 1; };

// ---------------- ЖИЗНЬ НА МЕСТАХ ----------------
export function tickSpot(b, dt, L) {
  const P = b.spot, r = RB(), R = park.room, vis = b.visible(), k = S;
  P.t += dt;
  switch (P.k) {
    case 'swing': { // качается; ножки вперёд-назад
      const sw = R.swings[P.i], [px, py] = pivot(L, P.i), L0 = SW_LEN * k;
      b.ix = px + Math.sin(sw.a) * L0; b.iy = py + Math.cos(sw.a) * L0 + r * 0.25; b.face = 1;
      const v = Math.cos(sw.ph);
      b.pose = { mood: sw.amp > 0.45 ? 'laugh' : undefined, lean: -sw.a, armL: 0.9, armR: 0.9, legL: v * 0.5 * sw.amp, legR: v * 0.5 * sw.amp };
      if (sw.amp > 0.5 && Math.abs(Math.sin(sw.ph)) > 0.97 && (P.top ?? 0) < t - 0.5) { P.top = t; b.laugh = 0.8; if (vis && Math.random() < 0.5) sfx.giggle(1.2); }
      return;
    }
    case 'slide': return tickSlide(b, dt, L);
    case 'sand': { // лепит куличики
      const [sx, sy] = sandSlot(L, P.i); b.ix = sx; b.iy = sy; b.face = P.i ? -1 : 1;
      const pat = Math.abs(Math.sin(P.t * 7));
      b.pose = { armR: 0.2 + pat * 0.9, armL: 0.3, dy: -pat * 2 * k, legL: 0.9, legR: 0.9 };
      P.c = (P.c ?? 1.6) - dt;
      if (P.c <= 0) {
        P.c = rand(2.4, 3.4);
        const mine = R.cakes.filter(c => c.i === P.i);
        if (mine.length < 3) {
          // свои места для куличиков у каждого: сзади слева/справа и спереди
          const slot = [0, 1, 2].find(j => !mine.some(c => c.j === j)), [dx, dy] = [[-100, -50], [-18, -50], [-62, -6]][slot];
          const cx = L.sand.x + (P.i ? -dx : dx) * k;
          R.cakes.push({ i: P.i, j: slot, x: cx, y: L.sand.y + dy * k, pop: 1, c: pick(['#ff9ec7', '#8fd3ff', '#ffd66b', '#a8e6a1']) });
          if (vis) { sfx.pat(); burst(cx, sy, 'spark', 6, { size: 5, speed: 80, color: '#f3d79a' }); b.laugh = 0.6; }
        }
      }
      return;
    }
    case 'puddle': { // прыгает по луже: плюх-плюх, пачкается
      const p = L.puddle, J = 0.65; b.ix = p.x + (P.i ? 1 : -1) * 30 * k; b.iy = p.y; b.face = 1;
      const n = Math.floor(P.t / J), q = (P.t % J) / J;
      if (n < 4) {
        b.pose = { dy: -Math.sin(q * Math.PI) * 42 * k, mood: 'laugh', armL: 1.6, armR: 1.6 };
        if (n > (P.n ?? -1)) {
          P.n = n;
          if (n > 0) { b.mud = Math.min(1, (b.mud || 0) + 0.3); R.puddle.rip = 1; if (vis) { sfx.splash(); splash(b.ix, p.y, 12, '#9ed8ff'); splash(b.ix, p.y, 5, '#b98a5a'); } }
        }
      } else b.pose = { mood: 'laugh', armL: 1.9 + Math.sin(t * 14) * 0.3, armR: 1.9 + Math.sin(t * 14 + 1) * 0.3 };
      if (P.t > 4 * J + 1.4) { free(b); b.ix = p.x - 110 * k; b.iy = clamp(p.y - 20 * k, L.by0, L.by1); if (vis) sfx.boop(); }
      return;
    }
    case 'tramp': { // батут: медленно и высоко, как на Луне
      const T = L.tramp, D = P.big ? 1.9 : 1.5, H0 = (P.big ? 210 : 120) * k;
      b.ix = T.x; b.face = 1;
      P.q = (P.q ?? 0) + dt / D;
      if (P.q >= 1) { P.q -= 1; P.big = false; R.tramp.sag = 1; if (vis) tone(160, 0.25, { type: 'sine', slide: 320, vol: 0.14 }); }
      const h = Math.sin(P.q * Math.PI) * H0;
      b.iy = T.y - 30 * k;
      b.pose = { dy: -h, mood: h > 30 * k ? 'laugh' : undefined, armL: 1.2 + h / H0, armR: 1.2 + h / H0, lean: P.flip ? P.q * TAU : 0 };
      if (P.flip && P.q > 0.95) P.flip = false;
      return;
    }
  }
}

function tickSlide(b, dt, L) {
  const P = b.spot, r = RB(), k = S, vis = b.visible(), s = L.slide;
  P.ph = P.ph || 'top';
  const go = (ph) => { P.ph = ph; P.t = 0; };
  if (P.ph === 'top') {
    [b.ix, b.iy] = chute(L, 0); b.iy += r * 0.2; b.face = 1;
    b.pose = { dy: -Math.abs(Math.sin(P.t * 9)) * 3 * k, armL: 1.6, armR: 1.6, mood: 'laugh' };
    if (P.t > 0.55) { go('down'); if (vis) sfx.wheee(); }
  } else if (P.ph === 'down') {
    const u = Math.min(1, Math.pow(P.t / 0.95, 1.5));
    [b.ix, b.iy] = chute(L, u); b.iy += r * 0.2;
    b.pose = { mood: 'laugh', armL: 2.1, armR: 2.1, lean: 0.25 - u * 0.25, legL: 0.6, legR: 0.6 };
    if (vis && Math.random() < 0.5) addP({ kind: 'spark', x: b.ix - 20 * k, y: b.iy - r, vx: -rand(30, 80) * k, vy: -rand(10, 50) * k, life: 0.5, size: rand(4, 7) * k, color: pick(['#ffe27a', '#fff', '#ffb3d1']), rot: 0, vr: 3, g: 0 });
    if (P.t > 0.95) { go('land'); b.bounce = 1; b.laugh = 1.5; P.n = (P.n || 0) + 1; if (vis) { sfx.giggle(1.1); burst(b.ix, b.iy - r, 'heart', 6, { size: 8, speed: 110, up: -60, color: '#ff7aa8' }); } }
  } else if (P.ph === 'land') {
    b.pose = { mood: 'laugh', armL: 1.9 + Math.sin(t * 14) * 0.3, armR: 1.9 + Math.sin(t * 14 + 1) * 0.3 };
    if (P.t > 0.8) {
      if (P.n < 3) go('walk'); // ещё раз! (до трёх раз)
      else { free(b); b.ix = clamp(b.ix + 40 * k, L.bx0, L.bx1); b.iy = clamp(s.y + 10 * k, L.by0, L.by1); }
    }
  } else if (P.ph === 'walk') { // ползёт обратно к лесенке
    const lx = s.x - 112 * k, [ex] = chute(L, 1), u = Math.min(1, P.t / 1.4);
    b.ix = ex + (lx - ex) * u; b.iy = s.y + 6 * k; b.face = -1; b.pose = null;
    if (u >= 1) go('climb');
  } else if (P.ph === 'climb') { // лезет вверх по лесенке
    const u = Math.min(1, P.t / 1.1), lx = s.x - 105 * k, [tx, ty] = chute(L, 0);
    b.ix = lx + (tx - lx) * Math.max(0, u - 0.7) / 0.3; b.iy = s.y + 6 * k + (ty + r * 0.2 - s.y - 6 * k) * u; b.face = 1;
    const c = Math.sin(P.t * 12);
    b.pose = { armL: 1.4 + c * 0.4, armR: 1.4 - c * 0.4, legL: c * 0.3, legR: -c * 0.3 };
    if (vis && Math.floor(P.t * 6) !== P.st) { P.st = Math.floor(P.t * 6); if (P.st % 2 === 0) tone(700 + u * 500, 0.06, { type: 'triangle', vol: 0.05 }); }
    if (u >= 1) go('top');
  }
}

function splash(x, y, n, col) {
  for (let i = 0; i < n; i++) addP({ kind: 'spark', x: x + rand(-25, 25) * S, y, vx: rand(-120, 120) * S, vy: -rand(140, 300) * S, life: rand(0.5, 0.9), size: rand(4, 7) * S, color: Math.random() < 0.5 ? col : '#fff', rot: rand(0, TAU), vr: rand(-6, 6), g: 700 });
}

export function updatePark(dt, h) {
  const R = h.room;
  for (let i = 0; i < 2; i++) {
    const sw = R.swings[i], on = spotOf(h, 'swing', i);
    sw.amp += ((on ? Math.max(0.32, sw.amp) : 0) - sw.amp) * Math.min(1, dt * (on ? 0.15 : 0.6));
    sw.ph += dt * 2.3; sw.a = Math.sin(sw.ph) * sw.amp;
  }
  R.slide.wob = Math.max(0, R.slide.wob - dt * 1.5); R.bucket = Math.max(0, R.bucket - dt * 1.4);
  R.puddle.rip = Math.max(0, R.puddle.rip - dt * 0.8); R.puddle.frog = Math.max(0, R.puddle.frog - dt);
  R.tramp.sag = Math.max(0, R.tramp.sag - dt * 3); R.tramp.wob = Math.max(0, R.tramp.wob - dt * 1.5);
  R.burrow = Math.max(0, R.burrow - dt);
  for (let i = 0; i < R.flowers.length; i++) R.flowers[i] = Math.max(0, R.flowers[i] - dt * 0.8);
  for (let i = 0; i < R.mini.length; i++) R.mini[i] = Math.max(0, R.mini[i] - dt * 1.2);
  for (const c of R.cakes) c.pop = Math.max(0, c.pop - dt * 3);
}

// ---------------- РИСОВАНИЕ ----------------
function drawSky(L) {
  const k = S, fy = L.fy, n = G.night;
  const g = ctx.createLinearGradient(0, 0, 0, fy); g.addColorStop(0, '#1a1450'); g.addColorStop(1, '#5b4bb7'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, fy + 40 * k);
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 70; i++) { const s = smallStars[i]; ctx.globalAlpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph)); circle(s.fx * W, s.fy * fy * 0.9, s.s * k); }
  ctx.globalAlpha = 1;
  // наши дома летают в небе — маленькие
  const R = park.room;
  houses.slice(0, 3).forEach((h, i) => {
    const [x, y] = miniXY(L, i), hop = Math.abs(Math.sin(R.mini[i] * Math.PI * 3)) * 16 * k;
    ctx.save(); ctx.translate(x, y - hop + Math.sin(t * 1.5 + i) * 4 * k); ctx.rotate(Math.sin(t + i) * 0.06);
    ctx.fillStyle = '#ffe27a'; ell(-8 * k, 26 * k, 4 * k, 7 * k * (1 + Math.sin(t * 30) * 0.2)); ell(8 * k, 26 * k, 4 * k, 7 * k * (1 + Math.sin(t * 30 + 1) * 0.2));
    ctx.fillStyle = h.wall; ctx.fillRect(-18 * k, -8 * k, 36 * k, 30 * k);
    ctx.fillStyle = h.roof; ctx.beginPath(); ctx.moveTo(-24 * k, -6 * k); ctx.lineTo(0, -28 * k); ctx.lineTo(24 * k, -6 * k); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff3b0'; ctx.fillRect(-11 * k, 0, 9 * k, 9 * k); ctx.fillRect(3 * k, 0, 9 * k, 9 * k);
    ctx.restore();
  });
  if (n > 0.01) { ctx.fillStyle = `rgba(5,3,25,${n * 0.3})`; ctx.fillRect(0, 0, W, fy); }
}
const miniXY = (L, i) => [W * (L.port ? 0.3 + i * 0.25 : 0.42 + i * 0.16), L.fy * (L.port ? 0.32 + (i % 2) * 0.14 : 0.3 + (i % 2) * 0.2)];

function drawGround(L) {
  const k = S, fy = L.fy;
  // поверхность маленькой планеты — край чуть изогнут
  ctx.fillStyle = '#8fe3c8'; ctx.beginPath(); ctx.moveTo(0, fy + 18 * k); ctx.quadraticCurveTo(W / 2, fy - 22 * k, W, fy + 18 * k); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  const g = ctx.createLinearGradient(0, fy, 0, H); g.addColorStop(0, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(30,110,110,0.18)'); ctx.fillStyle = g; ctx.fill();
  ctx.fillStyle = 'rgba(200,255,220,0.45)';
  for (let i = 0; i < 9; i++) { const s = smallStars[100 + i]; ell(s.fx * W, fy + 40 * k + s.fy * (H - fy - 50 * k), (30 + s.s * 30) * k, (8 + s.s * 6) * k); }
  ctx.strokeStyle = 'rgba(60,160,130,0.5)'; ctx.lineWidth = 3 * k; ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) { const s = smallStars[120 + i], x = s.fx * W, y = fy + 30 * k + s.fy * (H - fy - 40 * k), sw = Math.sin(t * 2 + i) * 2 * k; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4 * k + sw, y - 10 * k); ctx.moveTo(x + 4 * k, y); ctx.lineTo(x + 7 * k + sw, y - 9 * k); ctx.stroke(); }
}

function drawGate(L, hover) {
  // ворота-портал: радуга над звёздным проходом — туда, в космос
  const k = S, d = L.door, R = park.room, cx = d.x + d.w / 2;
  if (hover) glowSpot(cx, d.y + d.h / 2, d.h * 0.8, 0.6);
  ctx.save(); ctx.beginPath(); ctx.roundRect(d.x, d.y, d.w, d.h, [d.w / 2, d.w / 2, 0, 0]); ctx.clip();
  ctx.fillStyle = '#1a1450'; ctx.fillRect(d.x, d.y, d.w, d.h);
  ctx.fillStyle = '#fff'; for (let i = 0; i < 14; i++) { const s = smallStars[60 + i]; circle(d.x + s.fx * d.w, d.y + s.fy * d.h, s.s * 1.3 * k); }
  const sw = (t * 0.6 + R.doorOpen) % 1; ctx.strokeStyle = 'rgba(180,160,255,0.5)'; ctx.lineWidth = 4 * k; ctx.beginPath(); ctx.arc(cx, d.y + d.h * 0.55, d.w * 0.5 * sw, 0, TAU); ctx.stroke();
  ctx.restore();
  ['#ff6b6b', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff'].forEach((c, i) => {
    ctx.strokeStyle = c; ctx.lineWidth = 7 * k; ctx.beginPath();
    const rr = d.w / 2 + (4 + i * 7) * k; ctx.moveTo(cx - rr, d.y + d.h); ctx.lineTo(cx - rr, d.y + d.w / 2); ctx.arc(cx, d.y + d.w / 2, rr, Math.PI, TAU); ctx.lineTo(cx + rr, d.y + d.h); ctx.stroke();
  });
  // мини-кнопка-ракетка над воротами — «в космос»
  const py = d.y - 50 * k + Math.sin(t * 2) * 3 * k;
  ctx.fillStyle = '#5fcab6'; circle(cx, py, 15 * k);
  ctx.strokeStyle = '#ffd66b'; ctx.lineWidth = 4 * k; ctx.beginPath(); ctx.ellipse(cx, py, 26 * k, 7 * k, -0.3, 0, TAU); ctx.stroke();
}

function drawSwing(L, h, hv) {
  const k = S, s = L.swing, R = h.room, top = s.y - SW_TOP * k - 4 * k;
  if (hv != null) glowSpot(s.x + (hv ? 1 : -1) * SW_DX * k, s.y - 70 * k, 80 * k, 0.6);
  ctx.fillStyle = 'rgba(30,90,80,0.18)'; ell(s.x, s.y + 2 * k, 145 * k, 10 * k);
  ctx.strokeStyle = '#ff7aa8'; ctx.lineWidth = 11 * k; ctx.lineCap = 'round';
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s.x + sx * 140 * k, s.y); ctx.lineTo(s.x + sx * 112 * k, top); ctx.moveTo(s.x + sx * 84 * k, s.y); ctx.lineTo(s.x + sx * 112 * k, top); ctx.stroke(); }
  ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 13 * k; ctx.beginPath(); ctx.moveTo(s.x - 125 * k, top); ctx.lineTo(s.x + 125 * k, top); ctx.stroke();
  ctx.fillStyle = '#fff'; circle(s.x - 125 * k, top, 7 * k); circle(s.x + 125 * k, top, 7 * k);
  for (let i = 0; i < 2; i++) {
    const [px, py] = pivot(L, i), sw = R.swings[i], b = spotOf(h, 'swing', i);
    ctx.save(); ctx.translate(px, py); ctx.rotate(-sw.a);
    ctx.strokeStyle = '#c9d3e8'; ctx.lineWidth = 3.5 * k;
    ctx.beginPath(); ctx.moveTo(-30 * k, 0); ctx.lineTo(-30 * k, SW_LEN * k); ctx.moveTo(30 * k, 0); ctx.lineTo(30 * k, SW_LEN * k); ctx.stroke();
    ctx.fillStyle = i ? '#4cc9f0' : '#06d6a0'; ctx.beginPath(); ctx.roundRect(-38 * k, SW_LEN * k - 4 * k, 76 * k, 12 * k, 6 * k); ctx.fill();
    ctx.restore();
    if (b) drawRoomBabyAt(b, b.ix, b.iy, false);
  }
}

function drawSlide(L, h, hv) {
  const k = S, s = L.slide, R = h.room, wob = Math.sin(R.slide.wob * 20) * R.slide.wob * 4 * k;
  if (hv) glowSpot(s.x, s.y - 100 * k, 150 * k, 0.6);
  ctx.fillStyle = 'rgba(30,90,80,0.18)'; ell(s.x + 20 * k, s.y + 2 * k, 150 * k, 10 * k);
  // лесенка
  const lx = s.x - 112 * k, [tx, ty] = chute(L, 0);
  ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 8 * k; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(lx - 14 * k, s.y); ctx.lineTo(tx - 22 * k, ty + 6 * k); ctx.moveTo(lx + 14 * k, s.y); ctx.lineTo(tx + 6 * k, ty + 6 * k); ctx.stroke();
  ctx.lineWidth = 5 * k; for (let i = 1; i < 5; i++) { const u = i / 5, x = lx + (tx - 8 * k - lx) * u, y = s.y + (ty + 6 * k - s.y) * u; ctx.beginPath(); ctx.moveTo(x - 14 * k, y); ctx.lineTo(x + 14 * k, y); ctx.stroke(); }
  // площадка наверху с флажком
  ctx.fillStyle = '#b388ff'; ctx.beginPath(); ctx.roundRect(tx - 30 * k, ty + 2 * k, 40 * k, 10 * k, 4 * k); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 * k; ctx.beginPath(); ctx.moveTo(tx - 26 * k, ty + 2 * k); ctx.lineTo(tx - 26 * k, ty - 50 * k); ctx.stroke();
  ctx.fillStyle = '#ff6b6b'; ctx.beginPath(); ctx.moveTo(tx - 26 * k, ty - 50 * k); ctx.lineTo(tx - 26 * k + (22 + Math.sin(t * 5) * 3) * k, ty - 43 * k); ctx.lineTo(tx - 26 * k, ty - 36 * k); ctx.fill();
  // опора и скат
  const [mx, my] = chute(L, 0.55);
  ctx.strokeStyle = '#8a7ac9'; ctx.lineWidth = 7 * k; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx, s.y); ctx.stroke();
  ctx.save(); ctx.translate(0, wob);
  for (const [w, c] of [[30, '#ff9ec7'], [18, '#ffc4dd']] as [number, string][]) {
    ctx.strokeStyle = c; ctx.lineWidth = w * k; ctx.beginPath();
    for (let i = 0; i <= 20; i++) { const [x, y] = chute(L, i / 20); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
  }
  ctx.restore();
  const b = spotOf(h, 'slide'); if (b) drawRoomBabyAt(b, b.ix, b.iy, b.spot.ph === 'walk' || b.spot.ph === 'land');
}

function drawSand(L, h, hv, part) {
  const k = S, s = L.sand, R = h.room, w = 240 * k, d = 70 * k;
  if (part === 'back') {
    if (hv != null) glowSpot(s.x, s.y - 30 * k, 140 * k, 0.6);
    ctx.fillStyle = '#c98b5a'; ctx.beginPath(); ctx.roundRect(s.x - w / 2 - 8 * k, s.y - d - 8 * k, w + 16 * k, d + 16 * k, 14 * k); ctx.fill();
    ctx.fillStyle = '#f3d79a'; ctx.beginPath(); ctx.roundRect(s.x - w / 2, s.y - d, w, d, 10 * k); ctx.fill();
    ctx.fillStyle = 'rgba(200,150,80,0.3)'; for (let i = 0; i < 12; i++) { const q = smallStars[30 + i]; circle(s.x - w / 2 + q.fx * w, s.y - d + q.fy * d, 2 * k); }
    // ведёрко и лопатка
    const bh = Math.abs(Math.sin(R.bucket * Math.PI * 3)) * 18 * k, bx = s.x + w / 2 - 22 * k, by = s.y - d + 22 * k - bh;
    ctx.fillStyle = '#4cc9f0'; ctx.beginPath(); ctx.moveTo(bx - 14 * k, by - 18 * k); ctx.lineTo(bx + 14 * k, by - 18 * k); ctx.lineTo(bx + 10 * k, by + 4 * k); ctx.lineTo(bx - 10 * k, by + 4 * k); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2a8fb8'; ctx.lineWidth = 2.5 * k; ctx.beginPath(); ctx.arc(bx, by - 18 * k, 13 * k, Math.PI, TAU); ctx.stroke();
    ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 4 * k; ctx.beginPath(); ctx.moveTo(s.x - w / 2 + 16 * k, s.y - d + 12 * k); ctx.lineTo(s.x - w / 2 + 40 * k, s.y - d + 30 * k); ctx.stroke();
    ctx.fillStyle = '#ff6b6b'; ell(s.x - w / 2 + 44 * k, s.y - d + 34 * k, 9 * k, 6 * k, 0.6);
    for (const c of R.cakes) drawCake(c);
  } else {
    ctx.fillStyle = '#b07848'; ctx.beginPath(); ctx.roundRect(s.x - w / 2 - 8 * k, s.y - 4 * k, w + 16 * k, 14 * k, 6 * k); ctx.fill();
    ctx.fillStyle = '#ffd166'; for (const dx of [-1, 1]) circle(s.x + dx * (w / 2 + 2 * k), s.y + 3 * k, 8 * k);
  }
}
function drawCake(c) {
  const k = S * 1.5, sc = 1 + c.pop * 0.4;
  ctx.save(); ctx.translate(c.x, c.y); ctx.scale(sc, 2 - sc);
  ctx.fillStyle = '#e8c27a'; ctx.beginPath(); ctx.moveTo(-14 * k, 0); ctx.lineTo(-10 * k, -20 * k); ctx.lineTo(10 * k, -20 * k); ctx.lineTo(14 * k, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(180,130,60,0.35)'; ctx.fillRect(-12 * k, -9 * k, 24 * k, 3 * k);
  ctx.fillStyle = c.c; ctx.save(); ctx.translate(0, -25 * k); starPath(5, 6 * k, 2.6 * k); ctx.fill(); ctx.restore();
  ctx.restore();
}

function drawPuddle(L, h, hv) {
  const k = S, p = L.puddle, R = h.room;
  if (hv) glowSpot(p.x, p.y - 20 * k, 120 * k, 0.6);
  ctx.fillStyle = '#7fc4ea'; ell(p.x, p.y, 100 * k, 26 * k);
  ctx.fillStyle = '#a9dcf7'; ell(p.x - 10 * k, p.y - 3 * k, 80 * k, 17 * k);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ell(p.x - 40 * k, p.y - 7 * k, 18 * k, 4 * k);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2.5 * k;
  for (let i = 0; i < 3; i++) { const q = ((t * 0.7 + i / 3) % 1); if (R.puddle.rip <= 0 && i) continue; ctx.globalAlpha = (1 - q) * (R.puddle.rip > 0 ? 1 : 0.4); ctx.beginPath(); ctx.ellipse(p.x + 20 * k, p.y, 20 * k + q * 60 * k, 5 * k + q * 14 * k, 0, 0, TAU); ctx.stroke(); }
  ctx.globalAlpha = 1;
  // лягушонок выглядывает из-за края
  if (R.puddle.frog > 0) {
    const up = Math.sin(clamp(1 - R.puddle.frog / 2, 0, 1) * Math.PI) * 22 * k, fx = p.x + 78 * k, fy = p.y - up;
    ctx.save(); ctx.beginPath(); ctx.rect(fx - 40 * k, fy - 60 * k, 80 * k, p.y - fy + 60 * k); ctx.clip();
    ctx.fillStyle = '#5cc96b'; ell(fx, fy + 6 * k, 20 * k, 14 * k); circle(fx - 9 * k, fy - 6 * k, 8 * k); circle(fx + 9 * k, fy - 6 * k, 8 * k);
    ctx.fillStyle = '#fff'; circle(fx - 9 * k, fy - 7 * k, 5 * k); circle(fx + 9 * k, fy - 7 * k, 5 * k);
    ctx.fillStyle = '#1f3b2d'; circle(fx - 8 * k, fy - 7 * k, 2.5 * k); circle(fx + 10 * k, fy - 7 * k, 2.5 * k);
    ctx.strokeStyle = '#2a7a3a'; ctx.lineWidth = 2 * k; ctx.beginPath(); ctx.arc(fx, fy + 3 * k, 8 * k, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    ctx.restore();
  }
}

function drawTramp(L, h, hv) {
  const k = S, T = L.tramp, R = h.room, sag = R.tramp.sag * 14 * k + Math.sin(R.tramp.wob * 20) * R.tramp.wob * 5 * k;
  if (hv) glowSpot(T.x, T.y - 40 * k, 110 * k, 0.6);
  ctx.fillStyle = 'rgba(30,90,80,0.18)'; ell(T.x, T.y + 2 * k, 95 * k, 10 * k);
  ctx.strokeStyle = '#8a7ac9'; ctx.lineWidth = 6 * k; ctx.lineCap = 'round';
  for (const dx of [-60, -20, 20, 60]) { ctx.beginPath(); ctx.moveTo(T.x + dx * k, T.y - 30 * k); ctx.lineTo(T.x + dx * 1.15 * k, T.y); ctx.stroke(); }
  ctx.fillStyle = '#2a2470'; ctx.beginPath(); ctx.ellipse(T.x, T.y - 30 * k + sag * 0.5, 80 * k, 18 * k + sag * 0.5, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 9 * k; ctx.beginPath(); ctx.ellipse(T.x, T.y - 30 * k, 84 * k, 20 * k, 0, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#ff7aa8'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; circle(T.x + Math.cos(a) * 84 * k, T.y - 30 * k + Math.sin(a) * 20 * k, 4.5 * k); }
  ctx.fillStyle = '#fff'; ctx.save(); ctx.translate(T.x, T.y - 30 * k + sag * 0.5); ctx.scale(1, 0.3); starPath(5, 22 * k, 9 * k); ctx.fill(); ctx.restore();
  const b = spotOf(h, 'tramp'); if (b) drawRoomBabyAt(b, b.ix, b.iy, false);
}

function drawFlower(f, i, R) {
  const k = S, p = R.flowers[i], s = (1 + p * 0.5) * k, cols = ['#ff7aa8', '#ffd166', '#b388ff', '#4cc9f0', '#ff9f43'];
  ctx.strokeStyle = '#3fa36a'; ctx.lineWidth = 4 * k; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.quadraticCurveTo(f.x + Math.sin(t * 1.5 + i) * 6 * k, f.y - 18 * k, f.x, f.y - 34 * k); ctx.stroke();
  ctx.fillStyle = '#5cc96b'; ell(f.x + 7 * k, f.y - 12 * k, 8 * k, 4 * k, -0.5);
  ctx.save(); ctx.translate(f.x, f.y - 36 * k); ctx.rotate(p * TAU + Math.sin(t + i) * 0.1); ctx.fillStyle = cols[i % 5];
  for (let j = 0; j < 5; j++) { const a = j / 5 * TAU; circle(Math.cos(a) * 9 * s, Math.sin(a) * 9 * s, 7 * s); }
  ctx.fillStyle = '#fff3b0'; circle(0, 0, 6 * s);
  ctx.fillStyle = '#5a2d4a'; circle(-2.2 * s, -1 * s, 1.2 * s); circle(2.2 * s, -1 * s, 1.2 * s);
  ctx.restore();
}

function drawBurrow(L, R) {
  // норка: из неё выглядывает зелёный соседик
  const k = S, b = L.burrow;
  ctx.fillStyle = '#6cc9ad'; ell(b.x, b.y, 42 * k, 16 * k);
  ctx.fillStyle = '#2a5a55'; ell(b.x, b.y - 2 * k, 26 * k, 9 * k);
  if (R.burrow > 0) {
    const up = Math.sin(clamp(1 - R.burrow / 2.2, 0, 1) * Math.PI) * 40 * k, a = 14 * k;
    ctx.save(); ctx.beginPath(); ctx.rect(b.x - 40 * k, b.y - 90 * k, 80 * k, 88 * k); ctx.clip();
    ctx.translate(b.x, b.y + 12 * k - up);
    ctx.strokeStyle = '#7be08a'; ctx.lineWidth = a * 0.15; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-a * 0.4, -a * 0.8); ctx.lineTo(-a * 0.7, -a * 1.5); ctx.moveTo(a * 0.4, -a * 0.8); ctx.lineTo(a * 0.7, -a * 1.5); ctx.stroke();
    ctx.fillStyle = '#ffd66b'; circle(-a * 0.7, -a * 1.5, a * 0.17); circle(a * 0.7, -a * 1.5, a * 0.17);
    ctx.fillStyle = '#7be08a'; circle(0, 0, a); ctx.fillStyle = '#fff'; circle(0, -a * 0.1, a * 0.45); ctx.fillStyle = '#2a1b3d'; circle(0, -a * 0.05, a * 0.25);
    ctx.strokeStyle = '#2a7a3a'; ctx.lineWidth = a * 0.1; ctx.beginPath(); ctx.arc(0, a * 0.35, a * 0.25, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = '#6cc9ad'; ctx.beginPath(); ctx.ellipse(b.x, b.y, 42 * k, 16 * k, 0, 0, Math.PI); ctx.fill();
}

export function drawPark(h) {
  const L = PL(), R = h.room, hv = hoverTarget(), wk = dragWish(), wo = dragWishO();
  drawSky(L); drawGround(L); drawGate(L, hv.door);
  if (wk === 'walk') for (const k of PLACES) if ((!wo || wo === k) && placeFree(h, k) && hv.spot !== k) { const [x, y, r] = placeCenter(L, k); glowSpot(x, y, r, hintA()); }
  const sh = (k) => hv.spot === k ? (hv.i ?? true) : null;
  const items: any[] = [
    { y: L.swing.y, d: () => drawSwing(L, h, sh('swing')) },
    { y: L.slide.y, d: () => drawSlide(L, h, sh('slide')) },
    { y: L.sand.y - 60 * S, d: () => drawSand(L, h, sh('sand'), 'back') },
    { y: L.sand.y + 1, d: () => drawSand(L, h, null, 'front') },
    { y: L.puddle.y - 30 * S, d: () => drawPuddle(L, h, sh('puddle')) },
    { y: L.tramp.y, d: () => drawTramp(L, h, sh('tramp')) },
    { y: L.burrow.y, d: () => drawBurrow(L, R) },
  ];
  L.flowers.forEach((f, i) => items.push({ y: f.y, d: () => drawFlower(f, i, R) }));
  for (const b of h.occupants()) if (!b.dragged && (!b.spot || b.spot.k === 'sand' || b.spot.k === 'puddle')) items.push({ y: b.spot && b.spot.k === 'sand' ? L.sand.y : b.iy, d: () => drawRoomBaby(b) });
  items.sort((a, b) => a.y - b.y).forEach(it => it.d());
  drawBubbles(R);
  if (G.night > 0.01) { ctx.fillStyle = `rgba(10,5,40,${G.night * 0.35})`; ctx.fillRect(0, 0, W, H); }
  for (const b of h.occupants()) if (b.dragged) drawRoomBaby(b);
}

function placeFree(h, k) {
  if (k === 'swing') return !spotOf(h, 'swing', 0) || !spotOf(h, 'swing', 1);
  if (k === 'sand') return !spotOf(h, 'sand', 0) || !spotOf(h, 'sand', 1);
  return !spotOf(h, k);
}
function placeCenter(L, k): [number, number, number] {
  const s = S;
  return k === 'swing' ? [L.swing.x, L.swing.y - 80 * s, 150 * s] : k === 'slide' ? [L.slide.x, L.slide.y - 100 * s, 150 * s]
    : k === 'sand' ? [L.sand.x, L.sand.y - 35 * s, 140 * s] : k === 'puddle' ? [L.puddle.x, L.puddle.y - 10 * s, 115 * s] : [L.tramp.x, L.tramp.y - 35 * s, 110 * s];
}

// ---------------- ТАПЫ И ПЕРЕТАСКИВАНИЕ ----------------
export function hitPark(x, y) {
  const h = park, R = h.room, L = PL(), k = S;
  for (let i = R.bubbles.length - 1; i >= 0; i--) { const q = R.bubbles[i]; if (dist(x, y, q.x, q.y) < q.r + 10 * k) return { k: 'bubble', o: i }; }
  const d = L.door; if (x > d.x - 20 * k && x < d.x + d.w + 20 * k && y > d.y - 20 * k && y < d.y + d.h) return { k: 'door' };
  for (let i = R.cakes.length - 1; i >= 0; i--) { const c = R.cakes[i]; if (dist(x, y, c.x, c.y - 14 * k) < 26 * k) return { k: 'cake', o: i }; }
  for (let i = 0; i < L.flowers.length; i++) { const f = L.flowers[i]; if (dist(x, y, f.x, f.y - 34 * k) < 32 * k) return { k: 'flower', o: i }; }
  if (dist(x, y, L.burrow.x, L.burrow.y - 8 * k) < 48 * k) return { k: 'burrow' };
  for (let i = 0; i < Math.min(3, houses.length); i++) { const [mx, my] = miniXY(L, i); if (dist(x, y, mx, my) < 40 * k) return { k: 'mini', o: i }; }
  const [tx, ty, tr] = placeCenter(L, 'tramp'); if (dist(x, y, tx, ty) < tr * 0.8) return { k: 'tramp' };
  const [px, py] = placeCenter(L, 'puddle'); if (Math.abs(x - px) < 105 * k && Math.abs(y - py) < 40 * k) return { k: 'puddle' };
  if (Math.abs(x - L.sand.x) < 130 * k && y > L.sand.y - 80 * k && y < L.sand.y + 12 * k) return { k: 'sand' };
  for (let i = 0; i < 2; i++) { const [sx, sy] = pivot(L, i); if (Math.abs(x - sx) < 55 * k && y > sy && y < sy + SW_LEN * k + 30 * k) return { k: 'swing', o: i }; }
  if (Math.abs(x - L.slide.x) < 150 * k && y > L.slide.y - 210 * k && y < L.slide.y + 10 * k) return { k: 'slide' };
  if (y < L.fy) return { k: 'sky' };
  return null;
}

export function onParkTap(h, hres, x, y) {
  const R = h.room, L = PL(), k = S;
  switch (hres.k) {
    case 'swing': { const sw = R.swings[hres.o]; sw.amp = Math.min(0.9, sw.amp + 0.28); whoosh(0.4, 0.12); const b = spotOf(h, 'swing', hres.o); if (b) { b.laugh = 1.2; if (sw.amp > 0.55) sfx.wheee(); } return true; }
    case 'slide': { R.slide.wob = 1; sfx.boing(); const [x0, y0] = chute(L, 0.4); burst(x0, y0, 'spark', 8, { size: 6, speed: 110, color: '#ffe27a' }); return true; }
    case 'sand': { R.bucket = 1; sfx.pat(); burst(x, y, 'spark', 8, { size: 5, speed: 100, color: '#f3d79a' }); return true; }
    case 'cake': {
      const c = R.cakes.splice(hres.o, 1)[0]; sfx.poof(); burst(c.x, c.y - 10 * k, 'spark', 12, { size: 6, speed: 130, color: '#e8c27a' });
      const b = spotOf(h, 'sand', c.i); if (b) { b.laugh = 1.5; sfx.giggle(1.1); }
      return true;
    }
    case 'puddle': R.puddle.rip = 1; R.puddle.frog = 2; sfx.splash(); setTimeout(() => sfx.ribbit(), 450); return true;
    case 'tramp': {
      R.tramp.wob = 1; const b = spotOf(h, 'tramp');
      if (b) { b.spot.big = true; b.spot.flip = true; b.spot.q = 0; b.laugh = 1.5; sfx.wheee(); } else { tone(160, 0.3, { type: 'sine', slide: 330, vol: 0.14 }); }
      return true;
    }
    case 'flower': { const i = hres.o, f = L.flowers[i]; R.flowers[i] = 1; tone(PENTA[(i * 2) % PENTA.length], 0.5, { type: 'triangle', vol: 0.12 }); burst(f.x, f.y - 36 * k, 'heart', 5, { size: 7, speed: 90, up: -60, color: pick(['#ff7aa8', '#ffd166', '#b388ff']) }); return true; }
    case 'burrow': R.burrow = 2.2; sfx.giggle(0.55); setTimeout(() => tone(900, 0.15, { type: 'square', vol: 0.05, slide: 1300 }), 500); return true;
    case 'mini': { R.mini[hres.o] = 1; sfx.dingdong(); return true; }
    case 'sky': { R.starT = 1; sfx.chime(pick(PENTA)); burst(x, y, 'spark', 10, { size: 7, speed: 120, color: '#ffe27a' }); return true; }
  }
  return false;
}

export function parkDropAt(h, L, x, y): any {
  const k = S;
  for (let i = 0; i < 2; i++) { const [px, py] = pivot(L, i); if (Math.abs(x - px) < 60 * k && y > py && y < py + SW_LEN * k + 60 * k && !spotOf(h, 'swing', i)) return { spot: 'swing', i }; }
  if (Math.abs(x - L.slide.x) < 160 * k && y > L.slide.y - 260 * k && y < L.slide.y + 10 * k && !spotOf(h, 'slide')) return { spot: 'slide' };
  if (Math.abs(x - L.sand.x) < 135 * k && y > L.sand.y - 190 * k && y < L.sand.y + 15 * k) {
    const order = x < L.sand.x ? [0, 1] : [1, 0];
    for (const i of order) if (!spotOf(h, 'sand', i)) return { spot: 'sand', i };
  }
  if (Math.abs(x - L.puddle.x) < 110 * k && y > L.puddle.y - 170 * k && y < L.puddle.y + 30 * k && !spotOf(h, 'puddle')) return { spot: 'puddle' };
  if (Math.abs(x - L.tramp.x) < 95 * k && y > L.tramp.y - 200 * k && y < L.tramp.y + 10 * k && !spotOf(h, 'tramp')) return { spot: 'tramp' };
  return {};
}

export function dropInPark(b, h, tg) {
  if (!tg.spot) return false;
  const L = PL();
  b.spot = { k: tg.spot, i: tg.i || 0, t: 0 }; b.bounce = 1; b.laugh = 1; b.awake = 3;
  if (tg.spot === 'swing') { const sw = h.room.swings[tg.i]; sw.amp = Math.max(sw.amp, 0.35); }
  if (tg.spot === 'tramp') { b.spot.q = 0; h.room.tramp.sag = 1; }
  tickSpot(b, 0, L); sfx.pick();
  satisfy(b, 'walk', tg.spot);
  return true;
}

// ---------------- ГРЯЗЬ ПОСЛЕ ЛУЖИ ----------------
/** пятнышки грязи на малыше (рисуется в координатах головы); part: 'body' | 'head' */
export function drawMud(r, b, part) {
  const m = b.mud || 0; if (m <= 0.02) return;
  ctx.fillStyle = `rgba(150,100,55,${0.75 * Math.min(1, m * 1.5)})`;
  const pts = part === 'body' ? [[-0.35, 1.5, 0.16], [0.3, 1.75, 0.13], [0.05, 1.25, 0.1], [-0.15, 2.05, 0.12], [0.45, 2.15, 0.1]] : [[0.5, 0.35, 0.12], [-0.45, -0.35, 0.09], [0.2, -0.6, 0.07]];
  pts.slice(0, Math.ceil(pts.length * Math.min(1, m * 1.3))).forEach(([x, y, s]) => { ell(x * r, y * r, s * r * 1.2, s * r); });
}

// значки для желания «гулять»
export function drawPlaceIcon(o, s) {
  ctx.save();
  if (o === 'swing') {
    ctx.strokeStyle = '#ff7aa8'; ctx.lineWidth = s * 0.1; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-s * 0.6, s * 0.55); ctx.lineTo(-s * 0.45, -s * 0.5); ctx.moveTo(s * 0.6, s * 0.55); ctx.lineTo(s * 0.45, -s * 0.5); ctx.stroke();
    ctx.strokeStyle = '#ffd166'; ctx.beginPath(); ctx.moveTo(-s * 0.55, -s * 0.5); ctx.lineTo(s * 0.55, -s * 0.5); ctx.stroke();
    ctx.translate(0, -s * 0.5); ctx.rotate(Math.sin(t * 3) * 0.4);
    ctx.strokeStyle = '#c9d3e8'; ctx.lineWidth = s * 0.05; ctx.beginPath(); ctx.moveTo(-s * 0.18, 0); ctx.lineTo(-s * 0.18, s * 0.72); ctx.moveTo(s * 0.18, 0); ctx.lineTo(s * 0.18, s * 0.72); ctx.stroke();
    ctx.fillStyle = '#06d6a0'; ctx.beginPath(); ctx.roundRect(-s * 0.25, s * 0.68, s * 0.5, s * 0.1, s * 0.05); ctx.fill();
  } else if (o === 'slide') {
    ctx.strokeStyle = '#ffd166'; ctx.lineWidth = s * 0.08; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-s * 0.55, s * 0.55); ctx.lineTo(-s * 0.4, -s * 0.5); ctx.stroke();
    for (let i = 1; i < 4; i++) { const y = s * 0.55 - i * s * 0.26; ctx.beginPath(); ctx.moveTo(-s * 0.58 + i * 0.04 * s, y); ctx.lineTo(-s * 0.3 + i * 0.03 * s, y); ctx.stroke(); }
    ctx.strokeStyle = '#ff9ec7'; ctx.lineWidth = s * 0.16; ctx.beginPath(); ctx.moveTo(-s * 0.32, -s * 0.48); ctx.quadraticCurveTo(-s * 0.05, s * 0.5, s * 0.62, s * 0.45); ctx.stroke();
    ctx.fillStyle = '#ff6b6b'; ctx.beginPath(); ctx.moveTo(-s * 0.4, -s * 0.75); ctx.lineTo(-s * 0.1, -s * 0.66); ctx.lineTo(-s * 0.4, -s * 0.57); ctx.fill();
  } else if (o === 'sand') {
    ctx.fillStyle = '#c98b5a'; ctx.beginPath(); ctx.roundRect(-s * 0.7, s * 0.1, s * 1.4, s * 0.42, s * 0.12); ctx.fill();
    ctx.fillStyle = '#f3d79a'; ctx.beginPath(); ctx.roundRect(-s * 0.62, s * 0.14, s * 1.24, s * 0.3, s * 0.1); ctx.fill();
    ctx.fillStyle = '#e8c27a'; ctx.beginPath(); ctx.moveTo(-s * 0.32, s * 0.25); ctx.lineTo(-s * 0.24, -s * 0.15); ctx.lineTo(s * 0.06, -s * 0.15); ctx.lineTo(s * 0.14, s * 0.25); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff9ec7'; ctx.save(); ctx.translate(-s * 0.09, -s * 0.28); ctx.rotate(t); starPath(5, s * 0.12, s * 0.05); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#4cc9f0'; ctx.beginPath(); ctx.moveTo(s * 0.25, -s * 0.15); ctx.lineTo(s * 0.6, -s * 0.15); ctx.lineTo(s * 0.54, s * 0.2); ctx.lineTo(s * 0.31, s * 0.2); ctx.closePath(); ctx.fill();
  } else if (o === 'puddle') {
    ctx.fillStyle = '#7fc4ea'; ell(0, s * 0.35, s * 0.72, s * 0.22); ctx.fillStyle = '#a9dcf7'; ell(-s * 0.08, s * 0.32, s * 0.55, s * 0.14);
    for (let i = 0; i < 4; i++) { const a = -Math.PI * (0.2 + i * 0.2), q = (t * 1.2 + i * 0.25) % 1; ctx.fillStyle = '#4cb3f0'; circle(Math.cos(a) * s * (0.2 + q * 0.4), s * 0.2 + Math.sin(a) * s * (0.25 + q * 0.5), s * 0.07); }
    // сапожок
    ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.roundRect(-s * 0.12, -s * 0.55, s * 0.26, s * 0.62, s * 0.06); ctx.fill(); ell(s * 0.08, s * 0.05, s * 0.24, s * 0.1);
  } else {
    ctx.strokeStyle = '#ffd166'; ctx.lineWidth = s * 0.09; ctx.beginPath(); ctx.ellipse(0, s * 0.4, s * 0.68, s * 0.17, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#2a2470'; ell(0, s * 0.4, s * 0.62, s * 0.13);
    const hop = Math.abs(Math.sin(t * 3)) * s * 0.35;
    ctx.fillStyle = '#ff7aa8'; ctx.save(); ctx.translate(0, -s * 0.05 - hop); heartPath(s * 0.24); ctx.restore();
  }
  ctx.restore();
}

/** горка-качели на макушке планеты (рисуется в координатах планеты, R — её радиус) */
export function drawParkTop(R, glow) {
  const k = R / 100, occ = park.occupants(), bh = Math.abs(Math.sin(park.bounce * Math.PI * 3)) * 6 * k;
  ctx.save(); ctx.translate(0, -R * 0.97 - bh);
  if (glow > 0) glowSpot(0, -22 * k, 70 * k, glow);
  ctx.strokeStyle = '#ff7aa8'; ctx.lineWidth = 4.5 * k; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-50 * k, 4 * k); ctx.lineTo(-38 * k, -44 * k); ctx.lineTo(-26 * k, 4 * k); ctx.moveTo(-8 * k, 6 * k); ctx.lineTo(-20 * k, -44 * k); ctx.stroke();
  ctx.strokeStyle = '#ffd166'; ctx.beginPath(); ctx.moveTo(-42 * k, -44 * k); ctx.lineTo(-14 * k, -44 * k); ctx.stroke();
  const a = Math.sin(t * 2.3) * (occ.length ? 0.45 : 0.15);
  ctx.save(); ctx.translate(-28 * k, -44 * k); ctx.rotate(a); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * k; ctx.beginPath(); ctx.moveTo(-5 * k, 0); ctx.lineTo(-5 * k, 30 * k); ctx.moveTo(5 * k, 0); ctx.lineTo(5 * k, 30 * k); ctx.stroke();
  ctx.fillStyle = '#06d6a0'; ctx.fillRect(-8 * k, 29 * k, 16 * k, 4 * k); ctx.restore();
  ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 3.5 * k; ctx.beginPath(); ctx.moveTo(14 * k, 8 * k); ctx.lineTo(18 * k, -40 * k); ctx.stroke();
  ctx.strokeStyle = '#ff9ec7'; ctx.lineWidth = 8 * k; ctx.beginPath(); ctx.moveTo(20 * k, -38 * k); ctx.quadraticCurveTo(26 * k, 4 * k, 56 * k, 4 * k); ctx.stroke();
  ctx.fillStyle = '#ff6b6b'; ctx.beginPath(); ctx.moveTo(18 * k, -40 * k); ctx.lineTo(18 * k, -58 * k); ctx.lineTo(32 * k, -53 * k); ctx.closePath(); ctx.fill();
  ctx.restore();
}
