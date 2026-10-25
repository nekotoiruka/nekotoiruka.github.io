// モーション見本帳の描画（討伐画面の、ボスの攻撃への対応で使う。見本帳のページと同じコード）。
// モーション見本帳: 通常攻撃・ガード・回避・ジャンプ・必殺技の候補を、ひとつのドットの格子（1ドット = 1画素）で描いて並べる。
import './bosses/index.js';
// キャラとボスはゲーム本体の描画コード（drawHero / bossCanvas）をそのまま使う。エフェクトはすべて fillRect の点だけで描き、
// 半透明の代わりにディザ（市松模様の間引き）、なめらかな線の代わりに太さ1〜3ドットの点の並びにしている。
import { drawHero, muzzleOf } from './hero.js';
import { bossCanvas, BOSS_IDLE, BH } from './boss.js';
import { MOTION_PICKS } from './motionpicks.js';
// ---------------------------------------------------------------- 画面と時間
// 1枚の大きさ（ドット）・床の高さ・冒険者の立ち位置・攻撃が当たる所（ボスの胸）。12人の画面では、1人ずつ描く前に入れ替える
export let W = 144, H = 88, FY = 80;
let HX = 116;
let TX = 26, TY = 46; // 吸血鬼の胸のあたり（腕の少し奥）
let QUIET = false; // 主役以外: 画面全体の閃光・揺れ・カットインを出さない
let BOSS_KIND = 'vampire';
let PAIR_REACH = false; // ボスの攻撃を迎え撃つ（斬りはらう・打ち砕く・撃ち落とす）とき: 当てる先を、目の前の飛んでくるものにする
let LIFT = null; // 近接の反撃で、元の列から寄せる分（drawInArena）
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const liftAt = (x) => (LIFT ? R(LIFT.dy * (1 - clamp01((LIFT.from - x) / Math.max(1, LIFT.from - LIFT.to)))) : 0);
let REACH_TO = null; // 討伐画面の反撃: 近接の型が踏みこむ先（ボスの前）。null なら見本帳の位置
let NO_ATTACK = false; // ボスの攻撃とセットで見るとき: 見本の中の仮の攻撃（赤い玉・赤い弧）を描かない
const LOOP = 2.0; // 1回の長さ（秒）
const clamp = (x) => Math.max(0, Math.min(1, x));
const win = (t, a, b) => clamp((t - a) / (b - a));
const bump = (t, a, b) => (t < a || t > b ? 0 : Math.sin(((t - a) / (b - a)) * Math.PI));
const ease = (k) => 1 - (1 - k) * (1 - k);
const easeIn = (k) => k * k;
const lerp = (a, b, k) => a + (b - a) * k;
const R = Math.round;
const TAU = Math.PI * 2;
let REDUCED = false;
export function setReduced(v) { REDUCED = v; }
// 決まった乱数（毎回同じ絵になる）
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
// ---------------------------------------------------------------- 色（3〜5色の段）
const PAL = {
    steel: ['#ffffff', '#c8f0ff', '#6ac8f0', '#2a6aa8'],
    gold: ['#ffffff', '#fff1a8', '#ffc83a', '#c8781a'],
    fire: ['#ffffff', '#fff1a8', '#ffb43a', '#f0582a', '#8a1a2a'],
    ice: ['#ffffff', '#d8f8ff', '#8ad8ff', '#3a8ad8'],
    arc: ['#ffffff', '#f0d0ff', '#c87aff', '#7a3ad8', '#3a1a7a'],
    bolt: ['#ffffff', '#fff6a0', '#ffe03a', '#d89a1a'],
    shadow: ['#e8d0ff', '#9a5ad8', '#5a2a9a', '#24103e'],
    leaf: ['#f0ffd0', '#a8f05a', '#4ac03a', '#1a7a3a'],
    blood: ['#ffd0d8', '#ff6a8a', '#c81a4a', '#5a0a24'],
    dust: ['#f0e6d0', '#c8b48a', '#8a7a5a'],
    holy: ['#ffffff', '#fff8d8', '#ffe27a', '#e8a83a'],
};
// ---------------------------------------------------------------- 点の道具
// 4x4 のディザ表: 濃さ a（0..1）のとき、表の値が a より小さい点だけを塗る
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const on = (x, y, a) => a >= 1 || (a > 0 && BAYER[((y & 3) << 2) | (x & 3)] < a);
function P(c, x, y, col, w = 1, h = 1) { c.fillStyle = col; c.fillRect(R(x), R(y), w, h); }
function rectD(c, x0, y0, w, h, col, a) {
    c.fillStyle = col;
    x0 = R(x0);
    y0 = R(y0);
    for (let y = Math.max(0, y0); y < Math.min(H, y0 + h); y++)
        for (let x = Math.max(0, x0); x < Math.min(W, x0 + w); x++)
            if (on(x, y, a))
                c.fillRect(x, y, 1, 1);
}
// 太さ w の点の線（ブレゼンハム）
function line(c, x0, y0, x1, y1, col, w = 1, a = 1) {
    x0 = R(x0);
    y0 = R(y0);
    x1 = R(x1);
    y1 = R(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    c.fillStyle = col;
    const o = Math.floor((w - 1) / 2);
    for (;;) {
        if (on(x0, y0, a))
            c.fillRect(x0 - o, y0 - o, w, w);
        if (x0 === x1 && y0 === y1)
            break;
        const e2 = 2 * e;
        if (e2 >= dy) {
            e += dy;
            x0 += sx;
        }
        if (e2 <= dx) {
            e += dx;
            y0 += sy;
        }
    }
}
// 段のついた太い線（外側から暗い色 → 明るい芯）
function rampLine(c, x0, y0, x1, y1, ramp, w, a = 1) {
    for (let i = ramp.length - 1; i >= 0; i--) {
        const ww = Math.max(1, R((w * (i + 1)) / ramp.length));
        line(c, x0, y0, x1, y1, ramp[i], ww, a);
    }
}
function disc(c, cx, cy, r, col, a = 1, ry = 1) {
    cx = R(cx);
    cy = R(cy);
    c.fillStyle = col;
    const rr = r + 0.4, ryy = Math.max(0.5, r * ry + 0.4);
    for (let y = -Math.ceil(ryy); y <= Math.ceil(ryy); y++)
        for (let x = -Math.ceil(rr); x <= Math.ceil(rr); x++) {
            if ((x * x) / (rr * rr) + (y * y) / (ryy * ryy) <= 1 && on(cx + x, cy + y, a))
                c.fillRect(cx + x, cy + y, 1, 1);
        }
}
// 段のついた玉（外から暗い色）
function orb(c, x, y, r, ramp, a = 1) {
    for (let i = ramp.length - 1; i >= 0; i--)
        disc(c, x, y, Math.max(0.5, (r * (i + 1)) / ramp.length), ramp[i], a);
}
function ring(c, cx, cy, r, col, th = 1, a = 1, ry = 1) {
    cx = R(cx);
    cy = R(cy);
    c.fillStyle = col;
    const ro = r + 0.5, ri = Math.max(0, r - th + 0.5);
    const roy = Math.max(0.6, r * ry + 0.5), riy = Math.max(0, (r - th) * ry + 0.5);
    for (let y = -Math.ceil(roy); y <= Math.ceil(roy); y++)
        for (let x = -Math.ceil(ro); x <= Math.ceil(ro); x++) {
            const out = (x * x) / (ro * ro) + (y * y) / (roy * roy) <= 1;
            const inn = ri > 0 && riy > 0 && (x * x) / (ri * ri) + (y * y) / (riy * riy) < 1;
            if (out && !inn && on(cx + x, cy + y, a))
                c.fillRect(cx + x, cy + y, 1, 1);
        }
}
// 広がって消える輪（濃さが 0 と 1 のあいだのときだけ描く。始まる前と終わったあとは出さない）
function ringK(c, cx, cy, r, col, th, a, ry = 1) { if (a > 0 && a < 1 && r >= 1)
    ring(c, cx, cy, r, col, th, a < 0.5 ? a * 2 : 1, ry); }
// 三日月の帯（剣の軌跡）。角度 a0→a1、半径 r0..r1。半径の外ほど明るい段。ry で縦につぶす
function band(c, cx, cy, r0, r1, a0, a1, ramp, a = 1, ry = 1, taper = true) {
    cx = R(cx);
    cy = R(cy);
    const lo = Math.min(a0, a1), hi = Math.max(a0, a1), head = a1;
    const n = ramp.length;
    for (let y = -Math.ceil(r1 * ry) - 1; y <= Math.ceil(r1 * ry) + 1; y++)
        for (let x = -r1 - 1; x <= r1 + 1; x++) {
            const d = Math.hypot(x, y / ry);
            if (d < r0 || d > r1 + 0.5)
                continue;
            let ang = Math.atan2(y / ry, x);
            while (ang < lo)
                ang += TAU;
            while (ang > lo + TAU)
                ang -= TAU;
            if (ang > hi)
                continue;
            // 先端ほど太く、尾ほど細い（尾は外側だけ残る）
            const along = Math.abs(ang - (head === hi ? lo : hi)) / Math.max(1e-6, hi - lo);
            const inner = taper ? lerp(r1 - 0.6, r0, along) : r0;
            if (d < inner)
                continue;
            const q = (d - inner) / Math.max(0.5, r1 - inner);
            const idx = Math.min(n - 1, Math.max(0, R((1 - q) * (n - 1))));
            if (!on(cx + x, cy + y, a * (taper ? 0.55 + 0.45 * along : 1) + (idx === 0 ? 0.3 : 0)))
                continue;
            c.fillStyle = ramp[idx];
            c.fillRect(cx + x, cy + y, 1, 1);
        }
}
// 十字のきらめき（大きさ 1〜4）
function star(c, x, y, s, col = '#ffffff', core = col) {
    x = R(x);
    y = R(y);
    s = R(s);
    if (s <= 0)
        return;
    c.fillStyle = col;
    c.fillRect(x - s, y, 2 * s + 1, 1);
    c.fillRect(x, y - s, 1, 2 * s + 1);
    if (s >= 3) {
        c.fillRect(x - 1, y - 1, 3, 3);
    }
    c.fillStyle = core;
    c.fillRect(x, y, 1, 1);
}
// 当たりの火花: 中心から放射する短い線。k は 0→1
function sparks(c, x, y, k, n, len, ramp, seed = 1, spread = TAU, dir = 0) {
    if (k <= 0 || k >= 1)
        return;
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
        const ang = dir - spread / 2 + spread * ((i + r() * 0.6) / n), L = len * (0.6 + r() * 0.6);
        const d0 = L * ease(k) * 0.4, d1 = L * ease(k);
        const col = ramp[Math.min(ramp.length - 1, Math.floor(k * ramp.length))];
        line(c, x + Math.cos(ang) * d0, y + Math.sin(ang) * d0, x + Math.cos(ang) * d1, y + Math.sin(ang) * d1, col, 1);
    }
}
// 飛び散る点（重力つき）
function debris(c, x, y, k, n, sp, ramp, seed = 3, up = 1, g = 60) {
    if (k <= 0 || k >= 1)
        return;
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
        const ang = -Math.PI / 2 + (r() - 0.5) * 2.6 * up, v = sp * (0.4 + r() * 0.8);
        const px = x + Math.cos(ang) * v * k, py = y + Math.sin(ang) * v * k + g * k * k;
        if (py > FY + 1)
            continue;
        P(c, px, py, ramp[Math.min(ramp.length - 1, Math.floor((k + r() * 0.3) * ramp.length))], r() > 0.6 ? 2 : 1, 1);
    }
}
// 砂ぼこり（地面で左右に広がる小さな点の雲）
function dust(c, x, k, size = 1, seed = 5) {
    if (k <= 0 || k >= 1)
        return;
    const r = rng(seed);
    for (let i = 0; i < 8 * size; i++) {
        const s = r() < 0.5 ? -1 : 1, d = (4 + r() * 10 * size) * ease(k);
        const px = x + s * d, py = FY - 1 - r() * 4 * size * Math.sin(k * Math.PI);
        disc(c, px, py, (1 - k) * (1.5 + r() * 1.5) * size, PAL.dust[i % 3], 1 - k * 0.6);
    }
}
// 速度の線（流れる横線）
function speedLines(c, k, dir, col, y0 = 20, y1 = FY - 2, n = 10, seed = 7) {
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
        const y = R(lerp(y0, y1, r())), len = 6 + r() * 18, x = ((r() * W + k * W * 3 * dir) % W + W) % W;
        line(c, x, y, x + len * dir, y, col, 1, 0.75);
    }
}
// 画面いっぱいの閃光（ディザ）。動きを減らす設定では弱める
function flash(c, a, col = '#ffffff') { if (a <= 0 || QUIET)
    return; c.save(); c.globalAlpha = REDUCED ? a * 0.25 : a * 0.7; c.fillStyle = col; c.fillRect(-8, -8, W + 16, H + 16); c.restore(); }
// 上下の黒い帯（シネマの帯）
function letterbox(c, k) { if (k <= 0 || QUIET)
    return; const h = R(k * 12); P(c, 0, 0, '#05030c', W, h); P(c, 0, H - h, '#05030c', W, h); }
const silCache = new Map();
let heroBuf = null;
// 冒険者を1枚の小さな画像に描いてから使う（残像・色ぬり・90度回転のため）
function heroSprite(L, action, at, frame, flip = true) {
    if (!heroBuf) {
        heroBuf = document.createElement('canvas');
        heroBuf.width = 40;
        heroBuf.height = 40;
    }
    const x = heroBuf.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.clearRect(0, 0, 40, 40);
    drawHero(x, L.look, L.gear, 20, 36, { frame, flip, action, t: at });
    return heroBuf;
}
function tinted(img, col, key) {
    let s = silCache.get(key);
    if (!s) {
        s = document.createElement('canvas');
        s.width = img.width;
        s.height = img.height;
        silCache.set(key, s);
    }
    const x = s.getContext('2d');
    x.clearRect(0, 0, s.width, s.height);
    x.globalCompositeOperation = 'source-over';
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = col;
    x.fillRect(0, 0, s.width, s.height);
    x.globalCompositeOperation = 'source-over';
    return s;
}
// 輪郭だけの画像（残像用）。体の外側1ドットを色で塗る
let olBuf = null;
function outlineOf(img, col) {
    if (!olBuf) {
        olBuf = document.createElement('canvas');
        olBuf.width = img.width + 2;
        olBuf.height = img.height + 2;
    }
    const x = olBuf.getContext('2d');
    x.clearRect(0, 0, olBuf.width, olBuf.height);
    x.imageSmoothingEnabled = false;
    const t = tinted(img, col, 'ol:' + col);
    for (const [ox, oy] of [[0, 1], [2, 1], [1, 0], [1, 2]])
        x.drawImage(t, ox, oy);
    x.globalCompositeOperation = 'destination-out';
    x.drawImage(img, 1, 1);
    x.globalCompositeOperation = 'source-over';
    return olBuf;
}
// ディザで間引いた画像を描く（半透明の代わり）
let ditherBuf = null;
function drawDither(c, img, x, y, a) {
    if (a >= 1) {
        c.drawImage(img, R(x), R(y));
        return;
    }
    if (a <= 0)
        return;
    if (!ditherBuf) {
        ditherBuf = document.createElement('canvas');
        ditherBuf.width = 80;
        ditherBuf.height = 80;
    }
    const d = ditherBuf.getContext('2d');
    d.imageSmoothingEnabled = false;
    d.clearRect(0, 0, 80, 80);
    d.drawImage(img, 0, 0);
    d.globalCompositeOperation = 'destination-out';
    d.fillStyle = '#000';
    const X = R(x), Y = R(y);
    for (let yy = 0; yy < img.height; yy++)
        for (let xx = 0; xx < img.width; xx++)
            if (!on(X + xx, Y + yy, a))
                d.fillRect(xx, yy, 1, 1);
    d.globalCompositeOperation = 'source-over';
    c.drawImage(ditherBuf, 0, 0, img.width, img.height, X, Y, img.width, img.height);
}
function makeEnv(c, t, f, L, hc = c) {
    const e = {
        c, t, f, L, weapon: L.look.weapon,
        hero(x, y, action = 'idle', at = 0, o = {}) {
            y += liftAt(x);
            const img = heroSprite(L, action, at, f, o.flip ?? true);
            const src = o.tint ? tinted(img, o.tint, 'tint:' + o.tint) : img;
            const X = R(x) - 20, Y = R(y) - 36;
            if (o.rot || o.scale) {
                hc.save();
                hc.translate(R(x), R(y) - 12);
                if (o.rot)
                    hc.rotate((R(o.rot) % 4) * (Math.PI / 2)); // 90度ずつだけ回す（ドットが崩れない）
                const s = o.scale ?? 1;
                hc.scale(s, s);
                drawDither(hc, src, -20, -24, o.a ?? 1);
                hc.restore();
            }
            else
                drawDither(hc, src, X, Y, o.a ?? 1);
        },
        muzzle(x, y, action = 'cast', at = 0.5) {
            y += liftAt(x);
            const m = muzzleOf(L.look, 20, 36, { frame: f, flip: true, action, t: at });
            return { x: R(x) - 20 + m.x, y: R(y) - 36 + m.y };
        },
        ghost(x, y, col, a, action = 'dash', at = 0) {
            if (a <= 0.12)
                return;
            y += liftAt(x);
            const img = heroSprite(L, action, at, f, true);
            hc.drawImage(outlineOf(img, col), R(x) - 21, R(y) - 37);
            if (a > 0.45)
                drawDither(hc, tinted(img, col, 'g:' + col), R(x) - 20, R(y) - 36, (a - 0.45) * 0.9);
        },
        boss(o = {}) {
            const p = { ...BOSS_IDLE, bob: R(Math.sin(f / 10) * 1), wing: R(Math.sin(f / 8) * 1.5), eye: o.hit ? 'hurt' : 'open', ...(o.pose ?? {}) };
            const img = bossCanvas(p, !!o.hit && f % 4 < 2, BOSS_KIND);
            const x = -42 + R(o.dx ?? 0), y = FY - BH + 6 + R(o.dy ?? 0);
            c.drawImage(img, x, y);
            if (o.tint && o.tintA)
                drawDither(c, tinted(img, o.tint, 'b:' + o.tint), x, y, o.tintA);
        },
        shake(n) { if (!REDUCED && !QUIET && n > 0)
            c.translate(R(Math.sin(f * 2.3) * n), R(Math.cos(f * 1.7) * n * 0.6)); },
        bg(dark = 0) {
            // 古城の石床と壁（紹介ページの「遊び方」と同じ色の系統）
            P(c, -8, -8, '#1a1424', W + 16, H + 16);
            for (let y = 6; y < FY - 18; y += 8)
                for (let x = (y / 8) % 2 ? -8 : 0; x < W + 8; x += 16)
                    P(c, x + 1, y + 1, '#221a30', 14, 6);
            P(c, -8, FY - 18, '#2a2038', W + 16, 1);
            P(c, -8, FY - 17, '#1f1a2e', W + 16, H - FY + 26);
            for (let y = FY - 14; y < H + 8; y += 6)
                for (let x = ((y - FY) / 6) % 2 ? -6 : 0; x < W + 8; x += 12)
                    P(c, x + 1, y + 1, '#2a2440', 10, 4);
            if (dark > 0) {
                c.save();
                c.globalAlpha = Math.min(0.85, dark);
                c.fillStyle = '#05030c';
                c.fillRect(-8, -8, W + 16, H + 16);
                c.restore();
            }
        },
    };
    return e;
}
// 共通: 近づいて戻る（近接用）。到着は t1、戻りは t2 から
function approach(t, t0, t1, t2, t3, to = 64) {
    if (PAIR_REACH)
        to = HX - 12; // 迎え撃つとき: ボスまで走らず、目の前で振る
    else if (REACH_TO !== null)
        to = REACH_TO;
    if (t < t0)
        return HX;
    if (t < t1)
        return R(lerp(HX, to, ease(win(t, t0, t1))));
    if (t < t2)
        return to;
    return R(lerp(to, HX, ease(win(t, t2, t3))));
}
// 当たった瞬間だけ時間を止める（ヒットストップ）。at からの dur を、その瞬間に固定
function stop(t, at, dur) { return t < at ? t : t < at + dur ? at : t - dur; }
const hitBoss = (e, at, len = 0.08, push = 3) => { const k = e.t - at; e.boss({ hit: k >= 0 && k < len, dx: k >= 0 && k < len * 2 ? -push * (1 - k / (len * 2)) : 0 }); };
const heroMove = (e, x, y, t, a, b, act = 'attack') => e.hero(x, y, t > a && t < b ? act : 'idle', win(t, a, b));
// ================================================================ 1. 斬る（剣・刀・短剣・大鎌）
const SLASH = [
    { id: 'slash-crescent', name: '三日月', note: '踏み込んで、太い三日月の軌跡を1枚。外ほど明るい4段の色で、2コマ残してから点で散らす。', draw(e) {
            const t = e.t;
            e.bg();
            hitBoss(e, 0.4);
            const x = approach(t, 0.1, 0.28, 0.6, 0.78);
            heroMove(e, x, FY, t, 0.28, 0.5);
            const k = win(t, 0.33, 0.42), fade = 1 - win(t, 0.46, 0.58);
            if (k > 0 && fade > 0)
                band(e.c, x - 10, FY - 16, 10, 18, Math.PI + 2.2, lerp(Math.PI + 2.2, Math.PI - 1.3, ease(k)), PAL.steel, fade);
            star(e.c, TX + 8, TY, R(4 * bump(t, 0.4, 0.5)));
            sparks(e.c, TX + 6, TY, win(t, 0.4, 0.52), 8, 12, PAL.steel, 2);
        } },
    { id: 'slash-iai', name: '一閃（居合）', note: 'すれ違いざまに細い白線が1本。一拍おいて線が太くなり、遅れて斬れる。', draw(e) {
            const t = e.t;
            e.bg();
            const cut = 0.55;
            hitBoss(e, cut, 0.1, 4);
            let x = HX;
            if (t > 0.18 && t < 0.3)
                x = R(lerp(HX, 6, win(t, 0.18, 0.24)));
            else if (t >= 0.3 && t < 0.75)
                x = 6;
            else if (t >= 0.75)
                x = R(lerp(6, HX, ease(win(t, 0.75, 0.92))));
            if (t > 0.18 && t < 0.26)
                for (let i = 1; i < 5; i++)
                    e.ghost(lerp(HX, 6, win(t, 0.18, 0.24) - i * 0.05), FY, '#c8f0ff', 0.5 - i * 0.1);
            e.hero(x, FY, t > 0.24 && t < 0.7 ? 'guard' : t >= 0.75 ? 'dash' : 'idle', 1, { flip: !(t > 0.24 && t < 0.75) });
            const lk = bump(t, 0.24, 0.62) * (t > 0.24 ? 1 : 0);
            if (lk > 0) {
                const th = t > cut ? 3 : 1;
                rampLine(e.c, 0, TY + 4, W, TY - 6, t > cut ? PAL.steel : ['#ffffff'], th, t > cut ? 1 - win(t, cut, 0.66) : 1);
            }
            if (t > cut) {
                flash(e.c, bump(t, cut, cut + 0.04) * 0.6);
                sparks(e.c, TX + 4, TY - 1, win(t, cut, cut + 0.14), 12, 16, PAL.steel, 4);
            }
        } },
    { id: 'slash-triple', name: '三連撃', note: '短い斬撃を「斜め・逆斜め・横」の3回。1回ごとに小さな火花、最後だけ大きく。', draw(e) {
            const t = e.t;
            e.bg();
            const hits = [0.34, 0.42, 0.5];
            const last = hits.filter((h) => t >= h).pop();
            e.boss({ hit: last !== undefined && t - last < 0.05, dx: last !== undefined && t - last < 0.06 ? -2 : 0 });
            const x = approach(t, 0.08, 0.26, 0.62, 0.8, 62);
            const sub = hits.findIndex((h) => t < h + 0.07);
            e.hero(x, FY, t > 0.28 && t < 0.58 ? 'attack' : 'idle', sub >= 0 ? win(t, hits[sub] - 0.06, hits[sub] + 0.04) : 0);
            const shapes = [[12, -14, -10, 10], [12, 10, -10, -12], [16, -2, -14, -2]]; // 斬り下ろし（右上→左下）・斬り上げ（右下→左上）・横斬り（右→左）
            hits.forEach((h, i) => {
                const k = win(t, h - 0.02, h + 0.02), fade = 1 - win(t, h + 0.03, h + 0.1);
                if (k <= 0 || fade <= 0)
                    return;
                const [a, b, cc, d] = shapes[i];
                rampLine(e.c, TX + 6 + a, TY + b, lerp(TX + 6 + a, TX + 6 + cc, k), lerp(TY + b, TY + d, k), PAL.steel, i === 2 ? 4 : 3, fade);
                sparks(e.c, TX + 6, TY, win(t, h, h + 0.1), i === 2 ? 12 : 6, i === 2 ? 14 : 8, PAL.steel, 10 + i);
            });
        } },
    { id: 'slash-afterimage', name: '残像の踏み込み', note: '青い残像を3つ残して一気に間合いを詰め、小さく鋭い軌跡。速さを残像で見せる。', draw(e) {
            const t = e.t;
            e.bg();
            hitBoss(e, 0.36);
            const x = approach(t, 0.2, 0.28, 0.6, 0.74);
            if (t > 0.2 && t < 0.4)
                for (let i = 1; i <= 3; i++)
                    e.ghost(lerp(HX, 64, ease(win(t - i * 0.025, 0.2, 0.28))), FY, i === 1 ? '#8ad8ff' : '#3a8ad8', 0.7 - i * 0.18);
            if (t > 0.6 && t < 0.74)
                for (let i = 1; i <= 2; i++)
                    e.ghost(lerp(64, HX, ease(win(t - i * 0.03, 0.6, 0.74))), FY, '#3a8ad8', 0.4);
            e.hero(x, FY, t > 0.2 && t < 0.28 ? 'dash' : t > 0.28 && t < 0.46 ? 'attack' : t > 0.6 && t < 0.74 ? 'dash' : 'idle', win(t, 0.28, 0.44), { flip: !(t > 0.6 && t < 0.74) });
            const k = win(t, 0.3, 0.36), fade = 1 - win(t, 0.4, 0.5);
            if (k > 0 && fade > 0)
                band(e.c, x - 8, FY - 15, 7, 12, Math.PI + 1.6, lerp(Math.PI + 1.6, Math.PI - 1.4, ease(k)), PAL.ice, fade, 1.1);
            star(e.c, TX + 6, TY, R(3 * bump(t, 0.36, 0.44)));
        } },
    { id: 'slash-wave', name: '飛ぶ斬撃', note: 'その場で振り抜き、三日月の刃が飛んでいく。通ったあとに点の尾が残る。', draw(e) {
            const t = e.t;
            e.bg();
            const hitT = 0.52;
            hitBoss(e, hitT);
            heroMove(e, HX, FY, t, 0.18, 0.4);
            const k = win(t, 0.26, hitT);
            if (k > 0 && k < 1) {
                const x = lerp(HX - 12, TX + 10, easeIn(k));
                for (let i = 1; i < 6; i++)
                    rectD(e.c, x + i * 5, TY - 8 + i, 3, 16 - i * 2, PAL.steel[2], 0.5 - i * 0.08);
                band(e.c, x + 10, TY, 9, 14, Math.PI - 1.2, Math.PI + 1.2, PAL.steel, 1, 1.4, false);
            }
            sparks(e.c, TX + 8, TY, win(t, hitT, hitT + 0.12), 10, 14, PAL.steel, 6);
            star(e.c, TX + 8, TY, R(4 * bump(t, hitT, hitT + 0.1)));
        } },
    { id: 'slash-heavy', name: '溜めの大振り', note: '刃先がキラッと光る溜め → ほぼ一周する大きな軌跡。当たった瞬間に時間が止まり、破片が落ちる。', draw(e) {
            const t0 = e.t, t = stop(t0, 0.48, 0.07);
            e.shake(t0 >= 0.48 && t0 < 0.6 ? 2 : 0);
            e.bg();
            hitBoss(e, 0.48, 0.12, 5);
            const x = approach(t, 0.3, 0.4, 0.66, 0.82, 62);
            e.hero(x, FY, t < 0.4 ? 'guard' : t < 0.6 ? 'attack' : 'idle', t < 0.4 ? win(t, 0.05, 0.3) : win(t, 0.4, 0.58));
            if (t < 0.32)
                star(e.c, x - 8, FY - 22, [1, 2, 3, 2][Math.floor(t0 * 40) % 4], '#ffffff', '#ffe27a');
            const k = win(t, 0.42, 0.5), fade = 1 - win(t, 0.54, 0.66);
            if (k > 0 && fade > 0)
                band(e.c, x - 6, FY - 16, 12, 22, Math.PI + 2.8, lerp(Math.PI + 2.8, Math.PI - 2.6, ease(k)), PAL.gold, fade);
            if (t0 >= 0.48) {
                flash(e.c, bump(t0, 0.48, 0.52) * 0.5);
                debris(e.c, TX + 6, TY, win(t0, 0.5, 0.85), 14, 30, PAL.gold, 8);
            }
        } },
];
// ================================================================ 2. 突く（槍・傘）
const THRUST = [
    { id: 'thrust-lunge', name: '一突き', note: '低く踏み込んでまっすぐ突く。穂先の前に流れる点の線と、小さな輪の火花。', draw(e) {
            const t = e.t;
            e.bg();
            hitBoss(e, 0.4);
            const x = approach(t, 0.18, 0.36, 0.6, 0.76, 66);
            heroMove(e, x, FY, t, 0.3, 0.55);
            const k = bump(t, 0.32, 0.46);
            if (k > 0)
                for (let i = 0; i < 5; i++)
                    line(e.c, x - 12 - i * 6, FY - 14 + (i % 3) - 1, x - 18 - i * 6 - 6 * k, FY - 14 + (i % 3) - 1, i % 2 ? PAL.steel[1] : '#ffffff', 1, k);
            ringK(e.c, TX + 10, TY + 2, R(6 * win(t, 0.4, 0.5)), PAL.steel[1], 1, 1 - win(t, 0.44, 0.52), 1.4);
            star(e.c, TX + 10, TY + 2, R(3 * bump(t, 0.4, 0.48)));
        } },
    { id: 'thrust-triple', name: '三段突き', note: '上・中・下へ3回突く。穂先がひし形にキラッと光る。', draw(e) {
            const t = e.t;
            e.bg();
            const hs = [0.34, 0.41, 0.48];
            const last = hs.filter((h) => t >= h).pop();
            e.boss({ hit: last !== undefined && t - last < 0.04 });
            const x = approach(t, 0.1, 0.28, 0.6, 0.76, 64);
            const i = hs.findIndex((h) => t < h + 0.05);
            e.hero(x, FY, t > 0.28 && t < 0.56 ? 'attack' : 'idle', i >= 0 ? win(t, hs[i] - 0.05, hs[i] + 0.03) : 0);
            hs.forEach((h, j) => {
                const k = bump(t, h - 0.02, h + 0.06);
                if (k <= 0)
                    return;
                const y = TY - 8 + j * 8;
                rampLine(e.c, x - 10, y, TX + 10, y, PAL.steel.slice(1), 2, k);
                const s = R(4 * k);
                line(e.c, TX + 10 - s, y, TX + 10, y - s, '#fff');
                line(e.c, TX + 10, y - s, TX + 10 + s, y, '#fff');
                line(e.c, TX + 10 + s, y, TX + 10, y + s, '#fff');
                line(e.c, TX + 10, y + s, TX + 10 - s, y, '#fff');
            });
        } },
    { id: 'thrust-dive', name: '跳び突き', note: '高く跳んで、斜め上から突き下ろす。地面に輪が広がり、砂ぼこり。', draw(e) {
            const t = e.t;
            e.shake(bump(e.t, 0.5, 0.58) * 2);
            e.bg();
            hitBoss(e, 0.5, 0.1, 2);
            let x = HX, y = FY;
            if (t > 0.15 && t < 0.5) {
                const k = win(t, 0.15, 0.5);
                x = R(lerp(HX, 58, k));
                y = R(FY - Math.sin(Math.min(1, k * 1.4) * Math.PI * 0.9) * 50 * (1 - easeIn(win(k, 0.7, 1))));
            }
            else if (t >= 0.5 && t < 0.68)
                x = 58;
            else if (t >= 0.68)
                x = R(lerp(58, HX, ease(win(t, 0.68, 0.85))));
            e.hero(x, y, t > 0.35 && t < 0.6 ? 'attack' : t > 0.15 && t < 0.35 ? 'victory' : 'idle', win(t, 0.35, 0.6));
            if (t > 0.38 && t < 0.5)
                for (let i = 1; i < 4; i++)
                    e.ghost(x + i * 3, y - i * 6, '#8ad8ff', 0.5 - i * 0.12, 'attack', 0.5);
            ringK(e.c, 50, FY - 1, R(4 + 22 * win(t, 0.5, 0.64)), PAL.steel[1], 1, 1 - win(t, 0.55, 0.66), 0.25);
            dust(e.c, 52, win(t, 0.5, 0.75), 1.2);
            sparks(e.c, TX + 8, TY + 6, win(t, 0.5, 0.6), 8, 12, PAL.steel, 4, Math.PI, -Math.PI / 2);
        } },
    { id: 'thrust-sweep', name: '薙ぎ払い', note: '長い柄で横に大きく払う。平たい楕円の軌跡が足元をなでる。', draw(e) {
            const t = e.t;
            e.bg();
            hitBoss(e, 0.42);
            const x = approach(t, 0.12, 0.3, 0.6, 0.76, 66);
            heroMove(e, x, FY, t, 0.3, 0.55);
            const k = win(t, 0.34, 0.44), fade = 1 - win(t, 0.48, 0.6);
            if (k > 0 && fade > 0)
                band(e.c, x - 10, FY - 10, 14, 24, -0.4, lerp(-0.4, Math.PI + 0.5, ease(k)), PAL.steel, fade, 0.35);
            debris(e.c, TX + 8, FY - 2, win(t, 0.42, 0.7), 10, 20, PAL.dust, 3, 0.6);
        } },
    { id: 'thrust-charge', name: '突進', note: '槍を構えたまま走りこむ。前に風の三角、うしろに速度の線。', draw(e) {
            const t = e.t;
            e.bg();
            hitBoss(e, 0.44, 0.1, 5);
            const x = approach(t, 0.18, 0.44, 0.6, 0.78, 60);
            e.hero(x, FY, t > 0.18 && t < 0.44 ? 'dash' : t < 0.58 && t >= 0.44 ? 'attack' : 'idle', 0.5, { flip: !(t > 0.6 && t < 0.78) });
            const k = win(t, 0.18, 0.44);
            if (k > 0 && k < 1) {
                for (let i = 0; i < 6; i++) {
                    const L = 4 + i * 2;
                    line(e.c, x - 14 - i, FY - 14 - L / 2, x - 18 - i * 2, FY - 14, PAL.steel[1 + (i % 2)]);
                    line(e.c, x - 14 - i, FY - 14 + L / 2, x - 18 - i * 2, FY - 14, PAL.steel[1 + (i % 2)]);
                }
                for (let i = 0; i < 7; i++)
                    line(e.c, x + 8 + ((i * 7 + e.f * 3) % 20), FY - 26 + i * 3, x + 18 + ((i * 7 + e.f * 3) % 20), FY - 26 + i * 3, '#6a6a9a');
            }
            sparks(e.c, TX + 8, TY + 4, win(t, 0.44, 0.56), 12, 16, PAL.steel, 5);
        } },
    { id: 'thrust-throw', name: '投げ槍', note: '振りかぶって投げる。槍は点の尾を引いて飛び、刺さってぶるっと震える。', draw(e) {
            const t = e.t;
            e.bg();
            const hitT = 0.46;
            hitBoss(e, hitT);
            e.hero(HX, FY, t > 0.12 && t < 0.4 ? 'attack' : 'idle', win(t, 0.12, 0.4));
            const k = win(t, 0.28, hitT);
            if (k > 0 && k < 1) {
                const x = lerp(HX - 10, TX + 12, k), y = TY - 4 - Math.sin(k * Math.PI) * 8;
                for (let i = 1; i < 6; i++)
                    P(e.c, x + i * 4, y + i * 0.3, PAL.steel[Math.min(3, i)]);
                line(e.c, x, y, x + 16, y, '#c8a070', 1);
                P(e.c, x - 3, y - 1, '#ffffff', 3, 3);
            }
            if (t >= hitT && t < 0.8) {
                const wob = R(Math.sin(e.f * 1.7) * (1 - win(t, hitT, 0.6)) * 2);
                line(e.c, TX + 12, TY - 4, TX + 28, TY - 4 + wob, '#c8a070');
            }
            sparks(e.c, TX + 12, TY - 4, win(t, hitT, hitT + 0.12), 8, 10, PAL.steel, 9);
        } },
];
// ================================================================ 3. 叩く（斧・ハンマー・フライパン・盾・ギター）
const BLUNT = [
    { id: 'blunt-overhead', name: '振り下ろし', note: '上から縦に振り下ろす。当たった所に8方向の星がはじける。', draw(e) {
            const t0 = e.t, t = stop(t0, 0.42, 0.05);
            e.bg();
            hitBoss(e, 0.42, 0.1, 2);
            const x = approach(t, 0.1, 0.3, 0.6, 0.78, 62);
            heroMove(e, x, FY, t, 0.3, 0.55);
            const k = win(t, 0.34, 0.42), fade = 1 - win(t, 0.46, 0.56);
            if (k > 0 && fade > 0)
                band(e.c, x - 4, FY - 14, 10, 16, Math.PI + 1.6, lerp(Math.PI + 1.6, Math.PI - 0.6, ease(k)), PAL.gold, fade, 1.2);
            const s = bump(t0, 0.42, 0.56);
            if (s > 0)
                for (let i = 0; i < 8; i++) {
                    const a = (i / 8) * TAU, L = (i % 2 ? 5 : 9) * s;
                    line(e.c, TX + 6, TY + 6, TX + 6 + Math.cos(a) * L, TY + 6 + Math.sin(a) * L, i % 2 ? PAL.gold[2] : '#ffffff', i % 2 ? 1 : 2);
                }
        } },
    { id: 'blunt-quake', name: '地割れ', note: '地面を叩き、ジグザグのひびがボスへ走る。ひびから石が跳ね上がる。', draw(e) {
            const t = e.t;
            e.shake(bump(t, 0.36, 0.5) * 2);
            e.bg();
            hitBoss(e, 0.5, 0.08, 1);
            e.hero(HX - 20, FY, t > 0.18 && t < 0.4 ? 'attack' : 'idle', win(t, 0.18, 0.4));
            const k = win(t, 0.34, 0.5), fade = 1 - win(t, 0.62, 0.8);
            if (k > 0 && fade > 0) {
                const r = rng(4);
                let x = HX - 34, y = FY - 2;
                const end = lerp(HX - 34, TX + 6, k);
                while (x > end) {
                    const nx = x - 4 - r() * 4, ny = FY - 3 + r() * 4;
                    line(e.c, x, y, nx, ny, '#05030c', 2, fade);
                    line(e.c, x, y - 1, nx, ny - 1, PAL.fire[2], 1, fade);
                    x = nx;
                    y = ny;
                }
            }
            for (let i = 0; i < 5; i++) {
                const at = 0.38 + i * 0.03;
                debris(e.c, HX - 40 - i * 14, FY - 2, win(t, at, at + 0.3), 3, 22, ['#a8987a', '#7a6a52', '#4a3a2a'], 20 + i, 0.4, 90);
            }
            dust(e.c, HX - 34, win(t, 0.34, 0.6), 1);
        } },
    { id: 'blunt-spin', name: '回転', note: 'くるくる回りながら近づく。体のまわりを円の帯がまわる（向きを左右に切り替えて回転を見せる）。', draw(e) {
            const t = e.t;
            e.bg();
            const hs = [0.38, 0.46, 0.54];
            const last = hs.filter((h) => t >= h).pop();
            e.boss({ hit: last !== undefined && t - last < 0.04, dx: last !== undefined && t - last < 0.05 ? -2 : 0 });
            const x = approach(t, 0.15, 0.38, 0.6, 0.78, 64);
            const spin = t > 0.15 && t < 0.6;
            e.hero(x, FY, spin ? 'attack' : 'idle', 0.5, { flip: spin ? Math.floor(e.f / 3) % 2 === 0 : true });
            if (spin) {
                const a = e.f * 0.9;
                band(e.c, x, FY - 14, 12, 16, a, a + 2.4, PAL.gold, 0.9, 0.6);
            }
            hs.forEach((h, i) => star(e.c, TX + 8, TY - 4 + i * 6, R(3 * bump(t, h, h + 0.06))));
        } },
    { id: 'blunt-leap', name: '跳び叩き', note: '大きく跳んで、落ちる勢いで叩きつける。画面がゆれ、地面に大きな輪。', draw(e) {
            const t = e.t;
            e.shake(bump(t, 0.5, 0.62) * 3);
            e.bg();
            hitBoss(e, 0.5, 0.12, 0);
            let x = HX, y = FY;
            if (t > 0.12 && t < 0.5) {
                const k = win(t, 0.12, 0.5);
                x = R(lerp(HX, 60, k));
                y = R(FY - Math.sin(k * Math.PI) * 54 * (k < 0.5 ? 1 : 1));
                if (k > 0.5)
                    y = R(lerp(FY - 54 * Math.sin(0.5 * Math.PI), FY, easeIn((k - 0.5) * 2)));
            }
            else if (t >= 0.5 && t < 0.7)
                x = 60;
            else if (t >= 0.7)
                x = R(lerp(60, HX, ease(win(t, 0.7, 0.86))));
            e.hero(x, y, t > 0.3 && t < 0.6 ? 'attack' : t > 0.12 && t < 0.3 ? 'victory' : 'idle', win(t, 0.3, 0.6));
            if (t > 0.38 && t < 0.5)
                for (let i = 1; i < 5; i++)
                    line(e.c, x - 6 + i * 3, y - 30 - i * 3, x - 6 + i * 3, y - 40 - i * 4, '#9aa0c8');
            const k = win(t, 0.5, 0.66);
            ringK(e.c, 50, FY - 1, R(6 + 34 * k), PAL.gold[2], 2, 1 - k, 0.22);
            ringK(e.c, 50, FY - 1, R(3 + 20 * k), '#ffffff', 1, 1 - k, 0.22);
            flash(e.c, bump(t, 0.5, 0.54) * 0.4);
            dust(e.c, 50, win(t, 0.5, 0.8), 1.6);
        } },
    { id: 'blunt-upper', name: 'かち上げ', note: '下から上へすくい上げる。火花が上に飛び、ボスが少し浮く。', draw(e) {
            const t = e.t;
            e.bg();
            const k0 = t - 0.42;
            e.boss({ hit: k0 >= 0 && k0 < 0.08, dy: k0 >= 0 && k0 < 0.25 ? -R(Math.sin((k0 / 0.25) * Math.PI) * 6) : 0 });
            const x = approach(t, 0.1, 0.3, 0.62, 0.8, 62);
            heroMove(e, x, FY, t, 0.3, 0.56);
            const k = win(t, 0.36, 0.44), fade = 1 - win(t, 0.48, 0.58);
            if (k > 0 && fade > 0)
                band(e.c, x - 6, FY - 12, 9, 15, Math.PI - 1.4, lerp(Math.PI - 1.4, Math.PI + 1.8, ease(k)), PAL.gold, fade, 1.3);
            sparks(e.c, TX + 6, TY + 4, win(t, 0.42, 0.56), 9, 18, PAL.gold, 6, 1.6, -Math.PI / 2);
        } },
    { id: 'blunt-homerun', name: '全力スイング', note: 'うしろへ大きく引いてから横に振り抜く。当たった1コマだけ白黒に反転して、重さを出す。', draw(e) {
            const t0 = e.t, t = stop(t0, 0.46, 0.06);
            const inv = t0 >= 0.46 && t0 < 0.49;
            e.shake(t0 >= 0.46 && t0 < 0.58 ? 2 : 0);
            e.bg(inv ? 0 : 0);
            const kb = t - 0.46;
            e.boss({ hit: kb >= 0 && kb < 0.1, dx: kb >= 0 ? -R(8 * Math.sin(Math.min(1, kb / 0.2) * Math.PI)) : 0 });
            const x = approach(t, 0.08, 0.24, 0.66, 0.82, 60);
            e.hero(x + (t > 0.24 && t < 0.4 ? 3 : 0), FY, t > 0.24 && t < 0.4 ? 'guard' : t >= 0.4 && t < 0.62 ? 'attack' : 'idle', t < 0.4 ? win(t, 0.24, 0.38) : win(t, 0.4, 0.6));
            const k = win(t, 0.4, 0.47), fade = 1 - win(t, 0.5, 0.62);
            if (k > 0 && fade > 0)
                band(e.c, x - 4, FY - 13, 14, 22, 0.6, lerp(0.6, -2.6, ease(k)), PAL.fire, fade, 0.7);
            if (inv && !REDUCED) {
                e.c.globalCompositeOperation = 'difference';
                P(e.c, -8, -8, '#ffffff', W + 16, H + 16);
                e.c.globalCompositeOperation = 'source-over';
            }
            debris(e.c, TX + 6, TY, win(t0, 0.5, 0.85), 16, 34, PAL.fire, 12, 0.8);
        } },
];
// ================================================================ 4. 撃つ（弓・光線銃）
const SHOOT = [
    { id: 'shot-single', name: '一矢', note: 'ためて1本。矢（弾）ははっきりした点の形で、当たった所に十字の火花。', draw(e) {
            const t = e.t;
            e.bg();
            const hitT = 0.44;
            hitBoss(e, hitT);
            e.hero(HX, FY, t > 0.1 && t < 0.4 ? 'cast' : 'idle', win(t, 0.1, 0.4));
            const k = win(t, 0.3, hitT);
            if (k > 0 && k < 1) {
                const x = R(lerp(HX - 12, TX + 10, k));
                line(e.c, x, TY, x + 10, TY, '#c8a070');
                P(e.c, x - 2, TY - 1, '#ffffff', 2, 3);
                P(e.c, x + 9, TY - 2, '#e43b44', 2, 1);
                P(e.c, x + 9, TY + 2, '#e43b44', 2, 1);
                for (let i = 1; i < 4; i++)
                    P(e.c, x + 10 + i * 4, TY, PAL.steel[i]);
            }
            star(e.c, TX + 10, TY, R(4 * bump(t, hitT, hitT + 0.1)));
            sparks(e.c, TX + 10, TY, win(t, hitT, hitT + 0.12), 6, 8, PAL.steel, 3);
        } },
    { id: 'shot-burst', name: '三連射', note: '素早く3発。弾は少しずつ高さをずらし、着弾ごとに小さくはじける。', draw(e) {
            const t = e.t;
            e.bg();
            const hs = [0.4, 0.46, 0.52];
            const last = hs.filter((h) => t >= h).pop();
            e.boss({ hit: last !== undefined && t - last < 0.03 });
            e.hero(HX, FY, t > 0.2 && t < 0.52 ? 'cast' : 'idle', 0.5);
            hs.forEach((h, i) => {
                const k = win(t, h - 0.12, h);
                const y = TY - 4 + i * 4;
                if (k > 0 && k < 1) {
                    const x = R(lerp(HX - 12, TX + 10, k));
                    P(e.c, x, y - 1, '#ffffff', 3, 3);
                    P(e.c, x + 3, y, PAL.bolt[2], 4, 1);
                    P(e.c, x + 7, y, PAL.bolt[3], 3, 1);
                }
                sparks(e.c, TX + 10, y, win(t, h, h + 0.08), 5, 7, PAL.bolt, 4 + i);
            });
        } },
    { id: 'shot-rain', name: '曲射の雨', note: '空へ向けて放つと、少しおいて小さな矢がボスに降りそそぐ。', draw(e) {
            const t = e.t;
            e.bg();
            e.boss({ hit: t > 0.5 && t < 0.72 && e.f % 6 < 3 });
            e.hero(HX, FY, t > 0.1 && t < 0.34 ? 'cast' : 'idle', 0.6);
            const up = win(t, 0.2, 0.34);
            if (up > 0 && up < 1) {
                const y = R(lerp(FY - 30, -6, up));
                line(e.c, HX - 6, y, HX - 6, y + 8, '#c8a070');
                P(e.c, HX - 7, y - 2, '#ffffff', 3, 2);
            }
            const r = rng(11);
            for (let i = 0; i < 14; i++) {
                const at = 0.42 + r() * 0.24, k = win(t, at, at + 0.1), x = 18 + r() * 44;
                if (k > 0 && k < 1) {
                    const y = R(lerp(-10, TY + 4 + r() * 16, k));
                    line(e.c, x + 3, y - 6, x, y, '#c8a070');
                    P(e.c, x - 1, y, '#ffffff', 2, 2);
                }
                if (k >= 1 && t < at + 0.16)
                    star(e.c, x, TY + 6, 1, PAL.steel[1]);
            }
        } },
    { id: 'shot-charge', name: '溜め撃ち', note: '銃口（矢じり）に光の玉が育ち、太い光線を放つ。光線は5段の帯で、ちらつきは2色の入れ替え。', draw(e) {
            const t = e.t;
            e.shake(t > 0.42 && t < 0.62 ? 1 : 0);
            e.bg();
            e.boss({ hit: t > 0.44 && t < 0.62 && e.f % 4 < 2, dx: t > 0.44 && t < 0.62 ? -2 : 0 });
            e.hero(HX, FY, t > 0.08 && t < 0.66 ? 'cast' : 'idle', 0.5);
            const g = win(t, 0.1, 0.4), mx = HX - 14, my = FY - 16;
            if (t < 0.44 && g > 0) {
                orb(e.c, mx, my, 1 + 5 * g, PAL.arc);
                const r = rng(e.f);
                for (let i = 0; i < 6; i++) {
                    const a = r() * TAU, d = 14 * (1 - ((e.f * 0.05 + i / 6) % 1));
                    P(e.c, mx + Math.cos(a) * d, my + Math.sin(a) * d, PAL.arc[1]);
                }
            }
            const b = bump(t, 0.4, 0.66);
            if (b > 0) {
                const th = R(2 + 6 * b), cols = e.f % 4 < 2 ? PAL.arc : [...PAL.arc.slice(0, 2), PAL.arc[3], PAL.arc[2], PAL.arc[4]];
                for (let i = cols.length - 1; i >= 0; i--) {
                    const h = Math.max(1, R((th * (i + 1)) / cols.length));
                    P(e.c, TX + 6, my - Math.floor(h / 2), cols[i], mx - TX - 6, h);
                }
                orb(e.c, mx, my, 3 + th / 2, PAL.arc);
                orb(e.c, TX + 8, my, 2 + th / 2, PAL.arc);
            }
        } },
    { id: 'shot-pierce', name: '貫通弾', note: '速い弾がボスを突き抜け、反対側から火花が抜ける。弾のうしろに長い点の尾。', draw(e) {
            const t = e.t;
            e.bg();
            const hitT = 0.4;
            hitBoss(e, hitT, 0.06, 2);
            e.hero(HX, FY, t > 0.12 && t < 0.42 ? 'cast' : 'idle', 0.5);
            const k = win(t, 0.32, 0.48);
            if (k > 0 && k < 1) {
                const x = R(lerp(HX - 12, -10, k));
                for (let i = 0; i < 20; i++)
                    rectD(e.c, x + 3 + i * 2, TY, 2, 1, PAL.bolt[Math.min(3, i >> 2)], 1 - i / 20);
                P(e.c, x, TY - 1, '#ffffff', 4, 3);
            }
            sparks(e.c, TX + 8, TY, win(t, hitT, hitT + 0.1), 5, 8, PAL.bolt, 2, 1.2, 0);
            sparks(e.c, 6, TY, win(t, hitT + 0.02, hitT + 0.14), 8, 12, PAL.bolt, 3, 1.4, Math.PI);
        } },
    { id: 'shot-spread', name: '拡散', note: '扇形に5発。広がる弾がボスの上下に散って当たる。', draw(e) {
            const t = e.t;
            e.bg();
            hitBoss(e, 0.46, 0.08, 2);
            e.hero(HX, FY, t > 0.16 && t < 0.46 ? 'cast' : 'idle', 0.5);
            const k = win(t, 0.32, 0.46);
            for (let i = 0; i < 5; i++) {
                const ang = Math.PI + (i - 2) * 0.16, L = (HX - 14 - TX - 10);
                if (k > 0 && k < 1) {
                    const x = HX - 14 + Math.cos(ang) * L * k, y = FY - 16 + Math.sin(ang) * L * k;
                    orb(e.c, x, y, 2, PAL.fire.slice(0, 4));
                }
                const ex = HX - 14 + Math.cos(ang) * L, ey = FY - 16 + Math.sin(ang) * L;
                star(e.c, ex, ey, R(3 * bump(t, 0.46, 0.56)), PAL.fire[1]);
            }
            if (t > 0.3 && t < 0.36)
                disc(e.c, HX - 14, FY - 16, 4, PAL.fire[1]);
        } },
];
// ================================================================ 5. 魔法（杖・魔導書・扇）
const MAGIC = [
    { id: 'magic-fireball', name: '火球', note: '炎の玉が火の粉を落としながら飛ぶ。着弾すると、5色の段の爆発が広がって消える。', draw(e) {
            const t = e.t;
            e.bg();
            const hitT = 0.46;
            hitBoss(e, hitT, 0.1, 3);
            e.hero(HX, FY, t > 0.08 && t < 0.44 ? 'cast' : 'idle', win(t, 0.08, 0.44));
            const k = win(t, 0.28, hitT);
            if (k > 0 && k < 1) {
                const x = lerp(HX - 12, TX + 8, k), y = TY - 2 - Math.sin(k * Math.PI) * 6;
                for (let i = 1; i < 6; i++)
                    P(e.c, x + i * 3, y + ((e.f + i) % 3) - 1, PAL.fire[Math.min(4, i)]);
                orb(e.c, x, y, 4, PAL.fire);
            }
            const b = win(t, hitT, hitT + 0.2);
            if (b > 0 && b < 1) {
                const r = 4 + 12 * ease(b);
                for (let i = 0; i < 5; i++)
                    disc(e.c, TX + 8, TY - 2, r * (1 - i * 0.18), PAL.fire[Math.min(4, i + R(b * 2))], 1 - b * 0.7);
                debris(e.c, TX + 8, TY - 2, b, 10, 22, PAL.fire, 3);
            }
        } },
    { id: 'magic-thunder', name: '落雷', note: '杖を掲げると、空からギザギザの稲妻が落ちる。一瞬だけ画面が光り、足元が焦げる。', draw(e) {
            const t = e.t;
            e.shake(bump(t, 0.44, 0.52) * 2);
            e.bg(bump(t, 0.3, 0.44) * 0.4);
            const hitT = 0.44;
            hitBoss(e, hitT, 0.12, 1);
            e.hero(HX, FY, t > 0.1 && t < 0.56 ? 'cast' : 'idle', 0.5);
            if (t > 0.1 && t < 0.44)
                star(e.c, HX - 4, FY - 34, [1, 2, 3, 2][Math.floor(e.f / 2) % 4], PAL.bolt[1]);
            const b = bump(t, hitT - 0.01, hitT + 0.1);
            if (b > 0) {
                const r = rng(Math.floor(e.f / 2));
                let x = TX + 6, y = -4;
                while (y < TY + 10) {
                    const nx = x + (r() - 0.5) * 12, ny = y + 6 + r() * 6;
                    rampLine(e.c, x, y, nx, ny, PAL.bolt, 3);
                    if (r() < 0.25)
                        line(e.c, nx, ny, nx + (r() - 0.5) * 16, ny + 8, PAL.bolt[2]);
                    x = nx;
                    y = ny;
                }
            }
            flash(e.c, bump(t, hitT, hitT + 0.04) * 0.6, PAL.bolt[1]);
            if (t > hitT)
                rectD(e.c, TX - 8, FY - 2, 28, 3, '#05030c', 1 - win(t, hitT + 0.1, 0.9));
            sparks(e.c, TX + 6, TY + 10, win(t, hitT, hitT + 0.14), 10, 14, PAL.bolt, 5, Math.PI, -Math.PI / 2);
        } },
    { id: 'magic-ice', name: '氷柱', note: 'ボスの頭上に氷の柱が3本あらわれ、順に突き刺さる。最後に砕けて氷の粒が散る。', draw(e) {
            const t = e.t;
            e.bg();
            const hs = [0.4, 0.46, 0.52];
            const last = hs.filter((h) => t >= h).pop();
            e.boss({ hit: last !== undefined && t - last < 0.04, tint: '#8ad8ff', tintA: win(t, 0.4, 0.6) * (1 - win(t, 0.7, 0.8)) * 0.4 });
            e.hero(HX, FY, t > 0.1 && t < 0.56 ? 'cast' : 'idle', 0.5);
            hs.forEach((h, i) => {
                const x = TX - 6 + i * 10, show = win(t, 0.18 + i * 0.04, 0.26 + i * 0.04), k = win(t, h - 0.06, h);
                if (t < 0.66 && show > 0) {
                    const y = R(lerp(2, TY - 8 + i * 3, easeIn(k)));
                    for (let j = 0; j < 12; j++) {
                        const w = Math.max(1, R(4 * (1 - j / 12)));
                        P(e.c, x - Math.floor(w / 2), y + j, PAL.ice[j < 2 ? 0 : j < 6 ? 1 : 2], w, 1);
                    }
                    P(e.c, x - 2, y - 2, PAL.ice[3], 5, 2);
                }
                debris(e.c, x, TY, win(t, 0.66, 0.9), 6, 18, PAL.ice, 30 + i);
            });
        } },
    { id: 'magic-circle', name: '魔法陣の光弾', note: '足元に魔法陣が描かれ、3つの光の弾がまわりこみながらボスへ飛ぶ。', draw(e) {
            const t = e.t;
            e.bg();
            const hits = [0.46, 0.5, 0.54];
            const last = hits.filter((h) => t >= h).pop();
            e.boss({ hit: last !== undefined && t - last < 0.03 });
            e.hero(HX, FY, t > 0.08 && t < 0.56 ? 'cast' : 'idle', 0.5);
            const c = win(t, 0.08, 0.24) * (1 - win(t, 0.6, 0.7));
            if (c > 0) {
                ring(e.c, HX, FY - 1, 16, PAL.arc[2], 1, c, 0.3);
                ring(e.c, HX, FY - 1, 11, PAL.arc[3], 1, c, 0.3);
                for (let i = 0; i < 6; i++) {
                    const a = e.f * 0.05 + (i / 6) * TAU;
                    P(e.c, HX + Math.cos(a) * 13.5, FY - 1 + Math.sin(a) * 4, PAL.arc[1]);
                }
            }
            hits.forEach((h, i) => {
                const k = win(t, 0.26 + i * 0.04, h);
                if (k > 0 && k < 1) {
                    const x = lerp(HX - 4, TX + 8, k), y = lerp(FY - 30, TY, k) - Math.sin(k * Math.PI) * (12 + i * 8) * (i % 2 ? -1 : 1);
                    orb(e.c, x, y, 3, PAL.arc);
                    P(e.c, x + 4, y, PAL.arc[2]);
                    P(e.c, x + 7, y, PAL.arc[3]);
                }
                ringK(e.c, TX + 8, TY, R(2 + 8 * win(t, h, h + 0.08)), PAL.arc[1], 1, 1 - win(t, h, h + 0.08));
            });
        } },
    { id: 'magic-wind', name: '風の刃', note: '扇をあおぐと、小さな三日月の風が3つ連なって飛ぶ。木の葉が混じる。', draw(e) {
            const t = e.t;
            e.bg();
            hitBoss(e, 0.5, 0.1, 3);
            e.hero(HX, FY, t > 0.14 && t < 0.44 ? 'attack' : 'idle', win(t, 0.14, 0.44));
            for (let i = 0; i < 3; i++) {
                const k = win(t, 0.3 + i * 0.03, 0.5 + i * 0.03);
                if (k > 0 && k < 1) {
                    const x = lerp(HX - 14, TX + 6, k), y = TY - 6 + i * 6 + Math.sin(k * 8 + i) * 2;
                    band(e.c, x + 6, y, 4, 7, Math.PI - 1, Math.PI + 1, PAL.leaf, 1, 1.2, false);
                }
            }
            const r = rng(14);
            for (let i = 0; i < 6; i++) {
                const k = win(t, 0.3 + r() * 0.1, 0.62 + r() * 0.1);
                if (k <= 0 || k >= 1)
                    continue;
                const x = lerp(HX - 10, TX, k), y = TY - 10 + r() * 20 + Math.sin(k * 10) * 3;
                P(e.c, x, y, PAL.leaf[1 + (i % 2)], 2, 1);
                P(e.c, x + 1, y + 1, PAL.leaf[3]);
            }
        } },
    { id: 'magic-stars', name: '星屑', note: '頭上から十字の星がきらめきながら降る。当たるたびに小さく瞬く。', draw(e) {
            const t = e.t;
            e.bg(0.25);
            e.boss({ hit: t > 0.42 && t < 0.66 && e.f % 6 < 2 });
            e.hero(HX, FY, t > 0.08 && t < 0.6 ? 'cast' : 'idle', 0.5);
            const r = rng(21);
            for (let i = 0; i < 16; i++) {
                const at = 0.24 + r() * 0.34, k = win(t, at, at + 0.14), x0 = 14 + r() * 50;
                if (k > 0 && k < 1) {
                    const x = x0 + (1 - k) * 18, y = lerp(-6, TY - 12 + r() * 30, k);
                    star(e.c, x, y, k > 0.8 ? 1 : 2, i % 3 ? PAL.holy[2] : '#ffffff', '#ffffff');
                    P(e.c, x + 3, y - 3, PAL.holy[3]);
                }
                if (k >= 1 && t < at + 0.2)
                    star(e.c, x0, TY - 12 + r() * 30, 3 * (1 - win(t, at + 0.14, at + 0.2)), PAL.holy[1]);
            }
        } },
];
// ================================================================ 6. ガード（ボスの攻撃を受け止める）
// ボスの攻撃: 紫の玉が冒険者へ飛んでくる（当たる時刻 0.4）
function incoming(e, hitT = 0.4, stopAt = HX - 10) {
    if (NO_ATTACK)
        return;
    const k = win(e.t, 0.18, hitT);
    if (k > 0 && k < 1) {
        const x = lerp(TX + 10, stopAt, k), y = lerp(TY, FY - 16, k);
        for (let i = 1; i < 5; i++)
            P(e.c, x - i * 3, y - i * 0.4, PAL.blood[Math.min(3, i)]);
        orb(e.c, x, y, 3, PAL.blood);
    }
}
const GUARD = [
    { id: 'guard-parry', name: 'はじく', note: '構えた所に当たり、玉が上へはね返る。金属っぽい白い火花。', draw(e) {
            const t = e.t;
            e.bg();
            e.boss({ pose: { mouth: t > 0.1 && t < 0.3 ? 1 : 0 } });
            incoming(e);
            e.hero(HX, FY, t > 0.26 && t < 0.6 ? 'guard' : 'idle', win(t, 0.26, 0.34));
            const k = win(t, 0.4, 0.62);
            if (k > 0 && k < 1) {
                const x = HX - 10 - k * 18, y = FY - 16 - k * 40 + k * k * 20;
                orb(e.c, x, y, 2, PAL.blood);
            }
            sparks(e.c, HX - 10, FY - 16, win(t, 0.4, 0.5), 8, 10, ['#ffffff', '#ffffff', PAL.steel[1], PAL.steel[2]], 3);
            star(e.c, HX - 10, FY - 16, R(4 * bump(t, 0.4, 0.48)));
        } },
    { id: 'guard-hex', name: '六角の障壁', note: '体の前に六角形の障壁が一瞬だけ張られ、当たった所から波紋が広がる。', draw(e) {
            const t = e.t;
            e.bg();
            e.boss();
            incoming(e, 0.4, HX - 16);
            e.hero(HX, FY, t > 0.28 && t < 0.6 ? 'guard' : 'idle', win(t, 0.28, 0.34));
            const a = bump(t, 0.3, 0.62);
            if (a > 0) {
                const cx = HX - 14, cy = FY - 14;
                const pts = Array.from({ length: 6 }, (_, i) => [cx + Math.cos(i * TAU / 6 + Math.PI / 6) * 7, cy + Math.sin(i * TAU / 6 + Math.PI / 6) * 14]);
                for (let i = 0; i < 6; i++)
                    line(e.c, pts[i][0], pts[i][1], pts[(i + 1) % 6][0], pts[(i + 1) % 6][1], PAL.ice[1], 1, a);
                rectD(e.c, cx - 6, cy - 11, 12, 22, PAL.ice[3], a * 0.35);
            }
            for (let i = 0; i < 2; i++)
                ringK(e.c, HX - 15, FY - 16, R(2 + 10 * win(t, 0.4 + i * 0.04, 0.54 + i * 0.04)), PAL.ice[1], 1, 1 - win(t, 0.4 + i * 0.04, 0.56 + i * 0.04), 1.6);
        } },
    { id: 'guard-slide', name: '受け流し', note: '受けた勢いでうしろへ滑る。足元に火花の筋と砂ぼこり。', draw(e) {
            const t = e.t;
            e.bg();
            e.boss();
            incoming(e);
            const x = t < 0.4 ? HX : t < 0.56 ? R(lerp(HX, HX + 10, ease(win(t, 0.4, 0.56)))) : R(lerp(HX + 10, HX, win(t, 0.7, 0.9)));
            e.hero(x, FY, t > 0.28 && t < 0.66 ? 'guard' : 'idle', win(t, 0.28, 0.34));
            if (t > 0.4 && t < 0.62)
                for (let i = 0; i < 3; i++)
                    line(e.c, HX - 4, FY - 1 - i, x - 4, FY - 1 - i, i ? PAL.fire[2] : '#ffffff', 1, 1 - win(t, 0.5, 0.62));
            dust(e.c, x + 4, win(t, 0.42, 0.66), 0.8);
            star(e.c, HX - 10, FY - 16, R(3 * bump(t, 0.4, 0.46)));
        } },
    { id: 'guard-cross', name: '武器で受ける', note: '武器を交差させて受ける。X字の火花と、ほんの少しの時間の止まり。', draw(e) {
            const t0 = e.t, t = stop(t0, 0.4, 0.05);
            e.bg();
            e.boss();
            incoming({ ...e, t });
            e.hero(HX, FY, t > 0.26 && t < 0.62 ? 'guard' : 'idle', win(t, 0.26, 0.32));
            const k = bump(t0, 0.4, 0.54);
            if (k > 0) {
                const s = R(8 * k);
                rampLine(e.c, HX - 10 - s, FY - 16 - s, HX - 10 + s, FY - 16 + s, ['#ffffff', PAL.gold[2]], 2);
                rampLine(e.c, HX - 10 - s, FY - 16 + s, HX - 10 + s, FY - 16 - s, ['#ffffff', PAL.gold[2]], 2);
            }
            sparks(e.c, HX - 10, FY - 16, win(t0, 0.42, 0.56), 6, 10, PAL.gold, 7);
        } },
    { id: 'guard-just', name: 'ジャストガード', note: 'ぴったりの瞬間に受けると、時間が止まって白い輪が広がり、頭の上に「！」。', draw(e) {
            const t0 = e.t, t = stop(t0, 0.4, 0.1);
            e.bg(t0 > 0.4 && t0 < 0.5 ? 0.5 : 0);
            e.boss();
            incoming({ ...e, t });
            e.hero(HX, FY, t > 0.34 && t < 0.6 ? 'guard' : 'idle', 1);
            const k = win(t0, 0.4, 0.56);
            ringK(e.c, HX - 10, FY - 16, R(4 + 30 * ease(k)), '#ffffff', 2, 1 - k);
            if (t0 > 0.4 && t0 < 0.7) {
                const y = FY - 44 - R(2 * bump(t0, 0.4, 0.5));
                P(e.c, HX - 1, y, '#ffe27a', 3, 7);
                P(e.c, HX - 1, y + 9, '#ffe27a', 3, 3);
                P(e.c, HX - 2, y - 1, '#5a2a00', 5, 1);
            }
            flash(e.c, bump(t0, 0.4, 0.44) * 0.4);
        } },
    { id: 'guard-brace', name: '踏ん張り', note: '重い一撃を腰を落として受け止める。左右に砂ぼこり、画面が小さくゆれる。', draw(e) {
            const t = e.t;
            e.shake(bump(t, 0.4, 0.5) * 2);
            e.bg();
            e.boss({ pose: { lean: t > 0.3 && t < 0.5 ? 3 : 0 } });
            const k = win(t, 0.24, 0.4);
            if (!NO_ATTACK && k > 0 && k < 1) {
                const x = lerp(TX + 14, HX - 10, easeIn(k));
                band(e.c, x, FY - 14, 6, 12, -1.2, 1.2, PAL.blood, 1, 1.4, false);
            }
            e.hero(HX, FY + (t > 0.4 && t < 0.56 ? 1 : 0), t > 0.2 && t < 0.62 ? 'guard' : 'idle', 1);
            dust(e.c, HX, win(t, 0.4, 0.66), 1.3);
            star(e.c, HX - 10, FY - 14, R(4 * bump(t, 0.4, 0.48)), PAL.blood[1]);
        } },
];
// ================================================================ 7. 回避
const slashAt = (e, at, y = FY - 14) => { if (NO_ATTACK)
    return; const k = win(e.t, at - 0.1, at + 0.06), fade = 1 - win(e.t, at + 0.04, at + 0.14); if (k > 0 && fade > 0)
    band(e.c, HX - 4, y, 10, 16, -2.6, lerp(-2.6, 0.8, ease(k)), PAL.blood, fade, 0.9); };
const EVADE = [
    { id: 'evade-back', name: 'バックステップ', note: 'うしろへ小さく跳んで、空を切らせる。着地で砂ぼこり。', draw(e) {
            const t = e.t;
            e.bg();
            e.boss({ pose: { lean: t > 0.3 && t < 0.45 ? 4 : 0 } });
            slashAt(e, 0.4);
            let x = HX, y = FY;
            if (t > 0.32 && t < 0.5) {
                const k = win(t, 0.32, 0.5);
                x = R(lerp(HX, HX + 18, k));
                y = R(FY - Math.sin(k * Math.PI) * 10);
            }
            else if (t >= 0.5 && t < 0.8)
                x = HX + 18;
            if (t >= 0.8)
                x = R(lerp(HX + 18, HX, win(t, 0.8, 0.95)));
            e.hero(x, y, t > 0.32 && t < 0.5 ? 'dash' : 'idle', 0.5);
            dust(e.c, HX + 18, win(t, 0.5, 0.7), 0.8);
        } },
    { id: 'evade-ghost', name: '残像よけ', note: '一瞬で横へずれ、元の場所に残像が残る。攻撃は残像だけを切る。', draw(e) {
            const t = e.t;
            e.bg();
            e.boss();
            slashAt(e, 0.42);
            const moved = t > 0.36 && t < 0.78;
            if (moved)
                e.ghost(HX, FY, '#8ad8ff', 0.6 * (1 - win(t, 0.42, 0.6)), 'idle');
            e.hero(moved ? HX + 16 : HX, FY, 'idle', 0);
            if (t > 0.36 && t < 0.4)
                for (let i = 0; i < 4; i++)
                    line(e.c, HX - 4, FY - 6 - i * 6, HX + 10, FY - 6 - i * 6, '#c8f0ff');
        } },
    { id: 'evade-duck', name: '伏せる', note: 'さっと身を低くして、頭の上を攻撃が通りすぎる。', draw(e) {
            const t = e.t;
            e.bg();
            e.boss();
            const k = win(e.t, 0.26, 0.5);
            if (!NO_ATTACK && k > 0 && k < 1) {
                const x = lerp(TX + 10, W + 10, k);
                for (let i = 0; i < 4; i++)
                    line(e.c, x - i * 6, FY - 26 + i, x - i * 6 - 8, FY - 26 + i, PAL.blood[i], 2);
                orb(e.c, x, FY - 26, 3, PAL.blood);
            }
            const low = t > 0.3 && t < 0.56;
            e.hero(HX, FY + (low ? 5 : 0), low ? 'guard' : 'idle', 1);
            if (low)
                P(e.c, HX - 10, FY + 1, '#1f1a2e', 20, 8);
        } },
    { id: 'evade-roll', name: '前転', note: '転がって相手の脇をくぐる。回転は90度ずつなのでドットが崩れない。', draw(e) {
            const t = e.t;
            e.bg();
            e.boss();
            slashAt(e, 0.4);
            const k = win(t, 0.3, 0.52);
            let x = HX;
            if (t > 0.3 && t < 0.52)
                x = R(lerp(HX, HX - 30, k));
            else if (t >= 0.52 && t < 0.72)
                x = HX - 30;
            else if (t >= 0.72)
                x = R(lerp(HX - 30, HX, ease(win(t, 0.72, 0.9))));
            e.hero(x, FY, 'idle', 0, k > 0 && k < 1 ? { rot: -Math.floor(k * 8) } : { flip: !(t > 0.72 && t < 0.9) });
            if (k > 0 && k < 1)
                dust(e.c, x + 8, (k * 3) % 1, 0.5, Math.floor(k * 3));
        } },
    { id: 'evade-log', name: '変わり身', note: 'ボフッと煙。元の場所には丸太が残り、本人は少しうしろにあらわれる。', draw(e) {
            const t = e.t;
            e.bg();
            e.boss();
            slashAt(e, 0.44);
            const swap = t > 0.36 && t < 0.82;
            if (swap && t < 0.7) {
                P(e.c, HX - 4, FY - 14, '#8a5a2a', 8, 14);
                P(e.c, HX - 4, FY - 14, '#c8905a', 8, 2);
                P(e.c, HX - 2, FY - 8, '#5a3a1a', 2, 2);
            }
            if (!swap || t > 0.4)
                e.hero(swap ? HX + 20 : HX, FY, 'idle', 0, { a: swap ? win(t, 0.4, 0.46) : 1 });
            for (const [cx, at] of [[HX, 0.36], [HX + 20, 0.4]]) {
                const k = win(t, at, at + 0.14);
                if (k > 0 && k < 1)
                    for (let i = 0; i < 6; i++) {
                        const a = (i / 6) * TAU;
                        disc(e.c, cx + Math.cos(a) * 6 * k, FY - 12 + Math.sin(a) * 5 * k, 4 * (1 - k) + 1, i % 2 ? '#d8d8e0' : '#9a9cb0', 1 - k * 0.5);
                    }
            }
        } },
    { id: 'evade-phase', name: 'すり抜け', note: '体が点滅して透け、攻撃がそのまま体を通りぬける。', draw(e) {
            const t = e.t;
            e.bg();
            e.boss();
            const k = win(e.t, 0.28, 0.52);
            if (!NO_ATTACK && k > 0 && k < 1) {
                const x = lerp(TX + 10, W + 10, k);
                band(e.c, x, FY - 14, 6, 12, Math.PI - 1.2, Math.PI + 1.2, PAL.blood, 1, 1.4, false);
            }
            const ph = t > 0.34 && t < 0.56;
            e.hero(HX, FY, 'idle', 0, ph ? { a: e.f % 4 < 2 ? 0.25 : 0.6, tint: e.f % 4 < 2 ? '#8ad8ff' : undefined } : {});
        } },
];
// ================================================================ 8. ジャンプ
const JUMP = [
    { id: 'jump-big', name: '大ジャンプ', note: '沈んでから高く跳ぶ。踏み切りと着地に砂ぼこり、空中では影が小さくなる。', draw(e) {
            const t = e.t;
            e.bg();
            e.boss();
            const k = win(t, 0.2, 0.7), y = R(FY - Math.sin(k * Math.PI) * 48);
            const sh = 1 - Math.sin(k * Math.PI) * 0.6;
            disc(e.c, HX, FY, 6 * sh, '#141020', 1, 0.3);
            e.hero(HX, k > 0 && k < 1 ? y : FY + (t > 0.12 && t < 0.2 ? 2 : 0), k > 0 && k < 1 ? 'victory' : t > 0.12 && t < 0.2 ? 'guard' : 'idle', 0.25);
            dust(e.c, HX, win(t, 0.2, 0.4), 0.7);
            dust(e.c, HX, win(t, 0.7, 0.9), 1, 9);
        } },
    { id: 'jump-double', name: '二段ジャンプ', note: '空中でもう一度跳ぶ。足元に平たい輪がぽんと出る。', draw(e) {
            const t = e.t;
            e.bg();
            e.boss();
            let y = FY;
            if (t > 0.15 && t < 0.4)
                y = R(FY - Math.sin(win(t, 0.15, 0.4) * Math.PI * 0.8) * 30);
            else if (t >= 0.4 && t < 0.75) {
                const k = win(t, 0.4, 0.75);
                const y0 = FY - Math.sin(0.8 * Math.PI) * 30;
                y = R(lerp(y0, FY, easeIn(k)) - Math.sin(k * Math.PI) * 30);
            }
            e.hero(HX, y, t > 0.15 && t < 0.75 ? 'victory' : 'idle', 0.25);
            const k = win(t, 0.4, 0.55), y2 = FY - Math.sin(0.8 * Math.PI) * 30;
            ringK(e.c, HX, y2 + 1, R(3 + 8 * k), '#ffffff', 1, 1 - k, 0.3);
            dust(e.c, HX, win(t, 0.75, 0.92), 0.8);
        } },
    { id: 'jump-flip', name: '宙返り', note: '跳びながら1回転。90度ずつ4コマで回り、きれいに着地。', draw(e) {
            const t = e.t;
            e.bg();
            e.boss();
            const k = win(t, 0.2, 0.66);
            const y = R(FY - Math.sin(k * Math.PI) * 40);
            e.hero(HX, k > 0 && k < 1 ? y : FY, 'idle', 0, k > 0.1 && k < 0.9 ? { rot: Math.floor(((k - 0.1) / 0.8) * 4) } : {});
            if (k > 0.1 && k < 0.9)
                for (let i = 1; i < 3; i++)
                    P(e.c, HX + 8, y - 12 - i * 4, '#9aa0c8', 1, 3);
            dust(e.c, HX, win(t, 0.66, 0.86), 1);
        } },
    { id: 'jump-charge', name: '溜めジャンプ', note: 'しゃがんで光の粒を集め、一気に跳び上がる。上へ速度の線。', draw(e) {
            const t = e.t;
            e.bg();
            e.boss();
            const ch = t > 0.08 && t < 0.38;
            if (ch) {
                const r = rng(Math.floor(e.f / 2));
                for (let i = 0; i < 8; i++) {
                    const a = r() * TAU, d = 16 * (1 - ((e.f * 0.04 + i / 8) % 1));
                    P(e.c, HX + Math.cos(a) * d, FY - 10 + Math.sin(a) * d * 0.5, PAL.gold[1 + (i % 3)]);
                }
            }
            const k = win(t, 0.38, 0.8);
            const y = R(FY - Math.sin(Math.min(1, k * 1.2) * Math.PI * 0.5) * 60 * (1 - easeIn(win(k, 0.6, 1))));
            e.hero(HX, k > 0 && k < 1 ? y : FY + (ch ? 3 : 0), ch ? 'guard' : k > 0 && k < 1 ? 'victory' : 'idle', 1);
            if (k > 0 && k < 0.4)
                for (let i = 0; i < 6; i++)
                    line(e.c, HX - 8 + i * 3, y + 4 + (i % 2) * 4, HX - 8 + i * 3, y + 14 + (i % 3) * 4, PAL.gold[2]);
            dust(e.c, HX, win(t, 0.38, 0.58), 1.2);
            dust(e.c, HX, win(t, 0.8, 0.96), 1, 9);
        } },
    { id: 'jump-float', name: 'ふわり', note: 'ゆっくり浮かび、きらきらの粒を落としながら舞い降りる。', draw(e) {
            const t = e.t;
            e.bg();
            e.boss();
            const k = win(t, 0.1, 0.9);
            const y = R(FY - Math.sin(k * Math.PI) * 28);
            disc(e.c, HX, FY, 6 * (1 - Math.sin(k * Math.PI) * 0.5), '#141020', 1, 0.3);
            e.hero(HX, y, 'cast', 0.5);
            const r = rng(31);
            for (let i = 0; i < 8; i++) {
                const at = 0.15 + r() * 0.6, q = win(t, at, at + 0.25);
                if (q > 0 && q < 1)
                    star(e.c, HX - 8 + r() * 16, y - 4 + q * 20, q < 0.5 ? 1 : 0, PAL.holy[1 + (i % 2)], '#ffffff');
            }
        } },
    { id: 'jump-rocket', name: 'ロケット', note: '一瞬で真上へ。うしろに縦の残像の柱、落ちてきて地面に輪。', draw(e) {
            const t = e.t;
            e.shake(bump(t, 0.7, 0.78) * 2);
            e.bg();
            e.boss();
            let y = FY;
            if (t > 0.2 && t < 0.3)
                y = R(lerp(FY, 2, ease(win(t, 0.2, 0.3))));
            else if (t >= 0.3 && t < 0.56)
                y = 2;
            else if (t >= 0.56 && t < 0.7)
                y = R(lerp(2, FY, easeIn(win(t, 0.56, 0.7))));
            if (t > 0.2 && t < 0.36)
                for (let i = 1; i < 5; i++)
                    e.ghost(HX, lerp(FY, 2, ease(win(t - i * 0.02, 0.2, 0.3))), PAL.gold[2], 0.6 - i * 0.12, 'victory', 0.25);
            e.hero(HX, y, t > 0.2 && t < 0.7 ? 'victory' : 'idle', 0.25);
            const k = win(t, 0.7, 0.84);
            ringK(e.c, HX, FY - 1, R(4 + 20 * k), PAL.gold[1], 1, 1 - k, 0.25);
            dust(e.c, HX, k, 1.2);
        } },
];
// ================================================================ 9〜14. 必殺技
// 共通: カットインの帯（画面中央を横切る色の帯に、冒険者を2倍で）
function cutin(e, k, col) {
    if (k <= 0 || k >= 1 || QUIET)
        return;
    const inK = ease(win(k, 0, 0.25)), out = 1 - win(k, 0.75, 1);
    const h = R(22 * inK * out);
    if (h <= 0)
        return;
    const y0 = 30 - h / 2;
    P(e.c, 0, R(y0), '#05030c', W, h);
    P(e.c, 0, R(y0), col, W, 1);
    P(e.c, 0, R(y0 + h - 1), col, W, 1);
    for (let i = 0; i < 6; i++) {
        const y = R(y0 + 3 + (i * 5) % Math.max(1, h - 4));
        const x = ((i * 37 - e.f * 6) % (W + 40) + W + 40) % (W + 40) - 20;
        P(e.c, x, y, col, 14, 1);
    }
    const img = heroSprite(e.L, 'attack', 0.5, e.f, true);
    e.c.save();
    e.c.beginPath();
    e.c.rect(0, R(y0) + 1, W, Math.max(0, h - 2));
    e.c.clip();
    e.c.drawImage(img, R(lerp(W, W / 2 - 40, inK)), R(y0 - 18), 80, 80);
    e.c.restore();
}
// 共通: 大きな跳躍の位置（t0 で踏み切り、t1 でボスの真上、t2 で着弾）
function leapPos(t, t0, t1, t2, top = -10) {
    if (t < t0)
        return { x: HX, y: FY, air: false };
    if (t < t1) {
        const k = win(t, t0, t1);
        return { x: R(lerp(HX, 52, k)), y: R(lerp(FY, top, ease(k))), air: true };
    }
    if (t < t2) {
        const k = win(t, t1, t2);
        return { x: 52, y: R(lerp(top, FY, easeIn(k))), air: true };
    }
    return { x: R(lerp(52, HX, ease(win(t, t2 + 0.12, t2 + 0.3)))), y: FY, air: false };
}
const impactRing = (e, at, col, big = 1) => { const k = win(e.t, at, at + 0.18); ringK(e.c, 46, FY - 1, R(6 + 40 * big * ease(k)), col[2], 2, 1 - k, 0.22); ringK(e.c, 46, FY - 1, R(3 + 26 * big * ease(k)), col[0], 1, 1 - k, 0.22); };
const OUGI = [
    { id: 'ougi-fall', name: '天墜', note: '画面の外まで跳び、縦の速度線とともに落ちてくる。縦一文字の太い軌跡で叩き斬る。', draw(e) {
            const t = e.t;
            e.shake(bump(t, 0.56, 0.66) * 3);
            e.bg(win(t, 0.1, 0.3) * 0.5 * (1 - win(t, 0.7, 0.85)));
            hitBoss(e, 0.56, 0.14, 0);
            const p = leapPos(t, 0.14, 0.34, 0.56, 6);
            if (p.air && t > 0.34)
                for (let i = 0; i < 10; i++)
                    line(e.c, 10 + ((i * 13) % 80), ((i * 23 + e.f * 9) % H), 10 + ((i * 13) % 80), ((i * 23 + e.f * 9) % H) + 10, '#9aa0c8');
            e.hero(p.x, p.y, t > 0.4 && t < 0.66 ? 'attack' : p.air ? 'victory' : 'idle', win(t, 0.44, 0.66), { flip: !(t > 0.68 && t < 0.86) });
            const k = win(t, 0.5, 0.58), fade = 1 - win(t, 0.6, 0.72);
            if (k > 0 && fade > 0) {
                const top = 0, bot = lerp(0, FY, ease(k));
                for (let i = 0; i < 4; i++)
                    P(e.c, 50 - 4 + i * 2 - (i > 1 ? 0 : 0), top, PAL.gold[3 - i], 8 - i * 2 + (i === 3 ? 1 : 0), R(bot));
                rectD(e.c, 46, 0, 9, R(bot), '#ffffff', fade * 0.6);
            }
            flash(e.c, bump(t, 0.56, 0.6) * 0.6);
            impactRing(e, 0.56, PAL.gold);
            debris(e.c, 48, FY - 2, win(t, 0.58, 0.9), 16, 36, ['#a8987a', '#7a6a52', '#4a3a2a'], 7, 0.6, 90);
        } },
    { id: 'ougi-moon', name: '月輪', note: '跳んだ頂点で背後に満月の輪。輪を切り裂くように振り下ろす。', draw(e) {
            const t = e.t;
            e.bg(win(t, 0.1, 0.3) * 0.6 * (1 - win(t, 0.7, 0.85)));
            hitBoss(e, 0.58, 0.12, 4);
            const p = leapPos(t, 0.14, 0.4, 0.58, 30);
            const m = bump(t, 0.3, 0.64);
            if (m > 0) {
                disc(e.c, 56, 20, R(16 * m), '#fff6c8', m);
                ring(e.c, 56, 20, R(18 * m), PAL.gold[2], 1, m);
                ring(e.c, 56, 20, R(21 * m), PAL.gold[3], 1, m * 0.6);
            }
            e.hero(p.x, p.y, t > 0.4 && t < 0.66 ? 'attack' : p.air ? 'victory' : 'idle', win(t, 0.44, 0.66));
            const k = win(t, 0.46, 0.58), fade = 1 - win(t, 0.6, 0.7);
            if (k > 0 && fade > 0)
                band(e.c, 52, 28, 18, 28, Math.PI + 1.9, lerp(Math.PI + 1.9, Math.PI - 1.4, ease(k)), PAL.gold, fade, 1.2);
            flash(e.c, bump(t, 0.58, 0.62) * 0.5, PAL.gold[1]);
            sparks(e.c, TX + 6, TY, win(t, 0.58, 0.72), 14, 22, PAL.gold, 3);
        } },
    { id: 'ougi-cross', name: '十字斬り', note: '空中で2回、×の字に斬る。少しおいて×が光り、まとめてはじける。', draw(e) {
            const t = e.t;
            e.shake(bump(t, 0.66, 0.74) * 2);
            e.bg(win(t, 0.1, 0.3) * 0.5 * (1 - win(t, 0.76, 0.9)));
            hitBoss(e, 0.66, 0.12, 4);
            const p = leapPos(t, 0.12, 0.36, 0.5, 30);
            e.hero(p.x, p.y, t > 0.36 && t < 0.56 ? 'attack' : p.air ? 'victory' : 'idle', (t * 8) % 1);
            const cx = TX + 6, cy = TY - 4;
            [[0.4, 1], [0.48, -1]].forEach(([at, s]) => { const k = win(t, at, at + 0.04), fade = 1 - win(t, 0.66, 0.74); if (k > 0 && fade > 0)
                rampLine(e.c, cx + 18, cy - 18 * s, lerp(cx + 18, cx - 18, k), lerp(cy - 18 * s, cy + 18 * s, k), t > 0.6 ? PAL.gold : ['#ffffff', PAL.steel[1]], t > 0.6 ? 5 : 2, fade); });
            flash(e.c, bump(t, 0.66, 0.7) * 0.6);
            sparks(e.c, cx, cy, win(t, 0.66, 0.8), 16, 24, PAL.gold, 9);
        } },
    { id: 'ougi-comet', name: '流星', note: '跳んでから光の玉になり、斜めに急降下。尾を引いてぶつかり、地面がえぐれる。', draw(e) {
            const t = e.t;
            e.shake(bump(t, 0.56, 0.68) * 3);
            e.bg(win(t, 0.1, 0.3) * 0.5 * (1 - win(t, 0.7, 0.85)));
            hitBoss(e, 0.56, 0.14, 0);
            const up = t > 0.12 && t < 0.3, down = t >= 0.36 && t < 0.56;
            if (up)
                e.hero(HX, R(lerp(FY, 20, ease(win(t, 0.12, 0.3)))), 'victory', 0.25);
            else if (!down && !(t >= 0.3 && t < 0.36))
                e.hero(t >= 0.56 && t < 0.74 ? 48 : t >= 0.74 ? R(lerp(48, HX, ease(win(t, 0.74, 0.9)))) : HX, FY, t >= 0.56 && t < 0.74 ? 'guard' : 'idle', 1, { flip: !(t >= 0.74 && t < 0.9) });
            if (down) {
                const k = easeIn(win(t, 0.36, 0.56)), x = lerp(W + 10, 48, k), y = lerp(-20, FY - 8, k);
                for (let i = 1; i < 10; i++)
                    disc(e.c, x + i * 5, y - i * 4, Math.max(0.5, 5 - i * 0.5), PAL.fire[Math.min(4, i >> 1)], 1 - i / 10);
                orb(e.c, x, y, 6, PAL.fire);
            }
            flash(e.c, bump(t, 0.56, 0.6) * 0.6, PAL.fire[1]);
            impactRing(e, 0.56, PAL.fire, 1.2);
            if (t > 0.56)
                disc(e.c, 46, FY + 1, 12 * (1 - win(t, 0.8, 0.95)), '#05030c', 0.8, 0.25);
            debris(e.c, 46, FY - 2, win(t, 0.56, 0.9), 18, 40, PAL.fire, 5, 0.7, 90);
        } },
    { id: 'ougi-bolt', name: '雷刃', note: '跳んだ頂点で、刃に雷が落ちる。雷をまとったまま突き刺し、稲妻が地面を走る。', draw(e) {
            const t = e.t;
            e.shake(bump(t, 0.58, 0.68) * 2);
            e.bg(win(t, 0.1, 0.3) * 0.65 * (1 - win(t, 0.74, 0.9)));
            hitBoss(e, 0.58, 0.14, 2);
            const p = leapPos(t, 0.12, 0.38, 0.58, 30);
            const s = bump(t, 0.34, 0.42);
            if (s > 0) {
                const r = rng(Math.floor(e.f / 2));
                let x = p.x - 4, y = -2;
                while (y < p.y - 20) {
                    const nx = x + (r() - 0.5) * 10, ny = y + 5;
                    rampLine(e.c, x, y, nx, ny, PAL.bolt, 3);
                    x = nx;
                    y = ny;
                }
            }
            e.hero(p.x, p.y, t > 0.4 && t < 0.66 ? 'attack' : p.air ? 'victory' : 'idle', win(t, 0.44, 0.66));
            if (t > 0.38 && t < 0.62) {
                const r = rng(e.f);
                for (let i = 0; i < 4; i++)
                    line(e.c, p.x - 8 + r() * 16, p.y - 30 + r() * 26, p.x - 8 + r() * 16, p.y - 30 + r() * 26, PAL.bolt[1]);
            }
            const g = bump(t, 0.58, 0.74);
            if (g > 0) {
                const r = rng(Math.floor(e.f / 2) + 3);
                for (const s2 of [-1, 1]) {
                    let x = 46, y = FY - 1;
                    for (let i = 0; i < 6; i++) {
                        const nx = x + s2 * (5 + r() * 4), ny = FY - 1 - r() * 3;
                        line(e.c, x, y, nx, ny, PAL.bolt[i % 2 ? 1 : 2], 1, g);
                        x = nx;
                        y = ny;
                    }
                }
            }
            flash(e.c, bump(t, 0.36, 0.4) * 0.5, PAL.bolt[1]);
            flash(e.c, bump(t, 0.58, 0.62) * 0.6);
        } },
    { id: 'ougi-shadow', name: '影縫い', note: '残像を残してボスの真上へ瞬間移動。上から3回、影のように斬り下ろす。', draw(e) {
            const t = e.t;
            e.bg(win(t, 0.1, 0.3) * 0.7 * (1 - win(t, 0.76, 0.9)));
            const hs = [0.44, 0.52, 0.6];
            const last = hs.filter((h) => t >= h).pop();
            e.boss({ hit: last !== undefined && t - last < 0.05, tint: '#24103e', tintA: win(t, 0.4, 0.6) * (1 - win(t, 0.7, 0.8)) * 0.5 });
            if (t < 0.22)
                e.hero(HX, FY, 'guard', 1);
            if (t > 0.2 && t < 0.3)
                for (let i = 0; i < 4; i++)
                    e.ghost(lerp(HX, 52, i / 3), lerp(FY, 36, i / 3), PAL.shadow[1], 0.5, 'dash');
            if (t >= 0.3 && t < 0.66) {
                const i = hs.findIndex((h) => t < h + 0.04);
                const x = [56, 34, 46][Math.max(0, i)];
                e.hero(x, 36 + (i >= 0 ? R(win(t, hs[i] - 0.06, hs[i]) * 20) : 20), 'attack', i >= 0 ? win(t, hs[i] - 0.06, hs[i] + 0.02) : 1);
            }
            if (t >= 0.66)
                e.hero(R(lerp(46, HX, ease(win(t, 0.7, 0.86)))), FY, t < 0.86 ? 'dash' : 'idle', 0.5, { flip: false });
            hs.forEach((h, i) => { const x = [52, 30, 42][i], k = win(t, h - 0.04, h), fade = 1 - win(t, h + 0.02, h + 0.1); if (k > 0 && fade > 0)
                rampLine(e.c, x, 20, x - 6, lerp(20, FY - 4, k), PAL.shadow, 4, fade); });
        } },
];
const RUSH = [
    { id: 'rush-hundred', name: '百連斬', note: 'ボスのまわりに短い斬撃が増えていき、だんだん速くなる。最後に大きな一太刀。', draw(e) {
            const t = e.t;
            e.shake(bump(t, 0.68, 0.76) * 2);
            e.bg(win(t, 0.1, 0.24) * 0.5 * (1 - win(t, 0.8, 0.92)));
            e.boss({ hit: t > 0.24 && t < 0.72 && e.f % 4 < 2, dx: t > 0.24 && t < 0.76 ? -R(Math.sin(e.f) * 1) - 1 : 0 });
            const inside = t > 0.2 && t < 0.72;
            e.hero(inside ? 60 : approach(t, 0.08, 0.2, 0.74, 0.88, 60), FY, inside ? 'attack' : 'idle', (t * 14) % 1, { a: inside ? (e.f % 3 ? 1 : 0.4) : 1 });
            const r = rng(41);
            for (let i = 0; i < 26; i++) {
                const at = 0.22 + Math.sqrt(i / 26) * 0.46;
                const k = win(t, at, at + 0.025), f2 = 1 - win(t, at + 0.03, at + 0.07);
                if (k <= 0 || f2 <= 0)
                    continue;
                const a = r() * TAU, L = 8 + r() * 8, cx = TX + 4 + r() * 10 - 5, cy = TY - 4 + r() * 20 - 10;
                rampLine(e.c, cx - Math.cos(a) * L, cy - Math.sin(a) * L, cx - Math.cos(a) * L + Math.cos(a) * 2 * L * k, cy - Math.sin(a) * L + Math.sin(a) * 2 * L * k, PAL.steel.slice(0, 3), 2, f2);
            }
            const k = win(t, 0.66, 0.7), fade = 1 - win(t, 0.72, 0.8);
            if (k > 0 && fade > 0)
                rampLine(e.c, W, TY - 18, lerp(W, 0, k), lerp(TY - 18, TY + 18, k), PAL.gold, 5, fade);
            flash(e.c, bump(t, 0.68, 0.72) * 0.6);
        } },
    { id: 'rush-clones', name: '分身', note: '冒険者が3人に分かれ、かわるがわる斬りかかる。分身は色ちがいの点で描く。', draw(e) {
            const t = e.t;
            e.bg(win(t, 0.1, 0.24) * 0.5 * (1 - win(t, 0.8, 0.92)));
            const hs = [0.32, 0.4, 0.48, 0.56, 0.64];
            const last = hs.filter((h) => t >= h).pop();
            e.boss({ hit: last !== undefined && t - last < 0.04, dx: last !== undefined && t - last < 0.05 ? -2 : 0 });
            const spots = [[66, FY], [56, FY - 26], [70, FY - 12]];
            if (t < 0.2 || t > 0.74)
                e.hero(t < 0.2 ? HX : R(lerp(66, HX, ease(win(t, 0.74, 0.9)))), FY, t > 0.74 && t < 0.9 ? 'dash' : 'idle', 0.5, { flip: !(t > 0.74 && t < 0.9) });
            else
                spots.forEach(([x, y], i) => { const own = hs.findIndex((h, j) => j % 3 === i && t >= h - 0.06 && t < h + 0.06); const img = heroSprite(e.L, own >= 0 ? 'attack' : 'idle', own >= 0 ? win(t, hs[own] - 0.06, hs[own] + 0.04) : 0, e.f, true); drawDither(e.c, i === 0 ? img : tinted(img, ['', '#8ad8ff', '#ffb8e8'][i], 'cl' + i), x - 20, y - 36, i === 0 ? 1 : 0.75); });
            hs.forEach((h, i) => { const k = win(t, h - 0.03, h + 0.01), fade = 1 - win(t, h + 0.02, h + 0.08); if (k > 0 && fade > 0)
                band(e.c, TX + 14, TY - 2 + (i % 3) * 6 - 6, 8, 12, Math.PI + 2, lerp(Math.PI + 2, Math.PI - 1.2, k), i % 3 === 1 ? PAL.ice : i % 3 === 2 ? PAL.blood : PAL.steel, fade); });
        } },
    { id: 'rush-cyclone', name: '旋風', note: 'ボスのまわりをぐるぐる回りながら斬る。円い帯が何重にも重なっていく。', draw(e) {
            const t = e.t;
            e.bg(win(t, 0.1, 0.24) * 0.5 * (1 - win(t, 0.8, 0.92)));
            e.boss({ hit: t > 0.28 && t < 0.7 && e.f % 5 < 2 });
            const k = win(t, 0.24, 0.7);
            if (k > 0 && k < 1) {
                const a = k * TAU * 3;
                const x = TX + 6 + Math.cos(a) * 30, y = TY + 10 + Math.sin(a) * 10;
                e.hero(R(x), R(y + 20), 'attack', (k * 6) % 1, { flip: Math.sin(a) > 0 });
                for (let i = 0; i < 3; i++)
                    band(e.c, TX + 6, TY + 4, 26 + i * 3, 30 + i * 3, a - 1.6 - i * 0.6, a - i * 0.6, [PAL.gold, PAL.steel, PAL.arc][i], 0.9 - i * 0.2, 0.35);
            }
            else
                e.hero(t < 0.24 ? R(lerp(HX, 66, ease(win(t, 0.08, 0.24)))) : R(lerp(66, HX, ease(win(t, 0.72, 0.88)))), FY, t > 0.08 && t < 0.24 ? 'dash' : 'idle', 0.5, { flip: !(t > 0.72 && t < 0.88) });
            flash(e.c, bump(t, 0.7, 0.74) * 0.5);
            sparks(e.c, TX + 6, TY, win(t, 0.7, 0.84), 16, 26, PAL.gold, 4);
        } },
    { id: 'rush-pierce', name: '乱れ突き', note: '細い突きの線が何十本も重なり、ボスの前が光の束になる。', draw(e) {
            const t = e.t;
            e.bg(win(t, 0.1, 0.24) * 0.5 * (1 - win(t, 0.8, 0.92)));
            e.boss({ hit: t > 0.3 && t < 0.7 && e.f % 4 < 2, dx: t > 0.3 && t < 0.72 ? -2 : 0 });
            const x = approach(t, 0.08, 0.24, 0.72, 0.86, 66);
            e.hero(x, FY, t > 0.24 && t < 0.72 ? 'attack' : 'idle', (t * 16) % 1);
            if (t > 0.26 && t < 0.7) {
                const r = rng(e.f);
                for (let i = 0; i < 6; i++) {
                    const y = TY - 14 + r() * 28;
                    line(e.c, x - 12, FY - 14, TX + 6, y, i % 2 ? PAL.steel[1] : '#ffffff', 1, 0.9);
                    star(e.c, TX + 6, y, 1);
                }
            }
            const k = win(t, 0.66, 0.72);
            if (k > 0 && k < 1)
                rampLine(e.c, x - 12, FY - 14, TX - 4, TY, PAL.steel, 5, 1 - k);
            sparks(e.c, TX + 4, TY, win(t, 0.68, 0.82), 14, 22, PAL.steel, 8, 1.6, Math.PI);
        } },
    { id: 'rush-star', name: '五芒星', note: 'ボスのまわりの5つの点を一筆で結ぶように駆け抜け、最後に星の形が光る。', draw(e) {
            const t = e.t;
            e.bg(win(t, 0.1, 0.24) * 0.6 * (1 - win(t, 0.84, 0.94)));
            const pts = Array.from({ length: 5 }, (_, i) => [TX + 6 + Math.cos(-Math.PI / 2 + i * 4 * Math.PI / 5) * 26, TY + Math.sin(-Math.PI / 2 + i * 4 * Math.PI / 5) * 22]);
            const k = win(t, 0.24, 0.62), seg = Math.min(4, Math.floor(k * 5)), sk = k * 5 - seg;
            e.boss({ hit: (k > 0 && k < 1 && e.f % 4 < 2) || (t > 0.66 && t < 0.74) });
            for (let i = 0; i < 5; i++) {
                if (i > seg && k < 1)
                    break;
                const A = pts[i], B = pts[(i + 1) % 5], q = i < seg || k >= 1 ? 1 : sk;
                rampLine(e.c, A[0], A[1], lerp(A[0], B[0], q), lerp(A[1], B[1], q), t > 0.64 ? PAL.gold : PAL.steel.slice(0, 3), t > 0.64 ? 3 : 1, 1 - win(t, 0.76, 0.86));
            }
            if (k > 0 && k < 1) {
                const A = pts[seg], B = pts[(seg + 1) % 5];
                e.hero(R(lerp(A[0], B[0], sk)), R(lerp(A[1], B[1], sk) + 14), 'dash', 0.5, { flip: B[0] < A[0] });
            }
            else
                e.hero(t < 0.24 ? HX : R(lerp(pts[0][0], HX, ease(win(t, 0.62, 0.8)))), t < 0.24 || t > 0.8 ? FY : R(lerp(pts[0][1] + 14, FY, win(t, 0.62, 0.8))), 'idle', 0, { flip: !(t > 0.62 && t < 0.8) });
            flash(e.c, bump(t, 0.64, 0.68) * 0.6, PAL.gold[1]);
            pts.forEach(([x, y]) => star(e.c, x, y, R(3 * bump(t, 0.64, 0.76))));
        } },
    { id: 'rush-frames', name: '暗転の連撃', note: '上下に黒い帯。画面が暗転し、白い斬撃だけが1コマずつ浮かぶ。明けるとボスがよろめく。', draw(e) {
            const t = e.t;
            e.bg();
            const dark = t > 0.3 && t < 0.62;
            e.boss({ hit: t > 0.62 && t < 0.72, dx: t > 0.62 && t < 0.8 ? -4 : 0 });
            e.hero(dark ? 60 : approach(t, 0.12, 0.28, 0.66, 0.82, 60), FY, t > 0.62 && t < 0.66 ? 'attack' : 'idle', 1);
            if (dark) {
                P(e.c, -8, -8, '#05030c', W + 16, H + 16);
                const i = Math.floor(win(t, 0.3, 0.62) * 8);
                const r = rng(100 + i);
                const a = r() * TAU, cx = TX + 6, cy = TY, L = 30;
                rampLine(e.c, cx - Math.cos(a) * L, cy - Math.sin(a) * L, cx + Math.cos(a) * L, cy + Math.sin(a) * L, ['#ffffff', '#ffffff', '#c8c8d8'], 3);
            }
            letterbox(e.c, bump(t, 0.2, 0.8) > 0 ? Math.min(1, bump(t, 0.2, 0.8) * 2) : 0);
            flash(e.c, bump(t, 0.62, 0.66) * 0.6);
        } },
];
const SUMMON = [
    { id: 'summon-sword', name: '巨大な剣', note: '空に魔法陣が開き、点で描いた大きな剣がまっすぐ落ちてきて突き刺さる。', draw(e) {
            const t = e.t;
            e.shake(bump(t, 0.56, 0.66) * 3);
            e.bg(win(t, 0.08, 0.24) * 0.55 * (1 - win(t, 0.8, 0.92)));
            hitBoss(e, 0.56, 0.14, 0);
            e.hero(HX, FY, t > 0.08 && t < 0.66 ? 'cast' : 'idle', 0.5);
            const c = bump(t, 0.12, 0.6);
            if (c > 0) {
                ring(e.c, 44, 6, 20, PAL.arc[2], 1, c, 0.3);
                ring(e.c, 44, 6, 14, PAL.arc[1], 1, c, 0.3);
            }
            const k = win(t, 0.4, 0.56), y = R(lerp(-60, FY - 52, easeIn(k)));
            if (t > 0.4 && t < 0.86) {
                const a = 1 - win(t, 0.74, 0.86);
                rectD(e.c, 42, y, 5, 46, PAL.steel[1], a);
                rectD(e.c, 43, y, 2, 46, '#ffffff', a);
                rectD(e.c, 36, y + 46, 17, 3, PAL.gold[2], a);
                rectD(e.c, 42, y + 49, 5, 8, '#8a5a2a', a);
                rectD(e.c, 41, y + 57, 7, 3, PAL.gold[2], a);
            }
            flash(e.c, bump(t, 0.56, 0.6) * 0.6);
            impactRing(e, 0.56, PAL.steel, 1.1);
        } },
    { id: 'summon-bird', name: '炎の鳥', note: '翼を広げた炎の鳥が呼ばれ、大きく弧を描いてボスへ突っこむ。火の粉の尾。', draw(e) {
            const t = e.t;
            e.bg(win(t, 0.08, 0.24) * 0.5 * (1 - win(t, 0.8, 0.92)));
            hitBoss(e, 0.6, 0.14, 4);
            e.hero(HX, FY, t > 0.08 && t < 0.6 ? 'cast' : 'idle', 0.5);
            const k = win(t, 0.22, 0.6);
            if (k > 0 && k < 1) {
                const x = lerp(HX - 6, TX + 4, k), y = lerp(FY - 30, TY, k) - Math.sin(k * Math.PI) * 30;
                const fl = Math.floor(e.f / 3) % 2;
                for (let i = 1; i < 8; i++)
                    P(e.c, x + i * 4, y - Math.sin(k * Math.PI) * i * 0.8 + ((i + e.f) % 3) - 1, PAL.fire[Math.min(4, i >> 1)], 2, 1);
                for (const s of [-1, 1])
                    for (let j = 0; j < 10; j++)
                        P(e.c, x + j, y + s * (fl ? j * 0.7 : j * 0.3) - (fl ? 0 : 2), PAL.fire[1 + Math.floor(j / 4)], 1, 2);
                orb(e.c, x, y, 3, PAL.fire);
                P(e.c, x - 3, y - 1, '#ffffff', 2, 1);
            }
            const b = win(t, 0.6, 0.8);
            if (b > 0 && b < 1) {
                for (let i = 0; i < 4; i++)
                    disc(e.c, TX + 6, TY, (4 + 16 * ease(b)) * (1 - i * 0.2), PAL.fire[i + 1], 1 - b * 0.8);
            }
        } },
    { id: 'summon-fist', name: '岩の拳', note: '足元から岩の巨大な拳が突き上がり、ボスを殴り上げる。', draw(e) {
            const t = e.t;
            e.shake(bump(t, 0.46, 0.58) * 3);
            e.bg();
            const k0 = t - 0.5;
            e.boss({ hit: k0 >= 0 && k0 < 0.1, dy: k0 >= 0 && k0 < 0.3 ? -R(Math.sin((k0 / 0.3) * Math.PI) * 10) : 0 });
            e.hero(HX, FY, t > 0.1 && t < 0.6 ? 'cast' : 'idle', 0.5);
            const g = bump(t, 0.36, 0.5);
            if (g > 0) {
                const r = rng(5);
                for (let i = 0; i < 8; i++)
                    line(e.c, 40, FY - 1, 40 + (r() - 0.5) * 40, FY - 1 + r() * 4, '#05030c', 1, g);
            }
            const k = win(t, 0.46, 0.52) * (1 - win(t, 0.72, 0.86));
            if (k > 0) {
                const top = R(FY - 40 * ease(k));
                P(e.c, 30, top, '#7a6a52', 22, FY - top);
                P(e.c, 30, top, '#a8987a', 22, 3);
                for (let i = 0; i < 4; i++)
                    P(e.c, 31 + i * 5, top + 2, '#4a3a2a', 1, 6);
                P(e.c, 28, top + 8, '#a8987a', 3, 10);
            }
            debris(e.c, 40, FY - 2, win(t, 0.48, 0.8), 16, 34, ['#a8987a', '#7a6a52', '#4a3a2a'], 9, 0.8, 80);
            dust(e.c, 40, win(t, 0.48, 0.76), 1.6);
        } },
    { id: 'summon-knight', name: '光の騎士', note: '冒険者の背後に、2倍の大きさの光の分身があらわれ、いっしょに斬り下ろす。', draw(e) {
            const t = e.t;
            e.bg(win(t, 0.08, 0.24) * 0.6 * (1 - win(t, 0.8, 0.92)));
            hitBoss(e, 0.56, 0.14, 4);
            const a = win(t, 0.14, 0.3) * (1 - win(t, 0.66, 0.8));
            if (a > 0) {
                const img = heroSprite(e.L, t > 0.44 && t < 0.62 ? 'attack' : 'cast', win(t, 0.44, 0.62), e.f, true);
                const s = tinted(img, PAL.holy[2], 'knight');
                e.c.save();
                e.c.translate(R(HX - 44), R(FY - 72));
                e.c.scale(2, 2);
                drawDither(e.c, s, 0, 0, a * 0.8);
                e.c.restore();
            }
            e.hero(HX, FY, t > 0.44 && t < 0.62 ? 'attack' : 'cast', win(t, 0.44, 0.62));
            const k = win(t, 0.48, 0.56), fade = 1 - win(t, 0.6, 0.7);
            if (k > 0 && fade > 0)
                band(e.c, HX - 24, FY - 30, 26, 40, Math.PI + 2.3, lerp(Math.PI + 2.3, Math.PI - 0.4, ease(k)), PAL.holy, fade, 1);
            flash(e.c, bump(t, 0.56, 0.6) * 0.6, PAL.holy[1]);
            sparks(e.c, TX + 6, TY, win(t, 0.56, 0.72), 14, 22, PAL.holy, 8);
        } },
    { id: 'summon-tornado', name: '竜巻', note: 'ボスの足元から、横線を積み重ねた竜巻が立ちのぼる。木の葉が巻き上がる。', draw(e) {
            const t = e.t;
            e.bg();
            e.boss({ hit: t > 0.34 && t < 0.72 && e.f % 4 < 2, dy: t > 0.34 && t < 0.72 ? -R(bump(t, 0.34, 0.72) * 6) : 0 });
            e.hero(HX, FY, t > 0.08 && t < 0.72 ? 'cast' : 'idle', 0.5);
            const k = win(t, 0.26, 0.4) * (1 - win(t, 0.7, 0.82));
            if (k > 0)
                for (let y = FY - 2; y > FY - 2 - 70 * k; y -= 2) {
                    const q = (FY - y) / 70, w = 6 + q * 22, off = Math.sin(y * 0.3 + e.f * 0.5) * 4;
                    const ph = ((y + e.f * 3) % 8) / 8;
                    line(e.c, TX + 4 + off - w, y, TX + 4 + off - w + 2 * w * ph, y, '#ffffff', 1, 0.9);
                    line(e.c, TX + 4 + off - w * 0.6, y, TX + 4 + off + w * 0.6, y, PAL.leaf[1], 1, 0.6);
                }
            const r = rng(17);
            for (let i = 0; i < 8; i++) {
                const q = (e.f * 0.02 + r()) % 1, a = q * 14 + r() * 6;
                if (k <= 0)
                    break;
                P(e.c, TX + 4 + Math.cos(a) * (8 + q * 20), FY - 4 - q * 64 * k, PAL.leaf[1 + (i % 3)], 2, 1);
            }
        } },
    { id: 'summon-meteor', name: '流星群', note: '空から大小の燃える岩がいくつも降り、つぎつぎに爆ぜる。', draw(e) {
            const t = e.t;
            e.shake(t > 0.4 && t < 0.72 ? 1 : 0);
            e.bg(win(t, 0.08, 0.24) * 0.6 * (1 - win(t, 0.84, 0.94)));
            e.boss({ hit: t > 0.42 && t < 0.74 && e.f % 5 < 2 });
            e.hero(HX, FY, t > 0.08 && t < 0.7 ? 'cast' : 'idle', 0.5);
            const r = rng(51);
            for (let i = 0; i < 7; i++) {
                const at = 0.3 + i * 0.05, k = win(t, at, at + 0.14), tx = 14 + r() * 50, ty = TY - 6 + r() * 26, big = r() > 0.6 ? 4 : 2;
                if (k > 0 && k < 1) {
                    const x = lerp(tx + 40, tx, easeIn(k)), y = lerp(-10, ty, easeIn(k));
                    for (let j = 1; j < 6; j++)
                        disc(e.c, x + j * 3, y - j * 3, Math.max(0.5, big - j * 0.5), PAL.fire[Math.min(4, j)]);
                    orb(e.c, x, y, big, ['#ffffff', PAL.fire[2], '#7a6a52', '#4a3a2a']);
                }
                const b = win(t, at + 0.14, at + 0.26);
                if (b > 0 && b < 1)
                    for (let j = 0; j < 4; j++)
                        disc(e.c, tx, ty, (big + 6 * ease(b)) * (1 - j * 0.22), PAL.fire[j + 1], 1 - b * 0.7);
            }
        } },
];
const PARRY = [
    { id: 'parry-return', name: '打ち返し', note: '飛んできた玉を斬り返す。返った玉はひと回り大きく、色も味方の色に変わる。', draw(e) {
            const t0 = e.t, t = stop(t0, 0.38, 0.06);
            e.bg(win(t, 0.3, 0.38) * 0.4 * (1 - win(t, 0.7, 0.8)));
            hitBoss(e, 0.6, 0.14, 4);
            incoming({ ...e, t }, 0.38, HX - 14);
            e.hero(HX, FY, t > 0.3 && t < 0.5 ? 'attack' : 'idle', win(t, 0.3, 0.48));
            const k = win(t, 0.38, 0.6);
            if (k > 0 && k < 1) {
                const x = lerp(HX - 14, TX + 8, k), y = lerp(FY - 16, TY, k);
                for (let i = 1; i < 6; i++)
                    P(e.c, x + i * 4, y, PAL.gold[Math.min(3, i)], 2, 1);
                orb(e.c, x, y, 5, PAL.gold);
            }
            star(e.c, HX - 14, FY - 16, R(4 * bump(t0, 0.38, 0.48)));
            flash(e.c, bump(t, 0.6, 0.64) * 0.5, PAL.gold[1]);
            sparks(e.c, TX + 8, TY, win(t, 0.6, 0.76), 14, 22, PAL.gold, 3);
        } },
    { id: 'parry-counter', name: 'カウンター斬り', note: '攻撃を受ける寸前に時間が止まり、白い影だけが動いて斬り返す。', draw(e) {
            const t = e.t;
            const frozen = t > 0.34 && t < 0.56;
            e.bg(frozen ? 0.6 : 0);
            e.boss({ hit: t > 0.56 && t < 0.68, dx: t > 0.56 && t < 0.72 ? -5 : 0, pose: { lean: t > 0.24 && t < 0.56 ? 4 : 0 } });
            const k = win(t, 0.2, 0.34), x = lerp(TX + 16, HX - 26, ease(k));
            if (t < 0.56)
                band(e.c, x, FY - 16, 6, 12, -1.2, 1.2, PAL.blood, 1, 1.4, false);
            e.hero(frozen ? HX : t > 0.56 && t < 0.72 ? 62 : HX, FY, frozen ? 'guard' : t > 0.56 && t < 0.7 ? 'attack' : 'idle', 1, frozen ? { tint: '#ffffff' } : {});
            if (frozen) {
                const q = win(t, 0.4, 0.54);
                e.ghost(lerp(HX, 62, q), FY, '#ffffff', 0.9, 'attack', q);
            }
            const s = win(t, 0.5, 0.56), fade = 1 - win(t, 0.6, 0.7);
            if (s > 0 && fade > 0)
                rampLine(e.c, TX + 30, TY - 18, lerp(TX + 30, TX - 10, s), lerp(TY - 18, TY + 18, s), ['#ffffff', '#ffffff', PAL.steel[1]], 3, fade);
            flash(e.c, bump(t, 0.56, 0.6) * 0.6);
        } },
    { id: 'parry-mirror', name: '鏡の盾', note: 'ボスの光線を、光る板で受けて、そのまま跳ね返す。', draw(e) {
            const t = e.t;
            e.bg();
            e.boss({ hit: t > 0.52 && t < 0.72 && e.f % 4 < 2, pose: { mouth: t > 0.2 && t < 0.5 ? 2 : 0 } });
            e.hero(HX, FY, t > 0.2 && t < 0.72 ? 'guard' : 'idle', 1);
            const m = bump(t, 0.24, 0.76);
            if (m > 0) {
                rectD(e.c, HX - 16, FY - 32, 3, 26, PAL.ice[1], m);
                rectD(e.c, HX - 15, FY - 30, 1, 22, '#ffffff', m);
            }
            const b1 = bump(t, 0.3, 0.52);
            if (b1 > 0)
                for (let i = 0; i < 3; i++)
                    P(e.c, TX + 12, FY - 22 + i - 1, PAL.blood[2 - i % 2], HX - 16 - TX - 12, 1);
            const b2 = bump(t, 0.46, 0.74);
            if (b2 > 0)
                for (let i = 0; i < 5; i++) {
                    const h = 5 - i;
                    P(e.c, TX + 6, FY - 18 - Math.floor(h / 2), PAL.ice[4 - i] ?? PAL.ice[3], HX - 16 - TX - 6, h);
                }
            star(e.c, HX - 16, FY - 20, R(4 * bump(t, 0.44, 0.54)));
        } },
    { id: 'parry-catch', name: '受け止めて投げ返す', note: '玉を両手で受け止め、頭の上で1回まわして投げ返す。', draw(e) {
            const t = e.t;
            e.bg();
            hitBoss(e, 0.66, 0.14, 4);
            incoming(e, 0.34, HX - 8);
            const hold = t > 0.34 && t < 0.52;
            e.hero(HX, FY, hold ? 'cast' : t >= 0.52 && t < 0.62 ? 'attack' : 'idle', hold ? 0.5 : win(t, 0.52, 0.62));
            if (hold) {
                const a = win(t, 0.36, 0.52) * TAU;
                orb(e.c, HX + Math.cos(a) * 6, FY - 38 + Math.sin(a) * 3, 3, PAL.blood);
            }
            const k = win(t, 0.52, 0.66);
            if (k > 0 && k < 1) {
                const x = lerp(HX - 8, TX + 8, k), y = lerp(FY - 38, TY, k);
                for (let i = 1; i < 5; i++)
                    P(e.c, x + i * 4, y - i, PAL.blood[Math.min(3, i)], 2, 1);
                orb(e.c, x, y, 4, PAL.blood);
            }
            sparks(e.c, TX + 8, TY, win(t, 0.66, 0.8), 12, 18, PAL.blood, 7);
        } },
    { id: 'parry-absorb', name: '吸いこんで放つ', note: 'ボスの雷を武器に吸いこみ、光の粒が集まってから、ためた雷を撃ち返す。', draw(e) {
            const t = e.t;
            e.bg(win(t, 0.2, 0.3) * 0.5 * (1 - win(t, 0.76, 0.86)));
            hitBoss(e, 0.66, 0.14, 3);
            e.hero(HX, FY, t > 0.2 && t < 0.72 ? 'cast' : 'idle', 0.5);
            const a = bump(t, 0.2, 0.42);
            if (a > 0) {
                const r = rng(Math.floor(e.f / 2));
                let x = TX + 10, y = TY;
                for (let i = 0; i < 8; i++) {
                    const nx = lerp(TX + 10, HX - 10, (i + 1) / 8), ny = lerp(TY, FY - 18, (i + 1) / 8) + (r() - 0.5) * 8;
                    line(e.c, x, y, nx, ny, PAL.arc[1 + (i % 2)], 1, a);
                    x = nx;
                    y = ny;
                }
            }
            const g = win(t, 0.4, 0.6);
            if (g > 0 && t < 0.62) {
                orb(e.c, HX - 10, FY - 18, 1 + 4 * g, PAL.bolt);
                const r = rng(e.f);
                for (let i = 0; i < 6; i++) {
                    const ang = r() * TAU, d = 12 * (1 - g);
                    P(e.c, HX - 10 + Math.cos(ang) * d, FY - 18 + Math.sin(ang) * d, PAL.bolt[1]);
                }
            }
            const b = bump(t, 0.6, 0.74);
            if (b > 0) {
                const r = rng(Math.floor(e.f / 2) + 9);
                let x = HX - 12, y = FY - 18;
                for (let i = 0; i < 8; i++) {
                    const nx = lerp(HX - 12, TX + 8, (i + 1) / 8), ny = lerp(FY - 18, TY, (i + 1) / 8) + (r() - 0.5) * 10;
                    rampLine(e.c, x, y, nx, ny, PAL.bolt, 3);
                    x = nx;
                    y = ny;
                }
            }
            flash(e.c, bump(t, 0.62, 0.66) * 0.5, PAL.bolt[1]);
        } },
    { id: 'parry-behind', name: '影からの返し', note: '攻撃が当たった瞬間、影に沈んで消え、ボスの背中側から斬りつける。', draw(e) {
            const t = e.t;
            e.bg();
            e.boss({ hit: t > 0.56 && t < 0.68, dx: t > 0.56 && t < 0.72 ? 3 : 0, pose: { lean: t > 0.24 && t < 0.44 ? 4 : 0 } });
            slashAt(e, 0.4);
            const gone = t > 0.4 && t < 0.5;
            if (t <= 0.4)
                e.hero(HX, FY, 'idle', 0, { a: t > 0.36 ? 1 - win(t, 0.36, 0.4) : 1 });
            if (t > 0.38 && t < 0.46)
                disc(e.c, HX, FY, 8 * (1 - win(t, 0.4, 0.46)), '#05030c', 1, 0.3);
            if (t > 0.46 && t < 0.52)
                disc(e.c, 10, FY, 8 * win(t, 0.46, 0.52), '#05030c', 1, 0.3);
            if (t >= 0.5 && t < 0.76)
                e.hero(12, FY, t < 0.66 ? 'attack' : 'idle', win(t, 0.5, 0.66), { flip: false });
            if (t >= 0.76)
                e.hero(HX, FY, 'idle', 0, { a: win(t, 0.76, 0.86) });
            const k = win(t, 0.54, 0.6), fade = 1 - win(t, 0.62, 0.72);
            if (!gone && k > 0 && fade > 0)
                band(e.c, 24, FY - 16, 8, 14, -2.4, lerp(-2.4, 0.9, k), PAL.shadow, fade);
        } },
];
function chainLinks(c, x0, y0, x1, y1, k) {
    const n = Math.floor(Math.hypot(x1 - x0, y1 - y0) / 4 * k);
    for (let i = 0; i < n; i++) {
        const q = i / Math.max(1, Math.hypot(x1 - x0, y1 - y0) / 4);
        const x = lerp(x0, x1, q), y = lerp(y0, y1, q);
        if (i % 2)
            P(c, x - 1, y - 1, PAL.gold[2], 3, 3);
        else
            P(c, x - 1, y, PAL.gold[1], 3, 1);
        P(c, x, y, PAL.gold[3]);
    }
}
const SEAL = [
    { id: 'seal-chains', name: '光の鎖', note: '四方から光る鎖がのびてボスを縛り、きつく締まったところへ一撃。', draw(e) {
            const t = e.t;
            e.bg(win(t, 0.08, 0.24) * 0.5 * (1 - win(t, 0.8, 0.92)));
            const bound = t > 0.36 && t < 0.72;
            e.boss({ hit: t > 0.6 && t < 0.72, dx: bound ? R(Math.sin(e.f * 2) * 1) : 0, tint: PAL.gold[2], tintA: bound ? 0.25 : 0 });
            e.hero(HX, FY, t > 0.08 && t < 0.6 ? 'cast' : t < 0.7 ? 'attack' : 'idle', win(t, 0.58, 0.7));
            const k = win(t, 0.16, 0.36), out = 1 - win(t, 0.72, 0.8);
            if (out > 0)
                for (const [x0, y0] of [[0, 4], [0, H - 4], [W - 40, 2], [W - 40, H - 2]])
                    chainLinks(e.c, x0, y0, TX + 6, TY, k * out);
            flash(e.c, bump(t, 0.6, 0.64) * 0.5, PAL.gold[1]);
            sparks(e.c, TX + 6, TY, win(t, 0.6, 0.76), 12, 20, PAL.gold, 3);
        } },
    { id: 'seal-box', name: '結界の箱', note: 'ボスを囲む光の四角があらわれ、ぎゅっと縮んで光り、はじける。', draw(e) {
            const t = e.t;
            e.bg(win(t, 0.08, 0.24) * 0.5 * (1 - win(t, 0.8, 0.92)));
            e.boss({ hit: t > 0.6 && t < 0.72, tint: PAL.ice[2], tintA: t > 0.3 && t < 0.62 ? 0.3 : 0 });
            e.hero(HX, FY, t > 0.08 && t < 0.62 ? 'cast' : 'idle', 0.5);
            const a = win(t, 0.16, 0.3), sh = win(t, 0.44, 0.6), out = 1 - win(t, 0.6, 0.64);
            if (a > 0 && out > 0) {
                const w = R(lerp(70, 40, ease(sh))), h = R(lerp(78, 56, ease(sh))), x = TX + 2 - w / 2, y = FY - h;
                for (let i = 0; i < 2; i++) {
                    line(e.c, x + i, y + i, x + w - i, y + i, PAL.ice[i], 1, a);
                    line(e.c, x + i, y + h - i, x + w - i, y + h - i, PAL.ice[i], 1, a);
                    line(e.c, x + i, y + i, x + i, y + h - i, PAL.ice[i], 1, a);
                    line(e.c, x + w - i, y + i, x + w - i, y + h - i, PAL.ice[i], 1, a);
                }
                rectD(e.c, x, y, w, h, PAL.ice[3], 0.2 * a);
                [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([cx, cy]) => star(e.c, cx, cy, 2));
            }
            flash(e.c, bump(t, 0.6, 0.64) * 0.6, PAL.ice[1]);
            debris(e.c, TX + 2, TY, win(t, 0.62, 0.9), 18, 36, PAL.ice, 11);
        } },
    { id: 'seal-talisman', name: '札', note: '何枚もの札が飛んで貼りつき、順に光って、いっせいに爆ぜる。', draw(e) {
            const t = e.t;
            e.bg();
            e.boss({ hit: t > 0.62 && t < 0.74, dx: t > 0.62 && t < 0.76 ? -3 : 0 });
            e.hero(HX, FY, t > 0.08 && t < 0.44 ? 'attack' : t > 0.44 && t < 0.62 ? 'cast' : 'idle', (t * 6) % 1);
            const r = rng(61);
            for (let i = 0; i < 7; i++) {
                const at = 0.14 + i * 0.035, tx = TX - 6 + r() * 24, ty = TY - 18 + r() * 34, k = win(t, at, at + 0.12);
                if (t > 0.66)
                    continue;
                const x = R(lerp(HX - 10, tx, k)), y = R(lerp(FY - 16, ty, k) - Math.sin(k * Math.PI) * 10);
                const lit = t > 0.44 + i * 0.02;
                P(e.c, x, y, lit && e.f % 4 < 2 ? '#fff6c8' : '#f0e6d0', 4, 6);
                P(e.c, x + 1, y + 1, '#e43b44', 2, 1);
                P(e.c, x + 1, y + 3, '#e43b44', 2, 2);
            }
            const b = win(t, 0.62, 0.8);
            if (b > 0 && b < 1) {
                const r2 = rng(61);
                for (let i = 0; i < 7; i++) {
                    r2();
                    const tx = TX - 6 + r2() * 24, ty = TY - 18 + r2() * 34;
                    orb(e.c, tx + 2, ty + 3, 2 + 6 * ease(b) * (1 - b), PAL.fire);
                }
            }
        } },
    { id: 'seal-pillar', name: '光の柱', note: 'ボスの足元に魔法陣が描かれ、そこから光の柱が立ちのぼってボスを包む。', draw(e) {
            const t = e.t;
            e.bg(win(t, 0.08, 0.24) * 0.6 * (1 - win(t, 0.82, 0.92)));
            e.boss({ hit: t > 0.44 && t < 0.72 && e.f % 4 < 2 });
            e.hero(HX, FY, t > 0.08 && t < 0.72 ? 'cast' : 'idle', 0.5);
            const c = win(t, 0.12, 0.34) * (1 - win(t, 0.76, 0.86));
            if (c > 0) {
                ring(e.c, TX + 4, FY - 1, R(26 * c), PAL.holy[2], 1, c, 0.25);
                ring(e.c, TX + 4, FY - 1, R(18 * c), PAL.holy[3], 1, c, 0.25);
                for (let i = 0; i < 8; i++) {
                    const a = e.f * 0.04 + (i / 8) * TAU;
                    P(e.c, TX + 4 + Math.cos(a) * 22 * c, FY - 1 + Math.sin(a) * 5.5 * c, '#ffffff');
                }
            }
            const p = win(t, 0.4, 0.48) * (1 - win(t, 0.7, 0.8));
            if (p > 0) {
                const w = R(30 * p);
                for (let i = 0; i < 4; i++) {
                    const ww = Math.max(1, R(w * (1 - i * 0.24)));
                    rectD(e.c, TX + 4 - Math.floor(ww / 2), 0, ww, FY, PAL.holy[3 - i], i === 3 ? 1 : 0.85);
                }
                for (let i = 0; i < 10; i++) {
                    const y = (FY - ((e.f * 3 + i * 17) % FY));
                    P(e.c, TX - 8 + ((i * 7) % 24), y, '#ffffff', 1, 3);
                }
            }
            flash(e.c, bump(t, 0.4, 0.44) * 0.6, PAL.holy[1]);
        } },
    { id: 'seal-freeze', name: '氷結', note: 'ボスの体が足元から青く凍りつき、氷の結晶が浮かぶ。最後に氷ごと砕ける。', draw(e) {
            const t = e.t;
            e.shake(bump(t, 0.64, 0.72) * 2);
            e.bg();
            const fz = win(t, 0.2, 0.5) * (1 - win(t, 0.64, 0.66));
            e.boss({ hit: t > 0.64 && t < 0.74, tint: PAL.ice[2], tintA: fz * 0.7, pose: fz > 0.5 ? { wing: 0, bob: 0 } : {} });
            e.hero(HX, FY, t > 0.08 && t < 0.5 ? 'cast' : t > 0.56 && t < 0.7 ? 'attack' : 'idle', win(t, 0.56, 0.7));
            if (fz > 0) {
                const top = R(lerp(FY, FY - 70, fz));
                rectD(e.c, 0, top, 60, FY - top, PAL.ice[1], 0.25);
                for (let i = 0; i < 6; i++) {
                    const y = lerp(FY - 8, top + 6, i / 6);
                    star(e.c, 8 + ((i * 17) % 46), y, i % 2 ? 2 : 1, PAL.ice[1], '#ffffff');
                }
            }
            debris(e.c, TX + 2, TY, win(t, 0.64, 0.92), 22, 40, PAL.ice, 13, 1.2);
            flash(e.c, bump(t, 0.64, 0.68) * 0.5, PAL.ice[1]);
        } },
    { id: 'seal-stakes', name: '光の楔', note: '空からボスのまわりに光の楔が4本落ちて刺さり、楔どうしが線で結ばれて締めつける。', draw(e) {
            const t = e.t;
            e.bg(win(t, 0.08, 0.24) * 0.5 * (1 - win(t, 0.82, 0.92)));
            const linked = t > 0.48 && t < 0.72;
            e.boss({ hit: t > 0.6 && t < 0.72, tint: PAL.gold[2], tintA: linked ? 0.25 : 0, dx: linked ? R(Math.sin(e.f * 2)) : 0 });
            e.hero(HX, FY, t > 0.08 && t < 0.62 ? 'cast' : 'idle', 0.5);
            const xs = [8, 26, 54, 72];
            xs.forEach((x, i) => { const at = 0.22 + i * 0.05, k = win(t, at, at + 0.06); if (t > 0.78)
                return; const y = R(lerp(-20, FY - 14, easeIn(k))); for (let j = 0; j < 14; j++)
                P(e.c, x - (j < 10 ? 1 : 0), y + j, PAL.gold[j < 3 ? 0 : j < 10 ? 1 : 2], j < 10 ? 3 : 1, 1); if (k >= 1)
                star(e.c, x, FY - 1, R(3 * bump(t, at + 0.06, at + 0.12))); });
            if (linked) {
                const a = win(t, 0.48, 0.56);
                for (let i = 0; i < 3; i++)
                    line(e.c, xs[i], FY - 10 - (i % 2) * 20, xs[i + 1], FY - 10 - ((i + 1) % 2) * 20, PAL.gold[1], 1, a);
                line(e.c, xs[0], FY - 10, xs[3], FY - 30, PAL.gold[1], 1, a);
            }
            flash(e.c, bump(t, 0.6, 0.64) * 0.5, PAL.gold[1]);
        } },
];
const AWAKEN = [
    { id: 'awaken-flame', name: '炎のオーラ', note: '体のまわりに炎の点が立ちのぼり、目が光る。オーラをまとったまま突進して斬る。', draw(e) {
            const t = e.t;
            e.bg(win(t, 0.06, 0.2) * 0.55 * (1 - win(t, 0.82, 0.92)));
            hitBoss(e, 0.62, 0.14, 4);
            const x = approach(t, 0.5, 0.6, 0.72, 0.88, 62);
            const au = win(t, 0.06, 0.2) * (1 - win(t, 0.74, 0.84));
            if (au > 0) {
                const r = rng(Math.floor(e.f / 2));
                for (let i = 0; i < 18; i++) {
                    const q = (e.f * 0.04 + r()) % 1, ox = (r() - 0.5) * 18 * (1 - q * 0.5);
                    P(e.c, x + ox, FY - q * 34, PAL.fire[Math.min(4, Math.floor(q * 5))], q < 0.4 ? 2 : 1, 2);
                }
            }
            e.hero(x, FY, t < 0.5 ? 'guard' : t < 0.6 ? 'dash' : t < 0.72 ? 'attack' : 'idle', t < 0.5 ? 1 : win(t, 0.6, 0.72), { flip: !(t > 0.72 && t < 0.88) });
            if (t > 0.2 && t < 0.5 && e.f % 6 < 3) {
                P(e.c, x - 4, FY - 20, '#ffffff', 2, 1);
                P(e.c, x + 1, FY - 20, '#ffffff', 2, 1);
            }
            const k = win(t, 0.6, 0.66), fade = 1 - win(t, 0.68, 0.78);
            if (k > 0 && fade > 0)
                band(e.c, x - 8, FY - 16, 12, 20, Math.PI + 2.4, lerp(Math.PI + 2.4, Math.PI - 1.2, ease(k)), PAL.fire, fade);
            flash(e.c, bump(t, 0.62, 0.66) * 0.5, PAL.fire[1]);
        } },
    { id: 'awaken-halo', name: '光輪と翼', note: '頭上に光の輪、背中に点で描いた光の翼がひらく。両手から太い光線。', draw(e) {
            const t = e.t;
            e.bg(win(t, 0.06, 0.2) * 0.6 * (1 - win(t, 0.82, 0.92)));
            e.boss({ hit: t > 0.52 && t < 0.72 && e.f % 4 < 2, dx: t > 0.52 && t < 0.72 ? -2 : 0 });
            const a = win(t, 0.1, 0.3) * (1 - win(t, 0.76, 0.86)), y = FY - R(6 * a);
            if (a > 0) {
                for (const s of [1, -1])
                    for (let i = 0; i < 6; i++) {
                        const L = R((14 - i * 1.5) * a);
                        line(e.c, HX + s * 4, y - 18 - i * 2, HX + s * (4 + L), y - 22 - i * 3 + L * 0.2, PAL.holy[1 + (i % 3)], 1);
                    }
                ring(e.c, HX, y - 34, 6, PAL.holy[2], 1, a, 0.35);
            }
            e.hero(HX, y, 'cast', 0.5);
            const b = bump(t, 0.46, 0.74);
            if (b > 0) {
                const th = R(2 + 5 * b);
                for (let i = 3; i >= 0; i--) {
                    const h = Math.max(1, R((th * (i + 1)) / 4));
                    P(e.c, TX + 6, y - 18 - Math.floor(h / 2), PAL.holy[i], HX - 10 - TX - 6, h);
                }
            }
            flash(e.c, bump(t, 0.46, 0.5) * 0.5, PAL.holy[1]);
        } },
    { id: 'awaken-thunder', name: '雷をまとう', note: '体のまわりで小さな稲妻がはじけ続け、ジグザグに一瞬で移動して斬る。', draw(e) {
            const t = e.t;
            e.bg(win(t, 0.06, 0.2) * 0.65 * (1 - win(t, 0.82, 0.92)));
            hitBoss(e, 0.6, 0.14, 4);
            const zig = [[HX, FY], [96, FY - 20], [80, FY], [62, FY - 10]];
            let x = HX, y = FY;
            if (t > 0.5 && t < 0.6) {
                const q = win(t, 0.5, 0.6) * 3, i = Math.min(2, Math.floor(q)), s = q - i;
                x = R(lerp(zig[i][0], zig[i + 1][0], s));
                y = R(lerp(zig[i][1], zig[i + 1][1], s));
            }
            else if (t >= 0.6 && t < 0.72) {
                x = 62;
                y = FY - 10 + R(win(t, 0.6, 0.66) * 10);
            }
            else if (t >= 0.72)
                x = R(lerp(62, HX, ease(win(t, 0.72, 0.88))));
            if (t > 0.5 && t < 0.62)
                for (let i = 0; i < 3; i++)
                    rampLine(e.c, zig[i][0], zig[i][1] - 14, zig[i + 1][0], zig[i + 1][1] - 14, PAL.bolt, 2, 1 - win(t, 0.58, 0.64));
            e.hero(x, y, t < 0.5 ? 'guard' : t < 0.72 ? 'attack' : 'idle', t < 0.5 ? 1 : win(t, 0.6, 0.7), { flip: !(t > 0.72 && t < 0.88) });
            if (t > 0.1 && t < 0.72) {
                const r = rng(Math.floor(e.f / 2));
                for (let i = 0; i < 3; i++) {
                    let px = x - 10 + r() * 20, py = y - 30 + r() * 26;
                    for (let j = 0; j < 3; j++) {
                        const nx = px + (r() - 0.5) * 8, ny = py + (r() - 0.5) * 8;
                        line(e.c, px, py, nx, ny, PAL.bolt[j % 2 ? 1 : 0]);
                        px = nx;
                        py = ny;
                    }
                }
            }
            flash(e.c, bump(t, 0.6, 0.64) * 0.5, PAL.bolt[1]);
            sparks(e.c, TX + 6, TY, win(t, 0.6, 0.74), 12, 20, PAL.bolt, 3);
        } },
    { id: 'awaken-giant', name: '大きな影', note: '冒険者の背後に、2倍の大きさの黒い影が立ち上がり、影がいっしょに拳をふるう。', draw(e) {
            const t = e.t;
            e.shake(bump(t, 0.6, 0.7) * 3);
            e.bg(win(t, 0.06, 0.2) * 0.5 * (1 - win(t, 0.82, 0.92)));
            hitBoss(e, 0.6, 0.14, 5);
            const a = win(t, 0.12, 0.36) * (1 - win(t, 0.72, 0.84));
            if (a > 0) {
                const img = heroSprite(e.L, t > 0.48 && t < 0.66 ? 'attack' : 'guard', t > 0.48 ? win(t, 0.48, 0.66) : 1, e.f, true);
                const s = tinted(img, '#3a1a5a', 'giant');
                e.c.save();
                e.c.translate(R(HX - 50), R(FY - 72 + (1 - ease(a)) * 20));
                e.c.scale(2, 2);
                drawDither(e.c, s, 0, 0, a);
                e.c.restore();
                if (e.f % 8 < 5) {
                    P(e.c, HX - 18, FY - 46, '#ff3b5a', 3, 2);
                    P(e.c, HX - 8, FY - 46, '#ff3b5a', 3, 2);
                }
            }
            e.hero(HX, FY, t > 0.48 && t < 0.66 ? 'attack' : 'guard', win(t, 0.48, 0.66));
            flash(e.c, bump(t, 0.6, 0.64) * 0.5);
            sparks(e.c, TX + 6, TY, win(t, 0.6, 0.76), 16, 24, PAL.shadow, 5);
        } },
    { id: 'awaken-dark', name: '闇の覚醒', note: '画面が暗く沈み、冒険者の目だけが赤く光る。紫の炎をまとい、闇の斬撃。', draw(e) {
            const t = e.t;
            e.bg(win(t, 0.06, 0.2) * 0.85 * (1 - win(t, 0.82, 0.92)));
            hitBoss(e, 0.62, 0.14, 4);
            const x = approach(t, 0.52, 0.6, 0.72, 0.88, 62);
            const au = win(t, 0.16, 0.3) * (1 - win(t, 0.74, 0.84));
            if (au > 0) {
                const r = rng(Math.floor(e.f / 2) + 2);
                for (let i = 0; i < 16; i++) {
                    const q = (e.f * 0.035 + r()) % 1;
                    P(e.c, x + (r() - 0.5) * 16, FY - q * 30, PAL.shadow[Math.min(3, Math.floor(q * 4))], 1, 2);
                }
            }
            e.hero(x, FY, t < 0.52 ? 'guard' : t < 0.6 ? 'dash' : t < 0.72 ? 'attack' : 'idle', t < 0.52 ? 1 : win(t, 0.6, 0.72), { flip: !(t > 0.72 && t < 0.88), tint: t > 0.2 && t < 0.52 ? '#24103e' : undefined });
            if (t > 0.2 && t < 0.52) {
                P(e.c, x - 5, FY - 20, '#ff3b5a', 2, 1);
                P(e.c, x + 1, FY - 20, '#ff3b5a', 2, 1);
            }
            const k = win(t, 0.6, 0.66), fade = 1 - win(t, 0.68, 0.78);
            if (k > 0 && fade > 0)
                band(e.c, x - 8, FY - 16, 12, 22, Math.PI + 2.6, lerp(Math.PI + 2.6, Math.PI - 1.2, ease(k)), PAL.shadow, fade);
        } },
    { id: 'awaken-gold', name: '金色の覚醒', note: '金色の光が放射状にあふれ、カットイン。光をまとって、まっすぐ一閃。', draw(e) {
            const t = e.t;
            e.bg(win(t, 0.06, 0.2) * 0.5 * (1 - win(t, 0.82, 0.92)));
            hitBoss(e, 0.64, 0.14, 5);
            const r0 = win(t, 0.08, 0.3) * (1 - win(t, 0.5, 0.6));
            if (r0 > 0)
                for (let i = 0; i < 16; i++) {
                    const a = (i / 16) * TAU + e.f * 0.01, L = 70 * r0;
                    line(e.c, HX, FY - 16, HX + Math.cos(a) * L, FY - 16 + Math.sin(a) * L, i % 2 ? PAL.gold[2] : PAL.gold[1], 1, 0.7 * r0);
                }
            cutin(e, win(t, 0.28, 0.5), PAL.gold[2]);
            let x = HX;
            if (t > 0.58 && t < 0.64)
                x = R(lerp(HX, 10, win(t, 0.58, 0.62)));
            else if (t >= 0.64 && t < 0.78)
                x = 10;
            else if (t >= 0.78)
                x = R(lerp(10, HX, ease(win(t, 0.78, 0.92))));
            if (!(t > 0.28 && t < 0.5))
                e.hero(x, FY, t < 0.58 ? 'guard' : t < 0.78 ? 'attack' : 'idle', 1, { flip: !(t > 0.62 && t < 0.92), tint: t > 0.2 && t < 0.58 && e.f % 4 < 2 ? PAL.gold[1] : undefined });
            const lk = bump(t, 0.6, 0.76);
            if (lk > 0)
                rampLine(e.c, 0, TY, W, TY, PAL.gold, R(1 + 5 * lk));
            flash(e.c, bump(t, 0.64, 0.68) * 0.6, PAL.gold[1]);
        } },
];
// ガード・回避・ジャンプ・必殺技は、全部の武器から選ぶ（よく使う近接 → 飛び道具 → 魔法の順）
const ALL_WEAPONS = ['sword', 'katana', 'dagger', 'scythe', 'spear', 'umbrella', 'axe', 'hammer', 'pan', 'shield', 'guitar', 'bow', 'blaster', 'wand', 'book', 'fan'];
export const CATEGORIES = [
    { id: 'slash', group: '通常攻撃', name: '斬る', lead: '剣・刀・短剣・大鎌', weapons: ['sword', 'katana', 'dagger', 'scythe'], patterns: SLASH },
    { id: 'thrust', group: '通常攻撃', name: '突く', lead: '槍・傘', weapons: ['spear', 'umbrella'], patterns: THRUST },
    { id: 'blunt', group: '通常攻撃', name: '叩く', lead: '斧・ハンマー・フライパン・盾・ギター', weapons: ['axe', 'hammer', 'pan', 'shield', 'guitar'], patterns: BLUNT },
    { id: 'shoot', group: '通常攻撃', name: '撃つ', lead: '弓・光線銃', weapons: ['bow', 'blaster'], patterns: SHOOT },
    { id: 'magic', group: '通常攻撃', name: '魔法', lead: '杖・魔導書・扇', weapons: ['wand', 'book', 'fan'], patterns: MAGIC },
    { id: 'guard', weapons: ALL_WEAPONS, group: '身のこなし', name: 'ガード', lead: 'ボスの攻撃を受け止める', patterns: GUARD },
    { id: 'evade', weapons: ALL_WEAPONS, group: '身のこなし', name: '回避', lead: 'ボスの攻撃をかわす', patterns: EVADE },
    { id: 'jump', weapons: ALL_WEAPONS, group: '身のこなし', name: 'ジャンプ', lead: '跳ぶ・着地する', patterns: JUMP },
    { id: 'ougi', weapons: ALL_WEAPONS, group: '必殺技', name: '奥義（跳躍）', lead: '高く跳んで、上から決める', patterns: OUGI },
    { id: 'rush', weapons: ALL_WEAPONS, group: '必殺技', name: '乱舞', lead: '息つく間もない連続攻撃', patterns: RUSH },
    { id: 'summon', weapons: ALL_WEAPONS, group: '必殺技', name: '召喚', lead: '大きな力を呼び出す', patterns: SUMMON },
    { id: 'parry', weapons: ALL_WEAPONS, group: '必殺技', name: '返し技', lead: 'ボスの攻撃をそのまま返す', patterns: PARRY },
    { id: 'seal', weapons: ALL_WEAPONS, group: '必殺技', name: '封印', lead: 'ボスを縛って動きを止める', patterns: SEAL },
    { id: 'awaken', weapons: ALL_WEAPONS, group: '必殺技', name: '覚醒', lead: '姿が変わるほどの力の解放', patterns: AWAKEN },
];
// ---------------------------------------------------------------- 1枚ずつ描く
export function render(c, p, timeSec, L) {
    const t = (timeSec % LOOP) / LOOP, f = Math.floor(timeSec * 30);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.imageSmoothingEnabled = false;
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    c.save();
    p.draw(makeEnv(c, t, f, L));
    c.restore();
}
// いまの描き方との比べ（なめらかな線とグラデーションを、2倍の画面に描く）
export function renderCompare(c, which, timeSec, L) {
    const t = (timeSec % LOOP) / LOOP, f = Math.floor(timeSec * 30);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.imageSmoothingEnabled = false;
    if (which === 'grid') {
        SLASH[0].draw(makeEnv(c, t, f, L));
        return;
    }
    // いまの版の見え方の再現: 2倍の画面に、キャラは2倍のドット、軌跡と光はなめらかな細い線とグラデーション
    c.scale(2, 2);
    const e2 = makeEnv(c, t, f, L);
    e2.bg();
    hitBoss(e2, 0.4);
    const x = approach(t, 0.1, 0.28, 0.6, 0.78);
    heroMove(e2, x, FY, t, 0.28, 0.5);
    c.save();
    c.imageSmoothingEnabled = true;
    const k = win(t, 0.33, 0.42), fade = 1 - win(t, 0.46, 0.58);
    if (k > 0 && fade > 0) {
        c.globalCompositeOperation = 'lighter';
        const cx = x - 10, cy = FY - 16, a0 = -2.2, a1 = lerp(-2.2, 1.3, ease(k));
        c.globalAlpha = 0.22 * fade;
        c.strokeStyle = '#7cf3ff';
        c.lineWidth = 6;
        c.beginPath();
        c.arc(cx, cy, 15, a0, a1);
        c.stroke();
        c.globalAlpha = 0.5 * fade;
        c.lineWidth = 2.5;
        c.beginPath();
        c.arc(cx, cy, 15, a0, a1);
        c.stroke();
        c.globalAlpha = 0.9 * fade;
        c.strokeStyle = '#ffffff';
        c.lineWidth = 0.6;
        c.beginPath();
        c.arc(cx, cy, 15, a0, a1);
        c.stroke();
    }
    const s = bump(t, 0.4, 0.52);
    if (s > 0) {
        const g = c.createRadialGradient(TX + 8, TY, 0, TX + 8, TY, 14 * s);
        g.addColorStop(0, 'rgba(255,255,255,0.9)');
        g.addColorStop(1, 'rgba(120,200,255,0)');
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = 1;
        c.fillStyle = g;
        c.beginPath();
        c.arc(TX + 8, TY, 14 * s, 0, TAU);
        c.fill();
    }
    c.restore();
}
// ---------------------------------------------------------------- 12人が同時に攻撃する画面
export const CW = 288, CH = 156, CFY = 118;
// 通常攻撃の案ごとの「当たる瞬間」（1回の中の割合）。12人画面で、当たる瞬間をそろえてからずらすために使う
export const HIT_AT = {
    'slash-crescent': 0.4, 'slash-iai': 0.55, 'slash-triple': 0.34, 'slash-afterimage': 0.36, 'slash-wave': 0.52, 'slash-heavy': 0.48,
    'thrust-lunge': 0.4, 'thrust-triple': 0.34, 'thrust-dive': 0.5, 'thrust-sweep': 0.42, 'thrust-charge': 0.44, 'thrust-throw': 0.46,
    'blunt-overhead': 0.42, 'blunt-quake': 0.5, 'blunt-spin': 0.38, 'blunt-leap': 0.5, 'blunt-upper': 0.42, 'blunt-homerun': 0.46,
    'shot-single': 0.44, 'shot-burst': 0.38, 'shot-rain': 0.5, 'shot-charge': 0.44, 'shot-pierce': 0.4, 'shot-spread': 0.42,
    'magic-fireball': 0.46, 'magic-thunder': 0.46, 'magic-ice': 0.4, 'magic-circle': 0.46, 'magic-wind': 0.46, 'magic-stars': 0.42,
};
export const hitTimeOf = (m) => (((m.delay + (HIT_AT[m.pattern.id] ?? 0.42)) % 1) + 1) % 1;
// 小さな数字（3x5 ドット）
const DIG = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001010010010', '111101111101111', '111101111001111'];
function digits(c, s, x, y, col, sc = 1) {
    const w = s.length * 4 * sc - sc, x0 = R(x - w / 2);
    const each = (ox, oy, cc) => [...s].forEach((ch, i) => { const g = DIG[+ch]; if (!g)
        return; for (let k = 0; k < 15; k++)
        if (g[k] === '1')
            P(c, x0 + i * 4 * sc + (k % 3) * sc + ox, R(y) + Math.floor(k / 3) * sc + oy, cc, sc, sc); });
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]])
        each(ox, oy, '#1a0a14');
    each(0, 0, col);
}
// 隊列: 右側に 4列 × 3段。あなたは前列のまんなか
export function crowdSlots() {
    const out = [];
    for (let row = 0; row < 3; row++)
        for (let col = 0; col < 4; col++)
            out.push({ x: 150 + col * 34 + (row % 2) * 12, y: CFY - 22 + row * 16 });
    return out;
}
let layer = null;
export function renderCrowd(c, members, timeSec, quietOthers) {
    const t = (timeSec % LOOP) / LOOP, f = Math.floor(timeSec * 30);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.imageSmoothingEnabled = false;
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    const keep = { W, H, FY, HX, TX, TY };
    W = CW;
    H = CH;
    FY = CFY;
    TX = 26;
    TY = CFY - 38;
    // 背景とボスは1回だけ（だれかの攻撃が当たっているあいだは、ボスが白く光る）
    const base = makeEnv(c, t, f, members[0].look);
    base.bg();
    const hitNow = members.some((m) => { const tt = t - m.delay; return tt > 0.4 && tt < 0.62; });
    base.boss({ hit: hitNow && f % 6 < 2, dx: hitNow ? -1 : 0 });
    if (!layer) {
        layer = document.createElement('canvas');
    }
    layer.width = CW;
    layer.height = CH;
    const lc = layer.getContext('2d');
    const order = members.slice().sort((a, b) => (a.slot.y - b.slot.y) || (a.mine ? 1 : 0) - (b.mine ? 1 : 0));
    for (const m of order) {
        const quiet = quietOthers && !m.mine;
        const ctx = quiet ? lc : c;
        if (quiet) {
            lc.setTransform(1, 0, 0, 1, 0, 0);
            lc.clearRect(0, 0, CW, CH);
            lc.imageSmoothingEnabled = false;
        }
        HX = m.slot.x;
        FY = m.slot.y;
        TY = m.slot.y - 34 + (m.slot.y - CFY) * 0.4;
        QUIET = quiet || !m.mine; // 画面全体の閃光・揺れ・カットインは、あなたの分だけ
        const tt = ((t - m.delay) % 1 + 1) % 1;
        const e = makeEnv(ctx, tt, f, m.look, c); // キャラはいつも本来の濃さで。控えめにするのはエフェクトだけ
        e.bg = () => { };
        e.boss = () => { };
        ctx.save();
        m.pattern.draw(e);
        ctx.restore();
        if (quiet) {
            c.globalAlpha = 0.6;
            c.drawImage(layer, 0, 0);
            c.globalAlpha = 1;
        }
    }
    QUIET = false;
    // ダメージの数字: 当たった瞬間にボスの前へ。少しずつ位置をずらし、上へ浮いて消える
    members.forEach((m, i) => {
        const age = (((t - hitTimeOf(m)) % 1) + 1) % 1;
        if (age >= 0.2)
            return;
        const crit = !!m.crit, sc = crit ? 2 : 1, x = TX + 4 + ((i * 13) % 34) - 8, y = TY - 26 + ((i * 7) % 22) - R(10 * ease(age / 0.2));
        if (age > 0.16 && f % 2)
            return; // 消えぎわはちらつかせる
        digits(c, String(m.dmg ?? 100), x, y - (age < 0.03 ? 2 : 0), crit ? '#ffe27a' : '#ffffff', sc);
    });
    ({ W, H, FY, HX, TX, TY } = keep);
}
// ================================================================ 描き直し（見劣りしていた案）
// 部品: 矢・光線・稲妻・炎の舌・羽・光輪・岩の拳・霊体（ふち取りした大きな分身）・不死鳥
// 色の段は、どれも「芯（白）→ 外側（暗い色）」の順
const WPAL = {
    blaster: ['#ffffff', '#d8ffd0', '#7ef06a', '#2fae4a', '#11602a'],
    wand: PAL.arc,
    book: ['#ffffff', '#fff1a8', '#ffc83a', '#e8682a', '#8a1a2a'],
    fan: ['#ffffff', '#ffd8ec', '#ff8ac0', '#d8407a', '#7a1a4a'],
    bow: ['#ffffff', '#fff6c8', '#ffe27a', '#c8a070', '#6a4a2a'],
};
const wpal = (w) => WPAL[w] ?? PAL.steel;
const FLAME = ['#ffffff', '#fff1a8', '#ffb43a', '#f0582a', '#8a1a2a'];
// 矢（ang の向きへ飛ぶ。x, y は矢じりの先）
function arrowSpr(c, x, y, ang, len = 11) {
    const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
    line(c, x - dx * len, y - dy * len, x - dx * 2, y - dy * 2, '#c8a070');
    line(c, x - dx * len + nx * 0.6, y - dy * len + ny * 0.6, x - dx * 3 + nx * 0.6, y - dy * 3 + ny * 0.6, '#8a5a2a');
    P(c, x, y, '#ffffff');
    P(c, x - dx, y - dy, '#d5dbe6');
    P(c, x - dx * 2 + nx, y - dy * 2 + ny, '#8790a6');
    P(c, x - dx * 2 - nx, y - dy * 2 - ny, '#8790a6');
    const fx = x - dx * len, fy = y - dy * len;
    for (let i = 0; i < 3; i++) {
        P(c, fx + dx * i + nx * 1.4, fy + dy * i + ny * 1.4, i ? '#e43b44' : '#ff8a9a');
        P(c, fx + dx * i - nx * 1.4, fy + dy * i - ny * 1.4, i ? '#a8203a' : '#e43b44');
    }
}
// まっすぐな光線（x0 → x1、太さ th）。縁がゆらぐ
function beamH(c, x0, x1, y, th, ramp, f) {
    const a = R(Math.min(x0, x1)), b = R(Math.max(x0, x1));
    for (let x = a; x <= b; x++) {
        const w = Math.max(1, th + Math.round(Math.sin(x * 0.7 + f * 0.9) * (th > 3 ? 1 : 0)));
        for (let i = ramp.length - 1; i >= 0; i--) {
            const h = Math.max(1, R((w * (i + 1)) / ramp.length));
            P(c, x, R(y) - Math.floor(h / 2), ramp[i], 1, h);
        }
    }
}
// 稲妻（枝分かれつき）
function bolt(c, x0, y0, x1, y1, ramp, seed, jag = 6, th = 3, branch = 0.3) {
    const r = rng(seed), d = Math.hypot(x1 - x0, y1 - y0) || 1, n = Math.max(3, R(d / 6));
    const nx = -(y1 - y0) / d, ny = (x1 - x0) / d;
    let px = x0, py = y0;
    for (let i = 1; i <= n; i++) {
        const k = i / n, off = i === n ? 0 : (r() - 0.5) * jag * 2;
        const x = lerp(x0, x1, k) + nx * off, y = lerp(y0, y1, k) + ny * off;
        rampLine(c, px, py, x, y, ramp, th);
        if (i < n && r() < branch) {
            const bx = x + (r() - 0.5) * 16, by = y + (r() - 0.2) * 10;
            rampLine(c, x, y, bx, by, ramp.slice(1), Math.max(1, th - 2));
        }
        px = x;
        py = y;
    }
}
// 炎の舌（根元 x, y から高さ h）
function tongue(c, x, y, h, w, ramp, seed, a = 1) {
    for (let i = 0; i < h; i++) {
        const k = i / h, ww = Math.max(1, R(w * (1 - k) * (0.75 + 0.25 * Math.sin(k * 5 + seed))));
        const sx = Math.sin(k * 4 + seed) * 1.2 * k;
        const col = ramp[Math.min(ramp.length - 1, 1 + Math.floor(k * (ramp.length - 1)))];
        rectD(c, x - ww / 2 + sx, y - i, ww, 1, col, a);
        if (ww >= 3 && k < 0.5)
            rectD(c, x - 0.5 + sx, y - i, 1, 1, ramp[0], a);
    }
}
// 体のまわりの炎（根元は足元、ちらちら揺れる）
function aura(c, x, y, k, ramp, f, size = 1) {
    if (k <= 0)
        return;
    for (let i = 0; i < 7; i++) {
        const ox = (i - 3) * 3.4 * size, h = (10 + 10 * Math.abs(Math.sin(f * 0.37 + i * 1.7)) + (i === 3 ? 6 : 0)) * k * size;
        tongue(c, x + ox, y, h, (4 + (i % 2)) * size, ramp, i + Math.floor(f / 3), Math.min(1, k * 1.5));
    }
    const r = rng(Math.floor(f / 2) + 77);
    for (let i = 0; i < 8; i++) {
        const q = (f * 0.03 + r()) % 1;
        P(c, x + (r() - 0.5) * 22 * size, y - 8 - q * 30 * size, ramp[1 + (i % 3)]);
    }
}
// 羽（背中の x, y から、左右へ広がる。k は開き具合）
function wings(c, x, y, k, ramp, f) {
    if (k <= 0)
        return;
    const flap = Math.sin(f * 0.22) * 0.1;
    for (const s of [-1, 1])
        for (let i = 6; i >= 0; i--) {
            const a = -Math.PI / 2 + s * (0.3 + i * 0.21 + flap), L = (22 - i * 1.7) * k;
            const ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L * 0.85;
            rampLine(c, x + s * 2, y, ex, ey, i % 2 ? ramp.slice(1) : ramp, i < 3 ? 3 : 2);
            P(c, ex, ey, '#ffffff');
        }
}
function halo(c, x, y, k, f) {
    if (k <= 0)
        return;
    ring(c, x, y, 7 * k, PAL.holy[3], 1, 1, 0.3);
    ring(c, x, y - 1, 7 * k, PAL.holy[1], 1, 1, 0.3);
    for (let i = 0; i < 4; i++) {
        const a = f * 0.12 + (i * TAU) / 4;
        P(c, x + Math.cos(a) * 7 * k, y - 1 + Math.sin(a) * 2, '#ffffff');
    }
}
// 霊体: 冒険者の姿を scale 倍にして、暗い体と明るいふちで描く（大きな分身・光の騎士）
function spirit(e, action, at, x, y, scale, body, rim, a = 1, eyes, tintA = 0.7) {
    // 本人の絵を scale 倍にして、色を重ねる（顔や武器の形は残る）。ふちは明るい色の1ドット（拡大後は scale ドット）
    const img = heroSprite(e.L, action, at, e.f, true);
    const rr = tinted(img, rim, 'sp-r' + rim);
    if (!spBuf) {
        spBuf = document.createElement('canvas');
        spBuf.width = 40;
        spBuf.height = 40;
    }
    const sx = spBuf.getContext('2d');
    sx.clearRect(0, 0, 40, 40);
    sx.imageSmoothingEnabled = false;
    sx.drawImage(img, 0, 0);
    sx.globalAlpha = tintAlpha(tintA);
    sx.drawImage(tinted(img, body, 'sp-b' + body), 0, 0);
    sx.globalAlpha = 1;
    const c = e.c;
    c.save();
    c.translate(R(x), R(y));
    c.scale(scale, scale);
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]])
        drawDither(c, rr, -20 + ox, -36 + oy, a);
    drawDither(c, spBuf, -20, -36, a);
    c.restore();
    if (eyes && a > 0.5 && e.f % 8 < 6) {
        P(c, R(x) - 6 * scale / 2 - 2, R(y) - 15 * scale, eyes, 3, 2);
        P(c, R(x) + 1, R(y) - 15 * scale, eyes, 3, 2);
    }
}
let spBuf = null;
const tintAlpha = (k) => Math.max(0, Math.min(1, k));
// 楕円の弧を、段のついた線で描く（旋風の軌跡など）
function arcE(c, cx, cy, rx, ry, a0, a1, ramp, th, a = 1) {
    const n = Math.max(6, R(Math.abs(a1 - a0) * Math.max(rx, ry) / 3));
    let px = cx + Math.cos(a0) * rx, py = cy + Math.sin(a0) * ry;
    for (let i = 1; i <= n; i++) {
        const t = a0 + ((a1 - a0) * i) / n, x = cx + Math.cos(t) * rx, y = cy + Math.sin(t) * ry;
        const w = Math.max(1, R(th * (i / n))); // 先ほど太く
        rampLine(c, px, py, x, y, w > 1 ? ramp : ramp.slice(Math.max(0, ramp.length - 2)), w, a);
        px = x;
        py = y;
    }
}
// 岩の拳（下から突き上げる。top が拳の上端）
function rockFist(c, x, top, bottom) {
    const D = '#2a2018', M = '#7a6a52', L2 = '#a8987a', H2 = '#d8c8a8', S = '#55462f';
    x = R(x);
    top = R(top);
    P(c, x - 9, top + 15, D, 18, bottom - top - 15);
    P(c, x - 12, top + 1, D, 24, 16);
    P(c, x - 14, top + 6, D, 6, 9);
    P(c, x - 8, top + 15, M, 16, bottom - top - 15);
    P(c, x - 8, top + 15, L2, 2, bottom - top - 15);
    P(c, x + 6, top + 15, S, 2, bottom - top - 15);
    P(c, x - 11, top + 3, M, 22, 13);
    P(c, x - 11, top + 3, L2, 2, 13);
    P(c, x + 9, top + 3, S, 2, 13);
    P(c, x - 11, top + 14, S, 22, 2);
    for (let i = 0; i < 4; i++) {
        const kx = x - 10 + i * 5;
        P(c, kx, top + 1, D, 6, 3);
        P(c, kx + 1, top + 1, M, 4, 3);
        P(c, kx + 1, top + 1, H2, 4, 1);
    }
    for (let i = 1; i < 4; i++)
        P(c, x - 11 + i * 5, top + 3, D, 1, 7);
    P(c, x - 13, top + 7, M, 4, 7);
    P(c, x - 13, top + 7, L2, 4, 1);
    P(c, x - 10, top + 8, D, 1, 5);
    line(c, x + 2, top + 18, x - 1, top + 24, D);
    line(c, x - 1, top + 24, x + 1, top + 30, D);
    line(c, x - 4, top + 6, x - 6, top + 11, S);
    for (let i = 0; i < 3; i++)
        P(c, x - 7 + i * 6, top + 20 + i * 5, '#ff9a3a');
}
// 不死鳥（左へ飛ぶ。x, y は頭）
function phoenix(c, x, y, f, s = 1) {
    const fl = Math.sin(f * 0.55);
    for (let i = 0; i < 3; i++)
        for (let j = 0; j < 16 * s; j++)
            P(c, x + 6 + j, y + 1 + (i - 1) * 2.5 + Math.sin(j * 0.45 + f * 0.4 + i) * 1.5, FLAME[Math.min(4, 1 + Math.floor(j / (4 * s)))]);
    for (const side of [-1, 1])
        for (let i = 4; i >= 0; i--) {
            const a = side * (Math.PI / 2 - 0.25 - i * 0.24) - side * fl * 0.35, L = (15 - i * 2) * s;
            rampLine(c, x + 5, y, x + 5 + Math.cos(a) * L * 0.8 + i * 1.5, y + Math.sin(a) * L, FLAME.slice(i % 2), i < 2 ? 3 : 2);
        }
    orb(c, x + 4, y + 1, 3.5 * s, FLAME);
    P(c, x - 1, y - 2, '#fff1a8', 4, 3);
    P(c, x - 3, y - 1, '#ffc83a', 2, 1);
    P(c, x, y - 1, '#8a1a2a');
    for (let i = 0; i < 3; i++)
        P(c, x + 1 + i, y - 4 - i, FLAME[1 + i]);
}
// 当たった所のはじけ（白い芯 → 色の輪 → 火花）
function burstAt(c, x, y, k, ramp, size = 1, seed = 1) {
    if (k <= 0 || k >= 1)
        return;
    if (k < 0.3)
        orb(c, x, y, (2 + 5 * size) * (1 - k / 0.3) + 1, ramp);
    if (k < 0.55)
        ring(c, x, y, R(3 + 12 * size * ease(k)), ramp[1], k < 0.3 ? 2 : 1, 1);
    sparks(c, x, y, k, R(8 * size), 10 * size + 4, ramp, seed);
}
const HQ = {
    // ---------- 撃つ ----------
    'shot-burst'(e) {
        const t = e.t;
        e.bg();
        const rel = [0.3, 0.37, 0.44], hit = rel.map((r) => r + 0.08);
        const last = hit.filter((h) => t >= h).pop();
        e.boss({ hit: last !== undefined && t - last < 0.035, dx: last !== undefined && t - last < 0.05 ? -1 : 0 });
        const rec = rel.some((r) => t > r && t < r + 0.03) ? 1 : 0;
        const act = t > 0.16 && t < 0.56 ? 'cast' : 'idle';
        e.hero(HX + rec, FY, act, 0.5);
        const m = e.muzzle(HX + rec, FY, 'cast', 0.5);
        rel.forEach((r0, i) => {
            const tx = TX + 6, ty = TY - 5 + i * 5, k = win(t, r0, hit[i]);
            const ang = Math.atan2(ty - m.y, tx - m.x);
            if (t > r0 - 0.08 && t < r0)
                arrowSpr(e.c, m.x - 1, m.y, ang, 9); // つがえた矢
            if (k > 0 && k < 1) {
                const x = lerp(m.x, tx, k), y = lerp(m.y, ty, k);
                for (let j = 1; j < 5; j++)
                    rectD(e.c, x - Math.cos(ang) * (8 + j * 3), y - Math.sin(ang) * (8 + j * 3), 2, 1, '#fff6c8', 0.7 - j * 0.15);
                arrowSpr(e.c, x, y, ang);
            }
            if (t >= hit[i] && t < hit[i] + 0.12)
                arrowSpr(e.c, tx + 3, ty, ang, 7); // 刺さった矢（先は体の中）
            ringK(e.c, m.x, m.y, R(2 + 5 * win(t, r0, r0 + 0.05)), '#ffffff', 1, 1 - win(t, r0, r0 + 0.05), 1.3);
            burstAt(e.c, tx, ty, win(t, hit[i], hit[i] + 0.12), PAL.gold, 0.6, 3 + i);
        });
    },
    'shot-charge'(e) {
        const t = e.t, G = wpal('blaster');
        e.shake(t > 0.42 && t < 0.62 ? 1 : 0);
        e.bg(win(t, 0.1, 0.3) * 0.35 * (1 - win(t, 0.66, 0.8)));
        e.boss({ hit: t > 0.44 && t < 0.62 && e.f % 4 < 2, dx: t > 0.44 && t < 0.64 ? -2 : 0 });
        const fire = t > 0.42 && t < 0.64, rx = fire ? 2 : 0;
        e.hero(HX + rx, FY, t > 0.08 && t < 0.7 ? 'cast' : 'idle', 0.5);
        const m = e.muzzle(HX + rx, FY, 'cast', 0.5);
        const g = win(t, 0.1, 0.42);
        if (t < 0.44 && g > 0) {
            const r = rng(Math.floor(e.f / 2));
            for (let i = 0; i < 8; i++) {
                const a = r() * TAU, d = 18 * (1 - ((e.f * 0.06 + i / 8) % 1));
                line(e.c, m.x + Math.cos(a) * d, m.y + Math.sin(a) * d * 0.7, m.x + Math.cos(a) * (d + 3), m.y + Math.sin(a) * (d + 3) * 0.7, G[1 + (i % 2)]);
            }
            orb(e.c, m.x, m.y, 1 + 5 * g + (e.f % 6 < 3 ? 1 : 0), G);
            ringK(e.c, m.x, m.y, R(10 * (1 - ((e.f * 0.05) % 1))), G[2], 1, 0.6, 0.8);
        }
        const b = bump(t, 0.42, 0.66);
        if (b > 0) {
            const th = R(2 + 7 * b);
            beamH(e.c, TX + 4, m.x, m.y, th, G, e.f);
            orb(e.c, m.x, m.y, 2 + th / 2, G);
            orb(e.c, TX + 4, m.y, 3 + th / 2, G);
            sparks(e.c, TX + 4, m.y, (e.f % 6) / 6, 6, 12, G, e.f, 2.2, Math.PI);
            for (let i = 0; i < 5; i++) {
                const x = TX + 8 + ((e.f * 5 + i * 17) % Math.max(1, m.x - TX - 10));
                P(e.c, x, m.y - th / 2 - 1 - (i % 2), G[1]);
            }
        }
        const sm = win(t, 0.64, 0.86);
        if (sm > 0 && sm < 1)
            for (let i = 0; i < 3; i++)
                disc(e.c, m.x - 1 + i, m.y - 3 - sm * 10 - i * 3, 1.5 + sm * 2, '#9a9cb0', (1 - sm) * 0.8);
    },
    'shot-spread'(e) {
        const t = e.t, G = wpal('blaster');
        e.bg();
        const fireT = 0.32, hits = [0.42, 0.43, 0.44, 0.45, 0.46];
        e.boss({ hit: t > 0.42 && t < 0.5 && e.f % 4 < 2, dx: t > 0.42 && t < 0.52 ? -2 : 0 });
        const rec = t > fireT && t < fireT + 0.05 ? 2 : 0;
        e.hero(HX + rec, FY, t > 0.14 && t < 0.56 ? 'cast' : 'idle', 0.5);
        const m = e.muzzle(HX + rec, FY, 'cast', 0.5);
        if (t > fireT - 0.12 && t < fireT)
            orb(e.c, m.x, m.y, 1 + 2 * win(t, fireT - 0.12, fireT), G);
        const fk = win(t, fireT, fireT + 0.05);
        if (fk > 0 && fk < 1)
            for (let i = 0; i < 5; i++) {
                const a = Math.PI + (i - 2) * 0.35;
                line(e.c, m.x + Math.cos(a) * 2, m.y + Math.sin(a) * 2, m.x + Math.cos(a) * (3 + 7 * fk), m.y + Math.sin(a) * (3 + 7 * fk), G[i % 2 ? 1 : 0]);
            }
        hits.forEach((h, i) => {
            const tx = TX + 4 + (i % 2) * 3, ty = TY - 14 + i * 7, k = win(t, fireT, h);
            if (k > 0 && k < 1) {
                const x = lerp(m.x, tx, k), y = lerp(m.y, ty, k) + Math.sin(k * Math.PI) * (i - 2) * 3;
                for (let j = 1; j < 5; j++)
                    P(e.c, x + j * 3, y - ((i - 2) * j * 0.6), G[Math.min(4, j)]);
                orb(e.c, x, y, 2, G);
            }
            burstAt(e.c, tx, ty, win(t, h, h + 0.1), G, 0.5, 20 + i);
        });
    },
    // ---------- 魔法 ----------
    'magic-circle'(e) {
        const t = e.t, A = PAL.arc;
        e.bg(win(t, 0.06, 0.2) * 0.25 * (1 - win(t, 0.62, 0.74)));
        const hits = [0.46, 0.51, 0.56];
        const last = hits.filter((h) => t >= h).pop();
        e.boss({ hit: last !== undefined && t - last < 0.035, dx: last !== undefined && t - last < 0.05 ? -1 : 0 });
        const c = win(t, 0.06, 0.2) * (1 - win(t, 0.6, 0.72));
        if (c > 0) {
            ring(e.c, HX, FY, 18 * c, A[2], 1, c, 0.28);
            ring(e.c, HX, FY, 13 * c, A[3], 1, c, 0.28);
            for (let i = 0; i < 8; i++) {
                const a = e.f * 0.04 + (i / 8) * TAU, x = HX + Math.cos(a) * 15.5 * c, y = FY + Math.sin(a) * 4.3 * c;
                P(e.c, x, y, A[1]);
                if (i % 2)
                    P(e.c, x, y - 1, A[0]);
            }
            const r = rng(Math.floor(e.f / 3));
            for (let i = 0; i < 5; i++)
                P(e.c, HX + (r() - 0.5) * 30 * c, FY - 2 - r() * 18, A[1 + (i % 2)]);
        }
        e.hero(HX, FY, t > 0.06 && t < 0.62 ? 'cast' : 'idle', 0.5);
        const m = e.muzzle(HX, FY, 'cast', 0.5);
        if (t > 0.16 && t < 0.4) {
            orb(e.c, m.x, m.y, 2 + (e.f % 4 < 2 ? 1 : 0), A);
            star(e.c, m.x, m.y, 2 + (e.f % 6 < 3 ? 1 : 0));
        }
        hits.forEach((h, i) => {
            const s0 = 0.28 + i * 0.05, k = win(t, s0, h);
            if (k > 0 && k < 1) {
                const sy = (i - 1) * 26, cx = lerp(m.x, TX + 6, 0.5), cy = m.y - 10 + sy;
                const q = (kk) => ({ x: (1 - kk) ** 2 * m.x + 2 * (1 - kk) * kk * cx + kk * kk * (TX + 6), y: (1 - kk) ** 2 * m.y + 2 * (1 - kk) * kk * cy + kk * kk * (TY - 6 + i * 6) });
                for (let j = 1; j < 6; j++) {
                    const p = q(Math.max(0, k - j * 0.04));
                    P(e.c, p.x, p.y, A[Math.min(4, j)]);
                    if (j === 3)
                        star(e.c, p.x, p.y, 1, A[1]);
                }
                const p = q(k);
                orb(e.c, p.x, p.y, 3, A);
                P(e.c, p.x - 1, p.y - 1, '#ffffff');
            }
            burstAt(e.c, TX + 6, TY - 6 + i * 6, win(t, h, h + 0.12), A, 0.7, 30 + i);
        });
    },
    'magic-wind'(e) {
        const t = e.t, Lf = PAL.leaf, Wd = ['#ffffff', '#e8fff0', '#a8f0b8', '#4ac07a'];
        e.bg();
        const hits = [0.46, 0.5, 0.54];
        const last = hits.filter((h) => t >= h).pop();
        e.boss({ hit: last !== undefined && t - last < 0.035, dx: last !== undefined && t - last < 0.06 ? -2 : 0 });
        e.hero(HX, FY, t > 0.14 && t < 0.44 ? 'attack' : 'idle', win(t, 0.14, 0.44));
        const m = e.muzzle(HX, FY, 'attack', 0.5);
        hits.forEach((h, i) => {
            const s0 = 0.3 + i * 0.04, k = win(t, s0, h);
            if (k > 0 && k < 1) {
                const x = lerp(m.x, TX + 8, k), y = lerp(m.y, TY - 8 + i * 8, k) + Math.sin(k * 9 + i) * 2;
                for (let j = 0; j < 3; j++)
                    line(e.c, x + 10 + j * 4, y - 4 + j * 4, x + 16 + j * 5, y - 4 + j * 4, Wd[2], 1, 0.8);
                band(e.c, x + 8, y, 7, 11, Math.PI - 1.1, Math.PI + 1.1, Wd, 1, 1.3, false);
            }
            const sk = win(t, h, h + 0.1), fade = 1 - win(t, h + 0.06, h + 0.16);
            if (sk > 0 && fade > 0)
                rampLine(e.c, TX + 14, TY - 16 + i * 8, lerp(TX + 14, TX - 4, sk), lerp(TY - 16 + i * 8, TY - 2 + i * 8, sk), Wd, 2, fade);
        });
        const r = rng(14);
        for (let i = 0; i < 10; i++) {
            const k = win(t, 0.3 + r() * 0.12, 0.62 + r() * 0.12);
            if (k <= 0 || k >= 1)
                continue;
            const x = lerp(m.x, TX - 6, k) + Math.sin(k * 12 + i) * 6, y = TY - 14 + r() * 28 + Math.cos(k * 10) * 4;
            P(e.c, x, y, Lf[1 + (i % 2)], 2, 1);
            P(e.c, x + 1, y + 1, Lf[3]);
        }
    },
    'magic-thunder'(e) {
        const t = e.t, B = PAL.bolt;
        const hitT = 0.46;
        e.shake(bump(t, hitT, hitT + 0.08) * 2);
        e.bg(bump(t, 0.24, hitT + 0.1) * 0.5);
        hitBoss(e, hitT, 0.12, 1);
        e.hero(HX, FY, t > 0.08 && t < 0.58 ? 'cast' : 'idle', 0.5);
        const m = e.muzzle(HX, FY, 'cast', 0.5);
        if (t > 0.1 && t < hitT) {
            const r = rng(Math.floor(e.f / 3));
            for (let i = 0; i < 6; i++) {
                const q = (e.f * 0.05 + i / 6) % 1;
                P(e.c, m.x + (r() - 0.5) * 8, m.y - 2 - q * 14, B[1 + (i % 2)]);
            }
            star(e.c, m.x, m.y - 2, [1, 2, 3, 2][Math.floor(e.f / 2) % 4], B[1]);
        }
        // 雷雲
        const cl = win(t, 0.18, 0.34) * (1 - win(t, 0.62, 0.74));
        if (cl > 0)
            for (let i = 0; i < 6; i++)
                disc(e.c, TX - 10 + i * 8, 4 + (i % 2) * 2, 6 + (i % 3), i % 2 ? '#2a2440' : '#3a3458', cl);
        const b = bump(t, hitT - 0.01, hitT + 0.1);
        if (b > 0) {
            bolt(e.c, TX + 4, 6, TX + 4, FY - 4, B, Math.floor(e.f / 2), 7, 4, 0.35);
            bolt(e.c, TX - 6, 8, TX + 2, TY, B.slice(1), Math.floor(e.f / 2) + 9, 5, 2, 0.2);
        }
        flash(e.c, bump(t, hitT, hitT + 0.04) * 0.6, B[1]);
        if (t > hitT) {
            disc(e.c, TX + 4, FY + 1, 10 * (1 - win(t, 0.8, 0.95)), '#05030c', 0.85, 0.25);
            for (let i = 0; i < 4; i++)
                disc(e.c, TX + 4 + (i - 1.5) * 5, FY - 6 - win(t, hitT, 0.9) * 18 - i * 2, 2 + win(t, hitT, 0.9) * 3, '#5a5470', 0.6 * (1 - win(t, 0.7, 0.95)));
        }
        sparks(e.c, TX + 4, FY - 4, win(t, hitT, hitT + 0.14), 12, 16, B, 5, Math.PI, -Math.PI / 2);
    },
    // ---------- 覚醒 ----------
    'awaken-halo'(e) {
        const t = e.t, Hy = PAL.holy;
        e.shake(t > 0.5 && t < 0.72 ? 1 : 0);
        e.bg(win(t, 0.04, 0.2) * 0.6 * (1 - win(t, 0.82, 0.94)));
        e.boss({ hit: t > 0.52 && t < 0.72 && e.f % 4 < 2, dx: t > 0.52 && t < 0.74 ? -2 : 0 });
        const up = R(8 * ease(win(t, 0.06, 0.3)) * (1 - win(t, 0.78, 0.92))), y = FY - up;
        const wk = ease(win(t, 0.1, 0.3)) * (1 - win(t, 0.76, 0.9));
        wings(e.c, HX + 3, y - 16, wk, Hy, e.f);
        // 光の柱が降りてくる
        const pk = bump(t, 0.04, 0.3);
        if (pk > 0) {
            for (let i = 0; i < 3; i++)
                rectD(e.c, HX - 6 + i * 3, 0, 6 - i * 2 + 6, y - 10, Hy[2 - i], pk * 0.5);
        }
        e.hero(HX, y, t > 0.3 && t < 0.76 ? 'cast' : 'victory', 0.25);
        halo(e.c, HX, y - 30, wk, e.f);
        const m = e.muzzle(HX, y, 'cast', 0.5);
        const r = rng(Math.floor(e.f / 4));
        for (let i = 0; i < 6; i++) {
            const q = (e.f * 0.015 + i / 6) % 1;
            if (wk <= 0)
                break;
            const fx = HX - 14 + r() * 28, fy = y - 30 + q * 40;
            P(e.c, fx, fy, '#ffffff', 2, 1);
            P(e.c, fx + 1, fy + 1, Hy[2]);
        }
        if (t > 0.34 && t < 0.5) {
            const g = win(t, 0.34, 0.5);
            orb(e.c, m.x, m.y, 1 + 5 * g, Hy);
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * TAU + e.f * 0.2, d = 12 * (1 - g);
                P(e.c, m.x + Math.cos(a) * d, m.y + Math.sin(a) * d, Hy[1]);
            }
        }
        const b = bump(t, 0.48, 0.76);
        if (b > 0) {
            const th = R(3 + 8 * b);
            beamH(e.c, TX + 2, m.x, m.y, th, Hy, e.f);
            orb(e.c, m.x, m.y, 3 + th / 2, Hy);
            orb(e.c, TX + 4, m.y, 4 + th / 2, Hy);
            for (let i = 0; i < 4; i++) {
                const x = TX + 10 + ((e.f * 4 + i * 23) % Math.max(1, m.x - TX - 14));
                star(e.c, x, m.y - th / 2 - 2, 1, '#ffffff');
            }
            sparks(e.c, TX + 4, m.y, (e.f % 6) / 6, 8, 16, Hy, e.f, 2.4, Math.PI);
        }
        flash(e.c, bump(t, 0.48, 0.52) * 0.5, Hy[1]);
    },
    'awaken-flame'(e) {
        const t = e.t;
        e.shake(bump(t, 0.6, 0.7) * 2);
        e.bg(win(t, 0.04, 0.18) * 0.55 * (1 - win(t, 0.82, 0.92)));
        hitBoss(e, 0.6, 0.14, 4);
        const x = approach(t, 0.5, 0.58, 0.72, 0.88, 60);
        const ak = win(t, 0.06, 0.24) * (1 - win(t, 0.76, 0.86));
        if (t > 0.5 && t < 0.6)
            for (let i = 0; i < 5; i++)
                tongue(e.c, lerp(HX, x, i / 5) + 4, FY, 10 - i, 4, FLAME, i + e.f, 0.9);
        aura(e.c, x, FY, ak, FLAME, e.f);
        e.hero(x, FY, t < 0.5 ? 'guard' : t < 0.58 ? 'dash' : t < 0.72 ? 'attack' : 'idle', t < 0.5 ? 1 : win(t, 0.58, 0.7), { flip: !(t > 0.72 && t < 0.88) });
        if (t > 0.2 && t < 0.58 && e.f % 6 < 4) {
            P(e.c, x - 5, FY - 20, '#ffffff', 2, 1);
            P(e.c, x, FY - 20, '#ffffff', 2, 1);
        }
        const k = win(t, 0.58, 0.64), fade = 1 - win(t, 0.67, 0.78);
        if (k > 0 && fade > 0)
            band(e.c, x - 6, FY - 16, 14, 24, Math.PI + 2.5, lerp(Math.PI + 2.5, Math.PI - 1.3, ease(k)), FLAME, fade);
        const bk = win(t, 0.6, 0.82);
        if (bk > 0 && bk < 1) {
            for (let i = 0; i < 4; i++)
                disc(e.c, TX + 4, TY, (5 + 14 * ease(bk)) * (1 - i * 0.22), FLAME[i + 1], 1 - bk * 0.8);
            debris(e.c, TX + 4, TY, bk, 16, 30, FLAME, 9);
        }
        flash(e.c, bump(t, 0.6, 0.64) * 0.5, FLAME[1]);
    },
    'awaken-thunder'(e) {
        const t = e.t, B = PAL.bolt;
        e.shake(bump(t, 0.62, 0.72) * 2);
        e.bg(win(t, 0.04, 0.18) * 0.7 * (1 - win(t, 0.82, 0.92)));
        hitBoss(e, 0.62, 0.14, 4);
        const zig = [[HX, FY], [96, FY - 18], [80, FY - 2], [62, FY - 10]];
        let x = HX, y = FY;
        if (t > 0.5 && t < 0.6) {
            const q = win(t, 0.5, 0.6) * 3, i = Math.min(2, Math.floor(q)), s = q - i;
            x = R(lerp(zig[i][0], zig[i + 1][0], s));
            y = R(lerp(zig[i][1], zig[i + 1][1], s));
        }
        else if (t >= 0.6 && t < 0.72) {
            x = 62;
            y = FY - 10 + R(win(t, 0.6, 0.66) * 10);
        }
        else if (t >= 0.72)
            x = R(lerp(62, HX, ease(win(t, 0.72, 0.88))));
        // 空から体へ雷が落ちて、まとう
        const sk = bump(t, 0.2, 0.3);
        if (sk > 0)
            bolt(e.c, HX - 2, -2, HX, FY - 22, B, Math.floor(e.f / 2), 5, 4, 0.3);
        if (t > 0.5 && t < 0.64)
            for (let i = 0; i < 3; i++) {
                bolt(e.c, zig[i][0], zig[i][1] - 14, zig[i + 1][0], zig[i + 1][1] - 14, B, i * 7 + Math.floor(e.f / 2), 3, 3, 0.15);
                e.ghost(zig[i + 1][0], zig[i + 1][1], B[2], 0.5 * (1 - win(t, 0.56, 0.66)), 'dash');
            }
        e.hero(x, y, t < 0.5 ? 'guard' : t < 0.72 ? 'attack' : 'idle', t < 0.5 ? 1 : win(t, 0.6, 0.7), { flip: !(t > 0.72 && t < 0.88), tint: t > 0.28 && t < 0.5 && e.f % 4 < 1 ? '#fff6a0' : undefined });
        if (t > 0.26 && t < 0.72) {
            const r = rng(Math.floor(e.f / 2));
            for (let i = 0; i < 3; i++) {
                const a = r() * TAU, d = 8 + r() * 6;
                bolt(e.c, x + Math.cos(a) * 4, y - 14 + Math.sin(a) * 6, x + Math.cos(a) * d, y - 14 + Math.sin(a) * d, B.slice(0, 3), i + Math.floor(e.f / 2), 2, 1, 0);
            }
        }
        const hb = bump(t, 0.61, 0.7);
        if (hb > 0)
            bolt(e.c, TX + 6, -2, TX + 6, FY - 2, B, Math.floor(e.f / 2) + 31, 6, 5, 0.4);
        flash(e.c, bump(t, 0.24, 0.28) * 0.4, B[1]);
        flash(e.c, bump(t, 0.62, 0.66) * 0.6, B[1]);
        burstAt(e.c, TX + 6, TY, win(t, 0.62, 0.78), B, 1.2, 4);
    },
    'awaken-giant'(e) {
        const t = e.t;
        e.shake(bump(t, 0.6, 0.72) * 3);
        e.bg(win(t, 0.04, 0.2) * 0.6 * (1 - win(t, 0.82, 0.92)));
        hitBoss(e, 0.6, 0.14, 5);
        const a = ease(win(t, 0.1, 0.34)) * (1 - win(t, 0.74, 0.86));
        if (a > 0) {
            const sy = FY + 2 + R((1 - a) * 30);
            const atk = t > 0.48 && t < 0.68;
            spirit(e, atk ? 'attack' : 'guard', atk ? win(t, 0.48, 0.66) : 1, HX - 22, sy, 2, '#1a0830', '#b878ff', Math.min(1, a * 1.4), '#ff3b5a', 0.78);
            const r = rng(Math.floor(e.f / 3));
            for (let i = 0; i < 8; i++) {
                const q = (e.f * 0.02 + i / 8) % 1;
                P(e.c, HX - 40 + r() * 40, sy - q * 70, PAL.shadow[i % 3]);
            }
        }
        e.hero(HX, FY, t > 0.48 && t < 0.66 ? 'attack' : 'guard', win(t, 0.48, 0.66));
        const k = win(t, 0.54, 0.6), fade = 1 - win(t, 0.64, 0.76);
        if (k > 0 && fade > 0)
            band(e.c, HX - 50, FY - 40, 22, 36, Math.PI + 2.4, lerp(Math.PI + 2.4, Math.PI - 0.9, ease(k)), PAL.shadow, fade, 1);
        flash(e.c, bump(t, 0.6, 0.64) * 0.5, PAL.shadow[0]);
        const g = win(t, 0.6, 0.78);
        ringK(e.c, TX + 6, FY - 1, R(6 + 36 * ease(g)), PAL.shadow[1], 2, 1 - g, 0.25);
        debris(e.c, TX + 6, TY, win(t, 0.6, 0.86), 18, 34, PAL.shadow, 5);
    },
    'awaken-dark'(e) {
        const t = e.t, S = PAL.shadow, DF = ['#f0d0ff', '#c87aff', '#7a3ad8', '#3a1a7a', '#14082a'];
        e.bg(win(t, 0.04, 0.18) * 0.85 * (1 - win(t, 0.82, 0.92)));
        hitBoss(e, 0.62, 0.14, 4);
        const x = approach(t, 0.52, 0.6, 0.72, 0.88, 60);
        const ak = win(t, 0.12, 0.3) * (1 - win(t, 0.74, 0.84));
        aura(e.c, x, FY, ak, ['#ffffff', '#f0d0ff', '#c87aff', '#7a3ad8', '#3a1a7a'], e.f, 1.3);
        if (t > 0.52 && t < 0.62)
            for (let i = 1; i <= 3; i++)
                e.ghost(lerp(HX, x, 1 - i * 0.25), FY, S[2], 0.6 - i * 0.15, 'dash');
        const dark = t > 0.16 && t < 0.52;
        e.hero(x, FY, t < 0.52 ? 'guard' : t < 0.6 ? 'dash' : t < 0.72 ? 'attack' : 'idle', t < 0.52 ? 1 : win(t, 0.6, 0.72), { flip: !(t > 0.72 && t < 0.88), tint: dark ? '#1a0a2e' : undefined });
        if (dark) {
            P(e.c, x - 6, FY - 20, '#ff3b5a', 2, 1);
            P(e.c, x - 1, FY - 20, '#ff3b5a', 2, 1);
            if (e.f % 8 < 4) {
                P(e.c, x - 8, FY - 20, '#ff3b5a');
                P(e.c, x + 1, FY - 20, '#ff3b5a');
            }
        }
        const k = win(t, 0.6, 0.66), fade = 1 - win(t, 0.69, 0.8);
        if (k > 0 && fade > 0) {
            band(e.c, x - 8, FY - 16, 14, 26, Math.PI + 2.7, lerp(Math.PI + 2.7, Math.PI - 1.3, ease(k)), DF, fade);
            band(e.c, x - 8, FY - 16, 10, 14, Math.PI + 2.7, lerp(Math.PI + 2.7, Math.PI - 1.3, ease(k)), ['#14082a', '#05030c'], fade);
        }
        const bk = win(t, 0.62, 0.86);
        if (bk > 0 && bk < 1) {
            for (let i = 0; i < 10; i++) {
                const a = (i / 10) * TAU, d = 6 + 18 * ease(bk);
                rampLine(e.c, TX + 4 + Math.cos(a) * d * 0.4, TY + Math.sin(a) * d * 0.4, TX + 4 + Math.cos(a) * d, TY + Math.sin(a) * d, DF.slice(1), 2, 1 - bk);
            }
        }
    },
    'awaken-gold'(e) {
        const t = e.t, Gd = PAL.gold;
        e.shake(bump(t, 0.62, 0.72) * 2);
        e.bg(win(t, 0.04, 0.18) * 0.55 * (1 - win(t, 0.82, 0.92)));
        hitBoss(e, 0.64, 0.14, 5);
        const r0 = win(t, 0.06, 0.24) * (1 - win(t, 0.3, 0.36));
        if (r0 > 0)
            for (let i = 0; i < 16; i++) {
                const a = (i / 16) * TAU + e.f * 0.01, L0 = 10 + 50 * r0;
                rampLine(e.c, HX + Math.cos(a) * 8, FY - 16 + Math.sin(a) * 8, HX + Math.cos(a) * L0, FY - 16 + Math.sin(a) * L0, i % 2 ? Gd.slice(1) : Gd, i % 2 ? 1 : 2, r0);
            }
        // カットイン: 帯の中に、冒険者を3倍で
        const ck = win(t, 0.3, 0.52);
        if (ck > 0 && ck < 1 && !QUIET) {
            const inK = ease(win(ck, 0, 0.25)), out = 1 - win(ck, 0.78, 1), h = R(34 * inK * out);
            if (h > 2) {
                const y0 = R(H / 2 - 4 - h / 2);
                P(e.c, 0, y0, '#1a1006', W, h);
                P(e.c, 0, y0, Gd[2], W, 2);
                P(e.c, 0, y0 + h - 2, Gd[2], W, 2);
                P(e.c, 0, y0 + 2, Gd[3], W, 1);
                P(e.c, 0, y0 + h - 3, Gd[3], W, 1);
                for (let i = 0; i < 8; i++) {
                    const yy = y0 + 4 + ((i * 7) % Math.max(1, h - 8)), xx = ((i * 41 - e.f * 7) % (W + 40) + W + 40) % (W + 40) - 20;
                    P(e.c, xx, yy, Gd[1 + (i % 2)], 16 + (i % 3) * 6, 1);
                }
                const img = heroSprite(e.L, 'attack', 0.5, e.f, true);
                e.c.save();
                e.c.beginPath();
                e.c.rect(0, y0 + 2, W, Math.max(0, h - 4));
                e.c.clip();
                const s = 3, hx = R(lerp(W + 20, W / 2 + 10, inK)) - 20 * s;
                e.c.drawImage(tinted(img, Gd[1], 'cut-rim'), hx - 2, R(y0 + h / 2 - 22 * s), 40 * s, 40 * s);
                e.c.drawImage(img, hx, R(y0 + h / 2 - 22 * s), 40 * s, 40 * s);
                e.c.restore();
            }
        }
        let x = HX;
        if (t > 0.58 && t < 0.62)
            x = R(lerp(HX, 8, win(t, 0.58, 0.62)));
        else if (t >= 0.62 && t < 0.78)
            x = 8;
        else if (t >= 0.78)
            x = R(lerp(8, HX, ease(win(t, 0.78, 0.92))));
        if (t > 0.58 && t < 0.66)
            for (let i = 1; i <= 4; i++)
                e.ghost(lerp(HX, 8, Math.max(0, win(t, 0.58, 0.62) - i * 0.18)), FY, Gd[2], 0.7 - i * 0.14, 'dash');
        if (!(ck > 0 && ck < 1))
            e.hero(x, FY, t < 0.58 ? 'guard' : t < 0.78 ? 'attack' : 'idle', 1, { flip: !(t > 0.62 && t < 0.92), tint: t > 0.06 && t < 0.3 && e.f % 4 < 2 ? Gd[1] : undefined });
        const lk = bump(t, 0.6, 0.76);
        if (lk > 0)
            rampLine(e.c, -2, TY + 2, W + 2, TY + 2, Gd, R(1 + 6 * lk));
        flash(e.c, bump(t, 0.64, 0.68) * 0.6, Gd[1]);
        debris(e.c, TX + 6, TY, win(t, 0.64, 0.9), 18, 34, Gd, 7);
    },
    // ---------- 返し技 ----------
    'parry-catch'(e) {
        const t = e.t, Bl = PAL.blood;
        e.bg(win(t, 0.3, 0.4) * 0.35 * (1 - win(t, 0.72, 0.84)));
        hitBoss(e, 0.68, 0.14, 4);
        const catchT = 0.34, throwT = 0.54, hitT = 0.68;
        e.hero(HX, FY, t > 0.26 && t < throwT ? 'cast' : t < 0.66 && t >= throwT ? 'attack' : 'idle', t < throwT ? 0.5 : win(t, throwT, 0.66));
        const m = e.muzzle(HX, FY, 'cast', 0.5), top = { x: HX, y: FY - 34 };
        const k1 = win(t, 0.12, catchT);
        if (k1 > 0 && k1 < 1) {
            const x = lerp(TX + 10, m.x, k1), y = lerp(TY, m.y, k1);
            for (let j = 1; j < 6; j++)
                P(e.c, x - j * 3, y - j * 0.3, Bl[Math.min(3, j >> 1)]);
            orb(e.c, x, y, 4, Bl);
        }
        if (t >= catchT && t < throwT) {
            const a = win(t, catchT, throwT) * TAU * 1.5, x = top.x + Math.cos(a) * 7, y = top.y + Math.sin(a) * 2;
            ringK(e.c, top.x, top.y, 7, Bl[1], 1, 0.6, 0.3);
            for (let j = 1; j < 5; j++) {
                const b = a - j * 0.4;
                P(e.c, top.x + Math.cos(b) * 7, top.y + Math.sin(b) * 2, Bl[Math.min(3, j)]);
            }
            orb(e.c, x, y, 4 + win(t, catchT, throwT) * 2, Bl);
            if (t < catchT + 0.04)
                star(e.c, m.x, m.y, 4);
        }
        const k2 = win(t, throwT, hitT);
        if (k2 > 0 && k2 < 1) {
            const x = lerp(top.x, TX + 6, k2), y = lerp(top.y, TY, k2) - Math.sin(k2 * Math.PI) * 8;
            for (let j = 1; j < 8; j++)
                P(e.c, x + j * 3, y + j * 0.4 - Math.sin(j), Bl[Math.min(3, j >> 1)], 2, 1);
            orb(e.c, x, y, 6, Bl);
            ringK(e.c, x, y, 8, '#ffffff', 1, 0.5);
        }
        burstAt(e.c, TX + 6, TY, win(t, hitT, hitT + 0.16), Bl, 1.3, 8);
        flash(e.c, bump(t, hitT, hitT + 0.04) * 0.4, Bl[0]);
    },
    'parry-absorb'(e) {
        const t = e.t, A = PAL.arc, B = PAL.bolt;
        e.bg(win(t, 0.18, 0.3) * 0.5 * (1 - win(t, 0.78, 0.88)));
        hitBoss(e, 0.66, 0.14, 3);
        e.hero(HX, FY, t > 0.18 && t < 0.74 ? 'cast' : 'idle', 0.5);
        const m = e.muzzle(HX, FY, 'cast', 0.5);
        const a = bump(t, 0.2, 0.44);
        if (a > 0)
            bolt(e.c, TX + 8, TY, m.x, m.y, A, Math.floor(e.f / 2), 6, 2, 0.15);
        const g = win(t, 0.42, 0.62);
        if (g > 0 && t < 0.64) {
            orb(e.c, m.x, m.y, 2 + 5 * g, B);
            ringK(e.c, m.x, m.y, R(14 * (1 - ((e.f * 0.07) % 1))), B[2], 1, 0.5);
            const r = rng(e.f);
            for (let i = 0; i < 6; i++) {
                const an = r() * TAU, d = 14 * (1 - g);
                P(e.c, m.x + Math.cos(an) * d, m.y + Math.sin(an) * d, B[1]);
            }
        }
        const b = bump(t, 0.62, 0.76);
        if (b > 0) {
            bolt(e.c, m.x, m.y, TX + 6, TY, B, Math.floor(e.f / 2) + 9, 7, R(2 + 2 * b), 0.3);
            orb(e.c, m.x, m.y, 4, B);
        }
        flash(e.c, bump(t, 0.64, 0.68) * 0.5, B[1]);
        burstAt(e.c, TX + 6, TY, win(t, 0.66, 0.82), B, 1.2, 3);
    },
    'parry-behind'(e) {
        const t = e.t, DF = ['#f0d0ff', '#c87aff', '#7a3ad8', '#3a1a7a'];
        e.bg(win(t, 0.36, 0.46) * 0.4 * (1 - win(t, 0.78, 0.88)));
        e.boss({ hit: t > 0.6 && t < 0.72, dx: t > 0.6 && t < 0.76 ? 3 : 0, pose: { lean: t > 0.24 && t < 0.44 ? 4 : 0 } });
        slashAt(e, 0.42);
        const sink = win(t, 0.38, 0.46), rise = win(t, 0.5, 0.58);
        const pa = bump(t, 0.36, 0.5);
        if (pa > 0) {
            disc(e.c, HX, FY, 10 * pa, '#05030c', 1, 0.3);
            ring(e.c, HX, FY, 10 * pa, DF[2], 1, 1, 0.3);
        }
        const pb = bump(t, 0.46, 0.62);
        if (pb > 0) {
            disc(e.c, 6, FY, 10 * pb, '#05030c', 1, 0.3);
            ring(e.c, 6, FY, 10 * pb, DF[2], 1, 1, 0.3);
        }
        if (t < 0.46) {
            e.c.save();
            e.c.beginPath();
            e.c.rect(0, 0, W, FY + 1);
            e.c.clip();
            e.hero(HX, FY + R(24 * easeIn(sink)), 'guard', 1);
            e.c.restore();
        }
        if (t >= 0.5 && t < 0.78) {
            e.c.save();
            e.c.beginPath();
            e.c.rect(0, 0, W, FY + 1);
            e.c.clip();
            e.hero(8, FY + R(24 * (1 - ease(rise))), t > 0.58 && t < 0.72 ? 'attack' : 'idle', win(t, 0.58, 0.7), { flip: false });
            e.c.restore();
        }
        if (t >= 0.78)
            e.hero(HX, FY, 'idle', 0, { a: win(t, 0.78, 0.86) });
        const k = win(t, 0.58, 0.64), fade = 1 - win(t, 0.67, 0.78);
        if (k > 0 && fade > 0)
            band(e.c, 12, FY - 18, 12, 22, -2.4, lerp(-2.4, 0.9, ease(k)), DF, fade);
        burstAt(e.c, TX - 4, TY, win(t, 0.6, 0.76), DF, 0.9, 6);
    },
    'parry-mirror'(e) {
        const t = e.t, Bl = PAL.blood, I = PAL.ice;
        e.bg(win(t, 0.18, 0.3) * 0.35 * (1 - win(t, 0.78, 0.88)));
        e.boss({ hit: t > 0.52 && t < 0.72 && e.f % 4 < 2, dx: t > 0.52 && t < 0.74 ? -2 : 0, pose: { mouth: t > 0.18 && t < 0.5 ? 2 : 0 } });
        e.hero(HX, FY, t > 0.18 && t < 0.74 ? 'guard' : 'idle', 1);
        const mk = win(t, 0.2, 0.3) * (1 - win(t, 0.74, 0.84)), mx = HX - 14, my = FY - 16;
        if (mk > 0) {
            const h = R(30 * ease(mk));
            P(e.c, mx - 2, my - h / 2, I[3], 5, h);
            P(e.c, mx - 1, my - h / 2, I[1], 3, h);
            P(e.c, mx, my - h / 2 + 1, '#ffffff', 1, h - 2);
            const sh = ((e.f * 2) % (h + 10)) - 5;
            for (let i = 0; i < 3; i++)
                P(e.c, mx - 1 + i, my - h / 2 + sh - i, '#ffffff');
            P(e.c, mx - 3, my - h / 2 - 1, PAL.gold[2], 7, 2);
            P(e.c, mx - 3, my + h / 2 - 1, PAL.gold[2], 7, 2);
        }
        const b1 = bump(t, 0.28, 0.5);
        if (b1 > 0)
            beamH(e.c, TX + 8, mx - 3, my, R(1 + 3 * b1), Bl, e.f);
        const b2 = bump(t, 0.44, 0.76);
        if (b2 > 0) {
            beamH(e.c, TX + 4, mx - 3, my, R(2 + 6 * b2), I, e.f);
            orb(e.c, mx - 3, my, 3 + b2 * 3, I);
        }
        star(e.c, mx - 2, my, R(5 * bump(t, 0.42, 0.52)));
        burstAt(e.c, TX + 4, my, win(t, 0.52, 0.7), I, 1.1, 4);
        flash(e.c, bump(t, 0.44, 0.48) * 0.4, I[1]);
    },
    // ---------- 召喚 ----------
    'summon-knight'(e) {
        const t = e.t, Hy = PAL.holy;
        e.bg(win(t, 0.06, 0.2) * 0.6 * (1 - win(t, 0.82, 0.92)));
        hitBoss(e, 0.58, 0.14, 4);
        const a = ease(win(t, 0.12, 0.34)) * (1 - win(t, 0.7, 0.84));
        const pk = bump(t, 0.06, 0.3);
        if (pk > 0)
            for (let i = 0; i < 3; i++)
                rectD(e.c, HX - 34 + i * 4, 0, 16 - i * 4, FY, Hy[2 - i], pk * 0.45);
        if (a > 0) {
            const atk = t > 0.44 && t < 0.62;
            wings(e.c, HX - 20, FY - 52, a, Hy, e.f);
            spirit(e, atk ? 'attack' : 'cast', atk ? win(t, 0.44, 0.62) : 0.5, HX - 22, FY + 2, 2, '#ffe27a', '#ffffff', Math.min(1, a * 1.3), undefined, 0.5);
            halo(e.c, HX - 24, FY - 66, a, e.f);
        }
        e.hero(HX, FY, t > 0.44 && t < 0.62 ? 'attack' : 'cast', win(t, 0.44, 0.62));
        const k = win(t, 0.5, 0.58), fade = 1 - win(t, 0.6, 0.72);
        if (k > 0 && fade > 0)
            band(e.c, HX - 46, FY - 40, 26, 40, Math.PI + 2.3, lerp(Math.PI + 2.3, Math.PI - 0.5, ease(k)), Hy, fade, 1);
        flash(e.c, bump(t, 0.58, 0.62) * 0.6, Hy[1]);
        burstAt(e.c, TX + 6, TY, win(t, 0.58, 0.76), Hy, 1.4, 8);
    },
    'summon-fist'(e) {
        const t = e.t, A = PAL.arc;
        e.shake(bump(t, 0.48, 0.6) * 3);
        e.bg(win(t, 0.06, 0.2) * 0.4 * (1 - win(t, 0.8, 0.9)));
        const k0 = t - 0.5;
        e.boss({ hit: k0 >= 0 && k0 < 0.1, dy: k0 >= 0 && k0 < 0.3 ? -R(Math.sin((k0 / 0.3) * Math.PI) * 12) : 0 });
        e.hero(HX, FY, t > 0.08 && t < 0.6 ? 'cast' : 'idle', 0.5);
        const m = e.muzzle(HX, FY, 'cast', 0.5);
        if (t > 0.1 && t < 0.46) {
            orb(e.c, m.x, m.y, 2 + (e.f % 4 < 2 ? 1 : 0), A);
            line(e.c, m.x, m.y, TX + 4, FY - 1, A[2], 1, 0.4 * bump(t, 0.1, 0.46));
        }
        const c = win(t, 0.12, 0.3) * (1 - win(t, 0.6, 0.72));
        if (c > 0) {
            ring(e.c, TX + 4, FY, 20 * c, A[2], 1, c, 0.25);
            ring(e.c, TX + 4, FY, 14 * c, A[1], 1, c, 0.25);
            for (let i = 0; i < 6; i++) {
                const an = e.f * 0.05 + (i / 6) * TAU;
                P(e.c, TX + 4 + Math.cos(an) * 17 * c, FY + Math.sin(an) * 4.2 * c, '#ffffff');
            }
        }
        const g = bump(t, 0.3, 0.5);
        if (g > 0) {
            const r = rng(5);
            for (let i = 0; i < 8; i++) {
                const an = (i / 8) * TAU, L0 = (10 + r() * 14) * g;
                line(e.c, TX + 4, FY - 1, TX + 4 + Math.cos(an) * L0, FY - 1 + Math.sin(an) * L0 * 0.25, '#05030c', 1);
                line(e.c, TX + 4, FY - 2, TX + 4 + Math.cos(an) * L0, FY - 2 + Math.sin(an) * L0 * 0.25, '#ff9a3a', 1, g * 0.7);
            }
        }
        const k = ease(win(t, 0.46, 0.52)) * (1 - win(t, 0.74, 0.88));
        if (k > 0)
            rockFist(e.c, TX + 4, FY - 44 * k, FY + 2);
        debris(e.c, TX + 4, FY - 2, win(t, 0.48, 0.82), 18, 38, ['#d8c8a8', '#a8987a', '#7a6a52', '#4a3a2a'], 9, 0.8, 80);
        dust(e.c, TX + 4, win(t, 0.48, 0.76), 1.8);
        burstAt(e.c, TX + 4, TY - 4, win(t, 0.5, 0.64), PAL.gold, 0.9, 6);
    },
    'summon-bird'(e) {
        const t = e.t;
        e.bg(win(t, 0.06, 0.2) * 0.5 * (1 - win(t, 0.82, 0.92)));
        hitBoss(e, 0.62, 0.14, 4);
        e.hero(HX, FY, t > 0.08 && t < 0.6 ? 'cast' : 'idle', 0.5);
        const m = e.muzzle(HX, FY, 'cast', 0.5);
        if (t > 0.08 && t < 0.26) {
            const g = win(t, 0.08, 0.26);
            orb(e.c, m.x, m.y, 2 + 5 * g, FLAME);
            ringK(e.c, m.x, m.y, R(4 + 10 * g), FLAME[2], 1, g);
        }
        const k = win(t, 0.24, 0.62);
        if (k > 0 && k < 1) {
            const x = lerp(m.x - 6, TX + 4, k), y = lerp(m.y - 6, TY, k) - Math.sin(k * Math.PI) * 30;
            for (let i = 1; i < 8; i++) {
                const kk = Math.max(0, k - i * 0.03);
                tongue(e.c, lerp(m.x - 6, TX + 4, kk) + 8, lerp(m.y - 6, TY, kk) - Math.sin(kk * Math.PI) * 30 + 4, 7 - i * 0.7, 3, FLAME, i + e.f, 0.8);
            }
            phoenix(e.c, x, y, e.f, 1.1);
        }
        const b = win(t, 0.62, 0.84);
        if (b > 0 && b < 1) {
            for (let i = 0; i < 4; i++)
                disc(e.c, TX + 4, TY, (6 + 18 * ease(b)) * (1 - i * 0.2), FLAME[i + 1], 1 - b * 0.7);
            for (let i = 0; i < 5; i++)
                tongue(e.c, TX - 6 + i * 5, FY, (16 - Math.abs(i - 2) * 4) * (1 - b), 5, FLAME, i, 1 - b);
            debris(e.c, TX + 4, TY, b, 18, 30, FLAME, 11);
        }
        flash(e.c, bump(t, 0.62, 0.66) * 0.5, FLAME[1]);
    },
    // ---------- 封印 ----------
    'seal-talisman'(e) {
        const t = e.t;
        e.bg(win(t, 0.06, 0.2) * 0.35 * (1 - win(t, 0.8, 0.9)));
        e.boss({ hit: t > 0.64 && t < 0.76, dx: t > 0.64 && t < 0.78 ? -3 : 0, tint: '#ffe27a', tintA: t > 0.46 && t < 0.64 ? 0.2 : 0 });
        e.hero(HX, FY, t > 0.08 && t < 0.44 ? 'attack' : t > 0.44 && t < 0.64 ? 'cast' : 'idle', (t * 6) % 1);
        const m = e.muzzle(HX, FY, 'attack', 0.5);
        const r = rng(61), tal = [];
        for (let i = 0; i < 7; i++)
            tal.push({ tx: TX - 12 + r() * 26, ty: TY - 22 + r() * 36, at: 0.14 + i * 0.035 });
        tal.forEach((p, i) => {
            if (t > 0.66)
                return;
            const k = win(t, p.at, p.at + 0.12);
            if (k <= 0)
                return;
            const x = R(lerp(m.x, p.tx, ease(k))), y = R(lerp(m.y, p.ty, ease(k)) - Math.sin(k * Math.PI) * 12);
            const spin = k < 1 ? Math.floor(e.f / 2 + i) % 3 : 0, w = [6, 4, 2][spin];
            const lit = t > 0.46 + i * 0.022;
            P(e.c, x - w / 2 - 1, y - 1, '#5a3a2a', w + 2, 11);
            P(e.c, x - w / 2, y, lit && e.f % 4 < 2 ? '#fff6c8' : '#f0e6d0', w, 9);
            if (w >= 4) {
                P(e.c, x - 1, y + 1, '#e43b44', 2, 1);
                P(e.c, x - 2, y + 3, '#e43b44', 4, 1);
                P(e.c, x - 1, y + 4, '#e43b44', 2, 3);
                P(e.c, x - 2, y + 7, '#c81a4a', 4, 1);
            }
            if (lit && k >= 1)
                ringK(e.c, x, y + 4, R(3 + 4 * ((e.f % 8) / 8)), PAL.gold[1], 1, 0.6);
        });
        if (t > 0.5 && t < 0.66)
            for (let i = 0; i < 6; i++)
                line(e.c, tal[i].tx, tal[i].ty + 4, tal[i + 1].tx, tal[i + 1].ty + 4, PAL.gold[2], 1, 0.6 * win(t, 0.5, 0.56));
        const b = win(t, 0.64, 0.84);
        if (b > 0 && b < 1)
            tal.forEach((p, i) => { for (let j = 0; j < 4; j++)
                disc(e.c, p.tx, p.ty + 4, (2 + 7 * ease(b)) * (1 - j * 0.22) * (1 - b * 0.4), FLAME[j + 1], 1 - b * 0.8); });
        flash(e.c, bump(t, 0.64, 0.68) * 0.5, FLAME[1]);
    },
    // ---------- 乱舞 ----------
    'rush-cyclone'(e) {
        const t = e.t, Gd = PAL.gold;
        e.bg(win(t, 0.1, 0.24) * 0.5 * (1 - win(t, 0.8, 0.92)));
        e.boss({ hit: t > 0.28 && t < 0.72 && e.f % 5 < 2, dx: t > 0.28 && t < 0.72 ? R(Math.sin(e.f) * 1) - 1 : 0 });
        const k = win(t, 0.24, 0.7), cx = TX + 6, cy = FY - 6;
        if (k > 0 && k < 1) {
            const a = k * TAU * 3.5, front = Math.sin(a) > 0;
            // 奥側の軌跡 → ボス → 手前の軌跡、の順に重ねたいが、ボスは先に描いてあるので、奥の弧は暗く細く
            for (let i = 0; i < 3; i++) {
                const ry = 9 + i * 3, rx = 30 + i * 4, yy = cy - 10 - i * 12;
                arcE(e.c, cx, yy, rx, ry, a - 2.2, a, i === 1 ? PAL.steel : Gd, 3 - (i === 2 ? 1 : 0), 1);
            }
            const x = cx + Math.cos(a) * 32, y = cy + 4 + Math.sin(a) * 10;
            for (let i = 1; i <= 3; i++) {
                const b = a - i * 0.4;
                e.ghost(cx + Math.cos(b) * 32, cy + 4 + Math.sin(b) * 10, Gd[2], 0.6 - i * 0.12, 'attack', 0.5);
            }
            e.hero(R(x), R(y), 'attack', (k * 8) % 1, { flip: !front });
            if (e.f % 3 === 0) {
                const r = rng(e.f);
                star(e.c, cx - 10 + r() * 22, cy - 40 + r() * 34, 2);
            }
        }
        else
            e.hero(t < 0.24 ? R(lerp(HX, 66, ease(win(t, 0.08, 0.24)))) : R(lerp(66, HX, ease(win(t, 0.72, 0.88)))), FY, t > 0.08 && t < 0.24 ? 'dash' : 'idle', 0.5, { flip: !(t > 0.72 && t < 0.88) });
        flash(e.c, bump(t, 0.7, 0.74) * 0.5);
        burstAt(e.c, TX + 4, TY, win(t, 0.7, 0.86), Gd, 1.6, 4);
    },
    'rush-pierce'(e) {
        const t = e.t, St = PAL.steel;
        e.bg(win(t, 0.1, 0.24) * 0.5 * (1 - win(t, 0.8, 0.92)));
        e.boss({ hit: t > 0.3 && t < 0.7 && e.f % 4 < 2, dx: t > 0.3 && t < 0.72 ? -2 : 0 });
        const x = approach(t, 0.08, 0.24, 0.74, 0.88, 62);
        const lunge = t > 0.26 && t < 0.66 ? R(Math.abs(Math.sin(e.f * 0.9)) * 3) : 0;
        e.hero(x - lunge, FY, t > 0.24 && t < 0.72 ? 'attack' : 'idle', 0.5 + 0.1 * Math.sin(e.f));
        if (t > 0.26 && t < 0.66) {
            const r = rng(Math.floor(e.f / 2));
            for (let i = 0; i < 5; i++) {
                const y = TY - 16 + r() * 32, l0 = x - 14 - lunge;
                rampLine(e.c, l0, FY - 14 + (r() - 0.5) * 4, TX + 4, y, St.slice(0, 3), i === 0 ? 3 : 2, 0.9);
                star(e.c, TX + 4, y, 2);
            }
            for (let i = 0; i < 4; i++) {
                const r2 = rng(Math.floor(e.f / 2) + 50);
                const y = TY - 12 + r2() * 24;
                line(e.c, TX - 2, y, TX - 10 - r2() * 8, y + (r2() - 0.5) * 6, St[1]);
            }
        }
        const k = win(t, 0.64, 0.7), fade = 1 - win(t, 0.7, 0.82);
        if (k > 0 && fade > 0) {
            rampLine(e.c, x - 14, FY - 14, lerp(x - 14, -4, k), lerp(FY - 14, TY, k), St, 6, fade);
            star(e.c, TX + 2, TY, 5);
        }
        sparks(e.c, TX - 4, TY, win(t, 0.66, 0.8), 16, 24, St, 8, 1.8, Math.PI);
        flash(e.c, bump(t, 0.66, 0.7) * 0.5);
    },
    // ---------- 奥義 ----------
    'ougi-bolt'(e) {
        const t = e.t, B = PAL.bolt;
        e.shake(bump(t, 0.58, 0.68) * 3);
        e.bg(win(t, 0.1, 0.3) * 0.7 * (1 - win(t, 0.76, 0.9)));
        hitBoss(e, 0.58, 0.14, 2);
        const p = leapPos(t, 0.12, 0.38, 0.58, 24);
        const sk = bump(t, 0.34, 0.44);
        if (sk > 0)
            bolt(e.c, p.x - 2, -4, p.x - 2, p.y - 24, B, Math.floor(e.f / 2), 5, 5, 0.4);
        if (t > 0.38 && t < 0.58) {
            const kk = win(t, 0.38, 0.58);
            for (let i = 1; i < 6; i++) {
                const q = Math.max(0, kk - i * 0.06), yy = lerp(24, FY, easeIn(q));
                P(e.c, 52 + (i % 2), yy - 20, B[Math.min(3, i - 1)], 3, 4);
            }
            bolt(e.c, 52, 20, p.x, p.y - 14, B.slice(1), Math.floor(e.f / 2) + 5, 3, 2, 0);
        }
        e.hero(p.x, p.y, t > 0.4 && t < 0.66 ? 'attack' : p.air ? 'victory' : 'idle', win(t, 0.44, 0.66), { tint: t > 0.36 && t < 0.58 && e.f % 4 < 2 ? B[1] : undefined });
        if (t > 0.36 && t < 0.66) {
            const r = rng(Math.floor(e.f / 2));
            for (let i = 0; i < 4; i++) {
                const a = r() * TAU;
                bolt(e.c, p.x, p.y - 14, p.x + Math.cos(a) * 12, p.y - 14 + Math.sin(a) * 10, B.slice(0, 3), i + e.f, 2, 1, 0);
            }
        }
        const g = bump(t, 0.58, 0.76);
        if (g > 0)
            for (const s2 of [-1, 1])
                bolt(e.c, 46, FY - 1, 46 + s2 * 40, FY - 1, B, Math.floor(e.f / 2) + (s2 > 0 ? 3 : 7), 2, 2, 0.25);
        flash(e.c, bump(t, 0.36, 0.4) * 0.5, B[1]);
        flash(e.c, bump(t, 0.58, 0.62) * 0.6);
        impactRing(e, 0.58, B, 1.1);
        burstAt(e.c, TX + 6, TY, win(t, 0.58, 0.74), B, 1.2, 9);
    },
};
for (const c of CATEGORIES)
    for (const p of c.patterns)
        if (HQ[p.id])
            p.draw = HQ[p.id];
export const BOSS_LIST = [
    { kind: 'vampire', name: '吸血鬼伯爵' }, { kind: 'dragon', name: '竜' }, { kind: 'spider', name: '大蜘蛛' }, { kind: 'goblin', name: 'ゴブリンの群れ' },
    { kind: 'kraken', name: 'クラーケン' }, { kind: 'golem', name: '石の巨人' }, { kind: 'giant', name: '氷の巨人' },
];
// [ボスの技の名前, 冒険者の対応（本番の対応技の説明）, 対応の種類]
export const PAIRS = {
    dragon: { breath: ['火炎ブレス', '鏡で炎を受ける', 'block'], claw: ['ひっかき', '影を残してすり抜ける', 'step'], dive: ['急降下', '伏せる', 'crawl'], tail: ['尾のなぎはらい', '跳んでかわす', 'jump'] },
    vampire: { breath: ['蝙蝠の群れ', '床に伏せてやり過ごす', 'crawl'], claw: ['伸びる爪', '銀の盾で受ける', 'block'], dive: ['蝙蝠の急降下', '柱の陰へ駆けこむ', 'dodge'], tail: ['背後の霧からの斬撃', '振り向いて斬る', 'turnCut'] },
    spider: { breath: ['糸の網', '横へ転がってかわす', 'dodge'], claw: ['毒牙', '盾ではじく', 'parry'], dive: ['天井からの落下', '飛びのく', 'dodge'], tail: ['脚の薙ぎ払い', '低く斬りはらう', 'cut'] },
    goblin: { breath: ['矢の雨', '盾をかかげて矢を受ける', 'block'], claw: ['落とし穴', '回りこんで避ける', 'step'], dive: ['投石', '投石から飛びのく', 'dodge'], tail: ['槍の突撃', '穂先をはらう', 'parry'] },
    kraken: { breath: ['墨の噴射', '物陰に伏せる', 'crawl'], claw: ['触手の薙ぎ', '跳んでかわす', 'jump'], dive: ['海からの突き上げ', '跳んで離れる', 'jump'], tail: ['触手の巻き取り', '触手を斬る', 'cut'] },
    golem: { breath: ['石礫の嵐', '盾で受ける', 'block'], claw: ['岩の拳', '拳から飛びのく', 'dodge'], dive: ['地割れ', '地割れを跳び越える', 'jump'], tail: ['石腕の薙ぎ払い', '伏せてやりすごす', 'crawl'] },
    giant: { breath: ['凍てつく息', '物陰に伏せる', 'crawl'], claw: ['氷の投げ槍', '左右に駆けてかわす', 'step'], dive: ['氷柱の踏みつけ', '踏みつけから飛びのく', 'dodge'], tail: ['棍棒の薙ぎ払い', '懐へ踏みこんで斬る', 'cut'] },
};
export const SPELL_NAME = { dragon: '呪文', vampire: '呪いの紋', spider: '毒の大技', goblin: '大号令', kraken: '大渦', golem: '刻印の起動', giant: '雪崩' };
// 対応の種類 → 見本帳のどの項目の案を使うか
export const RESP_CAT = {
    block: { cat: 'guard', label: 'ガード' }, barrier: { cat: 'guard', label: 'ガード（結界）', only: 'guard-hex' }, parry: { cat: 'guard', label: 'ガード（はじく）' }, turn: { cat: 'guard', label: '振り向いてガード' }, turnCut: { cat: 'attack', label: '振り向いて斬る' },
    cut: { cat: 'attack', label: '通常攻撃で斬りはらう' }, smash: { cat: 'attack', label: '通常攻撃で打ち砕く' }, shoot: { cat: 'attack', label: '通常攻撃で撃ち落とす' },
    dodge: { cat: 'evade', label: '回避', avoid: 'evade-duck' }, step: { cat: 'evade', label: '回避（すり抜け）', avoid: 'evade-duck' },
    crawl: { cat: 'evade', label: '回避（伏せる）', only: 'evade-duck' }, jump: { cat: 'jump', label: 'ジャンプ' },
};
// ボスごとの色と、飛んでくるもの
const BCOL = {
    dragon: FLAME, vampire: PAL.blood, spider: ['#ffffff', '#f4f6ff', '#c8d0e0', '#8a90a8'], goblin: ['#fff1d6', '#e8d5a8', '#a07850', '#5a3a1a'],
    kraken: ['#c8a0ff', '#6a4a9a', '#2a1a4a', '#0a0612'], golem: ['#d8c8a8', '#a8987a', '#7a6a52', '#4a3a2a'], giant: PAL.ice,
};
function missile(c, kind, x, y, f, ang = Math.PI) {
    const col = BCOL[kind];
    switch (kind) {
        case 'vampire': { // 蝙蝠（羽ばたく）
            const fl = Math.floor(f / 3) % 2, D = '#1a0814', M = '#5a2a6a';
            P(c, x - 2, y - 2, D, 5, 4);
            P(c, x - 1, y - 3, D, 1, 1);
            P(c, x + 1, y - 3, D, 1, 1);
            if (fl) {
                P(c, x - 7, y - 4, D, 5, 2);
                P(c, x + 3, y - 4, D, 5, 2);
                P(c, x - 6, y - 3, M, 3, 1);
                P(c, x + 4, y - 3, M, 3, 1);
            }
            else {
                P(c, x - 7, y, D, 5, 2);
                P(c, x + 3, y, D, 5, 2);
                P(c, x - 8, y + 1, D, 2, 1);
                P(c, x + 7, y + 1, D, 2, 1);
            }
            P(c, x - 1, y - 1, '#ff3b5a');
            P(c, x + 1, y - 1, '#ff3b5a');
            break;
        }
        case 'dragon':
            orb(c, x, y, 3, FLAME);
            P(c, x + 3, y, FLAME[3], 3, 1);
            break;
        case 'spider':
            line(c, x, y, x + 8, y - 2, '#f4f6ff');
            line(c, x, y, x + 6, y + 4, '#c8d0e0');
            P(c, x, y, '#ffffff', 2, 2);
            break;
        case 'goblin':
            line(c, x, y, x - Math.cos(ang) * 9, y - Math.sin(ang) * 9, '#a07850');
            P(c, x, y, '#d5dbe6', 2, 2);
            break;
        case 'kraken':
            disc(c, x, y, 3, '#2a1a4a');
            P(c, x - 1, y - 1, '#6a4a9a', 2, 1);
            break;
        case 'golem':
            disc(c, x, y, 3, '#7a6a52');
            P(c, x - 1, y - 2, '#d8c8a8', 2, 1);
            P(c, x + 1, y + 1, '#4a3a2a', 2, 1);
            break;
        case 'giant':
            line(c, x, y, x + 6, y, PAL.ice[2]);
            P(c, x - 1, y - 1, '#ffffff', 2, 3);
            break;
    }
    void col;
}
// ボスの攻撃（冒険者の立ち位置 hx に向けて）。当たる（届く）瞬間は 0.4 ごろ
function bossAttack(c, kind, scene, resp, t, f, hx) {
    const col = BCOL[kind], mx = 50, my = TY - 6, ty = FY - 16;
    if (resp === 'crawl') { // 頭の上を、横に払う一撃が通りすぎる
        const k = win(t, 0.26, 0.52);
        if (k > 0 && k < 1) {
            const x = lerp(mx, W + 20, k);
            rampLine(c, mx, FY - 26, x, FY - 26, col.slice(1), 4, 0.9);
            missile(c, kind, x, FY - 26, f);
        }
        return;
    }
    if (resp === 'jump') { // 足もとを払う（または足もとに穴・地割れ）
        if (scene === 'claw' && kind === 'goblin') {
            const k = bump(t, 0.24, 0.62);
            if (k > 0) {
                P(c, hx - 10, FY - 1, '#05030c', 20, R(4 * k) + 1);
                P(c, hx - 11, FY - 2, '#5a3a1a', 22, 1);
            }
            return;
        }
        if (scene === 'dive') {
            const k = bump(t, 0.24, 0.62);
            if (k > 0) {
                let x = mx;
                while (x < hx + 10) {
                    const nx = x + 5;
                    line(c, x, FY - 1 + (x % 3), nx, FY - 1 + (nx % 3), '#05030c', 2, k);
                    x = nx;
                }
                if (kind === 'kraken')
                    for (let i = 0; i < 6; i++)
                        P(c, hx - 8 + i * 3, FY - 2 - ((f + i) % 5), '#bfe8ff');
            }
            return;
        }
        const k = win(t, 0.24, 0.52);
        if (k > 0 && k < 1) {
            const x = lerp(mx - 10, W + 20, k);
            rampLine(c, x - 30, FY - 3, x, FY - 3, col.slice(1), 4, 0.9);
            P(c, x - 2, FY - 6, col[0], 4, 6);
        }
        return;
    }
    if (resp === 'turn' || resp === 'turnCut') { // 背後（右）の霧から斬りつける
        const m = bump(t, 0.1, 0.6);
        if (m > 0)
            for (let i = 0; i < 4; i++)
                disc(c, hx + 16 + i * 4, FY - 10 - i * 5, 6, '#9a8ab0', m * 0.5);
        const k = win(t, 0.3, 0.42), fade = 1 - win(t, 0.44, 0.52);
        if (k > 0 && fade > 0)
            band(c, hx + 14, FY - 14, 6, 12, -0.4, lerp(-0.4, 2.2, ease(k)), col, fade, 1.2);
        return;
    }
    if (scene === 'breath') { // 口から、群れ・炎・糸・矢・墨・石・冷気の流れ
        const n = 10;
        for (let i = 0; i < n; i++) {
            const s0 = 0.18 + i * 0.02, k = win(t, s0, s0 + 0.2);
            if (k <= 0 || k >= 1)
                continue;
            const tx = hx - 8 + ((i * 7) % 5) - 2, tyy = ty - 10 + ((i * 11) % 22);
            const x = kind === 'goblin' ? lerp(tx + 30, tx, k) : lerp(mx, tx, k), y = kind === 'goblin' ? lerp(-10, tyy, k) : lerp(my, tyy, k) + Math.sin(k * 6 + i) * 3;
            missile(c, kind, x, y, f + i, kind === 'goblin' ? -2.2 : Math.PI);
        }
        if (kind === 'dragon' || kind === 'giant' || kind === 'kraken') {
            const k = bump(t, 0.2, 0.5);
            if (k > 0)
                rampLine(c, mx, my, lerp(mx, hx - 12, k), lerp(my, ty, k), col, R(2 + 4 * k), 0.8);
        }
        return;
    }
    if (scene === 'claw') { // 伸びる爪・毒牙・岩の拳・氷の投げ槍
        if (kind === 'giant') {
            const k = win(t, 0.22, 0.4);
            if (k > 0 && k < 1) {
                const x = lerp(mx, hx - 14, k), y = lerp(my - 10, ty, k);
                rampLine(c, x, y, x + 16, y - 3, PAL.ice, 3);
                P(c, x - 2, y - 1, '#ffffff', 3, 3);
            }
            return;
        }
        const k = win(t, 0.24, 0.4), fade = 1 - win(t, 0.44, 0.54);
        if (k > 0 && fade > 0)
            for (let i = 0; i < 3; i++) {
                const y0 = my - 6 + i * 6;
                rampLine(c, mx, y0, lerp(mx, hx - 12, ease(k)), lerp(y0, ty - 4 + i * 4, ease(k)), col.slice(0, 3), kind === 'golem' ? 5 : 2, fade);
            }
        return;
    }
    // 急降下・投石・踏みつけ: 頭上から落ちてくる。地面の影が大きくなる
    const k = win(t, 0.18, 0.42);
    if (k > 0 && k < 1.2)
        disc(c, hx, FY, 3 + 9 * Math.min(1, k), '#05030c', 0.6, 0.3);
    if (k > 0 && k < 1) {
        const y = lerp(-10, FY - 10, easeIn(k)), x = lerp(hx - 30, hx, k);
        if (kind === 'vampire') {
            for (let i = 0; i < 3; i++)
                missile(c, kind, x + i * 5 - 5, y - i * 3, f + i);
        }
        else if (kind === 'goblin' || kind === 'golem') {
            disc(c, x, y, 5, '#7a6a52');
            P(c, x - 2, y - 3, '#a8987a', 3, 2);
        }
        else {
            for (let i = 0; i < 5; i++)
                rampLine(c, x - 6 + i * 3, y - 14, x - 6 + i * 3, y, col.slice(0, 3), 2, 0.9);
        }
    }
    if (t > 0.42 && t < 0.56)
        dust(c, hx, win(t, 0.42, 0.56), 1);
}
// 呪文: ボスが詠唱して魔法弾を放つ → 打ち消しの呪文を知る全員の光線がつかまえる → みんなで押し返す → 倍返し
function spellStage(c, kind, t, f, heroes) {
    const col = BCOL[kind], A = ['#ffffff', '#d8f8ff', '#8ad8ff', '#3a8ad8'];
    const o = { x: 54, y: TY - 20 }, mid = { x: 92, y: TY - 22 };
    const g = win(t, 0.05, 0.27);
    // ボスの紋
    const cr = bump(t, 0.04, 0.3);
    if (cr > 0) {
        ring(c, o.x - 12, FY - 1, 14, col[1], 1, cr, 0.3);
        ring(c, o.x - 12, FY - 1, 9, col[2], 1, cr, 0.3);
    }
    let ox = o.x, oy = o.y, r = 2 + 5 * g, rev = 0;
    if (t > 0.27 && t < 0.35) {
        const k = ease(win(t, 0.27, 0.35));
        ox = lerp(o.x, mid.x, k);
        oy = lerp(o.y, mid.y, k);
    }
    else if (t >= 0.35 && t < 0.42) {
        ox = mid.x + Math.sin(f * 0.9) * 1.5;
        oy = mid.y;
        r += 1;
    }
    else if (t >= 0.42 && t < 0.5) {
        const k = win(t, 0.42, 0.5);
        ox = lerp(mid.x, o.x - 6, k * k);
        oy = lerp(mid.y, o.y, k * k) - Math.sin(k * Math.PI) * 8;
        r *= 1 + k;
        rev = k;
    }
    // 唱える人ごとの光の柱と、魔法弾へのびる光線（全員の光線が1つの魔法弾に集まる）
    const sk = win(t, 0.2, 0.26) * (1 - win(t, 0.5, 0.56));
    heroes.forEach((h, i) => {
        if (sk > 0) {
            for (let j = 0; j < 3; j++)
                rectD(c, h.x - 4 + j * 2, 0, 8 - j * 4 + 2, h.y - 6, A[2 - j], sk * 0.45);
            ring(c, h.x, h.y, 9, A[2], 1, sk, 0.3);
        }
        const bk = win(t, 0.33, 0.36) * (1 - win(t, 0.48, 0.52));
        if (bk > 0 && t > 0.33)
            rampLine(c, h.x - 4, h.y - 26, ox, oy, A, 2, bk);
        if (sk > 0 && i === 0)
            star(c, h.x - 6, h.y - 30, (f % 6) < 3 ? 2 : 1, '#ffffff');
    });
    if (t > 0.05 && t < 0.5)
        orb(c, ox, oy, r, rev > 0.3 ? A : col);
    if (t > 0.42 && t < 0.46)
        star(c, mid.x, mid.y, 5);
    const bk = win(t, 0.5, 0.66);
    if (bk > 0 && bk < 1) {
        for (let i = 0; i < 4; i++)
            disc(c, o.x - 8, o.y, (6 + 14 * ease(bk)) * (1 - i * 0.22), A[i], 1 - bk * 0.7);
        sparks(c, o.x - 8, o.y, bk, 12, 20, A, 5);
    }
}
// 幻術: 王冠をかぶった大きな影が偉い人を名乗り、声の輪が届く → 見破って踏みとどまる（結界があれば、声の文字が砕ける）
function illusionStage(c, t, f, hx) {
    const k = win(t, 0.04, 0.16) * (1 - win(t, 0.54, 0.66));
    if (k <= 0)
        return;
    const cx = 44, cy = 18 + R(Math.sin(f / 8) * 1);
    rectD(c, cx - 16, cy - 2, 32, 28, '#2a0a4a', k * 0.8);
    P(c, cx - 22, cy + 22, '#2a0a4a', 44, 10);
    for (let i = 0; i < 5; i++)
        P(c, cx - 10 + i * 5, cy - 8 + (i % 2 ? 3 : 0), '#d8b84a', 2, 6 - (i % 2 ? 3 : 0));
    P(c, cx - 10, cy - 3, '#d8b84a', 22, 2);
    P(c, cx - 7, cy + 6, '#ff4fff', 3, 2);
    P(c, cx + 4, cy + 6, '#ff4fff', 3, 2);
    for (let i = 0; i < 3; i++) {
        const q = win(t, 0.14 + i * 0.05, 0.42 + i * 0.03);
        if (q <= 0 || q >= 1)
            continue;
        const x = lerp(cx + 10, hx - 10, Math.min(q, 0.85)), y = lerp(cy + 20, FY - 18, Math.min(q, 0.85));
        ring(c, x, y, R(3 + q * 5), '#d07bff', 1, 1 - q * 0.6);
    }
    const sh = win(t, 0.38, 0.5);
    if (sh > 0 && sh < 1) {
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU;
            P(c, hx - 10 + Math.cos(a) * 10 * sh, FY - 18 + Math.sin(a) * 8 * sh, '#f0d0ff', 2, 1);
        }
    }
}
/** ボスの攻撃と冒険者の対応を1枚に描く。scene が spell / illusion のときは pattern を使わない */
export function renderPair(c, kind, scene, pick, timeSec, L, allies = []) {
    const t = (timeSec % LOOP) / LOOP, f = Math.floor(timeSec * 30);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.imageSmoothingEnabled = false;
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    const prevKind = BOSS_KIND;
    BOSS_KIND = kind;
    const e = makeEnv(c, t, f, L);
    e.bg(scene === 'spell' ? bump(t, 0.18, 0.56) * 0.45 : scene === 'illusion' ? win(t, 0.04, 0.14) * 0.4 * (1 - win(t, 0.56, 0.66)) : 0);
    const atkPose = (a, b) => (t > a && t < b ? { mouth: 2, lean: 3, eye: 'angry' } : {});
    if (scene === 'spell') {
        const back = t > 0.5 && t < 0.62;
        e.boss({ hit: back && f % 4 < 2, dx: back ? -3 : 0, pose: t < 0.3 ? { mouth: 1, eye: 'angry' } : {} });
        const heroes = [{ x: HX, y: FY, L }, ...allies.slice(0, 2).map((a, i) => ({ x: HX - 22 - i * 22, y: FY - 6 + i * 4, L: a }))];
        spellStage(c, kind, t, f, heroes);
        heroes.slice().sort((a, b) => a.y - b.y).forEach((h) => { const e2 = makeEnv(c, t, f, h.L); e2.hero(h.x, h.y, t > 0.18 && t < 0.54 ? 'cast' : t > 0.54 && t < 0.7 ? 'victory' : 'idle', 0.5); });
    }
    else if (scene === 'illusion') {
        e.boss();
        illusionStage(c, t, f, HX);
        e.hero(HX, FY, t > 0.14 && t < 0.52 ? 'guard' : 'idle', 1);
        if (t > 0.38 && t < 0.56) {
            const k = bump(t, 0.38, 0.56);
            ring(c, HX - 2, FY - 14, 14, '#bff4ff', 1, k, 1.3);
        }
    }
    else {
        const resp = pick.resp;
        const hitT = 0.42;
        e.boss({ pose: atkPose(0.16, 0.44) });
        bossAttack(c, kind, scene, resp, t, f, HX);
        if (pick.pattern) {
            NO_ATTACK = true;
            const meet = resp === 'cut' || resp === 'smash' || resp === 'shoot' || resp === 'turnCut';
            const keep = { TX, TY };
            if (meet) {
                PAIR_REACH = true;
                TX = HX - 30;
                TY = FY - 18;
            }
            const e2 = makeEnv(c, t, f, L);
            e2.bg = () => { };
            e2.boss = () => { };
            c.save();
            if (resp === 'turn' || resp === 'turnCut') {
                c.translate(2 * HX, 0);
                c.scale(-1, 1);
            } // 背後から来るので、右を向いて受ける（斬り返す）
            try {
                pick.pattern.draw(e2);
            }
            finally {
                NO_ATTACK = false;
                PAIR_REACH = false;
                ({ TX, TY } = keep);
            }
            c.restore();
        }
        void hitT;
    }
    BOSS_KIND = prevKind;
}
// ================================================================ 討伐画面に、見本帳の動きで描く
/** 本番の対応技（evade と fx）から、見本帳の対応の種類へ */
export function respOf(evade, fx) {
    if (evade === 'slash')
        return fx === 'parry' ? 'parry' : fx === 'smash' ? 'smash' : 'cut';
    if (evade === 'chant' || evade === 'resist')
        return null;
    return evade;
}
/** 対応の種類と武器から、使う案（伏せる・結界は全員同じ動きなので、本番の動きのまま＝null） */
export function protoPattern(resp, weapon, variant = 0) {
    if (resp === 'crawl' || resp === 'barrier')
        return null;
    const rc = RESP_CAT[resp];
    const cat = rc.cat === 'attack' ? CATEGORIES.find((c) => c.group === '通常攻撃' && c.weapons?.includes(weapon)) : CATEGORIES.find((c) => c.id === rc.cat);
    if (!cat)
        return null;
    let ids = MOTION_PICKS[cat.id]?.[weapon] ?? [];
    if (rc.avoid)
        ids = ids.filter((x) => x !== rc.avoid);
    // 候補が2つ以上あれば、回ごとに順に使う（同じ動きばかりにならないように）
    return cat.patterns.find((x) => x.id === ids[variant % Math.max(1, ids.length)]) ?? (rc.avoid ? cat.patterns.find((x) => x.id !== rc.avoid) : cat.patterns[0]) ?? null;
}
/** 武器ごとの通常攻撃の型（見本帳で選んだ案。候補が2つ以上なら variant で順に） */
export function attackPattern(weapon, variant = 0) {
    const cat = CATEGORIES.find((c) => c.group === '通常攻撃' && c.weapons?.includes(weapon));
    if (!cat)
        return null;
    const ids = MOTION_PICKS[cat.id]?.[weapon] ?? [];
    return cat.patterns.find((x) => x.id === ids[variant % Math.max(1, ids.length)]) ?? cat.patterns[0] ?? null;
}
/** 討伐画面の座標のまま、1人ぶんの動きを描く（ボスと背景は描かない。ボスの攻撃は本番の演出が描く） */
export function drawInArena(c, d) {
    const keep = { W, H, FY, HX, TX, TY, QUIET, NO_ATTACK, PAIR_REACH, REACH_TO };
    W = d.aw;
    H = d.ah;
    HX = d.hx;
    FY = d.fy;
    QUIET = d.quiet;
    NO_ATTACK = true;
    // attack: ボスへの反撃（通常攻撃の型）。近接はボスの前（reach）まで踏みこみ、飛び道具と魔法はボスの体を狙う
    const meet = !d.attack && (d.resp === 'cut' || d.resp === 'smash' || d.resp === 'shoot' || d.resp === 'turnCut');
    PAIR_REACH = meet;
    TX = meet ? d.hx - 30 : d.boss.x;
    TY = meet ? d.fy - 18 : d.boss.y;
    REACH_TO = d.attack ? d.reach ?? null : null;
    // 近接の反撃は、ボスの前へ斜めに踏みこむ（下の列の人がボスの足元より下を斬らないように）。
    // 型の中の足元（FY）をボスの前の高さに置きかえ、冒険者の絵だけ、踏みこんだ分に応じて元の列から寄せる
    const lift = d.attack && d.reachY !== undefined && REACH_TO !== null && isMelee(d) ? d.fy - d.reachY : 0;
    if (lift) {
        FY = d.reachY;
        LIFT = { dy: lift, from: d.hx, to: REACH_TO };
    }
    c.save();
    try {
        if (!d.attack && (d.resp === 'turn' || d.resp === 'turnCut')) {
            c.translate(2 * d.hx, 0);
            c.scale(-1, 1);
        } // 背後から来るので、右を向いて受ける（斬り返す）
        const e = makeEnv(c, d.t, d.frame, d.look);
        e.bg = () => { };
        e.boss = () => { };
        d.pattern.draw(e);
    }
    finally {
        c.restore();
        ({ W, H, FY, HX, TX, TY, QUIET, NO_ATTACK, PAIR_REACH, REACH_TO } = keep);
        LIFT = null;
    }
}
// 型が前へ踏みこむか（近接か）を、いちど小さな絵に描いて冒険者の位置から確かめる（型ごとに覚えておく）
const MELEE = new Map();
function isMelee(d) {
    let m = MELEE.get(d.pattern.id);
    if (m === undefined) {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 1;
        const c = cv.getContext('2d');
        let far = 0;
        for (const t of [0.3, 0.4, 0.5, 0.6]) {
            const e = makeEnv(c, t, 0, d.look);
            e.bg = () => { };
            e.boss = () => { };
            const hero = e.hero;
            e.hero = (x, y, ...r) => { far = Math.max(far, Math.abs(x - HX)); hero(x, y, ...r); };
            d.pattern.draw(e);
        }
        m = far > 12;
        MELEE.set(d.pattern.id, m);
    }
    return m;
}
//# sourceMappingURL=motionlab.js.map