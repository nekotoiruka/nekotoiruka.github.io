import { WAVE_SECONDS, clamp01, ease, lerp } from './arena-common.js';
import { drawHero, muzzleOf } from './hero.js';
import { text } from './ultkit.js';
import { PIXEL_FONT, tl } from '../shared/i18n.js';
const BOSS_IN = [0.2, 1.6]; // ボスが闇から浮かぶ
const NAME = [0.9, 3.0]; // ボスの名前
const FIRST = 2.3; // 1人目が駆けこみ始める
const STEP = 0.42; // 次の人まで
const RUN = 0.55; // 画面の右から立ち位置まで
const MINE_GAP = 0.35; // あなたの前の、ひと呼吸
const HOLD = 1.5; // 全員がそろってから「討伐開始！」までのタメ（画面が締まり、一斉に構える）
const FLOURISH = 0.9; // 武器さばきの長さ（駆けこんで立ち止まった直後に、ひとりずつ）
const CROUCH = 0.35; // タメに入ってから、腰を落として構えるまで
const GO = 1.2; // 「討伐開始！」を出している長さ
/** 駆けこむ順と時刻（舞台に立つ人はボスに近い立ち位置から。あなたは最後）。控えの人は帯だけ */
export function introPlan() {
    const key = [...this.mine].join(',');
    if (this.introCache?.key === key)
        return this.introCache;
    const fs = this.script.fighters.map((f, i) => ({ f, i }));
    const mine = (i) => this.mine.has(i);
    const stage = fs.filter((x) => !x.f.off).sort((a, b) => Number(mine(a.i)) - Number(mine(b.i)) || a.f.slot.x - b.f.slot.x || a.f.slot.y - b.f.slot.y);
    const reserve = fs.filter((x) => x.f.off);
    const at = new Map();
    const bands = [];
    let t = FIRST;
    const others = stage.filter((x) => !mine(x.i)), me = stage.filter((x) => mine(x.i));
    for (const x of others) {
        at.set(x.i, t);
        bands.push({ f: x.i, at: t + RUN * 0.6 });
        t += STEP;
    }
    for (const x of reserve) {
        bands.push({ f: x.i, at: t });
        t += STEP * 0.5;
    } // 控えの人も名前だけは流す
    if (me.length)
        t += MINE_GAP;
    for (const x of me) {
        at.set(x.i, t);
        bands.push({ f: x.i, at: t + RUN * 0.6 });
        t += STEP + 0.3;
    }
    const hold = t - STEP + RUN + FLOURISH + 0.35; // 最後の人（あなた）が武器さばきを決めて、ひと呼吸
    const go = hold + HOLD;
    this.introCache = { key, at, bands, hold, go, len: (go + GO) / WAVE_SECONDS };
    return this.introCache;
}
/** 幕開けの長さ（場面の数で数えた長さ。再生はここをマイナスの時刻に置く） */
export function introLen() { return this.introPlan().len; }
/** ボスが闇から浮かび上がる（drawBoss をそのまま、透明度と高さだけ変えて） */
export function introBoss(ctx, draw) {
    const s = this.intro.s;
    const a = ease(clamp01((s - BOSS_IN[0]) / (BOSS_IN[1] - BOSS_IN[0])));
    if (a <= 0)
        return;
    const { x, y } = this.bossFoot;
    // 足元の闇の渦
    ctx.save();
    ctx.globalAlpha = 0.55 * Math.min(1, a * 2) * (1 - Math.max(0, a - 0.7) / 0.3 * 0.5);
    ctx.fillStyle = '#2a0f3a';
    ctx.beginPath();
    ctx.ellipse(x + 8, y, 46 + Math.sin(this.frame / 7) * 2, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // ボスの絵は自分で透明度を決めるので、別の画面に描いてから重ねる
    const cv = ctx.canvas;
    if (!this.introLayer || this.introLayer.width !== cv.width || this.introLayer.height !== cv.height) {
        this.introLayer = document.createElement('canvas');
        this.introLayer.width = cv.width;
        this.introLayer.height = cv.height;
    }
    const lc = this.introLayer.getContext('2d');
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.clearRect(0, 0, cv.width, cv.height);
    lc.setTransform(ctx.getTransform());
    lc.imageSmoothingEnabled = false;
    lc.translate(0, Math.round((1 - a) * 14));
    draw(lc);
    // タメ: ボスの体のふちが赤く燃え立つ（討伐隊の構えに応じて、ボスも殺気を放つ）
    const plan = this.introPlan();
    const rage = clamp01((s - plan.hold - 0.2) / 0.5) * clamp01(1 - (s - plan.go) / 0.4);
    if (rage > 0) {
        if (!this.introGlow || this.introGlow.width !== cv.width || this.introGlow.height !== cv.height) {
            this.introGlow = document.createElement('canvas');
            this.introGlow.width = cv.width;
            this.introGlow.height = cv.height;
        }
        const gc = this.introGlow.getContext('2d');
        gc.globalCompositeOperation = 'source-over';
        gc.clearRect(0, 0, cv.width, cv.height);
        gc.drawImage(this.introLayer, 0, 0);
        gc.globalCompositeOperation = 'source-in';
        gc.fillStyle = '#ff2438';
        gc.fillRect(0, 0, cv.width, cv.height);
        const px = cv.width / this.script.arena.w; // 1ドットの大きさ
        const pulse = 0.75 + 0.25 * Math.sin(this.frame / 3);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'lighter';
        for (const [dx, dy, al] of [[-2, 0, 0.6], [2, 0, 0.6], [0, -2, 0.6], [0, 2, 0.4], [-3, -3, 0.3], [3, -3, 0.3], [0, -5, 0.25]]) {
            ctx.globalAlpha = rage * pulse * al;
            ctx.drawImage(this.introGlow, Math.round(dx * px), Math.round(dy * px - (this.frame % 6) * px * 0.3)); // ゆらめいて立ちのぼる
        }
        ctx.restore();
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = a;
    ctx.drawImage(this.introLayer, 0, 0);
    ctx.restore();
    if (rage > 0)
        this.lights.push({ x: this.bossBody.x, y: this.bossBody.y - 10, r: 90, a: rage * 0.9, col: '#ff3040' });
    // 目が光る（姿が見えきる少し前）
    const eye = clamp01(1 - Math.abs(s - (BOSS_IN[1] - 0.15)) / 0.25);
    if (eye > 0)
        this.lights.push({ x: this.bossBody.x - 6, y: this.bossBody.y - 22, r: 30, a: eye, col: '#ff3a4a' });
}
/** 討伐隊の1人: 画面の右から自分の立ち位置まで駆けこむ */
export function introFighter(ctx, v) {
    const plan = this.introPlan();
    const a = plan.at.get(v.f);
    if (a === undefined)
        return;
    const s = this.intro.s;
    if (s < a)
        return;
    const k = clamp01((s - a) / RUN);
    const x = Math.round(lerp(this.script.arena.w + 24, v.x, ease(k)));
    const own = this.mine.has(v.f);
    const gear = { ...this.gears[v.f], fams: [], ...(own ? {} : { charms: [] }) };
    // 駆けこんで立ち止まったら、武器ごとの武器さばきでポーズ（ここから頑張るぞ）。タメでは、ボスに近い人から順に腰を落として構える
    const lag = clamp01((v.x - 200) / 180) * 0.35;
    const fu = (s - a - RUN - 0.05) / FLOURISH; // 武器さばきの進み 0→1（立ち止まった直後）
    const brace = clamp01((s - plan.hold - CROUCH - lag * 0.5) / 0.25);
    let pose = { act: k < 1 ? 'walk' : 'idle', t: ((this.frame + v.f * 5) / 8) % 1, wRot: 0, oy: 0, ox: 0 };
    if (k >= 1 && brace > 0)
        pose = { act: 'guard', t: brace, wRot: 0, oy: Math.round(ease(brace) * 1.5), ox: 0 };
    else if (k >= 1 && fu > 0 && fu < 1)
        pose = flourish(this.looks[v.f].weapon, fu);
    drawHero(ctx, this.looks[v.f], gear, x + pose.ox, v.y + 1 + pose.oy, { frame: this.frame + v.f * 7, flip: true, action: pose.act, t: pose.t, wRot: pose.wRot });
    if (k >= 1 && fu > 0 && fu < 1 && brace <= 0)
        flourishFx(ctx, this.looks[v.f], x, v.y + 1, fu, this.colors[v.f]?.main ?? '#ffd166', this.frame + v.f * 7);
    if (k >= 1)
        this.dust(ctx, v.x, v.y, (s - a - RUN) / 0.25); // 立ち止まった足元に砂ぼこり
    const pet = this.gears[v.f].fams[0];
    if (pet)
        this.petFx(ctx, v, pet, x, v.y, undefined, 0, { alpha: 1, own, busy: k < 1 });
    if (own && k >= 1)
        this.youMarker(v.x, v.y - 40);
}
/** 画面の文字: ボスの名前 → 参戦の帯 → 討伐開始！（画面座標） */
export function introHud(ctx) {
    const s = this.intro.s;
    const { w: AW, h: AH } = this.script.arena;
    const plan = this.introPlan();
    // ボスの名前（上の真ん中。帯が左から差しこむ）
    const n = Math.min(clamp01((s - NAME[0]) / 0.25), clamp01((NAME[1] - s) / 0.35));
    if (n > 0) {
        const slide = ease(clamp01((s - NAME[0]) / 0.3));
        const y = 42, h = 40, x = lerp(-AW * 0.3, 0, slide);
        ctx.save();
        ctx.globalAlpha = n;
        const g = ctx.createLinearGradient(0, 0, AW, 0);
        g.addColorStop(0, 'rgba(10,8,20,0)');
        g.addColorStop(0.2, 'rgba(10,8,20,0.88)');
        g.addColorStop(0.8, 'rgba(10,8,20,0.88)');
        g.addColorStop(1, 'rgba(10,8,20,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x, y, AW, h);
        ctx.fillStyle = '#ff5a6a';
        ctx.fillRect(x + AW * 0.2, y, AW * 0.6, 1);
        ctx.fillRect(x + AW * 0.2, y + h - 1, AW * 0.6, 1);
        ctx.restore();
        text(ctx, tl('討伐対象'), x + AW / 2, y + 11, 8, '#ffb3bb', n);
        const name = this.script.theme?.title ?? this.script.boss.name;
        ctx.font = `16px ${PIXEL_FONT}`;
        const size = Math.max(10, Math.min(16, Math.floor(16 * (AW * 0.8) / Math.max(1, ctx.measureText(name).width)))); // 長い名前は少しだけ小さく
        text(ctx, name, x + AW / 2, y + 26, size, '#ffffff', n, '#5a0f1e');
    }
    // 参戦の帯（左下に積む。新しいものが下。見えるのは直近の4つ）
    const shown = plan.bands.filter((b) => s >= b.at && s < b.at + 2.4).slice(-4);
    const go = s >= plan.go;
    shown.forEach((b, i) => {
        const age = s - b.at;
        const fade = s >= plan.hold ? clamp01(1 - (s - plan.hold) / 0.3) : clamp01((2.4 - age) / 0.4); // タメに入ったら帯は消す
        const slide = ease(clamp01(age / 0.18));
        const fi = this.script.fighters[b.f];
        const team = fi.loadout.team?.trim();
        const own = this.mine.has(b.f);
        const msg = team ? tl('{0}から{1}が参戦！', team, fi.name) : tl('{0}が参戦！', fi.name);
        const size = 8, h = 12;
        const y = AH - 22 - (shown.length - 1 - i) * 15; // 帯どうしのあいだを 3 ドットあける
        ctx.save();
        ctx.font = `${size}px ${PIXEL_FONT}`;
        const wdt = Math.min(AW * 0.7, ctx.measureText(msg).width + 18);
        const x = lerp(-wdt, 4, slide);
        ctx.globalAlpha = fade;
        ctx.fillStyle = own ? 'rgba(60,40,8,0.92)' : 'rgba(10,8,20,0.85)';
        ctx.fillRect(x, y - h / 2, wdt, h);
        ctx.fillStyle = own ? '#ffd166' : '#6ab8ff';
        ctx.fillRect(x, y - h / 2, 2, h);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.font = `${size}px ${PIXEL_FONT}`;
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#1a1c2c';
        ctx.fillText(msg, Math.round(x + 9) + 1, Math.round(y) + 1, wdt - 14);
        ctx.fillStyle = own ? '#ffe9a0' : '#ffffff';
        ctx.fillText(msg, Math.round(x + 9), Math.round(y), wdt - 14);
        ctx.restore();
    });
    // タメ: 上下から黒い帯が迫って画面が締まり、ボスの目が光る → 「討伐開始！」が叩きつけられる（白い閃光・揺れ）
    const hk = s - plan.hold;
    if (hk > 0) {
        const bar = Math.round(16 * ease(clamp01(hk / 0.5)) * (1 - ease(clamp01((s - plan.go - 0.5) / 0.4))));
        if (bar > 0) {
            ctx.fillStyle = '#05040a';
            ctx.fillRect(0, 0, AW, bar);
            ctx.fillRect(0, AH - bar, AW, bar);
        }
    }
    if (go) {
        const k = s - plan.go;
        const a = Math.min(clamp01(k / 0.06), clamp01((GO - k) / 0.3));
        const z = 1 + (1 - ease(clamp01(k / 0.14))) * 1.4; // 大きく叩きつけてから、決まった大きさで止まる
        const jit = k > 0.14 && k < 0.4 && this.frame % 2 ? (this.frame % 4) - 1.5 : 0;
        const flash = clamp01(1 - (k - 0.12) / 0.3) * (k > 0.12 ? 1 : 0);
        if (flash > 0) {
            ctx.save();
            ctx.globalAlpha = flash * 0.55;
            ctx.fillStyle = '#fff6dc';
            ctx.fillRect(0, 0, AW, AH);
            ctx.restore();
        }
        ctx.save();
        ctx.translate(AW / 2 + jit, AH / 2 - 12);
        ctx.scale(z, z);
        text(ctx, tl('討伐開始！'), 0, 0, 22, '#ffd166', a, '#3a1a00');
        ctx.restore();
    }
}
const TAU = Math.PI * 2;
const tri = (u, n) => (u * n) % 1; // n 回くり返す 0→1
/** 武器ごとの動き: 剣は2〜3振り、ハンマーはくるっと回して担ぐ、弓は引きしぼる、杖は光を集める … */
export function flourish(w, u) {
    const hop = (a, b, hgt) => -Math.round(Math.sin(clamp01((u - a) / (b - a)) * Math.PI) * hgt);
    switch (w) {
        case 'sword':
        case 'katana':
        case 'dagger': { // 3振り（だんだん速く）。最後は切っ先をボスへ
            const n = w === 'dagger' ? 4 : 3, k = Math.min(n - 1, Math.floor(ease(u) * n));
            if (u > 0.85)
                return { act: 'attack', t: 0.5, wRot: -0.4, oy: 0, ox: 0 };
            return { act: 'attack', t: tri(ease(u), n) * 0.9, wRot: 0, oy: 0, ox: k % 2 ? -1 : 0 };
        }
        case 'scythe': // 大鎌をぐるりと一回し → 構える
            return u < 0.7 ? { act: 'victory', t: 0.5, wRot: ease(u / 0.7) * TAU, oy: 0, ox: 0 } : { act: 'attack', t: 0.25, wRot: 0, oy: 0, ox: 0 };
        case 'hammer':
        case 'axe': // くるっと2回転させて、どんと担ぐ
            if (u < 0.65)
                return { act: 'victory', t: 0.5, wRot: ease(u / 0.65) * TAU * 2, oy: 0, ox: 0 };
            return { act: 'attack', t: 0.15 + ease(clamp01((u - 0.65) / 0.15)) * 0.5, wRot: 0, oy: u < 0.8 ? 0 : 1, ox: 0 };
        case 'spear':
        case 'umbrella': // 指先で回して、突きの構え
            if (u < 0.6)
                return { act: 'cast', t: 0.5, wRot: ease(u / 0.6) * TAU * 2, oy: 0, ox: 0 };
            return { act: 'attack', t: u < 0.75 ? 0.4 : 0.3, wRot: 0, oy: 0, ox: u < 0.75 ? -2 : 0 };
        case 'pan': // フライパンを放り上げて、受けとめる
            return { act: u < 0.6 ? 'victory' : 'guard', t: 0.6, wRot: u < 0.6 ? ease(u / 0.6) * TAU * 2 : 0, oy: hop(0.1, 0.45, 3), ox: 0 };
        case 'shield': // 盾を2度打ち鳴らして、前へ
            return { act: 'attack', t: u < 0.6 ? tri(u / 0.6, 2) * 0.5 : 0.35, wRot: 0, oy: 0, ox: u > 0.6 ? -1 : 0 };
        case 'bow': // 矢をつがえて、引きしぼる
            return { act: 'attack', t: lerp(0.05, 0.35, ease(clamp01(u / 0.7))), wRot: u > 0.7 ? -0.15 : 0, oy: 0, ox: u > 0.7 ? 1 : 0 };
        case 'blaster': // 光線銃に力をためる
            return { act: 'cast', t: 0.5, wRot: u < 0.3 ? -ease(u / 0.3) * 0.6 : -0.6 + ease(clamp01((u - 0.3) / 0.2)) * 0.6, oy: 0, ox: 0 };
        case 'wand':
        case 'book': // 杖・魔導書を掲げて、光を集める
            return { act: 'cast', t: 0.5, wRot: 0, oy: hop(0.55, 0.85, 2), ox: 0 };
        case 'fan': // 扇をひらりと一回し
            return { act: u < 0.6 ? 'cast' : 'attack', t: 0.5, wRot: u < 0.6 ? ease(u / 0.6) * TAU : 0, oy: 0, ox: 0 };
        case 'guitar': // かき鳴らす
            return { act: 'attack', t: 0.12 + (Math.floor(u * 10) % 2) * 0.12, wRot: 0, oy: Math.floor(u * 5) % 2 ? 0 : -1, ox: 0 };
        default:
            return { act: 'attack', t: tri(u, 2) * 0.8, wRot: 0, oy: 0, ox: 0 };
    }
}
/** 武器さばきの光（振った跡・回した輪・集まる光・音符） */
export function flourishFx(ctx, look, x, y, u, col, frame) {
    const w = look.weapon;
    const hx = x - 6, hy = y - 15; // 手のあたり（左を向いている）
    ctx.save();
    // 振った跡・回した跡: 武器の先が実際に通った所をさかのぼって線でつなぐ（回す向きと跡の向きが必ず合う）
    const SWING = ['sword', 'katana', 'dagger', 'scythe', 'hammer', 'axe', 'spear', 'umbrella', 'pan', 'fan'];
    if (SWING.includes(w)) {
        const tipAt = (uu) => { const p = flourish(w, uu); return muzzleOf(look, x + p.ox, y + p.oy, { frame, flip: true, action: p.act, t: p.t, wRot: p.wRot }); };
        const N = 10, du = 0.013;
        const pts = Array.from({ length: N }, (_, j) => tipAt(Math.max(0, u - j * du)));
        const moving = Math.hypot(pts[0].x - pts[N - 1].x, pts[0].y - pts[N - 1].y) > 4; // 止まっているときは跡を出さない
        if (moving) {
            const c = w === 'fan' ? '#ffb3d9' : '#eef2ff';
            for (let j = 0; j < N - 1; j++) {
                if (Math.hypot(pts[j].x - pts[j + 1].x, pts[j].y - pts[j + 1].y) > 9)
                    break; // 構えの切りかえで先が飛んだ所はつながない
                ctx.globalAlpha = 0.85 * (1 - j / (N - 1));
                ctx.strokeStyle = c;
                ctx.lineWidth = j < 2 ? 1.6 : 1;
                ctx.beginPath();
                ctx.moveTo(pts[j].x, pts[j].y);
                ctx.lineTo(pts[j + 1].x, pts[j + 1].y);
                ctx.stroke();
            }
        }
        if ((w === 'hammer' || w === 'axe') && u > 0.78 && u < 0.95) {
            ctx.globalAlpha = 1 - (u - 0.78) / 0.17;
            ctx.fillStyle = '#d8ccb0';
            for (const d of [-6, -2, 3, 7])
                ctx.fillRect(Math.round(x + d), Math.round(y - 1 - Math.abs(d) * 0.2), 2, 1);
        }
        if ((w === 'sword' || w === 'katana' || w === 'dagger') && u > 0.85) {
            const t = tipAt(u);
            ctx.globalAlpha = 1 - (u - 0.85) / 0.15;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(Math.round(t.x), Math.round(t.y - 2), 1, 5);
            ctx.fillRect(Math.round(t.x - 2), Math.round(t.y), 5, 1);
        } // 切っ先のきらめき
    }
    switch (w) {
        case 'shield': {
            const p = u < 0.6 ? tri(u / 0.6, 2) : 1;
            if (u < 0.6 && p > 0.3 && p < 0.6) {
                ctx.globalAlpha = 0.9;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(Math.round(hx - 5), Math.round(hy - 2), 1, 5);
                ctx.fillRect(Math.round(hx - 7), Math.round(hy), 5, 1);
            }
            break;
        }
        case 'bow':
        case 'blaster':
        case 'wand':
        case 'book': { // 光が手もとへ集まる
            const c = w === 'blaster' ? '#7dffb0' : w === 'bow' ? '#ffe9a0' : col;
            const k = clamp01(u / 0.8);
            for (let i = 0; i < 6; i++) {
                const a = i * (TAU / 6) + frame * 0.05, r = 14 * (1 - k) + 2;
                ctx.globalAlpha = 0.4 + 0.6 * k;
                ctx.fillStyle = c;
                ctx.fillRect(Math.round(hx - 4 + Math.cos(a) * r), Math.round(hy - 2 + Math.sin(a) * r * 0.7), 1, 1);
            }
            if (u > 0.75) {
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = (1 - u) * 3;
                ctx.fillStyle = c;
                ctx.beginPath();
                ctx.arc(hx - 4, hy - 2, 2.5, 0, TAU);
                ctx.fill();
            }
            break;
        }
        case 'guitar': { // 音符が立ちのぼる
            for (let i = 0; i < 3; i++) {
                const q = (u * 1.6 + i / 3) % 1;
                ctx.globalAlpha = 1 - q;
                ctx.fillStyle = ['#ffd166', '#ff8fd0', '#8fe0ff'][i];
                const nx = Math.round(x + 4 + i * 4 + Math.sin(q * 6 + i) * 2), ny = Math.round(y - 22 - q * 14);
                ctx.fillRect(nx, ny, 2, 2);
                ctx.fillRect(nx + 1, ny - 4, 1, 4);
                ctx.fillRect(nx + 2, ny - 4, 1, 1);
            }
            break;
        }
    }
    ctx.restore();
}
//# sourceMappingURL=arena-intro.js.map