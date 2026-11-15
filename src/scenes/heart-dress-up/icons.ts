// Значки вариантов и этапов: маленькие превью, рисуются в (0,0) радиусом r (уже обрезаны кругом).
import { TAU, ctx, t } from '../../core/canvas';
import { circle } from '../../core/draw';
import { STILL, drawHeart } from './heart';
import { careIcon, careStageIcon } from './care';
import { stageIcon } from './stageicons';
import { BG_COLORS, G, Item, STAGES } from './state';
import { MINI_COLORS, balloon, bubble, butterfly, castle, cloud, duck, fish, garland, hillsPath, kitten, miniHeart, moon, rainbowArc, sea, smallHeart, sparkleStar, stemFlower, sun, tree } from './things';
import { FISH_COLS } from './world';
// ---------------- ЗНАЧКИ ----------------
const ZOOM: Record<string, [number, number, number]> = {
  color: [0, -0.05, 0.52], eyes: [0, -0.12, 1.3], lashes: [0, -0.22, 1.15], nose: [0, 0.08, 1.9], mouth: [0, 0.28, 3.1], cheeks: [0, 0.02, 1.3],
  hair: [0, -0.5, 0.68], earrings: [-0.8, 0.17, 1.85], necklace: [0, 0.6, 1.3],
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
  else if (k === 'kitten') kitten(-r * 0.05, r * 0.82, r * 0.38, { look: 0.5 });
  else if (k === 'fish') { bubble(r * 0.5, -r * 0.45, r * 0.1); bubble(r * 0.62, -r * 0.2, r * 0.07); fish(-r * 0.05, r * 0.05, r * 0.42, FISH_COLS[0], 1, -0.1); }
  else if (k === 'duck') duck(-r * 0.12, r * 0.6, r * 0.62, 1, 0.5);
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
  else if (k === 'castle') castle(0, r * 0.82, r * 0.5, 0, 0);
  else if (k === 'tree') { ctx.fillStyle = '#9fe08a'; hillsPath(-r, r, r * 0.7, r, r * 0.05, 0.8); ctx.fill(); tree(0, r * 0.78, r * 0.48, 0, [1, 1, 1, 1, 1]); }
  else if (k === 'sea') { sea(-r, r, r * 0.05, r, r * 0.07, 0.6); ctx.fillStyle = '#fff'; }
  else if (k === 'garland') garland(-r, r, -r * 0.35, r * 0.18, r * 0.26, 0);
  else if (k === 'moon') { moon(-r * 0.1, r * 0.05, r * 0.42, 0); ctx.fillStyle = '#fff6c0'; circle(r * 0.5, -r * 0.45, r * 0.06); circle(r * 0.55, r * 0.35, r * 0.05); }
}
function colorIcon(k: string, r: number) { iconBgFill(r); heartIcon('color', { ...G.cfg, color: k, hair: null, earrings: null, necklace: null }, r); }

/** Значок варианта (рисуется в (0,0), радиус r, уже обрезан кругом) */
export function itemIcon(id: string, it: Item, r: number) {
  if (it.kind === 'care') return careIcon(id, it.k as string, r);
  if (it.kind === 'camera') { const g = ctx.createLinearGradient(0, -r, 0, r); g.addColorStop(0, '#8fd0ff'); g.addColorStop(1, '#4a9df0'); ctx.fillStyle = g; circle(0, 0, r); iconCamera(r * 1.15); return; }
  if (it.kind === 'photo') { ctx.fillStyle = '#ffeef6'; circle(0, 0, r); const p = G.album.find(q => String(q.id) === it.k); if (p) { ctx.save(); ctx.rotate(-0.08); photoFrame(p.cfg, r * 0.52); ctx.restore(); } return; }
  if (it.kind === 'none') { ctx.fillStyle = '#fff4f9'; circle(0, 0, r); noneIcon(r); return; }
  if (id === 'env') return envIcon(it.k, r);
  if (id === 'bg' || id === 'land') return bgIcon(it, r);
  if (id === 'color') return colorIcon(it.k, r);
  iconBgFill(r);
  heartIcon(id, { ...G.cfg, [id]: it.k }, r);
}

/** Значок раздела на ленте: сама деталь крупно (у каждого раздела свой силуэт — не путаются);
 *  «украшено» показывает зелёная звёздочка (ui.ts), а не превью выбранного: превью разделов выходят одинаковыми */
export function stageIconFor(i: number, r: number) {
  const st = STAGES[i];
  if (st.care) return careStageIcon(st.id, r);
  if (st.id === 'album') return albumIcon(r);
  return stageIcon(i, r);
}

// ---------------- АЛЬБОМ ----------------
/** Фото-полароид с сердцем в (0,0); R — радиус сердца на фото */
export function photoFrame(cfg: Record<string, any>, R: number) {
  const w = R * 2.7, h = R * 3.05, top = -h / 2;
  ctx.fillStyle = 'rgba(80,20,50,0.25)'; ctx.beginPath(); ctx.roundRect(-w / 2 + R * 0.06, top + R * 0.08, w, h, R * 0.12); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(-w / 2, top, w, h, R * 0.12); ctx.fill();
  const iw = w - R * 0.3, ih = R * 2.35, ix = -iw / 2, iy = top + R * 0.15;
  ctx.save(); ctx.beginPath(); ctx.rect(ix, iy, iw, ih); ctx.clip();
  const [c0, c1] = BG_COLORS[cfg.bg] || BG_COLORS.pink, g = ctx.createLinearGradient(0, iy, 0, iy + ih); g.addColorStop(0, c0); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.fillRect(ix, iy, iw, ih);
  ctx.translate(0, iy + ih * 0.56); drawHeart(cfg, R * 0.78, STILL);
  ctx.restore();
}
/** Значок альбома: два полароида веером, на верхнем — последнее фото */
function albumIcon(r: number) {
  ctx.fillStyle = '#fff4f9'; circle(0, 0, r);
  const last = G.album[0];
  ctx.save(); ctx.rotate(-0.25); ctx.translate(-r * 0.12, r * 0.02);
  ctx.fillStyle = 'rgba(80,20,50,0.2)'; ctx.fillRect(-r * 0.36, -r * 0.42, r * 0.76, r * 0.88);
  ctx.fillStyle = '#ffe1ef'; ctx.fillRect(-r * 0.38, -r * 0.44, r * 0.76, r * 0.86); ctx.restore();
  ctx.save(); ctx.rotate(0.15); ctx.translate(r * 0.1, 0);
  if (last) photoFrame(last.cfg, r * 0.27);
  else { ctx.fillStyle = '#fff'; ctx.fillRect(-r * 0.36, -r * 0.42, r * 0.72, r * 0.84); ctx.fillStyle = '#ffe6f2'; ctx.fillRect(-r * 0.3, -r * 0.36, r * 0.6, r * 0.56); smallHeart(0, -r * 0.08, r * 0.2, '#ff4d6d'); }
  ctx.restore();
}
/** Фотоаппарат (белый, для цветной кнопки) */
export function iconCamera(R: number) {
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(-R * 0.5, -R * 0.28, R, R * 0.66, R * 0.12); ctx.fill();
  ctx.beginPath(); ctx.roundRect(-R * 0.18, -R * 0.42, R * 0.36, R * 0.2, R * 0.05); ctx.fill();
  ctx.fillStyle = '#2c69c9'; circle(0, R * 0.05, R * 0.24); ctx.fillStyle = '#9fd0ff'; circle(0, R * 0.05, R * 0.15);
  ctx.fillStyle = '#fff'; circle(-R * 0.05, 0, R * 0.05); ctx.fillStyle = '#ff5c9a'; circle(R * 0.36, -R * 0.15, R * 0.06);
}
