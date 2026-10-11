// 正しく動けた冒険者の「対応技」の演出（ブレス・爪・急降下・尾の場面）。どの技を使うかは、ボス（シーズン）ごと（bossmoves.ts の COUNTERS）。
// 体の動き（跳ぶ・伏せる・受ける）は arena-fighter.ts、ここでは技の光・かけら・残光を描く。
// 時間: 0.36〜0.42 構える / 0.42 ボスの技が届く / 0.42〜0.58 受け流す・かわす
import { Rng } from '../shared/rng.js';
import { counterFor } from './bossmoves.js';
import { arrow, bat, bump, dustRing, ease, glowAt, hash, puffs, R, rock, shard, sparkle, TAU, win } from './fxkit.js';
import { partyLabel } from './scenes.js';
const oks = (a) => a.fighters.filter((v) => v.alive && v.ok);
/** 対応技の演出。基本の4場面でなければ何もしない */
export function counterFx(a) {
    const co = counterFor(a.theme?.kind, a.scene);
    if (!co)
        return;
    const { ctx, phase: p } = a;
    for (const v of oks(a))
        DRAW[co.fx](ctx, v, p, a, co);
    const [l0, l1] = co.fx === 'mirror' ? [0.42, 0.58] : co.fx === 'trail' ? [0.42, 0.6] : [0.44, 0.6];
    partyLabel(a, co.color, bump(p, l0, l1)); // 正しく動けた自分の答え（ほかの人は「かわした」）
}
const DRAW = {
    // 鏡で受ける: 正しく動けたキャラの前に青い鏡。炎が上下に割れる（竜）
    mirror(ctx, v, p, a) {
        const k = win(p, 0.38, 0.44), fade = 1 - win(p, 0.52, 0.6);
        if (k <= 0 || fade <= 0)
            return;
        const mk = win(p, 0.36, 0.42) * fade;
        const mx = v.x - 14, my = v.y - 14;
        ctx.save();
        ctx.globalAlpha = mk;
        ctx.fillStyle = 'rgba(40,120,220,0.5)';
        ctx.beginPath();
        ctx.ellipse(mx, my, 5, 17, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#bfe8ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(mx, my, 5, 17, 0, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(R(mx - 1), R(my - 12 + ((a.frame * 2) % 22)), 2, 3);
        // 割れた炎が後ろへ流れる
        for (let i = 0; i < 6; i++) {
            const t = ((p * 6 + i / 6) % 1);
            ctx.fillStyle = i % 2 ? '#8fd3ff' : '#ffffff';
            ctx.fillRect(R(mx + 2 + t * 18), R(my - 18 - t * 10 + i), 2, 2);
            ctx.fillRect(R(mx + 2 + t * 18), R(my + 18 + t * 8 - i), 2, 2);
        }
        ctx.restore();
    },
    // すり抜け: 横へすり抜けたあとに、紫の影が残る
    shadow(ctx, v, p) {
        const u = bump(p, 0.38, 0.56);
        if (u <= 0)
            return;
        ctx.save();
        for (let i = 1; i <= 3; i++) {
            ctx.globalAlpha = u * 0.35 / i;
            ctx.fillStyle = '#6a3a9a';
            ctx.beginPath();
            ctx.ellipse(v.x - i * 7, v.y - 10, 5, 10, 0, 0, TAU);
            ctx.fill();
        }
        ctx.restore();
    },
    // 伏せる: 伏せた足もとに土ぼこり
    dust(ctx, v, p) {
        const u = bump(p, 0.4, 0.58);
        if (u <= 0)
            return;
        ctx.save();
        ctx.globalAlpha = u * 0.7;
        ctx.fillStyle = '#c8b48a';
        for (let i = -2; i <= 2; i++)
            ctx.fillRect(R(v.x + i * 5 - 1), R(v.y - 2 - Math.abs(i)), 3, 2);
        ctx.restore();
    },
    // 跳んでかわす: 跳躍の軌跡に、鳥の形の白い残光
    trail(ctx, v, p) {
        const u = win(p, 0.4, 0.56);
        if (u <= 0 || u >= 1)
            return;
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 1 - u;
        const bx = v.x - 4, by = v.y - 30 - Math.sin(u * Math.PI) * 14;
        ctx.beginPath();
        ctx.moveTo(bx - 10, by - 6);
        ctx.quadraticCurveTo(bx - 3, by - 1, bx, by + 2);
        ctx.quadraticCurveTo(bx + 3, by - 1, bx + 10, by - 6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bx, by + 2);
        ctx.lineTo(bx - 3, by + 8);
        ctx.moveTo(bx, by + 2);
        ctx.lineTo(bx + 3, by + 8);
        ctx.stroke();
        ctx.restore();
    },
    // 聖なる光: かざした手の先に金の十字と光の輪。蝙蝠は光をきらって散っていく（伯爵のブレス）
    holy(ctx, v, p, a) {
        const k = win(p, 0.34, 0.4) * (1 - win(p, 0.54, 0.62));
        if (k <= 0)
            return;
        const x = v.x - 15, y = v.y - 16;
        glowAt(ctx, x, y, 12 + 8 * k, '#ffffff', '#ffe9a0', 0.8 * k);
        ctx.save();
        ctx.globalAlpha = k;
        ctx.strokeStyle = '#fff2b0';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 9 + 2 * Math.sin(a.frame / 3), 0, TAU);
        ctx.stroke();
        ctx.fillStyle = '#d8b84a';
        ctx.fillRect(R(x - 1.5), R(y - 8), 4, 16);
        ctx.fillRect(R(x - 6), R(y - 3.5), 13, 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(R(x - 0.5), R(y - 7), 2, 14);
        ctx.fillRect(R(x - 5), R(y - 2.5), 11, 2);
        for (let i = 0; i < 8; i++) {
            const t = (i / 8) * TAU + p * 3;
            ctx.globalAlpha = k * 0.6;
            ctx.fillRect(R(x + Math.cos(t) * 14), R(y + Math.sin(t) * 14), 1, 1);
        }
        ctx.restore();
        const s = win(p, 0.42, 0.6); // 散る蝙蝠
        if (s > 0 && s < 1)
            for (let i = 0; i < 4; i++) {
                ctx.save();
                ctx.globalAlpha = 1 - s;
                bat(ctx, x - 6 - s * (20 + 14 * hash(i)), y + (hash(i, 2) - 0.5) * 24 - s * (18 + 20 * hash(i, 3)), (a.frame + i) % 2, '#1a0a24', 1.4);
                ctx.restore();
            }
    },
    // はじく: 刃と刃が当たる白い火花と、はじかれた先が回って飛んでいく
    parry(ctx, v, p, _a, co) {
        const u = win(p, 0.41, 0.52);
        if (u <= 0 || u >= 1)
            return;
        const x = v.x - 14, y = v.y - 18;
        glowAt(ctx, x, y, 10 * (1 - u) + 3, '#ffffff', co.color, 1 - u);
        ctx.save();
        ctx.globalAlpha = 1 - u;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(R(x - 8 * (1 - u)), R(y - 8 * (1 - u)));
        ctx.lineTo(R(x + 8 * (1 - u)), R(y + 8 * (1 - u)));
        ctx.moveTo(R(x + 8 * (1 - u)), R(y - 8 * (1 - u)));
        ctx.lineTo(R(x - 8 * (1 - u)), R(y + 8 * (1 - u)));
        ctx.stroke();
        ctx.fillStyle = co.color;
        for (let i = 0; i < 7; i++) {
            const t = -2.4 + (i / 6) * 1.6, d = 4 + u * (16 + 10 * hash(i));
            ctx.fillRect(R(x + Math.cos(t) * d), R(y + Math.sin(t) * d + u * u * 12), 2, 2);
        }
        // はじかれた爪先・穂先がくるくる回って飛ぶ
        ctx.translate(x - 10 - u * 26, y - 10 - Math.sin(u * Math.PI) * 18);
        ctx.rotate(u * 9);
        ctx.fillStyle = co.color;
        ctx.fillRect(-4, -1, 8, 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(2, -1, 2, 1);
        ctx.restore();
    },
    // 飛びのく: 後ろへ跳んだ跡に、風の線と、着地の土ぼこり
    roll(ctx, v, p, _a, co) {
        const u = win(p, 0.36, 0.56);
        if (u <= 0 || u >= 1)
            return;
        ctx.save();
        ctx.strokeStyle = co.color;
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
            ctx.globalAlpha = (1 - u) * 0.8;
            const y = v.y - 6 - i * 6 - Math.sin(u * Math.PI) * 10;
            ctx.beginPath();
            ctx.moveTo(R(v.x - 6 - i * 3), R(y));
            ctx.lineTo(R(v.x - 18 - i * 3 - 8 * (1 - u)), R(y));
            ctx.stroke();
        }
        ctx.restore();
        dustRing(ctx, v.x + 4, v.y, win(p, 0.36, 0.46), 14, co.color);
        dustRing(ctx, v.x + 12, v.y, win(p, 0.5, 0.62), 16, co.color);
    },
    // 振り向いて受ける: 背後（右）から来る一撃を、振り向いて受け止める。右側に紅い火花（伯爵）
    backGuard(ctx, v, p, _a, co) {
        const u = win(p, 0.4, 0.54);
        if (u <= 0 || u >= 1)
            return;
        const x = v.x + 12, y = v.y - 16;
        glowAt(ctx, x, y, 12 * (1 - u) + 4, '#ffffff', '#ff6b8a', 1 - u);
        ctx.save();
        ctx.globalAlpha = 1 - u;
        ctx.strokeStyle = co.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x - 6, y, 12, -0.9, 0.9);
        ctx.stroke(); // 受けた刃の弧
        ctx.fillStyle = '#ffd0e0';
        for (let i = 0; i < 8; i++) {
            const t = -0.9 + (i / 7) * 1.8, d = 6 + u * (14 + 8 * hash(i, 4));
            ctx.fillRect(R(x + Math.cos(t) * d), R(y + Math.sin(t) * d + u * u * 8), 2, 2);
        }
        ctx.restore();
    },
    // 斬りはらう: 斜めの一閃で、迫ってきたもの（糸・触手）がふたつに切れて落ちる
    cut(ctx, v, p, a, co) {
        const u = win(p, 0.4, 0.58);
        if (u <= 0 || u >= 1)
            return;
        const x = v.x - 16, y = v.y - 16, spider = a.theme?.kind === 'spider';
        ctx.save();
        ctx.globalAlpha = 1 - win(u, 0, 0.4);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(R(x - 10), R(y - 14));
        ctx.lineTo(R(x + 10), R(y + 14));
        ctx.stroke(); // 一閃
        ctx.globalAlpha = 1 - u;
        const fall = ease(u) * 18, apart = ease(u) * 6;
        if (spider) { // 切れた糸がふわりと垂れる
            ctx.strokeStyle = co.color;
            ctx.lineWidth = 1;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.moveTo(R(x - 4 - apart), R(y - 6 + i * 5));
                ctx.quadraticCurveTo(R(x - 14 - apart), R(y + i * 5 + fall * 0.5), R(x - 20 - apart), R(y + 4 + i * 5 + fall));
                ctx.stroke();
            }
        }
        else { // 切れた触手の先が落ちる
            ctx.fillStyle = '#8a2a6a';
            ctx.fillRect(R(x - 10 - apart), R(y - 2 + fall), 8, 5);
            ctx.fillStyle = '#f4c8dc';
            ctx.fillRect(R(x - 8 - apart), R(y + 3 + fall), 2, 1);
            ctx.fillRect(R(x - 4 - apart), R(y + 3 + fall), 2, 1);
        }
        ctx.restore();
    },
    // 跳び越える: 跳んだ弧に光の粒の軌跡、着地にきらめき
    leap(ctx, v, p, _a, co) {
        const u = win(p, 0.38, 0.58);
        if (u <= 0 || u >= 1)
            return;
        ctx.save();
        for (let i = 0; i < 10; i++) {
            const t = u - i * 0.04;
            if (t <= 0)
                continue;
            const x = v.x + Math.sin(t * Math.PI) * 4 - 2, y = v.y - 14 - Math.sin(t * Math.PI) * 34;
            ctx.globalAlpha = (1 - i / 10) * (1 - u) * 0.9;
            ctx.fillStyle = i % 2 ? '#ffffff' : co.color;
            ctx.fillRect(R(x - 1), R(y - 1), 2, 2);
        }
        ctx.restore();
        if (u > 0.85)
            sparkle(ctx, v.x, v.y - 2, 4, co.color, (1 - u) / 0.15);
    },
    // 盾をかかげる: 頭の上に盾をかかげ、降ってくる矢がつぎつぎ刺さる（頭目のブレス）
    shieldWall(ctx, v, p) {
        const k = win(p, 0.34, 0.4) * (1 - win(p, 0.56, 0.64));
        if (k <= 0)
            return;
        const x = v.x - 4, y = v.y - 34 + (1 - k) * 8;
        ctx.save();
        ctx.globalAlpha = k;
        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(R(x - 10), R(y - 2), 20, 5);
        ctx.fillStyle = '#8a5a2a';
        ctx.fillRect(R(x - 9), R(y - 2), 18, 3);
        ctx.fillStyle = '#c8c8d0';
        ctx.fillRect(R(x - 10), R(y - 3), 20, 1);
        ctx.fillRect(R(x - 1), R(y - 2), 2, 5);
        ctx.restore();
        const n = Math.floor(win(p, 0.4, 0.5) * 4); // 刺さった矢
        for (let i = 0; i < n; i++) {
            ctx.save();
            ctx.globalAlpha = k;
            arrow(ctx, x - 7 + i * 5, y - 2, 1.9 + (hash(i) - 0.5) * 0.4, 8);
            ctx.restore();
        }
        if (p > 0.4 && p < 0.5)
            sparkle(ctx, x - 7 + (n % 4) * 5, y - 3, 3, '#ffffff', 1 - win(p, 0.4, 0.5));
    },
    // 風で吹きはらう: 緑の風が渦を巻き、迫る墨を吹きはらう（海の主のブレス）
    gust(ctx, v, p, a) {
        const k = win(p, 0.34, 0.4) * (1 - win(p, 0.56, 0.64));
        if (k <= 0)
            return;
        const x = v.x - 4, y = v.y - 14;
        ctx.save();
        ctx.strokeStyle = '#7bed9f';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
            const r = 10 + i * 4, s = p * 14 + i * 2.1;
            ctx.globalAlpha = k * (0.9 - i * 0.2);
            ctx.beginPath();
            ctx.ellipse(x, y, r, r * 1.4, 0, s, s + 2.4);
            ctx.stroke();
        }
        ctx.restore();
        puffs(ctx, x - 14, y, { n: 8, t: p * 4, dx: -26, dy: -6, spread: 18, r0: 1, r1: 3, color: '#120a22', alpha: 0.8 * k * win(p, 0.4, 0.46), seed: 201 }); // 吹きはらわれる墨
        const rng = new Rng(`${a.seed}:leaf:${v.f}`);
        ctx.save();
        ctx.fillStyle = '#c8f7d0';
        for (let i = 0; i < 5; i++) {
            const t = (p * 3 + rng.next()) % 1, ang = rng.range(0, TAU) + p * 10;
            ctx.globalAlpha = k * (1 - t);
            ctx.fillRect(R(x + Math.cos(ang) * (8 + 10 * t)), R(y + Math.sin(ang) * (10 + 12 * t)), 2, 1);
        }
        ctx.restore();
    },
    // 打ち砕く: 飛んでくる石を一撃で砕き、かけらが散る（守護巨人のブレス）
    smash(ctx, v, p) {
        const u = win(p, 0.41, 0.56);
        if (u <= 0 || u >= 1)
            return;
        const x = v.x - 16, y = v.y - 16;
        glowAt(ctx, x, y, 9 * (1 - u) + 2, '#ffffff', '#d8ccb0', 1 - u);
        for (let i = 0; i < 7; i++) {
            const t = -2.6 + (i / 6) * 2.2, d = 3 + u * (18 + 10 * hash(i, 5));
            ctx.save();
            ctx.globalAlpha = 1 - u;
            rock(ctx, x + Math.cos(t) * d, y + Math.sin(t) * d + u * u * 16, 1.5 + hash(i, 6) * 2, u * 6 + i, i, '#8a7a62', '#b8a888', '#3a2a1a');
            ctx.restore();
        }
        puffs(ctx, x, y, { n: 6, t: u, dx: -10, dy: -8, spread: 12, r0: 2, r1: 5, color: '#c8b48a', alpha: 0.7 * (1 - u), seed: 203 });
    },
    // 炎で溶かす: 足もとから炎が立ちのぼり、吹きつける冷気を溶かして湯気になる（氷巨人のブレス）
    fireWall(ctx, v, p, a) {
        const k = win(p, 0.34, 0.4) * (1 - win(p, 0.54, 0.62));
        if (k <= 0)
            return;
        const x = v.x - 15, y = v.y;
        glowAt(ctx, x, y - 12, 14 * k, '#fff2b0', '#ff6a2a', 0.7 * k);
        ctx.save();
        const cols = ['#c0281a', '#ff5a3a', '#feae34', '#fff2b0'];
        for (let j = 0; j < 4; j++) {
            ctx.fillStyle = cols[j];
            ctx.globalAlpha = k;
            for (let i = -2; i <= 2; i++) {
                const h = (22 - j * 5) * k * (0.7 + 0.3 * Math.sin(a.frame / 2 + i * 1.7 + j)) * (1 - Math.abs(i) * 0.15);
                const w = 4 - j * 0.7;
                ctx.fillRect(R(x + i * 3 - w / 2), R(y - h), R(Math.max(1, w)), R(h));
            }
        }
        ctx.restore();
        puffs(ctx, x - 4, y - 24, { n: 7, t: p * 3, dx: -6, dy: -20, spread: 10, r0: 2, r1: 6, color: '#f0f4f8', alpha: 0.7 * k * win(p, 0.4, 0.46), seed: 205 }); // 湯気
    },
    // 撃ち落とす: 飛んでくる氷の槍を空中で撃ち抜き、かけらが散る（氷巨人の爪）
    shootDown(ctx, v, p) {
        const u = win(p, 0.42, 0.56);
        if (u <= 0 || u >= 1)
            return;
        const x = v.x - 34, y = v.y - 8;
        glowAt(ctx, x, y, 10 * (1 - u) + 2, '#ffffff', '#8fd3ff', 1 - u);
        for (let i = 0; i < 6; i++) {
            const t = (i / 6) * TAU + 0.3, d = 2 + u * (14 + 8 * hash(i, 7));
            ctx.save();
            ctx.globalAlpha = 1 - u;
            shard(ctx, x + Math.cos(t) * d, y + Math.sin(t) * d + u * u * 14, 5, 2, t, '#e6f6ff', '#ffffff', '#6aaee0');
            ctx.restore();
        }
    },
};
//# sourceMappingURL=counterfx.js.map