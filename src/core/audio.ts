// Синтез звука через WebAudio, без файлов.
export let AC: AudioContext | null = null;
export let master: GainNode | null = null;
export let soundOn = true;
export function toggleSound() { soundOn = !soundOn; return soundOn; }
// iOS 17+: тип аудиосессии «playback» — звук игры не глушится переключателем «Без звука»
// (видео в других вкладках играют именно так, а WebAudio по умолчанию — нет).
try { const as: any = (navigator as any).audioSession; if (as) as.type = 'playback'; } catch (e) { /* нет API — не страшно */ }

// Старые мобильные Safari: webkitAudioContext.resume() может вернуть не Promise — не полагаемся на .catch
function wake() {
  try { const p: any = AC && AC.state !== 'running' ? AC.resume() : null; if (p && p.catch) p.catch(() => {}); } catch (e) { /* звук не обязателен */ }
}
let wasHidden = false; // вкладку скрывали/телефон блокировали — iOS после этого часто «отвязывает» контекст
let started = false;   // игрок уже нажал ▶ — значит, звук нужен
function create() {
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return;
  try { if (AC && AC.state !== 'closed') AC.close(); } catch (e) { /* ок */ }
  AC = new Ctor();
  master = AC.createGain(); master.gain.value = 0.55; master.connect(AC.destination);
  // iOS: короткий беззвучный буфер «разблокирует» звук внутри жеста пользователя
  const s = AC.createBufferSource(); s.buffer = AC.createBuffer(1, 1, 22050); s.connect(AC.destination); s.start(0);
  wasHidden = false;
}
/** Создать/разбудить звук. Никогда не бросает исключений: без звука игра всё равно работает. */
export function initAudio() {
  started = true;
  try {
    // После сворачивания/блокировки iOS может оставить контекст «живым» (running), но немым — пересоздаём.
    if (!AC || AC.state === 'closed' || (wasHidden && AC.state !== 'running') || (wasHidden && isIOS)) create();
    wake();
  } catch (e) { console.warn('audio', e); }
}
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
// Разблокировать звук браузеры разрешают не в любом событии: для пальца pointerdown/touchstart
// НЕ считается жестом (iOS, Android Chrome), а touchend/pointerup/click — считается.
// Поэтому будим звук на каждом «настоящем» жесте, а не только на pointerdown.
function onGesture() { if (started && (!AC || AC.state !== 'running' || wasHidden)) initAudio(); }
for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) addEventListener(ev, onGesture, true);
document.addEventListener('visibilitychange', () => { if (document.hidden) wasHidden = true; else if (AC) wake(); });
addEventListener('pagehide', () => { wasHidden = true; });
addEventListener('pageshow', (e: PageTransitionEvent) => { if (e.persisted) wasHidden = true; });
addEventListener('focus', () => { if (AC) wake(); });

export interface ToneOpts { type?: OscillatorType; vol?: number; slide?: number; delay?: number; at?: number; attack?: number }
/** одна нота: частота f (Гц), длительность dur (с) */
export function tone(f: number, dur: number, o: ToneOpts = {}) {
  try { tone0(f, dur, o); } catch (e) { console.warn('tone', e); }
}
function tone0(f: number, dur: number, o: ToneOpts) {
  if (!AC || !master || !soundOn || !isFinite(f) || !isFinite(dur)) return;
  wake();
  const t0 = o.at != null ? o.at : AC.currentTime + (o.delay || 0);
  const osc = AC.createOscillator(), g = AC.createGain();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(f, t0);
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t0 + dur);
  const v = o.vol || 0.2;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + (o.attack || 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(master); osc.start(t0); osc.stop(t0 + dur + 0.05);
}
/** шум «вжух» */
export function whoosh(dur = 0.9, vol = 0.22) {
  if (!AC || !master || !soundOn) return;
  const n = Math.floor(AC.sampleRate * dur), buf = AC.createBuffer(1, n, AC.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = AC.createBufferSource(); s.buffer = buf;
  const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
  const t0 = AC.currentTime;
  f.frequency.setValueAtTime(250, t0); f.frequency.exponentialRampToValueAtTime(2200, t0 + dur * 0.7);
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start();
}
