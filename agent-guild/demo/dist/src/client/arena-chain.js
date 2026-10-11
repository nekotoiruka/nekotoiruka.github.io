import { runeLine } from './arena-common.js';
import { CHAIN_T, chainOrder } from '../shared/simulate.js';
import { chainBreakAt, isUltScene, verseAt } from './scenes.js';
export function chainOf(w) {
    const s = this.script, wv = s.waves[w];
    if (!wv || wv.sudden || s.cases[wv.caseIndex]?.scene !== 'chain')
        return null;
    const key = `${w}:${[...this.mine].join(',')}:${this.mineLabel}`;
    if (this.chainCache.has(key))
        return this.chainCache.get(key);
    const ev = wv.events.find((e) => e.type === 'chain');
    let plan = null;
    if (ev) {
        const cm = s.cases[wv.caseIndex];
        const visible = (f) => !s.fighters[f].off;
        const { order, chanters, upto } = chainOrder(ev.parts, ev.ok, ev.len, { mine: this.mine, visible, mineUpto: ev.viewerUpto });
        const verse = Math.min(0.065, CHAIN_T.chant / Math.max(1, ev.len));
        const full = ev.full && upto >= ev.len;
        // 詠唱の文を見せるのは、見ている人（あなた）が大呪を最後まで唱えられたときだけ。
        // 外した人・提出していない人には、ネタバレにならないよう全員の詠唱を古代文字で見せる
        const reveal = [...this.mine].some((f) => ev.ok.includes(f));
        const lines = Array.from({ length: ev.len }, (_, i) => (reveal ? cm.chant?.[i] ?? '……' : runeLine(cm.chant?.[i] ?? '……', i)));
        const mineAt = chanters.findIndex((f) => this.mine.has(f));
        const breakT = full ? -1 : chainBreakAt(CHAIN_T.start, verse, upto);
        const doneT = verseAt({ start: CHAIN_T.start, verse }, ev.len);
        const view = {
            len: ev.len, lines, chanters, names: chanters.map((f) => s.fighters[f]?.name ?? ''), mineAt, upto, full, dmg: ev.dmg,
            start: CHAIN_T.start, verse, breakT, doneT, impact: ev.t, rally: CHAIN_T.rally, spell: cm.shout?.name ?? cm.spell ?? (cm.chant?.[ev.len - 1] ?? '').split(/[\s,，、]/)[0], reading: cm.shout?.reading, mineLabel: this.mineLabel,
        };
        // 魔法陣を囲む輪: 最後に唱える人（あなた）がボスに向いた正面（左）、ほかの人は唱える順に輪をまわる。
        // 唱えない人は右端へ場を譲って見守る
        const line = new Map();
        const ring = { x: 262, y: 134, rx: 48, ry: 20 };
        const front = order.filter(visible);
        const n = front.length;
        front.forEach((f, k) => {
            const a = Math.PI + ((n - 1 - k) * Math.PI * 2) / Math.max(1, n); // 最後（k = n-1）が左の正面
            line.set(f, { x: ring.x + Math.cos(a) * (ring.rx + 8), y: ring.y + 4 + Math.sin(a) * (ring.ry + 6) });
        });
        view.ring = ring;
        plan = { ev, view, line, dmgAt: full ? ev.t : breakT + 0.05, last: w === s.waves.length - 1 };
    }
    this.chainCache.set(key, plan);
    return plan;
}
// 連携合体攻撃の、いま何人目か（主役の大技のあとに続いた人数）
export function comboAt(w, phase) {
    const scene = this.sceneOf(w);
    if (!isUltScene(scene))
        return null;
    const hero = this.ultHero(w)?.f;
    const fol = this.wave(w).events.filter((e) => e.type === 'attack' && e.f !== hero);
    if (!fol.length)
        return null;
    return { n: fol.filter((e) => e.t <= phase).length, total: fol.length, last: fol[fol.length - 1].t };
}
//# sourceMappingURL=arena-chain.js.map