// ホームに置く「自分の冒険者」: 最新の送り出しの見た目のまま、その場で待機している全身のドット絵（ゆっくり呼吸・まばたき・お供と飾りが揺れる）。
// 以前は討伐の早回しを置いていたが、速すぎて何が起きているか追えなかったため、自分のキャラだけを見せる（討伐は「討伐を見る」で）
import { drawHero, gearOf, lookOf, PORTRAIT_H, PORTRAIT_W } from './hero.js';
import { h } from './ui.js';
import { tl } from '../shared/i18n.js';
const SCALE = 4;
export function myHero(loadout, name, caption) {
    if (!loadout) {
        return h('div', { class: 'my-hero my-hero-empty' }, h('p', {}, tl('ここに、あなたの冒険者が立ちます。')), h('p', { class: 'muted small' }, tl('最初の冒険から帰ってくると、ここで待っています。')));
    }
    const W = PORTRAIT_W + 24, H = PORTRAIT_H + 6;
    const c = h('canvas', { class: 'my-hero-canvas pixel', width: W * SCALE, height: H * SCALE, role: 'img', 'aria-label': tl('{0}（あなたの冒険者）', name) });
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const look = lookOf(loadout), gear = gearOf(loadout);
    let frame = 0, seen = false;
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const draw = () => {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.scale(SCALE, SCALE);
        drawHero(ctx, look, gear, W / 2 + 2, H - 4, { frame, action: 'idle', t: (frame % 120) / 120 });
    };
    let last = 0;
    const loop = (now) => {
        if (c.isConnected)
            seen = true;
        else if (seen)
            return; // 画面から外れたら止める
        if (now - last > 1000 / 12) {
            last = now;
            frame++;
            draw();
        } // ドット絵らしく 12 コマ/秒
        requestAnimationFrame(loop);
    };
    draw();
    if (!reduce)
        requestAnimationFrame(loop);
    return h('div', { class: 'my-hero' }, c, h('div', { class: 'my-hero-plate' }, h('b', {}, name), caption ? h('span', { class: 'small muted' }, caption) : null));
}
//# sourceMappingURL=myhero.js.map