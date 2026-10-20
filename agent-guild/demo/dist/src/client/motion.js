// OS の「視差効果を減らす」（prefers-reduced-motion: reduce）に従って、全画面の閃光・白いフラッシュ・画面の揺れを弱める。
// 設定がオフのときは何も変えない（倍率 1・揺れそのまま）。
import { fxLook } from './fxlook.js';
const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
let override = null; // テスト用（null なら OS の設定に従う）
export const reducedMotion = () => (override ?? mq?.matches) === true;
export const setReducedMotionForTest = (v) => { override = v; };
/** 全画面の閃光の明るさに掛ける倍率（弱めるときは 3 割） */
export const FLASH_SCALE_REDUCED = 0.3;
export const flashScale = () => (reducedMotion() ? FLASH_SCALE_REDUCED : 1) * Math.min(1, fxLook().glow); // 光を弱めると、閃光も弱まる
/** 画面の揺れの大きさ（弱めるときは 0） */
export const shakeScale = () => (reducedMotion() ? 0 : 1);
//# sourceMappingURL=motion.js.map