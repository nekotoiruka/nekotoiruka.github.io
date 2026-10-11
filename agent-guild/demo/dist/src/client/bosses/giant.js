// ボス: giant（氷巨人グラシエル）。右向き・96x84 ドット。ポーズの意味は boss.ts の BossPose を参照
// 前かがみの大柄な人型。角つき兜（右の角は折れている）、凍った白いひげと髪、毛皮の腰巻き、肩に氷のトゲ、右手に氷の棍棒。
// 光源は左上。各部品を「ハイライト・主色・影・濃い影」の4段で塗り、境目は市松でぼかす。
import { BOSS_RENDERERS, G, outline } from '../boss.js';
import { shade } from '../sprites.js';
const SKIN = ['#b8d6ea', '#7ea3c2', '#55789c', '#334d6e'];
const SKIN_RAGE = ['#d88a8a', '#9a4652', '#64263a', '#3a1424'];
const BEARD = ['#ffffff', '#e6f0fa', '#b4c8de', '#7f97b6'];
const FUR = ['#9a6a3e', '#6e4626', '#4a2c18', '#2c190d'];
const IRON = ['#c4ceda', '#7c8898', '#535d6e', '#343b4a'];
const BONE = ['#fff6e2', '#e2d4b4', '#b4a282', '#7e6e54'];
const ICE = ['#ffffff', '#bdf0ff', '#74c4e6', '#3a7fb4'];
const MOUTH = '#1d2440';
// 左上からの光で4段を選ぶ（境目は市松）
function tier(x, y, nx, ny, pal, bias = 0) {
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    let l = -0.55 * nx - 0.62 * ny + 0.56 * nz + bias;
    if ((x + y) & 1)
        l += 0.045;
    else
        l -= 0.045;
    return l > 0.84 ? pal[0] : l > 0.4 ? pal[1] : l > 0.02 ? pal[2] : pal[3];
}
function ball(g, cx, cy, rx, ry, pal, bias = 0) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
        for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
            const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
            if (nx * nx + ny * ny > 1)
                continue;
            g.set(x, y, tier(x, y, nx, ny, pal, bias));
        }
}
// 太さが変わるカプセル（腕・脚・棍棒）
function cap(g, ax, ay, bx, by, ra, rb, pal, bias = 0) {
    const r = Math.max(ra, rb);
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
    for (let y = Math.floor(Math.min(ay, by) - r - 1); y <= Math.ceil(Math.max(ay, by) + r + 1); y++)
        for (let x = Math.floor(Math.min(ax, bx) - r - 1); x <= Math.ceil(Math.max(ax, bx) + r + 1); x++) {
            const px = x + 0.5, py = y + 0.5;
            const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2));
            const qx = ax + dx * t, qy = ay + dy * t, rr = ra + (rb - ra) * t;
            const ox = px - qx, oy = py - qy;
            if (ox * ox + oy * oy > rr * rr)
                continue;
            g.set(x, y, tier(x, y, ox / rr, oy / rr, pal, bias));
        }
}
// 多角形（腰巻き・ひげ用）。法線は中心からの向きで近似
function poly(g, pts, pal, bias = 0) {
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    const minX = Math.floor(Math.min(...xs)), maxX = Math.ceil(Math.max(...xs)), minY = Math.floor(Math.min(...ys)), maxY = Math.ceil(Math.max(...ys));
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, hw = (maxX - minX) / 2 + 1, hh = (maxY - minY) / 2 + 1;
    for (let y = minY; y <= maxY; y++)
        for (let x = minX; x <= maxX; x++) {
            const px = x + 0.5, py = y + 0.5;
            let inside = false;
            for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
                const [xi, yi] = pts[i], [xj, yj] = pts[j];
                if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
                    inside = !inside;
            }
            if (inside)
                g.set(x, y, tier(x, y, ((px - cx) / hw) * 0.8, ((py - cy) / hh) * 0.8, pal, bias));
        }
}
function line(g, ax, ay, bx, by, col) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
    for (let i = 0; i <= n; i++)
        g.set(ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n, col);
}
// 氷の結晶のトゲ（根元 (x,y) から角度 a へ長さ len）
function spike(g, x, y, a, len, w) {
    const ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
    const tx = x + ux * len, ty = y + uy * len;
    g.tri(x + vx * w, y + vy * w, x - vx * w, y - vy * w, tx, ty, ICE[2]);
    g.tri(x + vx * w, y + vy * w, x, y, tx, ty, ICE[1]); // 光が当たる面
    line(g, x + ux * 1, y + uy * 1, x + ux * len * 0.7, y + uy * len * 0.7, ICE[0]);
}
const hash = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 97;
const rad = (d) => (d * Math.PI) / 180;
const lerp = (a, b, t) => a + (b - a) * t;
export function render(p) {
    const g = new G();
    const rage = p.tint === 'rage';
    const skin = rage ? SKIN_RAGE : SKIN;
    const lean = p.lean, sq = p.squash;
    const fwd = lean > 0 ? lean / 12 : 0, back = lean < 0 ? Math.min(1, -lean / 5) : 0;
    const lift = Math.max(0, p.tail) / 6; // 片足上げ（踏みつけ）
    const kneel = Math.min(1, sq / 4);
    const yo = p.bob + sq * 2.2 - lift * 1.5; // 上半身の上下
    const bx = lean * (lean > 0 ? 0.4 : 0.5) - lift * 2 + kneel * 2; // 胴の前後
    const hx = bx + lean * (lean > 0 ? 0.3 : 0.3) + kneel * 2;
    const hy = yo + kneel * 3 + back * 1 + fwd * 3 - (p.wing > 0 ? p.wing * 0.8 : 0);
    const breath = p.mouth;
    const eyeCol = rage ? '#ff2a2a' : '#f0ffff', glow = rage ? '#ff7a4a' : '#6fdcff';
    const headX = 51 + hx, headY = 21 + hy;
    // ---- 髪（頭の後ろへ流れる、凍った白い髪）
    poly(g, [[headX - 4, headY - 7], [headX - 12, headY - 3], [headX - 17, headY + 6], [headX - 22, headY + 16], [headX - 17, headY + 14], [headX - 15, headY + 19], [headX - 10, headY + 11], [headX - 1, headY + 4]], BEARD, -0.15);
    // ---- 後ろの腕（左腕）。wing で上げ下げ、叩きつけで後ろへ
    const shB = [35 + bx, 32 + yo];
    let aB = 115 + fwd * 30 - back * 10;
    if (p.wing > 0)
        aB = lerp(aB, 222, p.wing / 2);
    else
        aB = lerp(aB, 98, -p.wing / 2);
    const hB = [shB[0] + Math.cos(rad(aB)) * 21, shB[1] + Math.sin(rad(aB)) * 21];
    const eB = [lerp(shB[0], hB[0], 0.5) - 1.5, lerp(shB[1], hB[1], 0.5) + 1];
    cap(g, shB[0], shB[1], eB[0], eB[1], 7, 5.5, skin, -0.2);
    cap(g, eB[0], eB[1], hB[0], hB[1], 5.5, 4.5, skin, -0.2);
    ball(g, hB[0], hB[1], 5.5, 5, skin, -0.12);
    // 後ろの肩の氷トゲ
    spike(g, shB[0] - 5, shB[1] - 4, rad(-135), 10, 2.3);
    spike(g, shB[0], shB[1] - 7, rad(-100), 8, 2);
    // ---- 脚（後ろ脚・前脚）。squash で膝をつき、tail で前脚を高く上げる
    const leg = (hipX, hipY, fx, fy, bias) => {
        const L = 9, dx = fx - hipX, dy = fy - hipY, d0 = Math.hypot(dx, dy) || 1, d = Math.min(d0, 2 * L - 0.01);
        const h = Math.sqrt(Math.max(0, L * L - (d * d) / 4));
        const mx = (hipX + fx) / 2, my = (hipY + fy) / 2, nx = dy / d0, ny = -dx / d0;
        const kx = mx + nx * h, ky = my + ny * h; // 膝は前（右）へ
        cap(g, hipX, hipY, kx, ky, 7, 6, skin, bias);
        cap(g, kx, ky, fx, fy - 2, 6, 5, skin, bias);
        // 毛皮のすね当てと足
        cap(g, lerp(kx, fx, 0.4), lerp(ky, fy, 0.4), fx, fy - 2, 6, 6, FUR, bias);
        for (let k = 0; k < 3; k++)
            g.set(lerp(kx, fx, 0.4) - 4 + k * 4, lerp(ky, fy, 0.4) + (k & 1), FUR[3]);
        ball(g, fx + 3, fy, 8, 3.5, FUR, bias);
        for (let i = -1; i <= 1; i++) {
            g.set(fx + 6 + i * 3, fy + 2, FUR[3]);
            g.set(fx + 6 + i * 3, fy + 3, FUR[3]);
        }
    };
    const hipY = 63 + yo;
    leg(41 + bx * 0.5, hipY, 35 - kneel * 7, 78, -0.2);
    const frontLeg = () => leg(56 + bx * 0.5, hipY, 61 + lift * 8 + kneel * 7, 78 - lift * 21, 0);
    if (lift <= 0.3)
        frontLeg();
    // ---- 胴（逆三角の筋骨たくましい体、前かがみ）。息を吸うと胸がふくらむ
    const tX = 48 + bx, tY = 38 + yo;
    ball(g, tX, tY + 14, 13, 9, skin); // 腹
    ball(g, tX, tY, 20 + breath, 12 + breath, skin); // 胸
    ball(g, tX + 4, tY - 8, 16, 7, skin, 0.05); // 僧帽筋（両肩のあいだの盛り上がり。頭はここに沈む）
    // 胸筋と腹筋の線
    for (let i = 0; i <= 12; i++)
        g.set(tX - 3 + i, tY + 5 + breath - Math.abs(i - 6) * 0.3, skin[3]);
    line(g, tX + 3, tY - 3, tX + 3, tY + 5 + breath, skin[2]);
    for (let i = 0; i < 2; i++)
        line(g, tX - 4, tY + 11 + i * 4, tX + 6, tY + 11 + i * 4, skin[2]);
    line(g, tX + 1, tY + 9, tX + 1, tY + 19, skin[2]);
    for (let i = 0; i < 3; i++)
        g.set(tX - 10 + i * 2, tY + 8 + i, skin[3]); // わき腹
    // ---- 腰巻き（毛皮）とベルト
    const wY = 57 + yo;
    poly(g, [[32 + bx, wY], [65 + bx, wY], [66 + bx, wY + 7], [62 + bx, wY + 11], [59 + bx, wY + 8], [55 + bx, wY + 12], [51 + bx, wY + 8], [47 + bx, wY + 12], [43 + bx, wY + 8], [39 + bx, wY + 11], [35 + bx, wY + 8], [31 + bx, wY + 10], [30 + bx, wY + 6]], FUR);
    for (let x = 30; x <= 67; x++)
        for (let y = wY + 2; y <= wY + 12; y++) {
            const c = g.get(x + bx, y);
            if ((c === FUR[1] || c === FUR[0]) && hash(x, y) < 16)
                g.set(x + bx, y + 0, FUR[2]);
        }
    for (let x = 32; x <= 65; x++) {
        g.set(x + bx, wY, IRON[3]);
        g.set(x + bx, wY + 1, IRON[2]);
    }
    ball(g, 50 + bx, wY + 1, 3, 2.5, IRON, 0.15); // バックル
    g.set(49 + bx, wY, IRON[0]);
    if (lift > 0.3)
        frontLeg();
    const shF = [67 + bx, 33 + yo];
    // ---- 前の腕（右腕）と氷の棍棒。lean で振りかぶり→叩きつけ、wing で天へ掲げる
    let aF, aC, armL = 21;
    if (lean >= 0) {
        aF = lerp(68, 8, fwd);
        aC = lerp(-38, 80, fwd);
        armL = lerp(21, 18, fwd);
    }
    else {
        aF = lerp(68, 225, back);
        aC = lerp(-38, -165, back);
        armL = lerp(21, 17, back);
    }
    if (p.wing > 0) {
        const t = (p.wing / 2) * (1 - fwd * 0.9);
        aF = lerp(aF, aF > 150 ? 280 : -60, t * 0.85);
        aC = lerp(aC, aC < -100 ? -115 : -75, t * 0.8);
    }
    else if (p.wing < 0) {
        const t = -p.wing / 2;
        aF = lerp(aF, 80, t);
        aC = lerp(aC, 35, t);
    }
    if (sq > 2)
        aC = lerp(aC, 20, (sq - 2) / 2);
    const hF = [shF[0] + Math.cos(rad(aF)) * armL, shF[1] + Math.sin(rad(aF)) * armL];
    const cdx = Math.cos(rad(aC)), cdy = Math.sin(rad(aC)), ca = Math.atan2(cdy, cdx);
    const eF = [lerp(shF[0], hF[0], 0.5) + 1, lerp(shF[1], hF[1], 0.5) + 1.5];
    // 振りかぶって拳が肩より後ろ上にあるとき・棍棒を立てて構えるときは、腕ごと頭の後ろに回す（顔の前を横切らない）
    const armBehind = (hF[0] < shF[0] - 2 && hF[1] < shF[1] - 4) || (lean < 0 && cdy < -0.7);
    const upperArm = () => {
        cap(g, shF[0], shF[1], eF[0], eF[1], 7.5, 6, skin, 0.05);
        // ---- 前の肩（毛皮＋氷のトゲ）
        ball(g, shF[0] - 1, shF[1] - 2, 6.5, 4.5, ICE, -0.05); // 肩をおおう氷
        for (let i = 0; i < 3; i++)
            g.set(shF[0] - 4 + i * 3, shF[1] + 1 + (i & 1), ICE[3]);
        spike(g, shF[0] - 5, shF[1] - 5, rad(-110), 12, 2.5);
        spike(g, shF[0] + 1, shF[1] - 6, rad(-80), 9, 2.2);
    };
    const foreArm = () => {
        cap(g, eF[0], eF[1], hF[0], hF[1], 6, 5, skin, 0.05);
        cap(g, lerp(eF[0], hF[0], 0.45), lerp(eF[1], hF[1], 0.45), lerp(eF[0], hF[0], 0.75), lerp(eF[1], hF[1], 0.75), 6, 6, FUR); // 毛皮の腕輪
        // 棍棒（柄が手の後ろへ少し出る。先へ行くほど太く、氷の結晶つき）
        const cl = 24, tipX = hF[0] + cdx * cl, tipY = hF[1] + cdy * cl;
        cap(g, hF[0] - cdx * 5, hF[1] - cdy * 5, hF[0] + cdx * 9, hF[1] + cdy * 9, 1.8, 2.6, ICE, -0.1);
        cap(g, hF[0] + cdx * 8, hF[1] + cdy * 8, tipX, tipY, 3, 6, ICE);
        for (let i = 0; i < 3; i++) {
            const t = 12 + i * 5, side = i & 1 ? 1 : -1;
            spike(g, hF[0] + cdx * t, hF[1] + cdy * t, ca + side * rad(65), 4 + i * 1.5, 1.6);
        }
        spike(g, tipX - cdx * 2, tipY - cdy * 2, ca, 6, 2.6);
        line(g, hF[0] + cdx * 10 - cdy * 1.5, hF[1] + cdy * 10 + cdx * 1.5, tipX - cdx * 3 - cdy * 3, tipY - cdy * 3 + cdx * 3, ICE[0]);
        ball(g, hF[0], hF[1], 5.5, 5, skin, 0.1); // こぶし
        line(g, hF[0] + 1 - cdy * 3, hF[1] + cdx * 3, hF[0] + 1 + cdy * 3, hF[1] - cdx * 3, skin[3]); // 指のすじ
    };
    upperArm();
    if (armBehind)
        foreArm();
    // 首（太く短い首が僧帽筋から兜の下へ。前はひげに隠れる）
    ball(g, headX - 2, headY + 8, 8.5, 7, skin, -0.05);
    // ---- 頭（兜・角・顔・ひげ）。肩のあいだ・胸の上に、前かがみで少し沈めて載せる
    // 後ろの角（反って上へ）
    cap(g, headX - 6, headY - 6, headX - 11, headY - 11, 3.4, 2.8, BONE);
    cap(g, headX - 11, headY - 11, headX - 12, headY - 17, 2.8, 1.8, BONE);
    cap(g, headX - 12, headY - 17, headX - 9, headY - 21, 1.8, 0.8, BONE);
    // 前（右）の角は半分で折れている。折れ口はぎざぎざ
    cap(g, headX + 6, headY - 6, headX + 10, headY - 11, 3.4, 2.8, BONE, 0.05);
    g.set(headX + 8, headY - 14, BONE[1]);
    g.set(headX + 9, headY - 14, BONE[0]);
    g.set(headX + 11, headY - 14, BONE[2]);
    g.set(headX + 12, headY - 13, BONE[3]);
    g.set(headX + 10, headY - 13, BONE[3]);
    for (let k = 0; k < 2; k++)
        g.set(headX + 7 + k, headY - 8 - k, BONE[3]); // ひび
    // 顔
    ball(g, headX, headY + 1, 8.5, 8.5, skin, 0.05);
    // 兜（鉄）
    for (let y = Math.floor(headY - 12); y <= headY - 1; y++)
        for (let x = Math.floor(headX - 11); x <= headX + 11; x++) {
            const nx = (x + 0.5 - headX) / 10, ny = (y + 0.5 - (headY - 1)) / 10.5;
            if (nx * nx + ny * ny <= 1)
                g.set(x, y, tier(x, y, nx, ny * 0.9, IRON));
        }
    for (let x = Math.floor(headX - 10); x <= headX + 10; x++) {
        g.set(x, headY - 1, IRON[2]);
        g.set(x, headY, IRON[3]);
    }
    for (let x = Math.floor(headX - 8); x <= headX + 9; x += 4)
        g.set(x, headY - 1, IRON[0]); // 鋲
    line(g, headX - 3, headY - 9, headX - 7, headY - 4, IRON[0]); // 兜のつや
    // 目のくぼみ（影）と鼻あて
    for (let x = Math.floor(headX - 1); x <= headX + 10; x++) {
        g.set(x, headY + 1, skin[3]);
        g.set(x, headY + 2, skin[2]);
    }
    for (let y = -1; y < 5; y++) {
        g.set(headX + 6, headY + y, IRON[3]);
        g.set(headX + 7, headY + y, IRON[1]);
    }
    // 目（兜のふちの下で青白く光る。怒りで赤）
    const ey = headY + 2;
    for (const ex of [headX + 3, headX + 9]) {
        if (p.eye === 'ko') {
            for (let i = -1; i <= 1; i++) {
                g.set(ex + i, ey + i, MOUTH);
                g.set(ex + i, ey - i, MOUTH);
            }
        }
        else if (p.eye === 'hurt') {
            g.set(ex - 1, ey - 1, MOUTH);
            g.set(ex, ey, MOUTH);
            g.set(ex + 1, ey - 1, MOUTH);
            g.set(ex - 1, ey + 1, MOUTH);
        }
        else {
            g.set(ex - 1, ey, glow);
            g.set(ex, ey, eyeCol);
            g.set(ex + 1, ey, glow);
            g.set(ex, ey - 1, glow);
            if (p.eye === 'angry' || rage) {
                g.set(ex - 1, ey + 1, glow);
                g.set(ex + 1, ey + 1, glow);
                // つり上がった眉（兜のふちが内側へ下がる）
                const inner = ex === headX + 3 ? 1 : -1;
                g.set(ex + inner, ey - 1, IRON[3]);
                g.set(ex + inner * 2, ey - 1, IRON[3]);
                g.set(ex - inner, ey - 2, IRON[2]);
            }
        }
    }
    // 鼻
    ball(g, headX + 9, headY + 5, 2.5, 2, skin, 0.15);
    // ひげ（凍りついて先がつらら）
    const bY = headY + 6, chin = 18 + breath;
    poly(g, [[headX - 6, bY - 1], [headX - 3, bY + 1], [headX + 4, bY + 2], [headX + 10, bY], [headX + 12, bY + 4], [headX + 11, bY + 9], [headX + 9, bY + chin * 0.7], [headX + 7, bY + chin * 0.85], [headX + 4, bY + chin], [headX + 1, bY + chin * 0.8], [headX - 2, bY + chin * 0.9], [headX - 4, bY + chin * 0.55], [headX - 8, bY + 6]], BEARD);
    for (let i = 0; i < 5; i++)
        line(g, headX - 4 + i * 3, bY + 5 + (i & 1), headX - 3 + i * 2.7, bY + chin * 0.7, BEARD[2]); // 毛すじ
    // つらら
    for (const [ix, top, ln] of [[headX + 4, bY + chin, 4], [headX - 2, bY + chin * 0.9, 3], [headX + 9, bY + chin * 0.7, 3]]) {
        for (let k = 0; k < ln; k++)
            g.set(ix, top + k, k === ln - 1 ? ICE[2] : ICE[k === 0 ? 0 : 1]);
    }
    // 口ひげ
    poly(g, [[headX + 2, bY + 1], [headX + 8, bY - 1], [headX + 13, bY + 1], [headX + 13, bY + 4], [headX + 8, bY + 3], [headX + 3, bY + 4]], BEARD, 0.2);
    // 口（息を吸うと大きく開き、冷気がもれる）
    const mx = headX + 9, my = bY + 5;
    if (breath > 0.2 || p.eye === 'ko') {
        const mo = Math.max(breath, 0.6);
        ball(g, mx, my + mo, 2.6 + mo, 1 + mo * 1.6, [MOUTH, MOUTH, MOUTH, MOUTH]);
        g.set(mx - 2, my, '#e8f4ff');
        g.set(mx + 2, my, '#e8f4ff'); // 牙
        if (mo > 1.2) {
            g.set(mx - 2, my + 1, '#e8f4ff');
            g.set(mx + 2, my + 1, '#e8f4ff');
        }
    }
    else {
        line(g, mx - 3, my, mx + 3, my - (p.eye === 'angry' || rage ? 1 : 0), MOUTH);
        if (p.eye === 'angry' || rage) {
            g.set(mx - 2, my + 1, '#e8f4ff');
            g.set(mx + 1, my, '#e8f4ff');
        }
    }
    if (!armBehind)
        foreArm();
    // ---- 白い息（いつも少し。吸うと冷気が大きくもれる）
    const puffs = 1 + Math.round(breath * 2);
    for (let i = 0; i < puffs; i++) {
        const px = mx + 6 + i * 4, py = my - 2 + ((i * 5) % 3) - i * 0.8;
        const r = 1.3 + i * 0.5 + breath * 0.3;
        for (let y = Math.floor(py - r); y <= py + r; y++)
            for (let x = Math.floor(px - r); x <= px + r; x++) {
                const d = Math.hypot(x + 0.5 - px, y + 0.5 - py);
                if (d > r || g.get(x, y))
                    continue;
                if (d < r * 0.55 || ((x + y) & 1))
                    g.set(x, y, d < r * 0.5 ? '#ffffff' : '#cfeaf8');
            }
    }
    // ---- 霜（肌のあかるい所に白い点）
    for (let y = 0; y < 84; y++)
        for (let x = 0; x < 96; x++) {
            const c = g.get(x, y);
            if ((c === skin[1] || c === skin[0]) && hash(x, y) < 4)
                g.set(x, y, rage ? shade(skin[0], 0.3) : '#eef8ff');
        }
    return outline(g);
}
BOSS_RENDERERS.giant = render;
//# sourceMappingURL=giant.js.map