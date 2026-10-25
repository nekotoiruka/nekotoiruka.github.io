import { COST_RULES } from '../../shared/catalog.js';
// アリーナ（バトル再生）画面
import { WAVE_SECONDS } from '../arena-common.js';
import { ArenaRenderer, SCALE } from '../arena.js';
import { waveTitleFor } from '../../shared/simulate.js';
import { caseTitleOf } from '../../shared/types.js';
import { POSITION_LABELS } from '../../shared/build.js';
import { pickParty } from '../../shared/party.js';
import { pickStage, restage, STAGE_ALL_MAX, STAGE_LABELS, STAGE_MAX } from '../../shared/stage.js';
import { demoMode, getBattle, getMe, getSeason, scriptFor } from '../api.js';
import { avatarCanvas, fmtMs, h, loadoutChips, nodes, radar } from '../ui.js';
import { setSfx, sfxEnabled } from '../sfx.js';
import { loadRange, nextIncluded, saveRange, waveFilter } from '../playback.js';
import { gmSays } from '../guildmaster.js';
import { tl } from '../../shared/i18n.js';
import { userGet, userSet } from '../userStore.js';
const KIND_LABEL = { normal: tl('通常'), trap: tl('ひっかけ'), bonus: tl('宝箱'), boss: tl('ボス') };
// 1回の仕掛けにかける秒数（何が起きたか追えるよう、ゆっくり）は arena-common.ts の WAVE_SECONDS
const MINE_KEY = 'mine'; // 人ごとの情報なので、ユーザーごとに分けて保存する（userStore.ts）
// 自分のキャラ: サーバーで遊ぶときは、ログイン中の人が送り出した冒険者だけ（ほかの人のキャラを「自分のキャラ」にはできない）。
// アカウントのない静的デモ版だけは、見る人が「自分のキャラ」を選べる（このブラウザに覚える）
let mineIds = new Set();
let pinnable = false;
let mineLabel = tl('あなた');
function loadPinned() {
    try {
        const v = JSON.parse(userGet(MINE_KEY) || '[]');
        return Array.isArray(v) ? v.map(String) : [];
    }
    catch {
        return [];
    }
}
function savePinned(ids) {
    userSet(MINE_KEY, JSON.stringify(ids));
}
let stopCurrent = null;
const RAID_DESC = tl('送り出された冒険者全員で、ボスに挑みます。ボスが仕掛けるたびに、正しく動けた冒険者はかわして反撃し、間違えた冒険者は攻撃を受けます。ボスの大技を外すとダウンしますが、次に正しく動けた場面で起き上がります（脱落はしません）。順位は戦果（正しく動けた割合）→ 燃費 → 速さで決まります。');
// past: 過去のシーズンの討伐を再生するとき（focus の冒険者を「自分」と同じように目立たせる）
export async function renderArena(root, initialView, past) {
    getSeason().catch(() => null); // 課題ごとのコスト上限を読み込む（表示用）
    stopCurrent?.();
    root.replaceChildren(h('p', { class: 'loading' }, tl('読み込み中…')));
    const data = await getBattle(past?.season);
    const me = await getMe().catch(() => null);
    mineLabel = past ? tl('注目') : tl('あなた');
    root.classList.toggle('arena-past-focus', !!past); // 名簿の札も「あなた」ではなく「注目」にする
    pinnable = demoMode && !past;
    mineIds = past ? new Set(past.focus ? [past.focus] : []) : new Set([...data.entrants.filter((e) => me && e.owner === me.name).map((e) => e.id), ...(pinnable ? loadPinned() : [])]);
    // 過去のシーズンのときは、どのシーズンの再生かを上に出す
    const pastBar = data.past ? h('div', { class: 'past-replay-bar' }, h('span', {}, h('b', {}, tl(`過去のシーズンの再生: {0}「{1}」`, data.past.label, data.task.title)), past?.focus ? h('span', { class: 'small muted' }, tl(`　{0} を中心に表示`, data.entrants.find((e) => e.id === past.focus)?.name ?? '')) : null), h('a', { class: 'btn btn-small', href: '#/ranking' }, tl('戦果（順位表）へ戻る'))) : null;
    // ひとりでも討伐に出られる（採点の終わった提出が1件あれば始まる）
    if (!data.entrants.length) {
        root.replaceChildren(...nodes(pastBar), h('div', { class: 'empty' }, h('h2', {}, tl('まだ討伐がありません')), h('p', {}, tl('冒険者を送り出して採点が終わると、ここで討伐が始まります。ひとりでも挑めます。')), h('a', { href: '#/make', class: 'btn' }, tl('キャラをつくる'))));
        return;
    }
    // 討伐隊: あなた＋同じチームの人＋順位の近い人で最大12人（順位はシーズンの参加者全員で決まる）
    const party = { ...data, entrants: pickParty(data.entrants, data.cases, mineIds) };
    const partyOnly = party.entrants.length < data.entrants.length;
    const royale = scriptFor(party);
    const crowded = royale.fighters.length > STAGE_MAX;
    const hasMine = royale.fighters.some((f) => mineIds.has(f.id));
    // 初期の視点: 指定があればそれ、人が多くて自分がいれば「自分と周辺」、それ以外は「決勝」
    let view = initialView ?? (crowded && hasMine ? 'me' : 'finals');
    const viewTabs = Object.keys(STAGE_LABELS).map((v) => h('button', { class: 'tab', 'data-view': v, onclick: () => { view = v; refresh(); } }, STAGE_LABELS[v]));
    const viewBar = h('div', { class: 'tabs view-tabs', role: 'tablist', 'aria-label': tl('視点') }, h('span', { class: 'muted small view-label' }, tl('視点')), ...viewTabs);
    const host = h('div');
    const desc = h('p', { class: 'mode-desc small muted' });
    const stageNote = h('p', { class: 'small muted stage-note' });
    const refresh = () => {
        viewBar.hidden = !crowded;
        viewTabs.forEach((t) => {
            const v = t.dataset.view;
            t.classList.toggle('on', v === view);
            t.disabled = (v === 'all' && royale.fighters.length > STAGE_ALL_MAX) || (v === 'me' && !hasMine);
        });
        desc.textContent = RAID_DESC;
        stopCurrent?.();
        const sc = scriptFor(party, mineIds); // 連携詠唱の結果は、見ている人（あなた）が唱えられたかで変わる
        const mineIdx = sc.fighters.map((f, i) => (mineIds.has(f.id) ? i : -1)).filter((i) => i >= 0);
        const staged = restage(sc, pickStage(sc, mineIdx, view));
        const off = staged.fighters.filter((f) => f.off).length;
        stageNote.textContent = off ? tl(`舞台に立つのは {0} 人（残り {1} 人は画面下の「控え」。順位は全員で決まります）`, staged.fighters.length - off, off)
            : partyOnly ? (hasMine ? tl('討伐隊は、あなた・同じチームの人・順位の近い人の{0}人です（順位はシーズンの参加者全員で決まります）。', sc.fighters.length)
                : tl('いまの戦果の上位{0}人の討伐です。冒険者を送り出すと、あなたの討伐隊の討伐になります。', sc.fighters.length)) : '';
        stopCurrent = mountPlayer(host, staged);
    };
    // まだ送り出していない人に: 見ているのは上位の討伐。自分も加わる入口
    const join = !hasMine && !past && !demoMode ? h('p', { class: 'join-cta' }, h('a', { class: 'btn btn-primary btn-small', href: '#/make' }, tl('冒険者を準備して、討伐に加わる'))) : null;
    root.replaceChildren(...nodes(pastBar, h('div', { class: 'mode-bar' }, viewBar), desc, stageNote, join, host));
    refresh();
}
function mountPlayer(root, script) {
    const canvas = h('canvas', { class: 'arena-canvas pixel', 'aria-label': tl('討伐の再生画面') });
    const r = new ArenaRenderer(canvas, script);
    r.mineLabel = mineLabel;
    window.__arena = r; // 動作確認・録画用
    const total = r.totalTime;
    const waves = r.totalWaves;
    let time = -r.introLen, playing = true, speed = 1, last = performance.now(), raf = 0, ended = false, slowOn = true;
    const syncMine = () => { r.mine = new Set(script.fighters.map((f, i) => (mineIds.has(f.id) ? i : -1)).filter((i) => i >= 0)); };
    syncMine();
    const waveLabel = h('span', { class: 'hud-wave' });
    const kindBadge = h('span', { class: 'badge' });
    const caseTitle = h('span', { class: 'hud-case' });
    const aliveLabel = h('span', { class: 'hud-alive' });
    const feed = h('ul', { class: 'killfeed', 'aria-live': 'polite' });
    const playBtn = h('button', { class: 'btn btn-icon', title: tl('再生 / 一時停止'), 'aria-label': tl('再生 / 一時停止') }, '❚❚');
    const seek = h('input', { type: 'range', min: -r.introLen, max: total, step: 0.01, value: 0, 'aria-label': tl('シーク') });
    const speeds = [1, 2, 4].map((s) => h('button', { class: 'btn btn-speed' + (s === 1 ? ' on' : ''), 'data-speed': s }, `${s}x`));
    const roster = h('ol', { class: 'roster-list' });
    const card = h('div', { class: 'fighter-card' }, h('p', { class: 'muted' }, tl('キャラをクリックすると詳細が出ます')));
    const results = h('div', { class: 'results hidden' });
    // 再生範囲（既定は全部。「見どころだけ」「自分が外した場面だけ」は、もう一度押すと全部に戻る）
    let range = loadRange();
    let inc = [];
    let curWave = -1; // 直前に見ていた場面（飛ばす場面に入ったら次の場面へ進める）
    const hlBtn = h('button', { class: 'btn btn-speed', 'data-range': 'highlights', title: tl('大技の場面・連携詠唱・最後の場面だけを再生します') }, tl('見どころだけ'));
    const missBtn = h('button', { class: 'btn btn-speed', 'data-range': 'misses', title: tl('自分の冒険者が誤った場面だけを再生します（振り返り用）') }, tl('自分が外した場面だけ'));
    const nextBtn = h('button', { class: 'btn btn-speed', 'data-act': 'next-scene', title: tl('いまの場面を飛ばして、次の場面へ進みます') }, tl('次の場面へ'));
    const slowBtn = h('button', { class: 'btn btn-speed on', title: tl('注目キャラの技をスローで見せる'), 'aria-pressed': 'true' }, tl('スロー演出'));
    // 効果音（初期は消音。押すと鳴る。設定はブラウザに覚える）
    const sndBtn = h('button', { class: 'btn btn-speed' + (sfxEnabled() ? ' on' : ''), title: tl('効果音'), 'aria-pressed': String(sfxEnabled()) }, sfxEnabled() ? tl('♪ 音あり') : tl('♪ 音なし'));
    sndBtn.onclick = () => { const on = !sfxEnabled(); setSfx(on); sndBtn.classList.toggle('on', on); sndBtn.setAttribute('aria-pressed', String(on)); sndBtn.textContent = on ? tl('♪ 音あり') : tl('♪ 音なし'); };
    slowBtn.onclick = () => { slowOn = !slowOn; slowBtn.classList.toggle('on', slowOn); slowBtn.setAttribute('aria-pressed', String(slowOn)); };
    root.replaceChildren(h('div', { class: 'arena-page' }, h('section', { class: 'stage' }, h('div', { class: 'hud-top' }, waveLabel, kindBadge, caseTitle, aliveLabel), h('div', { class: 'canvas-wrap' }, canvas, feed, results), h('div', { class: 'controls' }, h('button', { class: 'btn btn-icon', title: tl('最初から'), 'aria-label': tl('最初から'), onclick: () => { jump(-r.introLen); playing = true; } }, '⏮'), playBtn, seek, h('button', { class: 'btn btn-icon', 'data-act': 'to-results', title: tl('結果へ'), 'aria-label': tl('結果へ'), onclick: () => { time = total; } }, '⏭'), h('div', { class: 'controls-opts' }, ...speeds, slowBtn, sndBtn, hlBtn, missBtn, nextBtn))), h('aside', { class: 'side' }, h('h3', {}, tl('参加者')), roster, card)));
    playBtn.onclick = () => { playing = !playing; if (ended) {
        time = -r.introLen;
        ended = false;
        results.classList.add('hidden');
        playing = true;
    } };
    seek.oninput = () => { time = Number(seek.value); ended = false; results.classList.add('hidden'); curWave = Math.floor(time); }; // 自分で選んだ場面は飛ばさない
    speeds.forEach((b) => (b.onclick = () => { speed = Number(b.dataset.speed); speeds.forEach((x) => x.classList.toggle('on', x === b)); }));
    const jump = (t) => { time = t; ended = false; results.classList.add('hidden'); curWave = -1; };
    const applyRange = () => {
        const mine = script.fighters.map((f, i) => (mineIds.has(f.id) ? i : -1)).filter((i) => i >= 0);
        const missed = waveFilter(script, 'misses', mine);
        const canMiss = missed.some(Boolean);
        missBtn.disabled = !canMiss;
        missBtn.title = canMiss ? tl('自分の冒険者が誤った場面だけを再生します（振り返り用）') : tl('自分の冒険者が誤った場面がありません（または自分の冒険者が出ていません）');
        if (range === 'misses' && !canMiss)
            range = 'all';
        inc = waveFilter(script, range, mine);
        for (const b of [hlBtn, missBtn]) {
            const on = b.dataset.range === range;
            b.classList.toggle('on', on);
            b.setAttribute('aria-pressed', String(on));
        }
        if (time >= 0 && time < waves && !inc[Math.floor(time)])
            jump(nextIncluded(inc, Math.floor(time)) ?? waves);
    };
    const setRange = (r) => { range = range === r ? 'all' : r; saveRange(range); applyRange(); };
    hlBtn.onclick = () => setRange('highlights');
    missBtn.onclick = () => setRange('misses');
    nextBtn.onclick = () => {
        const cur = Math.floor(time);
        if (cur >= waves) {
            jump(total);
            ended = false;
            return;
        } // 余韻から結果へ
        jump(nextIncluded(inc, cur + 1) ?? waves);
        playing = true;
    };
    applyRange();
    const toggleMine = (f) => {
        const id = script.fighters[f].id;
        const pinned = new Set(loadPinned());
        if (mineIds.has(id)) {
            mineIds.delete(id);
            pinned.delete(id);
        }
        else {
            mineIds.add(id);
            pinned.add(id);
        }
        savePinned([...pinned]);
        syncMine();
        applyRange();
        renderCard(card, script, f, mineIds.has(id), () => toggleMine(f));
    };
    const select = (f) => {
        r.selected = f;
        renderCard(card, script, f, f !== null && mineIds.has(script.fighters[f].id), pinnable ? () => f !== null && toggleMine(f) : undefined);
    };
    canvas.addEventListener('click', (ev) => {
        const rect = canvas.getBoundingClientRect();
        const f = r.hitTest((ev.clientX - rect.left) * (canvas.width / rect.width), (ev.clientY - rect.top) * (canvas.height / rect.height), time);
        select(f);
    });
    canvas.addEventListener('mousemove', (ev) => {
        const rect = canvas.getBoundingClientRect();
        r.hovered = r.hitTest((ev.clientX - rect.left) * (canvas.width / rect.width), (ev.clientY - rect.top) * (canvas.height / rect.height), time);
        canvas.style.cursor = r.hovered !== null ? 'pointer' : 'default';
    });
    canvas.addEventListener('mouseleave', () => { r.hovered = null; });
    const rosterItems = script.fighters.map((f, i) => {
        const hp = h('span', { class: 'hpbar' }, h('span', { class: 'hpfill' }));
        const stat = h('span', { class: 'roster-stat' });
        // ウェーブごとの正誤（○＝正解、×＝不正解、—＝パス、MP＝行動力切れ）
        const strip = h('span', { class: 'wave-strip', 'aria-label': tl('ウェーブごとの正誤') }, ...script.waves.map(() => h('i', { class: 'wv' })));
        const li = h('li', { class: 'roster-item', tabindex: 0, onclick: () => select(i), onkeydown: (e) => { if (e.key === 'Enter')
                select(i); } }, avatarCanvas(f.loadout, 1), h('span', { class: 'roster-name' }, f.name, h('span', { class: `persona-tag pos-${f.row}` }, POSITION_LABELS[f.row])), hp, stat, strip);
        return { li, hp, stat, strip };
    });
    roster.append(...rosterItems.map((x) => x.li));
    let lastDom = 0;
    const loop = (now) => {
        if (!canvas.isConnected)
            return; // 別の画面へ移動したら止める
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        if (playing && !ended) {
            time += (dt / WAVE_SECONDS) * speed * (slowOn ? r.slowFactor(time) : 1);
            const wi = Math.floor(time);
            if (wi !== curWave) {
                curWave = wi;
                if (wi >= 0 && wi < waves && !inc[wi]) {
                    time = nextIncluded(inc, wi) ?? waves;
                    curWave = Math.floor(time);
                }
            }
            if (time >= total) {
                time = total;
                ended = true;
                showResults(results, script, select);
            }
        }
        // 1コマの描画で失敗しても、再生は止めない（次のコマで描き直す）
        try {
            r.draw(Math.min(time, total));
        }
        catch (e) {
            console.error(e);
        }
        if (now - lastDom > 90) {
            lastDom = now;
            updateHud();
        }
        raf = requestAnimationFrame(loop);
    };
    const updateHud = () => {
        if (!Number.isFinite(time))
            time = 0;
        const w = Math.max(0, Math.min(Math.floor(time), waves - 1)); // 幕開け（マイナスの時刻）は場面1として出す
        const wv = script.waves[w];
        if (!wv)
            return;
        const cm = script.cases[wv.caseIndex];
        waveLabel.textContent = `WAVE ${w + 1}/${waves}`;
        kindBadge.textContent = KIND_LABEL[cm.kind];
        kindBadge.className = `badge badge-${cm.kind}`;
        caseTitle.textContent = r.caseTitle(cm); // 抽選で変わる場面は、あなたの冒険者が引いた見出し
        playBtn.textContent = playing && !ended ? '❚❚' : '▶';
        seek.value = String(time);
        const views = r.state(Math.min(time, waves - 0.0001));
        aliveLabel.textContent = tl(`討伐隊 {0}人`, views.length);
        // 名簿（生存→HP順）
        const dealt = new Array(script.fighters.length).fill(0);
        script.waves.forEach((x, i) => {
            for (const e of x.events)
                if (e.type === 'attack' && (i < w || (i === w && e.t <= time - w)))
                    dealt[e.f] += e.dmg;
            // 連携詠唱の与ダメージ（正解した人で分けたもの）は、演出でダメージが入った瞬間から数える
            const ch = r.chainOf(i);
            if (ch && (i < w || (i === w && ch.dmgAt <= time - w)))
                for (const c of ch.ev.credit)
                    dealt[c.f] += c.dmg;
        });
        // 正誤の帯: いまの時点までに判定が出たウェーブだけ色を付ける
        for (const it of rosterItems)
            for (const c of it.strip.children)
                c.className = 'wv';
        script.waves.forEach((x, i) => {
            if (i > w)
                return;
            const reveal = r.chainOf(i)?.dmgAt ?? 0; // 連携詠唱は、詠唱の成否が出るまで○×を伏せる
            for (const e of x.events) {
                if (i === w && Math.max(e.t, reveal) > time - w)
                    continue;
                if (e.type !== 'strike' && e.type !== 'mpOut')
                    continue;
                const cell = rosterItems[e.f].strip.children[i];
                const cm2 = script.cases[x.caseIndex];
                const t2 = caseTitleOf(cm2, script.fighters[e.f]?.variants?.[cm2.id]); // その冒険者が引いた見出し（ほかの人の分は隠れて一般の見出し）
                if (e.type === 'strike') {
                    cell.className = `wv ${e.success ? 'ok' : 'ng'}`;
                    cell.title = tl(`W{0} {1}: {2}点`, i + 1, t2, Math.round(e.score * 100));
                }
                else {
                    cell.className = 'wv mp';
                    cell.title = tl(`W{0} {1}: 行動力切れ`, i + 1, t2);
                }
            }
        });
        const order = views.slice().sort((a, b) => Number(b.alive) - Number(a.alive) || b.hp - a.hp || a.f - b.f);
        order.forEach((v, k0) => {
            let k = k0;
            const it = rosterItems[v.f];
            it.hp.firstChild.style.width = `${v.hp}%`;
            it.hp.className = 'hpbar' + (v.hp < 25 ? ' low' : v.hp < 50 ? ' mid' : '');
            // 討伐では脱落しない（大技を外すとダウンし、次に正しく動けた場面で起き上がる）。チーム戦・1対1では、倒れたら脱落
            const downLabel = script.mode === 'royale' ? tl('ダウン') : tl('脱落');
            it.stat.textContent = v.alive ? tl(`与ダメ{0}`, Math.round(dealt[v.f])) : downLabel;
            it.stat.title = v.alive || script.mode !== 'royale' ? '' : tl('ボスの大技を受けて倒れています。次に正しく動けた場面で起き上がります（脱落ではありません）');
            it.li.classList.toggle('dead', !v.alive);
            it.li.classList.toggle('mine', r.mine.has(v.f));
            if (r.mine.has(v.f))
                k -= 1000;
            it.li.classList.toggle('selected', r.selected === v.f);
            it.li.style.order = String(k);
        });
        // キルフィード
        const items = [];
        for (let i = Math.max(0, w - 2); i <= w; i++) {
            for (const e of script.waves[i].events) {
                if (e.type !== 'death' || (i === w && e.t > time - w))
                    continue;
                const victim = script.fighters[e.f].name;
                const text = e.cause === 'mp' ? tl(`{0} は行動力切れで倒れた`, victim) : tl(`{0} はボスの攻撃に倒れた`, victim);
                items.push(h('li', {}, text));
            }
        }
        feed.replaceChildren(...items.slice(-4));
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
}
function renderCard(card, s, f, isMine = false, onMine) {
    if (f === null) {
        card.replaceChildren(h('p', { class: 'muted' }, tl('キャラをクリックすると詳細が出ます')));
        return;
    }
    const fi = s.fighters[f];
    const st = s.standings.find((x) => x.f === f);
    card.replaceChildren(...nodes(h('div', { class: 'card-head' }, avatarCanvas(fi.loadout, 2), h('div', {}, h('strong', {}, fi.name), h('div', { class: 'muted small' }, tl(`ビルドコスト {0}/{1}`, fi.loadout.cost, COST_RULES.limit)))), fi.kodawari ? h('blockquote', { class: 'kodawari' }, fi.kodawari) : null, loadoutChips(fi.loadout), radar(fi.stats, 170), h('dl', { class: 'mini-stats' }, h('dt', {}, tl('正答率')), h('dd', {}, `${st.accuracy}%`), h('dt', {}, tl('平均トークン')), h('dd', {}, st.avgTokens.toLocaleString()), h('dt', {}, tl('平均応答')), h('dd', {}, fmtMs(st.avgLatencyMs))), h('div', { class: 'card-actions' }, onMine ? h('button', { class: 'btn btn-small' + (isMine ? ' on' : ''), onclick: onMine }, isMine ? tl('★ 自分のキャラ（解除）') : tl('☆ 自分のキャラにする')) : null, h('a', { href: `#/build/${encodeURIComponent(fi.id)}`, class: 'link' }, tl('ビルド詳細を見る →')))));
}
// その画面の「あなた」の冒険者（見出しを、あなたが引いた場面にするため）
const mineOf = (s) => s.fighters.map((f, i) => (mineIds.has(f.id) ? i : -1)).filter((i) => i >= 0);
function showResults(el, s, select) {
    const top = s.standings.slice(0, 3);
    const head = h('div', { class: 'podium' }, ...[1, 0, 2].map((k) => {
        const st = top[k];
        if (!st)
            return h('div', {});
        const fi = s.fighters[st.f];
        return h('div', { class: `podium-slot p${st.rank}` }, avatarCanvas(fi.loadout, 3), h('div', { class: 'podium-name' }, fi.name), h('div', { class: 'podium-block' }, `${st.rank}`));
    }));
    const rows = s.standings.map((st) => {
        const fi = s.fighters[st.f];
        return h('tr', { onclick: () => select(st.f) }, h('td', {}, st.rank), h('td', { class: 'name' }, fi.name), h('td', {}, `${st.accuracy}%`), h('td', {}, st.avgTokens.toLocaleString()), h('td', {}, fmtMs(st.avgLatencyMs)), h('td', {}, st.damageDealt), h('td', {}, st.mvp));
    });
    // 答え合わせ表: 参加者 × ウェーブの ○ / ×
    const mark = (f, i) => {
        for (const e of s.waves[i].events) {
            if (e.type === 'strike' && e.f === f)
                return e.success ? h('td', { class: 'mk ok', title: tl(`{0}点`, Math.round(e.score * 100)) }, '○') : h('td', { class: 'mk ng', title: tl(`{0}点`, Math.round(e.score * 100)) }, '×');
        }
        return h('td', { class: 'mk' }, '');
    };
    const sheet = h('details', { class: 'answer-sheet' }, h('summary', {}, tl('答え合わせ表（ウェーブごとの正誤）')), h('div', { class: 'table-wrap' }, h('table', { class: 'table compact sheet' }, h('thead', {}, h('tr', {}, h('th', {}, ''), ...s.waves.map((_, i) => h('th', { title: waveTitleFor(s.cases[s.waves[i].caseIndex], s.fighters, mineOf(s)) }, `${i + 1}`)))), h('tbody', {}, ...s.standings.map((st) => h('tr', {}, h('td', { class: 'name' }, s.fighters[st.f].name), ...s.waves.map((_, i) => mark(st.f, i))))))));
    el.replaceChildren(h('div', { class: 'results-inner' }, h('h2', {}, tl('討伐の戦果')), gmSays(h('p', {}, tl('{0}討伐から、みな戻ってきたぞ。今回の戦果1位は「{1}」だ。', s.boss.name, s.fighters[s.standings[0].f].name)), h('p', {}, h('a', { href: '#/ranking' }, tl('順位とわしの講評は、「戦果」で確かめるがよい。')))), head, h('table', { class: 'table compact' }, h('thead', {}, h('tr', {}, ...[tl('順位'), tl('名前'), tl('戦果（正答率）'), tl('燃費（平均トークン）'), tl('速さ（平均）'), tl('与ダメ'), 'MVP'].map((t) => h('th', {}, t)))), h('tbody', {}, ...rows)), sheet));
    el.classList.remove('hidden');
}
export { SCALE };
//# sourceMappingURL=arena.js.map