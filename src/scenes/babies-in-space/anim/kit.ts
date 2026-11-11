// Общие мелочи для «спектаклей» с малышом (лошадка, мяч): свои руки поверх тела,
// поворот вокруг нужной точки, перевод мировых координат в координаты позы.
import { ctx } from '../../../core/canvas';
import { circle, ell } from '../../../core/draw';

/** такой подъём рук прячет стандартные руки за животиком (рисуем свои через pose.front) */
export const ARMS_HIDDEN = -0.9;

/** плечо малыша в координатах головы */
export const shoulder = (r: number, side: -1 | 1): [number, number] => [side * r * 0.55, r * 1.05];

/**
 * Сдвиг позы, чтобы поворот lean шёл вокруг точки (px, py) головы-координат, а не вокруг головы.
 * Поза: translate(dx, dy) → rotate(lean); точка p остаётся на месте, если d = p − R·p.
 */
export function pivot(lean: number, px: number, py: number) {
  const c = Math.cos(lean), s = Math.sin(lean);
  return { dx: px - (px * c - py * s), dy: py - (px * s + py * c) };
}

/**
 * Точка (wx, wy) в координатах позы малыша, у которого ступни в (ox, oy) (в той же системе, что и wx, wy).
 * Учитывает dx/dy/lean позы; подпрыгивание и анимации тапа не учитываем (они короткие).
 */
export function toPose(r: number, pose: any, ox: number, oy: number, wx: number, wy: number): [number, number] {
  const x = wx - ox - (pose.dx || 0), y = wy - (oy - r * 2.4) - (pose.dy || 0), a = -(pose.lean || 0);
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
}

/** Обратное к toPose: точка позы → мир. */
export function fromPose(r: number, pose: any, ox: number, oy: number, px: number, py: number): [number, number] {
  const a = pose.lean || 0, x = px * Math.cos(a) - py * Math.sin(a), y = px * Math.sin(a) + py * Math.cos(a);
  return [ox + (pose.dx || 0) + x, oy - r * 2.4 + (pose.dy || 0) + y];
}

/** Рука от плеча к ладошке (hx, hy) — рукав цвета комбинезона и круглая ладошка. Рисуется поверх тела. */
export function drawArm(r: number, b: any, side: -1 | 1, hx: number, hy: number) {
  const [sx, sy] = shoulder(r, side), len = Math.max(r * 0.3, Math.hypot(hx - sx, hy - sy));
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(Math.atan2(hy - sy, hx - sx) - Math.PI / 2);
  ctx.fillStyle = b.color; ell(0, len * 0.45, r * 0.2, len * 0.5 + r * 0.04);
  ctx.fillStyle = b.skin; circle(0, len, r * 0.17);
  ctx.restore();
}

/** Где ладошка обычной руки при подъёме wave (как в drawBody) — чтобы плавно уходить в свою руку. */
export function restHand(r: number, side: -1 | 1, wave: number): [number, number] {
  const a = -side * (0.55 + wave);
  return [side * r * 0.55 - Math.sin(a) * r * 0.72, r * 1.05 + Math.cos(a) * r * 0.72];
}

/** поза «ползу»: чуть наклонён вперёд (вокруг ступней), ручки перебирают */
export function crawlPose(r: number, dir: number, ph: number) {
  const s = Math.sin(ph), lean = dir * 0.12;
  return { armL: 0.15 + s * 0.45, armR: 0.15 - s * 0.45, lean, ...pivot(lean, 0, r * 2.4), legL: 0.15 - s * 0.2, legR: 0.15 + s * 0.2 };
}

/** опускание тела, когда малыш сидит на попе (ножки в стороны) */
export const SIT_DY = 0.3;
