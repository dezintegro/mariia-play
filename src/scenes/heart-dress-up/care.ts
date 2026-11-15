// Уход за сердцем: покормить (еда), искупать (ванна), уложить спать (сон).
// Варианты — CARE_OPTS в careopts.ts; кнопки показывает общая панель вариантов (ui.ts).
import { Live } from './heart';
import { Xf } from './reactions';

const NONE: Xf = { dy: 0, rot: 0, sx: 1, sy: 1 };
export const care = {} as Record<string, any>;

/** Значок варианта ухода: рисуется в (0,0) радиусом r, уже обрезан кругом */
export function careIcon(stage: string, k: string, r: number) { void stage; void k; void r; }
/** Значок раздела ухода на ленте */
export function careStageIcon(stage: string, r: number) { void stage; void r; }
/** Включён ли вариант сейчас (подсветка кнопки), например «спит» */
export function careSel(stage: string, k: string): boolean { void stage; void k; return false; }
/** Тап по кнопке варианта; (x, y) — где кнопка: оттуда, например, летит еда */
export function careAct(stage: string, k: string, x: number, y: number) { void stage; void k; void x; void y; }
/** Сменился раздел (from → to, id этапов): например, ушли со сна — сердце просыпается */
export function careStageChange(from: string, to: string) { void from; void to; }
export function updateCare(dt: number) { void dt; }
/** Позади сердца */
export function drawCareBack() {}
/** Перед сердцем */
export function drawCareFront() {}
/** Поверх мира, но под частицами и интерфейсом (например, ночное затемнение) */
export function drawCareOverlay() {}
/** Подправить живое состояние сердца перед рисованием: рот жуёт, глаза закрыты во сне */
export function careLive(L: Live) { void L; }
/** Добавка к положению/форме сердца (жуёт, потягивается) */
export function careXform(R: number): Xf { void R; return NONE; }
/** Предмет ухода под точкой (пена, мишка…) или null — проверяется раньше сердца */
export function hitCare(x: number, y: number): any { void x; void y; return null; }
export function tapCare(h: any, x: number, y: number) { void h; void x; void y; }
/** Тап по самому сердцу во время ухода. Вернуть true, если обработано (например, спит — сонно моргает) */
export function careHeartTap(): boolean { return false; }
