import { STYLE, spriteToWorld } from './bossstyle.js';
import { DIVE_AIM_DX, DIVE_FALL, GOBLIN_CHARGE, VAMP_BATS_DY, STREAM_AT, streamAim, INK_OVER, RIP, SWEEP_AT, giantStompAt, giantSweepGeo, golemCrackPath, krakenArmShape, krakenSweepK, pathAt, ripMarks, ripX, spiderLegsAt } from './bossfx.js';
import { GUARD, MEET } from './reach.js';
import { bossMotion, makeAt } from './bossmotion.js';
import { BW0, BH0 } from './bossstyle.js';
import { dragonTailAt } from './scenes.js';
import { clamp01, ease, hash, lerp } from './fxkit.js';
export const IMPACT_T = 0.42;
const aimOf = (c) => c.aim ?? { x: c.x, y: c.y };
/** 段の一覧（上から順）と、この冒険者の段の番号（ゴブリンの突撃・地割れ。bossfx.ts の goblinLanes と同じ並び） */
const laneOf = (c) => { const ls = c.lanes.length ? [...c.lanes].sort((p, q) => p - q) : [c.y]; let j = 0; ls.forEach((l, i) => { if (Math.abs(l - c.y) < Math.abs(ls[j] - c.y))
    j = i; }); return { ls, j }; };
/** 折れ線のうえで、x に来るまでの長さの割合 */
function fracAtX(pts, x) {
    const L = pts.slice(1).reduce((s, q, i) => s + Math.hypot(q.x - pts[i].x, q.y - pts[i].y), 0);
    let d = 0;
    for (let i = 1; i < pts.length; i++) {
        const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        if (pts[i].x >= x)
            return clamp01((d + l * clamp01((x - pts[i - 1].x) / Math.max(1e-6, pts[i].x - pts[i - 1].x))) / L);
        d += l;
    }
    return 1;
}
/** 大きな爪痕のうち、この冒険者のいちばん近くを通る一本（受け止める・横へ抜ける所の高さで） */
export function ripNear(c) {
    const kind = c.kind === 'vampire' ? 'vampire' : 'dragon', R0 = RIP[kind], ty = c.y + R0.at.dy, tx = c.x + R0.at.dx;
    const ms = ripMarks(c.W, kind, aimOf(c));
    let i = 0;
    ms.forEach((m, k) => { if (Math.abs(ripX(m, ty) - tx) < Math.abs(ripX(ms[i], ty) - tx))
        i = k; });
    return { i, m: ms[i], x: ripX(ms[i], ty), y: ty, all: ms.map((m) => ripX(m, ty)) };
}
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
            if (kind === 'dragon' || kind === 'vampire') { // 討伐隊ぜんたいを裂く大きな爪痕: いちばん近くを通る爪痕の先が、自分の高さ（受ける・抜ける所）を通る時刻
                const R0 = RIP[kind], { i, m, y: ty } = ripNear(c), t = easeInv(clamp01((ty - m.y0) / (m.y1 - m.y0)));
                return fixed(R0.a0 + (R0.a1 - R0.a0) * clamp01((t + i * 0.12) / R0.sp), 0.5);
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
                return scan(0.35, 0.5, (p) => { const k = krakenSweepK(p); return distTo(krakenArmShape({ foot, phase: p, aim: aimOf(c) }, k.sw, k.back).map(([px, py]) => ({ x: px, y: py })), x, y - 2); }, 12); // 触手の薙ぎ
            return fixed(IMPACT_T);
        }
        case 'dive': {
            if (kind === 'dragon' || kind === 'vampire' || kind === 'spider')
                return fixed(DIVE_FALL.hit, 0.47); // 真上から突っこむ
            if (kind === 'goblin')
                return fixed(0.44, 0.5); // 投げた岩が落ちる
            if (kind === 'kraken')
                return fixed(0.42, 0.5); // 足もとから触手が突き上がる
            if (kind === 'golem') { // 地割れ: 着地（0.42）から、自分の段へ走る割れ目（bossfx.ts の golemCrackPath）が、自分の x に届く時刻
                const { ls, j } = laneOf(c);
                return fixed(0.42 + 0.08 * easeInv(fracAtX(golemCrackPath({ foot, W }, ls[j], j), x)), 0.56);
            }
            if (kind === 'giant') { // 踏みつけ: 床を走る衝撃の輪が、自分の x に届く時刻（その時刻に、足もとから氷のとげが突き出す）
                const t0 = giantStompAt({ foot }, x);
                return fixed(t0, t0 + 0.06);
            }
            return fixed(IMPACT_T);
        }
        case 'tail': {
            if (kind === 'dragon')
                return scan(0.34, 0.5, (p) => distTo(dragonTailAt({ foot, phase: p, aim: aimOf(c) }).pts.map(([px, py]) => ({ x: px, y: py })), x, y - 2), 12);
            // 脚の薙ぎはらい: 脚が、迎え撃つ所（MEET）を通る時刻
            if (kind === 'spider')
                return scan(0.35, 0.5, (p) => Math.min(...spiderLegsAt({ ...sa, phase: p, aim: aimOf(c) }).map((l) => distTo(l.w, x + MEET.dx, y + MEET.dy))), 12);
            if (kind === 'kraken')
                return fixed(0.42, 0.5); // 巻き取り: 0.4 に足もとへ届き、0.38〜0.5 で巻きつく
            if (kind === 'golem' || kind === 'giant') { // 大きな弧の先の向きが、自分の所（伏せた頭の上・迎え撃つ所）の向きを通る時刻
                const pivot = spriteToWorld(foot, kind === 'golem' ? [58, 44] : [60, 42]), at = SWEEP_AT[kind];
                const g = giantSweepGeo(sa, pivot, aimOf(c), at), af = Math.atan2((y + at.dy - g.cy) / g.sq, x + at.dx - pivot.x);
                const p = 0.35 + 0.11 * easeInv((af - g.a0) / (g.a1 - g.a0));
                return fixed(p, p + 0.05);
            }
            if (kind === 'vampire') {
                const d = hash(c.f, 3) * 0.03;
                return fixed(0.39 + d + 0.05 * 0.5, 0.47 + d);
            } // 背後の蝙蝠が襲いかかる
            if (kind === 'goblin') { // 突撃: 自分の段の先頭のゴブリンの槍の先が、受け止める所（GUARD）に来る時刻（bossfx.ts の goblin.tail）
                const { j } = laneOf(c), lead = x + GUARD.dx - GOBLIN_CHARGE.reach + GOBLIN_CHARGE.back + GOBLIN_CHARGE.stag(j);
                const u = easeInv(clamp01((lead - foot.x - 10) / (W + 70 - foot.x)));
                return fixed(GOBLIN_CHARGE.t0 + 0.22 * u, GOBLIN_CHARGE.t0 + 0.22 * u + 0.08);
            }
            return fixed(IMPACT_T);
        }
    }
    return fixed(IMPACT_T);
}
void lerp;
/** 攻撃が落ちる・叩きつける「場所」（その場所から逃げればかわせる攻撃だけ）。中心 x と、かかる半径 r（床の上の横の幅）の一覧。
 *  急降下（伯爵・大蜘蛛）・投石は狙う人（aim）の所、糸の網・落とし穴・岩の拳・氷の槍・氷のとげは自分の立ち位置、竜の爪痕は自分の高さを通る爪痕ぜんぶ。
 *  それ以外（薙ぎ払い・奔流・矢の雨など）は空 */
export function impactZones(c) {
    const { kind, scene } = c;
    if (scene === 'dive' && (kind === 'dragon' || kind === 'vampire' || kind === 'spider'))
        return [{ x: aimOf(c).x + DIVE_AIM_DX, r: 58 }]; // bossfx.ts の fallingBoss（体の幅 96 を、着地のつぶれで少し広げた半分）
    if (scene === 'dive' && kind === 'goblin')
        return [{ x: aimOf(c).x, r: 22 }]; // 投石: 狙う人の足もとに落ちる大岩と砕けるかけら
    if (scene === 'dive' && kind === 'giant')
        return [{ x: c.x, r: 9 }]; // 足もとから突き出す氷のとげ
    if (scene === 'claw' && kind === 'golem')
        return [{ x: c.x, r: 22 }]; // 岩の拳: 立ち位置に落ちる（拳と指の幅）
    if (scene === 'claw' && kind === 'goblin')
        return [{ x: c.x, r: 15 }]; // 落とし穴
    if (scene === 'claw' && kind === 'giant')
        return [{ x: c.x, r: 16 }]; // 氷の槍が刺さる所（穂先が少し先まで出る）
    if (scene === 'claw' && kind === 'dragon')
        return ripNear(c).all.map((x) => ({ x, r: 9 })); // 爪痕（自分の高さを通る所）
    if (scene === 'breath' && kind === 'spider')
        return [{ x: c.x, r: 24 }]; // 糸の網（bossfx.ts の webNet の半径）
    return [];
}
/** いちばん近い落ちる場所（なければ null） */
export function impactZone(c) {
    const zs = impactZones(c);
    return zs.length ? zs.reduce((b, z) => (Math.abs(z.x - c.x) < Math.abs(b.x - c.x) ? z : b)) : null;
}
/** 身のこなし（前転・バックステップ・残像よけ・変わり身）で、体を横へ動かす量（画面のドット。+ が右＝ボスから離れる向き）。
 *  落ちる場所があれば、どの場所からも体（半幅 8）が抜けきる所まで。なければ、ボスから離れる向きへ def */
export function escapeDx(c, def = 30) {
    const zs = impactZones(c), lo = 150, hi = c.W - 10;
    const fit = (dx) => c.x + dx >= lo && c.x + dx <= hi;
    if (!zs.length)
        return fit(def) ? def : -def;
    const clear = (dx) => zs.every((z) => Math.abs(c.x + dx - z.x) >= z.r + 8);
    const z = impactZone(c), first = c.x >= z.x ? 1 : -1;
    // 離れる向きへ def から遠くへ → 離れる向きへ近くへ（端に近いとき）→ 逆の向きへ
    for (const [dir, ms] of [[first, range(def, 140, 2)], [first, range(def - 2, 0, -2)], [-first, range(def, 140, 2)]])
        for (const m of ms)
            if (fit(dir * m) && clear(dir * m))
                return dir * m;
    return first * def;
}
const range = (a, b, st) => { const o = []; for (let v = a; st > 0 ? v <= b : v >= b; v += st)
    o.push(v); return o; };
/** 攻撃がこの冒険者に届く瞬間（t0）に、攻撃のいちばん当たる所（画面の座標）と、かかる幅 r。
 *  正しく動けた人への攻撃（受け止められる・迎え撃たれる・元いた所に当たる）として。大きな攻撃は aim（ないときはこの冒険者）を狙う。
 *  test/dodge-timing.test.ts が、回避の型（受ける所・迎え撃つ所・抜ける量・跳ぶ高さ・伏せる高さ）と合っているかを確かめる */
export function strikeOf(c) {
    const { kind, scene, x, y, foot, W } = c, aim = aimOf(c), a = arrivalOf(c);
    const near = (pts, px, py) => { let b = pts[0], bd = 1e9; for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i], p1 = pts[i + 1], dx = p1.x - p0.x, dy = p1.y - p0.y, l2 = dx * dx + dy * dy || 1, t = clamp01(((px - p0.x) * dx + (py - p0.y) * dy) / l2), q = { x: p0.x + dx * t, y: p0.y + dy * t }, d = Math.hypot(q.x - px, q.y - py);
        if (d < bd) {
            bd = d;
            b = q;
        }
    } return b; };
    // 奔流: 自分の列（x）を通る、まん中の筋（広がりの 0.6）。下がり方と広がりは、狙う人を通るように（bossfx.ts の streamAim）
    const stream = (S) => {
        const mo = makeAt(foot, bossMotion(kind, 'breath', 'breath', a.t0), BW0, BH0)(STYLE[kind].mouth[0], STYLE[kind].mouth[1]);
        const sa = streamAim(mo, W, aim.x + S.dx, aim.y + S.dy, S.drop, S.spread), u = Math.max(0.05, clamp01((x + S.dx - mo.x - 4) / (W + 30 - mo.x)));
        return { x: x + S.dx, y: mo.y + 2 + sa.drop * u, r: 0.6 * sa.spread * Math.pow(u, 0.9), band: true };
    };
    const at = (dx, dy, r = 6) => ({ x: x + dx, y: y + dy, r });
    switch (scene) {
        case 'breath':
            if (kind === 'dragon')
                return stream(STREAM_AT.dragon);
            if (kind === 'giant')
                return stream(STREAM_AT.giant);
            if (kind === 'vampire') {
                const { ls, j } = laneOf(c);
                return { x, y: ls[j] - VAMP_BATS_DY, r: 6 };
            } // 蝙蝠の群れは、段の頭の高さを通る
            if (kind === 'spider')
                return at(0, -12, 24); // 糸の網（元いた所）
            if (kind === 'kraken')
                return at(INK_OVER.dx, INK_OVER.dy); // 伏せた頭の上を通る墨
            return at(GUARD.dx - 4, kind === 'goblin' ? -2 : -6, 18); // 矢・石礫: 受け止めた人の前に刺さる・砕ける
        case 'claw':
            if (kind === 'dragon' || kind === 'vampire') {
                const n = ripNear(c);
                return { x: n.x, y: n.y, r: 7 };
            }
            if (kind === 'spider')
                return at(GUARD.dx - 4, -20, 8); // 牙が受け止めた人の前で閉じる
            if (kind === 'goblin')
                return at(0, 2, 15); // 落とし穴
            if (kind === 'golem')
                return at(0, -2, 22); // 岩の拳
            if (kind === 'giant')
                return at(0, -12, 16); // 氷の槍
            if (kind === 'kraken') {
                const k = krakenSweepK(a.t0);
                return { ...near(krakenArmShape({ foot, phase: a.t0, aim }, k.sw, k.back).map(([px, py]) => ({ x: px, y: py })), x, y - 2), r: 8 };
            }
            break;
        case 'dive':
            if (kind === 'dragon' || kind === 'vampire' || kind === 'spider')
                return { x: aim.x + DIVE_AIM_DX, y: aim.y, r: 58 };
            if (kind === 'goblin')
                return { x: aim.x, y: aim.y - 4, r: 22 };
            if (kind === 'kraken')
                return at(0, 0, 8); // 足もとから突き上がる触手
            if (kind === 'giant')
                return at(0, 1, 9); // 足もとの氷のとげ
            if (kind === 'golem') {
                const { ls, j } = laneOf(c);
                return { ...pathAt(golemCrackPath({ foot, W }, ls[j], j), clamp01(ease(clamp01((a.t0 - 0.42) / 0.08)))), r: 4 };
            }
            break;
        case 'tail':
            if (kind === 'dragon')
                return { ...near(dragonTailAt({ foot, phase: a.t0, aim }).pts.map(([px, py]) => ({ x: px, y: py })), x, y - 2), r: 8 };
            if (kind === 'spider') {
                const ls = spiderLegsAt({ foot, phase: a.t0, partyX: c.partyX, scene, aim });
                const ps = ls.map((l) => near(l.w, x + MEET.dx, y + MEET.dy));
                return { ...ps.reduce((b, q) => (Math.hypot(q.x - x - MEET.dx, q.y - y - MEET.dy) < Math.hypot(b.x - x - MEET.dx, b.y - y - MEET.dy) ? q : b)), r: 6 };
            }
            if (kind === 'kraken')
                return at(MEET.dx + 4, MEET.dy + 6); // 迎え撃つ所まで這い上がる触手の先
            if (kind === 'vampire')
                return at(26, -18); // 背後の蝙蝠（振り向いて迎え撃つ所）
            if (kind === 'goblin')
                return at(GUARD.dx, -8); // 槍の先
            if (kind === 'golem' || kind === 'giant') {
                const pivot = spriteToWorld(foot, kind === 'golem' ? [58, 44] : [60, 42]), sa = SWEEP_AT[kind], g = giantSweepGeo({ foot, W }, pivot, aim, sa);
                const af = Math.atan2((y + sa.dy - g.cy) / g.sq, x + sa.dx - pivot.x);
                return { x: pivot.x + Math.cos(af) * g.r, y: g.cy + Math.sin(af) * g.r * g.sq, r: 11 };
            }
            break;
    }
    return at(0, -12);
}
//# sourceMappingURL=arrival.js.map