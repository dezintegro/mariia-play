// Уход за сердцем: покормить (еда), искупать (ванна), уложить спать (сон).
// Каждый раздел — свой модуль с интерфейсом CareSection (section.ts); здесь только реестр и раздача событий.
// Варианты — CARE_OPTS в careopts.ts; кнопки показывает общая панель вариантов (ui.ts).
//
// Новый раздел (доктор, игры…): модуль <id>.ts с `export const <id>: CareSection`, строка в SECTIONS ниже,
// варианты в careopts.ts и этап { id, care: true, opts: CARE_OPTS.<id> } в STAGES (state.ts). Чужие модули не трогать.
import { G } from '../state';
import { Live } from '../heart';
import { Xf } from '../reactions';
import { bath } from './bath';
import { food } from './food';
import { CareSection, shared } from './section';
import { sleep } from './sleep';

export type { CareSection } from './section';

/** Разделы ухода; порядок = порядок рисования и проверки тапов */
export const SECTIONS: CareSection[] = [food, bath, sleep];
const byId = (id: string) => SECTIONS.find(s => s.id === id);

// для автотестов: window.__care.food / .bath / .sleep — состояние разделов
(window as any).__care = Object.fromEntries(SECTIONS.map(s => [s.id, s.state]));

/** Значок варианта ухода: рисуется в (0,0) радиусом r, уже обрезан кругом */
export function careIcon(stage: string, k: string, r: number) { byId(stage)?.optIcon(k, r); }
/** Значок раздела ухода на ленте */
export function careStageIcon(stage: string, r: number) { byId(stage)?.icon(r); }
/** Включён ли вариант сейчас (подсветка кнопки), например «спит» */
export function careSel(stage: string, k: string): boolean { return !!byId(stage)?.sel?.(k); }
/** Тап по кнопке варианта; (x, y) — где кнопка: оттуда, например, летит еда */
export function careAct(stage: string, k: string, x: number, y: number) { byId(stage)?.act(k, x, y); }

/** Единая точка выхода: всё, что начато в уходе, плавно убирается (без солнышка, без следов в чужом разделе) */
export function careExit(id?: string) { for (const s of SECTIONS) if (id == null || s.id === id) s.exit(); }
/** Сменился раздел (from → to, id этапов): старый раздел выходит, новый входит */
export function careStageChange(from: string, to: string) {
  if (from === to) return;
  careExit(from);
  byId(to)?.enter?.();
}

// Палочка и праздник начинаются в main.ts; уход замечает их здесь и сначала будит/убирает всё (careExit)
let wasFinale = false, wasWand = false;
export function updateCare(dt: number) {
  const fin = !!G.finale, wd = !!G.wand;
  if ((fin && !wasFinale) || (wd && !wasWand)) careExit();
  wasFinale = fin; wasWand = wd;
  for (const s of SECTIONS) s.update(dt);
}

/** Позади сердца (main.ts обрезает областью сердца) */
export function drawCareBack() { if (!G.finale) for (const s of SECTIONS) s.drawBack?.(); }
/** Перед сердцем */
export function drawCareFront() { if (!G.finale) for (const s of SECTIONS) s.drawFront?.(); }
/** Поверх мира, но под частицами и интерфейсом (например, ночное затемнение) */
export function drawCareOverlay() { if (!G.finale) for (const s of SECTIONS) s.drawOverlay?.(); }

/** Подправить живое состояние сердца перед рисованием: рот жуёт, глаза закрыты во сне */
export function careLive(L: Live) { for (const s of SECTIONS) s.live?.(L); }
const NONE: Xf = { dy: 0, rot: 0, sx: 1, sy: 1 };
/** Добавка к положению/форме сердца (жуёт, потягивается) */
export function careXform(Rr: number): Xf {
  const X: Xf = { dy: 0, rot: 0, sx: 1, sy: 1 };
  for (const s of SECTIONS) s.xform?.(X, Rr);
  shared.dy = X.dy;
  return X.dy || X.rot || X.sx !== 1 || X.sy !== 1 ? X : NONE;
}

/** Предмет ухода под точкой (пена, мишка…) или null — проверяется раньше сердца */
export function hitCare(x: number, y: number): any {
  if (G.finale) return null;
  for (const s of SECTIONS) { const h = s.hit?.(x, y); if (h) return { k: 'care', sec: s.id, ...h }; }
  return null;
}
export function tapCare(h: any, x: number, y: number) { byId(h.sec)?.tap?.(h, x, y); }
/** Тап по самому сердцу во время ухода. Вернуть true, если обработано (например, спит — сонно моргает) */
export function careHeartTap(): boolean { return SECTIONS.some(s => s.heartTap?.()); }
