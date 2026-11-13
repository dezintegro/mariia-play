// Интерфейс без текста: лента этапов внизу, панель вариантов, стрелка «дальше», кнопки праздника.
import { H, S, TAU, W, clamp, ctx, t } from '../../core/canvas';
import { circle, drawButton, starPath } from '../../core/draw';
import { clamp01, ease } from '../../core/tween';
import { STILL, drawHeart } from './heart';
import { BG_COLORS, G, Item, STAGES, stageHas, stageItems } from './state';
import { MINI_COLORS, balloon, bubble, butterfly, cloud, hillsPath, miniHeart, moon, rainbowArc, smallHeart, sparkleStar, stemFlower, sun } from './things';

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

// ---------------- ЗНАЧКИ ----------------
const ZOOM: Record<string, [number, number, number]> = {
  color: [0, -0.05, 0.52], eyes: [0, -0.12, 1.3], lashes: [0, -0.22, 1.15], nose: [0, 0.08, 1.9], cheeks: [0, 0.06, 0.95],
  hair: [0, -0.3, 0.48], earrings: [-0.72, -0.02, 0.85], necklace: [0, 0.5, 0.95],
};
function heartIcon(id: string, cfg: Record<string, any>, r: number) {
  const [fx, fy, z] = ZOOM[id], R = r * z;
  ctx.save(); ctx.translate(-fx * R, -fy * R); drawHeart(cfg, R, STILL); ctx.restore();
}
function iconBgFill(r: number, k = G.cfg.bg) {
  const [c0, c1] = BG_COLORS[k] || BG_COLORS.pink, g = ctx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, c0); g.addColorStop(1, c1); ctx.fillStyle = g; circle(0, 0, r);
}
function noneIcon(r: number) {
  ctx.strokeStyle = '#d7a9bf'; ctx.lineWidth = r * 0.13; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-r * 0.35, r * 0.35); ctx.lineTo(r * 0.35, -r * 0.35); ctx.stroke();
}
function envIcon(k: string, r: number) {
  iconBgFill(r);
  if (k === 'babies') { miniHeart(-r * 0.42, r * 0.2, r * 0.3, MINI_COLORS[1]); miniHeart(r * 0.42, r * 0.2, r * 0.3, MINI_COLORS[2]); miniHeart(0, -r * 0.15, r * 0.36, MINI_COLORS[0]); }
  else if (k === 'bubbles') { bubble(-r * 0.25, r * 0.15, r * 0.38); bubble(r * 0.35, -r * 0.3, r * 0.25); bubble(r * 0.3, r * 0.45, r * 0.15); }
  else if (k === 'butterflies') butterfly(0, 0, r * 0.55, 0.3, '#ff8fc8', -0.2);
  else if (k === 'balloons') { balloon(-r * 0.25, -r * 0.2, r * 0.3, '#ff5c8a', 1.6); balloon(r * 0.3, -r * 0.35, r * 0.28, '#6ec3ff', 1.9); }
  else if (k === 'sparkles') { sparkleStar(-r * 0.3, -r * 0.2, r * 0.32, 0); sparkleStar(r * 0.35, r * 0.1, r * 0.25, 0.4); sparkleStar(-r * 0.05, r * 0.45, r * 0.18, 0.2); }
  else if (k === 'flowers') { stemFlower(-r * 0.35, r * 0.75, r * 0.2, '#ff7aa8', 0); stemFlower(r * 0.05, r * 0.8, r * 0.24, '#ffd23f', 0.3); stemFlower(r * 0.42, r * 0.75, r * 0.18, '#c9a7ff', -0.2); }
}
function bgIcon(it: Item, r: number) {
  if (it.kind === 'bgcolor') {
    iconBgFill(r, it.k);
    smallHeart(0, r * 0.05, r * 0.32, it.k === 'night' ? '#ffd6ea' : 'rgba(255,255,255,0.9)');
    if (it.k === 'night') { ctx.fillStyle = '#fff6c0'; for (const [x, y] of [[-0.5, -0.4], [0.45, -0.5], [0.55, 0.3]]) circle(x * r, y * r, r * 0.05); }
    return;
  }
  iconBgFill(r);
  const k = it.k;
  if (k === 'clouds') cloud(0, 0, r * 0.55, true);
  else if (k === 'rainbow') rainbowArc(0, r * 0.45, r * 0.85, r * 0.45, 1);
  else if (k === 'sun') sun(0, 0, r * 0.45, t * 0.3, 0);
  else if (k === 'hills') { ctx.fillStyle = '#9fe08a'; hillsPath(-r, r, r * 0.05, r, r * 0.12, 0.8); ctx.fill(); ctx.fillStyle = '#7fd16c'; hillsPath(-r, r, r * 0.4, r, r * 0.08, 2.6); ctx.fill(); }
  else if (k === 'hearts') { smallHeart(-r * 0.35, -r * 0.25, r * 0.2, '#fff'); smallHeart(r * 0.3, -r * 0.05, r * 0.26, '#fff'); smallHeart(-r * 0.1, r * 0.4, r * 0.16, '#fff'); }
  else if (k === 'moon') { moon(-r * 0.1, r * 0.05, r * 0.42, 0); ctx.fillStyle = '#fff6c0'; circle(r * 0.5, -r * 0.45, r * 0.06); circle(r * 0.55, r * 0.35, r * 0.05); }
}
function colorIcon(k: string, r: number) { iconBgFill(r); heartIcon('color', { ...G.cfg, color: k, hair: null, earrings: null, necklace: null }, r); }

/** Значок варианта (рисуется в (0,0), радиус r, уже обрезан кругом) */
export function itemIcon(id: string, it: Item, r: number) {
  if (it.kind === 'none') { ctx.fillStyle = '#fff4f9'; circle(0, 0, r); noneIcon(r); return; }
  if (id === 'env') return envIcon(it.k, r);
  if (id === 'bg') return bgIcon(it, r);
  if (id === 'color') return colorIcon(it.k, r);
  iconBgFill(r);
  heartIcon(id, { ...G.cfg, [id]: it.k }, r);
}

/** Значок этапа на ленте: показывает, ЧТО украшаем на этом шаге */
const REP: Record<string, string> = { eyes: 'sparkle', lashes: 'long', nose: 'clown', cheeks: 'blush', hair: 'bow', earrings: 'heart', necklace: 'pearls' };
function stageIcon(i: number, r: number) {
  const id = STAGES[i].id;
  if (id === 'color') {
    ctx.fillStyle = '#fff'; circle(0, 0, r);
    smallHeart(-r * 0.38, r * 0.2, r * 0.3, '#ff4d6d', -0.3); smallHeart(r * 0.38, r * 0.2, r * 0.3, '#59a8ff', 0.3); smallHeart(0, -r * 0.2, r * 0.34, '#ffd23f');
    return;
  }
  if (id === 'env') { iconBgFill(r); bubble(r * 0.4, -r * 0.35, r * 0.24); miniHeart(-r * 0.1, r * 0.12, r * 0.42, MINI_COLORS[0]); return; }
  if (id === 'bg') {
    const g = ctx.createLinearGradient(0, -r, 0, r); g.addColorStop(0, '#bfe6ff'); g.addColorStop(1, '#ffd6ea'); ctx.fillStyle = g; circle(0, 0, r);
    sun(-r * 0.3, -r * 0.3, r * 0.26, 0, 0); ctx.fillStyle = '#9fe08a'; hillsPath(-r, r, r * 0.35, r, r * 0.1, 0.5); ctx.fill(); cloud(r * 0.35, -r * 0.05, r * 0.3, false);
    return;
  }
  iconBgFill(r);
  const base = { color: G.cfg.color, eyes: 'round', env: {}, bgd: {} } as Record<string, any>;
  heartIcon(id, { ...base, [id]: REP[id] }, r);
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
