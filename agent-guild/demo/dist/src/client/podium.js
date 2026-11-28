// 表彰台の演出（討伐の再生のなかで、戦果1位の発表のあとに重ねて見せる）
//   日々: 「現時点の全体ランキング」。上位5人が左から表彰台へ駆けこみ、ぴょんと登って、武器を高く放り投げてキャッチする。
//   最終: 「最終結果発表」。終わったシーズンの上位10人（6位以下は表彰台の下に並ぶ）。みんなお酒を持って、1位はシャンパンを開ける。
// 床と背景は本物の舞台の絵のまま（加工しない）。キャラは本物と同じ描き方（drawHero）。絵はゲームの絵の単位（384x216）で描き、画面の1ドットに揃える。
import { ArenaRenderer } from './arena.js';
import { SCALE, clamp01, ease, lerp } from './arena-common.js';
import { drawHero, gearOf, handOf, lookOf, weaponSprite } from './hero.js';
import { outlined } from './sprites.js';
import { tl } from '../shared/i18n.js';
import { seasonRanking } from '../shared/party.js';
export const PODIUM_MIN_DAILY = 10; // 日々のランキング発表をやる、シーズンの参加者の最少人数の既定（管理画面で変える）
export const PODIUM_MIN_FINAL = 3; // 最終発表の最少人数（表彰台の3位まで）
const W = 768, H = 432;
const FONT = "'DotGothic16', monospace";
/** シーズンの順位の上位から、表彰台に立つ人を決める。出さないときは null（日々は人数が少ないとき・最終は少なすぎるとき） */
export function podiumPlan(entrants, cases, mode, minDaily = PODIUM_MIN_DAILY) {
    const n = entrants.length;
    if (n < (mode === 'final' ? PODIUM_MIN_FINAL : Math.max(PODIUM_MIN_FINAL, minDaily)))
        return null;
    // 点は順位表の戦果と同じ（%・小数1桁）
    return seasonRanking(entrants, cases).slice(0, mode === 'final' ? 10 : 5).map(({ e, score }) => ({
        name: e.name, team: e.loadout.team?.trim() ?? '', score: Math.round(score * 1000) / 10, look: lookOf(e.loadout), gear: { ...gearOf(e.loadout), charms: [] },
    }));
}
/** canvas に表彰台の場面を描く場面をつくる。bg は背景（ボスが消えたあとの舞台）に使う討伐の台本、revealAt は戦果1位の発表の時刻、snap は直前の画面（なめらかにつなぐため） */
export function createPodium(canvas, bg, revealAt, cands, mode, snap, plain = false) {
    const ctx = canvas.getContext('2d');
    const FINAL = mode === 'final';
    const topN = cands;
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = W;
    bgCanvas.height = H;
    const rb = new ArenaRenderer(bgCanvas, bg);
    rb.muted = true;
    rb.mine = new Set();
    rb.allWin = true;
    rb.winner = null;
    rb.camOverride = { mode: 'shot', x: bg.arena.w / 2, y: bg.arena.h / 2, z: 1 };
    rb.solo = -1;
    if (plain) { // 告知の画像用: 背景の画面の飾り（ボスの名前など）は出さない
        rb.bossBar = () => { };
        rb.gagOf = () => null;
        for (const k of ['progressBar', 'comboHud', 'chainDmg', 'mineBand', 'reserveStrip', 'youMarker'])
            rb[k] = () => { };
    }
    const LW = W / SCALE, BW = 34, DX = 6, DY = 5, PX0 = LW - BW * 5 - 14;
    const BASE = FINAL ? 162 : 190; // 最終発表は、下に6〜10位が並ぶので少し上げる
    const FLOOR_Y = 198; // 6〜10位が立つ床の線
    const floorX = (rank) => PX0 + BW / 2 + (10 - rank) * BW; // 10位が左、6位が右
    const HT = [0, 48, 38, 30, 23, 17]; // 順位 → 高さ
    const SLOT = [0, 2, 1, 3, 0, 4]; // 順位 → 左から何番目か（4 2 1 3 5 の並び）
    const COL = ['', '#ffd166', '#d5dcec', '#d9915a', '#7fa6d9', '#7fa6d9'];
    const FACE = ['', '#6b5a2a', '#4b5470', '#6a4a35', '#34456b', '#34456b']; // 正面の色
    const TOP = ['', '#f3d98a', '#e8edf7', '#efb98c', '#a9c4ea', '#a9c4ea']; // 上の面
    const SIDE = ['', '#3f3318', '#2c3348', '#3d2b1f', '#1f2a45', '#1f2a45']; // 右の面
    const bx = (rank) => PX0 + SLOT[rank] * BW;
    const slotX = (rank) => bx(rank) + BW / 2;
    const topY = (rank) => BASE - HT[rank];
    const TITLE = 0.6, T_RISE = TITLE + 0.7, GAP2 = 0.42, RUN = 0.95, JUMP = 0.5, TOSS = 1.6;
    // 5位からだんだん間をあけて、1位をもったいぶる（その順位が出てから、次の順位が出るまでの秒数）
    const GAP_AFTER = { 5: 1.0, 4: 1.3, 3: 1.8, 2: 2.6 };
    const startAt = (rank) => {
        let t = T_RISE;
        for (let r = FINAL ? 10 : 5; r > rank; r--)
            t += r >= 6 ? GAP2 : GAP_AFTER[r];
        return t;
    };
    const landAt = (rank) => startAt(rank) + RUN + (rank >= 6 ? 0 : JUMP);
    const tEnd = () => landAt(1) + (FINAL ? 8.2 : 4.8);
    function poly(pts, col) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (const q of pts.slice(1))
            ctx.lineTo(q[0], q[1]);
        ctx.closePath();
        ctx.fill();
    }
    function drawBlock(rank, rise) {
        const h = HT[rank] * rise, x = bx(rank), y = BASE - h, w = BW - 1;
        // 右の面（暗い）
        poly([[x + w, y], [x + w + DX, y - DY], [x + w + DX, BASE - DY], [x + w, BASE]], SIDE[rank]);
        // 正面（上が明るい縦のグラデーション）
        const g = ctx.createLinearGradient(0, y, 0, BASE);
        g.addColorStop(0, FACE[rank]);
        g.addColorStop(1, '#1c2040');
        ctx.fillStyle = g;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.fillRect(x, y, 2, h); // 左のふち（光が当たる）
        // 上の面（いちばん明るい）
        poly([[x, y], [x + DX, y - DY], [x + w + DX, y - DY], [x + w, y]], TOP[rank]);
        ctx.fillStyle = COL[rank];
        ctx.fillRect(x, y, w, 1); // 手前のへりを順位の色で光らせる
        // 左となりが高いときは、その影が上の面に落ちる
        const left = SLOT[rank] > 0 ? [1, 2, 3, 4, 5].find((r) => SLOT[r] === SLOT[rank] - 1) : 0;
        if (left && HT[left] > HT[rank]) {
            const sw = Math.min(w, (HT[left] - HT[rank]) * 0.5);
            ctx.globalAlpha = 0.35;
            poly([[x, y], [x + DX, y - DY], [x + DX + sw, y - DY], [x + sw, y]], '#05060d');
            ctx.globalAlpha = 1;
        }
    }
    function drawPodiumBase(rise) {
        // 床に落ちる影（右下へのびる）と、台座
        ctx.fillStyle = 'rgba(0,0,0,0.38)';
        ctx.beginPath();
        ctx.moveTo(PX0 - 2, BASE);
        ctx.lineTo(PX0 + BW * 5 + DX, BASE - DY);
        ctx.lineTo(PX0 + BW * 5 + DX + 16 * rise, BASE + 4);
        ctx.lineTo(PX0 + 6, BASE + 6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#171a33';
        ctx.fillRect(PX0 - 3, BASE, BW * 5 + 5, 3);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(PX0 - 3, BASE, BW * 5 + 5, 1);
    }
    function drawPlate(rank, rise) {
        if (rise < 0.6)
            return;
        const cx = bx(rank) + BW / 2 - 0.5, cy = topY(rank) + Math.min(14, HT[rank] - 6);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.arc(cx + 0.6, cy + 0.8, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = COL[rank];
        ctx.beginPath();
        ctx.arc(cx, cy, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.arc(cx - 1.5, cy - 2, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.font = `${Math.round(9 * SCALE)}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#1a1530';
        ctx.fillText(String(rank), cx * SCALE, cy * SCALE + 1);
        ctx.restore();
    }
    function label(text, x, y, col, size = 12) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.font = `${size}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const w = ctx.measureText(text).width + 12;
        ctx.fillStyle = 'rgba(13,16,34,0.82)';
        ctx.fillRect(Math.round(x - w / 2), Math.round(y - 11), Math.round(w), 22);
        ctx.fillStyle = col;
        ctx.fillRect(Math.round(x - w / 2), Math.round(y + 10), Math.round(w), 2);
        ctx.fillStyle = '#ece9f6';
        ctx.fillText(text, Math.round(x), Math.round(y));
        ctx.restore();
    }
    function dust(x, y, u) {
        if (u < 0 || u > 1)
            return;
        ctx.globalAlpha = (1 - u) * 0.7;
        ctx.fillStyle = '#d8d2e6';
        for (const d of [-1, 1]) {
            const px = x + d * (4 + u * 9), py = y - u * 5;
            ctx.fillRect(Math.round(px - 2), Math.round(py - 2), 4 - Math.round(u * 2), 3);
        }
        ctx.globalAlpha = 1;
    }
    const ITEM = ['beer', 'bottle', 'wine', 'beer', 'flute', 'beer', 'wine', 'flute', 'beer', 'wine', 'beer']; // 順位 → 持ち物（1位はシャンパンのボトル）
    // 武器と同じ作り（格子の絵＋陰影＋ふち）。anchor は手で握る所
    const DRINK_COLORS = {
        h: '#ffffff', v: '#dcecf7', V: '#8fb2c9', w: '#fff6dc', W: '#e0cf9d', b: '#ffd45e', a: '#f0a22a', c: '#bf7413',
        r: '#a3213f', R: '#6b0f2b', y: '#f7de86', Y: '#d8b449', d: '#12391f', l: '#1f6b3d', L: '#44a068', D: '#0b2514', g: '#f7d26a', G: '#c08a2a', k: '#2b2d42', m: '#f3e7c0',
    };
    const DRINK = {
        // ジョッキ: 泡・ガラスのふち・ビールの濃淡・持ち手
        beer: { anchor: [11, 5], grid: ['.ww.www.....', 'wwwwwwwww...', 'wWwwWwwWw...', 'vvvvvvvvvVV.', 'vhbbbbaavV.V', 'vhbbabaavV.V', 'vhbbbbaavV.V', 'vhbabbaavVVV', 'vhbbbaaavV..', 'vhbbaaaccV..', 'vcccccccVV..', 'VVVVVVVVV...'] },
        // ワイングラス: 赤ワインの濃淡・ガラスの照り・脚と台
        wine: { anchor: [4, 8], grid: ['.vvvvvvv.', 'vhrrrrrvV', 'vhrrRrrvV', 'vrrRRRrvV', '.vrRRRrV.', '..vrrrV..', '...vvV...', '....v....', '....V....', '....V....', '.vvvvvvV.', '..VVVVV..'] },
        // シャンパンフルート: 細長いグラスに金の泡
        flute: { anchor: [2, 9], grid: ['.vvv.', 'vhyyV', 'vhyyV', 'vybyV', 'vyyyV', 'vyyyV', 'vybyV', '.vyV.', '..v..', '..V..', '..V..', '.vvVV'] },
        // シャンパンのボトル: 金の口金・深緑のガラス・ラベル
        bottle: { anchor: [3, 11], grid: ['...g...', '..ggg..', '..gGg..', '..ddd..', '..dld..', '..dld..', '.ddldd.', 'ddlllld', 'dLlllld', 'dLlllld', 'dLmmmld', 'dLmkmld', 'dLmmmld', 'dLlllld', 'dLlllld', 'dlllllD', 'DDDDDDD'] },
    };
    function drawItem(kind, x, y, tilt, flip) {
        const d = DRINK[kind], ws = outlined(`drink2:${kind}`, d.grid, DRINK_COLORS, '#26202e', flip);
        const gx = flip ? ws.width - 1 - (d.anchor[0] + 1) : d.anchor[0] + 1;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(tilt);
        ctx.drawImage(ws, -gx, -(d.anchor[1] + 1));
        ctx.restore();
    }
    function star(x, y, a) {
        ctx.globalAlpha = Math.min(1, a);
        ctx.fillStyle = '#ffffff';
        const r = 3 + Math.round(a * 3);
        ctx.fillRect(Math.round(x - r), Math.round(y), r * 2 + 1, 1);
        ctx.fillRect(Math.round(x), Math.round(y - r), 1, r * 2 + 1);
        ctx.fillStyle = '#ffe9a8';
        ctx.fillRect(Math.round(x - 1), Math.round(y - 1), 3, 3);
        ctx.globalAlpha = 1;
    }
    function spray(x, y, tau) {
        if (tau < 0)
            return;
        const cork = Math.min(tau, 1.2);
        if (tau < 1.2) {
            ctx.fillStyle = '#c9a36a';
            ctx.fillRect(Math.round(x + 2 + cork * 6), Math.round(y - 4 - (cork * 48 - cork * cork * 40)), 2, 2);
        }
        for (let i = 0; i < 26; i++) {
            const seed = (i * 37 % 17) / 17, vx = -10 + seed * 26, vy = 34 + (i * 53 % 23) * 1.6, tt = tau - (i % 7) * 0.05;
            if (tt < 0 || tt > 1.3)
                continue;
            const px = x + vx * tt * 0.7, py = y - (vy * tt - 38 * tt * tt);
            ctx.globalAlpha = Math.max(0, 1 - tt / 1.3);
            ctx.fillStyle = i % 3 ? '#fff7d6' : '#ffe08a';
            ctx.fillRect(Math.round(px), Math.round(py), 2, 2);
        }
        ctx.globalAlpha = 1;
    }
    function draw(t) {
        const now = performance.now() / 1000;
        rb.frame = Math.floor(now * 12);
        rb.draw(revealAt - 0.02);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(rb.canvas, 0, 0, W, H);
        ctx.fillStyle = 'rgba(5,6,13,0.2)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#05060d';
        ctx.fillRect(0, 0, W, 42); // 倒したボスの体力バーを隠す帯
        if (t < 0.7) {
            ctx.globalAlpha = 1 - t / 0.7;
            ctx.drawImage(snap, 0, 0);
            ctx.globalAlpha = 1;
        }
        ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0); // ここから先は、ゲームの絵の単位
        ctx.imageSmoothingEnabled = false; // ぼやけ防止（本物の画面と同じくっきりさ）
        const rise = ease(clamp01((t - TITLE - 0.1) / (T_RISE - TITLE - 0.1)));
        if (rise > 0)
            drawPodiumBase(rise);
        for (const r of [4, 2, 1, 3, 5])
            if (rise > 0)
                drawBlock(r, rise); // 左から右へ（右の面は、となりの正面が覆う）
        for (let r = 1; r <= 5; r++)
            if (rise > 0)
                drawPlate(r, rise);
        // 走る・跳ぶ・ポーズ
        const marks = [];
        const cu = t - (landAt(1) + 0.7); // 乾杯の時計
        for (const rank of FINAL ? [10, 9, 8, 7, 6, 5, 4, 3, 2, 1] : [5, 4, 3, 2, 1]) { // 発表は下の順位から（描く順も、あとの人が手前）
            const c = topN[rank - 1];
            if (!c)
                continue; // 人数が少ない最終発表は、いる人だけ
            const u = t - startAt(rank);
            if (u < 0)
                continue;
            const low = rank >= 6; // 6位以下は、表彰台の下の床に並ぶ（登らない）
            const J = low ? 0 : JUMP;
            const tx = low ? floorX(rank) : slotX(rank), ty = low ? FLOOR_Y : topY(rank) - 2, runY = low ? FLOOR_Y : BASE + 12 + (rank % 2) * 5, jx = low ? tx : tx - 22;
            const fr = Math.floor(now * 30) + rank * 7;
            // くっきり描く: 座標は、画面の1ドットに揃える
            const hero = (x, y, d) => {
                const X = Math.round(x * SCALE) / SCALE, Y = Math.round(y * SCALE) / SCALE;
                drawHero(ctx, c.look, c.gear, X, Y, { ...d, ...(FINAL ? { hideWeapon: true } : {}) });
                return X;
            };
            const held = (x, y, d, raise = 0, tilt = 0) => {
                if (!FINAL)
                    return;
                const hp = handOf(Math.round(x * SCALE) / SCALE, Math.round(y * SCALE) / SCALE, d);
                drawItem(ITEM[rank], Math.round(hp.x), Math.round(hp.y - raise), tilt, !d.flip); // 絵は左に本体・右に持ち手。左向きは絵をそのまま（本体が外側）、右向きは反転
            };
            if (u < RUN) { // 左から駆けこむ（右向き。足は速く）
                const k = u / RUN, x = lerp(-18, jx, k * 0.85 + ease(k) * 0.15), rf = Math.floor(now * 66) + rank * 7;
                const d = { frame: rf, action: 'walk', t: (rf / 8) % 1 }, y = runY - Math.abs(Math.sin(u * 22)) * 1.4;
                hero(x, y, d);
                held(x, y, d);
            }
            else if (u < RUN + J) { // ぴょんと登る（空中で、いつもの左向きへ）
                const k = (u - RUN) / JUMP, x = lerp(jx, tx, ease(k)), y = lerp(runY, ty, k) - Math.sin(k * Math.PI) * 30;
                const d = { frame: fr, action: 'victory', t: 0.25 + k * 0.5, flip: k > 0.45 };
                hero(x, y, d);
                held(x, y, d);
            }
            else {
                const v = u - RUN - J, land = v < 0.12 ? Math.sin((v / 0.12) * Math.PI) : 0;
                const y = ty + land;
                if (FINAL) { // 乾杯: 腕を上げて、お酒をかかげる。ちん！のたびにきらめく
                    const d = { frame: fr, flip: true, action: 'victory', t: (fr % 36) / 36 };
                    let raise = 0, tilt = 0, glint = 0;
                    if (cu > 0) {
                        const k = (cu % 0.95) / 0.95;
                        raise = Math.sin(k * Math.PI) * 5;
                        tilt = -Math.sin(k * Math.PI) * 0.5;
                        glint = Math.max(0, 1 - Math.abs(k - 0.5) / 0.1);
                    }
                    hero(tx, y, d);
                    held(tx, y, d, raise, tilt);
                    const hp = handOf(Math.round(tx * SCALE) / SCALE, Math.round(y * SCALE) / SCALE, d);
                    if (glint > 0)
                        star(hp.x - 2, hp.y - 14 - raise, glint);
                    if (rank === 1 && cu > 0.4)
                        spray(hp.x, hp.y - 14 - raise, cu - 0.4);
                }
                else { // 武器を高く放り投げて、キャッチ（1位はもっと高く・もっと回す）
                    const fu = v / TOSS, big = rank === 1;
                    let d = { frame: fr, flip: true, action: 'victory', t: (fr % 36) / 36 };
                    if (fu < 0.18) {
                        d = { frame: fr, flip: true, action: 'guard', t: fu / 0.18 };
                        hero(tx, y + 0.5, d);
                    }
                    else if (fu < 0.86) {
                        const w = (fu - 0.18) / 0.68, h = (big ? 64 : 46) * 4 * w * (1 - w);
                        d = { frame: fr, flip: true, action: 'victory', t: 0.25 };
                        const X = hero(tx, y - (fu < 0.3 ? 1 : 0), { ...d, hideWeapon: true });
                        const hp = handOf(X, y, d), ws = weaponSprite(c.look.weapon, c.gear.weaponColor, true);
                        ctx.save();
                        ctx.translate(Math.round(hp.x), Math.round(hp.y - 5 - h));
                        ctx.rotate(-w * Math.PI * 2 * (big ? 3 : 2));
                        ctx.drawImage(ws, -Math.floor(ws.width / 2), -Math.floor(ws.height / 2));
                        ctx.restore();
                    }
                    else if (fu < 1) {
                        const k = (fu - 0.86) / 0.14;
                        d = { frame: fr, flip: true, action: 'attack', t: 0.2 + k * 0.3 };
                        const X = hero(tx, y, d);
                        if (k < 0.5) {
                            const hp = handOf(X, y, d);
                            star(hp.x, hp.y - 4, 1 - k * 2);
                        }
                    }
                    if (fu >= 1) {
                        const hop = big ? Math.abs(Math.sin((v - TOSS) * 5)) * 3 : 0;
                        hero(tx, y - hop, { frame: fr, flip: true, action: 'victory', t: (fr % 36) / 36 });
                    }
                }
                dust(tx, ty + 1, v / 0.3);
                marks.push({ x: tx, y: ty, r: rank });
                for (let q = 0; q < (rank === 1 ? 8 : 4); q++) { // きらめき（1位は多め）
                    const kk = (v * 0.8 + q / 8) % 1, ang = q * 2.4 + rank;
                    ctx.globalAlpha = Math.sin(kk * Math.PI) * 0.9;
                    ctx.fillStyle = q % 2 ? '#ffe9a8' : '#ffffff';
                    ctx.fillRect(Math.round(tx + Math.cos(ang) * (9 + kk * 13)), Math.round(ty - 14 + Math.sin(ang) * (6 + kk * 11) - kk * 5), 2, 2);
                }
                ctx.globalAlpha = 1;
            }
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        for (const m of marks) { // 頭の上は点だけ（6位以下は、足もとに順位）
            if (m.r >= 6) {
                label(tl('{0}位', m.r), m.x * SCALE, (m.y + 8) * SCALE, '#7fa6d9', 11);
                continue;
            }
            label(`${topN[m.r - 1].score}`, m.x * SCALE, (m.y - 34) * SCALE - (m.r === 1 ? 6 : 0), COL[m.r], 12);
        }
        // 左の順位表（5位から先に、いちばん下の行から出る）
        if (marks.length) {
            const rows = FINAL ? 10 : 5, rowH = FINAL ? 24 : 28, top = 52, headH = 46;
            ctx.fillStyle = 'rgba(13,16,34,0.86)';
            ctx.fillRect(28, top, 330, headH + rowH * rows + 8);
            ctx.fillStyle = '#ffd166';
            ctx.fillRect(28, top, 330, 3);
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'left';
            const title = FINAL ? tl('最終結果発表') : tl('現時点の全体ランキング'); // 見出しは大きく・金色で
            ctx.font = `${FINAL ? 26 : 22}px ${FONT}`;
            ctx.lineWidth = 5;
            ctx.strokeStyle = '#3a1a00';
            ctx.strokeText(title, 42, top + 25);
            ctx.fillStyle = '#ffd166';
            ctx.fillText(title, 42, top + 25);
            ctx.fillStyle = 'rgba(255,209,102,0.5)';
            ctx.fillRect(42, top + headH - 3, 302, 1);
            for (const m of marks) {
                const c = topN[m.r - 1], yy = top + headH + 4 + (m.r - 1) * rowH + rowH / 2, since = t - landAt(m.r);
                ctx.globalAlpha = clamp01(since / 0.25);
                ctx.fillStyle = COL[m.r] ?? '#7fa6d9';
                ctx.font = `${FINAL ? 17 : 20}px ${FONT}`;
                ctx.fillText(String(m.r), 44, yy);
                ctx.fillStyle = '#ece9f6';
                ctx.font = `${FINAL ? 14 : 15}px ${FONT}`;
                ctx.fillText(c.name, 70, yy);
                ctx.fillStyle = '#9aa0c8';
                ctx.font = `${FINAL ? 11 : 12}px ${FONT}`;
                ctx.fillText(c.team, 214, yy);
                ctx.textAlign = 'right';
                ctx.fillStyle = COL[m.r] ?? '#7fa6d9';
                ctx.fillText(String(c.score), 346, yy);
                ctx.textAlign = 'left';
                ctx.globalAlpha = 1;
            }
        }
        if (FINAL && cu > 0) { // 討伐完了！
            const k = clamp01(cu / 0.3), bounce = 1 + Math.sin(Math.min(1, cu / 0.5) * Math.PI) * 0.18, a = clamp01(cu / 0.2);
            ctx.save();
            ctx.translate(slotX(1) * SCALE, 78);
            ctx.scale(bounce * (0.6 + k * 0.4), bounce * (0.6 + k * 0.4));
            ctx.globalAlpha = a;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `42px ${FONT}`;
            ctx.lineWidth = 7;
            ctx.strokeStyle = '#3a1a00';
            ctx.strokeText(tl('討伐完了！'), 0, 0);
            ctx.fillStyle = '#ffd166';
            ctx.fillText(tl('討伐完了！'), 0, 0);
            ctx.font = `22px ${FONT}`;
            ctx.lineWidth = 5;
            ctx.strokeText(tl('入賞おめでとう！'), 0, 42);
            ctx.fillStyle = '#ece9f6';
            ctx.fillText(tl('入賞おめでとう！'), 0, 42);
            ctx.restore();
        }
        return t > tEnd();
    }
    return { draw, get duration() { return tEnd(); } };
}
//# sourceMappingURL=podium.js.map