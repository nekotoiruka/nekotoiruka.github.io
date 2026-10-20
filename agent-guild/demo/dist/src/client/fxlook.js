export const ULT_CRISP = 1;
export const FX_LOOK_DEFAULT = { glow: 1, crisp: 'auto' };
/** いまの見た目（くっきり化の前）。演出ギャラリーで「前の見た目」と見比べるため */
export const FX_LOOK_BEFORE = { glow: 1, crisp: 0 };
let look = { ...FX_LOOK_DEFAULT };
export const fxLook = () => look;
export function setFxLook(v) { look = { ...look, ...v }; }
// 4x4 の市松の表（しきい値 0..1）
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
/** エフェクトだけを描いた画像（ImageData）の半透明を段に分ける。ox, oy は市松をそろえるための画面上の位置 */
export function crispen(img, crisp) {
    if (crisp === 0)
        return;
    const d = img.data, w = img.width;
    const step = crisp === 2 ? 48 : 32; // 色の段の幅（大きいほど色数が減る）
    for (let i = 0, n = d.length; i < n; i += 4) {
        const a = d[i + 3];
        if (a === 0)
            continue;
        const k = a / 255;
        let out;
        if (crisp === 1)
            out = k < 0.15 ? 0 : Math.round(k * 3) * 85; // いちばん近い段（1/3・2/3・全部）へ。切り上げると、7割の閃光が真っ白になる
        else if (k < 0.25) {
            const p = i >> 2, x = p % w, y = (p / w) | 0;
            out = k / 0.25 > BAYER[((y & 3) << 2) | (x & 3)] ? 85 : 0;
        } // ごく薄い所（にじみの外側）だけ、市松に間引く
        else
            out = k < 0.5 ? 85 : k < 0.83 ? 170 : 255; // 画面を暗くする幕などの大きな半透明は、間引かずに3段で
        d[i + 3] = out;
        if (out)
            for (let c = 0; c < 3; c++)
                d[i + c] = Math.min(255, Math.round(d[i + c] / step) * step);
    }
}
// 文字（技名・ダメージの数字など）は、くっきり化すると読みにくくなるので、エフェクトの画面には描かず、
// 重ねたあとに元の細かさで描く。fxLayer が描いているあいだだけ、その画面と「あとで描く」列を覚えておく
let deferring = null;
export function beginDefer(layer, sc) { deferring = { layer, sc, queue: [] }; }
export function endDefer() { const q = deferring?.queue ?? []; deferring = null; return q; }
/** ctx がエフェクトの画面なら、描く処理を「あとで描く」列に回して true を返す */
export function deferText(ctx, draw) {
    if (!deferring || ctx !== deferring.layer)
        return false;
    const m = ctx.getTransform(), sc = deferring.sc, alpha = ctx.globalAlpha;
    deferring.queue.push((main) => { main.save(); main.setTransform(m.a * sc, m.b * sc, m.c * sc, m.d * sc, m.e * sc, m.f * sc); main.globalAlpha = alpha; draw(main); main.restore(); });
    return true;
}
//# sourceMappingURL=fxlook.js.map