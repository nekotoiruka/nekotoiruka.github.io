// ボス: spider（右向き・96x84 ドット）。ポーズの意味は boss.ts の BossPose を参照
// 大蜘蛛アラクネア: 後ろに大きな丸い腹、前に頭胸部、8本の節のある脚、毒の牙、赤い複眼。
import { BOSS_RENDERERS, G, outline } from '../boss.js';
import { shade } from '../sprites.js';
const lerp = (a, b, t) => a + (b - a) * t;
const lv = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const add = (a, dx, dy) => [a[0] + dx, a[1] + dy];
const clamp01 = (v) => Math.max(0, Math.min(1, v));
function pal(base) {
    return { hi: shade(base, 0.22), base, sh: shade(base, -0.3), dk: shade(base, -0.55) };
}
// 光源左上の4段階陰影つき楕円（境目は市松ディザ）
function blob(g, cx, cy, rx, ry, P, fur = false) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
        for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
            const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
            const d = dx * dx + dy * dy;
            if (d > 1)
                continue;
            const l = -(dx * 0.55 + dy * 0.85) + (1 - d) * 0.25; // 左上ほど明るい
            const chk = (x + y) % 2 === 0;
            let c;
            if (l > 0.62)
                c = P.hi;
            else if (l > 0.45)
                c = chk ? P.hi : P.base;
            else if (l > -0.15)
                c = P.base;
            else if (l > -0.32)
                c = chk ? P.base : P.sh;
            else if (l > -0.55)
                c = P.sh;
            else if (l > -0.7)
                c = chk ? P.sh : P.dk;
            else
                c = P.dk;
            // 毛並み: ところどころ1ドットずらした色
            if (fur && ((x * 7 + y * 13) % 11 === 0))
                c = c === P.hi ? P.base : c === P.base ? P.sh : c === P.sh ? P.dk : c;
            g.set(x, y, c);
        }
    if (fur) {
        // 輪郭の上半分から毛をちょろちょろ生やす
        for (let a = Math.PI * 0.95; a <= Math.PI * 2.15; a += 0.16) {
            const k = 1 + 0.12 + ((Math.round(a * 100) % 3) * 0.04);
            const x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k;
            g.set(x, y, P.sh);
        }
    }
}
// 太さつきの線（円を並べる）
function seg(g, a, b, r0, r1, col, hiCol, shCol) {
    if (shCol) {
        seg(g, [a[0] + 0.5, a[1] + 0.7], [b[0] + 0.5, b[1] + 0.7], r0, r1, shCol);
    }
    const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2));
    for (let i = 0; i <= n; i++) {
        const t = i / n, x = lerp(a[0], b[0], t), y = lerp(a[1], b[1], t), r = lerp(r0, r1, t);
        for (let yy = Math.floor(y - r); yy <= Math.ceil(y + r); yy++)
            for (let xx = Math.floor(x - r); xx <= Math.ceil(x + r); xx++) {
                const ddx = xx + 0.5 - x, ddy = yy + 0.5 - y;
                if (ddx * ddx + ddy * ddy <= r * r + 0.15)
                    g.set(xx, yy, col);
            }
    }
    if (hiCol)
        for (let i = 1; i < n; i++) {
            const t = i / n, r = lerp(r0, r1, t);
            if (r < 0.9)
                continue;
            g.set(lerp(a[0], b[0], t) - r * 0.35, lerp(a[1], b[1], t) - r * 0.6, hiCol);
        }
}
// 脚の基本形（体の中心 C=(62,52) のときの絶対座標）: [付け根, ひざ, 中関節, 足先]
const NEAR = [
    [[56, 58], [43, 28], [29, 60], [16, 80]],
    [[60, 60], [52, 33], [45, 62], [39, 80]],
    [[66, 60], [76, 33], [83, 60], [78, 80]],
    [[70, 58], [88, 31], [94, 56], [93, 80]],
];
const FAR = [
    [[56, 52], [33, 24], [12, 48], [3, 76]],
    [[60, 52], [45, 25], [29, 54], [24, 76]],
    [[64, 52], [68, 22], [70, 54], [64, 76]],
    [[68, 52], [81, 22], [89, 47], [86, 76]],
];
// 振り上げた前脚（爪・翼ポーズ）
const RAISE = {
    3: [[70, 58], [80, 16], [93, 20], [92, 38]],
    2: [[66, 60], [70, 12], [83, 8], [91, 20]],
};
export function render(p) {
    const g = new G();
    const rage = p.tint === 'rage';
    const ko = p.eye === 'ko';
    const body = pal(rage ? '#6a2230' : '#4b2f5c');
    const legP = pal(rage ? '#6a2a26' : '#5a3a36');
    const farLeg = shade(legP.base, -0.45), farJoint = shade(legP.base, -0.3);
    const red = rage ? '#ff3b30' : '#d0283a', redSh = shade(red, -0.35), redHi = shade(red, 0.35);
    const sq = p.squash;
    const bx = p.lean * 0.45 - (ko ? 2 : 0), by = p.bob + sq * 2.2;
    // 前脚の振り上げ量（3=最前、2=その後ろ）
    const up = Math.max(0, p.wing) / 2;
    const t3 = ko ? 0 : clamp01(Math.max(p.lean / 10, up));
    const t2 = ko ? 0 : clamp01(Math.max(p.lean / 12 * 0.45, up));
    const curl = ko ? 1 : clamp01(-p.wing / 2) * 0.5;
    const legPts = (L, i, far) => {
        const base = add(L[0], bx, by);
        const sqk = sq * 2.6; // つぶれると関節が下がり、足が外へ広がる
        const dirx = Math.sign(L[3][0] - L[0][0]) || 1;
        let knee = add(L[1], bx * 0.8, by * 0.7 + sqk);
        let mid = add(L[2], bx * 0.4 + dirx * sq * 1.2, by * 0.3 + sqk * 0.6);
        let foot = add(L[3], dirx * sq * 1.5, 0);
        const t = i === 3 ? t3 : i === 2 ? t2 : 0;
        if (t > 0) {
            const R = RAISE[i].map((q) => add(q, bx + (far ? -4 : 0), by * 0.5 + (far ? -3 : 0)));
            knee = lv(knee, R[1], t);
            mid = lv(mid, R[2], t);
            foot = lv(foot, R[3], t);
        }
        if (curl > 0) {
            // 撃破: 脚を丸めて上へ縮こまる
            const cb = add(base, (i - 1.5) * 6 + (far ? -3 : 0), -2);
            knee = lv(knee, add(cb, dirx * 9, -9 - i), curl);
            mid = lv(mid, add(cb, dirx * 13, -17 - i), curl);
            foot = lv(foot, add(cb, dirx * 7, -21 - i), curl);
        }
        return [base, knee, mid, foot];
    };
    const drawLeg = (L, i, far) => {
        const [b, k, m, f] = legPts(L, i, far);
        const c = far ? farLeg : legP.base, hc = far ? undefined : legP.hi;
        const w = far ? 0.8 : 1, sc = far ? undefined : legP.sh;
        seg(g, b, k, 2.8 * w, 2.1 * w, c, hc, sc);
        seg(g, k, m, 2.1 * w, 1.5 * w, c, hc, sc);
        seg(g, m, f, 1.5 * w, 0.6, c, hc, sc);
        // 関節の明るい帯（タランチュラ風）
        const jc = far ? farJoint : legP.hi;
        const band = (a, z, tt) => { const q = lv(a, z, tt); g.set(q[0], q[1], jc); g.set(q[0] + 1, q[1], jc); };
        band(b, k, 0.82);
        band(k, m, 0.85);
        if (!far) {
            g.set(k[0], k[1] - 1, legP.hi);
            g.set(m[0], m[1], shade(legP.hi, 0.15));
        }
        // 毛（脚の上側に1ドットの毛）
        if (!far)
            for (let s = 0.2; s < 0.8; s += 0.2) {
                const q = lv(b, k, s);
                g.set(q[0] - 1, q[1] - 2.6, legP.sh);
                const q2 = lv(k, m, s);
                g.set(q2[0] + 1, q2[1] - 2.2, legP.sh);
            }
        // 足先の爪
        if (!far)
            g.set(f[0], f[1], shade(legP.base, -0.6));
    };
    // 奥の脚
    FAR.forEach((L, i) => drawLeg(L, i, true));
    // 腹（後ろ・左）。tail で高く持ち上げる
    const tl = Math.max(0, p.tail);
    const A = [28 + bx * 0.5 + tl * 0.7 - Math.max(0, -p.tail) * 0.5, 47 + by - tl * 2.1 - (ko ? 4 : 0)];
    const arx = 22 - sq * 0.3, ary = 18 - sq * 0.4;
    // 糸いぼ と 糸
    const spin = [A[0] - arx + 3, A[1] + ary * 0.55];
    if (p.tail >= 2.5) {
        for (let y = spin[1] + 2; y < 80; y++)
            g.set(spin[0] - 1 + Math.sin(y * 0.4) * 0.6, y, '#e8e4f0');
    }
    blob(g, spin[0], spin[1], 3, 2.5, body);
    // くびれ（腹と頭胸部をつなぐ）
    const C = [61 + bx, 54 + by + (ko ? 2 : 0)];
    seg(g, [A[0] + arx - 4, A[1] + 2], [C[0] - 10, C[1]], 3, 3, body.sh);
    blob(g, A[0], A[1], arx, ary, body, true);
    // 腹の紋様: 赤い砂時計＋ドクロ風
    {
        const mx = A[0] - 6, my = A[1] - 3;
        g.tri(mx - 7, my - 9, mx + 7, my - 9, mx, my, red);
        g.tri(mx - 7, my + 9, mx + 7, my + 9, mx, my, red);
        g.tri(mx - 4, my - 9, mx + 7, my - 9, mx + 1, my - 2, redSh);
        g.tri(mx + 1, my + 2, mx + 7, my + 9, mx - 1, my + 9, redSh);
        g.set(mx - 5, my - 8, redHi);
        g.set(mx - 4, my - 8, redHi);
        g.set(mx - 3, my - 7, redHi);
        // ドクロの目と鼻（砂時計の上の三角に穴）
        g.set(mx - 3, my - 6, body.dk);
        g.set(mx - 2, my - 6, body.dk);
        g.set(mx + 2, my - 6, body.dk);
        g.set(mx + 3, my - 6, body.dk);
        g.set(mx - 2, my - 5, body.dk);
        g.set(mx + 2, my - 5, body.dk);
        g.set(mx, my - 3, body.dk);
        // 下の三角に歯
        for (let x = -3; x <= 3; x += 2)
            g.set(mx + x, my + 6, body.dk);
        // 腹の横の小さな赤い斑点
        g.set(A[0] - 17, A[1] + 2, redSh);
        g.set(A[0] - 16, A[1] + 2, red);
        g.set(A[0] - 10, A[1] + 6, redSh);
        g.set(A[0] + 14, A[1] - 6, redSh);
    }
    // 頭胸部と頭
    blob(g, C[0], C[1], 13 - sq * 0.2, 10 - sq * 0.3, body, true);
    // 手前の脚（頭はこのあと上に描く）
    NEAR.forEach((L, i) => drawLeg(L, i, false));
    const H = [C[0] + 13 + Math.max(0, p.lean) * 0.25, C[1] - 10 + Math.max(0, p.lean) * 0.2];
    blob(g, H[0], H[1], 10, 9, body);
    // 甲羅のすじ
    for (let i = 0; i < 6; i++)
        g.set(C[0] - 6 + i * 2, C[1] - 6 + Math.abs(i - 2.5) * 0.6, body.sh);
    g.set(C[0] - 3, C[1] - 3, body.hi);
    g.set(C[0] - 2, C[1] - 3, body.hi);
    // 鋏角（牙の付け根）と牙
    const m = Math.max(0, Math.min(2, p.mouth)) / 2;
    const bone = '#e9dcb8', boneSh = '#b8a47e', venom = rage ? '#d04cff' : '#a246e0', venomHi = '#e2a8ff';
    const chel = [H[0] + 6, H[1] + 7];
    const fangFar0 = [chel[0] - 2, chel[1] + 3];
    const fangNear0 = [chel[0] + 1, chel[1] + 4];
    const farTip = lv(add(fangFar0, 0, 8), add(fangFar0, -6, 8), m);
    const nearTip = lv(add(fangNear0, 2, 9), add(fangNear0, 10, 3), m);
    if (m > 0)
        blob(g, chel[0] + 1, chel[1] + 4, 3 + m * 2, 1.5 + m * 2.5, pal('#5a1020')); // 開いた口の中
    seg(g, fangFar0, lv(fangFar0, farTip, 0.7), 1.3, 0.8, boneSh);
    seg(g, lv(fangFar0, farTip, 0.7), farTip, 0.8, 0.5, shade(venom, -0.3));
    blob(g, chel[0] - 1, chel[1], 3.5, 4.5, body);
    blob(g, chel[0] + 2, chel[1] + 1, 3.5, 4.5, body);
    seg(g, fangNear0, lv(fangNear0, nearTip, 0.65), 2, 1.2, bone, undefined, boneSh);
    g.set(fangNear0[0] - 0.5, fangNear0[1] + 1, '#fff8e8');
    seg(g, lv(fangNear0, nearTip, 0.65), nearTip, 1, 0.5, venom);
    // 毒の雫
    g.set(nearTip[0], nearTip[1] + 1, venom);
    g.set(nearTip[0], nearTip[1] + 2, venomHi);
    if (m > 0) {
        for (let i = 0; i < 2 + Math.round(m * 2); i++)
            g.set(nearTip[0] + (i % 2 ? 1 : 0), nearTip[1] + 3 + i * 2, i % 2 ? venomHi : venom);
        g.set(farTip[0], farTip[1] + 2, venom);
        g.set(farTip[0], farTip[1] + 4, venomHi);
    }
    // 触肢（小さな前の腕）
    seg(g, [chel[0] - 4, chel[1] + 2], [chel[0] - 1 + p.lean * 0.2, chel[1] + 8], 1.2, 0.9, legP.base, legP.hi);
    // 目: 大2つ＋小4つ
    const eyeC = rage ? '#ff2a1a' : '#e8202e', eyeHi = '#ffd0c8', eyeDk = '#5a0a14';
    const big = [[H[0] + 2, H[1] - 2], [H[0] + 7, H[1] - 1]];
    const small = [[H[0] - 3, H[1] - 5], [H[0], H[1] - 7], [H[0] + 4, H[1] - 6], [H[0] + 8, H[1] - 5]];
    if (ko) {
        for (const [x, y] of big)
            for (let i = -1; i <= 1; i++) {
                g.set(x + i, y + i, eyeDk);
                g.set(x + i, y - i, eyeDk);
            }
        for (const [x, y] of small)
            g.set(x, y, eyeDk);
    }
    else if (p.eye === 'hurt') {
        for (const [x, y] of big) {
            g.set(x - 1, y, eyeDk);
            g.set(x, y + 0.6, eyeDk);
            g.set(x + 1, y, eyeDk);
        }
        for (const [x, y] of small) {
            g.set(x, y, eyeDk);
            g.set(x + 1, y, eyeDk);
        }
    }
    else {
        const glow = p.eye === 'angry' || rage;
        for (const [x, y] of big) {
            if (glow)
                g.ellipse(x, y, 3, 2.7, shade(eyeC, -0.45));
            g.ellipse(x, y, 2.1, 2, eyeC);
            g.set(x - 0.6, y - 0.8, eyeHi);
        }
        for (const [x, y] of small) {
            g.set(x, y, eyeC);
            if (glow)
                g.set(x + 1, y, shade(eyeC, -0.3));
        }
        if (p.eye === 'angry') {
            // つり上がった眉（甲羅の隆起）
            for (let i = 0; i < 6; i++)
                g.set(H[0] - 1 + i, H[1] - 9 + i * 0.5, body.dk);
            g.set(H[0] + 2, H[1] - 1, eyeDk);
        }
    }
    return outline(g);
}
BOSS_RENDERERS.spider = render;
//# sourceMappingURL=spider.js.map