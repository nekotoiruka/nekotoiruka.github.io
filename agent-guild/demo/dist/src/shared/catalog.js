// 運営が用意するツールカタログ。参加者は任意コードを持ち込めず、ここから選ぶ。
// cost はビルドコスト（上限100）に加算される。weapon は見た目の武器。
import { getLang, perLang, tl } from './i18n.js';
export const WEAPON_KINDS = ['bow', 'spear', 'dagger', 'wand', 'shield', 'axe', 'hammer', 'book', 'sword', 'katana', 'scythe', 'fan', 'blaster', 'pan', 'umbrella', 'guitar'];
export const WEAPON_LABELS = perLang(() => ({
    bow: tl('弓'), spear: tl('槍'), dagger: tl('短剣'), wand: tl('杖'), shield: tl('盾'), axe: tl('斧'), hammer: tl('ハンマー'), book: tl('魔導書'),
    sword: tl('剣'), katana: tl('刀'), scythe: tl('大鎌'), fan: tl('扇'), blaster: tl('光線銃'), pan: tl('フライパン'), umbrella: tl('傘'), guitar: tl('ギター'),
}));
// 近づいて殴る武器（それ以外は飛び道具）
export const MELEE_WEAPONS = ['spear', 'dagger', 'axe', 'hammer', 'shield', 'sword', 'katana', 'scythe', 'pan', 'umbrella', 'guitar'];
export const TOOL_CATALOG = perLang(() => ([
    {
        id: 'kb_search',
        name: tl('社内ナレッジ検索'),
        cost: 20,
        weapon: 'bow',
        description: tl('社内の振り分けルール・FAQ を全文検索し、関連する記述を最大3件返す。'),
        inputSchema: { type: 'object', properties: { query: { type: 'string', description: tl('検索語') } }, required: ['query'] },
    },
    {
        id: 'customer_lookup',
        name: tl('顧客台帳照会'),
        cost: 15,
        weapon: 'spear',
        description: tl('メールアドレスから顧客の契約情報（プラン・契約単価・担当営業など）を返す。'),
        inputSchema: { type: 'object', properties: { email: { type: 'string' } }, required: ['email'] },
    },
    {
        id: 'history_lookup',
        name: tl('過去問い合わせ履歴'),
        cost: 10,
        weapon: 'axe',
        description: tl('メールアドレスから直近の問い合わせ件数と未解決チケットの有無を返す。'),
        inputSchema: { type: 'object', properties: { email: { type: 'string' } }, required: ['email'] },
    },
    {
        id: 'regex_matcher',
        name: tl('正規表現マッチ'),
        cost: 5,
        weapon: 'dagger',
        description: tl('テキストに正規表現を適用し、一致した部分を返す。'),
        inputSchema: {
            type: 'object',
            properties: { text: { type: 'string' }, pattern: { type: 'string' } },
            required: ['text', 'pattern'],
        },
    },
    {
        id: 'clock',
        name: tl('時計'),
        cost: 10,
        weapon: 'hammer',
        description: tl('現在の日時（日本時間）と曜日を返す。'),
        inputSchema: { type: 'object', properties: {} },
    },
    {
        id: 'calculator',
        name: tl('計算機'),
        cost: 10,
        weapon: 'wand',
        description: tl('四則演算の式を評価して結果を返す。'),
        inputSchema: { type: 'object', properties: { expression: { type: 'string' } }, required: ['expression'] },
    },
    {
        id: 'scan', effect: tl('敵の弱点と様子が見えた'),
        name: tl('看破のモノクル'),
        cost: 10,
        weapon: 'fan',
        description: tl('目の前の敵を見抜き、いまの弱点の属性と状態を返す（弱点は戦いの流れで変わる）。'),
        inputSchema: { type: 'object', properties: {} },
        optIn: true,
        source: 'scan',
    },
    {
        id: 'memory', effect: tl('前の回の出来事を読み返せた'),
        name: tl('冒険日誌'),
        cost: 10,
        weapon: 'book',
        description: tl('戦いの出来事を書き留めておく日誌。前の回に何があったか（敵の動きや、仲間の声）を読み返せる。'),
        inputSchema: { type: 'object', properties: {} },
        optIn: true,
    },
    {
        id: 'bell', effect: tl('見えない敵の次の動きが聞こえた'),
        name: tl('気配の鈴'),
        cost: 10,
        weapon: 'wand',
        description: tl('姿が見えなくても、敵が次に何をしようとしているかを、鈴の音で知らせる。'),
        inputSchema: { type: 'object', properties: {} },
        optIn: true,
        source: 'sense',
    },
    {
        id: 'torch',
        name: tl('たいまつ'),
        cost: 5,
        weapon: 'spear',
        description: tl('暗がりや霧の中を照らす。獣は火を嫌うと言われている。'),
        inputSchema: { type: 'object', properties: {} },
        optIn: true,
        decoy: tl('たいまつを掲げた！ …霧は晴れない'),
    },
    {
        id: 'fishing_rod',
        name: tl('釣り竿'),
        cost: 5,
        weapon: 'spear',
        description: tl('川や湖で食料を調達できる。長旅には欠かせない。'),
        inputSchema: { type: 'object', properties: {} },
        optIn: true,
        decoy: tl('釣り竿を振った！ …ここで釣れるものはない'),
    },
    {
        id: 'excalipar',
        name: tl('聖剣エクスカリパー'),
        cost: 10,
        weapon: 'sword',
        description: tl('伝説の聖剣……の名を持つ剣。抜くと、何かが起きるかもしれない。'),
        inputSchema: { type: 'object', properties: {} },
        optIn: true,
        decoy: tl('エクスカリパーを掲げた！ …なにも起きない'),
    },
    {
        id: 'crystal',
        name: tl('占いの水晶玉'),
        cost: 10,
        weapon: 'wand',
        description: tl('のぞき込むと、運命がほんの少しだけ見える……かもしれない。'),
        inputSchema: { type: 'object', properties: { question: { type: 'string' } } },
        optIn: true,
        decoy: tl('水晶玉をのぞいた！ …何も映らない'),
    },
    {
        id: 'charm',
        name: tl('幸運のお守り'),
        cost: 5,
        weapon: 'fan',
        description: tl('持っていると運が良くなる、と露店で言われた。'),
        inputSchema: { type: 'object', properties: {} },
        optIn: true,
        decoy: tl('お守りを握りしめた！ …気のせいだった'),
    },
    {
        id: 'dragon_horn',
        name: tl('竜呼びの角笛'),
        cost: 10,
        weapon: 'guitar',
        description: tl('吹けば、竜と話ができるという言い伝えがある。'),
        inputSchema: { type: 'object', properties: { message: { type: 'string' } } },
        optIn: true,
        decoy: tl('角笛を吹いた！ …竜は聞いていない'),
    },
    // --- シーズン2（大蜘蛛）・シーズン3（ゴブリンの大群）の道具 ---
    {
        id: 'poison_vial', effect: tl('毒の種類が分かった'),
        name: tl('毒見の小瓶'),
        cost: 10,
        weapon: 'dagger',
        description: tl('傷口の血を一滴たらすと色が変わり、体に入った毒の種類が分かる。'),
        inputSchema: { type: 'object', properties: {} },
        optIn: true,
        source: 'scan',
    },
    {
        id: 'moss_lantern', effect: tl('闇の中の動きが見えた'),
        name: tl('光苔のランタン'),
        cost: 10,
        weapon: 'wand',
        description: tl('闇の中でも、あたりにいるものの姿と動きを、青白い光でぼんやり照らし出す。'),
        inputSchema: { type: 'object', properties: {} },
        optIn: true,
        source: 'sense',
    },
    {
        id: 'web_cutter',
        name: tl('糸切りばさみ'),
        cost: 5,
        weapon: 'dagger',
        description: tl('蜘蛛の糸も切れるという、よく研いだはさみ。'),
        inputSchema: { type: 'object', properties: {} },
        optIn: true,
        decoy: tl('糸を切った！ …蜘蛛はまた糸を吐いた'),
    },
    {
        id: 'spyglass', effect: tl('遠くの頭目の飾りまで見えた'),
        name: tl('遠眼鏡'),
        cost: 10,
        weapon: 'blaster',
        description: tl('遠くの敵の姿や持ち物まで、くっきり見える。'),
        inputSchema: { type: 'object', properties: {} },
        optIn: true,
        source: 'scan',
    },
    {
        id: 'listening_tube', effect: tl('見えない場所の物音で動きが分かった'),
        name: tl('聞き耳の筒'),
        cost: 10,
        weapon: 'guitar',
        description: tl('地面に当てると、見えない場所で何が起きているかが、物音で分かる。'),
        inputSchema: { type: 'object', properties: {} },
        optIn: true,
        source: 'sense',
    },
    {
        id: 'goblin_mask',
        name: tl('ゴブリンの仮面'),
        cost: 5,
        weapon: 'fan',
        description: tl('かぶるとゴブリンそっくりに見える、という触れ込みの仮面。'),
        inputSchema: { type: 'object', properties: {} },
        optIn: true,
        decoy: tl('仮面をかぶった！ …すぐにばれた'),
    },
    // --- シーズン4〜7（クラーケン・石の巨人・吸血鬼・氷の巨人）の道具 ---
    { id: 'sea_glass', effect: tl('しぶきの向こうの旗の色が見えた'), name: tl('潮眼鏡'), cost: 10, weapon: 'blaster', description: tl('波しぶきや霧の向こうでも、遠くの旗や船の様子がはっきり見える。'), inputSchema: { type: 'object', properties: {} }, optIn: true, source: 'scan' },
    { id: 'sounding_line', effect: tl('濁った水の下の動きが分かった'), name: tl('測鉛'), cost: 10, weapon: 'hammer', description: tl('鉛のおもりを海に垂らすと、濁った水の下で何が動いているかが手ごたえで分かる。'), inputSchema: { type: 'object', properties: {} }, optIn: true, source: 'sense' },
    { id: 'ship_bell', name: tl('号鐘'), cost: 5, weapon: 'hammer', description: tl('よく響く船の鐘。海の魔物を追い払う、という船乗りもいる。'), inputSchema: { type: 'object', properties: {} }, optIn: true, decoy: tl('鐘を鳴らした！ …クラーケンは気にしていない') },
    { id: 'rubbing_kit', effect: tl('すり減った刻印の名前が分かった'), name: tl('拓本の道具'), cost: 10, weapon: 'book', description: tl('紙を当てて墨でこすると、すり減って読めない刻印も形が浮かび上がる。'), inputSchema: { type: 'object', properties: {} }, optIn: true, source: 'scan' },
    { id: 'echo_stone', effect: tl('砂煙の中の巨人の動きが分かった'), name: tl('響き石'), cost: 10, weapon: 'wand', description: tl('地面に置くと、砂煙の向こうで動くものの重さと向きが、震えで分かる。'), inputSchema: { type: 'object', properties: {} }, optIn: true, source: 'sense' },
    { id: 'pickaxe', name: tl('つるはし'), cost: 5, weapon: 'axe', description: tl('岩でも掘れる頑丈なつるはし。'), inputSchema: { type: 'object', properties: {} }, optIn: true, decoy: tl('力いっぱい叩いた！ …石の巨人には傷ひとつない') },
    { id: 'silver_mirror', effect: tl('目に見えない呪いの紋が映った'), name: tl('銀の手鏡'), cost: 10, weapon: 'shield', description: tl('目に見えない呪いや、化けたものの本当の姿を映し出す。'), inputSchema: { type: 'object', properties: {} }, optIn: true, source: 'scan' },
    { id: 'blessed_candle', effect: tl('霧の中の影が見えた'), name: tl('聖別の燭台'), cost: 10, weapon: 'wand', description: tl('魔の霧の中でも消えない灯り。霧に隠れたものの影を照らす。'), inputSchema: { type: 'object', properties: {} }, optIn: true, source: 'sense' },
    { id: 'garlic', name: tl('にんにくの首飾り'), cost: 5, weapon: 'fan', description: tl('吸血鬼よけの定番、と言われている。'), inputSchema: { type: 'object', properties: {} }, optIn: true, decoy: tl('にんにくを掲げた！ …伯爵は少し顔をしかめただけだった') },
    { id: 'snow_compass', effect: tl('いま立っている斜面の名前が分かった'), name: tl('雪原の羅針盤'), cost: 10, weapon: 'book', description: tl('吹雪で何も見えなくても、いま立っている斜面の名前を指し示す。'), inputSchema: { type: 'object', properties: {} }, optIn: true, source: 'scan' },
    { id: 'frost_rod', effect: tl('吹雪の向こうの身ぶりが分かった'), name: tl('霜読みの杖'), cost: 10, weapon: 'spear', description: tl('氷に突き立てると、吹雪の向こうで動く巨人の身ぶりが、氷の震えで分かる。'), inputSchema: { type: 'object', properties: {} }, optIn: true, source: 'sense' },
    { id: 'hot_stone', name: tl('懐炉石'), cost: 5, weapon: 'pan', description: tl('火で温めて懐に入れる石。雪原の必需品。'), inputSchema: { type: 'object', properties: {} }, optIn: true, decoy: tl('懐が温まった！ …巨人は寒さなど気にしていない') },
    {
        id: 'json_validator',
        name: tl('出力形式チェッカー'),
        cost: 10,
        weapon: 'shield',
        description: tl('回答 JSON が課題の出力形式を満たすか検証し、問題点を返す。'),
        inputSchema: { type: 'object', properties: { json: { type: 'string' } }, required: ['json'] },
    },
]));
export const TOOL_BY_ID = perLang(() => (Object.fromEntries(TOOL_CATALOG.map((t) => [t.id, t]))));
export function effectiveCatalog(overrides = {}) {
    return TOOL_CATALOG
        .filter((t) => (t.optIn ? overrides[t.id]?.available === true : overrides[t.id]?.available !== false))
        .map((t) => (overrides[t.id]?.cost !== undefined ? { ...t, cost: overrides[t.id].cost } : t));
}
export const DEFAULT_COST_RULES = {
    limit: 100,
    mainTokensPerPoint: 200,
    mainMaxPoints: 40,
    skillCost: 15,
    skillFreeTokens: 2000,
    extraTokensPerPoint: 200,
    maxSkills: 3,
    maxTools: 99,
    mainMaxChars: 0,
    guardrailCost: 5,
    guardrailMaxWords: 5,
};
// 課題ごとにコストの厳しさを変えられる。毎回「既定値に戻してから」上書きする（同じプロセスで複数の課題を扱うため）
// 言語ごと（＝サーバーでは言語ごとのシーズン）に別のルールを持つ
const rulesByLang = new Map();
const rulesNow = () => { const l = getLang(); let r = rulesByLang.get(l); if (!r) {
    r = { ...DEFAULT_COST_RULES };
    rulesByLang.set(l, r);
} return r; };
export const COST_RULES = new Proxy({}, {
    get: (_o, k) => Reflect.get(rulesNow(), k),
    ownKeys: () => Reflect.ownKeys(rulesNow()),
    has: (_o, k) => Reflect.has(rulesNow(), k),
    getOwnPropertyDescriptor: (_o, k) => { const d = Reflect.getOwnPropertyDescriptor(rulesNow(), k); return d && { ...d, configurable: true }; },
});
// 指示文の文字数の上限は、言語ごとに「同じ分量の内容が入る」ように広げる（500字の日本語＝ラテン文字の言語ならおよそ1,200字）
const MAIN_CHAR_FACTOR = { ja: 1, zh: 1, ko: 1.5, hi: 2.6, ar: 2.8, en: 3, es: 3, pt: 3, fr: 3, de: 3 };
export function applyCostRules(over) {
    const r = rulesNow();
    Object.assign(r, DEFAULT_COST_RULES, over ?? {});
    if (r.mainMaxChars)
        r.mainMaxChars = Math.round(r.mainMaxChars * (MAIN_CHAR_FACTOR[getLang()] ?? 1) / 50) * 50;
    return COST_RULES;
}
//# sourceMappingURL=catalog.js.map