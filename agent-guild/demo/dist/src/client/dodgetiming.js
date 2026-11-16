import { arrivalOf, escapeDx, IMPACT_T, visibleAt } from './arrival.js';
/** 見本帳の型ごとの「当たる瞬間」（型の中の時刻 0〜1）。
 *  ガード: 構えた所に当たる瞬間（見本帳の攻撃は 0.40 に届く） / 回避: 見本帳で空を切らせる攻撃の時刻 /
 *  ジャンプ: 高さが8割を超えている区間のまん中 / 通常攻撃（斬りはらう・打ち砕く・撃ち落とす）: ボスに当たる最初の時刻。
 *  ジャンプと通常攻撃は scripts/dodge-timing.mjs --measure で測った値。型を足したら、ここにも足す（テストが、抜けを見つける） */
export const LAB_CONTACT = {
    'guard-cross': 0.4, 'guard-parry': 0.4, 'guard-slide': 0.4, 'guard-just': 0.4, 'guard-hex': 0.4, 'guard-brace': 0.4,
    'evade-back': 0.4, 'evade-ghost': 0.42, 'evade-roll': 0.4, 'evade-log': 0.44, 'evade-phase': 0.443, 'evade-duck': 0.423,
    'jump-big': 0.45, 'jump-rocket': 0.439, 'jump-double': 0.555, 'jump-flip': 0.43, 'jump-float': 0.5, 'jump-charge': 0.642,
    'slash-crescent': 0.4, 'slash-iai': 0.55, 'slash-afterimage': 0.36, 'slash-heavy': 0.48,
    'thrust-sweep': 0.42, 'thrust-dive': 0.5,
    'blunt-spin': 0.38, 'blunt-leap': 0.5, 'blunt-homerun': 0.46, 'blunt-quake': 0.5, 'blunt-upper': 0.42,
    'shot-burst': 0.38, 'shot-charge': 0.442, 'shot-spread': 0.424,
    'magic-circle': 0.46, 'magic-thunder': 0.46, 'magic-wind': 0.46,
};
export const labContact = (id) => LAB_CONTACT[id];
/** 見本帳の型ごとの「動き出し」（型の中の時刻。立ち姿から、はじめて姿勢・位置が変わる時刻）。scripts/dodge-timing.mjs --measure で測った値 */
export const LAB_START = {
    'guard-cross': 0.261, 'guard-parry': 0.261, 'guard-slide': 0.281, 'guard-just': 0.341, 'guard-hex': 0.281, 'guard-brace': 0.2,
    'evade-back': 0.321, 'evade-ghost': 0.361, 'evade-roll': 0.301, 'evade-log': 0.361, 'evade-phase': 0.341, 'evade-duck': 0.3,
    'jump-big': 0.121, 'jump-rocket': 0.201, 'jump-double': 0.151, 'jump-flip': 0.202, 'jump-float': 0.105, 'jump-charge': 0.081,
    'slash-crescent': 0.101, 'slash-iai': 0.181, 'slash-afterimage': 0.201, 'slash-heavy': 0.052,
    'thrust-sweep': 0.121, 'thrust-dive': 0.151,
    'blunt-spin': 0.151, 'blunt-leap': 0.121, 'blunt-homerun': 0.081, 'blunt-quake': 0.181, 'blunt-upper': 0.101,
    'shot-burst': 0.161, 'shot-charge': 0.081, 'shot-spread': 0.141,
    'magic-circle': 0.061, 'magic-thunder': 0.081, 'magic-wind': 0.141,
};
/** 溜めを縮めるとき、当たる瞬間の手前のこの割合（攻撃が見えてから山場までの時間に対して）は、ふつうの速さのまま見せる（跳ぶ・振る所が速すぎないように）。
 *  そのぶん、溜めのはじめ（しゃがむ・駆けよる）を速回しにする。溜めは省かない（途中の姿へ飛ばない） */
export const KEEP_TAIL = 0.5;
/** 攻撃が見えてから、山場までに最低これだけは空ける（場面の時刻）。足りないときは、山場を遅らせて「ぎりぎりでよける」 */
export const MIN_REACT = 0.04;
/** 山場を遅らせてよい幅（ぎりぎりでよける。これを越える組み合わせは、テストが知らせる） */
export const LATE_MAX = 0.03;
/** 伏せる・受け続ける型（攻撃が通りすぎるまで、その姿勢を保つ） */
export const HOLD_EVADES = ['crawl', 'block', 'turn', 'barrier'];
/** 型を使わない動き（arena-fighter.ts の switch）: 回避の全体は peak の前後 FALLBACK_HALF。伏せるは、届く少し前に伏せきって、通りすぎるまで伏せている */
export const FALLBACK_HALF = 0.1;
export const CRAWL = { down: 0.05, early: 0.012, up: 0.05, after: 0.012, minHold: 0.04 };
/** 冒険者ひとりの回避の段取り。pattern: 見本帳の型の id（型を使わない動きは null） */
export function dodgePlan(c, evade, pattern) {
    const arrive = arrivalOf(c), visible = visibleAt(c.kind, c.scene), escape = escapeDx(c);
    if (pattern) {
        const lc = LAB_CONTACT[pattern] ?? 0.4, l0 = LAB_START[pattern] ?? lc - 0.14, D = lc - l0;
        const peak = Math.max(arrive.t0, visible + MIN_REACT); // 見えてから間に合わないときは、ぎりぎりでよける
        const A = peak - visible;
        // 溜めがおさまらないとき: 当たる瞬間の手前（A×KEEP_TAIL）はふつうの速さ、溜めのはじめを速回しにして、攻撃が見えた時刻から動き出す
        const fits = D <= A;
        return { arrive, escape, visible, start: fits ? peak - D : visible, peak, lab: { l0, lc, B: fits ? D : Math.min(D, A * KEEP_TAIL) }, shift: peak - lc };
    }
    if (evade === 'crawl') {
        let from = arrive.t0 - CRAWL.early;
        if (from - visible < MIN_REACT / 2)
            from = visible + MIN_REACT / 2;
        const down = Math.min(CRAWL.down, from - visible), to = Math.max(arrive.t1 + CRAWL.after, from + CRAWL.minHold);
        return { arrive, escape, visible, start: from - down, peak: from, shift: from - IMPACT_T, hold: [from, to], down };
    }
    const peak = Math.max(arrive.t0, visible + MIN_REACT);
    return { arrive, escape, visible, start: Math.max(visible, peak - FALLBACK_HALF), peak, shift: peak - IMPACT_T };
}
/** 見本帳の型の時刻（場面の時刻 t から）。動き出しより前は、型の動き出しの手前（立ち姿）にとどめる */
export function labTime(plan, t) {
    const L = plan.lab;
    if (!L)
        return t - plan.shift;
    if (t >= plan.peak - L.B)
        return L.lc + (t - plan.peak); // 当たる瞬間の手前と、そのあとは、ふつうの速さ
    if (t < plan.start)
        return L.l0 - 0.001 - (plan.start - t); // 動き出しの前は、立ち姿
    const a = plan.peak - L.B - plan.start; // 溜めのはじめ（速回し）
    return L.l0 + ((t - plan.start) * (L.lc - L.B - L.l0)) / Math.max(1e-6, a);
}
/** 溜めのはじめを何倍に速回しにしたか（1 ならそのまま） */
export const warpOf = (plan) => { const L = plan.lab; if (!L)
    return 1; const a = plan.peak - L.B - plan.start; return a <= 1e-9 ? 1 : (L.lc - L.B - L.l0) / a; };
/** 型を使わない動き（arena-fighter.ts の switch）の進み 0〜1（動き出し 0 → 山場 0.5 → 1） */
export function fallbackU(plan, t) {
    if (t < plan.peak)
        return t <= plan.start ? 0 : 0.5 * ((t - plan.start) / Math.max(1e-6, plan.peak - plan.start));
    return Math.min(1, 0.5 + 0.5 * ((t - plan.peak) / FALLBACK_HALF));
}
/** 反撃の時刻のいちばん早い所（場面の時刻。反撃の型が当たる瞬間）。
 *  反撃の動き出し（at − lead）は、自分の回避を見せ終えたあと、かつ、討伐隊のみんなに攻撃が届いたあと（まだ攻撃が来ていない人がいるうちに、先に反撃しない）、
 *  かつ、攻撃が画面で見えはじめたあと */
export function counterEarliest(own, party, lead) {
    const done = own ? (own.hold ? own.hold[1] : own.peak) + DODGE_AFTER : 0;
    const allIn = party.length ? Math.max(...party.map((q) => q.arrive.t0)) + 0.02 : 0;
    const vis = party.length ? party[0].visible : 0;
    return Math.max(done, allIn, vis) + lead;
}
// ---- 直す前の段取り（比べるため。scripts/dodge-timing.mjs の表で使う） ----
/** 直す前の遅れ（arena-timing.ts の lagOf）: 尾は 0〜0.12・ブレスは 0〜0.05、ボスに近い者から */
export const oldLag = (scene, x) => (scene === 'tail' ? Math.max(0, Math.min(1, (x - 150) / 234)) * 0.12 : scene === 'breath' ? Math.max(0, Math.min(1, (x - 150) / 234)) * 0.05 : 0);
/** 直す前の山場（場面の時刻）。型: 型の当たる瞬間＋遅れ＋0.02 / 型を使わない動き: 0.46＋遅れ（伏せるは 0.44〜0.48＋遅れ で伏せきる） */
export function oldPeak(scene, x, evade, pattern) {
    const lag = oldLag(scene, x);
    if (pattern)
        return { peak: (LAB_CONTACT[pattern] ?? 0.4) + lag + 0.02 };
    if (evade === 'crawl')
        return { peak: 0.44 + lag, hold: [0.44 + lag, 0.48 + lag] };
    return { peak: 0.46 + lag };
}
/** 回避を見せ終えてから反撃に移るまでの間（山場・伏せ終わりのあと） */
export const DODGE_AFTER = 0.05;
//# sourceMappingURL=dodgetiming.js.map