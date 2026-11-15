// Большое сердце со всеми украшениями. Рисуется в начале координат (центр сердца), размер R.
// Одна и та же функция рисует и живое сердце, и маленькие превью на кнопках выбора.
import { ctx, TAU, t } from '../../core/canvas';
import { circle, ell, starPath } from '../../core/draw';
import { clamp01, ease } from '../../core/tween';
import { RAINBOW, butterfly, flower, heartShape, smallHeart } from './things';

/** [основной, светлый, тёмный] — для узоров основной цвет нужен носу-пуговке, ушкам, векам */
export const COLORS: Record<string, [string, string, string]> = {
  red: ['#ff4d6d', '#ffa3b5', '#c9184a'],
  pink: ['#ff8cc6', '#ffd6eb', '#d94f97'],
  purple: ['#b57cff', '#e4d0ff', '#7a3fd0'],
  blue: ['#59a8ff', '#c0e0ff', '#2c69c9'],
  green: ['#79d653', '#d0f5ba', '#469a28'],
  yellow: ['#ffd23f', '#fff6c0', '#d39a00'],
  rainbow: ['#ff7aa8', '#ffffff', '#8a4fd6'],
  dots: ['#ff6fa8', '#ffd0e4', '#cf3479'],
  stripes: ['#5fd0c0', '#c6f5ee', '#1f9384'],
  sunset: ['#ff8a6a', '#ffe08a', '#b0458f'],
  // старые цвета — чтобы сохранённый наряд не ломался
  teal: ['#36cfc0', '#b0f3ea', '#1a958a'],
  orange: ['#ff9636', '#ffdab3', '#d4600f'],
};
export const darkOf = (c: string) => (COLORS[c] || COLORS.red)[2];
const baseOf = (c: string) => (COLORS[c] || COLORS.red)[0];
const INK = '#45182e';

// ---------------- ПАЛИТРА «В ТОН» ----------------
// Для каждого цвета сердца — роли: акцент (банты, ленты, бусы), камень (кулоны, гвоздики), металл, румянец.
// Металл — золото, на жёлтом сердце — серебро (иначе пропадает). [светлый, основной, тёмный]
type RGBA = [number, number, number, number];
export type Pal = { acc: [string, string]; gem: [string, string]; metal: [string, string, string]; blush: RGBA };
const GOLD: [string, string, string] = ['#fff3a0', '#ffd23f', '#b07d00'];
const SILVER: [string, string, string] = ['#ffffff', '#ece6f2', '#8f7f9e'];
// на радуге щёчки ложатся на зелёно-голубое — нужен плотный розовый
const PATTERN: Pal = { acc: ['#ffffff', '#c27aa3'], gem: ['#ffffff', '#c27aa3'], metal: GOLD, blush: [255, 120, 170, 0.8] };
// на зелёном полупрозрачный розовый буреет — румянец почти непрозрачный
const TO_PINK: Pal = { acc: ['#ffc2de', '#d94f97'], gem: ['#ff8cc6', '#c2387f'], metal: GOLD, blush: [255, 160, 190, 0.92] };
export const PALS: Record<string, Pal> = {
  red: { acc: ['#ffd9e2', '#e87a98'], gem: ['#ffffff', '#c47a9b'], metal: GOLD, blush: [255, 196, 208, 0.62] },
  pink: { acc: ['#c9a2ff', '#7a3fd0'], gem: ['#b57cff', '#7a3fd0'], metal: GOLD, blush: [255, 60, 135, 0.5] },
  purple: { acc: ['#ffb0da', '#d94f97'], gem: ['#ff8cc6', '#c2387f'], metal: GOLD, blush: [255, 130, 200, 0.6] },
  blue: { ...TO_PINK, blush: [255, 179, 214, 0.85] },
  green: TO_PINK,
  yellow: { acc: ['#ff9cc4', '#d94f97'], gem: ['#ff6fa8', '#cf3479'], metal: SILVER, blush: [255, 120, 120, 0.5] },
  rainbow: PATTERN, sunset: PATTERN,
  // на горошке и полосках много белого — белые детали в нём теряются, берём розовое/сиреневое
  dots: { acc: ['#d9b8ff', '#7a3fd0'], gem: ['#b57cff', '#7a3fd0'], metal: GOLD, blush: [255, 60, 135, 0.5] },
  stripes: { ...TO_PINK, blush: [255, 160, 200, 0.85] },
  teal: { ...TO_PINK, blush: [255, 160, 200, 0.85] },
  orange: { acc: ['#ffd9e2', '#e87a98'], gem: ['#ffffff', '#c47a9b'], metal: GOLD, blush: [255, 90, 110, 0.5] },
};
export const palOf = (c: string) => PALS[c] || PALS.red;
const rgba = (c: RGBA, a = c[3]) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
/** Сердце тёплого красно-розового тона — красным и розовым деталям нужна светлая обводка, иначе сливаются */
const warm = (c: string) => c === 'red' || c === 'pink' || c === 'dots' || c === 'orange' || c === 'sunset';
/** Подложка-обводка вокруг текущего пути (ставится перед основной заливкой; наружу видна половина толщины минус своя обводка детали).
 *  thick — толстая белая, thin — тонкий белый кантик, none — без подложки, dark — тёмно-винный контур */
export const HALO = { mode: 'thick' as 'thick' | 'thin' | 'none' | 'dark' };
const HALO_STYLE: Record<string, [string, number]> = { thick: ['rgba(255,255,255,0.9)', 1], thin: ['rgba(255,255,255,0.95)', 0.62], dark: ['rgba(110,0,40,0.8)', 0.6] };
function halo(w: number) {
  const st = HALO_STYLE[HALO.mode];
  if (!st) return;
  ctx.save(); ctx.strokeStyle = st[0]; ctx.lineWidth = w * st[1]; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
}
/** Сердечко-камушек: заливка, обводка, блик */
function gemHeart(x: number, y: number, s: number, col: string, dk: string, R: number, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); heartShape(s); ctx.fillStyle = col; ctx.fill();
  ctx.strokeStyle = dk; ctx.lineWidth = 0.014 * R; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ell(-0.4 * s, -0.45 * s, 0.17 * s, 0.12 * s, -0.6); ctx.restore();
}
/** Бусина с бликом */
function bead(x: number, y: number, r: number, col: string, dk: string, R: number) {
  ctx.fillStyle = col; circle(x, y, r); ctx.strokeStyle = dk; ctx.lineWidth = 0.012 * R; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; circle(x - r * 0.33, y - r * 0.33, r * 0.28);
}

/** Живое состояние: куда смотрит, моргание, открытый рот, «влюблённость», качание серёжек, появление деталей */
export interface Live { lx: number; ly: number; blink: number; mouth: number; love: number; swing: number; pop: Record<string, number>; live?: boolean;
  /** идёт своя реакция на деталь (reactions.ts): id этапа, вариант, время с начала, с */
  act?: { id: string; k: string; t: number } | null }
export const STILL: Live = { lx: 0, ly: 0.15, blink: 0, mouth: 0, love: 0, swing: 0, pop: {} };

/** Масштаб «выпрыгивающей» детали (1 — уже на месте) */
function popS(L: Live, k: string) { const p = L.pop[k]; return p == null || p >= 1 ? 1 : Math.max(0.001, ease.outBack(clamp01(p))); }
/** Деталь «выпрыгивает» после выбора: масштаб от якоря (ax, ay) */
function popped(L: Live, k: string, ax: number, ay: number, fn: () => void) {
  const s = popS(L, k);
  if (s === 1) { fn(); return; }
  ctx.save(); ctx.translate(ax, ay); ctx.scale(s, s); ctx.translate(-ax, -ay); fn(); ctx.restore();
}

// ---------------- РЕАКЦИИ НА ДЕТАЛИ ----------------
// Своя анимация детали, пока идёт её реакция (reactions.ts ставит L.act). У превью act нет — они не шевелятся.
/** Сколько секунд идёт реакция на деталь id = k, или −1, если сейчас реагирует не она */
function actT(L: Live, id: string, k: string): number { const a = L.act; return a && a.id === id && a.k === k ? a.t : -1; }
/** горка 0→1→0 за d секунд */
const hump = (x: number, d: number) => (x < 0 || x > d ? 0 : Math.sin(x / d * Math.PI));
/** затухающие колебания, f раз в секунду */
const wob = (x: number, f: number, d = 2.5) => (x < 0 ? 0 : Math.sin(x * f * TAU) * Math.exp(-x * d));
/** 1 → 0 к концу реакции (~1.8 с), чтобы деталь мягко вернулась на место */
const fade = (x: number) => (x < 0 ? 0 : clamp01((1.75 - x) / 0.45));
/** «пусть всё-таки идёт»: 0..1 по ходу реакции, мягко затухает */
const on = (x: number) => (x < 0 ? 0 : clamp01(x / 0.15) * fade(x));

type Mv = { dx?: number; dy?: number; rot?: number; sx?: number; sy?: number };
/** Движение детали целиком (в долях R, вокруг якоря), ключ — «этап:вариант» */
const MOVE: Record<string, (x: number) => Mv> = {
  'nose:dot': x => ({ dy: -0.025 * (hump(x - 0.3, 0.12) + hump(x - 0.48, 0.12)), sy: 1 + 0.25 * (hump(x - 0.3, 0.12) + hump(x - 0.48, 0.12)), sx: 1 + 0.3 * hump(x, 0.2) }),
  'nose:heart': x => { const b = (y: number) => hump(y, 0.14) + 0.7 * hump(y - 0.22, 0.14); const s = 1 + 0.45 * (b(x) + b(x - 0.6)); return { sx: s, sy: s }; },
  'nose:button': x => ({ rot: TAU * 2 * ease.inOut(clamp01(x / 1.1)), sx: 1 + 0.2 * hump(x, 1.1), sy: 1 + 0.2 * hump(x, 1.1) }),
  'nose:clown': x => { const h = hump(x, 0.25) + hump(x - 0.35, 0.25); return { sx: 1 + 0.4 * h + 0.1 * wob(x - 0.6, 2), sy: 1 - 0.35 * h - 0.1 * wob(x - 0.6, 2) }; },
  'nose:cat': x => ({ dy: 0.012 * Math.sin(x * TAU * 2.5) * on(x) }),
  'nose:pig': x => { const h = hump(x, 0.18) + hump(x - 0.32, 0.18); return { dy: -0.06 * h, sx: 1 + 0.2 * h, sy: 1 - 0.1 * h, rot: 0.12 * Math.sin(x * TAU * 3) * hump(x - 0.6, 0.8) }; },
  'nose:tone': x => ({ dy: -0.03 * hump(x, 0.3), sx: 1 + 0.25 * hump(x - 0.3, 0.25), sy: 1 - 0.2 * hump(x - 0.3, 0.25) }),
  'nose:soft': x => { const h = hump(x, 0.2) + hump(x - 0.3, 0.2) + hump(x - 0.6, 0.2); return { sx: 1 + 0.35 * h, sy: 1 - 0.3 * h }; },
  'nose:tri': x => ({ dy: 0.015 * Math.sin(x * TAU * 2.5) * on(x), sx: 1 + 0.15 * Math.abs(Math.sin(x * TAU * 2.5)) * on(x) }),
  'nose:line': x => ({ sx: 1 + 0.6 * hump(x, 0.9), sy: 1 + 0.4 * hump(x, 0.9), dy: -0.02 * hump(x, 0.9) }),
  'necklace:heartchain': x => ({ rot: 0.45 * wob(x, 1.6, 1.6) }),
  'necklace:gem': x => ({ rot: 0.35 * wob(x, 2.2, 1.8), sy: 1 + 0.15 * hump(x, 0.5) }),
  'nose:strawberry': x => ({ dy: -0.08 * Math.abs(Math.sin(x * TAU * 1.6)) * fade(x), rot: 0.3 * wob(x, 2) }),
  'nose:dog': x => ({ dx: 0.03 * Math.sin(x * TAU * 2.5) * on(x), sy: 1 + 0.08 * Math.abs(Math.sin(x * TAU * 2.5)) * on(x) }),
  'nose:mustache': x => ({ dy: -0.02 * Math.abs(Math.sin(x * TAU * 2)) * on(x) }),
  // причёска: двигается то, что над головой и сзади (чёлка остаётся на месте)
  'hair:bow': x => ({ sx: 1 + 0.3 * wob(x, 2.5, 2), rot: 0.2 * wob(x, 2, 2) }),
  'hair:long': x => ({ rot: 0.12 * Math.sin(x * TAU * 1.2) * on(x), sy: 1 + 0.05 * hump(x, 0.6) }),
  'hair:crown': x => ({ dy: -0.12 * hump(x, 1.3), rot: 0.15 * wob(x, 2.5, 2), sx: 1 + 0.15 * hump(x, 1.3), sy: 1 + 0.15 * hump(x, 1.3) }),
  'hair:flowers': x => ({ sx: 1 + 0.1 * Math.sin(x * TAU * 2.5) * on(x), sy: 1 - 0.08 * Math.sin(x * TAU * 2.5) * on(x) }),
  'hair:unicorn': x => ({ rot: 0.08 * wob(x, 2, 2), dy: -0.05 * hump(x, 1.4) }),
  'hair:bun': x => ({ dy: -0.12 * Math.abs(Math.sin(x * TAU * 1.8)) * fade(x), sy: 1 + 0.12 * Math.sin(x * TAU * 3.6) * on(x) }),
  'hair:afro': x => ({ sx: 1 + 0.07 * Math.sin(x * TAU * 2.2) * on(x), sy: 1 - 0.07 * Math.sin(x * TAU * 2.2) * on(x) }),
  'hair:bunny': x => ({ dy: -0.06 * Math.abs(Math.sin(x * TAU * 1.1)) * fade(x) }),
  'necklace:locket': x => ({ rot: 0.45 * wob(x, 1.6, 1.6) }),
};
/** Нарисовать деталь, сдвинутую/повёрнутую её реакцией вокруг якоря (ax, ay) */
function mv(L: Live, id: string, k: string, R: number, ax: number, ay: number, fn: () => void) {
  const x = actT(L, id, k), f = x < 0 ? null : MOVE[id + ':' + k];
  if (!f) { fn(); return; }
  const m = f(x), e = fade(x);
  ctx.save(); ctx.translate(ax + (m.dx || 0) * R * e, ay + (m.dy || 0) * R * e); ctx.rotate((m.rot || 0) * (id === 'nose' && k === 'button' ? 1 : e)); // пуговка делает полные обороты — их не гасим
  ctx.scale(1 + ((m.sx ?? 1) - 1) * e, 1 + ((m.sy ?? 1) - 1) * e); ctx.translate(-ax, -ay); fn(); ctx.restore();
}

export function drawHeart(cfg: Record<string, any>, R: number, L: Live = STILL) {
  // во время реакции глаз «любовь» не подменяет сами глаза — пусть видно их анимацию
  const eyes = L.love > 0.5 && !(L.act && (L.act.id === 'eyes' || L.act.id === 'lashes')) ? 'heart' : cfg.eyes;
  const hairPiv = cfg.hair === 'long' ? -0.95 * R : -0.7 * R;
  // тёмный край чёлки снаружи сердца — под задними волосами: где сзади волосы, край прячется под ними и чёлка сливается с ними
  if (HAIR[cfg.hair]) popped(L, 'hair', 0, -0.7 * R, () => bangsEdge(cfg.hair, R, cfg.color));
  if (cfg.hair) popped(L, 'hair', 0, -0.7 * R, () => mv(L, 'hair', cfg.hair, R, 0, hairPiv, () => hairBack(cfg.hair, R, L, cfg.color)));
  body(cfg.color, R, L, HAIR[cfg.hair] ? { curly: cfg.hair === 'afro', s: popS(L, 'hair') } : null);
  if (cfg.hair) popped(L, 'hair', 0, -0.7 * R, () => hairBangs(cfg.hair, R, cfg.color));
  if (cfg.cheeks) popped(L, 'cheeks', 0, 0.1 * R, () => cheeks(cfg.cheeks, R, L, cfg.color));
  if (L.love > 0) { const bl = palOf(cfg.color).blush; ctx.fillStyle = rgba(bl, Math.max(0.5, bl[3]) * clamp01(L.love)); // «влюблённый» румянец — в тон сердцу
    ell(-0.55 * R, 0.1 * R, 0.14 * R, 0.08 * R); ell(0.55 * R, 0.1 * R, 0.14 * R, 0.08 * R); }
  popped(L, 'eyes', 0, -0.12 * R, () => { drawEye(eyes, -1, R, L, cfg.color); drawEye(eyes, 1, R, L, cfg.color); });
  // ресницы и брови уходят под чёлку (а не рисуются поверх волос)
  if (cfg.lashes) popped(L, 'lashes', 0, -0.25 * R, () => { ctx.save(); if (HAIR[cfg.hair]) bangsClip(R, cfg.hair === 'afro'); lashes(cfg.lashes, eyes, R, L, cfg.color); ctx.restore(); });
  popped(L, 'eyes', 0, -0.12 * R, () => eyewear(cfg.eyes, R, L));
  if (cfg.nose) popped(L, 'nose', 0, 0.06 * R, () => mv(L, 'nose', cfg.nose, R, 0, 0.06 * R, () => nose(cfg.nose, R, L, cfg.color)));
  mouth(R, L);
  if (cfg.hair) popped(L, 'hair', 0, -0.7 * R, () => mv(L, 'hair', cfg.hair, R, 0, hairPiv, () => hairFront(cfg.hair, R, L, cfg.color)));
  if (cfg.earrings) popped(L, 'earrings', 0, 0.05 * R, () => earrings(cfg.earrings, R, L, cfg.color));
  if (cfg.necklace) popped(L, 'necklace', 0, 0.55 * R, () => necklace(cfg.necklace, R, L, cfg.color));
}

// ---------------- ТЕЛО ----------------
/** bg — чёлка на сердце: контур тела под ней не рисуется (s — масштаб «выпрыгивания» причёски) */
function body(color: string, R: number, L: Live, bg: { curly: boolean; s: number } | null = null) {
  const x = actT(L, 'color', color); // своя реакция цвета
  heartShape(R);
  let g: CanvasGradient;
  const [b, l, d] = COLORS[color] || COLORS.red;
  if (color === 'rainbow') {
    // во время реакции полосы радуги поворачиваются и бегут — сердце переливается
    const a = Math.atan2(0.9, 1) + (x < 0 ? 0 : x * 5 * fade(x)), c = Math.cos(a) * 1.35 * R, sn = Math.sin(a) * 1.35 * R;
    g = ctx.createLinearGradient(-c, -sn, c, sn);
    const sh = x < 0 ? 0 : (x * 1.2) % 1, n = RAINBOW.length - 1, m = RAINBOW.length;
    if (!sh) RAINBOW.forEach((c, i) => g.addColorStop(i / n, c));
    else for (let i = 0; i <= 2 * m; i++) { const p = i / m - sh; if (p >= 0 && p <= 1) g.addColorStop(p, RAINBOW[i % m]); }
  } else if (color === 'sunset') {
    g = ctx.createLinearGradient(0, -R - 0.7 * R * hump(x, 1.6), 0, 0.95 * R - 0.5 * R * hump(x, 1.6)); // солнышко «садится» и встаёт
    g.addColorStop(0, '#ffe57a'); g.addColorStop(0.35, '#ffa24f'); g.addColorStop(0.68, '#ff6f96'); g.addColorStop(1, '#a35ad8');
  } else {
    g = ctx.createRadialGradient(-0.4 * R, -0.55 * R, 0.05 * R, -0.1 * R, -0.1 * R, 1.3 * R);
    g.addColorStop(0, l); g.addColorStop(0.45, b); g.addColorStop(1, d);
  }
  ctx.fillStyle = g; ctx.fill();
  if (color === 'dots' || color === 'stripes') {
    ctx.save(); heartShape(R); ctx.clip();
    if (color === 'dots') {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      // реакция: горошки по очереди «пыкают» — волна сверху вниз
      for (let j = 0; j < 8; j++) for (let i = 0; i < 9; i++) circle(-1.1 * R + i * 0.28 * R + (j % 2) * 0.14 * R, -1.05 * R + j * 0.27 * R, 0.07 * R * (1 + 0.7 * hump(x - j * 0.11 - i * 0.02, 0.3)));
    } else {
      const o = x < 0 ? 0 : ((x * 0.9 * fade(x)) % 0.6) * R; // реакция: полоски бегут
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.11 * R;
      for (let i = -8; i <= 6; i++) { ctx.beginPath(); ctx.moveTo(i * 0.3 * R - R + o, -1.1 * R); ctx.lineTo(i * 0.3 * R + R + o, 1.1 * R); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(255,214,110,0.75)'; ctx.lineWidth = 0.035 * R;
      for (let i = -8; i <= 6; i++) { ctx.beginPath(); ctx.moveTo(i * 0.3 * R - R + 0.15 * R + o, -1.1 * R); ctx.lineTo(i * 0.3 * R + R + 0.15 * R + o, 1.1 * R); ctx.stroke(); }
    }
    // объём поверх узора
    const sh = ctx.createRadialGradient(-0.3 * R, -0.4 * R, 0.2 * R, 0, 0, 1.25 * R);
    sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(90,10,60,0.28)');
    ctx.fillStyle = sh; ctx.fillRect(-1.2 * R, -1.2 * R, 2.4 * R, 2.4 * R);
    ctx.restore();
  }
  ctx.save(); if (bg) belowBangs(R, bg.curly, bg.s);
  ctx.lineJoin = 'round'; ctx.strokeStyle = d; ctx.lineWidth = Math.max(1.5, 0.035 * R); heartShape(R); ctx.stroke();
  ctx.restore();
  if (color === 'rainbow' || color === 'sunset' || color === 'stripes' || color === 'dots') { // мягкий светлый центр, чтобы лицо читалось
    const w = ctx.createRadialGradient(0, -0.02 * R, 0.1 * R, 0, -0.02 * R, 0.75 * R);
    w.addColorStop(0, 'rgba(255,255,255,0.4)'); w.addColorStop(1, 'rgba(255,255,255,0)');
    heartShape(R); ctx.fillStyle = w; ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ell(-0.55 * R, -0.62 * R, 0.17 * R, 0.08 * R, -0.75); circle(-0.34 * R, -0.8 * R, 0.035 * R);
  if (x >= 0) bodyFx(color, R, x);
}

/** Поверх тела во время реакции цвета: свечение, волны, искорки внутри */
function bodyFx(color: string, R: number, x: number) {
  ctx.save(); heartShape(R); ctx.clip();
  if (color === 'red' || color === 'yellow') { // тёплое свечение изнутри: у красного — в такт «тук-тук», у жёлтого — солнышко
    const k = color === 'red' ? hump(x, 0.14) + 0.7 * hump(x - 0.22, 0.14) + hump(x - 0.8, 0.14) + 0.7 * hump(x - 1.02, 0.14) : hump(x, 1.3);
    const g = ctx.createRadialGradient(0, -0.1 * R, 0.05 * R, 0, -0.1 * R, 1.1 * R);
    g.addColorStop(0, color === 'red' ? `rgba(255,220,230,${0.55 * k})` : `rgba(255,255,220,${0.75 * k})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(-1.2 * R, -1.2 * R, 2.4 * R, 2.4 * R);
  } else if (color === 'pink') { // блик растёт, как у надутого пузыря
    const k = x < 0.62 ? x / 0.62 : Math.max(0, 1 - (x - 0.62) * 4);
    ctx.fillStyle = `rgba(255,255,255,${0.6 * k})`; ell(-0.45 * R, -0.5 * R, (0.17 + 0.2 * k) * R, (0.08 + 0.1 * k) * R, -0.75);
  } else if (color === 'purple') { // звёздочки мерцают внутри
    for (let i = 0; i < 9; i++) {
      const a = i * 2.39, r = 0.25 + (i % 3) * 0.22, k = hump(x - i * 0.12, 0.6);
      if (k <= 0) continue;
      ctx.save(); ctx.translate(Math.cos(a) * r * R, Math.sin(a) * r * R * 0.8 - 0.05 * R); ctx.rotate(x * 3 + i);
      ctx.fillStyle = `rgba(255,245,200,${0.9 * k})`; starPath(4, 0.07 * R * k, 0.022 * R * k); ctx.fill(); ctx.restore();
    }
  } else if (color === 'blue') { // водяные волны бегут сверху вниз
    ctx.strokeStyle = `rgba(255,255,255,${0.55 * fade(x)})`; ctx.lineWidth = 0.05 * R; ctx.lineCap = 'round';
    for (let w = 0; w < 3; w++) {
      const yy = -1.1 * R + ((x * 1.3 + w / 3) % 1) * 2.2 * R;
      ctx.beginPath(); for (let i = 0; i <= 20; i++) { const xx = -1.1 * R + i * 0.11 * R; ctx.lineTo(xx, yy + Math.sin(i * 0.9 + x * 8) * 0.04 * R); } ctx.stroke();
    }
  } else if (color === 'green') { // зелёные «прыгучие» пятнышки, как у лягушонка
    ctx.fillStyle = `rgba(210,255,170,${0.6 * fade(x)})`;
    for (const [px, py, r] of [[-0.6, -0.5, 0.09], [0.55, -0.55, 0.07], [-0.3, 0.45, 0.06], [0.4, 0.35, 0.08]]) circle(px * R, py * R, r * R * (1 + 0.4 * Math.abs(Math.sin(x * 7))));
  } else if (color === 'rainbow' || color === 'sunset' || color === 'stripes' || color === 'dots') { // блестящая полоса пробегает по сердцу
    const p = ((x * 0.9) % 1) * 3.2 - 1.6;
    const g = ctx.createLinearGradient((p - 0.3) * R, -R, (p + 0.3) * R, R);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${0.45 * fade(x)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(-1.2 * R, -1.2 * R, 2.4 * R, 2.4 * R);
  }
  ctx.restore();
}

// ---------------- ГЛАЗА ----------------
const EX = 0.34, EY = -0.12;
type Eye = { closed?: boolean; rx: number; ry: number };
const EYES: Record<string, Eye> = {
  round: { rx: 0.16, ry: 0.19 }, sparkle: { rx: 0.18, ry: 0.22 }, heart: { rx: 0.16, ry: 0.15 }, button: { rx: 0.075, ry: 0.09 },
  wink: { rx: 0.16, ry: 0.19 }, sleepy: { rx: 0.16, ry: 0.17 }, cat: { rx: 0.18, ry: 0.14 }, rainbow: { rx: 0.17, ry: 0.2 },
  glasses: { rx: 0.13, ry: 0.155 }, sunglasses: { rx: 0.22, ry: 0.17 },
};
function eyeSpec(kind: string, side: number): Eye {
  if (kind === 'happy' || (kind === 'wink' && side > 0)) return { closed: true, rx: 0.11, ry: 0.11 };
  return EYES[kind] || EYES.round;
}
/** Реакция глаз: масштаб глаза, сдвиг вверх-вниз, зажмурить (true) / открыть (false) этот глаз */
function eyeFx(L: Live, kind: string, side: number): { sc: number; dy: number; shut: boolean | null } {
  const x = actT(L, 'eyes', kind), r = { sc: 1, dy: 0, shut: null as boolean | null };
  if (x < 0) return r;
  if (kind === 'round') r.sc = 1 + 0.3 * hump(x, 0.9);                                           // глаза круглые от удивления
  else if (kind === 'sparkle') { r.shut = side < 0 && x > 0.25 && x < 0.6 ? true : null; r.sc = 1 + 0.12 * hump(x - 0.6, 0.8); } // подмигнул
  else if (kind === 'happy') r.dy = -0.06 * Math.abs(Math.sin(x * TAU * 2)) * fade(x);          // глазки-дужки прыгают от смеха
  else if (kind === 'glasses') r.shut = side > 0 && x > 0.2 && x < 0.55 ? true : null;          // подмигнул из-под очков
  else if (kind === 'wink') { const sw = x > 0.15 && x < 1.2; r.shut = sw ? side < 0 : null; }  // подмигивает другим глазом
  else if (kind === 'button') r.sc = 1 + 0.6 * Math.abs(wob(x, 2.5, 2.2));                         // бусинки подпрыгивают
  else if (kind === 'cat') r.sc = 1 + 0.08 * hump(x, 1.2);
  return r;
}
/** Насколько глаз сейчас моргает (0..1). Пока реакция сама открывает/зажмуривает глаз (подмигивание),
 *  обычное моргание не вмешивается — иначе подмигивание и моргание идут одновременно */
function eyeBlink(L: Live, kind: string, side: number) { return eyeFx(L, kind, side).shut != null ? 0 : L.blink; }
/** Закрыт ли глаз сейчас (то же решение для глаза и ресничек) */
function eyeClosed(L: Live, kind: string, side: number) {
  const f = eyeFx(L, kind, side).shut;
  if (f != null) return f;
  return !!eyeSpec(kind, side).closed;
}
const shine = (lx: number, ly: number, R: number, big = 0.04) => { ctx.fillStyle = '#fff'; circle(lx + 0.045 * R, ly - 0.05 * R, big * R); circle(lx - 0.035 * R, ly + 0.045 * R, 0.02 * R); };

function drawEye(kind: string, side: number, R: number, L: Live, color: string) {
  const ax = actT(L, 'eyes', kind);
  if (kind === 'sunglasses') { // стёкла рисует eyewear; когда очки съезжают на нос — из-под них выглядывают глаза
    if (ax > 0.1 && ax < 1.25) drawEye('round', side, R, { ...L, act: null, lx: 0, ly: -0.8 }, color);
    return;
  }
  const fx = eyeFx(L, kind, side), x = side * EX * R, y = EY * R + fx.dy * R, sp = eyeSpec(kind, side);
  const bk = eyeBlink(L, kind, side);
  if (eyeClosed(L, kind, side) || bk > 0.85) {
    ctx.strokeStyle = INK; ctx.lineWidth = 0.045 * R; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y + 0.05 * R, 0.11 * R, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke(); return;
  }
  const k = kind === 'wink' || kind === 'happy' ? 'round' : (EYES[kind] ? kind : 'round');
  const lx = L.lx * 0.05 * R, ly = L.ly * 0.05 * R, rx = (kind === 'happy' ? EYES.round.rx : sp.rx) * R, ry = (kind === 'happy' ? EYES.round.ry : sp.ry) * R;
  ctx.save(); ctx.translate(x, y); ctx.scale(fx.sc, Math.max(0.1, 1 - bk) * fx.sc);
  const white = () => { ctx.fillStyle = '#fff'; ell(0, 0, rx, ry); ctx.strokeStyle = INK; ctx.lineWidth = 0.022 * R; ctx.stroke(); };
  if (k === 'round' || k === 'glasses') {
    white(); ctx.fillStyle = '#2b1420'; ell(lx, ly, rx * 0.66, ry * 0.66); shine(lx, ly, R);
  } else if (k === 'sparkle') {
    white();
    const g = ctx.createRadialGradient(lx, ly + 0.05 * R, 0.01 * R, lx, ly, 0.15 * R);
    g.addColorStop(0, '#c7f0ff'); g.addColorStop(0.5, '#6f7dff'); g.addColorStop(1, '#3b1f8f');
    ctx.fillStyle = g; circle(lx, ly, 0.145 * R); ctx.fillStyle = '#1c0f3a'; circle(lx, ly, 0.07 * R);
    shine(lx, ly, R, 0.05);
    const sb = 1 + 1.3 * hump(ax - 0.3, 1.2); // реакция: звёздочка растёт и крутится быстрее
    ctx.save(); ctx.translate(lx - 0.055 * R, ly - 0.07 * R); ctx.rotate(t * 1.5 + (ax < 0 ? 0 : ax * 8 * fade(ax))); starPath(4, 0.045 * R * sb, 0.013 * R * sb); ctx.fill(); ctx.restore();
  } else if (k === 'rainbow') {
    white();
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.clip();
    const RC = ['#ff7aa8', '#ffb347', '#ffe066', '#6bd47a', '#4da3ff', '#a46bff'];
    let g: CanvasGradient;
    if (ax >= 0 && (ctx as any).createConicGradient) { // реакция: радужка закручивается вихрем
      g = (ctx as any).createConicGradient(ax * 9 * side + 0.3, lx, ly);
      [...RC, RC[0]].forEach((c, i) => g.addColorStop(i / RC.length, c));
    } else { g = ctx.createRadialGradient(lx, ly, 0.02 * R, lx, ly, 0.14 * R); RC.forEach((c, i) => g.addColorStop(i / 5, c)); }
    ctx.fillStyle = g; circle(lx, ly, 0.14 * R); ctx.strokeStyle = 'rgba(80,30,120,0.5)'; ctx.lineWidth = 0.012 * R; ctx.stroke();
    ctx.fillStyle = '#2b1420'; circle(lx, ly, 0.045 * R); ctx.restore();
    shine(lx, ly, R, 0.045);
  } else if (k === 'sleepy') {
    white(); ctx.fillStyle = '#2b1420'; ell(lx, ly + 0.04 * R, 0.1 * R, 0.11 * R); shine(lx, ly + 0.05 * R, R, 0.03);
    // веко цвета сердца прикрывает верх глаза
    const lid = -0.01 * R + (L.live ? Math.sin(t * 1.3) * 0.015 * R : 0) + 0.13 * R * hump(ax, 1.4); // реакция: веки слипаются — зевок
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.clip();
    ctx.fillStyle = color === 'rainbow' || color === 'sunset' ? '#ffa3c4' : baseOf(color);
    ctx.beginPath(); ctx.moveTo(-rx - 2, -ry - 2); ctx.lineTo(rx + 2, -ry - 2); ctx.lineTo(rx + 2, lid); ctx.quadraticCurveTo(0, lid + 0.07 * R, -rx - 2, lid); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 0.03 * R; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-rx * 0.99, lid); ctx.quadraticCurveTo(0, lid + 0.07 * R, rx * 0.99, lid); ctx.stroke();
    ctx.lineWidth = 0.022 * R; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.stroke();
  } else if (k === 'cat') {
    const almond = () => { ctx.beginPath(); ctx.moveTo(-rx, 0.01 * R); ctx.quadraticCurveTo(-0.1 * rx, -ry * 2.1, rx, -0.03 * R); ctx.quadraticCurveTo(0.1 * rx, ry * 1.9, -rx, 0.01 * R); ctx.closePath(); };
    almond();
    const g = ctx.createRadialGradient(lx, ly, 0.01 * R, lx, ly, 0.16 * R); g.addColorStop(0, '#f3ff9e'); g.addColorStop(0.55, '#8edb4c'); g.addColorStop(1, '#2f8f3a');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); almond(); ctx.clip(); ctx.fillStyle = '#1c2a14'; ell(lx, ly, 0.035 * R * (1 + 1.8 * hump(ax, 1.2)), 0.12 * R); ctx.restore(); // реакция: зрачки расширяются
    almond(); ctx.strokeStyle = INK; ctx.lineWidth = 0.024 * R; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.fillStyle = '#fff'; circle(lx + 0.05 * R, ly - 0.04 * R, 0.03 * R);
  } else if (k === 'heart') {
    ctx.translate(lx * 0.6, ly * 0.6 + 0.02 * R);
    const s = 0.17 * R * (L.love > 0.5 ? 1 + Math.sin(t * 12) * 0.08 : 1);
    heartShape(s); ctx.fillStyle = '#ff3d7f'; ctx.fill(); ctx.strokeStyle = '#a8124a'; ctx.lineWidth = 0.022 * R; ctx.stroke();
    ctx.fillStyle = '#fff'; circle(-0.06 * R, -0.07 * R, 0.03 * R);
  } else { // button — маленькие глазки-бусинки
    ctx.fillStyle = '#2b1420'; ell(lx * 0.6, ly * 0.6, rx, ry);
    ctx.fillStyle = '#fff'; circle(lx * 0.6 + 0.025 * R, ly * 0.6 - 0.03 * R, 0.025 * R);
  }
  ctx.restore();
}

/** Очки поверх глаз и ресничек */
function eyewear(kind: string, R: number, L: Live) {
  const ax = actT(L, 'eyes', kind);
  if (kind === 'glasses') {
    const fr = 0.2 * R, y = EY * R - 0.04 * R * hump(ax, 0.5); // реакция: поправил очки
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      const x = s * EX * R;
      ctx.fillStyle = 'rgba(210,235,255,0.22)'; circle(x, y, fr);
      ctx.strokeStyle = '#3b2a8a'; ctx.lineWidth = 0.045 * R; ctx.beginPath(); ctx.arc(x, y, fr, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#8f7dff'; ctx.lineWidth = 0.014 * R; ctx.beginPath(); ctx.arc(x, y, fr, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 0.02 * R; ctx.beginPath(); ctx.moveTo(x + 0.06 * R, y - 0.12 * R); ctx.lineTo(x + 0.12 * R, y - 0.04 * R); ctx.stroke();
      ctx.strokeStyle = '#3b2a8a'; ctx.lineWidth = 0.035 * R; ctx.beginPath(); ctx.moveTo(x + s * fr, y - 0.02 * R); ctx.lineTo(s * 0.97 * R, y - 0.08 * R); ctx.stroke();
    }
    ctx.strokeStyle = '#3b2a8a'; ctx.lineWidth = 0.035 * R;
    ctx.beginPath(); ctx.moveTo(-(EX * R - fr), y - 0.02 * R); ctx.quadraticCurveTo(0, y - 0.1 * R, EX * R - fr, y - 0.02 * R); ctx.stroke();
    if (ax > 0.45 && ax < 1.3) for (const s of [-1, 1]) { // блик пробегает по стёклам
      const cx = s * EX * R, p = (ax - 0.45 - (s > 0 ? 0.12 : 0)) / 0.6;
      if (p < 0 || p > 1) continue;
      ctx.save(); ctx.beginPath(); ctx.arc(cx, y, fr * 0.95, 0, TAU); ctx.clip();
      ctx.translate(cx - fr * 1.6 + p * fr * 3.2, y); ctx.rotate(0.6);
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(-0.035 * R, -fr * 1.5, 0.07 * R, fr * 3); ctx.fillRect(0.06 * R, -fr * 1.5, 0.025 * R, fr * 3);
      ctx.restore();
    }
  } else if (kind === 'sunglasses') {
    // реакция: очки съезжают на кончик носа, сердце смотрит поверх — и возвращает очки обратно
    const slide = ax < 0 ? 0 : ax < 0.3 ? ease.outBack(ax / 0.3) : ax < 0.95 ? 1 : 1 - ease.inOut(clamp01((ax - 0.95) / 0.3));
    const lift = L.love > 0.5 && ax < 0 ? -0.3 * R : 0, y = EY * R + lift + slide * 0.2 * R, rx = 0.22 * R, ry = 0.17 * R;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#2a1630'; ctx.lineWidth = 0.045 * R;
    ctx.beginPath(); ctx.moveTo(-EX * R + rx * 0.8, y - 0.08 * R); ctx.quadraticCurveTo(0, y - 0.14 * R, EX * R - rx * 0.8, y - 0.08 * R); ctx.stroke();
    for (const s of [-1, 1]) {
      const x = s * EX * R;
      ctx.strokeStyle = '#2a1630'; ctx.lineWidth = 0.045 * R; ctx.beginPath(); ctx.moveTo(x + s * rx * 0.9, y - 0.06 * R); ctx.lineTo(s * 0.98 * R, y - 0.1 * R); ctx.stroke();
      const lens = () => { ctx.beginPath(); ctx.moveTo(x - rx, y - ry * 0.7); ctx.quadraticCurveTo(x, y - ry * 1.15, x + rx, y - ry * 0.7); ctx.quadraticCurveTo(x + rx * 1.05, y + ry * 0.9, x, y + ry); ctx.quadraticCurveTo(x - rx * 1.05, y + ry * 0.9, x - rx, y - ry * 0.7); ctx.closePath(); };
      const g = ctx.createLinearGradient(0, y - ry, 0, y + ry); g.addColorStop(0, '#2b1a6a'); g.addColorStop(1, '#8a5cff');
      lens(); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#2a1630'; ctx.lineWidth = 0.04 * R; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.025 * R;
      ctx.beginPath(); ctx.moveTo(x - rx * 0.55, y + ry * 0.2); ctx.lineTo(x - rx * 0.1, y - ry * 0.5); ctx.stroke();
      ctx.lineWidth = 0.014 * R; ctx.beginPath(); ctx.moveTo(x - rx * 0.25, y + ry * 0.45); ctx.lineTo(x + rx * 0.15, y - ry * 0.2); ctx.stroke();
    }
  }
}

// ---------------- РЕСНИЧКИ ----------------
function lashes(type: string, eyes: string, R: number, L: Live, color: string) {
  const shades = eyes === 'sunglasses';
  const ax = actT(L, 'lashes', type), lg = 1 + (type === 'one' ? 0.5 * Math.abs(wob(ax, 2.5, 2)) : type === 'long' ? 0.5 * hump(ax, 1.3) : type === 'flutter' ? 0.25 * Math.abs(Math.sin(ax * TAU * 2.5)) * fade(ax) : type === 'lower' ? 0.3 * hump(ax, 1) : type === 'short' ? 0.5 * Math.abs(Math.sin(ax * TAU * 2)) * fade(ax) : 0);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const side of [-1, 1]) {
    // ресницы закрываются вместе с веком: то же решение «закрыт/моргает», что и у глаза (eyeBlink)
    // в очках ресницы растут из-за оправы (иначе оправа их перечёркивает); оправа не моргает — и ресницы на ней не прыгают
    const gl = eyes === 'glasses';
    const sp = eyeSpec(eyes, side), efx = eyeFx(L, eyes, side), b = eyeBlink(L, eyes, side), closed = !shades && !gl && (eyeClosed(L, eyes, side) || b > 0.85);
    const bl = closed || shades ? 1 : Math.max(0.1, 1 - b);
    const gy = gl ? -0.04 * R * hump(actT(L, 'eyes', 'glasses'), 0.5) : 0;
    const cx = side * EX * R, cy = EY * R + efx.dy * R + gy + (closed ? 0.05 * R : 0);
    const rx = (closed ? 0.11 : gl ? 0.225 : sp.rx * efx.sc) * R, ry = (closed ? 0.11 : gl ? 0.225 : sp.ry * efx.sc) * R * (gl ? 1 : bl);
    /** точка на краю глаза: a — угол для левого глаза (−π — внешний уголок, −π/2 — верх), правый зеркально */
    const pt = (a: number) => { const A = side < 0 ? a : -Math.PI - a; return { x: cx + Math.cos(A) * rx, y: cy + Math.sin(A) * ry, dx: Math.cos(A), dy: Math.sin(A) }; };
    const one = (a: number, len: number, curl: number, col = INK, w = 0.024, tip = 0) => {
      const p = pt(a), l = len * R * lg, th = side * -curl;
      const ex = p.x + (p.dx * Math.cos(th) - p.dy * Math.sin(th)) * l, ey = p.y + (p.dx * Math.sin(th) + p.dy * Math.cos(th)) * l;
      ctx.strokeStyle = col; ctx.lineWidth = w * R; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(p.x + p.dx * l * 0.6, p.y + p.dy * l * 0.6, ex, ey); ctx.stroke();
      if (tip) { ctx.fillStyle = col; circle(ex, ey, tip * R); }
      return [ex, ey];
    };
    if (type === 'one') one(-2.85, 0.12, 0.5, INK, 0.03);
    else if (type === 'short') [-2.7, -2.3, -1.9].forEach((a, i) => one(a, [0.06, 0.065, 0.055][i], 0.15));
    else if (type === 'long') [-2.7, -2.3, -1.9].forEach((a, i) => one(a, [0.12, 0.13, 0.11][i], 0.5));
    else if (type === 'flutter') [-2.95, -2.6, -2.25, -1.9, -1.55].forEach((a, i) => one(a, [0.14, 0.17, 0.17, 0.15, 0.11][i], 0.6, INK, 0.03));
    else if (type === 'color') { // реакция: цвета бегут по ресничкам
      const C = ['#ff5b6e', '#ffb02e', '#3fc46a', '#4da3ff', '#a46bff'], o = ax < 0 ? 0 : Math.floor(ax * 9);
      C.forEach((_, i) => one(-2.95 + i * 0.33, 0.13 * (1 + 0.35 * hump(ax - i * 0.08, 0.4)), 0.45, C[(i + o) % 5], 0.026, 0.024));
    }
    else if (type === 'lower') {
      [-2.6, -2.1].forEach(a => one(a, 0.07, 0.3));
      if (!closed) [2.8, 2.45, 2.1, 1.75].forEach((a, i) => one(a, [0.06, 0.08, 0.08, 0.06][i], -0.25, INK, 0.02, 0.012));
    } else if (type === 'wing') {
      // стрелка-«крылышко»: толстая линия по веку и хвостик наружу
      const fl = 1 + 0.7 * Math.abs(wob(ax, 2.8, 2)); // реакция: хвостик-крылышко взмахивает
      const o = pt(-Math.PI), fx = o.x + side * 0.13 * R * fl, fy = o.y - 0.1 * R * fl, m = pt(-2.55);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(m.x, m.y - 0.01 * R); ctx.quadraticCurveTo(o.x + side * 0.04 * R, o.y - 0.04 * R, fx, fy); ctx.lineTo(o.x + side * 0.005 * R, o.y + 0.01 * R); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 0.045 * R; ctx.beginPath();
      for (let i = 0; i <= 12; i++) { const p = pt(-Math.PI + i / 12 * (Math.PI / 2 + 0.25)); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
      ctx.stroke();
      [-2.4, -2.0].forEach(a => one(a, 0.1, 0.5));
    } else if (type === 'glitter') {
      // перламутровые тени с блёстками над глазом
      const [ga, gd] = palOf(color).acc, g = ctx.createLinearGradient(0, cy - ry * 1.7, 0, cy); g.addColorStop(0, ga === '#ffffff' ? '#e9dcff' : ga); g.addColorStop(1, gd);
      ctx.fillStyle = g; ctx.beginPath();
      for (let i = 0; i <= 16; i++) { const a = Math.PI + i / 16 * Math.PI; ctx.lineTo(cx + Math.cos(a) * rx * 1.02, cy + Math.sin(a) * ry * 1.02); }
      for (let i = 16; i >= 0; i--) { const a = Math.PI + i / 16 * Math.PI; ctx.lineTo(cx + Math.cos(a) * rx * 1.18, cy - 0.03 * R + Math.sin(a) * (ry * 1.25 + 0.06 * R)); }
      ctx.closePath(); ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(90,40,90,0.5)'; ctx.lineWidth = 0.012 * R; ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = Math.PI * (1.15 + i * 0.14), rr = 1.1 + (i % 2) * 0.1, tw = 0.5 + 0.5 * Math.sin(t * 5 + i * 1.7 + side) + 2.2 * hump(ax - i * 0.1, 0.5);
        ctx.fillStyle = i % 2 ? '#fff' : '#fff2a0'; circle(cx + Math.cos(a) * rx * rr, cy + Math.sin(a) * (ry * rr + 0.02 * R), (0.008 + 0.01 * tw) * R);
      }
      [-2.75, -2.4].forEach(a => one(a, 0.06, 0.3));
    } else if (type === 'brows') {
      const so = eyeSpec(eyes, side), oy = EY * R + efx.dy * R + gy + (so.closed ? 0.05 * R : 0), ory = (gl ? 0.225 : so.closed ? 0.11 : so.ry * efx.sc) * R; // брови не прыгают при моргании
      const by = oy - ory - 0.09 * R - L.mouth * 0.04 * R - 0.11 * R * Math.abs(Math.sin(ax * TAU * 2.5 + (side > 0 ? 0.6 : 0))) * fade(ax); // реакция: бровки скачут
      ctx.strokeStyle = INK; ctx.lineWidth = 0.04 * R;
      ctx.beginPath(); ctx.arc(cx, by + 0.12 * R, 0.15 * R, Math.PI * (side < 0 ? 1.22 : 1.3), Math.PI * (side < 0 ? 1.7 : 1.78)); ctx.stroke();
    }
  }
}

// ---------------- РОТ, НОС, ЩЁЧКИ ----------------
function mouth(R: number, L: Live) {
  const y = 0.22 * R;
  if (L.mouth > 0.05) {
    const h = (0.08 + 0.1 * clamp01(L.mouth)) * R;
    ctx.save(); ctx.beginPath(); ctx.moveTo(-0.12 * R, y); ctx.quadraticCurveTo(0, y + h * 2, 0.12 * R, y); ctx.closePath();
    ctx.fillStyle = '#7a1f3d'; ctx.fill(); ctx.clip(); ctx.fillStyle = '#ff7b9c'; ell(0, y + h * 1.2, 0.07 * R, 0.05 * R); ctx.restore();
  } else {
    ctx.strokeStyle = INK; ctx.lineWidth = 0.04 * R; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, y - 0.07 * R, 0.11 * R, 0.22 * Math.PI, 0.78 * Math.PI); ctx.stroke();
  }
}

function nose(kind: string, R: number, L: Live, color: string) {
  const y = 0.06 * R, ax = actT(L, 'nose', kind), P = palOf(color);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (kind === 'dot') { ctx.fillStyle = INK; ell(0, y, 0.045 * R, 0.035 * R); }
  else if (kind === 'tone') { // овал в тон сердцу (тёмный оттенок), с бликом
    ctx.fillStyle = color === 'yellow' ? '#a87300' : darkOf(color); ell(0, y, 0.05 * R, 0.036 * R);
    const k = hump(ax, 0.5) + hump(ax - 0.6, 0.5); // реакция: блик вспыхивает
    ctx.fillStyle = `rgba(255,255,255,${0.6 + 0.4 * Math.min(1, k)})`; ell(-0.015 * R, y - 0.014 * R, 0.016 * R * (1 + 0.5 * k), 0.008 * R * (1 + 0.5 * k), -0.3);
  } else if (kind === 'soft') { // розовая «кнопочка»
    const lt = warm(color), col = lt ? '#ffd3e0' : '#ff9fc0', dk = lt ? '#e87a98' : '#d9608f';
    ctx.fillStyle = col; ell(0, y, 0.06 * R, 0.045 * R); ctx.strokeStyle = dk; ctx.lineWidth = 0.012 * R; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ell(-0.02 * R, y - 0.017 * R, 0.018 * R, 0.009 * R, -0.3);
  } else if (kind === 'tri') { // треугольничек «как у зверька», без усов
    ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineWidth = 0.03 * R;
    ctx.beginPath(); ctx.moveTo(-0.035 * R, y - 0.018 * R); ctx.lineTo(0.035 * R, y - 0.018 * R); ctx.lineTo(0, y + 0.025 * R); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ell(-0.012 * R, y - 0.016 * R, 0.014 * R, 0.007 * R);
  } else if (kind === 'line') { // крошечная дужка
    ctx.strokeStyle = INK; ctx.lineWidth = 0.028 * R;
    ctx.beginPath(); ctx.arc(0, y - 0.02 * R, 0.035 * R, 0.25 * Math.PI, 0.75 * Math.PI); ctx.stroke();
  } else if (kind === 'heart') { // сердечко цвета «камня» — на красном светлое
    gemHeart(0, y + 0.005 * R, 0.08 * R, P.gem[0] === '#ffffff' ? '#ffe3ec' : P.gem[0], P.gem[1], R);
  } else if (kind === 'button') { // пуговка с дырочками (старый вариант из сохранений)
    ctx.fillStyle = '#ffcf3f'; circle(0, y, 0.085 * R); ctx.strokeStyle = '#b07d00'; ctx.lineWidth = 0.014 * R; ctx.stroke();
    ctx.lineWidth = 0.009 * R; ctx.beginPath(); ctx.arc(0, y, 0.062 * R, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#8a5a00'; for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) circle(dx * 0.022 * R, y + dy * 0.022 * R, 0.012 * R);
  } else if (kind === 'clown') {
    const g = ctx.createRadialGradient(-0.03 * R, y - 0.03 * R, 0.01 * R, 0, y, 0.095 * R); g.addColorStop(0, '#ff9a9a'); g.addColorStop(1, '#e0102f');
    ctx.beginPath(); ctx.arc(0, y, 0.095 * R, 0, TAU); if (warm(color)) halo(0.05 * R);
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#a0001c'; ctx.lineWidth = 0.012 * R; ctx.stroke(); ctx.fillStyle = '#fff'; circle(-0.035 * R, y - 0.035 * R, 0.026 * R);
  } else if (kind === 'cat' || kind === 'bunny') { // кошачий носик с короткими усиками (не заходят на глаза и щёчки)
    ctx.strokeStyle = INK; ctx.lineWidth = 0.014 * R;
    const tw = 0.05 * Math.sin(ax * TAU * 3) * fade(ax); // реакция: усики шевелятся
    for (const s of [-1, 1]) for (const k of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(s * 0.075 * R, y + 0.03 * R); ctx.lineTo(s * 0.2 * R * (1 + 0.15 * hump(ax, 0.6)), y + 0.03 * R + k * 0.035 * R + tw * R * (k + 1.5)); ctx.stroke(); }
    ctx.fillStyle = '#ff8fb5'; ctx.beginPath(); ctx.moveTo(-0.06 * R, y - 0.03 * R); ctx.lineTo(0.06 * R, y - 0.03 * R); ctx.lineTo(0, y + 0.04 * R); ctx.closePath();
    ctx.lineWidth = 0.03 * R; ctx.strokeStyle = '#ff8fb5'; ctx.stroke(); ctx.fill();
    ctx.strokeStyle = '#c24d75'; ctx.lineWidth = 0.01 * R; ctx.stroke();
  } else if (kind === 'pig') { // пятачок
    ctx.beginPath(); ctx.ellipse(0, y, 0.11 * R, 0.075 * R, 0, 0, TAU); if (warm(color)) halo(0.045 * R);
    ctx.fillStyle = '#ffb3c8'; ctx.fill(); ctx.strokeStyle = '#c24d75'; ctx.lineWidth = 0.016 * R; ctx.stroke();
    ctx.fillStyle = '#c24d75'; ell(-0.035 * R, y, 0.018 * R, 0.03 * R); ell(0.035 * R, y, 0.018 * R, 0.03 * R);
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ell(-0.05 * R, y - 0.045 * R, 0.025 * R, 0.01 * R, -0.3);
  } else if (kind === 'strawberry') { // клубничка — крупнее, три семечка, светлая обводка на тёплом сердце
    ctx.save(); ctx.translate(0, y); ctx.scale(1.3, 1.3); ctx.translate(0, -y);
    ctx.beginPath(); ctx.moveTo(0, y + 0.09 * R);
    ctx.bezierCurveTo(-0.1 * R, y + 0.04 * R, -0.1 * R, y - 0.06 * R, 0, y - 0.045 * R);
    ctx.bezierCurveTo(0.1 * R, y - 0.06 * R, 0.1 * R, y + 0.04 * R, 0, y + 0.09 * R); ctx.closePath();
    if (warm(color)) halo(0.04 * R);
    ctx.fillStyle = '#ff3b5c'; ctx.fill(); ctx.strokeStyle = '#b3123a'; ctx.lineWidth = 0.012 * R; ctx.stroke();
    ctx.fillStyle = '#ffe680'; for (const [dx, dy] of [[-0.035, 0.0], [0.035, 0.0], [0, 0.04]]) ell(dx * R, y + dy * R, 0.01 * R, 0.015 * R);
    ctx.fillStyle = '#4caf50'; for (const a of [-2.4, -1.57, -0.7]) ell(Math.cos(a) * 0.03 * R, y - 0.05 * R + Math.sin(a) * 0.012 * R, 0.035 * R, 0.016 * R, a);
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ell(-0.05 * R, y + 0.0 * R, 0.012 * R, 0.024 * R, 0.3);
    ctx.restore();
  } else if (kind === 'dog') { // блестящий собачий нос
    ctx.beginPath(); ctx.moveTo(0, y + 0.055 * R);
    ctx.bezierCurveTo(-0.07 * R, y + 0.045 * R, -0.11 * R, y - 0.01 * R, -0.08 * R, y - 0.04 * R);
    ctx.quadraticCurveTo(0, y - 0.07 * R, 0.08 * R, y - 0.04 * R);
    ctx.bezierCurveTo(0.11 * R, y - 0.01 * R, 0.07 * R, y + 0.045 * R, 0, y + 0.055 * R); ctx.closePath();
    ctx.fillStyle = '#2b1a22'; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ell(-0.025 * R, y - 0.03 * R, 0.03 * R, 0.013 * R, -0.1);
  } else if (kind === 'mustache') { // усы-завитушки
    ctx.fillStyle = '#ff8fb5'; ell(0, y - 0.01 * R, 0.035 * R, 0.028 * R);
    ctx.fillStyle = '#5a3220';
    for (const s of [-1, 1]) {
      ctx.save(); ctx.scale(s, 1);
      ctx.translate(0.04 * R, y + 0.05 * R); ctx.rotate(-0.25 * Math.sin(ax * TAU * 2) * fade(ax)); ctx.translate(-0.04 * R, -y - 0.05 * R); // реакция: усы шевелятся
      ctx.beginPath(); ctx.moveTo(0, y + 0.03 * R);
      ctx.bezierCurveTo(0.06 * R, y - 0.0 * R, 0.14 * R, y + 0.02 * R, 0.17 * R, y + 0.055 * R);
      ctx.bezierCurveTo(0.2 * R, y + 0.08 * R, 0.25 * R, y + 0.06 * R, 0.24 * R, y + 0.02 * R);
      ctx.bezierCurveTo(0.27 * R, y + 0.08 * R, 0.21 * R, y + 0.11 * R, 0.15 * R, y + 0.095 * R);
      ctx.bezierCurveTo(0.09 * R, y + 0.085 * R, 0.04 * R, y + 0.08 * R, 0, y + 0.07 * R); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
}

/** Реакция щёчек: масштаб, поворот, сплющивание одной щёчки (s — сторона) */
function cheekFx(kind: string, x: number, s: number): { sc: number; rot: number; sy: number } {
  const r = { sc: 1, rot: 0, sy: 1 };
  if (x < 0) return r;
  if (kind === 'blush' || kind === 'shine') r.sc = 1 + 0.35 * hump(x, 1.6);
  else if (kind === 'hearts') { const b = (y: number) => hump(y, 0.14) + 0.7 * hump(y - 0.22, 0.14); r.sc = 1 + 0.45 * (b(x) + b(x - 0.7)); } // сердечки бьются «тук-тук»
  else if (kind === 'doll') r.sc = 1 + 0.45 * hump(x, 0.5) + 0.12 * wob(x - 0.5, 2, 4);            // надула щёчки — «пуф!»
  else if (kind === 'swirl') r.rot = s * x * 9 * fade(x);                                       // завитки кружатся
  else if (kind === 'rainbow') r.sc = 1 + 0.3 * Math.abs(wob(x, 2, 2));
  else if (kind === 'daisy') r.rot = s * x * 7 * fade(x);                                       // ромашки-вертушки
  else if (kind === 'paw') r.sy = 1 - 0.35 * Math.abs(Math.sin(x * TAU * 2.5 + (s > 0 ? 1.2 : 0))) * fade(x); // лапки топают
  return r;
}

/** Масштаб наклеек-щёчек (румянец и сердечки — в своём размере) */
const CHEEK_SC: Record<string, number> = { blush: 1, swirl: 1, shine: 1, hearts: 1, rainbow: 1.2 };

function cheeks(kind: string, R: number, L: Live, color: string) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const ax = actT(L, 'cheeks', kind), bl = palOf(color).blush;
  for (const s of [-1, 1]) {
    const x = s * 0.56 * R, y = 0.1 * R, fx = cheekFx(kind, ax, s), sc = CHEEK_SC[kind] ?? 1.4;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(fx.rot); ctx.scale(fx.sc * sc, fx.sc * fx.sy * sc); ctx.translate(-x, -y);
    if (kind === 'blush' || kind === 'shine') { // румянец цвета из палитры; реакция: краснеют сильнее
      ctx.fillStyle = rgba(bl); ell(x, y, 0.14 * R, 0.085 * R);
      const k = hump(ax, 1.6); if (k > 0) { ctx.fillStyle = `rgba(255,60,120,${0.35 * k})`; ell(x, y, 0.14 * R, 0.085 * R); }
      if (kind === 'shine') { // три белых штриха-блика; реакция: блики вспыхивают
        const g = hump(ax - 0.1, 0.5) + hump(ax - 0.8, 0.5);
        ctx.strokeStyle = `rgba(255,255,255,${0.8 + 0.2 * Math.min(1, g)})`; ctx.lineWidth = 0.018 * R * (1 + 0.5 * g);
        for (const k of [-1, 0, 1]) { const xx = x + k * 0.045 * R, l = 1 + 0.4 * g; ctx.beginPath(); ctx.moveTo(xx + 0.015 * R * l, y - 0.03 * R * l); ctx.lineTo(xx - 0.015 * R * l, y + 0.03 * R * l); ctx.stroke(); }
      }
    } else if (kind === 'hearts') { // сердечки-румянец, чуть повёрнуты наружу
      const col = color === 'red' || color === 'orange' ? '#ffc4d0' : color === 'pink' || color === 'dots' ? '#ff4f93' : '#ff8fb8';
      ctx.save(); ctx.translate(x, y + 0.02 * R); ctx.rotate(s * 0.2); heartShape(0.085 * R); ctx.globalAlpha = 0.92; ctx.fillStyle = col; ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ell(-0.035 * R, -0.04 * R, 0.014 * R, 0.009 * R, -0.6); ctx.restore();
    } else if (kind === 'doll') { // круглые кукольные щёчки: мягкое пятно без обводки
      const g = ctx.createRadialGradient(x, y, 0.01 * R, x, y, 0.085 * R);
      g.addColorStop(0, rgba(bl, Math.min(1, bl[3] + 0.3))); g.addColorStop(0.6, rgba(bl, Math.min(1, bl[3] + 0.15))); g.addColorStop(1, rgba(bl, 0));
      ctx.fillStyle = g; circle(x, y, 0.085 * R);
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; circle(x - 0.025 * R, y - 0.025 * R, 0.016 * R);
    } else if (kind === 'freckles') { // реакция: веснушки пляшут по очереди
      ctx.fillStyle = 'rgba(140,70,40,0.65)';
      ([[-0.05, -0.02, 0.018], [0.04, -0.03, 0.018], [0, 0.03, 0.018], [0.07, 0.03, 0.015], [-0.07, 0.03, 0.014]] as const).forEach(([dx, dy, r], i) =>
        circle(x + dx * R, y + dy * R - 0.035 * R * Math.abs(Math.sin(ax * TAU * 2 + i * 1.3)) * fade(ax), r * R));
    }
    else if (kind === 'swirl') {
      ctx.strokeStyle = rgba(bl, Math.max(0.8, bl[3])); ctx.lineWidth = 0.03 * R; ctx.beginPath();
      for (let i = 0; i <= 30; i++) { const a = i * 0.42 * s, r = 0.008 * R + i * 0.0028 * R; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8); }
      ctx.stroke();
    } else if (kind === 'rainbow') { // наклейка-радуга с облачками
      const cy = y + 0.04 * R;
      const RC = ['#ff5b6e', '#ffd93d', '#6bd47a', '#4da3ff'], o = ax < 0 ? 0 : Math.floor(ax * 8); // реакция: цвета перебегают
      RC.forEach((_, i) => { ctx.strokeStyle = RC[(i + o) % 4]; ctx.lineWidth = 0.022 * R; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.arc(x, cy, (0.1 - i * 0.021) * R, Math.PI, TAU); ctx.stroke(); });
      for (const d of [-1, 1]) { ctx.fillStyle = '#fff'; circle(x + d * 0.07 * R, cy, 0.026 * R); circle(x + d * 0.095 * R, cy + 0.005 * R, 0.02 * R); ctx.strokeStyle = 'rgba(150,120,170,0.5)'; ctx.lineWidth = 0.006 * R; ctx.beginPath(); ctx.arc(x + d * 0.07 * R, cy, 0.026 * R, 0, TAU); ctx.stroke(); }
    } else if (kind === 'daisy') { // ромашка
      ctx.strokeStyle = '#d9a8bf'; ctx.lineWidth = 0.012 * R;
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + s * 0.2; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 0.045 * R, y + Math.sin(a) * 0.045 * R, 0.035 * R, 0.016 * R, a, 0, TAU); ctx.stroke(); }
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + s * 0.2; ell(x + Math.cos(a) * 0.045 * R, y + Math.sin(a) * 0.045 * R, 0.035 * R, 0.016 * R, a); }
      ctx.fillStyle = '#ffc83a'; circle(x, y, 0.025 * R); ctx.strokeStyle = '#d99a00'; ctx.lineWidth = 0.006 * R; ctx.stroke();
    } else if (kind === 'candy') { // разноцветная посыпка
      const cols = ['#ff4f9a', '#ffd23f', '#4da3ff', '#5cc160', '#a46bff', '#ff9636'];
      const P = [[-0.07, -0.03, 0.4], [0.0, -0.05, -0.6], [0.07, -0.02, 1.1], [-0.04, 0.03, -1.2], [0.04, 0.04, 0.3], [-0.0, 0.0, 1.6]];
      P.forEach(([dx, dy, a], i) => { // реакция: посыпка подскакивает и вертится
        const j = Math.abs(Math.sin(ax * TAU * 2.5 + i)) * fade(ax);
        ctx.save(); ctx.translate(x + dx * R * s, y + dy * R - 0.05 * R * j); ctx.rotate(a * s + j * 2); ctx.strokeStyle = 'rgba(80,30,60,0.35)'; ctx.lineWidth = 0.03 * R; ctx.beginPath(); ctx.moveTo(-0.02 * R, 0); ctx.lineTo(0.02 * R, 0); ctx.stroke(); ctx.strokeStyle = cols[i]; ctx.lineWidth = 0.02 * R; ctx.stroke(); ctx.restore(); });
    } else if (kind === 'paw') { // отпечаток лапки
      ctx.fillStyle = '#ff7aa8'; ctx.strokeStyle = '#c94a7c'; ctx.lineWidth = 0.007 * R;
      const shapes: [number, number, number, number][] = [[0, 0.025, 0.045, 0.036], [-0.055, -0.02, 0.018, 0.022], [-0.02, -0.05, 0.018, 0.022], [0.02, -0.05, 0.018, 0.022], [0.055, -0.02, 0.018, 0.022]];
      for (const [dx, dy, a, b] of shapes) { ell(x + dx * R, y + dy * R, a * R, b * R); ctx.stroke(); }
    }
    ctx.restore();
  }
}

// ---------------- ПРИЧЁСКИ ----------------
const HAIR: Record<string, [string, string]> = { long: ['#ffd36b', '#d99a2b'], pigtails: ['#a8653c', '#6e3d1f'], bun: ['#8a4b2a', '#5a2c14'], afro: ['#6b3a22', '#3e1f0f'] };
/** Цвет волос: на жёлтом сердце блонд сливается — тогда каштановые */
const hairCol = (kind: string, color: string): [string, string] => (kind === 'long' && (color === 'yellow' || color === 'orange') ? ['#c98a4b', '#8a5228'] : HAIR[kind]);

function hairBack(kind: string, R: number, L: Live, color: string) {
  const ax = actT(L, 'hair', kind);
  if (kind === 'long') {
    const [c, d] = hairCol('long', color);
    for (const s of [-1, 1]) {
      ctx.save(); ctx.scale(s, 1);
      ctx.beginPath(); ctx.moveTo(0, -0.95 * R);
      ctx.bezierCurveTo(-0.95 * R, -1.38 * R, -1.42 * R, -0.6 * R, -1.27 * R, 0.2 * R);
      ctx.bezierCurveTo(-1.2 * R, 0.55 * R, -1.22 * R, 0.7 * R, -1.08 * R, 0.86 * R);
      ctx.quadraticCurveTo(-0.98 * R, 0.66 * R, -0.82 * R, 0.78 * R);
      ctx.quadraticCurveTo(-0.72 * R, 0.56 * R, -0.52 * R, 0.62 * R);
      ctx.lineTo(0, 0.1 * R); ctx.closePath();
      ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = d; ctx.lineWidth = 0.025 * R; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-1.12 * R, -0.3 * R); ctx.quadraticCurveTo(-1.2 * R, 0.3 * R, -1.02 * R, 0.7 * R); ctx.stroke();
      ctx.restore();
    }
  } else if (kind === 'pigtails') {
    const [c, d] = hairCol('pigtails', color);
    for (const s of [-1, 1]) {
      const spin = ax < 0 ? 0 : s * 0.6 * Math.sin(ax * TAU * 2.2) * fade(ax); // реакция: хвостики машут вверх-вниз, как пропеллер
      ctx.save(); ctx.translate(s * 0.86 * R, -0.72 * R); ctx.rotate(-s * 0.3 + spin + L.swing * 0.8 + (L.live ? Math.sin(t * 2.4 + s) * 0.06 : 0)); ctx.scale(s, 1);
      ctx.beginPath(); ctx.moveTo(0, -0.12 * R);
      ctx.bezierCurveTo(0.4 * R, -0.32 * R, 0.78 * R, -0.05 * R, 0.66 * R, 0.42 * R);
      ctx.quadraticCurveTo(0.6 * R, 0.25 * R, 0.5 * R, 0.3 * R);
      ctx.bezierCurveTo(0.42 * R, 0.12 * R, 0.25 * R, 0.12 * R, 0, 0.12 * R); ctx.closePath();
      ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = d; ctx.lineWidth = 0.025 * R; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0.15 * R, -0.05 * R); ctx.quadraticCurveTo(0.5 * R, -0.05 * R, 0.6 * R, 0.3 * R); ctx.stroke();
      ctx.restore();
    }
  } else if (kind === 'bun') {
    const [c, d] = hairCol('bun', color);
    ctx.fillStyle = c; circle(0, -0.84 * R, 0.3 * R); ctx.strokeStyle = d; ctx.lineWidth = 0.025 * R; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -0.84 * R, 0.18 * R, Math.PI * 1.1, Math.PI * 1.8); ctx.stroke();
  } else if (kind === 'afro') { // пышные кудряшки-облако
    const [c, d] = hairCol('afro', color), P: [number, number, number][] = [];
    for (let i = 0; i <= 14; i++) { const a = Math.PI * (0.9 + i * 1.2 / 14); P.push([Math.cos(a) * 1.1 * R, -0.42 * R + Math.sin(a) * 0.72 * R, (0.27 + (i % 2) * 0.04) * R]); }
    if (ax >= 0) P.forEach((q, i) => { q[1] -= 0.05 * R * Math.abs(Math.sin(ax * TAU * 2.2 + i * 0.7)) * fade(ax); }); // реакция: кудряшки пляшут волной
    ctx.fillStyle = d; for (const [x, y, r] of P) circle(x, y, r + 0.025 * R); ell(0, -0.45 * R, 1.1 * R, 0.6 * R);
    ctx.fillStyle = c; for (const [x, y, r] of P) circle(x, y, r); ell(0, -0.45 * R, 1.08 * R, 0.58 * R);
    ctx.strokeStyle = 'rgba(255,220,190,0.35)'; ctx.lineWidth = 0.025 * R; ctx.lineCap = 'round';
    P.forEach(([x, y, r], i) => { if (i % 2 === 0) { ctx.beginPath(); ctx.arc(x, y, r * 0.5, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); } });
  } else if (kind === 'cat') { // кошачьи ушки цвета сердца
    for (const s of [-1, 1]) {
      ctx.save(); ctx.scale(s, 1); ctx.lineJoin = 'round';
      const [x1, y1] = topPoint(0.2, R), [x2, y2] = topPoint(0.85, R);
      // реакция: ушки дёргаются по очереди (поворот вокруг основания)
      const tw = 0.3 * Math.sin(ax * TAU * 3) * hump(ax - (s > 0 ? 0.45 : 0), 0.5);
      if (tw) { const bx = (x1 + x2) / 2, by = (y1 + y2) / 2; ctx.translate(bx, by); ctx.rotate(tw); ctx.translate(-bx, -by); }
      const tx = (x1 + x2) / 2 - 0.12 * R, ty = Math.min(y1, y2) - 0.42 * R;
      ctx.beginPath(); ctx.moveTo(x1, y1 + 0.1 * R); ctx.quadraticCurveTo(tx + 0.05 * R, ty - 0.02 * R, tx, ty); ctx.quadraticCurveTo(tx - 0.03 * R, ty + 0.1 * R, x2, y2 + 0.1 * R); ctx.closePath();
      ctx.fillStyle = baseOf(color); ctx.fill(); ctx.strokeStyle = darkOf(color); ctx.lineWidth = 0.035 * R; ctx.stroke();
      const mx = (x1 + x2) / 2 - 0.02 * R, my = (y1 + y2) / 2;
      ctx.beginPath(); ctx.moveTo(mx + 0.12 * R, my); ctx.quadraticCurveTo(tx + 0.04 * R, ty + 0.06 * R, tx + 0.01 * R, ty + 0.1 * R); ctx.quadraticCurveTo(tx - 0.02 * R, ty + 0.18 * R, mx - 0.14 * R, my + 0.04 * R); ctx.closePath();
      ctx.fillStyle = '#ffb3cf'; ctx.fill();
      ctx.restore();
    }
  } else if (kind === 'bunny') { // длинные заячьи ушки, одно чуть согнуто
    for (const s of [-1, 1]) {
      // реакция: ушки подпрыгивают и хлопают вверх-вниз
      const hop = ax < 0 ? 0 : hump(ax, 0.42) + hump(ax - 0.45, 0.42), flap = ax < 0 ? 0 : 0.35 * Math.sin(ax * TAU * 2.4 + s) * fade(ax);
      ctx.save(); ctx.translate(s * 0.4 * R, -0.8 * R - 0.1 * R * hop); ctx.rotate(s * (s > 0 ? 0.45 : 0.18) * (1 - 0.6 * hop) + flap + (L.live ? Math.sin(t * 1.8 + s) * 0.05 : 0) + L.swing * 0.3);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#c9a3b8'; ctx.lineWidth = 0.03 * R;
      ell(0, -0.42 * R, 0.15 * R, 0.46 * R); ctx.stroke();
      ctx.fillStyle = '#ffc2d8'; ell(0, -0.4 * R, 0.075 * R, 0.33 * R);
      ctx.restore();
    }
  }
}

/** Чёлка: волосы на макушке, обрезанные по контуру сердца, с фестонами внизу */
/** Нижний край чёлки (без фестонов) */
const bangY = (x: number, R: number) => -0.42 * R - 0.16 * R * Math.sin(Math.PI * Math.min(1, Math.abs(x) / R));
/** Обрезка «всё, что ниже чёлки» — по середине фестонов */
function bangsClip(R: number, curly: boolean) {
  ctx.beginPath(); ctx.moveTo(-1.4 * R, 1.4 * R);
  for (let i = 0; i <= 28; i++) { const x = -1.4 * R + i * 0.1 * R; ctx.lineTo(x, bangY(x, R) + (curly ? 0.07 : 0.055) * R); }
  ctx.lineTo(1.4 * R, 1.4 * R); ctx.closePath(); ctx.clip();
}
/** Область чёлки (с фестонами) — путь; без beginPath, чтобы можно было добавить к другому пути */
function bangsArea(R: number, curly: boolean) {
  const yb = (x: number) => bangY(x, R);
  ctx.moveTo(-1.2 * R, -1.3 * R); ctx.lineTo(1.2 * R, -1.3 * R); ctx.lineTo(1.2 * R, yb(1.1 * R));
  const N = curly ? 12 : 9, w = 2.2 * R / N;
  for (let i = 0; i < N; i++) { const x0 = 1.1 * R - i * w, x1 = x0 - w, xm = (x0 + x1) / 2; ctx.quadraticCurveTo(xm, yb(xm) + (curly ? 0.13 : 0.1) * R, x1, yb(x1)); }
  ctx.lineTo(-1.2 * R, yb(1.1 * R)); ctx.closePath();
}
/** Обрезка «всё, кроме чёлки» — для контура сердца под ней. s — масштаб «выпрыгивания» причёски от (0, −0.7R) */
function belowBangs(R: number, curly: boolean, s = 1) {
  ctx.beginPath(); ctx.rect(-2 * R, -2 * R, 4 * R, 4 * R);
  ctx.save(); ctx.translate(0, -0.7 * R); ctx.scale(s, s); ctx.translate(0, 0.7 * R); bangsArea(R, curly); ctx.restore(); // путь запоминается уже с масштабом
  ctx.clip('evenodd');
}
/** Тёмный край волос по контуру сердца в области чёлки. Рисуется до задних волос — виден только там, где за сердцем фон */
function bangsEdge(kind: string, R: number, color: string) {
  const [, dk] = hairCol(kind, color);
  ctx.save(); ctx.beginPath(); bangsArea(R, kind === 'afro'); ctx.clip();
  heartShape(R); ctx.strokeStyle = dk; ctx.lineWidth = 0.065 * R; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
}
function bangs(R: number, col: string, dk: string, curly = false) {
  // кайма цвета волос чуть за контур сердца: закрывает край тела, сливается с задними волосами
  ctx.save(); ctx.beginPath(); bangsArea(R, curly); ctx.clip();
  heartShape(R); ctx.strokeStyle = col; ctx.lineWidth = 0.035 * R; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
  const yb = (x: number) => bangY(x, R);
  ctx.save(); heartShape(R); ctx.clip();
  ctx.beginPath(); bangsArea(R, curly);
  ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = dk; ctx.lineWidth = 0.025 * R; ctx.stroke();
  if (curly) {
    ctx.strokeStyle = 'rgba(255,220,190,0.4)'; ctx.lineWidth = 0.025 * R; ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) { const x = -0.85 * R + i * 0.21 * R; ctx.beginPath(); ctx.arc(x, yb(x) - 0.06 * R, 0.05 * R, 0.2, Math.PI * 1.4); ctx.stroke(); }
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.04 * R; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(-0.5 * R, -0.45 * R, 0.4 * R, Math.PI * 1.25, Math.PI * 1.6); ctx.stroke();
  }
  ctx.restore();
  ctx.save(); belowBangs(R, curly); heartShape(R); ctx.strokeStyle = dk; ctx.lineWidth = 0.02 * R; ctx.stroke(); ctx.restore(); // ниже чёлки — как было
}

function hairBangs(kind: string, R: number, color: string) {
  if (HAIR[kind]) { const [c, d] = hairCol(kind, color); bangs(R, c, d, kind === 'afro'); }
}

export function bow(x: number, y: number, s: number, rot: number, col = '#ff4fa0', dk = '#c21f6e') {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = col; ctx.strokeStyle = dk; ctx.lineWidth = 0.08 * s; ctx.lineJoin = 'round';
  for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0.1 * sd * s, 0.15 * s); ctx.lineTo(0.45 * sd * s, 0.95 * s); ctx.lineTo(0.2 * sd * s, 0.85 * s); ctx.lineTo(0, 0.1 * s); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  for (const sd of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(sd * 0.9 * s, -0.85 * s, sd * 1.25 * s, 0.75 * s, 0, 0); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; circle(sd * 0.6 * s, -0.12 * s, 0.09 * s); circle(sd * 0.8 * s, 0.18 * s, 0.07 * s); ctx.fillStyle = col;
  }
  circle(0, 0, 0.22 * s); ctx.stroke();
  ctx.restore();
}

function crown(R: number, ax = -1, M: [string, string, string] = GOLD) {
  ctx.save(); ctx.translate(0, -0.56 * R); ctx.rotate(0.08);
  const w = 0.32 * R, h = 0.42 * R;
  const g = ctx.createLinearGradient(0, -h, 0, 0); g.addColorStop(0, M[0]); g.addColorStop(1, M[1]);
  ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(-w * 1.1, -h * 0.85); ctx.lineTo(-w * 0.5, -h * 0.45); ctx.lineTo(0, -h); ctx.lineTo(w * 0.5, -h * 0.45); ctx.lineTo(w * 1.1, -h * 0.85); ctx.lineTo(w, 0); ctx.closePath();
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = M[2]; ctx.lineWidth = 0.028 * R; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.fillStyle = '#ff3d7f'; circle(0, -0.18 * h, 0.06 * R); ctx.fillStyle = '#4da3ff'; circle(-w * 0.62, -0.15 * h, 0.04 * R); circle(w * 0.62, -0.15 * h, 0.04 * R);
  ctx.fillStyle = '#fff'; for (const [x, y] of [[-w * 1.1, -h * 0.85], [0, -h], [w * 1.1, -h * 0.85]]) circle(x, y, 0.035 * R);
  ctx.save(); ctx.translate(w * 0.75, -h * 0.6); ctx.rotate(t * 2); starPath(4, 0.06 * R * (0.7 + 0.3 * Math.sin(t * 5)), 0.015 * R); ctx.fill(); ctx.restore();
  if (ax >= 0) for (const [x, y, d] of [[-w * 1.1, -h * 0.85, 0.2], [0, -h, 0], [w * 1.1, -h * 0.85, 0.4]]) { // реакция: зубцы короны сверкают
    const k = hump(ax - d, 0.7); if (k <= 0) continue;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ax * 4); ctx.fillStyle = '#fff'; starPath(4, 0.1 * R * k, 0.02 * R); ctx.fill(); ctx.restore();
  }
  ctx.restore();
}

/** Ободок по верхнему контуру сердца (цвет акцента) с бантиком сбоку; реакция: по ободку бежит блеск, бантик хлопает */
function headband(R: number, ax: number, P: Pal) {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 12; i++) { const [x, y] = topPoint(0.98 - i * 0.98 / 12, R); pts.push([x + 0.03 * R, y + 0.06 * R]); }
  for (let i = 12; i >= 0; i--) { const [x, y] = pts[i]; pts.push([-x, y]); }
  const path = () => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  path(); ctx.strokeStyle = P.acc[1]; ctx.lineWidth = 0.085 * R; ctx.stroke();
  path(); ctx.strokeStyle = P.acc[0]; ctx.lineWidth = 0.058 * R; ctx.stroke();
  ctx.save(); path(); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 0.016 * R; ctx.translate(0, -0.012 * R); ctx.stroke(); ctx.restore();
  if (ax >= 0) { const p = clamp01(ax / 1.2), i = Math.min(pts.length - 1, Math.floor(p * pts.length)), [x, y] = pts[i], k = hump(ax, 1.2);
    ctx.save(); ctx.translate(x, y); ctx.rotate(ax * 5); ctx.fillStyle = '#fff'; starPath(4, 0.09 * R * k, 0.02 * R); ctx.fill(); ctx.restore(); }
  const [bx, by] = topPoint(0.55, R);
  bow(bx + 0.03 * R, by + 0.06 * R, 0.15 * R * (1 + 0.3 * Math.abs(wob(ax, 2, 2.5))), -0.45, P.acc[0] === '#ffffff' ? '#ff9ccf' : P.acc[0], P.acc[1]);
}
/** Заколки: звёздочка (металл) и сердечко (камень) на макушке слева; реакция: звёздочка крутится и сверкает */
function hairClip(R: number, ax: number, P: Pal) {
  const [x1, y1] = topPoint(0.4, R), [x2, y2] = topPoint(0.72, R), M = P.metal;
  gemHeart(x2 + 0.07 * R, y2 + 0.1 * R, 0.1 * R * (1 + 0.25 * hump(ax - 0.5, 0.5)), P.gem[0], P.gem[1], R, -0.5);
  const sp = ax < 0 ? 0 : TAU * ease.inOut(clamp01(ax / 0.9)), k = 1 + 0.3 * hump(ax, 0.9);
  ctx.save(); ctx.translate(x1 + 0.02 * R, y1 + 0.08 * R); ctx.rotate(-0.3 + sp); ctx.scale(k, k);
  starPath(5, 0.13 * R, 0.06 * R); ctx.fillStyle = M[1]; ctx.fill(); ctx.strokeStyle = M[2]; ctx.lineWidth = 0.02 * R; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; circle(-0.03 * R, -0.03 * R, 0.022 * R);
  ctx.restore();
  if (ax >= 0) { const g = hump(ax - 0.6, 0.6); if (g > 0) { ctx.save(); ctx.translate(x1 - 0.1 * R, y1 - 0.05 * R); ctx.fillStyle = '#fff'; starPath(4, 0.08 * R * g, 0.018 * R); ctx.fill(); ctx.restore(); } }
}

/** Точка на верхнем контуре сердца (левая половина, s от 0 у ложбинки до 1 у бока) */
function topPoint(s: number, R: number): [number, number] {
  const u = 1 - s, p0 = [0, -0.5], c1 = [-0.15, -0.95], c2 = [-0.95, -1.05], p3 = [-1.0, -0.4];
  const b = (i: number) => u * u * u * p0[i] + 3 * u * u * s * c1[i] + 3 * u * s * s * c2[i] + s * s * s * p3[i];
  return [b(0) * R, b(1) * R];
}

function hairFront(kind: string, R: number, L: Live, color: string) {
  const ax = actT(L, 'hair', kind), P = palOf(color), [ac, ad] = P.acc;
  if (kind === 'bow') bow(-0.52 * R, -0.9 * R, 0.32 * R, -0.35 + L.swing * 0.3, ac, ad);
  else if (kind === 'pigtails') { for (const s of [-1, 1]) { ctx.fillStyle = ac; circle(s * 0.86 * R, -0.72 * R, 0.085 * R); ctx.strokeStyle = ad; ctx.lineWidth = 0.016 * R; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; circle(s * 0.86 * R - 0.03 * R, -0.75 * R, 0.025 * R); } }
  else if (kind === 'bun') bow(0.2 * R, -1.02 * R, 0.16 * R, 0.4, ac, ad);
  else if (kind === 'long') { // заколка
    ctx.save(); ctx.translate(0.58 * R, -0.8 * R); ctx.rotate(0.45);
    ctx.fillStyle = ac; ell(0, 0, 0.13 * R, 0.045 * R); ctx.strokeStyle = ad; ctx.lineWidth = 0.014 * R; ctx.stroke();
    ctx.fillStyle = '#fff'; for (const d of [-1, 0, 1]) circle(d * 0.07 * R, 0, 0.018 * R);
    ctx.restore();
  } else if (kind === 'afro') flower(0.55 * R, -0.88 * R, 0.11 * R, ac === '#ffffff' ? '#ff9ccf' : ac, 0.3);
  else if (kind === 'crown') crown(R, ax, P.metal);
  else if (kind === 'headband') headband(R, ax, P);
  else if (kind === 'clip') hairClip(R, ax, P);
  else if (kind === 'flowers') {
    const cols = ['#ff7aa8', '#ffd23f', '#c9a7ff', '#ffffff', '#7fd1ff'];
    const pts: [number, number][] = [];
    for (const s of [0.95, 0.72, 0.45, 0.2]) { const [x, y] = topPoint(s, R); pts.push([x, y]); }
    for (const s of [0.2, 0.45, 0.72, 0.95]) { const [x, y] = topPoint(s, R); pts.push([-x, y]); }
    ctx.fillStyle = '#5cc160';
    pts.forEach(([x, y], i) => { if (i < pts.length - 1) { const [x2, y2] = pts[i + 1]; ell((x + x2) / 2, (y + y2) / 2 - 0.03 * R, 0.08 * R, 0.035 * R, Math.atan2(y2 - y, x2 - x)); } });
    // реакция: цветочки раскрываются по очереди и кружатся
    pts.forEach(([x, y], i) => flower(x, y + 0.02 * R, 0.1 * R * (1 + 0.5 * hump(ax - i * 0.08, 0.5)), cols[i % cols.length], i + (ax < 0 ? 0 : ax * 4 * fade(ax))));
  } else if (kind === 'unicorn') {
    ctx.save(); ctx.translate(0, -0.52 * R);
    const g = ctx.createLinearGradient(-0.1 * R, 0, 0.1 * R, -0.7 * R); g.addColorStop(0, '#fff6c8'); g.addColorStop(0.5, '#ffc6e8'); g.addColorStop(1, '#c9b2ff');
    ctx.beginPath(); ctx.moveTo(-0.12 * R, 0); ctx.quadraticCurveTo(-0.03 * R, -0.4 * R, 0, -0.72 * R); ctx.quadraticCurveTo(0.03 * R, -0.4 * R, 0.12 * R, 0); ctx.closePath();
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#d29ac0'; ctx.lineWidth = 0.018 * R; ctx.lineJoin = 'round'; ctx.stroke();
    for (let i = 1; i <= 4; i++) { const y = -i * 0.14 * R, w = 0.12 * R * (1 - i * 0.2); ctx.beginPath(); ctx.moveTo(-w, y + 0.05 * R); ctx.lineTo(w, y - 0.02 * R); ctx.stroke(); }
    if (ax >= 0) { // реакция: рог светится, на кончике — радужная звезда
      const k = hump(ax, 1.5), gl = ctx.createRadialGradient(0, -0.6 * R, 0.02 * R, 0, -0.5 * R, 0.5 * R);
      gl.addColorStop(0, `rgba(255,250,210,${0.8 * k})`); gl.addColorStop(1, 'rgba(255,200,240,0)');
      ctx.fillStyle = gl; circle(0, -0.5 * R, 0.5 * R);
      ctx.save(); ctx.translate(0, -0.74 * R); ctx.rotate(ax * 6); ctx.fillStyle = RAINBOW[Math.floor(ax * 8) % RAINBOW.length]; starPath(5, 0.1 * R * k, 0.045 * R * k); ctx.fill(); ctx.restore();
    }
    ctx.restore();
    flower(-0.2 * R, -0.58 * R, 0.08 * R, '#ff9ccf', 0.3); flower(0.2 * R, -0.58 * R, 0.08 * R, '#b9a2ff', 1);
  } else if (kind === 'bunny') { // ободок с бантиком
    const [x1, y1] = topPoint(0.55, R);
    bow(x1 + 0.05 * R, y1 + 0.02 * R, 0.13 * R, -0.4, ac === '#ffffff' ? '#ff8fc8' : ac, ad);
  }
}

// ---------------- СЕРЁЖКИ ----------------
/** Гвоздики сидят прямо на мочке, без крючка */
const STUDS: Record<string, boolean> = { studheart: true, studgem: true, bow: true };
function earrings(kind: string, R: number, L: Live, color: string) {
  const ax = actT(L, 'earrings', kind), fd = fade(ax), P = palOf(color), M = P.metal, [gc, gk] = P.gem;
  for (const s of [-1, 1]) {
    ctx.save(); ctx.translate(s * 0.9 * R, 0.04 * R); // мочка — на уровне между глазами и ртом
    if (STUDS[kind]) { // гвоздики не качаются
      ctx.scale(1.3, 1.3); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (kind === 'studheart') { // реакция: сердечки бьются
        const b = (y: number) => hump(y, 0.14) + 0.7 * hump(y - 0.22, 0.14), k = 1 + 0.45 * (b(ax) + b(ax - 0.7));
        gemHeart(0, 0.03 * R, 0.085 * R * k, gc, gk, R, s * 0.15);
      } else if (kind === 'studgem') { // камушек в металлической оправе; реакция: вспыхивает звёздочка
        ctx.fillStyle = M[1]; circle(0, 0.03 * R, 0.08 * R); ctx.strokeStyle = M[2]; ctx.lineWidth = 0.012 * R; ctx.stroke();
        bead(0, 0.03 * R, 0.056 * R, gc, gk, R);
        const k = hump(ax - (s > 0 ? 0.25 : 0), 0.6);
        if (k > 0) { ctx.save(); ctx.translate(0.03 * R, 0); ctx.rotate(ax * 4); ctx.fillStyle = '#fff'; starPath(4, 0.1 * R * k, 0.02 * R); ctx.fill(); ctx.restore(); }
      } else { // бантики цвета акцента; реакция: хлопают крылышками
        const k = 1 + 0.4 * Math.abs(wob(ax - (s > 0 ? 0.15 : 0), 3, 2));
        ctx.save(); ctx.translate(0, 0.02 * R); ctx.scale(k, 1); bow(0, 0, 0.15 * R, s * 0.2, P.acc[0] === '#ffffff' ? '#ff9ccf' : P.acc[0], P.acc[1]); ctx.restore();
      }
      ctx.restore(); continue;
    }
    ctx.rotate(s * 0.08 + 0.6 * Math.tanh(L.swing / 0.6) + (L.live ? Math.sin(t * 2.3 + s) * 0.08 : 0));
    ctx.scale(1.3, 1.3);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // крючок металлом из палитры (на жёлтом — серебро), с тёмной окантовкой — виден на любом сердце
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 0.09 * R); ctx.strokeStyle = M[2]; ctx.lineWidth = 0.03 * R; ctx.stroke(); ctx.strokeStyle = M[1]; ctx.lineWidth = 0.016 * R; ctx.stroke();
    ctx.fillStyle = M[1]; circle(0, 0, 0.03 * R); ctx.strokeStyle = M[2]; ctx.lineWidth = 0.01 * R; ctx.stroke();
    ctx.translate(0, 0.09 * R);
    if (ax >= 0) { // реакция: у каждой серёжки своё движение подвески
      if (kind === 'hoop') ctx.scale(Math.max(0.08, Math.abs(Math.cos(ax * TAU * 1.6 * fd))) * (Math.cos(ax * TAU * 1.6 * fd) < 0 ? -1 : 1), 1); // крутится как обруч
      else if (kind === 'drop') ctx.scale(1 + 0.18 * wob(ax, 2.5, 2.5), 1 - 0.14 * wob(ax, 2.5, 2.5));           // капелька дрожит
      else if (kind === 'icecream') ctx.rotate(0.45 * wob(ax, 2, 2));                                         // мороженое качается
      else if (kind === 'butterfly') ctx.translate(s * 0.22 * R * hump(ax, 1.4), -0.4 * R * hump(ax, 1.4));  // бабочка вспархивает
      else if (kind === 'feather') ctx.rotate(0.3 * Math.sin(ax * TAU * 1.5) * fd);                           // пёрышко щекочет
      else if (kind === 'star') { ctx.translate(0, 0.1 * R); ctx.rotate(s * ax * 7 * fd); const k = 1 + 0.4 * hump(ax, 1.2); ctx.scale(k, k); ctx.translate(0, -0.1 * R); }
      else if (kind === 'pearl') { const k = hump(ax, 1.3); ctx.fillStyle = `rgba(255,255,255,${0.7 * k})`; circle(0, 0.075 * R, 0.13 * R * (0.6 + 0.6 * k)); }
      else if (kind === 'bell') ctx.scale(1 + 0.1 * Math.abs(Math.sin(ax * TAU * 2)) * fd, 1);
    }
    if (kind === 'pearl') {
      const g = ctx.createRadialGradient(-0.025 * R, 0.05 * R, 0.005 * R, 0, 0.075 * R, 0.08 * R); g.addColorStop(0, '#fff'); g.addColorStop(1, '#e3d6ea');
      ctx.fillStyle = g; circle(0, 0.075 * R, 0.075 * R); ctx.strokeStyle = '#b9a0c4'; ctx.lineWidth = 0.012 * R; ctx.stroke();
    } else if (kind === 'star') { ctx.translate(0, 0.1 * R); starPath(5, 0.1 * R, 0.045 * R); ctx.fillStyle = M[1]; ctx.fill(); ctx.strokeStyle = M[2]; ctx.lineWidth = 0.014 * R; ctx.stroke(); }
    else if (kind === 'hoop') {
      ctx.beginPath(); ctx.arc(0, 0.11 * R, 0.11 * R, 0, TAU); ctx.strokeStyle = M[2]; ctx.lineWidth = 0.05 * R; ctx.stroke(); ctx.strokeStyle = M[1]; ctx.lineWidth = 0.032 * R; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 0.012 * R; ctx.beginPath(); ctx.arc(0, 0.11 * R, 0.11 * R, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke();
    }
    else if (kind === 'cherry') {
      const j1 = 0.05 * R * hump(ax, 0.2), j2 = 0.05 * R * hump(ax - 0.25, 0.2); // реакция: вишенки по очереди подпрыгивают
      // подложка — до черешков, чтобы её кольцо не перерезало черешок
      if (warm(color)) { ctx.beginPath(); ctx.arc(-0.06 * R, 0.16 * R - j1, 0.055 * R, 0, TAU); ctx.moveTo(0.115 * R, 0.14 * R - j2); ctx.arc(0.06 * R, 0.14 * R - j2, 0.055 * R, 0, TAU); halo(0.034 * R); }
      ctx.strokeStyle = '#4c8a2a'; ctx.lineWidth = 0.015 * R;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-0.06 * R, 0.05 * R, -0.06 * R, 0.13 * R); ctx.moveTo(0, 0); ctx.quadraticCurveTo(0.05 * R, 0.05 * R, 0.06 * R, 0.11 * R); ctx.stroke();
      ctx.fillStyle = '#5cc160'; ell(0.04 * R, -0.01 * R, 0.04 * R, 0.017 * R, -0.4);
      ctx.fillStyle = '#e8173c'; circle(-0.06 * R, 0.16 * R - j1, 0.055 * R); circle(0.06 * R, 0.14 * R - j2, 0.055 * R);
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; circle(-0.075 * R, 0.14 * R - j1, 0.014 * R); circle(0.045 * R, 0.12 * R - j2, 0.014 * R);
    } else if (kind === 'drop') { // капелька цвета «камня»
      const g = ctx.createLinearGradient(-0.06 * R, 0, 0.06 * R, 0.2 * R); g.addColorStop(0, '#ffffff'); g.addColorStop(1, gc === '#ffffff' ? '#ffd6e4' : gc);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(0.09 * R, 0.08 * R, 0.08 * R, 0.19 * R, 0, 0.19 * R); ctx.bezierCurveTo(-0.08 * R, 0.19 * R, -0.09 * R, 0.08 * R, 0, 0); ctx.closePath();
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = gk; ctx.lineWidth = 0.014 * R; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ell(-0.02 * R, 0.1 * R, 0.014 * R, 0.035 * R, 0.3);
    } else if (kind === 'icecream') { // мороженое в рожке
      ctx.beginPath(); ctx.moveTo(-0.058 * R, 0.075 * R); ctx.lineTo(0.058 * R, 0.075 * R); ctx.lineTo(0, 0.25 * R); ctx.closePath();
      ctx.fillStyle = '#f2b766'; ctx.fill(); ctx.strokeStyle = '#c47f2a'; ctx.lineWidth = 0.01 * R; ctx.stroke();
      ctx.save(); ctx.clip(); ctx.lineWidth = 0.007 * R;
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 0.035 * R - 0.1 * R, 0.07 * R); ctx.lineTo(i * 0.035 * R + 0.1 * R, 0.27 * R); ctx.moveTo(i * 0.035 * R + 0.1 * R, 0.07 * R); ctx.lineTo(i * 0.035 * R - 0.1 * R, 0.27 * R); ctx.stroke(); }
      ctx.restore();
      ctx.fillStyle = '#ff9ccf'; circle(0, 0.045 * R, 0.065 * R); for (const d of [-0.045, 0, 0.045]) circle(d * R, 0.085 * R, 0.022 * R);
      ctx.strokeStyle = '#e0679f'; ctx.lineWidth = 0.008 * R; ctx.beginPath(); ctx.arc(0, 0.045 * R, 0.065 * R, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
      const sp = ['#4da3ff', '#ffd23f', '#5cc160'];
      [[-0.03, 0.02, 0.5], [0.02, 0.0, -0.6], [0.035, 0.05, 1.2]].forEach(([x, y, a], i) => { ctx.save(); ctx.translate(x * R, y * R); ctx.rotate(a); ctx.fillStyle = sp[i]; ell(0, 0, 0.014 * R, 0.006 * R); ctx.restore(); });
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; circle(-0.025 * R, 0.02 * R, 0.012 * R);
    } else if (kind === 'butterfly') {
      butterfly(0, 0.1 * R, 0.1 * R, L.live ? t * (ax >= 0 ? 16 : 5) + s : 0.4, P.acc[0] === '#ffffff' ? '#b98cff' : P.acc[0], 0);
    } else if (kind === 'bell') { // колокольчик с язычком
      const g = ctx.createLinearGradient(-0.08 * R, 0, 0.08 * R, 0.2 * R); g.addColorStop(0, M[0]); g.addColorStop(1, M[1]);
      ctx.fillStyle = M[2]; circle(0, 0.015 * R, 0.018 * R);
      const cl = (L.live ? Math.sin(t * 6 + s) * 0.02 : 0) * R - L.swing * 0.08 * R + 0.045 * R * Math.sin(ax * TAU * 2.5) * fd; // реакция: язычок звенит
      ctx.fillStyle = M[2]; circle(cl, 0.2 * R, 0.025 * R);
      ctx.beginPath(); ctx.moveTo(-0.075 * R, 0.18 * R); ctx.quadraticCurveTo(-0.075 * R, 0.025 * R, 0, 0.025 * R); ctx.quadraticCurveTo(0.075 * R, 0.025 * R, 0.075 * R, 0.18 * R); ctx.lineTo(0.095 * R, 0.2 * R); ctx.lineTo(-0.095 * R, 0.2 * R); ctx.closePath();
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = M[2]; ctx.lineWidth = 0.014 * R; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ell(-0.035 * R, 0.09 * R, 0.012 * R, 0.04 * R, 0.15);
    } else if (kind === 'feather') { // пёрышко (укорочено: было самым длинным в разделе)
      ctx.rotate(0.12); ctx.scale(1, 0.75);
      const g = ctx.createLinearGradient(0, 0, 0, 0.32 * R); g.addColorStop(0, '#7fe0d0'); g.addColorStop(0.5, '#6fb4ff'); g.addColorStop(1, '#c38cff');
      ctx.beginPath(); ctx.moveTo(0, 0.01 * R); ctx.bezierCurveTo(0.1 * R, 0.07 * R, 0.09 * R, 0.22 * R, 0.01 * R, 0.32 * R); ctx.bezierCurveTo(-0.08 * R, 0.22 * R, -0.08 * R, 0.07 * R, 0, 0.01 * R); ctx.closePath();
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#4a7fc0'; ctx.lineWidth = 0.009 * R; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 0.009 * R;
      ctx.beginPath(); ctx.moveTo(0, 0.0); ctx.quadraticCurveTo(0.012 * R, 0.18 * R, 0.005 * R, 0.33 * R); ctx.stroke();
      for (let i = 1; i <= 4; i++) { const y = i * 0.055 * R; ctx.beginPath(); ctx.moveTo(0.006 * R, y); ctx.lineTo(0.05 * R, y + 0.03 * R); ctx.moveTo(0.004 * R, y); ctx.lineTo(-0.045 * R, y + 0.03 * R); ctx.stroke(); }
    }
    ctx.restore();
  }
}

// ---------------- ОЖЕРЕЛЬЕ ----------------
function nq(s: number, R: number): [number, number] {
  const u = 1 - s; // квадратичная кривая (-0.66, 0.33) → (0, 0.82) → (0.66, 0.33)
  return [(u * u * -0.66 + s * s * 0.66) * R, (u * u * 0.33 + 2 * u * s * 0.82 + s * s * 0.33) * R];
}
const nAng = (s: number, R: number) => { const [x1, y1] = nq(Math.max(0, s - 0.01), R), [x2, y2] = nq(Math.min(1, s + 0.01), R); return Math.atan2(y2 - y1, x2 - x1); };

function necklace(kind: string, R: number, L: Live, color: string) {
  const ax = actT(L, 'necklace', kind), fd = fade(ax), P = palOf(color), M = P.metal, [ac, ad] = P.acc, [gc, gk] = P.gem;
  const chainPath = () => { ctx.beginPath(); for (let i = 0; i <= 24; i++) { const [x, y] = nq(i / 24, R); ctx.lineTo(x, y); } };
  const chain = (col: string, w: number) => { ctx.strokeStyle = col; ctx.lineWidth = w * R; chainPath(); ctx.stroke(); };
  /** цепочка металлом: двойной штрих, чтобы читалась и на превью, и на сердце любого цвета */
  const metalChain = () => { chain(M[2], 0.026); chain(M[1], 0.015); };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (kind === 'pearls') {
    chain('rgba(200,180,200,0.8)', 0.01);
    for (let i = 0; i < 11; i++) {
      const [x, y] = nq(0.04 + i * 0.92 / 10, R), g = ax < 0 ? 0 : Math.max(0, 1 - Math.abs(ax * 8 - i - 1) / 1.5) * fd; // реакция: блеск бежит по жемчужинам
      if (g > 0) { ctx.fillStyle = `rgba(255,255,255,${0.75 * g})`; circle(x, y, 0.1 * R * g); }
      const r = (i === 5 ? 0.075 : 0.055) * R * (1 + 0.25 * g);
      ctx.fillStyle = '#fbf6ff'; circle(x, y, r); ctx.strokeStyle = '#b9a0c4'; ctx.lineWidth = 0.012 * R; ctx.stroke(); ctx.fillStyle = '#fff'; circle(x - r * 0.3, y - r * 0.3, r * 0.3 * (1 + 1.5 * g));
    }
  } else if (kind === 'tone') { // бусы в тон: один цвет акцента, к центру крупнее; реакция: бусины по очереди раздуваются
    chain(ad, 0.01);
    for (let i = 0; i < 9; i++) { const s = 0.05 + i * 0.9 / 8, [x, y] = nq(s, R), j = hump(ax - i * 0.08, 0.3); bead(x, y - 0.03 * R * j, (0.045 + 0.03 * Math.sin(Math.PI * s)) * R * (1 + 0.3 * j), ac, ad, R); }
  } else if (kind === 'heartchain' || kind === 'gem') { // цепочка с кулоном: сердечко или капелька цвета «камня»
    metalChain();
    const [x, y] = nq(0.5, R);
    mv(L, 'necklace', kind, R, x, y, () => {
      ctx.fillStyle = M[1]; circle(x, y + 0.005 * R, 0.022 * R); ctx.strokeStyle = M[2]; ctx.lineWidth = 0.01 * R; ctx.stroke();
      if (kind === 'heartchain') gemHeart(x, y + 0.1 * R, 0.11 * R, gc, gk, R);
      else {
        const cy = y + 0.015 * R;
        ctx.beginPath(); ctx.moveTo(x, cy); ctx.bezierCurveTo(x + 0.11 * R, cy + 0.1 * R, x + 0.09 * R, cy + 0.2 * R, x, cy + 0.2 * R); ctx.bezierCurveTo(x - 0.09 * R, cy + 0.2 * R, x - 0.11 * R, cy + 0.1 * R, x, cy); ctx.closePath();
        const g = ctx.createLinearGradient(x - 0.08 * R, cy, x + 0.08 * R, cy + 0.2 * R); g.addColorStop(0, '#ffffff'); g.addColorStop(1, gc === '#ffffff' ? '#ffd6e4' : gc);
        ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = gk; ctx.lineWidth = 0.014 * R; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ell(x - 0.03 * R, cy + 0.11 * R, 0.014 * R, 0.035 * R, 0.3);
      }
      if (ax >= 0) { const k = hump(ax - 0.2, 1); if (k > 0) { ctx.save(); ctx.translate(x + 0.05 * R, y + 0.08 * R); ctx.rotate(ax * 4); ctx.fillStyle = '#fff'; starPath(4, 0.1 * R * k, 0.02 * R); ctx.fill(); ctx.restore(); } } // реакция: кулон сверкает
    });
  } else if (kind === 'ribbon') { // ленточка-чокер цвета акцента с бантиком; концы обрезаны по контуру сердца
    ctx.save(); heartShape(R); ctx.clip(); ctx.lineCap = 'butt';
    chain(ad, 0.085); chain(ac, 0.062);
    ctx.save(); ctx.setLineDash([0.02 * R, 0.03 * R]); chain('rgba(255,255,255,0.7)', 0.012); ctx.restore();
    ctx.restore();
    const [x, y] = nq(0.5, R), k = Math.abs(wob(ax, 2, 2)); // реакция: бантик хлопает крылышками
    ctx.save(); ctx.translate(x, y); ctx.scale(1 + 0.35 * k, 1 - 0.1 * k); bow(0, 0, 0.2 * R, 0, ac === '#ffffff' ? '#ff9ccf' : ac, ad); ctx.restore();
  } else if (kind === 'flowers') {
    const cols = ['#ff7aa8', '#ffd23f', '#c9a7ff', '#7fd1ff', '#ff9636'];
    ctx.fillStyle = color === 'green' ? '#2f8f3a' : '#5cc160'; // на зелёном сердце листья темнее, иначе пропадают
    for (let i = 0; i < 8; i++) { const s = 0.1 + i * 0.8 / 7, [x, y] = nq(s, R); ell(x, y + 0.02 * R, 0.07 * R, 0.03 * R, nAng(s, R) + 0.5); }
    for (let i = 0; i < 9; i++) { const [x, y] = nq(0.05 + i * 0.9 / 8, R); flower(x, y - 0.03 * R * hump(ax - i * 0.06, 0.4), 0.065 * R * (1 + 0.4 * hump(ax - i * 0.06, 0.4)), cols[i % cols.length], i + (ax < 0 ? 0 : ax * 5 * fd)); } // реакция: цветочки кружатся волной
  } else if (kind === 'beads') {
    chain('rgba(120,80,110,0.6)', 0.012);
    for (let i = 0; i < 9; i++) { // реакция: бусины подпрыгивают каскадом — в такт звону
      const [x, y0] = nq(0.05 + i * 0.9 / 8, R), j = hump(ax - i * 0.09, 0.25), y = y0 - 0.08 * R * j;
      bead(x, y, 0.055 * R * (1 + 0.3 * j), RAINBOW[i % RAINBOW.length], 'rgba(80,30,60,0.45)', R);
    }
  } else if (kind === 'locket' || kind === 'star') { // круглый медальон с камушком (поднят, чтобы не ложился на кончик)
    metalChain();
    const [x, y] = nq(0.5, R), cy = y + 0.08 * R;
    mv(L, 'necklace', kind, R, x, y, () => {
    ctx.save(); ctx.translate(x, y); ctx.scale(1.25, 1.25); ctx.translate(-x, -y);
    ctx.strokeStyle = M[2]; ctx.lineWidth = 0.014 * R; ctx.beginPath(); ctx.arc(x, y + 0.005 * R, 0.02 * R, 0, TAU); ctx.stroke();
    const g = ctx.createRadialGradient(x - 0.04 * R, cy - 0.04 * R, 0.01 * R, x, cy, 0.11 * R); g.addColorStop(0, M[0]); g.addColorStop(1, M[1]);
    ctx.fillStyle = g; circle(x, cy, 0.075 * R); ctx.strokeStyle = M[2]; ctx.lineWidth = 0.014 * R; ctx.stroke();
    ctx.lineWidth = 0.007 * R; ctx.beginPath(); ctx.arc(x, cy, 0.056 * R, 0, TAU); ctx.stroke();
    bead(x, cy, 0.032 * R, gc === '#ffffff' ? '#ff6fa8' : gc, gk, R);
    if (ax >= 0) { const k = hump(ax, 1.4); ctx.fillStyle = `rgba(255,250,200,${0.6 * k})`; circle(x, cy, 0.12 * R * k); smallHeart(x, cy, 0.045 * R * (1 + k), '#ff3d7f'); } // реакция: медальон светится, в нём сердечко
    ctx.restore();
    });
  } else if (kind === 'bowtie') { // галстук-бабочка в горошек, цвет акцента
    const spin = ax < 0 ? 0 : TAU * 2 * ease.inOut(clamp01(ax / 0.9)); // реакция: бабочка крутится пропеллером
    ctx.save(); ctx.translate(0, 0.47 * R); ctx.rotate(Math.sin(t * 2) * 0.05 + spin);
    const wing = (sd: number) => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sd * 0.08 * R, -0.11 * R, sd * 0.21 * R, -0.1 * R); ctx.quadraticCurveTo(sd * 0.25 * R, 0, sd * 0.21 * R, 0.1 * R); ctx.quadraticCurveTo(sd * 0.08 * R, 0.11 * R, 0, 0); ctx.closePath(); };
    const wc = ac === '#ffffff' ? '#ff6f9f' : ad, dc = ac === '#ffffff' ? '#fff' : ac;
    for (const sd of [-1, 1]) {
      wing(sd); ctx.fillStyle = wc; ctx.fill();
      ctx.save(); wing(sd); ctx.clip(); ctx.fillStyle = dc;
      for (const [dx, dy] of [[0.08, -0.04], [0.15, 0.03], [0.19, -0.06], [0.11, 0.07]]) circle(sd * dx * R, dy * R, 0.019 * R);
      ctx.restore();
      wing(sd); ctx.strokeStyle = 'rgba(70,20,50,0.7)'; ctx.lineWidth = 0.014 * R; ctx.stroke();
    }
    ctx.fillStyle = wc; ell(0, 0, 0.05 * R, 0.062 * R); ctx.stroke();
    ctx.restore();
  } else if (kind === 'scarf') { // вязаный шарфик в полоску: акцент + белый, по контуру сердца
    ctx.save(); heartShape(R); ctx.clip(); ctx.lineCap = 'butt';
    chain(ad, 0.14); chain(ac, 0.12);
    ctx.setLineDash([0.05 * R, 0.07 * R]); chain('#ffffff', 0.12); ctx.setLineDash([]);
    ctx.restore();
    const [tx, ty] = nq(0.36, R);
    // реакция: хвост шарфа развевается на ветру — отлетает вбок и идёт волной
    const wk = ax < 0 ? 0 : fd * clamp01(ax / 0.25), wind = wk * (0.9 + 0.25 * Math.sin(ax * TAU * 2.5));
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(0.05 + Math.sin(t * 1.8) * 0.04 + wind);
    const TL = 0.22 * R, wv = (yy: number) => wk * Math.sin(ax * TAU * 3 - yy / R * 9) * 0.04 * R * (yy / TL); // волна вдоль хвоста
    const strip = (y0: number, h: number) => { const n = 6; ctx.beginPath(); for (let i = 0; i <= n; i++) { const yy = y0 + h * i / n; ctx.lineTo(-0.06 * R + wv(yy), yy); } for (let i = n; i >= 0; i--) { const yy = y0 + h * i / n; ctx.lineTo(0.06 * R + wv(yy), yy); } ctx.closePath(); };
    strip(0, TL); ctx.fillStyle = ac; ctx.fill();
    ctx.fillStyle = '#ffffff'; for (let i = 0; i < 2; i++) { strip((0.05 + i * 0.09) * R, 0.035 * R); ctx.fill(); }
    strip(0, TL); ctx.strokeStyle = ad; ctx.lineWidth = 0.014 * R; ctx.stroke();
    ctx.lineCap = 'round'; ctx.strokeStyle = ad; ctx.lineWidth = 0.018 * R;
    for (let i = 0; i < 4; i++) { const x = (-0.045 + i * 0.03) * R + wv(TL); ctx.beginPath(); ctx.moveTo(x, TL); ctx.lineTo(x + wv(TL + 0.05 * R) - wv(TL), TL + 0.05 * R); ctx.stroke(); }
    ctx.restore();
  } else if (kind === 'key') { // цепочка с ключиком (короче — не свисает ниже кончика)
    metalChain();
    const [x, y] = nq(0.5, R);
    const turn = ax < 0 ? 0 : 1.1 * hump(ax, 1.0) + 0.15 * wob(ax - 1.0, 3); // реакция: ключик поворачивается
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 1.7) * 0.12 + turn); ctx.scale(1.1, 1.1);
    ctx.fillStyle = M[1]; ctx.strokeStyle = M[2]; ctx.lineWidth = 0.014 * R;
    ctx.beginPath(); ctx.arc(0, 0.075 * R, 0.055 * R, 0, TAU); ctx.arc(0, 0.075 * R, 0.025 * R, 0, TAU, true); ctx.fill('evenodd'); ctx.stroke();
    ctx.beginPath(); ctx.rect(-0.015 * R, 0.125 * R, 0.03 * R, 0.17 * R); ctx.rect(0.012 * R, 0.24 * R, 0.045 * R, 0.022 * R); ctx.rect(0.012 * R, 0.275 * R, 0.035 * R, 0.02 * R);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; circle(-0.03 * R, 0.05 * R, 0.01 * R);
    ctx.restore();
  } else if (kind === 'shells') { // ракушки
    chain('#d9b38c', 0.01);
    const cols: [string, string][] = [['#ffc2d1', '#d9708f'], ['#ffe0b8', '#d99a5a'], ['#e3d4ff', '#9a7ad6']];
    for (let i = 0; i < 7; i++) {
      const s = 0.08 + i * 0.84 / 6, [x, y] = nq(s, R), [c, d] = cols[i % 3];
      const op = hump(ax - i * 0.1, 0.4); // реакция: ракушки по очереди раскрываются
      ctx.save(); ctx.translate(x, y + 0.045 * R); ctx.rotate(nAng(s, R) * 0.5 + 0.3 * op * (i % 2 ? 1 : -1)); ctx.scale(1.5 * (1 + 0.25 * op), 1.5 * (1 + 0.45 * op));
      ctx.beginPath(); ctx.moveTo(0, 0.04 * R); ctx.lineTo(-0.05 * R, -0.005 * R); ctx.arc(0, -0.005 * R, 0.05 * R, Math.PI, TAU); ctx.closePath();
      ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = d; ctx.lineWidth = 0.008 * R; ctx.stroke();
      for (let k = 1; k < 5; k++) { const a = Math.PI + k * Math.PI / 5; ctx.beginPath(); ctx.moveTo(0, 0.035 * R); ctx.lineTo(Math.cos(a) * 0.045 * R, -0.005 * R + Math.sin(a) * 0.045 * R); ctx.stroke(); }
      ctx.fillStyle = d; ell(0, 0.04 * R, 0.018 * R, 0.01 * R);
      ctx.restore();
    }
  } else if (kind === 'candy') { // конфетки и леденец
    chain('rgba(255,255,255,0.9)', 0.012);
    const cols = ['#ff5c8a', '#ffd23f', '#5cc1ff', '#7fd96b', '#c98cff', '#ff9636'];
    [0.08, 0.22, 0.36, 0.64, 0.78, 0.92].forEach((s, i) => {
      const [x, y] = nq(s, R);
      ctx.save(); ctx.translate(x, y - 0.04 * R * Math.abs(Math.sin(ax * TAU * 1.5 + i)) * fd); ctx.rotate(nAng(s, R) + 0.35 * Math.sin(ax * TAU * 2 + i) * fd); ctx.scale(1.4, 1.4); // реакция: конфетки пляшут
      ctx.fillStyle = cols[i]; ctx.strokeStyle = 'rgba(80,30,60,0.45)'; ctx.lineWidth = 0.007 * R;
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 0.03 * R, 0); ctx.lineTo(sd * 0.07 * R, -0.025 * R); ctx.lineTo(sd * 0.07 * R, 0.025 * R); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ell(0, 0, 0.038 * R, 0.03 * R); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.008 * R; ctx.beginPath(); ctx.moveTo(-0.015 * R, -0.02 * R); ctx.lineTo(0.0, 0.02 * R); ctx.moveTo(0.012 * R, -0.022 * R); ctx.lineTo(0.025 * R, 0.012 * R); ctx.stroke();
      ctx.restore();
    });
    const [x, y] = nq(0.5, R), cy = y + 0.15 * R;
    ctx.save(); ctx.translate(x, y); ctx.scale(1.35, 1.35); ctx.translate(-x, -y);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.02 * R; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, cy); ctx.stroke();
    ctx.strokeStyle = 'rgba(80,30,60,0.35)'; ctx.lineWidth = 0.006 * R; ctx.stroke();
    ctx.fillStyle = '#ff7ab8'; circle(x, cy, 0.085 * R); ctx.strokeStyle = '#d6407f'; ctx.lineWidth = 0.01 * R; ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.018 * R; ctx.beginPath();
    const sw = ax < 0 ? 0 : ax * 14 * fd; // реакция: леденец закручивается
    for (let i = 0; i <= 40; i++) { const a = i * 0.42 + t * 0.8 + sw, r = 0.005 * R + i * 0.0018 * R; ctx.lineTo(x + Math.cos(a) * r, cy + Math.sin(a) * r); }
    ctx.stroke(); ctx.restore();
  } else if (kind === 'hearts') { // старый вариант из сохранений
    chain('#ff8fc8', 0.014);
    for (let i = 0; i < 9; i++) { const [x, y] = nq(0.06 + i * 0.88 / 8, R); smallHeart(x, y + 0.02 * R, 0.06 * R, i % 2 ? '#ff8fc8' : '#ff2f78'); }
  }
}
