// Интерфейс без текста: лента этапов внизу, панель вариантов, стрелка «дальше», кнопки праздника.
import { H, S, TAU, W, clamp, ctx, t } from '../../core/canvas';
import { circle, drawButton, starPath } from '../../core/draw';
import { clamp01, ease } from '../../core/tween';
import { itemIcon, stageIcon } from './icons';
import { BG_COLORS, G, Item, STAGES, stageHas, stageItems } from './state';
import { smallHeart } from './things';

type Btn = { x: number; y: number; r: number; press: number; shake: number };
const mk = (): Btn => ({ x: 0, y: 0, r: 40, press: 0, shake: 0 });
export const UI = {
  strip: { x: 0, y: 0, w: 0, h: 0, cells: [] as { x: number; y: number; r: number; i: number }[] },
  panel: { x: 0, y: 0, w: 0, h: 0 },
  items: [] as (Item & { x: number; y: number; r: number; press: number })[],
  itemsStage: -1,
  arrow: mk(), sound: mk(), again: mk(), cont: mk(),
  hrTarget: { x: 0, y: 0, w: 0, h: 0 },
};

// ---------------- РАСКЛАДКА ----------------
export function layout() {
  const pad = Math.max(8, 14 * S);
  // лента этапов: в один ряд, а на узком экране — в два
  const n = STAGES.length, aw = W - 2 * pad, cmax = Math.max(92 * S, 70);
  const rows = aw / n >= 64 ? 1 : 2, per = Math.ceil(n / rows), cell = Math.min(cmax, aw / per);
  const sh = rows * cell + pad * 0.6;
  const st = UI.strip;
  Object.assign(st, { x: W / 2 - per * cell / 2, y: H - sh - pad * 0.5, w: per * cell, h: sh });
  st.cells = [];
  for (let i = 0; i < n; i++) { const row = Math.floor(i / per), col = i % per, inRow = row < rows - 1 ? per : n - per * (rows - 1); st.cells.push({ x: W / 2 + (col - (inRow - 1) / 2) * cell, y: st.y + pad * 0.3 + (row + 0.5) * cell, r: cell * 0.42, i }); }
  // панель вариантов: справа (широкий экран) или под сердцем (узкий)
  const A = { w: W, h: st.y - pad * 0.3 };
  const its = stageItems(G.stage), m = its.length, cap = Math.max(130 * S, 84);
  const wide = A.w > A.h * 1.25;
  const reg = wide ? { w: A.w * 0.4 - pad, h: A.h - 2 * pad } : { w: A.w - 2 * pad, h: A.h * 0.42 };
  let best = { c: 0, cols: 1, rows: m };
  for (let cols = 1; cols <= m; cols++) {
    const rws = Math.ceil(m / cols), c = Math.min(reg.w / cols, reg.h / rws, cap);
    if (c > best.c + 0.5 || (Math.abs(c - best.c) <= 0.5 && rws < best.rows)) best = { c, cols, rows: rws };
  }
  const pw = best.cols * best.c, ph = best.rows * best.c;
  const p = UI.panel;
  if (wide) { Object.assign(p, { x: A.w * 0.6 + (A.w * 0.4 - pad) / 2 - pw / 2, y: A.h / 2 - ph / 2, w: pw, h: ph }); UI.hrTarget = { x: 0, y: 0, w: A.w * 0.6, h: A.h }; }
  else { Object.assign(p, { x: W / 2 - pw / 2, y: A.h - pad * 0.5 - ph, w: pw, h: ph }); UI.hrTarget = { x: 0, y: 0, w: W, h: p.y - pad * 0.5 }; }
  if (UI.itemsStage !== G.stage) { UI.items = its.map(it => ({ ...it, x: 0, y: 0, r: 0, press: 0 })); UI.itemsStage = G.stage; }
  UI.items.forEach((it, i) => {
    const row = Math.floor(i / best.cols), col = i % best.cols, inRow = row < best.rows - 1 ? best.cols : m - best.cols * (best.rows - 1);
    Object.assign(it, { x: p.x + pw / 2 + (col - (inRow - 1) / 2) * best.c, y: p.y + (row + 0.5) * best.c, r: best.c * 0.42 });
  });
  if (G.finale) UI.hrTarget = { x: 0, y: 0, w: W, h: H };
  const HR = UI.hrTarget;
  const ar = clamp(52 * S, 36, 64);
  Object.assign(UI.arrow, { x: HR.x + HR.w - ar - pad, y: HR.y + HR.h - ar - pad, r: ar });
  const sr = Math.max(22, 26 * S); Object.assign(UI.sound, { x: W - sr - 12, y: sr + 12, r: sr });
  const fr = clamp(60 * S, 40, 72);
  Object.assign(UI.again, { x: fr + 24, y: H - fr - 24, r: fr });
  Object.assign(UI.cont, { x: W - fr - 24, y: H - fr - 24, r: fr });
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

export function drawUI() {
  if (G.uiA < 0.01) return;
  ctx.save(); ctx.globalAlpha = G.uiA;
  const night = G.cfg.bg === 'night';
  // лента этапов
  const st = UI.strip, pad = Math.max(8, 14 * S);
  ctx.fillStyle = night ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.55)'; roundRect(st.x - pad * 0.4, st.y, st.w + pad * 0.8, st.h, Math.min(st.h / 2, 40 * S + 10)); ctx.fill();
  for (const c of st.cells) {
    const cur = c.i === G.stage, s = cur ? 1.1 + Math.sin(t * 4) * 0.03 : 0.9;
    iconCircle(c.x, c.y, c.r, s, cur ? '#ffcf3f' : '#ffffff', c.r * (cur ? 0.14 : 0.08), r => stageIcon(c.i, r));
    if (stageHas(c.i) && STAGES[c.i].optional) { smallHeart(c.x + c.r * 0.72 * s, c.y - c.r * 0.68 * s, c.r * 0.22, '#ff3f8a'); }
  }
  // панель вариантов
  const p = UI.panel;
  ctx.fillStyle = night ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.5)'; roundRect(p.x - pad * 0.5, p.y - pad * 0.5, p.w + pad, p.h + pad, 28 * S + 8); ctx.fill();
  const id = STAGES[G.stage].id;
  UI.items.forEach((it, i) => {
    const ap = ease.outBack(clamp01((G.stageT - i * 0.035) / 0.3)), sel = isSel(it);
    it.press = Math.max(0, it.press - 0.06);
    const s = Math.max(0.01, ap) * (1 - it.press * 0.15) * (sel ? 1.04 : 0.94), y = it.y + (sel ? Math.sin(t * 4 + i) * 2 * S : 0);
    iconCircle(it.x, y, it.r, s, sel ? '#ffcf3f' : '#ffffff', it.r * (sel ? 0.13 : 0.07), r => itemIcon(id, it, r));
    if (sel && it.kind !== 'none') { // значок «выбрано» — сердечко
      ctx.save(); ctx.translate(it.x + it.r * 0.7 * s, y - it.r * 0.7 * s);
      ctx.fillStyle = '#fff'; circle(0, 0, it.r * 0.24); smallHeart(0, it.r * 0.02, it.r * 0.17, '#ff3f8a'); ctx.restore();
    }
  });
  // стрелка «дальше» (на последнем этапе — галочка праздника)
  const last = G.stage === STAGES.length - 1;
  drawButton(UI.arrow, last ? '#2ec46b' : '#ff7aa8', last ? iconCheck : iconArrow, true);
  ctx.restore();
}

export function iconArrow(R: number) {
  ctx.fillStyle = '#fff'; ctx.beginPath();
  ctx.moveTo(-R * 0.45, -R * 0.16); ctx.lineTo(R * 0.05, -R * 0.16); ctx.lineTo(R * 0.05, -R * 0.42); ctx.lineTo(R * 0.5, 0);
  ctx.lineTo(R * 0.05, R * 0.42); ctx.lineTo(R * 0.05, R * 0.16); ctx.lineTo(-R * 0.45, R * 0.16); ctx.closePath(); ctx.fill();
}
export function iconCheck(R: number) {
  ctx.strokeStyle = '#fff'; ctx.lineWidth = R * 0.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-R * 0.4, 0); ctx.lineTo(-R * 0.1, R * 0.3); ctx.lineTo(R * 0.42, -R * 0.3); ctx.stroke();
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
export function hitUI(x: number, y: number): any {
  if (inBtn(UI.sound, x, y, 1.2)) return { k: 'sound' };
  if (G.finale) {
    if (G.finale.t > 1.2) { if (inBtn(UI.again, x, y)) return { k: 'again' }; if (inBtn(UI.cont, x, y)) return { k: 'cont' }; }
    return null;
  }
  if (inBtn(UI.arrow, x, y)) return { k: 'arrow' };
  for (const c of UI.strip.cells) if (Math.hypot(x - c.x, y - c.y) < c.r * 1.1) return { k: 'stage', i: c.i };
  for (const it of UI.items) if (Math.hypot(x - it.x, y - it.y) < it.r * 1.08) return { k: 'item', it };
  // промахнулся мимо кнопок, но попал в саму ленту/панель — ничего не делаем в мире под ней
  const st = UI.strip, p = UI.panel, pad = Math.max(8, 14 * S);
  if (y > st.y && x > st.x - pad && x < st.x + st.w + pad) return { k: 'panel' };
  if (x > p.x - pad && x < p.x + p.w + pad && y > p.y - pad && y < p.y + p.h + pad) return { k: 'panel' };
  return null;
}
