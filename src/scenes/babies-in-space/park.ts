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
  cy() { return planet.y - planet.r * 1.15; },
  occupants() { return babies.filter(b => b.home === park); },
  room: null as any,
};
park.room = {
  swings: [{ a: 0, ph: 0, amp: 0 }, { a: 0, ph: 1.5, amp: 0 }], slide: { wob: 0 }, cakes: [] as any[], bucket: 0,
  puddle: { rip: 0, frog: 0 }, tramp: { sag: 0, wob: 0 }, flowers: [0, 0, 0, 0, 0], burrow: 0, mini: [0, 0, 0],
  bubbles: [] as any[], autoCount: 0, light: true, starT: 0, doorOpen: 0, lampSwing: 0,
};

/** куда упал малыш в космосе: на планету (или на горку на её макушке) */
export function parkAt(x, y) {
  const P = planet;
  return dist(x, y, P.x, P.y) < P.r * 1.08 || dist(x, y, P.x, P.y - P.r * 1.05) < Math.max(P.r * 0.55, 42) ? park : null;
}
/** тап по горке на макушке планеты — зайти на площадку (тап по лицу — прежние реакции) */
export const parkDoorHit = (x, y) => dist(x, y, planet.x, planet.y - planet.r * 1.2) < Math.max(planet.r * 0.6, 42);

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
const SW_LEN = 150, SW_DX = 58, SW_TOP = 228;
const pivot = (L, i) => [L.swing.x + (i ? 1 : -1) * SW_DX * S, L.swing.y - SW_TOP * S];
/** качели качаются вперёд-назад (к нам и от нас): сиденье поднимается на краях, ближе — крупнее */
export const swingProj = (sw) => ({ y: SW_LEN * S * Math.cos(sw.a), sc: 1 + 0.22 * Math.sin(sw.a) });
function chute(L, u) { // горка: квадратичная кривая сверху вниз
  const s = L.slide, k = S, x0 = s.x - 70 * k, y0 = s.y - 200 * k, x1 = s.x + 5 * k, y1 = s.y - 10 * k, x2 = s.x + 135 * k, y2 = s.y - 22 * k;
  const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
  return [a * x0 + b * x1 + c * x2, a * y0 + b * y1 + c * y2];
}
const ladderAt = (L, u): [number, number] => { const s = L.slide, [tx, ty] = chute(L, 0), lx = s.x - 112 * S; return [lx + (tx - 10 * S - lx) * u, s.y + (ty + 6 * S - s.y) * u]; };
const sandSlot = (L, i) => [L.sand.x + (i ? 1 : -1) * 58 * S, L.sand.y - 4 * S];
export const spotOf = (h, k, i = 0) => h.occupants().find(b => b.spot && b.spot.k === k && (b.spot.i || 0) === i && !b.dragged);
const free = (b) => { b.spot = null; b.pose = null; b.iwT = rand(1.5, 3); b.bounce = 1; };
/** куда малыш подползает, чтобы сам занять место (фоновая игра) */
function approach(L, tg): [number, number] {
  const k = S;
  switch (tg.spot) {
    case 'swing': return [pivot(L, tg.i)[0], L.swing.y + 6 * k];
    case 'slide': return ladderAt(L, 0);
    case 'sand': return [sandSlot(L, tg.i)[0], L.sand.y + 18 * k];
    case 'puddle': return [L.puddle.x - 115 * k, L.puddle.y + 4 * k];
    default: return [L.tramp.x - 110 * k, L.tramp.y + 4 * k];
  }
}
const leave = (b, L) => { const [x, y] = approach(L, b.spot); free(b); b.ix = x; b.iy = clamp(y, L.by0, L.by1); if (b.visible()) sfx.boop(); };

// ---------------- ЖИЗНЬ НА МЕСТАХ ----------------
export function tickSpot(b, dt, L) {
  const P = b.spot, r = RB(), R = park.room, vis = b.visible(), k = S;
  P.t += dt;
  // качели, песочница, батут: поиграл — слезает сам (батут — только приземлившись)
  if (P.life != null && (P.k === 'swing' || P.k === 'sand' || (P.k === 'tramp' && (P.q ?? 0) < 0.05))) { P.life -= dt; if (P.life <= 0) { leave(b, L); return; } }
  switch (P.k) {
    case 'swing': {
      const sw = R.swings[P.i], [px, py] = pivot(L, P.i), f = swingProj(sw);
      b.ix = px; b.iy = py + f.y + r * 0.25 * f.sc; b.face = 1;
      const fw = Math.sin(sw.a) / 0.6; // вперёд — ножки вытянуты, назад — поджаты
      b.pose = { mood: sw.amp > 0.45 ? 'laugh' : undefined, armL: 1.45, armR: 1.45, legL: 0.35 + fw * 0.35, legR: 0.35 + fw * 0.35, scale: f.sc };
      if (sw.amp > 0.5 && Math.abs(Math.sin(sw.ph)) > 0.97 && (P.top ?? 0) < t - 0.5) { P.top = t; b.laugh = 0.8; if (vis && Math.random() < 0.5) sfx.giggle(1.2); }
      return;
    }
    case 'slide': return tickSlide(b, dt, L);
    case 'sand': { // сидит в песке, стучит лопаткой и лепит куличики
      const [sx, sy] = sandSlot(L, P.i); b.ix = sx; b.iy = sy; b.face = P.i ? -1 : 1;
      const ph = P.t * 5, pat = Math.abs(Math.sin(ph)), wr = 0.15 + pat * 1.15;
      b.pose = { armR: wr, armL: 0.35, legL: 1.1, legR: 1.1, dy: -pat * 1.5 * k, front: (rr) => shovel(rr, wr) };
      const n = Math.floor(ph / Math.PI);
      if (n !== P.pn) { P.pn = n; if (vis) { const hx = sx + 0.55 * r + Math.sin(0.55 + 0.15) * 0.9 * r; addP({ kind: 'smoke', x: hx, y: sy - 0.6 * r, vx: rand(-20, 20) * k, vy: -rand(10, 30) * k, life: 0.6, size: rand(4, 7) * k, color: '#f3d79a', rot: 0, vr: 0, g: 0 }); } }
      P.c = (P.c ?? 1.6) - dt;
      if (P.c <= 0) {
        P.c = rand(2.4, 3.4);
        const mine = R.cakes.filter(c => c.i === P.i);
        if (mine.length < 3) {
          // свои места для куличиков у каждого: сзади сбоку, сзади к середине и спереди
          const slot = [0, 1, 2].find(j => !mine.some(c => c.j === j)), [dx, dy] = [[-98, -50], [-96, -10], [-22, -12]][slot];
          const cx = L.sand.x + (P.i ? -dx : dx) * k;
          R.cakes.push({ i: P.i, j: slot, x: cx, y: L.sand.y + dy * k, pop: 1, c: pick(['#ff9ec7', '#8fd3ff', '#ffd66b', '#a8e6a1']) });
          if (vis) { sfx.pat(); burst(cx, L.sand.y + dy * k - 10 * k, 'spark', 7, { size: 5, speed: 80, color: '#f3d79a' }); b.laugh = 0.6; }
        }
      }
      return;
    }
    case 'puddle': { // прыгает по луже: плюх-плюх, пачкается
      const p = L.puddle, J = 0.7; b.ix = p.x - 10 * k; b.iy = p.y + 4 * k; b.face = 1;
      const n = Math.floor(P.t / J), q = (P.t % J) / J;
      if (n < 4) {
        // присел → прыжок → плюх (сплющился)
        const up = q < 0.15 ? 0 : Math.sin((q - 0.15) / 0.85 * Math.PI), squash = q < 0.15 ? Math.sin(q / 0.15 * Math.PI) : 0;
        b.pose = { dy: -up * 46 * k + squash * 4 * k, mood: 'laugh', armL: 0.6 + up * 1.4, armR: 0.6 + up * 1.4, legL: up * 0.5, legR: up * 0.5 };
        if (n > (P.n ?? -1)) {
          P.n = n;
          if (n > 0) { b.mud = Math.min(1, (b.mud || 0) + 0.3); R.puddle.rip = 1; b.bounce = 0.6; if (vis) { sfx.splash(); splash(b.ix, p.y, 12, '#9ed8ff'); splash(b.ix, p.y, 5, '#b98a5a'); } }
        }
      } else b.pose = { mood: 'laugh', armL: 1.9 + Math.sin(t * 14) * 0.3, armR: 1.9 + Math.sin(t * 14 + 1) * 0.3 };
      if (P.t > 4 * J + 1.2) leave(b, L);
      return;
    }
    case 'tramp': { // батут: медленно и высоко, как на Луне
      const T = L.tramp, D = P.big ? 1.9 : 1.5, H0 = (P.big ? 210 : 120) * k;
      b.ix = T.x; b.face = 1;
      P.q = (P.q ?? 0) + dt / D;
      if (P.q >= 1) { P.q -= 1; P.big = false; R.tramp.sag = 1; if (vis) tone(160, 0.25, { type: 'sine', slide: 320, vol: 0.14 }); }
      const h = Math.sin(P.q * Math.PI) * H0, low = 1 - Math.min(1, h / (25 * k));
      b.iy = T.y - 30 * k + R.tramp.sag * 7 * k;
      b.pose = { dy: -h, mood: h > 30 * k ? 'laugh' : undefined, armL: 0.5 + 1.5 * (h / H0), armR: 0.5 + 1.5 * (h / H0), legL: low * 0.5, legR: low * 0.5, lean: P.flip ? P.q * TAU : 0 };
      if (P.flip && P.q > 0.95) P.flip = false;
      return;
    }
  }
}

// лопатка в правой ручке (координаты головы; кисть — как в drawBody)
function shovel(r, wr) {
  const a = 0.55 + wr, hx = 0.55 * r + Math.sin(a) * 0.72 * r, hy = 1.05 * r + Math.cos(a) * 0.72 * r;
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(-a + 0.5);
  ctx.strokeStyle = '#ffd166'; ctx.lineWidth = r * 0.12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -r * 0.1); ctx.lineTo(0, r * 0.55); ctx.stroke();
  ctx.fillStyle = '#ff6b6b'; ctx.beginPath(); ctx.moveTo(-r * 0.2, r * 0.5); ctx.lineTo(r * 0.2, r * 0.5); ctx.lineTo(r * 0.14, r * 0.85); ctx.quadraticCurveTo(0, r * 0.95, -r * 0.14, r * 0.85); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function tickSlide(b, dt, L) {
  const P = b.spot, r = RB(), k = S, vis = b.visible(), s = L.slide;
  P.ph = P.ph || 'top';
  const go = (ph) => { P.ph = ph; P.t = 0; };
  const sit = (u) => { const [x, y] = chute(L, u); b.ix = x; b.iy = y + r * 0.62; };
  if (P.ph === 'top') { // сидит наверху, ёрзает — «поехали!»
    sit(0); b.face = 1;
    b.pose = { dy: -Math.abs(Math.sin(P.t * 9)) * 3 * k, armL: 1.6, armR: 1.6, mood: 'laugh', legL: 1.1, legR: 1.1, lean: -0.1 };
    if (P.t > 0.6) { go('down'); if (vis) sfx.wheee(); }
  } else if (P.ph === 'down') {
    const u = Math.min(1, Math.pow(P.t / 0.95, 1.6)); sit(u);
    b.pose = { mood: 'laugh', armL: 2.2, armR: 2.2, lean: -0.3 + u * 0.2, legL: 1.1, legR: 1.1 };
    if (vis && Math.random() < 0.5) addP({ kind: 'spark', x: b.ix - 20 * k, y: b.iy - r, vx: -rand(30, 80) * k, vy: -rand(10, 50) * k, life: 0.5, size: rand(4, 7) * k, color: pick(['#ffe27a', '#fff', '#ffb3d1']), rot: 0, vr: 3, g: 0 });
    if (P.t > 0.95) { go('land'); P.n = (P.n || 0) + 1; }
  } else if (P.ph === 'land') { // соскальзывает с края на траву — подпрыгнул, радуется
    const [ex, ey] = chute(L, 1), q = Math.min(1, P.t / 0.35);
    b.ix = ex + 38 * k * q; b.iy = ey + r * 0.62 + (s.y + 8 * k - ey - r * 0.62) * q - Math.sin(q * Math.PI) * 20 * k;
    if (q < 1) b.pose = { mood: 'laugh', armL: 2.2, armR: 2.2, legL: 1.1 * (1 - q), legR: 1.1 * (1 - q) };
    else {
      if (!P.landed) { P.landed = true; b.bounce = 1; b.laugh = 1.5; if (vis) { sfx.giggle(1.1); burst(b.ix, b.iy - r * 2, 'heart', 6, { size: 8, speed: 110, up: -60, color: '#ff7aa8' }); } }
      b.pose = { mood: 'laugh', armL: 1.9 + Math.sin(t * 14) * 0.3, armR: 1.9 + Math.sin(t * 14 + 1) * 0.3 };
    }
    if (P.t > 1.1) {
      P.landed = false;
      if (P.n < 3) go('walk'); // ещё разок! (до трёх раз)
      else { free(b); b.iy = clamp(b.iy, L.by0, L.by1); }
    }
  } else if (P.ph === 'walk') { // ползёт обратно к лесенке
    const [lx, ly] = ladderAt(L, 0), [ex] = chute(L, 1), x0 = ex + 38 * k, u = Math.min(1, P.t / 1.6);
    b.ix = x0 + (lx - x0) * u; b.iy = ly + 8 * k; b.face = -1; b.pose = null;
    if (u >= 1) go('climb');
  } else if (P.ph === 'climb') { // лезет вверх по лесенке, перехватывая ручками
    const u = Math.min(1, P.t / 1.3), [x, y] = ladderAt(L, u); b.ix = x; b.iy = y + 8 * k * (1 - u); b.face = 1;
    const c = Math.sin(P.t * 11);
    b.pose = { armL: 2.0 + c * 0.5, armR: 2.0 - c * 0.5, legL: 0.2 + c * 0.25, legR: 0.2 - c * 0.25 };
    if (vis && Math.floor(P.t * 5) !== P.st) { P.st = Math.floor(P.t * 5); tone(650 + u * 500, 0.06, { type: 'triangle', vol: 0.05 }); }
    if (u >= 1) go('top');
  }
}

// фоновая игра: малыш без желания сам ползёт к свободному месту
export function parkAuto(b, h, L) {
  const opts: any[] = [];
  for (const k of PLACES) for (let i = 0; i < (k === 'swing' || k === 'sand' ? 2 : 1); i++) if (!spotOf(h, k, i) && !h.occupants().some(o => o.goSpot && o.goSpot.tg.spot === k && o.goSpot.tg.i === i)) opts.push({ spot: k, i });
  if (opts.length) b.goSpot = { tg: pick(opts), t: 10 };
}
/** ползёт к месту; true — пока в пути */
export function tickGoSpot(b, dt, L, h) {
  const G0 = b.goSpot; G0.t -= dt;
  if (G0.t <= 0 || spotOf(h, G0.tg.spot, G0.tg.i)) { b.goSpot = null; return false; }
  const [x, y0] = approach(L, G0.tg), y = clamp(y0, L.by0, L.by1), dx = x - b.ix, dy = y - b.iy, d = Math.hypot(dx, dy);
  if (d < 10 * S) { b.goSpot = null; startSpot(b, h, G0.tg, true); return true; }
  const sp = Math.min(60 * S * dt, d); b.ix += dx / d * sp; b.iy += dy / d * sp; if (Math.abs(dx) > 2) b.face = Math.sign(dx);
  return true;
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
  ctx.fillStyle = 'rgba(30,90,80,0.18)'; ell(s.x, s.y + 2 * k, 160 * k, 11 * k);
  // боковые стойки: ножки расставлены вперёд-назад, поэтому спереди видны как «Л»
  ctx.strokeStyle = '#ff7aa8'; ctx.lineWidth = 11 * k; ctx.lineCap = 'round';
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s.x + sx * 150 * k, s.y + 4 * k); ctx.lineTo(s.x + sx * 125 * k, top); ctx.lineTo(s.x + sx * 104 * k, s.y - 4 * k); ctx.stroke(); }
  ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 13 * k; ctx.beginPath(); ctx.moveTo(s.x - 135 * k, top); ctx.lineTo(s.x + 135 * k, top); ctx.stroke();
  ctx.fillStyle = '#fff'; circle(s.x - 135 * k, top, 7 * k); circle(s.x + 135 * k, top, 7 * k);
  for (let i = 0; i < 2; i++) {
    const [px, py] = pivot(L, i), sw = R.swings[i], f = swingProj(sw), b = spotOf(h, 'swing', i), sy = py + f.y, w = 34 * k * f.sc;
    ctx.fillStyle = '#7a8bb0'; circle(px - 30 * k, py + 3 * k, 4 * k); circle(px + 30 * k, py + 3 * k, 4 * k);
    ctx.strokeStyle = '#c9d3e8'; ctx.lineWidth = 3.5 * k;
    ctx.beginPath(); ctx.moveTo(px - 30 * k, py); ctx.lineTo(px - w, sy); ctx.moveTo(px + 30 * k, py); ctx.lineTo(px + w, sy); ctx.stroke();
    // сиденье: видно и верх (на краях качания), и торец
    const tilt = Math.abs(Math.sin(sw.a)), c = i ? '#4cc9f0' : '#06d6a0';
    ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(px, sy, w + 4 * k, (3 + tilt * 9) * k * f.sc, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.roundRect(px - w - 4 * k, sy, 2 * (w + 4 * k), 7 * k * f.sc, 3 * k); ctx.fill();
    ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(px - w - 4 * k, sy - 1 * k, 2 * (w + 4 * k), 6 * k * f.sc, 3 * k); ctx.fill();
    if (b) drawRoomBabyAt(b, b.ix, b.iy, false);
  }
}

function slideBody(L, wob) {
  const k = S, s = L.slide, [mx, my] = chute(L, 0.55), [tx, ty] = chute(L, 0);
  ctx.fillStyle = 'rgba(30,90,80,0.18)'; ell(s.x + 20 * k, s.y + 2 * k, 150 * k, 10 * k);
  ctx.strokeStyle = '#8a7ac9'; ctx.lineWidth = 7 * k; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx, s.y); ctx.moveTo(tx - 8 * k, ty + 8 * k); ctx.lineTo(tx - 8 * k, s.y); ctx.stroke();
  ctx.save(); ctx.translate(0, wob);
  for (const [w, c] of [[30, '#ff9ec7'], [18, '#ffc4dd']] as [number, string][]) {
    ctx.strokeStyle = c; ctx.lineWidth = w * k; ctx.beginPath();
    for (let i = 0; i <= 20; i++) { const [x, y] = chute(L, i / 20); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
  }
  ctx.restore();
  // площадка наверху с флажком
  ctx.fillStyle = '#b388ff'; ctx.beginPath(); ctx.roundRect(tx - 34 * k, ty + 4 * k, 46 * k, 11 * k, 5 * k); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 * k; ctx.beginPath(); ctx.moveTo(tx - 30 * k, ty + 4 * k); ctx.lineTo(tx - 30 * k, ty - 50 * k); ctx.stroke();
  ctx.fillStyle = '#ff6b6b'; ctx.beginPath(); ctx.moveTo(tx - 30 * k, ty - 50 * k); ctx.lineTo(tx - 30 * k + (22 + Math.sin(t * 5) * 3) * k, ty - 43 * k); ctx.lineTo(tx - 30 * k, ty - 36 * k); ctx.fill();
}
function slideLadder(L) {
  const k = S, [x0, y0] = ladderAt(L, 0), [x1, y1] = ladderAt(L, 1);
  ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 8 * k; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0 - 16 * k, y0); ctx.lineTo(x1 - 16 * k, y1); ctx.moveTo(x0 + 16 * k, y0); ctx.lineTo(x1 + 16 * k, y1); ctx.stroke();
  ctx.lineWidth = 5 * k; for (let i = 1; i < 6; i++) { const [x, y] = ladderAt(L, i / 6); ctx.beginPath(); ctx.moveTo(x - 16 * k, y); ctx.lineTo(x + 16 * k, y); ctx.stroke(); }
}
function slideRail(L, wob) { // передний бортик ската — малыш сидит «в» горке
  const k = S; ctx.save(); ctx.translate(0, wob + 9 * k);
  ctx.strokeStyle = '#ff85b3'; ctx.lineWidth = 10 * k; ctx.lineCap = 'round'; ctx.beginPath();
  for (let i = 0; i <= 20; i++) { const [x, y] = chute(L, i / 20); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke(); ctx.restore();
}

function drawSlide(L, h, hv) {
  const k = S, s = L.slide, R = h.room, wob = Math.sin(R.slide.wob * 20) * R.slide.wob * 4 * k;
  if (hv) glowSpot(s.x, s.y - 100 * k, 150 * k, 0.6);
  const b = spotOf(h, 'slide'), ph = b && b.spot.ph;
  slideBody(L, wob);
  if (ph === 'climb') { drawRoomBabyAt(b, b.ix, b.iy, false); slideLadder(L); slideRail(L, wob); return; } // лесенка перед малышом
  slideLadder(L);
  if (b && ph !== 'top' && ph !== 'down') { slideRail(L, wob); drawRoomBabyAt(b, b.ix, b.iy, ph === 'walk' || (ph === 'land' && b.spot.landed)); return; }
  if (b) drawRoomBabyAt(b, b.ix, b.iy, false);
  slideRail(L, wob);
}

function drawSand(L, h, hv, part) {
  const k = S, s = L.sand, R = h.room, w = 240 * k, d = 70 * k;
  if (part === 'back') {
    if (hv != null) glowSpot(s.x, s.y - 30 * k, 140 * k, 0.6);
    ctx.fillStyle = '#c98b5a'; ctx.beginPath(); ctx.roundRect(s.x - w / 2 - 8 * k, s.y - d - 8 * k, w + 16 * k, d + 16 * k, 14 * k); ctx.fill();
    ctx.fillStyle = '#f3d79a'; ctx.beginPath(); ctx.roundRect(s.x - w / 2, s.y - d, w, d, 10 * k); ctx.fill();
    ctx.fillStyle = 'rgba(200,150,80,0.3)'; for (let i = 0; i < 12; i++) { const q = smallStars[30 + i]; circle(s.x - w / 2 + q.fx * w, s.y - d + q.fy * d, 2 * k); }
    // ведёрко
    const bh = Math.abs(Math.sin(R.bucket * Math.PI * 3)) * 18 * k, bx = s.x + 2 * k, by = s.y - d + 26 * k - bh;
    ctx.fillStyle = '#4cc9f0'; ctx.beginPath(); ctx.moveTo(bx - 14 * k, by - 18 * k); ctx.lineTo(bx + 14 * k, by - 18 * k); ctx.lineTo(bx + 10 * k, by + 4 * k); ctx.lineTo(bx - 10 * k, by + 4 * k); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2a8fb8'; ctx.lineWidth = 2.5 * k; ctx.beginPath(); ctx.arc(bx, by - 18 * k, 13 * k, Math.PI, TAU); ctx.stroke();
    for (const c of R.cakes) if (c.j === 0) drawCake(c);
  } else {
    // в песке перед сидящими — горки песка (ножки «в песке»), передние куличики, бортик
    for (let i = 0; i < 2; i++) if (spotOf(h, 'sand', i)) { const [sx] = sandSlot(L, i); ctx.fillStyle = '#ecc985'; ell(sx, s.y - 12 * k, 40 * k, 12 * k); ctx.fillStyle = '#f3d79a'; ell(sx, s.y - 14 * k, 34 * k, 9 * k); }
    for (const c of R.cakes) if (c.j !== 0) drawCake(c);
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

export function startSpot(b, h, tg, auto) {
  const L = PL();
  b.spot = { k: tg.spot, i: tg.i || 0, t: 0, life: auto ? rand(9, 15) : 25 }; b.bounce = 1; b.awake = 3; b.goSpot = null;
  if (tg.spot === 'swing') { const sw = h.room.swings[tg.i]; sw.amp = Math.max(sw.amp, 0.35); }
  if (tg.spot === 'tramp') { b.spot.q = 0; h.room.tramp.sag = 1; }
  if (tg.spot === 'slide' && auto) b.spot.ph = 'climb';
  if (auto) h.room.autoCount++;
  tickSpot(b, 0, L);
}

export function dropInPark(b, h, tg) {
  if (!tg.spot) return false;
  startSpot(b, h, tg, false); b.laugh = 1; sfx.pick();
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

/** вход на площадку на макушке планеты: травяная шапочка по изгибу планеты, на ней ворота-радуга,
 * качели и горка (стоят перпендикулярно поверхности — без щелей); над воротами — сердечко за каждого малыша */
export function drawParkTop(R, glow) {
  const k = R / 100, S0 = S, occ = park.occupants(), bh = Math.abs(Math.sin(park.bounce * Math.PI * 3)) * 5 * k;
  const on = (a, fn) => { ctx.save(); ctx.rotate(a); ctx.translate(0, -R + 3 * k); fn(); ctx.restore(); };
  ctx.save(); ctx.translate(0, -bh);
  if (glow > 0) glowSpot(0, -R - 25 * k, 75 * k, glow);
  // травка по изгибу
  const A = 0.9;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#7fd9bd'; ctx.lineWidth = 9 * k; ctx.beginPath(); ctx.arc(0, 0, R - 2 * k, -Math.PI / 2 - A, -Math.PI / 2 + A); ctx.stroke();
  ctx.strokeStyle = '#9ff0d4'; ctx.lineWidth = 4 * k; ctx.beginPath(); ctx.arc(0, 0, R + 0.5 * k, -Math.PI / 2 - A * 0.97, -Math.PI / 2 + A * 0.97); ctx.stroke();
  ctx.strokeStyle = '#6cc9ad'; ctx.lineWidth = 2 * k;
  for (let i = -7; i <= 7; i++) on(i * 0.12, () => { ctx.beginPath(); ctx.moveTo(-2 * k, 0); ctx.lineTo(-3 * k, -5 * k); ctx.moveTo(2 * k, 0); ctx.lineTo(3 * k, -4 * k); ctx.stroke(); });
  // качели (слева)
  on(-0.6, () => {
    ctx.strokeStyle = '#ff7aa8'; ctx.lineWidth = 4 * k;
    ctx.beginPath(); ctx.moveTo(-20 * k, 0); ctx.lineTo(-16 * k, -40 * k); ctx.lineTo(-12 * k, 0); ctx.moveTo(12 * k, 0); ctx.lineTo(16 * k, -40 * k); ctx.lineTo(20 * k, 0); ctx.stroke();
    ctx.strokeStyle = '#ffd166'; ctx.beginPath(); ctx.moveTo(-18 * k, -40 * k); ctx.lineTo(18 * k, -40 * k); ctx.stroke();
    const a = Math.sin(t * 2.3) * (occ.length ? 0.6 : 0.25), sc = 1 + 0.2 * Math.sin(a), y = 28 * k * Math.cos(a);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * k; ctx.beginPath(); ctx.moveTo(-6 * k, -40 * k); ctx.lineTo(-7 * k * sc, -40 * k + y); ctx.moveTo(6 * k, -40 * k); ctx.lineTo(7 * k * sc, -40 * k + y); ctx.stroke();
    ctx.fillStyle = '#06d6a0'; ctx.beginPath(); ctx.roundRect(-9 * k * sc, -41 * k + y, 18 * k * sc, 4 * k * sc, 2 * k); ctx.fill();
  });
  // горка (справа)
  on(0.6, () => {
    ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 3.5 * k;
    ctx.beginPath(); ctx.moveTo(-22 * k, 0); ctx.lineTo(-17 * k, -38 * k); ctx.moveTo(-12 * k, 0); ctx.lineTo(-7 * k, -38 * k); ctx.stroke();
    ctx.lineWidth = 2.5 * k; for (let i = 1; i < 4; i++) { const y = -i * 9.5 * k; ctx.beginPath(); ctx.moveTo(-22 * k + i * 1.2 * k, y); ctx.lineTo(-12 * k + i * 1.2 * k, y); ctx.stroke(); }
    ctx.strokeStyle = '#ff9ec7'; ctx.lineWidth = 8 * k; ctx.beginPath(); ctx.moveTo(-10 * k, -38 * k); ctx.quadraticCurveTo(0, -2 * k, 26 * k, -3 * k); ctx.stroke();
    ctx.fillStyle = '#ff6b6b'; ctx.beginPath(); ctx.moveTo(-15 * k, -38 * k); ctx.lineTo(-15 * k, -56 * k); ctx.lineTo(-2 * k, -51 * k); ctx.closePath(); ctx.fill();
  });
  // ворота-радуга посередине — «заходи»
  on(0, () => {
    const w = 15 * k, hh = 40 * k;
    ctx.save(); ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(-w, -hh + w); ctx.arc(0, -hh + w, w, Math.PI, TAU); ctx.lineTo(w, 0); ctx.closePath(); ctx.clip();
    ctx.fillStyle = '#1a1450'; ctx.fillRect(-w, -hh, 2 * w, hh);
    ctx.fillStyle = '#fff'; for (let i = 0; i < 6; i++) { const q = smallStars[80 + i]; circle(-w + q.fx * 2 * w, -hh + q.fy * hh, q.s * 0.9 * k); }
    const p = 1 + Math.sin(t * 4) * 0.2; ctx.translate(0, -hh * 0.45); ctx.scale(p, p); ctx.rotate(t); ctx.fillStyle = '#ffe27a'; starPath(5, 6.5 * k, 2.8 * k); ctx.fill();
    ctx.restore();
    ['#ff6b6b', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff'].forEach((c, i) => {
      const rr = w + (1.5 + i * 2.6) * k; ctx.strokeStyle = c; ctx.lineWidth = 2.8 * k; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(-rr, 1 * k); ctx.lineTo(-rr, -hh + w); ctx.arc(0, -hh + w, rr, Math.PI, TAU); ctx.lineTo(rr, 1 * k); ctx.stroke();
    });
  });
  ctx.restore();
  // сердечки — сколько малышей гуляет (с первого)
  const n = Math.min(occ.length, 10), hs = Math.max(6, 8 * S0), sp = hs * 2.3, hy = -R - 58 * k - hs;
  for (let i = 0; i < n; i++) { ctx.save(); ctx.translate((i - (n - 1) / 2) * sp, hy + Math.sin(t * 3 + i) * 2 * S0); ctx.fillStyle = '#ff7aa8'; heartPath(hs); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); ctx.fill(); ctx.restore(); }
}
