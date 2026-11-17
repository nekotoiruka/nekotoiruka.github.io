// 紹介ページ「必殺技」の窓で見せる大技の候補と選び方。
// 立ち位置は「見切り」の窓と同じ（dodgepicks.ts の fixedFighter: 後列の下から2番目）。その冒険者を主役（自分の冒険者）にして、
// 大技の場面（奥義・乱舞・召喚・返し技・封印・覚醒）と武器を差し替え、1人だけ舞台に立たせて見せる（ほかの冒険者・ボスの攻撃の演出は出さない）。
// どれを見せるかは、必殺技の見本帳（scripts/build-ultpicks.mjs）で選び、ULT_PICKS に書く。
import { ArenaRenderer } from './arena.js';
import { ULT_SCENES, ULT_T, ultHitT, ultNameT } from './scenes.js';
import { ultMove, MOVE_LABEL } from './ultmoves.js';
import { fixedFighter } from './dodgepicks.js';
/** 紹介ページで見せる大技（見本帳で選んだ順。「場面:武器」）。空なら、見た目が派手なものから、場面と武器がばらけるように自動で選ぶ */
export const ULT_PICKS = ['ougi:sword', 'ougi:spear', 'summon:book', 'parry:axe', 'parry:blaster', 'seal:guitar', 'awaken:katana'];
/** 窓で見せはじめる時刻（どの場面も、大技が動きだす 0.28〜0.3 の少し前から） */
const ULT_FROM = 0.24;
/** 自動で選ぶときの数 */
export const ULT_AUTO_N = 4;
/** 自動で選ぶときの順（見た目が派手なものから。「場面:武器」）。場面・武器・型が重ならないように、上から選ぶ */
const FLASHY = ['summon:blaster', 'rush:katana', 'awaken:wand', 'ougi:sword', 'seal:bow', 'seal:katana', 'summon:bow', 'parry:shield', 'awaken:book', 'rush:dagger', 'ougi:dagger', 'summon:fan'];
/** 舞台にする回: 主役が正しく動けて反撃した、大技の場面の回（ボスが倒れない回）。なければ、主役が正しく動けた回 */
export function ultStage(script) {
    const f = fixedFighter(script);
    const ok = (i) => {
        const wv = script.waves[i], prev = i > 0 ? script.waves[i - 1].aliveAfter[f] : true;
        return prev && wv.events.some((e) => e.type === 'strike' && e.f === f && e.success) && wv.events.some((e) => e.type === 'attack' && e.f === f) && !wv.events.some((e) => e.type === 'bossDown');
    };
    const idx = script.waves.map((_, i) => i);
    const w = idx.find((i) => ULT_SCENES.includes(script.cases[script.waves[i].caseIndex]?.scene ?? '') && ok(i)) ?? idx.find(ok) ?? 0;
    return { w, f };
}
/** 場面 × 武器の候補を全部（場面の順・武器の順） */
export function ultCands(script, weapons) {
    const { w, f } = ultStage(script);
    const out = [];
    for (const scene of ULT_SCENES) {
        for (const wk of weapons) {
            const move = ultMove(scene, wk);
            out.push({ key: `${scene}:${wk}`, scene, weapon: wk, move, label: MOVE_LABEL[move] ?? move, w, f, from: ULT_FROM, to: ULT_T[scene].home + 0.01 });
        }
    }
    return out;
}
/** 大技を描く準備: 主役の武器を差し替え、主役を自分の冒険者にし、舞台の回の場面を差し替え、ボスの攻撃の演出と字幕の帯を消す（showcase）。もとにもどす関数を返す */
export function applyUlt(r, c) {
    const look = r.looks[c.f];
    const keep = { weapon: look.weapon, mine: r.mine, show: r.showcase };
    const self = r;
    const orig = ArenaRenderer.prototype.sceneOf;
    look.weapon = c.weapon;
    r.mine = new Set([c.f]);
    r.showcase = true;
    self.sceneOf = (w) => (w === c.w ? c.scene : orig.call(r, w));
    const clear = () => { for (const m of [r.retimed, r.cueCache, r.stopCache, r.planCache, r.spotCache])
        m.clear(); };
    clear();
    return () => { look.weapon = keep.weapon; r.mine = keep.mine; r.showcase = keep.show; delete self.sceneOf; clear(); };
}
/** 見せる大技: 選んだものがあればその順、なければ派手な型から、場面と武器がばらけるように */
export function ultOrder(cands, picks = ULT_PICKS, n = ULT_AUTO_N) {
    if (picks.length)
        return picks.map((k) => cands.find((c) => c.key === k)).filter((c) => !!c);
    const rank = (c) => { const i = FLASHY.indexOf(c.key); return i < 0 ? FLASHY.length : i; };
    const sorted = cands.slice().sort((a, b) => rank(a) - rank(b));
    const out = [];
    const scenes = new Set(), weapons = new Set(), moves = new Set();
    for (const c of sorted) {
        if (out.length >= n)
            break;
        if (scenes.has(c.scene) || weapons.has(c.weapon) || moves.has(c.move))
            continue;
        scenes.add(c.scene);
        weapons.add(c.weapon);
        moves.add(c.move);
        out.push(c);
    }
    return out;
}
/** 見本帳の4コマの時刻（名乗り・溜め・当たる瞬間・余韻） */
export const ultFrames = (s) => { const n = ultNameT(s), hit = ultHitT(s); return [n + 0.03, (n + hit) / 2, hit + 0.004, hit + 0.07]; };
//# sourceMappingURL=ultpicks.js.map