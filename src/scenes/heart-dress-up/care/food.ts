// Уход — еда: угощение летит из кнопки по дуге ко рту, сердце жуёт (3 «ням» с хрустом и крошками) и радуется.
// «Любимая еда дня» — влюблённые глаза и особый звук; «смешная еда дня» — гримаса «бе-е» и смех (обе фиксированы на день).
// Очередь до 3 угощений: лишние ждут сбоку от сердца; ещё больше — кнопка пружинит с «м-м!».
import { tone, whoosh } from '../../../core/audio';
import { S, TAU, clamp, ctx, pick, rand, t } from '../../../core/canvas';
import { circle, ell } from '../../../core/draw';
import { addP, burst } from '../../../core/particles';
import { clamp01, ease } from '../../../core/tween';
import { CARE_OPTS } from '../careopts';
import { Live } from '../heart';
import { Xf } from '../reactions';
import { sfx } from '../sounds';
import { G } from '../state';
import { apple, smallHeart } from '../things';
import { UI } from '../ui';
import { CareSection, R, dayNo, happy, hp, iconBg, mouthPos, sideX } from './section';

/** День → еда дня (каждый день другая: шаг 5 взаимно прост с числом угощений); off — сдвиг для «смешной» еды */
function foodOfDay(off = 0) {
  const F = CARE_OPTS.food;
  return F[((dayNo() * 5 + off) % F.length + F.length) % F.length];
}

const F = {
  fav: foodOfDay(), funny: foodOfDay(4), favFound: false,
  /** угощения в полёте: к рту (park < 0) или на «место ожидания» park */
  fly: [] as { k: string; x0: number; y0: number; t: number; dur: number; park: number }[],
  /** угощения ждут своей очереди рядом с сердцем */
  wait: [] as { k: string; park: number; t: number }[],
  /** сейчас жуёт: t — время с момента, как еда во рту */
  eat: null as null | { k: string; t: number; fav: boolean; grim: boolean; bites: number; done: boolean },
  /** кнопка угощения «пружинит» — очередь полна */
  bounce: null as null | { k: string; t: number },
};

const snd = {
  /** хрум (печенье, морковка, яблоко) или чавк (мягкое) */
  chomp(crunchy: boolean) {
    if (crunchy) { whoosh(0.09, 0.14); tone(170, 0.06, { type: 'square', vol: 0.05 }); tone(rand(1900, 2500), 0.03, { type: 'square', vol: 0.025, delay: 0.03 }); tone(rand(1400, 1800), 0.03, { type: 'square', vol: 0.02, delay: 0.06 }); }
    else { tone(240, 0.1, { slide: 120, vol: 0.15 }); tone(170, 0.08, { type: 'triangle', slide: 90, vol: 0.1, delay: 0.06 }); }
  },
  /** «ммм!» */
  yum() { tone(392, 0.22, { type: 'triangle', vol: 0.1, slide: 523 }); tone(523, 0.35, { type: 'triangle', vol: 0.1, delay: 0.22, slide: 494 }); },
  /** любимая еда: радостный перелив и чмок */
  fav() { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.09, delay: i * 0.07 })); tone(1568, 0.9, { vol: 0.06, delay: 0.4 }); sfx.kiss(); },
  /** смешное «бррр» */
  brr() { for (let i = 0; i < 9; i++) tone(150 + (i % 2) * 50, 0.05, { type: 'sawtooth', vol: 0.035, delay: i * 0.045 }); tone(700, 0.3, { type: 'triangle', slide: 350, vol: 0.08 }); },
  fly() { whoosh(0.35, 0.06); tone(500, 0.3, { type: 'triangle', slide: 1100, vol: 0.06 }); },
  /** «глык» — проглотил */
  gulp() { tone(420, 0.12, { slide: 180, vol: 0.12 }); tone(260, 0.1, { type: 'triangle', slide: 160, vol: 0.08, delay: 0.1 }); },
  /** «м-м!» с полным ртом и пружинка кнопки */
  full() { tone(300, 0.14, { type: 'triangle', slide: 360, vol: 0.09 }); tone(360, 0.18, { type: 'triangle', slide: 280, vol: 0.09, delay: 0.16 }); tone(160, 0.35, { slide: 420, vol: 0.12, delay: 0.02 }); },
};
const CRUNCHY: Record<string, boolean> = { cookie: true, carrot: true, apple: true, candy: true, watermelon: true };

// ---------------- РИСОВАЛКИ ----------------
/** Размер угощения у рта: множитель к 0.17R (клубника меньше яблока, арбуз — самый большой) */
const FOOD_K: Record<string, number> = { candy: 0.85, strawberry: 0.85, cookie: 1.0, donut: 1.2, apple: 1.35, cupcake: 1.3, carrot: 1.35, icecream: 1.65, watermelon: 1.8 };
/** Верхний край угощения в долях s — оттуда откусывают, им угощение касается рта */
const FOOD_TOP: Record<string, number> = { strawberry: -0.6, cupcake: -0.72, icecream: -0.85, cookie: -0.8, watermelon: -0.3, candy: -0.45, apple: -0.52, carrot: -0.5, donut: -0.8 };
const foodS = (k: string) => R() * 0.17 * (FOOD_K[k] || 1);
/** Угощение с центром (0,0), «радиус» s; bites — сколько откушено (0..3), откусы сверху */
function treat(k: string, s: number, bites = 0) {
  ctx.save();
  // откусы: каждый следующий — ещё одна круглая выемка сверху (клипы пересекаются)
  const top = FOOD_TOP[k] ?? -0.7;
  const B: [number, number, number][] = [[0, top + 0.02, 0.36], [0.4, top + 0.12, 0.34], [-0.4, top + 0.12, 0.34]];
  for (let i = 0; i < Math.min(3, bites); i++) {
    const [bx, by, br] = B[i];
    // «зубчики» откуса: три кружка, каждый — отдельный клип (наложенные кружки в одном evenodd-пути взаимно гасятся)
    for (let j = 0; j < 3; j++) {
      const a = Math.atan2(by, bx) + (j - 1) * 1.1, x = (bx - Math.cos(a) * br * 0.35) * s, y = (by - Math.sin(a) * br * 0.35) * s;
      ctx.beginPath(); ctx.rect(-3 * s, -3 * s, 6 * s, 6 * s); ctx.moveTo(x + br * 0.55 * s, y); ctx.arc(x, y, br * 0.55 * s, 0, TAU); ctx.clip('evenodd');
    }
  }
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (k === 'strawberry') {
    ctx.fillStyle = '#ff3b5c'; ctx.beginPath(); ctx.moveTo(0, 0.88 * s);
    ctx.bezierCurveTo(-1.0 * s, 0.25 * s, -0.85 * s, -0.7 * s, 0, -0.52 * s); ctx.bezierCurveTo(0.85 * s, -0.7 * s, 1.0 * s, 0.25 * s, 0, 0.88 * s); ctx.fill();
    ctx.strokeStyle = '#c0143a'; ctx.lineWidth = 0.06 * s; ctx.stroke();
    ctx.fillStyle = '#ffe27a'; for (const [x, y] of [[-0.4, -0.25], [0, -0.3], [0.4, -0.25], [-0.5, 0.1], [-0.15, 0.05], [0.2, 0.05], [0.52, 0.1], [-0.25, 0.4], [0.1, 0.4], [0, 0.65]]) ell(x * s, y * s, 0.045 * s, 0.07 * s);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ell(-0.45 * s, -0.3 * s, 0.1 * s, 0.18 * s, 0.5);
    ctx.fillStyle = '#3fae49'; for (let i = 0; i < 5; i++) { ctx.save(); ctx.translate(0, -0.55 * s); ctx.rotate(-Math.PI / 2 + (i - 2) * 0.6); ell(0.22 * s, 0, 0.24 * s, 0.09 * s); ctx.restore(); }
    ctx.strokeStyle = '#2d8a36'; ctx.lineWidth = 0.08 * s; ctx.beginPath(); ctx.moveTo(0, -0.6 * s); ctx.lineTo(0.05 * s, -0.85 * s); ctx.stroke();
  } else if (k === 'cupcake') {
    ctx.fillStyle = '#7fc8ff'; ctx.beginPath(); ctx.moveTo(-0.6 * s, 0.05 * s); ctx.lineTo(0.6 * s, 0.05 * s); ctx.lineTo(0.42 * s, 0.85 * s); ctx.lineTo(-0.42 * s, 0.85 * s); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#3d8fd1'; ctx.lineWidth = 0.05 * s; ctx.stroke();
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 0.22 * s, 0.1 * s); ctx.lineTo(i * 0.16 * s, 0.8 * s); ctx.stroke(); }
    ctx.fillStyle = '#ffa3c8'; ell(0, -0.02 * s, 0.7 * s, 0.24 * s); ell(0, -0.27 * s, 0.54 * s, 0.22 * s); ell(0, -0.5 * s, 0.34 * s, 0.17 * s);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ell(-0.3 * s, -0.3 * s, 0.14 * s, 0.06 * s, -0.3);
    ['#fff36b', '#7be0ff', '#fff', '#9cf08a'].forEach((c, i) => { ctx.fillStyle = c; ctx.save(); ctx.translate((-0.4 + i * 0.27) * s, (-0.12 - (i % 2) * 0.22) * s); ctx.rotate(i); ctx.fillRect(-0.06 * s, -0.02 * s, 0.12 * s, 0.04 * s); ctx.restore(); });
    ctx.fillStyle = '#ff2f4f'; circle(0, -0.7 * s, 0.14 * s); ctx.fillStyle = 'rgba(255,255,255,0.7)'; circle(-0.04 * s, -0.74 * s, 0.04 * s);
    ctx.strokeStyle = '#3f8a2a'; ctx.lineWidth = 0.04 * s; ctx.beginPath(); ctx.moveTo(0, -0.82 * s); ctx.quadraticCurveTo(0.05 * s, -0.95 * s, 0.18 * s, -0.98 * s); ctx.stroke();
  } else if (k === 'icecream') {
    ctx.fillStyle = '#f5c27a'; ctx.beginPath(); ctx.moveTo(-0.42 * s, 0.05 * s); ctx.lineTo(0.42 * s, 0.05 * s); ctx.lineTo(0, 1.0 * s); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.clip(); ctx.strokeStyle = '#cf9445'; ctx.lineWidth = 0.04 * s;
    for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i * 0.2 * s - 0.5 * s, 0); ctx.lineTo(i * 0.2 * s + 0.5 * s, 1.0 * s); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i * 0.2 * s + 0.5 * s, 0); ctx.lineTo(i * 0.2 * s - 0.5 * s, 1.0 * s); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = '#9fe8c8'; circle(0, -0.08 * s, 0.44 * s); ell(-0.3 * s, 0.1 * s, 0.14 * s, 0.12 * s); ell(0.25 * s, 0.13 * s, 0.1 * s, 0.14 * s);
    ctx.fillStyle = '#ffaccd'; circle(0, -0.52 * s, 0.36 * s); ell(0.2 * s, -0.3 * s, 0.1 * s, 0.12 * s);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ell(-0.15 * s, -0.65 * s, 0.1 * s, 0.06 * s, -0.4); ell(-0.2 * s, -0.2 * s, 0.12 * s, 0.06 * s, -0.4);
    ctx.fillStyle = '#ff2f4f'; circle(0.05 * s, -0.9 * s, 0.12 * s);
  } else if (k === 'cookie') {
    ctx.fillStyle = '#dca25a'; for (let i = 0; i < 12; i++) { const a = i * TAU / 12; circle(Math.cos(a) * 0.7 * s, Math.sin(a) * 0.7 * s, 0.17 * s); } circle(0, 0, 0.75 * s);
    ctx.fillStyle = '#ebbd78'; circle(-0.1 * s, -0.1 * s, 0.55 * s);
    ctx.fillStyle = '#5a3218'; for (const [x, y, r] of [[-0.35, -0.3, 0.11], [0.25, -0.4, 0.09], [0.4, 0.15, 0.12], [-0.1, 0.1, 0.1], [-0.4, 0.35, 0.09], [0.1, 0.45, 0.1], [0.05, -0.1, 0.07]]) ell(x * s, y * s, r * s, r * 0.8 * s, x);
  } else if (k === 'watermelon') {
    ctx.save(); ctx.translate(0, -0.3 * s);
    ctx.fillStyle = '#3fae49'; ctx.beginPath(); ctx.moveTo(-0.98 * s, 0); ctx.arc(0, 0, 0.98 * s, 0, Math.PI); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d9f7c4'; ctx.beginPath(); ctx.moveTo(-0.86 * s, 0); ctx.arc(0, 0, 0.86 * s, 0, Math.PI); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff4d6a'; ctx.beginPath(); ctx.moveTo(-0.78 * s, 0); ctx.arc(0, 0, 0.78 * s, 0, Math.PI); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2b1420'; for (const [x, y] of [[-0.45, 0.2], [0, 0.25], [0.45, 0.2], [-0.25, 0.45], [0.25, 0.45], [0, 0.6]]) ell(x * s, y * s, 0.045 * s, 0.08 * s);
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ell(-0.4 * s, 0.08 * s, 0.2 * s, 0.05 * s);
    ctx.restore();
  } else if (k === 'candy') {
    ctx.fillStyle = '#ffb3d6'; ctx.strokeStyle = '#e05a9a'; ctx.lineWidth = 0.05 * s;
    for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(d * 0.35 * s, 0); ctx.lineTo(d * 0.95 * s, -0.42 * s); ctx.quadraticCurveTo(d * 0.8 * s, 0, d * 0.95 * s, 0.42 * s); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = '#fff'; circle(0, 0, 0.48 * s); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 0.46 * s, 0, TAU); ctx.clip(); ctx.strokeStyle = '#ff3f7a'; ctx.lineWidth = 0.12 * s;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); for (let a = 0; a < 3.2; a += 0.2) { const r = a * 0.16 * s; ctx.lineTo(Math.cos(a + i * Math.PI / 2) * r, Math.sin(a + i * Math.PI / 2) * r); } ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ell(-0.18 * s, -0.22 * s, 0.1 * s, 0.06 * s, -0.5);
  } else if (k === 'apple') {
    apple(0, 0.12 * s, 0.68 * s);
  } else if (k === 'carrot') {
    ctx.rotate(-0.6);
    ctx.fillStyle = '#4fbf48'; for (const a of [-0.45, 0, 0.45]) { ctx.save(); ctx.translate(0, -0.6 * s); ctx.rotate(a); ell(0, -0.25 * s, 0.09 * s, 0.28 * s); ctx.restore(); }
    ctx.fillStyle = '#ff8a1f'; ctx.beginPath(); ctx.moveTo(-0.26 * s, -0.6 * s); ctx.quadraticCurveTo(0, -0.72 * s, 0.26 * s, -0.6 * s); ctx.quadraticCurveTo(0.2 * s, 0.3 * s, 0, 0.95 * s); ctx.quadraticCurveTo(-0.2 * s, 0.3 * s, -0.26 * s, -0.6 * s); ctx.fill();
    ctx.strokeStyle = '#d0620a'; ctx.lineWidth = 0.04 * s; for (const [y, d] of [[-0.35, 1], [-0.05, -1], [0.25, 1], [0.5, -1]]) { ctx.beginPath(); ctx.moveTo(d * 0.18 * s * (1 - y * 0.4), y * s); ctx.lineTo(d * 0.04 * s, (y + 0.05) * s); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ell(-0.1 * s, -0.3 * s, 0.05 * s, 0.2 * s);
  } else if (k === 'donut') {
    ctx.fillStyle = '#e5ad62'; ctx.beginPath(); ctx.arc(0, 0, 0.82 * s, 0, TAU); ctx.moveTo(0.28 * s, 0); ctx.arc(0, 0, 0.28 * s, 0, TAU, true); ctx.fill();
    ctx.fillStyle = '#ff8fc0'; ctx.beginPath();
    for (let i = 0; i <= 24; i++) { const a = i * TAU / 24, r = (0.7 + Math.sin(i * 2.3) * 0.06) * s; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.moveTo(0.36 * s, 0); ctx.arc(0, 0, 0.36 * s, 0, TAU, true); ctx.fill();
    ['#fff36b', '#7be0ff', '#fff', '#9cf08a', '#c49bff'].forEach((c, i) => { for (let j = 0; j < 2; j++) { const a = i * 1.3 + j * 3.1, r = 0.53 * s; ctx.fillStyle = c; ctx.save(); ctx.translate(Math.cos(a) * r, Math.sin(a) * r); ctx.rotate(a * 2); ctx.fillRect(-0.07 * s, -0.025 * s, 0.14 * s, 0.05 * s); ctx.restore(); } });
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ell(-0.4 * s, -0.42 * s, 0.14 * s, 0.06 * s, -0.7);
  }
  ctx.restore();
}
const FOOD_COL: Record<string, string[]> = {
  strawberry: ['#ff3b5c', '#ffe27a'], cupcake: ['#ffa3c8', '#7fc8ff'], icecream: ['#9fe8c8', '#ffaccd'], cookie: ['#dca25a', '#5a3218'],
  watermelon: ['#ff4d6a', '#3fae49'], candy: ['#ff3f7a', '#fff'], apple: ['#ff3b4f', '#fff3c4'], carrot: ['#ff8a1f', '#4fbf48'], donut: ['#ff8fc0', '#e5ad62'],
};

// ---------------- ОЧЕРЕДЬ ----------------
/** Сколько угощений может ждать (в полёте и рядом с сердцем), не считая того, что во рту */
const MAXQ = 3;
/** Где угощение держится у рта: верхним краем у рта, само ниже (не закрывает глаза); откусанное подтягивается выше */
function holdPos(k: string, bites = 0): [number, number] {
  const [mx, my] = mouthPos();
  return [mx, my + 0.03 * R() - ((FOOD_TOP[k] ?? -0.7) + bites * 0.14) * foodS(k)];
}
/** Место ожидания в очереди: сбоку от сердца */
function parkPos(i: number): [number, number] {
  const P = [[0.95, 0.4], [-0.95, 0.4], [0.98, 0.78]][i % 3], half = foodS('watermelon') * 0.5;
  return [sideX(Math.sign(P[0]), Math.abs(P[0]), half), hp(0, P[1])[1] + Math.sin(t * 3 + i * 2) * 0.02 * R()];
}
const PARK_K = 0.62;
type Fly = typeof F.fly[number];
/** Где сейчас летящее угощение: x, y, размер, доля пути */
function flyPos(f: Fly): [number, number, number, number] {
  const k = clamp01(f.t / f.dur), e = ease.inOut(k), [tx, ty] = f.park < 0 ? holdPos(f.k) : parkPos(f.park), long = f.dur > 0.5;
  const x = f.x0 + (tx - f.x0) * e, y = f.y0 + (ty - f.y0) * e - Math.sin(k * Math.PI) * R() * (long ? 0.6 : 0.25);
  const s0 = long ? Math.max(22, 30 * S) : foodS(f.k) * PARK_K, s1 = foodS(f.k) * (f.park < 0 ? 1 : PARK_K);
  return [x, y, (s0 * (1 - k) + s1 * k) * (k < 0.15 && long ? 0.6 + k / 0.15 * 0.4 : 1), k];
}
function feed(k: string, x: number, y: number) {
  if (F.fly.length + F.wait.length >= MAXQ) { F.bounce = { k, t: 0 }; snd.full(); G.hs.wgT = 0; return; } // рот занят: кнопка пружинит
  let park = -1;
  if (F.eat || F.fly.length || F.wait.length) {
    const used = [...F.fly.map(f => f.park), ...F.wait.map(w => w.park)];
    park = [0, 1, 2].find(i => !used.includes(i)) ?? 0;
  }
  F.fly.push({ k, x0: x, y0: y, t: 0, dur: 0.7, park }); snd.fly();
}
function startEat(k: string) {
  const fav = k === F.fav;
  F.eat = { k, t: 0, fav, grim: !fav && k === F.funny, bites: 0, done: false };
}
/** Проглотить всё сразу (уходим из еды — и в сон тоже): глык — и ничего не осталось */
function swallow() {
  if (!F.eat && !F.fly.length && !F.wait.length) return;
  for (const f of F.fly) { const [x, y] = flyPos(f); burst(x, y, 'spark', 4, { speed: 120, color: '#fff6a8' }); }
  for (const w of F.wait) { const [x, y] = parkPos(w.park); burst(x, y, 'spark', 4, { speed: 120, color: '#fff6a8' }); }
  F.eat = null; F.fly.length = 0; F.wait.length = 0; F.bounce = null;
  snd.gulp(); G.hs.mouth = Math.max(G.hs.mouth, 0.5);
}

// ---------------- ОБНОВЛЕНИЕ ----------------
function update(dt: number) {
  const hs = G.hs, { x: hx, y: hy } = G.heart, Rr = R();
  // летит: ко рту или в очередь
  for (const f of F.fly) f.t += dt;
  for (const f of F.fly.filter(q => q.t >= q.dur)) {
    F.fly.splice(F.fly.indexOf(f), 1);
    if (f.park < 0 && !F.eat) startEat(f.k);
    else F.wait.push({ k: f.k, park: f.park < 0 ? 0 : f.park, t: 0 });
  }
  for (const w of F.wait) w.t += dt;
  if (!F.eat && !F.fly.some(f => f.park < 0) && F.wait.length) { // следующее из очереди — ко рту
    const w = F.wait.shift()!, [x, y] = parkPos(w.park);
    F.fly.push({ k: w.k, x0: x, y0: y, t: 0, dur: 0.4, park: -1 }); whoosh(0.2, 0.05);
  }
  if (F.bounce) { // кнопка пружинит: очередь полна
    const b = F.bounce; b.t += dt;
    const it = UI.items.find(q => q.kind === 'care' && q.k === b.k);
    if (it) it.press = 0.9 * Math.abs(Math.sin(b.t * 18)) * Math.exp(-b.t * 5);
    if (b.t > 0.6) F.bounce = null;
  }
  // жуёт: 3 «ням» (в моменты 0.12, 0.55, 0.98), потом реакция
  const E = F.eat;
  if (E) {
    const prev = E.t; E.t += dt;
    for (const ct of [0.12, 0.55, 0.98]) if (prev < ct && E.t >= ct) {
      E.bites++; snd.chomp(!!CRUNCHY[E.k]);
      const [mx, my] = mouthPos(), col = FOOD_COL[E.k] || ['#fff'];
      for (let i = 0; i < 6; i++) addP({ kind: 'confetti', x: mx + rand(-0.12, 0.12) * Rr, y: my + rand(0, 0.05) * Rr, vx: rand(-140, 140) * S, vy: rand(-160, -40) * S, life: rand(0.6, 1.1), size: rand(4, 8) * S, color: pick(col), rot: rand(0, TAU), vr: rand(-8, 8), g: 700 });
    }
    if (prev < 1.2 && E.t >= 1.2) {
      E.done = true;
      const [mx, my] = mouthPos();
      if (E.fav) {
        F.favFound = true; hs.love = 2.2; hs.jT = 0; snd.fav();
        burst(hx, hy - Rr * 0.3, 'heart', 16, { color: '#ff5c9a', up: -120, speed: 260 });
        addP({ kind: 'bigheart', x: hx, y: hy - Rr * 0.1, vx: 0, vy: -30 * S, life: 1.2, size: Rr * 0.5, color: 'rgba(255,90,150,0.5)', rot: 0, vr: 0, g: 0 });
      } else if (E.grim) { snd.brr(); burst(mx, my, 'spark', 6, { color: '#c9f0ff', speed: 140 }); }
      else { snd.yum(); happy(); burst(mx, my - Rr * 0.1, 'heart', 6, { up: -90, speed: 140 }); }
    }
    if (E.grim && prev < 2.1 && E.t >= 2.1) { sfx.giggle(1.1); happy(true); }
    if (E.t > (E.grim ? 2.7 : 1.9)) F.eat = null;
  }
}

// ---------------- РИСОВАНИЕ ----------------
function drawFront() {
  const Rr = R();
  // еда у рта (ниже рта, откусы сверху) и гримаса
  const E = F.eat;
  if (E && E.bites < 3) {
    const [fx, fy] = holdPos(E.k, E.bites), s = foodS(E.k) * (1 - E.bites * 0.05);
    ctx.save(); ctx.translate(fx, fy); ctx.rotate(Math.sin(E.t * 14) * 0.04); treat(E.k, s, E.bites); ctx.restore();
  }
  if (E && E.grim && E.done && E.t < 2.1) { // язычок «бе-е»
    const [mx, my] = mouthPos(), w = Math.sin((E.t - 1.2) * 18) * 0.015 * Rr;
    ctx.fillStyle = '#ff6f8f'; ell(mx + w, my + 0.07 * Rr, 0.065 * Rr, 0.08 * Rr); ctx.strokeStyle = '#d0406a'; ctx.lineWidth = Math.max(1, 0.012 * Rr); ctx.beginPath(); ctx.moveTo(mx + w, my + 0.03 * Rr); ctx.lineTo(mx + w, my + 0.1 * Rr); ctx.stroke();
  }
  // очередь: угощения ждут сбоку и покачиваются
  for (const w of F.wait) { const [x, y] = parkPos(w.park); ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 2.5 + w.park) * 0.12); treat(w.k, foodS(w.k) * PARK_K); ctx.restore(); }
  // в полёте: дуга от кнопки ко рту (или в очередь)
  for (const f of F.fly) { const [x, y, s, k] = flyPos(f); ctx.save(); ctx.translate(x, y); ctx.rotate(f.dur > 0.5 ? k * TAU : 0); treat(f.k, s); ctx.restore(); }
}

/** Смотрит на летящую еду и открывает рот, жуёт, гримаса */
function live(L: Live) {
  const E = F.eat;
  const f = F.fly.find(q => q.park < 0) || F.fly[0];
  if (f) {
    const [x, y, , k] = flyPos(f), Rr = R();
    L.lx = clamp((x - G.heart.x) / (Rr * 1.2), -1, 1); L.ly = clamp((y - G.heart.y) / (Rr * 1.2), -1, 1);
    if (k > 0.35 && f.park < 0) L.mouth = Math.max(L.mouth, 1);
  }
  if (E) {
    if (E.t < 1.1) L.mouth = 0.5 - 0.45 * Math.cos((E.t - 0.12) / 0.43 * TAU);
    else if (E.grim && E.t < 2.1) { L.blink = 1; L.mouth = 0; }
    else if (E.grim) L.mouth = 0.6 + 0.4 * Math.abs(Math.sin(E.t * 14));
    if (E.t < 1.1) L.ly = Math.max(L.ly, 0.5);
  }
}
function xform(X: Xf) {
  const E = F.eat;
  if (!E) return;
  if (E.t < 1.1) { const c = Math.cos((E.t - 0.12) / 0.43 * TAU); X.sy *= 1 - 0.025 * c; X.sx *= 1 + 0.02 * c; }
  else if (E.grim && E.t < 2.1) { X.rot += Math.sin(E.t * 16) * 0.05; X.sx *= 1.06; X.sy *= 0.94; }
}

// ---------------- ЗНАЧКИ ----------------
const BG_FOOD: [string, string] = ['#fff6e4', '#ffdcb8'];
function optIcon(k: string, r: number) {
  iconBg(r, ...BG_FOOD);
  ctx.save(); ctx.translate(0, r * 0.04); treat(k, r * 0.62); ctx.restore();
  if (F.favFound && k === F.fav) { ctx.fillStyle = '#fff'; circle(r * 0.58, -r * 0.55, r * 0.22); smallHeart(r * 0.58, -r * 0.53, r * 0.16, '#ff3f8a'); }
}
/** Тарелка с ягодой и ложка */
function icon(r: number) {
  iconBg(r, ...BG_FOOD);
  ctx.fillStyle = 'rgba(160,90,40,0.18)'; ell(-r * 0.08, r * 0.2, r * 0.66, r * 0.42);
  ctx.fillStyle = '#fff'; ell(-r * 0.1, r * 0.12, r * 0.66, r * 0.42); ctx.strokeStyle = '#ffb3d1'; ctx.lineWidth = r * 0.05; ctx.stroke();
  ctx.fillStyle = '#ffeef6'; ell(-r * 0.1, r * 0.12, r * 0.42, r * 0.26);
  ctx.save(); ctx.translate(-r * 0.12, r * 0.0); treat('strawberry', r * 0.32); ctx.restore();
  ctx.save(); ctx.translate(r * 0.68, r * 0.0); ctx.rotate(0.25);
  ctx.fillStyle = '#c9d2dc'; ctx.strokeStyle = '#8e9aa8'; ctx.lineWidth = r * 0.03; ell(0, -r * 0.42, r * 0.13, r * 0.2); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-r * 0.04, -r * 0.25, r * 0.08, r * 0.75, r * 0.04); ctx.fill(); ctx.stroke();
  ctx.restore();
}

export const food: CareSection = {
  id: 'food', state: F, icon, optIcon,
  act: (k, x, y) => feed(k, x, y),
  exit: swallow,
  update, drawFront, live, xform,
};
