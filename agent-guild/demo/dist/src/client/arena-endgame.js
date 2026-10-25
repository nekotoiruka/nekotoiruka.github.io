import { clamp01, ease } from './arena-common.js';
import { Rng } from '../shared/rng.js';
import { PIXEL_FONT, tl } from '../shared/i18n.js';
import { flashScale } from './motion.js';
// --- 終盤の演出: ボス撃破・撃退、戦果1位 ---
export function endgame(ctx, w, phase, outro, views, down) {
    const s = this.script;
    const { w: AW, h: AH } = s.arena;
    const t = w + phase + outro;
    const fin = this.finisher(w);
    if (fin !== null && phase > fin && phase < fin + 0.05 && outro === 0) {
        ctx.fillStyle = `rgba(255,255,255,${0.7 * flashScale() * (1 - (phase - fin) / 0.05)})`;
        ctx.fillRect(0, 0, AW, AH);
    }
    // 削りきれなかったときも討伐成功: ボスは逃げ出す
    const esc = this.escapeAt && w === this.escapeAt.wave ? phase - this.escapeAt.t + outro : this.escapeAt && w > this.escapeAt.wave ? 1 + outro : -1;
    // 小さい行は、シーズンの最期の一文（captions の down / escape）。なければ共通の文
    const cap = s.theme?.captions;
    if (this.escapeAt && esc >= 0)
        this.bigBanner(ctx, esc - 0.15, tl('討伐成功！'), cap?.escape ?? tl('{0}はたまらず逃げ出した！ 戦果1位は…', s.boss.name), '#ffd166');
    if (down >= 0)
        this.bigBanner(ctx, down, tl('討伐成功！'), cap?.down ?? tl(`{0}を倒した！ 戦果1位は…`, s.boss.name), '#ffd166');
    const winT = this.winner !== null ? t - (s.waves.length - 1 + ((s.waves[s.waves.length - 1].events.find((e) => e.type === 'winner')?.t) ?? 1)) : -1;
    if (this.winner !== null && winT > 0 && (down < 0 || down > 0.75) && (esc < 0 || esc > 0.9)) {
        const v = views[this.winner];
        const p = this.proj(v.x, v.y);
        const k = clamp01(winT / 0.3);
        ctx.save();
        ctx.fillStyle = `rgba(5,6,13,${0.45 * k})`;
        ctx.beginPath();
        ctx.rect(0, 0, AW, AH);
        ctx.ellipse(p.x, p.y - 20, 46, 60, 0, 0, Math.PI * 2, true);
        ctx.fill('evenodd');
        const beam = ctx.createLinearGradient(p.x, 0, p.x, p.y);
        beam.addColorStop(0, 'rgba(255,240,180,0)');
        beam.addColorStop(1, `rgba(255,240,180,${0.28 * k})`);
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(p.x - 14, 0);
        ctx.lineTo(p.x + 14, 0);
        ctx.lineTo(p.x + 40, p.y + 6);
        ctx.lineTo(p.x - 40, p.y + 6);
        ctx.fill();
        ctx.restore();
        this.confetti(ctx, winT);
        this.winBanner(ctx, winT, s.fighters[this.winner].name, tl('戦果1位'), '#ffd166');
    }
}
export function bigBanner(ctx, age, title, sub, color) {
    if (age < 0 || age > 0.75)
        return;
    const { w: AW, h: AH } = this.script.arena;
    const k = age / 0.75;
    const slide = k < 0.15 ? ease(k / 0.15) : k > 0.85 ? 1 - ease((k - 0.85) / 0.15) : 1;
    const y = AH / 2 - 24;
    ctx.save();
    ctx.globalAlpha = slide;
    ctx.fillStyle = 'rgba(13,16,34,0.85)';
    ctx.fillRect(0, y, AW, 46);
    ctx.fillStyle = color;
    ctx.fillRect(0, y, AW, 2);
    ctx.fillRect(0, y + 44, AW, 2);
    ctx.globalAlpha = slide * 0.25;
    for (let i = 0; i < 18; i++)
        ctx.fillRect(((i * 37 + this.frame * 6) % (AW + 40)) - 40, y + 6 + (i % 5) * 8, 24, 1);
    ctx.globalAlpha = slide;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const sc = k < 0.12 ? 2 - ease(k / 0.12) : 1;
    ctx.font = `${Math.round(22 * sc)}px ${PIXEL_FONT}`;
    ctx.fillStyle = '#1a1c2c';
    ctx.fillText(title, AW / 2 + 2, y + 20);
    ctx.fillStyle = this.frame % 10 < 5 ? color : '#ffffff';
    ctx.fillText(title, AW / 2, y + 18);
    ctx.font = `9px ${PIXEL_FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(sub, AW / 2, y + 36);
    ctx.restore();
}
export function winBanner(ctx, age, name, title, color) {
    const { w: AW } = this.script.arena;
    const k = clamp01(age / 0.25);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = k;
    ctx.font = `${Math.round(26 * (1 + (1 - ease(k)) * 1.5))}px ${PIXEL_FONT}`;
    ctx.fillStyle = '#1a1c2c';
    ctx.fillText(title, AW / 2 + 2, 46);
    ctx.fillStyle = this.frame % 12 < 6 ? color : '#ffffff';
    ctx.fillText(title, AW / 2, 44);
    ctx.font = `11px ${PIXEL_FONT}`;
    const tw = ctx.measureText(name).width + 16;
    ctx.fillStyle = 'rgba(13,16,34,0.85)';
    ctx.fillRect(Math.round(AW / 2 - tw / 2), 62, Math.round(tw), 15);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(name, AW / 2, 70);
    ctx.restore();
}
export function confetti(ctx, age) {
    const { w: AW, h: AH } = this.script.arena;
    const cols = ['#ffd166', '#ff5a6e', '#5fcde4', '#7bed9f', '#c77dff', '#ffffff'];
    const rng = new Rng('confetti:' + this.script.seed);
    ctx.save();
    for (let i = 0; i < 90; i++) {
        const x0 = rng.range(0, AW), sp = rng.range(40, 90), sway = rng.range(4, 12), ph = rng.range(0, 6.28), delay = rng.range(0, 0.6);
        const a = (age - delay) * 3;
        if (a < 0)
            continue;
        const y = -6 + a * sp;
        if (y > AH + 4)
            continue;
        ctx.fillStyle = cols[i % cols.length];
        ctx.fillRect(Math.round(x0 + Math.sin(a * 3 + ph) * sway), Math.round(y), Math.max(1, Math.round(3 * Math.abs(Math.sin(a * 6 + ph)))), 2);
    }
    ctx.restore();
}
//# sourceMappingURL=arena-endgame.js.map