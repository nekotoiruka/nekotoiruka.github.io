// 大型ボス（まんまるドラゴン）。右向き。部品式で、ポーズごとに描き分ける。
// 96x84 ドットの格子に塗り、主色の濃い色でふちを付ける（キャラと同じマスコット調）。
import { shade } from './sprites.js';
export const BW = 96, BH = 84;
export const BOSS_IDLE = { bob: 0, lean: 0, mouth: 0, wing: 0, tail: 0, squash: 0, eye: 'open' };
export class G {
    c = new Array(BW * BH).fill(null);
    set(x, y, col) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < BW && y < BH)
        this.c[y * BW + x] = col; }
    get(x, y) { return x < 0 || y < 0 || x >= BW || y >= BH ? null : this.c[y * BW + x]; }
    ellipse(cx, cy, rx, ry, col, sh, hi) {
        for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
            for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
                const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
                if (dx * dx + dy * dy > 1)
                    continue;
                let c = col;
                if (sh && dy > 0.5)
                    c = sh;
                if (hi && dy < -0.55 && dx < 0.1 && dx > -0.6)
                    c = hi;
                this.set(x, y, c);
            }
    }
    tri(ax, ay, bx, by, cx, cy, col) {
        const minX = Math.floor(Math.min(ax, bx, cx)), maxX = Math.ceil(Math.max(ax, bx, cx));
        const minY = Math.floor(Math.min(ay, by, cy)), maxY = Math.ceil(Math.max(ay, by, cy));
        const s = (px, py, x1, y1, x2, y2) => (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
        for (let y = minY; y <= maxY; y++)
            for (let x = minX; x <= maxX; x++) {
                const px = x + 0.5, py = y + 0.5;
                const d1 = s(px, py, ax, ay, bx, by), d2 = s(px, py, bx, by, cx, cy), d3 = s(px, py, cx, cy, ax, ay);
                const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
                if (!(neg && pos))
                    this.set(x, y, col);
            }
    }
}
export const INK = '#2b1d2e';
export const BOSS_COLORS = { body: '#7d4fd6', belly: '#ffd9a0', wing: '#c49bff', horn: '#fff1d6', eye: '#ffd23f' };
export function render(p) {
    const g = new G();
    const col = p.tint === 'rage' ? '#c0392b' : BOSS_COLORS.body;
    const sh = shade(col, -0.25), hi = shade(col, 0.3);
    const y0 = p.bob + p.squash;
    // しっぽ（左へ伸びて、先がハート形）
    const tailPts = [[22, 66], [14, 64], [8, 60], [4, 54], [3, 47]];
    tailPts.forEach(([x, y], i) => g.ellipse(x, y + y0 - p.tail * (i / 4) * 1.5, 6 - i * 0.8, 5 - i * 0.6, col, sh));
    g.tri(-1, 44 + y0 - p.tail * 1.5, 7, 44 + y0 - p.tail * 1.5, 3, 37 + y0 - p.tail * 1.5, BOSS_COLORS.wing);
    // 翼（体の後ろ）
    const wy = 24 + y0 - p.wing * 3;
    g.ellipse(30, wy, 17, 14 + p.wing, BOSS_COLORS.wing, shade(BOSS_COLORS.wing, -0.2));
    for (let i = 0; i < 3; i++)
        for (let k = 0; k < 14; k++)
            g.set(22 + i * 7 + k * 0.3, wy - 10 + k, shade(BOSS_COLORS.wing, -0.35));
    g.tri(14, wy - 4, 26, wy - 18 - p.wing * 2, 30, wy - 8, BOSS_COLORS.wing);
    // 後ろ足
    g.ellipse(32, 74 + p.bob * 0.3, 7, 5, sh);
    // 胴
    g.ellipse(44, 54 + y0, 27 - p.squash * 0.5, 21 + p.squash * 0.3, col, sh, hi);
    g.ellipse(50, 58 + y0, 14, 13, BOSS_COLORS.belly, shade(BOSS_COLORS.belly, -0.12));
    for (let i = 0; i < 4; i++)
        for (let x = 41; x <= 59; x++)
            if ((x + i) % 1 === 0 && Math.abs(x - 50) < 12 - Math.abs(i - 1.5) * 2)
                g.set(x, 50 + y0 + i * 5, shade(BOSS_COLORS.belly, -0.2));
    // 前足と手
    g.ellipse(56, 75 + p.bob * 0.3, 7, 5, col, sh);
    g.ellipse(64 + p.lean * 0.5, 58 + y0, 5, 4, col, sh);
    for (let i = 0; i < 3; i++)
        g.set(68 + p.lean * 0.5, 56 + i * 2 + y0, BOSS_COLORS.horn);
    // 頭（前に出したり、のけぞったり）
    const hx = 68 + p.lean, hy = 30 + y0 + Math.max(0, -p.lean) * 0.4;
    g.tri(hx - 9, hy - 9, hx - 4, hy - 22, hx - 1, hy - 10, BOSS_COLORS.horn); // 角
    g.tri(hx + 1, hy - 11, hx + 8, hy - 23, hx + 8, hy - 9, BOSS_COLORS.horn);
    g.ellipse(hx, hy, 18, 15, col, sh, hi);
    // 背中のトゲ
    for (let i = 0; i < 4; i++)
        g.tri(30 + i * 8, 34 + y0 - i * 0.5, 34 + i * 8, 26 + y0 - i * 1.5, 38 + i * 8, 34 + y0 - i * 0.5, BOSS_COLORS.horn);
    // 鼻先と口
    const sx = hx + 15, sy = hy + 6;
    g.ellipse(sx, sy, 10, 7 + p.mouth, col, sh);
    g.set(sx + 6, sy - 3, INK);
    g.set(sx + 8, sy - 3, INK);
    if (p.mouth > 0) {
        g.ellipse(sx + 1, sy + 3, 8, 1.5 + p.mouth * 1.5, '#7a1f2b');
        g.ellipse(sx + 1, sy + 4 + p.mouth, 5, 1 + p.mouth * 0.5, '#ff6b6b');
        for (let i = 0; i < 3; i++) {
            g.set(sx - 4 + i * 4, sy + 1, '#ffffff');
            g.set(sx - 4 + i * 4, sy + 5 + p.mouth * 2, '#ffffff');
        }
    }
    else {
        for (let x = sx - 6; x <= sx + 6; x++)
            g.set(x, sy + 3, shade(col, -0.5));
        g.set(sx - 6, sy + 2, '#ffffff');
        g.set(sx + 3, sy + 4, '#ffffff');
    }
    // 目
    const ex = hx + 2, ey = hy - 3;
    if (p.eye === 'ko') {
        for (let i = -2; i <= 2; i++) {
            g.set(ex + i, ey + i, INK);
            g.set(ex + i, ey - i, INK);
        }
    }
    else if (p.eye === 'hurt') {
        for (let i = -3; i <= 3; i++)
            g.set(ex + i, ey + Math.abs(i) * 0.5, INK);
    }
    else {
        g.ellipse(ex, ey, 4.5, 4.5, '#ffffff');
        g.ellipse(ex + 1.5, ey + 0.5, 2.4, 3, p.tint === 'rage' ? '#ff3b3b' : INK);
        g.set(ex + 0.5, ey - 1.5, '#ffffff');
        if (p.eye === 'angry')
            for (let i = 0; i < 9; i++)
                g.set(ex - 5 + i, ey - 7 + i * 0.4, INK);
    }
    // ほっぺ
    g.ellipse(hx - 6, hy + 6, 2.5, 1.5, '#ff8fb1');
    return outline(g);
}
// アウトライン（となりの色を濃くした色で1ドットのふち）
export function outline(g) {
    const out = new G();
    out.c = g.c.slice();
    for (let y = 0; y < BH; y++)
        for (let x = 0; x < BW; x++) {
            if (g.get(x, y))
                continue;
            const nb = g.get(x - 1, y) ?? g.get(x + 1, y) ?? g.get(x, y - 1) ?? g.get(x, y + 1);
            if (nb)
                out.c[y * BW + x] = shade(nb, -0.6);
        }
    return out;
}
export const BOSS_RENDERERS = {};
export function renderBoss(p, kind = 'dragon') {
    return (BOSS_RENDERERS[kind] ?? render)(p);
}
const cache = new Map();
export function bossCanvas(p, flash = false, kind = 'dragon') {
    const q = (v) => Math.round(v * 2) / 2;
    const key = `${kind}|${q(p.bob)}|${q(p.lean)}|${q(p.mouth)}|${q(p.wing)}|${q(p.tail)}|${q(p.squash)}|${p.eye}|${p.tint ?? ''}|${flash ? 1 : 0}`;
    let c = cache.get(key);
    if (c)
        return c;
    if (cache.size > 600)
        cache.clear();
    const g = renderBoss({ ...p, bob: q(p.bob), lean: q(p.lean), mouth: q(p.mouth), wing: q(p.wing), tail: q(p.tail), squash: q(p.squash) }, kind);
    c = document.createElement('canvas');
    c.width = BW;
    c.height = BH;
    const ctx = c.getContext('2d');
    for (let y = 0; y < BH; y++)
        for (let x = 0; x < BW; x++) {
            const col = g.get(x, y);
            if (!col)
                continue;
            ctx.fillStyle = flash ? '#ffffff' : col;
            ctx.fillRect(x, y, 1, 1);
        }
    cache.set(key, c);
    return c;
}
//# sourceMappingURL=boss.js.map