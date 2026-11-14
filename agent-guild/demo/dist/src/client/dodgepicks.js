// 紹介ページ「見切りと反撃」の窓で見せる、正しく動けた冒険者の身のこなし（回避・ガード・ジャンプなどの型）の候補と選び方。
// 候補は見本の討伐の中から集める（ボスの攻撃の基本の4場面で、正しく動けた冒険者ひとりずつ）。同じ型は1つにまとめる。
// どれを見せるかは、回避モーションの見本帳（scripts/build-dodgelab.mjs）で選び、DODGE_PICKS に書く。
import { ArenaRenderer } from './arena.js';
import { counterFor } from './bossmoves.js';
import { respOf } from './motionlab.js';
/** 紹介ページで見せる型（見本帳で選んだ順）。空なら、ちがう型が並ぶように自動で選ぶ */
export const DODGE_PICKS = [];
/** 自動で選ぶときの数 */
export const DODGE_AUTO_N = 6;
const BASE = ['breath', 'claw', 'dive', 'tail'];
/** 見本の討伐から、型ごとに1つずつ候補を集める（場面の順・冒険者の順） */
export function dodgeCands(script) {
    const r = new ArenaRenderer(document.createElement('canvas'), script);
    const out = [];
    const seen = new Set();
    script.waves.forEach((wv, w) => {
        const scene = script.cases[wv.caseIndex]?.scene ?? '';
        if (!BASE.includes(scene))
            return;
        for (const e of wv.events) {
            if (e.type !== 'strike' || !e.success || script.fighters[e.f]?.off)
                continue;
            const at = wv.events.find((x) => x.type === 'attack' && x.f === e.f);
            if (!at)
                continue;
            const p = r.protoOf(w, e.f);
            // 伏せる・結界は、武器によらず全員同じ動き（型の案がない）
            const co = counterFor(script.theme?.kind, r.respScene(w)), resp = co ? respOf(co.evade, co.fx) : null;
            const id = p ? p.pattern.id : `${resp ?? scene}-common`;
            if (seen.has(id))
                continue;
            seen.add(id);
            out.push({ w, f: e.f, scene, weapon: r.looks[e.f].weapon, pattern: id, name: p ? p.pattern.name : `${resp === 'crawl' ? '伏せる' : resp === 'barrier' ? '結界' : '基本の動き'}（全員同じ）`, from: 0.26, to: Math.max(0.5, at.t - 0.01), slow: [0.38, 0.54, 0.6] });
        }
    });
    return out;
}
/** 見せる候補: 選んだ型があればその順、なければボスの攻撃の種類を順にまわして、ちがう武器・ちがう型を選ぶ */
export function dodgeOrder(cands, picks = DODGE_PICKS, n = DODGE_AUTO_N) {
    if (picks.length)
        return picks.map((id) => cands.find((c) => c.pattern === id)).filter((c) => !!c);
    const out = [];
    const weapons = new Set();
    const pools = BASE.map((sc) => cands.filter((c) => c.scene === sc).sort((a, b) => Number(a.pattern.endsWith('-common')) - Number(b.pattern.endsWith('-common')))); // 武器ごとの型を先に
    for (let round = 0; out.length < n && pools.some((p) => p.length); round++) {
        for (const pool of pools) {
            if (out.length >= n || !pool.length)
                continue;
            const i = Math.max(0, pool.findIndex((c) => !weapons.has(c.weapon)));
            const [c] = pool.splice(i, 1);
            weapons.add(c.weapon);
            out.push(c);
        }
    }
    return out;
}
//# sourceMappingURL=dodgepicks.js.map