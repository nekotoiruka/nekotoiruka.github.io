import { shade } from './sprites.js';
export const W = 24, H = 28;
const Y0 = 4; // 頭上の余白（帽子・耳用）
const PATTERN_KIND = { tabby: 'cat', calico: 'calico', black: 'blackcat', tux: 'tuxcat', siamese: 'siamese' };
// ねこの柄を描き分けの種類に直す
function norm(look) {
    return look.body === 'cat' && look.pattern ? { ...look, body: PATTERN_KIND[look.pattern] ?? 'cat' } : look;
}
export const NEUTRAL = { bob: 0, headDx: 0, headDy: 0, armF: [0, 0], armB: [0, 0], footF: [0, 0], footB: [0, 0], squash: 0, eyes: 'open', mouth: 'smile' };
class Grid {
    c = new Array(W * H).fill(null);
    tag = new Array(W * H).fill(null);
    set(x, y, col, tag = 'x') {
        x = Math.round(x);
        y = Math.round(y);
        if (x < 0 || y < 0 || x >= W || y >= H)
            return;
        this.c[y * W + x] = col;
        this.tag[y * W + x] = tag;
    }
    get(x, y) { return x < 0 || y < 0 || x >= W || y >= H ? null : this.c[y * W + x]; }
    // 塗りつぶし楕円（下側に影、左上にハイライト）
    ellipse(cx, cy, rx, ry, col, opt = {}) {
        for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
            for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
                const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
                if (dx * dx + dy * dy > 1)
                    continue;
                if (opt.onlyTop !== undefined && y > opt.onlyTop)
                    continue;
                if (opt.onlyBottom !== undefined && y < opt.onlyBottom)
                    continue;
                let c = col;
                if (opt.sh && dy > 0.45)
                    c = opt.sh;
                if (opt.hi && dy < -0.55 && dx < -0.1 && dx > -0.7)
                    c = opt.hi;
                this.set(x, y, c, opt.tag);
            }
    }
    rect(x0, y0, w, h, col, tag = 'x', round = false) {
        x0 = Math.round(x0);
        y0 = Math.round(y0);
        for (let y = y0; y < y0 + h; y++)
            for (let x = x0; x < x0 + w; x++) {
                if (round && (x === x0 || x === x0 + w - 1) && (y === y0 || y === y0 + h - 1))
                    continue;
                this.set(x, y, col, tag);
            }
    }
}
const SKIN = '#ffd9b8', SKIN_SH = '#f2b48d';
const METAL = '#c9ced8', METAL_SH = '#8b93a6', METAL_HI = '#f4f6fb';
const WHITE = '#f6f3ec', WHITE_SH = '#d9d3c6';
const INK = '#2b1d2e';
const BLUSH = '#ff8fb1';
// 毛皮の動物（頭も体も髪色＝毛の色）
const CATS = ['cat', 'calico', 'blackcat', 'tuxcat', 'siamese'];
const isCat = (t) => CATS.includes(t);
const FURRY = [...CATS, 'bunny', 'bear', 'frog'];
const furOf = (t) => FURRY.includes(t);
// 毛の色（ねこの柄によっては、髪色ではなく決まった色。髪色は柄の色に使う）
function furOfLook(look) {
    switch (look.body) {
        case 'blackcat': return '#2e2838';
        case 'calico': return '#fbf3e8';
        case 'siamese': return '#f3e6cf';
        case 'tuxcat': return shade(look.hair, -0.15);
        default: return look.hair;
    }
}
// ねこの手足・しっぽの先の色（はちわれは白い靴下、シャムは濃い色）
function catPoint(look) {
    if (look.body === 'tuxcat')
        return '#fbf7f0';
    if (look.body === 'siamese')
        return shade(look.hair, -0.35);
    return null;
}
function geometry(p) {
    const b = p.bob;
    return { hx: 12 + p.headDx, hy: Y0 + 10 + b + p.headDy, hrx: 7.6, hry: 6.9, bx: 12, by: Y0 + 16.5 + b + p.squash * 0.5, bw: 7.2, bh: 5.2 - p.squash * 0.5 };
}
function oc(look) {
    return { c: look.palette, sh: shade(look.palette, -0.3), hi: shade(look.palette, 0.35), dk: shade(look.palette, -0.5) };
}
// --- 部品 ---
function bodyColor(look) {
    const t = look.body;
    if (t === 'robot')
        return [METAL, METAL_SH];
    if (furOf(t))
        return [furOfLook(look), shade(furOfLook(look), -0.25)];
    if (t === 'priest' || t === 'chef' || t === 'astro')
        return [WHITE, WHITE_SH];
    if (t === 'ghostie')
        return ['#f4f6ff', '#c9cfe8'];
    return [look.palette, shade(look.palette, -0.25)];
}
function drawFeet(g, p, look) {
    const t = look.body;
    if (t === 'ghostie')
        return; // おばけは足なし
    const col = t === 'robot' ? METAL_SH : catPoint(look) ?? (furOf(t) ? shade(furOfLook(look), -0.1) : t === 'astro' ? '#dfe4ee' : t === 'samurai' ? INK : '#6b4a3a');
    const fy = Y0 + 21.6;
    g.ellipse(9.5 + p.footB[0], fy + p.footB[1], 1.4, 0.9, shade(col, -0.2), { tag: 'foot' });
    g.ellipse(14.5 + p.footF[0], fy + p.footF[1], 1.4, 0.9, col, { tag: 'foot' });
}
function drawBody(g, G, look, p) {
    const t = look.body;
    const o = oc(look);
    const [col, sh] = bodyColor(look);
    if (t === 'ghostie') {
        // すそが波打つおばけ
        g.ellipse(G.bx, G.by - 0.5, G.bw, G.bh, col, { sh, tag: 'body' });
        const y = Math.round(G.by + G.bh - 1);
        for (let x = Math.round(G.bx - G.bw); x <= Math.round(G.bx + G.bw); x++)
            if ((x + Math.floor(p.bob + 4)) % 3 !== 0)
                g.set(x, y + 1, sh, 'body');
        return;
    }
    g.ellipse(G.bx, G.by, G.bw, G.bh, col, { sh, tag: 'body' });
    const top = Math.round(G.by - 3);
    switch (t) {
        case 'knight':
            g.rect(11, top, 2, 6, METAL, 'body');
            break;
        case 'ninja':
            g.rect(G.bx - 6, G.by, 13, 1, look.hair, 'body');
            break;
        case 'rogue':
            g.rect(G.bx - 6, G.by, 13, 1, '#7a4a22', 'body');
            g.set(12, G.by, '#f2c14e', 'body');
            break;
        case 'mage':
        case 'witch':
            g.rect(G.bx - 6, G.by + 2, 13, 1, look.hair, 'body');
            break;
        case 'bear':
        case 'bunny':
            g.ellipse(G.bx + (p.side ? 1.5 : 0), G.by + 1, 3.5, 2.6, t === 'bear' ? shade(look.hair, 0.35) : '#fff7ef', { tag: 'body' });
            break;
        case 'cat':
        case 'calico':
        case 'tuxcat':
            g.ellipse(G.bx + (p.side ? 1.5 : 0), G.by + 1, 3.4, 2.7, '#fffaf2', { tag: 'body' });
            if (t === 'cat')
                for (const dx of [-5, 5])
                    g.rect(G.bx + dx, G.by - 1, 1, 2, shade(furOfLook(look), -0.3), 'body');
            if (t === 'calico') {
                g.ellipse(G.bx - 4, G.by - 1.5, 2.2, 1.6, look.hair, { tag: 'body' });
                g.ellipse(G.bx + 4.5, G.by - 2, 1.6, 1.2, '#3a3040', { tag: 'body' });
            }
            break;
        case 'siamese':
            g.ellipse(G.bx + (p.side ? 1.5 : 0), G.by + 1, 3.4, 2.6, '#fffaf0', { tag: 'body' });
            break;
        case 'blackcat':
            g.rect(G.bx - 1 + (p.side ? 1 : 0), G.by - 2, 3, 1, '#d84a6a', 'body');
            g.set(G.bx + (p.side ? 1 : 0), G.by - 1, '#f7d51d', 'body');
            break; // 赤い首輪と鈴
        case 'frog':
            g.ellipse(G.bx + (p.side ? 1.5 : 0), G.by + 1, 3.8, 2.6, shade(look.hair, 0.5), { tag: 'body' });
            break;
        case 'priest':
            g.rect(10, top, 1, 7, look.palette, 'body');
            g.rect(13, top, 1, 7, look.palette, 'body');
            g.rect(11, top + 2, 2, 1, '#f2c14e', 'body');
            break;
        case 'pirate':
            g.rect(G.bx - 6, G.by + 1, 13, 1, INK, 'body');
            g.rect(11, G.by + 1, 2, 1, '#f2c14e', 'body');
            g.set(12, top + 1, WHITE, 'body');
            g.set(12, top + 2, WHITE, 'body');
            break;
        case 'chef':
            g.ellipse(12, top + 1, 2.6, 1.2, look.palette, { tag: 'body' });
            g.set(12, G.by + 1, INK, 'body');
            g.set(12, G.by + 3, INK, 'body');
            break;
        case 'astro':
            g.rect(10, top + 1, 4, 3, look.palette, 'body');
            g.set(11, top + 2, '#7cf3ff', 'body');
            g.set(13, top + 2, '#ff5a5a', 'body');
            break;
        case 'samurai': {
            for (const dy of [0, 2])
                g.rect(G.bx - 6, G.by + dy, 13, 1, look.hair, 'body');
            g.rect(G.bx - 7, top, 3, 3, o.sh, 'body');
            g.rect(G.bx + 5, top, 3, 3, o.sh, 'body'); // 肩当て
            break;
        }
        case 'robot':
            g.rect(10, top + 1, 4, 2, '#1a1c2c', 'body');
            g.set(10, top + 1, look.hair, 'body');
            break;
    }
}
function drawArm(g, G, look, side, off) {
    const t = look.body;
    const [bc] = bodyColor(look);
    const sleeve = t === 'knight' || t === 'robot' ? METAL : side === 'b' ? shade(bc, -0.15) : bc;
    const hand = handColorN(look);
    const ax = (side === 'f' ? 18.2 : 5.8) + off[0];
    const ay = G.by - 0.5 + off[1];
    g.ellipse(ax, ay, 1.3, 1.7, sleeve, { tag: 'arm' });
    g.set(ax + (side === 'f' ? 0.4 : -0.4), ay + 1.3, hand, 'arm');
}
function handColorN(look) {
    const t = look.body;
    return t === 'robot' || t === 'knight' ? METAL_SH : catPoint(look) ?? (isCat(t) ? '#fffaf2' : furOf(t) ? shade(look.hair, 0.3) : t === 'astro' || t === 'chef' ? WHITE : t === 'ghostie' ? '#f4f6ff' : SKIN);
}
// 手の色（武器の柄を握る手を、武器の上に描き直すため）
export function handColor(look) { return handColorN(norm(look)); }
export function handPos(p) {
    const G = geometry(p);
    return { x: 18.2 + p.armF[0], y: G.by + 0.8 + p.armF[1] };
}
// 頭の後ろに付くもの（長い耳・ポニーテールなど）
function drawBehindHead(g, G, look) {
    const { hx, hy, hry } = G;
    if (look.body === 'bunny') {
        // 長い耳（右の耳は先が少し折れている）。内側はピンク
        g.ellipse(hx - 2.8, hy - hry - 3.2, 1.9, 4.8, look.hair, { tag: 'ear' });
        g.ellipse(hx - 2.8, hy - hry - 2.6, 0.8, 3.4, '#ffb3cf', { tag: 'ear' });
        g.ellipse(hx + 2.8, hy - hry - 2.2, 1.9, 3.8, look.hair, { tag: 'ear' });
        g.ellipse(hx + 2.8, hy - hry - 1.8, 0.8, 2.6, '#ffb3cf', { tag: 'ear' });
        g.ellipse(hx + 4.6, hy - hry - 5.4, 1.7, 1.2, look.hair, { tag: 'ear' }); // 折れた先
    }
    if (look.body === 'astro') {
        // ガラスのヘルメット（頭より一回り大きい泡）
        g.ellipse(hx, hy, G.hrx + 1.6, hry + 1.4, '#cfefff', { hi: '#ffffff', tag: 'glass' });
    }
    if (look.body === 'samurai') {
        // ちょんまげ
        g.rect(hx - 1, hy - hry - 2, 3, 2, INK, 'hair');
    }
}
function drawHead(g, G, look, p) {
    const t = look.body;
    const { hx, hy, hrx, hry } = G;
    const o = oc(look);
    const fur = furOf(t);
    const furColor = fur ? furOfLook(look) : '';
    const skin = fur ? furColor : t === 'ghostie' ? '#f4f6ff' : SKIN;
    const skinSh = fur ? shade(furColor, -0.2) : t === 'ghostie' ? '#dde2f5' : SKIN_SH;
    drawBehindHead(g, G, look);
    if (t === 'robot') {
        g.rect(hx - hrx, hy - hry + 1, Math.round(hrx * 2) + 1, Math.round(hry * 2) - 1, METAL, 'head', true);
        g.rect(hx - hrx, hy + hry - 3, Math.round(hrx * 2) + 1, 2, METAL_SH, 'head');
        g.rect(hx - hrx + 2 + (p.side ? 2 : 0), hy - 2, Math.round(hrx * 2) - 4, 6, '#1a1c2c', 'face');
        g.rect(hx, hy - hry - 2, 1, 3, METAL_SH, 'head');
        g.ellipse(hx + 0.5, hy - hry - 2.5, 1.2, 1.2, look.hair, { tag: 'head' });
    }
    else {
        g.ellipse(hx, hy, hrx, hry, skin, { sh: skinSh, hi: fur ? shade(furColor, 0.4) : '#fff1e6', tag: 'head' });
    }
    switch (t) {
        case 'knight': {
            g.ellipse(hx, hy, hrx + 0.3, hry + 0.3, METAL, { sh: METAL_SH, hi: METAL_HI, tag: 'helm', onlyTop: Math.round(hy - 2) });
            for (const sx of [-1, 1])
                for (let y = Math.round(hy - 2); y <= Math.round(hy + 3); y++) {
                    g.set(hx + sx * (hrx - 0.2), y, METAL_SH, 'helm');
                    g.set(hx + sx * (hrx - 1.2), y, METAL, 'helm');
                }
            g.rect(hx - hrx + 1, hy - 2, Math.round(hrx * 2) - 1, 1, METAL_SH, 'helm');
            g.ellipse(hx - 1.5, hy - hry - 1.5, 2.2, 1.4, look.hair, { tag: 'plume' });
            break;
        }
        case 'mage':
        case 'witch': {
            const hatC = t === 'witch' ? shade(look.palette, -0.45) : o.c;
            g.rect(hx - hrx - 2, hy - hry + 2, Math.round(hrx * 2) + 5, 2, hatC, 'hat');
            for (let i = 0; i < 8; i++) {
                const w = Math.max(1, 9 - i * 1.1);
                g.rect(hx - w / 2 + i * (t === 'witch' ? -0.45 : 0.35), hy - hry + 1 - i, Math.round(w), 1, i === 1 ? look.hair : hatC, 'hat');
            }
            if (t === 'mage') {
                g.set(hx + 4, hy - hry - 7, o.c, 'hat');
                g.set(hx + 5, hy - hry - 6, o.hi, 'hat');
            }
            else {
                g.set(hx - 5, hy - hry - 6, hatC, 'hat');
                g.set(hx - 6, hy - hry - 5, hatC, 'hat');
            }
            for (const sx of [-1, 1])
                for (let y = 0; y < 3; y++)
                    g.set(hx + sx * (hrx - 0.5), hy - hry + 4 + y, look.hair, 'hair');
            break;
        }
        case 'rogue': {
            g.ellipse(hx, hy - 0.3, hrx + 0.8, hry + 0.6, o.dk, { sh: shade(o.dk, -0.2), hi: o.sh, tag: 'hood' });
            g.set(hx - hrx - 1, hy + 3, o.dk, 'hood');
            g.set(hx - hrx - 1.5, hy + 4, o.dk, 'hood');
            g.ellipse(hx, hy + 1.4, hrx - 1.2, hry - 1.7, skin, { sh: skinSh, tag: 'head' });
            g.rect(hx - hrx, hy + hry - 1, Math.round(hrx * 2) + 1, 2, look.hair, 'scarf');
            g.rect(hx - hrx - 2, hy + hry, 3, 1, look.hair, 'scarf');
            break;
        }
        case 'cat':
        case 'calico':
        case 'blackcat':
        case 'tuxcat':
        case 'siamese':
            drawCatHead(g, G, look, p);
            break;
        case 'bear': {
            for (const sx of [-1, 1]) {
                g.ellipse(hx + sx * (hrx - 1.2), hy - hry, 2.6, 2.6, look.hair, { tag: 'ear' });
                g.ellipse(hx + sx * (hrx - 1.2), hy - hry + 0.3, 1.3, 1.3, shade(look.hair, -0.3), { tag: 'ear' });
            }
            g.ellipse(hx + (p.side ? 2 : 0), hy + 2.6, 3, 2, shade(look.hair, 0.45), { tag: 'muzzle' });
            g.rect(hx - 0.5 + (p.side ? 2 : 0), hy + 1.5, 2, 1, INK, 'nose');
            break;
        }
        case 'bunny': {
            // ふくらんだほっぺ（白）
            const fx = p.side ? 2 : 0;
            for (const sx of [-1, 1])
                g.ellipse(hx + fx + sx * 1.4, hy + 2.8, 1.7, 1.3, '#fffaf5', { tag: 'muzzle' });
            break;
        }
        case 'frog': {
            // 頭の上の飛び出た目
            for (const sx of [-1, 1]) {
                const ox = sx * 3.6 + (p.side ? (sx < 0 ? 2.5 : 1.5) : 0);
                g.ellipse(hx + ox, hy - hry + 0.5, 2.4, 2.3, look.hair, { tag: 'eyebump' });
                g.ellipse(hx + ox, hy - hry + 0.7, 1.5, 1.5, '#ffffff', { tag: 'eyebump' });
            }
            break;
        }
        case 'ninja': {
            g.ellipse(hx, hy, hrx, hry, INK, { tag: 'hair', onlyTop: Math.round(hy - 3) });
            g.set(hx - 3, hy - hry - 1, INK, 'hair');
            g.set(hx + 1, hy - hry - 1, INK, 'hair');
            g.set(hx + 4, hy - hry, INK, 'hair');
            g.rect(hx - hrx, hy - 3, Math.round(hrx * 2) + 1, 2, look.hair, 'band');
            g.rect(hx - hrx - 3, hy - 3, 3, 1, look.hair, 'band');
            g.rect(hx - hrx - 4, hy - 2, 2, 1, look.hair, 'band');
            g.ellipse(hx, hy, hrx, hry, o.c, { tag: 'mask', onlyBottom: Math.round(hy + 2) });
            break;
        }
        case 'priest': {
            // ミトラ（縦長の帽子）
            for (let i = 0; i < 7; i++) {
                const w = 7 - Math.floor(i / 2);
                g.rect(hx - w / 2 + 0.5, hy - hry + 1 - i, w, 1, WHITE, 'hat');
            }
            g.rect(hx, hy - hry - 5, 1, 5, look.palette, 'hat');
            g.rect(hx - 1, hy - hry - 3, 3, 1, look.palette, 'hat');
            g.rect(hx - hrx + 1, hy - hry + 2, Math.round(hrx * 2) - 1, 1, '#f2c14e', 'hat');
            break;
        }
        case 'pirate': {
            // 三角帽
            const hc = shade(look.palette, -0.55);
            g.rect(hx - hrx - 2, hy - hry + 2, Math.round(hrx * 2) + 5, 2, hc, 'hat');
            g.ellipse(hx, hy - hry + 1, hrx - 1, 3, hc, { tag: 'hat', onlyTop: Math.round(hy - hry + 2) });
            g.set(hx - hrx - 2, hy - hry + 1, hc, 'hat');
            g.set(hx + hrx + 2, hy - hry + 1, hc, 'hat');
            g.rect(hx - 1, hy - hry, 3, 1, '#f2c14e', 'hat');
            g.rect(hx - hrx, hy + 4, Math.round(hrx * 2) + 1, 1, look.hair, 'beard');
            break;
        }
        case 'samurai': {
            // 兜と三日月の前立て
            g.ellipse(hx, hy, hrx + 0.4, hry + 0.3, o.dk, { sh: shade(o.dk, -0.2), hi: o.sh, tag: 'helm', onlyTop: Math.round(hy - 2) });
            for (const sx of [-1, 1])
                g.rect(hx + sx * (hrx - 0.5) - (sx > 0 ? 0 : 1), hy - 2, 2, 4, o.dk, 'helm');
            for (let i = 0; i < 5; i++) {
                g.set(hx - 3 + i * 1.5, hy - hry - 1 - Math.abs(2 - i) * -0.5 - 1.5 + Math.abs(2 - i) * 0.8, look.hair, 'crest');
            }
            g.set(hx, hy - hry - 0.5, look.hair, 'crest');
            break;
        }
        case 'chef': {
            // コック帽（ふくらんだ雲形）
            g.ellipse(hx, hy, hrx, hry, look.hair, { tag: 'hair', onlyTop: Math.round(hy - 3) });
            g.rect(hx - 4, hy - hry, 9, 2, WHITE, 'hat');
            for (const [dx, r] of [[-3, 2.6], [0, 3.2], [3, 2.6]])
                g.ellipse(hx + dx, hy - hry - 2.5, r, 2.6, WHITE, { sh: WHITE_SH, tag: 'hat' });
            break;
        }
        case 'astro': {
            g.ellipse(hx, hy, hrx, hry, look.hair, { tag: 'hair', onlyTop: Math.round(hy - 3) });
            // ヘルメットの首輪と反射
            g.rect(hx - hrx, hy + hry - 1, Math.round(hrx * 2) + 1, 2, '#dfe4ee', 'helm');
            g.set(hx - 4, hy - 4, '#ffffff', 'glass');
            g.set(hx - 5, hy - 3, '#ffffff', 'glass');
            g.set(hx - 3, hy - 5, '#e8fbff', 'glass');
            g.rect(hx + 4, hy - hry - 1, 1, 2, METAL_SH, 'helm');
            g.set(hx + 4, hy - hry - 2, look.hair, 'helm');
            break;
        }
        case 'ghostie': {
            g.ellipse(hx + 2.5, hy - hry + 1.5, 1.6, 1, look.palette, { tag: 'ribbon' });
            g.ellipse(hx + 5, hy - hry + 2, 1.6, 1, look.palette, { tag: 'ribbon' });
            break;
        }
        case 'robot':
            break;
    }
    drawFace(g, G, look, p);
}
// ねこの頭（大きめの耳・柄・口元）
function drawCatHead(g, G, look, p) {
    const t = look.body;
    const { hx, hy, hrx, hry } = G;
    const F = furOfLook(look), P = look.hair, fx = p.side ? 2 : 0;
    const dark = '#3a3040';
    // 耳（大きめの三角・内側はピンク）
    for (const sx of [-1, 1]) {
        const ex = hx + sx * (hrx - 2.6) + (p.side && sx < 0 ? 0.6 : 0);
        const earC = t === 'siamese' ? shade(P, -0.35) : t === 'calico' ? (sx < 0 ? P : dark) : F;
        for (let i = 0; i < 4; i++) {
            const w = [1, 3, 4, 5][i];
            g.rect(ex - (w - 1) / 2, hy - hry - 3 + i, w, 1, earC, 'ear');
        }
        g.set(ex, hy - hry - 1, '#ff9cc2', 'ear');
        g.rect(ex - 1 + (sx > 0 ? 1 : 0), hy - hry, 2, 1, '#ff9cc2', 'ear');
    }
    // 柄
    if (t === 'cat')
        for (const dx of [-2, 0, 2])
            g.rect(hx + dx + fx / 2, hy - hry + 1, 1, dx === 0 ? 3 : 2, shade(F, -0.3), 'stripe'); // 茶トラのおでこの縞
    if (t === 'calico') {
        g.ellipse(hx - 3.5, hy - 3.5, 3.2, 2.6, P, { tag: 'patch', onlyBottom: Math.round(hy - hry) });
        g.ellipse(hx + 4.2, hy - 4, 2.2, 1.8, dark, { tag: 'patch' });
    }
    if (t === 'tuxcat') { // はちわれ: 顔の下半分と、おでこの白い筋
        g.ellipse(hx + fx, hy + 2.6, 5.2, 3.4, '#fbf7f0', { tag: 'mask', onlyBottom: Math.round(hy) });
        g.rect(hx + fx - 0.5, hy - 2, 2, 3, '#fbf7f0', 'mask');
    }
    if (t === 'siamese')
        g.ellipse(hx + fx, hy + 1.8, 3.6, 2.6, shade(P, -0.35), { tag: 'mask' }); // シャム: 顔の真ん中が濃い
    // 口元のふくらみ
    if (t === 'cat' || t === 'calico')
        g.ellipse(hx + fx, hy + 2.9, 2.2, 1.3, '#fffaf2', { tag: 'muzzle' });
}
function drawFace(g, G, look, p) {
    const t = look.body;
    let { hx } = G;
    const { hy } = G;
    const ex = 3.6;
    const eyeY = Math.round(hy + (t === 'frog' ? -G.hry + 0.5 : 0));
    const eyeCol = t === 'robot' ? look.hair : INK;
    // 斜め横向き: 奥の目は中心に寄り、手前の目は前に出る（目と目の間が少し狭くなる）
    const fx = p.side ? 2 : 0;
    const lx = Math.round(hx - ex + 0.5 + (p.side ? 2.5 : 0)), rx = Math.round(hx + ex - 0.5 + (p.side ? 1.5 : 0));
    if (isCat(t)) {
        drawCatFace(g, G, look, p, lx, rx, eyeY);
        return;
    }
    if (t === 'bunny') {
        drawBunnyFace(g, G, p, lx, rx, eyeY);
        return;
    }
    for (const x of [lx, rx]) {
        if (t === 'pirate' && x === rx) {
            g.rect(x - 1, eyeY - 1, 3, 3, INK, 'eye');
            g.rect(x - 3, eyeY - 2, 2, 1, INK, 'eye');
            continue;
        } // 眼帯
        switch (p.eyes) {
            case 'open':
                g.set(x, eyeY, eyeCol, 'eye');
                g.set(x, eyeY + 1, eyeCol, 'eye');
                break;
            case 'blink':
                g.rect(x - 1, eyeY + 1, 2, 1, eyeCol, 'eye');
                break;
            case 'happy':
                g.set(x - 1, eyeY + 1, eyeCol, 'eye');
                g.set(x, eyeY, eyeCol, 'eye');
                g.set(x + 1, eyeY + 1, eyeCol, 'eye');
                break;
            case 'squint':
                g.set(x - 1, eyeY, eyeCol, 'eye');
                g.set(x, eyeY + 1, eyeCol, 'eye');
                g.set(x - 1, eyeY + 2, eyeCol, 'eye');
                break;
            case 'x':
                g.set(x - 1, eyeY - 1, eyeCol, 'eye');
                g.set(x, eyeY, eyeCol, 'eye');
                g.set(x - 1, eyeY + 1, eyeCol, 'eye');
                g.set(x + 1, eyeY - 1, eyeCol, 'eye');
                g.set(x + 1, eyeY + 1, eyeCol, 'eye');
                break;
            case 'swirl':
                g.rect(x - 1, eyeY - 1, 3, 1, eyeCol, 'eye');
                g.set(x + 1, eyeY, eyeCol, 'eye');
                g.rect(x - 1, eyeY + 1, 3, 1, eyeCol, 'eye');
                break;
        }
    }
    if (t === 'robot' || t === 'ninja')
        return;
    const by = Math.round(hy) + 2;
    g.set(lx - 2, by, BLUSH, 'blush');
    g.set(Math.min(rx + 2, Math.round(hx + G.hrx - 1)), by, BLUSH, 'blush');
    const my = Math.round(hy) + 2;
    hx += fx;
    if (t === 'bear') {
        g.set(hx, my - 1, INK, 'mouth');
        g.set(hx - 0.5, my, INK, 'mouth');
        g.set(hx + 0.5, my, INK, 'mouth');
        return;
    }
    if (t === 'frog') {
        g.rect(hx - 2, my, 5, 1, shade(look.hair, -0.5), 'mouth');
        return;
    }
    if (p.mouth === 'open')
        g.rect(hx - 0.5, my, 2, 2, '#9b3b4f', 'mouth');
    else if (p.mouth === 'grit')
        g.rect(hx - 1, my, 3, 1, INK, 'mouth');
    else if (p.mouth === 'flat')
        g.set(hx, my, INK, 'mouth');
    else {
        g.set(hx - 0.5, my, INK, 'mouth');
        g.set(hx + 0.5, my, INK, 'mouth');
    }
}
// ねこの顔: 大きな目（光が入る）・ピンクの鼻・ωの口・ひげ
function drawCatFace(g, G, look, p, lx, rx, eyeY) {
    const t = look.body;
    const hx = Math.round(G.hx + (p.side ? 2 : 0)), hy = Math.round(G.hy);
    const darkFur = t === 'blackcat' || (t === 'tuxcat' && false);
    const iris = t === 'blackcat' ? '#f7d51d' : t === 'siamese' ? '#5fb3f0' : INK;
    for (const [x0, back] of [[lx - 1, true], [rx, false]]) {
        const x = x0 + (p.side && back ? 1 : 0);
        switch (p.eyes) {
            case 'open':
                g.rect(x, eyeY - 1, 2, 3, iris, 'eye');
                if (iris !== INK)
                    g.rect(x + 1, eyeY, 1, 2, INK, 'eye'); // 黒ねこ・シャムは瞳孔
                g.set(x, eyeY - 1, '#ffffff', 'eye'); // 目の光
                break;
            case 'blink':
                g.rect(x, eyeY + 1, 2, 1, darkFur ? '#f7d51d' : INK, 'eye');
                break;
            case 'happy':
                g.set(x, eyeY + 1, darkFur ? '#f7d51d' : INK, 'eye');
                g.set(x + 1, eyeY, darkFur ? '#f7d51d' : INK, 'eye');
                g.set(x + 2, eyeY + 1, darkFur ? '#f7d51d' : INK, 'eye');
                break;
            case 'squint':
                g.rect(x, eyeY, 2, 1, darkFur ? '#f7d51d' : INK, 'eye');
                g.set(x + (back ? 0 : 1), eyeY - 1, darkFur ? '#f7d51d' : INK, 'eye');
                break;
            default: {
                const c = darkFur ? '#f7d51d' : INK;
                g.set(x, eyeY - 1, c, 'eye');
                g.set(x + 1, eyeY, c, 'eye');
                g.set(x, eyeY + 1, c, 'eye');
                g.set(x + 2, eyeY - 1, c, 'eye');
                g.set(x + 2, eyeY + 1, c, 'eye');
            }
        }
    }
    const my = hy + 3;
    g.set(hx, my - 1, '#ff7aa8', 'nose');
    const mc = darkFur ? '#f2d0dc' : INK;
    if (p.mouth === 'open') {
        g.set(hx - 1, my, mc, 'mouth');
        g.set(hx + 1, my, mc, 'mouth');
        g.set(hx, my + 1, '#d0506a', 'mouth');
    }
    else {
        g.set(hx - 1, my, mc, 'mouth');
        g.set(hx + 1, my, mc, 'mouth');
    }
    // ひげ
    const wc = darkFur || t === 'tuxcat' ? '#e9e4f5' : shade(furOfLook(look), -0.5);
    for (const sx of [-1, 1]) {
        if (p.side && sx < 0)
            continue;
        const ox = Math.round(G.hx) + sx * 7 + (p.side ? 1 : 0);
        g.set(ox, my - 1, wc, 'whisker');
        g.set(ox + sx, my - 2, wc, 'whisker');
        g.set(ox, my + 1, wc, 'whisker');
        g.set(ox + sx, my + 1, wc, 'whisker');
    }
    g.set(lx - 2, hy + 2, BLUSH, 'blush');
    g.set(Math.min(rx + 3, Math.round(G.hx + G.hrx - 1)), hy + 2, BLUSH, 'blush');
}
// うさぎの顔: 光の入った大きな目・ピンクの鼻・小さな口・大きめのほっぺの赤み
function drawBunnyFace(g, G, p, lx, rx, eyeY) {
    const hx = Math.round(G.hx + (p.side ? 2 : 0)), hy = Math.round(G.hy);
    for (const [x0, back] of [[lx - 1, true], [rx, false]]) {
        const x = x0 + (p.side && back ? 1 : 0);
        switch (p.eyes) {
            case 'open':
                g.rect(x, eyeY - 1, 2, 3, '#5a2a3a', 'eye');
                g.set(x, eyeY - 1, '#ffffff', 'eye');
                g.set(x + 1, eyeY + 1, '#8a4a5a', 'eye');
                break;
            case 'blink':
                g.rect(x, eyeY + 1, 2, 1, INK, 'eye');
                break;
            case 'happy':
                g.set(x, eyeY + 1, INK, 'eye');
                g.set(x + 1, eyeY, INK, 'eye');
                g.set(x + 2, eyeY + 1, INK, 'eye');
                break;
            case 'squint':
                g.rect(x, eyeY, 2, 1, INK, 'eye');
                g.set(x + (back ? 0 : 1), eyeY - 1, INK, 'eye');
                break;
            default:
                g.set(x, eyeY - 1, INK, 'eye');
                g.set(x + 1, eyeY, INK, 'eye');
                g.set(x, eyeY + 1, INK, 'eye');
                g.set(x + 2, eyeY - 1, INK, 'eye');
                g.set(x + 2, eyeY + 1, INK, 'eye');
        }
    }
    const my = hy + 3;
    g.set(hx, my - 1, '#ff7aa8', 'nose');
    if (p.mouth === 'open')
        g.rect(hx, my + 1, 1, 1, '#d0506a', 'mouth');
    g.set(hx, my, INK, 'mouth');
    for (const [x, w] of [[lx - 3, 2], [Math.min(rx + 2, Math.round(G.hx + G.hrx - 2)), 2]])
        g.rect(x, hy + 2, w, 1, BLUSH, 'blush');
}
function drawTail(g, G, look) {
    const t = look.body;
    const y = G.by + 1;
    if (isCat(t)) {
        const F = furOfLook(look), tip = catPoint(look) ?? (t === 'calico' ? '#3a3040' : t === 'cat' ? shade(F, -0.3) : F);
        const pts = [[0, 1], [0, 0], [-1, -1], [-2, -2], [-2, -3], [-2, -4], [-1, -5], [0, -6]];
        pts.forEach(([dx, dy], i) => {
            const c = i >= 6 ? tip : t === 'cat' && i % 2 ? shade(F, -0.3) : t === 'calico' && i > 2 ? look.hair : F;
            g.set(5 + dx, y + dy, c, 'tail');
            g.set(4 + dx, y + dy, c, 'tail');
        });
    }
    if (t === 'bunny') {
        g.ellipse(4.3, y - 0.5, 2.1, 2.1, '#fffaf5', { tag: 'tail' });
        g.set(4, y - 1, '#ffffff', 'tail');
    } // まんまるのしっぽ
    if (t === 'bear')
        g.ellipse(4.8, y, 1.2, 1.2, look.hair, { tag: 'tail' });
    if (t === 'witch')
        for (let i = 0; i < 6; i++)
            g.set(3 + i, y - 4 + i * 0.4, '#8b5a2b', 'broom'); // ほうき
}
function drawSweat(g, G) {
    g.set(G.hx + G.hrx + 1, G.hy - 2, '#8fd3ff', 'fx');
    g.set(G.hx + G.hrx + 1, G.hy - 1, '#8fd3ff', 'fx');
    g.set(G.hx + G.hrx + 2, G.hy - 1, '#d8f3ff', 'fx');
}
// アウトライン（4近傍。となりの色を濃くした色）
function finish(g) {
    const out = new Grid();
    out.c = g.c.slice();
    out.tag = g.tag.slice();
    for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
            if (g.get(x, y))
                continue;
            const nb = [g.get(x - 1, y), g.get(x + 1, y), g.get(x, y - 1), g.get(x, y + 1)].filter(Boolean);
            if (!nb.length)
                continue;
            out.c[y * W + x] = shade(nb[0], -0.55);
            out.tag[y * W + x] = 'outline';
        }
    return out;
}
export function renderChar(look0, p) {
    const look = norm(look0);
    const g = new Grid();
    const G = geometry(p);
    drawTail(g, G, look);
    drawArm(g, G, look, 'b', p.armB);
    drawFeet(g, p, look);
    drawBody(g, G, look, p);
    drawHead(g, G, look, p);
    drawArm(g, G, look, 'f', p.armF);
    if (p.sweat)
        drawSweat(g, G);
    return finish(g);
}
const cache = new Map();
export function charCanvas(look, p, flip = false, flash = false) {
    const key = `${look.body}|${look.pattern ?? ''}|${look.palette}|${look.hair}|${p.bob}|${p.headDx}|${p.headDy}|${p.armF}|${p.armB}|${p.footF}|${p.footB}|${p.squash}|${p.eyes}|${p.mouth}|${p.sweat ? 1 : 0}|${p.side ? 1 : 0}|${flip ? 1 : 0}|${flash ? 1 : 0}`;
    let c = cache.get(key);
    if (c)
        return c;
    if (cache.size > 4000)
        cache.clear();
    c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    const g = renderChar(look, p);
    for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
            const col = g.get(x, y);
            if (!col)
                continue;
            ctx.fillStyle = flash ? (g.tag[y * W + x] === 'outline' ? col : '#ffffff') : col;
            ctx.fillRect(flip ? W - 1 - x : x, y, 1, 1);
        }
    cache.set(key, c);
    return c;
}
const R = Math.round;
export function poseFor(action, t, frame) {
    const p = { ...NEUTRAL, armF: [0, 0], armB: [0, 0], footF: [0, 0], footB: [0, 0] };
    const blink = frame % 140 < 6;
    switch (action) {
        case 'idle':
            p.bob = Math.floor(frame / 16) % 2;
            p.armF = [0, p.bob];
            p.armB = [0, p.bob];
            p.eyes = blink ? 'blink' : 'open';
            break;
        case 'walk': {
            const ph = Math.floor(frame / 5) % 4;
            p.footF = [[1, 0], [0, -1], [-1, 0], [0, 0]][ph];
            p.footB = [[-1, 0], [0, 0], [1, 0], [0, -1]][ph];
            p.bob = ph % 2 ? -1 : 0;
            p.armF = [ph < 2 ? -1 : 1, 0];
            p.armB = [ph < 2 ? 1 : -1, 0];
            p.eyes = blink ? 'blink' : 'open';
            break;
        }
        case 'attack': // 溜め → 踏み込み → 戻り
            if (t < 0.4) {
                const k = t / 0.4;
                p.headDx = -R(k);
                p.armF = [-R(2 * k), -R(2 * k)];
                p.squash = R(k);
                p.mouth = 'grit';
                p.eyes = 'squint';
            }
            else if (t < 0.65) {
                p.headDx = 2;
                p.armF = [3, -1];
                p.armB = [1, 0];
                p.footF = [2, 0];
                p.footB = [-1, 0];
                p.mouth = 'open';
                p.eyes = 'open';
            }
            else {
                const k = (t - 0.65) / 0.35;
                p.headDx = R(2 * (1 - k));
                p.armF = [R(3 * (1 - k)), 0];
                p.mouth = 'smile';
            }
            break;
        case 'cast':
            p.armF = [0, -4];
            p.armB = [0, -4];
            p.bob = -R(Math.sin(t * Math.PI) * 2);
            p.eyes = t > 0.2 && t < 0.8 ? 'blink' : 'open';
            p.mouth = 'open';
            break;
        case 'guard':
            {
                const k = t > 0 ? t : 1;
                p.squash = R(k);
                p.armF = [R(2 * k), -R(k)];
                p.armB = [R(k), -R(k)];
                p.headDx = -R(k);
                p.eyes = 'squint';
                p.mouth = 'grit';
            }
            break;
        case 'hurt':
            p.headDx = -2;
            p.headDy = 1;
            p.armF = [-1, 1];
            p.armB = [-1, -1];
            p.eyes = 'x';
            p.mouth = 'open';
            p.footF = [-1, 0];
            break;
        case 'dash': {
            const ph = Math.floor(frame / 3) % 2;
            p.headDx = 2;
            p.armF = [-2, 1];
            p.armB = [-2, 0];
            p.footF = ph ? [2, -1] : [-1, 0];
            p.footB = ph ? [-2, 0] : [1, -1];
            p.eyes = 'squint';
            p.mouth = 'open';
            p.sweat = true;
            break;
        }
        case 'pass':
            p.armF = [-1, -2];
            p.armB = [1, -2];
            p.eyes = 'happy';
            p.mouth = 'flat';
            p.sweat = true;
            p.headDy = 1;
            break;
        case 'ko':
            p.eyes = 'swirl';
            p.mouth = 'open';
            p.squash = 1;
            p.armF = [1, 2];
            p.armB = [-1, 2];
            break;
        case 'victory': {
            const j = Math.abs(Math.sin(t * Math.PI * 2));
            p.bob = -R(j * 5);
            p.armF = [1, -5];
            p.armB = [-1, -5];
            p.eyes = 'happy';
            p.mouth = 'open';
            p.footF = [0, -R(j)];
            p.footB = [0, -R(j)];
            break;
        }
    }
    return p;
}
//# sourceMappingURL=chibi.js.map