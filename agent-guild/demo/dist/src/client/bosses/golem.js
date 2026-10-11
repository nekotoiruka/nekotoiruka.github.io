// ボス: golem（守護巨人ゴルドム）。右向き・96x84 ドット。ポーズの意味は boss.ts の BossPose を参照
// 四角い岩ブロックを積んだ人型。光源は左上。胸のルーンと横長の一つ目が青緑に光る（怒りで赤）。
import { BOSS_RENDERERS, G, INK, outline } from '../boss.js';
import { shade } from '../sprites.js';
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export function render(p) {
    const g = new G();
    const rage = p.tint === 'rage';
    const stone = rage
        ? { hi: '#b0756a', base: '#8a4f45', sh: '#62342f', dk: '#3a1d1d' }
        : { hi: '#dcc79e', base: '#b39a74', sh: '#857057', dk: '#54443a' };
    const dark = { hi: stone.base, base: stone.sh, sh: shade(stone.sh, -0.2), dk: stone.dk };
    const glow = rage ? '#ff4a3a' : '#3fe0c8';
    const glowHi = rage ? '#ffd0a0' : '#c8fff4';
    const glowDim = rage ? '#9a2020' : '#1f7f78';
    const moss = rage ? '#5a5a2a' : '#6f9440', mossDk = rage ? '#3c3c1c' : '#47662a';
    const sand = rage ? '#c08a70' : '#e6d3a8';
    const sq = p.squash;
    const y0 = p.bob + sq * 0.6;
    let bid = 0;
    // ブロック: 撃破時は番号ごとにずれて、ばらける
    const box = (x, y, w, h, pal, o = {}) => {
        const id = ++bid;
        const fall = o.fall ?? 1;
        const k = Math.max(0, sq - 1) * fall;
        const dx = Math.round((hash(id) - 0.5) * k * 3 + (sq >= 3 ? (hash(id + 9) - 0.5) * sq * 2 : 0));
        const dy = Math.round(hash(id + 3) * k * 1.2);
        x = Math.round(x + dx);
        y = Math.round(y + dy);
        w = Math.round(w);
        h = Math.round(h);
        for (let j = 0; j < h; j++)
            for (let i = 0; i < w; i++) {
                let c = pal.base;
                if (j === h - 1 || i === w - 1)
                    c = pal.dk;
                else if (j >= h - 3 || i >= w - 3)
                    c = (j >= h - 3 && i >= w - 3) || ((i + j) % 2 === 0) || j === h - 2 || i === w - 2 ? pal.sh : pal.base;
                else if (j === 0 || i === 0)
                    c = pal.hi;
                else if (j === 1 && i < w * 0.5 && i % 2 === 0)
                    c = pal.hi;
                g.set(x + i, y + j, c);
            }
        if (o.crack && w > 5 && h > 5) {
            let cx = x + 2 + Math.floor(hash(id + 5) * (w - 4)), cy = y;
            const len = Math.min(h - 2, 3 + Math.floor(hash(id + 7) * 5));
            for (let t = 0; t < len; t++) {
                g.set(cx, cy + t, pal.dk);
                if (t % 2 === 1) {
                    cx += hash(id + t) > 0.5 ? 1 : -1;
                    g.set(cx, cy + t, pal.dk);
                }
            }
            g.set(cx + 1, cy + 1, pal.hi);
        }
        if (o.moss) {
            const mw = Math.max(3, Math.floor(w * 0.45)), mx = x + 1 + Math.floor(hash(id + 11) * (w - mw - 1));
            for (let i = 0; i < mw; i++) {
                g.set(mx + i, y, moss);
                g.set(mx + i, y - 1 + (i % 3 === 1 ? 0 : 1), i % 2 ? moss : mossDk);
                if (i > 0 && i < mw - 1 && hash(id + i) > 0.4)
                    g.set(mx + i, y + 1, mossDk);
                if (hash(id + i * 3) > 0.7)
                    g.set(mx + i, y + 2, mossDk);
            }
        }
        if (o.sand)
            for (let i = 1; i < w - 1; i++)
                if (hash(id * 7 + i) > 0.55)
                    g.set(x + i, y + h - 2 - (hash(id + i * 5) > 0.7 ? 1 : 0), sand);
        return { x, y };
    };
    // ── 浮遊する小石（後ろ側） ──
    const pebble = (x, y, s) => box(x, y, s, s, stone, { fall: 2 });
    pebble(10, 22 - p.bob * 1.5 + Math.sin(p.tail) * 1.5, 4);
    pebble(18, 12 + p.bob, 3);
    // ── 奥の腕（左側、体の後ろ） ──
    const wing = p.wing;
    const bsx = 22, bsy = 30 + y0;
    const bFistX = 14 - wing * 2.5, bFistY = 56 + y0 - wing * 9;
    box(bsx + (bFistX - bsx) * 0.4 + 1, bsy + 8 + (bFistY - bsy - 8) * 0.35, 9, 11, dark, { fall: 1.5 });
    box(bFistX + 1, bFistY - 9, 9, 10, dark, { crack: true, fall: 1.5 });
    box(bFistX - 1, bFistY, 13, 11, dark, { fall: 1.5 });
    // ── 脚 ──
    const lift = Math.max(0, p.tail) * 2.2; // 前足を上げる（踏み鳴らし）
    const backLift = Math.max(0, -p.tail) * 1.5;
    // 奥の脚
    box(32, 62 + y0 * 0.5 - backLift, 12, 12, dark, { fall: 0.6 });
    box(29, 72 + p.bob * 0.2 - backLift, 17, 8, dark, { sand: true, fall: 0.4 });
    // 手前の脚
    const fx = 50 + lift * 0.4;
    box(fx, 62 + y0 * 0.5 - lift, 13, 12, stone, { crack: true, fall: 0.6 });
    box(fx - 2, 72 + p.bob * 0.2 - lift, 19, 8, stone, { sand: true, fall: 0.4 });
    if (lift > 2)
        for (let i = 0; i < 4; i++)
            g.set(fx - 3 + i * 6, 79 - (i % 2), sand); // 舞う砂
    // ── 腰と胴 ──
    const tilt = Math.max(0, p.tail) * 0.3; // 片足立ちで少し後ろへ
    const bx = 30 - tilt + Math.max(0, p.lean) * 0.25;
    box(bx + 4, 56 + y0, 30, 9, stone, { sand: true, fall: 0.8 });
    box(bx + 3, 44 + y0, 32, 14, { hi: stone.base, base: shade(stone.base, -0.1), sh: stone.sh, dk: stone.dk }, { crack: true, fall: 1.0 });
    box(bx - 1, 26 + y0, 40, 20, stone, { crack: true, moss: true, fall: 1.2 });
    // 胸の石板とルーン
    const slab = box(bx + 12, 34 + y0, 17, 16, dark, { fall: 1.4 });
    const rx = slab.x + 8, ry = slab.y + 7;
    const m = p.mouth;
    const lit = p.eye === 'ko' ? glowDim : glow;
    if (m > 0 && p.eye !== 'ko') {
        for (let yy = -6; yy <= 6; yy++)
            for (let xx = -6; xx <= 6; xx++) {
                const d = Math.abs(xx) + Math.abs(yy);
                if (d <= 4 + m && (xx + yy) % 2 === 0 && g.get(rx + xx, ry + yy))
                    g.set(rx + xx, ry + yy, shade(glow, -0.35));
            }
    }
    // ルーン（ひし形＋縦線＋横棒）
    for (let t = -4; t <= 4; t++) {
        g.set(rx + t, ry - 4 + Math.abs(t), lit);
        g.set(rx + t, ry + 4 - Math.abs(t), lit);
    }
    for (let t = -5; t <= 5; t++)
        g.set(rx, ry + t, lit);
    g.set(rx - 2, ry, lit);
    g.set(rx + 2, ry, lit);
    if (p.eye !== 'ko') {
        g.set(rx, ry, glowHi);
        if (m > 0) {
            g.set(rx, ry - 1, glowHi);
            g.set(rx, ry + 1, glowHi);
            g.set(rx - 1, ry, glowHi);
            g.set(rx + 1, ry, glowHi);
        }
    }
    // 背中のひび＋砂
    for (let i = 0; i < 5; i++)
        g.set(bx + 3 + i, 50 + y0 + (i % 2), stone.dk);
    let ex = 0, ey = 0;
    const drawHead = () => {
        // ── 頭（小さめ、少し前へ） ──
        const hx = bx + 19 + Math.max(0, p.lean) * 0.35 + Math.min(0, p.lean) * 0.3, hy = 11 + y0 + Math.max(0, p.lean) * 0.4;
        box(hx + 2, hy + 12, 13, 6, dark, { fall: 1.6 }); // 首
        const head = box(hx, hy, 18, 14, stone, { moss: true, fall: 2 });
        ex = head.x + 6;
        ey = head.y + 6;
        // 眉（せり出した岩）
        const angry = p.eye === 'angry' || rage;
        for (let i = -1; i < 12; i++) {
            const by = ey - 3 + (angry ? Math.floor((i + 1) / 4) : 0);
            g.set(ex + i, by, stone.dk);
            g.set(ex + i, by - 1, stone.sh);
        }
        // 目（横長のスリット）
        for (let i = 0; i < 11; i++)
            g.set(ex + i, ey, INK), g.set(ex + i, ey + 1, INK);
        if (p.eye === 'ko') {
            for (let t = -2; t <= 2; t++) {
                g.set(ex + 4 + t, ey + t, glowDim);
                g.set(ex + 4 + t, ey - t, glowDim);
            }
        }
        else if (p.eye === 'hurt') {
            for (let i = 0; i < 11; i++)
                g.set(ex + i, ey, stone.dk), g.set(ex + i, ey + 1, i % 2 ? glowDim : INK);
            g.set(ex + 1, ey - 1, stone.dk);
            g.set(ex + 9, ey - 1, stone.dk);
            g.set(ex - 1, ey - 2, stone.dk);
            g.set(ex + 11, ey - 2, stone.dk);
        }
        else {
            for (let i = 1; i < 10; i++)
                g.set(ex + i, ey, glow), g.set(ex + i, ey + 1, angry ? glow : shade(glow, -0.3));
            g.set(ex + 6, ey, glowHi);
            g.set(ex + 7, ey, glowHi);
            g.set(ex + 8, ey, glowHi);
            if (angry || p.mouth > 0) {
                for (let i = 2; i < 9; i += 2)
                    g.set(ex + i, ey + 2, shade(glow, -0.4));
                g.set(ex + 11, ey, glow);
                g.set(ex + 12, ey, glowHi);
                g.set(ex + 13, ey - 1, glow);
                g.set(ex + 13, ey + 1, glow);
            }
        }
        // あご
        for (let i = 3; i < 16; i++)
            g.set(head.x + i, head.y + 10, stone.sh);
        for (let i = 5; i < 15; i += 3)
            g.set(head.x + i, head.y + 11, stone.dk);
    };
    // ── 手前の腕（右拳） ──
    // lean>0: 前へ叩きつける / lean<0: 振りかぶる / wing>0: 両腕を広げて持ち上げる
    const shx = bx + 36, shy = 26 + y0;
    let fistX = 76, fistY = 60 + y0;
    const tl = Math.max(0, Math.min(1, p.lean / 12));
    fistX += wing * 2.5 * (1 - tl);
    fistY -= wing * 9 * (1 - tl);
    if (p.lean > 0) {
        fistX += tl * (85 - fistX);
        fistY += tl * (40 - fistY);
    }
    if (p.lean < 0) {
        const t = Math.min(1, -p.lean / 5);
        fistX -= t * 8;
        fistY -= t * 34;
    }
    fistY = Math.max(14 + y0 * 0.5, fistY);
    const elX = (shx + 8 + fistX) / 2 + (p.lean < 0 ? 4 : 0), elY = (shy + 10 + fistY) / 2 + (p.lean > 0 ? 3 : 0);
    box(elX - 5, elY - 5, 11, 11, stone, { crack: true, fall: 1.8 }); // 腕
    // 肩（巨大）
    box(shx - 4, shy - 5, 19, 16, stone, { moss: true, crack: true, fall: 2 });
    drawHead();
    // 拳
    const fist = box(fistX - 7, fistY - 6, 15, 13, stone, { fall: 1.8 });
    for (let i = 1; i < 4; i++) {
        g.set(fist.x + 13, fist.y + i * 3, stone.dk);
        g.set(fist.x + 12, fist.y + i * 3, stone.sh);
    } // 指の段
    // 叩きつけの衝撃
    if (p.lean >= 10) {
        for (let i = 0; i < 4; i++) {
            g.set(fist.x + 4 + i * 3, fist.y - 2 - (i % 2) * 2, sand);
            g.set(fist.x + 4 + i * 3, fist.y + 15 + (i % 2) * 2, sand);
        }
        for (let i = 0; i < 6; i++)
            g.set(fist.x - 2 - i * 2, fist.y + 3 + (i % 3) * 3, sand);
    }
    // 奥の肩（体の上に少しのぞく）
    box(bx - 8, 23 + y0, 16, 14, stone, { moss: true, fall: 2 });
    // ── 光線の溜め（目→前方の光球） ──
    if (m > 0 && p.eye !== 'ko' && p.eye !== 'hurt') {
        const ox = 86, oy = 35;
        const r = 1.5 + m * 1.8;
        for (let x = ex + 9; x < ox - r; x++)
            if ((x + Math.floor(m * 2)) % 3 !== 0)
                g.set(x, ey + Math.round(((x - ex) / (ox - ex)) * (oy - ey)), glow);
        g.ellipse(ox, oy, r + 1.5, r + 1.5, shade(glow, -0.35));
        g.ellipse(ox, oy, r, r, glow);
        g.ellipse(ox - 0.5, oy - 0.5, r * 0.5, r * 0.5, glowHi);
        if (m >= 1.5)
            for (let t = 0; t < 4; t++) {
                const a = t * Math.PI / 2 + Math.PI / 4;
                g.set(ox + Math.cos(a) * (r + 3), oy + Math.sin(a) * (r + 3), glowHi);
            }
    }
    // ── 浮遊する小石（手前） ──
    pebble(76, 16 - p.bob * 1.5 + wing, 3);
    pebble(80, 70 - p.bob, 4);
    pebble(6, 48 + p.bob * 1.5, 3);
    // 撃破: 砂ぼこり
    if (sq >= 3)
        for (let i = 0; i < 18; i++)
            g.set(16 + hash(i + 40) * 64, 76 + hash(i + 80) * 4, sand);
    return outline(g);
}
BOSS_RENDERERS.golem = render;
//# sourceMappingURL=golem.js.map