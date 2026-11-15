// Уход — еда. Модель: место → нужда на сердце → предметы → развязка и след.
// Место: при входе въезжает столик с тарелкой, на сердце — слюнявчик в тон (palOf); при выходе всё уезжает.
// Нужда — сытость 0..4: голодное сердце облизывается, животик тихо урчит (~раз в 8 с). После 4-го угощения развязка:
// вздох, сердце круглее, «ик». Дальше не отказывается, а ест медленно и смешно; примерно через минуту сытость спадает.
// Угощение летит из кнопки на тарелку, с тарелки — ко рту; очередь (до 3) ждёт на тарелке, лишний тап — кнопка пружинит.
// След (traces в section.ts, переживает смену раздела — мостик в ванну): хрустящее — крошки, кремовое — усы из крема, молоко — молочные усы.
// «Любимая еда дня» — влюблённые глаза, подсказка — облачко-мысль с размытой любимой едой при входе. «Смешная еда дня» — гримаса «бе-е».
//
// Предмет × состояние (голоден / сыт / испачкан) — пустых клеток нет:
//   угощение: голоден — жуёт, «ммм», оставляет след | сыт — медленно, щёки надуты, «м-м!» и «ик» | испачкан — крошки сыплются при жевании, потом облизывает усы
//   стакан:   голоден — «глык-глык», «ах», молочные усы | сыт — пьёт медленно, «ик» | испачкан — смывает крошки (сыплются), усы молочные
//   салфетка: голоден — щекотно, хихикает, животик урчит | сыт — щекотно, «ик» | испачкан — вытирает крошки и усы, блестит
import { tone, whoosh } from '../../../core/audio';
import { S, TAU, clamp, ctx, pick, rand, t } from '../../../core/canvas';
import { circle, ell } from '../../../core/draw';
import { addP, burst } from '../../../core/particles';
import { clamp01, ease } from '../../../core/tween';
import { CARE_OPTS } from '../careopts';
import { Live, palOf } from '../heart';
import { Xf } from '../reactions';
import { sfx } from '../sounds';
import { G, STAGES } from '../state';
import { apple, smallHeart } from '../things';
import { UI } from '../ui';
import { CareSection, Hit, INK, OUT, R, dayNo, floorY, happy, here, hp, iconBg, leave, mouthPos, near, onHeart, tickLeaving, traces } from './section';

/** Угощения (без стакана и салфетки) — из них «еда дня» и сытость */
const TREATS = CARE_OPTS.food.filter(k => k !== 'glass' && k !== 'napkin');
/** День → еда дня (каждый день другая: шаг 5 взаимно прост с числом угощений); off — сдвиг для «смешной» еды */
function foodOfDay(off = 0) {
  const L = TREATS;
  return L[((dayNo() * 5 + off) % L.length + L.length) % L.length];
}
/** Сытость, при которой «наелся» */
const FULL = 4;
/** Сколько секунд после последнего угощения сердце остаётся сытым; потом сытость спадает за ~16 с */
const SATED_HOLD = 55;

type Eat = { k: string; t: number; fav: boolean; grim: boolean; bites: number; done: boolean;
  /** сыт — ест медленно и смешно */ slow?: boolean; /** был испачкан, когда начал */ mess?: boolean; /** следы на начало (салфетка) */ m0?: number[] };
type Fly = { k: string; x0: number; y0: number; t: number; dur: number; park: number };
const F = {
  fav: foodOfDay(), funny: foodOfDay(4), favFound: false,
  /** в полёте: из кнопки на тарелку (park — место на тарелке) или с тарелки ко рту (park < 0) */
  fly: [] as Fly[],
  /** ждут на тарелке своей очереди */
  wait: [] as { k: string; park: number; t: number; pokeT: number }[],
  /** сейчас ест (пьёт, вытирается): t — время с момента, как предмет у рта */
  eat: null as null | Eat,
  /** кнопка угощения «пружинит» — очередь полна */
  bounce: null as null | { k: string; t: number },
  /** сытость 0..FULL; idle — сколько секунд не ел */
  full: 0, idle: 0,
  /** «круглость» сытого сердца 0..1 (плавно) */
  round: 0,
  /** развязка «наелся»: вздох, потом «ик» ×3 */
  sated: null as null | { t: number },
  /** время с последнего «ик» */
  hicT: 9,
  /** облизывается (t < 0 — ещё ждёт); clean — слизывает усы */
  lick: null as null | { t: number; clean: boolean },
  /** животик урчит: время с начала урчания; через сколько следующее */
  rumbleT: 9, rumbleIn: 3,
  /** столик со слюнявчиком; облачко-мысль о любимой еде */
  place: null as null | { t: number; out?: number },
  cloud: null as null | { t: number; out?: number; pokeT: number },
  /** время с тапа по столику и по слюнявчику (покачивание) */
  tableT: 9, bibT: 9,
  /** следы на сердце (общий объект из section.ts) */
  traces,
  /** цвета крошек и крема от последнего угощения */
  crumbCol: ['#dca25a', '#b8782f', '#f2c27b'], creamCol: '#ffd0e4',
};

const snd = {
  /** хрум (печенье, морковка, яблоко) или чавк (мягкое) */
  chomp(crunchy: boolean, slow = false) {
    const p = slow ? 0.8 : 1;
    if (crunchy) { whoosh(0.09, 0.14); tone(170 * p, 0.06, { type: 'square', vol: 0.05 }); tone(rand(1900, 2500) * p, 0.03, { type: 'square', vol: 0.025, delay: 0.03 }); tone(rand(1400, 1800) * p, 0.03, { type: 'square', vol: 0.02, delay: 0.06 }); }
    else { tone(240 * p, 0.1, { slide: 120 * p, vol: 0.15 }); tone(170 * p, 0.08, { type: 'triangle', slide: 90 * p, vol: 0.1, delay: 0.06 }); }
  },
  /** «ммм!» */
  yum() { tone(392, 0.22, { type: 'triangle', vol: 0.1, slide: 523 }); tone(523, 0.35, { type: 'triangle', vol: 0.1, delay: 0.22, slide: 494 }); },
  /** любимая еда: радостный перелив и чмок */
  fav() { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.09, delay: i * 0.07 })); tone(1568, 0.9, { vol: 0.06, delay: 0.4 }); sfx.kiss(); },
  /** смешное «бррр» */
  brr() { for (let i = 0; i < 9; i++) tone(150 + (i % 2) * 50, 0.05, { type: 'sawtooth', vol: 0.035, delay: i * 0.045 }); tone(700, 0.3, { type: 'triangle', slide: 350, vol: 0.08 }); },
  fly() { whoosh(0.35, 0.06); tone(500, 0.3, { type: 'triangle', slide: 1100, vol: 0.06 }); },
  /** «глык» — проглотил */
  gulp() { tone(420, 0.12, { slide: 180, vol: 0.12 }); tone(260, 0.1, { type: 'triangle', slide: 160, vol: 0.08, delay: 0.1 }); },
  /** «м-м!» с полным ртом и пружинка кнопки */
  full() { tone(300, 0.14, { type: 'triangle', slide: 360, vol: 0.09 }); tone(360, 0.18, { type: 'triangle', slide: 280, vol: 0.09, delay: 0.16 }); tone(160, 0.35, { slide: 420, vol: 0.12, delay: 0.02 }); },
  /** «дзынь» — угощение село на тарелку */
  clink() { tone(1900, 0.09, { vol: 0.045 }); tone(2600, 0.12, { type: 'triangle', vol: 0.025, delay: 0.02 }); },
  /** животик урчит: тихо и низко */
  rumble() { tone(95, 0.35, { type: 'triangle', slide: 70, vol: 0.07 }); tone(140, 0.2, { type: 'triangle', slide: 90, vol: 0.04, delay: 0.28 }); tone(110, 0.32, { slide: 75, vol: 0.05, delay: 0.45 }); },
  /** облизывается */
  lick() { tone(700, 0.12, { type: 'triangle', slide: 1000, vol: 0.04 }); tone(900, 0.1, { type: 'triangle', slide: 650, vol: 0.035, delay: 0.4 }); },
  /** вздох «ах-х» — наелся */
  sigh() { whoosh(0.7, 0.05); tone(560, 0.6, { type: 'triangle', slide: 340, vol: 0.08, delay: 0.05 }); },
  /** «ик!» */
  hic() { tone(620, 0.07, { type: 'triangle', slide: 1250, vol: 0.1 }); tone(1500, 0.05, { vol: 0.04, delay: 0.05 }); },
  /** «глык» молока */
  glug() { tone(260, 0.09, { slide: 420, vol: 0.12 }); tone(200, 0.07, { type: 'triangle', slide: 300, vol: 0.06, delay: 0.08 }); },
  /** «ах!» — вкусное молоко */
  ah() { tone(523, 0.18, { type: 'triangle', vol: 0.08 }); tone(784, 0.4, { type: 'triangle', vol: 0.08, delay: 0.15, slide: 740 }); },
  /** салфетка шуршит */
  wipe() { whoosh(0.2, 0.05); tone(1400, 0.08, { type: 'triangle', slide: 1700, vol: 0.035 }); },
  /** тук-тук по столику */
  knock() { tone(190, 0.08, { type: 'square', vol: 0.05 }); tone(170, 0.08, { type: 'square', vol: 0.05, delay: 0.13 }); },
  /** «м-м?» — о чём это я мечтаю */
  hmm() { tone(330, 0.2, { type: 'triangle', slide: 392, vol: 0.08 }); tone(392, 0.3, { type: 'triangle', slide: 523, vol: 0.08, delay: 0.2 }); },
};
/** Хрустит при жевании (звук) */
const CRUNCHY: Record<string, boolean> = { cookie: true, carrot: true, apple: true, candy: true, watermelon: true };
/** Оставляет крошки */
const CRUMBY: Record<string, boolean> = { cookie: true, carrot: true, apple: true };
/** Оставляет усы из крема (цвет крема) */
const CREAMY: Record<string, string> = { cupcake: '#ffb8d6', icecream: '#ffc4dc', donut: '#ff9cc8' };
const CRUMB_COL: Record<string, string[]> = { cookie: ['#dca25a', '#b8782f', '#f2c27b'], carrot: ['#ff8a1f', '#ffb056', '#e0700f'], apple: ['#fff3c4', '#ff6b7a', '#f5e3a0'] };

const isFull = () => F.full >= FULL - 0.01;
const hungry = () => F.full < 2;
const messy = () => traces.crumbs + traces.cream + traces.milk > 0.02;
const active = () => STAGES[G.stage]?.id === 'food';
/** горка 0→1→0 за d секунд */
const hump = (x: number, d: number) => (x < 0 || x > d ? 0 : Math.sin(x / d * Math.PI));

// ---------------- РИСОВАЛКИ ----------------
/** Размер угощения у рта: множитель к 0.17R (клубника меньше яблока, арбуз — самый большой) */
const FOOD_K: Record<string, number> = { candy: 0.85, strawberry: 0.85, cookie: 1.0, donut: 1.2, apple: 1.35, cupcake: 1.3, carrot: 1.35, icecream: 1.65, watermelon: 1.8, glass: 1.25, napkin: 1.15 };
/** Верхний край угощения в долях s — оттуда откусывают, им угощение касается рта */
const FOOD_TOP: Record<string, number> = { strawberry: -0.6, cupcake: -0.72, icecream: -0.85, cookie: -0.8, watermelon: -0.3, candy: -0.45, apple: -0.52, carrot: -0.5, donut: -0.8 };
/** Нижний край в долях s — им угощение стоит на тарелке */
const FOOD_BOT: Record<string, number> = { strawberry: 0.88, cupcake: 0.85, icecream: 1.0, cookie: 0.87, watermelon: 0.68, candy: 0.48, apple: 0.8, carrot: 0.8, donut: 0.82, glass: 0.84, napkin: 0.85 };
const foodS = (k: string) => R() * 0.17 * (FOOD_K[k] || 1);

/** Стакан молока с центром (0,0): level — сколько молока (0..1), tilt — наклон (молоко остаётся ровным) */
function glass(s: number, level = 1, tilt = 0) {
  const body = () => { ctx.beginPath(); ctx.moveTo(-0.5 * s, -0.8 * s); ctx.lineTo(0.5 * s, -0.8 * s); ctx.lineTo(0.4 * s, 0.76 * s); ctx.quadraticCurveTo(0, 0.86 * s, -0.4 * s, 0.76 * s); ctx.closePath(); };
  ctx.save(); ctx.rotate(tilt); ctx.lineJoin = 'round';
  body(); ctx.fillStyle = 'rgba(225,242,255,0.6)'; ctx.fill();
  if (level > 0.02) {
    ctx.save(); body(); ctx.clip(); ctx.rotate(-tilt);
    const top = 0.8 * s - level * 1.5 * s;
    ctx.fillStyle = '#fffdf6'; ctx.fillRect(-1.5 * s, top, 3 * s, 3 * s);
    ctx.fillStyle = '#efe6d8'; ctx.fillRect(-1.5 * s, top, 3 * s, 0.08 * s);
    ctx.restore();
  }
  body(); ctx.strokeStyle = '#7fb3d9'; ctx.lineWidth = 0.08 * s; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.roundRect(-0.37 * s, -0.62 * s, 0.1 * s, 1.1 * s, 0.05 * s); ctx.fill();
  smallHeart(0.12 * s, 0.25 * s, 0.2 * s, '#ff8fb8');
  ctx.restore();
}
/** Салфетка в тон сердцу с центром (0,0): квадратик ромбом, кайма и сердечко */
function napkin(s: number) {
  const [lt, dk] = palOf(G.cfg.color).acc;
  ctx.save(); ctx.rotate(Math.PI / 4); ctx.lineJoin = 'round';
  ctx.fillStyle = lt === '#ffffff' ? '#ffe6f2' : lt; ctx.beginPath(); ctx.roundRect(-0.6 * s, -0.6 * s, 1.2 * s, 1.2 * s, 0.14 * s); ctx.fill();
  ctx.strokeStyle = dk; ctx.lineWidth = 0.07 * s; ctx.stroke();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.06 * s; ctx.setLineDash([0.12 * s, 0.1 * s]); ctx.beginPath(); ctx.roundRect(-0.45 * s, -0.45 * s, 0.9 * s, 0.9 * s, 0.08 * s); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
  ctx.strokeStyle = 'rgba(90,30,60,0.15)'; ctx.lineWidth = 0.04 * s; ctx.beginPath(); ctx.moveTo(-0.7 * s, 0); ctx.lineTo(0.7 * s, 0); ctx.stroke();
  smallHeart(0, 0.05 * s, 0.26 * s, dk);
}
/** Угощение (и стакан, и салфетка) с центром (0,0), «радиус» s; bites — сколько откушено (0..3), откусы сверху */
function treat(k: string, s: number, bites = 0) {
  if (k === 'glass') { glass(s); return; }
  if (k === 'napkin') { napkin(s); return; }
  ctx.save();
  // откусы: каждый следующий — ещё одна круглая выемка сверху (клипы пересекаются)
  const top = FOOD_TOP[k] ?? -0.7;
  const B: [number, number, number][] = [[0, top + 0.02, 0.36], [0.4, top + 0.12, 0.34], [-0.4, top + 0.12, 0.34]];
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

// ---------------- МЕСТО: СТОЛИК, ТАРЕЛКА ----------------
/** Столик под сердцем: середина hx, поверхность ty, полуширина half (не заходит под палочку и хлопушку), радиус тарелки pr */
function geo() {
  const Rr = R(), hx = G.heart.x, ty = G.heart.y + 0.8 * Rr, z = G.zones, gap = 8 * S;
  let half = 1.02 * Rr;
  for (const b of [z.wand, z.party]) if (b && b.y + b.r > ty - 0.12 * Rr) half = Math.min(half, Math.abs(b.x - hx) - b.r - gap);
  half = Math.max(half, 0.42 * Rr);
  return { hx, ty, half, pr: Math.min(0.46 * Rr, half * 0.82) };
}
/** Появление места: 0..1 (въезжает 0.4 с, уезжает OUT) */
function placeK(): number {
  const P = F.place;
  if (!P) return 0;
  return P.out == null ? ease.out(clamp01(P.t / 0.4)) : 1 - ease.in(clamp01(P.out / OUT));
}
/** Угощения на тарелке поменьше, чем у рта */
const PARK_K = 0.56;
/** Место ожидания на тарелке: посередине, слева, справа; угощение стоит на тарелке нижним краем */
function parkPos(i: number, k: string): [number, number] {
  const g = geo(), s = foodS(k) * PARK_K;
  return [g.hx + [0, -0.6, 0.6][i % 3] * g.pr, g.ty + 0.03 * R() - (FOOD_BOT[k] ?? 0.8) * s];
}

// ---------------- ОЧЕРЕДЬ ----------------
/** Сколько предметов может ждать (в полёте и на тарелке), не считая того, что у рта */
const MAXQ = 3;
/** Сколько угощение лежит на тарелке, прежде чем полететь ко рту */
const REST = 0.15;
/** Где предмет у рта. Еда — верхним краем у рта, сама ниже (не закрывает глаза), откусанная подтягивается выше;
 *  стакан — справа от рта, краем к губам; салфетка — у рта (есть что вытирать) или у щёчки (щекотно) */
function holdPos(k: string, bites = 0): [number, number] {
  const [mx, my] = mouthPos(), Rr = R();
  if (k === 'glass') return [mx + 0.17 * Rr, my + 0.16 * Rr];
  if (k === 'napkin') return messy() ? [mx, my + 0.05 * Rr] : hp(0.5, 0.2);
  return [mx, my + 0.03 * Rr - ((FOOD_TOP[k] ?? -0.7) + bites * 0.14) * foodS(k)];
}
/** Где сейчас летящий предмет: x, y, размер, доля пути */
function flyPos(f: Fly): [number, number, number, number] {
  const k = clamp01(f.t / f.dur), e = ease.inOut(k), [tx, ty] = f.park < 0 ? holdPos(f.k) : parkPos(f.park, f.k), long = f.park >= 0;
  const x = f.x0 + (tx - f.x0) * e, y = f.y0 + (ty - f.y0) * e - Math.sin(k * Math.PI) * R() * (long ? 0.5 : 0.25);
  const s0 = long ? Math.max(22, 30 * S) : foodS(f.k) * PARK_K, s1 = foodS(f.k) * (f.park < 0 ? 1 : PARK_K);
  return [x, y, (s0 * (1 - k) + s1 * k) * (k < 0.15 && long ? 0.6 + k / 0.15 * 0.4 : 1), k];
}
function feed(k: string, x: number, y: number) {
  if (F.fly.length + F.wait.length >= MAXQ) { F.bounce = { k, t: 0 }; snd.full(); G.hs.wgT = 0; return; } // тарелка полна: кнопка пружинит
  const used = [...F.fly.map(f => f.park), ...F.wait.map(w => w.park)];
  const park = [0, 1, 2].find(i => !used.includes(i)) ?? 0;
  F.fly.push({ k, x0: x, y0: y, t: 0, dur: 0.6, park }); snd.fly();
}
function startEat(k: string) {
  if (F.lick && !F.lick.clean) F.lick = null; // облизывался в ожидании — уже не нужно
  const fav = k === F.fav, treat = TREATS.includes(k);
  F.eat = { k, t: 0, fav: treat && fav, grim: treat && !fav && k === F.funny, bites: 0, done: false, slow: isFull(), mess: messy(),
    m0: [traces.crumbs, traces.cream, traces.milk] };
}
/** Проглотить всё сразу (уходим из еды — и в сон тоже): глык — и ничего не осталось */
function swallow() {
  if (!F.eat && !F.fly.length && !F.wait.length) return;
  for (const f of F.fly) { const [x, y] = flyPos(f); burst(x, y, 'spark', 4, { speed: 120, color: '#fff6a8' }); }
  for (const w of F.wait) { const [x, y] = parkPos(w.park, w.k); burst(x, y, 'spark', 4, { speed: 120, color: '#fff6a8' }); }
  F.eat = null; F.fly.length = 0; F.wait.length = 0; F.bounce = null;
  snd.gulp(); G.hs.mouth = Math.max(G.hs.mouth, 0.5);
}

// ---------------- НУЖДА И РАЗВЯЗКА ----------------
function hic() {
  F.hicT = 0; snd.hic();
  const [mx, my] = mouthPos();
  addP({ kind: 'spark', x: mx + R() * 0.05, y: my, vx: rand(10, 40) * S, vy: -70 * S, life: 0.9, size: 7 * S, color: '#ffffff', rot: 0, vr: 2, g: 0 });
}
function rumble() { F.rumbleT = 0; F.rumbleIn = 8; snd.rumble(); }
/** Крошки сыплются с сердца (смыл, вытер, отряхнул) */
function crumbsFall(n: number) {
  const Rr = R(), [mx, my] = mouthPos();
  for (let i = 0; i < n; i++) addP({ kind: 'confetti', x: mx + rand(-0.25, 0.25) * Rr, y: my + rand(0.05, 0.2) * Rr, vx: rand(-40, 40) * S, vy: rand(-20, 40) * S, life: rand(0.6, 1), size: rand(3, 6) * S, color: pick(F.crumbCol), rot: rand(0, TAU), vr: rand(-6, 6), g: 600 });
}

// ---------------- ПРЕДМЕТ У РТА ----------------
const BITES = [0.12, 0.55, 0.98], BITES_SLOW = [0.3, 1.1, 1.9];
const SIPS = [0.25, 0.7, 1.15], SIPS_SLOW = [0.35, 1.0, 1.65];
/** Когда «доел» (реакция) и когда предмет уходит совсем */
function doneAt(E: Eat) { return E.k === 'glass' ? (E.slow ? 1.95 : 1.4) : E.k === 'napkin' ? 1.5 : E.slow ? 2.2 : 1.2; }
function endAt(E: Eat) {
  if (E.k === 'glass') return doneAt(E) + 0.7;
  if (E.k === 'napkin') return E.mess ? 2.0 : 1.7;
  return doneAt(E) + (E.grim ? 1.5 : 0.7) + (E.slow ? 0.5 : 0);
}

function updTreat(E: Eat, at: (x: number) => boolean) {
  const hs = G.hs, { x: hx, y: hy } = G.heart, Rr = R(), [mx, my] = mouthPos();
  for (const ct of E.slow ? BITES_SLOW : BITES) if (at(ct)) {
    E.bites++; snd.chomp(!!CRUNCHY[E.k], E.slow);
    const col = FOOD_COL[E.k] || ['#fff'];
    for (let i = 0; i < 6; i++) addP({ kind: 'confetti', x: mx + rand(-0.12, 0.12) * Rr, y: my + rand(0, 0.05) * Rr, vx: rand(-140, 140) * S, vy: rand(-160, -40) * S, life: rand(0.6, 1.1), size: rand(4, 8) * S, color: pick(col), rot: rand(0, TAU), vr: rand(-8, 8), g: 700 });
    if (E.mess && traces.crumbs > 0) { crumbsFall(3); traces.crumbs = Math.max(0.1, traces.crumbs - 0.06); } // испачкан: часть старых крошек сыплется
  }
  const D = doneAt(E);
  if (at(D)) {
    E.done = true;
    const wasFull = isFull();
    F.full = Math.min(FULL, F.full + 1); F.idle = 0;
    if (CRUMBY[E.k]) { traces.crumbs = Math.min(1, traces.crumbs + 0.4); F.crumbCol = CRUMB_COL[E.k]; }
    if (CREAMY[E.k]) { traces.cream = Math.min(1, traces.cream + 0.55); F.creamCol = CREAMY[E.k]; }
    if (E.fav) {
      F.favFound = true; hs.love = 2.2; hs.jT = 0; snd.fav();
      const fk = E.k; traces.dreams.food ??= r => treat(fk, r); // любимая еда потом снится
      burst(hx, hy - Rr * 0.3, 'heart', 16, { color: '#ff5c9a', up: -120, speed: 260 });
      addP({ kind: 'bigheart', x: hx, y: hy - Rr * 0.1, vx: 0, vy: -30 * S, life: 1.2, size: Rr * 0.5, color: 'rgba(255,90,150,0.5)', rot: 0, vr: 0, g: 0 });
    } else if (E.grim) { snd.brr(); burst(mx, my, 'spark', 6, { color: '#c9f0ff', speed: 140 }); }
    else if (E.slow) { snd.full(); burst(mx, my - Rr * 0.1, 'heart', 3, { up: -60, speed: 80 }); }
    else { snd.yum(); happy(); burst(mx, my - Rr * 0.1, 'heart', 6, { up: -90, speed: 140 }); }
    if (!wasFull && isFull()) F.sated = { t: 0 }; // развязка: вздох, круглее, «ик»
    if (E.mess && E.m0 && (E.m0[1] > 0 || E.m0[2] > 0)) F.lick = { t: 0.2, clean: true }; // испачкан: облизывает усы
  }
  if (E.slow && at(D + 0.45)) hic();
  if (E.grim && at(D + 0.9)) { sfx.giggle(1.1); happy(true); }
}
function updGlass(E: Eat, at: (x: number) => boolean) {
  for (const ct of E.slow ? SIPS_SLOW : SIPS) if (at(ct)) { E.bites++; snd.glug(); }
  const D = doneAt(E), [mx, my] = mouthPos();
  if (at(D)) {
    E.done = true; traces.milk = 1;
    if (traces.crumbs > 0) { crumbsFall(8); traces.crumbs = 0; sfx.splash(); } // испачкан: молоко смывает крошки
    snd.ah();
    if (!E.slow) { happy(); burst(mx, my - R() * 0.1, 'heart', 4, { up: -80, speed: 120 }); }
  }
  if (E.slow && at(D + 0.3)) hic();
}
function updNapkin(E: Eat, at: (x: number) => boolean) {
  const [mx, my] = mouthPos();
  if (E.mess) { // вытирает крошки и усы
    const k = clamp01((E.t - 0.15) / 1.2), m = E.m0 || [0, 0, 0];
    traces.crumbs = m[0] * (1 - k); traces.cream = m[1] * (1 - k); traces.milk = m[2] * (1 - k);
    for (const ct of [0.2, 0.6, 1.0]) if (at(ct)) { snd.wipe(); if (m[0] > 0) crumbsFall(3); }
    if (at(1.5)) { E.done = true; traces.crumbs = traces.cream = traces.milk = 0; sfx.tinkle(); happy(); burst(mx, my, 'spark', 10, { speed: 160, color: '#fff6a8' }); }
  } else { // нечего вытирать — щекотно
    if (at(0.1)) sfx.giggle(1.15);
    if (at(1.0)) { if (E.slow) hic(); else if (hungry()) rumble(); else { snd.yum(); happy(); } }
    if (at(1.5)) E.done = true;
  }
}

// ---------------- ОБНОВЛЕНИЕ ----------------
function update(dt: number) {
  // место есть, пока открыт раздел (и не идут палочка или праздник); при загрузке прямо в еду — тоже
  const want = active() && !G.finale && !G.wand;
  if (want && !here(F.place)) F.place = { t: 0 };
  if (!want && here(F.place)) leave(F.place);
  if (F.place) F.place.t += dt;
  if (F.cloud) { F.cloud.t += dt; F.cloud.pokeT += dt; if (F.cloud.t > 5.5) leave(F.cloud); }
  tickLeaving(F, ['place', 'cloud'], dt);
  F.tableT += dt; F.bibT += dt; F.hicT += dt; F.rumbleT += dt;

  // летит: на тарелку или с тарелки ко рту
  for (const f of F.fly) f.t += dt;
  for (const f of F.fly.filter(q => q.t >= q.dur)) {
    F.fly.splice(F.fly.indexOf(f), 1);
    if (f.park < 0 && !F.eat) startEat(f.k);
    else { F.wait.push({ k: f.k, park: f.park < 0 ? 0 : f.park, t: 0, pokeT: 9 }); if (f.park >= 0) snd.clink(); }
  }
  for (const w of F.wait) { w.t += dt; w.pokeT += dt; }
  if (!F.eat && !F.fly.some(f => f.park < 0) && F.wait.length && F.wait[0].t >= REST) { // следующее с тарелки — ко рту
    const w = F.wait.shift()!, [x, y] = parkPos(w.park, w.k);
    F.fly.push({ k: w.k, x0: x, y0: y, t: 0, dur: 0.4, park: -1 }); whoosh(0.2, 0.05);
  }
  if (F.bounce) { // кнопка пружинит: тарелка полна
    const b = F.bounce; b.t += dt;
    const it = UI.items.find(q => q.kind === 'care' && q.k === b.k);
    if (it) it.press = 0.9 * Math.abs(Math.sin(b.t * 18)) * Math.exp(-b.t * 5);
    if (b.t > 0.6) F.bounce = null;
  }

  const E = F.eat;
  if (E) {
    const prev = E.t; E.t += dt;
    const at = (x: number) => prev < x && E.t >= x;
    if (E.k === 'glass') updGlass(E, at); else if (E.k === 'napkin') updNapkin(E, at); else updTreat(E, at);
    if (E.t > endAt(E)) F.eat = null;
  }

  // нужда: сытость спадает примерно через минуту; голодный животик урчит
  F.idle += dt;
  if (F.idle > SATED_HOLD && F.full > 0) F.full = Math.max(0, F.full - dt * 0.25);
  F.round += ((isFull() ? 1 : 0) - F.round) * Math.min(1, dt * 3);
  if (F.sated) {
    const p = F.sated.t; F.sated.t += dt;
    const at = (x: number) => p < x && F.sated!.t >= x;
    if (at(0.25)) { snd.sigh(); burst(G.heart.x, G.heart.y - R() * 0.5, 'heart', 4, { up: -60, speed: 90 }); }
    for (const h of [1.5, 2.7, 3.9]) if (at(h)) hic();
    if (F.sated.t > 4.3) F.sated = null;
  }
  if (F.lick) {
    const p = F.lick.t; F.lick.t += dt;
    if (p < 0 && F.lick.t >= 0) snd.lick();
    if (F.lick.t > 1.1) {
      if (F.lick.clean) for (const key of ['cream', 'milk'] as const) traces[key] = traces[key] < 0.3 ? 0 : traces[key] * 0.5;
      F.lick = null;
    }
  }
  if (here(F.place) && hungry() && !F.eat && !F.fly.length && !F.wait.length) { F.rumbleIn -= dt; if (F.rumbleIn <= 0) rumble(); }
}

// ---------------- РИСОВАНИЕ ----------------
/** Слюнявчик в тон сердцу (в системе сердца): под ротиком, низом — за столиком */
function drawBib(Rr: number) {
  const P = F.place;
  if (!P) return;
  const k = P.out == null ? ease.outBack(clamp01(P.t / 0.45)) : 1 - clamp01(P.out / OUT);
  if (k <= 0.01) return;
  const [lt, dk] = palOf(G.cfg.color).acc, fill = lt === '#ffffff' ? '#ffe6f2' : lt;
  const tap = F.bibT < 0.8 ? Math.sin(F.bibT * TAU * 2) * (1 - F.bibT / 0.8) : 0, rum = F.rumbleT < 0.9 ? Math.sin(F.rumbleT * TAU * 2) * (1 - F.rumbleT / 0.9) : 0;
  ctx.save(); ctx.translate(0, 0.42 * Rr); ctx.scale(k * (1 + 0.04 * rum), k); ctx.rotate(0.06 * tap);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // завязки за «шею»
  ctx.strokeStyle = dk; ctx.lineWidth = 0.03 * Rr;
  for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(d * 0.15 * Rr, 0.01 * Rr); ctx.quadraticCurveTo(d * 0.3 * Rr, -0.06 * Rr, d * 0.44 * Rr, -0.07 * Rr); ctx.stroke(); }
  // сам слюнявчик: вырез под горлышко, низ — фестончиками
  const path = () => {
    ctx.beginPath(); ctx.moveTo(-0.17 * Rr, 0); ctx.quadraticCurveTo(0, 0.08 * Rr, 0.17 * Rr, 0);
    ctx.quadraticCurveTo(0.3 * Rr, 0.02 * Rr, 0.31 * Rr, 0.24 * Rr);
    for (let i = 0; i < 4; i++) { const x0 = (0.31 - i * 0.155) * Rr, x1 = x0 - 0.155 * Rr; ctx.quadraticCurveTo((x0 + x1) / 2, 0.33 * Rr, x1, 0.24 * Rr); }
    ctx.quadraticCurveTo(-0.3 * Rr, 0.02 * Rr, -0.17 * Rr, 0); ctx.closePath();
  };
  path(); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = dk; ctx.lineWidth = 0.018 * Rr; ctx.stroke();
  ctx.save(); path(); ctx.clip(); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.014 * Rr; ctx.setLineDash([0.03 * Rr, 0.025 * Rr]);
  ctx.beginPath(); ctx.moveTo(-0.24 * Rr, 0.2 * Rr); ctx.quadraticCurveTo(0, 0.27 * Rr, 0.24 * Rr, 0.2 * Rr); ctx.stroke(); ctx.restore();
  smallHeart(0, 0.13 * Rr, 0.065 * Rr, dk);
  ctx.restore();
}
/** Крошки вокруг рта [x, y, размер] в долях R — мимо глаз и самого ротика */
const CRUMBS: [number, number, number][] = [[-0.2, 0.27, 0.022], [0.21, 0.25, 0.02], [-0.1, 0.37, 0.024], [0.12, 0.36, 0.02], [0.02, 0.4, 0.018], [-0.26, 0.33, 0.018],
  [0.27, 0.31, 0.022], [-0.17, 0.41, 0.016], [0.19, 0.41, 0.018], [0.31, 0.21, 0.016], [-0.31, 0.22, 0.018], [0.06, 0.35, 0.016], [-0.04, 0.42, 0.02], [0.28, 0.38, 0.015]];
/** Усы «с подкруткой» над губой, под носиком (в системе сердца): кончики вверх, низ — к уголкам рта */
function mustache(Rr: number) {
  ctx.beginPath();
  for (const d of [-1, 1]) {
    ctx.moveTo(0, 0.125 * Rr);
    ctx.bezierCurveTo(d * 0.06 * Rr, 0.095 * Rr, d * 0.15 * Rr, 0.125 * Rr, d * 0.2 * Rr, 0.085 * Rr);
    ctx.bezierCurveTo(d * 0.215 * Rr, 0.13 * Rr, d * 0.17 * Rr, 0.175 * Rr, d * 0.1 * Rr, 0.17 * Rr);
    ctx.quadraticCurveTo(d * 0.04 * Rr, 0.168 * Rr, 0, 0.15 * Rr);
    ctx.closePath();
  }
}
/** Следы на сердце (в системе сердца): молочные усы, усы из крема, крошки */
function drawTraces(Rr: number) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (traces.milk > 0.01) { // молочные усы: белые, кончики вверх, две капельки
    ctx.save(); ctx.globalAlpha = Math.min(1, traces.milk * 1.5);
    mustache(Rr); ctx.strokeStyle = 'rgba(120,140,175,0.7)'; ctx.lineWidth = 0.016 * Rr; ctx.stroke(); ctx.fillStyle = '#fffdf6'; ctx.fill();
    ctx.fillStyle = '#fffdf6'; ctx.strokeStyle = 'rgba(120,140,175,0.6)'; ctx.lineWidth = 0.008 * Rr;
    for (const [x, y, r] of [[-0.08, 0.185, 0.014], [0.11, 0.182, 0.012]]) { ctx.beginPath(); ctx.ellipse(x * Rr, y * Rr, r * Rr, r * 1.4 * Rr, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ell(-0.1 * Rr, 0.115 * Rr, 0.03 * Rr, 0.008 * Rr, -0.2);
    ctx.restore();
  }
  if (traces.cream > 0.01) { // усы из крема: пышные, с волной внизу и посыпкой
    const sc = 0.7 + 0.3 * Math.min(1, traces.cream);
    ctx.save(); ctx.globalAlpha = Math.min(1, traces.cream * 1.6); ctx.translate(0, 0.13 * Rr); ctx.scale(sc, sc); ctx.translate(0, -0.13 * Rr);
    const bumps = () => { for (const d of [-1, 1]) for (const [x, y] of [[0.04, 0.16], [0.09, 0.168], [0.14, 0.158]]) { ctx.moveTo(d * x * Rr + 0.022 * Rr, y * Rr); ctx.arc(d * x * Rr, y * Rr, 0.022 * Rr, 0, TAU); } };
    mustache(Rr); bumps(); ctx.strokeStyle = 'rgba(170,40,95,0.6)'; ctx.lineWidth = 0.016 * Rr; ctx.stroke();
    mustache(Rr); bumps(); ctx.fillStyle = F.creamCol; ctx.fill('nonzero');
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; for (const d of [-1, 1]) ell(d * 0.1 * Rr, 0.118 * Rr, 0.03 * Rr, 0.009 * Rr, d * 0.2);
    ['#fff36b', '#7be0ff', '#9cf08a', '#fff'].forEach((c, i) => { ctx.fillStyle = c; ctx.save(); ctx.translate((-0.13 + i * 0.085) * Rr, (0.14 + (i % 2) * 0.015) * Rr); ctx.rotate(i * 1.3); ctx.fillRect(-0.012 * Rr, -0.004 * Rr, 0.024 * Rr, 0.008 * Rr); ctx.restore(); });
    ctx.restore();
  }
  const n = Math.ceil(traces.crumbs * CRUMBS.length - 0.01);
  for (let i = 0; i < n; i++) { // крошки — неровные кусочки
    const [x, y, r] = CRUMBS[i], cx = x * Rr, cy = y * Rr, rr = r * Rr;
    ctx.beginPath();
    for (let j = 0; j < 5; j++) { const a = j * TAU / 5 + i, q = rr * (0.75 + 0.35 * Math.sin(i * 3.7 + j * 2.1)); ctx.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); }
    ctx.closePath(); ctx.fillStyle = F.crumbCol[i % F.crumbCol.length]; ctx.fill(); ctx.strokeStyle = 'rgba(90,45,20,0.55)'; ctx.lineWidth = 0.006 * Rr; ctx.stroke();
  }
}
/** На сердце: язычок облизывается, щёки надуты (сыт, жуёт медленно), урчание животика, язычок «бе-е» */
function drawFaceFx(Rr: number) {
  const E = F.eat;
  if (F.lick && F.lick.t >= 0 && !(E && !E.done && E.k !== 'napkin')) { // язычок по верхней губе туда-обратно (1 раз в секунду)
    const p = clamp01(F.lick.t / 1.1), x = 0.1 * Rr * Math.sin(p * TAU), a = hump(F.lick.t, 1.1);
    ctx.save(); ctx.globalAlpha = Math.min(1, a * 3); ctx.fillStyle = '#ff7b9c'; ctx.strokeStyle = '#d0406a'; ctx.lineWidth = 0.01 * Rr;
    ctx.beginPath(); ctx.ellipse(x, 0.215 * Rr, 0.045 * Rr, 0.032 * Rr, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  if (E && E.slow && !E.done && TREATS.includes(E.k)) { // надутые щёчки
    const p = 0.75 + 0.25 * Math.abs(Math.sin(E.t * TAU * 0.6));
    for (const d of [-1, 1]) {
      ctx.fillStyle = 'rgba(255,255,255,0.22)'; circle(d * 0.27 * Rr, 0.24 * Rr, 0.09 * Rr * p);
      ctx.strokeStyle = 'rgba(110,0,40,0.35)'; ctx.lineWidth = 0.012 * Rr; ctx.beginPath(); ctx.arc(d * 0.27 * Rr, 0.24 * Rr, 0.09 * Rr * p, d < 0 ? 2.2 : -0.6, d < 0 ? 3.8 : 0.9); ctx.stroke();
    }
  }
  if (F.rumbleT < 1) { // урчит: волнистые чёрточки у животика
    const a = 1 - F.rumbleT;
    ctx.save(); ctx.globalAlpha = a * 0.6; ctx.strokeStyle = INK; ctx.lineWidth = 0.014 * Rr; ctx.lineCap = 'round';
    for (const d of [-1, 1]) for (let j = 0; j < 2; j++) {
      const x0 = d * (0.42 + j * 0.06) * Rr, y0 = (0.5 + j * 0.08) * Rr + Math.sin(F.rumbleT * TAU * 2) * 0.01 * Rr;
      ctx.beginPath(); for (let i = 0; i <= 8; i++) { const u = i / 8; ctx.lineTo(x0 + d * u * 0.08 * Rr, y0 + Math.sin(u * TAU) * 0.012 * Rr); } ctx.stroke();
    }
    ctx.restore();
  }
}
/** Столик на ножке с тарелкой — перед сердцем, в мире (не качается вместе с сердцем) */
function drawTable() {
  const k = placeK();
  if (k <= 0.01) return;
  const g = geo(), Rr = R(), { hx, ty, half, pr } = g, fy = floorY();
  const knock = F.tableT < 0.6 ? Math.abs(Math.sin(F.tableT * TAU * 2)) * (1 - F.tableT / 0.6) * 0.02 * Rr : 0;
  ctx.save();
  const A = G.HR; ctx.beginPath(); ctx.rect(A.x, A.y, A.w, A.h); ctx.clip();
  ctx.globalAlpha = k; ctx.translate(0, (1 - k) * 0.7 * Rr - knock);
  // ножка и подставка
  ctx.fillStyle = '#d98f52'; ell(hx, fy, Math.min(0.3 * Rr, half * 0.6), 0.05 * Rr);
  ctx.fillStyle = '#e9a86b'; ctx.beginPath(); ctx.roundRect(hx - 0.06 * Rr, ty, 0.12 * Rr, fy - ty, 0.03 * Rr); ctx.fill();
  // столешница: торец, скатерть сверху с фестончиками
  const ry = 0.09 * Rr, th = 0.055 * Rr;
  ctx.fillStyle = '#e3965a'; ell(hx, ty + th, half, ry); ctx.fillRect(hx - half, ty, half * 2, th);
  ctx.fillStyle = '#fff4e2'; ell(hx, ty, half, ry);
  ctx.strokeStyle = '#f0b77c'; ctx.lineWidth = 0.012 * Rr; ctx.beginPath(); ctx.ellipse(hx, ty, half, ry, 0, 0, TAU); ctx.stroke();
  const [, dk] = palOf(G.cfg.color).acc;
  ctx.fillStyle = dk; for (let i = -3; i <= 3; i++) { const a = Math.PI / 2 + i * 0.32; circle(hx + Math.cos(a) * half * 0.86, ty + Math.sin(a) * ry * 0.82, 0.012 * Rr); }
  // тарелка с каёмкой в тон
  ctx.fillStyle = 'rgba(150,80,40,0.16)'; ell(hx, ty + 0.012 * Rr, pr * 1.02, pr * 0.29);
  ctx.fillStyle = '#ffffff'; ell(hx, ty, pr, pr * 0.27); ctx.strokeStyle = dk; ctx.lineWidth = 0.014 * Rr; ctx.beginPath(); ctx.ellipse(hx, ty, pr * 0.92, pr * 0.24, 0, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#f6f0f7'; ell(hx, ty + 0.005 * Rr, pr * 0.62, pr * 0.15);
  ctx.restore();
}
/** Облачко-мысль над сердцем: где оно и радиус */
function cloudPos(): [number, number, number] {
  const Rr = R(), A = G.HR, r = 0.3 * Rr, sd = G.zones.sound;
  let x = Math.min(G.heart.x + 0.82 * Rr, A.x + A.w - r * 1.3 - 4), y = Math.max(G.heart.y - 0.98 * Rr, A.y + r * 1.0 + 4);
  if (sd && Math.hypot(x - sd.x, y - sd.y) < sd.r + r * 1.3) y = sd.y + sd.r + r * 1.1;
  return [x, y + Math.sin(t * 1.5) * 0.02 * Rr, r];
}
/** Облачко-мысль: размытая любимая еда дня (когда уже нашли — чёткая, с сердечком) */
function drawCloud() {
  const C = F.cloud;
  if (!C) return;
  const k = C.out == null ? ease.outBack(clamp01(C.t / 0.5)) : 1 - clamp01(C.out / OUT);
  if (k <= 0.01) return;
  const [cx, cy, r] = cloudPos(), Rr = R(), [bx, by] = hp(0.42, -0.62);
  ctx.save(); ctx.globalAlpha = Math.min(1, k);
  // пузырьки мысли от макушки к облачку — по очереди
  for (let i = 0; i < 3; i++) {
    const u = (i + 1) / 4, a = clamp01(C.t * 4 - i * 0.6) * (C.out == null ? 1 : k);
    if (a <= 0) continue;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#c9b8e8'; ctx.lineWidth = 0.012 * Rr;
    ctx.beginPath(); ctx.arc(bx + (cx - bx) * u, by + (cy + r * 0.6 - by) * u, (0.025 + i * 0.015) * Rr * a, 0, TAU); ctx.fill(); ctx.stroke();
  }
  const poke = 1 + 0.12 * Math.sin(C.pokeT * TAU * 2) * Math.exp(-C.pokeT * 4);
  ctx.translate(cx, cy); ctx.scale(k * poke, k * poke);
  const B: [number, number, number][] = [[0, 0, 0.82], [-0.62, 0.12, 0.55], [0.62, 0.12, 0.55], [-0.32, -0.36, 0.55], [0.32, -0.38, 0.52], [0, 0.32, 0.55]];
  ctx.fillStyle = '#c9b8e8'; for (const [x, y, q] of B) circle(x * r, y * r, q * r + 0.03 * r * 2);
  ctx.fillStyle = '#ffffff'; for (const [x, y, q] of B) circle(x * r, y * r, q * r);
  const s = r * 0.5;
  if (F.favFound) { treat(F.fav, s); smallHeart(r * 0.62, -r * 0.42, r * 0.2, '#ff3f8a'); }
  else { // «как в тумане»: несколько полупрозрачных копий со сдвигом и дымка сверху
    ctx.save(); ctx.globalAlpha *= 0.2;
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8; ctx.save(); ctx.translate(Math.cos(a) * r * 0.07, Math.sin(a) * r * 0.07); treat(F.fav, s); ctx.restore(); }
    ctx.restore();
    ctx.save(); ctx.globalAlpha *= 0.35; treat(F.fav, s); ctx.restore();
    ctx.fillStyle = 'rgba(244,239,255,0.35)'; circle(0, 0, r * 0.75);
  }
  ctx.restore();
}
/** Предмет у рта: угощение (откусы сверху), стакан (наклоняется), салфетка (трёт или щекочет) */
function drawHeld() {
  const E = F.eat;
  if (!E) return;
  const fade = clamp01((endAt(E) - E.t) / 0.35);
  if (E.k === 'glass') {
    const [gx, gy] = holdPos('glass'), D = doneAt(E);
    const tilt = -0.75 * (E.done ? 1 - clamp01((E.t - D) / 0.3) : clamp01(E.t / 0.25));
    ctx.save(); ctx.translate(gx, gy); ctx.scale(fade, fade); glass(foodS('glass'), 1 - E.bites * 0.3, tilt); ctx.restore();
  } else if (E.k === 'napkin') {
    const Rr = R(), [nx, ny] = holdPos('napkin');
    let x = nx, y = ny, rot = 0;
    if (E.mess) { const w = clamp01(E.t / 0.15) * (1 - clamp01((E.t - 1.4) / 0.2)); x += Math.sin(E.t * TAU * 1.25) * 0.13 * Rr * w; y += Math.cos(E.t * TAU * 2.5) * 0.025 * Rr * w; rot = Math.sin(E.t * TAU * 1.25) * 0.3 * w; }
    else { x += Math.sin(E.t * TAU * 2.2) * 0.04 * Rr; rot = Math.sin(E.t * TAU * 2.2) * 0.2; }
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(fade, fade); napkin(foodS('napkin')); ctx.restore();
  } else if (E.bites < 3) {
    const [fx, fy] = holdPos(E.k, E.bites), s = foodS(E.k) * (1 - E.bites * 0.05);
    ctx.save(); ctx.translate(fx, fy); ctx.rotate(Math.sin(E.t * 14) * 0.04); treat(E.k, s, E.bites); ctx.restore();
  }
  if (E.grim && E.done && E.t < doneAt(E) + 0.9) { // язычок «бе-е»
    const Rr = R(), [mx, my] = mouthPos(), w = Math.sin((E.t - doneAt(E)) * 14) * 0.015 * Rr;
    ctx.fillStyle = '#ff6f8f'; ell(mx + w, my + 0.07 * Rr, 0.065 * Rr, 0.08 * Rr); ctx.strokeStyle = '#d0406a'; ctx.lineWidth = Math.max(1, 0.012 * Rr); ctx.beginPath(); ctx.moveTo(mx + w, my + 0.03 * Rr); ctx.lineTo(mx + w, my + 0.1 * Rr); ctx.stroke();
  }
}
function drawFront() {
  const Rr = R();
  onHeart(() => { drawBib(Rr); drawTraces(Rr); drawFaceFx(Rr); });
  drawTable();
  // на тарелке ждут своей очереди (тап — подпрыгивают)
  for (const w of F.wait) {
    const [x, y] = parkPos(w.park, w.k), s = foodS(w.k) * PARK_K, p = w.pokeT < 0.7 ? Math.exp(-w.pokeT * 4) : 0;
    ctx.save(); ctx.translate(x, y - Math.abs(Math.sin(w.pokeT * TAU * 1.5)) * 0.08 * Rr * p); ctx.rotate(Math.sin(w.pokeT * TAU * 2) * 0.25 * p); treat(w.k, s); ctx.restore();
  }
  drawHeld();
  // в полёте: дуга от кнопки на тарелку, с тарелки — ко рту
  for (const f of F.fly) { const [x, y, s, k] = flyPos(f); ctx.save(); ctx.translate(x, y); ctx.rotate(f.park >= 0 && f.k !== 'glass' ? k * TAU : 0); treat(f.k, s); ctx.restore(); }
  drawCloud();
}

/** Смотрит на летящую еду и открывает рот, жуёт, пьёт, жмурится от салфетки, вздыхает */
function live(L: Live) {
  const E = F.eat, Rr = R();
  if (F.cloud && F.cloud.out == null && F.cloud.t < 1.6) { L.lx = 0.8; L.ly = -0.9; } // мечтательно смотрит на облачко
  const f = F.fly.find(q => q.park < 0) || F.fly[0];
  if (f) {
    const [x, y, , k] = flyPos(f);
    L.lx = clamp((x - G.heart.x) / (Rr * 1.2), -1, 1); L.ly = clamp((y - G.heart.y) / (Rr * 1.2), -1, 1);
    if (k > 0.35 && f.park < 0 && f.k !== 'napkin') L.mouth = Math.max(L.mouth, 1);
  }
  if (F.lick && F.lick.t >= 0) L.mouth = Math.max(L.mouth, 0.3);
  if (E) {
    const D = doneAt(E);
    if (E.k === 'glass') { if (!E.done) { L.mouth = Math.max(L.mouth, 0.35); L.blink = Math.max(L.blink, 0.55); L.ly = 0.6; } }
    else if (E.k === 'napkin') { if (E.t < D) { L.blink = 1; if (!E.mess) L.mouth = 0.7 + 0.3 * Math.abs(Math.sin(E.t * 7)); } }
    else {
      const b0 = E.slow ? BITES_SLOW[0] : BITES[0], per = E.slow ? 0.8 : 0.43;
      if (E.t < D - 0.1) { L.mouth = 0.5 - 0.45 * Math.cos((E.t - b0) / per * TAU); L.ly = Math.max(L.ly, 0.5); if (E.slow) L.blink = Math.max(L.blink, 0.4); }
      else if (E.grim && E.t < D + 0.9) { L.blink = 1; L.mouth = 0; }
      else if (E.grim) L.mouth = 0.6 + 0.4 * Math.abs(Math.sin(E.t * 8));
    }
  }
  if (F.sated && F.sated.t > 0.2 && F.sated.t < 1.3) { L.blink = 1; L.mouth = Math.max(L.mouth, 0.4 * hump(F.sated.t - 0.2, 1.1)); } // блаженный вздох
  if (F.hicT < 0.3) L.mouth = Math.max(L.mouth, 0.6 * hump(F.hicT, 0.3));
}
function xform(X: Xf, Rr: number) {
  const E = F.eat;
  if (E && TREATS.includes(E.k)) {
    const D = doneAt(E), b0 = E.slow ? BITES_SLOW[0] : BITES[0], per = E.slow ? 0.8 : 0.43;
    if (E.t < D - 0.1) { const c = Math.cos((E.t - b0) / per * TAU); X.sy *= 1 - 0.025 * c; X.sx *= 1 + 0.02 * c; if (E.slow) X.rot += 0.035 * Math.sin(E.t * TAU * 1.25); }
    else if (E.grim && E.t < D + 0.9) { X.rot += Math.sin(E.t * 16) * 0.05; X.sx *= 1.06; X.sy *= 0.94; }
  }
  if (E && E.k === 'napkin' && !E.mess && E.t < 1.5) X.rot += 0.05 * Math.sin(E.t * TAU * 2.2); // щекотно — ёрзает
  if (F.round > 0.01) { X.sx *= 1 + 0.06 * F.round; X.sy *= 1 - 0.025 * F.round; } // наелся — круглее
  if (F.sated) X.sy *= 1 + 0.03 * hump(F.sated.t - 0.2, 0.9); // вдох-выдох
  if (F.hicT < 0.25) { const h = hump(F.hicT, 0.25); X.dy -= 0.045 * Rr * h; X.sy *= 1 + 0.04 * h; }
  if (F.rumbleT < 0.9) { const r = Math.sin(F.rumbleT * TAU * 2) * (1 - F.rumbleT / 0.9); X.sx *= 1 + 0.02 * r; X.sy *= 1 - 0.015 * r; }
}

// ---------------- ТАПЫ ПО МЕСТУ ----------------
function hit(x: number, y: number): Hit | null {
  if (!active() || !here(F.place)) return null;
  if (F.cloud && here(F.cloud)) { const [cx, cy, r] = cloudPos(); if (near(x, y, cx, cy, r * 1.1)) return { what: 'cloud' }; }
  for (const w of F.wait) { const [px, py] = parkPos(w.park, w.k); if (near(x, y, px, py, foodS(w.k) * PARK_K * 1.2)) return { what: 'plate', o: w }; }
  const Rr = R(), g = geo(), hy = G.heart.y;
  if (Math.abs(x - g.hx) < 0.32 * Rr && y > hy + 0.44 * Rr && y < g.ty - 0.1 * Rr) return { what: 'bib' };
  if (Math.abs(x - g.hx) < g.half && y > g.ty - 0.1 * Rr && y < floorY() + 0.06 * Rr) return { what: 'table' };
  return null;
}
function tap(h: Hit, x: number, y: number) {
  if (h.what === 'cloud' && F.cloud) { F.cloud.pokeT = 0; F.cloud.t = Math.min(F.cloud.t, 1); snd.hmm(); burst(x, y, 'spark', 5, { speed: 90, color: '#e4d6ff' }); }
  else if (h.what === 'plate') { h.o.pokeT = 0; sfx.boop(); }
  else if (h.what === 'bib') { F.bibT = 0; if (isFull()) hic(); else if (hungry()) rumble(); else { sfx.giggle(1.2); happy(); } }
  else if (h.what === 'table') { F.tableT = 0; snd.knock(); for (const w of F.wait) w.pokeT = 0; burst(x, y, 'spark', 4, { speed: 80 }); }
}

// ---------------- ВХОД И ВЫХОД ----------------
function enter() {
  if (!here(F.place)) F.place = { t: 0 };
  F.cloud = { t: 0, pokeT: 9 };
  if (hungry()) { F.lick = { t: -0.6, clean: false }; F.rumbleIn = 2.5; } // облизывается, когда столик приехал
}
function exit() {
  swallow(); leave(F.place); leave(F.cloud);
  F.lick = null; F.sated = null; F.rumbleT = 9; F.hicT = 9;
}

// ---------------- ЗНАЧКИ ----------------
const BG_FOOD: [string, string] = ['#fff6e4', '#ffdcb8'];
function optIcon(k: string, r: number) {
  iconBg(r, ...BG_FOOD);
  ctx.save(); ctx.translate(0, r * 0.04); treat(k, r * 0.62); ctx.restore();
  if (F.favFound && k === F.fav) { ctx.fillStyle = '#fff'; circle(r * 0.58, -r * 0.55, r * 0.22); smallHeart(r * 0.58, -r * 0.53, r * 0.16, '#ff3f8a'); }
}
/** Тарелка с ягодой и ложка */
function icon(r: number) {
  iconBg(r, ...BG_FOOD);
  ctx.fillStyle = 'rgba(160,90,40,0.18)'; ell(-r * 0.08, r * 0.2, r * 0.66, r * 0.42);
  ctx.fillStyle = '#fff'; ell(-r * 0.1, r * 0.12, r * 0.66, r * 0.42); ctx.strokeStyle = '#ffb3d1'; ctx.lineWidth = r * 0.05; ctx.stroke();
  ctx.fillStyle = '#ffeef6'; ell(-r * 0.1, r * 0.12, r * 0.42, r * 0.26);
  ctx.save(); ctx.translate(-r * 0.12, r * 0.0); treat('strawberry', r * 0.32); ctx.restore();
  ctx.save(); ctx.translate(r * 0.68, r * 0.0); ctx.rotate(0.25);
  ctx.fillStyle = '#c9d2dc'; ctx.strokeStyle = '#8e9aa8'; ctx.lineWidth = r * 0.03; ell(0, -r * 0.42, r * 0.13, r * 0.2); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-r * 0.04, -r * 0.25, r * 0.08, r * 0.75, r * 0.04); ctx.fill(); ctx.stroke();
  ctx.restore();
}

// для автотестов: где столик и облачко
Object.assign(F, { geo, cloudPos });

export const food: CareSection = {
  id: 'food', state: F, icon, optIcon,
  act: (k, x, y) => feed(k, x, y),
  enter, exit,
  update, drawFront, live, xform, hit, tap,
};
