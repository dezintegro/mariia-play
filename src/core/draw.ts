// Базовые фигуры и круглая кнопка.
import { ctx, TAU, t, S } from './canvas';
export function circle(x: number, y: number, r: number) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
export function ell(x: number, y: number, rx: number, ry: number, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill(); }
export function starPath(n: number, ro: number, ri: number) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? ri : ro, a = i * Math.PI / n - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
}
/** сердечко с центром около (0,0), заливается текущим fillStyle */
export function heartPath(s: number) {
  ctx.beginPath(); ctx.moveTo(0, s * 0.35);
  ctx.bezierCurveTo(-s * 1.1, -s * 0.35, -s * 0.45, -s * 1.05, 0, -s * 0.45);
  ctx.bezierCurveTo(s * 0.45, -s * 1.05, s * 1.1, -s * 0.35, 0, s * 0.35);
  ctx.fill();
}
/** круглая кнопка: b = {x, y, r, press, shake}; icon(R) рисует значок в центре */
export function drawButton(b: any, color: string, icon: (R: number) => void, pulse: boolean) {
  b.press = Math.max(0, b.press - 0.06); b.shake = Math.max(0, b.shake - 0.03);
  const s = (1 - b.press * 0.18) * (1 + (pulse ? Math.sin(t * 3) * 0.04 : 0));
  ctx.save(); ctx.translate(b.x + Math.sin(t * 50) * b.shake * 8 * S, b.y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; circle(0, b.r * 0.08, b.r);
  ctx.fillStyle = color; circle(0, 0, b.r);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = b.r * 0.1; ctx.beginPath(); ctx.arc(0, 0, b.r * 0.95, 0, TAU); ctx.stroke();
  icon(b.r);
  ctx.restore();
}
