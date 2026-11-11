import { tone, whoosh } from '../../core/audio';
import { H, S, TAU, W, clamp, ctx, dist, easeOutBack, pick, rand, t } from '../../core/canvas';
import { circle, ell, heartPath, starPath } from '../../core/draw';
import { addP, burst } from '../../core/particles';
import { FOODS, drawFood } from './canteen';
import { drawHead, wanderPoint } from './characters';
import { sfx } from './sounds';
import { btn, planet } from './space';
import { G, MAX_HOUSES, babies, houses } from './state';
import { drawToy } from './toys';
import { drawWish } from './wishes';

// ---------------- ДОМИКИ В КОСМОСЕ ----------------

export const WALLS = ['#ffd6a5', '#caffbf', '#a0e7ff', '#ffc6ff', '#fdffb6'];

export const ROOFS = ['#ff6b6b', '#5b8def', '#9b5de5', '#f15bb5', '#2ec4b6'];

export class House {
  [key: string]: any; // поля задаются в конструкторе (x, y, kind, room, …)
  constructor(x, y, kind = 'nursery') {
    Object.assign(this, { x, y, vx: 0, vy: 0, kind });
    this.wall = pick(WALLS); this.roof = pick(ROOFS);
    this.phase = rand(0, TAU); this.born = t; this.bounce = 0; this.door = 0; this.smokeT = 0;
    this.wx = x; this.wy = y; this.wTimer = 1.5;
    if (kind === 'canteen') this.room = {
      chairs: [0, 1, 2].map(i => ({ i, wob: 0 })), foods: FOODS.map(k => ({ k, gone: 0, hop: 0 })), flying: [],
      fridge: 0, pot: 0, steamT: 0, light: true, starT: 0, bubbles: [], doorOpen: 0, lampSwing: 0,
    };
    else this.room = {
      cribs: [{ i: 0, spin: 0, spinV: 0 }, { i: 1, spin: 0, spinV: 0 }], tower: null, towerT: 0, horse: 0,
      ball: { x: null, y: 0, z: 0, vx: 0, vz: 0, rot: 0 }, teddy: 0, light: true, starT: 0,
      xylo: [0, 0, 0, 0, 0, 0], bubbles: [], doorOpen: 0, lampSwing: 0,
    };
  }
  cy() { return this.y - 22 * S; }
  occupants() { return babies.filter(b => b.home === this); }
  update(dt) {
    this.bounce = Math.max(0, this.bounce - dt * 1.5); this.door = Math.max(0, this.door - dt * 1.2);
    this.wTimer -= dt;
    if (this.wTimer <= 0) { [this.wx, this.wy] = wanderPoint(this); this.wTimer = rand(5, 9); }
    const dx = this.wx - this.x, dy = this.wy - this.y, d = Math.hypot(dx, dy) || 1, sp = Math.min(32 * S, d);
    this.vx += (dx / d * sp - this.vx) * Math.min(1, dt * 0.8); this.vy += (dy / d * sp - this.vy) * Math.min(1, dt * 0.8);
    const px = this.x - planet.x, py = this.cy() - planet.y, pd = Math.hypot(px, py) || 1, minD = planet.r + 95 * S;
    if (pd < minD) { const f = (minD - pd) * 60 * dt; this.vx += px / pd * f; this.vy += py / pd * f; }
    const m = 90 * S;
    if (this.x < m) this.vx += (m - this.x) * 6 * dt; if (this.x > W - m) this.vx -= (this.x - W + m) * 6 * dt;
    if (this.y < m + 30 * S) this.vy += (m + 30 * S - this.y) * 6 * dt; if (this.y > H - m) this.vy -= (this.y - H + m) * 6 * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (G.scene === 'space') {
      this.smokeT -= dt;
      if (this.smokeT <= 0) { this.smokeT = 0.35; addP({ kind: 'smoke', x: this.x + 35 * S, y: this.y - 98 * S, vx: rand(-8, 8) * S, vy: -30 * S, life: 1.4, size: 6 * S, color: '#fff', rot: 0, vr: 0, g: 0 }); }
    }
  }
  draw(hover, hint) {
    const k = S, born = clamp((t - this.born) * 1.8, 0, 1), sc0 = born < 1 ? Math.max(0.01, easeOutBack(born)) : 1;
    const sc = sc0 * (1 + Math.sin(this.bounce * Math.PI * 3) * 0.15 * this.bounce) * (hover ? 1.15 : 1);
    ctx.save(); ctx.translate(this.x, this.y + Math.sin(t * 1.3 + this.phase) * 6 * k);
    ctx.rotate(Math.sin(t * 0.8 + this.phase) * 0.06); ctx.scale(sc, sc);
    if (hover || hint) {
      const a = hover ? 0.6 : 0.3 + Math.sin(t * 6) * 0.2;
      const g = ctx.createRadialGradient(0, -20 * k, 20 * k, 0, -20 * k, 130 * k);
      g.addColorStop(0, `rgba(255,240,150,${a})`); g.addColorStop(1, 'rgba(255,240,150,0)'); ctx.fillStyle = g; circle(0, -20 * k, 130 * k);
    }
    for (const s of [-1, 1]) {
      const fl = 1 + Math.sin(t * 35 + s) * 0.15 + Math.random() * 0.1;
      ctx.fillStyle = '#ff8a3d'; ell(s * 32 * k, 62 * k + 6 * k * fl, 9 * k, 16 * k * fl);
      ctx.fillStyle = '#ffe27a'; ell(s * 32 * k, 58 * k + 4 * k * fl, 5 * k, 9 * k * fl);
      ctx.fillStyle = '#9aa3c7'; ctx.beginPath(); ctx.roundRect(s * 32 * k - 12 * k, 38 * k, 24 * k, 18 * k, 5 * k); ctx.fill();
    }
    ctx.fillStyle = '#c0705a'; ctx.fillRect(26 * k, -94 * k, 18 * k, 36 * k);
    ctx.fillStyle = '#a65a46'; ctx.fillRect(23 * k, -98 * k, 24 * k, 8 * k);
    ctx.fillStyle = this.wall; ctx.beginPath(); ctx.roundRect(-56 * k, -40 * k, 112 * k, 84 * k, 12 * k); ctx.fill();
    if (this.kind === 'canteen') {
      // полосатый навес-маркиза и круглая вывеска с тарелкой каши
      const n = 8, sw = 136 * k / n, ay = -64 * k, ah = 24 * k;
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = i % 2 ? '#fff' : this.roof;
        ctx.fillRect(-68 * k + i * sw, ay, sw + 0.5, ah); circle(-68 * k + i * sw + sw / 2, ay + ah, sw / 2);
      }
      ctx.fillStyle = this.roof; ctx.beginPath(); ctx.roundRect(-72 * k, ay - 8 * k, 144 * k, 10 * k, 5 * k); ctx.fill();
      ctx.fillStyle = '#fff'; circle(0, -92 * k, 24 * k);
      ctx.strokeStyle = this.roof; ctx.lineWidth = 5 * k; ctx.beginPath(); ctx.arc(0, -92 * k, 24 * k, 0, TAU); ctx.stroke();
      ctx.save(); ctx.translate(0, -92 * k); ctx.rotate(Math.sin(t * 2 + this.phase) * 0.1); drawFood('bowl', 15 * k); ctx.restore();
    } else {
      ctx.fillStyle = this.roof; ctx.strokeStyle = this.roof; ctx.lineWidth = 12 * k; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-66 * k, -36 * k); ctx.lineTo(0, -102 * k); ctx.lineTo(66 * k, -36 * k); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff3b0'; circle(0, -62 * k, 13 * k);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4 * k; ctx.beginPath(); ctx.arc(0, -62 * k, 13 * k, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#ffb84d'; ctx.save(); ctx.translate(0, -62 * k); starPath(5, 7 * k, 3 * k); ctx.fill(); ctx.restore();
    }
    const occ = this.occupants();
    [[-32, -12], [32, -12]].forEach(([wx, wy], i) => {
      wx *= k; wy *= k; const ww = 30 * k;
      ctx.save(); ctx.beginPath(); ctx.roundRect(wx - ww / 2, wy - ww / 2, ww, ww, 6 * k); ctx.fillStyle = '#fff3b0'; ctx.fill(); ctx.clip();
      const b = occ[i];
      if (b) { ctx.translate(wx, wy + 6 * k); drawHead(10 * k, b, b.sleeping() ? 'sleep' : b.blink > 0 ? 'blink' : 'open', { x: 0, y: 0 }); }
      ctx.restore();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4 * k; ctx.beginPath(); ctx.roundRect(wx - ww / 2, wy - ww / 2, ww, ww, 6 * k); ctx.stroke();
      ctx.fillStyle = this.roof; ctx.fillRect(wx - ww / 2 - 3 * k, wy + ww / 2, ww + 6 * k, 5 * k);
    });
    ctx.fillStyle = '#3a2540'; ctx.beginPath(); ctx.roundRect(-14 * k, 8 * k, 28 * k, 36 * k, [14 * k, 14 * k, 0, 0]); ctx.fill();
    ctx.save(); ctx.translate(-14 * k, 0); ctx.scale(1 - Math.max(this.door, hover ? 0.6 : 0) * 0.7, 1);
    ctx.fillStyle = this.roof; ctx.beginPath(); ctx.roundRect(0, 8 * k, 28 * k, 36 * k, [14 * k, 14 * k, 0, 0]); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fill();
    ctx.fillStyle = '#ffd66b'; circle(22 * k, 28 * k, 3 * k);
    ctx.restore();
    // лишние жильцы — сердечки над крышей
    const extra = Math.min(occ.length - 2, 8);
    for (let i = 0; i < extra; i++) {
      ctx.save(); ctx.translate((i - (extra - 1) / 2) * 14 * k, -118 * k + Math.sin(t * 3 + i) * 2 * k);
      ctx.fillStyle = '#ff7aa8'; heartPath(6 * k); ctx.restore();
    }
    // желания жильцов видны и снаружи
    occ.filter(b => b.wish).slice(0, 3).forEach((b, i) => drawWish(b, 92 * k, -50 * k - i * 46 * k, 0.6));
    ctx.restore();
  }
}

export function houseAt(x, y) {
  for (let i = houses.length - 1; i >= 0; i--) { const h = houses[i]; if (dist(x, y, h.x, h.cy()) < 85 * S) return h; }
  return null;
}

export function launchHouse(kind) {
  const b0 = btn.house; b0.press = 1;
  if (houses.length >= MAX_HOUSES) { b0.shake = 1; sfx.boop(); return; }
  const a = rand(-Math.PI * 0.85, -Math.PI * 0.15);
  const x = planet.x + Math.cos(a) * planet.r, y = planet.y + Math.sin(a) * planet.r;
  const h = new House(x, y, kind);
  h.vx = Math.cos(a) * 300 * S; h.vy = Math.sin(a) * 300 * S;
  h.wx = x + Math.cos(a) * 280 * S; h.wy = y + Math.sin(a) * 280 * S;
  houses.push(h);
  whoosh(1.1, 0.25); [392, 523, 659].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.14, delay: i * 0.15 }));
  planet.wob = 0.8; planet.laugh = 0.8;
  for (let i = 0; i < 16; i++) addP({ kind: 'smoke', x, y, vx: rand(-90, 90) * S, vy: rand(-90, 20) * S, life: rand(0.6, 1.2), size: rand(10, 20) * S, color: '#fff', rot: 0, vr: 0, g: 0 });
  burst(x, y, 'confetti', 24, { size: 7, speed: 260, g: 260 });
}

export function iconNursery(R) { ctx.translate(0, R * 0.05); drawToy('teddy', R * 0.95); }

export function iconCanteen(R) {
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = R * 0.07; ctx.lineCap = 'round';
  for (const dx of [-0.2, 0.05, 0.3]) { ctx.beginPath(); ctx.moveTo(R * dx, -R * 0.25); ctx.quadraticCurveTo(R * (dx + 0.12), -R * 0.42, R * dx, -R * 0.58 + Math.sin(t * 4 + dx * 9) * R * 0.04); ctx.stroke(); }
  ctx.translate(0, R * 0.12); drawFood('bowl', R * 0.55);
}

export function iconHouse(R) {
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(-R * 0.52, -R * 0.02); ctx.lineTo(0, -R * 0.5); ctx.lineTo(R * 0.52, -R * 0.02); ctx.closePath(); ctx.fill();
  ctx.fillRect(-R * 0.36, -R * 0.08, R * 0.72, R * 0.5);
  ctx.fillStyle = '#ffd66b'; ctx.beginPath(); ctx.roundRect(-R * 0.1, R * 0.1, R * 0.2, R * 0.32, [R * 0.1, R * 0.1, 0, 0]); ctx.fill();
  ctx.fillStyle = '#8fd3ff'; ctx.fillRect(-R * 0.3, 0, R * 0.14, R * 0.14); ctx.fillRect(R * 0.16, 0, R * 0.14, R * 0.14);
  ctx.fillStyle = '#ffe27a'; ell(-R * 0.2, R * 0.55, R * 0.06, R * 0.1 * (1 + Math.sin(t * 30) * 0.2)); ell(R * 0.2, R * 0.55, R * 0.06, R * 0.1 * (1 + Math.sin(t * 30 + 1) * 0.2));
}
