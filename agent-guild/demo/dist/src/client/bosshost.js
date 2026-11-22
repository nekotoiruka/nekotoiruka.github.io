// シーズンのパックのボスを、外から読みこむしくみ（#118）。
// パックの fx/boss.js は `export default (kit) => BossModule`（と、任意で `export const locales`）。本体は kit（このファイルの kit）を渡して呼び、registerBoss する。
//   ・ブラウザ: ensureBoss(briefing.boss) が、サーバーの /season-fx/<課題ID>/boss.js を import() する（サーバーの publicTaskInfo が boss.fx に置き場所を入れる）
//   ・node（テスト）: installBoss(読みこんだモジュール)。test/kit/boss-contract.ts の testBosses() が SEASONS_DIR の fx を読む
// 読めないとき（置き場所がない・SEASON_FX=off・読みこみや形の誤り）は、中立の仮の影（placeholderBoss）で描き、管理画面に警告を出す。
// kit の形を変えたら BOSS_API を上げる（番号の合わないパックは登録しない）。パックの側は、合わせた本体のコミットを fx/HOST に書く。
import * as fxkit from './fxkit.js';
import * as bosskit from './bosskit.js';
import * as pixart from './pixart.js';
import * as ultkit from './ultkit.js';
import * as reach from './reach.js';
import * as bossstyle from './bossstyle.js';
import * as bossmotion from './bossmotion.js';
import * as stagekit from './stagekit.js';
import * as chainkit from './chainkit.js';
import { BH, BOSS_IDLE, BW, bossCanvas, G, INK, outline } from './boss.js';
import { shade } from './sprites.js';
import { BOSS_API, bossOf, counter, hasBoss, registerBoss } from './bossapi.js';
import { addTranslations, tl } from '../shared/i18n.js';
import { Rng } from '../shared/rng.js';
/** パックに渡す部品。パックは本体のファイルを直接 import しない（この kit だけを使う） */
export const kit = {
    api: BOSS_API,
    fxkit, bosskit, pixart, ultkit, reach, bossstyle, bossmotion, stagekit, chainkit,
    boss: { G, outline, INK, BW, BH, BOSS_IDLE, bossCanvas },
    sprites: { shade },
    i18n: { tl },
    rng: { Rng },
    counter,
};
const FORM_ERR = 'boss fx: export default (kit) => BossModule の形ではないか、api の番号・ボスの種類が合いません';
/** 読みこんだパックのモジュールを登録する。kind を渡すと、その種類のボスでなければ登録しない。登録できたボスを返す（できなければ null） */
export function installBoss(mod, kind) {
    const m = mod;
    if (!m || typeof m.default !== 'function') {
        console.error(FORM_ERR);
        return null;
    }
    if (m.locales)
        addTranslations(m.locales); // 名前などを作る前に、パックの訳を足す
    const b = m.default(kit);
    if (!b || (kind && b.kind !== kind)) {
        console.error(FORM_ERR);
        return null;
    }
    return registerBoss(b) ? bossOf(b.kind) : null;
}
/** 中立の仮の影: 読めないボスの代わり。既定のボスの表（対応技・被弾・見えはじめる時刻・体の動き）を借り、絵は名前も形も持たない影にする */
export function placeholderBoss(kind) {
    const base = bossOf();
    return {
        api: BOSS_API, kind,
        render: shadowRender,
        style: { ...base.style, ground: undefined, tailBand: undefined, flies: undefined },
        names: {
            atk: { claw: tl('爪の叩きつけ'), breath: tl('ブレスの予兆'), tail: tl('尾のなぎはらい'), meteor: tl('大技'), nova: tl('大技') }, // 場面の見出しと同じ、中立の言葉
            scene: {}, head: {},
            spell: base.names.spell,
        },
        spellColor: base.spellColor,
        backScene: base.backScene,
        counters: base.counters,
        hurt: base.hurt,
        arrival: base.arrival ? { visible: base.arrival.visible } : undefined,
    };
}
/** 影の絵: 丸い体と頭・光る目だけ（96x84 ドット、右向き） */
function shadowRender(p) {
    const g = new G(), y0 = p.bob + p.squash, body = '#2a2433', dark = '#1a1622';
    g.ellipse(44, 58 + y0, 26 - p.squash * 0.5, 20 + p.squash * 0.3, body, dark);
    g.ellipse(60 + p.lean * 0.6, 34 + y0, 15, 13, body, dark);
    if (p.eye !== 'ko') {
        const ex = 64 + p.lean * 0.6, ey = 32 + y0, col = p.tint === 'rage' ? '#ff5a5a' : '#c8d0e0';
        g.set(ex, ey, col);
        g.set(ex + 4, ey, col);
    }
    return outline(g);
}
const loading = new Map();
/** 読めなかったボス（管理画面の警告） */
export const bossProblems = [];
/** シーズンのボスを使えるようにする。none: 種類なし（既定のボス）/ ok: もう登録されている / loaded: パックから読んだ / fallback: 読めず、仮の影 */
export function ensureBoss(boss) {
    const kind = boss?.kind;
    if (!kind)
        return Promise.resolve('none');
    if (hasBoss(kind))
        return Promise.resolve(loading.has(kind) ? loading.get(kind) : 'ok');
    let p = loading.get(kind);
    if (!p) {
        p = (async () => {
            let reason = 'no fx'; // 理由は運営者向け（訳さない）
            if (boss?.fx) {
                try {
                    const url = new URL(boss.fx, typeof document !== 'undefined' ? document.baseURI : 'http://localhost/').href;
                    if (installBoss(await import(/* @vite-ignore */ url), kind))
                        return 'loaded';
                    reason = FORM_ERR;
                }
                catch (e) {
                    reason = e.message;
                }
            }
            registerBoss(placeholderBoss(kind));
            bossProblems.push({ kind, reason });
            return 'fallback';
        })();
        loading.set(kind, p);
    }
    return p;
}
//# sourceMappingURL=bosshost.js.map