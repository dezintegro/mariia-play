// Интерфейс без текста: лента этапов (одна строка) и панель вариантов (2–3 ряда) — обе листаются вбок,
// под панелью виден скроллбар. Кнопка праздника, кнопки «заново»/«украшать дальше», звук.
import { H, S, TAU, W, clamp, ctx, t } from '../../core/canvas';
import { circle, drawButton, starPath } from '../../core/draw';
import { clamp01, ease } from '../../core/tween';
import { itemIcon } from './icons';
import { stageIcon } from './stageicons';
import { G, Item, STAGES, stageHas, stageItems } from './state';
import { smallHeart } from './things';

type Btn = { x: number; y: number; r: number; press: number; shake: number };
const mk = (): Btn => ({ x: 0, y: 0, r: 40, press: 0, shake: 0 });
/** Горизонтальная лента с прокруткой: окно (x,y,w,h), ширина содержимого cw, сдвиг off */
export type Scroller = { x: number; y: number; w: number; h: number; cw: number; off: number; vel: number; held: boolean; bar: { x: number; y: number; w: number; h: number } | null };
const mkS = (): Scroller => ({ x: 0, y: 0, w: 0, h: 0, cw: 0, off: 0, vel: 0, held: false, bar: null });
export const maxOff = (s: Scroller) => Math.max(0, s.cw - s.w);

export const UI = {
  stripS: mkS(), itemsS: mkS(),
  cells: [] as { x: number; y: number; r: number; i: number }[],
  items: [] as (Item & { x: number; y: number; r: number; press: number })[],
  itemsStage: -1,
  party: mk(), sound: mk(), again: mk(), cont: mk(),
  hrTarget: { x: 0, y: 0, w: 0, h: 0 },
  pad: 10,
};

// ---------------- РАСКЛАДКА ----------------
export function layout() {
  const pad = UI.pad = Math.max(6, 10 * S);
  const sr = Math.max(22, 26 * S); Object.assign(UI.sound, { x: W - sr - 12, y: sr + 12, r: sr });
  const wide = W > H * 1.2;
  const its = stageItems(G.stage), m = its.length;
  if (UI.itemsStage !== G.stage) { UI.items = its.map(it => ({ ...it, x: 0, y: 0, r: 0, press: 0 })); UI.itemsStage = G.stage; }
  const ss = UI.stripS, is = UI.itemsS, n = STAGES.length;
  // Порядок сверху вниз: лента разделов, под ней варианты раздела.
  // Широкий экран: лента — строкой сверху, варианты — 3 ряда справа от сердца.
  // Узкий (телефон стоя): обе панели внизу, варианты — 2 ряда у самого края.
  const sc = wide ? clamp(80 * S, 70, 88) : clamp(72 * S, 64, 80);
  const barH = 8, barGap = 6; // скроллбар тонкий на вид, но ловится с запасом (см. hitUI)
  let rows: number, icMax: number, icMin = 66;
  if (wide) {
    ss.x = pad; ss.w = UI.sound.x - UI.sound.r - pad * 1.5 - pad; ss.h = sc; ss.y = pad * 0.6;
    ss.cw = n * sc;
    const sTop = ss.y + sc + (ss.cw > ss.w ? barGap + barH : 0) + pad;
    rows = 3;
    const colW = Math.min(W * 0.44, 560), avail = H - pad - sTop - barGap - barH;
    icMax = Math.min(avail / rows, 124 * S, 130);
    const ic = fitCell(m, rows, colW, Math.max(icMin, icMax), icMin);
    is.w = colW; is.x = W - pad - colW; is.h = rows * ic; is.y = sTop + Math.max(0, (avail - is.h) / 2);
    placeItems(rows, ic);
    UI.hrTarget = { x: 0, y: sTop - pad * 0.5, w: is.x - pad * 0.5, h: H - sTop + pad * 0.5 };
  } else {
    rows = 2;
    const ic = fitCell(m, rows, W - 2 * pad, clamp(Math.min(W / 4.6, 112 * S), icMin, 116), icMin);
    is.w = W - 2 * pad; is.x = pad; is.h = rows * ic;
    is.cw = Math.ceil(m / rows) * ic;
    is.y = H - pad * 0.6 - (is.cw > is.w + 1 ? barGap + barH : 0) - is.h;
    placeItems(rows, ic);
    ss.x = pad; ss.w = W - 2 * pad; ss.h = sc; ss.cw = n * sc;
    ss.y = is.y - pad * 1.2 - (ss.cw > ss.w ? barGap * 0.5 + 4 : 0) - sc;
    UI.hrTarget = { x: 0, y: 0, w: W, h: ss.y - pad * 0.4 };
  }
  ss.bar = ss.cw > ss.w + 1 ? { x: ss.x + ss.w * 0.15, y: ss.y + sc + barGap * 0.5, w: ss.w * 0.7, h: wide ? barH : 4 } : null;
  const shiftS = ss.cw <= ss.w ? (ss.w - ss.cw) / 2 : -ss.off;
  UI.cells = STAGES.map((_, i) => ({ x: ss.x + shiftS + (i + 0.5) * sc, y: ss.y + sc / 2, r: sc * 0.46, i }));
  if (G.finale) UI.hrTarget = { x: 0, y: 0, w: W, h: H };
  const HR = UI.hrTarget, pr = clamp(46 * S, 34, 56);
  Object.assign(UI.party, { x: HR.x + HR.w - pr - pad, y: HR.y + HR.h - pr - pad * 0.5, r: pr });
  const fr = clamp(60 * S, 40, 72);
  Object.assign(UI.again, { x: fr + 24, y: H - fr - 24, r: fr });
  Object.assign(UI.cont, { x: W - fr - 24, y: H - fr - 24, r: fr });

  function placeItems(rws: number, ic: number) {
    is.cw = Math.ceil(m / rws) * ic;
    is.bar = is.cw > is.w + 1 ? { x: is.x + is.w * 0.1, y: is.y + is.h + barGap, w: is.w * 0.8, h: barH } : null;
    const shiftI = is.cw <= is.w + 1 ? (is.w - is.cw) / 2 : -is.off;
    if (!is.bar) is.off = 0;
    UI.items.forEach((it, i) => {
      const col = Math.floor(i / rws), row = i % rws; // по столбцам: прокрутка вбок открывает новые столбцы
      Object.assign(it, { x: is.x + shiftI + (col + 0.5) * ic, y: is.y + (row + 0.5) * ic, r: ic * 0.45 });
    });
  }
}

/** Размер ячейки: если всё почти влезает — чуть ужать, чтобы не было прокрутки «ради пары пикселей» */
function fitCell(m: number, rows: number, w: number, ic: number, icMin: number) {
  const cols = Math.ceil(m / rows);
  if (cols * ic <= w) return ic;
  const fit = w / cols;
  return fit >= icMin ? fit : ic;
}

/** Инерция и мягкий возврат к краям, когда ленту не держат */
export function updateScroll(dt: number) {
  for (const s of [UI.stripS, UI.itemsS]) {
    const mx = maxOff(s);
    if (s.held) continue;
    s.off += s.vel * dt; s.vel *= Math.exp(-dt * 4);
    if (s.off < 0) { s.off += (0 - s.off) * Math.min(1, dt * 12); s.vel = 0; }
    if (s.off > mx) { s.off += (mx - s.off) * Math.min(1, dt * 12); s.vel = 0; }
    if (Math.abs(s.vel) < 5) s.vel = 0;
  }
}

/** Прокрутить панель так, чтобы вариант i был виден (например, выбранный при смене этапа) */
export function revealItem(i: number) {
  layout();
  const is = UI.itemsS, it = UI.items[i]; if (!it) return;
  const x = it.x - is.x, pad = it.r * 1.3;
  if (x - pad < 0) is.off = clamp(is.off + x - pad, 0, maxOff(is));
  else if (x + pad > is.w) is.off = clamp(is.off + x + pad - is.w, 0, maxOff(is));
  is.vel = 0; layout();
}
export function revealStage(i: number) {
  const ss = UI.stripS, sc = ss.h, x = (i + 0.5) * sc - ss.off;
  if (x - sc < 0) ss.off = clamp((i - 0.5) * sc, 0, maxOff(ss));
  else if (x + sc > ss.w) ss.off = clamp((i + 1.5) * sc - ss.w, 0, maxOff(ss));
}

// ---------------- ВЫБРАНО ЛИ ----------------
export function isSel(it: Item) {
  const c = G.cfg, id = STAGES[G.stage].id;
  if (it.kind === 'single') return c[id] === it.k;
  if (it.kind === 'none') return id === 'env' ? !Object.values(c.env).some(Boolean) : c[id] == null;
  if (it.kind === 'toggle') return !!c.env[it.k];
  if (it.kind === 'bgcolor') return c.bg === it.k;
  if (it.kind === 'bgd') return !!c.bgd[it.k];
  return false;
}

// ---------------- РИСОВАНИЕ ----------------
function roundRect(x: number, y: number, w: number, h: number, r: number) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

function iconCircle(x: number, y: number, r: number, s: number, ring: string, ringW: number, draw: (r: number) => void) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(120,40,80,0.18)'; circle(0, r * 0.07, r);
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip(); draw(r); ctx.restore();
  ctx.strokeStyle = ring; ctx.lineWidth = ringW; ctx.beginPath(); ctx.arc(0, 0, r - ringW / 2, 0, TAU); ctx.stroke();
  ctx.restore();
}

/** Скроллбар: дорожка и бегунок — видно, что есть ещё и где мы сейчас */
function drawBar(s: Scroller, col: string) {
  const b = s.bar; if (!b) return;
  ctx.fillStyle = 'rgba(255,255,255,0.65)'; roundRect(b.x, b.y, b.w, b.h, b.h / 2); ctx.fill();
  const k = s.w / s.cw, tw = Math.max(b.h * 2, b.w * k), p = clamp(s.off / maxOff(s), 0, 1);
  ctx.fillStyle = col; roundRect(b.x + (b.w - tw) * p, b.y, tw, b.h, b.h / 2); ctx.fill();
}

/** Подсказка «там ещё есть»: мягкая стрелочка-уголок у края ленты */
function edgeHint(s: Scroller) {
  if (s.cw <= s.w) return;
  const a = 0.5 + 0.3 * Math.sin(t * 4), r = Math.min(14, s.h * 0.15);
  ctx.fillStyle = `rgba(255,90,150,${a})`;
  const tri = (x: number, dir: number) => { ctx.beginPath(); ctx.moveTo(x, s.y + s.h / 2 - r); ctx.lineTo(x + dir * r, s.y + s.h / 2); ctx.lineTo(x, s.y + s.h / 2 + r); ctx.closePath(); ctx.fill(); };
  if (s.off < maxOff(s) - 4) tri(s.x + s.w - r - 2 + Math.sin(t * 4) * 3, 1);
  if (s.off > 4) tri(s.x + r + 2 - Math.sin(t * 4) * 3, -1);
}

export function drawUI() {
  if (G.uiA < 0.01) return;
  ctx.save(); ctx.globalAlpha = G.uiA;
  const night = G.cfg.bg === 'night', pad = UI.pad, plate = night ? 'rgba(20,10,60,0.5)' : 'rgba(255,255,255,0.72)';
  // лента этапов
  const ss = UI.stripS;
  ctx.fillStyle = plate; roundRect(ss.x - pad * 0.3, ss.y - pad * 0.2, ss.w + pad * 0.6, ss.h + pad * 0.4, ss.h / 2); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.rect(ss.x, ss.y - pad, ss.w, ss.h + pad * 2); ctx.clip();
  for (const c of UI.cells) {
    if (c.x < ss.x - c.r * 1.3 || c.x > ss.x + ss.w + c.r * 1.3) continue;
    const cur = c.i === G.stage, s = cur ? 1.08 + Math.sin(t * 4) * 0.03 : 0.98;
    iconCircle(c.x, c.y, c.r, s, cur ? '#ffcf3f' : '#ffffff', c.r * (cur ? 0.14 : 0.08), r => stageIcon(c.i, r));
    if (stageHas(c.i) && STAGES[c.i].optional) smallHeart(c.x + c.r * 0.72 * s, c.y - c.r * 0.62 * s, c.r * 0.22, '#ff3f8a');
  }
  ctx.restore();
  edgeHint(ss); drawBar(ss, '#ffb3d1');
  // панель вариантов
  const is = UI.itemsS;
  ctx.fillStyle = plate; roundRect(is.x - pad * 0.4, is.y - pad * 0.4, is.w + pad * 0.8, is.h + pad * 0.8, 26 * S + 8); ctx.fill();
  const id = STAGES[G.stage].id;
  ctx.save(); ctx.beginPath(); ctx.rect(is.x, is.y - pad * 0.4, is.w, is.h + pad * 0.8); ctx.clip();
  UI.items.forEach((it, i) => {
    it.press = Math.max(0, it.press - 0.06);
    if (it.x < is.x - it.r * 1.3 || it.x > is.x + is.w + it.r * 1.3) return;
    const ap = ease.outBack(clamp01((G.stageT - i * 0.03) / 0.3)), sel = isSel(it);
    const s = Math.max(0.01, ap) * (1 - it.press * 0.15) * (sel ? 1.04 : 0.94), y = it.y + (sel ? Math.sin(t * 4 + i) * 2 * S : 0);
    iconCircle(it.x, y, it.r, s, sel ? '#ffcf3f' : '#ffffff', it.r * (sel ? 0.13 : 0.07), r => itemIcon(id, it, r));
    if (sel && it.kind !== 'none') { // значок «выбрано» — сердечко
      ctx.save(); ctx.translate(it.x + it.r * 0.7 * s, y - it.r * 0.7 * s);
      ctx.fillStyle = '#fff'; circle(0, 0, it.r * 0.24); smallHeart(0, it.r * 0.02, it.r * 0.17, '#ff3f8a'); ctx.restore();
    }
  });
  ctx.restore();
  edgeHint(is); drawBar(is, '#ff7aa8');
  // праздник
  drawButton(UI.party, '#ffb928', iconParty, true);
  ctx.restore();
}

/** Праздник: хлопушка с конфетти */
export function iconParty(R: number) {
  ctx.save(); ctx.rotate(-0.5);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, R * 0.5); ctx.lineTo(-R * 0.26, -R * 0.12); ctx.lineTo(R * 0.26, -R * 0.12); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ff5c9a'; ctx.fillRect(-R * 0.2, R * 0.0, R * 0.4, R * 0.08); ctx.fillRect(-R * 0.13, R * 0.18, R * 0.26, R * 0.08);
  ctx.restore();
  const cols = ['#ff5c9a', '#fff', '#5ab4ff', '#fff6a0'];
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI * 0.85 + i * 0.3, d = R * (0.45 + 0.06 * Math.sin(t * 6 + i));
    ctx.fillStyle = cols[i % 4]; ctx.save(); ctx.translate(Math.cos(a) * d + R * 0.12, Math.sin(a) * d + R * 0.05); ctx.rotate(t * 3 + i);
    if (i % 2) ctx.fillRect(-R * 0.06, -R * 0.03, R * 0.12, R * 0.06); else { starPath(4, R * 0.09, R * 0.03); ctx.fill(); }
    ctx.restore();
  }
}
export function iconAgain(R: number) {
  ctx.strokeStyle = '#fff'; ctx.lineWidth = R * 0.16; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, R * 0.42, -Math.PI * 0.35, Math.PI * 1.3); ctx.stroke();
  const a = -Math.PI * 0.35, x = Math.cos(a) * R * 0.42, y = Math.sin(a) * R * 0.42;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x + R * 0.22, y - R * 0.05); ctx.lineTo(x - R * 0.12, y - R * 0.22); ctx.lineTo(x - R * 0.02, y + R * 0.2); ctx.closePath(); ctx.fill();
}
/** «Украшать дальше»: кисточка */
export function iconBrush(R: number) {
  ctx.save(); ctx.rotate(0.7);
  ctx.fillStyle = '#ffe2a8'; ctx.fillRect(-R * 0.09, -R * 0.55, R * 0.18, R * 0.55);
  ctx.fillStyle = '#c9c9d6'; ctx.fillRect(-R * 0.11, -R * 0.02, R * 0.22, R * 0.14);
  ctx.fillStyle = '#ff3f8a'; ctx.beginPath(); ctx.moveTo(-R * 0.12, R * 0.12); ctx.quadraticCurveTo(-R * 0.14, R * 0.45, 0, R * 0.58); ctx.quadraticCurveTo(R * 0.14, R * 0.45, R * 0.12, R * 0.12); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#fff'; ctx.save(); ctx.translate(R * 0.35, -R * 0.3); starPath(4, R * 0.16, R * 0.05); ctx.fill(); ctx.restore();
}
export function iconSound(R: number, on: boolean) {
  ctx.fillStyle = '#fff'; ctx.beginPath();
  ctx.moveTo(-R * 0.45, -R * 0.18); ctx.lineTo(-R * 0.2, -R * 0.18); ctx.lineTo(R * 0.08, -R * 0.42); ctx.lineTo(R * 0.08, R * 0.42); ctx.lineTo(-R * 0.2, R * 0.18); ctx.lineTo(-R * 0.45, R * 0.18); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = R * 0.1; ctx.lineCap = 'round';
  if (on) { ctx.beginPath(); ctx.arc(R * 0.1, 0, R * 0.25, -0.8, 0.8); ctx.stroke(); ctx.beginPath(); ctx.arc(R * 0.1, 0, R * 0.42, -0.8, 0.8); ctx.stroke(); }
  else { ctx.beginPath(); ctx.moveTo(R * 0.22, -R * 0.2); ctx.lineTo(R * 0.5, R * 0.2); ctx.moveTo(R * 0.5, -R * 0.2); ctx.lineTo(R * 0.22, R * 0.2); ctx.stroke(); }
}

// ---------------- ПОПАДАНИЕ ----------------
const inBtn = (b: Btn, x: number, y: number, k = 1.1) => Math.hypot(x - b.x, y - b.y) < Math.max(b.r * k, 30);
const inRect = (r: { x: number; y: number; w: number; h: number }, x: number, y: number, m = 0) => x > r.x - m && x < r.x + r.w + m && y > r.y - m && y < r.y + r.h + m;
/** s — лента, которую можно потянуть из этой точки; bar — тянем за бегунок скроллбара */
export function hitUI(x: number, y: number): any {
  if (inBtn(UI.sound, x, y, 1.2)) return { k: 'sound' };
  if (G.finale) {
    if (G.finale.t > 1.2) { if (inBtn(UI.again, x, y)) return { k: 'again' }; if (inBtn(UI.cont, x, y)) return { k: 'cont' }; }
    return null;
  }
  if (inBtn(UI.party, x, y)) return { k: 'party' };
  const ss = UI.stripS, is = UI.itemsS, pad = UI.pad;
  if (ss.bar && inRect(ss.bar, x, y, 9)) return { k: 'bar', s: ss };
  if (is.bar && inRect(is.bar, x, y, 14)) return { k: 'bar', s: is };
  if (inRect(ss, x, y, pad * 0.4)) {
    for (const c of UI.cells) if (Math.hypot(x - c.x, y - c.y) < c.r * 1.1) return { k: 'stage', i: c.i, s: ss };
    return { k: 'panel', s: ss };
  }
  if (inRect(is, x, y, pad * 0.5)) {
    for (const it of UI.items) if (Math.hypot(x - it.x, y - it.y) < it.r * 1.08) return { k: 'item', it, s: is };
    return { k: 'panel', s: is };
  }
  return null;
}
