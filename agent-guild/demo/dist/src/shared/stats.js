import { getLang, perLang, tl } from './i18n.js';
import { COST_RULES } from './catalog.js';
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
// 燃費（1場面ぶん）: fuel がなければ（古い記録）、入出力の合計で見る
export const fuelOfCase = (c) => c.fuel ?? c.tokensIn + c.tokensOut;
// 貢献度（0〜1 と少し）: 順位を決める値（2026-11-07・issue #58）。戦果を軸に、燃費を「引かれる費用」ではなく戦いの力として効かせる。
//  - 長旅の消耗: 場面を順に進むうちに、燃費の積み重ねが「旅の体力」（場面の数 × JOURNEY_PER_SCENE）を超えると、
//    そこから先の場面は疲れて、与える力が FATIGUE 倍になる（実務の予算・利用料の上限）
//  - 余力の上乗せ: 旅の体力が残っているほど、最後に少し上乗せする（いちばん多くて1場面ぶんの半分。外してまで節約しても得をしない）。
//    戦果が CONTRIB_FLOOR に届かない構成（当てずっぽうで安く済ませたもの）には付けない
// 数字は模擬採点の手本（日本語で1場面 約3,500〜4,000）で余裕が残るように置いた仮の値。本物で合わせる。
// 同じ中身でも、ラテン文字などの言語は読み書きの量が多くなる（模擬採点で約2倍）ので、旅の体力も言語ごとに広げる
export const JOURNEY_PER_SCENE = 6000;
const JOURNEY_LANG_FACTOR = { ja: 1, zh: 1, ko: 1, en: 2, es: 2, pt: 2, fr: 2, de: 2, hi: 2, ar: 2 };
// シーズン×言語ごとに決めてあれば、それを使う（2026-11-10: 手本はもち、お供を絞らない形は最後の5場面くらいで疲れる。scripts/journey.mjs）
export const journeyPerScene = () => COST_RULES.journeyPerScene || JOURNEY_PER_SCENE * (JOURNEY_LANG_FACTOR[getLang()] ?? 2);
export const FATIGUE = 0.5;
export const SPARE_BONUS = 0.5;
export const CONTRIB_FLOOR = 0.5;
export function contribution(cases) {
    const n = cases.length;
    const journey = n * journeyPerScene();
    const w = cases.reduce((a, c) => a + (c.weight ?? 1), 0);
    let used = 0, got = 0, tiredFrom = null;
    cases.forEach((c, i) => {
        used += fuelOfCase(c);
        const tired = used > journey;
        if (tired && tiredFrom === null)
            tiredFrom = i;
        got += c.score * (c.weight ?? 1) * (tired ? FATIGUE : 1);
    });
    const accuracy = weightedAccuracy(cases);
    const spare = journey ? Math.max(0, 1 - used / journey) : 0;
    const bonus = accuracy >= CONTRIB_FLOOR && n ? SPARE_BONUS * (1 / n) * spare : 0;
    return { score: (w ? got / w : 0) + bonus, accuracy, fuel: used, journey, tiredFrom, bonus };
}
// 行動力の目安（1つの場面で、1回の呼び出しに入る量）。2026-11-07・issue #58 で数え方を変えた。
// 2026-11-10（issue #83）から行動力切れはなく、記録のゲージと帯に引く「目安の線」にだけ使う（超えると「重い」と出す）。
// 単位は「行動力の数え方」（模擬採点の見積もり）。本物の採点は、使ったトークンをシーズン×言語ごとの比（tokens.json）で割って、この単位に直す。
// 本物で測った線（2026-11-07・吸血鬼伯爵・日本語・行動力の数え方に直したもの）: 手本のお供が書物を読む 約12,200 ／ 手本の冒険者が自分で読む 約13,100。
// その中ほど（TOKEN_CAP_PER_CASE でも変えられる）
export const MP_BUDGET_PER_CASE = 12600;
// 1回の呼び出しに、本物では見積もりのほかに載る分（道具の定義の書式・システムの包み紙など）。本物で測ると、見積もりより約500多かった
export const CALL_OVERHEAD = 500;
// 燃費の数え方: 読み直しを含む合計。キャッシュから読んだ分は料金の比で、お供（サブエージェント）の分は軽く数える
// （実務では、サブエージェントに安いモデルを使う。Haiku より安いモデルはないので係数で置き換える。係数は本物で合わせる）
export const FUEL_CACHE_READ = 0.1;
export const FUEL_COMPANION = 0.25;
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