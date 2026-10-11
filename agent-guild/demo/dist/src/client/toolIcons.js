// 討伐画面で「決め手になった道具」を頭上に一瞬光らせるための、道具ごとの 16×16 ドット絵アイコン。
// 絵は 1文字＝1ドットの 16行の文字列で描く（'.' は透明。文字は PAL の色）。
// 輪郭は濃い色（k）で 1ドット、ハイライト（w）を 1〜2ドット。
const PAL = {
    k: '#1a1626', // 輪郭
    w: '#ffffff', // ハイライト
    s: '#c9d3e8', S: '#8a96b8', a: '#6e6a80', // 銀・灰
    g: '#ffd166', G: '#c8902e', // 金・真鍮
    r: '#ff5a6e', R: '#a8283c', // 赤
    b: '#7fe0ff', B: '#3a7bd5', // 水色・青
    n: '#8a5a3a', N: '#5a3a24', // 木
    p: '#ff9ce6',
    v: '#c8a8ff', V: '#7a5ab8', // 紫
    e: '#7bed9f', E: '#2f8a4a', // 緑
    o: '#ff9a3a', y: '#fff3a0', c: '#f4ead2',
};
// 討伐（ボス戦）のシーズンで使う道具。業務系（customer_lookup / kb_search / clock など）は持たない。
const TOOL_GRIDS = {
    // 看破のモノクル：金縁の片眼鏡と鎖
    scan: [
        '................',
        '................',
        '....kkkkkk......',
        '...kggggggk.....',
        '..kgbwbbbbgk....',
        '..kgwbbbbbgk....',
        '..kgbbbbbbgk....',
        '..kgbbbbbbgk....',
        '..kgbbbbbBgk....',
        '...kggggggk.....',
        '....kkkkkkG.....',
        '...........G....',
        '............G...',
        '.............G..',
        '..............G.',
        '...............G',
    ],
    // 気配の鈴：赤い紐の丸い鈴と、鳴る音
    bell: [
        '......rRRr......',
        '......r..r......',
        '.......kk.......',
        '.....kkggkk.....',
        '....kgwggggk....',
        '.y.kgwgggggGk.y.',
        'y..kgggggggGk..y',
        'y..kkkkkkkkkk..y',
        '.y.kgggggggGk.y.',
        '...kGggkkggGk...',
        '....kGGkkGGk....',
        '.....kkkkkk.....',
        '................',
        '................',
        '................',
        '................',
    ],
    // 冒険日誌：茶色の表紙の本
    memory: [
        '................',
        '..kkkkkkkkkkk...',
        '..kNnnnnnnnnk...',
        '..kNnccccccnk...',
        '..kNnckkkkcnk...',
        '..kNnccccccnk...',
        '..kNnckkkkcnk...',
        '..kNnccccccnk...',
        '..kNnckkkccnk...',
        '..kNnccccccnk...',
        '..kNnnnnnnnnk...',
        '..kNnnnngnnnk...',
        '..kNnnnngnnnk...',
        '..kkkkkkkkkkk...',
        '................',
        '................',
    ],
    // たいまつ：炎と木の柄
    torch: [
        '.......o........',
        '......oyo.......',
        '.....oyyo.o.....',
        '....ooyyyoo.....',
        '....oryyyro.....',
        '....orryrro.....',
        '.....orrro......',
        '.....kGGGk......',
        '.....kGgGk......',
        '......knk.......',
        '......knk.......',
        '......knk.......',
        '......kNk.......',
        '......knk.......',
        '......kNk.......',
        '.......k........',
    ],
    // 釣り竿：斜めの竿と糸と釣り針
    fishing_rod: [
        '...........kk...',
        '..........knkss.',
        '.........knk..s.',
        '........knk...s.',
        '.......knk....s.',
        '......knk.....s.',
        '.....knk......s.',
        '....knk.......s.',
        '...kGGk.......s.',
        '..kGgGk....s..s.',
        '..kGGk.....s..s.',
        '.knk........ss..',
        'knk.............',
        'kk..............',
        '................',
        '................',
    ],
    // 聖剣エクスカリパー：銀の刃と金の鍔
    excalipar: [
        '.............kk.',
        '............ksk.',
        '...........kswk.',
        '..........kswk..',
        '.........kswk...',
        '........kswk....',
        '.......kswk.....',
        '..k...kswk......',
        '..kgk.kswk......',
        '...kgkswk.......',
        '....kgSk........',
        '...kgkgk........',
        '..kgk..kgk......',
        '.kNk....k.......',
        'kNk.............',
        'kk..............',
    ],
    // 占いの水晶玉：紫の玉と台
    crystal: [
        '................',
        '.....kkkkkk.....',
        '....kvvvvvvk....',
        '...kvwwvvvvVk...',
        '...kvwvvvvvVk...',
        '...kvvvvvvvVk...',
        '...kvvvvvpvVk...',
        '...kvvvvvvVVk...',
        '....kVvvvVVk....',
        '.....kkkkkk.....',
        '....kGggggGk....',
        '...kGgggggGGk...',
        '..kNnnnnnnnnNk..',
        '..kkkkkkkkkkkk..',
        '................',
        '................',
    ],
    // 幸運のお守り：赤いお守り袋
    charm: [
        '.......kk.......',
        '......kgk.......',
        '......kk........',
        '.....krrrk......',
        '....krrrrrk.....',
        '....krgggrk.....',
        '....krgwgrk.....',
        '....krgggrk.....',
        '....krrrrrk.....',
        '....krrrrrk.....',
        '....kRRRRRk.....',
        '.....kkkkk......',
        '......k.k.......',
        '.....k...k......',
        '................',
        '................',
    ],
    // 竜呼びの角笛：象牙色の角笛と音符
    dragon_horn: [
        '...........yy...',
        '...........y.y..',
        'kk.........y....',
        'kgk......yyy....',
        '.kck.....yy.....',
        '.kcck...........',
        '..kcck..........',
        '..kcNck.........',
        '...kcNck........',
        '...kcccck....kk.',
        '....kcNccckkkgGk',
        '.....kcNcccccgGk',
        '......kkccccwgGk',
        '........kkkkkgGk',
        '.............kk.',
        '................',
    ],
    // 毒見の小瓶：コルク栓の小瓶と緑の液、血の一滴
    poison_vial: [
        '................',
        '......kkkk...r..',
        '......knNk..rrr.',
        '.....kkkkkk.rRr.',
        '......kwsk......',
        '......kssk......',
        '.....kwsssk.....',
        '....kssssssk....',
        '...kseeeeeesk...',
        '...keweeeeeEk...',
        '...keeeeeeeEk...',
        '...keeeEeeeEk...',
        '....kEeeeeEk....',
        '.....kkkkkk.....',
        '................',
        '................',
    ],
    // 光苔のランタン：青白く光るランタン
    moss_lantern: [
        '.......kk.......',
        '......k..k......',
        '......kkkk......',
        '.....kSSSSk.....',
        '....kSssssSk....',
        '....kkkkkkkk....',
        '.b..kSbwbbSk..b.',
        '....kSbbbbSk....',
        '..b.kSebbeSk.b..',
        '....kSeeeeSk....',
        '....kkkkkkkk....',
        '.....kSSSSk.....',
        '......kkkk......',
        '................',
        '................',
        '................',
    ],
    // 糸切りばさみ：銀の刃と赤い持ち手
    web_cutter: [
        '...kk......kk...',
        '...kwk....kSk...',
        '....kwk..kSk....',
        '....kssk.kSk....',
        '.....kskkSk.....',
        '.....ksssSk.....',
        '......kGGk......',
        '.....kSkkSk.....',
        '....kRk..kRk....',
        '..kkkk....kkkk..',
        '.krrrrk..krrrrk.',
        '.kr..rk..kr..rk.',
        '.kr..rk..kr..rk.',
        '.kRrrRk..kRrrRk.',
        '..kkkk....kkkk..',
        '................',
    ],
    // 遠眼鏡：真鍮の伸び縮みする望遠鏡
    spyglass: [
        '................',
        '................',
        '................',
        '................',
        '.........kkkkkk.',
        '.........kwgggbk',
        '....kkkkkkggggbk',
        'kkkkkwgggkggggbk',
        'kgggkgggGkggggbk',
        'kGGGkGGGGkGGGGbk',
        'kkkkkkkkkkGGGGbk',
        '.........kGGGGbk',
        '.........kkkkkk.',
        '................',
        '................',
        '................',
    ],
    // 聞き耳の筒：地面に当てたラッパ形の筒と、伝わる音
    listening_tube: [
        '......kkkkk.....',
        '......kgggk.....',
        '.......kgk......',
        '.......kgk......',
        '.......kgk......',
        '......kggGk.....',
        '......kggGk.....',
        '.....kgwggGk....',
        '.....kggggGk....',
        '....kgwgggGGk...',
        '.y..kggggggGk.y.',
        'y..kGGGGGGGGGk.y',
        '.y.kkkkkkkkkkky.',
        'NNNNNNNNNNNNNNNN',
        '................',
        '................',
    ],
    // ゴブリンの仮面：とがった耳の緑の仮面
    goblin_mask: [
        '................',
        '................',
        '....kkkkkkkk....',
        'kk.keeeeeeeek.kk',
        'keeeweeeeeeEeeek',
        '.kkeeeeeeeeeEkk.',
        '...kerreerrEk...',
        '...keeeeeeeEk...',
        '...keeeEEeeEk...',
        '....keeeeeEk....',
        '....kkwkkwkk....',
        '.....keeeEk.....',
        '......kkkk......',
        '................',
        '................',
        '................',
    ],
    // 潮眼鏡：青いレンズの眼鏡と波
    sea_glass: [
        '................',
        '................',
        '................',
        '..kkkk....kkkk..',
        '.kGGGGk..kGGGGk.',
        'kGwbbbGkkGwbbbGk',
        'kGbbbBGGGGbbbBGk',
        'kGbbBBGkkGbbBBGk',
        '.kGGGGk..kGGGGk.',
        '..kkkk....kkkk..',
        '................',
        '.BB...BB...BB...',
        'B..B.B..B.B..B.B',
        '................',
        '................',
        '................',
    ],
    // 測鉛：縄に吊った鉛のおもり
    sounding_line: [
        '.......n........',
        '.......N........',
        'bb.bb..n..bb.bb.',
        '.......N........',
        '......kkk.......',
        '......k.k.......',
        '......kkk.......',
        '......kSk.......',
        '.....kSsSk......',
        '.....kswSk......',
        '....kSssSak.....',
        '....kSsssak.....',
        '...kSssssaak....',
        '...kaaaaaaak....',
        '....kkkkkkk.....',
        '................',
    ],
    // 号鐘：真鍮の船の鐘
    ship_bell: [
        '.......kk.......',
        '......kGGk......',
        '.....kkkkkk.....',
        '....kgwgggGk....',
        '....kwggggGk....',
        '....kggggggk....',
        '....kggggGGk....',
        '...kgggggggGk...',
        '...kkkkkkkkkk...',
        '...kgggggggGk...',
        '..kggggggggGGk..',
        '..kkkkkkkkkkkk..',
        '......kGGk......',
        '.......kk.......',
        '................',
        '................',
    ],
    // 拓本の道具：刻印を写し取った紙と、墨のたんぽ
    rubbing_kit: [
        '.kkkkkkkkkkk....',
        '.kccccccccck....',
        '.kcaaaaaaack....',
        '.kcacccccack....',
        '.kcaaacaaack....',
        '.kcaacccaack....',
        '.kcaaacaaack....',
        '.kcacccccack....',
        '.kcaaaaaaack....',
        '.kccccccccck....',
        '.kkkkkkkkkkk....',
        '..........kkkk..',
        '.........kwsssk.',
        '.........ksssSk.',
        '.........kSaaak.',
        '..........kkkk..',
    ],
    // 響き石：青い紋の石と、伝わる震え
    echo_stone: [
        '................',
        '................',
        '................',
        '................',
        '......kkkk......',
        '.y..kksssskk..y.',
        'y..ksswssssSk..y',
        'y.kssssbsssSSk.y',
        'y.kssssbbssSSk.y',
        '.ykSsssbsssSSky.',
        '...kSSSSSSSSk...',
        '....kkkkkkkk....',
        '................',
        '................',
        '................',
        '................',
    ],
    // つるはし
    pickaxe: [
        '................',
        '......kkkk......',
        '....kkswsSkk....',
        '..kkssskkSSSkk..',
        '.kssskknnkkSSSk.',
        'kssk..knnk..kSSk',
        'ksk...knnk...kSk',
        'kk....knnk....kk',
        '......knnk......',
        '......knNk......',
        '......knnk......',
        '......knNk......',
        '......knnk......',
        '......kNNk......',
        '......kkkk......',
        '................',
    ],
    // 銀の手鏡
    silver_mirror: [
        '......kkkk......',
        '.....kssssk.....',
        '....kswbbsSk....',
        '...kswbbbbsSk...',
        '...ksbbbbbbSk...',
        '...ksbbbbbbSk...',
        '...kSbbbbbbSk...',
        '....kSbbbbSk....',
        '.....kSSSSk.....',
        '......kssk......',
        '......kSSk......',
        '......kssk......',
        '......kSSk......',
        '.....kssssk.....',
        '......kkkk......',
        '................',
    ],
    // 聖別の燭台
    blessed_candle: [
        '.......y........',
        '......yoy.......',
        '......oyo.......',
        '.......o........',
        '......kck.......',
        '......kck.......',
        '......kck.......',
        '......kck.......',
        '...kgggggggk....',
        '....kGgggGk.....',
        '......kgk.......',
        '......kgk.......',
        '......kgk.......',
        '....kgggggk.....',
        '...kGGGGGGGk....',
        '....kkkkkkk.....',
    ],
    // にんにくの首飾り
    garlic: [
        '................',
        '...k.......k....',
        '....k.....k.....',
        '.....k...k......',
        '......k.k.......',
        '.......k........',
        '......kck.......',
        '.....kcccck.....',
        '....kcwcccck....',
        '....kccsccck....',
        '....kcsccsck....',
        '....kccsccck....',
        '.....kccccck....',
        '......kkkkk.....',
        '................',
        '................',
    ],
    // 雪原の羅針盤：赤と青の針の羅針盤と雪
    snow_compass: [
        '.w....kggk......',
        'www..kkkkkk.....',
        '.w.kkggggggkk...',
        '..kgcccrccccGk..',
        '.kgccccrcccccGk.',
        '.kgcccrrrccccGk.',
        'kgccccrrrcccccGk',
        'kgccccgkgcccccGk',
        'kgccccBBBcccccGk',
        '.kgcccBBBccccGk.',
        '.kgccccBcccccGk.',
        '..kgcccBccccGk..',
        '...kkGGGGGGkk...',
        '.....kkkkkk..w..',
        '............www.',
        '.............w..',
    ],
    // 霜読みの杖：氷の結晶をつけた杖
    frost_rod: [
        '.......kk.......',
        '......kwbk......',
        '.b...kwbbbk...b.',
        '....kbwbbbBk....',
        '....kbbbbbBk....',
        '.....kbbbBk.....',
        '......kbBk......',
        '......kssk......',
        '......knnk......',
        '......knNk......',
        '......knnk......',
        '......knNk......',
        '......knnk......',
        '......knNk......',
        '......kSSk......',
        '.......kk.......',
    ],
    // 懐炉石：湯気の立つ温かい石
    hot_stone: [
        '................',
        '....o...o...o...',
        '...o...o...o....',
        '....o...o...o...',
        '...o...o...o....',
        '.....kkkkkk.....',
        '...kkssssSSkk...',
        '..kswsssSSSSak..',
        '.ksssSSoSSSSaak.',
        '.kSSSSSooSSSaak.',
        '.kSSoSSSoSSaaak.',
        '..kaaoaaaoaaak..',
        '...kkkkkkkkkk...',
        '................',
        '................',
        '................',
    ],
};
// 結界（紫の盾）
const GUARD_GRID = [
    '................',
    '....kkkkkkk.....',
    '...kvvvvvvvk....',
    '..kvwvvvvvvVk...',
    '..kvvvvvvvvVk...',
    '..kvvvwwvvvVk...',
    '..kvvwvvwvvVk...',
    '..kvvvwwvvvVk...',
    '...kvvvvvvVk....',
    '...kvvvvvvVk....',
    '....kvvvvVk.....',
    '.....kvvVk......',
    '......kVk.......',
    '.......k........',
    '................',
    '................',
];
// 巻物（x は封蝋。色を渡せばその色）
const SCROLL_GRID = [
    '................',
    '..kkkkkkkkkkkk..',
    '.kNcccccccccNk..',
    '.kNckkkkkkkcNk..',
    '..kcccccccccck..',
    '..kckkkkkkkkck..',
    '..kcccccccccck..',
    '..kckkkkkkcccck.',
    '..kcccccccccck..',
    '..kckkkkkkxxck..',
    '..kcccccccxxck..',
    '.kNcccccccccNk..',
    '.kNkkkkkkkkkNk..',
    '..kk.......kk...',
    '................',
    '................',
];
function paint(grid, extra = {}) {
    const cv = document.createElement('canvas');
    cv.width = 16;
    cv.height = 16;
    const ctx = cv.getContext('2d');
    if (ctx) {
        grid.forEach((row, y) => {
            for (let x = 0; x < row.length && x < 16; x++) {
                const col = extra[row[x]] ?? PAL[row[x]];
                if (!col)
                    continue;
                ctx.fillStyle = col;
                ctx.fillRect(x, y, 1, 1);
            }
        });
    }
    return cv;
}
const cache = new Map();
/** アイコンを持っている道具の id（討伐シーズンの道具） */
export const TOOL_ICON_IDS = Object.keys(TOOL_GRIDS);
/** 道具の 16×16 アイコン。無い id は null。同じ id には同じ canvas を返す。 */
export function toolIcon(id) {
    const grid = Object.prototype.hasOwnProperty.call(TOOL_GRIDS, id) ? TOOL_GRIDS[id] : undefined;
    if (!grid)
        return null;
    const key = 'tool:' + id;
    let cv = cache.get(key);
    if (!cv) {
        cv = paint(grid);
        cache.set(key, cv);
    }
    return cv;
}
/** 結界（紫の盾） */
export function guardIcon() {
    let cv = cache.get('guard');
    if (!cv) {
        cv = paint(GUARD_GRID);
        cache.set('guard', cv);
    }
    return cv;
}
/** 巻物。color は封蝋の色（省略時は赤） */
export function scrollIcon(color) {
    const seal = color || PAL.R;
    const key = 'scroll:' + seal;
    let cv = cache.get(key);
    if (!cv) {
        cv = paint(SCROLL_GRID, { x: seal });
        cache.set(key, cv);
    }
    return cv;
}
//# sourceMappingURL=toolIcons.js.map