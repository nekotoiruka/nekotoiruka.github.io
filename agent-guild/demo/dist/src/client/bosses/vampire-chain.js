// ボス: vampire の大魔法「朝日の奔流」（#104。BossModule の chainFinale。受け口と共通の部品は chainkit.ts）。
// 空の魔法陣そのものが朝日になり、画面いっぱいに光の筋がのびて伯爵の影が濃く落ちる。陣から光の奔流が降りそそぎ、光の波が床を画面の端まで走る。
// 伯爵の体から灰と蝙蝠がちぎれ飛び、床から光の粒が立ちのぼる。
import { Rng } from '../../shared/rng.js';
import { bump, clamp01, ease, lerp, R, TAU, win } from '../ultkit.js';
import { aft, bloom, chargeK, column, darkCurve, doneFlash, fallers, floorGlow, gather, glowDiscK, heavyFeel, hitFlash, light, mix, ringBurst, streaks, wideRings } from '../chainkit.js';
function batShape(ctx, x, y, up, col) {
    ctx.fillStyle = col;
    const px = (dx, dy, w = 1, h = 1) => ctx.fillRect(R(x + dx * 1.5), R(y + dy * 1.5), R(w * 1.5), R(h * 1.5));
    px(-1, 0, 3, 2);
    if (up) {
        px(-4, -2, 3, 1);
        px(-5, -3, 1, 1);
        px(2, -2, 3, 1);
        px(5, -3, 1, 1);
    }
    else {
        px(-4, 1, 3, 1);
        px(-5, 2, 1, 1);
        px(2, 1, 3, 1);
        px(5, 2, 1, 1);
    }
}
const sunR = (c, p) => 10 + 30 * ease(chargeK(c, p)) + 14 * bump(p, c.impact - 0.01, c.impact + 0.06);
function vDawnBack(a, c, sky) {
    const p = a.phase, k = chargeK(c, p), ctx = a.ctx, fade = 1 - aft(c, p, 0.16, 0.32);
    if (k > 0 && fade > 0) {
        light(a, sky.x, sky.y + 10, 140 + 120 * k, (0.5 + 0.6 * k) * fade, '#ffc070');
        // 伯爵の影: 頭上の朝日に照らされて、足もとから左右へ濃く落ちる
        ctx.save();
        ctx.globalAlpha = 0.7 * k * fade;
        ctx.fillStyle = '#05030c';
        ctx.beginPath();
        ctx.ellipse(a.body.x - 10, a.foot.y + 4, 40 + 50 * k, 7 + 4 * k, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
    }
    // 光の奔流が通った床は金色に（画面の端まで）
    const fl = aft(c, p, -0.004, 0.06), fd = 1 - aft(c, p, 0.14, 0.3);
    if (fl > 0 && fd > 0)
        floorGlow(ctx, a.body.x, a.foot.y + 6, 40 + 360 * ease(fl), '#ffb050', 0.6 * fd);
    const hit = aft(c, p, 0, 0.3);
    if (hit > 0 && hit < 1)
        light(a, a.body.x, a.body.y, 260, 1.0 * (1 - hit), '#ffe0a0');
}
function vDawn(a, c, sky) {
    const { ctx, phase: p, W, H } = a;
    const k = chargeK(c, p), fade = 1 - aft(c, p, 0.1, 0.28);
    gather(a, c, sky, 40, '#ffb050', 1.1);
    // 陣が朝日になる（白い芯・橙の光冠・画面いっぱいに回る光の筋）
    if (k > 0 && fade > 0) {
        const r = sunR(c, p);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 18; i++) {
            const an = (i / 18) * TAU + a.frame / 200, L = 520, wd = i % 2 ? 0.035 : 0.06;
            ctx.globalAlpha = (0.08 + 0.1 * k) * fade;
            ctx.fillStyle = i % 2 ? '#ffe2a0' : '#ffb060';
            ctx.beginPath();
            ctx.moveTo(sky.x, sky.y);
            ctx.lineTo(sky.x + Math.cos(an - wd) * L, sky.y + Math.sin(an - wd) * L);
            ctx.lineTo(sky.x + Math.cos(an + wd) * L, sky.y + Math.sin(an + wd) * L);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
        glowDiscK(ctx, sky.x, sky.y, r * 2.6, '#ff8a30', 0.8 * k * fade);
        ctx.save();
        ctx.globalAlpha = k * fade;
        ctx.fillStyle = '#ffd890';
        ctx.beginPath();
        ctx.arc(sky.x, sky.y, r, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(sky.x, sky.y, r * 0.7, 0, TAU);
        ctx.fill();
        ctx.restore();
    }
    // 光の奔流: 陣から伯爵へ、太い光が降りそそぐ（着弾の少し前から、しばらく）
    const pour = win(p, c.impact - 0.008, c.impact - 0.001) * (1 - aft(c, p, 0.06, 0.14));
    if (pour > 0) {
        const bx = a.body.x + 4, fy = a.foot.y + 8, reach = ease(win(p, c.impact - 0.008, c.impact - 0.001));
        column(ctx, sky.x, sky.y, lerp(sky.x, bx, reach), lerp(sky.y, fy, reach), 26, 90, ['#ff8a3066', '#ffb05099', '#ffd890cc', '#fff4dc'], pour, a.frame, '#fff2c0', 1);
    }
    // 床を走る光の波（伯爵の足もとから、画面の両端へ）
    const wv = aft(c, p, 0, 0.08);
    if (wv > 0 && wv < 1) {
        const fy = a.foot.y + 6;
        for (const dir of [-1, 1]) {
            const x = a.body.x + dir * (20 + 360 * ease(wv));
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createLinearGradient(x, 0, x - dir * 120, 0);
            g.addColorStop(0, `rgba(255,240,200,${0.5 * (1 - wv)})`);
            g.addColorStop(1, 'rgba(255,200,120,0)');
            ctx.fillStyle = g;
            ctx.fillRect(Math.min(x, x - dir * 120), -10, 120, H + 20);
            ctx.restore();
        }
        wideRings(ctx, a.body.x, fy, wv, '#ffd890');
    }
    // 着弾: 伯爵が光に呑まれ、体から灰と蝙蝠がちぎれ飛ぶ
    const bx = a.body.x + 4, by = a.body.y;
    const hit = aft(c, p, 0, 0.3);
    if (hit > 0 && hit < 1) {
        bloom(a, bx, by, hit, '#ffc070', 0.6);
        streaks(a, bx, by, hit, '#ffe2a0', `${a.seed}:dawnst`, 44);
        ringBurst(a, bx, by, clamp01(hit * 1.4), '#ffe2a0', '#ff9a50', 2);
        const rng = new Rng(`${a.seed}:ash`);
        ctx.save();
        for (let i = 0; i < 160; i++) {
            const ox = rng.range(-24, 24), oy = rng.range(-34, 30), an = rng.range(Math.PI * 0.8, Math.PI * 1.9), sp = rng.range(60, 260), t0 = rng.range(0, 0.35);
            const u = clamp01((hit - t0) / (1 - t0));
            if (u <= 0 || u >= 1)
                continue;
            const x = bx + ox + Math.cos(an) * sp * ease(u), y = by + oy + Math.sin(an) * sp * 0.6 * ease(u) + Math.sin(u * 8 + i) * 6;
            ctx.globalAlpha = (1 - u) * 0.95;
            ctx.fillStyle = i % 4 === 0 ? '#ff8a3a' : i % 3 ? '#2a2230' : '#5a5060';
            ctx.fillRect(R(x), R(y), i % 5 ? 2 : 3, i % 2 ? 1 : 2);
        }
        for (let i = 0; i < 16; i++) {
            const an = rng.range(Math.PI * 0.9, Math.PI * 1.8), sp = rng.range(70, 200), u = clamp01(hit * 1.4);
            if (u >= 1)
                continue;
            const x = bx + Math.cos(an) * sp * ease(u), y = by - 10 + Math.sin(an) * sp * 0.7 * ease(u);
            ctx.globalAlpha = 1 - u;
            batShape(ctx, x, y, (a.frame / 3 + i) % 1 > 0.5, mix('#1a0a24', '#ff9a50', u));
        }
        ctx.restore();
    }
    // 余韻: 朝日が陣へ戻りながら細くなり、床から光の粒が立ちのぼる。灰が舞い降りる
    const af = aft(c, p, 0.08, 0.34);
    if (af > 0 && af < 1) {
        fallers(ctx, a.W / 2, a.foot.y + 30, 0, a.W, af * 1.5, `${a.seed}:rise`, ['#ffe2a0', '#fff6c8'], 1 - af, 80, 0, 2, true);
        fallers(ctx, bx - 30, by - 70, a.foot.y + 10, 200, af * 1.2, `${a.seed}:ashfall`, ['#3a3040', '#6a6070', '#ff9a50'], 1 - af, 60, -20, 1);
    }
    hitFlash(a, c, '#ffd890', 0.35);
    doneFlash(a, c);
    void W;
}
export const chainFinale = { id: 'v-dawn', top: vDawn, back: vDawnBack, dark: darkCurve(0.45, 0), feel: heavyFeel({ big: 1.3 }) };
//# sourceMappingURL=vampire-chain.js.map