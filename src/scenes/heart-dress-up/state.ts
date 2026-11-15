// Общее состояние сцены «Сердечко-модница»: этапы украшения, выбранные детали, анимация сердца.

import { CARE_OPTS } from './careopts';

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

// Порядок вариантов: сначала простые «базовые» (подходят почти ко всему), дальше характерные и шуточные.
// Старые варианты, убранные из панели (нос button, ожерелье key/hearts), по-прежнему рисуются — сохранённые наряды не ломаются.
/** Этапы по порядку. optional — можно «без этого»; multi — можно выбрать несколько сразу; care — уход (еда, ванна, сон). */
export const STAGES = [
  { id: 'color', opts: ['red', 'pink', 'purple', 'blue', 'green', 'yellow', 'rainbow', 'dots', 'stripes', 'sunset'] },
  { id: 'eyes', opts: ['round', 'sparkle', 'happy', 'sleepy', 'cat', 'rainbow', 'glasses', 'sunglasses', 'wink', 'button'] },
  { id: 'lashes', optional: true, opts: ['short', 'long', 'one', 'flutter', 'wing', 'lower', 'brows', 'glitter', 'color'] },
  { id: 'nose', optional: true, opts: ['dot', 'tone', 'soft', 'tri', 'line', 'heart', 'cat', 'dog', 'pig', 'clown', 'strawberry', 'mustache'] },
  // рот есть всегда (как глаза): по умолчанию улыбка
  { id: 'mouth', opts: ['smile', 'grin', 'o', 'tongue', 'fang', 'cat', 'lips', 'heart', 'bunny', 'gap'] },
  { id: 'cheeks', optional: true, opts: ['blush', 'shine', 'hearts', 'doll', 'freckles', 'swirl', 'daisy', 'paw', 'rainbow', 'candy'] },
  { id: 'hair', optional: true, opts: ['bow', 'headband', 'clip', 'flowers', 'crown', 'long', 'pigtails', 'bun', 'cat', 'bunny', 'unicorn', 'afro'] },
  { id: 'earrings', optional: true, opts: ['pearl', 'studheart', 'studgem', 'hoop', 'drop', 'bow', 'star', 'butterfly', 'cherry', 'bell', 'feather', 'icecream'] },
  { id: 'necklace', optional: true, opts: ['pearls', 'tone', 'heartchain', 'gem', 'ribbon', 'locket', 'beads', 'flowers', 'shells', 'bowtie', 'scarf', 'candy'] },
  { id: 'env', optional: true, multi: true, opts: ['babies', 'bubbles', 'butterflies', 'balloons', 'sparkles', 'flowers', 'kitten', 'fish', 'duck'] },
  // фон — цвет неба (один выбор), пейзаж — детали фона (несколько сразу); в cfg это bg и bgd
  { id: 'bg', opts: Object.keys(BG_COLORS) },
  { id: 'land', optional: true, multi: true, opts: BG_DETAILS },
  { id: 'food', care: true, opts: CARE_OPTS.food },
  { id: 'bath', care: true, opts: CARE_OPTS.bath },
  { id: 'sleep', care: true, opts: CARE_OPTS.sleep },
  { id: 'album', opts: [] as string[] },
] as { id: string; optional?: boolean; multi?: boolean; care?: boolean; opts: string[] }[];
/** Сколько этапов — наряд (дальше уход и альбом) */
export const DRESS_N = STAGES.findIndex(s => s.care);
/** Где в cfg лежит выбор раздела: у пейзажа — bgd, у остальных — по id раздела */
export const cfgKeyOf = (id: string) => id === 'land' ? 'bgd' : id;


/** Готовые образы для волшебной палочки: все детали наряда + окружение + фон подобраны друг к другу */
export const SETS: Record<string, any>[] = [
  { name: 'princess', color: 'pink', eyes: 'sparkle', lashes: 'long', nose: 'dot', mouth: 'lips', cheeks: 'blush', hair: 'crown', earrings: 'pearl', necklace: 'pearls', env: ['sparkles'], bg: 'lilac', bgd: ['castle'] },
  { name: 'kitty', color: 'purple', eyes: 'cat', lashes: 'short', nose: 'cat', mouth: 'cat', cheeks: 'paw', hair: 'cat', earrings: 'bell', necklace: 'ribbon', env: ['kitten'], bg: 'mint', bgd: ['hills'] },
  { name: 'sea', color: 'blue', eyes: 'round', lashes: 'lower', nose: 'dot', mouth: 'o', cheeks: 'blush', hair: 'long', earrings: 'drop', necklace: 'shells', env: ['fish', 'bubbles'], bg: 'sky', bgd: ['sea'] },
  { name: 'sweets', color: 'dots', eyes: 'happy', lashes: 'color', nose: 'strawberry', mouth: 'tongue', cheeks: 'candy', hair: 'bun', earrings: 'icecream', necklace: 'candy', env: ['balloons'], bg: 'peach', bgd: ['garland'] },
  { name: 'fairy', color: 'green', eyes: 'round', lashes: 'flutter', nose: 'heart', mouth: 'smile', cheeks: 'daisy', hair: 'flowers', earrings: 'butterfly', necklace: 'flowers', env: ['butterflies', 'flowers'], bg: 'lemon', bgd: ['sun', 'tree'] },
  { name: 'unicorn', color: 'sunset', eyes: 'rainbow', lashes: 'glitter', nose: 'heart', mouth: 'heart', cheeks: 'rainbow', hair: 'unicorn', earrings: 'star', necklace: 'locket', env: ['sparkles'], bg: 'night', bgd: ['moon', 'rainbow'] },
  { name: 'bunny', color: 'yellow', eyes: 'button', lashes: 'short', nose: 'tri', mouth: 'bunny', cheeks: 'doll', hair: 'bunny', earrings: 'pearl', necklace: 'ribbon', env: ['flowers', 'duck'], bg: 'mint', bgd: ['hills'] },
  { name: 'classic', color: 'red', eyes: 'round', lashes: 'long', nose: 'dot', mouth: 'grin', cheeks: 'blush', hair: 'bow', earrings: 'studheart', necklace: 'pearls', env: ['babies'], bg: 'pink', bgd: ['clouds'] },
];
/** Наряд из набора: env/bgd — в виде { ключ: true } */
export function setCfg(set: Record<string, any>): Record<string, any> {
  const on = (a: string[]) => Object.fromEntries(a.map(k => [k, true]));
  const c: Record<string, any> = { ...set, env: on(set.env), bgd: on(set.bgd) };
  delete c.name; return c;
}

export type Item = { kind: 'single' | 'none' | 'toggle' | 'bgcolor' | 'bgd' | 'care' | 'camera' | 'photo'; k: string | null };

/** Кнопки выбора на этапе s */
export function stageItems(s: number): Item[] {
  const st = STAGES[s];
  if (st.care) return st.opts.map(k => ({ kind: 'care', k }) as Item);
  if (st.id === 'album') return [{ kind: 'camera', k: null }, ...G.album.map(p => ({ kind: 'photo', k: String(p.id) }) as Item)];
  const out: Item[] = [], kind = st.id === 'bg' ? 'bgcolor' : st.id === 'land' ? 'bgd' : st.multi ? 'toggle' : 'single';
  if (st.optional) out.push({ kind: 'none', k: null });
  for (const k of st.opts) out.push({ kind, k });
  return out;
}

export const defaultCfg = () => ({
  color: 'red', eyes: 'round', lashes: null, nose: null, mouth: 'smile', cheeks: null, hair: null, earrings: null, necklace: null,
  env: {} as Record<string, boolean>, bg: 'pink', bgd: {} as Record<string, boolean>,
} as Record<string, any>);

export const G = {
  started: false,
  stage: 0, stageT: 0,           // текущий этап и время с его открытия (для анимации появления кнопок)
  cfg: defaultCfg(),
  finale: null as null | { t: number; conf: number },
  /** фото-альбом: сохранённые наряды (новые — первыми) */
  album: [] as { id: number; cfg: Record<string, any>; hand: string[] }[],
  /** наряд меняли руками после последнего фото — значит, перед «заново» его стоит сберечь в альбом */
  dirty: false,
  /** разделы наряда (id из STAGES), выбранные руками: палочка их не трогает, на ленте — метка «моё» */
  byHand: new Set<string>(),
  /** волшебная палочка: по очереди «прощёлкивает» детали */
  wand: null as null | { t: number; seq: [string, any][]; i: number },
  flash: 0,                      // вспышка фотоаппарата
  /** кнопки поверх области сердца (палочка, хлопушка, звук) — окружение их обходит */
  zones: {} as Record<string, { x: number; y: number; r: number }>,
  /** фото летит в альбом */
  photoFly: null as null | { cfg: Record<string, any>; t: number; x0: number; y0: number; R0: number },
  uiA: 1,                        // прозрачность панелей (в празднике прячутся)
  HR: { x: 0, y: 0, w: 0, h: 0 }, // область, где живёт сердце и окружение
  heart: { x: 0, y: 0, R: 100 },
  snap: true,                    // после resize сразу поставить сердце на место, без плавного переезда
  /** живая анимация сердца */
  hs: { sqT: 9, jT: 9, wgT: 9, love: 0, mouth: 0, blink: 0, blinkT: 3, react: 0, lx: 0, ly: 0, beatT: 0, swing: 0, swingV: 0, pop: {} as Record<string, number>,
    /** своя реакция на деталь (см. reactions.ts): что за деталь и сколько секунд идёт */
    act: null as null | { id: string; k: string; t: number }, spinT: 9 },
};

/** Есть ли на этапе что-то выбранное (для значка на ленте этапов) */
export function stageHas(s: number) {
  const st = STAGES[s], id = st.id, c = G.cfg;
  if (st.care || id === 'album') return false;
  if (id === 'env') return Object.values(c.env).some(Boolean);
  if (id === 'bg') return c.bg !== 'pink';
  if (id === 'land') return Object.values(c.bgd).some(Boolean);
  if (id === 'color') return c.color !== 'red';
  if (id === 'eyes') return c.eyes !== 'round';
  if (id === 'mouth') return (c.mouth || 'smile') !== 'smile';
  return c[id] != null;
}
/** Сколько разделов наряда украшено (для пульсации хлопушки) */
export const decorated = () => STAGES.reduce((n, _, i) => n + (stageHas(i) ? 1 : 0), 0);

const KEY = 'mariia-play:heart-dress-up';
export const ALBUM_MAX = 12;
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ cfg: G.cfg, stage: G.stage, stageId: STAGES[G.stage].id, album: G.album, dirty: G.dirty, byHand: [...G.byHand] })); } catch (e) { /* без сохранения — не страшно */ }
}
export function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (d && d.cfg) { G.cfg = Object.assign(defaultCfg(), d.cfg); G.stage = Math.max(0, Math.min(STAGES.length - 1, d.stage | 0));
      // этап по имени: старые сохранения хранят только номер, а после нового раздела номера сдвинулись
      const si = STAGES.findIndex(s => s.id === d.stageId); if (si >= 0) G.stage = si; }
    if (d && Array.isArray(d.album)) G.album = d.album.filter((p: any) => p && p.cfg).map((p: any) => ({ id: +p.id || 0, cfg: Object.assign(defaultCfg(), p.cfg), hand: handIds(p.hand) })).slice(0, ALBUM_MAX);
    if (d) { G.dirty = !!d.dirty; G.byHand = new Set(handIds(d.byHand)); } // старые сохранения без byHand — ручных разделов нет
  } catch (e) { /* ок */ }
}
/** Метки «моё» из сохранения: только существующие разделы наряда */
export function handIds(a: any): string[] {
  return Array.isArray(a) ? a.filter(id => { const i = STAGES.findIndex(s => s.id === id); return i >= 0 && i < DRESS_N; }) : [];
}
/** Одинаковые ли наряды (для альбома: не хранить два одинаковых фото) */
export const sameCfg = (a: Record<string, any>, b: Record<string, any>) => cfgKey(a) === cfgKey(b);
function cfgKey(c: Record<string, any>) {
  const on = (o: Record<string, boolean>) => Object.keys(o || {}).filter(k => o[k]).sort().join(',');
  return ['color', 'eyes', 'lashes', 'nose', 'cheeks', 'hair', 'earrings', 'necklace', 'bg'].map(k => c[k] ?? '-').join('|') + '|' + (c.mouth || 'smile') + '|' + on(c.env) + '|' + on(c.bgd);
}
