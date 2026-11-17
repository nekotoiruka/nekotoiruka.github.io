// 必殺技の見本帳（紹介ページ用。運営・開発用）: 紹介ページ「必殺技」の窓で見せる大技を選ぶ。
// 立ち位置を「見切り」の窓と同じ所（後列の下から2番目）に決め、その冒険者を主役にして、大技の場面 × 武器を全部並べる（ultpicks.ts）。
// 1人だけ舞台に立たせ、カメラは大技の演出の寄り方のまま。ボスの攻撃の演出は出さない。
// scripts/build-ultpicks.mjs が 1ファイルの HTML にまとめる。討伐データは window.__LAB_DATA__（紹介ページと同じ吸血鬼伯爵の見本）。
import { ArenaRenderer } from './arena.js';
import { scriptFor } from './api.js';
import { applyUlt, ultCands, ultFrames } from './ultpicks.js';
import { pickLab } from './picklab.js';
import { ultName } from './scenes.js';
import { WEAPON_KINDS, WEAPON_LABELS } from '../shared/catalog.js';
const SCENE_JA = { ougi: '奥義', rush: '乱舞', summon: '召喚', parry: '返し技', seal: '封印', awaken: '覚醒' };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const script = scriptFor(window.__LAB_DATA__);
const cv = document.createElement('canvas');
cv.width = 768;
cv.height = 432;
const r = new ArenaRenderer(cv, script);
const raw = ultCands(script, WEAPON_KINDS);
const cands = raw.map((c) => ({ ...c, group: SCENE_JA[c.scene], title: `${WEAPON_LABELS[c.weapon]}：${c.label}`, sub: `${SCENE_JA[c.scene]} ／ 技の名前「${ultName(c.scene, c.weapon)}」`, line: `${SCENE_JA[c.scene]} ／ ${WEAPON_LABELS[c.weapon]} ／ ${c.label}` }));
const moves = new Set(raw.map((c) => `${c.scene}-${c.move}`)).size;
pickLab({
    r, cv, cands, w: (c) => c.w,
    aim: (c) => { const undo = applyUlt(r, c); r.solo = c.f; r.camOverride = null; return () => { undo(); r.solo = null; }; },
    windowOf: (c) => ({ from: c.from, to: c.to }),
    frames: (c) => ultFrames(c.scene),
    store: 'ultpicks-lp-v1',
    heading: '必殺技の見本帳（紹介ページ用）',
    lead: `紹介ページ「必殺技」の窓で見せる大技を選びます。立ち位置を「見切り」の窓と同じ所（後列の下から2番目）に決め、その冒険者を主役にして、6つの場面ごとに武器を全部（${WEAPON_KINDS.length}種類）持ちかえて並べました（${cands.length}通り。型は${moves}種類）。1人だけ舞台に立たせ、カメラは大技の寄り方のまま、大技の溜めの直前から主役が戻るまでを流します。カードを押すと右の画面（スマホでは重ねた窓）で1つだけくり返し、「選ぶ ／ 外す」で選んだ順に番号がつき、その順につないで流します。`,
    summaryHead: '必殺技の窓で見せる大技（この順。立ち位置は後列の下から2番目）:',
    advice: 'この内容をチャットに貼ってください。紹介ページの窓は、この順でつないで流すようにします（4つ前後がおすすめ）。',
});
//# sourceMappingURL=ultpicklab.js.map