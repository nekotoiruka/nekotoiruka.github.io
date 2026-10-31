// ギルドマスター: 白いひげの魔法使いのおじいさん（紺のローブ・紫の帽子・杖。お供は金色の精霊）。
// 紹介ページ・戦果・講評で、結果を伝える役として顔を出す。
import { h } from './ui.js';
import { drawHero, PORTRAIT_H, PORTRAIT_W } from './hero.js';
import { poseFor } from './chibi.js';
import { tl } from '../shared/i18n.js';
export const GM_LOOK = { body: 'mage', palette: '#3b3f8f', hair: '#f4f1ea', weapon: 'wand' };
export const GM_GEAR = { back: [], fams: [{ kind: 'spirit', color: '#ffd166' }], charms: [{ kind: 'scroll', color: '#feae34' }] };
// 魔法使いのおじいさんの白いひげと眉（drawHero の本体 24x28 の上に、正面向きの顔の位置に合わせて描き足す）
export function elderBeard(ctx, cx, fy, bob) {
    const ox = Math.round(cx - 12), oy = Math.round(fy - 28 + 1);
    const hx = ox + 12, hy = oy + 14 + bob; // 頭の中心（目の高さ）
    const W = '#f4f1ea', S = '#c9c3d6', O = '#5a5470';
    const px = (x, y, w, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, 1); };
    // ふさふさの眉
    px(hx - 4, hy - 2, 3, W);
    px(hx + 2, hy - 2, 3, W);
    // 口ひげ（口の両わき）と、あごから垂れるひげ
    const rows = [[-4, 9], [-5, 11], [-5, 11], [-4, 9], [-3, 7], [-2, 5], [-1, 3]];
    rows.forEach(([x0, w], i) => {
        const y = hy + 2 + i;
        px(hx + x0 - 1, y, 1, O);
        px(hx + x0 + w, y, 1, O);
        px(hx + x0, y, w, i > 3 ? S : W);
        if (i > 0 && i < 4)
            px(hx + x0 + 1, y, 1, S);
    });
    px(hx - 1, hy + 2 + rows.length, 3, O);
    px(hx - 1, hy + 2, 3, '#9b3b4f'); // 口（ひげの間から少し見える）
}
/** 全身の小さな絵（ギルドマスター・先輩冒険者など、語り役の顔）。ゆっくり息をする（画面から外れたら止まる） */
export function speakerPortrait(look, gear, label, cls = 'gm-canvas', extra) {
    const c = h('canvas', { class: `pixel ${cls}`, width: PORTRAIT_W, height: PORTRAIT_H, role: 'img', 'aria-label': label });
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const draw = (frame) => {
        ctx.clearRect(0, 0, PORTRAIT_W, PORTRAIT_H);
        const cx = PORTRAIT_W / 2 + 2, fy = PORTRAIT_H - 3;
        drawHero(ctx, look, gear, cx, fy, { frame, action: 'idle' });
        extra?.(ctx, cx, fy, frame);
    };
    draw(0);
    let raf = 0;
    const t0 = performance.now();
    const tick = (now) => {
        if (!c.isConnected) {
            cancelAnimationFrame(raf);
            return;
        }
        draw(Math.floor(((now - t0) / 1000) * 60));
        raf = requestAnimationFrame(tick);
    };
    // 画面に出てから動かす（作った直後 はまだ DOM に入っていない）
    setTimeout(() => { raf = requestAnimationFrame(tick); }, 0);
    return c;
}
/** ギルドマスターの顔（全身の小さな絵） */
export function gmPortrait(cls = 'gm-canvas') {
    return speakerPortrait(GM_LOOK, GM_GEAR, tl('ギルドマスター'), cls, (ctx, cx, fy, frame) => elderBeard(ctx, cx, fy, poseFor('idle', 0, frame).bob));
}
// 先輩冒険者: 歴戦の侍（深紅の鎧・黒髪・刀。背に大太刀、お供は紅い竜）。出発の前に準備を見てくれる
export const SENPAI_LOOK = { body: 'samurai', palette: '#8f1d2c', hair: '#1c1c28', weapon: 'katana' };
export const SENPAI_GEAR = { back: [{ kind: 'katana', color: '#d8dee9' }], fams: [{ kind: 'dragon', color: '#e0503c' }], charms: [{ kind: 'flame', color: '#ff9f43' }] };
export const senpaiName = () => tl('先輩冒険者 カゲトラ');
export const senpaiPortrait = (cls = 'gm-canvas') => speakerPortrait(SENPAI_LOOK, SENPAI_GEAR, senpaiName(), cls);
/** ギルドマスターが語る吹き出し（顔＋名前＋本文） */
export function gmSays(...body) {
    return h('div', { class: 'gm-says' }, h('div', { class: 'gm-face' }, gmPortrait(), h('span', {}, tl('ギルドマスター'))), h('div', { class: 'gm-bubble' }, ...body.filter((x) => x !== null)));
}
//# sourceMappingURL=guildmaster.js.map