import { attackHitFx, tailBandColors } from './bossfx.js';
import { spriteToWorld } from './bossstyle.js';
import { bossOf } from './bossapi.js';
import './bosses/index.js';
import { IMPACT, SCALE, DISSOLVE, clamp01, lerp, win01 } from './arena-common.js';
import { Rng } from '../shared/rng.js';
import { bossCanvas, BOSS_IDLE, BW, BH } from './boss.js';
import { reducedMotion } from './motion.js';
import { boomBurst } from './bosskit.js';
import { bossMotion, makeAt } from './bossmotion.js';
import { chainFeel } from './chainfx.js';
// --- ボス: 構え → 攻撃 → 被弾でひるむ → 撃破で倒れる ---
export function drawBoss(ctx, phase, atk, down, attackOf, chain = null, fleeing = false, scene) {
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
        const fe = c.full ? chainFeel(s.theme?.kind, c, phase, this.frame) : null; // ボスの大魔法の手ごたえ（光の柱は null）
        if (fe) {
            if (fe.hurt)
                p.eye = 'hurt';
            dx += fe.dx;
            dy += fe.dy;
            p.squash = Math.max(p.squash, fe.squash);
            flash = flash || fe.flash;
        }
        else if (c.full && phase >= c.impact && phase < c.impact + 0.12) {
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
    const kind = bossOf(s.theme?.kind).kind;
    const mo = !chain && down < 0 && !fleeing && atk !== 'treasure' ? bossMotion(kind, scene, atk, phase, { reach: Math.max(...s.fighters.filter((f) => !f.off).map((f) => f.slot.x)) + 28 - s.boss.x }) : null;
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
        // 倒れ込んだあと、ゆっくり薄れて消えていく（消えきるまで DISSOLVE。ちらつきながら）
        const fade = clamp01((down - 0.35) / (DISSOLVE - 0.35));
        alpha = 1 - fade * fade * (3 - 2 * fade);
        if (fade > 0 && fade < 1 && this.frame % 10 < 2)
            alpha *= 0.6;
        dy += fade * 6;
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
    ctx.globalAlpha = 1;
    mv?.fx?.(ctx, 'back', at, foot); // 土ぼこり・足もとの霧など
    const body = bossCanvas(p, flash && !reducedMotion(), kind);
    // 足場（海面・霧の台座）は、体が跳ねても・傾いても動かさない。体は足場の線より上だけ描き、足場の帯は絵の下から切り出して同じ場所に描く
    const gr = bossOf(kind).style.ground;
    const moved = transformed || dy !== 0 || tr.y !== 0;
    // 海の足場（bossStyle の sea）: 動くときは、体だけの絵を動かし、海は動かさない（波が体についていかないように。#102）
    const sea = !!gr?.sea && moved;
    const bodyOnly = sea ? bossCanvas({ ...p, hide: 2 }, flash && !reducedMotion(), kind) : body;
    const drawBody = (offX, a, withGround = true) => {
        if (sea) {
            ctx.globalAlpha = a;
            if (s.theme?.filter || s.theme?.hue)
                ctx.filter = s.theme.filter ?? `hue-rotate(${s.theme.hue}deg)`;
            ctx.save();
            ctx.translate(Math.round(s.boss.x + dx + tr.x + offX), Math.round(s.boss.y + 2 + dy + tr.y));
            ctx.rotate(rot);
            ctx.scale(Math.max(0.12, Math.abs(face)) * sx * (face < 0 ? -1 : 1), sy);
            ctx.drawImage(bodyOnly, -BW / 2, -(BH - 2));
            ctx.restore();
            if (withGround)
                ctx.drawImage(bossCanvas({ ...BOSS_IDLE, bob: p.bob, eye: 'open', hide: 3 }, false, kind), Math.round(s.boss.x - BW / 2), Math.round(s.boss.y - BH + 2));
            ctx.filter = 'none';
            return;
        }
        ctx.globalAlpha = a;
        if (s.theme?.filter || s.theme?.hue)
            ctx.filter = s.theme.filter ?? `hue-rotate(${s.theme.hue}deg)`; // ボスごとの色合い
        const split = !!gr && moved && withGround;
        const baseY = Math.round(s.boss.y + 2 - (BH - (gr?.y0 ?? BH)));
        if (split) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(s.boss.x - 400, -2000, 800, 2000 + baseY);
            ctx.clip();
        }
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
        if (split) {
            ctx.restore();
            ctx.drawImage(body, 0, gr.y0, BW, BH - gr.y0, Math.round(s.boss.x - BW / 2 + (gr.followX ? dx + offX : 0)), baseY, BW, BH - gr.y0);
        }
        ctx.filter = 'none';
    };
    for (const g of mv?.ghosts ?? [])
        drawBody(g.dx, alpha * (mv?.alpha ?? 1) * g.alpha, false); // 残像
    drawBody(0, alpha * (mv?.alpha ?? 1));
    ctx.globalAlpha = 1;
    mv?.fx?.(ctx, 'front', at, foot); // 口の光・煙・星・声の輪など
    ctx.restore();
    // 舞台の、ボスの手前（海の波・雪の吹きだまりなど。stagekit.ts）。逃げるときの体のずれは付けない
    const bossFront = bossOf(kind).stage?.bossFront;
    if (bossFront) {
        const { w: W, h: H } = s.arena;
        const rise = mo?.move ? Math.max(0, -mo.dy) + Math.max(0, (mo.sy - 1) * 84) : 0; // 体が足場から持ち上がっている高さ
        ctx.save();
        if (!this.intro)
            ctx.setTransform(SCALE * this.cam.z, 0, 0, SCALE * this.cam.z, SCALE * (W / 2 + this.shakeXY.x) - SCALE * this.cam.z * this.cam.x, SCALE * (H / 2 + this.shakeXY.y) - SCALE * this.cam.z * this.cam.y);
        bossFront(ctx, { foot: this.bossFoot, frame: this.frame, rise, W, H });
        ctx.restore();
    }
}
// 攻撃エフェクト（キャラの後ろ）: 地を這う衝撃波・爆発の輪・隕石の影
export function attackFxBack(ctx, atk, phase, views, targeted, scene) {
    if (atk === 'tail' && !(scene && bossOf(this.script.theme?.kind).fx?.hideTailBand?.includes(scene))) { // 尾の床の帯を描かない場面（BossModule の fx.hideTailBand）
        const k = clamp01((phase - 0.4) / 0.1);
        if (k > 0 && k < 1) {
            const x = lerp(this.bossFoot.x + 30, 384, k);
            ctx.save();
            ctx.globalAlpha = 1 - k * 0.6;
            const bc = tailBandColors(bossOf(this.script.theme?.kind).kind) ?? ['#e8d5a8', '#b8a37a']; // ないボスは、床の砂ぼこり
            for (let y = 96; y < 212; y += 6) {
                ctx.fillStyle = y % 12 ? bc[0] : bc[1];
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
/** 身をかわす動き（攻撃は、元いた所を通りすぎる） */
const PASS_EVADES = ['step', 'dodge', 'jump', 'crawl'];
export function attackFxFront(ctx, atk, phase, views, targeted, evaded, items, w = -1) {
    const kind = bossOf(this.script.theme?.kind).kind;
    const mouth = bossOf(kind).fx?.mouth?.(this.bossFoot) ?? spriteToWorld(this.bossFoot, bossOf(kind).style.mouth);
    const rng = new Rng(`fx:${Math.floor(this.lastTime)}`);
    for (const v of views) {
        if (!targeted(v.f))
            continue;
        const blocked = evaded.has(v.f);
        // かわした人（横へ抜ける・跳ぶ・伏せる）への攻撃は、元いた所（立ち位置）まで届く（体は回避の動きで抜けている。#120）。受け止める・迎え撃つ人の前では、手前で止まる
        const pass = blocked && w >= 0 && PASS_EVADES.includes(this.evadeOf(w, v.f));
        const stopX = v.x - (blocked && !pass ? 12 : 0), over = pass && this.evadeOf(w, v.f) === 'crawl';
        // ボスごとの飛び道具（BossModule の fx.hit）。ないボスは、何も飛ばさない
        attackHitFx(kind, atk, { ctx, phase, frame: this.frame, x: v.x, y: v.y, stopX, blocked, pass, swarm: w >= 0 && this.sceneOf(w) === 'breath', ...(over ? { ty: v.y - 30 } : {}), mouth, hand: spriteToWorld(this.bossFoot, bossOf(kind).style.hand) });
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
    boomBurst(ctx, x, y, k, col);
}
//# sourceMappingURL=arena-boss.js.map