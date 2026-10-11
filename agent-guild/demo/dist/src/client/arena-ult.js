import { clamp01, ease } from './arena-common.js';
import { Rng } from '../shared/rng.js';
import { figure } from './hero.js';
import { isUltScene } from './scenes.js';
import { PIXEL_FONT, tl } from '../shared/i18n.js';
import { flashScale } from './motion.js';
// 大技カウンターの主役が持っている武器（乱舞の必殺技が、武器で変わる）
export function ultWeapon(f) { return f === undefined ? undefined : this.looks[f]?.weapon; }
export function figuresOf() {
    return (this.figs ??= this.script.fighters.map((_, i) => figure(this.looks[i], this.gears[i], 5)));
}
export function skillWave(w) { const wv = this.script.waves[w]; return !!wv && !wv.sudden && !!this.script.cases[wv.caseIndex]?.keySkill; }
// 必殺技カットインの区間。大技カウンター（ougi/rush/summon）は主役の大技が 0.3 から始まるので、それより前に終える
export function ultWindow(st, w) {
    const t0 = this.ultOf(w) ? Math.min(0.12, Math.max(0.08, st.t)) : Math.min(0.2, Math.max(0.1, st.t));
    return [t0, t0 + 0.17];
}
// 巻物の大技カウンターの主役。巻物が要る場面（skillWave）の ougi / rush / summon だけ。
//   主役（巻物を使って正解したキャラ）: 自分のキャラ → 注目キャラ → 先に答えたキャラ の順
//   正解者がひとりもいなければ { scene } だけ（ボスの大技が炸裂する）。巻物なしの正解者しかいなければ null（今までの軽い演出）
export function ultOf(w) {
    const u = this.ultHero(w);
    if (!u || u.f === undefined)
        return u;
    const at = this.wave(w).events.find((e) => e.type === 'attack' && e.f === u.f);
    return { ...u, at };
}
export function ultHero(w) {
    const scene = this.sceneOf(w);
    // 大技の場面（奥義・乱舞・召喚）は、巻物が要る場面でも要らない場面でも、主役の大技で見せる
    if (!isUltScene(scene))
        return null;
    const s = this.script, wv = s.waves[w];
    const prevAlive = w > 0 ? s.waves[w - 1].aliveAfter : s.fighters.map(() => true);
    const strikes = wv.events.filter((e) => e.type === 'strike' && e.success && prevAlive[e.f] && !s.fighters[e.f].off);
    if (!strikes.length)
        return { scene };
    const withSkill = this.skillWave(w) ? strikes.filter((e) => e.used.skills.length) : strikes;
    if (!withSkill.length)
        return null;
    const sp = this.spotlight(w);
    const st = withSkill.find((e) => this.mine.has(e.f)) ?? withSkill.find((e) => e.f === sp?.f) ?? withSkill[0];
    return { scene, f: st.f, st };
}
// 必殺技のカットイン: 注目キャラが巻物（スキル）を使った回だけ、画面全体で大きく見せる
export function ultimate(ctx, w, phase) {
    const s = this.script;
    const ult = this.ultOf(w);
    const sp = ult?.f !== undefined ? { f: ult.f, st: ult.st } : this.spotlight(w); // 大技カウンターは主役を見せる
    // 必殺技（巻物）の見せ場は、巻物が要る場面（ボスの大技）でだけ。連携詠唱の場面は詠唱そのものが見せ場なので出さない
    if (!sp || !sp.st.used.skills.length || !this.skillWave(w) || this.chainOf(w))
        return;
    // 詠唱合戦は、知る者へのスポットライトと詠唱そのものが見せ場なので、カットインで隠さない
    if (this.sceneOf(w) === 'spell')
        return;
    // 巻物を読むのは「答えを考えるとき」。竜の攻撃より前に見せる
    const [t0, t1] = this.ultWindow(sp.st, w);
    if (phase < t0 || phase > t1)
        return;
    const k = (phase - t0) / (t1 - t0);
    const { w: AW, h: AH } = s.arena;
    const inK = ease(clamp01(k / 0.15)), outK = 1 - ease(clamp01((k - 0.85) / 0.15));
    const a = Math.min(inK, outK);
    const accent = '#ff6bd6', gold = '#ffd166';
    ctx.save();
    // 暗転と集中線
    ctx.globalAlpha = 0.7 * a;
    ctx.fillStyle = '#05030d';
    ctx.fillRect(0, 0, AW, AH);
    ctx.globalAlpha = 0.5 * a;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    const rng = new Rng(`ult:${w}`);
    for (let i = 0; i < 46; i++) {
        const ang = rng.range(0, Math.PI * 2) + this.frame * 0.002, r0 = rng.range(60, 120), r1 = r0 + rng.range(40, 140);
        ctx.beginPath();
        ctx.moveTo(AW / 2 + Math.cos(ang) * r0, AH / 2 + Math.sin(ang) * r0 * 0.7);
        ctx.lineTo(AW / 2 + Math.cos(ang) * r1, AH / 2 + Math.sin(ang) * r1 * 0.7);
        ctx.stroke();
    }
    // 斜めの帯
    const by = AH / 2 - 30, slide = (1 - inK) * AW;
    ctx.globalAlpha = a;
    const g = ctx.createLinearGradient(0, by, AW, by + 60);
    g.addColorStop(0, '#3a0a3a');
    g.addColorStop(0.5, '#7a1a6a');
    g.addColorStop(1, '#3a0a3a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-20 + slide, by + 8);
    ctx.lineTo(AW + 20 + slide, by - 8);
    ctx.lineTo(AW + 20 + slide, by + 52);
    ctx.lineTo(-20 + slide, by + 68);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = gold;
    ctx.beginPath();
    ctx.moveTo(-20 + slide, by + 8);
    ctx.lineTo(AW + 20 + slide, by - 8);
    ctx.lineTo(AW + 20 + slide, by - 5);
    ctx.lineTo(-20 + slide, by + 11);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-20 + slide, by + 65);
    ctx.lineTo(AW + 20 + slide, by + 49);
    ctx.lineTo(AW + 20 + slide, by + 52);
    ctx.lineTo(-20 + slide, by + 68);
    ctx.closePath();
    ctx.fill();
    // 帯を流れる光
    ctx.globalAlpha = 0.25 * a;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 10; i++)
        ctx.fillRect(((i * 53 + this.frame * 9) % (AW + 80)) - 40, by + 14 + (i % 4) * 11, 30, 1);
    // 大きな肖像（左から）
    ctx.globalAlpha = a;
    const px = 10 - (1 - inK) * 120;
    ctx.drawImage(this.portraits[sp.f], Math.round(px), Math.round(by - 34), 140, 108);
    // 技名
    const fi = s.fighters[sp.f];
    const skill = sp.st.used.skills.find((x) => x !== '？') ?? tl('秘伝の巻物');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const sc = k < 0.2 ? 1.6 - ease(k / 0.2) * 0.6 : 1;
    ctx.font = `${Math.round(10 * sc)}px ${PIXEL_FONT}`;
    ctx.fillStyle = gold;
    ctx.fillText(tl(`{0}　スキル発動`, fi.name), AW / 2 + 60, by + 18);
    ctx.font = `${Math.round(22 * sc)}px ${PIXEL_FONT}`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#2a0020';
    ctx.strokeText(tl(`「{0}」`, skill), AW / 2 + 60, by + 40);
    ctx.fillStyle = this.frame % 8 < 4 ? '#ffffff' : accent;
    ctx.fillText(tl(`「{0}」`, skill), AW / 2 + 60, by + 40);
    ctx.restore();
    // 入りの閃光
    if (k < 0.08) {
        ctx.save();
        ctx.globalAlpha = (1 - k / 0.08) * 0.8 * flashScale();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, AW, AH);
        ctx.restore();
    }
}
//# sourceMappingURL=arena-ult.js.map