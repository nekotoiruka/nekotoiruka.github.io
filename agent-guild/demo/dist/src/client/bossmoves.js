// ボスの技の名前と、それに対する冒険者の「対応技」。ボスの種類（＝シーズン）ごとに変える。
//   ・技の名前: 画面上の見出し（場面の帯）と、攻撃の帯（「〜！ 正しく動ければかわせる」）に出す。ボスの動き（bossmotion.ts）と合わせる
//   ・対応技: 正しく動けた冒険者の身のこなし（arena-fighter.ts）・演出（scenes.ts の counterFx）・効果音（arena-timing.ts）
// 竜（シーズン1）の対応技は、今までどおり。
import { tl } from '../shared/i18n.js';
export const isBaseScene = (s) => s === 'breath' || s === 'claw' || s === 'dive' || s === 'tail';
// ---- 弱点の属性（隙の反撃と、奥義の色） ----
// 竜（シーズン1）だけは、属性そのものが課題: 弱点は戦いの流れで変わり、隙では属性の名前を、逆鱗では「属性・逆鱗穿ち」を答える。
//   提出ごとに属性の違う問題が出る（場面の element）。演出はその属性の色で当てる。
// ほかのボスは属性を答えさせない。見るからに弱点の属性があるボスだけ、隙の反撃をその属性で固定して見せる。
//   吸血鬼伯爵は日の光、氷の巨人は炎。弱点の属性がはっきりしないボス（大蜘蛛・ゴブリン・クラーケン・石の巨人）は属性なし（白い会心の一撃）
const WEAKNESS = { vampire: '光', giant: '炎' };
export const bossWeakness = (kind) => WEAKNESS[kindOf(kind)];
const NAMES = {
    dragon: {
        atk: { claw: tl('ひっかき'), breath: tl('火炎ブレス'), tail: tl('子竜の奇襲'), meteor: tl('隕石落とし'), nova: tl('全体爆発') },
        scene: { dive: tl('急降下'), spell: tl('呪文'), ougi: tl('竜の悪あがき'), rush: tl('突進'), ally: tl('竜の一撃') },
        head: { tail: tl('背後の羽音') },
    },
    vampire: {
        atk: { claw: tl('伸びる爪'), breath: tl('蝙蝠の群れ'), tail: tl('霧の蝙蝠'), meteor: tl('血の雨'), nova: tl('紅の呪い') },
        scene: { dive: tl('蝙蝠の急降下'), spell: tl('呪いの紋'), ougi: tl('伯爵の悪あがき'), rush: tl('血の秘術'), ally: tl('伯爵の一撃') },
        head: { breath: tl('蝙蝠の群れ'), claw: tl('伸びる爪'), dive: tl('蝙蝠の急降下'), tail: tl('背後の霧'), rush: tl('血の秘術') },
    },
    spider: {
        atk: { claw: tl('毒牙'), breath: tl('糸の網'), tail: tl('子蜘蛛の奇襲'), meteor: tl('毒の雨'), nova: tl('毒霧') },
        scene: { dive: tl('糸を伝う奇襲'), spell: tl('毒の大技'), ougi: tl('大蜘蛛の悪あがき'), rush: tl('飛びかかり'), ally: tl('大蜘蛛の一撃') },
        head: { breath: tl('糸の予兆'), claw: tl('毒牙'), dive: tl('頭上の気配'), tail: tl('背後の糸'), rush: tl('飛びかかりの予兆') },
    },
    goblin: {
        atk: { claw: tl('落とし穴'), breath: tl('矢の雨'), tail: tl('斥候の奇襲'), meteor: tl('投石'), nova: tl('大号令') },
        scene: { dive: tl('投石'), spell: tl('大号令'), ougi: tl('頭目の悪あがき'), rush: tl('全軍突撃'), ally: tl('頭目の一撃') },
        head: { breath: tl('号令の予兆'), claw: tl('落とし穴'), dive: tl('投石の予兆'), tail: tl('背後の足音'), rush: tl('全軍突撃の予兆') },
    },
    kraken: {
        atk: { claw: tl('触手の薙ぎ'), breath: tl('墨の噴射'), tail: tl('背後の触手'), meteor: tl('海からの突き上げ'), nova: tl('大渦') },
        scene: { dive: tl('海からの突き上げ'), spell: tl('大渦'), ougi: tl('海の主の悪あがき'), rush: tl('触手の突き'), ally: tl('海の主の一撃') },
        head: { breath: tl('墨の予兆'), claw: tl('触手の薙ぎ'), dive: tl('足もとの泡'), tail: tl('背後の波') },
    },
    golem: {
        atk: { claw: tl('岩の拳'), breath: tl('床から伸びる石の手'), tail: tl('石腕の薙ぎ払い'), meteor: tl('落石'), nova: tl('刻印の光線') },
        scene: { dive: tl('地割れ'), spell: tl('刻印の起動'), ougi: tl('守護巨人の悪あがき'), rush: tl('岩の突進'), ally: tl('守護巨人の一撃') },
        head: { breath: tl('背後の床の揺れ'), claw: tl('岩の拳'), dive: tl('地響き'), tail: tl('石腕の薙ぎ払い') },
    },
    giant: {
        atk: { claw: tl('氷の投げ槍'), breath: tl('凍てつく息'), tail: tl('雪狼の奇襲'), meteor: tl('つらら落とし'), nova: tl('雪崩') },
        scene: { dive: tl('氷柱の踏みつけ'), spell: tl('雪崩'), ougi: tl('氷巨人の悪あがき'), rush: tl('氷の突進'), ally: tl('氷巨人の一撃') },
        head: { breath: tl('凍てつく息の予兆'), claw: tl('氷の投げ槍'), dive: tl('地響き'), tail: tl('背後の冷気') },
    },
};
// どのボスでも同じ名前の場面
const COMMON_SCENE_NAME = { illusion: tl('幻術の声'), fog: tl('霧の中からの一撃'), summon: tl('大技'), memory: tl('見覚えのある一撃') };
const kindOf = (k) => (k && k in NAMES ? k : 'dragon');
/** 攻撃の帯に出す技の名前（場面の名前 → 攻撃の種類の名前） */
export function attackName(kind, scene, atk) {
    const n = NAMES[kindOf(kind)];
    if (scene && n.scene[scene])
        return n.scene[scene];
    if (scene && COMMON_SCENE_NAME[scene])
        return COMMON_SCENE_NAME[scene];
    return atk === 'treasure' ? '' : n.atk[atk];
}
/** 場面の見出し（シーズンの labels がないとき）。ないときは undefined（scenes.ts の共通の見出し） */
export function sceneHead(kind, scene) {
    return NAMES[kindOf(kind)].head[scene];
}
// 対応技には、画面に出す名前をつけない（シーズンの正解の言葉と重ならないように。名前は、正しく動けた人の答えから出る）
const C = (evade, fx, sfx, color) => ({ evade, fx, sfx, color });
// 背後から来る攻撃（2026-11-16）: どのボスにも、冒険者の背後（右）から小さな相手が襲う場面が一つある。正しく動けた人は振り向いて迎え撃つ。
//   どの場面にするかは、その場面の課題の中身（正しく動けた人の身のこなし）と、背後から来る攻撃の見た目が食い違わないように選ぶ:
//   斬る・はらう身のこなしの場面は「振り向いて斬る」（turnCut）、受ける身のこなしの場面は「振り向いて受ける」（turn）。
//   石の巨人は、迎え撃つ場面がないので、受ける場面（ブレス）を、背後の床から伸びる石の手にした
export const BACK_SCENE = { dragon: 'tail', vampire: 'tail', spider: 'tail', goblin: 'tail', kraken: 'tail', golem: 'breath', giant: 'tail' };
/** その場面が、背後から来る攻撃の場面か */
export const isBackScene = (kind, scene) => !!scene && BACK_SCENE[kindOf(kind)] === scene;
export const COUNTERS = {
    // 竜: 炎は鏡で受け、爪は影を残してすり抜け、急降下は落ちてくる場所から飛びのき、背後から来る子竜（ワイバーン）は振り向いて斬る。
    //   急降下は、伯爵・大蜘蛛と同じく狙う人の上へ落ちる体当たりなので、伏せてもつぶされる。落ちる場所から抜ける動きにした（2026-11-16、#120）。
    //   竜は属性そのものが課題（身のこなしは課題の中身によらない）ので、尾の場面を背後の子竜にした（2026-11-16）
    dragon: { breath: C('block', 'mirror', 'guard', '#bfe8ff'), claw: C('step', 'shadow', 'whoosh', '#e2c2ff'), dive: C('dodge', 'roll', 'whoosh', '#c8d0ff'), tail: C('turnCut', 'backGuard', 'slash', '#e2c2ff') },
    // 伯爵: 蝙蝠の群れは床に伏せてやり過ごし（床伏せ）、爪は銀の盾で受け（銀盾受け）、急降下は柱の陰へ駆けこみ（柱陰走り）、背後の霧は振り向いて斬る（背面斬り）。
    //   動きはシーズンの正解の中身に合わせる（2026-10-24。以前は聖なる光・はじく・受け止める で、正解の名前と絵が食い違っていた）
    vampire: { breath: C('crawl', 'dust', 'whoosh', '#e0c8f0'), claw: C('block', 'parry', 'guard', '#ffd0da'), dive: C('dodge', 'roll', 'whoosh', '#e0c8f0'), tail: C('turnCut', 'backGuard', 'slash', '#ffd0e0') },
    // 大蜘蛛: 糸は横へ転がってかわし、牙は盾ではじき、頭上からの落下は飛びのき、背後へ糸で降りてくる子蜘蛛は振り向いて斬る（2026-11-16）
    spider: { breath: C('dodge', 'roll', 'whoosh', '#f4f6ff'), claw: C('slash', 'parry', 'guard', '#9af0b0'), dive: C('dodge', 'roll', 'whoosh', '#e2c2ff'), tail: C('turnCut', 'backGuard', 'slash', '#d8ffe0') },
    // 頭目: 矢の雨は盾をかかげて受け、落とし穴は回りこんで避け、投石は飛びのき、背後から忍び寄る斥候は振り向いて斬る（2026-11-16）
    goblin: { breath: C('block', 'shieldWall', 'guard', '#fff0c0'), claw: C('step', 'shadow', 'whoosh', '#ffd166'), dive: C('dodge', 'roll', 'whoosh', '#e8d5a8'), tail: C('turnCut', 'backGuard', 'slash', '#ffd166') },
    // 海の主: 墨は物陰に伏せ、触手の薙ぎは跳んでかわし、足もとからの突き上げは跳んで離れ、背後の水から伸びる細い触手は振り向いて斬る（2026-11-16）
    kraken: { breath: C('crawl', 'dust', 'whoosh', '#7bed9f'), claw: C('jump', 'leap', 'jump', '#bfe8ff'), dive: C('jump', 'leap', 'jump', '#d8f2ff'), tail: C('turnCut', 'backGuard', 'slash', '#ffb0d0') },
    // 守護巨人: 背後の床から伸びる石の手は振り向いて受け（2026-11-16）、拳は飛びのき、地割れは跳び越え、石の腕は伏せてやりすごす
    golem: { breath: C('turn', 'backGuard', 'guard', '#d8ccb0'), claw: C('dodge', 'roll', 'whoosh', '#c8b48a'), dive: C('jump', 'leap', 'jump', '#7af0e0'), tail: C('crawl', 'dust', 'whoosh', '#c8b48a') },
    // 氷巨人: 凍てつく息は物陰に伏せ、氷の槍は左右に駆けてかわし、踏みつけは飛びのき、背後の雪の吹きだまりから跳び出す雪狼は振り向いて斬る（2026-11-16）
    giant: { breath: C('crawl', 'dust', 'whoosh', '#ffb070'), claw: C('step', 'shadow', 'whoosh', '#e6f6ff'), dive: C('dodge', 'roll', 'whoosh', '#e6f6ff'), tail: C('turnCut', 'backGuard', 'slash', '#bfe8ff') },
};
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
    return isBaseScene(scene) ? COUNTERS[kindOf(kind)][scene] : undefined;
}
// ---- ボスの技の効果音（予兆のあと、技を放つとき） ----
/** ブレスの場面: 何を吐くか（炎・蝙蝠・糸・矢・墨・石・冷気）。ほかの場面: ほえ声（ゴーレムは地響き・蜘蛛は威嚇の音） */
export function bossCue(kind, scene) {
    const k = kindOf(kind);
    if (scene === 'breath') {
        const s = { dragon: 'breath', vampire: 'bats', spider: 'hiss', goblin: 'volley', kraken: 'splash', golem: 'rumble', giant: 'frost' };
        return { t: 0.36, s: s[k] };
    }
    if (k === 'golem')
        return { t: 0.3, s: 'rumble', v: 0.8 };
    if (k === 'spider')
        return { t: 0.3, s: 'hiss', v: 0.8 };
    if (k === 'kraken' && (scene === 'dive' || scene === 'tail'))
        return { t: 0.3, s: 'splash', v: 0.8 };
    return { t: 0.3, s: 'roar', v: 0.7 };
}
//# sourceMappingURL=bossmoves.js.map