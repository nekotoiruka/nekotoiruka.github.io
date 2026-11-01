// 冒険の備え（心得・道具・巻物・冒険日誌・結界・お供）のドット絵アイコン。紹介ページと募集要項で共有する
import { outlined } from './sprites.js';
import { h } from './ui.js';
const ICONS = {
    kokoroe: {
        grid: ['wwwwwwwww', 'wkkkkkkww', 'wwwwwwwww', 'wkkkkkwww', 'wwwwwwwww', 'wkkkkkkww', 'wwwwwwwww', 'wkkkwwrrw', 'wwwwwwrrw'],
        colors: { w: '#fff1d6', k: '#8a7a9a', r: '#e43b44' }, outline: '#5a4a3a',
    },
    dougu: {
        grid: ['...bb...', '..b..b..', '.ffffff.', 'ffllffff', 'fflfffff', 'ffffyfff', 'ffffffff', '.ffffff.'],
        colors: { b: '#8b5a2b', f: '#c98b4a', l: '#e8b878', y: '#feae34' }, outline: '#4a2a12',
    },
    otomo: {
        grid: ['....hh....', '...hssh...', 'ww.sese.ww', 'wwwsssswww', '.wwddddww.', '..wddddw..', '...dddd...', '....ss....'],
        colors: { h: '#ffd166', s: '#ffe0c8', e: '#2b1d3e', w: '#bfe9ff', d: '#ff9ce6' }, outline: '#3a4a7a',
    },
    makimono: {
        grid: ['wwwwwwwwww', '.dffffffd.', '.flllllff.', '.ffffffff.', '.flllllff.', '.ffffffff.', '.dffffffd.', 'wwwwwwwwww'],
        colors: { w: '#c98b4a', f: '#fff1d6', l: '#c77dff', d: '#e8d8c0' }, outline: '#4a2a12',
    },
    nisshi: {
        grid: ['ffffffff.', 'fllllllfw', 'flyyyylfw', 'fllllllfw', 'flyyylffw', 'fllllllfw', 'ffffffffw', '.wwwwwwww', '...r.....', '...r.....'],
        colors: { f: '#3a7bd5', l: '#5fa8ff', y: '#d8f6ff', w: '#fff1d6', r: '#e43b44' }, outline: '#14305a',
    },
    kekkai: {
        grid: ['...ffff...', '.ffllllff.', 'fll....llf', 'fl..ww..lf', 'fl.wllw.lf', 'fl..ww..lf', 'fll....llf', '.ffllllff.', '...ffff...'],
        colors: { f: '#5fcde4', l: '#bff3ff', w: '#ffffff' }, outline: '#1d4e6b',
    },
};
/** 備えのアイコン（scale 倍に拡大したドット絵の canvas）。label があれば読み上げ用の名前、なければ飾り */
export function kitIcon(id, scale = 4, label = '', cls = '') {
    const ic = ICONS[id];
    const sp = outlined(`lp-icon:${id}`, ic.grid, ic.colors, ic.outline);
    const c = h('canvas', { class: `pixel ${cls}`.trim(), width: sp.width * scale, height: sp.height * scale, ...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true' }) });
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sp, 0, 0, sp.width * scale, sp.height * scale);
    return c;
}
//# sourceMappingURL=kiticons.js.map