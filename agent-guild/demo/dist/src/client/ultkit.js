// 大技などの演出で使う描画部品（光る線・弧・火花・岩片・砂煙・魔法陣・巨大な武器など）。scenes.ts と ult/ の演出から使う
import { deferText } from './fxlook.js';
import { Rng } from '../shared/rng.js';
import { weaponSprite } from './hero.js';
import { PIXEL_FONT } from '../shared/i18n.js';
import { flashScale } from './motion.js';
export const TAU = Math.PI * 2;
export const clamp01 = (t) => Math.max(0, Math.min(1, t));
export const win = (p, a, b) => clamp01((p - a) / (b - a));
export const bump = (p, a, b) => (p < a || p > b ? 0 : Math.sin(((p - a) / (b - a)) * Math.PI));
export const ease = (t) => t * t * (3 - 2 * t);
export const lerp = (a, b, t) => a + (b - a) * t;
export const R = Math.round;
// 大技の時刻（場面の中の位置 0〜1）
export const ULT_T = {
    ougi: { crouch: 0.3, jump: 0.36, hush: 0.4, fall: 0.48, impact: 0.5, land: 0.62, home: 0.72 },
    rush: { ready: 0.3, go: 0.35, first: 0.37, pass: 0.03, n: 8, finish: 0.63, burst: 0.65, home: 0.78 },
    summon: { circle: 0.28, split: 0.36, descend: 0.4, plunge: 0.52, impact: 0.54, home: 0.72 },
    // 返し技: ボスの大技の正面へ踏みこみ、受け止めた瞬間に時が止まり、跳ね返す
    parry: { ready: 0.3, step: 0.35, guard: 0.4, clash: 0.43, freeze: 0.5, strike: 0.52, hit: 0.56, home: 0.74 },
    // 封印: ボスの足元に封印陣 → 光の鎖が絡みつく → 軋む → 武器の型で打ちこんで封じ砕く
    seal: { circle: 0.28, chain: 0.34, bind: 0.44, strain: 0.5, drive: 0.54, hit: 0.58, home: 0.76 },
    // 覚醒: 気を解き放って姿が変わる → 残像だけを残して駆け抜ける → 斬撃は遅れてやってくる
    awaken: { ready: 0.3, flare: 0.34, hold: 0.44, blink: 0.47, land: 0.5, hit: 0.53, home: 0.75 },
};
export function text(ctx, s, x, y, size, color, alpha = 1, outline = '#1a1c2c') {
    if (alpha <= 0)
        return;
    if (deferText(ctx, (c) => text(c, s, x, y, size, color, alpha, outline)))
        return; // くっきり化の画面には描かず、あとで元の細かさで
    ctx.save();
    ctx.globalAlpha = clamp01(alpha);
    ctx.font = `${size}px ${PIXEL_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(2, size / 4);
    ctx.strokeText(s, R(x), R(y));
    ctx.fillStyle = color;
    ctx.fillText(s, R(x), R(y));
    ctx.restore();
}
export function flash(a, k, color = '#ffffff', max = 0.7) {
    if (k <= 0)
        return;
    const { ctx } = a;
    ctx.save();
    ctx.globalAlpha = max * k * flashScale();
    ctx.fillStyle = color;
    ctx.fillRect(-a.W, -a.H, a.W * 3, a.H * 3);
    ctx.restore();
}
// 光る線（外側の色 → 白い芯）
export function glowLine(ctx, x0, y0, x1, y1, w, col, alpha) {
    if (alpha <= 0 || w <= 0)
        return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.globalAlpha = Math.min(1, alpha) * 0.35;
    ctx.strokeStyle = col;
    ctx.lineWidth = w * 2.4;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.lineWidth = w;
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, w * 0.35);
    ctx.stroke();
    ctx.restore();
}
// 飛び散る岩片
export function rocks(a, x, y, k, seed, n = 22, spread = 120) {
    if (k <= 0 || k >= 1)
        return;
    const { ctx } = a;
    const rng = new Rng(`${a.seed}:${seed}`);
    ctx.save();
    for (let i = 0; i < n; i++) {
        const ang = rng.range(Math.PI * 1.05, Math.PI * 1.95), sp = rng.range(spread * 0.3, spread), s = rng.range(2, 6);
        const px = x + Math.cos(ang) * sp * k, py = y + Math.sin(ang) * sp * k * 0.9 + 150 * k * k;
        ctx.globalAlpha = 1 - k * k;
        ctx.fillStyle = i % 3 ? '#7a6a52' : i % 2 ? '#a8987a' : '#4a3a2a';
        ctx.fillRect(R(px), R(py), R(s), R(s));
        ctx.fillStyle = '#d8ccb0';
        ctx.fillRect(R(px), R(py), 1, 1);
    }
    ctx.restore();
}
// 砂煙
export function dustCloud(a, x, y, k, seed, size = 1) {
    if (k <= 0 || k >= 1)
        return;
    const { ctx } = a;
    const rng = new Rng(`${a.seed}:${seed}`);
    ctx.save();
    for (let i = 0; i < 14; i++) {
        const dir = rng.range(-1, 1), sp = rng.range(10, 34) * size, r = rng.range(3, 7) * size, up = rng.range(0, 10);
        ctx.globalAlpha = (1 - k) * 0.75;
        ctx.fillStyle = i % 2 ? '#d8ccb0' : '#b8a888';
        ctx.beginPath();
        ctx.arc(x + dir * sp * ease(k), y - up * k * size - 2, r * (0.5 + k), 0, TAU);
        ctx.fill();
    }
    ctx.restore();
}
// 空に浮かぶ大魔法陣（ボスの頭上）。輪と刻みがゆっくり回る
export function skyDisc(a, cx, cy, r, alpha, hue) {
    if (alpha <= 0)
        return;
    const { ctx } = a;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(cx, cy);
    ctx.scale(1, 0.26);
    const col = `hsl(${hue},100%,70%)`, col2 = `hsl(${(hue + 50) % 360},100%,80%)`;
    ctx.globalAlpha = alpha * 0.18;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    for (const [k, w] of [[1, 3], [0.82, 1.6], [0.5, 1.6]]) {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = k === 1 ? col2 : col;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.arc(0, 0, r * k, 0, TAU);
        ctx.stroke();
    }
    ctx.rotate(a.frame / 40);
    for (let i = 0; i < 28; i++) {
        const t = (i / 28) * TAU, z = i % 3 ? 2 : 4;
        ctx.globalAlpha = alpha * (0.5 + 0.5 * Math.sin(a.frame / 4 + i));
        ctx.fillStyle = i % 3 ? col2 : '#ffffff';
        ctx.fillRect(R(Math.cos(t) * r * 0.91) - z / 2, R(Math.sin(t) * r * 0.91) - z / 2, z, z);
    }
    ctx.rotate(-a.frame / 16);
    ctx.strokeStyle = col2;
    ctx.lineWidth = 1.5;
    for (const off of [0, Math.PI / 3]) {
        ctx.beginPath();
        for (let i = 0; i <= 3; i++) {
            const t = off + (i / 3) * TAU, x = Math.cos(t) * r * 0.8, y = Math.sin(t) * r * 0.8;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
    }
    ctx.restore();
}
// 着弾の爆ぜ（輪・光の玉）。k は 0→1
export function impactBurst(a, x, y, k, colA, colB, big = 1) {
    if (k <= 0 || k >= 1)
        return;
    const { ctx } = a;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
        const kk = clamp01(k * 1.3 - i * 0.15);
        if (kk <= 0 || kk >= 1)
            continue;
        ctx.globalAlpha = 1 - kk;
        ctx.strokeStyle = i === 1 ? '#ffffff' : i ? colB : colA;
        ctx.lineWidth = 5 * (1 - kk) + 1;
        ctx.beginPath();
        ctx.ellipse(x, y, (10 + kk * (110 + i * 30)) * big, (8 + kk * (62 + i * 14)) * big, 0, 0, TAU);
        ctx.stroke();
    }
    const r = 60 * big, g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, `${colA}99`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 1 - k;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * (0.6 + k), 0, TAU);
    ctx.fill();
    ctx.restore();
}
// 三日月の衝撃波。dir>0 は右へ、dir<0 は左へふくらむ
export function crescent(ctx, x, y, dir, sz, col, alpha) {
    const a0 = dir > 0 ? -1.25 : Math.PI - 1.25, a1 = dir > 0 ? 1.25 : Math.PI + 1.25;
    glowArc(ctx, x, y, 12 * sz, 30 * sz, a0, a1, 5 * sz, col, alpha);
    glowArc(ctx, x - dir * 9 * sz, y, 12 * sz, 24 * sz, a0, a1, 1.6, '#ffffff', alpha * 0.7);
    for (let i = 1; i <= 3; i++)
        glowLine(ctx, x - dir * (14 + i * 9) * sz, y - 12 * sz + i * 6, x - dir * (30 + i * 12) * sz, y - 12 * sz + i * 6, 1.2, col, alpha * (1 - i * 0.25));
}
// 光る弧（外側の色 → 白い芯）
export function glowArc(ctx, cx, cy, rx, ry, a0, a1, w, col, alpha) {
    if (alpha <= 0 || w <= 0 || a1 === a0)
        return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.globalAlpha = Math.min(1, alpha) * 0.35;
    ctx.strokeStyle = col;
    ctx.lineWidth = w * 2.4;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, a0, a1);
    ctx.stroke();
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, a0, a1);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, w * 0.35);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, a0, a1);
    ctx.stroke();
    ctx.restore();
}
// 十字の火花
export function starSpark(ctx, x, y, r, alpha, col = '#ffffff') {
    if (alpha <= 0 || r <= 0)
        return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.fillStyle = col;
    ctx.fillRect(R(x - r), R(y), R(r * 2), 1);
    ctx.fillRect(R(x), R(y - r), 1, R(r * 2));
    ctx.fillRect(R(x - r * 0.4), R(y - 1), R(r * 0.8), 3);
    ctx.fillRect(R(x - 1), R(y - r * 0.4), 3, R(r * 0.8));
    ctx.restore();
}
export function swordAt(ctx, x, tip, s, glow, frame, pal = SWORD_PAL.sword) {
    const B = 84 * s, Wd = 7 * s, gy = tip - B; // gy は鍔の位置
    ctx.save();
    if (glow > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(x - 30 * s, 0, x + 30 * s, 0);
        g.addColorStop(0, 'rgba(159,232,255,0)');
        g.addColorStop(0.5, `rgba(200,245,255,${0.45 * glow})`);
        g.addColorStop(1, 'rgba(159,232,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 30 * s, gy - 30 * s, 60 * s, B + 36 * s);
        ctx.restore();
    }
    // 刀身
    ctx.fillStyle = pal.edge;
    ctx.beginPath();
    ctx.moveTo(x - Wd - 1, gy);
    ctx.lineTo(x + Wd + 1, gy);
    ctx.lineTo(x + Wd + 1, tip - 14 * s);
    ctx.lineTo(x, tip + 2);
    ctx.lineTo(x - Wd - 1, tip - 14 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pal.blade;
    ctx.beginPath();
    ctx.moveTo(x - Wd, gy);
    ctx.lineTo(x + Wd, gy);
    ctx.lineTo(x + Wd, tip - 14 * s);
    ctx.lineTo(x, tip);
    ctx.lineTo(x - Wd, tip - 14 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(R(x - Wd + 2 * s), R(gy + 2), R(2 * s), R(B - 18 * s));
    ctx.fillStyle = '#7aa8c8';
    ctx.fillRect(R(x + Wd - 3 * s), R(gy + 2), R(2 * s), R(B - 18 * s));
    ctx.fillStyle = pal.fuller;
    ctx.fillRect(R(x - 1), R(gy + 6), 2, R(B - 26 * s)); // 樋の光
    ctx.fillStyle = '#ffffff'; // 刀身を流れるルーン
    for (let i = 0; i < 5; i++) {
        const yy = gy + 10 * s + ((i * 14 * s + frame * 2) % (B - 30 * s));
        ctx.fillRect(R(x - 1), R(yy), 2, 3);
    }
    // 鍔・宝石・柄・柄頭
    ctx.fillStyle = '#8a5a10';
    ctx.fillRect(R(x - 22 * s), R(gy - 6 * s), R(44 * s), R(7 * s));
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(R(x - 21 * s), R(gy - 5 * s), R(42 * s), R(4 * s));
    ctx.fillStyle = '#ffe9a0';
    ctx.fillRect(R(x - 21 * s), R(gy - 5 * s), R(42 * s), 1);
    ctx.fillStyle = pal.gem;
    ctx.fillRect(R(x - 3 * s), R(gy - 6 * s), R(6 * s), R(6 * s));
    ctx.fillStyle = '#4a2a10';
    ctx.fillRect(R(x - 3 * s), R(gy - 26 * s), R(6 * s), R(20 * s));
    ctx.fillStyle = '#7a4a22';
    for (let i = 0; i < 4; i++)
        ctx.fillRect(R(x - 3 * s), R(gy - 24 * s + i * 5 * s), R(6 * s), 1);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(R(x - 5 * s), R(gy - 32 * s), R(10 * s), R(7 * s));
    ctx.restore();
}
// 巨大な武器の絵（手持ちの武器の拡大）。cx の位置に、先端を下へ向けて tip の高さに置く
export function giantSprite(ctx, kind, cx, tip, scale, upright, glow, tilt = 0) {
    const sp = weaponSprite(kind), w = sp.width * scale, h = sp.height * scale;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (upright)
        ctx.translate(cx, tip + h / 2);
    else {
        ctx.translate(cx, tip - h / 2);
        ctx.rotate(Math.PI);
    }
    ctx.rotate(tilt);
    if (glow > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.5 * glow;
        for (const [ox, oy] of [[-3, 0], [3, 0], [0, -3], [0, 3]])
            ctx.drawImage(sp, -w / 2 + ox, -h / 2 + oy, w, h);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
    }
    ctx.drawImage(sp, -w / 2, -h / 2, w, h);
    ctx.restore();
}
export const SWORD_PAL = {
    sword: { edge: '#2a3a5a', blade: '#c8e4f4', fuller: '#5fcde4', gem: '#ff4fa0' },
    katana: { edge: '#4a2a3a', blade: '#f4f4ff', fuller: '#ff5a6e', gem: '#e43b44' },
    dagger: { edge: '#3a2a5a', blade: '#e0d4ff', fuller: '#a55bd8', gem: '#7bed9f' },
};
// 画面全体を暗くする（大技の静寂・時間停止）
export function dim(a, k, col = '#04030a') {
    if (k <= 0)
        return;
    const { ctx } = a;
    ctx.save();
    ctx.globalAlpha = Math.min(1, k);
    ctx.fillStyle = col;
    ctx.fillRect(-a.W, -a.H, a.W * 3, a.H * 3);
    ctx.restore();
}
// 放射状の光（中心が白い円）
export function glowDisc(ctx, x, y, r, col, alpha, core = 1) {
    if (alpha <= 0 || r <= 0)
        return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${core})`);
    g.addColorStop(0.35, `${col}cc`);
    g.addColorStop(1, `${col}00`);
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.restore();
}
// 地面の輪（衝撃波）。k は 0→1、n 重
export function groundRings(ctx, x, y, k, col, big = 150, n = 3) {
    if (k <= 0 || k >= 1)
        return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
        const kk = clamp01(k * 1.3 - i * 0.15);
        if (kk <= 0 || kk >= 1)
            continue;
        ctx.globalAlpha = (1 - kk) * 0.9;
        ctx.strokeStyle = i === 1 ? '#ffffff' : col;
        ctx.lineWidth = 4 * (1 - kk) + 1;
        ctx.beginPath();
        ctx.ellipse(x, y, 10 + kk * (big + i * 40), 3 + kk * (big * 0.24 + i * 10), 0, 0, TAU);
        ctx.stroke();
    }
    ctx.restore();
}
// 稲妻（ジグザグ。枝わかれつき）。同じ seed なら同じ形。frame を混ぜるとちらつく
export function bolt(ctx, x0, y0, x1, y1, seed, w, col, alpha, jag = 12, branches = 2) {
    if (alpha <= 0)
        return;
    const rng = new Rng(seed);
    const n = Math.max(4, Math.round(Math.hypot(x1 - x0, y1 - y0) / 10));
    const pts = [];
    for (let i = 0; i <= n; i++) {
        const t = i / n, j = i === 0 || i === n ? 0 : rng.range(-jag, jag);
        const nx = -(y1 - y0), ny = x1 - x0, L = Math.hypot(nx, ny) || 1;
        pts.push({ x: lerp(x0, x1, t) + (nx / L) * j, y: lerp(y0, y1, t) + (ny / L) * j });
    }
    const path = (q) => { ctx.beginPath(); q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); };
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'square';
    for (const [lw, c, al] of [[w * 3, col, 0.3], [w, col, 1], [Math.max(1, w * 0.4), '#ffffff', 1]]) {
        ctx.globalAlpha = Math.min(1, alpha) * al;
        ctx.strokeStyle = c;
        ctx.lineWidth = lw;
        path(pts);
        ctx.stroke();
    }
    for (let b = 0; b < branches; b++) {
        const i0 = 1 + Math.floor(rng.range(0, n - 2)), p0 = pts[i0], ang = Math.atan2(y1 - y0, x1 - x0) + rng.range(-1, 1);
        const L = rng.range(14, 34);
        let p = p0;
        const q = [p];
        for (let k = 0; k < 3; k++) {
            p = { x: p.x + Math.cos(ang) * L / 3 + rng.range(-5, 5), y: p.y + Math.sin(ang) * L / 3 + rng.range(-5, 5) };
            q.push(p);
        }
        ctx.globalAlpha = Math.min(1, alpha) * 0.8;
        ctx.strokeStyle = col;
        ctx.lineWidth = Math.max(1, w * 0.5);
        path(q);
        ctx.stroke();
    }
    ctx.restore();
}
// 縦の速度線（落ちる・昇る）。dir=1 で下向きに流れる
export function speedLines(ctx, cx, w, top, bottom, frame, alpha, col = '#ffffff', n = 14, ang = 0) {
    if (alpha <= 0)
        return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
        const x = cx - w / 2 + ((i * 37) % 97) / 97 * w, L = 18 + ((i * 13) % 5) * 8;
        const y = top + (((i * 53 + frame * 9) % 1000) / 1000) * (bottom - top);
        ctx.globalAlpha = alpha * (0.35 + 0.65 * ((i * 7) % 3) / 2);
        ctx.strokeStyle = i % 4 ? col : '#ffffff';
        ctx.lineWidth = i % 5 ? 1 : 2;
        ctx.beginPath();
        ctx.moveTo(R(x), R(y));
        ctx.lineTo(R(x + Math.sin(ang) * L), R(y - Math.cos(ang) * L));
        ctx.stroke();
    }
    ctx.restore();
}
// 飛び散る光の粒（放射）。k は 0→1
export function sparkBurst(ctx, x, y, k, seed, cols, n = 24, spread = 70, grav = 0, size = 2) {
    if (k <= 0 || k >= 1)
        return;
    const rng = new Rng(seed);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
        const an = rng.range(0, TAU), sp = rng.range(spread * 0.3, spread), s = i % 4 ? size : size + 1;
        const px = x + Math.cos(an) * sp * ease(k), py = y + Math.sin(an) * sp * ease(k) * 0.8 + grav * k * k;
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = cols[i % cols.length];
        ctx.fillRect(R(px), R(py), s, s);
    }
    ctx.restore();
}
// 舞う花びら・木の葉・羽根など（小さな斜めの菱形）。t は経過（ずっと増える値）
export function petals(ctx, x, y, w, h, t, seed, cols, alpha, n = 18, fall = 1) {
    if (alpha <= 0)
        return;
    const rng = new Rng(seed);
    ctx.save();
    for (let i = 0; i < n; i++) {
        const ph = rng.next(), sp = rng.range(0.6, 1.4), u = (ph + t * sp) % 1;
        const px = x + rng.range(-w / 2, w / 2) + Math.sin(u * 9 + i) * 8, py = y - h / 2 + u * h * fall;
        const rot = u * 10 + i;
        ctx.globalAlpha = alpha * Math.sin(u * Math.PI);
        ctx.fillStyle = cols[i % cols.length];
        ctx.save();
        ctx.translate(R(px), R(py));
        ctx.rotate(rot);
        ctx.fillRect(-2, -1, 4, 2);
        ctx.fillRect(-1, -2, 2, 4);
        ctx.restore();
    }
    ctx.restore();
}
// クレーター（地面のえぐれ）
export function crater(ctx, x, y, rx, alpha, rim = '#ffb04a') {
    if (alpha <= 0 || rx <= 0)
        return;
    ctx.save();
    ctx.globalAlpha = alpha * 0.85;
    ctx.fillStyle = '#0a0610';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, rx * 0.26, 0, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = rim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, rx * 0.26, 0, Math.PI, TAU);
    ctx.stroke();
    ctx.restore();
}
// 主役の影（分身・大きな影・光の騎士）。主役の姿を、色で塗りつぶして描く
let silCanvas = null;
export function heroSilhouette(ctx, draw, x, fy, scale, col, alpha, glow = 0) {
    if (alpha <= 0 || typeof document === 'undefined')
        return;
    const W = 64, H = 64;
    silCanvas ??= document.createElement('canvas');
    const cv = silCanvas;
    cv.width = W;
    cv.height = H;
    const c = cv.getContext('2d');
    c.clearRect(0, 0, W, H);
    c.imageSmoothingEnabled = false;
    draw(c); // 足元が (32, 56) にくるように描いてもらう
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = col;
    c.fillRect(0, 0, W, H);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    const dw = W * scale, dh = H * scale, dx = x - 32 * scale, dy = fy - 56 * scale;
    if (glow > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha * glow * 0.5;
        for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2]])
            ctx.drawImage(cv, dx + ox * scale, dy + oy * scale, dw, dh);
        ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = alpha;
    ctx.drawImage(cv, dx, dy, dw, dh);
    ctx.restore();
}
// 太い光の帯（弧）。中心 (cx,cy)、半径 r、幅 w、a0→a1。斬撃の軌跡に
export function bandArc(ctx, cx, cy, r, w, a0, a1, cols, alpha, ccw = false) {
    if (alpha <= 0 || a0 === a1)
        return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'butt';
    for (const [lw, c, al] of [[w * 1.8, cols[0], 0.25], [w, cols[0], 0.9], [w * 0.55, cols[1], 1], [Math.max(1, w * 0.18), '#ffffff', 1]]) {
        ctx.globalAlpha = Math.min(1, alpha) * al;
        ctx.strokeStyle = c;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.arc(cx, cy, r, a0, a1, ccw);
        ctx.stroke();
    }
    ctx.restore();
}
// 三日月形の斬撃の軌跡（先が細い）。弧の始め → 終わりで太さが変わる
export function slashArc(ctx, cx, cy, r, a0, a1, wMax, cols, alpha) {
    if (alpha <= 0 || a0 === a1)
        return;
    const n = 24;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [k, c, al] of [[1.6, cols[0], 0.3], [1, cols[0], 0.9], [0.5, cols[1], 1], [0.15, '#ffffff', 1]]) {
        ctx.globalAlpha = Math.min(1, alpha) * al;
        ctx.fillStyle = c;
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
            const t = i / n, an = lerp(a0, a1, t), w = wMax * k * Math.sin(Math.PI * Math.pow(t, 0.7)) / 2;
            ctx.lineTo(cx + Math.cos(an) * (r + w), cy + Math.sin(an) * (r + w));
        }
        for (let i = n; i >= 0; i--) {
            const t = i / n, an = lerp(a0, a1, t), w = wMax * k * Math.sin(Math.PI * Math.pow(t, 0.7)) / 2;
            ctx.lineTo(cx + Math.cos(an) * (r - w), cy + Math.sin(an) * (r - w));
        }
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();
}
// 直線の斬撃（両端が細い、まんなかが太い）
export function slashLine(ctx, x0, y0, x1, y1, wMax, cols, alpha) {
    if (alpha <= 0)
        return;
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [k, c, al] of [[1.8, cols[0], 0.28], [1, cols[0], 0.9], [0.5, cols[1], 1], [0.16, '#ffffff', 1]]) {
        const w = (wMax * k) / 2;
        ctx.globalAlpha = Math.min(1, alpha) * al;
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + dx * 0.4 + nx * w, y0 + dy * 0.4 + ny * w);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x0 + dx * 0.4 - nx * w, y0 + dy * 0.4 - ny * w);
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();
}
// ---- 召喚: 足元の魔法陣 → 天が割れて光の柱 → 巨大な剣がゆっくり降り、一気に突き刺さる → 光のドーム・余震 ----
export function summonCircle(a, hero) {
    const { ctx, phase: p } = a;
    const T = ULT_T.summon;
    const k = win(p, T.circle, T.circle + 0.06), out = 1 - win(p, T.impact + 0.04, T.impact + 0.12);
    if (k <= 0 || out <= 0)
        return;
    const r = 48 * ease(k), rot = a.frame / 30;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(hero.x, hero.y + 1);
    ctx.scale(1, 0.34);
    ctx.globalAlpha = 0.22 * out;
    ctx.fillStyle = '#5fcde4';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = out;
    ctx.strokeStyle = '#9fe8ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.82, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.4, 0, TAU);
    ctx.stroke();
    ctx.rotate(rot);
    ctx.fillStyle = '#ffe9a0';
    for (let i = 0; i < 24; i++) {
        const t = (i / 24) * TAU, s = i % 3 ? 2 : 4;
        ctx.fillRect(R(Math.cos(t) * r * 0.91) - s / 2, R(Math.sin(t) * r * 0.91) - s / 2, s, s);
    }
    ctx.strokeStyle = '#9fe8ff';
    ctx.lineWidth = 1.5;
    ctx.rotate(-rot * 2.5);
    for (const off of [0, Math.PI / 3]) {
        ctx.beginPath();
        for (let i = 0; i <= 3; i++) {
            const t = off + (i / 3) * TAU, x = Math.cos(t) * r * 0.8, y = Math.sin(t) * r * 0.8;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
    }
    ctx.restore();
}
//# sourceMappingURL=ultkit.js.map