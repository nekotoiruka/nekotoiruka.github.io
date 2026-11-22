export const BOSS_API = 3; // 2: 舞台（stage）と kit.stagekit を足した（#119）。3: 大魔法（chainFinale）と kit.chainkit を足した（#104）
/** 対応技を一つ作る（ボスのモジュールが counters を書くときに使う） */
export const counter = (evade, fx, sfx, color) => ({ evade, fx, sfx, color });
/** 既定のボス（練習用シーズンの吸血鬼伯爵）。知らない種類・種類なしは、このボスで描く */
export const DEFAULT_BOSS = 'vampire';
const reg = new Map();
/** ボスを登録する。api の番号が合わないものは登録しない（false）。同じ種類は、あとから来たものを使う */
export function registerBoss(m) {
    if (!m || m.api !== BOSS_API) {
        console.error(`registerBoss: api の番号が合いません（${m?.kind ?? '?'}: ${m?.api} / 本体: ${BOSS_API}）`);
        return false;
    }
    if (typeof m.kind !== 'string' || !m.kind) {
        console.error('registerBoss: kind がありません');
        return false;
    }
    if (reg.has(m.kind))
        console.warn(`registerBoss: ${m.kind} はもう登録されています。あとから来たものに置きかえます`);
    reg.set(m.kind, m);
    return true;
}
/** その種類のボスが登録されているか */
export const hasBoss = (kind) => !!kind && reg.has(kind);
/** ボスを引く。知らない種類（と kind なし）は DEFAULT_BOSS（伯爵）、それもなければ最初に登録されたボス。一つも登録されていなければ例外 */
export function bossOf(kind) {
    const m = (kind && reg.get(kind)) || reg.get(DEFAULT_BOSS) || reg.values().next().value;
    if (!m)
        throw new Error('bossOf: ボスが一つも登録されていません');
    return m;
}
/** 登録されているボス（登録した順。置きかえたものは、もとの順のまま） */
export const allBosses = () => [...reg.values()];
//# sourceMappingURL=bossapi.js.map