// ボス: vampire（吸血鬼伯爵）の攻撃の演出（#118: もとは bossfx.ts にあったもの）。BossModule の fx（bosses/vampire.ts が登録する）。
// 場面のボス側の演出（scenes）・攻撃が冒険者に届くときの飛び道具（hit）・背後から来る小さな相手（Raider）など。共通の部品は bosskit.ts。
import { band, bat, bump, clamp01, ease, hash, lerp, mistBlob, puffs, R, screenFlash, skyDark, slashMark, sparkle, TAU, win } from '../fxkit.js';
import { GUARD } from '../reach.js';
import { bossOf } from '../bossapi.js';
import { spriteToWorld } from '../bossstyle.js';
import { heroes, landing, aimOf, diveSpot, BACK, backDelay, focusFighter, bodyOf, motionAt, fallingShadow, fallingBoss, ripX, ripMarks, arrive, aimAt, DIVE_FALL, DIVE_AIM_DX, fallingZone, ripArrival, ripNear, easeInv, laneOf } from '../bosskit.js';
/** 討伐隊ぜんたいを裂く大きな爪痕（伸びる爪）。受け止める所（GUARD）を、狙う爪痕が通る（bosskit.ts の ripMarks・arrival.ts） */
export const RIP_V = { n: 5, gap: 24, y0: 54, dy: 3, len: 108, bow: -10, aim: 4, a0: 0.4, a1: 0.45, sp: 1.6, at: GUARD };
// ================= 吸血鬼伯爵 =================
/** 蝙蝠の群れが通る高さ（段の足もとから。立っている人の頭にかかり、伏せた人の上を通る） */
export const VAMP_BATS_DY = 30;
const VAMP_NAIL = { line: '#2a0610', dark: '#6a0f20', body: '#c0283e', hi: '#ff9aae' };
const VAMP_RIP = { line: '#1a0208', dark: '#7a0a1e', body: '#e8284a', hi: '#ffe0e8' };
const vampire = {
    // 蝙蝠の群れ: 蝙蝠が体のまわりを回りながら集まり、マントから群れになって飛び出す
    breath: {
        front(a) {
            const { ctx, phase: p } = a;
            const c = bodyOf(a, 'vampire');
            const gather = win(p, 0.06, 0.4);
            if (gather > 0 && p < 0.46) { // 体のまわりを回りながら、数がふえて集まる
                const n = 4 + R(12 * gather);
                for (let i = 0; i < n; i++) {
                    const ang = p * 9 + (i / n) * TAU, r = lerp(54, 20, gather) * (0.8 + 0.4 * hash(i, 5));
                    bat(ctx, c.x + Math.cos(ang) * r, c.y - 10 + Math.sin(ang) * r * 0.55, ((a.frame >> 1) + i) % 2, '#1a0a24', 1.7);
                }
                puffs(ctx, c.x, c.y + 24, { n: 8, t: p * 2, dx: 0, dy: -30, spread: 50, r0: 3, r1: 8, color: '#5a2a7a', alpha: 0.5 * gather, seed: 31 });
            }
            const rel = win(p, 0.38, 0.6);
            if (rel > 0) { // 群れが飛び出して、列ごとに横ぎる
                // 群れは、冒険者の頭のすぐ上の高さを横ぎる（床に伏せた人の上を通りすぎる）
                const lanes = a.lanes ?? [...new Set(heroes(a).map((v) => Math.round(v.y)))];
                // 1人に寄った窓では、その人の段を通る蝙蝠だけを描く（ほかの段の蝙蝠が、寄った画面では体にぶつかって見える）
                const me = a.solo !== undefined ? a.fighters.find((v) => v.f === a.solo) : undefined, myLane = me ? Math.round(me.y) : null;
                for (let i = 0; i < 24; i++) {
                    if (myLane !== null && lanes.length && lanes[Math.floor(hash(i, 2) * lanes.length)] !== myLane)
                        continue;
                    const t = clamp01((rel - hash(i, 1) * 0.3) / 0.7);
                    if (t <= 0 || t >= 1)
                        continue;
                    const ty = lanes.length ? lanes[Math.floor(hash(i, 2) * lanes.length)] - VAMP_BATS_DY + (hash(i, 3) - 0.5) * 8 : 92 + hash(i, 2) * 112, x = lerp(c.x + 14, a.W + 40, ease(t)), y = lerp(c.y - 10, ty, ease(t)) + Math.sin(t * 11 + i) * 5;
                    ctx.globalAlpha = 1 - Math.max(0, t - 0.88) * 8;
                    bat(ctx, x, y, ((a.frame >> 1) + i) % 2, '#1a0a24', 1.6 + t * 0.6);
                    ctx.fillStyle = 'rgba(110,40,150,0.45)';
                    ctx.fillRect(R(x - 14), R(y), 8, 1);
                    ctx.fillRect(R(x - 22), R(y + 1), 5, 1);
                    ctx.globalAlpha = 1;
                }
                for (const v of heroes(a)) { // 当たった人のまわりを、蝙蝠が回る（かわした人の頭上は通りすぎる）
                    const u = win(p, 0.44, 0.58) * (1 - win(p, 0.56, 0.62));
                    if (u <= 0 || v.ok)
                        continue;
                    for (let i = 0; i < 6; i++) {
                        const ang = a.frame / 4 + (i / 6) * TAU;
                        bat(ctx, v.x + Math.cos(ang) * 13, v.y - 14 + Math.sin(ang) * 7, (a.frame + i) % 2, '#1a0a24', 1.5);
                    }
                }
                screenFlash(ctx, a.W, a.H, bump(p, 0.41, 0.46), '#c070ff', 0.25);
            }
        },
    },
    // 伸びる爪: 指先の五本の爪が、じわじわ血の色に伸びる → 滑るように踏みこんで、討伐隊ぜんたいを五本の大きな爪痕で引き裂く（竜のひっかきと同じ大きさの全体攻撃）。
    //   爪は動く体の手（motionAt）から伸ばすので、踏みこんでもずれない。爪痕が裂けきる山場は 0.42〜0.45（画面の揺れ・のけぞりと同じ）
    claw: {
        front(a) {
            const { ctx, phase: p } = a;
            const at = motionAt(a, 'vampire');
            const h = at(bossOf('vampire').style.hand[0], bossOf('vampire').style.hand[1]);
            const grow = ease(win(p, 0.1, 0.36)), reach = ease(win(p, 0.37, 0.42)), fade = 1 - win(p, 0.47, 0.56);
            if (grow > 0 && fade > 0) { // 五本の爪（付け根は指、先はとがって反る）
                ctx.save();
                ctx.globalAlpha = fade;
                for (let i = 0; i < 5; i++) {
                    const ang = -0.42 + i * 0.13 - reach * 0.2, L = (5 + 30 * grow) * (0.85 + 0.08 * (i % 3)) + 30 * reach, curl = 0.18 + 0.12 * grow; // 刃物のように細く、まっすぐ前へ（先だけ下へ反る）
                    const x0 = h.x + 1, y0 = h.y - 3 + i * 1.5, pts = [];
                    for (let j = 0; j <= 8; j++) {
                        const u = j / 8, an = ang + curl * u * u;
                        pts.push([x0 + Math.cos(an) * L * u, y0 + Math.sin(an) * L * u, lerp(1.5, 0.3, u)]);
                    }
                    band(ctx, pts, VAMP_NAIL);
                }
                ctx.restore();
                if (grow > 0.3 && p < 0.4)
                    for (let i = 0; i < 3; i++)
                        sparkle(ctx, h.x + 8 + 26 * grow + (hash(i, 2) - 0.5) * 10, h.y - 10 + i * 8, 1.5 + 2 * grow * (a.frame % 6 < 3 ? 1 : 0.5), '#ffd0da', grow);
            }
            // 討伐隊ぜんたいを裂く、五本の大きな爪痕（左上 → 右下。一本ずつ少し遅れて裂ける）
            const rip = win(p, RIP_V.a0, RIP_V.a1), gone = win(p, 0.48, 0.6);
            if (rip > 0 && gone < 1) {
                ctx.save();
                ctx.globalAlpha = 1 - gone;
                // 狙う人が受け止めたときは、受け止めた爪痕（右端）は、受け止めた高さで止まる
                const ff = focusFighter(a), stopY = ff?.ok ? ff.y + GUARD.dy + 2 : null;
                ripMarks(a.W, 'vampire', aimOf(a)).forEach(({ x0, y0, x1, y1, bow }, i) => {
                    const raw = clamp01(rip * RIP_V.sp - i * 0.12), stopT = stopY !== null && i >= RIP_V.aim ? clamp01((stopY - y0) / (y1 - y0)) : 1;
                    const t = Math.min(ease(raw), stopT), wdt = lerp(11, 4, gone) * (i === RIP_V.aim ? 1.15 : 1);
                    if (stopT < 1) { // 受け止められる爪痕は、はじめから受け止めた所までの一本として描く（太さは両端へなだらかに細る）
                        const hx = ripX({ x0, y0, x1, y1, bow }, stopY);
                        slashMark(ctx, x0, y0, hx, stopY, wdt, bow * stopT, clamp01(t / stopT), VAMP_RIP);
                    }
                    else
                        slashMark(ctx, x0, y0, x1, y1, wdt, bow, t, VAMP_RIP);
                    const held = t < ease(raw) - 1e-3; // 受け止められて止まった爪痕
                    if (t > 0 && raw < 1 && !held)
                        sparkle(ctx, lerp(x0, x1, t), lerp(y0, y1, t), 4, '#ffffff', 1); // 裂けていく先の閃き
                    if (held) { // 受け止めた所: 白い閃きを一瞬だけ出して、火花を散らす（丸い光を残さない）
                        const k = clamp01((raw - clamp01((stopY - y0) / (y1 - y0))) * 4), hx = ripX({ x0, y0, x1, y1, bow }, stopY);
                        if (k < 1) {
                            sparkle(ctx, hx, stopY, 5 * (1 - k), '#ffffff', 1 - k);
                            for (let j = 0; j < 5; j++) {
                                const an = -2.6 + j * 0.5, d = 3 + 10 * k;
                                ctx.fillStyle = j % 2 ? '#ffd0da' : '#ffffff';
                                ctx.globalAlpha = (1 - k) * (1 - gone);
                                ctx.fillRect(R(hx + Math.cos(an) * d), R(stopY + Math.sin(an) * d), 1, 1);
                            }
                            ctx.globalAlpha = 1 - gone;
                        }
                    }
                });
                ctx.restore();
                for (const v of heroes(a)) { // 当たった人: 血の色の火花が散る
                    if (v.ok)
                        continue;
                    const u = win(p, 0.42, 0.52);
                    if (u <= 0 || u >= 1)
                        continue;
                    const l = landing(v, -12);
                    for (let j = 0; j < 6; j++) {
                        const an = -2.4 + hash(j, v.f) * 2.2, d = 6 + 16 * u * (0.6 + hash(j, v.f + 1));
                        ctx.globalAlpha = 1 - u;
                        ctx.fillStyle = j % 2 ? '#ff5a6e' : '#ffd0da';
                        ctx.fillRect(R(l.x + Math.cos(an) * d), R(l.y + Math.sin(an) * d), 2, 2);
                    }
                    ctx.globalAlpha = 1;
                }
            }
            screenFlash(ctx, a.W, a.H, bump(p, 0.41, 0.46), '#ff3050', 0.28);
        },
    },
    // 急降下: 蝙蝠になって舞い上がり、伯爵の影（本物のシルエット）が蝙蝠の群れとともに落ちてくる
    dive: {
        back: fallingShadow,
        front(a) {
            const { ctx, phase: p } = a;
            const dark = win(p, 0.14, 0.4) * (1 - win(p, 0.46, 0.6));
            skyDark(ctx, a.W, a.H, dark, 'rgba(14,4,22,0.85)', 'rgba(14,4,22,0.35)', 'rgba(14,4,22,0.1)');
            if (dark > 0)
                for (let i = 0; i < 10; i++) { // 頭上を旋回する蝙蝠
                    const u = a.frame / 14 + i * 0.63, x = a.foot.x + 20 + Math.cos(u) * (50 + 10 * i), y = 26 + Math.sin(u * 1.3) * 12 + (i % 3) * 8;
                    ctx.globalAlpha = dark;
                    bat(ctx, x, y, (a.frame + i) % 2, '#0a0410', 1.2);
                    ctx.globalAlpha = 1;
                }
            // 真上から降ってくる伯爵（蝙蝠の群れをまとって）
            fallingBoss(a, 'vampire', '#ff5a7a', (diving) => ({ eye: 'angry', wing: diving ? -1 : 2, lean: diving ? 3 : 0, mouth: diving ? 1 : 0 }), (x, y, k) => {
                for (let i = 0; i < 12; i++) {
                    const ang = a.frame / 8 + i * 0.52, rr = 34 + 10 * hash(i, 2);
                    bat(ctx, x + Math.cos(ang) * rr, y - 40 + Math.sin(ang) * rr * 0.4 - 70 * k * hash(i, 6), (a.frame + i) % 2, '#0a0410', 1.3);
                }
            });
            const b = win(p, 0.42, 0.58);
            if (b > 0 && b < 1) { // 着弾: 蝙蝠が四方に散り、赤い衝撃の輪
                const at = diveSpot(a, 'vampire'), cx = at.x, cy = at.y + 4;
                ctx.save();
                ctx.strokeStyle = '#ff3050';
                ctx.lineWidth = 4 * (1 - b);
                ctx.globalAlpha = 1 - b;
                ctx.beginPath();
                ctx.ellipse(cx, cy, 20 + b * 200, 6 + b * 54, 0, 0, TAU);
                ctx.stroke();
                ctx.strokeStyle = '#ffd0e0';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.ellipse(cx, cy, 10 + b * 150, 3 + b * 40, 0, 0, TAU);
                ctx.stroke();
                ctx.restore();
                for (let i = 0; i < 16; i++) {
                    const ang = hash(i) * TAU, sp = 30 + hash(i, 2) * 110;
                    ctx.globalAlpha = 1 - b;
                    bat(ctx, cx + Math.cos(ang) * sp * b, cy - 8 + Math.sin(ang) * sp * b * 0.6 - 30 * b, (a.frame + i) % 2, '#0a0410', 1.2);
                    ctx.globalAlpha = 1;
                }
                screenFlash(ctx, a.W, a.H, bump(p, 0.42, 0.46), '#ffd0e0', 0.4);
            }
        },
    },
    // 背後の霧: 足もとから霧が床を這って背後へ流れ、霧から蝙蝠が湧いて背後から襲う（竜の尾は出ない）
    tail: {
        front(a) {
            const { ctx, phase: p } = a;
            const flow = win(p, 0.12, 0.4) * (1 - win(p, 0.5, 0.62));
            if (flow > 0) { // 霧の川
                for (let i = 0; i < 4; i++)
                    puffs(ctx, a.foot.x + 10, 176 + i * 8, { n: 14, t: p * 2.2 + i * 0.2, dx: a.W - a.foot.x + 10, dy: 0, spread: 10, r0: 4, r1: 12, color: i % 2 ? '#3a1a52' : '#6a3a8a', alpha: 0.5 * flow, seed: 41 + i });
                mistBlob(ctx, lerp(a.foot.x + 30, a.W - 20, win(p, 0.14, 0.38)), 170, 26, 12, '#4a2a62', 0.55 * flow);
            }
            // 霧から蝙蝠が2匹ずつ、冒険者ひとりずつの背後（右）に湧き（0.28〜）、羽ばたいて間合いをはかり、背中へ襲いかかる。
            // 届く時刻は arrival.ts（BACK.t0 + d）。正しく動けた人は振り向いて迎え撃ち（motionlab.ts の型。当てる先は背後 26 の所）、
            // 蝙蝠はその瞬間に打たれて、紫の煙と羽のかけらになって落ちる。動けなかった人は、背中に噛みつかれて赤い傷が走る
            for (const v of heroes(a)) {
                const d = backDelay(v.f); // 少しずつずらす
                const t0 = BACK.t0 + d, come = ease(win(p, BACK.appear + d, BACK.appear + 0.08 + d)), go = win(p, t0 + 0.06, t0 + 0.14);
                if (come <= 0 || go >= 1)
                    continue;
                const hitC = { x: v.x + BACK.meet.dx, y: v.y + BACK.meet.dy }; // 迎え撃つ所（型の当てる先）
                // 暗い背景（柱の陰）でも見えるよう、紫の縁どりと、うすい光をつけて描く
                const drawBat = (x, y, j, al) => {
                    const fl = ((a.frame >> 1) + j) % 2;
                    ctx.globalAlpha = al * 0.35;
                    ctx.fillStyle = '#9a50d0';
                    ctx.beginPath();
                    ctx.ellipse(R(x), R(y), 9, 6, 0, 0, TAU);
                    ctx.fill();
                    ctx.globalAlpha = al;
                    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]])
                        bat(ctx, x + ox, y + oy, fl, '#c890ff', 2);
                    bat(ctx, x, y, fl, '#12061c', 2);
                    ctx.globalAlpha = 1;
                };
                for (let j = 0; j < 2; j++) {
                    const sd = v.f * 2 + j, oy = j ? 6 : -6;
                    const home = { x: v.x + 46 + 6 * j, y: v.y - 22 + oy + 2 * j }; // 霧から出て、羽ばたいて待つ所
                    const tgt = { x: hitC.x + (j ? 3 : -1), y: hitC.y + oy * 0.6 };
                    const sw0 = win(p, t0 - 0.06 - 0.008 * j, t0), sw = sw0 * sw0; // 襲いかかる（だんだん速く）
                    let x = lerp(home.x, tgt.x, sw) + Math.sin(p * 40 + sd) * 2 * (1 - sw), y = lerp(home.y, tgt.y, sw) + Math.sin(p * 55 + sd * 2) * 2 * (1 - sw) - 6 * Math.sin(sw * Math.PI) * (j ? -1 : 1);
                    if (p < t0 && come < 1) {
                        x = lerp(home.x + 10, x, come);
                    }
                    const al = come;
                    if (v.ok) {
                        if (p < t0) {
                            drawBat(x, y, j, al);
                            continue;
                        }
                        // 打たれて砕ける: 白い光 → 紫の煙 → 羽のかけらが落ちる
                        const k = win(p, t0, t0 + 0.1);
                        if (k < 1) {
                            sparkle(ctx, tgt.x, tgt.y, 3 + 5 * (1 - k), '#ffffff', 1 - k);
                            puffs(ctx, tgt.x, tgt.y, { n: 6, t: k, dx: 6, dy: -6, spread: 10, r0: 2, r1: 6, color: '#6a3a8a', alpha: 0.8 * (1 - k), seed: 51 + sd });
                            ctx.fillStyle = '#c890ff';
                            ctx.globalAlpha = 1 - k;
                            for (let i = 0; i < 5; i++) {
                                const ang = hash(i, sd) * TAU;
                                ctx.fillRect(R(tgt.x + Math.cos(ang) * 9 * k), R(tgt.y + Math.sin(ang) * 5 * k + 18 * k * k), 2, 1);
                            }
                            ctx.globalAlpha = 1;
                        }
                    }
                    else {
                        // 背中まで届いて噛みつき、上へ飛び去る
                        const bite = { x: v.x + 3, y: v.y - 16 + oy * 0.5 };
                        const to = win(p, t0, t0 + 0.03), off = win(p, t0 + 0.05, t0 + 0.14);
                        if (p >= t0) {
                            x = lerp(lerp(tgt.x, bite.x, to), v.x + 60, off);
                            y = lerp(lerp(tgt.y, bite.y, to), v.y - 70, off);
                        }
                        drawBat(x, y, j, al * (1 - go));
                    }
                }
                if (!v.ok) {
                    const cut = win(p, t0 + 0.02, t0 + 0.06), fadeCut = 1 - win(p, t0 + 0.08, t0 + 0.16);
                    if (cut > 0 && fadeCut > 0) {
                        const l = landing(v, 0);
                        ctx.save();
                        ctx.globalAlpha = fadeCut;
                        slashMark(ctx, l.x + 10, l.y - 26, l.x - 2, l.y - 8, 4, 3, ease(cut), VAMP_RIP);
                        slashMark(ctx, l.x + 12, l.y - 18, l.x, l.y - 2, 4, 3, ease(win(cut, 0.3, 1)), VAMP_RIP);
                        ctx.restore();
                    }
                }
            }
            screenFlash(ctx, a.W, a.H, bump(p, 0.41, 0.46), '#c070ff', 0.2);
        },
    },
};
const HIT = {
    breath: (o, { k, fx, fy }) => {
        // 蝙蝠の群れ（vampire.breath）が出るブレスの場面では、伏せた人へは1人分の蝙蝠を飛ばさない（群れが伏せた上を通りすぎる）。
        // 群れの出ない場面（組み合わせ・仲間の声・記憶など）では、1人分の蝙蝠を飛ばす（伏せた人には頭の上を越えていく: ty）
        if (o.blocked && o.pass && o.swarm)
            return;
        const { ctx } = o;
        for (let i = 0; i < 5; i++) {
            const t = clamp01(k * 1.3 - i * 0.07);
            if (t > 0)
                bat(ctx, fx(t) + (hash(i) - 0.5) * 8, fy(t) + (hash(i, 2) - 0.5) * 12 + Math.sin(t * 9 + i) * 4, (o.frame + i) % 2, '#1a0a24', 1.6);
        }
    },
    claw: (o, { k }) => { const { ctx, stopX, y } = o; ctx.globalAlpha = 0.8; for (let i = 0; i < 3; i++)
        slashMark(ctx, stopX - 10 + i * 5, y - 30, stopX - 2 + i * 5, y - 4, 2.5, -2, ease(clamp01(k * 1.4 - i * 0.15)), VAMP_RIP); }, // ひとり分の、三本の爪痕
    meteor: (o, { cx, cy }) => { const { ctx } = o; for (let i = 0; i < 5; i++)
        bat(ctx, cx + (hash(i) - 0.5) * 14, cy - i * 5 + (hash(i, 2) - 0.5) * 8, (o.frame + i) % 2, '#1a0a24', 1.6); },
    meteorDust: '#c070ff',
};
export const fx = { scenes: vampire, hit: HIT, rip: RIP_V };
// ---- 攻撃が届く時刻と所（BossModule の arrival。#118 の PR5: もとは arrival.ts の種類ごとの分岐） ----
export const arrivalFns = {
    of: (c) => {
        if (c.scene === 'breath') { // 蝙蝠の群れ: 自分の段を通る蝙蝠が、自分の x に来る時刻（このファイルの breath）
            const { x, y, foot, W } = c;
            const cx = spriteToWorld(foot, bossOf('vampire').style.body).x + 14, k = easeInv((x - 22 - cx) / (W + 40 - cx)); // 蝙蝠の翼の先が、体の前の端（中心の 22 手前）に届く時刻
            const lane = c.lanes.length ? c.lanes.reduce((b, l) => (Math.abs(l - y) < Math.abs(b - y) ? l : b), c.lanes[0]) : y;
            let t0 = 1, t1 = 0;
            for (let i = 0; i < 24; i++) {
                if (c.lanes.length && c.lanes[Math.floor(hash(i, 2) * c.lanes.length)] !== lane)
                    continue;
                const p = 0.38 + 0.22 * (k * 0.7 + hash(i, 1) * 0.3);
                t0 = Math.min(t0, p);
                t1 = Math.max(t1, p);
            }
            return t0 > t1 ? arrive(0.45) : { t0, t1 };
        }
        if (c.scene === 'claw')
            return ripArrival(c); // 討伐隊ぜんたいを裂く大きな爪痕
        if (c.scene === 'dive')
            return arrive(DIVE_FALL.hit, 0.47); // 真上から突っこむ
        return undefined;
    },
    zones: (c) => (c.scene === 'dive' ? [fallingZone(c)] : []),
    strike: (c) => {
        if (c.scene === 'breath') {
            const { ls, j } = laneOf(c);
            return { x: c.x, y: ls[j] - VAMP_BATS_DY, r: 6 };
        } // 蝙蝠の群れは、段の頭の高さを通る
        if (c.scene === 'claw') {
            const n = ripNear(c);
            return { x: n.x, y: n.y, r: 7 };
        }
        if (c.scene === 'dive') {
            const aim = aimAt(c);
            return { x: aim.x + DIVE_AIM_DX, y: aim.y, r: 58 };
        }
        return undefined;
    },
};
//# sourceMappingURL=vampire-fx.js.map