// Мелкие рисованные штуки: форма сердца, мини-сердечки, цветы, пузыри, бабочки, шарики, облака, солнце, луна, радуга.
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
