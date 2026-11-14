// Общее состояние сцены «Сердечко-модница»: этапы украшения, выбранные детали, анимация сердца.

/** Этапы по порядку. optional — можно «без этого»; multi — можно выбрать несколько сразу. */
export const STAGES = [
  { id: 'color', opts: ['red', 'pink', 'purple', 'blue', 'green', 'yellow', 'rainbow', 'dots', 'stripes', 'sunset'] },
  { id: 'eyes', opts: ['round', 'sparkle', 'happy', 'sleepy', 'cat', 'rainbow', 'glasses', 'sunglasses', 'wink', 'button'] },
  { id: 'lashes', optional: true, opts: ['short', 'long', 'flutter', 'color', 'lower', 'wing', 'glitter', 'brows'] },
  { id: 'nose', optional: true, opts: ['dot', 'heart', 'button', 'clown', 'cat', 'pig', 'strawberry', 'dog', 'mustache'] },
  { id: 'cheeks', optional: true, opts: ['blush', 'doll', 'freckles', 'swirl', 'rainbow', 'daisy', 'candy', 'paw'] },
  { id: 'hair', optional: true, opts: ['bow', 'long', 'pigtails', 'crown', 'flowers', 'unicorn', 'bun', 'cat', 'bunny', 'afro'] },
  { id: 'earrings', optional: true, opts: ['pearl', 'hoop', 'cherry', 'drop', 'icecream', 'butterfly', 'bell', 'feather', 'star'] },
  { id: 'necklace', optional: true, opts: ['pearls', 'beads', 'flowers', 'locket', 'bowtie', 'scarf', 'key', 'shells', 'candy'] },
  { id: 'env', optional: true, multi: true, opts: ['babies', 'bubbles', 'butterflies', 'balloons', 'sparkles', 'flowers', 'kitten', 'fish', 'duck'] },
  { id: 'bg', opts: [] as string[] },
] as { id: string; optional?: boolean; multi?: boolean; opts: string[] }[];

/** Цвет фона: верх и низ градиента */
export const BG_COLORS: Record<string, [string, string]> = {
  pink: ['#ffe6f2', '#ffc2dc'],
  sky: ['#d3edff', '#9dd3ff'],
  lilac: ['#efe4ff', '#cbb3ff'],
  mint: ['#defcf0', '#a9ecd2'],
  peach: ['#fff0dc', '#ffc79f'],
  night: ['#231c5c', '#4a3a92'],
  sunset: ['#ffc46b', '#d98ad8'],
  lemon: ['#fffbd8', '#ffe27a'],
};
export const BG_DETAILS = ['clouds', 'rainbow', 'sun', 'hills', 'moon', 'garland', 'tree', 'castle', 'sea'];

export type Item = { kind: 'single' | 'none' | 'toggle' | 'bgcolor' | 'bgd'; k: string | null };

/** Кнопки выбора на этапе s */
export function stageItems(s: number): Item[] {
  const st = STAGES[s];
  if (st.id === 'bg') return [...Object.keys(BG_COLORS).map(k => ({ kind: 'bgcolor', k }) as Item), ...BG_DETAILS.map(k => ({ kind: 'bgd', k }) as Item)];
  const out: Item[] = [];
  if (st.optional) out.push({ kind: 'none', k: null });
  for (const k of st.opts) out.push({ kind: st.multi ? 'toggle' : 'single', k });
  return out;
}

export const defaultCfg = () => ({
  color: 'red', eyes: 'round', lashes: null, nose: null, cheeks: null, hair: null, earrings: null, necklace: null,
  env: {} as Record<string, boolean>, bg: 'pink', bgd: {} as Record<string, boolean>,
} as Record<string, any>);

export const G = {
  started: false,
  stage: 0, stageT: 0,           // текущий этап и время с его открытия (для анимации появления кнопок)
  cfg: defaultCfg(),
  finale: null as null | { t: number; conf: number },
  uiA: 1,                        // прозрачность панелей (в празднике прячутся)
  HR: { x: 0, y: 0, w: 0, h: 0 }, // область, где живёт сердце и окружение
  heart: { x: 0, y: 0, R: 100 },
  snap: true,                    // после resize сразу поставить сердце на место, без плавного переезда
  /** живая анимация сердца */
  hs: { sqT: 9, jT: 9, wgT: 9, love: 0, mouth: 0, blink: 0, blinkT: 3, react: 0, lx: 0, ly: 0, beatT: 0, swing: 0, swingV: 0, pop: {} as Record<string, number> },
};

/** Есть ли на этапе что-то выбранное (для значка на ленте этапов) */
export function stageHas(s: number) {
  const id = STAGES[s].id, c = G.cfg;
  if (id === 'env') return Object.values(c.env).some(Boolean);
  if (id === 'bg') return true;
  return c[id] != null;
}

const KEY = 'mariia-play:heart-dress-up';
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ cfg: G.cfg, stage: G.stage })); } catch (e) { /* без сохранения — не страшно */ }
}
export function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (d && d.cfg) { G.cfg = Object.assign(defaultCfg(), d.cfg); G.stage = Math.max(0, Math.min(STAGES.length - 1, d.stage | 0)); }
  } catch (e) { /* ок */ }
}
