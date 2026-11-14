// Мир вокруг сердца: фон (цвет и детали) и окружение (малыши-сердечки, пузыри, бабочки, шарики, искорки, цветы,
// котёнок, рыбки, утёнок). Координаты хранятся в долях области G.HR или в радиусах сердца — переживают поворот экрана.
import { H, S, TAU, W, ctx, pick, rand, t } from '../../core/canvas';
import { circle } from '../../core/draw';
import { addP, burst } from '../../core/particles';
import { BG_COLORS, G } from './state';
import {
  APPLE_PTS, FLAG_COLS, MINI_COLORS, apple, balloon, bubble, butterfly, castle, cloud, duck, fish, garland, hillsPath, kitten,
  miniHeart, moon, rainbowArc, sea, sparkleStar, stemFlower, sun, tree,
} from './things';
import { PENTA, sfx } from './sounds';

const FLOWER_COLS = ['#ff7aa8', '#ffd23f', '#c9a7ff', '#7fd1ff', '#ff9636', '#ffffff', '#ff5c7a'];
const BALLOON_COLS = ['#ff5c8a', '#ffcf3f', '#6ec3ff'];
export const FISH_COLS: [string, string][] = [['#ffb0d8', '#ff5fa2'], ['#9fe4ff', '#3c9fe0'], ['#ffe27a', '#ff9a3c']];

export const env = {
  babies: MINI_COLORS.map((col, i) => ({ u: 0.1 + i * 0.2, dir: i % 2 ? 1 : -1, sp: rand(0.03, 0.06), ph: rand(0, TAU), jump: 9, col, blinkT: rand(1, 4), turnT: rand(2, 6) })),
  bubbles: [] as any[],
  butterflies: [0, 1, 2].map(i => ({ u: rand(0.1, 0.9), v: rand(0.1, 0.6), tu: rand(0.1, 0.9), tv: rand(0.1, 0.6), ph: rand(0, TAU), col: ['#ff8fc8', '#ffd23f', '#9fd0ff'][i], spin: 0 })),
  balloons: [[-1.45, -0.55], [1.5, -0.7], [1.22, -1.15]].map(([ox, oy], i) => ({ ox, oy, col: BALLOON_COLS[i], fly: 0, grow: 1, ph: rand(0, TAU) })),
  sparkles: Array.from({ length: 9 }, (_, i) => ({ a: i * TAU / 9 + rand(-0.2, 0.2), d: rand(1.3, 1.65), ph: rand(0, TAU), boost: 0 })),
  flowers: Array.from({ length: 7 }, (_, i) => ({ u: 0.06 + i * 0.88 / 6 + rand(-0.03, 0.03), col: FLOWER_COLS[i], ph: rand(0, TAU), bloom: 0 })),
  kitten: { jump: 9, blinkT: 2, wave: 0, tail: 0 },
  fish: FISH_COLS.map((col, i) => ({ u: rand(0, 1), v: 0.14 + i * 0.2, dir: i % 2 ? -1 : 1, sp: rand(0.04, 0.07), ph: rand(0, TAU), col, spin: 0, bubT: rand(0.5, 3) })),
  fishBubbles: [] as { u: number; v: number; r: number }[],
  duck: { u: 0.3, dir: 1, ph: 0, jump: 9, turnT: 4, blinkT: 3, quack: 0 },
  clouds: [0, 1, 2].map(i => ({ u: i * 0.38 + rand(0, 0.1), v: rand(0.08, 0.28), s: rand(0.8, 1.15), sp: rand(0.008, 0.016), bounce: 0 })),
  stars: Array.from({ length: 40 }, () => ({ u: rand(0, 1), v: rand(0, 0.6), s: rand(1.5, 3.5), ph: rand(0, TAU) })),
  sun: { spin: 0, laugh: 0 }, moon: { wink: 0, hop: 0 }, rainbow: { glow: 0 },
  castle: { lit: 0, wave: 0 },
  tree: { shake: 0, apples: APPLE_PTS.map(() => ({ grow: 1, fall: -1, y: 0, vy: 0, hit: false })) },
  garland: { swing: 0 },
  sea: { jump: 9, ju: 0.5 },
};

const on = (k: string) => !!G.cfg.env[k];
const bgOn = (k: string) => !!G.cfg.bgd[k];
export const groundY = () => G.HR.y + G.HR.h * 0.95;
const miniR = () => Math.max(24, G.heart.R * 0.17);

// ---------------- ПОЗИЦИИ ----------------
export function babyPos(b: any): [number, number] {
  const r = miniR(), hop = Math.abs(Math.sin(b.ph)) * r * 0.25, j = b.jump < 0.6 ? Math.sin(b.jump / 0.6 * Math.PI) * r * 1.6 : 0;
  return [G.HR.x + b.u * G.HR.w, groundY() - r * 0.95 - hop - j];
}
export function bubblePos(b: any): [number, number] { return [G.HR.x + b.u * G.HR.w + Math.sin(t * 1.5 + b.ph) * 14 * S, G.HR.y + b.v * G.HR.h]; }
export function flyPos(f: any): [number, number] { return [G.HR.x + f.u * G.HR.w, G.HR.y + f.v * G.HR.h + Math.sin(t * 3 + f.ph) * 8 * S]; }
const balR = () => Math.max(24, G.heart.R * 0.22);
export function balloonPos(b: any): [number, number] {
  const R = G.heart.R, r = balR();
  const x = Math.max(G.HR.x + r * 1.2, Math.min(G.HR.x + G.HR.w - r * 1.2, G.heart.x + b.ox * R));
  const y = Math.max(G.HR.y + r * 1.4, G.heart.y + b.oy * R) + Math.sin(t * 1.3 + b.ph) * r * 0.15 - b.fly * H * 1.3;
  return [x + Math.sin(t * 0.9 + b.ph) * r * 0.12, y];
}
export function sparkPos(s: any): [number, number] { const R = G.heart.R; return [G.heart.x + Math.cos(s.a + t * 0.15) * s.d * R, G.heart.y - 0.1 * R + Math.sin(s.a + t * 0.15) * s.d * R * 0.85]; }
export function flowerPos(f: any): [number, number] { return [G.HR.x + f.u * G.HR.w, groundY() + 4 * S]; }
const flowerS = () => Math.max(14, G.heart.R * 0.1);
// котёнок сидит слева у кончика сердца
const kitS = () => Math.max(20, G.heart.R * 0.15);
export function kittenPos(): [number, number] {
  const s = kitS(), k = env.kitten, j = k.jump < 0.6 ? Math.sin(k.jump / 0.6 * Math.PI) * s * 1.2 : 0;
  const x = Math.max(G.HR.x + s * 1.2, G.heart.x - G.heart.R * 0.78);
  return [x, groundY() + 2 * S - j];
}
const fishS = () => Math.max(16, G.heart.R * 0.11);
export function fishPos(f: any): [number, number] { return [G.HR.x + f.u * G.HR.w, G.HR.y + f.v * G.HR.h + Math.sin(t * 1.8 + f.ph) * 10 * S]; }
const duckS = () => Math.max(20, G.heart.R * 0.14);
export function duckPos(): [number, number] {
  const d = env.duck, s = duckS(), j = d.jump < 0.5 ? Math.sin(d.jump / 0.5 * Math.PI) * s * 0.9 : 0;
  return [G.HR.x + d.u * G.HR.w, groundY() + 3 * S - j];
}
export function cloudPos(c: any): [number, number] { return [-0.15 * W + ((c.u % 1.3 + 1.3) % 1.3) * W, G.HR.y + c.v * G.HR.h - c.bounce * 20 * S]; }
const sunR = () => Math.max(30, 46 * S);
export function sunPos(): [number, number] { const r = sunR(); return [G.HR.x + r * 1.9, G.HR.y + r * 1.9]; }
export function moonPos(): [number, number] { const r = sunR() * 0.9; return [G.HR.x + G.HR.w - r * 2.2, G.HR.y + r * 2.4 - env.moon.hop * 12 * S]; }
export function rainbowGeo() { const R = G.heart.R; return { cx: G.heart.x, cy: G.heart.y + 0.75 * R, r: R * 2.05, w: R * 0.55 }; }
export const hillTop = () => G.HR.y + G.HR.h * 0.86;
// замок справа вдали, дерево слева, море по низу, гирлянда сверху
const castleS = () => Math.max(26, Math.min(G.HR.h * 0.085, G.HR.w * 0.07));
export function castlePos(): [number, number] { const s = castleS(); return [G.HR.x + G.HR.w - s * 3.2, G.HR.y + G.HR.h * 0.9]; }
const treeS = () => Math.max(34, Math.min(G.HR.h * 0.15, G.HR.w * 0.11));
export function treePos(): [number, number] { const s = treeS(); return [G.HR.x + s * 0.95, groundY()]; }
export const seaTop = () => G.HR.y + G.HR.h * 0.92;
const garGeo = () => ({ x0: G.HR.x + 6 * S, x1: G.HR.x + G.HR.w - 6 * S, y: G.HR.y + Math.max(8, 10 * S), sag: Math.max(14, G.HR.h * 0.04), fs: Math.max(14, 20 * S) });

// ---------------- ОБНОВЛЕНИЕ ----------------
export function updateWorld(dt: number) {
  for (const b of env.babies) {
    b.ph += dt * 6; b.jump += dt;
    b.u += b.dir * b.sp * dt;
    if (b.u < 0.05) { b.u = 0.05; b.dir = 1; } if (b.u > 0.95) { b.u = 0.95; b.dir = -1; }
    b.turnT -= dt; if (b.turnT <= 0) { b.turnT = rand(2, 6); b.dir = -b.dir; }
    b.blinkT -= dt; if (b.blinkT < -0.15) b.blinkT = rand(2, 5);
  }
  if (on('bubbles')) {
    if (env.bubbles.length < 9 && Math.random() < dt * 1.5) env.bubbles.push({ u: rand(0.05, 0.95), v: 1.02, sp: rand(0.05, 0.11), r: rand(14, 30) * Math.max(0.8, S), ph: rand(0, TAU) });
  }
  for (const b of env.bubbles) b.v -= b.sp * dt;
  env.bubbles = env.bubbles.filter(b => b.v > -0.15);
  for (const f of env.butterflies) {
    f.ph += dt * 14; f.spin = Math.max(0, f.spin - dt);
    const du = f.tu - f.u, dv = f.tv - f.v, d = Math.hypot(du, dv);
    if (d < 0.02) { f.tu = rand(0.08, 0.92); f.tv = rand(0.08, 0.65); }
    else { const sp = (f.spin > 0 ? 0.5 : 0.12) * dt; f.u += du / d * Math.min(d, sp); f.v += dv / d * Math.min(d, sp); }
  }
  for (const b of env.balloons) {
    if (b.fly > 0) { b.fly += dt * 0.35; if (b.fly > 1) { b.fly = 0; b.grow = 0; } }
    b.grow = Math.min(1, b.grow + dt * 1.2);
  }
  for (const s of env.sparkles) s.boost = Math.max(0, s.boost - dt);
  for (const f of env.flowers) f.bloom = Math.max(0, f.bloom - dt);
  // котёнок
  const k = env.kitten; k.jump += dt; k.wave = Math.max(0, k.wave - dt); k.tail += dt * (2 + (k.wave > 0 ? 6 : 0));
  k.blinkT -= dt; if (k.blinkT < -0.15) k.blinkT = rand(2, 5);
  // рыбки плывут и пускают пузырьки
  for (const f of env.fish) {
    f.ph += dt * 6; f.spin = Math.max(0, f.spin - dt * 1.6);
    f.u += f.dir * f.sp * dt * (f.spin > 0 ? 3 : 1);
    if (f.u > 1.12) f.u = -0.12; if (f.u < -0.12) f.u = 1.12;
    f.bubT -= dt;
    if (f.bubT <= 0) { f.bubT = rand(1.5, 3.5); if (on('fish')) env.fishBubbles.push({ u: f.u + f.dir * 0.03, v: f.v, r: rand(4, 8) * Math.max(0.8, S) }); }
  }
  for (const b of env.fishBubbles) b.v -= 0.06 * dt;
  env.fishBubbles = env.fishBubbles.filter(b => b.v > -0.05 && on('fish'));
  // утёнок ходит вперевалку
  const d = env.duck; d.jump += dt; d.ph += dt * 9; d.quack = Math.max(0, d.quack - dt);
  d.u += d.dir * 0.035 * dt;
  if (d.u < 0.06) { d.u = 0.06; d.dir = 1; } if (d.u > 0.94) { d.u = 0.94; d.dir = -1; }
  d.turnT -= dt; if (d.turnT <= 0) { d.turnT = rand(3, 7); d.dir = -d.dir; }
  d.blinkT -= dt; if (d.blinkT < -0.15) d.blinkT = rand(2, 5);
  for (const c of env.clouds) { c.u += c.sp * dt; c.bounce = Math.max(0, c.bounce - dt * 2); }
  env.sun.spin += dt * (0.15 + env.sun.laugh * 4); env.sun.laugh = Math.max(0, env.sun.laugh - dt);
  env.moon.wink = Math.max(0, env.moon.wink - dt); env.moon.hop = Math.max(0, env.moon.hop - dt * 2);
  env.rainbow.glow = Math.max(0, env.rainbow.glow - dt);
  env.castle.lit = Math.max(0, env.castle.lit - dt); env.castle.wave = Math.max(0, env.castle.wave - dt * 0.7);
  env.garland.swing = Math.max(0, env.garland.swing - dt * 0.6);
  env.sea.jump += dt;
  // яблоки: падают, подпрыгивают на земле, тают и вырастают заново
  const T = env.tree; T.shake = Math.max(0, T.shake - dt * 1.5);
  const ts = treeS();
  T.apples.forEach((a, i) => {
    if (a.fall >= 0) {
      a.fall += dt; a.vy += 1600 * S * dt; a.y += a.vy * dt;
      const floor = -APPLE_PTS[i][1] * ts - 0.15 * ts;
      if (a.y > floor) { a.y = floor; if (!a.hit) { a.hit = true; sfx.plop(); } a.vy = Math.abs(a.vy) > 120 * S ? -a.vy * 0.35 : 0; }
      if (a.fall > 2.4) { a.fall = -1; a.y = 0; a.vy = 0; a.grow = 0; a.hit = false; }
    } else a.grow = Math.min(1, a.grow + dt * 0.8);
  });
}

// ---------------- РИСОВАНИЕ ----------------
export function bgColors(k: string) { return BG_COLORS[k] || BG_COLORS.pink; }

export function drawBg() {
  const [c0, c1] = bgColors(G.cfg.bg), night = G.cfg.bg === 'night';
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, c0); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // мягкие «боке»-круги для глубины
  ctx.fillStyle = night ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.22)';
  for (let i = 0; i < 6; i++) circle(W * ((i * 0.37 + 0.1) % 1), H * ((i * 0.53 + 0.2) % 1), Math.min(W, H) * (0.08 + (i % 3) * 0.05));
  if (night || bgOn('moon')) for (const s of env.stars) { ctx.fillStyle = `rgba(255,250,210,${(night ? 0.55 : 0.35) + 0.4 * Math.sin(t * 2.5 + s.ph)})`; circle(s.u * W, s.v * H, s.s * S * 1.4); }
  if (bgOn('rainbow')) { const R = rainbowGeo(); rainbowArc(R.cx, R.cy, R.r, R.w, 0.75 + env.rainbow.glow * 0.25); }
  if (bgOn('sun')) { const [x, y] = sunPos(); sun(x, y, sunR() * (1 + env.sun.laugh * 0.1), env.sun.spin, env.sun.laugh); }
  if (bgOn('moon')) { const [x, y] = moonPos(); moon(x, y, sunR() * 0.9, env.moon.wink); }
  if (bgOn('clouds')) for (const c of env.clouds) { const [x, y] = cloudPos(c); cloud(x, y, c.s * Math.max(40, 64 * S)); }
  if (bgOn('castle')) { const [x, y] = castlePos(); castle(x, y, castleS() * (1 + env.castle.lit * 0.04), env.castle.wave, env.castle.lit); }
  if (bgOn('hills')) {
    const y0 = hillTop(), a = 14 * S, x0 = Math.min(0, G.HR.x), x1 = Math.max(W, G.HR.x + G.HR.w);
    ctx.fillStyle = night ? '#3c7a5a' : '#9fe08a'; hillsPath(x0, x1, y0 - a, H, a * 1.4, 0.8); ctx.fill();
    ctx.fillStyle = night ? '#2f6a4a' : '#7fd16c'; hillsPath(x0, x1, y0 + a * 1.6, H, a, 2.6); ctx.fill();
  }
  if (bgOn('tree')) {
    const [x, y] = treePos(), s = treeS();
    tree(x, y, s, env.tree.shake, env.tree.apples.map(a => a.fall >= 0 ? 0 : a.grow));
    env.tree.apples.forEach((a, i) => { if (a.fall >= 0) { ctx.save(); ctx.globalAlpha = Math.min(1, (2.4 - a.fall) * 2); apple(x + APPLE_PTS[i][0] * s, y + APPLE_PTS[i][1] * s + a.y, 0.15 * s); ctx.restore(); } });
  }
  if (bgOn('sea')) {
    const x0 = Math.min(0, G.HR.x), x1 = Math.max(W, G.HR.x + G.HR.w), y0 = seaTop(), amp = Math.max(3, 5 * S);
    // рыбка выпрыгивает из воды после тапа
    const sj = env.sea.jump;
    if (sj < 1.1) { const k = sj / 1.1, fx = G.HR.x + env.sea.ju * G.HR.w + (k - 0.5) * 80 * S, fy = y0 + amp * 2 - Math.sin(k * Math.PI) * 110 * S; fish(fx, fy, fishS() * 0.9, FISH_COLS[2], 1, (k - 0.5) * 1.6, t * 10); }
    sea(x0, x1, y0, H, amp, t * 1.5);
  }
  if (bgOn('garland')) { const q = garGeo(); garland(q.x0, q.x1, q.y, q.sag, q.fs, env.garland.swing); }
}

/** Позади сердца: шарики, искорки, цветы */
export function drawEnvBack() {
  if (on('balloons')) for (const b of env.balloons) { const [x, y] = balloonPos(b), r = balR() * Math.max(0.01, b.grow); balloon(x, y, r, b.col, 2.6); }
  if (on('sparkles')) for (const s of env.sparkles) { const [x, y] = sparkPos(s), k = 0.7 + 0.3 * Math.sin(t * 3 + s.ph) + s.boost; sparkleStar(x, y, Math.max(10, G.heart.R * 0.07) * k, t * 0.8 + s.ph + s.boost * 6); }
  if (on('flowers')) for (const f of env.flowers) { const [x, y] = flowerPos(f), s = flowerS() * (1 + f.bloom * 0.4); stemFlower(x, y, s, f.col, Math.sin(t * 1.5 + f.ph) * 0.25, f.bloom * 8); }
}

/** Перед сердцем: котёнок, утёнок, малыши-сердечки, бабочки, рыбки, пузыри */
export function drawEnvFront(showBabies = true) {
  if (on('kitten')) {
    const k = env.kitten, [x, y] = kittenPos(), lx = Math.max(-1, Math.min(1, (G.heart.x - x) / (G.heart.R || 1)));
    kitten(x, y, kitS(), { look: lx, blink: k.blinkT < 0, mouth: k.jump < 0.7 ? 1 : 0, wave: k.wave, tail: k.tail });
  }
  if (on('duck')) { const d = env.duck, [x, y] = duckPos(); duck(x, y, duckS(), d.dir, d.ph, { blink: d.blinkT < 0, mouth: d.quack > 0 ? Math.abs(Math.sin(d.quack * 25)) : 0 }); }
  if (on('babies') && showBabies) for (const b of env.babies) {
    const [x, y] = babyPos(b), r = miniR(), land = b.jump >= 0.6 && b.jump < 0.8 ? Math.sin((b.jump - 0.6) / 0.2 * Math.PI) * 0.15 : 0;
    miniHeart(x, y, r, b.col, { lx: b.dir, blink: b.blinkT < 0, mouth: b.jump < 0.8 ? 1 : 0, rot: Math.sin(b.ph) * 0.08, sx: 1 + land, sy: 1 - land });
  }
  if (on('butterflies')) for (const f of env.butterflies) { const [x, y] = flyPos(f); butterfly(x, y, Math.max(18, G.heart.R * 0.12), f.ph, f.col, Math.sin(t * 2 + f.ph) * 0.2 + f.spin * 12); }
  if (on('fish')) {
    for (const b of env.fishBubbles) bubble(G.HR.x + b.u * G.HR.w, G.HR.y + b.v * G.HR.h, b.r);
    for (const f of env.fish) { const [x, y] = fishPos(f); fish(x, y, fishS(), f.col, f.dir, f.spin > 0 ? (1 - f.spin) * TAU : Math.sin(t * 1.8 + f.ph) * 0.12, f.ph); }
  }
  for (const b of env.bubbles) { const [x, y] = bubblePos(b); bubble(x, y, b.r); }
}

// ---------------- ТАПЫ ----------------
/** Найти объект мира под точкой. Порядок: то, что ближе к зрителю, — первым. */
export function hitWorld(x: number, y: number, front: boolean): any {
  const near = (p: [number, number], r: number) => Math.hypot(x - p[0], y - p[1]) < Math.max(r, 32);
  if (front) {
    for (const b of env.bubbles) if (near(bubblePos(b), b.r * 1.2)) return { k: 'bubble', o: b };
    if (on('butterflies')) for (const f of env.butterflies) if (near(flyPos(f), G.heart.R * 0.15)) return { k: 'butterfly', o: f };
    if (on('fish')) for (const f of env.fish) if (near(fishPos(f), fishS() * 1.3)) return { k: 'fish', o: f };
    if (on('babies')) for (const b of env.babies) if (near(babyPos(b), miniR() * 1.1)) return { k: 'baby', o: b };
    if (on('duck')) { const [dx, dy] = duckPos(), s = duckS(); if (near([dx, dy - 0.7 * s], s * 0.9)) return { k: 'duck' }; }
    if (on('kitten')) { const [kx, ky] = kittenPos(), s = kitS(); if (near([kx, ky - 1.0 * s], s * 1.1)) return { k: 'kitten' }; }
    return null;
  }
  if (on('balloons')) for (const b of env.balloons) if (b.fly === 0 && near(balloonPos(b), balR() * 1.2)) return { k: 'balloon', o: b };
  if (on('sparkles')) for (const s of env.sparkles) if (near(sparkPos(s), G.heart.R * 0.1)) return { k: 'sparkle', o: s };
  if (on('flowers')) for (const f of env.flowers) { const [fx, fy] = flowerPos(f); if (near([fx, fy - 2.2 * flowerS()], flowerS() * 1.4)) return { k: 'flower', o: f }; }
  if (bgOn('garland')) { const q = garGeo(); if (x > q.x0 && x < q.x1 && y > q.y - 10 * S && y < q.y + q.sag * 1.6 + q.fs * 1.2) return { k: 'garland' }; }
  if (bgOn('sun') && near(sunPos(), sunR() * 1.3)) return { k: 'sun' };
  if (bgOn('moon') && near(moonPos(), sunR() * 1.1)) return { k: 'moon' };
  if (bgOn('clouds')) for (const c of env.clouds) { const [cx, cy] = cloudPos(c), s = c.s * Math.max(40, 64 * S); if (Math.abs(x - cx) < s && Math.abs(y - cy) < s * 0.6) return { k: 'cloud', o: c }; }
  if (bgOn('tree')) { const [tx, ty] = treePos(), s = treeS(); if (Math.abs(x - tx) < s * 1.1 && y > ty - 2.75 * s && y < ty) return { k: 'tree' }; }
  if (bgOn('castle')) { const [cx, cy] = castlePos(), s = castleS(); if (Math.abs(x - cx) < s * 1.3 && y > cy - 3 * s && y < cy) return { k: 'castle' }; }
  if (bgOn('rainbow')) { const R = rainbowGeo(), d = Math.hypot(x - R.cx, y - R.cy); if (y < R.cy && d < R.r && d > R.r - R.w) return { k: 'rainbow' }; }
  if (bgOn('sea') && y > seaTop() - 6 * S) return { k: 'sea' };
  if (bgOn('hills') && y > hillTop()) return { k: 'hills' };
  return null;
}

export function tapWorld(h: any, x: number, y: number) {
  const o = h.o;
  switch (h.k) {
    case 'bubble': {
      const [bx, by] = bubblePos(o); env.bubbles.splice(env.bubbles.indexOf(o), 1);
      burst(bx, by, 'spark', 8, { color: '#d8f2ff', speed: 140, size: 5 }); sfx.pop(30 / o.r); break;
    }
    case 'butterfly': o.spin = 0.6; o.tu = o.u < 0.5 ? rand(0.6, 0.92) : rand(0.08, 0.4); o.tv = rand(0.08, 0.5); sfx.flutter(); burst(x, y, 'spark', 6, { color: o.col }); break;
    case 'baby': if (o.jump > 0.6) { o.jump = 0; sfx.giggle(1.4); const [bx, by] = babyPos(o); burst(bx, by, 'heart', 5, { color: o.col[0], speed: 120, up: -60 }); } break;
    case 'balloon': o.fly = 0.001; sfx.wheee(); burst(x, y, 'spark', 6, { color: o.col }); break;
    case 'sparkle': o.boost = 0.6; sfx.chime(pick(PENTA) * 2); burst(x, y, 'spark', 10, { color: '#fff6a8', speed: 160 }); break;
    case 'flower': o.bloom = 0.8; sfx.chime(pick(PENTA)); burst(x, y, 'heart', 5, { color: o.col === '#ffffff' ? '#ffb3d1' : o.col, up: -80 }); break;
    case 'kitten': {
      const k = env.kitten;
      if (k.jump > 0.7) { k.jump = 0; k.wave = 1.2; sfx.meow(); const [kx, ky] = kittenPos(); burst(kx, ky - 1.6 * kitS(), 'heart', 6, { color: '#ff8fb5', up: -90, speed: 120 }); }
      break;
    }
    case 'fish': {
      if (o.spin <= 0) { o.spin = 1; sfx.blub(); for (let i = 0; i < 5; i++) env.fishBubbles.push({ u: o.u + rand(-0.03, 0.03), v: o.v + rand(-0.03, 0.02), r: rand(5, 10) * Math.max(0.8, S) }); burst(x, y, 'spark', 6, { color: o.col[0], speed: 120 }); }
      break;
    }
    case 'duck': {
      const d = env.duck;
      if (d.jump > 0.5) { d.jump = 0; d.quack = 0.4; d.dir = -d.dir; sfx.quack(); const [dx, dy] = duckPos(); burst(dx, dy - duckS(), 'confetti', 6, { color: '#ffe14d', speed: 120, g: 200 }); burst(dx, dy - duckS(), 'heart', 3, { color: '#ffb84d', up: -80, speed: 80 }); }
      break;
    }
    case 'sun': env.sun.laugh = 1.2; sfx.giggle(0.8); burst(...sunPos(), 'spark', 12, { color: '#ffd23f', speed: 200 }); break;
    case 'moon': env.moon.wink = 1.2; env.moon.hop = 1; sfx.tinkle(); burst(...moonPos(), 'spark', 10, { color: '#fff6c0', speed: 150 }); break;
    case 'cloud': {
      o.bounce = 1; sfx.boing();
      const [cx, cy] = cloudPos(o), s = o.s * Math.max(40, 64 * S);
      for (let i = 0; i < 12; i++) addP({ kind: Math.random() < 0.4 ? 'heart' : 'spark', x: cx + rand(-0.8, 0.8) * s, y: cy + 0.4 * s, vx: rand(-10, 10) * S, vy: rand(60, 140) * S, life: rand(0.8, 1.4), size: rand(5, 9) * S, color: pick(['#8fd3ff', '#c9a7ff', '#ffb3d1']), rot: rand(0, TAU), vr: rand(-3, 3), g: 200 });
      break;
    }
    case 'rainbow': { env.rainbow.glow = 1; sfx.arp(); const R = rainbowGeo(); for (let i = 0; i < 14; i++) { const a = Math.PI + i / 13 * Math.PI; burst(R.cx + Math.cos(a) * (R.r - R.w / 2), R.cy + Math.sin(a) * (R.r - R.w / 2), 'spark', 1, { color: '#fff', speed: 60 }); } break; }
    case 'hills': sfx.pick(Math.floor(rand(0, 8))); burst(x, y, 'heart', 4, { color: pick(FLOWER_COLS.slice(0, 5)), up: -120, speed: 90 }); break;
    case 'castle': {
      if (env.castle.lit < 0.5) sfx.fanfare(); env.castle.lit = 1.6; env.castle.wave = 1;
      const [cx, cy] = castlePos(), s = castleS();
      for (const dx of [-0.9, 0, 0.9]) burst(cx + dx * s, cy - (dx ? 2.6 : 3.1) * s, 'spark', 5, { color: pick(['#fff6a8', '#ffb3d1', '#c9a7ff']), speed: 140 });
      break;
    }
    case 'tree': {
      const T = env.tree; T.shake = 1; sfx.rustle();
      const [tx, ty] = treePos(), s = treeS();
      const a = T.apples.filter(a => a.fall < 0 && a.grow > 0.95); if (a.length) { const one = pick(a); one.fall = 0; one.vy = 0; one.y = 0; one.hit = false; }
      for (let i = 0; i < 8; i++) addP({ kind: 'heart', x: tx + rand(-0.7, 0.7) * s, y: ty - rand(1.3, 2.3) * s, vx: rand(-40, 40) * S, vy: rand(-20, 40) * S, life: rand(1, 1.8), size: rand(5, 8) * S, color: pick(['#6fcf5a', '#9fe08a', '#4caf50']), rot: rand(0, TAU), vr: rand(-4, 4), g: 120 });
      break;
    }
    case 'garland': {
      env.garland.swing = 1; sfx.tinkle();
      const q = garGeo(); for (let i = 0; i < 14; i++) addP({ kind: 'confetti', x: rand(q.x0, q.x1), y: q.y + q.sag, vx: rand(-30, 30) * S, vy: rand(20, 120) * S, life: rand(1.2, 2), size: rand(7, 11) * S, color: pick(FLAG_COLS), rot: rand(0, TAU), vr: rand(-6, 6), g: 150 });
      break;
    }
    case 'sea': {
      sfx.splash(); env.sea.jump = 0; env.sea.ju = Math.max(0.05, Math.min(0.95, (x - G.HR.x) / G.HR.w));
      for (let i = 0; i < 12; i++) addP({ kind: 'spark', x: x + rand(-10, 10) * S, y: seaTop(), vx: rand(-90, 90) * S, vy: rand(-260, -120) * S, life: rand(0.6, 1), size: rand(5, 9) * S, color: pick(['#ffffff', '#bfefff', '#7fdcf5']), rot: rand(0, TAU), vr: rand(-4, 4), g: 600 });
      break;
    }
  }
}
