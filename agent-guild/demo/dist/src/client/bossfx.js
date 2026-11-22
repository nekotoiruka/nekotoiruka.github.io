import { clamp01, dustRing, lerp } from './fxkit.js';
import { bossOf, hasBoss } from './bossapi.js';
import './bosses/index.js';
/** ボスごとの飛び道具（BossModule の fx.hit）を、攻撃の種類ごとの時刻で描く。描いたら true。
 *  fx.hit のないボスは何も描かない（false）。知らない種類・種類なしは、既定のボス（bossOf） */
export function attackHitFx(kind, atk, o) {
    const h = bossOf(kind).fx?.hit;
    if (!h)
        return false;
    if (h.custom)
        return h.custom(atk, o);
    const { ctx, phase: p, x, y, stopX, blocked, mouth } = o;
    const ty = o.ty ?? y - 12;
    if (atk === 'breath') {
        const k = clamp01((p - 0.34) / 0.12);
        if (k <= 0 || k >= 1)
            return true;
        const fx = (t) => lerp(mouth.x, stopX, t), fy = (t) => lerp(mouth.y, ty, t);
        h.breath?.(o, { k, ty, fx, fy });
        return true;
    }
    if (atk === 'claw') {
        const k = clamp01((p - 0.4) / 0.06);
        if (k <= 0 || k >= 1)
            return true;
        ctx.save();
        ctx.globalAlpha = 1 - k * 0.5;
        h.claw?.(o, { k, ty });
        ctx.restore();
        return true;
    }
    if (atk === 'meteor') {
        const k = clamp01((p - 0.3) / 0.12), by = blocked ? y - 30 : y - 6;
        if (k > 0 && k < 1) {
            const cx = lerp(x + 30, stopX + 4, k), cy = lerp(-20, by, k);
            h.meteor?.(o, { k, cx, cy, by });
        }
        const kb = clamp01((p - 0.42) / 0.06);
        if (kb > 0 && kb < 1)
            dustRing(ctx, stopX, blocked ? y - 30 : y - 4, kb, 34, h.meteorDust);
        return true;
    }
    return false;
}
/** 尾の攻撃のとき床をはしる帯の色（BossModule の style.tailBand）。ないボスは null（arena-boss.ts が床の砂ぼこりの色で描く） */
export function tailBandColors(kind) {
    return (hasBoss(kind) ? bossOf(kind).style.tailBand : undefined) ?? null; // BossModule の style.tailBand
}
/** その場面の、登録されたボスのボス側の演出（BossModule の fx.scenes）。登録されていない種類・種類なしは null */
export function bossFxFor(kind, scene) {
    if (!scene || !hasBoss(kind))
        return null;
    return bossOf(kind).fx?.scenes?.[scene] ?? null;
}
/** scenes.ts が描く、場面のボス側の演出（BossModule の fx.scenes）。知らない種類・種類なしは、既定のボス（bossOf） */
export function sceneFxFor(kind, scene) {
    if (!scene)
        return null;
    return bossOf(kind).fx?.scenes?.[scene] ?? null;
}
//# sourceMappingURL=bossfx.js.map