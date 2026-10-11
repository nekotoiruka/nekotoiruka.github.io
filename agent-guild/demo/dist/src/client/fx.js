import { TOOL_BY_ID } from '../shared/catalog.js';
import { Rng } from '../shared/rng.js';
import { shade } from './sprites.js';
import { PIXEL_FONT, tl } from '../shared/i18n.js';
export const BODY_STYLE = {
    knight: 'holy', mage: 'arcane', rogue: 'shadow', robot: 'tech', cat: 'paw', ninja: 'leaf',
    priest: 'holy', pirate: 'shadow', samurai: 'leaf', chef: 'paw', astro: 'tech', bunny: 'paw', bear: 'paw', frog: 'leaf', witch: 'arcane', ghostie: 'shadow',
};
export const STYLE_LABEL = { holy: tl('聖光'), arcane: tl('魔法陣'), shadow: tl('影'), tech: tl('電子'), paw: tl('肉球'), leaf: tl('木の葉') };
export function fxColors(style, l) {
    switch (style) {
        case 'holy': return { main: '#ffe27a', sub: l.hair, light: '#ffffff' };
        case 'arcane': return { main: shade(l.palette, 0.35), sub: '#c77dff', light: '#ffffff' };
        case 'shadow': return { main: '#8e44ad', sub: shade(l.palette, -0.3), light: '#e2c2ff' };
        case 'tech': return { main: '#5fcde4', sub: l.hair, light: '#d8fff6' };
        case 'paw': return { main: '#ff9ce6', sub: l.hair, light: '#ffffff' };
        case 'leaf': return { main: '#63c74d', sub: l.hair, light: '#e3ffc8' };
    }
}
const TAU = Math.PI * 2;
const px = (ctx, x, y, w = 1, h = 1) => ctx.fillRect(Math.round(x), Math.round(y), w, h);
// 体型ごとの小さな粒
export function particle(ctx, style, c, x, y, a, rot = 0) {
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    switch (style) {
        case 'holy':
            ctx.fillStyle = c.light;
            px(ctx, x - 1, y, 3, 1);
            px(ctx, x, y - 1, 1, 3);
            ctx.fillStyle = c.main;
            px(ctx, x, y);
            break;
        case 'arcane':
            ctx.fillStyle = c.main;
            px(ctx, x, y - 1);
            px(ctx, x - 1, y);
            px(ctx, x + 1, y);
            px(ctx, x, y + 1);
            ctx.fillStyle = c.light;
            px(ctx, x, y);
            break;
        case 'shadow':
            ctx.fillStyle = c.main;
            px(ctx, x - 1, y - 1, 3, 3);
            ctx.fillStyle = c.sub;
            px(ctx, x, y);
            break;
        case 'tech':
            ctx.fillStyle = Math.floor(rot * 10) % 2 ? c.main : c.sub;
            px(ctx, x, y, 1, 2);
            break;
        case 'paw':
            ctx.fillStyle = c.main;
            px(ctx, x - 1, y, 3, 2);
            px(ctx, x - 2, y - 2);
            px(ctx, x, y - 3);
            px(ctx, x + 2, y - 2);
            break;
        case 'leaf': {
            ctx.fillStyle = c.main;
            const dx = Math.round(Math.cos(rot) * 1.5), dy = Math.round(Math.sin(rot) * 1.5);
            px(ctx, x, y);
            px(ctx, x + dx, y + dy);
            px(ctx, x - dx, y - dy);
            ctx.fillStyle = c.light;
            px(ctx, x, y);
            break;
        }
    }
    ctx.globalAlpha = 1;
}
// 中心から広がる粒（seed で配置が決まる）
export function spray(ctx, style, c, x, y, k, seed, n = 10, r = 16, up = 0) {
    const rng = new Rng(seed);
    for (let i = 0; i < n; i++) {
        const a = rng.range(0, TAU), sp = rng.range(0.4, 1);
        const d = r * sp * Math.min(1, k * 1.4);
        particle(ctx, style, c, x + Math.cos(a) * d * 1.3, y + Math.sin(a) * d * 0.8 - up * k * sp, 1 - k, a + k * 8);
    }
}
// 着弾の爆発
export function burst(ctx, style, c, x, y, k, seed, big) {
    const s = big ? 1.6 : 1;
    ctx.save();
    const a = 1 - k;
    switch (style) {
        case 'holy': {
            ctx.globalAlpha = a;
            ctx.fillStyle = c.light;
            const L = (6 + k * 14) * s;
            px(ctx, x - L, y, L * 2, 1);
            px(ctx, x, y - L, 1, L * 2);
            ctx.strokeStyle = c.main;
            ctx.beginPath();
            ctx.ellipse(x, y, (4 + k * 18) * s, (3 + k * 10) * s, 0, 0, TAU);
            ctx.stroke();
            break;
        }
        case 'arcane': {
            ctx.globalAlpha = a;
            ctx.strokeStyle = c.sub;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.arc(x, y, (3 + k * 14 + i * 3) * s, 0, TAU);
                ctx.stroke();
            }
            break;
        }
        case 'shadow': {
            const rng = new Rng(seed);
            for (let i = 0; i < 8; i++) {
                const ang = rng.range(0, TAU), d = k * 14 * s;
                ctx.globalAlpha = a * 0.8;
                ctx.fillStyle = i % 2 ? c.main : c.sub;
                const r = (3 + k * 4) * s;
                px(ctx, x + Math.cos(ang) * d - r / 2, y + Math.sin(ang) * d * 0.7 - r / 2, r, r);
            }
            break;
        }
        case 'tech': {
            ctx.globalAlpha = a;
            ctx.strokeStyle = c.main;
            const r = (4 + k * 16) * s;
            ctx.strokeRect(Math.round(x - r), Math.round(y - r * 0.7), Math.round(r * 2), Math.round(r * 1.4));
            ctx.fillStyle = c.sub;
            px(ctx, x - r, y, r * 2, 1);
            break;
        }
        case 'paw': {
            const rng = new Rng(seed);
            for (let i = 0; i < 5; i++) {
                const ang = (i / 5) * TAU + rng.range(0, 1);
                const d = (4 + k * 14) * s;
                particle(ctx, 'paw', c, x + Math.cos(ang) * d, y + Math.sin(ang) * d * 0.7, a);
            }
            break;
        }
        case 'leaf': {
            for (let i = 0; i < 10; i++) {
                const ang = (i / 10) * TAU + k * 6;
                const d = (3 + k * 16) * s;
                particle(ctx, 'leaf', c, x + Math.cos(ang) * d, y + Math.sin(ang) * d * 0.7, a, ang * 2);
            }
            break;
        }
    }
    ctx.restore();
    spray(ctx, style, c, x, y, k, seed + 'b', big ? 14 : 7, 18 * s);
}
// 飛び道具（落下や直線の弾）
export function bolt(ctx, style, c, x, y, ang, frame, big) {
    const s = big ? 1.5 : 1;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    ctx.save();
    // 尾
    for (let i = 1; i <= 5; i++)
        particle(ctx, style, c, x - dx * i * 3 * s, y - dy * i * 3 * s, 0.6 - i * 0.1, frame / 3 + i);
    switch (style) {
        case 'holy':
            ctx.fillStyle = c.light;
            for (let i = 0; i < 6 * s; i++)
                px(ctx, x - dx * i, y - dy * i);
            ctx.fillStyle = c.main;
            px(ctx, x - 1, y - 1, 3, 3);
            break;
        case 'arcane':
            ctx.fillStyle = c.sub;
            px(ctx, x - 2 * s, y - 2 * s, 4 * s + 1, 4 * s + 1);
            ctx.fillStyle = c.light;
            px(ctx, x - 1, y - 1, 2, 2);
            break;
        case 'shadow':
            ctx.fillStyle = c.sub;
            px(ctx, x - 3 * s, y - 1, 6 * s, 3);
            ctx.fillStyle = c.main;
            px(ctx, x - 2, y, 4, 1);
            break;
        case 'tech':
            ctx.fillStyle = c.main;
            for (let i = 0; i < 9 * s; i++)
                px(ctx, x - dx * i, y - dy * i);
            ctx.fillStyle = c.light;
            px(ctx, x, y);
            break;
        case 'paw':
            particle(ctx, 'paw', c, x, y, 1);
            break;
        case 'leaf': { // 手裏剣
            ctx.fillStyle = '#c2c3c7';
            const r = frame / 2;
            for (let i = 0; i < 4; i++) {
                const a = r + (i * Math.PI) / 2;
                px(ctx, x + Math.cos(a) * 2 * s, y + Math.sin(a) * 2 * s, 2, 2);
            }
            ctx.fillStyle = '#1a1c2c';
            px(ctx, x, y);
            break;
        }
    }
    ctx.restore();
}
// 光線（自分から相手へ）
export function beam(ctx, style, c, x0, y0, x1, y1, k, frame, big) {
    const grow = Math.min(1, k * 2.5);
    const ex = x0 + (x1 - x0) * grow, ey = y0 + (y1 - y0) * grow;
    const a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.lineCap = 'butt';
    const w = big ? 3 : 2;
    switch (style) {
        case 'holy':
            ctx.strokeStyle = c.main;
            ctx.lineWidth = w + 1;
            break;
        case 'arcane':
            ctx.strokeStyle = c.sub;
            ctx.lineWidth = w;
            break;
        case 'shadow':
            ctx.strokeStyle = c.main;
            ctx.lineWidth = w;
            ctx.setLineDash([3, 2]);
            break;
        case 'tech':
            ctx.strokeStyle = c.sub;
            ctx.lineWidth = w;
            break;
        case 'paw':
            ctx.strokeStyle = c.main;
            ctx.lineWidth = w;
            ctx.setLineDash([2, 3]);
            break;
        case 'leaf':
            ctx.strokeStyle = '#c2c3c7';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 2]);
            break;
    }
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = c.light;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.restore();
    // 線に沿った粒
    const n = big ? 8 : 4;
    for (let i = 0; i < n; i++) {
        const t = ((i / n) + frame / 40) % 1;
        if (t > grow)
            continue;
        particle(ctx, style, c, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + Math.sin(frame / 3 + i) * 2, a * 0.9, frame / 4 + i);
    }
}
// スキル発動のオーラ。k は発動区間の進行度（0..1）。drawEcho は残像用（盗賊）
export function skillAura(ctx, style, c, x, y, k, frame, big, drawEcho) {
    const g = Math.sin(Math.min(1, k) * Math.PI); // 0→1→0
    const s = big ? 1.5 : 1;
    ctx.save();
    switch (style) {
        case 'holy': { // 光の柱と十字の波動
            const h = 70 * s * Math.min(1, k * 2);
            for (let i = -3; i <= 3; i++) {
                ctx.globalAlpha = g * (0.5 - Math.abs(i) * 0.12);
                ctx.fillStyle = Math.abs(i) < 2 ? c.light : c.main;
                px(ctx, x + i * 2 * s, y - h, 2 * s, h);
            }
            ctx.globalAlpha = g;
            ctx.strokeStyle = c.main;
            ctx.beginPath();
            ctx.ellipse(x, y, (8 + k * 24) * s, (3 + k * 8) * s, 0, 0, TAU);
            ctx.stroke();
            for (let i = 0; i < 8; i++) {
                const t = (k * 2 + i / 8) % 1;
                particle(ctx, 'holy', c, x + Math.sin(i * 2.3) * 12 * s, y - t * 50 * s, g * (1 - t));
            }
            break;
        }
        case 'arcane': { // 逆回転する二重の魔法陣と周回する光球
            ctx.globalAlpha = g;
            const r = (10 + g * 10) * s;
            ctx.strokeStyle = c.sub;
            ctx.beginPath();
            ctx.ellipse(x, y, r * 1.6, r * 0.6, 0, 0, TAU);
            ctx.stroke();
            ctx.strokeStyle = c.main;
            ctx.beginPath();
            ctx.ellipse(x, y, r * 1.1, r * 0.42, 0, 0, TAU);
            ctx.stroke();
            ctx.fillStyle = c.light;
            for (let i = 0; i < 12; i++) {
                const a = frame / 12 + (i / 12) * TAU;
                px(ctx, x + Math.cos(a) * r * 1.35, y + Math.sin(a) * r * 0.5, 2, 1);
                const b = -frame / 9 + (i / 12) * TAU;
                if (i % 2)
                    px(ctx, x + Math.cos(b) * r * 0.75, y + Math.sin(b) * r * 0.3);
            }
            for (let i = 0; i < 3; i++) {
                const a = frame / 6 + (i / 3) * TAU;
                particle(ctx, 'arcane', c, x + Math.cos(a) * 14 * s, y - 14 * s + Math.sin(a) * 6 * s, g);
            }
            break;
        }
        case 'shadow': { // 残像と煙
            if (drawEcho)
                for (let i = 1; i <= 3; i++)
                    drawEcho(-i * 5 * s * g, 0, g * (0.45 - i * 0.12));
            const rng = new Rng('smoke');
            for (let i = 0; i < 12; i++) {
                const a = rng.range(0, TAU), d = 8 + k * 16;
                ctx.globalAlpha = g * 0.5;
                ctx.fillStyle = i % 2 ? c.main : c.sub;
                const r = (2 + k * 5) * s;
                px(ctx, x + Math.cos(a) * d * s - r / 2, y - 6 + Math.sin(a) * d * 0.5 * s - r / 2, r, r);
            }
            break;
        }
        case 'tech': { // スキャンラインと HUD の枠、立ちのぼるビット
            ctx.globalAlpha = g;
            const w = 18 * s, hh = 24 * s;
            ctx.strokeStyle = c.main;
            const L = 5;
            const bx = x - w, by = y - hh, bw = w * 2, bh = hh + 4;
            ctx.beginPath();
            ctx.moveTo(bx, by + L);
            ctx.lineTo(bx, by);
            ctx.lineTo(bx + L, by);
            ctx.moveTo(bx + bw - L, by);
            ctx.lineTo(bx + bw, by);
            ctx.lineTo(bx + bw, by + L);
            ctx.moveTo(bx, by + bh - L);
            ctx.lineTo(bx, by + bh);
            ctx.lineTo(bx + L, by + bh);
            ctx.moveTo(bx + bw - L, by + bh);
            ctx.lineTo(bx + bw, by + bh);
            ctx.lineTo(bx + bw, by + bh - L);
            ctx.stroke();
            const sy = by + ((frame * 1.5) % bh);
            ctx.fillStyle = c.sub;
            px(ctx, bx, sy, bw, 1);
            for (let i = 0; i < 10; i++) {
                const t = (k * 3 + i / 10) % 1;
                particle(ctx, 'tech', c, x - w + (i * 7.3) % bw, y - t * 40 * s, g * (1 - t), i + frame / 7);
            }
            break;
        }
        case 'paw': { // 肉球スタンプが順にぽんぽん出る
            for (let i = 0; i < 8; i++) {
                const appear = i / 8;
                if (k < appear * 0.7)
                    continue;
                const a = (i / 8) * TAU + 0.4;
                const pop = Math.min(1, (k - appear * 0.7) * 6);
                particle(ctx, 'paw', c, x + Math.cos(a) * 18 * s, y - 6 + Math.sin(a) * 10 * s - pop * 2, g);
            }
            ctx.globalAlpha = g;
            ctx.fillStyle = c.light;
            for (let i = 0; i < 4; i++) {
                const a = frame / 8 + i * 1.6;
                px(ctx, x + Math.cos(a) * 9 * s, y - 20 * s + Math.sin(a) * 4);
            }
            break;
        }
        case 'leaf': { // 木の葉の渦と頭上の手裏剣
            for (let i = 0; i < 16; i++) {
                const a = frame / 6 + (i / 16) * TAU;
                const r = (8 + (i % 4) * 4) * s * (0.6 + g * 0.6);
                particle(ctx, 'leaf', c, x + Math.cos(a) * r * 1.3, y - 8 - (i / 16) * 20 * s + Math.sin(a) * r * 0.4, g, a * 2);
            }
            bolt(ctx, 'leaf', c, x, y - 34 * s, 0, frame * 2, big);
            break;
        }
    }
    ctx.restore();
}
// 役に立たない道具: 小さく光って、すぐしぼむ。頭上に一言（「…なにも起きない」）
function fizzle(ctx, line, x, y, k, big) {
    ctx.save();
    const a = Math.min(1, k * 4) * Math.min(1, (1 - k) * 3);
    ctx.globalAlpha = a;
    const r = (big ? 9 : 6) * (k < 0.3 ? k / 0.3 : 1 - (k - 0.3) * 1.2);
    ctx.fillStyle = '#fff7b0';
    for (let i = 0; i < 5; i++) {
        const t = i * 1.26 + k * 2;
        ctx.fillRect(Math.round(x + Math.cos(t) * r), Math.round(y - 6 + Math.sin(t) * r * 0.6), 1, 1);
    }
    const [head, tail] = line.split(/\s*…/);
    ctx.font = `${big ? 9 : 7}px ${PIXEL_FONT}`;
    ctx.textAlign = 'center';
    const ty = y - 18 - k * 6;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1a1030';
    ctx.strokeText(head, x, ty);
    ctx.fillStyle = '#ffe27a';
    ctx.fillText(head, x, ty);
    if (tail && k > 0.35) {
        ctx.strokeText('…' + tail, x, ty + (big ? 11 : 9));
        ctx.fillStyle = '#b8b8c8';
        ctx.fillText('…' + tail, x, ty + (big ? 11 : 9));
    }
    ctx.restore();
}
// ツールごとの技（体型の系統で見た目が変わる）。v=自分の足元, m=モンスター
export function toolMove(ctx, id, style, c, v, m, k, frame, seed, big) {
    const my = m.y - 8, hy = v.y - 9;
    const decoy = TOOL_BY_ID[id]?.decoy;
    if (decoy) {
        fizzle(ctx, decoy, v.x, hy, k, big);
        return;
    }
    if (id === 'guardrail') {
        fizzle(ctx, tl('結界が幻術を弾いた！ …惑わされない'), v.x, hy, k, big);
        return;
    }
    switch (id) {
        case 'kb_search': { // 知識の雨: 上空から次々に降る
            const n = big ? 6 : 3;
            for (let i = 0; i < n; i++) {
                const t = k * 1.6 - i * 0.12;
                if (t < 0 || t > 1)
                    continue;
                const sx = m.x - 14 + (i * 29) % 28, sy = my - 60;
                bolt(ctx, style, c, sx + (m.x - sx) * t, sy + (my - sy) * t, Math.atan2(my - sy, m.x - sx), frame, big);
            }
            if (k > 0.6)
                burst(ctx, style, c, m.x, my, (k - 0.6) / 0.4, seed, big);
            break;
        }
        case 'customer_lookup': { // 照会の光線: 自分から一直線に貫く
            beam(ctx, style, c, v.x, hy, m.x, my, k, frame, big);
            if (k > 0.4)
                burst(ctx, style, c, m.x, my, (k - 0.4) / 0.6, seed, big);
            break;
        }
        case 'history_lookup': { // 記憶の斬撃: 大きな弧
            ctx.save();
            ctx.strokeStyle = c.main;
            ctx.lineWidth = big ? 3 : 2;
            ctx.globalAlpha = 1 - k * 0.6;
            const r = big ? 16 : 11;
            ctx.beginPath();
            ctx.arc(m.x, my, r, -Math.PI * 0.95, -Math.PI * 0.95 + Math.min(1, k * 1.5) * Math.PI * 1.5);
            ctx.stroke();
            ctx.restore();
            for (let i = 0; i < 6; i++) {
                const a = -Math.PI * 0.95 + (i / 6) * Math.PI * 1.5 * Math.min(1, k * 1.5);
                particle(ctx, style, c, m.x + Math.cos(a) * (big ? 16 : 11), my + Math.sin(a) * (big ? 16 : 11), 1 - k, a);
            }
            break;
        }
        case 'regex_matcher': { // パターン連撃: 交差する高速斬撃
            ctx.save();
            ctx.strokeStyle = c.light;
            const n = big ? 7 : 4;
            for (let i = 0; i < n; i++) {
                const t0 = i / (n + 2);
                if (k < t0)
                    break;
                ctx.globalAlpha = Math.max(0, 1 - (k - t0) * 2);
                const a = i * 1.1;
                const L = big ? 14 : 9;
                ctx.beginPath();
                ctx.moveTo(m.x - Math.cos(a) * L, my - Math.sin(a) * L);
                ctx.lineTo(m.x + Math.cos(a) * L, my + Math.sin(a) * L);
                ctx.stroke();
            }
            ctx.restore();
            if (style === 'leaf' || style === 'shadow')
                for (let i = 0; i < 3; i++)
                    bolt(ctx, style, c, v.x + (m.x - v.x) * Math.min(1, k * 2 + i * 0.1), hy + (my - hy) * Math.min(1, k * 2 + i * 0.1), 0, frame, big);
            break;
        }
        case 'calculator': { // 数式の嵐
            ctx.save();
            ctx.font = `${big ? 9 : 6}px monospace`;
            const glyphs = style === 'tech' ? ['0', '1', '1', '0', '1', '0'] : ['×', '1.1', '÷', '30', '=', '%'];
            glyphs.forEach((gch, i) => {
                const a = (i / glyphs.length) * TAU + k * 4;
                const r = (big ? 20 : 12) * (1 - k * 0.7);
                ctx.globalAlpha = 1 - k * 0.8;
                ctx.fillStyle = i % 2 ? c.main : c.light;
                ctx.fillText(gch, m.x + Math.cos(a) * r - 3, my + Math.sin(a) * r * 0.7);
            });
            ctx.restore();
            if (k > 0.7)
                burst(ctx, style, c, m.x, my, (k - 0.7) / 0.3, seed, big);
            break;
        }
        case 'clock': { // 時の文字盤: 針が高速で回り、時刻の衝撃
            ctx.save();
            const r = (big ? 15 : 10) * (0.6 + 0.4 * Math.min(1, k * 3));
            ctx.globalAlpha = Math.min(1, (1 - k) * 2.5);
            ctx.strokeStyle = c.light;
            ctx.beginPath();
            ctx.arc(m.x, my, r, 0, TAU);
            ctx.stroke();
            for (let i = 0; i < 12; i++) {
                const a = (i / 12) * TAU;
                ctx.fillStyle = i % 3 ? c.main : c.light;
                ctx.fillRect(Math.round(m.x + Math.cos(a) * (r - 2)), Math.round(my + Math.sin(a) * (r - 2)), 1, 1);
            }
            const hand = (a, L) => { ctx.beginPath(); ctx.moveTo(m.x, my); ctx.lineTo(m.x + Math.cos(a) * L, my + Math.sin(a) * L); ctx.stroke(); };
            ctx.strokeStyle = c.main;
            hand(-Math.PI / 2 + k * TAU * 3, r * 0.85);
            ctx.strokeStyle = c.light;
            hand(-Math.PI / 2 + k * TAU * 0.5, r * 0.55);
            ctx.restore();
            if (k > 0.75)
                burst(ctx, style, c, m.x, my, (k - 0.75) / 0.25, seed, big);
            break;
        }
        case 'json_validator': { // 形式の結界: 六角形のバリア
            ctx.save();
            ctx.strokeStyle = c.main;
            ctx.globalAlpha = Math.min(1, (1 - k) * 2);
            for (let ring = 0; ring < (big ? 2 : 1); ring++) {
                const r = (10 + k * 4 + ring * 4) * (big ? 1.3 : 1);
                ctx.beginPath();
                for (let i = 0; i <= 6; i++) {
                    const a = (i / 6) * TAU + Math.PI / 6 + (ring ? -1 : 1) * frame / 30;
                    const x = v.x + Math.cos(a) * r, y = hy + Math.sin(a) * r;
                    if (i === 0)
                        ctx.moveTo(x, y);
                    else
                        ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
            ctx.restore();
            spray(ctx, style, c, v.x, hy, k, seed, big ? 8 : 4, 14);
            break;
        }
        default:
            burst(ctx, style, c, m.x, my, k, seed, big);
    }
}
//# sourceMappingURL=fx.js.map