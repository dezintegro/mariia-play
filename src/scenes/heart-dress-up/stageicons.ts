// Значки этапов на ленте: сама деталь крупно (без сердца), чтобы этапы различались по силуэту.
import { TAU, ctx } from '../../core/canvas';
import { circle, ell } from '../../core/draw';
import { STAGES } from './state';
import { MINI_COLORS, bubble, cloud, hillsPath, miniHeart, smallHeart, sun } from './things';

const INK = '#45182e';
function bgFill(r: number, c0 = '#fff4f9', c1 = '#ffe0ee') {
  const g = ctx.createLinearGradient(0, -r, 0, r); g.addColorStop(0, c0); g.addColorStop(1, c1); ctx.fillStyle = g; circle(0, 0, r);
}
function eye(x: number, y: number, s: number, closed = false) {
  if (closed) { ctx.strokeStyle = INK; ctx.lineWidth = s * 0.22; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x, y - s * 0.2, s * 0.75, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); return; }
  ctx.fillStyle = '#fff'; ell(x, y, s * 0.8, s); ctx.strokeStyle = INK; ctx.lineWidth = s * 0.12; ctx.stroke();
  ctx.fillStyle = '#2b1420'; ell(x + s * 0.08, y + s * 0.1, s * 0.52, s * 0.62);
  ctx.fillStyle = '#fff'; circle(x + s * 0.3, y - s * 0.18, s * 0.2); circle(x - s * 0.1, y + s * 0.35, s * 0.09);
}

export function stageIcon(i: number, r: number) {
  const id = STAGES[i].id;
  if (id === 'color') {
    ctx.fillStyle = '#fff'; circle(0, 0, r);
    smallHeart(-r * 0.38, r * 0.2, r * 0.3, '#ff4d6d', -0.3); smallHeart(r * 0.38, r * 0.2, r * 0.3, '#59a8ff', 0.3); smallHeart(0, -r * 0.2, r * 0.34, '#ffd23f');
  } else if (id === 'eyes') {
    bgFill(r); eye(-r * 0.36, 0, r * 0.32); eye(r * 0.36, 0, r * 0.32);
  } else if (id === 'lashes') {
    bgFill(r); const es = r * 0.36, ey = r * 0.2;
    ctx.strokeStyle = INK; ctx.lineWidth = r * 0.08; ctx.lineCap = 'round';
    for (const a of [-2.65, -2.15, -1.57, -0.99, -0.49]) {
      const x0 = Math.cos(a) * es * 0.8, y0 = ey + Math.sin(a) * es, dx = Math.cos(a), dy = Math.sin(a), L = r * 0.3, c = dx * 0.35;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 + dx * L * 0.6, y0 + dy * L * 0.6, x0 + (dx + c) * L, y0 + (dy + Math.abs(c) * 0.4) * L); ctx.stroke();
    }
    eye(0, ey, es);
  } else if (id === 'nose') {
    bgFill(r);
    const g = ctx.createRadialGradient(-r * 0.15, -r * 0.15, r * 0.05, 0, 0, r * 0.45); g.addColorStop(0, '#ffb0c4'); g.addColorStop(1, '#e8436e');
    ctx.fillStyle = g; circle(0, 0, r * 0.42); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ell(-r * 0.15, -r * 0.16, r * 0.11, r * 0.07, -0.6);
    ctx.fillStyle = 'rgba(120,20,50,0.55)'; ell(-r * 0.13, r * 0.14, r * 0.06, r * 0.045); ell(r * 0.13, r * 0.14, r * 0.06, r * 0.045);
  } else if (id === 'cheeks') {
    bgFill(r, '#ffe9df', '#ffd2c2');
    ctx.fillStyle = 'rgba(255,80,130,0.6)'; ell(-r * 0.42, r * 0.12, r * 0.3, r * 0.2); ell(r * 0.42, r * 0.12, r * 0.3, r * 0.2);
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; circle(-r * 0.5, r * 0.04, r * 0.07); circle(r * 0.34, r * 0.04, r * 0.07);
    ctx.strokeStyle = INK; ctx.lineWidth = r * 0.08; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, -r * 0.05, r * 0.16, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
  } else if (id === 'hair') {
    bgFill(r);
    // парик: шапка волос с чёлкой и прядями по бокам
    ctx.fillStyle = '#ffcf5a'; ctx.strokeStyle = '#d99a2b'; ctx.lineWidth = r * 0.05; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-r * 0.62, r * 0.75); ctx.bezierCurveTo(-r * 0.85, -r * 0.2, -r * 0.6, -r * 0.72, 0, -r * 0.72);
    ctx.bezierCurveTo(r * 0.6, -r * 0.72, r * 0.85, -r * 0.2, r * 0.62, r * 0.75); ctx.lineTo(r * 0.35, r * 0.6); ctx.lineTo(r * 0.38, -r * 0.05);
    for (let k = 0; k < 5; k++) { const x0 = r * 0.38 - k * r * 0.152, x1 = x0 - r * 0.152; ctx.quadraticCurveTo((x0 + x1) / 2, r * 0.12, x1, -r * 0.05); }
    ctx.lineTo(-r * 0.35, r * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff4f9'; ell(0, r * 0.3, r * 0.3, r * 0.32);
    smallHeart(r * 0.42, -r * 0.48, r * 0.16, '#ff4fa0', 0.3);
  } else if (id === 'earrings') {
    bgFill(r);
    ctx.strokeStyle = '#d9a400'; ctx.lineWidth = r * 0.07; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, -r * 0.45, r * 0.13, Math.PI * 0.9, Math.PI * 2.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.13, -r * 0.45); ctx.lineTo(0, -r * 0.18); ctx.stroke();
    ctx.fillStyle = '#ffd23f'; circle(0, -r * 0.18, r * 0.07);
    const g = ctx.createLinearGradient(-r * 0.2, -r * 0.1, r * 0.2, r * 0.6); g.addColorStop(0, '#d8f4ff'); g.addColorStop(1, '#3fa0ff');
    ctx.beginPath(); ctx.moveTo(0, -r * 0.12); ctx.bezierCurveTo(r * 0.32, r * 0.15, r * 0.3, r * 0.6, 0, r * 0.6); ctx.bezierCurveTo(-r * 0.3, r * 0.6, -r * 0.32, r * 0.15, 0, -r * 0.12); ctx.closePath();
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#2a7ed1'; ctx.lineWidth = r * 0.04; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ell(-r * 0.08, r * 0.28, r * 0.05, r * 0.12, 0.3);
  } else if (id === 'necklace') {
    bgFill(r);
    for (let k = 0; k <= 10; k++) {
      const a = Math.PI * (0.95 - k * 0.09), x = Math.cos(a) * r * 0.62, y = -r * 0.25 + Math.sin(a) * r * 0.62;
      ctx.fillStyle = '#fbf6ff'; circle(x, y, r * 0.1); ctx.strokeStyle = '#c9b4d4'; ctx.lineWidth = r * 0.025; ctx.stroke(); ctx.fillStyle = '#fff'; circle(x - r * 0.03, y - r * 0.03, r * 0.03);
    }
    ctx.fillStyle = '#f2b600'; circle(0, r * 0.5, r * 0.17); ctx.fillStyle = '#ffe27a'; circle(0, r * 0.5, r * 0.12); ctx.fillStyle = '#ff4f9a'; circle(0, r * 0.5, r * 0.06);
  } else if (id === 'env') {
    bgFill(r, '#d3edff', '#ffe0ee'); bubble(r * 0.42, -r * 0.35, r * 0.24); bubble(-r * 0.5, -r * 0.4, r * 0.14); miniHeart(-r * 0.05, r * 0.15, r * 0.42, MINI_COLORS[0]);
  } else if (id === 'bg') {
    bgFill(r, '#bfe6ff', '#ffd6ea');
    sun(-r * 0.3, -r * 0.3, r * 0.26, 0, 0); ctx.fillStyle = '#9fe08a'; hillsPath(-r, r, r * 0.35, r, r * 0.1, 0.5); ctx.fill(); cloud(r * 0.35, -r * 0.05, r * 0.3, false);
  }
  ctx.lineWidth = 1; void TAU;
}
