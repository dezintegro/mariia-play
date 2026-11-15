// Уход — ванна по модели «место → нужда → предметы → развязка» (docs/research/2026-11-care/report.md, 2 и 3.2).
// Место: ванна на ножках въезжает снизу, сердце сидит в воде нижней третью; при выходе вода сливается
// водоворотом, сердце отряхивается, как щенок, ванна уезжает.
// Нужда «чистота»: 3–5 пятнышек (пыль, краска, следы лапок), если сердце давно не мылось; крошки и кремовые
// усы от еды (общий объект traces) становятся пятнышками. Чистое сердце — купание просто игра.
// Состояния сердца: сухое, мокрое (капельки и блеск), в пене. Предметы (у каждого ответ в каждом состоянии):
//   пена — 3 стадии: шапки по телу → пенная причёска → борода и усы; дальше — ещё пузырей и смех;
//   душ — мочит, наполняет ванну, смывает пену и пятна;
//   губка — ходит по пятнышкам и оттирает (на сухом — со скрипом и наполовину), взбивает пену;
//   полотенце — выключает душ и вытирает; на сухом — «ку-ку»;
//   уточка — плавает в воде, тап — брызгается (мочит сердце);
//   пузыри — поднимаются из воды, лопаются тапом;
//   слив — вода уходит водоворотом и уносит пену и пузыри; потом душ снова наполняет.
// Развязка: чисто и сухо после мокрого — сердце блестит ~90 с (B.glow), и в других разделах тоже.
// Крупные колебания — не чаще ~2–2.5 раз в секунду.
import { tone, whoosh } from '../../../core/audio';
import { S, TAU, ctx, pick, rand, t } from '../../../core/canvas';
import { circle, ell } from '../../../core/draw';
import { addP, burst } from '../../../core/particles';
import { clamp01, ease } from '../../../core/tween';
import { Live } from '../heart';
import { Xf } from '../reactions';
import { sfx } from '../sounds';
import { G, STAGES } from '../state';
import { bubble, smallHeart, sparkleStar } from '../things';
import { CareSection, Hit, INK, R, happy, hp, iconBg, near, traces } from './section';

/** Шапка пены: s — масштаб пузырьков, part — где (тело, причёска, борода) */
type Clump = { fx: number; fy: number; r: number; t: number; sub: [number, number, number][]; wash?: number; s?: number; part?: string };
type Bub = { x: number; y: number; r: number; vy: number; ph: number; t: number };
/** Пятнышко на сердце: dirt 1 → 0 по мере отмывания, wig — время с начала «подмигивания» */
type Spot = { fx: number; fy: number; kind: string; dirt: number; rot: number; col: string; wig: number };

/** Через сколько секунд без мытья сердце снова «испачкалось» (при входе в ванну появятся пятнышки) */
const DIRTY = 150;
/** Сколько блестит чистое сердце */
const GLOW = 90;
/** Отряхивание и слив, с */
const SHAKE = 1.1, DRAIN = 1.3;

const B = {
  /** ванна на месте 0..1 (въезжает/уезжает) */
  tub: 0,
  /** раздел открыт и ванна нужна (после exit — false, ванна сливает воду и уезжает) */
  on: false, inited: false,
  /** вода в ванне 0..1 */
  level: 0,
  drain: null as null | { t: number; from: number; exit: boolean },
  /** время с начала отряхивания (≥ SHAKE — не отряхивается) */
  shake: 9,
  /** пена на воде 0..1 */
  suds: 0,
  ripples: [] as { x: number; y: number; t: number }[],
  tubWob: 9,
  /** уточка уезжает вместе с ванной */
  tubDuck: false,
  // нужда
  /** пятнышки — в общих следах (traces.spots), тот же массив */
  spots: traces.spots as Spot[],
  /** секунд с последнего мытья */
  since: DIRTY,
  hintT: 0, hint: -1, hintI: 0,
  // пена: foamN — стадия 0..3
  foamOn: false, foamN: 0, foam: [] as Clump[],
  shower: 0, drops: [] as { x: number; y: number; vy: number; stop: number }[], dropT: 0, splashT: 0, washT: 0,
  /** сердце мокрое (сек. до высыхания) */
  wet: 0,
  duck: null as null | { t: number; jump: number; ph: number },
  bubbles: [] as Bub[],
  /** губка: tg — пятнышки, которые она обходит; dry — на сухом сердце */
  sponge: null as null | { t: number; e: number; dry: boolean; tg: Spot[] },
  /** полотенце: dry — на сухом сердце игра «ку-ку» */
  towel: null as null | { t: number; dry: boolean; kuku?: boolean },
  /** короткий праздничный блеск после вытирания */
  shine: 0,
  /** долгий блеск чистоты (развязка), переживает смену раздела — хранится в traces.glow */
  get glow() { return traces.glow; }, set glow(v: number) { traces.glow = v; },
  /** контур ванны (для автотестов: не налезает на кнопки и не выходит за область сердца) */
  outline: [] as [number, number][],
};
// для автотестов: общие следы ухода
(window as any).__traces = traces;

const snd = {
  rub() { for (let i = 0; i < 4; i++) tone(rand(1300, 1900), 0.07, { type: 'triangle', slide: rand(900, 2200), vol: 0.04, delay: i * 0.09 }); },
  drip() { tone(rand(1200, 1700), 0.06, { slide: rand(500, 800), vol: 0.04 }); },
  foam() { for (let i = 0; i < 6; i++) tone(rand(500, 1100), 0.08, { slide: rand(900, 1600), vol: 0.06, delay: i * 0.06 }); },
  click() { tone(1500, 0.03, { type: 'square', vol: 0.04 }); tone(880, 0.3, { vol: 0.06, delay: 0.05 }); },
  /** сухая губка скрипит */
  squeakDry() { for (let i = 0; i < 3; i++) tone(rand(1700, 2300), 0.06, { type: 'square', slide: rand(1200, 2600), vol: 0.025, delay: i * 0.08 }); },
  /** вода уходит в слив */
  gurgle(vol = 0.1) { for (let i = 0; i < 7; i++) tone(rand(260, 420) - i * 20, 0.09, { slide: rand(500, 800), vol: vol * (1 - i * 0.1), delay: i * 0.13 }); whoosh(0.9, vol * 0.5); },
  /** «ку-ку!» */
  kuku() { tone(784, 0.18, { type: 'triangle', vol: 0.12 }); tone(622, 0.3, { type: 'triangle', vol: 0.12, delay: 0.22 }); },
  /** сердце заметило пятнышко: «хм?» */
  hm() { tone(392, 0.16, { type: 'triangle', slide: 470, vol: 0.05 }); },
  /** звон эмалированной ванны */
  ding() { tone(1320, 0.5, { vol: 0.06 }); tone(1980, 0.35, { type: 'triangle', vol: 0.025 }); },
  /** «брррр» — отряхивается */
  brr() { for (let i = 0; i < 8; i++) tone(rand(150, 210), 0.06, { type: 'triangle', vol: 0.06, delay: i * 0.07 }); whoosh(0.6, 0.06); },
};

const inBath = () => STAGES[G.stage]?.id === 'bath';
const isDry = () => B.wet <= 0 && !B.foam.length && B.shower <= 0;

// ---------------- ВАННА: ГЕОМЕТРИЯ ----------------
type Geo = { hx: number; rimY: number; botY: number; rw: number; bw: number; ry: number; legH: number; Rr: number; waterY: number; wrx: number };
/** Ванна вокруг сердца: верх — эллипс на 0.3R ниже центра (нижняя треть в воде), ножки над нижним краем области сердца;
 *  сужается, чтобы не залезать на кнопки палочки и хлопушки и за край области */
function geo(): Geo {
  const Rr = R(), hx = G.heart.x + (B.tubWob < 0.6 ? Math.sin(B.tubWob * TAU * 2.2) * (0.6 - B.tubWob) * 0.03 * Rr : 0), hy = G.heart.y, A = G.HR, z = G.zones;
  const legH = 0.1 * Rr, ry = 0.13 * Rr;
  const rimY = hy + 0.3 * Rr;
  const botY = Math.max(rimY + 0.45 * Rr, Math.min(hy + 1.04 * Rr, A.y + A.h - legH - 6));
  let rw = Math.min(1.12 * Rr, G.heart.x - A.x - 10 - 0.05 * Rr, A.x + A.w - G.heart.x - 10 - 0.05 * Rr), bw = 0.8 * Rr;
  // кнопки внизу области сердца: на их высоте ванна должна быть уже них
  const room = Math.min(z.wand ? G.heart.x - (z.wand.x + z.wand.r) - 14 : 1e9, z.party ? z.party.x - z.party.r - G.heart.x - 14 : 1e9);
  const btnTop = Math.min(z.wand ? z.wand.y - z.wand.r : 1e9, z.party ? z.party.y - z.party.r : 1e9) - 6;
  if (btnTop < botY + legH) bw = Math.min(bw, room);
  if (btnTop < rimY + ry + 0.25 * Rr) rw = Math.min(rw, Math.max(room, bw));
  bw = Math.max(0.35 * Rr, Math.min(bw, rw * 0.85)); rw = Math.max(rw, bw);
  // въезжает снизу
  const off = (1 - ease.out(clamp01(B.tub))) * (A.y + A.h - rimY + 0.3 * Rr);
  const depth = botY - rimY - 0.12 * Rr, L = B.level;
  return { hx, rimY: rimY + off, botY: botY + off, rw, bw, ry, legH, Rr, waterY: rimY + off + 0.02 * Rr + (1 - L) * (0.3 * Rr + Math.max(0, depth - 0.3 * Rr) * (1 - L)), wrx: rw * 0.94 - (1 - L) * (rw - bw) * 0.85 };
}
/** Передняя стенка ванны */
function wallPath(g: Geo) {
  const { hx, rimY, botY, rw, bw, ry } = g;
  ctx.beginPath();
  ctx.ellipse(hx, rimY, rw, ry, 0, Math.PI, 0, true);
  ctx.bezierCurveTo(hx + rw, rimY + (botY - rimY) * 0.65, hx + bw * 1.05, botY, hx + bw * 0.55, botY);
  ctx.lineTo(hx - bw * 0.55, botY);
  ctx.bezierCurveTo(hx - bw * 1.05, botY, hx - rw, rimY + (botY - rimY) * 0.65, hx - rw, rimY);
  ctx.closePath();
}
/** Контур ванны с ножками точками (верх бортика, бока, низ, ножки) */
function outline(g: Geo): [number, number][] {
  const { hx, rimY, botY, rw, bw, ry, legH, Rr } = g, pts: [number, number][] = [];
  for (let i = 0; i <= 8; i++) { const a = Math.PI + i / 8 * Math.PI; pts.push([hx + Math.cos(a) * (rw + 0.03 * Rr), rimY + Math.sin(a) * (ry + 0.03 * Rr)]); }
  const bz = (p0: number, p1: number, p2: number, p3: number, u: number) => (1 - u) ** 3 * p0 + 3 * (1 - u) ** 2 * u * p1 + 3 * (1 - u) * u * u * p2 + u ** 3 * p3;
  for (let i = 0; i <= 8; i++) { const u = i / 8; pts.push([bz(hx + rw, hx + rw, hx + bw * 1.05, hx + bw * 0.55, u), bz(rimY, rimY + (botY - rimY) * 0.65, botY, botY, u)]); }
  for (let i = 0; i <= 8; i++) { const u = i / 8; pts.push([bz(hx - bw * 0.55, hx - bw * 1.05, hx - rw, hx - rw, u), bz(botY, botY, rimY + (botY - rimY) * 0.65, rimY, u)]); }
  for (const d of [-1, 1]) pts.push([hx + d * (bw * 0.62 + 0.14 * Rr), botY + legH * 0.8], [hx + d * bw * 0.62, botY + legH]);
  return pts;
}
/** Где на поверхности воды точка с долей u (−1..1 по ширине) — передний край эллипса воды */
const surf = (g: Geo, u: number): [number, number] => [g.hx + u * g.wrx, g.waterY + Math.sqrt(Math.max(0, 1 - u * u)) * g.ry * 0.7];
/** Воронка слива — слева от сердца (справа плавает уточка) */
const vortexX = (g: Geo) => g.hx - g.wrx * 0.6;

// ---------------- ПРЕДМЕТЫ: ГДЕ ----------------
const duckS = () => Math.max(34, R() * 0.28);
function duckPos(g = geo()): [number, number] {
  const d = B.duck, u = 0.62 + 0.14 * Math.sin((d ? d.t : 0) * 0.45 + (d ? d.ph : 0));
  let [x, y] = surf(g, u);
  y = Math.min(y, g.rimY + g.ry * 0.85) + Math.sin(t * 1.6) * 0.012 * g.Rr; // в пустой ванне сидит, выглядывая из-за борта
  if (B.drain && d) x += Math.sin(B.drain.t * 5) * g.Rr * 0.04; // кружится в водовороте
  if (d && d.jump < 0.5) y -= Math.sin(d.jump / 0.5 * Math.PI) * duckS() * 0.8;
  return [x, y];
}
const showerS = () => Math.max(26, R() * 0.22);
const showerPos = (): [number, number] => [G.heart.x + 0.05 * R(), Math.max(G.HR.y + showerS() * 0.9, G.heart.y - 1.32 * R())];
const spongeS = () => Math.max(30, R() * 0.24);
/** Губка: обходит пятнышки (на каждое 0.25 с подъехать + 0.65 с потереть), без пятен — трёт по кругу */
const SP_MOVE = 0.25, SP_RUB = 0.65, SP_ONE = SP_MOVE + SP_RUB;
const spongeDur = () => B.sponge && B.sponge.tg.length ? B.sponge.tg.length * SP_ONE + 0.15 : 1.8;
function spongeAt(): { p: [number, number]; rub: Spot | null } {
  const Sp = B.sponge; if (!Sp) return { p: hp(0, 0), rub: null };
  if (!Sp.tg.length) { const p = Sp.t, a = p * 9; return { p: hp(Math.cos(a) * 0.38 + Math.sin(p * 2) * 0.15, -0.35 + Math.sin(a) * 0.22 + p * 0.2), rub: null }; }
  const j = Math.min(Sp.tg.length - 1, Math.floor(Sp.t / SP_ONE)), u = Sp.t - j * SP_ONE, s = Sp.tg[j];
  const prev = j > 0 ? Sp.tg[j - 1] : { fx: 0.85, fy: -0.85 };
  if (u < SP_MOVE) { const k = ease.inOut(u / SP_MOVE); return { p: hp(prev.fx + (s.fx - prev.fx) * k, prev.fy + (s.fy - prev.fy) * k), rub: null }; }
  const a = (u - SP_MOVE) * TAU * 2; // 2 круга в секунду
  return { p: hp(s.fx + Math.cos(a) * 0.07, s.fy + Math.sin(a) * 0.05), rub: u < SP_ONE ? s : null };
}
function towelPos(): [number, number] {
  const Tw = B.towel; if (!Tw) return hp(0, 0);
  if (Tw.dry) { // «ку-ку»: опускается на лицо, держится, улетает вверх
    const u = Tw.t;
    if (u < 0.35) return hp(0, -1.5 + 1.35 * ease.out(u / 0.35));
    if (u < 1.0) return hp(Math.sin((u - 0.35) * TAU * 1.5) * 0.03, -0.15);
    const k = ease.in(clamp01((u - 1.0) / 0.35)); return hp(-1.2 * k, -0.15 - 1.4 * k);
  }
  const p = Tw.t / 1.6; return hp(Math.sin(p * 14) * 0.55, -0.8 + p * 1.4);
}

// ---------------- РИСОВАЛКИ ----------------
/** Резиновая уточка: (x, y) — низ, s — размер (высота ≈ 1.25s) */
function rubberDuck(x: number, y: number, s: number, sq = 0, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1 + sq * 0.15, 1 - sq * 0.15); ctx.lineJoin = 'round';
  ctx.fillStyle = '#ffd93b'; ctx.strokeStyle = '#e0a800'; ctx.lineWidth = 0.05 * s;
  ctx.beginPath(); ctx.moveTo(-0.55 * s, -0.4 * s); ctx.quadraticCurveTo(-0.8 * s, -0.75 * s, -0.68 * s, -0.8 * s); ctx.quadraticCurveTo(-0.45 * s, -0.62 * s, -0.3 * s, -0.6 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  ell(0, -0.32 * s, 0.66 * s, 0.32 * s); ctx.stroke();
  circle(0.22 * s, -0.86 * s, 0.33 * s); ctx.stroke();
  ctx.fillStyle = '#ffc61a'; ell(-0.12 * s, -0.36 * s, 0.3 * s, 0.15 * s, -0.25);
  ctx.fillStyle = '#ff8a1f'; ctx.strokeStyle = '#d0620a'; ctx.lineWidth = 0.03 * s; ell(0.6 * s, -0.8 * s, 0.2 * s, 0.08 * s); ctx.stroke(); ell(0.56 * s, -0.72 * s, 0.15 * s, 0.05 * s); ctx.stroke();
  ctx.fillStyle = INK; ell(0.3 * s, -0.95 * s, 0.06 * s, 0.075 * s); ctx.fillStyle = '#fff'; circle(0.32 * s, -0.98 * s, 0.025 * s);
  ctx.fillStyle = 'rgba(255,110,140,0.45)'; ell(0.2 * s, -0.76 * s, 0.08 * s, 0.05 * s);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ell(-0.3 * s, -0.48 * s, 0.14 * s, 0.05 * s, -0.3); ell(0.08 * s, -1.06 * s, 0.08 * s, 0.04 * s, -0.4);
  ctx.restore();
}
/** Губка с дырочками */
function sponge(x: number, y: number, s: number, rot: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = '#5fcf6a'; ctx.beginPath(); ctx.roundRect(-0.8 * s, -0.55 * s, 1.6 * s, 0.3 * s, 0.12 * s); ctx.fill();
  ctx.fillStyle = '#ffd84a'; ctx.strokeStyle = '#d9a400'; ctx.lineWidth = 0.05 * s; ctx.beginPath(); ctx.roundRect(-0.8 * s, -0.35 * s, 1.6 * s, 0.85 * s, 0.18 * s); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e6b520'; for (const [px, py, r] of [[-0.45, -0.05, 0.09], [0.1, 0.05, 0.12], [0.5, -0.1, 0.08], [-0.15, 0.3, 0.07], [0.42, 0.28, 0.1], [-0.55, 0.3, 0.06]]) ell(px * s, py * s, r * s, r * 0.8 * s);
  ctx.restore();
}
/** Полотенце: прямоугольник с полосками и бахромой */
function towel(x: number, y: number, s: number, rot: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = '#ff9ec7'; ctx.strokeStyle = '#e0669e'; ctx.lineWidth = 0.04 * s; ctx.beginPath(); ctx.roundRect(-0.9 * s, -0.55 * s, 1.8 * s, 1.1 * s, 0.1 * s); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.fillRect(-0.9 * s, 0.2 * s, 1.8 * s, 0.1 * s); ctx.fillRect(-0.9 * s, -0.3 * s, 1.8 * s, 0.1 * s);
  smallHeart(0, -0.02 * s, 0.13 * s, '#fff');
  ctx.strokeStyle = '#ff9ec7'; ctx.lineWidth = 0.05 * s; ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) { const fx = -0.8 * s + i * 0.2 * s; ctx.beginPath(); ctx.moveTo(fx, 0.55 * s); ctx.lineTo(fx, 0.7 * s); ctx.stroke(); }
  ctx.restore();
}
/** Лейка душа на трубе сверху */
function showerHead(x: number, y: number, s: number, on: boolean, top = G.HR.y - 10) {
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = '#a9b8c8'; ctx.lineWidth = 0.22 * s; ctx.beginPath(); ctx.moveTo(x + 1.2 * s, top); ctx.lineTo(x + 1.2 * s, y - 0.6 * s); ctx.quadraticCurveTo(x + 1.2 * s, y - 0.9 * s, x + 0.6 * s, y - 0.75 * s); ctx.stroke();
  ctx.strokeStyle = '#dfe8f0'; ctx.lineWidth = 0.08 * s; ctx.beginPath(); ctx.moveTo(x + 1.15 * s, top); ctx.lineTo(x + 1.15 * s, y - 0.65 * s); ctx.stroke();
  ctx.translate(x, y); ctx.rotate(0.15);
  const g = ctx.createLinearGradient(-s, -0.6 * s, s, 0.3 * s); g.addColorStop(0, '#f2f7fb'); g.addColorStop(1, '#9fb0c2');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-0.25 * s, -0.75 * s); ctx.lineTo(0.25 * s, -0.75 * s); ctx.lineTo(0.85 * s, 0.05 * s); ctx.lineTo(-0.85 * s, 0.05 * s); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#7d8fa3'; ell(0, 0.05 * s, 0.85 * s, 0.18 * s);
  ctx.fillStyle = on ? '#bfe8ff' : '#55667a'; for (let i = -3; i <= 3; i++) circle(i * 0.22 * s, 0.06 * s, 0.045 * s);
  ctx.restore();
}
/** Пенная шапка: кучка пузырьков */
function clump(x: number, y: number, c: Clump, Rr: number, k: number) {
  const sc = c.s || 1;
  for (const [dx, dy, rr] of c.sub) {
    const r = rr * Rr * k * sc, px = x + dx * Rr * sc, py = y + dy * Rr * sc + Math.sin(t * 2 + dx * 9) * 0.006 * Rr;
    ctx.fillStyle = '#ffffff'; circle(px, py, r);
    ctx.strokeStyle = 'rgba(150,200,240,0.8)'; ctx.lineWidth = Math.max(1, r * 0.08); ctx.beginPath(); ctx.arc(px, py, r, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
    ctx.fillStyle = 'rgba(200,230,255,0.7)'; ell(px + r * 0.15, py + r * 0.35, r * 0.5, r * 0.25);
    ctx.fillStyle = '#fff'; circle(px - r * 0.35, py - r * 0.35, r * 0.18);
  }
}
/** Капля: (x, y) — низ */
function drop(x: number, y: number, s: number) {
  ctx.fillStyle = '#7cc8ff'; ctx.beginPath(); ctx.moveTo(x, y - s * 1.6); ctx.quadraticCurveTo(x + s, y - s * 0.2, x, y + s * 0.6); ctx.quadraticCurveTo(x - s, y - s * 0.2, x, y - s * 1.6); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; circle(x - s * 0.25, y - s * 0.1, s * 0.18);
}
/** Пятнышко: (x, y) — центр, s — размер */
function spotArt(sp: Spot, x: number, y: number, s: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(sp.rot);
  ctx.globalAlpha *= Math.pow(clamp01(sp.dirt), 0.6);
  if (sp.kind === 'dust') { // пыльное облачко
    ctx.fillStyle = 'rgba(125,100,85,0.5)';
    for (const [dx, dy, r] of [[-0.35, 0.05, 0.42], [0.05, -0.15, 0.5], [0.4, 0.08, 0.38], [0, 0.25, 0.36]]) circle(dx * s, dy * s, r * s);
    ctx.fillStyle = 'rgba(90,70,60,0.55)'; for (const [dx, dy] of [[-0.4, -0.1], [0.2, 0.2], [0.45, -0.2], [-0.1, 0.35], [0.05, -0.4]]) circle(dx * s, dy * s, 0.07 * s);
  } else if (sp.kind === 'paint') { // клякса краски
    ctx.fillStyle = sp.col;
    ctx.beginPath(); for (let i = 0; i <= 10; i++) { const a = i / 10 * TAU, r = s * (0.55 + 0.14 * Math.sin(i * 2.7)); i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
    for (const [dx, dy, r] of [[0.85, -0.3, 0.13], [-0.8, 0.35, 0.1], [0.3, 0.85, 0.11], [-0.5, -0.75, 0.08]]) circle(dx * s, dy * s, r * s);
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ell(-0.18 * s, -0.2 * s, 0.16 * s, 0.09 * s, -0.5);
  } else if (sp.kind === 'paw') { // следы лапок котёнка
    ctx.fillStyle = 'rgba(110,80,62,0.62)';
    for (const [ox, oy, sc] of [[-0.35, 0.3, 0.7], [0.35, -0.3, 0.7]]) {
      ell(ox * s, oy * s + 0.12 * s * sc, 0.26 * s * sc, 0.21 * s * sc);
      for (const [dx, dy] of [[-0.28, -0.2], [-0.1, -0.33], [0.1, -0.33], [0.28, -0.2]]) circle(ox * s + dx * s * sc, oy * s + dy * s * sc, 0.09 * s * sc);
    }
  } else if (sp.kind === 'crumb') { // крошки
    for (const [dx, dy, r] of [[-0.4, -0.1, 0.16], [0.1, -0.3, 0.13], [0.35, 0.15, 0.17], [-0.1, 0.3, 0.12], [0.5, -0.35, 0.09], [-0.5, 0.35, 0.1]]) {
      ctx.fillStyle = '#d99a52'; ctx.strokeStyle = '#9c6428'; ctx.lineWidth = Math.max(1, 0.04 * s);
      ctx.beginPath(); ctx.rect((dx - r) * s, (dy - r) * s, 2 * r * s, 1.6 * r * s); ctx.fill(); ctx.stroke();
    }
  } else { // cream — кремовые усы
    ctx.fillStyle = '#fff4f8'; ctx.strokeStyle = 'rgba(240,140,180,0.9)'; ctx.lineWidth = Math.max(1, 0.06 * s);
    for (const d of [-1, 1]) { ctx.beginPath(); ctx.ellipse(d * 0.42 * s, 0, 0.5 * s, 0.24 * s, d * 0.25, 0, TAU); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = '#ffc4dd'; circle(-0.5 * s, -0.05 * s, 0.07 * s); circle(0.45 * s, 0.04 * s, 0.06 * s);
  }
  ctx.restore();
}

// ---------------- НУЖДА: ПЯТНЫШКИ ----------------
const SPOT_AT: [number, number][] = [[-0.62, -0.45], [0.6, -0.48], [-0.72, 0.04], [0.7, 0.06], [-0.28, -0.7], [0.3, -0.7], [-0.42, 0.24], [0.44, 0.24]];
const PAINT = ['#5ab4ff', '#7bd96a', '#ffb13b', '#b57cff', '#ff6fa5'];
const mkSpot = (fx: number, fy: number, kind: string): Spot => ({ fx, fy: Math.min(0.26, fy), kind, dirt: 1, rot: rand(-0.6, 0.6), col: pick(PAINT), wig: 9 });
/** Пришли в ванну: следы еды становятся пятнышками; если давно не мылись — пыль, краска, лапки; чистое сердце — без пятен */
function makeSpots() {
  if (B.spots.length) return;
  const tr = traces as any, cr = tr.crumbs, nCr = Array.isArray(cr) ? cr.length : +cr || 0, cream = Array.isArray(tr.cream) ? tr.cream.length : +tr.cream || 0;
  if (nCr > 0 || cream > 0) {
    if (cream > 0) B.spots.push(mkSpot(0, 0.16, 'cream'));
    const pts: { fx?: number; fy?: number }[] = Array.isArray(cr) ? cr : [];
    for (let i = 0; i < Math.min(3, nCr); i++) {
      const p = pts[i] || {}, side = i % 2 ? 1 : -1;
      B.spots.push(mkSpot(p.fx ?? side * (0.32 + 0.12 * i), p.fy ?? 0.22 + rand(-0.05, 0.03), 'crumb'));
    }
    // следы забрали — теперь это наши пятнышки (еда их больше не рисует)
    if (Array.isArray(cr)) cr.length = 0; else tr.crumbs = typeof cr === 'number' ? 0 : [];
    if (Array.isArray(tr.cream)) tr.cream.length = 0; else tr.cream = typeof tr.cream === 'boolean' ? false : 0;
    return;
  }
  if (B.since < DIRTY) return;
  const at = [...SPOT_AT].sort(() => Math.random() - 0.5), n = 3 + (Math.random() * 3 | 0), kinds = ['dust', 'paint', 'paw'];
  for (let i = 0; i < n; i++) B.spots.push(mkSpot(at[i][0], at[i][1], kinds[(i + (Math.random() * 3 | 0)) % 3]));
}
/** Оттереть пятнышко на k; отмылось — искорки и звон */
function scrub(s: Spot, k: number) {
  if (B.spots.indexOf(s) < 0) return;
  s.dirt -= k;
  if (s.dirt > 0.02) return;
  B.spots.splice(B.spots.indexOf(s), 1);
  const [x, y] = hp(s.fx, s.fy);
  burst(x, y, 'spark', 8, { color: pick(['#ffffff', '#bfe8ff', '#fff6a8']), speed: 180, size: 9 }); sfx.tinkle();
  if (!B.spots.length) { B.since = 0; happy(true); sfx.magic(); burst(G.heart.x, G.heart.y - R() * 0.3, 'heart', 6, { up: -80, speed: 150 }); }
}

// ---------------- ПЕНА ----------------
const FOAM_AT: [number, number][] = [[-0.6, -0.82], [-0.28, -0.74], [0.3, -0.76], [0.62, -0.82], [0.88, -0.48], [-0.88, -0.45], [0, -0.52], [-0.95, -0.05], [0.95, -0.08], [-0.7, 0.2], [0.7, 0.2]];
/** Пенная причёска: горка на макушке (h — во сколько R ещё влезает над сердцем) */
const HAIR_AT: [number, number, number][] = [[-0.55, -0.95, 1.1], [-0.2, -0.98, 1.2], [0.2, -0.98, 1.2], [0.55, -0.95, 1.1], [-0.35, -1.15, 1.15], [0.05, -1.2, 1.25], [0.38, -1.13, 1.1], [-0.12, -1.38, 1.05], [0.2, -1.36, 1], [0.04, -1.55, 0.9]];
/** Борода и усы */
const BEARD_AT: [number, number, number][] = [[-0.2, 0.15, 0.6], [0.2, 0.15, 0.6], [-0.3, 0.33, 0.85], [-0.1, 0.36, 0.9], [0.1, 0.36, 0.9], [0.3, 0.33, 0.85], [-0.15, 0.48, 0.8], [0.15, 0.48, 0.8], [0, 0.6, 0.75]];
/** Сколько длится смывание одной шапки пены */
const WASH = 0.4;
function makeClump(fx: number, fy: number, delay = 0, s = 1, part = 'body'): Clump {
  const sub: [number, number, number][] = [], n = 4 + (Math.random() * 3 | 0);
  for (let i = 0; i < n; i++) { const a = rand(0, TAU), d = rand(0, 0.11); sub.push([Math.cos(a) * d, Math.sin(a) * d * 0.7, rand(0.06, 0.1)]); }
  return { fx, fy, r: 0.17, t: -delay, sub, s, part };
}
function foamGone() { if (!B.foam.length && B.foamOn) { B.foamOn = false; B.foamN = 0; if (B.on) { G.hs.sqT = 0; G.hs.mouth = 1; sfx.giggle(1.1); } } }
function popClump(c: Clump, loud = true) {
  const i = B.foam.indexOf(c); if (i < 0) return;
  B.foam.splice(i, 1);
  const [x, y] = hp(c.fx, c.fy);
  burst(x, y, 'smoke', 5, { color: '#ffffff', speed: 90, size: 12 });
  burst(x, y, 'spark', 4, { color: '#bfe8ff', speed: 140, size: 6 });
  if (loud) sfx.pop(rand(0.8, 1.4));
  foamGone();
}
/** Пена следующей стадии: 1 — шапки по телу и пена на воде, 2 — причёска, 3 — борода и усы, дальше — ещё пузырей */
function addFoam() {
  const hx = G.heart.x, hy = G.heart.y, Rr = R();
  const st = Math.min(3, B.foamN + 1);
  if (B.foamN >= 3) { // всё уже в пене: пузыри летят и смешно
    for (let i = 0; i < 4 && B.foam.length < 40; i++) { const [fx, fy] = pick(FOAM_AT); B.foam.push(makeClump(fx + rand(-0.1, 0.1), fy + rand(-0.1, 0.1), i * 0.05)); }
    soapBubbles(4); sfx.giggle(1.2); happy(true);
  } else if (st === 1) {
    for (const [i, [fx, fy]] of FOAM_AT.entries()) B.foam.push(makeClump(fx + rand(-0.04, 0.04), fy + rand(-0.03, 0.03), i * 0.05));
    B.suds = Math.max(B.suds, 0.6);
  } else if (st === 2) {
    // причёска выше сердца — сколько влезает до верха области
    const top = (G.heart.y - G.HR.y) / Rr - 0.08;
    for (const [i, [fx, fy, s]] of HAIR_AT.entries()) if (-fy + 0.1 * s < top || i < 4) B.foam.push(makeClump(fx, Math.max(fy, -top + 0.1), i * 0.06, s, 'hair'));
  } else {
    for (const [i, [fx, fy, s]] of BEARD_AT.entries()) B.foam.push(makeClump(fx, fy, i * 0.06, s, 'beard'));
  }
  B.foamN = st; B.foamOn = true;
  snd.foam(); happy(); burst(hx, hy - Rr * 0.7, 'spark', 10, { color: '#bfe8ff', speed: 200 });
}
function soapBubbles(n = 7) {
  const g = geo(), Rr = R();
  for (let i = 0; i < n; i++) if (B.bubbles.length < 22) {
    const [x, y] = B.tub > 0.5 ? surf(g, rand(-0.9, 0.9)) : [G.heart.x + rand(-1.1, 1.1) * Rr, G.heart.y + rand(0.3, 1.0) * Rr];
    B.bubbles.push({ x, y, r: Math.max(26, Rr * rand(0.11, 0.2)), vy: -rand(45, 80) * S, ph: rand(0, TAU), t: -i * 0.12 });
  }
}

// ---------------- ДЕЙСТВИЯ ----------------
/** Ванна на месте (пришли в раздел или нажали кнопку ванны после палочки) */
function ensureOn() {
  if (B.on) return;
  B.on = true; B.inited = true;
  if (B.tub <= 0.01) { B.level = 1; B.suds = 0; B.ripples.length = 0; }
  B.drain = null; B.shake = 9; B.tubDuck = false;
  makeSpots();
  B.hintT = B.spots.length ? 3.6 : 0; // скоро заметит пятнышко
}
/** Сердце было мокрым и стало сухим: если чистое — блестит долго */
function dried() { if (!B.spots.length && !B.foam.length) { B.glow = GLOW; B.since = 0; } }
/** Играли с уточкой — она приснится сердцу (раздел сна рисует traces.dreams) */
function dreamDuck() { if (!traces.dreams.duck) traces.dreams.duck = r => rubberDuck(-0.1 * r, 0.55 * r, 0.8 * r); }
/** Мочит сердце (душ, брызги уточки, всплеск) */
function wetHeart(sec: number) { B.wet = Math.max(B.wet, sec); }

function act(k: string) {
  ensureOn();
  if (k === 'foam') addFoam();
  else if (k === 'shower') {
    B.shower = Math.min(4, Math.max(B.shower, 0) + 2.6); B.washT = 0.3; sfx.splash(); whoosh(2.2, 0.05); happy();
  } else if (k === 'rubberduck') {
    if (B.duck) { const [dx, dy] = duckPos(); B.duck = null; sfx.poof(); burst(dx, dy - duckS() * 0.6, 'smoke', 6, { color: '#fff', speed: 120, size: 14 }); return; }
    B.duck = { t: 0, jump: 0, ph: rand(0, TAU) }; sfx.squeak(); sfx.splash(); dreamDuck();
    const g = geo(); B.ripples.push({ x: duckPos(g)[0], y: g.waterY, t: 0 });
  } else if (k === 'soapbubbles') {
    soapBubbles(); sfx.blub(); sfx.magic();
  } else if (k === 'sponge') {
    const dry = isDry();
    B.sponge = { t: 0, e: 0, dry, tg: [...B.spots].sort((a, b) => a.fy - b.fy) }; if (dry) snd.squeakDry(); else snd.rub();
  } else if (k === 'towel') {
    if (B.shower > 0) { B.shower = 0; snd.click(); } // полотенце выключает душ
    B.towel = { t: 0, dry: isDry() }; whoosh(0.5, 0.1);
  } else if (k === 'drain') {
    if (B.drain) { tone(500, 0.12, { slide: 300, vol: 0.08 }); return; }
    if (B.level < 0.05 && !B.foam.length) { // пусто — пробка выскакивает «чпок», сердце смеётся
      sfx.pop(0.7); sfx.giggle(1.15); happy(true); const g = geo(); burst(vortexX(g), g.rimY, 'spark', 6, { color: '#bfe8ff', speed: 150 }); return;
    }
    startDrain(false);
  }
}
/** Слив: вода уходит водоворотом, уносит пену с тела и с воды, пузыри лопаются, душ выключается */
function startDrain(exit: boolean) {
  B.drain = { t: 0, from: B.level, exit };
  B.shower = 0;
  for (const c of B.foam) if (c.wash == null) c.wash = -rand(0, 0.6);
  snd.gurgle(exit ? 0.05 : 0.1);
}
/** Отряхнуться, как щенок (если мокрое) */
function startShake() { if (B.wet > 0 && !G.wand && !G.finale) { B.shake = 0; snd.brr(); } }

/** Уходим из ванны: пузыри и капли лопаются, пена смывается, вода сливается, сердце отряхивается, ванна уезжает */
function exit() {
  const wasOn = B.on || B.tub > 0;
  B.on = false;
  let any = false;
  for (const b of B.bubbles) if (b.t > 0) { burst(b.x + Math.sin(b.ph) * b.r * 0.4, b.y, 'spark', 4, { color: pick(['#ffffff', '#bfe8ff', '#ffc4e1']), speed: 140 }); any = true; }
  B.bubbles.length = 0;
  B.drops.forEach((d, i) => { if (i % 3 === 0) burst(d.x, d.y, 'spark', 1, { color: '#9fdcff', speed: 80, size: 4 }); });
  B.drops.length = 0; B.shower = 0; B.sponge = null; B.towel = null; B.hint = -1;
  if (B.duck) { if (B.tub > 0.3) B.tubDuck = true; else { const [dx, dy] = duckPos(); burst(dx, dy - duckS() * 0.6, 'smoke', 5, { color: '#fff', speed: 110, size: 14 }); any = true; } B.duck = null; }
  if (G.wand || G.finale || !wasOn) { // палочка и праздник: ванна уезжает сразу, пена тает, сердце сухое
    for (const c of B.foam) { const [x, y] = hp(c.fx, c.fy); burst(x, y, 'smoke', 2, { color: '#ffffff', speed: 70, size: 10 }); any = true; }
    B.foam.length = 0; B.foamOn = false; B.foamN = 0; B.drain = null; B.shake = 9;
    if (B.wet > 0) { B.wet = 0; dried(); }
    if (any) sfx.pop(1.2);
    return;
  }
  if (B.drain) B.drain.exit = true;
  else if (B.level > 0.05 && B.tub > 0.3) startDrain(true);
  else { for (const c of B.foam) if (c.wash == null) c.wash = 0; startShake(); }
}

// ---------------- ОБНОВЛЕНИЕ ----------------
function update(dt: number) {
  const hs = G.hs, { x: hx, y: hy } = G.heart, Rr = R();
  if (!B.inited) { B.inited = true; if (inBath() && !G.finale) ensureOn(); } // открыли страницу сразу в ванне
  B.since += dt; B.glow = Math.max(0, B.glow - dt); B.tubWob += dt;
  // ванна въезжает / уезжает (после слива и отряхивания)
  if (B.on && !G.finale) B.tub = Math.min(1, B.tub + dt / 0.45);
  else if (!B.drain && B.shake >= SHAKE) { B.tub = Math.max(0, B.tub - dt / 0.4); if (B.tub <= 0) { B.tubDuck = false; B.level = 0; B.suds = 0; } }
  const g = geo();
  B.outline = B.tub > 0.99 ? outline(g) : [];
  for (const r of B.ripples) r.t += dt;
  B.ripples = B.ripples.filter(r => r.t < 0.9);
  // слив
  if (B.drain) {
    const D = B.drain; D.t += dt;
    B.level = D.from * (1 - ease.in(clamp01(D.t / DRAIN))); // сначала медленно — водоворот видно
    B.suds = Math.max(0, B.suds - dt * 1.2);
    if (B.bubbles.length && (D.t * 8 | 0) !== ((D.t - dt) * 8 | 0)) { const b = B.bubbles.shift()!; if (b.t > 0) { burst(b.x, b.y, 'spark', 4, { color: '#bfe8ff', speed: 120 }); sfx.pop(rand(1, 1.4)); } }
    if (Math.random() < dt * 10) { const vx = vortexX(g); addP({ kind: 'spark', x: vx + rand(-0.15, 0.15) * Rr, y: g.waterY, vx: 0, vy: 0, life: 0.4, size: rand(3, 5) * S, color: '#ffffff', rot: rand(0, TAU), vr: 8, g: 0 }); }
    if (D.t > DRAIN) { B.drain = null; B.level = 0; if (D.exit) startShake(); }
  }
  // отряхивается: капли летят в стороны; в конце сухое
  if (B.shake < SHAKE) {
    B.shake += dt;
    if (Math.random() < dt * 40) { const d = pick([-1, 1]); addP({ kind: 'spark', x: hx + d * rand(0.7, 1.0) * Rr, y: hy + rand(-0.6, 0.3) * Rr, vx: d * rand(150, 320) * S, vy: rand(-220, -60) * S, life: 0.5, size: rand(3, 6) * S, color: '#9fdcff', rot: 0, vr: 0, g: 700 }); }
    if (B.shake >= SHAKE) { B.wet = 0; dried(); }
  }
  for (const c of B.foam) { c.t += dt; if (c.wash != null) c.wash += dt; }
  // душ: мочит сердце, наполняет ванну, смывает пену сверху вниз и пятнышки
  if (B.shower > 0) {
    B.shower -= dt; B.dropT -= dt; B.splashT -= dt; B.washT -= dt; wetHeart(60); B.since = 0;
    if (B.tub > 0.5) B.level = Math.min(1, B.level + dt * 0.35);
    const [sx, sy] = showerPos(), s = showerS();
    while (B.dropT <= 0) {
      B.dropT += 0.02;
      const dx = rand(-0.7, 0.7);
      B.drops.push({ x: sx + dx * s * 1.1, y: sy + s * 0.1, vy: rand(350, 450) * S, stop: Math.min(B.tub > 0.5 ? g.waterY + g.ry * 0.3 : 1e9, hy + (-0.75 + Math.abs(dx) * 0.2 + rand(0, 1.3)) * Rr) });
    }
    if (B.splashT <= 0) { B.splashT = 0.55; sfx.splash(); if (B.tub > 0.5 && B.level > 0.1) B.ripples.push({ x: g.hx + rand(-0.5, 0.5) * g.wrx, y: g.waterY, t: 0 }); }
    if (B.washT <= 0) { // смывает по шапке сверху вниз: даже много пены уходит за одно включение душа
      B.washT = 0.07;
      const c = B.foam.filter(q => q.wash == null && q.t > 0).sort((a, b) => a.fy - b.fy)[0];
      if (c) c.wash = 0;
    }
    for (const sp of [...B.spots]) scrub(sp, dt * 0.6);
    hs.mouth = Math.max(hs.mouth, 0.6);
  }
  const washed = B.foam.filter(q => q.wash != null && q.wash > WASH);
  for (const c of washed) {
    B.foam.splice(B.foam.indexOf(c), 1);
    if (B.tub > 0.5 && B.level > 0.1 && !B.drain) B.suds = Math.min(1, B.suds + 0.04); // пена сползает в воду
    const [x, y] = hp(c.fx, c.fy + 0.25);
    burst(x, y, 'spark', 3, { color: '#ffffff', speed: 90, size: 6 });
    if (Math.random() < 0.5 && B.on) snd.drip();
  }
  if (washed.length) foamGone();
  // высыхает само (медленно); стало сухим — развязка
  if (B.shower <= 0 && B.wet > 0 && B.shake >= SHAKE) { B.wet -= dt; if (B.wet <= 0) { B.wet = 0; dried(); } }
  for (const d of B.drops) {
    d.y += d.vy * dt; d.x += (d.x - showerPos()[0]) * dt * 0.8;
    if (d.y > d.stop) { d.vy = -1; if (Math.random() < 0.4) addP({ kind: 'spark', x: d.x, y: d.y, vx: rand(-60, 60) * S, vy: rand(-90, -30) * S, life: 0.35, size: rand(3, 5) * S, color: '#9fdcff', rot: 0, vr: 0, g: 600 }); }
  }
  B.drops = B.drops.filter(d => d.vy > 0);
  // уточка
  if (B.duck) { B.duck.t += dt; B.duck.jump += dt; }
  // мыльные пузыри
  for (const b of B.bubbles) { b.t += dt; if (b.t > 0) { b.y += b.vy * dt; b.ph += dt * 1.6; } }
  B.bubbles = B.bubbles.filter(b => b.y > G.HR.y - b.r * 2);
  // губка: обходит пятнышки и оттирает; взбивает пену; на сухом — скрипит, оттирает наполовину и щекочет
  if (B.sponge) {
    const Sp = B.sponge; Sp.t += dt; Sp.e -= dt;
    const { p: [px, py], rub } = spongeAt();
    if (rub) scrub(rub, dt / SP_RUB * (Sp.dry ? 0.56 : 1.1));
    if (Sp.e <= 0) {
      Sp.e = 0.16;
      if (!Sp.dry) burst(px, py, 'spark', 2, { color: pick(['#ffffff', '#bfe8ff', '#fff6a8']), speed: 160, size: 9 });
      if (!Sp.dry && B.foam.length < 30 && Math.random() < 0.35) { // мыльная губка взбивает пену
        B.foam.push(makeClump((px - hx) / Rr, Math.min(0.2, (py - hy) / Rr)));
        if (!B.foamN) { B.foamN = 1; B.foamOn = true; }
      }
    }
    if ((Sp.t * 2.4 | 0) !== ((Sp.t - dt) * 2.4 | 0)) { if (Sp.dry) snd.squeakDry(); else snd.rub(); }
    if (Sp.t > spongeDur()) {
      B.sponge = null;
      if (Sp.dry) { sfx.giggle(1.25); happy(true); hs.wgT = 0; burst(hx, hy - Rr * 0.2, 'heart', 6, { up: -80, speed: 150 }); }
      else { B.shine = Math.max(B.shine, 1.5); happy(); sfx.tinkle(); B.since = 0; }
    }
  }
  // полотенце: вытирает пену и воду, потом сердце блестит; на сухом — «ку-ку»
  if (B.towel) {
    const Tw = B.towel; Tw.t += dt;
    const [tx, ty] = towelPos();
    if (!Tw.dry) {
      for (const c of [...B.foam]) { const [cx, cy] = hp(c.fx, c.fy); if (Math.hypot(cx - tx, cy - ty) < Rr * 0.45) { B.foam.splice(B.foam.indexOf(c), 1); burst(cx, cy, 'smoke', 3, { color: '#fff', speed: 60, size: 10 }); } }
      if ((Tw.t * 3 | 0) !== ((Tw.t - dt) * 3 | 0)) whoosh(0.25, 0.06);
      if (Tw.t > 1.6) {
        B.towel = null; B.foam.length = 0; B.foamOn = false; B.foamN = 0; B.wet = 0;
        const clean = !B.spots.length;
        dried();
        happy(true); sfx.tinkle();
        if (clean) { B.shine = 2.6; sfx.magic(); burst(hx, hy - Rr * 0.3, 'spark', 16, { color: '#fff6a8', speed: 280 }); }
        else { B.hint = 0; B.hintI = 0; B.hintT = 0; } // вытерли, но пятнышко осталось — посмотрит на него
      }
    } else {
      if (Tw.t > 1.0 && !Tw.kuku) { Tw.kuku = true; snd.kuku(); sfx.giggle(1.3); happy(true); burst(hx, hy - Rr * 0.4, 'heart', 8, { up: -90, speed: 170, color: '#ff7aa8' }); }
      if (Tw.t > 1.4) B.towel = null;
    }
  }
  // намёк: сердце время от времени смотрит на пятнышко, пятнышко «подмигивает»
  for (const sp of B.spots) sp.wig += dt;
  if (B.on && B.spots.length && !B.sponge && !B.towel && B.shower <= 0) {
    if (B.hint >= 0) { B.hint += dt; if (B.hint > 1.4) B.hint = -1; }
    else if ((B.hintT += dt) > 5) {
      B.hintT = 0; B.hint = 0; B.hintI = (B.hintI + 1) % B.spots.length;
    }
    if (B.hint >= 0 && B.hint - dt < 0.3 && B.hint >= 0.3) { const sp = B.spots[B.hintI % B.spots.length]; if (sp) { sp.wig = 0; snd.hm(); } }
  } else B.hint = -1;
  B.shine = Math.max(0, B.shine - dt);
}

// ---------------- РИСОВАНИЕ ----------------
const tubOn = () => B.tub > 0.001 && !G.finale;
function drawBack() {
  if (tubOn()) {
    const g = geo(), { hx, rimY, rw, ry, Rr } = g;
    // внутренность ванны и вода за сердцем
    ctx.save();
    ctx.fillStyle = '#d4ebf8'; ell(hx, rimY, rw, ry);
    ctx.beginPath(); ctx.ellipse(hx, rimY, rw, ry, 0, 0, TAU); ctx.clip();
    if (B.level > 0.01) {
      ctx.fillStyle = '#8fd6f6'; ctx.fillRect(hx - rw, g.waterY, 2 * rw, ry * 3);
      ell(hx, g.waterY, g.wrx, ry * 0.8);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ell(hx - g.wrx * 0.3, g.waterY - ry * 0.25, g.wrx * 0.35, ry * 0.12);
    }
    ctx.restore();
    ctx.strokeStyle = '#fbfdff'; ctx.lineWidth = 0.06 * Rr; ctx.beginPath(); ctx.ellipse(hx, rimY, rw, ry, 0, Math.PI, TAU); ctx.stroke();
    ctx.strokeStyle = '#8fb0cf'; ctx.lineWidth = Math.max(1, 0.015 * Rr); ctx.beginPath(); ctx.ellipse(hx, rimY, rw + 0.03 * Rr, ry + 0.03 * Rr, 0, Math.PI, TAU); ctx.stroke();
  }
  if (B.shower > 0 || B.drops.length) { const [sx, sy] = showerPos(); showerHead(sx, sy, showerS(), B.shower > 0); }
}
/** Ванна спереди: вода поверх низа сердца, пена на воде, уточка, стенка, ножки */
function drawTubFront() {
  const g = geo(), { hx, rimY, botY, rw, bw, ry, legH, Rr } = g;
  ctx.save(); ctx.beginPath(); ctx.rect(G.HR.x, G.HR.y, G.HR.w, G.HR.h); ctx.clip();
  // вода перед сердцем: полупрозрачная, с бликами
  if (B.level > 0.01) {
    ctx.save(); ctx.beginPath(); ctx.ellipse(hx, rimY, rw, ry, 0, 0, TAU); ctx.clip();
    ctx.fillStyle = 'rgba(110,200,245,0.72)'; ctx.fillRect(hx - rw, g.waterY, 2 * rw, ry * 3); ell(hx, g.waterY, g.wrx, ry * 0.8);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(1.5, 0.018 * Rr); ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) { const u = ((i * 0.45 + t * 0.04) % 1.8) - 0.9, [x, y] = surf(g, u); ctx.beginPath(); ctx.moveTo(x - 0.08 * Rr, y - 0.01 * Rr); ctx.quadraticCurveTo(x, y - 0.03 * Rr, x + 0.08 * Rr, y - 0.01 * Rr); ctx.stroke(); }
    // кольца от брызг
    for (const r of B.ripples) { const k = r.t / 0.9; ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - k)})`; ctx.beginPath(); ctx.ellipse(r.x, Math.max(r.y, g.waterY), (0.05 + 0.25 * k) * Rr, (0.02 + 0.07 * k) * Rr, 0, 0, TAU); ctx.stroke(); }
    // водоворот слива
    if (B.drain) {
      const vx = vortexX(g), a0 = B.drain.t * 6;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = Math.max(1.5, 0.02 * Rr);
      for (let j = 0; j < 3; j++) { ctx.beginPath(); for (let i = 0; i <= 20; i++) { const a = a0 + j * TAU / 3 + i * 0.3, rr = (0.02 + i * 0.008) * Rr; const x = vx + Math.cos(a) * rr, y = g.waterY + Math.sin(a) * rr * 0.35; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
    }
    ctx.restore();
    // пена на воде
    if (B.suds > 0.02) {
      const n = Math.round(4 + 10 * B.suds);
      for (let i = 0; i < n; i++) {
        const u = -0.92 + 1.84 * (i + 0.5) / n, [x, y] = surf(g, u), r = (0.05 + 0.035 * Math.sin(i * 2.3) ** 2) * Rr * Math.min(1, B.suds * 1.6);
        ctx.fillStyle = '#ffffff'; circle(x, y - r * 0.3 + Math.sin(t * 1.5 + i) * 0.006 * Rr, r);
        ctx.fillStyle = 'rgba(190,225,250,0.8)'; ell(x + r * 0.2, y + r * 0.2, r * 0.5, r * 0.22);
      }
    }
  }
  // уточка в воде (или едет в ванне, когда раздел закрыли)
  if (B.duck || B.tubDuck) {
    const [dx, dy] = duckPos(g), k = B.duck ? ease.outBack(clamp01(B.duck.t / 0.4)) : 1, d = B.duck;
    rubberDuck(dx, dy, duckS() * Math.max(0.01, k), d && d.jump < 0.3 ? Math.sin(d.jump / 0.3 * Math.PI) : 0, Math.sin(t * 1.2) * 0.06);
  }
  // стенка ванны
  const grd = ctx.createLinearGradient(hx - rw, 0, hx + rw, 0);
  grd.addColorStop(0, '#c5d8ec'); grd.addColorStop(0.35, '#ffffff'); grd.addColorStop(0.7, '#f2f7fc'); grd.addColorStop(1, '#bfd2e6');
  // ножки
  ctx.lineCap = 'round';
  for (const d of [-1, 1]) {
    const x = hx + d * bw * 0.62;
    ctx.fillStyle = '#ffcf4a'; ctx.strokeStyle = '#c9930a'; ctx.lineWidth = Math.max(1, 0.015 * Rr);
    ctx.beginPath(); ctx.moveTo(x - d * 0.06 * Rr, botY - 0.04 * Rr); ctx.quadraticCurveTo(x + d * 0.02 * Rr, botY + legH * 0.4, x + d * 0.06 * Rr, botY + legH * 0.75);
    ctx.lineTo(x + d * 0.12 * Rr, botY + legH * 0.75); ctx.quadraticCurveTo(x + d * 0.06 * Rr, botY + legH * 0.2, x + d * 0.08 * Rr, botY - 0.04 * Rr); ctx.closePath(); ctx.fill(); ctx.stroke();
    circle(x + d * 0.09 * Rr, botY + legH * 0.8, 0.045 * Rr); ctx.stroke();
  }
  wallPath(g); ctx.fillStyle = grd; ctx.fill();
  ctx.save(); wallPath(g); ctx.clip();
  ctx.strokeStyle = '#ff9ec7'; ctx.lineWidth = 0.06 * Rr; ctx.beginPath(); ctx.ellipse(hx, rimY + 0.16 * Rr, rw * 1.02, ry * 1.1, 0, 0, Math.PI); ctx.stroke();
  for (let i = -2; i <= 2; i++) if (Math.abs(i) * 0.32 * Rr < bw * 0.95) smallHeart(hx + i * 0.32 * Rr, rimY + ry + 0.25 * Rr + Math.abs(i) * 0.02 * Rr, 0.055 * Rr, '#ffc4dd');
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ell(hx - rw * 0.55, rimY + (botY - rimY) * 0.5, 0.05 * Rr, (botY - rimY) * 0.25, 0.25);
  ctx.restore();
  wallPath(g); ctx.strokeStyle = '#8fb0cf'; ctx.lineWidth = Math.max(1, 0.018 * Rr); ctx.stroke();
  // передний бортик
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.06 * Rr; ctx.beginPath(); ctx.ellipse(hx, rimY, rw, ry, 0, 0, Math.PI); ctx.stroke();
  ctx.strokeStyle = '#8fb0cf'; ctx.lineWidth = Math.max(1, 0.015 * Rr); ctx.beginPath(); ctx.ellipse(hx, rimY, rw + 0.03 * Rr, ry + 0.03 * Rr, 0, 0, Math.PI); ctx.stroke();
  ctx.restore();
}
/** Мокрое сердце: капельки сползают, на боках блики */
const WET_AT: [number, number][] = [[-0.7, -0.55], [-0.45, -0.25], [0.55, -0.6], [0.78, -0.2], [-0.82, -0.1], [0.4, 0.1], [-0.3, -0.82], [0.2, -0.45], [-0.55, 0.15], [0.68, 0.02]];
function drawWet(Rr: number) {
  const a = clamp01(B.wet / 8) * (B.shake < SHAKE ? 1 - B.shake / SHAKE : 1);
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.03 * Rr; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(G.heart.x - 0.48 * Rr, G.heart.y - 0.45 * Rr + (hp(0, 0)[1] - G.heart.y), 0.32 * Rr, Math.PI * 1.05, Math.PI * 1.4); ctx.stroke();
  ctx.beginPath(); ctx.arc(G.heart.x + 0.5 * Rr, G.heart.y - 0.42 * Rr + (hp(0, 0)[1] - G.heart.y), 0.3 * Rr, Math.PI * 1.6, Math.PI * 1.85); ctx.stroke();
  WET_AT.forEach(([fx, fy], i) => { const k = (t * 0.06 + i * 0.37) % 1, [x, y] = hp(fx, fy + k * 0.12); ctx.globalAlpha = a * (k < 0.85 ? 1 : (1 - k) / 0.15); drop(x, y, Math.max(2.5, 0.032 * Rr)); });
  ctx.restore();
}
/** Блеск чистоты: мягкие звёздочки вокруг сердца медленно мерцают (и вне ванны) */
function drawGlow(Rr: number) {
  const a = clamp01(B.glow / 4) * clamp01((GLOW - B.glow) / 0.6);
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a;
  [[-0.78, -0.72], [0.82, -0.66], [0.98, 0.0], [-0.98, -0.1], [0.05, -0.62], [-0.5, 0.45], [0.55, 0.42]].forEach(([fx, fy], i) => {
    const tw = 0.5 + 0.5 * Math.sin(t * 1.8 + i * 2.1), [x, y] = hp(fx, fy);
    ctx.globalAlpha = a * (0.35 + 0.65 * tw); sparkleStar(x, y, Math.max(5, Rr * (0.045 + 0.03 * tw)), i * 0.7 + t * 0.4, '#ffffff');
  });
  ctx.globalAlpha = a * 0.55; ctx.fillStyle = '#ffffff'; const [gx, gy] = hp(-0.5, -0.55); ell(gx, gy, 0.12 * Rr, 0.06 * Rr, -0.7);
  ctx.restore();
}
function drawFront() {
  const Rr = R();
  // пятнышки на сердце (подмигивают, когда сердце на них смотрит)
  for (const sp of B.spots) {
    const [x, y] = hp(sp.fx, sp.fy), w = sp.wig < 0.8 ? Math.sin(sp.wig * TAU * 2.2) * (0.8 - sp.wig) * 0.25 : 0;
    spotArt(sp, x, y, Rr * 0.15 * (0.7 + 0.3 * sp.dirt) * (1 + w));
  }
  drawWet(Rr);
  if (tubOn()) drawTubFront();
  // пена (смываемая душем — сползает и тает)
  for (const c of B.foam) {
    if (c.t <= 0) continue;
    const w = c.wash == null ? 0 : clamp01(c.wash / WASH), [x, y] = hp(c.fx, c.fy + w * 0.25);
    clump(x, y, c, Rr, ease.outBack(clamp01(c.t / 0.3)) * (1 - w * 0.9));
  }
  // короткий блеск после вытирания
  if (B.shine > 0) {
    ctx.save(); ctx.globalAlpha *= clamp01(B.shine);
    [[-0.5, -0.55], [0.55, -0.6], [0.72, 0.05], [-0.68, 0.02], [0.12, -0.78], [-0.2, 0.55], [0.35, 0.45]].forEach(([fx, fy], i) => {
      const [x, y] = hp(fx, fy), s = Rr * (0.06 + 0.03 * Math.sin(t * 6 + i * 1.7));
      sparkleStar(x, y, Math.max(4, s), t * 1.5 + i, '#ffffff');
    });
    ctx.restore();
  }
  drawGlow(Rr);
  if (B.sponge) { const { p: [px, py] } = spongeAt(); sponge(px, py, spongeS(), Math.sin(B.sponge.t * 9) * 0.3); }
  if (B.towel) { const [tx, ty] = towelPos(); towel(tx, ty, B.towel.dry ? Rr * 0.55 : Math.max(30, Rr * 0.3), B.towel.dry ? Math.sin(B.towel.t * 6) * 0.08 : Math.sin(B.towel.t * 9) * 0.25); }
  for (const d of B.drops) drop(d.x, d.y, Math.max(3, Rr * 0.025));
  for (const b of B.bubbles) { if (b.t <= 0) continue; const k = ease.outBack(clamp01(b.t / 0.4)); bubble(b.x + Math.sin(b.ph) * b.r * 0.4, b.y, b.r * Math.max(0.01, k)); }
}
function live(L: Live) {
  if (B.shower > 0 || (B.towel && !B.towel.dry) || B.shake < SHAKE) L.blink = 1; // жмурится от удовольствия
  if (B.sponge) L.mouth = Math.max(L.mouth, 0.6 + 0.3 * Math.sin(t * 10));
  if (B.towel && B.towel.dry && B.towel.t > 1.0) { L.mouth = 1; L.blink = 0; } // ку-ку!
  // смотрит на пятнышко
  if (B.hint >= 0 && B.spots.length) { const sp = B.spots[B.hintI % B.spots.length]; L.lx = Math.max(-1, Math.min(1, sp.fx * 1.4)); L.ly = Math.max(-1, Math.min(1, (sp.fy + 0.12) * 1.6)); }
}
function xform(X: Xf) {
  if (B.sponge) X.rot += Math.sin(B.sponge.t * 13) * (B.sponge.dry ? 0.05 : 0.025);
  if (B.towel && !B.towel.dry) { X.rot += Math.sin(B.towel.t * 12) * 0.04; X.sx *= 1.02; X.sy *= 0.98; }
  if (B.shake < SHAKE) { // отряхивается: ~2.2 раза в секунду, нарастает и стихает
    const env = Math.sin(Math.PI * B.shake / SHAKE);
    X.rot += Math.sin(B.shake * TAU * 2.2) * 0.14 * env; X.sx *= 1 + 0.03 * env; X.sy *= 1 - 0.03 * env;
  }
}

// ---------------- ТАПЫ ----------------
function hit(x: number, y: number): Hit | null {
  const Rr = R();
  for (let i = B.bubbles.length - 1; i >= 0; i--) { const b = B.bubbles[i]; if (b.t > 0 && near(x, y, b.x + Math.sin(b.ph) * b.r * 0.4, b.y, b.r * 1.1)) return { what: 'bubble', o: b }; }
  if (B.sponge) { const { p: [px, py] } = spongeAt(); if (near(x, y, px, py, spongeS() * 1.1)) return { what: 'sponge' }; }
  if (B.towel) { const [tx, ty] = towelPos(); if (near(x, y, tx, ty, Rr * (B.towel.dry ? 0.5 : 0.3))) return { what: 'towel' }; }
  if (B.duck) { const [dx, dy] = duckPos(), s = duckS(); if (near(x, y, dx, dy - 0.6 * s, s * 0.8)) return { what: 'duck' }; }
  let best: Clump | null = null, bd = 1e9;
  for (const c of B.foam) { if (c.t <= 0 || c.wash != null) continue; const [cx, cy] = hp(c.fx, c.fy), d = Math.hypot(x - cx, y - cy); if (d < Math.max(30, Rr * 0.17 * (c.s || 1)) && d < bd) { bd = d; best = c; } }
  if (best) return { what: 'foam', o: best };
  if (B.shower > 0) { const [sx, sy] = showerPos(); if (near(x, y, sx, sy - showerS() * 0.3, showerS() * 1.1)) return { what: 'shower' }; }
  for (const sp of B.spots) { const [sx, sy] = hp(sp.fx, sp.fy); if (near(x, y, sx, sy, Rr * 0.14)) return { what: 'spot', o: sp }; }
  if (tubOn() && B.tub > 0.8) {
    const g = geo();
    if (y > g.waterY - g.ry && y < g.botY + g.legH) {
      const k = clamp01((y - g.rimY) / (g.botY - g.rimY)), half = g.rw + (g.bw - g.rw) * k * k;
      if (Math.abs(x - g.hx) < half) return { what: y < g.rimY + g.ry + 0.02 * Rr && B.level > 0.05 ? 'water' : 'tub' };
    }
  }
  return null;
}
function tap(h: Hit, x: number, y: number) {
  const Rr = R();
  switch (h.what) {
    case 'bubble': {
      const i = B.bubbles.indexOf(h.o); if (i >= 0) B.bubbles.splice(i, 1);
      sfx.pop(rand(0.7, 1.3)); burst(x, y, 'spark', 8, { color: pick(['#ffffff', '#bfe8ff', '#ffc4e1']), speed: 200 }); break;
    }
    case 'foam': popClump(h.o); break;
    case 'sponge': if (B.sponge!.dry) snd.squeakDry(); else snd.rub(); B.sponge!.t = Math.max(0, B.sponge!.t - 0.3); burst(x, y, 'smoke', 4, { color: '#fff', speed: 100, size: 12 }); break;
    case 'towel': whoosh(0.3, 0.08); burst(x, y, 'spark', 5, { color: '#ffc4e1', speed: 150 }); break;
    case 'duck': { // брызгается: капли летят на сердце, сердце мокрое
      B.duck!.jump = 0; dreamDuck(); sfx.squeak(); sfx.splash(); burst(x, y - 10 * S, 'heart', 3, { up: -80, speed: 120, color: '#ffd93b' });
      if (B.level > 0.1) {
        const g = geo(); B.ripples.push({ x, y: g.waterY, t: 0 });
        for (let i = 0; i < 12; i++) addP({ kind: 'spark', x, y: g.waterY, vx: (G.heart.x - x) * rand(0.6, 1.6) + rand(-60, 60) * S, vy: -rand(250, 420) * S, life: 0.7, size: rand(4, 7) * S, color: '#9fdcff', rot: 0, vr: 0, g: 700 });
        wetHeart(30); G.hs.wgT = 0; G.hs.mouth = 1;
      }
      break;
    }
    case 'shower': B.shower = Math.min(4, B.shower + 1.2); sfx.splash(); burst(x, y + Rr * 0.1, 'spark', 6, { color: '#9fdcff', speed: 160 }); break;
    case 'water': { // плюх: круги по воде, брызги, немножко мочит
      sfx.splash(); B.ripples.push({ x, y, t: 0 });
      for (let i = 0; i < 8; i++) addP({ kind: 'spark', x, y, vx: rand(-120, 120) * S, vy: -rand(200, 360) * S, life: 0.6, size: rand(4, 6) * S, color: '#9fdcff', rot: 0, vr: 0, g: 700 });
      if (Math.abs(x - G.heart.x) < Rr * 0.8) { wetHeart(20); G.hs.mouth = 1; }
      break;
    }
    case 'tub': snd.ding(); B.tubWob = 0; burst(x, y, 'spark', 4, { color: '#ffffff', speed: 120 }); break;
    case 'spot': { // пальцем: мокрое или в пене — оттирается, сухое — пятнышко смешно дрожит и чуть бледнеет
      const sp = h.o as Spot, wet = !isDry();
      sp.wig = 0;
      if (wet) { snd.rub(); burst(x, y, 'smoke', 3, { color: '#fff', speed: 80, size: 10 }); scrub(sp, 0.4); }
      else { snd.squeakDry(); G.hs.mouth = 0.8; G.hs.wgT = 0; scrub(sp, 0.15); }
      break;
    }
  }
}

// ---------------- ЗНАЧКИ ----------------
const BG_BATH: [string, string] = ['#e6f8ff', '#a9def7'];
function optIcon(k: string, r: number) {
  iconBg(r, ...BG_BATH);
  if (k === 'foam') {
    const c: Clump = { fx: 0, fy: 0, r: 1, t: 1, sub: [[-0.42, 0.25, 0.28], [0.4, 0.27, 0.27], [0, 0.18, 0.34], [-0.2, -0.12, 0.27], [0.2, -0.15, 0.26], [0, -0.42, 0.2]] };
    ctx.fillStyle = 'rgba(80,170,230,0.35)'; ell(0, r * 0.55, r * 0.75, r * 0.15); clump(0, 0, c, r, 1);
  } else if (k === 'shower') {
    ctx.save(); showerHead(-r * 0.1, -r * 0.25, r * 0.5, true, -r * 1.2); ctx.restore();
    for (let i = 0; i < 6; i++) { const ph = (t * 1.2 + i * 0.37) % 1; drop(-r * 0.45 + i * r * 0.17 + ph * r * 0.08, -r * 0.05 + ph * r * 0.7, r * 0.06); }
  } else if (k === 'rubberduck') {
    ctx.fillStyle = 'rgba(80,170,230,0.45)'; ell(0, r * 0.6, r * 0.8, r * 0.14);
    rubberDuck(-r * 0.05, r * 0.62, r * 0.85);
  } else if (k === 'soapbubbles') {
    bubble(-r * 0.25, r * 0.15, r * 0.4); bubble(r * 0.35, -r * 0.3, r * 0.28); bubble(r * 0.38, r * 0.4, r * 0.16); bubble(-r * 0.4, -r * 0.48, r * 0.14);
  } else if (k === 'sponge') {
    sponge(0, r * 0.08, r * 0.55, -0.15);
    ctx.fillStyle = '#fff'; for (const [x, y, rr] of [[-0.45, -0.38, 0.12], [-0.25, -0.45, 0.09], [0.4, -0.4, 0.1]]) circle(x * r, y * r, rr * r);
  } else if (k === 'towel') {
    ctx.strokeStyle = '#9fb0c2'; ctx.lineWidth = r * 0.1; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-r * 0.7, -r * 0.5); ctx.lineTo(r * 0.7, -r * 0.5); ctx.stroke();
    ctx.save(); ctx.translate(0, -r * 0.5);
    ctx.fillStyle = '#ff9ec7'; ctx.strokeStyle = '#e0669e'; ctx.lineWidth = r * 0.04; ctx.beginPath(); ctx.roundRect(-r * 0.45, -r * 0.05, r * 0.9, r * 1.0, r * 0.08); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(-r * 0.45, r * 0.65, r * 0.9, r * 0.08); ctx.fillRect(-r * 0.45, r * 0.5, r * 0.9, r * 0.05);
    ctx.fillStyle = '#ffc4dd'; ctx.fillRect(-r * 0.45, -r * 0.05, r * 0.9, r * 0.18);
    smallHeart(0, r * 0.32, r * 0.13, '#fff');
    ctx.restore();
  } else if (k === 'drain') {
    // водоворот в воде и пробка на цепочке
    ctx.fillStyle = '#7fd0f5'; ell(0, r * 0.25, r * 0.85, r * 0.5);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = r * 0.07; ctx.lineCap = 'round';
    const a0 = -t * 3;
    for (let j = 0; j < 2; j++) { ctx.beginPath(); for (let i = 0; i <= 16; i++) { const a = a0 + j * Math.PI + i * 0.35, rr = r * (0.06 + i * 0.03); const x = Math.cos(a) * rr, y = r * 0.25 + Math.sin(a) * rr * 0.5; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
    ctx.fillStyle = '#55667a'; ell(0, r * 0.25, r * 0.12, r * 0.06);
    ctx.strokeStyle = '#9fb0c2'; ctx.lineWidth = r * 0.04; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(r * (0.12 + i * 0.09), -r * (0.1 + i * 0.1), r * 0.05, r * 0.03, 0.6, 0, TAU); ctx.stroke(); }
    ctx.save(); ctx.translate(r * 0.58, -r * 0.6); ctx.rotate(0.4);
    ctx.fillStyle = '#ff6fa5'; ctx.strokeStyle = '#c94a7c'; ctx.lineWidth = r * 0.04; ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.1); ctx.lineTo(r * 0.2, -r * 0.1); ctx.lineTo(r * 0.14, r * 0.14); ctx.lineTo(-r * 0.14, r * 0.14); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#9fb0c2'; circle(0, -r * 0.16, r * 0.05);
    ctx.restore();
  }
}
/** Ванна на ножках с пеной */
function icon(r: number) {
  iconBg(r, ...BG_BATH);
  const c: Clump = { fx: 0, fy: 0, r: 1, t: 1, sub: [[-0.45, -0.08, 0.18], [-0.2, -0.18, 0.2], [0.08, -0.12, 0.19], [0.35, -0.16, 0.18], [0.55, -0.05, 0.14], [-0.05, -0.36, 0.14]] };
  clump(0, 0, c, r, 1);
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#7fb8e0'; ctx.lineWidth = r * 0.05;
  ctx.beginPath(); ctx.moveTo(-r * 0.75, -r * 0.05); ctx.lineTo(r * 0.75, -r * 0.05); ctx.quadraticCurveTo(r * 0.72, r * 0.48, r * 0.3, r * 0.5); ctx.lineTo(-r * 0.3, r * 0.5); ctx.quadraticCurveTo(-r * 0.72, r * 0.48, -r * 0.75, -r * 0.05); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ff9ec7'; ctx.fillRect(-r * 0.72, r * 0.08, r * 1.44, r * 0.08);
  ctx.fillStyle = '#ffd23f'; for (const d of [-1, 1]) ell(d * r * 0.4, r * 0.6, r * 0.09, r * 0.12);
  ctx.strokeStyle = '#9fb0c2'; ctx.lineWidth = r * 0.07; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-r * 0.65, -r * 0.05); ctx.lineTo(-r * 0.65, -r * 0.5); ctx.lineTo(-r * 0.45, -r * 0.5); ctx.stroke();
}

export const bath: CareSection = {
  id: 'bath', state: B, icon, optIcon,
  sel: k => k === 'foam' ? B.foamOn : k === 'rubberduck' ? !!B.duck : k === 'shower' ? B.shower > 0 : false,
  enter: ensureOn,
  act: k => act(k), exit, update, drawBack, drawFront, hit, tap, live, xform,
};
