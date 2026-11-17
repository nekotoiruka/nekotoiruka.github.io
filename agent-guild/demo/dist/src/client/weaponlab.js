// 武器ごとの技の見本帳（紹介ページ用。運営・開発用）: 紹介ページ「武器ごとの技」の窓で見せる反撃を選ぶ。
// 立ち位置を「見切り」の窓と同じ所（後列の下から2番目）に決め、その冒険者の武器と反撃の型を差し替えて、16種類の武器の反撃を全部並べる（weaponpicks.ts）。
// 1人だけ舞台に立たせ、カメラは冒険者とボスが入る所に止めて、反撃を始める直前から、当たってダメージが出るまでを流す。ボスの攻撃の演出は出さない。
// scripts/build-weaponpicks.mjs が 1ファイルの HTML にまとめる。討伐データは window.__LAB_DATA__（紹介ページと同じ吸血鬼伯爵の見本）。
import { ArenaRenderer } from './arena.js';
import { scriptFor } from './api.js';
import { applyWeapon, weaponCands, weaponShot, weaponWindow } from './weaponpicks.js';
import { pickLab } from './picklab.js';
import { WEAPON_KINDS, WEAPON_LABELS } from '../shared/catalog.js';
const CAT_JA = { slash: '斬る', thrust: '突く', blunt: '叩く', shoot: '撃つ', magic: '魔法' };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const script = scriptFor(window.__LAB_DATA__);
const cv = document.createElement('canvas');
cv.width = 768;
cv.height = 432;
const r = new ArenaRenderer(cv, script);
r.mine = new Set();
const raw = weaponCands(script, r, WEAPON_KINDS);
const cands = raw.map((c) => ({ ...c, group: `${CAT_JA[c.cat] ?? c.cat}`, title: `${WEAPON_LABELS[c.weapon]}：${c.name}`, sub: `${CAT_JA[c.cat] ?? c.cat} ／ ${c.pattern.id}`, line: `${WEAPON_LABELS[c.weapon]} ／ ${c.name}` }));
pickLab({
    r, cv, cands, w: (c) => c.w,
    aim: (c) => { const undo = applyWeapon(r, c); r.solo = c.f; r.camOverride = weaponShot(r, c.f); return () => { undo(); r.solo = null; r.camOverride = null; }; },
    windowOf: (c) => weaponWindow(r, c),
    frames: (_c, wn) => [0.2, 0.5, 0.75, 0.92].map((k) => wn.from + (wn.to - wn.from) * k),
    store: 'weaponpicks-lp-v1',
    heading: '武器ごとの技の見本帳（紹介ページ用）',
    lead: `紹介ページ「武器ごとの技」の窓で見せる反撃を選びます。立ち位置を「見切り」の窓と同じ所（後列の下から2番目）に決め、その冒険者の武器を全部（${WEAPON_KINDS.length}種類）持ちかえて、武器ごとの反撃の型を並べました（${cands.length}通り。型が2つある武器は2つとも）。1人だけ舞台に立たせ、カメラは冒険者とボスが入る所に止めて、反撃を始める直前から、当たってダメージが出るまでを流します（回避とボスの攻撃の演出は見せません）。カードを押すと右の画面（スマホでは重ねた窓）で1つだけくり返し、「選ぶ ／ 外す」で選んだ順に番号がつき、その順につないで流します。`,
    summaryHead: '武器ごとの技の窓で見せる反撃（この順。立ち位置は後列の下から2番目）:',
    advice: 'この内容をチャットに貼ってください。紹介ページの窓は、この順でつないで流すようにします（6つ前後がおすすめ）。',
});
//# sourceMappingURL=weaponlab.js.map