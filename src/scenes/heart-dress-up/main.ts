// «Сердечко-модница»: украшаем сердце с глазками по этапам, в конце — праздник.
import { AC, initAudio, soundOn, toggleSound } from '../../core/audio';
import { H, S, TAU, W, advance, clamp, ctx, cv, pick, pointer, rand, resizeCanvas, t } from '../../core/canvas';
import { drawButton } from '../../core/draw';
import { addP, burst, drawParticles, updateParticles } from '../../core/particles';
import { Live, drawHeart } from './heart';
import { PENTA, musicBeat, sfx, updMusic } from './sounds';
import { G, Item, STAGES, defaultCfg, load, save } from './state';
import { MINI_COLORS, miniHeart } from './things';
import { UI, drawUI, hitUI, iconAgain, iconBrush, iconSound, layout } from './ui';
import { drawBg, drawEnvBack, drawEnvFront, env, hitWorld, tapWorld, updateWorld } from './world';

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
  return { x, y: y + dy, R, rot, sx: sc * (1 + sq), sy: sc * (1 - sq) };
}

function drawBigHeart() {
  const X = heartXform();
  // мягкая тень на земле
  ctx.fillStyle = 'rgba(120,40,80,0.12)'; ctx.beginPath(); ctx.ellipse(X.x, G.heart.y + 1.02 * X.R, 0.55 * X.R * (1 - (G.heart.y - X.y) / X.R * 0.5), 0.07 * X.R, 0, 0, TAU); ctx.fill();
  ctx.save(); ctx.translate(X.x, X.y + 0.95 * X.R); ctx.rotate(X.rot); ctx.scale(X.sx, X.sy); ctx.translate(0, -0.95 * X.R);
  const L: Live = { lx: hs.lx, ly: hs.ly, blink: hs.blink, mouth: hs.mouth, love: hs.love, swing: hs.swing, pop: hs.pop, live: true };
  drawHeart(G.cfg, X.R, L);
  ctx.restore();
}

function updateHeart(dt: number) {
  hs.sqT += dt; hs.jT += dt; hs.wgT += dt; hs.beatT += dt;
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

/** Тап по сердцу: 3 реакции по кругу */
export function tapHeart() {
  const r = hs.react++ % 3, { x, y, R } = G.heart;
  if (r === 0) { hs.jT = 0; hs.sqT = 0; hs.mouth = 1; hs.swingV += 4; sfx.giggle(); burst(x, y - R * 0.5, 'spark', 10, { speed: 200 }); }
  else if (r === 1) { hs.wgT = 0; hs.mouth = 0.6; hs.swingV += 6; sfx.boing(); burst(x, y, 'confetti', 14, { speed: 260, g: 300 }); }
  else { hs.love = 1.6; hs.sqT = 0; sfx.kiss(); sfx.beat(); addP({ kind: 'bigheart', x, y: y - R * 0.1, vx: 0, vy: -30 * S, life: 1, size: R * 0.5, color: 'rgba(255,90,150,0.5)', rot: 0, vr: 0, g: 0 }); burst(x, y - R * 0.3, 'heart', 10, { color: '#ff5c9a', up: -100, speed: 180 }); }
}

// ---------------- ВЫБОР ----------------
/** Где на сердце появится деталь — туда летят искорки */
const PART_AT: Record<string, [number, number]> = { color: [0, -0.1], eyes: [0, -0.12], lashes: [0, -0.3], nose: [0, 0.06], cheeks: [0, 0.1], hair: [0, -0.85], earrings: [0, -0.1], necklace: [0, 0.55] };

export function choose(it: Item & { x?: number; y?: number; press?: number }) {
  const st = STAGES[G.stage], id = st.id, c = G.cfg, { x: hx, y: hy, R } = G.heart;
  if (it.press != null) it.press = 1;
  const fromX = it.x ?? hx, fromY = it.y ?? hy;
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
    sfx.pick(idx + G.stage); sfx.magic(); happy(id === 'color'); sparkTo(hx + px * R, hy + py * R);
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
  save();
}
function wiggleOnly() { hs.wgT = 0; hs.mouth = 0.7; sfx.giggle(1.2); }

export function goStage(i: number) {
  if (i === G.stage) { sfx.boop(); return; }
  G.stage = i; G.stageT = 0; sfx.stage(i); save();
}
export function next() {
  UI.arrow.press = 1;
  if (G.stage >= STAGES.length - 1) { startFinale(); return; }
  G.stage++; G.stageT = 0; sfx.next(); hs.swingV += 2; save();
}

// ---------------- ПРАЗДНИК ----------------
export function startFinale() {
  G.finale = { t: 0, conf: 0 }; sfx.tada(); hs.jT = 0; hs.love = 1.2;
  burst(W / 2, H / 2, 'confetti', 60, { speed: 600, g: 400, size: 12 });
}
export function restart() {
  G.finale = null; G.cfg = defaultCfg(); G.stage = 0; G.stageT = 0; env.bubbles.length = 0;
  burst(G.heart.x, G.heart.y, 'smoke', 12, { color: '#ffffff', speed: 200, size: 26 }); sfx.poof(); sfx.wheee(); happy(true); save();
}
export function cont() { G.finale = null; G.stageT = 0; sfx.next(); happy(); }

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
function placeHeart(dt: number) {
  const T = UI.hrTarget, k = G.snap ? 1 : Math.min(1, dt * 5);
  for (const key of ['x', 'y', 'w', 'h'] as const) G.HR[key] += (T[key] - G.HR[key]) * k;
  let tx: number, ty: number, tR: number;
  if (G.finale) { tR = Math.min(W, H) * 0.28; tx = W / 2; ty = H * 0.46; }
  else { const A = G.HR; tR = Math.min(A.w / 2.9, A.h / 3.0); tx = A.x + A.w / 2; ty = A.y + A.h * 0.53; }
  G.heart.x += (tx - G.heart.x) * k; G.heart.y += (ty - G.heart.y) * k; G.heart.R += (tR - G.heart.R) * k;
  G.snap = false;
}

function update(dt: number) {
  G.stageT += dt;
  G.uiA += ((G.finale ? 0 : 1) - G.uiA) * Math.min(1, dt * 6);
  layout(); placeHeart(dt);
  updateHeart(dt); updateWorld(dt); updateFinale(dt); updateParticles(dt);
  updMusic(!!G.finale && G.started);
}

function draw() {
  drawBg();
  drawEnvBack();
  drawRing(true);
  drawBigHeart();
  drawEnvFront(!G.finale);
  drawRing(false);
  drawParticles();
  drawUI();
  if (G.finale && G.finale.t > 1.2) {
    const a = Math.min(1, (G.finale.t - 1.2) * 3);
    ctx.save(); ctx.globalAlpha = a;
    drawButton(UI.again, '#ffa53d', iconAgain, false);
    drawButton(UI.cont, '#ff7aa8', iconBrush, true);
    ctx.restore();
  }
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
  const f = hitWorld(x, y, true); if (f) return f;
  if (inHeart(x, y)) return { k: 'heart' };
  return hitWorld(x, y, false);
}
export function tapAt(x: number, y: number) {
  const h = hitAt(x, y);
  if (!h) { // пустое место: сердечки и нотка
    burst(x, y, 'heart', 5, { up: -60, speed: 110 }); sfx.chime(pick(PENTA)); hs.swingV += 1; return;
  }
  switch (h.k) {
    case 'sound': toggleSound(); UI.sound.press = 1; break;
    case 'arrow': next(); break;
    case 'stage': goStage(h.i); break;
    case 'item': choose(h.it); break;
    case 'again': UI.again.press = 1; restart(); break;
    case 'cont': UI.cont.press = 1; cont(); break;
    case 'panel': burst(x, y, 'spark', 4, { speed: 80 }); sfx.boop(); break;
    case 'heart': tapHeart(); break;
    default: tapWorld(h, x, y);
  }
}

cv.addEventListener('pointerdown', e => {
  if (!G.started) return;
  initAudio();
  pointer.x = e.clientX; pointer.y = e.clientY;
  tapAt(e.clientX, e.clientY);
});
cv.addEventListener('pointermove', e => {
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.moved = true;
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
requestAnimationFrame(frame);

// Ручка для автотестов (tests/heart-dress-up.spec.ts)
(window as any).__game = {
  G, UI, env, paused: false,
  step(sec: number) { for (let i = 0; i < Math.round(sec * 60); i++) { advance(1 / 60); update(1 / 60); } draw(); },
  pause(on = true) { paused = on; },
  audio() { return AC ? AC.state : 'none'; },
  start() { G.started = true; document.getElementById('start')!.classList.add('hide'); },
  api: { tapAt, hitAt, choose, next, goStage, startFinale, restart, cont, tapHeart, layout },
};
