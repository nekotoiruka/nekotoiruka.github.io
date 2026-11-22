import { Rng } from '../shared/rng.js';
import { bump, clamp01, ease, flash, glowDisc, glowLine, lerp, R, skyDisc, TAU, win } from './ultkit.js';
/** 叫び終える瞬間（scenes.ts の shoutEndT と同じ式。scenes.ts を読みこむと循環するので、ここに写す） */
export const shoutEnd = (c) => c.doneT + (c.impact - c.doneT) * 0.6;
/** 溜め（叫び終えてから着弾まで）の進み具合 0→1 */
export const chargeK = (c, p, lead = 0) => win(p, shoutEnd(c), c.impact - lead);
/**
 * 重い一撃の手ごたえを作る。
 * hits: 着弾の前の小さな当たり（星の雨の一本一本など。t は進行度、k は強さ 0..1）
 * big: 着弾の重さ（1 = 小さな太陽と同じ）/ push: のけぞりの大きさ（ドット）/ rumble: 溜めの地鳴りの強さ
 * after: 着弾のあとも続く当たり（渦・雷の連打など）
 */
export function heavyFeel(o = {}) {
    const big = o.big ?? 1, push = o.push ?? 9, rumble = o.rumble ?? 1; // 押しすぎると、撃破の寄り（カメラ）でボスが画面の左へはみ出す
    const cache = new WeakMap();
    return (c, p, frame) => {
        let hs = cache.get(c);
        if (!hs) {
            hs = [...(o.hits?.(c) ?? []), ...(o.after?.(c) ?? [])];
            cache.set(c, hs);
        }
        const f = { shake: 0, dx: 0, dy: 0, hurt: false, flash: false, squash: 0 };
        // 地鳴り: 残り3節から高まり、溜めでいちばん強く（光の柱と同じ形。rumble 倍）
        const r0 = c.start + Math.max(0, c.len - 3) * c.verse;
        if (p >= r0 && p < c.impact)
            f.shake = (1 + win(p, r0, c.doneT) * 0.6 + chargeK(c, p) * 1.8) * rumble;
        // 小さな当たり: そのたびに一瞬ゆれて、ボスが少し押される
        for (const h of hs) {
            const age = p - h.t;
            if (age < 0 || age > 0.03)
                continue;
            const k = 1 - age / 0.03;
            f.shake = Math.max(f.shake, 2 + 4 * h.k * k);
            f.dx -= Math.round(4 * h.k * k);
            f.hurt = true;
            if (age < 0.003 && !o.noHitFlash)
                f.flash = frame % 6 < 2;
        }
        // 着弾: 大きくゆれて（だんだん収まる）、ボスは大きくのけぞって沈み、白く点滅する
        const age = p - c.impact;
        if (age >= 0 && age < 0.22) {
            const k = 1 - age / 0.22;
            f.shake = Math.max(f.shake, 10 * big * k * k + 1.5 * k);
            const back = age < 0.012 ? ease(age / 0.012) : 1 - 0.7 * ease(clamp01((age - 0.012) / 0.16));
            f.dx -= Math.round(push * big * back);
            f.dy += Math.round((o.sink ?? 3) * big * back);
            f.squash = Math.round(3 * big * back);
            f.hurt = true;
            if (age < 0.04)
                f.flash = frame % 4 < 2;
        }
        return f;
    };
}
/** 色を混ぜた16進（a→b） */
export function mix(a, b, t) {
    const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
    return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * clamp01(t)).toString(16).padStart(2, '0')).join('');
}
/** 立ちのぼる煙（余韻）。k は 0→1 */
export function smoke(a, x, y, k, seed, col = '#6a6070', n = 12, w = 60) {
    if (k <= 0 || k >= 1)
        return;
    const { ctx } = a;
    const rng = new Rng(seed);
    ctx.save();
    for (let i = 0; i < n; i++) {
        const dx = rng.range(-w / 2, w / 2), up = rng.range(30, 80), r = rng.range(5, 11);
        ctx.globalAlpha = 0.45 * Math.sin(k * Math.PI) * rng.range(0.6, 1);
        ctx.fillStyle = i % 3 ? col : '#a89ab0';
        ctx.beginPath();
        ctx.arc(x + dx + Math.sin(k * 4 + i) * 4, y - up * ease(k) - 4, r * (0.6 + k), 0, TAU);
        ctx.fill();
    }
    ctx.restore();
}
// ===================== 大魔法の規模を出す共通の部品（#104 の2回目: 「必殺技より派手に」「空の魔法陣から生まれる形に」） =====================
/**
 * 溜め: 空の魔法陣が大魔法の色に染まって大きく広がり、唱えた全員の頭上から色の光の糸が陣へのび、画面じゅうの光の粒が陣へ吸いこまれる。
 * 7人の詠唱が一つの陣に集まって、ひとつの大魔法になる見え方。hue: 陣の色（skyDisc の色相）/ col: 光の色
 */
export function skyGather(a, c, sky, heads, cols, hue, col, power = 1) {
    const { ctx, phase: p } = a;
    const k = chargeK(c, p), out = 1 - win(p, c.impact - 0.002, c.impact + 0.03);
    if (k <= 0 || out <= 0)
        return;
    // 広がる陣（輪の外側に、大魔法の色の大きな陣を重ねる）
    skyDisc(a, sky.x, sky.y, (110 + 70 * ease(k)) * power, k * out, hue);
    skyDisc(a, sky.x, sky.y, (60 + 30 * ease(k)) * power, k * out * 0.8, (hue + 30) % 360);
    // 陣の中心の光（溜めるほど大きく、ちらつく）
    const fl = 0.85 + 0.15 * Math.sin(a.frame / 2);
    glowDiscK(ctx, sky.x, sky.y, (20 + 36 * k) * power * fl, col, 0.8 * k * out);
    // 唱えた全員の頭上から、陣へ色の光の糸（太く、ゆらぎながら）
    heads.forEach((h, i) => {
        if (!h)
            return;
        const w = 1 + 2.5 * k, cc = cols[i] ?? '#ffffff', mx = (h.x + sky.x) / 2, my = Math.min(h.y, sky.y) - 20 - 10 * Math.sin(a.frame / 8 + i);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        for (const [lw, al, cl] of [[w * 3, 0.25, cc], [w, 0.9, cc], [Math.max(1, w * 0.4), 1, '#ffffff']]) {
            ctx.globalAlpha = al * k * out;
            ctx.strokeStyle = cl;
            ctx.lineWidth = lw;
            ctx.beginPath();
            ctx.moveTo(h.x, h.y);
            ctx.quadraticCurveTo(mx, my, sky.x, sky.y);
            ctx.stroke();
        }
        ctx.restore();
        // 糸を上る光の玉
        const u = (a.frame / 20 + i * 0.13) % 1, x = (1 - u) * (1 - u) * h.x + 2 * (1 - u) * u * mx + u * u * sky.x, y = (1 - u) * (1 - u) * h.y + 2 * (1 - u) * u * my + u * u * sky.y;
        glowDiscK(ctx, x, y, 6, cc, k * out);
    });
    // 画面じゅうから陣へ吸いこまれる光の粒（長い尾）
    const rng = new Rng(`${a.seed}:gather`);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 90 * power; i++) {
        const x0 = rng.range(-20, a.W + 20), y0 = rng.range(0, a.H), u = (rng.next() + p * rng.range(30, 60)) % 1, e = u * u;
        const x = lerp(x0, sky.x, e), y = lerp(y0, sky.y, e), x2 = lerp(x0, sky.x, Math.max(0, e - 0.08)), y2 = lerp(y0, sky.y, Math.max(0, e - 0.08));
        ctx.globalAlpha = k * out * Math.sin(u * Math.PI);
        ctx.strokeStyle = i % 3 ? col : '#ffffff';
        ctx.lineWidth = i % 4 ? 1 : 2;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x, y);
        ctx.stroke();
    }
    ctx.restore();
}
/** 光の玉（中心は白） */
export function glowDiscK(ctx, x, y, r, col, alpha) {
    if (alpha <= 0 || r <= 0)
        return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, col + 'dd');
    g.addColorStop(1, col + '00');
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.restore();
}
/** 炸裂の光が画面いっぱいに広がる（中心から色がかかり、だんだん引く）。k は 0→1 */
export function bloom(a, x, y, k, col, max = 0.55, r = 460) {
    max *= 0.55; // 白飛びしないよう、どの大魔法も控えめに（色はのせるが、絵は見える）
    if (k <= 0 || k >= 1)
        return;
    const { ctx } = a;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * (0.5 + 0.5 * ease(k)));
    g.addColorStop(0, col + 'ff');
    g.addColorStop(0.4, col + '88');
    g.addColorStop(1, col + '00');
    ctx.globalAlpha = max * (1 - k) ** 1.4;
    ctx.fillStyle = g;
    ctx.fillRect(-a.W, -a.H, a.W * 3, a.H * 3);
    ctx.restore();
}
/** 中心から画面の外まで走る光の筋（集中線の逆）。k は 0→1 */
export function streaks(a, x, y, k, col, seed, n = 36) {
    if (k <= 0 || k >= 1)
        return;
    const { ctx } = a;
    const rng = new Rng(seed);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
        const an = rng.range(0, TAU), r0 = 20 + rng.range(200, 420) * ease(k), L = rng.range(40, 120) * (1 - k * 0.5);
        ctx.globalAlpha = (1 - k) * rng.range(0.5, 1);
        ctx.strokeStyle = i % 3 ? col : '#ffffff';
        ctx.lineWidth = rng.range(1, 3.5) * (1 - k * 0.5);
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(an) * r0, y + Math.sin(an) * r0 * 0.7);
        ctx.lineTo(x + Math.cos(an) * (r0 + L), y + Math.sin(an) * (r0 + L) * 0.7);
        ctx.stroke();
    }
    ctx.restore();
}
/** 地面いっぱいに広がる衝撃の輪（画面の外まで） */
export function wideRings(ctx, x, y, k, col, n = 4) {
    if (k <= 0 || k >= 1)
        return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
        const kk = clamp01(k * 1.25 - i * 0.12);
        if (kk <= 0 || kk >= 1)
            continue;
        ctx.globalAlpha = (1 - kk);
        ctx.strokeStyle = i % 2 ? '#ffffff' : col;
        ctx.lineWidth = 6 * (1 - kk) + 1;
        ctx.beginPath();
        ctx.ellipse(x, y, 20 + kk * (380 + i * 40), 6 + kk * (90 + i * 10), 0, 0, TAU);
        ctx.stroke();
    }
    ctx.restore();
}
// ===================== 共通の小さな部品 =====================
/** 着弾の閃光（短く強く。爆ぜる絵が白飛びで見えなくならないように、すぐ引く） */
export function hitFlash(a, c, col, max = 0.45) { flash(a, bump(a.phase, c.impact - 0.001, c.impact + 0.009), col, max); }
/** 唱え終えた瞬間の小さな閃光（本番の光の柱と同じ） */
export function doneFlash(a, c) { flash(a, bump(a.phase, c.doneT, c.doneT + 0.03), '#fff6c8', 0.35); }
/** 着弾の輪（impactBurst の白い芯を小さくした形。爆ぜる絵が白い円でつぶれないように） */
export function ringBurst(a, x, y, k, colA, colB, big = 1) {
    if (k <= 0 || k >= 1)
        return;
    const { ctx } = a;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
        const kk = clamp01(k * 1.3 - i * 0.15);
        if (kk <= 0 || kk >= 1)
            continue;
        ctx.globalAlpha = (1 - kk) * 0.9;
        ctx.strokeStyle = i === 1 ? mix(colA, '#ffffff', 0.5) : i ? colB : colA;
        ctx.lineWidth = 4 * (1 - kk) + 1;
        ctx.beginPath();
        ctx.ellipse(x, y, (10 + kk * (100 + i * 30)) * big, (8 + kk * (56 + i * 14)) * big, 0, 0, TAU);
        ctx.stroke();
    }
    ctx.restore();
    glowDisc(ctx, x, y, 26 * big * (0.6 + k), colA, (1 - k) * 0.7, 0.8);
}
/** 唱える人の頭上（scenes.ts の chainTop と同じ求め方。奥の絵では heads をもらえないので、ここで求める） */
export const headsOf = (a, c) => c.chanters.map((f) => { const v = a.fighters.find((x) => x.f === f && x.alive); return v ? { x: v.x, y: v.y - 30 } : null; });
export function light(a, x, y, r, al, col) { if (al > 0.001 && r > 0)
    a.lights?.push({ x, y, r, a: al, col }); }
/** 溜めで暗く、着弾で明るく、余韻で少しだけ暗さが戻る */
export const darkCurve = (amt, burst = -0.1) => (c, p) => {
    if (p < c.impact)
        return amt * chargeK(c, p);
    return lerp(burst, amt * 0.35, win(p, c.impact + 0.02, c.impact + 0.12)) * (1 - win(p, c.impact + 0.2, c.impact + 0.32));
};
/** 着弾からの経過 0→1 */
export const aft = (c, p, a0, a1) => win(p, c.impact + a0, c.impact + a1);
/** 炎（下から上へ立ちのぼる火の粒。白→黄→橙→赤→煤）。t はずっと増える値 */
export function flames(ctx, x, y, w, h, t, seed, alpha, n = 40, size = 3) {
    if (alpha <= 0)
        return;
    const rng = new Rng(seed);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
        const ph = rng.next(), sp = rng.range(0.7, 1.4), off = rng.range(-0.5, 0.5);
        const u = (ph + t * sp) % 1;
        const px = x + off * w * (1 - u * 0.6) + Math.sin(u * 7 + i) * 2, py = y - u * h * rng.range(0.6, 1);
        const s = Math.max(1, Math.round(size * (1 - u * 0.7)));
        ctx.globalAlpha = alpha * (u < 0.1 ? u * 10 : 1) * (1 - u * 0.5);
        ctx.fillStyle = u < 0.15 ? '#fff6c8' : u < 0.4 ? '#ffd166' : u < 0.7 ? '#ff8a3a' : '#c0281a';
        ctx.fillRect(R(px - s / 2), R(py - s / 2), s, s);
    }
    ctx.restore();
}
/** 降る粒（灰・火の粉・しずく・砂）。t はずっと増える値 */
export function fallers(ctx, x, y0, y1, w, t, seed, cols, alpha, n = 30, drift = 0, len = 1, lighter = false) {
    if (alpha <= 0)
        return;
    const rng = new Rng(seed);
    ctx.save();
    if (lighter)
        ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
        const u = (rng.next() + t * rng.range(0.6, 1.3)) % 1;
        const px = x + rng.range(-w / 2, w / 2) + drift * u + Math.sin(u * 6 + i) * 2, py = lerp(y0, y1, u);
        ctx.globalAlpha = alpha * Math.sin(u * Math.PI);
        ctx.fillStyle = cols[i % cols.length];
        ctx.fillRect(R(px), R(py), i % 3 ? 1 : 2, len);
    }
    ctx.restore();
}
/** 横にのびた光の楕円（地面を照らす・地面の輪） */
export function floorGlow(ctx, x, y, rx, col, alpha) {
    if (alpha <= 0 || rx <= 0)
        return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y);
    ctx.scale(1, 0.28);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, col + 'cc');
    g.addColorStop(0.6, col + '55');
    g.addColorStop(1, col + '00');
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, TAU);
    ctx.fill();
    ctx.restore();
}
/** 光る折れ線（地面のひび・紋様の溝）。pts を k の割合までたどる */
export function glowPath(ctx, pts, k, w, col, alpha) {
    if (k <= 0 || alpha <= 0 || pts.length < 2)
        return;
    const segs = pts.length - 1, upto = k * segs;
    for (let i = 0; i < segs && i < upto; i++) {
        const f = Math.min(1, upto - i), p0 = pts[i], p1 = pts[i + 1];
        glowLine(ctx, p0.x, p0.y, lerp(p0.x, p1.x, f), lerp(p0.y, p1.y, f), w, col, alpha);
    }
}
/** ジグザグのひび（ある点から dir の向きへ） */
export function crackPts(seed, x, y, dir, len, n = 6, squash = 0.3) {
    const rng = new Rng(seed);
    const pts = [{ x, y }];
    for (let i = 1; i <= n; i++) {
        const d = (len * i) / n, a = dir + rng.range(-0.5, 0.5);
        pts.push({ x: x + Math.cos(dir) * d + Math.cos(a + Math.PI / 2) * rng.range(-4, 4), y: y + Math.sin(dir) * d * squash + rng.range(-2, 2) });
    }
    return pts;
}
/** 舞い散る木の葉（はじけて、ひらひら落ちる） */
export function leafBurst(ctx, x, y, k, seed, n = 26) {
    if (k <= 0 || k >= 1)
        return;
    const rng = new Rng(seed);
    ctx.save();
    for (let i = 0; i < n; i++) {
        const an = rng.range(Math.PI * 1.05, Math.PI * 1.95), sp = rng.range(40, 140), e = ease(k);
        const px = x + Math.cos(an) * sp * e + Math.sin(k * 12 + i) * 6, py = y + Math.sin(an) * sp * e * 0.8 + 90 * k * k;
        ctx.globalAlpha = 1 - k * k;
        ctx.fillStyle = ['#6aa04a', '#4a7a34', '#a8c860', '#c89a3a'][i % 4];
        ctx.save();
        ctx.translate(R(px), R(py));
        ctx.rotate(k * 10 + i);
        ctx.fillRect(-2, -1, 4, 2);
        ctx.fillRect(-1, -2, 2, 4);
        ctx.restore();
    }
    ctx.restore();
}
// 方針（#104）: 大魔法は必殺技より派手に。空の連携詠唱の魔法陣が大魔法の色に染まって広がり、唱えた全員の光の糸がそこへ集まる（skyGather）。
// 放つのはその魔法陣から。炸裂は画面いっぱい（bloom・streaks・wideRings）、余韻は長めに。
export const ALL = (a, c) => headsOf(a, c);
export const RING7 = ['#7cf3ff', '#8fd3ff', '#b5a8ff', '#e2a8ff', '#ffb8e8', '#ffe27a', '#fff6c8'];
export const gather = (a, c, sky, hue, col, power = 1) => skyGather(a, c, sky, ALL(a, c), RING7, hue, col, power);
/** 魔法陣から地面までの、太い光（水・溶岩・陽光の柱など）。cols: 外→内。flow: 流れる筋の色 */
export function column(ctx, x0, y0, x1, y1, w0, w1, cols, alpha, frame, flow, down = 1) {
    if (alpha <= 0)
        return;
    ctx.save();
    const n = cols.length;
    cols.forEach((col, i) => {
        const s = 1 - i / n;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(x0 - w0 * s, y0);
        ctx.lineTo(x0 + w0 * s, y0);
        ctx.lineTo(x1 + w1 * s, y1);
        ctx.lineTo(x1 - w1 * s, y1);
        ctx.closePath();
        ctx.fill();
    });
    if (flow) {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 30; i++) {
            const u0 = ((i * 37) % 100) / 100 - 0.5, L = 14 + (i % 5) * 8, t = (((i * 53 + frame * 14 * down) % 400) + 400) % 400 / 400;
            const y = lerp(y0, y1, t), w = lerp(w0, w1, t), x = lerp(x0, x1, t) + u0 * w * 1.6;
            ctx.globalAlpha = alpha * 0.8;
            ctx.fillStyle = i % 3 ? flow : '#ffffff';
            ctx.fillRect(R(x), R(y - L * down), i % 4 ? 2 : 3, L);
        }
    }
    ctx.restore();
}
//# sourceMappingURL=chainkit.js.map