// 被弾の型の割り当て: 外した冒険者が、ボスの攻撃を受けたときにどう見せるか（見本帳の「被弾」の型の id）。
// 方針（2026-11-01、見本帳で選んでもらった結果）: 動きで見せず、状態で見せる。後ろへ下がる・すべる・浮く・回るは成功の動き（回避・ガード・ジャンプ）が使っている。
// 決め方: 外したときの字幕と同じ「課題の場面」（caseScene）で引く。演出の場面（大技は必殺技の6種類を順に回す）ではない。
//   基本の4場面（ブレス・爪・急降下・尾）は、ボスごとの攻撃の中身で決める（BossModule の lab.pairs の技の名前・bossmotion.ts の動き）。
//   霧・記憶・仲間の声は、そのとき実際に来る攻撃（respondScene の基本の場面）と同じにする。
//   幻術（偽の声）は null: いままでどおり、目がうずまきでふらふらする（尻もちピヨりの星と見まちがえないように）。連携詠唱はボスの攻撃がないので null。
import { bossOf } from './bossapi.js';
import './bosses/index.js';
import { respondScene } from './bossmoves.js';
// ボス × 基本の4場面（[技の名前] → 型）は、ボスごとの BossModule の hurt（src/client/bosses/<kind>.ts）
// 魂が抜けかける: ◎おばけ を先に、○口からにゅるっと を次に。大技の回ごとに順に使う
const SOULS = ['hurt-soul-ghost', 'hurt-soul-mouth'];
/** 外した人の被弾の型。null なら、いままでの動き（小さく下がる・幻術ならふらふら）のまま。
 *  soulTurn: このシーズンで何回目の「魂」の回か（0から。おばけ・口から を順に回す） */
export function hurtFor(kind, caseScene, respond, attack, soulTurn = 0) {
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
            return base ? bossOf(kind).hurt[base] : 'hurt-daze';
        }
    }
}
//# sourceMappingURL=hurtmoves.js.map