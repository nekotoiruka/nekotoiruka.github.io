// 討伐隊の組み方: 見る人ごとに、自分＋最大11人の討伐隊で討伐を再生する。
//   1. 自分（の冒険者）
//   2. 同じチーム（部署）の人。誘った仲間が増えるほど、一緒に戦える
//   3. 残りの枠は、シーズンの順位で自分のすぐ上・すぐ下にいる人（近い順に、上と下を交互に）
// 見る人がいなければ、順位の上から。順位（戦果）はシーズンの参加者全員で決まり、討伐隊の組み方には左右されない。
import { weightedAccuracy } from './stats.js';
import { RAID_PARTY } from './simulate.js';
// シーズンの順位の並び（戦果 → 燃費 → 速さ）。simulate の討伐の順位と同じ
export function seasonOrder(entrants, cases) {
    const ids = new Set(cases.map((c) => c.id));
    const rs = (e) => e.result.cases.filter((c) => ids.has(c.caseId));
    const acc = (e) => weightedAccuracy(rs(e));
    const tok = (e) => rs(e).reduce((a, c) => a + c.tokensIn + c.tokensOut, 0);
    const lat = (e) => rs(e).reduce((a, c) => a + c.latencyMs, 0);
    return entrants.map((e, i) => ({ e, i, a: acc(e), t: tok(e), l: lat(e) }))
        .sort((x, y) => y.a - x.a || x.t - y.t || x.l - y.l || x.i - y.i).map((x) => x.e);
}
export function pickParty(entrants, cases, mine, max = RAID_PARTY) {
    if (entrants.length <= max)
        return entrants;
    const order = seasonOrder(entrants, cases);
    const rank = new Map(order.map((e, i) => [e.id, i]));
    const mineIds = new Set(mine);
    const me = order.filter((e) => mineIds.has(e.id));
    const picked = new Set();
    const add = (e) => { if (e && picked.size < max)
        picked.add(e); };
    me.forEach(add);
    if (me.length) {
        const r0 = rank.get(me[0].id);
        const near = (e) => Math.abs(rank.get(e.id) - r0);
        const teams = new Set(me.map((e) => e.loadout.team?.trim()).filter((t) => !!t));
        order.filter((e) => teams.has(e.loadout.team?.trim() ?? '')).sort((a, b) => near(a) - near(b)).forEach(add);
        for (let d = 1; picked.size < max && d < order.length; d++) {
            add(order[r0 - d]);
            add(order[r0 + d]);
        }
    }
    order.forEach(add);
    // 元の並び（提出の順）を保つ: 立ち位置や乱数がむやみに変わらないように
    return entrants.filter((e) => picked.has(e));
}
//# sourceMappingURL=party.js.map