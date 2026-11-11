import { toggleSound, tone, whoosh } from '../../core/audio';
import { H, S, TAU, W, clamp, ctx, dist, pick, pointer, rand, t } from '../../core/canvas';
import { circle, ell, starPath } from '../../core/draw';
import { burst, particles } from '../../core/particles';
import { houseAt } from './buildings';
import { KL, chairOf, drawCanteen, feedFrom, hitCanteen, updateCanteen } from './canteen';
import { danceFx, drawRoomBaby, jumpFx } from './characters';
import { CHAIR_SEAT, HORSE_SEAT, RL, TOYS4, cribOf, drawBall, drawCrib, drawHorse, drawShelf, drawTower, drawXylo, hitNursery, hitXylo, horseAng, isRider, knockTower, startPlay, toyApproach, toyAt, toyBusy, toyCenter, updateNursery } from './nursery';
import { sfx } from './sounds';
import { btn, smallStars } from './space';
import { G, RB } from './state';
import { satisfy } from './wishes';

export function roomHead(b) {
  const r = RB();
  if (b.crib) { const L = RL(), c = L.cribs[b.crib.i]; return [c.x - L.cw * 0.22, c.y - 72 * S]; }
  if (b.chair) { const c = KL().chairs[b.chair.i]; return [c.x, c.y - CHAIR_SEAT() - 14 * S - r * 2.4]; }
  if (isRider(b)) {
    const p = RL().horse, a = horseAng(b.home), [lx, sy] = HORSE_SEAT(), ly = sy - r * 2.4;
    return [p.x + lx * Math.cos(a) - ly * Math.sin(a), p.y + lx * Math.sin(a) + ly * Math.cos(a)];
  }
  return [b.ix, b.iy - r * 2.4];
}

export const LAY = (h): any => h && h.kind === 'canteen' ? KL() : RL();

export function drawBubbles(R) {
  for (const q of R.bubbles) {
    ctx.fillStyle = 'rgba(200,230,255,0.15)'; circle(q.x, q.y, q.r);
    ctx.strokeStyle = `hsla(${(t * 80 + q.ph * 60) % 360},90%,75%,0.9)`; ctx.lineWidth = 2 * S; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; circle(q.x - q.r * 0.35, q.y - q.r * 0.35, q.r * 0.18);
  }
}

export function drawDark(L, R) {
  if (R.light) return;
  ctx.fillStyle = 'rgba(15,10,50,0.5)'; ctx.fillRect(0, 0, W, H);
  const w = L.win, g = ctx.createRadialGradient(w.x, w.y, 10 * S, w.x, w.y + 80 * S, 260 * S);
  g.addColorStop(0, 'rgba(150,170,255,0.18)'); g.addColorStop(1, 'rgba(150,170,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

export function glowSpot(x, y, r, a) {
  const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r); g.addColorStop(0, `rgba(255,240,150,${a})`); g.addColorStop(1, 'rgba(255,240,150,0)');
  ctx.fillStyle = g; circle(x, y, r);
}

export const hintA = () => 0.3 + Math.sin(t * 6) * 0.18;

export function dragWish() { const b = G.drag && G.drag.moved ? G.drag.b : null; return b && b.wish ? b.wish.k : null; }

export function updateRoom(dt) {
  const h = G.curHouse, R = h.room;
  R.starT = Math.max(0, R.starT - dt); R.doorOpen = Math.max(0, R.doorOpen - dt * 1.5); R.lampSwing = Math.max(0, R.lampSwing - dt * 0.6);
  for (const q of R.bubbles) { q.y += q.vy * dt; q.x += Math.sin(t * 2 + q.ph) * 25 * S * dt; q.life -= dt; }
  R.bubbles = R.bubbles.filter(q => q.life > 0 && q.y > -q.r);
  if (h.kind === 'canteen') updateCanteen(dt, h); else updateNursery(dt, h);
}

export function drawRoomBg(L, h) {
  const k = S;
  ctx.fillStyle = h.wall; ctx.fillRect(0, 0, W, L.fy);
  const g = ctx.createLinearGradient(0, 0, 0, L.fy); g.addColorStop(0, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0.04)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, L.fy);
  ctx.globalAlpha = 0.14; ctx.fillStyle = h.roof;
  const st = 70 * k;
  for (let y = st / 2, row = 0; y < L.fy; y += st, row++) for (let x = (row % 2 ? st / 2 : 0) + st / 4; x < W; x += st) {
    ctx.save(); ctx.translate(x, y); if ((row + Math.round(x / st)) % 2) starPath(5, 9 * k, 4 * k), ctx.fill(); else circle(0, 0, 5 * k); ctx.restore();
  }
  ctx.globalAlpha = 1;
  if (h.kind === 'canteen') {
    // кафельный пол в клеточку
    const q = 56 * k; ctx.fillStyle = '#eef8f3'; ctx.fillRect(0, L.fy, W, H - L.fy); ctx.fillStyle = '#c9ece0';
    for (let y = L.fy, r = 0; y < H; y += q, r++) for (let x = (r % 2) * q; x < W; x += q * 2) ctx.fillRect(x, y, q, q);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, L.fy - 12 * k, W, 14 * k);
    return;
  }
  ctx.fillStyle = '#e8c08c'; ctx.fillRect(0, L.fy, W, H - L.fy);
  ctx.strokeStyle = 'rgba(150,100,50,0.22)'; ctx.lineWidth = 2 * k;
  for (let y = L.fy + 36 * k, i = 0; y < H; y += 40 * k, i++) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    for (let x = (i % 2 ? 90 : 20) * k; x < W; x += 180 * k) { ctx.beginPath(); ctx.moveTo(x, y - 40 * k); ctx.lineTo(x, y); ctx.stroke(); }
  }
  ctx.fillStyle = '#fff'; ctx.fillRect(0, L.fy - 12 * k, W, 14 * k);
  const ry = (L.fy + H) / 2 + 15 * k, rx = Math.min(W * 0.32, 380 * k), rh = (H - L.fy) * 0.33;
  ctx.fillStyle = '#ffd6e7'; ell(W * 0.5, ry, rx, rh);
  ctx.fillStyle = '#ffeaf3'; ell(W * 0.5, ry, rx * 0.78, rh * 0.72);
  ctx.fillStyle = '#ffd6e7'; ell(W * 0.5, ry, rx * 0.5, rh * 0.45);
}

export function drawWindow(L, h) {
  const w = L.win, k = S, x0 = w.x - w.w / 2, y0 = w.y - w.h / 2, rad = [w.w * 0.3, w.w * 0.3, 10 * k, 10 * k];
  ctx.save(); ctx.beginPath(); ctx.roundRect(x0, y0, w.w, w.h, rad); ctx.clip();
  const g = ctx.createLinearGradient(0, y0, 0, y0 + w.h); g.addColorStop(0, '#1a1450'); g.addColorStop(1, '#3b2b80'); ctx.fillStyle = g; ctx.fillRect(x0, y0, w.w, w.h);
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 40; i++) { const s = smallStars[i]; ctx.globalAlpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph)); circle(x0 + s.fx * w.w, y0 + s.fy * w.h, s.s * k); }
  ctx.globalAlpha = 1;
  const pg = ctx.createRadialGradient(x0 + w.w * 0.75, y0 + w.h * 0.95, 5 * k, x0 + w.w * 0.8, y0 + w.h, 70 * k);
  pg.addColorStop(0, '#b9f7e6'); pg.addColorStop(1, '#2f8f90'); ctx.fillStyle = pg; circle(x0 + w.w * 0.8, y0 + w.h * 1.05, 70 * k);
  if (R0(h).starT > 0) {
    const p = 1 - R0(h).starT / 1.6, sx = x0 - 20 * k + p * (w.w + 40 * k), sy = y0 + 20 * k + p * w.h * 0.6;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3 * k; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - 50 * k, sy - 30 * k); ctx.stroke();
    ctx.save(); ctx.translate(sx, sy); ctx.fillStyle = '#fff6c8'; starPath(5, 8 * k, 3.5 * k); ctx.fill(); ctx.restore();
  }
  ctx.restore();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 10 * k; ctx.beginPath(); ctx.roundRect(x0, y0, w.w, w.h, rad); ctx.stroke();
  ctx.lineWidth = 6 * k; ctx.beginPath(); ctx.moveTo(w.x, y0); ctx.lineTo(w.x, y0 + w.h); ctx.moveTo(x0, w.y + 10 * k); ctx.lineTo(x0 + w.w, w.y + 10 * k); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.fillRect(x0 - 16 * k, y0 + w.h, w.w + 32 * k, 12 * k);
  ctx.fillStyle = h.roof; ctx.globalAlpha = 0.85;
  for (const s of [-1, 1]) {
    const cx = s < 0 ? x0 - 6 * k : x0 + w.w + 6 * k;
    ctx.beginPath(); ctx.moveTo(cx, y0 - 20 * k); ctx.lineTo(cx - s * 34 * k, y0 - 20 * k);
    ctx.quadraticCurveTo(cx - s * (20 + Math.sin(t * 1.5) * 4) * k, w.y, cx - s * 40 * k, y0 + w.h + 20 * k); ctx.lineTo(cx, y0 + w.h + 20 * k); ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#c98b5a'; ctx.fillRect(x0 - 60 * k, y0 - 26 * k, w.w + 120 * k, 8 * k);
}

export const R0 = h => h.room;

export function drawLamp(L, h) {
  const k = S, p = L.lamp, R = h.room, a = Math.sin(t * 4) * 0.25 * R.lampSwing;
  ctx.save(); ctx.translate(p.x, 0); ctx.rotate(a);
  ctx.strokeStyle = '#7a5a4a'; ctx.lineWidth = 3 * k; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, p.y - 30 * k); ctx.stroke();
  if (R.light) { const g = ctx.createRadialGradient(0, p.y + 5 * k, 5 * k, 0, p.y + 5 * k, 140 * k); g.addColorStop(0, 'rgba(255,240,170,0.55)'); g.addColorStop(1, 'rgba(255,240,170,0)'); ctx.fillStyle = g; circle(0, p.y + 5 * k, 140 * k); }
  ctx.fillStyle = R.light ? '#fff6b0' : '#d8d4c8'; circle(0, p.y + 8 * k, 13 * k);
  ctx.fillStyle = h.roof; ctx.beginPath(); ctx.moveTo(-14 * k, p.y - 32 * k); ctx.lineTo(14 * k, p.y - 32 * k); ctx.lineTo(42 * k, p.y + 4 * k); ctx.lineTo(-42 * k, p.y + 4 * k); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(-40 * k, p.y - 2 * k, 80 * k, 5 * k);
  ctx.restore();
}

export function drawDoor(L, h, hover) {
  const k = S, d = L.door, R = h.room, rad = [d.w / 2, d.w / 2, 0, 0];
  if (hover) { const g = ctx.createRadialGradient(d.x + d.w / 2, d.y + d.h / 2, 20 * k, d.x + d.w / 2, d.y + d.h / 2, d.h * 0.8); g.addColorStop(0, 'rgba(255,240,150,0.6)'); g.addColorStop(1, 'rgba(255,240,150,0)'); ctx.fillStyle = g; circle(d.x + d.w / 2, d.y + d.h / 2, d.h * 0.8); }
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(d.x - 9 * k, d.y - 9 * k, d.w + 18 * k, d.h + 9 * k, [d.w / 2 + 9 * k, d.w / 2 + 9 * k, 0, 0]); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.roundRect(d.x, d.y, d.w, d.h, rad); ctx.clip();
  ctx.fillStyle = '#1a1450'; ctx.fillRect(d.x, d.y, d.w, d.h);
  ctx.fillStyle = '#fff'; for (let i = 0; i < 14; i++) { const s = smallStars[60 + i]; circle(d.x + s.fx * d.w, d.y + s.fy * d.h, s.s * 1.3 * k); }
  ctx.restore();
  const open = Math.max(R.doorOpen, hover ? 0.6 : 0);
  ctx.save(); ctx.translate(d.x, 0); ctx.scale(1 - open * 0.78, 1);
  ctx.fillStyle = h.roof; ctx.beginPath(); ctx.roundRect(0, d.y, d.w, d.h, rad); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.beginPath(); ctx.roundRect(d.w * 0.15, d.y + d.h * 0.52, d.w * 0.7, d.h * 0.4, 10 * k); ctx.fill();
  ctx.fillStyle = '#2a2470'; circle(d.w / 2, d.y + d.w * 0.5, d.w * 0.22);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 5 * k; ctx.beginPath(); ctx.arc(d.w / 2, d.y + d.w * 0.5, d.w * 0.22, 0, TAU); ctx.stroke();
  ctx.save(); ctx.translate(d.w / 2, d.y + d.w * 0.5); ctx.rotate(t * 0.5); ctx.fillStyle = '#ffe27a'; starPath(5, d.w * 0.12, d.w * 0.05); ctx.fill(); ctx.restore();
  ctx.fillStyle = '#ffd66b'; circle(d.w * 0.82, d.y + d.h * 0.56, 8 * k);
  ctx.restore();
  // табличка-подсказка «туда — в космос»: мини-планета
  const px = d.x + d.w / 2, py = d.y - 34 * k + Math.sin(t * 2) * 3 * k;
  ctx.fillStyle = '#5fcab6'; circle(px, py, 15 * k);
  ctx.strokeStyle = '#ffd66b'; ctx.lineWidth = 4 * k; ctx.beginPath(); ctx.ellipse(px, py, 26 * k, 7 * k, -0.3, 0, TAU); ctx.stroke();
}

export function roomDropAt(x, y): any {
  const h = G.curHouse, L = LAY(h), d = L.door;
  if (x > d.x - 10 * S && x < d.x + d.w + 10 * S && y > d.y && y < d.y + d.h + 20 * S) return { door: true };
  if (h.kind === 'canteen') {
    for (let i = 0; i < 3; i++) { const c = L.chairs[i]; if (Math.abs(x - c.x) < 62 * S && y > c.y - 220 * S && y < c.y + 10 * S && !chairOf(h, i)) return { chair: i }; }
    return {};
  }
  for (let i = 0; i < 2; i++) { const c = L.cribs[i]; if (Math.abs(x - c.x) < L.cw / 2 && y > c.y - 140 * S && y < c.y && !cribOf(h, i)) return { crib: i }; }
  const k = toyAt(x, y, L, h); if (k && !toyBusy(h, k)) return { toy: k };
  return {};
}

export function hoverTarget(): any {
  if (!G.drag || !G.drag.moved) return {};
  if (G.scene === 'space') return { house: houseAt(pointer.x, pointer.y) };
  return roomDropAt(pointer.x, pointer.y);
}

export function drawRoom(h) {
  if (h.kind === 'canteen') { drawCanteen(h); return; }
  const L = RL(), R = h.room, hv = hoverTarget(), wk = dragWish();
  drawRoomBg(L, h); drawWindow(L, h); drawShelf(L, h); drawDoor(L, h, hv.door); drawLamp(L, h);
  // подсказки: куда можно положить малыша
  if (wk === 'sleep') L.cribs.forEach((c, i) => { if (!cribOf(h, i) && hv.crib !== i) glowSpot(c.x, c.y - 60 * S, L.cw * 0.8, hintA()); });
  if (wk === 'play') for (const k of TOYS4) if (!toyBusy(h, k) && hv.toy !== k) { const [x, y, r] = toyCenter(L, k, h); glowSpot(x, y, r, hintA()); }
  if (hv.toy) { const [x, y, r] = toyCenter(L, hv.toy, h); glowSpot(x, y, r * 1.1, 0.65); }
  const items = [
    { y: L.horse.y, d: () => drawHorse(L, h) },
    { y: L.tower.y, d: () => drawTower(L, h) },
    { y: L.xylo.y + 30 * S, d: () => drawXylo(L, h) },
    { y: R.ball.y, d: () => drawBall(h) },
  ];
  L.cribs.forEach((c, i) => items.push({ y: c.y, d: () => drawCrib(L, i, h, hv.crib === i) }));
  for (const b of h.occupants()) if (!b.crib && !b.dragged && !isRider(b)) items.push({ y: b.iy, d: () => drawRoomBaby(b) });
  items.sort((a, b) => a.y - b.y).forEach(it => it.d());
  drawBubbles(R); drawDark(L, R);
  for (const b of h.occupants()) if (b.dragged) drawRoomBaby(b);
}

export function hitRoom(x, y) {
  const h = G.curHouse, L = LAY(h), k = S;
  if (dist(x, y, btn.sound.x, btn.sound.y) < btn.sound.r * 1.1) return { k: 'btn', o: 'sound' };
  const occ = h.occupants().filter(b => !b.dragged).sort((a, b) => b.iy - a.iy);
  for (const b of occ) {
    const [hx, hy] = roomHead(b), r = RB();
    if (b.crib || b.chair || isRider(b) ? dist(x, y, hx, hy + r * 0.3) < r * 1.3 : dist(x, y, b.ix, b.iy - r * 1.4) < r * 1.5) return { k: 'baby', o: b };
  }
  const res = h.kind === 'canteen' ? hitCanteen(x, y) : hitNursery(x, y);
  if (res) return res;
  if (dist(x, y, L.lamp.x, L.lamp.y - 5 * k) < 50 * k) return { k: 'lamp' };
  const w = L.win; if (Math.abs(x - w.x) < w.w / 2 && Math.abs(y - w.y) < w.h / 2) return { k: 'window' };
  return null;
}

export function onRoomTap(x, y, hres) {
  const h = G.curHouse, R = h.room, L = LAY(h), k = S;
  if (!hres) {
    for (let i = 0; i < 4; i++) R.bubbles.push({ x: x + rand(-25, 25) * k, y: y + rand(-25, 25) * k, r: rand(12, 24) * k, vy: -rand(30, 60) * k, ph: rand(0, TAU), life: rand(6, 9) });
    tone(500, 0.25, { slide: 900, vol: 0.08 }); return;
  }
  switch (hres.k) {
    case 'btn': btn.sound.press = 1; if (toggleSound()) sfx.pop(); break;
    case 'bubble': { const q = R.bubbles.splice(hres.o, 1)[0]; sfx.pop(); burst(q.x, q.y, 'spark', 8, { size: 6, speed: 110, color: '#e6f4ff' }); break; }
    case 'door': exitRoom(); break;
    case 'crib': R.cribs[hres.o].spinV = 2; sfx.musicBox(); break;
    case 'xylo': hitXylo(R, L, hres.o, true); break;
    case 'tower': knockTower(R, L, true); break;
    case 'food': feedFrom(h, hres.o); break;
    case 'chair': R.chairs[hres.o].wob = 1; sfx.squeak(); break;
    case 'fridge': { R.fridge = 1.6; sfx.fridge(); const f = L.fridge; burst(f.x, f.y - f.h * 0.5, 'spark', 14, { size: 7, speed: 160, color: '#dff4ff' }); break; }
    case 'stove': R.pot = 1.2; sfx.bubbling(); break;
    case 'horse': R.horse = 1; sfx.clop(); break;
    case 'ball': R.ball.vz = 560 * k; R.ball.vx = rand(-280, 280) * k; sfx.boing(); break;
    case 'teddy': R.teddy = 1; sfx.squeak(); burst(L.teddy.x, L.teddy.y - 20 * k, 'heart', 6, { size: 8, speed: 100, up: -60, color: '#ff7aa8' }); break;
    case 'lamp': R.light = !R.light; R.lampSwing = 1; sfx.click(); break;
    case 'window': R.starT = 1.6; sfx.sparkle(); break;
  }
}

export function tapRoomBaby(b) {
  const n = b.tapN++ % 3, [hx, hy] = roomHead(b), seat = b.crib || b.chair || isRider(b);
  b.bounce = 1; b.awake = 3;
  if (n === 0) {
    b.laugh = 1.5; sfx.giggle(b.crib ? 1.15 : 1); if (!seat) b.anim = { k: 'flip', t: 0.9, d: 0.9 };
    burst(hx, hy, 'heart', 8, { size: 10, speed: 150, up: -60, color: pick(['#ff7aa8', '#ff5d73', '#ffb3d1']) });
  } else if (n === 1) danceFx(b, hx, hy);
  else jumpFx(b, hx, hy);
}

// ---------------- ПЕРЕХОДЫ И ПЕРЕТАСКИВАНИЕ ----------------
export function goTo(sc, house, fx, fy, tx, ty) { G.trans = { phase: 'out', p: 0, fx, fy, tx, ty, sc, house }; }

export function updateTrans(dt) {
  if (!G.trans) return;
  G.trans.p += dt / 0.45;
  if (G.trans.p >= 1) {
    if (G.trans.phase === 'out') { G.scene = G.trans.sc; G.curHouse = G.trans.house; particles.length = 0; G.trans.phase = 'in'; G.trans.p = 0; if (G.scene === 'space') { G.trans.tx = G.trans.house0.x; G.trans.ty = G.trans.house0.cy(); } }
    else G.trans = null;
  }
}

export function drawTrans() {
  if (!G.trans) return;
  const p = clamp(G.trans.p, 0, 1), e = p * p * (3 - 2 * p), M = Math.hypot(W, H), out = G.trans.phase === 'out';
  const r = out ? M * (1 - e) : M * e, cx = out ? G.trans.fx : G.trans.tx, cy = out ? G.trans.fy : G.trans.ty;
  ctx.fillStyle = '#120c35'; ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(cx, cy, Math.max(0.1, r), 0, TAU); ctx.fill('evenodd');
}

export function enterRoom(h) {
  h.door = 1; h.bounce = 1; sfx.dingdong();
  goTo('room', h, h.x, h.cy(), W * 0.5, H * 0.6);
}

export function exitRoom() {
  const h = G.curHouse, d = RL().door; h.room.doorOpen = 1;
  tone(300, 0.4, { type: 'triangle', slide: 520, vol: 0.12 });
  goTo('space', null, d.x + d.w / 2, d.y + d.h / 2, h.x, h.cy()); G.trans.house0 = h;
}

export function startDrag(b) {
  b.dragged = true; b.target = null; b.ifall = false; b.pose = null;
  if (b.toy) { const z = b.toy; z.held = null; z.released = true; z.vx = rand(-60, 60) * S; z.vy = -50 * S; b.toy = null; }
  b.crib = null; b.chair = null; b.play = null; b.eat = null; b.eatPending = false;
  sfx.pick();
}

export function moveDrag(b, x, y) {
  if (G.scene === 'space') { b.x = x; b.y = y; }
  else { b.ix = x; b.iy = y + RB() * 1.4; }
}

export function dropBaby(b, x, y) {
  b.dragged = false;
  if (G.scene === 'space') {
    const h = houseAt(x, y);
    if (h) {
      b.home = h; b.crib = null; b.target = null;
      const L = RL(); b.ix = L.door.x + L.door.w + rand(40, 120) * S; b.iy = L.fy + rand(70, 140) * S; b.iwT = 0; b.ifall = false;
      h.bounce = 1; h.door = 1; sfx.dingdong(); burst(h.x, h.cy(), 'heart', 10, { size: 9, speed: 140, up: -60, color: '#ff7aa8' });
    } else { b.vx = 0; b.vy = 0; b.wTimer = 0.6; b.bounce = 1; sfx.boop(); }
    return;
  }
  const h = G.curHouse, L = LAY(h), d = L.door, tg = roomDropAt(x, y);
  if (tg.door) {
    b.home = null; b.crib = null; b.chair = null; b.play = null; b.eat = null;
    b.x = h.x; b.y = h.cy() + 40 * S; const a = rand(0, TAU); b.vx = Math.cos(a) * 320 * S; b.vy = Math.sin(a) * 320 * S;
    b.wTimer = 1.2; b.born = t; b.laugh = 1.2; b.awake = 3;
    h.room.doorOpen = 1; whoosh(0.7, 0.2); sfx.yay(); burst(d.x + d.w / 2, d.y + d.h / 2, 'spark', 18, { size: 8, speed: 200, color: '#fff7c2' });
    return;
  }
  if (tg.crib != null) { const i = tg.crib; b.crib = h.room.cribs[i]; b.awake = 0; b.laugh = 0; h.room.cribs[i].spinV = 1.5; sfx.musicBox(); satisfy(b, 'sleep'); return; }
  if (tg.chair != null) {
    const i = tg.chair, c = L.chairs[i]; b.chair = h.room.chairs[i]; b.ix = c.x; b.iy = c.y; h.room.chairs[i].wob = 0.6;
    b.laugh = 0.8; b.bounce = 1; sfx.pick(); tone(880, 0.2, { type: 'triangle', vol: 0.1, delay: 0.12 }); return;
  }
  if (tg.toy) {
    if (tg.toy === 'ball' || tg.toy === 'tower') [b.ix, b.iy] = toyApproach(L, tg.toy, h);
    startPlay(b, tg.toy); return;
  }
  b.ifloor = clamp(b.iy, L.by0, L.by1); b.ix = clamp(b.ix, 30 * S, W - 30 * S);
  if (b.iy < b.ifloor) { b.ifall = true; b.ivy = 0; } else { b.iy = b.ifloor; b.bounce = 1; }
  b.iwx = b.ix; b.iwy = b.ifloor; b.iwT = rand(2, 4);
}
