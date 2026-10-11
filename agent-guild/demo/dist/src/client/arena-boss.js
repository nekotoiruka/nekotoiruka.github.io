import { IMPACT, clamp01, lerp, win01 } from './arena-common.js';
import { Rng } from '../shared/rng.js';
import { bossCanvas, BOSS_IDLE, BW, BH } from './boss.js';
import { reducedMotion } from './motion.js';
import { bossMotion, makeAt } from './bossmotion.js';
// --- ボス: 構え → 攻撃 → 被弾でひるむ → 撃破で倒れる ---
export function drawBoss(ctx, phase, atk, rage, down, attackOf, chain = null, fleeing = false, scene) {
    const s = this.script;
    const p = { ...BOSS_IDLE, bob: Math.round(Math.sin(this.frame / 12) * 1.5), wing: Math.sin(this.frame / 10) * 0.8, tail: Math.sin(this.frame / 14), eye: 'open' };
    let dx = 0, dy = 0, flash = false;
    if (chain) { // 連携詠唱: 最後の大技を溜め続ける（大魔法が落ちたら大きくのけぞる）
        const c = chain.view, end = c.full ? c.impact : c.rally;
        const k = win01(phase, 0.02, 0.2) * (phase < end ? 1 : 0);
        if (k > 0) {
            p.eye = 'angry';
            p.mouth = 0.8 * k;
            p.wing = 2 * k;
            p.lean = -3 * k; /* 構えたまま動かさない（口・杯・翼を出し入れすると落ち着かない）。ゆっくり息をするように揺れるだけ */
            dy = Math.round(Math.sin(this.frame / 16) * k);
        }
        if (c.full && phase >= c.impact && phase < c.impact + 0.12) {
            const h = phase - c.impact;
            p.eye = 'hurt';
            dx -= h < 0.04 ? 6 : 3;
            flash = h < 0.05 && this.frame % 4 < 2;
        }
        if (!c.full && phase >= chain.dmgAt && phase < chain.dmgAt + 0.03 && c.dmg > 0) {
            p.eye = 'hurt';
            dx -= 1;
        }
    }
    // 攻撃の準備と攻撃のモーション（場面とボスの種類ごと。予兆に合わせて動く）。連携詠唱・撃破・逃走のときは使わない
    const kind = (s.theme?.kind ?? 'dragon');
    const mo = !chain && down < 0 && !fleeing && atk !== 'treasure' ? bossMotion(kind, scene, atk, phase) : null;
    if (mo?.move) {
        Object.assign(p, mo.pose);
        dx += mo.dx;
        dy += mo.dy;
    }
    if (atk === 'treasure' && phase > 0.3 && phase < 0.5) {
        p.mouth = 1;
        p.wing = 1.5;
    }
    for (const e of attackOf.values()) {
        const age = phase - e.t;
        if (age >= 0 && age < 0.035) {
            flash = true;
            p.eye = 'hurt';
            dx -= 3;
        }
        else if (age >= 0.035 && age < 0.07) {
            p.eye = 'hurt';
            dx -= 1;
        }
    }
    if (rage)
        p.tint = 'rage';
    if (fleeing) {
        p.eye = 'hurt';
        p.mouth = 1;
        p.wing = 2;
        p.lean = 4;
    } // 逃げ出すときは、痛そうに背を向ける
    let alpha = 1;
    if (down >= 0) {
        p.eye = 'ko';
        p.mouth = 1;
        p.squash = Math.min(4, down * 12);
        p.wing = -2;
        p.tint = undefined;
        dy += Math.min(10, down * 30);
        alpha = down > 0.6 ? Math.max(0.25, 1 - (down - 0.6)) : 1;
        flash = down < 0.25 && this.frame % 6 < 3;
    }
    const foot = { x: s.boss.x, y: s.boss.y };
    const mv = mo?.move ? mo : null;
    const sx = mv?.sx ?? 1, sy = mv?.sy ?? 1, face = mv?.face ?? 1, rot = mv?.rot ?? 0;
    const tr = mv && mv.tremble ? { x: Math.round(Math.sin(this.frame * 2.9) * mv.tremble), y: Math.round(Math.cos(this.frame * 2.3) * mv.tremble * 0.6) } : { x: 0, y: 0 };
    const transformed = sx !== 1 || sy !== 1 || face !== 1 || rot !== 0;
    const at = makeAt(foot, { ...(mv ?? bossMotion(kind, undefined, 'treasure', 0)), dx: dx + tr.x, dy: dy + tr.y }, BW, BH);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    const sh = mv?.shadow ?? 1;
    ctx.beginPath();
    ctx.ellipse(s.boss.x + dx + 4, s.boss.y + 1, 38 * sh, 6 * sh, 0, 0, Math.PI * 2);
    ctx.fill();
    if (rage && down < 0) {
        ctx.globalAlpha = 0.22 + Math.sin(this.frame / 4) * 0.08;
        ctx.fillStyle = '#ff3b3b';
        ctx.beginPath();
        ctx.ellipse(s.boss.x + dx, s.boss.y - BH / 2, BW / 2 + 6, BH / 2 + 4, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    mv?.fx?.(ctx, 'back', at, foot); // 土ぼこり・足もとの霧など
    const body = bossCanvas(p, flash && !reducedMotion(), kind);
    const drawBody = (offX, a) => {
        ctx.globalAlpha = a;
        if (s.theme?.filter || s.theme?.hue)
            ctx.filter = s.theme.filter ?? `hue-rotate(${s.theme.hue}deg)`; // ボスごとの色合い
        if (!transformed)
            ctx.drawImage(body, Math.round(s.boss.x - BW / 2 + dx + tr.x + offX), Math.round(s.boss.y - BH + 2 + dy + tr.y));
        else {
            ctx.save();
            ctx.translate(Math.round(s.boss.x + dx + tr.x + offX), Math.round(s.boss.y + 2 + dy + tr.y));
            ctx.rotate(rot);
            ctx.scale(Math.max(0.12, Math.abs(face)) * sx * (face < 0 ? -1 : 1), sy);
            ctx.drawImage(body, -BW / 2, -(BH - 2));
            ctx.restore();
        }
        ctx.filter = 'none';
    };
    for (const g of mv?.ghosts ?? [])
        drawBody(g.dx, alpha * (mv?.alpha ?? 1) * g.alpha); // 残像
    drawBody(0, alpha * (mv?.alpha ?? 1));
    ctx.globalAlpha = 1;
    mv?.fx?.(ctx, 'front', at, foot); // 口の光・煙・星・声の輪など
    ctx.restore();
}
// 攻撃エフェクト（キャラの後ろ）: 地を這う衝撃波・爆発の輪・隕石の影
export function attackFxBack(ctx, atk, phase, views, targeted) {
    if (atk === 'tail') {
        const k = clamp01((phase - 0.4) / 0.1);
        if (k > 0 && k < 1) {
            const x = lerp(this.bossFoot.x + 30, 384, k);
            ctx.save();
            ctx.globalAlpha = 1 - k * 0.6;
            for (let y = 96; y < 212; y += 6) {
                ctx.fillStyle = y % 12 ? '#e8d5a8' : '#b8a37a';
                ctx.fillRect(Math.round(x - 6 + Math.sin(y / 9) * 4), y, 8, 4);
            }
            ctx.fillStyle = 'rgba(232,213,168,0.4)';
            ctx.fillRect(Math.round(x - 30), 94, 24, 120);
            ctx.restore();
        }
    }
    if (atk === 'nova') {
        const k = clamp01((phase - 0.38) / 0.1);
        if (k > 0 && k < 1) {
            ctx.save();
            ctx.strokeStyle = `rgba(199,125,255,${1 - k})`;
            ctx.lineWidth = 6 - k * 4;
            ctx.beginPath();
            ctx.ellipse(this.bossBody.x, this.bossBody.y + 10, k * 320, k * 140, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = `rgba(255,255,255,${1 - k})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(this.bossBody.x, this.bossBody.y + 10, k * 300, k * 130, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }
    if (atk === 'meteor') {
        const k = clamp01((phase - 0.28) / 0.14);
        if (k > 0 && phase < IMPACT + 0.02)
            for (const v of views) {
                if (!targeted(v.f))
                    continue;
                ctx.fillStyle = `rgba(0,0,0,${0.2 + k * 0.3})`;
                ctx.beginPath();
                ctx.ellipse(v.x, v.y + 1, 4 + k * 8, 2 + k * 3, 0, 0, Math.PI * 2);
                ctx.fill();
            }
    }
}
// 攻撃エフェクト（キャラの前）: 爪・炎・隕石・宝箱。防いだキャラの手前で止まる
export function attackFxFront(ctx, atk, phase, views, targeted, evaded, items) {
    const mouth = { x: this.bossFoot.x + 46, y: this.bossFoot.y - 50 };
    const rng = new Rng(`fx:${Math.floor(this.lastTime)}`);
    for (const v of views) {
        if (!targeted(v.f))
            continue;
        const blocked = evaded.has(v.f);
        const stopX = v.x - (blocked ? 12 : 0);
        if (atk === 'claw') {
            const k = clamp01((phase - 0.4) / 0.06);
            if (k > 0 && k < 1) {
                ctx.save();
                ctx.globalAlpha = 1 - k * 0.5;
                ctx.lineWidth = 2;
                for (let i = 0; i < 3; i++) {
                    ctx.strokeStyle = i === 1 ? '#ffffff' : '#ff6b6b';
                    const ox = stopX - 10 + i * 5, oy = v.y - 28;
                    ctx.beginPath();
                    ctx.moveTo(ox, oy);
                    ctx.lineTo(ox + 14 * k, oy + 22 * k);
                    ctx.stroke();
                }
                ctx.restore();
            }
        }
        if (atk === 'breath') {
            const k = clamp01((phase - 0.34) / 0.12);
            if (k > 0 && k < 1) {
                for (let i = 0; i < 14; i++) {
                    const t = clamp01(k * 1.4 - i * 0.04);
                    if (t <= 0)
                        continue;
                    const x = lerp(mouth.x, stopX, t), y = lerp(mouth.y, v.y - 12, t) + rng.range(-5, 5) * t;
                    const r = 1 + t * 3;
                    ctx.globalAlpha = 1 - Math.max(0, t - 0.85) * 5;
                    ctx.fillStyle = t > 0.8 ? '#ff5a3a' : t > 0.4 ? '#feae34' : '#ffe27a';
                    ctx.fillRect(Math.round(x - r), Math.round(y - r), Math.round(r * 2), Math.round(r * 2));
                }
                ctx.globalAlpha = 1;
            }
        }
        if (atk === 'meteor') {
            const k = clamp01((phase - 0.3) / 0.12);
            if (k > 0 && k < 1) {
                const y = lerp(-20, blocked ? v.y - 30 : v.y - 6, k), x = lerp(v.x + 30, stopX + 4, k);
                for (let i = 1; i <= 4; i++) {
                    ctx.fillStyle = `rgba(254,174,52,${0.5 - i * 0.1})`;
                    ctx.fillRect(Math.round(x + i * 3), Math.round(y - i * 5), 4, 4);
                }
                ctx.fillStyle = '#5a3a2a';
                ctx.fillRect(Math.round(x - 4), Math.round(y - 4), 9, 9);
                ctx.fillStyle = '#8a5a3a';
                ctx.fillRect(Math.round(x - 3), Math.round(y - 3), 5, 5);
                ctx.fillStyle = '#ff5a3a';
                ctx.fillRect(Math.round(x + 2), Math.round(y - 4), 3, 3);
            }
            const kb = clamp01((phase - 0.42) / 0.06);
            if (kb > 0 && kb < 1)
                this.boom(ctx, stopX, blocked ? v.y - 30 : v.y - 4, kb, '#feae34');
        }
    }
    if (atk === 'treasure') {
        for (const v of views) {
            if (!items.has(v.f))
                continue;
            const k = clamp01((phase - 0.32) / 0.1);
            if (k <= 0 || phase > 0.5)
                continue;
            const x = lerp(this.bossBody.x + 20, v.x - 10, k), y = lerp(this.bossBody.y - 30, v.y - 4, k) - Math.sin(k * Math.PI) * 30;
            ctx.fillStyle = '#7a4a22';
            ctx.fillRect(Math.round(x - 4), Math.round(y - 3), 9, 7);
            ctx.fillStyle = '#feae34';
            ctx.fillRect(Math.round(x - 4), Math.round(y - 1), 9, 2);
        }
    }
}
export function boom(ctx, x, y, k, col) {
    ctx.save();
    ctx.globalAlpha = 1 - k;
    ctx.fillStyle = col;
    for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        ctx.fillRect(Math.round(x + Math.cos(a) * k * 16), Math.round(y + Math.sin(a) * k * 10), 3, 3);
    }
    if (k < 0.4) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, 8 * (1 - k), 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}
//# sourceMappingURL=arena-boss.js.map