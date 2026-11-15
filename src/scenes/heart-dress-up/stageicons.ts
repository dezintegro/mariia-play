// Значки этапов на ленте: сама деталь крупно (без сердца), чтобы этапы различались по силуэту.
import { TAU, ctx } from '../../core/canvas';
import { circle, ell } from '../../core/draw';
import { STAGES } from './state';
import { MINI_COLORS, bubble, cloud, heartShape, hillsPath, miniHeart, smallHeart, sun } from './things';

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
  } else if (id === 'mouth') {
    // большой смеющийся рот: зубки сверху, язычок снизу (без лица — не путается со щёчками)
    bgFill(r);
    const w = r * 0.6, y = -r * 0.2, h = r * 0.4;
    const cup = () => { ctx.beginPath(); ctx.moveTo(-w, y); ctx.quadraticCurveTo(0, y + r * 0.08, w, y); ctx.quadraticCurveTo(0, y + h * 2.2, -w, y); ctx.closePath(); };
    cup(); ctx.fillStyle = '#7a1f3d'; ctx.fill();
    ctx.save(); cup(); ctx.clip();
    ctx.fillStyle = '#fff'; ctx.fillRect(-w, y - r * 0.05, 2 * w, r * 0.2);
    ctx.fillStyle = '#ff7b9c'; ell(0, y + h * 1.1, r * 0.32, r * 0.2);
    ctx.restore();
    cup(); ctx.strokeStyle = INK; ctx.lineWidth = r * 0.07; ctx.lineJoin = 'round'; ctx.stroke();
  } else if (id === 'cheeks') {
    // бледное личико-сердечко, на нём ярко горят только румяные щёчки
    bgFill(r);
    ctx.save(); ctx.translate(0, r * 0.04); heartShape(r * 0.66); ctx.fillStyle = '#ffe6ee'; ctx.fill(); ctx.strokeStyle = '#f2c4d3'; ctx.lineWidth = r * 0.05; ctx.stroke(); ctx.restore();
    ctx.fillStyle = '#d9b3c3'; ell(-r * 0.22, -r * 0.12, r * 0.06, r * 0.075); ell(r * 0.22, -r * 0.12, r * 0.06, r * 0.075);
    ctx.strokeStyle = '#d9b3c3'; ctx.lineWidth = r * 0.05; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, r * 0.06, r * 0.1, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
    for (const s of [-1, 1]) {
      const g = ctx.createRadialGradient(s * r * 0.36, r * 0.14, r * 0.02, s * r * 0.36, r * 0.14, r * 0.17);
      g.addColorStop(0, '#ff2f78'); g.addColorStop(0.7, '#ff5c97'); g.addColorStop(1, 'rgba(255,92,151,0)');
      ctx.fillStyle = g; ell(s * r * 0.36, r * 0.14, r * 0.17, r * 0.12);
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; circle(s * r * 0.36 - r * 0.05, r * 0.1, r * 0.035);
    }
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
    // фон: круг-палитра из цветов неба (розовое, голубое, мятное, лимонное, сиреневое, ночное) — без предметов, чтобы не путать с пейзажем
    const cols = ['#ffc2dc', '#9dd3ff', '#a9ecd2', '#ffe27a', '#cbb3ff', '#4a3a92'];
    cols.forEach((col, k) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, -Math.PI / 2 + k * TAU / 6, -Math.PI / 2 + (k + 1) * TAU / 6); ctx.closePath(); ctx.fill(); });
    ctx.strokeStyle = '#fff'; ctx.lineWidth = r * 0.06;
    for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + k * TAU / 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke(); }
    ctx.fillStyle = '#fff'; circle(0, 0, r * 0.3); ctx.fillStyle = '#fff6c0'; circle(r * 0.3, -r * 0.5, r * 0.05);
  } else if (id === 'land') {
    bgFill(r, '#bfe6ff', '#ffd6ea');
    sun(-r * 0.3, -r * 0.3, r * 0.26, 0, 0); ctx.fillStyle = '#9fe08a'; hillsPath(-r, r, r * 0.35, r, r * 0.1, 0.5); ctx.fill(); cloud(r * 0.35, -r * 0.05, r * 0.3, false);
  }
  ctx.lineWidth = 1; void TAU;
}
