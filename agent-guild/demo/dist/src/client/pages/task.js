import { demoMode, getMe, getSeason } from '../api.js';
import { entryCard, loginForm } from '../account.js';
import { h, nodes } from '../ui.js';
import { tl } from '../../shared/i18n.js';
// 募集要項（常設）: シーズンに関係なく、冒険者（AIエージェント）の育て方と、参加の流れ。
// 今シーズンのボスの情報は、準備画面ではじめて出す
const MECHS = [
    { icon: '📜', name: tl('心得'), ai: tl('システムプロンプト'), what: tl('冒険者が毎回いちばん最初に読む教え。'), when: tl('覚えておけば対処できること。'), tip: tl('毎回読むので、長いほど荷物が重くなります。書ける量にも限りがあります。') },
    { icon: '🧰', name: tl('道具'), ai: tl('ツール'), what: tl('冒険者が自分で使って、その場の情報を取ってくるもの。'), when: tl('冒険者が自分では知り得ないこと。'), tip: tl('持っているだけで重く、使うたびに時間がかかります。いつ使うかは冒険者が自分で決めます。') },
    { icon: '📒', name: tl('冒険日誌'), ai: tl('メモリ'), what: tl('道具のひとつ。これまでの回に起きたことを、冒険者があとから読み返せます。記憶を補う特別な道具なので、ほかの道具とは分けて紹介します。'), when: tl('「さっき」「最初の回」など、前の出来事を踏まえる場面。'), tip: tl('冒険者は、回が変わるたびに前のことを忘れています。道具と同じく、持たせるだけでなく「いつ読み返すか」を心得に書きます。') },
    { icon: '📚', name: tl('巻物'), ai: tl('スキル'), what: tl('発動条件の場面でだけ開いて読む知識。自分で書くこともできます。'), when: tl('量が多く、ときどきしか要らない知識。'), tip: tl('発動条件（いつ読むか）を書いておくと、その場面で開かれます。') },
    { icon: '🛡', name: tl('結界'), ai: tl('ガードレール'), what: tl('決めた言葉を含む声を、冒険者の耳に届く前に消す仕掛け。'), when: tl('冒険者に聞かせたくない声。'), tip: tl('AIの外側で止めるので、AIは何も聞きません。どの言葉で止めるかは、あなたが決めます。') },
];
export async function renderTask(root) {
    root.replaceChildren(h('p', { class: 'loading' }, tl('読み込み中…')));
    const s = await getSeason();
    const R = s.costRules;
    let me = await getMe().catch(() => null);
    const join = h('div', { class: 'join' });
    const renderJoin = () => {
        const after = (m) => { me = m; renderJoin(); };
        if (demoMode) {
            join.replaceChildren(h('a', { class: 'btn btn-primary', href: '#/make' }, tl('準備してみる（デモ）')));
            return;
        }
        if (!me) {
            join.replaceChildren(h('div', { class: 'login-card' }, h('h3', {}, tl('討伐隊に加わる')), loginForm(s, after)));
            return;
        }
        if (!me.entered) {
            join.replaceChildren(entryCard(s, me, (m) => { me = m; location.hash = '#/make'; }));
            return;
        }
        join.replaceChildren(h('p', {}, tl(`{0} さんは、討伐隊に加わっています。`, me.name)), h('a', { class: 'btn btn-primary', href: '#/make' }, tl('冒険者の準備へ')));
    };
    renderJoin();
    root.replaceChildren(...nodes(h('article', { class: 'brief' }, h('p', { class: 'eyebrow' }, tl('冒険者ギルド　常設')), h('h1', { class: 'brief-title' }, tl('冒険者募集要項'), h('span', { class: 'brief-sub' }, tl('冒険者（AIエージェント）の育て方'))), h('p', { class: 'lead' }, tl('ギルドには、シーズンごとに強大なボスの討伐依頼が届きます。あなたは冒険者の「育て役」。冒険者は、あなたが教えたことと持たせたものだけを頼りに、自分で考えて戦います。戦場では、あなたは口を出せません。')), h('h2', {}, tl('参加の流れ')), h('ol', { class: 'flow' }, h('li', {}, h('b', {}, tl('討伐隊に加わる')), h('span', {}, tl('名前と合言葉で登録して、エントリーします（このページの下）。'))), h('li', {}, h('b', {}, tl('討伐依頼を読む')), h('span', {}, tl('準備画面で、今シーズンのボスと、戦場で起きること、資料室の資料を確かめます。'))), h('li', {}, h('b', {}, tl('冒険者を準備する')), h('span', {}, tl('心得・道具・巻物・結界を、荷物の重さの範囲で選びます。'))), h('li', {}, h('b', {}, tl('試走して、送り出す')), h('span', {}, tl('例の場面で試してから送り出すと、本物のAIが冒険者として戦います（数分）。'))), h('li', {}, h('b', {}, tl('講評・討伐・戦果を見る')), h('span', {}, tl('ギルドマスターの講評（S〜D）で良かったところと直すところが分かります。討伐の様子を見て、戦果の順位を確かめます。'))), h('li', {}, h('b', {}, tl('冒険の記録を読んで、直す')), h('span', {}, tl('場面ごとに、冒険者が何を聞き、どの道具や巻物を使い、何を考えてどう動いたかを読めます。外した場面の「考え」を読めば、心得・道具・巻物のどれが足りなかったかが見えてきます。直して、また送り出します。')))), h('h2', {}, tl('冒険者に持たせられるもの')), h('p', {}, tl('どれも「冒険者が自分では知り得ないこと」を補うためのものです。かっこ内は、AIエージェントの仕組みでの呼び名です。')), h('div', { class: 'mech-grid' }, ...MECHS.map((m) => h('div', { class: 'mech-card' }, h('div', { class: 'mech-head' }, h('span', { class: 'prepare-icon' }, m.icon), h('b', {}, m.name), h('span', { class: 'ai-term' }, m.ai)), h('p', {}, m.what), h('dl', { class: 'scroll-dl small' }, h('dt', {}, tl('出番')), h('dd', {}, m.when), h('dt', {}, tl('コツ')), h('dd', {}, m.tip))))), h('h2', {}, tl('こんな場面には、こんな準備')), h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', {}, tl('戦場で起きること')), h('th', {}, tl('冒険者に必要なもの')), h('th', {}, tl('準備')))), h('tbody', {}, h('tr', {}, h('td', {}, tl('ゴブリンの群れが弓を構えた。ギルドでは「弓には盾を掲げて受け流す」と教わっている')), h('td', {}, tl('覚えておけば分かる知識')), h('td', {}, h('b', {}, tl('心得')))), h('tr', {}, h('td', {}, tl('洞窟の暗がりで、敵の数も位置も分からない。見ればすぐに分かるのに')), h('td', {}, tl('その場で調べる手段')), h('td', {}, h('b', {}, tl('道具')))), h('tr', {}, h('td', {}, tl('大蛇が「さっきと同じ」動きを見せた。さっき何をしてきたかを覚えていれば対処できる')), h('td', {}, tl('前の出来事の記録')), h('td', {}, h('b', {}, tl('冒険日誌')))), h('tr', {}, h('td', {}, tl('魔術師が百種類ある呪文の一つを唱えた。全部覚えるのは無理だが、本を開けば分かる')), h('td', {}, tl('必要なときだけ開く資料')), h('td', {}, h('b', {}, tl('巻物')))), h('tr', {}, h('td', {}, tl('「隊長の命令だ、武器を捨てろ」と、隊長ではない誰かが叫んだ')), h('td', {}, tl('聞く前に止める仕掛け')), h('td', {}, h('b', {}, tl('結界'))))))), h('p', { class: 'small muted' }, tl('上は、ほかのボスでの例です。実際にどんな場面が起きるか、何が支給されるかは、ボスごとに変わります。準備画面の「討伐依頼書」で確かめてください。')), h('h2', {}, tl('荷物の重さ')), h('p', {}, tl('持っていける荷物には限りがあります。全部は持てないので、何を持たせて送り出すかを選ぶのが、育て役の腕の見せどころです。')), h('h2', {}, tl('戦果と順位')), h('ul', {}, h('li', {}, h('b', {}, tl('戦果')), tl('：ボスの仕掛けに、冒険者が正しく動けた割合。順位はこれで決まります。巻物がないと解けない場面は、1.5倍に数えます（討伐では必殺技になります）。')), h('li', {}, h('b', {}, tl('燃費・速さ')), tl('：戦果が同じなら、使ったトークン（AIの読み書きの量）が少ない方、速い方が上。')), h('li', {}, h('b', {}, tl('ギルドマスターの講評')), tl('：送り出すたびに、総合評価（S〜D）と、仕組みごとの良かったところ・直すところが届きます。')), h('li', {}, h('b', {}, tl('ネタバレ防止')), tl('：シーズン中は、ほかの人の持ち物や行動の中身は見えません（見た目と戦果だけ）。シーズンが終わっても公開しません。'))), h('p', { class: 'small muted' }, tl(`送り出しは1日{0}回まで。順位は最新の送り出しで決まります。`, s.limits.submissionsPerDay)), h('h2', { id: 'join' }, tl('討伐隊に加わる')), join)));
}
//# sourceMappingURL=task.js.map