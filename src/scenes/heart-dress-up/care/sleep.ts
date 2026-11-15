// Уход — сон по модели «место → нужда → предметы → развязка».
// Место: при входе вечер (лёгкое затемнение) и кроватка-подушка под сердцем; сердце зевает.
// Нужда «сонливость» 0..1: её копят уютные предметы (одеяло, мишка, шкатулка, ночник), видно по векам и зевкам;
// при ≥ 0.8 сердце засыпает само, луна — короткий путь. Предмет-«друг» живёт до выхода; повторный тап по кнопке
// предмета = тап по самому предмету (таблица «предмет × бодрствует/спит» — в act/tap ниже, пустых клеток нет).
// Развязка: солнышко — утро по шагам (~3 с), предметы по очереди уходят. След: ~60 с «выспалось» (traces.rested) —
// глаза блестят, сердце бодрое, в любом разделе. Уход из раздела — тихое пробуждение, всё уезжает.
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
import { CareSection, Hit, INK, Leaving, OUT, R, floorY, happy, here, iconBg, leave, near, sideX, stay, tickLeaving, traces } from './section';

type Star = { u: number; v: number; s: number; tw: number; ph: number };
type Cozy = 'blanket' | 'teddy' | 'lullaby' | 'nightlight';

/** Сколько сонливости даёт уютный предмет (один раз за вечер) */
const DROWSY: Record<Cozy, number> = { blanket: 0.3, teddy: 0.2, lullaby: 0.3, nightlight: 0.2 };
/** Засыпает само */
const ASLEEP_AT = 0.8;
/** Пока предметы рядом, сонливость понемногу растёт (в секунду на предмет; шкатулка — сильнее) */
const CREEP = 0.012;
/** Сколько секунд «выспалось» после сна; сколько надо поспать, чтобы выспаться */
const RESTED = 60, SLEPT = 2;
const YAWN = 1.3, DREAM = 4;
/** Порядок снов: любимая еда, уточка, мишка, звёздочки (картинки кладут разделы в traces.dreams) */
const DREAM_ORDER = ['food', 'duck', 'teddy', 'stars'];

const Z = {
  sleep: false, sleepT: 0, night: 0, stir: 9, zT: 0,
  /** просыпается: время с начала потягушек (9 — не идёт, < 0 — ещё ждёт своего шага утра); loud — с «доброе утро» */
  wake: 9, wakeLoud: true,
  /** утро по шагам (время с солнышка, 9 — нет утра) */
  morning: 9, sunLaugh: 0,
  /** место: мы в разделе (вечер, кроватка); day — после утра вечер не возвращается, пока не позовут луну или предмет */
  here: false, day: false,
  /** вечер 0..1 (плавно) */
  eve: 0,
  /** сонливость 0..1; lid — насколько опущены веки (плавно за сонливостью) */
  drowsy: 0, lid: 0,
  /** какие предметы уже дали сонливость в этот вечер */
  gave: {} as Record<string, boolean>,
  /** зевок: время с начала (9 — нет); nextYawn — через сколько следующий */
  yawn: 9, nextYawn: 9,
  /** луна на небе подмигивает: время с начала (9 — нет) */
  wink: 9,
  /** облачко-сон: что снится (ключ картинки) и сколько уже показывается */
  dream: null as null | { k: string; t: number },
  dreamI: 0,
  /** громкость колыбельной сейчас (0 — молчит; во сне тише) — для тестов */
  lull: 0,
  /** «выспалось»: открыты ли глаза (блестят только открытые) и таймер искорок */
  eyesOpen: true, restT: 0,
  bed: null as null | ({ t: number } & Leaving),
  teddy: null as null | ({ t: number; hug: number; wave: number; nuz: number; zT: number } & Leaving),
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
  /** мишка во сне прижимается: тихое «м-м» */
  snuggle() { tone(220, 0.4, { type: 'triangle', slide: 196, vol: 0.06, attack: 0.1 }); tone(330, 0.3, { vol: 0.025, delay: 0.25, attack: 0.08 }); },
  click() { tone(1500, 0.03, { type: 'square', vol: 0.04 }); tone(880, 0.3, { vol: 0.06, delay: 0.05 }); },
  twinkle(v = 1) { const f = pick(PENTA) * 2; tone(f, 0.6, { vol: 0.05 * v }); tone(f * 1.5, 0.4, { vol: 0.025 * v, delay: 0.08 }); },
  /** луна подмигнула, приплыл сон: мягкий перелив вверх */
  dream() { [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.7, { vol: 0.035, delay: i * 0.13, attack: 0.05 })); },
};

// ---------------- ГДЕ ЧТО ----------------
const teddyS = () => Math.max(30, R() * 0.2);
const boxS = () => Math.max(26, R() * 0.17);
/** x сбоку от кончика сердца на кроватке: не под палочкой и хлопушкой, если они на той же высоте (в портрете они ниже),
 *  и не за краем области сердца; h — высота предмета над полом */
function bedSideX(dir: number, k: number, half: number, h: number) {
  const fy = floorY(), z = G.zones;
  if ([z.wand, z.party].some(b => b && b.y - b.r < fy && b.y + b.r > fy - h)) return sideX(dir, k, half);
  const A = G.HR;
  return Math.min(Math.max(G.heart.x + dir * k * R(), A.x + half), A.x + A.w - half);
}
/** мишка справа и шкатулка слева от кончика сердца, на кроватке */
const teddyPos = (): [number, number] => [bedSideX(1, 0.72, teddyS() * 0.78, teddyS() * 2.7), floorY()];
const boxPos = (): [number, number] => [bedSideX(-1, 0.66, boxS() * 0.95, boxS() * 1.6), floorY()];
const lampS = () => Math.max(30, R() * 0.15);
/** ночник висит на шнурке слева вверху, у левого «плеча» сердца */
const lampPos = (): [number, number] => { const s = lampS(); return [Math.max(G.HR.x + s * 1.4, G.heart.x - 1.0 * R()), Math.max(G.HR.y + s * 2.6, G.heart.y - 0.72 * R())]; };
function starPos(st: Star): [number, number] { const A = G.HR, u = ((st.u + (Z.lamp ? Z.lamp.t : 0) * 0.008) % 1 + 1) % 1; return [A.x + 0.04 * A.w + u * A.w * 0.92, A.y + st.v * A.h]; }
const starS = (st: Star) => Math.max(9, R() * 0.06) * st.s;
/** Полуширина кроватки: не шире 1R и не залезает под палочку/хлопушку, если они на её высоте */
function bedHalf() {
  const Rr = R(), hx = G.heart.x, fy = floorY(), z = G.zones; let w = 1.0 * Rr;
  for (const b of [z.wand, z.party]) if (b && b.y - b.r < fy + 0.14 * Rr) w = Math.min(w, Math.abs(b.x - hx) - b.r * 1.1);
  return Math.max(0.62 * Rr, w);
}
/** Шаги утра (сек. от тапа по солнышку) */
const M = { box: 0.35, lamp: 0.8, stretch: 1.25, teddyWave: 1.9, teddy: 2.45, sunGo: 2.6, end: 3.3 };
const sunR = () => Math.max(32, R() * 0.2);
/** Где на небе светило: справа вверху (под кнопкой звука, если она в области сердца) */
function skyPos(): [number, number] {
  const r = sunR(), A = G.HR, sd = G.zones.sound;
  const below = sd && sd.y - sd.r < A.y + r * 3.5 && sd.x > A.x + A.w * 0.5 ? sd.y + sd.r + r * 0.3 : A.y;
  return [A.x + A.w - r * 1.9, Math.max(A.y, below) + r * 1.8];
}
/** Солнышко «доброго утра» выглядывает и в конце уплывает */
function sunPos(): [number, number] {
  const r = sunR(), m = Z.morning, k = ease.outBack(clamp01(m / 0.8)), [x, y] = skyPos();
  const go = ease.inOut(clamp01((m - M.sunGo) / (M.end - M.sunGo)));
  return [x + go * r * 3.2, y + (1 - k) * r * 2 - go * r * 2.6];
}
/** Луна на небе ночью: поднимается, пока темнеет, и опускается утром */
function moonPos(): [number, number] { const r = sunR(), [x, y] = skyPos(); return [x - r * 0.4, y + (1 - ease.out(clamp01(Z.night))) * r * 1.6]; }
/** Облачко-сон — над головой сердца (не выше области сердца) */
const dreamR = () => Math.max(42, R() * 0.3);
function dreamPos(): [number, number] { const rc = dreamR(); return [G.heart.x + 0.08 * R(), Math.max(G.HR.y + rc * 1.05, G.heart.y - 0.86 * R())]; }

// ---------------- КОЛЫБЕЛЬНАЯ ----------------
// Своя мелодия на пентатонике, на 3 счёта; полутоны от до 5-й октавы, null — пауза
const LULL: (number | null)[] = [7, 4, 2, 4, null, 0, 2, 4, 7, 9, null, 7, 4, 2, 0, 2, null, null, 7, 9, 12, 9, null, 7, 4, 7, 4, 2, null, 0, 2, 4, 2, 0, null, null];
const LBASS = [0, -5, -3, -5];
let li = 0, lNext = 0;
const LSTEP = 0.42;
/** vol — множитель громкости (во сне тише), bells — подголосок колокольчиком */
function updLullaby(vol: number, bells: boolean) {
  if (!AC || !soundOn || vol <= 0) { lNext = 0; li = 0; return; }
  const now = AC.currentTime;
  if (lNext < now || lNext > now + 5) lNext = now + 0.2;
  while (lNext < now + 0.4) {
    const n = LULL[li];
    if (n !== null) {
      const f = 523.25 * Math.pow(2, n / 12);
      tone(f, 1.3, { vol: 0.055 * vol, at: lNext, attack: 0.02 });
      if (bells) tone(f * 2, 0.6, { type: 'triangle', vol: 0.018 * vol, at: lNext });
    }
    if (li % 6 === 0) tone(130.8 * Math.pow(2, LBASS[(li / 6) % 4] / 12), LSTEP * 5.5, { vol: 0.06 * vol, at: lNext, attack: 0.1 });
    lNext += LSTEP; li = (li + 1) % LULL.length;
  }
}

// ---------------- РИСОВАЛКИ ----------------
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
/** Полумесяц: круг с вырезанным кругом */
function crescent(x: number, y: number, r: number, col = '#ffe27a') {
  ctx.save(); ctx.beginPath(); ctx.rect(x - 2 * r, y - 2 * r, 4 * r, 4 * r); ctx.moveTo(x + 0.5 * r + r, y - 0.3 * r); ctx.arc(x + 0.5 * r, y - 0.3 * r, r, 0, TAU); ctx.clip('evenodd');
  ctx.fillStyle = col; circle(x, y, r); ctx.restore();
}
/** Полуширина сердца на высоте fy (в долях R) — по нижней дуге heartShape */
function heartHalfW(fy: number) {
  let w = 1;
  for (let i = 0; i <= 24; i++) {
    const s = i / 24, u = 1 - s, y = -0.4 * u * u * u + 0.3 * u * u * s + 1.65 * u * s * s + 0.95 * s * s * s;
    if (y > fy) break;
    w = u * u * u + 3.15 * u * u * s + 1.35 * u * s * s;
  }
  return w;
}
/** Одеяльце-чаша по низу сердца (в координатах сердца: центр (0,0), радиус Rr): чуть шире сердца, с отвёрнутым краем */
function blanket(Rr: number, up: number, tuck: number) {
  const top = (0.42 + (1 - up) * 0.7) * Rr - tuck * 0.04 * Rr + Math.sin(t * 1.7) * 0.01 * Rr, bot = 1.1 * Rr;
  const w = heartHalfW(top / Rr) * 1.1 * Rr + 0.04 * Rr, d = bot - top;
  const shape = () => {
    ctx.beginPath(); ctx.moveTo(-w, top);
    ctx.lineTo(w, top);
    ctx.bezierCurveTo(w * 0.95, top + d * 0.4, w * 0.45, bot, 0, bot);
    ctx.bezierCurveTo(-w * 0.45, bot, -w * 0.95, top + d * 0.4, -w, top);
    ctx.closePath();
  };
  ctx.save(); ctx.globalAlpha *= clamp01(up * 2); ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(40,60,120,0.18)'; ctx.save(); ctx.translate(0, 0.03 * Rr); shape(); ctx.fill(); ctx.restore();
  shape(); ctx.fillStyle = '#9fd4ff'; ctx.fill();
  ctx.save(); ctx.clip();
  // лоскутки в клетку и сердечки
  const cs = 0.26 * Rr;
  for (let j = 0; j < 4; j++) for (let i = -5; i <= 5; i++) {
    if ((i + j + 20) % 2 === 0) { ctx.fillStyle = '#c4e4ff'; ctx.fillRect(i * cs - cs / 2, top + 0.12 * Rr + j * cs, cs, cs); }
    else smallHeart(i * cs, top + 0.12 * Rr + j * cs + cs / 2, cs * 0.22, '#ff9ec7');
  }
  ctx.restore();
  shape(); ctx.strokeStyle = '#5aa8e8'; ctx.lineWidth = 0.025 * Rr; ctx.stroke();
  // отвёрнутый край
  const hw = w + 0.04 * Rr, ch = 0.15 * Rr;
  ctx.fillStyle = '#ffffff'; ctx.lineWidth = 0.022 * Rr;
  ctx.beginPath(); ctx.roundRect(-hw, top - 0.05 * Rr, 2 * hw, ch, ch * 0.45); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,158,199,0.9)'; ctx.lineWidth = 0.02 * Rr; ctx.setLineDash([0.05 * Rr, 0.04 * Rr]);
  ctx.beginPath(); ctx.moveTo(-hw + 0.06 * Rr, top + 0.025 * Rr); ctx.lineTo(hw - 0.06 * Rr, top + 0.025 * Rr); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
}
/** Кроватка-подушка: (x, y) — середина верха, hw — полуширина, h — толщина */
function bedPillow(x: number, y: number, hw: number, h: number) {
  ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(80,40,110,0.16)'; ell(0, h * 0.95, hw * 1.02, h * 0.5); // тень
  // матрасик
  ctx.fillStyle = '#c9a7ff'; ctx.strokeStyle = '#8a6ad0'; ctx.lineWidth = Math.max(1.5, h * 0.06);
  ctx.beginPath(); ctx.roundRect(-hw, -h * 0.1, 2 * hw, h, h * 0.45); ctx.fill(); ctx.stroke();
  // пухлая подушка сверху
  const g = ctx.createLinearGradient(0, -h * 0.6, 0, h * 0.4); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#eadcff');
  ctx.fillStyle = g; ctx.strokeStyle = '#b79ae6';
  ctx.beginPath(); ctx.moveTo(-hw * 0.96, 0);
  ctx.bezierCurveTo(-hw * 0.98, -h * 0.75, hw * 0.98, -h * 0.75, hw * 0.96, 0);
  ctx.bezierCurveTo(hw * 0.98, h * 0.5, -hw * 0.98, h * 0.5, -hw * 0.96, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  // пуговки-стёжки
  ctx.fillStyle = '#ff9ec7'; for (const k of [-0.6, 0, 0.6]) circle(k * hw, -h * 0.08, h * 0.08);
  ctx.restore();
}
/** Облачко мысли: (x, y) — центр, r — радиус; a — видимость */
function dreamCloud(x: number, y: number, r: number) {
  const puffs: [number, number, number][] = [[0, 0.05, 0.78], [-0.62, 0.15, 0.5], [0.62, 0.15, 0.5], [-0.32, -0.45, 0.52], [0.34, -0.42, 0.56]];
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#c9b5f0'; for (const [px, py, pr] of puffs) circle(px * r, py * r, pr * r + Math.max(2, r * 0.05));
  ctx.fillStyle = '#ffffff'; for (const [px, py, pr] of puffs) circle(px * r, py * r, pr * r);
  ctx.restore();
}
/** Картинка-сон «звёздочки» (по умолчанию) */
function starsPic(r: number) {
  ctx.fillStyle = '#3a3184'; circle(0, 0, r);
  crescent(-r * 0.2, r * 0.05, r * 0.45);
  sparkleStar(r * 0.45, -r * 0.4, r * 0.2, t * 0.6, '#fff6a8'); sparkleStar(r * 0.5, r * 0.35, r * 0.14, -t * 0.5, '#ffd6ea'); sparkleStar(-r * 0.5, -r * 0.55, r * 0.12, t * 0.4, '#bfe8ff');
}
const teddyPic = (r: number) => { ctx.fillStyle = '#fff0f6'; circle(0, 0, r); teddy(0, r * 0.85, r * 0.55, true); };

// ---------------- ДЕЙСТВИЯ ----------------
/** Место: вечер и кроватка (при входе; и снова — если после утра или палочки позвали луну или предмет) */
function evening() {
  if (!Z.here) { Z.here = true; Z.gave = {}; Z.drowsy = 0; Z.nextYawn = 0.7; }
  Z.day = false;
  if (!here(Z.bed)) Z.bed = { t: 0 };
}
/** Уютный предмет пришёл: сонливость растёт (один раз за вечер; выспавшееся — вдвое меньше) */
function cozy(k: Cozy) {
  if (Z.gave[k]) return;
  Z.gave[k] = true;
  if (Z.sleep) return;
  Z.drowsy = Math.min(1, Z.drowsy + DROWSY[k] * (traces.rested > 0 ? 0.5 : 1));
  Z.nextYawn = Math.min(Z.nextYawn, 1.0);
}
/** Уснуть; quiet — без зевка (уже зевнуло, засыпая само) */
function goSleep(quiet = false) {
  if (Z.morning < 9) { const [sx, sy] = sunPos(); burst(sx, sy, 'spark', 10, { color: '#ffe27a', speed: 180 }); } // солнышко сразу прячется
  evening();
  Z.sleep = true; Z.sleepT = 0; Z.stir = 9; Z.wake = 9; Z.morning = 9; Z.zT = 0.8; Z.yawn = 9; Z.drowsy = 1; Z.dream = null;
  traces.rested = 0;
  if (!quiet) snd.yawn();
  snd.sleepy();
}
/** Проснулся после сна: если поспал как следует — «выспалось» */
function rested() { if (Z.sleep && Z.sleepT >= SLEPT) { traces.rested = RESTED; Z.restT = 0.6; } }
/** Утро по шагам (~3 с): солнышко выглядывает, вечер и ночь светлеют, шкатулка закрывается, ночник уезжает,
 *  сердце потягивается и сбрасывает одеяло, мишка машет и уходит, кроватка уезжает, солнышко уплывает за край */
function morning() {
  const was = Z.sleep;
  rested();
  Z.sleep = false; Z.stir = 9; Z.morning = 0; Z.sunLaugh = 0; Z.day = true; Z.drowsy = 0; Z.gave = {}; Z.yawn = 9; Z.dream = null;
  Z.wake = was ? -M.stretch : 9; Z.wakeLoud = true;
  sfx.tinkle();
}
/** Уходим (другой раздел, палочка, праздник): тихо проснуться без солнышка, всё плавно уезжает */
function exit() {
  if (Z.sleep) { rested(); Z.wake = 0; Z.wakeLoud = false; }
  Z.sleep = false; Z.stir = 9; Z.morning = 9; Z.here = false; Z.drowsy = 0; Z.yawn = 9; Z.dream = null; Z.wink = 9;
  leave(Z.teddy); leave(Z.lamp); leave(Z.blanket); leave(Z.box); leave(Z.bed);
}
/** Спящее сердце сонно моргает и бормочет */
function stir() {
  if (Z.stir <= 1.0) return;
  Z.stir = 0; snd.mumble(); G.hs.swingV += 1;
  const { x, y, R: Rr } = G.heart;
  addP({ kind: 'z', x: x + 0.45 * Rr, y: y - 0.5 * Rr, vx: 25 * S, vy: -40 * S, life: 1.8, size: Math.max(16, Rr * 0.13), color: '#fff6c0', rot: 0, vr: 0, g: 0 });
}
/** Луна по спящему: подмигивает, над сердцем — облачко-сон с тем, что было в этот заход (по кругу) */
function dream() {
  Z.wink = 0;
  if (Z.dream && Z.dream.t < 1.2) return; // сон только начался — не перебиваем
  const have = Object.keys(traces.dreams);
  const keys = [...DREAM_ORDER.filter(k => have.includes(k)), ...have.filter(k => !DREAM_ORDER.includes(k))];
  if (!keys.length) keys.push('stars');
  Z.dream = { k: keys[Z.dreamI++ % keys.length], t: 0 };
  snd.dream(); G.hs.swingV += 0.6;
}
// Предмет × состояние: тап по предмету и повторный тап по его кнопке делают одно и то же
function teddyTap(x: number, y: number) {
  const Td = Z.teddy!;
  if (Z.sleep) { Td.nuz = 0; snd.snuggle(); addP({ kind: 'z', x: x + 10 * S, y: y - 20 * S, vx: 15 * S, vy: -30 * S, life: 1.4, size: Math.max(12, R() * 0.09), color: '#fff6c0', rot: 0, vr: 0, g: 0 }); return; } // мишка тоже спит — прижимается
  Td.hug = 0; snd.hug(); G.hs.love = Math.max(G.hs.love, 1); burst(x, y, 'heart', 6, { up: -80, speed: 140, color: '#ff7aa8' }); // сердце обнимает мишку
}
function tuck() { // подоткнуть: спящее бормочет, бодрое хихикает
  Z.blanket!.tuck = 1; sfx.rustle();
  if (Z.sleep) { Z.stir = 9; stir(); } else { G.hs.mouth = 1; sfx.giggle(0.9); }
}
function lampTap() { Z.lamp!.hue++; snd.click(); for (const s of Z.lamp!.stars) s.tw = 0.6; }
function boxTap(x: number, y: number) { Z.box!.boost = 1.2; snd.twinkle(Z.sleep ? 0.5 : 1); burst(x, y, 'spark', 5, { color: '#fff6a8', speed: 140 }); }

function act(k: string) {
  if (k === 'sun') {
    if (Z.morning < 9) { Z.sunLaugh = 0.8; sfx.giggle(1.3); } // утро уже идёт — солнышко хихикает, но не задерживается
    else morning();
    return;
  }
  evening();
  if (k === 'moon') { if (Z.sleep) dream(); else goSleep(); } // луна по спящему не будит
  else if (k === 'teddy') {
    if (here(Z.teddy)) { const [tx, ty] = teddyPos(); teddyTap(tx, ty - teddyS() * 1.6); }
    else { Z.teddy = { t: 0, hug: Z.sleep ? 9 : 0, wave: 9, nuz: Z.sleep ? 0 : 9, zT: 1 }; if (Z.sleep) snd.snuggle(); else { snd.hug(); G.hs.love = Math.max(G.hs.love, 1.2); } cozy('teddy'); traces.dreams.teddy ??= teddyPic; }
  } else if (k === 'nightlight') {
    if (here(Z.lamp)) lampTap();
    else {
      const stars: Star[] = []; for (let i = 0; i < 11; i++) stars.push({ u: (i + rand(0.1, 0.9)) / 11, v: rand(0.05, 0.32), s: rand(0.7, 1.3), tw: 0, ph: rand(0, TAU) });
      Z.lamp = { t: 0, hue: 0, stars }; snd.click(); sfx.tinkle(); cozy('nightlight'); traces.dreams.stars ??= starsPic;
    }
  } else if (k === 'blanket') {
    if (here(Z.blanket)) tuck();
    else { Z.blanket = { t: 0, tuck: 0 }; sfx.rustle(); if (!Z.sleep) happy(); cozy('blanket'); }
  } else if (k === 'lullaby') {
    if (here(Z.box)) { const [bx, by] = boxPos(); boxTap(bx, by - boxS()); }
    else { Z.box = { t: 0, spin: 0, boost: 0 }; snd.click(); cozy('lullaby'); }
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
  traces.rested = Math.max(0, traces.rested - dt);
  const eveOn = Z.here && !Z.day && !G.finale;
  Z.eve += ((eveOn ? 1 : 0) - Z.eve) * Math.min(1, dt * 2.5);
  Z.night += ((Z.sleep && !G.finale ? 1 : 0) - Z.night) * Math.min(1, dt * 1.5);
  // сонливость: предметы рядом понемногу убаюкивают; веки идут за ней
  const awake = !Z.sleep && Z.wake === 9 && Z.morning === 9;
  if (eveOn && awake && traces.rested <= 0) {
    const n = (here(Z.teddy) ? 1 : 0) + (here(Z.lamp) ? 1 : 0) + (here(Z.blanket) ? 1 : 0) + (here(Z.box) ? 1.5 : 0);
    Z.drowsy = Math.min(1, Z.drowsy + n * CREEP * dt);
  }
  Z.lid += ((eveOn && awake ? Z.drowsy : 0) - Z.lid) * Math.min(1, dt * 2);
  // зевки: чем сонливее, тем чаще; на пороге — последний зевок и засыпает само
  if (Z.yawn < 9) {
    Z.yawn += dt;
    if (Z.yawn > YAWN) { Z.yawn = 9; if (eveOn && awake && Z.drowsy >= ASLEEP_AT) goSleep(true); }
  } else if (eveOn && awake) {
    Z.nextYawn -= dt;
    if ((Z.nextYawn <= 0 && traces.rested <= 0) || Z.drowsy >= ASLEEP_AT) { Z.yawn = 0; snd.yawn(); Z.nextYawn = rand(5, 8) - Z.drowsy * 3.5; }
  }
  if (Z.sleep) {
    Z.sleepT += dt; Z.stir += dt; Z.zT -= dt;
    if (Z.zT <= 0 && Z.sleepT > 0.8) {
      Z.zT = 1.1;
      const z = Math.random() < 0.65;
      addP({ kind: z ? 'z' : 'spark', x: hx + 0.5 * Rr, y: hy - 0.55 * Rr, vx: rand(15, 35) * S, vy: -rand(30, 45) * S, life: 2.4, size: Math.max(16, Rr * (z ? 0.16 : 0.07)), color: z ? '#fff6c0' : '#ffe27a', rot: 0, vr: z ? 0 : 1.5, g: 0 });
    }
  }
  Z.wink = Math.min(9, Z.wink + dt);
  if (Z.dream) { Z.dream.t += dt; if (Z.dream.t > DREAM || !Z.sleep) Z.dream = null; }
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
    if (at(M.teddy)) { leave(Z.teddy); leave(Z.bed); }
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
  // «выспалось»: изредка искорка у глаз (в любом разделе)
  if (traces.rested > 0 && !Z.sleep && !G.finale && Z.wake === 9) {
    Z.restT -= dt;
    if (Z.restT <= 0) { Z.restT = rand(1.4, 2.2); const d = pick([-1, 1]); burst(hx + d * 0.45 * Rr, hy - 0.3 * Rr, 'spark', 2, { color: '#fff6a8', speed: 60 }); }
  }
  // предметы; уходящие доигрывают и исчезают
  if (Z.bed) Z.bed.t += dt;
  if (Z.teddy) {
    const Td = Z.teddy; Td.t += dt; Td.hug += dt; Td.wave += dt; Td.nuz += dt;
    if (Z.sleep && Z.sleepT > 1 && here(Td)) { // мишка тоже спит — и у него своё «з-з»
      Td.zT -= dt;
      if (Td.zT <= 0) { Td.zT = rand(2.4, 3.4); const [tx, ty] = teddyPos(); addP({ kind: 'z', x: tx + teddyS() * 0.5, y: ty - teddyS() * 2.4, vx: 12 * S, vy: -25 * S, life: 1.6, size: Math.max(11, teddyS() * 0.4), color: '#fff6c0', rot: 0, vr: 0, g: 0 }); }
    }
  }
  if (Z.lamp) { Z.lamp.t += dt; for (const s of Z.lamp.stars) s.tw = Math.max(0, s.tw - dt * 1.2); }
  if (Z.blanket) { Z.blanket.t += dt; Z.blanket.tuck = Math.max(0, Z.blanket.tuck - dt * 2); }
  if (Z.box) {
    const Bx = Z.box; Bx.t += dt; Bx.boost = Math.max(0, Bx.boost - dt); Bx.spin += dt * (Bx.out == null ? (Z.sleep ? 1.2 : 2) + Bx.boost * 3 : 0.5);
    if (Bx.out == null && (Bx.t * 1.2 | 0) !== ((Bx.t - dt) * 1.2 | 0)) { const [bx, by] = boxPos(); addP({ kind: 'note', x: bx + rand(-10, 10) * S, y: by - boxS() * 1.6, vx: rand(-20, 20) * S, vy: -40 * S, life: 1.8, size: Math.max(18, 26 * S), color: pick(['#ffd6ea', '#bfe8ff', '#fff6a8']), rot: 0, vr: 0, g: 0 }); }
  }
  tickLeaving(Z, ['teddy', 'lamp', 'blanket', 'box', 'bed'], dt);
  // колыбельную играет только шкатулка; во сне — тише, без колокольчика; днём (с солнышком) и в чужих разделах молчит
  Z.lull = G.started && !G.finale && Z.morning === 9 && here(Z.box) ? (Z.sleep ? 0.55 : 1) : 0;
  updLullaby(Z.lull, !Z.sleep);
}

// ---------------- РИСОВАНИЕ ----------------
/** Система координат сердца (центр, поворот, сжатие, кручение палочкой) — запоминаем в live(): его зовут внутри неё */
let heartM: DOMMatrix | null = null;
function drawBack() {
  if (!Z.bed) return;
  const Bd = Z.bed, Rr = R(), k = ease.outBack(clamp01(Bd.t / 0.4)), o = 1 - stay(Bd);
  ctx.save(); ctx.globalAlpha *= 1 - o;
  bedPillow(G.heart.x, floorY() + (1 - k) * 0.5 * Rr + ease.in(o) * 0.5 * Rr, bedHalf(), Math.max(14, 0.15 * Rr));
  ctx.restore();
}
function drawFront() {
  const Rr = R();
  // уходя: ночник уезжает вверх, мишка — вбок, шкатулка закрывается и прячется
  if (Z.lamp) { const [lx, ly] = lampPos(), k = ease.outBack(clamp01(Z.lamp.t / 0.4)), o = 1 - stay(Z.lamp); lamp(lx, ly - (1 - k) * lampS() * 2 - ease.in(o) * (ly - G.HR.y + lampS() * 2), lampS(), Z.lamp.hue, o < 0.3, G.HR.y); }
  if (Z.teddy) {
    const Td = Z.teddy, [tx, ty] = teddyPos(), k = ease.outBack(clamp01(Td.t / 0.4)), h = Td.hug < 1.2 ? Math.sin(Td.hug / 1.2 * Math.PI) : 0, o = 1 - stay(Td);
    const nz = Td.nuz < 1.6 ? Math.sin(Td.nuz / 1.6 * Math.PI) : 0, lean = Z.sleep ? -0.12 - 0.12 * nz : 0; // спит — склонил голову к сердцу
    ctx.save(); ctx.globalAlpha *= 1 - o; ctx.translate(tx - h * Rr * 0.08 + ease.in(o) * Rr * 0.9, ty - Math.abs(Math.sin(o * 6)) * Rr * 0.04); ctx.rotate(lean);
    teddy(0, 0, teddyS() * Math.max(0.01, k), Z.sleep && Z.sleepT > 0.7, Math.max(h, nz * 0.6), Td.hug < 1.2 || Td.wave < 0.7 || o > 0 ? 1 : 0);
    ctx.restore();
  }
  if (Z.box) {
    const Bx = Z.box, [bx, by] = boxPos(), k = ease.outBack(clamp01(Bx.t / 0.4)), o = Bx.out == null ? 0 : Bx.out;
    musicBox(bx, by, boxS() * Math.max(0.01, k * clamp01((OUT - o) / 0.25)), Bx.spin, clamp01(Bx.t / 0.6) * (1 - clamp01(o / 0.25)));
  }
  if (heartM) {
    ctx.save(); ctx.setTransform(heartM);
    // одеяльце — поверх мишки и шкатулки, в координатах сердца (крутится вместе с ним); уходя, сползает вниз и тает
    if (Z.blanket) { ctx.save(); ctx.translate(0, (1 - stay(Z.blanket)) * Rr * 0.4); blanket(Rr, ease.out(clamp01(Z.blanket.t / 0.5)) * stay(Z.blanket), Z.blanket.tuck); ctx.restore(); }
    // «выспалось»: глаза блестят
    if (traces.rested > 0 && !Z.sleep && Z.eyesOpen && Z.wake === 9) {
      const a = clamp01(traces.rested / 2) * clamp01((RESTED - traces.rested) / 0.6);
      ctx.globalAlpha *= a;
      for (const d of [-1, 1]) { const k = 0.85 + 0.25 * Math.sin(t * 2.4 + d); sparkleStar(d * 0.53 * Rr, -0.33 * Rr, 0.075 * Rr * k, t * 0.8 * d, '#ffe27a'); sparkleStar(d * 0.6 * Rr, -0.16 * Rr, 0.04 * Rr * (1.9 - k), -t * 0.6 * d, '#fff6a8'); } // у уголков глаз
    }
    ctx.restore();
  }
  if (Z.morning < 9) { // солнышко выглядывает и уплывает
    const [sx, sy] = sunPos(), a = 1 - clamp01((Z.morning - (M.end - 0.35)) / 0.35);
    ctx.save(); ctx.globalAlpha *= a; sun(sx, sy, sunR(), t * 0.4 + Z.sunLaugh * 6, Z.sunLaugh > 0 ? 1 : 0); ctx.restore();
  }
}
/** Вечер и ночь: затемнение; ночью ночник — единственный свет (светлое пятно вокруг него); луна на небе и облачко-сон */
function drawOverlay() {
  const n = Z.night, e = Z.eve, { x: hx, y: hy } = G.heart, Rr = R();
  const L = Z.lamp, lk = L ? clamp01(L.t / 0.6) * stay(L) : 0;
  if (n > 0.01 || e > 0.01) {
    const [lx, ly] = lampPos(), cx = hx + (lx - hx) * lk, cy = hy + (ly - hy) * lk;
    const a0 = Math.max(0.2 * e, 0.22 * n) * (1 - 0.75 * lk), a1 = Math.max(0.28 * e, 0.62 * n) * (1 + 0.12 * lk * n);
    const g = ctx.createRadialGradient(cx, cy, Rr * 0.3 * (1 - lk) + lampS() * 1.2 * lk, cx, cy, Math.max(W, H) * 0.8);
    g.addColorStop(0, `rgba(24,20,80,${a0})`); g.addColorStop(1, `rgba(16,12,58,${Math.min(0.75, a1)})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (L) { // свет ночника; уходя — гаснет
    const [lx, ly] = lampPos(), s = lampS(), [c0] = LAMP_HUES[L.hue % LAMP_HUES.length];
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= lk;
    const rr = s * (4.5 + 2 * n), g = ctx.createRadialGradient(lx, ly, s * 0.2, lx, ly, rr); g.addColorStop(0, c0 + '66'); g.addColorStop(1, c0 + '00');
    ctx.fillStyle = g; circle(lx, ly, rr);
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(G.HR.x, G.HR.y, G.HR.w, G.HR.h); ctx.clip();
    ctx.globalAlpha *= lk * (0.55 + 0.45 * n);
    for (const st of L.stars) { const [x, y] = starPos(st), sz = starS(st) * (1 + st.tw * 0.8); sparkleStar(x, y, sz * (0.85 + 0.15 * Math.sin(t * 2 + st.ph)), t * 0.3 + st.ph, st.tw > 0 ? '#ffffff' : c0); }
    ctx.restore();
  }
  if (n > 0.05) { // луна на небе; подмигивает
    const [mx, my] = moonPos(), w = Z.wink < 0.8 ? Math.sin(Z.wink / 0.8 * Math.PI) : 0;
    ctx.save(); ctx.globalAlpha *= clamp01(n * 1.5); ctx.translate(mx, my); ctx.scale(1 + 0.1 * w, 1 + 0.1 * w); moon(0, 0, sunR() * 0.85, Z.wink < 0.7 ? 1 : 0); ctx.restore();
  }
  if (Z.dream) { // облачко-сон: пузырьки от головы, облачко, картинка покачивается
    const D = Z.dream, [cx, cy] = dreamPos(), rc = dreamR(), a = 1 - clamp01((D.t - (DREAM - 0.5)) / 0.5);
    ctx.save(); ctx.globalAlpha *= a;
    const bx = hx + 0.3 * Rr, by = hy - 0.5 * Rr;
    for (let i = 0; i < 3; i++) { const k = ease.outBack(clamp01((D.t - i * 0.15) / 0.3)); if (k > 0) { const f = (i + 1) / 4; ctx.fillStyle = '#ffffff'; circle(bx + (cx - bx) * f * 0.8, by + (cy + rc * 0.6 - by) * f, rc * (0.08 + i * 0.05) * k); } }
    const k = ease.outBack(clamp01((D.t - 0.45) / 0.4));
    if (k > 0.01) {
      ctx.translate(cx, cy + Math.sin(t * 1.4) * rc * 0.04); ctx.scale(k, k);
      dreamCloud(0, 0, rc);
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, rc * 0.62, 0, TAU); ctx.clip();
      (traces.dreams[D.k] || starsPic)(rc * 0.62);
      ctx.restore();
    }
    ctx.restore();
  }
}
/** Глаза: сонные веки, зевки, во сне закрыты; просыпается — потягивается и зевает */
function live(L: Live) {
  heartM = ctx.getTransform();
  if (Z.sleep) {
    if (Z.sleepT < 0.8) { L.mouth = Math.max(L.mouth, Math.sin(clamp01(Z.sleepT / 0.8) * Math.PI)); L.blink = Math.max(L.blink, Z.sleepT / 0.8); }
    else if (Z.stir < 1.4) { // сонно моргнул и бормочет
      const p = Z.stir; L.blink = p > 0.25 && p < 0.8 ? 0.55 : 1; L.mouth = p < 1.1 ? 0.15 + 0.15 * Math.abs(Math.sin(p * 6)) : 0;
    } else L.blink = 1;
    L.love = Math.min(L.love, 0.4);
  } else {
    if (Z.lid > 0.02) L.blink = Math.max(L.blink, Z.lid * 0.62); // веки опускаются
    if (Z.yawn < 9) { const k = Math.sin(clamp01(Z.yawn / YAWN) * Math.PI); L.mouth = Math.max(L.mouth, k); L.blink = Math.max(L.blink, k * 0.95); }
  }
  if (Z.wake < 9) {
    const p = Z.wake;
    if (p < 0.6) L.blink = 1; else if (p < 0.9) L.blink = 0.5;
    if (p >= 0 && p < 0.95) L.mouth = Math.max(L.mouth, Math.sin(clamp01(p / 0.95) * Math.PI)); // зевает
  }
  Z.eyesOpen = L.blink < 0.5;
}
function xform(X: Xf, Rr: number) {
  if (Z.sleep || Z.wake < 0) { const b = Math.sin(t * 1.7); X.sy *= 1 + 0.03 * b; X.sx *= 1 - 0.012 * b; X.rot += Math.sin(t * 0.85) * 0.015; }
  else if (Z.lid > 0.02) X.rot += Math.sin(t * 0.9) * 0.025 * Z.lid; // клюёт носом
  if (Z.yawn < 9) { const k = Math.sin(clamp01(Z.yawn / YAWN) * Math.PI); X.sy *= 1 + 0.07 * k; X.sx *= 1 - 0.035 * k; }
  if (Z.wake >= 0 && Z.wake < 0.95) { const k = Math.sin(clamp01(Z.wake / 0.95) * Math.PI); X.sy *= 1 + 0.12 * k; X.sx *= 1 - 0.07 * k; X.dy -= 0.04 * Rr * k; X.rot += Math.sin(Z.wake * 7) * 0.04 * k; }
  if (Z.teddy && Z.teddy.hug < 1.2) { const k = Math.sin(Z.teddy.hug / 1.2 * Math.PI); X.rot += 0.12 * k; X.sx *= 1 + 0.04 * k; }
  if (Z.blanket && Z.blanket.tuck > 0) { X.sx *= 1 + 0.03 * Z.blanket.tuck; X.sy *= 1 - 0.03 * Z.blanket.tuck; }
  if (traces.rested > 0 && !Z.sleep && Z.wake === 9 && !G.finale) X.dy -= Math.abs(Math.sin(t * 2.6)) * 0.012 * Rr * clamp01(traces.rested / 2); // бодрое: пружинит
}

// ---------------- ТАПЫ ----------------
function hit(x: number, y: number): Hit | null {
  const Rr = R();
  if (here(Z.teddy)) { const [tx, ty] = teddyPos(), s = teddyS(); if (Math.abs(x - tx) < Math.max(32, s * 0.85) && y < ty + 6 && y > ty - Math.max(64, s * 2.6)) return { what: 'teddy' }; }
  if (here(Z.box)) { const [bx, by] = boxPos(), s = boxS(); if (near(x, y, bx, by - 0.8 * s, s * 1.0)) return { what: 'box' }; }
  if (here(Z.lamp)) { const [lx, ly] = lampPos(), s = lampS(); if (near(x, y, lx, ly, s * 1.1)) return { what: 'lamp' }; }
  if (here(Z.blanket)) { const top = G.heart.y + 0.4 * Rr; if (y > top && y < G.heart.y + 1.1 * Rr && Math.abs(x - G.heart.x) < (heartHalfW(0.42) * 1.1 + 0.08) * Rr) return { what: 'blanket' }; }
  if (Z.morning < 9) { const [sx, sy] = sunPos(); if (near(x, y, sx, sy, sunR() * 1.3)) return { what: 'sun' }; }
  if (Z.night > 0.5) { const [mx, my] = moonPos(); if (near(x, y, mx, my, sunR() * 1.2)) return { what: 'moon' }; }
  if (Z.lamp && here(Z.lamp)) for (const st of Z.lamp.stars) { const [sx, sy] = starPos(st); if (near(x, y, sx, sy, starS(st) * 1.4)) return { what: 'star', o: st }; }
  return null;
}
function tap(h: Hit, x: number, y: number) {
  switch (h.what) {
    case 'teddy': teddyTap(x, y); break;
    case 'box': boxTap(x, y); break;
    case 'lamp': lampTap(); break;
    case 'star': h.o.tw = 1; snd.twinkle(Z.sleep ? 0.6 : 1); burst(x, y, 'spark', 5, { color: '#fff6a8', speed: 120 }); break;
    case 'blanket': tuck(); break;
    case 'moon': act('moon'); break;
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
    ctx.save(); ctx.translate(0, -r * 0.25);
    ctx.fillStyle = '#fff'; ell(0, -r * 0.3, r * 0.55, r * 0.2); // подушка
    ctx.strokeStyle = '#d9c6e6'; ctx.lineWidth = r * 0.03; ctx.stroke();
    blanket(r * 0.62, 1, 0);
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
  enter: evening, act: k => act(k), exit, update, drawBack, drawFront, drawOverlay, hit, tap, live, xform,
  heartTap() { if (!Z.sleep) return false; stir(); return true; },
};
