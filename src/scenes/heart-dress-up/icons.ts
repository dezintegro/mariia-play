// Значки вариантов и этапов: маленькие превью, рисуются в (0,0) радиусом r (уже обрезаны кругом).
import { TAU, ctx, t } from '../../core/canvas';
import { circle } from '../../core/draw';
import { STILL, drawHeart } from './heart';
import { BG_COLORS, G, Item, STAGES } from './state';
import { MINI_COLORS, balloon, bubble, butterfly, cloud, hillsPath, miniHeart, moon, rainbowArc, smallHeart, sparkleStar, stemFlower, sun } from './things';
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
export function stageIcon(i: number, r: number) {
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

