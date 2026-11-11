import { S, TAU, clamp, ctx, easeOutBack, pick, rand, t } from '../../core/canvas';
import { circle, starPath } from '../../core/draw';
import { addP, burst } from '../../core/particles';
import { roomHead } from './room';
import { sfx } from './sounds';
import { G, RB, babies } from './state';
import { drawToy } from './toys';

// ---------------- ЖЕЛАНИЯ МАЛЫШЕЙ ----------------
export const WISHES = ['sleep', 'play', 'eat'], WISH_LIFE = 90, MAX_WISHES = 2;

export function headPos(b) { return b.home ? roomHead(b) : [b.x, b.y]; }

export function wishPos(b) {
  if (b.home) { const [hx, hy] = roomHead(b), r = RB(); return [hx + r * 1.15, hy - r * 1.9]; }
  const R = b.hitR(); return [b.x + R * 0.55, b.y - R * 0.95 - 22 * S];
}

export function updateWishes(dt) {
  let active = babies.filter(b => b.wish && b.visible()).length;
  for (const b of babies) {
    if (b.wish) {
      // таймер желания стоит, пока малыша тащат, идёт переход или малыш не на экране
      if (b.visible() && !b.dragged && !G.trans) b.wish.t -= dt;
      if (b.wish.t <= 0) { b.wish = null; b.wishT = rand(45, 90); }
      continue;
    }
    if (!b.visible() || b.dragged || G.trans || t - b.born < 3) continue;
    b.wishT -= dt; if (b.wishT > 0) continue;
    if (active >= MAX_WISHES || b.sleeping() || b.love > 0) { b.wishT = rand(3, 7); continue; }
    const opts = WISHES.filter(k => !(k === 'play' && b.play) && !(k === 'eat' && b.eat));
    b.wish = { k: pick(opts), t: WISH_LIFE, life: WISH_LIFE }; active++;
    sfx.wish();
  }
}

// желание исполнено — малыш в восторге
export function satisfy(b, k) {
  if (!b.wish || b.wish.k !== k) return false;
  const vis = b.visible(), [wx, wy] = wishPos(b);
  b.wish = null; b.wishT = rand(60, 100); b.love = 2.8;
  const seated = b.crib || b.chair || (b.play && b.play.phase === 'do' && (b.play.k === 'horse' || b.play.k === 'xylo'));
  if (!seated) b.anim = { k: 'joy', t: 2.4, d: 2.4 };
  if (!vis) return true;
  sfx.tada(); setTimeout(() => sfx.giggle(1.1), 500);
  burst(wx, wy, 'spark', 16, { size: 9, speed: 220, color: '#ffe27a' });
  const [hx, hy] = headPos(b);
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; addP({ kind: 'heart', x: hx, y: hy, vx: Math.cos(a) * 190 * S, vy: Math.sin(a) * 190 * S, life: 1.4, size: 11 * S, color: pick(['#ff7aa8', '#ff5d73', '#ffb3d1', '#ffd66b']), rot: 0, vr: 0, g: 0 }); }
  burst(hx, hy, 'confetti', 28, { size: 8, speed: 300, g: 300 });
  addP({ kind: 'bigheart', x: hx, y: hy - 40 * S, vx: 0, vy: -45 * S, life: 2.2, size: 28 * S, color: '#ff5d8f', rot: 0, vr: 0, g: 0 });
  return true;
}

export function drawWishIcon(k, s) {
  ctx.fillStyle = { sleep: '#3b2b80', eat: '#ffc98f', play: '#bfeaff' }[k]; circle(0, 0, s * 0.8);
  if (k === 'sleep') {
    ctx.save(); ctx.beginPath(); ctx.rect(-s, -s, s * 2, s * 2); ctx.arc(s * 0.28, -s * 0.22, s * 0.48, 0, TAU, true); ctx.clip('evenodd');
    ctx.fillStyle = '#ffc93d'; circle(-s * 0.08, 0, s * 0.6); ctx.restore();
    ctx.fillStyle = '#9b8cff'; ctx.save(); ctx.translate(s * 0.48, -s * 0.42); starPath(5, s * 0.2, s * 0.09); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(s * 0.42, s * 0.38); starPath(4, s * 0.13, s * 0.05); ctx.fill(); ctx.restore();
  } else if (k === 'eat') { ctx.save(); ctx.rotate(0.35); drawToy('bottle', s * 0.6); ctx.restore(); }
  else { ctx.save(); ctx.rotate(t * 1.5); drawToy('ball', s * 0.85); ctx.restore(); }
}

export function drawWish(b, x, y, sc0 = 1) {
  const w = b.wish, age = w.life - w.t;
  const appear = easeOutBack(clamp(age * 2.5, 0.01, 1)), fade = clamp(w.t / 1.2, 0, 1);
  const s = 30 * S * sc0 * Math.max(0.01, appear) * (0.5 + 0.5 * fade) * (1 + Math.sin(t * 4 + b.phase) * 0.06);
  ctx.save(); ctx.globalAlpha = fade; ctx.translate(x, y + Math.sin(t * 2.2 + b.phase) * 4 * S);
  ctx.fillStyle = 'rgba(40,20,80,0.18)'; circle(s * 0.06, s * 0.1, s * 1.08);
  ctx.fillStyle = '#fff';
  circle(-s * 0.78, s * 1.05, s * 0.18); circle(-s * 1.08, s * 1.42, s * 0.11);
  circle(0, 0, s); circle(-s * 0.68, s * 0.18, s * 0.55); circle(s * 0.68, s * 0.18, s * 0.55); circle(-s * 0.38, -s * 0.58, s * 0.5); circle(s * 0.38, -s * 0.58, s * 0.5);
  drawWishIcon(w.k, s);
  ctx.restore();
}
