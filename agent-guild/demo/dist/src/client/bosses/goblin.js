// ボス: goblin（右向き・96x84 ドット）。ポーズの意味は boss.ts の BossPose を参照
// 頭目ガルグとゴブリンの大群。中央に大きな頭目（鉄兜・骨の首飾り・ぼろマント・棍棒）、
// まわりに手下（旗・弓・槍・松明）。光源は左上、4段階の陰影＋境目に少しディザ。
import { BOSS_RENDERERS, G, INK, outline } from '../boss.js';
import { shade } from '../sprites.js';
const pal = (c, k = 0) => {
    const b = k ? shade(c, k) : c;
    return [shade(b, 0.25), b, shade(b, -0.3), shade(b, -0.55)];
};
// 左上から光が当たる楕円（4段階＋境目に市松ディザ）
function blob(g, cx, cy, rx, ry, P, lift = 0) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
        for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
            const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
            const d = dx * dx + dy * dy;
            if (d > 1)
                continue;
            const t = dx * 0.55 + dy * 0.8 + Math.sqrt(d) * 0.25 - lift;
            const ck = (x + y) & 1;
            let i;
            if (t < -0.62)
                i = 0;
            else if (t < -0.52)
                i = ck ? 0 : 1;
            else if (t < 0.32)
                i = 1;
            else if (t < 0.42)
                i = ck ? 1 : 2;
            else if (t < 0.85)
                i = 2;
            else if (t < 0.95)
                i = ck ? 2 : 3;
            else
                i = 3;
            g.set(x, y, P[i]);
        }
}
function line(g, x0, y0, x1, y1, col, w = 1) {
    const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2) + 1;
    for (let i = 0; i <= n; i++) {
        const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        if (w <= 1) {
            g.set(x, y, typeof col === 'string' ? col : col(t, 0, 0));
            continue;
        }
        const r = w / 2;
        for (let oy = -Math.ceil(r); oy <= Math.ceil(r); oy++)
            for (let ox = -Math.ceil(r); ox <= Math.ceil(r); ox++) {
                if (ox * ox + oy * oy > r * r)
                    continue;
                g.set(x + ox, y + oy, typeof col === 'string' ? col : col(t, ox, oy));
            }
    }
}
const C = {
    skin: '#6f8a3c', minion: '#86a04a', rageSkin: '#6a2620', rageMinion: '#7a3028',
    leather: '#6b4527', iron: '#7c7470', rust: '#94522c', bone: '#e6d9b8', wood: '#7a5230',
    flag: '#b8322a', cape: '#5a3a2c', fire: '#ff9a2a', fireHi: '#ffe48a', fireLo: '#d8452a',
    eye: '#f2e24a', mouth: '#4a1418', tongue: '#b8454a',
};
function minion(g, c, x0, fy, weapon, back, side, seed) {
    const dark = back ? -0.18 : 0;
    const skin = pal(c.rage ? C.rageMinion : C.minion, dark);
    const lea = pal(C.leather, dark - (c.rage ? 0.2 : 0));
    const sq = c.squash * 0.7;
    // 撃破時は散りかける（外側へよろけて傾く）
    const x = x0 + (c.ko ? side * c.squash * 1.3 : 0);
    const tilt = c.ko ? side * 2 : 0;
    const by = fy - 7 + sq * 0.5 + c.bob * 0.5, hy = fy - 15 + sq + c.bob * 0.6;
    const hx = x + 1 + tilt;
    const hand = { x: x + 4 + tilt * 0.5, y: by - 1 };
    const raise = c.ko ? -2 : c.wing;
    // 武器（体の後ろ側になる部分）
    if (weapon === 'flag') {
        const top = { x: x + 3 + c.tail * 0.6 + tilt * 2, y: fy - 36 + sq + (c.ko ? 6 : 0) };
        line(g, x + 3, fy - 2, top.x, top.y, shade(C.wood, dark), 1.5);
        g.set(top.x, top.y - 1, pal(C.iron, dark)[0]);
        g.set(top.x, top.y - 2, pal(C.iron, dark)[1]);
        // 旗（右へなびき、tail で大きく振れる）
        const fp = pal(C.flag, dark - (c.rage ? 0.1 : 0));
        const amp = 1 + Math.abs(c.tail) * 0.35, ph = c.tail * 0.8 + c.bob * 0.3;
        for (let i = 1; i <= 15; i++) {
            const w = Math.sin(i * 0.55 + ph) * amp * (i / 15) * 1.6;
            const slope = Math.cos(i * 0.55 + ph);
            const h = 10 - i * 0.15;
            for (let k = 0; k < h; k++) {
                const ragged = i > 12 && (k + i) % 4 === 0;
                if (ragged)
                    continue;
                let col = slope > 0.4 ? fp[0] : slope < -0.4 ? fp[2] : fp[1];
                if (k > h - 2)
                    col = fp[3];
                g.set(top.x + i, top.y + 1 + k + w, col);
            }
        }
        // 旗のしるし（骨のどくろ）
        const mw = Math.sin(7 * 0.55 + ph) * amp * (7 / 15) * 1.6;
        const mx = top.x + 7, my = top.y + 5 + mw;
        const bc = shade(C.bone, dark - 0.05);
        for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [0, 1], [-2, 2], [2, 2], [-1, 2], [1, 2]])
            g.set(mx + dx, my + dy, bc);
        g.set(mx, my, fp[3]);
    }
    if (weapon === 'spear') {
        const a = ((-30 - raise * 14) * Math.PI) / 180;
        const L = 17;
        const sx = hand.x - Math.cos(a) * 6, sy = hand.y - Math.sin(a) * 6;
        const ex = hand.x + Math.cos(a) * L, ey = hand.y + Math.sin(a) * L;
        line(g, sx, sy, ex, ey, shade(C.wood, dark));
        const ip = pal(C.iron, dark);
        const px = -Math.sin(a), py = Math.cos(a);
        g.tri(ex + px * 2, ey + py * 2, ex - px * 2, ey - py * 2, ex + Math.cos(a) * 5, ey + Math.sin(a) * 5, ip[1]);
        g.set(ex + Math.cos(a) * 1.5 - px, ey + Math.sin(a) * 1.5 - py, ip[0]);
    }
    // 脚
    const legc = skin[2];
    for (const lx of [x - 2, x + 2]) {
        line(g, lx, by + 3, lx + (c.ko ? side : 0), fy - 1, legc, 2.2);
        g.set(lx + 1, fy - 1, skin[3]);
        g.set(lx + 2, fy - 1, skin[3]);
    }
    // 胴（革の上着）
    blob(g, x + tilt * 0.3, by, 4.2, 5 - sq * 0.25, lea);
    for (let i = -3; i <= 3; i++)
        g.set(x + i, by + 3, lea[3]);
    g.set(x + 1, by + 3, pal(C.iron, dark)[1]);
    // 後ろの腕
    blob(g, x - 3 + tilt * 0.3, by, 1.6, 2.5, skin);
    // 耳（長く左後ろへ）・頭
    const ear = skin[1];
    g.tri(hx - 3, hy - 2, hx - 11, hy - 5 - raise * 0.3, hx - 3, hy + 1, ear);
    for (let i = 0; i < 5; i++)
        g.set(hx - 4 - i, hy - 1 - i * 0.4, skin[2]);
    g.tri(hx + 2, hy - 3, hx + 5, hy - 9, hx + 4, hy - 2, skin[2]);
    blob(g, hx, hy, 5, 4.5, skin);
    // とがった鼻
    g.set(hx + 5, hy, skin[1]);
    g.set(hx + 6, hy + 0.5, skin[2]);
    // 頭巾／帽子（武器ごとに少し変える）
    if (weapon === 'spear' || weapon === 'flag') {
        const ip = pal(C.iron, dark - 0.05);
        for (let k = -4; k <= 3; k++) {
            g.set(hx + k, hy - 4, ip[k < 0 ? 0 : 1]);
            g.set(hx + k, hy - 5, ip[1]);
        }
        for (let k = -3; k <= 2; k++)
            g.set(hx + k, hy - 6, ip[k < 0 ? 0 : 2]);
        g.set(hx - 1, hy - 7, ip[2]);
        g.set(hx - 1, hy - 8, ip[3]);
        if ((seed & 1) === 0)
            g.set(hx + 1, hy - 5, shade(C.rust, dark));
    }
    else {
        const hp = pal(C.leather, dark - 0.1);
        for (let k = -4; k <= 3; k++)
            g.set(hx + k, hy - 4, hp[k < 0 ? 0 : 1]);
        for (let k = -3; k <= 1; k++)
            g.set(hx + k - 1, hy - 5, hp[1]);
        g.set(hx - 4, hy - 6, hp[2]);
    }
    // 目
    const ex = hx + 2.5, ey = hy - 1;
    if (c.eye === 'ko') {
        g.set(ex - 1, ey - 1, INK);
        g.set(ex + 1, ey + 1, INK);
        g.set(ex, ey, INK);
        g.set(ex + 1, ey - 1, INK);
        g.set(ex - 1, ey + 1, INK);
    }
    else if (c.eye === 'hurt') {
        g.set(ex - 1, ey, INK);
        g.set(ex, ey + 0.4, INK);
        g.set(ex + 1, ey, INK);
    }
    else {
        const ec = c.rage ? '#ff3b2b' : C.eye;
        g.set(ex, ey, ec);
        g.set(ex + 1, ey, c.rage ? '#ffd0a0' : INK);
        if (c.eye === 'angry') {
            g.set(ex - 1, ey - 2, INK);
            g.set(ex, ey - 1.6, INK);
            g.set(ex + 1, ey - 1.2, INK);
        }
        if (c.rage) {
            g.set(ex - 1, ey, '#ff3b2b');
        }
    }
    // 口（頭目が叫ぶと手下も開ける）
    const m = c.ko ? 1 : c.mouth;
    if (m > 0.3) {
        for (let k = 0; k < 3; k++)
            for (let j = 0; j <= Math.round(m); j++)
                g.set(hx + 1 + k, hy + 2 + j, C.mouth);
        g.set(hx + 1, hy + 2, C.bone);
        g.set(hx + 3, hy + 2, C.bone);
    }
    else {
        g.set(hx + 1, hy + 2, skin[3]);
        g.set(hx + 2, hy + 2, skin[3]);
        g.set(hx + 3, hy + 2, skin[3]);
        g.set(hx + 2, hy + 1, C.bone);
    }
    // 前の腕と、手に持つ武器（体の前）
    if (weapon === 'bow') {
        const aim = raise > 0.4;
        const bx = hand.x + (aim ? 4 : 2), byy = aim ? hy + 2 : by;
        const bh = aim ? 7 : 6;
        const bp = shade(C.wood, dark);
        line(g, x + 1 + tilt * 0.3, by - 2, bx, byy, skin[1], 2);
        for (let t = -90; t <= 90; t += 8) {
            const r = (t * Math.PI) / 180;
            g.set(bx + Math.cos(r) * 2.5 - 1, byy + Math.sin(r) * bh, bp);
        }
        const sx = aim ? bx - 4 : bx - 1;
        line(g, bx - 1, byy - bh, sx, byy, '#d8d0c0');
        line(g, sx, byy, bx - 1, byy + bh, '#d8d0c0');
        if (aim) {
            line(g, sx, byy, bx + 4, byy, shade(C.wood, 0.2));
            g.set(bx + 5, byy, pal(C.iron, dark)[0]);
            g.set(sx - 1, byy - 1, C.flag);
            g.set(sx - 1, byy + 1, C.flag);
        }
        blob(g, bx - 1, byy, 1.4, 1.4, skin);
    }
    else if (weapon === 'torch') {
        const tx = hand.x + 3, ty = hand.y - 9 - raise * 2;
        line(g, hand.x, hand.y, tx, ty, shade(C.wood, dark), 1.5);
        g.set(tx, ty, '#3a2416');
        g.set(tx - 1, ty, '#3a2416');
        // 炎（決定的にゆらす）
        const fl = Math.round(c.bob + c.tail * 0.5 + c.wing) & 1;
        const fh = 6 + raise * 0.5;
        for (let k = 0; k < fh; k++) {
            const w = Math.max(0.5, 2.6 - k * 0.4 + (k === 1 ? 0.4 : 0));
            const off = (k > 2 ? (fl ? 1 : -1) * (k - 2) * 0.35 : 0) - k * 0.15;
            for (let j = -Math.floor(w); j <= Math.floor(w); j++) {
                const inner = Math.abs(j) <= w - 1.3 && k < fh - 2;
                g.set(tx + j + off, ty - 1 - k, inner ? (k < 2 ? C.fireHi : C.fire) : C.fireLo);
            }
        }
        g.set(tx + 3, ty - 5 - fl, C.fire);
        g.set(tx - 3, ty - 3 + fl, C.fireLo);
        blob(g, hand.x, hand.y, 1.5, 1.5, skin);
    }
    else if (weapon === 'flag') {
        line(g, x + 1, by - 1, x + 3 + c.tail * 0.15, by - 7, skin[1], 2);
        blob(g, x + 3 + c.tail * 0.15, by - 7, 1.4, 1.4, skin);
    }
    else {
        line(g, x + 1, by - 1, hand.x, hand.y, skin[1], 2);
        blob(g, hand.x, hand.y, 1.5, 1.5, skin);
    }
}
// ---- 頭目の棍棒 ----
function club(g, hx, hy, angDeg, rage) {
    const a = (angDeg * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
    const L = 21;
    const wp = pal(C.wood, rage ? -0.15 : 0);
    const ip = pal(C.iron);
    // 柄（手の後ろへ少し出る）
    for (let s = -4; s <= L * 0.45; s += 0.5) {
        const x = hx + ca * s, y = hy + sa * s;
        g.set(x, y, wp[1]);
        g.set(x - sa * 1, y + ca * 1, wp[2]);
        g.set(x + sa * 1, y - ca * 1, wp[0]);
    }
    // 太くなる頭
    for (let s = L * 0.4; s <= L; s += 1) {
        const r = 2 + ((s - L * 0.4) / (L * 0.6)) * 3.2;
        blob(g, hx + ca * s, hy + sa * s, r, r, wp);
    }
    // 鉄の輪と鋲
    for (let k = -3; k <= 3; k++)
        g.set(hx + ca * (L * 0.5) - sa * k, hy + sa * (L * 0.5) + ca * k, ip[k < 0 ? 0 : 2]);
    const spikes = [[0.65, 1], [0.65, -1], [0.85, 1], [0.85, -1], [1.0, 0], [0.78, 0]];
    for (const [f, sd] of spikes) {
        const s = L * f, r = 2 + ((s - L * 0.4) / (L * 0.6)) * 3.2;
        const bx = hx + ca * s, by = hy + sa * s;
        if (sd === 0 && f === 1) {
            const tx = bx + ca * (r + 2), ty = by + sa * (r + 2);
            g.tri(bx + ca * r - sa * 1.5, by + sa * r + ca * 1.5, bx + ca * r + sa * 1.5, by + sa * r - ca * 1.5, tx, ty, ip[1]);
        }
        else if (sd === 0) {
            g.set(bx, by, ip[0]);
        }
        else {
            const px = -sa * sd, py = ca * sd;
            const tx = bx + px * (r + 2.2), ty = by + py * (r + 2.2);
            g.tri(bx + px * r - ca * 1.2, by + py * r - sa * 1.2, bx + px * r + ca * 1.2, by + py * r + sa * 1.2, tx, ty, sd < 0 ? ip[0] : ip[2]);
        }
    }
    // 血のような錆
    g.set(hx + ca * (L * 0.9) + sa, hy + sa * (L * 0.9) - ca, C.rust);
    g.set(hx + ca * (L * 0.72) - sa * 2, hy + sa * (L * 0.72) + ca * 2, C.rust);
}
// ---- 頭目 ----
function chief(g, p, c) {
    const skinBase = c.rage ? C.rageSkin : C.skin;
    const skin = pal(skinBase);
    const lea = pal(C.leather, c.rage ? -0.25 : 0);
    const ip = pal(C.iron);
    const ko = c.ko;
    const lean = ko ? -3 : p.lean;
    const y0 = p.bob + p.squash * 0.9;
    const bx = 49 + lean * 0.3, byy = 52 + y0;
    // 頭の位置（撃破時はのけぞって倒れかける）
    const hx = 56 + lean * 0.55 + (ko ? -4 : 0), hy = 28 + y0 + Math.max(0, -lean) * 0.3 + (ko ? 5 : 0) - Math.max(0, p.lean) * 0.15;
    // ぼろぼろのマント（体の後ろ、tail でなびく）
    const cp = pal(c.rage ? '#4a2020' : C.cape);
    const sw = p.tail * 1.2;
    const capeTop = { x: bx - 6, y: byy - 14 };
    for (let y = 0; y < 34 - p.squash * 1.5; y++) {
        const t = y / 30;
        const left = capeTop.x - 6 - t * 12 - sw * t;
        const right = bx + 2 - t * 2;
        for (let x = Math.floor(left); x <= right; x++) {
            const u = (x - left) / Math.max(1, right - left);
            let col = u < 0.25 ? cp[3] : u < 0.5 ? cp[2] : cp[1];
            if (u > 0.08 && u < 0.18 && y > 4)
                col = cp[2];
            if ((x * 7 + y * 3) % 23 === 0 && y > 8)
                col = cp[3]; // 破れ目
            g.set(x, capeTop.y + y, col);
        }
    }
    // 裾のギザギザ
    const yb = capeTop.y + 34 - p.squash * 1.5;
    for (let i = 0; i < 6; i++) {
        const lx = capeTop.x - 18 - sw + i * 4 + 1;
        g.tri(lx, yb - 1, lx + 4, yb - 1, lx + 1 + (i % 2), yb + 3 + (i % 3), i % 2 ? cp[3] : cp[2]);
    }
    g.tri(capeTop.x - 6, capeTop.y, capeTop.x - 21 - sw, capeTop.y + 20, capeTop.x - 4, capeTop.y + 10, cp[2]);
    // 脚（踏み込みで前足が出る）
    const step = Math.max(0, p.lean) * 0.5;
    const legY = 70 + p.bob * 0.4 + p.squash * 0.7;
    blob(g, bx - 7, legY, 5, 6 - p.squash * 0.4, skin, -0.1);
    blob(g, bx + 7 + step, legY, 5, 6 - p.squash * 0.4, skin);
    // 足（ゴツい足とつめ）
    for (const [fx, sh] of [[bx - 6, 0], [bx + 9 + step, 1]]) {
        blob(g, fx, 77.5, 5.5, 2.5, skin, sh ? 0 : -0.15);
        g.set(fx + 4, 79, C.bone);
        g.set(fx + 2, 79, C.bone);
        g.set(fx + 5, 78, C.bone);
        for (let k = -3; k <= 3; k++)
            g.set(fx + k, legY - 1, lea[2]); // 足の革巻き
        for (let k = -3; k <= 3; k++)
            g.set(fx + k, legY + 1, lea[3]);
    }
    // 後ろの腕（左）: 拳を握る
    const wa = ko ? 3 : -c.wing * 1.2;
    blob(g, bx - 13, byy + 1 + wa * 0.5, 4.5, 7, skin, -0.05);
    blob(g, bx - 14, byy + 8 + wa, 4, 3.5, skin);
    for (let k = -3; k <= 3; k++)
        g.set(bx - 13 + k, byy + 4 + wa * 0.7, lea[2]); // 腕輪
    // 胴
    const trx = 15 - p.squash * 0.2, try_ = 15 - p.squash * 0.6;
    blob(g, bx, byy, trx, try_, skin);
    // 革の胴着（左半分を覆い、前が開いて腹が見える）
    for (let y = Math.floor(byy - try_); y <= byy + try_; y++)
        for (let x = Math.floor(bx - trx); x <= bx + trx; x++) {
            const dx = (x + 0.5 - bx) / trx, dy = (y + 0.5 - byy) / try_;
            if (dx * dx + dy * dy > 1)
                continue;
            const edge = -3 + (y - byy) * 0.3;
            if (x - bx >= edge || y < byy - try_ + 3)
                continue;
            const i = skin.indexOf(g.get(x, y) ?? '');
            if (i < 0)
                continue;
            g.set(x, y, x - bx > edge - 1.5 ? lea[3] : lea[Math.min(3, i)]);
        }
    for (let y = byy - 8; y < byy + 9; y += 3)
        g.set(bx - 3 + (y - byy) * 0.3 - 2, y, ip[0]); // 胴着の鋲
    // 腹の筋肉の影
    for (let k = 0; k < 4; k++)
        g.set(bx + 4, byy + 1 + k * 2, skin[2]);
    for (let k = -2; k <= 2; k++) {
        g.set(bx + 1 + k, byy - 1, skin[2]);
        g.set(bx + 7 + k, byy - 1, skin[2]);
    }
    // 斜めの革帯（左肩→右腰）と鋲
    for (let s = 0; s <= 1; s += 0.03) {
        const x = bx - 11 + s * 22, y = byy - 11 + s * 20;
        g.set(x, y, lea[1]);
        g.set(x, y + 1, lea[1]);
        g.set(x, y + 2, lea[2]);
        g.set(x, y - 1, lea[0]);
    }
    for (let s = 0.15; s < 1; s += 0.22)
        g.set(bx - 11 + s * 22, byy - 11 + s * 20 + 0.5, ip[0]);
    // 腰の革ベルトと腰巻き
    const belt = byy + 10 - p.squash * 0.4;
    for (let x = bx - 14; x <= bx + 13; x++) {
        const dx = (x - bx) / 15;
        if (Math.abs(dx) > 1)
            continue;
        const yy = belt + dx * dx * 2;
        g.set(x, yy, lea[x < bx - 6 ? 0 : 1]);
        g.set(x, yy + 1, lea[1]);
        g.set(x, yy + 2, lea[2]);
    }
    blob(g, bx + 1, belt + 1, 2.5, 2.2, ip);
    g.set(bx + 1, belt + 1, C.rust);
    for (let i = 0; i < 4; i++) {
        const fx = bx - 9 + i * 5;
        g.tri(fx, belt + 3, fx + 5, belt + 3, fx + 2 + (i % 2), belt + 9 + (i % 2) * 2, i % 2 ? lea[2] : lea[1]);
    }
    // 肩当て（錆びた鉄）
    blob(g, bx - 11, byy - 11, 6, 4.5, ip);
    for (const [dx, dy] of [[-3, -1], [1, 1], [3, -1], [-1, 2]])
        g.set(bx - 11 + dx, byy - 11 + dy, C.rust);
    g.tri(bx - 13, byy - 15, bx - 10, byy - 15, bx - 12, byy - 20, ip[0]); // 肩のトゲ
    // 骨の首飾り（牙と小さなどくろ）
    for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const nx = hx - 9 + t * 16, ny = hy + 12 + Math.sin(t * Math.PI) * 4;
        g.set(nx, ny, pal(C.leather)[3]);
        if (i % 2 === 0 && i !== 4) {
            g.set(nx, ny + 1, C.bone);
            g.set(nx, ny + 2, shade(C.bone, -0.2));
        }
    }
    const skx = hx - 1, sky = hy + 17;
    blob(g, skx, sky, 2.6, 2.2, pal(C.bone));
    g.set(skx - 1, sky, INK);
    g.set(skx + 1, sky, INK);
    g.set(skx, sky + 2, shade(C.bone, -0.3));
    // 頭の後ろの大きなとがった耳
    const earLift = c.mouth * 0.8 - (ko ? 3 : 0);
    g.tri(hx - 8, hy - 3, hx - 26, hy - 6 - earLift, hx - 7, hy + 5, skin[1]);
    g.tri(hx - 9, hy + 2, hx - 26, hy - 6 - earLift, hx - 7, hy + 5, skin[2]);
    for (let i = 0; i < 13; i++)
        g.set(hx - 9 - i, hy + 1 - i * (6 + earLift) / 16, skin[3]);
    g.set(hx - 17, hy - 1, C.bone);
    g.set(hx - 17, hy, shade(C.bone, -0.3)); // 耳飾りの輪
    // 奥の耳（右上へ）
    g.tri(hx + 3, hy - 4, hx + 15, hy - 12 - earLift, hx + 8, hy, skin[2]);
    g.tri(hx + 5, hy - 4, hx + 15, hy - 12 - earLift, hx + 8, hy - 1, skin[3]);
    // 首の影（頭と胴を分ける）
    {
        const nk = shade(skin[3], -0.25);
        blob(g, hx + 1, hy + 11, 10, 4, [nk, nk, nk, nk]);
    }
    // あご（下あごが前へ張り出す）
    const m = ko ? 1 : p.mouth;
    const jy = hy + 7 + m * 1.6;
    blob(g, hx + 5, jy, 9, 4.2, skin);
    // 頭
    blob(g, hx, hy, 11, 9.5, skin);
    // 口
    const mx = hx + 6, my = hy + 6;
    if (m > 0.2) {
        const mh = 1.2 + m * 1.8;
        blob(g, mx + 1, my + m * 0.8, 6.5, mh, [C.mouth, C.mouth, shade(C.mouth, -0.3), shade(C.mouth, -0.5)]);
        blob(g, mx + 2, my + m * 0.8 + mh * 0.5, 3.5, 1 + m * 0.4, pal(C.tongue));
        for (let k = -4; k <= 6; k += 2)
            g.set(mx + k, my + m * 0.8 - mh + 1, C.bone); // 上の歯
    }
    else {
        for (let x = hx - 1; x <= hx + 12; x++) {
            g.set(x, my + (x > hx + 9 ? -1 : 0), shade(skin[3], -0.3));
            g.set(x, my + 1 + (x > hx + 9 ? -1 : 0), skin[0]);
        }
        g.set(hx - 2, my - 1, skin[3]);
    }
    // 下あごから突き出す牙
    const ty = my + (m > 0.2 ? m * 0.8 + 1.2 + m * 1.8 : 0);
    for (const tx of [hx + 2, hx + 10]) {
        const h = tx > hx + 5 ? 3 : 4;
        for (let k = 0; k < h; k++) {
            g.set(tx, ty - k, C.bone);
            if (k < h - 1)
                g.set(tx + 1, ty - k, shade(C.bone, -0.25));
        }
    }
    // かぎ鼻
    blob(g, hx + 12, hy + 2, 3.4, 2.4, skin);
    g.set(hx + 15, hy + 3, skin[2]);
    g.set(hx + 12, hy + 3, skin[3]);
    g.set(hx + 11, hy, skin[0]);
    // 頬の傷
    g.set(hx - 4, hy, skin[3]);
    g.set(hx - 3, hy + 1, skin[3]);
    g.set(hx - 2, hy + 2, skin[3]);
    g.set(hx - 3, hy - 1, skin[3]);
    // 目（太い眉の下で光る）
    const ex = hx + 5, ey = hy - 1;
    const ang = c.eye === 'angry';
    for (let k = -4; k <= 5; k++) {
        const yy = ey - 3 + (ang ? (k + 4) * 0.35 - 1 : 0);
        g.set(ex + k, yy, skin[3]);
        g.set(ex + k, yy - 1, skin[3]);
        g.set(ex + k, yy + 1, skin[2]);
    }
    if (c.eye === 'ko') {
        for (const ox of [-2, 3])
            for (let i = -1; i <= 1; i++) {
                g.set(ex + ox + i, ey + 1 + i, INK);
                g.set(ex + ox + i, ey + 1 - i, INK);
            }
    }
    else if (c.eye === 'hurt') {
        for (const ox of [-2, 3]) {
            g.set(ex + ox - 1, ey, INK);
            g.set(ex + ox, ey + 1, INK);
            g.set(ex + ox + 1, ey, INK);
        }
    }
    else {
        const ec = c.rage ? '#ff2a1a' : C.eye;
        for (const ox of [-2, 3]) {
            g.set(ex + ox - 1, ey, ec);
            g.set(ex + ox, ey, ec);
            g.set(ex + ox + 1, ey, ec);
            g.set(ex + ox - 1, ey + 1, shade(ec, -0.35));
            g.set(ex + ox, ey + 1, shade(ec, -0.35));
            g.set(ex + ox + 1, ey + 1, shade(ec, -0.35));
            if (c.rage) {
                g.set(ex + ox, ey, '#fff4c8');
                g.set(ex + ox + 2, ey - 1, '#c01818');
                g.set(ex + ox + 3, ey - 1, '#801010');
            }
            else {
                g.set(ex + ox + 1, ey, INK);
                g.set(ex + ox + 1, ey + 1, INK);
            }
        }
    }
    // 鉄の兜（錆び・鋲・角）
    const hp = pal(C.iron, c.rage ? -0.2 : 0);
    for (let y = Math.floor(hy - 16); y <= hy - 6; y++)
        for (let x = Math.floor(hx - 13); x <= hx + 11; x++) {
            const dx = (x + 0.5 - hx + 1) / 12.5, dy = (y + 0.5 - (hy - 6)) / 10;
            if (dx * dx + dy * dy > 1 || dy > 0)
                continue;
            const t = dx * 0.6 + dy * 0.5 + 0.3;
            const ck = (x + y) & 1;
            let col = t < -0.35 ? hp[0] : t < -0.25 ? (ck ? hp[0] : hp[1]) : t < 0.35 ? hp[1] : t < 0.45 ? (ck ? hp[1] : hp[2]) : hp[2];
            if ((x * 5 + y * 11) % 13 === 0)
                col = C.rust;
            g.set(x, y, col);
        }
    for (let x = hx - 13; x <= hx + 11; x++) {
        g.set(x, hy - 6, hp[1]);
        g.set(x, hy - 5, hp[2]);
    }
    for (let x = hx - 11; x <= hx + 9; x += 4)
        g.set(x, hy - 6, hp[0]);
    // 兜の中央の帯と鼻当て
    for (let y = hy - 15; y <= hy - 6; y++)
        g.set(hx + 1, y, hp[3]);
    // 兜の角（左右）
    g.tri(hx - 11, hy - 11, hx - 6, hy - 14, hx - 16, hy - 23, C.bone);
    g.set(hx - 13, hy - 18, shade(C.bone, -0.25));
    g.set(hx - 12, hy - 16, shade(C.bone, -0.25));
    g.tri(hx + 5, hy - 14, hx + 10, hy - 11, hx + 13, hy - 22, shade(C.bone, -0.12));
}
export function render(p) {
    const g = new G();
    const c = { rage: p.tint === 'rage', eye: p.eye, mouth: p.mouth, wing: p.wing, tail: p.tail, squash: p.squash, ko: p.eye === 'ko', bob: p.bob };
    // 奥の手下（旗持ち・弓）
    minion(g, c, 13, 66, 'flag', true, -1, 1);
    minion(g, c, 85, 63, 'torch', true, 1, 3);
    // 頭目（棍棒は振りかぶりで頭の後ろ、踏み込みで前）
    const lean = c.ko ? 0 : p.lean;
    const y0 = p.bob + p.squash * 0.9;
    const lr = Math.max(0, -lean); // 振りかぶり
    const handX = c.ko ? 65 : 67 + Math.max(0, lean) * 0.45 + lr * 0.8;
    const handY = c.ko ? 56 + y0 * 0.5 : 50 + y0 - lr * 2.2 - Math.max(0, lean) * 0.4;
    const ang = c.ko ? 76 : lean < 0 ? -55 - lr * 6 : -55 + lean * 3.4;
    const clubBehind = false;
    if (clubBehind)
        club(g, handX, handY, ang, c.rage);
    chief(g, p, c);
    // 前の腕（右）と棍棒
    const skin = pal(c.rage ? C.rageSkin : C.skin);
    const sx = 60 + lean * 0.35, sy = 41 + y0;
    line(g, sx, sy, handX, handY, (t, ox, oy) => (ox + oy < -1 ? skin[0] : ox + oy > 1.5 ? skin[2] : skin[1]), 6.5);
    blob(g, sx, sy, 4.5, 4, skin);
    if (!clubBehind)
        club(g, handX, handY, ang, c.rage);
    blob(g, handX, handY, 3.6, 3.3, skin);
    g.set(handX + 1, handY - 1, skin[2]);
    g.set(handX + 1, handY + 1, skin[2]);
    const lea = pal(C.leather);
    for (let k = -3; k <= 3; k++)
        g.set((sx + handX) / 2 + k * 0.3, (sy + handY) / 2 + k, lea[1]); // 腕の革巻き
    // 手前の手下（足元: 槍と松明）
    minion(g, c, 21, 81, 'spear', false, -1, 4);
    minion(g, c, 75, 81, 'bow', false, 1, 5);
    return outline(g);
}
BOSS_RENDERERS.goblin = render;
//# sourceMappingURL=goblin.js.map