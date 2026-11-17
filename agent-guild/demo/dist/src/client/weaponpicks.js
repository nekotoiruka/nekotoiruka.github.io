import { counterFor } from './bossmoves.js';
import { CATEGORIES, HIT_AT, respOf } from './motionlab.js';
import { MOTION_PICKS } from './motionpicks.js';
import { fixedFighter } from './dodgepicks.js';
/** 紹介ページで見せる反撃（見本帳で選んだ順。「武器:型」）。空なら、攻撃の種類（斬る・突く・叩く・撃つ・魔法）がばらけるように自動で選ぶ */
export const WEAPON_PICKS = [];
/** 自動で選ぶときの数 */
export const WEAPON_AUTO_N = 6;
/** 自動で選ぶときの、見せたい武器の順（攻撃の種類がまじるように） */
const AUTO_ORDER = ['sword', 'bow', 'wand', 'spear', 'hammer', 'katana', 'blaster', 'scythe', 'book', 'axe', 'fan', 'umbrella', 'dagger', 'pan', 'guitar', 'shield'];
const BASE = ['breath', 'claw', 'dive', 'tail'];
/** 舞台にする回: 基本の4場面で、その冒険者が正しく動けて反撃した回。身のこなしが武器によらない回（伏せる・結界）を先に */
export function weaponStage(script, r) {
    const f = fixedFighter(script);
    const ok = script.waves.map((wv, i) => i).filter((i) => {
        const wv = script.waves[i];
        return BASE.includes(script.cases[wv.caseIndex]?.scene ?? '') && wv.events.some((e) => e.type === 'strike' && e.f === f && e.success)
            && wv.events.some((e) => e.type === 'attack' && e.f === f) && !wv.events.some((e) => e.type === 'bossDown');
    });
    const common = ok.find((i) => { const co = counterFor(script.theme?.kind, r.respScene(i)), resp = co ? respOf(co.evade, co.fx) : null; return resp === 'crawl' || resp === 'barrier'; });
    return { w: common ?? ok[0] ?? 0, f };
}
const CAT_ORDER = ['slash', 'thrust', 'blunt', 'shoot', 'magic'];
const catRank = (wk) => CAT_ORDER.indexOf(CATEGORIES.find((c) => c.group === '通常攻撃' && c.weapons?.includes(wk))?.id ?? '');
/** 武器 × 反撃の型の候補を全部（攻撃の種類の順）（見本帳で武器ごとに選んだ型。2つある武器は2つとも） */
export function weaponCands(script, r, weapons) {
    const { w, f } = weaponStage(script, r);
    const out = [];
    for (const wk of [...weapons].sort((a, b) => catRank(a) - catRank(b))) {
        const cat = CATEGORIES.find((c) => c.group === '通常攻撃' && c.weapons?.includes(wk));
        if (!cat)
            continue;
        const ids = MOTION_PICKS[cat.id]?.[wk] ?? [];
        const pats = (ids.length ? ids.map((id) => cat.patterns.find((p) => p.id === id)) : [cat.patterns[0]]).filter((p) => !!p);
        for (const p of pats)
            out.push({ key: `${wk}:${p.id}`, weapon: wk, cat: cat.id, pattern: p, name: p.name, w, f });
    }
    return out;
}
/** 武器と反撃の型を差し替えて、ボスの攻撃の演出を消す。もとにもどす関数を返す */
export function applyWeapon(r, c) {
    const look = r.looks[c.f];
    const keep = { weapon: look.weapon, pick: r.attackPick, show: r.showcase };
    look.weapon = c.weapon;
    r.attackPick = (w, f) => (w === c.w && f === c.f ? c.pattern : undefined);
    r.showcase = true;
    const clear = () => { for (const m of [r.retimed, r.cueCache, r.stopCache, r.planCache, r.spotCache])
        m.clear(); };
    clear();
    return () => { look.weapon = keep.weapon; r.attackPick = keep.pick; r.showcase = keep.show; clear(); };
}
/** 区間: 反撃の型が動きはじめる少し前から、当たってダメージの数字が出るまで（討伐画面と同じ反撃の時刻。arena.ts の dodgeRetimed）。
 *  applyWeapon をしたあとに呼ぶ */
export function weaponWindow(r, c) {
    const at = r.wave(c.w).events.find((e) => e.type === 'attack' && e.f === c.f);
    const t = at?.t ?? 0.7;
    const lead = ((HIT_AT[c.pattern.id] ?? 0.42) - 0.02) / 3;
    return { from: t - lead - 0.04, to: Math.min(0.99, t + 0.09) };
}
/** カメラ: 冒険者とボスの両方が入る所に止める（反撃の動きで画面が動かない。近接の踏みこみも、飛び道具の行き先も入る） */
export function weaponShot(r, f) {
    const v = r.script.fighters[f].slot, b = r.bossBody;
    return { mode: 'shot', x: Math.round((v.x + b.x) / 2 + 4), y: Math.round((v.y + b.y) / 2 - 14), z: 1.15 };
}
/** 見せる反撃: 選んだものがあればその順、なければ攻撃の種類と型がばらけるように（初期値は 剣・弓・杖・槍・ハンマー・刀の居合） */
export function weaponOrder(cands, picks = WEAPON_PICKS, n = WEAPON_AUTO_N) {
    if (picks.length)
        return picks.map((k) => cands.find((c) => c.key === k)).filter((c) => !!c);
    const out = [];
    const cats = new Map();
    for (let round = 0; out.length < n && round < 3; round++) {
        for (const wk of AUTO_ORDER) {
            if (out.length >= n)
                break;
            const c = cands.find((x) => x.weapon === wk && !out.some((o) => o.pattern.id === x.pattern.id)); // 同じ型は並べない
            if (!c || out.some((x) => x.weapon === wk) || (cats.get(c.cat) ?? 0) > round)
                continue;
            cats.set(c.cat, (cats.get(c.cat) ?? 0) + 1);
            out.push(c);
        }
    }
    return out;
}
//# sourceMappingURL=weaponpicks.js.map