import { ATTACKS, CHAIN_T, waveTitleFor } from '../shared/simulate.js';
import { POSITION_LABELS } from '../shared/build.js';
import { MELEE_WEAPONS, TOOL_BY_ID } from '../shared/catalog.js';
import { crownSprite, potionSprite, shieldIcon, tombSprite } from './sprites.js';
import { drawHero, gearOf, lookOf, portrait } from './hero.js';
import './bosses/index.js';
import { BODY_STYLE, fxColors, skillAura, toolMove } from './fx.js';
import { isUltScene, ULT_T, sceneBack, sceneDark, sceneBanner, sceneFront, sceneHud, sceneTop, ultHitT } from './scenes.js';
import { tl } from '../shared/i18n.js';
import { AGILE, EVADE_LABEL, GAG, IMPACT, KO_TIME, NO_GEAR, OUTRO, SCALE, TOOL_SHORT, bump, clamp01, ease, lerp } from './arena-common.js';
import { attackBanner, bossBar, bubble, comboHud, damageNum, floatText, hpBar, keyItem, labelAt, mineBand, progressBar, rageOverlay, reserveStrip, tag, youMarker } from './arena-hud.js';
import { chainOf, comboAt } from './arena-chain.js';
import { figuresOf, skillWave, ultHero, ultOf, ultWeapon, ultWindow, ultimate } from './arena-ult.js';
import { bossSilhouette } from './boss.js';
import { attackFxBack, attackFxFront, boom, drawBoss } from './arena-boss.js';
import { aura, barrierFx, decoyGag, drawFighter, dust, gagOf, guardFx, hitSpark, magicCircle, motes, projectile, scrollFx, slashFx, smearFx } from './arena-fighter.js';
import { bigBanner, confetti, endgame, winBanner } from './arena-endgame.js';
import { updateCamera } from './arena-camera.js';
import { bandWave, cues, evadeOf, finisher, hitStop, lagOf, playCues, slowFactor } from './arena-timing.js';
import { sceneHead } from './bossmoves.js';
import { applyLighting, foreground, makeBackground } from './arena-scene.js';
// 画面の部品ごとに、描画を arena-*.ts に分けてある（同じ ArenaRenderer のメソッドとして取り付ける）
export { SCALE, OUTRO, CHAIN_TEMPOS, GUARD_HIT, TOOL_SHORT } from './arena-common.js';
// 円や楕円の半径が計算の途中で負になっても、描画で例外にしない（0として描く）
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.__safeArc) {
    const P = CanvasRenderingContext2D.prototype;
    const arc = P.arc, ellipse = P.ellipse;
    P.arc = function (x, y, r, ...rest) { return arc.call(this, x, y, Math.max(0, r || 0), ...rest); };
    P.ellipse = function (x, y, rx, ry, ...rest) { return ellipse.call(this, x, y, Math.max(0, rx || 0), Math.max(0, ry || 0), ...rest); };
    P.__safeArc = true;
}
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
    makeBackground = makeBackground; // arena-scene.ts
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
    comboAt = comboAt; // arena-chain.ts
    comboHud = comboHud; // arena-hud.ts
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
    bandWave = bandWave; // arena-timing.ts
    slowFactor = slowFactor; // arena-timing.ts
    stopCache = new Map();
    hitStop = hitStop; // arena-timing.ts
    lagOf = lagOf; // arena-timing.ts
    evadeOf = evadeOf; // arena-timing.ts
    // 効果音のきっかけ（ウェーブごとに1度だけ作る）。自分・注目キャラ・ボス・会心だけ鳴らす
    cueCache = new Map();
    cues = cues; // arena-timing.ts
    playCues = playCues; // arena-timing.ts
    finisher = finisher; // arena-timing.ts
    updateCamera = updateCamera; // arena-camera.ts
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
        const spot = this.spotlight(w);
        const ult = this.ultOf(w);
        this.updateCamera({ w, phase, outro, wv, atk, views, strikeOf, chain, down, spot, ult }); // カメラと画面の揺れ（arena-camera.ts）
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
        const dazed = this.sceneOf(w) === 'opening'; // 隙あり: ボスはよろめいていて、攻撃してこない（狙う列の警告・攻撃のエフェクトを出さない）
        const tele = atk === 'treasure' || chain || dazed ? 0 : clamp01((phase - 0.26) / 0.06) * (phase < IMPACT + 0.04 ? 1 : 0);
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
                return { f: v.f, x: v.x, y: v.y, alive: v.alive, ok: !!st?.success, hit: hits.has(v.f), tools: st?.used.tools ?? [], skills: st?.used.skills ?? [], charmed: !!st?.charmed, haunted: !!st?.haunted, atT: at?.t, excerpt: st?.excerpt ?? '', mine: this.mine.has(v.f) };
            }),
            ult: ult ? { hero: ult.f, weapon: ult.f !== undefined ? this.looks[ult.f].weapon : undefined, dmg: ult.at?.dmg ?? 0, crit: !!ult.at?.crit, skill: ult.st?.used.skills.find((x) => x !== '？') ?? '' } : undefined,
            lights: this.lights,
            partyX: Math.max(...s.fighters.filter((f) => !f.off).map((f) => f.slot.x)),
            bossSil: bossSilhouette((s.theme?.kind ?? 'dragon')),
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
            this.drawBoss(ctx, phase, atk, rage, down, attackOf, chain, fleeT >= 0, scene);
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
        if (!chain && !dazed && !(atk === 'meteor' && (scene === 'dive' || scene === 'illusion')))
            this.attackFxBack(ctx, atk, phase, vis, targeted, scene);
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
        if (!chain && !dazed && !(atk === 'meteor' && (scene === 'dive' || scene === 'illusion')))
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
                this.floatText(ctx, EVADE_LABEL[this.evadeOf(w, e.f)], v.x, v.y - 34 - fl * 8, '#8fd3ff', 1 - fl, 8);
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
            sceneBanner(ctx, scene, this.caseTitle(cm), chain ? phase * 1.8 : phase, AW, ult ? tl('ボスが大技の構え！') : chain ? tl('最後の大技の構え！ みんなで連携詠唱！') : s.theme?.labels?.[scene] ?? sceneHead(s.theme?.kind, scene), ult ? '#ff5a6e' : undefined);
        // あなたの動き（青い帯）: ボスの赤い帯が消えたあと、動き出す前に、答えた技の名前を見せる
        if (!gagNow && !ult && !chain && !wv.sudden && scene !== 'spell')
            this.mineBand(ctx, w, phase, strikeOf, scene);
        this.ultimate(ctx, w, phase);
        if (outro === 0)
            this.comboHud(ctx, w, phase, views);
        this.reserveStrip(ctx, views);
        this.endgame(ctx, w, phase, outro, views, down);
    }
    reserveStrip = reserveStrip; // arena-hud.ts
    diedAt(f, w, phase) {
        const d = this.deathOf(f, w, phase);
        return d.wave === w && phase >= d.t && phase - d.t < KO_TIME;
    }
    drawBoss = drawBoss; // arena-boss.ts
    attackFxBack = attackFxBack; // arena-boss.ts
    attackFxFront = attackFxFront; // arena-boss.ts
    boom = boom; // arena-boss.ts
    drawFighter = drawFighter; // arena-fighter.ts
    motes = motes; // arena-fighter.ts
    hpBar = hpBar; // arena-hud.ts
    guardFx = guardFx; // arena-fighter.ts
    barrierFx = barrierFx; // arena-fighter.ts
    slashFx = slashFx; // arena-fighter.ts
    applyLighting = applyLighting; // arena-scene.ts
    foreground = foreground; // arena-scene.ts
    scrollFx = scrollFx; // arena-fighter.ts
    magicCircle = magicCircle; // arena-fighter.ts
    dust = dust; // arena-fighter.ts
    // 自分の冒険者が、役に立たない道具を初めて使った回（討伐の中で一度だけギャグにする）
    gagCache = new Map();
    gagOf = gagOf; // arena-fighter.ts
    decoyGag = decoyGag; // arena-fighter.ts
    smearFx = smearFx; // arena-fighter.ts
    projectile = projectile; // arena-fighter.ts
    hitSpark = hitSpark; // arena-fighter.ts
    damageNum = damageNum; // arena-hud.ts
    aura = aura; // arena-fighter.ts
    keyItem = keyItem; // arena-hud.ts
    progressBar = progressBar; // arena-hud.ts
    mineBand = mineBand; // arena-hud.ts
    bossBar = bossBar; // arena-hud.ts
    attackBanner = attackBanner; // arena-hud.ts
    rageOverlay = rageOverlay; // arena-hud.ts
    labelAt = labelAt; // arena-hud.ts
    youMarker = youMarker; // arena-hud.ts
    floatText = floatText; // arena-hud.ts
    tag = tag; // arena-hud.ts
    bubble = bubble; // arena-hud.ts
    ultWeapon = ultWeapon; // arena-ult.ts
    // 連携詠唱のカットイン用の全身画（使うときに一度だけ作る）
    figs = null;
    figuresOf = figuresOf; // arena-ult.ts
    skillWave = skillWave; // arena-ult.ts
    ultWindow = ultWindow; // arena-ult.ts
    ultOf = ultOf; // arena-ult.ts
    ultHero = ultHero; // arena-ult.ts
    // 連携詠唱（scene 'chain'）の、見る人ごとの並び。あなたがいれば必ず最後の節を唱える（chainOrder）。
    // 成否とダメージは台本（chain の出来事）のまま。全員正解のときだけ最後までつながる
    chainCache = new Map();
    chainOf = chainOf; // arena-chain.ts
    ultimate = ultimate; // arena-ult.ts
    endgame = endgame; // arena-endgame.ts
    bigBanner = bigBanner; // arena-endgame.ts
    winBanner = winBanner; // arena-endgame.ts
    confetti = confetti; // arena-endgame.ts
}
//# sourceMappingURL=arena.js.map