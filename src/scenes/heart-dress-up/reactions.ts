// Свои реакции сердца на каждую деталь: свой звук и анимация на 1–2 с.
// Запускаются при выборе детали и при тапе по уже надетой детали.
import { G } from './state';

export type Xf = { dy: number; rot: number; sx: number; sy: number };
const NONE: Xf = { dy: 0, rot: 0, sx: 1, sy: 1 };

/** Запустить реакцию на деталь id (этап) = k (вариант). from: 'pick' — только что выбрали, 'tap' — тапнули по надетой */
export function react(id: string, k: string, from: 'pick' | 'tap') {
  G.hs.act = { id, k, t: 0 };
  G.hs.sqT = 0; G.hs.mouth = 1; G.hs.swingV += 3;
  void from;
}
export function updateReact(dt: number) {
  const a = G.hs.act; if (!a) return;
  a.t += dt; if (a.t > 2) G.hs.act = null;
}
/** Добавка к положению/форме всего сердца от текущей реакции (dy, rot — в пикселях/радианах; sx, sy — множители) */
export function reactXform(R: number): Xf { void R; return NONE; }
/** Какая надетая деталь под точкой (x, y — в долях R от центра сердца, y вниз), или null */
export function partAt(cfg: Record<string, any>, x: number, y: number): string | null { void cfg; void x; void y; return null; }
