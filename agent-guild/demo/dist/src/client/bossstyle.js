export const BW0 = 96, BH0 = 84;
/** 絵の中の位置 → 画面の位置（待機のポーズ・動きなしのとき）。足もと foot = 絵の下の中心（boss.x, boss.y） */
export const spriteToWorld = (foot, p) => ({ x: foot.x - BW0 / 2 + p[0], y: foot.y + 2 - BH0 + p[1] });
//# sourceMappingURL=bossstyle.js.map