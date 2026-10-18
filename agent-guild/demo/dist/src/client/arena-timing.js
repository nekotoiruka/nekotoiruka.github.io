import { CHAIN_TEMPOS, GAG, GUARD_HIT, IMPACT, MINE_BAND, clamp01 } from './arena-common.js';
import { bossCue, counterFor } from './bossmoves.js';
import { MELEE_WEAPONS } from '../shared/catalog.js';
import { shoutEndT, SPELL_T, ultBeats, ultHitT, verseAt } from './scenes.js';
import { play } from './sfx.js';
export function slowFactor(time) {
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
export function hitStop(w, phase) {
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
export function lagOf(w, f) {
    const x = this.script.fighters[f].slot.x;
    const sc = this.sceneOf(w);
    return sc === 'tail' ? clamp01((x - 150) / 234) * 0.12 : sc === 'breath' ? clamp01((x - 150) / 234) * 0.05 : 0;
}
// 正しく動けたときの身のこなし: 基本の4場面は、ボスごとの対応技の動き。それ以外は、キャラごとの得意な動き
export function evadeOf(w, f) {
    return counterFor(this.script.theme?.kind, this.sceneOf(w))?.evade ?? this.evades[f];
}
export function cues(w) {
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
    else if (wv.attack !== 'treasure' && sc !== 'opening')
        c.push(bossCue(this.script.theme?.kind, sc)); // 隙あり（よろめいている）ときは、ほえない
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
            const ev = this.evadeOf(w, e.f), co = counterFor(this.script.theme?.kind, sc);
            c.push({ t: IMPACT + this.lagOf(w, e.f), s: co ? co.sfx : ev === 'block' ? 'guard' : ev === 'barrier' ? 'barrier' : ev === 'slash' ? 'slash' : ev === 'shoot' ? 'shoot' : 'whoosh' });
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
export function playCues(prev, now) {
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
export function finisher(w) {
    if (w !== this.script.waves.length - 1)
        return null;
    if (this.downAt && this.downAt.wave === w)
        return this.downAt.t;
    const ds = this.script.waves[w].events.filter((e) => e.type === 'death');
    return ds.length ? ds[ds.length - 1].t : null;
}
// 再生速度の倍率（注目キャラの反撃・決着の瞬間はスロー）
export function bandWave(w) {
    const s = this.script, wv = s.waves[w];
    if (!wv || this.chainOf(w) || this.ultOf(w) || this.sceneOf(w) === 'spell')
        return false;
    const mine = [...this.mine].find((f) => !s.fighters[f].off);
    return mine !== undefined && wv.events.some((e) => e.type === 'strike' && e.f === mine);
}
//# sourceMappingURL=arena-timing.js.map