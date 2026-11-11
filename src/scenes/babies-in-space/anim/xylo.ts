// Спектакль «малыш играет на ксилофоне»:
//   reach   — тянется правой ручкой к палочке, что лежит справа от ксилофона;
//   grab    — берёт её (тук);
//   ready   — садится к середине, заносит палочку над первой пластинкой;
//   n0..n8  — мелодия: замах → удар (кончик палочки попадает в ту самую пластинку, она проседает,
//             звучит нота, вылетают искорки) → отскок; голова кивает в такт, тело ездит к нужной пластинке;
//             на левой половине ксилофона палочка переходит в левую руку (и обратно);
//   putback — кладёт палочку на место;  release — отпускает;  clap — хлопает в ладошки и смеётся.
// Всё — функция времени от начала игры, поэтому шаги теста (step) дают ту же картинку, что и живой показ.
import { S, TAU, ctx, rand } from '../../../core/canvas';
import { circle } from '../../../core/draw';
import { addP, burst } from '../../../core/particles';
import { ease, lerp, phaseAt, phasesDur, type Phase } from '../../../core/tween';
import { armHand } from '../characters';
import { hitXylo, xyloBars } from '../nursery';
import { sfx } from '../sounds';
import { RB } from '../state';
import { ARM, type Body, type Pt, armWave, bodyForHand, bodyLocal, clapSfx, clapWave, lerpAng, rigScale, rigWorld, setPose, shoulder } from './rig';

/** мелодия: номера пластинок (0 — левая, длинная) */
export const XSEQ = [5, 4, 3, 2, 1, 0, 2, 4, 5];
const sideOf = (bar: number): -1 | 1 => (bar >= 3 ? 1 : -1);
const ND = 0.45, NSW = 0.75; // длительность обычной ноты и ноты со сменой руки
const noteDur = (k: number) => (k > 0 && sideOf(XSEQ[k]) !== sideOf(XSEQ[k - 1]) ? NSW : ND);
const STRIKE = 0.09, REB = 0.14; // удар и отскок; остальное в начале ноты — замах

export const XPHASES: Phase[] = [
  ['reach', 0.7], ['grab', 0.3], ['ready', 0.45],
  ...XSEQ.map((_, k) => [`n${k}`, noteDur(k)] as Phase),
  ['putback', 0.7], ['release', 0.2], ['clap', 1.4],
];
export const XDUR = phasesDur(XPHASES);

/** длина палочки от ладошки до центра шарика */
const LM = () => 56 * S;
const MALLET_ANG = -0.22;

/** где лежит палочка (ладошка-хват и шарик) */
export function malletRest(L): { g: Pt; tip: Pt; ang: number } {
  const p = L.xylo, g: Pt = [p.x + p.w / 2 + 18 * S, p.y - 36 * S];
  return { g, tip: [g[0] + Math.cos(MALLET_ANG) * LM(), g[1] + Math.sin(MALLET_ANG) * LM()], ang: MALLET_ANG };
}

/** куда подползает малыш (сразу к палочке) */
export function xyloSpot(L): Pt { const p = L.xylo; return [p.x + p.w / 2 - 9 * S, p.y - 24 * S]; }

// ---------- геометрия руки с палочкой ----------
interface Cfg { side: -1 | 1; wave: number; ang: number }

/** обратная кинематика: какая рука/угол палочки, чтобы кончик был в точке tipW */
function solve(B: Body, side: -1 | 1, tipW: Pt): Cfg {
  const T = bodyLocal(B, tipW[0], tipW[1]), S0 = shoulder(side), la = ARM(), lm = LM();
  const vx = T[0] - S0[0], vy = T[1] - S0[1], d = Math.hypot(vx, vy) || 1, ux = vx / d, uy = vy / d;
  let hx: number, hy: number;
  if (d >= la + lm) { hx = S0[0] + ux * la; hy = S0[1] + uy * la; } // не дотянуться — рука вытянута к цели
  else if (d <= lm - la) { hx = S0[0] - ux * la; hy = S0[1] - uy * la; } // слишком близко — рука от цели
  else {
    const a = (la * la - lm * lm + d * d) / (2 * d), h = Math.sqrt(Math.max(0, la * la - a * a));
    // всегда одна и та же «ветка»: ладошка снаружи/сверху от линии плечо→кончик (без перескоков)
    hx = S0[0] + ux * a + side * uy * h; hy = S0[1] + uy * a - side * ux * h;
  }
  return { side, wave: armWave(side, hx - S0[0], hy - S0[1]), ang: Math.atan2(T[1] - hy, T[0] - hx) };
}
const mixCfg = (a: Cfg, b: Cfg, p: number): Cfg => ({ side: b.side, wave: lerpAng(a.wave, b.wave, p), ang: lerpAng(a.ang, b.ang, p) });
/** рука с палочкой у груди — для передачи в другую руку */
const handoff = (side: -1 | 1): Cfg => ({ side, wave: armWave(side, -side * 0.75, 0.66), ang: Math.PI / 2 }); // палочка смотрит вниз, лицо не закрывает

// ---------- точки на ксилофоне ----------
/** куда попадает кончик палочки на пластинке i */
function strikePt(L, i: number): Pt { const b = xyloBars(L)[i]; return [b.x, b.y - b.h * 0.18]; }
const PLAY_DY = () => 4 * S;
function noteBody(L, iy: number, k: number): Body {
  const b = xyloBars(L)[XSEQ[k]];
  return { ix: L.xylo.x + (b.x - L.xylo.x) * 0.38, iy, dy: PLAY_DY() };
}
/** для ноты k: удар (кончик точно на пластинке), замах (ручка выше, палочка поднята вбок), отскок */
function noteCfgs(L, iy: number, k: number) {
  const bar = XSEQ[k], side = sideOf(bar), hit = solve(noteBody(L, iy, k), side, strikePt(L, bar));
  const up: Cfg = { side, wave: hit.wave + 0.5, ang: side > 0 ? -0.6 : -Math.PI + 0.6 }; // палочка поднята вверх-наружу
  return { hit, up, reb: mixCfg(hit, up, 0.3) };
}
const mixBody = (a: Body, b: Body, p: number): Body => ({ ix: lerp(a.ix, b.ix, p), iy: b.iy, dy: lerp(a.dy || 0, b.dy || 0, p), lean: lerp(a.lean || 0, b.lean || 0, p) });

/** время удара каждой ноты от начала игры */
const HIT_T = (() => {
  const out: number[] = []; let acc = 0.7 + 0.3 + 0.45;
  XSEQ.forEach((_, k) => { const d = noteDur(k); out.push(acc + d - STRIKE - REB + STRIKE); acc += d; });
  return out;
})();

export function xyloStart(b, L) {
  const P = b.play;
  P.d = P.t = XDUR; P.x0 = b.ix; P.hitN = 0; P.clapN = 0; P.grabbed = false; P.put = false;
  b.iy = xyloSpot(L)[1];
}

/** один кадр игры на ксилофоне */
export function xyloUpdate(b, L) {
  const P = b.play, R = b.home.room, vis = b.visible(), at = P.d - P.t, iy = xyloSpot(L)[1];
  const ph = phaseAt(at, XPHASES), rest = malletRest(L);
  const pick = bodyForHand(1, [0.45, 0.89], rest.g, iy);
  const pickB: Body = { ix: pick.ix, iy, dy: pick.dy }, pickC: Cfg = { side: 1, wave: pick.wave, ang: rest.ang };
  const startB: Body = { ix: P.x0, iy, dy: 0 };
  let B: Body = pickB, cfg: Cfg | null = null, held = false, idle = 0.25 + Math.sin(at * 5) * 0.08;
  let armR: number | null = null, armL: number | null = null, headTilt = 0, mood: string | undefined, other: number | null = null;
  P.ph = ph.name;

  if (ph.name === 'reach') {
    const e = ease.inOut(ph.p); B = mixBody(startB, pickB, e); armR = lerp(0.3, pick.wave, e); headTilt = 0.12 * e;
  } else if (ph.name === 'grab') {
    B = { ...pickB, dy: pickB.dy! + ease.hump(ph.p) * 3 * S }; armR = pick.wave; headTilt = 0.12;
    if (!P.grabbed && ph.p > 0.4) { P.grabbed = true; if (vis) sfx.pick(); }
  } else if (ph.name === 'ready') {
    const e = ease.inOut(ph.p), nb = noteBody(L, iy, 0);
    B = mixBody(pickB, nb, e); held = true;
    cfg = mixCfg(pickC, noteCfgs(L, iy, 0).up, e);
    headTilt = 0.12 * (1 - e);
  } else if (ph.name[0] === 'n') {
    const k = ph.i - 3, side = sideOf(XSEQ[k]), d = noteDur(k), u = ph.p * d;
    const nb = noteBody(L, iy, k), wEnd = d - STRIKE - REB, C = noteCfgs(L, iy, k);
    const prevK = Math.max(0, k - 1), pb = noteBody(L, iy, prevK), prev = k === 0 ? C.up : noteCfgs(L, iy, prevK).reb;
    held = true;
    if (u < wEnd) { // замах (и переезд к следующей пластинке)
      const e = ease.inOut(u / wEnd); B = mixBody(pb, nb, e);
      if (d === NSW) { // смена руки: палочку к животику → в другую ручку → замах
        const s0 = sideOf(XSEQ[prevK]);
        if (e < 0.5) { const q = ease.inOut(e * 2); cfg = mixCfg(prev, handoff(s0), q); other = lerp(idle, handoff(side).wave, q); }
        else { const q = ease.inOut((e - 0.5) * 2); cfg = mixCfg(handoff(side), C.up, q); other = lerp(handoff(s0).wave, idle, q); }
      } else cfg = mixCfg(prev, C.up, e);
      headTilt = -0.07 * Math.sin(e * Math.PI);
    } else if (u < wEnd + STRIKE) { // удар: к концу фазы кончик ровно на пластинке
      const e = ease.in((u - wEnd) / STRIKE); B = nb; cfg = mixCfg(C.up, C.hit, e);
      headTilt = 0.1 * e; // кивок в момент удара
    } else { // отскок
      const e = ease.out((u - wEnd - STRIKE) / REB); B = { ...nb, dy: nb.dy! + ease.hump(e) * 3 * S }; cfg = mixCfg(C.hit, C.reb, e);
      headTilt = 0.1 * (1 - e);
    }
    // лёгкое покачивание в такт (только голова — руки остаются точными)
    headTilt += Math.sin(at * Math.PI / ND) * 0.06;
    mood = ph.p > 0.75 && k === XSEQ.length - 1 ? 'laugh' : undefined;
  } else if (ph.name === 'putback') {
    const e = ease.inOut(ph.p), lk = XSEQ.length - 1, lb = noteBody(L, iy, lk);
    B = mixBody(lb, pickB, e); held = true;
    cfg = mixCfg(noteCfgs(L, iy, lk).reb, pickC, e);
    headTilt = 0.12 * e;
  } else if (ph.name === 'release') {
    const e = ease.inOut(ph.p); B = mixBody(pickB, { ix: pickB.ix - 26 * S, iy, dy: 0 }, e); armR = lerp(pick.wave, 0.6, e); // отползает от палочки
    if (!P.put) { P.put = true; if (vis) sfx.boop(); }
  } else { // clap
    const k = ph.p * 3.2; B = { ix: pickB.ix - 26 * S, iy, dy: -Math.abs(Math.sin(ph.p * Math.PI * 3)) * 8 * S };
    armL = armR = clapWave(k + 0.5); mood = 'laugh';
    if (P.clapN < Math.floor(k + 0.5) && P.clapN < 3) {
      P.clapN++;
      if (vis) {
        clapSfx(1 + P.clapN * 0.08); if (P.clapN === 1) sfx.giggle(1.1);
        const [hx, hy] = rigWorld(b, 0, RB() * 1.1);
        burst(hx, hy, 'spark', 5, { size: 6, speed: 110, color: '#fff7c2' });
      }
    }
  }

  // удары по пластинкам — ровно в момент касания
  while (P.hitN < XSEQ.length && at >= HIT_T[P.hitN]) {
    const bar = XSEQ[P.hitN++]; hitXylo(R, L, bar, vis);
    if (vis) {
      const bb = xyloBars(L)[bar];
      addP({ kind: 'note', x: bb.x + rand(-8, 8) * S, y: bb.y - bb.h / 2 - 10 * S, vx: rand(-20, 20) * S, vy: -rand(60, 90) * S, life: 1.2, size: rand(18, 24) * S, color: ['#ff6b6b', '#ff9f43', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff'][bar], rot: 0, vr: 0, g: 0 });
      if (P.hitN === XSEQ.length) burst(bb.x, bb.y - bb.h / 2, 'spark', 10, { size: 8, speed: 160, color: '#ffe27a' });
    }
  }

  // поза
  if (cfg) {
    if (cfg.side > 0) { armR = cfg.wave; armL = other ?? idle; } else { armL = cfg.wave; armR = other ?? idle; }
  }
  setPose(b, { armL: armL ?? idle, armR: armR ?? idle, dx: B.ix - b.ix, dy: B.dy || 0, lean: B.lean || 0, headTilt, mood, legL: 0.25, legR: 0.25 });

  // палочка в руке — в мировых координатах (рисуется поверх ксилофона)
  if (held && cfg) {
    const [hx, hy] = armHand(RB(), cfg.side, cfg.wave), lm = LM();
    const g = rigWorld(b, hx, hy), tip = rigWorld(b, hx + Math.cos(cfg.ang) * lm, hy + Math.sin(cfg.ang) * lm);
    P.xm = { g, tip, skin: b.skin, k: rigScale(b) };
  } else P.xm = null;
}

/** держит ли кто-то палочку в этой комнате */
function heldMallet(h) {
  for (const b of h.occupants()) if (b.play && b.play.k === 'xylo' && b.play.phase === 'do' && b.play.xm && !b.dragged) return b.play.xm;
  return null;
}

/** палочка: лежит на полу или в ладошке малыша (вызывается из drawXylo после пластинок) */
export function drawMallet(L, h) {
  const m = heldMallet(h), k = S;
  const g = m ? m.g : malletRest(L).g, tip = m ? m.tip : malletRest(L).tip;
  const dx = tip[0] - g[0], dy = tip[1] - g[1], n = Math.hypot(dx, dy) || 1;
  if (!m) { ctx.fillStyle = 'rgba(80,40,20,0.15)'; ctx.beginPath(); ctx.ellipse((g[0] + tip[0]) / 2, (g[1] + tip[1]) / 2 + 8 * k, n * 0.55, 5 * k, Math.atan2(dy, dx), 0, TAU); ctx.fill(); }
  ctx.strokeStyle = '#c98b5a'; ctx.lineWidth = 5 * k; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(g[0] - dx / n * 10 * k, g[1] - dy / n * 10 * k); ctx.lineTo(tip[0], tip[1]); ctx.stroke();
  ctx.fillStyle = '#ff6b6b'; circle(tip[0], tip[1], 9 * k);
  ctx.strokeStyle = '#b8323a'; ctx.lineWidth = 2 * k; ctx.beginPath(); ctx.arc(tip[0], tip[1], 9 * k, 0, TAU); ctx.stroke(); // ободок — шарик виден и на красной пластинке
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; circle(tip[0] - 3 * k, tip[1] - 3 * k, 3 * k);
  if (m) { ctx.fillStyle = m.skin; circle(g[0], g[1], RB() * 0.17 * m.k); }
}
