// ボス: kraken（右向き・96x84 ドット）。大王クラーケン・ゾルヴァーグ。
// 波立つ海面から巨大な外套膜がそびえ、金色の大目玉と吸盤つきの触手でプレイヤー側（右）を襲う。
// ポーズの意味は boss.ts の BossPose を参照
import { BOSS_RENDERERS, BW, BH, G, INK, outline } from '../boss.js';
import { shade } from '../sprites.js';
const mkPal = (main) => ({ hi: shade(main, 0.28), main, sh: shade(main, -0.32), deep: shade(main, -0.58) });
// 光源は左上。法線の向きで4段階＋境目に市松ディザ
function lightCol(ox, oy, x, y, pal, bias = 0) {
    const l = -(ox * 0.6 + oy * 0.8) + bias;
    const d = (x + y) & 1;
    const band = (t) => Math.abs(l - t) < 0.07 ? (d ? 1 : -1) : 0;
    if (l + band(0.62) * 0.1 > 0.62)
        return pal.hi;
    if (l + band(0.0) * 0.1 > 0.0)
        return pal.main;
    if (l + band(-0.48) * 0.1 > -0.48)
        return pal.sh;
    return pal.deep;
}
// サンプル点の円を順に塗って「管」を作る（後の点が上に重なる）
function tube(g, s, pal) {
    // 画素ごとに「いちばん芯に近い点」で陰影を決める（円筒らしく見せる）。
    // ただし十分あとの点（巻いて重なった部分）は手前として上書きする
    const best = new Map();
    s.forEach((p, i) => {
        const r = Math.max(0.7, p.r);
        for (let y = Math.floor(p.y - r - 1); y <= Math.ceil(p.y + r + 1); y++)
            for (let x = Math.floor(p.x - r - 1); x <= Math.ceil(p.x + r + 1); x++) {
                const ox = (x + 0.5 - p.x) / r, oy = (y + 0.5 - p.y) / r;
                const d = ox * ox + oy * oy;
                if (d > 1)
                    continue;
                const k = y * 1000 + x, b = best.get(k);
                if (b && i - b.i < r * 2.2 + 3 && d >= b.d)
                    continue;
                best.set(k, { i, d });
                g.set(x, y, lightCol(ox, oy, x, y, pal, p.b ?? 0));
            }
    });
}
// 3次ベジェ＋先端の巻き（curl: 巻く角度・ラジアン、+で時計回り）で触手の芯を作る
function tentacle(p0, p1, p2, p3, r0, r1, curl) {
    const out = [];
    const bz = (t, i) => { const u = 1 - t; return u * u * u * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i]; };
    let len = 0;
    let px = p0[0], py = p0[1];
    for (let i = 1; i <= 40; i++) {
        const t = i / 40;
        const x = bz(t, 0), y = bz(t, 1);
        len += Math.hypot(x - px, y - py);
        px = x;
        py = y;
    }
    const n = Math.max(8, Math.ceil(len / 0.8));
    const curlN = Math.ceil(Math.abs(curl) * 4);
    const total = n + curlN;
    for (let i = 0; i <= n; i++) {
        const t = i / n;
        out.push({ x: bz(t, 0), y: bz(t, 1), r: r0 + (r1 - r0) * (i / total) });
    }
    // 巻き（亀の歩みで角度を足していく）
    let a = Math.atan2(p3[1] - bz(0.97, 1), p3[0] - bz(0.97, 0));
    let x = p3[0], y = p3[1];
    for (let i = 1; i <= curlN; i++) {
        a += (curl / curlN) * (0.6 + 0.8 * i / curlN);
        const step = 0.9 * (1 - 0.4 * i / curlN);
        x += Math.cos(a) * step;
        y += Math.sin(a) * step;
        out.push({ x, y, r: Math.max(0.8, r0 + (r1 - r0) * ((n + i) / total)) });
    }
    return out;
}
// 吸盤（影側＝右下側の縁に、薄桃の粒を並べる）
function suckers(g, s, col, from = 0.15) {
    const dark = shade(col, -0.3);
    for (let i = Math.floor(s.length * from); i < s.length - 2; i += 3) {
        const a = s[Math.max(0, i - 1)], b = s[Math.min(s.length - 1, i + 1)];
        let nx = -(b.y - a.y), ny = b.x - a.x;
        const L = Math.hypot(nx, ny) || 1;
        nx /= L;
        ny /= L;
        if (nx * 0.6 + ny * 0.8 < 0) {
            nx = -nx;
            ny = -ny;
        }
        const p = s[i];
        if (p.r < 1.6)
            continue;
        const k = p.r * 0.62;
        g.set(p.x + nx * k, p.y + ny * k, col);
        if (p.r >= 3) {
            g.set(p.x + nx * (k - 1), p.y + ny * (k - 1), dark);
            g.set(p.x + nx * k + ny, p.y + ny * k - nx, col);
        }
    }
}
const SEA = { foam: '#ffffff', foam2: '#bfe6ee', crest: '#2a9a9a', top: '#1c6f86', mid: '#16477a', deep: '#0e2a55', under: '#0a1d3e' };
export function render(p) {
    const g = new G();
    const rage = p.tint === 'rage';
    const body = mkPal(rage ? '#9a1b1b' : '#80294f');
    const back = mkPal(rage ? '#741213' : '#66203f');
    const suck = rage ? '#ff9c9c' : '#f7b8cc';
    const sink = p.squash * 2.6; // 海に沈む量
    const y0 = p.bob + sink;
    const lean = p.lean, wing = p.wing, tail = p.tail;
    // ── 後ろの触手（左奥。tail で渦を巻く）
    const bt1 = tentacle([16, 82], [6 - tail * 0.5, 66], [2 - tail, 44 - tail], [10 - tail * 0.3, 34 - tail * 1.5 + y0 * 0.5], 4.2, 1.6, 3.4 + tail * 0.45);
    tube(g, bt1, back);
    suckers(g, bt1, shade(suck, -0.2));
    const bt2 = tentacle([28, 82], [22, 64], [10 + tail * 0.3, 58 - tail], [14 + tail * 0.2, 48 - tail * 1.2 + y0 * 0.6], 4, 1.4, -3.2 - tail * 0.35);
    tube(g, bt2, back);
    suckers(g, bt2, shade(suck, -0.2));
    // ── 奥の高い触手（頭の右後ろから立ち上がる。wing で高く掲げ、lean で前へ振り下ろす）
    const ra = lean > 0 ? lean / 12 : 0;
    const L = (a, b) => a + (b - a) * ra; // 待機 → 叩きつけ の補間
    const a1 = [L(80, 94), L(22 - wing * 6, 62) + y0 * 0.3];
    const ta = tentacle([66, 80], [L(80, 72), L(60 - wing * 2, 8)], [L(68, 98), L(16 - wing * 7, 8)], a1, 4.6, 1.6, (2.6 + wing * 0.3) * (1 - ra * 0.8));
    // 叩きつけでは、立ち上がる根元は頭の奥・振り下ろす先半分は手前に描く
    const taFront = ta.slice(Math.floor(ta.length * 0.45));
    tube(g, ta, back);
    suckers(g, ta, shade(suck, -0.15));
    // ── 外套膜（左上へ反り返った巨大な頭）
    const hx = 54 + lean * 0.35, hy = 52 + y0;
    const tipx = 34 + lean * 0.9 - tail * 0.3 + p.squash * 1.5, tipy = 6 + y0 + Math.max(0, -lean) * 0.4 + p.squash * 1.2;
    // ひれ（先端の左右）
    const fy = tipy + 10;
    g.tri(tipx - 4, fy - 6, tipx - 17, fy + 2 - wing * 1.5, tipx - 2, fy + 8, back.sh);
    g.tri(tipx - 4, fy - 4, tipx - 14, fy + 1 - wing * 1.5, tipx - 3, fy + 5, back.main);
    g.tri(tipx + 6, fy - 6, tipx + 17, fy - wing * 1.5, tipx + 5, fy + 9, body.sh);
    g.tri(tipx + 6, fy - 4, tipx + 13, fy - 1 - wing * 1.5, tipx + 6, fy + 5, body.main);
    const mantle = [];
    const N = 44;
    for (let i = 0; i <= N; i++) {
        const t = i / N; // 0=頭 1=先端
        const bulge = Math.sin(Math.min(1, t * 1.25) * Math.PI);
        const r = (1 - t) * 13 + 3.5 + bulge * 6.5 - p.squash * 0.4 * (1 - t);
        const bend = Math.sin(t * Math.PI) * 4;
        mantle.push({ x: hx + (tipx - hx) * t - bend, y: hy - 6 + (tipy - (hy - 6)) * t, r, b: 0.45 * t - 0.12 });
    }
    // 先端から頭へ順に塗る（頭が手前）
    tube(g, mantle.slice().reverse(), body);
    // 斑点（色素胞）: まばらな小さいしみ
    for (let y = 0; y < BH; y++)
        for (let x = 10; x < 72; x++) {
            const c = g.get(x, y);
            const h = ((x * 374761393 + y * 668265263) ^ (x * y * 2246822519)) >>> 0;
            if (c === body.main && h % 41 === 0) {
                g.set(x, y, body.sh);
                if (g.get(x + 1, y) === body.main)
                    g.set(x + 1, y, body.sh);
                if (h % 3 === 0 && g.get(x, y + 1) === body.main)
                    g.set(x, y + 1, body.sh);
            }
            else if (c === body.hi && h % 53 === 0)
                g.set(x, y, body.main);
            else if (c === body.sh && h % 47 === 0)
                g.set(x, y, body.deep);
        }
    // ── 頭（目のある膨らみ）
    const head = [];
    for (let i = 0; i <= 8; i++)
        head.push({ x: hx + 2 + i * 0.6, y: hy - 2 + i * 0.3, r: 11.5 - i * 0.3 });
    tube(g, head, body);
    // ── 目（金色・横長の瞳）
    const ex = hx + 7, ey = hy - 8;
    // まぶたの盛り上がり
    g.ellipse(ex - 0.5, ey - 0.5, 9.5, 8.5, body.deep);
    g.ellipse(ex - 1, ey - 1.5, 8.5, 7.2, body.main);
    g.ellipse(ex - 2, ey - 3, 4.5, 3, body.hi);
    if (p.eye === 'ko') {
        g.ellipse(ex, ey, 7, 6, body.deep);
        for (let i = -3; i <= 3; i++) {
            g.set(ex + i, ey + i, '#ffe066');
            g.set(ex + i, ey - i, '#ffe066');
            g.set(ex + i + 1, ey + i, '#c99a1a');
            g.set(ex + i + 1, ey - i, '#c99a1a');
        }
    }
    else if (p.eye === 'hurt') {
        g.ellipse(ex, ey, 7, 6, body.sh);
        for (let i = -5; i <= 5; i++) {
            g.set(ex + i, ey + Math.abs(i) * 0.45 - 1, INK);
            g.set(ex + i, ey + Math.abs(i) * 0.45, INK);
        }
        for (let i = 0; i < 3; i++)
            g.set(ex - 5 + i, ey - 4 + i, body.deep); // しわ
    }
    else {
        const gold = rage ? '#ff3b2a' : '#ffc21a';
        g.ellipse(ex, ey, 7, 6, '#3a0d1e');
        g.ellipse(ex, ey + 0.3, 6.2, 5.2, shade(gold, -0.4));
        g.ellipse(ex - 0.4, ey - 0.3, 5.5, 4.4, gold);
        g.ellipse(ex - 1.8, ey - 2, 3, 1.6, shade(gold, 0.45));
        // 横長の瞳
        const pr = p.eye === 'angry' || rage ? 1 : 0; // 怒ると瞳が細くなる
        for (let x = -4; x <= 4; x++) {
            g.set(ex + 1.5 + x, ey + 0.5, INK);
            if (Math.abs(x) <= 3 - pr) {
                g.set(ex + 1.5 + x, ey - 0.5, INK);
                g.set(ex + 1.5 + x, ey + 1.5, INK);
            }
            if (Math.abs(x) <= 1 && !pr)
                g.set(ex + 1.5 + x, ey - 1.5, INK);
        }
        g.set(ex - 2, ey - 2, '#ffffff');
        g.set(ex - 3, ey - 2, '#ffffff');
        g.set(ex - 2, ey - 3, '#ffffff');
        if (p.eye === 'angry' || rage) {
            // 眉（つり上がった肉のひだ）
            for (let i = 0; i < 17; i++) {
                const yy = ey - 9 + i * 0.55;
                g.set(ex - 9 + i, yy - 1, body.hi);
                g.set(ex - 9 + i, yy, body.sh);
                g.set(ex - 9 + i, yy + 1, body.deep);
                g.set(ex - 9 + i, yy + 2, '#2a0a18');
            }
            // 光る目
            g.set(ex + 4, ey - 1, '#fff6c0');
            g.set(ex + 7, ey - 2, shade(gold, 0.3));
            g.set(ex + 8, ey - 3, '#fff6c0');
        }
    }
    // ── 手前の触手（右へ伸びる。lean で叩きつけ、wing で掲げる）
    const tb = tentacle([56, 82], [62 + lean * 0.5, 64 - wing * 4], [76 + lean * 0.8, 56 - wing * 6 + ra * 4], [90 + lean * 0.3, 62 - wing * 6 + ra * 12 + y0 * 0.3], 5, 1.6, (2.8 - wing * 0.2) * (1 - ra * 0.6));
    tube(g, tb, body);
    suckers(g, tb, suck);
    const tc = tentacle([40, 82], [38, 68 - wing * 2], [30 - wing, 58 - wing * 5], [26 - wing * 1.5, 50 - wing * 6 + y0 * 0.5], 4.4, 1.4, -2.8);
    tube(g, tc, body);
    suckers(g, tc, suck);
    const td = tentacle([70, 82], [78 + lean * 0.4, 70 - wing * 2], [88 + lean * 0.3, 74 - wing * 3 + ra * 2], [92, 66 - wing * 3 + ra * 8], 3.6, 1.3, 2.6 * (1 - ra * 0.5));
    tube(g, td, body);
    suckers(g, td, suck);
    // ── 漏斗（右前に伸び、mouth でふくらんで墨を吐く）
    const fx0 = hx + 9, fy0 = hy + 8;
    const fx1 = 84 + lean * 0.15, fy1 = 38 + p.bob * 0.6 + sink * 0.5;
    const fun = [];
    for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        const bul = p.mouth * 1.5 * Math.sin(t * Math.PI);
        fun.push({ x: fx0 + (fx1 - fx0) * t, y: fy0 + (fy1 - fy0) * t + Math.sin(t * Math.PI) * 3.5, r: 6.2 - t * 3.8 + bul + (t > 0.82 ? 1.4 + p.mouth * 0.5 : 0) });
    }
    const fpal = mkPal(shade(body.main, 0.16));
    tube(g, fun, fpal);
    // 漏斗の節（輪じわ）
    for (const t of [0.35, 0.6]) {
        const q = fun[Math.round(t * 16)];
        for (let k = -q.r + 1; k <= q.r - 1; k++)
            g.set(q.x - k * 0.45, q.y + k * 0.75, fpal.deep);
    }
    // 漏斗の口
    const mo = 1 + p.mouth * 0.9;
    g.ellipse(fx1 + 1.5, fy1, 1.3 + p.mouth * 0.4, mo, INK);
    if (p.mouth > 0) {
        g.ellipse(fx1 + 1.5, fy1 + 0.3, 0.9, mo * 0.6, '#3a1240');
        // 墨
        const ink = '#1d0f24';
        g.ellipse(fx1 + 5 + p.mouth, fy1 - 1, 1.8 + p.mouth * 0.9, 1.4 + p.mouth * 0.8, ink);
        g.set(fx1 + 4 + p.mouth, fy1 - 2, '#5b3a6e');
        if (p.mouth >= 1.5) {
            g.ellipse(fx1 + 10, fy1 - 4, 1.6, 1.4, ink);
            g.ellipse(fx1 + 9, fy1 + 3, 1.1, 1, ink);
            g.set(fx1 + 9, fy1 - 4, '#5b3a6e');
            g.set(fx1 + 4.5, fy1 - 2, '#5b3a6e');
        }
    }
    if (ra > 0.35) {
        tube(g, taFront, body);
        suckers(g, taFront, suck, 0);
    }
    // ── 海面（水面より下は暗い水に沈んで見える）
    const surf = (x) => 71 + Math.round(1.2 * Math.sin(x * 0.42 + p.bob * 0.8) + 0.6 * Math.sin(x * 0.17 + 1)) + Math.max(0, Math.abs(x - 48) - 40) * 0.8;
    for (let x = 0; x < BW; x++) {
        const sy = surf(x);
        for (let y = Math.floor(sy); y < BH; y++) {
            const d = y - sy;
            const under = g.get(x, y) !== null;
            let c;
            if (d < 1)
                c = SEA.crest;
            else if (d < 3)
                c = under ? SEA.mid : SEA.top;
            else if (d < 7)
                c = under ? SEA.deep : ((x + y) & 1 && d > 5.5 ? SEA.deep : SEA.mid);
            else
                c = under ? SEA.under : SEA.deep;
            // 横の光のすじ
            if (!under && d >= 3 && ((x * 3 + y * 17) % 37 === 0 || (x + y * 11) % 41 === 0)) {
                c = SEA.top;
                g.set(x + 1, y, SEA.top);
            }
            g.set(x, y, c);
        }
        // 白い波頭
        if ((x * 5 + Math.round(p.bob)) % 7 < 3)
            g.set(x, sy, SEA.foam2);
        if ((x * 5 + Math.round(p.bob)) % 7 === 1) {
            g.set(x, sy - 1, SEA.foam);
            g.set(x, sy, SEA.foam);
        }
    }
    // しぶき（体や触手が海に刺さるところ）
    const splash = (cx, w, h, seed) => {
        for (let i = -w; i <= w; i++) {
            const x = cx + i, sy = surf(x);
            const hh = Math.round(h * (1 - Math.abs(i) / (w + 1)) * (0.6 + 0.4 * (((i + seed) * 7 + 3) % 5) / 4));
            for (let k = 0; k <= hh; k++)
                g.set(x, sy - k, k === hh ? SEA.foam : ((i + k) & 1 ? SEA.foam2 : SEA.foam));
        }
        g.set(cx - w - 2, surf(cx - w - 2) - h - 1, SEA.foam);
        g.set(cx + w + 2, surf(cx + w + 2) - h, SEA.foam);
    };
    const big = 1 + p.squash * 0.5 + Math.max(0, lean) / 10;
    splash(Math.round(hx - 2), 13, Math.round(2 * big), 1);
    splash(16, 4, 2, 3);
    splash(29, 3, 2, 5);
    splash(62, 4, 2, 2);
    splash(72, 3, 2, 4);
    splash(41, 3, 2, 6);
    splash(57, 3, 2, 0);
    if (ra > 0.5) {
        splash(90, 4, Math.round(4 * ra), 2);
        g.set(86, 60, SEA.foam);
        g.set(94, 61, SEA.foam);
        g.set(89, 58, SEA.foam2);
    }
    if (p.squash >= 3)
        for (let i = 0; i < 6; i++)
            g.set(30 + i * 7, 62 - (i % 3) * 2, SEA.foam);
    void BW;
    return outline(g);
}
BOSS_RENDERERS.kraken = render;
//# sourceMappingURL=kraken.js.map