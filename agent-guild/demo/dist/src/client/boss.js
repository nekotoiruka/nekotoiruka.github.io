// 大型ボスの絵の共通の部品（ポーズ・ドットの格子・ふち・キャンバスへの描き出し）。右向き・96x84 ドット。
// 絵そのものは、ボスごとの BossModule の render（src/client/bosses/<kind>.ts やシーズンのパック）が描く。
import { shade } from './sprites.js';
import { bossOf } from './bossapi.js';
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
// ボスの種類ごとの描き方は、BossModule の render（bossapi.ts に登録する）。登録のない種類・種類なしは、既定のボス（bossOf）
export function renderBoss(p, kind) {
    return bossOf(kind).render(p);
}
const cache = new Map();
export function bossCanvas(p, flash = false, kind0) {
    const kind = bossOf(kind0).kind;
    const q = (v) => Math.round(v * 2) / 2;
    const key = `${kind}|${q(p.bob)}|${q(p.lean)}|${q(p.mouth)}|${q(p.wing)}|${q(p.tail)}|${q(p.squash)}|${p.eye}|${p.tint ?? ''}|${p.hide ?? 0}|${flash ? 1 : 0}`;
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
// ボス自身の黒いシルエット（急降下の影など）。待機のポーズを黒で塗りつぶしたもの
const silCache = new Map();
export function bossSilhouette(kind0) {
    const kind = bossOf(kind0).kind;
    let c = silCache.get(kind);
    if (c)
        return c;
    const src = bossCanvas({ ...BOSS_IDLE, eye: 'open' }, false, kind);
    c = document.createElement('canvas');
    c.width = BW;
    c.height = BH;
    const x = c.getContext('2d');
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = '#05040a';
    x.fillRect(0, 0, BW, BH);
    silCache.set(kind, c);
    return c;
}
//# sourceMappingURL=boss.js.map