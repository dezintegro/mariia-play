import { AC, soundOn, tone } from '../../core/audio';
import { pick, rand } from '../../core/canvas';
import { G } from './state';

// Звуки сцены «Малыши в космосе» и колыбельная.
export const sfx: Record<string, (...a: any[]) => void> = {
  giggle(p = 1) { for (let i = 0; i < 6; i++) { const f = rand(650, 900) * p; tone(f, 0.1, { type: 'triangle', vol: 0.16, slide: f * 1.35, delay: i * 0.09 }); } },
  pop() { tone(280, 0.16, { slide: 950, vol: 0.25 }); },
  chime(f) { tone(f, 1.4, { vol: 0.14 }); tone(f * 2, 0.9, { type: 'triangle', vol: 0.04 }); },
  yay() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, { type: 'triangle', vol: 0.13, delay: i * 0.08 })); },
  boing() { tone(110, 0.55, { slide: 440, vol: 0.28 }); },
  boop() { tone(300, 0.12, { slide: 200, vol: 0.15 }); },
  sparkle() { [1047, 1319, 1568, 2093, 2637].forEach((f, i) => tone(f, 0.5, { vol: 0.07, delay: i * 0.05 })); },
  beam() { tone(400, 1.0, { type: 'sine', slide: 1200, vol: 0.12 }); tone(410, 1.0, { type: 'sine', slide: 1210, vol: 0.08 }); },
};
export const PENTA = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568];
// Колыбельная «Twinkle twinkle» (народная мелодия)
export const MEL: [number | null, number][] = [[0,1],[0,1],[7,1],[7,1],[9,1],[9,1],[7,2],[5,1],[5,1],[4,1],[4,1],[2,1],[2,1],[0,2],[null,2]];
export let lulI = 0, lulNext = 0;
export function updLullaby() {
  if (!AC || !soundOn || G.nightTarget < 1) { lulNext = 0; lulI = 0; return; }
  const now = AC.currentTime;
  if (lulNext < now || lulNext > now + 5) lulNext = now + 0.4; // > now+5: звук пересоздан, время пошло с нуля
  while (lulNext < now + 0.3) {
    const [n, len] = MEL[lulI], dur = len * 0.55;
    if (n !== null) {
      const f = 523.25 * Math.pow(2, n / 12);
      tone(f, dur * 1.7, { vol: 0.07, at: lulNext, attack: 0.04 });
      tone(f / 2, dur * 1.9, { type: 'triangle', vol: 0.035, at: lulNext, attack: 0.04 });
    }
    lulNext += dur; lulI = (lulI + 1) % MEL.length;
  }
}
Object.assign(sfx, {
  musicBox() { [0, 0, 7, 7, 9, 9, 7].forEach((n, i) => { const f = 1046.5 * Math.pow(2, n / 12); tone(f, 0.7, { vol: 0.07, delay: i * 0.22 }); tone(f * 2, 0.35, { type: 'triangle', vol: 0.02, delay: i * 0.22 }); }); },
  dingdong() { tone(784, 0.6, { type: 'triangle', vol: 0.16 }); tone(622, 0.9, { type: 'triangle', vol: 0.16, delay: 0.3 }); },
  click() { tone(1400, 0.05, { type: 'square', vol: 0.05 }); tone(700, 0.08, { type: 'square', vol: 0.04, delay: 0.05 }); },
  squeak() { tone(1100, 0.12, { type: 'triangle', slide: 1700, vol: 0.14 }); tone(1500, 0.15, { type: 'triangle', slide: 1000, vol: 0.12, delay: 0.13 }); },
  clop() { for (let i = 0; i < 4; i++) tone(i % 2 ? 520 : 440, 0.07, { type: 'square', vol: 0.05, delay: i * 0.18 }); },
  crash() { for (let i = 0; i < 6; i++) tone(rand(180, 420), 0.12, { type: 'triangle', vol: 0.1, delay: i * 0.07 }); },
  pick() { tone(500, 0.15, { type: 'triangle', slide: 850, vol: 0.14 }); },
  tada() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.12, delay: i * 0.07 })); tone(1047, 1.0, { vol: 0.08, delay: 0.45 }); tone(1319, 1.0, { vol: 0.06, delay: 0.45 }); tone(1568, 1.0, { vol: 0.05, delay: 0.45 }); },
  wish() { tone(660, 0.18, { type: 'triangle', vol: 0.08 }); tone(880, 0.3, { type: 'triangle', vol: 0.08, delay: 0.16 }); },
  dance() { [784, 659, 784, 988, 880, 1047].forEach((f, i) => tone(f, 0.16, { type: 'triangle', vol: 0.12, delay: i * 0.13 })); },
  wheee() { tone(300, 0.6, { type: 'triangle', slide: 1200, vol: 0.13 }); },
  nom() { tone(230, 0.09, { type: 'triangle', slide: 160, vol: 0.16 }); },
  yum() { tone(392, 0.35, { type: 'triangle', slide: 523, vol: 0.13 }); tone(523, 0.5, { type: 'triangle', slide: 659, vol: 0.11, delay: 0.3 }); },
  fridge() { tone(1568, 0.5, { vol: 0.08 }); tone(2093, 0.7, { vol: 0.06, delay: 0.12 }); },
  bubbling() { for (let i = 0; i < 8; i++) tone(rand(180, 320), 0.08, { slide: rand(350, 520), vol: 0.08, delay: i * 0.09 }); },
});
