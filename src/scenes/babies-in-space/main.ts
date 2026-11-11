import { initAudio } from '../../core/audio';
import { H, S, TAU, W, advance, clamp, ctx, cv, dist, easeOutBack, pick, pointer, rand, resizeCanvas, t } from '../../core/canvas';
import { circle, drawButton } from '../../core/draw';
import { addP, drawParticles, updateParticles } from '../../core/particles';
import { houseAt, iconCanteen, iconHouse, iconNursery, launchHouse } from './buildings';
import { KL, traySlots } from './canteen';
import { Baby, tapBaby } from './characters';
import { RL } from './nursery';
import { LAY, roomHead, dragWish, drawRoom, drawTrans, dropBaby, enterRoom, exitRoom, hitRoom, hoverTarget, moveDrag, onRoomTap, startDrag, tapRoomBaby, updateRoom, updateTrans } from './room';
import { sfx, updLullaby } from './sounds';
import { bgC, bigStars, btn, buildBg, drawAlien, drawPlanet, drawRinged, drawShooting, drawStars, hit, iconMoonSun, iconRocket, iconSound, launchBaby, onTap, planet, ringed, tapPlanet, updateShooting } from './space';
import { G, MAX_BABIES, MAX_HOUSES, RB, babies, houses, picker } from './state';
import { drawToys, updateToys } from './toys';
import { drawWish, updateWishes, wishPos } from './wishes';

// ---------------- ЦИКЛ ----------------
function layout() {
  planet.x = W / 2; planet.y = H * 0.56; planet.r = Math.min(W * 0.2, 135 * S);
  ringed.x = W * 0.13; ringed.y = H * 0.2; ringed.r = 34 * S;
  const br = Math.max(38, 48 * S);
  Object.assign(btn.launch, { x: W - br - 24, y: H - br - 24, r: br });
  Object.assign(btn.house, { x: W - br * 3.4 - 24, y: H - br - 24, r: br });
  Object.assign(btn.night, { x: br + 24, y: H - br - 24, r: br });
  picker.opts.forEach((o, i) => Object.assign(o, { x: btn.house.x + (i ? 1 : -1) * br * 1.05, y: btn.house.y - br * 2.35, r0: br * 0.92 }));
  const sr = br * 0.55; Object.assign(btn.sound, { x: W - sr - 18, y: sr + 18, r: sr });
  for (const s of bigStars) { s.x = s.fx * W; s.y = s.fy * H; }
  for (const b of babies) {
    b.x = clamp(b.x, 0, W); b.y = clamp(b.y, 0, H); b.wTimer = 0;
    if (b.home) { const L = LAY(b.home); b.ix = clamp(b.ix, L.bx0, L.bx1); b.iy = clamp(b.iy, L.by0, L.by1); b.iwT = 0; }
  }
  for (const h of houses) { h.x = clamp(h.x, 0, W); h.y = clamp(h.y, 0, H); h.wTimer = 0; }
}

function resize() { resizeCanvas(); layout(); buildBg(); }

function update(dt) {
  G.night += (G.nightTarget - G.night) * Math.min(1, dt * 1.2);
  for (const b of babies) { if (b.home) b.updateIn(dt); else b.update(dt); }
  const sb = babies.filter(b => !b.home && !b.dragged);
  for (let i = 0; i < sb.length; i++) for (let j = i + 1; j < sb.length; j++) {
    const a = sb[i], b = sb[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, m = (a.hitR() + b.hitR()) * 0.85;
    if (d < m) { const f = (m - d) * 3 * dt; a.x -= dx / d * f; a.y -= dy / d * f; b.x += dx / d * f; b.y += dy / d * f; }
  }
  for (const h of houses) h.update(dt);
  for (let i = 0; i < houses.length; i++) for (let j = i + 1; j < houses.length; j++) {
    const a = houses[i], b = houses[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, m = 190 * S;
    if (d < m) { const f = (m - d) * 2 * dt; a.x -= dx / d * f; a.y -= dy / d * f; b.x += dx / d * f; b.y += dy / d * f; }
  }
  updateToys(dt); updateShooting(dt);
  planet.wob = Math.max(0, planet.wob - dt * 1.2); planet.laugh = Math.max(0, planet.laugh - dt); planet.alienT = Math.max(0, planet.alienT - dt);
  planet.wink = Math.max(0, planet.wink - dt); planet.hop = Math.max(0, planet.hop - dt); planet.fount = Math.max(0, planet.fount - dt);
  if (planet.fount > 0 && G.scene === 'space') for (let i = 0; i < 2; i++) addP({ kind: Math.random() < 0.3 ? 'heart' : 'spark', x: planet.x + rand(-0.15, 0.15) * planet.r, y: planet.y - planet.r * 0.95,
    vx: rand(-150, 150) * S, vy: -rand(280, 460) * S, life: rand(1.2, 1.8), size: rand(7, 11) * S, color: `hsl(${(t * 300 + rand(0, 60)) % 360},90%,72%)`, rot: rand(0, TAU), vr: rand(-5, 5), g: 420 });
  updateWishes(dt);
  if (picker.open) { picker.t += dt; if (picker.t > 8) picker.open = false; }
  planet.blinkT -= dt; if (planet.blinkT <= 0) { planet.blink = 0.18; planet.blinkT = rand(2.5, 5); } planet.blink = Math.max(0, planet.blink - dt);
  ringed.spinT = Math.max(0, ringed.spinT - dt * 0.8);
  if (G.scene === 'room') {
    updateRoom(dt);
    // малыши в комнате не слипаются
    const rb = G.curHouse.occupants().filter(b => !b.dragged && !b.crib && !b.chair && !b.ifall && !(b.play && b.play.phase === 'do' && (b.play.k === 'horse' || b.play.k === 'xylo'))), Lr = LAY(G.curHouse), m = RB() * 1.9;
    for (let i = 0; i < rb.length; i++) for (let j = i + 1; j < rb.length; j++) {
      const a = rb[i], b = rb[j], dx = b.ix - a.ix, dy = (b.iy - a.iy) * 2, d = Math.hypot(dx, dy) || 1;
      if (d < m) { const f = (m - d) * 2 * dt; a.ix -= dx / d * f; b.ix += dx / d * f; a.iy -= dy / d * f * 0.5; b.iy += dy / d * f * 0.5; }
    }
    for (const b of rb) { b.ix = clamp(b.ix, Lr.door.x + Lr.door.w * 0.5, W - 30 * S); b.iy = clamp(b.iy, Lr.by0, Lr.by1); }
  }
  if (G.scene === 'space' && G.nightTarget && Math.random() < dt * 0.8) addP({ kind: 'note', x: planet.x + rand(-planet.r, planet.r) * 0.6, y: planet.y - planet.r * 0.9, vx: rand(-15, 15) * S, vy: -40 * S, life: 2.5, size: rand(16, 24) * S, color: pick(['#ffe27a', '#c9a7ff', '#8fd3ff']), rot: 0, vr: 0, g: 0 });
  updateParticles(dt);
  updLullaby(); updateTrans(dt);
}

function draw() {
  if (G.scene === 'space') {
    ctx.drawImage(bgC, 0, 0, W, H);
    if (G.night > 0.01) { ctx.fillStyle = `rgba(5,3,25,${G.night * 0.45})`; ctx.fillRect(0, 0, W, H); }
    drawStars(); drawShooting(); drawRinged(); drawAlien(); drawPlanet();
    const hv = hoverTarget().house, wk = dragWish();
    for (const h of houses) h.draw(h === hv, wk && (wk === 'eat') === (h.kind === 'canteen'));
    for (const b of babies) if (!b.home && !b.dragged) b.draw();
    drawToys(); drawParticles();
    for (const b of babies) if (!b.home && b.dragged) b.draw();
    for (const b of babies) if (!b.home && b.wish) drawWish(b, ...(wishPos(b) as [number, number]));
    drawButton(btn.night, G.nightTarget ? '#ffb84d' : '#5b4bb7', iconMoonSun, false);
    drawButton(btn.house, '#2ec4b6', iconHouse, houses.length < MAX_HOUSES && !picker.open);
    if (picker.open) {
      const ap = easeOutBack(clamp(picker.t * 4, 0.01, 1));
      picker.opts.forEach(o => {
        o.r = o.r0 * Math.max(0.01, ap);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        for (let j = 1; j <= 2; j++) circle(btn.house.x + (o.x - btn.house.x) * j / 3.2, btn.house.y - btn.house.r * 0.9 + (o.y + o.r0 - btn.house.y + btn.house.r * 0.9) * j / 3.2, 5 * S * ap);
        drawButton(o, o.k === 'canteen' ? '#ff9f43' : '#2ec4b6', o.k === 'canteen' ? iconCanteen : iconNursery, true);
      });
    }
    drawButton(btn.launch, '#ff7aa8', iconRocket, babies.length < MAX_BABIES);
  } else {
    drawRoom(G.curHouse); drawParticles();
    for (const b of G.curHouse.occupants()) if (b.wish) drawWish(b, ...(wishPos(b) as [number, number]));
  }
  drawButton(btn.sound, G.scene === 'space' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.25)', iconSound, false);
  drawTrans();
}

let last = performance.now();
let paused = false; // только для тестов: заморозить кадр для скриншота (__game.pause)

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  // paused — для тестов: замереть на нужном кадре (__game.pause(true) или __game.paused = true)
  if (!paused && !(window as any).__game?.paused) { advance(dt); update(dt); }
  draw();
  if (pointer.moved) { pointer.moved = false; cv.style.cursor = G.drag && G.drag.moved ? 'grabbing' : (G.scene === 'space' ? hit : hitRoom)(pointer.x, pointer.y) ? 'pointer' : 'default'; }
  requestAnimationFrame(frame);
}

// ---------------- ВВОД ----------------
cv.addEventListener('pointerdown', e => {
  if (!G.started || G.trans) return;
  initAudio();
  const x = e.clientX, y = e.clientY; pointer.x = x; pointer.y = y;
  const h = G.scene === 'space' ? hit(x, y) : hitRoom(x, y);
  if (G.scene === 'space' && picker.open && !(h && (h.k === 'pick' || (h.k === 'btn' && (h.o === 'house' || h.o === 'sound'))))) { picker.open = false; sfx.boop(); return; }
  if (h && h.k === 'baby') { G.drag = { b: h.o, sx: x, sy: y, moved: false }; try { cv.setPointerCapture(e.pointerId); } catch (_) {} return; }
  if (G.scene === 'space') onTap(x, y, h); else onRoomTap(x, y, h);
});

cv.addEventListener('pointermove', e => {
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.moved = true;
  if (G.drag) {
    if (!G.drag.moved && dist(e.clientX, e.clientY, G.drag.sx, G.drag.sy) > 10) { G.drag.moved = true; startDrag(G.drag.b); }
    if (G.drag.moved) moveDrag(G.drag.b, e.clientX, e.clientY);
  }
  if (G.started && performance.now() - pointer.lastSpark > 35) {
    pointer.lastSpark = performance.now();
    addP({ kind: 'spark', x: e.clientX + rand(-4, 4), y: e.clientY + rand(-4, 4), vx: rand(-20, 20) * S, vy: rand(10, 40) * S, life: rand(0.4, 0.8), size: rand(3, 6) * S, color: pick(['#fff', '#ffe27a', '#c9e8ff', '#ffc4e1']), rot: rand(0, TAU), vr: rand(-4, 4), g: 0 });
  }
});

function endDrag(e) {
  if (!G.drag) return;
  const { b, moved } = G.drag; G.drag = null;
  if (!moved) { if (G.scene === 'space') tapBaby(b); else tapRoomBaby(b); }
  else dropBaby(b, e.clientX, e.clientY);
}

cv.addEventListener('pointerup', endDrag);

cv.addEventListener('pointercancel', endDrag);

cv.addEventListener('pointerleave', () => { if (!G.drag) { pointer.x = -9999; pointer.y = -9999; } });

// Старт: сначала убираем заставку и запускаем игру, звук — потом и «мягко» (ошибка звука не должна блокировать игру).
// Слушаем и pointerdown, и touchend/click — на старых мобильных браузерах pointer-событий может не быть.
function startGame(e?: Event) {
  if (G.started) return;
  if (e && e.cancelable) e.preventDefault();
  G.started = true;
  document.getElementById('start')!.classList.add('hide');
  initAudio();
  try { sfx.yay(); } catch (_) {}
}
for (const ev of ['pointerdown', 'touchend', 'click']) document.getElementById('start')!.addEventListener(ev, startGame);

addEventListener('resize', resize);

resize();

babies.push(
  new Baby('moon', W * 0.5, H * 0.14),
  new Baby('rocket', W * 0.2, H * 0.4),
  new Baby('suit', W * 0.8, H * 0.32),
  new Baby('suit', W * 0.32, H * 0.16),
  new Baby('ufo', W * 0.82, H * 0.72),
  new Baby('bubble', W * 0.18, H * 0.72),
);

requestAnimationFrame(frame);

// Ручка для автотестов (tests/*.spec.ts): шаг симуляции без реального времени и доступ к модулям.
(window as any).__game = {
  G, babies, houses, picker, planet, btn, paused: false,
  step(sec: number) { for (let i = 0; i < Math.round(sec * 60); i++) { advance(1 / 60); update(1 / 60); } draw(); },
  pause(on = true) { paused = on; },
  start() { G.started = true; document.getElementById('start')!.classList.add('hide'); },
  api: { launchBaby, launchHouse, enterRoom, exitRoom, tapBaby, tapPlanet, tapRoomBaby, onTap, onRoomTap, hit, hitRoom,
    startDrag, moveDrag, dropBaby, RL, KL, traySlots, houseAt, roomHead },
};
