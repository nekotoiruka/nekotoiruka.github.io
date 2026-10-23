// 紹介ページ（#/about）。初めての人に「どんなゲームで、何が楽しくて、どういう仕組みか」を伝える。
// 絵はすべて本物の描画コード（ボス・ちびキャラ・討伐の再生）で、その場で動かす。
// 同じ中身を 1ファイルの HTML にも書き出す（scripts/build-lp.mjs → lp.ts）。
import { ArenaRenderer } from '../arena.js';
import { getDemoBattle, scriptFor } from '../api.js';
import { bossCanvas, BOSS_IDLE, BW, BH } from '../boss.js';
import { BRAND } from '../brand.js';
import { burst, BODY_STYLE, fxColors } from '../fx.js';
import { elderBeard, GM_GEAR, GM_LOOK } from '../guildmaster.js';
import { drawFamiliarAt, drawHero, PORTRAIT_H, PORTRAIT_W } from '../hero.js';
import { setSfx } from '../sfx.js';
import { outlined } from '../sprites.js';
import { avatarCanvas, fmtMs, h } from '../ui.js';
import { poseFor } from '../chibi.js';
import { BODY_LABELS, CAT_PATTERN_LABELS } from '../../shared/build.js';
import { localeOf, tl } from '../../shared/i18n.js';
// ---------------------------------------------------------------------------
// アニメの進行役: 画面に見えている canvas だけを描き直す。ページを離れたら止まる。
// 動きを減らす設定の人には、最初の1コマだけを見せる（自分で押した再生は動かす）
// ---------------------------------------------------------------------------
const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
function makeTicker(root) {
    const anims = [];
    const pres = [];
    const io = typeof IntersectionObserver === 'function'
        ? new IntersectionObserver((es) => es.forEach((e) => { const a = anims.find((x) => x.el === e.target); if (a)
            a.vis = e.isIntersecting; }), { rootMargin: '120px' })
        : null;
    let last = performance.now(), seen = false;
    const loop = (now) => {
        if (root.isConnected)
            seen = true;
        else if (seen) {
            io?.disconnect();
            return;
        }
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        for (const f of pres) {
            try {
                f();
            }
            catch (e) {
                console.error(e);
            }
        }
        for (const a of anims) {
            if (!a.vis)
                continue;
            if (reduced && !a.live?.())
                continue;
            if (a.live && !a.live())
                continue;
            try {
                a.draw(now / 1000, dt);
            }
            catch (e) {
                console.error(e);
            }
        }
        requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return {
        add(el, draw, live) {
            const a = { el, draw, vis: !io, live };
            anims.push(a);
            io?.observe(el);
            draw(1.3, 0); // 最初の1コマ（止まっていても絵が出るように）
        },
        /** 毎フレーム、描く前に呼ぶ（どの窓を動かすかを決める等） */
        pre(f) { pres.push(f); },
    };
}
function pixelCanvas(w, hgt, cls = '', label = '') {
    const c = h('canvas', { class: `pixel ${cls}`.trim(), width: w, height: hgt, ...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true' }) });
    return c;
}
function ctx2d(c) {
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return ctx;
}
const wave = (t, sp = 1, ph = 0) => Math.sin(t * sp + ph);
const BOSSES = [
    { kind: 'dragon', season: tl('シーズン1'), name: tl('竜の巣の主（老竜）'), line: tl('炎の息と尻尾のなぎはらい。霧に隠れ、呪文を唱え、偉い人の声をまねて惑わせる。'), sky: ['#2a1640', '#4a1f4f', '#7a2f4a', '#1b1030'], ground: ['#4a3a52', '#3c2f45'] },
    { kind: 'spider', season: tl('シーズン2'), name: tl('大蜘蛛アラクネア'), line: tl('闇の森の洞窟の主。糸と毒牙、そして人の声をまねる。'), sky: ['#0e1f1c', '#163229', '#24483a', '#0a1512'], ground: ['#2f3a2a', '#263022'] },
    { kind: 'goblin', season: tl('シーズン3'), name: tl('頭目ガルグとゴブリンの大群'), line: tl('砦跡に住みついた大群。群れの中から頭目を見つけられるか。'), sky: ['#3a1e1a', '#7a3b22', '#c8682a', '#2a1410'], ground: ['#5a4632', '#4a3a2a'] },
    { kind: 'kraken', season: tl('シーズン4'), name: tl('大王クラーケン'), line: tl('揺れる甲板、墨の海、霧の向こうの歌声。旗艦の信号を読み違えるな。'), sky: ['#0d2236', '#123a52', '#1d5a72', '#08182a'], ground: ['#6a4a2e', '#5a3d25'] },
    { kind: 'golem', season: tl('シーズン5'), name: tl('守護巨人ゴルドム'), line: tl('砂の遺跡の番人。拳と光線と地割れ。命令を装う古代の声が割り込む。'), sky: ['#3a2a1a', '#7a5a32', '#c89a52', '#2a1d10'], ground: ['#8a6e48', '#76603e'] },
    { kind: 'vampire', season: tl('シーズン6'), name: tl('ヴェスペリオ伯爵'), line: tl('霧ノ谷の古城の主。蝙蝠の群れ、見えない呪いの紋、魅了の声。'), sky: ['#1a0a1e', '#3a0f2a', '#5a1530', '#10060f'], ground: ['#3a2a3a', '#2e2030'] },
    { kind: 'giant', season: tl('シーズン7'), name: tl('氷巨人グラシエル'), line: tl('雪原に立つ巨人。凍てつく息、氷柱の槍、吹雪にまぎれる死者の声。'), sky: ['#13233f', '#24406a', '#4a74a0', '#0c1830'], ground: ['#c8d8ea', '#a8bcd4'] },
];
function bossPose(t, ph, angry = 0) {
    const roar = angry > 0 ? angry : Math.max(0, wave(t, 0.7, ph) - 0.85) * 6.6; // ときどき吠える
    return {
        ...BOSS_IDLE,
        bob: Math.round(wave(t, 2.2, ph) * 1.5),
        wing: Math.round(wave(t, 2.8, ph) * 2),
        tail: Math.round(wave(t, 1.6, ph + 1) * 3),
        lean: roar > 0.2 ? 2 : 0,
        mouth: roar > 0.2 ? 2 : 0,
        eye: roar > 0.2 ? 'angry' : 'open',
    };
}
// ---------------------------------------------------------------------------
// 持ち物（心得・道具・巻物・冒険日誌・結界）のドット絵アイコン
// ---------------------------------------------------------------------------
const ICONS = {
    kokoroe: {
        grid: ['wwwwwwwww', 'wkkkkkkww', 'wwwwwwwww', 'wkkkkkwww', 'wwwwwwwww', 'wkkkkkkww', 'wwwwwwwww', 'wkkkwwrrw', 'wwwwwwrrw'],
        colors: { w: '#fff1d6', k: '#8a7a9a', r: '#e43b44' }, outline: '#5a4a3a',
    },
    dougu: {
        grid: ['...bb...', '..b..b..', '.ffffff.', 'ffllffff', 'fflfffff', 'ffffyfff', 'ffffffff', '.ffffff.'],
        colors: { b: '#8b5a2b', f: '#c98b4a', l: '#e8b878', y: '#feae34' }, outline: '#4a2a12',
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
function iconCanvas(id, scale = 4, label = '') {
    const ic = ICONS[id];
    const sp = outlined(`lp-icon:${id}`, ic.grid, ic.colors, ic.outline);
    const c = pixelCanvas(sp.width * scale, sp.height * scale, 'lp-icon', label);
    const ctx = ctx2d(c);
    ctx.drawImage(sp, 0, 0, sp.width * scale, sp.height * scale);
    return c;
}
// ---------------------------------------------------------------------------
// キャラ
// ---------------------------------------------------------------------------
const NO_GEAR = { back: [], fams: [], charms: [] };
const look = (body, palette, hair, weapon, pattern) => ({ body, palette, hair, weapon, ...(pattern ? { pattern } : {}) });
// ヒーロー画面の討伐隊（4人）
const PARTY = [
    { look: look('cat', '#e43b44', '#ffd166', 'sword', 'calico'), gear: { back: [], fams: [], charms: [{ kind: 'star', color: '#ffd23f' }] } },
    { look: look('knight', '#3a7bd5', '#f2c14e', 'shield'), gear: { back: [{ kind: 'spear' }], fams: [], charms: [] } },
    { look: look('bunny', '#5fcde4', '#fbf7f0', 'wand'), gear: { back: [], fams: [{ kind: 'fairy', color: '#ffd166' }], charms: [{ kind: 'scroll', color: '#c77dff' }] } },
    { look: look('witch', '#7e57c2', '#63c74d', 'book'), gear: { back: [], fams: [{ kind: 'bat', color: '#c77dff' }], charms: [{ kind: 'moon', color: '#ffd23f' }, { kind: 'flame', color: '#ff7a3a' }] } },
];
// ---------------------------------------------------------------------------
// ヒーロー: ボスが入れ替わりながら、討伐隊がかわるがわる跳びかかる
// ---------------------------------------------------------------------------
const HW = 384, HH = 176, FOOT = 152;
function heroStage(ticker) {
    const c = pixelCanvas(HW, HH, 'lp-hero-canvas', tl('ボスと冒険者たちが戦うドット絵のアニメ'));
    const ctx = ctx2d(c);
    const caption = h('p', { class: 'lp-hero-boss', 'aria-live': 'off' });
    // 姿を見せるのはシーズン1のボスだけ（先のシーズンのボスは、ボス図鑑でも影だけにしている）
    const HERO_BOSSES = BOSSES.slice(0, 1);
    const SWAP = HERO_BOSSES.length > 1 ? 6.5 : 1e9; // ボスが入れ替わる間隔（秒）
    const homes = [{ x: 232, y: FOOT - 8 }, { x: 262, y: FOOT + 4 }, { x: 300, y: FOOT - 6 }, { x: 334, y: FOOT + 6 }];
    const stars = Array.from({ length: 42 }, (_, i) => ({ x: (i * 97) % HW, y: (i * 53) % 84, p: i * 1.7 }));
    let shown = -1;
    const draw = (t) => {
        const bi = Math.floor(t / SWAP) % HERO_BOSSES.length;
        const local = t % SWAP;
        const B = HERO_BOSSES[bi];
        if (bi !== shown) {
            shown = bi;
            caption.textContent = tl(`{0}　{1}`, B.season, B.name);
        }
        // 空（帯で段を付ける）
        const bands = [B.sky[0], B.sky[1], B.sky[2]];
        bands.forEach((col, i) => { ctx.fillStyle = col; ctx.fillRect(0, i * 34, HW, 34 + 2); });
        ctx.fillStyle = B.sky[2];
        ctx.fillRect(0, 102, HW, 20);
        for (const s of stars) {
            if (s.y > 70)
                continue;
            ctx.fillStyle = wave(t, 2, s.p) > 0.6 ? '#ffffff' : '#9aa0c8';
            ctx.fillRect(s.x, s.y, 1, 1);
        }
        // 月
        ctx.fillStyle = '#fff1d6';
        for (let y = -7; y <= 7; y++)
            for (let x = -7; x <= 7; x++)
                if (x * x + y * y <= 49)
                    ctx.fillRect(330 + x, 26 + y, 1, 1);
        ctx.fillStyle = B.sky[0];
        for (let y = -6; y <= 6; y++)
            for (let x = -6; x <= 6; x++)
                if (x * x + y * y <= 36)
                    ctx.fillRect(334 + x, 23 + y, 1, 1);
        // 遠くの山（ぎざぎざの影）
        ctx.fillStyle = B.sky[3];
        for (let x = 0; x < HW; x++) {
            const y = 104 - Math.abs(((x * 0.9) % 60) - 30) * 0.7 - (x % 140 < 70 ? 8 : 0);
            ctx.fillRect(x, Math.round(y), 1, 130 - Math.round(y));
        }
        // 地面（石畳）
        ctx.fillStyle = B.ground[1];
        ctx.fillRect(0, 124, HW, HH - 124);
        for (let y = 124; y < HH; y += 8)
            for (let x = ((y - 124) / 8) % 2 ? -8 : 0; x < HW; x += 16) {
                ctx.fillStyle = B.ground[0];
                ctx.fillRect(x + 1, y + 1, 14, 6);
            }
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(0, 124, HW, 2);
        // ボス（入れ替わりの瞬間は白く光って煙）
        const bx = 92, appear = Math.min(1, local / 0.35), leave = local > SWAP - 0.3;
        const hitAt = [1.7, 3.1, 4.5];
        const hurt = hitAt.some((x) => local > x + 0.32 && local < x + 0.5);
        const pose = bossPose(t, bi);
        if (hurt) {
            pose.eye = 'hurt';
            pose.lean = -2;
        }
        const flash = appear < 1 && appear > 0.5 || leave;
        const bc = bossCanvas(pose, flash || (hurt && Math.floor(t * 20) % 2 === 0), B.kind);
        ctx.save();
        ctx.globalAlpha = Math.min(1, appear * 1.6);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(bx, FOOT + 2, 34, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.drawImage(bc, Math.round(bx - BW / 2 + (hurt ? -2 : 0)), Math.round(FOOT - BH + 4));
        ctx.restore();
        if (appear < 1 || leave) { // 煙
            const k = leave ? (local - (SWAP - 0.3)) / 0.3 : appear;
            for (let i = 0; i < 9; i++) {
                const a = i * 0.7, r = 18 + k * 26;
                ctx.fillStyle = i % 2 ? '#ece9f6' : '#9aa0c8';
                ctx.globalAlpha = 1 - k;
                const s = 10 - k * 6;
                ctx.fillRect(Math.round(bx + Math.cos(a) * r - s / 2), Math.round(FOOT - 40 + Math.sin(a) * r * 0.6 - s / 2), s, s);
            }
            ctx.globalAlpha = 1;
        }
        // 討伐隊: 順番に跳びかかる（跳躍落下斬り）
        PARTY.forEach((p, i) => {
            const home = homes[i];
            let x = home.x, y = home.y, action = 'idle', at = 0, glow = 0;
            const k = hitAt.findIndex((x0) => local >= x0 - 0.45 && local < x0 + 0.5);
            const who = k >= 0 ? (k + bi) % PARTY.length : -1;
            if (who === i) {
                const s = local - (hitAt[k] - 0.45); // 0..0.95
                if (s < 0.45) {
                    const q = s / 0.45;
                    x = home.x + (bx + 52 - home.x) * q;
                    y = home.y - Math.sin(q * Math.PI) * 34 + (FOOT - home.y) * q;
                    action = 'dash';
                }
                else {
                    const q = (s - 0.45) / 0.5;
                    x = bx + 52 + (home.x - bx - 52) * Math.max(0, q - 0.3) / 0.7;
                    y = FOOT + (home.y - FOOT) * Math.max(0, q - 0.3) / 0.7;
                    action = q < 0.4 ? 'attack' : 'idle';
                    at = Math.min(1, 0.4 + q);
                }
                glow = s > 0.3 && s < 0.6 ? 1 : 0;
            }
            else if (local > SWAP - 1.4 && local < SWAP - 0.3) {
                action = 'victory';
                at = (local * 1.4 + i * 0.2) % 1;
            }
            // お供は跳びかからず、主の立ち位置で待つ（お供は戦わない。考える時間と道具の受け渡しを見せる係）
            drawHero(ctx, p.look, { ...p.gear, fams: [] }, x, y, { frame: Math.floor(t * 60) + i * 23, flip: true, action, t: at, skillGlow: glow });
            if (p.gear.fams[0])
                drawFamiliarAt(ctx, p.gear.fams[0], home.x, home.y, Math.floor(t * 60) + i * 23);
        });
        hitAt.forEach((x0, k) => {
            const q = (local - x0) / 0.5;
            if (q < 0 || q > 1)
                return;
            const p = PARTY[(k + bi) % PARTY.length];
            const style = BODY_STYLE[p.look.body];
            burst(ctx, style, fxColors(style, p.look), bx + 18, FOOT - 40, q, `hero:${k}`, true);
        });
    };
    ticker.add(c, draw);
    return h('div', { class: 'lp-hero-stage' }, c, caption);
}
// ---------------------------------------------------------------------------
// 遊び方の3コマ（小さな canvas）
// ---------------------------------------------------------------------------
function stepScene(kind, ticker) {
    const W = 96, H = 64;
    const label = { train: tl('白うさぎの冒険者のまわりを、持ち物の飾りが回る'), send: tl('冒険者が走って出発する'), watch: tl('冒険者がボスに斬りかかる') }[kind];
    const c = pixelCanvas(W, H, 'lp-step-canvas', label);
    const ctx = ctx2d(c);
    const hero = PARTY[kind === 'train' ? 2 : kind === 'send' ? 0 : 3];
    ticker.add(c, (t) => {
        ctx.fillStyle = '#1d2242';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#262c55';
        for (let y = 50; y < H; y += 6)
            for (let x = ((y - 50) / 6) % 2 ? -6 : 0; x < W; x += 12)
                ctx.fillRect(x + 1, y + 1, 10, 4);
        if (kind === 'train') {
            const glow = (Math.sin(t * 2) + 1) / 2;
            drawHero(ctx, { ...hero.look, weapon: 'book' }, { ...hero.gear, charms: [{ kind: 'scroll', color: '#c77dff' }, { kind: 'book', color: '#5fcde4' }, { kind: 'gem', color: '#feae34' }] }, 48, 54, { frame: Math.floor(t * 60), ...(t % 3 < 0.7 ? { action: 'victory', t: (t % 3) / 0.7 } : { action: 'idle' }), skillGlow: glow });
        }
        else if (kind === 'send') {
            // 地面が流れて、走っている
            ctx.fillStyle = '#3a4280';
            const off = (t * 60) % 12;
            for (let x = -12; x < W + 12; x += 12)
                ctx.fillRect(Math.round(x + off), 56, 6, 2);
            drawHero(ctx, hero.look, hero.gear, 48, 54, { frame: Math.floor(t * 60), flip: true, action: 'dash' });
            ctx.fillStyle = '#9aa0c8';
            for (let i = 0; i < 3; i++)
                ctx.fillRect(Math.round(60 + ((t * 80 + i * 13) % 30)), 50 - i * 3, 3, 1);
        }
        else {
            const s = (t % 2.2) / 2.2;
            const p = bossPose(t, 3, 0);
            const hit = s > 0.42 && s < 0.6;
            if (hit)
                p.eye = 'hurt';
            // 竜は大きいので、頭と前足だけが画面に入るように左へずらして等倍で描く
            const bc = bossCanvas(p, hit && s < 0.47, 'dragon');
            ctx.drawImage(bc, -44, H - BH + 6);
            const act = s > 0.25 && s < 0.6 ? 'attack' : 'idle';
            drawHero(ctx, hero.look, hero.gear, 74, 56, { frame: Math.floor(t * 60), flip: true, action: act, t: (s - 0.25) / 0.35 });
            if (s > 0.42 && s < 0.8) {
                const style = BODY_STYLE[hero.look.body];
                burst(ctx, style, fxColors(style, hero.look), 34, 30, (s - 0.42) / 0.38, 'step', false);
            }
        }
    });
    return c;
}
// ---------------------------------------------------------------------------
// 最後の導線: 夜明けの空、ギルドの門、出発を待つ冒険者たち、遠くのボスの影
// ---------------------------------------------------------------------------
const CW2 = 400, CH2 = 200, HORIZON = 136;
const DAWN = ['#1b1d47', '#262660', '#363174', '#4d3a84', '#6a4289', '#8c4a88', '#ae5583', '#cd657c', '#e67d73', '#f59b6c', '#fcbb6c', '#ffd47e'];
const CTA_PARTY = [
    { look: look('knight', '#3a7bd5', '#f2c14e', 'shield'), gear: { back: [{ kind: 'spear' }], fams: [], charms: [] } },
    { look: look('bunny', '#ff9ce6', '#fbf7f0', 'wand'), gear: { back: [], fams: [{ kind: 'fairy', color: '#ffd166' }], charms: [] } },
    { look: look('cat', '#e43b44', '#ffd166', 'sword', 'calico'), gear: { back: [], fams: [], charms: [{ kind: 'star', color: '#ffd23f' }] } },
    { look: look('frog', '#feae34', '#a8e04a', 'umbrella'), gear: NO_GEAR },
    { look: look('witch', '#5a3d8a', '#63c74d', 'book'), gear: { back: [], fams: [{ kind: 'bat', color: '#c77dff' }], charms: [] } },
    { look: look('cat', '#c77dff', '#9a9cb0', 'wand', 'tux'), gear: NO_GEAR },
];
function silhouette(src, color, cache) {
    const c = cache.c ?? (cache.c = document.createElement('canvas'));
    c.width = src.width;
    c.height = src.height;
    const x = c.getContext('2d');
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    return c;
}
function ctaScene(ticker) {
    const c = pixelCanvas(CW2, CH2, 'lp-cta-canvas', tl('ギルドの門の前に冒険者たちが並び、遠くの山にボスの影が見える'));
    const ctx = ctx2d(c);
    const R = (x, y, w, hh, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(hh)); };
    const stars = Array.from({ length: 40 }, (_, i) => ({ x: (i * 89 + 13) % CW2, y: (i * 37) % 60, p: i * 1.3 }));
    const sparks = Array.from({ length: 12 }, (_, i) => ({ x: 130 + ((i * 71) % 260), y: 20 + ((i * 43) % 120), p: i * 0.61 }));
    const clouds = [{ x: 30, y: 30, w: 46, s: 3 }, { x: 170, y: 54, w: 34, s: 5 }, { x: 290, y: 20, w: 40, s: 2 }, { x: 380, y: 72, w: 28, s: 4 }];
    const silA = {}, silB = {};
    const SWAP = 5;
    ticker.add(c, (t) => {
        // 空（夜明けの段々。境目は市松で混ぜる）
        const bh = HORIZON / DAWN.length;
        DAWN.forEach((col, i) => {
            R(0, i * bh, CW2, bh + 1, col);
            if (i > 0) {
                ctx.fillStyle = DAWN[i - 1];
                for (let x = (i % 2); x < CW2; x += 2)
                    ctx.fillRect(x, Math.round(i * bh), 1, 1);
            }
        });
        // 消えていく星
        for (const s of stars) {
            const tw = wave(t, 1.6, s.p);
            if (tw < -0.2)
                continue;
            ctx.fillStyle = s.y < 30 ? (tw > 0.7 ? '#ffffff' : '#b9bde8') : '#d6a6c8';
            ctx.fillRect(s.x, s.y, 1, 1);
        }
        // 朝日と光の筋
        const sx = 210, sy = 112;
        for (let k = 0; k < 14; k++) {
            const a = Math.PI + (k + 0.5) * (Math.PI / 14) + wave(t, 0.3) * 0.04;
            for (let r = 38 + ((t * 14 + k * 5) % 6); r < 120; r += 6) {
                const x = sx + Math.cos(a) * r, y = sy + Math.sin(a) * r;
                ctx.fillStyle = `rgba(255,236,170,${0.5 - r / 300})`;
                ctx.fillRect(Math.round(x), Math.round(y), 2, 1);
            }
        }
        for (let y = -34; y <= 0; y++)
            for (let x = -34; x <= 34; x++) {
                const d = x * x + y * y;
                if (d > 34 * 34)
                    continue;
                ctx.fillStyle = d <= 22 * 22 ? '#fff6cf' : d <= 26 * 26 ? '#ffe08a' : (x + y) % 2 ? 'rgba(255,214,120,0.45)' : 'rgba(255,214,120,0.15)';
                ctx.fillRect(sx + x, sy + y, 1, 1);
            }
        // 雲（ゆっくり流れる）
        for (const cl of clouds) {
            const x = Math.round(((cl.x + t * cl.s) % (CW2 + 80)) - 40);
            R(x + 6, cl.y, cl.w - 12, 3, '#ffc3b0');
            R(x, cl.y + 3, cl.w, 4, '#f59bab');
            R(x + 4, cl.y + 7, cl.w - 6, 2, '#c66a95');
            R(x + 10, cl.y - 2, cl.w * 0.4, 2, '#ffe0c8');
        }
        // 遠い山なみ
        for (let x = 0; x < CW2; x++) {
            const y = 112 - Math.abs(((x * 0.8 + 20) % 70) - 35) * 0.55 - (x > 100 && x < 150 ? 6 : 0) + Math.max(0, 54 - Math.abs(x - 210)) * 0.32; // 朝日の昇る谷
            R(x, y, 1, HORIZON + 4 - y, '#7a4a86');
        }
        // ボスの影（遠くの岩山の上。シーズンのボスが入れ替わる）
        const bi = Math.floor(t / SWAP) % BOSSES.length, local = t % SWAP;
        const fade = Math.min(1, local / 0.35, (SWAP - local) / 0.35);
        const pose = bossPose(t, bi);
        const bc = bossCanvas(pose, false, BOSSES[bi].kind);
        const glow = silhouette(bc, '#ff5d8f', silA), dark = silhouette(bc, '#2a1636', silB);
        const bx = 296, by = 118 - BH + 2;
        ctx.save();
        ctx.globalAlpha = fade * (0.45 + 0.25 * (wave(t, 3) + 1) / 2);
        ctx.translate(bx + BW, by);
        ctx.scale(-1, 1); // 冒険者たちのほうを向かせる
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]])
            ctx.drawImage(glow, dx, dy);
        ctx.globalAlpha = fade;
        ctx.drawImage(dark, 0, 0);
        ctx.restore();
        // 岩山と、手前の丘
        for (let x = 0; x < CW2; x++) {
            const crag = x > 266 ? 110 + Math.abs(((x * 0.9) % 26) - 13) * 0.75 + Math.max(0, 286 - x) * 0.6 : 999;
            const hill = 128 - Math.abs(((x * 0.6) % 90) - 45) * 0.22;
            const y = Math.min(crag, hill);
            R(x, y, 1, HORIZON + 8 - y, x > 266 && crag < hill ? '#3a2448' : '#55306a');
        }
        // 野原と道
        R(0, HORIZON + 4, CW2, CH2, '#2f5b3e');
        R(0, HORIZON + 4, CW2, 3, '#6aa058');
        R(0, HORIZON + 7, CW2, 3, '#4c8350');
        for (let i = 0; i < 60; i++) {
            const x = (i * 53) % CW2, y = HORIZON + 12 + ((i * 29) % 50);
            R(x, y, 2, 1, i % 3 ? '#3f744a' : '#5f9a55');
        }
        R(40, 158, CW2, 24, '#b48a5a');
        R(40, 158, CW2, 2, '#d8b07a');
        R(40, 180, CW2, 2, '#8a6640');
        for (let i = 0; i < 30; i++)
            R(46 + ((i * 47) % 350), 162 + ((i * 13) % 16), 2, 1, '#9a7448');
        // 花
        for (let i = 0; i < 18; i++) {
            const x = (i * 97 + 30) % CW2, y = 150 + ((i * 7) % 12);
            if (x > 4 && x < 124)
                continue;
            R(x, y, 1, 1, ['#ff9ce6', '#fff1d6', '#ffd166'][i % 3]);
        }
        // ギルドの門
        gate(R, t);
        // 出発を待つ冒険者たち（ときどき、ぴょんと跳ねて「準備よし」）
        CTA_PARTY.forEach((p, i) => {
            const x = 148 + i * 36, fy = 170 + (i % 2) * 7;
            const cyc = (t + i * 0.83) % 5.2;
            let action = 'idle', at = 0;
            if (cyc < 0.7) {
                action = 'victory';
                at = cyc / 0.7;
            }
            drawHero(ctx, p.look, p.gear, x, fy, { frame: Math.floor(t * 60) + i * 19, action, t: at });
        });
        // きらめき
        for (const s of sparks) {
            const q = ((t * 0.55 + s.p) % 1.6) / 1.6;
            if (q > 0.5)
                continue;
            const size = Math.round(Math.sin(q / 0.5 * Math.PI) * 3);
            const col = q < 0.25 ? '#ffffff' : '#ffe08a';
            R(s.x, s.y, 1, 1, col);
            for (let k = 1; k <= size; k++) {
                R(s.x - k, s.y, 1, 1, col);
                R(s.x + k, s.y, 1, 1, col);
                R(s.x, s.y - k, 1, 1, col);
                R(s.x, s.y + k, 1, 1, col);
            }
        }
    });
    return c;
}
// ギルドの門（石の塔ふたつ、アーチ、開いた扉、看板、松明、塔の上ではためく旗）
function gate(R, t) {
    const ST = '#77799a', SH = '#55577a', DK = '#34364f', LT = '#a9a6c4', WARM = '#d79a8e';
    const bricks = (x0, y0, w, hh) => {
        R(x0, y0, w, hh, ST);
        for (let y = y0 + 5; y < y0 + hh; y += 6) {
            R(x0, y, w, 1, SH);
            for (let x = x0 + ((y - y0) % 12 ? 3 : 9); x < x0 + w; x += 12)
                R(x, y - 5, 1, 5, SH);
        }
        R(x0 + w - 3, y0, 3, hh, WARM); // 朝日の当たる右の面
        R(x0, y0, 2, hh, DK);
    };
    const crenel = (x0, w, y) => { for (let x = x0; x < x0 + w - 2; x += 8) {
        R(x, y, 6, 6, ST);
        R(x, y, 6, 1, LT);
        R(x + 4, y, 2, 6, WARM);
    } };
    // 壁と塔
    bricks(38, 88, 54, 72);
    crenel(40, 52, 82);
    bricks(6, 62, 34, 98);
    crenel(6, 36, 56);
    bricks(90, 62, 34, 98);
    crenel(90, 36, 56);
    // 塔の窓（あたたかい灯り）
    for (const x of [20, 104]) {
        R(x, 80, 6, 10, DK);
        R(x + 1, 82, 4, 8, wave(t, 5, x) > 0.8 ? '#ffe9a0' : '#ffcf6b');
        R(x, 104, 6, 10, DK);
        R(x + 1, 106, 4, 8, '#ffb85a');
    }
    // アーチ（中は明るい広間）
    const ax = 65, ay = 124;
    for (let y = -16; y <= 0; y++)
        for (let x = -16; x <= 16; x++)
            if (x * x + y * y <= 256)
                R(ax + x, ay + y, 1, 1, '#1a1530');
    R(ax - 16, ay, 33, 36, '#1a1530');
    for (let y = -14; y <= 0; y++)
        for (let x = -12; x <= 12; x++)
            if (x * x + y * y <= 160)
                R(ax + x, ay + 6 + y, 1, 1, '#3a2c3a');
    R(ax - 12, ay + 6, 25, 30, '#3a2c3a');
    R(ax - 10, ay + 24, 21, 12, '#5a4240');
    for (let y = -18; y <= 0; y++)
        for (let x = -18; x <= 18; x++) {
            const d = x * x + y * y;
            if (d > 256 && d <= 324)
                R(ax + x, ay + y, 1, 1, LT);
        }
    // 開いた扉
    for (const [x0, dir] of [[ax - 22, 1], [ax + 17, -1]]) {
        R(x0, ay - 4, 6, 40, '#7a4a28');
        R(x0 + (dir > 0 ? 5 : 0), ay - 4, 1, 40, '#4a2a12');
        for (const y of [ay + 2, ay + 16, ay + 30])
            R(x0, y, 6, 2, '#2e2a3a');
    }
    // 看板（ギルドの紋章）
    R(ax - 13, 92, 27, 16, '#feae34');
    R(ax - 12, 93, 25, 14, '#8a2232');
    // 星の紋章
    for (const [dx, dy, w] of [[0, 0, 1], [-1, 1, 3], [-5, 3, 11], [-3, 4, 7], [-2, 5, 5], [-3, 6, 7], [-4, 7, 3], [2, 7, 3], [-5, 8, 2], [4, 8, 2]])
        R(ax + dx, 95 + dy, w, 1, '#ffd166');
    R(ax - 1, 96, 1, 1, '#ffd166');
    R(ax + 1, 96, 1, 1, '#ffd166');
    R(ax - 1, 97, 3, 1, '#ffd166');
    // 松明
    for (const x of [ax - 26, ax + 25]) {
        R(x, 122, 2, 8, '#4a2a12');
        const f = Math.floor(t * 8 + x) % 3;
        R(x - 1, 117 - f, 4, 5 + f, '#ff7a3a');
        R(x, 118 - f, 2, 3 + f, '#ffd166');
    }
    // 塔の上の旗（はためく）
    for (const [px, col] of [[22, '#e43b44'], [106, '#3a7bd5']]) {
        R(px, 30, 1, 26, '#c9c3d6');
        R(px - 1, 29, 3, 1, '#feae34');
        const ph = Math.floor(t * 6 + px) % 2;
        for (let i = 0; i < 14; i++) {
            const hh = Math.max(1, 9 - Math.floor(i * 0.6));
            const dy = Math.round(Math.sin(t * 6 + i * 0.6 + px) * 1.2) + (ph && i > 8 ? 1 : 0);
            R(px + 1 + i, 31 + dy + Math.floor((9 - hh) / 2), 1, hh, i % 5 === 4 ? '#feae34' : col);
        }
    }
}
// ---------------------------------------------------------------------------
// 討伐の再生（本編のアリーナをそのまま使う）
// ---------------------------------------------------------------------------
function waveTime(r, time, dt, secondsPerWave) {
    return time + (dt / secondsPerWave) * r.slowFactor(time);
}
function mainDemo(script, ticker, mine = []) {
    const canvas = h('canvas', { class: 'arena-canvas pixel', 'aria-label': tl('討伐の再生') });
    const r = new ArenaRenderer(canvas, script);
    r.muted = true; // 音は最初は消しておく
    r.mine = new Set(mine);
    let time = 0, playing = !reduced;
    const total = r.totalTime;
    const wn = h('span', { class: 'lp-demo-wave' });
    const title = h('span', { class: 'lp-demo-case' });
    const playBtn = h('button', { class: 'btn btn-icon', type: 'button' });
    const soundBtn = h('button', { class: 'btn lp-sound', type: 'button', 'aria-pressed': 'false' });
    const seek = h('input', { type: 'range', min: 0, max: total, step: 0.01, value: 0, 'aria-label': tl('再生位置') });
    const syncButtons = () => {
        playBtn.textContent = playing ? '❚❚' : '▶';
        playBtn.setAttribute('aria-label', playing ? tl('一時停止') : tl('再生'));
        soundBtn.textContent = r.muted ? tl('音：なし') : tl('音：あり');
        soundBtn.setAttribute('aria-pressed', String(!r.muted));
    };
    playBtn.onclick = () => { playing = !playing; syncButtons(); };
    soundBtn.onclick = () => { r.muted = !r.muted; setSfx(!r.muted); syncButtons(); };
    seek.oninput = () => { time = Number(seek.value); r.draw(time); };
    syncButtons();
    let lastW = -1;
    const hud = () => {
        const w = Math.min(Math.floor(time), script.waves.length - 1);
        if (w === lastW)
            return;
        lastW = w;
        const wv = script.waves[w];
        wn.textContent = tl(`場面 {0} / {1}`, w + 1, script.waves.length);
        title.textContent = script.cases[wv.caseIndex]?.title ?? '';
    };
    ticker.add(canvas, (_t, dt) => {
        if (playing && dt > 0) {
            time = waveTime(r, time, dt, 3.4);
            if (time >= total)
                time = 0;
            seek.value = String(time);
        }
        r.draw(time);
        hud();
    }, () => playing);
    return h('div', { class: 'lp-demo' }, h('div', { class: 'lp-demo-hud' }, wn, title), h('div', { class: 'canvas-wrap' }, canvas), h('div', { class: 'controls' }, playBtn, seek, soundBtn), h('p', { class: 'lp-sound-note' }, tl('iPhone などで音が出ないときは、消音（マナー）モードを切ってから「音：あり」を押してください。')));
}
function clipDirector(ticker) {
    const clips = [];
    let pinned = null, active = null, auto = !reduced;
    const io = typeof IntersectionObserver === 'function'
        ? new IntersectionObserver((es) => es.forEach((e) => { const c = clips.find((x) => x.el === e.target); if (c)
            c.near = e.isIntersecting; }))
        : null;
    const want = (c) => auto || c === pinned;
    ticker.pre(() => {
        let best = null;
        if (clips.some((c) => c.near)) {
            const vh = innerHeight;
            const dist = (c) => {
                if (!c.near)
                    return Infinity;
                const r = c.el.getBoundingClientRect();
                return r.bottom > 0 && r.top < vh ? Math.abs((r.top + r.bottom) / 2 - vh / 2) : Infinity;
            };
            if (pinned && want(pinned) && dist(pinned) < Infinity)
                best = pinned;
            else {
                let bd = Infinity;
                for (const c of clips) {
                    if (!want(c))
                        continue;
                    const d = dist(c);
                    if (d < bd) {
                        bd = d;
                        best = c;
                    }
                }
            }
        }
        if (best !== active) {
            const prev = active;
            active = best;
            prev?.sync();
            best?.sync();
        }
    });
    return {
        isActive: (c) => active === c,
        add(c) { clips.push(c); io ? io.observe(c.el) : (c.near = true); },
        toggle(c) {
            if (active === c) {
                auto = false;
                pinned = null;
            }
            else
                pinned = c;
        },
    };
}
function clip(script, w, mine, ticker, dir, label, from = 0.08, to = 0.92) {
    const canvas = h('canvas', { class: 'arena-canvas pixel', role: 'img', 'aria-label': label });
    const r = new ArenaRenderer(canvas, script);
    r.muted = true;
    r.mine = new Set(mine);
    let time = w + from;
    r.draw(w + Math.min(to, from + 0.3)); // 止まっていても、見どころの1コマ
    const mark = h('span', { class: 'lp-clip-mark', 'aria-hidden': 'true' });
    // 窓全体を1つのボタンにする（スマホのタップでも確実に押せる）
    const btn = h('button', { class: 'lp-clip-btn', type: 'button' }, mark);
    const wrap = h('div', { class: 'canvas-wrap lp-clip' }, canvas, btn);
    const st = {
        el: wrap, near: false,
        sync: () => {
            const on = dir.isActive(st);
            wrap.classList.toggle('is-playing', on);
            mark.textContent = on ? '❚❚' : tl('▶ 再生');
            btn.setAttribute('aria-label', tl(`{0}を{1}`, label, on ? tl('一時停止') : tl('再生')));
        },
    };
    btn.addEventListener('click', () => dir.toggle(st));
    dir.add(st);
    st.sync();
    ticker.add(canvas, (_t, dt) => {
        if (dt <= 0)
            return;
        time = waveTime(r, time, dt, 3.4);
        if (time >= w + to) {
            time = w + from;
            r.frame = 0;
        }
        r.draw(time);
    }, () => dir.isActive(st));
    return wrap;
}
// ---------------------------------------------------------------------------
// ページ本体
// ---------------------------------------------------------------------------
export async function renderAbout(root, opts = {}) {
    root.replaceChildren(h('p', { class: 'loading' }, tl('読み込み中…')));
    const data = await getDemoBattle();
    const first = scriptFor(data);
    if (!first)
        throw new Error(tl('デモの討伐データが読めませんでした'));
    // 見本の討伐でいちばん成績の良い冒険者を「あなたが送り出した冒険者」として見せる（目印はアニメーションの中だけ）。
    // 連携詠唱の結果は見ている人で変わるので、その人を見る人にして流し直す
    const best = first.standings.slice().sort((a, b) => a.rank - b.rank)[0]?.f ?? 0;
    const bestId = first.fighters[best]?.id;
    const full = scriptFor(data, bestId ? [bestId] : []) ?? first;
    const playUrl = opts.playUrl ?? '#/';
    const page = h('div', { class: 'lp' });
    const ticker = makeTicker(page);
    const jump = (id) => () => page.querySelector(`#${id}`)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    const playLink = (cls = 'btn btn-primary lp-play') => playUrl
        ? h('a', { class: cls, href: playUrl }, tl('遊んでみる'))
        : h('p', { class: 'lp-noplay' }, tl('遊ぶためのURLは、このページを教えてくれた人に聞いてください。'));
    // --- ヒーロー ---
    const hero = h('section', { class: 'lp-hero' }, heroStage(ticker), h('div', { class: 'lp-hero-win win' }, h('h1', { class: 'lp-logo', 'aria-label': tl(`Agent Guild（{0}）`, BRAND.name) }, h('span', { class: 'lp-logo-en' }, 'AGENT GUILD'), h('span', { class: 'lp-logo-ja' }, BRAND.name)), h('p', { class: 'lp-catch' }, tl('言葉で育てたAIが、自分で考えてボスに挑む。')), h('p', { class: 'lp-lead' }, tl('あなたは冒険者の育て役。心得を教え、道具と巻物を持たせて送り出したら、あとは見守るだけ。シーズンごとに現れるボスに、みんなの冒険者がいっしょに挑みます。')), h('ul', { class: 'lp-cmd', 'aria-label': tl('このページの見どころ') }, h('li', {}, h('button', { type: 'button', onclick: jump('lp-demo') }, tl('討伐を見る'))), h('li', {}, h('button', { type: 'button', onclick: jump('lp-chars') }, tl('図鑑をひらく'))), h('li', {}, h('button', { type: 'button', onclick: jump('lp-mech') }, tl('しくみを知る'))), opts.demoUrl ? h('li', {}, h('a', { href: opts.demoUrl }, tl('デモで画面をさわる'))) : null), playLink()));
    // --- 概要: このアプリは何で、何のためにあるのか ---
    const about = h('section', { class: 'lp-sec', id: 'lp-what' }, h('h2', {}, tl('エージェントギルドって？')), h('div', { class: 'lp-what' }, h('div', { class: 'win lp-say' }, h('h3', {}, tl('AIに、仕事をまかせる時代')), h('p', {}, tl('AIは、質問に答えるだけのものから、指示を受けて自分で考え、道具を使いこなして仕事を片づけるものへと変わりつつあります。こうしたAIは「AIエージェント」と呼ばれます。'))), h('div', { class: 'win lp-say' }, h('h3', {}, tl('うまく動かすには、コツがいる')), h('p', {}, tl('同じAIでも、何をどのように伝えるか、どんな道具や知識を持たせるかで、働きぶりは大きく変わります。そのコツは、説明を読むより、実際に試して結果を見るほうがずっと早く身につきます。'))), h('div', { class: 'win lp-say' }, h('h3', {}, tl('試すなら、遊びの中で')), h('p', {}, tl('エージェントギルドは、AIエージェントを「冒険者」として育て、ボス討伐に送り出すゲームです。プログラミングはいりません。日本語で書いて、画面で選ぶだけ。みんなで同じボスに挑み、戦果を競いながら、AIをうまく働かせる感覚を遊んで身につけます。')))));
    // --- 遊び方 ---
    const steps = [
        ['train', tl('育てる'), tl('冒険者に日本語で心得を教え、道具や巻物を持たせる。かばんの大きさには限りがあるので、何を持たせるかが腕の見せどころ。')],
        ['send', tl('送り出す'), tl('ボタンひとつで出発。冒険者は本物のAI。戦場ではあなたの手を離れ、自分で考えて動きます。')],
        ['watch', tl('討伐を見る'), tl('みんなの冒険者がそろってボスに挑む様子を、ドット絵のアニメで見届ける。講評をヒントに鍛え直して、また挑戦。')],
    ];
    const kit = [
        ['kokoroe', tl('心得'), tl('システムプロンプト'), tl('冒険者の考え方と、戦いの要点を書いた指示書。')],
        ['dougu', tl('道具'), tl('ツール'), tl('冒険者が自分では知りえない情報を、外へ取りに行く手段。')],
        ['makimono', tl('巻物'), tl('スキル'), tl('ふだんは閉じておき、必要なときだけ開いて読む知識の本。')],
        ['nisshi', tl('冒険日誌'), tl('メモリ'), tl('戦いの最中に、前に起きたことを思い出すための記録。')],
        ['kekkai', tl('結界'), tl('ガードレール'), tl('あやしい声を、冒険者の耳に届く前に弾くしくみ。')],
    ];
    const howto = h('section', { class: 'lp-sec', id: 'lp-howto' }, h('h2', {}, tl('遊び方')), h('ol', { class: 'lp-steps' }, ...steps.map(([k, t, body]) => h('li', { class: 'lp-step' }, stepScene(k, ticker), h('h3', {}, t), h('p', {}, body)))), h('h3', { class: 'lp-sub' }, tl('冒険者に持たせるもの')), h('ul', { class: 'lp-kit' }, ...kit.map(([id, name, ai, d]) => h('li', {}, iconCanvas(id, 4, name), h('b', {}, name), h('span', { class: 'lp-ai' }, ai), h('p', {}, d)))));
    // --- 討伐の再生 ---
    const demo = h('section', { class: 'lp-sec', id: 'lp-demo' }, h('h2', {}, tl('実際の討伐')), h('p', { class: 'lp-intro' }, tl(`見本の討伐「{0}」。討伐隊{1}人の記録です。ボスが動くたびに、冒険者それぞれのAIが「どう動くか」を答え、正しく動けた冒険者はかわして反撃し、間違えた冒険者は攻撃を受けます。`, data.task.title, full.fighters.length)), mainDemo(full, ticker, [best]));
    // --- 演出のこだわり ---
    const sceneWave = (sc) => full.waves.findIndex((wv) => full.cases[wv.caseIndex]?.scene === sc);
    const fx = [];
    const spellW = sceneWave('spell');
    if (spellW >= 0)
        fx.push({ title: tl('詠唱合戦'), body: tl('ボスが呪文を唱えはじめると、打ち消しの呪文を知る者が詠唱で応じる。光線で魔法弾をつかまえて打ち消し、そのままボスへ跳ね返す。'), w: spellW, mine: [best] });
    // 必殺技: 巻物の大技（奥義・乱舞・召喚）で、あなたが主役になれる場面を優先
    const ultScenes = ['ougi', 'rush', 'summon', 'parry', 'seal', 'awaken'];
    const heroOk = (wv, f) => wv.events.some((e) => e.type === 'strike' && e.f === f && e.success && e.used.skills.length > 0);
    const ultW = (pred) => full.waves.findIndex((wv) => ultScenes.includes(full.cases[wv.caseIndex]?.scene ?? '') && !!full.cases[wv.caseIndex]?.keySkill && pred(wv));
    let ougiW = ultW((wv) => heroOk(wv, best));
    if (ougiW < 0)
        ougiW = ultW(() => true);
    if (ougiW < 0)
        ougiW = sceneWave('ougi');
    if (ougiW >= 0)
        fx.push({ title: tl('必殺技のカットイン'), body: tl('ここぞという場面では、カットインが入って必殺技が炸裂する。跳躍落下斬り・乱舞・召喚と、技ごとに見せ方が変わる。'), w: ougiW, mine: [best] });
    // 会心: あなた（いちばん成績の良い冒険者）の会心を優先
    const isCrit = (e, f) => e.type === 'attack' && !!e.crit && (f === undefined || e.f === f);
    let critW = full.waves.findIndex((wv, i) => i !== spellW && i !== ougiW && wv.events.some((e) => isCrit(e, best)));
    if (critW < 0)
        critW = full.waves.findIndex((wv, i) => i !== spellW && i !== ougiW && wv.events.some((e) => isCrit(e)));
    if (critW >= 0) {
        const e = (full.waves[critW].events.find((x) => isCrit(x, best)) ?? full.waves[critW].events.find((x) => isCrit(x)));
        fx.push({ title: tl('会心の一撃'), body: tl('正しく動けた冒険者は反撃する。会心が出ると画面が揺れ、ダメージの数字が大きく跳ねる。'), w: critW, mine: e ? [e.f] : [] });
    }
    const guarded = (e) => e.type === 'strike' && !e.charmed && e.used.tools.includes('guardrail');
    const calm = (e) => e.type === 'strike' && !e.charmed;
    const isIll = (wv) => full.cases[wv.caseIndex]?.scene === 'illusion';
    const mineGuarded = (e) => guarded(e) && e.f === best;
    let illW = full.waves.findIndex((wv) => isIll(wv) && wv.events.some(mineGuarded));
    if (illW < 0)
        illW = full.waves.findIndex((wv) => isIll(wv) && wv.events.some(guarded));
    if (illW < 0)
        illW = full.waves.findIndex((wv) => isIll(wv) && wv.events.some(calm));
    if (illW >= 0) {
        const ev = full.waves[illW].events;
        const e = (ev.find(mineGuarded) ?? ev.find(guarded) ?? ev.find(calm));
        fx.push({ title: tl('幻術と結界'), body: tl('ボスは偉い人の声をまねて、もっともらしい偽の命令を混ぜてくる。あやしい声が、光の壁にはじかれて砕け散る。'), w: illW, mine: [e.f] });
    }
    const breathW = full.waves.findIndex((wv) => full.cases[wv.caseIndex]?.scene === 'breath' && wv.events.some((e) => e.type === 'strike' && e.success));
    if (breathW >= 0)
        fx.push({ title: tl('見切りと反撃'), body: tl('ボスの攻撃をひらりとかわし、すかさず反撃。武器ごとに、斬りかかる者もいれば、遠くから撃ちこむ者もいる。'), w: breathW, mine: [best] });
    // 連携詠唱（課題に chain の場面があるときだけ）。討伐の締めくくりで、大魔法がとどめになる（失敗すれば総攻撃）ので、
    // 「討伐の瞬間」の窓と入れ替える（窓は6つのまま）
    // 窓には、7人が交代で唱えて大魔法が決まるところ（あなたが最後の第7節）を見せる。
    // 詠唱書を持って唱えられた冒険者（足りなければ成績の良い順）7人の討伐隊で、連携詠唱の場面を組み直す
    const chainW = sceneWave('chain');
    if (chainW >= 0) {
        const cc = full.cases[full.waves[chainW].caseIndex];
        const knows = (e) => (e.result.cases.find((c) => c.caseId === cc.id)?.score ?? 0) > 0;
        const rank = new Map(first.standings.map((x) => [first.fighters[x.f].id, x.rank]));
        const pick = data.entrants.slice().sort((a, b) => Number(b.id === bestId) - Number(a.id === bestId) || Number(knows(b)) - Number(knows(a)) || (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99)).slice(0, 7);
        const len = cc.chant?.length ?? 7;
        const party = data.entrants.filter((e) => pick.includes(e)).map((e) => ({
            ...e, result: { ...e.result, cases: e.result.cases.map((c) => (c.caseId === cc.id ? { ...c, score: 1, runs: c.runs.map(() => 1), mpOut: false, chainUpto: len } : c)) },
        }));
        const alt = party.length >= 2 ? scriptFor({ ...data, entrants: party }, bestId ? [bestId] : []) : null;
        const sc = alt ?? full;
        const w = sc.waves.findIndex((wv) => sc.cases[wv.caseIndex]?.scene === 'chain');
        const me = sc.fighters.findIndex((f) => f.id === bestId);
        if (w >= 0)
            fx.push({
                title: tl('連携詠唱'),
                body: tl('ボスの最後の大技に、討伐隊が魔法陣を囲んで、詠唱を一節ずつつないでいく。七節がそろえば、全員で大魔法の名を叫ぶ。'),
                w, mine: me >= 0 ? [me] : [], from: 0.0, to: 0.99, sc,
            });
    }
    // ボスが倒れる瞬間（bossDown の少し前から、勝利の余韻まで）
    const downW = chainW >= 0 ? -1 : full.waves.findIndex((wv) => wv.events.some((e) => e.type === 'bossDown'));
    if (downW >= 0) {
        const evs = full.waves[downW].events;
        const dt = evs.find((e) => e.type === 'bossDown').t;
        // 最後の反撃が始まる少し前から（ボスの攻撃→とどめの連撃→崩れ落ちる→勝利の余韻）
        const firstAtk = Math.min(dt, ...evs.filter((e) => e.type === 'attack').map((e) => e.t));
        fx.push({ title: tl('討伐の瞬間'), body: tl('とどめの連撃で、ボスが地響きとともに崩れ落ちる。最後まで戦い抜いた冒険者たちに、勝利のファンファーレ。'), w: downW, mine: [], from: Math.max(0, firstAtk - 0.45), to: dt + 0.75 });
    }
    const clips = clipDirector(ticker);
    const effects = h('section', { class: 'lp-sec', id: 'lp-fx' }, h('h2', {}, tl('演出のこだわり')), h('p', { class: 'lp-intro' }, tl('見本の討伐から、見どころの場面だけを切り出しました。画面のまん中に来た窓が、くり返し動きます。窓をクリック（タップ）すると、一時停止・再生。')), h('div', { class: 'lp-fx-grid' }, ...fx.map((x) => h('figure', { class: 'lp-fx win' }, clip(x.sc ?? full, x.w, x.mine, ticker, clips, x.title, x.from, x.to), h('figcaption', {}, h('b', {}, x.title), h('span', {}, x.body))))));
    // --- キャラ図鑑 ---
    const card = (lk, name, gear = NO_GEAR, i = 0) => {
        const c = pixelCanvas(PORTRAIT_W, PORTRAIT_H, 'lp-char-canvas', name);
        const ctx = ctx2d(c);
        let poke = -10;
        const el = h('li', { class: 'lp-char', tabindex: '0' }, c, h('span', {}, name));
        const pokeIt = () => { poke = performance.now() / 1000; };
        el.addEventListener('pointerenter', pokeIt);
        el.addEventListener('click', pokeIt);
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            pokeIt();
        } });
        ticker.add(c, (t) => {
            ctx.clearRect(0, 0, PORTRAIT_W, PORTRAIT_H);
            const since = t - poke;
            let action = 'idle', at = 0;
            if (since >= 0 && since < 0.7) {
                action = 'attack';
                at = since / 0.7;
            }
            else {
                const cyc = (t + i * 0.73) % 7; // ときどき、ぴょんと跳ねる
                if (cyc < 0.8) {
                    action = 'victory';
                    at = cyc / 0.8;
                }
            }
            drawHero(ctx, lk, gear, PORTRAIT_W / 2 + 2, PORTRAIT_H - 3, { frame: Math.floor(t * 60) + i * 17, action, t: at });
        });
        return el;
    };
    // 種族・職業・色・そうびを混ぜて、ひとつの並びに（分類はしない）
    const roster = [
        ['cat', '#e43b44', '#ffd166', 'sword', 'calico', NO_GEAR],
        ['knight', '#3a7bd5', '#f2c14e', 'sword', undefined, { back: [], fams: [{ kind: 'bird', color: '#5ab4ff' }], charms: [] }],
        ['bunny', '#ff9ce6', '#fbf7f0', 'wand', undefined, NO_GEAR],
        ['mage', '#7e57c2', '#ffd166', 'wand', undefined, { back: [], fams: [{ kind: 'ghost', color: '#c59bff' }], charms: [{ kind: 'moon', color: '#ffd23f' }] }],
        ['cat', '#3a7bd5', '#ffd166', 'dagger', 'black', NO_GEAR],
        ['ninja', '#2b2d42', '#63c74d', 'katana', undefined, NO_GEAR],
        ['bear', '#a0612a', '#ffd166', 'hammer', undefined, NO_GEAR],
        ['witch', '#5a3d8a', '#63c74d', 'scythe', undefined, { back: [], fams: [{ kind: 'kitten', color: '#ff9ce6' }], charms: [] }],
        ['frog', '#feae34', '#a8e04a', 'umbrella', undefined, NO_GEAR],
        ['samurai', '#e43b44', '#2b1d2e', 'katana', undefined, { back: [{ kind: 'bow' }], fams: [], charms: [{ kind: 'gem', color: '#ff5d8f' }] }],
        ['cat', '#feae34', '#ffd166', 'fan', 'tabby', NO_GEAR],
        ['robot', '#9aa0c8', '#5fcde4', 'blaster', undefined, { back: [], fams: [{ kind: 'drone', color: '#5fcde4' }], charms: [] }],
        ['priest', '#ece9f6', '#feae34', 'book', undefined, NO_GEAR],
        ['ghostie', '#c77dff', '#5fcde4', 'scythe', undefined, NO_GEAR],
        ['cat', '#5fcde4', '#ffd166', 'umbrella', 'siamese', NO_GEAR],
        ['pirate', '#a0612a', '#e43b44', 'blaster', undefined, { back: [{ kind: 'axe' }], fams: [], charms: [{ kind: 'bolt', color: '#ffd23f' }] }],
        ['cat', '#c77dff', '#9a9cb0', 'wand', 'tux', { back: [], fams: [{ kind: 'slime', color: '#6ee07a' }], charms: [] }],
        ['chef', '#ffffff', '#e43b44', 'pan', undefined, { back: [], fams: [{ kind: 'dragon', color: '#e43b44' }], charms: [{ kind: 'flame', color: '#ff7a3a' }] }],
        ['rogue', '#3d3d4a', '#e43b44', 'dagger', undefined, NO_GEAR],
        ['astro', '#5fcde4', '#ffffff', 'blaster', undefined, { back: [{ kind: 'spear' }], fams: [], charms: [] }],
    ];
    const chars = h('section', { class: 'lp-sec', id: 'lp-chars' }, h('h2', {}, tl('キャラ図鑑')), h('p', { class: 'lp-intro' }, tl('冒険者の見た目は自由に選べます。種族や職業、服の色、手に持つ武器、連れて歩くお供まで。強さには関係ないので、好きな姿で。')), h('div', { class: 'lp-dex win' }, h('ul', { class: 'lp-chars' }, ...roster.map(([b, p, hr, w, pat, gear], i) => card(look(b, p, hr, w, pat), pat === 'black' ? tl('黒ねこ') : pat ? tl(`ねこ（{0}）`, CAT_PATTERN_LABELS[pat]) : BODY_LABELS[b], gear, i)))));
    // --- ボス図鑑 ---
    const bosses = h('section', { class: 'lp-sec', id: 'lp-bosses' }, h('h2', {}, tl('シーズンのボス')), h('p', { class: 'lp-intro' }, tl('シーズンごとに、ちがうボスが現れます。ボスが変われば、役に立つ資料も道具もがらりと変わる。前のシーズンの心得は、そのままでは通じません。')), h('ul', { class: 'lp-bosses' }, ...BOSSES.slice(0, 3).map((b, i) => {
        const hidden = i > 0; // シーズン2・3は影だけ（まだ姿を見せない）
        const c = pixelCanvas(BW, BH, 'lp-boss-canvas', hidden ? tl(`{0}のボス（影）`, b.season) : b.name);
        const ctx = ctx2d(c);
        let anger = -10;
        const li = h('li', { class: `lp-boss win${hidden ? ' lp-boss-hidden' : ''}`, tabindex: '0' }, h('div', { class: 'lp-boss-art', style: { background: hidden ? 'linear-gradient(#2a2c44, #1a1b2c 70%, #121320 70%)' : `linear-gradient(${b.sky[1]}, ${b.sky[2]} 70%, ${b.ground[1]} 70%)` } }, c), h('p', { class: 'lp-boss-season' }, b.season), h('h3', {}, hidden ? tl('？？？') : b.name), h('p', {}, hidden ? tl('その姿は、まだだれも見ていない。') : b.line));
        const roar = () => { anger = performance.now() / 1000; };
        li.addEventListener('pointerenter', roar);
        li.addEventListener('focus', roar);
        ticker.add(c, (t) => {
            ctx.clearRect(0, 0, BW, BH);
            const a = t - anger < 1 && t >= anger ? 2 : 0;
            ctx.drawImage(bossCanvas(bossPose(t, i * 1.3, a), false, b.kind), 0, 0);
            if (hidden) {
                ctx.globalCompositeOperation = 'source-in';
                ctx.fillStyle = '#05060d';
                ctx.fillRect(0, 0, BW, BH);
                ctx.globalCompositeOperation = 'source-over';
            }
        });
        return li;
    }), (() => {
        // 4枠目: この先も、いろいろなボスが待っている（残りのボスの影を、遠くにうっすら並べる）
        const c = pixelCanvas(BW, BH, 'lp-boss-canvas', tl('この先のボスたちの影'));
        const ctx = ctx2d(c);
        const rest = BOSSES.slice(3);
        ticker.add(c, (t) => {
            ctx.clearRect(0, 0, BW, BH);
            rest.forEach((b, j) => {
                const sc = 0.5, x = (j % 2) * BW * 0.5, y = Math.floor(j / 2) * BH * 0.48 + 2;
                ctx.save();
                ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 1.1 + j);
                ctx.drawImage(bossCanvas(bossPose(t, j * 2.1), false, b.kind), x, y, BW * sc, BH * sc);
                ctx.restore();
            });
            ctx.globalCompositeOperation = 'source-in';
            ctx.fillStyle = '#0b0c18';
            ctx.fillRect(0, 0, BW, BH);
            ctx.globalCompositeOperation = 'source-over';
        });
        return h('li', { class: 'lp-boss win lp-boss-more' }, h('div', { class: 'lp-boss-art', style: { background: 'linear-gradient(#3a2f5a, #24203c 70%, #17152a 70%)' } }, c, h('span', { class: 'lp-boss-q', 'aria-hidden': 'true' }, '？')), h('p', { class: 'lp-boss-season' }, tl('そして、この先も')), h('h3', {}, tl('まだ見ぬボスたち')), h('p', {}, tl('シーズンが変わるたびに、新しいボスが現れます。海の底、砂の遺跡、霧の古城、吹雪の雪原……。いろいろなボスが、出番を待っています。')));
    })()));
    // --- ランキング ---
    const order = full.standings.slice().sort((a, b) => a.rank - b.rank);
    const rows = order.slice(0, 5).map((s) => {
        const f = full.fighters[s.f];
        return h('tr', {}, h('td', { class: 'lp-rank' }, `${s.rank}`), h('td', { class: 'lp-who' }, avatarCanvas(f.loadout, 1), h('span', {}, f.name)), h('td', {}, `${s.accuracy}%`), h('td', {}, `${Math.round(s.avgTokens).toLocaleString(localeOf())}`), h('td', {}, fmtMs(Math.round(s.avgLatencyMs))));
    });
    const ranking = h('section', { class: 'lp-sec', id: 'lp-rank' }, h('h2', {}, tl('ランキング')), h('div', { class: 'lp-rank-wrap' }, h('div', {}, h('p', {}, tl('順位を決めるのは、まず戦果。ボスの動きに正しく答えられた割合です。並んだときは、少ない言葉で済ませた冒険者（燃費）が上。それでも並んだら、答えるのが速いほうが上。')), h('ol', { class: 'lp-order' }, h('li', {}, h('b', {}, tl('戦果')), h('span', {}, tl('正しく動けた割合'))), h('li', {}, h('b', {}, tl('燃費')), h('span', {}, tl('使ったトークンが少ない'))), h('li', {}, h('b', {}, tl('速さ')), h('span', {}, tl('答えるまでの時間が短い')))), h('p', {}, tl('シーズン制なので、ボスが変わるたびに全員が同じところから再出発。'))), h('div', { class: 'win lp-board' }, h('h3', { class: 'win-title' }, tl(`見本の討伐の戦果`)), h('div', { class: 'lp-table-scroll' }, h('table', { class: 'lp-table' }, h('thead', {}, h('tr', {}, h('th', {}, tl('順位')), h('th', {}, tl('冒険者')), h('th', {}, tl('戦果')), h('th', {}, tl('燃費')), h('th', {}, tl('速さ')))), h('tbody', {}, ...rows))))));
    // --- 工夫・仕組み（ギルドマスターが語る） ---
    const gm = pixelCanvas(PORTRAIT_W, PORTRAIT_H, 'lp-gm-canvas', tl('ギルドマスター'));
    const gmCtx = ctx2d(gm);
    // ギルドマスターは、白いひげの魔法使いのおじいさん（紺のローブ・紫の帽子・杖）。ひげと眉は本体の上に描き足す
    ticker.add(gm, (t) => {
        gmCtx.clearRect(0, 0, PORTRAIT_W, PORTRAIT_H);
        const frame = Math.floor(t * 60), cx = PORTRAIT_W / 2 + 2, fy = PORTRAIT_H - 3;
        drawHero(gmCtx, GM_LOOK, GM_GEAR, cx, fy, { frame, action: 'idle' });
        elderBeard(gmCtx, cx, fy, poseFor('idle', 0, frame).bob);
    });
    const mech = [
        [tl('資料室から、何を選んで書くか'), tl('ギルドの資料室には、役に立つ資料もあれば、今回の戦いには関係のない資料も並んでおる。全部を持たせることはできんからのう。どれを選んで、どのように心得や巻物に書いてやるか。そこが、育て役のいちばんの腕の見せどころじゃよ。')],
        [tl('道具は、持たせるだけでは使われない'), tl('冒険者というのはのう、渡されただけの道具を、自分から使いこなしてはくれんものじゃ。いつ、何のために使うのか。それを心得で教えてやれば、ここぞという場面で手に取ってくれるじゃろう。')],
        [tl('かばんの重さには上限がある'), tl('心得の長さにも、道具にも、巻物にも、結界にも、それぞれ重さがあってな。上限を超えると、門から出してやれんのじゃ。なんでも詰めこんだ重い荷物より、よく選んだ軽い荷物のほうが強いこともある。よく考えてみるのじゃぞ。')],
        [tl('幻術を、結界で弾く'), tl('ボスはのう、偉い人の声をまねて、「作戦変更だ」などと、もっともらしい偽の命令を混ぜてくるのじゃ（プロンプトインジェクション）。結界を張っておけば、あやしい声は冒険者の耳に届く前に止まる。用心に越したことはないぞ。')],
        [tl('ギルドマスターの講評'), tl('冒険から戻ったら、わしが場面ごとの結果と、どこが良くて何が足りなかったかを書いて渡そう。冒険者が何を見て、どう考えたかの記録もたどれるからのう。それを手がかりに、次の手を考えるのじゃよ。')],
    ];
    const mechSec = h('section', { class: 'lp-sec', id: 'lp-mech' }, h('h2', {}, tl('工夫としくみ')), h('div', { class: 'lp-gm' }, h('div', { class: 'lp-gm-face' }, gm, h('span', {}, tl('ギルドマスター'))), h('div', { class: 'lp-gm-talk' }, ...mech.map(([t, body]) => h('div', { class: 'win lp-say' }, h('h3', {}, t), h('p', {}, body))))));
    // --- 最後の導線: ギルドの門で、冒険者たちが出発を待っている ---
    const cmd = (label, act, main = false) => h('li', {}, typeof act === 'string'
        ? h('a', { class: `lp-go${main ? ' lp-go-main' : ''}`, href: act }, label)
        : h('button', { class: 'lp-go', type: 'button', onclick: act }, label));
    const cta = h('section', { class: 'lp-cta', id: 'lp-start' }, h('div', { class: 'lp-cta-stage' }, h('div', { class: 'lp-cta-copy' }, h('p', { class: 'lp-cta-kicker' }, '― Agent Guild ―'), h('h2', { class: 'lp-cta-title' }, h('span', {}, tl('さぁ、')), h('span', {}, tl('冒険に出かけよう！')))), ctaScene(ticker)), h('div', { class: 'lp-cta-win win' }, h('p', { class: 'lp-cta-lead' }, tl('最初の冒険者を育てて、門の外へ送り出そう。プログラミングはいりません。画面で選んで、日本語で書くだけ。最初のひとりなら10分ほどで出発できます。')), playUrl ? null : h('p', { class: 'lp-cta-msg' }, h('b', {}, tl('ギルドの受付')), tl('遊ぶためのURLは、このページを教えてくれた人に聞いてください。')), h('ul', { class: 'lp-cta-cmd', 'aria-label': tl('コマンド') }, playUrl ? cmd(tl('はじめる'), playUrl, true) : null, cmd(tl('討伐をもう一度見る'), jump('lp-demo')), opts.demoUrl ? cmd(tl('デモで画面をさわる'), opts.demoUrl) : null, cmd(tl('図鑑をひらく'), jump('lp-chars')))));
    page.append(hero, about, howto, mechSec, demo, effects, chars, bosses, ranking, cta);
    root.replaceChildren(page);
}
//# sourceMappingURL=about.js.map