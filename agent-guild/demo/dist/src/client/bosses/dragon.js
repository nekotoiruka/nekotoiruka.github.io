// ボス: dragon（竜の巣の主・老竜）。右向き・96x84 ドット。ポーズの意味は boss.ts の BossPose を参照
// 元のまんまる竜は boss.ts の render()（残してある）。ここで描き直したものが優先される
// 描き方: 部位ごとに「型（マスク）」を作り、型の形から面の向きを求めて光源（左上）で4段階に塗る。
// 部位の境目には濃い線を引き、最後に outline() でふちを付ける。色は紫の1系統（シーズンで色相を回す）
import { BOSS_RENDERERS, BW, BH, G, outline } from '../boss.js';
// 色（紫系。影は濃い藍、腹は黄土色、角とトゲは骨色、翼の被膜は赤紫）
const BODY = ['#1e1548', '#3a2a80', '#5f3ea8', '#8d68d4'];
const BODY_RAGE = ['#26081a', '#4a142c', '#7a2438', '#a8434f'];
const BELLY = ['#4e3a1e', '#87663a', '#bf9a52', '#e6c886'];
const BELLY_RAGE = ['#3e2216', '#6e4026', '#9c6a3c', '#c49058'];
const BONE = ['#5a4c3e', '#9e8a6c', '#d6c6a2', '#f6eedc'];
const MEMB = ['#34103a', '#58204f', '#82346c', '#ac528c'];
const MEMB_RAGE = ['#2a0812', '#4c1222', '#742032', '#9c3646'];
const MOUTH = '#2e0a20', TONGUE = '#8a2a4c';
// 型（どのドットが部位に入るか）
class M {
    a = new Uint8Array(BW * BH);
    has(x, y) { return x >= 0 && y >= 0 && x < BW && y < BH && this.a[y * BW + x] === 1; }
    put(x, y, v = 1) { if (x >= 0 && y >= 0 && x < BW && y < BH)
        this.a[y * BW + x] = v; }
    ellipse(cx, cy, rx, ry, v = 1) {
        for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
            for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
                const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
                if (dx * dx + dy * dy <= 1)
                    this.put(x, y, v);
            }
        return this;
    }
    // 太さの変わる管（点と半径の列）。param を渡すと、管に沿った長さを記録する
    chain(pts, v = 1, param) {
        let acc = 0;
        for (let i = 0; i + 1 < pts.length; i++) {
            const [ax, ay, ar] = pts[i], [bx, by, br] = pts[i + 1];
            const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1e-6, len = Math.sqrt(len2);
            const R = Math.max(ar, br) + 1;
            for (let y = Math.floor(Math.min(ay, by) - R); y <= Math.ceil(Math.max(ay, by) + R); y++)
                for (let x = Math.floor(Math.min(ax, bx) - R); x <= Math.ceil(Math.max(ax, bx) + R); x++) {
                    const px = x + 0.5, py = y + 0.5;
                    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
                    const qx = ax + dx * t, qy = ay + dy * t, r = ar + (br - ar) * t;
                    if ((px - qx) ** 2 + (py - qy) ** 2 <= r * r) {
                        this.put(x, y, v);
                        if (param && x >= 0 && y >= 0 && x < BW && y < BH)
                            param[y * BW + x] = acc + t * len;
                    }
                }
            acc += len;
        }
        return this;
    }
    poly(pts, v = 1) {
        const ys = pts.map((q) => q[1]);
        for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
            const py = y + 0.5, xs = [];
            for (let i = 0; i < pts.length; i++) {
                const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
                if ((y1 > py) !== (y2 > py))
                    xs.push(x1 + ((py - y1) * (x2 - x1)) / (y2 - y1));
            }
            xs.sort((a, b) => a - b);
            for (let k = 0; k + 1 < xs.length; k += 2)
                for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++)
                    this.put(x, y, v);
        }
        return this;
    }
    and(o) { for (let i = 0; i < this.a.length; i++)
        this.a[i] &= o.a[i]; return this; }
    or(o) { for (let i = 0; i < this.a.length; i++)
        this.a[i] |= o.a[i]; return this; }
}
// 型をぼかして傾きを取り、面の向き（法線）を求める
function blur(src, R) {
    const tmp = new Float32Array(BW * BH), out = new Float32Array(BW * BH), n = 2 * R + 1;
    for (let y = 0; y < BH; y++)
        for (let x = 0; x < BW; x++) {
            let s = 0;
            for (let k = -R; k <= R; k++) {
                const xx = x + k;
                if (xx >= 0 && xx < BW)
                    s += src[y * BW + xx];
            }
            tmp[y * BW + x] = s / n;
        }
    for (let y = 0; y < BH; y++)
        for (let x = 0; x < BW; x++) {
            let s = 0;
            for (let k = -R; k <= R; k++) {
                const yy = y + k;
                if (yy >= 0 && yy < BH)
                    s += tmp[yy * BW + x];
            }
            out[y * BW + x] = s / n;
        }
    return out;
}
// 型を光源左上で4段階（ディザ付き）に塗って dst に重ねる。edge があれば、後ろの絵との境目に線を引く
function paint(dst, m, mat, o = {}) {
    const R = o.R ?? 2;
    const f = new Float32Array(BW * BH);
    let x0 = BW, x1 = 0, y0 = BH, y1 = 0;
    for (let y = 0; y < BH; y++)
        for (let x = 0; x < BW; x++)
            if (m.has(x, y)) {
                f[y * BW + x] = 1;
                x0 = Math.min(x0, x);
                x1 = Math.max(x1, x);
                y0 = Math.min(y0, y);
                y1 = Math.max(y1, y);
            }
    if (x0 > x1)
        return;
    const b = blur(blur(f, R), R);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, w = Math.max(4, x1 - x0), h = Math.max(4, y1 - y0);
    const gain = (2 * R + 1) / 2;
    const B = (x, y) => (x < 0 || y < 0 || x >= BW || y >= BH ? 0 : b[y * BW + x]);
    const res = [];
    for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
            if (!m.has(x, y))
                continue;
            const gx = B(x + 1, y) - B(x - 1, y), gy = B(x, y + 1) - B(x, y - 1);
            const gl = Math.hypot(gx, gy) || 1e-6;
            const s = Math.min(0.95, gl * gain);
            const nx = (-gx / gl) * s, ny = (-gy / gl) * s, nz = Math.sqrt(1 - s * s);
            let t = 0.8 * (-0.6 * nx - 0.8 * ny) + 0.12 * nz;
            t += 0.5 * (-((x - cx) / w) * 0.6 - ((y - cy) / h) * 0.9);
            t += (o.bias ?? 0.1) - (o.amb ?? 0) * ((y - 40) / 40);
            t += (x + y) & 1 ? 0.035 : -0.035; // 境目は市松で混ぜる
            const lv = t > 0.44 ? 3 : t > 0.04 ? 2 : t > -0.28 ? 1 : 0;
            const c = mat(x, y, lv);
            if (c)
                res.push([x, y, c]);
        }
    for (const [x, y, c] of res) {
        let e = false;
        if (o.edge)
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
                if (!m.has(x + dx, y + dy) && dst.get(x + dx, y + dy))
                    e = true;
        dst.set(x, y, e ? o.edge : c);
    }
}
const flat = (pal, shift = 0) => (_x, _y, lv) => pal[Math.max(0, Math.min(3, lv + shift))];
// 鱗の模様（主色・ハイライトの面に小さな段々の点）
const scaly = (pal, shift = 0) => (x, y, lv) => {
    const l = Math.max(0, Math.min(3, lv + shift));
    const row = Math.floor(y / 3);
    if (l >= 1 && y % 3 === 0 && (x + (row % 2) * 2) % 4 === 0)
        return pal[l - 1];
    return pal[l];
};
const rot = (cx, cy, a) => ([dx, dy]) => [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
// 蝙蝠型の翼（骨と被膜）。far は奥の翼（暗く）
function wing(g, ox, oy, wg, bp, mp, far) {
    const S = [50 + ox, 41 + oy];
    const E = [43 + ox, 27 + oy - wg * 2];
    const W = [35 + ox, 11 + oy - wg * 3.5];
    const sp = 0.74 + wg * 0.12;
    const tips = [[-26, 1], [-30, 15], [-24, 29], [-12, 37]].map(([dx, dy]) => [Math.max(1, W[0] + dx * sp), W[1] + dy * (0.75 + sp * 0.3) + (1 - sp) * 14]);
    const A = [36 + ox, 50 + oy];
    const mem = new M().poly([S, E, W, ...tips, A]);
    // 被膜のふちを弧状にえぐる
    const edges = [[tips[0], tips[1]], [tips[1], tips[2]], [tips[2], tips[3]], [tips[3], A]];
    for (const [a, b] of edges) {
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        let nx = mx - W[0], ny = my - W[1];
        const nl = Math.hypot(nx, ny) || 1;
        nx /= nl;
        ny /= nl;
        const r = len * 0.42;
        mem.ellipse(mx + nx * r * 0.72, my + ny * r * 0.72, r, r, 0);
    }
    // 指の骨の下に影
    const fold = new M();
    for (const t of tips)
        fold.chain([[W[0], W[1] + 1.4, 1.2], [t[0], t[1] + 1.2, 0.8]]);
    fold.and(mem);
    paint(g, mem, (x, y, lv) => (fold.has(x, y) ? mp[Math.max(0, lv - 1 - (far ? 1 : 0))] : mp[Math.max(0, Math.min(3, lv - (far ? 1 : 0)))]), { R: 3, edge: null, bias: 0.15 });
    // 骨（腕・指）と親指の鉤爪
    const bones = new M().chain([[S[0], S[1], 3.6], [E[0], E[1], 2.6], [W[0], W[1], 2.1]]);
    for (const t of tips)
        bones.chain([[W[0], W[1], 1.3], [t[0], t[1], 0.6]]);
    paint(g, bones, flat(bp, far ? -1 : 0), { R: 1, edge: null, bias: 0.2 });
    const claw = new M().poly([[W[0] - 1.5, W[1] - 0.5], [W[0] + 1.5, W[1] - 1], [W[0] + 2.5, W[1] - 5.5]]);
    paint(g, claw, flat(BONE, far ? -1 : 0), { R: 1 });
}
export function render(p) {
    const g = new G();
    const rage = p.tint === 'rage';
    const BP = rage ? BODY_RAGE : BODY, YP = rage ? BELLY_RAGE : BELLY, MP = rage ? MEMB_RAGE : MEMB;
    const LINE = BP[0];
    const sq = p.squash, L = p.lean, wg = p.wing;
    const y0 = p.bob + sq * 1.2; // 胴の上下（つぶれると沈む）
    const bx = L * 0.2; // 胴も少し前へ
    const hx = 72 + L * 0.6, hy = 29 + y0 + (L > 0 ? L * 0.2 : L * 0.35) + sq * 1.3; // 頭（頭骨の中心）
    // 1) 奥の翼
    wing(g, 14 + bx, -2 + y0, wg, BP, MP, true);
    // 2) 奥の前脚（地面に立つ、暗い）
    const farLeg = new M().chain([[58 + bx, 58 + y0, 4.5], [55 + bx * 0.5, 68 + y0 * 0.5, 3.5], [60, 76.5, 2.8]]).ellipse(62, 78.5, 4.5, 2);
    paint(g, farLeg, flat(BP, -1), { R: 2, amb: 0.3 });
    const farClaw = new M();
    for (let i = 0; i < 3; i++)
        farClaw.poly([[64.5 + i * 1.6, 77.5], [66 + i * 1.6, 77.5], [67 + i * 1.6, 80.5]]);
    paint(g, farClaw, flat(BONE, -1), { R: 1 });
    // 3) しっぽ（左へ伸びて、tail で振り上げる。先は骨のとげ）
    const tk = [];
    {
        let x = 30 + bx, y = 63 + y0, ang = Math.PI * 1.02 + p.tail * 0.07;
        const step = 6.2, bend = 0.17 + p.tail * 0.022;
        for (let i = 0; i < 7; i++) {
            tk.push([x, y, Math.max(0.8, 7.5 - i * 1.05)]);
            x += Math.cos(ang) * step;
            y += Math.sin(ang) * step;
            ang += bend;
        }
        tk.push([x, y, 0.6]);
    }
    const tail = new M().chain(tk);
    const tailSp = new M();
    for (let i = 1; i < tk.length - 1; i++) {
        const [ax, ay] = tk[i], [cx, cy] = tk[i + 1];
        const dx = cx - ax, dy = cy - ay, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
        const nx = -uy, ny = ux; // 外側（上）向き
        const r = tk[i][2], sz = 2.5 + (6 - i) * 0.4;
        tailSp.poly([[ax + nx * (r - 1) - ux * 1.5, ay + ny * (r - 1) - uy * 1.5], [ax + nx * (r - 1) + ux * 2, ay + ny * (r - 1) + uy * 2], [ax + nx * (r + sz) - ux * 2, ay + ny * (r + sz) - uy * 2]]);
    }
    {
        const [ax, ay] = tk[tk.length - 2], [cx, cy] = tk[tk.length - 1];
        const dx = cx - ax, dy = cy - ay, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
        tailSp.poly([[cx + nx * 3.5, cy + ny * 3.5], [cx + ux * 6, cy + uy * 6], [cx - nx * 3.5, cy - ny * 3.5], [cx - ux * 1, cy - uy * 1]]);
    }
    paint(g, tailSp, flat(BONE), { R: 1 });
    paint(g, tail, scaly(BP), { R: 2, edge: LINE, amb: 0.2 });
    // 4) 手前の翼
    wing(g, bx, y0, wg, BP, MP, false);
    // 5) 胴と首（ひとつの型）
    const neckPts = [[56 + bx, 50 + y0, 9.5], [63 + bx * 0.6 + L * 0.15, 41 + y0 + (hy - 29 - y0) * 0.3, 7.5], [hx - 3, hy + 3, 5.5]];
    const body = new M()
        .ellipse(37 + bx, 58 + y0, 14 + sq * 0.6, 12.5 - sq * 0.4)
        .ellipse(50 + bx, 53 + y0, 16 + sq * 0.6, 13 - sq * 0.4)
        .chain(neckPts);
    // 背中のトゲ（胴の上の線に沿って並べる）
    const spikes = new M();
    const sxs = [27, 34, 41, 48, 55, 61];
    sxs.forEach((sx0, i) => {
        const sx = Math.round(sx0 + bx);
        let top = -1;
        for (let y = 0; y < BH; y++)
            if (body.has(sx, y)) {
                top = y;
                break;
            }
        if (top < 0)
            return;
        const sz = [4, 6.5, 8, 8, 7, 5.5][i];
        spikes.poly([[sx - 3.5, top + 3], [sx + 3, top + 3], [sx - 1.5, top - sz * 0.6], [sx - 3 - sz * 0.4, top - sz]]);
    });
    // 首の上のトゲ（小さめ）
    for (let k = 1; k <= 2; k++) {
        const t = k / 3, ax = neckPts[1][0] + (neckPts[2][0] - neckPts[1][0]) * t, ay = neckPts[1][1] + (neckPts[2][1] - neckPts[1][1]) * t;
        const top = ay - neckPts[1][2] + 1;
        spikes.poly([[ax - 3, top + 2], [ax + 1.5, top + 1], [ax - 4, top - 3.5]]);
    }
    paint(g, spikes, flat(BONE), { R: 1 });
    // 腹の帯（のどから腹まで。段の入った蛇腹）
    const bpar = new Float32Array(BW * BH);
    const belly = new M().chain([[hx + 1, hy + 6.5, 2.8], [neckPts[1][0] + 7.5, neckPts[1][1] + 5, 4.5], [60 + bx, 56 + y0, 7], [50 + bx, 63.5 + y0 - sq * 0.4, 6.5], [38 + bx, 67 + y0 - sq * 0.4, 4.5]], 1, bpar).and(body);
    paint(g, body, (x, y, lv) => {
        if (belly.has(x, y)) {
            const s = bpar[y * BW + x];
            const l = Math.max(2, Math.min(3, lv + 1));
            if (s % 3.2 < 1)
                return YP[l - 2];
            return YP[l];
        }
        return scaly(BP)(x, y, lv);
    }, { R: 3, edge: LINE, amb: 0.25 });
    // 6) 手前の後ろ脚（太もも・すね・足と鉤爪）
    const leg = new M()
        .ellipse(35 + bx, 61 + y0 - sq * 0.3, 10.5, 10 - sq * 0.5)
        .chain([[33 + bx, 66 + y0, 6], [29, 72 + y0 * 0.4, 4.5], [31, 77, 3.5]])
        .ellipse(34.5, 78.5, 6.5, 2.4);
    paint(g, leg, scaly(BP), { R: 2, edge: LINE, amb: 0.3 });
    const legClaw = new M();
    for (let i = 0; i < 3; i++)
        legClaw.poly([[38.5 + i * 1.8, 77], [40.5 + i * 1.8, 77], [42 + i * 1.8, 80.5]]);
    legClaw.poly([[27, 77.5], [29, 77.5], [25.5, 80.5]]); // かかとの爪
    paint(g, legClaw, flat(BONE), { R: 1 });
    // 7) 頭
    const angry = p.eye === 'angry' || rage;
    // 角（後ろへ反った2本。奥は暗く）
    const hornF = new M().chain([[hx - 1, hy - 5, 2], [hx - 8, hy - 11, 1.6], [hx - 12, hy - 16, 1], [hx - 12, hy - 20, 0.4]]);
    paint(g, hornF, flat(BONE, -1), { R: 1, edge: null });
    const horn = new M().chain([[hx - 2, hy - 3, 2.6], [hx - 10, hy - 7, 2], [hx - 16, hy - 10, 1.2], [hx - 19, hy - 14, 0.4]]);
    // 頬のトゲ
    horn.poly([[hx - 4, hy + 1], [hx - 4, hy + 5], [hx - 12, hy + 6]]);
    horn.poly([[hx - 5, hy - 1], [hx - 5, hy + 2], [hx - 13, hy + 1]]);
    paint(g, horn, (x, y, lv) => {
        // 角の節（段）
        const l = (x + y * 2) % 5 === 0 ? Math.max(0, lv - 1) : lv;
        return BONE[l];
    }, { R: 1, edge: BONE[0] });
    // 口: 下あごは mouth で開く
    const a = p.mouth * 0.3 + (p.eye === 'ko' ? 0.15 : 0);
    const J = rot(hx - 3, hy + 4, a);
    const jaw = [J([-1, -1]), J([15, 0.5]), J([15, 2]), J([10, 3.5]), J([1, 4])];
    if (p.mouth > 0.05) {
        const inside = new M().poly([[hx - 3, hy + 3], [hx + 14, hy + 3.5], J([15, 1]), J([-1, 1])]);
        paint(g, inside, () => MOUTH, { R: 1 });
        // 舌と、ブレスの溜め（のどの奥が光る）
        const [tx, ty] = J([7, 0.5]);
        g.ellipse(tx, ty, 4, 1.2, TONGUE);
        if (p.eye !== 'ko' && p.mouth >= 0.9) {
            const k = Math.min(2, p.mouth);
            g.ellipse(hx + 3 + k, hy + 4.5 + k * 0.8, 2 + k * 1.6, 0.8 + k * 0.9, rage ? '#ff6a3a' : '#ff9a3c');
            g.ellipse(hx + 3 + k, hy + 4.5 + k * 0.8, 0.8 + k * 1, 0.5 + k * 0.4, '#ffe9a0');
        }
    }
    const jawM = new M().poly(jaw);
    paint(g, jawM, (x, y, lv) => (lv >= 2 && jawM.has(x, y - 1) && !jawM.has(x, y + 2) ? YP[lv] : BP[lv]), { R: 1, edge: LINE });
    // 下の牙（上向き）
    for (const dx of [5, 9, 13]) {
        const [tx, ty] = J([dx, -0.5]);
        g.set(tx, ty, BONE[3]);
        if (p.mouth > 0.3)
            g.set(tx, ty - 1, BONE[2]);
    }
    // 頭骨と長い口吻
    const head = new M()
        .ellipse(hx, hy, 7, 6)
        .poly([[hx - 1, hy - 5.5], [hx + 10, hy - 3.5], [hx + 15, hy - 0.5], [hx + 16, hy + 2], [hx + 14.5, hy + 3.8], [hx + 2, hy + 4.5], [hx - 2, hy + 4]]);
    paint(g, head, scaly(BP), { R: 2, edge: LINE, bias: 0.16 });
    // 上の牙（下向き、口を開けると長く見える）
    for (const dx of [3, 6, 9, 12]) {
        g.set(hx + dx, hy + 4, BONE[3]);
        if (p.mouth > 0.3 || dx === 9)
            g.set(hx + dx, hy + 5, dx === 9 || dx === 3 ? BONE[2] : BONE[3]);
        if (p.mouth > 0.8 && (dx === 3 || dx === 9))
            g.set(hx + dx, hy + 6, BONE[2]);
    }
    // 鼻の角と鼻孔
    const nose = new M().poly([[hx + 9, hy - 3], [hx + 12, hy - 2.5], [hx + 9.5, hy - 7]]);
    paint(g, nose, flat(BONE), { R: 1 });
    g.set(hx + 13, hy - 0.5, BP[0]);
    g.set(hx + 14, hy - 0.5, BP[0]);
    // 口の線（閉じているとき）
    if (p.mouth <= 0.05)
        for (let x = Math.round(hx - 1); x <= hx + 14; x++)
            if (g.get(x, Math.round(hy + 3.5)) && x % 3 !== 0)
                g.set(x, hy + 3.5, BP[0]);
    // 目（縦長の瞳孔、金色に光る）と張り出した眉
    const ex = Math.round(hx + 3), ey = Math.round(hy - 1);
    for (let x = ex - 1; x <= ex + 3; x++)
        for (let y = ey - 1; y <= ey + 1; y++)
            g.set(x, y, BP[0]);
    const EYE = rage ? '#ff3b2a' : '#ffc832', EYEHI = rage ? '#ffb4a0' : '#fff4a8';
    if (p.eye === 'ko') {
        for (let i = -1; i <= 1; i++) {
            g.set(ex + 1 + i, ey + i, BONE[2]);
            g.set(ex + 1 + i, ey - i, BONE[2]);
        }
    }
    else if (p.eye === 'hurt') {
        for (let x = ex - 1; x <= ex + 3; x++)
            g.set(x, ey + (x === ex + 1 ? 1 : 0), BP[1]);
        g.set(ex - 1, ey - 1, BP[0]);
        g.set(ex + 3, ey - 1, BP[0]);
    }
    else {
        for (let x = ex; x <= ex + 2; x++)
            for (let y = ey - 1; y <= ey + 1; y++)
                g.set(x, y, EYE);
        g.set(ex, ey - 1, EYEHI);
        g.set(ex + 1, ey - 1, BP[0]);
        g.set(ex + 1, ey, BP[0]);
        g.set(ex + 1, ey + 1, BP[0]); // 縦長の瞳孔
        if (angry) {
            g.set(ex + 3, ey, EYEHI);
            g.set(ex + 4, ey, EYE);
            g.set(ex + 2, ey + 1, EYEHI);
        }
    }
    // 眉の張り出し（怒るとつり上がって目にかぶさる）
    const bd = angry ? 1.6 : p.eye === 'hurt' ? -0.5 : 0;
    const brow = new M().poly([[hx - 3, hy - 6], [hx + 2, hy - 6.5], [hx + 8, hy - 3.5 + bd], [hx + 7.5, hy - 2 + bd], [hx + 1, hy - 3.5]]);
    paint(g, brow, (x, y, lv) => (brow.has(x, y + 1) ? BP[Math.min(3, lv + 1)] : BP[0]), { R: 1 });
    // 8) 手前の腕（lean で前へ伸ばして爪で裂く）
    const reach = Math.max(0, L);
    const hand = [69 + bx + reach * 1.15 - Math.max(0, -L) * 0.4, 60 + y0 - reach * 1.5 + sq * 0.8];
    const arm = new M().chain([[60 + bx, 51 + y0, 4.2], [59 + bx + reach * 0.5, 60 + y0 - reach * 0.6, 3.4], [hand[0], hand[1], 2.6]]).ellipse(hand[0] + 0.5, hand[1], 3.3, 2.8);
    paint(g, arm, scaly(BP), { R: 2, edge: LINE, amb: 0.1 });
    const claws = new M();
    const base = L > 4 ? -0.55 : sq > 2 ? 1.3 : 0.75;
    for (let i = -1; i <= 1; i++) {
        const an = base + i * 0.5, len = L > 4 ? 6 : 4.5;
        const c1 = [hand[0] + 2 + Math.cos(an) * 1.5, hand[1] + Math.sin(an) * 1.5];
        const c2 = [c1[0] + Math.cos(an) * len, c1[1] + Math.sin(an) * len];
        const c3 = [c2[0] + Math.cos(an + 0.9), c2[1] + Math.sin(an + 0.9)];
        claws.chain([[c1[0], c1[1], 1.1], [c2[0], c2[1], 0.6], [c3[0], c3[1], 0.3]]);
    }
    paint(g, claws, flat(BONE), { R: 1, edge: BONE[0] });
    return outline(g);
}
BOSS_RENDERERS.dragon = render;
//# sourceMappingURL=dragon.js.map