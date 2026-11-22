// 討伐画面の舞台（背景・明かり・ボスの手前・画面の手前・ただようもの）の受け口と、舞台を描く共通の部品（#119）。
// ボスごとの舞台は BossModule の stage（本体は吸血鬼伯爵の「月明かりの礼拝堂」だけ。ほかのボスはシーズンのパック）。
// stage のないボス（読めないボスの仮の影など）は、もとの城の大広間（arena-scene.ts の makeBackground）。
// 床の高さはどの舞台も同じ（奥の帯は y 0〜80、床は y 80 から下。冒険者は y 101〜191、ボスの足もとは y 150）。
// パックからは kit.stagekit で使う（本体のファイルは import しない）。
import { Rng } from '../shared/rng.js';
/** 舞台の絵を作る: 背景（W×H）と、奥の帯（(W+80)×80。x -40 から） */
export function paintStage(st, W, H, seed) {
    const big = document.createElement('canvas');
    big.width = W + 80;
    big.height = H;
    const g = big.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.translate(40, 0);
    st.paint(g, W, H, new Rng(seed));
    const bg = document.createElement('canvas');
    bg.width = W;
    bg.height = H;
    bg.getContext('2d').drawImage(big, 40, 0, W, H, 0, 0, W, H);
    const wall = document.createElement('canvas');
    wall.width = W + 80;
    wall.height = 80;
    wall.getContext('2d').drawImage(big, 0, 0, W + 80, 80, 0, 0, W + 80, 80);
    return { bg, wall };
}
/** ただようもの（画面の手前。seed で並びを決める） */
export function drawMotes(ctx, m, frame, px, W, H, seed) {
    const rng = new Rng('mote:' + seed);
    ctx.fillStyle = m.col;
    for (let i = 0; i < m.n; i++) {
        const bx = rng.range(0, W), by = rng.range(0, H), sp = rng.range(0.15, 0.5), ph = rng.range(0, 6.28);
        let x = bx, y = by, a = 0.3, s = 1;
        if (m.kind === 'snow') {
            x = bx + frame * sp * 0.8 + Math.sin(frame / 30 + ph) * 3 + px * 0.6;
            y = by + frame * (sp + 0.3);
            a = 0.75;
            s = i % 4 ? 1 : 2;
        }
        else if (m.kind === 'ember') {
            x = bx + Math.sin(frame / 20 + ph) * 4 + px * 0.4;
            y = by - frame * (sp + 0.1);
            a = 0.45 + 0.4 * Math.sin(frame / 8 + ph);
        }
        else if (m.kind === 'spore' || m.kind === 'firefly') {
            x = bx + Math.sin(frame / 50 + ph) * 8 + px * 0.4;
            y = by + Math.cos(frame / 60 + ph) * 6 - frame * 0.05;
            a = 0.3 + 0.35 * Math.sin(frame / 15 + ph);
        }
        else if (m.kind === 'spray') {
            x = bx * 0.45 + Math.sin(frame / 25 + ph) * 3 + px * 0.4;
            y = by - frame * sp * 0.4;
            a = 0.25 + 0.25 * Math.sin(frame / 12 + ph);
        }
        else if (m.kind === 'leaf') {
            x = bx + frame * sp * 0.7 + px * 0.6;
            y = by + frame * sp * 0.5 + Math.sin(frame / 20 + ph) * 5;
            a = 0.85;
            s = 2;
        }
        else {
            x = bx + frame * sp + px * 0.4;
            y = by + Math.sin(frame / 40 + i) * 4;
            a = 0.15 + 0.15 * Math.sin(frame / 25 + i);
        }
        x = ((x % W) + W) % W;
        y = ((y % H) + H) % H;
        ctx.globalAlpha = Math.max(0, Math.min(1, a));
        ctx.fillRect(Math.round(x), Math.round(y), s, s);
    }
    ctx.globalAlpha = 1;
}
// ===================== 舞台を描く部品（ドット絵） =====================
export const rect = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
/** 上から下へ、段になった塗り分け（なめらかなグラデーションにしない） */
export function bands(g, x0, x1, y0, y1, cols) {
    const n = cols.length, h = (y1 - y0) / n;
    cols.forEach((c, i) => rect(g, x0, y0 + Math.floor(i * h), x1 - x0, Math.ceil(h) + 1, c));
}
/** 段の境目を市松に混ぜる（ディザ） */
export function dither(g, x0, x1, y, c, rows = 2) {
    for (let k = 0; k < rows; k++)
        for (let x = x0 + (k % 2); x < x1; x += 2)
            rect(g, x, y + k, 1, 1, c);
}
/** 小さな粒を散らす */
export function speck(g, rng, x0, y0, x1, y1, n, cols, s = 1) {
    for (let i = 0; i < n; i++)
        rect(g, rng.range(x0, x1), rng.range(y0, y1), s, s, rng.pick(cols));
}
/** 遠くの山なみ（ギザギザの影絵） */
export function ridge(g, rng, x0, x1, base, amp, col, step = 6, cap) {
    let y = base - rng.range(0, amp);
    for (let x = x0; x < x1; x += step) {
        y = Math.max(base - amp, Math.min(base - 2, y + rng.range(-amp / 3, amp / 3)));
        rect(g, x, y, step, 400, col);
        if (cap)
            rect(g, x, y, step, 2, cap);
    }
}
/** 石畳・板張りなどの床（奥ほど暗い） */
export function tiles(g, rng, x0, x1, y0, y1, tw, th, cols, gap, darkTop = 0.35) {
    rect(g, x0, y0, x1 - x0, y1 - y0, gap);
    for (let y = y0; y < y1; y += th)
        for (let x = x0 + (((y - y0) / th) % 2 ? -tw / 2 : 0); x < x1; x += tw) {
            const k = (y - y0) / (y1 - y0);
            rect(g, x + 1, y + 1, tw - 2, th - 2, rng.pick(cols));
            rect(g, x + 1, y + 1, tw - 2, th - 2, `rgba(0,0,0,${Math.max(0, darkTop - k * darkTop)})`);
        }
}
/** 丸みのある石を不ぞろいに敷いた岩の床（奥ほど小さく暗い） */
export function rockFloor(g, rng, x0, x1, y0, y1, base, cols, crack, hi) {
    rect(g, x0, y0, x1 - x0, y1 - y0, base);
    for (let y = y0; y < y1;) {
        const t = (y - y0) / (y1 - y0), h = Math.round(4 + t * 9);
        for (let x = x0 - rng.range(0, 20); x < x1;) {
            const w = Math.round(rng.range(10, 30) * (0.55 + t * 0.6)), c = rng.pick(cols), j = Math.round(rng.range(-1, 1));
            rect(g, x + 1, y + 1 + j, w - 2, h - 1, c);
            rect(g, x, y + 2 + j, 1, Math.max(0, h - 3), c);
            rect(g, x + w - 1, y + 2 + j, 1, Math.max(0, h - 3), c);
            rect(g, x + 2, y + 1 + j, w - 4, 1, hi);
            rect(g, x + 1, y + h - 1 + j, w - 2, 1, crack);
            rect(g, x, y + 1 + j, w, h, `rgba(0,0,0,${0.35 * (1 - t)})`);
            x += w + Math.round(rng.range(0, 2));
        }
        y += h;
    }
}
/** 土・雪などの、継ぎ目のない床（すじと粒で手ざわりを出す。奥ほど暗い） */
export function softFloor(g, rng, x0, x1, y0, y1, cols, dark = 0.3) {
    rect(g, x0, y0, x1 - x0, y1 - y0, cols[0]);
    for (let i = 0; i < 700; i++) {
        const y = rng.range(y0, y1), t = (y - y0) / (y1 - y0);
        rect(g, rng.range(x0, x1), y, rng.range(3, 12) * (0.5 + t), 1, rng.pick(cols));
    }
    for (let y = y0; y < y1; y += 2) {
        const t = (y - y0) / (y1 - y0);
        rect(g, x0, y, x1 - x0, 2, `rgba(0,0,0,${dark * (1 - t)})`);
    }
}
/** ボス側（左）をうっすら染める */
export function leftTint(g, H, rgb, a, w = 150) {
    const grd = g.createLinearGradient(0, 0, w, 0);
    grd.addColorStop(0, `rgba(${rgb},${a})`);
    grd.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grd;
    g.fillRect(-40, 0, w + 40, H);
}
/** とがった針葉樹（奥用） */
export function tree(g, x, base, h, col, snow) {
    for (let i = 0; i < h; i += 2) {
        const half = Math.round((i / h) * h * 0.32) + 1;
        rect(g, x - half, base - h + i, half * 2 + 1, 2, col);
        if (snow && i % 8 === 0)
            rect(g, x - half, base - h + i, half + 1, 1, snow);
    }
    rect(g, x - 1, base, 3, 3, col);
}
/** 段になった針葉樹（手前用） */
export function pine(g, x, base, h, half, col, snow) {
    rect(g, x - 2, base - h, 4, h, col);
    for (let k = 0; k < 6; k++) {
        const ty = base - h + k * (h / 6), hw = Math.round(half * (0.4 + k * 0.12));
        for (let i = 0; i < 14; i++) {
            const ww = Math.round((i / 14) * hw);
            rect(g, x - ww, ty + i, ww * 2 + 1, 1, col);
        }
        rect(g, x - Math.round(hw * 0.7), ty + 10, Math.round(hw * 0.8), 1, snow);
    }
}
/** 火のゆらぎ（光源の半径に足す） */
export const flick = (f, k, a = 4) => Math.sin(f / (3 + k * 0.4) + k) * a;
//# sourceMappingURL=stagekit.js.map