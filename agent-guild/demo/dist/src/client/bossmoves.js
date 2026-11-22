// ボスの技の名前と、それに対する冒険者の「対応技」。ボスの種類（＝シーズン）ごとに変える。
//   表の中身は、ボスごとの BossModule（src/client/bosses/<kind>.ts。bossapi.ts の bossOf(kind)）にある。ここは、それを読む関数
//   ・技の名前: 画面上の見出し（場面の帯）と、攻撃の帯（「〜！ 正しく動ければかわせる」）に出す。ボスの動き（bossmotion.ts）と合わせる
//   ・対応技: 正しく動けた冒険者の身のこなし（arena-fighter.ts）・演出（scenes.ts の counterFx）・効果音（arena-timing.ts）
import { tl } from '../shared/i18n.js';
import { bossOf } from './bossapi.js';
import './bosses/index.js';
export const isBaseScene = (s) => s === 'breath' || s === 'claw' || s === 'dive' || s === 'tail';
// ---- 弱点の属性（隙の反撃と、奥義の色） ----
// 属性そのものが課題のボス（シーズンの課題が場面の element を持つ）: 弱点は戦いの流れで変わり、隙では属性の名前を、逆鱗では「属性・逆鱗穿ち」を答える。
//   提出ごとに属性の違う問題が出る（場面の element）。演出はその属性の色で当てる。
// ほかのボスは属性を答えさせない。見るからに弱点の属性があるボスだけ、隙の反撃をその属性で固定して見せる。
//   たとえば吸血鬼伯爵は日の光。弱点の属性がはっきりしないボスは属性なし（白い会心の一撃）
//   （BossModule の weakness）
export const bossWeakness = (kind) => bossOf(kind).weakness;
// ---- 技の名前 ----
// BossModule の names。atk: ボスの攻撃の種類ごとの名前 / scene: 場面ごとの名前（atk より優先）/ head: 場面の見出し（シーズンの labels がないとき）
//   知らない種類・種類なしは、既定のボス（bossOf の DEFAULT_BOSS）
// どのボスでも同じ名前の場面
const COMMON_SCENE_NAME = { illusion: tl('幻術の声'), fog: tl('霧の中からの一撃'), summon: tl('大技'), memory: tl('見覚えのある一撃') };
/** 攻撃の帯に出す技の名前（場面の名前 → 攻撃の種類の名前） */
export function attackName(kind, scene, atk) {
    const n = bossOf(kind).names;
    if (scene && n.scene[scene])
        return n.scene[scene];
    if (scene && COMMON_SCENE_NAME[scene])
        return COMMON_SCENE_NAME[scene];
    return atk === 'treasure' ? '' : n.atk[atk];
}
/** 場面の見出し（シーズンの labels がないとき）。ないときは undefined（scenes.ts の共通の見出し） */
export function sceneHead(kind, scene) {
    return bossOf(kind).names.head[scene];
}
// 対応技には、画面に出す名前をつけない（シーズンの正解の言葉と重ならないように。名前は、正しく動けた人の答えから出る）
// 背後から来る攻撃（2026-11-16）: どのボスにも、冒険者の背後（右）から小さな相手が襲う場面が一つある。正しく動けた人は振り向いて迎え撃つ。
//   どの場面にするかは、その場面の課題の中身（正しく動けた人の身のこなし）と、背後から来る攻撃の見た目が食い違わないように選ぶ:
//   斬る・はらう身のこなしの場面は「振り向いて斬る」（turnCut）、受ける身のこなしの場面は「振り向いて受ける」（turn）。
//   迎え撃つ場面がないボスは、受ける場面の攻撃を、背後から来る形にする
//   （BossModule の backScene）
/** その場面が、背後から来る攻撃の場面か */
export const isBackScene = (kind, scene) => !!scene && bossOf(kind).backScene === scene;
// ボスごとの対応技は、BossModule の counters（bossapi.ts の counter で作る）
/** 正しく動けた人の身のこなしを、どの基本の場面の対応技にするか。
 *  課題の respond（ひっかけの回）→ 基本の4場面ならその場面 → 霧・記憶・仲間の声はボスの攻撃（attack）から。ほかの場面は undefined */
export function respondScene(scene, respond, attack) {
    if (respond)
        return respond;
    if (isBaseScene(scene))
        return scene;
    if (scene === 'fog' || scene === 'memory' || scene === 'ally')
        return attack === 'claw' || attack === 'breath' || attack === 'tail' ? attack : attack === 'meteor' ? 'dive' : undefined;
    return undefined;
}
/** その場面での対応技（基本の4場面だけ。ほかの場面は undefined） */
export function counterFor(kind, scene) {
    return isBaseScene(scene) ? bossOf(kind).counters[scene] : undefined;
}
// ---- ボスの技の効果音（予兆のあと、技を放つとき） ----
/** ボスの技の効果音。ボスごとの音（BossModule の cue）がなければ、ふつうのほえ声 */
export function bossCue(kind, scene) {
    // ボスごとの音は BossModule の cue（ないとき・undefined を返したときは、ふつうのほえ声）
    const c = bossOf(kind).cue?.(scene);
    if (c)
        return c;
    return { t: 0.3, s: 'roar', v: 0.7 };
}
//# sourceMappingURL=bossmoves.js.map