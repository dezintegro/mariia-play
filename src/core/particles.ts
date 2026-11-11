// Частицы: сердечки, искорки, дым, конфетти, «z», нотки, большое сердце.
import { ctx, S, TAU, rand, pick, clamp } from './canvas';
import { circle, starPath, heartPath } from './draw';
export const particles: any[] = [];
export function addP(p: any) { p.max = p.life; particles.push(p); if (particles.length > 600) particles.shift(); }
export function burst(x: number, y: number, kind: string, n: number, o: any = {}) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), sp = rand(o.min || 40, o.speed || 160) * S;
    addP({ kind, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + (o.up || 0) * S, life: rand(0.7, o.life || 1.4),
      size: rand(0.7, 1.3) * (o.size || 10) * S, color: o.color || pick(['#ff7aa8', '#ffd66b', '#8fd3ff', '#a8e6a1', '#c9a7ff']),
      rot: rand(0, TAU), vr: rand(-6, 6), g: o.g || 0 });
  }
}
export function updateParticles(dt: number) {
  for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * S * dt; p.rot += p.vr * dt; p.life -= dt; }
  for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
}
export function drawParticles() {
  for (const p of particles) {
    const a = clamp(p.life / p.max, 0, 1);
    ctx.save(); ctx.translate(p.x, p.y); ctx.globalAlpha = a; ctx.fillStyle = p.color;
    if (p.kind === 'heart') { ctx.rotate(Math.sin(p.rot) * 0.3); heartPath(p.size); }
    else if (p.kind === 'spark') { ctx.rotate(p.rot); starPath(4, p.size, p.size * 0.35); ctx.fill(); }
    else if (p.kind === 'smoke') { ctx.globalAlpha = a * 0.45; circle(0, 0, p.size * (1 + (1 - a) * 1.5)); }
    else if (p.kind === 'bigheart') { const g = 1 + (1 - a) * 0.7; ctx.scale(g, g); heartPath(p.size); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 * S; ctx.stroke(); }
    else if (p.kind === 'confetti') { ctx.rotate(p.rot); ctx.fillRect(-p.size * 0.5, -p.size * 0.25, p.size, p.size * 0.5); }
    else if (p.kind === 'z' || p.kind === 'note') { ctx.font = `bold ${p.size}px "Comic Sans MS", "Chalkboard SE", sans-serif`; ctx.textAlign = 'center'; ctx.fillText(p.kind === 'z' ? 'z' : (p.n || (p.n = pick(['♪', '♫']))), 0, 0); }
    ctx.restore();
  }
}
