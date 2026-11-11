// «Спектакль» еды в столовой: малыш ловит еду двумя руками, подносит ко рту,
// откусывает 3 раза (щёки надуваются, крошки, «ням», на еде видны укусы),
// потом гладит животик и говорит «м-м-м». Бутылочку пьёт: держит наклонно у рта,
// в бутылочке пузырьки, молоко убывает.
//
// Всё рисуется через позу малыша (b.pose, см. POSE в characters.ts) в координатах головы
// (центр головы = 0,0, размер r = RB()). Свои руки рисуем поверх (drawArmTo), стандартные
// прячем за туловище (arm = -0.9).
import { tone } from '../../../core/audio';
import { TAU, ctx, pick, t } from '../../../core/canvas';
import { circle, ell, heartPath } from '../../../core/draw';
import { burst } from '../../../core/particles';
import { ease, lerp, phaseAt, phasesDur, type Phase } from '../../../core/tween';
import { drawFood } from '../canteen';
import { roomHead } from '../room';
import { sfx } from '../sounds';
import { RB } from '../state';
import { satisfy } from '../wishes';

type Pt = [number, number];

// ---------- руки поверх тела ----------
/** рука из двух частей (плечо → локоть → кисть), локоть отводится наружу; координаты головы */
export function drawArmTo(r: number, b: any, side: -1 | 1, hx: number, hy: number, o: { hand?: boolean; sleeve?: boolean; fist?: boolean } = {}) {
  const sx = side * r * 0.55, sy = r * 1.05, L = r * 0.44;
  const dx = hx - sx, dy = hy - sy, d = Math.hypot(dx, dy) || 1;
  let ex = (sx + hx) / 2, ey = (sy + hy) / 2;
  if (d < L * 2) {
    // локоть: перпендикуляр к линии плечо–кисть, в сторону «наружу и вниз»
    const h = Math.sqrt(L * L - (d / 2) * (d / 2));
    let nx = -dy / d, ny = dx / d;
    if (nx * side + ny * 0.4 < 0) { nx = -nx; ny = -ny; }
    ex += nx * h; ey += ny * h;
  }
  if (o.sleeve !== false) {
    ctx.strokeStyle = b.color; ctx.lineWidth = r * 0.34; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
  }
  if (o.hand !== false) drawHand(r, b, hx, hy, o.fist);
}
export function drawHand(r: number, b: any, x: number, y: number, fist = false) {
  ctx.fillStyle = b.skin; circle(x, y, r * 0.17);
  // тонкий контур, чтобы ладошка читалась на фоне лица
  ctx.strokeStyle = 'rgba(140,70,50,0.35)'; ctx.lineWidth = r * 0.04; ctx.beginPath(); ctx.arc(x, y, r * 0.17, 0, TAU); ctx.stroke();
  if (fist) { ctx.strokeStyle = 'rgba(150,80,60,0.35)'; ctx.lineWidth = r * 0.035; ctx.beginPath(); ctx.arc(x, y + r * 0.02, r * 0.09, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
}

// ---------- расписание ----------
const BITE: Phase[] = [['open', 0.35], ['chomp', 0.15], ['chew', 0.55]];
const PH_FOOD: Phase[] = [['catch', 0.4], ['look', 0.6], ...BITE, ...BITE, ['open', 0.35], ['chomp', 0.15], ['tummy', 2.0]];
const PH_BOTTLE: Phase[] = [['catch', 0.4], ['bring', 0.6], ['drink', 2.5], ['away', 0.35], ['tummy', 2.0]];
const phasesOf = (k: string) => k === 'bottle' ? PH_BOTTLE : PH_FOOD;
const TUMMY = 2.0;

/** еда долетела до малыша — начинаем спектакль */
export function startEat(b: any, k: string) {
  const d = phasesDur(phasesOf(k));
  b.eat = { k, T: 0, d, t: d, bites: 0, ph: '', pi: -1, gulpT: 0.3, yum: false };
}

/** куда летит еда: в руки перед грудью (экранные координаты) */
export function catchPos(b: any): Pt { const [hx, hy] = roomHead(b); return [hx, hy + RB() * 1.0]; }

const sizeOf = (r: number) => r * 0.7;
const CRUMBS: Record<string, string[]> = {
  apple: ['#fff4d6', '#ff5d5d', '#ffe9b0'], banana: ['#fffbe0', '#ffe14d'], cookie: ['#c98a45', '#e8b06a', '#6b4226'],
  bowl: ['#fff1c9', '#ff9ec7', '#9b5de5'], bottle: ['#ffffff', '#e6f4ff'],
};

/** вызывается из Baby.tick каждый кадр */
export function tickEat(b: any, dt: number) {
  const E = b.eat;
  if (!E) {
    if (b.eatPending && b.home) b.pose = pendingPose(b);
    else if (b.pose && b.pose.src === 'eat') b.pose = null;
    return;
  }
  E.T += dt; E.t = E.d - E.T;
  const phs = phasesOf(E.k), ph = phaseAt(E.T, phs), vis = b.visible();
  const [hx, hy] = roomHead(b), r = RB();
  if (ph.i !== E.pi) { // вход в новую фазу
    const prev = E.ph; E.ph = ph.name; E.pi = ph.i;
    if (ph.name === 'catch' && vis) { tone(640, 0.09, { type: 'triangle', vol: 0.12 }); tone(900, 0.12, { type: 'triangle', vol: 0.08, delay: 0.06 }); burst(hx, hy + r, 'spark', 6, { size: 6, speed: 90, color: '#fff7c2' }); }
    // укус случается в конце «chomp»
    if (prev === 'chomp') {
      E.bites++;
      if (vis) {
        sfx.nom(); setTimeout(() => sfx.nom(), 140);
        burst(hx, hy + r * 0.55, 'confetti', 6, { size: 4, speed: 90, g: 500, up: -40, color: pick(CRUMBS[E.k] || CRUMBS.cookie) });
        if (E.bites >= 3) burst(hx, hy + r * 0.6, 'spark', 10, { size: 6, speed: 120, color: '#fff7c2' });
      }
    }
    if (ph.name === 'away' && vis) { burst(hx + r * 0.3, hy + r * 0.1, 'spark', 10, { size: 6, speed: 120, color: '#e6f4ff' }); tone(1200, 0.15, { type: 'sine', slide: 1600, vol: 0.06 }); }
  }
  if (ph.name === 'drink' && !ph.done) {
    E.gulpT -= dt;
    if (E.gulpT <= 0) { E.gulpT = 0.5; if (vis) { tone(320, 0.1, { type: 'sine', slide: 170, vol: 0.15 }); tone(900, 0.06, { type: 'sine', slide: 1300, vol: 0.03, delay: 0.12 }); } }
  }
  if (ph.name === 'tummy' && !E.yum && ph.p * TUMMY > 0.55) { E.yum = true; if (vis) sfx.yum(); }
  if (ph.done) {
    b.eat = null; b.pose = null;
    if (!satisfy(b, 'eat')) { b.laugh = 1; b.bounce = 1; if (vis) burst(hx, hy, 'heart', 5, { size: 8, speed: 100, up: -60, color: '#ff7aa8' }); }
    return;
  }
  b.pose = eatPose(b, ph.name, ph.p);
}

// ---------- позы ----------
const TUCK = -0.9; // стандартные руки прячем за туловище, рисуем свои

/** еда летит — ручки тянутся вверх, «хваталки» сжимаются-разжимаются, ротик буквой «о» */
function pendingPose(b: any) {
  return { src: 'eat', armL: TUCK, armR: TUCK, mood: 'open', face: { yawn: 0.35 }, ownsFood: true,
    top: (r: number) => { for (const s of [-1, 1] as const) { const [x, y] = reachPt(r, s); drawArmTo(r, b, s, x, y); } } };
}
function reachPt(r: number, s: -1 | 1): Pt { return [s * r * 1.0, r * 0.3 + Math.sin(t * 12 + s) * r * 0.07]; }

function eatPose(b: any, name: string, p: number) {
  let mood = 'open', face: any = {}, headTilt = 0;
  const E = b.eat;
  if (name === 'catch') mood = p < 0.6 ? 'laugh' : 'open';
  else if (name === 'look') { mood = 'open'; headTilt = Math.sin(p * TAU) * 0.08; }
  else if (name === 'open') { face = { yawn: ease.inOut(p) * 0.85 }; }
  else if (name === 'chomp') { mood = 'blink'; face = { cheeks: ease.out(p) }; }
  else if (name === 'chew') { mood = 'eat'; face = { cheeks: 1 - p * 0.35 + Math.sin(t * 16) * 0.12 }; headTilt = Math.sin(t * 8) * 0.04; }
  else if (name === 'bring') { mood = 'open'; face = { yawn: ease.inOut(p) * 0.4 }; headTilt = -0.12 * ease.inOut(p); }
  else if (name === 'drink') { mood = Math.sin(E.T * 2) > 0.3 ? 'blink' : 'open'; headTilt = -0.12; face = { cheeks: 0.35 + Math.max(0, Math.sin((0.5 - E.gulpT) / 0.5 * Math.PI)) * 0.4 }; }
  else if (name === 'away') { mood = 'blink'; headTilt = -0.12 * (1 - p); }
  else if (name === 'tummy') {
    const s = p * TUMMY;
    if (s < 0.55 && E.k !== 'bottle') { mood = 'eat'; face = { cheeks: Math.max(0, 0.7 - s) }; }
    else mood = 'blink'; // довольный «м-м-м» с закрытыми глазками
    headTilt = Math.sin(s * 5) * 0.06;
  }
  return { src: 'eat', armL: TUCK, armR: TUCK, mood, face, headTilt, ownsFood: true, dy: 0,
    front: (r: number) => drawEatSleeves(r, b, name, p), top: (r: number) => drawEatTop(r, b, name, p) };
}

// где еда (центр, в координатах головы) и где ручки
function foodAt(r: number, name: string, p: number): { x: number; y: number; rot: number; sx: number; sy: number } {
  const C = r * 1.0, REST = r * 0.92, MOUTH = r * 0.55, IN = r * 0.47;
  let y = REST, rot = 0, sx = 1, sy = 1;
  if (name === 'catch') { y = C; const q = p < 0.5 ? ease.hump(p * 2) : 0; sy = 1 - q * 0.2; sx = 1 + q * 0.12; }
  else if (name === 'look') { y = lerp(C, REST, ease.inOut(p)) - ease.hump(p) * r * 0.14; rot = Math.sin(p * TAU * 1.5) * 0.18; }
  else if (name === 'open') y = lerp(REST, MOUTH, ease.inOut(p));
  else if (name === 'chomp') { y = lerp(MOUTH, IN, ease.hump(p)) ; sy = 1 - ease.hump(p) * 0.08; }
  else if (name === 'chew') { y = lerp(MOUTH, REST, ease.out(Math.min(1, p / 0.45))) + Math.sin(p * Math.PI * 3) * r * 0.02; }
  return { x: 0, y, rot, sx, sy };
}
const HOLD_W: Record<string, number> = { apple: 0.85, banana: 0.75, cookie: 0.75, bowl: 0.92 };
const shrinkOf = (k: string, bites: number) => k === 'banana' || k === 'bowl' ? 1 : 1 - bites * 0.08;
function holdPts(r: number, k: string, f: { x: number; y: number }, bites = 0): [Pt, Pt] {
  const w = (HOLD_W[k] || 0.85) * sizeOf(r) * shrinkOf(k, bites), dy = sizeOf(r) * 0.2;
  return [[f.x - w, f.y + dy], [f.x + w, f.y + dy]];
}
function tummyPts(r: number, b: any, s: number): [Pt, Pt] {
  const ty = b.chair ? r * 1.2 : r * 1.42, out: Pt[] = [];
  for (const side of [-1, 1]) {
    const a = s * TAU * 1.3 + (side > 0 ? Math.PI : 0);
    out.push([side * r * 0.27 + Math.cos(a) * r * 0.12, ty + Math.sin(a) * r * 0.09 + Math.abs(Math.sin(s * 9)) * r * 0.03]);
  }
  return out as [Pt, Pt];
}
const mix = (a: Pt, b: Pt, p: number): Pt => [lerp(a[0], b[0], p), lerp(a[1], b[1], p)];

// ---------- бутылочка ----------
const TILT = -1.9; // бутылочка донышком вверх-вправо, соской ко рту
function bottleAt(r: number, name: string, p: number) {
  const s = r * 0.72, C: Pt = [0, r * 1.0], M: Pt = [r * 0.1, r * 0.44], ax = 1.15 * s;
  // центр бутылочки, когда соска у рта
  const drinkC: Pt = [M[0] - Math.sin(TILT) * ax, M[1] + Math.cos(TILT) * ax];
  let c = C, rot = 0, sc = 1, level = 1;
  if (name === 'catch') { const q = p < 0.5 ? ease.hump(p * 2) : 0; sc = 1 - q * 0.1; }
  else if (name === 'bring') { const e = ease.inOut(p); c = mix(C, drinkC, e); rot = TILT * e; }
  else if (name === 'drink') { c = [drinkC[0], drinkC[1] + Math.sin(p * Math.PI * 10) * r * 0.015]; rot = TILT + Math.sin(p * Math.PI * 5) * 0.04; level = lerp(1, 0.04, p); }
  else if (name === 'away') { c = drinkC; rot = TILT; level = 0.04; sc = Math.max(0.01, 1 - ease.in(p)); }
  return { c, rot, sc, level, s };
}
const rotPt = (lx: number, ly: number, a: number): Pt => [lx * Math.cos(a) - ly * Math.sin(a), lx * Math.sin(a) + ly * Math.cos(a)];
function bottleHands(B: ReturnType<typeof bottleAt>): [Pt, Pt] {
  // обе ладошки снизу: одна у соски, другая у донышка
  const s = B.s * B.sc, a = rotPt(-0.48 * s, -0.3 * s, B.rot), c = rotPt(-0.45 * s, 0.5 * s, B.rot);
  const h1: Pt = [B.c[0] + a[0], B.c[1] + a[1]], h2: Pt = [B.c[0] + c[0], B.c[1] + c[1]];
  return h1[0] < h2[0] ? [h1, h2] : [h2, h1];
}
/** бутылочка с молоком: центр (0,0), соска вверх (локально −y); уровень молока считается «по-настоящему» горизонтально */
function drawBottle(s: number, rot: number, level: number, bubbles: boolean) {
  const bx = -s * 0.42, by = -s * 0.65, bw = s * 0.84, bh = s * 1.45;
  ctx.save(); ctx.rotate(rot);
  // соска и колечко
  ctx.fillStyle = '#ffb36b'; ell(0, -s * 1.0, s * 0.2, s * 0.26);
  ctx.fillStyle = '#7ec8ff'; ctx.beginPath(); ctx.roundRect(-s * 0.5, -s * 0.84, s, s * 0.24, s * 0.06); ctx.fill();
  // стекло
  const body = () => { ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, s * 0.3); };
  body(); ctx.fillStyle = 'rgba(172,214,250,0.95)'; ctx.fill();
  ctx.save(); body(); ctx.clip();
  // поверхность молока: горизонталь в мировых координатах
  const cs = [[bx, by], [bx + bw, by], [bx, by + bh], [bx + bw, by + bh]].map(([x, y]) => x * Math.sin(rot) + y * Math.cos(rot));
  const yTop = Math.min(...cs), yBot = Math.max(...cs), surf = lerp(yBot, yTop, Math.max(0, Math.min(1, level)));
  ctx.rotate(-rot);
  ctx.fillStyle = '#fffaf0'; ctx.fillRect(-s * 3, surf, s * 6, s * 6);
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(-s * 3, surf - s * 0.02, s * 6, s * 0.07);
  if (bubbles) {
    // пузырьки воздуха: от соски поднимаются сквозь молоко к поверхности
    ctx.rotate(rot);
    ctx.strokeStyle = 'rgba(120,180,240,0.95)'; ctx.lineWidth = s * 0.05; ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 6; i++) {
      const q = (t * 0.9 + i / 6) % 1, lx = Math.sin(t * 5 + i * 2.1) * s * 0.17, ly = lerp(by + s * 0.12, by + bh - s * 0.1, q);
      const wy = lx * Math.sin(rot) + ly * Math.cos(rot);
      if (wy < surf) continue; // уже над молоком — лопнул
      const br = s * (0.06 + (i % 3) * 0.025);
      ctx.beginPath(); ctx.arc(lx, ly, br, 0, TAU); ctx.fill(); ctx.stroke();
    }
  }
  ctx.restore();
  // блик и сердечко
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.roundRect(bx + s * 0.12, by + s * 0.2, s * 0.12, bh * 0.55, s * 0.06); ctx.fill();
  ctx.fillStyle = '#ff9ec7'; ctx.save(); ctx.translate(s * 0.08, by + bh * 0.62); heartPath(s * 0.2); ctx.restore();
  ctx.strokeStyle = 'rgba(150,190,230,0.9)'; ctx.lineWidth = s * 0.06; body(); ctx.stroke();
  ctx.restore();
}

// ---------- еда с укусами ----------
// места укусов (в единицах s, локально для drawFood) и поворот, чтобы кусать сверху
const BITES: Record<string, { rot: number; spots: [number, number, number][]; flesh: string }> = {
  apple: { rot: 0, spots: [[0.62, -0.25, 0.34], [-0.6, -0.2, 0.36]], flesh: '#fff3d0' },
  cookie: { rot: 0, spots: [[0.5, -0.5, 0.3], [-0.5, -0.45, 0.33]], flesh: '#f6d7a2' },
  banana: { rot: -0.9, spots: [[0.85, -0.3, 0.33], [0.35, 0.28, 0.42]], flesh: '#fffbe6' },
};
/** вычесть кружок из области рисования (несколько вызовов = объединение «дырок») */
function clipOut(x: number, y: number, rr: number) {
  ctx.beginPath(); ctx.rect(-1e4, -1e4, 2e4, 2e4); ctx.arc(x, y, rr, 0, TAU); ctx.clip('evenodd');
}
function biteCircles(x: number, y: number, rr: number): [number, number, number][] {
  const d = Math.hypot(x, y) || 1, ux = -x / d, uy = -y / d, vx = -uy, vy = ux; // u — к центру, v — вдоль края
  return [[x, y, rr], [x + vx * rr * 0.8 - ux * rr * 0.3, y + vy * rr * 0.8 - uy * rr * 0.3, rr * 0.62], [x - vx * rr * 0.8 - ux * rr * 0.3, y - vy * rr * 0.8 - uy * rr * 0.3, rr * 0.62]];
}
function drawBitten(k: string, s: number, bites: number) {
  if (k === 'bowl') { drawBowl(s, 1 - bites / 3); return; }
  const B = BITES[k] || BITES.cookie;
  const shrink = shrinkOf(k, bites);
  ctx.save(); ctx.rotate(B.rot); ctx.scale(shrink, shrink);
  const cs: [number, number, number][] = [];
  for (let i = 0; i < Math.min(bites, B.spots.length); i++) { const [x, y, rr] = B.spots[i]; cs.push(...biteCircles(x * s, y * s, rr * s)); }
  ctx.save();
  for (const [x, y, rr] of cs) clipOut(x, y, rr);
  drawFood(k, s);
  // светлая мякоть по краю укуса (дуга, обращённая к центру еды)
  ctx.strokeStyle = B.flesh; ctx.lineWidth = s * 0.13; ctx.lineCap = 'round';
  for (let i = 0; i < Math.min(bites, B.spots.length); i++) {
    const [x, y, rr] = B.spots[i], a = Math.atan2(-y, -x);
    ctx.beginPath(); ctx.arc(x * s, y * s, rr * s + s * 0.05, a - 0.75, a + 0.75); ctx.stroke();
  }
  ctx.restore(); ctx.restore();
}
/** мисочка с кашей: fill 1 → полная, 0 → пустая */
function drawBowl(s: number, fill: number) {
  if (fill > 0.02) {
    ctx.fillStyle = '#fff1c9'; ell(0, -s * 0.05 + (1 - fill) * s * 0.18, s * 0.8 * (0.55 + 0.45 * fill), s * 0.24 * (0.4 + 0.6 * fill));
    const berries: [number, number, number, string][] = [[-0.28, -0.12, 0.11, '#ff5d73'], [0.12, -0.1, 0.1, '#9b5de5'], [-0.02, -0.2, 0.08, '#ff9ec7']];
    berries.slice(0, Math.ceil(fill * 3)).forEach(([x, y, rr, c]) => { ctx.fillStyle = c; circle(s * x, s * y + (1 - fill) * s * 0.18, s * rr); });
  } else { ctx.fillStyle = '#e8eef8'; ell(0, -s * 0.02, s * 0.8, s * 0.22); }
  ctx.strokeStyle = '#c9d3ea'; ctx.lineWidth = s * 0.15; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(s * 0.3, -s * 0.05); ctx.lineTo(s * 0.8, -s * 0.75); ctx.stroke();
  ctx.fillStyle = '#c9d3ea'; ell(s * 0.86, -s * 0.84, s * 0.17, s * 0.11, -0.9);
  ctx.fillStyle = '#8fd3ff'; ctx.beginPath(); ctx.moveTo(-s * 0.88, -s * 0.05); ctx.quadraticCurveTo(-s * 0.82, s * 0.78, 0, s * 0.75); ctx.quadraticCurveTo(s * 0.82, s * 0.78, s * 0.88, -s * 0.05); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ell(-s * 0.45, s * 0.25, s * 0.1, s * 0.2, 0.5);
}

// ---------- рисование ----------
// Рукав, которому надо тянуться через середину лица (кисть на «чужой» стороне), рисуем ДО головы
// (pose.front) — рука уходит «за подбородок» и не перечёркивает лицо. Остальные рукава, еду
// и ладошки — поверх головы (pose.top).
const crosses = (r: number, side: number, hx: number) => side * hx < -r * 0.1;
function drawSleeves(r: number, b: any, hands: [Pt, Pt], behind: boolean) {
  ([-1, 1] as const).forEach((side, i) => { const [x, y] = hands[i]; if (crosses(r, side, x) === behind) drawArmTo(r, b, side, x, y, { hand: false }); });
}
function drawEatSleeves(r: number, b: any, name: string, p: number) {
  const rig = eatRig(r, b, name, p); if (rig) drawSleeves(r, b, rig.hands, true);
}
function drawEatTop(r: number, b: any, name: string, p: number) {
  const rig = eatRig(r, b, name, p); if (!rig) return;
  drawSleeves(r, b, rig.hands, false);
  if (rig.item) rig.item();
  drawHand(r, b, rig.hands[0][0], rig.hands[0][1]); drawHand(r, b, rig.hands[1][0], rig.hands[1][1]);
}
function eatRig(r: number, b: any, name: string, p: number): { hands: [Pt, Pt]; item: (() => void) | null } | null {
  const E = b.eat; if (!E) return null;
  const s = sizeOf(r);
  let hands: [Pt, Pt], drawItem: (() => void) | null = null;
  if (E.k === 'bottle') {
    if (name === 'tummy') hands = handsToTummy(r, b, p, bottleHands(bottleAt(r, 'away', 1)));
    else {
      const B = bottleAt(r, name, p); hands = bottleHands(B);
      if (name === 'catch') hands = catchHands(r, p, hands);
      drawItem = () => { ctx.save(); ctx.translate(B.c[0], B.c[1]); ctx.scale(B.sc, B.sc); drawBottle(B.s, B.rot, B.level, name === 'drink'); ctx.restore(); };
    }
  } else {
    if (name === 'tummy') hands = handsToTummy(r, b, p, holdPts(r, E.k, foodAt(r, 'chomp', 1), 2));
    else {
      const f = foodAt(r, name, p); hands = holdPts(r, E.k, f, E.bites);
      if (name === 'catch') hands = catchHands(r, p, hands);
      drawItem = () => { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.scale(f.sx, f.sy); drawBitten(E.k, s, E.bites); ctx.restore(); };
    }
  }
  return { hands, item: drawItem };
}
/** в начале «ловли» ручки ещё раскинуты — схлопываются вокруг еды */
function catchHands(r: number, p: number, hold: [Pt, Pt]): [Pt, Pt] {
  const e = ease.outBack(Math.min(1, p / 0.45));
  return [mix(reachPt(r, -1), hold[0], e), mix(reachPt(r, 1), hold[1], e)];
}
function handsToTummy(r: number, b: any, p: number, from: [Pt, Pt]): [Pt, Pt] {
  const s = p * TUMMY, tp = tummyPts(r, b, s), e = ease.inOut(Math.min(1, s / 0.35));
  return [mix(from[0], tp[0], e), mix(from[1], tp[1], e)];
}
