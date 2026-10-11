// ボス: vampire（霧の城の主 ヴェスペリオ伯爵）。右向き・96x84 ドット。ポーズの意味は boss.ts の BossPose を参照
// 長身の貴族: 青白い顔・オールバックの黒髪・とがった耳・赤い目・牙。黒い燕尾服に赤い裏地のマント（コウモリの翼形）。
// 光源は左上。主色・影・濃い影・ハイライトの4段階＋境目に少しディザ。ふちは outline() が付ける。
import { BOSS_RENDERERS, BW, BH, G, outline } from '../boss.js';
import { shade } from '../sprites.js';
const hash = (x, y) => { const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return v - Math.floor(v); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
// 明るさ l（-1..1）から4段階の色を選ぶ。境目は市松ディザ
function lit(pal, l, x, y) {
    const d = (x + y) & 1;
    if (l > 0.5)
        return pal[0];
    if (l > 0.4)
        return d ? pal[0] : pal[1];
    if (l > -0.15)
        return pal[1];
    if (l > -0.25)
        return d ? pal[1] : pal[2];
    if (l > -0.6)
        return pal[2];
    if (l > -0.7)
        return d ? pal[2] : pal[3];
    return pal[3];
}
// 立体的な楕円（左上から光）
function ball(g, cx, cy, rx, ry, pal, bias = 0) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
        for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
            const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, r = dx * dx + dy * dy;
            if (r > 1)
                continue;
            let l = -(dx * 0.65 + dy * 0.75) + bias;
            if (r > 0.75 && l < 0.3)
                l -= 0.35;
            g.set(x, y, lit(pal, l, x, y));
        }
}
function inPoly(pts, px, py) {
    let ins = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
            ins = !ins;
    }
    return ins;
}
function poly(g, pts, col) {
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++)
        for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
            if (!inPoly(pts, x + 0.5, y + 0.5))
                continue;
            const c = col(x, y);
            if (c)
                g.set(x, y, c);
        }
}
// 太さのある線（腕・脚・翼の骨）
function line(g, a, b, col, w = 1) {
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2));
    for (let i = 0; i <= n; i++) {
        const t = i / n, [x, y] = lerp(a, b, t);
        const c = typeof col === 'string' ? col : null;
        if (w <= 1) {
            g.set(x, y, c ?? col(Math.round(x), Math.round(y), t));
            continue;
        }
        const r = w / 2;
        for (let yy = Math.floor(y - r); yy <= Math.ceil(y + r); yy++)
            for (let xx = Math.floor(x - r); xx <= Math.ceil(x + r); xx++) {
                if ((xx + 0.5 - x) ** 2 + (yy + 0.5 - y) ** 2 > r * r)
                    continue;
                g.set(xx, yy, c ?? col(xx, yy, t));
            }
    }
}
// 小さなコウモリ（9x5）。f=0 翼を上げる / 1 下げる
const BAT = [
    ['X.......X', 'XX.XXX.XX', '.XXXXXXX.', '...XrX...', '....X....'],
    ['...X.X...', '..XXXXX..', '.XXXrXXX.', 'XX..X..XX', 'X.......X'],
];
function bat(g, x, y, f, body, eye) {
    BAT[f & 1].forEach((row, j) => [...row].forEach((ch, i) => {
        if (ch === 'X')
            g.set(x - 4 + i, y - 2 + j, j === 0 || (f & 1 && j === 4) ? shade(body, 0.25) : body);
        else if (ch === 'r')
            g.set(x - 4 + i, y - 2 + j, eye);
    }));
}
// 紫の霧のかたまり（ふちはディザで薄く）
function mist(g, cx, cy, rx, ry, pal, seed = 0) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
            const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, r = dx * dx + dy * dy;
            if (r > 1)
                continue;
            if (r > 0.6 && ((x + y) & 1))
                continue;
            if (r > 0.85 && hash(x + seed, y) < 0.5)
                continue;
            const l = -(dx * 0.5 + dy * 0.8) + (hash(x * 3 + seed, y * 7) - 0.5) * 0.5;
            g.set(x, y, lit(pal, l, x, y));
        }
}
export function render(p) {
    const g = new G();
    const rage = p.tint === 'rage';
    // 色
    const COAT = rage ? ['#5a2030', '#300a18', '#1e0610', '#100308'] : ['#454c78', '#2a2f52', '#1a1d36', '#0e1022'];
    const CAPE = rage ? ['#5a1a2a', '#3a0f1c', '#250812', '#14040a'] : ['#363256', '#211e3a', '#141228', '#0a0918'];
    const LINE = rage ? ['#ff4a5a', '#d8142c', '#8e0a20', '#560414'] : ['#d6324a', '#a3142c', '#6e0b1f', '#45061a'];
    const SKIN = rage ? ['#f6eaf0', '#dcc6d2', '#ac93a8', '#7a6280'] : ['#f4f6ff', '#d6dcee', '#a6aeca', '#767ea2'];
    const HAIR = ['#4a4268', '#221d34', '#130f20', '#08060e'];
    const LACE = ['#ffffff', '#ece8de', '#c4bdb0', '#8f887e'];
    const GEM = ['#ffb0bc', '#e8203c', '#a00c24', '#5a0414'];
    const GOLD = '#e0b040', GOLD_SH = '#9a6a1c';
    const MIST = rage ? ['#d890c8', '#a8509a', '#783a7c', '#4a2058'] : ['#c4a0f0', '#9068d0', '#6440a8', '#3e2878'];
    const EYE = rage ? '#ff5050' : '#ff1e32';
    const NAIL = '#d2c8e6', NAIL_SH = '#8a7eaa', NAIL_TIP = '#3c3058';
    const TROU = ['#363a5c', '#1c1e34', '#111224', '#08080f'];
    const sq = clamp(p.squash, 0, 4), d = sq / 4;
    const y0 = p.bob + sq * 1.4;
    const T = p.lean * 0.45; // 上半身の前のめり
    const H = p.lean * 0.7; // 頭はもっと前へ
    const s = clamp((p.wing + 2) / 4, 0, 1); // マントの開き 0..1（待機 0.5）
    const tl = p.tail;
    const goblet = p.mouth > 0.5 && p.lean < 8 && p.eye !== 'ko'; // 口を開けるときは血の杯を掲げる
    // ---- マント（体の後ろ）: コウモリの翼のような形。外側は黒、内側は深紅 ----
    const wingShape = (S, P0, Hm, n, dir, bulge, sp) => {
        const tips = [P0];
        for (let k = 1; k < n; k++) {
            const t = k / n, b = lerp(P0, Hm, t), bu = bulge * Math.sin(Math.PI * t);
            const fl = dir < 0 ? tl * t * t : tl * t * t * 0.3; // すそが翻る
            tips.push([b[0] + dir * bu * 0.95 + dir * fl * 1.8, b[1] + bu * 0.25 - Math.abs(fl) * 1.3 + (tl > 0 ? 0 : -fl * 0.3)]);
        }
        const hem = [Hm[0] + (dir < 0 ? -tl * 1.6 : 0), Hm[1] - (dir < 0 ? Math.max(0, tl) * 0.9 : 0)];
        tips.push(hem);
        const pts = [S, P0];
        for (let k = 0; k < tips.length - 1; k++) {
            const m = lerp(tips[k], tips[k + 1], 0.5), dep = 2.5 + sp * 2.5;
            const v = [S[0] - m[0], S[1] - m[1]], L = Math.hypot(v[0], v[1]) || 1;
            pts.push([m[0] + (v[0] / L) * dep, m[1] + (v[1] / L) * dep], tips[k + 1]);
        }
        return { pts, tips };
    };
    const drawWing = (S, P0, Hm, n, dir, bulge, sp, inner) => {
        const { pts, tips } = wingShape(S, P0, Hm, n, dir, bulge, sp);
        pts.push(inner);
        const span = Math.hypot(P0[0] - Hm[0], P0[1] - Hm[1]) || 1;
        poly(g, pts, (x, y) => {
            // 体に近いほど影、上のほうほど明るい（裏地）。翼が閉じ気味なら外側の黒が多く見える
            const dist = Math.hypot(x - S[0], y - S[1]) / span;
            const l = 0.35 - (y - P0[1]) / 60 + dist * 0.35 - (dist < 0.3 ? 0.5 : 0);
            if (sp < 0.35 && Math.abs(x - S[0]) > 2.5)
                return lit(CAPE, l - 0.35, x, y); // 閉じたマントは外側の黒
            return lit(LINE, l, x, y);
        });
        // 骨（指）と上ふちの黒い折り返し
        tips.forEach((tp, k) => { if (k > 0 && k < tips.length - 1)
            line(g, S, tp, (x, y) => lit(CAPE, -0.1 - k * 0.1, x, y)); });
        line(g, S, P0, (x, y, t) => lit(CAPE, 0.6 - t * 0.5, x, y), 2.4);
        line(g, lerp(S, P0, 0.5), P0, CAPE[0]);
        return tips;
    };
    const SL = [46 + T, 31 + y0], SR = [60 + T, 31 + y0];
    // 立ち襟（頭の後ろの高い襟）
    poly(g, [[42 + T, 33 + y0], [35 + H, 10 + y0], [42 + H, 12 + y0], [52 + T, 26 + y0]], (x, y) => lit(LINE, (x - 38 - H) / 12 - (y - 10 - y0) / 30, x, y));
    line(g, [42 + T, 33 + y0], [35 + H, 10 + y0], (x, y) => lit(CAPE, 0.3, x, y), 1.6);
    // 前側（右）のマント: 広げたときだけ大きく出る
    const s2 = clamp((s - 0.5) * 2, 0, 1);
    drawWing(SR, [64 + T + s2 * 18, 46 - s2 * 26 + y0], [63 + T * 0.5, 74], 3, 1, 3 + s2 * 6, s2 * 0.8 + 0.2, [58 + T, 56 + y0]);
    // 後ろ側（左）のマント
    const se = s ** 1.3;
    const leftTip = [38 - se * 28 + T * 0.3, 40 - se * 30 + y0];
    const ltips = drawWing(SL, leftTip, [40 + T * 0.3, 77], 4, -1, 8 + s * 8, s, [50 + T, 66]);
    // ---- 脚 ----
    const step = Math.max(0, p.lean) * 0.55;
    const legPal = (x, y) => lit(TROU, (50 - x) / 6 - 0.1 + (y < 60 ? 0.1 : 0), x, y);
    line(g, [48 + T * 0.6, 56 + y0], [46 - step * 0.2, 76], legPal, 4.2);
    line(g, [56 + T * 0.6, 56 + y0], [57 + step, 76], (x, y) => lit(TROU, (54 + step * 0.5 - x) / 5, x, y), 4.2);
    // 靴（とがったつま先は右向き）
    ball(g, 47 - step * 0.2, 77.5, 4, 2, ['#5a5878', '#26243a', '#16141f', '#0a0910']);
    ball(g, 59 + step, 77.5, 4.5, 2, ['#5a5878', '#26243a', '#16141f', '#0a0910']);
    g.set(63 + step, 78, '#16141f');
    g.set(46 - step * 0.2, 76, '#8a88a8');
    g.set(58 + step, 76, '#8a88a8');
    // ---- 後ろの腕（マントのふちをつかむ） ----
    const backHand = s > 0.3 ? lerp(SL, leftTip, 0.55) : [41 + T, 50 + y0];
    line(g, [46 + T, 35 + y0], backHand, (x, y) => lit(COAT, -0.35, x, y), 4);
    ball(g, backHand[0], backHand[1], 2.2, 2, SKIN, -0.4);
    for (let i = 0; i < 3; i++) {
        line(g, [backHand[0] - 1, backHand[1] - 1 + i], [backHand[0] - 4, backHand[1] - 3 + i * 2], NAIL);
        g.set(backHand[0] - 5, backHand[1] - 3.5 + i * 2, NAIL_TIP);
    }
    // ---- 胴（燕尾服） ----
    const coat = [[44 + T, 30 + y0], [61 + T, 30 + y0], [64 + T, 38 + y0], [61 + T, 52 + y0], [58 + T * 0.8, 56 + y0], [53 + T * 0.7, 55 + y0],
        [50 + T * 0.6, 60 + y0], [44 + T * 0.4 - tl * 0.6, 69 + y0 * 0.5 - Math.max(0, tl) * 0.5], [41 + T * 0.4 - tl * 0.4, 66 + y0 * 0.5], [43 + T * 0.6, 52 + y0], [41 + T, 40 + y0]];
    poly(g, coat, (x, y) => {
        const cx = 52 + T;
        let l = (cx - x) / 9 - (y - (30 + y0)) / 40;
        if (x > cx + 5)
            l -= 0.25;
        return lit(COAT, l, x, y);
    });
    // ベスト（深紅）と白いシャツ
    poly(g, [[51 + T, 31 + y0], [59 + T, 31 + y0], [57.5 + T, 50 + y0], [54.5 + T, 54 + y0], [52 + T, 50 + y0]], (x, y) => lit(LINE, (55 + T - x) / 4 - 0.3 - (y - 31 - y0) / 40, x, y));
    for (let i = 0; i < 3; i++)
        g.set(55 + T, 45 + i * 3 + y0, GOLD);
    // 襟（ラペル）のハイライト
    line(g, [50 + T, 31 + y0], [53 + T, 50 + y0], COAT[0]);
    line(g, [60 + T, 31 + y0], [57 + T, 50 + y0], COAT[2]);
    // 白い襟飾り（ジャボ）
    for (let i = 0; i < 4; i++)
        ball(g, 55 + T + (i & 1) * 0.8, 32.5 + i * 2.2 + y0, 3.4 - i * 0.35, 1.6, LACE);
    // 胸の赤い宝石のブローチ
    const bx = 55.5 + T, by = 42 + y0;
    ball(g, bx, by, 2.6, 2.6, [GOLD, GOLD, GOLD_SH, GOLD_SH]);
    ball(g, bx, by, 1.7, 1.7, GEM);
    g.set(bx - 1, by - 1, GEM[0]);
    // ---- 頭 ----
    const hx = 55 + H, hy = 19 + y0;
    // 首
    ball(g, hx - 1, hy + 9, 3, 3, SKIN, -0.4);
    // うしろ髪（耳の後ろまで流れる）
    ball(g, hx - 3, hy - 1, 9.5, 9, HAIR, -0.35);
    for (let k = 0; k < 3; k++)
        g.tri(hx - 10 - k, hy - 2 + k * 3, hx - 4, hy - 3 + k * 3, hx - 5, hy + 3 + k * 3, HAIR[2 + (k === 2 ? 1 : 0)]);
    // 顔（少しあごがとがる）
    ball(g, hx + 1.5, hy + 1, 8.2, 8.8, SKIN, 0.25);
    g.tri(hx - 2, hy + 6, hx + 9, hy + 5, hx + 4, hy + 11, SKIN[1]);
    for (let x = Math.round(hx); x <= hx + 6; x++)
        if (g.get(x, hy + 11) === SKIN[1])
            g.set(x, hy + 11, SKIN[2]);
    line(g, [hx - 1, hy + 7], [hx + 4, hy + 11], SKIN[2]);
    // オールバックの前髪（富士額）
    const hairline = (x) => {
        const u = x - hx;
        if (u < -3)
            return hy + 4 + (-3 - u) * 0.8;
        if (u < 3)
            return hy - 3.2 + (u + 3) * 0.25;
        return hy - 1.7 - (u - 3) * 0.7;
    };
    for (let y = Math.floor(hy - 11); y <= hy + 9; y++)
        for (let x = Math.floor(hx - 9); x <= hx + 11; x++) {
            const dx = (x + 0.5 - (hx + 0.5)) / 9.6, dy = (y + 0.5 - (hy - 0.5)) / 9.8;
            if (dx * dx + dy * dy > 1 || y >= hairline(x))
                continue;
            g.set(x, y, lit(HAIR, -(dx * 0.6 + dy * 0.8) - 0.4, x, y));
        }
    // 後ろへなでつけた髪のつや
    for (let k = 0; k < 3; k++)
        for (let i = 0; i < 9; i++) {
            const x = hx + 4 - i * 1.3, y = hy - 8 + k * 2.4 + i * i * 0.06;
            if (g.get(Math.round(x), Math.round(y)) && y < hairline(x) - 0.5)
                g.set(x, y, k === 0 ? HAIR[0] : shade(HAIR[0], -0.25));
        }
    // とがった耳
    g.tri(hx - 5, hy + 4, hx - 2, hy, hx - 11, hy - 5, SKIN[1]);
    g.tri(hx - 5, hy + 3, hx - 3, hy + 1.5, hx - 9, hy - 2, SKIN[2]);
    g.set(hx - 10, hy - 4, SKIN[0]);
    g.set(hx - 9, hy - 4, SKIN[0]);
    // 顔の陰（髪の下・目のくぼみ）
    for (let x = Math.round(hx - 2); x <= hx + 9; x++) {
        const y = Math.ceil(hairline(x));
        if (g.get(x, y) === SKIN[1] || g.get(x, y) === SKIN[0])
            g.set(x, y, SKIN[2]);
    }
    const e1 = [hx + 2, hy + 1], e2 = [hx + 7, hy + 1];
    // 鼻
    g.set(hx + 9, hy + 3, SKIN[2]);
    g.set(hx + 9, hy + 4, SKIN[3]);
    g.set(hx + 10, hy + 3, SKIN[1]);
    // 目
    if (p.eye === 'ko') {
        for (const [ex, ey] of [e1, e2])
            for (let i = -1; i <= 1; i++) {
                g.set(ex + i, ey + i, '#3a1020');
                g.set(ex + i, ey - i, '#3a1020');
            }
    }
    else if (p.eye === 'hurt') {
        for (const [ex, ey] of [e1, e2]) {
            g.set(ex - 1, ey - 1, SKIN[3]);
            g.set(ex, ey, '#3a1020');
            g.set(ex + 1, ey, '#3a1020');
            g.set(ex + 2, ey - 1, SKIN[3]);
        }
        // 苦しげな眉
        line(g, [e1[0] - 1, e1[1] - 3], [e1[0] + 2, e1[1] - 4], HAIR[1]);
        line(g, [e2[0] - 1, e2[1] - 4], [e2[0] + 2, e2[1] - 3], HAIR[1]);
    }
    else {
        const angry = p.eye === 'angry' || rage;
        for (const [ex, ey] of [e1, e2]) {
            g.set(ex - 1, ey - 1, SKIN[2]);
            g.set(ex, ey - 1, SKIN[3]);
            g.set(ex + 1, ey - 1, SKIN[3]);
            g.set(ex - 1, ey, '#5a0a18');
            g.set(ex, ey, EYE);
            g.set(ex + 1, ey, EYE);
            g.set(ex, ey + 1, shade(EYE, -0.4));
            g.set(ex + 1, ey + 1, shade(EYE, -0.2));
            g.set(ex + 1, ey, angry ? '#ffe0a0' : '#ffd0d6');
        }
        if (angry) {
            // つり上がった眉（内側が下がる）
            line(g, [e1[0] - 2, e1[1] - 4], [e1[0] + 2, e1[1] - 2], HAIR[2]);
            line(g, [e2[0] - 1, e2[1] - 2], [e2[0] + 2, e2[1] - 4], HAIR[2]);
            if (rage)
                for (const [ex, ey] of [e1, e2]) {
                    g.set(ex + 2, ey, '#ff8a8a');
                    g.set(ex + 3, ey - 1, '#ff5050');
                }
        }
        else {
            line(g, [e1[0] - 2, e1[1] - 3], [e1[0] + 2, e1[1] - 3], HAIR[1]);
            line(g, [e2[0] - 1, e2[1] - 3], [e2[0] + 2, e2[1] - 4], HAIR[1]);
        }
    }
    // 口と牙
    const mx = hx + 6, my = hy + 6;
    const mo = clamp(p.mouth, 0, 2);
    if (mo > 0.3 || p.eye === 'ko') {
        const oh = p.eye === 'ko' ? 1 : Math.round(mo * 1.5);
        for (let y = 0; y <= oh; y++)
            for (let x = -2; x <= 2; x++)
                if (!(y === oh && Math.abs(x) === 2))
                    g.set(mx + x, my + y, y === 0 ? '#3a0610' : '#7a1020');
        g.set(mx, my + oh, '#c0303c');
        // 牙（上の2本）
        g.set(mx - 2, my, '#ffffff');
        g.set(mx - 2, my + 1, '#ffffff');
        g.set(mx + 2, my, '#ffffff');
        g.set(mx + 2, my + 1, '#ffffff');
        if (oh >= 2) {
            g.set(mx - 2, my + 2, '#d8d8e8');
            g.set(mx + 2, my + 2, '#d8d8e8');
        }
    }
    else {
        line(g, [mx - 2, my], [mx + 2, my - (p.eye === 'angry' ? 0 : 1)], '#5a1a2a');
        g.set(mx - 1, my + 1, '#ffffff');
        g.set(mx + 2, my + 1 - (p.eye === 'angry' ? 0 : 1), '#ffffff'); // 牙がのぞく
    }
    // ---- 前の腕（爪で切り裂く／血の杯を掲げる） ----
    const W = goblet ? [76 + p.lean * 0.5, 39 - mo * 1.5 + y0] : [72 + p.lean * 1.05, 45 - p.lean * 0.6 + y0];
    const sh = [61 + T, 35 + y0];
    const elbow = goblet ? [66 + T, 44 + y0] : lerp(sh, W, 0.5);
    if (goblet)
        elbow[1] = Math.max(elbow[1], W[1] + 6);
    line(g, sh, elbow, (x, y) => lit(COAT, 0.1 - (y - sh[1]) / 20, x, y), 4.4);
    line(g, elbow, W, (x, y) => lit(COAT, 0.2 - (x - elbow[0]) / 30, x, y), 4);
    // そで口のレース
    line(g, [W[0] - 1, W[1] - 2.5], [W[0] - 1, W[1] + 2.5], LACE[1]);
    line(g, [W[0] - 2, W[1] - 2], [W[0] - 2, W[1] + 2], LACE[2]);
    if (goblet) {
        // 血の杯（金の杯から赤い血があふれる）
        ball(g, W[0] + 2, W[1], 2.4, 2.2, SKIN);
        const gx = W[0] + 3, gy = W[1] - 5;
        line(g, [gx, gy + 1], [gx, gy + 4], GOLD_SH);
        line(g, [gx - 2, gy + 4], [gx + 2, gy + 4], GOLD);
        poly(g, [[gx - 4, gy - 4], [gx + 4.5, gy - 4], [gx + 2, gy + 1], [gx - 1.5, gy + 1]], (x, y) => (x < gx ? GOLD : x < gx + 2 ? '#c08a2c' : GOLD_SH));
        line(g, [gx - 3, gy - 4], [gx + 3, gy - 4], '#c0102a');
        g.set(gx - 2, gy - 5, GEM[0]);
        g.set(gx + 4, gy - 3, '#c0102a');
        g.set(gx + 4, gy - 2, '#8a0a1e');
        g.set(gx, gy - 2, '#fff2b0');
        // 指先の爪
        g.set(W[0] + 4, W[1] + 1, NAIL);
        g.set(W[0] + 5, W[1] + 1, NAIL_SH);
    }
    else {
        // 長い爪の手（爪先が右を向く）
        ball(g, W[0] + 1.5, W[1], 2.6, 2.4, SKIN, -0.3);
        const reach = 6 + Math.max(0, p.lean) * 0.3;
        for (let i = 0; i < 4; i++) {
            // 指（肌）→ 長い爪（先がかぎ状に下へ曲がる）
            const a = [W[0] + 3, W[1] - 1.8 + i * 1.2], k = [W[0] + 5, W[1] - 3 + i * 2], b = [W[0] + 4 + reach, W[1] - 5 + i * 3];
            line(g, a, k, SKIN[2]);
            line(g, k, b, i === 0 ? NAIL : lerp(k, b, 0.5)[1] > W[1] ? NAIL_SH : NAIL);
            g.set(b[0] + 1, b[1] + 1, NAIL_TIP);
        }
        g.set(W[0] + 0.5, W[1] - 1, SKIN[0]);
    }
    // ---- 霧になって崩れる（squash）----
    if (d > 0) {
        const yCut = 80 - d * 50;
        for (let y = Math.max(0, Math.floor(yCut)); y < BH; y++)
            for (let x = 0; x < BW; x++) {
                if (!g.get(x, y))
                    continue;
                const depth = (y - yCut) / 14, h = hash(x, y);
                if (h < depth * 0.3)
                    g.c[y * BW + x] = null;
                else if (h < depth * 0.8)
                    g.set(x, y, h * 7 % 1 < 0.5 ? MIST[(Math.floor(h * 31) % 3)] : (h * 13 % 1 < 0.5 ? '#8a8494' : '#5a5466'));
            }
        // 舞い上がる灰と霧の粒
        for (let i = 0; i < 30 * d; i++) {
            const x = 22 + hash(i, 7) * 56, y = yCut - 4 - hash(i, 3) * 24 * d;
            g.set(x, y, i % 3 ? MIST[i % 2 ? 0 : 1] : '#9a94a6');
        }
    }
    // ---- 足もとの紫の霧 ----
    const mb = Math.sin(p.bob * 1.3) * 1.2;
    mist(g, 50, 80, 26 + sq * 2, 3.8 + sq * 0.6, MIST, 1);
    mist(g, 30 - mb, 77.5, 9, 3, MIST, 2);
    mist(g, 68 + mb, 78, 10, 3, MIST, 3);
    mist(g, 44 + mb, 82, 12, 2.4, MIST, 4);
    for (let i = 0; i < 6; i++)
        g.set(28 + hash(i, 1) * 44, 72 - hash(i, 2) * 4 + mb, MIST[0]);
    // ---- まわりを飛ぶコウモリ ----
    const f = Math.round(p.bob + p.wing * 2) & 1;
    const batBody = rage ? '#3a1424' : '#2c2442';
    const bats = [[16, 14], [80, 9], [10, 46]];
    if (s > 0.7)
        bats.push([30, 4], [6, 24], [72, 22], [24, 60]); // マントを広げるとコウモリの群れ
    if (d > 0.9)
        bats.length = 0;
    bats.forEach(([x, y], i) => bat(g, x + Math.sin(i * 2 + p.bob) * 1.5, y + y0 * 0.4 + (i % 2 ? p.bob : -p.bob) * 0.6, f ^ (i & 1), batBody, EYE));
    return outline(g);
}
BOSS_RENDERERS.vampire = render;
//# sourceMappingURL=vampire.js.map