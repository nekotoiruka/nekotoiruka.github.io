// 抽選で変わる場面の見出し: 引いた番号（variant）の見出しがあればそれを、無ければ場面の一般的な見出しを使う
export function caseTitleOf(cm, variant) {
    return (variant !== undefined ? cm.variantTitles?.[variant] : undefined) ?? cm.title;
}
// 回答の抜粋（excerpt）に付ける注釈との境目。画面では見えない文字で、注釈（「でも幻術は…」など）を切り離すのに使う
export const NOTE_MARK = '\u2063';
//# sourceMappingURL=types.js.map