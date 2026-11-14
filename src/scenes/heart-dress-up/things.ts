// Мелкие рисованные штуки: форма сердца, мини-сердечки, цветы, пузыри, бабочки, шарики, облака, солнце, луна, радуга,
// котёнок, рыбка, утёнок, замок, дерево, гирлянда флажков, море.
import { ctx, TAU, t } from '../../core/canvas';
import { circle, ell, starPath } from '../../core/draw';

/** Контур пухлого сердца с центром около (0,0): ширина 2R, верх −R, кончик +0.95R. Только путь. */
export function heartShape(R: number) {
  ctx.beginPath();
  ctx.moveTo(0, -0.5 * R);
  ctx.bezierCurveTo(-0.15 * R, -0.95 * R, -0.95 * R, -1.05 * R, -1.0 * R, -0.4 * R);
  ctx.bezierCurveTo(-1.05 * R, 0.1 * R, -0.45 * R, 0.55 * R, 0, 0.95 * R);
  ctx.bezierCurveTo(0.45 * R, 0.55 * R, 1.05 * R, 0.1 * R, 1.0 * R, -0.4 * R);
  ctx.bezierCurveTo(0.95 * R, -1.05 * R, 0.15 * R, -0.95 * R, 0, -0.5 * R);
  ctx.closePath();
}

export const MINI_COLORS: [string, string][] = [['#ff7aa8', '#c73f73'], ['#ffcf3f', '#d18f00'], ['#7fd1ff', '#3388cc'], ['#b98cff', '#7445c9'], ['#8be07a', '#3f9a33']];

/** Мини-сердечко с глазками (малыши-сердечки, хоровод) */
export function miniHeart(x: number, y: number, r: number, col: [string, string], o: { lx?: number; blink?: boolean; mouth?: number; rot?: number; sx?: number; sy?: number } = {}) {
  ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot); ctx.scale(o.sx || 1, o.sy || 1);
  heartShape(r);
  const g = ctx.createRadialGradient(-0.4 * r, -0.5 * r, 0.05 * r, 0, 0, 1.2 * r);
  g.addColorStop(0, '#fff'); g.addColorStop(0.35, col[0]); g.addColorStop(1, col[1]);
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = col[1]; ctx.lineWidth = Math.max(1, 0.06 * r); ctx.lineJoin = 'round'; ctx.stroke();
  const lx = (o.lx || 0) * 0.06 * r;
  ctx.fillStyle = '#3a1528';
  for (const s of [-1, 1]) {
    if (o.blink) { ctx.strokeStyle = '#3a1528'; ctx.lineWidth = 0.07 * r; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(s * 0.32 * r, -0.08 * r, 0.09 * r, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    else { ell(s * 0.32 * r + lx, -0.1 * r, 0.1 * r, 0.12 * r); ctx.fillStyle = '#fff'; circle(s * 0.32 * r + lx + 0.035 * r, -0.14 * r, 0.035 * r); ctx.fillStyle = '#3a1528'; }
  }
  ctx.fillStyle = 'rgba(255,90,140,0.45)'; ell(-0.55 * r, 0.1 * r, 0.12 * r, 0.07 * r); ell(0.55 * r, 0.1 * r, 0.12 * r, 0.07 * r);
  ctx.strokeStyle = '#3a1528'; ctx.lineWidth = 0.06 * r; ctx.lineCap = 'round';
  if (o.mouth && o.mouth > 0.1) { ctx.fillStyle = '#7a1f3d'; ell(0, 0.17 * r, 0.09 * r, 0.06 * r + 0.06 * r * o.mouth); }
  else { ctx.beginPath(); ctx.arc(0, 0.08 * r, 0.12 * r, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); }
  ctx.restore();
}

/** Цветок: 5 лепестков вокруг жёлтой серединки */
export function flower(x: number, y: number, s: number, color: string, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = color;
  for (let i = 0; i < 5; i++) { const a = i * TAU / 5; circle(Math.cos(a) * 0.55 * s, Math.sin(a) * 0.55 * s, 0.46 * s); }
  ctx.fillStyle = '#ffd23f'; circle(0, 0, 0.38 * s);
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; circle(-0.12 * s, -0.12 * s, 0.1 * s);
  ctx.restore();
}

/** Цветок на стебле, растущий из земли (x, y) — головка на высоте 2.4s */
export function stemFlower(x: number, y: number, s: number, color: string, sway: number, rot = 0) {
  const hx = x + sway * s, hy = y - 2.4 * s;
  ctx.strokeStyle = '#4caf50'; ctx.lineWidth = 0.22 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x, y - 1.2 * s, hx, hy); ctx.stroke();
  ctx.fillStyle = '#5cc160'; ell(x + 0.35 * s, y - 0.9 * s, 0.38 * s, 0.16 * s, -0.5); ell(x - 0.35 * s, y - 1.3 * s, 0.38 * s, 0.16 * s, 0.5);
  flower(hx, hy, s, color, rot);
}

export function bubble(x: number, y: number, r: number) {
  ctx.save(); ctx.translate(x, y);
  const g = ctx.createRadialGradient(-0.3 * r, -0.3 * r, 0.1 * r, 0, 0, r);
  g.addColorStop(0, 'rgba(255,255,255,0.15)'); g.addColorStop(0.7, 'rgba(190,230,255,0.25)'); g.addColorStop(1, 'rgba(255,180,230,0.55)');
  ctx.fillStyle = g; circle(0, 0, r);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = Math.max(1, 0.07 * r); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  ctx.lineWidth = Math.max(1.5, 0.13 * r); ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, 0.7 * r, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
  ctx.fillStyle = '#fff'; circle(0.35 * r, -0.45 * r, 0.09 * r);
  ctx.restore();
}

export function butterfly(x: number, y: number, s: number, flap: number, color: string, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  const f = 0.25 + 0.75 * Math.abs(Math.cos(flap));
  for (const side of [-1, 1]) {
    ctx.save(); ctx.scale(side * f, 1);
    ctx.fillStyle = color; ell(0.55 * s, -0.4 * s, 0.6 * s, 0.48 * s, -0.4); ell(0.45 * s, 0.35 * s, 0.4 * s, 0.33 * s, 0.4);
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; circle(0.6 * s, -0.45 * s, 0.17 * s); circle(0.45 * s, 0.38 * s, 0.1 * s);
    ctx.restore();
  }
  ctx.fillStyle = '#4a2a3a'; ell(0, 0, 0.12 * s, 0.55 * s);
  ctx.strokeStyle = '#4a2a3a'; ctx.lineWidth = 0.06 * s; ctx.lineCap = 'round';
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, -0.45 * s); ctx.quadraticCurveTo(side * 0.15 * s, -0.85 * s, side * 0.35 * s, -0.95 * s); ctx.stroke(); }
  ctx.restore();
}

/** Воздушный шарик; (x,y) — центр шарика, нитка вниз длиной len */
export function balloon(x: number, y: number, r: number, color: string, len = 2.4) {
  ctx.strokeStyle = 'rgba(120,80,110,0.7)'; ctx.lineWidth = Math.max(1, 0.05 * r);
  ctx.beginPath(); ctx.moveTo(x, y + 1.15 * r);
  for (let i = 1; i <= 6; i++) ctx.lineTo(x + Math.sin(i * 1.3 + t * 2) * 0.12 * r, y + 1.15 * r + (len * r) * i / 6);
  ctx.stroke();
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = color; ell(0, 0, r, 1.15 * r);
  ctx.beginPath(); ctx.moveTo(0, 1.1 * r); ctx.lineTo(-0.13 * r, 1.3 * r); ctx.lineTo(0.13 * r, 1.3 * r); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ell(-0.38 * r, -0.45 * r, 0.18 * r, 0.32 * r, 0.5);
  ctx.restore();
}

export function cloud(x: number, y: number, s: number, face = true) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  circle(-0.55 * s, 0.1 * s, 0.42 * s); circle(0, -0.15 * s, 0.6 * s); circle(0.6 * s, 0.08 * s, 0.45 * s); ell(0, 0.25 * s, 1.0 * s, 0.32 * s);
  if (face) {
    ctx.strokeStyle = '#8a7a9a'; ctx.lineWidth = 0.06 * s; ctx.lineCap = 'round';
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(sd * 0.25 * s, 0, 0.08 * s, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0, 0.1 * s, 0.1 * s, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
    ctx.fillStyle = 'rgba(255,150,190,0.5)'; ell(-0.45 * s, 0.15 * s, 0.1 * s, 0.06 * s); ell(0.45 * s, 0.15 * s, 0.1 * s, 0.06 * s);
  }
  ctx.restore();
}

export function sun(x: number, y: number, r: number, spin: number, laugh: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(spin);
  ctx.fillStyle = '#ffb938';
  for (let i = 0; i < 10; i++) { ctx.save(); ctx.rotate(i * TAU / 10); ctx.beginPath(); ctx.moveTo(-0.17 * r, -1.1 * r); ctx.lineTo(0, -1.5 * r); ctx.lineTo(0.17 * r, -1.1 * r); ctx.closePath(); ctx.fill(); ctx.restore(); }
  ctx.rotate(-spin);
  const g = ctx.createRadialGradient(-0.3 * r, -0.3 * r, 0.1 * r, 0, 0, r); g.addColorStop(0, '#fff6b0'); g.addColorStop(1, '#ffc93a');
  ctx.fillStyle = g; circle(0, 0, r);
  ctx.strokeStyle = '#8a4a1a'; ctx.lineWidth = 0.07 * r; ctx.lineCap = 'round';
  for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(sd * 0.32 * r, -0.08 * r, 0.12 * r, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
  if (laugh > 0) { ctx.fillStyle = '#a0402a'; ell(0, 0.3 * r, 0.22 * r, 0.16 * r); }
  else { ctx.beginPath(); ctx.arc(0, 0.12 * r, 0.25 * r, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,120,120,0.45)'; ell(-0.6 * r, 0.2 * r, 0.14 * r, 0.09 * r); ell(0.6 * r, 0.2 * r, 0.14 * r, 0.09 * r);
  ctx.restore();
}

export function moon(x: number, y: number, r: number, wink: number) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(255,245,200,0.18)'; circle(0, 0, r * 1.35);
  const g = ctx.createRadialGradient(-0.3 * r, -0.3 * r, 0.1 * r, 0, 0, r); g.addColorStop(0, '#fffbe0'); g.addColorStop(1, '#ffe48a');
  ctx.fillStyle = g; circle(0, 0, r);
  ctx.fillStyle = 'rgba(220,190,110,0.35)'; circle(0.45 * r, -0.4 * r, 0.14 * r); circle(-0.5 * r, 0.45 * r, 0.1 * r);
  ctx.strokeStyle = '#7a6040'; ctx.lineWidth = 0.07 * r; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(-0.3 * r, -0.02 * r, 0.12 * r, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke(); // спит
  if (wink > 0) { ctx.fillStyle = '#7a6040'; circle(0.3 * r, -0.05 * r, 0.09 * r); }
  else { ctx.beginPath(); ctx.arc(0.3 * r, -0.02 * r, 0.12 * r, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(0, 0.25 * r, 0.15 * r, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
  ctx.restore();
}

export const RAINBOW = ['#ff5b6e', '#ff9f43', '#ffd93d', '#6bd47a', '#4da3ff', '#a46bff'];
/** Радуга-дуга с центром (cx, cy), внешний радиус r, общая толщина w */
export function rainbowArc(cx: number, cy: number, r: number, w: number, alpha = 0.85) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.lineCap = 'butt';
  const bw = w / RAINBOW.length;
  RAINBOW.forEach((c, i) => { ctx.strokeStyle = c; ctx.lineWidth = bw + 0.5; ctx.beginPath(); ctx.arc(cx, cy, r - bw * (i + 0.5), Math.PI, TAU); ctx.stroke(); });
  ctx.restore();
}

/** Искорка-звёздочка с мягким сиянием */
export function sparkleStar(x: number, y: number, s: number, rot: number, color = '#fff6a8') {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; circle(0, 0, s * 0.8);
  ctx.rotate(rot); ctx.fillStyle = color; starPath(4, s, s * 0.3); ctx.fill();
  ctx.restore();
}

/** Сердечко-контур с заливкой (для узора фона, иконок и т.п.) */
export function smallHeart(x: number, y: number, s: number, color: string, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = color; heartShape(s); ctx.fill(); ctx.restore();
}

/** Холмы по низу прямоугольника (x0..x1, нижняя граница y1), высота h */
export function hillsPath(x0: number, x1: number, yTop: number, y1: number, amp: number, phase: number) {
  ctx.beginPath(); ctx.moveTo(x0, y1);
  const n = 24;
  for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; ctx.lineTo(x, yTop + Math.sin(i / n * Math.PI * 2.2 + phase) * amp); }
  ctx.lineTo(x1, y1); ctx.closePath();
}

const INK2 = '#4a2a3a';
const blush2 = (x: number, y: number, rx: number) => { ctx.fillStyle = 'rgba(255,120,160,0.45)'; ell(x, y, rx, rx * 0.6); };

/** Котёнок сидит: (x, y) — низ лап, s — размер (высота ≈ 2.2s). look −1..1 — куда смотрит */
export function kitten(x: number, y: number, s: number, o: { look?: number; blink?: boolean; mouth?: number; wave?: number; tail?: number } = {}) {
  const C = '#ffb45c', D = '#c9772a', look = (o.look || 0) * 0.06 * s;
  ctx.save(); ctx.translate(x, y); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // хвост
  const tw = Math.sin(o.tail || 0) * 0.25 * s;
  ctx.strokeStyle = D; ctx.lineWidth = 0.26 * s; ctx.beginPath(); ctx.moveTo(0.35 * s, -0.2 * s); ctx.quadraticCurveTo(1.0 * s, -0.25 * s, 0.85 * s + tw, -1.0 * s); ctx.stroke();
  ctx.strokeStyle = C; ctx.lineWidth = 0.18 * s; ctx.stroke();
  // тело
  ctx.fillStyle = C; ell(0, -0.55 * s, 0.55 * s, 0.55 * s); ctx.strokeStyle = D; ctx.lineWidth = 0.06 * s; ctx.stroke();
  ctx.fillStyle = '#fff1dd'; ell(0, -0.42 * s, 0.3 * s, 0.36 * s);
  // лапки
  ctx.fillStyle = '#fff1dd';
  ell(-0.24 * s, -0.06 * s, 0.17 * s, 0.1 * s); ctx.stroke();
  if (o.wave && o.wave > 0) { const a = Math.sin(o.wave * 14) * 0.3; ctx.save(); ctx.translate(0.42 * s, -0.75 * s); ctx.rotate(a); ell(0.1 * s, -0.25 * s, 0.11 * s, 0.17 * s); ctx.stroke(); ctx.restore(); }
  else { ell(0.24 * s, -0.06 * s, 0.17 * s, 0.1 * s); ctx.stroke(); }
  // голова и ушки
  const hy = -1.35 * s;
  for (const sd of [-1, 1]) {
    ctx.fillStyle = C; ctx.beginPath(); ctx.moveTo(sd * 0.55 * s, hy - 0.1 * s); ctx.lineTo(sd * 0.48 * s, hy - 0.62 * s); ctx.lineTo(sd * 0.12 * s, hy - 0.42 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffb3cf'; ctx.beginPath(); ctx.moveTo(sd * 0.47 * s, hy - 0.2 * s); ctx.lineTo(sd * 0.45 * s, hy - 0.5 * s); ctx.lineTo(sd * 0.23 * s, hy - 0.38 * s); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = C; ell(0, hy, 0.62 * s, 0.5 * s); ctx.stroke();
  ctx.strokeStyle = '#e08a3a'; ctx.lineWidth = 0.06 * s;
  for (const dx of [-0.14, 0, 0.14]) { ctx.beginPath(); ctx.moveTo(dx * s, hy - 0.47 * s); ctx.lineTo(dx * s * 0.8, hy - 0.3 * s); ctx.stroke(); }
  ctx.fillStyle = '#fff1dd'; ell(0, hy + 0.2 * s, 0.3 * s, 0.2 * s);
  // глаза
  for (const sd of [-1, 1]) {
    const ex = sd * 0.24 * s + look, ey = hy - 0.05 * s;
    if (o.blink) { ctx.strokeStyle = INK2; ctx.lineWidth = 0.06 * s; ctx.beginPath(); ctx.arc(ex, ey, 0.09 * s, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    else { ctx.fillStyle = INK2; ell(ex, ey, 0.09 * s, 0.12 * s); ctx.fillStyle = '#fff'; circle(ex + 0.03 * s, ey - 0.04 * s, 0.035 * s); }
  }
  blush2(-0.42 * s, hy + 0.12 * s, 0.1 * s); blush2(0.42 * s, hy + 0.12 * s, 0.1 * s);
  ctx.fillStyle = '#ff7aa8'; ctx.beginPath(); ctx.moveTo(-0.06 * s, hy + 0.1 * s); ctx.lineTo(0.06 * s, hy + 0.1 * s); ctx.lineTo(0, hy + 0.16 * s); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = INK2; ctx.lineWidth = 0.045 * s;
  if (o.mouth && o.mouth > 0.1) { ctx.fillStyle = '#a0405a'; ell(0, hy + 0.27 * s, 0.07 * s, 0.05 * s + 0.05 * s * o.mouth); }
  else { ctx.beginPath(); ctx.arc(-0.06 * s, hy + 0.17 * s, 0.06 * s, 0.1 * Math.PI, 0.9 * Math.PI); ctx.arc(0.06 * s, hy + 0.17 * s, 0.06 * s, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(74,42,58,0.6)'; ctx.lineWidth = 0.03 * s;
  for (const sd of [-1, 1]) for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 0.28 * s, hy + 0.17 * s); ctx.lineTo(sd * 0.75 * s, hy + 0.12 * s + k * 0.07 * s); ctx.stroke(); }
  ctx.restore();
}

/** Рыбка: (x, y) — центр, s — полудлина тела, dir ±1 — куда плывёт, spin — переворот */
export function fish(x: number, y: number, s: number, col: [string, string], dir: number, spin = 0, wag = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(spin * dir); ctx.scale(dir, 1); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const [c, d] = col;
  // хвост
  ctx.save(); ctx.translate(-0.85 * s, 0); ctx.rotate(Math.sin(wag) * 0.3);
  ctx.fillStyle = d; ctx.beginPath(); ctx.moveTo(0.1 * s, 0); ctx.quadraticCurveTo(-0.4 * s, -0.6 * s, -0.65 * s, -0.55 * s); ctx.quadraticCurveTo(-0.45 * s, 0, -0.65 * s, 0.55 * s); ctx.quadraticCurveTo(-0.4 * s, 0.6 * s, 0.1 * s, 0); ctx.fill();
  ctx.restore();
  // плавник сверху
  ctx.fillStyle = d; ctx.beginPath(); ctx.moveTo(-0.35 * s, -0.5 * s); ctx.quadraticCurveTo(-0.1 * s, -1.0 * s, 0.3 * s, -0.55 * s); ctx.closePath(); ctx.fill();
  // тело
  const g = ctx.createLinearGradient(0, -0.6 * s, 0, 0.6 * s); g.addColorStop(0, c); g.addColorStop(1, d);
  ctx.fillStyle = g; ell(0, 0, s, 0.62 * s); ctx.strokeStyle = d; ctx.lineWidth = 0.06 * s; ctx.stroke();
  ctx.save(); ell(0, 0, s, 0.62 * s); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.13 * s;
  for (const dx of [-0.45, -0.15]) { ctx.beginPath(); ctx.arc(dx * s + 0.6 * s, 0, 0.75 * s, Math.PI * 0.78, Math.PI * 1.22); ctx.stroke(); }
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ell(0.05 * s, 0.25 * s, 0.22 * s, 0.1 * s, -0.4);
  ctx.fillStyle = '#fff'; circle(0.5 * s, -0.12 * s, 0.17 * s); ctx.fillStyle = INK2; circle(0.54 * s, -0.12 * s, 0.1 * s); ctx.fillStyle = '#fff'; circle(0.57 * s, -0.16 * s, 0.04 * s);
  ctx.strokeStyle = INK2; ctx.lineWidth = 0.06 * s; ctx.beginPath(); ctx.arc(0.72 * s, 0.1 * s, 0.1 * s, 0.4 * Math.PI, 1.1 * Math.PI); ctx.stroke();
  blush2(0.4 * s, 0.17 * s, 0.09 * s);
  ctx.restore();
}

/** Утёнок: (x, y) — низ лапок, s — размер (высота ≈ 1.6s), dir ±1 */
export function duck(x: number, y: number, s: number, dir: number, ph = 0, o: { blink?: boolean; mouth?: number } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const Y = '#ffe14d', D = '#d9a400', O = '#ff9a2e';
  // лапки
  ctx.strokeStyle = O; ctx.lineWidth = 0.09 * s;
  for (const k of [-1, 1]) { const st = Math.sin(ph + (k > 0 ? Math.PI : 0)) * 0.12 * s; ctx.beginPath(); ctx.moveTo(k * 0.15 * s, -0.25 * s); ctx.lineTo(k * 0.15 * s + st, -0.02 * s); ctx.lineTo(k * 0.15 * s + st + 0.14 * s, -0.02 * s); ctx.stroke(); }
  ctx.rotate(Math.sin(ph) * 0.06);
  // тело с хвостиком
  ctx.fillStyle = Y; ctx.strokeStyle = D; ctx.lineWidth = 0.05 * s;
  ctx.beginPath(); ctx.moveTo(-0.55 * s, -0.55 * s); ctx.lineTo(-0.85 * s, -0.85 * s); ctx.lineTo(-0.62 * s, -0.4 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  ell(0, -0.52 * s, 0.62 * s, 0.38 * s); ctx.stroke();
  ctx.fillStyle = '#ffd21f'; ell(-0.12 * s, -0.55 * s, 0.3 * s, 0.17 * s, 0.2); ctx.stroke();
  // голова
  const hx = 0.32 * s, hy = -1.05 * s;
  ctx.fillStyle = Y; circle(hx, hy, 0.36 * s); ctx.stroke();
  ctx.strokeStyle = D; ctx.lineWidth = 0.05 * s; ctx.beginPath(); ctx.moveTo(hx - 0.05 * s, hy - 0.35 * s); ctx.quadraticCurveTo(hx - 0.02 * s, hy - 0.55 * s, hx + 0.1 * s, hy - 0.5 * s); ctx.stroke();
  // клювик
  const m = (o.mouth || 0) * 0.08 * s;
  ctx.fillStyle = O; ctx.strokeStyle = '#d06a10'; ctx.lineWidth = 0.03 * s;
  ell(hx + 0.4 * s, hy + 0.04 * s - m * 0.5, 0.17 * s, 0.07 * s); ctx.stroke();
  ell(hx + 0.38 * s, hy + 0.1 * s + m * 0.5, 0.14 * s, 0.05 * s); ctx.stroke();
  if (o.blink) { ctx.strokeStyle = INK2; ctx.lineWidth = 0.05 * s; ctx.beginPath(); ctx.arc(hx + 0.12 * s, hy - 0.06 * s, 0.07 * s, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
  else { ctx.fillStyle = INK2; ell(hx + 0.12 * s, hy - 0.06 * s, 0.07 * s, 0.09 * s); ctx.fillStyle = '#fff'; circle(hx + 0.14 * s, hy - 0.09 * s, 0.03 * s); }
  blush2(hx + 0.05 * s, hy + 0.12 * s, 0.08 * s);
  ctx.restore();
}

/** Розовый замок: (x, y) — середина основания, s — размер (ширина ≈ 2.4s, высота ≈ 3s). lit — окна светятся */
export function castle(x: number, y: number, s: number, wave: number, lit: number) {
  ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const wall = '#ffc8e0', dk = '#d97aa6', roof = '#b98cff', rdk = '#7a4fc9';
  const tower = (cx: number, w: number, h: number, flag: string, ph: number) => {
    ctx.fillStyle = wall; ctx.strokeStyle = dk; ctx.lineWidth = 0.05 * s;
    ctx.fillRect(cx - w / 2, -h, w, h); ctx.strokeRect(cx - w / 2, -h, w, h);
    ctx.fillStyle = roof; ctx.strokeStyle = rdk; ctx.beginPath(); ctx.moveTo(cx - w * 0.62, -h); ctx.lineTo(cx, -h - w * 1.15); ctx.lineTo(cx + w * 0.62, -h); ctx.closePath(); ctx.fill(); ctx.stroke();
    const fy = -h - w * 1.15;
    ctx.strokeStyle = '#8a6a7a'; ctx.lineWidth = 0.035 * s; ctx.beginPath(); ctx.moveTo(cx, fy); ctx.lineTo(cx, fy - 0.35 * s); ctx.stroke();
    const fw = Math.sin(t * (4 + wave * 10) + ph) * (0.05 + wave * 0.08) * s;
    ctx.fillStyle = flag; ctx.beginPath(); ctx.moveTo(cx, fy - 0.35 * s); ctx.quadraticCurveTo(cx + 0.15 * s, fy - 0.33 * s + fw, cx + 0.3 * s, fy - 0.27 * s + fw); ctx.lineTo(cx, fy - 0.18 * s); ctx.closePath(); ctx.fill();
    const wl = lit > 0 ? `rgba(255,236,120,${0.6 + 0.4 * Math.sin(t * 10)})` : '#9fd3ff';
    ctx.fillStyle = wl; ctx.beginPath(); ctx.arc(cx, -h * 0.62, w * 0.18, Math.PI, TAU); ctx.lineTo(cx + w * 0.18, -h * 0.48); ctx.lineTo(cx - w * 0.18, -h * 0.48); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = dk; ctx.lineWidth = 0.03 * s; ctx.stroke();
  };
  tower(-0.9 * s, 0.5 * s, 1.7 * s, '#ff5c8a', 0);
  tower(0.9 * s, 0.5 * s, 1.7 * s, '#5cc1ff', 1);
  // стена с зубчиками
  ctx.fillStyle = wall; ctx.strokeStyle = dk; ctx.lineWidth = 0.05 * s;
  ctx.beginPath(); ctx.moveTo(-0.7 * s, 0); ctx.lineTo(-0.7 * s, -1.1 * s);
  for (let i = 0; i < 5; i++) { const x0 = -0.7 * s + i * 0.28 * s; ctx.lineTo(x0, -1.25 * s); ctx.lineTo(x0 + 0.14 * s, -1.25 * s); ctx.lineTo(x0 + 0.14 * s, -1.1 * s); ctx.lineTo(x0 + 0.28 * s, -1.1 * s); }
  ctx.lineTo(0.7 * s, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  tower(0, 0.6 * s, 2.0 * s, '#ffd23f', 2);
  // дверь
  ctx.fillStyle = '#c98aa8'; ctx.beginPath(); ctx.moveTo(-0.22 * s, 0); ctx.lineTo(-0.22 * s, -0.4 * s); ctx.arc(0, -0.4 * s, 0.22 * s, Math.PI, TAU); ctx.lineTo(0.22 * s, 0); ctx.closePath(); ctx.fill(); ctx.strokeStyle = dk; ctx.stroke();
  ctx.fillStyle = '#ffd23f'; circle(0.1 * s, -0.25 * s, 0.035 * s);
  ctx.restore();
}

/** Деревце с яблоками: (x, y) — основание ствола, s — размер (высота ≈ 2.7s). apples — какие яблоки на месте (масштаб 0..1) */
export const APPLE_PTS: [number, number][] = [[-0.5, -1.45], [0.5, -1.55], [-0.15, -2.2], [0.3, -1.95], [-0.1, -1.25]];
export function tree(x: number, y: number, s: number, shake: number, apples: number[], face = true) {
  ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.fillStyle = '#b07440'; ctx.strokeStyle = '#7a4a22'; ctx.lineWidth = 0.05 * s;
  ctx.beginPath(); ctx.moveTo(-0.2 * s, 0); ctx.quadraticCurveTo(-0.1 * s, -0.6 * s, -0.13 * s, -1.25 * s); ctx.lineTo(0.13 * s, -1.25 * s); ctx.quadraticCurveTo(0.1 * s, -0.6 * s, 0.2 * s, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.translate(0, -1.2 * s); ctx.rotate(Math.sin(t * 30) * 0.05 * shake); ctx.translate(0, 1.2 * s);
  const P: [number, number, number][] = [[0, -1.75, 0.72], [-0.55, -1.4, 0.5], [0.55, -1.42, 0.5], [-0.32, -2.15, 0.5], [0.35, -2.1, 0.5]];
  ctx.fillStyle = '#3f9a33'; for (const [px, py, r] of P) circle(px * s, py * s, r * s + 0.05 * s);
  ctx.fillStyle = '#6fcf5a'; for (const [px, py, r] of P) circle(px * s, py * s, r * s);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; circle(-0.35 * s, -2.25 * s, 0.18 * s);
  if (face) {
    ctx.strokeStyle = '#2f6a28'; ctx.lineWidth = 0.06 * s;
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(sd * 0.2 * s, -1.75 * s, 0.08 * s, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0, -1.65 * s, 0.1 * s, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
    blush2(-0.38 * s, -1.6 * s, 0.09 * s); blush2(0.38 * s, -1.6 * s, 0.09 * s);
  }
  APPLE_PTS.forEach(([px, py], i) => { const k = apples[i] ?? 1; if (k > 0.01) apple(px * s, py * s, 0.15 * s * k); });
  ctx.restore();
}
export function apple(x: number, y: number, r: number) {
  ctx.fillStyle = '#ff3b4f'; circle(x, y, r); ctx.strokeStyle = '#b3122a'; ctx.lineWidth = 0.12 * r; ctx.stroke();
  ctx.strokeStyle = '#7a4a22'; ctx.lineWidth = 0.15 * r; ctx.beginPath(); ctx.moveTo(x, y - 0.8 * r); ctx.lineTo(x + 0.15 * r, y - 1.25 * r); ctx.stroke();
  ctx.fillStyle = '#5cc160'; ell(x + 0.4 * r, y - 1.05 * r, 0.35 * r, 0.16 * r, -0.4);
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; circle(x - 0.35 * r, y - 0.3 * r, 0.22 * r);
}

export const FLAG_COLS = ['#ff5c8a', '#ffcf3f', '#5cc1ff', '#7fd96b', '#c98cff', '#ff9636'];
/** Гирлянда флажков от x0 до x1 на высоте y с провисанием sag; swing — насколько сильно качаются */
export function garland(x0: number, x1: number, y: number, sag: number, fs: number, swing: number) {
  const pt = (k: number): [number, number] => { const u = 1 - k; return [x0 + (x1 - x0) * k, u * u * y + 2 * u * k * (y + sag * 2) + k * k * y]; };
  ctx.strokeStyle = '#8a6a7a'; ctx.lineWidth = Math.max(1.5, 0.06 * fs); ctx.beginPath();
  for (let i = 0; i <= 30; i++) { const [px, py] = pt(i / 30); ctx.lineTo(px, py); } ctx.stroke();
  const n = Math.max(6, Math.round((x1 - x0) / (fs * 1.5)));
  for (let i = 0; i < n; i++) {
    const k = (i + 0.5) / n, [px, py] = pt(k);
    ctx.save(); ctx.translate(px, py); ctx.rotate(Math.sin(t * (2 + swing * 10) + i * 1.3) * (0.08 + swing * 0.35));
    ctx.fillStyle = FLAG_COLS[i % FLAG_COLS.length]; ctx.beginPath(); ctx.moveTo(-0.5 * fs, 0); ctx.lineTo(0.5 * fs, 0); ctx.lineTo(0, 1.1 * fs); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; circle(0, 0.35 * fs, 0.1 * fs);
    ctx.restore();
  }
}

/** Море полосой от yTop до низа y1 с бегущими волнами */
export function sea(x0: number, x1: number, yTop: number, y1: number, amp: number, phase: number) {
  const wave = (yy: number, a: number, ph: number) => { ctx.beginPath(); ctx.moveTo(x0, y1); const n = 40; for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; ctx.lineTo(x, yy + Math.sin(i / n * Math.PI * 6 + ph) * a); } ctx.lineTo(x1, y1); ctx.closePath(); };
  const g = ctx.createLinearGradient(0, yTop, 0, y1); g.addColorStop(0, '#7fdcf5'); g.addColorStop(1, '#3a9fd8');
  wave(yTop, amp, phase); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(2, amp * 0.5); ctx.stroke();
  wave(yTop + amp * 2.2, amp * 0.8, -phase * 1.3 + 1); ctx.fillStyle = 'rgba(40,140,210,0.45)'; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (let i = 0; i < 6; i++) { const x = x0 + (x1 - x0) * ((i * 0.19 + phase * 0.01) % 1); ell(x, yTop + amp * (3 + (i % 2) * 1.5), amp * 0.8, amp * 0.2); }
}
