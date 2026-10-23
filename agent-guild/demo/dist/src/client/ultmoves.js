import { MOTION_PICKS } from './motionpicks.js';
import { OUGI_MOVES } from './ult-ougi.js';
import { RUSH_MOVES } from './ult-rush.js';
import { SUMMON_MOVES } from './ult-summon.js';
import { PARRY_MOVES } from './ult-parry.js';
import { SEAL_MOVES } from './ult-seal.js';
import { AWAKEN_MOVES } from './ult-awaken.js';
const MOVES = { ougi: OUGI_MOVES, rush: RUSH_MOVES, summon: SUMMON_MOVES, parry: PARRY_MOVES, seal: SEAL_MOVES, awaken: AWAKEN_MOVES };
/** 武器ごとに選んだ型の名前（例: 奥義の剣 → 'moon'）。見本帳の第一候補 */
export function ultMove(scene, w) {
    const ids = MOTION_PICKS[scene]?.[w ?? 'sword'] ?? [];
    return (ids[0] ?? '').replace(`${scene}-`, '');
}
// 型の名前（演出ギャラリーの表示用）
export const MOVE_LABEL = {
    fall: '天墜', moon: '月輪', cross: '十字斬り', comet: '流星', bolt: '雷刃', shadow: '影縫い',
    cyclone: '旋風', pierce: '乱れ突き', star: '五芒星', hundred: '百連斬', frames: '暗転の連撃',
    fist: '岩の拳', meteor: '流星群', bird: '炎の鳥', tornado: '竜巻', knight: '光の騎士', sword: '巨大な剣',
    return: '打ち返し', counter: 'カウンター斬り', mirror: '鏡の盾', catch: '受け止めて投げ返す', absorb: '吸いこんで放つ', behind: '影からの返し',
    box: '結界の箱', talisman: '札', pillar: '光の柱', freeze: '氷結', stakes: '光の楔', chains: '光の鎖',
    dark: '闇の覚醒', halo: '光輪と翼', giant: '大きな影', flame: '炎のオーラ', gold: '金色の覚醒', thunder: '雷をまとう',
};
/** 型の定義（巨大な剣・光の鎖は undefined → scenes.ts の以前の演出） */
export function ultMoveDef(scene, w) {
    return MOVES[scene]?.[ultMove(scene, w)];
}
//# sourceMappingURL=ultmoves.js.map