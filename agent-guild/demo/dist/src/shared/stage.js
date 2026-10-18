import { layout } from './simulate.js';
import { perLang, tl } from './i18n.js';
export const STAGE_MAX = 12;
export const STAGE_ALL_MAX = 24; // 「全員」視点を選べる上限
export const STAGE_LABELS = perLang(() => ({ finals: tl('上位'), me: tl('自分と周辺'), all: tl('全員') }));
// 舞台に立つキャラの番号（優先順）。mine は自分のキャラの番号
export function pickStage(script, mine, view, max = STAGE_MAX) {
    const n = script.fighters.length;
    const order = script.standings.slice().sort((a, b) => a.rank - b.rank).map((s) => s.f); // 順位順
    if (n <= max)
        return order.slice().sort((a, b) => a - b);
    if (view === 'all' && n <= STAGE_ALL_MAX)
        return order.slice().sort((a, b) => a - b);
    const rankOf = new Map(order.map((f, i) => [f, i]));
    const mineSorted = mine.filter((f) => rankOf.has(f)).sort((a, b) => rankOf.get(a) - rankOf.get(b));
    const picked = [];
    const add = (f) => { if (picked.length < max && !picked.includes(f))
        picked.push(f); };
    mineSorted.forEach(add);
    if (view === 'me' && mineSorted.length) {
        order.slice(0, 3).forEach(add);
        // 自分の前後3人ずつ（近い順）
        const near = [];
        for (const m of mineSorted) {
            const r = rankOf.get(m);
            for (let d = 1; d <= 3; d++)
                for (const rr of [r - d, r + d])
                    if (order[rr] !== undefined)
                        near.push({ f: order[rr], d });
        }
        near.sort((a, b) => a.d - b.d).forEach((x) => add(x.f));
    }
    order.forEach(add); // 余った枠は上位から
    return picked.sort((a, b) => a - b);
}
// 舞台に立つキャラだけで立ち位置を組み直した台本を返す（戦闘の中身は変えない）
export function restage(script, onStage) {
    const set = new Set(onStage);
    if (set.size >= script.fighters.length)
        return { ...script, fighters: script.fighters.map((f) => ({ ...f, off: false })) };
    const ids = script.fighters.map((_, i) => i).filter((i) => set.has(i));
    const slots = layout(ids.map((i) => script.fighters[i].row));
    const slotOf = new Map(ids.map((f, k) => [f, slots[k]]));
    return {
        ...script,
        fighters: script.fighters.map((f, i) => (set.has(i) ? { ...f, slot: slotOf.get(i), off: false } : { ...f, slot: { x: -300, y: -300 }, off: true })),
    };
}
//# sourceMappingURL=stage.js.map