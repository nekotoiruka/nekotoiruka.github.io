// ボスの攻撃が「どこへ」届くか（#120）。攻撃の演出（bosses/<kind>-fx.ts・bosskit.ts）と、届く時刻・抜ける量（arrival.ts）と、
// 見本帳の型（motionlab.ts）の三つが同じ場所を使うための、小さな決まりごと。ほかのモジュールを読みこまない（循環しないように）。
//
//   ・冒険者ひとりずつに飛ぶ攻撃（糸・墨・槍・拳・穴・杭・矢など）は、その人の立ち位置（slot）を狙う。
//     受ける・迎え撃つ人の前では、手前（GUARD・MEET）で止まる。身をかわす人には、元いた場所に当たる（体は型の動きで抜けている）
//   ・ボスが一つしかない大きな攻撃（急降下の着地・大岩・大きな爪痕・薙ぎ払いの弧）は、狙う人（focusOf）を一人決めて、そこへ届かせる。
//     1人に寄る窓（紹介ページ・見本帳）はその人、討伐画面は自分の冒険者、どちらもいなければ討伐隊のまん中
/** 受け止める（盾・武器で受ける）型が、攻撃を受ける所（立ち位置からのずれ。左がボス） */
export const GUARD = { dx: -12, dy: -14 };
/** 迎え撃つ（斬りはらう・打ち砕く・撃ち落とす）型が、攻撃に当てる所（立ち位置からのずれ。motionlab.ts の PAIR_REACH の TX・TY） */
export const MEET = { dx: -30, dy: -17 };
/** 大きな攻撃が狙う所（足もと）: 1人に寄る窓の人 → 自分の冒険者 → 討伐隊のまん中 */
export function focusOf(fighters, solo) {
    const hs = fighters.filter((v) => v.alive);
    const me = solo !== undefined && solo !== null ? hs.find((v) => v.f === solo) : hs.find((v) => v.mine);
    if (me)
        return { x: me.x, y: me.y };
    if (!hs.length)
        return null;
    return { x: hs.reduce((s, v) => s + v.x, 0) / hs.length, y: hs.reduce((s, v) => s + v.y, 0) / hs.length };
}
//# sourceMappingURL=reach.js.map