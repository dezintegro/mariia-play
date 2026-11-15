// Уход — ванна: пена (шапки пузырьков, лопаются тапом, повторная кнопка — ещё пены), душ (мочит и смывает пену),
// резиновая уточка, мыльные пузыри, губка, полотенце (выключает душ и вытирает). Чистое мокрое сердце — блеск;
// губка и полотенце на сухом — щекотка и смех.
import { tone, whoosh } from '../../../core/audio';
import { S, TAU, ctx, pick, rand, t } from '../../../core/canvas';
import { circle, ell } from '../../../core/draw';
import { addP, burst } from '../../../core/particles';
import { clamp01, ease } from '../../../core/tween';
import { Live } from '../heart';
import { Xf } from '../reactions';
import { sfx } from '../sounds';
import { G } from '../state';
import { bubble, smallHeart, sparkleStar } from '../things';
import { CareSection, Hit, INK, R, floorY, happy, hp, iconBg, near, sideX } from './section';

type Clump = { fx: number; fy: number; r: number; t: number; sub: [number, number, number][]; wash?: number };
type Bub = { x: number; y: number; r: number; vy: number; ph: number; t: number };

const B = {
  foamOn: false, foam: [] as Clump[],
  shower: 0, drops: [] as { x: number; y: number; vy: number; stop: number }[], dropT: 0, splashT: 0, washT: 0,
  /** сердце мокрое после душа (сек. до высыхания) */
  wet: 0,
  duck: null as null | { t: number; jump: number },
  bubbles: [] as Bub[],
  /** dry — на сухом сердце: не «блеск чистоты», а смешная реакция */
  sponge: null as null | { t: number; e: number; dry: boolean },
  towel: null as null | { t: number; dry: boolean },
  shine: 0,
};

const snd = {
  rub() { for (let i = 0; i < 4; i++) tone(rand(1300, 1900), 0.07, { type: 'triangle', slide: rand(900, 2200), vol: 0.04, delay: i * 0.09 }); },
  drip() { tone(rand(1200, 1700), 0.06, { slide: rand(500, 800), vol: 0.04 }); },
  foam() { for (let i = 0; i < 6; i++) tone(rand(500, 1100), 0.08, { slide: rand(900, 1600), vol: 0.06, delay: i * 0.06 }); },
  click() { tone(1500, 0.03, { type: 'square', vol: 0.04 }); tone(880, 0.3, { vol: 0.06, delay: 0.05 }); },
  /** сухая губка скрипит */
  squeakDry() { for (let i = 0; i < 3; i++) tone(rand(1700, 2300), 0.06, { type: 'square', slide: rand(1200, 2600), vol: 0.025, delay: i * 0.08 }); },
};

const duckS = () => Math.max(34, R() * 0.28);
const duckPos = (): [number, number] => [sideX(1, 0.85, duckS() * 0.7), floorY() - (B.duck && B.duck.jump < 0.5 ? Math.sin(B.duck.jump / 0.5 * Math.PI) * duckS() * 0.8 : 0)];
const showerS = () => Math.max(20, R() * 0.22);
const showerPos = (): [number, number] => [G.heart.x + 0.05 * R(), Math.max(G.HR.y + showerS() * 0.9, G.heart.y - 1.32 * R())];
const spongeS = () => Math.max(28, R() * 0.24);
function spongePos(): [number, number] { const p = B.sponge ? B.sponge.t : 0, a = p * 9; return hp(Math.cos(a) * 0.38 + Math.sin(p * 2) * 0.15, -0.35 + Math.sin(a) * 0.22 + p * 0.2); }
function towelPos(): [number, number] { const p = B.towel ? B.towel.t / 1.6 : 0; return hp(Math.sin(p * 14) * 0.55, -0.8 + p * 1.4); }

// ---------------- РИСОВАЛКИ ----------------
/** Резиновая уточка: (x, y) — низ, s — размер (высота ≈ 1.25s) */
function rubberDuck(x: number, y: number, s: number, sq = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(1 + sq * 0.15, 1 - sq * 0.15); ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(120,200,255,0.45)'; ell(0, -0.02 * s, 0.75 * s, 0.1 * s);
  ctx.fillStyle = '#ffd93b'; ctx.strokeStyle = '#e0a800'; ctx.lineWidth = 0.05 * s;
  ctx.beginPath(); ctx.moveTo(-0.55 * s, -0.4 * s); ctx.quadraticCurveTo(-0.8 * s, -0.75 * s, -0.68 * s, -0.8 * s); ctx.quadraticCurveTo(-0.45 * s, -0.62 * s, -0.3 * s, -0.6 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  ell(0, -0.32 * s, 0.66 * s, 0.32 * s); ctx.stroke();
  circle(0.22 * s, -0.86 * s, 0.33 * s); ctx.stroke();
  ctx.fillStyle = '#ffc61a'; ell(-0.12 * s, -0.36 * s, 0.3 * s, 0.15 * s, -0.25);
  ctx.fillStyle = '#ff8a1f'; ctx.strokeStyle = '#d0620a'; ctx.lineWidth = 0.03 * s; ell(0.6 * s, -0.8 * s, 0.2 * s, 0.08 * s); ctx.stroke(); ell(0.56 * s, -0.72 * s, 0.15 * s, 0.05 * s); ctx.stroke();
  ctx.fillStyle = INK; ell(0.3 * s, -0.95 * s, 0.06 * s, 0.075 * s); ctx.fillStyle = '#fff'; circle(0.32 * s, -0.98 * s, 0.025 * s);
  ctx.fillStyle = 'rgba(255,110,140,0.45)'; ell(0.2 * s, -0.76 * s, 0.08 * s, 0.05 * s);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ell(-0.3 * s, -0.48 * s, 0.14 * s, 0.05 * s, -0.3); ell(0.08 * s, -1.06 * s, 0.08 * s, 0.04 * s, -0.4);
  ctx.restore();
}
/** Губка с дырочками */
function sponge(x: number, y: number, s: number, rot: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = '#5fcf6a'; ctx.beginPath(); ctx.roundRect(-0.8 * s, -0.55 * s, 1.6 * s, 0.3 * s, 0.12 * s); ctx.fill();
  ctx.fillStyle = '#ffd84a'; ctx.strokeStyle = '#d9a400'; ctx.lineWidth = 0.05 * s; ctx.beginPath(); ctx.roundRect(-0.8 * s, -0.35 * s, 1.6 * s, 0.85 * s, 0.18 * s); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e6b520'; for (const [px, py, r] of [[-0.45, -0.05, 0.09], [0.1, 0.05, 0.12], [0.5, -0.1, 0.08], [-0.15, 0.3, 0.07], [0.42, 0.28, 0.1], [-0.55, 0.3, 0.06]]) ell(px * s, py * s, r * s, r * 0.8 * s);
  ctx.restore();
}
/** Полотенце: прямоугольник с полосками и бахромой */
function towel(x: number, y: number, s: number, rot: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = '#ff9ec7'; ctx.strokeStyle = '#e0669e'; ctx.lineWidth = 0.04 * s; ctx.beginPath(); ctx.roundRect(-0.9 * s, -0.55 * s, 1.8 * s, 1.1 * s, 0.1 * s); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.fillRect(-0.9 * s, 0.2 * s, 1.8 * s, 0.1 * s); ctx.fillRect(-0.9 * s, -0.3 * s, 1.8 * s, 0.1 * s);
  ctx.strokeStyle = '#ff9ec7'; ctx.lineWidth = 0.05 * s; ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) { const fx = -0.8 * s + i * 0.2 * s; ctx.beginPath(); ctx.moveTo(fx, 0.55 * s); ctx.lineTo(fx, 0.7 * s); ctx.stroke(); }
  ctx.restore();
}
/** Лейка душа на трубе сверху */
function showerHead(x: number, y: number, s: number, on: boolean) {
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = '#a9b8c8'; ctx.lineWidth = 0.22 * s; ctx.beginPath(); ctx.moveTo(x + 1.2 * s, G.HR.y - 10); ctx.lineTo(x + 1.2 * s, y - 0.6 * s); ctx.quadraticCurveTo(x + 1.2 * s, y - 0.9 * s, x + 0.6 * s, y - 0.75 * s); ctx.stroke();
  ctx.strokeStyle = '#dfe8f0'; ctx.lineWidth = 0.08 * s; ctx.beginPath(); ctx.moveTo(x + 1.15 * s, G.HR.y - 10); ctx.lineTo(x + 1.15 * s, y - 0.65 * s); ctx.stroke();
  ctx.translate(x, y); ctx.rotate(0.15);
  const g = ctx.createLinearGradient(-s, -0.6 * s, s, 0.3 * s); g.addColorStop(0, '#f2f7fb'); g.addColorStop(1, '#9fb0c2');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-0.25 * s, -0.75 * s); ctx.lineTo(0.25 * s, -0.75 * s); ctx.lineTo(0.85 * s, 0.05 * s); ctx.lineTo(-0.85 * s, 0.05 * s); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#7d8fa3'; ell(0, 0.05 * s, 0.85 * s, 0.18 * s);
  ctx.fillStyle = on ? '#bfe8ff' : '#55667a'; for (let i = -3; i <= 3; i++) circle(i * 0.22 * s, 0.06 * s, 0.045 * s);
  ctx.restore();
}
/** Пенная шапка: кучка пузырьков */
function clump(x: number, y: number, c: Clump, Rr: number, k: number) {
  for (const [dx, dy, rr] of c.sub) {
    const r = rr * Rr * k, px = x + dx * Rr, py = y + dy * Rr + Math.sin(t * 2 + dx * 9) * 0.006 * Rr;
    ctx.fillStyle = '#ffffff'; circle(px, py, r);
    ctx.strokeStyle = 'rgba(150,200,240,0.8)'; ctx.lineWidth = Math.max(1, r * 0.08); ctx.beginPath(); ctx.arc(px, py, r, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
    ctx.fillStyle = 'rgba(200,230,255,0.7)'; ell(px + r * 0.15, py + r * 0.35, r * 0.5, r * 0.25);
    ctx.fillStyle = '#fff'; circle(px - r * 0.35, py - r * 0.35, r * 0.18);
  }
}
/** Падающая капля */
function drop(x: number, y: number, s: number) {
  ctx.fillStyle = '#7cc8ff'; ctx.beginPath(); ctx.moveTo(x, y - s * 1.6); ctx.quadraticCurveTo(x + s, y - s * 0.2, x, y + s * 0.6); ctx.quadraticCurveTo(x - s, y - s * 0.2, x, y - s * 1.6); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; circle(x - s * 0.25, y - s * 0.1, s * 0.18);
}

// ---------------- ДЕЙСТВИЯ ----------------
const FOAM_AT: [number, number][] = [[-0.6, -0.82], [-0.28, -0.74], [0.3, -0.76], [0.62, -0.82], [0.88, -0.48], [-0.88, -0.45], [0, -0.52], [-0.95, -0.05], [0.95, -0.08], [0.55, 0.55], [-0.55, 0.55], [0, 0.82]];
/** Сколько длится смывание одной шапки пены */
const WASH = 0.4;
function makeClump(fx: number, fy: number, delay = 0): Clump {
  const sub: [number, number, number][] = [], n = 4 + (Math.random() * 3 | 0);
  for (let i = 0; i < n; i++) { const a = rand(0, TAU), d = rand(0, 0.11); sub.push([Math.cos(a) * d, Math.sin(a) * d * 0.7, rand(0.06, 0.1)]); }
  return { fx, fy, r: 0.17, t: -delay, sub };
}
function foamGone() { if (!B.foam.length && B.foamOn) { B.foamOn = false; G.hs.sqT = 0; G.hs.mouth = 1; sfx.giggle(1.1); } }
function popClump(c: Clump, loud = true) {
  const i = B.foam.indexOf(c); if (i < 0) return;
  B.foam.splice(i, 1);
  const [x, y] = hp(c.fx, c.fy);
  burst(x, y, 'smoke', 5, { color: '#ffffff', speed: 90, size: 12 });
  burst(x, y, 'spark', 4, { color: '#bfe8ff', speed: 140, size: 6 });
  if (loud) sfx.pop(rand(0.8, 1.4));
  foamGone();
}
/** Сухое ли сердце (нет пены, не мокрое после душа) — тогда губка и полотенце просто щекочут */
const dry = () => B.wet <= 0 && !B.foam.length && B.shower <= 0;

function act(k: string) {
  const { x: hx, y: hy } = G.heart, Rr = R();
  if (k === 'foam') {
    if (B.foamOn) { // ещё пены: шапки копятся
      for (let i = 0; i < 6 && B.foam.length < 26; i++) { const [fx, fy] = pick(FOAM_AT); B.foam.push(makeClump(fx + rand(-0.15, 0.15), fy + rand(-0.12, 0.12), i * 0.05)); }
    } else B.foam = FOAM_AT.map(([fx, fy], i) => makeClump(fx + rand(-0.04, 0.04), fy + rand(-0.03, 0.03), i * 0.05));
    B.foamOn = true;
    snd.foam(); happy(); burst(hx, hy - Rr * 0.7, 'spark', 10, { color: '#bfe8ff', speed: 200 });
  } else if (k === 'shower') {
    B.shower = Math.min(4, Math.max(B.shower, 0) + 2.6); B.washT = 0.3; sfx.splash(); whoosh(2.2, 0.05); happy();
  } else if (k === 'rubberduck') {
    if (B.duck) { const [dx, dy] = duckPos(); B.duck = null; sfx.poof(); burst(dx, dy - duckS() * 0.6, 'smoke', 6, { color: '#fff', speed: 120, size: 14 }); return; }
    B.duck = { t: 0, jump: 0 }; sfx.squeak(); sfx.splash();
  } else if (k === 'soapbubbles') {
    for (let i = 0; i < 7; i++) if (B.bubbles.length < 22) B.bubbles.push({ x: hx + rand(-1.1, 1.1) * Rr, y: hy + rand(0.3, 1.0) * Rr, r: Math.max(26, Rr * rand(0.11, 0.2)), vy: -rand(45, 80) * S, ph: rand(0, TAU), t: -i * 0.12 });
    sfx.blub(); sfx.magic();
  } else if (k === 'sponge') {
    B.sponge = { t: 0, e: 0, dry: dry() }; if (B.sponge.dry) snd.squeakDry(); else snd.rub();
  } else if (k === 'towel') {
    if (B.shower > 0) { B.shower = 0; snd.click(); } // полотенце выключает душ
    B.towel = { t: 0, dry: dry() }; whoosh(0.5, 0.1);
  }
}
/** Уходим из ванны: пена, пузыри и капли лопаются, уточка уплывает */
function exit() {
  let any = false;
  for (const c of B.foam) { const [x, y] = hp(c.fx, c.fy); burst(x, y, 'smoke', 2, { color: '#ffffff', speed: 70, size: 10 }); any = true; }
  B.foam.length = 0; B.foamOn = false;
  if (B.duck) { const [dx, dy] = duckPos(); burst(dx, dy - duckS() * 0.6, 'smoke', 5, { color: '#fff', speed: 110, size: 14 }); B.duck = null; any = true; }
  for (const b of B.bubbles) if (b.t > 0) { burst(b.x + Math.sin(b.ph) * b.r * 0.4, b.y, 'spark', 4, { color: pick(['#ffffff', '#bfe8ff', '#ffc4e1']), speed: 140 }); any = true; }
  B.bubbles.length = 0;
  B.drops.forEach((d, i) => { if (i % 3 === 0) burst(d.x, d.y, 'spark', 1, { color: '#9fdcff', speed: 80, size: 4 }); });
  B.drops.length = 0; B.shower = 0; B.sponge = null; B.towel = null; B.wet = 0;
  if (any) sfx.pop(1.2);
}

// ---------------- ОБНОВЛЕНИЕ ----------------
function update(dt: number) {
  const hs = G.hs, { x: hx, y: hy } = G.heart, Rr = R();
  for (const c of B.foam) { c.t += dt; if (c.wash != null) c.wash += dt; }
  // душ: мочит сердце и смывает пену сверху вниз
  if (B.shower > 0) {
    B.shower -= dt; B.dropT -= dt; B.splashT -= dt; B.washT -= dt; B.wet = 60;
    const [sx, sy] = showerPos(), s = showerS();
    while (B.dropT <= 0) {
      B.dropT += 0.02;
      const dx = rand(-0.7, 0.7);
      B.drops.push({ x: sx + dx * s * 1.1, y: sy + s * 0.1, vy: rand(350, 450) * S, stop: hy + (-0.75 + Math.abs(dx) * 0.2 + rand(0, 1.3)) * Rr });
    }
    if (B.splashT <= 0) { B.splashT = 0.55; sfx.splash(); }
    if (B.washT <= 0) { // смывает по шапке сверху вниз: даже много пены уходит за одно включение душа
      B.washT = 0.07;
      const c = B.foam.filter(q => q.wash == null && q.t > 0).sort((a, b) => a.fy - b.fy)[0];
      if (c) c.wash = 0;
    }
    hs.mouth = Math.max(hs.mouth, 0.6);
  }
  const washed = B.foam.filter(q => q.wash != null && q.wash > WASH);
  for (const c of washed) {
    B.foam.splice(B.foam.indexOf(c), 1);
    const [x, y] = hp(c.fx, c.fy + 0.25);
    burst(x, y, 'spark', 3, { color: '#ffffff', speed: 90, size: 6 });
    if (Math.random() < 0.5) snd.drip();
  }
  if (washed.length) foamGone();
  B.wet = Math.max(0, B.wet - dt);
  for (const d of B.drops) {
    d.y += d.vy * dt; d.x += (d.x - showerPos()[0]) * dt * 0.8;
    if (d.y > d.stop) { d.vy = -1; if (Math.random() < 0.4) addP({ kind: 'spark', x: d.x, y: d.y, vx: rand(-60, 60) * S, vy: rand(-90, -30) * S, life: 0.35, size: rand(3, 5) * S, color: '#9fdcff', rot: 0, vr: 0, g: 600 }); }
  }
  B.drops = B.drops.filter(d => d.vy > 0);
  // уточка
  if (B.duck) { B.duck.t += dt; B.duck.jump += dt; }
  // мыльные пузыри
  for (const b of B.bubbles) { b.t += dt; if (b.t > 0) { b.y += b.vy * dt; b.ph += dt * 1.6; } }
  B.bubbles = B.bubbles.filter(b => b.y > G.HR.y - b.r * 2);
  // губка: трёт по кругу, искорки чистоты; если есть пена — пены прибавляется; на сухом — скрипит и щекочет
  if (B.sponge) {
    const Sp = B.sponge; Sp.t += dt; Sp.e -= dt;
    if (Sp.e <= 0) {
      Sp.e = 0.16; const [px, py] = spongePos();
      if (!Sp.dry) burst(px, py, 'spark', 2, { color: pick(['#ffffff', '#bfe8ff', '#fff6a8']), speed: 160, size: 9 });
      if (B.foamOn && B.foam.length < 18 && Math.random() < 0.35) B.foam.push(makeClump((px - hx) / Rr, (py - hy) / Rr));
    }
    if ((Sp.t * 2.4 | 0) !== ((Sp.t - dt) * 2.4 | 0)) { if (Sp.dry) snd.squeakDry(); else snd.rub(); }
    if (Sp.t > 1.8) {
      B.sponge = null;
      if (Sp.dry) { sfx.giggle(1.25); happy(true); hs.wgT = 0; burst(hx, hy - Rr * 0.2, 'heart', 6, { up: -80, speed: 150 }); }
      else { B.shine = Math.max(B.shine, 1.5); happy(); sfx.tinkle(); }
    }
  }
  // полотенце: вытирает пену и воду, потом сердце блестит; на сухом — щекотно и смешно
  if (B.towel) {
    const Tw = B.towel; Tw.t += dt;
    const [tx, ty] = towelPos();
    for (const c of [...B.foam]) { const [cx, cy] = hp(c.fx, c.fy); if (Math.hypot(cx - tx, cy - ty) < Rr * 0.45) { B.foam.splice(B.foam.indexOf(c), 1); burst(cx, cy, 'smoke', 3, { color: '#fff', speed: 60, size: 10 }); } }
    if ((Tw.t * 3 | 0) !== ((Tw.t - dt) * 3 | 0)) whoosh(0.25, 0.06);
    if (Tw.t > 1.6) {
      B.towel = null; B.foam.length = 0; B.foamOn = false; B.wet = 0;
      if (Tw.dry) { sfx.giggle(1.3); happy(true); burst(hx, hy - Rr * 0.4, 'heart', 8, { up: -90, speed: 170, color: '#ff7aa8' }); }
      else { B.shine = 2.6; happy(true); sfx.tinkle(); sfx.magic(); burst(hx, hy - Rr * 0.3, 'spark', 16, { color: '#fff6a8', speed: 280 }); }
    }
  }
  B.shine = Math.max(0, B.shine - dt);
}

// ---------------- РИСОВАНИЕ ----------------
function drawBack() {
  if (B.shower > 0 || B.drops.length) { const [sx, sy] = showerPos(); showerHead(sx, sy, showerS(), B.shower > 0); }
}
function drawFront() {
  const Rr = R();
  // пена (смываемая душем — сползает и тает)
  for (const c of B.foam) {
    if (c.t <= 0) continue;
    const w = c.wash == null ? 0 : clamp01(c.wash / WASH), [x, y] = hp(c.fx, c.fy + w * 0.25);
    clump(x, y, c, Rr, ease.outBack(clamp01(c.t / 0.3)) * (1 - w * 0.9));
  }
  // блеск чистоты
  if (B.shine > 0) {
    ctx.save(); ctx.globalAlpha *= clamp01(B.shine);
    [[-0.5, -0.55], [0.55, -0.6], [0.72, 0.05], [-0.68, 0.02], [0.12, -0.78], [-0.2, 0.55], [0.35, 0.45]].forEach(([fx, fy], i) => {
      const [x, y] = hp(fx, fy), s = Rr * (0.06 + 0.03 * Math.sin(t * 6 + i * 1.7));
      sparkleStar(x, y, Math.max(4, s), t * 1.5 + i, '#ffffff');
    });
    ctx.restore();
  }
  if (B.sponge) { const [px, py] = spongePos(); sponge(px, py, spongeS(), Math.sin(B.sponge.t * 9) * 0.3); }
  if (B.towel) { const [tx, ty] = towelPos(); towel(tx, ty, Math.max(30, Rr * 0.3), Math.sin(B.towel.t * 9) * 0.25); }
  for (const d of B.drops) drop(d.x, d.y, Math.max(3, Rr * 0.025));
  if (B.duck) { const [dx, dy] = duckPos(), k = ease.outBack(clamp01(B.duck.t / 0.4)); rubberDuck(dx, dy, duckS() * Math.max(0.01, k), B.duck.jump < 0.3 ? Math.sin(B.duck.jump / 0.3 * Math.PI) : 0); }
  for (const b of B.bubbles) { if (b.t <= 0) continue; const k = ease.outBack(clamp01(b.t / 0.4)); bubble(b.x + Math.sin(b.ph) * b.r * 0.4, b.y, b.r * Math.max(0.01, k)); }
}
function live(L: Live) {
  if (B.shower > 0 || (B.towel && !B.towel.dry)) L.blink = 1; // жмурится от удовольствия
  if (B.sponge) L.mouth = Math.max(L.mouth, 0.6 + 0.3 * Math.sin(t * 10));
  if (B.towel && B.towel.dry) L.mouth = Math.max(L.mouth, 0.7 + 0.3 * Math.sin(t * 12)); // щекотно
}
function xform(X: Xf) {
  if (B.sponge) X.rot += Math.sin(B.sponge.t * 13) * (B.sponge.dry ? 0.05 : 0.025);
  if (B.towel) { X.rot += Math.sin(B.towel.t * 12) * 0.04; X.sx *= 1.02; X.sy *= 0.98; }
}

// ---------------- ТАПЫ ----------------
function hit(x: number, y: number): Hit | null {
  const Rr = R();
  for (let i = B.bubbles.length - 1; i >= 0; i--) { const b = B.bubbles[i]; if (b.t > 0 && near(x, y, b.x + Math.sin(b.ph) * b.r * 0.4, b.y, b.r * 1.1)) return { what: 'bubble', o: b }; }
  if (B.sponge) { const [px, py] = spongePos(); if (near(x, y, px, py, spongeS() * 1.1)) return { what: 'sponge' }; }
  if (B.towel) { const [tx, ty] = towelPos(); if (near(x, y, tx, ty, Rr * 0.3)) return { what: 'towel' }; }
  if (B.duck) { const [dx, dy] = duckPos(), s = duckS(); if (near(x, y, dx, dy - 0.6 * s, s * 0.8)) return { what: 'duck' }; }
  let best: Clump | null = null, bd = 1e9;
  for (const c of B.foam) { if (c.t <= 0 || c.wash != null) continue; const [cx, cy] = hp(c.fx, c.fy), d = Math.hypot(x - cx, y - cy); if (d < Math.max(30, Rr * 0.17) && d < bd) { bd = d; best = c; } }
  if (best) return { what: 'foam', o: best };
  if (B.shower > 0) { const [sx, sy] = showerPos(); if (near(x, y, sx, sy - showerS() * 0.3, showerS() * 1.1)) return { what: 'shower' }; }
  return null;
}
function tap(h: Hit, x: number, y: number) {
  const Rr = R();
  switch (h.what) {
    case 'bubble': {
      const i = B.bubbles.indexOf(h.o); if (i >= 0) B.bubbles.splice(i, 1);
      sfx.pop(rand(0.7, 1.3)); burst(x, y, 'spark', 8, { color: pick(['#ffffff', '#bfe8ff', '#ffc4e1']), speed: 200 }); break;
    }
    case 'foam': popClump(h.o); break;
    case 'sponge': if (B.sponge!.dry) snd.squeakDry(); else snd.rub(); B.sponge!.t = Math.max(0, B.sponge!.t - 0.6); burst(x, y, 'smoke', 4, { color: '#fff', speed: 100, size: 12 }); break;
    case 'towel': whoosh(0.3, 0.08); burst(x, y, 'spark', 5, { color: '#ffc4e1', speed: 150 }); break;
    case 'duck': B.duck!.jump = 0; sfx.squeak(); burst(x, y - 10 * S, 'heart', 4, { up: -80, speed: 120, color: '#ffd93b' }); break;
    case 'shower': B.shower = Math.min(4, B.shower + 1.2); sfx.splash(); burst(x, y + Rr * 0.1, 'spark', 6, { color: '#9fdcff', speed: 160 }); break;
  }
}

// ---------------- ЗНАЧКИ ----------------
const BG_BATH: [string, string] = ['#e6f8ff', '#a9def7'];
function optIcon(k: string, r: number) {
  iconBg(r, ...BG_BATH);
  if (k === 'foam') {
    const c: Clump = { fx: 0, fy: 0, r: 1, t: 1, sub: [[-0.42, 0.25, 0.28], [0.4, 0.27, 0.27], [0, 0.18, 0.34], [-0.2, -0.12, 0.27], [0.2, -0.15, 0.26], [0, -0.42, 0.2]] };
    ctx.fillStyle = 'rgba(80,170,230,0.35)'; ell(0, r * 0.55, r * 0.75, r * 0.15); clump(0, 0, c, r, 1);
  } else if (k === 'shower') {
    ctx.save(); showerHead(-r * 0.1, -r * 0.25, r * 0.5, true); ctx.restore();
    for (let i = 0; i < 6; i++) { const ph = (t * 1.2 + i * 0.37) % 1; drop(-r * 0.45 + i * r * 0.17 + ph * r * 0.08, -r * 0.05 + ph * r * 0.7, r * 0.06); }
  } else if (k === 'rubberduck') rubberDuck(-r * 0.05, r * 0.62, r * 0.85);
  else if (k === 'soapbubbles') {
    bubble(-r * 0.25, r * 0.15, r * 0.4); bubble(r * 0.35, -r * 0.3, r * 0.28); bubble(r * 0.38, r * 0.4, r * 0.16); bubble(-r * 0.4, -r * 0.48, r * 0.14);
  } else if (k === 'sponge') {
    sponge(0, r * 0.08, r * 0.55, -0.15);
    ctx.fillStyle = '#fff'; for (const [x, y, rr] of [[-0.45, -0.38, 0.12], [-0.25, -0.45, 0.09], [0.4, -0.4, 0.1]]) circle(x * r, y * r, rr * r);
  } else if (k === 'towel') {
    ctx.strokeStyle = '#9fb0c2'; ctx.lineWidth = r * 0.1; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-r * 0.7, -r * 0.5); ctx.lineTo(r * 0.7, -r * 0.5); ctx.stroke();
    ctx.save(); ctx.translate(0, -r * 0.5);
    ctx.fillStyle = '#ff9ec7'; ctx.strokeStyle = '#e0669e'; ctx.lineWidth = r * 0.04; ctx.beginPath(); ctx.roundRect(-r * 0.45, -r * 0.05, r * 0.9, r * 1.0, r * 0.08); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(-r * 0.45, r * 0.65, r * 0.9, r * 0.08); ctx.fillRect(-r * 0.45, r * 0.5, r * 0.9, r * 0.05);
    ctx.fillStyle = '#ffc4dd'; ctx.fillRect(-r * 0.45, -r * 0.05, r * 0.9, r * 0.18);
    smallHeart(0, r * 0.32, r * 0.13, '#fff');
    ctx.restore();
  }
}
/** Ванна на ножках с пеной */
function icon(r: number) {
  iconBg(r, ...BG_BATH);
  const c: Clump = { fx: 0, fy: 0, r: 1, t: 1, sub: [[-0.45, -0.08, 0.18], [-0.2, -0.18, 0.2], [0.08, -0.12, 0.19], [0.35, -0.16, 0.18], [0.55, -0.05, 0.14], [-0.05, -0.36, 0.14]] };
  clump(0, 0, c, r, 1);
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#7fb8e0'; ctx.lineWidth = r * 0.05;
  ctx.beginPath(); ctx.moveTo(-r * 0.75, -r * 0.05); ctx.lineTo(r * 0.75, -r * 0.05); ctx.quadraticCurveTo(r * 0.72, r * 0.48, r * 0.3, r * 0.5); ctx.lineTo(-r * 0.3, r * 0.5); ctx.quadraticCurveTo(-r * 0.72, r * 0.48, -r * 0.75, -r * 0.05); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ff9ec7'; ctx.fillRect(-r * 0.72, r * 0.08, r * 1.44, r * 0.08);
  ctx.fillStyle = '#ffd23f'; for (const d of [-1, 1]) ell(d * r * 0.4, r * 0.6, r * 0.09, r * 0.12);
  ctx.strokeStyle = '#9fb0c2'; ctx.lineWidth = r * 0.07; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-r * 0.65, -r * 0.05); ctx.lineTo(-r * 0.65, -r * 0.5); ctx.lineTo(-r * 0.45, -r * 0.5); ctx.stroke();
}

export const bath: CareSection = {
  id: 'bath', state: B, icon, optIcon,
  sel: k => k === 'foam' ? B.foamOn : k === 'rubberduck' ? !!B.duck : false,
  act: k => act(k), exit, update, drawBack, drawFront, hit, tap, live, xform,
};
