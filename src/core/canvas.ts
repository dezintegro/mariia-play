// Общий холст, размеры экрана, время и мелкие математические помощники.
// W, H, S, BR, t меняются только здесь (resizeCanvas/advance), остальные модули их читают.
export const cv = document.getElementById('c') as HTMLCanvasElement;
export const ctx = cv.getContext('2d')!;
export const TAU = Math.PI * 2;
/** ширина/высота экрана в CSS-пикселях, плотность пикселей, масштаб S = min(W,H)/720, базовый размер малыша BR */
export let W = 0, H = 0, DPR = 1, S = 1, BR = 26;
/** время сцены в секундах */
export let t = 0;
export function advance(dt: number) { t += dt; }
export function resizeCanvas() {
  // На телефонах 100vh больше видимой области (панели браузера), поэтому размер берём из реально видимой
  // области и задаём холсту явно в пикселях — тогда картинка не растягивается и не уходит под панели.
  const vv = window.visualViewport;
  W = Math.round(vv ? vv.width : innerWidth); H = Math.round(vv ? vv.height : innerHeight);
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  S = Math.min(W, H) / 720; BR = 26 * S;
}
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
export const dist = (x1: number, y1: number, x2: number, y2: number) => Math.hypot(x1 - x2, y1 - y2);
export const easeOutBack = (x: number) => { const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
/** позиция курсора/пальца */
export const pointer: any = { x: -9999, y: -9999, lastSpark: 0, moved: false };
