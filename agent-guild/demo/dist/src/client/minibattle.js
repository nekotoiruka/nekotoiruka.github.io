// ホームや紹介ページに置く、ループ再生のミニバトル（実際の参加者データを使う）
import { ArenaRenderer } from './arena.js';
import { getBattle, scriptFor } from './api.js';
import { pickStage, restage } from '../shared/stage.js';
import { h } from './ui.js';
import { tl } from '../shared/i18n.js';
const WAVE_SECONDS = 1.6; // 本編より速く回す
export async function miniBattle() {
    const wrap = h('div', { class: 'mini-battle' });
    let script = null;
    try {
        script = scriptFor(await getBattle());
    }
    catch { /* サーバーなし */ }
    if (!script) {
        wrap.append(h('div', { class: 'mini-empty' }, h('p', {}, tl('ここに、みんなのキャラのバトルが映ります。')), h('p', { class: 'muted small' }, tl('最初の提出の採点が終わると始まります。'))));
        return wrap;
    }
    const staged = restage(script, pickStage(script, [], 'finals', 8));
    const canvas = h('canvas', { class: 'arena-canvas pixel', 'aria-label': tl('みんなのキャラのバトル（自動再生）') });
    const r = new ArenaRenderer(canvas, staged);
    wrap.append(canvas);
    let time = Math.min(2, staged.waves.length - 1), last = performance.now(), seen = false;
    const loop = (now) => {
        if (canvas.isConnected)
            seen = true;
        else if (seen)
            return; // 一度表示されたあとに画面から外れたら止める
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        time += dt / WAVE_SECONDS;
        if (time >= r.totalTime)
            time = 0;
        r.draw(time);
        requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return wrap;
}
//# sourceMappingURL=minibattle.js.map