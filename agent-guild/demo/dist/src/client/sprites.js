// モンスター（まんまるマスコット調。ふちは主色の濃い色）
const MONSTERS = {
    normal: [
        '....ffffff....', '..ffllffffff..', '.fllffffffffd.', '.ffwefffwefff.',
        'fffeefffeeffff', 'ffffffmmfffffd', 'dfffffffffffdd', '.dddddddddddd.',
    ],
    trap: [
        '....ffffff....', '..ffllffffff..', '.fllfffffffff.', '.ffwefffwefff.',
        '.ffeefffeefff.', '.ffffmmmmffff.', '.ffffffffffff.', '.ff.ff.ff.ff..',
    ],
    bonus: [
        '..dddddddddd..', '.dffffffffffd.', '.dlllllllllld.', '.yyyyyyyyyyyy.',
        '.dfffyyyyfffd.', '.dfffywwyfffd.', '.dffffffffffd.', '.dddddddddddd.',
    ],
    boss: [
        '.y............y.', '.yy..........yy.', '..yyffffffffyy..', '..ffllffffffff..',
        '.fllfffffffffff.', '.ffrrfffffrrfff.', '.ffrefffffrefff.', '.ffffffffffffff.',
        '.fffwmwmwmwffff.', '.fffmmmmmmmffff.', 'ddffffffffffffdd', 'dd.ffffffffff.dd',
        '...ffff..ffff...', '...ddd....ddd...',
    ],
};
const TOMB = [
    '....oooooo....', '...ommmmmmo...', '..ommmkkmmmo..', '..ommkkkkmmo..', '..ommmkkmmmo..',
    '..ommmkkmmmo..', '..ommmmmmmmo..', '..ommmmmmmmo..', '.oooooooooooo.', 'oggggggggggggo',
];
const POTION = ['.oo.', '.ww.', 'orro', 'orro', '.oo.'];
const CROWN = ['y.y.y', 'yyyyy', 'yryry', 'yyyyy'];
// --- 色 ---
export function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export function shade(hex, k) {
    const [r, g, b] = hexToRgb(hex);
    return k >= 0 ? toHex(r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k) : toHex(r * (1 + k), g * (1 + k), b * (1 + k));
}
const BASE = {
    o: '#1a1c2c', e: '#1a1c2c', s: '#f2c9a0', m: '#c2c3c7', k: '#566c86', b: '#5d3a1a', w: '#ffffff',
    x: '#8b5a2b', y: '#f2c14e', r: '#e43b44', g: '#3e8948',
};
// 格子を塗り、まわりに指定色のふちを付けた canvas（マスコット調の共通処理）
const ocache = new Map();
export function outlined(key, grid, colors, outline, flip = false, flash = false) {
    const k = `${key}|${flip ? 1 : 0}|${flash ? 1 : 0}`;
    let c = ocache.get(k);
    if (c)
        return c;
    if (ocache.size > 3000)
        ocache.clear();
    const gw = Math.max(...grid.map((r) => r.length)), gh = grid.length;
    const pad = outline ? 1 : 0;
    const w = gw + pad * 2, h = gh + pad * 2;
    const px = new Array(w * h).fill(null);
    grid.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) {
            const col = colors[row[i]];
            if (row[i] === '.' || !col)
                continue;
            px[(j + pad) * w + i + pad] = col;
        }
    });
    c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
            let col = px[y * w + x];
            if (!col && outline) {
                const nb = (x > 0 && px[y * w + x - 1]) || (x < w - 1 && px[y * w + x + 1]) || (y > 0 && px[(y - 1) * w + x]) || (y < h - 1 && px[(y + 1) * w + x]);
                if (nb)
                    col = outline;
            }
            else if (col && flash)
                col = '#ffffff';
            if (!col)
                continue;
            ctx.fillStyle = col;
            ctx.fillRect(flip ? w - 1 - x : x, y, 1, 1);
        }
    ocache.set(k, c);
    return c;
}
function paint(ctx, grid, colors, x, y, flip = false, flash = false) {
    const w = Math.max(...grid.map((r) => r.length));
    grid.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) {
            const ch = row[i];
            if (ch === '.' || ch === ' ')
                continue;
            const c = flash ? '#ffffff' : colors[ch] ?? BASE[ch];
            if (!c)
                continue;
            ctx.fillStyle = c;
            ctx.fillRect(x + (flip ? w - 1 - i : i), y + j, 1, 1);
        }
    });
}
const cache = new Map();
function cached(key, w, h, draw) {
    let c = cache.get(key);
    if (!c) {
        c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        draw(c.getContext('2d'));
        cache.set(key, c);
    }
    return c;
}
const INK = '#2b1d2e';
const MONSTER_COLORS = {
    normal: { f: '#7bd66a', l: '#c8f5a8', d: '#4fa548', w: '#ffffff', e: INK, m: '#9b3b4f' },
    trap: { f: '#b9a3ff', l: '#ecdfff', d: '#8a6fd6', w: '#ffffff', e: INK, m: '#5a3d8a' },
    bonus: { f: '#c97a3a', l: '#e8a35c', d: '#7a4a22', y: '#feae34', w: '#fff3c4' },
    boss: { f: '#a0705a', l: '#d1a083', d: '#5a3a2a', y: '#f2e2c0', r: '#ff3b3b', e: INK, w: '#ffffff', m: '#3d1f2b' },
};
const MONSTER_OUTLINE = { normal: '#24572a', trap: '#3f2a7a', bonus: '#4a2a12', boss: '#3a1f18' };
export function monsterSprite(kind, flash = false) {
    return outlined(`mon:${kind}`, MONSTERS[kind], MONSTER_COLORS[kind], MONSTER_OUTLINE[kind], false, flash);
}
export function tombSprite() {
    return cached('tomb', 14, 10, (ctx) => paint(ctx, TOMB, {}, 0, 0));
}
export function potionSprite() {
    return cached('potion', 4, 5, (ctx) => paint(ctx, POTION, {}, 0, 0));
}
export function shieldIcon() {
    return outlined('shieldicon', ['fffff', 'flllf', 'fflff', '.fff.', '..f..'], { f: '#5fcde4', l: '#d8f6ff' }, '#1d4e6b');
}
export function crownSprite() {
    return cached('crown', 5, 4, (ctx) => paint(ctx, CROWN, {}, 0, 0));
}
//# sourceMappingURL=sprites.js.map