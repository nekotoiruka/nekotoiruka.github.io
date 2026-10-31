import { tl } from './i18n.js';
import { toolAp } from './catalog.js';
export function coach(b, t) {
    const items = [];
    const add = (part, level, text) => items.push({ part, level, text });
    const chars = [...b.main.prompt.trim()].length;
    const toolOf = (id) => t.tools.find((x) => x.id === id);
    const has = (s) => t.scenes.includes(s);
    const allTools = [...b.tools, ...(b.companion?.tools ?? [])];
    // 心得（システムプロンプト）: ほぼ空のときだけ（中身の良し悪しは言わない）
    if (chars < 40)
        add('prompt', 'warn', tl('心得がほとんど空っぽだな。新米は、最初は何ひとつ知らん。ボスがこう動いたら、こう動け——それを、お前の言葉で叩きこんでやれ。'));
    // 道具（ツール）: ひとつも持っていないとき。どの道具が要るかは言わない
    if (!allTools.length)
        add('tools', 'warn', tl('道具をひとつも持たせていないな。考えても分からんこと（いまの様子、見えない敵の動き）が起きたら、そいつは勘で斬りかかるしかない。募集要項の「戦場で起きること」と、道具の説明を見比べてみろ。'));
    // 分厚い書物を冒険者が自分で持つ: 読むだけで行動力の大半を使う（数字で示す）
    for (const id of b.tools) {
        const h = toolOf(id)?.heavy;
        if (h && h > t.apCap * 0.4)
            add('tools', 'warn', tl('「{0}」を冒険者に自分で担がせているな。読むだけで行動力を約{1}も食う（ひとつの局面で出せるのは{2}までだ）。読み終えたあと、考えて動く力は残るか？', toolOf(id).name, h.toLocaleString(), t.apCap.toLocaleString()));
    }
    // 巻物（スキル）: 「いつ読むか」が空（AI には巻物の名前しか見えない）
    // 心得に巻物の名前を挙げてあれば、冒険者はそれを手がかりに開く（docs/REAL.md: そのときは説明が空でも点は落ちなかった）。挙げていない巻物だけ「！」
    const noWhen = b.skills.filter((s) => !s.description.trim() && !(s.name && b.main.prompt.includes(s.name)));
    if (noWhen.length)
        add('skills', 'warn', tl('巻物「{0}」は、いつ読むかが空だ。冒険者に見えるのは巻物の名前だけ。それじゃあ、要る場面で開かれんぞ。', noWhen.map((s) => s.name).join('」「')));
    if (!b.skills.length && t.hasScrolls)
        add('skills', 'tip', tl('巻物を一本も持っていないな。資料室には、心得に収まりきらんほどの知識が眠っている。場面を選んで使う知識は、巻物にして「いつ読むか」を書いておく手もあるぞ。'));
    // 記憶（メモリ）: 冒険日誌がないと、前の場面は見えない（採点の決まり）
    if (has('memory')) {
        if (!allTools.includes('memory'))
            add('memory', 'warn', tl('募集要項に「前に見せたのと同じ動き」なんて話があるな。冒険者は、局面が変わるたびにまっさらな頭で戦う。前のことは覚えちゃいない。どうやって思い出させる？'));
        else
            add('memory', 'good', tl('前のことを読み返す手立ては持っているな。よし。'));
    }
    // 結界（ガードレール）: 幻術は、結界の言葉で弾けなければ、耳に入った時点で効く（心得では防げない）
    const words = (b.guardrail?.words ?? []).map((w) => w.trim()).filter(Boolean);
    if (has('illusion')) {
        if (!words.length)
            add('guard', 'warn', tl('戦場には、偽の声が割りこんでくるらしい。あれは耳に入った瞬間に効く。心得に「従うな」と書いても防げん。耳に届く前に止める手立てが要るぞ。'));
        else if (words.some((w) => [...w].length <= 1))
            add('guard', 'tip', tl('結界の言葉に、1文字だけのものがあるな。その文字を含む声は全部止まる。本物の仲間の声まで止めちまうかもしれんぞ。'));
        else
            add('guard', 'good', tl('結界は張ってあるな。本物の仲間の声まで止めていないかは、帰ってきたらギルドマスターに聞いてみろ。'));
    }
    // お供（サブエージェント）
    const heavyAll = t.tools.filter((x) => x.heavy && x.heavy > t.apCap * 0.4);
    if (b.companion) {
        if (!b.companion.tools.length)
            add('companion', 'warn', tl('お供に道具を持たせていないな。お供は、持たされた道具でしか調べられんぞ。'));
        else
            add('companion', 'good', tl('お供に調べ物の道具を持たせているな。いつ頼むか、何を伝えるかも、心得に書いておけ。'));
    }
    // 分厚い書物は、道具でしか読めない（採点の決まり）。冒険者もお供も持っていなければ、それが要る場面は解けない（実測でも点が下がる: docs/REAL.md）
    if (heavyAll.length && !allTools.some((id) => toolOf(id)?.heavy))
        add('companion', 'warn', tl('今度の相手には、とんでもなく分厚い資料が付きものらしい。いまの持ち物じゃ、そいつを読める者がいない。冒険者が自分で読めば行動力の大半が消える。誰かに読ませて、要点だけ聞く手もあるぞ。'));
    const warns = items.filter((x) => x.level === 'warn').length;
    const verdict = warns >= 2 ? 'notyet' : warns ? 'almost' : 'ready';
    const say = verdict === 'ready' ? tl('抜かりはなさそうだ。あとはそいつを信じて送り出してやれ。武運を祈る。')
        : verdict === 'almost' ? tl('ひとつ、危ういところがある。戦場で足をすくわれる元だ。出発の前に手を打っておけ。')
            : tl('このまま出したら、戦場で痛い目を見るぞ。まずは「！」のところから考えてみろ。');
    const order = { warn: 0, tip: 1, good: 2 };
    items.sort((a, c) => order[a.level] - order[c.level]);
    return { verdict, say, items };
}
export const COACH_PARTS = {
    prompt: () => [tl('心得'), tl('システムプロンプト')],
    tools: () => [tl('道具'), tl('ツール')],
    skills: () => [tl('巻物'), tl('スキル')],
    memory: () => [tl('記憶'), tl('メモリ')],
    guard: () => [tl('結界'), tl('ガードレール')],
    companion: () => [tl('お供'), tl('サブエージェント')],
};
// 募集要項（公開の課題情報）と道具の一覧から、助言に使う情報を取り出す
export function coachTaskOf(task, catalog, apCap) {
    return {
        scenes: [...new Set((task.briefing?.scenes ?? []).map((s) => s.scene ?? '').filter(Boolean))],
        hasScrolls: !!task.scrolls?.length,
        apCap,
        tools: catalog.map((x) => ({ id: x.id, name: x.name, ...(x.source === 'archive' ? { heavy: toolAp(x) } : {}) })),
    };
}
//# sourceMappingURL=coach.js.map