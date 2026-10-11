import { COST_RULES } from '../../shared/catalog.js';
// アリーナ（バトル再生）画面
import { ArenaRenderer, SCALE } from '../arena.js';
import { MODE_LABELS, waveTitleFor } from '../../shared/simulate.js';
import { caseTitleOf } from '../../shared/types.js';
import { POSITION_LABELS } from '../../shared/build.js';
import { pickParty } from '../../shared/party.js';
import { pickStage, restage, STAGE_ALL_MAX, STAGE_LABELS, STAGE_MAX } from '../../shared/stage.js';
import { getBattle, getMe, getSeason, scriptFor } from '../api.js';
import { avatarCanvas, fmtMs, h, loadoutChips, nodes, radar } from '../ui.js';
import { setSfx, sfxEnabled } from '../sfx.js';
import { tl } from '../../shared/i18n.js';
const KIND_LABEL = { normal: tl('通常'), trap: tl('ひっかけ'), bonus: tl('宝箱'), boss: tl('ボス') };
const WAVE_SECONDS = 6; // 1回の仕掛けにかける秒数（何が起きたか追えるよう、ゆっくり）
const MINE_KEY = 'ai-battle:mine';
// 自分のキャラ: ログイン中なら自分の提出、それ以外はこのブラウザで「自分のキャラ」に選んだもの
let mineIds = new Set();
let mineLabel = tl('あなた');
function loadPinned() {
    try {
        return JSON.parse(localStorage.getItem(MINE_KEY) || '[]');
    }
    catch {
        return [];
    }
}
function savePinned(ids) {
    try {
        localStorage.setItem(MINE_KEY, JSON.stringify(ids));
    }
    catch { /* 保存できない環境 */ }
}
let stopCurrent = null;
const MODE_DESC = {
    royale: tl('送り出された冒険者全員で、ボスに挑みます。ボスが仕掛けるたびに、正しく動けた冒険者はかわして反撃し、間違えた冒険者は攻撃を受けます（脱落はしません）。順位は戦果（正しく動けた割合）→ 燃費 → 速さで決まります。'),
    team: tl('ビルドの team（チーム）ごとに同じボスへ挑み、生き残った人数とボスへの与ダメージで競います。'),
    duel: tl('好きな2体で同じボスに挑み、どちらが長く立っていられるかを競います。')
};
// past: 過去のシーズンの討伐を再生するとき（focus の冒険者を「自分」と同じように目立たせる）
export async function renderArena(root, initialView, past) {
    getSeason().catch(() => null); // 課題ごとのコスト上限を読み込む（表示用）
    stopCurrent?.();
    root.replaceChildren(h('p', { class: 'loading' }, tl('読み込み中…')));
    const data = await getBattle(past?.season);
    const me = await getMe().catch(() => null);
    mineLabel = past ? tl('注目') : tl('あなた');
    root.classList.toggle('arena-past-focus', !!past); // 名簿の札も「あなた」ではなく「注目」にする
    mineIds = past ? new Set(past.focus ? [past.focus] : []) : new Set([...data.entrants.filter((e) => me && e.owner === me.name).map((e) => e.id), ...loadPinned()]);
    // 過去のシーズンのときは、どのシーズンの再生かを上に出す
    const pastBar = data.past ? h('div', { class: 'past-replay-bar' }, h('span', {}, h('b', {}, tl(`過去のシーズンの再生: {0}「{1}」`, data.past.label, data.task.title)), past?.focus ? h('span', { class: 'small muted' }, tl(`　{0} を中心に表示`, data.entrants.find((e) => e.id === past.focus)?.name ?? '')) : null), h('a', { class: 'btn btn-small', href: '#/ranking' }, tl('戦果（順位表）へ戻る'))) : null;
    if (data.entrants.length < 2) {
        root.replaceChildren(...nodes(pastBar), h('div', { class: 'empty' }, h('h2', {}, tl('まだバトルがありません')), h('p', {}, tl('採点が終わった提出が2件以上そろうと、ここでバトルが始まります。')), h('a', { href: '#/make', class: 'btn' }, tl('キャラをつくる'))));
        return;
    }
    let mode = 'royale';
    // 討伐隊: あなた＋同じチームの人＋順位の近い人で最大12人（順位はシーズンの参加者全員で決まる）
    const party = { ...data, entrants: pickParty(data.entrants, data.cases, mineIds) };
    const partyOnly = party.entrants.length < data.entrants.length;
    const royale = scriptFor(party, 'royale');
    const crowded = royale.fighters.length > STAGE_MAX;
    const hasMine = royale.fighters.some((f) => mineIds.has(f.id));
    // 初期の視点: 指定があればそれ、人が多くて自分がいれば「自分と周辺」、それ以外は「決勝」
    let view = initialView ?? (crowded && hasMine ? 'me' : 'finals');
    const viewTabs = Object.keys(STAGE_LABELS).map((v) => h('button', { class: 'tab', 'data-view': v, onclick: () => { view = v; refresh(); } }, STAGE_LABELS[v]));
    const viewBar = h('div', { class: 'tabs view-tabs', role: 'tablist', 'aria-label': tl('視点') }, h('span', { class: 'muted small view-label' }, tl('視点')), ...viewTabs);
    let pick = [royale.fighters[royale.standings[0].f].id, royale.fighters[royale.standings[1].f].id];
    const host = h('div');
    const tabs = Object.keys(MODE_LABELS).map((m) => h('button', { class: 'tab', role: 'tab', 'data-mode': m, onclick: () => { mode = m; refresh(); } }, MODE_LABELS[m]));
    const opt = (sel) => data.entrants.map((e) => h('option', { value: e.id, selected: e.id === sel }, e.name));
    const selA = h('select', { id: 'duel-a', 'aria-label': tl('1体目') }, ...opt(pick[0]));
    const selB = h('select', { id: 'duel-b', 'aria-label': tl('2体目') }, ...opt(pick[1]));
    const duelBox = h('div', { class: 'duel-pick' }, selA, h('span', { class: 'vs' }, 'VS'), selB);
    const desc = h('p', { class: 'mode-desc small muted' });
    const stageNote = h('p', { class: 'small muted stage-note' });
    const onPick = () => { pick = [selA.value, selB.value]; refresh(); };
    selA.onchange = onPick;
    selB.onchange = onPick;
    const refresh = () => {
        tabs.forEach((t) => { t.classList.toggle('on', t.dataset.mode === mode); t.setAttribute('aria-selected', String(t.dataset.mode === mode)); });
        duelBox.hidden = mode !== 'duel';
        viewBar.hidden = !(mode === 'royale' && crowded);
        viewTabs.forEach((t) => {
            const v = t.dataset.view;
            t.classList.toggle('on', v === view);
            t.disabled = (v === 'all' && royale.fighters.length > STAGE_ALL_MAX) || (v === 'me' && !hasMine);
        });
        desc.textContent = MODE_DESC[mode];
        stopCurrent?.();
        const sc = scriptFor(mode === 'royale' ? party : data, mode, pick, mineIds); // 連携詠唱の結果は、見ている人（あなた）が唱えられたかで変わる
        if (!sc) {
            host.replaceChildren(h('div', { class: 'empty' }, h('p', {}, tl('別々の2体を選んでください。'))));
            return;
        }
        const mineIdx = sc.fighters.map((f, i) => (mineIds.has(f.id) ? i : -1)).filter((i) => i >= 0);
        const staged = mode === 'royale' ? restage(sc, pickStage(sc, mineIdx, view)) : sc;
        const off = staged.fighters.filter((f) => f.off).length;
        stageNote.textContent = off ? tl(`舞台に立つのは {0} 人（残り {1} 人は画面下の「控え」。順位は全員で決まります）`, staged.fighters.length - off, off)
            : partyOnly ? tl('討伐隊は、あなた・同じチームの人・順位の近い人の{0}人です（順位はシーズンの参加者全員で決まります）。', sc.fighters.length) : '';
        stopCurrent = mountPlayer(host, staged);
    };
    // チーム戦・1対1はいったん出さない（討伐だけ）
    root.replaceChildren(...nodes(pastBar), h('div', { class: 'mode-bar' }, viewBar), desc, stageNote, host);
    refresh();
}
function mountPlayer(root, script) {
    const canvas = h('canvas', { class: 'arena-canvas pixel', 'aria-label': tl('討伐の再生画面') });
    const r = new ArenaRenderer(canvas, script);
    r.mineLabel = mineLabel;
    window.__arena = r; // 動作確認・録画用
    const total = r.totalTime;
    const waves = r.totalWaves;
    let time = 0, playing = true, speed = 1, last = performance.now(), raf = 0, ended = false, slowOn = true;
    const syncMine = () => { r.mine = new Set(script.fighters.map((f, i) => (mineIds.has(f.id) ? i : -1)).filter((i) => i >= 0)); };
    syncMine();
    const waveLabel = h('span', { class: 'hud-wave' });
    const kindBadge = h('span', { class: 'badge' });
    const caseTitle = h('span', { class: 'hud-case' });
    const aliveLabel = h('span', { class: 'hud-alive' });
    const banner = h('div', { class: 'banner' });
    const feed = h('ul', { class: 'killfeed', 'aria-live': 'polite' });
    const playBtn = h('button', { class: 'btn btn-icon', title: tl('再生 / 一時停止'), 'aria-label': tl('再生 / 一時停止') }, '❚❚');
    const seek = h('input', { type: 'range', min: 0, max: total, step: 0.01, value: 0, 'aria-label': tl('シーク') });
    const speeds = [1, 2, 4].map((s) => h('button', { class: 'btn btn-speed' + (s === 1 ? ' on' : ''), 'data-speed': s }, `${s}x`));
    const roster = h('ol', { class: 'roster-list' });
    const card = h('div', { class: 'fighter-card' }, h('p', { class: 'muted' }, tl('キャラをクリックすると詳細が出ます')));
    const results = h('div', { class: 'results hidden' });
    const slowBtn = h('button', { class: 'btn btn-speed on', title: tl('注目キャラの技をスローで見せる'), 'aria-pressed': 'true' }, tl('スロー演出'));
    // 効果音（初期は消音。押すと鳴る。設定はブラウザに覚える）
    const sndBtn = h('button', { class: 'btn btn-speed' + (sfxEnabled() ? ' on' : ''), title: tl('効果音'), 'aria-pressed': String(sfxEnabled()) }, sfxEnabled() ? tl('♪ 音あり') : tl('♪ 音なし'));
    sndBtn.onclick = () => { const on = !sfxEnabled(); setSfx(on); sndBtn.classList.toggle('on', on); sndBtn.setAttribute('aria-pressed', String(on)); sndBtn.textContent = on ? tl('♪ 音あり') : tl('♪ 音なし'); };
    slowBtn.onclick = () => { slowOn = !slowOn; slowBtn.classList.toggle('on', slowOn); slowBtn.setAttribute('aria-pressed', String(slowOn)); };
    root.replaceChildren(h('div', { class: 'arena-page' }, h('section', { class: 'stage' }, h('div', { class: 'hud-top' }, waveLabel, kindBadge, caseTitle, aliveLabel), h('div', { class: 'canvas-wrap' }, canvas, banner, feed, results), h('div', { class: 'controls' }, h('button', { class: 'btn btn-icon', title: tl('最初から'), 'aria-label': tl('最初から'), onclick: () => { time = 0; ended = false; results.classList.add('hidden'); playing = true; } }, '⏮'), playBtn, seek, ...speeds, slowBtn, sndBtn, h('button', { class: 'btn btn-icon', title: tl('結果へ'), 'aria-label': tl('結果へ'), onclick: () => { time = total; } }, '⏭'))), h('aside', { class: 'side' }, h('h3', {}, tl('参加者')), roster, card)));
    playBtn.onclick = () => { playing = !playing; if (ended) {
        time = 0;
        ended = false;
        results.classList.add('hidden');
        playing = true;
    } };
    seek.oninput = () => { time = Number(seek.value); ended = false; results.classList.add('hidden'); };
    speeds.forEach((b) => (b.onclick = () => { speed = Number(b.dataset.speed); speeds.forEach((x) => x.classList.toggle('on', x === b)); }));
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
        renderCard(card, script, f, mineIds.has(id), () => toggleMine(f));
    };
    const select = (f) => {
        r.selected = f;
        renderCard(card, script, f, f !== null && mineIds.has(script.fighters[f].id), () => f !== null && toggleMine(f));
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
        // ウェーブごとの正誤（○＝正解、×＝不正解、—＝パス、MP＝MP切れ）
        const strip = h('span', { class: 'wave-strip', 'aria-label': tl('ウェーブごとの正誤') }, ...script.waves.map(() => h('i', { class: 'wv' })));
        const li = h('li', { class: 'roster-item', tabindex: 0, style: script.mode === 'team' ? { boxShadow: `inset 3px 0 0 ${script.teams[f.team].color}` } : undefined, onclick: () => select(i), onkeydown: (e) => { if (e.key === 'Enter')
                select(i); } }, avatarCanvas(f.loadout, 1), h('span', { class: 'roster-name' }, f.name, h('span', { class: `persona-tag pos-${f.row}` }, POSITION_LABELS[f.row])), hp, stat, strip);
        return { li, hp, stat, strip };
    });
    roster.append(...rosterItems.map((x) => x.li));
    let lastDom = 0, lastWave = -1;
    const loop = (now) => {
        if (!canvas.isConnected)
            return; // 別の画面へ移動したら止める
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        if (playing && !ended) {
            time += (dt / WAVE_SECONDS) * speed * (slowOn ? r.slowFactor(time) : 1);
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
        if (!Number.isFinite(time) || time < 0)
            time = 0;
        const w = Math.min(Math.floor(time), waves - 1);
        const wv = script.waves[w];
        if (!wv)
            return;
        const cm = script.cases[wv.caseIndex];
        const suddenFrom = script.waves.findIndex((x) => x.sudden);
        const normalWaves = suddenFrom >= 0 ? suddenFrom : waves;
        waveLabel.textContent = wv.sudden ? tl(`サドンデス {0}`, w - suddenFrom + 1) : `WAVE ${w + 1}/${normalWaves}`;
        kindBadge.textContent = KIND_LABEL[cm.kind];
        kindBadge.className = `badge badge-${cm.kind}`;
        caseTitle.textContent = r.caseTitle(cm); // 抽選で変わる場面は、あなたの冒険者が引いた見出し
        playBtn.textContent = playing && !ended ? '❚❚' : '▶';
        seek.value = String(time);
        const views = r.state(Math.min(time, waves - 0.0001));
        aliveLabel.textContent = script.mode === 'team'
            ? script.teams.map((t, ti) => `${t.name} ${views.filter((v) => v.alive && script.fighters[v.f].team === ti).length}`).join(' / ')
            : script.mode === 'royale' ? tl(`討伐隊 {0}人`, views.length) : tl(`生存 {0}/{1}`, views.filter((v) => v.alive).length, views.length);
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
                    cell.title = tl(`W{0} {1}: MP切れ`, i + 1, t2);
                }
            }
        });
        const order = views.slice().sort((a, b) => Number(b.alive) - Number(a.alive) || b.hp - a.hp || a.f - b.f);
        order.forEach((v, k0) => {
            let k = k0;
            const it = rosterItems[v.f];
            it.hp.firstChild.style.width = `${v.hp}%`;
            it.hp.className = 'hpbar' + (v.hp < 25 ? ' low' : v.hp < 50 ? ' mid' : '');
            it.stat.textContent = v.alive ? tl(`与ダメ{0}`, Math.round(dealt[v.f])) : tl('脱落');
            it.li.classList.toggle('dead', !v.alive);
            it.li.classList.toggle('mine', r.mine.has(v.f));
            if (r.mine.has(v.f))
                k -= 1000;
            it.li.classList.toggle('selected', r.selected === v.f);
            it.li.style.order = String(k);
        });
        // バナーとキルフィード
        if (w !== lastWave) {
            lastWave = w;
            const storm = wv.events.some((e) => e.type === 'storm');
            const prevStorm = w > 0 && script.waves[w - 1].events.some((e) => e.type === 'storm');
            const big = wv.events.some((e) => e.type === 'final' || e.type === 'sudden');
            if (big) { /* 決勝・サドンデスはキャンバス側で大きく出す */ }
            else if (storm && !prevStorm)
                flash(banner, tl('ボスが怒った！ 燃費の悪いキャラは余波で削られる'), 'storm');
        }
        const items = [];
        for (let i = Math.max(0, w - 2); i <= w; i++) {
            for (const e of script.waves[i].events) {
                if (e.type !== 'death' || (i === w && e.t > time - w))
                    continue;
                const victim = script.fighters[e.f].name;
                const text = e.cause === 'storm' ? tl(`{0} はボスの怒りに倒れた`, victim) : e.cause === 'mp' ? tl(`{0} はMP切れで倒れた`, victim) : tl(`{0} はボスの攻撃に倒れた`, victim);
                items.push(h('li', {}, text));
            }
        }
        feed.replaceChildren(...items.slice(-4));
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
}
function flash(el, text, kind) {
    el.textContent = text;
    el.className = `banner show banner-${kind}`;
    setTimeout(() => { el.className = 'banner'; }, 1600);
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
    let head;
    if (s.mode === 'duel') {
        const win = s.standings[0], lose = s.standings[1];
        head = h('div', { class: 'duel-result' }, h('div', { class: 'duel-side win' }, avatarCanvas(s.fighters[win.f].loadout, 4), h('div', { class: 'podium-name' }, s.fighters[win.f].name), h('div', { class: 'win-label' }, 'WIN')), h('div', { class: 'vs' }, 'VS'), h('div', { class: 'duel-side' }, avatarCanvas(s.fighters[lose.f].loadout, 4), h('div', { class: 'podium-name' }, s.fighters[lose.f].name), h('div', { class: 'lose-label' }, lose.alive ? tl('判定負け') : 'KO')));
    }
    else if (s.mode === 'team') {
        head = h('div', { class: 'team-result' }, ...s.teamStandings.map((t) => h('div', { class: 'team-row', style: { borderLeftColor: s.teams[t.team].color } }, h('span', { class: 'team-rank' }, t.rank === 1 ? 'WIN' : tl(`{0}位`, t.rank)), h('span', { class: 'team-name' }, s.teams[t.team].name), h('span', { class: 'muted small' }, tl(`生存 {0}/{1}　ボスへの与ダメージ {2}`, t.alive, t.members, t.damage)))));
    }
    else {
        const top = s.standings.slice(0, 3);
        head = h('div', { class: 'podium' }, ...[1, 0, 2].map((k) => {
            const st = top[k];
            if (!st)
                return h('div', {});
            const fi = s.fighters[st.f];
            return h('div', { class: `podium-slot p${st.rank}` }, avatarCanvas(fi.loadout, 3), h('div', { class: 'podium-name' }, fi.name), h('div', { class: 'podium-block' }, `${st.rank}`));
        }));
    }
    const raid = s.mode === 'royale';
    const rows = s.standings.map((st) => {
        const fi = s.fighters[st.f];
        return h('tr', { onclick: () => select(st.f) }, h('td', {}, st.rank), h('td', { class: 'name' }, s.mode === 'team' ? h('span', { class: 'team-dot', style: { background: s.teams[fi.team].color } }) : null, fi.name), ...(raid
            ? [h('td', {}, `${st.accuracy}%`), h('td', {}, st.avgTokens.toLocaleString()), h('td', {}, fmtMs(st.avgLatencyMs)), h('td', {}, st.damageDealt), h('td', {}, st.mvp)]
            : [h('td', {}, st.alive ? tl('生存') : `W${st.survivalWaves}`), h('td', {}, POSITION_LABELS[fi.row]), h('td', {}, st.damageDealt), h('td', {}, st.evades), h('td', {}, st.mvp), h('td', {}, `${st.accuracy}%`)]));
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
    el.replaceChildren(h('div', { class: 'results-inner' }, h('h2', {}, s.mode === 'duel' ? tl('決着') : s.mode === 'team' ? tl('チーム戦 結果') : tl('討伐の戦果')), head, h('table', { class: 'table compact' }, h('thead', {}, h('tr', {}, ...(raid ? [tl('順位'), tl('名前'), tl('戦果（正答率）'), tl('燃費（平均トークン）'), tl('速さ（平均）'), tl('与ダメ'), 'MVP'] : [tl('順位'), tl('名前'), tl('生存'), tl('隊列'), tl('与ダメ'), tl('回避'), 'MVP', tl('正答率')]).map((t) => h('th', {}, t)))), h('tbody', {}, ...rows)), sheet));
    el.classList.remove('hidden');
}
export { SCALE };
//# sourceMappingURL=arena.js.map