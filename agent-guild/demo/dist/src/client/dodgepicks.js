// 紹介ページ「見切り」の窓で見せる、正しく動けた冒険者の身のこなし（回避・ガード・ジャンプなどの型）の候補と選び方。
// 候補は見本の討伐の中から集める（ボスの攻撃の基本の4場面で、正しく動けた冒険者ひとりずつ）。同じ型は1つにまとめる。
// どれを見せるかは、回避モーションの見本帳（scripts/build-dodgelab.mjs）で選び、DODGE_PICKS に書く。
import { ArenaRenderer } from './arena.js';
import { counterFor } from './bossmoves.js';
import { protoPattern, respOf } from './motionlab.js';
/** 紹介ページで見せる型（見本帳で選んだ順。「場面:武器:型」。立ち位置は後列の下から2番目）。空なら、ちがう型が並ぶように自動で選ぶ */
export const DODGE_PICKS = [
    'breath:common',
    'claw:wand:guard-hex',
    'claw:katana:guard-parry',
    'claw:guitar:guard-just',
    'dive:bow:evade-back',
    'dive:shield:evade-roll',
    'dive:fan:evade-log',
    'tail:book:magic-thunder',
    'tail:scythe:slash-heavy',
    'tail:blaster:shot-spread',
];
/** 自動で選ぶときの数 */
export const DODGE_AUTO_N = 6;
/** 見本帳・紹介ページで型を見せる立ち位置: 後列の下から2番目 */
export function fixedFighter(script) {
    const back = script.fighters.map((fi, i) => ({ fi, i })).filter((x) => x.fi.row === 'back' && !x.fi.off).sort((a, b) => a.fi.slot.y - b.fi.slot.y);
    return back[Math.max(0, back.length - 2)].i;
}
/** 決めた立ち位置で、場面（基本の4つ）× 武器 × 型の候補を全部集める。key は「場面:武器:型」（伏せる・結界は「場面:common」） */
export function weaponCands(script, weapons) {
    const r = new ArenaRenderer(document.createElement('canvas'), script);
    const f = fixedFighter(script);
    const out = [];
    for (const scene of BASE) {
        const w = script.waves.findIndex((wv) => script.cases[wv.caseIndex]?.scene === scene
            && wv.events.some((e) => e.type === 'strike' && e.f === f && e.success) && wv.events.some((e) => e.type === 'attack' && e.f === f));
        if (w < 0)
            continue;
        const co = counterFor(script.theme?.kind, r.respScene(w));
        const resp = co ? respOf(co.evade, co.fx) : null;
        const title = script.cases[script.waves[w].caseIndex]?.title ?? '';
        const base = { w, f, scene, from: 0, to: 0, slow: [0, 0, 1], steady: true, title };
        if (!resp || resp === 'crawl' || resp === 'barrier') {
            const wk = r.looks[f].weapon;
            out.push({ ...base, key: `${scene}:common`, weapon: wk, pattern: `${resp ?? scene}-common`, name: `${resp === 'crawl' ? '伏せる' : resp === 'barrier' ? '結界' : '基本の動き'}（武器によらず全員同じ）`, look: { weapon: wk, pattern: null } });
            continue;
        }
        for (const wk of weapons) {
            const seen = new Set();
            for (let v = 0; v < 4; v++) {
                const p = protoPattern(resp, wk, v);
                if (!p || seen.has(p.id))
                    continue;
                seen.add(p.id);
                out.push({ ...base, key: `${scene}:${wk}:${p.id}`, weapon: wk, pattern: p.id, name: p.name, look: { weapon: wk, pattern: p } });
            }
        }
    }
    return out;
}
/** 武器と型を差し替えて描く準備（場面ごとの覚えは捨てる）。look が無ければ、もとの武器・ふだんの選び方にもどす */
export function applyLook(r, f, w, look, baseWeapon) {
    r.looks[f].weapon = look ? look.weapon : baseWeapon;
    r.protoPick = look ? (w2, f2) => (w2 === w && f2 === f && look.pattern ? look.pattern : undefined) : null;
    for (const m of [r.retimed, r.cueCache, r.stopCache, r.planCache, r.spotCache])
        m.clear();
}
/** 区間（山場の 0.14 前から 0.08 後まで。山場のまわりだけ 0.6 倍） */
export function windowAt(r, w, f) {
    const plan = r.dodgePlanOf(w, f);
    const peak = plan ? plan.peak : 0.42;
    return { from: peak - DODGE_LEAD, to: peak + DODGE_TAIL, slow: [peak - 0.05, peak + 0.03, 0.6] };
}
/** 見本帳で選んだ型（「場面:武器:型」）を、区間つきの候補にする */
export function pickedCands(script, weapons, picks = DODGE_PICKS) {
    const all = weaponCands(script, weapons);
    const r = new ArenaRenderer(document.createElement('canvas'), script);
    const out = [];
    for (const key of picks) {
        const c = all.find((x) => x.key === key);
        if (!c)
            continue;
        const base = r.looks[c.f].weapon;
        applyLook(r, c.f, c.w, c.look, base);
        out.push({ ...c, ...windowAt(r, c.w, c.f) });
        applyLook(r, c.f, c.w, undefined, base);
    }
    return out;
}
const BASE = ['breath', 'claw', 'dive', 'tail'];
/** 窓で見せる区間: 山場の何だけ前から・何だけ後まで（場面の進み具合） */
export const DODGE_LEAD = 0.14, DODGE_TAIL = 0.08;
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
            // 区間は、どの型も同じ長さ・同じ速さ（ユーザーの希望。型ごとに秒数がちがうと一貫性がない）。
            // 山場（回避のタイミング #102 の dodgetiming.ts。攻撃が届く時刻）の 0.14 前から 0.08 後まで。山場のまわり 0.08 だけ 0.6 倍の速さ。
            // 討伐画面のヒットストップや帯の読みやすさのための減速は使わない（steady）。どの型も約 0.93 秒
            const plan = r.dodgePlanOf(w, e.f);
            const peak = plan ? plan.peak : at.t - 0.04;
            const from = peak - DODGE_LEAD, to = peak + DODGE_TAIL;
            const slow = [peak - 0.05, peak + 0.03, 0.6];
            out.push({ w, f: e.f, scene, weapon: r.looks[e.f].weapon, pattern: id, name: p ? p.pattern.name : `${resp === 'crawl' ? '伏せる' : resp === 'barrier' ? '結界' : '基本の動き'}（全員同じ）`, from, to, slow, steady: true });
        }
    });
    return out;
}
/** 見せる候補: 選んだ型があればその順、なければボスの攻撃の種類を順にまわして、ちがう武器・ちがう型を選ぶ */
export function dodgeOrder(cands, n = DODGE_AUTO_N) {
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