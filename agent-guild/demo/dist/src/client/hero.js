import { backWeapons, petLook, skillLook, toolColor } from '../shared/build.js';
import { TOOL_BY_ID } from '../shared/catalog.js';
import { charCanvas, handColor, handPos, poseFor, W as CW, H as CH } from './chibi.js';
import { outlined, shade } from './sprites.js';
const INK = '#2b1d2e';
// --- 武器 ---
// 色の記号: f=主色 l=主色の明るい色 d=主色の暗い色 c=光の芯 / m=刃・金属 n=金属の影 h=刃のきらめき
//           x=木の柄 y=柄の巻き・木の影 g=金具（金） G=金具の影 w=白 k=黒鉄
// どれも縦向き（先が上・柄が下）。キャラの右手に持たせ、左向きのときは左右を反転して描く。
const WEAPONS = {
    // 弓: 弦（左）と、ふくらんだ弓幹（右）。握りは真ん中の革巻き
    bow: [
        '.g.......', '.wf......', '.w.lf....', '.w..lf...', '.w...lf..', '.w...lf..', '.w....lf.', '.w....lf.', '.w....gG.',
        '.w....yx.', '.w....gG.', '.w....lf.', '.w....lf.', '.w...lf..', '.w...lf..', '.w..lf...', '.w.lf....', '.wf......', '.g.......',
    ],
    // 槍: 木の葉形の穂先・金の口金・主色の房・長い柄
    spear: [
        '...h...', '..hmn..', '..hmn..', '.hhmnn.', '.hmmmn.', '.hmmmn.', '..hmn..', '...m...', '.GgggG.',
        '..lxf..', '.lfyfd.', '.lfxfd.', '.f.y.d.', '...x...', '...x...', '...y...', '...x...', '...x...', '...y...', '...x...', '...x...', '...G...',
    ],
    // 短剣: 幅広の刃・つば・柄頭
    dagger: ['..h..', '.hmn.', '.hmn.', '.hmn.', '.hmn.', '.hmn.', 'GdfdG', '..y..', '..x..', '..y..', '.gGg.'],
    // 魔法の杖: 金の爪がつかむ宝珠（光の芯つき）・ねじれた木の柄
    wand: [
        'g..lll..g', 'g.lcllf.g', '.glcfffg.', '.glfffdg.', '..gfddg..', '...gGg...', '....G....', '...lfd...', '....x....',
        '....y....', '....x....', '...gGg...', '....x....', '....y....', '....x....', '....y....', '....x....', '...gGg...',
    ],
    // 盾: 金属のふち・主色の地・金の十字
    shield: ['hhhmmmmnn', 'hllfgffdn', 'hlffgffdn', 'hgggGgggn', 'hlffgffdn', 'hfffgffdn', '.mffgfdn.', '..mfgdn..', '...mgn...', '....n....'],
    // 両刃の斧: 左右に三日月の刃・金の口金・長い柄
    axe: [
        '.....h.....', 'hn...G...nh', 'hmn..f..nmh', 'hmmnnGnnmmh', 'hmmnnfnnmmh', 'hmn..G..nmh', 'hn...G...nh', '.....x.....',
        '.....y.....', '.....x.....', '.....x.....', '.....y.....', '.....x.....', '.....x.....', '.....G.....',
    ],
    // ハンマー: 金属の打面・主色の頭・金のびょう
    hammer: [
        'hmllllfmn', 'hmlfffdmn', 'hmfgfgdmn', 'hmffffdmn', 'hmdddddmn', '...GgG...', '....x....', '....y....', '....x....',
        '....x....', '....y....', '....x....', '....x....', '...gGg...',
    ],
    // 魔導書: 金の角・背表紙・光る紋章・ページの小口
    book: ['gfffffffg', 'dllllllfw', 'dlfgggflw', 'dlgfcfgfw', 'dlgcccgfw', 'dlgfcfgfw', 'dlfgggffw', 'dffffffdw', 'gdddddddg'],
    // 剣: 主色の樋（ひ）が入った刃・反ったつば・宝石・柄頭
    sword: [
        '...h...', '..hmn..', '..hmn..', '..hln..', '..hln..', '..hln..', '..hln..', '..hln..', '..hmn..', '..hmn..',
        'g.hmn.g', 'gGgfgGg', '...y...', '...x...', '...y...', '..gGg..',
    ],
    // 刀: ゆるく反った刃・金のはばき・丸いつば・菱模様の柄巻き
    katana: [
        '....h', '...hn', '...hn', '..hn.', '..hn.', '..hn.', '..hn.', '.hn..', '.hn..', '.hn..', '.hn..', '.Gg..', 'GgggG',
        '.fk..', '.kf..', '.fk..', '.kf..', '.gg..',
    ],
    // 大鎌: 前へ大きく弧を描く刃（背は暗く、刃先はきらめく）・金の口金・主色の柄
    scythe: [
        '...nnnn......', '..Gmmmmnnn...', '.lGmmmmmmmnn.', '.dGhhhmmmmmmn', '..d...hhhmmmn', '..d......hmmn', '..f.......hmn', '..d........hn',
        '..d.........h', '..f..........', '..d..........', '..d..........', '..G..........', '..d..........', '..d..........', '..f..........',
        '..d..........', '..d..........', '.gGg.........',
    ],
    // 扇: 二色の折り目・金の縁・要（かなめ）と房
    fan: ['..ggggggg..', '.glflflflg.', 'gflflflflfg', 'dflflflflfd', '.dlflflfld.', '..dflflfd..', '...dlfld...', '....dGd....', '.....G.....', '....lfl....', '....f.d....'],
    // 光線銃: 前を向いたレトロな銃。ガラスの窓・冷却リング・光る銃口
    blaster: ['...lll......', '..lfffl.n.n.', 'Gdfcfffmmmmc', 'Gdffffdnnnnl', '..dfffd.n.n.', '...gx.......', '...xy.......', '...yx.......'],
    // フライパン: 目玉焼きつき
    pan: ['..dddd..', '.dfffld.', 'dfwwwfld', 'dwwggwfd', 'dwwggwfd', 'dfwwwffd', '.dfffld.', '..dddd..', '...nn...', '...xy...', '...xy...', '...yx...', '...xx...'],
    // 傘: 開いた傘・金の石突き・曲がった持ち手
    umbrella: [
        '.....g.....', '...llffdd..', '..lllffddd.', '.llllfffddd', 'lllllffffdd', 'f.l.f.f.d.d', '.....x.....', '.....x.....', '.....x.....',
        '.....x.....', '.....x.....', '.....x.....', '.....x..y..', '......yy...',
    ],
    // ギター: 糸巻き・フレットの入った棹・サウンドホール・金のブリッジ
    guitar: [
        '..gGg..', '..fff..', '..gfg..', '...k...', '...w...', '...y...', '...w...', '...y...', '..lfd..', '.lfffd.', '.lfkfd.',
        '..lfd..', '.lfffd.', 'lffffdd', 'lfgggdd', 'lfffffd', '.dfffd.', '..ddd..',
    ],
};
// 手で握る位置（格子の列・行）。長物は柄の途中を握り、柄じりが手の下へ少し伸びる
const GRIP = {
    bow: [3, 9], spear: [3, 17], dagger: [2, 8], wand: [4, 14], shield: [4, 4], axe: [5, 12], hammer: [4, 11], book: [4, 4],
    sword: [3, 13], katana: [1, 15], scythe: [2, 15], fan: [5, 8], blaster: [4, 6], pan: [3, 11], umbrella: [5, 10], guitar: [3, 12],
};
// 振らずに構えるもの（盾・本・銃・弓・ギター）
const HELD = ['shield', 'book', 'blaster', 'bow', 'guitar'];
// 飛び道具・魔法が出る所（格子の列・行）。弓は矢をつがえる握りの前、光線銃は銃口、杖は宝珠、魔導書は開いたページの前、扇は先。
// 近接の武器は刃先（使うのは主に飛び道具）
const MUZZLE = {
    bow: [7.5, 9], blaster: [11.5, 2.5], wand: [4, 2], book: [8.5, 4], fan: [5, 1],
    spear: [3, 0], dagger: [2, 0], shield: [4, 4], axe: [5, 0], hammer: [4, 2], sword: [3, 0], katana: [4, 0], scythe: [12, 4], pan: [3, 3], umbrella: [5, 0], guitar: [3, 0],
};
// 先が光るもの（格子の列・行と、光の半径）
const GLOW = { wand: [4, 2, 3.2], book: [4, 4, 2.5], blaster: [11, 2.5, 2] };
const WEAPON_BASE = {
    bow: '#c98b4a', spear: '#5fcde4', dagger: '#f2c14e', wand: '#c77dff', shield: '#3a7bd5', axe: '#e86a3a', hammer: '#8a6f5a', book: '#e43b44',
    sword: '#5fa8ff', katana: '#e43b44', scythe: '#7e57c2', fan: '#ff7aa8', blaster: '#63d471', pan: '#3d3d4a', umbrella: '#ffb84d', guitar: '#d35400',
};
// --- 仲間（f=体 l=明るい d=暗い w=羽・腹 e=目 y=くちばし・角 p=ほっぺ k=画面 r=ランプ s=肌 g=ガラス）。各2フレーム ---
const FAMILIARS = {
    bird: [
        ['...ffff...', '..flllff..', '.flffffff.', '.ffeffeff.', 'wfpfyyfpfw', 'wwffwwffww', '.wfwwwwfw.', '..ffffff..', '...y..y...'],
        ['w..ffff..w', 'wwflllffww', '.flffffff.', '.ffeffeff.', '.fpfyyfpf.', '.fffwwfff.', '..fwwwwf..', '..ffffff..', '...y..y...'],
    ],
    slime: [
        ['....ff....', '...flff...', '..flllff..', '.flffffff.', '.ffeffeff.', 'ffpffffpff', 'ffffffffff', '.dddddddd.'],
        ['..........', '..........', '...ffff...', '..flllff..', '.flffffff.', 'ffeffffeff', 'fpffffffpf', 'dddddddddd'],
    ],
    spirit: [
        ['.....f....', '....ff....', '...flff...', '..fllfff..', '.ffllffff.', '.ffeffeff.', '.fpffffpf.', '..ffffff..', '...ffff...', '....ff.f..'],
        ['....f.....', '....ff....', '...fflf...', '..fffllf..', '.ffffllff.', '.ffeffeff.', '.fpffffpf.', '..ffffff..', '...ffff...', '...f.ff...'],
    ],
    dragon: [
        ['..y....y..', '..ffffff..', '.flffffff.', 'wfeffffefw', 'wwffffffww', '.ffwwwwff.', '..ffffff.f', '...f..f.ff'],
        ['wy......yw', 'wwffffffww', '.flffffff.', '.feffffef.', '..ffffff..', '.ffwwwwff.', '..ffffff.f', '...f..f.ff'],
    ],
    ghost: [
        ['...ffff...', '..flllff..', '.flffffff.', '.ffeffeff.', '.fpffffpf.', 'ffffffffff', 'ffffffffff', 'f.fff.fff.'],
        ['...ffff...', '..flllff..', '.flffffff.', '.ffeffeff.', '.fpffffpf.', 'ffffffffff', 'ffffffffff', '.fff.fff.f'],
    ],
    drone: [
        ['wwww..wwww', '....ff....', '..ffffff..', '.fkkkkkkf.', '.fkykkykf.', '.ffffffff.', '..ffffff..', '....rr....'],
        ['.ww....ww.', '....ff....', '..ffffff..', '.fkkkkkkf.', '.fkykkykf.', '.ffffffff.', '..ffffff..', '..........'],
    ],
    bat: [
        ['f...f..f...f', 'ff..ffff..ff', 'fffflfffffff', 'ffffeffeffff', '.ffpfwffpff.', '..f.ffff.f..', '.....ff.....'],
        ['....f..f....', '....ffff....', '..ffflffff..', '.fffeffefff.', 'ff.pfwffp.ff', 'f...ffff...f', '.....ff.....'],
    ],
    fairy: [
        ['...ffff...', 'w.flllff.w', 'wwfssssfww', 'wwfessefww', '.w.pssp.w.', '...lffl...', '..lffffl..', '...s..s...'],
        ['...ffff...', '..flllff..', '.wfssssfw.', 'wwfessefww', 'ww.pssp.ww', 'w..lffl..w', '..lffffl..', '...s..s...'],
    ],
    mushroom: [
        ['...ffff...', '.ffwwffwf.', 'fffwwfffff', 'ffffffwwff', '.dddddddd.', '..sesses..', '..pssssp..', '..ssssss..', '...s..s...'],
        ['..........', '...ffff...', '.ffwwffwf.', 'fffwwfffff', 'ffffffwwff', '.dddddddd.', '.sesssses.', '.psssssp..', '..ss..ss..'],
    ],
    penguin: [
        ['...ffff...', '..ffffff..', '.ffwwwwff.', '.fwewwewf.', '.fwpyypwf.', 'ffwwwwwwff', '.ffwwwwff.', '..ffffff..', '..yy..yy..'],
        ['...ffff...', '..ffffff..', '.ffwwwwff.', '.fwewwewf.', 'ffwpyypwff', '.fwwwwwwf.', '.ffwwwwff.', '..ffffff..', '..yy..yy..'],
    ],
    octopus: [
        ['...ffff...', '..flllff..', '.flffffff.', '.ffeffeff.', '.fpffffpf.', '..ffffff..', '.f.f..f.f.', 'f..f..f..f'],
        ['...ffff...', '..flllff..', '.flffffff.', '.ffeffeff.', '.fpffffpf.', '..ffffff..', '..f.ff.f..', '.f..ff..f.'],
    ],
    ufo: [
        ['....gggg....', '...gwgggg...', '...geggeg...', '.ffffffffff.', 'fyffyffyffyf', '.dddddddddd.', '...r....r...'],
        ['....gggg....', '...gwgggg...', '...geggeg...', '.ffffffffff.', 'flffyffyffly', '.dddddddddd.', '....r..r....'],
    ],
    kitten: [
        ['.f......f.', '.ff....ff.', '.fpffffpf.', 'ffffffffff', 'fffeffefff', 'ffpfwwfpff', '.ffffffff.', '..ffffff..', '..f.ff.f..'],
        ['.f......f.', '.ff....ff.', '.fpffffpf.', 'ffffffffff', 'fffeffefff', 'ffpfwwfpff', '.ffffffff.', '..ffffff..', '..ff..ff..'],
    ],
    jelly: [
        ['...ffff...', '..flllff..', '.flffffff.', '.ffeffeff.', 'ffpffffpff', 'dfdfdfdfdf', '.l.l..l.l.', 'l..l..l..l'],
        ['...ffff...', '..flllff..', '.flffffff.', '.ffeffeff.', 'ffpffffpff', 'fdfdfdfdfd', '..l.ll.l..', '.l..ll..l.'],
    ],
};
// --- 頭上の飾り（スキル） ---
const CHARMS = {
    gem: ['.fff.', 'flfff', 'fffff', '.fff.', '..f..'],
    book: ['ffff', 'fwwf', 'fwwf', 'ffff'],
    rune: ['.fff.', 'ffwff', 'fwwwf', 'ffwff', '.fff.'],
    star: ['..f..', '.flf.', 'fffff', '.fff.', '.f.f.'],
    flame: ['..f..', '.ff..', '.flf.', 'fllff', '.fff.'],
    crystal: ['.f.', 'flf', 'flf', 'fff', '.f.'],
    heart: ['ff.ff', 'flfff', 'fffff', '.fff.', '..f..'],
    moon: ['..ff.', '.ff..', '.fl..', '.ff..', '..ff.'],
    clover: ['ff.ff', 'flfff', '.fwf.', 'fffff', 'ff.ff'],
    note: ['..fff', '..f.f', '..f..', 'fff..', 'flf..'],
    bolt: ['..ff', '.ff.', 'ffff', '.ff.', 'ff..'],
    orb: ['.fff.', 'flfff', 'fffff', 'fffff', '.www.'],
    scroll: ['wwww', '.ff.', '.fl.', '.ff.', 'wwww'],
    gear: ['.f.f.', 'fffff', 'ff.ff', 'fffff', '.f.f.'],
};
export function weaponSprite(kind, color, flip = false) {
    const base = color || WEAPON_BASE[kind];
    const colors = {
        f: base, l: shade(base, 0.45), d: shade(base, -0.3), c: shade(base, 0.85),
        m: '#d5dbe6', n: '#8790a6', h: '#ffffff',
        x: '#a0673a', y: '#6b4226', g: '#f7d26a', G: '#c08a2a', w: '#ffffff', k: '#2b2d42',
    };
    if (kind === 'pan') {
        colors.f = shade(base, 0.08);
        colors.l = shade(base, 0.4);
        colors.d = shade(base, -0.35);
        colors.n = '#2b2d42';
        colors.g = '#ffb21e';
    }
    if (kind === 'guitar') {
        colors.k = '#3a2210';
    }
    return outlined(`w2:${kind}:${base}`, WEAPONS[kind], colors, shade(base, -0.62), flip);
}
// 手に持った武器を描く（ctx の原点＝手。回転済み）。握る位置が原点に来るように置き、光るものは光も添える
function drawWeaponAt(ctx, kind, color, flip, frame, glowBoost = 0) {
    const ws = weaponSprite(kind, color, flip);
    const [gx0, gy] = GRIP[kind];
    const gx = flip ? ws.width - 1 - (gx0 + 1) : gx0 + 1; // ふちの1ドット分ずらす
    const x0 = -gx, y0 = -(gy + 1);
    ctx.drawImage(ws, x0, y0);
    const gl = GLOW[kind];
    if (gl) {
        const [cx0, cy, r] = gl;
        const cx = flip ? ws.width - 1 - (cx0 + 1) + 0.5 : cx0 + 1 + 0.5;
        const pulse = 0.5 + 0.5 * Math.sin(frame / 9);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.min(0.5, 0.16 + pulse * 0.12 + glowBoost * 0.25);
        ctx.fillStyle = shade(color || WEAPON_BASE[kind], 0.3);
        ctx.beginPath();
        ctx.arc(x0 + cx, y0 + cy + 1.5, r + pulse * 0.8 + glowBoost * 2, 0, Math.PI * 2);
        ctx.fill();
        // きらめき（ときどき十字に光る）
        if (kind === 'wand' && frame % 48 < 10) {
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = '#ffffff';
            const sx = Math.round(x0 + cx + (flip ? -3 : 3)), sy = Math.round(y0 + cy - 1);
            ctx.fillRect(sx, sy - 1, 1, 3);
            ctx.fillRect(sx - 1, sy, 3, 1);
        }
        ctx.restore();
    }
}
export function familiarSprite(kind, color, frame, flip = false) {
    const g = FAMILIARS[kind][frame % 2];
    const colors = {
        f: color, l: shade(color, 0.5), d: shade(color, -0.2), w: shade(color, 0.6), e: INK, y: '#f2c14e', p: '#ff8fb1', k: '#2b2d42', r: '#ff5a5a', s: '#fff1d6', g: '#bfe9ff',
    };
    if (kind === 'drone') {
        colors.y = shade(color, 0.6);
        colors.w = '#c9ced8';
    }
    if (kind === 'ghost') {
        colors.f = shade(color, 0.55);
        colors.l = '#ffffff';
    }
    if (kind === 'penguin' || kind === 'mushroom')
        colors.w = '#ffffff';
    if (kind === 'fairy')
        colors.w = '#e8fbff';
    if (kind === 'jelly') {
        colors.f = shade(color, 0.3);
        colors.l = shade(color, 0.6);
        colors.d = color;
    }
    if (kind === 'ufo')
        colors.y = '#fff3a0';
    return outlined(`fam2:${kind}:${color}:${frame % 2}`, g, colors, shade(color, -0.55), flip);
}
export function charmSprite(kind, color, glow = false) {
    return outlined(`ch:${kind}:${color}:${glow}`, CHARMS[kind], { f: glow ? shade(color, 0.3) : color, l: '#ffffff', w: shade(color, 0.7) }, shade(color, -0.55));
}
export function gearOf(l) {
    const handTool = [...l.tools].sort((a, b) => (TOOL_BY_ID[b]?.cost ?? 0) - (TOOL_BY_ID[a]?.cost ?? 0))[0];
    const back = backWeapons(l).map((kind) => {
        const id = l.tools.find((t) => (l.gear?.[t]?.weapon ?? TOOL_BY_ID[t]?.weapon) === kind);
        return { kind, color: id ? toolColor(l, id) : undefined };
    });
    return {
        weaponColor: handTool ? toolColor(l, handTool) : undefined,
        back,
        fams: (() => { const p = petLook(l); return p ? [p] : []; })(),
        charms: l.skills.map((_, i) => skillLook(l, i)),
    };
}
// 仲間の定位置（足元中心からの相対）
export function familiarHome(i, flip, frame) {
    const side = flip ? 1 : -1;
    return { x: side * (14 + i * 6) - 5 + Math.sin((frame + i * 13) / 9) * 1.5, y: -24 + i * 5 + Math.cos((frame + i * 7) / 7) * 2 };
}
// 手の武器の傾き（ラジアン。右向きのとき）
function swingOf(act, t) {
    if (act === 'attack')
        return t < 0.4 ? -0.6 * (t / 0.4) : t < 0.65 ? 1.5 : 1.5 * (1 - (t - 0.65) / 0.35);
    if (act === 'cast')
        return -0.5;
    if (act === 'guard')
        return -0.2;
    if (act === 'victory')
        return -0.4; // 武器を高く掲げる（大きく倒すと顔にかかる）
    if (act === 'dash')
        return 0.9;
    if (act === 'ko')
        return 1.4;
    return 0;
}
/** drawHero と同じポーズのときの、武器の先（飛び道具・魔法が出る所）の位置。描く処理と同じ計算をたどる */
export function muzzleOf(look, cx, fy, d) {
    const flip = !!d.flip, dir = flip ? -1 : 1, kind = look.weapon;
    const act = d.action ?? 'idle';
    const pose = { ...poseFor(act, d.t ?? 0, d.frame), side: flip };
    const ox = cx - CW / 2, oy = fy - CH + 1;
    const hp = handPos(pose);
    const held = HELD.includes(kind);
    const hx = (flip ? ox + CW - 1 - hp.x : ox + hp.x) + (held ? dir : 0), hy = oy + hp.y;
    const ws = weaponSprite(kind, undefined, flip);
    const [gx0, gy] = GRIP[kind], [mc, mr] = MUZZLE[kind];
    const x0 = -(flip ? ws.width - 1 - (gx0 + 1) : gx0 + 1), y0 = -(gy + 1);
    const px = x0 + (flip ? ws.width - 1 - (mc + 1) : mc + 1) + 0.5, py = y0 + mr + 1 + 0.5;
    const a = dir * swingOf(act, d.t ?? 0) * (held ? 0.3 : 1);
    let x = hx + px * Math.cos(a) - py * Math.sin(a), y = hy + px * Math.sin(a) + py * Math.cos(a);
    if (d.rot) {
        const r = d.rot * (flip ? -1 : 1), dx = x - cx, dy = y - fy;
        x = cx + dx * Math.cos(r) - dy * Math.sin(r);
        y = fy + dx * Math.sin(r) + dy * Math.cos(r);
    }
    return { x, y };
}
// 足元中心 (cx, fy) に描く。頭のてっぺんはおよそ fy-22、帽子込みで fy-26
export function drawHero(ctx, look, gear, cx, fy, d) {
    const flip = !!d.flip;
    // 討伐中（左向き＝flip）は、顔をボスのほうへ向ける
    const pose = { ...poseFor(d.action ?? 'idle', d.t ?? 0, d.frame), side: !!d.flip, ...(d.eyes ? { eyes: d.eyes } : {}) };
    const ox = cx - CW / 2, oy = fy - CH + 1; // 丸めない（バックバッファは拡大済みなので、動きがなめらかになる）
    ctx.save();
    if (d.alpha !== undefined)
        ctx.globalAlpha = d.alpha;
    // 足元
    if (d.ring !== false) {
        if (d.teamColor) {
            ctx.fillStyle = d.teamColor;
            ctx.globalAlpha = (d.alpha ?? 1) * 0.6;
            ctx.beginPath();
            ctx.ellipse(cx, fy, 9, 3, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = d.alpha ?? 1;
        }
        else {
            ctx.fillStyle = 'rgba(0,0,0,0.22)';
            ctx.beginPath();
            ctx.ellipse(cx, fy, 7 + (pose.bob < 0 ? pose.bob * 0.6 : 0), 2.4, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    if (d.rot) {
        ctx.translate(cx, fy);
        ctx.rotate(d.rot * (flip ? -1 : 1));
        ctx.translate(-cx, -fy);
    }
    const dir = flip ? -1 : 1;
    // 背中の装備
    gear.back.slice(0, 2).forEach((b, i) => {
        const ws = weaponSprite(b.kind, b.color, !flip);
        ctx.save();
        ctx.translate(cx - dir * (3 + i * 2), fy - 13 + pose.bob);
        ctx.rotate(-dir * (0.65 + i * 0.45));
        ctx.drawImage(ws, -Math.floor(ws.width / 2), -Math.floor(ws.height / 2) - 2);
        ctx.restore();
    });
    // 本体
    ctx.drawImage(charCanvas(look, pose, flip, d.flash), ox, oy);
    // 手の武器
    const hp = handPos(pose);
    const hx = flip ? ox + CW - 1 - hp.x : ox + hp.x, hy = oy + hp.y;
    const act = d.action ?? 'idle';
    const swing = swingOf(act, d.t ?? 0);
    ctx.save();
    ctx.translate(hx, hy);
    const held = HELD.includes(look.weapon);
    if (held)
        ctx.translate(dir, 0); // 構えるものは少し前に出す
    ctx.rotate(dir * swing * (held ? 0.3 : 1));
    drawWeaponAt(ctx, look.weapon, gear.weaponColor, flip, d.frame, act === 'cast' ? 1 : (d.skillGlow ?? 0));
    if (!held && look.weapon !== 'bow') {
        // 柄を握る手（武器の上に重ねて、握っているように見せる）
        const hc = handColor(look);
        ctx.fillStyle = d.flash ? '#ffffff' : hc;
        ctx.fillRect(-0.5, -0.5, 2, 2);
        ctx.fillStyle = shade(hc, -0.5);
        ctx.fillRect(-0.5, 1.5, 2, 0.6);
    }
    ctx.restore();
    ctx.restore();
    // 頭上の飾り（スキル）。発動中は大きく光って広がる
    ctx.save();
    if (d.alpha !== undefined)
        ctx.globalAlpha = d.alpha;
    const glow = d.skillGlow ?? 0;
    const n = gear.charms.length;
    gear.charms.forEach((c, i) => {
        const a = d.frame / 20 + (i * Math.PI * 2) / Math.max(1, n);
        const r = 9 + glow * 5;
        const gx = cx + Math.cos(a) * r, gy = fy - 30 + pose.bob + Math.sin(a) * (2.5 + glow * 2) - glow * 4;
        const sp = charmSprite(c.kind, c.color, glow > 0.3);
        if (glow > 0) {
            ctx.save();
            ctx.globalAlpha = (d.alpha ?? 1) * glow * 0.5;
            ctx.fillStyle = c.color;
            ctx.beginPath();
            ctx.arc(gx, gy, 4 + glow * 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        ctx.drawImage(sp, Math.round(gx - sp.width / 2), Math.round(gy - sp.height / 2));
    });
    // 仲間
    gear.fams.forEach((f, i) => {
        const p = d.famPos?.[i] ?? familiarHome(i, flip, d.frame);
        const sp = familiarSprite(f.kind, f.color, Math.floor((d.frame + i * 5) / 9), flip);
        ctx.drawImage(sp, Math.round(cx + p.x - sp.width / 2 + 5), Math.round(fy + p.y));
    });
    ctx.restore();
}
// お供だけを、主の立ち位置（足元の中心 cx, fy）の横に描く（主が跳んでも、お供はその場で待つ）
export function drawFamiliarAt(ctx, f, cx, fy, frame, flip = true) {
    const p = familiarHome(0, flip, frame);
    const sp = familiarSprite(f.kind, f.color, Math.floor(frame / 9), flip);
    ctx.drawImage(sp, Math.round(cx + p.x - sp.width / 2 + 5), Math.round(fy + p.y));
}
// 一覧やプレビュー用の全身画（武器・装備・仲間・飾り込み）。44x40 ドット × scale
export const PORTRAIT_W = 52, PORTRAIT_H = 40;
export function portrait(look, gear, opts = {}) {
    const scale = opts.scale ?? 3;
    const c = document.createElement('canvas');
    c.width = PORTRAIT_W * scale;
    c.height = PORTRAIT_H * scale;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.scale(scale, scale);
    drawHero(ctx, look, gear, PORTRAIT_W / 2 + 4, PORTRAIT_H - 3, { frame: opts.frame ?? 0, action: opts.action, t: opts.t });
    return c;
}
// 連携詠唱のカットイン用: 両手を掲げて詠唱する、武器・装備・仲間込みの大きな全身画（40x34 ドット × scale）
export const FIGURE_W = 40, FIGURE_H = 34;
export function figure(look, gear, scale = 5) {
    const c = document.createElement('canvas');
    c.width = FIGURE_W * scale;
    c.height = FIGURE_H * scale;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.scale(scale, scale);
    drawHero(ctx, look, gear, FIGURE_W / 2 + 3, FIGURE_H - 3, { frame: 0, flip: true, ring: false, action: 'cast', t: 0.5, skillGlow: 0.6 });
    return c;
}
// 名簿などの小さい表示用: 本体だけを切り抜いた胸像（28x30 ドット × scale）
export function bust(look, gear, scale = 2) {
    const c = document.createElement('canvas');
    c.width = 28 * scale;
    c.height = 30 * scale;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.scale(scale, scale);
    drawHero(ctx, look, { ...gear, fams: [], back: [], charms: [] }, 14, 29, { frame: 0, ring: false, skillGlow: 0, ...{} });
    return c;
}
export function lookOf(l) {
    return { body: l.body, palette: l.palette, hair: l.hair, weapon: l.weapon, ...(l.pattern ? { pattern: l.pattern } : {}) };
}
//# sourceMappingURL=hero.js.map