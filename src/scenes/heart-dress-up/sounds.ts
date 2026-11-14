import { AC, soundOn, tone, whoosh } from '../../core/audio';
import { rand } from '../../core/canvas';

// Звуки сцены «Сердечко-модница» и весёлая музыка праздника.
export const PENTA = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760];
export const sfx = {
  pick(i = 0) { const f = PENTA[i % PENTA.length]; tone(f, 0.2, { type: 'triangle', vol: 0.13 }); tone(f * 1.5, 0.35, { vol: 0.08, delay: 0.08 }); },
  magic() { [1047, 1319, 1568, 2093, 2637].forEach((f, i) => tone(f, 0.45, { vol: 0.06, delay: i * 0.045 })); },
  poof() { whoosh(0.3, 0.1); tone(420, 0.22, { slide: 200, vol: 0.1 }); },
  next() { whoosh(0.35, 0.08); tone(523, 0.12, { type: 'triangle', vol: 0.12 }); tone(784, 0.2, { type: 'triangle', vol: 0.12, delay: 0.1 }); },
  stage(i = 0) { tone(PENTA[i % PENTA.length] / 2, 0.15, { type: 'triangle', vol: 0.12, slide: PENTA[i % PENTA.length] }); },
  giggle(p = 1) { for (let i = 0; i < 6; i++) { const f = rand(650, 900) * p; tone(f, 0.1, { type: 'triangle', vol: 0.14, slide: f * 1.35, delay: i * 0.09 }); } },
  boing() { tone(110, 0.55, { slide: 440, vol: 0.25 }); },
  kiss() { tone(900, 0.08, { slide: 1600, vol: 0.12 }); tone(1300, 0.12, { slide: 700, vol: 0.1, delay: 0.1 }); },
  beat() { tone(75, 0.16, { vol: 0.35 }); tone(70, 0.18, { vol: 0.3, delay: 0.22 }); },
  pop(p = 1) { tone(380 * p, 0.1, { slide: 1100 * p, vol: 0.18 }); },
  squeak() { tone(1100, 0.12, { type: 'triangle', slide: 1700, vol: 0.12 }); tone(1500, 0.15, { type: 'triangle', slide: 1000, vol: 0.1, delay: 0.13 }); },
  tinkle() { [1568, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.25, { vol: 0.08, delay: i * 0.09 })); },
  chime(f: number) { tone(f, 1.2, { vol: 0.12 }); tone(f * 2, 0.8, { type: 'triangle', vol: 0.03 }); },
  wheee() { tone(300, 0.6, { type: 'triangle', slide: 1200, vol: 0.12 }); },
  flutter() { for (let i = 0; i < 6; i++) tone(rand(1800, 2500), 0.05, { vol: 0.05, delay: i * 0.05 }); },
  boop() { tone(300, 0.12, { slide: 200, vol: 0.14 }); },
  arp() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.09, delay: i * 0.06 })); },
  meow() { tone(620, 0.18, { type: 'triangle', slide: 950, vol: 0.12 }); tone(950, 0.32, { type: 'triangle', slide: 560, vol: 0.12, delay: 0.16 }); },
  quack() { for (const d of [0, 0.2]) { tone(520, 0.13, { type: 'sawtooth', slide: 380, vol: 0.05, delay: d }); tone(260, 0.13, { type: 'square', slide: 200, vol: 0.03, delay: d }); } },
  blub() { [0, 0.09, 0.2].forEach((d, i) => tone(320 + i * 140, 0.08, { slide: 800 + i * 200, vol: 0.12, delay: d })); },
  splash() { whoosh(0.45, 0.14); [0, 0.06, 0.13].forEach((d, i) => tone(rand(900, 1500), 0.07, { slide: rand(300, 600), vol: 0.06, delay: d + i * 0.02 })); },
  fanfare() { [523, 659, 784].forEach((f, i) => tone(f, 0.14, { type: 'triangle', vol: 0.12, delay: i * 0.12 })); tone(1047, 0.6, { type: 'triangle', vol: 0.12, delay: 0.36 }); tone(784, 0.6, { vol: 0.06, delay: 0.36 }); },
  rustle() { whoosh(0.5, 0.12); for (let i = 0; i < 4; i++) tone(rand(1200, 2000), 0.05, { vol: 0.03, delay: i * 0.08 }); },
  plop() { tone(500, 0.12, { slide: 180, vol: 0.16 }); },
  tada() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.12, delay: i * 0.07 })); tone(1047, 1.0, { vol: 0.08, delay: 0.45 }); tone(1319, 1.0, { vol: 0.06, delay: 0.45 }); tone(1568, 1.0, { vol: 0.05, delay: 0.45 }); },
};

// Музыка праздника: простая весёлая мелодия (своя), ноты в полутонах от до 5-й октавы, null — пауза
const MEL: (number | null)[] = [0, 4, 7, 4, 9, 7, 4, 0, 2, 5, 9, 5, 7, 4, 2, null, 0, 4, 7, 12, 9, 7, 9, 12, 14, 12, 9, 7, 12, null, 12, null];
const BASS = [0, 5, 7, 0];
let mi = 0, mNext = 0;
const STEP = 0.17;
/** Вызывать каждый кадр: on — играть музыку */
export function updMusic(on: boolean) {
  if (!AC || !soundOn || !on) { mNext = 0; mi = 0; return; }
  const now = AC.currentTime;
  if (mNext < now || mNext > now + 5) mNext = now + 0.15;
  while (mNext < now + 0.3) {
    const n = MEL[mi];
    if (n !== null) tone(523.25 * Math.pow(2, n / 12), STEP * 1.6, { type: 'triangle', vol: 0.08, at: mNext });
    if (mi % 8 === 0) tone(130.8 * Math.pow(2, BASS[(mi / 8) % 4] / 12), STEP * 7, { vol: 0.1, at: mNext, attack: 0.03 });
    if (mi % 2 === 0) tone(rand(2500, 3200), 0.03, { vol: 0.015, at: mNext });
    mNext += STEP; mi = (mi + 1) % MEL.length;
  }
}
/** номер текущей ноты — чтобы сердце «пело» в такт */
export const musicBeat = () => mi;
