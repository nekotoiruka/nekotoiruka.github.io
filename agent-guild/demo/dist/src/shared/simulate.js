// 採点結果 → ボス戦の台本（決定的）。
// 全員で1体の大型ボスに挑む。1テストケース = 1ウェーブ。
//   1. ボスが問題（＝攻撃）を出す。討伐では攻撃は全員に向かう（チーム対抗・1対1では、攻撃の種類で狙われる隊列が決まる）
//   2. 各キャラが回答する（速い順に ○ / ×）。狙われたキャラは、正解なら回避、不正解なら被弾
//   3. 正解したキャラはボスに反撃する（チーム対抗・1対1では前衛ほど大ダメージ）。ツール・スキル・仲間の演出はここで出る
//   4. 後半はボスが怒り、燃費（行動力）の悪いキャラほど余波で削られる
// 最後まで立っていた人が勝ち。ボスを倒した場合は、生き残りの中で与ダメージが多い順。
import { Rng } from './rng.js';
import { computeStats, MP_BUDGET_PER_CASE, weightedAccuracy } from './stats.js';
import { caseTitleOf } from './types.js';
import { perLang, tl } from './i18n.js';
export const ARENA = { w: 384, h: 216 };
const MAX_HP = 100;
// ボスの大技の場面（巻物が要る大技）。client/scenes.ts の ULT_SCENES と同じ
const ULT_SCENE_SET = new Set(['ougi', 'rush', 'summon', 'parry', 'seal', 'awaken']);
export const ATTACKS = perLang(() => ({
    claw: { name: tl('ひっかき'), rows: { front: 1.15 } },
    breath: { name: tl('火炎ブレス'), rows: { front: 1, mid: 0.85 } },
    tail: { name: tl('尾のなぎはらい'), rows: { front: 0.7, mid: 0.7, back: 0.7 } },
    meteor: { name: tl('隕石落とし'), rows: { back: 1.3, mid: 0.6 } },
    nova: { name: tl('全体爆発'), rows: { front: 1, mid: 1, back: 1 } },
    treasure: { name: tl('宝箱を落とした'), rows: {} },
}));
// 討伐には隊列がない。ボスの攻撃は、いつも討伐隊の全員に向かう（正しく動けた人はかわし、間違えた人は受ける）。
// 強さは攻撃の種類ごとに一つ（隊列ごとの強さの平均）
export function attackRows(attack) {
    const rows = ATTACKS[attack].rows;
    if (attack === 'treasure')
        return rows;
    const v = Object.values(rows);
    const m = Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100;
    return { front: m, mid: m, back: m };
}
const DMG_SCALE = 11; // ダメージの桁（見た目の手応え）
const SKILL_DMG = 4; // 必殺技（巻物が要る場面）の倍率
const CHAIN_MUL = 3;
export const RAID_PARTY = 12; // 討伐隊の人数（自分＋最大11人）
const RAID_CLEAR = 0.65; // 12人がそれぞれ8割ほど正しく動ければ倒しきれる（外しやすいのは与ダメの大きい大技の場面なので、与ダメでは全問正解の6〜7割ほどになる）
const ULT_HIT = 2; // 討伐: ボスの大技（巻物が要る場面）を外したときの被ダメージの倍率（倒れることがある） // 連携詠唱の大魔法: 参加者全員が巻物の必殺技を当てたときの合計の何倍か
const CHAIN_FIZZLE = 0.25; // 詠唱が途切れたとき（あなたが外した）: 正解者の力の合計 × この倍率（大魔法の1割に満たない）
// ---- 連携詠唱（scene 'chain'）----
// 時間の割り振り（ウェーブ内の進行度）。一列に並ぶ → 一節ずつ唱える → 大魔法が落ちる（失敗なら、そのあと総攻撃）
export const CHAIN_T = { gather: 0.03, lined: 0.13, start: 0.15, chant: 0.455, impact: 0.7, rally: 0.8 };
export const isChainCase = (c) => c?.scene === 'chain';
export const chainLen = (c) => c?.chant?.length || 7;
// 誰が何節を唱えるか。唱えるのは、大呪を最後まで唱えられた（正解した）人だけ。
//   parts: 唱える人（正解した人。見ている人が外していれば、その人も）/ ok: 正解した人 / mine: 見ている人（あなた）
//   mineUpto: あなたが外したとき、先頭から何節まで正しく言えたか（その次の節で詰まる）
//   visible: 舞台に立っている人（8人以上から選ぶとき、舞台の人を先に選ぶ）
// あなたが正解: ほかの正解者が交互に第1〜6節、あなたが最後の第7節（ほかにいなければ1人で7節）→ 大魔法
// あなたが外した: 正解者と交互に唱え、あなたは詰まった節を受け持ってそこで途切れる（1人なら、詰まる節まで1人で）
// あなたがいない: 正解者が交互に唱えて最後まで
export function chainOrder(parts, ok, len, opts = {}) {
    const okSet = new Set(ok);
    const vis = opts.visible ?? (() => true);
    const all = [...new Set(parts)].sort((a, b) => a - b);
    const mineSet = new Set(opts.mine ?? []);
    const mineIn = all.filter((f) => mineSet.has(f));
    const me = mineIn.find(vis) ?? mineIn[0];
    const meOk = me !== undefined && okSet.has(me);
    const others = all.filter((f) => f !== me && okSet.has(f)).sort((a, b) => Number(vis(b)) - Number(vis(a)) || a - b);
    const sel = others.slice(0, Math.max(0, me !== undefined ? len - 1 : len));
    const fail = me !== undefined && !meOk ? Math.max(0, Math.min(len - 1, Math.floor(opts.mineUpto ?? 0))) : -1;
    const myVerse = me === undefined ? -1 : meOk ? len - 1 : fail;
    const chanters = [];
    let k = 0;
    for (let i = 0; i < len; i++) {
        if (me !== undefined && (i === myVerse || !sel.length))
            chanters.push(me);
        else if (sel.length)
            chanters.push(sel[k++ % sel.length]);
    }
    const order = me !== undefined ? [...sel, me] : sel;
    const upto = fail >= 0 ? fail : chanters.length === len && chanters.every((f) => okSet.has(f)) ? len : 0;
    return { order, chanters, upto };
}
const round1 = (v) => Math.round(v * 10) / 10;
const round2 = (v) => Math.round(v * 100) / 100;
// 採点結果に記録された、抽選で引いた番号（ほかの人の分はネタバレ防止で消えていることがある）
function variantsOf(e) {
    const v = Object.fromEntries(e.result.cases.filter((c) => typeof c.variant === 'number').map((c) => [c.caseId, c.variant]));
    return Object.keys(v).length ? { variants: v } : {};
}
// 討伐の画面で見せる場面の見出し: 抽選で変わる場面は、その画面の「あなた」（mine）の冒険者が引いた見出し。
// あなたがいない・引いた番号が無いときは、場面の一般的な見出しのまま
export function waveTitleFor(cm, fighters, mine) {
    for (const f of mine) {
        const v = fighters[f]?.variants?.[cm.id];
        if (v !== undefined)
            return caseTitleOf(cm, v);
    }
    return cm.title;
}
// 場面の順番: 難しさ順。ただし連携詠唱（scene 'chain'）は討伐の締めくくりなので、必ず最後に回す
export function orderCases(cases) {
    return cases.map((c, i) => ({ c, i }))
        .sort((a, b) => Number(isChainCase(a.c)) - Number(isChainCase(b.c)) || a.c.difficulty - b.c.difficulty || a.i - b.i)
        .map((x) => x.c);
}
const accuracyOf = (e) => weightedAccuracy(e.result.cases);
// 立ち位置: ボスは左、冒険者は中央から右へ3列に並ぶ（見た目だけ。隊列による差はない）
export const BOSS_POS = { x: 74, y: 150 };
const ROW_X = { front: 178, mid: 248, back: 318 };
export function layout(rows) {
    const out = rows.map(() => ({ x: 0, y: 0 }));
    for (const r of ['front', 'mid', 'back']) {
        const ids = rows.map((x, i) => (x === r ? i : -1)).filter((i) => i >= 0);
        const m = ids.length;
        // 多いときは2列に互い違いに並べる
        const cols = m > 4 ? 2 : 1;
        const perCol = Math.ceil(m / cols);
        const gap = Math.min(30, 96 / Math.max(1, perCol - 1));
        ids.forEach((f, k) => {
            const c = cols === 2 ? k % 2 : 0;
            const j = cols === 2 ? Math.floor(k / 2) : k;
            out[f] = { x: ROW_X[r] + (cols === 2 ? (c ? 14 : -14) : 0), y: 146 + (j - (perCol - 1) / 2) * gap + (cols === 2 && c ? gap / 2 - gap / 4 : -(cols === 2 ? gap / 4 : 0)) };
        });
    }
    return out;
}
// 攻撃の種類: ケースの種類で決まる（通常はウェーブごとに乱数）
function attackFor(cm, rng) {
    if (cm.attack)
        return cm.attack;
    if (cm.kind === 'trap')
        return 'meteor';
    if (cm.kind === 'boss')
        return 'nova';
    if (cm.kind === 'bonus')
        return 'treasure';
    return rng.pick(['claw', 'breath', 'tail']);
}
export function simulateBattle(entrants, casesIn, seed, mode = 'royale', bossHpOverride, opts = {}) {
    const cases = orderCases(casesIn);
    const n = entrants.length;
    const viewerSet = new Set(opts.viewer ?? []); // 見ている人（連携詠唱の結果だけが変わる）
    // 隊列は選ばない。立ち位置は見た目のために自動で散らす
    const rows = entrants.map((_, i) => ['front', 'mid', 'back'][i % 3]);
    const slots = layout(rows);
    const fighters = entrants.map((e, i) => ({
        id: e.id, name: e.name, owner: e.owner, kodawari: e.kodawari, loadout: e.loadout,
        stats: computeStats(e.result, casesIn), row: rows[i], slot: slots[i],
        ...variantsOf(e),
    }));
    const resultMap = entrants.map((e) => new Map(e.result.cases.map((c) => [c.caseId, c])));
    const getRes = (f, caseId) => resultMap[f].get(caseId) ?? { caseId, score: 0, runs: [0], tokensIn: 0, tokensOut: 0, latencyMs: 30000, excerpt: tl('（回答なし）'), mpOut: true, toolCalls: 0 };
    // 古い採点結果には used がないので、装備から推定する
    const usedOf = (f, r) => r.used ?? {
        tools: [...fighters[f].loadout.tools], skills: [],
    };
    // 反撃のダメージ（正解したときだけ）
    // 通常の反撃でおよそ100、会心で150、巻物が要る場面（必殺技）で500くらい
    const attackDmg = (f, score) => DMG_SCALE * (4 + 6 * score) * (0.6 + fighters[f].stats.atk / 125) * (0.85 + fighters[f].stats.spd / 400);
    // 討伐: 12人の討伐隊が、それぞれ8割ほど正しく動ければ倒しきれる体力（人数が足りない・正解が少ないと倒しきれない）。
    // 一人ぶんの力は、いまの討伐隊の平均（全問に正しく動けたときの与ダメージ。連携詠唱の大魔法も入れる）
    const fullPot = (f) => cases.reduce((b, c) => b + (isChainCase(c) ? attackDmg(f, 1) * SKILL_DMG * CHAIN_MUL : attackDmg(f, 1) * (c.keySkill ? SKILL_DMG : 1)), 0);
    const raidHp = () => Math.round((fighters.reduce((a, _, f) => a + fullPot(f), 0) / Math.max(1, n)) * RAID_PARTY * RAID_CLEAR);
    const bossMax = bossHpOverride ?? Math.max(60, raidHp());
    let bossHp = bossMax;
    const hp = new Array(n).fill(MAX_HP);
    const shield = new Array(n).fill(0);
    const alive = new Array(n).fill(true);
    const endured = new Array(n).fill(false);
    const st = fighters.map(() => ({ dmg: 0, evades: 0, hits: 0, items: 0, mvp: 0 }));
    const living = () => fighters.map((_, f) => f).filter((f) => alive[f]);
    const waves = [];
    for (let w = 0; w < cases.length; w++) {
        const cm = cases[w];
        const wr = new Rng(`${seed}:${mode}:w${w}`);
        const attack = attackFor(cm, wr);
        const events = [];
        const res = fighters.map((_, f) => getRes(f, cm.id));
        const last = w === cases.length - 1;
        events.push({ type: 'bossAttack', t: 0.36, attack });
        const ultWave = ULT_SCENE_SET.has(cm.scene ?? '');
        const kill = (f, t, cause) => {
            if (!alive[f])
                return;
            // ふつうの攻撃では倒れない（HP1で踏みとどまる。表示は最初の1回だけ）。
            // ボスの大技を外したときだけ倒れる。倒れても、あとで正しく動けた場面で起き上がる（戦果・順位には関係しない）
            if (!(ultWave && cause === 'boss')) {
                hp[f] = 1;
                if (!endured[f])
                    events.push({ type: 'endure', t: round2(t), f });
                endured[f] = true;
                return;
            }
            alive[f] = false;
            hp[f] = 0;
            events.push({ type: 'death', t: round2(t), f, cause });
        };
        const damage = (f, raw) => {
            const absorbed = Math.min(shield[f], raw);
            shield[f] -= absorbed;
            const dmg = raw - absorbed;
            hp[f] = Math.max(0, hp[f] - dmg);
            return { dmg: round1(dmg), absorbed: round1(absorbed) };
        };
        // 0. 倒れていた人は、この場面で正しく動ければ起き上がって戦いに戻る（答えは倒れていても出している）
        for (const f of fighters.map((_, i) => i)) {
            if (alive[f])
                continue;
            const r = res[f];
            if (r.mpOut || r.score < 0.6)
                continue;
            alive[f] = true;
            hp[f] = Math.round(MAX_HP * 0.5);
            events.push({ type: 'revive', t: 0.06, f });
        }
        // 1. 回答（速い順に ○ / ×）
        const order = living().sort((a, b) => res[a].latencyMs - res[b].latencyMs || a - b);
        const ok = new Set();
        const over = new Set();
        const rowMul = attackRows(attack);
        order.forEach((f, k) => {
            const r = res[f];
            const t = round2(0.08 + 0.22 * (k / Math.max(1, order.length)));
            const s = r.mpOut ? 0 : r.score;
            const success = s >= 0.6;
            const targeted = rowMul[fighters[f].row] !== undefined;
            events.push({ type: 'strike', t, f, success, score: round2(s), excerpt: r.excerpt.slice(0, 60), used: usedOf(f, r), targeted, ...(r.charmed ? { charmed: true } : {}), ...(r.haunted ? { haunted: true } : {}) });
            if (success)
                ok.add(f);
            if (r.mpOut || r.tokensIn + r.tokensOut - (r.companionTokens ?? 0) > MP_BUDGET_PER_CASE) {
                over.add(f); // お供（サブエージェント）の分は、冒険者の 行動力 に数えない
                events.push({ type: 'mpOut', t: round2(t + 0.02), f });
            }
        });
        // 連携詠唱の場面: ボスは大技を溜めているだけで、ふつうの攻撃も反撃もない（詠唱の成否で決まる）
        const chainWave = isChainCase(cm);
        // 2. ボスの攻撃: 狙われた隊列は、正解なら回避、不正解なら被弾
        const base = 10 + 7 * cm.difficulty;
        for (const f of chainWave ? [] : order) {
            const m = rowMul[fighters[f].row];
            if (attack === 'treasure') {
                if (!ok.has(f))
                    continue;
                st[f].items++;
                if (hp[f] < 70) {
                    const amount = Math.min(25, MAX_HP - hp[f]);
                    hp[f] += amount;
                    events.push({ type: 'item', t: 0.44, f, item: 'potion', amount: round1(amount) });
                }
                else {
                    shield[f] += 15;
                    events.push({ type: 'item', t: 0.44, f, item: 'shield', amount: 15 });
                }
                continue;
            }
            if (m === undefined)
                continue;
            const s = res[f].mpOut ? 0 : res[f].score;
            if (ok.has(f) && !over.has(f)) {
                st[f].evades++;
                events.push({ type: 'evade', t: 0.42, f });
                continue;
            }
            const raw = (base * m * (1 - s * 0.6) * (1 - fighters[f].stats.def / 250) + (over.has(f) ? 3 : 0)) * (ultWave ? ULT_HIT : 1);
            const { dmg, absorbed } = damage(f, raw);
            st[f].hits++;
            events.push({ type: 'hit', t: 0.42, f, dmg, absorbed });
            if (hp[f] <= 0)
                kill(f, 0.46, over.has(f) && ok.has(f) ? 'mp' : 'boss');
        }
        // 3'. 連携詠唱: 大呪を最後まで唱えられた人（正解者）だけで、一節ずつ唱える。
        //     見ている人（あなた）が外していれば、あなたの番で途切れて大魔法は正しく発動しない（小さなダメージ）。
        //     そのため、この場面の結果は見る人によって変わる（ほかの場面・順位は変わらない）
        let chainDone = false;
        if (chainWave && bossHp > 0) {
            const alive0 = living().sort((a, b) => a - b);
            const okParts = alive0.filter((f) => ok.has(f));
            const vw = alive0.find((f) => viewerSet.has(entrants[f].id));
            const vWrong = vw !== undefined && !ok.has(vw);
            const parts = vWrong ? [...okParts, vw].sort((a, b) => a - b) : okParts;
            const full = okParts.length > 0 && !vWrong;
            const base1 = (f) => attackDmg(f, 1) * SKILL_DMG;
            const pot = okParts.reduce((a, f) => a + base1(f), 0);
            const raw = full ? pot * CHAIN_MUL : pot * CHAIN_FIZZLE;
            // 討伐: 大魔法が決まればそのまま倒れる。途切れたときはボスは踏みとどまり（体力1）、このあと総攻撃でとどめ
            const floor = !last || !full ? 1 : 0;
            const dmg = round1(raw);
            bossHp = Math.max(floor, bossHp - dmg);
            const okPot = pot || 1;
            const credit = okParts.map((f) => ({ f, dmg: round1((dmg * base1(f)) / okPot) }));
            for (const c of credit)
                st[c.f].dmg += c.dmg;
            const len = chainLen(cm);
            const viewerUpto = vWrong ? (res[vw].chainUpto ?? 0) : undefined;
            const def = chainOrder(parts, okParts, len, { mine: vw !== undefined ? [vw] : [], mineUpto: viewerUpto });
            events.push({ type: 'chain', t: CHAIN_T.impact, len, parts, ok: okParts, full, dmg, order: def.order, chanters: def.chanters, upto: def.upto, credit, ...(vw !== undefined ? { viewer: vw } : {}), ...(viewerUpto !== undefined ? { viewerUpto } : {}) });
            if (bossHp <= 0)
                events.push({ type: 'bossDown', t: round2(CHAIN_T.impact + 0.04) });
            chainDone = true;
        }
        // 3. 反撃（正解したキャラが速い順に）
        const attackers = chainDone || chainWave ? [] : order.filter((f) => alive[f] && ok.has(f) && !over.has(f));
        let topDmg = -1, mvp = -1;
        attackers.forEach((f, k) => {
            if (bossHp <= 0)
                return;
            const t = round2(0.52 + 0.3 * (k / Math.max(1, attackers.length)));
            const s = res[f].score;
            const crit = s >= 0.99 && k < Math.ceil(attackers.length / 3);
            const full = attackDmg(f, s) * (crit ? 1.5 : 1) * ((res[f].weight ?? 1) > 1 ? SKILL_DMG : 1); // 巻物が要る場面は必殺技なので重い
            // 最後の仕掛けまでボスは倒れない（体力1で踏みとどまる）。数字は削った分ではなく、技の威力をそのまま見せる
            const floor = last ? 0 : 1;
            const dmg = round1(full);
            bossHp = Math.max(floor, bossHp - dmg);
            st[f].dmg += dmg;
            events.push({ type: 'attack', t, f, dmg, crit });
            if (dmg > topDmg) {
                topDmg = dmg;
                mvp = f;
            }
            if (bossHp <= 0)
                events.push({ type: 'bossDown', t: round2(t + 0.04) });
        });
        // 討伐の最後の仕掛けで、体力1で踏みとどまっていたボスに反撃が入らなかったときは、
        // 生き残った冒険者が総攻撃でとどめを刺す（演出のみ。与ダメージの集計には入れない）
        if (last && bossHp > 0 && bossHp <= 1) {
            const rest = order.filter((f) => alive[f]);
            let lastT = 0.86;
            // 連携詠唱が途切れたあとの総攻撃は、詠唱の演出が終わってから
            const [t0, span] = chainWave ? [CHAIN_T.rally, 0.1] : [0.52, 0.3];
            rest.forEach((f, k) => {
                lastT = round2(t0 + span * (k / Math.max(1, rest.length)));
                events.push({ type: 'attack', t: lastT, f, dmg: round1(attackDmg(f, 0.6)), crit: k === rest.length - 1 });
            });
            bossHp = 0;
            events.push({ type: 'bossDown', t: round2(lastT + 0.04) });
        }
        // 討伐の最後まで削りきれなかったときは、ボスが去っていく（討伐失敗）
        if (last && bossHp > 1)
            events.push({ type: 'bossEscape', t: 0.9, hpLeft: round2(bossHp / bossMax) });
        if (mvp >= 0) {
            st[mvp].mvp++;
            events.push({ type: 'mvp', t: 0.93, f: mvp });
        }
        if (last)
            events.push({ type: 'winner', t: 0.97, f: rankOrder()[0] ?? null });
        events.sort((x, y) => x.t - y.t);
        waves.push({ caseIndex: w, attack, events, hpAfter: hp.map(round1), shieldAfter: shield.map(round1), aliveAfter: [...alive], bossHpAfter: round1(bossHp) });
    }
    // 順位: 戦果（正答率）→ 燃費（トークンの少なさ）→ 速さ
    function rankOrder() {
        const acc = (f) => weightedAccuracy(cases.map((c) => getRes(f, c.id)));
        const tok = (f) => cases.reduce((a, c) => { const r = getRes(f, c.id); return a + r.tokensIn + r.tokensOut; }, 0);
        const lat = (f) => cases.reduce((a, c) => a + getRes(f, c.id).latencyMs, 0);
        return fighters.map((_, f) => f).sort((a, b) => acc(b) - acc(a) || tok(a) - tok(b) || lat(a) - lat(b) || a - b);
    }
    const totalScore = fighters.map((_, f) => weightedAccuracy(cases.map((c) => getRes(f, c.id))));
    const standings = rankOrder().map((f, k) => {
        const rs = cases.map((c) => getRes(f, c.id));
        const s = st[f];
        return {
            f, rank: k + 1, alive: alive[f],
            damageDealt: Math.round(s.dmg), evades: s.evades, hits: s.hits, items: s.items, mvp: s.mvp,
            accuracy: Math.round(totalScore[f] * 1000) / 10,
            avgTokens: Math.round(rs.reduce((a, r) => a + r.tokensIn + r.tokensOut, 0) / Math.max(1, rs.length)),
            avgLatencyMs: Math.round(rs.reduce((a, r) => a + r.latencyMs, 0) / Math.max(1, rs.length)),
        };
    });
    return {
        version: 3, mode, seed, arena: { ...ARENA }, boss: { name: tl('ドラゴン'), maxHp: bossMax, ...BOSS_POS },
        cases, fighters, waves, standings,
    };
}
//# sourceMappingURL=simulate.js.map