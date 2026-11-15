import { STYLE, spriteToWorld } from './bossstyle.js';
import { DIVE_FALL, giantSweepGeo, krakenArmShape, krakenSweepK, spiderLegsAt } from './bossfx.js';
import { bossMotion, makeAt } from './bossmotion.js';
import { BW0, BH0 } from './bossstyle.js';
import { dragonTailAt } from './scenes.js';
import { clamp01, ease, hash, lerp } from './fxkit.js';
export const IMPACT_T = 0.42;
/** その攻撃が、画面で見えはじめる時刻（攻撃そのものが動きだす: 奔流を吐きはじめる・振りはじめる・割れ目が走りはじめる など）。
 *  回避の動き出し（溜めの始まり）と、反撃は、これより前にしない（攻撃を見てからよけたように見せる）。
 *  溜めの予兆（口に光が集まる・腕を振りかぶる）は「来るぞ」の合図で、攻撃そのものではないので、ここには入れない */
export const VISIBLE = {
    dragon: { breath: 0.38, claw: 0.37, dive: 0.33, tail: 0.34 },
    vampire: { breath: 0.38, claw: 0.37, dive: 0.33, tail: 0.3 },
    spider: { breath: 0.38, claw: 0.38, dive: 0.33, tail: 0.35 },
    goblin: { breath: 0.34, claw: 0.3, dive: 0.34, tail: 0.3 },
    // 海からの突き上げ: 足もとの波紋がはっきりする時刻 / 巻き取り: 床を這う触手が伸びてくる時刻
    kraken: { breath: 0.38, claw: 0.35, dive: 0.3, tail: 0.25 },
    // 地割れ: 跳び上がった巨人が、いちばん高い所から落ちはじめる時刻（割れ目は着地 0.42 から走る）
    golem: { breath: 0.36, claw: 0.34, dive: 0.36, tail: 0.35 },
    giant: { breath: 0.38, claw: 0.38, dive: 0.36, tail: 0.35 },
};
export const visibleAt = (kind, scene) => VISIBLE[kind]?.[scene] ?? 0.34;
/** ease（なめらかな 0→1）の逆。v から t を探す */
const easeInv = (v) => { v = clamp01(v); let lo = 0, hi = 1; for (let i = 0; i < 30; i++) {
    const m = (lo + hi) / 2;
    if (ease(m) < v)
        lo = m;
    else
        hi = m;
} return (lo + hi) / 2; };
/** 点 (px,py) と折れ線の、いちばん近い距離 */
function distTo(pts, px, py) {
    let best = 1e9;
    for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
        const t = clamp01(((px - a.x) * dx + (py - a.y) * dy) / l2), qx = a.x + dx * t - px, qy = a.y + dy * t - py;
        best = Math.min(best, Math.hypot(qx, qy));
    }
    return best;
}
/** 形が足もとに触れていた時刻の区間を、細かい時刻ごとに調べる（触れなければ、いちばん近づいた時刻） */
function scan(from, to, near, reach) {
    let t0 = -1, t1 = -1, bestP = from, best = 1e9;
    for (let p = from; p <= to + 1e-9; p += 0.0025) {
        const d = near(p);
        if (d < best) {
            best = d;
            bestP = p;
        }
        if (d <= reach) {
            if (t0 < 0)
                t0 = p;
            t1 = p;
        }
    }
    return t0 < 0 ? { t0: bestP, t1: bestP } : { t0, t1 };
}
/** 攻撃がこの冒険者に届く時刻 */
export function arrivalOf(c) {
    const { kind, scene, x, y, foot, W } = c;
    const sa = { foot, phase: 0, partyX: c.partyX, W, scene };
    const fixed = (t0, t1 = t0 + 0.04) => ({ t0, t1 });
    // 口から右へ流れる奔流（竜の炎・氷の巨人の息）: 先が届く → 根もとから消えて、ここを通りすぎる
    const stream = (head0, head1, cut0, cut1) => {
        const mo = makeAt(foot, bossMotion(kind, 'breath', 'breath', head1), BW0, BH0)(STYLE[kind].mouth[0], STYLE[kind].mouth[1]);
        const reach = W + 30 - mo.x, u = clamp01((x - mo.x - 4) / reach);
        return { t0: head0 + (head1 - head0) * easeInv(u), t1: cut0 + (cut1 - cut0) * u };
    };
    switch (scene) {
        case 'breath': {
            if (kind === 'dragon')
                return stream(0.38, 0.43, 0.58, 0.66);
            if (kind === 'giant')
                return stream(0.38, 0.44, 0.52, 0.62);
            if (kind === 'vampire') { // 蝙蝠の群れ: 自分の段を通る蝙蝠が、自分の x に来る時刻（bossfx.ts の vampire.breath）
                const cx = spriteToWorld(foot, STYLE.vampire.body).x + 14, k = easeInv((x - 22 - cx) / (W + 40 - cx)); // 蝙蝠の翼の先が、体の前の端（中心の 22 手前）に届く時刻
                const lane = c.lanes.length ? c.lanes.reduce((b, l) => (Math.abs(l - y) < Math.abs(b - y) ? l : b), c.lanes[0]) : y;
                let t0 = 1, t1 = 0;
                for (let i = 0; i < 24; i++) {
                    if (c.lanes.length && c.lanes[Math.floor(hash(i, 2) * c.lanes.length)] !== lane)
                        continue;
                    const p = 0.38 + 0.22 * (k * 0.7 + hash(i, 1) * 0.3);
                    t0 = Math.min(t0, p);
                    t1 = Math.max(t1, p);
                }
                return t0 > t1 ? fixed(0.45) : { t0, t1 };
            }
            if (kind === 'goblin') { // 矢の雨: 自分に割り当てられた矢（i % 人数）が刺さる時刻（rel 0.83×0.36＋ずらし）
                let t0 = 1, t1 = 0;
                for (let i = 0; i < 26; i++) {
                    if (c.n && i % c.n !== c.idx)
                        continue;
                    const rel = 0.83 * 0.36 + hash(i, 1) * 0.32, p = 0.34 + 0.26 * rel;
                    t0 = Math.min(t0, p);
                    t1 = Math.max(t1, p);
                }
                return t0 > t1 ? fixed(0.44) : { t0, t1 };
            }
            if (kind === 'golem') { // 石礫: 自分に飛ぶ岩（i % 人数）が届く時刻（t=1 → rel = 0.45＋ずらし×0.25）
                const n = Math.max(6, c.n * 2);
                let t0 = 1, t1 = 0;
                for (let i = 0; i < n; i++) {
                    if (c.n && i % c.n !== c.idx)
                        continue;
                    const p = 0.36 + 0.2 * (0.45 + hash(i, 1) * 0.25);
                    t0 = Math.min(t0, p);
                    t1 = Math.max(t1, p);
                }
                return t0 > t1 ? fixed(0.46) : { t0, t1 };
            }
            if (kind === 'spider' || kind === 'kraken')
                return fixed(0.38 + 0.12 * 0.7, 0.58); // 糸・墨: rel 0.7 で届き、0.54〜0.62 に消える
            return fixed(IMPACT_T);
        }
        case 'claw': {
            if (kind === 'dragon' || kind === 'vampire') { // 討伐隊ぜんたいを裂く大きな爪痕: まん中の爪痕が、自分の高さを通る時刻
                const [i, y0, a0, a1, sp] = kind === 'dragon' ? [1, 48, 0.39, 0.45, 1.5] : [2, 60, 0.4, 0.45, 1.6];
                const t = easeInv(clamp01((y - 12 - y0) / (214 - y0)));
                return fixed(a0 + (a1 - a0) * clamp01((t + i * 0.12) / sp), 0.5);
            }
            if (kind === 'spider')
                return fixed(0.4 + 0.07 * 0.6, 0.5); // 牙が閉じる
            if (kind === 'goblin')
                return fixed(0.43, 0.56); // 穴があき、杭が突き上がる
            if (kind === 'golem')
                return fixed(0.43 + hash(c.f, 7) * 0.02, 0.5); // 拳が落ちる（冒険者ごとにずらす）
            if (kind === 'giant')
                return fixed(0.38 + 0.09 * clamp01((1 + (c.idx % Math.max(1, Math.min(6, c.n))) * 0.04) / 1.2), 0.5); // 槍が刺さる
            if (kind === 'kraken')
                return scan(0.35, 0.5, (p) => { const k = krakenSweepK(p); return distTo(krakenArmShape({ foot, phase: p }, k.sw, k.back).map(([px, py]) => ({ x: px, y: py })), x, y - 2); }, 12); // 触手の薙ぎ
            return fixed(IMPACT_T);
        }
        case 'dive': {
            if (kind === 'dragon' || kind === 'vampire' || kind === 'spider')
                return fixed(DIVE_FALL.hit, 0.47); // 真上から突っこむ
            if (kind === 'goblin')
                return fixed(0.44, 0.5); // 投げた岩が落ちる
            if (kind === 'kraken')
                return fixed(0.42, 0.5); // 足もとから触手が突き上がる
            if (kind === 'golem') { // 地割れ: 着地（0.42）から右へ走る割れ目が、自分の x に届く時刻
                const x0 = foot.x + 44, len = (W - foot.x) * 0.95;
                return fixed(0.42 + 0.08 * easeInv(clamp01((x - x0) / (len * 0.98))), 0.56);
            }
            if (kind === 'giant') { // 踏みつけ: 床を走る衝撃の輪が、自分の x に届く時刻
                const b = clamp01((x - foot.x - 10 - 16) / 300);
                return fixed(0.4 + 0.2 * b, 0.4 + 0.2 * b + 0.06);
            }
            return fixed(IMPACT_T);
        }
        case 'tail': {
            if (kind === 'dragon')
                return scan(0.34, 0.5, (p) => distTo(dragonTailAt({ foot, phase: p }).pts.map(([px, py]) => ({ x: px, y: py })), x, y - 2), 12);
            if (kind === 'spider')
                return scan(0.35, 0.5, (p) => Math.min(...spiderLegsAt({ ...sa, phase: p }).map((l) => distTo(l.w, x, y - 2))), 10);
            if (kind === 'kraken')
                return fixed(0.42, 0.5); // 巻き取り: 0.4 に足もとへ届き、0.38〜0.5 で巻きつく
            if (kind === 'golem' || kind === 'giant') { // 大きな弧の先の向きが、自分の向きを通る時刻
                const pivot = spriteToWorld(foot, kind === 'golem' ? [58, 44] : [60, 42]);
                const g = giantSweepGeo(sa, pivot), af = Math.atan2((y - g.cy) / g.sq, x - pivot.x);
                const p = 0.35 + 0.11 * easeInv((af - g.a0) / (g.a1 - g.a0));
                return fixed(p, p + 0.05);
            }
            if (kind === 'vampire') {
                const d = hash(c.f, 3) * 0.03;
                return fixed(0.39 + d + 0.05 * 0.5, 0.47 + d);
            } // 背後の蝙蝠が襲いかかる
            if (kind === 'goblin') { // 突撃: 先頭のゴブリンが自分の x に来る時刻
                const u = easeInv(clamp01((x - foot.x - 10 + 20) / (W + 70 - foot.x)));
                return fixed(0.3 + 0.22 * u, 0.3 + 0.22 * u + 0.08);
            }
            return fixed(IMPACT_T);
        }
    }
    return fixed(IMPACT_T);
}
void lerp;
/** 攻撃が落ちる・叩きつける「場所」（その場所から逃げればかわせる攻撃だけ）。中心 x と、かかる半径 r（床の上の横の幅）。
 *  真上から降る急降下（竜・伯爵・大蜘蛛）・投石・岩の拳。それ以外（薙ぎ払い・奔流・矢の雨など）は null */
export function impactZone(c) {
    if (c.scene === 'dive' && (c.kind === 'dragon' || c.kind === 'vampire' || c.kind === 'spider'))
        return { x: c.W * 0.68, r: 58 }; // bossfx.ts の fallingBoss（体の幅 96 を、着地のつぶれで少し広げた半分）
    if (c.scene === 'dive' && c.kind === 'goblin') {
        const xs = c.xs?.length ? c.xs : [c.x];
        return { x: xs.reduce((a, b) => a + b, 0) / xs.length, r: 22 };
    } // 投石: 討伐隊のまん中に落ちる大岩と砕けるかけら
    if (c.scene === 'claw' && c.kind === 'golem')
        return { x: c.x - 16, r: 16 }; // 岩の拳: 正しく動けた人の少し手前に落ちる
    return null;
}
/** 身のこなし（前転・バックステップ・残像よけ・変わり身）で、体を横へ動かす量（画面のドット。+ が右＝ボスから離れる向き）。
 *  落ちる場所があれば、そこから体（半幅 8）が抜けきる所まで。なければ、ボスから離れる向きへ def */
export function escapeDx(c, def = 30) {
    const z = impactZone(c), lo = 150, hi = c.W - 10;
    const fit = (dx) => c.x + dx >= lo && c.x + dx <= hi;
    if (!z)
        return fit(def) ? def : -def;
    const need = z.r + 8, first = c.x >= z.x ? 1 : -1;
    // もともと落ちる場所の外にいる人は、そこから離れる向きへ（端に近ければ、動ける分だけ）
    if (Math.abs(c.x - z.x) >= need) {
        const room = first > 0 ? hi - c.x : c.x - lo;
        return first * Math.max(0, Math.min(def, room));
    }
    const go = (dir) => { const dx = z.x + dir * need - c.x; return Math.abs(dx) < def ? dir * def : dx; };
    for (const dir of [first, -first]) {
        const dx = go(dir);
        if (fit(dx))
            return dx;
    }
    return go(first);
}
//# sourceMappingURL=arrival.js.map