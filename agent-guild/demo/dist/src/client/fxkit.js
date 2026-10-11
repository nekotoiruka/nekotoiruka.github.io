// ボスの演出（bossmotion.ts・bossfx.ts）で使う、小さな数学の関数と、重ね描きの部品（光・煙・ひび・弧・牙・爪・触手・脚・蝙蝠・矢・石…）。
// どれも「進行度 t」だけで形が決まる（シークしても同じ絵になる）。位置は画面のドット座標。
import { flashScale } from './motion.js';
export const TAU = Math.PI * 2;
export const clamp01 = (t) => Math.max(0, Math.min(1, t));
export const win = (p, a, b) => clamp01((p - a) / (b - a));
export const bump = (p, a, b) => (p < a || p > b ? 0 : Math.sin(((p - a) / (b - a)) * Math.PI));
export const ease = (t) => t * t * (3 - 2 * t);
export const lerp = (a, b, t) => a + (b - a) * t;
export const fract = (x) => x - Math.floor(x);
export const hash = (i, k = 0) => fract(Math.sin(i * 12.9898 + k * 78.233) * 43758.5453);
export const R = Math.round;
/** 加算の光の玉 */
export function glowAt(ctx, x, y, r, c0, c1, a) {
    if (a <= 0 || r <= 0)
        return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, a);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c0);
    g.addColorStop(0.45, c1 + 'c0');
    g.addColorStop(1, c1 + '00');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.restore();
}
/** ふわっと広がって消える粒（煙・砂ぼこり・泡・霧） */
export function puffs(ctx, x, y, o) {
    if (o.alpha <= 0 || o.n <= 0)
        return;
    ctx.save();
    for (let i = 0; i < o.n; i++) {
        const u = fract(o.t * (o.speed ?? 1) + i / o.n + hash(i, o.seed ?? 0) * 0.3);
        const px = x + o.dx * u + (hash(i, 3 + (o.seed ?? 0)) - 0.5) * (o.spread ?? 6);
        const py = y + o.dy * u + (hash(i, 7 + (o.seed ?? 0)) - 0.5) * (o.spread ?? 6) * 0.6;
        ctx.globalAlpha = Math.min(1, o.alpha) * (1 - u) * (u < 0.1 ? u * 10 : 1);
        ctx.fillStyle = o.color;
        ctx.beginPath();
        ctx.arc(R(px), R(py), Math.max(0.6, lerp(o.r0, o.r1, u)), 0, TAU);
        ctx.fill();
    }
    ctx.restore();
}
/** 地面にひろがる土ぼこりの輪 */
export function dustRing(ctx, x, y, k, size, color = '#c8b48a') {
    if (k <= 0 || k >= 1)
        return;
    ctx.save();
    ctx.globalAlpha = (1 - k) * 0.7;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3 * (1 - k) + 1;
    ctx.beginPath();
    ctx.ellipse(x, y, 10 + k * size, 3 + k * size * 0.28, 0, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = color;
    for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * TAU, rr = 6 + k * size * 0.9, s = 2 + (1 - k) * 3;
        ctx.globalAlpha = (1 - k) * 0.6;
        ctx.fillRect(R(x + Math.cos(ang) * rr - s / 2), R(y + Math.sin(ang) * rr * 0.3 - k * 10 - s / 2), R(s), R(s));
    }
    ctx.restore();
}
export function sparkle(ctx, x, y, r, color, a) {
    if (a <= 0)
        return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, a);
    ctx.fillStyle = color;
    ctx.fillRect(R(x - r), R(y), R(r * 2), 1);
    ctx.fillRect(R(x), R(y - r), 1, R(r * 2));
    ctx.fillRect(R(x - 1), R(y - 1), 3, 3);
    ctx.restore();
}
/** 地面のひび（折れ線）。dir は向き（ラジアン）。k は伸びた割合 */
export function crack(ctx, x, y, len, dir, seed, k, col, glow, w = 2) {
    if (k <= 0)
        return;
    const pts = [[x, y]];
    let cx = x, cy = y;
    const n = 9;
    for (let i = 0; i < n; i++) {
        const a = dir + (hash(i, seed) - 0.5) * 0.9;
        cx += Math.cos(a) * (len / n);
        cy += Math.sin(a) * (len / n) * 0.42; // 奥行きでつぶす
        pts.push([cx, cy]);
    }
    const m = Math.max(1, Math.round(pts.length * k));
    ctx.save();
    ctx.lineJoin = 'round';
    const draw = (c, lw) => { ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath(); pts.slice(0, m).forEach(([px, py], i) => (i ? ctx.lineTo(R(px), R(py)) : ctx.moveTo(R(px), R(py)))); ctx.stroke(); };
    if (glow) {
        ctx.globalCompositeOperation = 'lighter';
        draw(glow, w + 3);
        ctx.globalCompositeOperation = 'source-over';
    }
    draw(col, w);
    ctx.restore();
}
/** 薙ぎ払いの弧: 内側の半径 rIn・外側の半径 rOut のあいだを a0〜a1 で塗る、先細りの三日月（t: 0〜1 でどこまで振り抜いたか） */
export function crescent(ctx, cx, cy, rIn, rOut, a0, a1, t, fill, edge, squash = 1) {
    if (t <= 0)
        return;
    const head = lerp(a0, a1, clamp01(t)), tailA = lerp(a0, a1, clamp01(t - 0.55));
    const steps = 14;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, squash);
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
        const u = i / steps, a = lerp(tailA, head, u), r = lerp(rIn, rOut, Math.sin(u * Math.PI * 0.5 + 0.0));
        i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    for (let i = steps; i >= 0; i--) {
        const u = i / steps, a = lerp(tailA, head, u), r = lerp(rIn, rIn * 0.82 + (rOut - rIn) * 0.12, Math.sin(u * Math.PI * 0.5));
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
}
/** 牙（付け根 x,y から ang の向きへ len。先がとがる） */
export function fangShape(ctx, x, y, len, w, ang, body = '#f4ecd0', tip = '#ffffff', shade = '#b8a878') {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, -w / 2);
    ctx.quadraticCurveTo(len * 0.7, -w * 0.45, len, 0);
    ctx.quadraticCurveTo(len * 0.7, w * 0.15, 0, w / 2);
    ctx.closePath();
    ctx.fillStyle = body;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, w / 2);
    ctx.quadraticCurveTo(len * 0.7, w * 0.15, len, 0);
    ctx.quadraticCurveTo(len * 0.6, w * 0.4, 0, w / 2);
    ctx.closePath();
    ctx.fillStyle = shade;
    ctx.fill();
    ctx.fillStyle = tip;
    ctx.fillRect(R(len * 0.7), -1, R(len * 0.25), 1);
    ctx.strokeStyle = '#2b1d2e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -w / 2);
    ctx.quadraticCurveTo(len * 0.7, -w * 0.45, len, 0);
    ctx.stroke();
    ctx.restore();
}
/** 長く伸びた爪（反りのある細い刃） */
export function nail(ctx, x, y, len, ang, curve, body = '#7a1020', edge = '#ff6b8a', w = 1.6) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, -w);
    ctx.quadraticCurveTo(len * 0.6, -w * 0.9 - curve, len, -curve * 1.6);
    ctx.quadraticCurveTo(len * 0.6, w * 0.5 - curve * 0.6, 0, w);
    ctx.closePath();
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(0, -w);
    ctx.quadraticCurveTo(len * 0.6, -w * 0.9 - curve, len, -curve * 1.6);
    ctx.stroke();
    ctx.restore();
}
/** 蝙蝠（小さな 7x4 ドット）。flap 0..1 で羽ばたき */
export function bat(ctx, x, y, flap, col = '#1a0a24', s = 1) {
    const up = flap > 0.5;
    ctx.fillStyle = col;
    const px = (dx, dy, w = 1, h = 1) => ctx.fillRect(R(x + dx * s), R(y + dy * s), Math.max(1, R(w * s)), Math.max(1, R(h * s)));
    px(-1, 0, 3, 2);
    px(-1, -1, 1, 1);
    px(1, -1, 1, 1); // 体と耳
    if (up) {
        px(-4, -2, 3, 1);
        px(-5, -3, 1, 1);
        px(2, -2, 3, 1);
        px(5, -3, 1, 1);
    }
    else {
        px(-4, 1, 3, 1);
        px(-5, 2, 1, 1);
        px(2, 1, 3, 1);
        px(5, 2, 1, 1);
    }
    ctx.fillStyle = '#ff3050';
    px(-1, 0, 1, 1);
    px(1, 0, 1, 1);
}
/** ごつごつした石 */
export function rock(ctx, x, y, r, rot, seed, body = '#7a6a52', hi = '#a8987a', lo = '#4a3a2a') {
    ctx.save();
    ctx.translate(R(x), R(y));
    ctx.rotate(rot);
    ctx.beginPath();
    const n = 7;
    for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU, rr = r * (0.72 + hash(i, seed) * 0.4);
        i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = lo;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = hi;
    ctx.fillRect(R(-r * 0.4), R(-r * 0.5), Math.max(1, R(r * 0.5)), Math.max(1, R(r * 0.25)));
    ctx.restore();
}
/** 氷や水晶のとげ（付け根から ang の向きへ len） */
export function shard(ctx, x, y, len, w, ang, body = '#bfe8ff', hi = '#ffffff', lo = '#4a8ac0') {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, -w / 2);
    ctx.lineTo(len, 0);
    ctx.lineTo(0, w / 2);
    ctx.closePath();
    ctx.fillStyle = body;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len, 0);
    ctx.lineTo(0, w / 2);
    ctx.closePath();
    ctx.fillStyle = lo;
    ctx.fill();
    ctx.fillStyle = hi;
    ctx.fillRect(R(len * 0.15), -1, Math.max(1, R(len * 0.35)), 1);
    ctx.restore();
}
/** 矢（先が ang の向き） */
export function arrow(ctx, x, y, ang, len = 14) {
    ctx.save();
    ctx.translate(R(x), R(y));
    ctx.rotate(ang);
    ctx.fillStyle = '#7a5a34';
    ctx.fillRect(-len, -0.5, len, 1.5);
    ctx.fillStyle = '#d8d8e0';
    ctx.beginPath();
    ctx.moveTo(0, -2.5);
    ctx.lineTo(5, 0.2);
    ctx.lineTo(0, 2.8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(-len, -2, 3, 1);
    ctx.fillRect(-len, 1.5, 3, 1);
    ctx.restore();
}
/** 氷の槍（長い柄＋氷の穂先。先が ang の向き） */
export function iceSpear(ctx, x, y, ang, len = 40) {
    ctx.save();
    ctx.translate(R(x), R(y));
    ctx.rotate(ang);
    ctx.fillStyle = '#e6f6ff';
    ctx.fillRect(-len, -1.5, len, 3);
    ctx.fillStyle = '#8fd3ff';
    ctx.fillRect(-len, 0.5, len, 1.5);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(14, 0);
    ctx.lineTo(0, 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#6aaee0';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(14, 0);
    ctx.lineTo(0, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}
/** 吸盤つきの触手（折れ線 pts に沿って、太さ w0→w1。吸盤は下側に並べる） */
export function tentacle(ctx, pts, w0, w1, body = '#7a2a5a', dark = '#3e1230', sucker = '#f0b8d0') {
    if (pts.length < 2)
        return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const seg = (col, k) => {
        for (let i = 0; i < pts.length - 1; i++) {
            const u = i / (pts.length - 1);
            ctx.strokeStyle = col;
            ctx.lineWidth = Math.max(1, lerp(w0, w1, u) * k);
            ctx.beginPath();
            ctx.moveTo(R(pts[i][0]), R(pts[i][1]));
            ctx.lineTo(R(pts[i + 1][0]), R(pts[i + 1][1]));
            ctx.stroke();
        }
    };
    seg(dark, 1.25);
    seg(body, 1);
    ctx.fillStyle = sucker;
    for (let i = 1; i < pts.length - 1; i++) {
        const u = i / (pts.length - 1), [x, y] = pts[i], [nx, ny] = pts[i + 1];
        const a = Math.atan2(ny - y, nx - x) + Math.PI / 2, r = lerp(w0, w1, u) * 0.32;
        ctx.fillRect(R(x + Math.cos(a) * r - 1), R(y + Math.sin(a) * r - 1), 2, 2);
    }
    ctx.restore();
}
/** 節のある脚（蜘蛛）。付け根 (x0,y0) → ひざ → 足先 (x2,y2)。毛つき */
export function spiderLeg(ctx, x0, y0, kx, ky, x2, y2, w = 4, body = '#3a2a30', band = '#8a7a80') {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const path = () => { ctx.beginPath(); ctx.moveTo(R(x0), R(y0)); ctx.lineTo(R(kx), R(ky)); ctx.lineTo(R(x2), R(y2)); };
    ctx.strokeStyle = '#1a1014';
    ctx.lineWidth = w + 2;
    path();
    ctx.stroke();
    ctx.strokeStyle = body;
    ctx.lineWidth = w;
    path();
    ctx.stroke();
    ctx.strokeStyle = band;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(R(kx - 2), R(ky - 1));
    ctx.lineTo(R(kx + 2), R(ky + 1));
    ctx.stroke();
    // 足先の爪
    const a = Math.atan2(y2 - ky, x2 - kx);
    ctx.strokeStyle = '#d8c8b0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(R(x2), R(y2));
    ctx.lineTo(R(x2 + Math.cos(a) * 4), R(y2 + Math.sin(a) * 4));
    ctx.stroke();
    ctx.fillStyle = '#5a4a50';
    for (let i = 0; i < 3; i++) {
        const u = 0.25 + i * 0.25;
        ctx.fillRect(R(lerp(x0, kx, u)), R(lerp(y0, ky, u) - w * 0.7), 1, 2);
    }
    ctx.restore();
}
/** 蜘蛛の巣（中心 x,y・半径 r・k で広がる） */
export function webNet(ctx, x, y, r, k, col = '#f4f6ff') {
    if (k <= 0)
        return;
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = 1;
    ctx.globalAlpha *= 0.95;
    const spokes = 8;
    for (let i = 0; i < spokes; i++) {
        const a = (i / spokes) * TAU;
        ctx.beginPath();
        ctx.moveTo(R(x), R(y));
        ctx.lineTo(R(x + Math.cos(a) * r * k), R(y + Math.sin(a) * r * k * 0.55));
        ctx.stroke();
    }
    for (let j = 1; j <= 3; j++) {
        const rr = (r * k * j) / 3;
        ctx.beginPath();
        for (let i = 0; i <= spokes; i++) {
            const a = (i / spokes) * TAU, rj = rr * (1 - 0.12 * Math.sin(i * 2.3 + j));
            const px = x + Math.cos(a) * rj, py = y + Math.sin(a) * rj * 0.55;
            i ? ctx.lineTo(R(px), R(py)) : ctx.moveTo(R(px), R(py));
        }
        ctx.stroke();
    }
    ctx.restore();
}
/** 小さなゴブリンのシルエット（突進する群れ用。槍つき）。s は大きさ */
export function goblinSil(ctx, x, y, s, step, body = '#2e4a24', lit = '#6aa04a') {
    const f = Math.sin(step * 3) > 0 ? 1 : 0;
    ctx.fillStyle = body;
    ctx.fillRect(R(x - 3 * s), R(y - 10 * s), R(6 * s), R(6 * s)); // 胴
    ctx.fillRect(R(x - 2 * s), R(y - 15 * s), R(5 * s), R(5 * s)); // 頭
    ctx.fillRect(R(x - 4 * s), R(y - 15 * s), R(2 * s), R(2 * s)); // 耳
    ctx.fillRect(R(x - 3 * s), R(y - 4 * s + f), R(2 * s), R(4 * s));
    ctx.fillRect(R(x + 1 * s), R(y - 4 * s + (1 - f)), R(2 * s), R(4 * s)); // 脚
    ctx.fillStyle = lit;
    ctx.fillRect(R(x), R(y - 14 * s), R(2 * s), R(1 * s));
    ctx.fillStyle = '#c8c8d0';
    ctx.fillRect(R(x + 3 * s), R(y - 16 * s), R(1 * s), R(14 * s));
    ctx.fillRect(R(x + 2 * s), R(y - 18 * s), R(3 * s), R(3 * s)); // 槍
}
/** 雲のような霧のかたまり */
export function mistBlob(ctx, x, y, rx, ry, col, a) {
    if (a <= 0)
        return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, a);
    ctx.fillStyle = col;
    for (let i = 0; i < 5; i++) {
        const ox = (hash(i, 1) - 0.5) * rx * 1.4, oy = (hash(i, 2) - 0.5) * ry;
        ctx.beginPath();
        ctx.ellipse(R(x + ox), R(y + oy), rx * (0.5 + hash(i, 3) * 0.4), ry * (0.5 + hash(i, 4) * 0.4), 0, 0, TAU);
        ctx.fill();
    }
    ctx.restore();
}
/** 画面ぜんたいの閃光（視差効果を減らす設定では弱める） */
export function screenFlash(ctx, W, H, k, color = '#ffffff', max = 0.5) {
    if (k <= 0)
        return;
    ctx.save();
    ctx.globalAlpha = max * k * flashScale();
    ctx.fillStyle = color;
    ctx.fillRect(-W, -H, W * 3, H * 3);
    ctx.restore();
}
/** 空が暗くなる（上ほど濃い）。急降下・影の予兆 */
export function skyDark(ctx, W, H, k, top = 'rgba(5,4,12,0.85)', mid = 'rgba(5,4,12,0.35)', low = 'rgba(5,4,12,0.1)') {
    if (k <= 0)
        return;
    ctx.save();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top);
    g.addColorStop(0.7, mid);
    g.addColorStop(1, low);
    ctx.globalAlpha = k;
    ctx.fillStyle = g;
    ctx.fillRect(-W, -H, W * 3, H * 3);
    ctx.restore();
}
//# sourceMappingURL=fxkit.js.map