import { isUltScene } from './scenes.js';
const KEY = 'ai-battle:playback';
export function loadRange() {
    try {
        const v = localStorage.getItem(KEY);
        return v === 'highlights' || v === 'misses' ? v : 'all';
    }
    catch {
        return 'all';
    }
}
export function saveRange(r) {
    try {
        if (r === 'all')
            localStorage.removeItem(KEY);
        else
            localStorage.setItem(KEY, r);
    }
    catch { /* 保存できない環境 */ }
}
/** 見どころの場面: 大技の場面・連携詠唱・最後の場面 */
export function highlightWaves(script) {
    const last = script.waves.length - 1;
    return script.waves.map((wv, i) => {
        const scene = wv.sudden ? undefined : script.cases[wv.caseIndex]?.scene;
        return i === last || scene === 'chain' || isUltScene(scene);
    });
}
/** 自分の冒険者（mine = 参加者の番号）が誤った場面（判定を外した・MP切れ） */
export function missedWaves(script, mine) {
    const m = new Set(mine);
    return script.waves.map((wv) => wv.events.some((e) => (e.type === 'strike' && !e.success && m.has(e.f)) || (e.type === 'mpOut' && m.has(e.f))));
}
/** 範囲ごとの、再生する場面（true）と飛ばす場面（false） */
export function waveFilter(script, range, mine) {
    if (range === 'highlights')
        return highlightWaves(script);
    if (range === 'misses')
        return missedWaves(script, mine);
    return script.waves.map(() => true);
}
/** from 以降で最初の、再生する場面の番号（なければ null） */
export function nextIncluded(inc, from) {
    for (let i = Math.max(0, from); i < inc.length; i++)
        if (inc[i])
            return i;
    return null;
}
//# sourceMappingURL=playback.js.map