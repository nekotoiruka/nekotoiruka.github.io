// 連携詠唱の大魔法（全節そろったときの決め技）の演出の案。見本帳（chainfxlab）で見比べて選ぶ。
// どの案も、討伐の流れ（c.doneT: 最後の節を唱え終える → c.impact: 着弾 → ダメージ・ボスが崩れる）の時刻は同じで、絵だけがちがう。
// 空の魔法陣・唱える人の光の糸・特大のダメージ数字・効果音は、案によらず共通（scenes.ts の chainTop・arena-hud.ts）。
import { Rng } from '../shared/rng.js';
import { bump, clamp01, dustCloud, ease, flash, glowLine, impactBurst, lerp, R, rocks, starSpark, swordAt, TAU, win } from './ultkit.js';
/** いま使う案（見本帳で切り替える。本番の既定は 'pillar'＝これまでの光の柱） */
export const chainFx = { style: 'pillar' };
export const CHAIN_FX_LIST = [
    { id: 'pillar', name: 'A. 光の柱（いまの演出）', note: '空の魔法陣の中心から、ボスへ極大の光の柱が落ちる。' },
    { id: 'prism', name: 'B. 七色の収束', note: '唱えた全員の頭上から、節の色の光が空の魔法陣へ集まり、七色を束ねた光線になってボスを貫く。' },
    { id: 'blade', name: 'C. 天の大剣', note: '空の魔法陣から、光をまとった巨大な剣がゆっくり降りてきて、最後に一気にボスを貫いて地面に突き立つ。' },
    { id: 'meteor', name: 'D. 星の雨', note: '空の魔法陣から、光の槍が雨のように降りそそぎ、最後にひときわ大きな星が落ちる。' },
    { id: 'nova', name: 'E. 小さな太陽', note: '空の魔法陣が光を吸いこんで小さな太陽になり、ボスへ落ちて大きく爆ぜる。' },
];
/** 大魔法を描く。sky: 空の魔法陣の中心 / heads: 節ごとの唱える人の頭上（いなければ null）/ cols: 節ごとの輪の色 */
export function drawChainFinale(a, c, sky, heads, cols) {
    switch (chainFx.style) {
        case 'prism':
            prism(a, c, sky, heads, cols);
            break;
        case 'blade':
            blade(a, c, sky);
            break;
        case 'meteor':
            meteor(a, c, sky);
            break;
        case 'nova':
            nova(a, c, sky, cols);
            break;
        default: pillar(a, c, sky);
    }
}
// ---- A. 光の柱（これまでの演出。scenes.ts から移した） ----
function pillar(a, c, sky) {
    const { ctx, phase: p } = a;
    const pk = win(p, c.impact - 0.02, c.impact) * (1 - win(p, c.impact + 0.06, c.impact + 0.2));
    if (pk > 0) {
        const w0 = 10 + 40 * ease(win(p, c.impact - 0.02, c.impact + 0.03));
        const bx = a.body.x + 4, by = a.foot.y + 6;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(bx - w0, 0, bx + w0, 0);
        g.addColorStop(0, 'rgba(255,233,160,0)');
        g.addColorStop(0.3, 'rgba(255,233,160,0.7)');
        g.addColorStop(0.5, 'rgba(255,255,255,1)');
        g.addColorStop(0.7, 'rgba(255,233,160,0.7)');
        g.addColorStop(1, 'rgba(255,233,160,0)');
        ctx.globalAlpha = pk;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(sky.x - w0 * 0.6, sky.y - 40);
        ctx.lineTo(sky.x + w0 * 0.6, sky.y - 40);
        ctx.lineTo(bx + w0, by);
        ctx.lineTo(bx - w0, by);
        ctx.closePath();
        ctx.fill();
        // 足元に広がる光の輪と、舞い上がる光の粒
        ctx.strokeStyle = '#fff6c8';
        ctx.lineWidth = 2;
        const rk = win(p, c.impact, c.impact + 0.12);
        if (rk > 0 && rk < 1) {
            ctx.globalAlpha = 1 - rk;
            ctx.beginPath();
            ctx.ellipse(bx, by, 20 + rk * 150, 5 + rk * 34, 0, 0, TAU);
            ctx.stroke();
        }
        const rng = new Rng(`${a.seed}:pillar`);
        for (let i = 0; i < 40; i++) {
            const x = bx + rng.range(-1, 1) * w0, sp = rng.range(0.5, 1.5), t = (p * 8 * sp + rng.next()) % 1;
            ctx.globalAlpha = pk * (1 - t);
            ctx.fillStyle = i % 2 ? '#ffffff' : '#ffe9a0';
            ctx.fillRect(R(x), R(by - t * 140), 1, 3);
        }
        ctx.restore();
    }
    flash(a, bump(p, c.impact - 0.004, c.impact + 0.05), '#ffffff', 0.95);
    flash(a, bump(p, c.doneT, c.doneT + 0.03), '#fff6c8', 0.5);
}
// ---- B. 七色の収束: 全員の頭上 → 空の魔法陣 → 七色の光線でボスを貫く ----
function prism(a, c, sky, heads, cols) {
    const { ctx, phase: p } = a;
    const pre = Math.max(0.02, c.impact - c.doneT);
    // 1. 唱えた人の頭上から、節の色の光が空の魔法陣へのびる（順番に、少しずつずらして）
    heads.forEach((hd, i) => {
        if (!hd)
            return;
        const t0 = c.doneT + (pre * 0.5 * i) / Math.max(1, heads.length - 1);
        const k = win(p, t0, t0 + pre * 0.35), out = 1 - win(p, c.impact, c.impact + 0.05);
        if (k <= 0 || out <= 0)
            return;
        const e = ease(k);
        glowLine(ctx, hd.x, hd.y, lerp(hd.x, sky.x, e), lerp(hd.y, sky.y, e), 2.5, cols[i] ?? '#ffffff', out);
        if (k < 1)
            starSpark(ctx, lerp(hd.x, sky.x, e), lerp(hd.y, sky.y, e), 5, out, '#ffffff');
    });
    // 2. 集まった光が、空の魔法陣の中心で七色の玉になる
    const gather = win(p, c.doneT + pre * 0.4, c.impact) * (1 - win(p, c.impact, c.impact + 0.04));
    if (gather > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const r0 = 4 + 14 * gather;
        cols.forEach((col, i) => {
            const t = a.frame / 6 + (i / cols.length) * TAU;
            ctx.globalAlpha = gather;
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.arc(sky.x + Math.cos(t) * r0 * 0.6, sky.y + Math.sin(t) * r0 * 0.25, r0 * 0.55, 0, TAU);
            ctx.fill();
        });
        ctx.globalAlpha = gather;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(sky.x, sky.y, r0 * 0.5, 0, TAU);
        ctx.fill();
        ctx.restore();
    }
    // 3. 七色を束ねた光線: 空の魔法陣から、ボスの胸へ。細い色の線を並べ、まん中は白い芯
    const beam = win(p, c.impact - 0.012, c.impact) * (1 - win(p, c.impact + 0.08, c.impact + 0.2));
    const bx = a.body.x + 4, by = a.body.y + 6;
    if (beam > 0) {
        const ang = Math.atan2(by - sky.y, bx - sky.x), nx = -Math.sin(ang), ny = Math.cos(ang);
        const wide = 1 + 1.6 * ease(win(p, c.impact, c.impact + 0.04));
        const reach = ease(win(p, c.impact - 0.012, c.impact));
        const ex = lerp(sky.x, bx + Math.cos(ang) * 60, reach), ey = lerp(sky.y, by + Math.sin(ang) * 60, reach);
        cols.forEach((col, i) => {
            const off = (i - (cols.length - 1) / 2) * 2.4 * wide + Math.sin(a.frame / 3 + i) * 0.6;
            glowLine(ctx, sky.x + nx * off, sky.y + ny * off, ex + nx * off, ey + ny * off, 2 * wide, col, beam);
        });
        glowLine(ctx, sky.x, sky.y, ex, ey, 3 * wide, '#ffffff', beam);
    }
    // 4. 貫いた瞬間: 七色の輪が重なって広がり、ボスの背中から光の粒が抜ける
    const hit = win(p, c.impact, c.impact + 0.14);
    if (hit > 0 && hit < 1) {
        cols.forEach((col, i) => { if (i % 2 === 0)
            impactBurst(a, bx, by, clamp01(hit - i * 0.02), col, '#ffffff', 0.7 + i * 0.12); });
        starSpark(ctx, bx, by, 40 * (1 - hit) + 6, 1 - hit, '#ffffff');
        const rng = new Rng(`${a.seed}:prism`);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 36; i++) {
            const an = Math.atan2(by - sky.y, bx - sky.x) + rng.range(-0.5, 0.5), sp = rng.range(60, 170) * ease(hit);
            ctx.globalAlpha = 1 - hit;
            ctx.fillStyle = cols[i % cols.length] ?? '#ffffff';
            ctx.fillRect(R(bx + Math.cos(an) * sp), R(by + Math.sin(an) * sp), 2, 2);
        }
        ctx.restore();
    }
    flash(a, bump(p, c.impact - 0.002, c.impact + 0.04), '#ffffff', 0.85);
    flash(a, bump(p, c.doneT, c.doneT + 0.03), '#fff6c8', 0.4);
}
// ---- C. 天の大剣: ゆっくり降りてきて、最後に一気に突き立つ ----
function blade(a, c, sky) {
    const { ctx, phase: p } = a;
    const pre = Math.max(0.02, c.impact - c.doneT);
    const bx = a.body.x + 4, ground = a.foot.y + 8;
    const s = 2.2, len = 84 * s;
    const appear = win(p, c.doneT, c.doneT + pre * 0.3);
    const gone = 1 - win(p, c.impact + 0.1, c.impact + 0.22);
    if (appear > 0 && gone > 0) {
        // 魔法陣から刃先だけがのぞき、ゆっくり降りる → 着弾の直前に一気に落ちる
        const slow = ease(win(p, c.doneT, c.impact - 0.01)) * 0.35, drop = win(p, c.impact - 0.01, c.impact) ** 2;
        const top = sky.y + 6, bottom = ground + 10;
        const tip = lerp(top, bottom, Math.min(1, slow + drop * (1 - slow)));
        const x = lerp(sky.x, bx, Math.min(1, slow + drop * (1 - slow)));
        ctx.save();
        ctx.globalAlpha = appear * gone;
        // 魔法陣より上は見せない（魔法陣から生えてくるように）
        ctx.beginPath();
        ctx.rect(0, top - 2, a.W, a.H);
        ctx.clip();
        // 落ちる軌跡の残像
        if (drop > 0 && drop < 1)
            for (let k = 1; k <= 3; k++) {
                ctx.globalAlpha = appear * gone * (0.25 / k);
                swordAt(ctx, x, tip - k * 14, s, 0.6, a.frame);
            }
        ctx.globalAlpha = appear * gone;
        swordAt(ctx, x, tip, s, 0.5 + 0.5 * bump(p, c.impact - 0.01, c.impact + 0.06), a.frame);
        ctx.restore();
        // 降りてくるあいだ、刀身から光の粒がこぼれる
        if (p < c.impact) {
            const rng = new Rng(`${a.seed}:blade`);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 16; i++) {
                const t = (p * 30 + rng.next()) % 1, yy = tip - rng.range(10, len);
                if (yy < top)
                    continue;
                ctx.globalAlpha = appear * (1 - t);
                ctx.fillStyle = i % 2 ? '#bff4ff' : '#ffffff';
                ctx.fillRect(R(x + rng.range(-8, 8) * s), R(yy + t * 18), 1, 2);
            }
            ctx.restore();
        }
    }
    // 突き立った瞬間: 地割れの光・岩・土けむり・金色の衝撃波
    const hit = win(p, c.impact, c.impact + 0.16);
    if (hit > 0 && hit < 1) {
        impactBurst(a, bx, ground, hit, '#9fe8ff', '#ffd166', 1.3);
        rocks(a, bx, ground, hit, `${a.seed}:blade-rock`, 26, 140);
        dustCloud(a, bx, ground, hit, `${a.seed}:blade-dust`, 1.4);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const rng = new Rng(`${a.seed}:crack`);
        for (let j = 0; j < 6; j++) {
            let x = bx, y = ground;
            const dir = j % 2 ? 1 : -1;
            ctx.globalAlpha = 1 - hit;
            ctx.strokeStyle = '#9fe8ff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, y);
            for (let k = 0; k < 5; k++) {
                x += dir * rng.range(10, 22) * ease(hit);
                y += rng.range(-4, 5);
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        ctx.restore();
    }
    flash(a, bump(p, c.impact - 0.002, c.impact + 0.04), '#e8fbff', 0.9);
    flash(a, bump(p, c.doneT, c.doneT + 0.03), '#fff6c8', 0.4);
}
// ---- D. 星の雨: 光の槍が降りそそぎ、最後に大きな星 ----
function meteor(a, c, sky) {
    const { ctx, phase: p } = a;
    const pre = Math.max(0.02, c.impact - c.doneT);
    const bx = a.body.x + 4, by = a.foot.y + 4;
    const rng = new Rng(`${a.seed}:meteor`);
    const N = 30;
    const s0 = c.doneT + pre * 0.35, s1 = c.impact - 0.006;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < N; i++) {
        const t0 = lerp(s0, s1, i / N) + rng.range(-0.002, 0.002), fall = pre * 0.12;
        const tx = bx + rng.range(-46, 46), ty = by + rng.range(-10, 8);
        const sx = sky.x + rng.range(-60, 60), sy = sky.y;
        const k = win(p, t0, t0 + fall);
        const col = ['#9fe8ff', '#ffe9a0', '#ffb8e8', '#b5a8ff'][i % 4];
        if (k > 0 && k < 1) {
            const e = k * k, x = lerp(sx, tx, e), y = lerp(sy, ty, e);
            const px = lerp(sx, tx, Math.max(0, e - 0.18)), py = lerp(sy, ty, Math.max(0, e - 0.18));
            glowLine(ctx, px, py, x, y, 3, col, 1);
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(R(x) - 1, R(y) - 1, 3, 3);
        }
        const hk = win(p, t0 + fall, t0 + fall + 0.03);
        if (hk > 0 && hk < 1) {
            ctx.globalAlpha = 1 - hk;
            ctx.strokeStyle = col;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(tx, ty, 4 + hk * 16, 1.5 + hk * 5, 0, 0, TAU);
            ctx.stroke();
            starSpark(ctx, tx, ty - 2, 8 * (1 - hk) + 2, 1 - hk, '#ffffff');
        }
    }
    ctx.restore();
    // 最後の大きな星（魔法陣の中心から、まっすぐボスへ）
    const big = win(p, c.impact - 0.014, c.impact);
    if (big > 0 && p < c.impact + 0.01) {
        const e = big * big, x = lerp(sky.x, bx, e), y = lerp(sky.y - 10, a.body.y, e);
        glowLine(ctx, lerp(sky.x, bx, Math.max(0, e - 0.3)), lerp(sky.y - 10, a.body.y, Math.max(0, e - 0.3)), x, y, 7, '#ffe27a', 1);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(x, y, 0, x, y, 22);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.5, 'rgba(255,226,122,0.8)');
        g.addColorStop(1, 'rgba(255,160,60,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, 22, 0, TAU);
        ctx.fill();
        ctx.restore();
        starSpark(ctx, x, y, 18, 1, '#ffffff');
    }
    const hit = win(p, c.impact, c.impact + 0.16);
    if (hit > 0 && hit < 1) {
        impactBurst(a, bx, a.body.y + 6, hit, '#ffe27a', '#ff9ce6', 1.5);
        rocks(a, bx, by, hit, `${a.seed}:meteor-rock`, 20, 110);
        starSpark(a.ctx, bx, a.body.y + 6, 60 * (1 - hit) + 6, 1 - hit, '#ffffff');
    }
    flash(a, bump(p, c.impact - 0.002, c.impact + 0.05), '#fff3c0', 0.95);
    flash(a, bump(p, c.doneT, c.doneT + 0.03), '#fff6c8', 0.4);
}
// ---- E. 小さな太陽: 魔法陣が光を吸いこんで太陽になり、ボスへ落ちて爆ぜる ----
function nova(a, c, sky, cols) {
    const { ctx, phase: p } = a;
    const pre = Math.max(0.02, c.impact - c.doneT);
    const bx = a.body.x + 4, by = a.body.y + 4;
    const grow = ease(win(p, c.doneT, c.impact - 0.012));
    const drop = win(p, c.impact - 0.012, c.impact) ** 2;
    // 吸いこまれる光の粒（まわりから魔法陣の中心へ、らせんを描いて）
    if (p > c.doneT && p < c.impact) {
        const rng = new Rng(`${a.seed}:nova-in`);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 40; i++) {
            const t = (p / (pre * 0.3) + rng.next()) % 1, an = rng.range(0, TAU) + t * 3, d = (1 - t) * rng.range(50, 110);
            ctx.globalAlpha = t * (1 - drop);
            ctx.fillStyle = cols[i % cols.length] ?? '#ffffff';
            ctx.fillRect(R(sky.x + Math.cos(an) * d), R(sky.y + Math.sin(an) * d * 0.45), 2, 2);
        }
        ctx.restore();
    }
    // 太陽（まわりがゆらめく）
    if (grow > 0 && p < c.impact + 0.004) {
        const x = lerp(sky.x, bx, drop), y = lerp(sky.y, by, drop), r0 = 3 + 22 * grow;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(x, y, 0, x, y, r0 * 2.4);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.35, 'rgba(255,233,160,0.95)');
        g.addColorStop(0.7, 'rgba(255,140,60,0.5)');
        g.addColorStop(1, 'rgba(255,90,40,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r0 * 2.4, 0, TAU);
        ctx.fill();
        for (let i = 0; i < 12; i++) { // 炎のゆらめき（ドットの点）
            const an = (i / 12) * TAU + a.frame / 9, d = r0 * (1.05 + 0.25 * Math.sin(a.frame / 3 + i));
            ctx.fillStyle = i % 2 ? '#ffd166' : '#ff9a4a';
            ctx.fillRect(R(x + Math.cos(an) * d) - 1, R(y + Math.sin(an) * d) - 1, 3, 3);
        }
        if (drop > 0)
            glowLine(ctx, sky.x, sky.y, x, y, r0 * 0.8, '#ffb35a', 0.6 * (1 - drop * 0.5));
        ctx.restore();
    }
    // 爆ぜる: 大きな光の球が広がって消え、輪が三重に走る
    const hit = win(p, c.impact, c.impact + 0.18);
    if (hit > 0 && hit < 1) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const rr = 20 + 150 * ease(hit);
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, rr);
        g.addColorStop(0, `rgba(255,255,255,${0.8 * (1 - hit)})`);
        g.addColorStop(0.5, `rgba(255,214,120,${0.6 * (1 - hit)})`);
        g.addColorStop(1, 'rgba(255,120,60,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(bx, by, rr, 0, TAU);
        ctx.fill();
        ctx.restore();
        impactBurst(a, bx, a.foot.y + 4, hit, '#ffd166', '#ff7a3a', 1.6);
        rocks(a, bx, a.foot.y + 6, hit, `${a.seed}:nova-rock`, 24, 150);
    }
    flash(a, bump(p, c.impact - 0.002, c.impact + 0.06), '#fff1d0', 0.8);
    flash(a, bump(p, c.doneT, c.doneT + 0.03), '#fff6c8', 0.4);
}
//# sourceMappingURL=chainfx.js.map