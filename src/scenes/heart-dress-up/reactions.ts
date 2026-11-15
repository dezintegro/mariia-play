// Свои реакции сердца на каждую деталь: свой звук и анимация на 1–2 с.
// Запускаются при выборе детали и при тапе по уже надетой детали.
// Здесь — звук, частицы, мимика (рот, моргание) и движение всего сердца.
// Движение самой детали рисует heart.ts по L.act (там же для каждой детали своя анимация).
import { tone, whoosh } from '../../core/audio';
import { S, TAU, pick, rand } from '../../core/canvas';
import { addP, burst } from '../../core/particles';
import { clamp01 } from '../../core/tween';
import { sfx } from './sounds';
import { G } from './state';

export type Xf = { dy: number; rot: number; sx: number; sy: number };
const NONE: Xf = { dy: 0, rot: 0, sx: 1, sy: 1 };

// ---------------- помощники ----------------
/** горка 0→1→0 за d секунд, начиная с 0 */
const hump = (x: number, d: number) => (x < 0 || x > d ? 0 : Math.sin(x / d * Math.PI));
/** затухающие колебания: f раз в секунду */
const wob = (x: number, f: number, d = 2.5) => (x < 0 ? 0 : Math.sin(x * f * TAU) * Math.exp(-x * d));
/** удар сердца «тук-тук» */
const beat = (x: number) => hump(x, 0.14) + 0.7 * hump(x - 0.22, 0.14);
/** моргнуть в моменты ts (каждое моргание длится w) */
const blinks = (x: number, ts: number[], w = 0.16) => Math.max(0, ...ts.map(t0 => hump(x - t0, w)));
/** смех: рот открывается-закрывается с a по b секунду */
const laugh = (x: number, a: number, b: number, f = 4) => (x < a || x > b ? 0 : 0.45 + 0.55 * Math.abs(Math.sin((x - a) * f * Math.PI)));
const later = (sec: number, fn: () => void) => { setTimeout(() => { try { fn(); } catch (e) { /* звук не обязателен */ } }, sec * 1000); };
/** ноты по очереди */
const seq = (fs: number[], step: number, o: { type?: OscillatorType; vol?: number; dur?: number; delay?: number } = {}) =>
  fs.forEach((f, i) => tone(f, o.dur || step * 1.6, { type: o.type || 'triangle', vol: o.vol || 0.08, delay: (o.delay || 0) + i * step }));
/** колокольчик: основной тон и пара обертонов */
const bell = (f: number, d = 0, v = 0.09) => { tone(f, 1.1, { vol: v, delay: d }); tone(f * 2.76, 0.6, { vol: v * 0.3, delay: d }); tone(f * 5.4, 0.3, { vol: v * 0.15, delay: d }); };
/** клаксон «бип» */
const honk = (f: number, d = 0) => { tone(f, 0.14, { type: 'square', vol: 0.07, delay: d }); tone(f * 1.5, 0.14, { type: 'sawtooth', vol: 0.03, delay: d }); };
/** хрюк */
const oink = (d = 0) => { for (let i = 0; i < 4; i++) tone(150 - i * 12, 0.05, { type: 'sawtooth', slide: 105, vol: 0.09, delay: d + i * 0.035 }); tone(320, 0.12, { type: 'square', slide: 220, vol: 0.035, delay: d }); };
/** «тяв» */
const yap = (d = 0) => { tone(950, 0.1, { type: 'sawtooth', slide: 520, vol: 0.06, delay: d }); tone(700, 0.09, { type: 'square', slide: 420, vol: 0.035, delay: d }); };
/** короткий шмыг носом */
const sniff = (d = 0, v = 0.08) => later(d, () => whoosh(0.14, v));

// ---------------- точки на сердце ----------------
/** точка на сердце (px, py — в долях R от центра) → экран */
function P(px: number, py: number): [number, number] { const { x, y, R } = G.heart; return [x + px * R, y + py * R]; }
const sparks = (px: number, py: number, n: number, color?: string, speed = 180) => { const [x, y] = P(px, py); burst(x, y, 'spark', n, { color, speed }); };
const hearts = (px: number, py: number, n: number, color = '#ff5c9a') => { const [x, y] = P(px, py); burst(x, y, 'heart', n, { color, up: -90, speed: 140 }); };
const notes = (px: number, py: number, n: number, color = '#b05cff') => { const [x, y] = P(px, py); for (let i = 0; i < n; i++) addP({ kind: 'note', x: x + rand(-20, 20) * S, y, vx: rand(-50, 50) * S, vy: rand(-140, -80) * S, life: rand(0.9, 1.3), size: rand(20, 30) * S, color, rot: 0, vr: 0, g: 0 }); };
const drops = (px: number, py: number, n: number, color = '#6fc3ff') => { const [x, y] = P(px, py); for (let i = 0; i < n; i++) addP({ kind: 'spark', x: x + rand(-6, 6) * S, y, vx: rand(-40, 40) * S, vy: rand(-60, 20) * S, life: rand(0.6, 1), size: rand(5, 8) * S, color, rot: 0, vr: 0, g: 600 }); };
const puff = (px: number, py: number, n: number, color = '#ffffff', size = 16) => { const [x, y] = P(px, py); burst(x, y, 'smoke', n, { color, speed: 90, size }); };
const confetti = (px: number, py: number, n: number) => { const [x, y] = P(px, py); burst(x, y, 'confetti', n, { speed: 260, g: 300 }); };
const RB = ['#ff5b6e', '#ffb02e', '#ffe066', '#5cc160', '#4da3ff', '#a46bff'];
const both = (fn: (s: number) => void) => { fn(-1); fn(1); };

// ---------------- реакции ----------------
type Spec = {
  /** звук */
  snd: () => void;
  /** в начале: частицы, мимика */
  go?: () => void;
  /** по ходу: tm — время с начала, pr — время в прошлом кадре (для событий «в момент») */
  tick?: (tm: number, pr: number) => void;
  /** движение всего сердца; dy — в долях R */
  xf?: (tm: number) => Partial<Xf>;
  /** моргание обоими глазами 0..1 */
  blink?: (tm: number) => number;
  /** открытый рот 0..1 */
  mouth?: (tm: number) => number;
  dur?: number;
};
/** событие «ровно в момент a» */
const at = (tm: number, pr: number, a: number) => pr < a && tm >= a;
const hs = () => G.hs;

const RX: Record<string, Spec> = {
  // ---------- ЦВЕТ: деталь — само сердце ----------
  'color:red': { // большое «тук-тук» дважды
    snd: () => { sfx.beat(); later(0.8, sfx.beat); [523, 659, 784].forEach((f, i) => tone(f, 0.9, { vol: 0.04, delay: 0.1 + i * 0.03 })); },
    tick: (tm, pr) => { if (at(tm, pr, 0.05) || at(tm, pr, 0.85)) hearts(0, -0.2, 6, '#ff3d6a'); },
    xf: tm => { const s = 1 + 0.09 * (beat(tm) + beat(tm - 0.8)); return { sx: s, sy: s }; },
  },
  'color:pink': { // надувается как жвачка — и «чпок»
    snd: () => { tone(200, 0.6, { type: 'triangle', slide: 900, vol: 0.1 }); tone(1300, 0.08, { slide: 250, vol: 0.2, delay: 0.62 }); later(0.62, () => whoosh(0.2, 0.1)); },
    tick: (tm, pr) => { if (at(tm, pr, 0.62)) { puff(0, 0, 8, '#ffd6eb', 24); hearts(0, -0.4, 8, '#ff8cc6'); } },
    xf: tm => { const s = tm < 0.62 ? 1 + 0.16 * (tm / 0.62) ** 2 : 1 + 0.16 * Math.cos((tm - 0.62) * 22) * Math.exp(-(tm - 0.62) * 5); return { sx: s, sy: s }; },
    mouth: tm => (tm > 0.62 && tm < 1.2 ? 0.8 : 0),
  },
  'color:purple': { // волшебство: сердце парит и кружит
    snd: () => { seq([523, 587, 659, 740, 831, 932, 1047], 0.07, { vol: 0.07 }); later(0.5, sfx.magic); },
    tick: (tm, pr) => { for (const a of [0.1, 0.5, 0.9]) if (at(tm, pr, a)) sparks(rand(-0.8, 0.8), rand(-0.8, 0.5), 6, '#d9b8ff'); },
    xf: tm => ({ dy: -0.12 * hump(tm, 1.6), rot: 0.22 * Math.sin(tm * TAU * 0.9) * hump(tm, 1.6) }),
  },
  'color:blue': { // водичка: дрожит как желе, «бульк»
    snd: () => { [0, 0.15, 0.3, 0.45].forEach((d, i) => tone(300 + i * 80, 0.12, { slide: 900 + i * 150, vol: 0.12, delay: d })); },
    go: () => { drops(-0.4, -0.6, 6); drops(0.4, -0.6, 6); },
    xf: tm => ({ sx: 1 + 0.12 * wob(tm, 2.5, 1.8), sy: 1 - 0.12 * wob(tm, 2.5, 1.8) }),
  },
  'color:green': { // лягушонок: два прыжка и «ква-ква»
    snd: () => { for (const d of [0.05, 0.5]) { tone(180, 0.13, { type: 'sawtooth', slide: 330, vol: 0.06, delay: d }); tone(340, 0.1, { type: 'square', slide: 200, vol: 0.035, delay: d + 0.1 }); } },
    tick: (tm, pr) => { if (at(tm, pr, 0.4) || at(tm, pr, 0.85)) puff(0, 1, 5, '#cff5b8', 14); },
    xf: tm => { const j = hump(tm, 0.4) + hump(tm - 0.45, 0.4), l = hump(tm - 0.38, 0.12) + hump(tm - 0.83, 0.12); return { dy: -0.35 * j, sx: 1 + 0.12 * l, sy: 1 - 0.12 * l + 0.06 * j }; },
    mouth: tm => laugh(tm, 0.05, 0.9, 2),
  },
  'color:yellow': { // солнышко: светится
    snd: () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.9, { vol: 0.05, delay: i * 0.06 })); later(0.3, sfx.tinkle); },
    go: () => { for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, [x, y] = P(Math.cos(a) * 0.9, Math.sin(a) * 0.9 - 0.1); addP({ kind: 'spark', x, y, vx: Math.cos(a) * 160 * S, vy: Math.sin(a) * 160 * S, life: 0.8, size: 9 * S, color: '#fff38a', rot: a, vr: 2, g: 0 }); } },
    xf: tm => { const s = 1 + 0.06 * hump(tm, 1.2); return { dy: -0.08 * hump(tm, 1.2), sx: s, sy: s }; },
  },
  'color:rainbow': { // переливается всеми цветами
    snd: () => { seq([523, 587, 659, 698, 784, 880, 988, 1047, 1175, 1319], 0.05, { vol: 0.06, type: 'sine' }); seq([1319, 1047, 784, 659], 0.09, { vol: 0.05, delay: 0.6 }); },
    tick: (tm, pr) => { for (let i = 0; i < 6; i++) if (at(tm, pr, 0.1 + i * 0.15)) sparks(-0.8 + i * 0.32, -0.75, 4, RB[i], 120); },
    xf: tm => ({ rot: 0.08 * Math.sin(tm * TAU * 1.5) * hump(tm, 1.6) }),
  },
  'color:dots': { // горошки «пык-пык-пык»
    snd: () => { for (let i = 0; i < 6; i++) tone(400 + i * 90, 0.06, { slide: 1000 + i * 120, vol: 0.13, delay: i * 0.11 }); },
    xf: tm => ({ sy: 1 + 0.04 * Math.sin(tm * TAU * 2.2) * hump(tm, 1.4), sx: 1 - 0.03 * Math.sin(tm * TAU * 2.2) * hump(tm, 1.4) }),
  },
  'color:stripes': { // полоски бегут, «вжжик»
    snd: () => { tone(300, 0.35, { type: 'sawtooth', slide: 1800, vol: 0.035 }); tone(400, 0.35, { type: 'sawtooth', slide: 2000, vol: 0.035, delay: 0.45 }); whoosh(0.6, 0.08); },
    xf: tm => ({ sx: 1 + 0.05 * wob(tm, 2, 2) }),
  },
  'color:sunset': { // закат: солнышко садится и встаёт, сердце плавно качается
    snd: () => { seq([1047, 880, 784, 659, 523], 0.15, { vol: 0.07, type: 'sine', dur: 0.5 }); seq([659, 784, 1047], 0.12, { vol: 0.05, delay: 0.9 }); },
    xf: tm => ({ rot: 0.08 * Math.sin(tm * TAU * 0.7) * hump(tm, 1.7), dy: 0.05 * hump(tm, 1.7) }),
  },

  // ---------- ГЛАЗА ----------
  'eyes:round': { // «ой?» — глаза круглые-круглые, удивлённый подскок
    snd: () => { tone(400, 0.35, { type: 'triangle', slide: 800, vol: 0.12 }); tone(1500, 0.05, { vol: 0.06, delay: 1.0 }); },
    xf: tm => ({ dy: -0.1 * hump(tm, 0.45), sy: 1 + 0.05 * hump(tm, 0.6) }),
    blink: tm => blinks(tm, [1.0]),
    mouth: tm => (tm < 0.9 ? 0.5 * hump(tm, 0.9) : 0),
  },
  'eyes:sparkle': { // звёздочки в глазах: подмигнул, звёзды крутятся
    snd: () => { for (let i = 0; i < 8; i++) tone(rand(2000, 3200), 0.12, { vol: 0.045, delay: i * 0.05 }); tone(1500, 0.04, { type: 'square', vol: 0.04, delay: 0.3 }); },
    tick: (tm, pr) => { if (at(tm, pr, 0.35)) { sparks(-0.34, -0.12, 8, '#fff38a', 160); sparks(0.34, -0.12, 8, '#c7f0ff', 160); } },
    xf: tm => ({ rot: 0.08 * hump(tm, 1) }),
  },
  'eyes:happy': { // хохочет, глазки-дужки прыгают
    snd: () => { sfx.giggle(1.3); later(0.5, () => sfx.giggle(1.5)); },
    xf: tm => ({ sx: 1 + 0.03 * Math.sin(tm * TAU * 2.5) * hump(tm, 1.3) }),
    mouth: tm => laugh(tm, 0, 1.2, 4),
  },
  'eyes:sleepy': { // сладко зевает и потягивается
    snd: () => { tone(500, 0.9, { type: 'triangle', slide: 220, vol: 0.12, attack: 0.15 }); tone(250, 0.7, { slide: 180, vol: 0.05, delay: 0.2 }); tone(330, 0.4, { type: 'triangle', slide: 300, vol: 0.05, delay: 1.1 }); },
    tick: (tm, pr) => { if (at(tm, pr, 0.6)) puff(0.3, -0.5, 4, '#e8e0ff', 14); },
    xf: tm => ({ sy: 1 + 0.1 * hump(tm, 1.4), sx: 1 - 0.04 * hump(tm, 1.4) }),
    mouth: tm => 1.1 * hump(tm, 1.1),
  },
  'eyes:cat': { // кошачьи глазки: зрачки расширяются, «мурр»
    snd: () => { for (let i = 0; i < 14; i++) tone(i % 2 ? 70 : 85, 0.06, { type: 'sawtooth', vol: 0.05, delay: i * 0.045 }); later(0.7, sfx.meow); },
    xf: tm => ({ rot: 0.14 * Math.sin(tm * TAU * 1.1) * hump(tm, 1.5) }),
  },
  'eyes:rainbow': { // радужки закрутились, сердце кружится
    snd: () => { tone(600, 0.3, { type: 'triangle', slide: 1200, vol: 0.08 }); tone(1200, 0.3, { type: 'triangle', slide: 600, vol: 0.08, delay: 0.3 }); tone(600, 0.35, { type: 'triangle', slide: 1400, vol: 0.08, delay: 0.6 }); },
    tick: (tm, pr) => { if (at(tm, pr, 0.2)) both(s => sparks(s * 0.34, -0.12, 5, pick(RB), 120)); },
    xf: tm => ({ rot: 0.15 * wob(tm, 1.5, 1.5) }),
  },
  'eyes:glasses': { // подмигнул, блик пробежал по стёклам
    snd: () => { tone(220, 0.2, { type: 'triangle', slide: 260, vol: 0.08 }); tone(1500, 0.04, { type: 'square', vol: 0.04, delay: 0.25 }); tone(2637, 0.4, { vol: 0.07, delay: 0.6 }); tone(3520, 0.3, { vol: 0.04, delay: 0.65 }); },
    tick: (tm, pr) => { if (at(tm, pr, 0.65)) both(s => sparks(s * 0.34 + 0.12, -0.25, 3, '#ffffff', 80)); },
    xf: tm => ({ dy: -0.05 * hump(tm, 0.6), rot: -0.06 * hump(tm, 1.2) }),
  },
  'eyes:sunglasses': { // очки съезжают на кончик носа — и обратно; «крутой» звук
    snd: () => { tone(900, 0.25, { type: 'triangle', slide: 500, vol: 0.06 }); tone(220, 0.25, { type: 'sawtooth', slide: 165, vol: 0.06, delay: 0.3 }); tone(196, 0.4, { type: 'sawtooth', slide: 147, vol: 0.06, delay: 0.58 }); tone(500, 0.25, { type: 'triangle', slide: 900, vol: 0.06, delay: 1.05 }); },
    xf: tm => ({ rot: -0.1 * hump(tm, 1.4) }),
  },
  'eyes:wink': { // подмигивает другим глазом и посылает воздушный поцелуй
    snd: () => { sfx.kiss(); tone(1760, 0.3, { vol: 0.06, delay: 0.3 }); },
    tick: (tm, pr) => { if (at(tm, pr, 0.3)) addP({ kind: 'heart', x: P(-0.34, -0.12)[0], y: P(0, -0.12)[1], vx: -60 * S, vy: -110 * S, life: 1.2, size: 16 * S, color: '#ff3d7f', rot: 0, vr: 2, g: 0 }); },
    xf: tm => ({ rot: 0.12 * hump(tm, 0.9) }),
  },
  'eyes:button': { // глазки-бусинки подпрыгивают, «тук-тук» по дереву
    snd: () => { [0, 0.12, 0.24, 0.36].forEach((d, i) => tone(900 + (i % 2) * 300, 0.04, { type: 'square', vol: 0.05, delay: d })); },
    xf: tm => ({ dy: -0.15 * hump(tm, 0.35) }),
  },

  // ---------- РЕСНИЧКИ: хлопают ----------
  'lashes:short': {
    snd: () => { [0.1, 0.3, 0.5].forEach(d => tone(2000, 0.04, { type: 'triangle', vol: 0.08, delay: d })); },
    blink: tm => blinks(tm, [0.1, 0.3, 0.5], 0.14),
    xf: tm => ({ sy: 1 + 0.025 * Math.sin(tm * TAU * 2.5) * hump(tm, 0.7) }),
  },
  'lashes:long': { // медленно хлопает ресницами — «флирт»
    snd: () => { tone(800, 0.25, { type: 'triangle', slide: 1600, vol: 0.1 }); tone(1400, 0.45, { type: 'triangle', slide: 700, vol: 0.1, delay: 0.3 }); },
    go: () => { hs().love = Math.max(hs().love, 0.4); },
    tick: (tm, pr) => { if (at(tm, pr, 0.8)) hearts(0, -0.4, 5); },
    blink: tm => blinks(tm, [0.15, 0.7], 0.35),
    xf: tm => ({ rot: 0.1 * hump(tm, 1.4), sx: 1 - 0.03 * hump(tm, 1.4) }),
  },
  'lashes:one': { // одна ресничка: медленно и кокетливо хлопает, «дзынь»
    snd: () => { tone(900, 0.3, { type: 'triangle', slide: 1500, vol: 0.09 }); tone(2093, 0.5, { vol: 0.05, delay: 0.45 }); },
    tick: (tm, pr) => { if (at(tm, pr, 0.5)) both(s => sparks(s * 0.5, -0.3, 3, '#ffffff', 90)); },
    blink: tm => blinks(tm, [0.2], 0.4),
    xf: tm => ({ rot: -0.08 * hump(tm, 1.2) }),
  },
  'lashes:flutter': { // хлопает часто-часто, как крылышками, и чуть взлетает
    snd: () => { for (let i = 0; i < 12; i++) tone(rand(1600, 2400), 0.04, { vol: 0.04, delay: i * 0.06 }); tone(500, 0.8, { type: 'triangle', slide: 900, vol: 0.05 }); },
    blink: tm => (tm < 1.2 ? Math.abs(Math.sin(tm * TAU * 2.5)) : 0),
    xf: tm => ({ dy: -0.25 * hump(tm, 1.6), rot: 0.05 * Math.sin(tm * TAU * 2) * hump(tm, 1.6) }),
  },
  'lashes:color': { // ресницы перебирают цвета, ксилофон
    snd: () => seq([523, 659, 784, 1047, 1319], 0.1, { vol: 0.1 }),
    tick: (tm, pr) => { if (at(tm, pr, 0.5)) both(s => sparks(s * 0.34, -0.35, 4, pick(RB), 100)); },
    blink: tm => blinks(tm, [0.6], 0.18),
  },
  'lashes:lower': { // смущённо хлопает, «ой»
    snd: () => { tone(700, 0.15, { type: 'triangle', slide: 900, vol: 0.09 }); tone(900, 0.3, { type: 'triangle', slide: 600, vol: 0.09, delay: 0.15 }); later(0.5, () => sfx.giggle(1.2)); },
    blink: tm => blinks(tm, [0.3, 0.55], 0.15),
    xf: tm => ({ rot: -0.1 * hump(tm, 1.3), sy: 1 - 0.04 * hump(tm, 1.3) }),
  },
  'lashes:wing': { // стрелочки-крылышки взмахивают, сердце принимает позу
    snd: () => { whoosh(0.25, 0.1); later(0.35, () => whoosh(0.25, 0.1)); tone(1568, 0.3, { type: 'triangle', vol: 0.07, delay: 0.7 }); },
    blink: tm => blinks(tm, [0.75], 0.16),
    xf: tm => ({ rot: 0.12 * hump(tm, 0.9) }),
  },
  'lashes:glitter': { // тени сверкают, блёстки летят
    snd: () => { for (let i = 0; i < 16; i++) tone(rand(2500, 4000), 0.05, { vol: 0.03, delay: i * 0.04 }); },
    tick: (tm, pr) => { for (const a of [0.05, 0.4, 0.75]) if (at(tm, pr, a)) both(s => sparks(s * 0.34, -0.33, 4, a > 0.3 ? '#fff2a0' : '#c7e6ff', 120)); },
    blink: tm => blinks(tm, [0.9], 0.16),
    xf: tm => { const s = 1 + 0.04 * hump(tm, 1.2); return { sx: s, sy: s }; },
  },
  'lashes:brows': { // бровки скачут вверх-вниз
    snd: () => { for (const d of [0, 0.4]) { tone(300, 0.15, { slide: 600, vol: 0.12, delay: d }); tone(600, 0.15, { slide: 300, vol: 0.12, delay: d + 0.2 }); } },
    xf: tm => ({ dy: -0.04 * Math.abs(Math.sin(tm * TAU * 2.5)) * hump(tm, 1.2) }),
    mouth: tm => laugh(tm, 0.9, 1.4),
  },

  // ---------- НОСИК ----------
  'nose:dot': { // «буп» и шмыг-шмыг
    snd: () => { tone(600, 0.1, { slide: 400, vol: 0.14 }); sniff(0.3); sniff(0.48); },
    xf: tm => ({ dy: -0.02 * hump(tm - 0.3, 0.35) }),
  },
  'nose:tone': { // «буп» — и блик на носике вспыхивает
    snd: () => { tone(700, 0.1, { slide: 1000, vol: 0.13 }); tone(1800, 0.35, { vol: 0.05, delay: 0.3 }); tone(2400, 0.3, { vol: 0.03, delay: 0.36 }); },
    tick: (tm, pr) => { if (at(tm, pr, 0.3)) sparks(-0.02, 0.03, 5, '#ffffff', 90); },
    xf: tm => ({ dy: -0.03 * hump(tm, 0.4) }),
  },
  'nose:soft': { // носик-кнопочка: «пи-пи-пи», как резиновая игрушка
    snd: () => { [0, 0.3, 0.6].forEach((d, i) => tone(850 + i * 120, 0.12, { type: 'triangle', slide: 1300 + i * 150, vol: 0.11, delay: d })); },
    xf: tm => ({ sy: 1 - 0.03 * (hump(tm, 0.2) + hump(tm - 0.3, 0.2) + hump(tm - 0.6, 0.2)) }),
    mouth: tm => laugh(tm, 0.8, 1.5, 4) * 0.7,
  },
  'nose:tri': { // носик зверька: шмыг-шмыг-шмыг, как у зайчика
    snd: () => { [0, 0.16, 0.32, 0.48].forEach(d => sniff(d, 0.07)); tone(1500, 0.08, { type: 'triangle', slide: 1900, vol: 0.06, delay: 0.75 }); },
    xf: tm => ({ dy: -0.012 * Math.abs(Math.sin(tm * TAU * 2.5)) * hump(tm, 0.9) }),
  },
  'nose:line': { // носик-дужка: улыбается шире и хихикает
    snd: () => { tone(500, 0.3, { type: 'triangle', slide: 900, vol: 0.08 }); later(0.3, () => sfx.giggle(1.25)); },
    xf: tm => ({ sx: 1 + 0.04 * hump(tm, 0.9) }),
    mouth: tm => laugh(tm, 0.3, 1.2, 4),
  },
  'nose:heart': { // носик-сердечко бьётся
    snd: () => { for (const d of [0, 0.6]) { tone(300, 0.08, { vol: 0.2, delay: d }); tone(280, 0.1, { vol: 0.16, delay: d + 0.13 }); } tone(1568, 0.4, { vol: 0.05, delay: 0.3 }); },
    tick: (tm, pr) => { if (at(tm, pr, 0.05) || at(tm, pr, 0.65)) hearts(0, 0.04, 4, '#ff2f78'); },
    xf: tm => { const s = 1 + 0.03 * (beat(tm) + beat(tm - 0.6)); return { sx: s, sy: s }; },
  },
  'nose:button': { // пуговка крутится, трещотка
    snd: () => { for (let i = 0; i < 12; i++) tone(1000 + i * 60, 0.02, { type: 'square', vol: 0.04, delay: i * 0.08 }); tone(1319, 0.3, { type: 'triangle', vol: 0.07, delay: 1.0 }); },
    xf: tm => ({ rot: 0.06 * wob(tm, 2, 2) }),
  },
  'nose:clown': { // «бип-бип», нос сжимается, сердце хохочет
    snd: () => { honk(520, 0); honk(520, 0.35); later(0.6, () => sfx.giggle(1.1)); },
    tick: (tm, pr) => { if (at(tm, pr, 0.6)) confetti(0, 0.06, 12); },
    xf: tm => ({ sx: 1 + 0.04 * Math.sin(tm * TAU * 2.5) * hump(tm - 0.6, 1) }),
    mouth: tm => laugh(tm, 0.6, 1.6, 4),
  },
  'nose:cat': { // «мяу», усики шевелятся
    snd: () => { sfx.meow(); },
    xf: tm => ({ rot: 0.1 * hump(tm, 0.9) }),
    mouth: tm => 0.7 * hump(tm, 0.5),
  },
  'nose:pig': { // хрю-хрю, пятачок дёргается
    snd: () => { oink(0); oink(0.32); },
    tick: (tm, pr) => { if (at(tm, pr, 0.6)) puff(0, 0.1, 4, '#ffd0de', 12); },
    xf: tm => ({ dy: -0.05 * (hump(tm, 0.18) + hump(tm - 0.32, 0.18)) }),
    mouth: tm => laugh(tm, 0.6, 1.2, 4),
  },
  'nose:strawberry': { // клубничка прыгает, «ням-ням»
    snd: () => { for (const d of [0, 0.35]) { tone(400, 0.1, { type: 'triangle', slide: 600, vol: 0.1, delay: d }); tone(500, 0.12, { type: 'triangle', slide: 350, vol: 0.1, delay: d + 0.15 }); } },
    tick: (tm, pr) => { if (at(tm, pr, 0.2)) hearts(0, 0.04, 3, '#ff3b5c'); },
    xf: tm => ({ sy: 1 + 0.05 * wob(tm, 2) }),
    mouth: tm => laugh(tm, 0, 0.8, 3),
  },
  'nose:dog': { // «тяв-тяв», нос нюхает, сердце виляет как хвостиком
    snd: () => { yap(0); yap(0.3); sniff(0.7); sniff(0.85); },
    xf: tm => ({ rot: 0.08 * Math.sin(tm * TAU * 2) * hump(tm, 1.5) }),
    mouth: tm => 0.8 * (hump(tm, 0.15) + hump(tm - 0.3, 0.15)),
  },
  'nose:mustache': { // усы-завитушки шевелятся, «о-ля-ля»
    snd: () => { tone(659, 0.2, { type: 'triangle', vol: 0.09 }); tone(784, 0.2, { type: 'triangle', vol: 0.09, delay: 0.2 }); tone(1047, 0.5, { type: 'triangle', slide: 1000, vol: 0.09, delay: 0.4 }); },
    xf: tm => ({ rot: 0.08 * Math.sin(tm * TAU * 2) * hump(tm, 1.4), sy: 1 + 0.04 * hump(tm, 1) }),
  },

  // ---------- ЩЁЧКИ ----------
  'cheeks:blush': { // краснеет сильнее и смущённо хихикает
    snd: () => { tone(900, 0.4, { type: 'triangle', slide: 700, vol: 0.08 }); later(0.35, () => sfx.giggle(1.4)); },
    go: () => { hs().love = Math.max(hs().love, 0.45); },
    xf: tm => ({ rot: -0.1 * hump(tm, 1.5), sx: 1 - 0.05 * hump(tm, 1.5) }),
    mouth: tm => laugh(tm, 0.35, 1.0, 4) * 0.6,
  },
  'cheeks:shine': { // щёчки-блёстки: краснеет, блики вспыхивают, хрустальный звон
    snd: () => { for (let i = 0; i < 7; i++) tone(rand(2200, 3400), 0.15, { vol: 0.04, delay: i * 0.07 }); later(0.6, () => sfx.giggle(1.4)); },
    go: () => { hs().love = Math.max(hs().love, 0.4); },
    tick: (tm, pr) => { if (at(tm, pr, 0.15) || at(tm, pr, 0.85)) both(s => sparks(s * 0.56, 0.08, 4, '#ffffff', 110)); },
    xf: tm => ({ rot: 0.08 * hump(tm, 1.4) }),
  },
  'cheeks:hearts': { // сердечки на щёчках бьются «тук-тук», из них вылетают сердечки
    snd: () => { for (const d of [0, 0.7]) { tone(300, 0.08, { vol: 0.2, delay: d }); tone(280, 0.1, { vol: 0.16, delay: d + 0.22 }); } tone(1319, 0.5, { type: 'triangle', vol: 0.05, delay: 0.4 }); },
    tick: (tm, pr) => { if (at(tm, pr, 0.05) || at(tm, pr, 0.75)) both(s => hearts(s * 0.56, 0.05, 2, '#ff6fa8')); },
    xf: tm => { const s = 1 + 0.03 * (beat(tm) + beat(tm - 0.7)); return { sx: s, sy: s }; },
  },
  'cheeks:doll': { // надувает щёчки — «пуф!»
    snd: () => { tone(150, 0.4, { slide: 300, vol: 0.1, attack: 0.1 }); tone(800, 0.08, { slide: 200, vol: 0.14, delay: 0.5 }); later(0.5, () => whoosh(0.18, 0.08)); },
    tick: (tm, pr) => { if (at(tm, pr, 0.5)) puff(0, 0.25, 5, '#ffffff', 12); },
    xf: tm => ({ sx: 1 + 0.12 * hump(tm, 0.5) + 0.05 * wob(tm - 0.5, 2, 4) }),
  },
  'cheeks:freckles': { // веснушки пляшут, пиццикато
    snd: () => seq([784, 1047, 880, 1175, 1319], 0.1, { vol: 0.1, dur: 0.08 }),
    xf: tm => ({ dy: -0.04 * hump(tm, 0.6) }),
    mouth: tm => laugh(tm, 0, 0.7, 4) * 0.5,
  },
  'cheeks:swirl': { // завитки кружатся — у сердца кружится голова
    snd: () => { tone(400, 0.6, { type: 'triangle', slide: 1600, vol: 0.08 }); tone(1600, 0.6, { type: 'triangle', slide: 400, vol: 0.08, delay: 0.6 }); },
    xf: tm => ({ rot: 0.15 * Math.sin(tm * TAU * 1.3) * hump(tm, 1.6) }),
  },
  'cheeks:rainbow': { // радужные наклейки сияют, арфа
    snd: () => seq([523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760], 0.045, { vol: 0.07, type: 'sine', dur: 0.4 }),
    tick: (tm, pr) => { if (at(tm, pr, 0.3)) both(s => sparks(s * 0.56, 0.05, 5, pick(RB), 120)); },
    xf: tm => ({ dy: -0.08 * hump(tm, 1) }),
  },
  'cheeks:daisy': { // ромашки крутятся вертушкой, «ля-ля»
    snd: () => { seq([784, 880, 784, 1047], 0.2, { vol: 0.08 }); whoosh(0.8, 0.05); },
    xf: tm => ({ rot: 0.1 * Math.sin(tm * TAU) * hump(tm, 1.6) }),
    mouth: tm => laugh(tm, 0, 0.8, 2.5),
  },
  'cheeks:candy': { // посыпка подскакивает, «хрум-хрум»
    snd: () => { [0, 0.18, 0.36].forEach(d => later(d, () => whoosh(0.12, 0.12))); tone(1568, 0.4, { vol: 0.06, delay: 0.6 }); },
    tick: (tm, pr) => { if (at(tm, pr, 0.2)) both(s => { const [x, y] = P(s * 0.56, 0.1); burst(x, y, 'confetti', 5, { speed: 160, g: 400, size: 6 }); }); },
    xf: tm => ({ sy: 1 + 0.04 * wob(tm, 2.5, 2) }),
    mouth: tm => laugh(tm, 0, 0.6, 4),
  },
  'cheeks:paw': { // лапки «топ-топ-топ» и писк
    snd: () => { [0, 0.15, 0.3].forEach(d => tone(160, 0.08, { vol: 0.2, delay: d })); tone(1400, 0.1, { type: 'triangle', slide: 1800, vol: 0.09, delay: 0.5 }); },
    xf: tm => ({ sy: 1 - 0.04 * Math.abs(Math.sin(tm * TAU * 2.5)) * hump(tm, 0.8) }),
  },

  // ---------- ПРИЧЁСКИ ----------
  'hair:bow': { // бантик хлопает «крылышками»
    snd: () => { sfx.rustle(); tone(1319, 0.3, { type: 'triangle', vol: 0.08, delay: 0.25 }); },
    xf: tm => ({ rot: 0.06 * wob(tm, 2, 2) }),
  },
  'hair:headband': { // по ободку бежит блеск, бантик хлопает — «глиссандо»
    snd: () => { seq([1047, 1175, 1319, 1568, 1760, 2093], 0.09, { vol: 0.05, type: 'sine', dur: 0.3 }); later(0.1, sfx.rustle); },
    tick: (tm, pr) => { if (at(tm, pr, 0.6)) sparks(0, -0.75, 6, '#ffffff', 140); },
    xf: tm => ({ dy: -0.05 * hump(tm, 0.8) }),
  },
  'hair:clip': { // заколка-звёздочка крутится и сверкает, «дзинь-дзинь»
    snd: () => { whoosh(0.5, 0.06); bell(1760, 0.5, 0.07); bell(2349, 0.7, 0.05); },
    tick: (tm, pr) => { if (at(tm, pr, 0.6)) sparks(-0.55, -0.85, 8, '#fff6a8', 150); },
    xf: tm => ({ rot: -0.08 * hump(tm, 1.2) }),
  },
  'hair:long': { // взмах длинными волосами, «шшш-ах»
    snd: () => { whoosh(0.7, 0.12); [1047, 1319, 1568].forEach((f, i) => tone(f, 0.7, { vol: 0.05, delay: 0.3 + i * 0.05 })); },
    tick: (tm, pr) => { if (at(tm, pr, 0.4)) { sparks(-1.1, 0, 4, '#ffe9a8', 100); sparks(1.1, 0, 4, '#ffe9a8', 100); } },
    xf: tm => ({ rot: 0.1 * Math.sin(tm * TAU * 1.2) * hump(tm, 1.6) }),
  },
  'hair:pigtails': { // хвостики машут пропеллером — сердце взлетает
    snd: () => { for (let i = 0; i < 16; i++) tone(i % 2 ? 200 : 260, 0.04, { type: 'square', vol: 0.03, delay: i * 0.06 }); sfx.wheee(); },
    xf: tm => ({ dy: -0.22 * hump(tm, 1.4) }),
    mouth: tm => 0.6 * hump(tm, 1.4),
  },
  'hair:crown': { // гордо вытягивается вверх, фанфары
    snd: () => { sfx.fanfare(); },
    tick: (tm, pr) => { if (at(tm, pr, 0.4)) sparks(0, -1.1, 12, '#fff38a', 220); },
    xf: tm => ({ sy: 1 + 0.1 * hump(tm, 1.4), sx: 1 - 0.05 * hump(tm, 1.4) }),
  },
  'hair:flowers': { // цветочки качаются и раскрываются, птички щебечут
    snd: () => { for (const d of [0, 0.5]) { tone(2200, 0.08, { slide: 3000, vol: 0.06, delay: d }); tone(2600, 0.08, { slide: 2000, vol: 0.06, delay: d + 0.1 }); tone(2400, 0.1, { slide: 3200, vol: 0.05, delay: d + 0.2 }); } },
    tick: (tm, pr) => { if (at(tm, pr, 0.3)) { const [x, y] = P(0, -0.9); burst(x, y, 'heart', 8, { color: '#ffb3d1', speed: 160, up: -40 }); } },
    xf: tm => ({ rot: 0.08 * Math.sin(tm * TAU) * hump(tm, 1.6) }),
  },
  'hair:unicorn': { // рог светится, радужные искры, «иго-го»
    snd: () => { for (let i = 0; i < 10; i++) tone(1400 - i * 60 + (i % 2) * 120, 0.06, { type: 'triangle', vol: 0.07, delay: i * 0.05 }); later(0.55, sfx.magic); },
    tick: (tm, pr) => { for (let i = 0; i < 6; i++) if (at(tm, pr, 0.4 + i * 0.1)) sparks(0, -1.22, 3, RB[i], 160); },
    xf: tm => ({ dy: -0.12 * Math.abs(Math.sin(tm * TAU * 1.5)) * hump(tm, 1.6) }),
  },
  'hair:bun': { // пучок пружинит, «боинг-боинг»
    snd: () => { tone(150, 0.3, { slide: 500, vol: 0.2 }); tone(180, 0.3, { slide: 600, vol: 0.18, delay: 0.55 }); },
    xf: tm => ({ sy: 1 - 0.07 * Math.abs(Math.sin(tm * TAU * 1.8)) * hump(tm, 1.3) }),
  },
  'hair:cat': { // ушки дёргаются, «мяу-мяу»
    snd: () => { for (const d of [0, 0.45]) { tone(800, 0.15, { type: 'triangle', slide: 1100, vol: 0.11, delay: d }); tone(1100, 0.25, { type: 'triangle', slide: 700, vol: 0.11, delay: d + 0.14 }); } },
    xf: tm => ({ rot: 0.1 * hump(tm, 1.2) }),
    mouth: tm => 0.8 * (hump(tm, 0.35) + hump(tm - 0.45, 0.35)),
  },
  'hair:bunny': { // ушки подпрыгивают, сердце прыг-скок
    snd: () => { for (const d of [0, 0.45]) { tone(400, 0.12, { type: 'triangle', slide: 900, vol: 0.11, delay: d }); tone(300, 0.06, { vol: 0.12, delay: d + 0.38 }); } },
    tick: (tm, pr) => { if (at(tm, pr, 0.4) || at(tm, pr, 0.85)) puff(0, 1, 4, '#ffffff', 12); },
    xf: tm => { const j = hump(tm, 0.42) + hump(tm - 0.45, 0.42); return { dy: -0.28 * j, sy: 1 + 0.06 * j }; },
    mouth: tm => laugh(tm, 0, 0.9, 2),
  },
  'hair:afro': { // кудряшки пляшут, сердце танцует «бум-ча»
    snd: () => { for (const d of [0, 0.45]) { tone(110, 0.15, { vol: 0.22, delay: d }); tone(147, 0.12, { vol: 0.15, delay: d + 0.3 }); later(d + 0.22, () => whoosh(0.12, 0.08)); } tone(784, 0.3, { type: 'triangle', vol: 0.06, delay: 0.9 }); },
    tick: (tm, pr) => { if (at(tm, pr, 0.2)) notes(0.7, -0.8, 2); },
    xf: tm => ({ rot: 0.12 * Math.sin(tm * TAU * 2.2) * hump(tm, 1.6), dy: -0.05 * Math.abs(Math.sin(tm * TAU * 2.2)) * hump(tm, 1.6) }),
  },

  // ---------- СЕРЁЖКИ ----------
  'earrings:pearl': { // жемчужинки сияют, тихий хрустальный звон
    snd: () => { tone(2093, 0.6, { vol: 0.05 }); tone(3136, 0.5, { vol: 0.03, delay: 0.15 }); tone(2637, 0.6, { vol: 0.04, delay: 0.3 }); },
    go: () => { hs().swingV += 2; },
    tick: (tm, pr) => { if (at(tm, pr, 0.2)) both(s => sparks(s * 0.9, 0.35, 4, '#ffffff', 90)); },
    xf: tm => { const s = 1 + 0.03 * hump(tm, 1); return { sx: s, sy: s }; },
  },
  'earrings:studheart': { // гвоздики-сердечки бьются, из ушек вылетают сердечки
    snd: () => { for (const d of [0, 0.7]) { tone(330, 0.08, { vol: 0.18, delay: d }); tone(300, 0.1, { vol: 0.14, delay: d + 0.22 }); } tone(1568, 0.4, { vol: 0.04, delay: 0.35 }); },
    tick: (tm, pr) => { if (at(tm, pr, 0.05) || at(tm, pr, 0.75)) both(s => hearts(s * 0.9, 0.05, 2)); },
    xf: tm => { const s = 1 + 0.025 * (beat(tm) + beat(tm - 0.7)); return { sx: s, sy: s }; },
  },
  'earrings:studgem': { // камушки по очереди вспыхивают звёздочкой: «дзинь — дзинь»
    snd: () => { bell(2637, 0, 0.06); bell(3136, 0.25, 0.06); },
    tick: (tm, pr) => { if (at(tm, pr, 0.05)) sparks(-0.9, 0.05, 5, '#ffffff', 100); if (at(tm, pr, 0.3)) sparks(0.9, 0.05, 5, '#ffffff', 100); },
    xf: tm => ({ dy: -0.04 * hump(tm, 0.8) }),
  },
  'earrings:bow': { // бантики хлопают крылышками — шуршат
    snd: () => { sfx.rustle(); later(0.35, sfx.rustle); tone(1175, 0.3, { type: 'triangle', vol: 0.06, delay: 0.6 }); },
    xf: tm => ({ sx: 1 + 0.04 * wob(tm, 2, 2) }),
  },
  'earrings:hoop': { // колечки крутятся как обруч
    snd: () => { tone(300, 0.4, { type: 'triangle', slide: 600, vol: 0.07 }); tone(600, 0.4, { type: 'triangle', slide: 300, vol: 0.07, delay: 0.4 }); whoosh(0.8, 0.05); },
    xf: tm => ({ rot: 0.1 * Math.sin(tm * TAU * 2) * hump(tm, 1.5) }),
  },
  'earrings:cherry': { // вишенки подпрыгивают, «чпок-чпок»
    snd: () => { tone(380, 0.1, { slide: 1100, vol: 0.18 }); tone(500, 0.1, { slide: 1400, vol: 0.16, delay: 0.25 }); },
    go: () => { hs().swingV += 3; },
    xf: tm => ({ dy: -0.06 * (hump(tm, 0.2) + hump(tm - 0.25, 0.2)) }),
  },
  'earrings:drop': { // капельки дрожат и капают, «кап-кап»
    snd: () => { [0, 0.3, 0.6].forEach((d, i) => tone(800 + i * 150, 0.08, { slide: 1600 + i * 200, vol: 0.12, delay: d })); },
    tick: (tm, pr) => { for (const a of [0, 0.3, 0.6]) if (at(tm, pr, a + 0.01)) both(s => drops(s * 0.9, 0.5, 1)); },
  },
  'earrings:icecream': { // мороженое качается, сердце облизывается, «мм-ням»
    snd: () => { tone(300, 0.3, { type: 'triangle', slide: 350, vol: 0.1, attack: 0.05 }); tone(600, 0.15, { slide: 1200, vol: 0.08, delay: 0.4 }); tone(500, 0.12, { type: 'triangle', slide: 350, vol: 0.1, delay: 0.65 }); },
    go: () => { hs().swingV += 2; },
    mouth: tm => laugh(tm, 0.35, 1.0, 3),
  },
  'earrings:butterfly': { // бабочки вспархивают и возвращаются
    snd: () => { sfx.flutter(); later(0.35, sfx.flutter); seq([1568, 1760, 2093], 0.1, { vol: 0.05, delay: 0.7 }); },
    xf: tm => ({ dy: -0.06 * hump(tm, 1.3) }),
  },
  'earrings:bell': { // колокольчики звенят и раскачиваются
    snd: () => { bell(1568, 0); bell(1760, 0.25); bell(1568, 0.5); bell(2093, 0.75); },
    go: () => { hs().swingV += 9; },
    tick: (tm, pr) => { if (at(tm, pr, 0.5)) hs().swingV -= 8; if (at(tm, pr, 1.0)) hs().swingV += 6; },
    xf: tm => ({ rot: 0.1 * Math.sin(tm * TAU * 2) * hump(tm, 1.3) }),
  },
  'earrings:feather': { // пёрышки щекочут — сердце хихикает и ёжится
    snd: () => { whoosh(0.3, 0.08); sfx.giggle(1.15); later(0.5, () => sfx.giggle(1.3)); },
    xf: tm => ({ sx: 1 + 0.025 * Math.sin(tm * TAU * 2.5) * hump(tm, 1.3), rot: 0.05 * Math.sin(tm * TAU * 1.5) * hump(tm, 1.3) }),
    mouth: tm => laugh(tm, 0, 1.3, 4),
  },
  'earrings:star': { // звёздочки крутятся и мигают, «звёздочка-мелодия»
    snd: () => seq([1047, 1047, 1568, 1568, 1760, 1760, 1568], 0.14, { vol: 0.07, dur: 0.12 }),
    tick: (tm, pr) => { if (at(tm, pr, 0.5)) both(s => sparks(s * 0.9, 0.4, 5, '#ffe066', 120)); },
    xf: tm => ({ dy: -0.1 * hump(tm, 1) }),
  },

  // ---------- ОЖЕРЕЛЬЕ ----------
  'necklace:pearls': { // по жемчужинам бежит блеск
    snd: () => seq([1319, 1568, 1760, 2093, 2349, 2637], 0.08, { vol: 0.05, type: 'sine', dur: 0.4 }),
    xf: tm => ({ sy: 1 + 0.04 * hump(tm, 1.2) }),
  },
  'necklace:tone': { // бусины по очереди раздуваются — «пуп-пуп-пуп» вверх по гамме
    snd: () => { [523, 587, 659, 698, 784, 880, 988, 1047, 1175].forEach((f, i) => tone(f, 0.08, { slide: f * 1.5, vol: 0.09, delay: i * 0.08 })); },
    xf: tm => ({ sy: 1 + 0.03 * hump(tm, 1) }),
  },
  'necklace:heartchain': { // кулон-сердечко качается и сверкает, шкатулка играет, вылетает сердечко
    snd: () => seq([1319, 1568, 2093, 1568, 1319, 1047], 0.14, { vol: 0.05, type: 'sine', dur: 0.3 }),
    tick: (tm, pr) => { if (at(tm, pr, 0.4)) hearts(0, 0.68, 4); },
    xf: tm => ({ rot: 0.05 * Math.sin(tm * TAU * 1.5) * hump(tm, 1.4) }),
  },
  'necklace:gem': { // капелька дрожит и сверкает, «кап-дзинь»
    snd: () => { tone(900, 0.1, { slide: 1800, vol: 0.12 }); bell(2349, 0.3, 0.06); },
    tick: (tm, pr) => { if (at(tm, pr, 0.3)) sparks(0.05, 0.7, 6, '#ffffff', 120); },
    xf: tm => ({ dy: -0.03 * hump(tm, 0.6) }),
  },
  'necklace:ribbon': { // ленточка: бантик хлопает, сердце кокетливо поворачивается
    snd: () => { sfx.rustle(); tone(784, 0.25, { type: 'triangle', slide: 1047, vol: 0.07, delay: 0.3 }); tone(1047, 0.35, { type: 'triangle', vol: 0.06, delay: 0.55 }); },
    xf: tm => ({ rot: 0.1 * hump(tm, 1.2) }),
  },
  'necklace:beads': { // бусины подпрыгивают и звенят каскадом
    snd: () => { const f = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760, 2093, 2349, 2637]; f.forEach((x, i) => tone(x, 0.25, { type: 'triangle', vol: 0.07, delay: i * 0.07 })); },
    xf: tm => ({ dy: -0.03 * hump(tm, 1) }),
  },
  'necklace:flowers': { // нюхает цветочки: вдох — «ааах»
    snd: () => { whoosh(0.4, 0.06); tone(660, 0.6, { type: 'triangle', slide: 520, vol: 0.08, delay: 0.45 }); },
    tick: (tm, pr) => { if (at(tm, pr, 0.5)) hearts(0, 0.6, 5, '#ff9ccf'); },
    xf: tm => ({ sy: 1 + 0.08 * hump(tm, 0.5), sx: 1 + 0.05 * hump(tm - 0.5, 0.6) }),
    mouth: tm => 0.7 * hump(tm - 0.45, 0.6),
  },
  'necklace:locket': { // медальон качается, из него выпархивает сердечко, музыкальная шкатулка
    snd: () => seq([1568, 2093, 2349, 2637, 2349, 2093, 1568], 0.13, { vol: 0.05, type: 'sine', dur: 0.25 }),
    tick: (tm, pr) => { if (at(tm, pr, 0.3)) { const [x, y] = P(0, 0.95); addP({ kind: 'heart', x, y, vx: 0, vy: -90 * S, life: 1.2, size: 18 * S, color: '#ff3d7f', rot: 0, vr: 1, g: 0 }); } },
    xf: tm => ({ rot: 0.05 * Math.sin(tm * TAU * 1.5) * hump(tm, 1.4) }),
  },
  'necklace:bowtie': { // бабочка-галстук крутится пропеллером
    snd: () => { tone(400, 0.8, { type: 'triangle', slide: 1600, vol: 0.07 }); tone(1047, 0.15, { type: 'square', vol: 0.04, delay: 0.9 }); },
    xf: tm => ({ dy: -0.1 * hump(tm - 0.8, 0.4) }),
  },
  'necklace:scarf': { // шарфик развевается на ветру
    snd: () => { whoosh(1.3, 0.12); tone(300, 0.9, { type: 'triangle', slide: 450, vol: 0.04, attack: 0.3 }); },
    tick: (tm, pr) => { if (at(tm, pr, 0.3) || at(tm, pr, 0.8)) puff(-0.5, 0.8, 3, '#ffffff', 10); },
    xf: tm => ({ rot: 0.06 * Math.sin(tm * TAU * 1.5) * hump(tm, 1.6) }),
  },
  'necklace:key': { // ключик поворачивается: «щёлк-щёлк» — и волшебный перезвон
    snd: () => { tone(1200, 0.03, { type: 'square', vol: 0.06 }); tone(800, 0.04, { type: 'square', vol: 0.06, delay: 0.3 }); seq([1047, 1319, 1568, 2093], 0.07, { vol: 0.06, delay: 0.5 }); },
    tick: (tm, pr) => { if (at(tm, pr, 0.55)) sparks(0, 1.05, 10, '#ffe066', 170); },
  },
  'necklace:shells': { // ракушки раскрываются, шум моря
    snd: () => { whoosh(1.2, 0.1); [0.5, 0.62, 0.78].forEach((d, i) => tone(320 + i * 140, 0.08, { slide: 800 + i * 200, vol: 0.1, delay: d })); },
    tick: (tm, pr) => { if (at(tm, pr, 0.5)) drops(0, 0.85, 5, '#bfe6ff'); },
    xf: tm => ({ rot: 0.08 * Math.sin(tm * TAU * 0.9) * hump(tm, 1.7) }),
  },
  'necklace:candy': { // леденец закрутился, конфетки пляшут, «ням-ням»
    snd: () => { tone(400, 0.1, { type: 'triangle', slide: 600, vol: 0.1 }); tone(500, 0.12, { type: 'triangle', slide: 350, vol: 0.1, delay: 0.18 }); later(0.4, () => whoosh(0.12, 0.1)); tone(1760, 0.4, { vol: 0.05, delay: 0.6 }); },
    xf: tm => ({ sy: 1 + 0.04 * wob(tm, 2, 2) }),
    mouth: tm => laugh(tm, 0, 0.5, 4),
  },
};

const DUR = 1.8;
let prT = 0;

/** Есть ли своя реакция на этот вариант (для тестов) */
export const hasReaction = (id: string, k: string) => !!RX[id + ':' + k];

/** Запустить реакцию на деталь id (этап) = k (вариант). from: 'pick' — только что выбрали, 'tap' — тапнули по надетой */
export function react(id: string, k: string, from: 'pick' | 'tap') {
  const sp = RX[id + ':' + k];
  G.hs.act = { id, k, t: 0 }; prT = 0;
  if (!sp) { G.hs.sqT = 0; G.hs.mouth = 1; G.hs.swingV += 3; return; } // старый вариант из сохранения — общая реакция
  try { sp.snd(); } catch (e) { /* звук не обязателен */ }
  sp.go?.();
  if (from === 'tap') G.hs.swingV += 1.5;
}

export function updateReact(dt: number) {
  const a = G.hs.act; if (!a) return;
  const sp = RX[a.id + ':' + a.k];
  prT = a.t; a.t += dt;
  if (sp) {
    sp.tick?.(a.t, prT);
    if (sp.blink) G.hs.blink = Math.max(G.hs.blink, clamp01(sp.blink(a.t)));
    if (sp.mouth) G.hs.mouth = Math.max(G.hs.mouth, clamp01(sp.mouth(a.t)));
  }
  if (a.t > ((sp && sp.dur) || DUR)) G.hs.act = null;
}

/** Добавка к положению/форме всего сердца от текущей реакции (dy, rot — в пикселях/радианах; sx, sy — множители) */
export function reactXform(R: number): Xf {
  const a = G.hs.act; if (!a) return NONE;
  const sp = RX[a.id + ':' + a.k]; if (!sp || !sp.xf) return NONE;
  const m = sp.xf(a.t), f = clamp01((((sp.dur) || DUR) - a.t) / 0.3); // к концу плавно возвращаемся
  return { dy: (m.dy || 0) * R * f, rot: (m.rot || 0) * f, sx: 1 + ((m.sx ?? 1) - 1) * f, sy: 1 + ((m.sy ?? 1) - 1) * f };
}

// ---------------- куда тапнули ----------------
/** точка на нижней дуге ожерелья (как nq в heart.ts) */
const nq = (s: number) => { const u = 1 - s; return [u * u * -0.66 + s * s * 0.66, u * u * 0.33 + 2 * u * s * 0.82 + s * s * 0.33]; };
const near = (x: number, y: number, cx: number, cy: number, r: number) => (x - cx) ** 2 + (y - cy) ** 2 < r * r;

/** Какая надетая деталь под точкой (x, y — в долях R от центра сердца, y вниз), или null */
export function partAt(cfg: Record<string, any>, x: number, y: number): string | null {
  const ax = Math.abs(x);
  // носик: усы шире
  if (cfg.nose) {
    if (cfg.nose === 'mustache' ? ax < 0.28 && y > -0.03 && y < 0.2 : near(x, y, 0, 0.06, 0.14)) return 'nose';
  }
  // глаза и реснички: верхняя часть над глазом — реснички (брови), сам глаз — глаза
  if (ax > 0.1 && ax < 0.6) {
    const ex = 0.34 * Math.sign(x);
    if (cfg.lashes && y < -0.26 && y > -0.5 && Math.abs(x - ex) < 0.26) return 'lashes';
    if (cfg.eyes && near(x, y, ex, -0.12, cfg.eyes === 'sunglasses' ? 0.25 : 0.2)) return 'eyes';
  }
  if (cfg.cheeks && near(ax, y, 0.56, 0.1, 0.17)) return 'cheeks';
  // серёжки свисают с боков
  if (cfg.earrings && ax > 0.74 && ax < 1.12 && y > -0.02 && y < 0.55) return 'earrings';
  // ожерелье: дуга снизу и подвеска посередине
  if (cfg.necklace) {
    for (let i = 0; i <= 20; i++) { const [px, py] = nq(i / 20); if (near(x, y, px, py, 0.12)) return 'necklace'; }
    if (ax < 0.2 && y > 0.55 && y < 1.1) return 'necklace'; // медальон, ключик, леденец
    if (cfg.necklace === 'scarf' && x < -0.1 && x > -0.45 && y > 0.5 && y < 1.0) return 'necklace'; // хвост шарфа
  }
  // причёска: всё, что выше лба, а длинные волосы, хвостики и кудряшки — ещё и по бокам
  if (cfg.hair) {
    if (y < -0.5) return 'hair';
    if ((cfg.hair === 'long' || cfg.hair === 'afro') && ax > 0.92 && y < 0.85) return 'hair';
    if (cfg.hair === 'pigtails' && ax > 0.75 && y < -0.3) return 'hair';
  }
  return null;
}
