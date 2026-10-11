export const STYLE = {
    dragon: { mouth: [94, 32], eye: [74, 27], head: [76, 30], body: [46, 54], hand: [66, 58], tail: [8, 46], glow: ['#fff2b0', '#ff6a2a'], smoke: '#9a96a6', eyeGlow: '#ff3040', voice: '#d9a8ff', dust: '#c8b48a', flies: true },
    spider: { mouth: [74, 56], eye: [70, 44], head: [68, 46], body: [48, 52], hand: [76, 58], tail: [8, 46], glow: ['#ffffff', '#9ad0ff'], smoke: '#e4e7f0', eyeGlow: '#ff2030', voice: '#c8d8ff', dust: '#9a8aa8' },
    goblin: { mouth: [64, 39], eye: [64, 28], head: [62, 30], body: [52, 52], hand: [78, 24], tail: [22, 24], glow: ['#fff2b0', '#feae34'], smoke: '#c8b48a', eyeGlow: '#f2e24a', voice: '#fff2b0', dust: '#c8b48a' },
    kraken: { mouth: [86, 57], eye: [73, 45], head: [66, 44], body: [56, 42], hand: [84, 62], tail: [10, 52], glow: ['#d8f2ff', '#3fa0e0'], smoke: '#bfe8ff', eyeGlow: '#ffd23f', voice: '#9fe8ff', dust: '#d8f2ff', ground: { y0: 68, followX: false } },
    golem: { mouth: [62, 18], eye: [60, 12], head: [58, 14], body: [44, 46], hand: [82, 54], tail: [14, 46], glow: ['#e0fffa', '#30d0c0'], smoke: '#c8b48a', eyeGlow: '#30d0c0', voice: '#7af0e0', dust: '#c8b48a' },
    vampire: { mouth: [61, 29], eye: [60, 22], head: [58, 22], body: [48, 46], hand: [78, 50], tail: [18, 52], glow: ['#ffd0e0', '#d02050'], smoke: '#7a3a9a', eyeGlow: '#ff2030', voice: '#ff9ad0', dust: '#7a3a9a', flies: true, ground: { y0: 73, followX: true } },
    giant: { mouth: [53, 29], eye: [53, 24], head: [52, 24], body: [48, 44], hand: [88, 50], tail: [20, 44], glow: ['#ffffff', '#9fd8ff'], smoke: '#e6f6ff', eyeGlow: '#8fd3ff', voice: '#bfe8ff', dust: '#e6f6ff' },
};
export const BW0 = 96, BH0 = 84;
/** 絵の中の位置 → 画面の位置（待機のポーズ・動きなしのとき）。足もと foot = 絵の下の中心（boss.x, boss.y） */
export const spriteToWorld = (foot, p) => ({ x: foot.x - BW0 / 2 + p[0], y: foot.y + 2 - BH0 + p[1] });
//# sourceMappingURL=bossstyle.js.map