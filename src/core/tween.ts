// Маленький набор для «спектаклей» анимации: кривые плавности и фазы по времени.
//
// Пример: малыш забирается на лошадку
//   const ph = phaseAt(P.time, [['crawl', 0.8], ['climb', 0.6], ['ride', 5], ['slide', 0.5]]);
//   if (ph.name === 'climb') pose.lean = lerp(0, -0.4, ease.inOut(ph.p));
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
export const clamp01 = (p: number) => Math.max(0, Math.min(1, p));
export const ease = {
  linear: (p: number) => p,
  in: (p: number) => p * p,
  out: (p: number) => 1 - (1 - p) * (1 - p),
  inOut: (p: number) => p * p * (3 - 2 * p),
  /** перелёт с возвратом */
  outBack: (p: number) => { const c = 1.9; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); },
  /** отскок в конце (как мячик) */
  outBounce: (p: number) => {
    const n = 7.5625, d = 2.75;
    if (p < 1 / d) return n * p * p;
    if (p < 2 / d) return n * (p -= 1.5 / d) * p + 0.75;
    if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + 0.9375;
    return n * (p -= 2.625 / d) * p + 0.984375;
  },
  /** пружинка: быстро к 1 с затухающими колебаниями */
  spring: (p: number) => 1 - Math.cos(p * Math.PI * 4.5) * Math.exp(-p * 6),
  /** 0 → 1 → 0 (горка) */
  hump: (p: number) => Math.sin(clamp01(p) * Math.PI),
};
export type Phase = [name: string, dur: number];
/** Какая фаза идёт в момент time: { name, p (0..1 внутри фазы), i, done } */
export function phaseAt(time: number, phases: Phase[]) {
  let acc = 0;
  for (let i = 0; i < phases.length; i++) {
    const [name, dur] = phases[i];
    if (time < acc + dur) return { name, p: clamp01((time - acc) / dur), i, done: false };
    acc += dur;
  }
  const last = phases[phases.length - 1];
  return { name: last[0], p: 1, i: phases.length - 1, done: true };
}
/** общая длительность фаз */
export const phasesDur = (phases: Phase[]) => phases.reduce((s, [, d]) => s + d, 0);
