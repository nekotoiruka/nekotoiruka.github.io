// 討伐画面の字幕: 赤い帯＝ボスが何をしたか、青い帯＝自分の冒険者がどう応じたか。どちらも画面で起きていることを一文で言う。
//   ・シーズンの文（task.json の briefing.boss.captions）があればそれを使い、なければここの共通の文
//   ・自分が外したときの文では、正しい対処を明かさない（講評と同じ決まり）
//   ・行動の説明は、いつも自分の冒険者だけ（ほかの人の動きには文を出さない）
import { tl } from '../shared/i18n.js';
import { isUltScene } from './scenes.js';
/** 赤い帯（ボスの行動）。シーズンの文 → 共通の文 */
export function bossLine(c, scene, caseId, boss) {
    const own = c?.cases?.[caseId] ?? c?.boss?.[scene];
    if (own)
        return own;
    if (isUltScene(scene))
        return tl('{0}が大技の構えに入った！', boss);
    switch (scene) {
        case 'illusion': return tl('どこからか、偉い者を名乗る声が命じてくる……');
        case 'memory': return tl('{0}が、前に見せたのと同じ構えに入った！', boss);
        case 'ally': return tl('仲間の声が響く——その隙に{0}が仕掛けてきた！', boss);
        case 'fog': return tl('あたりが見えなくなった——何かが迫ってくる！');
        case 'opening': return tl('{0}がよろめいた——いまだ！', boss);
        case 'spell': return tl('{0}が、呪いの詠唱をはじめた！', boss);
        case 'chain': return tl('{0}が最後の大技の構えに入った！', boss);
        default: return tl('{0}が攻撃を仕掛けてきた！', boss);
    }
}
/** 連携詠唱の前置き（3拍）: ボスの構え → 倒しきるには → 唱和の号令 */
export function chainBeats(c, caseId, boss) {
    return [bossLine(c, 'chain', caseId, boss), c?.chain ?? tl('{0}を倒しきるには、伝説の大呪しかない——', boss), tl('討伐隊、唱和せよ！')];
}
// 正しく動けたときの共通の文（身のこなしの種類ごと。動きと文がずれないように、動きと同じものから引く）
const OK_BY_EVADE = () => ({
    dodge: tl('飛びのいて、攻撃をかわした！'), step: tl('すばやく駆け抜けて、攻撃をかわした！'), crawl: tl('身を伏せて、攻撃をやり過ごした！'),
    jump: tl('跳び上がって、攻撃をかわした！'), block: tl('構えた守りで、攻撃を受け止めた！'), turn: tl('振り向いて、背後の一撃を受け止めた！'),
    turnCut: tl('振り向きざまに、背後の敵を斬りつけた！'), slash: tl('迫る攻撃を、斬りはらった！'), barrier: tl('結界で、攻撃をはじいた！'),
    shoot: tl('飛んでくるものを、撃ち落とした！'), chant: tl('打ち消しの呪文で、呪いを跳ね返した！'), resist: tl('結界が、あやしい声を耳に届く前に弾いた！'),
});
/** 青い帯（自分が正しく動けたとき）。シーズンの場面の文 → 共通の文。
 *  基本の4場面と霧・記憶・仲間の声は、身のこなしの場面（resp: bossmoves.ts の respondScene）の文を使う。
 *  シーズンの文は答えの言葉を使わない（募集要項のデータに載るため。動きの見た目の言い方にとどめる） */
export function okLine(c, scene, resp, evade, element) {
    const own = c?.sceneOk?.[resp ?? scene] ?? c?.sceneOk?.[scene];
    if (own)
        return own;
    if (isUltScene(scene))
        return tl('必殺技で、大技ごと叩き潰した！'); // 技の名前は必殺技の演出の中で出るので、帯には入れない（長い名前がはみ出す）
    if (scene === 'opening')
        return element ? tl('弱点の{0}を、叩きこんだ！', element) : tl('隙を突いて、渾身の一撃を叩きこんだ！');
    return OK_BY_EVADE()[evade];
}
/** 青い帯（自分が外したとき）。正しい対処は言わない */
export function missLine(c, scene, why) {
    if (why === 'mpOut')
        return tl('行動力が尽きて、動けない！');
    if (why === 'charmed')
        return tl('さっきの声が、まだ頭に響いている……');
    const own = c?.miss?.[scene];
    if (own)
        return own;
    if (isUltScene(scene))
        return tl('大技をまともに浴びた！');
    switch (scene) {
        case 'illusion': return tl('あやしい声に惑わされた……');
        case 'memory': return tl('同じ手に、また引っかかった！');
        case 'ally': return tl('声に気を取られ、攻撃をくらった！');
        case 'fog': return tl('見えないところから、不意を突かれた！');
        case 'opening': return tl('好機を逃した……');
        case 'spell': return tl('打ち消しに失敗し、呪いを浴びた！');
        default: return tl('攻撃をまともにくらった！');
    }
}
//# sourceMappingURL=captions.js.map