// Большое сердце со всеми украшениями. Рисуется в начале координат (центр сердца), размер R.
// Одна и та же функция рисует и живое сердце, и маленькие превью на кнопках выбора.
import { ctx, TAU, t } from '../../core/canvas';
import { circle, ell, starPath } from '../../core/draw';
import { clamp01, ease } from '../../core/tween';
import { RAINBOW, flower, heartShape, smallHeart } from './things';

export const COLORS: Record<string, [string, string, string]> = {
  red: ['#ff4d6d', '#ffa3b5', '#c9184a'],
  pink: ['#ff8cc6', '#ffd6eb', '#d94f97'],
  purple: ['#b57cff', '#e4d0ff', '#7a3fd0'],
  blue: ['#59a8ff', '#c0e0ff', '#2c69c9'],
  teal: ['#36cfc0', '#b0f3ea', '#1a958a'],
  green: ['#79d653', '#d0f5ba', '#469a28'],
  yellow: ['#ffd23f', '#fff6c0', '#d39a00'],
  orange: ['#ff9636', '#ffdab3', '#d4600f'],
  rainbow: ['#ff7aa8', '#ffffff', '#8a4fd6'],
};
export const darkOf = (c: string) => (COLORS[c] || COLORS.red)[2];
const INK = '#45182e';

/** Живое состояние: куда смотрит, моргание, открытый рот, «влюблённость», качание серёжек, появление деталей */
export interface Live { lx: number; ly: number; blink: number; mouth: number; love: number; swing: number; pop: Record<string, number>; live?: boolean }
export const STILL: Live = { lx: 0, ly: 0.15, blink: 0, mouth: 0, love: 0, swing: 0, pop: {} };

/** Деталь «выпрыгивает» после выбора: масштаб от якоря (ax, ay) */
function popped(L: Live, k: string, ax: number, ay: number, fn: () => void) {
  const p = L.pop[k];
  if (p == null || p >= 1) { fn(); return; }
  const s = Math.max(0.001, ease.outBack(clamp01(p)));
  ctx.save(); ctx.translate(ax, ay); ctx.scale(s, s); ctx.translate(-ax, -ay); fn(); ctx.restore();
}

export function drawHeart(cfg: Record<string, any>, R: number, L: Live = STILL) {
  const eyes = L.love > 0.5 ? 'heart' : cfg.eyes;
  if (cfg.hair) popped(L, 'hair', 0, -0.7 * R, () => hairBack(cfg.hair, R, L));
  body(cfg.color, R);
  if (cfg.hair) popped(L, 'hair', 0, -0.7 * R, () => hairBangs(cfg.hair, R));
  if (cfg.cheeks) popped(L, 'cheeks', 0, 0.1 * R, () => cheeks(cfg.cheeks, R));
  if (L.love > 0) { ctx.fillStyle = `rgba(255,70,130,${0.45 * clamp01(L.love)})`; ell(-0.55 * R, 0.1 * R, 0.14 * R, 0.08 * R); ell(0.55 * R, 0.1 * R, 0.14 * R, 0.08 * R); }
  popped(L, 'eyes', 0, -0.12 * R, () => { drawEye(eyes, -1, R, L); drawEye(eyes, 1, R, L); });
  if (cfg.lashes) popped(L, 'lashes', 0, -0.25 * R, () => lashes(cfg.lashes, eyes, R, L));
  if (cfg.nose) popped(L, 'nose', 0, 0.06 * R, () => nose(cfg.nose, R, cfg.color));
  mouth(R, L);
  if (cfg.hair) popped(L, 'hair', 0, -0.7 * R, () => hairFront(cfg.hair, R, L, cfg.color));
  if (cfg.earrings) popped(L, 'earrings', 0, -0.2 * R, () => earrings(cfg.earrings, R, L));
  if (cfg.necklace) popped(L, 'necklace', 0, 0.55 * R, () => necklace(cfg.necklace, R));
}

// ---------------- ТЕЛО ----------------
function body(color: string, R: number) {
  heartShape(R);
  let g: CanvasGradient;
  if (color === 'rainbow') {
    g = ctx.createLinearGradient(-R, -0.9 * R, R, 0.9 * R);
    RAINBOW.forEach((c, i) => g.addColorStop(i / (RAINBOW.length - 1), c));
  } else {
    const [b, l, d] = COLORS[color] || COLORS.red;
    g = ctx.createRadialGradient(-0.4 * R, -0.55 * R, 0.05 * R, -0.1 * R, -0.1 * R, 1.3 * R);
    g.addColorStop(0, l); g.addColorStop(0.45, b); g.addColorStop(1, d);
  }
  ctx.fillStyle = g; ctx.fill();
  ctx.lineJoin = 'round'; ctx.strokeStyle = darkOf(color); ctx.lineWidth = Math.max(1.5, 0.035 * R); ctx.stroke();
  if (color === 'rainbow') { // мягкий светлый центр, чтобы лицо читалось
    const w = ctx.createRadialGradient(0, -0.05 * R, 0.1 * R, 0, -0.05 * R, 0.8 * R);
    w.addColorStop(0, 'rgba(255,255,255,0.45)'); w.addColorStop(1, 'rgba(255,255,255,0)');
    heartShape(R); ctx.fillStyle = w; ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ell(-0.55 * R, -0.62 * R, 0.17 * R, 0.08 * R, -0.75); circle(-0.34 * R, -0.8 * R, 0.035 * R);
}

// ---------------- ГЛАЗА ----------------
const EX = 0.34, EY = -0.12;
type Eye = { closed?: boolean; rx: number; ry: number };
function eyeSpec(kind: string, side: number): Eye {
  if (kind === 'happy' || (kind === 'wink' && side > 0)) return { closed: true, rx: 0.11, ry: 0.11 };
  const m: Record<string, Eye> = { round: { rx: 0.16, ry: 0.19 }, sparkle: { rx: 0.18, ry: 0.22 }, star: { rx: 0.17, ry: 0.17 }, heart: { rx: 0.16, ry: 0.15 }, button: { rx: 0.075, ry: 0.09 }, wink: { rx: 0.16, ry: 0.19 } };
  return m[kind] || m.round;
}

function drawEye(kind: string, side: number, R: number, L: Live) {
  const x = side * EX * R, y = EY * R, sp = eyeSpec(kind, side);
  if (sp.closed || L.blink > 0.85) {
    ctx.strokeStyle = INK; ctx.lineWidth = 0.045 * R; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y + 0.05 * R, 0.11 * R, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke(); return;
  }
  const k = kind === 'wink' ? 'round' : kind;
  const lx = L.lx * 0.05 * R, ly = L.ly * 0.05 * R;
  ctx.save(); ctx.translate(x, y); ctx.scale(1, Math.max(0.1, 1 - L.blink));
  if (k === 'round' || k === 'sparkle') {
    ctx.fillStyle = '#fff'; ell(0, 0, sp.rx * R, sp.ry * R); ctx.strokeStyle = INK; ctx.lineWidth = 0.022 * R; ctx.stroke();
    if (k === 'round') { ctx.fillStyle = '#2b1420'; ell(lx, ly, 0.105 * R, 0.125 * R); }
    else {
      const g = ctx.createRadialGradient(lx, ly + 0.05 * R, 0.01 * R, lx, ly, 0.15 * R);
      g.addColorStop(0, '#c7f0ff'); g.addColorStop(0.5, '#6f7dff'); g.addColorStop(1, '#3b1f8f');
      ctx.fillStyle = g; circle(lx, ly, 0.145 * R); ctx.fillStyle = '#1c0f3a'; circle(lx, ly, 0.07 * R);
    }
    ctx.fillStyle = '#fff'; circle(lx + 0.045 * R, ly - 0.05 * R, (k === 'sparkle' ? 0.05 : 0.04) * R); circle(lx - 0.035 * R, ly + 0.045 * R, 0.02 * R);
    if (k === 'sparkle') { ctx.save(); ctx.translate(lx - 0.055 * R, ly - 0.07 * R); ctx.rotate(t * 1.5); starPath(4, 0.045 * R, 0.013 * R); ctx.fill(); ctx.restore(); }
  } else if (k === 'star') {
    ctx.translate(lx * 0.6, ly * 0.6); ctx.rotate(Math.sin(t * 2) * 0.12);
    starPath(5, 0.19 * R, 0.09 * R); ctx.fillStyle = '#ffd23f'; ctx.fill();
    ctx.strokeStyle = '#d98a00'; ctx.lineWidth = 0.022 * R; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.fillStyle = '#fff'; circle(-0.045 * R, -0.05 * R, 0.03 * R);
  } else if (k === 'heart') {
    ctx.translate(lx * 0.6, ly * 0.6 + 0.02 * R);
    const s = 0.17 * R * (L.love > 0.5 ? 1 + Math.sin(t * 12) * 0.08 : 1);
    heartShape(s); ctx.fillStyle = '#ff3d7f'; ctx.fill(); ctx.strokeStyle = '#a8124a'; ctx.lineWidth = 0.022 * R; ctx.stroke();
    ctx.fillStyle = '#fff'; circle(-0.06 * R, -0.07 * R, 0.03 * R);
  } else { // button
    ctx.fillStyle = '#2b1420'; ell(lx * 0.6, ly * 0.6, sp.rx * R, sp.ry * R);
    ctx.fillStyle = '#fff'; circle(lx * 0.6 + 0.025 * R, ly * 0.6 - 0.03 * R, 0.025 * R);
  }
  ctx.restore();
}

// ---------------- РЕСНИЧКИ ----------------
function lashes(type: string, eyes: string, R: number, L: Live) {
  const col = type === 'color' ? '#ff3f98' : INK;
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineCap = 'round';
  const up = type === 'short' ? [0.06, 0.065, 0.055] : type === 'flutter' ? [0.15, 0.16, 0.13] : [0.12, 0.13, 0.11];
  for (const side of [-1, 1]) {
    const sp = eyeSpec(eyes, side), x = side * EX * R, y = EY * R;
    const bl = sp.closed || L.blink > 0.85 ? 1 : Math.max(0.1, 1 - L.blink), closed = sp.closed || L.blink > 0.85;
    const one = (a: number, len: number, curl: number) => {
      const A = side < 0 ? a : -Math.PI - a;
      let px: number, py: number;
      if (closed) { px = x + Math.cos(A) * 0.11 * R; py = y + 0.05 * R + Math.sin(A) * 0.11 * R; }
      else { px = x + Math.cos(A) * sp.rx * R; py = y + Math.sin(A) * sp.ry * R * bl; }
      const dx = Math.cos(A), dy = Math.sin(A), l = len * R, th = side * -curl;
      const ex = px + (dx * Math.cos(th) - dy * Math.sin(th)) * l, ey = py + (dx * Math.sin(th) + dy * Math.cos(th)) * l;
      ctx.lineWidth = 0.024 * R; ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + dx * l * 0.6, py + dy * l * 0.6, ex, ey); ctx.stroke();
      if (type === 'color') circle(ex, ey, 0.022 * R);
    };
    [-2.7, -2.3, -1.9].forEach((a, i) => one(a, up[i], type === 'short' ? 0.15 : 0.5));
    if (type === 'flutter' && !closed) [2.65, 2.3].forEach(a => one(a, 0.06, -0.2));
  }
}

// ---------------- РОТ, НОС, ЩЁЧКИ ----------------
function mouth(R: number, L: Live) {
  const y = 0.22 * R;
  if (L.mouth > 0.05) {
    const h = (0.08 + 0.1 * clamp01(L.mouth)) * R;
    ctx.save(); ctx.beginPath(); ctx.moveTo(-0.12 * R, y); ctx.quadraticCurveTo(0, y + h * 2, 0.12 * R, y); ctx.closePath();
    ctx.fillStyle = '#7a1f3d'; ctx.fill(); ctx.clip(); ctx.fillStyle = '#ff7b9c'; ell(0, y + h * 1.2, 0.07 * R, 0.05 * R); ctx.restore();
  } else {
    ctx.strokeStyle = INK; ctx.lineWidth = 0.04 * R; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, y - 0.07 * R, 0.11 * R, 0.22 * Math.PI, 0.78 * Math.PI); ctx.stroke();
  }
}

function nose(kind: string, R: number, color: string) {
  const y = 0.06 * R;
  if (kind === 'dot') { ctx.fillStyle = INK; ell(0, y, 0.045 * R, 0.035 * R); }
  else if (kind === 'heart') { smallHeart(0, y, 0.075 * R, '#ff2f78'); ctx.fillStyle = 'rgba(255,255,255,0.8)'; circle(-0.03 * R, y - 0.035 * R, 0.014 * R); }
  else if (kind === 'button') { ctx.fillStyle = darkOf(color === 'rainbow' ? 'pink' : color); circle(0, y, 0.06 * R); ctx.fillStyle = 'rgba(255,255,255,0.7)'; circle(-0.02 * R, y - 0.022 * R, 0.017 * R); }
  else if (kind === 'clown') {
    const g = ctx.createRadialGradient(-0.03 * R, y - 0.03 * R, 0.01 * R, 0, y, 0.095 * R); g.addColorStop(0, '#ff9a9a'); g.addColorStop(1, '#e0102f');
    ctx.fillStyle = g; circle(0, y, 0.095 * R); ctx.fillStyle = '#fff'; circle(-0.035 * R, y - 0.035 * R, 0.022 * R);
  } else if (kind === 'bunny') {
    ctx.strokeStyle = INK; ctx.lineWidth = 0.014 * R; ctx.lineCap = 'round';
    for (const s of [-1, 1]) for (const k of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(s * 0.08 * R, y + 0.015 * R); ctx.lineTo(s * 0.3 * R, y + k * 0.05 * R - 0.005 * R); ctx.stroke(); }
    ctx.fillStyle = '#ff8fb5'; ctx.beginPath(); ctx.moveTo(-0.06 * R, y - 0.03 * R); ctx.lineTo(0.06 * R, y - 0.03 * R); ctx.lineTo(0, y + 0.04 * R); ctx.closePath();
    ctx.lineJoin = 'round'; ctx.lineWidth = 0.03 * R; ctx.strokeStyle = '#ff8fb5'; ctx.stroke(); ctx.fill();
  }
}

function cheeks(kind: string, R: number) {
  for (const s of [-1, 1]) {
    const x = s * 0.56 * R, y = 0.1 * R;
    if (kind === 'blush') { ctx.fillStyle = 'rgba(255,90,140,0.5)'; ell(x, y, 0.13 * R, 0.075 * R); }
    else if (kind === 'hearts') { smallHeart(x, y, 0.07 * R, '#ff5c9a', s * 0.2); }
    else if (kind === 'freckles') { ctx.fillStyle = 'rgba(140,70,40,0.65)'; circle(x - 0.05 * R, y - 0.02 * R, 0.018 * R); circle(x + 0.04 * R, y - 0.03 * R, 0.018 * R); circle(x, y + 0.03 * R, 0.018 * R); circle(x + 0.07 * R, y + 0.03 * R, 0.015 * R); }
    else if (kind === 'stars') { ctx.save(); ctx.translate(x, y); ctx.rotate(s * 0.3); ctx.fillStyle = '#ffd23f'; starPath(5, 0.07 * R, 0.032 * R); ctx.fill(); ctx.strokeStyle = '#e09a00'; ctx.lineWidth = 0.01 * R; ctx.stroke(); ctx.restore(); }
    else if (kind === 'swirl') {
      ctx.strokeStyle = 'rgba(255,70,140,0.75)'; ctx.lineWidth = 0.02 * R; ctx.lineCap = 'round'; ctx.beginPath();
      for (let i = 0; i <= 30; i++) { const a = i * 0.42 * s, r = 0.008 * R + i * 0.0028 * R; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8); }
      ctx.stroke();
    }
  }
}

// ---------------- ПРИЧЁСКИ ----------------
const HAIR: Record<string, [string, string]> = { long: ['#ffd36b', '#d99a2b'], pigtails: ['#a8653c', '#6e3d1f'], bun: ['#8a4b2a', '#5a2c14'] };

function hairBack(kind: string, R: number, L: Live) {
  if (kind === 'long') {
    const [c, d] = HAIR.long;
    for (const s of [-1, 1]) {
      ctx.save(); ctx.scale(s, 1);
      ctx.beginPath(); ctx.moveTo(0, -0.95 * R);
      ctx.bezierCurveTo(-0.95 * R, -1.38 * R, -1.42 * R, -0.6 * R, -1.27 * R, 0.2 * R);
      ctx.bezierCurveTo(-1.2 * R, 0.55 * R, -1.22 * R, 0.7 * R, -1.08 * R, 0.86 * R);
      ctx.quadraticCurveTo(-0.98 * R, 0.66 * R, -0.82 * R, 0.78 * R);
      ctx.quadraticCurveTo(-0.72 * R, 0.56 * R, -0.52 * R, 0.62 * R);
      ctx.lineTo(0, 0.1 * R); ctx.closePath();
      ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = d; ctx.lineWidth = 0.025 * R; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-1.12 * R, -0.3 * R); ctx.quadraticCurveTo(-1.2 * R, 0.3 * R, -1.02 * R, 0.7 * R); ctx.stroke();
      ctx.restore();
    }
  } else if (kind === 'pigtails') {
    const [c, d] = HAIR.pigtails;
    for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(s * 0.86 * R, -0.72 * R); ctx.rotate(-s * 0.3 + L.swing * 0.8 + (L.live ? Math.sin(t * 2.4 + s) * 0.06 : 0)); ctx.scale(s, 1);
      ctx.beginPath(); ctx.moveTo(0, -0.12 * R);
      ctx.bezierCurveTo(0.4 * R, -0.32 * R, 0.78 * R, -0.05 * R, 0.66 * R, 0.42 * R);
      ctx.quadraticCurveTo(0.6 * R, 0.25 * R, 0.5 * R, 0.3 * R);
      ctx.bezierCurveTo(0.42 * R, 0.12 * R, 0.25 * R, 0.12 * R, 0, 0.12 * R); ctx.closePath();
      ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = d; ctx.lineWidth = 0.025 * R; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0.15 * R, -0.05 * R); ctx.quadraticCurveTo(0.5 * R, -0.05 * R, 0.6 * R, 0.3 * R); ctx.stroke();
      ctx.restore();
    }
  } else if (kind === 'bun') {
    const [c, d] = HAIR.bun;
    ctx.fillStyle = c; circle(0, -0.84 * R, 0.3 * R); ctx.strokeStyle = d; ctx.lineWidth = 0.025 * R; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -0.84 * R, 0.18 * R, Math.PI * 1.1, Math.PI * 1.8); ctx.stroke();
  }
}

/** Чёлка: волосы на макушке, обрезанные по контуру сердца, с фестонами внизу */
function bangs(R: number, col: string, dk: string) {
  ctx.save(); heartShape(R); ctx.clip();
  const yb = (x: number) => -0.42 * R - 0.16 * R * Math.sin(Math.PI * Math.min(1, Math.abs(x) / R));
  ctx.beginPath(); ctx.moveTo(-1.2 * R, -1.3 * R); ctx.lineTo(1.2 * R, -1.3 * R); ctx.lineTo(1.2 * R, yb(1.1 * R));
  const N = 9, w = 2.2 * R / N;
  for (let i = 0; i < N; i++) { const x0 = 1.1 * R - i * w, x1 = x0 - w, xm = (x0 + x1) / 2; ctx.quadraticCurveTo(xm, yb(xm) + 0.1 * R, x1, yb(x1)); }
  ctx.lineTo(-1.2 * R, yb(1.1 * R)); ctx.closePath();
  ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = dk; ctx.lineWidth = 0.025 * R; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.04 * R; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(-0.5 * R, -0.45 * R, 0.4 * R, Math.PI * 1.25, Math.PI * 1.6); ctx.stroke();
  ctx.restore();
  heartShape(R); ctx.strokeStyle = dk; ctx.lineWidth = 0.02 * R; ctx.stroke();
}

function hairBangs(kind: string, R: number) {
  if (HAIR[kind]) bangs(R, HAIR[kind][0], HAIR[kind][1]);
}

export function bow(x: number, y: number, s: number, rot: number, col = '#ff4fa0', dk = '#c21f6e') {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = col; ctx.strokeStyle = dk; ctx.lineWidth = 0.08 * s; ctx.lineJoin = 'round';
  for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0.1 * sd * s, 0.15 * s); ctx.lineTo(0.45 * sd * s, 0.95 * s); ctx.lineTo(0.2 * sd * s, 0.85 * s); ctx.lineTo(0, 0.1 * s); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  for (const sd of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(sd * 0.9 * s, -0.85 * s, sd * 1.25 * s, 0.75 * s, 0, 0); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; circle(sd * 0.6 * s, -0.12 * s, 0.09 * s); circle(sd * 0.8 * s, 0.18 * s, 0.07 * s); ctx.fillStyle = col;
  }
  circle(0, 0, 0.22 * s); ctx.stroke();
  ctx.restore();
}

function crown(R: number) {
  ctx.save(); ctx.translate(0, -0.56 * R); ctx.rotate(0.08);
  const w = 0.32 * R, h = 0.42 * R;
  const g = ctx.createLinearGradient(0, -h, 0, 0); g.addColorStop(0, '#fff3a0'); g.addColorStop(1, '#f2b600');
  ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(-w * 1.1, -h * 0.85); ctx.lineTo(-w * 0.5, -h * 0.45); ctx.lineTo(0, -h); ctx.lineTo(w * 0.5, -h * 0.45); ctx.lineTo(w * 1.1, -h * 0.85); ctx.lineTo(w, 0); ctx.closePath();
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#b07d00'; ctx.lineWidth = 0.02 * R; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.fillStyle = '#ff3d7f'; circle(0, -0.18 * h, 0.06 * R); ctx.fillStyle = '#4da3ff'; circle(-w * 0.62, -0.15 * h, 0.04 * R); circle(w * 0.62, -0.15 * h, 0.04 * R);
  ctx.fillStyle = '#fff'; for (const [x, y] of [[-w * 1.1, -h * 0.85], [0, -h], [w * 1.1, -h * 0.85]]) circle(x, y, 0.035 * R);
  ctx.save(); ctx.translate(w * 0.75, -h * 0.6); ctx.rotate(t * 2); starPath(4, 0.06 * R * (0.7 + 0.3 * Math.sin(t * 5)), 0.015 * R); ctx.fill(); ctx.restore();
  ctx.restore();
}

/** Точка на верхнем контуре сердца (левая половина, s от 0 у ложбинки до 1 у бока) */
function topPoint(s: number, R: number): [number, number] {
  const u = 1 - s, p0 = [0, -0.5], c1 = [-0.15, -0.95], c2 = [-0.95, -1.05], p3 = [-1.0, -0.4];
  const b = (i: number) => u * u * u * p0[i] + 3 * u * u * s * c1[i] + 3 * u * s * s * c2[i] + s * s * s * p3[i];
  return [b(0) * R, b(1) * R];
}

function hairFront(kind: string, R: number, L: Live, color: string) {
  if (kind === 'bow') bow(-0.52 * R, -0.9 * R, 0.32 * R, -0.35 + L.swing * 0.3);
  else if (kind === 'pigtails') { for (const s of [-1, 1]) { ctx.fillStyle = '#ff4fa0'; circle(s * 0.86 * R, -0.72 * R, 0.085 * R); ctx.fillStyle = 'rgba(255,255,255,0.7)'; circle(s * 0.86 * R - 0.03 * R, -0.75 * R, 0.025 * R); } }
  else if (kind === 'bun') bow(0.2 * R, -1.02 * R, 0.16 * R, 0.4, '#ffd23f', '#d39a00');
  else if (kind === 'long') { smallHeart(0.58 * R, -0.82 * R, 0.09 * R, '#ff4fa0', 0.3); }
  else if (kind === 'curl') {
    ctx.strokeStyle = darkOf(color); ctx.lineWidth = 0.07 * R; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -0.48 * R); ctx.bezierCurveTo(-0.06 * R, -0.75 * R, 0.08 * R, -0.95 * R, 0.24 * R, -0.88 * R);
    for (let i = 0; i <= 20; i++) { const a = -0.3 + i * 0.3, r = 0.14 * R * (1 - i / 26); ctx.lineTo(0.15 * R + Math.cos(a) * r, -0.8 * R + Math.sin(a) * r); }
    ctx.stroke();
  } else if (kind === 'crown') crown(R);
  else if (kind === 'flowers') {
    const cols = ['#ff7aa8', '#ffd23f', '#c9a7ff', '#ffffff', '#7fd1ff'];
    const pts: [number, number][] = [];
    for (const s of [0.95, 0.72, 0.45, 0.2]) { const [x, y] = topPoint(s, R); pts.push([x, y]); }
    for (const s of [0.2, 0.45, 0.72, 0.95]) { const [x, y] = topPoint(s, R); pts.push([-x, y]); }
    ctx.fillStyle = '#5cc160';
    pts.forEach(([x, y], i) => { if (i < pts.length - 1) { const [x2, y2] = pts[i + 1]; ell((x + x2) / 2, (y + y2) / 2 - 0.03 * R, 0.08 * R, 0.035 * R, Math.atan2(y2 - y, x2 - x)); } });
    pts.forEach(([x, y], i) => flower(x, y + 0.02 * R, 0.1 * R, cols[i % cols.length], i));
  } else if (kind === 'unicorn') {
    ctx.save(); ctx.translate(0, -0.52 * R);
    const g = ctx.createLinearGradient(-0.1 * R, 0, 0.1 * R, -0.7 * R); g.addColorStop(0, '#fff6c8'); g.addColorStop(0.5, '#ffc6e8'); g.addColorStop(1, '#c9b2ff');
    ctx.beginPath(); ctx.moveTo(-0.12 * R, 0); ctx.quadraticCurveTo(-0.03 * R, -0.4 * R, 0, -0.72 * R); ctx.quadraticCurveTo(0.03 * R, -0.4 * R, 0.12 * R, 0); ctx.closePath();
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#d29ac0'; ctx.lineWidth = 0.018 * R; ctx.lineJoin = 'round'; ctx.stroke();
    for (let i = 1; i <= 4; i++) { const y = -i * 0.14 * R, w = 0.12 * R * (1 - i * 0.2); ctx.beginPath(); ctx.moveTo(-w, y + 0.05 * R); ctx.lineTo(w, y - 0.02 * R); ctx.stroke(); }
    ctx.restore();
    flower(-0.2 * R, -0.58 * R, 0.08 * R, '#ff9ccf', 0.3); flower(0.2 * R, -0.58 * R, 0.08 * R, '#b9a2ff', 1);
  }
}

// ---------------- СЕРЁЖКИ ----------------
function earrings(kind: string, R: number, L: Live) {
  for (const s of [-1, 1]) {
    ctx.save(); ctx.translate(s * 1.02 * R, -0.22 * R);
    ctx.rotate(s * 0.08 + L.swing + (L.live ? Math.sin(t * 2.3 + s) * 0.08 : 0));
    ctx.scale(1.3, 1.3);
    ctx.strokeStyle = '#d9a400'; ctx.lineWidth = 0.02 * R; ctx.lineCap = 'round';
    ctx.fillStyle = '#ffd23f'; circle(0, 0, 0.03 * R);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 0.09 * R); ctx.stroke();
    ctx.translate(0, 0.09 * R);
    if (kind === 'pearl') {
      const g = ctx.createRadialGradient(-0.025 * R, 0.05 * R, 0.005 * R, 0, 0.075 * R, 0.08 * R); g.addColorStop(0, '#fff'); g.addColorStop(1, '#e3d6ea');
      ctx.fillStyle = g; circle(0, 0.075 * R, 0.075 * R); ctx.strokeStyle = '#c7b3cf'; ctx.lineWidth = 0.01 * R; ctx.stroke();
    } else if (kind === 'heart') { smallHeart(0, 0.09 * R, 0.09 * R, '#ff2f78'); ctx.fillStyle = 'rgba(255,255,255,0.8)'; circle(-0.035 * R, 0.05 * R, 0.016 * R); }
    else if (kind === 'star') { ctx.translate(0, 0.1 * R); starPath(5, 0.1 * R, 0.045 * R); ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.strokeStyle = '#d98a00'; ctx.lineWidth = 0.012 * R; ctx.stroke(); }
    else if (kind === 'hoop') { ctx.strokeStyle = '#f2b600'; ctx.lineWidth = 0.035 * R; ctx.beginPath(); ctx.arc(0, 0.11 * R, 0.11 * R, 0, TAU); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.012 * R; ctx.beginPath(); ctx.arc(0, 0.11 * R, 0.11 * R, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke(); }
    else if (kind === 'cherry') {
      ctx.strokeStyle = '#4c8a2a'; ctx.lineWidth = 0.015 * R;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-0.06 * R, 0.05 * R, -0.06 * R, 0.13 * R); ctx.moveTo(0, 0); ctx.quadraticCurveTo(0.05 * R, 0.05 * R, 0.06 * R, 0.11 * R); ctx.stroke();
      ctx.fillStyle = '#5cc160'; ell(0.04 * R, -0.01 * R, 0.04 * R, 0.017 * R, -0.4);
      ctx.fillStyle = '#e8173c'; circle(-0.06 * R, 0.16 * R, 0.055 * R); circle(0.06 * R, 0.14 * R, 0.055 * R);
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; circle(-0.075 * R, 0.14 * R, 0.014 * R); circle(0.045 * R, 0.12 * R, 0.014 * R);
    } else if (kind === 'drop') {
      const g = ctx.createLinearGradient(-0.06 * R, 0, 0.06 * R, 0.2 * R); g.addColorStop(0, '#d8f4ff'); g.addColorStop(1, '#3fa0ff');
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(0.09 * R, 0.08 * R, 0.08 * R, 0.19 * R, 0, 0.19 * R); ctx.bezierCurveTo(-0.08 * R, 0.19 * R, -0.09 * R, 0.08 * R, 0, 0); ctx.closePath();
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#2a7ed1'; ctx.lineWidth = 0.01 * R; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ell(-0.02 * R, 0.1 * R, 0.014 * R, 0.035 * R, 0.3);
    }
    ctx.restore();
  }
}

// ---------------- ОЖЕРЕЛЬЕ ----------------
function nq(s: number, R: number): [number, number] {
  const u = 1 - s; // квадратичная кривая (-0.66, 0.33) → (0, 0.82) → (0.66, 0.33)
  return [(u * u * -0.66 + s * s * 0.66) * R, (u * u * 0.33 + 2 * u * s * 0.82 + s * s * 0.33) * R];
}
function necklace(kind: string, R: number) {
  const chain = (col: string, w: number) => {
    ctx.strokeStyle = col; ctx.lineWidth = w * R; ctx.beginPath();
    for (let i = 0; i <= 20; i++) { const [x, y] = nq(i / 20, R); ctx.lineTo(x, y); }
    ctx.stroke();
  };
  if (kind === 'pearls') {
    chain('rgba(200,180,200,0.8)', 0.01);
    for (let i = 0; i < 13; i++) { const [x, y] = nq(0.04 + i * 0.92 / 12, R); ctx.fillStyle = '#fbf6ff'; circle(x, y, 0.045 * R); ctx.strokeStyle = '#c9b4d4'; ctx.lineWidth = 0.008 * R; ctx.stroke(); ctx.fillStyle = '#fff'; circle(x - 0.015 * R, y - 0.015 * R, 0.012 * R); }
  } else if (kind === 'hearts') {
    chain('#ff8fc8', 0.014);
    for (let i = 0; i < 9; i++) { const [x, y] = nq(0.06 + i * 0.88 / 8, R); smallHeart(x, y + 0.02 * R, 0.06 * R, i % 2 ? '#ff8fc8' : '#ff2f78'); }
  } else if (kind === 'flowers') {
    const cols = ['#ff7aa8', '#ffd23f', '#c9a7ff', '#7fd1ff', '#ff9636'];
    for (let i = 0; i < 9; i++) { const [x, y] = nq(0.05 + i * 0.9 / 8, R); flower(x, y, 0.065 * R, cols[i % cols.length], i); }
  } else if (kind === 'beads') {
    chain('rgba(120,80,110,0.6)', 0.01);
    for (let i = 0; i < 13; i++) { const [x, y] = nq(0.04 + i * 0.92 / 12, R); ctx.fillStyle = RAINBOW[i % RAINBOW.length]; circle(x, y, 0.042 * R); ctx.fillStyle = 'rgba(255,255,255,0.6)'; circle(x - 0.013 * R, y - 0.013 * R, 0.012 * R); }
  } else if (kind === 'locket' || kind === 'star') {
    chain('#e6b000', 0.016);
    const [x, y] = nq(0.5, R);
    if (kind === 'locket') {
      const g = ctx.createRadialGradient(x - 0.04 * R, y + 0.04 * R, 0.01 * R, x, y + 0.1 * R, 0.16 * R); g.addColorStop(0, '#fff3a0'); g.addColorStop(1, '#e0a400');
      ctx.save(); ctx.translate(x, y + 0.11 * R); heartShape(0.12 * R); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#b07d00'; ctx.lineWidth = 0.012 * R; ctx.stroke();
      ctx.fillStyle = '#ff3d7f'; circle(0, -0.02 * R, 0.03 * R); ctx.restore();
    } else {
      ctx.save(); ctx.translate(x, y + 0.11 * R); ctx.rotate(Math.sin(t * 2) * 0.1); starPath(5, 0.12 * R, 0.055 * R); ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.strokeStyle = '#d98a00'; ctx.lineWidth = 0.012 * R; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.translate(0.05 * R, -0.05 * R); ctx.rotate(t * 3); starPath(4, 0.04 * R, 0.01 * R); ctx.fill(); ctx.restore();
    }
  }
}
