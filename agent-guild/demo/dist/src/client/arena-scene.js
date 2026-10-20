import { Rng } from '../shared/rng.js';
import { isUltScene } from './scenes.js';
import { beginDefer, crispen, endDefer, fxLook, ULT_CRISP } from './fxlook.js';
// --- 背景: 城の大広間（上に壁と旗と松明、下に石畳） ---
export function makeBackground() {
    const { w, h } = this.script.arena;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    const rng = new Rng('bg:' + this.script.seed);
    g.fillStyle = '#2a2140';
    g.fillRect(0, 0, w, 78);
    for (let y = 0; y < 78; y += 10)
        for (let x = (y / 10) % 2 ? -10 : 0; x < w; x += 20) {
            g.fillStyle = rng.pick(['#332850', '#2f254a', '#372b56']);
            g.fillRect(x + 1, y + 1, 18, 8);
        }
    for (const bx of [150, 246, 342]) {
        g.fillStyle = '#5a1f2b';
        g.fillRect(bx - 8, 8, 16, 34);
        g.fillStyle = '#8a2e3e';
        g.fillRect(bx - 6, 8, 12, 30);
        g.fillStyle = '#f2c14e';
        g.fillRect(bx - 2, 18, 4, 4);
        g.fillRect(bx - 1, 24, 2, 6);
        g.beginPath();
        g.moveTo(bx - 8, 42);
        g.lineTo(bx, 36);
        g.lineTo(bx + 8, 42);
        g.fillStyle = '#2a2140';
        g.fill();
    }
    for (const tx of [198, 294]) {
        g.fillStyle = '#4b4f5c';
        g.fillRect(tx - 2, 40, 4, 10);
        g.fillStyle = '#feae34';
        g.fillRect(tx - 3, 34, 6, 6);
        g.fillStyle = '#ffe27a';
        g.fillRect(tx - 1, 32, 2, 5);
    }
    g.fillStyle = '#1a1430';
    g.fillRect(0, 76, w, 4);
    for (let y = 80; y < h; y += 12)
        for (let x = ((y - 80) / 12) % 2 ? -12 : 0; x < w; x += 24) {
            const k = (y - 80) / (h - 80);
            g.fillStyle = rng.pick(['#5b5470', '#544d68', '#615a77']);
            g.fillRect(x + 1, y + 1, 22, 10);
            g.fillStyle = `rgba(0,0,0,${0.35 - k * 0.3})`;
            g.fillRect(x + 1, y + 1, 22, 10);
        }
    // 奥の壁（上の帯）は別のキャンバスにして、カメラより遅く動かす（奥行き）
    const wall = document.createElement('canvas');
    wall.width = w + 80;
    wall.height = 80;
    const wg = wall.getContext('2d');
    wg.drawImage(c, 0, 0, w, 80, 0, 0, w, 80);
    wg.drawImage(c, 0, 0, 80, 80, w, 0, 80, 80); // 横にずれても端が切れないように継ぎ足す
    this.wall = wall;
    // ボス側（左）は暗く赤い
    const grd = g.createLinearGradient(0, 0, 150, 0);
    grd.addColorStop(0, 'rgba(120,20,40,0.45)');
    grd.addColorStop(1, 'rgba(120,20,40,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 150, h);
    return c;
}
export function applyLighting(ctx, scene, chain = false, extra = 0) {
    const { w: AW, h: AH } = this.script.arena;
    if (!this.lightmap) {
        this.lightmap = document.createElement('canvas');
        this.lightmap.width = AW;
        this.lightmap.height = AH;
    }
    const lm = this.lightmap.getContext('2d');
    const dark = Math.min(0.9, (scene === 'fog' ? 0.62 : scene === 'illusion' ? 0.5 : chain ? 0.55 : 0.38) + extra);
    lm.globalCompositeOperation = 'source-over';
    lm.clearRect(0, 0, AW, AH);
    lm.fillStyle = `rgba(6,4,18,${dark})`;
    lm.fillRect(0, 0, AW, AH);
    lm.globalCompositeOperation = 'destination-out';
    const glow = fxLook().glow; // 光の強さ（演出ギャラリーで選ぶ）
    for (const l of this.lights) {
        if (l.a <= 0 || l.r <= 0)
            continue;
        const la = Math.min(1, l.a * glow);
        const g = lm.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
        g.addColorStop(0, `rgba(0,0,0,${la})`);
        g.addColorStop(0.5, `rgba(0,0,0,${la * 0.55})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        lm.fillStyle = g;
        lm.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
    ctx.drawImage(this.lightmap, 0, 0);
    // 色つきの光をうっすら加算
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const l of this.lights) {
        if (!l.col || l.a <= 0 || l.r <= 0)
            continue;
        const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r * 0.7);
        const hex = l.col.replace('#', '');
        const r = parseInt(hex.slice(0, 2), 16), gg = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
        g.addColorStop(0, `rgba(${r},${gg},${b},${0.16 * Math.min(1.5, l.a * glow)})`);
        g.addColorStop(1, `rgba(${r},${gg},${b},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
    ctx.restore();
}
// 手前の柱と、ただよう塵（カメラより速く動かして、奥行きを出す）
export function foreground(ctx) {
    const { w: AW, h: AH } = this.script.arena;
    const px = -(this.cam.x - AW / 2) * 0.5;
    ctx.save();
    for (const [x0, wdt] of [[-14, 22], [AW - 6, 24]]) {
        const x = Math.round(x0 + px);
        ctx.fillStyle = '#0c0916';
        ctx.fillRect(x, -20, wdt, AH + 40);
        ctx.fillStyle = '#1a1430';
        ctx.fillRect(x + (x0 < 0 ? wdt - 3 : 0), -20, 3, AH + 40);
    }
    // 塵
    const rng = new Rng('dust:' + this.script.seed);
    ctx.fillStyle = '#ffe9c0';
    for (let i = 0; i < 24; i++) {
        const bx = rng.range(0, AW), by = rng.range(20, AH), sp = rng.range(0.1, 0.35);
        const x = ((bx + this.frame * sp + px * 0.4) % AW + AW) % AW, y = by + Math.sin(this.frame / 40 + i) * 4;
        ctx.globalAlpha = 0.15 + 0.15 * Math.sin(this.frame / 25 + i);
        ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    ctx.restore();
}
// エフェクトを、いったん等倍（1ドット）の別の画面に描いてから重ねる。光の強さ・くっきり度が既定のときは、そのまま描く。
//   光を弱めると、薄いにじみ（濃さが 6 割未満の所）がそのぶん薄くなる。くっきり度を上げると、半透明が段に分かれる
export function fxLayer(ctx, draw) {
    const { glow, crisp: c0 } = fxLook();
    const crisp = c0 === 'auto' ? (isUltScene(this.fxScene) ? ULT_CRISP : 0) : c0; // 場面ごと: 必殺技だけ半分くっきり
    if (glow === 1 && crisp === 0) {
        draw(ctx);
        return;
    }
    const { w: AW, h: AH } = this.script.arena;
    if (!this.fxCanvas) {
        this.fxCanvas = document.createElement('canvas');
        this.fxCanvas.width = AW;
        this.fxCanvas.height = AH;
    }
    const lc = this.fxCanvas.getContext('2d', { willReadFrequently: true });
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.clearRect(0, 0, AW, AH);
    // いまのカメラ（ズーム・揺れ）を、等倍の画面に写す
    const m = ctx.getTransform(), sc = ctx.canvas.width / AW;
    lc.setTransform(m.a / sc, m.b / sc, m.c / sc, m.d / sc, m.e / sc, m.f / sc);
    lc.imageSmoothingEnabled = false;
    beginDefer(lc, sc);
    let later = [];
    try {
        draw(lc);
    }
    finally {
        later = endDefer();
    }
    lc.setTransform(1, 0, 0, 1, 0, 0);
    const img = lc.getImageData(0, 0, AW, AH);
    if (glow !== 1) {
        const d = img.data;
        for (let i = 3; i < d.length; i += 4)
            if (d[i] && d[i] < 153)
                d[i] = Math.min(152, Math.round(d[i] * glow));
    }
    crispen(img, crisp);
    lc.putImageData(img, 0, 0);
    ctx.save();
    ctx.setTransform(sc, 0, 0, sc, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.fxCanvas, 0, 0);
    ctx.restore();
    for (const f of later)
        f(ctx); // 文字は、重ねたあとに元の細かさで
}
//# sourceMappingURL=arena-scene.js.map