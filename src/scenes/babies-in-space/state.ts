import { BR, t } from '../../core/canvas';

// ---------------- СЦЕНЫ ----------------
// Общее изменяемое состояние сцены (одно место, чтобы любой модуль мог его менять).
export const G = {
  scene: 'space' as 'space' | 'room',
  curHouse: null as any,  // домик, в комнате которого мы сейчас
  trans: null as any,     // переход «ирисом» между космосом и комнатой
  drag: null as any,      // { b, sx, sy, moved } — малыш, которого тащат
  night: 0, nightTarget: 0, started: false,
};
export const babies: any[] = [];
export const houses: any[] = [];

export const MAX_BABIES = 17, MAX_HOUSES = 5;

export const picker = { open: false, t: 0, opts: [{ k: 'nursery', x: 0, y: 0, r: 30, r0: 30, press: 0, shake: 0 }, { k: 'canteen', x: 0, y: 0, r: 30, r0: 30, press: 0, shake: 0 }] };

export const RB = () => BR * 1.2; // размер малыша в комнате
