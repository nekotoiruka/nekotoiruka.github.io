// 大きな物体のドット絵（必殺技・ボスの攻撃で使う）。#105
// 形（どのドットが埋まるか）だけを決めると、輪郭・影・ハイライトの3段を自動でつけて、小さな画像にして覚えておく。
//   - 光は左上から。部品ごとに、左上の縁を明るく、右下の縁を暗く、手前の部品が奥の部品に落とす影も描く
//   - グラデーションは使わない（色は、輪郭・暗・中・明・白の5色だけ）
// 画面は 384×216 のドットを拡大して見せるので、1ドット = 画面の1ドットで作る（拡大・回転は描くときに）。
import { hash } from './fxkit.js';
// ---- 形の部品（座標はドットの左上。中心で判定する） ----
export const ell = (cx, cy, rx, ry) => (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
export const rrect = (x0, y0, x1, y1, r = 0) => (x, y) => {
    const px = x + 0.5, py = y + 0.5;
    if (px < x0 || px > x1 || py < y0 || py > y1)
        return false;
    const qx = Math.max(x0 + r - px, 0, px - (x1 - r)), qy = Math.max(y0 + r - py, 0, py - (y1 - r));
    return qx * qx + qy * qy <= r * r;
};
export const poly = (pts) => (x, y) => {
    const px = x + 0.5, py = y + 0.5;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
            inside = !inside;
    }
    return inside;
};
/** 回した楕円（羽根・炎の舌） */
export const rell = (cx, cy, rx, ry, ang) => {
    const c = Math.cos(ang), s = Math.sin(ang);
    return (x, y) => { const dx = x + 0.5 - cx, dy = y + 0.5 - cy, u = dx * c + dy * s, v = -dx * s + dy * c; return (u / rx) ** 2 + (v / ry) ** 2 <= 1; };
};
export const union = (...ss) => (x, y) => ss.some((s) => s(x, y));
export const minus = (a, b) => (x, y) => a(x, y) && !b(x, y);
// ---- 色 ----
const rgb = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
/** 1色から5段の色を作る（光る物・味方の色の玉など） */
export const ramp = (c, o = 0.72) => ({ o: mix(c, '#0a0614', o), d: mix(c, '#0a0614', 0.36), m: c, l: mix(c, '#ffffff', 0.5), h: '#ffffff' });
// ---- 組み立て ----
const cache = new Map();
// 作ったドット絵の画素（読み戻すと遅く、ブラウザの警告も出るので、作ったときに覚えておく）
const pixels = new WeakMap();
const canMake = () => typeof document !== 'undefined';
function newCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }
/** 部品を重ねて、3段の陰影つきのドット絵を作る（同じ key は覚えておく）。後ろの部品ほど手前 */
export function sprite(key, w, h, parts) {
    if (cache.has(key))
        return cache.get(key);
    if (!canMake())
        return null;
    const idx = new Int16Array(w * h).fill(-1);
    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
            for (let i = parts.length - 1; i >= 0; i--)
                if (parts[i].s(x, y)) {
                    idx[y * w + x] = i;
                    break;
                }
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : idx[y * w + x]);
    const cv = newCanvas(w, h), c = cv.getContext('2d'), img = c.createImageData(w, h), D = img.data;
    const pals = parts.map((p) => [p.pal.o, p.pal.d, p.pal.m, p.pal.l, p.pal.h].map(rgb));
    const put = (x, y, col) => { const o = (y * w + x) * 4; D[o] = col[0]; D[o + 1] = col[1]; D[o + 2] = col[2]; D[o + 3] = 255; };
    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
            const i = idx[y * w + x];
            if (i < 0) { // 輪郭: となりが埋まっていれば、いちばん手前の部品の輪郭の色
                let j = -1;
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const k = at(x + dx, y + dy);
                    if (k > j && !parts[k].bare)
                        j = k;
                }
                if (j >= 0)
                    put(x, y, pals[j][0]);
                continue;
            }
            const P = parts[i];
            let t = P.tone?.(x, y) ?? null;
            if (t === null) {
                const b = P.bevel ?? 1;
                let up = false, left = false, down = false, right = false;
                for (let k = 1; k <= b; k++) {
                    up ||= !P.s(x, y - k);
                    left ||= !P.s(x - k, y);
                    down ||= !P.s(x, y + k);
                    right ||= !P.s(x + k, y);
                }
                const lit = up || left, dark = down || right;
                t = lit && dark ? 2 : lit ? (up && left ? 4 : 3) : dark ? 1 : 2;
                // 手前の部品が落とす影
                if (!lit && (at(x - 1, y) > i || at(x, y - 1) > i || at(x - 1, y - 1) > i))
                    t = 1;
                if (P.tex)
                    t += P.tex(x, y);
                t = Math.max(1, Math.min(4, Math.round(t)));
            }
            put(x, y, pals[i][Math.max(0, Math.min(4, t))]);
        }
    c.putImageData(img, 0, 0);
    pixels.set(cv, D);
    cache.set(key, cv);
    return cv;
}
/** 縁の光（形を n ドット太らせた、段のついた光）。加算で重ねる */
export function aura(key, spr, n, col) {
    if (!spr)
        return null;
    const k = `aura:${key}:${n}:${col}`;
    if (cache.has(k))
        return cache.get(k);
    const w = spr.width, h = spr.height, W = w + n * 2, H = h + n * 2;
    const src = pixels.get(spr);
    if (!src)
        return null;
    const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 0;
    const cv = newCanvas(W, H), c = cv.getContext('2d'), img = c.createImageData(W, H), D = img.data, [r, g, b] = rgb(col);
    for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
            let best = 99;
            for (let dy = -n; dy <= n; dy++)
                for (let dx = -n; dx <= n; dx++) {
                    const d = Math.abs(dx) + Math.abs(dy);
                    if (d < best && on(x - n + dx, y - n + dy))
                        best = d;
                }
            if (best > n)
                continue;
            const o = (y * W + x) * 4;
            D[o] = r;
            D[o + 1] = g;
            D[o + 2] = b;
            D[o + 3] = best === 0 ? 120 : best === 1 ? 200 : best <= Math.ceil(n / 2) ? 120 : 60; // 段で薄くなる
        }
    c.putImageData(img, 0, 0);
    pixels.set(cv, D);
    cache.set(k, cv);
    return cv;
}
/** ドット絵を置く。(ax, ay) はドット絵の中の基準の点（その点が (x, y) にくる） */
export function blit(ctx, spr, x, y, ax, ay, o = {}) {
    if (!spr || (o.alpha ?? 1) <= 0)
        return;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (o.add)
        ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha *= Math.min(1, o.alpha ?? 1);
    ctx.translate(o.rot ? x : Math.round(x), o.rot ? y : Math.round(y));
    if (o.rot)
        ctx.rotate(o.rot);
    if (o.sx !== undefined || o.sy !== undefined)
        ctx.scale(o.sx ?? 1, o.sy ?? 1);
    ctx.drawImage(spr, -ax, -ay);
    ctx.restore();
}
// =====================================================================
// 玉（ボスの大技の球・打ち返した球）: 球の陰影を3段で
// =====================================================================
export const ORB_BOSS = { o: '#2a0612', d: '#8a1028', m: '#e0283c', l: '#ff7a5c', h: '#ffe8d0' };
function orbSprite(r, pal) {
    const R = Math.max(2, Math.round(r)), S = R * 2 + 2;
    const L = [-0.5, -0.62, 0.6], Ln = Math.hypot(...L);
    return sprite(`orb:${R}:${pal.m}`, S, S, [{
            s: ell(R + 1, R + 1, R, R), pal,
            tone: (x, y) => {
                const nx = (x + 0.5 - R - 1) / R, ny = (y + 0.5 - R - 1) / R, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
                const d = (nx * L[0] + ny * L[1] + nz * L[2]) / Ln;
                if (nx * nx + ny * ny > 0.72 && nx + ny > 0.5)
                    return 2; // 影の側の縁は、照り返しで少し明るい
                return d > 0.86 ? 4 : d > 0.55 ? 3 : d > 0.12 ? 2 : 1;
            },
        }]);
}
/** 玉を描く。r は半径（ドット）。渦を巻く芯と、まわりを回る火の粉つき */
export function drawOrb(ctx, x, y, r, frame, pal = ORB_BOSS, alpha = 1) {
    if (alpha <= 0)
        return;
    const R = Math.max(2, Math.round(r)), spr = orbSprite(R, pal);
    blit(ctx, aura(`orb${R}${pal.m}`, spr, 3, pal.m), x, y, R + 4, R + 4, { add: true, alpha: alpha * (0.55 + 0.25 * Math.sin(frame / 3)) });
    blit(ctx, spr, x, y, R + 1, R + 1, { alpha });
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.globalCompositeOperation = 'lighter';
    // 中で渦を巻く光（ドットの点々）
    for (let i = 0; i < 2; i++)
        for (let k = 0; k < R; k++) {
            const an = frame / 5 + i * Math.PI + k * 0.55, rr = (k / R) * (R - 1.5);
            ctx.fillStyle = k % 2 ? pal.l : pal.h;
            ctx.fillRect(Math.round(x + Math.cos(an) * rr), Math.round(y + Math.sin(an) * rr * 0.8), 1, 1);
        }
    // まわりを回る火の粉
    for (let i = 0; i < 5; i++) {
        const an = frame / 4 + (i / 5) * Math.PI * 2, rr = R + 2 + ((frame + i * 3) % 4);
        ctx.fillStyle = i % 2 ? pal.l : pal.h;
        ctx.fillRect(Math.round(x + Math.cos(an) * rr), Math.round(y + Math.sin(an) * rr), i % 2 ? 1 : 2, i % 2 ? 1 : 2);
    }
    ctx.restore();
}
// =====================================================================
// 剣（巨大な剣・光の鎖の刀）: 切っ先を下にした縦長のドット絵
// =====================================================================
const STEEL = { o: '#1a2440', d: '#56739a', m: '#a6c2dc', l: '#dcecf8', h: '#ffffff' };
const GOLD = { o: '#3a1e06', d: '#a8620e', m: '#f0b030', l: '#ffe070', h: '#fffbe0' };
const LEATHER = { o: '#1e0e06', d: '#4a2410', m: '#7a4220', l: '#a86a3a', h: '#d8a070' };
const KATANA_STEEL = { o: '#1a1626', d: '#5a5a74', m: '#b4b8cc', l: '#e8ecf6', h: '#ffffff' };
const IRON = { o: '#0c0a10', d: '#2a2630', m: '#4a4452', l: '#8a8094', h: '#d8c890' };
const ITO = { o: '#14060e', d: '#2a0e1e', m: '#5a1a34', l: '#efe6d4', h: '#ffffff' };
/** 剣のドット絵（切っ先が下）。len は刀身の長さ（ドット） */
export function swordSprite(kind, len, gem = '#ff4fa0') {
    len = Math.max(20, Math.round(len));
    if (kind === 'katana') {
        const W = 23, cx = 11, grip = Math.round(len * 0.32), g0 = 3 + grip, b0 = g0 + 4, H = b0 + len + 2, hw = 3.2;
        const bend = (y) => 4 * ((y - b0) / len) ** 2; // 反り（切っ先へ向かって背の側へ）
        const blade = (x, y) => {
            if (y < b0 || y > b0 + len)
                return false;
            const rel = x + 0.5 - cx - bend(y), t = (b0 + len - y) / 9; // 切っ先は、刃の側が背へ向かって丸く上がる
            const lo = t < 1 ? -hw + (1 - Math.sqrt(t)) * hw * 2 : -hw;
            return rel >= lo && rel <= hw;
        };
        const parts = [
            { s: rrect(cx - 3, 0, cx + 4, 4, 1.5), pal: IRON }, // 柄頭
            { s: rrect(cx - 2.5, 3, cx + 3.5, g0, 1), pal: ITO, tone: (x, y) => { const u = (x + y) % 6, v = (x - y + 600) % 6; return u === 0 || v === 0 ? 3 : 1; } }, // 柄巻き（菱形）
            { s: ell(cx + 0.5, g0 + 1.5, 9.5, 2.8), pal: IRON, tone: (x, y) => (y + 0.5 < g0 + 1 ? 4 : y + 0.5 > g0 + 2.6 ? 1 : 2) }, // 鍔
            { s: rrect(cx - 3.5, g0 + 3, cx + 4.5, b0 + 3, 0.5), pal: GOLD }, // はばき
            {
                s: blade, pal: KATANA_STEEL, tone: (x, y) => {
                    const rel = x + 0.5 - cx - bend(y), ham = -hw + 2.1 + Math.sin(y * 0.8) * 0.6;
                    if (rel > hw - 1.2)
                        return 1; // 峰
                    if (rel < -hw + 1 && y < b0 + len - 8)
                        return 3; // 刃先
                    if (Math.abs(rel - ham) < 0.55)
                        return 4; // 刃文
                    return rel < ham ? 3 : 2;
                },
            },
        ];
        const spr = sprite(`katana:${len}`, W, H, parts);
        return { spr, geo: { w: W, h: H, ax: Math.round(cx + bend(b0 + len) + hw - 0.5), ay: b0 + len, guardY: g0 + 1 } };
    }
    const W = 33, cx = 16, grip = Math.max(10, Math.round(len * 0.22)), g0 = 7 + grip, b0 = g0 + 5, H = b0 + len + 2, hw = 5.5, taper = 14;
    const blade = (x, y) => { if (y < b0 || y > b0 + len)
        return false; const t = Math.min(1, (b0 + len - y + 0.5) / taper); return Math.abs(x + 0.5 - cx) <= hw * t + 0.2; };
    const parts = [
        { s: ell(cx, 4, 4.5, 4), pal: GOLD }, // 柄頭
        { s: rrect(cx - 2.5, 7, cx + 2.5, g0 + 1), pal: LEATHER, tex: (_x, y) => ((y - 7) % 3 === 2 ? -1 : 0) }, // 柄の革巻き
        { s: union(rrect(cx - 15, g0, cx + 15, g0 + 5, 2), ell(cx - 14, g0 + 5, 2.5, 3.5), ell(cx + 14, g0 + 5, 2.5, 3.5)), pal: GOLD }, // 鍔（先が下がる）
        { s: rrect(cx - 4, b0 - 1, cx + 4, b0 + 5, 1), pal: GOLD }, // 根もとの金具
        {
            s: blade, pal: STEEL, tone: (x, y) => {
                const rel = x + 0.5 - cx, t = Math.min(1, (b0 + len - y + 0.5) / taper), edge = hw * t;
                if (y < b0 + len * 0.6 && y > b0 + 6 && Math.abs(rel) < 1)
                    return rel < 0 ? 1 : 3; // 樋（溝）
                if (rel < -edge + 1.2)
                    return 4; // 左の刃先（光が当たる）
                if (rel > edge - 1.2)
                    return 1; // 右の刃先（影）
                return rel < 0 ? 3 : 2; // 左の面は明るく、右の面は暗く（鎬）
            },
        },
        { s: ell(cx, g0 + 2.5, 2.6, 2.6), pal: ramp(gem) }, // 宝石
    ];
    const spr = sprite(`sword:${len}:${gem}`, W, H, parts);
    return { spr, geo: { w: W, h: H, ax: cx, ay: b0 + len, guardY: g0 + 2 } };
}
/** 剣を描く。(x, tip) が切っ先。rot は切っ先を中心に回す */
export function drawSword(ctx, kind, x, tip, len, o = {}) {
    const { spr, geo } = swordSprite(kind, len, o.gem);
    const al = o.alpha ?? 1;
    if (o.glow && (o.glowK ?? 1) > 0)
        blit(ctx, aura(`${kind}${len}${o.gem}`, spr, 3, o.glow), x, tip, geo.ax + 3, geo.ay + 3, { add: true, alpha: al * (o.glowK ?? 1), rot: o.rot });
    blit(ctx, spr, x, tip, geo.ax, geo.ay, { alpha: al, rot: o.rot });
    return geo;
}
// =====================================================================
// 岩の拳（召喚「岩の拳」・ボス「石の巨人」の拳）
// =====================================================================
export const ROCK = { o: '#1a120c', d: '#4a3c2e', m: '#7a6a54', l: '#a8977a', h: '#d6c8a8' };
const fistKey = (s, arm, pal) => `fist:${s}:${arm}:${pal.m}`;
function fistParts(s, arm, pal) {
    const S = (v) => v * s, W = Math.ceil(S(30)), H = Math.ceil(S(28 + arm * 26)) + 2;
    const sc = (f) => (x, y) => f((x + 0.5) / s - 0.5, (y + 0.5) / s - 0.5); // 1倍の形を s 倍に（輪郭は1ドットのまま）
    const rr = (x0, y0, x1, y1, r) => sc(rrect(x0, y0, x1, y1, r));
    // 岩の板（ボロノイ）: 板の境目を暗いひびにする
    const cellOf = (u, v) => {
        let b1 = 1e9, b2 = 1e9, id = 0;
        const gx = Math.floor(u / 7), gy = Math.floor(v / 7);
        for (let j = gy - 1; j <= gy + 1; j++)
            for (let i = gx - 1; i <= gx + 1; i++) {
                const px = (i + 0.2 + hash(i, j * 31 + 1) * 0.6) * 7, py = (j + 0.2 + hash(i * 17, j + 5) * 0.6) * 7, d = Math.hypot(u - px, v - py);
                if (d < b1) {
                    b2 = b1;
                    b1 = d;
                    id = i * 101 + j;
                }
                else if (d < b2)
                    b2 = d;
            }
        return { gap: b2 - b1, id };
    };
    const tex = (x, y) => { const c = cellOf((x + 0.5) / s, (y + 0.5) / s); return c.gap < 0.9 / s + 0.35 ? -1 : hash(c.id, 3) < 0.25 ? -0.6 : 0; };
    const P = (sh) => ({ s: sh, pal, tex, bevel: Math.max(1, Math.round(s)) });
    const top = 1;
    const parts = [];
    if (arm > 0)
        parts.push(P(sc(poly([[7, 22], [24, 22], [26, 28 + arm * 26], [5, 28 + arm * 26]])))); // 腕
    parts.push(P(rr(4, 10, 27, 29, 4))); // 手の甲・手のひら
    for (let i = 0; i < 4; i++)
        parts.push(P(rr(4 + i * 5.6, top + (i === 0 || i === 3 ? 1.5 : 0), 9.8 + i * 5.6, 16 + (i === 3 ? -1 : 0), 2.6))); // 指（前から見た曲げた指）
    parts.push(P(rr(2, 13, 17, 20.5, 3.2))); // 親指（指の前を横切る）
    return { W, H, parts, cellOf };
}
/** 岩の拳のドット絵（上向き）。(ax, ay) は拳の先（指の付け根の上端）の中央 */
export function rockFistSprite(s = 2, arm = 1, pal = ROCK) {
    s = Math.max(0.5, Math.round(s * 4) / 4);
    arm = Math.max(0, Math.round(arm * 4) / 4);
    const { W, H, parts, cellOf } = fistParts(s, arm, pal);
    const spr = sprite(fistKey(s, arm, pal), W, H, parts);
    // 光る亀裂（板の境目の一部）
    let veins = cache.get(`${fistKey(s, arm, pal)}:vein`) ?? null;
    if (!cache.has(`${fistKey(s, arm, pal)}:vein`) && spr) {
        const cv = newCanvas(W, H), c = cv.getContext('2d'), src = pixels.get(spr), img = c.createImageData(W, H);
        const op = (x, y) => x >= 0 && y >= 0 && x < W && y < H && src[(y * W + x) * 4 + 3] > 0;
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++) {
                if (!op(x, y))
                    continue;
                const cc = cellOf((x + 0.5) / s, (y + 0.5) / s);
                const inside = [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => op(x + dx, y + dy));
                if (inside && cc.gap < 0.4 && hash(cc.id, 9) < 0.3)
                    img.data.fill(255, (y * W + x) * 4, (y * W + x) * 4 + 4);
            }
        c.putImageData(img, 0, 0);
        pixels.set(cv, img.data);
        veins = cv;
        cache.set(`${fistKey(s, arm, pal)}:vein`, cv);
    }
    return { spr, veins, w: W, h: H, ax: Math.round(15.5 * s), ay: Math.round(1 * s) };
}
let tint = null;
/** 岩の拳を描く。(x, y) が拳の先（ぶつかる面）の中央。ボスの攻撃でもそのまま使える */
export function drawRockFist(ctx, x, y, o = {}) {
    const f = rockFistSprite(o.s ?? 2, o.arm ?? 1, o.pal ?? ROCK);
    if (!f.spr)
        return f;
    const al = o.alpha ?? 1;
    ctx.save();
    if (o.ground !== undefined) {
        ctx.beginPath();
        ctx.rect(x - 400, y - 400, 800, o.ground - (y - 400));
        ctx.clip();
    }
    const bo = { rot: o.rot, sx: o.flip ? -1 : 1, alpha: al };
    blit(ctx, f.spr, x, y, f.ax, f.ay, bo);
    if (o.vein && (o.glow ?? 1) > 0 && f.veins) {
        tint ??= newCanvas(f.w, f.h);
        tint.width = f.w;
        tint.height = f.h;
        const t = tint.getContext('2d');
        t.clearRect(0, 0, f.w, f.h);
        t.drawImage(f.veins, 0, 0);
        t.globalCompositeOperation = 'source-in';
        t.fillStyle = o.vein;
        t.fillRect(0, 0, f.w, f.h);
        t.globalCompositeOperation = 'source-over';
        blit(ctx, aura(`vein${f.w}x${f.h}${o.vein}${o.pal?.m ?? ''}`, f.veins, 1, o.vein), x, y, f.ax + 1, f.ay + 1, { ...bo, add: true, alpha: al * (o.glow ?? 1) * 0.5 });
        blit(ctx, tint, x, y, f.ax, f.ay, { ...bo, add: true, alpha: al * (o.glow ?? 1) });
    }
    ctx.restore();
    return f;
}
// =====================================================================
// 月（月輪）: 満月。クレーターと海（暗い所）を3段で
// =====================================================================
export function moonSprite(r, pal) {
    const R = Math.round(r), S = R * 2 + 2, c = R + 1;
    const craters = [[-0.38, -0.3, 0.2], [0.3, 0.2, 0.26], [-0.12, 0.45, 0.14], [0.42, -0.38, 0.12], [-0.5, 0.12, 0.1], [0.05, -0.05, 0.09]];
    const seas = [[-0.2, -0.25, 0.42, 0.3], [0.25, 0.3, 0.3, 0.22]];
    return sprite(`moon:${R}:${pal.m}`, S, S, [{
            s: ell(c, c, R, R), pal,
            tone: (x, y) => {
                const nx = (x + 0.5 - c) / R, ny = (y + 0.5 - c) / R, d2 = nx * nx + ny * ny;
                for (const [cx, cy, cr] of craters) { // クレーター: 左上の内側は影、右下の縁は光る
                    const dx = nx - cx, dy = ny - cy, dd = Math.hypot(dx, dy);
                    if (dd < cr) {
                        if (dd > cr - 0.07)
                            return dx + dy < 0 ? 1 : 4;
                        return dx + dy < -cr * 0.3 ? 1 : 2;
                    }
                }
                let t = 3;
                for (const [sx, sy, rx, ry] of seas)
                    if (((nx - sx) / rx) ** 2 + ((ny - sy) / ry) ** 2 < 1 + hash(Math.round(nx * 30), Math.round(ny * 30)) * 0.25)
                        t = 2;
                if (d2 > 0.8 && nx + ny > 0.45)
                    t = Math.min(t, 2); // 右下の縁は少し暗い
                if (d2 > 0.85 && nx + ny < -0.6)
                    t = 4; // 左上の縁は白く
                return t;
            },
        }]);
}
// =====================================================================
// 炎の鳥（召喚「炎の鳥」）: 横向きで右を向く。翼の位置ちがいを3コマ
// =====================================================================
export function birdSprite(pal, frame) {
    const W = 80, H = 72, sh = { x: 40, y: 36 };
    const flame = (ox, oy, len, ang, wid) => {
        const c = Math.cos(ang), s = Math.sin(ang);
        return (x, y) => { const dx = x + 0.5 - ox, dy = y + 0.5 - oy, u = dx * c + dy * s, v = -dx * s + dy * c; if (u < 0 || u > len)
            return false; const t = u / len; return Math.abs(v - Math.sin(t * 5) * wid * 0.25 * t) <= wid * (1 - t) * Math.sqrt(1 - t * 0.6) + 0.3; };
    };
    // 根もとからの近さで、熱い色（白・明）→ 先は暗い（炎の段）
    const heat = (ox, oy, len) => (x, y) => { const d = Math.hypot(x + 0.5 - ox, y + 0.5 - oy) / len; return d < 0.16 ? 4 : d < 0.45 ? 3 : d < 0.78 ? 2 : 1; };
    const wingAng = [Math.PI + 1.0, Math.PI + 0.25, Math.PI - 0.55][frame]; // 上・まんなか・下（左へ向かう向き）
    const wing = (back) => {
        const out = [], pal2 = back ? { ...pal, l: pal.m, h: pal.l, m: pal.d } : pal;
        for (let i = 0; i < 5; i++) {
            const an = wingAng + (back ? 0.35 : 0) - i * 0.26, L = (36 - i * 3.5) * (frame === 1 ? 0.7 : 1) * (back ? 0.85 : 1);
            out.push({ s: flame(sh.x - 2 + i * 2, sh.y - 2, L, an, 5.5 - i * 0.4), pal: pal2, tone: heat(sh.x, sh.y, L + 6) });
        }
        return out;
    };
    const parts = [
        ...wing(true),
        // 尾羽: 三本、うしろへ長くたなびく
        ...[-0.18, 0.05, 0.28].map((d, i) => ({ s: flame(28, 39, 28 + i * 5, Math.PI + d, 5 - i * 0.6), pal, tone: heat(28, 39, 40) })),
        { s: ell(38, 39, 13, 7.5), pal, tone: (_x, y) => (y + 0.5 < 35 ? 3 : y + 0.5 < 42 ? 2 : 1) }, // 胴
        { s: ell(54, 32, 6.5, 6), pal, tone: (_x, y) => (y + 0.5 < 30 ? 3 : 2) }, // 頭
        ...[0, 1, 2].map((i) => ({ s: flame(52 - i, 28, 11 - i * 1.5, Math.PI + 0.9 + i * 0.35, 2.6), pal, tone: heat(52, 28, 12) })), // 冠羽
        { s: poly([[59, 30], [67, 33], [59, 35]]), pal: GOLD }, // くちばし
        { s: ell(56.5, 30.5, 1.2, 1.2), pal: { ...pal, o: pal.o }, tone: () => 0 }, // 目
        ...wing(false),
    ];
    const spr = sprite(`bird:${pal.m}:${frame}`, W, H, parts);
    return { spr, w: W, h: H, ax: 42, ay: 38 };
}
/** 炎の5段（c0 が中の色、c1 が明るい色） */
export const firePal = (c0, c1) => ({ o: mix(c0, '#1a0204', 0.75), d: mix(c0, '#5a0a04', 0.45), m: c0, l: c1, h: '#fffbe0' });
export function drawBird(ctx, x, y, ang, frame, pal, o = {}) {
    const fr = [0, 1, 2, 1][((frame % 4) + 4) % 4], b = birdSprite(pal, fr), sc = o.scale ?? 1, flipY = Math.cos(ang) < 0;
    const bo = { rot: ang, sx: sc, sy: flipY ? -sc : sc, alpha: o.alpha ?? 1 };
    if (o.glow)
        blit(ctx, aura(`bird${pal.m}${fr}`, b.spr, 3, o.glow), x, y, b.ax + 3, b.ay + 3, { ...bo, add: true, alpha: (o.alpha ?? 1) * 0.7 });
    blit(ctx, b.spr, x, y, b.ax, b.ay, bo);
}
// =====================================================================
// 地面に空いた穴（天墜）: 奥の壁が見え、底が暗く、縁に割れた岩
// =====================================================================
const HOLE = { o: '#07040a', d: '#24181a', m: '#4a3830', l: '#7a6248', h: '#a88a64' };
export function holeSprite(rx) {
    const RX = Math.max(6, Math.round(rx / 2) * 2), RY = Math.round(RX * 0.32), W = RX * 2 + 14, H = RY * 2 + 12, cx = W / 2, cy = H / 2;
    const inner = ell(cx, cy, RX, RY), wallH = Math.max(2, Math.round(RY * 0.55));
    const parts = [
        { s: inner, pal: HOLE, tone: (x, y) => {
                const up = !inner(x, y - wallH);
                if (!up)
                    return 0;
                const k = y - (cy - RY);
                return (k + Math.round(hash(Math.floor(x / 5), 3) * 2)) % 3 === 0 ? 2 : !inner(x, y - 1) ? 4 : 3;
            } },
    ];
    // 縁の割れた岩（手前の側ほど大きい）
    const n = Math.round(RX / 3.2);
    for (let i = 0; i < n; i++) {
        const an = (i / n) * Math.PI * 2 + hash(i, RX) * 0.3, rr = 1 + hash(i, 7) * 0.12, bx = cx + Math.cos(an) * RX * rr, by = cy + Math.sin(an) * RY * rr;
        const sz = (Math.sin(an) > 0 ? 3.2 : 2.2) + hash(i, 11) * 1.6;
        parts.push({ s: poly([[bx - sz, by + sz * 0.4], [bx - sz * 0.4, by - sz * 0.7], [bx + sz * 0.6, by - sz * 0.5], [bx + sz, by + sz * 0.3], [bx + sz * 0.2, by + sz * 0.6]]), pal: ROCK });
    }
    const spr = sprite(`hole:${RX}`, W, H, parts);
    return { spr, w: W, h: H, ax: Math.round(cx), ay: Math.round(cy), RX, RY };
}
/** 地面の穴を描く。(x, y) が穴の中心、rx が横の半径。k は 0→1 で広がる。col は底で光る亀裂の色 */
export function drawHole(ctx, x, y, rx, col, alpha = 1, frame = 0, seed = 0) {
    if (rx < 4 || alpha <= 0)
        return;
    const h = holeSprite(rx);
    ctx.save();
    ctx.globalAlpha *= alpha;
    // 穴から外へ走る地面のひび（暗い線と、下に明るい縁）
    const n = 9;
    for (let i = 0; i < n; i++) {
        const an = (i / n) * Math.PI * 2 + hash(i, seed) * 0.5, L = h.RX * (0.45 + hash(i, seed + 3) * 0.55);
        let px = x + Math.cos(an) * h.RX, py = y + Math.sin(an) * h.RY;
        for (let k = 0; k < L; k++) {
            px += Math.cos(an + (hash(k, i) - 0.5) * 1.2);
            py += Math.sin(an + (hash(k, i + 9) - 0.5) * 1.2) * 0.32;
            ctx.fillStyle = HOLE.o;
            ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
            if (k % 2 === 0) {
                ctx.fillStyle = HOLE.h;
                ctx.fillRect(Math.round(px), Math.round(py) + 1, 1, 1);
            }
        }
    }
    blit(ctx, h.spr, x, y, h.ax, h.ay);
    // 底で光る亀裂（ドットの折れ線が、ゆっくり脈打つ）
    ctx.globalCompositeOperation = 'lighter';
    const pulse = 0.6 + 0.4 * Math.sin(frame / 5);
    for (let j = 0; j < 3; j++) {
        let px = x - h.RX * 0.5 + j * h.RX * 0.4, py = y + h.RY * 0.25;
        for (let k = 0; k < h.RX * 0.5; k++) {
            px += 1;
            py += Math.round((hash(k, j + seed) - 0.5) * 1.6);
            if (Math.abs(py - y - h.RY * 0.2) > h.RY * 0.5)
                py = y + h.RY * 0.2;
            ctx.globalAlpha = alpha * pulse;
            ctx.fillStyle = k % 3 ? col : '#ffffff';
            ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
        }
    }
    ctx.restore();
}
// =====================================================================
// 苦無（影縫い）・札（封印「札」）・三日月の刃（光の騎士）
// =====================================================================
// 影縫いの苦無: 影の技なので、紫の刃（光る縁）と黒い柄。ほかの光る演出と同じ明るさの段にそろえる
const KUNAI = { o: '#12061e', d: '#4a2a7a', m: '#8a5ad0', l: '#d0b0ff', h: '#ffffff' };
const WRAP = { o: '#12061e', d: '#1e1030', m: '#3a2456', l: '#6a4a96', h: '#a88ad8' };
/** 部品の形と段を、回して拡大する（回したあとの格子でドットを置くので、描くときに回して崩れることがない） */
function xform(parts, ang, sc, ox, oy, px, py) {
    const c = Math.cos(-ang), sn = Math.sin(-ang);
    const back = (x, y) => { const dx = x + 0.5 - px, dy = y + 0.5 - py; return [(dx * c - dy * sn) / sc + ox - 0.5, (dx * sn + dy * c) / sc + oy - 0.5]; };
    return parts.map((P) => ({
        ...P,
        s: (x, y) => { const [u, v] = back(x, y); return P.s(Math.round(u), Math.round(v)); },
        tone: P.tone ? (x, y) => { const [u, v] = back(x, y); return P.tone(Math.round(u), Math.round(v)); } : undefined,
        tex: P.tex ? (x, y) => { const [u, v] = back(x, y); return P.tex(Math.round(u), Math.round(v)); } : undefined,
    }));
}
/** 苦無（切っ先が下）。ang だけ回し（プラスで切っ先が左下へ向く）、sc 倍にした形で作る。(ax, ay) が切っ先 */
export function kunaiSprite(ang = 0, sc = 1) {
    const cx = 5.5, tipY = 29.6;
    const base = [
        { s: minus(ell(cx, 4, 3.6, 3.6), ell(cx, 4, 1.6, 1.6)), pal: KUNAI }, // 輪
        { s: rrect(cx - 1.6, 7, cx + 1.6, 15), pal: WRAP, tex: (_x, y) => (y % 2 ? -1 : 0) }, // 柄の巻き
        { s: poly([[cx, 14], [cx + 4.4, 20], [cx + 0.6, tipY], [cx - 0.6, tipY], [cx - 4.4, 20]]), pal: KUNAI, tone: (x, y) => (x + 0.5 < cx - 0.4 ? (y < 21 ? 4 : 3) : x + 0.5 > cx + 0.6 ? 1 : 2) }, // 刃（左の面が光る）
    ];
    const L = Math.ceil(32 * sc), S = L * 2 + 4, piv = S / 2; // 切っ先を中心に回すので、切っ先を真ん中に置いた正方形
    const spr = sprite(`kunai:${ang.toFixed(2)}:${sc}`, S, S, xform(base, ang, sc, cx, tipY, piv, piv));
    return { spr, w: S, h: S, ax: Math.floor(piv), ay: Math.floor(piv) };
}
const PAPER = { o: '#3a2412', d: '#cbb486', m: '#efe2be', l: '#fffaf0', h: '#ffffff' };
const VERMILION = { o: '#4a0a08', d: '#9a1a14', m: '#d8302a', l: '#ff6a4a', h: '#ffc0a0' };
const INK = { o: '#0a0606', d: '#1a1010', m: '#2a1a1a', l: '#4a3030', h: '#6a4a4a' };
// 札の模様（字ではない、渦と線の印）。1 が墨、2 が朱
const SEAL_GLYPH = [
    '02220',
    '20102',
    '21112',
    '20102',
    '02220',
    '00100',
    '01110',
    '00100',
    '01010',
    '10001',
];
/** 札（縦長の紙）。(ax, ay) が紙のまんなか */
export function talismanSprite() {
    const W = 12, H = 21, gx = 3, gy = 6;
    const glyph = (v) => (x, y) => SEAL_GLYPH[y - gy]?.[x - gx] === v;
    const spr = sprite('talisman', W, H, [
        { s: rrect(1, 2, 11, 20), pal: PAPER, tone: (x, y) => (y > 17 && x > 7 ? 1 : x < 2 || y < 3 ? 4 : x > 9 ? 2 : 3) }, // 紙（右下は少しめくれて影）
        { s: minus(rrect(2, 3, 10, 19), rrect(3, 4, 9, 18)), pal: VERMILION, bare: true, tone: () => 2 }, // 朱の枠
        { s: glyph('1'), pal: INK, bare: true, tone: () => 2 },
        { s: glyph('2'), pal: VERMILION, bare: true, tone: () => 3 },
        { s: rrect(4, 0, 8, 2.5, 1), pal: VERMILION }, // 上の結び
    ]);
    return { spr, w: W, h: H, ax: 6, ay: 11 };
}
/** 三日月の刃（ふくらみが左）。(ax, ay) が中心 */
export function crescentSprite(col, size = 1) {
    const s = Math.round(size * 4) / 4, R = Math.round(30 * s), W = Math.round(R * 0.9) + 4, H = R * 2 + 4, cy = H / 2, cx = R + 2;
    const out = ell(cx, cy, R, R), cut = ell(cx + R * 0.42, cy, R * 0.95, R * 1.06);
    const pal = ramp(col, 0.6);
    const spr = sprite(`crescent:${s}:${col}`, W, H, [{
            s: minus(out, cut), pal,
            tone: (x, y) => { const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); return d > R - 1.5 ? 4 : d > R - 4 ? 3 : 2; },
        }]);
    return { spr, w: W, h: H, ax: Math.round(cx - R * 0.55), ay: Math.round(cy) };
}
// =====================================================================
// 鏡の盾の板（六角の鏡）
// =====================================================================
const SILVER = { o: '#141a2a', d: '#5a6a8a', m: '#a8b8d0', l: '#e0e8f4', h: '#ffffff' };
/** 六角の鏡（縦長）。glint は鏡面を走る光の帯の位置（0〜1）。(ax, ay) が中心 */
export function mirrorSprite(col, glint) {
    const W = 26, H = 58, cx = 13, cy = 29;
    const hexS = (rx, ry) => poly(Array.from({ length: 6 }, (_, i) => { const t = (i / 6) * Math.PI * 2 + Math.PI / 6; return [cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]; }));
    const g = Math.round(glint * 10), glass = ramp(col, 0.65);
    const spr = sprite(`mirror:${col}:${g}`, W, H, [
        { s: hexS(12.5, 28.5), pal: SILVER, bevel: 2 },
        {
            s: hexS(9, 23), pal: glass, tone: (x, y) => {
                const u = (x - cx) * 0.9 + (y - cy) * 0.45, band = -14 + g * 3.4;
                if (Math.abs(u - band) < 1.6)
                    return 4;
                if (Math.abs(u - band + 4) < 0.8)
                    return 3;
                return u < -4 ? 3 : u > 6 ? 1 : 2;
            },
        },
    ]);
    return { spr, w: W, h: H, ax: cx, ay: cy };
}
// =====================================================================
// 光の帯（光線・投げた玉の尾）: ふちのはっきりした3段の帯
// =====================================================================
export function pixelBeam(ctx, x0, y0, x1, y1, w, pal, alpha = 1, frame = 0) {
    if (alpha <= 0 || w <= 0)
        return;
    const L = Math.hypot(x1 - x0, y1 - y0);
    ctx.save();
    ctx.globalAlpha *= Math.min(1, alpha);
    ctx.translate(x0, y0);
    ctx.rotate(Math.atan2(y1 - y0, x1 - x0));
    const band = (hw, c) => { if (hw <= 0)
        return; ctx.fillStyle = c; ctx.fillRect(0, -Math.round(hw), Math.ceil(L), Math.max(1, Math.round(hw * 2))); };
    band(w / 2 + 1, pal.d);
    band(w / 2, pal.m);
    band(w * 0.32, pal.l);
    band(w * 0.14, pal.h);
    // ふちのぎざぎざ（流れる光の粒）
    ctx.fillStyle = pal.l;
    for (let i = 0; i < L; i += 5) {
        const j = (i + frame * 3) % 11;
        ctx.fillRect(i, -Math.round(w / 2) - 1 - (j % 3 === 0 ? 1 : 0), 2, 1);
        ctx.fillRect(i + 2, Math.round(w / 2) + (j % 4 === 0 ? 1 : 0), 2, 1);
    }
    ctx.restore();
}
/** 斬撃の線（両端が細く、まんなかが太い）。ぼかさず、外側の色・明るい色・白い芯の3段で塗る */
export function pixelSlash(ctx, x0, y0, x1, y1, wMax, pal, alpha = 1) {
    if (alpha <= 0 || wMax <= 0)
        return;
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    ctx.save();
    ctx.globalAlpha *= Math.min(1, alpha);
    for (const [k, c] of [[1, pal.m], [0.55, pal.l], [0.22, pal.h]]) {
        const w = Math.max(0.6, (wMax * k) / 2);
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + dx * 0.35 + nx * w, y0 + dy * 0.35 + ny * w);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x0 + dx * 0.35 - nx * w, y0 + dy * 0.35 - ny * w);
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();
}
//# sourceMappingURL=pixart.js.map