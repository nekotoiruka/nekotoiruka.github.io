// 提出画面: 画面でポチポチ組み立てるビルダー（YAML は上級者向けの読み書きだけ）
import { BODY_LABELS, BODY_TYPES, BUILD_TEMPLATE, CHARM_KINDS, CHARM_LABELS, FAMILIAR_KINDS, FAMILIAR_LABELS, POSITIONS, POSITION_LABELS, POSITION_NOTES, DEFAULT_CHARM_COLORS, DEFAULT_FAMILIAR_COLORS, LEGACY_MAIN_PROMPTS, MAIN_PROMPT_TEMPLATE, backWeapons, buildToYaml, computeCost, estimateSubmitCost, estimateTokens, parseBuild, skillLook, toLoadout, CAT_PATTERNS, CAT_PATTERN_LABELS } from '../../shared/build.js';
import { COST_RULES, WEAPON_KINDS, WEAPON_LABELS } from '../../shared/catalog.js';
import { accountBar, entryCard, loginForm } from '../account.js';
import { traceView } from '../trace.js';
import { demoMode, getMe, getSeason, mySubmissions, runTrial, submitBuild } from '../api.js';
import { charmSprite, drawHero, familiarSprite, gearOf, lookOf, portrait, PORTRAIT_H, PORTRAIT_W, weaponSprite } from '../hero.js';
import { BODY_STYLE, STYLE_LABEL } from '../fx.js';
import { h, nodes, toast } from '../ui.js';
import { parseYaml, toYaml } from '../../shared/yaml.js';
import { briefingOf, library } from '../briefing.js';
import { getLang, localeOf, tl } from '../../shared/i18n.js';
// 下書きは言語ごとに分けて保存する（日本語で開いたときの下書きが、ほかの言語の初期値に残らないように。日本語は従来のキーのまま）
const draftKey = () => (getLang() === 'ja' ? 'ai-battle:draft' : `ai-battle:draft:${getLang()}`);
let stop = null;
function loadDraft() {
    try {
        return localStorage.getItem(draftKey()) || BUILD_TEMPLATE;
    }
    catch {
        return BUILD_TEMPLATE;
    }
}
function saveDraft(v) {
    try {
        localStorage.setItem(draftKey(), v);
    }
    catch { /* 保存できない環境 */ }
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
    let b = initialBuild(catalog);
    // --- 右側: プレビューとコスト ---
    const preview = h('canvas', { class: 'preview pixel', width: PORTRAIT_W * 2, height: PORTRAIT_H * 2, 'aria-label': tl('キャラのプレビュー') });
    const actionLabel = h('div', { class: 'preview-action small muted' });
    const nameLabel = h('div', { class: 'preview-name' });
    const legend = h('ul', { class: 'legend' });
    const meterFill = h('div', { class: 'meter-fill' });
    const meterText = h('div', { class: 'meter-text' });
    const breakdown = h('ul', { class: 'breakdown' });
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
    const hideDock = () => { dockPanel.hidden = true; dockBody.replaceChildren(); };
    const showDock = (title, ...els) => {
        dockBody.replaceChildren(h('div', { class: 'row-between' }, h('h4', {}, title), h('button', { class: 'btn btn-small', onclick: hideDock }, tl('閉じる'))), ...els.filter((x) => !!x));
        dockPanel.hidden = false;
    };
    dockPanel.append(dockBody);
    // --- 左側: フォーム ---
    const form = h('div', { class: 'builder' });
    const yamlBox = h('textarea', { class: 'editor', spellcheck: 'false', wrap: 'off', 'aria-label': tl('ビルド（YAML）') });
    const yamlErr = h('p', { class: 'errors small' });
    let valid = false;
    // 値だけが変わったとき（入力中）: フォームは作り直さず、コスト・プレビュー・YAML だけ更新
    const refresh = () => {
        const yaml = buildToYaml(b);
        saveDraft(yaml);
        if (document.activeElement !== yamlBox)
            yamlBox.value = yaml;
        const cost = computeCost(b, catalog);
        const r = parseBuild(yaml, catalog);
        valid = !!r.build;
        errorsEl.replaceChildren(...r.errors.map((e) => h('li', {}, e.message.replace(/^\d+行目: /, ''))));
        meterFill.style.width = `${Math.min(100, (cost.total / cost.limit) * 100)}%`;
        meterFill.classList.toggle('over', cost.over);
        meterText.textContent = `${cost.total} / ${cost.limit}`;
        breakdown.replaceChildren(...cost.items.map((it) => h('li', { class: `bd-${it.kind}` }, h('span', {}, it.label), h('span', { class: 'muted small' }, it.note ?? ''), h('b', {}, it.cost))));
        nameLabel.textContent = b.name || tl('（名前未設定）');
        dockName.textContent = b.name || tl('（名前未設定）');
        dockErr.textContent = r.errors.length ? `⚠ ${r.errors[0].message.replace(/^\d+行目: /, '')}${r.errors.length > 1 ? tl(` ほか{0}件`, r.errors.length - 1) : ''}` : '';
        dockMe.textContent = demoMode ? tl('デモ版（送り出しはできません）') : !me ? tl('未ログイン') : !me.entered ? tl('エントリー前') : tl(`{0} さん・送り出しあと{1}回・試走あと{2}回`, me.name, me.remainingToday, me.trialsLeft);
        const lo = toLoadout(b, catalog);
        legend.replaceChildren(h('li', {}, h('b', {}, tl('手の武器')), tl(` {0}（{1}）`, WEAPON_LABELS[lo.weapon], b.avatar.weapon === 'auto' ? (b.tools.length ? tl('最も高いツール') : tl('ツールなし')) : tl('指定'))), h('li', {}, h('b', {}, tl('背中')), ` ${backWeapons(lo).map((w) => WEAPON_LABELS[w]).join(tl('・')) || tl('なし')}`), h('li', {}, h('b', {}, tl('技の系統')), tl(` {0}（体型で決まる）`, STYLE_LABEL[BODY_STYLE[b.avatar.body]])));
        const ready = valid && !demoMode && !!me && me.entered;
        submitBtn.disabled = demoMode || !valid || (ready && me.remainingToday <= 0);
        trialBtn.disabled = demoMode || !valid || (ready && me.trialsLeft <= 0);
        const est = estimateSubmitCost(b, season.task.caseCount);
        const yen = (u) => Math.max(1, Math.round(u * 150));
        runCostEl.textContent = tl(`1回の送り出しの費用の目安: 約{0}〜{1}円（道具を必要なときだけ使うか、毎回使うかで変わります）`, yen(est.low), yen(est.high));
    };
    const tokenNote = (text, free) => {
        const t = estimateTokens(text);
        const over = free !== undefined && t > free ? tl(`（{0}トークンを超えた分はコスト加算）`, free) : '';
        return tl(`約{0}トークン{1}`, t.toLocaleString(), over);
    };
    const field = (label, input, note) => h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), input, note ? (typeof note === 'string' ? h('span', { class: 'field-note' }, note) : note) : null);
    const text = (value, on, opts = {}) => {
        const el = h('input', { value, placeholder: opts.placeholder ?? '', maxlength: opts.maxlength ?? 200 });
        el.oninput = () => { on(el.value); refresh(); };
        return el;
    };
    const area = (value, on, opts = {}) => {
        const noteText = (v) => opts.maxChars ? tl(`{0} / {1}字・{2}`, [...v].length, opts.maxChars, tokenNote(v, opts.free)) : tokenNote(v, opts.free);
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
        const main = area(b.main.prompt, (v) => { b.main.prompt = v; }, { rows: 13, maxChars: R.mainMaxChars || undefined, placeholder: tl('冒険者に毎回伝えておきたいことを書きます。ここがいちばん差がつくところです。') });
        // 書き方のコツ（折りたたみ）: 一般的なシステムプロンプトの組み立て方を、この順に
        const tips = h('details', { class: 'prompt-tips' }, h('summary', {}, tl('心得の書き方のコツ')), h('ol', { class: 'small' }, h('li', {}, h('b', {}, tl('役割を最初に')), tl('：だれとして、何のために戦うのかを1行で。')), h('li', {}, h('b', {}, tl('ふるまい')), tl('：どんな場面で、どう動くか。')), h('li', {}, h('b', {}, tl('道具の使い方')), tl('：持たせた道具ごとに「いつ・何のために使うか」。書いていないと、持っていても使い忘れたり、要らない場面で使ったりします。')), h('li', {}, h('b', {}, tl('守ること')), tl('：答えを外さないための約束ごと。「行動名は教わった名前から選ぶ」「分からないときは推測せず確かめる」など。偽の命令（幻術）への備えは、心得ではなく結界の役目です。')), h('li', {}, h('b', {}, tl('答え方')), tl('：答えの形。説明を書かせないと、速く・安くなります。'))), h('p', { class: 'small muted' }, tl('〇〇・△△・□□は、自分で書き換える場所です。使わない行は消してかまいません。見出し（# の行）は残しておくと、あとで直しやすくなります。')), h('button', { class: 'btn btn-small', onclick: () => {
                if (!armed('tmplArmed', tl('もう一度押すと、いまの心得を書き方の型で置き換えます')))
                    return;
                b.main.prompt = MAIN_PROMPT_TEMPLATE;
                renderForm();
                refresh();
            } }, tl('書き方の型を入れ直す')));
        const mainCard = h('section', { class: 'card' }, h('h3', {}, tl('2. 心得'), h('span', { class: 'ai-term' }, tl('システムプロンプト'))), h('p', { class: 'small muted' }, tl(`冒険者が毎回思い出す教え。{0}{1}トークンごとに重さ1。長いほど燃費も悪くなります。`, R.mainMaxChars ? tl(`{0}字まで、`, R.mainMaxChars) : '', R.mainTokensPerPoint)), tips, main.el, main.note);
        // 3. ツール
        const toolCards = toolOrder.map((t) => {
            const on = b.tools.includes(t.id);
            const full = !on && b.tools.length >= R.maxTools;
            const cb = h('input', { type: 'checkbox', checked: on, disabled: full });
            cb.onchange = () => {
                if (cb.checked)
                    b.tools.push(t.id);
                else {
                    b.tools = b.tools.filter((x) => x !== t.id);
                    delete b.gear[t.id];
                }
                renderForm();
                refresh();
            };
            const g = b.gear[t.id] ?? {};
            const wk = g.weapon ?? t.weapon;
            const look = on ? lookPicker(WEAPON_KINDS, WEAPON_LABELS, { kind: wk, color: g.color ?? '' }, (k, c) => weaponSprite(k, c || undefined), (k, c) => { b.gear[t.id] = { weapon: k, color: c }; }) : null;
            return h('div', { class: 'tool-card' + (on ? ' on' : '') + (full ? ' full' : '') }, h('label', { class: 'tool-head' }, cb, h('b', {}, t.name), h('span', { class: 'tool-cost' }, tl(`重さ {0}`, t.cost))), h('p', { class: 'small' }, brief?.toolNotes[t.id] ?? t.description), look);
        });
        const toolCard = h('section', { class: 'card' }, h('h3', {}, tl('3. 道具'), h('span', { class: 'ai-term' }, tl('ツール')), R.maxTools < 99 ? h('span', { class: 'slot-count' }, `${b.tools.length} / ${R.maxTools}`) : null), h('p', { class: 'small muted' }, tl('持たせた道具は、冒険者が自分の判断で使います。持っているだけで重く、使えば時間とトークンも増えます。')), h('div', { class: 'gm-tip' }, h('span', { class: 'gm-tip-who' }, tl('ギルドマスターの助言')), h('p', {}, tl('道具は、持たせるだけでは使われんぞ！　いつ・何のために使うかを、心得の「道具の使い方」に書いておけ。書いておかんと、肝心な場面で使い忘れたり、要らん場面で使って時間とトークンを無駄にしたりする。'))), h('div', { class: 'tool-grid' }, ...toolCards));
        // お供（見た目だけ）
        const petOn = h('input', { type: 'checkbox', checked: !!b.avatar.pet });
        petOn.onchange = () => {
            if (petOn.checked)
                b.avatar.pet = { kind: FAMILIAR_KINDS[0], color: DEFAULT_FAMILIAR_COLORS[0] };
            else
                delete b.avatar.pet;
            renderForm();
            refresh();
        };
        const petPicker = b.avatar.pet
            ? lookPicker(FAMILIAR_KINDS, FAMILIAR_LABELS, { kind: b.avatar.pet.kind, color: b.avatar.pet.color || DEFAULT_FAMILIAR_COLORS[0] }, (k, c) => familiarSprite(k, c, 0), (k, c) => { b.avatar.pet = { kind: k, color: c }; })
            : null;
        basics.append(h('div', { class: 'field' }, h('span', { class: 'field-label' }, tl('見た目（強さには影響しません）')), h('div', { class: 'body-picker' }, ...bodyBtns), patternRow, h('div', { class: 'color-row' }, h('label', {}, tl('服 '), palIn), h('label', {}, tl('髪・毛 '), hairIn), h('label', {}, tl('手に持つ武器 '), weaponSel))), h('div', { class: 'field' }, h('label', { class: 'chk' }, petOn, tl('お供を連れていく（見た目だけ・重さなし）')), petPicker));
        // 4. スキル
        const skCards = b.skills.map((s, i) => {
            const c = area(s.content, (v) => { s.content = v; }, { rows: 4, free: R.skillFreeTokens, placeholder: tl('ルール集・手順・判断基準など。必要なときだけ読まれます') });
            const look = lookPicker(CHARM_KINDS, CHARM_LABELS, skillLook(lo, i), (k, col) => charmSprite(k, col), (k, col) => { s.look = { kind: k, color: col }; }, 4);
            return h('div', { class: 'sub-card' }, h('div', { class: 'row-between' }, field(tl('名前'), text(s.name, (v) => { s.name = v; }, { maxlength: 30 })), h('button', { class: 'btn btn-small', onclick: () => { b.skills.splice(i, 1); renderForm(); refresh(); } }, tl('外す'))), field(tl('発動条件（いつ読むか）'), text(s.description, (v) => { s.description = v; }, { placeholder: tl('例: 敵が呪文を唱えたときに読む') })), field(tl('中身'), c.el, c.note), h('div', { class: 'field' }, h('span', { class: 'field-label' }, tl('見た目')), look));
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
                b.skills.push({ name: tl(`スキル{0}`, n + 1), description: '', content: '', look: { kind: 'gem', color: DEFAULT_CHARM_COLORS[n % 4] } });
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
        form.replaceChildren(basics, mainCard, toolCard, skCard, guardCard, adv);
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
        const after = (m) => { me = m; renderAccount(); refresh(); refreshSubs(); };
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
            accountEl.replaceChildren(accountBar(season, me, () => { me = null; renderAccount(); refresh(); refreshSubs(); }));
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
        subsEl.replaceChildren(h('h3', {}, tl('あなたが送り出した冒険者')), items.length ? h('ul', { class: 'sent-list' }, ...items.map((s) => h('li', {}, h('div', { class: 'row-between' }, h('b', {}, s.name), h('span', { class: s.status === 'done' ? 'ok' : 'muted' }, stateOf(s))), h('div', { class: 'small muted' }, tl(`{0}・重さ {1}{2}`, new Date(s.createdAt).toLocaleString(localeOf()), s.buildCost, s.costUsd ? tl(`・\${0}`, s.costUsd.toFixed(3)) : '')), s.status === 'done' ? h('div', { class: 'small row-gap' }, h('a', { href: `#/build/${s.id}` }, tl('ギルドマスターの講評 →')), h('a', { href: '#/arena/me' }, tl('討伐を見る →'))) : null))) : h('p', { class: 'muted' }, tl('まだ送り出していません。')));
        const busy = items.some((s) => s.status === 'queued' || s.status === 'grading');
        clearInterval(poll);
        if (busy)
            poll = setInterval(refreshSubs, 2000);
    };
    submitBtn.onclick = () => {
        if (!me || !me.entered) {
            showDock(tl('送り出すには'), accountEl);
            return;
        }
        if (!me)
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
        showDock(tl('送り出しの確認'), confirmEl);
        confirmEl.replaceChildren(h('p', {}, tl(`「{0}」を送り出します。今日の残り {1} 回のうち1回を使います。`, b.name, me.remainingToday)), h('p', { class: 'small muted' }, tl(`AI利用料の目安は約{0}〜{1}円（運営負担）。送り出す前に試走で確かめておくと安心です。`, yen(est.low), yen(est.high))), h('div', { class: 'row-gap' }, go, cancel));
    };
    // 試走: 公開サンプルだけを動かす。提出回数は使わない
    trialBtn.onclick = async () => {
        if (!me || !me.entered) {
            showDock(tl('試走するには'), accountEl);
            return;
        }
        showDock(tl('試走の結果'), trialEl);
        trialBtn.disabled = true;
        trialEl.replaceChildren(h('p', { class: 'muted' }, tl('試走中…（数秒〜十数秒かかります）')));
        try {
            const r = await runTrial(buildToYaml(b));
            me = r.user;
            renderAccount();
            trialEl.replaceChildren(trialView(r, season.task.caseCount));
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
    };
    const refBody = h('div', { class: 'ref-scroll' });
    const refTabs = h('div', { class: 'tabs ref-tabs', role: 'tablist' }, ...[['report', tl('討伐依頼書')], ['library', tl('資料室')]].map(([k, label]) => h('button', { class: 'tab', 'data-k': k, onclick: () => setRef(k) }, label)));
    const setRef = (k) => {
        refBody.replaceChildren(refPanes[k]);
        refBody.scrollTop = 0;
        refTabs.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.k === k));
    };
    const refCol = h('aside', { class: 'ref-col' }, refTabs, refBody);
    // 上: 出発の準備バー（見た目・荷物の重さ・試走・送り出し）
    const meterBtn = h('button', { class: 'dock-meter', title: tl('荷物の内訳を見る'), onclick: () => showDock(tl('荷物の内訳'), breakdown, runCostEl) }, h('span', { class: 'dock-label small' }, tl('荷物の重さ')), h('div', { class: 'meter' }, meterFill, meterText));
    const dock = h('div', { class: 'dock' }, h('div', { class: 'dock-bar' }, miniPreview, h('div', { class: 'dock-who' }, dockName, dockMe), meterBtn, dockErr, h('div', { class: 'dock-actions' }, trialBtn, submitBtn)), dockPanel);
    root.replaceChildren(...nodes(dock, panelTabs, page));
    page.replaceChildren(...nodes(refCol, h('section', { class: 'editor-col' }, h('div', { class: 'row-between' }, h('h2', {}, tl('冒険者の準備')), h('button', { class: 'btn btn-small', onclick: () => { if (confirmReset()) {
            b = parseBuild(BUILD_TEMPLATE, catalog).build;
            renderForm();
            refresh();
            syncLook();
        } } }, tl('はじめからやり直す'))), h('p', { class: 'small muted' }, tl(`心得・道具・巻物・結界を、荷物の重さ {0} までで準備して送り出します。左の討伐依頼書と資料室を見比べながら、何を持たせて送り出すかを決めてください。入力は自動で保存されます。`, R.limit)), form, h('section', { class: 'card sent-card' }, accountEl, subsEl))));
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
// 終わったら、討伐（自分の冒険者が出る）と講評へのボタンを出す
function battleWait(id, name, onDone) {
    const bar = h('div', { class: 'wait-fill' });
    const label = h('p', { class: 'wait-label' }, tl('出発の準備をしています…'));
    const actions = h('div', { class: 'row-gap wait-actions' });
    const note = h('p', { class: 'small muted' }, tl('本物のAIが、ボスの仕掛けにひとつずつ立ち向かっています。終わるまで数分かかります。この画面のままお待ちください。'));
    const box = h('div', { class: 'wait-box', role: 'dialog', 'aria-modal': 'true', 'aria-label': tl('冒険者が戦っています') }, h('p', { class: 'eyebrow' }, tl('送り出しました')), h('h2', {}, tl(`「{0}」が戦場へ向かっています`, name)), h('div', { class: 'wait-scene' }, h('span', { class: 'wait-hero' }, '🧙'), h('span', { class: 'wait-road' }), h('span', { class: 'wait-boss' }, '⚔')), h('div', { class: 'wait-bar' }, bar), label, note, actions);
    const overlay = h('div', { class: 'wait-overlay' }, box);
    document.body.append(overlay);
    document.body.dataset.locked = '1';
    const unload = (e) => { e.preventDefault(); };
    window.addEventListener('beforeunload', unload);
    const finish = () => { delete document.body.dataset.locked; window.removeEventListener('beforeunload', unload); };
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
            actions.replaceChildren(h('a', { class: 'btn btn-primary', href: '#/arena/me', onclick: () => overlay.remove() }, tl('討伐を見る（あなたの冒険者の活躍）')), h('a', { class: 'btn', href: `#/build/${id}`, onclick: () => overlay.remove() }, tl('ギルドマスターの講評')), h('button', { class: 'btn', onclick: () => overlay.remove() }, tl('準備画面に戻る')));
            return;
        }
        else {
            label.textContent = tl(`戦いの途中で問題が起きました: {0}`, s.error ?? '');
            finish();
            onDone();
            actions.replaceChildren(h('button', { class: 'btn', onclick: () => overlay.remove() }, tl('閉じる')));
            return;
        }
        setTimeout(tick, 1500);
    };
    tick();
}
function confirmReset() {
    return armed('resetArmed', tl('もう一度押すとテンプレートに戻します'));
}
// ブラウザのダイアログは使わず、2回押しで確定
function armed(k, msg) {
    const body = document.body;
    if (body.dataset[k]) {
        delete body.dataset[k];
        return true;
    }
    body.dataset[k] = '1';
    toast(msg);
    setTimeout(() => delete body.dataset[k], 3000);
    return false;
}
// 試走の結果表示: 答え・正誤・使った道具・トークン・費用、そして提出した場合の費用の見込み
function trialView(r, caseCount) {
    const yen = (u) => Math.max(1, Math.round(u * 150));
    const n = r.cases.length;
    const ok = r.cases.filter((c) => c.score >= 0.6).length;
    const per = r.totals.costUsd / Math.max(1, n);
    return h('div', {}, h('p', {}, h('b', {}, tl(`{0} / {1} 問 正解`, ok, n)), h('span', { class: 'muted small' }, tl(`　残りの試走 {0} 回`, r.user.trialsLeft))), h('ul', { class: 'trial-list' }, ...r.cases.map((c) => h('li', { class: c.score >= 0.6 ? 'trial-ok' : 'trial-ng' }, h('div', {}, h('b', {}, c.score >= 0.6 ? '○ ' : '× '), c.title), h('div', { class: 'small' }, tl(`答え: {0}`, c.answer)), c.score < 0.6 ? h('div', { class: 'small muted' }, tl(`正解: {0}`, Object.values(c.expected).join(' / '))) : null, h('div', { class: 'small muted' }, tl(`道具: {0}{1}　{2}トークン・{3}秒{4}`, c.tools.join(tl('・')) || tl('なし'), c.skills.length ? tl(`　スキル: {0}`, c.skills.join(tl('・'))) : '', (c.tokensIn + c.tokensOut).toLocaleString(), (c.latencyMs / 1000).toFixed(1), c.mpOut ? tl('　MP切れ') : '')), c.trace?.length ? h('details', { class: 'trial-trace', ...(c.score < 0.6 ? { open: true } : {}) }, h('summary', { class: 'small' }, tl('冒険の記録を見る')), traceView(c.trace)) : null))), h('p', { class: 'small muted' }, r.totals.costUsd > 0
        ? tl(`この試走の費用は約{0}円。全{1}回を送り出すと、約{2}円の見込みです。`, yen(r.totals.costUsd), caseCount, yen(per * caseCount))
        : tl('（モック採点のため費用は出ません）')));
}
//# sourceMappingURL=submit.js.map