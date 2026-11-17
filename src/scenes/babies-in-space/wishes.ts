import { S, TAU, clamp, ctx, easeOutBack, pick, rand, t } from '../../core/canvas';
import { circle, ell, starPath } from '../../core/draw';
import { addP, burst } from '../../core/particles';
import { roomHead } from './room';
import { sfx } from './sounds';
import { G, RB, babies, builtKind } from './state';
import { drawBathIcon, drawPottyIcon } from './bath';
import { drawToy } from './toys';
import { BLOCK_COLORS, TOYS4, drawHorseShape } from './nursery';
import { FOODS, drawFood } from './canteen';
import { heartPath } from '../../core/draw';

// ---------------- ЖЕЛАНИЯ МАЛЫШЕЙ ----------------
export const WISHES = ['sleep', 'play', 'eat', 'potty', 'bath'], WISH_LIFE = 90, MAX_WISHES = 2;
// какое здание исполняет желание
export const WISH_HOUSE = { sleep: 'nursery', play: 'nursery', eat: 'canteen', potty: 'bath', bath: 'bath' };

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
      b.wish.no = Math.max(0, (b.wish.no || 0) - dt);
      if (b.wish.t <= 0) { b.wish = null; b.wishT = rand(45, 90); }
      continue;
    }
    if (!b.visible() || b.dragged || G.trans || t - b.born < 3) continue;
    b.wishT -= dt; if (b.wishT > 0) continue;
    if (active >= MAX_WISHES || b.sleeping() || b.love > 0) { b.wishT = rand(3, 7); continue; }
    // горшок и купание появляются, только когда построена ванная
    const opts = WISHES.filter(k => !(k === 'play' && b.play) && !(k === 'eat' && b.eat) && !(k === 'bath' && b.tub) && !(k === 'potty' && b.potty) && (WISH_HOUSE[k] !== 'bath' || builtKind('bath')));
    const k = pick(opts);
    // играть и есть — конкретно: какую игрушку, какую еду (рисуется в пузыре)
    const o = k === 'play' ? pick(TOYS4) : k === 'eat' ? pick(FOODS) : null;
    b.wish = { k, o, t: WISH_LIFE, life: WISH_LIFE, no: 0 }; active++;
    sfx.wish();
  }
}

// желание исполнено — малыш в восторге. o — что именно дали (игрушка/еда); не то — пузырь качает «не-а»
export function satisfy(b, k, o?) {
  if (!b.wish || b.wish.k !== k) return false;
  if (b.wish.o && o && b.wish.o !== o) { b.wish.no = 1; if (b.visible()) sfx.nope(); return false; }
  const vis = b.visible(), [wx, wy] = wishPos(b);
  b.wish = null; b.wishT = rand(60, 100); b.love = 2.8;
  const seated = b.crib || b.chair || b.tub || b.potty || b.towel || (b.play && b.play.phase === 'do' && (b.play.k === 'horse' || b.play.k === 'xylo'));
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

export function drawWishIcon(k, s, o?) {
  ctx.fillStyle = { sleep: '#3b2b80', eat: '#ffc98f', play: '#bfeaff', potty: '#ffe3f0', bath: '#c6ecff' }[k]; circle(0, 0, s * 0.8);
  if (k === 'potty') { drawPottyIcon(s * 0.85); return; }
  if (k === 'bath') { drawBathIcon(s * 0.78); return; }
  if (k === 'sleep') {
    ctx.save(); ctx.beginPath(); ctx.rect(-s, -s, s * 2, s * 2); ctx.arc(s * 0.28, -s * 0.22, s * 0.48, 0, TAU, true); ctx.clip('evenodd');
    ctx.fillStyle = '#ffc93d'; circle(-s * 0.08, 0, s * 0.6); ctx.restore();
    ctx.fillStyle = '#9b8cff'; ctx.save(); ctx.translate(s * 0.48, -s * 0.42); starPath(5, s * 0.2, s * 0.09); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(s * 0.42, s * 0.38); starPath(4, s * 0.13, s * 0.05); ctx.fill(); ctx.restore();
  } else if (k === 'eat') {
    if (o === 'bottle' || !o) { ctx.save(); ctx.rotate(0.35); drawToy('bottle', s * 0.6); ctx.restore(); }
    else { // еда на белой тарелочке — чтобы жёлтый банан не терялся на персиковом фоне
      ctx.fillStyle = '#fff'; ell(0, s * 0.3, s * 0.62, s * 0.2); ctx.fillStyle = '#f1e4d4'; ell(0, s * 0.3, s * 0.42, s * 0.11);
      ctx.save(); ctx.translate(0, s * 0.02); ctx.rotate(Math.sin(t * 2.5) * 0.1); drawFood(o, s * (o === 'banana' ? 0.85 : 0.55)); ctx.restore();
    }
  } else drawToyIcon(o || 'ball', s);
}

// большие игрушки яслей — маленькими значками
export function drawToyIcon(o, s) {
  ctx.save();
  if (o === 'horse') { ctx.translate(-s * 0.1, s * 0.62); ctx.rotate(Math.sin(t * 5) * 0.12); drawHorseShape(s / 115, '#ff7aa8'); }
  else if (o === 'xylo') {
    const cols = ['#ff6b6b', '#ff9f43', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff'], bw = s * 0.2;
    ctx.rotate(-0.15);
    ctx.fillStyle = '#8a5a3b'; ctx.fillRect(-s * 0.68, -s * 0.22, s * 1.36, s * 0.08); ctx.fillRect(-s * 0.68, s * 0.2, s * 1.36, s * 0.08);
    cols.forEach((c, i) => {
      const x = -s * 0.55 + i * s * 0.22, h = s * (0.95 - i * 0.08), hop = Math.max(0, Math.sin(t * 6 - i * 0.9)) * s * 0.06;
      ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(x - bw / 2, -h / 2 + hop, bw, h, s * 0.05); ctx.fill();
    });
  } else if (o === 'tower') {
    const bs = s * 0.42;
    for (let i = 0; i < 3; i++) {
      ctx.save(); ctx.translate(Math.sin(t * 3 + i) * s * 0.03 * i, s * 0.45 - i * bs * 1.02); ctx.rotate((i - 1) * 0.08);
      ctx.fillStyle = BLOCK_COLORS[i * 2]; ctx.beginPath(); ctx.roundRect(-bs / 2, -bs, bs, bs, s * 0.07); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.translate(0, -bs / 2);
      if (i === 1) heartPath(bs * 0.25); else { starPath(5, bs * 0.28, bs * 0.12); ctx.fill(); }
      ctx.restore();
    }
  } else { ctx.rotate(t * 1.5); drawToy('ball', s * 0.85); }
  ctx.restore();
}

export function drawWish(b, x, y, sc0 = 1) {
  const w = b.wish, age = w.life - w.t;
  const appear = easeOutBack(clamp(age * 2.5, 0.01, 1)), fade = clamp(w.t / 1.2, 0, 1);
  const no = w.no || 0, s = 30 * S * sc0 * Math.max(0.01, appear) * (0.5 + 0.5 * fade) * (1 + Math.sin(t * 4 + b.phase) * 0.06);
  ctx.save(); ctx.globalAlpha = fade; ctx.translate(x + Math.sin(no * 30) * 7 * S * no, y + Math.sin(t * 2.2 + b.phase) * 4 * S);
  ctx.fillStyle = 'rgba(40,20,80,0.18)'; circle(s * 0.06, s * 0.1, s * 1.08);
  ctx.fillStyle = '#fff';
  circle(-s * 0.78, s * 1.05, s * 0.18); circle(-s * 1.08, s * 1.42, s * 0.11);
  circle(0, 0, s); circle(-s * 0.68, s * 0.18, s * 0.55); circle(s * 0.68, s * 0.18, s * 0.55); circle(-s * 0.38, -s * 0.58, s * 0.5); circle(s * 0.38, -s * 0.58, s * 0.5);
  drawWishIcon(w.k, s, w.o);
  ctx.restore();
}
