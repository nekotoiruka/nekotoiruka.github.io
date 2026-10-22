// 演出ギャラリー（運営・開発用）: 大技の演出を「場面 × 武器」で選んで再生し、ボスの攻撃の準備・攻撃のモーションを「ボス × 場面」で見比べ、
// 連携詠唱（7人で成功・あなたが最後の節）も見る。
// scripts/build-gallery.mjs が 1ファイルの HTML にまとめる。討伐データは window.__DEMO__（紹介ページと同じ吸血鬼伯爵の見本）。
import { ArenaRenderer, CHAIN_TEMPOS } from './arena.js';
import { CHAIN_INSIDE_MAX } from './arena-chain.js';
import { getDemoBattle, scriptFor } from './api.js';
import { ULT_SCENES, ultName } from './scenes.js';
import { play, setSfx } from './sfx.js';
import { WEAPON_KINDS, WEAPON_LABELS } from '../shared/catalog.js';
import { reducedMotion } from './motion.js';
import { FX_LOOK_BEFORE, FX_LOOK_DEFAULT, setFxLook } from './fxlook.js';
import { h } from './ui.js';
import { tl } from '../shared/i18n.js';
const SCENE_JA = { ougi: tl('奥義（跳躍）'), rush: tl('乱舞'), summon: tl('召喚'), parry: tl('返し技'), seal: tl('封印'), awaken: tl('覚醒') };
const SECONDS_PER_WAVE = 3.4;
// ボスのモーション: ボスの種類（と、そのボスのブレスの種類）と、見せる場面（bossmotion.ts の moveFor で動きが決まる）
const BOSSES = [
    { kind: 'dragon', name: '竜', breath: 'fire' }, { kind: 'spider', name: '大蜘蛛', breath: 'web' }, { kind: 'goblin', name: 'ゴブリンの群れ', breath: 'arrows' },
    { kind: 'kraken', name: 'クラーケン', breath: 'water' }, { kind: 'golem', name: '石の巨人', breath: 'rocks' }, { kind: 'vampire', name: '吸血鬼伯爵', breath: 'mist' },
    { kind: 'giant', name: '氷の巨人', breath: 'ice' },
];
// 正しく動けた冒険者の対応技（bossmoves.ts の COUNTERS と同じ組み合わせ）。ギャラリーで動きと見比べるための説明で、本番の画面には出さない
// （本番の技名は、自分の冒険者がその場面で答えた言葉。ほかの人は「かわした」）
const COUNTER_NAMES = {
    dragon: { breath: '鏡で炎を受ける', claw: '影を残してすり抜ける', dive: '伏せる', tail: '跳んでかわす' },
    vampire: { breath: '聖なる光で蝙蝠を散らす', claw: '爪をはじく', dive: '飛びのく', tail: '振り向いて受け止める' },
    spider: { breath: '糸を斬りはらう', claw: '横へ跳ぶ', dive: '影を残してすり抜ける', tail: '脚を跳び越える' },
    goblin: { breath: '盾をかかげて矢を受ける', claw: '落とし穴を跳び越える', dive: '投石から飛びのく', tail: '穂先をはらう' },
    kraken: { breath: '風で墨を吹きはらう', claw: '伏せて触手をくぐる', dive: '跳んで離れる', tail: '触手を斬る' },
    golem: { breath: '石礫を打ち砕く', claw: '拳から飛びのく', dive: '地割れを跳び越える', tail: '伏せてやりすごす' },
    giant: { breath: '炎で冷気を溶かす', claw: '氷の槍を撃ち落とす', dive: '踏みつけから飛びのく', tail: '棍棒を跳び越える' },
};
const MOTION_SCENES = [
    { scene: 'breath', name: 'ブレス（息を吸って吐く）' }, { scene: 'claw', name: '爪・突進' }, { scene: 'tail', name: '尾（背を向けて振る）' },
    { scene: 'dive', name: '急降下（跳ぶ・登る・踏みつけ）' }, { scene: 'opening', name: 'ふらつき（隙）' }, { scene: 'fog', name: '霧の中' },
    { scene: 'spell', name: '詠唱' }, { scene: 'illusion', name: '幻術の声' },
];
async function main() {
    const root = document.getElementById('app');
    const data = await getDemoBattle();
    const first = scriptFor(data);
    const best = first.standings.slice().sort((a, b) => a.rank - b.rank)[0].f;
    const bestId = first.fighters[best].id;
    const full = scriptFor(data, [bestId]);
    // ---- 大技: 場面 × 武器 ----
    const ultW = full.waves.findIndex((wv) => ['ougi', 'rush', 'summon'].includes(full.cases[wv.caseIndex]?.scene ?? ''));
    const canvas = h('canvas', { class: 'arena-canvas pixel' });
    const r = new ArenaRenderer(canvas, full);
    r.muted = true;
    r.mine = new Set([best]);
    const baseWeapon = new Map();
    let scene = 'ougi', weapon = 'sword', t = 0.2, playing = true, auto = false;
    const title = h('h2', { class: 'g-title' });
    const sub = h('p', { class: 'small muted' });
    const sceneRow = h('div', { class: 'g-row' });
    const weaponRow = h('div', { class: 'g-row' });
    const sync = () => {
        title.textContent = tl(`{0}：「{1}」`, SCENE_JA[scene] ?? scene, ultName(scene, weapon));
        sub.textContent = tl(`武器: {0}`, WEAPON_LABELS[weapon]);
        for (const b of sceneRow.querySelectorAll('button'))
            b.classList.toggle('on', b.dataset.k === scene);
        for (const b of weaponRow.querySelectorAll('button'))
            b.classList.toggle('on', b.dataset.k === weapon);
    };
    const restart = () => { t = 0.2; r.frame = 0; sync(); };
    for (const s of ULT_SCENES)
        sceneRow.append(h('button', { class: 'btn g-chip', 'data-k': s, onclick: () => { scene = s; restart(); } }, SCENE_JA[s] ?? s));
    for (const k of WEAPON_KINDS)
        weaponRow.append(h('button', { class: 'btn g-chip', 'data-k': k, onclick: () => { weapon = k; restart(); } }, WEAPON_LABELS[k]));
    const playBtn = h('button', { class: 'btn', onclick: () => { playing = !playing; playBtn.textContent = playing ? tl('一時停止') : tl('再生'); } }, tl('一時停止'));
    const autoBtn = h('button', { class: 'btn', onclick: () => { auto = !auto; autoBtn.textContent = auto ? tl('順番に見る：オン') : tl('順番に見る：オフ'); } }, tl('順番に見る：オフ'));
    const soundBtn = h('button', { class: 'btn', onclick: () => { r.muted = !r.muted; setSfx(!r.muted); soundBtn.textContent = r.muted ? tl('音：なし') : tl('音：あり'); } }, tl('音：なし'));
    const next = () => {
        const wi = WEAPON_KINDS.indexOf(weapon);
        if (wi < WEAPON_KINDS.length - 1)
            weapon = WEAPON_KINDS[wi + 1];
        else {
            weapon = WEAPON_KINDS[0];
            const si = ULT_SCENES.indexOf(scene);
            scene = ULT_SCENES[(si + 1) % ULT_SCENES.length];
        }
        restart();
    };
    // 主役の武器と場面を差し替えて描く（開発用ページと同じやり方）
    r.sceneOf = () => scene;
    const draw = () => {
        const f = r.ultOf(ultW)?.f ?? best;
        if (!baseWeapon.has(f))
            baseWeapon.set(f, r.looks[f].weapon);
        r.looks[f].weapon = weapon;
        r.draw(ultW + t);
    };
    // ---- ボスのモーション: ボス × 場面。見本の討伐のふつうの場面の上で、ボスの種類と場面を差し替えて再生する ----
    const normW = Math.max(0, full.waves.findIndex((wv) => full.cases[wv.caseIndex]?.kind === 'normal'));
    let mKind = 'dragon', mScene = 'breath', mt = 0, mAuto = false, mElement = '炎';
    const ELEMENTS = ['炎', '氷', '雷', '風', '光', '闇'];
    const mElementRow = h('div', { class: 'g-row' });
    const mWrap = h('div', { class: 'canvas-wrap' });
    const mTitle = h('h2', { class: 'g-title' });
    const mCounter = h('p', { class: 'small' });
    const mKindRow = h('div', { class: 'g-row' });
    const mSceneRow = h('div', { class: 'g-row' });
    let mr;
    const makeMotion = () => {
        const b = BOSSES.find((x) => x.kind === mKind);
        const theme = { hue: 0, kind: mKind, breath: b.breath };
        // 正しく動けた冒険者の答えを、この組み合わせの対応技の説明に差し替える（技名の表示と吹き出しが、動きと一致するように）
        const counter = COUNTER_NAMES[mKind][mScene] ?? '（共通の動き）'; // （ で始まる答えは、技名・呪文名として出さない
        const waves = full.waves.map((wv, i) => (i !== normW ? wv : { ...wv, events: wv.events.map((e) => (e.type === 'strike' && e.success ? { ...e, excerpt: counter } : e)) }));
        // 隙の場面: 弱点の属性を差し替える（属性の大技と、冒険者の当たりの色が変わる）
        const cases = full.cases.map((c, i) => (i === full.waves[normW].caseIndex ? { ...c, element: mElement } : c));
        const sc = { ...full, waves, cases, theme, boss: { ...full.boss, name: b.name } };
        const cv = h('canvas', { class: 'arena-canvas pixel' });
        mr = new ArenaRenderer(cv, sc);
        mr.muted = true;
        mr.mine = new Set([best]);
        const self = mr;
        self.sceneOf = () => mScene;
        self.caseTitle = () => MOTION_SCENES.find((x) => x.scene === mScene).name;
        mWrap.replaceChildren(cv);
        mt = 0;
        mTitle.textContent = `${b.name}：${MOTION_SCENES.find((x) => x.scene === mScene).name}`;
        mCounter.textContent = COUNTER_NAMES[mKind][mScene] ? `正しく動けた冒険者の対応技：${counter}` : 'この場面の冒険者の動きは、ボスによらず共通です';
        for (const x of mKindRow.querySelectorAll('button'))
            x.classList.toggle('on', x.dataset.k === mKind);
        for (const x of mSceneRow.querySelectorAll('button'))
            x.classList.toggle('on', x.dataset.k === mScene);
        for (const x of mElementRow.querySelectorAll('button'))
            x.classList.toggle('on', x.dataset.k === mElement);
        mElementRow.hidden = mScene !== 'opening';
    };
    for (const b of BOSSES)
        mKindRow.append(h('button', { class: 'btn g-chip', 'data-k': b.kind, onclick: () => { mKind = b.kind; makeMotion(); } }, b.name));
    for (const e of ELEMENTS)
        mElementRow.append(h('button', { class: 'btn g-chip', 'data-k': e, onclick: () => { mElement = e; makeMotion(); } }, `弱点：${e}`));
    for (const m of MOTION_SCENES)
        mSceneRow.append(h('button', { class: 'btn g-chip', 'data-k': m.scene, onclick: () => { mScene = m.scene; makeMotion(); } }, m.name));
    const mAutoBtn = h('button', { class: 'btn', onclick: () => { mAuto = !mAuto; mAutoBtn.textContent = mAuto ? '順番に見る：オン' : '順番に見る：オフ'; } }, '順番に見る：オフ');
    const mNext = () => {
        const si = MOTION_SCENES.findIndex((x) => x.scene === mScene);
        if (si < MOTION_SCENES.length - 1)
            mScene = MOTION_SCENES[si + 1].scene;
        else {
            mScene = MOTION_SCENES[0].scene;
            mKind = BOSSES[(BOSSES.findIndex((x) => x.kind === mKind) + 1) % BOSSES.length].kind;
        }
        makeMotion();
    };
    makeMotion();
    // ---- 連携詠唱: 討伐隊の全員が大呪を知っている見本。あなたが最後の第7節（成功）／あなたが第7節で詰まる（失敗） ----
    const chainW0 = full.waves.findIndex((wv) => full.cases[wv.caseIndex]?.scene === 'chain');
    const makeChain = (fail, size = data.entrants.length) => {
        if (chainW0 < 0)
            return null;
        const cc = full.cases[full.waves[chainW0].caseIndex];
        const len = cc.chant?.length ?? 7;
        // 人数を絞るときは、あなた（見本の1位）＋ほかの人を先頭から
        const pool = [data.entrants.find((e) => e.id === bestId), ...data.entrants.filter((e) => e.id !== bestId)].slice(0, size);
        const party = pool.map((e) => {
            const me = e.id === bestId;
            const ok = !(fail && me);
            return { ...e, result: { ...e.result, cases: e.result.cases.map((c) => (c.caseId === cc.id ? { ...c, score: ok ? 1 : 0, runs: c.runs.map(() => (ok ? 1 : 0)), mpOut: false, chainUpto: ok ? len : len - 1 } : c)) } };
        });
        const sc = scriptFor({ ...data, entrants: party }, [bestId]);
        if (!sc)
            return null;
        const w = sc.waves.findIndex((wv) => sc.cases[wv.caseIndex]?.scene === 'chain');
        const cv = h('canvas', { class: 'arena-canvas pixel' });
        const cr = new ArenaRenderer(cv, sc);
        cr.muted = true;
        cr.mine = new Set([sc.fighters.findIndex((f) => f.id === bestId)]);
        return { r: cr, w, t: 0, box: h('div', { class: 'canvas-wrap' }, cv) };
    };
    const chains = [makeChain(false), makeChain(true)].filter((x) => !!x && x.w >= 0);
    // 連携詠唱の並び: 唱える人数（1〜7人）ごとの立ち位置。3人までは魔法陣の中、4人からは陣を囲む
    let crowdN = 1;
    const crowdBox = h('div');
    const crowdTitle = h('h2', { class: 'g-title' });
    const crowdRow = h('div', { class: 'g-row' });
    let crowd = null;
    const makeCrowd = () => {
        crowd = makeChain(false, crowdN);
        if (crowd)
            crowd.r.chainTempo = tempo;
        crowdBox.replaceChildren(...(crowd ? [crowd.box] : []));
        crowdTitle.textContent = `連携詠唱の並び（${crowdN}人・${crowdN <= CHAIN_INSIDE_MAX ? '魔法陣の中に立つ' : '魔法陣を囲む'}）`;
        for (const b of crowdRow.querySelectorAll('button'))
            b.classList.toggle('on', b.dataset.k === String(crowdN));
    };
    for (let n = 1; n <= 7; n++)
        crowdRow.append(h('button', { class: 'btn g-chip', 'data-k': String(n), onclick: () => { crowdN = n; makeCrowd(); } }, `${n}人`));
    // 連携詠唱のテンポ（節の詠唱・叫び・タメ・着弾・そのあとの余韻）を選んで見比べる
    let tempo = 'calm';
    const tempoRow = h('div', { class: 'g-row' });
    const syncTempo = () => {
        for (const c of [...chains, ...(crowd ? [crowd] : [])])
            c.r.chainTempo = tempo;
        for (const b of tempoRow.querySelectorAll('button'))
            b.classList.toggle('on', b.dataset.k === tempo);
    };
    for (const k of Object.keys(CHAIN_TEMPOS))
        tempoRow.append(h('button', { class: 'btn g-chip', 'data-k': k, onclick: () => { tempo = k; for (const c of chains) {
                c.t = 0;
                c.r.frame = 0;
            } syncTempo(); } }, CHAIN_TEMPOS[k].label));
    syncTempo();
    makeCrowd();
    let last = performance.now();
    const loop = (now) => {
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        if (playing) {
            t += (dt / SECONDS_PER_WAVE) * r.slowFactor(ultW + t);
            if (t >= 0.98) {
                if (auto)
                    next();
                else {
                    t = 0.2;
                    r.frame = 0;
                }
            }
            r.frame++;
        }
        draw();
        if (playing) {
            mt += dt / SECONDS_PER_WAVE;
            if (mt >= 0.7) {
                if (mAuto)
                    mNext();
                else {
                    mt = 0;
                    mr.frame = 0;
                }
            }
            mr.frame++;
        }
        mr.draw(normW + mt);
        for (const c of [...chains, ...(crowd ? [crowd] : [])]) {
            c.t += (dt / SECONDS_PER_WAVE) * c.r.slowFactor(c.w + c.t);
            if (c.t >= 0.99) {
                c.t = 0;
                c.r.frame = 0;
            }
            c.r.frame++;
            c.r.draw(c.w + c.t);
        }
        requestAnimationFrame(loop);
    };
    // ---- 見た目の調整: 光の強さ・くっきり度（このページのすべての再生に効く） ----
    const GLOWS = [[1, 'いまのまま'], [0.7, '少し控えめ'], [0.45, '控えめ'], [0.2, 'ほぼなし']];
    const CRISPS = [['auto', '場面ごと（必殺技だけ半分くっきり）'], [0, 'なめらか（前の見た目）'], [1, '半分くっきり'], [2, 'くっきり（ドット）']];
    let chosen = { ...FX_LOOK_DEFAULT };
    const lookNow = h('p', { class: 'small' });
    const glowRow = h('div', { class: 'g-row' }), crispRow = h('div', { class: 'g-row' });
    const syncLook = () => {
        setFxLook(chosen);
        for (const b of glowRow.querySelectorAll('button'))
            b.classList.toggle('on', Number(b.dataset.k) === chosen.glow);
        for (const b of crispRow.querySelectorAll('button'))
            b.classList.toggle('on', b.dataset.k === String(chosen.crisp));
        lookNow.textContent = `いまの組み合わせ: 光「${GLOWS.find((g) => g[0] === chosen.glow)?.[1] ?? chosen.glow}」・くっきり度「${CRISPS.find((c) => c[0] === chosen.crisp)?.[1]}」`;
    };
    for (const [k, label] of GLOWS)
        glowRow.append(h('button', { class: 'btn g-chip', 'data-k': String(k), onclick: () => { chosen = { ...chosen, glow: k }; syncLook(); } }, label));
    for (const [k, label] of CRISPS)
        crispRow.append(h('button', { class: 'btn g-chip', 'data-k': String(k), onclick: () => { chosen = { ...chosen, crisp: k }; syncLook(); } }, label));
    // 押しているあいだだけ、いまの見た目に戻して比べる
    const holdBtn = h('button', { class: 'btn g-chip' }, '押しているあいだ「前の見た目」で見る');
    const holdOn = (e) => { e.preventDefault(); setFxLook(FX_LOOK_BEFORE); holdBtn.classList.add('on'); };
    const holdOff = () => { setFxLook(chosen); holdBtn.classList.remove('on'); };
    holdBtn.addEventListener('pointerdown', holdOn);
    holdBtn.addEventListener('pointerup', holdOff);
    holdBtn.addEventListener('pointerleave', holdOff);
    holdBtn.addEventListener('pointercancel', holdOff);
    holdBtn.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter')
        holdOn(e); });
    holdBtn.addEventListener('keyup', holdOff);
    syncLook();
    const lookPanel = h('section', { class: 'card', style: 'position:sticky;top:0;z-index:5' }, h('h2', { class: 'g-title' }, '見た目の調整（光の強さ・くっきり度）'), h('p', { class: 'small muted' }, 'このページのすべての再生（大技・ボスの動き・連携詠唱）に効きます。光の強さは、明かり・閃光・光のにじみの濃さ。くっきり度は、エフェクトを1ドットの格子にそろえる度合いです（キャラとボスの絵は変わりません）。'), h('h3', {}, '光の強さ'), glowRow, h('h3', {}, 'くっきり度'), crispRow, h('div', { class: 'g-row' }, holdBtn), lookNow);
    root.replaceChildren(h('div', { class: 'gallery' }, h('h1', {}, tl('演出ギャラリー')), h('p', { class: 'small muted' }, tl(`見本の討伐（{0}）の上で、主役の場面と武器を差し替えて再生しています。`, data.task.title)), lookPanel, h('section', { class: 'card' }, title, sub, h('div', { class: 'canvas-wrap' }, canvas), h('div', { class: 'g-row' }, playBtn, autoBtn, soundBtn), h('h3', {}, tl('場面')), sceneRow, h('h3', {}, tl('武器')), weaponRow), h('section', { class: 'card' }, mTitle, h('p', { class: 'small muted' }, `ボスの攻撃の準備（予兆・溜め）と攻撃のモーション。ボスの種類ごとに、場面の予兆に合わせて動きます。${reducedMotion() ? 'いまは「視差効果を減らす」設定なので、震えと残像は出していません。' : '「視差効果を減らす」設定のときは、震えと残像を出しません。'}`), mCounter, mWrap, h('div', { class: 'g-row' }, mAutoBtn), h('h3', {}, 'ボス'), mKindRow, h('h3', {}, '場面'), mSceneRow, mElementRow), h('section', { class: 'card' }, h('h2', { class: 'g-title' }, '効果音（討伐の山場と最後）'), h('p', { class: 'small muted' }, 'ボタンを押すと、その音だけを鳴らします（音量に注意）。'), h('div', { class: 'g-row' }, ...[
        ['win', '貢献1位の発表（ファンファーレ）'], ['bossDown', 'ボス撃破'], ['chantDone', '連携詠唱の完成'], ['shout', '大魔法の名を叫ぶ'],
        ['spellImpact', '大魔法の着弾'], ['fanfare', 'ぬか喜びの小さなファンファーレ'], ['fail', 'ずっこける'],
    ].map(([k, label]) => h('button', { class: 'btn g-chip', onclick: () => { setSfx(true); play(k); } }, label)))), h('section', { class: 'card' }, h('h2', { class: 'g-title' }, '連携詠唱のテンポ'), h('p', { class: 'small muted' }, '節の詠唱・大魔法の名の叫び・光の柱までのタメ・着弾とそのあとを、どのくらいゆっくり見せるか。下の2つに同時に効きます。'), tempoRow), h('section', { class: 'card' }, crowdTitle, h('p', { class: 'small muted' }, '唱える人数ごとの立ち位置。あなたは必ず最後の節で、ボスに向いた左の先頭。3人までは魔法陣の中に立ち、4人からは陣のふちを囲みます。'), crowdBox, crowdRow), ...(chains[0] ? [h('section', { class: 'card' }, h('h2', { class: 'g-title' }, '連携詠唱（成功・あなたが最後の第7節）'), chains[0].box)] : []), ...(chains[1] ? [h('section', { class: 'card' }, h('h2', { class: 'g-title' }, '連携詠唱（失敗・あなたが第7節で詰まる）'), chains[1].box)] : [])));
    sync();
    requestAnimationFrame(loop);
}
main().catch((e) => { document.getElementById('app').textContent = tl(`読み込みに失敗しました: {0}`, e.message); });
//# sourceMappingURL=gallery.js.map