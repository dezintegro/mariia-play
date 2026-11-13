import { BR, H, S, TAU, W, clamp, ctx, dist, easeOutBack, pick, pointer, rand, t } from '../../core/canvas';
import { circle, ell, heartPath, starPath } from '../../core/draw';
import { addP, burst } from '../../core/particles';
import { drawFood } from './canteen';
import { TOYS4, isRider, toyBusy, updatePlay } from './nursery';
import { LAY, roomHead } from './room';
import { sfx } from './sounds';
import { planet } from './space';
import { G, RB } from './state';
import { tickBed } from './anim/crib';
import { tickEat } from './anim/eat';
import { satisfy } from './wishes';
import { tickPotty, tickTub } from './bath';

// ---------------- МАЛЫШИ ----------------
export const SKINS = ['#ffdcbf', '#f6c7a0', '#e5ad7f', '#c98d62', '#ffe6d1'];

export const ONESIES = ['#ff9ec7', '#8fd3ff', '#ffd66b', '#a8e6a1', '#c9a7ff', '#ffb38a'];

export const HAIRS = ['#6b4226', '#2b1d14', '#e8c26a', '#b5562b'];


export class Baby {
  [key: string]: any; // поля задаются в конструкторе (type, x, y, home, wish, play, eat, …)
  constructor(type, x, y) {
    Object.assign(this, { type, x, y, vx: 0, vy: 0 });
    this.skin = pick(SKINS); this.color = pick(ONESIES); this.hair = pick(HAIRS);
    this.spin = 0; this.spinLeft = 0; this.bounce = 0; this.laugh = 0; this.happy = 0; this.awake = 0;
    this.blink = 0; this.blinkT = rand(1, 4); this.zT = rand(0, 2); this.trailT = 0; this.beamT = 0; this.rockT = 0;
    this.wx = x; this.wy = y; this.wTimer = rand(0, 2); this.phase = rand(0, TAU); this.face = 1;
    this.target = null; this.toy = null; this.born = -10;
    // жизнь внутри дома
    this.home = null; this.dragged = false; this.crib = null;
    this.ix = 0; this.iy = 0; this.iwx = 0; this.iwy = 0; this.iwT = 0; this.ifall = false; this.ivy = 0; this.ifloor = 0;
    // анимации по тапу, желания, игра, еда
    this.tapN = 0; this.anim = null; this.love = 0; this.wish = null; this.wishT = rand(15, 45);
    this.chair = null; this.play = null; this.eat = null; this.eatPending = false;
  }
  hitR() { return BR * ({ rocket: 2.3, ufo: 2.4, bubble: 2.2, moon: 2.7, suit: 2.0 }[this.type]); }
  sleeping() {
    if (this.dragged || this.love > 0 || this.eat || this.eatPending || this.play) return false;
    if (this.home) return (this.crib || !this.home.room.light) && this.awake <= 0 && this.laugh <= 0;
    return (G.night > 0.5 || this.type === 'moon') && this.awake <= 0 && this.laugh <= 0;
  }
  visible() { return G.scene === 'space' ? !this.home : this.home === G.curHouse; }
  tick(dt) {
    this.laugh = Math.max(0, this.laugh - dt); this.happy = Math.max(0, this.happy - dt);
    this.awake = Math.max(0, this.awake - dt); this.bounce = Math.max(0, this.bounce - dt * 1.6);
    this.beamT = Math.max(0, this.beamT - dt); this.rockT = Math.max(0, this.rockT - dt);
    this.blinkT -= dt; if (this.blinkT <= 0) { this.blink = 0.15; this.blinkT = rand(2, 5); }
    this.blink = Math.max(0, this.blink - dt);
    this.love = Math.max(0, this.love - dt);
    if (this.anim) { this.anim.t -= dt; if (this.anim.t <= 0) this.anim = null; }
    tickEat(this, dt); tickBed(this, dt); // «спектакли» еды и засыпания (anim/eat.ts, anim/crib.ts)
    if (this.spinLeft > 0) { const st = Math.min(this.spinLeft, dt * 9); this.spin += st; this.spinLeft -= st; if (this.spinLeft <= 0) this.spin = 0; }
    if (this.sleeping() && this.visible()) {
      this.zT -= dt;
      if (this.zT <= 0) {
        this.zT = rand(1.4, 2.4);
        const [zx, zy] = this.home ? [this.ix + BR, this.iy - BR * 3.2] : [this.x + BR, this.y - BR * 1.5];
        addP({ kind: 'z', x: zx, y: zy, vx: 18 * S, vy: -28 * S, life: 2.2, size: rand(14, 20) * S, color: '#e6e0ff', rot: 0, vr: 0, g: 0 });
      }
    }
  }
  // жизнь в комнате: ползает по полу, спит в кроватке
  updateIn(dt) {
    this.tick(dt);
    if (this.dragged) return;
    const h = this.home, L = LAY(h);
    if (this.crib) { const c = L.cribs[this.crib.i]; this.ix = c.x - L.cw * 0.18; this.iy = c.y - 38 * S; return; }
    if (this.chair) { const c = L.chairs[this.chair.i]; this.ix = c.x; this.iy = c.y; return; }
    if (this.tub) { tickTub(this, dt, L); return; }
    if (this.potty) { tickPotty(this, dt, L); return; }
    if (this.ifall) {
      this.ivy += 1500 * S * dt; this.iy += this.ivy * dt;
      if (this.iy >= this.ifloor) { this.iy = this.ifloor; this.ifall = false; this.bounce = 1; if (this.visible()) sfx.boop(); }
      return;
    }
    if (this.play) { updatePlay(this, dt, L); return; }
    if (this.eat || this.eatPending) return;
    this.iwT -= dt;
    if (this.iwT <= 0) {
      this.iwx = rand(L.bx0, L.bx1); this.iwy = rand(L.by0, L.by1); this.iwT = rand(3, 7);
      // сам иногда ползёт поиграть с большой игрушкой (если ничего не просит)
      if (h.kind === 'nursery' && !this.wish && this.visible() && !this.sleeping() && Math.random() < 0.3) {
        const free = TOYS4.filter(k => !toyBusy(h, k)); if (free.length) this.play = { k: pick(free), phase: 'go', t: 9 };
      }
    }
    if (this.sleeping()) return;
    const dx = this.iwx - this.ix, dy = this.iwy - this.iy, d = Math.hypot(dx, dy);
    if (d > 3) { const sp = Math.min(38 * S, d) * dt; this.ix += dx / d * sp; this.iy += dy / d * sp; if (Math.abs(dx) > 2) this.face = Math.sign(dx); }
  }
  update(dt) {
    this.tick(dt);
    if (this.dragged) { this.vx = this.vy = 0; return; }
    const sleep = this.sleeping();
    if (this.target && (this.target.held || this.target.dead)) this.target = null;
    this.wTimer -= dt;
    if (this.wTimer <= 0) { [this.wx, this.wy] = wanderPoint(this); this.wTimer = this.type === 'rocket' ? rand(1.8, 3.2) : rand(4, 8); }
    let tx = this.wx, ty = this.wy, max;
    if (this.target) { tx = this.target.x; ty = this.target.y; max = 330 * S; }
    else max = ({ rocket: 230, moon: 16, ufo: 55 }[this.type] || 42) * S * (sleep ? 0.35 : 1);
    const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy) || 1, sp = Math.min(max, d * 1.2);
    const k = this.target ? 3 : this.type === 'rocket' ? 1.3 : 0.8;
    this.vx += (dx / d * sp - this.vx) * Math.min(1, dt * k);
    this.vy += (dy / d * sp - this.vy) * Math.min(1, dt * k);
    // не врезаться в планету
    const px = this.x - planet.x, py = this.y - planet.y, pd = Math.hypot(px, py) || 1, minD = planet.r + this.hitR() * 0.8;
    if (pd < minD) { const f = (minD - pd) * 10 * dt; this.vx += px / pd * f * 10; this.vy += py / pd * f * 10; }
    // мягкие границы экрана
    const m = this.hitR();
    if (this.x < m) this.vx += (m - this.x) * 6 * dt; if (this.x > W - m) this.vx -= (this.x - W + m) * 6 * dt;
    if (this.y < m) this.vy += (m - this.y) * 6 * dt; if (this.y > H - m) this.vy -= (this.y - H + m) * 6 * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (Math.abs(this.vx) > 8 * S) this.face = Math.sign(this.vx);
    if (this.type === 'rocket' && G.scene === 'space') {
      this.trailT -= dt;
      if (this.trailT <= 0) {
        this.trailT = 0.035;
        const tilt = this.tilt(), back = BR * 2.3;
        const tx2 = this.x - this.face * Math.cos(tilt) * back, ty2 = this.y - Math.sin(tilt) * back;
        addP({ kind: Math.random() < 0.5 ? 'smoke' : 'spark', x: tx2, y: ty2, vx: -this.vx * 0.2 + rand(-15, 15) * S, vy: -this.vy * 0.2 + rand(-15, 15) * S,
          life: rand(0.5, 0.9), size: rand(5, 9) * S, color: pick(['#ffd66b', '#ff9a5a', '#fff']), rot: 0, vr: 0, g: 0 });
      }
    }
    // поймал игрушку?
    if (this.target && dist(this.x, this.y, this.target.x, this.target.y) < BR * 1.8) {
      const toy = this.target; toy.held = this; this.toy = toy; this.target = null;
      this.happy = 4; this.laugh = 1.2; this.bounce = 1; this.awake = 5;
      if (G.scene === 'space') { sfx.yay(); burst(this.x, this.y, 'heart', 7, { size: 9, speed: 120, up: -60, color: '#ff7aa8' }); }
      satisfy(this, 'play');
    }
  }
  tilt() { return clamp(Math.atan2(this.vy, Math.abs(this.vx) + 1), -0.6, 0.6); }
  draw() {
    const r = BR;
    const born = clamp((t - this.born) * 1.8, 0, 1), sc = born < 1 ? Math.max(0.01, easeOutBack(born)) : 1;
    const bob = Math.sin(t * 1.6 + this.phase) * 6 * S;
    const bnc = (1 + Math.sin(this.bounce * Math.PI * 3) * 0.22 * this.bounce) * (this.dragged ? 1.15 : 1);
    const sleep = this.sleeping();
    const mood = this.love > 0 ? 'love' : this.laugh > 0 || this.dragged ? 'laugh' : sleep ? 'sleep' : this.blink > 0 ? 'blink' : 'open';
    const look = { x: clamp((pointer.x - this.x) / (250 * S), -1, 1) * this.face, y: clamp((pointer.y - this.y) / (250 * S), -1, 1) };
    const near = dist(pointer.x, pointer.y, this.x, this.y) < 170 * S;
    let waveL, waveR;
    if (this.laugh > 0 || this.love > 0) { waveL = waveR = 1.9 + Math.sin(t * 14) * 0.3; }
    else if (!sleep && (this.happy > 0 || near)) { waveR = 1.7 + Math.sin(t * 11) * 0.5; waveL = 0.4; }
    else { waveL = 0.3 + Math.sin(t * 2 + this.phase) * 0.2; waveR = 0.3 + Math.sin(t * 2 + this.phase + 1) * 0.2; }
    if (this.love > 0) halo(this.x, this.y + bob, this.hitR() * 1.5, this.love);
    const X = animXf(this);
    ctx.save();
    ctx.translate(this.x, this.y + bob + X.dy); ctx.rotate(X.rot); ctx.scale(X.sx, X.sy);
    ctx.scale(sc * bnc, sc * bnc);
    const T = this.type;
    if (T === 'rocket') { ctx.scale(this.face, 1); ctx.rotate(this.tilt() + this.spin); drawRocketBaby(r, this, mood, look); }
    else if (T === 'suit') { ctx.rotate(Math.sin(t * 0.7 + this.phase) * 0.25 + this.spin); drawSuitBaby(r, this, mood, look, waveL, waveR); }
    else if (T === 'ufo') { ctx.rotate(Math.sin(t * 2 + this.phase) * 0.07 + this.spin); drawUfoBaby(r, this, mood, look); }
    else if (T === 'bubble') { ctx.rotate(Math.sin(t * 0.9 + this.phase) * 0.12 + this.spin); drawBubbleBaby(r, this, mood, look); }
    else if (T === 'moon') { ctx.rotate(Math.sin(t * 1.2) * 0.1 + Math.sin(this.rockT * 12) * this.rockT * 0.25); drawMoonBaby(r, this, mood, look); }
    ctx.restore();
  }
}

export function wanderPoint(b) {
  for (let i = 0; i < 30; i++) {
    const m = 80 * S, x = rand(m, W - m), y = b.type === 'moon' ? rand(H * 0.1, H * 0.26) : rand(m, H - m);
    if (dist(x, y, planet.x, planet.y) > planet.r + 120 * S) return [x, y];
  }
  return [rand(W * 0.1, W * 0.9), H * 0.15];
}

// ----- отдельные малыши -----
export function drawHead(r, b, mood, look, o: any = {}) {
  ctx.fillStyle = b.skin;
  circle(-r * 0.93, r * 0.08, r * 0.2); circle(r * 0.93, r * 0.08, r * 0.2);
  circle(0, 0, r);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(120,60,40,0.08)');
  ctx.fillStyle = g; circle(0, 0, r);
  ctx.lineCap = 'round';
  if (!o.noHair) { ctx.strokeStyle = b.hair; ctx.lineWidth = r * 0.11; ctx.beginPath(); ctx.arc(r * 0.1, -r * 1.0, r * 0.16, Math.PI * 0.6, Math.PI * 2.2); ctx.stroke(); }
  if (o.cheeks) { const q = o.cheeks; ctx.fillStyle = b.skin; for (const s of [-1, 1]) circle(s * r * (0.5 + q * 0.08), r * 0.3, r * (0.2 + q * 0.12)); }
  ctx.fillStyle = 'rgba(255,110,140,0.45)';
  ell(-r * 0.55, r * 0.32, r * 0.19, r * 0.13); ell(r * 0.55, r * 0.32, r * 0.19, r * 0.13);
  const ex = r * 0.36, ey = -r * 0.02;
  ctx.strokeStyle = '#3a2540'; ctx.lineWidth = r * 0.085;
  if (mood === 'sleep' || mood === 'blink') {
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * ex, ey - r * 0.05, r * 0.13, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
  } else if (mood === 'laugh' || mood === 'eat') {
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * ex, ey + r * 0.08, r * 0.13, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke(); }
  } else if (mood === 'love') {
    ctx.fillStyle = '#ff3d6e';
    for (const s of [-1, 1]) { ctx.save(); ctx.translate(s * ex, ey + r * 0.1); const p = 1 + Math.sin(t * 12) * 0.15; ctx.scale(p, p); heartPath(r * 0.22); ctx.restore(); }
  } else {
    const lx = look.x * r * 0.07, ly = look.y * r * 0.06;
    ctx.fillStyle = '#2a1b3d'; for (const s of [-1, 1]) ell(s * ex + lx, ey + ly, r * 0.12, r * 0.15);
    ctx.fillStyle = '#fff'; for (const s of [-1, 1]) circle(s * ex + lx + r * 0.04, ey + ly - r * 0.05, r * 0.045);
  }
  if (mood === 'laugh' || mood === 'love') {
    ctx.fillStyle = '#c93d5c'; ctx.beginPath(); ctx.arc(0, r * 0.3, r * 0.24, 0, Math.PI); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff8fa6'; ell(0, r * 0.46, r * 0.12, r * 0.06);
  } else if (mood === 'eat') {
    if (Math.sin(t * 16) > 0) { ctx.fillStyle = '#c93d5c'; ell(0, r * 0.4, r * 0.15, r * 0.13); }
    else { ctx.strokeStyle = '#3a2540'; ctx.beginPath(); ctx.arc(0, r * 0.3, r * 0.14, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,110,140,0.35)'; ell(-r * 0.5, r * 0.36, r * 0.22, r * 0.16); ell(r * 0.5, r * 0.36, r * 0.22, r * 0.16);
  } else if (o.yawn) {
    ctx.fillStyle = '#c93d5c'; ell(0, r * 0.38, r * 0.13 + o.yawn * r * 0.05, r * 0.08 + o.yawn * r * 0.16);
  } else if (o.paci) {
    ctx.fillStyle = '#7ec8ff'; ell(0, r * 0.45, r * 0.27, r * 0.15);
    ctx.strokeStyle = '#ffd66b'; ctx.lineWidth = r * 0.06; ctx.beginPath(); ctx.arc(0, r * 0.62, r * 0.11, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#fff'; circle(0, r * 0.43, r * 0.07);
  } else if (mood === 'sleep') {
    ctx.fillStyle = '#c93d5c'; circle(0, r * 0.4, r * 0.07);
  } else {
    ctx.strokeStyle = '#3a2540'; ctx.beginPath(); ctx.arc(0, r * 0.28, r * 0.2, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
  }
}

/**
 * Тело малыша в координатах головы (центр головы = 0,0; ноги вниз до ~2.4r).
 * waveL/waveR — подъём рук (0 — вдоль тела, ~1.6 — в стороны, ~2.6 — вверх).
 * legs: { legL, legR } — поворот ног от бедра (рад, + = вперёд/вверх для правой... см. armHand/legFoot).
 */
export function drawBody(r, b, waveL, waveR, suit, legs: any = {}) {
  const c = suit ? '#eef1fb' : b.color, hand = suit ? '#aab3d6' : b.skin;
  for (const s of [-1, 1]) {
    const a = (s < 0 ? legs.legL : legs.legR) || 0;
    ctx.save(); ctx.translate(s * r * 0.3, r * 1.75); ctx.rotate(-s * a);
    ctx.fillStyle = c; ell(s * r * 0.06, r * 0.25, r * 0.27, r * 0.38, s * -0.25);
    ctx.fillStyle = hand; ell(s * r * 0.16, r * 0.58, r * 0.22, r * 0.15);
    ctx.restore();
  }
  for (const s of [-1, 1]) {
    ctx.save(); ctx.translate(s * r * 0.55, r * 1.05); ctx.rotate(-s * (0.55 + (s < 0 ? waveL : waveR)));
    ctx.fillStyle = c; ell(0, r * 0.35, r * 0.2, r * 0.38);
    ctx.fillStyle = hand; circle(0, r * 0.72, r * 0.17);
    ctx.restore();
  }
  ctx.fillStyle = c; ell(0, r * 1.42, r * 0.7, r * 0.72);
  if (suit) {
    ctx.fillStyle = b.color; ctx.fillRect(-r * 0.67, r * 1.5, r * 1.34, r * 0.16);
    ctx.fillStyle = '#ffd66b'; circle(0, r * 1.15, r * 0.14);
    ctx.fillStyle = '#ff7aa8'; circle(-r * 0.32, r * 1.2, r * 0.07); ctx.fillStyle = '#7ec8ff'; circle(r * 0.32, r * 1.2, r * 0.07);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.65)'; circle(0, r * 1.2, r * 0.07); circle(0, r * 1.5, r * 0.07);
  }
}

export function drawSuitBaby(r, b, mood, look, wl, wr) {
  ctx.translate(0, -r * 1.0);
  ctx.fillStyle = '#b8c0dd'; ctx.beginPath(); ctx.roundRect(-r * 0.75, r * 0.75, r * 1.5, r * 1.3, r * 0.3); ctx.fill();
  drawBody(r, b, wl, wr, true);
  drawHead(r, b, mood, look);
  // шлем
  ctx.fillStyle = 'rgba(170,220,255,0.2)'; circle(0, 0, r * 1.32);
  ctx.strokeStyle = '#e4ecff'; ctx.lineWidth = r * 0.11; ctx.beginPath(); ctx.arc(0, 0, r * 1.32, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = r * 0.09; ctx.beginPath(); ctx.arc(0, 0, r * 1.08, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
  ctx.strokeStyle = '#e4ecff'; ctx.lineWidth = r * 0.08; ctx.beginPath(); ctx.moveTo(r * 0.75, -r * 1.08); ctx.lineTo(r * 1.05, -r * 1.65); ctx.stroke();
  ctx.fillStyle = Math.sin(t * 5 + b.phase) > 0 ? '#ff5d73' : '#ffd66b'; circle(r * 1.05, -r * 1.65, r * 0.15);
}

export function drawRocketBaby(r, b, mood, look) {
  // шарф
  ctx.strokeStyle = '#ff5d73'; ctx.lineWidth = r * 0.22; ctx.lineCap = 'round'; ctx.beginPath();
  for (let i = 0; i <= 6; i++) ctx.lineTo(-r * 0.3 - i * r * 0.3, -r * 1.2 + Math.sin(t * 12 - i * 0.9) * r * 0.06 * i);
  ctx.stroke();
  // пламя
  const fl = 1 + Math.sin(t * 40) * 0.12 + Math.random() * 0.12;
  ctx.fillStyle = '#ff8a3d'; ell(-r * 1.8 - r * 0.55 * fl, 0, r * 0.65 * fl, r * 0.36);
  ctx.fillStyle = '#ffe27a'; ell(-r * 1.8 - r * 0.3 * fl, 0, r * 0.38 * fl, r * 0.2);
  // плавники
  ctx.fillStyle = '#ff5d73';
  ctx.beginPath(); ctx.moveTo(-r * 1.0, -r * 0.45); ctx.lineTo(-r * 1.9, -r * 1.1); ctx.lineTo(-r * 1.7, -r * 0.2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-r * 1.0, r * 0.45); ctx.lineTo(-r * 1.9, r * 1.1); ctx.lineTo(-r * 1.7, r * 0.2); ctx.closePath(); ctx.fill();
  // корпус
  ctx.save();
  ctx.beginPath(); ctx.ellipse(0, 0, r * 1.85, r * 0.64, 0, 0, TAU); ctx.fillStyle = '#f4f4fb'; ctx.fill(); ctx.clip();
  ctx.fillStyle = '#ff5d73'; ctx.fillRect(r * 1.05, -r, r * 2, r * 2);
  ctx.fillStyle = b.color; ctx.fillRect(-r * 0.95, -r, r * 0.3, r * 2);
  ctx.fillStyle = 'rgba(80,90,160,0.15)'; ctx.fillRect(-r * 2, r * 0.25, r * 4, r);
  ctx.restore();
  ctx.fillStyle = '#7cc8ff'; circle(r * 0.4, 0, r * 0.27);
  ctx.strokeStyle = '#c9d3ea'; ctx.lineWidth = r * 0.08; ctx.beginPath(); ctx.arc(r * 0.4, 0, r * 0.27, 0, TAU); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; circle(r * 0.32, -r * 0.08, r * 0.07);
  // малыш верхом
  ctx.fillStyle = b.color; ell(-r * 0.35, -r * 0.92, r * 0.55, r * 0.5);
  ctx.fillStyle = b.color; ell(-r * 0.05, -r * 0.5, r * 0.2, r * 0.32, -0.5);
  ctx.fillStyle = b.skin; ell(r * 0.12, -r * 0.25, r * 0.17, r * 0.12);
  ctx.fillStyle = b.color; ell(r * 0.15, -r * 1.0, r * 0.38, r * 0.15, 0.35);
  ctx.fillStyle = b.skin; circle(r * 0.5, -r * 0.86, r * 0.15);
  ctx.save(); ctx.translate(-r * 0.3, -r * 1.75); ctx.scale(0.78, 0.78);
  drawHead(r, b, mood, look, { noHair: true });
  ctx.fillStyle = '#8a5a3b'; ctx.beginPath(); ctx.arc(0, -r * 0.05, r * 1.04, Math.PI * 1.03, Math.PI * 1.97); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#9be7ff'; ctx.strokeStyle = '#5b3a26'; ctx.lineWidth = r * 0.09;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * r * 0.35, -r * 0.55, r * 0.22, 0, TAU); ctx.fill(); ctx.stroke(); }
  ctx.restore();
}

export function drawUfoBaby(r, b, mood, look) {
  if (b.beamT > 0) {
    const a = Math.min(1, b.beamT) * 0.45;
    const g = ctx.createLinearGradient(0, r * 0.4, 0, r * 4.5);
    g.addColorStop(0, `rgba(180,255,200,${a})`); g.addColorStop(1, 'rgba(180,255,200,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-r * 0.9, r * 0.4); ctx.lineTo(r * 0.9, r * 0.4); ctx.lineTo(r * 2.2, r * 4.5); ctx.lineTo(-r * 2.2, r * 4.5); ctx.closePath(); ctx.fill();
  }
  ctx.save(); ctx.translate(0, -r * 0.55); ctx.scale(0.75, 0.75); drawHead(r, b, mood, look); ctx.restore();
  ctx.fillStyle = 'rgba(160,230,255,0.25)'; ctx.beginPath(); ctx.arc(0, 0, r * 1.4, Math.PI, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(230,245,255,0.9)'; ctx.lineWidth = r * 0.08; ctx.beginPath(); ctx.arc(0, 0, r * 1.4, Math.PI, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(0, 0, r * 1.15, Math.PI * 1.15, Math.PI * 1.4); ctx.stroke();
  ctx.fillStyle = '#c3cbe6'; ell(0, r * 0.2, r * 2.4, r * 0.62);
  ctx.fillStyle = '#8d97c2'; ell(0, r * 0.42, r * 1.6, r * 0.35);
  ctx.fillStyle = '#e3e8f8'; ell(0, r * 0.02, r * 2.0, r * 0.26);
  for (let i = 0; i < 5; i++) { ctx.fillStyle = `hsl(${(t * 220 + i * 72) % 360},90%,68%)`; circle(-r * 1.6 + i * r * 0.8, r * 0.3, r * 0.14); }
}

export function drawBubbleBaby(r, b, mood, look) {
  const w = Math.sin(t * 3 + b.phase) * 0.035 + Math.sin(b.bounce * 14) * b.bounce * 0.12;
  ctx.fillStyle = b.color; ell(0, r * 0.5, r * 0.85, r * 0.6);
  ctx.fillStyle = b.skin; ell(-r * 0.6, r * 0.95, r * 0.22, r * 0.15); ell(r * 0.6, r * 0.95, r * 0.22, r * 0.15);
  ctx.save(); ctx.translate(0, -r * 0.5); ctx.scale(0.85, 0.85); drawHead(r, b, mood, look, { paci: mood !== 'laugh' }); ctx.restore();
  ctx.fillStyle = b.skin; circle(-r * 0.75, r * 0.1, r * 0.17); circle(r * 0.75, r * 0.1, r * 0.17);
  ctx.save(); ctx.scale(1 + w, 1 - w);
  const g = ctx.createRadialGradient(-r * 0.6, -r * 0.7, r * 0.2, 0, 0, r * 2.1);
  g.addColorStop(0, 'rgba(255,255,255,0.12)'); g.addColorStop(0.75, 'rgba(190,225,255,0.06)'); g.addColorStop(1, 'rgba(210,190,255,0.35)');
  ctx.fillStyle = g; circle(0, 0, r * 2.1);
  ctx.strokeStyle = `hsla(${(t * 60 + b.phase * 50) % 360},90%,80%,0.8)`; ctx.lineWidth = r * 0.07; ctx.beginPath(); ctx.arc(0, 0, r * 2.1, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = r * 0.12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, r * 1.75, Math.PI * 1.12, Math.PI * 1.38); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; circle(r * 1.2, -r * 1.25, r * 0.1);
  ctx.restore();
}

export function drawMoonBaby(r, b, mood, look) {
  const R = r * 2.5;
  // свечение
  const g = ctx.createRadialGradient(0, 0, R * 0.5, 0, 0, R * 1.5);
  g.addColorStop(0, 'rgba(255,230,140,0.25)'); g.addColorStop(1, 'rgba(255,230,140,0)'); ctx.fillStyle = g; circle(0, 0, R * 1.5);
  // малыш в колыбели
  ctx.fillStyle = '#8fd3ff'; ell(r * 0.45, r * 0.55, r * 1.35, r * 0.55, -0.05);
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; for (const [x, y] of [[0, 0.4], [0.6, 0.7], [1.2, 0.45], [0.3, 0.85]]) circle(r * x, r * y, r * 0.08);
  ctx.save(); ctx.translate(-r * 1.0, r * 0.15); ctx.rotate(-0.25); ctx.scale(0.8, 0.8);
  drawHead(r, b, mood, look, { noHair: true });
  ctx.fillStyle = '#c9a7ff'; ctx.beginPath(); ctx.moveTo(-r * 0.95, -r * 0.35); ctx.quadraticCurveTo(0, -r * 1.35, r * 0.95, -r * 0.35);
  ctx.quadraticCurveTo(r * 0.9, -r * 1.9, r * 1.9, -r * 1.3); ctx.quadraticCurveTo(r * 0.2, -r * 1.5, -r * 0.95, -r * 0.35); ctx.fill();
  ctx.fillStyle = '#fff'; circle(r * 1.9, -r * 1.3, r * 0.22);
  ctx.restore();
  // полумесяц
  ctx.save();
  ctx.beginPath(); ctx.rect(-R * 3, -R * 3, R * 6, R * 6); ctx.arc(0, -R * 0.45, R * 0.9, 0, TAU, true); ctx.clip('evenodd');
  const mg = ctx.createRadialGradient(-R * 0.3, R * 0.2, R * 0.1, 0, 0, R);
  mg.addColorStop(0, '#fff3b8'); mg.addColorStop(1, '#ffd25e'); ctx.fillStyle = mg; circle(0, 0, R);
  ctx.fillStyle = 'rgba(230,170,60,0.35)'; circle(-R * 0.5, R * 0.62, R * 0.09); circle(R * 0.55, R * 0.6, R * 0.07); circle(R * 0.1, R * 0.82, R * 0.06);
  ctx.restore();
  // лицо луны
  ctx.strokeStyle = '#c98a2a'; ctx.lineWidth = r * 0.08; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(R * 0.62, R * 0.38, r * 0.14, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  ctx.beginPath(); ctx.arc(R * 0.45, R * 0.62, r * 0.2, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
  ctx.fillStyle = 'rgba(255,130,120,0.4)'; ell(R * 0.78, R * 0.55, r * 0.16, r * 0.1);
}

export function drawAccessory(r, b) {
  if (b.type === 'rocket') {
    ctx.fillStyle = '#8a5a3b'; ctx.beginPath(); ctx.arc(0, -r * 0.05, r * 1.04, Math.PI * 1.03, Math.PI * 1.97); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#9be7ff'; ctx.strokeStyle = '#5b3a26'; ctx.lineWidth = r * 0.09;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * r * 0.35, -r * 0.55, r * 0.22, 0, TAU); ctx.fill(); ctx.stroke(); }
  } else if (b.type === 'moon') {
    ctx.fillStyle = '#c9a7ff'; ctx.beginPath(); ctx.moveTo(-r * 0.95, -r * 0.35); ctx.quadraticCurveTo(0, -r * 1.35, r * 0.95, -r * 0.35);
    ctx.quadraticCurveTo(r * 0.9, -r * 1.9, r * 1.9, -r * 1.3); ctx.quadraticCurveTo(r * 0.2, -r * 1.5, -r * 0.95, -r * 0.35); ctx.fill();
    ctx.fillStyle = '#fff'; circle(r * 1.9, -r * 1.3, r * 0.22);
  } else if (b.type === 'ufo') {
    ctx.strokeStyle = '#7be08a'; ctx.lineWidth = r * 0.1; ctx.lineCap = 'round';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * 0.4, -r * 0.85); ctx.lineTo(s * r * 0.65, -r * 1.45); ctx.stroke(); }
    ctx.fillStyle = '#ffd66b'; circle(-r * 0.65, -r * 1.45, r * 0.15); circle(r * 0.65, -r * 1.45, r * 0.15);
  }
  // suit: в комнате шлем снят — антенна была на шлеме, поэтому на голове её нет
}

export function babyMood(b) { return b.love > 0 ? 'love' : b.laugh > 0 || b.dragged ? 'laugh' : b.eat ? 'eat' : b.sleeping() ? 'sleep' : b.blink > 0 ? 'blink' : 'open'; }

export function drawRoomBaby(b) { drawRoomBabyAt(b, b.ix, b.iy, !b.dragged && !b.ifall); }

export function drawRoomBabyAt(b, ox, oy, shadow) {
  const r = RB(), sleep = b.sleeping(), mood = babyMood(b);
  const bnc = (1 + Math.sin(b.bounce * Math.PI * 3) * 0.2 * b.bounce) * (b.dragged ? 1.12 : 1);
  const hy = oy - r * 2.4;
  const look = { x: clamp((pointer.x - ox) / (250 * S), -1, 1), y: clamp((pointer.y - hy) / (250 * S), -1, 1) };
  let wl, wr;
  if (b.dragged || b.laugh > 0 || b.love > 0 || (b.play && b.play.phase === 'do')) { wl = wr = 1.9 + Math.sin(t * 14) * 0.3; }
  else if (b.eat) { wl = wr = 2.5 + Math.sin(t * 16) * 0.1; }
  else if (sleep) { wl = wr = 0.15; }
  else { const near = dist(pointer.x, pointer.y, ox, hy) < 150 * S; wr = near ? 1.7 + Math.sin(t * 11) * 0.5 : 0.3 + Math.sin(t * 2 + b.phase) * 0.2; wl = 0.3 + Math.sin(t * 2 + b.phase + 1) * 0.2; }
  if (shadow) { ctx.fillStyle = 'rgba(80,40,20,0.18)'; ell(ox, oy, r * 0.9, r * 0.22); }
  const still = sleep || b.dragged || b.chair || b.tub || b.potty || b.eat || isRider(b);
  const crawl = !still ? Math.abs(Math.sin(t * 5 + b.phase)) * 3 * S : 0;
  if (b.love > 0) halo(ox, hy + r * 0.6, r * 2.6, b.love);
  const X = animXf(b);
  ctx.save(); ctx.translate(ox, oy + X.dy); ctx.scale(bnc * X.sx, bnc * X.sy);
  ctx.translate(0, -r * 1.2); ctx.rotate(X.rot); ctx.translate(0, r * 1.2);
  ctx.translate(0, -r * 2.4 - crawl); ctx.rotate(b.dragged ? Math.sin(t * 6) * 0.15 : 0);
  const P = b.pose; // поза от «спектакля» игры (см. ниже POSE)
  if (P) {
    if (P.armL != null) wl = P.armL; if (P.armR != null) wr = P.armR;
    ctx.translate(P.dx || 0, P.dy || 0); ctx.rotate(P.lean || 0);
  }
  if (P && P.back) P.back(r);
  drawBody(r, b, wl, wr, false, P || {});
  if (P && P.front) P.front(r); // перед телом, но за головой (например, предмет в руках у груди)
  ctx.save(); if (P && P.headTilt) ctx.rotate(P.headTilt);
  drawHead(r, b, (P && P.mood) || mood, look, { noHair: b.type === 'rocket' || b.type === 'moon', paci: b.type === 'bubble' && mood !== 'laugh', ...(P && P.face) });
  drawAccessory(r, b);
  ctx.restore();
  if (P && P.top) P.top(r); // поверх всего (предмет у рта, ладошки на глазах)
  if (b.eat && !(P && P.ownsFood)) { const pr = 1 - b.eat.t / b.eat.d; ctx.save(); ctx.translate(0, r * 0.7); const q = Math.max(0.05, 1 - pr * 0.85); ctx.scale(q, q); drawFood(b.eat.k, r * 0.42); ctx.restore(); }
  ctx.restore();
}

/*
 * POSE — как управлять малышом в комнате из логики игры (b.pose = {...} каждый кадр, null — обычное поведение):
 *   armL/armR  подъём рук (см. drawBody), legL/legR поворот ног,
 *   dx/dy      сдвиг всего малыша (в координатах головы, px), lean — наклон тела, headTilt — наклон головы,
 *   mood       'open'|'blink'|'laugh'|'sleep'|'love'|'eat' — выражение лица,
 *   face       доп. опции drawHead: { cheeks: 0..1 (надутые щёки), yawn: 0..1 (зевок) },
 *   back(r)/front(r)/top(r) — дорисовать предмет за телом / перед телом / поверх головы,
 *   ownsFood   true — еду в руках рисует сама поза (через front/top), а не стандартный код.
 * Координаты рук/ног для предметов: armHand(r, side, wave), legFoot(r, side, a).
 */
export function armHand(r, side: -1 | 1, wave: number): [number, number] {
  const a = -side * (0.55 + wave);
  return [side * r * 0.55 - Math.sin(a) * r * 0.72, r * 1.05 + Math.cos(a) * r * 0.72];
}
export function legFoot(r, side: -1 | 1, legA = 0): [number, number] {
  const a = -side * legA, fx = side * r * 0.16, fy = r * 0.58;
  return [side * r * 0.3 + fx * Math.cos(a) - fy * Math.sin(a), r * 1.75 + fx * Math.sin(a) + fy * Math.cos(a)];
}

// три разные реакции малыша на тап — по кругу: кувырок, танец, прыжок
export function tapBaby(b) {
  const n = b.tapN++ % 3;
  b.bounce = 1; b.laugh = 1.6; b.awake = 3;
  if (n === 0) {
    if (b.type === 'moon') { b.rockT = 1.5; sfx.giggle(1.15); }
    else { b.spinLeft = TAU; sfx.giggle(b.type === 'rocket' ? 0.9 : 1); }
    if (b.type === 'ufo') { b.beamT = 2; sfx.beam(); }
    if (b.type === 'bubble') sfx.boing();
    burst(b.x, b.y, 'heart', 8, { size: 10, speed: 150, up: -60, color: pick(['#ff7aa8', '#ff5d73', '#ffb3d1']) });
  } else if (n === 1) danceFx(b, b.x, b.y);
  else jumpFx(b, b.x, b.y);
}

export function danceFx(b, x, y) {
  b.anim = { k: 'dance', t: 1.6, d: 1.6 }; b.laugh = 1.6; sfx.dance();
  for (let i = 0; i < 6; i++) addP({ kind: 'note', x: x + rand(-40, 40) * S, y: y - rand(10, 50) * S, vx: rand(-50, 50) * S, vy: -rand(50, 100) * S, life: 1.7, size: rand(20, 28) * S, color: pick(['#ffe27a', '#c9a7ff', '#8fd3ff', '#ff9ec7']), rot: 0, vr: 0, g: 0 });
}

export function jumpFx(b, x, y) {
  b.anim = { k: 'jump', t: 1.0, d: 1.0 }; b.laugh = 1.1; sfx.wheee(); setTimeout(() => sfx.boop(), 900);
  burst(x, y, 'spark', 14, { size: 9, speed: 220, color: '#ffe27a' }); burst(x, y, 'confetti', 14, { size: 7, speed: 220, g: 300 });
}

// смещение/поворот/растяжка малыша от текущей анимации
export function animXf(b) {
  const o = { dy: 0, rot: 0, sx: 1, sy: 1 }, A = b.anim; if (!A) return o;
  const p = clamp(1 - A.t / A.d, 0, 1), s = Math.sin(p * Math.PI);
  if (A.k === 'flip') { o.rot = p * p * (3 - 2 * p) * TAU; o.dy = -s * 45 * S; }
  else if (A.k === 'dance') { o.rot = Math.sin(p * Math.PI * 8) * 0.32; o.dy = -Math.abs(Math.sin(p * Math.PI * 8)) * 12 * S; }
  else if (A.k === 'jump') {
    o.dy = -s * 85 * S;
    const sq = p < 0.12 ? Math.sin(p / 0.12 * Math.PI) : p > 0.88 ? Math.sin((p - 0.88) / 0.12 * Math.PI) : 0;
    o.sx = 1 + sq * 0.25 - s * 0.08; o.sy = 1 - sq * 0.25 + s * 0.12;
  } else if (A.k === 'joy') {
    const hh = Math.abs(Math.sin(p * Math.PI * 3)); o.dy = -hh * 55 * S; o.rot = Math.sin(p * Math.PI * 6) * 0.2; o.sx = 1 + (1 - hh) * 0.08; o.sy = 1 - (1 - hh) * 0.08;
  }
  return o;
}

// золотое сияние + кружащиеся звёздочки (когда малышу очень понравилось)
export function halo(x, y, r, a) {
  a = clamp(a, 0, 1);
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,230,130,${0.55 * a})`); g.addColorStop(1, 'rgba(255,230,130,0)');
  ctx.fillStyle = g; circle(x, y, r);
  for (let i = 0; i < 6; i++) {
    const an = t * 2.5 + i * TAU / 6;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x + Math.cos(an) * r * 0.8, y + Math.sin(an) * r * 0.8); ctx.rotate(t * 4);
    ctx.fillStyle = `hsl(${(i * 60 + t * 120) % 360},95%,72%)`; starPath(5, 9 * S, 4 * S); ctx.fill(); ctx.restore();
  }
}
