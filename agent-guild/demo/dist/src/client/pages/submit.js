// 提出画面: 画面でポチポチ組み立てるビルダー（YAML は上級者向けの読み書きだけ）
import { BODY_LABELS, BODY_TYPES, BUILD_TEMPLATE, CHARM_KINDS, CHARM_LABELS, FAMILIAR_KINDS, FAMILIAR_LABELS, POSITIONS, POSITION_LABELS, POSITION_NOTES, DEFAULT_CHARM_COLORS, DEFAULT_FAMILIAR_COLORS, LEGACY_MAIN_PROMPTS, MAIN_PROMPT_TEMPLATE, COMPANION_PROMPT_TEMPLATE, MAIN_COMPANION_SNIPPET, backWeapons, buildToYaml, computeCost, estimateSubmitCost, estimateTokens, mainWeight, parseBuild, skillWeight, skillLook, toLoadout, CAT_PATTERNS, CAT_PATTERN_LABELS } from '../../shared/build.js';
import { apLevel, COST_RULES, toolAp, WEAPON_KINDS, WEAPON_LABELS } from '../../shared/catalog.js';
import { MP_BUDGET_PER_CASE } from '../../shared/stats.js';
import { accountBar, entryCard, loginForm, SWAY_NOTE } from '../account.js';
import { sceneMp, traceView } from '../trace.js';
import { accuracyDeltas, diffParts, sparkline } from '../history.js';
import { demoMode, getMe, getSeason, mySubmissions, runTrial, submitBuild } from '../api.js';
import { charmSprite, drawHero, familiarSprite, gearOf, lookOf, portrait, PORTRAIT_H, PORTRAIT_W, weaponSprite } from '../hero.js';
import { BODY_STYLE, STYLE_LABEL } from '../fx.js';
import { h, nodes, toast } from '../ui.js';
import { parseYaml, toYaml } from '../../shared/yaml.js';
import { briefingOf, library } from '../briefing.js';
import { getLang, localeOf, tl } from '../../shared/i18n.js';
import { anonGet, clearAnon, currentUser, setUser, userGet, userRemove, userSet } from '../userStore.js';
// 下書きは、ユーザーごと・言語ごとに分けて保存する（userStore.ts。共用の端末で、前の人の準備が次の人に見えないように）。
// 言語ごとに分けるのは、日本語で開いたときの下書きが、ほかの言語の初期値に残らないようにするため
const draftKey = () => `draft:${getLang()}`;
let stop = null;
function loadDraft() {
    return userGet(draftKey()) || BUILD_TEMPLATE;
}
// 未ログインのときは、テンプレートのままなら残さない（ログインしたときに、書いていない下書きで本人の下書きを上書きしないように）
function saveDraft(v, catalog) {
    if (!currentUser() && v === templateYaml(catalog))
        userRemove(draftKey());
    else
        userSet(draftKey(), v);
}
const templateYaml = (catalog) => buildToYaml(parseBuild(BUILD_TEMPLATE, catalog).build);
// 準備の画面で出す、直すところの案内。検証の文言は YAML の項目名（name・content など）で書かれているので、画面の言葉に言い直す
// （YAML で読み書きするときは、項目名のままの文言を出す）
function formIssue(e, b, scrollWord, cost) {
    const m = /^skills\[(\d+)\]\.(name|content)$/.exec(e.path);
    if (m) {
        const i = Number(m[1]);
        const nm = b.skills[i]?.name?.trim();
        if (m[2] === 'content')
            return scrollWord ? tl('巻物「{0}」の中身を書いてください', nm || tl('（名前なし）')) : tl('スキル「{0}」の中身を書いてください', nm || tl('（名前なし）'));
        if (!nm)
            return scrollWord ? tl('{0}つ目の巻物の名前を書いてください', i + 1) : tl('{0}つ目のスキルの名前を書いてください', i + 1);
        return scrollWord ? tl('巻物の名前「{0}」が重なっています。別の名前にしてください', nm) : tl('スキルの名前「{0}」が重なっています。別の名前にしてください', nm);
    }
    if (e.path === 'name')
        return b.name.trim() ? tl('冒険者の名前は16文字までです') : tl('冒険者の名前を書いてください');
    if (e.path === 'main.prompt')
        return b.main.prompt.trim() ? tl('心得は{0}字までです（いま{1}字）', COST_RULES.mainMaxChars, [...b.main.prompt].length) : tl('心得を書いてください');
    if (e.path === 'kodawari')
        return tl('こだわりは150文字までです');
    if (e.path === '' && cost.over && !e.line)
        return tl('荷物が重すぎます（{0} / {1}）。何かを置いていきましょう', cost.total, cost.limit);
    return e.message.replace(/^\d+行目: /, '');
}
// 編集中のビルド（途中で空欄があっても持てるよう、検証前の形で持つ）
function initialBuild(catalog) {
    for (const y of [withPromptTemplate(loadDraft()), BUILD_TEMPLATE]) {
        const r = parseBuild(y, catalog);
        const b = r.build;
        if (b) {
            if (LEGACY_MAIN_PROMPTS.some((x) => x.trim() === b.main.prompt.trim()))
                b.main.prompt = MAIN_PROMPT_TEMPLATE;
            return b;
        }
    }
    throw new Error(tl('テンプレートが読めません'));
}
// 下書きの心得が空なら、書き方の型（テンプレート）を入れておく
function withPromptTemplate(y) {
    try {
        const v = parseYaml(y);
        if (!v || typeof v !== 'object' || Array.isArray(v))
            return y;
        const p = v.main?.prompt;
        if (typeof p === 'string' && p.trim())
            return y;
        v.main = { ...(v.main ?? {}), prompt: MAIN_PROMPT_TEMPLATE };
        return toYaml(v);
    }
    catch {
        return y;
    }
}
const spriteImg = (c, scale = 3) => {
    const x = h('canvas', { class: 'pixel look-sprite', width: c.width * scale, height: c.height * scale });
    const g = x.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(c, 0, 0, x.width, x.height);
    return x;
};
export async function renderSubmit(root) {
    stop?.();
    root.replaceChildren(h('p', { class: 'loading' }, tl('読み込み中…')));
    const season = await getSeason();
    const catalog = season.catalog;
    const toolById = Object.fromEntries(catalog.map((t) => [t.id, t]));
    let me = await getMe().catch(() => null);
    setUser(me?.name ?? null);
    if (me)
        clearAnon(); // ログイン中は、未ログインのときにこのタブで書いた下書きを使わない
    let b = initialBuild(catalog);
    // --- 右側: プレビューとコスト ---
    const preview = h('canvas', { class: 'preview pixel', width: PORTRAIT_W * 2, height: PORTRAIT_H * 2, 'aria-label': tl('キャラのプレビュー') });
    const actionLabel = h('div', { class: 'preview-action small muted' });
    const nameLabel = h('div', { class: 'preview-name' });
    const legend = h('ul', { class: 'legend' });
    const meterFill = h('div', { class: 'meter-fill' });
    const meterText = h('div', { class: 'meter-text' });
    const breakdown = h('ul', { class: 'breakdown' });
    // 重さの内訳（心得・巻物・道具・結界）。重さバーにカーソルを当てる・フォーカスすると出る。スマホはタップで開くパネルの先頭に出す
    const kindSum = h('ul', { class: 'kind-sum' });
    const meterTip = h('div', { class: 'meter-tip', role: 'tooltip', id: 'meter-tip' });
    const errorsEl = h('ul', { class: 'errors', 'aria-live': 'polite' });
    const submitBtn = h('button', { class: 'btn btn-primary' }, tl('この冒険者を送り出す'));
    const accountEl = h('div', { class: 'account' });
    const subsEl = h('div', { class: 'subs' });
    const runCostEl = h('p', { class: 'small muted run-cost' });
    const trialBtn = h('button', { class: 'btn btn-trial' }, tl('試走する（例の場面で試す）'));
    const trialEl = h('div', { class: 'trial-result', 'aria-live': 'polite' });
    const confirmEl = h('div', { class: 'confirm-box' });
    // 画面上部に固定する「出発の準備」バー。内訳・試走の結果・送り出しの確認は、バーの下に開くパネルに出す
    const miniPreview = h('canvas', { class: 'dock-avatar pixel', width: PORTRAIT_W, height: PORTRAIT_H });
    const dockName = h('b', { class: 'dock-name' });
    const dockErr = h('span', { class: 'dock-err small' });
    const dockMe = h('span', { class: 'dock-me small muted' });
    const dockBody = h('div', { class: 'dock-body' });
    const dockPanel = h('div', { class: 'dock-panel', hidden: true });
    const hideDock = () => { dockPanel.hidden = true; dockPanel.classList.remove('collapsed'); dockBody.replaceChildren(); };
    // collapsible: 閉じずに折りたためる（たたんでも見出しは残り、すぐ開き直せる）
    const showDock = (title, ...els) => showDockOpt({}, title, ...els);
    const showDockOpt = (opt, title, ...els) => {
        dockPanel.classList.remove('collapsed');
        const fold = opt.collapsible ? h('button', { class: 'btn btn-small dock-fold', 'aria-expanded': 'true' }, tl('たたむ')) : null;
        if (fold)
            fold.onclick = () => {
                const c = dockPanel.classList.toggle('collapsed');
                fold.textContent = c ? tl('開く') : tl('たたむ');
                fold.setAttribute('aria-expanded', String(!c));
            };
        dockBody.replaceChildren(h('div', { class: 'row-between dock-head' }, h('h4', {}, title), h('div', { class: 'row-gap' }, fold, h('button', { class: 'btn btn-small', onclick: hideDock }, tl('閉じる')))), ...els.filter((x) => !!x));
        dockPanel.hidden = false;
    };
    dockPanel.append(dockBody);
    // --- 左側: フォーム ---
    const form = h('div', { class: 'builder' });
    const yamlBox = h('textarea', { class: 'editor', spellcheck: 'false', wrap: 'off', 'aria-label': tl('ビルド（YAML）') });
    const yamlErr = h('p', { class: 'errors small' });
    let valid = false;
    // 追加したばかりで、まだ中身を書いていない巻物（追加した直後に「中身を書いてください」と出さないため）。
    // 試走・送り出しを押したら（attempted）、ほかの直すところと同じように出す
    const fresh = new WeakSet();
    let attempted = false;
    let emptyHints = [];
    let issues = [];
    // 値だけが変わったとき（入力中）: フォームは作り直さず、コスト・プレビュー・YAML だけ更新
    // 道具のチェックの表示を、持ち物のデータ（b.tools）にそろえる（スクリプトなどで表示だけが変わっても、次の更新で正しく戻る）
    const syncToolChecks = () => {
        form.querySelectorAll('input[data-tool]').forEach((cb) => {
            const on = b.tools.includes(cb.dataset.tool);
            if (cb.checked !== on)
                cb.checked = on;
            cb.disabled = !on && b.tools.length >= COST_RULES.maxTools;
            const card = cb.closest('.tool-card');
            card?.classList.toggle('on', on);
            card?.classList.toggle('full', cb.disabled);
        });
    };
    const refresh = () => {
        syncToolChecks();
        const yaml = buildToYaml(b);
        saveDraft(yaml, catalog);
        if (document.activeElement !== yamlBox)
            yamlBox.value = yaml;
        const cost = computeCost(b, catalog);
        const r = parseBuild(yaml, catalog);
        valid = !!r.build;
        const hasScrolls = !!season.task.scrolls?.length;
        issues = r.errors
            .filter((e) => { const m = /^skills\[(\d+)\]\.content$/.exec(e.path); return attempted || !m || !fresh.has(b.skills[Number(m[1])]); })
            .map((e) => formIssue(e, b, hasScrolls, cost));
        errorsEl.replaceChildren(...issues.map((x) => h('li', {}, x)));
        emptyHints.forEach((x, i) => { x.hidden = !!b.skills[i]?.content.trim(); });
        meterFill.style.width = `${Math.min(100, (cost.total / cost.limit) * 100)}%`;
        meterFill.classList.toggle('over', cost.over);
        meterText.textContent = `${cost.total} / ${cost.limit}`;
        const KINDS = [['main', tl('心得')], ['skill', tl('巻物')], ['tool', tl('道具')], ['guard', tl('結界')], ...(b.companion ? [['companion', tl('お供')]] : [])];
        const sums = KINDS.map(([k, label]) => ({ k, label, n: cost.items.filter((x) => x.kind === k).length, w: cost.items.filter((x) => x.kind === k).reduce((a, x) => a + x.cost, 0) }));
        const sumRows = () => sums.map((x) => h('li', { class: `ks-${x.k}` }, h('span', {}, x.label, x.k !== 'main' ? h('span', { class: 'muted small' }, tl(` ×{0}`, x.n)) : null), h('b', {}, x.w)));
        kindSum.replaceChildren(...sumRows());
        meterTip.replaceChildren(h('div', { class: 'small muted' }, tl('荷物の重さの内訳')), h('ul', { class: 'kind-sum' }, ...sumRows()), h('div', { class: 'small muted' }, tl(`合計 {0} / {1}`, cost.total, cost.limit)));
        breakdown.replaceChildren(...cost.items.map((it) => h('li', { class: `bd-${it.kind}` }, h('span', {}, it.label), h('span', { class: 'muted small' }, it.note ?? ''), h('b', {}, it.cost))));
        nameLabel.textContent = b.name || tl('（名前未設定）');
        dockName.textContent = b.name || tl('（名前未設定）');
        dockErr.textContent = issues.length ? `⚠ ${issues[0]}${issues.length > 1 ? tl(` ほか{0}件`, issues.length - 1) : ''}` : '';
        dockMe.textContent = demoMode ? tl('デモ版（送り出しはできません）') : !me ? tl('未ログイン') : !me.entered ? tl('エントリー前') : tl(`{0} さん・今日の残り: 送り出し{1}回・試走{2}回`, me.name, me.remainingToday, me.trialsLeft);
        const lo = toLoadout(b, catalog);
        legend.replaceChildren(h('li', {}, h('b', {}, tl('手の武器')), tl(` {0}（{1}）`, WEAPON_LABELS[lo.weapon], b.avatar.weapon === 'auto' ? (b.tools.length ? tl('最も高いツール') : tl('ツールなし')) : tl('指定'))), h('li', {}, h('b', {}, tl('背中')), ` ${backWeapons(lo).map((w) => WEAPON_LABELS[w]).join(tl('・')) || tl('なし')}`), h('li', {}, h('b', {}, tl('技の系統')), tl(` {0}（体型で決まる）`, STYLE_LABEL[BODY_STYLE[b.avatar.body]])));
        // 直すところがあっても押せる（押すと、直すところを一覧で出す）
        const ready = !demoMode && !!me && me.entered;
        submitBtn.disabled = demoMode || (ready && me.remainingToday <= 0);
        trialBtn.disabled = demoMode || (ready && me.trialsLeft <= 0);
        const est = estimateSubmitCost(b, season.task.caseCount);
        const yen = (u) => Math.max(1, Math.round(u * 150));
        runCostEl.textContent = tl(`1回の送り出しの費用の目安: 約{0}〜{1}円（道具を必要なときだけ使うか、毎回使うかで変わります）`, yen(est.low), yen(est.high));
    };
    // トークン数と、それが重さにどう効くか（心得: トークン数で決まる / 巻物: 1つの重さ＋超えた分の加算）
    const tokenNote = (text, kind) => {
        const t = estimateTokens(text);
        if (kind === 'main') {
            const capped = mainWeight(t) >= R.mainMaxPoints ? tl('（上限）') : '';
            return tl(`約{0}トークン → 重さ {1}{2}（{3}トークンごとに1）`, t.toLocaleString(), mainWeight(t), capped, R.mainTokensPerPoint);
        }
        const w = skillWeight(t);
        return w.extra
            ? tl(`約{0}トークン → 重さ {1}（巻物1つ {2}＋{3}トークンを超えた分 {4}）`, t.toLocaleString(), w.total, w.base, R.skillFreeTokens.toLocaleString(), w.extra)
            : tl(`約{0}トークン → 重さ {1}（{2}トークンまでは巻物1つの重さのまま）`, t.toLocaleString(), w.total, R.skillFreeTokens.toLocaleString());
    };
    const field = (label, input, note) => h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), input, note ? (typeof note === 'string' ? h('span', { class: 'field-note' }, note) : note) : null);
    const text = (value, on, opts = {}) => {
        const el = h('input', { value, placeholder: opts.placeholder ?? '', maxlength: opts.maxlength ?? 200 });
        el.oninput = () => { on(el.value); refresh(); };
        return el;
    };
    const area = (value, on, opts) => {
        const noteText = (v) => opts.maxChars ? tl(`{0} / {1}字・{2}`, [...v].length, opts.maxChars, tokenNote(v, opts.kind)) : tokenNote(v, opts.kind);
        const note = h('span', { class: 'field-note' }, noteText(value));
        const mark = (v) => note.classList.toggle('over', !!opts.maxChars && [...v].length > opts.maxChars);
        mark(value);
        const el = h('textarea', { class: 'prompt-box', rows: opts.rows ?? 5, placeholder: opts.placeholder ?? '', spellcheck: 'false' });
        el.value = value;
        el.oninput = () => { on(el.value); note.textContent = noteText(el.value); mark(el.value); refresh(); };
        return { el, note };
    };
    const lookPicker = (kinds, labels, cur, sprite, on, scale = 3) => {
        const img = h('span', { class: 'look-img' }, spriteImg(sprite(cur.kind, cur.color), scale));
        const sel = h('select', { 'aria-label': tl('見た目の種類') }, ...kinds.map((k) => h('option', { value: k, selected: k === cur.kind }, labels[k])));
        const col = h('input', { type: 'color', value: cur.color || '#cccccc', 'aria-label': tl('色') });
        const apply = () => { on(sel.value, col.value); img.replaceChildren(spriteImg(sprite(sel.value, col.value), scale)); refresh(); };
        sel.onchange = apply;
        col.oninput = apply;
        return h('div', { class: 'look-row' }, img, sel, col);
    };
    const R = COST_RULES;
    const brief = briefingOf(season);
    // 道具と巻物の並びは、開くたびにばらばらにする（並び順で正解が分からないように）
    const shuffled = (xs) => xs.map((x) => ({ x, k: Math.random() })).sort((p, q) => p.k - q.k).map((p) => p.x);
    const toolOrder = shuffled(catalog);
    const scrollOrder = shuffled(season.task.scrolls ?? []);
    const renderForm = () => {
        const lo = toLoadout(b, catalog);
        // 1. 基本
        const basics = h('section', { class: 'card' }, h('h3', {}, tl('1. 冒険者')), h('div', { class: 'hero-row' }, h('div', {}, field(tl('名前'), text(b.name, (v) => { b.name = v; }, { maxlength: 16, placeholder: tl('16文字まで') })), field(tl('こだわり（討伐の画面に出る一言・任意）'), text(b.kodawari, (v) => { b.kodawari = v; }, { maxlength: 150, placeholder: tl('例: 必要なものだけを持たせた') }))), h('div', {}, h('div', { class: 'preview-box' }, preview, nameLabel, actionLabel), legend)));
        // 2. メインプロンプト
        const main = area(b.main.prompt, (v) => { b.main.prompt = v; }, { rows: 13, kind: 'main', maxChars: R.mainMaxChars || undefined, placeholder: tl('冒険者に毎回伝えておきたいことを書きます。ここがいちばん差がつくところです。') });
        // 書き方のコツ（折りたたみ）: 一般的なシステムプロンプトの組み立て方を、この順に
        const tips = h('details', { class: 'prompt-tips' }, h('summary', {}, tl('心得の書き方のコツ')), h('ol', { class: 'small' }, h('li', {}, h('b', {}, tl('役割を最初に')), tl('：だれとして、何のために戦うのかを1行で。')), h('li', {}, h('b', {}, tl('ふるまい')), tl('：どんな場面で、どう動くか。')), h('li', {}, h('b', {}, tl('道具の使い方')), tl('：持たせた道具ごとに「いつ・何のために使うか」。書いていないと、持っていても使い忘れたり、要らない場面で使ったりします。')), h('li', {}, h('b', {}, tl('守ること')), tl('：答えを外さないための約束ごと。「行動名は教わった名前から選ぶ」「分からないときは推測せず確かめる」など。偽の命令（幻術）への備えは、心得ではなく結界の役目です。')), h('li', {}, h('b', {}, tl('答え方')), tl('：答えの形。説明を書かせないと、速く・安くなります。'))), h('p', { class: 'small muted' }, tl('〇〇・△△・□□は、自分で書き換える場所です。使わない行は消してかまいません。見出し（# の行）は残しておくと、あとで直しやすくなります。')), armButton('tmpl', tl('書き方の型を入れ直す'), tl('もう一度押すと、いまの心得を書き方の型で置き換えます'), () => {
            b.main.prompt = MAIN_PROMPT_TEMPLATE;
            renderForm();
            refresh();
        }));
        const mainCard = h('section', { class: 'card' }, h('h3', {}, tl('2. 心得'), h('span', { class: 'ai-term' }, tl('システムプロンプト'))), h('p', { class: 'small muted' }, tl(`冒険者が毎回思い出す教え。{0}{1}トークンごとに重さ1。長いほど燃費も悪くなります。`, R.mainMaxChars ? tl(`{0}字まで、`, R.mainMaxChars) : '', R.mainTokensPerPoint)), tips, main.el, main.note);
        // 3. ツール
        // 行動力のものさし: 冒険者（1つの場面）とお供（1回の依頼）の行動力を、同じ縮尺の棒で並べる。
        // お供の棒のほうが長く見えるので、「重いものはお供に読ませる」が数字を読まなくても伝わる
        const petOk = catalog.some((t) => t.source === 'archive') || !!b.companion;
        const AP_MAIN = MP_BUDGET_PER_CASE, AP_PET = R.companionTokenCap, AP_MAX = Math.max(AP_MAIN, petOk ? AP_PET : 0);
        const AP_LEVEL = [tl('少ない'), tl('ふつう'), tl('多い'), tl('とても多い')];
        const pct = (x) => `${(x * 100).toFixed(1)}%`;
        // 棒: 長さは行動力の大きさ（同じ縮尺）。use を渡すと、右端から使うぶんを赤で削る
        const apBar = (cap, use = 0) => h('span', { class: 'ap-track', style: `width:${pct(cap / AP_MAX)}` }, h('i', { class: 'ap-left', style: `width:${pct(Math.max(0, cap - use) / cap)}` }), use ? h('i', { class: 'ap-use', style: `width:${pct(Math.min(use, cap) / cap)}` }) : null);
        const apRow = (who, sub, cap, end, kind, use = 0) => h('div', { class: `ap-row ap-${kind}` }, h('span', { class: 'ap-who' }, h('b', {}, who), h('small', {}, sub)), h('span', { class: 'ap-bar' }, apBar(cap, use)), h('span', { class: 'ap-num' }, end));
        const apScale = h('div', { class: 'ap-scale' }, h('div', { class: 'ap-scale-head' }, h('b', {}, tl('行動力のものさし')), h('span', { class: 'small muted' }, tl('道具の結果を読むと、そのぶん行動力が減る'))), apRow(tl('冒険者'), tl('1つの場面で'), AP_MAIN, AP_MAIN.toLocaleString(), 'main'), petOk ? apRow(tl('お供'), tl('1回の依頼で'), AP_PET, AP_PET.toLocaleString(), 'pet') : null, h('p', { class: 'small muted' }, petOk
            ? tl('読んだものは、考えるたびに読み返すので、重い結果ほど場面の終わりまで効きます。お供が読んだぶんは、冒険者の行動力から減りません。')
            : tl('読んだものは、考えるたびに読み返すので、重い結果ほど場面の終わりまで効きます。')));
        // 道具ごとの行動力の消費（4段階の目盛り）。多い道具は、1回で使う量の目安も出す
        const apInfo = (t) => {
            const n = toolAp(t), lv = apLevel(n, AP_MAIN);
            return h('div', { class: `ap-line ap-lv${lv}`, title: tl('1回使うと、行動力 約{0}', n.toLocaleString()) }, h('span', { class: 'ap-k' }, tl('行動力の消費')), h('span', { class: 'ap-pips', 'aria-hidden': 'true' }, ...[1, 2, 3, 4].map((i) => h('i', { class: i <= lv ? 'on' : '' }))), h('b', {}, AP_LEVEL[lv - 1]), lv >= 3 ? h('span', { class: 'muted' }, tl('（1回 約{0}）', n.toLocaleString())) : null);
        };
        // 重い道具を、冒険者に持たせたままお供へ移す
        const giveToPet = (id) => {
            const c = b.companion;
            if (!c || c.tools.length >= R.companionMaxTools)
                return;
            b.tools = b.tools.filter((x) => x !== id);
            delete b.gear[id];
            if (!c.tools.includes(id))
                c.tools.push(id);
            renderForm();
            refresh();
            document.getElementById('companion-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        // 重い道具（多い・とても多い）: 冒険者が読んだときと、お供が読んだときの残りを並べる
        const apCompare = (t, on) => {
            const n = toolAp(t);
            if (apLevel(n, AP_MAIN) < 3)
                return null;
            const left = (cap) => (n >= cap ? tl('足りない') : tl('残り 約{0}', (Math.round((cap - n) / 100) * 100).toLocaleString()));
            const c = b.companion, petFull = !!c && c.tools.length >= R.companionMaxTools;
            return h('div', { class: 'ap-compare' }, apRow(tl('冒険者が読むと'), '', AP_MAIN, left(AP_MAIN), 'main', n), petOk ? apRow(tl('お供が読むと'), '', AP_PET, left(AP_PET), 'pet', n) : null, petOk ? h('p', { class: 'ap-hint small' }, tl('お供が読めば、冒険者の行動力は減らない。'), on && c ? h('button', { type: 'button', class: 'btn btn-small', disabled: petFull, title: petFull ? tl('お供の道具がいっぱいです') : '', onclick: () => giveToPet(t.id) }, tl('お供に持たせかえる'))
                : on ? h('a', { href: '#companion-card', onclick: (e) => { e.preventDefault(); document.getElementById('companion-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, tl('6. お供 を見る')) : null) : null);
        };
        const toolCards = toolOrder.map((t) => {
            const on = b.tools.includes(t.id);
            const withPet = !!b.companion?.tools.includes(t.id); // お供が持っている道具は、冒険者には持たせられない
            const full = !on && b.tools.length >= R.maxTools;
            const cb = h('input', { type: 'checkbox', checked: on, disabled: full || withPet, 'data-tool': t.id });
            // 持ち物（b.tools）を正とし、チェックの表示はそこから描き直す。input と change のどちらが来ても1回だけ反映する
            const toggle = () => {
                const want = cb.checked;
                if (want === b.tools.includes(t.id))
                    return;
                if (want) {
                    if (b.tools.length >= R.maxTools) {
                        cb.checked = false;
                        return;
                    }
                    b.tools.push(t.id);
                }
                else {
                    b.tools = b.tools.filter((x) => x !== t.id);
                    delete b.gear[t.id];
                }
                const focused = document.activeElement === cb;
                // フォームを作り直しても、押した道具のカードが画面の同じ位置に残るようにする（続けて押すときに、別の道具を押さないように）
                const top = cb.closest('.tool-card')?.getBoundingClientRect().top;
                renderForm();
                refresh();
                const again = form.querySelector(`input[data-tool="${t.id}"]`);
                const nowTop = again?.closest('.tool-card')?.getBoundingClientRect().top;
                if (top !== undefined && nowTop !== undefined && Math.abs(nowTop - top) > 0.5)
                    window.scrollBy(0, nowTop - top);
                // 作り直したあとも、同じ道具のチェックボックスにフォーカスを戻す（キーボードで続けて操作できるように）
                if (focused)
                    again?.focus({ preventScroll: true });
            };
            cb.onchange = toggle;
            cb.oninput = toggle;
            // 並び順と大きさは、チェックの有無で変えない（見た目の選択は、下の「持たせた道具の見た目」に出す）
            return h('div', { class: 'tool-card' + (on ? ' on' : '') + (full ? ' full' : '') }, h('label', { class: 'tool-head' }, cb, h('b', {}, t.name), withPet ? h('span', { class: 'chip chip-sub' }, tl('お供が持っている')) : null, h('span', { class: 'tool-cost' }, tl(`重さ {0}`, t.cost))), h('p', { class: 'small' }, brief?.toolNotes[t.id] ?? t.description), apInfo(t), withPet ? null : apCompare(t, on));
        });
        // 持たせた道具の見た目（持たせた順）
        const gearRows = b.tools.filter((id) => toolById[id]).map((id) => {
            const t = toolById[id];
            const g = b.gear[id] ?? {};
            const wk = g.weapon ?? t.weapon;
            return h('div', { class: 'gear-row', 'data-gear': id }, h('b', { class: 'gear-name small' }, t.name), lookPicker(WEAPON_KINDS, WEAPON_LABELS, { kind: wk, color: g.color ?? '' }, (k, c) => weaponSprite(k, c || undefined), (k, c) => { b.gear[id] = { weapon: k, color: c }; }));
        });
        const gearBox = gearRows.length ? h('div', { class: 'gear-box' }, h('h4', {}, tl('持たせた道具の見た目（強さには影響しません）')), ...gearRows) : null;
        const toolCard = h('section', { class: 'card' }, h('h3', {}, tl('3. 道具'), h('span', { class: 'ai-term' }, tl('ツール')), R.maxTools < 99 ? h('span', { class: 'slot-count' }, `${b.tools.length} / ${R.maxTools}`) : null), h('p', { class: 'small muted' }, tl('持たせた道具は、冒険者が自分の判断で使います。持っているだけで重く、使えば時間とトークンも増えます。')), h('div', { class: 'gm-tip' }, h('span', { class: 'gm-tip-who' }, tl('ギルドマスターの助言')), h('p', {}, tl('道具は、持たせるだけでは使われんぞ！　いつ・何のために使うかを、心得の「道具の使い方」に書いておけ。書いておかんと、肝心な場面で使い忘れたり、要らん場面で使って時間とトークンを無駄にしたりする。'))), apScale, h('div', { class: 'tool-grid' }, ...toolCards), gearBox);
        basics.append(h('div', { class: 'field' }, h('span', { class: 'field-label' }, tl('見た目（強さには影響しません）')), h('div', { class: 'body-picker' }, ...bodyBtns), patternRow, h('div', { class: 'color-row' }, h('label', {}, tl('服 '), palIn), h('label', {}, tl('髪・毛 '), hairIn), h('label', {}, tl('手に持つ武器 '), weaponSel))));
        // 4. スキル
        emptyHints = [];
        const skCards = b.skills.map((s, i) => {
            const c = area(s.content, (v) => { s.content = v; fresh.delete(s); }, { rows: 4, kind: 'skill', placeholder: tl('ルール集・手順・判断基準など。必要なときだけ読まれます') });
            // 中身が空のあいだの案内は、入力欄の下に控えめに出す（警告にはしない）
            const hint = h('span', { class: 'empty-hint' }, tl('中身を書くと持たせられます（空のままでは、試走・送り出しはできません）'));
            hint.hidden = !!s.content.trim();
            emptyHints.push(hint);
            const look = lookPicker(CHARM_KINDS, CHARM_LABELS, skillLook(lo, i), (k, col) => charmSprite(k, col), (k, col) => { s.look = { kind: k, color: col }; }, 4);
            return h('div', { class: 'sub-card' }, h('div', { class: 'row-between' }, field(tl('名前'), text(s.name, (v) => { s.name = v; }, { maxlength: 30 })), h('button', { class: 'btn btn-small', onclick: () => { b.skills.splice(i, 1); renderForm(); refresh(); } }, tl('外す'))), field(tl('発動条件（いつ読むか）'), text(s.description, (v) => { s.description = v; }, { placeholder: tl('例: 敵が呪文を唱えたときに読む') })), field(tl('中身'), c.el, h('span', {}, c.note, hint)), h('div', { class: 'field' }, h('span', { class: 'field-label' }, tl('見た目')), look));
        });
        const scrolls = scrollOrder;
        // 倉庫の巻物: カードで並べ、「持たせる」で追加
        const shelf = scrolls.length ? h('div', { class: 'scroll-shelf' }, ...scrolls.map((sc) => {
            const has = b.skills.some((x) => x.name === sc.name);
            const full = b.skills.length >= R.maxSkills;
            const note = brief?.scrollNotes[sc.id];
            return h('div', { class: 'scroll-card' + (has ? ' on' : '') }, h('div', { class: 'row-between' }, h('b', {}, sc.name), h('span', { class: 'tool-cost' }, tl(`重さ {0}`, R.skillCost))), note ? h('dl', { class: 'scroll-dl small' }, h('dt', {}, tl('発動条件')), h('dd', {}, note.when), h('dt', {}, tl('発動内容')), h('dd', {}, note.what)) : h('p', { class: 'small' }, sc.description), h('button', { class: 'btn btn-small', disabled: has || full, onclick: () => {
                    const n = b.skills.length;
                    b.skills.push({ name: sc.name, description: sc.description, content: sc.content, look: { kind: 'scroll', color: DEFAULT_CHARM_COLORS[n % 4] } });
                    renderForm();
                    refresh();
                } }, has ? tl('持たせた') : full ? tl('枠がいっぱい') : tl('持たせる')));
        })) : null;
        const skCard = h('section', { class: 'card' }, h('h3', {}, scrolls.length ? tl('4. 巻物') : tl('4. スキル'), h('span', { class: 'ai-term' }, tl('スキル')), h('span', { class: 'slot-count' }, `${b.skills.length} / ${R.maxSkills}`)), h('p', { class: 'small muted' }, brief?.scrollIntro ?? tl(`1つ重さ{0}。「いつ読むか」を書かないと、必要な場面で読まれにくくなります。`, R.skillCost)), shelf ? h('h4', {}, tl('倉庫にある巻物（そのまま持たせることも、書き方の見本にすることもできます）')) : null, shelf, skCards.length ? h('h4', {}, tl('持たせた巻物（発動条件と中身は書き換えられます）')) : null, ...skCards, b.skills.length < R.maxSkills ? h('button', { class: 'btn btn-small', onclick: () => {
                const n = b.skills.length;
                const sk = { name: scrolls.length ? tl(`巻物{0}`, n + 1) : tl(`スキル{0}`, n + 1), description: '', content: '', look: { kind: 'gem', color: DEFAULT_CHARM_COLORS[n % 4] } };
                b.skills.push(sk);
                fresh.add(sk);
                renderForm();
                refresh();
            } }, tl('＋ 資料から自分で巻物を書く')) : null);
        // 上級者向け: YAML
        const adv = h('details', { class: 'card adv' }, h('summary', {}, tl('YAML で見る・貼り付ける（上級者向け）')), h('p', { class: 'small muted' }, tl('画面で組んだ内容と同じものです。ビルドを人と共有したり、保存しておいたものを貼り付けて読み込んだりできます。')), yamlBox, yamlErr, h('button', { class: 'btn btn-small', onclick: () => {
                const r = parseBuild(yamlBox.value, catalog);
                if (!r.build) {
                    yamlErr.textContent = r.errors.map((e) => (e.line ? tl(`{0}行目 `, e.line) : '') + e.message.replace(/^\d+行目: /, '')).join(' / ');
                    return;
                }
                yamlErr.textContent = '';
                b = r.build;
                renderForm();
                refresh();
                syncLook();
                toast(tl('YAML を読み込みました'));
            } }, tl('この YAML を読み込む')));
        // 5. ガードレール（入力の検査）
        const gw = b.guardrail?.words ?? [];
        const gInputs = Array.from({ length: R.guardrailMaxWords }, (_, i) => {
            const el = h('input', { value: gw[i] ?? '', maxlength: 12, placeholder: i === 0 ? tl('例: ○○') : '', 'aria-label': tl(`ガードレールの言葉{0}`, i + 1) });
            el.oninput = () => {
                const words = gInputs.map((x) => x.value.trim()).filter(Boolean);
                if (words.length)
                    b.guardrail = { words };
                else
                    delete b.guardrail;
                refresh();
            };
            return el;
        });
        const guardCard = h('section', { class: 'card' }, h('h3', {}, season.task.scrolls?.length ? tl('5. 幻術よけの結界') : tl('5. ガードレール'), h('span', { class: 'ai-term' }, tl('ガードレール')), h('span', { class: 'slot-count' }, tl(`重さ {0}・任意`, R.guardrailCost))), season.task.charm ? h('p', { class: 'guard-warn' }, tl('幻術は、冒険者の耳に入った時点で効きます。心得で「無視しろ」と教えても防げず、聞いた声はしばらく頭に残って次の行動を狂わせます。防げるのは結界だけです。')) : null, h('p', { class: 'small muted' }, tl(`ここに書いた言葉を含む声は、冒険者の耳に届く前に結界が消し、「{0}」と即答します（AIに聞かせずにシステムが止める＝ガードレール）。言葉が広すぎると、仲間の本物の声まで消してしまいます。{1}つまで。`, season.task.refuseWord ?? tl('お断り'), R.guardrailMaxWords)), h('div', { class: 'guard-row' }, ...gInputs));
        // 6. お供（サブエージェント）: 分厚い書物のある課題か、すでに連れているときだけ出す
        const petCard = catalog.some((t) => t.source === 'archive') || b.companion ? companionCard() : null;
        form.replaceChildren(basics, mainCard, toolCard, skCard, guardCard, ...(petCard ? [petCard] : []), adv);
    };
    // お供（サブエージェント）の欄
    const companionCard = () => {
        const c = b.companion;
        const onBox = h('input', { type: 'checkbox', checked: !!c });
        onBox.onchange = () => {
            if (onBox.checked) {
                b.companion = { prompt: COMPANION_PROMPT_TEMPLATE, tools: [] };
                if (!b.avatar.pet)
                    b.avatar.pet = { kind: 'spirit', color: DEFAULT_FAMILIAR_COLORS[2] }; // お供の見た目（下の「お供の見た目」で変えられる）
                if (!/お供|companion/i.test(b.main.prompt))
                    b.main.prompt = `${b.main.prompt.replace(/\s*$/, '')}\n${MAIN_COMPANION_SNIPPET}`;
            }
            else
                delete b.companion;
            renderForm();
            refresh();
        };
        const desc = brief?.prepare?.find((p) => p.key === 'companion')?.body
            ?? tl('冒険者が頼むと動く、もうひとりの AI。お供だけの心得と道具で調べて、要点だけを返します。お供は自分の行動力で読むので、冒険者の行動力は減りません。ただし、頼むたびにお供の分のトークン（採点の費用）がかかります。');
        const head = h('h3', {}, tl('6. お供'), h('span', { class: 'ai-term' }, tl('サブエージェント')), h('span', { class: 'slot-count' }, tl(`重さ {0}＋心得＋道具・任意`, R.companionCost)));
        const tip = h('div', { class: 'gm-tip' }, h('span', { class: 'gm-tip-who' }, tl('ギルドマスターの助言')), h('p', {}, tl('お供に頼むかどうかは、冒険者が心得を読んで決めるんだぞ。「どんな場面で頼むか」と「頼むときは、名前や様子をそのまま伝える」を、心得に書いておけ。お供に届くのは、冒険者が伝えたことだけだからな。')));
        const rules = h('p', { class: 'small muted' }, tl('上限: 1つの場面で頼めるのは{0}回まで、1回の送り出しで{1}回まで。お供の行動力は1回の依頼ぶんで、冒険者より少し多いくらい。尽きると、答えをまとめられません。', R.companionCallsPerCase, R.companionCallsPerRun, R.companionTokenCap.toLocaleString()));
        if (!c)
            return h('section', { class: 'card companion-card', id: 'companion-card' }, head, h('p', { class: 'small muted' }, desc), h('label', { class: 'chk' }, onBox, tl('お供を連れていく（サブエージェント）')), tip, rules);
        const pa = area(c.prompt, (v) => { c.prompt = v; }, { rows: 6, kind: 'main', maxChars: R.companionMaxChars || undefined, placeholder: tl('お供が頼まれたときに思い出す教え。何をどう調べ、どう答えるか') });
        const ptools = toolOrder.map((t) => {
            const on = c.tools.includes(t.id), byMain = b.tools.includes(t.id);
            const full = !on && c.tools.length >= R.companionMaxTools;
            const cb = h('input', { type: 'checkbox', checked: on, disabled: byMain || full });
            cb.onchange = () => {
                if (cb.checked && !c.tools.includes(t.id) && c.tools.length < R.companionMaxTools)
                    c.tools.push(t.id);
                if (!cb.checked)
                    c.tools = c.tools.filter((x) => x !== t.id);
                renderForm();
                refresh();
            };
            const n = toolAp(t), lv = apLevel(n, MP_BUDGET_PER_CASE);
            return h('label', { class: 'chk pet-tool' + (on ? ' on' : '') }, cb, h('span', {}, t.name), byMain ? h('span', { class: 'chip chip-sub' }, tl('冒険者が持っている')) : null, h('span', { class: 'tool-cost' }, tl(`重さ {0}`, t.cost)), h('span', { class: `ap-mini ap-lv${lv}`, title: tl('1回使うと、行動力 約{0}', n.toLocaleString()) }, h('span', { class: 'ap-pips', 'aria-hidden': 'true' }, ...[1, 2, 3, 4].map((i) => h('i', { class: i <= lv ? 'on' : '' }))), lv >= 3 ? tl('行動力 約{0}', n.toLocaleString()) : null));
        });
        return h('section', { class: 'card companion-card', id: 'companion-card' }, head, h('p', { class: 'small muted' }, desc), h('label', { class: 'chk' }, onBox, tl('お供を連れていく（サブエージェント）')), tip, field(tl('お供の心得'), pa.el, pa.note), h('div', { class: 'field' }, h('span', { class: 'field-label' }, tl(`お供に持たせる道具（{0}つまで）`, R.companionMaxTools)), h('div', { class: 'pet-tools' }, ...ptools), h('span', { class: 'small muted' }, tl('道具は、冒険者とお供のどちらかひとりにしか持たせられません。お供の道具は、お供に頼んだときだけ使われます。'))), 
        // お供の見た目: お供を連れていくと、討伐で冒険者のそばに必ず姿を見せる（お供がいないと、姿も出ない）
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, tl('お供の見た目')), lookPicker(FAMILIAR_KINDS, FAMILIAR_LABELS, { kind: b.avatar.pet?.kind ?? 'spirit', color: b.avatar.pet?.color || DEFAULT_FAMILIAR_COLORS[2] }, (k, col) => familiarSprite(k, col, 0), (k, col) => { b.avatar.pet = { kind: k, color: col }; })), rules);
    };
    // --- キャラの見た目（右側） ---
    const bodyBtns = BODY_TYPES.map((t) => {
        const c = portrait({ body: t, palette: '#3a7bd5', hair: '#f2c14e', weapon: 'book' }, { back: [], fams: [], charms: [] }, { scale: 2 });
        c.className = 'pixel';
        return h('button', { class: 'body-btn', title: BODY_LABELS[t], 'data-body': t, onclick: () => { b.avatar.body = t; syncLook(); refresh(); } }, c, h('span', {}, BODY_LABELS[t]));
    });
    // ねこを選んだときだけ、柄を選べる
    const patBtns = CAT_PATTERNS.map((pt) => {
        const c = portrait({ body: 'cat', pattern: pt, palette: '#3a7bd5', hair: pt === 'tabby' ? '#f0a040' : pt === 'calico' ? '#e8913a' : pt === 'siamese' ? '#7a5a44' : '#4a4458', weapon: 'book' }, { back: [], fams: [], charms: [] }, { scale: 2 });
        c.className = 'pixel';
        return h('button', { class: 'body-btn pat-btn', title: CAT_PATTERN_LABELS[pt], 'data-pat': pt, onclick: () => {
                if (pt === 'tabby')
                    delete b.avatar.pattern;
                else
                    b.avatar.pattern = pt;
                // 柄に合う毛の色にそろえる（あとから変えられる）
                b.avatar.hair = pt === 'tabby' ? '#f0a040' : pt === 'calico' ? '#e8913a' : pt === 'siamese' ? '#7a5a44' : pt === 'tux' ? '#4a4458' : b.avatar.hair;
                syncLook();
                refresh();
            } }, c, h('span', {}, CAT_PATTERN_LABELS[pt]));
    });
    const patternRow = h('div', { class: 'pattern-row' }, h('div', { class: 'small muted' }, tl('ねこの柄')), h('div', { class: 'pattern-picker' }, ...patBtns));
    const palIn = h('input', { type: 'color', 'aria-label': tl('服の色') });
    const hairIn = h('input', { type: 'color', 'aria-label': tl('髪・毛の色') });
    const weaponSel = h('select', { 'aria-label': tl('手に持つ武器') }, h('option', { value: 'auto' }, tl('おまかせ（いちばん高いツール）')), ...WEAPON_KINDS.map((w) => h('option', { value: w }, WEAPON_LABELS[w])));
    palIn.oninput = () => { b.avatar.palette = palIn.value; refresh(); };
    hairIn.oninput = () => { b.avatar.hair = hairIn.value; refresh(); };
    weaponSel.onchange = () => { b.avatar.weapon = weaponSel.value; refresh(); };
    const persBtns = POSITIONS.map((p) => h('button', { class: `btn btn-small pers-btn pos-${p}`, 'data-p': p, onclick: () => { b.position = p; syncLook(); refresh(); } }, POSITION_LABELS[p]));
    const persNote = h('p', { class: 'small muted pers-note' });
    const syncLook = () => {
        palIn.value = b.avatar.palette;
        hairIn.value = b.avatar.hair;
        weaponSel.value = b.avatar.weapon;
        bodyBtns.forEach((x) => x.classList.toggle('on', x.dataset.body === b.avatar.body));
        if (b.avatar.body !== 'cat')
            delete b.avatar.pattern;
        patternRow.hidden = b.avatar.body !== 'cat';
        patBtns.forEach((x) => x.classList.toggle('on', x.dataset.pat === (b.avatar.pattern ?? 'tabby')));
        persBtns.forEach((x) => x.classList.toggle('on', x.dataset.p === b.position));
        persNote.textContent = POSITION_NOTES[b.position];
    };
    // プレビューのアニメーション
    let raf = 0, frame = 0;
    const pctx = preview.getContext('2d');
    const SEQ = [['idle', tl('待機'), 90], ['walk', tl('移動'), 70], ['attack', tl('攻撃'), 40], ['cast', tl('スキル'), 50], ['guard', tl('防御'), 40], ['hurt', tl('被弾'), 25], ['dash', tl('突進'), 30], ['victory', tl('勝利'), 70]];
    const tick = () => {
        if (!preview.isConnected && frame > 0) {
            clearInterval(poll);
            return;
        }
        frame++;
        pctx.setTransform(1, 0, 0, 1, 0, 0);
        pctx.clearRect(0, 0, preview.width, preview.height);
        const lo = toLoadout(b, catalog);
        pctx.imageSmoothingEnabled = false;
        pctx.scale(2, 2);
        const total = SEQ.reduce((a, x) => a + x[2], 0);
        let f0 = frame % total, k = 0;
        while (f0 >= SEQ[k][2]) {
            f0 -= SEQ[k][2];
            k++;
        }
        const [act, label, len] = SEQ[k];
        if (actionLabel.textContent !== label)
            actionLabel.textContent = label;
        drawHero(pctx, lookOf(lo), gearOf(lo), PORTRAIT_W / 2 + 4, PORTRAIT_H - 3, { frame, action: act, t: act === 'victory' ? (f0 / 35) % 1 : f0 / len, skillGlow: act === 'cast' ? Math.sin((f0 / len) * Math.PI) : 0 });
        const mctx = miniPreview.getContext('2d');
        mctx.imageSmoothingEnabled = false;
        mctx.clearRect(0, 0, miniPreview.width, miniPreview.height);
        mctx.drawImage(preview, 0, 0, miniPreview.width, miniPreview.height);
        raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    stop = () => { cancelAnimationFrame(raf); clearInterval(poll); };
    const renderAccount = () => {
        const after = (m) => {
            // この画面でログインしたとき: 未ログインのあいだにこのタブで書いた下書きがあれば、それをこの人の下書きにする（なければ、この人の下書きを開く）。
            // ほかの人の下書きは引き継がない（未ログインの下書きはこのタブだけのもので、ログアウトでも消える）
            if (!me) {
                const carry = !!anonGet(draftKey());
                setUser(m.name);
                if (carry)
                    userSet(draftKey(), buildToYaml(b));
                clearAnon();
                stop?.();
                void renderSubmit(root);
                return;
            }
            me = m;
            renderAccount();
            refresh();
            refreshSubs();
        };
        if (demoMode) {
            accountEl.replaceChildren(h('p', { class: 'notice' }, tl('これは静的デモ版です。準備とプレビューは試せますが、送り出し（提出）はできません。')));
        }
        else if (!me) {
            accountEl.replaceChildren(h('p', { class: 'small muted' }, tl('準備は、ログインしなくても試せます。試走と送り出しにはログインとエントリーが必要です。')), loginForm(season, after));
        }
        else if (!me.entered) {
            accountEl.replaceChildren(entryCard(season, me, after));
        }
        else {
            // ログアウトしたら、画面を作り直す（前の人の下書き・試走の結果・送り出しの一覧を画面にも残さない）
            accountEl.replaceChildren(accountBar(season, me, () => { stop?.(); void renderSubmit(root); }));
        }
        refresh();
    };
    let poll = 0;
    const refreshSubs = async () => {
        if (demoMode || !me) {
            subsEl.replaceChildren();
            return;
        }
        const { items } = await mySubmissions().catch(() => ({ items: [] }));
        const stateOf = (s) => s.status === 'queued' ? tl('順番待ち') : s.status === 'grading' ? tl(`戦闘中 {0}%`, Math.round(s.progress * 100)) : s.status === 'done' ? tl(`戦果 {0}%`, s.accuracy) : tl(`エラー: {0}`, s.error ?? '');
        const spark = sparkline(items), deltas = accuracyDeltas(items);
        const toolName = (id) => toolById[id]?.name ?? id;
        subsEl.replaceChildren(...nodes(h('h3', {}, tl('あなたが送り出した冒険者')), spark ? h('div', { class: 'spark-box' }, h('div', { class: 'small muted' }, tl('提出ごとの戦果の推移')), spark) : null, items.length ? h('ul', { class: 'sent-list' }, ...items.map((s) => h('li', {}, h('div', { class: 'row-between' }, h('b', {}, s.name), h('span', { class: s.status === 'done' ? 'ok' : 'muted' }, stateOf(s), deltas.has(s.id) ? h('span', { class: `delta ${deltas.get(s.id) >= 0 ? 'up' : 'down'}` }, ` (${deltas.get(s.id) >= 0 ? '+' : ''}${deltas.get(s.id)}pt)`) : null)), diffParts(s, toolName).length ? h('div', { class: 'small sent-diff' }, s.diff?.first ? null : h('span', { class: 'muted' }, tl('前回から'), ': '), diffParts(s, toolName).join(' / ')) : null, h('div', { class: 'small muted' }, tl(`{0}・重さ {1}{2}`, new Date(s.createdAt).toLocaleString(localeOf()), s.buildCost, s.costUsd ? tl(`・\${0}`, s.costUsd.toFixed(3)) : '')), s.status === 'done' ? h('div', { class: 'small row-gap' }, h('a', { href: `#/build/${s.id}` }, tl('ギルドマスターの講評 →')), h('a', { href: '#/arena/me' }, tl('討伐を見る →'))) : null))) : h('p', { class: 'muted' }, tl('まだ送り出していません。'))));
        const busy = items.some((s) => s.status === 'queued' || s.status === 'grading');
        clearInterval(poll);
        if (busy)
            poll = setInterval(refreshSubs, 2000);
    };
    // 直すところがあるときは、試走・送り出しの前に一覧で出す
    const blockedByIssues = () => {
        if (valid)
            return false;
        attempted = true;
        refresh();
        showDock(tl('試走・送り出しの前に、直すところがあります'), errorsEl);
        return true;
    };
    submitBtn.onclick = () => {
        if (!me || !me.entered) {
            showDock(tl('送り出すには'), accountEl);
            return;
        }
        if (blockedByIssues())
            return;
        const est = estimateSubmitCost(b, season.task.caseCount);
        const yen = (u) => Math.max(1, Math.round(u * 150));
        const go = h('button', { class: 'btn btn-primary' }, tl('送り出す'));
        const cancel = h('button', { class: 'btn' }, tl('やめる'));
        cancel.onclick = () => { confirmEl.replaceChildren(); submitBtn.hidden = false; hideDock(); };
        go.onclick = async () => {
            go.disabled = true;
            try {
                const { id } = await submitBuild(buildToYaml(b));
                me = await getMe();
                renderAccount();
                refreshSubs();
                battleWait(id, b.name, () => { refreshSubs(); });
            }
            catch (e) {
                toast(e.message, 'err');
            }
            confirmEl.replaceChildren();
            submitBtn.hidden = false;
            hideDock();
            refresh();
        };
        submitBtn.hidden = true;
        refresh(); // 表示を持ち物のデータにそろえてから、確認に出す
        showDock(tl('送り出しの確認'), confirmEl);
        // 送る前に、実際に送る持ち物（巻物・道具・結界）を確かめられるようにする
        const none = h('span', { class: 'muted' }, tl('なし'));
        const kit = h('dl', { class: 'confirm-kit small' }, h('dt', {}, tl('巻物')), h('dd', {}, b.skills.length ? b.skills.map((x) => x.name || tl('（名前なし）')).join(tl('・')) : none.cloneNode(true)), h('dt', {}, tl('道具')), h('dd', {}, b.tools.length ? b.tools.map((id) => toolById[id]?.name ?? id).join(tl('・')) : none.cloneNode(true)), h('dt', {}, tl('結界')), h('dd', {}, b.guardrail?.words.length ? b.guardrail.words.join(tl('・')) : none.cloneNode(true)));
        confirmEl.replaceChildren(h('p', {}, tl(`「{0}」を送り出します。今日の残り {1} 回のうち1回を使います。`, b.name, me.remainingToday)), h('p', { class: 'small' }, tl('送る持ち物:')), kit, h('p', { class: 'small muted' }, tl(`AI利用料の目安は約{0}〜{1}円（運営負担）。送り出す前に試走で確かめておくと安心です。`, yen(est.low), yen(est.high))), h('p', { class: 'small muted sway-note' }, SWAY_NOTE()), h('div', { class: 'row-gap' }, go, cancel));
    };
    // 試走: 公開サンプルだけを動かす。提出回数は使わない。
    // 広い画面（資料の欄が横に出ているとき）は、結果を資料の欄の「試走の結果」タブに出し、準備のフォームを隠さない。
    // 狭い画面は、上のパネルに出す（閉じずに折りたためる）
    const sideBySide = () => window.matchMedia('(min-width: 901px)').matches;
    // 見出しは、上のパネル用と資料の欄用の2つ（同じ文言にそろえる）
    const trialTitle = h('span', {}, tl('試走の結果'));
    const trialTitle2 = h('span', {}, tl('試走の結果'));
    const setTrialTitle = (v) => { trialTitle.textContent = v; trialTitle2.textContent = v; };
    trialBtn.onclick = async () => {
        if (!me || !me.entered) {
            showDock(tl('試走するには'), accountEl);
            return;
        }
        if (blockedByIssues())
            return;
        setTrialTitle(tl('試走の結果'));
        trialTab.hidden = false;
        if (sideBySide()) {
            hideDock();
            setRef('trial');
        }
        else
            showDockOpt({ collapsible: true }, trialTitle, trialEl);
        trialBtn.disabled = true;
        trialEl.replaceChildren(h('p', { class: 'muted' }, tl('試走中…（数秒〜十数秒かかります）')));
        try {
            const r = await runTrial(buildToYaml(b));
            me = r.user;
            renderAccount();
            trialEl.replaceChildren(trialView(r, season.task.caseCount, (id) => toolById[id]?.name ?? id, !!season.task.scrolls?.length));
            const ok = r.cases.filter((c) => c.score >= 0.6).length;
            setTrialTitle(tl(`試走の結果（{0} / {1} 問 正解）`, ok, r.cases.length)); // たたんでも分かるように
        }
        catch (e) {
            trialEl.replaceChildren(h('p', { class: 'errors' }, e.message));
        }
        refresh();
    };
    // --- 左: 作戦メモ（募集要項を見ながら準備できるように）---
    const t = season.task;
    const taskCol = h('div', { class: 'lib-pane' }, brief ? library(brief, t.references ?? []) : h('p', { class: 'small' }, t.description), t.publicSamples.length ? h('details', {}, h('summary', {}, tl('戦場の様子の例')), ...t.publicSamples.map((x) => h('div', { class: 'sample small' }, h('p', {}, x.body), h('div', { class: 'muted' }, tl(`頼れる冒険者の行動: {0}`, Object.values(x.expected)[0]))))) : null, season.provider === 'mock' ? h('p', { class: 'notice small' }, tl('いまは「模擬採点」で動いています。心得の中身は点数にほとんど反映されないので、戦果は目安です。')) : null);
    const panelTabs = h('div', { class: 'tabs panel-tabs', role: 'tablist' }, h('button', { class: 'tab on', 'data-p': 'build', onclick: () => setPanel('build') }, tl('準備')), h('button', { class: 'tab', 'data-p': 'task', onclick: () => setPanel('task') }, tl('討伐依頼書・資料室')));
    const page = h('div', { class: 'submit-page' });
    const setPanel = (v) => {
        page.classList.toggle('show-task', v === 'task');
        panelTabs.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.p === v));
    };
    // 左: 討伐依頼書（先遣隊の報告）と資料室を、タブで切り替える。フォームをスクロールしても、いつも横に見えている
    const refPanes = {
        report: brief ? questCard(brief, t.season) : h('p', { class: 'small' }, t.description),
        library: taskCol,
        trial: h('div', { class: 'trial-pane' }, h('h3', {}, trialTitle2)),
    };
    const refBody = h('div', { class: 'ref-scroll' });
    const refTabs = h('div', { class: 'tabs ref-tabs', role: 'tablist' }, ...[['report', tl('討伐依頼書')], ['library', tl('資料室')], ['trial', tl('試走の結果')]].map(([k, label]) => h('button', { class: 'tab', 'data-k': k, onclick: () => setRef(k), hidden: k === 'trial' }, label)));
    const trialTab = refTabs.querySelector('[data-k=trial]'); // 試走するまでは出さない
    const setRef = (k) => {
        // 試走の結果は1つなので、資料の欄で見るときは上のパネルから移す
        if (k === 'trial') {
            if (dockBody.contains(trialEl))
                hideDock();
            refPanes.trial.append(trialEl);
        }
        refBody.replaceChildren(refPanes[k]);
        page.classList.toggle('on-library', k === 'library');
        refBody.scrollTop = 0;
        refTabs.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.k === k));
    };
    const refCol = h('aside', { class: 'ref-col' }, refTabs, refBody);
    // 資料室を2列で読むときは、資料の欄を広げる（広い画面だけ。CSS で切り替える）
    taskCol.addEventListener('libcols', (e) => page.classList.toggle('wide-ref', !!e.detail));
    // 上: 出発の準備バー（見た目・荷物の重さ・試走・送り出し）
    const meterBtn = h('button', { class: 'dock-meter', 'aria-describedby': 'meter-tip', onclick: () => showDock(tl('荷物の内訳'), kindSum, breakdown, runCostEl) }, h('span', { class: 'dock-label small' }, tl('荷物の重さ')), h('div', { class: 'meter' }, meterFill, meterText), meterTip);
    const dock = h('div', { class: 'dock' }, h('div', { class: 'dock-bar' }, miniPreview, h('div', { class: 'dock-who' }, dockName, dockMe), meterBtn, dockErr, h('div', { class: 'dock-actions' }, trialBtn, submitBtn)), dockPanel);
    root.replaceChildren(...nodes(dock, panelTabs, page));
    page.replaceChildren(...nodes(refCol, h('section', { class: 'editor-col' }, h('div', { class: 'row-between' }, h('h2', {}, tl('冒険者の準備')), armButton('reset', tl('はじめからやり直す'), tl('もう一度押すとテンプレートに戻します'), () => { b = parseBuild(BUILD_TEMPLATE, catalog).build; renderForm(); refresh(); syncLook(); toast(tl('テンプレートに戻しました')); })), h('p', { class: 'small muted' }, tl(`心得・道具・巻物・結界を、荷物の重さ {0} までで準備して送り出します。左の討伐依頼書と資料室を見比べながら、何を持たせて送り出すかを決めてください。入力は自動で保存されます。`, R.limit)), form, h('section', { class: 'card sent-card' }, accountEl, subsEl))));
    setRef('report');
    setPanel('build');
    renderForm();
    syncLook();
    renderAccount();
    refresh();
    refreshSubs();
}
// 討伐依頼書: 今シーズンのボスと、戦場で起きること（ここではじめて出す）
function questCard(b, season) {
    const sceneColor = { breath: '#ff7a3a', opening: '#ffe27a', fog: '#c8d0e0', spell: '#ff4fa0', ougi: '#ffd166', rush: '#ff8a5a', summon: '#9fe8ff', memory: '#d9b77a', illusion: '#b57bff', ally: '#7bed9f', chain: '#ffe9a0' };
    return h('section', { class: 'card quest' }, h('p', { class: 'eyebrow' }, tl(`{0}　討伐依頼書`, season)), h('h2', { class: 'quest-title' }, tl(`討伐対象：{0}`, b.boss?.name ?? tl('ボス'))), b.boss ? h('p', {}, b.boss.intro) : null, h('h3', {}, tl('先遣隊の報告（戦場で起きること）')), b.reportIntro ? h('p', { class: 'small' }, b.reportIntro) : null, h('div', { class: 'reports' }, ...(b.reports ?? []).map((r) => h('div', { class: 'report', style: { borderLeftColor: sceneColor[r.scene] ?? '#9aa0c8' } }, h('div', { class: 'report-head' }, h('b', {}, r.name), h('span', { class: 'small muted' }, r.by)), h('p', {}, tl(`「{0}」`, r.report))))), h('p', { class: 'small muted' }, b.overlap), h('p', { class: 'small' }, tl('報告のひとつひとつについて、冒険者が何を知っていて、何を持っていれば正しく動けそうかを考えてみましょう。手がかりは、資料室にあります。')));
}
// 送り出したあと: 戦い（採点）が終わるまで、進み具合を見せて画面を離れさせない。
// 終わったら、討伐（自分の冒険者が出る）と講評へのボタンを出す。終わったあとは、Esc・背景のクリック・閉じるボタン・画面の移動で閉じる
function battleWait(id, name, onDone) {
    const bar = h('div', { class: 'wait-fill' });
    const label = h('p', { class: 'wait-label' }, tl('出発の準備をしています…'));
    const actions = h('div', { class: 'row-gap wait-actions' });
    const note = h('p', { class: 'small muted' }, tl('本物のAIが、ボスの仕掛けにひとつずつ立ち向かっています。終わるまで数分かかります。この画面のままお待ちください。'));
    // 道のりの飾り（冒険者 → ボス）。ボタンではないので、読み上げとクリックの対象から外す
    const box = h('div', { class: 'wait-box', role: 'dialog', 'aria-modal': 'true', 'aria-label': tl('冒険者が戦っています') }, h('p', { class: 'eyebrow' }, tl('送り出しました')), h('h2', {}, tl(`「{0}」が戦場へ向かっています`, name)), h('div', { class: 'wait-scene', 'aria-hidden': 'true' }, h('span', { class: 'wait-hero' }, '🧙'), h('span', { class: 'wait-road' }), h('span', { class: 'wait-boss' }, '⚔')), h('div', { class: 'wait-bar' }, bar), label, note, actions);
    const overlay = h('div', { class: 'wait-overlay' }, box);
    document.body.append(overlay);
    document.body.dataset.locked = '1';
    const unload = (e) => { e.preventDefault(); };
    window.addEventListener('beforeunload', unload);
    // 戦いが終わるまでは閉じない（画面も移らない）。終わったら閉じられるようにする
    let closable = false;
    const close = () => {
        overlay.remove();
        window.removeEventListener('hashchange', close);
        document.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => { if (closable && e.key === 'Escape')
        close(); };
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', (e) => { if (closable && e.target === overlay)
        close(); });
    const finish = () => {
        delete document.body.dataset.locked;
        window.removeEventListener('beforeunload', unload);
        closable = true;
        window.addEventListener('hashchange', close); // 画面を移ったら閉じる
        box.prepend(h('button', { class: 'wait-close', type: 'button', 'aria-label': tl('閉じる'), title: tl('閉じる'), onclick: close }, '×'));
    };
    const tick = async () => {
        const { items } = await mySubmissions().catch(() => ({ items: [] }));
        const s = items.find((x) => x.id === id);
        if (!s || s.status === 'queued') {
            label.textContent = tl('ほかの冒険者の戦いが終わるのを待っています（順番待ち）…');
            bar.style.width = '3%';
        }
        else if (s.status === 'grading') {
            const p = Math.round(s.progress * 100);
            bar.style.width = `${Math.max(3, p)}%`;
            label.textContent = tl(`戦闘中… {0}%（ボスの仕掛けに、ひとつずつ対処しています）`, p);
        }
        else if (s.status === 'done') {
            bar.style.width = '100%';
            bar.classList.add('done');
            label.replaceChildren(h('b', {}, tl('戦いが終わりました！')), tl(`　戦果 {0}%`, s.accuracy));
            finish();
            onDone();
            note.textContent = tl('講評では、何が良くて何を直せばいいかが分かります。討伐では、あなたの冒険者が「あなた」の印つきで登場します。');
            const watch = h('a', { class: 'btn btn-primary', href: '#/arena/me', onclick: close }, tl('討伐を見る（あなたの冒険者の活躍）'));
            actions.replaceChildren(watch, h('a', { class: 'btn', href: `#/build/${id}`, onclick: close }, tl('ギルドマスターの講評')), h('button', { class: 'btn', onclick: close }, tl('準備画面に戻る')));
            watch.focus();
            return;
        }
        else {
            label.textContent = tl(`戦いの途中で問題が起きました: {0}`, s.error ?? '');
            finish();
            onDone();
            actions.replaceChildren(h('button', { class: 'btn', onclick: close }, tl('閉じる')));
            return;
        }
        setTimeout(tick, 1500);
    };
    tick();
}
// ブラウザのダイアログは使わず、2回押しで確定する。
// 1回目を押すと、ボタンの文言が「もう一度押すと…（あと○秒）」に変わり、受付時間（ARM_MS）のあいだに2回目を押すと確定する。
// 受付時間は押すたびに測り直す（以前は、前の受付時間のタイマーが残っていて、続けて押したときに2回目が効かないことがあった）。
// フォームを作り直してボタンが新しくなっても、受付中の状態と文言を引き継ぐ
const ARM_MS = 5000;
const arms = {};
const armText = (a) => tl('{0}（あと{1}秒）', a.armedLabel, Math.max(1, Math.ceil((a.until - Date.now()) / 1000)));
function disarm(k) {
    const a = arms[k];
    if (!a)
        return;
    clearInterval(a.timer);
    if (a.btn) {
        a.btn.textContent = a.label;
        a.btn.classList.remove('armed');
        a.btn.removeAttribute('aria-live');
    }
    delete arms[k];
}
function armButton(k, label, armedLabel, onConfirm) {
    const btn = h('button', { class: 'btn btn-small', 'data-arm': k }, label);
    const a0 = arms[k];
    if (a0) {
        a0.btn = btn;
        btn.textContent = armText(a0);
        btn.classList.add('armed');
    }
    btn.onclick = () => {
        if (arms[k] && Date.now() < arms[k].until) {
            disarm(k);
            onConfirm();
            return;
        }
        disarm(k);
        const a = { until: Date.now() + ARM_MS, timer: 0, btn, label, armedLabel };
        arms[k] = a;
        btn.classList.add('armed');
        btn.setAttribute('aria-live', 'polite');
        btn.textContent = armText(a);
        a.timer = setInterval(() => {
            if (Date.now() >= a.until) {
                if (arms[k] === a)
                    disarm(k);
                return;
            }
            if (a.btn?.isConnected)
                a.btn.textContent = armText(a);
        }, 250);
    };
    return btn;
}
// 試走の結果表示: 答え・正誤・使った道具・トークン・費用、そして提出した場合の費用の見込み
// 道具は表示名で出す（内部の ID を出さない）
function trialView(r, caseCount, toolName, scrollWord) {
    const yen = (u) => Math.max(1, Math.round(u * 150));
    const n = r.cases.length;
    const ok = r.cases.filter((c) => c.score >= 0.6).length;
    const per = r.totals.costUsd / Math.max(1, n);
    return h('div', {}, h('p', {}, h('b', {}, tl(`{0} / {1} 問 正解`, ok, n)), h('span', { class: 'muted small' }, tl(`　残りの試走 {0} 回`, r.user.trialsLeft))), h('ul', { class: 'trial-list' }, ...r.cases.map((c) => h('li', { class: c.score >= 0.6 ? 'trial-ok' : 'trial-ng' }, h('div', {}, h('b', {}, c.score >= 0.6 ? '○ ' : '× '), c.title), h('div', { class: 'small' }, tl(`答え: {0}`, c.answer)), c.score < 0.6 ? h('div', { class: 'small muted' }, tl(`正解: {0}`, Object.values(c.expected).join(' / '))) : null, h('div', { class: 'small muted' }, tl(`道具: {0}{1}　{2}トークン・{3}秒{4}`, c.tools.map(toolName).join(tl('・')) || tl('なし'), c.skills.length ? (scrollWord ? tl(`　巻物: {0}`, c.skills.join(tl('・'))) : tl(`　スキル: {0}`, c.skills.join(tl('・')))) : '', (c.tokensIn + c.tokensOut).toLocaleString(), (c.latencyMs / 1000).toFixed(1), c.mpOut ? tl('　行動力切れ') : '')), c.trace?.length ? h('details', { class: 'trial-trace', ...(c.score < 0.6 ? { open: true } : {}) }, h('summary', { class: 'small' }, tl('冒険の記録を見る')), traceView(c.trace, sceneMp(c))) : null))), h('p', { class: 'small muted' }, r.totals.costUsd > 0
        ? tl(`この試走の費用は約{0}円。全{1}回を送り出すと、約{2}円の見込みです。`, yen(r.totals.costUsd), caseCount, yen(per * caseCount))
        : tl('（モック採点のため費用は出ません）')));
}
//# sourceMappingURL=submit.js.map