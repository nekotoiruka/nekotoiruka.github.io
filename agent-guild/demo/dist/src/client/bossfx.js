import { arrow, bat, bump, clamp01, crack, crescent, dustRing, ease, fangShape, glowAt, goblinSil, hash, iceSpear, lerp, mistBlob, nail, puffs, R, rock, screenFlash, shard, skyDark, sparkle, spiderLeg, TAU, tentacle, webNet, win } from './fxkit.js';
import { STYLE, spriteToWorld } from './bossstyle.js';
const heroes = (a) => a.fighters.filter((v) => v.alive);
/** 技が届く先: 正しく動けた人（ok）は、少し手前にはずれる */
const landing = (v, dy = -10) => ({ x: v.ok ? v.x - 16 : v.x, y: v.y + dy });
const bodyOf = (a, kind) => spriteToWorld(a.foot, STYLE[kind].body);
// ================= 吸血鬼伯爵 =================
const vampire = {
    // 蝙蝠の群れ: 蝙蝠が体のまわりを回りながら集まり、マントから群れになって飛び出す
    breath: {
        back(a) {
            const { ctx, phase: p } = a;
            const k = win(p, 0.1, 0.42) * (1 - win(p, 0.5, 0.62));
            if (k <= 0)
                return;
            ctx.save();
            const g = ctx.createLinearGradient(a.foot.x, 0, a.W, 0);
            g.addColorStop(0, 'rgba(110,40,150,0.5)');
            g.addColorStop(1, 'rgba(110,40,150,0.06)');
            ctx.globalAlpha = k * (0.7 + 0.3 * Math.sin(a.frame / 2));
            ctx.fillStyle = g;
            ctx.fillRect(a.foot.x, 86, a.W, 130);
            ctx.restore();
        },
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
                for (let i = 0; i < 24; i++) {
                    const t = clamp01((rel - hash(i, 1) * 0.3) / 0.7);
                    if (t <= 0 || t >= 1)
                        continue;
                    const ty = 92 + hash(i, 2) * 112, x = lerp(c.x + 14, a.W + 40, ease(t)), y = lerp(c.y - 10, ty, ease(t)) + Math.sin(t * 11 + i) * 5;
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
    // 伸びる爪: 指先の爪がじわじわ伸びて、長い爪で引き裂く（五本のかぎ爪の赤い軌跡）
    claw: {
        front(a) {
            const { ctx, phase: p } = a;
            const h = spriteToWorld(a.foot, STYLE.vampire.hand);
            const grow = ease(win(p, 0.1, 0.38)), reach = win(p, 0.38, 0.46);
            if (grow > 0 && p < 0.56) { // 五本の爪が伸びる（突くと前へ）
                const L = lerp(4, 34, grow) + 70 * reach, fade = 1 - win(p, 0.5, 0.58);
                ctx.save();
                ctx.globalAlpha = fade;
                for (let i = 0; i < 5; i++) {
                    const ang = -0.5 + i * 0.22 + reach * 0.18; // 指ごとに少し開く
                    nail(ctx, h.x + 3, h.y - 1 + i * 0.5, L * (0.8 + 0.1 * (i % 3)), ang, 3 + 3 * grow, '#9a1428', '#ff8aa0', 2.6);
                }
                ctx.restore();
                sparkle(ctx, h.x + L * 0.9, h.y - 8, 3 + 3 * grow, '#ffd0e0', grow * fade);
            }
            for (const v of heroes(a)) { // 引き裂き: 五本の筋
                const k = win(p, 0.4, 0.48), fade = 1 - win(p, 0.5, 0.62);
                if (k <= 0 || fade <= 0)
                    continue;
                const l = landing(v, -4);
                ctx.save();
                ctx.globalAlpha = fade * (v.ok ? 0.45 : 1);
                ctx.lineCap = 'round';
                for (let j = 0; j < 5; j++) {
                    const x0 = l.x - 15 + j * 4, y0 = l.y - 36, x1 = x0 + 20, y1 = l.y + 2, e = ease(k);
                    const mx = lerp(x0, x1, e), my = lerp(y0, y1, e);
                    ctx.strokeStyle = '#8a0f22';
                    ctx.lineWidth = 3.2;
                    ctx.beginPath();
                    ctx.moveTo(x0, y0);
                    ctx.lineTo(mx, my);
                    ctx.stroke();
                    ctx.strokeStyle = '#ff5a6e';
                    ctx.lineWidth = 1.8;
                    ctx.stroke();
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 0.7;
                    ctx.beginPath();
                    ctx.moveTo(x0 + 0.5, y0);
                    ctx.lineTo(mx + 0.5, my);
                    ctx.stroke();
                }
                ctx.restore();
            }
            screenFlash(ctx, a.W, a.H, bump(p, 0.4, 0.44), '#ff3050', 0.25);
        },
    },
    // 急降下: 蝙蝠になって舞い上がり、伯爵の影（本物のシルエット）が蝙蝠の群れとともに落ちてくる
    dive: {
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
            const k = win(p, 0.36, 0.43);
            if (k > 0 && k < 1) { // 落ちてくる影
                const x = lerp(a.W * 0.2, a.W * 0.68, k), y = lerp(-40, 150, ease(k)), s = 0.7 + k * 1.1;
                if (a.bossSil) {
                    ctx.save();
                    ctx.globalAlpha = 0.9;
                    ctx.translate(x, y);
                    ctx.rotate(0.5 - k * 0.5);
                    ctx.scale(s, s);
                    ctx.drawImage(a.bossSil, -48, -70);
                    ctx.restore();
                }
                for (let i = 0; i < 12; i++) {
                    const u = k - i * 0.05;
                    if (u <= 0)
                        continue;
                    bat(ctx, lerp(a.W * 0.2, a.W * 0.68, u) + (hash(i) - 0.5) * 30, lerp(-40, 150, ease(u)) - 10 + (hash(i, 2) - 0.5) * 24, (a.frame + i) % 2, '#0a0410', 1.2);
                }
            }
            const b = win(p, 0.42, 0.58);
            if (b > 0 && b < 1) { // 着弾: 蝙蝠が四方に散り、赤い衝撃の輪
                const cx = a.W * 0.68, cy = 160;
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
    // 背後の霧: 足もとから霧が床を這って背後へ流れ、背後で姿をあらわして切りつける（竜の尾は出ない）
    tail: {
        front(a) {
            const { ctx, phase: p } = a;
            const flow = win(p, 0.12, 0.4) * (1 - win(p, 0.5, 0.62));
            if (flow > 0) { // 霧の川
                for (let i = 0; i < 4; i++)
                    puffs(ctx, a.foot.x + 10, 176 + i * 8, { n: 14, t: p * 2.2 + i * 0.2, dx: a.W - a.foot.x + 10, dy: 0, spread: 10, r0: 4, r1: 12, color: i % 2 ? '#3a1a52' : '#6a3a8a', alpha: 0.5 * flow, seed: 41 + i });
                mistBlob(ctx, lerp(a.foot.x + 30, a.W - 20, win(p, 0.14, 0.38)), 170, 26, 12, '#4a2a62', 0.55 * flow);
            }
            const bx = a.partyX !== undefined ? a.partyX + 28 : a.foot.x + 120, by = a.foot.y - 26; // 背後（討伐隊のいちばん右の先）に姿をあらわす。ボスの体の動き（bossmotion.ts）と同じ位置
            const out = bump(p, 0.32, 0.5);
            if (out > 0) { // 霧が柱になって湧き、すぐ晴れる
                puffs(ctx, bx, by + 30, { n: 14, t: p * 3, dx: 0, dy: -50, spread: 34, r0: 4, r1: 11, color: '#5a2a7a', alpha: 0.75 * out, seed: 47 });
                glowAt(ctx, bx, by, 26 * out, '#ffd0e0', '#d02050', 0.45 * out);
            }
            const k = win(p, 0.4, 0.5), fade = 1 - win(p, 0.5, 0.6);
            if (k > 0 && fade > 0) { // 背後からの斬撃: 三日月の軌跡と、一人ずつの引き裂き
                ctx.save();
                ctx.globalAlpha = fade;
                crescent(ctx, bx - 6, by + 4, 52, 90, Math.PI * 1.32, Math.PI * 0.66, k, '#c0183a', '#ffd0e0', 0.75);
                crescent(ctx, bx - 6, by + 4, 40, 70, Math.PI * 1.28, Math.PI * 0.7, k, 'rgba(255,120,150,0.7)', '#ffffff', 0.75);
                ctx.restore();
                for (const v of heroes(a)) {
                    const l = landing(v, -4), e = ease(win(p, 0.42, 0.5));
                    ctx.save();
                    ctx.globalAlpha = fade * (v.ok ? 0.4 : 1);
                    ctx.lineCap = 'round';
                    for (let j = 0; j < 3; j++) {
                        const x0 = l.x + 14 - j * 4, y0 = l.y - 30, x1 = x0 - 20, y1 = l.y + 2;
                        ctx.strokeStyle = '#ff5a6e';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo(x0, y0);
                        ctx.lineTo(lerp(x0, x1, e), lerp(y0, y1, e));
                        ctx.stroke();
                    }
                    ctx.restore();
                }
                screenFlash(ctx, a.W, a.H, bump(p, 0.41, 0.45), '#c070ff', 0.2);
            }
        },
    },
};
// ================= 大蜘蛛アラクネア =================
const spider = {
    // 糸: 空気中の糸が口に吸い込まれ、五本の白い糸が列ごとに飛んで、巣になって絡みつく
    breath: {
        back(a) {
            const { ctx, phase: p } = a;
            const k = win(p, 0.1, 0.42) * (1 - win(p, 0.5, 0.62));
            if (k <= 0)
                return;
            ctx.save();
            ctx.globalAlpha = k * 0.35;
            ctx.fillStyle = '#cfe0ff';
            ctx.fillRect(a.foot.x, 150, a.W, 62);
            ctx.restore();
        },
        front(a) {
            const { ctx, phase: p } = a;
            const m = spriteToWorld(a.foot, STYLE.spider.mouth);
            const gather = win(p, 0.06, 0.4);
            if (gather > 0 && p < 0.44) { // 細い糸が、まわりから口へ吸い寄せられる
                ctx.save();
                ctx.strokeStyle = '#f4f6ff';
                ctx.lineWidth = 1;
                for (let i = 0; i < 16; i++) {
                    const ang = hash(i) * TAU, d0 = 26 + hash(i, 2) * 44, u = (gather * (0.7 + hash(i, 3)) + hash(i, 4)) % 1, d = d0 * (1 - u);
                    ctx.globalAlpha = u * 0.9;
                    ctx.beginPath();
                    ctx.moveTo(R(m.x + Math.cos(ang) * d), R(m.y + Math.sin(ang) * d * 0.7));
                    ctx.lineTo(R(m.x + Math.cos(ang) * (d + 8)), R(m.y + Math.sin(ang) * (d + 8) * 0.7));
                    ctx.stroke();
                }
                ctx.restore();
                glowAt(ctx, m.x, m.y, 4 + gather * 9, '#ffffff', '#9ad0ff', 0.7 * gather);
            }
            const rel = win(p, 0.38, 0.5), fade = 1 - win(p, 0.54, 0.62);
            if (rel > 0 && fade > 0) { // 白い糸が飛び、巣になる
                const hs = heroes(a);
                const targets = hs.length ? hs.map((v) => landing(v, -12)) : [{ x: a.W - 40, y: 150 }];
                ctx.save();
                ctx.globalAlpha = fade;
                ctx.strokeStyle = '#f4f6ff';
                ctx.lineWidth = 1.5;
                targets.forEach((t, i) => {
                    const e = ease(win(rel, 0, 0.7)), x = lerp(m.x, t.x, e), y = lerp(m.y, t.y, e) - Math.sin(e * Math.PI) * 10;
                    ctx.beginPath();
                    ctx.moveTo(m.x, m.y);
                    ctx.quadraticCurveTo(lerp(m.x, x, 0.5), lerp(m.y, y, 0.5) + 8, x, y);
                    ctx.stroke();
                    webNet(ctx, t.x, t.y, 24, win(rel, 0.55, 1), '#f4f6ff');
                    sparkle(ctx, x, y, 2 + (i % 2), '#ffffff', 1 - win(rel, 0.7, 1));
                });
                ctx.restore();
                screenFlash(ctx, a.W, a.H, bump(p, 0.41, 0.45), '#d8e8ff', 0.2);
            }
        },
    },
    // 毒牙: 牙が大きく開いて毒がしたたり、飛びかかって噛みつく（二本の牙と毒のしぶき）
    claw: {
        front(a) {
            const { ctx, phase: p } = a;
            const m = spriteToWorld(a.foot, STYLE.spider.mouth);
            const open = ease(win(p, 0.1, 0.36)) * (1 - win(p, 0.5, 0.58));
            if (open > 0) { // 口もとの牙: 開いて、毒がしたたる
                fangShape(ctx, m.x - 2, m.y - 2, 6 + 7 * open, 3.4, Math.PI * 0.5 + 0.15 + (1 - open) * 0.3);
                fangShape(ctx, m.x + 4, m.y - 1, 6 + 7 * open, 3.4, Math.PI * 0.5 - 0.15 - (1 - open) * 0.3);
                ctx.fillStyle = '#7bed9f';
                for (let i = 0; i < 3; i++) {
                    const u = (p * 4 + i / 3) % 1;
                    ctx.globalAlpha = (1 - u) * open;
                    ctx.fillRect(R(m.x - 2 + i * 3), R(m.y + 10 + open * 4 + u * 12), 2, 3);
                }
                ctx.globalAlpha = 1;
            }
            for (const v of heroes(a)) { // 噛みつき: 上から二本の大きな牙が閉じる
                const k = win(p, 0.4, 0.47), fade = 1 - win(p, 0.5, 0.62);
                if (k <= 0 || fade <= 0)
                    continue;
                const l = landing(v, -8), drop = ease(k), y0 = l.y - 54 + drop * 30;
                ctx.save();
                ctx.globalAlpha = fade * (v.ok ? 0.5 : 1);
                fangShape(ctx, l.x - 7, y0 - 14, 22, 8, Math.PI / 2 + 0.12);
                fangShape(ctx, l.x + 7, y0 - 14, 22, 8, Math.PI / 2 - 0.12);
                ctx.fillStyle = '#7bed9f';
                for (let i = 0; i < 6; i++) {
                    const u = win(k, 0.5, 1) * (0.6 + hash(i));
                    ctx.fillRect(R(l.x - 12 + i * 5), R(l.y - 18 + u * 20), 2, 3);
                }
                ctx.restore();
                glowAt(ctx, l.x, l.y - 14, 14 * k, '#d8ffe0', '#3bd070', 0.5 * k * fade);
            }
            screenFlash(ctx, a.W, a.H, bump(p, 0.4, 0.44), '#7bed9f', 0.2);
        },
    },
    // 落下: 天井へ糸を伝って登り、糸を引いて降ってくる（巣が広がる）
    dive: {
        front(a) {
            const { ctx, phase: p } = a;
            const dark = win(p, 0.14, 0.4) * (1 - win(p, 0.46, 0.6));
            skyDark(ctx, a.W, a.H, dark * 0.7, 'rgba(8,6,16,0.8)', 'rgba(8,6,16,0.3)', 'rgba(8,6,16,0.05)');
            const k = win(p, 0.36, 0.43), cx = a.W * 0.68;
            if (k > 0 && k < 1) { // 糸を引いて降りてくる蜘蛛の影
                const y = lerp(-40, 148, ease(k)), s = 0.8 + k * 0.9;
                ctx.save();
                ctx.strokeStyle = '#f4f6ff';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(cx, -10);
                ctx.lineTo(cx, y - 18 * s);
                ctx.stroke();
                if (a.bossSil) {
                    ctx.globalAlpha = 0.92;
                    ctx.translate(cx, y);
                    ctx.scale(s * 0.9, s * 0.9);
                    ctx.drawImage(a.bossSil, -48, -62);
                }
                ctx.restore();
            }
            const b = win(p, 0.42, 0.58);
            if (b > 0 && b < 1) { // 着地: 巣が広がり、糸が四方へ
                ctx.save();
                ctx.globalAlpha = 1 - b;
                webNet(ctx, cx, 160, 20 + 120 * ease(win(b, 0, 0.6)), 1, '#f4f6ff');
                ctx.restore();
                puffs(ctx, cx, 158, { n: 10, t: b, dx: 0, dy: -20, spread: 100, r0: 2, r1: 6, color: '#cfd8ee', alpha: 0.6 * (1 - b), seed: 51 });
                screenFlash(ctx, a.W, a.H, bump(p, 0.42, 0.46), '#ffffff', 0.4);
            }
        },
    },
    // 脚の薙ぎはらい: 節のある太い脚が、床を横ざまに薙ぎはらう
    tail: {
        front(a) {
            const { ctx, phase: p } = a;
            const base = spriteToWorld(a.foot, [58, 40]);
            const sw = win(p, 0.36, 0.5), fade = 1 - win(p, 0.5, 0.6);
            const rise = bump(p, 0.1, 0.4) * (1 - sw);
            if (rise > 0) { // 脚を高くかかげる（震える）
                for (let i = 0; i < 3; i++)
                    spiderLeg(ctx, base.x + i * 4, base.y, base.x + 20 + i * 6, base.y - 34 - i * 5 + Math.sin(a.frame * 1.7 + i) * rise, base.x + 40 + i * 8, base.y - 22 - i * 4, 4 - i * 0.6);
            }
            if (sw > 0 && fade > 0) {
                ctx.save();
                ctx.globalAlpha = fade;
                for (let i = 0; i < 3; i++) { // 三本の脚が、床の上を薙ぐ（奥の脚ほど高く・細い）
                    const e = ease(sw), reach = lerp(40, 250 - i * 30, e), ky = base.y + 40 - i * 6;
                    spiderLeg(ctx, base.x + 4 * i, base.y - 4 + i * 6, base.x + reach * 0.45, ky - 38 + (1 - e) * -20 + i * 4, base.x + reach, ky + 14 - i * 5, 5 - i * 0.9);
                }
                ctx.restore();
                puffs(ctx, base.x + lerp(40, 250, ease(sw)), a.foot.y - 4, { n: 8, t: sw * 2, dx: -40, dy: -6, spread: 12, r0: 2, r1: 6, color: '#9a8aa8', alpha: 0.7 * fade, seed: 53 });
                screenFlash(ctx, a.W, a.H, bump(p, 0.41, 0.45), '#ffffff', 0.15);
            }
        },
    },
};
// ================= ゴブリンの頭目ガルグ =================
const goblin = {
    // 矢の雨: 頭目が号令をかけ、空から矢がいっせいに降る（地面に刺さる）
    breath: {
        back(a) {
            const { ctx, phase: p } = a;
            const k = win(p, 0.1, 0.42) * (1 - win(p, 0.5, 0.62));
            if (k <= 0)
                return;
            ctx.save();
            ctx.globalAlpha = k * 0.3;
            ctx.fillStyle = '#1a1208';
            ctx.fillRect(a.foot.x, 0, a.W, 100);
            ctx.restore();
        },
        front(a) {
            const { ctx, phase: p } = a;
            const h = spriteToWorld(a.foot, STYLE.goblin.hand);
            const raise = win(p, 0.06, 0.34);
            if (raise > 0 && p < 0.44) { // 号令: 棍棒を掲げ、きらめき
                sparkle(ctx, h.x + 4, h.y - 10 - raise * 6, 3 + 3 * raise, '#fff2b0', raise);
                for (let i = 0; i < 3; i++) {
                    const u = fract2(p * 3 + i / 3);
                    ctx.save();
                    ctx.globalAlpha = (1 - u) * raise;
                    ctx.strokeStyle = '#fff2b0';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.arc(h.x - 10, h.y + 12, 6 + u * 22, -1.0, 1.0);
                    ctx.stroke();
                    ctx.restore();
                }
            }
            const rel = win(p, 0.34, 0.6);
            if (rel > 0) { // 矢が空から降る
                const hs = heroes(a);
                const n = 26;
                for (let i = 0; i < n; i++) {
                    const t = clamp01((rel - hash(i, 1) * 0.32) / 0.36);
                    if (t <= 0)
                        continue;
                    const v = hs.length ? hs[i % hs.length] : null;
                    const gx = (v ? landing(v, 0).x : a.W - 60) + (hash(i, 2) - 0.5) * 36, gy = (v ? v.y : 170) + (hash(i, 3) - 0.5) * 22;
                    const e = Math.min(1, t * 1.2), x = lerp(gx + 34, gx, e), y = lerp(-20, gy - 6, e);
                    const stuck = t >= 0.83;
                    ctx.globalAlpha = stuck ? 1 - win(p, 0.56, 0.62) : 1;
                    arrow(ctx, stuck ? gx : x, stuck ? gy - 4 : y, stuck ? 1.9 : 1.9, 14);
                    ctx.globalAlpha = 1;
                }
                screenFlash(ctx, a.W, a.H, bump(p, 0.44, 0.48), '#ffe0a0', 0.18);
            }
        },
    },
    // 落とし穴: 足もとが割れて、杭のならぶ穴があく（土が舞う）
    claw: {
        front(a) {
            const { ctx, phase: p } = a;
            const run = win(p, 0.3, 0.42);
            if (run > 0)
                crack(ctx, a.foot.x + 40, a.foot.y - 2, (a.W - a.foot.x) * 0.9, 0, 11, run, '#1a1008', '#ffd080', 2);
            for (const v of heroes(a)) {
                const k = win(p, 0.4, 0.5), fade = 1 - win(p, 0.56, 0.66);
                if (k <= 0 || fade <= 0)
                    continue;
                const l = landing(v, 2);
                ctx.save();
                ctx.globalAlpha = fade * (v.ok ? 0.6 : 1);
                const e = ease(k);
                ctx.fillStyle = '#1a1008';
                ctx.beginPath();
                ctx.ellipse(l.x, l.y, 4 + 16 * e, 2 + 6 * e, 0, 0, TAU);
                ctx.fill();
                ctx.strokeStyle = '#5a3a1a';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.fillStyle = '#c8b48a';
                for (let i = -2; i <= 2; i++) {
                    const sx = l.x + i * 6 * e, h = (8 + 6 * hash(i + 3)) * e;
                    ctx.beginPath();
                    ctx.moveTo(R(sx - 2), R(l.y + 1));
                    ctx.lineTo(R(sx), R(l.y - h));
                    ctx.lineTo(R(sx + 2), R(l.y + 1));
                    ctx.closePath();
                    ctx.fill();
                }
                ctx.restore();
                puffs(ctx, l.x, l.y - 2, { n: 8, t: k, dx: 0, dy: -22, spread: 30, r0: 2, r1: 5, color: '#7a5a34', alpha: 0.7 * fade, seed: 57 });
            }
            screenFlash(ctx, a.W, a.H, bump(p, 0.4, 0.44), '#ffd080', 0.18);
        },
    },
    // 投石: 抱えた大岩を山なりに投げる（岩は回りながら飛び、砕けて砂ぼこり）
    dive: {
        front(a) {
            const { ctx, phase: p } = a;
            const h = spriteToWorld(a.foot, [66, 6]);
            const hs = heroes(a), tx = hs.length ? hs.reduce((s, v) => s + v.x, 0) / hs.length : a.W * 0.68, ty = 158;
            const k = win(p, 0.34, 0.44);
            if (k > 0 && k < 1) { // 山なりの軌道
                const x = lerp(h.x, tx, k), y = lerp(h.y, ty, k) - Math.sin(k * Math.PI) * 120, r = 8 + 5 * Math.sin(k * Math.PI);
                for (let i = 1; i <= 4; i++) {
                    const u = k - i * 0.05;
                    if (u <= 0)
                        continue;
                    ctx.globalAlpha = 0.35 / i;
                    ctx.fillStyle = '#a89a80';
                    ctx.fillRect(R(lerp(h.x, tx, u)), R(lerp(h.y, ty, u) - Math.sin(u * Math.PI) * 120), 5, 5);
                }
                ctx.globalAlpha = 1;
                rock(ctx, x, y, r, a.frame / 3, 3, '#7a6a52', '#b0a080', '#3a2a1a');
                ctx.fillStyle = `rgba(0,0,0,${0.25 * k})`;
                ctx.beginPath();
                ctx.ellipse(tx, ty + 6, 6 + 16 * k, 2 + 5 * k, 0, 0, TAU);
                ctx.fill(); // 落ちる影
            }
            const b = win(p, 0.42, 0.58);
            if (b > 0 && b < 1) {
                dustRing(ctx, tx, ty + 6, b, 100);
                for (let i = 0; i < 14; i++) {
                    const ang = Math.PI * (1.05 + hash(i) * 0.9), sp = 30 + hash(i, 2) * 90;
                    ctx.globalAlpha = 1 - b;
                    rock(ctx, tx + Math.cos(ang) * sp * b, ty + Math.sin(ang) * sp * b + 140 * b * b, 2 + hash(i, 3) * 3, i, i, '#6a5a4a', '#9a8a72', '#3a2a1a');
                    ctx.globalAlpha = 1;
                }
                screenFlash(ctx, a.W, a.H, bump(p, 0.42, 0.46), '#ffffff', 0.3);
            }
        },
    },
    // 突進: 頭目とゴブリンの群れが、槍をかまえて床を駆けぬける（砂ぼこり）
    tail: {
        front(a) {
            const { ctx, phase: p } = a;
            const run = win(p, 0.3, 0.52), fade = 1 - win(p, 0.52, 0.6);
            if (run > 0 && fade > 0) {
                const lead = lerp(a.foot.x + 10, a.W + 80, ease(run));
                ctx.save();
                ctx.globalAlpha = fade;
                for (let i = 0; i < 9; i++) {
                    const x = lead - 20 - (i % 5) * 26 - Math.floor(i / 5) * 12, y = 156 + (i % 4) * 14 + hash(i) * 6;
                    if (x < a.foot.x - 10)
                        continue;
                    goblinSil(ctx, x, y, 1.15, a.frame / 2 + i);
                    puffs(ctx, x - 6, y - 1, { n: 4, t: p * 5 + i, dx: -16, dy: -5, spread: 6, r0: 2, r1: 5, color: '#c8b48a', alpha: 0.6, seed: 61 + i });
                }
                ctx.restore();
                puffs(ctx, lead - 30, 190, { n: 10, t: p * 4, dx: -60, dy: -8, spread: 20, r0: 3, r1: 9, color: '#b8a37a', alpha: 0.6 * fade, seed: 59 });
                screenFlash(ctx, a.W, a.H, bump(p, 0.41, 0.45), '#ffffff', 0.18);
            }
        },
    },
};
function fract2(x) { return x - Math.floor(x); }
// ================= 大王クラーケン =================
/** 触手の中心線: 付け根 (bx,by) から、角度 ang・長さ len・反り bend の曲線上の点 */
function tentaclePts(bx, by, ang, len, bend, n = 12) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
        const u = i / n, a = ang + bend * u * u;
        pts.push([bx + Math.cos(a) * len * u, by + Math.sin(a) * len * u * 0.9 + Math.sin(u * 5) * 3]);
    }
    return pts;
}
const kraken = {
    // 墨: 漏斗に水が吸いこまれ、黒い墨が列ごとに噴きつける（しぶきと墨だまり）
    breath: {
        back(a) {
            const { ctx, phase: p } = a;
            const k = win(p, 0.1, 0.42) * (1 - win(p, 0.5, 0.62));
            if (k <= 0)
                return;
            ctx.save();
            ctx.globalAlpha = k * 0.4;
            ctx.fillStyle = '#10062a';
            ctx.fillRect(a.foot.x, 120, a.W, 92);
            ctx.restore();
        },
        front(a) {
            const { ctx, phase: p } = a;
            const f = spriteToWorld(a.foot, STYLE.kraken.mouth);
            const gather = win(p, 0.06, 0.4);
            if (gather > 0 && p < 0.44) { // 泡と水が漏斗に集まる
                for (let i = 0; i < 14; i++) {
                    const ang = hash(i) * TAU, d0 = 20 + hash(i, 2) * 40, u = (gather * (0.7 + hash(i, 3)) + hash(i, 4)) % 1, d = d0 * (1 - u);
                    ctx.globalAlpha = u;
                    ctx.strokeStyle = '#d8f2ff';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.arc(R(f.x + Math.cos(ang) * d), R(f.y + Math.sin(ang) * d * 0.7), 1 + (i % 3), 0, TAU);
                    ctx.stroke();
                }
                ctx.globalAlpha = 1;
                glowAt(ctx, f.x, f.y, 3 + gather * 6, '#6a4aa0', '#1a0a2a', 0.8 * gather);
            }
            const rel = win(p, 0.38, 0.5), fade = 1 - win(p, 0.54, 0.62);
            if (rel > 0 && fade > 0) { // 黒い墨の奔流
                const hs = heroes(a);
                const ts = hs.length ? hs.map((v) => landing(v, -12)) : [{ x: a.W - 40, y: 150 }];
                ctx.save();
                ctx.globalAlpha = fade;
                ctx.lineCap = 'round';
                ts.forEach((t, i) => {
                    const e = ease(win(rel, 0, 0.7)), ex = lerp(f.x, t.x, e), ey = lerp(f.y, t.y, e) - Math.sin(e * Math.PI) * 14;
                    ctx.strokeStyle = '#120a22';
                    ctx.lineWidth = 7 - (i % 2) * 2;
                    ctx.beginPath();
                    ctx.moveTo(f.x, f.y);
                    ctx.quadraticCurveTo(lerp(f.x, ex, 0.5), lerp(f.y, ey, 0.5) - 14, ex, ey);
                    ctx.stroke();
                    ctx.strokeStyle = '#3a1a5a';
                    ctx.lineWidth = 3;
                    ctx.stroke();
                    ctx.fillStyle = '#120a22';
                    ctx.beginPath();
                    ctx.ellipse(t.x, t.y + 10, 4 + 16 * win(rel, 0.5, 1), 2 + 5 * win(rel, 0.5, 1), 0, 0, TAU);
                    ctx.fill(); // 墨だまり
                    for (let j = 0; j < 5; j++) {
                        const u = (rel * 2 + j / 5) % 1;
                        ctx.fillStyle = '#3a1a5a';
                        ctx.fillRect(R(lerp(f.x, t.x, u) + (hash(j, i) - 0.5) * 10), R(lerp(f.y, t.y, u) - Math.sin(u * Math.PI) * 14 + (hash(j, i + 3) - 0.5) * 8), 2, 2);
                    }
                });
                ctx.restore();
                screenFlash(ctx, a.W, a.H, bump(p, 0.41, 0.45), '#3a1a5a', 0.3);
            }
        },
    },
    // 触手の薙ぎ: 巨大な触手が高くふりあがり、横ざまに床ごと薙ぎはらう（吸盤・水しぶき）
    claw: {
        front(a) {
            const { ctx, phase: p } = a;
            const h = spriteToWorld(a.foot, [70, 40]);
            const up = ease(win(p, 0.1, 0.34)) * (1 - win(p, 0.36, 0.4)), sw = win(p, 0.36, 0.5), fade = 1 - win(p, 0.5, 0.6);
            if (up > 0.02)
                tentacleDraw(ctx, tentaclePts(h.x, h.y, -1.15, 70 * up, 0.7, 10), 9, 3);
            if (sw > 0 && fade > 0) {
                ctx.save();
                ctx.globalAlpha = fade;
                const e = ease(sw), ang = lerp(-1.25, 0.28, e), len = lerp(110, 215, Math.sin(e * Math.PI * 0.5));
                const base = { x: h.x, y: h.y };
                tentacleDraw(ctx, tentaclePts(base.x, base.y, ang, len, -0.55, 14), 12, 3.5);
                ctx.restore();
                const tip = { x: base.x + Math.cos(ang) * len, y: base.y + Math.sin(ang) * len * 0.9 };
                puffs(ctx, tip.x, Math.min(200, tip.y + 6), { n: 9, t: sw * 3, dx: 14, dy: -22, spread: 20, r0: 2, r1: 4, color: '#d8f2ff', alpha: 0.8 * fade, seed: 71 });
                screenFlash(ctx, a.W, a.H, bump(p, 0.4, 0.44), '#bfe8ff', 0.18);
            }
        },
    },
    // 突き上げ: 床に波紋が広がり、足もとから触手が一斉に突き上がる（水柱）
    dive: {
        front(a) {
            const { ctx, phase: p } = a;
            const warn = win(p, 0.16, 0.38) * (1 - win(p, 0.42, 0.5));
            for (const v of heroes(a)) {
                const l = landing(v, 4);
                if (warn > 0) {
                    ctx.save();
                    ctx.strokeStyle = '#bfe8ff';
                    ctx.lineWidth = 1.5;
                    for (let i = 0; i < 2; i++) {
                        const u = (p * 4 + i / 2) % 1;
                        ctx.globalAlpha = (1 - u) * warn;
                        ctx.beginPath();
                        ctx.ellipse(l.x, l.y, 4 + u * 16, 1.5 + u * 6, 0, 0, TAU);
                        ctx.stroke();
                    }
                    ctx.restore();
                }
                const k = win(p, 0.38, 0.46), fade = 1 - win(p, 0.5, 0.62);
                if (k > 0 && fade > 0) {
                    const e = ease(k), hgt = 78 * e * (0.8 + 0.4 * hash(v.f));
                    ctx.save();
                    ctx.globalAlpha = fade * (v.ok ? 0.55 : 1);
                    const pts = [];
                    for (let i = 0; i <= 10; i++) {
                        const u = i / 10;
                        pts.push([l.x + Math.sin(u * 4 + v.f) * 6 * u, l.y - hgt * u]);
                    }
                    tentacleDraw(ctx, pts, 11, 3.5);
                    ctx.restore();
                    puffs(ctx, l.x, l.y - 6, { n: 8, t: k, dx: 0, dy: -30, spread: 24, r0: 1.5, r1: 3.5, color: '#d8f2ff', alpha: 0.8 * fade, seed: 73 });
                }
            }
            screenFlash(ctx, a.W, a.H, bump(p, 0.38, 0.43), '#bfe8ff', 0.25);
        },
    },
    // 巻き取り: 触手が床を這って冒険者に巻きつき、引きよせる
    tail: {
        front(a) {
            const { ctx, phase: p } = a;
            const base = { x: a.foot.x + 54, y: a.foot.y - 8 };
            const reach = ease(win(p, 0.16, 0.4)), coil = ease(win(p, 0.38, 0.5)), fade = 1 - win(p, 0.52, 0.62);
            if (reach <= 0 || fade <= 0)
                return;
            ctx.save();
            ctx.globalAlpha = fade;
            for (const v of heroes(a)) {
                const l = landing(v, 6), pts = [];
                for (let i = 0; i <= 14; i++) {
                    const u = i / 14 * reach;
                    pts.push([lerp(base.x, l.x, u), lerp(base.y, l.y, u) + Math.sin(u * 9 + v.f + p * 12) * 5 * (1 - coil * 0.6)]);
                }
                tentacleDraw(ctx, pts, 8, 4);
                if (coil > 0 && !v.ok) { // 足もとから巻きつく
                    ctx.strokeStyle = '#7a2a5a';
                    ctx.lineWidth = 4;
                    for (let j = 0; j < 3; j++) {
                        ctx.beginPath();
                        ctx.ellipse(l.x, l.y - 4 - j * 7 * coil, 8, 3, 0.2, 0, TAU);
                        ctx.stroke();
                    }
                }
            }
            ctx.restore();
            puffs(ctx, base.x + 60, a.foot.y - 2, { n: 8, t: p * 2, dx: 100, dy: -4, spread: 10, r0: 2, r1: 4, color: '#d8f2ff', alpha: 0.5 * fade * coil, seed: 75 });
            screenFlash(ctx, a.W, a.H, bump(p, 0.4, 0.44), '#bfe8ff', 0.15);
        },
    },
};
function tentacleDraw(ctx, pts, w0, w1) { tentacle(ctx, pts, w0, w1, '#8a2a6a', '#3e1230', '#f4c8dc'); }
// ================= 守護巨人ゴルドム =================
const golem = {
    // 石礫の嵐: まわりの小石が浮かびあがり、岩が列ごとに飛んでいく
    breath: {
        back(a) {
            const { ctx, phase: p } = a;
            const k = win(p, 0.1, 0.42) * (1 - win(p, 0.5, 0.62));
            if (k <= 0)
                return;
            ctx.save();
            ctx.globalAlpha = k * 0.3;
            ctx.fillStyle = '#6a5a3a';
            ctx.fillRect(a.foot.x, 120, a.W, 92);
            ctx.restore();
        },
        front(a) {
            const { ctx, phase: p } = a;
            const hnd = spriteToWorld(a.foot, [70, 36]);
            const gather = win(p, 0.06, 0.38);
            if (gather > 0 && p < 0.44) { // 地面の小石が浮かぶ
                for (let i = 0; i < 12; i++) {
                    const x = a.foot.x + 10 + hash(i) * 90, base = a.foot.y - 2;
                    rock(ctx, x, base - gather * (10 + hash(i, 2) * 40) - Math.sin(p * 20 + i) * 2, 1.5 + hash(i, 3) * 2.5, p * 6 + i, i, '#7a6a52', '#a8987a', '#3a2a1a');
                }
                puffs(ctx, a.foot.x + 50, a.foot.y - 2, { n: 8, t: p * 2, dx: 0, dy: -12, spread: 80, r0: 2, r1: 5, color: '#a8987a', alpha: 0.55 * gather, seed: 81 });
            }
            const rel = win(p, 0.36, 0.56), fade = 1 - win(p, 0.56, 0.62);
            if (rel > 0 && fade > 0) { // 岩が山なりに飛ぶ
                const hs = heroes(a), n = Math.max(6, hs.length * 2);
                for (let i = 0; i < n; i++) {
                    const t = clamp01((rel - hash(i, 1) * 0.25) / 0.45);
                    if (t <= 0 || t >= 1)
                        continue;
                    const v = hs.length ? hs[i % hs.length] : null, tx = (v ? landing(v, 0).x : a.W - 50) + (hash(i, 2) - 0.5) * 12, ty = (v ? v.y : 170) - 6;
                    const x = lerp(hnd.x, tx, t), y = lerp(hnd.y, ty, t) - Math.sin(t * Math.PI) * 60;
                    ctx.globalAlpha = fade;
                    rock(ctx, x, y, 4 + 4 * hash(i, 4), a.frame / 3 + i, i, '#8a7a62', '#b8a888', '#3a2a1a');
                    ctx.globalAlpha = 1;
                }
                screenFlash(ctx, a.W, a.H, bump(p, 0.44, 0.48), '#d8ccb0', 0.18);
            }
        },
    },
    // 拳の叩きつけ: 巨大な石の拳が真上から落ちる（影・砂ぼこり・ひび）
    claw: {
        front(a) {
            const { ctx, phase: p } = a;
            for (const v of heroes(a)) {
                const l = landing(v, 2), k = win(p, 0.34, 0.44), fade = 1 - win(p, 0.52, 0.64);
                if (k <= 0 || fade <= 0)
                    continue;
                const e = ease(k), y = lerp(l.y - 100, l.y - 14, e);
                ctx.save();
                ctx.globalAlpha = fade * (v.ok ? 0.6 : 1);
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.beginPath();
                ctx.ellipse(l.x, l.y, 4 + 14 * e, 2 + 4 * e, 0, 0, TAU);
                ctx.fill(); // 落ちる影
                // 石の拳（ブロック＋指のすじ）
                ctx.fillStyle = '#7a6a52';
                ctx.fillRect(R(l.x - 13), R(y - 12), 26, 22);
                ctx.fillStyle = '#a8987a';
                ctx.fillRect(R(l.x - 13), R(y - 12), 26, 4);
                ctx.fillRect(R(l.x - 13), R(y - 12), 4, 22);
                ctx.fillStyle = '#4a3a2a';
                ctx.fillRect(R(l.x - 13), R(y + 6), 26, 4);
                for (let i = 1; i < 4; i++)
                    ctx.fillRect(R(l.x - 13 + i * 6.5), R(y - 4), 1, 12);
                ctx.strokeStyle = '#2a1e12';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(R(l.x - 13), R(y - 12), 26, 22);
                ctx.restore();
                const b = win(p, 0.44, 0.6);
                if (b > 0 && b < 1) {
                    dustRing(ctx, l.x, l.y, b, 50);
                    for (let c = 0; c < 3; c++)
                        crack(ctx, l.x, l.y, 26, -0.6 + c * 0.6, c + v.f, ease(win(b, 0, 0.5)), '#1a1008', '#30d0c0', 1.5);
                }
            }
            screenFlash(ctx, a.W, a.H, bump(p, 0.43, 0.47), '#d8ccb0', 0.3);
        },
    },
    // 地割れ: 足もとから光る割れ目が走り、岩のかけらが噴きあがる
    dive: {
        front(a) {
            const { ctx, phase: p } = a;
            const run = ease(win(p, 0.24, 0.44)), fade = 1 - win(p, 0.52, 0.64);
            if (run > 0 && fade > 0) {
                ctx.save();
                ctx.globalAlpha = fade;
                for (let i = 0; i < 4; i++)
                    crack(ctx, a.foot.x + 44, a.foot.y - 4 - i * 3, (a.W - a.foot.x) * 0.95, 0.05 * (i - 1.5), 7 + i * 3, run, '#140c06', '#30d0c0', 2.4 - i * 0.3);
                ctx.restore();
                puffs(ctx, a.foot.x + 44 + run * (a.W - a.foot.x) * 0.8, a.foot.y - 6, { n: 8, t: p * 3, dx: -30, dy: -16, spread: 12, r0: 2, r1: 5, color: '#c8b48a', alpha: 0.7 * fade, seed: 83 });
            }
            const b = win(p, 0.42, 0.58);
            if (b > 0 && b < 1) {
                for (const v of heroes(a)) { // 割れ目から岩が噴きあがる
                    for (let i = 0; i < 5; i++) {
                        const sp = 24 + hash(i, v.f) * 46, ang = -Math.PI / 2 + (hash(i, v.f + 3) - 0.5) * 1.2;
                        ctx.globalAlpha = (1 - b) * (v.ok ? 0.5 : 1);
                        rock(ctx, v.x + Math.cos(ang) * sp * b, v.y - 4 + Math.sin(ang) * sp * b + 80 * b * b, 2 + hash(i, 5) * 3, i + b * 8, i, '#7a6a52', '#a8987a', '#3a2a1a');
                        ctx.globalAlpha = 1;
                    }
                }
                screenFlash(ctx, a.W, a.H, bump(p, 0.42, 0.46), '#c0fff0', 0.3);
            }
        },
    },
    // 腕の薙ぎ払い: 石の腕が大きな弧をえがいて床を払う（岩のかけら・砂ぼこり）
    tail: {
        front(a) {
            const { ctx, phase: p } = a;
            const sw = win(p, 0.36, 0.5), fade = 1 - win(p, 0.52, 0.62);
            if (sw <= 0 || fade <= 0)
                return;
            const pivot = spriteToWorld(a.foot, [58, 44]);
            ctx.save();
            ctx.globalAlpha = fade;
            crescent(ctx, pivot.x, pivot.y + 4, 104, 150, -2.0, 0.25, ease(sw), '#a8987a', '#3a2a1a', 0.55);
            crescent(ctx, pivot.x, pivot.y + 4, 88, 122, -1.9, 0.15, ease(sw), '#7a6a52', '#4a3a2a', 0.55);
            ctx.restore();
            const tx = pivot.x + Math.cos(lerp(-2.0, 0.25, ease(sw))) * 150, ty = pivot.y + 4 + Math.sin(lerp(-2.0, 0.25, ease(sw))) * 150 * 0.55;
            for (let i = 0; i < 6; i++) {
                ctx.globalAlpha = fade;
                rock(ctx, tx + hash(i) * 14 - 7, ty + hash(i, 2) * 10 + sw * 8, 2 + hash(i, 3) * 3, i + sw * 6, i, '#8a7a62', '#b8a888', '#3a2a1a');
                ctx.globalAlpha = 1;
            }
            puffs(ctx, tx, Math.min(204, ty + 4), { n: 8, t: sw * 3, dx: -30, dy: -8, spread: 12, r0: 2, r1: 6, color: '#c8b48a', alpha: 0.7 * fade, seed: 85 });
            screenFlash(ctx, a.W, a.H, bump(p, 0.41, 0.45), '#d8ccb0', 0.2);
        },
    },
};
// ================= 氷巨人グラシエル =================
const giant = {
    // 凍てつく息: 冷気が口に集まり、氷の結晶ごと白い息が吹きつける（地面に霜）
    breath: {
        back(a) {
            const { ctx, phase: p } = a;
            const k = win(p, 0.1, 0.42) * (1 - win(p, 0.5, 0.62));
            if (k <= 0)
                return;
            ctx.save();
            const g = ctx.createLinearGradient(a.foot.x, 0, a.W, 0);
            g.addColorStop(0, 'rgba(160,210,255,0.5)');
            g.addColorStop(1, 'rgba(160,210,255,0.06)');
            ctx.globalAlpha = k * (0.7 + 0.3 * Math.sin(a.frame / 2));
            ctx.fillStyle = g;
            ctx.fillRect(a.foot.x, 86, a.W, 130);
            ctx.restore();
        },
        front(a) {
            const { ctx, phase: p } = a;
            const m = spriteToWorld(a.foot, STYLE.giant.mouth);
            const gather = win(p, 0.06, 0.4);
            if (gather > 0 && p < 0.44) { // 雪の結晶が口に吸い込まれる
                for (let i = 0; i < 18; i++) {
                    const ang = hash(i) * TAU, d0 = 24 + hash(i, 2) * 50, u = (gather * (0.7 + hash(i, 3)) + hash(i, 4)) % 1, d = d0 * (1 - u);
                    ctx.globalAlpha = u;
                    sparkle(ctx, m.x + Math.cos(ang) * d, m.y + Math.sin(ang) * d * 0.7, 1.5 + (i % 2), '#ffffff', u);
                }
                ctx.globalAlpha = 1;
                glowAt(ctx, m.x, m.y, 4 + gather * 9, '#ffffff', '#9fd8ff', 0.7 * gather);
            }
            const rel = win(p, 0.38, 0.5), fade = 1 - win(p, 0.54, 0.62);
            if (rel > 0 && fade > 0) { // 白い息の扇と、氷のかけら
                const reach = lerp(m.x, a.W + 40, ease(rel));
                ctx.save();
                ctx.globalAlpha = fade * 0.75;
                const layers = [['#7ac0e8', 1], ['#bfe8ff', 0.72], ['#ffffff', 0.4]];
                for (const [col, wk] of layers) {
                    ctx.fillStyle = col;
                    ctx.beginPath();
                    ctx.moveTo(m.x, m.y - 2 * wk);
                    for (let i = 1; i <= 12; i++) {
                        const x = lerp(m.x, reach, i / 12), sp = (i / 12) * 62 * wk;
                        ctx.lineTo(x, m.y + 36 * (i / 12) - sp + Math.sin(a.frame / 1.5 + i) * 2);
                    }
                    for (let i = 12; i >= 1; i--) {
                        const x = lerp(m.x, reach, i / 12), sp = (i / 12) * 62 * wk;
                        ctx.lineTo(x, m.y + 36 * (i / 12) + sp + Math.cos(a.frame / 1.7 + i) * 2);
                    }
                    ctx.closePath();
                    ctx.fill();
                }
                ctx.restore();
                ctx.globalAlpha = fade;
                for (let i = 0; i < 14; i++) {
                    const t = (hash(i) + p * 3) % 1, x = lerp(m.x, reach, t), y = m.y + 36 * t + (hash(i, 2) - 0.5) * 100 * t;
                    shard(ctx, x, y, 5 + 5 * hash(i, 3), 3, 0.3 + (hash(i, 5) - 0.5), '#e6f6ff', '#ffffff', '#6aaee0');
                }
                ctx.globalAlpha = 1;
                for (const v of heroes(a)) {
                    if (v.ok)
                        continue;
                    for (let i = 0; i < 4; i++) {
                        ctx.globalAlpha = fade;
                        shard(ctx, v.x - 8 + i * 5, v.y + 2, 8 + 5 * hash(i, v.f) * win(rel, 0.4, 1), 3, -Math.PI / 2 + (hash(i, 9) - 0.5) * 0.6);
                        ctx.globalAlpha = 1;
                    }
                }
                screenFlash(ctx, a.W, a.H, bump(p, 0.41, 0.45), '#bfe8ff', 0.3);
            }
        },
    },
    // 氷柱の投げ槍: 氷の槍を振りかぶって投げる（槍が列ごとに飛んで、砕けて散る）
    claw: {
        front(a) {
            const { ctx, phase: p } = a;
            const h = spriteToWorld(a.foot, STYLE.giant.hand);
            const hs = heroes(a);
            const hold = ease(win(p, 0.12, 0.34)) * (1 - win(p, 0.38, 0.42));
            if (hold > 0) {
                iceSpear(ctx, h.x - 6, h.y - 10 - 4 * hold, -0.5 - 0.5 * hold, 36);
                sparkle(ctx, h.x + 8, h.y - 22, 2 + 3 * hold, '#ffffff', hold);
            }
            const fly = win(p, 0.38, 0.47), fade = 1 - win(p, 0.5, 0.6);
            if (fly > 0 && fade > 0) {
                const ts = hs.length ? hs.map((v) => landing(v, -12)) : [{ x: a.W - 50, y: 150 }];
                ts.forEach((t, i) => {
                    const e = clamp01(fly * 1.2 - i * 0.05);
                    if (e <= 0)
                        return;
                    const x = lerp(h.x, t.x, e), y = lerp(h.y - 8, t.y, e) - Math.sin(e * Math.PI) * 6, ang = Math.atan2(t.y - (h.y - 8), t.x - h.x);
                    ctx.globalAlpha = fade;
                    iceSpear(ctx, x, y, ang, 36);
                    ctx.fillStyle = '#ffffff';
                    for (let j = 1; j <= 3; j++)
                        ctx.fillRect(R(x - 36 - j * 7), R(y - 1 + (hash(j, i) - 0.5) * 4), 3, 1);
                    ctx.globalAlpha = 1;
                    if (e >= 1)
                        for (let k = 0; k < 6; k++) {
                            const aa = hash(k, i) * TAU, sp = 14 * win(p, 0.46, 0.58);
                            ctx.globalAlpha = fade;
                            shard(ctx, t.x + Math.cos(aa) * sp, t.y + Math.sin(aa) * sp, 6, 3, aa);
                            ctx.globalAlpha = 1;
                        }
                });
                screenFlash(ctx, a.W, a.H, bump(p, 0.44, 0.48), '#e6f6ff', 0.28);
            }
        },
    },
    // 踏みつけ: 片足を上げて踏みおろし、氷の衝撃波と氷の柱が床を走る（氷のとげが突き出す）
    dive: {
        front(a) {
            const { ctx, phase: p } = a;
            const b = win(p, 0.4, 0.6);
            if (b > 0 && b < 1) {
                ctx.save();
                ctx.strokeStyle = '#bfe8ff';
                ctx.lineWidth = 4 * (1 - b);
                ctx.globalAlpha = 1 - b;
                ctx.beginPath();
                ctx.ellipse(a.foot.x + 10, a.foot.y + 4, 16 + b * 300, 5 + b * 70, 0, -Math.PI / 2, Math.PI / 2);
                ctx.stroke();
                ctx.restore();
                for (let i = 0; i < 9; i++) { // 氷のとげが、衝撃波のあとを追って床から突き出す
                    const x = a.foot.x + 40 + i * ((a.W - a.foot.x - 40) / 8), t = clamp01((b - i * 0.06) / 0.4);
                    if (t <= 0)
                        continue;
                    ctx.globalAlpha = 1 - win(b, 0.6, 1);
                    shard(ctx, x, 190 + (i % 3) * 5, (14 + 12 * hash(i)) * ease(t), 6, -Math.PI / 2);
                    ctx.globalAlpha = 1;
                }
                screenFlash(ctx, a.W, a.H, bump(p, 0.4, 0.45), '#e6f6ff', 0.4);
            }
            puffs(ctx, a.foot.x + 10, a.foot.y - 2, { n: 8, t: p * 2, dx: 20, dy: -8, spread: 30, r0: 2, r1: 6, color: '#e6f6ff', alpha: 0.6 * bump(p, 0.38, 0.6), seed: 91 });
        },
    },
    // 棍棒の薙ぎ払い: 巨大な氷の棍棒が大きな弧を描いて床を払う（冷気の尾・氷の粒）
    tail: {
        front(a) {
            const { ctx, phase: p } = a;
            const sw = win(p, 0.36, 0.5), fade = 1 - win(p, 0.52, 0.62);
            if (sw <= 0 || fade <= 0)
                return;
            const pivot = spriteToWorld(a.foot, [60, 42]);
            ctx.save();
            ctx.globalAlpha = fade;
            crescent(ctx, pivot.x, pivot.y + 6, 120, 172, -2.3, 0.2, ease(sw), 'rgba(190,232,255,0.85)', '#ffffff', 0.5);
            crescent(ctx, pivot.x, pivot.y + 6, 98, 138, -2.2, 0.1, ease(sw), 'rgba(120,180,230,0.9)', '#6aaee0', 0.5);
            ctx.restore();
            const ang = lerp(-2.3, 0.2, ease(sw)), tx = pivot.x + Math.cos(ang) * 170, ty = pivot.y + 6 + Math.sin(ang) * 170 * 0.5;
            for (let i = 0; i < 9; i++) {
                ctx.globalAlpha = fade;
                sparkle(ctx, tx - 30 * hash(i) + (hash(i, 2) - 0.5) * 20, ty + (hash(i, 3) - 0.5) * 24, 1.5 + hash(i, 4) * 2, '#ffffff', 1);
                ctx.globalAlpha = 1;
            }
            puffs(ctx, tx, Math.min(204, ty + 6), { n: 8, t: sw * 3, dx: -40, dy: -6, spread: 12, r0: 2, r1: 6, color: '#e6f6ff', alpha: 0.7 * fade, seed: 93 });
            screenFlash(ctx, a.W, a.H, bump(p, 0.41, 0.45), '#e6f6ff', 0.25);
        },
    },
};
export const BOSS_FX = { vampire, spider, goblin, kraken, golem, giant };
/** 竜以外のボスの、ひとり分の飛び道具。描いたら true（共通の竜の炎・爪・隕石は描かない） */
export function attackHitFx(kind, atk, o) {
    if (kind === 'dragon')
        return false;
    const { ctx, phase: p, x, y, stopX, blocked, mouth, hand } = o;
    const ty = y - 12;
    if (atk === 'breath') {
        const k = clamp01((p - 0.34) / 0.12);
        if (k <= 0 || k >= 1)
            return true;
        const fx = (t) => lerp(mouth.x, stopX, t), fy = (t) => lerp(mouth.y, ty, t);
        if (kind === 'vampire') {
            for (let i = 0; i < 5; i++) {
                const t = clamp01(k * 1.3 - i * 0.07);
                if (t > 0)
                    bat(ctx, fx(t) + (hash(i) - 0.5) * 8, fy(t) + (hash(i, 2) - 0.5) * 12 + Math.sin(t * 9 + i) * 4, (o.frame + i) % 2, '#1a0a24', 1.6);
            }
        }
        else if (kind === 'spider') {
            ctx.save();
            ctx.strokeStyle = '#f4f6ff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(mouth.x, mouth.y);
            ctx.lineTo(fx(k), fy(k));
            ctx.stroke();
            if (!blocked)
                webNet(ctx, stopX, ty, 18, win(k, 0.7, 1));
            ctx.restore();
        } // 正しく動けた人の前では、糸は斬られて巣にならない
        else if (kind === 'goblin') {
            const t = k, sx = stopX + 20, sy = -10;
            arrow(ctx, lerp(sx, stopX, t), lerp(sy, ty, t), 2.0, 14);
        }
        else if (kind === 'kraken') {
            ctx.save();
            ctx.strokeStyle = '#120a22';
            ctx.lineWidth = 5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(mouth.x, mouth.y);
            ctx.lineTo(fx(k), fy(k) - Math.sin(k * Math.PI) * 10);
            ctx.stroke();
            ctx.fillStyle = '#3a1a5a';
            ctx.beginPath();
            ctx.ellipse(stopX, y + 4, 3 + 9 * win(k, 0.7, 1), 1 + 3 * win(k, 0.7, 1), 0, 0, TAU);
            ctx.fill();
            ctx.restore();
        }
        else if (kind === 'golem') {
            rock(ctx, fx(k), fy(k) - Math.sin(k * Math.PI) * 30, 5, o.frame / 3, 2, '#8a7a62', '#b8a888', '#3a2a1a');
        }
        else if (kind === 'giant') {
            for (let i = 0; i < 4; i++) {
                const t = clamp01(k * 1.3 - i * 0.06);
                if (t > 0)
                    shard(ctx, fx(t), fy(t) + (hash(i) - 0.5) * 10, 8, 3, 0.3, '#e6f6ff', '#ffffff', '#6aaee0');
            }
        }
        return true;
    }
    if (atk === 'claw') {
        const k = clamp01((p - 0.4) / 0.06);
        if (k <= 0 || k >= 1)
            return true;
        ctx.save();
        ctx.globalAlpha = 1 - k * 0.5;
        if (kind === 'vampire') {
            ctx.lineCap = 'round';
            for (let i = 0; i < 5; i++) {
                ctx.strokeStyle = i === 2 ? '#ffffff' : '#ff6b8a';
                ctx.lineWidth = 1.3;
                const ox = stopX - 12 + i * 3.5, oy = y - 30;
                ctx.beginPath();
                ctx.moveTo(ox, oy);
                ctx.lineTo(ox + 12 * k, oy + 28 * k);
                ctx.stroke();
            }
        }
        else if (kind === 'spider') {
            ctx.fillStyle = '#7bed9f';
            ctx.fillRect(R(stopX - 4), R(y - 16), 2, 3);
            ctx.fillRect(R(stopX + 3), R(y - 16), 2, 3);
            fangShape(ctx, stopX - 3, y - 30 + 12 * k, 12, 5, Math.PI / 2 + 0.1);
            fangShape(ctx, stopX + 4, y - 30 + 12 * k, 12, 5, Math.PI / 2 - 0.1);
        }
        else if (kind === 'goblin') {
            ctx.fillStyle = '#1a1008';
            ctx.beginPath();
            ctx.ellipse(stopX, y + 2, 3 + 12 * k, 1 + 4 * k, 0, 0, TAU);
            ctx.fill();
        }
        else if (kind === 'kraken') {
            ctx.strokeStyle = '#8a2a6a';
            ctx.lineWidth = 6 * (1 - k * 0.4);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(stopX - 4, y - 14, 18, -1.6 + k * 1.2, -0.4 + k * 1.2);
            ctx.stroke();
        }
        else if (kind === 'golem') {
            ctx.strokeStyle = '#c8b48a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(stopX, y + 2, 4 + 18 * k, 1.5 + 5 * k, 0, 0, TAU);
            ctx.stroke();
        }
        else if (kind === 'giant') {
            iceSpear(ctx, lerp(hand.x, stopX, k), lerp(hand.y, ty, k), Math.atan2(ty - hand.y, stopX - hand.x), 24);
        }
        ctx.restore();
        return true;
    }
    if (atk === 'meteor') {
        const k = clamp01((p - 0.3) / 0.12), by = blocked ? y - 30 : y - 6;
        if (k > 0 && k < 1) {
            const cx = lerp(x + 30, stopX + 4, k), cy = lerp(-20, by, k);
            if (kind === 'vampire') {
                for (let i = 0; i < 5; i++)
                    bat(ctx, cx + (hash(i) - 0.5) * 14, cy - i * 5 + (hash(i, 2) - 0.5) * 8, (o.frame + i) % 2, '#1a0a24', 1.6);
            }
            else if (kind === 'spider') {
                ctx.strokeStyle = '#f4f6ff';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(stopX + 4, -10);
                ctx.lineTo(stopX + 4, cy);
                ctx.stroke();
                ctx.fillStyle = '#e4e7f0';
                ctx.beginPath();
                ctx.ellipse(stopX + 4, cy, 6, 7, 0, 0, TAU);
                ctx.fill();
            }
            else if (kind === 'goblin' || kind === 'golem')
                rock(ctx, cx, cy, kind === 'golem' ? 8 : 6, o.frame / 3, 4, '#7a6a52', '#a8987a', '#3a2a1a');
            else if (kind === 'kraken') {
                ctx.fillStyle = '#bfe8ff';
                ctx.fillRect(R(stopX - 4), R(by - 44 * k), 8, R(44 * k));
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(R(stopX - 1), R(by - 44 * k), 2, R(44 * k));
            }
            else if (kind === 'giant')
                shard(ctx, cx, cy, 16, 6, Math.PI / 2 + 0.3, '#e6f6ff', '#ffffff', '#6aaee0');
        }
        const kb = clamp01((p - 0.42) / 0.06);
        if (kb > 0 && kb < 1) {
            const col = { vampire: '#c070ff', spider: '#e4e7f0', goblin: '#c8b48a', kraken: '#bfe8ff', golem: '#c8b48a', giant: '#e6f6ff' }[kind];
            dustRing(ctx, stopX, blocked ? y - 30 : y - 4, kb, 34, col);
        }
        return true;
    }
    return false;
}
/** 尾の攻撃のとき床をはしる帯（竜は砂ぼこり）。竜以外は、ボスごとの色で */
export function tailBandColors(kind) {
    switch (kind) {
        case 'vampire': return ['#6a3a8a', '#3a1a52'];
        case 'spider': return ['#9a8aa8', '#5a4a60'];
        case 'goblin': return ['#c8b48a', '#8a7450'];
        case 'kraken': return ['#bfe8ff', '#5fb3e6'];
        case 'golem': return ['#c8b48a', '#8a7a52'];
        case 'giant': return ['#e6f6ff', '#9fd8ff'];
        default: return null;
    }
}
export function bossFxFor(kind, scene) {
    if (!kind || !scene)
        return null;
    const k = BOSS_FX[kind];
    return k?.[scene] ?? null;
}
//# sourceMappingURL=bossfx.js.map