import { GAG, GUARD_HIT, IMPACT, KO_TIME, NO_GEAR, bump, clamp01, ease, lerp } from './arena-common.js';
import { CHAIN_T } from '../shared/simulate.js';
import { Rng } from '../shared/rng.js';
import { MELEE_WEAPONS, TOOL_BY_ID } from '../shared/catalog.js';
import { shieldIcon } from './sprites.js';
import { drawHero, familiarHome, weaponSprite, muzzleOf } from './hero.js';
import { SPELL_T, ultPose, verseAt } from './scenes.js';
import { counterFor, isBaseScene } from './bossmoves.js';
import { PIXEL_FONT, tl } from '../shared/i18n.js';
import { reducedMotion } from './motion.js';
// --- キャラ1体: 回答 → 構え → 回避 or 被弾 → 反撃 ---
export function drawFighter(ctx, v, w, phase, outro, st, at, evaded, hit, isTarget, atk) {
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
    if (isTarget && atk !== 'treasure' && this.sceneOf(w) !== 'opening' && brace > 0 && phase < 0.38) {
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
    // 呪文と幻術: 身をかわさず、その場で構えたまま（呪文は打ち消しの詠唱、幻術は偽の声を見破って踏みとどまる）
    const holdSc = this.sceneOf(w);
    if (evaded && !uHero && holdSc === 'spell') {
        // 魔法弾が放たれてから押し返し終えるまで、両手を上げて唱え続ける（光の柱と魔法陣は scenes.ts の spellFx）
        const k = win(SPELL_T.launch - 0.06, SPELL_T.back + 0.04);
        if (k > 0 && k < 1) {
            set('cast', 0.5);
            oy -= 1 + Math.sin(this.frame / 5) * 0.8;
            if (phase > SPELL_T.caught && phase < SPELL_T.push)
                ox += Math.sin(this.frame * 1.3) * 0.6;
        }
    }
    else if (evaded && !uHero && holdSc === 'illusion') {
        // 偽の声が届くあいだ、身構えて耳を貸さない。声の文字が砕ける瞬間に、ぐっと踏みとどまる
        const k = win(0.14, 0.52);
        if (k > 0 && k < 1) {
            set('guard', 1);
            if (phase > 0.36 && phase < 0.44)
                ox += Math.sin(this.frame * 1.7) * 1;
        }
    }
    else if (evaded && !uHero) {
        const co = counterFor(this.script.theme?.kind, this.sceneOf(w)); // ボスごとの対応技（基本の4場面だけ）
        const u = win(0.36 + lag, 0.56 + lag); // 回避の全体進行
        if (u > 0 && u < 1) {
            const arc = Math.sin(u * Math.PI); // 0→1→0 のなめらかな山
            switch (this.evadeOf(w, v.f)) {
                case 'jump': { // 高く跳んで宙返り
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
                case 'crawl': { // 地面に伏せる
                    oy += arc * 6;
                    tilt = arc * 1.2;
                    set('guard', 1);
                    break;
                }
                case 'step': { // 横へすり抜け、残像を残す
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
                    if (co?.fx !== 'shieldWall') { // 頭上に盾をかかげて矢を受けるときは、前に向けた守りの光・火花は出さない（盾と刺さる矢は counterfx.ts）
                        this.guardFx(ctx, v.x - 10, v.y - 12, arc);
                        if (u > 0.25 && u < 0.6)
                            this.hitSpark(ctx, v.x - 14, v.y - 12, (u - 0.25) / 0.35, false); // 盾で受けた火花
                    }
                    this.dust(ctx, v.x + 2, v.y, (u - 0.3) / 0.5); // 押されて足元が滑る
                    break;
                }
                case 'turn': { // 背後から来る技を、振り向いて受け止める（受けた光は counterfx.ts の backGuard）
                    flip = u < 0.08 || u > 0.92;
                    set('guard', Math.min(1, u * 5));
                    ox -= Math.sin(clamp01((u - 0.3) / 0.7) * Math.PI) * 3; // 背中から押される
                    this.dust(ctx, v.x - 2, v.y, (u - 0.3) / 0.5);
                    break;
                }
                case 'barrier': {
                    set('cast', 0.2 + u * 0.6);
                    oy -= arc * 2;
                    if (!isBaseScene(this.sceneOf(w)))
                        this.barrierFx(ctx, v.x, v.y - 12, arc); // 基本の4場面は、ボスごとの対応技の光（counterfx.ts）
                    break;
                }
                case 'shoot': {
                    set('attack', u * 0.9);
                    ox -= Math.sin(clamp01((u - 0.35) / 0.4) * Math.PI) * 2.5; // 発射の反動
                    // 撃ち落とし（氷の槍）: 飛んでくる槍に当たる所・時刻（counterfx.ts の shootDown）に合わせて、早めに撃つ
                    if (co?.fx === 'shootDown') {
                        if (u > 0.15 && u < 0.5)
                            this.projectile(ctx, this.looks[v.f].weapon, v, { x: v.x - 34, y: v.y - 10 }, clamp01((u - 0.15) / 0.35), false);
                    }
                    else if (u > 0.3 && u < 0.75)
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
                    this.smearFx(ctx, v.x + ox - 8, v.y + oy - 14, win(at.t - 0.02, at.t + 0.06), at.crit, this.elementTint(w)?.main ?? this.colors[v.f]?.main ?? '#ffffff'); // 隙の場面は弱点の属性の色
            }
        }
        else if (phase > at.t - 0.14 && phase < at.t + 0.06) {
            const k = win(at.t - 0.14, at.t + 0.06);
            set('attack', k);
            ox -= Math.sin(clamp01((k - 0.5) * 2) * Math.PI) * 2; // 撃った反動
        }
    }
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
        // 倒れたまま、うっすら残る（正しく動ければ起き上がる）
        alpha = 1 - Math.min(0.45, Math.max(0, k - 0.75) * 2);
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
    if (isTarget && atk !== 'treasure' && this.sceneOf(w) !== 'opening' && phase > 0.28 && phase < IMPACT && v.alive && this.frame % 10 < 6) {
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
    // 武器の先の位置（飛び道具はここから出す。このあと同じコマで描く projectile が使う）
    this.muzzles.set(v.f, muzzleOf(look, x, y + 1, { frame: this.frame + v.f * 7, flip, action, t: act01, rot }));
    drawHero(ctx, look, gear, x, y + 1, {
        frame: this.frame + v.f * 7, flip, flash: flash && !reducedMotion(), action, t: act01, rot, alpha,
        ...(st?.charmed && phase > GUARD_HIT + 0.04 && phase < 0.95 && v.alive ? { eyes: 'swirl' } : {}),
        famPos: fam, skillGlow,
    });
    if (v.alive) {
        this.hpBar(ctx, v);
        if (v.shield > 0)
            ctx.drawImage(shieldIcon(), Math.round(v.x + 9), Math.round(v.y + 2));
    }
}
// 秘めた力の燐光: 巻物を持つ人のまわりを、暖かい光の粒がゆっくり漂う（数は持ち物に関係しない）
export function motes(ctx, x, y, f) {
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
export function guardFx(ctx, x, y, g) {
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
export function barrierFx(ctx, x, y, g) {
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
export function slashFx(ctx, x, y, k) {
    if (k <= 0 || k >= 1)
        return;
    // 振り下ろし（左を向いて斬る）: 頭上のうしろ寄りから、前を回って前の下へ。弧の先が伸び、あとから尾が追いつく
    const cx = x + 6, cy = y + 4, head = SWING_FROM + (SWING_TO - SWING_FROM) * ease(Math.min(1, k * 1.5)), tail = SWING_FROM + (SWING_TO - SWING_FROM) * ease(clamp01(k * 1.5 - 0.6));
    ctx.save();
    ctx.globalAlpha = 1 - k * 0.6;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3 - k * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 12, tail, head, true);
    ctx.stroke();
    ctx.restore();
}
// 巻物が左右に広がり、光る文字が流れる
export function scrollFx(ctx, x, y, k, color) {
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
export function magicCircle(ctx, x, y, k, color) {
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
export function dust(ctx, x, y, k) {
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
// ジャーン！と掲げる → きらきら → …何も起きない。道具がぽてっと落ちて、冷や汗
export function decoyGag(ctx, x, y, id, k) {
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
export function gagOf(f) {
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
// 振りの軌跡（スミア）: 武器と同じ向きに回る三日月形の光。会心は金色で大きく
//   冒険者は左（ボス）を向いているので、振り下ろしは「頭上のうしろ寄り → 頭上 → 前 → 前の下」（画面の角度は減っていく）
const SWING_FROM = -0.9, SWING_TO = -3.6; // 終わりは前のやや下（振り終えた武器の向き）
export function smearFx(ctx, x, y, k, crit, color) {
    if (k <= 0 || k >= 1)
        return;
    this.lights.push({ x, y, r: 35, a: 1 - k, col: color });
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const r = crit ? 22 : 17, cx = x + 6, cy = y + 6;
    const head = SWING_FROM + (SWING_TO - SWING_FROM) * ease(Math.min(1, k * 1.6));
    const tail = SWING_FROM + (SWING_TO - SWING_FROM) * ease(clamp01(k * 1.6 - 0.55));
    const fade = 1 - clamp01((k - 0.5) / 0.5);
    for (const [w, col, al] of [[7, color, 0.35], [4, crit ? '#ffe27a' : '#ffffff', 0.8], [1.5, '#ffffff', 1]]) {
        ctx.globalAlpha = al * fade;
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.arc(cx, cy, r, tail, head, true);
        ctx.stroke();
    }
    ctx.restore();
}
export function projectile(ctx, weapon, a, b, k, crit, tint) {
    const arc = weapon === 'bow' ? 12 : 4;
    // 出発点は武器の先（このコマで描いたキャラの、弓の前・銃口・杖の宝珠など）。わからないときは胸の高さ
    const m = a.f !== undefined ? this.muzzles.get(a.f) : undefined;
    const s0 = m ?? { x: a.x, y: a.y - 10 };
    const at = (kk) => ({ x: lerp(s0.x, b.x, kk), y: lerp(s0.y, b.y - 8, kk) - Math.sin(kk * Math.PI) * arc });
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
        ctx.fillStyle = tint ?? (weapon === 'blaster' ? '#63d471' : weapon === 'wand' ? '#c77dff' : '#5fcde4');
        ctx.fillRect(rx - r, ry - r, r * 2 + 1, r * 2 + 1);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(rx - 1, ry - 1, 2, 2);
    }
    ctx.restore();
}
// 当たりの火花: 中心の白い閃光 → 放射状の光の筋 → 広がる輪 → 飛び散る粒
// tint: 属性の色（隙の場面で、弱点の属性を突いたとき）。{ main, light } を渡すと、火花と光の色がその属性になる
export function hitSpark(ctx, x, y, k, crit, tint) {
    this.lights.push({ x, y, r: (crit ? 60 : 40) * (1 - k * 0.5), a: 1 - k, col: tint ? tint.main : crit ? '#ffcf3a' : '#9fe0ff' });
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const rng = new Rng(`spark:${Math.round(x)}:${Math.round(y)}`);
    const col = tint ? (crit ? tint.light : tint.main) : crit ? '#ffcf3a' : '#9fe0ff';
    if (k < 0.35) {
        const r = (crit ? 14 : 9) * (1 - k / 0.35);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.4, tint ? `${tint.main}cc` : crit ? 'rgba(255,220,90,0.8)' : 'rgba(160,220,255,0.7)');
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
// 正否のオーラ（キャラについていく）: 正しく動けた人は緑の光に包まれ、光の粒が上へ立ちのぼる。
// 誤った人は赤く明滅し、火の粉が下へこぼれ落ちる。連携詠唱の場面では出さない（唱える番まで成否を伏せる）
export function aura(ctx, x, y, f, st, phase) {
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
//# sourceMappingURL=arena-fighter.js.map