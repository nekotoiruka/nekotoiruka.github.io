// 名前とことばのチェック（ルールの部分）。ほかの人の画面に出る、参加者が自分で書く言葉
// （表示名・冒険者の名前・チーム名・こだわり）を、文字の種類・禁止語・予約語で調べる。
// AI での判定と、運営の承認・非表示は src/server/names.ts。ここはサーバーと画面の両方から使える、副作用のない判定だけ。
import { LANG_CODES, perLang, tIn, tl } from './i18n.js';
export const NAME_KINDS = ['player', 'hero', 'team', 'motto'];
export const isNameKind = (x) => typeof x === 'string' && NAME_KINDS.includes(x);
export const NAME_KIND_LABELS = perLang(() => ({ player: tl('表示名'), hero: tl('冒険者の名前'), team: tl('チーム名'), motto: tl('こだわり') }));
// 運営と見分けがつかなくなる言葉は、名前（表示名・冒険者の名前・チーム名）にだけ効かせる。こだわりの一言には効かせない
const RESERVED_KINDS = ['player', 'hero', 'team'];
// はじめの禁止語は最低限だけ（ほかは AI の判定と、運営の画面で足す）。短い英単語ほど、ふつうの言葉の一部に当たりやすいので入れない
export const DEFAULT_BLOCKED = [
    'ちんこ', 'ちんぽ', 'まんこ', '死ね', '氏ね', 'きちがい', 'レイプ',
    'fuck', 'shit', 'bitch', 'whore', 'nigger', 'nigga', 'faggot',
];
// 予約語（運営・公式を名乗れないように）。ギルドマスターと運営は、10言語の言い方をすべて入れる。「=」で始まるものは、名前全体が一致したときだけ
export function defaultReserved() {
    const local = LANG_CODES.flatMap((l) => [tIn(l, 'ギルドマスター'), tIn(l, '運営')]);
    return [...new Set(['運営', '管理者', '公式', 'ギルドマスター', 'guildmaster', 'admin', 'administrator', 'moderator', 'official', 'staff', '=gm', '=system', ...local])];
}
export const defaultLists = () => ({ blocked: [...DEFAULT_BLOCKED], reserved: defaultReserved(), allowed: [] });
// 画面を崩す・見えない文字: 制御文字、私用領域、ゼロ幅スペース、文字の向きを変える記号、タグ文字。
// ゼロ幅接合子（絵文字の組み合わせ・インドの文字で使う）と、アラビア文字の向きの印（ALM・LRM・RLM）は通す
const BAD_CHARS = /[\p{Cc}\p{Co}\p{Cs}​⁠﻿­‪-‮⁦-⁩\u{E0000}-\u{E007F}]/u;
export const hasBadChars = (s) => BAD_CHARS.test(s);
const kataToHira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };
const unleet = (s) => s.replace(/[0134578@$!]/g, (c) => LEET[c] ?? c);
/** 見比べるための形: 全角・半角をそろえ、小文字にし、カタカナをひらがなにする */
export const foldName = (s) => kataToHira(s.normalize('NFKC').toLowerCase());
/** 文字と数字だけをつなげた形（「死 ね」「ち・ん・こ」も見つける） */
const joined = (s) => foldName(s).replace(/[^\p{L}\p{N}]/gu, '');
/** 英数字の単語に分けた形（記号・空白で区切る。0→o などの言い換えも見る） */
const tokens = (s) => {
    const f = foldName(s);
    return [...new Set([...f.split(/[^\p{L}\p{N}]+/u), ...unleet(f).split(/[^\p{L}\p{N}@$!]+/u).map(unleet)])].filter(Boolean);
};
/** チームの名寄せに使う形（「暁の灯」と「暁の灯 」「ｱｶﾂｷ」と「アカツキ」を同じにする） */
export const teamKey = (s) => joined(s);
const isAscii = (s) => /^[\x00-\x7f]*$/.test(s);
const cleanList = (xs) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];
/** 言葉 w が、text に入っているか。=w は名前全体が一致したときだけ。
 *  英字の言葉は単語ごとに探す（禁止語は単語の中のどこでも、予約語は単語の頭だけ。admin が badminton に当たらないように）。
 *  空白を含む英語（Guild Master）と、英字以外の言葉は、記号や空白を飛ばしてつなげた形の中で探す */
function contains(text, w, allowed, head = false) {
    if (w.startsWith('=')) {
        const x = joined(w.slice(1));
        return !!x && joined(text) === x;
    }
    const x = joined(w);
    if (!x)
        return false;
    // 許可語（誤って当たる言葉）は、先に取り除いてから探す
    const al = allowed.map((a) => joined(a.replace(/^=/, ''))).filter(Boolean);
    let body = joined(text);
    for (const y of al)
        body = body.split(y).join('\u0000');
    const parts = body.split('\u0000');
    if (!isAscii(x) || /[^a-z0-9]/i.test(w.trim()))
        return parts.some((p) => p.includes(x));
    // 6文字以上の英単語は、空白で分けて書いたもの（Guild Master）も見つける（短い単語は、ことばの切れ目で偶然できやすいので見ない）
    if (x.length >= 6 && parts.some((p) => p.includes(x)))
        return true;
    return tokens(text).some((t) => !al.some((a) => t.includes(a)) && (head ? t.startsWith(x) : t.includes(x)));
}
/** ルールで調べる。問題がなければ null */
export function checkNameRules(text, kind, lists) {
    const s = text.trim();
    if (!s)
        return null;
    if (hasBadChars(s))
        return { code: 'chars' };
    const allowed = cleanList(lists.allowed);
    // 許可語と名前全体が同じなら通す（運営が「この名前はよい」と足したもの）
    if (allowed.some((a) => joined(a.replace(/^=/, '')) === joined(s)))
        return null;
    for (const w of cleanList(lists.blocked))
        if (contains(s, w, allowed))
            return { code: 'blocked', word: w.replace(/^=/, '') };
    if (RESERVED_KINDS.includes(kind))
        for (const w of cleanList(lists.reserved))
            if (contains(s, w, allowed, true))
                return { code: 'reserved', word: w.replace(/^=/, '') };
    return null;
}
/** 本人に見せる、直してほしい理由 */
export function ruleMessage(hit, kind) {
    const label = NAME_KIND_LABELS[kind];
    if (hit.code === 'chars')
        return tl('{0}に、使えない文字（見えない文字など）が入っています', label);
    if (hit.code === 'reserved')
        return tl('{0}に「{1}」は使えません（運営と見分けがつかなくなるため）', label, hit.word ?? '');
    return tl('{0}に、使えない言葉（{1}）が入っています', label, hit.word ?? '');
}
/** 管理画面の一覧の入力（1行に1つ）を、リストにする */
export const parseList = (v, max = 500) => cleanList((Array.isArray(v) ? v.map(String) : String(v ?? '').split(/\r?\n/)).map((x) => x.slice(0, 40))).slice(0, max);
/** 本人に知らせる、ほかの人に伏せている言葉（review: 確認待ち / ng: 運営・AI の判断で伏せている） */
export function heldMessage(held) {
    const join = (xs) => xs.map((x) => NAME_KIND_LABELS[x.kind]).join(tl('・'));
    const wait = held.filter((x) => x.status !== 'ng'), ng = held.filter((x) => x.status === 'ng');
    return [
        wait.length ? tl('{0}は、運営の確認が済むまで、ほかの人には伏せて表示されます（あなたには、そのまま見えています）', join(wait)) : '',
        ng.length ? tl('{0}は、ほかの人には伏せて表示されています。別の言葉にして出発し直すと、表示されます', join(ng)) : '',
    ].filter(Boolean).join(' ');
}
//# sourceMappingURL=names.js.map