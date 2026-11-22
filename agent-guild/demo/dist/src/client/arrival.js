import { bossOf, hasBoss } from './bossapi.js';
import './bosses/index.js';
import { arrive, BACK, backDelay, IMPACT_T, strikeAt } from './bosskit.js';
export { IMPACT_T, ripNear } from './bosskit.js';
const arrivalOfBoss = (kind) => (hasBoss(kind) ? bossOf(kind).arrival : undefined);
/** その攻撃が、画面で見えはじめる時刻（攻撃そのものが動きだす: 奔流を吐きはじめる・振りはじめる・割れ目が走りはじめる など）。
 *  回避の動き出し（溜めの始まり）と、反撃は、これより前にしない（攻撃を見てからよけたように見せる）。
 *  溜めの予兆（口に光が集まる・腕を振りかぶる）は「来るぞ」の合図で、攻撃そのものではないので、ここには入れない */
//   背後から来る攻撃（BossModule の backScene）は、背後に小さな相手があらわれる時刻（BACK.visible）
//   ボスごとの時刻は BossModule の arrival.visible（src/client/bosses/<kind>.ts）。ないときは 0.34
export const visibleAt = (kind, scene) => arrivalOfBoss(kind)?.visible[scene] ?? 0.34;
/** 攻撃がこの冒険者に届く時刻 */
export function arrivalOf(c) {
    // 背後から来る攻撃（どのボスも同じ段取り。bosskit.ts の backRaid）: 冒険者ごとに少しずらして、背中へ襲いかかる
    if (c.scene === bossOf(c.kind).backScene) {
        const d = backDelay(c.f);
        return arrive(BACK.t0 + d, BACK.t1 + d);
    }
    return arrivalOfBoss(c.kind)?.of?.(c) ?? arrive(IMPACT_T);
}
/** 攻撃が落ちる・叩きつける「場所」（その場所から逃げればかわせる攻撃だけ）。中心 x と、かかる半径 r（床の上の横の幅）の一覧。
 *  ボスごと（BossModule の arrival.zones）。薙ぎ払い・奔流・上から降る攻撃などは空 */
export function impactZones(c) {
    return arrivalOfBoss(c.kind)?.zones?.(c) ?? [];
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
 *  ボスごと（BossModule の arrival.strike）。契約テスト（test/kit/boss-contract.ts）が、回避の型（受ける所・迎え撃つ所・抜ける量・跳ぶ高さ・伏せる高さ）と合っているかを確かめる */
export function strikeOf(c) {
    const a = arrivalOf(c);
    // 背後から来る攻撃: 振り向いて迎え撃つ所（BACK.meet。左右を反転した MEET）・振り向いて受ける所（BACK.guard。左右を反転した GUARD）
    if (c.scene === bossOf(c.kind).backScene) {
        const b = bossOf(c.kind).counters[c.scene].evade === 'turn' ? BACK.guard : BACK.meet;
        return strikeAt(c, b.dx, b.dy);
    }
    return arrivalOfBoss(c.kind)?.strike?.(c, a) ?? strikeAt(c, 0, -12);
}
//# sourceMappingURL=arrival.js.map