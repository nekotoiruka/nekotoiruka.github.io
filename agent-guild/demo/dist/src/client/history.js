import { tl } from '../shared/i18n.js';
/** 前回の提出からの差分を、短い文のならびにする（言葉そのもの・正解には触れない。巻物の名前と道具の名前は本人のもの） */
export function diffParts(sub, toolName) {
    const d = sub.diff;
    if (!d)
        return [];
    if (d.first)
        return [tl('最初の提出')];
    if (d.same)
        return [tl('前回から変更なし')];
    const j = (xs) => xs.join(tl('・'));
    const out = [];
    if (d.promptChars)
        out.push(tl('心得 {0}→{1}字', d.promptChars[0], d.promptChars[1]));
    if (d.toolsAdded.length)
        out.push(tl('道具 +{0}', j(d.toolsAdded.map(toolName))));
    if (d.toolsRemoved.length)
        out.push(tl('道具 −{0}', j(d.toolsRemoved.map(toolName))));
    if (d.skillsAdded.length)
        out.push(tl('巻物 +{0}', j(d.skillsAdded)));
    if (d.skillsRemoved.length)
        out.push(tl('巻物 −{0}', j(d.skillsRemoved)));
    if (d.skillsChanged.length)
        out.push(tl('巻物の中身を変更: {0}', j(d.skillsChanged)));
    if (d.guardAdded)
        out.push(tl('結界の言葉 +{0}語', d.guardAdded));
    if (d.guardRemoved)
        out.push(tl('結界の言葉 −{0}語', d.guardRemoved));
    return out.length ? out : [tl('そのほかの変更（名前・見た目など）')];
}
/** 戦果（%）の前回との差 */
export function accuracyDeltas(itemsNewestFirst) {
    const done = itemsNewestFirst.filter((s) => s.status === 'done' && s.accuracy !== undefined).slice().reverse(); // 古い順
    const m = new Map();
    done.forEach((s, i) => { if (i > 0)
        m.set(s.id, Math.round((s.accuracy - done[i - 1].accuracy) * 10) / 10); });
    return m;
}
/** 提出ごとの戦果の推移の折れ線（採点済みが 2 件以上のときだけ） */
export function sparkline(itemsNewestFirst, w = 200, hgt = 44) {
    const pts = itemsNewestFirst.filter((s) => s.status === 'done' && s.accuracy !== undefined).slice().reverse().map((s) => s.accuracy);
    if (pts.length < 2)
        return null;
    const NS = 'http://www.w3.org/2000/svg';
    const pad = 5;
    const lo = Math.max(0, Math.min(...pts) - 5), hi = Math.min(100, Math.max(...pts) + 5);
    const x = (i) => pad + (i * (w - pad * 2)) / (pts.length - 1);
    const y = (v) => hgt - pad - ((v - lo) / Math.max(1, hi - lo)) * (hgt - pad * 2);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${hgt}`);
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(hgt));
    svg.setAttribute('class', 'sparkline');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', tl('提出ごとの戦果の推移: {0}', pts.map((v) => `${v}%`).join(' → ')));
    const line = document.createElementNS(NS, 'polyline');
    line.setAttribute('points', pts.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' '));
    line.setAttribute('fill', 'none');
    line.setAttribute('class', 'spark-line');
    svg.append(line);
    pts.forEach((v, i) => {
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', x(i).toFixed(1));
        c.setAttribute('cy', y(v).toFixed(1));
        c.setAttribute('r', i === pts.length - 1 ? '3.5' : '2.5');
        c.setAttribute('class', i === pts.length - 1 ? 'spark-dot last' : 'spark-dot');
        svg.append(c);
    });
    return svg;
}
//# sourceMappingURL=history.js.map