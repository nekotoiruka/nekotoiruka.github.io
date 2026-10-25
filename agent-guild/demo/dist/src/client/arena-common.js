import { tl } from '../shared/i18n.js';
export const SCALE = 2;
export const OUTRO = 1.4; // 試合後の余韻（ウェーブ何個分）
export const ease = (t) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t));
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = (t) => Math.max(0, Math.min(1, t));
export const win01 = (p, a, b) => clamp01((p - a) / (b - a)); // 区間の進み具合 0→1
export const bump = (p, a, b) => (p < a || p > b ? 0 : Math.sin(((p - a) / (b - a)) * Math.PI));
export const KO_TIME = 0.14;
export const IMPACT = 0.42;
// 連携詠唱のテンポ: 各区間を何倍ゆっくり見せるか（節の詠唱・叫び・タメ・着弾・着弾のあと）
export const CHAIN_TEMPOS = {
    brisk: { label: '速め（前の版）', verse: 1, shout: 1, charge: 1, impact: 1, after: 0.45 },
    calm: { label: 'ゆったり', verse: 1.2, shout: 1.5, charge: 1.8, impact: 1.8, after: 1.5 },
    grand: { label: 'じっくり', verse: 1.5, shout: 2, charge: 2.4, impact: 2.4, after: 2 },
};
export const MINE_BAND = [0.43, 0.58]; // あなたの青い帯（自分の行動の一文）。ボスの技が届いて、かわした・くらったのを見せた直後
// 詠唱の文を、同じ長さの古代文字に置きかえる（見る人に答えを見せないとき）
export const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
export const runeLine = (s0, k) => [...s0].map((ch, j) => (/\s/.test(ch) ? tl('　') : RUNES[(ch.charCodeAt(0) * 7 + j * 3 + k * 5) % RUNES.length])).join('');
export const GAG = [0.06, 0.27]; // 役に立たない道具のギャグを見せる区間（ボスが構える前）
export const GUARD_HIT = 0.36; // 幻術の声が冒険者に届く（結界に当たる）瞬間
export const TOOL_SHORT = {
    kb_search: tl('ナレッジ検索'), customer_lookup: tl('顧客台帳'), history_lookup: tl('履歴照会'),
    regex_matcher: tl('正規表現'), calculator: tl('計算機'), clock: tl('時計'), json_validator: tl('形式チェック'), scan: tl('看破'), memory: tl('冒険日誌'), bell: tl('気配の鈴'), guardrail: tl('結界'),
};
export const EVADE_LABEL = { dodge: tl('よけた！'), block: tl('ガード！'), barrier: tl('はじいた！'), shoot: tl('撃ち落とした！'), slash: tl('斬った！'), jump: tl('跳んだ！'), crawl: tl('伏せた！'), step: tl('すり抜けた！'), turn: tl('受け止めた！'), turnCut: tl('斬り返した！'), chant: tl('打ち消した！'), resist: tl('弾いた！') };
export const AGILE = new Set(['ninja', 'rogue', 'cat', 'bunny', 'frog', 'ghostie']);
export const NO_GEAR = { back: [], fams: [], charms: [] };
/** 討伐の1場面にかける秒数（再生の画面と同じ） */
export const WAVE_SECONDS = 6;
//# sourceMappingURL=arena-common.js.map