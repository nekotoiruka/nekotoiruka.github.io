// サーバー API。サーバーがない（静的デモ）ときはデモデータで動く
import { simulateBattle } from '../shared/simulate.js';
import { caseTitleOf } from '../shared/types.js';
import { computeStats } from '../shared/stats.js';
import { getLang, tl } from '../shared/i18n.js';
export let demoMode = false;
let demoData = null;
// 紹介ページ用: サーバーの有無にかかわらず、同梱のデモ討伐データを読む
export function getDemoBattle() { return getDemo(); }
async function getDemo() {
    if (demoData)
        return demoData;
    if (window.__DEMO__)
        return (demoData = window.__DEMO__);
    if (window.__DEMOS__)
        return (demoData = window.__DEMOS__[getLang()] ?? window.__DEMOS__.ja);
    // 言語ごとのデモ（demo/battle.<lang>.json）。無ければ日本語のもの
    const l = getLang();
    const r = (l !== 'ja' && (await fetch(`demo/battle.${l}.json`).catch(() => null))) || null;
    return (demoData = await (r?.ok ? r : await fetch('demo/battle.json')).json());
}
async function req(method, path, body) {
    const r = await fetch(path, {
        method,
        headers: body ? { 'content-type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'same-origin',
    });
    const text = await r.text();
    let j = null;
    try {
        j = text ? JSON.parse(text) : null;
    }
    catch { /* JSON 以外 */ }
    if (!r.ok)
        throw new Error(j?.error ?? tl(`通信エラー ({0})`, r.status));
    return j;
}
export async function detectMode() {
    if (window.__DEMO__ || window.__DEMOS__) {
        demoMode = true;
        return;
    }
    try {
        const r = await fetch('api/health');
        demoMode = !r.ok;
    }
    catch {
        demoMode = true;
    }
}
export async function getSeason() {
    if (demoMode) {
        const d = await getDemo();
        const { TOOL_CATALOG, COST_RULES, applyCostRules } = await import('../shared/catalog.js');
        applyCostRules(d.task.costRules);
        // デモでも、そのシーズンで選べる道具だけを出す（昔の課題の道具は出さない）
        const ids = d.catalog;
        return {
            task: d.task, catalog: ids ? TOOL_CATALOG.filter((t) => ids.includes(t.id)) : TOOL_CATALOG, costRules: COST_RULES,
            seasonEnd: '', seasonOver: true, limits: { submissionsPerDay: 3, trialsPerDay: 3 }, provider: 'mock', authMode: 'passcode',
        };
    }
    const season = await req('GET', 'api/season');
    const { applyCostRules } = await import('../shared/catalog.js');
    applyCostRules(season.costRules);
    return season;
}
// season を渡すと、過去のシーズンの討伐（再生用）
export async function getBattle(season) {
    if (demoMode) {
        if (season)
            throw new Error(tl('デモ版には過去のシーズンはありません'));
        return getDemo();
    }
    return req('GET', season ? `api/battle?season=${encodeURIComponent(season)}` : 'api/battle');
}
// 過去のシーズンの一覧（新しい順）。デモ版には無い
export async function getPastSeasons() {
    if (demoMode)
        return [];
    return (await req('GET', 'api/seasons/history')).items;
}
// 参加者データから討伐の台本を作る（決定的なので何度作っても同じ）。ひとりでも討伐に出られる。
// viewer は見ている人（連携詠唱の結果だけが、その人が唱えられたかで変わる）
export function scriptFor(d, viewer) {
    if (!d.entrants.length)
        return null;
    return withTheme(simulateBattle(d.entrants, d.cases, `${d.seed}:${d.entrants.map((e) => e.id).join(',')}`, 'royale', undefined, { viewer: viewer ? [...viewer] : [] }), d);
}
// ボスの名前と色合い・場面の名前を、シーズンの募集要項から付ける
function withTheme(sc, d) {
    const boss = d.task?.briefing?.boss;
    if (!boss)
        return sc;
    sc.boss.name = boss.short ?? boss.name;
    sc.theme = { hue: boss.hue ?? 0, filter: boss.filter, kind: boss.kind, breath: boss.breath ?? 'fire', labels: boss.labels, counter: boss.counter, captions: boss.captions, title: boss.name };
    return sc;
}
export async function getMe() {
    if (demoMode)
        return null;
    return (await req('GET', 'api/me')).user;
}
export const login = (name, passcode) => req('POST', 'api/login', { name, passcode });
export const logout = () => req('POST', 'api/logout');
export const enterSeason = (team) => req('POST', 'api/entry', { team: team ?? '' });
export const runTrial = (yaml) => req('POST', 'api/trial', { yaml });
export const submitBuild = (yaml) => req('POST', 'api/submissions', { yaml });
export const mySubmissions = () => req('GET', 'api/submissions/mine');
export async function getBuild(id) {
    if (demoMode) {
        const d = await getDemo();
        const f = d.entrants.find((x) => x.id === id);
        if (!f)
            throw new Error(tl('見つかりません'));
        const meta = new Map(d.cases.map((c) => [c.id, c]));
        return {
            id: f.id, owner: f.owner, name: f.name, kodawari: f.kodawari, loadout: f.loadout, stats: computeStats(f.result, d.cases),
            status: 'done', createdAt: '', yaml: null,
            cases: f.result.cases.map((c) => ({ ...c, title: meta.has(c.caseId) ? caseTitleOf(meta.get(c.caseId), c.variant) : c.caseId, kind: meta.get(c.caseId)?.kind ?? 'normal', difficulty: meta.get(c.caseId)?.difficulty ?? 1 })),
            totals: null,
            diagnosis: f.diagnosis ?? null,
        };
    }
    return req('GET', `api/builds/${encodeURIComponent(id)}`);
}
//# sourceMappingURL=api.js.map