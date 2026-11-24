import { tone, whoosh } from '../../core/audio';
import { H, S, TAU, W, clamp, ctx, easeOutBack, pick, pointer, rand, t } from '../../core/canvas';
import { circle, drawButton } from '../../core/draw';
import { addP, burst } from '../../core/particles';
import { Baby, drawBubbleBaby, drawRocketBaby, drawSuitBaby, drawUfoBaby } from './characters';
import { sfx } from './sounds';
import { btn, planet } from './space';
import { G, MAX_BABIES, babies, babyPicker, picker } from './state';

// ---------------- ВЫБОР МАЛЫША ----------------
// Тап по ракете раскрывает веер дугой над ней: скафандр, пузырь, тарелка, ракета и «?» — случайный малыш.
// В кнопке — живой малыш-превью (моргает, следит за пальцем); тап — он выпрыгивает из кнопки в космос,
// а в кнопке появляется новый. Веер остаётся открытым, чтобы запускать подряд.

export const BPICK_COLOR = { suit: '#5b8def', bubble: '#a77bff', ufo: '#2ec4b6', rocket: '#ff9f43', surprise: '#ff7aa8' };
const ICON_K = { suit: 0.4, bubble: 0.36, ufo: 0.36, rocket: 0.34 }; // размер малыша относительно кнопки

export const randomKind = () => pick(['suit', 'suit', 'bubble', 'ufo', 'rocket']);

function freshPreview(o) { o.prev = o.k === 'surprise' ? null : new Baby(o.k, 0, 0); if (o.prev) o.prev.born = t; }

// дуга от «вверх» к «влево» вокруг ракеты (ракета — в правом нижнем углу)
export function placeBabyPicks() {
  const br = btn.launch.r, R = br * 4.8, n = babyPicker.opts.length;
  babyPicker.opts.forEach((o, i) => {
    const a = -Math.PI * (0.47 + 0.47 * i / (n - 1));
    Object.assign(o, { x: btn.launch.x + Math.cos(a) * R, y: btn.launch.y + Math.sin(a) * R, r0: br * 0.8 });
    if (!o.prev && o.k !== 'surprise') freshPreview(o);
  });
}

export function toggleBabyPicker() {
  btn.launch.press = 1;
  if (babies.length >= MAX_BABIES) { btn.launch.shake = 1; sfx.boop(); babyPicker.open = false; return; }
  babyPicker.open = !babyPicker.open; babyPicker.t = 0;
  if (babyPicker.open) { picker.open = false; sfx.pop(); tone(784, 0.2, { type: 'triangle', vol: 0.1, delay: 0.08 }); }
  else sfx.boop();
}

// выбранный малыш выпрыгивает из своей кнопки и летит в космос
export function pickBaby(o) {
  if (babies.length >= MAX_BABIES) { o.shake = 1; btn.launch.shake = 1; sfx.boop(); babyPicker.open = false; return; }
  const b = o.prev || new Baby(randomKind(), 0, 0);
  const tx = clamp(planet.x + rand(-0.6, 0.6) * planet.r, 80 * S, W - 80 * S), ty = clamp(planet.y - planet.r - rand(80, 200) * S, 80 * S, H - 80 * S);
  const dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy) || 1;
  Object.assign(b, { x: o.x, y: o.y, vx: dx / d * 380 * S, vy: dy / d * 380 * S, wx: tx, wy: ty, wTimer: 1.5, born: t, laugh: 1.2, awake: 3, face: Math.sign(dx) || 1 });
  babies.push(b);
  freshPreview(o);
  o.press = 1; babyPicker.t = 0;
  whoosh(); sfx.yay(); planet.laugh = 0.6;
  if (o.k === 'surprise') { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.1, delay: i * 0.07 })); burst(o.x, o.y, 'spark', 12, { size: 10, speed: 220, color: '#ffe27a' }); }
  for (let i = 0; i < 8; i++) addP({ kind: 'smoke', x: o.x, y: o.y, vx: rand(-80, 80) * S, vy: rand(-80, 40) * S, life: rand(0.5, 0.9), size: rand(8, 14) * S, color: '#fff', rot: 0, vr: 0, g: 0 });
  burst(o.x, o.y, 'confetti', 18, { size: 7, speed: 240, g: 260 });
  if (babies.length >= MAX_BABIES) babyPicker.open = false;
}

export function updateBabyPicker(dt) {
  if (babyPicker.open) { babyPicker.t += dt; if (babyPicker.t > 10 || G.scene !== 'space') babyPicker.open = false; }
  for (const o of babyPicker.opts) {
    const p = o.prev; if (!p) continue;
    p.blinkT -= dt; if (p.blinkT <= 0) { p.blink = 0.15; p.blinkT = rand(2, 5); }
    p.blink = Math.max(0, p.blink - dt); p.laugh = Math.max(0, p.laugh - dt);
  }
}

function babyIcon(o) {
  return R => {
    const p = o.prev;
    if (!p) { iconSurprise(R); return; }
    const r = R * ICON_K[o.k];
    const look = { x: clamp((pointer.x - o.x) / (250 * S), -1, 1), y: clamp((pointer.y - o.y) / (250 * S), -1, 1) };
    const mood = p.laugh > 0 ? 'laugh' : p.blink > 0 ? 'blink' : 'open';
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R * 0.9, 0, TAU); ctx.clip();
    ctx.translate(0, Math.sin(t * 2 + p.phase) * R * 0.04);
    if (o.k === 'suit') { ctx.translate(0, R * 0.12); drawSuitBaby(r, p, mood, look, 1.7 + Math.sin(t * 6 + p.phase) * 0.4, 0.4); }
    else if (o.k === 'bubble') drawBubbleBaby(r, p, mood, look);
    else if (o.k === 'ufo') { ctx.translate(0, R * 0.12); drawUfoBaby(r, p, mood, look); }
    else { ctx.translate(R * 0.1, R * 0.12); ctx.rotate(-0.25); drawRocketBaby(r, p, mood, look); }
    ctx.restore();
  };
}

// большой знак вопроса (рисуется линией): покачивается и подпрыгивает — внутри случайный малыш
function iconSurprise(R) {
  const j = Math.max(0, Math.sin(t * 3.2)) ** 6;
  ctx.translate(0, -j * R * 0.1); ctx.rotate(Math.sin(t * 2.2) * 0.1 + Math.sin(t * 9) * 0.1 * j);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const q = () => { ctx.beginPath(); ctx.arc(0, -R * 0.22, R * 0.24, Math.PI * 1.05, Math.PI * 2.3); ctx.quadraticCurveTo(0, -R * 0.02, 0, R * 0.14); };
  ctx.strokeStyle = 'rgba(120,30,70,0.25)'; ctx.lineWidth = R * 0.2; ctx.save(); ctx.translate(R * 0.03, R * 0.04); q(); ctx.stroke(); ctx.restore();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = R * 0.17; q(); ctx.stroke();
  ctx.fillStyle = '#fff'; circle(0, R * 0.38, R * 0.1);
  // искорки вокруг
  for (let i = 0; i < 3; i++) { const a = t * 1.5 + i * TAU / 3, s = (Math.sin(t * 5 + i * 2) + 1) * 0.5; circle(Math.cos(a) * R * 0.66, Math.sin(a) * R * 0.6, R * 0.05 * s + R * 0.01); }
}

export function drawBabyPicker() {
  if (!babyPicker.open) return;
  babyPicker.opts.forEach((o, i) => {
    o.r = o.r0 * Math.max(0.01, easeOutBack(clamp(babyPicker.t * 4 - i * 0.12, 0.01, 1))); // раскрываются по очереди
    drawButton(o, BPICK_COLOR[o.k], babyIcon(o), false);
  });
}
