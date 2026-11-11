import { BR, S, TAU, clamp, ctx, dist, easeOutBack, pick, rand, t } from '../../core/canvas';
import { circle, ell, heartPath } from '../../core/draw';
import { burst } from '../../core/particles';
import { sfx } from './sounds';
import { babies } from './state';

// ---------------- ИГРУШКИ ----------------
export const toys: any[] = [];

export const TOY_KINDS = ['bottle', 'rattle', 'ball', 'duck', 'teddy'];

export function drawToy(kind, s) {
  if (kind === 'bottle') {
    ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.roundRect(-s * 0.42, -s * 0.55, s * 0.84, s * 1.45, s * 0.3); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(-s * 0.42, -s * 0.55, s * 0.84, s * 0.4);
    ctx.fillStyle = '#7ec8ff'; ctx.fillRect(-s * 0.5, -s * 0.72, s, s * 0.24);
    ctx.fillStyle = '#ffb36b'; ell(0, -s * 0.92, s * 0.2, s * 0.24);
    ctx.fillStyle = '#ff9ec7'; circle(0, s * 0.3, s * 0.16);
  } else if (kind === 'rattle') {
    ctx.strokeStyle = '#ffcf4d'; ctx.lineWidth = s * 0.22; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, s * 0.2); ctx.lineTo(0, s * 1.0); ctx.stroke();
    ctx.fillStyle = '#ffcf4d'; circle(0, s * 1.05, s * 0.2);
    ctx.fillStyle = '#ff7aa8'; circle(0, -s * 0.3, s * 0.55);
    ctx.fillStyle = '#fff'; for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + t; circle(Math.cos(a) * s * 0.32, -s * 0.3 + Math.sin(a) * s * 0.32, s * 0.08); }
  } else if (kind === 'ball') {
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, s * 0.7, 0, TAU); ctx.clip();
    const cs = ['#ff5d73', '#ffd66b', '#8fd3ff', '#a8e6a1']; for (let i = 0; i < 4; i++) { ctx.fillStyle = cs[i]; ctx.fillRect(-s + i * s * 0.5, -s, s * 0.5, s * 2); }
    ctx.restore(); ctx.fillStyle = 'rgba(255,255,255,0.5)'; circle(-s * 0.25, -s * 0.28, s * 0.15);
  } else if (kind === 'duck') {
    ctx.fillStyle = '#ffd84d'; ell(0, s * 0.2, s * 0.75, s * 0.5); circle(s * 0.35, -s * 0.35, s * 0.38);
    ctx.fillStyle = '#ff9a3d'; ell(s * 0.78, -s * 0.3, s * 0.22, s * 0.1);
    ctx.fillStyle = '#2a1b3d'; circle(s * 0.45, -s * 0.45, s * 0.07);
    ctx.fillStyle = '#ffc21a'; ell(-s * 0.15, s * 0.1, s * 0.35, s * 0.2, -0.3);
  } else {
    ctx.fillStyle = '#c98b5a'; circle(-s * 0.42, -s * 0.5, s * 0.2); circle(s * 0.42, -s * 0.5, s * 0.2);
    ell(0, s * 0.45, s * 0.5, s * 0.45); circle(0, -s * 0.15, s * 0.45);
    ctx.fillStyle = '#f0d0a8'; ell(0, -s * 0.02, s * 0.2, s * 0.15); ell(0, s * 0.5, s * 0.28, s * 0.25);
    ctx.fillStyle = '#2a1b3d'; circle(-s * 0.17, -s * 0.25, s * 0.06); circle(s * 0.17, -s * 0.25, s * 0.06); circle(0, -s * 0.08, s * 0.06);
    ctx.fillStyle = '#ff7aa8'; ctx.save(); ctx.translate(0, s * 0.22); ctx.scale(s * 0.18, s * 0.18); heartPath(1); ctx.restore();
  }
}

export function spawnToy(x, y) {
  const free = toys.filter(z => !z.held && !z.released);
  if (free.length >= 4) { free[0].dead = true; }
  const toy = { x, y, kind: pick(TOY_KINDS), born: t, held: null, heldT: 0, released: false, alpha: 1, life: 12, vx: 0, vy: 0, rot: rand(-0.3, 0.3), dead: false };
  toys.push(toy);
  sfx.pop(); burst(x, y, 'spark', 10, { size: 7, speed: 120, color: '#fff7c2' });
  let best = null, bd = 1e9;
  for (const b of babies) {
    if (b.home || b.dragged || b.type === 'moon' || b.toy || b.target || t - b.born < 0.8) continue;
    const d = dist(b.x, b.y, x, y); if (d < bd) { bd = d; best = b; }
  }
  if (!best) for (const b of babies) { if (b.home || b.dragged || b.type === 'moon' || b.toy) continue; const d = dist(b.x, b.y, x, y); if (d < bd) { bd = d; best = b; } }
  if (best) { best.target = toy; best.awake = 6; }
}

export function updateToys(dt) {
  for (const z of toys) {
    if (z.held) {
      const b = z.held;
      z.x = b.x + b.face * BR * 1.4; z.y = b.y + BR * 0.4 + Math.sin(t * 1.6 + b.phase) * 6 * S;
      z.heldT += dt;
      if (z.heldT > 4.5) { z.held = null; b.toy = null; z.released = true; z.vx = rand(-60, 60) * S; z.vy = rand(-70, -30) * S; }
    } else if (z.released) {
      z.x += z.vx * dt; z.y += z.vy * dt; z.rot += dt * 1.5; z.alpha -= dt * 0.5; if (z.alpha <= 0) z.dead = true;
    } else {
      z.life -= dt; if (z.life < 1) z.alpha = Math.max(0, z.life); if (z.life <= 0) z.dead = true;
    }
  }
  for (let i = toys.length - 1; i >= 0; i--) if (toys[i].dead) { if (toys[i].held) toys[i].held.toy = null; toys.splice(i, 1); }
}

export function drawToys() {
  for (const z of toys) {
    const sc = easeOutBack(clamp((t - z.born) * 3, 0.01, 1));
    ctx.save(); ctx.globalAlpha = clamp(z.alpha, 0, 1);
    ctx.translate(z.x, z.y + (z.held ? 0 : Math.sin(t * 2 + z.born) * 5 * S)); ctx.rotate(z.rot + Math.sin(t * 1.5 + z.born) * 0.15); ctx.scale(sc, sc);
    if (!z.held) { ctx.fillStyle = 'rgba(255,250,200,0.18)'; circle(0, 0, BR * 1.3); }
    drawToy(z.kind, BR * 0.75);
    ctx.restore();
  }
}
