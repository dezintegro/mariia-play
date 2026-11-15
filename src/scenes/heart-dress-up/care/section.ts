// Каркас раздела ухода: общий интерфейс и помощники. Каждый раздел (еда, ванна, сон…) — свой модуль
// со своим состоянием; care/index.ts только раздаёт им события. Разделы друг друга не импортируют.
import { clamp, ctx } from '../../../core/canvas';
import { circle } from '../../../core/draw';
import { clamp01 } from '../../../core/tween';
import { Live } from '../heart';
import { Xf } from '../reactions';
import { G } from '../state';

/** Что под пальцем: what — какой предмет, o — сам объект (если нужен) */
export type Hit = { what: string; o?: any };

/**
 * Раздел ухода. Обязательны id, state, значки, act, exit, update — остальное по необходимости.
 * Правила: предмет-«действие» доигрывает и исчезает сам, предмет-«друг» живёт до exit();
 * повторный тап по кнопке не затирает начатое (очередь, «ещё», пружинка); exit() убирает всё плавно и без звука,
 * если убирать нечего, — после него в чужом разделе не остаётся ни предметов, ни звуков.
 */
export interface CareSection {
  /** id этапа в STAGES (state.ts) и ключ в CARE_OPTS (careopts.ts) */
  id: string;
  /** Состояние раздела — для автотестов (window.__care[id]) */
  state: object;
  /** Значок раздела на ленте: рисуется в (0,0) радиусом r, уже обрезан кругом */
  icon(r: number): void;
  /** Значок варианта k: в (0,0) радиусом r, уже обрезан кругом */
  optIcon(k: string, r: number): void;
  /** Вариант «включён» (подсветка кнопки), например «спит» */
  sel?(k: string): boolean;
  /** Пришли в раздел */
  enter?(): void;
  /** Уходим: смена раздела, палочка, праздник. Всё доигрывает и плавно убирается. */
  exit(): void;
  /** Тап по кнопке варианта k; (x, y) — где кнопка (оттуда, например, летит еда) */
  act(k: string, x: number, y: number): void;
  /** Каждый кадр, во всех разделах (уходящие предметы доигрывают и в чужом) */
  update(dt: number): void;
  /** Позади сердца (в области сердца) */
  drawBack?(): void;
  /** Перед сердцем */
  drawFront?(): void;
  /** Поверх мира, под частицами и интерфейсом (ночное затемнение) */
  drawOverlay?(): void;
  /** Предмет раздела под точкой — проверяется раньше сердца */
  hit?(x: number, y: number): Hit | null;
  /** Тап по своему предмету (h — то, что вернул hit) */
  tap?(h: Hit, x: number, y: number): void;
  /** Тап по самому сердцу: true — раздел обработал (спит — сонно моргает) */
  heartTap?(): boolean;
  /** Подправить живое состояние сердца перед рисованием (глаза, рот) */
  live?(L: Live): void;
  /** Добавить к положению/форме сердца: dy, rot складываются, sx, sy умножаются */
  xform?(X: Xf, Rr: number): void;
}

// ---------------- ПОМОЩНИКИ ----------------
/** Общая добавка к положению сердца (жуёт, потягивается) — чтобы рисовать пену и еду там, где сердце сейчас */
export const shared = { dy: 0 };
export const R = () => G.heart.R;
/** Точка сердца в долях R → экран */
export const hp = (fx: number, fy: number): [number, number] => [G.heart.x + fx * R(), G.heart.y + fy * R() + shared.dy];
export const mouthPos = () => hp(0, 0.24);
/** Попадание в круг, но не меньше 32px — палец ребёнка */
export const near = (x: number, y: number, px: number, py: number, r: number) => Math.hypot(x - px, y - py) < Math.max(r, 32);
/** «Пол», на котором сидят мишка, уточка, шкатулка — на уровне кончика сердца */
export const floorY = () => G.heart.y + 1.02 * R();
/** x сбоку от сердца, но не под кнопками палочки и хлопушки и не за краем области сердца */
export function sideX(dir: number, k: number, half: number) {
  const A = G.HR, z = G.zones;
  const x0 = Math.max(A.x, z.wand ? z.wand.x + z.wand.r * 1.2 : A.x), x1 = Math.min(A.x + A.w, z.party ? z.party.x - z.party.r * 1.2 : A.x + A.w);
  return clamp(G.heart.x + dir * k * R(), x0 + half, Math.max(x0 + half, x1 - half));
}
/** Сердце радуется: сплющилось, рот открыт; jump — подпрыгнуть */
export function happy(jump = false) { const hs = G.hs; hs.sqT = 0; hs.mouth = 1; hs.swingV += 3; if (jump) hs.jT = 0; }

/** Предмет, который «уходит»: out — время с начала ухода (undefined — на месте) */
export type Leaving = { out?: number };
export const OUT = 0.5;
/** Отправить предмет уходить (если ещё не уходит) */
export const leave = (o: Leaving | null) => { if (o && o.out == null) o.out = 0; };
/** На месте и не уходит */
export const here = (o: Leaving | null) => !!o && o.out == null;
/** 1 → 0 за время ухода */
export const stay = (o: Leaving) => o.out == null ? 1 : 1 - clamp01(o.out / OUT);
/** Продвинуть уход предметов obj[keys]; ушедшие — null */
export function tickLeaving(obj: Record<string, any>, keys: string[], dt: number) {
  for (const key of keys) { const o = obj[key] as Leaving | null; if (o && o.out != null) { o.out += dt; if (o.out > OUT) obj[key] = null; } }
}

/** Номер дня (по местному времени) — для «еды дня» и будущих секретов дня */
export const dayNo = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);

export const INK = '#45182e';
/** Фон значка: вертикальный градиент */
export function iconBg(r: number, c0: string, c1: string) { const g = ctx.createLinearGradient(0, -r, 0, r); g.addColorStop(0, c0); g.addColorStop(1, c1); ctx.fillStyle = g; circle(0, 0, r); }

/**
 * Следы ухода на самом сердце, общие для разделов (живут дольше раздела).
 * rested — выспалось (сек), dreams — что снится: ключ → рисовалка в (0,0) радиусом r, сон показывает по кругу в порядке DREAM_ORDER (sleep.ts): food, duck, teddy, stars;
 * crumbs, cream — следы еды (крошки — точки в долях R от центра сердца, кремовые усы 0..1): ванна забирает их в пятнышки;
 * spots — пятнышки, которые отмывает ванна (рисует ванна); glow — сколько ещё секунд сердце блестит чистотой.
 */
export const traces = {
  rested: 0, dreams: {} as Record<string, (r: number) => void>,
  crumbs: [] as { fx: number; fy: number }[], cream: 0,
  spots: [] as { fx: number; fy: number; kind: string; dirt: number; rot: number; col: string; wig: number }[], glow: 0,
};
