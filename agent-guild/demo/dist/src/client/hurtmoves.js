import { respondScene } from './bossmoves.js';
// ボス × 基本の4場面（[技の名前] → 型）
export const HURT_BY_BOSS = {
    dragon: { breath: 'hurt-scorch', claw: 'hurt-daze', dive: 'hurt-crush', tail: 'hurt-fly' }, // 火炎ブレス→黒こげ / ひっかき / 急降下→つぶれる / 尾のなぎはらい→吹っ飛ぶ
    vampire: { breath: 'hurt-daze', claw: 'hurt-daze', dive: 'hurt-crush', tail: 'hurt-daze' }, // 蝙蝠の群れ / 伸びる爪 / 真上からの一撃→つぶれる / 背後の霧からの斬撃
    spider: { breath: 'hurt-web', claw: 'hurt-curse', dive: 'hurt-crush', tail: 'hurt-fly' }, // 糸の網→ぐるぐる巻き / 毒牙→毒がまわる / 天井からの落下→つぶれる / 脚の薙ぎ払い→吹っ飛ぶ
    goblin: { breath: 'hurt-arrow', claw: 'hurt-daze', dive: 'hurt-daze', tail: 'hurt-fly' }, // 矢の雨→頭に矢 / 落とし穴 / 投石→たんこぶ / 槍の突撃→吹っ飛ぶ
    kraken: { breath: 'hurt-ink', claw: 'hurt-fly', dive: 'hurt-daze', tail: 'hurt-daze' }, // 墨の噴射→墨まみれ / 触手の薙ぎ→吹っ飛ぶ / 海からの突き上げ / 触手の巻き取り
    golem: { breath: 'hurt-daze', claw: 'hurt-crush', dive: 'hurt-daze', tail: 'hurt-fly' }, // 石礫の嵐 / 岩の拳→つぶれる / 地割れ / 石腕の薙ぎ払い→吹っ飛ぶ
    giant: { breath: 'hurt-ice', claw: 'hurt-daze', dive: 'hurt-crush', tail: 'hurt-fly' }, // 凍てつく息→氷漬け / 氷の投げ槍 / 氷柱の踏みつけ→つぶれる / 棍棒の薙ぎ払い→吹っ飛ぶ
};
// 魂が抜けかける: ◎おばけ を先に、○口からにゅるっと を次に。大技の回ごとに順に使う
const SOULS = ['hurt-soul-ghost', 'hurt-soul-mouth'];
/** 外した人の被弾の型。null なら、いままでの動き（小さく下がる・幻術ならふらふら）のまま。
 *  soulTurn: このシーズンで何回目の「魂」の回か（0から。おばけ・口から を順に回す） */
export function hurtFor(kind, caseScene, respond, attack, soulTurn = 0) {
    const k = (kind && kind in HURT_BY_BOSS ? kind : 'dragon');
    switch (caseScene) {
        case 'illusion':
        case 'chain': return null;
        case 'opening': return 'hurt-daze'; // 隙を突きそこねて、はじき返された
        case 'spell': return 'hurt-curse'; // 打ち消しに失敗し、呪いを浴びた
        case 'summon':
        case 'parry': return 'hurt-fly'; // 「吹き飛ばされた！」・大技を返される
        case 'ougi':
        case 'rush':
        case 'seal':
        case 'awaken': return SOULS[soulTurn % SOULS.length]; // 大技をまともに浴びた
        default: {
            const base = respondScene(caseScene, respond, attack);
            return base ? HURT_BY_BOSS[k][base] : 'hurt-daze';
        }
    }
}
//# sourceMappingURL=hurtmoves.js.map