// 先輩の助言: 出発の前に、先輩冒険者（歴戦の侍）が準備を見て、仕組みの抜けを教える。口調は冒険者の先輩らしく、ぶっきらぼうで面倒見がいい。
// AI は呼ばない（費用ゼロ・すぐ返る・何回でも）。見るのは準備の中身と、募集要項に公開されていることだけ。
//
// 方針（2026-10-31 見直し）: 言うのは「本物の採点で、AI の判断ではなくコードで決まっている仕掛け」だけ。
//   - 幻術: 結界の言葉が幻術の文に含まれるかで決まる（心得に「従わない」と書いても防げない）→ 結界が空なら指摘。心得の中身は見ない
//   - 記憶: 冒険日誌の道具がないと、前の場面は見えない → 記憶の場面があるのに日誌がなければ指摘
//   - 行動力: 1場面の上限を超えると打ち切り → 分厚い書物を冒険者が持つと、その書物の重さを数字で示す
//   - お供: お供の道具でしか調べられない → お供に道具がなければ指摘
//   - 巻物: 説明（いつ読むか）は AI にそのまま渡る → 空なら指摘（中身が「いつ」になっているかは判定しない）
// 心得の書き方（矢印・言い回し・道具の名前が出てくるか）は、言葉を理解しないと判定できないので、ここでは言わない。
// 中身を見てほしいときは「詳しく見てもらう」（AI・回数制限あり・本物の AI で採点しているときだけ）へ。
// コーチングであってティーチングではない: どの道具が要るか・行動の名前・資料の中身は言わない。
import { companionToolsOf } from './build.js';
import { tl } from './i18n.js';
import { toolAp } from './catalog.js';
export function coach(b, t) {
    const items = [];
    const add = (part, level, text) => items.push({ part, level, text });
    const chars = [...b.main.prompt.trim()].length;
    const toolOf = (id) => t.tools.find((x) => x.id === id);
    const has = (s) => t.scenes.includes(s);
    const allTools = [...b.tools]; // 道具は冒険者とお供で共有（issue #83）
    // 心得（システムプロンプト）: ほぼ空のときだけ（中身の良し悪しは言わない）
    if (chars < 40)
        add('prompt', 'warn', tl('心得がほとんど空っぽだな。新米は、最初は何ひとつ知らん。ボスがこう動いたら、こう動け——それを、お前の言葉で叩きこんでやれ。'));
    // 道具（ツール）: ひとつも持っていないとき。どの道具が要るかは言わない
    if (!allTools.length)
        add('tools', 'warn', tl('道具をひとつも持たせていないな。考えても分からんこと（いまの様子、見えない敵の動き）が起きたら、そいつは勘で斬りかかるしかない。募集要項の「戦場で起きること」と、道具の説明を見比べてみろ。'));
    // 心得に道具の名前が出てくる: 使い方は、道具の名前と説明がもう冒険者に伝えている（2026-11-07・issue #58 #3。問いかけで気づかせる）
    const named = b.tools.map((id) => toolOf(id)?.name).filter((n) => !!n && [...n].length >= 2 && b.main.prompt.includes(n));
    if (named.length)
        add('tools', 'tip', tl('心得に、道具の名前が出てくるな。道具の名前と説明は、心得と並んでもう冒険者に渡っておる。心得で同じことを言う必要があるか？ 使ってはならん場面があるなら、それだけを書けば足りんか？'));
    // 分厚い書物を持たせた: 冒険者が自分で読むか、お供に任せるか（2026-11-10・issue #83 から行動力切れはなく、速さと燃費のトレードオフ）。問いかけで気づかせる
    for (const id of b.tools) {
        const h = toolOf(id)?.heavy;
        if (!h || h <= t.apCap * 0.4)
            continue;
        const nm = toolOf(id).name;
        if (!b.companion)
            add('tools', 'tip', tl('「{0}」は、読むだけで行動力を約{1}も使う分厚いものだ。冒険者が自分で読めば速いが、読んだものはそのあと考えるたびに読み直すから、燃費がかさむ。速さと燃費、この戦いで大事なのはどっちだ？', nm, h.toLocaleString()));
        else if (!b.main.prompt.includes(nm))
            add('companion', 'tip', tl('「{0}」は、冒険者にもお供にも見えている。冒険者が自分で読むか、お供に任せるかは、冒険者が決める。自分で読めば速いが燃費がかさみ、お供に任せれば安いが往復のぶん遅い。どっちにさせたいかは、心得に書いてあるか？', nm));
    }
    // 巻物（スキル）: 「いつ読むか」が空（AI には巻物の名前しか見えない）
    // 巻物は、名前と説明（何の巻物で、いつ開くか）を見て、冒険者が自分で開く（2026-11-06）。心得に巻物の名前を書いてあっても、説明が空なら「！」
    //（以前は、心得に巻物の名前があれば言わなかった。それでは「心得に巻物の使い方を書く」ほうへ導いてしまう）
    const noWhen = b.skills.filter((s) => !s.description.trim());
    if (noWhen.length)
        add('skills', 'warn', tl('巻物「{0}」は、説明が空だ。冒険者に見えるのは、巻物の名前と説明だけ。何の巻物で、いつ開くかを説明に書いておかんと、要る場面で開かれんぞ。', noWhen.map((s) => s.name).join('」「')));
    if (!b.skills.length && t.hasScrolls)
        add('skills', 'tip', tl('巻物を一本も持っていないな。資料室には、心得に収まりきらんほどの知識が眠っている。場面を選んで使う手順や知識は、巻物にして説明を書いておく手もあるぞ。'));
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
            add('guard', 'warn', tl('戦場には、偽の声が割りこんでくるらしい。あれは耳に入った瞬間に効く。耳に届く前に止める手立てが要るぞ。'));
        else if (words.some((w) => [...w].length <= 1))
            add('guard', 'tip', tl('結界の言葉に、1文字だけのものがあるな。その文字を含む声は全部止まる。本物の仲間の声まで止めちまうかもしれんぞ。'));
        else
            add('guard', 'good', tl('結界は張ってあるな。本物の仲間の声まで止めていないかは、帰ってきたらギルドマスターに聞いてみろ。'));
    }
    // お供（サブエージェント）
    const heavyAll = t.tools.filter((x) => x.heavy && x.heavy > t.apCap * 0.4);
    if (b.companion) {
        const pt = companionToolsOf(b);
        if (!pt.length)
            add('companion', 'warn', tl('お供が使える道具がないな。お供は、使える道具でしか調べられんぞ。'));
        // 道具と巻物は冒険者と共有（2026-11-10・issue #83）。全部を見せると、お供の頭にも全部の目録が載る（本物で、お供の燃費がかさみ、選び間違いの元になる）
        else if (!b.companion.tools && pt.length >= 4)
            add('companion', 'tip', tl('お供にも、持ち物を全部使わせているな。お供の頭にも、全部の道具と巻物の目録が載る。お供の役目に要らんものまで、見せる必要はあるか？'));
        // 何を頼むかは冒険者が決める。心得に書くのは、頼んではならん場面だけ
        else
            add('companion', 'good', tl('お供を連れているな。何を頼むかは、冒険者が決める。心得に書くのは、お供に頼んではならん場面や、自分では読まずお供に任せたいものがあるときだけでいい。どう調べて何を返すかは、お供の心得に書いておけ。'));
    }
    // 分厚い書物は、道具でしか読めない（採点の決まり）。冒険者もお供も持っていなければ、それが要る場面は解けない（実測でも点が下がる: docs/REAL.md）
    // 検索の道具（索引など）でも、分厚い資料から要る行を引ける（2026-11-07・issue #58）
    if (heavyAll.length && !allTools.some((id) => toolOf(id)?.heavy || toolOf(id)?.search))
        add('companion', 'warn', tl('今度の相手には、とんでもなく分厚い資料が付きものらしい。いまの持ち物で、そいつを調べられる者はおるか？'));
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
        tools: catalog.map((x) => ({ id: x.id, name: x.name, ...(x.source === 'archive' ? { heavy: toolAp(x) } : {}), ...(x.search ? { search: true } : {}) })),
    };
}
//# sourceMappingURL=coach.js.map