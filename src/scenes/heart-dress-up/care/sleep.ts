// Уход — сон: луна (уложить; по спящему не будит), мишка, ночник со звёздочками на потолке, одеяльце,
// шкатулка с колыбельной; солнышко — утро по шагам (~3 с): ночь светлеет, предметы по очереди уходят,
// сердце потягивается, солнышко уплывает. Уход из раздела — тихое пробуждение без солнышка.
import { AC, soundOn, tone } from '../../../core/audio';
import { H, S, TAU, W, ctx, pick, rand, t } from '../../../core/canvas';
import { circle, ell, starPath } from '../../../core/draw';
import { addP, burst } from '../../../core/particles';
import { clamp01, ease } from '../../../core/tween';
import { Live } from '../heart';
import { Xf } from '../reactions';
import { PENTA, sfx } from '../sounds';
import { G } from '../state';
import { moon, smallHeart, sparkleStar, sun } from '../things';
import { CareSection, Hit, INK, Leaving, OUT, R, floorY, happy, here, iconBg, leave, near, shared, sideX, stay, tickLeaving } from './section';

type Star = { u: number; v: number; s: number; tw: number; ph: number };

const Z = {
  sleep: false, sleepT: 0, night: 0, stir: 9, zT: 0,
  /** просыпается: время с начала потягушек (9 — не идёт, < 0 — ещё ждёт своего шага утра); loud — с «доброе утро» */
  wake: 9, wakeLoud: true,
  /** утро по шагам (время с солнышка, 9 — нет утра) */
  morning: 9, sunLaugh: 0,
  teddy: null as null | ({ t: number; hug: number; wave: number } & Leaving),
  lamp: null as null | ({ t: number; hue: number; stars: Star[] } & Leaving),
  blanket: null as null | ({ t: number; tuck: number } & Leaving),
  box: null as null | ({ t: number; spin: number; boost: number } & Leaving),
};

const snd = {
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

const teddyS = () => Math.max(36, R() * 0.26);
const teddyPos = (): [number, number] => [sideX(1, 0.8, teddyS() * 0.9), floorY()];
const boxS = () => Math.max(30, R() * 0.2);
const boxPos = (): [number, number] => [sideX(-1, 0.62, boxS() * 0.8), floorY()];
const lampS = () => Math.max(30, R() * 0.15);
/** ночник висит на шнурке слева вверху, у левого «плеча» сердца */
const lampPos = (): [number, number] => { const s = lampS(); return [Math.max(G.HR.x + s * 1.4, G.heart.x - 1.0 * R()), Math.max(G.HR.y + s * 2.6, G.heart.y - 0.72 * R())]; };
function starPos(st: Star): [number, number] { const A = G.HR, u = ((st.u + (Z.lamp ? Z.lamp.t : 0) * 0.008) % 1 + 1) % 1; return [A.x + 0.04 * A.w + u * A.w * 0.92, A.y + st.v * A.h]; }
const starS = (st: Star) => Math.max(9, R() * 0.06) * st.s;
/** Шаги утра (сек. от тапа по солнышку) */
const M = { box: 0.35, lamp: 0.8, stretch: 1.25, teddyWave: 1.9, teddy: 2.45, sunGo: 2.6, end: 3.3 };
const sunR = () => Math.max(32, R() * 0.2);
/** Солнышко «доброго утра» выглядывает справа вверху (под кнопкой звука, если она в области сердца) и в конце уплывает */
function sunPos(): [number, number] {
  const r = sunR(), m = Z.morning, k = ease.outBack(clamp01(m / 0.8)), A = G.HR, sd = G.zones.sound;
  const below = sd && sd.y - sd.r < A.y + r * 3.5 && sd.x > A.x + A.w * 0.5 ? sd.y + sd.r + r * 0.3 : A.y;
  const go = ease.inOut(clamp01((m - M.sunGo) / (M.end - M.sunGo)));
  return [A.x + A.w - r * 1.9 + go * r * 3.2, Math.max(A.y, below) + r * 1.8 + (1 - k) * r * 2 - go * r * 2.6];
}

// ---------------- КОЛЫБЕЛЬНАЯ ----------------
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
/** Полумесяц: круг с вырезанным кругом */
function crescent(x: number, y: number, r: number, col = '#ffe27a') {
  ctx.save(); ctx.beginPath(); ctx.rect(x - 2 * r, y - 2 * r, 4 * r, 4 * r); ctx.moveTo(x + 0.5 * r + r, y - 0.3 * r); ctx.arc(x + 0.5 * r, y - 0.3 * r, r, 0, TAU); ctx.clip('evenodd');
  ctx.fillStyle = col; circle(x, y, r); ctx.restore();
}


// ---------------- ДЕЙСТВИЯ ----------------
function goSleep() {
  if (Z.morning < 9) { const [sx, sy] = sunPos(); burst(sx, sy, 'spark', 10, { color: '#ffe27a', speed: 180 }); } // солнышко сразу прячется
  Z.sleep = true; Z.sleepT = 0; Z.stir = 9; Z.wake = 9; Z.morning = 9; Z.zT = 0.8;
  snd.yawn(); snd.sleepy();
}
/** Утро по шагам (~3 с): солнышко выглядывает, ночь светлеет, шкатулка закрывается, ночник уезжает,
 *  сердце потягивается и сбрасывает одеяло, мишка машет и уходит, солнышко уплывает за край */
function morning() {
  const was = Z.sleep;
  Z.sleep = false; Z.stir = 9; Z.morning = 0; Z.sunLaugh = 0;
  Z.wake = was ? -M.stretch : 9; Z.wakeLoud = true;
  sfx.tinkle();
}
/** Тихо проснуться без солнышка (ушли из раздела, палочка, праздник): предметы плавно уезжают */
function exit() {
  if (Z.sleep) { Z.wake = 0; Z.wakeLoud = false; }
  Z.sleep = false; Z.stir = 9; Z.morning = 9;
  leave(Z.teddy); leave(Z.lamp); leave(Z.blanket); leave(Z.box);
}
/** Спящее сердце сонно моргает и бормочет (тап по нему или по луне) */
function stir() {
  if (Z.stir <= 1.0) return;
  Z.stir = 0; snd.mumble(); G.hs.swingV += 1;
  const { x, y, R: Rr } = G.heart;
  addP({ kind: 'z', x: x + 0.45 * Rr, y: y - 0.5 * Rr, vx: 25 * S, vy: -40 * S, life: 1.8, size: Math.max(16, Rr * 0.13), color: '#fff6c0', rot: 0, vr: 0, g: 0 });
}
function act(k: string) {
  if (k === 'moon') { if (Z.sleep) stir(); else goSleep(); } // луна по спящему не будит
  else if (k === 'teddy') {
    if (here(Z.teddy)) { const [tx, ty] = teddyPos(); Z.teddy = null; sfx.poof(); burst(tx, ty - teddyS() * 1.4, 'smoke', 6, { color: '#fff', speed: 120, size: 16 }); }
    else { Z.teddy = { t: 0, hug: 0, wave: 9 }; snd.hug(); G.hs.love = Math.max(G.hs.love, 1.2); }
  } else if (k === 'nightlight') {
    if (here(Z.lamp)) { leave(Z.lamp); snd.click(); }
    else {
      const stars: Star[] = []; for (let i = 0; i < 11; i++) stars.push({ u: (i + rand(0.1, 0.9)) / 11, v: rand(0.05, 0.32), s: rand(0.7, 1.3), tw: 0, ph: rand(0, TAU) });
      Z.lamp = { t: 0, hue: 0, stars }; snd.click(); sfx.tinkle();
    }
  } else if (k === 'blanket') {
    if (here(Z.blanket)) { leave(Z.blanket); sfx.rustle(); }
    else { Z.blanket = { t: 0, tuck: 0 }; sfx.rustle(); if (!Z.sleep) happy(); }
  } else if (k === 'lullaby') {
    if (here(Z.box)) leave(Z.box); else Z.box = { t: 0, spin: 0, boost: 0 };
    snd.click();
  } else if (k === 'sun') {
    if (Z.morning < 9) { Z.sunLaugh = 0.8; sfx.giggle(1.3); } // утро уже идёт — солнышко хихикает, но не задерживается
    else morning();
  }
}
function sel(k: string) {
  if (k === 'moon') return Z.sleep;
  if (k === 'teddy') return here(Z.teddy);
  if (k === 'nightlight') return here(Z.lamp);
  if (k === 'blanket') return here(Z.blanket);
  if (k === 'lullaby') return here(Z.box);
  return false;
}

// ---------------- ОБНОВЛЕНИЕ ----------------
function update(dt: number) {
  const hs = G.hs, { x: hx, y: hy } = G.heart, Rr = R();
  Z.night += ((Z.sleep && !G.finale ? 1 : 0) - Z.night) * Math.min(1, dt * 1.5);
  if (Z.sleep) {
    Z.sleepT += dt; Z.stir += dt; Z.zT -= dt;
    if (Z.zT <= 0 && Z.sleepT > 0.8) {
      Z.zT = 1.1;
      const z = Math.random() < 0.65;
      addP({ kind: z ? 'z' : 'spark', x: hx + 0.5 * Rr, y: hy - 0.55 * Rr, vx: rand(15, 35) * S, vy: -rand(30, 45) * S, life: 2.4, size: Math.max(16, Rr * (z ? 0.16 : 0.07)), color: z ? '#fff6c0' : '#ffe27a', rot: 0, vr: z ? 0 : 1.5, g: 0 });
    }
  }
  // утро по шагам
  if (Z.morning < 9) {
    const p = Z.morning; Z.morning += dt;
    const at = (x: number) => p < x && Z.morning >= x;
    if (at(M.box) && here(Z.box)) { leave(Z.box); snd.click(); }
    if (at(M.lamp) && here(Z.lamp)) { leave(Z.lamp); snd.click(); }
    if (at(M.stretch)) {
      if (here(Z.blanket)) { leave(Z.blanket); sfx.rustle(); }
      if (Z.wake === 9) { snd.morning(); happy(true); } // и не спал — просто «доброе утро»
    }
    if (at(M.teddyWave) && Z.teddy && here(Z.teddy)) { Z.teddy.wave = 0; snd.hug(); }
    if (at(M.teddy) && here(Z.teddy)) leave(Z.teddy);
    if (Z.morning > M.end) Z.morning = 9;
  }
  // просыпается: потягушки (wake < 0 — ещё ждёт своего шага утра)
  if (Z.wake < 9) {
    const prev = Z.wake; Z.wake += dt;
    if (prev < 0 && Z.wake >= 0) snd.yawn();
    if (Z.wakeLoud && prev < 1.0 && Z.wake >= 1.0) { snd.morning(); hs.jT = 0; hs.mouth = 1; burst(hx, hy - Rr * 0.5, 'spark', 14, { color: '#fff6a8', speed: 240 }); burst(hx, hy - Rr * 0.3, 'heart', 6, { up: -80, speed: 160 }); }
    if (Z.wake > 2.2) Z.wake = 9;
  }
  Z.sunLaugh = Math.max(0, Z.sunLaugh - dt);
  // предметы; уходящие доигрывают и исчезают
  if (Z.teddy) { Z.teddy.t += dt; Z.teddy.hug += dt; Z.teddy.wave += dt; }
  if (Z.lamp) { Z.lamp.t += dt; for (const s of Z.lamp.stars) s.tw = Math.max(0, s.tw - dt * 1.2); }
  if (Z.blanket) { Z.blanket.t += dt; Z.blanket.tuck = Math.max(0, Z.blanket.tuck - dt * 2); }
  if (Z.box) {
    const Bx = Z.box; Bx.t += dt; Bx.boost = Math.max(0, Bx.boost - dt); Bx.spin += dt * (Bx.out == null ? 2 + Bx.boost * 6 : 0.5);
    if (Bx.out == null && (Bx.t * 1.2 | 0) !== ((Bx.t - dt) * 1.2 | 0)) { const [bx, by] = boxPos(); addP({ kind: 'note', x: bx + rand(-10, 10) * S, y: by - boxS() * 1.6, vx: rand(-20, 20) * S, vy: -40 * S, life: 1.8, size: Math.max(18, 26 * S), color: pick(['#ffd6ea', '#bfe8ff', '#fff6a8']), rot: 0, vr: 0, g: 0 }); }
  }
  tickLeaving(Z, ['teddy', 'lamp', 'blanket', 'box'], dt);
  // колыбельная — только вечером в разделе сна: днём (с солнышком) и в чужих разделах молчит
  updLullaby(G.started && !G.finale && Z.morning === 9 && (Z.sleep || here(Z.box)), here(Z.box));
}

// ---------------- РИСОВАНИЕ ----------------
function drawFront() {
  const { x: hx, y: hy } = G.heart, Rr = R();
  // одеяльце — в координатах сердца; уходя, сползает вниз и тает
  if (Z.blanket) { ctx.save(); ctx.translate(hx, hy + shared.dy + (1 - stay(Z.blanket)) * Rr * 0.4); blanket(Rr, ease.out(clamp01(Z.blanket.t / 0.5)) * stay(Z.blanket), Z.blanket.tuck); ctx.restore(); }
  if (Z.morning < 9) { // солнышко выглядывает и уплывает
    const [sx, sy] = sunPos(), a = 1 - clamp01((Z.morning - (M.end - 0.35)) / 0.35);
    ctx.save(); ctx.globalAlpha *= a; sun(sx, sy, sunR(), t * 0.4 + Z.sunLaugh * 6, Z.sunLaugh > 0 ? 1 : 0); ctx.restore();
  }
  // уходя: ночник уезжает вверх, мишка — вбок, шкатулка закрывается и прячется
  if (Z.lamp) { const [lx, ly] = lampPos(), k = ease.outBack(clamp01(Z.lamp.t / 0.4)), o = 1 - stay(Z.lamp); lamp(lx, ly - (1 - k) * lampS() * 2 - ease.in(o) * (ly - G.HR.y + lampS() * 2), lampS(), Z.lamp.hue, o < 0.3, G.HR.y); }
  if (Z.teddy) {
    const Td = Z.teddy, [tx, ty] = teddyPos(), k = ease.outBack(clamp01(Td.t / 0.4)), h = Td.hug < 1.2 ? Math.sin(Td.hug / 1.2 * Math.PI) : 0, o = 1 - stay(Td);
    ctx.save(); ctx.globalAlpha *= 1 - o;
    teddy(tx - h * Rr * 0.08 + ease.in(o) * Rr * 0.9, ty - Math.abs(Math.sin(o * 9)) * Rr * 0.04, teddyS() * Math.max(0.01, k), Z.sleep && Z.sleepT > 0.7, h, Td.hug < 1.2 || Td.wave < 0.7 || o > 0 ? 1 : 0);
    ctx.restore();
  }
  if (Z.box) {
    const Bx = Z.box, [bx, by] = boxPos(), k = ease.outBack(clamp01(Bx.t / 0.4)), o = Bx.out == null ? 0 : Bx.out;
    musicBox(bx, by, boxS() * Math.max(0.01, k * clamp01((OUT - o) / 0.25)), Bx.spin, clamp01(Bx.t / 0.6) * (1 - clamp01(o / 0.25)));
  }
}
/** Ночное затемнение и свет ночника со звёздочками на «потолке» */
function drawOverlay() {
  const n = Z.night, { x: hx, y: hy } = G.heart, Rr = R();
  if (n > 0.01) {
    const g = ctx.createRadialGradient(hx, hy, Rr * 0.3, hx, hy, Math.max(W, H) * 0.8);
    g.addColorStop(0, `rgba(24,20,80,${0.22 * n})`); g.addColorStop(1, `rgba(16,12,58,${0.62 * n})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (Z.lamp) { // уходя — гаснут
    const L = Z.lamp, [lx, ly] = lampPos(), s = lampS(), [c0] = LAMP_HUES[L.hue % LAMP_HUES.length], on = clamp01(L.t / 0.6) * stay(L);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= on;
    const g = ctx.createRadialGradient(lx, ly, s * 0.2, lx, ly, s * 4.5); g.addColorStop(0, c0 + '66'); g.addColorStop(1, c0 + '00');
    ctx.fillStyle = g; circle(lx, ly, s * 4.5);
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(G.HR.x, G.HR.y, G.HR.w, G.HR.h); ctx.clip();
    ctx.globalAlpha *= on * (0.55 + 0.45 * n);
    for (const st of L.stars) { const [x, y] = starPos(st), sz = starS(st) * (1 + st.tw * 0.8); sparkleStar(x, y, sz * (0.85 + 0.15 * Math.sin(t * 2 + st.ph)), t * 0.3 + st.ph, st.tw > 0 ? '#ffffff' : c0); }
    ctx.restore();
  }
}
/** Глаза закрыты во сне, сонно моргает, потягивается и зевает */
function live(L: Live) {
  if (Z.sleep) {
    if (Z.sleepT < 0.8) { L.mouth = Math.max(L.mouth, Math.sin(clamp01(Z.sleepT / 0.8) * Math.PI)); L.blink = Math.max(L.blink, Z.sleepT / 0.8); }
    else if (Z.stir < 1.4) { // сонно моргнул и бормочет
      const p = Z.stir; L.blink = p > 0.25 && p < 0.8 ? 0.55 : 1; L.mouth = p < 1.1 ? 0.15 + 0.15 * Math.abs(Math.sin(p * 9)) : 0;
    } else L.blink = 1;
    L.love = Math.min(L.love, 0.4);
  }
  if (Z.wake < 9) {
    const p = Z.wake;
    if (p < 0.6) L.blink = 1; else if (p < 0.9) L.blink = 0.5;
    if (p >= 0 && p < 0.95) L.mouth = Math.max(L.mouth, Math.sin(clamp01(p / 0.95) * Math.PI)); // зевает
  }
}
function xform(X: Xf, Rr: number) {
  if (Z.sleep || Z.wake < 0) { const b = Math.sin(t * 1.7); X.sy *= 1 + 0.03 * b; X.sx *= 1 - 0.012 * b; X.rot += Math.sin(t * 0.85) * 0.015; }
  if (Z.wake >= 0 && Z.wake < 0.95) { const k = Math.sin(clamp01(Z.wake / 0.95) * Math.PI); X.sy *= 1 + 0.12 * k; X.sx *= 1 - 0.07 * k; X.dy -= 0.04 * Rr * k; X.rot += Math.sin(Z.wake * 7) * 0.04 * k; }
  if (Z.teddy && Z.teddy.hug < 1.2) { const k = Math.sin(Z.teddy.hug / 1.2 * Math.PI); X.rot += 0.12 * k; X.sx *= 1 + 0.04 * k; }
  if (Z.blanket && Z.blanket.tuck > 0) { X.sx *= 1 + 0.03 * Z.blanket.tuck; X.sy *= 1 - 0.03 * Z.blanket.tuck; }
}

// ---------------- ТАПЫ ----------------
function hit(x: number, y: number): Hit | null {
  const Rr = R();
  if (here(Z.teddy)) { const [tx, ty] = teddyPos(), s = teddyS(); if (Math.abs(x - tx) < Math.max(32, s * 0.85) && y < ty + 6 && y > ty - Math.max(64, s * 2.4)) return { what: 'teddy' }; }
  if (here(Z.box)) { const [bx, by] = boxPos(), s = boxS(); if (near(x, y, bx, by - 0.8 * s, s * 1.0)) return { what: 'box' }; }
  if (here(Z.lamp)) { const [lx, ly] = lampPos(), s = lampS(); if (near(x, y, lx, ly, s * 1.1)) return { what: 'lamp' }; }
  if (here(Z.blanket)) { const top = G.heart.y + shared.dy + 0.4 * Rr; if (y > top && y < G.heart.y + 1.12 * Rr && Math.abs(x - G.heart.x) < 1.12 * Rr) return { what: 'blanket' }; }
  if (Z.morning < 9) { const [sx, sy] = sunPos(); if (near(x, y, sx, sy, sunR() * 1.3)) return { what: 'sun' }; }
  if (Z.lamp && here(Z.lamp)) for (const st of Z.lamp.stars) { const [sx, sy] = starPos(st); if (near(x, y, sx, sy, starS(st) * 1.4)) return { what: 'star', o: st }; }
  return null;
}
function tap(h: Hit, x: number, y: number) {
  switch (h.what) {
    case 'teddy': Z.teddy!.hug = 0; snd.hug(); G.hs.love = Math.max(G.hs.love, 1); burst(x, y, 'heart', 6, { up: -80, speed: 140, color: '#ff7aa8' }); break;
    case 'box': Z.box!.boost = 1.2; snd.twinkle(); burst(x, y, 'spark', 5, { color: '#fff6a8', speed: 140 }); break;
    case 'lamp': Z.lamp!.hue++; snd.click(); for (const s of Z.lamp!.stars) s.tw = 0.6; break;
    case 'star': h.o.tw = 1; snd.twinkle(); burst(x, y, 'spark', 5, { color: '#fff6a8', speed: 120 }); break;
    case 'blanket': Z.blanket!.tuck = 1; sfx.rustle(); if (!Z.sleep) { G.hs.mouth = 1; sfx.giggle(0.9); } else Z.stir = 0.9; break;
    case 'sun': Z.sunLaugh = 0.8; sfx.giggle(1.3); burst(x, y, 'spark', 8, { color: '#ffe27a', speed: 200 }); break; // хихикает, но утро не затягивает
  }
}

// ---------------- ЗНАЧКИ ----------------
const BG_NIGHT: [string, string] = ['#3a3184', '#1f1a52'];
function optIcon(k: string, r: number) {
  if (k === 'sun') { iconBg(r, '#fff3c4', '#ffc4dd'); sun(0, r * 0.05, r * 0.4, t * 0.4, 0); return; }
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
/** Полумесяц и звёзды на ночном небе */
function icon(r: number) {
  iconBg(r, ...BG_NIGHT);
  crescent(-r * 0.1, r * 0.02, r * 0.5);
  ctx.fillStyle = '#fff6c0'; for (const [x, y, s] of [[0.5, -0.45, 0.16], [0.55, 0.35, 0.11], [-0.55, -0.5, 0.09], [0.2, -0.05, 0.08]]) { ctx.save(); ctx.translate(x * r, y * r); starPath(5, s * r, s * r * 0.45); ctx.fill(); ctx.restore(); }
}

export const sleep: CareSection = {
  id: 'sleep', state: Z, icon, optIcon, sel,
  act: k => act(k), exit, update, drawFront, drawOverlay, hit, tap, live, xform,
  heartTap() { if (!Z.sleep) return false; stir(); return true; },
};
