import { perLang, tl } from './i18n.js';
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
// 対数スケールで good 以下なら100、bad 以上なら0
function logScore(v, good, bad) {
    if (v <= good)
        return 100;
    if (v >= bad)
        return 0;
    return clamp(100 * (Math.log(bad) - Math.log(v)) / (Math.log(bad) - Math.log(good)));
}
// 戦果（0〜1）: 場面ごとの点を重み付きで平均する。巻物が要る場面は重い（SKILL_WEIGHT）
export const SKILL_WEIGHT = 1.5;
export function weightedAccuracy(cases) {
    const w = cases.reduce((a, c) => a + (c.weight ?? 1), 0);
    return w ? cases.reduce((a, c) => a + c.score * (c.weight ?? 1), 0) / w : 0;
}
export const MP_BUDGET_PER_CASE = 15000; // 1問あたりのトークン予算（超えると行動力切れ）
export function computeStats(result, cases) {
    const byId = new Map(cases.map((c) => [c.id, c]));
    const rs = result.cases.filter((c) => byId.has(c.caseId));
    const n = rs.length || 1;
    const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const atk = weightedAccuracy(rs) * 100;
    const traps = rs.filter((r) => byId.get(r.caseId).kind === 'trap');
    const def = traps.length ? mean(traps.map((r) => r.score)) * 100 : atk;
    const lat = mean(rs.map((r) => r.latencyMs));
    const spd = logScore(lat, 1500, 30000);
    const tok = rs.reduce((a, r) => a + r.tokensIn + r.tokensOut, 0) / n;
    const mp = logScore(tok, 2000, 40000);
    const spreads = rs.filter((r) => r.runs.length > 1).map((r) => Math.max(...r.runs) - Math.min(...r.runs));
    const luk = spreads.length ? clamp(100 - mean(spreads) * 200) : 50;
    return { atk: Math.round(atk), def: Math.round(def), spd: Math.round(spd), mp: Math.round(mp), luk: Math.round(luk) };
}
export const STAT_LABELS = perLang(() => ({
    atk: tl('ATK 精度'), def: tl('DEF 耐性'), spd: tl('SPD 速さ'), mp: tl('AP 燃費'), luk: tl('LUK 安定'),
}));
//# sourceMappingURL=stats.js.map