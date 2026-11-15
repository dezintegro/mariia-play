// «Сердечко-модница»: украшаем сердце с глазками по этапам, в конце — праздник.
import { AC, initAudio, soundOn, toggleSound } from '../../core/audio';
import { H, S, TAU, W, advance, clamp, ctx, cv, pick, pointer, rand, resizeCanvas, t } from '../../core/canvas';
import { drawButton } from '../../core/draw';
import { addP, burst, drawParticles, updateParticles } from '../../core/particles';
import { COLORS, Live, drawHeart } from './heart';
import { photoFrame } from './icons';
import { PENTA, musicBeat, sfx, updMusic } from './sounds';
import { ALBUM_MAX, DRESS_N, G, Item, SETS, STAGES, defaultCfg, load, sameCfg, save, setCfg, stageItems } from './state';
import { careAct, careHeartTap, careLive, careStageChange, careXform, drawCareBack, drawCareFront, drawCareOverlay, hitCare, tapCare, updateCare } from './care';
import { hasReaction, partAt, react, reactXform, updateReact } from './reactions';
import { MINI_COLORS, miniHeart } from './things';
import { UI, drawUI, hitUI, iconAgain, iconBrush, iconCamera, iconSound, isSel, layout, maxOff, revealItem, revealStage, updateScroll } from './ui';
import { babyPos, drawBg, groundY, drawEnvBack, drawEnvFront, env, hitWorld, tapWorld, updateWorld } from './world';

const hs = G.hs;

// ---------------- СЕРДЦЕ ----------------
/** Положение и деформация сердца сейчас: прыжок, «пружинка», покачивание, танец в празднике */
function heartXform() {
  const { x, y, R } = G.heart;
  let dy = 0, rot = 0, sq = 0;
  if (hs.jT < 0.55) dy -= Math.sin(hs.jT / 0.55 * Math.PI) * 0.28 * R;
  if (hs.sqT < 1.2) sq += 0.12 * Math.sin(hs.sqT * 16) * Math.exp(-hs.sqT * 5);
  if (hs.wgT < 1.5) rot += 0.16 * Math.sin(hs.wgT * 14) * Math.exp(-hs.wgT * 3);
  // сердцебиение: двойной «тук-тук»
  const b = hs.beatT % 1.6, beat = (b < 0.12 ? Math.sin(b / 0.12 * Math.PI) : 0) + (b > 0.2 && b < 0.32 ? Math.sin((b - 0.2) / 0.12 * Math.PI) * 0.7 : 0);
  let sc = 1 + beat * 0.025;
  if (G.finale) { const f = G.finale.t * 4.2; rot += Math.sin(f) * 0.12; dy -= Math.abs(Math.sin(f)) * 0.1 * R; sq += Math.cos(f * 2) * 0.03; }
  sc *= 1 + Math.sin(t * 1.3) * 0.008;
  let spin = 0; // палочка: сердце крутится вокруг своего центра
  if (hs.spinT < 0.7) { const p = hs.spinT / 0.7; spin = TAU * (p * p * (3 - 2 * p)); dy -= Math.sin(p * Math.PI) * 0.15 * R; }
  const ra = reactXform(R), ca = careXform(R);
  return { x, y: y + dy + ra.dy + ca.dy, R, spin, rot: rot + ra.rot + ca.rot, sx: sc * (1 + sq) * ra.sx * ca.sx, sy: sc * (1 - sq) * ra.sy * ca.sy };
}

function drawBigHeart() {
  const X = heartXform();
  // мягкая тень на земле
  ctx.fillStyle = 'rgba(120,40,80,0.12)'; ctx.beginPath(); ctx.ellipse(X.x, G.heart.y + 1.02 * X.R, 0.55 * X.R * (1 - (G.heart.y - X.y) / X.R * 0.5), 0.07 * X.R, 0, 0, TAU); ctx.fill();
  ctx.save(); ctx.translate(X.x, X.y + 0.95 * X.R); ctx.rotate(X.rot); ctx.scale(X.sx, X.sy); ctx.translate(0, -0.95 * X.R); if (X.spin) ctx.rotate(X.spin);
  const L: Live = { lx: hs.lx, ly: hs.ly, blink: hs.blink, mouth: hs.mouth, love: hs.love, swing: hs.swing, pop: hs.pop, live: true, act: hs.act };
  careLive(L);
  drawHeart(G.cfg, X.R, L);
  ctx.restore();
}

function updateHeart(dt: number) {
  hs.sqT += dt; hs.jT += dt; hs.wgT += dt; hs.beatT += dt; hs.spinT += dt;
  hs.love = Math.max(0, hs.love - dt * 0.45); hs.mouth = Math.max(0, hs.mouth - dt * 1.2);
  if (G.finale) hs.mouth = Math.max(hs.mouth, musicBeat() % 4 < 2 ? 0.6 : 0.15);
  hs.blinkT -= dt; if (hs.blinkT <= 0) { hs.blink = 1; hs.blinkT = rand(2.5, 5); } hs.blink = Math.max(0, hs.blink - dt * 6);
  for (const k in hs.pop) { hs.pop[k] += dt * 2.6; if (hs.pop[k] >= 1) delete hs.pop[k]; }
  hs.swingV += (-hs.swing * 30 - hs.swingV * 3) * dt; hs.swing += hs.swingV * dt;
  // глаза следят за курсором/пальцем; если его нет — оглядываются
  const { x, y, R } = G.heart; let tx: number, ty: number;
  if (pointer.x > -999) { tx = clamp((pointer.x - x) / (R * 1.5), -1, 1); ty = clamp((pointer.y - y) / (R * 1.5), -1, 1); }
  else { tx = Math.sin(t * 0.7) * 0.6; ty = Math.sin(t * 0.43) * 0.4; }
  hs.lx += (tx - hs.lx) * Math.min(1, dt * 8); hs.ly += (ty - hs.ly) * Math.min(1, dt * 8);
}

/** Сердце радуется: подпрыгнуть и сплющиться */
function happy(big = false) { hs.sqT = 0; hs.swingV += 3; hs.mouth = 1; if (big) hs.jT = 0; }

/** Тап по сердцу: по надетой детали — её своя реакция, иначе 3 реакции по кругу */
export function tapHeart(px?: number, py?: number) {
  if (careHeartTap()) return;
  const { x, y, R } = G.heart;
  if (px != null && !G.finale) {
    const part = partAt(G.cfg, (px - x) / R, (py - y) / R);
    if (part && G.cfg[part] != null) { react(part, G.cfg[part], 'tap'); return; }
  }
  const r = hs.react++ % 3;
  if (r === 0) { hs.jT = 0; hs.sqT = 0; hs.mouth = 1; hs.swingV += 4; sfx.giggle(); burst(x, y - R * 0.5, 'spark', 10, { speed: 200 }); }
  else if (r === 1) { hs.wgT = 0; hs.mouth = 0.6; hs.swingV += 6; sfx.boing(); burst(x, y, 'confetti', 14, { speed: 260, g: 300 }); }
  else { hs.love = 1.6; hs.sqT = 0; sfx.kiss(); sfx.beat(); addP({ kind: 'bigheart', x, y: y - R * 0.1, vx: 0, vy: -30 * S, life: 1, size: R * 0.5, color: 'rgba(255,90,150,0.5)', rot: 0, vr: 0, g: 0 }); burst(x, y - R * 0.3, 'heart', 10, { color: '#ff5c9a', up: -100, speed: 180 }); }
}

// ---------------- ВЫБОР ----------------
/** Где на сердце появится деталь — туда летят искорки */
const PART_AT: Record<string, [number, number]> = { color: [0, -0.1], eyes: [0, -0.12], lashes: [0, -0.3], nose: [0, 0.06], mouth: [0, 0.25], cheeks: [0, 0.1], hair: [0, -0.85], earrings: [0, -0.1], necklace: [0, 0.55] };

export function choose(it: Item & { x?: number; y?: number; press?: number }) {
  const st = STAGES[G.stage], id = st.id, c = G.cfg, { x: hx, y: hy, R } = G.heart;
  if (it.press != null) it.press = 1;
  const fromX = it.x ?? hx, fromY = it.y ?? hy;
  if (it.kind === 'care') { careAct(id, it.k as string, fromX, fromY); return; }
  if (it.kind === 'camera') { takePhoto(fromX, fromY); return; }
  if (it.kind === 'photo') { loadPhoto(+(it.k as string)); return; }
  if (G.wand) return; // палочка ещё колдует
  const sparkTo = (px: number, py: number, col = '#fff6a8') => {
    for (let i = 0; i < 10; i++) { const k = i / 10; addP({ kind: 'spark', x: fromX + (px - fromX) * k, y: fromY + (py - fromY) * k, vx: rand(-30, 30) * S, vy: rand(-30, 30) * S, life: 0.3 + k * 0.5, size: rand(5, 9) * S, color: col, rot: rand(0, TAU), vr: 4, g: 0 }); }
    burst(px, py, 'spark', 14, { color: col, speed: 220 });
  };
  const idx = st.opts.indexOf(it.k as string);
  if (it.kind === 'none') {
    if (id === 'env') { if (!Object.values(c.env).some(Boolean)) return wiggleOnly(); c.env = {}; env.bubbles.length = 0; }
    else { if (c[id] == null) return wiggleOnly(); c[id] = null; }
    sfx.poof(); burst(hx, hy, 'smoke', 8, { color: '#ffffff', speed: 120, size: 22 }); hs.wgT = 0;
  } else if (it.kind === 'single') {
    if (c[id] === it.k) return wiggleOnly();
    c[id] = it.k; hs.pop[id] = 0;
    const [px, py] = PART_AT[id] || [0, 0];
    sfx.pick(idx + G.stage); sparkTo(hx + px * R, hy + py * R); react(id, it.k as string, 'pick');
  } else if (it.kind === 'toggle') {
    c.env[it.k] = !c.env[it.k];
    if (c.env[it.k]) { sfx.pick(idx + 3); sfx.magic(); happy(); burst(hx, hy, 'heart', 12, { speed: 300, up: -80 }); if (it.k === 'balloons') env.balloons.forEach(b => { b.fly = 0; b.grow = 0; }); }
    else { sfx.poof(); if (it.k === 'bubbles') env.bubbles.length = 0; }
  } else if (it.kind === 'bgcolor') {
    if (c.bg === it.k) return wiggleOnly();
    c.bg = it.k; sfx.pick(Object.keys(c).length + idx); sfx.magic(); happy(); burst(fromX, fromY, 'spark', 20, { speed: 400 });
  } else if (it.kind === 'bgd') {
    c.bgd[it.k] = !c.bgd[it.k];
    if (c.bgd[it.k]) { sfx.chime(PENTA[(G.stageT * 7 | 0) % PENTA.length]); sfx.magic(); happy(); burst(fromX, fromY, 'spark', 16, { speed: 300 }); }
    else sfx.poof();
  }
  G.dirty = true; save();
}
function wiggleOnly() { hs.wgT = 0; hs.mouth = 0.7; sfx.giggle(1.2); }

export function goStage(i: number) {
  if (i === G.stage) { sfx.boop(); return; }
  careStageChange(STAGES[G.stage].id, STAGES[i].id);
  G.stage = i; G.stageT = 0; sfx.stage(i); hs.swingV += 2; save();
  showSelected(); revealStage(i);
}
/** Прокрутить панель к выбранному варианту (или в начало) */
function showSelected() {
  UI.itemsS.off = 0; UI.itemsS.vel = 0; layout();
  const i = UI.items.findIndex(it => it.kind !== 'none' && isSel(it));
  if (i >= 0) revealItem(i);
}

// ---------------- ПРАЗДНИК ----------------
export function startFinale() {
  G.finale = { t: 0, conf: 0 }; sfx.tada(); hs.jT = 0; hs.love = 1.2;
  burst(W / 2, H / 2, 'confetti', 60, { speed: 600, g: 400, size: 12 });
}
export function restart() {
  keepInAlbum(); // «заново» ничего не теряет: наряд уже в альбоме
  G.finale = null; G.cfg = defaultCfg(); G.dirty = false; G.stage = 0; G.stageT = 0; env.bubbles.length = 0;
  burst(G.heart.x, G.heart.y, 'smoke', 12, { color: '#ffffff', speed: 200, size: 26 }); sfx.poof(); sfx.wheee(); happy(true); save();
}
// ---------------- ФОТО-АЛЬБОМ ----------------
let photoId = 0;
/** Положить текущий наряд в альбом (если такого фото ещё нет). Возвращает, добавлено ли. */
function addPhoto(): boolean {
  G.dirty = false;
  if (G.album.some(p => sameCfg(p.cfg, G.cfg))) return false;
  photoId = Math.max(photoId, ...G.album.map(p => p.id)) + 1;
  G.album.unshift({ id: photoId, cfg: JSON.parse(JSON.stringify(G.cfg)) });
  G.album.length = Math.min(G.album.length, ALBUM_MAX);
  UI.itemsStage = -1; // в панели альбома поменялись кнопки
  return true;
}
/** Щёлк! Вспышка, фото уменьшается и улетает в альбом */
export function takePhoto(fx = G.heart.x, fy = G.heart.y) {
  const added = addPhoto();
  G.flash = 1; sfx.shutter();
  G.photoFly = { cfg: JSON.parse(JSON.stringify(G.cfg)), t: 0, x0: G.heart.x, y0: G.heart.y, R0: G.heart.R };
  hs.mouth = 1; hs.sqT = 0;
  if (!added) burst(fx, fy, 'spark', 8, { speed: 160 });
  save();
}
/** Наряд сделан руками — молча сберечь его в альбом (перед «заново» и палочкой) */
function keepInAlbum() {
  if (!G.dirty) return;
  if (addPhoto()) G.photoFly = { cfg: JSON.parse(JSON.stringify(G.cfg)), t: 0, x0: G.heart.x, y0: G.heart.y, R0: G.heart.R };
}
/** Тап по фото в альбоме: это сердце возвращается */
export function loadPhoto(id: number) {
  const p = G.album.find(q => q.id === id); if (!p) return;
  if (sameCfg(p.cfg, G.cfg)) return wiggleOnly();
  keepInAlbum();
  G.cfg = Object.assign(defaultCfg(), JSON.parse(JSON.stringify(p.cfg))); G.dirty = false;
  for (const k of ['hair', 'eyes', 'nose', 'mouth', 'cheeks', 'lashes', 'earrings', 'necklace']) hs.pop[k] = 0;
  burst(G.heart.x, G.heart.y, 'smoke', 10, { color: '#ffffff', speed: 180, size: 24 });
  burst(G.heart.x, G.heart.y - G.heart.R * 0.3, 'heart', 12, { speed: 260, up: -80 });
  sfx.poof(); sfx.tinkle(); happy(true); save();
}
/** Где в интерфейсе «живёт» альбом — туда улетает фото */
function albumSpot(): [number, number] {
  const i = STAGES.findIndex(s => s.id === 'album'), c = UI.cells[i];
  if (G.stage === i && UI.items[1]) return [UI.items[1].x, UI.items[1].y];
  return c ? [c.x, c.y] : [W - 40, 40];
}
function drawPhotoFly() {
  const P = G.photoFly; if (!P) return;
  const k = Math.min(1, P.t / 0.9), e = k * k * (3 - 2 * k), [tx, ty] = albumSpot();
  const x = P.x0 + (tx - P.x0) * e, y = P.y0 + (ty - P.y0) * e - Math.sin(k * Math.PI) * 60 * S;
  const R = P.R0 * (1 - e * 0.85) * (P.t < 0.15 ? 1 + (0.15 - P.t) * 0.6 : 1);
  ctx.save(); ctx.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : 1; ctx.translate(x, y); ctx.rotate(Math.sin(k * Math.PI) * 0.3);
  photoFrame(P.cfg, R);
  ctx.restore();
}

// ---------------- ВОЛШЕБНАЯ ПАЛОЧКА ----------------
const WAND_P: Record<string, number> = { lashes: 0.7, nose: 0.7, cheeks: 0.7, hair: 0.85, earrings: 0.65, necklace: 0.65 };
/** Разделы, где палочка может заменить деталь набора на «базовую» (первые варианты раздела) */
const SWAP_IDS = ['eyes', 'lashes', 'nose', 'mouth', 'cheeks', 'hair', 'earrings', 'necklace'];
/** Наряд для палочки: ~70% — готовый образ из SETS с 1–2 заменами на базовые варианты, ~30% — полный случай */
export function wandCfg(rnd = Math.random): Record<string, any> {
  const pk = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  if (rnd() < 0.7) {
    const c = setCfg(pk(SETS));
    const n = 1 + (rnd() < 0.5 ? 1 : 0), ids = SWAP_IDS.slice();
    for (let j = 0; j < n; j++) {
      const id = ids.splice(Math.floor(rnd() * ids.length), 1)[0], st = STAGES.find(q => q.id === id);
      const basic = st.opts.slice(0, id === 'eyes' ? 3 : 4).filter(o => o !== c[id]);
      c[id] = pk(basic);
    }
    return c;
  }
  const c: Record<string, any> = {};
  for (let i = 0; i < DRESS_N; i++) {
    const st = STAGES[i];
    if (st.id === 'env') { const on: Record<string, boolean> = {}; for (const k of st.opts) if (rnd() < 0.25) on[k] = true; if (!Object.keys(on).length) on[pk(st.opts)] = true; c.env = on; continue; }
    if (st.id === 'bg') { c.bg = pk(stageItems(i).filter(q => q.kind === 'bgcolor')).k; const d: Record<string, boolean> = {}; for (let j = 0; j < 2; j++) if (rnd() < 0.6) d[pk(stageItems(i).filter(q => q.kind === 'bgd')).k as string] = true; c.bgd = d; continue; }
    c[st.id] = rnd() < (WAND_P[st.id] ?? 1) ? pk(st.opts) : null;
  }
  return c;
}
/** Наряд палочкой: детали «прощёлкиваются» по очереди, сердце крутится */
export function wand() {
  if (G.wand || G.finale) return;
  keepInAlbum();
  UI.wand.press = 1;
  let c = wandCfg();
  for (let k = 0; k < 5 && sameCfg({ ...defaultCfg(), ...c }, G.cfg); k++) c = wandCfg(); // не повторять текущий наряд
  const seq: [string, any][] = [];
  for (let i = 0; i < DRESS_N; i++) {
    const id = STAGES[i].id;
    if (id === 'bg') { seq.push(['bg', c.bg]); seq.push(['bgd', c.bgd]); }
    else seq.push([id, c[id] ?? null]);
  }
  G.wand = { t: 0, seq, i: 0 };
  hs.spinT = 0; sfx.wand(); hs.mouth = 1;
  burst(G.heart.x, G.heart.y, 'spark', 30, { speed: 380, color: '#fff6a8' });
}
function updateWand(dt: number) {
  const Wd = G.wand; if (!Wd) return;
  Wd.t += dt;
  while (Wd.i < Wd.seq.length && Wd.t > 0.35 + Wd.i * 0.12) {
    const [k, v] = Wd.seq[Wd.i];
    if (k === 'env') { G.cfg.env = v; env.bubbles.length = 0; }
    else if (k === 'bgd') G.cfg.bgd = v;
    else { G.cfg[k] = v; hs.pop[k] = 0; }
    sfx.pick(Wd.i * 2);
    const [px, py] = PART_AT[k] || [rand(-1, 1), rand(-1, 0.5)], { x, y, R } = G.heart;
    burst(x + px * R, y + py * R, 'spark', 8, { speed: 200, color: pick(['#fff6a8', '#ffc4e1', '#c9f0ff']) });
    Wd.i++;
  }
  if (Wd.i >= Wd.seq.length && Wd.t > 0.35 + Wd.seq.length * 0.12 + 0.2) {
    G.wand = null; G.dirty = false; sfx.tada(); happy(true); hs.love = 1;
    burst(G.heart.x, G.heart.y - G.heart.R * 0.4, 'heart', 14, { speed: 300, up: -100 });
    save();
  }
}

export function cont() { G.finale = null; G.stageT = 0; sfx.next(); happy(); }
export function party() { UI.party.press = 1; startFinale(); }

function updateFinale(dt: number) {
  const F = G.finale; if (!F) return;
  F.t += dt; F.conf -= dt;
  if (F.conf <= 0) { F.conf = 0.35; for (let i = 0; i < 6; i++) addP({ kind: Math.random() < 0.25 ? 'heart' : 'confetti', x: rand(0, W), y: -10, vx: rand(-40, 40) * S, vy: rand(60, 160) * S, life: rand(2.5, 4), size: rand(8, 14) * S, color: pick(['#ff7aa8', '#ffd66b', '#8fd3ff', '#a8e6a1', '#c9a7ff', '#ff5c7a']), rot: rand(0, TAU), vr: rand(-6, 6), g: 60 }); }
}

/** Хоровод мини-сердечек вокруг большого сердца; back — задняя половина круга */
function drawRing(back: boolean) {
  if (!G.finale) return;
  const { x, y, R } = G.heart, a0 = G.finale.t * 0.9, appear = Math.min(1, G.finale.t / 0.8);
  MINI_COLORS.forEach((col, i) => {
    const a = a0 + i * TAU / MINI_COLORS.length, s = Math.sin(a);
    if ((s < 0) !== back) return;
    const r = R * 0.2 * (0.85 + 0.15 * (s + 1) / 2) * appear;
    const hop = Math.abs(Math.sin(G.finale.t * 6 + i)) * R * 0.08;
    miniHeart(x + Math.cos(a) * R * 1.45, y + 0.78 * R + s * R * 0.22 - hop, Math.max(0.01, r), col, { lx: -Math.cos(a), mouth: 1, rot: Math.sin(G.finale.t * 6 + i) * 0.15 });
  });
}

// ---------------- ЦИКЛ ----------------
const HAIR_TOP: Record<string, number> = { bunny: 1.75, unicorn: 1.3, afro: 1.35, bun: 1.18, cat: 1.2, long: 1.12, crown: 1.05, bow: 1.1, flowers: 1.08 };
const HAIR_SIDE: Record<string, number> = { long: 1.32, pigtails: 1.6, afro: 1.42 };
/** Насколько сердце с украшениями выходит за R: [вверх, вбок] */
function heartExtent(c: Record<string, any>): [number, number] {
  return [HAIR_TOP[c.hair] || 1.02, Math.max(HAIR_SIDE[c.hair] || 1.04, c.earrings ? 1.12 : 1.04)];
}
function placeHeart(dt: number) {
  const T = UI.hrTarget, k = G.snap ? 1 : Math.min(1, dt * 5);
  for (const key of ['x', 'y', 'w', 'h'] as const) G.HR[key] += (T[key] - G.HR[key]) * k;
  let tx: number, ty: number, tR: number;
  if (G.finale) { tR = Math.min(W, H) * 0.28; tx = W / 2; ty = H * 0.46; }
  else {
    // габарит зависит от причёски: уши зайчика торчат вверх, хвостики — вбок; сердце берёт всё свободное место
    const A = G.HR, [top, side] = heartExtent(G.cfg), bot = 1.12;
    tR = Math.min(A.w / (2 * side + 0.25), A.h / (top + bot + 0.12));
    tx = A.x + A.w / 2; ty = A.y + (A.h - (top + bot) * tR) / 2 + top * tR;
  }
  G.heart.x += (tx - G.heart.x) * k; G.heart.y += (ty - G.heart.y) * k; G.heart.R += (tR - G.heart.R) * k;
  G.snap = false;
}

function update(dt: number) {
  G.stageT += dt; G.flash = Math.max(0, G.flash - dt * 3);
  if (G.photoFly) { G.photoFly.t += dt; if (G.photoFly.t > 0.9) G.photoFly = null; }
  updateReact(dt); updateCare(dt); updateWand(dt);
  G.uiA += ((G.finale ? 0 : 1) - G.uiA) * Math.min(1, dt * 6);
  updateScroll(dt); layout(); placeHeart(dt);
  updateHeart(dt); updateWorld(dt); updateFinale(dt); updateParticles(dt);
  updMusic(!!G.finale && G.started);
}

function draw() {
  drawBg();
  // окружение не залезает на панели: рисуем только в области сердца
  ctx.save(); ctx.beginPath(); ctx.rect(G.HR.x, G.HR.y, G.HR.w, G.HR.h); ctx.clip();
  drawEnvBack();
  drawCareBack();
  ctx.restore();
  drawRing(true);
  drawBigHeart();
  drawCareFront();
  ctx.save(); ctx.beginPath(); ctx.rect(G.HR.x, G.HR.y, G.HR.w, G.HR.h); ctx.clip();
  drawEnvFront(!G.finale);
  ctx.restore();
  drawRing(false);
  drawCareOverlay();
  drawParticles();
  drawUI();
  drawPhotoFly();
  if (G.finale && G.finale.t > 1.2) {
    const a = Math.min(1, (G.finale.t - 1.2) * 3);
    ctx.save(); ctx.globalAlpha = a;
    drawButton(UI.again, '#ffa53d', iconAgain, false);
    drawButton(UI.cont, '#ff7aa8', iconBrush, true);
    drawButton(UI.camera, '#5ab4ff', iconCamera, false);
    ctx.restore();
  }
  if (G.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${G.flash * 0.85})`; ctx.fillRect(0, 0, W, H); }
  drawButton(UI.sound, 'rgba(120,40,80,0.25)', r => iconSound(r, soundOn), false);
}

let last = performance.now(), paused = false;
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!paused && !(window as any).__game?.paused) { advance(dt); update(dt); }
  draw();
  if (pointer.moved) { pointer.moved = false; cv.style.cursor = hitAt(pointer.x, pointer.y) ? 'pointer' : 'default'; }
  requestAnimationFrame(frame);
}

// ---------------- ВВОД ----------------
function inHeart(x: number, y: number) {
  const { x: hx, y: hy, R } = G.heart, dx = (x - hx) / (R * 1.05), dy = (y - hy + 0.1 * R) / R;
  return dx * dx + dy * dy < 1;
}
/** Что под точкой: интерфейс → то, что перед сердцем → сердце → позади → фон */
export function hitAt(x: number, y: number): any {
  const u = hitUI(x, y); if (u) return u;
  const cr = hitCare(x, y); if (cr) return cr;
  const f = hitWorld(x, y, true); if (f) return f;
  if (inHeart(x, y)) return { k: 'heart' };
  // корона, ушки, хвостики торчат за контур сердца — тоже ловят тап
  if (!G.finale) { const { x: hx, y: hy, R } = G.heart; if (partAt(G.cfg, (x - hx) / R, (y - hy) / R)) return { k: 'heart' }; }
  return hitWorld(x, y, false);
}
/** Мгновенное действие по точке (тап по миру, кнопкам). Варианты и этапы выбираются на отпускании — см. ввод ниже. */
export function act(h: any, x: number, y: number) {
  if (!h) { // пустое место: сердечки и нотка
    burst(x, y, 'heart', 5, { up: -60, speed: 110 }); sfx.chime(pick(PENTA)); hs.swingV += 1; return;
  }
  switch (h.k) {
    case 'sound': toggleSound(); UI.sound.press = 1; break;
    case 'party': party(); break;
    case 'wand': wand(); break;
    case 'camera': UI.camera.press = 1; takePhoto(UI.camera.x, UI.camera.y); break;
    case 'care': tapCare(h, x, y); break;
    case 'stage': goStage(h.i); break;
    case 'item': choose(h.it); break;
    case 'again': UI.again.press = 1; restart(); break;
    case 'cont': UI.cont.press = 1; cont(); break;
    case 'panel': case 'bar': burst(x, y, 'spark', 4, { speed: 80 }); sfx.boop(); break;
    case 'heart': tapHeart(x, y); break;
    default: tapWorld(h, x, y);
  }
}

// Ленты (этапы, варианты) можно тянуть вбок; выбор срабатывает на отпускании, если палец почти не двигался.
let drag: null | { h: any; s: any; sx: number; so: number; moved: boolean; lx: number; lt: number } = null;
function down(x: number, y: number) {
  const h = hitAt(x, y);
  if (h && h.s) { drag = { h, s: h.s, sx: x, so: h.s.off, moved: false, lx: x, lt: performance.now() }; h.s.held = true; h.s.vel = 0; if (h.k === 'bar') moveDrag(x); return; }
  act(h, x, y);
}
function moveDrag(x: number) {
  const d = drag!, s = d.s, dx = x - d.sx;
  if (!d.moved && Math.abs(dx) > 10) d.moved = true;
  if (d.h.k === 'bar') { // бегунок скроллбара: позиция пальца на дорожке = позиция в ленте
    const b = s.bar; s.off = Math.max(0, Math.min(maxOff(s), (x - b.x) / b.w * s.cw - s.w / 2)); d.moved = true; return;
  }
  if (d.moved) {
    let o = d.so - dx; const mx = maxOff(s);
    if (o < 0) o *= 0.35; else if (o > mx) o = mx + (o - mx) * 0.35; // «резинка» у краёв
    s.off = o;
    const now = performance.now(), dt = Math.max(1, now - d.lt);
    s.vel = s.vel * 0.6 + (-(x - d.lx) / dt * 1000) * 0.4; d.lx = x; d.lt = now;
  }
}
function up(x: number, y: number) {
  if (!drag) return;
  const d = drag; drag = null; d.s.held = false;
  if (d.moved) { if (d.h.k === 'bar') d.s.vel = 0; return; }
  d.s.vel = 0;
  if (d.h.k === 'item') choose(d.h.it);
  else if (d.h.k === 'stage') goStage(d.h.i);
  else act(d.h, x, y);
}
/** Для тестов и программного тапа: нажать и отпустить в одной точке */
export function tapAt(x: number, y: number) { down(x, y); up(x, y); }
/** Для тестов: потянуть ленту из точки (x,y) на dx */
export function swipe(x: number, y: number, dx: number) { down(x, y); for (let i = 1; i <= 5; i++) moveDrag(x + dx * i / 5); up(x + dx, y); }

cv.addEventListener('pointerdown', e => {
  if (!G.started) return;
  initAudio();
  pointer.x = e.clientX; pointer.y = e.clientY;
  down(e.clientX, e.clientY);
  if (drag) try { cv.setPointerCapture(e.pointerId); } catch (_) {}
});
cv.addEventListener('pointerup', e => up(e.clientX, e.clientY));
cv.addEventListener('pointercancel', e => { if (drag) { drag.moved = true; up(e.clientX, e.clientY); } });
// тачпад/колёсико: двумя пальцами вбок (или вверх-вниз) листает ленту под курсором
cv.addEventListener('wheel', e => {
  e.preventDefault();
  const h = hitUI(e.clientX, e.clientY), s = h && h.s; if (!s) return;
  s.off = Math.max(0, Math.min(maxOff(s), s.off + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY))); s.vel = 0;
}, { passive: false });
cv.addEventListener('pointermove', e => {
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.moved = true;
  if (drag) moveDrag(e.clientX);
  if (G.started && performance.now() - pointer.lastSpark > 35) {
    pointer.lastSpark = performance.now();
    addP({ kind: Math.random() < 0.3 ? 'heart' : 'spark', x: e.clientX + rand(-4, 4), y: e.clientY + rand(-4, 4), vx: rand(-20, 20) * S, vy: rand(10, 40) * S, life: rand(0.4, 0.8), size: rand(3, 6) * S, color: pick(['#fff', '#ffe27a', '#ffc4e1', '#ff8fc8']), rot: rand(0, TAU), vr: rand(-4, 4), g: 0 });
  }
});
cv.addEventListener('pointerleave', () => { pointer.x = -9999; pointer.y = -9999; });

function startGame(e?: Event) {
  if (G.started) return;
  if (e && e.cancelable) e.preventDefault();
  G.started = true;
  document.getElementById('start')!.classList.add('hide');
  initAudio();
  try { sfx.tinkle(); happy(true); } catch (_) {}
}
for (const ev of ['pointerdown', 'touchend', 'click']) document.getElementById('start')!.addEventListener(ev, startGame);

function resize() { resizeCanvas(); layout(); G.snap = true; placeHeart(0); }
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 250));
window.visualViewport?.addEventListener('resize', resize);
for (const ev of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });

load();
resize();
showSelected(); revealStage(G.stage);
requestAnimationFrame(frame);

// Ручка для автотестов (tests/heart-dress-up.spec.ts)
(window as any).__game = {
  G, UI, env, paused: false, world: { babyPos, groundY },
  step(sec: number) { for (let i = 0; i < Math.round(sec * 60); i++) { advance(1 / 60); update(1 / 60); } draw(); },
  pause(on = true) { paused = on; },
  audio() { return AC ? AC.state : 'none'; },
  start() { G.started = true; document.getElementById('start')!.classList.add('hide'); },
  api: { tapAt, swipe, hitAt, choose, party, goStage, revealItem, startFinale, restart, cont, tapHeart, layout, wand, wandCfg, takePhoto, loadPhoto },
  SETS, hasReaction, colors: Object.keys(COLORS),
};
