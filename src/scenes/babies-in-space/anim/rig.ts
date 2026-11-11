// «Скелет» малыша в комнате для спектаклей с игрушками: перевод координат головы ↔ мира,
// руки как простой рычаг (плечо → кисть), подбор положения тела, чтобы ладошка попала в точку.
// Повторяет преобразования drawRoomBabyAt (characters.ts), ничего в нём не меняя.
import { tone } from '../../../core/audio';
import { S, t } from '../../../core/canvas';
import { animXf, armHand } from '../characters';
import { isRider } from '../nursery';
import { RB } from '../state';

export type Pt = [number, number];
/** длина руки (от плеча до центра ладошки) и плечо в координатах головы */
export const ARM = () => RB() * 0.72;
export const shoulder = (side: -1 | 1): Pt => [side * RB() * 0.55, RB() * 1.05];

/** подъём руки (wave для drawBody), чтобы рука смотрела по направлению (dx, dy) */
export function armWave(side: -1 | 1, dx: number, dy: number) {
  const a = Math.atan2(-dx, dy);
  let w = -side * a - 0.55;
  while (w > Math.PI + 0.6) w -= Math.PI * 2;
  while (w < -Math.PI + 0.6) w += Math.PI * 2;
  return w;
}

/** покачивание «ползком» из drawRoomBabyAt — поза его гасит, чтобы ладошки не дрожали */
export function crawlOf(b) {
  const still = b.sleeping() || b.dragged || b.chair || b.eat || isRider(b);
  return still ? 0 : Math.abs(Math.sin(t * 5 + b.phase)) * 3 * S;
}

export interface Body { ix: number; iy: number; dx?: number; dy?: number; lean?: number }

/** голова → мир для «чистого» тела (без подпрыгиваний от тапа) */
export function bodyWorld(B: Body, lx: number, ly: number): Pt {
  const c = Math.cos(B.lean || 0), s = Math.sin(B.lean || 0);
  return [B.ix + (B.dx || 0) + lx * c - ly * s, B.iy - RB() * 2.4 + (B.dy || 0) + lx * s + ly * c];
}
/** мир → голова для «чистого» тела */
export function bodyLocal(B: Body, wx: number, wy: number): Pt {
  const c = Math.cos(B.lean || 0), s = Math.sin(B.lean || 0);
  const vx = wx - B.ix - (B.dx || 0), vy = wy - (B.iy - RB() * 2.4 + (B.dy || 0));
  return [vx * c + vy * s, -vx * s + vy * c];
}

/** голова → мир с учётом всего, что делает drawRoomBabyAt (подпрыгивание, кувырок от тапа) */
export function rigWorld(b, lx: number, ly: number): Pt {
  const r = RB(), P = b.pose || {}, X = animXf(b);
  const bnc = (1 + Math.sin(b.bounce * Math.PI * 3) * 0.2 * b.bounce) * (b.dragged ? 1.12 : 1);
  const c = Math.cos(P.lean || 0), s = Math.sin(P.lean || 0);
  // поза (dx/dy уже содержат гашение покачивания) + подъём к голове
  let x = lx * c - ly * s + (P.dx || 0), y = lx * s + ly * c + (P.dy || 0) - r * 2.4 - crawlOf(b);
  // кувырок вокруг середины тела
  const cr = Math.cos(X.rot), sr = Math.sin(X.rot); y += r * 1.2;
  const x2 = x * cr - y * sr, y2 = x * sr + y * cr - r * 1.2;
  return [b.ix + x2 * bnc * X.sx, b.iy + X.dy + y2 * bnc * X.sy];
}

/** масштаб малыша сейчас (для размера ладошки поверх предмета) */
export function rigScale(b) {
  return (1 + Math.sin(b.bounce * Math.PI * 3) * 0.2 * b.bounce) * (b.dragged ? 1.12 : 1);
}

/** Где должно стоять тело, чтобы ладошка (side) при руке по направлению dir оказалась в точке target */
export function bodyForHand(side: -1 | 1, dir: Pt, target: Pt, iy: number, lean = 0) {
  const n = Math.hypot(dir[0], dir[1]) || 1, w = armWave(side, dir[0] / n, dir[1] / n);
  const [hx, hy] = armHand(RB(), side, w), c = Math.cos(lean), s = Math.sin(lean);
  const head: Pt = [target[0] - (hx * c - hy * s), target[1] - (hx * s + hy * c)];
  return { ix: head[0], dy: head[1] - (iy - RB() * 2.4), wave: w };
}

/** записать позу малыша (dy гасит покачивание «ползком») */
export function setPose(b, o: any) {
  b.pose = { ...o, dy: (o.dy || 0) + crawlOf(b) };
}

/** плавный переход угла по кратчайшей дуге */
export function lerpAng(a: number, b: number, p: number) {
  let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
  return a + d * p;
}

/** хлопок в ладошки */
export function clapSfx(p = 1) {
  tone(1500 * p, 0.05, { type: 'square', vol: 0.04 });
  tone(900 * p, 0.07, { type: 'triangle', vol: 0.12, slide: 500 * p });
}

/**
 * Хлопки: возвращает подъём рук (wave) и момент касания.
 * k — фаза хлопков (целое = ладошки вместе), открытые руки ~1.1, сомкнутые — у груди.
 */
export function clapWave(k: number) {
  const f = k - Math.floor(k), open = Math.sin(f * Math.PI); // 0 — вместе, 1 — врозь
  const closed = armWave(1, -0.75, 0.66); // правая рука к середине груди
  return closed + (1.15 - closed) * open;
}
