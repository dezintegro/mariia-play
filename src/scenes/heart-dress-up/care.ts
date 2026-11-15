// Уход за сердцем: покормить (еда), искупать (ванна), уложить спать (сон).
// Варианты — CARE_OPTS в careopts.ts; кнопки показывает общая панель вариантов (ui.ts).
//
// Еда: угощение летит из кнопки по дуге ко рту, сердце жуёт (3 «ням» с хрустом и крошками) и радуется;
//   «любимая еда дня» (по дате) — влюблённые глаза и особый звук; иногда — смешная гримаса и смех.
// Ванна: пена (шапки пузырьков, лопаются тапом), душ, резиновая уточка, мыльные пузыри, губка, полотенце.
// Сон: луна (уложить/разбудить), мишка, ночник со звёздочками на потолке, одеяльце, шкатулка с колыбельной,
//   солнышко (потягивается, зевает, «доброе утро»).
import { AC, soundOn, tone, whoosh } from '../../core/audio';
import { H, S, TAU, W, clamp, ctx, pick, rand, t } from '../../core/canvas';
import { circle, ell, starPath } from '../../core/draw';
import { addP, burst } from '../../core/particles';
import { clamp01, ease } from '../../core/tween';
import { CARE_OPTS } from './careopts';
import { Live } from './heart';
import { Xf } from './reactions';
import { PENTA, sfx } from './sounds';
import { G } from './state';
import { apple, bubble, moon, smallHeart, sparkleStar, sun } from './things';

// ---------------- СОСТОЯНИЕ ----------------
type Clump = { fx: number; fy: number; r: number; t: number; sub: [number, number, number][] };
type Bub = { x: number; y: number; r: number; vy: number; ph: number; t: number };
type Star = { u: number; v: number; s: number; tw: number; ph: number };

/** День → любимая еда (каждый день другая: шаг 5 взаимно прост с числом угощений) */
function favOfDay() {
  const d = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000), F = CARE_OPTS.food;
  return F[((d * 5) % F.length + F.length) % F.length];
}

export const care = {
  fav: favOfDay(), favFound: false, eaten: 0,
  /** угощения в полёте к рту */
  fly: [] as { k: string; x0: number; y0: number; t: number }[],
  /** сейчас жуёт: t — время с момента, как еда во рту */
  eat: null as null | { k: string; t: number; fav: boolean; grim: boolean; bites: number; done: boolean },
  foamOn: false, foam: [] as Clump[],
  shower: 0, drops: [] as { x: number; y: number; vy: number; stop: number }[], dropT: 0, splashT: 0,
  duck: null as null | { t: number; jump: number },
  bubbles: [] as Bub[],
  sponge: null as null | { t: number; e: number },
  towel: null as null | { t: number },
  shine: 0,
  sleep: false, sleepT: 0, night: 0, stir: 9, zT: 0,
  /** просыпается: время с начала потягушек (9 — не идёт) */
  wake: 9, morning: 9, sunLaugh: 0,
  teddy: null as null | { t: number; hug: number },
  lamp: null as null | { t: number; hue: number; stars: Star[] },
  blanket: null as null | { t: number; tuck: number },
  box: null as null | { t: number; spin: number; boost: number },
  /** последняя добавка к форме сердца (чтобы рисовать пену/еду там, где сердце сейчас) */
  dy: 0,
};
const C = care;
// для автотестов (main.ts отдаёт в __game только G, UI, env)
(window as any).__care = care;

const NONE: Xf = { dy: 0, rot: 0, sx: 1, sy: 1 };
const R = () => G.heart.R;
/** Точка сердца в долях R → экран */
const hp = (fx: number, fy: number): [number, number] => [G.heart.x + fx * R(), G.heart.y + fy * R() + C.dy];
const mouthPos = () => hp(0, 0.24);
const near = (x: number, y: number, px: number, py: number, r: number) => Math.hypot(x - px, y - py) < Math.max(r, 32);
/** «Пол», на котором сидят мишка, уточка, шкатулка, ночник — на уровне кончика сердца */
const floorY = () => G.heart.y + 1.02 * R();
/** x сбоку от сердца, но не под кнопками палочки и хлопушки и не за краем области сердца */
function sideX(dir: number, k: number, half: number) {
  const A = G.HR, z = G.zones;
  const x0 = Math.max(A.x, z.wand ? z.wand.x + z.wand.r * 1.2 : A.x), x1 = Math.min(A.x + A.w, z.party ? z.party.x - z.party.r * 1.2 : A.x + A.w);
  return clamp(G.heart.x + dir * k * R(), x0 + half, Math.max(x0 + half, x1 - half));
}
const duckS = () => Math.max(34, R() * 0.24);
const duckPos = (): [number, number] => [sideX(1, 0.85, duckS() * 0.7), floorY() - (C.duck && C.duck.jump < 0.5 ? Math.sin(C.duck.jump / 0.5 * Math.PI) * duckS() * 0.8 : 0)];
const teddyS = () => Math.max(36, R() * 0.26);
const teddyPos = (): [number, number] => [sideX(1, 0.8, teddyS() * 0.9), floorY()];
const boxS = () => Math.max(30, R() * 0.2);
const boxPos = (): [number, number] => [sideX(-1, 0.62, boxS() * 0.8), floorY()];
const lampS = () => Math.max(30, R() * 0.15);
/** ночник висит на шнурке слева вверху, у левого «плеча» сердца */
const lampPos = (): [number, number] => { const s = lampS(); return [Math.max(G.HR.x + s * 1.4, G.heart.x - 1.0 * R()), Math.max(G.HR.y + s * 2.6, G.heart.y - 0.72 * R())]; };
const showerPos = (): [number, number] => [G.heart.x + 0.05 * R(), Math.max(G.HR.y + 0.12 * R(), G.heart.y - 1.32 * R())];
/** Солнышко «доброго утра» выглядывает справа вверху (под кнопкой звука, если она в области сердца) */
function sunPos(): [number, number] {
  const r = sunR(), k = ease.outBack(clamp01(C.morning / 0.8)), A = G.HR, sd = G.zones.sound;
  const below = sd && sd.y - sd.r < A.y + r * 3.5 && sd.x > A.x + A.w * 0.5 ? sd.y + sd.r + r * 0.3 : A.y;
  return [A.x + A.w - r * 1.9, Math.max(A.y, below) + r * 1.8 + (1 - k) * r * 2];
}
const sunR = () => Math.max(32, R() * 0.2);
const sleeping = () => C.sleep;

// ---------------- ЗВУКИ ----------------
const snd = {
  /** хрум (печенье, морковка, яблоко) или чавк (мягкое) */
  chomp(crunchy: boolean) {
    if (crunchy) { whoosh(0.09, 0.14); tone(170, 0.06, { type: 'square', vol: 0.05 }); tone(rand(1900, 2500), 0.03, { type: 'square', vol: 0.025, delay: 0.03 }); tone(rand(1400, 1800), 0.03, { type: 'square', vol: 0.02, delay: 0.06 }); }
    else { tone(240, 0.1, { slide: 120, vol: 0.15 }); tone(170, 0.08, { type: 'triangle', slide: 90, vol: 0.1, delay: 0.06 }); }
  },
  /** «ммм!» */
  yum() { tone(392, 0.22, { type: 'triangle', vol: 0.1, slide: 523 }); tone(523, 0.35, { type: 'triangle', vol: 0.1, delay: 0.22, slide: 494 }); },
  /** любимая еда: радостный перелив и чмок */
  fav() { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.09, delay: i * 0.07 })); tone(1568, 0.9, { vol: 0.06, delay: 0.4 }); sfx.kiss(); },
  /** смешное «бррр» */
  brr() { for (let i = 0; i < 9; i++) tone(150 + (i % 2) * 50, 0.05, { type: 'sawtooth', vol: 0.035, delay: i * 0.045 }); tone(700, 0.3, { type: 'triangle', slide: 350, vol: 0.08 }); },
  fly() { whoosh(0.35, 0.06); tone(500, 0.3, { type: 'triangle', slide: 1100, vol: 0.06 }); },
  rub() { for (let i = 0; i < 4; i++) tone(rand(1300, 1900), 0.07, { type: 'triangle', slide: rand(900, 2200), vol: 0.04, delay: i * 0.09 }); },
  drip() { tone(rand(1200, 1700), 0.06, { slide: rand(500, 800), vol: 0.04 }); },
  foam() { for (let i = 0; i < 6; i++) tone(rand(500, 1100), 0.08, { slide: rand(900, 1600), vol: 0.06, delay: i * 0.06 }); },
  yawn() { tone(330, 0.9, { type: 'triangle', slide: 200, vol: 0.08, attack: 0.15 }); tone(495, 0.7, { vol: 0.03, slide: 300, attack: 0.15 }); },
  /** «доброе утро»: птичка и бодрые три ноты */
  morning() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.1, delay: 0.1 + i * 0.12 })); for (let i = 0; i < 3; i++) tone(2600, 0.06, { slide: 3400, vol: 0.03, delay: 0.7 + i * 0.1 }); },
  /** сонное бормотание */
  mumble() { tone(260, 0.3, { type: 'triangle', slide: 300, vol: 0.06, attack: 0.08 }); tone(300, 0.35, { type: 'triangle', slide: 230, vol: 0.05, delay: 0.32, attack: 0.08 }); },
  sleepy() { [784, 659, 523, 392].forEach((f, i) => tone(f, 0.6, { vol: 0.06, delay: i * 0.16 })); },
  hug() { tone(392, 0.25, { type: 'triangle', vol: 0.08 }); tone(523, 0.4, { type: 'triangle', vol: 0.08, delay: 0.18 }); sfx.kiss(); },
  click() { tone(1500, 0.03, { type: 'square', vol: 0.04 }); tone(880, 0.3, { vol: 0.06, delay: 0.05 }); },
  twinkle() { const f = pick(PENTA) * 2; tone(f, 0.6, { vol: 0.05 }); tone(f * 1.5, 0.4, { vol: 0.025, delay: 0.08 }); },
};
const CRUNCHY: Record<string, boolean> = { cookie: true, carrot: true, apple: true, candy: true, watermelon: true };

// ---------------- КОЛЫБЕЛЬНАЯ ----------------
// Своя мелодия на пентатонике, на 3 счёта; полутоны от до 5-й октавы, null — пауза
const LULL: (number | null)[] = [7, 4, 2, 4, null, 0, 2, 4, 7, 9, null, 7, 4, 2, 0, 2, null, null, 7, 9, 12, 9, null, 7, 4, 7, 4, 2, null, 0, 2, 4, 2, 0, null, null];
const LBASS = [0, -5, -3, -5];
let li = 0, lNext = 0;
const LSTEP = 0.42;
function updLullaby(on: boolean, bells: boolean) {
  if (!AC || !soundOn || !on) { lNext = 0; li = 0; return; }
  const now = AC.currentTime;
  if (lNext < now || lNext > now + 5) lNext = now + 0.2;
  while (lNext < now + 0.4) {
    const n = LULL[li];
    if (n !== null) {
      const f = 523.25 * Math.pow(2, n / 12);
      tone(f, 1.3, { vol: 0.055, at: lNext, attack: 0.02 });
      if (bells) tone(f * 2, 0.6, { type: 'triangle', vol: 0.018, at: lNext });
    }
    if (li % 6 === 0) tone(130.8 * Math.pow(2, LBASS[(li / 6) % 4] / 12), LSTEP * 5.5, { vol: 0.06, at: lNext, attack: 0.1 });
    lNext += LSTEP; li = (li + 1) % LULL.length;
  }
}

// ---------------- РИСОВАЛКИ ----------------
const INK = '#45182e';
/** Угощение с центром (0,0), «радиус» s; bites — сколько откушено (0..3) */
function food(k: string, s: number, bites = 0) {
  ctx.save();
  // откусы: каждый следующий — ещё одна круглая выемка (клипы пересекаются)
  const B: [number, number, number][] = [[0.62, -0.5, 0.36], [0.72, 0.25, 0.34], [-0.1, -0.78, 0.34]];
  for (let i = 0; i < Math.min(3, bites); i++) {
    const [bx, by, br] = B[i];
    // «зубчики» откуса: три кружка, каждый — отдельный клип (наложенные кружки в одном evenodd-пути взаимно гасятся)
    for (let j = 0; j < 3; j++) {
      const a = Math.atan2(by, bx) + (j - 1) * 1.1, x = (bx - Math.cos(a) * br * 0.35) * s, y = (by - Math.sin(a) * br * 0.35) * s;
      ctx.beginPath(); ctx.rect(-3 * s, -3 * s, 6 * s, 6 * s); ctx.moveTo(x + br * 0.55 * s, y); ctx.arc(x, y, br * 0.55 * s, 0, TAU); ctx.clip('evenodd');
    }
  }
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (k === 'strawberry') {
    ctx.fillStyle = '#ff3b5c'; ctx.beginPath(); ctx.moveTo(0, 0.88 * s);
    ctx.bezierCurveTo(-1.0 * s, 0.25 * s, -0.85 * s, -0.7 * s, 0, -0.52 * s); ctx.bezierCurveTo(0.85 * s, -0.7 * s, 1.0 * s, 0.25 * s, 0, 0.88 * s); ctx.fill();
    ctx.strokeStyle = '#c0143a'; ctx.lineWidth = 0.06 * s; ctx.stroke();
    ctx.fillStyle = '#ffe27a'; for (const [x, y] of [[-0.4, -0.25], [0, -0.3], [0.4, -0.25], [-0.5, 0.1], [-0.15, 0.05], [0.2, 0.05], [0.52, 0.1], [-0.25, 0.4], [0.1, 0.4], [0, 0.65]]) ell(x * s, y * s, 0.045 * s, 0.07 * s);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ell(-0.45 * s, -0.3 * s, 0.1 * s, 0.18 * s, 0.5);
    ctx.fillStyle = '#3fae49'; for (let i = 0; i < 5; i++) { ctx.save(); ctx.translate(0, -0.55 * s); ctx.rotate(-Math.PI / 2 + (i - 2) * 0.6); ell(0.22 * s, 0, 0.24 * s, 0.09 * s); ctx.restore(); }
    ctx.strokeStyle = '#2d8a36'; ctx.lineWidth = 0.08 * s; ctx.beginPath(); ctx.moveTo(0, -0.6 * s); ctx.lineTo(0.05 * s, -0.85 * s); ctx.stroke();
  } else if (k === 'cupcake') {
    ctx.fillStyle = '#7fc8ff'; ctx.beginPath(); ctx.moveTo(-0.6 * s, 0.05 * s); ctx.lineTo(0.6 * s, 0.05 * s); ctx.lineTo(0.42 * s, 0.85 * s); ctx.lineTo(-0.42 * s, 0.85 * s); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#3d8fd1'; ctx.lineWidth = 0.05 * s; ctx.stroke();
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 0.22 * s, 0.1 * s); ctx.lineTo(i * 0.16 * s, 0.8 * s); ctx.stroke(); }
    ctx.fillStyle = '#ffa3c8'; ell(0, -0.02 * s, 0.7 * s, 0.24 * s); ell(0, -0.27 * s, 0.54 * s, 0.22 * s); ell(0, -0.5 * s, 0.34 * s, 0.17 * s);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ell(-0.3 * s, -0.3 * s, 0.14 * s, 0.06 * s, -0.3);
    ['#fff36b', '#7be0ff', '#fff', '#9cf08a'].forEach((c, i) => { ctx.fillStyle = c; ctx.save(); ctx.translate((-0.4 + i * 0.27) * s, (-0.12 - (i % 2) * 0.22) * s); ctx.rotate(i); ctx.fillRect(-0.06 * s, -0.02 * s, 0.12 * s, 0.04 * s); ctx.restore(); });
    ctx.fillStyle = '#ff2f4f'; circle(0, -0.7 * s, 0.14 * s); ctx.fillStyle = 'rgba(255,255,255,0.7)'; circle(-0.04 * s, -0.74 * s, 0.04 * s);
    ctx.strokeStyle = '#3f8a2a'; ctx.lineWidth = 0.04 * s; ctx.beginPath(); ctx.moveTo(0, -0.82 * s); ctx.quadraticCurveTo(0.05 * s, -0.95 * s, 0.18 * s, -0.98 * s); ctx.stroke();
  } else if (k === 'icecream') {
    ctx.fillStyle = '#f5c27a'; ctx.beginPath(); ctx.moveTo(-0.42 * s, 0.05 * s); ctx.lineTo(0.42 * s, 0.05 * s); ctx.lineTo(0, 1.0 * s); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.clip(); ctx.strokeStyle = '#cf9445'; ctx.lineWidth = 0.04 * s;
    for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i * 0.2 * s - 0.5 * s, 0); ctx.lineTo(i * 0.2 * s + 0.5 * s, 1.0 * s); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i * 0.2 * s + 0.5 * s, 0); ctx.lineTo(i * 0.2 * s - 0.5 * s, 1.0 * s); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = '#9fe8c8'; circle(0, -0.08 * s, 0.44 * s); ell(-0.3 * s, 0.1 * s, 0.14 * s, 0.12 * s); ell(0.25 * s, 0.13 * s, 0.1 * s, 0.14 * s);
    ctx.fillStyle = '#ffaccd'; circle(0, -0.52 * s, 0.36 * s); ell(0.2 * s, -0.3 * s, 0.1 * s, 0.12 * s);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ell(-0.15 * s, -0.65 * s, 0.1 * s, 0.06 * s, -0.4); ell(-0.2 * s, -0.2 * s, 0.12 * s, 0.06 * s, -0.4);
    ctx.fillStyle = '#ff2f4f'; circle(0.05 * s, -0.9 * s, 0.12 * s);
  } else if (k === 'cookie') {
    ctx.fillStyle = '#dca25a'; for (let i = 0; i < 12; i++) { const a = i * TAU / 12; circle(Math.cos(a) * 0.7 * s, Math.sin(a) * 0.7 * s, 0.17 * s); } circle(0, 0, 0.75 * s);
    ctx.fillStyle = '#ebbd78'; circle(-0.1 * s, -0.1 * s, 0.55 * s);
    ctx.fillStyle = '#5a3218'; for (const [x, y, r] of [[-0.35, -0.3, 0.11], [0.25, -0.4, 0.09], [0.4, 0.15, 0.12], [-0.1, 0.1, 0.1], [-0.4, 0.35, 0.09], [0.1, 0.45, 0.1], [0.05, -0.1, 0.07]]) ell(x * s, y * s, r * s, r * 0.8 * s, x);
  } else if (k === 'watermelon') {
    ctx.save(); ctx.translate(0, -0.3 * s);
    ctx.fillStyle = '#3fae49'; ctx.beginPath(); ctx.moveTo(-0.98 * s, 0); ctx.arc(0, 0, 0.98 * s, 0, Math.PI); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d9f7c4'; ctx.beginPath(); ctx.moveTo(-0.86 * s, 0); ctx.arc(0, 0, 0.86 * s, 0, Math.PI); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff4d6a'; ctx.beginPath(); ctx.moveTo(-0.78 * s, 0); ctx.arc(0, 0, 0.78 * s, 0, Math.PI); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2b1420'; for (const [x, y] of [[-0.45, 0.2], [0, 0.25], [0.45, 0.2], [-0.25, 0.45], [0.25, 0.45], [0, 0.6]]) ell(x * s, y * s, 0.045 * s, 0.08 * s);
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ell(-0.4 * s, 0.08 * s, 0.2 * s, 0.05 * s);
    ctx.restore();
  } else if (k === 'candy') {
    ctx.fillStyle = '#ffb3d6'; ctx.strokeStyle = '#e05a9a'; ctx.lineWidth = 0.05 * s;
    for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(d * 0.35 * s, 0); ctx.lineTo(d * 0.95 * s, -0.42 * s); ctx.quadraticCurveTo(d * 0.8 * s, 0, d * 0.95 * s, 0.42 * s); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = '#fff'; circle(0, 0, 0.48 * s); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 0.46 * s, 0, TAU); ctx.clip(); ctx.strokeStyle = '#ff3f7a'; ctx.lineWidth = 0.12 * s;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); for (let a = 0; a < 3.2; a += 0.2) { const r = a * 0.16 * s; ctx.lineTo(Math.cos(a + i * Math.PI / 2) * r, Math.sin(a + i * Math.PI / 2) * r); } ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ell(-0.18 * s, -0.22 * s, 0.1 * s, 0.06 * s, -0.5);
  } else if (k === 'apple') {
    apple(0, 0.12 * s, 0.68 * s);
  } else if (k === 'carrot') {
    ctx.rotate(-0.6);
    ctx.fillStyle = '#4fbf48'; for (const a of [-0.45, 0, 0.45]) { ctx.save(); ctx.translate(0, -0.6 * s); ctx.rotate(a); ell(0, -0.25 * s, 0.09 * s, 0.28 * s); ctx.restore(); }
    ctx.fillStyle = '#ff8a1f'; ctx.beginPath(); ctx.moveTo(-0.26 * s, -0.6 * s); ctx.quadraticCurveTo(0, -0.72 * s, 0.26 * s, -0.6 * s); ctx.quadraticCurveTo(0.2 * s, 0.3 * s, 0, 0.95 * s); ctx.quadraticCurveTo(-0.2 * s, 0.3 * s, -0.26 * s, -0.6 * s); ctx.fill();
    ctx.strokeStyle = '#d0620a'; ctx.lineWidth = 0.04 * s; for (const [y, d] of [[-0.35, 1], [-0.05, -1], [0.25, 1], [0.5, -1]]) { ctx.beginPath(); ctx.moveTo(d * 0.18 * s * (1 - y * 0.4), y * s); ctx.lineTo(d * 0.04 * s, (y + 0.05) * s); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ell(-0.1 * s, -0.3 * s, 0.05 * s, 0.2 * s);
  } else if (k === 'donut') {
    ctx.fillStyle = '#e5ad62'; ctx.beginPath(); ctx.arc(0, 0, 0.82 * s, 0, TAU); ctx.moveTo(0.28 * s, 0); ctx.arc(0, 0, 0.28 * s, 0, TAU, true); ctx.fill();
    ctx.fillStyle = '#ff8fc0'; ctx.beginPath();
    for (let i = 0; i <= 24; i++) { const a = i * TAU / 24, r = (0.7 + Math.sin(i * 2.3) * 0.06) * s; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.moveTo(0.36 * s, 0); ctx.arc(0, 0, 0.36 * s, 0, TAU, true); ctx.fill();
    ['#fff36b', '#7be0ff', '#fff', '#9cf08a', '#c49bff'].forEach((c, i) => { for (let j = 0; j < 2; j++) { const a = i * 1.3 + j * 3.1, r = 0.53 * s; ctx.fillStyle = c; ctx.save(); ctx.translate(Math.cos(a) * r, Math.sin(a) * r); ctx.rotate(a * 2); ctx.fillRect(-0.07 * s, -0.025 * s, 0.14 * s, 0.05 * s); ctx.restore(); } });
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ell(-0.4 * s, -0.42 * s, 0.14 * s, 0.06 * s, -0.7);
  }
  ctx.restore();
}
const FOOD_COL: Record<string, string[]> = {
  strawberry: ['#ff3b5c', '#ffe27a'], cupcake: ['#ffa3c8', '#7fc8ff'], icecream: ['#9fe8c8', '#ffaccd'], cookie: ['#dca25a', '#5a3218'],
  watermelon: ['#ff4d6a', '#3fae49'], candy: ['#ff3f7a', '#fff'], apple: ['#ff3b4f', '#fff3c4'], carrot: ['#ff8a1f', '#4fbf48'], donut: ['#ff8fc0', '#e5ad62'],
};

/** Резиновая уточка: (x, y) — низ, s — размер (высота ≈ 1.25s) */
function rubberDuck(x: number, y: number, s: number, sq = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(1 + sq * 0.15, 1 - sq * 0.15); ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(120,200,255,0.45)'; ell(0, -0.02 * s, 0.75 * s, 0.1 * s);
  ctx.fillStyle = '#ffd93b'; ctx.strokeStyle = '#e0a800'; ctx.lineWidth = 0.05 * s;
  ctx.beginPath(); ctx.moveTo(-0.55 * s, -0.4 * s); ctx.quadraticCurveTo(-0.8 * s, -0.75 * s, -0.68 * s, -0.8 * s); ctx.quadraticCurveTo(-0.45 * s, -0.62 * s, -0.3 * s, -0.6 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  ell(0, -0.32 * s, 0.66 * s, 0.32 * s); ctx.stroke();
  circle(0.22 * s, -0.86 * s, 0.33 * s); ctx.stroke();
  ctx.fillStyle = '#ffc61a'; ell(-0.12 * s, -0.36 * s, 0.3 * s, 0.15 * s, -0.25);
  ctx.fillStyle = '#ff8a1f'; ctx.strokeStyle = '#d0620a'; ctx.lineWidth = 0.03 * s; ell(0.6 * s, -0.8 * s, 0.2 * s, 0.08 * s); ctx.stroke(); ell(0.56 * s, -0.72 * s, 0.15 * s, 0.05 * s); ctx.stroke();
  ctx.fillStyle = INK; ell(0.3 * s, -0.95 * s, 0.06 * s, 0.075 * s); ctx.fillStyle = '#fff'; circle(0.32 * s, -0.98 * s, 0.025 * s);
  ctx.fillStyle = 'rgba(255,110,140,0.45)'; ell(0.2 * s, -0.76 * s, 0.08 * s, 0.05 * s);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ell(-0.3 * s, -0.48 * s, 0.14 * s, 0.05 * s, -0.3); ell(0.08 * s, -1.06 * s, 0.08 * s, 0.04 * s, -0.4);
  ctx.restore();
}
/** Мишка сидит: (x, y) — низ, s — размер головы; sleep — глазки закрыты; sq — сжат в объятиях */
function teddy(x: number, y: number, s: number, sleep = false, sq = 0, wave = 0) {
  const B = '#c68a55', D = '#8a5a32', L = '#f2d2a8';
  ctx.save(); ctx.translate(x, y); ctx.scale(1 + sq * 0.08, 1 - sq * 0.08); ctx.lineJoin = 'round';
  ctx.fillStyle = B; ctx.strokeStyle = D; ctx.lineWidth = 0.06 * s;
  ell(0, -0.75 * s, 0.68 * s, 0.75 * s); ctx.stroke(); // туловище
  ctx.fillStyle = L; ell(0, -0.68 * s, 0.4 * s, 0.48 * s);
  ctx.fillStyle = B; for (const d of [-1, 1]) { ell(d * 0.42 * s, -0.16 * s, 0.3 * s, 0.22 * s); ctx.stroke(); ctx.fillStyle = L; ell(d * 0.48 * s, -0.16 * s, 0.14 * s, 0.13 * s); ctx.fillStyle = B; } // лапки
  for (const d of [-1, 1]) { ctx.save(); ctx.translate(d * 0.58 * s, -1.0 * s); ctx.rotate(d * (0.5 + (d > 0 ? wave : 0) * Math.sin(t * 12) * 0.4)); ell(0, 0.28 * s, 0.17 * s, 0.34 * s); ctx.stroke(); ctx.restore(); } // ручки
  const hy = -1.62 * s;
  for (const d of [-1, 1]) { ctx.fillStyle = B; circle(d * 0.55 * s, hy - 0.55 * s, 0.24 * s); ctx.stroke(); ctx.fillStyle = L; circle(d * 0.55 * s, hy - 0.55 * s, 0.12 * s); }
  ctx.fillStyle = B; circle(0, hy, 0.72 * s); ctx.stroke();
  ctx.fillStyle = L; ell(0, hy + 0.25 * s, 0.32 * s, 0.24 * s);
  ctx.fillStyle = INK; ell(0, hy + 0.13 * s, 0.11 * s, 0.08 * s);
  ctx.strokeStyle = INK; ctx.lineWidth = 0.05 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, hy + 0.2 * s); ctx.lineTo(0, hy + 0.3 * s); ctx.arc(-0.09 * s, hy + 0.3 * s, 0.09 * s, 0, Math.PI * 0.8); ctx.moveTo(0, hy + 0.3 * s); ctx.arc(0.09 * s, hy + 0.3 * s, 0.09 * s, Math.PI, Math.PI * 0.2, true); ctx.stroke();
  for (const d of [-1, 1]) {
    if (sleep) { ctx.beginPath(); ctx.arc(d * 0.28 * s, hy - 0.12 * s, 0.09 * s, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
    else { ctx.fillStyle = INK; circle(d * 0.28 * s, hy - 0.12 * s, 0.08 * s); ctx.fillStyle = '#fff'; circle(d * 0.28 * s + 0.03 * s, hy - 0.15 * s, 0.03 * s); }
  }
  ctx.fillStyle = 'rgba(255,110,140,0.4)'; ell(-0.45 * s, hy + 0.15 * s, 0.11 * s, 0.07 * s); ell(0.45 * s, hy + 0.15 * s, 0.11 * s, 0.07 * s);
  smallHeart(-0.18 * s, -0.75 * s, 0.16 * s, '#ff6f9f', -0.2); // заплатка-сердечко
  ctx.restore();
}
const LAMP_HUES = [['#ffd36b', '#ff9a3d'], ['#ff9ed2', '#e0569c'], ['#9fdcff', '#4a9df0'], ['#c9a7ff', '#8a5ae0'], ['#a8f0a0', '#4fbf48']];
/** Ночник — подвесной фонарик-шарик со звёздочкой: (x, y) — центр шарика, s — радиус; шнурок до верха (top) */
function lamp(x: number, y: number, s: number, hue: number, on: boolean, top = y - 3 * s) {
  const [c0, c1] = LAMP_HUES[hue % LAMP_HUES.length];
  ctx.save();
  ctx.strokeStyle = '#b9a2c9'; ctx.lineWidth = Math.max(1.5, 0.06 * s); ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, y - 0.9 * s); ctx.stroke();
  ctx.translate(x, y + Math.sin(t * 1.3) * 0.04 * s); ctx.rotate(Math.sin(t * 1.1) * 0.06);
  if (on) { const g = ctx.createRadialGradient(0, 0, 0.3 * s, 0, 0, 2 * s); g.addColorStop(0, c0 + 'aa'); g.addColorStop(1, c0 + '00'); ctx.fillStyle = g; circle(0, 0, 2 * s); }
  ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#d9a400'; ctx.lineWidth = 0.05 * s;
  ctx.beginPath(); ctx.moveTo(-0.32 * s, -0.78 * s); ctx.lineTo(0.32 * s, -0.78 * s); ctx.lineTo(0.22 * s, -1.0 * s); ctx.lineTo(-0.22 * s, -1.0 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  const g2 = ctx.createRadialGradient(-0.25 * s, -0.3 * s, 0.05 * s, 0, 0, s); g2.addColorStop(0, on ? '#fffbe8' : c0); g2.addColorStop(0.55, c0); g2.addColorStop(1, c1);
  ctx.fillStyle = g2; circle(0, 0, 0.85 * s);
  ctx.fillStyle = '#ffffff'; ctx.save(); ctx.rotate(-0.1); starPath(5, 0.42 * s, 0.19 * s); ctx.fill(); ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ell(-0.45 * s, -0.4 * s, 0.14 * s, 0.08 * s, -0.7);
  ctx.fillStyle = '#ffd23f'; ell(0, 0.85 * s, 0.2 * s, 0.09 * s);
  ctx.restore();
}
/** Нотка ♪ рисунком (не текстом) */
function note(x: number, y: number, s: number, col = '#ff7aa8') {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 0.16 * s; ctx.lineCap = 'round';
  ell(0, 0, 0.32 * s, 0.24 * s, -0.4); ctx.beginPath(); ctx.moveTo(0.28 * s, -0.08 * s); ctx.lineTo(0.28 * s, -1.0 * s); ctx.quadraticCurveTo(0.55 * s, -0.75 * s, 0.7 * s, -0.55 * s); ctx.stroke();
  ctx.restore();
}
/** Музыкальная шкатулка: (x, y) — низ, s — размер; spin — фаза танца сердечка на крышке */
function musicBox(x: number, y: number, s: number, spin: number, open = 1) {
  ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round';
  // крышка откинута назад
  ctx.save(); ctx.translate(0, -0.8 * s); ctx.rotate(-1.2 * open);
  ctx.fillStyle = '#ff9ec7'; ctx.strokeStyle = '#d0558f'; ctx.lineWidth = 0.05 * s; ctx.beginPath(); ctx.roundRect(-0.85 * s, -0.16 * s, 0.85 * s * 2, 0.18 * s, 0.06 * s); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#ff9ec7'; ctx.strokeStyle = '#d0558f'; ctx.lineWidth = 0.05 * s; ctx.beginPath(); ctx.roundRect(-0.85 * s, -0.8 * s, 1.7 * s, 0.8 * s, 0.1 * s); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffd23f'; ctx.fillRect(-0.85 * s, -0.48 * s, 1.7 * s, 0.1 * s);
  smallHeart(0, -0.25 * s, 0.16 * s, '#fff');
  // ручка-завод сбоку
  ctx.save(); ctx.translate(0.9 * s, -0.45 * s); ctx.rotate(spin * 0.5); ctx.strokeStyle = '#d9a400'; ctx.lineWidth = 0.08 * s; ctx.beginPath(); ctx.moveTo(-0.15 * s, 0); ctx.lineTo(0.15 * s, 0); ctx.stroke(); ctx.fillStyle = '#ffd23f'; circle(0.15 * s, 0, 0.07 * s); ctx.restore();
  // танцующее сердечко на подставке
  ctx.strokeStyle = '#d9a400'; ctx.lineWidth = 0.05 * s; ctx.beginPath(); ctx.moveTo(0, -0.8 * s); ctx.lineTo(0, -1.05 * s); ctx.stroke();
  ctx.save(); ctx.translate(0, -1.3 * s); ctx.scale(Math.max(0.15, Math.abs(Math.cos(spin))), 1); smallHeart(0, 0, 0.32 * s, Math.cos(spin) > 0 ? '#ff4f8a' : '#ff8fb5'); ctx.restore();
  ctx.restore();
}
/** Одеяльце поверх низа сердца (в координатах сердца: центр (0,0), радиус Rr): «чаша» по форме низа сердца */
function blanket(Rr: number, up: number, tuck: number) {
  const top = (0.42 + (1 - up) * 0.7) * Rr - tuck * 0.03 * Rr + Math.sin(t * 1.7) * 0.012 * Rr, bot = 1.1 * Rr, w = 1.04 * Rr;
  ctx.save(); ctx.globalAlpha *= clamp01(up * 2); ctx.lineJoin = 'round';
  const shape = () => {
    ctx.beginPath(); ctx.moveTo(-w, top);
    for (let i = 1; i <= 8; i++) ctx.lineTo(-w + i * w / 4, top + Math.sin(i * 1.7 + t * 0.8) * 0.015 * Rr);
    ctx.bezierCurveTo(w * 1.02, top + 0.42 * Rr, 0.5 * Rr, bot - 0.02 * Rr, 0, bot);
    ctx.bezierCurveTo(-0.5 * Rr, bot - 0.02 * Rr, -w * 1.02, top + 0.42 * Rr, -w, top);
    ctx.closePath();
  };
  ctx.fillStyle = 'rgba(40,60,120,0.18)'; ctx.save(); ctx.translate(0, 0.03 * Rr); shape(); ctx.fill(); ctx.restore();
  shape(); ctx.fillStyle = '#9fd4ff'; ctx.fill();
  ctx.save(); ctx.clip();
  // лоскутки в клетку и сердечки
  const cs = 0.26 * Rr;
  for (let j = 0; j < 4; j++) for (let i = -5; i <= 5; i++) {
    if ((i + j + 20) % 2 === 0) { ctx.fillStyle = '#c4e4ff'; ctx.fillRect(i * cs - cs / 2, top + 0.12 * Rr + j * cs, cs, cs); }
    else smallHeart(i * cs, top + 0.12 * Rr + j * cs + cs / 2, cs * 0.22, '#ff9ec7');
  }
  ctx.fillStyle = '#fff'; ctx.fillRect(-w * 1.1, top - 0.05 * Rr, 2.2 * w, 0.17 * Rr); // отвёрнутый край
  ctx.strokeStyle = 'rgba(255,158,199,0.9)'; ctx.lineWidth = 0.02 * Rr; ctx.setLineDash([0.05 * Rr, 0.04 * Rr]); ctx.beginPath(); ctx.moveTo(-w, top + 0.09 * Rr); ctx.lineTo(w, top + 0.09 * Rr); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
  shape(); ctx.strokeStyle = '#5aa8e8'; ctx.lineWidth = 0.025 * Rr; ctx.stroke();
  ctx.restore();
}
/** Губка с дырочками */
function sponge(x: number, y: number, s: number, rot: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = '#5fcf6a'; ctx.beginPath(); ctx.roundRect(-0.8 * s, -0.55 * s, 1.6 * s, 0.3 * s, 0.12 * s); ctx.fill();
  ctx.fillStyle = '#ffd84a'; ctx.strokeStyle = '#d9a400'; ctx.lineWidth = 0.05 * s; ctx.beginPath(); ctx.roundRect(-0.8 * s, -0.35 * s, 1.6 * s, 0.85 * s, 0.18 * s); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e6b520'; for (const [px, py, r] of [[-0.45, -0.05, 0.09], [0.1, 0.05, 0.12], [0.5, -0.1, 0.08], [-0.15, 0.3, 0.07], [0.42, 0.28, 0.1], [-0.55, 0.3, 0.06]]) ell(px * s, py * s, r * s, r * 0.8 * s);
  ctx.restore();
}
/** Полотенце: прямоугольник с полосками и бахромой */
function towel(x: number, y: number, s: number, rot: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = '#ff9ec7'; ctx.strokeStyle = '#e0669e'; ctx.lineWidth = 0.04 * s; ctx.beginPath(); ctx.roundRect(-0.9 * s, -0.55 * s, 1.8 * s, 1.1 * s, 0.1 * s); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.fillRect(-0.9 * s, 0.2 * s, 1.8 * s, 0.1 * s); ctx.fillRect(-0.9 * s, -0.3 * s, 1.8 * s, 0.1 * s);
  ctx.strokeStyle = '#ff9ec7'; ctx.lineWidth = 0.05 * s; ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) { const fx = -0.8 * s + i * 0.2 * s; ctx.beginPath(); ctx.moveTo(fx, 0.55 * s); ctx.lineTo(fx, 0.7 * s); ctx.stroke(); }
  ctx.restore();
}
/** Лейка душа на трубе сверху */
function showerHead(x: number, y: number, s: number, on: boolean) {
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = '#a9b8c8'; ctx.lineWidth = 0.22 * s; ctx.beginPath(); ctx.moveTo(x + 1.2 * s, G.HR.y - 10); ctx.lineTo(x + 1.2 * s, y - 0.6 * s); ctx.quadraticCurveTo(x + 1.2 * s, y - 0.9 * s, x + 0.6 * s, y - 0.75 * s); ctx.stroke();
  ctx.strokeStyle = '#dfe8f0'; ctx.lineWidth = 0.08 * s; ctx.beginPath(); ctx.moveTo(x + 1.15 * s, G.HR.y - 10); ctx.lineTo(x + 1.15 * s, y - 0.65 * s); ctx.stroke();
  ctx.translate(x, y); ctx.rotate(0.15);
  const g = ctx.createLinearGradient(-s, -0.6 * s, s, 0.3 * s); g.addColorStop(0, '#f2f7fb'); g.addColorStop(1, '#9fb0c2');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-0.25 * s, -0.75 * s); ctx.lineTo(0.25 * s, -0.75 * s); ctx.lineTo(0.85 * s, 0.05 * s); ctx.lineTo(-0.85 * s, 0.05 * s); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#7d8fa3'; ell(0, 0.05 * s, 0.85 * s, 0.18 * s);
  ctx.fillStyle = on ? '#bfe8ff' : '#55667a'; for (let i = -3; i <= 3; i++) circle(i * 0.22 * s, 0.06 * s, 0.045 * s);
  ctx.restore();
}
/** Пенная шапка: кучка пузырьков */
function clump(x: number, y: number, c: Clump, Rr: number, k: number) {
  for (const [dx, dy, rr] of c.sub) {
    const r = rr * Rr * k, px = x + dx * Rr, py = y + dy * Rr + Math.sin(t * 2 + dx * 9) * 0.006 * Rr;
    ctx.fillStyle = '#ffffff'; circle(px, py, r);
    ctx.strokeStyle = 'rgba(150,200,240,0.8)'; ctx.lineWidth = Math.max(1, r * 0.08); ctx.beginPath(); ctx.arc(px, py, r, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
    ctx.fillStyle = 'rgba(200,230,255,0.7)'; ell(px + r * 0.15, py + r * 0.35, r * 0.5, r * 0.25);
    ctx.fillStyle = '#fff'; circle(px - r * 0.35, py - r * 0.35, r * 0.18);
  }
}
/** Падающая капля */
function drop(x: number, y: number, s: number) {
  ctx.fillStyle = '#7cc8ff'; ctx.beginPath(); ctx.moveTo(x, y - s * 1.6); ctx.quadraticCurveTo(x + s, y - s * 0.2, x, y + s * 0.6); ctx.quadraticCurveTo(x - s, y - s * 0.2, x, y - s * 1.6); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; circle(x - s * 0.25, y - s * 0.1, s * 0.18);
}
/** Полумесяц: круг с вырезанным кругом */
function crescent(x: number, y: number, r: number, col = '#ffe27a') {
  ctx.save(); ctx.beginPath(); ctx.rect(x - 2 * r, y - 2 * r, 4 * r, 4 * r); ctx.moveTo(x + 0.5 * r + r, y - 0.3 * r); ctx.arc(x + 0.5 * r, y - 0.3 * r, r, 0, TAU); ctx.clip('evenodd');
  ctx.fillStyle = col; circle(x, y, r); ctx.restore();
}

// ---------------- ЗНАЧКИ ----------------
function iconBg(r: number, c0: string, c1: string) { const g = ctx.createLinearGradient(0, -r, 0, r); g.addColorStop(0, c0); g.addColorStop(1, c1); ctx.fillStyle = g; circle(0, 0, r); }
const BG_FOOD: [string, string] = ['#fff6e4', '#ffdcb8'], BG_BATH: [string, string] = ['#e6f8ff', '#a9def7'], BG_NIGHT: [string, string] = ['#3a3184', '#1f1a52'];

/** Значок варианта ухода: рисуется в (0,0) радиусом r, уже обрезан кругом */
export function careIcon(stage: string, k: string, r: number) {
  if (stage === 'food') {
    iconBg(r, ...BG_FOOD);
    ctx.save(); ctx.translate(0, r * 0.04); food(k, r * 0.62); ctx.restore();
    if (C.favFound && k === C.fav) { ctx.fillStyle = '#fff'; circle(r * 0.58, -r * 0.55, r * 0.22); smallHeart(r * 0.58, -r * 0.53, r * 0.16, '#ff3f8a'); }
  } else if (stage === 'bath') {
    iconBg(r, ...BG_BATH);
    if (k === 'foam') {
      const c: Clump = { fx: 0, fy: 0, r: 1, t: 1, sub: [[-0.42, 0.25, 0.28], [0.4, 0.27, 0.27], [0, 0.18, 0.34], [-0.2, -0.12, 0.27], [0.2, -0.15, 0.26], [0, -0.42, 0.2]] };
      ctx.fillStyle = 'rgba(80,170,230,0.35)'; ell(0, r * 0.55, r * 0.75, r * 0.15); clump(0, 0, c, r, 1);
    } else if (k === 'shower') {
      ctx.save(); showerHead(-r * 0.1, -r * 0.25, r * 0.5, true); ctx.restore();
      for (let i = 0; i < 6; i++) { const ph = (t * 1.2 + i * 0.37) % 1; drop(-r * 0.45 + i * r * 0.17 + ph * r * 0.08, -r * 0.05 + ph * r * 0.7, r * 0.06); }
    } else if (k === 'rubberduck') rubberDuck(-r * 0.05, r * 0.62, r * 0.85);
    else if (k === 'soapbubbles') {
      bubble(-r * 0.25, r * 0.15, r * 0.4); bubble(r * 0.35, -r * 0.3, r * 0.28); bubble(r * 0.38, r * 0.4, r * 0.16); bubble(-r * 0.4, -r * 0.48, r * 0.14);
    } else if (k === 'sponge') {
      sponge(0, r * 0.08, r * 0.55, -0.15);
      ctx.fillStyle = '#fff'; for (const [x, y, rr] of [[-0.45, -0.38, 0.12], [-0.25, -0.45, 0.09], [0.4, -0.4, 0.1]]) circle(x * r, y * r, rr * r);
    } else if (k === 'towel') {
      ctx.strokeStyle = '#9fb0c2'; ctx.lineWidth = r * 0.1; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-r * 0.7, -r * 0.5); ctx.lineTo(r * 0.7, -r * 0.5); ctx.stroke();
      ctx.save(); ctx.translate(0, -r * 0.5);
      ctx.fillStyle = '#ff9ec7'; ctx.strokeStyle = '#e0669e'; ctx.lineWidth = r * 0.04; ctx.beginPath(); ctx.roundRect(-r * 0.45, -r * 0.05, r * 0.9, r * 1.0, r * 0.08); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillRect(-r * 0.45, r * 0.65, r * 0.9, r * 0.08); ctx.fillRect(-r * 0.45, r * 0.5, r * 0.9, r * 0.05);
      ctx.fillStyle = '#ffc4dd'; ctx.fillRect(-r * 0.45, -r * 0.05, r * 0.9, r * 0.18);
      smallHeart(0, r * 0.32, r * 0.13, '#fff');
      ctx.restore();
    }
  } else if (stage === 'sleep') {
    if (k === 'sun') {
      iconBg(r, '#fff3c4', '#ffc4dd'); sun(0, r * 0.05, r * 0.4, t * 0.4, 0);
    } else {
      iconBg(r, ...BG_NIGHT);
      ctx.fillStyle = '#fff6c0'; for (const [x, y, s] of [[-0.6, -0.35, 0.05], [0.55, -0.55, 0.06], [0.62, 0.3, 0.04], [-0.5, 0.5, 0.04]]) { ctx.save(); ctx.translate(x * r, y * r); starPath(4, s * r * 2, s * r * 0.7); ctx.fill(); ctx.restore(); }
      if (k === 'moon') moon(0, 0, r * 0.5, 0);
      else if (k === 'teddy') teddy(0, r * 0.95, r * 0.36, false);
      else if (k === 'nightlight') lamp(0, r * 0.12, r * 0.5, 0, true, -r);
      else if (k === 'blanket') {
        ctx.save(); ctx.translate(0, -r * 0.05);
        ctx.fillStyle = '#fff'; ell(0, -r * 0.35, r * 0.55, r * 0.22); // подушка
        ctx.strokeStyle = '#d9c6e6'; ctx.lineWidth = r * 0.03; ctx.stroke();
        blanket(r * 0.66, 1, 0);
        ctx.restore();
      } else if (k === 'lullaby') {
        musicBox(-r * 0.05, r * 0.6, r * 0.42, t * 3);
        note(r * 0.5, -r * 0.35, r * 0.28, '#ffd6ea'); note(-r * 0.55, -r * 0.15, r * 0.22, '#bfe8ff');
      }
    }
  }
}
/** Значок раздела ухода на ленте */
export function careStageIcon(stage: string, r: number) {
  if (stage === 'food') { // тарелка с ягодой и ложка
    iconBg(r, ...BG_FOOD);
    ctx.fillStyle = 'rgba(160,90,40,0.18)'; ell(-r * 0.08, r * 0.2, r * 0.66, r * 0.42);
    ctx.fillStyle = '#fff'; ell(-r * 0.1, r * 0.12, r * 0.66, r * 0.42); ctx.strokeStyle = '#ffb3d1'; ctx.lineWidth = r * 0.05; ctx.stroke();
    ctx.fillStyle = '#ffeef6'; ell(-r * 0.1, r * 0.12, r * 0.42, r * 0.26);
    ctx.save(); ctx.translate(-r * 0.12, r * 0.0); food('strawberry', r * 0.32); ctx.restore();
    ctx.save(); ctx.translate(r * 0.68, r * 0.0); ctx.rotate(0.25);
    ctx.fillStyle = '#c9d2dc'; ctx.strokeStyle = '#8e9aa8'; ctx.lineWidth = r * 0.03; ell(0, -r * 0.42, r * 0.13, r * 0.2); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(-r * 0.04, -r * 0.25, r * 0.08, r * 0.75, r * 0.04); ctx.fill(); ctx.stroke();
    ctx.restore();
  } else if (stage === 'bath') { // ванна на ножках с пеной
    iconBg(r, ...BG_BATH);
    const c: Clump = { fx: 0, fy: 0, r: 1, t: 1, sub: [[-0.45, -0.08, 0.18], [-0.2, -0.18, 0.2], [0.08, -0.12, 0.19], [0.35, -0.16, 0.18], [0.55, -0.05, 0.14], [-0.05, -0.36, 0.14]] };
    clump(0, 0, c, r, 1);
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#7fb8e0'; ctx.lineWidth = r * 0.05;
    ctx.beginPath(); ctx.moveTo(-r * 0.75, -r * 0.05); ctx.lineTo(r * 0.75, -r * 0.05); ctx.quadraticCurveTo(r * 0.72, r * 0.48, r * 0.3, r * 0.5); ctx.lineTo(-r * 0.3, r * 0.5); ctx.quadraticCurveTo(-r * 0.72, r * 0.48, -r * 0.75, -r * 0.05); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff9ec7'; ctx.fillRect(-r * 0.72, r * 0.08, r * 1.44, r * 0.08);
    ctx.fillStyle = '#ffd23f'; for (const d of [-1, 1]) ell(d * r * 0.4, r * 0.6, r * 0.09, r * 0.12);
    ctx.strokeStyle = '#9fb0c2'; ctx.lineWidth = r * 0.07; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-r * 0.65, -r * 0.05); ctx.lineTo(-r * 0.65, -r * 0.5); ctx.lineTo(-r * 0.45, -r * 0.5); ctx.stroke();
  } else if (stage === 'sleep') { // полумесяц и звёзды на ночном небе
    iconBg(r, ...BG_NIGHT);
    crescent(-r * 0.1, r * 0.02, r * 0.5);
    ctx.fillStyle = '#fff6c0'; for (const [x, y, s] of [[0.5, -0.45, 0.16], [0.55, 0.35, 0.11], [-0.55, -0.5, 0.09], [0.2, -0.05, 0.08]]) { ctx.save(); ctx.translate(x * r, y * r); starPath(5, s * r, s * r * 0.45); ctx.fill(); ctx.restore(); }
  }
}
/** Включён ли вариант сейчас (подсветка кнопки), например «спит» */
export function careSel(stage: string, k: string): boolean {
  if (stage === 'bath') return k === 'foam' ? C.foamOn : k === 'rubberduck' ? !!C.duck : false;
  if (stage === 'sleep') {
    if (k === 'moon') return C.sleep;
    if (k === 'teddy') return !!C.teddy;
    if (k === 'nightlight') return !!C.lamp;
    if (k === 'blanket') return !!C.blanket;
    if (k === 'lullaby') return !!C.box;
  }
  return false;
}

// ---------------- ДЕЙСТВИЯ ----------------
const FOAM_AT: [number, number][] = [[-0.6, -0.82], [-0.28, -0.74], [0.3, -0.76], [0.62, -0.82], [0.88, -0.48], [-0.88, -0.45], [0, -0.52], [-0.95, -0.05], [0.95, -0.08], [0.55, 0.55], [-0.55, 0.55], [0, 0.82]];
function makeClump(fx: number, fy: number, delay = 0): Clump {
  const sub: [number, number, number][] = [], n = 4 + (Math.random() * 3 | 0);
  for (let i = 0; i < n; i++) { const a = rand(0, TAU), d = rand(0, 0.11); sub.push([Math.cos(a) * d, Math.sin(a) * d * 0.7, rand(0.06, 0.1)]); }
  return { fx, fy, r: 0.17, t: -delay, sub };
}
function popClump(c: Clump, loud = true) {
  const i = C.foam.indexOf(c); if (i < 0) return;
  C.foam.splice(i, 1);
  const [x, y] = hp(c.fx, c.fy);
  burst(x, y, 'smoke', 5, { color: '#ffffff', speed: 90, size: 12 });
  burst(x, y, 'spark', 4, { color: '#bfe8ff', speed: 140, size: 6 });
  if (loud) sfx.pop(rand(0.8, 1.4));
  if (!C.foam.length && C.foamOn) { C.foamOn = false; G.hs.sqT = 0; G.hs.mouth = 1; sfx.giggle(1.1); }
}
function popAllFoam() { for (const c of [...C.foam]) popClump(c, false); C.foamOn = false; }
function happy(jump = false) { const hs = G.hs; hs.sqT = 0; hs.mouth = 1; hs.swingV += 3; if (jump) hs.jT = 0; }

function goSleep() {
  C.sleep = true; C.sleepT = 0; C.stir = 9; C.wake = 9; C.zT = 0.8;
  snd.yawn(); snd.sleepy();
}
/** Проснуться: потягушки, зевок, «доброе утро», выглядывает солнышко */
function wakeUp(withSun = true) {
  const was = C.sleep;
  C.sleep = false; C.stir = 9;
  if (C.blanket) { C.blanket = null; sfx.rustle(); }
  if (withSun) { C.wake = was ? 0 : 0.9; C.morning = 0; snd.yawn(); }
  else C.wake = 9;
}

/** Тап по кнопке варианта; (x, y) — где кнопка: оттуда, например, летит еда */
export function careAct(stage: string, k: string, x: number, y: number) {
  const { x: hx, y: hy } = G.heart, Rr = R();
  if (stage === 'food') {
    if (C.fly.length >= 4) return;
    C.fly.push({ k, x0: x, y0: y, t: 0 }); snd.fly();
    return;
  }
  if (stage === 'bath') {
    if (k === 'foam') {
      if (C.foamOn) { popAllFoam(); sfx.poof(); return; }
      C.foamOn = true; C.foam = FOAM_AT.map(([fx, fy], i) => makeClump(fx + rand(-0.04, 0.04), fy + rand(-0.03, 0.03), i * 0.05));
      snd.foam(); happy(); burst(hx, hy - Rr * 0.7, 'spark', 10, { color: '#bfe8ff', speed: 200 });
    } else if (k === 'shower') {
      C.shower = Math.min(4, Math.max(C.shower, 0) + 2.6); sfx.splash(); whoosh(2.2, 0.05); happy();
    } else if (k === 'rubberduck') {
      if (C.duck) { const [dx, dy] = duckPos(); C.duck = null; sfx.poof(); burst(dx, dy - duckS() * 0.6, 'smoke', 6, { color: '#fff', speed: 120, size: 14 }); return; }
      C.duck = { t: 0, jump: 0 }; sfx.squeak(); sfx.splash();
    } else if (k === 'soapbubbles') {
      for (let i = 0; i < 7; i++) if (C.bubbles.length < 22) C.bubbles.push({ x: hx + rand(-1.1, 1.1) * Rr, y: hy + rand(0.3, 1.0) * Rr, r: Math.max(26, Rr * rand(0.11, 0.2)), vy: -rand(45, 80) * S, ph: rand(0, TAU), t: -i * 0.12 });
      sfx.blub(); sfx.magic();
    } else if (k === 'sponge') {
      C.sponge = { t: 0, e: 0 }; snd.rub();
    } else if (k === 'towel') {
      C.towel = { t: 0 }; whoosh(0.5, 0.1);
    }
    return;
  }
  if (stage === 'sleep') {
    if (k === 'moon') { if (C.sleep) wakeUp(true); else goSleep(); }
    else if (k === 'teddy') {
      if (C.teddy) { const [tx, ty] = teddyPos(); C.teddy = null; sfx.poof(); burst(tx, ty - teddyS() * 1.4, 'smoke', 6, { color: '#fff', speed: 120, size: 16 }); }
      else { C.teddy = { t: 0, hug: 0 }; snd.hug(); G.hs.love = Math.max(G.hs.love, 1.2); }
    } else if (k === 'nightlight') {
      if (C.lamp) { C.lamp = null; snd.click(); }
      else {
        const stars: Star[] = []; for (let i = 0; i < 11; i++) stars.push({ u: (i + rand(0.1, 0.9)) / 11, v: rand(0.05, 0.32), s: rand(0.7, 1.3), tw: 0, ph: rand(0, TAU) });
        C.lamp = { t: 0, hue: 0, stars }; snd.click(); sfx.tinkle();
      }
    } else if (k === 'blanket') {
      if (C.blanket) { C.blanket = null; sfx.rustle(); }
      else { C.blanket = { t: 0, tuck: 0 }; sfx.rustle(); if (!C.sleep) happy(); }
    } else if (k === 'lullaby') {
      if (C.box) { C.box = null; snd.click(); } else { C.box = { t: 0, spin: 0, boost: 0 }; snd.click(); }
    } else if (k === 'sun') {
      wakeUp(true);
      if (C.wake > 0.5) sfx.tinkle();
    }
  }
}
/** Сменился раздел (from → to, id этапов): например, ушли со сна — сердце просыпается */
export function careStageChange(from: string, to: string) {
  if (from === to) return;
  if (from === 'sleep') {
    if (C.sleep) wakeUp(true);
    C.teddy = null; C.lamp = null; C.blanket = null; C.box = null;
  }
  if (from === 'bath') {
    popAllFoam(); C.duck = null; C.shower = 0; C.sponge = null; C.towel = null;
  }
}

// ---------------- ОБНОВЛЕНИЕ ----------------
export function updateCare(dt: number) {
  const hs = G.hs, { x: hx, y: hy } = G.heart, Rr = R();
  if (G.finale && C.sleep) wakeUp(false);
  // еда летит
  for (const f of C.fly) f.t += dt;
  const FLY = 0.7;
  for (const f of C.fly.filter(q => q.t >= FLY)) {
    C.fly.splice(C.fly.indexOf(f), 1);
    const fav = f.k === C.fav;
    if (!fav) C.eaten++;
    C.eat = { k: f.k, t: 0, fav, grim: !fav && C.eaten % 3 === 2, bites: 0, done: false };
  }
  // жуёт: 3 «ням» (в моменты 0.12, 0.55, 0.98), потом реакция
  const E = C.eat;
  if (E) {
    const prev = E.t; E.t += dt;
    for (const ct of [0.12, 0.55, 0.98]) if (prev < ct && E.t >= ct) {
      E.bites++; snd.chomp(!!CRUNCHY[E.k]);
      const [mx, my] = mouthPos(), col = FOOD_COL[E.k] || ['#fff'];
      for (let i = 0; i < 6; i++) addP({ kind: 'confetti', x: mx + rand(-0.12, 0.12) * Rr, y: my + rand(0, 0.05) * Rr, vx: rand(-140, 140) * S, vy: rand(-160, -40) * S, life: rand(0.6, 1.1), size: rand(4, 8) * S, color: pick(col), rot: rand(0, TAU), vr: rand(-8, 8), g: 700 });
    }
    if (prev < 1.2 && E.t >= 1.2) {
      E.done = true;
      const [mx, my] = mouthPos();
      if (E.fav) {
        C.favFound = true; hs.love = 2.2; hs.jT = 0; snd.fav();
        burst(hx, hy - Rr * 0.3, 'heart', 16, { color: '#ff5c9a', up: -120, speed: 260 });
        addP({ kind: 'bigheart', x: hx, y: hy - Rr * 0.1, vx: 0, vy: -30 * S, life: 1.2, size: Rr * 0.5, color: 'rgba(255,90,150,0.5)', rot: 0, vr: 0, g: 0 });
      } else if (E.grim) { snd.brr(); burst(mx, my, 'spark', 6, { color: '#c9f0ff', speed: 140 }); }
      else { snd.yum(); happy(); burst(mx, my - Rr * 0.1, 'heart', 6, { up: -90, speed: 140 }); }
    }
    if (E.grim && prev < 2.1 && E.t >= 2.1) { sfx.giggle(1.1); happy(true); }
    if (E.t > (E.grim ? 2.7 : 1.9)) C.eat = null;
  }
  // пена
  for (const c of C.foam) c.t += dt;
  // душ
  if (C.shower > 0) {
    C.shower -= dt; C.dropT -= dt; C.splashT -= dt;
    const [sx, sy] = showerPos(), s = Math.max(16, Rr * 0.14);
    while (C.dropT <= 0) {
      C.dropT += 0.02;
      const dx = rand(-0.7, 0.7);
      C.drops.push({ x: sx + dx * s * 1.1, y: sy + s * 0.1, vy: rand(350, 450) * S, stop: hy + (-0.75 + Math.abs(dx) * 0.2 + rand(0, 1.3)) * Rr });
    }
    if (C.splashT <= 0) { C.splashT = 0.55; sfx.splash(); }
    hs.mouth = Math.max(hs.mouth, 0.6);
  }
  for (const d of C.drops) {
    d.y += d.vy * dt; d.x += (d.x - showerPos()[0]) * dt * 0.8;
    if (d.y > d.stop) { d.vy = -1; if (Math.random() < 0.4) addP({ kind: 'spark', x: d.x, y: d.y, vx: rand(-60, 60) * S, vy: rand(-90, -30) * S, life: 0.35, size: rand(3, 5) * S, color: '#9fdcff', rot: 0, vr: 0, g: 600 }); }
  }
  C.drops = C.drops.filter(d => d.vy > 0);
  // уточка
  if (C.duck) { C.duck.t += dt; C.duck.jump += dt; }
  // мыльные пузыри
  for (const b of C.bubbles) { b.t += dt; if (b.t > 0) { b.y += b.vy * dt; b.ph += dt * 1.6; } }
  C.bubbles = C.bubbles.filter(b => b.y > G.HR.y - b.r * 2);
  // губка: трёт по кругу, искорки чистоты; если есть пена — пены прибавляется
  if (C.sponge) {
    const Sp = C.sponge; Sp.t += dt; Sp.e -= dt;
    if (Sp.e <= 0) {
      Sp.e = 0.16; const [px, py] = spongePos();
      burst(px, py, 'spark', 2, { color: pick(['#ffffff', '#bfe8ff', '#fff6a8']), speed: 160, size: 9 });
      if (C.foamOn && C.foam.length < 18 && Math.random() < 0.35) C.foam.push(makeClump((px - hx) / Rr, (py - hy) / Rr));
    }
    if ((Sp.t * 2.4 | 0) !== ((Sp.t - dt) * 2.4 | 0)) snd.rub();
    if (Sp.t > 1.8) { C.sponge = null; C.shine = Math.max(C.shine, 1.5); happy(); sfx.tinkle(); }
  }
  // полотенце: вытирает пену, потом сердце блестит
  if (C.towel) {
    const Tw = C.towel; Tw.t += dt;
    const [tx, ty] = towelPos();
    for (const c of [...C.foam]) { const [cx, cy] = hp(c.fx, c.fy); if (Math.hypot(cx - tx, cy - ty) < Rr * 0.45) { C.foam.splice(C.foam.indexOf(c), 1); burst(cx, cy, 'smoke', 3, { color: '#fff', speed: 60, size: 10 }); } }
    if ((Tw.t * 3 | 0) !== ((Tw.t - dt) * 3 | 0)) whoosh(0.25, 0.06);
    if (Tw.t > 1.6) { C.towel = null; C.foam.length = 0; C.foamOn = false; C.shine = 2.6; happy(true); sfx.tinkle(); sfx.magic(); burst(hx, hy - Rr * 0.3, 'spark', 16, { color: '#fff6a8', speed: 280 }); }
  }
  C.shine = Math.max(0, C.shine - dt);
  // сон
  C.night += ((C.sleep && !G.finale ? 1 : 0) - C.night) * Math.min(1, dt * 1.5);
  if (C.sleep) {
    C.sleepT += dt; C.stir += dt; C.zT -= dt;
    if (C.zT <= 0 && C.sleepT > 0.8) {
      C.zT = 1.1;
      const z = Math.random() < 0.65;
      addP({ kind: z ? 'z' : 'spark', x: hx + 0.5 * Rr, y: hy - 0.55 * Rr, vx: rand(15, 35) * S, vy: -rand(30, 45) * S, life: 2.4, size: Math.max(16, Rr * (z ? 0.16 : 0.07)), color: z ? '#fff6c0' : '#ffe27a', rot: 0, vr: z ? 0 : 1.5, g: 0 });
    }
  }
  // просыпается
  if (C.wake < 9) {
    const prev = C.wake; C.wake += dt;
    if (prev < 1.0 && C.wake >= 1.0) { snd.morning(); hs.jT = 0; hs.mouth = 1; burst(hx, hy - Rr * 0.5, 'spark', 14, { color: '#fff6a8', speed: 240 }); burst(hx, hy - Rr * 0.3, 'heart', 6, { up: -80, speed: 160 }); }
    if (C.wake > 2.2) C.wake = 9;
  }
  if (C.morning < 9) { C.morning += dt; if (C.morning > 5) C.morning = 9; }
  C.sunLaugh = Math.max(0, C.sunLaugh - dt);
  if (C.teddy) { C.teddy.t += dt; C.teddy.hug += dt; }
  if (C.lamp) { C.lamp.t += dt; for (const s of C.lamp.stars) s.tw = Math.max(0, s.tw - dt * 1.2); }
  if (C.blanket) { C.blanket.t += dt; C.blanket.tuck = Math.max(0, C.blanket.tuck - dt * 2); }
  if (C.box) {
    const B = C.box; B.t += dt; B.boost = Math.max(0, B.boost - dt); B.spin += dt * (2 + B.boost * 6);
    if ((B.t * 1.2 | 0) !== ((B.t - dt) * 1.2 | 0)) { const [bx, by] = boxPos(); addP({ kind: 'note', x: bx + rand(-10, 10) * S, y: by - boxS() * 1.6, vx: rand(-20, 20) * S, vy: -40 * S, life: 1.8, size: Math.max(18, 26 * S), color: pick(['#ffd6ea', '#bfe8ff', '#fff6a8']), rot: 0, vr: 0, g: 0 }); }
  }
  updLullaby(G.started && !G.finale && (C.sleep || !!C.box), !!C.box);
}
function spongePos(): [number, number] { const p = C.sponge ? C.sponge.t : 0, a = p * 9; return hp(Math.cos(a) * 0.38 + Math.sin(p * 2) * 0.15, -0.35 + Math.sin(a) * 0.22 + p * 0.2); }
function towelPos(): [number, number] { const p = C.towel ? C.towel.t / 1.6 : 0; return hp(Math.sin(p * 14) * 0.55, -0.8 + p * 1.4); }

// ---------------- РИСОВАНИЕ ----------------
/** Позади сердца */
export function drawCareBack() {
  if (G.finale) return;
  const Rr = R();
  if (C.shower > 0 || C.drops.length) { const [sx, sy] = showerPos(); showerHead(sx, sy, Math.max(16, Rr * 0.14), C.shower > 0); }
}
/** Перед сердцем */
export function drawCareFront() {
  if (G.finale) return;
  const { x: hx, y: hy } = G.heart, Rr = R();
  // одеяльце — в координатах сердца
  if (C.blanket) { ctx.save(); ctx.translate(hx, hy + C.dy); blanket(Rr, ease.out(clamp01(C.blanket.t / 0.5)), C.blanket.tuck); ctx.restore(); }
  // пена
  for (const c of C.foam) { if (c.t <= 0) continue; const [x, y] = hp(c.fx, c.fy); clump(x, y, c, Rr, ease.outBack(clamp01(c.t / 0.3))); }
  // блеск чистоты
  if (C.shine > 0) {
    const a = clamp01(C.shine);
    ctx.save(); ctx.globalAlpha *= a;
    [[-0.5, -0.55], [0.55, -0.6], [0.72, 0.05], [-0.68, 0.02], [0.12, -0.78], [-0.2, 0.55], [0.35, 0.45]].forEach(([fx, fy], i) => {
      const [x, y] = hp(fx, fy), s = Rr * (0.06 + 0.03 * Math.sin(t * 6 + i * 1.7));
      sparkleStar(x, y, Math.max(4, s), t * 1.5 + i, '#ffffff');
    });
    ctx.restore();
  }
  // еда у рта и гримаса
  const E = C.eat;
  if (E && E.bites < 3) {
    const [mx, my] = mouthPos(), s = Rr * 0.17 * (1 - E.bites * 0.12);
    ctx.save(); ctx.translate(mx + Rr * 0.03, my + Rr * 0.02); ctx.rotate(-0.2 + Math.sin(E.t * 14) * 0.05); food(E.k, s, E.bites); ctx.restore();
  }
  if (E && E.grim && E.done && E.t < 2.1) { // язычок «бе-е»
    const [mx, my] = mouthPos(), w = Math.sin((E.t - 1.2) * 18) * 0.015 * Rr;
    ctx.fillStyle = '#ff6f8f'; ell(mx + w, my + 0.07 * Rr, 0.065 * Rr, 0.08 * Rr); ctx.strokeStyle = '#d0406a'; ctx.lineWidth = Math.max(1, 0.012 * Rr); ctx.beginPath(); ctx.moveTo(mx + w, my + 0.03 * Rr); ctx.lineTo(mx + w, my + 0.1 * Rr); ctx.stroke();
  }
  // еда в полёте: дуга от кнопки ко рту
  for (const f of C.fly) {
    const k = clamp01(f.t / 0.7), [mx, my] = mouthPos(), e = ease.inOut(k);
    const x = f.x0 + (mx - f.x0) * e, y = f.y0 + (my - f.y0) * e - Math.sin(k * Math.PI) * Rr * 0.6;
    const s = (Math.max(22, 30 * S) * (1 - k) + Rr * 0.17 * k) * (k < 0.15 ? 0.6 + k / 0.15 * 0.4 : 1);
    ctx.save(); ctx.translate(x, y); ctx.rotate(k * TAU * 0.8 - 0.2); food(f.k, s); ctx.restore();
  }
  // губка и полотенце
  if (C.sponge) { const [px, py] = spongePos(); sponge(px, py, Math.max(24, Rr * 0.17), Math.sin(C.sponge.t * 9) * 0.3); }
  if (C.towel) { const [tx, ty] = towelPos(); towel(tx, ty, Math.max(30, Rr * 0.3), Math.sin(C.towel.t * 9) * 0.25); }
  // душ: капли
  for (const d of C.drops) drop(d.x, d.y, Math.max(3, Rr * 0.025));
  if (C.morning < 9) { // солнышко выглядывает
    const [sx, sy] = sunPos(), a = C.morning > 4.3 ? (5 - C.morning) / 0.7 : 1;
    ctx.save(); ctx.globalAlpha *= clamp01(a); sun(sx, sy, sunR(), t * 0.4 + C.sunLaugh * 6, C.sunLaugh > 0 ? 1 : 0); ctx.restore();
  }
  // уточка, мишка, шкатулка, ночник
  if (C.lamp) { const [lx, ly] = lampPos(), k = ease.outBack(clamp01(C.lamp.t / 0.4)); lamp(lx, ly - (1 - k) * lampS() * 2, lampS(), C.lamp.hue, true, G.HR.y); }
  if (C.duck) { const [dx, dy] = duckPos(), k = ease.outBack(clamp01(C.duck.t / 0.4)); rubberDuck(dx, dy, duckS() * Math.max(0.01, k), C.duck.jump < 0.3 ? Math.sin(C.duck.jump / 0.3 * Math.PI) : 0); }
  if (C.teddy) { const [tx, ty] = teddyPos(), k = ease.outBack(clamp01(C.teddy.t / 0.4)), h = C.teddy.hug < 1.2 ? Math.sin(C.teddy.hug / 1.2 * Math.PI) : 0; teddy(tx - h * Rr * 0.08, ty, teddyS() * Math.max(0.01, k), C.sleep && C.sleepT > 0.7, h, C.teddy.hug < 1.2 ? 1 : 0); }
  if (C.box) { const [bx, by] = boxPos(), k = ease.outBack(clamp01(C.box.t / 0.4)); musicBox(bx, by, boxS() * Math.max(0.01, k), C.box.spin, clamp01(C.box.t / 0.6)); }
  // мыльные пузыри
  for (const b of C.bubbles) { if (b.t <= 0) continue; const k = ease.outBack(clamp01(b.t / 0.4)); bubble(b.x + Math.sin(b.ph) * b.r * 0.4, b.y, b.r * Math.max(0.01, k)); }
}
/** Поверх мира, но под частицами и интерфейсом (например, ночное затемнение) */
export function drawCareOverlay() {
  if (G.finale) return;
  const n = C.night, { x: hx, y: hy } = G.heart, Rr = R();
  if (n > 0.01) {
    const g = ctx.createRadialGradient(hx, hy, Rr * 0.3, hx, hy, Math.max(W, H) * 0.8);
    g.addColorStop(0, `rgba(24,20,80,${0.22 * n})`); g.addColorStop(1, `rgba(16,12,58,${0.62 * n})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (C.lamp) { // ночник: тёплый свет и звёздочки по «потолку»
    const L = C.lamp, [lx, ly] = lampPos(), s = lampS(), [c0] = LAMP_HUES[L.hue % LAMP_HUES.length], on = clamp01(L.t / 0.6);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(lx, ly, s * 0.2, lx, ly, s * 4.5); g.addColorStop(0, c0 + '66'); g.addColorStop(1, c0 + '00');
    ctx.fillStyle = g; circle(lx, ly, s * 4.5);
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(G.HR.x, G.HR.y, G.HR.w, G.HR.h); ctx.clip();
    ctx.globalAlpha *= on * (0.55 + 0.45 * n);
    for (const st of L.stars) { const [x, y] = starPos(st), sz = starS(st) * (1 + st.tw * 0.8); sparkleStar(x, y, sz * (0.85 + 0.15 * Math.sin(t * 2 + st.ph)), t * 0.3 + st.ph, st.tw > 0 ? '#ffffff' : c0); }
    ctx.restore();
  }
}
function starPos(st: Star): [number, number] { const A = G.HR, u = ((st.u + (C.lamp ? C.lamp.t : 0) * 0.008) % 1 + 1) % 1; return [A.x + 0.04 * A.w + u * A.w * 0.92, A.y + st.v * A.h]; }
const starS = (st: Star) => Math.max(9, R() * 0.06) * st.s;

/** Подправить живое состояние сердца перед рисованием: рот жуёт, глаза закрыты во сне */
export function careLive(L: Live) {
  const E = C.eat;
  // смотрит на летящую еду и открывает рот
  const f = C.fly[0];
  if (f) {
    const k = clamp01(f.t / 0.7), [mx, my] = mouthPos(), e = ease.inOut(k), Rr = R();
    const x = f.x0 + (mx - f.x0) * e, y = f.y0 + (my - f.y0) * e - Math.sin(k * Math.PI) * Rr * 0.6;
    L.lx = clamp((x - G.heart.x) / (Rr * 1.2), -1, 1); L.ly = clamp((y - G.heart.y) / (Rr * 1.2), -1, 1);
    if (k > 0.35) L.mouth = Math.max(L.mouth, 1);
  }
  if (E) {
    if (E.t < 1.1) L.mouth = 0.5 - 0.45 * Math.cos((E.t - 0.12) / 0.43 * TAU);
    else if (E.grim && E.t < 2.1) { L.blink = 1; L.mouth = 0; }
    else if (E.grim) L.mouth = 0.6 + 0.4 * Math.abs(Math.sin(E.t * 14));
    if (E.t < 1.1) L.ly = Math.max(L.ly, 0.5);
  }
  if (C.shower > 0 || C.towel) L.blink = 1; // жмурится от удовольствия
  if (C.sponge) L.mouth = Math.max(L.mouth, 0.6 + 0.3 * Math.sin(t * 10));
  if (C.sleep) {
    if (C.sleepT < 0.8) { L.mouth = Math.max(L.mouth, Math.sin(clamp01(C.sleepT / 0.8) * Math.PI)); L.blink = Math.max(L.blink, C.sleepT / 0.8); }
    else if (C.stir < 1.4) { // сонно моргнул и бормочет
      const p = C.stir; L.blink = p > 0.25 && p < 0.8 ? 0.55 : 1; L.mouth = p < 1.1 ? 0.15 + 0.15 * Math.abs(Math.sin(p * 9)) : 0;
    } else L.blink = 1;
    L.love = Math.min(L.love, 0.4);
  }
  if (C.wake < 9) {
    const p = C.wake;
    if (p < 0.6) L.blink = 1; else if (p < 0.9) L.blink = 0.5;
    if (p < 0.95) L.mouth = Math.max(L.mouth, Math.sin(clamp01(p / 0.95) * Math.PI)); // зевает
  }
}
/** Добавка к положению/форме сердца (жуёт, потягивается) */
export function careXform(Rr: number): Xf {
  let dy = 0, rot = 0, sx = 1, sy = 1;
  const E = C.eat;
  if (E) {
    if (E.t < 1.1) { const c = Math.cos((E.t - 0.12) / 0.43 * TAU); sy *= 1 - 0.025 * c; sx *= 1 + 0.02 * c; }
    else if (E.grim && E.t < 2.1) { rot += Math.sin(E.t * 16) * 0.05; sx *= 1.06; sy *= 0.94; }
  }
  if (C.sleep) { const b = Math.sin(t * 1.7); sy *= 1 + 0.03 * b; sx *= 1 - 0.012 * b; rot += Math.sin(t * 0.85) * 0.015; }
  if (C.wake < 9 && C.wake < 0.95) { const k = Math.sin(clamp01(C.wake / 0.95) * Math.PI); sy *= 1 + 0.12 * k; sx *= 1 - 0.07 * k; dy -= 0.04 * Rr * k; rot += Math.sin(C.wake * 7) * 0.04 * k; }
  if (C.sponge) rot += Math.sin(C.sponge.t * 13) * 0.025;
  if (C.towel) { rot += Math.sin(C.towel.t * 12) * 0.04; sx *= 1.02; sy *= 0.98; }
  if (C.teddy && C.teddy.hug < 1.2) { const k = Math.sin(C.teddy.hug / 1.2 * Math.PI); rot += 0.12 * k; sx *= 1 + 0.04 * k; }
  if (C.blanket && C.blanket.tuck > 0) { sx *= 1 + 0.03 * C.blanket.tuck; sy *= 1 - 0.03 * C.blanket.tuck; }
  C.dy = dy;
  return dy || rot || sx !== 1 || sy !== 1 ? { dy, rot, sx, sy } : NONE;
}

// ---------------- ТАПЫ ----------------
/** Предмет ухода под точкой (пена, мишка…) или null — проверяется раньше сердца */
export function hitCare(x: number, y: number): any {
  if (G.finale) return null;
  const Rr = R();
  for (let i = C.bubbles.length - 1; i >= 0; i--) { const b = C.bubbles[i]; if (b.t > 0 && near(x, y, b.x + Math.sin(b.ph) * b.r * 0.4, b.y, b.r * 1.1)) return { k: 'care', what: 'bubble', o: b }; }
  if (C.sponge) { const [px, py] = spongePos(); if (near(x, y, px, py, Rr * 0.2)) return { k: 'care', what: 'sponge' }; }
  if (C.towel) { const [tx, ty] = towelPos(); if (near(x, y, tx, ty, Rr * 0.3)) return { k: 'care', what: 'towel' }; }
  if (C.duck) { const [dx, dy] = duckPos(), s = duckS(); if (near(x, y, dx, dy - 0.6 * s, s * 0.8)) return { k: 'care', what: 'duck' }; }
  if (C.teddy) { const [tx, ty] = teddyPos(), s = teddyS(); if (Math.abs(x - tx) < Math.max(32, s * 0.85) && y < ty + 6 && y > ty - Math.max(64, s * 2.4)) return { k: 'care', what: 'teddy' }; }
  if (C.box) { const [bx, by] = boxPos(), s = boxS(); if (near(x, y, bx, by - 0.8 * s, s * 1.0)) return { k: 'care', what: 'box' }; }
  if (C.lamp) { const [lx, ly] = lampPos(), s = lampS(); if (near(x, y, lx, ly, s * 1.1)) return { k: 'care', what: 'lamp' }; }
  let best: Clump | null = null, bd = 1e9;
  for (const c of C.foam) { if (c.t <= 0) continue; const [cx, cy] = hp(c.fx, c.fy), d = Math.hypot(x - cx, y - cy); if (d < Math.max(30, Rr * 0.17) && d < bd) { bd = d; best = c; } }
  if (best) return { k: 'care', what: 'foam', o: best };
  if (C.blanket) { const top = G.heart.y + C.dy + 0.4 * Rr; if (y > top && y < G.heart.y + 1.12 * Rr && Math.abs(x - G.heart.x) < 1.12 * Rr) return { k: 'care', what: 'blanket' }; }
  if (C.shower > 0) { const [sx, sy] = showerPos(); if (near(x, y, sx, sy - Rr * 0.05, Rr * 0.16)) return { k: 'care', what: 'shower' }; }
  if (C.morning < 9) { const [sx, sy] = sunPos(); if (near(x, y, sx, sy, sunR() * 1.3)) return { k: 'care', what: 'sun' }; }
  if (C.lamp) for (const st of C.lamp.stars) { const [sx, sy] = starPos(st); if (near(x, y, sx, sy, starS(st) * 1.4)) return { k: 'care', what: 'star', o: st }; }
  return null;
}
export function tapCare(h: any, x: number, y: number) {
  const Rr = R();
  switch (h.what) {
    case 'bubble': {
      const b = h.o, i = C.bubbles.indexOf(b); if (i >= 0) C.bubbles.splice(i, 1);
      sfx.pop(rand(0.7, 1.3)); burst(x, y, 'spark', 8, { color: pick(['#ffffff', '#bfe8ff', '#ffc4e1']), speed: 200 }); break;
    }
    case 'foam': popClump(h.o); break;
    case 'sponge': snd.rub(); C.sponge!.t = Math.max(0, C.sponge!.t - 0.6); burst(x, y, 'smoke', 4, { color: '#fff', speed: 100, size: 12 }); break;
    case 'towel': whoosh(0.3, 0.08); burst(x, y, 'spark', 5, { color: '#ffc4e1', speed: 150 }); break;
    case 'duck': C.duck!.jump = 0; sfx.squeak(); burst(x, y - 10 * S, 'heart', 4, { up: -80, speed: 120, color: '#ffd93b' }); break;
    case 'teddy': C.teddy!.hug = 0; snd.hug(); G.hs.love = Math.max(G.hs.love, 1); burst(x, y, 'heart', 6, { up: -80, speed: 140, color: '#ff7aa8' }); break;
    case 'box': C.box!.boost = 1.2; snd.twinkle(); burst(x, y, 'spark', 5, { color: '#fff6a8', speed: 140 }); break;
    case 'lamp': C.lamp!.hue++; snd.click(); for (const s of C.lamp!.stars) s.tw = 0.6; break;
    case 'star': h.o.tw = 1; snd.twinkle(); burst(x, y, 'spark', 5, { color: '#fff6a8', speed: 120 }); break;
    case 'blanket': C.blanket!.tuck = 1; sfx.rustle(); if (!C.sleep) { G.hs.mouth = 1; sfx.giggle(0.9); } else C.stir = 0.9; break;
    case 'shower': C.shower = Math.min(4, C.shower + 1.2); sfx.splash(); burst(x, y + Rr * 0.1, 'spark', 6, { color: '#9fdcff', speed: 160 }); break;
    case 'sun': C.sunLaugh = 0.8; C.morning = Math.min(C.morning, 1.5); sfx.giggle(1.3); burst(x, y, 'spark', 8, { color: '#ffe27a', speed: 200 }); break;
  }
}
/** Тап по самому сердцу во время ухода. Вернуть true, если обработано (например, спит — сонно моргает) */
export function careHeartTap(): boolean {
  if (!C.sleep) return false;
  if (C.stir > 1.0) {
    C.stir = 0; snd.mumble(); G.hs.swingV += 1;
    const { x, y, R: Rr } = G.heart;
    addP({ kind: 'z', x: x + 0.45 * Rr, y: y - 0.5 * Rr, vx: 25 * S, vy: -40 * S, life: 1.8, size: Math.max(16, Rr * 0.13), color: '#fff6c0', rot: 0, vr: 0, g: 0 });
  }
  return true;
}
