let ctx = null;
let enabled = false;
try {
    enabled = localStorage.getItem('sfx') === 'on';
}
catch {
    enabled = false;
}
export function sfxEnabled() { return enabled; }
/** 音のオン・オフ。オンにするときは、必ずボタンを押した処理の中から呼ぶ（スマホは、ユーザー操作の中でしか音を出し始められない） */
export function setSfx(on) {
    enabled = on;
    try {
        localStorage.setItem('sfx', on ? 'on' : 'off');
    }
    catch { /* 保存できなくても動く */ }
    if (on)
        unlock();
}
// iPhone/iPad の Safari では、AudioContext をユーザー操作の中で作って resume し、
// さらに無音のバッファを1回鳴らさないと音が出ない。画面を離れて戻ると 'interrupted' で止まることもあるので、
// 音がオンの間は、次にさわったときにもう一度起こす。
let unlocked = false, watching = false;
function unlock() {
    const a = audio();
    if (!a)
        return;
    try {
        // iOS 16.4+: 消音スイッチがオンでも、音を出すと決めた人には鳴らす
        const s = navigator.audioSession;
        if (s && s.type !== 'playback')
            s.type = 'playback';
    }
    catch { /* 対応していない */ }
    if (!unlocked) {
        try {
            const src = a.createBufferSource();
            src.buffer = a.createBuffer(1, 1, 22050);
            src.connect(a.destination);
            src.start(0);
            unlocked = true;
        }
        catch { /* 鳴らせなくても先へ */ }
    }
    watchGestures();
}
function watchGestures() {
    if (watching || typeof document === 'undefined')
        return;
    watching = true;
    const wake = () => { if (enabled && (!unlocked || ctx?.state !== 'running'))
        unlock(); };
    for (const ev of ['pointerdown', 'touchend', 'keydown'])
        document.addEventListener(ev, wake, { capture: true, passive: true });
}
// 前回オンにしていた人は、最初にさわったときに音を起こす
if (enabled)
    watchGestures();
function audio() {
    if (!enabled)
        return null;
    try {
        if (!ctx) {
            const AC = window.AudioContext ?? window.webkitAudioContext;
            if (!AC)
                return null;
            ctx = new AC();
            chain = buildChain(ctx, ctx.destination);
        }
        // 'suspended' だけでなく、iOS の 'interrupted' からも起こす
        if (ctx.state !== 'running')
            void ctx.resume().catch(() => { });
        return ctx;
    }
    catch {
        return null;
    }
}
let chain = null;
let cur = null; // いま合成している音の出力先
let impulse = null;
function buildChain(a, dest) {
    const master = a.createGain();
    master.gain.value = 0.5;
    const comp = a.createDynamicsCompressor(); // 重なっても割れないように
    comp.threshold.value = -14;
    comp.knee.value = 12;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    master.connect(comp);
    comp.connect(dest);
    // 残響: 減衰していくノイズを、そのまま響きの形（インパルス）にする
    if (!impulse || impulse.sampleRate !== a.sampleRate) {
        const len = Math.floor(a.sampleRate * 1.9);
        impulse = a.createBuffer(2, len, a.sampleRate);
        for (let c = 0; c < 2; c++) {
            const d = impulse.getChannelData(c);
            let lp = 0;
            for (let i = 0; i < len; i++) {
                lp += (Math.random() * 2 - 1 - lp) * 0.55;
                d[i] = lp * Math.pow(1 - i / len, 2.6);
            }
        }
    }
    const conv = a.createConvolver();
    conv.buffer = impulse;
    const rev = a.createGain();
    rev.gain.value = 0.55;
    rev.connect(conv);
    conv.connect(master);
    return { master, rev };
}
// 音の部品
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const pulseWaves = new WeakMap();
function setWave(a, osc, w) {
    if (w !== 'pulse12' && w !== 'pulse25') {
        osc.type = w;
        return;
    }
    const duty = w === 'pulse12' ? 0.125 : 0.25;
    let m = pulseWaves.get(a);
    if (!m)
        pulseWaves.set(a, (m = new Map()));
    let pw = m.get(duty);
    if (!pw) {
        const n = 48, re = new Float32Array(n), im = new Float32Array(n);
        for (let k = 1; k < n; k++)
            re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
        pw = a.createPeriodicWave(re, im);
        m.set(duty, pw);
    }
    osc.setPeriodicWave(pw);
}
// 出力へ（dry）と、残響へ（wet）の両方につなぐ
function route(a, g, wet = 0) {
    g.connect(cur.master);
    if (wet > 0) {
        const s = a.createGain();
        s.gain.value = wet;
        g.connect(s);
        s.connect(cur.rev);
    }
}
function env(g, t, o) {
    const at = o.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.vol), t + at);
    if (o.hold)
        g.gain.setValueAtTime(Math.max(0.0002, o.vol), t + at + o.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
}
function tone(a, t, o) {
    t = Math.max(t, a.currentTime); // 先に鳴らす音が、始まりより前にならないように
    const osc = a.createOscillator(), g = a.createGain();
    setWave(a, osc, o.type ?? 'square');
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1)
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur);
    if (o.detune)
        osc.detune.value = o.detune;
    if (o.vib) { // [回/秒, 深さ(Hz)]
        const lfo = a.createOscillator(), lg = a.createGain();
        lfo.frequency.value = o.vib[0];
        lg.gain.value = o.vib[1];
        lfo.connect(lg);
        lg.connect(osc.frequency);
        lfo.start(t);
        lfo.stop(t + o.dur + 0.05);
    }
    env(g, t, { vol: o.vol ?? 0.3, attack: o.attack, hold: o.hold, dur: o.dur });
    let node = osc;
    if (o.lp) { // [開始Hz, 終了Hz] ローパスで丸く
        const f = a.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(o.lp[0], t);
        if (o.lp[1])
            f.frequency.exponentialRampToValueAtTime(o.lp[1], t + o.dur);
        osc.connect(f);
        node = f;
    }
    node.connect(g);
    route(a, g, o.wet);
    osc.start(t);
    osc.stop(t + o.dur + 0.05);
}
// 金属・鈴の音（FM合成）。ratio は変調の比、index は変調の深さ（だんだん減る）
function fm(a, t, o) {
    t = Math.max(t, a.currentTime); // 先に鳴らす音が、始まりより前にならないように
    const car = a.createOscillator(), mod = a.createOscillator(), mg = a.createGain(), g = a.createGain();
    car.type = 'sine';
    mod.type = 'sine';
    car.frequency.value = o.f;
    mod.frequency.value = o.f * (o.ratio ?? 3.5);
    const idx = (o.index ?? 4) * o.f;
    mg.gain.setValueAtTime(idx, t);
    mg.gain.exponentialRampToValueAtTime(Math.max(1, idx * 0.02), t + o.dur);
    mod.connect(mg);
    mg.connect(car.frequency);
    env(g, t, { vol: o.vol ?? 0.15, attack: o.attack ?? 0.002, dur: o.dur });
    car.connect(g);
    route(a, g, o.wet);
    car.start(t);
    mod.start(t);
    car.stop(t + o.dur + 0.05);
    mod.stop(t + o.dur + 0.05);
}
let noiseBuf = null;
function noiseSrc(a) {
    if (!noiseBuf || noiseBuf.sampleRate !== a.sampleRate) {
        noiseBuf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++)
            d[i] = Math.random() * 2 - 1;
    }
    const src = a.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    return src;
}
function noise(a, t, o) {
    t = Math.max(t, a.currentTime); // 先に鳴らす音が、始まりより前にならないように
    const src = noiseSrc(a), flt = a.createBiquadFilter(), g = a.createGain();
    flt.type = o.type ?? 'bandpass';
    flt.frequency.setValueAtTime(o.f0 ?? 2000, t);
    if (o.f1)
        flt.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
    flt.Q.value = o.q ?? 1;
    const v = o.vol ?? 0.4;
    if (o.attack)
        env(g, t, { vol: v, attack: o.attack, dur: o.dur });
    else {
        g.gain.setValueAtTime(v, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    }
    src.connect(flt);
    let node = flt;
    if (o.trem) { // [回/秒, 深さ0〜1] 震える（雷・地鳴り・炎）
        const tg = a.createGain(), lfo = a.createOscillator(), lg = a.createGain();
        tg.gain.value = 1 - o.trem[1] / 2;
        lfo.frequency.value = o.trem[0];
        lg.gain.value = o.trem[1] / 2;
        lfo.connect(lg);
        lg.connect(tg.gain);
        lfo.start(t);
        lfo.stop(t + o.dur + 0.05);
        flt.connect(tg);
        node = tg;
    }
    node.connect(g);
    route(a, g, o.wet);
    src.start(t, Math.random());
    src.stop(t + o.dur + 0.05);
}
// 声（「あー」）: のこぎり波を重ねて、母音のフォルマントに通す。聖歌のうねりや、みんなの叫び声に使う
const VOWEL_A = [800, 1150, 2800];
function voice(a, t, o) {
    t = Math.max(t, a.currentTime);
    const n = o.voices ?? 4, v = o.vowel ?? VOWEL_A;
    const g = a.createGain();
    env(g, t, { vol: o.vol ?? 0.15, attack: o.attack ?? 0.04, hold: o.hold, dur: o.dur });
    v.forEach((fc, i) => {
        const bp = a.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = fc;
        bp.Q.value = 6 + i * 2;
        const bg = a.createGain();
        bg.gain.value = [1, 0.7, 0.35][i];
        bp.connect(bg);
        bg.connect(g);
        for (let k = 0; k < n; k++) {
            const osc = a.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(o.f0, t);
            if (o.f1)
                osc.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
            osc.detune.value = (k - (n - 1) / 2) * (o.spread ?? 14);
            if (o.vib) {
                const lfo = a.createOscillator(), lg = a.createGain();
                lfo.frequency.value = 5 + k * 0.4;
                lg.gain.value = o.vib;
                lfo.connect(lg);
                lg.connect(osc.detune);
                lfo.start(t);
                lfo.stop(t + o.dur + 0.05);
            }
            osc.connect(bp);
            osc.start(t);
            osc.stop(t + o.dur + 0.05);
        }
    });
    route(a, g, o.wet);
}
// 音の並び（ファンファーレなど）: [音の高さ(MIDI), 長さ(拍)] を、間隔 step 秒で並べる。0 は休み
function melody(a, t, notes, step, o) {
    let at = t;
    for (const [m, len] of notes) {
        if (m > 0)
            tone(a, at, { ...o, f0: midi(m), f1: o.f1 ? midi(m) * (o.f1 / 1) : undefined, dur: len * step * 0.96 });
        at += len * step;
    }
    return at - t;
}
// 爆発のひとかたまり
function blast(a, t, o) {
    const z = o.size ?? 1;
    noise(a, t, { dur: 0.9 * z, f0: 2200, f1: 60, q: 0.6, vol: 0.7, type: 'lowpass', wet: o.wet });
    tone(a, t, { type: 'sine', f0: 150, f1: 28, dur: 0.8 * z, vol: 0.5 });
    tone(a, t, { type: 'square', f0: 110, f1: 30, dur: 0.5 * z, vol: 0.18 });
    noise(a, t, { dur: 0.06, f0: 6000, q: 0.5, vol: 0.4, type: 'highpass' }); // 最初の「バシッ」
}
// 破片がぱらぱら落ちる音
function debris(a, t, n, span) {
    for (let i = 0; i < n; i++)
        noise(a, t + (i / n) * span + Math.random() * 0.03, { dur: 0.04 + Math.random() * 0.04, f0: 600 + Math.random() * 3000, q: 4, vol: 0.12 * (1 - i / n) + 0.02 });
}
// 同じ音が一度に何十回も鳴らないように、種類ごとに間引く
const lastAt = new Map();
export function play(name, strength = 1) {
    const a = audio();
    if (!a || !chain)
        return;
    const t = a.currentTime;
    if ((lastAt.get(name) ?? -1) > t - 0.05)
        return;
    lastAt.set(name, t);
    cur = trimmed(a, chain, name);
    synth(a, t, name, strength);
}
// 音の大きさをそろえる: 小さな音は持ち上げ、大技の音はそのまま（全体の強弱が「ふだん < 必殺技 < 決着」になるように）
const TRIM = {
    slash: 1.8, whoosh: 2.5, shoot: 2.2, tool: 2, jump: 2, dive: 2, hit: 1.6, hurt: 1.8, guard: 1.6, barrier: 1.5, shatter: 1.5, charm: 1.3, skill: 1.8, poof: 1.8, chant: 1.5,
    rumble: 1.8, thunder: 1.5, charge: 1.6, roar: 1.8, breath: 1.8, awakenFlare: 1.8, summonHorn: 1.8, chantDone: 1.8, fanfare: 2, fail: 1.5, crit: 1.4, ko: 1.3, sealBind: 1.2, boom: 1.2, win: 2.4, shout: 1.2, spellImpact: 1.3,
    bats: 1.8, hiss: 1.8, volley: 1.8, splash: 1.6, frost: 1.8, fireWall: 1.6,
};
function trimmed(a, c, name) {
    const k = TRIM[name] ?? 1;
    if (k === 1)
        return c;
    const m = a.createGain(), r = a.createGain();
    m.gain.value = k;
    r.gain.value = k;
    m.connect(c.master);
    r.connect(c.rev);
    return { master: m, rev: r };
}
/** 書き出し（テスト・確認用）: 音を1つ、無音の部屋で鳴らして波形を返す */
export async function renderSfx(name, strength = 1, seconds = 5, rate = 44100) {
    const off = new OfflineAudioContext(1, Math.floor(rate * seconds), rate);
    const c = buildChain(off, off.destination);
    cur = trimmed(off, c, name);
    synth(off, 0.02, name, strength);
    return (await off.startRendering()).getChannelData(0);
}
function synth(a, t, name, strength) {
    const s = Math.min(1.5, strength);
    switch (name) {
        case 'slash': // 刃の風切りと、金属の「シャッ」
            noise(a, t, { dur: 0.16, f0: 7000, f1: 1500, q: 2.5, vol: 0.4 * s, attack: 0.012 });
            fm(a, t + 0.02, { f: 2600, ratio: 2.1, index: 2, dur: 0.22, vol: 0.05 * s, wet: 0.25 });
            tone(a, t, { type: 'sawtooth', f0: 1100, f1: 260, dur: 0.1, vol: 0.07 });
            break;
        case 'hit': // 重めの打撃
            noise(a, t, { dur: 0.14, f0: 1200, f1: 180, q: 1.2, vol: 0.55 * s, type: 'lowpass' });
            tone(a, t, { type: 'sine', f0: 190, f1: 48, dur: 0.16, vol: 0.5 * s });
            noise(a, t, { dur: 0.025, f0: 5000, q: 0.6, vol: 0.3 * s, type: 'highpass' });
            break;
        case 'crit': // 会心: 重い一撃に、澄んだ金属の響きとキラキラ
            noise(a, t, { dur: 0.3, f0: 1600, f1: 100, q: 0.8, vol: 0.65, type: 'lowpass' });
            tone(a, t, { type: 'sine', f0: 240, f1: 40, dur: 0.3, vol: 0.55 });
            noise(a, t, { dur: 0.04, f0: 6000, q: 0.5, vol: 0.4, type: 'highpass' });
            fm(a, t + 0.01, { f: 1760, ratio: 1.41, index: 3, dur: 0.7, vol: 0.12, wet: 0.35 });
            [88, 93, 100, 105].forEach((m, i) => tone(a, t + 0.05 + i * 0.035, { type: 'triangle', f0: midi(m - 12), dur: 0.16, vol: 0.05, wet: 0.3 }));
            break;
        case 'whoosh':
            noise(a, t, { dur: 0.24, f0: 500, f1: 3600, q: 3, vol: 0.3 * s, attack: 0.07 });
            break;
        case 'guard': // 盾で受ける: 重い金属の「ガキン」
            fm(a, t, { f: 520, ratio: 2.76, index: 5, dur: 0.45, vol: 0.2, wet: 0.2 });
            fm(a, t, { f: 1250, ratio: 1.5, index: 3, dur: 0.3, vol: 0.09 });
            noise(a, t, { dur: 0.05, f0: 3500, q: 3, vol: 0.3 });
            tone(a, t, { type: 'sine', f0: 140, f1: 80, dur: 0.1, vol: 0.25 });
            break;
        case 'barrier': // 結界: きらめく和音
            [81, 84, 88, 93].forEach((m, i) => { tone(a, t + i * 0.04, { type: 'sine', f0: midi(m), dur: 0.7, vol: 0.07, vib: [6, midi(m) * 0.004], wet: 0.5 }); });
            noise(a, t, { dur: 0.4, f0: 9000, q: 0.5, vol: 0.05, type: 'highpass', attack: 0.1, wet: 0.3 });
            break;
        case 'shatter': // ガラスが割れる
            noise(a, t, { dur: 0.4, f0: 7000, f1: 3000, q: 0.7, vol: 0.35, type: 'highpass', wet: 0.3 });
            for (let i = 0; i < 8; i++)
                fm(a, t + i * 0.03 + Math.random() * 0.02, { f: 2200 + Math.random() * 2600, ratio: 2.3, index: 1.5, dur: 0.1 + Math.random() * 0.12, vol: 0.05, wet: 0.35 });
            break;
        case 'charm': // 幻術: ゆらゆらした怪しい音
            tone(a, t, { type: 'sine', f0: 440, f1: 207, dur: 0.8, vol: 0.14, attack: 0.1, vib: [7, 14], wet: 0.4 });
            tone(a, t, { type: 'sine', f0: 466, f1: 220, dur: 0.8, vol: 0.12, attack: 0.1, vib: [5.5, 12], wet: 0.4 });
            break;
        case 'skill': // 巻物をひらく: 魔法のきらめきが駆け上がる
            [72, 76, 79, 84, 88, 91].forEach((m, i) => tone(a, t + i * 0.045, { type: 'pulse25', f0: midi(m), dur: 0.2, vol: 0.06, wet: 0.35 }));
            noise(a, t, { dur: 0.55, f0: 8000, q: 0.5, vol: 0.07, type: 'highpass', attack: 0.15, wet: 0.3 });
            break;
        case 'tool':
            tone(a, t, { type: 'pulse25', f0: 660, f1: 990, dur: 0.07, vol: 0.12 });
            tone(a, t + 0.06, { type: 'pulse25', f0: 1320, dur: 0.1, vol: 0.1, wet: 0.15 });
            break;
        case 'hurt': // 被弾: 「うっ」
            tone(a, t, { type: 'pulse25', f0: 340, f1: 85, dur: 0.18, vol: 0.2 });
            noise(a, t, { dur: 0.1, f0: 1400, f1: 400, q: 1, vol: 0.3 });
            tone(a, t, { type: 'sine', f0: 120, f1: 50, dur: 0.12, vol: 0.3 });
            break;
        case 'ko': // 倒れる: 下がっていく音と、ドサッ
            [67, 64, 60, 55].forEach((m, i) => tone(a, t + i * 0.1, { type: 'pulse25', f0: midi(m), f1: midi(m) * 0.9, dur: 0.14, vol: 0.13, wet: 0.2 }));
            noise(a, t + 0.4, { dur: 0.25, f0: 500, f1: 80, q: 0.7, vol: 0.35, type: 'lowpass' });
            tone(a, t + 0.4, { type: 'sine', f0: 100, f1: 35, dur: 0.3, vol: 0.35 });
            break;
        case 'roar': // ボスのほえ声: うなる低音と息
            tone(a, t, { type: 'sawtooth', f0: 85, f1: 62, dur: 0.6, vol: 0.2, attack: 0.06, vib: [17, 6], lp: [900, 250], wet: 0.3 });
            tone(a, t, { type: 'sawtooth', f0: 88, f1: 66, dur: 0.6, vol: 0.18, attack: 0.06, detune: 18, vib: [13, 5], lp: [700, 220] });
            noise(a, t, { dur: 0.6, f0: 500, f1: 150, q: 0.9, vol: 0.4 * s, type: 'lowpass', attack: 0.05, wet: 0.2 });
            break;
        case 'breath': // 炎の息: ごうっと、ぱちぱち
            noise(a, t, { dur: 0.9, f0: 400, f1: 1600, q: 0.6, vol: 0.4, type: 'bandpass', attack: 0.25, trem: [24, 0.5], wet: 0.2 });
            noise(a, t + 0.2, { dur: 0.7, f0: 200, f1: 90, q: 0.7, vol: 0.3, type: 'lowpass', attack: 0.2 });
            debris(a, t + 0.15, 10, 0.7);
            break;
        case 'shoot':
            tone(a, t, { type: 'pulse25', f0: 1500, f1: 300, dur: 0.1, vol: 0.12 });
            noise(a, t, { dur: 0.07, f0: 4500, f1: 1500, q: 2, vol: 0.15 });
            break;
        case 'fanfare': // 小さなファンファーレ（ずっこける前のぬか喜び）
            melody(a, t, [[72, 1], [76, 1], [79, 1], [84, 2.4]], 0.075, { type: 'pulse25', vol: 0.09, wet: 0.25 });
            melody(a, t, [[60, 1], [64, 1], [67, 1], [72, 2.4]], 0.075, { type: 'pulse12', vol: 0.05 });
            break;
        case 'fail': // ぷっぷっぷー（悲しいトロンボーン）
            [[67, 0.2], [66, 0.2], [65, 0.2], [62, 0.7]].reduce((at, [m, d], i) => { tone(a, at, { type: 'sawtooth', f0: midi(m), f1: i === 3 ? midi(m) * 0.82 : undefined, dur: d, vol: 0.12, vib: i === 3 ? [6, 8] : undefined, lp: [1500, 600], wet: 0.2 }); return at + d + 0.02; }, t);
            break;
        case 'win': { // 勝利のファンファーレ（約3秒）
            const st = 0.12;
            melody(a, t, [[72, 1], [72, 1], [72, 1], [72, 3], [68, 3], [70, 3], [72, 2], [70, 1], [72, 6]], st, { type: 'pulse25', vol: 0.1, wet: 0.3 });
            melody(a, t, [[64, 1], [64, 1], [64, 1], [64, 3], [60, 3], [62, 3], [64, 2], [62, 1], [64, 6]], st, { type: 'pulse12', vol: 0.06, wet: 0.2 });
            melody(a, t, [[48, 4], [48, 3], [44, 3], [46, 3], [48, 3], [43, 1], [48, 6]], st, { type: 'triangle', vol: 0.2 });
            [[60, 7.5], [64, 7.5], [67, 7.5]].forEach(([m]) => tone(a, t + 19 * st, { type: 'sawtooth', f0: midi(m), dur: 1.5, vol: 0.04, attack: 0.02, lp: [3000, 800], wet: 0.5 }));
            fm(a, t + 19 * st, { f: midi(96), ratio: 3.5, index: 2, dur: 1.4, vol: 0.06, wet: 0.5 });
            break;
        }
        case 'bossDown': { // ボス撃破: うめき声 → 連鎖する大爆発 → 魂が昇っていく → 余韻
            tone(a, t, { type: 'sawtooth', f0: 150, f1: 32, dur: 1.5, vol: 0.2, attack: 0.05, vib: [9, 8], lp: [1400, 120], wet: 0.4 });
            tone(a, t, { type: 'sawtooth', f0: 154, f1: 34, dur: 1.5, vol: 0.16, detune: 20, vib: [7, 6], lp: [1000, 100] });
            [0.25, 0.55, 0.8, 1.0, 1.2, 1.45].forEach((d, i) => blast(a, t + d, { size: i === 5 ? 1.6 : 0.8 + i * 0.05, wet: 0.35 }));
            debris(a, t + 0.3, 24, 1.8);
            noise(a, t + 1.5, { dur: 1.2, f0: 4000, f1: 9000, q: 0.5, vol: 0.12, type: 'highpass', attack: 0.3, wet: 0.5 });
            tone(a, t + 1.5, { type: 'sine', f0: 220, f1: 1760, dur: 1.2, vol: 0.12, attack: 0.3, wet: 0.6 });
            [72, 76, 79, 84].forEach((m, i) => fm(a, t + 2.0 + i * 0.1, { f: midi(m + 12), ratio: 3.5, index: 1.5, dur: 1.4, vol: 0.07, wet: 0.6 }));
            break;
        }
        case 'charge': // 大技の溜め: うなりが高まり、震えが速くなる
            tone(a, t, { type: 'sawtooth', f0: 52, f1: 130, dur: 1.5, vol: 0.14, attack: 0.5, lp: [300, 1400] });
            tone(a, t, { type: 'sawtooth', f0: 55, f1: 138, dur: 1.5, vol: 0.1, attack: 0.5, detune: 25, lp: [300, 1400] });
            noise(a, t, { dur: 1.5, f0: 200, f1: 1800, q: 1.2, vol: 0.2, type: 'bandpass', attack: 0.6, trem: [8, 0.7] });
            tone(a, t + 0.4, { type: 'sine', f0: 400, f1: 1600, dur: 1.1, vol: 0.05, attack: 0.5, wet: 0.4 });
            break;
        case 'jump':
            noise(a, t, { dur: 0.32, f0: 400, f1: 4500, q: 2, vol: 0.35, attack: 0.05 });
            tone(a, t, { type: 'pulse25', f0: 220, f1: 900, dur: 0.22, vol: 0.1 });
            break;
        case 'dive':
            noise(a, t, { dur: 0.4, f0: 5500, f1: 500, q: 3, vol: 0.3 });
            tone(a, t, { type: 'triangle', f0: 2000, f1: 240, dur: 0.4, vol: 0.1 });
            break;
        case 'boom':
            blast(a, t, { wet: 0.3 });
            tone(a, t + 0.02, { type: 'triangle', f0: 2093, f1: 1046, dur: 0.5, vol: 0.08, wet: 0.4 });
            break;
        case 'rumble':
            noise(a, t, { dur: 0.55, f0: 260, f1: 70, q: 0.7, vol: 0.38, type: 'lowpass', trem: [18, 0.6] });
            tone(a, t, { type: 'sine', f0: 52, f1: 36, dur: 0.5, vol: 0.3 });
            break;
        case 'thunder': // 雷: ピシャッという割れ目と、ごろごろ
            noise(a, t, { dur: 0.1, f0: 7000, q: 0.5, vol: 0.5, type: 'highpass' });
            noise(a, t + 0.03, { dur: 1.1, f0: 2400, f1: 150, q: 0.5, vol: 0.5, type: 'lowpass', trem: [11, 0.8], wet: 0.4 });
            [1568, 2093, 2637].forEach((f, i) => tone(a, t + i * 0.04, { type: 'sine', f0: f, dur: 0.6, vol: 0.05, wet: 0.4 }));
            break;
        case 'chant': { // 一節ごとの鈴。節が進むほど高く、澄んでいく
            const f = midi(72) * (0.8 + strength * 0.45);
            fm(a, t, { f, ratio: 3.5, index: 2.5, dur: 0.9, vol: 0.12, wet: 0.45 });
            tone(a, t, { type: 'sine', f0: f * 1.5, dur: 0.6, vol: 0.05, wet: 0.4 });
            voice(a, t, { f0: f / 2, dur: 0.5, vol: 0.025, voices: 2, attack: 0.1, wet: 0.5 });
            break;
        }
        case 'poof':
            noise(a, t, { dur: 0.4, f0: 800, f1: 140, q: 0.6, vol: 0.4, type: 'lowpass' });
            tone(a, t + 0.04, { type: 'pulse25', f0: 330, f1: 90, dur: 0.3, vol: 0.09 });
            break;
        case 'chantDone': // 詠唱の完成: 聖歌の和音が高まり、鈴がきらめく
            [[48, 0], [55, 0], [60, 0.05], [64, 0.1], [67, 0.15], [72, 0.2]].forEach(([m, d]) => voice(a, t + d, { f0: midi(m), dur: 1.4, vol: 0.06, attack: 0.5, voices: 3, vib: 6, wet: 0.6 }));
            [84, 88, 91, 96].forEach((m, i) => fm(a, t + 0.5 + i * 0.12, { f: midi(m), ratio: 3.5, index: 2, dur: 0.9, vol: 0.07, wet: 0.5 }));
            tone(a, t, { type: 'sine', f0: 300, f1: 1800, dur: 1.2, vol: 0.06, attack: 0.5, wet: 0.5 });
            break;
        case 'shout': // みんなの叫び「はあっ！」: 声の重なりと、拍をうつ低音
            [[48, 0], [55, 0], [60, 0.02], [64, 0.02], [67, 0.04]].forEach(([m, d]) => voice(a, t + d, { f0: midi(m + 12), f1: midi(m + 12) * 1.03, dur: 0.85, vol: 0.09, attack: 0.025, hold: 0.25, voices: 6, spread: 25, wet: 0.45 }));
            noise(a, t, { dur: 0.12, f0: 2500, q: 0.8, vol: 0.2, type: 'bandpass' });
            tone(a, t, { type: 'sine', f0: 120, f1: 45, dur: 0.4, vol: 0.35 });
            break;
        case 'spellImpact': { // 大魔法の着弾: 世界が割れるような一撃と、長い余韻
            noise(a, t - 0.02, { dur: 0.12, f0: 8000, q: 0.5, vol: 0.55, type: 'highpass' });
            blast(a, t, { size: 2, wet: 0.6 });
            noise(a, t, { dur: 1.8, f0: 3000, f1: 120, q: 0.5, vol: 0.45, type: 'lowpass', trem: [9, 0.7], wet: 0.6 });
            [[36, 0], [43, 0], [48, 0.02], [52, 0.02], [55, 0.04]].forEach(([m, d]) => voice(a, t + d, { f0: midi(m + 12), dur: 1.8, vol: 0.06, attack: 0.03, voices: 5, spread: 22, wet: 0.7 }));
            [96, 91, 88, 84, 79, 76].forEach((m, i) => fm(a, t + 0.1 + i * 0.09, { f: midi(m), ratio: 3.5, index: 2, dur: 1.2, vol: 0.06, wet: 0.6 }));
            debris(a, t + 0.2, 30, 2);
            break;
        }
        case 'impactBlade': // 刃の必殺技: 幾筋もの斬撃と、澄んだ金属音
            [0, 0.045, 0.09].forEach((d, i) => noise(a, t + d, { dur: 0.13, f0: 8000 - i * 1500, f1: 1800, q: 3, vol: 0.3, attack: 0.008 }));
            fm(a, t + 0.1, { f: 1480, ratio: 2.1, index: 3, dur: 1.1, vol: 0.13, wet: 0.5 });
            fm(a, t + 0.1, { f: 2217, ratio: 1.5, index: 2, dur: 0.8, vol: 0.07, wet: 0.5 });
            blast(a, t + 0.1, { size: 0.7, wet: 0.3 });
            break;
        case 'impactHeavy': // 重い必殺技: 大地を割る衝撃と、崩れる瓦礫
            blast(a, t, { size: 1.5, wet: 0.35 });
            tone(a, t, { type: 'sine', f0: 70, f1: 24, dur: 1.2, vol: 0.55 });
            noise(a, t, { dur: 1.1, f0: 300, f1: 60, q: 0.7, vol: 0.5, type: 'lowpass', trem: [14, 0.6] });
            debris(a, t + 0.08, 28, 1.3);
            break;
        case 'impactShot': // 射撃の必殺技: 光が尾を引いて炸裂する
            tone(a, t - 0.1, { type: 'sawtooth', f0: 3200, f1: 180, dur: 0.12, vol: 0.12 });
            blast(a, t, { size: 1, wet: 0.4 });
            tone(a, t, { type: 'pulse25', f0: 1800, f1: 120, dur: 0.5, vol: 0.12, wet: 0.3 });
            noise(a, t, { dur: 0.7, f0: 9000, f1: 2500, q: 0.5, vol: 0.18, type: 'highpass', wet: 0.4 });
            break;
        case 'impactMagic': // 魔法の必殺技: 光が集まり、はじける
            tone(a, t - 0.15, { type: 'sine', f0: 300, f1: 2400, dur: 0.15, vol: 0.1, wet: 0.4 });
            blast(a, t, { size: 0.9, wet: 0.55 });
            [79, 83, 86, 91, 95].forEach((m, i) => fm(a, t + i * 0.05, { f: midi(m), ratio: 3.5, index: 2.5, dur: 1.1, vol: 0.08, wet: 0.6 }));
            [60, 64, 67].forEach((m) => voice(a, t, { f0: midi(m + 12), dur: 1.0, vol: 0.04, attack: 0.05, voices: 3, wet: 0.6 }));
            break;
        case 'sealBind': // 封印の鎖が締まる: じゃらっ、がちゃん
            [0, 0.05, 0.09, 0.13].forEach((d, i) => fm(a, t + d, { f: 900 + i * 230, ratio: 2.76, index: 4, dur: 0.18, vol: 0.1, wet: 0.2 }));
            noise(a, t, { dur: 0.2, f0: 4500, q: 2, vol: 0.18, type: 'bandpass' });
            fm(a, t + 0.2, { f: 330, ratio: 2.3, index: 5, dur: 0.5, vol: 0.2, wet: 0.3 });
            tone(a, t + 0.2, { type: 'sine', f0: 120, f1: 55, dur: 0.25, vol: 0.35 });
            break;
        case 'awakenFlare': // 覚醒: 力があふれ、閃光とともに和音が開く
            tone(a, t, { type: 'sawtooth', f0: 90, f1: 440, dur: 0.7, vol: 0.14, attack: 0.1, vib: [10, 12], lp: [600, 3000], wet: 0.4 });
            noise(a, t, { dur: 0.7, f0: 500, f1: 8000, q: 1, vol: 0.2, attack: 0.3, wet: 0.3 });
            [[60, 0.65], [64, 0.65], [67, 0.65], [72, 0.65]].forEach(([m, d]) => voice(a, t + d, { f0: midi(m + 12), dur: 0.9, vol: 0.06, attack: 0.04, voices: 4, wet: 0.6 }));
            fm(a, t + 0.65, { f: midi(96), ratio: 3.5, index: 2, dur: 1.0, vol: 0.08, wet: 0.6 });
            break;
        case 'bats': // 蝙蝠の群れ: ぱたぱたと羽ばたく音が重なり、甲高い鳴き声
            for (let i = 0; i < 14; i++)
                noise(a, t + i * 0.045 + Math.random() * 0.02, { dur: 0.05, f0: 900 + Math.random() * 700, q: 2, vol: 0.18 * (1 - i / 18), type: 'bandpass' });
            [0.05, 0.2, 0.32].forEach((d, i) => tone(a, t + d, { type: 'sine', f0: 4200 + i * 500, f1: 3000, dur: 0.06, vol: 0.04, wet: 0.3 }));
            break;
        case 'hiss': // 蜘蛛の威嚇: しゅーっという息と、かちかち鳴る牙
            noise(a, t, { dur: 0.6, f0: 6000, f1: 4000, q: 1.2, vol: 0.3 * s, type: 'bandpass', attack: 0.08 });
            [0, 0.08, 0.16].forEach((d) => noise(a, t + 0.1 + d, { dur: 0.02, f0: 3000, q: 4, vol: 0.25 }));
            break;
        case 'volley': // 矢の雨: 弓弦の音が何本も鳴り、風切りが降ってくる
            for (let i = 0; i < 6; i++)
                tone(a, t + i * 0.03, { type: 'triangle', f0: 180 + i * 12, f1: 120, dur: 0.08, vol: 0.08 });
            for (let i = 0; i < 10; i++)
                noise(a, t + 0.12 + i * 0.035, { dur: 0.12, f0: 5000, f1: 1500, q: 3, vol: 0.12 });
            break;
        case 'splash': // 水しぶき: ざばっと立ちのぼる水と、ぱらぱら落ちるしずく
            noise(a, t, { dur: 0.5, f0: 1800, f1: 500, q: 0.7, vol: 0.4 * s, type: 'lowpass', attack: 0.02 });
            noise(a, t, { dur: 0.3, f0: 4000, q: 0.8, vol: 0.15, type: 'highpass' });
            for (let i = 0; i < 8; i++)
                tone(a, t + 0.18 + i * 0.04 + Math.random() * 0.02, { type: 'sine', f0: 900 + Math.random() * 900, f1: 1600, dur: 0.04, vol: 0.04 });
            break;
        case 'frost': // 凍てつく息: 高く鳴る吹雪と、ぴきぴき凍る音
            noise(a, t, { dur: 0.9, f0: 2500, f1: 6000, q: 1.5, vol: 0.32, type: 'bandpass', attack: 0.2, trem: [7, 0.4], wet: 0.4 });
            for (let i = 0; i < 6; i++)
                fm(a, t + 0.3 + i * 0.07, { f: 2500 + Math.random() * 1500, ratio: 2.7, index: 1.5, dur: 0.1, vol: 0.04, wet: 0.4 });
            break;
        case 'fireWall': // 炎の壁: ぼうっと燃え立つ音
            noise(a, t, { dur: 0.6, f0: 300, f1: 1400, q: 0.6, vol: 0.38, type: 'bandpass', attack: 0.06, trem: [20, 0.5], wet: 0.2 });
            tone(a, t, { type: 'sine', f0: 110, f1: 70, dur: 0.3, vol: 0.25 });
            debris(a, t + 0.1, 6, 0.4);
            break;
        case 'summonHorn': // 召喚: 角笛が二度鳴り、渦がまく
            [[55, 0, 0.35], [62, 0.38, 0.7]].forEach(([m, d, l]) => { tone(a, t + d, { type: 'sawtooth', f0: midi(m), dur: l, vol: 0.14, attack: 0.04, vib: [5.5, 3], lp: [700, 1800], wet: 0.5 }); tone(a, t + d, { type: 'sawtooth', f0: midi(m) * 2, dur: l, vol: 0.05, attack: 0.04, detune: 8, lp: [1000, 2400], wet: 0.5 }); });
            noise(a, t, { dur: 1.1, f0: 300, f1: 3500, q: 2, vol: 0.14, attack: 0.5, trem: [9, 0.8], wet: 0.5 });
            break;
    }
}
//# sourceMappingURL=sfx.js.map