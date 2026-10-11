import { ATTACKS, CHAIN_T, chainOrder, waveTitleFor } from '../shared/simulate.js';
import { Rng } from '../shared/rng.js';
import { POSITION_LABELS, skillLook } from '../shared/build.js';
import { MELEE_WEAPONS, TOOL_BY_ID } from '../shared/catalog.js';
import { crownSprite, potionSprite, shieldIcon, tombSprite } from './sprites.js';
import { SKILL_WEIGHT } from '../shared/stats.js';
import { guardIcon, scrollIcon, toolIcon } from './toolIcons.js';
import { drawHero, familiarHome, figure, gearOf, lookOf, portrait, weaponSprite } from './hero.js';
import { bossCanvas, BOSS_IDLE, BW, BH } from './boss.js';
import './bosses/index.js';
import { BODY_STYLE, fxColors, skillAura, toolMove } from './fx.js';
import { chainBreakAt, isUltScene, shoutEndT, ULT_T, sceneBack, sceneDark, SPELL_T, sceneBanner, sceneFront, sceneHud, sceneTop, ultBeats, ultCam, ultHitT, ultPose, ultShake, verseAt } from './scenes.js';
import { NOTE_MARK } from '../shared/types.js';
import { play } from './sfx.js';
import { PIXEL_FONT, tl } from '../shared/i18n.js';
// 円や楕円の半径が計算の途中で負になっても、描画で例外にしない（0として描く）
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.__safeArc) {
    const P = CanvasRenderingContext2D.prototype;
    const arc = P.arc, ellipse = P.ellipse;
    P.arc = function (x, y, r, ...rest) { return arc.call(this, x, y, Math.max(0, r || 0), ...rest); };
    P.ellipse = function (x, y, rx, ry, ...rest) { return ellipse.call(this, x, y, Math.max(0, rx || 0), Math.max(0, ry || 0), ...rest); };
    P.__safeArc = true;
}
export const SCALE = 2;
export const OUTRO = 1.4; // 試合後の余韻（ウェーブ何個分）
const ease = (t) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t));
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const win01 = (p, a, b) => clamp01((p - a) / (b - a)); // 区間の進み具合 0→1
const bump = (p, a, b) => (p < a || p > b ? 0 : Math.sin(((p - a) / (b - a)) * Math.PI));
const KO_TIME = 0.14;
const IMPACT = 0.42;
// 連携詠唱のテンポ: 各区間を何倍ゆっくり見せるか（節の詠唱・叫び・タメ・着弾・着弾のあと）
export const CHAIN_TEMPOS = {
    brisk: { label: '速め（前の版）', verse: 1, shout: 1, charge: 1, impact: 1, after: 0.45 },
    calm: { label: 'ゆったり', verse: 1.2, shout: 1.5, charge: 1.8, impact: 1.8, after: 1.5 },
    grand: { label: 'じっくり', verse: 1.5, shout: 2, charge: 2.4, impact: 2.4, after: 2 },
};
const MINE_BAND = [0.27, 0.41]; // あなたの青い帯（赤い帯が消えてから、回避・反撃の前まで）
// 詠唱の文を、同じ長さの古代文字に置きかえる（見る人に答えを見せないとき）
const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
const runeLine = (s0, k) => [...s0].map((ch, j) => (/\s/.test(ch) ? tl('　') : RUNES[(ch.charCodeAt(0) * 7 + j * 3 + k * 5) % RUNES.length])).join('');
const GAG = [0.06, 0.27]; // 役に立たない道具のギャグを見せる区間（ボスが構える前）
export const GUARD_HIT = 0.36; // 幻術の声が冒険者に届く（結界に当たる）瞬間
export const TOOL_SHORT = {
    kb_search: tl('ナレッジ検索'), customer_lookup: tl('顧客台帳'), history_lookup: tl('履歴照会'),
    regex_matcher: tl('正規表現'), calculator: tl('計算機'), clock: tl('時計'), json_validator: tl('形式チェック'), scan: tl('看破'), memory: tl('冒険日誌'), bell: tl('気配の鈴'), guardrail: tl('結界'),
};
const EVADE_LABEL = { dodge: tl('よけた！'), block: tl('ガード！'), barrier: tl('はじいた！'), shoot: tl('撃ち落とした！'), slash: tl('斬った！'), jump: tl('跳んだ！'), crawl: tl('伏せた！'), step: tl('すり抜けた！') };
// 場面ごとの、正解したときの身のこなし（ブレスは水鏡で受ける＝ガード）
const SCENE_EVADE = { tail: 'jump', dive: 'crawl', claw: 'step', breath: 'block' };
const ATTACK_NAME_BY_SCENE = { dive: tl('急降下'), illusion: tl('幻術の声'), spell: tl('呪文'), fog: tl('霧の中からの一撃'), ougi: tl('竜の悪あがき'), rush: tl('突進'), summon: tl('大技'), opening: tl('竜の反撃'), memory: tl('見覚えのある一撃'), ally: tl('竜の一撃') };
const AGILE = new Set(['ninja', 'rogue', 'cat', 'bunny', 'frog', 'ghostie']);
const NO_GEAR = { back: [], fams: [], charms: [] };
export class ArenaRenderer {
    canvas;
    script;
    ctx;
    bg;
    looks;
    gears;
    portraits;
    styles;
    colors;
    evades;
    selected = null;
    hovered = null;
    mine = new Set();
    mineLabel = tl('あなた');
    chainTempo = 'calm'; // 連携詠唱の見せ方の速さ（演出ギャラリーで選べる） // 目立たせる冒険者の札（過去のシーズンの再生では「注目」）
    muted = false; // true にすると効果音を鳴らさない（紹介ページの小さな再生など）
    frame = 0;
    cam = { x: 192, y: 108, z: 1 };
    shakeXY = { x: 0, y: 0 };
    ui = [];
    uiTop = [];
    deaths = new Map(); // 討伐では、倒れて起き上がって、また倒れることがある
    escapeAt = null;
    // その時点でいちばん新しい「倒れた瞬間」
    deathOf(f, w, phase) {
        const ds = this.deaths.get(f) ?? [];
        let d = ds[0] ?? { wave: w, t: 0 };
        for (const x of ds)
            if (x.wave < w || (x.wave === w && x.t <= phase))
                d = x;
        return d;
    }
    spotCache = new Map();
    finalWave = -1;
    suddenWave = -1;
    downAt = null;
    winner = null;
    lastTime = 0;
    // 光源（毎フレーム集める）: 暗がりの中で、松明・火花・魔法陣・自分のキャラのまわりだけ明るくする
    lights = [];
    lightmap = null;
    wall = null;
    constructor(canvas, script) {
        this.canvas = canvas;
        this.script = script;
        canvas.width = script.arena.w * SCALE;
        canvas.height = script.arena.h * SCALE;
        this.ctx = canvas.getContext('2d');
        this.looks = script.fighters.map((f) => lookOf(f.loadout));
        this.gears = script.fighters.map((f) => gearOf(f.loadout));
        this.styles = script.fighters.map((f) => BODY_STYLE[f.loadout.body]);
        this.colors = this.looks.map((l, i) => fxColors(this.styles[i], l));
        this.portraits = script.fighters.map((_, i) => portrait(this.looks[i], this.gears[i], { scale: 2, action: 'victory', t: 0.25 }));
        // 回避アクション: 身軽な体型はよける、それ以外は武器で受け方が変わる
        this.evades = script.fighters.map((f) => {
            const w = f.loadout.weapon;
            if (AGILE.has(f.loadout.body))
                return 'dodge';
            if (w === 'shield' || w === 'pan' || w === 'umbrella')
                return 'block';
            if (w === 'wand' || w === 'book' || w === 'fan')
                return 'barrier';
            if (w === 'bow' || w === 'blaster')
                return 'shoot';
            return 'slash';
        });
        this.bg = this.makeBackground();
        script.waves.forEach((wv, w) => {
            for (const e of wv.events) {
                if (e.type === 'death')
                    this.deaths.set(e.f, [...(this.deaths.get(e.f) ?? []), { wave: w, t: e.t }]);
                if (e.type === 'bossEscape')
                    this.escapeAt = { wave: w, t: e.t, hpLeft: e.hpLeft };
                if (e.type === 'final')
                    this.finalWave = w;
                if (e.type === 'sudden')
                    this.suddenWave = w;
                if (e.type === 'bossDown')
                    this.downAt = { wave: w, t: e.t };
                if (e.type === 'winner')
                    this.winner = e.f;
            }
        });
    }
    // 場面の見出し。抽選で変わる場面は「あなた」の冒険者が引いた見出し（いなければ一般的な見出し）
    caseTitle(cm) {
        return waveTitleFor(cm, this.script.fighters, this.mine);
    }
    sceneOf(w) {
        const wv = this.script.waves[w];
        return wv && !wv.sudden ? this.script.cases[wv.caseIndex]?.scene : undefined;
    }
    get totalWaves() { return this.script.waves.length; }
    get totalTime() { return this.script.waves.length + OUTRO; }
    teamColor(f) { return this.script.mode === 'team' ? this.script.teams[this.script.fighters[f].team].color : undefined; }
    get bossFoot() { return { x: this.script.boss.x, y: this.script.boss.y }; }
    get bossBody() { return { x: this.script.boss.x + 14, y: this.script.boss.y - 22 }; } // 反撃が当たる所（toolMove は y-8 を狙う）
    // --- 背景: 城の大広間（上に壁と旗と松明、下に石畳） ---
    makeBackground() {
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
    // --- 状態（ある時刻のHP・生死・ボスの体力） ---
    // 大技の場面は「連携合体攻撃」: 主役の大技が当たったあと、正しく動けたほかの冒険者が一人ずつ続けて技を撃ちこむ。
    // 台本の反撃の時刻だけを見る人ごとに並べ替える（ダメージ・順位は台本のまま）
    retimed = new Map();
    wave(w) {
        const wv = this.script.waves[w];
        const scene = this.sceneOf(w);
        if (!wv || !isUltScene(scene))
            return wv;
        const key = `${w}:${[...this.mine].join(',')}`;
        const hit = this.retimed.get(key);
        if (hit)
            return hit;
        const hero = this.ultHero(w)?.f;
        const atks = wv.events.filter((e) => e.type === 'attack');
        const others = atks.filter((e) => e.f !== hero).sort((a, b) => a.t - b.t);
        const t0 = ULT_T[scene].home + 0.02, t1 = 0.92;
        const at = new Map();
        for (const e of atks)
            if (e.f === hero)
                at.set(e, ultHitT(scene));
        others.forEach((e, k) => at.set(e, others.length > 1 ? t0 + ((t1 - t0) * k) / (others.length - 1) : t0 + 0.04));
        const last = Math.max(0, ...[...at.values()]);
        const events = wv.events.map((e) => (e.type === 'attack' && at.has(e) ? { ...e, t: at.get(e) } : e.type === 'bossDown' ? { ...e, t: Math.max(e.t, last + 0.04) } : e.type === 'mvp' ? { ...e, t: Math.max(e.t, last + 0.03) } : e))
            .sort((a, b) => a.t - b.t);
        const out = { ...wv, events };
        this.retimed.set(key, out);
        return out;
    }
    // 連携合体攻撃の、いま何人目か（主役の大技のあとに続いた人数）
    comboAt(w, phase) {
        const scene = this.sceneOf(w);
        if (!isUltScene(scene))
            return null;
        const hero = this.ultHero(w)?.f;
        const fol = this.wave(w).events.filter((e) => e.type === 'attack' && e.f !== hero);
        if (!fol.length)
            return null;
        return { n: fol.filter((e) => e.t <= phase).length, total: fol.length, last: fol[fol.length - 1].t };
    }
    // 連携の表示: 続いた人数を「N 連携！」で数え、撃った仲間どうしを光の糸でつなぐ
    comboHud(ctx, w, phase, views) {
        const cb = this.comboAt(w, phase);
        if (!cb || cb.n === 0 || phase > cb.last + 0.1)
            return;
        const p = this.proj(this.bossBody.x + 34, this.bossBody.y - 46);
        const fade = 1 - clamp01((phase - cb.last - 0.06) / 0.04);
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const pop = 1 + 0.4 * (1 - clamp01(((phase - cb.last) * (cb.n === cb.total ? 1 : 0)) / 0.02));
        ctx.font = `bold ${Math.round(14 * (cb.n === cb.total && phase < cb.last + 0.02 ? pop : 1))}px ${PIXEL_FONT}`;
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#2a1030';
        const t1 = `${cb.n}`;
        ctx.strokeText(t1, Math.round(p.x), Math.round(p.y));
        ctx.fillStyle = '#ffd166';
        ctx.fillText(t1, Math.round(p.x), Math.round(p.y));
        const wN = ctx.measureText(t1).width;
        ctx.font = `8px ${PIXEL_FONT}`;
        ctx.strokeText(tl('連携！'), Math.round(p.x + wN + 3), Math.round(p.y + 2));
        ctx.fillStyle = '#ffffff';
        ctx.fillText(tl('連携！'), Math.round(p.x + wN + 3), Math.round(p.y + 2));
        ctx.restore();
        // 協力した感じ: 前に撃った仲間から次の仲間へ、光の糸がつながっていく（バトンを渡すように）
        const hero = this.ultHero(w)?.f;
        const seq = this.wave(w).events.filter((e) => e.type === 'attack').sort((x, y) => x.t - y.t);
        const order = [...(hero !== undefined ? [hero] : []), ...seq.map((e) => e.f).filter((f) => f !== hero)];
        const tOf = new Map(seq.map((e) => [e.f, e.t]));
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 1; i < order.length; i++) {
            const t = tOf.get(order[i]);
            if (t === undefined || phase < t - 0.1)
                break;
            const k = clamp01((phase - (t - 0.1)) / 0.05); // 糸が伸びる
            const fadeL = 1 - clamp01((phase - t - 0.03) / 0.05); // 渡し終えた糸は、すぐに消える（いま渡している糸だけが光る）
            if (fadeL <= 0)
                continue;
            const a0 = views[order[i - 1]], a1 = views[order[i]];
            if (!a0 || !a1)
                continue;
            const p0 = this.proj(a0.x, a0.y - 14), p1 = this.proj(a1.x, a1.y - 14);
            // 弧を描いて渡る光（ベジェ曲線の途中まで）
            const cx = (p0.x + p1.x) / 2, cy = Math.min(p0.y, p1.y) - 24;
            const P = (u) => ({ x: (1 - u) * (1 - u) * p0.x + 2 * (1 - u) * u * cx + u * u * p1.x, y: (1 - u) * (1 - u) * p0.y + 2 * (1 - u) * u * cy + u * u * p1.y });
            for (const [lw, col, al] of [[3, '#ffe27a', 0.7], [1, '#ffffff', 1]]) {
                ctx.globalAlpha = al * fadeL;
                ctx.strokeStyle = col;
                ctx.lineWidth = lw;
                ctx.beginPath();
                ctx.moveTo(p0.x, p0.y);
                for (let u = 0.1; u <= k + 1e-6; u += 0.1) {
                    const q = P(u);
                    ctx.lineTo(q.x, q.y);
                }
                ctx.stroke();
            }
            const head = P(k);
            ctx.globalAlpha = fadeL;
            ctx.fillStyle = '#fff6c8';
            ctx.fillRect(Math.round(head.x) - 2, Math.round(head.y) - 2, 4, 4);
        }
        ctx.restore();
    }
    split(time) {
        const s = this.script;
        if (!Number.isFinite(time) || time < 0)
            time = 0;
        const w = Math.min(Math.floor(time), s.waves.length - 1);
        const phase = time >= s.waves.length ? 1 : time - w;
        return { w, phase, wv: this.wave(w), outro: Math.max(0, time - s.waves.length) };
    }
    state(time) {
        const s = this.script;
        const { w, phase, wv } = this.split(time);
        const prev = w > 0 ? s.waves[w - 1] : null;
        const hp = s.fighters.map((_, f) => (prev ? prev.hpAfter[f] : 100));
        const shield = s.fighters.map((_, f) => (prev ? prev.shieldAfter[f] : 0));
        const alive = s.fighters.map((_, f) => (prev ? prev.aliveAfter[f] : true));
        for (const e of wv.events) {
            if (e.t > phase)
                break;
            if (e.type === 'hit') {
                hp[e.f] = Math.max(0, hp[e.f] - e.dmg);
                shield[e.f] = Math.max(0, shield[e.f] - e.absorbed);
            }
            else if (e.type === 'storm')
                hp[e.f] = Math.max(0, hp[e.f] - e.dmg);
            else if (e.type === 'item') {
                if (e.item === 'potion')
                    hp[e.f] = Math.min(100, hp[e.f] + e.amount);
                else
                    shield[e.f] += e.amount;
            }
            else if (e.type === 'death')
                alive[e.f] = false;
            else if (e.type === 'revive') {
                alive[e.f] = true;
                hp[e.f] = 50;
            }
        }
        // 連携詠唱: 唱える人は魔法陣を囲み、唱えない人は右端へ場を譲る。終わったら全員もとの位置へ戻って並び直す
        const plan = this.chainOf(w);
        const g = plan ? ease((phase - CHAIN_T.gather) / (CHAIN_T.lined - CHAIN_T.gather)) * (1 - ease((phase - 0.9) / 0.08)) : 0;
        return s.fighters.map((fi, f) => {
            const to = g > 0 ? plan.line.get(f) : undefined;
            const x = to ? lerp(fi.slot.x, to.x, g) : fi.slot.x, y = to ? lerp(fi.slot.y, to.y, g) : fi.slot.y;
            return { f, x, y, hp: alive[f] ? hp[f] : 0, shield: shield[f], alive: alive[f] };
        });
    }
    bossHp(time) {
        const s = this.script;
        const { w, phase, wv } = this.split(time);
        let v = w > 0 ? s.waves[w - 1].bossHpAfter : s.boss.maxHp;
        const plan = this.chainOf(w);
        const floor = wv.bossHpAfter > 0 ? wv.bossHpAfter : 0;
        // 連携詠唱のダメージは、見る人ごとの演出の瞬間（大魔法の着弾・詠唱が途切れた瞬間）に減らす
        // 討伐で詠唱が途切れたときは、総攻撃までボスは体力1で踏みとどまる
        if (plan && phase >= plan.dmgAt)
            v = Math.max(plan.view.full || v < 1 || s.mode !== 'royale' ? Math.min(v, floor) : Math.max(1, Math.min(v, floor)), v - plan.ev.dmg);
        for (const e of wv.events) {
            if (e.t > phase)
                break;
            if (e.type === 'attack')
                v = Math.max(Math.min(v, floor), v - e.dmg);
        }
        return v;
    }
    toWorld(px, py) {
        const { w, h } = this.script.arena;
        return { x: (px / SCALE - w / 2) / this.cam.z + this.cam.x, y: (py / SCALE - h / 2) / this.cam.z + this.cam.y };
    }
    proj(x, y) {
        const { w, h } = this.script.arena;
        return { x: (x - this.cam.x) * this.cam.z + w / 2 + this.shakeXY.x, y: (y - this.cam.y) * this.cam.z + h / 2 + this.shakeXY.y };
    }
    hitTest(px, py, time) {
        const p = this.toWorld(px, py);
        let best = null, bd = 14;
        for (const v of this.state(time)) {
            if (!v.alive || this.script.fighters[v.f].off)
                continue;
            const d = Math.hypot(v.x - p.x, v.y - 10 - p.y);
            if (d < bd) {
                bd = d;
                best = v.f;
            }
        }
        return best;
    }
    // 注目キャラ: 選択中 → 自分 → このウェーブの MVP の順で、反撃でツール・スキル・仲間を使ったキャラ
    spotlight(w) {
        const key = w * 1000 + (this.selected ?? 999);
        if (this.spotCache.has(key))
            return this.spotCache.get(key);
        const wv = this.script.waves[w];
        if (!wv)
            return null;
        const strikes = new Map();
        const atks = new Map();
        for (const e of wv.events) {
            if (e.type === 'strike')
                strikes.set(e.f, e);
            if (e.type === 'attack')
                atks.set(e.f, e);
        }
        const mvp = wv.events.find((e) => e.type === 'mvp');
        const cands = [this.selected, ...[...this.mine], mvp ? mvp.f : null].filter((x) => x !== null && !this.script.fighters[x].off);
        let out = null;
        for (const c of cands) {
            const st = strikes.get(c), at = atks.get(c);
            // 自分のキャラは、道具を使っていなくても毎回注目する
            if (st && at && (this.mine.has(c) || st.used.skills.length || st.used.tools.length)) {
                out = { f: c, st, at };
                break;
            }
        }
        this.spotCache.set(key, out);
        return out;
    }
    // 再生速度の倍率（注目キャラの反撃・決着の瞬間はスロー）
    bandWave(w) {
        const s = this.script, wv = s.waves[w];
        if (!wv || wv.sudden || this.chainOf(w) || this.ultOf(w) || this.sceneOf(w) === 'spell')
            return false;
        const mine = [...this.mine].find((f) => !s.fighters[f].off);
        return mine !== undefined && wv.events.some((e) => e.type === 'strike' && e.f === mine);
    }
    slowFactor(time) {
        const { w, phase } = this.split(time);
        if (time > this.script.waves.length)
            return 0.8;
        // ヒットストップ: 当たった瞬間に、ほんの数コマだけ時間を止める（攻撃の「重さ」）
        const stop = this.hitStop(w, phase);
        if (stop)
            return stop;
        // あなたの青い帯が読めるよう、帯のあいだは少しゆっくり
        if (phase > MINE_BAND[0] && phase < MINE_BAND[1] && this.bandWave(w))
            return 0.6;
        // 連携詠唱: 詠唱のあいだはゆっくり（字幕が読める速さ）。大魔法の着弾はさらにゆっくり。途切れたあとの間は早送り
        const ch = this.chainOf(w);
        if (ch) {
            const c = ch.view;
            // 一節ずつ、みんなで唱えている感じが伝わるよう、詠唱はじっくり。テンポは chainTempo で選べる（演出ギャラリー）
            const tp = CHAIN_TEMPOS[this.chainTempo];
            if (phase < c.start - 0.02)
                return 0.5;
            if (c.full) {
                if (Math.abs(phase - c.impact) < 0.025)
                    return 0.3 / tp.impact;
                if (phase < c.impact)
                    return phase > shoutEndT(c) ? 0.13 / tp.charge : phase > c.doneT ? 0.12 / tp.shout : 0.14 / tp.verse; // 叫ぶあいだ・叫んだあとのタメは、じっくり
                if (phase < c.impact + 0.25)
                    return 0.45 / tp.after; // 光の柱が落ちたあと（ボスが崩れていく）も、余韻を見せる
            }
            else {
                if (phase < c.breakT + 0.08)
                    return 0.14 / tp.verse;
                if (phase < c.breakT + 0.3)
                    return 0.5 / tp.after;
                if (phase < c.rally - 0.02)
                    return 3;
            }
        }
        // 詠唱合戦: ボスの詠唱 → 迫る魔法弾 → 打ち消しの詠唱 → 倍返し、の流れが追えるようにゆっくり
        if (this.sceneOf(w) === 'spell') {
            const known = this.script.waves[w].events.some((e) => e.type === 'strike' && e.success);
            if (known) {
                if (Math.abs(phase - SPELL_T.back) < 0.02)
                    return 0.18;
                if (phase > 0.2 && phase < SPELL_T.back)
                    return 0.25; // 迫る魔法弾・知る者の詠唱・押し合い
                if (phase > 0.04 && phase < SPELL_T.back + 0.08)
                    return 0.35;
            }
            else if (phase > 0.04 && phase < 0.46)
                return 0.4;
        }
        // 巻物の大技カウンター: 主役の大技のあいだはゆっくり、当たる瞬間はさらにゆっくり
        const ult = this.ultOf(w);
        if (ult?.f !== undefined && phase > 0.3) {
            const hit = ultHitT(ult.scene);
            if (phase < hit + 0.06)
                return Math.abs(phase - hit) < 0.03 ? 0.3 : 0.6;
            if (this.spotlight(w)?.f === ult.f)
                return 1;
        }
        if ([...this.mine].some((f) => this.gagOf(f)?.w === w) && phase > GAG[0] && phase < GAG[1])
            return 0.55; // ギャグは少しゆっくり
        const fin = this.finisher(w);
        if (fin !== null && Math.abs(phase - fin) < 0.07)
            return 0.3;
        const sp = this.spotlight(w);
        if (!sp)
            return 1;
        if (sp.st.used.skills.length && this.skillWave(w)) {
            const [u0, u1] = this.ultWindow(sp.st, w);
            if (phase > u0 - 0.02 && phase < u1 + 0.01)
                return 0.35;
        }
        const a = sp.at.t - 0.14, b = sp.at.t + 0.06;
        if (phase < a - 0.03 || phase > b + 0.03)
            return 1;
        if (phase < a)
            return 1 - ((phase - (a - 0.03)) / 0.03) * 0.7;
        if (phase > b)
            return 0.3 + ((phase - b) / 0.03) * 0.7;
        return 0.3;
    }
    stopCache = new Map();
    hitStop(w, phase) {
        let list = this.stopCache.get(w);
        if (!list) {
            list = [];
            const wv = this.wave(w);
            const focus = new Set([...this.mine, ...(this.spotlight(w) ? [this.spotlight(w).f] : [])]);
            for (const e of wv.events) {
                if (e.type === 'attack' && (focus.has(e.f) || e.crit))
                    list.push([e.t, e.crit ? 0.0009 : 0.0006, 0.05]);
                if ((e.type === 'hit' || e.type === 'evade') && focus.has(e.f))
                    list.push([IMPACT + this.lagOf(w, e.f), 0.0006, 0.06]);
                if (e.type === 'bossDown')
                    list.push([e.t, 0.002, 0.04]);
            }
            const ult = this.ultOf(w);
            if (ult?.f !== undefined)
                for (const b of ultBeats(ult.scene, this.ultWeapon(ult.f)))
                    if (b.stop)
                        list.push([b.t, b.stop, 0.05]);
            const ch = this.chainOf(w);
            if (ch?.view.full)
                list.push([ch.view.impact, 0.008, 0.04]);
            else if (ch)
                list.push([ch.view.breakT, 0.004, 0.08]);
            this.stopCache.set(w, list);
        }
        for (const [t, len, f] of list)
            if (phase >= t && phase < t + len)
                return f;
        return 0;
    }
    // 尾のなぎはらい・ブレスは、ボスに近い者から順に届く
    lagOf(w, f) {
        const x = this.script.fighters[f].slot.x;
        const sc = this.sceneOf(w);
        return sc === 'tail' ? clamp01((x - 150) / 234) * 0.12 : sc === 'breath' ? clamp01((x - 150) / 234) * 0.05 : 0;
    }
    // 効果音のきっかけ（ウェーブごとに1度だけ作る）。自分・注目キャラ・ボス・会心だけ鳴らす
    cueCache = new Map();
    cues(w) {
        let c = this.cueCache.get(w);
        if (c)
            return c;
        c = [];
        const wv = this.wave(w);
        const sc = this.sceneOf(w);
        const sp = this.spotlight(w);
        const focus = new Set([...this.mine, ...(sp ? [sp.f] : [])]);
        const ch = this.chainOf(w);
        if (ch) { // 連携詠唱: ボスの溜め → 一節ごとの鈴（だんだん高く）→ 大魔法 or ボフッ
            const v = ch.view;
            c.push({ t: 0.04, s: 'charge' });
            for (let i = 0; i < v.upto; i++)
                c.push({ t: verseAt(v, i) + 0.004, s: 'chant', v: 0.6 + (0.9 * i) / Math.max(1, v.len - 1) });
            if (v.full)
                c.push({ t: v.doneT - 0.35, s: 'chantDone' }, { t: v.doneT, s: 'shout' }, { t: shoutEndT(v), s: 'charge' }, { t: v.impact - 0.02, s: 'thunder' }, { t: v.impact, s: 'spellImpact' }, { t: v.impact + 0.06, s: 'rumble' });
            else
                c.push({ t: verseAt(v, v.upto) + 0.004, s: 'chant', v: 0.4 }, { t: v.breakT, s: 'shatter' }, { t: v.breakT + 0.03, s: 'poof' }, { t: v.breakT + 0.06, s: 'fail' });
        }
        else if (wv.attack !== 'treasure')
            c.push(sc === 'breath' ? { t: 0.36, s: 'breath' } : { t: 0.3, s: 'roar', v: 0.7 });
        if (sp?.st.used.skills.length && this.skillWave(w) && !ch && this.sceneOf(w) !== 'spell')
            c.push({ t: this.ultWindow(sp.st, w)[0], s: 'skill' });
        const ult = this.ultOf(w);
        if (ult)
            for (const b of ultBeats(ult.scene, this.ultWeapon(ult.f)))
                if (ult.f !== undefined || b.sfx === 'charge')
                    c.push({ t: b.t, s: b.sfx, ...(b.v ? { v: b.v } : {}) });
        for (const e of wv.events) {
            if (e.type === 'strike' && focus.has(e.f) && e.used.tools.length && !ch)
                c.push({ t: e.t, s: 'tool' });
            if (e.type === 'evade' && focus.has(e.f)) {
                const ev = (sc && SCENE_EVADE[sc]) || this.evades[e.f];
                c.push({ t: IMPACT + this.lagOf(w, e.f), s: ev === 'block' ? 'guard' : ev === 'barrier' ? 'barrier' : ev === 'slash' ? 'slash' : ev === 'shoot' ? 'shoot' : 'whoosh' });
            }
            if (e.type === 'hit' && focus.has(e.f))
                c.push({ t: IMPACT + this.lagOf(w, e.f), s: 'hurt' });
            if (e.type === 'attack' && (focus.has(e.f) || e.crit)) {
                const melee = MELEE_WEAPONS.includes(this.looks[e.f].weapon);
                c.push({ t: e.t - (melee ? 0.02 : 0.06), s: melee ? 'slash' : 'shoot', v: 0.8 });
                c.push({ t: e.t, s: e.crit ? 'crit' : 'hit' });
            }
            if (e.type === 'death')
                c.push({ t: e.t, s: 'ko' });
            if (e.type === 'bossDown')
                c.push({ t: e.t, s: 'bossDown' });
            if (e.type === 'winner')
                c.push({ t: e.t, s: 'win' });
        }
        for (const f of this.mine)
            if (this.gagOf(f)?.w === w) {
                c.push({ t: GAG[0] + 0.01, s: 'fanfare' });
                c.push({ t: GAG[0] + (GAG[1] - GAG[0]) * 0.62, s: 'fail' });
            }
        if (sc === 'illusion')
            for (const f of focus) {
                const st = wv.events.find((e) => e.type === 'strike' && e.f === f);
                if (st)
                    c.push({ t: GUARD_HIT, s: st.charmed ? 'charm' : 'shatter' });
            }
        c.sort((a, b) => a.t - b.t);
        this.cueCache.set(w, c);
        return c;
    }
    playCues(prev, now) {
        if (!(now > prev) || now - prev > 0.08)
            return; // 再生中だけ（シークでは鳴らさない）
        const w0 = Math.floor(prev), w1 = Math.floor(now);
        for (let w = Math.max(0, w0); w <= w1 && w < this.script.waves.length; w++) {
            for (const c of this.cues(w)) {
                const t = w + c.t;
                if (t > prev && t <= now)
                    play(c.s, c.v);
            }
        }
    }
    // 決着の瞬間（最終ウェーブのボス撃破か、最後のKO）
    finisher(w) {
        if (w !== this.script.waves.length - 1)
            return null;
        if (this.downAt && this.downAt.wave === w)
            return this.downAt.t;
        const ds = this.script.waves[w].events.filter((e) => e.type === 'death');
        return ds.length ? ds[ds.length - 1].t : null;
    }
    // ===================== 描画 =====================
    draw(time) {
        this.frame++;
        if (!this.muted)
            this.playCues(this.lastTime, time);
        this.lastTime = time;
        const s = this.script;
        const ctx = this.ctx;
        const { w, phase, wv, outro } = this.split(time);
        const { w: AW, h: AH } = s.arena;
        const views = this.state(time);
        const vis = views.filter((v) => !s.fighters[v.f].off); // 舞台に立っているキャラだけ描く
        const strikeOf = new Map();
        const attackOf = new Map();
        const hits = new Map();
        const evaded = new Set();
        const items = new Set();
        for (const e of wv.events) {
            if (e.type === 'strike')
                strikeOf.set(e.f, e);
            if (e.type === 'attack')
                attackOf.set(e.f, e);
            if (e.type === 'hit')
                hits.set(e.f, e);
            if (e.type === 'evade')
                evaded.add(e.f);
            if (e.type === 'item')
                items.add(e.f);
        }
        const atk = wv.attack;
        const rows = ATTACKS[atk].rows;
        const prevAlive = w > 0 ? s.waves[w - 1].aliveAfter : s.fighters.map(() => true);
        const chain = this.chainOf(w); // 連携詠唱の場面（ボスのふつうの攻撃はない）
        const targeted = (f) => !chain && prevAlive[f] && rows[s.fighters[f].row] !== undefined;
        const rage = wv.events.some((e) => e.type === 'storm');
        const down = this.downAt && (w > this.downAt.wave || (w === this.downAt.wave && phase >= this.downAt.t)) ? (w - this.downAt.wave) + phase - this.downAt.t + outro : -1;
        // --- カメラ: 普段は全体、注目の反撃と決着はズーム ---
        let tz = 1, tx = AW / 2, ty = AH / 2;
        const spot = this.spotlight(w);
        // 呪文の打ち消し・奥義・隙の大技は、画面全体で見せるのでズームしない
        const wide = ['spell', 'ougi', 'rush', 'summon', 'parry', 'seal', 'awaken', 'opening', 'chain'].includes(this.sceneOf(w) ?? '');
        const ult = this.ultOf(w);
        if (spot && !wide) {
            const g = Math.min(1, bump(phase, spot.at.t - 0.16, spot.at.t + 0.08) * 1.5);
            if (g > 0) {
                const v = views[spot.f];
                tz = lerp(1, 1.6, g);
                tx = lerp(tx, (v.x + this.bossBody.x) / 2, g);
                ty = lerp(ty, v.y - 24, g);
            }
        }
        // 自分の冒険者を追う: 判断する瞬間・攻撃を受ける瞬間（幻術の回は声が届くまで）に寄る
        const me = [...this.mine].find((f) => !s.fighters[f].off && views[f]?.alive);
        if (me !== undefined && !chain && !(spot && bump(phase, spot.at.t - 0.16, spot.at.t + 0.08) > 0)) {
            const v = views[me], st = strikeOf.get(me);
            const sc = this.sceneOf(w);
            const shots = [];
            if (st)
                shots.push([bump(phase, st.t - 0.06, st.t + 0.12), 1.4, v.x - 20, v.y - 22]);
            if (this.gagOf(me)?.w === w)
                shots.push([bump(phase, GAG[0] - 0.02, GAG[1] + 0.02) * 1.2, 1.8, v.x - 6, v.y - 26]);
            if (sc === 'illusion')
                shots.push([bump(phase, 0.16, 0.52), 1.5, v.x - 26, v.y - 22]);
            else if (wv.attack !== 'treasure')
                shots.push([bump(phase, IMPACT - 0.07, IMPACT + 0.14) * 0.9, 1.3, (v.x + this.bossBody.x) / 2 + 30, v.y - 24]);
            const best = shots.sort((a, b) => b[0] - a[0])[0];
            if (best && best[0] > 0) {
                const g = Math.min(1, best[0] * 1.6);
                tz = lerp(1, best[1], g);
                tx = lerp(tx, best[2], g);
                ty = lerp(ty, best[3], g);
            }
        }
        // 巻物の大技カウンター: カメラが主役を追う（溜め → 跳躍 → 着弾）
        let camK = 0.07;
        if (ult?.f !== undefined && views[ult.f]?.alive) {
            const c = ultCam(ult.scene, phase, { x: views[ult.f].x, y: views[ult.f].y }, this.bossFoot, this.bossBody, AW, AH, this.ultWeapon(ult.f));
            if (c) {
                tz = lerp(tz, c[1], c[0]);
                tx = lerp(tx, c[2], c[0]);
                ty = lerp(ty, c[3], c[0]);
                camK = 0.07 + 0.08 * c[0];
            }
        }
        // 連携詠唱: 唱えている人に少し寄る（あなたの番はもっと寄る）。外した人の番は、その人の頭のまわりへ
        if (chain) {
            const c = chain.view;
            const i = Math.floor((phase - c.start) / c.verse);
            const lastI = c.full ? c.len - 1 : c.upto;
            if (phase >= c.start && i <= lastI && i < c.chanters.length) {
                const v = views[c.chanters[i]];
                const mineNow = this.mine.has(c.chanters[i]);
                const failNow = !c.full && i === c.upto;
                const g = Math.min(1, win01(phase, c.start - 0.01, c.start + 0.03)) * (failNow ? 1 - win01(phase, Math.min(c.breakT + 0.24, c.rally - 0.08), Math.min(c.breakT + 0.3, c.rally - 0.02)) : 1);
                if (v && g > 0 && !s.fighters[v.f].off) {
                    // ふだんは空の魔法陣ごと全体を見せ、あなたの番と、外した人の番だけ寄る
                    const z = failNow && phase > c.breakT ? 1.6 : mineNow ? 1.4 : 1;
                    if (z > 1) {
                        tz = lerp(tz, z, g);
                        tx = lerp(tx, v.x - 10, g);
                        ty = lerp(ty, v.y - 40, g);
                    }
                }
            }
        }
        const fin = this.finisher(w);
        if (fin !== null) {
            const g = bump(phase, fin - 0.12, fin + 0.2);
            if (g > 0 && down >= 0) {
                tz = lerp(tz, 1.5, g);
                tx = lerp(tx, this.bossBody.x + 30, g);
                ty = lerp(ty, this.bossBody.y, g);
            }
        }
        if (outro > 0 && this.winner !== null) {
            const v = views[this.winner];
            tz = 2.2;
            tx = v.x;
            ty = v.y - 28;
        }
        const kk = this.frame < 3 ? 1 : camK;
        this.cam.z = lerp(this.cam.z, tz, kk);
        const vw = AW / this.cam.z / 2, vh = AH / this.cam.z / 2;
        this.cam.x = Math.max(vw, Math.min(AW - vw, lerp(this.cam.x, tx, kk)));
        this.cam.y = Math.max(vh, Math.min(AH - vh, lerp(this.cam.y, ty, kk)));
        // 画面揺れ: 攻撃が届いた瞬間・会心・KO・ボス撃破
        let shake = 0;
        if (atk !== 'treasure' && phase >= IMPACT && phase < IMPACT + 0.05)
            shake = atk === 'nova' || atk === 'meteor' ? 3 : 2;
        for (const e of wv.events) {
            const age = phase - e.t;
            if (age >= 0 && age < 0.05 && ((e.type === 'attack' && e.crit) || e.type === 'death' || e.type === 'bossDown'))
                shake = Math.max(shake, e.type === 'bossDown' ? 4 : 2);
        }
        if (ult)
            shake = Math.max(shake, ultShake(ult.scene, phase, ult.f !== undefined, this.ultWeapon(ult.f)));
        if (chain) {
            shake = phase < chain.view.start + 0.02 && phase > 0.02 ? 0 : shake; // 並ぶあいだは揺らさない
            const c = chain.view;
            if (c.full) {
                const age = phase - c.impact;
                if (age >= 0 && age < 0.12)
                    shake = Math.max(shake, 7 * (1 - age / 0.12));
                if (phase > c.doneT && phase < c.impact)
                    shake = Math.max(shake, 1);
            }
            else {
                const age = phase - c.breakT;
                if (age >= 0 && age < 0.05)
                    shake = Math.max(shake, 2);
            }
        }
        this.shakeXY = shake ? { x: Math.round(Math.sin(this.frame * 2.3) * shake), y: Math.round(Math.cos(this.frame * 1.7) * shake) } : { x: 0, y: 0 };
        this.ui = [];
        this.uiTop = [];
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#120e20';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.setTransform(SCALE * this.cam.z, 0, 0, SCALE * this.cam.z, SCALE * (AW / 2 + this.shakeXY.x) - SCALE * this.cam.z * this.cam.x, SCALE * (AH / 2 + this.shakeXY.y) - SCALE * this.cam.z * this.cam.y);
        ctx.drawImage(this.bg, 0, 0);
        if (this.wall) { // 奥の壁は、カメラの動きの 0.35 倍だけずらす
            const px = (this.cam.x - AW / 2) * 0.35, py = (this.cam.y - AH / 2) * 0.2;
            ctx.drawImage(this.wall, Math.round(px) - 40, Math.round(py), this.wall.width, 80);
        }
        this.lights = [
            { x: 198, y: 34, r: 70 + Math.sin(this.frame / 3) * 4, a: 0.9, col: '#ffb050' },
            { x: 294, y: 34, r: 70 + Math.cos(this.frame / 3.4) * 4, a: 0.9, col: '#ffb050' },
            { x: this.bossBody.x, y: this.bossBody.y - 10, r: 80, a: 0.55 },
        ];
        for (const f of this.mine) {
            const v = views[f];
            if (v?.alive && !s.fighters[f].off)
                this.lights.push({ x: v.x, y: v.y - 14, r: 46, a: 0.85, col: '#ffd166' });
        }
        // --- 隊列の帯と、狙われた列の警告 ---
        const tele = atk === 'treasure' || chain ? 0 : clamp01((phase - 0.26) / 0.06) * (phase < IMPACT + 0.04 ? 1 : 0);
        for (const r of ['front', 'mid', 'back']) {
            const xs = s.fighters.filter((fi) => fi.row === r && !fi.off).map((fi) => fi.slot.x);
            if (!xs.length)
                continue;
            const x = (Math.min(...xs) + Math.max(...xs)) / 2;
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            ctx.fillRect(Math.round(x - 28), 86, 56, 124);
            const hot = tele > 0 && rows[r] !== undefined;
            if (hot) {
                ctx.fillStyle = `rgba(255,60,80,${(0.12 + 0.14 * (Math.sin(this.frame / 3) * 0.5 + 0.5)) * tele})`;
                ctx.fillRect(Math.round(x - 30), 84, 60, 128);
            }
            const p = this.proj(x, 208);
            if (s.mode !== 'royale')
                this.ui.push(() => this.labelAt(POSITION_LABELS[r], p.x, p.y, hot ? '#ff8a9a' : '#9aa0c8'));
        }
        // --- 墓標 ---
        for (const v of vis)
            if (!v.alive && s.mode !== 'royale') { // 討伐では墓標を立てず、倒れたまま（あとで起き上がる）
                const d = this.deathOf(v.f, w, phase);
                const since = (w - d.wave) + (phase - d.t) + outro - KO_TIME;
                if (since < 0)
                    continue;
                ctx.globalAlpha = Math.min(1, since * 4);
                ctx.drawImage(tombSprite(), Math.round(v.x - 7), Math.round(v.y - 9));
                ctx.globalAlpha = 1;
            }
        // --- 場面演出の準備（課題の種類ごと） ---
        const scene = this.sceneOf(w);
        const cm = s.cases[wv.caseIndex];
        const sa = scene && outro === 0 ? {
            ctx, phase, frame: this.frame, scene, element: cm?.element, title: cm ? this.caseTitle(cm) : '',
            foot: this.bossFoot, body: this.bossBody, W: AW, H: AH, seed: `${s.seed}:${w}`, theme: s.theme,
            fighters: vis.map((v) => {
                const st = strikeOf.get(v.f), at = attackOf.get(v.f);
                return { f: v.f, x: v.x, y: v.y, alive: v.alive, ok: !!st?.success, tools: st?.used.tools ?? [], skills: st?.used.skills ?? [], charmed: !!st?.charmed, haunted: !!st?.haunted, atT: at?.t, excerpt: st?.excerpt ?? '', mine: this.mine.has(v.f) };
            }),
            ult: ult ? { hero: ult.f, weapon: ult.f !== undefined ? this.looks[ult.f].weapon : undefined, dmg: ult.at?.dmg ?? 0, crit: !!ult.at?.crit, skill: ult.st?.used.skills.find((x) => x !== '？') ?? '' } : undefined,
            lights: this.lights,
            ...(chain ? { chain: chain.view, figures: this.figuresOf() } : {}),
        } : null;
        if (sa)
            sceneBack(sa);
        // --- ボス ---
        // 削りきれなかったとき: ボスはたまらず逃げ出す（よろめいて震え、跳び退いて画面の外へ）。討伐隊の勝ち
        const fleeT = this.escapeAt ? (w - this.escapeAt.wave) + phase - this.escapeAt.t + outro : -1;
        const flinch = fleeT >= 0 && fleeT < 0.12 ? Math.sin(this.frame * 1.7) * 2 : 0; // ひるんで震える
        const run = fleeT >= 0.12 ? ease(clamp01((fleeT - 0.12) / 0.35)) : 0; // 跳び退いて逃げる
        if (run < 1) {
            ctx.save();
            ctx.translate(flinch - run * 230, -run * 50 - Math.sin(run * Math.PI) * 30);
            ctx.globalAlpha = 1 - Math.max(0, run - 0.6) / 0.4;
            this.drawBoss(ctx, phase, atk, rage, down, attackOf, chain, fleeT >= 0);
            ctx.restore();
        }
        // 逃げ出した跡に、土煙
        if (fleeT >= 0.12 && fleeT < 0.6) {
            const k = (fleeT - 0.12) / 0.48;
            ctx.save();
            for (let i = 0; i < 10; i++) {
                const a = i * 0.63, r = 10 + k * (26 + (i % 3) * 8);
                ctx.globalAlpha = (1 - k) * 0.55;
                ctx.fillStyle = i % 2 ? '#c9b99a' : '#8a7c66';
                ctx.beginPath();
                ctx.arc(this.bossFoot.x + Math.cos(a) * r, this.bossFoot.y - 4 + Math.sin(a) * r * 0.35, 5 + k * 6, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
        if (!chain && !(atk === 'meteor' && (scene === 'dive' || scene === 'illusion')))
            this.attackFxBack(ctx, atk, phase, vis, targeted);
        // --- 注目シーンの暗転（注目キャラとボスのあいだだけ明るく） ---
        if (spot && !ult) {
            const g = bump(phase, spot.at.t - 0.14, spot.at.t + 0.06);
            if (g > 0) {
                const v = views[spot.f];
                ctx.save();
                ctx.globalAlpha = Math.min(0.5, g * 0.6);
                ctx.fillStyle = '#05060d';
                ctx.beginPath();
                ctx.rect(-AW, -AH, AW * 3, AH * 3);
                ctx.ellipse((v.x + this.bossBody.x) / 2, v.y - 20, Math.abs(v.x - this.bossBody.x) / 2 + 44, 58, 0, 0, Math.PI * 2, true);
                ctx.fill('evenodd');
                ctx.restore();
            }
        }
        // --- 巻物（必殺技）: 頭上で巻物が広がり、足元に魔法陣が描かれる（注目キャラ） ---
        if (spot?.st.used.skills.length && this.skillWave(w) && views[spot.f].alive && !chain) {
            const v = views[spot.f];
            const [u0] = this.ultWindow(spot.st, w);
            const ks = (phase - (u0 - 0.07)) / 0.08;
            if (ks > 0 && ks < 1)
                this.scrollFx(ctx, v.x, v.y - 44, ks, this.colors[spot.f]?.main ?? '#ff6bd6');
            const kc = (phase - u0) / (spot.at.t + 0.04 - u0);
            if (kc > 0 && kc < 1 && ult?.f !== spot.f)
                this.magicCircle(ctx, v.x, v.y + 1, kc, this.colors[spot.f]?.main ?? '#ff6bd6');
        }
        // --- スキル発動のオーラ（反撃の直前） ---
        for (const v of vis) {
            const st = strikeOf.get(v.f), at = attackOf.get(v.f);
            if (!v.alive || !st?.used.skills.length || !at || !this.skillWave(w) || ult?.f === v.f)
                continue;
            const a0 = at.t - 0.12, a1 = at.t - 0.02;
            if (phase < a0 || phase > a1)
                continue;
            skillAura(ctx, this.styles[v.f], this.colors[v.f], v.x, v.y + 1, (phase - a0) / (a1 - a0), this.frame, spot?.f === v.f, (dx, dy, alpha) => drawHero(ctx, this.looks[v.f], NO_GEAR, v.x - dx, v.y + 1 + dy, { frame: this.frame, flip: true, alpha, action: 'cast', t: 0.5, ring: false }));
        }
        // --- キャラ（奥から順に） ---
        const order = vis.filter((v) => v.alive || s.mode === 'royale' || (outro === 0 && this.diedAt(v.f, w, phase))).sort((a, b) => a.y - b.y || a.x - b.x);
        for (const v of order)
            this.drawFighter(ctx, v, w, phase, outro, strikeOf.get(v.f), attackOf.get(v.f), evaded.has(v.f), hits.get(v.f), targeted(v.f), atk);
        // 決め手: あなたが正しく動けたときだけ、効いた道具（または巻物・結界）を頭上に一瞬掲げ、武器へ吸いこませてから動く
        if (!chain && outro === 0)
            this.keyItem(ctx, w, vis, strikeOf, phase, ult?.f);
        if (!chain && !(atk === 'meteor' && (scene === 'dive' || scene === 'illusion')))
            this.attackFxFront(ctx, atk, phase, vis, targeted, evaded, items);
        if (sa)
            sceneFront(sa);
        if (scene === 'breath') {
            const g = bump(phase, 0.36, 0.62);
            if (g > 0)
                this.lights.push({ x: this.bossFoot.x + 130, y: this.bossFoot.y - 36, r: 150, a: g, col: '#ff8a3a' });
        }
        if (scene === 'spell' || scene === 'ougi') {
            const g = bump(phase, 0.1, 0.6);
            if (g > 0)
                this.lights.push({ x: this.bossBody.x, y: this.bossBody.y - 20, r: 110, a: g * 0.8, col: '#c77dff' });
        }
        // --- 反撃のツール技・飛び道具・ヒット ---
        for (const v of vis) {
            const st = strikeOf.get(v.f), at = attackOf.get(v.f);
            if (!st || !at || !v.alive || ult?.f === v.f)
                continue; // 大技の主役は、自分の演出で見せる
            const big = spot?.f === v.f;
            st.used.tools.filter((id) => !TOOL_BY_ID[id]?.decoy).forEach((id, i) => {
                const t0 = at.t - 0.1 + i * 0.03;
                const k = (phase - t0) / 0.14;
                if (k < 0 || k > 1)
                    return;
                toolMove(ctx, id, this.styles[v.f], this.colors[v.f], { x: v.x, y: v.y }, this.bossBody, k, this.frame, `${w}:${v.f}:${id}`, big);
            });
            const wk = this.looks[v.f].weapon;
            const age = phase - at.t;
            if (!MELEE_WEAPONS.includes(wk) && age >= -0.06 && age < 0)
                this.projectile(ctx, wk, v, this.bossBody, 1 + age / 0.06, at.crit);
            if (age >= 0 && age < 0.09)
                this.hitSpark(ctx, this.bossBody.x + (v.f % 3) * 6 - 6, this.bossBody.y - 8 + (v.f % 4) * 4, age / 0.09, at.crit);
        }
        // --- 数字・ラベル ---
        for (const e of outro > 0 ? [] : wv.events) {
            const age = phase - e.t;
            if (age < 0 || age > 0.22)
                continue;
            const fl = age / 0.22;
            const v = 'f' in e && typeof e.f === 'number' ? views[e.f] : null;
            if (e.type === 'strike') { /* 正否は体のまわりのオーラで見せる（auras） */ }
            else if (e.type === 'hit' && v && e.dmg >= 0.5)
                this.damageNum(v.x + 6, v.y - 30, e.dmg, fl, false, 'hurt');
            else if (e.type === 'evade' && v && (this.mine.has(e.f) || this.selected === e.f || this.hovered === e.f || spot?.f === e.f))
                this.floatText(ctx, EVADE_LABEL[this.evades[e.f]], v.x, v.y - 34 - fl * 8, '#8fd3ff', 1 - fl, 8);
            else if (e.type === 'storm' && v && e.dmg >= 0.5)
                this.damageNum(v.x + 6, v.y - 30, e.dmg, fl, false, 'storm');
            else if (e.type === 'attack' && ult?.f !== e.f) {
                const bx = this.bossBody.x + ((e.f * 37) % 40) - 20, by = this.bossBody.y - 20 - ((e.f * 13) % 16);
                this.damageNum(bx, by, e.dmg, fl, e.crit, 'boss');
            }
            else if (e.type === 'item' && v) {
                ctx.globalAlpha = 1 - fl;
                ctx.drawImage(e.item === 'potion' ? potionSprite() : shieldIcon(), Math.round(v.x - 2), Math.round(v.y - 38 - fl * 12));
                ctx.globalAlpha = 1;
                this.floatText(ctx, e.item === 'potion' ? `+${Math.round(e.amount)}` : tl('シールド'), v.x + 8, v.y - 34 - fl * 10, '#7bed9f', 1 - fl);
            }
            else if (e.type === 'mpOut' && v)
                this.floatText(ctx, tl('MP切れ'), v.x, v.y - 38 - fl * 6, '#74b9ff', 1 - fl);
            else if (e.type === 'endure' && v)
                this.floatText(ctx, tl('ギリギリ耐えた！'), v.x, v.y - 40 - fl * 6, '#ffd166', 1 - fl, 9);
            else if (e.type === 'revive' && v) {
                this.floatText(ctx, tl('復活！'), v.x, v.y - 36 - fl * 8, '#7bed9f', 1 - fl, 9);
                this.lights.push({ x: v.x, y: v.y - 14, r: 30, a: 0.8 * (1 - fl), col: '#bfffd0' });
            }
            else if (e.type === 'death' && v)
                this.floatText(ctx, 'KO!', v.x, v.y - 26 - fl * 6, '#ff5a5a', 1 - Math.max(0, fl - 0.6) / 0.4, fl < 0.2 ? Math.round(8 + fl * 40) : 16);
        }
        const mvp = wv.events.find((e) => e.type === 'mvp');
        if (mvp && mvp.type === 'mvp' && phase >= mvp.t && views[mvp.f].alive)
            ctx.drawImage(crownSprite(), Math.round(views[mvp.f].x - 2), Math.round(views[mvp.f].y - 37 + Math.sin(this.frame / 5)));
        // 注目キャラの吹き出し（回答の抜粋）と、使った装備の名札
        const focus = this.selected ?? this.hovered;
        if (focus !== null && views[focus].alive) {
            const st = strikeOf.get(focus), at = attackOf.get(focus), v = views[focus];
            if (st && phase >= st.t && phase < st.t + 0.24)
                this.bubble(ctx, st.excerpt, v.x, v.y - 48, st.success);
            if (st && at) {
                const g = clamp01((phase - (at.t - 0.12)) / 0.03) * clamp01((at.t + 0.08 - phase) / 0.03);
                if (g > 0) {
                    [...st.used.skills.map((x) => ({ t: x, c: '#ff9ce6' })), ...st.used.tools.map((x) => ({ t: TOOL_SHORT[x] ?? TOOL_BY_ID[x]?.name ?? x, c: TOOL_BY_ID[x]?.decoy ? '#b8b8c8' : '#8fd3ff' }))]
                        .slice(0, 4).forEach((l, i) => this.tag(ctx, l.t, l.c, v.x, v.y - 40, g, i + 1));
                }
            }
        }
        // --- 光と影: 全体を暗くして、光源のまわりだけ抜く。光源の色は加算で重ねる ---
        this.applyLighting(ctx, scene, rage, !!chain, sa ? sceneDark(sa) : 0);
        // --- 手前の柱（カメラより速く動く。奥行き） ---
        this.foreground(ctx);
        // 画面下の進み具合（あなたの戦果が、正解するたびに積み上がる）。技名や「大技を潰した！」などの文字より奥に描く
        ctx.save();
        ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
        this.progressBar(w, phase, strikeOf);
        ctx.restore();
        if (sa)
            sceneTop(sa); // 大技の光・閃光・巨大な数字（明かりの影響を受けない）
        // --- ここから画面座標 ---
        ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
        if (rage && phase > 0.84 && phase < 0.96)
            this.rageOverlay();
        for (const fn of this.ui)
            fn();
        for (const fn of this.uiTop)
            fn();
        if (sa)
            sceneHud(sa); // 連携詠唱の字幕（画面座標）
        this.bossBar(time, rage);
        if (s.mode !== 'royale' && !chain)
            this.attackBanner(atk, phase, scene, !!ult);
        const gagNow = [...this.mine].some((f) => this.gagOf(f)?.w === w) && phase > GAG[0] - 0.02 && phase < GAG[1] + 0.02;
        // 連携詠唱の見出しは、並び終えるまでの短いあいだだけ
        if (sa && cm && !gagNow)
            sceneBanner(ctx, scene, this.caseTitle(cm), chain ? phase * 1.8 : phase, AW, ult ? tl('ボスが大技の構え！') : chain ? tl('最後の大技の構え！ みんなで連携詠唱！') : s.theme?.labels?.[scene], ult ? '#ff5a6e' : undefined);
        // あなたの動き（青い帯）: ボスの赤い帯が消えたあと、動き出す前に、答えた技の名前を見せる
        if (!gagNow && !ult && !chain && !wv.sudden && scene !== 'spell')
            this.mineBand(ctx, w, phase, strikeOf, scene);
        this.ultimate(ctx, w, phase);
        if (outro === 0)
            this.comboHud(ctx, w, phase, views);
        this.reserveStrip(ctx, views);
        this.endgame(ctx, w, phase, outro, views, down);
    }
    // 舞台に立たない参加者（控え）: 画面の下に小さな点で並べる。生きていれば明るく、脱落したら暗く
    reserveStrip(ctx, views) {
        const off = views.filter((v) => this.script.fighters[v.f].off);
        if (!off.length)
            return;
        const cols = 18;
        const rowsN = Math.ceil(off.length / cols);
        const x0 = 6, y0 = 211 - rowsN * 5 - 8; // 画面の左下（ボスの足元）。人数が多ければ上へ伸ばす
        ctx.save();
        ctx.fillStyle = 'rgba(13,16,34,0.72)';
        ctx.fillRect(x0 - 3, y0 - 3, cols * 5 + 8, rowsN * 5 + 14);
        ctx.font = `7px ${PIXEL_FONT}`;
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#9aa0c8';
        ctx.fillText(tl(`控え {0}/{1}`, off.filter((v) => v.alive).length, off.length), x0, y0 - 1);
        off.forEach((v, i) => {
            const pal = this.script.fighters[v.f].loadout.palette;
            ctx.globalAlpha = v.alive ? 1 : 0.22;
            ctx.fillStyle = v.alive ? pal : '#666a88';
            ctx.fillRect(x0 + (i % cols) * 5, y0 + 9 + Math.floor(i / cols) * 5, 3, 3);
        });
        ctx.restore();
    }
    diedAt(f, w, phase) {
        const d = this.deathOf(f, w, phase);
        return d.wave === w && phase >= d.t && phase - d.t < KO_TIME;
    }
    // --- ボス: 構え → 攻撃 → 被弾でひるむ → 撃破で倒れる ---
    drawBoss(ctx, phase, atk, rage, down, attackOf, chain = null, fleeing = false) {
        const s = this.script;
        const p = { ...BOSS_IDLE, bob: Math.round(Math.sin(this.frame / 12) * 1.5), wing: Math.sin(this.frame / 10) * 0.8, tail: Math.sin(this.frame / 14), eye: 'open' };
        let dx = 0, dy = 0, flash = false;
        const wind = clamp01((phase - 0.28) / 0.12), strike = bump(phase, 0.38, 0.5);
        if (chain) { // 連携詠唱: 最後の大技を溜め続ける（大魔法が落ちたら大きくのけぞる）
            const c = chain.view, end = c.full ? c.impact : c.rally;
            const k = win01(phase, 0.02, 0.2) * (phase < end ? 1 : 0);
            if (k > 0) {
                p.eye = 'angry';
                p.mouth = 0.8 * k;
                p.wing = 2 * k;
                p.lean = -3 * k; /* 構えたまま動かさない（口・杯・翼を出し入れすると落ち着かない）。ゆっくり息をするように揺れるだけ */
                dy = Math.round(Math.sin(this.frame / 16) * k);
            }
            if (c.full && phase >= c.impact && phase < c.impact + 0.12) {
                const h = phase - c.impact;
                p.eye = 'hurt';
                dx -= h < 0.04 ? 6 : 3;
                flash = h < 0.05 && this.frame % 4 < 2;
            }
            if (!c.full && phase >= chain.dmgAt && phase < chain.dmgAt + 0.03 && c.dmg > 0) {
                p.eye = 'hurt';
                dx -= 1;
            }
        }
        else if (atk !== 'treasure' && phase > 0.26 && phase < 0.52) {
            p.eye = 'angry';
            switch (atk) {
                case 'claw':
                    p.lean = -4 * wind + 12 * strike;
                    dx = -6 * wind + 34 * strike;
                    p.wing = 1;
                    break;
                case 'breath':
                    p.lean = -3 * wind + 4 * strike;
                    p.mouth = wind + strike;
                    p.wing = 2 * wind;
                    break;
                case 'tail':
                    p.tail = -3 * wind + 6 * strike;
                    p.lean = -2 * wind;
                    dx = 6 * strike;
                    break;
                case 'meteor':
                    p.lean = -5 * wind;
                    p.mouth = 2 * wind;
                    p.wing = 2 * wind;
                    dy = -3 * wind;
                    break;
                case 'nova':
                    p.squash = 2 * strike - wind;
                    p.mouth = 1;
                    p.wing = 2;
                    break;
            }
        }
        if (atk === 'treasure' && phase > 0.3 && phase < 0.5) {
            p.mouth = 1;
            p.wing = 1.5;
        }
        for (const e of attackOf.values()) {
            const age = phase - e.t;
            if (age >= 0 && age < 0.035) {
                flash = true;
                p.eye = 'hurt';
                dx -= 3;
            }
            else if (age >= 0.035 && age < 0.07) {
                p.eye = 'hurt';
                dx -= 1;
            }
        }
        if (rage)
            p.tint = 'rage';
        if (fleeing) {
            p.eye = 'hurt';
            p.mouth = 1;
            p.wing = 2;
            p.lean = 4;
        } // 逃げ出すときは、痛そうに背を向ける
        let alpha = 1;
        if (down >= 0) {
            p.eye = 'ko';
            p.mouth = 1;
            p.squash = Math.min(4, down * 12);
            p.wing = -2;
            p.tint = undefined;
            dy += Math.min(10, down * 30);
            alpha = down > 0.6 ? Math.max(0.25, 1 - (down - 0.6)) : 1;
            flash = down < 0.25 && this.frame % 6 < 3;
        }
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(s.boss.x + dx + 4, s.boss.y + 1, 38, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        if (rage && down < 0) {
            ctx.globalAlpha = 0.22 + Math.sin(this.frame / 4) * 0.08;
            ctx.fillStyle = '#ff3b3b';
            ctx.beginPath();
            ctx.ellipse(s.boss.x + dx, s.boss.y - BH / 2, BW / 2 + 6, BH / 2 + 4, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = alpha;
        if (s.theme?.filter || s.theme?.hue)
            ctx.filter = s.theme.filter ?? `hue-rotate(${s.theme.hue}deg)`; // ボスごとの色合い
        ctx.drawImage(bossCanvas(p, flash, (s.theme?.kind ?? 'dragon')), Math.round(s.boss.x - BW / 2 + dx), Math.round(s.boss.y - BH + 2 + dy));
        ctx.filter = 'none';
        ctx.restore();
    }
    // 攻撃エフェクト（キャラの後ろ）: 地を這う衝撃波・爆発の輪・隕石の影
    attackFxBack(ctx, atk, phase, views, targeted) {
        if (atk === 'tail') {
            const k = clamp01((phase - 0.4) / 0.1);
            if (k > 0 && k < 1) {
                const x = lerp(this.bossFoot.x + 30, 384, k);
                ctx.save();
                ctx.globalAlpha = 1 - k * 0.6;
                for (let y = 96; y < 212; y += 6) {
                    ctx.fillStyle = y % 12 ? '#e8d5a8' : '#b8a37a';
                    ctx.fillRect(Math.round(x - 6 + Math.sin(y / 9) * 4), y, 8, 4);
                }
                ctx.fillStyle = 'rgba(232,213,168,0.4)';
                ctx.fillRect(Math.round(x - 30), 94, 24, 120);
                ctx.restore();
            }
        }
        if (atk === 'nova') {
            const k = clamp01((phase - 0.38) / 0.1);
            if (k > 0 && k < 1) {
                ctx.save();
                ctx.strokeStyle = `rgba(199,125,255,${1 - k})`;
                ctx.lineWidth = 6 - k * 4;
                ctx.beginPath();
                ctx.ellipse(this.bossBody.x, this.bossBody.y + 10, k * 320, k * 140, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.strokeStyle = `rgba(255,255,255,${1 - k})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.ellipse(this.bossBody.x, this.bossBody.y + 10, k * 300, k * 130, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
        }
        if (atk === 'meteor') {
            const k = clamp01((phase - 0.28) / 0.14);
            if (k > 0 && phase < IMPACT + 0.02)
                for (const v of views) {
                    if (!targeted(v.f))
                        continue;
                    ctx.fillStyle = `rgba(0,0,0,${0.2 + k * 0.3})`;
                    ctx.beginPath();
                    ctx.ellipse(v.x, v.y + 1, 4 + k * 8, 2 + k * 3, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
        }
    }
    // 攻撃エフェクト（キャラの前）: 爪・炎・隕石・宝箱。防いだキャラの手前で止まる
    attackFxFront(ctx, atk, phase, views, targeted, evaded, items) {
        const mouth = { x: this.bossFoot.x + 46, y: this.bossFoot.y - 50 };
        const rng = new Rng(`fx:${Math.floor(this.lastTime)}`);
        for (const v of views) {
            if (!targeted(v.f))
                continue;
            const blocked = evaded.has(v.f);
            const stopX = v.x - (blocked ? 12 : 0);
            if (atk === 'claw') {
                const k = clamp01((phase - 0.4) / 0.06);
                if (k > 0 && k < 1) {
                    ctx.save();
                    ctx.globalAlpha = 1 - k * 0.5;
                    ctx.lineWidth = 2;
                    for (let i = 0; i < 3; i++) {
                        ctx.strokeStyle = i === 1 ? '#ffffff' : '#ff6b6b';
                        const ox = stopX - 10 + i * 5, oy = v.y - 28;
                        ctx.beginPath();
                        ctx.moveTo(ox, oy);
                        ctx.lineTo(ox + 14 * k, oy + 22 * k);
                        ctx.stroke();
                    }
                    ctx.restore();
                }
            }
            if (atk === 'breath') {
                const k = clamp01((phase - 0.34) / 0.12);
                if (k > 0 && k < 1) {
                    for (let i = 0; i < 14; i++) {
                        const t = clamp01(k * 1.4 - i * 0.04);
                        if (t <= 0)
                            continue;
                        const x = lerp(mouth.x, stopX, t), y = lerp(mouth.y, v.y - 12, t) + rng.range(-5, 5) * t;
                        const r = 1 + t * 3;
                        ctx.globalAlpha = 1 - Math.max(0, t - 0.85) * 5;
                        ctx.fillStyle = t > 0.8 ? '#ff5a3a' : t > 0.4 ? '#feae34' : '#ffe27a';
                        ctx.fillRect(Math.round(x - r), Math.round(y - r), Math.round(r * 2), Math.round(r * 2));
                    }
                    ctx.globalAlpha = 1;
                }
            }
            if (atk === 'meteor') {
                const k = clamp01((phase - 0.3) / 0.12);
                if (k > 0 && k < 1) {
                    const y = lerp(-20, blocked ? v.y - 30 : v.y - 6, k), x = lerp(v.x + 30, stopX + 4, k);
                    for (let i = 1; i <= 4; i++) {
                        ctx.fillStyle = `rgba(254,174,52,${0.5 - i * 0.1})`;
                        ctx.fillRect(Math.round(x + i * 3), Math.round(y - i * 5), 4, 4);
                    }
                    ctx.fillStyle = '#5a3a2a';
                    ctx.fillRect(Math.round(x - 4), Math.round(y - 4), 9, 9);
                    ctx.fillStyle = '#8a5a3a';
                    ctx.fillRect(Math.round(x - 3), Math.round(y - 3), 5, 5);
                    ctx.fillStyle = '#ff5a3a';
                    ctx.fillRect(Math.round(x + 2), Math.round(y - 4), 3, 3);
                }
                const kb = clamp01((phase - 0.42) / 0.06);
                if (kb > 0 && kb < 1)
                    this.boom(ctx, stopX, blocked ? v.y - 30 : v.y - 4, kb, '#feae34');
            }
        }
        if (atk === 'treasure') {
            for (const v of views) {
                if (!items.has(v.f))
                    continue;
                const k = clamp01((phase - 0.32) / 0.1);
                if (k <= 0 || phase > 0.5)
                    continue;
                const x = lerp(this.bossBody.x + 20, v.x - 10, k), y = lerp(this.bossBody.y - 30, v.y - 4, k) - Math.sin(k * Math.PI) * 30;
                ctx.fillStyle = '#7a4a22';
                ctx.fillRect(Math.round(x - 4), Math.round(y - 3), 9, 7);
                ctx.fillStyle = '#feae34';
                ctx.fillRect(Math.round(x - 4), Math.round(y - 1), 9, 2);
            }
        }
    }
    boom(ctx, x, y, k, col) {
        ctx.save();
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = col;
        for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            ctx.fillRect(Math.round(x + Math.cos(a) * k * 16), Math.round(y + Math.sin(a) * k * 10), 3, 3);
        }
        if (k < 0.4) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(x, y, 8 * (1 - k), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
    // --- キャラ1体: 回答 → 構え → 回避 or 被弾 → 反撃 ---
    drawFighter(ctx, v, w, phase, outro, st, at, evaded, hit, isTarget, atk) {
        const s = this.script;
        let ox = 0, oy = 0, flash = false, tilt = 0;
        const ghosts = [];
        let action = 'idle', act01 = 0;
        const set = (a, t) => { action = a; act01 = clamp01(t); };
        const win = (a, b) => clamp01((phase - a) / (b - a)); // 区間の進み具合 0→1
        // 回答
        if (st && phase > st.t - 0.03 && phase < st.t + 0.04)
            set(st.success ? 'cast' : 'hurt', (phase - (st.t - 0.03)) / 0.07);
        // 構え: 攻撃が来る前に腰を落としていく（だんだん深くなる）
        const brace = win(0.28, 0.38);
        if (isTarget && atk !== 'treasure' && brace > 0 && phase < 0.38) {
            set('guard', brace);
            oy += ease(brace) * 1.5;
        }
        // 回避: 溜め → 動作 → 着地・戻り を、区間ごとのイージングでつなぐ
        // 尾のなぎはらいは、竜に近い者から順に届く（跳ぶ順番がずれる）
        const lag = this.sceneOf(w) === 'tail' ? clamp01((v.x - 150) / 234) * 0.12 : this.sceneOf(w) === 'breath' ? clamp01((v.x - 150) / 234) * 0.05 : 0;
        // 巻物の大技カウンターの主役: いつもの回避・反撃の動きの代わりに、大技の動き（跳躍・乱舞・詠唱）
        const ult = this.ultOf(w);
        const uHero = ult?.f === v.f && v.alive;
        const upose = uHero ? ultPose(ult.scene, phase, { x: v.x, y: v.y }, this.bossFoot, this.bossBody, this.frame, this.looks[v.f].weapon) : null;
        let flip = true;
        if (upose) {
            ox += upose.ox;
            oy += upose.oy;
            tilt += upose.rot;
            flip = upose.flip;
            set(upose.action, upose.t);
            ghosts.push(...upose.ghosts);
        }
        // 連携詠唱: 並ぶあいだは歩き、自分の節では両手を上げて唱える。外した人はあわてて汗をかき、みんなも苦笑い。
        // 大魔法が決まったら、並んだ全員で手を掲げる
        const chain = this.chainOf(w);
        if (chain && v.alive && outro === 0 && chain.line.has(v.f)) {
            const c = chain.view;
            if ((phase > CHAIN_T.gather && phase < CHAIN_T.lined) || (phase > 0.9 && phase < 0.98))
                set('walk', 0);
            const i = Math.floor((phase - c.start) / c.verse);
            if (phase >= c.start && i < c.chanters.length && c.chanters[i] === v.f && (c.full || i <= c.upto)) {
                const k = (phase - verseAt(c, i)) / c.verse;
                if (c.full || i < c.upto || phase < c.breakT) {
                    set('cast', k);
                    oy -= Math.sin(clamp01(k) * Math.PI) * 2;
                }
            }
            if (!c.full && phase >= c.breakT && phase < c.breakT + 0.3) {
                const me = c.chanters[c.upto] === v.f;
                if (me && phase < c.breakT + 0.06) {
                    set('hurt', 0);
                    oy += Math.sin(this.frame) * 0.5;
                }
                else if (me || phase > c.breakT + 0.08)
                    set('pass', 0);
            }
            if (c.full && phase >= c.doneT && phase < c.impact + 0.12) {
                set('cast', 0.5);
                oy -= 2;
            }
        }
        if (evaded && !uHero) {
            const u = win(0.36 + lag, 0.56 + lag); // 回避の全体進行
            if (u > 0 && u < 1) {
                const arc = Math.sin(u * Math.PI); // 0→1→0 のなめらかな山
                switch ((this.sceneOf(w) && SCENE_EVADE[this.sceneOf(w)]) || this.evades[v.f]) {
                    case 'jump': { // 燕返し: 高く跳んで宙返り
                        this.dust(ctx, v.x, v.y, u < 0.15 ? u / 0.15 : (u - 0.85) / 0.15);
                        oy += -Math.sin(u * Math.PI) * 34;
                        ox += Math.sin(u * Math.PI) * 4;
                        tilt = -u * Math.PI * 2;
                        set('dash', 0);
                        for (let i = 1; i <= 3; i++) {
                            const ui = Math.max(0, u - i * 0.05);
                            ghosts.push({ x: Math.sin(ui * Math.PI) * 4, y: -Math.sin(ui * Math.PI) * 34, a: 0.3 / i });
                        }
                        break;
                    }
                    case 'crawl': { // 地這い: 地面に伏せる
                        oy += arc * 6;
                        tilt = arc * 1.2;
                        set('guard', 1);
                        break;
                    }
                    case 'step': { // 影踏み: 横へすり抜け、残像を残す
                        ox += ease(arc) * 16;
                        set('dash', 0);
                        for (let i = 1; i <= 4; i++) {
                            const ui = Math.max(0, u - i * 0.05), ai = Math.sin(ui * Math.PI);
                            ghosts.push({ x: ease(ai) * 16, y: 0, a: 0.35 / i });
                        }
                        break;
                    }
                    case 'dodge': {
                        this.dust(ctx, v.x + 11, v.y, (u - 0.8) / 0.2);
                        ox += ease(arc) * 11;
                        oy += -Math.sin(Math.pow(u, 0.8) * Math.PI) * 17 + (u < 0.15 ? ease(u / 0.15) * 2 : 0);
                        tilt = -arc * 0.35;
                        set(u < 0.15 || u > 0.85 ? 'guard' : 'dash', u < 0.15 ? u / 0.15 : u > 0.85 ? (1 - u) / 0.15 : 0);
                        for (let i = 1; i <= 3; i++) {
                            const ui = Math.max(0, u - i * 0.07), ai = Math.sin(ui * Math.PI);
                            ghosts.push({ x: ease(ai) * 11, y: -Math.sin(Math.pow(ui, 0.8) * Math.PI) * 17, a: 0.3 / i });
                        }
                        break;
                    }
                    case 'block': {
                        ox -= Math.sin(clamp01((u - 0.3) / 0.7) * Math.PI) * 3; // 受け止めて少し押される
                        set('guard', Math.min(1, u * 5));
                        this.guardFx(ctx, v.x - 10, v.y - 12, arc);
                        if (u > 0.25 && u < 0.6)
                            this.hitSpark(ctx, v.x - 14, v.y - 12, (u - 0.25) / 0.35, false); // 盾で受けた火花
                        this.dust(ctx, v.x + 2, v.y, (u - 0.3) / 0.5); // 押されて足元が滑る
                        break;
                    }
                    case 'barrier': {
                        set('cast', 0.2 + u * 0.6);
                        oy -= arc * 2;
                        this.barrierFx(ctx, v.x, v.y - 12, arc);
                        break;
                    }
                    case 'shoot': {
                        set('attack', u * 0.9);
                        ox -= Math.sin(clamp01((u - 0.35) / 0.4) * Math.PI) * 2.5; // 発射の反動
                        if (u > 0.3 && u < 0.75)
                            this.projectile(ctx, this.looks[v.f].weapon, v, { x: v.x - 30, y: v.y - 4 }, clamp01((u - 0.3) / 0.35), false);
                        break;
                    }
                    case 'slash': {
                        set('attack', u);
                        ox -= ease(clamp01(u * 2)) * 4 - ease(clamp01((u - 0.5) * 2)) * 4; // 踏み込んで戻る
                        this.slashFx(ctx, v.x - 12, v.y - 14, clamp01((u - 0.35) / 0.3));
                        break;
                    }
                }
            }
        }
        // 幻術にかかったキャラは、ふらふら揺れる
        if (st?.charmed && phase > 0.32 && phase < 0.9) {
            ox += Math.sin(this.frame / 3) * 1.5;
            tilt += Math.sin(this.frame / 5) * 0.12;
        }
        // 被弾: 素早く吹き飛んで、ゆっくり戻る
        if (hit && phase >= IMPACT + lag && phase < IMPACT + lag + 0.16) {
            const k = (phase - IMPACT - lag) / 0.16;
            set('hurt', 0);
            ox += Math.pow(Math.sin(Math.pow(k, 0.55) * Math.PI), 1.2) * 8;
            oy -= Math.sin(Math.min(1, k * 1.6) * Math.PI) * 4;
            tilt += Math.sin(Math.min(1, k * 1.4) * Math.PI) * 0.25;
            if (phase - IMPACT - lag < 0.025)
                flash = true;
        }
        // 反撃: 近づく武器は、助走 → 一撃 → 余韻 → 戻る を別々のイージングで
        if (at && !uHero) {
            const melee = MELEE_WEAPONS.includes(this.looks[v.f].weapon);
            if (melee) {
                // ため（後ろへ沈む）→ 一瞬で踏み込む → 一撃（振りの軌跡）→ 余韻で止まる → ゆっくり戻る
                const tx = this.bossFoot.x + 46, ty = Math.max(this.bossFoot.y - 30, Math.min(this.bossFoot.y + 10, v.y));
                const wind = win(at.t - 0.2, at.t - 0.12), go = win(at.t - 0.12, at.t - 0.02), back = win(at.t + 0.08, at.t + 0.2);
                if (wind > 0 && back < 1) {
                    const g = go * go * go * (1 - ease(back)); // 加速しながら一気に（イーズイン）
                    ox += (tx - v.x) * g + 4 * ease(wind) * (1 - go);
                    oy += (ty - v.y) * g - Math.sin(go * Math.PI) * 6 * (1 - back) + 1.5 * ease(wind) * (1 - go);
                    if (go <= 0)
                        set('guard', wind);
                    else if (phase < at.t - 0.02) {
                        set('dash', 0);
                        for (let i = 1; i <= 4; i++) {
                            const gi = Math.max(0, go - i * 0.07);
                            ghosts.push({ x: (tx - v.x) * gi ** 3, y: (ty - v.y) * gi ** 3 - Math.sin(gi * Math.PI) * 6, a: 0.28 / i });
                        }
                    }
                    else if (phase < at.t + 0.08)
                        set('attack', 0.55 + win(at.t - 0.02, at.t + 0.08) * 0.3);
                    else
                        set('walk', 0);
                    if (phase >= at.t - 0.02 && phase < at.t + 0.06)
                        this.smearFx(ctx, v.x + ox - 8, v.y + oy - 14, win(at.t - 0.02, at.t + 0.06), at.crit, this.colors[v.f]?.main ?? '#ffffff');
                }
            }
            else if (phase > at.t - 0.14 && phase < at.t + 0.06) {
                const k = win(at.t - 0.14, at.t + 0.06);
                set('attack', k);
                ox -= Math.sin(clamp01((k - 0.5) * 2) * Math.PI) * 2; // 撃った反動
            }
        }
        for (const e of s.waves[w].events)
            if (e.type === 'storm' && e.f === v.f && phase >= e.t && phase - e.t < 0.04)
                set('hurt', 0);
        let rot = tilt, alpha = upose ? upose.alpha : 1;
        // 連携詠唱: 唱えない人（倒れている人も）は、輪ができるあいだに姿を消し、終わると戻ってくる
        const ch = this.chainOf(w);
        if (ch && outro === 0 && !ch.view.chanters.includes(v.f)) {
            const gk = ease(clamp01((phase - CHAIN_T.gather) / (CHAIN_T.lined - CHAIN_T.gather))) * (1 - ease(clamp01((phase - 0.9) / 0.08)));
            alpha *= 1 - gk;
            if (alpha < 0.02)
                return;
        }
        // 乱舞の必殺技のあいだは、主役以外を少し沈めて、主役の動きを目立たせる
        if (ult?.f !== undefined && ult.scene === 'rush' && !uHero && v.alive)
            alpha *= 1 - 0.5 * win(0.34, 0.38) * (1 - win(0.66, 0.72));
        if (!v.alive) {
            const d = this.deathOf(v.f, w, phase);
            const k = d.wave === w ? clamp01((phase - d.t) / KO_TIME) : 1;
            set('ko', k);
            rot = (Math.PI / 2) * ease(k * 1.4);
            oy -= Math.sin(Math.min(1, k * 2) * Math.PI) * 6;
            // 討伐: 倒れたまま、うっすら残る（正しく動ければ起き上がる）。ほかのモードは消えて墓標になる
            alpha = s.mode === 'royale' ? 1 - Math.min(0.45, Math.max(0, k - 0.75) * 2) : 1 - Math.max(0, k - 0.75) * 4;
        }
        const winNow = this.winner === v.f && v.alive && (outro > 0 || (w === s.waves.length - 1 && phase > (s.waves[w].events.find((e) => e.type === 'winner')?.t ?? 2)));
        if (winNow)
            set('victory', (this.frame % 36) / 36);
        const x = v.x + ox, y = v.y + oy;
        if (this.mine.has(v.f)) {
            ctx.save();
            // 足元の金の輪と、立ちのぼる光（自分のキャラがひと目で分かるように）
            const g = ctx.createLinearGradient(0, v.y - 40, 0, v.y + 2);
            g.addColorStop(0, 'rgba(255,209,102,0)');
            g.addColorStop(1, 'rgba(255,209,102,0.28)');
            ctx.fillStyle = g;
            ctx.fillRect(Math.round(v.x - 11), Math.round(v.y - 40), 22, 42);
            ctx.strokeStyle = '#ffd166';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.7 + Math.sin(this.frame / 6) * 0.3;
            ctx.beginPath();
            ctx.ellipse(v.x, v.y + 1, 14, 5.5, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
            if (v.alive && alpha > 0)
                this.youMarker(upose ? x : v.x, (upose ? y : v.y) + 9); // 足元のすぐ下（上のキャラを指して見えないように）。大技の最中は主役についていく
        }
        if (this.selected === v.f || this.hovered === v.f) {
            ctx.strokeStyle = '#ffffff';
            ctx.beginPath();
            ctx.ellipse(v.x, v.y + 1, 11, 4, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
        if (isTarget && atk !== 'treasure' && phase > 0.28 && phase < IMPACT && v.alive && this.frame % 10 < 6) {
            const p = this.proj(v.x, v.y - 46);
            this.uiTop.push(() => this.labelAt(tl('！'), p.x, p.y, '#ff5a6e', 10));
        }
        // お供: 反撃のときいっしょにボスへ飛んでいく
        const fam = [null];
        if (at && !uHero) {
            const g = ease(bump(phase, at.t - 0.1, at.t + 0.06));
            if (g > 0) {
                const home = familiarHome(0, true, this.frame);
                fam[0] = { x: lerp(home.x, this.bossBody.x - v.x - 5, g), y: lerp(home.y, this.bossBody.y - v.y - 10, g) - Math.sin(g * Math.PI) * 14 };
            }
        }
        for (const gh of ghosts)
            drawHero(ctx, this.looks[v.f], NO_GEAR, v.x + gh.x, v.y + 1 + gh.y, { frame: this.frame, flip, alpha: gh.a, action: gh.act ?? 'dash', ring: false });
        const skillGlow = uHero ? bump(phase, 0.28, 0.66) : st?.used.skills.length && at && this.skillWave(w) ? bump(phase, at.t - 0.12, at.t) : 0;
        let look = this.looks[v.f];
        // 役に立たない道具の一発ギャグ（自分の冒険者だけ・討伐の中で一度だけ）
        const gag = this.mine.has(v.f) ? this.gagOf(v.f) : null;
        if (gag && gag.w === w && v.alive) {
            const k = (phase - GAG[0]) / (GAG[1] - GAG[0]);
            if (k > 0 && k < 1) {
                const r = this.decoyGag(ctx, v.x, v.y, gag.tool, k);
                action = r.action;
                act01 = r.t;
                look = { ...look, weapon: TOOL_BY_ID[gag.tool].weapon };
            }
        }
        // 巻物の飾り（頭上を回る）は自分の冒険者だけ。ほかの人は、巻物を持っていれば本数の分からない燐光だけ
        const own = this.mine.has(v.f), gear = own ? this.gears[v.f] : { ...this.gears[v.f], charms: [] };
        if (!own && this.gears[v.f].charms.length && v.alive && (alpha ?? 1) > 0.5)
            this.motes(ctx, x, y, v.f);
        if (st && v.alive && outro === 0 && !this.chainOf(w))
            this.aura(ctx, x, y, v.f, st, phase);
        drawHero(ctx, look, gear, x, y + 1, {
            frame: this.frame + v.f * 7, flip, flash, action, t: act01, rot, alpha,
            ...(st?.charmed && phase > GUARD_HIT + 0.04 && phase < 0.95 && v.alive ? { eyes: 'swirl' } : {}),
            famPos: fam, skillGlow, teamColor: this.teamColor(v.f),
        });
        if (v.alive) {
            this.hpBar(ctx, v);
            if (v.shield > 0)
                ctx.drawImage(shieldIcon(), Math.round(v.x + 9), Math.round(v.y + 2));
        }
    }
    // 秘めた力の燐光: 巻物を持つ人のまわりを、暖かい光の粒がゆっくり漂う（数は持ち物に関係しない）
    motes(ctx, x, y, f) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 4; i++) {
            const a = this.frame / 40 + i * 1.57 + f, r = 10 + Math.sin(this.frame / 23 + i) * 2;
            const px = x + Math.cos(a) * r, py = y - 16 + Math.sin(a * 1.3) * 9;
            const g = ctx.createRadialGradient(px, py, 0, px, py, 3);
            g.addColorStop(0, 'rgba(255,224,150,0.85)');
            g.addColorStop(1, 'rgba(255,200,120,0)');
            ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.frame / 9 + i * 2 + f);
            ctx.fillStyle = g;
            ctx.fillRect(px - 3, py - 3, 6, 6);
            ctx.fillStyle = '#fff3c8';
            ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
        }
        ctx.restore();
    }
    hpBar(ctx, v) {
        const x = Math.round(v.x - 8), y = Math.round(v.y + 4);
        ctx.fillStyle = '#1a1c2c';
        ctx.fillRect(x, y, 16, 3);
        const k = v.hp / 100;
        ctx.fillStyle = k > 0.5 ? '#63c74d' : k > 0.25 ? '#feae34' : '#e43b44';
        ctx.fillRect(x + 1, y + 1, Math.max(0, Math.round(14 * k)), 1);
    }
    guardFx(ctx, x, y, g) {
        ctx.save();
        ctx.strokeStyle = `rgba(143,211,255,${g})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x + 6, y, 9 + g * 2, Math.PI * 0.6, Math.PI * 1.4);
        ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${g})`;
        for (let i = 0; i < 4; i++)
            ctx.fillRect(Math.round(x - 2 - g * 6), Math.round(y - 6 + i * 4), 2, 1);
        ctx.restore();
    }
    barrierFx(ctx, x, y, g) {
        ctx.save();
        ctx.globalAlpha = g;
        ctx.strokeStyle = '#7cf3ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i <= 6; i++) {
            const a = (i / 6) * Math.PI * 2 + this.frame / 20;
            const px = x + Math.cos(a) * 14, py = y + Math.sin(a) * 14;
            if (i)
                ctx.lineTo(px, py);
            else
                ctx.moveTo(px, py);
        }
        ctx.stroke();
        ctx.fillStyle = 'rgba(124,243,255,0.15)';
        ctx.fill();
        ctx.restore();
    }
    slashFx(ctx, x, y, k) {
        if (k <= 0 || k >= 1)
            return;
        ctx.save();
        ctx.globalAlpha = 1 - k * 0.6;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3 - k * 2;
        ctx.beginPath();
        ctx.arc(x + 6, y + 4, 12, Math.PI * (0.7 + k * 0.2), Math.PI * (1.5 + k * 0.2));
        ctx.stroke();
        ctx.restore();
    }
    applyLighting(ctx, scene, rage, chain = false, extra = 0) {
        const { w: AW, h: AH } = this.script.arena;
        if (!this.lightmap) {
            this.lightmap = document.createElement('canvas');
            this.lightmap.width = AW;
            this.lightmap.height = AH;
        }
        const lm = this.lightmap.getContext('2d');
        const dark = Math.min(0.9, (scene === 'fog' ? 0.62 : scene === 'illusion' ? 0.5 : chain ? 0.55 : rage ? 0.45 : 0.38) + extra);
        lm.globalCompositeOperation = 'source-over';
        lm.clearRect(0, 0, AW, AH);
        lm.fillStyle = `rgba(6,4,18,${dark})`;
        lm.fillRect(0, 0, AW, AH);
        lm.globalCompositeOperation = 'destination-out';
        for (const l of this.lights) {
            if (l.a <= 0 || l.r <= 0)
                continue;
            const g = lm.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
            g.addColorStop(0, `rgba(0,0,0,${Math.min(1, l.a)})`);
            g.addColorStop(0.5, `rgba(0,0,0,${Math.min(1, l.a) * 0.55})`);
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
            g.addColorStop(0, `rgba(${r},${gg},${b},${0.16 * Math.min(1, l.a)})`);
            g.addColorStop(1, `rgba(${r},${gg},${b},0)`);
            ctx.fillStyle = g;
            ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
        }
        ctx.restore();
    }
    // 手前の柱と、ただよう塵（カメラより速く動かして、奥行きを出す）
    foreground(ctx) {
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
    // 巻物が左右に広がり、光る文字が流れる
    scrollFx(ctx, x, y, k, color) {
        const open = ease(Math.min(1, k * 2.2)), a = Math.min(1, k * 6, (1 - k) * 6);
        const w = 4 + open * 34;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = '#e8d5a8';
        ctx.fillRect(Math.round(x - w / 2), Math.round(y - 5), Math.round(w), 10);
        ctx.fillStyle = '#b08a5a';
        ctx.fillRect(Math.round(x - w / 2), Math.round(y + 4), Math.round(w), 1);
        ctx.fillStyle = '#7a4a22';
        ctx.fillRect(Math.round(x - w / 2 - 2), Math.round(y - 7), 3, 14);
        ctx.fillRect(Math.round(x + w / 2 - 1), Math.round(y - 7), 3, 14);
        // 流れる光の文字
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = color;
        const n = Math.floor(open * 8);
        for (let i = 0; i < n; i++) {
            const gx = x - w / 2 + 4 + i * 4, gy = y - 2 + ((i * 3 + this.frame) % 4) - 1;
            ctx.fillRect(Math.round(gx), Math.round(gy), 2, 2);
        }
        if (k > 0.5) { // 文字が浮かび上がって消える
            for (let i = 0; i < 6; i++) {
                const t = (k - 0.5) * 2;
                ctx.globalAlpha = a * (1 - t);
                ctx.fillRect(Math.round(x - 12 + i * 5), Math.round(y - 6 - t * 18 - (i % 2) * 4), 2, 2);
            }
        }
        ctx.restore();
    }
    // 足元の魔法陣: 外輪と内輪が逆向きに回り、ルーンの目盛りと六芒星が光る
    magicCircle(ctx, x, y, k, color) {
        const grow = ease(Math.min(1, k * 4)), a = Math.min(1, (1 - k) * 5);
        this.lights.push({ x, y: y - 8, r: 55 * grow, a, col: color });
        const r = 20 * grow, rot = this.frame / 25;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.translate(x, y);
        ctx.scale(1, 0.38);
        ctx.globalAlpha = 0.25 * a;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = a;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 16; i++) {
            const t = rot + (i / 16) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(t) * r * 0.8, Math.sin(t) * r * 0.8);
            ctx.lineTo(Math.cos(t) * r * (i % 2 ? 0.92 : 0.98), Math.sin(t) * r * (i % 2 ? 0.92 : 0.98));
            ctx.stroke();
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        for (const off of [0, Math.PI / 3]) {
            ctx.beginPath();
            for (let i = 0; i <= 3; i++) {
                const t = -rot * 1.5 + off + (i / 3) * Math.PI * 2;
                const px = Math.cos(t) * r * 0.74, py = Math.sin(t) * r * 0.74;
                i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
            }
            ctx.stroke();
        }
        ctx.restore();
        // 立ちのぼる光
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = color;
        for (let i = 0; i < 8; i++) {
            const t = ((this.frame / 30 + i / 8) % 1);
            ctx.globalAlpha = a * (1 - t) * 0.8;
            ctx.fillRect(Math.round(x - r * 0.8 + (i * 7) % (r * 1.6 + 1)), Math.round(y - t * 30), 1, 3);
        }
        ctx.restore();
    }
    // 着地の土ぼこり
    dust(ctx, x, y, k) {
        if (k <= 0 || k >= 1)
            return;
        ctx.save();
        ctx.fillStyle = '#d8ccb0';
        for (const s of [-1, 1])
            for (let i = 0; i < 3; i++) {
                ctx.globalAlpha = (1 - k) * 0.7;
                const r = 1.5 + k * 3 - i * 0.4;
                ctx.beginPath();
                ctx.arc(x + s * (4 + k * 10 + i * 3), y - i - k * 3, Math.max(0.5, r), 0, Math.PI * 2);
                ctx.fill();
            }
        ctx.restore();
    }
    // 自分の冒険者が、役に立たない道具を初めて使った回（討伐の中で一度だけギャグにする）
    gagCache = new Map();
    gagOf(f) {
        if (this.gagCache.has(f))
            return this.gagCache.get(f);
        let out = null;
        this.script.waves.some((wv, w) => wv.events.some((e) => {
            if (e.type !== 'strike' || e.f !== f)
                return false;
            const d = e.used.tools.find((t) => TOOL_BY_ID[t]?.decoy);
            if (d)
                out = { w, tool: d };
            return !!d;
        }));
        this.gagCache.set(f, out);
        return out;
    }
    // ジャーン！と掲げる → きらきら → …何も起きない。道具がぽてっと落ちて、冷や汗
    decoyGag(ctx, x, y, id, k) {
        const def = TOOL_BY_ID[id];
        const sp = weaponSprite(def.weapon, undefined, true);
        const lift = ease(Math.min(1, k / 0.18));
        const fall = clamp01((k - 0.62) / 0.14);
        const ix = x - 6 + fall * 10, iy = y - 30 - lift * 10 + fall * fall * 30 * (fall < 1 ? 1 : 1);
        ctx.save();
        // 掲げた道具のまわりのきらきら（落ちるまで）
        if (k > 0.1 && k < 0.6) {
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 6; i++) {
                const a = this.frame / 6 + (i / 6) * Math.PI * 2, r = 9 + Math.sin(this.frame / 4 + i) * 2;
                ctx.fillStyle = i % 2 ? '#ffe27a' : '#ffffff';
                ctx.fillRect(Math.round(ix + Math.cos(a) * r), Math.round(iy + Math.sin(a) * r * 0.7), 2, 2);
            }
            ctx.globalCompositeOperation = 'source-over';
        }
        ctx.translate(Math.round(ix), Math.round(Math.min(iy, y - 2)));
        ctx.rotate(fall * 1.8);
        ctx.scale(1.5, 1.5); // 武器の絵が大きくなったので、掲げるときの拡大は控えめに
        ctx.drawImage(sp, -Math.floor(sp.width / 2), -Math.floor(sp.height / 2));
        ctx.restore();
        // ことば
        const p = this.proj(x - 46, y - 30);
        this.uiTop.push(() => {
            const c = this.ctx;
            c.save();
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            if (k < 0.55) {
                const pop = k < 0.12 ? 1 + (1 - k / 0.12) * 0.8 : 1;
                c.font = `bold ${Math.round(12 * pop)}px ${PIXEL_FONT}`;
                c.lineWidth = 3;
                c.strokeStyle = '#5a2a00';
                c.strokeText(tl(`ジャーン！ {0}！`, def.name), p.x, p.y);
                c.fillStyle = this.frame % 6 < 3 ? '#ffe27a' : '#ffffff';
                c.fillText(tl(`ジャーン！ {0}！`, def.name), p.x, p.y);
            }
            else {
                const a = Math.min(1, (k - 0.55) * 8);
                c.globalAlpha = a;
                c.font = `8px ${PIXEL_FONT}`;
                const msg = def.decoy ?? tl('…何も起きなかった');
                const w = Math.ceil(c.measureText(msg).width) + 12;
                const bx = Math.round(Math.max(2, Math.min(this.script.arena.w - w - 2, p.x - w / 2)));
                c.fillStyle = 'rgba(40,40,52,0.92)';
                c.fillRect(bx, Math.round(p.y - 7), w, 14);
                c.fillStyle = '#c8c8d4';
                c.fillText(msg, bx + w / 2, p.y);
                c.font = `bold 11px ${PIXEL_FONT}`;
                c.fillStyle = '#9aa0c8';
                c.fillText(tl('シーン……'), p.x, p.y - 14);
            }
            c.restore();
        });
        // 冷たい風（何も起きなかった感）
        if (k > 0.62) {
            ctx.save();
            ctx.strokeStyle = '#c8d0e8';
            ctx.lineWidth = 1;
            for (let i = 0; i < 3; i++) {
                const t = ((this.frame / 20 + i / 3) % 1);
                ctx.globalAlpha = (1 - t) * 0.6;
                ctx.beginPath();
                ctx.moveTo(x + 30 - t * 60, y - 30 + i * 7);
                ctx.lineTo(x + 18 - t * 60, y - 30 + i * 7);
                ctx.stroke();
            }
            ctx.restore();
        }
        return k < 0.55 ? { action: 'victory', t: 0.25 } : { action: 'pass', t: 0 };
    }
    // 振りの軌跡（スミア）: 弧を描く三日月形の光。会心は金色で大きく
    smearFx(ctx, x, y, k, crit, color) {
        if (k <= 0 || k >= 1)
            return;
        this.lights.push({ x, y, r: 35, a: 1 - k, col: color });
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const r = crit ? 22 : 17;
        const a0 = Math.PI * (-0.55 + k * 0.15), a1 = Math.PI * (0.55 + k * 0.15);
        const fade = 1 - k;
        for (const [w, col, al] of [[7, color, 0.35], [4, crit ? '#ffe27a' : '#ffffff', 0.8], [1.5, '#ffffff', 1]]) {
            ctx.globalAlpha = al * fade;
            ctx.strokeStyle = col;
            ctx.lineWidth = w * (1 - k * 0.5);
            ctx.beginPath();
            ctx.arc(x + 4, y + 4, r, Math.PI + a0, Math.PI + a1);
            ctx.stroke();
        }
        ctx.restore();
    }
    projectile(ctx, weapon, a, b, k, crit) {
        const arc = weapon === 'bow' ? 12 : 4;
        const at = (kk) => ({ x: lerp(a.x, b.x, kk), y: lerp(a.y - 10, b.y - 8, kk) - Math.sin(kk * Math.PI) * arc });
        ctx.save();
        for (let i = 1; i <= 4; i++) {
            const p = at(Math.max(0, k - i * 0.06));
            ctx.globalAlpha = 0.5 - i * 0.1;
            ctx.fillStyle = weapon === 'bow' ? '#ffffff' : '#c77dff';
            ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
        }
        ctx.globalAlpha = 1;
        const p = at(k), rx = Math.round(p.x), ry = Math.round(p.y);
        if (weapon === 'bow') {
            ctx.fillStyle = '#8b5a2b';
            ctx.fillRect(rx - 3, ry, 7, 1);
            ctx.fillStyle = '#e8e8f0';
            ctx.fillRect(rx - 4, ry - 1, 1, 3);
        }
        else {
            const r = crit ? 3 : 2;
            ctx.fillStyle = weapon === 'blaster' ? '#63d471' : weapon === 'wand' ? '#c77dff' : '#5fcde4';
            ctx.fillRect(rx - r, ry - r, r * 2 + 1, r * 2 + 1);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(rx - 1, ry - 1, 2, 2);
        }
        ctx.restore();
    }
    // 当たりの火花: 中心の白い閃光 → 放射状の光の筋 → 広がる輪 → 飛び散る粒
    hitSpark(ctx, x, y, k, crit) {
        this.lights.push({ x, y, r: (crit ? 60 : 40) * (1 - k * 0.5), a: 1 - k, col: crit ? '#ffcf3a' : '#9fe0ff' });
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const rng = new Rng(`spark:${Math.round(x)}:${Math.round(y)}`);
        const col = crit ? '#ffcf3a' : '#9fe0ff';
        if (k < 0.35) {
            const r = (crit ? 14 : 9) * (1 - k / 0.35);
            const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6);
            g.addColorStop(0, 'rgba(255,255,255,1)');
            g.addColorStop(0.4, crit ? 'rgba(255,220,90,0.8)' : 'rgba(160,220,255,0.7)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, y, r * 1.6, 0, Math.PI * 2);
            ctx.fill();
        }
        const n = crit ? 10 : 6;
        ctx.strokeStyle = col;
        ctx.lineCap = 'round';
        for (let i = 0; i < n; i++) {
            const a = rng.range(0, Math.PI * 2), len = rng.range(8, crit ? 26 : 16);
            const r0 = 2 + k * len * 0.6, r1 = r0 + len * (1 - k);
            ctx.globalAlpha = 1 - k;
            ctx.lineWidth = Math.max(0.5, 2 - k * 2);
            ctx.beginPath();
            ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0 * 0.8);
            ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1 * 0.8);
            ctx.stroke();
        }
        ctx.globalAlpha = (1 - k) * 0.8;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(x, y, 3 + k * (crit ? 22 : 14), 2 + k * (crit ? 16 : 10), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = crit ? '#fff2a0' : '#ffffff';
        for (let i = 0; i < (crit ? 14 : 8); i++) {
            const a = rng.range(0, Math.PI * 2), sp = rng.range(10, crit ? 30 : 20);
            ctx.globalAlpha = 1 - k;
            ctx.fillRect(Math.round(x + Math.cos(a) * sp * k), Math.round(y + Math.sin(a) * sp * k * 0.8 + k * k * 10), 1, 1);
        }
        ctx.restore();
    }
    // ダメージの数字: ポンと大きく飛び出して弾み、縮んで消える。会心は金色で揺れ、「CRITICAL」の文字つき
    damageNum(wx, wy, value, age01, crit, kind) {
        const p = this.proj(wx, wy);
        const k = age01;
        const pop = k < 0.12 ? 1 + (1 - k / 0.12) * (crit ? 1.2 : 0.7) : k < 0.22 ? 1 - Math.sin(((k - 0.12) / 0.1) * Math.PI) * 0.12 : 1;
        const rise = k < 0.2 ? -Math.sin((k / 0.2) * Math.PI / 2) * 10 : -10 + (k - 0.2) * 4;
        const alpha = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
        const base = kind === 'boss' ? (crit ? 15 : 11) : 10;
        const size = Math.round(base * pop * (1 + (this.cam.z - 1) * 0.25));
        const sx = crit && k < 0.3 ? Math.sin(this.frame * 2.1) * 1.5 : 0;
        this.uiTop.push(() => {
            const ctx = this.ctx;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `bold ${size}px ${PIXEL_FONT}`;
            const x = Math.round(p.x + sx), y = Math.round(p.y + rise);
            const text = kind === 'boss' ? String(Math.round(value)) : `-${Math.round(value)}`;
            ctx.lineJoin = 'round';
            ctx.lineWidth = crit ? 4 : 3;
            ctx.strokeStyle = crit ? '#5a1000' : '#14101e';
            ctx.strokeText(text, x, y);
            if (crit) {
                const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
                g.addColorStop(0, '#fffbe0');
                g.addColorStop(0.5, '#ffd23f');
                g.addColorStop(1, '#ff7b1a');
                ctx.fillStyle = g;
            }
            else
                ctx.fillStyle = kind === 'boss' ? '#ffffff' : kind === 'storm' ? '#d6a0ff' : '#ff6b6b';
            ctx.fillText(text, x, y);
            if (crit && k < 0.7) {
                ctx.font = `bold 7px ${PIXEL_FONT}`;
                ctx.lineWidth = 2.5;
                ctx.strokeStyle = '#5a1000';
                ctx.strokeText('CRITICAL', x, y - size * 0.75);
                ctx.fillStyle = this.frame % 6 < 3 ? '#ffffff' : '#ffd23f';
                ctx.fillText('CRITICAL', x, y - size * 0.75);
            }
            ctx.restore();
        });
    }
    // 正否のオーラ（キャラについていく）: 正しく動けた人は緑の光に包まれ、光の粒が上へ立ちのぼる。
    // 誤った人は赤く明滅し、火の粉が下へこぼれ落ちる。連携詠唱の場面では出さない（唱える番まで成否を伏せる）
    aura(ctx, x, y, f, st, phase) {
        if (phase < st.t)
            return;
        const ok = st.success && !st.charmed;
        const k = clamp01((phase - st.t) / 0.04) * (1 - clamp01((phase - 0.96) / 0.04));
        if (k <= 0)
            return;
        const pulse = ok ? 0.75 + 0.25 * Math.sin(this.frame / 8 + f) : 0.6 + 0.4 * ((this.frame + f * 3) % 7 < 4 ? 1 : 0.55);
        const [r, g, b] = ok ? [123, 237, 159] : [255, 90, 110];
        const pop = 1 + 0.35 * (1 - clamp01((phase - st.t) / 0.05)); // 答えた瞬間は少し大きく
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.save();
        ctx.translate(x, y - 12);
        ctx.scale(1, 1.5);
        const rad = 15 * pop;
        const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, rad);
        grd.addColorStop(0, `rgba(${r},${g},${b},${0.8 * k * pulse})`);
        grd.addColorStop(0.6, `rgba(${r},${g},${b},${0.4 * k * pulse})`);
        grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(0, 0, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // 粒: 緑は足元から頭上へ、赤は頭から足元へ（散りながら）
        for (let i = 0; i < 14; i++) {
            const seed = (f * 131 + i * 57) % 97;
            const sp = 0.7 + (seed % 5) * 0.12;
            const t = ((this.frame * sp) / 40 + seed / 97) % 1;
            const ox = ((seed % 11) - 5) * 1.9 + (ok ? Math.sin(t * 6 + i) * 1.5 : (t * ((seed % 7) - 3)) * 3);
            const oy = ok ? 2 - t * 40 : -30 + t * 32 + t * t * 6;
            const a = k * (ok ? Math.min(1, Math.sin(t * Math.PI) * 1.6) : 1 - t * 0.8);
            ctx.globalAlpha = a;
            ctx.fillStyle = ok ? (i % 3 ? '#9dffbe' : '#ffffff') : (i % 3 ? '#ff5a3a' : '#ffd166');
            // 緑は縦長の光（上へ）、赤は四角い火の粉（下へ）。少し大きめにして、ぱっと見で分かるように
            ctx.fillRect(Math.round(x + ox), Math.round(y + oy), ok ? 1 : 2, ok ? 3 : 2);
            if (ok && i % 4 === 0) {
                ctx.globalAlpha = a * 0.5;
                ctx.fillRect(Math.round(x + ox) - 1, Math.round(y + oy) + 1, 3, 1);
            }
        }
        ctx.restore();
        this.lights.push({ x, y: y - 12, r: 20, a: 0.45 * k, col: ok ? '#7bed9f' : '#ff5a6e' });
    }
    // 決め手の道具（自分だけ・正解のときだけ）: 答えた直後に頭上へ浮かび、光って、ボスが動く前に武器へ吸いこまれる
    keyItem(ctx, w, vis, strikeOf, phase, ultHero) {
        const s = this.script, wv = s.waves[w];
        if (!wv || wv.sudden)
            return;
        const cm = s.cases[wv.caseIndex];
        for (const v of vis) {
            if (!this.mine.has(v.f) || !v.alive || v.f === ultHero)
                continue;
            const st = strikeOf.get(v.f);
            if (!st || !st.success || st.charmed)
                continue;
            const l = s.fighters[v.f].loadout;
            let img = null, col = '#8fd3ff';
            const tool = st.used.tools.find((id) => cm.keyTools?.includes(id) && !TOOL_BY_ID[id]?.decoy);
            if (tool)
                img = toolIcon(tool);
            else if (st.used.tools.includes('guardrail') && (cm.scene === 'illusion' || cm.scene === 'ally')) {
                img = guardIcon();
                col = '#c8a8ff';
            }
            else if (cm.keySkill && st.used.skills.length) {
                const i = l.skills.indexOf(st.used.skills[0]);
                const sl = i >= 0 ? skillLook(l, i) : { color: '#ffd166' };
                img = scrollIcon(sl.color);
                col = '#ff9ce6';
            }
            if (!img)
                continue;
            const t0 = st.t + 0.03, tAbs = 0.36, tEnd = 0.41;
            if (phase < t0 || phase > tEnd)
                continue;
            const rise = ease(clamp01((phase - t0) / 0.05));
            const abs = ease(clamp01((phase - tAbs) / (tEnd - tAbs)));
            const hx = v.x, hy = v.y - 42 + Math.sin(this.frame / 7) * 1; // 頭上
            const wx = v.x - 7, wy = v.y - 12; // 手元（武器）
            const x = lerp(lerp(v.x, hx, rise), wx, abs), y = lerp(lerp(v.y - 16, hy, rise), wy, abs);
            const sc = (1 + 0.3 * bump(rise, 0.6, 1)) * (1 - abs * 0.8);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const r = 12 * sc;
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, `${col}cc`);
            g.addColorStop(1, `${col}00`);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
            ctx.imageSmoothingEnabled = false;
            const iw = Math.max(2, Math.round(img.width * sc)), ih = Math.max(2, Math.round(img.height * sc));
            ctx.drawImage(img, Math.round(x - iw / 2), Math.round(y - ih / 2), iw, ih);
            ctx.restore();
            this.lights.push({ x, y, r: 22, a: 0.6 * (1 - abs * 0.5), col });
            // 吸いこまれた瞬間、武器が光る
            if (phase > tEnd - 0.02)
                this.lights.push({ x: wx, y: wy, r: 26, a: 0.9, col: '#ffffff' });
        }
    }
    // 画面下の進み具合: 仕掛けの数だけのブロック（巻物が要る場面は重いので幅が広い）。
    // 自分の答えが出るたびに、正解の度合いで塗られ、右の数字（戦果）が積み上がる。
    progressBar(w, phase, strikeOf) {
        const s = this.script, ctx = this.ctx;
        const mine = [...this.mine].find((f) => !s.fighters[f].off);
        if (mine === undefined || w >= s.waves.length)
            return;
        const waves = s.waves.map((wv, i) => ({ wv, i })).filter((x) => !x.wv.sudden);
        if (!waves.length)
            return;
        const wt = (i) => (s.cases[s.waves[i].caseIndex]?.keySkill ? SKILL_WEIGHT : 1);
        const total = waves.reduce((a, x) => a + wt(x.i), 0);
        const scoreOf = (i) => {
            if (i > w)
                return null;
            const st = i === w ? strikeOf.get(mine) : s.waves[i].events.find((e) => e.type === 'strike' && e.f === mine);
            if (!st)
                return i < w ? 0 : null;
            if (i === w && phase < st.t)
                return null;
            return st.charmed ? 0 : st.score;
        };
        const x0 = 8, x1 = s.arena.w - 40, y = 205, hgt = 5, gap = 1;
        const span = x1 - x0 - gap * (waves.length - 1);
        ctx.save();
        ctx.fillStyle = 'rgba(13,16,34,0.72)';
        ctx.fillRect(x0 - 3, y - 3, s.arena.w - x0 - 2, hgt + 6);
        let x = x0, got = 0;
        for (const { i } of waves) {
            const bw = (span * wt(i)) / total;
            const sc = scoreOf(i);
            ctx.fillStyle = '#262a48';
            ctx.fillRect(x, y, bw, hgt);
            if (sc !== null) {
                got += sc * wt(i);
                if (sc > 0) {
                    ctx.fillStyle = sc >= 0.6 ? '#7bed9f' : '#c8b46a';
                    ctx.fillRect(x, y, Math.max(1, bw * sc), hgt);
                }
                else {
                    ctx.fillStyle = 'rgba(255,90,110,0.45)';
                    ctx.fillRect(x, y + hgt - 1, bw, 1);
                }
            }
            if (i === w) {
                ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.frame / 6);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.strokeRect(x - 0.5, y - 0.5, bw + 1, hgt + 1);
                ctx.globalAlpha = 1;
            }
            x += bw + gap;
        }
        ctx.font = `8px ${PIXEL_FONT}`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffd166';
        ctx.fillText(`${Math.round((got / total) * 100)}%`, s.arena.w - 5, y + hgt / 2);
        ctx.restore();
    }
    // あなたの動き（青い帯）: 赤い帯（ボスの動き）が消えたあと、回避・反撃に移る前に、答えた技の名前を出す
    mineBand(ctx, w, phase, strikeOf, scene) {
        const s = this.script;
        const mine = [...this.mine].find((f) => !s.fighters[f].off);
        if (mine === undefined || !scene)
            return;
        const st = strikeOf.get(mine);
        if (!st || phase < st.t)
            return;
        const [b0, b1] = MINE_BAND;
        if (phase < b0 || phase > b1)
            return;
        const act = (st.excerpt.split(NOTE_MARK)[0].split(/[：:]/)[0] || st.excerpt).trim().slice(0, 14);
        const name = s.fighters[mine].name;
        // sceneBanner は 0〜0.25 の進行度で出入りする
        sceneBanner(ctx, scene, tl('{0}（{1}）', name, this.mineLabel), ((phase - b0) / (b1 - b0)) * 0.25, s.arena.w, st.charmed ? '……' : tl('{0}！', act), '#6ab8ff');
    }
    // --- 画面上部: ボスの体力 ---
    bossBar(time, rage) {
        const ctx = this.ctx, s = this.script;
        const hp = this.bossHp(time), k = hp / s.boss.maxHp;
        const x = 96, y = 6, w = 192;
        ctx.save();
        ctx.fillStyle = 'rgba(13,16,34,0.85)';
        ctx.fillRect(x - 4, y - 2, w + 8, 17);
        ctx.font = `8px ${PIXEL_FONT}`;
        ctx.textBaseline = 'middle';
        ctx.fillStyle = rage ? '#ff8a9a' : '#ffffff';
        ctx.fillText(`${s.boss.name}${rage ? tl('（怒り）') : ''}`, x, y + 4);
        ctx.fillStyle = '#2a1630';
        ctx.fillRect(x, y + 9, w, 4);
        ctx.fillStyle = k > 0.5 ? '#c77dff' : k > 0.2 ? '#ff8a3a' : '#ff3b3b';
        ctx.fillRect(x, y + 9, Math.round(w * k), 4);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#c9ced8';
        ctx.fillText(`${Math.ceil(hp)} / ${s.boss.maxHp}`, x + w, y + 4);
        ctx.restore();
    }
    // ボスの攻撃名と狙う列（構えの間だけ）
    attackBanner(atk, phase, scene, big = false) {
        if (phase < 0.26 || phase > 0.5)
            return;
        const ctx = this.ctx;
        const a = ATTACKS[atk];
        const rows = Object.keys(a.rows).map((r) => POSITION_LABELS[r]).join(tl('・'));
        const name = big ? tl('大技') : (scene && ATTACK_NAME_BY_SCENE[scene]) || a.name;
        const text = atk === 'treasure' ? tl('宝箱を落とした！ 正解した人がもらえる')
            : this.script.mode === 'royale' ? tl(`{0}！ 正しく動ければかわせる`, name) : tl(`{0}！ {1}を狙っている`, name, Object.keys(a.rows).length === 3 ? tl('全員') : rows);
        const k = clamp01((phase - 0.26) / 0.03) * clamp01((0.5 - phase) / 0.03);
        ctx.save();
        ctx.globalAlpha = k;
        ctx.font = `9px ${PIXEL_FONT}`;
        const tw = ctx.measureText(text).width + 16;
        const x = 8, y = 28;
        ctx.fillStyle = atk === 'treasure' ? 'rgba(80,60,10,0.9)' : 'rgba(90,10,30,0.9)';
        ctx.fillRect(x, y, tw, 14);
        ctx.fillStyle = atk === 'treasure' ? '#feae34' : '#ff5a6e';
        ctx.fillRect(x, y, 2, 14);
        ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + 8, y + 7.5);
        ctx.restore();
    }
    rageOverlay() {
        const ctx = this.ctx;
        const { w, h } = this.script.arena;
        ctx.fillStyle = 'rgba(120, 10, 30, 0.14)';
        ctx.fillRect(0, 0, w, h);
        const rng = new Rng(this.frame >> 1);
        ctx.fillStyle = 'rgba(255,90,90,0.6)';
        for (let i = 0; i < 40; i++)
            ctx.fillRect(rng.int(0, w), rng.int(0, h), 2, 2);
    }
    // --- 文字類（画面座標） ---
    labelAt(text, x, y, color, size = 8) {
        const ctx = this.ctx;
        ctx.save();
        ctx.font = `${size}px ${PIXEL_FONT}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#1a1c2c';
        ctx.fillText(text, Math.round(x) + 1, Math.round(y) + 1);
        ctx.fillStyle = color;
        ctx.fillText(text, Math.round(x), Math.round(y));
        ctx.restore();
    }
    youMarker(wx, wy) {
        const p = this.proj(wx, wy);
        this.uiTop.push(() => {
            const ctx = this.ctx;
            ctx.save();
            ctx.font = `8px ${PIXEL_FONT}`;
            ctx.textAlign = 'center';
            // 足元の下に、上向きの矢印つきの札
            const tw = Math.max(26, Math.ceil(ctx.measureText(this.mineLabel).width) + 8);
            ctx.fillStyle = '#ffd166';
            ctx.fillRect(Math.round(p.x - 1), Math.round(p.y - 3), 3, 1);
            ctx.fillRect(Math.round(p.x - 2), Math.round(p.y - 2), 5, 2);
            ctx.fillRect(Math.round(p.x - tw / 2), Math.round(p.y), tw, 10);
            ctx.fillStyle = '#12152a';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.mineLabel, Math.round(p.x), Math.round(p.y + 5.5));
            ctx.restore();
        });
    }
    floatText(ctx, text, wx, wy, color, alpha, size0 = 8) {
        const { x, y } = this.proj(wx, wy);
        const size = Math.round(size0 * (1 + (this.cam.z - 1) * 0.25));
        this.ui.push(() => {
            ctx.save();
            ctx.globalAlpha = Math.max(0, alpha);
            ctx.font = `${size}px ${PIXEL_FONT}`;
            ctx.textAlign = 'center';
            ctx.fillStyle = '#1a1c2c';
            ctx.fillText(text, Math.round(x) + 1, Math.round(y) + 1);
            ctx.fillStyle = color;
            ctx.fillText(text, Math.round(x), Math.round(y));
            ctx.restore();
        });
    }
    tag(ctx, text, color, wx, wy, alpha, stack = 0) {
        const p = this.proj(wx, wy);
        this.ui.push(() => {
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.font = `7px ${PIXEL_FONT}`;
            const w = Math.ceil(ctx.measureText(text).width) + 6;
            const bx = Math.round(p.x - w / 2), by = Math.round(p.y - stack * 10 - 5);
            ctx.fillStyle = 'rgba(13,16,34,0.85)';
            ctx.fillRect(bx, by, w, 9);
            ctx.fillStyle = color;
            ctx.fillRect(bx, by, 1, 9);
            ctx.textBaseline = 'middle';
            ctx.fillText(text, bx + 3, by + 5);
            ctx.restore();
        });
    }
    bubble(ctx, text, wx, wy, ok) {
        const p = this.proj(wx, wy);
        this.ui.push(() => {
            ctx.save();
            ctx.font = `8px ${PIXEL_FONT}`;
            const t = text.length > 26 ? text.slice(0, 25) + '…' : text;
            const w = Math.ceil(ctx.measureText(t).width) + 8;
            const x = Math.max(w / 2 + 2, Math.min(this.script.arena.w - w / 2 - 2, p.x));
            const bx = Math.round(x - w / 2), by = Math.round(Math.max(2, p.y - 12));
            ctx.fillStyle = '#1a1c2c';
            ctx.fillRect(bx - 1, by - 1, w + 2, 14);
            ctx.fillStyle = ok ? '#ffffff' : '#ffe1e1';
            ctx.fillRect(bx, by, w, 12);
            ctx.fillRect(Math.round(p.x) - 1, by + 12, 3, 2);
            ctx.fillStyle = '#1a1c2c';
            ctx.textBaseline = 'middle';
            ctx.fillText(t, bx + 4, by + 6.5);
            ctx.restore();
        });
    }
    // 大技カウンターの主役が持っている武器（乱舞の必殺技が、武器で変わる）
    ultWeapon(f) { return f === undefined ? undefined : this.looks[f]?.weapon; }
    // 連携詠唱のカットイン用の全身画（使うときに一度だけ作る）
    figs = null;
    figuresOf() {
        return (this.figs ??= this.script.fighters.map((_, i) => figure(this.looks[i], this.gears[i], 5)));
    }
    skillWave(w) { const wv = this.script.waves[w]; return !!wv && !wv.sudden && !!this.script.cases[wv.caseIndex]?.keySkill; }
    // 必殺技カットインの区間。大技カウンター（ougi/rush/summon）は主役の大技が 0.3 から始まるので、それより前に終える
    ultWindow(st, w) {
        const t0 = this.ultOf(w) ? Math.min(0.12, Math.max(0.08, st.t)) : Math.min(0.2, Math.max(0.1, st.t));
        return [t0, t0 + 0.17];
    }
    // 巻物の大技カウンターの主役。巻物が要る場面（skillWave）の ougi / rush / summon だけ。
    //   主役（巻物を使って正解したキャラ）: 自分のキャラ → 注目キャラ → 先に答えたキャラ の順
    //   正解者がひとりもいなければ { scene } だけ（ボスの大技が炸裂する）。巻物なしの正解者しかいなければ null（今までの軽い演出）
    ultOf(w) {
        const u = this.ultHero(w);
        if (!u || u.f === undefined)
            return u;
        const at = this.wave(w).events.find((e) => e.type === 'attack' && e.f === u.f);
        return { ...u, at };
    }
    ultHero(w) {
        const scene = this.sceneOf(w);
        // 大技の場面（奥義・乱舞・召喚）は、巻物が要る場面でも要らない場面でも、主役の大技で見せる
        if (!isUltScene(scene))
            return null;
        const s = this.script, wv = s.waves[w];
        const prevAlive = w > 0 ? s.waves[w - 1].aliveAfter : s.fighters.map(() => true);
        const strikes = wv.events.filter((e) => e.type === 'strike' && e.success && prevAlive[e.f] && !s.fighters[e.f].off);
        if (!strikes.length)
            return { scene };
        const withSkill = this.skillWave(w) ? strikes.filter((e) => e.used.skills.length) : strikes;
        if (!withSkill.length)
            return null;
        const sp = this.spotlight(w);
        const st = withSkill.find((e) => this.mine.has(e.f)) ?? withSkill.find((e) => e.f === sp?.f) ?? withSkill[0];
        return { scene, f: st.f, st };
    }
    // 連携詠唱（scene 'chain'）の、見る人ごとの並び。あなたがいれば必ず最後の節を唱える（chainOrder）。
    // 成否とダメージは台本（chain の出来事）のまま。全員正解のときだけ最後までつながる
    chainCache = new Map();
    chainOf(w) {
        const s = this.script, wv = s.waves[w];
        if (!wv || wv.sudden || s.cases[wv.caseIndex]?.scene !== 'chain')
            return null;
        const key = `${w}:${[...this.mine].join(',')}:${this.mineLabel}`;
        if (this.chainCache.has(key))
            return this.chainCache.get(key);
        const ev = wv.events.find((e) => e.type === 'chain');
        let plan = null;
        if (ev) {
            const cm = s.cases[wv.caseIndex];
            const visible = (f) => !s.fighters[f].off;
            const { order, chanters, upto } = chainOrder(ev.parts, ev.ok, ev.len, { mine: this.mine, visible, mineUpto: ev.viewerUpto });
            const verse = Math.min(0.065, CHAIN_T.chant / Math.max(1, ev.len));
            const full = ev.full && upto >= ev.len;
            // 詠唱の文を見せるのは、見ている人（あなた）が大呪を最後まで唱えられたときだけ。
            // 外した人・提出していない人には、ネタバレにならないよう全員の詠唱を古代文字で見せる
            const reveal = [...this.mine].some((f) => ev.ok.includes(f));
            const lines = Array.from({ length: ev.len }, (_, i) => (reveal ? cm.chant?.[i] ?? '……' : runeLine(cm.chant?.[i] ?? '……', i)));
            const mineAt = chanters.findIndex((f) => this.mine.has(f));
            const breakT = full ? -1 : chainBreakAt(CHAIN_T.start, verse, upto);
            const doneT = verseAt({ start: CHAIN_T.start, verse }, ev.len);
            const view = {
                len: ev.len, lines, chanters, names: chanters.map((f) => s.fighters[f]?.name ?? ''), mineAt, upto, full, dmg: ev.dmg,
                start: CHAIN_T.start, verse, breakT, doneT, impact: ev.t, rally: CHAIN_T.rally, spell: cm.shout?.name ?? cm.spell ?? (cm.chant?.[ev.len - 1] ?? '').split(/[\s,，、]/)[0], reading: cm.shout?.reading, mineLabel: this.mineLabel,
            };
            // 魔法陣を囲む輪: 最後に唱える人（あなた）がボスに向いた正面（左）、ほかの人は唱える順に輪をまわる。
            // 唱えない人は右端へ場を譲って見守る
            const line = new Map();
            const ring = { x: 262, y: 134, rx: 48, ry: 20 };
            const front = order.filter(visible);
            const n = front.length;
            front.forEach((f, k) => {
                const a = Math.PI + ((n - 1 - k) * Math.PI * 2) / Math.max(1, n); // 最後（k = n-1）が左の正面
                line.set(f, { x: ring.x + Math.cos(a) * (ring.rx + 8), y: ring.y + 4 + Math.sin(a) * (ring.ry + 6) });
            });
            view.ring = ring;
            plan = { ev, view, line, dmgAt: full ? ev.t : breakT + 0.05, last: w === s.waves.length - 1 };
        }
        this.chainCache.set(key, plan);
        return plan;
    }
    // 必殺技のカットイン: 注目キャラが巻物（スキル）を使った回だけ、画面全体で大きく見せる
    ultimate(ctx, w, phase) {
        const s = this.script;
        const ult = this.ultOf(w);
        const sp = ult?.f !== undefined ? { f: ult.f, st: ult.st } : this.spotlight(w); // 大技カウンターは主役を見せる
        // 必殺技（巻物）の見せ場は、巻物が要る場面（ボスの大技）でだけ。連携詠唱の場面は詠唱そのものが見せ場なので出さない
        if (!sp || !sp.st.used.skills.length || !this.skillWave(w) || this.chainOf(w))
            return;
        // 詠唱合戦は、知る者へのスポットライトと詠唱そのものが見せ場なので、カットインで隠さない
        if (this.sceneOf(w) === 'spell')
            return;
        // 巻物を読むのは「答えを考えるとき」。竜の攻撃より前に見せる
        const [t0, t1] = this.ultWindow(sp.st, w);
        if (phase < t0 || phase > t1)
            return;
        const k = (phase - t0) / (t1 - t0);
        const { w: AW, h: AH } = s.arena;
        const inK = ease(clamp01(k / 0.15)), outK = 1 - ease(clamp01((k - 0.85) / 0.15));
        const a = Math.min(inK, outK);
        const accent = '#ff6bd6', gold = '#ffd166';
        ctx.save();
        // 暗転と集中線
        ctx.globalAlpha = 0.7 * a;
        ctx.fillStyle = '#05030d';
        ctx.fillRect(0, 0, AW, AH);
        ctx.globalAlpha = 0.5 * a;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        const rng = new Rng(`ult:${w}`);
        for (let i = 0; i < 46; i++) {
            const ang = rng.range(0, Math.PI * 2) + this.frame * 0.002, r0 = rng.range(60, 120), r1 = r0 + rng.range(40, 140);
            ctx.beginPath();
            ctx.moveTo(AW / 2 + Math.cos(ang) * r0, AH / 2 + Math.sin(ang) * r0 * 0.7);
            ctx.lineTo(AW / 2 + Math.cos(ang) * r1, AH / 2 + Math.sin(ang) * r1 * 0.7);
            ctx.stroke();
        }
        // 斜めの帯
        const by = AH / 2 - 30, slide = (1 - inK) * AW;
        ctx.globalAlpha = a;
        const g = ctx.createLinearGradient(0, by, AW, by + 60);
        g.addColorStop(0, '#3a0a3a');
        g.addColorStop(0.5, '#7a1a6a');
        g.addColorStop(1, '#3a0a3a');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-20 + slide, by + 8);
        ctx.lineTo(AW + 20 + slide, by - 8);
        ctx.lineTo(AW + 20 + slide, by + 52);
        ctx.lineTo(-20 + slide, by + 68);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = gold;
        ctx.beginPath();
        ctx.moveTo(-20 + slide, by + 8);
        ctx.lineTo(AW + 20 + slide, by - 8);
        ctx.lineTo(AW + 20 + slide, by - 5);
        ctx.lineTo(-20 + slide, by + 11);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-20 + slide, by + 65);
        ctx.lineTo(AW + 20 + slide, by + 49);
        ctx.lineTo(AW + 20 + slide, by + 52);
        ctx.lineTo(-20 + slide, by + 68);
        ctx.closePath();
        ctx.fill();
        // 帯を流れる光
        ctx.globalAlpha = 0.25 * a;
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 10; i++)
            ctx.fillRect(((i * 53 + this.frame * 9) % (AW + 80)) - 40, by + 14 + (i % 4) * 11, 30, 1);
        // 大きな肖像（左から）
        ctx.globalAlpha = a;
        const px = 10 - (1 - inK) * 120;
        ctx.drawImage(this.portraits[sp.f], Math.round(px), Math.round(by - 34), 140, 108);
        // 技名
        const fi = s.fighters[sp.f];
        const skill = sp.st.used.skills.find((x) => x !== '？') ?? tl('秘伝の巻物');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const sc = k < 0.2 ? 1.6 - ease(k / 0.2) * 0.6 : 1;
        ctx.font = `${Math.round(10 * sc)}px ${PIXEL_FONT}`;
        ctx.fillStyle = gold;
        ctx.fillText(tl(`{0}　スキル発動`, fi.name), AW / 2 + 60, by + 18);
        ctx.font = `${Math.round(22 * sc)}px ${PIXEL_FONT}`;
        ctx.lineJoin = 'round';
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#2a0020';
        ctx.strokeText(tl(`「{0}」`, skill), AW / 2 + 60, by + 40);
        ctx.fillStyle = this.frame % 8 < 4 ? '#ffffff' : accent;
        ctx.fillText(tl(`「{0}」`, skill), AW / 2 + 60, by + 40);
        ctx.restore();
        // 入りの閃光
        if (k < 0.08) {
            ctx.save();
            ctx.globalAlpha = (1 - k / 0.08) * 0.8;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, AW, AH);
            ctx.restore();
        }
    }
    // --- 終盤の演出: 決勝の鼓動、サドンデス、ボス撃破、勝者 ---
    endgame(ctx, w, phase, outro, views, down) {
        const s = this.script;
        const { w: AW, h: AH } = s.arena;
        const t = w + phase + outro;
        if (this.finalWave >= 0 && w >= this.finalWave && outro === 0 && down < 0) {
            const beat = Math.pow(Math.max(0, Math.sin(this.frame / 9)), 6);
            const a = 0.08 + beat * 0.18 + (this.suddenWave >= 0 && w >= this.suddenWave ? 0.08 : 0);
            const g = ctx.createRadialGradient(AW / 2, AH / 2, AH * 0.35, AW / 2, AH / 2, AW * 0.62);
            g.addColorStop(0, 'rgba(255,40,60,0)');
            g.addColorStop(1, `rgba(255,40,60,${a})`);
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, AW, AH);
        }
        if (this.finalWave >= 0)
            this.bigBanner(ctx, t - this.finalWave, 'FINAL ROUND', tl(`残り{0}人！ 最後まで立っていられるか`, views.filter((v) => v.alive).length), '#ff5a6e');
        if (this.suddenWave >= 0)
            this.bigBanner(ctx, t - this.suddenWave - (this.suddenWave === this.finalWave ? 0.8 : 0), 'SUDDEN DEATH', tl('ボスが本気を出した！ 決着まで難問が続く'), '#c77dff');
        const fin = this.finisher(w);
        if (fin !== null && phase > fin && phase < fin + 0.05 && outro === 0) {
            ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - (phase - fin) / 0.05)})`;
            ctx.fillRect(0, 0, AW, AH);
        }
        // 削りきれなかったときも討伐成功: ボスは逃げ出す
        const esc = this.escapeAt && w === this.escapeAt.wave ? phase - this.escapeAt.t + outro : this.escapeAt && w > this.escapeAt.wave ? 1 + outro : -1;
        if (this.escapeAt && esc >= 0)
            this.bigBanner(ctx, esc - 0.15, tl('討伐成功！'), tl('{0}はたまらず逃げ出した！ 戦果1位は…', s.boss.name), '#ffd166');
        if (down >= 0)
            this.bigBanner(ctx, down, s.mode === 'royale' ? tl('討伐成功！') : 'VICTORY', s.mode === 'royale' ? tl(`{0}を倒した！ 戦果1位は…`, s.boss.name) : tl('ボスを倒した！ いちばんダメージを与えたのは…'), '#ffd166');
        const winT = this.winner !== null ? t - (s.waves.length - 1 + ((s.waves[s.waves.length - 1].events.find((e) => e.type === 'winner')?.t) ?? 1)) : -1;
        if (s.mode === 'team' && outro > 0) {
            const top = s.teamStandings[0];
            this.winBanner(ctx, outro, tl(`{0} の勝利！`, s.teams[top.team].name), 'TEAM WIN', s.teams[top.team].color);
            this.confetti(ctx, outro);
        }
        else if (this.winner !== null && winT > 0 && (down < 0 || down > 0.75) && (esc < 0 || esc > 0.9)) {
            const v = views[this.winner];
            const p = this.proj(v.x, v.y);
            const k = clamp01(winT / 0.3);
            ctx.save();
            ctx.fillStyle = `rgba(5,6,13,${0.45 * k})`;
            ctx.beginPath();
            ctx.rect(0, 0, AW, AH);
            ctx.ellipse(p.x, p.y - 20, 46, 60, 0, 0, Math.PI * 2, true);
            ctx.fill('evenodd');
            const beam = ctx.createLinearGradient(p.x, 0, p.x, p.y);
            beam.addColorStop(0, 'rgba(255,240,180,0)');
            beam.addColorStop(1, `rgba(255,240,180,${0.28 * k})`);
            ctx.fillStyle = beam;
            ctx.beginPath();
            ctx.moveTo(p.x - 14, 0);
            ctx.lineTo(p.x + 14, 0);
            ctx.lineTo(p.x + 40, p.y + 6);
            ctx.lineTo(p.x - 40, p.y + 6);
            ctx.fill();
            ctx.restore();
            this.confetti(ctx, winT);
            this.winBanner(ctx, winT, s.fighters[this.winner].name, s.mode === 'duel' ? 'WIN!' : s.mode === 'royale' ? tl('戦果1位') : 'WINNER!', '#ffd166');
        }
    }
    bigBanner(ctx, age, title, sub, color) {
        if (age < 0 || age > 0.75)
            return;
        const { w: AW, h: AH } = this.script.arena;
        const k = age / 0.75;
        const slide = k < 0.15 ? ease(k / 0.15) : k > 0.85 ? 1 - ease((k - 0.85) / 0.15) : 1;
        const y = AH / 2 - 24;
        ctx.save();
        ctx.globalAlpha = slide;
        ctx.fillStyle = 'rgba(13,16,34,0.85)';
        ctx.fillRect(0, y, AW, 46);
        ctx.fillStyle = color;
        ctx.fillRect(0, y, AW, 2);
        ctx.fillRect(0, y + 44, AW, 2);
        ctx.globalAlpha = slide * 0.25;
        for (let i = 0; i < 18; i++)
            ctx.fillRect(((i * 37 + this.frame * 6) % (AW + 40)) - 40, y + 6 + (i % 5) * 8, 24, 1);
        ctx.globalAlpha = slide;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const sc = k < 0.12 ? 2 - ease(k / 0.12) : 1;
        ctx.font = `${Math.round(22 * sc)}px ${PIXEL_FONT}`;
        ctx.fillStyle = '#1a1c2c';
        ctx.fillText(title, AW / 2 + 2, y + 20);
        ctx.fillStyle = this.frame % 10 < 5 ? color : '#ffffff';
        ctx.fillText(title, AW / 2, y + 18);
        ctx.font = `9px ${PIXEL_FONT}`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(sub, AW / 2, y + 36);
        ctx.restore();
    }
    winBanner(ctx, age, name, title, color) {
        const { w: AW } = this.script.arena;
        const k = clamp01(age / 0.25);
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = k;
        ctx.font = `${Math.round(26 * (1 + (1 - ease(k)) * 1.5))}px ${PIXEL_FONT}`;
        ctx.fillStyle = '#1a1c2c';
        ctx.fillText(title, AW / 2 + 2, 46);
        ctx.fillStyle = this.frame % 12 < 6 ? color : '#ffffff';
        ctx.fillText(title, AW / 2, 44);
        ctx.font = `11px ${PIXEL_FONT}`;
        const tw = ctx.measureText(name).width + 16;
        ctx.fillStyle = 'rgba(13,16,34,0.85)';
        ctx.fillRect(Math.round(AW / 2 - tw / 2), 62, Math.round(tw), 15);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(name, AW / 2, 70);
        ctx.restore();
    }
    confetti(ctx, age) {
        const { w: AW, h: AH } = this.script.arena;
        const cols = ['#ffd166', '#ff5a6e', '#5fcde4', '#7bed9f', '#c77dff', '#ffffff'];
        const rng = new Rng('confetti:' + this.script.seed);
        ctx.save();
        for (let i = 0; i < 90; i++) {
            const x0 = rng.range(0, AW), sp = rng.range(40, 90), sway = rng.range(4, 12), ph = rng.range(0, 6.28), delay = rng.range(0, 0.6);
            const a = (age - delay) * 3;
            if (a < 0)
                continue;
            const y = -6 + a * sp;
            if (y > AH + 4)
                continue;
            ctx.fillStyle = cols[i % cols.length];
            ctx.fillRect(Math.round(x0 + Math.sin(a * 3 + ph) * sway), Math.round(y), Math.max(1, Math.round(3 * Math.abs(Math.sin(a * 6 + ph)))), 2);
        }
        ctx.restore();
    }
}
//# sourceMappingURL=arena.js.map