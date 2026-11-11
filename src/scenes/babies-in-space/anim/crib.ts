// «Спектакль» засыпания в кроватке: малыш сидит → зевает и тянется → трёт глазки кулачками →
// ложится головой на подушку → тянет одеяло от ножек до подбородка (ручка держит край) →
// глазки закрываются, мобиль замедляется, появляются «z». В конце — та же картинка, что и раньше
// (голова на подушке + одеяло), дальше рисует обычный drawCrib.
import { tone, whoosh } from '../../../core/audio';
import { S, ctx, t } from '../../../core/canvas';
import { circle, ell } from '../../../core/draw';
import { ease, lerp, phaseAt, phasesDur, type Phase } from '../../../core/tween';
import { drawAccessory, drawBody, drawHead, halo } from '../characters';
import { RL } from '../nursery';
import { RB } from '../state';
import { drawArmTo, drawHand } from './eat';

const BED: Phase[] = [['settle', 0.5], ['yawn', 1.3], ['rub', 1.0], ['lie', 0.9], ['blanket', 1.2], ['close', 0.7]];
export const BED_DUR = phasesDur(BED);

/** малыша положили в кроватку */
export function startBedtime(b: any) {
  b.bed = { T: 0, tapN: b.tapN, pi: -1 };
  b.awake = BED_DUR; b.laugh = 0; // пока идёт спектакль, малыш «не спит» (нет z, обычное лицо)
}

/** вызывается из Baby.tick каждый кадр */
export function tickBed(b: any, dt: number) {
  const B = b.bed; if (!B) return;
  // вытащили из кроватки или тапнули (тап — обычная реакция, засыпание прерывается)
  if (!b.crib || b.dragged || b.tapN !== B.tapN) { b.bed = null; return; }
  B.T += dt;
  const ph = phaseAt(B.T, BED);
  if (ph.done) { b.bed = null; b.awake = 0; b.zT = 0.25; return; }
  b.awake = Math.max(b.awake, BED_DUR - B.T);
  if (ph.i !== B.pi) {
    B.pi = ph.i;
    if (!b.visible()) return;
    if (ph.name === 'yawn') { tone(560, 0.55, { type: 'triangle', slide: 360, vol: 0.09, attack: 0.08 }); tone(360, 0.7, { type: 'sine', slide: 240, vol: 0.08, delay: 0.5, attack: 0.05 }); }
    else if (ph.name === 'rub') { for (let i = 0; i < 3; i++) tone(700 - i * 40, 0.12, { type: 'sine', slide: 600 - i * 40, vol: 0.04, delay: i * 0.28 }); }
    else if (ph.name === 'lie') tone(440, 0.6, { type: 'sine', slide: 260, vol: 0.07 });
    else if (ph.name === 'blanket') whoosh(0.8, 0.06);
    else if (ph.name === 'close') { tone(1047, 0.9, { vol: 0.05 }); tone(784, 1.1, { vol: 0.04, delay: 0.25 }); }
  }
}

// ---------- геометрия ----------
const LIE = -1.245; // поворот тела «лёжа» (голова на подушке слева)
function geo(b: any) {
  const k = S, L = RL(), c = L.cribs[b.crib.i], r = RB() * 0.8, L1 = r * 1.75;
  const pillow = [c.x - L.cw * 0.22, c.y - 72 * k];          // как в roomHead/drawCrib
  const hip = [pillow[0] - Math.sin(LIE) * L1, pillow[1] + Math.cos(LIE) * L1];
  return { k, L, c, r, L1, pillow, hip, mat: c.y - 50 * k };
}
function bodyAngle(name: string, p: number) {
  if (name === 'lie') return LIE * ease.inOut(p);
  if (name === 'blanket' || name === 'close') return LIE;
  if (name === 'settle') return Math.sin(p * Math.PI * 2) * 0.05;
  return 0;
}
function headRot(name: string, p: number) {
  if (name === 'lie') return -0.2 * ease.inOut(p);
  if (name === 'blanket' || name === 'close') return -0.2;
  if (name === 'yawn') return -0.12 * ease.hump(p);
  return 0;
}
/** где сейчас голова (экранные координаты) — для roomHead (тапы, пузырь желания) */
export function bedHead(b: any): [number, number] {
  const G0 = geo(b), ph = phaseAt(b.bed.T, BED), a = bodyAngle(ph.name, ph.p), sit = settleDy(G0.r, ph.name, ph.p);
  return [G0.hip[0] + Math.sin(a) * G0.L1, G0.hip[1] - Math.cos(a) * G0.L1 + sit];
}
function settleDy(r: number, name: string, p: number) { return name === 'settle' ? -ease.hump(p) * r * 0.25 : 0; }

// ---------- рисование (вызывается из drawCrib вместо головы+одеяла) ----------
export function drawBedtime(b: any) {
  const { k, L, c, r, L1, pillow, hip, mat } = geo(b), cw = L.cw;
  const ph = phaseAt(b.bed.T, BED), name = ph.name, p = ph.p;
  const a = bodyAngle(name, p), hr = headRot(name, p), sit = settleDy(r, name, p);
  const hx = hip[0] + Math.sin(a) * L1, hy = hip[1] - Math.cos(a) * L1 + sit;
  // подушка
  ctx.fillStyle = '#fff'; ell(pillow[0], mat - 12 * k, r * 1.1, r * 0.45);
  if (b.love > 0) halo(hx, hy, r * 2.4, b.love);
  // руки/ноги/лицо по фазам
  let wave = 0.3 + Math.sin(t * 2 + b.phase) * 0.1, mood = b.love > 0 ? 'love' : 'open', face: any = {}, rub = 0, stretch = 0;
  const legs = { legL: lerp(0.55, 0.15, a / LIE), legR: lerp(0.55, 0.15, a / LIE) };
  if (name === 'yawn') { stretch = ease.hump(Math.min(1, p * 1.15)); wave = -0.9; mood = 'blink'; face = { yawn: stretch }; }
  else if (name === 'rub') { wave = -0.9; mood = 'blink'; rub = 1; }
  else if (name === 'lie') { wave = 0.15; mood = p < 0.5 ? 'open' : 'blink'; }
  else if (name === 'blanket') { wave = 0.15; mood = (b.bed.T * 1.6) % 1 < 0.35 ? 'blink' : 'open'; }
  else if (name === 'close') { wave = 0.15; mood = p < 0.45 ? 'blink' : 'sleep'; }
  // тело (в координатах головы, повернуто вокруг попы)
  ctx.save(); ctx.translate(hip[0], hip[1] + sit); ctx.rotate(a); ctx.translate(0, -L1);
  drawBody(r, b, wave, wave, false, legs);
  ctx.restore();
  // потягушки: ручки вверх в стороны от головы (за головой)
  if (stretch > 0) {
    ctx.save(); ctx.translate(hx, hy);
    for (const s of [-1, 1] as const) {
      const wig = Math.sin(t * 9 + s) * r * 0.05 * stretch;
      drawArmTo(r, b, s, lerp(s * r * 0.75, s * r * 1.22, stretch), lerp(r * 1.55, -r * 0.3, stretch) + wig);
    }
    ctx.restore();
  }
  // кулачки трут глазки (рисуются поверх головы, см. ниже)
  const fists: [number, number][] = [];
  if (rub) {
    const e = ease.inOut(Math.min(1, p / 0.2, (1 - p) / 0.2));
    ctx.save(); ctx.translate(hx, hy);
    for (const s of [-1, 1] as const) {
      const ang = t * 14 * s + (s > 0 ? 1.4 : 0);
      const ex = s * r * 0.36 + Math.cos(ang) * r * 0.07, ey = -r * 0.02 + Math.sin(ang) * r * 0.06;
      const f: [number, number] = [lerp(s * r * 0.75, ex, e), lerp(r * 1.55, ey, e)];
      fists.push(f);
    }
    ctx.restore();
  }
  // голова
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(hr);
  drawHead(r, b, mood, { x: 0, y: 0 }, { noHair: b.type === 'moon', paci: b.type === 'bubble' && mood !== 'love' && name !== 'yawn', ...face });
  drawAccessory(r, b);
  ctx.restore();
  if (fists.length) {
    ctx.save(); ctx.translate(hx, hy);
    fists.forEach(([fx, fy], i) => drawArmTo(r, b, i ? 1 : -1, fx, fy, { fist: true }));
    ctx.restore();
  }
  // одеяло: край едет от ножек к подбородку, ручка держит край
  if (name === 'blanket' || name === 'close') {
    const bx = c.x + cw * 0.12, by = mat - 10 * k + Math.sin(t * 1.5) * 1.5 * k, rx = cw * 0.32, ry = 22 * k;
    const q = name === 'blanket' ? ease.inOut(p) : 1, xe = lerp(bx + rx, bx - rx - 2 * k, q);
    ctx.save(); ctx.beginPath(); ctx.rect(xe, by - ry * 2, rx * 3, ry * 4); ctx.clip();
    ctx.fillStyle = b.color; ell(bx, by, rx, ry);
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; for (const dx of [-0.1, 0.05, 0.2, 0.3]) circle(c.x + cw * dx, mat - 14 * k + (dx * 40 % 8) * k, 3.5 * k);
    // подгиб по краю
    ctx.beginPath(); ctx.ellipse(bx, by, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(xe, by - ry, 6 * k, ry * 2);
    if (q < 1) { ctx.fillStyle = 'rgba(60,30,80,0.15)'; ctx.fillRect(xe + 6 * k, by - ry, 3 * k, ry * 2); }
    ctx.restore();
    // ручка на краю одеяла (в конце прячется под одеяло)
    const dxn = (xe + 7 * k - bx) / rx, top = by - ry * Math.sqrt(Math.max(0, 1 - dxn * dxn));
    const fade = name === 'close' ? 1 - ease.inOut(p) : Math.min(1, q * 4);
    if (fade > 0.01) {
      ctx.save(); ctx.globalAlpha = fade; ctx.translate(xe + 7 * k, top + 4 * k + (name === 'close' ? p * 6 * k : 0));
      drawHand(r, b, 0, 0, true); drawHand(r, b, 10 * k, 3 * k, true);
      ctx.restore();
    }
  }
}
