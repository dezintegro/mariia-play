import { soundOn, toggleSound, tone, whoosh } from '../../core/audio';
import { DPR, H, S, TAU, W, clamp, ctx, dist, pick, pointer, rand, t } from '../../core/canvas';
import { circle, ell, starPath } from '../../core/draw';
import { addP, burst } from '../../core/particles';
import { flyHouse, houseAt } from './buildings';
import { Baby } from './characters';
import { enterRoom } from './room';
import { PENTA, sfx } from './sounds';
import { G, MAX_BABIES, MAX_HOUSES, availPicks, babies, houses, picker } from './state';
import { spawnToy } from './toys';

// ---------------- МИР ----------------
export const planet = { x: 0, y: 0, r: 100, wob: 0, blink: 0, blinkT: 3, laugh: 0, alienT: 0, alienAng: -Math.PI / 2, tapN: 0, wink: 0, fount: 0, hop: 0 };

export const ringed = { x: 0, y: 0, r: 30, hue: 28, spinT: 0 };

export const btn = {
  launch: { x: 0, y: 0, r: 40, press: 0, shake: 0 },
  night:  { x: 0, y: 0, r: 40, press: 0, shake: 0 },
  house:  { x: 0, y: 0, r: 40, press: 0, shake: 0 },
  sound:  { x: 0, y: 0, r: 22, press: 0, shake: 0 },
};

export const smallStars = Array.from({ length: 180 }, () => ({ fx: Math.random(), fy: Math.random(), s: rand(0.4, 1.7), ph: rand(0, TAU), sp: rand(0.8, 3) }));

export const bigStars: any[] = [];

(function makeBigStars() {
  let guard = 0;
  while (bigStars.length < 9 && guard++ < 500) {
    const fx = rand(0.05, 0.95), fy = rand(0.06, 0.78);
    if (Math.hypot(fx - 0.5, (fy - 0.56) * 0.8) < 0.26) continue;
    if (Math.hypot(fx - 0.13, fy - 0.2) < 0.1) continue;
    if (bigStars.some(s => Math.hypot(s.fx - fx, s.fy - fy) < 0.14)) continue;
    bigStars.push({ fx, fy, x: 0, y: 0, ph: rand(0, TAU), pop: 0, note: PENTA[bigStars.length % PENTA.length] });
  }
})();

export const nebulae: [number, number, string][] = [[0.18, 0.28, '255,120,200'], [0.82, 0.22, '120,200,255'], [0.72, 0.88, '180,120,255'], [0.12, 0.82, '100,255,200']];

export const bgC = document.createElement('canvas');

export function buildBg() {
  bgC.width = W * DPR; bgC.height = H * DPR;
  const b = bgC.getContext('2d'); b.setTransform(DPR, 0, 0, DPR, 0, 0);
  const M = Math.max(W, H);
  let g = b.createRadialGradient(W * 0.5, H * 0.55, 0, W * 0.5, H * 0.55, M * 0.85);
  g.addColorStop(0, '#3b2b80'); g.addColorStop(0.5, '#211a5e'); g.addColorStop(1, '#0c0b30');
  b.fillStyle = g; b.fillRect(0, 0, W, H);
  for (const [fx, fy, c] of nebulae) {
    g = b.createRadialGradient(W * fx, H * fy, 0, W * fx, H * fy, M * 0.35);
    g.addColorStop(0, `rgba(${c},0.22)`); g.addColorStop(1, `rgba(${c},0)`);
    b.fillStyle = g; b.fillRect(0, 0, W, H);
  }
}

// ---------------- ПАДАЮЩИЕ ЗВЁЗДЫ ----------------
export const shooting: any[] = []; export let shootT = 3;

export function updateShooting(dt) {
  shootT -= dt;
  if (shootT <= 0) {
    shootT = rand(4, 9);
    const fromLeft = Math.random() < 0.5, sp = rand(260, 380) * S;
    shooting.push({ x: fromLeft ? rand(-50, W * 0.4) : rand(W * 0.6, W + 50), y: rand(-40, H * 0.2), vx: (fromLeft ? 1 : -1) * sp, vy: sp * rand(0.35, 0.6), life: 6 });
  }
  for (const s of shooting) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; }
  for (let i = shooting.length - 1; i >= 0; i--) { const s = shooting[i]; if (s.life <= 0 || s.y > H + 80 || s.x < -200 || s.x > W + 200) shooting.splice(i, 1); }
}

export function drawShooting() {
  for (const s of shooting) {
    const sp = Math.hypot(s.vx, s.vy), L = 140 * S, ex = s.x - s.vx / sp * L, ey = s.y - s.vy / sp * L;
    const g = ctx.createLinearGradient(s.x, s.y, ex, ey); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.strokeStyle = g; ctx.lineWidth = 4 * S; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(t * 3); ctx.fillStyle = '#fff6c8'; starPath(5, 9 * S, 4 * S); ctx.fill(); ctx.restore();
  }
}

// ---------------- ФОН, ПЛАНЕТЫ ----------------
export function drawStars() {
  ctx.fillStyle = '#fff';
  for (const s of smallStars) {
    ctx.globalAlpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph)) * (0.7 + G.night * 0.3);
    ctx.beginPath(); ctx.arc(s.fx * W, s.fy * H, s.s * S, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const s of bigStars) {
    const p = 1 + Math.sin(t * 2 + s.ph) * 0.1 + s.pop * 0.8;
    s.pop = Math.max(0, s.pop - 0.025);
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(Math.sin(t * 0.8 + s.ph) * 0.2 + s.pop * 3); ctx.scale(p, p);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 26 * S); g.addColorStop(0, 'rgba(255,230,120,0.45)'); g.addColorStop(1, 'rgba(255,230,120,0)');
    ctx.fillStyle = g; circle(0, 0, 26 * S);
    ctx.fillStyle = '#ffe27a'; starPath(5, 14 * S, 6.5 * S); ctx.fill();
    ctx.fillStyle = '#fff6c8'; starPath(5, 7 * S, 3 * S); ctx.fill();
    ctx.restore();
  }
}

export function drawRinged() {
  const q = ringed;
  const sp = q.spinT > 0 ? Math.sin(q.spinT * Math.PI * 4) * 0.35 * q.spinT : 0;
  ctx.save(); ctx.translate(q.x, q.y + Math.sin(t * 0.8) * 4 * S); ctx.rotate(-0.35 + sp);
  const rc = `hsl(${(q.hue + 40) % 360},80%,80%)`;
  ctx.strokeStyle = rc; ctx.lineWidth = q.r * 0.22;
  ctx.beginPath(); ctx.ellipse(0, 0, q.r * 1.9, q.r * 0.5, 0, Math.PI, TAU); ctx.stroke();
  const g = ctx.createRadialGradient(-q.r * 0.35, -q.r * 0.35, q.r * 0.1, 0, 0, q.r);
  g.addColorStop(0, `hsl(${q.hue},90%,82%)`); g.addColorStop(1, `hsl(${q.hue},65%,55%)`);
  ctx.fillStyle = g; circle(0, 0, q.r);
  ctx.fillStyle = `hsla(${q.hue},70%,45%,0.35)`; ell(0, -q.r * 0.25, q.r * 0.9, q.r * 0.12); ell(0, q.r * 0.3, q.r * 0.85, q.r * 0.1);
  ctx.strokeStyle = rc; ctx.beginPath(); ctx.ellipse(0, 0, q.r * 1.9, q.r * 0.5, 0, 0, Math.PI); ctx.stroke();
  ctx.restore();
}

export const patches = Array.from({ length: 9 }, () => ({ u: Math.random(), v: rand(-0.75, 0.75), s: rand(0.12, 0.3), dark: Math.random() < 0.4 }));

export function drawAlien() {
  if (planet.alienT <= 0) return;
  const p = 1 - planet.alienT / 2.6, rise = Math.sin(clamp(p, 0, 1) * Math.PI), R = planet.r;
  ctx.save(); ctx.translate(planet.x, planet.y); ctx.rotate(planet.alienAng + Math.PI / 2);
  ctx.translate(0, -(R * 0.55 + rise * R * 0.75));
  const a = R * 0.24;
  ctx.strokeStyle = '#7be08a'; ctx.lineWidth = a * 0.15; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-a * 0.4, -a * 0.8); ctx.lineTo(-a * 0.7, -a * 1.5); ctx.moveTo(a * 0.4, -a * 0.8); ctx.lineTo(a * 0.7, -a * 1.5); ctx.stroke();
  ctx.fillStyle = '#ffd66b'; circle(-a * 0.7, -a * 1.5, a * 0.17); circle(a * 0.7, -a * 1.5, a * 0.17);
  ctx.save(); ctx.translate(a * 0.85, a * 0.6); ctx.rotate(-1.2 + Math.sin(t * 12) * 0.5); ctx.fillStyle = '#7be08a'; ell(0, -a * 0.35, a * 0.15, a * 0.4); ctx.restore();
  ctx.fillStyle = '#7be08a'; ell(0, a * 1.0, a * 0.7, a * 0.8); circle(0, 0, a);
  ctx.fillStyle = '#fff'; circle(0, -a * 0.1, a * 0.45); ctx.fillStyle = '#2a1b3d'; circle(0, -a * 0.05, a * 0.25); ctx.fillStyle = '#fff'; circle(a * 0.08, -a * 0.15, a * 0.08);
  ctx.strokeStyle = '#2a7a3a'; ctx.lineWidth = a * 0.1; ctx.beginPath(); ctx.arc(0, a * 0.35, a * 0.25, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  ctx.restore();
}

export function drawPlanet() {
  const P = planet, R = P.r;
  let sx = 1 + Math.sin(t * 22) * 0.07 * P.wob, sy = 1 - Math.sin(t * 22) * 0.07 * P.wob, hy = 0;
  if (P.hop > 0) {
    const p = 1 - P.hop / 1.2;
    if (p < 0.15) { const q = Math.sin(p / 0.15 * Math.PI); sx *= 1 + q * 0.15; sy *= 1 - q * 0.15; }
    else if (p < 0.75) { const q = (p - 0.15) / 0.6; hy = -Math.sin(q * Math.PI) * 70 * S; sx *= 0.94; sy *= 1.06; }
    else { const q = Math.sin((p - 0.75) / 0.25 * Math.PI); sx *= 1 + q * 0.18; sy *= 1 - q * 0.18; }
  }
  ctx.save(); ctx.translate(P.x, P.y + hy);
  let g = ctx.createRadialGradient(0, 0, R * 0.9, 0, 0, R * 1.45);
  g.addColorStop(0, 'rgba(140,255,225,0.35)'); g.addColorStop(1, 'rgba(140,255,225,0)'); ctx.fillStyle = g; circle(0, 0, R * 1.45);
  ctx.scale(sx, sy);
  g = ctx.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R);
  g.addColorStop(0, '#b9f7e6'); g.addColorStop(0.55, '#5fcab6'); g.addColorStop(1, '#2f8f90');
  ctx.fillStyle = g; circle(0, 0, R);
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.clip();
  for (const p of patches) {
    const u = ((p.u + t * 0.012) % 1 + 1) % 1, x = (u * 2.8 - 1.4) * R, y = p.v * R;
    ctx.fillStyle = p.dark ? 'rgba(30,110,110,0.35)' : 'rgba(200,255,220,0.35)';
    ell(x, y, p.s * R * 1.3, p.s * R * 0.75);
  }
  g = ctx.createRadialGradient(-R * 0.2, -R * 0.2, R * 0.6, 0, 0, R);
  g.addColorStop(0, 'rgba(0,30,60,0)'); g.addColorStop(1, 'rgba(0,30,60,0.35)'); ctx.fillStyle = g; ctx.fillRect(-R, -R, R * 2, R * 2);
  ctx.restore();
  // лицо
  const ex = R * 0.3, ey = -R * 0.05;
  const busy = P.laugh > 0 || P.wink > 0 || P.hop > 0;
  const sleep = G.night > 0.5 && !busy, closed = sleep || P.blink > 0;
  ctx.strokeStyle = '#1f4f55'; ctx.lineWidth = R * 0.045; ctx.lineCap = 'round';
  const lx = clamp((pointer.x - P.x) / (400 * S), -1, 1) * R * 0.05, ly = clamp((pointer.y - P.y) / (400 * S), -1, 1) * R * 0.05;
  for (const s of [-1, 1]) {
    const mode = P.laugh > 0 || P.hop > 0 ? 'laugh' : P.wink > 0 ? (s > 0 ? 'laugh' : 'open') : closed ? 'closed' : 'open';
    if (mode === 'laugh') { ctx.beginPath(); ctx.arc(s * ex, ey + R * 0.06, R * 0.11, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke(); }
    else if (mode === 'closed') { ctx.beginPath(); ctx.arc(s * ex, ey - R * 0.04, R * 0.11, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
    else {
      ctx.fillStyle = '#fff'; ell(s * ex, ey, R * 0.13, R * 0.15);
      ctx.fillStyle = '#1f3b4d'; circle(s * ex + lx, ey + ly, R * 0.08);
      ctx.fillStyle = '#fff'; circle(s * ex + lx + R * 0.03, ey + ly - R * 0.03, R * 0.028);
    }
  }
  ctx.fillStyle = 'rgba(255,120,150,0.45)'; const ck = P.hop > 0 ? 1.4 : 1;
  ell(-R * 0.5, R * 0.18, R * 0.12 * ck, R * 0.07 * ck); ell(R * 0.5, R * 0.18, R * 0.12 * ck, R * 0.07 * ck);
  if (P.hop > 0) { ctx.fillStyle = '#b8344f'; ell(0, R * 0.25, R * 0.09, R * 0.11); }
  else if (P.wink > 0) {
    ctx.fillStyle = '#b8344f'; ctx.beginPath(); ctx.arc(0, R * 0.2, R * 0.17, 0, Math.PI); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff8fa6'; ell(R * 0.04, R * 0.33, R * 0.08, R * 0.06);
  }
  else if (P.laugh > 0) { ctx.fillStyle = '#b8344f'; ctx.beginPath(); ctx.arc(0, R * 0.2, R * 0.17, 0, Math.PI); ctx.closePath(); ctx.fill(); }
  else if (sleep) { ctx.fillStyle = '#b8344f'; circle(0, R * 0.27, R * 0.045); }
  else { ctx.beginPath(); ctx.arc(0, R * 0.16, R * 0.15, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); }
  if (G.night > 0) { ctx.fillStyle = `rgba(20,10,70,${G.night * 0.25})`; circle(0, 0, R); }
  ctx.restore();
}

export function iconRocket(R) {
  ctx.rotate(0.6);
  ctx.fillStyle = '#ffe27a'; ell(0, R * 0.68, R * 0.14, R * 0.24 * (1 + Math.sin(t * 30) * 0.15));
  ctx.fillStyle = '#ff5d73';
  ctx.beginPath(); ctx.moveTo(-R * 0.18, R * 0.15); ctx.lineTo(-R * 0.42, R * 0.55); ctx.lineTo(-R * 0.12, R * 0.45); ctx.fill();
  ctx.beginPath(); ctx.moveTo(R * 0.18, R * 0.15); ctx.lineTo(R * 0.42, R * 0.55); ctx.lineTo(R * 0.12, R * 0.45); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, R * 0.25, R * 0.56, 0, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); ctx.clip();
  ctx.fillStyle = '#ff5d73'; ctx.fillRect(-R, -R, R * 2, R * 0.6); ctx.restore();
  ctx.fillStyle = '#7cc8ff'; circle(0, -R * 0.05, R * 0.12);
}

export function iconMoonSun(R) {
  if (G.nightTarget) {
    ctx.fillStyle = '#ffd25e'; circle(0, 0, R * 0.32);
    ctx.strokeStyle = '#ffd25e'; ctx.lineWidth = R * 0.09; ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + t * 0.5; ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 0.45, Math.sin(a) * R * 0.45); ctx.lineTo(Math.cos(a) * R * 0.62, Math.sin(a) * R * 0.62); ctx.stroke(); }
  } else {
    ctx.save(); ctx.beginPath(); ctx.rect(-R, -R, R * 2, R * 2); ctx.arc(R * 0.2, -R * 0.15, R * 0.4, 0, TAU, true); ctx.clip('evenodd');
    ctx.fillStyle = '#ffe27a'; circle(-R * 0.05, 0, R * 0.5); ctx.restore();
    ctx.fillStyle = '#fff'; ctx.save(); ctx.translate(R * 0.35, -R * 0.4); starPath(4, R * 0.13, R * 0.05); ctx.fill(); ctx.restore();
  }
}

export function iconSound(R) {
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(-R * 0.45, -R * 0.18); ctx.lineTo(-R * 0.2, -R * 0.18); ctx.lineTo(R * 0.08, -R * 0.42); ctx.lineTo(R * 0.08, R * 0.42); ctx.lineTo(-R * 0.2, R * 0.18); ctx.lineTo(-R * 0.45, R * 0.18); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = R * 0.1; ctx.lineCap = 'round';
  if (soundOn) { ctx.beginPath(); ctx.arc(R * 0.1, 0, R * 0.3, -0.8, 0.8); ctx.stroke(); ctx.beginPath(); ctx.arc(R * 0.1, 0, R * 0.5, -0.8, 0.8); ctx.stroke(); }
  else { ctx.beginPath(); ctx.moveTo(R * 0.25, -R * 0.2); ctx.lineTo(R * 0.6, R * 0.2); ctx.moveTo(R * 0.6, -R * 0.2); ctx.lineTo(R * 0.25, R * 0.2); ctx.stroke(); }
}

// ---------------- ДЕЙСТВИЯ В КОСМОСЕ ----------------
export function launchBaby() {
  const b0 = btn.launch; b0.press = 1;
  if (babies.length >= MAX_BABIES) { b0.shake = 1; sfx.boop(); return; }
  const a = rand(-Math.PI * 0.85, -Math.PI * 0.15);
  const x = planet.x + Math.cos(a) * planet.r, y = planet.y + Math.sin(a) * planet.r;
  const b = new Baby(pick(['suit', 'suit', 'bubble', 'ufo', 'rocket']), x, y);
  b.vx = Math.cos(a) * 420 * S; b.vy = Math.sin(a) * 420 * S; b.wTimer = 1.3; b.born = t; b.laugh = 1.2; b.awake = 3;
  [b.wx, b.wy] = [x + Math.cos(a) * 250 * S, y + Math.sin(a) * 250 * S];
  babies.push(b);
  whoosh(); sfx.yay(); planet.wob = 0.8; planet.laugh = 0.8;
  for (let i = 0; i < 14; i++) addP({ kind: 'smoke', x, y, vx: rand(-80, 80) * S, vy: rand(-80, 20) * S, life: rand(0.6, 1.2), size: rand(10, 18) * S, color: '#fff', rot: 0, vr: 0, g: 0 });
  burst(x, y, 'confetti', 24, { size: 7, speed: 260, g: 260 });
}

export function hit(x, y) {
  if (picker.open) for (const o of availPicks()) if (dist(x, y, o.x, o.y) < o.r0 * 1.1) return { k: 'pick', o };
  for (const k of ['sound', 'night', 'house', 'launch']) { const b = btn[k]; if (dist(x, y, b.x, b.y) < b.r * 1.1) return { k: 'btn', o: k }; }
  for (let i = babies.length - 1; i >= 0; i--) { const b = babies[i]; if (b.home) continue; if (dist(x, y, b.x, b.y) < b.hitR()) return { k: 'baby', o: b }; }
  const h = houseAt(x, y); if (h) return { k: 'house', o: h };
  for (const s of shooting) if (dist(x, y, s.x, s.y) < 50 * S) return { k: 'shoot', o: s };
  for (const s of bigStars) if (dist(x, y, s.x, s.y) < 28 * S) return { k: 'star', o: s };
  if (dist(x, y, ringed.x, ringed.y) < ringed.r * 1.6) return { k: 'ringed' };
  if (dist(x, y, planet.x, planet.y) < planet.r) return { k: 'planet' };
  return null;
}

export function onTap(x, y, h) {
  if (!h) { spawnToy(x, y); return; }
  if (h.k === 'btn') {
    if (h.o === 'launch') launchBaby();
    else if (h.o === 'house') {
      btn.house.press = 1;
      if (houses.length >= MAX_HOUSES || picker.fly || !availPicks().length) { btn.house.shake = 1; sfx.boop(); }
      else { picker.open = !picker.open; picker.t = 0; if (picker.open) { sfx.pop(); tone(660, 0.2, { type: 'triangle', vol: 0.1, delay: 0.08 }); } else sfx.boop(); }
    }
    else if (h.o === 'night') {
      btn.night.press = 1; G.nightTarget = G.nightTarget ? 0 : 1;
      if (G.nightTarget) { tone(660, 0.6, { vol: 0.12 }); tone(523, 0.9, { vol: 0.12, delay: 0.2 }); }
      else { sfx.yay(); for (const b of babies) if (!b.home) { b.awake = 0; b.laugh = 0.8; } }
    } else { btn.sound.press = 1; if (toggleSound()) sfx.pop(); }
  } else if (h.k === 'house') enterRoom(h.o);
  else if (h.k === 'shoot') {
    const s = h.o; burst(s.x, s.y, 'spark', 26, { size: 9, speed: 260, color: '#fff3a0', g: 120 }); burst(s.x, s.y, 'confetti', 12, { speed: 200, g: 200 });
    sfx.sparkle(); s.life = 0;
  } else if (h.k === 'star') {
    const s = h.o; s.pop = 1; sfx.chime(s.note); burst(s.x, s.y, 'spark', 10, { size: 7, speed: 120, color: '#ffe27a' });
  } else if (h.k === 'ringed') {
    ringed.hue = (ringed.hue + rand(70, 140)) % 360; ringed.spinT = 1; sfx.boing(); burst(ringed.x, ringed.y, 'spark', 12, { size: 7, speed: 140, color: `hsl(${ringed.hue},90%,80%)` });
  } else if (h.k === 'pick') {
    flyHouse(h.o);
  } else if (h.k === 'planet') tapPlanet();
}

// три разные реакции планеты — по кругу
export function tapPlanet() {
  const P = planet, n = P.tapN++ % 3;
  if (n === 0) {
    P.wob = 1; P.laugh = 1.4; P.alienT = 2.6; P.alienAng = rand(-Math.PI * 0.8, -Math.PI * 0.2);
    sfx.giggle(0.55); setTimeout(() => tone(900, 0.15, { type: 'square', vol: 0.05, slide: 1300 }), 500);
  } else if (n === 1) {
    // подмигивает и пускает фонтан из звёздочек и сердечек
    P.wink = 1.8; P.fount = 1.3; P.wob = 0.4; P.laugh = 0;
    sfx.sparkle(); [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.1, delay: 0.1 + i * 0.1 }));
  } else {
    // подпрыгивает, и вокруг разлетается кольцо сердечек
    P.hop = 1.2; P.laugh = 0; P.wink = 0; sfx.wheee(); setTimeout(() => sfx.boing(), 950);
    for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; addP({ kind: 'heart', x: P.x + Math.cos(a) * P.r, y: P.y + Math.sin(a) * P.r, vx: Math.cos(a) * 160 * S, vy: Math.sin(a) * 160 * S, life: 1.5, size: 11 * S, color: pick(['#ff7aa8', '#ffd66b', '#8fd3ff', '#a8e6a1', '#c9a7ff']), rot: 0, vr: 0, g: 0 }); }
  }
}
