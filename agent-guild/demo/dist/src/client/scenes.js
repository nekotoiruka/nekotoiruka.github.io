// 課題の種類（scene）ごとの、派手な場面演出。arena.ts から呼ばれる。
// 時間はウェーブ内の進行度 phase（0..1）だけで決まる（シークしても同じ絵になる）。
//   0.00〜0.26 予兆（何が起きそうか） / 0.26〜0.42 溜め / 0.42 着弾 / 0.44〜0.56 かわす・受ける / 0.52〜0.84 反撃
import { Rng } from '../shared/rng.js';
import { drawHero, weaponSprite } from './hero.js';
import { PIXEL_FONT, isRtl, tl } from '../shared/i18n.js';
export const ULT_SCENES = ['ougi', 'rush', 'summon', 'parry', 'seal', 'awaken'];
export const isUltScene = (s) => !!s && ULT_SCENES.includes(s);
export const SCENE_LABEL = {
    breath: { head: tl('ブレスの予兆'), color: '#ff7a3a' },
    tail: { head: tl('尾のなぎはらい'), color: '#e8d5a8' },
    dive: { head: tl('急降下の予兆'), color: '#9aa0c8' },
    claw: { head: tl('爪の叩きつけ'), color: '#ff5a6e' },
    opening: { head: tl('隙あり！'), color: '#ffe27a' },
    fog: { head: tl('霧の中'), color: '#c8d0e0' },
    spell: { head: tl('呪文の詠唱'), color: '#ff4fa0' },
    ougi: { head: tl('奥義の好機！'), color: '#ffd166' },
    rush: { head: tl('突進の予兆'), color: '#ff8a5a' },
    summon: { head: tl('召喚の好機！'), color: '#9fe8ff' },
    parry: { head: tl('見切りの好機！'), color: '#ffe9a0' },
    seal: { head: tl('封印の好機！'), color: '#c8a8ff' },
    awaken: { head: tl('覚醒の好機！'), color: '#ff9ce6' },
    illusion: { head: tl('幻術の声'), color: '#b57bff' },
    memory: { head: tl('記憶の試練'), color: '#d9b77a' },
    ally: { head: tl('仲間の声'), color: '#7bed9f' },
    chain: { head: tl('連携詠唱！'), color: '#ffe9a0' },
};
// 属性の名前。データの中の属性は日本語の1文字（炎氷雷風光闇）で持ち、画面に出すときだけ言語に合わせる
export const elementLabel = (e) => ({ 炎: tl('炎'), 氷: tl('氷'), 雷: tl('雷'), 風: tl('風'), 光: tl('光'), 闇: tl('闇') }[e] ?? e);
export const ELEMENT_COLOR = {
    炎: { main: '#ff5a3a', light: '#ffe27a', dark: '#8a1e10' },
    氷: { main: '#8fd3ff', light: '#ffffff', dark: '#2a5a9a' },
    雷: { main: '#ffe27a', light: '#ffffff', dark: '#b08a10' },
    風: { main: '#7bed9f', light: '#e3ffc8', dark: '#2a8a5a' },
    光: { main: '#fff6c8', light: '#ffffff', dark: '#d8b84a' },
    闇: { main: '#a55bd8', light: '#e2c2ff', dark: '#3a1250' },
};
const TAU = Math.PI * 2;
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const win = (p, a, b) => clamp01((p - a) / (b - a));
const bump = (p, a, b) => (p < a || p > b ? 0 : Math.sin(((p - a) / (b - a)) * Math.PI));
const ease = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const R = Math.round;
const mouthOf = (a) => ({ x: a.foot.x + 46, y: a.foot.y - 50 });
const alive = (a) => a.fighters.filter((v) => v.alive);
function text(ctx, s, x, y, size, color, alpha = 1, outline = '#1a1c2c') {
    if (alpha <= 0)
        return;
    ctx.save();
    ctx.globalAlpha = clamp01(alpha);
    ctx.font = `${size}px ${PIXEL_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(2, size / 4);
    ctx.strokeText(s, R(x), R(y));
    ctx.fillStyle = color;
    ctx.fillText(s, R(x), R(y));
    ctx.restore();
}
function flash(a, k, color = '#ffffff', max = 0.7) {
    if (k <= 0)
        return;
    const { ctx } = a;
    ctx.save();
    ctx.globalAlpha = max * k;
    ctx.fillStyle = color;
    ctx.fillRect(-a.W, -a.H, a.W * 3, a.H * 3);
    ctx.restore();
}
function vignette(a, color, k) {
    if (k <= 0)
        return;
    const { ctx } = a;
    ctx.save();
    const g = ctx.createRadialGradient(a.W / 2, a.H / 2, a.H * 0.35, a.W / 2, a.H / 2, a.W * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, color);
    ctx.globalAlpha = k;
    ctx.fillStyle = g;
    ctx.fillRect(-a.W, -a.H, a.W * 3, a.H * 3);
    ctx.restore();
}
// 正解したキャラたちの中心に、技の名前を一度だけ大きく出す
function partyLabel(a, s0, color, k, dy = -58) {
    const ok = alive(a).filter((v) => v.ok);
    if (!ok.length || k <= 0)
        return;
    // 技の名前: 自分のキャラが正しく動けたら、その答え。竜以外のボスで分からなければ「かわした」
    const own = ok.find((v) => v.mine);
    const s = own ? own.excerpt.replace(/[「」]/g, '').split(/[：:]/)[0].slice(0, 10) : (a.theme?.breath ?? 'fire') === 'fire' ? s0 : tl('かわした');
    const x = ok.reduce((t, v) => t + v.x, 0) / ok.length, y = Math.min(...ok.map((v) => v.y)) + dy;
    text(a.ctx, tl(`{0}！`, s), x, Math.max(24, y), R(11 + 5 * bump(k, 0, 0.35)), color, Math.min(1, k * 4));
}
// ============ 奥（キャラより後ろ） ============
export function sceneBack(a) {
    const { ctx, phase: p } = a;
    if (a.ult && isUltScene(a.scene)) {
        ultBack(a);
        return;
    }
    if (a.scene === 'chain') {
        if (a.chain)
            chainBack(a, a.chain);
        return;
    }
    switch (a.scene) {
        case 'breath': { // 足元が熱で赤く染まる
            const k = win(p, 0.1, 0.42) * (1 - win(p, 0.5, 0.62));
            if (k > 0) {
                ctx.save();
                const g = ctx.createLinearGradient(a.foot.x, 0, a.W, 0);
                g.addColorStop(0, 'rgba(255,90,40,0.55)');
                g.addColorStop(1, 'rgba(255,90,40,0.08)');
                ctx.globalAlpha = k * (0.7 + 0.3 * Math.sin(a.frame / 2));
                ctx.fillStyle = g;
                ctx.fillRect(a.foot.x, 86, a.W, 130);
                ctx.restore();
            }
            break;
        }
        case 'dive': { // 床に竜の巨大な影が広がる
            const k = win(p, 0.18, 0.42);
            if (k > 0 && p < 0.5) {
                ctx.save();
                ctx.globalAlpha = 0.25 + k * 0.45;
                ctx.fillStyle = '#05040a';
                const cx = lerp(a.W * 0.4, a.W * 0.66, k), rx = 30 + k * 120, ry = 10 + k * 40;
                ctx.beginPath();
                ctx.ellipse(cx, 160, rx, ry, 0, 0, TAU);
                ctx.fill();
                // 翼の形
                ctx.beginPath();
                ctx.moveTo(cx - rx * 1.2, 150);
                ctx.lineTo(cx, 160 - ry * 0.4);
                ctx.lineTo(cx + rx * 1.2, 150);
                ctx.lineTo(cx, 166);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
            break;
        }
        case 'spell': { // 竜の足元の真紅の魔法陣（反撃で砕ける）
            const k = win(p, 0.04, 0.2), broke = win(p, 0.46, 0.56), cancel = alive(a).some((v) => v.ok);
            if (k > 0 && (!cancel || broke < 1) && p < 0.7) {
                ctx.save();
                ctx.globalAlpha = k * (cancel ? 1 - broke : 1 - win(p, 0.5, 0.7));
                ctx.translate(a.foot.x + 4, a.foot.y);
                ctx.scale(1, 0.32);
                ctx.strokeStyle = '#ff2f6e';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(0, 0, 70 * k, 0, TAU);
                ctx.stroke();
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(0, 0, 56 * k, 0, TAU);
                ctx.stroke();
                ctx.rotate(a.frame / 30);
                ctx.beginPath();
                for (let i = 0; i <= 5; i++) {
                    const t = (i * 2 * TAU) / 5;
                    const x = Math.cos(t) * 56 * k, y = Math.sin(t) * 56 * k;
                    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
                }
                ctx.stroke();
                ctx.fillStyle = '#ff8ab8';
                for (let i = 0; i < 16; i++) {
                    const t = (i / 16) * TAU;
                    ctx.fillRect(R(Math.cos(t) * 63 * k) - 2, R(Math.sin(t) * 63 * k) - 2, 4, 4);
                }
                ctx.restore();
            }
            break;
        }
        case 'illusion': { // 床を這う紫の波紋
            const k = win(p, 0.02, 0.15) * (1 - win(p, 0.55, 0.7));
            if (k > 0) {
                ctx.save();
                ctx.strokeStyle = '#b57bff';
                ctx.lineWidth = 1.5;
                for (let i = 0; i < 4; i++) {
                    const t = ((p * 3 + i / 4) % 1);
                    ctx.globalAlpha = k * (1 - t) * 0.8;
                    ctx.beginPath();
                    ctx.ellipse(a.W * 0.62, 150, 20 + t * 170, 6 + t * 50, 0, 0, TAU);
                    ctx.stroke();
                }
                ctx.restore();
            }
            break;
        }
        case 'ougi': { // 竜の下に金の光柱
            const k = bump(p, 0.24, 0.9);
            if (k > 0) {
                ctx.save();
                const g = ctx.createLinearGradient(0, 0, 0, a.foot.y);
                g.addColorStop(0, 'rgba(255,209,102,0)');
                g.addColorStop(1, 'rgba(255,209,102,0.5)');
                ctx.globalAlpha = k;
                ctx.fillStyle = g;
                ctx.fillRect(a.foot.x - 50, 0, 100, a.foot.y + 6);
                ctx.restore();
            }
            break;
        }
        case 'summon': { // 地面に浮かぶ淡い光の輪
            const k = bump(p, 0.24, 0.9);
            if (k > 0) {
                ctx.save();
                ctx.globalAlpha = k * 0.6;
                ctx.strokeStyle = '#9fe8ff';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.ellipse(a.foot.x + 4, a.foot.y, 40 + k * 8, 12 + k * 3, 0, 0, TAU);
                ctx.stroke();
                ctx.restore();
            }
            break;
        }
        default: break;
    }
}
// ============ 手前（キャラより前） ============
export function sceneFront(a) {
    switch (a.scene) {
        case 'breath':
            breathFx(a);
            break;
        case 'tail':
            tailFx(a);
            break;
        case 'dive':
            diveFx(a);
            break;
        case 'claw':
            clawFx(a);
            break;
        case 'opening':
            openingFx(a);
            break;
        case 'fog':
            fogFx(a);
            break;
        case 'spell':
            spellLights(a);
            break; // 本体は明かりの後（sceneTop）に描く
        case 'ougi':
        case 'rush':
        case 'summon':
        case 'parry':
        case 'seal':
        case 'awaken':
            if (a.ult)
                ultFront(a);
            else if (a.scene === 'rush')
                rushLightFx(a);
            else
                ougiFx(a);
            break;
        case 'illusion':
            illusionFx(a);
            break;
        case 'memory':
            memoryFx(a);
            break;
        case 'ally':
            allyFx(a);
            break;
        case 'chain':
            if (a.chain)
                chainFront(a, a.chain);
            break;
    }
    // どの場面でも: 頭に残った幻術の声（紫の鬼火）と、幻術にかかったキャラ
    for (const v of alive(a)) {
        if (v.haunted)
            hauntFx(a, v);
        if (v.charmed)
            charmFx(a, v);
    }
    const hn = alive(a).filter((v) => v.haunted).length;
    if (hn)
        text(a.ctx, tl(`さっきの幻術の声が、まだ頭に響いている…（{0}人）`, hn), a.W * 0.6, 204, 7, '#d0a0ff', bump(a.phase, 0.04, 0.34), '#2a0a4a');
}
// ---- ブレス: 喉に集まる炎 → 画面を焼く炎の奔流 → 水鏡で受け流す ----
function breathFx(a) {
    const { ctx, phase: p } = a;
    const m = mouthOf(a);
    const rng = new Rng(`${a.seed}:breath`);
    // ボスによって色を変える（炎・蜘蛛の糸・矢の雨・水・石・霧・氷）
    const PAL = { fire: ['#c0281a', '#ff5a3a', '#feae34', '#fff2b0'], web: ['#7a7f90', '#b8bccb', '#e4e7f0', '#ffffff'], arrows: ['#4a3420', '#7a5a34', '#b08a5a', '#e8d5a8'],
        water: ['#0b3a6e', '#1f6fb2', '#5fb3e6', '#d8f2ff'], rocks: ['#4a3a2a', '#7a6a52', '#a8987a', '#d8ccb0'], mist: ['#2a1438', '#5a2a6e', '#9a6ab0', '#e0c8f0'], ice: ['#3a7aa8', '#7ac0e8', '#c8ecff', '#ffffff'] };
    const pal = PAL[a.theme?.breath ?? 'fire'];
    // 予兆: 火の粉が口に吸い込まれる
    const gather = win(p, 0.06, 0.4);
    if (gather > 0 && p < 0.44) {
        for (let i = 0; i < 26; i++) {
            const ang = rng.range(0, TAU), d0 = rng.range(30, 80), sp = rng.range(0.6, 1.4);
            const t = (gather * sp + rng.next()) % 1;
            const d = d0 * (1 - t);
            ctx.globalAlpha = t;
            ctx.fillStyle = i % 3 ? pal[2] : pal[3];
            ctx.fillRect(R(m.x + Math.cos(ang) * d), R(m.y + Math.sin(ang) * d * 0.7), 2, 2);
        }
        ctx.globalAlpha = 1;
        const glow = 4 + gather * 10 + Math.sin(a.frame / 2) * 2;
        ctx.save();
        const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, glow * 2);
        g.addColorStop(0, pal[3]);
        g.addColorStop(0.4, pal[2] + 'b0');
        g.addColorStop(1, pal[0] + '00');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(m.x, m.y, glow * 2, 0, TAU);
        ctx.fill();
        ctx.restore();
    }
    // 炎の奔流（扇形）
    const k = win(p, 0.38, 0.44), fade = 1 - win(p, 0.52, 0.6);
    if (k > 0 && fade > 0) {
        const reach = lerp(m.x, a.W + 40, ease(k));
        ctx.save();
        ctx.globalAlpha = fade;
        // ボスによって色を変える（炎・蜘蛛の糸・矢の雨）
        const layers = [[pal[0], 1], [pal[1], 0.78], [pal[2], 0.55], [pal[3], 0.28]];
        for (const [col, wk] of layers) {
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.moveTo(m.x, m.y - 3 * wk);
            const steps = 14;
            for (let i = 1; i <= steps; i++) {
                const x = lerp(m.x, reach, i / steps);
                const spread = (i / steps) * 70 * wk;
                ctx.lineTo(x, m.y + 40 * (i / steps) - spread + Math.sin(a.frame / 1.5 + i) * 3);
            }
            for (let i = steps; i >= 1; i--) {
                const x = lerp(m.x, reach, i / steps);
                const spread = (i / steps) * 70 * wk;
                ctx.lineTo(x, m.y + 40 * (i / steps) + spread + Math.cos(a.frame / 1.7 + i) * 3);
            }
            ctx.closePath();
            ctx.fill();
        }
        // 火の粉
        for (let i = 0; i < 40; i++) {
            const t = (rng.next() + p * 4) % 1;
            const x = lerp(m.x, reach, t), y = m.y + 40 * t + rng.range(-1, 1) * 70 * t;
            ctx.fillStyle = i % 2 ? pal[2] : pal[1];
            ctx.fillRect(R(x), R(y), 2, 2);
        }
        ctx.restore();
        // 水鏡の構え: 正解したキャラの前に青い鏡。炎が上下に割れる
        for (const v of alive(a)) {
            if (!v.ok)
                continue;
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
        }
        partyLabel(a, tl('水鏡の構え'), '#bfe8ff', bump(p, 0.42, 0.58));
        flash(a, bump(p, 0.41, 0.45), '#ffb070', 0.35);
    }
}
// ---- 尾: 画面を横切る巨大な弧 → 燕返しで跳ぶ ----
function tailFx(a) {
    const { ctx, phase: p } = a;
    // 予兆: 風切りの線が竜の背後から
    const pre = win(p, 0.08, 0.36) * (p < 0.4 ? 1 : 0);
    if (pre > 0) {
        ctx.save();
        ctx.strokeStyle = '#e8d5a8';
        ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
            const t = (p * 5 + i / 6) % 1;
            ctx.globalAlpha = pre * (1 - t) * 0.8;
            ctx.beginPath();
            ctx.arc(a.foot.x - 10, a.foot.y - 20, 30 + t * 30, -Math.PI * 0.9, -Math.PI * 0.4);
            ctx.stroke();
        }
        ctx.restore();
    }
    const k = win(p, 0.38, 0.5);
    if (k > 0 && k < 1) {
        ctx.save();
        // 竜の尾が床すれすれを薙ぎはらう（太い帯＋白い風切り）
        const tipX = lerp(a.foot.x + 40, a.W + 60, ease(k)), tipY = 186;
        const c1 = { x: a.foot.x + 10, y: a.foot.y - 4 }, c2 = { x: lerp(a.foot.x + 40, tipX, 0.5), y: 210 };
        ctx.globalAlpha = 1 - win(k, 0.8, 1);
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#3a1f6a';
        ctx.lineWidth = 18;
        ctx.beginPath();
        ctx.moveTo(c1.x, c1.y);
        ctx.quadraticCurveTo(c2.x, c2.y, tipX, tipY);
        ctx.stroke();
        ctx.strokeStyle = '#7a4fd8';
        ctx.lineWidth = 12;
        ctx.stroke();
        ctx.strokeStyle = '#a98bff';
        ctx.lineWidth = 3;
        ctx.stroke();
        // 尾の先のとげ
        ctx.fillStyle = '#e8d5a8';
        ctx.beginPath();
        ctx.moveTo(tipX + 14, tipY - 2);
        ctx.lineTo(tipX - 4, tipY - 10);
        ctx.lineTo(tipX - 4, tipY + 8);
        ctx.closePath();
        ctx.fill();
        // 風切りの白線
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) {
            ctx.globalAlpha = (1 - k) * (0.9 - i * 0.12);
            const x = tipX - 20 - i * 18;
            ctx.beginPath();
            ctx.moveTo(x, tipY - 22 - i * 4);
            ctx.lineTo(x - 30, tipY - 18 - i * 4);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, tipY + 14 + i * 2);
            ctx.lineTo(x - 26, tipY + 12 + i * 2);
            ctx.stroke();
        }
        // 舞い上がる砂ぼこり
        const rng = new Rng(`${a.seed}:dust`);
        for (let i = 0; i < 30; i++) {
            const x = rng.range(a.foot.x + 30, a.W), y = rng.range(150, 210);
            const t = clamp01((k - (x - a.foot.x) / a.W) * 3);
            if (t <= 0 || t >= 1)
                continue;
            ctx.globalAlpha = 1 - t;
            ctx.fillStyle = '#c8b48a';
            const sz = 2 + t * 6;
            ctx.fillRect(R(x - sz / 2), R(y - t * 20 - sz / 2), R(sz), R(sz));
        }
        ctx.restore();
        flash(a, bump(p, 0.41, 0.45), '#ffffff', 0.25);
    }
    // 燕返し: 正解したキャラの跳躍の軌跡に、燕の形の白い残光
    for (const v of alive(a)) {
        if (!v.ok)
            continue;
        const u = win(p, 0.4, 0.56);
        if (u <= 0 || u >= 1)
            continue;
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
    }
    partyLabel(a, tl('燕返し'), '#ffffff', bump(p, 0.42, 0.6));
}
// ---- 急降下: 空が暗くなる → 竜の影が落ちる → 衝撃波と岩 ----
function diveFx(a) {
    const { ctx, phase: p } = a;
    const dark = win(p, 0.14, 0.4) * (1 - win(p, 0.46, 0.6));
    if (dark > 0) {
        ctx.save();
        const g = ctx.createLinearGradient(0, 0, 0, a.H);
        g.addColorStop(0, 'rgba(5,4,12,0.85)');
        g.addColorStop(0.7, 'rgba(5,4,12,0.35)');
        g.addColorStop(1, 'rgba(5,4,12,0.1)');
        ctx.globalAlpha = dark;
        ctx.fillStyle = g;
        ctx.fillRect(-a.W, -a.H, a.W * 3, a.H * 3);
        ctx.restore();
        text(ctx, tl('頭上が暗い…！'), a.W * 0.62, 30, 9, '#c8d0ff', dark * bump(p, 0.16, 0.4) * 1.4);
    }
    // 竜の影が上空から突っ込む
    const k = win(p, 0.36, 0.43);
    if (k > 0 && k < 1) {
        ctx.save();
        ctx.fillStyle = '#05040a';
        ctx.globalAlpha = 0.85;
        const x = lerp(a.W * 0.2, a.W * 0.68, k), y = lerp(-40, 150, ease(k)), s = 0.6 + k * 0.9;
        ctx.beginPath();
        ctx.moveTo(x - 60 * s, y - 10 * s);
        ctx.lineTo(x - 10 * s, y - 4 * s);
        ctx.lineTo(x, y - 16 * s);
        ctx.lineTo(x + 10 * s, y - 4 * s);
        ctx.lineTo(x + 60 * s, y - 10 * s);
        ctx.lineTo(x + 14 * s, y + 8 * s);
        ctx.lineTo(x, y + 20 * s);
        ctx.lineTo(x - 14 * s, y + 8 * s);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
    // 着弾: 衝撃波・岩・白い閃光
    const b = win(p, 0.42, 0.56);
    if (b > 0 && b < 1) {
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4 * (1 - b);
        ctx.globalAlpha = 1 - b;
        ctx.beginPath();
        ctx.ellipse(a.W * 0.68, 160, 20 + b * 220, 6 + b * 60, 0, 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = '#c8b48a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(a.W * 0.68, 160, 10 + b * 160, 3 + b * 44, 0, 0, TAU);
        ctx.stroke();
        const rng = new Rng(`${a.seed}:rocks`);
        for (let i = 0; i < 18; i++) {
            const ang = rng.range(Math.PI * 1.05, Math.PI * 1.95), sp = rng.range(40, 120);
            const x = a.W * 0.68 + Math.cos(ang) * sp * b, y = 160 + Math.sin(ang) * sp * b + 160 * b * b;
            ctx.fillStyle = i % 2 ? '#6a5a4a' : '#8a7a62';
            const s = rng.range(2, 5);
            ctx.fillRect(R(x), R(y), R(s), R(s));
        }
        ctx.restore();
        flash(a, bump(p, 0.42, 0.46), '#ffffff', 0.55);
    }
    for (const v of alive(a)) {
        if (!v.ok)
            continue;
        const u = bump(p, 0.4, 0.58);
        if (u > 0) {
            ctx.save();
            ctx.globalAlpha = u * 0.7;
            ctx.fillStyle = '#c8b48a';
            for (let i = -2; i <= 2; i++)
                ctx.fillRect(R(v.x + i * 5 - 1), R(v.y - 2 - Math.abs(i)), 3, 2);
            ctx.restore();
        }
    }
    partyLabel(a, tl('地這い'), '#c8d0ff', bump(p, 0.44, 0.6));
}
// ---- 爪: 画面を裂く三本の爪痕 → 影踏みで間合いを外す ----
function clawFx(a) {
    const { ctx, phase: p } = a;
    const glint = bump(p, 0.12, 0.36);
    if (glint > 0) { // 爪のきらめき
        const x = a.foot.x + 30, y = a.foot.y - 46;
        ctx.save();
        ctx.globalAlpha = glint;
        ctx.fillStyle = '#ffffff';
        const s = 4 + glint * 6;
        ctx.fillRect(R(x - s), R(y), R(s * 2), 1);
        ctx.fillRect(R(x), R(y - s), 1, R(s * 2));
        ctx.restore();
    }
    const k = win(p, 0.39, 0.46);
    if (k > 0) {
        const fade = 1 - win(p, 0.46, 0.62);
        ctx.save();
        for (let i = 0; i < 3; i++) {
            const x0 = a.W * 0.42 + i * 26, y0 = 40, x1 = x0 + 90, y1 = 210;
            const t = ease(k);
            ctx.globalAlpha = fade;
            ctx.strokeStyle = '#8a0f22';
            ctx.lineWidth = 9;
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(lerp(x0, x1, t), lerp(y0, y1, t));
            ctx.stroke();
            ctx.strokeStyle = '#ff5a6e';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(lerp(x0, x1, t), lerp(y0, y1, t));
            ctx.stroke();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x0 + 1, y0);
            ctx.lineTo(lerp(x0, x1, t) + 1, lerp(y0, y1, t));
            ctx.stroke();
        }
        // 地割れ
        const crack = win(p, 0.44, 0.5) * (1 - win(p, 0.7, 0.8));
        if (crack > 0) {
            ctx.globalAlpha = crack;
            ctx.strokeStyle = '#1a1430';
            ctx.lineWidth = 2;
            const rng = new Rng(`${a.seed}:crack`);
            for (let c = 0; c < 3; c++) {
                let x = a.W * 0.5 + c * 30, y = 200;
                ctx.beginPath();
                ctx.moveTo(x, y);
                for (let i = 0; i < 6; i++) {
                    x += rng.range(4, 12);
                    y -= rng.range(4, 10);
                    ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
        }
        ctx.restore();
        flash(a, bump(p, 0.4, 0.44), '#ff3050', 0.3);
    }
    for (const v of alive(a)) {
        if (!v.ok)
            continue;
        const u = bump(p, 0.38, 0.56);
        if (u <= 0)
            continue;
        ctx.save(); // 影の分身
        for (let i = 1; i <= 3; i++) {
            ctx.globalAlpha = u * 0.35 / i;
            ctx.fillStyle = '#6a3a9a';
            ctx.beginPath();
            ctx.ellipse(v.x - i * 7, v.y - 10, 5, 10, 0, 0, TAU);
            ctx.fill();
        }
        ctx.restore();
    }
    partyLabel(a, tl('影踏み'), '#e2c2ff', bump(p, 0.44, 0.6));
}
// ---- 隙: よろめく竜 → 看破のモノクルで弱点の紋章 → 属性の大技 ----
function openingFx(a) {
    const { ctx, phase: p } = a;
    const el = ELEMENT_COLOR[a.element ?? ''] ?? ELEMENT_COLOR['光'];
    // よろめきの星
    const st = win(p, 0.04, 0.12) * (1 - win(p, 0.5, 0.6));
    if (st > 0) {
        for (let i = 0; i < 4; i++) {
            const t = a.frame / 10 + (i / 4) * TAU;
            const x = a.body.x + Math.cos(t) * 18, y = a.body.y - 44 + Math.sin(t) * 5;
            ctx.globalAlpha = st;
            ctx.fillStyle = '#ffe27a';
            ctx.fillRect(R(x - 2), R(y), 5, 1);
            ctx.fillRect(R(x), R(y - 2), 1, 5);
        }
        ctx.globalAlpha = 1;
    }
    // モノクル: 看破を使ったキャラがいれば、竜の胸に大きなレンズと紋章
    const scanned = alive(a).some((v) => v.tools.includes('scan'));
    const lk = bump(p, 0.18, 0.5);
    if (lk > 0) {
        const cx = a.body.x + 4, cy = a.body.y - 4, r = 10 + lk * 22;
        ctx.save();
        ctx.globalAlpha = lk;
        if (scanned) {
            ctx.fillStyle = 'rgba(200,240,255,0.18)';
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, TAU);
            ctx.fill();
            ctx.strokeStyle = '#d8b84a';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, TAU);
            ctx.stroke();
            ctx.strokeStyle = '#8fd3ff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx - r, cy);
            ctx.lineTo(cx + r, cy);
            ctx.moveTo(cx, cy - r);
            ctx.lineTo(cx, cy + r);
            ctx.stroke();
            ctx.strokeStyle = '#d8b84a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cx + r * 0.7, cy + r * 0.7);
            ctx.lineTo(cx + r * 1.2, cy + r * 1.5);
            ctx.stroke();
        }
        // 紋章（属性の文字）
        ctx.restore();
        if (a.element)
            text(ctx, elementLabel(a.element), cx, cy, R(10 + lk * 10), el.main, lk, el.dark);
        if (scanned && a.element)
            text(ctx, tl(`弱点：{0}`, elementLabel(a.element)), cx + 40, cy - 30, 9, el.light, lk, el.dark);
    }
    // 反撃: 属性の大技が竜に降りそそぐ
    const firsts = alive(a).filter((v) => v.ok && v.atT !== undefined).map((v) => v.atT);
    if (!firsts.length)
        return;
    const t0 = Math.min(...firsts) - 0.04;
    const k = win(p, t0, t0 + 0.22);
    if (k <= 0 || k >= 1)
        return;
    elementStrike(a, a.element ?? '光', k);
}
export function elementStrike(a, element, k) {
    const { ctx } = a;
    const el = ELEMENT_COLOR[element] ?? ELEMENT_COLOR['光'];
    const bx = a.body.x, by = a.body.y;
    const rng = new Rng(`${a.seed}:el`);
    ctx.save();
    switch (element) {
        case '炎': // 火柱が立ち上る
            for (let i = 0; i < 5; i++) {
                const x = bx - 40 + i * 20, h = 120 * ease(clamp01(k * 2 - i * 0.12));
                ctx.globalAlpha = 1 - k * 0.6;
                ctx.fillStyle = el.dark;
                ctx.fillRect(R(x - 7), R(a.foot.y - h), 14, R(h));
                ctx.fillStyle = el.main;
                ctx.fillRect(R(x - 5), R(a.foot.y - h), 10, R(h));
                ctx.fillStyle = el.light;
                ctx.fillRect(R(x - 2), R(a.foot.y - h), 4, R(h));
            }
            break;
        case '氷': // 氷の槍が突き刺さる
            for (let i = 0; i < 9; i++) {
                const t = clamp01(k * 1.8 - i * 0.07);
                if (t <= 0)
                    continue;
                const ang = rng.range(-0.6, 0.6) - Math.PI / 2 + Math.PI;
                const d = 120 * (1 - ease(t));
                const x = bx + Math.cos(ang) * d * -1 + rng.range(-20, 20), y = by + Math.sin(ang) * d - 30 * (1 - t) + rng.range(-16, 16);
                ctx.globalAlpha = 1 - Math.max(0, k - 0.7) / 0.3;
                ctx.fillStyle = el.main;
                ctx.beginPath();
                ctx.moveTo(x, y - 3);
                ctx.lineTo(x + 18, y);
                ctx.lineTo(x, y + 3);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = el.light;
                ctx.fillRect(R(x), R(y), 12, 1);
            }
            break;
        case '雷': // 天から落雷
            for (let i = 0; i < 3; i++) {
                const t = clamp01(k * 3 - i * 0.5);
                if (t <= 0 || t >= 1)
                    continue;
                let x = bx - 20 + i * 20, y = -10;
                ctx.globalAlpha = 1 - t;
                ctx.strokeStyle = el.light;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(x, y);
                while (y < by) {
                    x += rng.range(-10, 10);
                    y += rng.range(10, 20);
                    ctx.lineTo(x, y);
                }
                ctx.stroke();
                ctx.strokeStyle = el.main;
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
            flash(a, bump(k, 0, 0.2), '#fff8c0', 0.5);
            break;
        case '風': // 竜巻
            for (let i = 0; i < 14; i++) {
                const h = i * 9, r = 8 + i * 3;
                const t = a.frame / 4 + i * 0.6;
                ctx.globalAlpha = (1 - k) * 0.9;
                ctx.strokeStyle = i % 2 ? el.main : el.light;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.ellipse(bx + Math.sin(t) * 3, a.foot.y - h, r * ease(clamp01(k * 2)), r * 0.25, 0, t, t + Math.PI * 1.3);
                ctx.stroke();
            }
            break;
        case '光': // 光の柱と十字
            ctx.globalAlpha = 1 - k;
            ctx.fillStyle = el.main;
            ctx.fillRect(R(bx - 14 * (1 - k * 0.5)), -20, R(28 * (1 - k * 0.5)), a.foot.y + 20);
            ctx.fillStyle = el.light;
            ctx.fillRect(R(bx - 4), -20, 8, a.foot.y + 20);
            ctx.fillRect(R(bx - 60 * k), R(by - 2), R(120 * k), 4);
            break;
        case '闇': // 黒い渦が竜を飲み込む
            for (let i = 0; i < 4; i++) {
                ctx.globalAlpha = (1 - k) * 0.8;
                ctx.strokeStyle = i % 2 ? el.main : el.dark;
                ctx.lineWidth = 4;
                const r = (50 - i * 10) * (1 - k * 0.5);
                ctx.beginPath();
                ctx.arc(bx, by, r, a.frame / 5 + i, a.frame / 5 + i + Math.PI * 1.4);
                ctx.stroke();
            }
            ctx.globalAlpha = (1 - k) * 0.6;
            ctx.fillStyle = '#05000a';
            ctx.beginPath();
            ctx.arc(bx, by, 14 * (1 - k), 0, TAU);
            ctx.fill();
            break;
    }
    ctx.restore();
    text(ctx, tl(`{0}！`, elementLabel(element)), bx + 30, by - 40, R(12 + 6 * bump(k, 0, 0.5)), el.main, 1 - win(k, 0.7, 1), el.dark);
}
// ---- 霧: 戦場を覆う濃霧 → 気配の鈴の波紋 → 霧が晴れる ----
function fogFx(a) {
    const { ctx, phase: p } = a;
    const dens = win(p, 0.02, 0.16) * (1 - win(p, 0.5, 0.68));
    if (dens > 0) {
        const rng = new Rng(`${a.seed}:fog`);
        ctx.save();
        for (let i = 0; i < 22; i++) {
            const y = rng.range(20, 210), r = rng.range(40, 90), sp = rng.range(8, 30);
            const x = ((rng.range(0, a.W + 200) + p * sp * 20) % (a.W + 200)) - 100;
            ctx.globalAlpha = dens * 0.28;
            ctx.fillStyle = i % 3 ? '#c8d0e0' : '#e8ecf4';
            ctx.beginPath();
            ctx.ellipse(x, y, r, r * 0.45, 0, 0, TAU);
            ctx.fill();
        }
        ctx.restore();
        // 霧の中で光る竜の目
        if (p > 0.1 && p < 0.42) {
            const e = 0.5 + 0.5 * Math.sin(a.frame / 4);
            ctx.fillStyle = `rgba(255,60,60,${e * dens})`;
            ctx.fillRect(R(a.body.x + 8), R(a.body.y - 26), 3, 2);
            ctx.fillRect(R(a.body.x + 16), R(a.body.y - 26), 3, 2);
        }
    }
    // 鈴の波紋（鈴を持ったキャラから金の輪が広がる）
    for (const v of alive(a)) {
        if (!v.tools.includes('bell'))
            continue;
        const k = win(p, 0.12, 0.44);
        if (k <= 0 || k >= 1)
            continue;
        ctx.save();
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
            const t = (k * 2 + i / 3) % 1;
            ctx.globalAlpha = (1 - t) * 0.9;
            ctx.beginPath();
            ctx.ellipse(v.x, v.y - 16, 6 + t * 70, 3 + t * 30, 0, 0, TAU);
            ctx.stroke();
        }
        ctx.restore();
        // 鈴と音符
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(R(v.x - 2), R(v.y - 42 + Math.sin(a.frame / 3)), 5, 4);
        ctx.fillRect(R(v.x), R(v.y - 38), 1, 2);
        text(ctx, '♪', v.x + 8 + Math.sin(k * 20) * 3, v.y - 44 - k * 12, 8, '#ffd166', 1 - k);
    }
    // 霧が晴れる瞬間の光
    flash(a, bump(p, 0.5, 0.6), '#ffffff', 0.18);
}
// ---- 呪文: 竜の真紅の魔法弾 → 冒険者たちの魔法陣から光が集まり、巨大な封印陣で叩き割る ----
// 打ち消しの場面の言葉（ボスの側／冒険者の側）。シーズンのボスごとに、何を唱え合うかが違う
const CHANT_LABELS = {
    dragon: [tl('詠唱'), tl('打ち消しの詠唱')],
    spider: [tl('毒の大技'), tl('解毒の調合')],
    goblin: [tl('大号令'), tl('合図の読み解き')],
    kraken: [tl('大技'), tl('旗艦の号令')],
    golem: [tl('刻印の起動'), tl('解呪の言葉')],
    vampire: [tl('呪いの紋'), tl('祓いの聖句')],
    giant: [tl('雪崩の予兆'), tl('避難の合図')],
};
const chantLabels = (a) => CHANT_LABELS[a.theme?.kind ?? 'dragon'] ?? CHANT_LABELS.dragon;
// 中身が見えない冒険者の詠唱（古代文字）
const RUNE_WORDS = ['ᚨᛚ・ᛞᚱᚨ', 'ᛟᚱ・ᚹᛁᚾ', 'ᛋᛖᛚ・ᚨᚱᚲ', 'ᚦᚢᚱ・ᛖᚾ', 'ᛗᚨᚷ・ᛚᛟᚱ', 'ᚷᚨᛚ・ᛞᚱ'];
// 詠唱合戦の流れ（場面の進み具合）:
//   ボスの詠唱と魔法弾の溜め → 放たれて討伐隊へ迫る（来るぞ…！）→ 打ち消しの呪文を知る者だけにスポットライト、詠唱 →
//   光線が空中の魔法弾をつかまえる → 押し返す（打ち消し！）→ 青く膨れあがった魔法弾がボスに返る（倍返し！）
export const SPELL_T = { chant0: 0.05, launch: 0.27, caught: 0.35, push: 0.4, back: 0.47, end: 0.66 };
const IMPACT_SPELL = 0.42; // 外した冒険者に当たる時刻（arena の IMPACT と同じ）
const spellCasters = (a) => alive(a).filter((v) => v.ok);
// 打ち消しの呪文を知る者を照らすあいだ、まわりを暗くする（arena の明かりの暗さに足す）
export function sceneDark(a) {
    if (a.scene !== 'spell' || !spellCasters(a).length)
        return 0;
    return 0.45 * win(a.phase, 0.2, 0.26) * (1 - win(a.phase, 0.5, 0.56));
}
const spellOrbStart = (a) => ({ x: a.body.x + 34, y: a.body.y - 42 });
function spellPartyAt(a) {
    const vs = alive(a);
    if (!vs.length)
        return { x: a.W * 0.7, y: 130 };
    return { x: vs.reduce((s0, v) => s0 + v.x, 0) / vs.length, y: vs.reduce((s0, v) => s0 + v.y, 0) / vs.length - 22 };
}
// 魔法弾の位置・大きさ・色（0=ボスの赤 → 1=押し返した青）
function spellOrb(a) {
    const p = a.phase, T = SPELL_T, o = spellOrbStart(a), party = spellPartyAt(a);
    const grow = win(p, 0.08, T.launch);
    const r0 = 4 + grow * 16;
    if (!spellCasters(a).length) {
        const k = win(p, T.launch, IMPACT_SPELL);
        return { x: lerp(o.x, party.x, k * k), y: lerp(o.y, party.y, k * k) - Math.sin(k * Math.PI) * 18, r: r0, rev: 0, on: grow > 0 && p < IMPACT_SPELL };
    }
    const mid = { x: lerp(o.x, party.x, 0.5), y: lerp(o.y, party.y, 0.5) - 14 };
    const near = { x: lerp(o.x, party.x, 0.6), y: lerp(o.y, party.y, 0.6) - 10 };
    if (p < T.launch)
        return { x: o.x, y: o.y, r: r0, rev: 0, on: grow > 0 };
    if (p < T.caught) {
        const k = ease(win(p, T.launch, T.caught));
        return { x: lerp(o.x, mid.x, k), y: lerp(o.y, mid.y, k), r: r0, rev: 0, on: true };
    }
    if (p < T.push) { // 光線につかまって、じりじりと迫る（押し合い）
        const k = win(p, T.caught, T.push), wob = Math.sin(a.frame / 1.6) * 2;
        return { x: lerp(mid.x, near.x, k) + wob, y: lerp(mid.y, near.y, k), r: r0 + Math.sin(a.frame / 2) * 2, rev: 0.15 * k, on: true };
    }
    if (p < T.back) { // 押し返す: 青く膨れあがりながら、ボスへ
        const k = win(p, T.push, T.back);
        return { x: lerp(near.x, a.body.x + 6, k * k), y: lerp(near.y, a.body.y - 18, k * k) - Math.sin(k * Math.PI) * 20, r: r0 * (1 + k), rev: 0.15 + 0.85 * ease(k), on: true };
    }
    return { x: a.body.x + 6, y: a.body.y - 18, r: r0 * 2, rev: 1, on: false };
}
// 明かり（暗くする前に足す）: 魔法弾の光と、打ち消しの呪文を知る者たちのスポットライト
function spellLights(a) {
    const orb = spellOrb(a);
    if (orb.on)
        a.lights?.push({ x: orb.x, y: orb.y, r: 40 + orb.r * 2, a: 0.9, col: orb.rev > 0.5 ? '#8fd3ff' : '#ff4fa0' });
    const sk = win(a.phase, 0.2, 0.26) * (1 - win(a.phase, 0.5, 0.56));
    if (sk > 0)
        for (const v of spellCasters(a))
            a.lights?.push({ x: v.x, y: v.y - 14, r: v.mine ? 44 : 36, a: sk, col: v.mine ? '#ffd166' : '#bfe8ff' });
}
function spellFx(a) {
    const { ctx, phase: p } = a;
    const T = SPELL_T;
    const o0 = spellOrbStart(a);
    const cancel = spellCasters(a);
    const orb = spellOrb(a);
    const rng = new Rng(`${a.seed}:rune`);
    const pc = (rev) => (rev > 0.5 ? '#5fcde4' : '#ff4fa0');
    // スポットライト: 打ち消しの呪文を知る者だけ、天から光が差す
    const sk = cancel.length ? win(p, 0.2, 0.26) * (1 - win(p, 0.5, 0.56)) : 0;
    if (sk > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const v of cancel) {
            const top = -10, w0 = 4, w1 = v.mine ? 17 : 13;
            const g = ctx.createLinearGradient(0, top, 0, v.y + 2);
            const c0 = v.mine ? '255,214,110' : '190,232,255';
            g.addColorStop(0, `rgba(${c0},0)`);
            g.addColorStop(0.5, `rgba(${c0},0.12)`);
            g.addColorStop(1, `rgba(${c0},0.4)`);
            ctx.globalAlpha = sk;
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(v.x - w0, top);
            ctx.lineTo(v.x + w0, top);
            ctx.lineTo(v.x + w1, v.y + 2);
            ctx.lineTo(v.x - w1, v.y + 2);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = sk * 0.6;
            ctx.fillStyle = `rgba(${c0},0.5)`;
            ctx.beginPath();
            ctx.ellipse(v.x, v.y + 2, w1, 4, 0, 0, TAU);
            ctx.fill();
            // 舞い落ちる光の粒
            const pr = new Rng(`${a.seed}:spot:${v.f}`);
            for (let i = 0; i < 6; i++) {
                const t = (p * 3 * pr.range(0.7, 1.3) + pr.next()) % 1;
                ctx.globalAlpha = sk * (1 - t) * 0.9;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(R(v.x + pr.range(-w1, w1) * t), R(lerp(top + 20, v.y, t)), 1, 2);
            }
        }
        ctx.restore();
        text(ctx, tl(`打ち消しの呪文を知る者 {0}人`, cancel.length), a.W * 0.66, a.foot.y + 34, 10, '#bfe8ff', bump(p, 0.21, 0.36) * 1.4, '#0a2a4a');
    }
    // 浮かぶ呪文の文字（ボスの詠唱）
    if (p > 0.04 && p < T.launch + 0.04) {
        for (let i = 0; i < 12; i++) {
            const t = (p * 2 + i / 12) % 1;
            const x = a.foot.x - 30 + rng.range(0, 120), y = a.foot.y - t * 120;
            text(ctx, 'ᚱᚨᛞᛟᚷᛗ'[i % 6], x, y, 7, '#ff8ab8', (1 - t) * 0.9 * (1 - win(p, T.launch, T.launch + 0.04)), '#3a0a1e');
        }
    }
    // ボスの詠唱（呪文の名前が1文字ずつ浮かぶ）
    const name1 = /「([^」]+)」/.exec(a.title)?.[1] ?? a.title.replace(/^大技[：:]/, '');
    const name0 = /聞き取れない|聞こえない/.test(name1) ? 'ᛉ？ᛟ・ᚾ？？' : name1; // 名前が聞き取れない呪文は、崩れた文字で
    const chantK = win(p, T.chant0, T.launch - 0.04);
    if (chantK > 0 && p < T.launch + 0.06) {
        const n = Math.max(1, Math.ceil(chantK * [...name0].length));
        const shown = [...name0].slice(0, n).join('');
        const al = Math.min(1, chantK * 4) * (1 - win(p, T.launch + 0.02, T.launch + 0.06));
        text(ctx, chantLabels(a)[0], o0.x - 30, o0.y - 40, 8, '#ff8ab8', al, '#3a0a1e');
        text(ctx, tl(`「{0}」`, shown), o0.x + 10, o0.y - 28, 12, a.frame % 8 < 4 ? '#ff4fa0' : '#ffd0e4', al, '#3a0a1e');
    }
    // 放たれた！ 討伐隊へ迫る
    const party = spellPartyAt(a);
    const warn = bump(p, T.launch, T.caught + 0.03);
    if (warn > 0)
        text(ctx, tl('来るぞ…！'), party.x, party.y - 46, R(11 + 3 * bump(p, T.launch, T.launch + 0.03)), a.frame % 6 < 3 ? '#ff6b8a' : '#ffd0e4', Math.min(1, warn * 2), '#3a0a1e');
    // 魔法弾（溜め → 飛ぶ → つかまる → 押し返されて青く）
    if (orb.on) {
        const r = orb.r + Math.sin(a.frame / 2) * 1.5;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // 尾
        if (p > T.launch) {
            for (let i = 1; i <= 5; i++) {
                const back = p - i * 0.006;
                const q = spellOrb({ ...a, phase: back });
                ctx.globalAlpha = 0.18 * (1 - i / 6);
                ctx.fillStyle = pc(q.rev);
                ctx.beginPath();
                ctx.arc(q.x, q.y, Math.max(1, q.r * (1 - i / 7)), 0, TAU);
                ctx.fill();
            }
        }
        const g = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, r * 2);
        const mid = orb.rev > 0.5 ? '#5fcde4' : '#ff4fa0', outer = orb.rev > 0.5 ? 'rgba(40,120,220,0.6)' : 'rgba(160,0,70,0.6)';
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.3, mid);
        g.addColorStop(0.7, outer);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, r * 2, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = mid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, r * 2.4, a.frame / 10, a.frame / 10 + Math.PI * 1.6);
        ctx.stroke();
        ctx.restore();
    }
    // 失敗: 魔法弾が隊列に落ちて炸裂
    if (!cancel.length) {
        const k = win(p, IMPACT_SPELL, IMPACT_SPELL + 0.14);
        if (k > 0 && k < 1) {
            ctx.save();
            ctx.globalAlpha = 1 - k;
            ctx.strokeStyle = '#ff4fa0';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.ellipse(party.x, party.y + 20, k * 200, k * 70, 0, 0, TAU);
            ctx.stroke();
            ctx.restore();
            flash(a, bump(p, IMPACT_SPELL, IMPACT_SPELL + 0.05), '#ff4fa0', 0.45);
            text(ctx, tl('呪文が炸裂した…'), a.W * 0.62, 70, 10, '#ffb0d0', bump(p, IMPACT_SPELL + 0.02, 0.6));
        }
        return;
    }
    // 1) 知る者の足元に、青い魔法陣（回る二重の輪と六芒星）
    const ck = win(p, 0.24, 0.3) * (1 - win(p, 0.5, 0.58));
    for (const v of cancel) {
        if (ck <= 0)
            break;
        ctx.save();
        ctx.translate(v.x, v.y + 1);
        ctx.scale(1, 0.38);
        ctx.globalAlpha = ck;
        ctx.strokeStyle = v.mine ? '#ffd166' : '#8fd3ff';
        ctx.lineWidth = 1.5;
        const R0 = 16 * ck;
        ctx.beginPath();
        ctx.arc(0, 0, R0, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, R0 * 0.75, 0, TAU);
        ctx.stroke();
        ctx.rotate(a.frame / 14);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const t = (i / 6) * TAU;
            const x = Math.cos(t) * R0 * 0.75, y = Math.sin(t) * R0 * 0.75;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
    }
    // 2) 知る者たちの詠唱。ほかの人の答えはネタバレになるので、中身が見えない人は古代文字で唱える
    const [, ourLabel] = chantLabels(a);
    const chantEnd = T.push + 0.02;
    const others = cancel.filter((v) => !v.mine).slice(0, 8);
    others.forEach((v, i) => {
        const st = 0.25 + (i % 4) * 0.012;
        const kk = win(p, st, st + 0.08);
        if (kk <= 0 || p >= chantEnd)
            return;
        const real = !/^[（(]/.test(v.excerpt) && v.excerpt ? v.excerpt.replace(/[「」]/g, '').split(/[：:]/)[0].slice(0, 10) : '';
        const words = real || RUNE_WORDS[(v.f + i) % RUNE_WORDS.length];
        const n = Math.max(1, Math.ceil(kk * [...words].length));
        const al = Math.min(1, kk * 4) * (1 - win(p, chantEnd - 0.03, chantEnd)) * 0.9;
        const yo = (i % 2) * 9; // となり同士で重ならないよう、高さを少しずらす
        const str = tl(`「{0}」`, [...words].slice(0, n).join(''));
        const ty = v.y - 34 - yo;
        ctx.save();
        ctx.font = `bold 9px ${PIXEL_FONT}`;
        const tw = ctx.measureText(str).width + 6;
        ctx.globalAlpha = al * 0.8;
        ctx.fillStyle = 'rgba(8,20,48,0.85)';
        ctx.fillRect(R(v.x - 2 - tw / 2), R(ty - 7), R(tw), 13);
        ctx.globalAlpha = al;
        ctx.strokeStyle = '#8fd3ff';
        ctx.lineWidth = 1;
        ctx.strokeRect(R(v.x - 2 - tw / 2) + 0.5, R(ty - 7) + 0.5, R(tw) - 1, 12);
        ctx.restore();
        text(ctx, str, v.x - 2, ty, 9, a.frame % 10 < 5 ? '#9fd8ff' : '#ffffff', al, '#0a2a4a');
    });
    // 自分の冒険者の打ち消しの詠唱（呪文の名前が1文字ずつ・大きく）
    const mineV = cancel.find((v) => v.mine);
    const counterName = mineV && !/^[（(]/.test(mineV.excerpt) ? mineV.excerpt.replace(/[「」]/g, '').split(/[：:]/)[0].slice(0, 12) : '';
    if (mineV && counterName) {
        const ck2 = win(p, 0.25, 0.35);
        if (ck2 > 0 && p < chantEnd) {
            const n = Math.max(1, Math.ceil(ck2 * [...counterName].length));
            const al = Math.min(1, ck2 * 4) * (1 - win(p, chantEnd - 0.03, chantEnd));
            text(ctx, ourLabel, mineV.x - 4, mineV.y - 62, 8, '#ffe9a0', al, '#3a2a00');
            text(ctx, tl(`「{0}」`, [...counterName].slice(0, n).join('')), mineV.x - 4, mineV.y - 50, 11, a.frame % 8 < 4 ? '#ffd166' : '#ffffff', al, '#3a2a00');
        }
    }
    // 3) 光線: 知る者たちの青い光線が、空中の魔法弾をつかまえ、押し返し、ボスまで送り届ける
    const bk = win(p, T.caught - 0.02, T.caught + 0.01) * (1 - win(p, T.back, T.back + 0.02));
    if (bk > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const v of cancel) {
            ctx.globalAlpha = 0.9 * bk;
            ctx.strokeStyle = v.mine ? '#ffd166' : '#5fcde4';
            ctx.lineWidth = (v.mine ? 5 : 2.5) * ease(bk) + Math.sin(a.frame / 2 + v.f) * 0.6;
            ctx.beginPath();
            ctx.moveTo(v.x, v.y - 18);
            ctx.lineTo(orb.x, orb.y);
            ctx.stroke();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        // つかまえた点の火花
        const sr = new Rng(`${a.seed}:${a.frame}`);
        for (let i = 0; i < 14; i++) {
            const ang = sr.range(0, TAU), d = sr.range(4, 22);
            ctx.globalAlpha = bk;
            ctx.fillStyle = i % 2 ? '#ff8ab8' : '#bfe8ff';
            ctx.fillRect(R(orb.x + Math.cos(ang) * d), R(orb.y + Math.sin(ang) * d), 2, 2);
        }
        ctx.restore();
    }
    // 押し合いの余波: 呪文を知らなかった冒険者には、こぼれた火の粉が降りかかる
    for (const v of alive(a).filter((x) => !x.ok)) {
        const k = win(p, IMPACT_SPELL - 0.04, IMPACT_SPELL);
        if (k <= 0 || k >= 1)
            continue;
        const from = spellOrb({ ...a, phase: IMPACT_SPELL - 0.04 });
        const hx = lerp(from.x, v.x, k), hy = lerp(from.y, v.y - 12, k) - Math.sin(k * Math.PI) * 10;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = '#ff4fa0';
        ctx.beginPath();
        ctx.arc(hx, hy, 2.5, 0, TAU);
        ctx.fill();
        ctx.restore();
    }
    // 打ち消し！（押し返しはじめ）
    const spell = mineV && !/^[（(]/.test(mineV.excerpt) ? mineV.excerpt.replace(/[「」]/g, '').split(/[：:]/)[0].slice(0, 12) : '';
    const tk = bump(p, T.push, T.back + 0.02);
    if (tk > 0) {
        text(ctx, a.theme?.counter ?? tl('打ち消し！'), a.W / 2 + 10, 64, R(16 + 6 * bump(p, T.push, T.push + 0.03)), '#bfe8ff', Math.min(1, tk * 2), '#0a2a4a');
        if (spell)
            text(ctx, `― ${spell} ―`, a.W / 2 + 10, 82, 10, '#ffffff', Math.min(1, tk * 2), '#0a2a4a');
    }
    // 4) 倍返し: 青く膨れた魔法弾がボスに炸裂（破片・衝撃波・閃光）
    const hit = { x: a.body.x + 6, y: a.body.y - 18 };
    const shatter = win(p, T.back, T.back + 0.16);
    if (shatter > 0 && shatter < 1) {
        const sr = new Rng(`${a.seed}:shard`);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 40; i++) {
            const ang = sr.range(0, TAU), sp = sr.range(25, 120);
            const x = hit.x + Math.cos(ang) * sp * shatter, y = hit.y + Math.sin(ang) * sp * shatter + 40 * shatter * shatter;
            ctx.globalAlpha = 1 - shatter;
            ctx.fillStyle = i % 3 ? '#8fd3ff' : i % 2 ? '#ffd166' : '#ffffff';
            const z = sr.range(2, 6);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + z, y + z * 0.3);
            ctx.lineTo(x + z * 0.2, y + z);
            ctx.closePath();
            ctx.fill();
        }
        ctx.globalAlpha = 1 - shatter;
        ctx.strokeStyle = '#bfe8ff';
        ctx.lineWidth = 5 * (1 - shatter) + 1;
        ctx.beginPath();
        ctx.ellipse(hit.x, hit.y, 10 + shatter * 150, 6 + shatter * 70, 0, 0, TAU);
        ctx.stroke();
        const g = ctx.createRadialGradient(hit.x, hit.y, 0, hit.x, hit.y, 60);
        g.addColorStop(0, 'rgba(255,255,255,0.9)');
        g.addColorStop(0.5, 'rgba(120,200,255,0.5)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 1 - shatter;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(hit.x, hit.y, 60, 0, TAU);
        ctx.fill();
        ctx.restore();
    }
    flash(a, bump(p, T.back - 0.005, T.back + 0.04), '#e0f6ff', 0.8);
    const rk = bump(p, T.back, T.end);
    if (rk > 0)
        text(ctx, tl('倍返し！'), hit.x + 44, hit.y - 30 - 6 * win(p, T.back, T.end), R(20 + 10 * bump(p, T.back, T.back + 0.04)), a.frame % 6 < 3 ? '#ffffff' : '#ffe27a', Math.min(1, rk * 2), '#5a1a00');
}
// ---- 奥義: 綻びが光る → 映画のような帯 → 金の十字斬りと技名 ----
function ougiFx(a) {
    const { ctx, phase: p } = a;
    const glow = bump(p, 0.08, 0.5);
    if (glow > 0) { // 綻び（逆鱗・翼・角）が光る
        const x = a.body.x + 6, y = a.body.y - 14;
        ctx.save();
        ctx.globalAlpha = glow;
        ctx.fillStyle = '#ffd166';
        for (let i = 0; i < 8; i++) {
            const t = (i / 8) * TAU + a.frame / 8;
            const d = 8 + glow * 6;
            ctx.fillRect(R(x + Math.cos(t) * d), R(y + Math.sin(t) * d), 2, 2);
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(R(x - 2), R(y - 2), 4, 4);
        ctx.restore();
    }
    const hitters = alive(a).filter((v) => v.ok && v.atT !== undefined);
    if (!hitters.length)
        return;
    const t0 = Math.min(...hitters.map((v) => v.atT)) - 0.08;
    const k = win(p, t0, t0 + 0.26);
    if (k <= 0 || k >= 1)
        return;
    // 上下の黒帯
    const bar = Math.min(1, k * 6, (1 - k) * 6) * 26;
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.fillRect(-a.W, -a.H, a.W * 3, a.H + bar);
    ctx.fillRect(-a.W, a.H - bar, a.W * 3, a.H + bar);
    ctx.restore();
    // 十字の斬撃
    const s = win(k, 0.15, 0.4);
    if (s > 0) {
        ctx.save();
        const cx = a.body.x + 4, cy = a.body.y - 10, L = 90;
        ctx.globalAlpha = 1 - win(k, 0.6, 1);
        for (const [dx, dy] of [[1, 1], [1, -1]]) {
            const t = dx === dy ? s : clamp01(s * 1.4 - 0.4);
            ctx.strokeStyle = '#ffb000';
            ctx.lineWidth = 7;
            ctx.beginPath();
            ctx.moveTo(cx - L * dx, cy - L * dy * 0.6);
            ctx.lineTo(cx - L * dx + 2 * L * dx * t, cy - L * dy * 0.6 + 2 * L * dy * 0.6 * t);
            ctx.stroke();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.5;
            ctx.stroke();
        }
        ctx.restore();
    }
    flash(a, bump(k, 0.12, 0.22), '#fff6c8', 0.7);
    // 技名（正解したキャラの答え）
    const own = hitters.find((v) => v.mine);
    const name = own ? own.excerpt.replace(/[「」]/g, '').split(/[：:]/)[0].slice(0, 10) : tl('奥義');
    const el = /^([炎氷雷風光闇])・/.exec(name)?.[1];
    if (el)
        elementStrike(a, el, win(k, 0.3, 0.9));
    text(ctx, name, a.W / 2 + 20, a.H / 2 - 50, R(18 + 6 * bump(k, 0.15, 0.45)), '#ffd166', Math.min(1, k * 5, (1 - k) * 4), '#5a2a00');
}
// ---- 幻術: 偉い者を名乗る巨大な影の声 → 結界で弾く / 聞いてしまうと惑わされる ----
function illusionFx(a) {
    const { ctx, phase: p } = a;
    const k = win(p, 0.02, 0.14) * (1 - win(p, 0.5, 0.64));
    if (k <= 0)
        return;
    vignette(a, 'rgba(90,30,150,0.75)', k);
    // 揺らぐ横線（ゆがみ）
    ctx.save();
    for (let i = 0; i < 10; i++) {
        const y = ((i * 23 + a.frame * 2) % a.H);
        ctx.globalAlpha = k * 0.15;
        ctx.fillStyle = '#d0a0ff';
        ctx.fillRect(R(Math.sin(a.frame / 5 + i) * 10), y, a.W, 1);
    }
    ctx.restore();
    // 王冠をかぶった巨大な影
    const cx = a.W * 0.6, cy = 42 + Math.sin(a.frame / 8) * 2;
    ctx.save();
    ctx.globalAlpha = k * 0.75;
    ctx.fillStyle = '#2a0a4a';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 10, 30, 26, 0, 0, TAU);
    ctx.fill();
    ctx.fillRect(cx - 50, cy + 28, 100, 30);
    ctx.fillStyle = '#d8b84a';
    ctx.beginPath();
    ctx.moveTo(cx - 20, cy - 10);
    ctx.lineTo(cx - 20, cy - 24);
    ctx.lineTo(cx - 10, cy - 16);
    ctx.lineTo(cx, cy - 28);
    ctx.lineTo(cx + 10, cy - 16);
    ctx.lineTo(cx + 20, cy - 24);
    ctx.lineTo(cx + 20, cy - 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff4fff';
    ctx.fillRect(R(cx - 12), R(cy + 6), 6, 3);
    ctx.fillRect(R(cx + 6), R(cy + 6), 6, 3);
    ctx.restore();
    // 命令の声（ギザギザの吹き出し）
    const say0 = a.title.replace(/[？?]$/, '');
    const say = /命令|伝令|勅令|声|だ$/.test(say0) ? say0 : tl(`{0}の命令だ`, say0);
    text(ctx, tl(`「{0}…！」`, say), cx, cy + 50, 9, '#f0d0ff', k * bump(p, 0.06, 0.48) * 1.5, '#2a0a4a');
    // 声の波が隊列へ
    const wv = win(p, 0.12, 0.42);
    for (const v of alive(a)) {
        const guarded = v.tools.includes('guardrail');
        ctx.save();
        for (let i = 0; i < 3; i++) {
            const t = clamp01(wv * 1.4 - i * 0.15);
            if (t <= 0 || t >= 1)
                continue;
            const x = lerp(cx, v.x, guarded ? Math.min(t, 0.82) : t), y = lerp(cy + 40, v.y - 18, guarded ? Math.min(t, 0.82) : t);
            ctx.globalAlpha = (1 - t) * 0.9;
            ctx.strokeStyle = '#d07bff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(x, y, 4 + t * 4, 0, TAU);
            ctx.stroke();
        }
        ctx.restore();
        if (guarded)
            barrierDome(a, v, bump(p, 0.12, 0.56), win(p, 0.36, 0.5));
        // 自分の冒険者には、偽の声が「文字のかたまり」になって飛んでくる。結界で砕けるか、頭に吸い込まれるか
        if (v.mine)
            voiceGlyphs(a, v, say, cx, cy + 40, guarded);
    }
    const g = alive(a).filter((v) => v.tools.includes('guardrail'));
    if (g.length)
        text(ctx, tl(`結界が幻術を弾いた！（{0}人）`, g.length), a.W * 0.62, 196, 9, '#d8fff6', bump(p, 0.34, 0.6), '#0a2a3a');
    const c = alive(a).filter((v) => v.charmed);
    if (c.length)
        text(ctx, tl(`幻術が耳に届いた…（{0}人）`, c.length), a.W * 0.62, 184, 8, '#f0d0ff', bump(p, 0.36, 0.62), '#2a0a4a');
}
// 偽の声の文字が1文字ずつ飛んでくる → 0.36 で結界に当たって砕け散る ／ 結界がなければ渦を巻いて頭に吸い込まれる
function voiceGlyphs(a, v, say, sx, sy, guarded) {
    const { ctx, phase: p } = a;
    const chars = [...say].slice(0, 10);
    const HIT = 0.36;
    const tx = v.x - (guarded ? 20 : 0), ty = v.y - (guarded ? 16 : 24);
    ctx.save();
    ctx.font = `bold 9px ${PIXEL_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const rng = new Rng(`glyph:${a.seed}:${v.f}`);
    chars.forEach((ch, i) => {
        const t0 = 0.14 + i * 0.012, t = (p - t0) / (HIT - t0);
        const vx = rng.range(-1, 1), vy = rng.range(-1.2, -0.2), spin = rng.range(-6, 6);
        if (t < 0)
            return;
        let x, y, rot = 0, alpha = 1, scale = 1;
        if (t < 1) { // 飛んでくる（少し波打ちながら）
            const e = t * t;
            x = lerp(sx, tx, e) + Math.sin(t * 9 + i) * 3;
            y = lerp(sy, ty, e) + Math.cos(t * 7 + i) * 3 - Math.sin(t * Math.PI) * 14;
            rot = Math.sin(t * 6 + i) * 0.3;
        }
        else if (guarded) { // 結界に当たって砕け散る
            const k = clamp01((p - HIT) / 0.12);
            if (k >= 1)
                return;
            x = tx + vx * 30 * k - 6;
            y = ty + vy * 26 * k + k * k * 22;
            rot = spin * k;
            alpha = 1 - k;
            scale = 1 - k * 0.4;
        }
        else { // 渦を巻いて頭に吸い込まれる
            const k = clamp01((p - HIT) / 0.1);
            if (k >= 1)
                return;
            const ang = k * TAU * 1.5 + i, r = (1 - k) * 12;
            x = v.x + Math.cos(ang) * r;
            y = v.y - 30 + Math.sin(ang) * r * 0.5;
            scale = 1 - k * 0.8;
            alpha = 1 - k * 0.6;
        }
        ctx.save();
        ctx.translate(R(x), R(y));
        ctx.rotate(rot);
        ctx.scale(scale, scale);
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#2a0a4a';
        ctx.strokeText(ch, 0, 0);
        ctx.fillStyle = a.frame % 6 < 3 ? '#f0c8ff' : '#ff8ff0';
        ctx.fillText(ch, 0, 0);
        ctx.restore();
    });
    // 当たった瞬間: 結界の波紋 ／ 吸い込まれた瞬間: 紫の閃き
    const k = clamp01((p - HIT) / 0.14);
    if (k > 0 && k < 1) {
        ctx.globalCompositeOperation = 'lighter';
        if (guarded) {
            for (let j = 0; j < 3; j++) {
                const kk = clamp01(k * 1.4 - j * 0.15);
                if (kk <= 0 || kk >= 1)
                    continue;
                ctx.globalAlpha = (1 - kk) * 0.9;
                ctx.strokeStyle = j ? '#7fe0ff' : '#ffffff';
                ctx.lineWidth = 2 - kk;
                ctx.beginPath();
                ctx.ellipse(tx + 4, ty + 2, 4 + kk * 18, 6 + kk * 24, 0, -Math.PI / 2, Math.PI / 2, true);
                ctx.stroke();
            }
            text(ctx, tl('弾いた！'), v.x, v.y - 50 - k * 6, 10, '#d8fff6', 1 - Math.max(0, k - 0.6) / 0.4, '#0a2a3a');
        }
        else {
            ctx.globalAlpha = (1 - k) * 0.8;
            ctx.fillStyle = '#c050ff';
            ctx.beginPath();
            ctx.arc(v.x, v.y - 24, 6 + k * 10, 0, TAU);
            ctx.fill();
            text(ctx, tl('聞いてしまった…'), v.x, v.y - 50 - k * 6, 9, '#f0d0ff', 1 - Math.max(0, k - 0.6) / 0.4, '#2a0a4a');
        }
    }
    ctx.restore();
}
function barrierDome(a, v, k, crack) {
    if (k <= 0)
        return;
    const { ctx } = a;
    const cx = v.x, cy = v.y - 14, r = 18;
    ctx.save();
    ctx.globalAlpha = k * 0.35;
    ctx.fillStyle = '#7fe0ff';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const t = (i / 6) * TAU + Math.PI / 6;
        const x = cx + Math.cos(t) * r, y = cy + Math.sin(t) * r * 1.15;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = k;
    ctx.strokeStyle = '#d8fff6';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // 六角の網目
    ctx.globalAlpha = k * 0.5;
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 3; i++) {
        const t = (i / 3) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(t) * r, cy + Math.sin(t) * r * 1.15);
        ctx.lineTo(cx - Math.cos(t) * r, cy - Math.sin(t) * r * 1.15);
        ctx.stroke();
    }
    // 弾いた声が砕ける火花
    if (crack > 0 && crack < 1) {
        ctx.globalAlpha = 1 - crack;
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 8; i++) {
            const t = (i / 8) * TAU;
            const d = r + crack * 14;
            ctx.fillRect(R(cx - r * 0.7 + Math.cos(t) * crack * 14), R(cy - r * 0.6 + Math.sin(t) * d * 0.5), 2, 2);
        }
    }
    ctx.restore();
}
function charmFx(a, v) {
    const { ctx, phase: p } = a;
    const k = win(p, 0.3, 0.42);
    if (k <= 0)
        return;
    ctx.save();
    ctx.strokeStyle = '#d07bff';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = k;
    const cx = v.x, cy = v.y - 40;
    ctx.beginPath();
    for (let i = 0; i < 30; i++) {
        const t = i / 30 * TAU * 2 + a.frame / 4;
        const r = i / 30 * 7;
        const x = cx + Math.cos(t) * r, y = cy + Math.sin(t) * r * 0.6;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
}
function hauntFx(a, v) {
    const { ctx } = a;
    for (let i = 0; i < 2; i++) {
        const t = a.frame / 9 + i * Math.PI;
        const x = v.x + Math.cos(t) * 11, y = v.y - 26 + Math.sin(t) * 4;
        ctx.save();
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = '#b57bff';
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.35;
        ctx.fillRect(R(x - 1), R(y + 2), 2, 4);
        ctx.restore();
    }
}
// ---- 記憶: セピアの回想 → 冒険日誌のページがめくれる ----
function memoryFx(a) {
    const { ctx, phase: p } = a;
    const k = win(p, 0.02, 0.12) * (1 - win(p, 0.36, 0.46));
    if (k > 0) {
        ctx.save();
        ctx.globalAlpha = k * 0.35;
        ctx.fillStyle = '#7a5a2a';
        ctx.fillRect(-a.W, -a.H, a.W * 3, a.H * 3);
        ctx.restore();
        vignette(a, 'rgba(40,24,8,0.8)', k);
        // フィルムの傷
        ctx.save();
        ctx.globalAlpha = k * 0.4;
        ctx.fillStyle = '#f0e0c0';
        for (let i = 0; i < 4; i++)
            ctx.fillRect(R(((i * 97 + a.frame * 13) % a.W)), 0, 1, a.H);
        ctx.restore();
        text(ctx, tl('― あのときと同じだ ―'), a.W / 2, 26, 9, '#f0e0c0', k, '#3a2408');
    }
    for (const v of alive(a)) {
        if (!v.tools.includes('memory'))
            continue;
        const u = bump(p, 0.1, 0.48);
        if (u <= 0)
            continue;
        const bx = v.x, by = v.y - 44;
        ctx.save();
        ctx.globalAlpha = u;
        ctx.fillStyle = '#6a3a1a';
        ctx.fillRect(R(bx - 10), R(by - 1), 20, 12);
        ctx.fillStyle = '#f4e8c8';
        ctx.fillRect(R(bx - 9), R(by), 8, 10);
        ctx.fillRect(R(bx + 1), R(by), 8, 10);
        // めくれるページ
        const flip = (p * 12) % 1;
        ctx.fillStyle = '#ffffff';
        const pw = Math.cos(flip * Math.PI) * 8;
        ctx.fillRect(R(bx + Math.min(0, pw)), R(by), R(Math.abs(pw)), 10);
        ctx.fillStyle = '#9a7a5a';
        for (let i = 0; i < 4; i++) {
            ctx.fillRect(R(bx - 8), R(by + 2 + i * 2), 6, 1);
            ctx.fillRect(R(bx + 2), R(by + 2 + i * 2), 6, 1);
        }
        ctx.restore();
    }
}
// ---- 仲間の声: 横から駆けつける仲間と吹き出し。結界で弾いてしまうと声が消える ----
// 仲間の声の主: 場面の題名（「王都の僧侶の声」など）から見た目を選ぶ
function allyLook(title) {
    const t = title;
    if (/僧侶|司祭|薬師/.test(t))
        return { body: 'priest', palette: '#ece9f6', hair: '#feae34', weapon: 'book' };
    if (/騎士|隊長/.test(t))
        return { body: 'knight', palette: '#3a7bd5', hair: '#f2c14e', weapon: 'sword' };
    if (/甲板|船|少年/.test(t))
        return { body: 'pirate', palette: '#a0612a', hair: '#e43b44', weapon: 'katana' };
    if (/猟師|狩人|見張り/.test(t))
        return { body: 'rogue', palette: '#3f7d3a', hair: '#7a4a2a', weapon: 'bow' };
    if (/見習い/.test(t))
        return { body: 'bunny', palette: '#ffffff', hair: '#ff9ce6', weapon: 'wand' };
    if (/測量|考古|ラクダ/.test(t))
        return { body: 'mage', palette: '#c89a52', hair: '#5a3d25', weapon: 'book' };
    if (/犬ぞり/.test(t))
        return { body: 'bear', palette: '#a0612a', hair: '#ffd166', weapon: 'spear' };
    return { body: 'knight', palette: '#63c74d', hair: '#f2c14e', weapon: 'sword' };
}
// 吹き出し（白地に黒縁、しっぽは右下へ）
function bubble(ctx, s, x, y, k) {
    if (k <= 0)
        return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 1.5);
    ctx.font = `bold 9px ${PIXEL_FONT}`;
    const w = Math.ceil(ctx.measureText(s).width) + 12, h = 15;
    const bx = R(x - w / 2), by = R(y - h);
    ctx.fillStyle = '#14101e';
    ctx.fillRect(bx - 1, by - 1, w + 2, h + 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx, by, w, h);
    ctx.fillStyle = '#14101e';
    ctx.fillRect(bx + w - 12, by + h + 1, 4, 2);
    ctx.fillRect(bx + w - 10, by + h + 3, 3, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx + w - 11, by + h, 3, 2);
    ctx.fillStyle = '#14101e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s, bx + w / 2, by + h / 2 + 1);
    ctx.restore();
}
function allyFx(a) {
    const { ctx, phase: p } = a;
    const k = win(p, 0.02, 0.12) * (1 - win(p, 0.42, 0.52));
    if (k <= 0)
        return;
    // 画面の右端から駆け込んで立ち止まり、ボスのほうを向いて叫ぶ
    const run = ease(win(p, 0.02, 0.12));
    const x = lerp(a.W + 24, a.W - 30, run), y = 200;
    const name = a.title.replace(/の声$/, '');
    const look = allyLook(a.title);
    ctx.save();
    ctx.globalAlpha = k;
    // 足元の影と、叫ぶ瞬間の集中線
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + 1, 9, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    const shout = bump(p, 0.12, 0.3);
    if (shout > 0) {
        ctx.strokeStyle = `rgba(200,255,216,${0.8 * shout})`;
        ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
            const ang = Math.PI * (0.85 + i * 0.1), r0 = 18, r1 = 26 + 4 * shout;
            ctx.beginPath();
            ctx.moveTo(x - 4 + Math.cos(ang) * r0, y - 22 + Math.sin(ang) * r0);
            ctx.lineTo(x - 4 + Math.cos(ang) * r1, y - 22 + Math.sin(ang) * r1);
            ctx.stroke();
        }
    }
    drawHero(ctx, look, { back: [], fams: [], charms: [] }, x, y, { frame: a.frame, flip: true, action: run < 1 ? 'walk' : shout > 0.3 ? 'victory' : 'idle', t: (a.frame % 30) / 30 });
    ctx.restore();
    // 名札と吹き出し
    text(ctx, name, x, y + 9, 7, '#c8ffd8', k, '#0a3a1a');
    bubble(ctx, tl('来るぞ！'), x - 18, y - 34, win(p, 0.1, 0.16) * (1 - win(p, 0.42, 0.52)));
    const blocked = alive(a).filter((v) => v.tools.includes('guardrail'));
    for (const v of blocked)
        barrierDome(a, v, bump(p, 0.1, 0.5), win(p, 0.24, 0.4));
    if (blocked.length)
        text(ctx, tl(`結界が、仲間の声まで弾いてしまった…（{0}人）`, blocked.length), a.W * 0.6, 30, 8, '#c8c8d8', bump(p, 0.18, 0.5));
}
// ============ 画面上部のバナー（画面座標で呼ぶ） ============
export function sceneBanner(ctx, scene, title, phase, W, head, color) {
    const k = Math.min(1, phase / 0.03, (0.25 - phase) / 0.03);
    if (k <= 0)
        return;
    const L = { ...SCENE_LABEL[scene], ...(color ? { color } : {}) };
    const slide = ease(clamp01(phase / 0.05));
    ctx.save();
    ctx.globalAlpha = k;
    const h = 26, y = 27; // ボスの体力の下。冒険者の頭上（決め手の道具が浮かぶ高さ）にかからない
    const x = lerp(-W, 0, slide);
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, 'rgba(10,8,20,0)');
    g.addColorStop(0.2, 'rgba(10,8,20,0.9)');
    g.addColorStop(0.8, 'rgba(10,8,20,0.9)');
    g.addColorStop(1, 'rgba(10,8,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, W, h);
    ctx.fillStyle = L.color;
    ctx.fillRect(x + W * 0.15, y, W * 0.7, 1);
    ctx.fillRect(x + W * 0.15, y + h - 1, W * 0.7, 1);
    ctx.restore();
    text(ctx, head ?? L.head, x + W / 2, y + 9, 12, L.color, k);
    text(ctx, title, x + W / 2, y + 20, 7, '#ffffff', k);
}
// ======================================================================
// 巻物の大技カウンター（ougi 跳躍落下斬り / rush 乱舞 / summon 召喚）
// 巻物が要る場面（ボスの大技）でだけ使う。流れはどれも同じ:
//   0.02〜0.42 ボスが大技を溜める（赤いオーラ・溜めのゲージ）→ 0.08〜0.3 必殺技カットイン（arena）
//   → 主役（自分のキャラを優先）の大技 → ボスの大技を潰す。巻物を持たず外したキャラは 0.42 に大技をくらって吹き飛ぶ
// ======================================================================
export const ULT_T = {
    ougi: { crouch: 0.3, jump: 0.36, hush: 0.4, fall: 0.48, impact: 0.5, land: 0.62, home: 0.72 },
    rush: { ready: 0.3, go: 0.35, first: 0.37, pass: 0.03, n: 8, finish: 0.63, burst: 0.65, home: 0.78 },
    summon: { circle: 0.28, split: 0.36, descend: 0.4, plunge: 0.52, impact: 0.54, home: 0.72 },
    // 返し技: ボスの大技の正面へ踏みこみ、受け止めた瞬間に時が止まり、跳ね返す
    parry: { ready: 0.3, step: 0.35, guard: 0.4, clash: 0.43, freeze: 0.5, strike: 0.52, hit: 0.56, home: 0.74 },
    // 封印: ボスの足元に封印陣 → 光の鎖が絡みつく → 軋む → 武器の型で打ちこんで封じ砕く
    seal: { circle: 0.28, chain: 0.34, bind: 0.44, strain: 0.5, drive: 0.54, hit: 0.58, home: 0.76 },
    // 覚醒: 気を解き放って姿が変わる → 残像だけを残して駆け抜ける → 斬撃は遅れてやってくる
    awaken: { ready: 0.3, flare: 0.34, hold: 0.44, blink: 0.47, land: 0.5, hit: 0.53, home: 0.75 },
};
const RELEASE = 0.42; // ボスの大技が放たれる（外したキャラに当たる）
export const ultHitT = (s) => ({ ougi: ULT_T.ougi.impact, rush: ULT_T.rush.burst, summon: ULT_T.summon.impact, parry: ULT_T.parry.hit, seal: ULT_T.seal.hit, awaken: ULT_T.awaken.hit })[s];
// 技の名前を出しはじめる時刻（場面ごと）
export const ultNameT = (s) => ({ ougi: ULT_T.ougi.crouch, rush: ULT_T.rush.go, summon: ULT_T.summon.split, parry: ULT_T.parry.ready, seal: ULT_T.seal.circle, awaken: ULT_T.awaken.ready })[s];
const ougiLand = (foot) => ({ x: foot.x + 34, y: foot.y + 6 });
const ougiSky = (body, land) => ({ x: land.x + 30, y: body.y - 46 }); // 射手・魔法使いが浮かぶ空の位置（足元）
const rushFinish = (foot) => ({ x: foot.x + 52, y: foot.y + 4 });
// 武器 → 必殺技の型と、場面ごとの技名（ougi=跳躍落下斬り / rush=乱舞 / summon=召喚）
export const ULT_ART = {
    sword: { style: 'blade', rush: tl('蒼天裂き・八連の聖剣舞'), ougi: tl('聖剣解放・天墜の一閃'), summon: tl('顕現せよ、星穹の聖剣') },
    katana: { style: 'blade', rush: tl('月影・八艘飛び'), ougi: tl('月下一閃・天墜'), summon: tl('顕現・百鬼を断つ天ノ太刀') },
    dagger: { style: 'blade', rush: tl('影縫い・八連の夜想曲'), ougi: tl('暗殺奥義・落星の五連突き'), summon: tl('千影降臨・無数の暗刃') },
    scythe: { style: 'heavy', rush: tl('死神の八連輪舞'), ougi: tl('断罪の月鎌・堕天'), summon: tl('冥府より来たれ、終焉の大鎌') },
    axe: { style: 'heavy', rush: tl('大地烈断・八連'), ougi: tl('蒼天割り・竜断ちの大斧'), summon: tl('降臨せよ、巨神の戦斧') },
    hammer: { style: 'heavy', rush: tl('轟雷・八連砕き'), ougi: tl('雷神の鉄槌・天地鳴動'), summon: tl('顕現せよ、神話の戦鎚') },
    pan: { style: 'heavy', rush: tl('八連・黄金の目玉焼き無双'), ougi: tl('鉄鍋奥義・天地返し'), summon: tl('厨房の神よ、降臨せよ！') },
    shield: { style: 'heavy', rush: tl('聖盾・八連突撃'), ougi: tl('聖壁突貫・天墜シールドバッシュ'), summon: tl('顕現せよ、不落の大聖盾') },
    umbrella: { style: 'heavy', rush: tl('八連・こうもり旋風'), ougi: tl('雨傘奥義・天墜の大輪'), summon: tl('雨天来たれ、大傘の祝福') },
    spear: { style: 'pierce', rush: tl('百烈穿天・八連の槍舞'), ougi: tl('竜騎士の蒼穹・天墜貫き'), summon: tl('顕現せよ、神槍グングニル') },
    bow: { style: 'shot', rush: tl('八連・流星群の矢'), ougi: tl('天弓一射・星墜とし'), summon: tl('天空の大弓よ、星を穿て') },
    blaster: { style: 'shot', rush: tl('八連・フルバースト'), ougi: tl('最終兵器・オービタルレイ'), summon: tl('衛星砲、展開！') },
    wand: { style: 'magic', rush: tl('八重詠唱・極光砲'), ougi: tl('星天の詠唱・流星召喚'), summon: tl('万象の杖よ、天より審判を') },
    book: { style: 'magic', rush: tl('八頁解放・星詠みの光'), ougi: tl('禁書解放・天より堕ちる光'), summon: tl('禁断の魔導書、顕現せよ') },
    fan: { style: 'magic', rush: tl('八重・嵐扇の舞'), ougi: tl('風神の舞・天翔ける暴風'), summon: tl('天扇来たれ、神風の大嵐') },
    guitar: { style: 'magic', rush: tl('八重奏・咆哮のビーム'), ougi: tl('魂のソロ・天翔けるリフ'), summon: tl('伝説の弦よ、天に響け') },
};
// 返し技・封印・覚醒の技名（武器ごと）
export const ULT_NAMES2 = {
    sword: { parry: tl('聖剣返し・蒼き反撃の刃'), seal: tl('聖剣八封・光の断罪陣'), awaken: tl('覚醒・聖剣の目覚め、蒼天を翔ける') },
    katana: { parry: tl('無明剣・居合返し'), seal: tl('封魔・千本桜刃'), awaken: tl('限界突破・神速の一太刀') },
    dagger: { parry: tl('影返し・刹那の逆刃'), seal: tl('影縫いの縛鎖・暗刃の檻'), awaken: tl('影化・音を置き去りにする刃') },
    scythe: { parry: tl('死神の応報・鎌返し'), seal: tl('魂縛・冥府の大鎖'), awaken: tl('死神覚醒・魂刈りの極致') },
    axe: { parry: tl('大地返し・烈斧の反撃'), seal: tl('岩牢封じ・巨神の楔'), awaken: tl('狂戦士覚醒・大地を揺るがす咆哮') },
    hammer: { parry: tl('鉄壁返し・雷槌の逆襲'), seal: tl('鉄鎖封印・雷鳴の楔打ち'), awaken: tl('雷神覚醒・轟雷纏い') },
    pan: { parry: tl('鉄鍋返し・熱々リフレクト'), seal: tl('封印のフタ・鉄鍋大蒸し'), awaken: tl('厨房覚醒・究極の火力') },
    shield: { parry: tl('絶対防壁・聖盾反射'), seal: tl('聖盾結界・不動の檻'), awaken: tl('不屈覚醒・聖盾の怒り') },
    umbrella: { parry: tl('雨傘返し・晴れ間の反撃'), seal: tl('傘の結界・雨天封縛'), awaken: tl('傘神覚醒・暴風雨の化身') },
    spear: { parry: tl('見切り穿ち・逆鱗の一突き'), seal: tl('光槍縫い・神罰の貫き縛り'), awaken: tl('竜騎覚醒・蒼穹を貫く閃光') },
    bow: { parry: tl('風読み・矢返しの妙技'), seal: tl('縛矢の雨・星の鎖'), awaken: tl('星読み覚醒・百発百中の極意') },
    blaster: { parry: tl('反射障壁・リフレクトレイ'), seal: tl('拘束ビーム・ロックオンバインド'), awaken: tl('暴走覚醒・オーバードライブ') },
    wand: { parry: tl('魔鏡の障壁・返咒'), seal: tl('天鎖封陣・永劫の戒め'), awaken: tl('魔力覚醒・無限詠唱の領域') },
    book: { parry: tl('禁書の頁・反転詠唱'), seal: tl('禁書封印・頁の牢獄'), awaken: tl('禁書覚醒・全知の頁') },
    fan: { parry: tl('風神返し・扇の舞'), seal: tl('風縛陣・嵐の檻'), awaken: tl('風神覚醒・千里を舞う嵐') },
    guitar: { parry: tl('音の壁・共鳴リバーブ'), seal: tl('共鳴封縛・弦の鎖'), awaken: tl('魂覚醒・伝説のライブ') },
};
export const ultName = (scene, w) => {
    const u = ultArt(w), n = ULT_NAMES2[w ?? 'sword'] ?? ULT_NAMES2.sword;
    return scene === 'rush' ? u.rush : scene === 'ougi' ? u.ougi : scene === 'summon' ? u.summon : n[scene];
};
export const ultArt = (w) => ULT_ART[w ?? 'sword'] ?? ULT_ART.sword;
export const rushArt = (w) => { const u = ultArt(w); return { style: u.style, name: u.rush }; };
const RUSH_COL = {
    blade: ['#7fe0ff', '#ff6bd6'], heavy: ['#ffb04a', '#ffe27a'], pierce: ['#8dffb0', '#e8fff0'], shot: ['#ffe27a', '#7fe0ff'], magic: ['#c77dff', '#7fe0ff'],
};
const rushCenter = (body) => ({ x: body.x + 2, y: body.y + 14 }); // 足元の位置（体の中心がボスの胴を通る）
const frontSpot = (body) => ({ x: body.x + 64, y: body.y + 16 }); // ボスの正面（返し技・封印の立ち位置）
const awakenEnd = (body) => ({ x: body.x - 62, y: body.y + 18 }); // 覚醒で駆け抜けた先
const magicSpot = (body) => ({ x: body.x + 70, y: body.y + 16 }); // 詠唱の立ち位置（ボスの正面）
const TQ = Math.PI * 2;
function rushSteps(style, foot, body) {
    const c = rushCenter(body), fin = rushFinish(foot);
    const S = (a, b, o = {}) => ({
        a: { x: c.x + a[0], y: c.y + a[1] }, b: b === 'fin' ? fin : { x: c.x + b[0], y: c.y + b[1] }, h0: 0, h1: 0, arc: 0, spin: 0, fx: 'cut', ang: 0, act: 'dash', ...o,
    });
    switch (style) {
        case 'blade': return [
            S([64, 4], [-60, -8], { arc: 6, ang: 0.1 }), // 低く斬り抜ける
            S([-60, -8], [58, 6], { arc: 46, spin: -TQ, ang: 0.9 }), // 頭上を跳び越え、宙返りで斬り下ろす
            S([58, 6], [-48, -10], { h1: 14, arc: 10, ang: -0.7 }), // 斬り上げ
            S([-48, -10], [8, 2], { h0: 14, h1: 62, arc: 8, ang: 0 }), // 空へ舞い上がる
            S([8, 2], [-46, 14], { h0: 62, arc: 0, ang: 1.2 }), // 急降下の斬り
            S([-46, 14], [40, 18], { spin: TQ * 2, fx: 'whirl', ang: 0 }), // 回転斬り
            S([40, 18], [-56, -6], { arc: 30, ang: -0.35 }),
            S([-56, -6], 'fin', { arc: 70, spin: -TQ, ang: 1.5 }), // 大ジャンプの斬り下ろしで締める
        ];
        case 'heavy': return [
            S([64, 4], [26, 4], { arc: 12, fx: 'smash', ang: 1.57 }),
            S([26, 4], [-26, 10], { arc: 6, spin: TQ, fx: 'whirl' }),
            S([-26, 10], [26, 4], { arc: 6, spin: -TQ, fx: 'whirl' }),
            S([26, 4], [-40, 0], { h1: 30, arc: 6, fx: 'smash', ang: -1.2 }), // 打ち上げ
            S([-40, 0], [34, 8], { h0: 30, arc: 24, spin: TQ, fx: 'smash', ang: 1.57 }), // 落下の叩きつけ
            S([34, 8], [-12, 4], { arc: 8, spin: TQ, fx: 'whirl' }),
            S([-12, 4], [6, 8], { h1: 54, arc: 6, fx: 'smash', ang: -1.57 }),
            S([6, 8], 'fin', { h0: 54, fx: 'smash', ang: 1.57 }), // 大ジャンプの大地割り
        ];
        case 'pierce': return [
            S([84, 2], [36, 2], { fx: 'thrust' }),
            S([36, 2], [30, -10], { arc: 22, fx: 'thrust' }),
            S([30, -10], [34, 14], { arc: 8, fx: 'thrust' }),
            S([34, 14], [-64, 6], { arc: 8, fx: 'thrust' }), // ボスを貫いて駆け抜ける
            S([-64, 6], [-34, 2], { fx: 'thrust' }),
            S([-34, 2], [-30, 12], { arc: 22, fx: 'thrust' }),
            S([-30, 12], [60, 4], { arc: 10, fx: 'thrust' }),
            S([60, 4], 'fin', { arc: 34, fx: 'thrust' }), // 跳びこみの大突き
        ];
        case 'shot': return [
            S([70, 2], [96, 2], { arc: 26, spin: -TQ, fx: 'shot', act: 'attack' }), // 後ろ宙返りしながら撃つ
            S([96, 2], [80, -16], { arc: 8, fx: 'shot', act: 'attack' }),
            S([80, -16], [100, 14], { arc: 18, fx: 'shot', act: 'attack' }),
            S([100, 14], [66, 8], { arc: 30, spin: TQ, fx: 'shot', act: 'attack' }),
            S([66, 8], [90, -8], { arc: 12, fx: 'shot', act: 'attack' }),
            S([90, -8], [76, 16], { arc: 24, spin: -TQ, fx: 'shot', act: 'attack' }),
            S([76, 16], [92, 0], { h1: 46, arc: 6, fx: 'shot', act: 'attack' }), // 高く跳んで
            S([92, 0], 'fin', { h0: 46, fx: 'shot', act: 'attack' }), // 降りながら撃ち尽くす
        ];
        default: return Array.from({ length: ULT_T.rush.n }, () => S([magicSpot(body).x - c.x, magicSpot(body).y - c.y], [magicSpot(body).x - c.x, magicSpot(body).y - c.y], { fx: 'cast' }));
    }
}
// 一手の途中（m: 0〜1、なめらか済み）の位置。高さぶん上にずれる
function stepAt(s, m) {
    const h = lerp(s.h0, s.h1, m) + Math.sin(Math.PI * m) * s.arc;
    return { x: lerp(s.a.x, s.b.x, m), y: lerp(s.a.y, s.b.y, m) - h };
}
// 斬撃線（ボスの胴を通る線。一手ごとに角度と位置が少しずつちがう）
function cutLine(body, s, i) {
    const dir = s.b.x < s.a.x ? -1 : s.b.x > s.a.x ? 1 : -1;
    const vx = dir * Math.cos(s.ang), vy = Math.sin(s.ang), L = 56;
    const cx = body.x + 2 + ((i % 3) - 1) * 5, cy = body.y + 2 + (((i * 5) % 7) - 3) * 3;
    return { x0: cx - vx * L, y0: cy - vy * L, x1: cx + vx * L, y1: cy + vy * L, cx, cy };
}
// 主役のキャラの動き（自分の立ち位置からのずれ）。null なら普段どおり
export function ultPose(scene, p, home, foot, body, frame, weapon) {
    const base = { ox: 0, oy: 0, action: 'idle', t: 0, rot: 0, alpha: 1, flip: true, ghosts: [] };
    const at = (q, extra = {}) => ({ ...base, ox: q.x - home.x, oy: q.y - home.y, ...extra });
    const trail = (q, k, n, step, a0) => Array.from({ length: n }, (_, j) => { const g = q(Math.max(0, k - (j + 1) * step)); return { x: g.x - home.x, y: g.y - home.y, a: a0 / (j + 1) }; });
    if (scene === 'ougi') {
        const T = ULT_T.ougi, land = ougiLand(foot), style = ultArt(weapon).style, air = style === 'shot' || style === 'magic';
        if (p < T.crouch - 0.02 || p >= T.home)
            return null;
        if (p < T.jump) { // 屈んで溜める（小刻みに震える）
            const k = win(p, T.crouch - 0.02, T.jump);
            return { ...base, ox: Math.sin(frame * 1.7) * 0.7 * k, oy: 3.5 * ease(k), action: air && style === 'magic' ? 'cast' : 'guard', t: k };
        }
        const up = (u) => 1 - (1 - u) * (1 - u);
        if (air) { // 射手と魔法使いは、空へ舞い上がってそこから撃つ（姿は見えたまま）
            const sky = ougiSky(body, land);
            const act = style === 'shot' ? 'attack' : 'cast';
            if (p < T.fall) {
                const k = win(p, T.jump, T.hush), q = (u) => ({ x: lerp(home.x, sky.x, up(u)), y: lerp(home.y, sky.y, up(u)) });
                return at(q(k), { action: k < 1 ? 'dash' : act, t: 0.2, ghosts: k < 1 ? trail(q, k, 4, 0.09, 0.4) : [] });
            }
            if (p < T.impact) {
                const k = win(p, T.fall, T.impact);
                return at({ x: sky.x + (style === 'shot' ? -2 * k : 0), y: sky.y + Math.sin(frame / 5) * 0.8 }, { action: act, t: style === 'shot' ? 0.3 + 0.5 * k : 0.5 });
            }
            if (p < T.land) {
                const k = win(p, T.impact, T.land);
                return at({ x: lerp(sky.x, land.x, ease(k)), y: lerp(sky.y, land.y, ease(k)) }, { action: act, t: 0.85 });
            }
        }
        else {
            const sky = { x: home.x + (land.x - home.x) * 0.35, y: -110 };
            if (p < T.hush) { // 大ジャンプで画面の上へ消える（残像）
                const k = win(p, T.jump, T.hush);
                const q = (u) => ({ x: lerp(home.x, sky.x, up(u)), y: lerp(home.y, sky.y, up(u)) });
                return at(q(k), { action: 'dash', rot: -0.3 * k, ghosts: trail(q, k, 4, 0.09, 0.4) });
            }
            if (p < T.fall)
                return { ...base, alpha: 0 }; // 画面の外（静寂）
            if (p < T.impact) { // 上空から急降下（大斧は回りながら、槍は斜めに頭から突っこむ）
                const k = win(p, T.fall, T.impact);
                const top = style === 'pierce' ? { x: land.x + 92, y: -70 } : style === 'heavy' ? { x: land.x + 8, y: -50 } : { x: land.x + 26, y: -40 };
                const q = (u) => ({ x: lerp(top.x, land.x, u * u), y: lerp(top.y, land.y, u * u) });
                const rot = style === 'heavy' ? Math.PI * 4 * k : style === 'pierce' ? -1.35 : 0;
                return at(q(k), { action: 'attack', t: 0.15 + 0.5 * k, rot, ghosts: trail(q, k, 3, 0.12, 0.45) });
            }
            if (p < T.land)
                return at({ x: land.x, y: land.y + 2 * (1 - win(p, T.impact, T.impact + 0.04)) }, { action: 'attack', t: 0.85 }); // 着地の残心
        }
        const k = win(p, T.land, T.home); // 跳んで元の位置へ
        return at({ x: lerp(land.x, home.x, ease(k)), y: lerp(land.y, home.y, ease(k)) - Math.sin(k * Math.PI) * 24 }, { action: 'dash', flip: false });
    }
    if (scene === 'rush') {
        const T = ULT_T.rush, style = rushArt(weapon).style, mag = style === 'magic';
        const steps = rushSteps(style, foot, body), fin = rushFinish(foot), spot = magicSpot(body), c = rushCenter(body);
        const start = mag ? spot : steps[0].a, end = mag ? spot : fin;
        if (p < T.ready - 0.02 || p >= T.home)
            return null;
        if (p < T.go) {
            const k = win(p, T.ready - 0.02, T.go);
            return { ...base, oy: 2.5 * ease(k), ox: 3 * ease(k), action: mag ? 'cast' : 'guard', t: k };
        }
        if (p < T.first) { // 最初の位置へ踏み込む（詠唱の人は、ボスの正面へ歩み出る）
            const k = win(p, T.go, T.first), q = (u) => ({ x: lerp(home.x, start.x, u * u), y: lerp(home.y, start.y, u * u) });
            return at(q(k), { action: 'dash', ghosts: trail(q, k, 3, 0.15, 0.35) });
        }
        const i = Math.floor((p - T.first) / T.pass);
        if (mag) { // 八重詠唱: その場で浮いて、詠唱のたびに残像の分身が増える（分身も同じ詠唱をしている）
            if (p >= T.burst + 0.03) {
                const k = win(p, T.burst + 0.03, T.home);
                return at({ x: lerp(spot.x, home.x, ease(k)), y: lerp(spot.y, home.y, ease(k)) - Math.sin(k * Math.PI) * 14 }, { action: 'dash', flip: false });
            }
            const n = clamp01((p - T.first) / (T.n * T.pass)) * T.n, lift = win(p, T.first, T.first + 0.05);
            const hover = -(5 + Math.sin(frame / 7) * 1.5) * ease(lift);
            const ghosts = Array.from({ length: Math.min(T.n - 1, Math.floor(n)) }, (_, j) => ({
                x: 8 + Math.floor(j / 2) * 8 + Math.sin(frame / 9 + j) * 1.5, y: (j % 2 ? -8 : 7) + hover + Math.cos(frame / 8 + j * 2) * 1.5, a: 0.34 - j * 0.02, act: 'cast',
            }));
            return at({ x: spot.x, y: spot.y + hover }, { action: 'cast', t: 0.5 + 0.5 * Math.sin(frame / 5), ghosts });
        }
        if (i < T.n) { // 一手ごとに、動く → 一撃（動きは速く、少し止まる）
            const s = steps[i], u = (p - T.first - i * T.pass) / T.pass, mv = clamp01(u / 0.55), m = ease(mv);
            const q = (mm) => stepAt(s, ease(mm));
            const shoot = s.act === 'attack' && mv < 1;
            return at(q(mv), {
                action: shoot ? 'attack' : m < 1 ? 'dash' : 'attack', t: shoot ? 0.25 + 0.6 * mv : m < 1 ? 0 : 0.75, flip: s.a.x > c.x,
                rot: mv < 1 ? s.spin * m : 0, ghosts: trail(q, mv, s.spin ? 5 : 4, 0.14, m < 1 ? 0.42 : 0.2),
            });
        }
        if (p < T.burst + 0.03)
            return at(end, { action: 'attack', t: 0.9 }); // 残心 → 一斉に爆ぜる
        const k = win(p, T.burst + 0.03, T.home);
        return at({ x: lerp(end.x, home.x, ease(k)), y: lerp(end.y, home.y, ease(k)) - Math.sin(k * Math.PI) * 14 }, { action: 'dash', flip: false });
    }
    if (scene === 'parry') { // 返し技: 踏みこんで受け止める → 時が止まる → 武器の型で打ち返す
        const T = ULT_T.parry, style = ultArt(weapon).style, fr = frontSpot(body), c = rushCenter(body);
        if (p < T.ready - 0.02 || p >= T.home)
            return null;
        if (p < T.step) {
            const k = win(p, T.ready - 0.02, T.step);
            return { ...base, oy: 2.5 * ease(k), ox: 2 * ease(k), action: 'guard', t: k };
        }
        if (p < T.guard) {
            const k = win(p, T.step, T.guard), q = (u) => ({ x: lerp(home.x, fr.x, ease(u)), y: lerp(home.y, fr.y, ease(u)) });
            return at(q(k), { action: 'dash', ghosts: trail(q, k, 4, 0.14, 0.4) });
        }
        const push = 6 * bump(p, T.clash, T.clash + 0.04); // 受け止めた衝撃で、じりっと押される
        if (p < T.strike)
            return at({ x: fr.x + push, y: fr.y }, { action: style === 'magic' ? 'cast' : 'guard', t: style === 'magic' ? 0.6 : 1 });
        let end = fr;
        if (style === 'blade') { // 居合: 打ち返すと同時にボスの懐を駆け抜ける
            end = { x: c.x - 56, y: c.y + 2 };
            const m = win(p, T.strike, T.strike + 0.035), q = (u) => ({ x: lerp(fr.x, end.x, ease(u)), y: lerp(fr.y, end.y, ease(u)) });
            if (p < T.hit + 0.06)
                return at(q(m), { action: m < 1 ? 'dash' : 'attack', t: m < 1 ? 0 : 0.85, flip: m < 1, ghosts: m < 1 ? trail(q, m, 5, 0.12, 0.45) : [] });
        }
        else if (p < T.hit + 0.06) {
            const lunge = style === 'heavy' || style === 'pierce' ? -10 * ease(win(p, T.strike, T.strike + 0.03)) * (1 - win(p, T.hit, T.hit + 0.06)) : 0;
            return at({ x: fr.x + lunge, y: fr.y }, { action: style === 'magic' ? 'cast' : 'attack', t: style === 'magic' ? 0.5 : 0.2 + 0.7 * win(p, T.strike, T.hit) });
        }
        const k = win(p, T.hit + 0.06, T.home);
        return at({ x: lerp(end.x, home.x, ease(k)), y: lerp(end.y, home.y, ease(k)) - Math.sin(k * Math.PI) * 14 }, { action: 'dash', flip: false });
    }
    if (scene === 'seal') { // 封印: ボスの正面で浮いて詠唱 → 打ちこんで封じ砕く
        const T = ULT_T.seal, style = ultArt(weapon).style, fr = frontSpot(body);
        if (p < T.circle - 0.02 || p >= T.home)
            return null;
        if (p < T.chain) {
            const k = win(p, T.circle - 0.02, T.chain), q = (u) => ({ x: lerp(home.x, fr.x, ease(u)), y: lerp(home.y, fr.y, ease(u)) });
            return at(q(k), { action: 'dash', ghosts: trail(q, k, 3, 0.14, 0.35) });
        }
        if (p < T.hit + 0.06) {
            const lift = win(p, T.chain, T.chain + 0.04) * (1 - win(p, T.hit + 0.02, T.hit + 0.06));
            const driving = p >= T.drive && style !== 'magic';
            return at({ x: fr.x, y: fr.y - 6 * ease(lift) + Math.sin(frame / 6) * lift }, { action: driving ? 'attack' : 'cast', t: driving ? 0.2 + 0.7 * win(p, T.drive, T.hit) : 0.5 });
        }
        const k = win(p, T.hit + 0.06, T.home);
        return at({ x: lerp(fr.x, home.x, ease(k)), y: lerp(fr.y, home.y, ease(k)) - Math.sin(k * Math.PI) * 14 }, { action: 'dash', flip: false });
    }
    if (scene === 'awaken') { // 覚醒: 気を解き放つ → 残像だけを残して駆け抜ける → 背を向けて残心
        const T = ULT_T.awaken, end = awakenEnd(body);
        if (p < T.ready - 0.02 || p >= T.home)
            return null;
        if (p < T.flare) {
            const k = win(p, T.ready - 0.02, T.flare);
            return { ...base, ox: Math.sin(frame * 1.9) * 0.9 * k, oy: 3 * ease(k), action: 'guard', t: k };
        }
        if (p < T.hold) {
            const k = win(p, T.flare, T.hold);
            return { ...base, ox: Math.sin(frame * 2.3) * 0.6, oy: -7 * ease(Math.min(1, k * 3)) + Math.sin(frame / 4), action: 'cast', t: 0.5 + 0.5 * Math.sin(frame / 3) };
        }
        if (p < T.blink) {
            const k = win(p, T.hold, T.blink);
            return { ...base, oy: 4 * ease(k), ox: -3 * ease(k), action: 'guard', t: 1 };
        } // 腰を落として、一瞬の溜め
        if (p < T.land) { // 駆け抜ける: 姿は消えて、残像だけが一直線に並ぶ
            const k = win(p, T.blink, T.land), q = (u) => ({ x: lerp(home.x, end.x, u), y: lerp(home.y, end.y, u) });
            return { ...base, alpha: 0, ghosts: Array.from({ length: 12 }, (_, j) => { const g = q(Math.max(0, k - j * 0.07)); return { x: g.x - home.x, y: g.y - home.y, a: 0.5 - j * 0.035, act: 'dash' }; }) };
        }
        if (p < T.hit + 0.05)
            return at(end, { action: 'attack', t: 0.9, flip: false }); // 背を向けた残心
        const k = win(p, T.hit + 0.05, T.home);
        return at({ x: lerp(end.x, home.x, ease(k)), y: lerp(end.y, home.y, ease(k)) - Math.sin(k * Math.PI) * 14 }, { action: 'dash', flip: true });
    }
    // summon: 魔法陣の上で、宙に浮いて詠唱
    const T = ULT_T.summon;
    if (p < T.circle || p >= T.home)
        return null;
    const lift = win(p, T.circle, T.circle + 0.04) * (1 - win(p, T.impact + 0.06, T.home));
    return { ...base, oy: -5 * ease(lift) + Math.sin(frame / 6) * lift, action: p < T.impact + 0.06 ? 'cast' : 'idle', t: 0.5 };
}
// カメラ（主役を追う）: [重み, ズーム, 注視点x, 注視点y]
export function ultCam(scene, p, home, foot, body, W, H, weapon) {
    const hx = home.x - 4, hy = home.y - 22;
    if (scene === 'ougi') {
        const T = ULT_T.ougi, land = ougiLand(foot), style = ultArt(weapon).style;
        const g = win(p, T.crouch - 0.04, T.crouch) * (1 - win(p, T.land, T.home));
        if (g <= 0)
            return null;
        if (p < T.jump)
            return [g, 1.7, hx, hy];
        if (style === 'shot' || style === 'magic') {
            const k = ease(win(p, T.jump, T.hush));
            return [g, lerp(1.5, 1.15, k), lerp(hx, body.x + 40, k), lerp(hy, body.y - 36, k)];
        } // 撃つ人とボスの両方が入る広さ
        if (p < T.hush) {
            const k = ease(win(p, T.jump, T.hush));
            return [g, lerp(1.6, 1.3, k), lerp(hx, (home.x + land.x) / 2, k), hy - 110 * k];
        }
        if (p < T.fall)
            return [g, 1.35, land.x - 6, body.y - 28];
        if (p < T.impact)
            return [g, 1.1, land.x + 6, body.y - 20]; // 落ちてくるところを広めに
        return [g, p < T.impact + 0.04 ? 1.3 : 1.15, land.x - 4, body.y - 14];
    }
    if (scene === 'rush') {
        const T = ULT_T.rush, style = rushArt(weapon).style;
        const g = win(p, T.ready - 0.04, T.ready) * (1 - win(p, T.burst + 0.04, T.home));
        if (g <= 0)
            return null;
        if (p < T.go)
            return [g, 1.6, hx, hy];
        if (style === 'magic' || style === 'shot')
            return [g, p < T.finish ? 1.2 : 1.3, body.x + 46, body.y - 14]; // 撃つ人とボスの両方が入る広さ
        return [g, p < T.finish ? 1.45 : 1.55, body.x + 28, body.y - 22]; // 跳躍の高さが収まる広さ
    }
    if (scene === 'parry') {
        const T = ULT_T.parry, fr = frontSpot(body);
        const g = win(p, T.ready - 0.04, T.ready) * (1 - win(p, T.hit + 0.04, T.home));
        if (g <= 0)
            return null;
        if (p < T.step)
            return [g, 1.6, hx, hy];
        if (p < T.clash - 0.02)
            return [g, 1.3, (fr.x + body.x) / 2 + 8, body.y - 18];
        if (p < T.strike)
            return [g, 1.8, fr.x - 14, fr.y - 26]; // 受け止めた一点に寄る
        return [g, 1.35, (fr.x + body.x) / 2, body.y - 16];
    }
    if (scene === 'seal') {
        const T = ULT_T.seal;
        const g = win(p, T.circle - 0.04, T.circle) * (1 - win(p, T.hit + 0.08, T.home));
        if (g <= 0)
            return null;
        if (p < T.chain)
            return [g, 1.5, hx, hy];
        return [g, p < T.drive ? 1.2 : 1.4, body.x + 36, body.y - 12];
    }
    if (scene === 'awaken') {
        const T = ULT_T.awaken;
        const g = win(p, T.ready - 0.04, T.ready) * (1 - win(p, T.hit + 0.08, T.home));
        if (g <= 0)
            return null;
        if (p < T.blink)
            return [g, 1.7 + 0.2 * win(p, T.flare, T.hold), hx, hy - 4]; // 気を解き放つ主役に寄る
        if (p < T.hit)
            return [g, 1.1, body.x + 24, body.y - 14]; // 駆け抜ける線が収まる広さ
        return [g, 1.4, body.x - 6, body.y - 14];
    }
    const T = ULT_T.summon;
    const g = win(p, T.circle - 0.04, T.circle) * (1 - win(p, T.impact + 0.08, T.home));
    if (g <= 0)
        return null;
    if (p < T.split)
        return [g, 1.5, hx, hy];
    if (p < T.plunge)
        return [g, 1.0, W / 2, H / 2];
    return [g, 1.25, body.x + 20, body.y - 10];
}
// 必殺技の型ごとの、決まる瞬間の音
const impactOf = (style) => (style === 'blade' ? 'impactBlade' : style === 'heavy' ? 'impactHeavy' : style === 'shot' ? 'impactShot' : 'impactMagic');
// 当たる瞬間（ヒットストップ・画面揺れ・効果音に使う）
export function ultBeats(scene, weapon) {
    const out = [{ t: 0.05, stop: 0, shake: 0, sfx: 'charge' }];
    if (scene === 'ougi') {
        const T = ULT_T.ougi, style = ultArt(weapon).style;
        const fall = style === 'shot' ? 'shoot' : style === 'magic' ? 'thunder' : 'dive';
        out.push({ t: T.jump, stop: 0, shake: 2, sfx: style === 'magic' ? 'whoosh' : 'jump' }, { t: T.fall, stop: 0, shake: 0, sfx: fall }, { t: T.impact, stop: 0.006, shake: style === 'heavy' ? 9 : 6, sfx: impactOf(style) });
        if (style === 'heavy')
            out.push({ t: T.impact + 0.05, stop: 0, shake: 4, sfx: 'rumble' });
    }
    else if (scene === 'rush') {
        const T = ULT_T.rush, style = rushArt(weapon).style;
        const steps = rushSteps(style, { x: 0, y: 0 }, { x: 0, y: 0 });
        steps.forEach((s, i) => {
            const t0 = T.first + i * T.pass, t = t0 + T.pass * 0.45;
            if (s.arc >= 40 || Math.abs(s.h1 - s.h0) >= 30)
                out.push({ t: t0, stop: 0, shake: 0, sfx: 'whoosh' });
            if (style === 'magic')
                out.push({ t: t0 + 0.002, stop: 0, shake: 0, sfx: 'chant', v: 0.6 + (0.9 * i) / Math.max(1, T.n - 1) });
            else if (s.fx === 'smash')
                out.push({ t, stop: 0.002, shake: 3, sfx: 'hit' });
            else if (s.fx === 'whirl')
                out.push({ t: t0 + T.pass * 0.2, stop: 0.001, shake: 1, sfx: 'whoosh' });
            else if (s.fx === 'shot')
                out.push({ t: t0 + T.pass * 0.15, stop: 0, shake: 0, sfx: 'shoot' });
            else
                out.push({ t, stop: 0.0015, shake: 1, sfx: 'slash' });
        });
        out.push({ t: T.finish, stop: 0, shake: 0, sfx: style === 'magic' ? 'thunder' : 'shatter' }, { t: T.burst, stop: 0.006, shake: 5, sfx: impactOf(style) });
    }
    else if (scene === 'parry') {
        const T = ULT_T.parry, style = ultArt(weapon).style;
        const reply = style === 'blade' ? 'slash' : style === 'heavy' ? 'rumble' : style === 'shot' ? 'shoot' : style === 'magic' ? 'thunder' : 'slash';
        out.push({ t: T.step, stop: 0, shake: 0, sfx: 'whoosh' }, { t: T.clash, stop: 0.0025, shake: 5, sfx: 'guard' }, { t: T.strike, stop: 0, shake: 1, sfx: reply }, { t: T.hit, stop: 0.006, shake: 6, sfx: impactOf(style) });
    }
    else if (scene === 'seal') {
        const T = ULT_T.seal, style = ultArt(weapon).style;
        out.push({ t: T.circle, stop: 0, shake: 0, sfx: 'barrier' }, { t: T.chain, stop: 0, shake: 1, sfx: 'whoosh' }, { t: T.bind, stop: 0.001, shake: 2, sfx: 'sealBind' }, { t: T.strain, stop: 0, shake: 2, sfx: 'rumble' }, { t: T.drive, stop: 0, shake: 0, sfx: style === 'shot' ? 'shoot' : style === 'magic' ? 'thunder' : style === 'heavy' ? 'dive' : 'slash' }, { t: T.hit, stop: 0.006, shake: 6, sfx: impactOf(style) });
    }
    else if (scene === 'awaken') {
        const T = ULT_T.awaken, style = ultArt(weapon).style;
        out.push({ t: T.flare, stop: 0, shake: 2, sfx: 'awakenFlare' }, { t: T.blink, stop: 0, shake: 0, sfx: 'jump' }, { t: T.hit, stop: 0.006, shake: 7, sfx: impactOf(style) }, { t: T.hit + 0.02, stop: 0.001, shake: 3, sfx: 'slash' }, { t: T.hit + 0.06, stop: 0, shake: 2, sfx: 'rumble' });
    }
    else {
        const T = ULT_T.summon, style = ultArt(weapon).style;
        out.push({ t: T.circle, stop: 0, shake: 0, sfx: 'barrier' }, { t: T.split, stop: 0, shake: 1, sfx: 'summonHorn' }, { t: T.plunge, stop: 0, shake: 0, sfx: style === 'shot' ? 'shoot' : style === 'magic' ? 'thunder' : 'dive' }, { t: T.impact, stop: 0.006, shake: 6, sfx: impactOf(style) }, { t: T.impact + 0.08, stop: 0, shake: 2, sfx: 'rumble' }, { t: T.impact + 0.14, stop: 0, shake: 2, sfx: 'rumble' });
    }
    return out;
}
// その瞬間の画面揺れの大きさ（当たってから少しのあいだ、だんだん弱まる）
export function ultShake(scene, p, countered, weapon) {
    let s = 0;
    if (countered)
        for (const b of ultBeats(scene, weapon)) {
            const age = p - b.t;
            if (b.shake && age >= 0 && age < 0.05)
                s = Math.max(s, b.shake * (1 - age / 0.05));
        }
    if (p > 0.3 && p < RELEASE)
        s = Math.max(s, 0.7 * win(p, 0.3, RELEASE)); // ボスの溜めの地鳴り
    return s;
}
const heroOf = (a) => (a.ult?.hero !== undefined ? a.fighters.find((v) => v.f === a.ult.hero && v.alive) : undefined);
const fmtDmg = (d) => String(Math.round(d)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
// ---- 奥（ボス・キャラより後ろ）: ボスの赤いオーラ、召喚の魔法陣 ----
function ultBack(a) {
    const { ctx, phase: p } = a;
    const hero = heroOf(a);
    // ボスの溜め: 赤いオーラが脈打ちながら大きくなる（放ったら消える）
    const k = win(p, 0.02, RELEASE - 0.02) * (1 - win(p, RELEASE, RELEASE + 0.06));
    if (k > 0) {
        const r = 30 + k * 34 + Math.sin(a.frame / 2.5) * 3 * k;
        ctx.save();
        const g = ctx.createRadialGradient(a.body.x, a.body.y, 4, a.body.x, a.body.y, r);
        g.addColorStop(0, 'rgba(255,60,60,0.55)');
        g.addColorStop(0.6, 'rgba(200,20,40,0.32)');
        g.addColorStop(1, 'rgba(120,0,20,0)');
        ctx.globalAlpha = k;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(a.body.x, a.body.y, r, 0, TAU);
        ctx.fill();
        // 足元の赤い地割れの光
        ctx.globalAlpha = k * 0.8;
        ctx.strokeStyle = '#ff3b3b';
        ctx.lineWidth = 1.5;
        const rng = new Rng(`${a.seed}:ultcrack`);
        for (let c = 0; c < 6; c++) {
            let x = a.foot.x + 4, y = a.foot.y;
            const ang = (c / 6) * Math.PI + rng.range(-0.2, 0.2);
            ctx.beginPath();
            ctx.moveTo(x, y);
            for (let i = 0; i < 4; i++) {
                x += Math.cos(ang) * rng.range(6, 12) * k;
                y += Math.sin(ang) * rng.range(1, 4) * k;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        ctx.restore();
        a.lights?.push({ x: a.body.x, y: a.body.y, r: 60 + k * 50, a: k * 0.9, col: '#ff3b3b' });
    }
    if (!hero)
        return;
    const hitT = ultHitT(a.scene);
    a.lights?.push({ x: a.body.x, y: a.body.y - 10, r: 130, a: bump(p, hitT - 0.01, hitT + 0.2), col: a.scene === 'summon' ? '#bff4ff' : '#ffe9a0' });
    a.lights?.push({ x: hero.x, y: hero.y - 14, r: 70, a: bump(p, 0.28, 0.66), col: a.scene === 'summon' ? '#9fe8ff' : '#ffd166' });
    if (a.scene === 'summon')
        summonCircle(a, hero);
}
// ---- 手前（キャラより前・明かりの前）: 溜めの粒子 ----
function ultFront(a) {
    const { ctx, phase: p } = a;
    const k = win(p, 0.04, RELEASE);
    if (k > 0 && p < RELEASE) { // 赤い粒がボスに吸い込まれる
        const rng = new Rng(`${a.seed}:ultgather`);
        ctx.save();
        for (let i = 0; i < 30; i++) {
            const ang = rng.range(0, TAU), d0 = rng.range(40, 100), sp = rng.range(0.7, 1.5);
            const t = (k * sp * 3 + rng.next()) % 1, d = d0 * (1 - t);
            ctx.globalAlpha = t * 0.9;
            ctx.fillStyle = i % 3 ? '#ff5a5a' : '#ffd0d0';
            ctx.fillRect(R(a.body.x + Math.cos(ang) * d), R(a.body.y + Math.sin(ang) * d * 0.7), 2, 2);
        }
        ctx.restore();
    }
}
// ============ いちばん手前（明かりの後。光る物・文字・閃光。ワールド座標） ============
export function sceneTop(a) {
    if (a.scene === 'chain' && a.chain) {
        chainTop(a, a.chain);
        return;
    }
    if (a.scene === 'spell') {
        spellFx(a);
        return;
    }
    if (!a.ult || !isUltScene(a.scene))
        return;
    const { ctx, phase: p } = a;
    const hero = heroOf(a);
    // 溜めのゲージ（ボスの頭上）
    const gk = win(p, 0.26, 0.3) * (1 - win(p, RELEASE, RELEASE + 0.03));
    if (gk > 0) {
        const x = a.body.x + 8, y = a.body.y - 64, w = 56, fill = win(p, 0.04, RELEASE);
        ctx.save();
        ctx.globalAlpha = gk;
        ctx.fillStyle = '#1a0a14';
        ctx.fillRect(R(x - w / 2 - 1), R(y + 6), w + 2, 5);
        ctx.fillStyle = a.frame % 6 < 3 ? '#ff3b3b' : '#ffb0b0';
        ctx.fillRect(R(x - w / 2), R(y + 7), R(w * fill), 3);
        ctx.restore();
        text(ctx, tl('大技の溜め'), x, y, 8, '#ffb0b0', gk, '#3a0a14');
    }
    // ボスの大技が放たれる（外したキャラを吹き飛ばす赤い衝撃波）
    const missed = a.fighters.some((v) => !v.ok && v.alive) || !hero;
    const rk = win(p, RELEASE - 0.01, RELEASE + 0.12);
    if (missed && rk > 0 && rk < 1) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (1 - rk) * 0.9;
        ctx.strokeStyle = '#ff3b3b';
        ctx.lineWidth = 6 * (1 - rk) + 1;
        ctx.beginPath();
        ctx.ellipse(a.foot.x + 10, a.foot.y + 6, 20 + rk * 300, 6 + rk * 70, 0, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
        ctx.strokeStyle = '#ffd0d0';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(a.foot.x + 10, a.foot.y + 6, 10 + rk * 240, 3 + rk * 56, 0, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
        ctx.restore();
        flash(a, bump(p, RELEASE - 0.005, RELEASE + 0.03), '#ff3050', 0.35);
    }
    if (!hero) {
        text(ctx, tl('大技が炸裂した…'), a.W * 0.6, 70, 11, '#ffb0b0', bump(p, RELEASE, 0.62), '#3a0a14');
        return;
    }
    if (a.scene === 'ougi')
        ougiUlt(a, hero);
    else if (a.scene === 'rush')
        rushUlt(a, hero);
    else if (a.scene === 'summon')
        summonUlt(a, hero);
    else if (a.scene === 'parry')
        parryUlt(a, hero);
    else if (a.scene === 'seal')
        sealUlt(a, hero);
    else
        awakenUlt(a, hero);
    { // 技の名前（武器ごと）
        const sc = a.scene, t0 = ultNameT(sc), t1 = ultHitT(sc);
        const nk = win(p, t0, t0 + 0.015) * (1 - win(p, t1 + 0.02, t1 + 0.07));
        if (nk > 0)
            text(ctx, `― ${ultName(sc, a.ult?.weapon)} ―`, a.body.x + 40, a.body.y - 58, 11, '#ffffff', nk, '#3a0a3a');
    }
    // 大技を潰した: 巨大なダメージ数字と、技の名前
    const hitT = ultHitT(a.scene);
    const dk = win(p, hitT, hitT + 0.2);
    if (dk > 0 && dk < 1) {
        const pop = 1 + 0.6 * (1 - ease(clamp01(dk / 0.12)));
        const al = Math.min(1, (1 - dk) * 5);
        const x = a.body.x + 40, y = a.body.y - 22 - ease(dk) * 10;
        if (a.ult.dmg > 0)
            text(ctx, fmtDmg(a.ult.dmg), x, y, R(22 * pop), a.frame % 6 < 3 ? '#ffffff' : '#ffe27a', al, '#5a1a00');
        if (a.ult.crit && a.ult.dmg > 0)
            text(ctx, tl('会心！'), x, y - 18 * pop, 9, '#ffef5a', al, '#5a1a00');
        const ck = bump(p, hitT + 0.01, hitT + 0.2);
        // 技の名前はボスの足元の手前に（ダメージ数字と重ならないように）
        const tx = a.body.x + 70, ty = a.foot.y + 24;
        text(ctx, tl('大技を潰した！'), tx, ty, R(14 + 5 * bump(p, hitT, hitT + 0.05)), '#ffe9a0', Math.min(1, ck * 2), '#3a1a00');
        if (a.ult.skill)
            text(ctx, `― ${a.ult.skill} ―`, tx, ty + 16, 9, '#ffffff', Math.min(1, ck * 2), '#3a1a00');
    }
}
// 光る線（外側の色 → 白い芯）
function glowLine(ctx, x0, y0, x1, y1, w, col, alpha) {
    if (alpha <= 0 || w <= 0)
        return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.globalAlpha = Math.min(1, alpha) * 0.35;
    ctx.strokeStyle = col;
    ctx.lineWidth = w * 2.4;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.lineWidth = w;
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, w * 0.35);
    ctx.stroke();
    ctx.restore();
}
// 飛び散る岩片
function rocks(a, x, y, k, seed, n = 22, spread = 120) {
    if (k <= 0 || k >= 1)
        return;
    const { ctx } = a;
    const rng = new Rng(`${a.seed}:${seed}`);
    ctx.save();
    for (let i = 0; i < n; i++) {
        const ang = rng.range(Math.PI * 1.05, Math.PI * 1.95), sp = rng.range(spread * 0.3, spread), s = rng.range(2, 6);
        const px = x + Math.cos(ang) * sp * k, py = y + Math.sin(ang) * sp * k * 0.9 + 150 * k * k;
        ctx.globalAlpha = 1 - k * k;
        ctx.fillStyle = i % 3 ? '#7a6a52' : i % 2 ? '#a8987a' : '#4a3a2a';
        ctx.fillRect(R(px), R(py), R(s), R(s));
        ctx.fillStyle = '#d8ccb0';
        ctx.fillRect(R(px), R(py), 1, 1);
    }
    ctx.restore();
}
// 砂煙
function dustCloud(a, x, y, k, seed, size = 1) {
    if (k <= 0 || k >= 1)
        return;
    const { ctx } = a;
    const rng = new Rng(`${a.seed}:${seed}`);
    ctx.save();
    for (let i = 0; i < 14; i++) {
        const dir = rng.range(-1, 1), sp = rng.range(10, 34) * size, r = rng.range(3, 7) * size, up = rng.range(0, 10);
        ctx.globalAlpha = (1 - k) * 0.75;
        ctx.fillStyle = i % 2 ? '#d8ccb0' : '#b8a888';
        ctx.beginPath();
        ctx.arc(x + dir * sp * ease(k), y - up * k * size - 2, r * (0.5 + k), 0, TAU);
        ctx.fill();
    }
    ctx.restore();
}
// 空に浮かぶ大魔法陣（ボスの頭上）。輪と刻みがゆっくり回る
function skyDisc(a, cx, cy, r, alpha, hue) {
    if (alpha <= 0)
        return;
    const { ctx } = a;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(cx, cy);
    ctx.scale(1, 0.26);
    const col = `hsl(${hue},100%,70%)`, col2 = `hsl(${(hue + 50) % 360},100%,80%)`;
    ctx.globalAlpha = alpha * 0.18;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    for (const [k, w] of [[1, 3], [0.82, 1.6], [0.5, 1.6]]) {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = k === 1 ? col2 : col;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.arc(0, 0, r * k, 0, TAU);
        ctx.stroke();
    }
    ctx.rotate(a.frame / 40);
    for (let i = 0; i < 28; i++) {
        const t = (i / 28) * TAU, z = i % 3 ? 2 : 4;
        ctx.globalAlpha = alpha * (0.5 + 0.5 * Math.sin(a.frame / 4 + i));
        ctx.fillStyle = i % 3 ? col2 : '#ffffff';
        ctx.fillRect(R(Math.cos(t) * r * 0.91) - z / 2, R(Math.sin(t) * r * 0.91) - z / 2, z, z);
    }
    ctx.rotate(-a.frame / 16);
    ctx.strokeStyle = col2;
    ctx.lineWidth = 1.5;
    for (const off of [0, Math.PI / 3]) {
        ctx.beginPath();
        for (let i = 0; i <= 3; i++) {
            const t = off + (i / 3) * TAU, x = Math.cos(t) * r * 0.8, y = Math.sin(t) * r * 0.8;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
    }
    ctx.restore();
}
// ---- 跳躍落下斬り（ougi）: 武器ごとの型。屈んで溜め → 大ジャンプ → 静寂と照準 → 必殺の一撃 ----
//   blade : 光の尾を引いて急降下し、縦の巨大な斬撃（刀は月の弧を描く斜めの一閃、短剣は五連の突き）
//   heavy : 回りながら隕石のように落ち、地面を割る
//   pierce: 斜めに頭から突っこむ光の槍。着弾点から光芒が放射する
//   shot  : 空に浮かんだまま狙いを定め、極大の矢（光線）を撃ち下ろす
//   magic : 空に大魔法陣が開き、天から光の柱が落ちる
function ougiUlt(a, hero) {
    const { ctx, phase: p } = a;
    const T = ULT_T.ougi, land = ougiLand(a.foot), wp = a.ult?.weapon;
    const style = ultArt(wp).style, [colA, colB] = RUSH_COL[style], air = style === 'shot' || style === 'magic';
    const sky = ougiSky(a.body, land), sx = land.x - 4;
    // 溜め: 粒が足元から吸い上がる
    const ck = win(p, T.crouch - 0.02, T.jump);
    if (ck > 0 && p < T.jump) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const rng = new Rng(`${a.seed}:ougicharge`);
        for (let i = 0; i < 18; i++) {
            const t = (ck * 2.5 + rng.next()) % 1, dx = rng.range(-14, 14);
            ctx.globalAlpha = (1 - t) * ck;
            ctx.fillStyle = i % 2 ? colA : '#ffffff';
            ctx.fillRect(R(hero.x + dx * (1 - t)), R(hero.y - t * 38), 1, 3);
        }
        ctx.restore();
    }
    // 跳躍: 砂煙と、足元の衝撃の輪、上へ伸びる光の筋
    const jk = win(p, T.jump, T.jump + 0.1);
    dustCloud(a, hero.x, hero.y, jk, 'ougijump', 1.3);
    if (jk > 0 && jk < 1) {
        ctx.save();
        ctx.globalAlpha = 1 - jk;
        ctx.strokeStyle = colB;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(hero.x, hero.y, 6 + jk * 30, 2 + jk * 8, 0, 0, TAU);
        ctx.stroke();
        ctx.restore();
        glowLine(ctx, hero.x, hero.y - 10, hero.x + ((air ? sky.x : land.x) - hero.x) * 0.35, air ? sky.y - 10 : -120, 4 * (1 - jk), colA, 1 - jk);
    }
    // 静寂: 画面が暗くなり、ボスの頭上に落下地点の光の輪と照準
    const hk = win(p, T.hush - 0.01, T.hush + 0.02) * (1 - win(p, T.impact, T.impact + 0.06));
    if (hk > 0) {
        ctx.save();
        ctx.globalAlpha = hk * (air ? 0.4 : 0.62);
        ctx.fillStyle = '#04030a';
        ctx.fillRect(-a.W, -a.H, a.W * 3, a.H * 3);
        ctx.restore();
        const tk = win(p, T.hush, T.fall);
        const cx = land.x - 4, cy = a.body.y - 20;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) { // 地面の光の輪（縮んでいく）
            const r = (48 - i * 12) * (1 - tk * 0.55);
            ctx.globalAlpha = hk * (0.5 + 0.5 * Math.sin(a.frame / 3 + i));
            ctx.strokeStyle = i ? colA : '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(cx, a.foot.y + 4, r, r * 0.3, 0, 0, TAU);
            ctx.stroke();
        }
        ctx.translate(cx, cy);
        ctx.rotate(a.frame / 12); // 照準（回る四隅と十字）
        const rr = 22 - tk * 8;
        ctx.globalAlpha = hk;
        ctx.strokeStyle = colB;
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
            ctx.rotate(Math.PI / 2);
            ctx.beginPath();
            ctx.moveTo(rr, -6);
            ctx.lineTo(rr, -rr);
            ctx.lineTo(6, -rr);
            ctx.stroke();
        }
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(-rr - 6, 0);
        ctx.lineTo(-4, 0);
        ctx.moveTo(4, 0);
        ctx.lineTo(rr + 6, 0);
        ctx.moveTo(0, -rr - 6);
        ctx.lineTo(0, -4);
        ctx.moveTo(0, 4);
        ctx.lineTo(0, rr + 6);
        ctx.stroke();
        ctx.restore();
        if (!air) { // 上空のきらめき（落ちてくる直前）
            const gl = bump(p, T.fall - 0.03, T.fall + 0.005);
            if (gl > 0) {
                ctx.save();
                ctx.globalAlpha = gl;
                ctx.fillStyle = '#ffffff';
                const s0 = 3 + gl * 8, gx = cx + 26, gy = 26;
                ctx.fillRect(R(gx - s0), gy, R(s0 * 2), 1);
                ctx.fillRect(R(gx), R(gy - s0), 1, R(s0 * 2));
                ctx.restore();
            }
        }
        text(ctx, '……', cx + 34, cy - 30, 10, '#ffe9a0', bump(p, T.hush + 0.01, T.fall));
    }
    if (air) { // 空に浮かぶ主役のオーラ（暗がりでも見えるように）
        const gk = win(p, T.jump, T.hush) * (1 - win(p, T.impact + 0.04, T.land));
        if (gk > 0) {
            const gy = sky.y - 12, g = ctx.createRadialGradient(sky.x, gy, 0, sky.x, gy, 34);
            g.addColorStop(0, 'rgba(255,255,255,0.55)');
            g.addColorStop(0.5, `${colA}66`);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = gk * (0.75 + 0.25 * Math.sin(a.frame / 3));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(sky.x, gy, 34, 0, TAU);
            ctx.fill();
            ctx.restore();
        }
    }
    const fk = win(p, T.fall, T.impact), ik = win(p, T.impact, T.impact + 0.12);
    const ground = a.foot.y;
    const rings = (n, col, big) => {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < n; i++) {
            const kk = clamp01(ik * 1.3 - i * 0.15);
            if (kk <= 0 || kk >= 1)
                continue;
            ctx.globalAlpha = (1 - kk) * 0.9;
            ctx.strokeStyle = i === 1 ? '#ffffff' : col;
            ctx.lineWidth = 4 * (1 - kk) + 1;
            ctx.beginPath();
            ctx.ellipse(sx, ground + 4, 10 + kk * (big + i * 40), 3 + kk * (big * 0.24 + i * 10), 0, 0, TAU);
            ctx.stroke();
        }
        ctx.restore();
    };
    if (style === 'blade') {
        const variant = wp === 'katana' ? 'katana' : wp === 'dagger' ? 'dagger' : 'sword';
        if (fk > 0 && fk < 1) { // 急降下: 光の尾と速さの線
            const top = { x: land.x + 26, y: -40 };
            const hx = lerp(top.x, land.x, fk * fk), hy = lerp(top.y, land.y, fk * fk) - 14;
            glowLine(ctx, lerp(top.x, hx, 0.2) + 6, -160, hx, hy, variant === 'katana' ? 4 : 7, variant === 'katana' ? '#e8f4ff' : colA, 1);
            for (let i = 0; i < 8; i++)
                glowLine(ctx, hx - 22 + i * 6, hy - 70 - (i % 3) * 20, hx - 21 + i * 6, hy - 24 - (i % 3) * 20, 1, '#ffffff', 0.5);
        }
        if (ik > 0 && ik < 1) {
            if (variant === 'sword') { // 縦の巨大な斬撃線
                const w = 18 * (1 - ease(ik)) + 2;
                glowLine(ctx, sx, -200, sx, ground + 12, w, colA, 1 - ik * ik);
                glowLine(ctx, sx - w * 1.6, -200, sx - w * 1.6, ground, 1.5, '#ffffff', (1 - ik) * 0.6);
                glowLine(ctx, sx + w * 1.6, -200, sx + w * 1.6, ground, 1.5, '#ffffff', (1 - ik) * 0.6);
            }
            else if (variant === 'katana') { // 月の弧を描く、斜めの一閃
                const w = 12 * (1 - ease(ik)) + 2;
                glowLine(ctx, sx - 96, ground - 210, sx + 64, ground + 12, w, '#e8f4ff', 1 - ik * ik);
                glowArc(ctx, sx - 6, a.body.y - 10, 66, 66, -2.6, -2.6 + 1.9 * ease(clamp01(ik * 2)), 5 * (1 - ik) + 1, '#9fe8ff', 1 - ik);
            }
            else { // 五連の突き: 縦の細い斬撃が時間差で並ぶ
                for (let i = 0; i < 5; i++) {
                    const k5 = clamp01(ik * 1.5 - i * 0.12);
                    if (k5 <= 0 || k5 >= 1)
                        continue;
                    glowLine(ctx, sx + (i - 2) * 17, -200, sx + (i - 2) * 17, ground + 10, 5 * (1 - k5) + 1, i % 2 ? '#ffffff' : colA, 1 - k5);
                    starSpark(ctx, sx + (i - 2) * 17, ground, 9 * (1 - k5), 1 - k5, '#ffffff');
                }
            }
            rings(3, colA, 150);
        }
        rocks(a, sx, ground, win(p, T.impact, T.impact + 0.16), 'ougirock', 26, 130);
        dustCloud(a, sx, ground + 4, win(p, T.impact, T.impact + 0.14), 'ougidust', 1.8);
    }
    else if (style === 'heavy') {
        if (fk > 0 && fk < 1) { // 隕石のように、燃えながら回って落ちる
            const hx = lerp(land.x + 8, land.x, fk * fk), hy = lerp(-50, land.y, fk * fk) - 14;
            glowLine(ctx, hx + 10, -170, hx, hy, 10, colA, 1);
            glowArc(ctx, hx, hy, 16, 16, a.frame / 2, a.frame / 2 + 4.2, 3, colB, 1);
            const rng = new Rng(`${a.seed}:ougiember`);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 16; i++) {
                const t = rng.next();
                ctx.globalAlpha = 1 - t;
                ctx.fillStyle = i % 2 ? colB : '#ffffff';
                ctx.fillRect(R(hx + rng.range(-12, 12) + t * 8), R(hy - t * 60), 2, 2);
            }
            ctx.restore();
        }
        if (ik > 0 && ik < 1) { // 地面ごと割る: 縦の衝撃柱と、放射状の亀裂
            glowLine(ctx, sx, -200, sx, ground + 12, 26 * (1 - ease(ik)) + 3, colA, (1 - ik) * 0.9);
            const rng = new Rng(`${a.seed}:ougicrack`);
            for (let i = 0; i < 12; i++) {
                const an = (i / 12) * TAU + rng.range(-0.15, 0.15), len = rng.range(50, 120) * ease(clamp01(ik * 2.2));
                glowLine(ctx, sx, ground + 4, sx + Math.cos(an) * len, ground + 4 + Math.sin(an) * len * 0.26, 2.4 * (1 - ik) + 0.6, i % 2 ? colB : colA, 1 - ik);
            }
            rings(3, colA, 190);
        }
        rocks(a, sx, ground, win(p, T.impact, T.impact + 0.18), 'ougirock', 44, 150);
        dustCloud(a, sx, ground + 4, win(p, T.impact, T.impact + 0.16), 'ougidust', 2.4);
    }
    else if (style === 'pierce') {
        if (fk > 0 && fk < 1) { // 斜めの光の槍
            const hx = lerp(land.x + 92, land.x, fk * fk), hy = lerp(-70, land.y, fk * fk) - 12;
            glowLine(ctx, hx + 96, hy - 76, hx, hy, 6, colA, 1);
            glowLine(ctx, hx + 106, hy - 74, hx + 6, hy + 2, 1.4, '#ffffff', 0.7);
            glowLine(ctx, hx + 84, hy - 80, hx - 6, hy - 6, 1.4, colB, 0.6);
            starSpark(ctx, hx, hy, 8, 1, '#ffffff');
        }
        if (ik > 0 && ik < 1) { // 着弾点から光芒が放射し、細い光の柱が天へ
            for (let i = 0; i < 14; i++) {
                const an = (i / 14) * TAU, len = (36 + (i % 3) * 22) * ease(clamp01(ik * 2));
                glowLine(ctx, sx, ground, sx + Math.cos(an) * len, ground + Math.sin(an) * len * 0.5, 2 * (1 - ik) + 0.5, i % 2 ? '#ffffff' : colA, 1 - ik);
            }
            glowLine(ctx, sx, ground + 6, sx, -200, 8 * (1 - ik) + 1, colA, 1 - ik);
            rings(2, colA, 120);
        }
        rocks(a, sx, ground, win(p, T.impact, T.impact + 0.16), 'ougirock', 18, 100);
        dustCloud(a, sx, ground + 4, win(p, T.impact, T.impact + 0.12), 'ougidust', 1.3);
    }
    else if (style === 'shot') {
        const mz = { x: sky.x - 10, y: sky.y - 14 }, tgt = { x: a.body.x + 4, y: a.body.y + 4 };
        if (fk > 0 && fk < 1) { // 銃口（弓なら矢じり）に光が集まる
            const r = 4 + 18 * ease(fk);
            const g = ctx.createRadialGradient(mz.x, mz.y, 0, mz.x, mz.y, r);
            g.addColorStop(0, 'rgba(255,255,255,1)');
            g.addColorStop(0.5, `${colA}aa`);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(mz.x, mz.y, r, 0, TAU);
            ctx.fill();
            const rng = new Rng(`${a.seed}:ougigather`);
            for (let i = 0; i < 14; i++) {
                const t = (fk * 2.4 + rng.next()) % 1, an = rng.range(0, TAU), d = (1 - t) * rng.range(20, 50);
                ctx.globalAlpha = t;
                ctx.fillStyle = i % 2 ? colB : '#ffffff';
                ctx.fillRect(R(mz.x + Math.cos(an) * d), R(mz.y + Math.sin(an) * d * 0.8), 2, 2);
            }
            ctx.restore();
            glowLine(ctx, mz.x, mz.y, tgt.x, tgt.y, 0.8, '#ff6a6a', 0.5 * fk); // 狙いの線
        }
        const bk = win(p, T.impact - 0.025, T.impact), fade = 1 - win(p, T.impact + 0.03, T.impact + 0.1);
        if (bk > 0 && fade > 0) { // 極大の矢（光線）を撃ち下ろす
            const w = (6 + 14 * ease(bk)) * fade, end = { x: lerp(mz.x, tgt.x, ease(bk)), y: lerp(mz.y, tgt.y, ease(bk)) };
            glowLine(ctx, mz.x, mz.y, end.x, end.y, w, colA, fade);
            glowLine(ctx, mz.x, mz.y, end.x, end.y, w * 0.4, '#ffffff', fade);
            starSpark(ctx, mz.x, mz.y, 10 + w, fade, '#ffffff');
        }
        if (ik > 0 && ik < 1) {
            for (let i = 0; i < 10; i++) {
                const an = (i / 10) * TAU, len = (30 + (i % 3) * 18) * ease(clamp01(ik * 2));
                glowLine(ctx, tgt.x, tgt.y, tgt.x + Math.cos(an) * len, tgt.y + Math.sin(an) * len * 0.7, 2 * (1 - ik) + 0.5, i % 2 ? colB : '#ffffff', 1 - ik);
            }
            rings(3, colA, 130);
        }
        rocks(a, sx, ground, win(p, T.impact, T.impact + 0.16), 'ougirock', 16, 100);
    }
    else {
        const dc = { x: a.body.x + 6, y: a.body.y - 96 };
        const dk = win(p, T.hush - 0.02, T.hush + 0.03) * (1 - win(p, T.impact + 0.08, T.impact + 0.16));
        skyDisc(a, dc.x, dc.y, 40 + 44 * ease(win(p, T.hush - 0.02, T.impact)), dk * (0.5 + 0.5 * win(p, T.hush, T.impact)), 270 - 60 * win(p, T.hush, T.impact));
        if (fk > 0 && fk < 1) { // 魔法陣に光が集まる
            const rng = new Rng(`${a.seed}:ougigather`);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 20; i++) {
                const t = (fk * 2.2 + rng.next()) % 1, an = rng.range(0, TAU), d = (1 - t) * rng.range(20, 60);
                ctx.globalAlpha = t;
                ctx.fillStyle = i % 2 ? colB : '#ffffff';
                ctx.fillRect(R(dc.x + Math.cos(an) * d), R(dc.y + Math.sin(an) * d * 0.3), 2, 2);
            }
            ctx.restore();
        }
        const pk = win(p, T.impact - 0.02, T.impact) * (1 - win(p, T.impact + 0.05, T.impact + 0.16));
        if (pk > 0) { // 天から落ちる光の柱
            const w = 14 + 26 * ease(win(p, T.impact - 0.02, T.impact + 0.03));
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createLinearGradient(sx - w, 0, sx + w, 0);
            g.addColorStop(0, `${colA}00`);
            g.addColorStop(0.4, `${colA}cc`);
            g.addColorStop(0.5, 'rgba(255,255,255,1)');
            g.addColorStop(0.6, `${colA}cc`);
            g.addColorStop(1, `${colA}00`);
            ctx.globalAlpha = pk;
            ctx.fillStyle = g;
            ctx.fillRect(sx - w, dc.y, w * 2, ground + 10 - dc.y);
            ctx.restore();
        }
        if (ik > 0 && ik < 1)
            rings(3, colA, 160);
        rocks(a, sx, ground, win(p, T.impact, T.impact + 0.16), 'ougirock', 20, 110);
    }
    flash(a, bump(p, T.impact - 0.003, T.impact + 0.035), '#ffffff', style === 'magic' ? 0.8 : 0.92);
}
// 着弾の爆ぜ（輪・光の玉）。k は 0→1
function impactBurst(a, x, y, k, colA, colB, big = 1) {
    if (k <= 0 || k >= 1)
        return;
    const { ctx } = a;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
        const kk = clamp01(k * 1.3 - i * 0.15);
        if (kk <= 0 || kk >= 1)
            continue;
        ctx.globalAlpha = 1 - kk;
        ctx.strokeStyle = i === 1 ? '#ffffff' : i ? colB : colA;
        ctx.lineWidth = 5 * (1 - kk) + 1;
        ctx.beginPath();
        ctx.ellipse(x, y, (10 + kk * (110 + i * 30)) * big, (8 + kk * (62 + i * 14)) * big, 0, 0, TAU);
        ctx.stroke();
    }
    const r = 60 * big, g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, `${colA}99`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 1 - k;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * (0.6 + k), 0, TAU);
    ctx.fill();
    ctx.restore();
}
// 三日月の衝撃波。dir>0 は右へ、dir<0 は左へふくらむ
function crescent(ctx, x, y, dir, sz, col, alpha) {
    const a0 = dir > 0 ? -1.25 : Math.PI - 1.25, a1 = dir > 0 ? 1.25 : Math.PI + 1.25;
    glowArc(ctx, x, y, 12 * sz, 30 * sz, a0, a1, 5 * sz, col, alpha);
    glowArc(ctx, x - dir * 9 * sz, y, 12 * sz, 24 * sz, a0, a1, 1.6, '#ffffff', alpha * 0.7);
    for (let i = 1; i <= 3; i++)
        glowLine(ctx, x - dir * (14 + i * 9) * sz, y - 12 * sz + i * 6, x - dir * (30 + i * 12) * sz, y - 12 * sz + i * 6, 1.2, col, alpha * (1 - i * 0.25));
}
// ---- 返し技（parry）: 迫る大技を受け止めた瞬間に時が止まり、武器の型で打ち返す ----
//   blade : 受け止めた刃で居合。同時に懐を駆け抜け、斬撃は遅れてボスに刻まれる
//   heavy : 受け止めた衝撃を地面へ流し、大地の衝撃波として叩き返す
//   pierce: 衝撃の一点を一本の針のように突き抜く
//   shot  : 受け止めた力を弾にして、いくつもの光弾で撃ち返す
//   magic : 魔鏡の障壁で受け止め、砕けた破片と極大の光で反射する
function parryUlt(a, hero) {
    const { ctx, phase: p } = a;
    const T = ULT_T.parry, style = ultArt(a.ult?.weapon).style, [colA, colB] = RUSH_COL[style];
    const fr = frontSpot(a.body), cp = { x: fr.x - 16, y: fr.y - 20 }, bs = { x: a.body.x + 28, y: a.body.y - 4 }, tg = { x: a.body.x + 2, y: a.body.y + 2 };
    void hero;
    // 構え: 風が集まる
    const rk0 = win(p, T.ready - 0.02, T.step);
    if (rk0 > 0 && p < T.guard) {
        ctx.save();
        ctx.strokeStyle = '#ffe9a0';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            const t = (rk0 * 3 + i / 5) % 1;
            ctx.globalAlpha = (1 - t) * rk0 * 0.7;
            ctx.beginPath();
            ctx.arc(hero.x, hero.y - 12, 24 * (1 - t) + 4, i, i + 1.2);
            ctx.stroke();
        }
        ctx.restore();
    }
    // 迫る大技（赤い三日月）。受け止めた位置で止まる
    if (p < T.strike) {
        const u = ease(win(p, 0.37, T.clash)), x = lerp(bs.x, cp.x, u), y = lerp(bs.y, cp.y, u);
        const jit = p >= T.clash ? Math.sin(a.frame * 2.4) * 1.2 : 0;
        if (p > 0.37)
            crescent(ctx, x + jit, y, 1, 1.15, '#ff4a5a', 1);
    }
    // 受け止めた瞬間: 大きな火花・衝撃の輪・時が止まる暗転とひび
    const ck = win(p, T.clash, T.clash + 0.02);
    if (ck > 0 && p < T.freeze + 0.02) {
        const fz = ck * (1 - win(p, T.strike - 0.015, T.strike));
        if (fz > 0) {
            ctx.save();
            ctx.globalAlpha = fz * 0.5;
            ctx.fillStyle = '#080812';
            ctx.fillRect(-a.W, -a.H, a.W * 3, a.H * 3);
            ctx.restore();
            const rng = new Rng(`${a.seed}:parrycrack`);
            for (let i = 0; i < 16; i++) {
                const an = rng.range(0, TAU), len = rng.range(40, 150) * ease(ck);
                glowLine(ctx, cp.x, cp.y, cp.x + Math.cos(an) * len, cp.y + Math.sin(an) * len * 0.8, 0.9, '#ffffff', fz * 0.75);
            }
            starSpark(ctx, cp.x, cp.y, 14 + 40 * ease(ck), fz, '#ffffff');
            text(ctx, tl('見切り！'), cp.x - 6, cp.y - 38, R(12 + 5 * (1 - ck)), '#ffe9a0', fz, '#3a1a00');
        }
        const ik = win(p, T.clash, T.freeze);
        if (ik > 0 && ik < 1) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = '#ffe9a0';
            ctx.lineWidth = 2 * (1 - ik) + 0.5;
            ctx.globalAlpha = 1 - ik;
            ctx.beginPath();
            ctx.ellipse(cp.x, cp.y, 8 + ik * 46, 10 + ik * 50, 0, 0, TAU);
            ctx.stroke();
            ctx.restore();
        }
    }
    // 魔鏡の障壁（魔法の型）
    if (style === 'magic' && p >= T.guard - 0.02 && p < T.strike + 0.02) {
        const k = win(p, T.guard - 0.02, T.guard) * (1 - win(p, T.strike, T.strike + 0.02));
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.translate(cp.x + 6, cp.y);
        ctx.globalAlpha = k * (0.7 + 0.3 * Math.sin(a.frame / 3));
        ctx.strokeStyle = colA;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let i = 0; i <= 6; i++) {
            const t = (i / 6) * TAU;
            const x = Math.cos(t) * 22, y = Math.sin(t) * 28;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.8;
        for (let i = 0; i < 6; i++) {
            const t = (i / 6) * TAU;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(t) * 22, Math.sin(t) * 28);
            ctx.stroke();
        }
        ctx.restore();
    }
    // 打ち返し: 金色の三日月が、ボスへ戻っていく
    const rk = win(p, T.strike, T.hit);
    if (rk > 0 && rk < 1 && style !== 'pierce' && style !== 'shot') {
        const u = ease(rk);
        crescent(ctx, lerp(cp.x, tg.x, u), lerp(cp.y, tg.y, u), -1, 1.5, colA, 1);
    }
    const hk = win(p, T.hit, T.hit + 0.14);
    if (style === 'blade') { // 居合の線と、遅れて刻まれる斬撃
        const ik = win(p, T.strike, T.strike + 0.05);
        if (ik > 0 && ik < 1)
            glowLine(ctx, fr.x + 40, fr.y - 60, a.body.x - 96, a.body.y + 8, 10 * (1 - ik) + 1, '#ffffff', 1 - ik);
        if (hk > 0 && hk < 1) {
            for (const [an, len] of [[-0.55, 74], [0.35, 80], [1.15, 66]])
                glowLine(ctx, tg.x - Math.cos(an) * len, tg.y - Math.sin(an) * len, tg.x + Math.cos(an) * len, tg.y + Math.sin(an) * len, 7 * (1 - hk) + 1, an > 0 ? colB : colA, 1 - hk);
            text(ctx, tl('斬！'), tg.x + 34, tg.y - 30, R(16 + 6 * (1 - hk)), '#ffffff', Math.min(1, (1 - hk) * 3), '#2a0a3a');
        }
    }
    else if (style === 'heavy') { // 衝撃を地面へ流して叩き返す
        const gk = win(p, T.strike, T.hit);
        if (gk > 0 && gk < 1) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = colA;
            ctx.lineWidth = 4 * (1 - gk) + 1;
            ctx.globalAlpha = 1 - gk * 0.4;
            const x = lerp(fr.x, tg.x, ease(gk));
            ctx.beginPath();
            ctx.ellipse(x, a.foot.y + 4, 14, 5, 0, 0, TAU);
            ctx.stroke();
            ctx.restore();
        }
        if (hk > 0 && hk < 1) {
            glowLine(ctx, tg.x, -200, tg.x, a.foot.y + 10, 22 * (1 - hk) + 2, colA, 1 - hk);
            rocks(a, tg.x, a.foot.y, hk, 'parryrock', 34, 130);
            dustCloud(a, tg.x, a.foot.y + 4, hk, 'parrydust', 1.8);
        }
    }
    else if (style === 'pierce') { // 衝撃の一点を、針のように突き抜く
        const hand = { x: fr.x - 8, y: fr.y - 14 };
        if (rk > 0) {
            const u = ease(clamp01(rk * 1.4)), ex = lerp(hand.x, a.body.x - 90, u), ey = lerp(hand.y, a.body.y + 2, u);
            const al = 1 - win(p, T.hit, T.hit + 0.1);
            glowLine(ctx, hand.x, hand.y, ex, ey, 3, colA, al);
            for (let i = 1; i <= 4; i++)
                glowLine(ctx, hand.x, hand.y + i * 3 - 6, lerp(hand.x, ex, 0.9), lerp(hand.y, ey, 0.9) + i * 3 - 6, 0.8, '#ffffff', al * 0.6);
        }
    }
    else if (style === 'shot') { // 受け止めた力を、いくつもの光弾にして撃ち返す
        for (let j = 0; j < 5; j++) {
            const t0 = clamp01(rk * 1.2 - j * 0.05);
            if (t0 <= 0 || t0 >= 1)
                continue;
            const off = (j - 2) * 20, pt = (u) => ({ x: lerp(cp.x, tg.x, u), y: lerp(cp.y, tg.y, u) + Math.sin(u * Math.PI) * off });
            const h = pt(ease(t0)), t = pt(Math.max(0, ease(t0) - 0.22));
            glowLine(ctx, t.x, t.y, h.x, h.y, 2.4, j % 2 ? colB : colA, 1);
            starSpark(ctx, h.x, h.y, 4, 1, '#ffffff');
        }
    }
    else { // magic: 障壁が砕けて破片が飛び、極大の光が反射される
        const sk = win(p, T.strike, T.strike + 0.06);
        if (sk > 0 && sk < 1) {
            const rng = new Rng(`${a.seed}:parryshard`);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 22; i++) {
                const an = rng.range(-1.2, 1.2) + Math.PI, sp = rng.range(10, 70);
                ctx.globalAlpha = 1 - sk;
                ctx.fillStyle = i % 3 ? colA : '#ffffff';
                ctx.fillRect(R(cp.x + 6 + Math.cos(an) * sp * sk), R(cp.y + Math.sin(an) * sp * sk * 1.2), 3, 2);
            }
            ctx.restore();
        }
        if (rk > 0 && rk < 1.2) {
            const w = (4 + 14 * ease(rk)) * (1 - win(p, T.hit, T.hit + 0.08)), x1 = lerp(cp.x, tg.x, ease(Math.min(1, rk * 1.5)));
            glowLine(ctx, cp.x, cp.y, x1, lerp(cp.y, tg.y, ease(Math.min(1, rk * 1.5))), w, colA, 1);
        }
    }
    impactBurst(a, tg.x, tg.y, hk, colA, colB, style === 'heavy' ? 1.3 : 1);
    flash(a, bump(p, T.hit - 0.003, T.hit + 0.04), '#ffffff', 0.85);
}
// ---- 封印（seal）: ボスの足元に封印陣が開き、光の鎖が絡みつく。軋んだところへ武器の型で打ちこんで封じ砕く ----
//   blade : 八振りの剣が降って、ボスを囲んで突き立つ
//   heavy : 巨大な武器が楔のように頭上から打ちこまれる
//   pierce: 光の槍が空から五本、斜めに貫いて縫いとめる
//   shot  : 封陣の縁から無数の矢が一点へ集まる
//   magic : 封陣が球体に閉じて縮み、中で光が炸裂する
function sealUlt(a, hero) {
    const { ctx, phase: p } = a;
    const T = ULT_T.seal, wp = a.ult?.weapon ?? 'sword', style = ultArt(wp).style, [colA, colB] = RUSH_COL[style];
    const ctr = { x: a.body.x + 2, y: a.foot.y + 4 }, bc = { x: a.body.x + 2, y: a.body.y };
    const gone = 1 - win(p, T.hit + 0.02, T.hit + 0.12);
    // 封印陣
    const ck = win(p, T.circle, T.chain) * gone;
    if (ck > 0)
        skyDisc(a, ctr.x, ctr.y, 84 * ease(win(p, T.circle, T.chain)), ck * (0.75 + 0.25 * Math.sin(a.frame / 4)), style === 'magic' ? 270 : style === 'heavy' ? 28 : style === 'shot' ? 50 : style === 'pierce' ? 140 : 195);
    // 光の鎖: 陣の縁から、ボスの胴へ巻きつく
    const bk = win(p, T.chain, T.bind), strain = win(p, T.bind, T.strain);
    const chainPts = [];
    if (bk > 0 && gone > 0) {
        for (let j = 0; j < 6; j++) {
            const th = (j / 6) * TAU + 0.3, P0 = { x: ctr.x + Math.cos(th) * 72, y: ctr.y + Math.sin(th) * 19 };
            const Pt = { x: bc.x + Math.cos(th + 0.9) * 24, y: bc.y - 20 + (j % 3) * 20 };
            const mid = { x: lerp(P0.x, Pt.x, 0.5) + Math.cos(th) * 14, y: lerp(P0.y, Pt.y, 0.5) - 16 };
            const trem = Math.sin(a.frame * 1.7 + j) * 1.6 * strain, N = 16, pts = [];
            for (let i = 0; i <= N; i++) {
                const u = (i / N) * ease(bk), q = 1 - u;
                pts.push({ x: q * q * P0.x + 2 * q * u * mid.x + u * u * Pt.x + trem, y: q * q * P0.y + 2 * q * u * mid.y + u * u * Pt.y });
            }
            chainPts.push(pts);
            const hot = strain * (0.5 + 0.5 * Math.sin(a.frame / 2 + j));
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = hot > 0.6 ? '#ff7a7a' : colA;
            ctx.globalAlpha = gone * 0.5;
            ctx.lineWidth = 3;
            ctx.beginPath();
            pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
            ctx.stroke();
            pts.forEach((q, i) => { if (i % 2)
                return; ctx.globalAlpha = gone; ctx.fillStyle = i % 4 ? '#ffffff' : colB; ctx.fillRect(R(q.x) - 2, R(q.y) - 1, 4, 2); });
            ctx.restore();
        }
    }
    // 封じられたボス: 陣の光が胴を取り巻く
    const lk = win(p, T.bind, T.strain) * gone;
    if (lk > 0) {
        glowArc(ctx, bc.x, bc.y + 6, 50, 20, a.frame / 12, a.frame / 12 + TAU * 0.8, 1.6, colA, lk * 0.8);
        glowArc(ctx, bc.x, bc.y - 14, 40, 15, -a.frame / 9, -a.frame / 9 + TAU * 0.7, 1.6, colB, lk * 0.7);
        if (strain > 0 && a.frame % 8 < 3)
            text(ctx, tl('封…！'), bc.x + 52, bc.y - 40, 10, '#ffffff', lk * strain, '#3a0a3a');
    }
    // 打ちこみ
    const dk = win(p, T.drive, T.hit);
    const live = gone;
    if (p >= T.drive && live > 0) {
        ctx.save();
        ctx.globalAlpha = live;
        if (style === 'blade') {
            const pal = SWORD_PAL[wp] ?? SWORD_PAL.sword;
            for (let i = 0; i < 8; i++) {
                const t0 = T.drive + i * 0.004, k = ease(win(p, t0, t0 + 0.022));
                if (p < t0)
                    continue;
                const ph = (i / 8) * TAU + 0.4, x = bc.x + Math.cos(ph) * 56, y = bc.y + 20 + Math.sin(ph) * 15;
                swordAt(ctx, x, lerp(-50, y, k), 0.5, k < 1 ? 1 : 0.4, a.frame, pal);
            }
        }
        else if (style === 'heavy') {
            const k = dk * dk, tip = lerp(-80, bc.y - 6, k);
            if (p < T.hit + 0.04)
                giantSprite(ctx, wp, bc.x, tip, 5, false, 1, 0);
            if (dk > 0.4 && dk < 1)
                for (let i = 0; i < 6; i++)
                    glowLine(ctx, bc.x - 14 + i * 5, tip - 110, bc.x - 14 + i * 5, tip - 40, 1, '#ffffff', 0.6);
        }
        else if (style === 'pierce') {
            for (let j = 0; j < 5; j++) {
                const t0 = T.drive + j * 0.005, k = ease(win(p, t0, t0 + 0.02));
                if (p < t0)
                    continue;
                const sx0 = bc.x + 70 + j * 12, sy0 = -70, tx = bc.x + (j - 2) * 15, ty = bc.y + (j % 2) * 14 - 4;
                const hx = lerp(sx0, tx, k), hy = lerp(sy0, ty, k), dx = (sx0 - tx) / 6, dy = (sy0 - ty) / 6;
                glowLine(ctx, hx + dx * 2.2, hy + dy * 2.2, hx, hy, 3.4, colA, 1);
                glowLine(ctx, hx + dx * 2.2, hy + dy * 2.2, hx, hy, 1, '#ffffff', 1);
                starSpark(ctx, hx, hy, 5, k < 1 ? 1 : 0.5, '#ffffff');
            }
        }
        else if (style === 'shot') {
            for (let i = 0; i < 16; i++) {
                const t0 = T.drive + (i % 8) * 0.003, k = ease(win(p, t0, t0 + 0.02));
                if (p < t0)
                    continue;
                const th = (i / 16) * TAU, P0 = { x: ctr.x + Math.cos(th) * 80, y: ctr.y + Math.sin(th) * 21 - (i % 2) * 30 }, Pt = { x: bc.x + (i % 3 - 1) * 6, y: bc.y + (i % 5 - 2) * 6 };
                const hx = lerp(P0.x, Pt.x, k), hy = lerp(P0.y, Pt.y, k), tx = lerp(P0.x, Pt.x, Math.max(0, k - 0.3)), ty = lerp(P0.y, Pt.y, Math.max(0, k - 0.3));
                glowLine(ctx, tx, ty, hx, hy, 1.6, i % 2 ? colB : colA, 1);
            }
        }
        else {
            const k = ease(dk), r = lerp(70, 6, k);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createRadialGradient(bc.x, bc.y, r * 0.5, bc.x, bc.y, r);
            g.addColorStop(0, 'rgba(255,255,255,0)');
            g.addColorStop(0.8, `${colA}55`);
            g.addColorStop(1, `${colA}cc`);
            ctx.globalAlpha = live * (0.6 + 0.4 * k);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(bc.x, bc.y, r, 0, TAU);
            ctx.fill();
            glowArc(ctx, bc.x, bc.y, r, r, a.frame / 10, a.frame / 10 + TAU * 0.85, 2, '#ffffff', live);
            ctx.restore();
        }
        ctx.restore();
    }
    // 封じ砕く: 鎖が砕け散り、光の柱が立つ
    const hk = win(p, T.hit, T.hit + 0.14);
    if (hk > 0 && hk < 1) {
        const rng = new Rng(`${a.seed}:sealbreak`);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        chainPts.forEach((pts, j) => pts.forEach((q, i) => { if (i % 2)
            return; const an = rng.range(0, TAU), sp = rng.range(10, 60); ctx.globalAlpha = 1 - hk; ctx.fillStyle = (i + j) % 3 ? colA : '#ffffff'; ctx.fillRect(R(q.x + Math.cos(an) * sp * hk), R(q.y + Math.sin(an) * sp * hk - 16 * hk), 3, 2); }));
        ctx.restore();
        glowLine(ctx, bc.x, -200, bc.x, a.foot.y + 10, 26 * (1 - hk) + 2, colA, 1 - hk);
        if (style === 'heavy') {
            rocks(a, bc.x, a.foot.y, hk, 'sealrock', 30, 120);
            dustCloud(a, bc.x, a.foot.y + 4, hk, 'sealdust', 1.6);
        }
        impactBurst(a, bc.x, bc.y + 4, hk, colA, colB, 1.1);
    }
    flash(a, bump(p, T.hit - 0.003, T.hit + 0.04), '#ffffff', 0.9);
    void hero;
}
// ---- 覚醒（awaken）: 気を解き放って姿が変わる。残像だけを残して駆け抜け、斬撃は遅れてやってくる ----
//   blade: 剣気の光条  heavy: 燃えさかる闘気  pierce: 螺旋の闘気  shot: 光の翼  magic: 周回する魔法陣
function awakenUlt(a, hero) {
    const { ctx, phase: p } = a;
    const T = ULT_T.awaken, style = ultArt(a.ult?.weapon).style, [colA, colB] = RUSH_COL[style];
    const end = awakenEnd(a.body), tg = { x: a.body.x + 2, y: a.body.y + 2 };
    const hx = hero.x, hy = hero.y;
    // 闘気: 解き放たれる（駆け抜けるときに消える）
    const fk = win(p, T.ready, T.flare) * (1 - win(p, T.blink, T.blink + 0.012));
    if (fk > 0) {
        const cx = hx, base = hy, top = hy - 120;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const w = 8 + 10 * fk + Math.sin(a.frame / 2) * 1.5, g = ctx.createLinearGradient(cx - w, 0, cx + w, 0);
        g.addColorStop(0, `${colA}00`);
        g.addColorStop(0.5, `${colA}cc`);
        g.addColorStop(1, `${colA}00`);
        ctx.globalAlpha = fk * 0.7;
        ctx.fillStyle = g;
        ctx.fillRect(cx - w, top, w * 2, base - top);
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = fk * 0.6;
        ctx.fillRect(R(cx) - 1, top, 2, base - top);
        for (let i = 0; i < 3; i++) {
            const t = (p * 9 + i / 3) % 1;
            ctx.globalAlpha = fk * (1 - t);
            ctx.strokeStyle = i % 2 ? colB : colA;
            ctx.lineWidth = 2 * (1 - t) + 0.5;
            ctx.beginPath();
            ctx.ellipse(cx, base, 6 + t * 48, 2 + t * 14, 0, 0, TAU);
            ctx.stroke();
        }
        const rng = new Rng(`${a.seed}:awaken`);
        if (style === 'heavy')
            for (let i = 0; i < 36; i++) {
                const t = (p * 6 + rng.next()) % 1;
                ctx.globalAlpha = fk * (1 - t);
                ctx.fillStyle = i % 3 ? colA : colB;
                ctx.fillRect(R(cx + rng.range(-16, 16) * (1 + t)), R(base - t * 80), 2, 3);
            }
        else if (style === 'blade')
            for (let i = 0; i < 5; i++) {
                const dx = (i - 2) * 7, h = 50 + ((i * 37 + a.frame * 3) % 40);
                glowLine(ctx, cx + dx, base - 6, cx + dx, base - h, 1.4, i % 2 ? '#ffffff' : colA, fk);
            }
        else if (style === 'pierce')
            for (let k2 = 0; k2 < 2; k2++) {
                ctx.strokeStyle = k2 ? colB : colA;
                ctx.globalAlpha = fk * 0.9;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                for (let i = 0; i <= 24; i++) {
                    const t = i / 24, x = cx + Math.sin(t * 9 + a.frame / 5 + k2 * Math.PI) * 11 * (1 - t * 0.4), y = base - t * 100;
                    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
                }
                ctx.stroke();
            }
        else if (style === 'shot')
            for (const sd of [-1, 1])
                for (let i = 0; i < 6; i++) {
                    const an = -0.5 - i * 0.28 + Math.sin(a.frame / 6) * 0.05, len = 40 - i * 3;
                    glowLine(ctx, cx + sd * 4, hy - 20, cx + sd * (4 + Math.cos(an) * len), hy - 20 + Math.sin(an) * len, 2.2 - i * 0.2, i % 2 ? colB : colA, fk * 0.8);
                }
        else
            for (let i = 0; i < 3; i++) {
                ctx.save();
                ctx.translate(cx, hy - 18);
                ctx.rotate(i * 1.05 + a.frame / 18);
                ctx.scale(1, 0.32);
                ctx.globalAlpha = fk * 0.85;
                ctx.strokeStyle = i % 2 ? colB : colA;
                ctx.lineWidth = 2.4;
                ctx.beginPath();
                ctx.arc(0, 0, 20 + i * 4, 0, TAU);
                ctx.stroke();
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(R(Math.cos(a.frame / 8 + i) * 20) - 1, R(Math.sin(a.frame / 8 + i) * 20) - 1, 3, 3);
                ctx.restore();
            }
        ctx.restore();
        text(ctx, tl('覚醒！'), hx + 6, hy - 62, R(11 + 4 * bump(p, T.flare, T.flare + 0.03)), '#ffffff', win(p, T.flare, T.flare + 0.01) * (1 - win(p, T.hold, T.blink)), '#3a0a3a');
    }
    // 駆け抜ける: 一直線の光の筋
    const bk = win(p, T.blink, T.land);
    if (bk > 0 && p < T.hit + 0.04) {
        const x1 = lerp(hx, end.x, ease(bk)), y1 = lerp(hy, end.y, ease(bk)) - 14, al = 1 - win(p, T.land, T.hit);
        glowLine(ctx, hx, hy - 14, x1, y1, 5 * (1 - bk * 0.6), colA, al);
        for (let i = 0; i < 5; i++)
            glowLine(ctx, hx, hy - 14 + (i - 2) * 6, lerp(hx, x1, 0.9), lerp(hy - 14, y1, 0.9) + (i - 2) * 6, 0.8, '#ffffff', al * 0.5);
    }
    const lk = win(p, T.land, T.land + 0.01) * (1 - win(p, T.hit, T.hit + 0.04));
    if (lk > 0)
        starSpark(ctx, end.x, end.y - 14, 12, lk, '#ffffff');
    // 斬撃は遅れてやってくる: 駆け抜けたあとで、一斉にボスへ刻まれる
    const hk = win(p, T.hit, T.hit + 0.14);
    if (hk > 0 && hk < 1) {
        const rng = new Rng(`${a.seed}:awakencut`);
        for (let i = 0; i < 12; i++) {
            const an = rng.range(0, Math.PI), len = rng.range(50, 96), o = { x: rng.range(-18, 18), y: rng.range(-16, 16) };
            glowLine(ctx, tg.x + o.x - Math.cos(an) * len, tg.y + o.y - Math.sin(an) * len, tg.x + o.x + Math.cos(an) * len, tg.y + o.y + Math.sin(an) * len, 5 * (1 - hk) + 0.8, i % 2 ? colB : colA, 1 - hk);
        }
        if (style === 'heavy') {
            rocks(a, tg.x, a.foot.y, hk, 'awakenrock', 30, 130);
            dustCloud(a, tg.x, a.foot.y + 4, hk, 'awakendust', 1.6);
        }
        if (style === 'magic')
            glowLine(ctx, tg.x, -200, tg.x, a.foot.y + 10, 24 * (1 - hk) + 2, colA, 1 - hk);
        if (style === 'pierce' || style === 'shot')
            for (let i = 0; i < 12; i++) {
                const an = (i / 12) * TAU, len = 70 * ease(hk);
                glowLine(ctx, tg.x, tg.y, tg.x + Math.cos(an) * len, tg.y + Math.sin(an) * len * 0.7, 2 * (1 - hk) + 0.5, i % 2 ? colB : '#ffffff', 1 - hk);
            }
        impactBurst(a, tg.x, tg.y, hk, colA, colB, 1.2);
        text(ctx, tl('…遅れて、斬撃が降る'), tg.x + 8, tg.y - 54, 9, '#ffffff', Math.min(1, (1 - hk) * 3), '#3a0a3a');
    }
    flash(a, bump(p, T.hit - 0.003, T.hit + 0.04), '#ffffff', 0.9);
    flash(a, bump(p, T.flare - 0.004, T.flare + 0.02), '#ffffff', 0.5);
}
// 光る弧（外側の色 → 白い芯）
function glowArc(ctx, cx, cy, rx, ry, a0, a1, w, col, alpha) {
    if (alpha <= 0 || w <= 0 || a1 === a0)
        return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.globalAlpha = Math.min(1, alpha) * 0.35;
    ctx.strokeStyle = col;
    ctx.lineWidth = w * 2.4;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, a0, a1);
    ctx.stroke();
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, a0, a1);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, w * 0.35);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, a0, a1);
    ctx.stroke();
    ctx.restore();
}
// 十字の火花
function starSpark(ctx, x, y, r, alpha, col = '#ffffff') {
    if (alpha <= 0 || r <= 0)
        return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.fillStyle = col;
    ctx.fillRect(R(x - r), R(y), R(r * 2), 1);
    ctx.fillRect(R(x), R(y - r), 1, R(r * 2));
    ctx.fillRect(R(x - r * 0.4), R(y - 1), R(r * 0.8), 3);
    ctx.fillRect(R(x - 1), R(y - r * 0.4), 3, R(r * 0.8));
    ctx.restore();
}
// ---- 乱舞（rush）: 武器ごとの最終必殺技。八手を重ねて、最後に一斉に爆ぜる ----
function rushUlt(a, hero) {
    const { ctx, phase: p } = a;
    const T = ULT_T.rush, art = rushArt(a.ult?.weapon), style = art.style, [colA, colB] = RUSH_COL[style];
    const steps = rushSteps(style, a.foot, a.body), spot = magicSpot(a.body);
    const burst = win(p, T.burst, T.burst + 0.1);
    const charge = win(p, T.first + T.n * T.pass, T.burst); // 最後に全部が光る
    const bx = a.body.x + 2, by = a.body.y;
    // 構え: 風（魔法の人は光）が集まる
    const rk = win(p, T.ready - 0.02, T.go);
    if (rk > 0 && p < T.first) {
        ctx.save();
        ctx.strokeStyle = style === 'magic' ? '#e2c2ff' : '#bfe8ff';
        ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
            const t = (rk * 3 + i / 6) % 1;
            ctx.globalAlpha = (1 - t) * rk * 0.8;
            ctx.beginPath();
            ctx.arc(hero.x, hero.y - 12, 26 * (1 - t) + 4, i, i + 1.2);
            ctx.stroke();
        }
        ctx.restore();
    }
    // 主役のまわりのオーラ（隊列にまぎれないように）
    const gi = Math.min(T.n - 1, Math.max(0, Math.floor((p - T.first) / T.pass)));
    const gk = win(p, T.go, T.first) * (1 - win(p, T.burst + 0.03, T.burst + 0.08));
    if (gk > 0) {
        const gp = style === 'magic' ? { x: spot.x, y: spot.y - 6 } : p < T.first ? null : stepAt(steps[gi], ease(clamp01((p - T.first - gi * T.pass) / T.pass / 0.55)));
        if (gp) {
            const g = ctx.createRadialGradient(gp.x, gp.y - 12, 0, gp.x, gp.y - 12, 30);
            g.addColorStop(0, 'rgba(255,255,255,0.45)');
            g.addColorStop(0.5, `${colA}55`);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = gk * (0.7 + 0.3 * Math.sin(a.frame / 3));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(gp.x, gp.y - 12, 30, 0, TAU);
            ctx.fill();
            ctx.restore();
        }
    }
    // 一手ごとの見せ場
    let hits = 0;
    steps.forEach((s, i) => {
        const u = (p - (T.first + i * T.pass)) / T.pass;
        if (u <= 0)
            return;
        const mv = clamp01(u / 0.55), m = ease(mv);
        if (m >= 0.5)
            hits++;
        if (burst >= 1 || s.fx === 'cast')
            return;
        const col = i % 2 ? colB : colA;
        const fresh = 1 - clamp01((u - 0.55) / 1.5);
        const hp = stepAt(s, m); // いまの主役の位置（足元）
        if (s.fx === 'cut') { // 斬撃の線: 切り抜けるたびに1本ずつ増え、交差して溜まっていく
            const l = cutLine(a.body, s, i);
            const hx = lerp(l.x0, l.x1, m), hy = lerp(l.y0, l.y1, m);
            const w = (1.6 + fresh * 3) * (1 + charge * 1.2) * (1 - burst);
            glowLine(ctx, l.x0, l.y0, hx, hy, w, col, (0.55 + 0.45 * Math.max(fresh, charge)) * (1 - burst));
            const hk = clamp01((u - 0.45) / 0.6);
            if (hk > 0 && hk < 1) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = 1 - hk;
                ctx.fillStyle = '#ffffff';
                for (let j = 0; j < 8; j++) {
                    const an = (j / 8) * TAU + i;
                    ctx.fillRect(R(l.cx + Math.cos(an) * hk * 18), R(l.cy + Math.sin(an) * hk * 12), 2, 2);
                }
                ctx.restore();
            }
        }
        else if (s.fx === 'whirl') { // 旋風: ボスのまわりをぐるりと一周する光の輪
            const k = ease(clamp01(u / 0.8)), r = 46 + (i % 2) * 10, a0 = i * 1.1;
            glowArc(ctx, bx, by + 8, r * 1.3, r * 0.5, a0, a0 + TAU * k, (2 + fresh * 3) * (1 - burst), col, Math.max(fresh, 0.25) * (1 - burst));
            if (k > 0.1 && k < 1) {
                const an = a0 + TAU * k;
                starSpark(ctx, bx + Math.cos(an) * r * 1.3, by + 8 + Math.sin(an) * r * 0.5, 5, 1 - k * 0.5, colB);
            }
        }
        else if (s.fx === 'smash') { // 叩きつけ: 縦の軌跡と、地面を走る衝撃波・岩片
            const sx = bx + (i % 2 ? -16 : 14), top = by - 70, ground = a.foot.y + 8;
            const down = s.ang > 0, k = ease(clamp01(u / 0.5));
            const yA = down ? top : ground, yB = down ? lerp(top, ground, k) : lerp(ground, top, k);
            glowLine(ctx, sx, yA, sx, yB, (3 + fresh * 4) * (1 - burst), col, Math.max(fresh, 0.2) * (1 - burst));
            const ik = clamp01((u - 0.35) / 0.9);
            if (ik > 0 && ik < 1) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = (1 - ik) * 0.9;
                ctx.strokeStyle = colB;
                ctx.lineWidth = 3 * (1 - ik) + 1;
                ctx.beginPath();
                ctx.ellipse(sx, a.foot.y + 4, 8 + ik * 64, 3 + ik * 14, 0, 0, TAU);
                ctx.stroke();
                ctx.restore();
                rocks(a, sx, a.foot.y, ik, `rushrock${i}`, i === T.n - 1 ? 18 : 8, i === T.n - 1 ? 90 : 50);
                starSpark(ctx, sx, a.foot.y, 10 * (1 - ik), 1 - ik, '#ffffff');
            }
        }
        else if (s.fx === 'thrust') { // 突き: 手元から光の槍がのびて、ボスを貫く。細い残像の槍が重なる
            const dir = hp.x > bx ? -1 : 1, hand = { x: hp.x + dir * 8, y: hp.y - 13 };
            const tgt = { x: bx - dir * 28, y: by + 2 + ((i % 3) - 1) * 8 };
            const k = ease(clamp01(u / 0.4)), head = { x: lerp(hand.x, tgt.x, k), y: lerp(hand.y, tgt.y, k) };
            const al = Math.max(fresh, 0.2) * (1 - burst), w = (2 + fresh * 2.5) * (1 - burst);
            glowLine(ctx, hand.x, hand.y, head.x, head.y, w, col, al);
            glowLine(ctx, hand.x, hand.y - 3, head.x, head.y - 2, 1, colB, al * 0.6);
            glowLine(ctx, hand.x, hand.y + 3, head.x, head.y + 2, 1, colB, al * 0.6);
            starSpark(ctx, head.x, head.y, 8 * (1 - clamp01((u - 0.4) / 0.6)), k >= 1 ? 1 : 0, '#ffffff');
        }
        else if (s.fx === 'shot') { // 連射: 撃ち出される矢（光線）。撃つたびに銃口が光る
            const from = { x: hp.x - 8, y: hp.y - 14 }, to = { x: bx + ((i * 7) % 5 - 2) * 6, y: by + ((i * 3) % 5 - 2) * 7 };
            const k = clamp01((u - 0.1) / 0.35);
            if (k > 0 && k < 1.6) {
                const k1 = Math.min(1, k), k0 = Math.max(0, k - 0.3);
                if (a.ult?.weapon === 'bow') {
                    glowLine(ctx, lerp(from.x, to.x, k0), lerp(from.y, to.y, k0), lerp(from.x, to.x, k1), lerp(from.y, to.y, k1), 1.6, '#ffffff', 1 - clamp01((k - 1) / 0.6));
                    ctx.save();
                    ctx.fillStyle = colA;
                    ctx.globalAlpha = 1 - clamp01((k - 1) / 0.3);
                    ctx.fillRect(R(lerp(from.x, to.x, k1)) - 1, R(lerp(from.y, to.y, k1)) - 1, 3, 3);
                    ctx.restore();
                }
                else
                    glowLine(ctx, lerp(from.x, to.x, k0 * 0.5), lerp(from.y, to.y, k0 * 0.5), lerp(from.x, to.x, k1), lerp(from.y, to.y, k1), 3.2, '#9dff9d', 1 - clamp01((k - 1) / 0.6));
                if (k >= 1)
                    starSpark(ctx, to.x, to.y, 9 * (1 - clamp01((k - 1) / 0.6)), 1 - clamp01((k - 1) / 0.6), colA);
            }
            starSpark(ctx, from.x - 2, from.y, 7 * (1 - clamp01(u / 0.35)), 1 - clamp01(u / 0.35), '#ffffff');
        }
    });
    // 八重詠唱: 杖の前に魔法陣が一枚ずつ重なって砲身になる。最後に、全部を貫く極大のビーム
    if (style === 'magic')
        magicCannon(a, spot, hits, charge, burst);
    // 矢（光線）の雨: 撃ち尽くす直前から、空から降りそそぐ
    if (style === 'shot') {
        const rk = win(p, T.first + (T.n - 2) * T.pass, T.burst);
        if (rk > 0 && burst < 1) {
            const rng = new Rng(`${a.seed}:rushrain`);
            for (let i = 0; i < 34; i++) {
                const tx = bx + rng.range(-74, 74), ty = by + rng.range(-8, 26), t0 = rng.range(0, 0.7), q = clamp01((rk - t0 * 0.8) / 0.3);
                if (q <= 0 || q >= 1.4)
                    continue;
                const k1 = Math.min(1, q), k0 = Math.max(0, q - 0.25);
                const sx0 = tx + 56, sy0 = ty - 170;
                glowLine(ctx, lerp(sx0, tx, k0), lerp(sy0, ty, k0), lerp(sx0, tx, k1), lerp(sy0, ty, k1), 1.4, i % 3 ? colA : colB, (1 - clamp01((q - 1) / 0.4)) * (1 - burst));
                if (q >= 1)
                    starSpark(ctx, tx, ty, 6 * (1 - clamp01((q - 1) / 0.4)), 1 - clamp01((q - 1) / 0.4), '#ffffff');
            }
        }
    }
    // 全部が一斉に爆ぜる
    if (burst > 0 && burst < 1) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        if (style === 'blade') { // 溜まった斬撃線にそって、光の粒が飛び散る
            const rng = new Rng(`${a.seed}:rushburst`);
            steps.forEach((s, i) => {
                const l = cutLine(a.body, s, i);
                for (let j = 0; j < 10; j++) {
                    const t = rng.next(), ang = rng.range(0, TAU), sp = rng.range(20, 70);
                    ctx.globalAlpha = 1 - burst;
                    ctx.fillStyle = (i + j) % 3 ? (i % 2 ? colA : colB) : '#ffffff';
                    ctx.fillRect(R(lerp(l.x0, l.x1, t) + Math.cos(ang) * sp * burst), R(lerp(l.y0, l.y1, t) + Math.sin(ang) * sp * burst * 0.7), 3, 3);
                }
            });
        }
        else if (style === 'pierce') { // 光の大槍が、ボスを横一文字に貫く
            glowLine(ctx, bx - 170, by + 2, bx + 170, by + 2, 18 * (1 - burst) + 2, colA, 1 - burst);
            glowLine(ctx, bx - 60, by - 30, bx + 60, by + 34, 6 * (1 - burst), colB, 0.8 * (1 - burst));
        }
        else if (style === 'heavy') { // 地面ごと砕く
            for (let i = 0; i < 3; i++) {
                const kk = clamp01(burst * 1.3 - i * 0.15);
                if (kk <= 0 || kk >= 1)
                    continue;
                ctx.globalAlpha = 1 - kk;
                ctx.strokeStyle = i === 1 ? '#ffffff' : colA;
                ctx.lineWidth = 5 * (1 - kk) + 1;
                ctx.beginPath();
                ctx.ellipse(bx, a.foot.y + 4, 10 + kk * (170 + i * 40), 4 + kk * (40 + i * 10), 0, 0, TAU);
                ctx.stroke();
            }
            glowLine(ctx, bx, by - 180, bx, a.foot.y + 10, 14 * (1 - burst) + 2, colA, 1 - burst);
        }
        for (let i = 0; i < 3; i++) {
            const kk = clamp01(burst * 1.3 - i * 0.15);
            if (kk <= 0 || kk >= 1)
                continue;
            ctx.globalAlpha = 1 - kk;
            ctx.strokeStyle = i === 1 ? '#ffffff' : colB;
            ctx.lineWidth = 5 * (1 - kk) + 1;
            ctx.beginPath();
            ctx.ellipse(bx, a.body.y, 10 + kk * (120 + i * 30), 8 + kk * (70 + i * 16), 0, 0, TAU);
            ctx.stroke();
        }
        const g = ctx.createRadialGradient(bx, a.body.y, 0, bx, a.body.y, 60);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.4, 'rgba(255,200,230,0.6)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 1 - burst;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(bx, a.body.y, 60 * (0.6 + burst), 0, TAU);
        ctx.fill();
        ctx.restore();
        if (style === 'heavy') {
            rocks(a, bx, a.foot.y, burst, 'rushrockbig', 40, 150);
            dustCloud(a, bx, a.foot.y + 4, burst, 'rushdust', 1.8);
        }
    }
    flash(a, bump(p, T.finish - 0.003, T.finish + 0.012), '#ffffff', 0.45);
    flash(a, bump(p, T.burst - 0.003, T.burst + 0.04), '#ffffff', style === 'magic' ? 0.55 : 0.9);
    // ヒット数のカウンター
    const showK = win(p, T.first, T.first + 0.01) * (1 - win(p, T.burst + 0.12, T.burst + 0.16));
    if (showK > 0 && hits > 0) {
        const u = (p - (T.first + (hits - 1) * T.pass)) / T.pass - 0.5;
        const pop = 1 + 0.5 * (1 - clamp01(u / 0.6));
        const x = a.body.x + 96, y = a.body.y - 22;
        text(ctx, 'HIT', x - 20, y + 2, 9, '#ffe9a0', showK, '#3a1a00');
        text(ctx, `×${hits}`, x + 8, y, R(16 * pop), hits >= T.n ? (a.frame % 6 < 3 ? '#ffffff' : '#ff9ce6') : '#ffffff', showK, '#3a1a00');
        if (p > T.burst)
            text(ctx, 'FINISH!', x, y + 18, 11, '#ff9ce6', showK, '#3a0a3a');
    }
}
// 八重詠唱の魔法陣（杖の前に一枚ずつ重なる）と、最後の極大ビーム
function magicCannon(a, spot, hits, charge, burst) {
    const { ctx, phase: p } = a;
    const T = ULT_T.rush;
    const H = { x: spot.x - 16, y: spot.y - 16 }; // 杖の先
    const B = { x: a.body.x + 12, y: a.body.y + 2 };
    const dx = B.x - H.x, dy = B.y - H.y, ang = Math.atan2(dy, dx);
    const ringAt = (i) => { const t = 0.16 + 0.6 * (i / (T.n - 1)); return { x: H.x + dx * t, y: H.y + dy * t, ry: 9 + i * 2.8, rx: 3.5 + i * 0.9 }; };
    const hue = (i) => 275 - i * 11;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // 詠唱中の魔法陣
    for (let i = 0; i < Math.min(hits, T.n); i++) {
        const u = (p - (T.first + i * T.pass)) / T.pass, k = ease(clamp01(u / 0.6));
        const r = ringAt(i), out = 1 - win(p, T.burst + 0.05, T.burst + 0.14);
        if (out <= 0)
            continue;
        const rx = r.rx * (0.4 + 0.6 * k), ry = r.ry * (0.4 + 0.6 * k);
        const al = out * (0.55 + 0.45 * Math.max(charge, 1 - clamp01(u / 3)));
        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.rotate(ang);
        const col = `hsl(${hue(i)},100%,70%)`;
        ctx.globalAlpha = al * 0.3;
        ctx.strokeStyle = col;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = al;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
        ctx.stroke();
        // 回る刻み
        for (let j = 0; j < 8; j++) {
            const t = a.frame / (14 + i * 2) * (i % 2 ? -1 : 1) + (j / 8) * TAU;
            ctx.globalAlpha = al * (j % 2 ? 0.6 : 1);
            ctx.fillStyle = j % 2 ? col : '#ffffff';
            ctx.fillRect(R(Math.cos(t) * rx) - 1, R(Math.sin(t) * ry) - 1, 2, 2);
        }
        ctx.restore();
        // 現れた瞬間の閃光
        if (u < 0.45)
            starSpark(ctx, r.x, r.y, 4 + ry * 0.5, 1 - u / 0.45, '#ffffff');
        // 杖から魔法陣へ、いま唱えた詠唱の光の糸
        if (u > 0 && u < 0.5)
            glowLine(ctx, H.x, H.y, r.x, r.y, 1.2, col, 1 - u / 0.5);
    }
    ctx.restore();
    // 力が杖に集まる（撃つ直前）
    if (charge > 0 && p < T.burst) {
        const rng = new Rng(`${a.seed}:magicgather`);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 18; i++) {
            const t = (charge * 2.2 + rng.next()) % 1, an = rng.range(0, TAU), d = (1 - t) * rng.range(14, 36);
            ctx.globalAlpha = t * charge;
            ctx.fillStyle = i % 2 ? '#e2c2ff' : '#ffffff';
            ctx.fillRect(R(H.x + Math.cos(an) * d), R(H.y + Math.sin(an) * d * 0.8), 2, 2);
        }
        ctx.restore();
    }
    // ビーム: 魔法陣を貫いて、ボスへ。着弾後も少し続いて、細くなって消える
    const b0 = T.first + T.n * T.pass - 0.012, bk = win(p, b0, T.burst), fade = 1 - win(p, T.burst + 0.05, T.burst + 0.13);
    if (bk > 0 && fade > 0) {
        const w = (3 + 24 * ease(win(p, b0, T.burst + 0.02))) * fade;
        const reach = p < T.burst ? ease(bk) : 1 + 0.35 * win(p, T.burst, T.burst + 0.04);
        const end = { x: H.x + dx * reach, y: H.y + dy * reach };
        glowLine(ctx, H.x, H.y, end.x, end.y, w, `hsl(${hue(0) - 20},100%,70%)`, fade);
        glowLine(ctx, H.x, H.y, end.x, end.y, w * 0.5, '#7fe0ff', fade * 0.8);
        // ビームの上を流れる光の粒
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 16; i++) {
            const t = ((a.frame * 0.09 + i / 16) % 1) * reach, off = Math.sin(a.frame / 2 + i * 2.1) * w * 0.6;
            ctx.globalAlpha = fade;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(R(H.x + dx * t - Math.sin(ang) * off), R(H.y + dy * t + Math.cos(ang) * off), 2, 2);
        }
        ctx.restore();
        starSpark(ctx, H.x, H.y, 8 + w * 0.5, fade, '#ffffff');
    }
}
// ---- 召喚: 足元の魔法陣 → 天が割れて光の柱 → 巨大な剣がゆっくり降り、一気に突き刺さる → 光のドーム・余震 ----
function summonCircle(a, hero) {
    const { ctx, phase: p } = a;
    const T = ULT_T.summon;
    const k = win(p, T.circle, T.circle + 0.06), out = 1 - win(p, T.impact + 0.04, T.impact + 0.12);
    if (k <= 0 || out <= 0)
        return;
    const r = 48 * ease(k), rot = a.frame / 30;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(hero.x, hero.y + 1);
    ctx.scale(1, 0.34);
    ctx.globalAlpha = 0.22 * out;
    ctx.fillStyle = '#5fcde4';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = out;
    ctx.strokeStyle = '#9fe8ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.82, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.4, 0, TAU);
    ctx.stroke();
    ctx.rotate(rot);
    ctx.fillStyle = '#ffe9a0';
    for (let i = 0; i < 24; i++) {
        const t = (i / 24) * TAU, s = i % 3 ? 2 : 4;
        ctx.fillRect(R(Math.cos(t) * r * 0.91) - s / 2, R(Math.sin(t) * r * 0.91) - s / 2, s, s);
    }
    ctx.strokeStyle = '#9fe8ff';
    ctx.lineWidth = 1.5;
    ctx.rotate(-rot * 2.5);
    for (const off of [0, Math.PI / 3]) {
        ctx.beginPath();
        for (let i = 0; i <= 3; i++) {
            const t = off + (i / 3) * TAU, x = Math.cos(t) * r * 0.8, y = Math.sin(t) * r * 0.8;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
    }
    ctx.restore();
}
const SWORD_PAL = {
    sword: { edge: '#2a3a5a', blade: '#c8e4f4', fuller: '#5fcde4', gem: '#ff4fa0' },
    katana: { edge: '#4a2a3a', blade: '#f4f4ff', fuller: '#ff5a6e', gem: '#e43b44' },
    dagger: { edge: '#3a2a5a', blade: '#e0d4ff', fuller: '#a55bd8', gem: '#7bed9f' },
};
function swordAt(ctx, x, tip, s, glow, frame, pal = SWORD_PAL.sword) {
    const B = 84 * s, Wd = 7 * s, gy = tip - B; // gy は鍔の位置
    ctx.save();
    if (glow > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(x - 30 * s, 0, x + 30 * s, 0);
        g.addColorStop(0, 'rgba(159,232,255,0)');
        g.addColorStop(0.5, `rgba(200,245,255,${0.45 * glow})`);
        g.addColorStop(1, 'rgba(159,232,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 30 * s, gy - 30 * s, 60 * s, B + 36 * s);
        ctx.restore();
    }
    // 刀身
    ctx.fillStyle = pal.edge;
    ctx.beginPath();
    ctx.moveTo(x - Wd - 1, gy);
    ctx.lineTo(x + Wd + 1, gy);
    ctx.lineTo(x + Wd + 1, tip - 14 * s);
    ctx.lineTo(x, tip + 2);
    ctx.lineTo(x - Wd - 1, tip - 14 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pal.blade;
    ctx.beginPath();
    ctx.moveTo(x - Wd, gy);
    ctx.lineTo(x + Wd, gy);
    ctx.lineTo(x + Wd, tip - 14 * s);
    ctx.lineTo(x, tip);
    ctx.lineTo(x - Wd, tip - 14 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(R(x - Wd + 2 * s), R(gy + 2), R(2 * s), R(B - 18 * s));
    ctx.fillStyle = '#7aa8c8';
    ctx.fillRect(R(x + Wd - 3 * s), R(gy + 2), R(2 * s), R(B - 18 * s));
    ctx.fillStyle = pal.fuller;
    ctx.fillRect(R(x - 1), R(gy + 6), 2, R(B - 26 * s)); // 樋の光
    ctx.fillStyle = '#ffffff'; // 刀身を流れるルーン
    for (let i = 0; i < 5; i++) {
        const yy = gy + 10 * s + ((i * 14 * s + frame * 2) % (B - 30 * s));
        ctx.fillRect(R(x - 1), R(yy), 2, 3);
    }
    // 鍔・宝石・柄・柄頭
    ctx.fillStyle = '#8a5a10';
    ctx.fillRect(R(x - 22 * s), R(gy - 6 * s), R(44 * s), R(7 * s));
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(R(x - 21 * s), R(gy - 5 * s), R(42 * s), R(4 * s));
    ctx.fillStyle = '#ffe9a0';
    ctx.fillRect(R(x - 21 * s), R(gy - 5 * s), R(42 * s), 1);
    ctx.fillStyle = pal.gem;
    ctx.fillRect(R(x - 3 * s), R(gy - 6 * s), R(6 * s), R(6 * s));
    ctx.fillStyle = '#4a2a10';
    ctx.fillRect(R(x - 3 * s), R(gy - 26 * s), R(6 * s), R(20 * s));
    ctx.fillStyle = '#7a4a22';
    for (let i = 0; i < 4; i++)
        ctx.fillRect(R(x - 3 * s), R(gy - 24 * s + i * 5 * s), R(6 * s), 1);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(R(x - 5 * s), R(gy - 32 * s), R(10 * s), R(7 * s));
    ctx.restore();
}
// 巨大な武器の絵（手持ちの武器の拡大）。cx の位置に、先端を下へ向けて tip の高さに置く
function giantSprite(ctx, kind, cx, tip, scale, upright, glow, tilt = 0) {
    const sp = weaponSprite(kind), w = sp.width * scale, h = sp.height * scale;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (upright)
        ctx.translate(cx, tip + h / 2);
    else {
        ctx.translate(cx, tip - h / 2);
        ctx.rotate(Math.PI);
    }
    ctx.rotate(tilt);
    if (glow > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.5 * glow;
        for (const [ox, oy] of [[-3, 0], [3, 0], [0, -3], [0, 3]])
            ctx.drawImage(sp, -w / 2 + ox, -h / 2 + oy, w, h);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
    }
    ctx.drawImage(sp, -w / 2, -h / 2, w, h);
    ctx.restore();
}
// 召喚の主役: 持っている武器の巨大版が、天から降りてくる（ゆっくり降りる → 一気に落ちる → 刺さったまま光って消える）
//   blade/pierce: 先を下にして突き刺さる（短剣は無数に降る）  heavy: 頭から叩きつける
//   shot: 天に浮かぶ武器から、極大の矢（光線）が降る  magic: 天に浮かぶ武器から、光の柱が落ちる
// 天の巨大な武器の高さ: 画面上の札（場面の見出し）に隠れないよう、ボスの頭上の少し上に
const skyY = (a) => Math.max(72, a.body.y - 50);
// ---- 召喚の個別演出（弓・魔導書・ギター）: 天の巨大な武器そのものが「技」を放つ ----
// 弓: 天に巨大な弓が現れて、光の大矢を引きしぼる → 放つと一本の大矢が貫き、遅れて流星群の矢が降りそそぐ
function summonBow(a, sx, out) {
    const { ctx, phase: p } = a;
    const T = ULT_T.summon, ground = a.foot.y - 2, by = skyY(a);
    const appear = ease(win(p, T.split, T.descend + 0.03)) * (1 - win(p, T.impact + 0.08, T.home));
    const draw = ease(win(p, T.descend, T.plunge)); // 引きしぼり
    const released = p >= T.plunge;
    if (appear > 0) {
        ctx.save();
        ctx.globalAlpha = out * appear;
        // 弓（左右に大きく開いた弧。引くほどしなる）
        const span = 70, bend = 22 + 10 * (released ? 0 : draw);
        ctx.globalCompositeOperation = 'lighter';
        for (const [w0, col, al] of [[9, '#ffe27a', 0.25], [4, '#ffd166', 0.8], [1.5, '#ffffff', 1]]) {
            ctx.globalAlpha = out * appear * al;
            ctx.strokeStyle = col;
            ctx.lineWidth = w0;
            ctx.beginPath();
            ctx.moveTo(sx - span, by);
            ctx.quadraticCurveTo(sx, by + bend * 2.2, sx + span, by);
            ctx.stroke();
        }
        // 弦（引くと上へ。放つと震える）
        const nockY = released ? by - 2 + Math.sin(a.frame * 2.5) * 6 * (1 - win(p, T.plunge, T.impact + 0.1)) : by - 4 - 46 * draw;
        ctx.globalAlpha = out * appear;
        ctx.strokeStyle = '#fff6c8';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(sx - span, by);
        ctx.lineTo(sx, nockY);
        ctx.lineTo(sx + span, by);
        ctx.stroke();
        // つがえた光の大矢（ためるほど輝く）
        if (!released && draw > 0) {
            glowLine(ctx, sx, nockY, sx, by + 60, 5 + 5 * draw, '#ffe27a', 0.6 + 0.4 * draw);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(sx - 10, by + 56);
            ctx.lineTo(sx + 10, by + 56);
            ctx.lineTo(sx, by + 78);
            ctx.closePath();
            ctx.fill();
            // 矢じりに集まる光
            const rng = new Rng(`${a.seed}:bowgather`);
            for (let i = 0; i < 16; i++) {
                const ang = rng.range(0, TAU), d = (1 - ((p * 7 + rng.next()) % 1)) * 50;
                ctx.globalAlpha = out * draw;
                ctx.fillStyle = i % 2 ? '#ffe27a' : '#ffffff';
                ctx.fillRect(R(sx + Math.cos(ang) * d), R(by + 70 + Math.sin(ang) * d * 0.6), 2, 2);
            }
        }
        ctx.restore();
    }
    // 一本の大矢が貫く
    if (released && p < T.impact + 0.04) {
        const k = win(p, T.plunge, T.impact), tip = lerp(by + 78, ground + 4, k);
        ctx.save();
        ctx.globalAlpha = out;
        glowLine(ctx, sx, -40, sx, tip - 10, 12, '#ffe27a', 1);
        glowLine(ctx, sx, -40, sx, tip, 3, '#ffffff', 1);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(sx - 12, tip - 16);
        ctx.lineTo(sx + 12, tip - 16);
        ctx.lineTo(sx, tip + 8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
    // 流星群: 遅れて無数の光の矢が、斜めに降りそそぐ
    if (p >= T.plunge && p < T.home) {
        const rng = new Rng(`${a.seed}:bowrain`);
        ctx.save();
        ctx.globalAlpha = out;
        for (let i = 0; i < 36; i++) {
            const t0 = T.plunge + 0.01 + rng.range(0, 0.14), dur = rng.range(0.025, 0.04);
            const tx = sx + rng.range(-70, 70), ty = ground + rng.range(-10, 8);
            const k = (p - t0) / dur;
            if (k < 0)
                continue;
            if (k < 1) {
                const x = lerp(tx - 60, tx, k), y = lerp(-30, ty, k);
                glowLine(ctx, x - 14, y - 26, x, y, 1.6, i % 3 ? '#ffe27a' : '#9fe8ff', 0.9);
            }
            else if (k < 2.2)
                starSpark(ctx, tx, ty, 6 * (2.2 - k), (2.2 - k) * 0.8, '#fff6c8');
        }
        ctx.restore();
    }
}
// 魔導書: 天に巨大な魔導書が開き、頁が舞い、三重の魔法陣が縦に重なる → 魔法陣を貫いて、紫黒の極光が落ちる
function summonBook(a, sx, out) {
    const { ctx, phase: p } = a;
    const T = ULT_T.summon, ground = a.foot.y - 2, by = skyY(a) - 6;
    const appear = ease(win(p, T.split, T.descend)) * (1 - win(p, T.impact + 0.08, T.home));
    const open = ease(win(p, T.descend - 0.02, T.descend + 0.05));
    if (appear > 0) {
        ctx.save();
        ctx.globalAlpha = out * appear;
        // 開いていく本（左右の頁が起き上がる）
        const w = 46, hgt = 34, tilt = 1 - open;
        for (const side of [-1, 1]) {
            ctx.fillStyle = '#3a1a5a';
            ctx.beginPath();
            ctx.moveTo(sx, by);
            ctx.lineTo(sx + side * w * (1 - tilt * 0.8), by - 6 - tilt * 10);
            ctx.lineTo(sx + side * w * (1 - tilt * 0.8), by + hgt - 6 - tilt * 10);
            ctx.lineTo(sx, by + hgt);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#f4ead2';
            ctx.beginPath();
            ctx.moveTo(sx + side * 2, by + 2);
            ctx.lineTo(sx + side * (w - 4) * (1 - tilt * 0.8), by - 3 - tilt * 10);
            ctx.lineTo(sx + side * (w - 4) * (1 - tilt * 0.8), by + hgt - 9 - tilt * 10);
            ctx.lineTo(sx + side * 2, by + hgt - 3);
            ctx.closePath();
            ctx.fill();
            // 頁の上の光る文字
            ctx.globalCompositeOperation = 'lighter';
            for (let r = 0; r < 5; r++) {
                ctx.fillStyle = a.frame % 10 < 5 ? '#c77dff' : '#7fe0ff';
                ctx.fillRect(R(sx + side * (8 + (r % 2) * 4)), R(by + 4 + r * 5), R(side * (w - 18)), 1);
            }
            ctx.globalCompositeOperation = 'source-over';
        }
        // 舞いあがる頁
        const rng = new Rng(`${a.seed}:pages`);
        for (let i = 0; i < 14; i++) {
            const t = (p * 4 + rng.next()) % 1, ang = rng.range(0, TAU);
            const x = sx + Math.cos(ang) * (10 + t * 90), y = by + 10 + Math.sin(ang) * (6 + t * 40) - t * 20;
            ctx.globalAlpha = out * appear * open * (1 - t);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(t * 6 + i);
            ctx.fillStyle = '#f4ead2';
            ctx.fillRect(-3, -4, 6, 8);
            ctx.fillStyle = '#c77dff';
            ctx.fillRect(-2, -2, 4, 1);
            ctx.restore();
        }
        ctx.restore();
    }
    // 三重の魔法陣（縦に重なり、交互に回る）
    const ck = open * (1 - win(p, T.impact + 0.06, T.impact + 0.18));
    const layers = [by + 46, (by + 46 + ground) / 2, ground - 4];
    layers.forEach((y, i) => {
        const k = ck * ease(win(p, T.descend + 0.02 + i * 0.03, T.descend + 0.06 + i * 0.03));
        if (k <= 0)
            return;
        const rx = (28 + i * 14) * k, ry = rx * 0.3, rot = (a.frame / (12 + i * 4)) * (i % 2 ? -1 : 1);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = out * k;
        ctx.translate(sx, y);
        ctx.strokeStyle = '#c77dff';
        ctx.lineWidth = 4;
        ctx.globalAlpha = out * k * 0.35;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = out * k;
        ctx.lineWidth = 1.3;
        ctx.strokeStyle = '#e8c8ff';
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(0, 0, rx * 0.72, ry * 0.72, 0, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        for (let j = 0; j <= 5; j++) {
            const t = rot + (j * 2 * TAU) / 5;
            j ? ctx.lineTo(Math.cos(t) * rx * 0.72, Math.sin(t) * ry * 0.72) : ctx.moveTo(Math.cos(t) * rx * 0.72, Math.sin(t) * ry * 0.72);
        }
        ctx.stroke();
        ctx.font = '6px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#7fe0ff';
        for (let j = 0; j < 10; j++) {
            const t = -rot * 1.4 + (j / 10) * TAU;
            ctx.fillText('ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾ'[j], Math.cos(t) * rx * 0.86, Math.sin(t) * ry * 0.86);
        }
        ctx.restore();
    });
    // 極光: 魔法陣を貫いて、紫黒の光が落ちる（太さが脈打つ）
    if (p >= T.plunge - 0.01 && p < T.impact + 0.09) {
        const k = win(p, T.plunge - 0.01, T.impact), fade = 1 - win(p, T.impact + 0.03, T.impact + 0.09);
        const w = (10 + 30 * ease(k)) * (1 + 0.15 * Math.sin(a.frame * 1.3));
        const yEnd = lerp(by + 40, ground + 6, ease(k));
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = out * fade;
        const g = ctx.createLinearGradient(sx - w, 0, sx + w, 0);
        g.addColorStop(0, 'rgba(90,20,140,0)');
        g.addColorStop(0.3, 'rgba(160,60,255,0.75)');
        g.addColorStop(0.5, '#ffffff');
        g.addColorStop(0.7, 'rgba(160,60,255,0.75)');
        g.addColorStop(1, 'rgba(90,20,140,0)');
        ctx.fillStyle = g;
        ctx.fillRect(sx - w, by + 30, w * 2, yEnd - by - 30);
        // まわりを螺旋に昇る文字
        const rng = new Rng(`${a.seed}:spiral`);
        for (let i = 0; i < 18; i++) {
            const t = (p * 5 + i / 18) % 1, ang = t * TAU * 2 + i;
            ctx.globalAlpha = out * fade * (1 - t);
            ctx.fillStyle = i % 2 ? '#e8c8ff' : '#7fe0ff';
            ctx.font = '7px monospace';
            ctx.fillText('ᛉᛟᚾᛗᛚ'[i % 5], sx + Math.cos(ang) * (w + 8), lerp(ground, by + 40, t));
            void rng;
        }
        ctx.restore();
    }
}
// ギター: 天に伝説のギターが現れ、かき鳴らすたびに音の輪が地へ叩きつけられる → 最後のパワーコードで、音の柱と光の波形が爆ぜる
function summonGuitar(a, sx, out) {
    const { ctx, phase: p } = a;
    const T = ULT_T.summon, ground = a.foot.y - 2, gy = skyY(a);
    const appear = ease(win(p, T.split, T.descend)) * (1 - win(p, T.impact + 0.08, T.home));
    if (appear > 0) {
        ctx.save();
        ctx.globalAlpha = out * appear;
        const strum = p > T.descend && p < T.impact ? Math.sin(a.frame * 1.7) * 0.06 : 0;
        giantSprite(ctx, 'guitar', sx, gy - 10, 4.5, true, 1, -0.5 + strum);
        ctx.restore();
    }
    // 音の輪: かき鳴らすたびに、ギターからボスへ広がりながら落ちる
    const beats = [0, 0.025, 0.05, 0.075, 0.1].map((d) => T.descend + 0.01 + d);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    beats.forEach((t0, i) => {
        const k = win(p, t0, t0 + 0.05);
        if (k <= 0 || k >= 1)
            return;
        const y = lerp(gy + 20, ground, k), rx = 14 + k * 70, hue = (i * 60 + a.frame * 4) % 360;
        ctx.globalAlpha = out * (1 - k * 0.6);
        ctx.strokeStyle = `hsl(${hue},100%,70%)`;
        ctx.lineWidth = 3 * (1 - k) + 1;
        ctx.beginPath();
        ctx.ellipse(sx, y, rx, rx * 0.28, 0, 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(sx, y, rx * 0.8, rx * 0.22, 0, 0, TAU);
        ctx.stroke();
    });
    ctx.restore();
    // 降りそそぐ音符
    if (p > T.descend && p < T.impact + 0.12) {
        const rng = new Rng(`${a.seed}:notes`);
        for (let i = 0; i < 22; i++) {
            const t = (p * 4 + rng.next()) % 1, x = sx + rng.range(-80, 80) + Math.sin(t * 8 + i) * 6;
            text(ctx, i % 3 ? '♪' : '♫', x, lerp(gy, ground, t), 9, `hsl(${(i * 37 + a.frame * 3) % 360},100%,75%)`, out * (1 - t) * 0.9, '#2a0a3a');
        }
    }
    // パワーコード: 音の柱と、地面から立ちあがる光の波形（イコライザー）
    if (p >= T.plunge - 0.005 && p < T.impact + 0.12) {
        const k = win(p, T.plunge - 0.005, T.impact), fade = 1 - win(p, T.impact + 0.04, T.impact + 0.12);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = out * fade;
        glowLine(ctx, sx, gy + 20, sx, lerp(gy + 20, ground, ease(k)), 16, '#ff6bd6', 1);
        glowLine(ctx, sx, gy + 20, sx, lerp(gy + 20, ground, ease(k)), 4, '#ffffff', 1);
        if (p >= T.impact) {
            const rng = new Rng(`${a.seed}:eq`);
            for (let i = -9; i <= 9; i++) {
                const hgt = (20 + rng.range(0, 60)) * (0.6 + 0.4 * Math.abs(Math.sin(a.frame / 2 + i))) * (1 - Math.abs(i) / 12);
                ctx.fillStyle = `hsl(${(i * 20 + a.frame * 6 + 360) % 360},100%,65%)`;
                ctx.fillRect(R(sx + i * 8 - 3), R(ground - hgt), 6, R(hgt));
            }
        }
        ctx.restore();
    }
}
function giantWeapon(a, sx) {
    const { ctx, phase: p } = a;
    const T = ULT_T.summon, wp = a.ult?.weapon ?? 'sword', style = ultArt(wp).style, [colA, colB] = RUSH_COL[style];
    const top = -30, hover = a.body.y - 16, ground = a.foot.y - 2;
    const tipAt = (pp) => {
        if (pp >= T.descend && pp < T.plunge)
            return lerp(top, hover, ease(win(pp, T.descend, T.plunge)));
        if (pp >= T.plunge && pp < T.impact) {
            const k = win(pp, T.plunge, T.impact);
            return lerp(hover, ground, k * k * k);
        }
        if (pp >= T.impact && pp < T.home)
            return ground + 8 * ease(win(pp, T.impact, T.impact + 0.03));
        return null;
    };
    const out = 1 - win(p, T.impact + 0.1, T.home), glow = p < T.impact + 0.08 ? 1 : 0.5;
    const speed = (tip, x, n = 6) => { if (p >= T.plunge && p < T.impact + 0.01)
        for (let i = 0; i < n; i++)
            glowLine(ctx, x - 16 + i * 6, tip - 160, x - 16 + i * 6, tip - 70, 1, '#ffffff', 0.6); };
    if (wp === 'bow') {
        summonBow(a, sx, out);
        return;
    }
    if (wp === 'book') {
        summonBook(a, sx, out);
        return;
    }
    if (wp === 'guitar') {
        summonGuitar(a, sx, out);
        return;
    }
    ctx.save();
    ctx.globalAlpha = out;
    if (style === 'blade' && wp === 'dagger') { // 無数の暗刃
        for (let i = 0; i < 7; i++) {
            const tip = tipAt(p + (6 - i) * 0.008);
            if (tip === null)
                continue;
            swordAt(ctx, sx + (i - 3) * 17 + (i % 2) * 4, tip - (i % 2) * 6, 0.55, glow, a.frame, SWORD_PAL.dagger);
        }
    }
    else if (style === 'blade') {
        const tip = tipAt(p);
        if (tip !== null) {
            speed(tip, sx);
            swordAt(ctx, sx, tip, wp === 'katana' ? 1.25 : 1.15, glow, a.frame, SWORD_PAL[wp] ?? SWORD_PAL.sword);
        }
    }
    else if (style === 'pierce' || style === 'heavy') {
        const tip = tipAt(p);
        if (tip !== null) {
            const sc = style === 'pierce' ? 6 : 5.5, sprH = weaponSprite(wp).height * sc;
            const wob = style === 'heavy' && p < T.impact ? Math.sin(p * 60) * 0.12 * (1 - win(p, T.plunge, T.impact)) : 0;
            speed(tip, sx);
            if (style === 'pierce')
                giantSprite(ctx, wp, sx, tip + 4, sc, false, glow, 0);
            else
                giantSprite(ctx, wp, sx, tip + 10, sc, false, glow, wob);
            void sprH;
        }
    }
    else {
        // shot / magic: 天に浮かぶ巨大な武器
        const hang = p >= T.descend && p < T.impact + 0.04 ? ease(win(p, T.descend, T.plunge)) : 0;
        if (hang > 0) {
            ctx.globalAlpha = out * hang * (1 - win(p, T.impact, T.impact + 0.05));
            giantSprite(ctx, wp, sx, 38 + Math.sin(a.frame / 8) * 2, 5, true, glow, 0);
        }
        ctx.globalAlpha = out;
        const tip = tipAt(p);
        if (tip !== null && p >= T.plunge && p < T.impact + 0.05) {
            const tp = Math.min(tip, ground + 4);
            if (style === 'shot') { // 極大の矢（光線）
                glowLine(ctx, sx, -60, sx, tp, 14, colA, 1);
                glowLine(ctx, sx - 3, -60, sx - 3, tp, 1.2, '#ffffff', 0.8);
            }
            else { // 光の柱
                const k = win(p, T.plunge, T.impact), w = 8 + 28 * ease(k);
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                const g = ctx.createLinearGradient(sx - w, 0, sx + w, 0);
                g.addColorStop(0, `${colA}00`);
                g.addColorStop(0.4, `${colA}cc`);
                g.addColorStop(0.5, '#ffffff');
                g.addColorStop(0.6, `${colA}cc`);
                g.addColorStop(1, `${colA}00`);
                ctx.fillStyle = g;
                ctx.fillRect(sx - w, 40, w * 2, Math.max(0, tp - 40));
                ctx.restore();
                starSpark(ctx, sx, tp, 14 * k, 1, colB);
            }
        }
    }
    ctx.restore();
}
function summonUlt(a, hero) {
    const { ctx, phase: p } = a;
    const T = ULT_T.summon;
    const sx = a.body.x + 6;
    // 魔法陣から立ちのぼる光
    const ck = bump(p, T.circle, T.impact + 0.06);
    if (ck > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const rng = new Rng(`${a.seed}:summonrise`);
        for (let i = 0; i < 22; i++) {
            const dx = rng.range(-44, 44), t = (p * 6 + rng.next()) % 1;
            ctx.globalAlpha = ck * (1 - t);
            ctx.fillStyle = i % 3 ? '#9fe8ff' : '#ffffff';
            ctx.fillRect(R(hero.x + dx), R(hero.y - t * 60), 1, 4);
        }
        ctx.restore();
    }
    // 天が割れる（画面上の裂け目と、射しこむ光）
    const sk = win(p, T.split, T.split + 0.05) * (1 - win(p, T.impact + 0.06, T.impact + 0.16));
    if (sk > 0) {
        const cw = 130 * ease(sk), ch = 12 * ease(sk);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = sk * 0.3;
        ctx.fillStyle = '#e8fbff';
        for (let i = 0; i < 9; i++) {
            const ang = Math.PI * (0.15 + (i / 8) * 0.7), L = 170;
            ctx.beginPath();
            ctx.moveTo(sx - 8 + i * 2, -2);
            ctx.lineTo(sx + Math.cos(ang) * L - 6, -2 + Math.sin(ang) * L);
            ctx.lineTo(sx + Math.cos(ang + 0.05) * L + 6, -2 + Math.sin(ang + 0.05) * L);
            ctx.closePath();
            ctx.fill();
        }
        ctx.globalAlpha = sk;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(sx, -2, cw / 2, ch, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#9fe8ff';
        ctx.lineWidth = 2;
        const rng = new Rng(`${a.seed}:skycrack`);
        const x0 = sx - cw / 2 - 30 * sk, x1 = sx + cw / 2 + 30 * sk;
        ctx.beginPath();
        ctx.moveTo(x0, -2);
        for (let i = 1; i <= 10; i++)
            ctx.lineTo(lerp(x0, x1, i / 10), -2 + rng.range(-5, 5) * sk);
        ctx.stroke();
        ctx.restore();
    }
    // 光の柱
    const pk = win(p, T.split + 0.02, T.descend) * (1 - win(p, T.impact + 0.02, T.impact + 0.14));
    if (pk > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const w = Math.max(1, 34 * ease(pk) + Math.sin(a.frame / 2) * 2);
        const g = ctx.createLinearGradient(sx - w, 0, sx + w, 0);
        g.addColorStop(0, 'rgba(159,232,255,0)');
        g.addColorStop(0.5, 'rgba(230,250,255,0.55)');
        g.addColorStop(1, 'rgba(159,232,255,0)');
        ctx.globalAlpha = pk;
        ctx.fillStyle = g;
        ctx.fillRect(sx - w, -200, w * 2, a.foot.y + 206);
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = pk * 0.7;
        ctx.fillRect(R(sx - 2), -200, 4, a.foot.y + 206);
        ctx.restore();
    }
    giantWeapon(a, sx);
    // 着弾: 地面ごと爆ぜる光のドーム
    const dk = win(p, T.impact, T.impact + 0.14);
    if (dk > 0 && dk < 1) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const rx = 20 + ease(dk) * 130, ry = 14 + ease(dk) * 96;
        const g = ctx.createRadialGradient(sx, a.foot.y, 0, sx, a.foot.y, rx);
        g.addColorStop(0, 'rgba(255,255,255,0.95)');
        g.addColorStop(0.6, 'rgba(159,232,255,0.55)');
        g.addColorStop(1, 'rgba(95,205,228,0)');
        ctx.globalAlpha = 1 - dk;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(sx, a.foot.y + 4, rx, ry, 0, Math.PI, TAU);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3 * (1 - dk) + 1;
        ctx.beginPath();
        ctx.ellipse(sx, a.foot.y + 4, rx, ry, 0, Math.PI, TAU);
        ctx.stroke();
        ctx.strokeStyle = '#9fe8ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(sx, a.foot.y + 4, rx * 1.2, ry * 0.3, 0, 0, TAU);
        ctx.stroke();
        ctx.restore();
    }
    rocks(a, sx, a.foot.y, win(p, T.impact, T.impact + 0.18), 'summonrock', 30, 150);
    // 余震: 小さな土煙と地面の輪
    [T.impact + 0.08, T.impact + 0.14].forEach((t0, i) => {
        const k = win(p, t0, t0 + 0.07);
        dustCloud(a, sx + (i ? 30 : -24), a.foot.y + 4, k, `after${i}`, 1);
        if (k > 0 && k < 1) {
            ctx.save();
            ctx.globalAlpha = (1 - k) * 0.7;
            ctx.strokeStyle = '#d8ccb0';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(sx, a.foot.y + 4, 30 + k * 90, 8 + k * 20, 0, 0, TAU);
            ctx.stroke();
            ctx.restore();
        }
    });
    flash(a, bump(p, T.impact - 0.003, T.impact + 0.04), '#f0fcff', 0.92);
}
// ---- 突進（巻物が要らない場面の、軽い演出）: 風切りの線が隊列へ ----
function rushLightFx(a) {
    const { ctx, phase: p } = a;
    const k = win(p, 0.36, 0.46);
    if (k > 0 && k < 1) {
        ctx.save();
        ctx.strokeStyle = '#ffe0c8';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 10; i++) {
            const y = 100 + i * 11, x = lerp(a.foot.x, a.W + 40, ease(k)) - (i % 3) * 20;
            ctx.globalAlpha = (1 - k) * 0.8;
            ctx.beginPath();
            ctx.moveTo(x - 40, y);
            ctx.lineTo(x, y);
            ctx.stroke();
        }
        ctx.restore();
        flash(a, bump(p, 0.41, 0.45), '#ffffff', 0.25);
    }
    partyLabel(a, tl('見切り'), '#ffe0c8', bump(p, 0.44, 0.6));
}
export const verseAt = (c, i) => c.start + i * c.verse;
// その節のうち、文字を打ち出す区間の割合・輪が描き足される瞬間・外す人が詰まる瞬間
const TYPE_K = 0.55, RING_K = 0.78, FAIL_K = 0.62;
export const chainBreakAt = (start, verse, upto) => start + upto * verse + verse * FAIL_K;
const SKY = { x: 122, y: 38 }; // 空の魔法陣の中心（ボスの頭上）
const ringR = (c, i) => 22 + (i * 82) / Math.max(1, c.len - 1);
const RING_COL = ['#7cf3ff', '#8fd3ff', '#b5a8ff', '#e2a8ff', '#ffb8e8', '#ffe27a', '#fff6c8'];
const ringCol = (c, i) => RING_COL[Math.min(RING_COL.length - 1, Math.round((i * (RING_COL.length - 1)) / Math.max(1, c.len - 1)))];
// いま唱えている節（なければ -1）と、その節の中の進み具合
function verseNow(c, p) {
    const i = Math.floor((p - c.start) / c.verse);
    const last = c.full ? c.len - 1 : Math.min(c.len - 1, c.upto);
    if (p < c.start || i > last)
        return { i: -1, k: 0 };
    return { i, k: (p - verseAt(c, i)) / c.verse };
}
// 描き終えた輪の数（途切れるまでにつながった節だけ）と、いちばん外の輪の描き足しの進み具合
function ringsAt(c, p) {
    let n = 0, grow = 1;
    for (let i = 0; i < c.upto; i++) {
        const t = verseAt(c, i) + c.verse * RING_K;
        if (p < t)
            break;
        n = i + 1;
        grow = clamp01((p - t) / (c.verse * 0.5));
    }
    return { n, grow };
}
const chanterOf = (a, c, i) => a.fighters.find((v) => v.f === c.chanters[i] && v.alive);
const shattered = (c, p) => !c.full && c.breakT >= 0 && p >= c.breakT + 0.035;
const mineVerse = (c, i) => c.mineAt >= 0 && c.chanters[i] === c.chanters[c.mineAt];
// ---- 奥: ボスが最後の大技を溜める赤いオーラ、討伐隊の足元の光の帯、明かり ----
function chainBack(a, c) {
    const { ctx, phase: p } = a;
    // カットイン（唱える人の大きな全身）は、キャラより後ろに。カメラの寄りに関係なく画面いっぱいに置くため、画面座標で描く
    ctx.save();
    const sc = ctx.canvas.width / a.W;
    ctx.setTransform(sc, 0, 0, sc, 0, 0);
    chainCutin(a, c);
    ctx.restore();
    const end = c.full ? c.impact : c.rally;
    const k = win(p, 0.02, 0.2) * (1 - win(p, end, end + 0.05));
    if (k > 0) {
        const r = 30 + k * 26 + Math.sin(a.frame / 2.5) * 3 * k;
        ctx.save();
        const g = ctx.createRadialGradient(a.body.x, a.body.y, 4, a.body.x, a.body.y, r);
        g.addColorStop(0, 'rgba(255,60,60,0.5)');
        g.addColorStop(0.6, 'rgba(200,20,40,0.28)');
        g.addColorStop(1, 'rgba(120,0,20,0)');
        ctx.globalAlpha = k;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(a.body.x, a.body.y, r, 0, TAU);
        ctx.fill();
        ctx.restore();
        a.lights?.push({ x: a.body.x, y: a.body.y, r: 50 + k * 30, a: k * 0.7, col: '#ff3b3b' });
    }
    // 唱える人が囲む地面の七芒星: 並び終えると円が浮かび、一節ごとに星の線が一本ずつ描き足される
    const { n, grow } = ringsAt(c, p);
    const lk = win(p, 0.1, 0.16) * (1 - win(p, 0.88, 0.95));
    if (c.ring && lk > 0)
        groundStar(a, c, c.ring, lk, n, grow);
    // 魔法陣の明かり（輪が増えるほど強く）と、唱えている人の頭上の光
    const lit = shattered(c, p) ? 1 - win(p, c.breakT + 0.035, c.breakT + 0.12) : c.full ? 1 - win(p, c.impact + 0.06, c.impact + 0.2) : 1;
    if (n > 0 && lit > 0)
        a.lights?.push({ x: SKY.x, y: SKY.y + 10, r: 50 + (n - 1 + grow) * 16, a: (0.35 + 0.1 * n) * lit, col: n >= c.len ? '#fff6c8' : '#b5d8ff' });
    const vn = verseNow(c, p);
    const cv = vn.i >= 0 ? chanterOf(a, c, vn.i) : undefined;
    if (cv)
        a.lights?.push({ x: cv.x, y: cv.y - 20, r: 44, a: 0.9 * bump(vn.k, 0, 1.1), col: mineVerse(c, vn.i) ? '#ffd166' : '#bff4ff' });
    if (c.full && p >= c.impact)
        a.lights?.push({ x: a.body.x, y: a.body.y - 10, r: 150, a: 1 - win(p, c.impact + 0.05, c.impact + 0.25), col: '#fff6c8' });
}
function groundStar(a, c, rg, k, n, grow) {
    const { ctx, phase: p } = a;
    const broken = shattered(c, p);
    const dim = broken ? 0.35 : 1;
    const done = n >= c.len;
    const rot = -Math.PI / 2 + Math.PI; // 頂点を左（ボスの側）に
    const P = (i) => { const t = rot + (i * TAU) / 7; return { x: rg.x + Math.cos(t) * rg.rx, y: rg.y + Math.sin(t) * rg.ry }; };
    ctx.save();
    // 地面に落ちる陣の影（明るい背景でも線が見えるように）
    ctx.globalAlpha = k * 0.55;
    ctx.fillStyle = 'rgba(8,14,32,1)';
    ctx.beginPath();
    ctx.ellipse(rg.x, rg.y, rg.rx + 7, rg.ry + 4, 0, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    // 外円と内円
    ctx.globalAlpha = k * 0.7 * dim;
    ctx.strokeStyle = done ? '#fff6c8' : '#7cf3ff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(rg.x, rg.y, rg.rx + 4, rg.ry + 2, 0, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = k * 0.35 * dim;
    ctx.beginPath();
    ctx.ellipse(rg.x, rg.y, rg.rx * 0.42, rg.ry * 0.42, 0, 0, TAU);
    ctx.stroke();
    // 7本の線（{7/3}）: 唱え終えた節の数だけ光る。いま描き足している線は途中まで
    for (let j = 0; j < 7; j++) {
        const lit = j < n - 1 ? 1 : j === n - 1 ? grow : 0;
        const A = P((j * 3) % 7), B = P(((j + 1) * 3) % 7);
        ctx.globalAlpha = k * 0.18;
        ctx.strokeStyle = '#7cf3ff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(B.x, B.y);
        ctx.stroke();
        if (lit <= 0)
            continue;
        const ex = A.x + (B.x - A.x) * lit, ey = A.y + (B.y - A.y) * lit;
        const col = done ? '#fff6c8' : `hsl(${190 + j * 28},100%,68%)`;
        ctx.globalAlpha = k * 0.45 * dim;
        ctx.strokeStyle = col;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.globalAlpha = k * dim;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        if (lit < 1) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(R(ex) - 1, R(ey) - 1, 2, 2);
        }
    }
    // 頂点の灯
    for (let i = 0; i < 7; i++) {
        const q = P(i);
        ctx.globalAlpha = k * (0.4 + 0.4 * Math.sin(a.frame / 6 + i)) * dim;
        ctx.fillStyle = done ? '#fff6c8' : '#bff4ff';
        ctx.fillRect(R(q.x) - 1, R(q.y) - 1, 2, 2);
    }
    ctx.restore();
    if (n > 0)
        a.lights?.push({ x: rg.x, y: rg.y, r: 40 + n * 6, a: (0.25 + 0.06 * n) * k * dim, col: done ? '#fff6c8' : '#7cf3ff' });
}
// ---- 手前（キャラより前・明かりの前）: 唱える人の足元の小さな魔法陣と、立ちのぼる光の粒 ----
function chainFront(a, c) {
    const { ctx, phase: p } = a;
    // タメ: 叫び終えてから光の柱が落ちるまで、唱えた全員から空の魔法陣へ光が立ちのぼり、集まっていく
    if (c.full) {
        const t0 = shoutEndT(c), k = clamp01((p - t0) / Math.max(1e-6, c.impact - t0));
        if (p >= t0 - 0.004 && p < c.impact) {
            const who = [...new Set(c.chanters)].map((f) => a.fighters.find((v) => v.f === f && v.alive)).filter((v) => !!v);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            who.forEach((v, i) => {
                const x0 = v.x, y0 = v.y - 22;
                // 細い光の筋（だんだん太く）
                ctx.globalAlpha = 0.25 + 0.5 * k;
                ctx.strokeStyle = `hsl(${190 + i * 28},100%,70%)`;
                ctx.lineWidth = 1 + 2 * k;
                ctx.beginPath();
                ctx.moveTo(x0, y0);
                ctx.quadraticCurveTo((x0 + SKY.x) / 2 + 20, (y0 + SKY.y) / 2 - 10, SKY.x, SKY.y + 6);
                ctx.stroke();
                // 筋をのぼっていく光の粒
                for (let j = 0; j < 4; j++) {
                    const u = ((a.frame / 22 + j / 4 + i * 0.13) % 1);
                    const cx = (x0 + SKY.x) / 2 + 20, cy = (y0 + SKY.y) / 2 - 10;
                    const px = (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * cx + u * u * SKY.x, py = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * cy + u * u * (SKY.y + 6);
                    ctx.globalAlpha = 0.9 * Math.sin(u * Math.PI);
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(R(px) - 1, R(py) - 1, 2, 2);
                }
            });
            // 魔法陣の中心に光が凝縮していく
            const r = 4 + 18 * (1 - k) * (0.6 + 0.4 * Math.sin(a.frame / 2));
            ctx.globalAlpha = 0.5 + 0.5 * k;
            const g = ctx.createRadialGradient(SKY.x, SKY.y + 6, 0, SKY.x, SKY.y + 6, r + 10 * k);
            g.addColorStop(0, '#ffffff');
            g.addColorStop(0.4, 'rgba(255,240,190,0.8)');
            g.addColorStop(1, 'rgba(255,200,120,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(SKY.x, SKY.y + 6, r + 10 * k, 0, TAU);
            ctx.fill();
            ctx.restore();
            a.lights?.push({ x: SKY.x, y: SKY.y + 6, r: 60 + 40 * k, a: 0.6 + 0.4 * k, col: '#fff6c8' });
        }
    }
    const vn = verseNow(c, p);
    if (vn.i < 0)
        return;
    const v = chanterOf(a, c, vn.i);
    if (!v)
        return;
    const failing = !c.full && vn.i === c.upto;
    const k = Math.min(win(vn.k, 0, 0.15), failing ? 1 - win(vn.k, FAIL_K, FAIL_K + 0.1) : 1 - win(vn.k, 0.9, 1));
    if (k <= 0)
        return;
    ctx.save();
    ctx.translate(v.x, v.y + 1);
    ctx.scale(1, 0.35);
    ctx.globalAlpha = k * 0.9;
    ctx.strokeStyle = failing && vn.k > 0.4 ? '#9a8aa8' : mineVerse(c, vn.i) ? '#ffd166' : '#7cf3ff';
    ctx.lineWidth = 1.5;
    ctx.rotate(a.frame / 20);
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
        const t = (i * 2 * TAU) / 6 + 0.3;
        const x = Math.cos(t) * 12, y = Math.sin(t) * 12;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
    // 立ちのぼる光の粒
    const rng = new Rng(`${a.seed}:chainmote:${vn.i}`);
    ctx.save();
    for (let i = 0; i < 12; i++) {
        const ox = rng.range(-10, 10), sp = rng.range(0.6, 1.4), t = (vn.k * sp * 2 + rng.next()) % 1;
        ctx.globalAlpha = k * (1 - t);
        ctx.fillStyle = i % 3 ? '#bff4ff' : '#ffffff';
        ctx.fillRect(R(v.x + ox + Math.sin(t * 6 + i) * 2), R(v.y - t * 40), 1, 2);
    }
    ctx.restore();
}
// 空の魔法陣の輪を1つ描く。輪ごとに色相をずらし、時間とともに虹色にゆらめかせる（外側のにじみ → 色の線 → 白い芯）。
// 偶数の輪には古代文字の帯、奇数の輪には星形。done（7節そろった）は色の巡りが速くなる
const RUNE_RING = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
const ringHue = (a, i, done) => (190 + i * 28 + a.frame * (1.2 + done * 4) + Math.sin(a.frame / 30 + i) * 14) % 360;
function chainRing(a, c, i, grow, alpha, crack, white, done = 0) {
    const { ctx } = a;
    const rx = ringR(c, i) * (0.7 + 0.3 * ease(grow)), ry = rx * 0.28;
    const hue = ringHue(a, i, done);
    const col = white ? '#ffffff' : `hsl(${hue},100%,68%)`;
    const col2 = `hsl(${(hue + 40) % 360},100%,75%)`;
    const dir = i % 2 ? -1 : 1, rot = (a.frame / (40 + i * 6)) * dir;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(SKY.x, SKY.y);
    // 描き足し: 弧がぐるりと伸びて閉じる
    const sweep = TAU * ease(grow);
    ctx.globalAlpha = alpha * 0.22;
    ctx.strokeStyle = col;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, rot, rot + sweep);
    ctx.stroke();
    ctx.globalAlpha = alpha * 0.45;
    ctx.strokeStyle = col2;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, rot, rot + sweep);
    ctx.stroke();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, rot, rot + sweep);
    ctx.stroke();
    ctx.globalAlpha = alpha * 0.9;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, rot, rot + sweep);
    ctx.stroke();
    // 内側にもう1本、細い輪（二重線）
    if (grow >= 1) {
        ctx.globalAlpha = alpha * 0.5;
        ctx.strokeStyle = col2;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx * 0.9, ry * 0.9, 0, 0, TAU);
        ctx.stroke();
    }
    // 刻み（ルーンの点）。ところどころが瞬く
    const n = 10 + i * 3;
    for (let j = 0; j < n; j++) {
        if ((j / n) * TAU > sweep)
            break;
        const t = rot + (j / n) * TAU;
        const tw = 0.6 + 0.4 * Math.sin(a.frame / 4 + j * 1.7 + i);
        ctx.globalAlpha = alpha * (j % 3 ? 0.6 : 1) * tw;
        ctx.fillStyle = j % 3 ? col2 : '#ffffff';
        ctx.fillRect(R(Math.cos(t) * rx) - 1, R(Math.sin(t) * ry) - 1, j % 3 ? 2 : 3, j % 3 ? 1 : 2);
    }
    // 偶数の輪: 輪に沿って古代文字の帯が流れる
    if (i % 2 === 0 && grow >= 1 && i > 0) {
        const m = 8 + i * 2;
        ctx.font = '6px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let j = 0; j < m; j++) {
            const t = -rot * 1.3 + (j / m) * TAU;
            ctx.globalAlpha = alpha * 0.85;
            ctx.fillStyle = `hsl(${(hue + j * 12) % 360},100%,82%)`;
            ctx.fillText(RUNE_RING[(j + i * 3) % RUNE_RING.length], Math.cos(t) * rx * 0.95, Math.sin(t) * ry * 0.95);
        }
    }
    // 奇数の輪: 内側に星形
    if (i % 2 === 1 && grow >= 1) {
        const m = 5 + ((i >> 1) % 2 ? 2 : 0);
        ctx.globalAlpha = alpha * 0.75;
        ctx.lineWidth = 1;
        ctx.strokeStyle = col2;
        ctx.beginPath();
        for (let j = 0; j <= m; j++) {
            const t = -rot + (j * 2 * TAU) / m;
            const x = Math.cos(t) * rx * 0.92, y = Math.sin(t) * ry * 0.92;
            j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
    }
    // ひび
    if (crack > 0) {
        const rng = new Rng(`${a.seed}:crack:${i}`);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = Math.min(1, crack * 1.5);
        ctx.strokeStyle = '#1a1030';
        ctx.lineWidth = 1.5;
        for (let j = 0; j < 2; j++) {
            let t = rng.range(0, TAU), x = Math.cos(t) * rx, y = Math.sin(t) * ry;
            ctx.beginPath();
            ctx.moveTo(x, y);
            for (let q = 0; q < 4; q++) {
                t += rng.range(-0.5, 0.5);
                x -= Math.cos(t) * rx * 0.12 * crack;
                y -= Math.sin(t) * ry * 0.3 * crack + rng.range(-2, 2);
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
    }
    ctx.restore();
}
// 魔法陣のまわりで瞬く星屑（十字のきらめき）と、完成したときの虹の光芒
function chainSparkle(a, c, n, alpha, done) {
    const { ctx } = a;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const rng = new Rng(`${a.seed}:sparkle`);
    for (let i = 0; i < n * 7; i++) {
        const ring = i % n, t = rng.range(0, TAU) + a.frame / (50 + ring * 8) * (ring % 2 ? -1 : 1), rx = ringR(c, ring) * rng.range(0.85, 1.12);
        const x = SKY.x + Math.cos(t) * rx, y = SKY.y + Math.sin(t) * rx * 0.28 + rng.range(-6, 6);
        const tw = Math.max(0, Math.sin(a.frame / rng.range(3, 7) + rng.range(0, TAU)));
        if (tw < 0.3)
            continue;
        const z = tw > 0.85 ? 3 : 2;
        ctx.globalAlpha = alpha * tw;
        ctx.fillStyle = i % 3 ? `hsl(${ringHue(a, ring, done) + 60},100%,85%)` : '#ffffff';
        ctx.fillRect(R(x) - z, R(y), z * 2 + 1, 1);
        ctx.fillRect(R(x), R(y) - z, 1, z * 2 + 1);
    }
    if (done > 0) {
        for (let j = 0; j < 12; j++) {
            const t = (j / 12) * TAU + a.frame / 60, len = 60 + 50 * done;
            ctx.globalAlpha = alpha * done * 0.35;
            ctx.strokeStyle = `hsl(${(j * 30 + a.frame * 6) % 360},100%,72%)`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(SKY.x, SKY.y);
            ctx.lineTo(SKY.x + Math.cos(t) * len, SKY.y + Math.sin(t) * len * 0.4);
            ctx.stroke();
        }
    }
    ctx.restore();
}
// 小さなカエル（失敗の肩すかし）
function frog(ctx, x, y, jump) {
    const X = R(x), Y = R(y);
    ctx.fillStyle = '#1a3a12';
    ctx.fillRect(X - 5, Y - 6, 10, 6);
    ctx.fillStyle = '#63c74d';
    ctx.fillRect(X - 4, Y - 5, 8, 4);
    ctx.fillStyle = '#a8e04a';
    ctx.fillRect(X - 3, Y - 3, 6, 2);
    ctx.fillStyle = '#63c74d';
    ctx.fillRect(X - 4, Y - 8, 3, 3);
    ctx.fillRect(X + 1, Y - 8, 3, 3); // 目玉
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(X - 3, Y - 7, 1, 1);
    ctx.fillRect(X + 2, Y - 7, 1, 1);
    ctx.fillStyle = '#1a3a12';
    ctx.fillRect(X - 2, Y - 7, 1, 1);
    ctx.fillRect(X + 3, Y - 7, 1, 1);
    ctx.fillStyle = '#63c74d';
    if (jump) {
        ctx.fillRect(X - 6, Y - 1, 2, 3);
        ctx.fillRect(X + 4, Y - 1, 2, 3);
    }
    else {
        ctx.fillRect(X - 6, Y - 2, 2, 2);
        ctx.fillRect(X + 4, Y - 2, 2, 2);
    }
}
// ---- いちばん手前（明かりの後）: 空の魔法陣・光の糸・大魔法の光の柱・失敗の煙とカエル ----
function chainTop(a, c) {
    const { ctx, phase: p } = a;
    const { n, grow } = ringsAt(c, p);
    const broke = !c.full && c.breakT >= 0 && p >= c.breakT;
    const crack = broke ? win(p, c.breakT, c.breakT + 0.035) : 0;
    const shatter = shattered(c, p);
    const fade = c.full ? 1 - win(p, c.impact + 0.04, c.impact + 0.16) : 1;
    const doneGlow = c.full ? bump(p, c.doneT - 0.01, c.impact) : 0;
    // 空の魔法陣（砕けるまで）
    if (!shatter && fade > 0) {
        for (let i = 0; i < n; i++)
            chainRing(a, c, i, i === n - 1 ? grow : 1, fade * (0.75 + 0.25 * Math.sin(a.frame / 7 + i)), crack, doneGlow > 0.6 && a.frame % 6 < 3, doneGlow);
        if (n > 0)
            chainSparkle(a, c, n, fade * (1 - crack), doneGlow);
        // 中心の光（輪が増えるほど強く）
        if (n > 0) {
            const r = 6 + n * 3 + doneGlow * 14;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createRadialGradient(SKY.x, SKY.y, 0, SKY.x, SKY.y, r * 2);
            const hh = ringHue(a, n - 1, doneGlow);
            g.addColorStop(0, `rgba(255,255,255,${0.6 * fade})`);
            g.addColorStop(0.4, `hsla(${hh},100%,75%,${0.4 * fade})`);
            g.addColorStop(1, `hsla(${(hh + 60) % 360},100%,60%,0)`);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(SKY.x, SKY.y, r * 2, r * 0.9, 0, 0, TAU);
            ctx.fill();
            ctx.restore();
        }
    }
    // 一節唱え終えるたびに、唱えた人の頭上から魔法陣へ光の糸がのびる
    for (let i = 0; i < c.upto; i++) {
        const t = verseAt(c, i) + c.verse * (RING_K - 0.12);
        const k = win(p, t, t + c.verse * 0.3);
        if (k <= 0 || k >= 1)
            continue;
        const v = chanterOf(a, c, i);
        if (!v)
            continue;
        const rx = ringR(c, i), ang = Math.atan2((v.y - 30 - SKY.y) / 0.28, v.x - SKY.x);
        const tx = SKY.x + Math.cos(ang) * rx, ty = SKY.y + Math.sin(ang) * rx * 0.28;
        const head = Math.min(1, k * 2);
        glowLine(ctx, v.x, v.y - 30, lerp(v.x, tx, head), lerp(v.y - 30, ty, head), 2, `hsl(${ringHue(a, i, 0)},100%,70%)`, 1 - win(k, 0.6, 1));
    }
    // 唱えている人の頭上: 光る記号の輪（外す人は、途中で灰色に崩れる）
    const vn = verseNow(c, p);
    const cv = vn.i >= 0 ? chanterOf(a, c, vn.i) : undefined;
    if (cv) {
        const failing = !c.full && vn.i === c.upto;
        const k = Math.min(win(vn.k, 0, 0.12), 1 - win(vn.k, failing ? FAIL_K : 0.9, failing ? FAIL_K + 0.08 : 1));
        if (k > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (let j = 0; j < 8; j++) {
                const t = a.frame / 14 + (j / 8) * TAU, x = cv.x + Math.cos(t) * 11, y = cv.y - 40 + Math.sin(t) * 3;
                ctx.globalAlpha = k * (0.6 + 0.4 * Math.sin(t));
                ctx.fillStyle = failing && vn.k > 0.35 ? '#8a7a98' : mineVerse(c, vn.i) ? '#ffd166' : j % 2 ? '#bff4ff' : '#ffffff';
                ctx.fillRect(R(x) - 1, R(y) - 1, 2, 2);
            }
            ctx.restore();
        }
    }
    // 失敗: 魔法陣が砕けて破片が落ちる → 外した人の頭でボフッと煙 → カエルがぴょこっ、小さな花火がぱちっ
    if (broke) {
        const age = p - c.breakT;
        if (shatter && n > 0) {
            const sk = win(p, c.breakT + 0.035, c.breakT + 0.17);
            if (sk < 1) {
                const rng = new Rng(`${a.seed}:shard`);
                ctx.save();
                for (let i = 0; i < 18 + n * 6; i++) {
                    const ring = rng.int(0, n - 1), t = rng.range(0, TAU), rx = ringR(c, ring);
                    const x0 = SKY.x + Math.cos(t) * rx, y0 = SKY.y + Math.sin(t) * rx * 0.28;
                    const vx = Math.cos(t) * rng.range(10, 40), vy = rng.range(-20, 0);
                    ctx.globalAlpha = 1 - sk;
                    ctx.fillStyle = i % 3 ? ringCol(c, ring) : '#ffffff';
                    ctx.fillRect(R(x0 + vx * sk), R(y0 + vy * sk + 160 * sk * sk), 2, i % 2 ? 1 : 2);
                }
                ctx.restore();
            }
        }
        const v = c.upto < c.chanters.length ? chanterOf(a, c, c.upto) : undefined;
        if (v) {
            const hx = v.x, hy = v.y - 30;
            // 煙
            const pk = win(age, 0.02, 0.16);
            if (pk > 0 && pk < 1) {
                const rng = new Rng(`${a.seed}:poof`);
                ctx.save();
                for (let i = 0; i < 9; i++) {
                    const ang = rng.range(0, TAU), d = rng.range(4, 12) * ease(pk);
                    ctx.globalAlpha = (1 - pk) * 0.9;
                    ctx.fillStyle = i % 3 ? '#9a9cb0' : '#d8d8e0';
                    ctx.beginPath();
                    ctx.arc(hx + Math.cos(ang) * d, hy + Math.sin(ang) * d * 0.7 - pk * 4, 3 + 4 * pk, 0, TAU);
                    ctx.fill();
                }
                ctx.restore();
                text(ctx, tl('ボフッ'), hx + 14, hy - 10 - pk * 4, 9, '#e8e8f0', Math.min(1, (1 - pk) * 3), '#3a3a4a');
            }
            // カエル: 煙の中から跳び出して、ボスとは反対へぴょこぴょこ
            const fk = win(age, 0.05, 0.3);
            if (fk > 0 && fk < 1) {
                const hop = (fk * 3) % 1, nH = Math.floor(fk * 3);
                const fx = hx + 6 + fk * 34;
                const fy = nH === 0 ? lerp(hy, v.y + 2, hop) - Math.sin(hop * Math.PI) * 10 : v.y + 2 - Math.sin(hop * Math.PI) * 9;
                ctx.save();
                ctx.globalAlpha = Math.min(1, (1 - fk) * 5);
                frog(ctx, fx, fy, hop > 0.1 && hop < 0.9);
                ctx.restore();
            }
            // 小さな花火（ぱちっ）
            const wk = win(age, 0.08, 0.22);
            if (wk > 0 && wk < 1) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                const cols = ['#ff5a6e', '#ffd166', '#7bed9f', '#5fcde4'];
                for (let i = 0; i < 10; i++) {
                    const ang = (i / 10) * TAU, d = 9 * ease(wk);
                    ctx.globalAlpha = 1 - wk;
                    ctx.fillStyle = cols[i % 4];
                    ctx.fillRect(R(hx - 12 + Math.cos(ang) * d), R(hy - 8 + Math.sin(ang) * d + wk * 4), 2, 2);
                }
                ctx.restore();
            }
        }
        // 途切れた詠唱でも、それまでに練った力が少しだけボスに届く
        if (c.dmg > 0) {
            const dk = win(age, 0.05, 0.25);
            if (dk > 0 && dk < 1)
                text(ctx, fmtDmg(c.dmg), a.body.x + 30, a.body.y - 20 - dk * 8, 10, '#c9ced8', Math.min(1, (1 - dk) * 4), '#2a2a3a');
        }
    }
    // 大魔法: 魔法陣の中心からボスへ、極大の光の柱
    if (c.full) {
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
            ctx.moveTo(SKY.x - w0 * 0.6, SKY.y - 40);
            ctx.lineTo(SKY.x + w0 * 0.6, SKY.y - 40);
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
        // 特大のダメージ数字
        const dk = win(p, c.impact, c.impact + 0.26);
        if (dk > 0 && dk < 1 && c.dmg > 0) {
            const pop = 1 + 0.8 * (1 - ease(clamp01(dk / 0.1)));
            text(ctx, fmtDmg(c.dmg), a.body.x + 44, a.body.y - 26 - ease(dk) * 10, R(26 * pop), a.frame % 6 < 3 ? '#ffffff' : '#ffe27a', Math.min(1, (1 - dk) * 5), '#5a1a00');
        }
    }
}
// 輪郭だけの色つきシルエット（カットインのふち取り）。キャラ×色ごとに一度だけ作る
const silhouettes = new WeakMap();
function silhouette(img, color) {
    let m = silhouettes.get(img);
    if (!m)
        silhouettes.set(img, (m = new Map()));
    let s = m.get(color);
    if (!s) {
        s = document.createElement('canvas');
        s.width = img.width;
        s.height = img.height;
        const x = s.getContext('2d');
        x.drawImage(img, 0, 0);
        x.globalCompositeOperation = 'source-in';
        x.fillStyle = color;
        x.fillRect(0, 0, s.width, s.height);
        m.set(color, s);
    }
    return s;
}
// ---- 連携詠唱のカットイン: 唱えている人の全身が、中央に薄く大きく重なる。節が変わるたびに、次の人が左右から入れ替わる ----
//   ふち取りの色は輪の色（節が進むほど色が変わる）。あなたの番は金色で、少し濃く大きく。
//   外す人の番は、詰まった瞬間に灰色に崩れて消える。大魔法が完成したら、全員が並んで浮かび上がる
function chainCutin(a, c) {
    const { ctx, phase: p, W, H } = a;
    const figs = a.figures;
    if (!figs)
        return;
    const last = c.full ? c.len - 1 : Math.min(c.len - 1, c.upto);
    const cur = Math.floor((p - c.start) / c.verse);
    for (let j = Math.max(0, cur - 1); j <= Math.min(last, cur + 1); j++) {
        const img = figs[c.chanters[j]];
        if (!img)
            continue;
        const k = (p - verseAt(c, j)) / c.verse; // 節の中の進み具合（前後の節と少し重なる）
        const failing = !c.full && j === c.upto;
        const inK = ease(win(k, -0.1, 0.16)), outK = failing ? win(k, FAIL_K, FAIL_K + 0.12) : win(k, 0.86, 1.1);
        const env = inK * (1 - outK);
        if (env <= 0)
            continue;
        const mine = mineVerse(c, j), side = j % 2 ? 1 : -1;
        const col = failing && k > FAIL_K - 0.1 ? '#8a7a98' : mine ? '#ffd166' : ringCol(c, j);
        const w = img.width, h = img.height; // 1ドット＝5ドット絵のまま（きれいに拡大される大きさ）
        // 左右から滑りこみ、とどまるあいだもゆっくり流れる
        const cx = W / 2 + side * ((1 - inK) * W * 0.55 + (k - 0.5) * 22) + (failing && k > FAIL_K ? Math.sin(a.frame * 2.1) * 3 : 0);
        const top = H * 0.84 - h * 0.92; // 足が字幕の帯の少し上に来る
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        // 背景の色の帯と、流れる線
        ctx.globalCompositeOperation = 'lighter';
        const bandY = H * 0.5 - 18;
        const g = ctx.createLinearGradient(0, 0, W, 0);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(side > 0 ? 0.25 : 0.75, col);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = env * 0.1;
        ctx.fillStyle = g;
        ctx.fillRect(0, bandY, W, 36);
        ctx.globalAlpha = env * 0.35;
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 7; i++) {
            const y = bandY - 14 + ((i * 29) % 64), len = 30 + ((i * 41) % 50), x = ((a.frame * (5 + (i % 3)) * -side + i * 97) % (W + 100) + (W + 100)) % (W + 100) - 50;
            ctx.fillRect(R(x), R(y), len, 1);
        }
        // 大きな節の数字（薄く）
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = env * 0.14;
        text(ctx, String(j + 1), W / 2 - side * (w * 0.5 + 24), H * 0.46, 64, col, env * 0.16, col);
        // ふち取り → 本体
        ctx.globalCompositeOperation = 'lighter';
        const sil = silhouette(img, col);
        ctx.globalAlpha = env * (mine ? 0.5 : 0.36);
        for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2]])
            ctx.drawImage(sil, R(cx - w / 2 + ox), R(top + oy), w, h);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = env * (mine ? 0.34 : 0.26) * (failing && k > FAIL_K ? 0.7 : 1);
        if (failing && k > FAIL_K - 0.05) { // つっかえた人は、体がずれて崩れる
            const rows = 8, rh = img.height / rows;
            for (let r = 0; r < rows; r++) {
                const sh = Math.sin(a.frame * 1.3 + r * 2.1) * 4 * win(k, FAIL_K - 0.05, FAIL_K + 0.1);
                ctx.drawImage(img, 0, r * rh, img.width, rh, R(cx - w / 2 + sh), R(top + r * rh), w, rh);
            }
        }
        else
            ctx.drawImage(img, R(cx - w / 2), R(top), w, h);
        ctx.restore();
        // 入りの閃光（ごく短く・淡く）
        const fk = 1 - win(k, -0.1, 0.05);
        if (fk > 0 && k > -0.1)
            flashHud(ctx, W, H, fk * 0.12, col);
    }
    // 大魔法が完成: 唱えた全員が、肩を並べて浮かび上がる
    if (c.full) {
        const k = bump(p, c.doneT - 0.004, c.impact);
        const who = [...new Set(c.chanters)].filter((f) => figs[f]);
        if (k > 0 && who.length) {
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            ctx.globalAlpha = k * 0.3;
            const step = Math.min(110, (W - 60) / Math.max(1, who.length - 1));
            who.forEach((f, i) => {
                const img = figs[f], x = W / 2 + (i - (who.length - 1) / 2) * step;
                ctx.drawImage(img, R(x - img.width / 2), R(H * 0.84 - img.height * 0.92), img.width, img.height);
            });
            ctx.restore();
        }
    }
}
function flashHud(ctx, W, H, alpha, col) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    ctx.fillStyle = col;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
}
// 叫び終える時刻: 七節のあと、叫び（約6割）→ 空の魔法陣に力が集まるタメ（約4割）→ 光の柱
export const shoutEndT = (c) => c.doneT + (c.impact - c.doneT) * 0.6;
// 叫びの名を、叩きつける単位に分ける（アラビア語は単語、ほかは1字。結合文字は1字にまとめる）
function unitsOf(s, rtl) {
    if (rtl)
        return s.split(/[\s\-‐]+/).filter(Boolean);
    const Seg = Intl.Segmenter;
    return Seg ? [...new Seg(undefined, { granularity: 'grapheme' }).segment(s)].map((x) => x.segment) : [...s];
}
function shoutHud(a, c) {
    const { ctx, phase: p, W, H } = a;
    const q = (p - c.doneT) / Math.max(1e-6, shoutEndT(c) - c.doneT);
    if (q < 0 || q > 1)
        return;
    const out = 1 - win(q, 0.88, 1.0);
    const cy = H / 2 - 4;
    // 1. 画面が沈み、中央から集中線
    const dk = win(q, 0, 0.08) * out;
    ctx.save();
    ctx.globalAlpha = dk * 0.7;
    ctx.fillStyle = '#05030c';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = dk * 0.85;
    const band = ctx.createLinearGradient(0, cy - 40, 0, cy + 40);
    band.addColorStop(0, 'rgba(40,20,0,0)');
    band.addColorStop(0.5, 'rgba(70,36,0,0.85)');
    band.addColorStop(1, 'rgba(40,20,0,0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, cy - 40, W, 80);
    ctx.globalCompositeOperation = 'lighter';
    const rng = new Rng(`${a.seed}:shout`);
    for (let i = 0; i < 40; i++) {
        const ang = rng.range(0, TAU) + a.frame * 0.004, r0 = rng.range(70, 110), r1 = r0 + rng.range(40, 140);
        ctx.globalAlpha = dk * rng.range(0.15, 0.45) * (0.6 + 0.4 * Math.sin(a.frame / 3 + i));
        ctx.strokeStyle = i % 3 ? '#ffd166' : '#ffffff';
        ctx.lineWidth = rng.range(0.5, 1.5);
        ctx.beginPath();
        ctx.moveTo(W / 2 + Math.cos(ang) * r0, cy + Math.sin(ang) * r0 * 0.6);
        ctx.lineTo(W / 2 + Math.cos(ang) * r1, cy + Math.sin(ang) * r1 * 0.6);
        ctx.stroke();
    }
    ctx.restore();
    // 2. 名を一文字ずつ叩きつける（大きく出て、ずしんと収まる。収まった瞬間に白く光る）
    // 名を「ひと粒ずつ」叩きつける。ふつうは1字ずつ（ヒンディー語は結合した1文字ずつ）、アラビア語は字がつながるので単語ごとに、右から左へ並べる
    const rtl = isRtl();
    const units = unitsOf(c.spell, rtl);
    const n = Math.max(1, units.length);
    const measure = (sz) => { ctx.font = `${sz}px ${PIXEL_FONT}`; return units.map((u) => ctx.measureText(u).width); };
    const gapOf = (sz) => sz * (rtl ? 0.3 : 0.06);
    const spanOf = (sz, w) => w.reduce((t, x) => t + x, 0) + gapOf(sz) * (w.length - 1);
    let size = 30, ws = measure(size);
    const room = W - 70 - size * 1.2; // 右（アラビア語は左）に「!!」の分をあける
    if (spanOf(size, ws) > room) {
        size = Math.max(10, Math.floor((size * room) / spanOf(size, ws)));
        ws = measure(size);
    }
    const gap = gapOf(size), spanW = spanOf(size, ws);
    const startX = W / 2 - spanW / 2 + (rtl ? 1 : -1) * size * 0.25;
    const xs = [];
    {
        let acc = 0;
        ws.forEach((w) => { xs.push(rtl ? startX + spanW - acc - w / 2 : startX + acc + w / 2); acc += w + gap; });
    }
    const nameCx = startX + spanW / 2;
    const last = q >= 0.74;
    const shake = last ? Math.sin(a.frame * 2.1) * 1.2 * (1 - win(q, 0.8, 0.95)) : 0;
    units.forEach((ch, i) => {
        const t0 = 0.08 + (i * 0.34) / n;
        const k = (q - t0) / 0.05;
        if (k < 0)
            return;
        const pop = 1 + 1.6 * (1 - ease(clamp01(k)));
        const x = xs[i] + shake, y = cy + 4;
        ctx.save();
        ctx.translate(R(x), R(y));
        ctx.scale(pop, pop);
        ctx.globalAlpha = clamp01(k * 2) * out;
        ctx.font = `${size}px ${PIXEL_FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#3a1400';
        ctx.lineWidth = Math.max(3, size / 5);
        ctx.strokeText(ch, 0, 0);
        const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.45, '#fff2b0');
        g.addColorStop(0.55, '#ffc23a');
        g.addColorStop(1, '#ff8a1a');
        ctx.fillStyle = g;
        ctx.fillText(ch, 0, 0);
        ctx.restore();
        const fl = 1 - clamp01((k - 1) / 1.2);
        if (k >= 1 && fl > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = fl * 0.8 * out;
            const r = size * (0.7 + (1 - fl) * 0.8);
            const gg = ctx.createRadialGradient(x, y, 0, x, y, r);
            gg.addColorStop(0, 'rgba(255,240,190,0.9)');
            gg.addColorStop(1, 'rgba(255,200,80,0)');
            ctx.fillStyle = gg;
            ctx.fillRect(x - r, y - r, r * 2, r * 2);
            ctx.restore();
        }
    });
    // 3. 読み（カタカナ）が、名の上を左から走る
    if (c.reading) {
        const rs = [...c.reading];
        const kr = clamp01((q - 0.46) / 0.24);
        const shown = Math.ceil(rs.length * kr);
        if (shown > 0) {
            const rsize = Math.min(12, Math.floor((spanW / Math.max(1, rs.length)) * 1.4));
            const rw = Math.min(spanW + 20, rs.length * rsize * 0.95);
            const rx0 = nameCx - rw / 2 + shake;
            rs.slice(0, shown).forEach((ch, i) => {
                const x = rx0 + (i + 0.5) * (rw / rs.length), age = kr * rs.length - i;
                const y = cy + 4 - size / 2 - rsize / 2 - 5 - Math.max(0, 1 - age) * 4;
                text(ctx, ch, x, y, rsize, '#d8fbff', out * clamp01(age), '#06243a');
            });
            // 読みの下に走る光
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = out * 0.8;
            ctx.fillStyle = '#7cf3ff';
            ctx.fillRect(R(rx0), R(cy + 4 - size / 2 - 3), R(rw * kr), 1);
            ctx.restore();
        }
    }
    else {
        text(ctx, tl('― 全員で ―'), W / 2, cy + 4 - size / 2 - 10, 8, '#ffe9a0', out * win(q, 0.05, 0.12));
    }
    // 4. 「！！」で弾ける
    if (last) {
        const k = clamp01((q - 0.74) / 0.04);
        const pop = 1 + 1.2 * (1 - ease(k));
        const x = (rtl ? startX - size * 0.08 : startX + spanW + size * 0.08) + shake; // 名のすぐ横（最後の字の側）
        ctx.save();
        ctx.translate(R(x), R(cy + 4));
        ctx.scale(pop, pop);
        ctx.rotate(0.08);
        ctx.globalAlpha = k * out;
        ctx.font = `${size}px ${PIXEL_FONT}`;
        ctx.textAlign = rtl ? 'right' : 'left';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#3a1400';
        ctx.lineWidth = Math.max(3, size / 5);
        ctx.strokeText('!!', 0, 0);
        ctx.fillStyle = a.frame % 6 < 3 ? '#ffffff' : '#ffd166';
        ctx.fillText('!!', 0, 0);
        ctx.restore();
        // 全体の後光
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (0.35 + 0.25 * Math.sin(a.frame / 2)) * out * k;
        const gg = ctx.createRadialGradient(W / 2, cy, 0, W / 2, cy, W * 0.45);
        gg.addColorStop(0, 'rgba(255,220,140,0.6)');
        gg.addColorStop(1, 'rgba(255,180,60,0)');
        ctx.fillStyle = gg;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
    }
}
// ---- 画面座標（字幕）: 唱えている節を、画面の下に1文字ずつ大きく。大魔法の名・「詠唱失敗…」 ----
export function sceneHud(a) {
    if (a.scene !== 'chain' || !a.chain)
        return;
    const c = a.chain, { ctx, phase: p, W, H } = a;
    const vn = verseNow(c, p);
    // 字幕の帯（詠唱のあいだ）
    const bandEnd = c.full ? c.doneT : Math.min(c.breakT + 0.3, c.rally - 0.04);
    const bandK = win(p, c.start - 0.02, c.start) * (1 - win(p, bandEnd, bandEnd + 0.03));
    if (bandK > 0) {
        const y0 = H - 50;
        ctx.save();
        ctx.globalAlpha = bandK;
        const g = ctx.createLinearGradient(0, y0, 0, H);
        g.addColorStop(0, 'rgba(6,4,18,0)');
        g.addColorStop(0.3, 'rgba(6,4,18,0.8)');
        g.addColorStop(1, 'rgba(6,4,18,0.92)');
        ctx.fillStyle = g;
        ctx.fillRect(0, y0, W, H - y0);
        // 節の目印（つながった節は光る）
        const { n } = ringsAt(c, p);
        for (let i = 0; i < c.len; i++) {
            const x = W / 2 - ((c.len - 1) * 9) / 2 + i * 9, y = H - 6;
            const lit = i < n, now = i === vn.i, bad = !c.full && i === c.upto && p >= c.breakT;
            ctx.fillStyle = bad ? '#ff5a6e' : lit ? ringCol(c, i) : now ? '#ffffff' : '#3a3c58';
            ctx.fillRect(R(x) - 2, y - 2, 4, 4);
        }
        ctx.restore();
    }
    if (vn.i >= 0) {
        const i = vn.i, failing = !c.full && i === c.upto;
        const chars = [...(c.lines[i] ?? '……')];
        const isMine = mineVerse(c, i);
        // 唱える人の名前と、第何節か
        const nk = failing ? 1 - win(p, c.breakT + 0.2, c.breakT + 0.26) : 1 - win(vn.k, 0.94, 1);
        text(ctx, tl(`第{0}節　{1}{2}`, i + 1, c.names[i] ?? '', isMine ? tl(`（{0}）`, c.mineLabel) : ''), W / 2, H - 40, 8, isMine ? '#ffd166' : '#bff4ff', nk * win(vn.k, 0, 0.06));
        // 本文: 1文字ずつ浮かび上がる。外す人は途中で言葉に詰まり、ちがう文字が混じって崩れ落ちる
        const shownN = failing ? Math.max(1, Math.floor(chars.length * 0.35)) : chars.length;
        const glyphs = failing ? [...chars.slice(0, shownN), '…', '？', 'ﾑ'] : chars;
        const size = chars.length > 18 ? 13 : 15;
        ctx.save();
        ctx.font = `${size}px ${PIXEL_FONT}`;
        const widths = glyphs.map((ch) => ctx.measureText(ch).width + 1);
        ctx.restore();
        const total = widths.reduce((s, x) => s + x, 0);
        let x = W / 2 - total / 2;
        glyphs.forEach((ch, j) => {
            // 文字が出る瞬間（節の中の進み具合）。外す人は正しい文字を少し言ったあと、つっかえながら違う文字を足す
            const tj = failing
                ? (j < shownN ? (j / shownN) * 0.3 : 0.3 + ((j - shownN + 1) / 3) * 0.25)
                : (j / glyphs.length) * TYPE_K;
            const age = vn.k - tj;
            const cx = x + widths[j] / 2;
            x += widths[j];
            if (age < 0)
                return;
            const pop = 1 + 0.6 * (1 - clamp01(age / 0.08));
            let yy = H - 23 - 4 * (1 - clamp01(age / 0.08)), al = clamp01(age / 0.04), rot = 0;
            let col = j >= shownN ? '#c89aa8' : isMine ? '#ffe9a0' : '#ffffff';
            if (failing && p >= c.breakT) { // 崩れ落ちる
                const fk = win(p, c.breakT, c.breakT + 0.2);
                yy += 80 * fk * fk + Math.sin(j * 2.3) * 3 * fk;
                rot = (j % 2 ? 1 : -1) * fk * 1.4;
                al *= 1 - fk;
                col = '#8a8aa0';
            }
            else if (!failing)
                al *= 1 - win(vn.k, 0.92, 1);
            if (al <= 0)
                return;
            ctx.save();
            ctx.translate(R(cx), R(yy));
            ctx.rotate(rot);
            ctx.scale(pop, pop);
            text(ctx, ch, 0, 0, size, col, al, isMine ? '#5a3a00' : '#1a1c3a');
            ctx.restore();
        });
    }
    // 大魔法の名を、全員で叫ぶ: 画面が沈み、名が一文字ずつ叩きつけられ、読み（カタカナ）が走り、最後に「！！」で弾ける
    if (c.full)
        shoutHud(a, c);
    if (!c.full && c.breakT >= 0) {
        const age = p - c.breakT;
        const end = Math.min(0.3, c.rally - 0.05 - c.breakT); // 総攻撃が始まる前に引っ込める
        const k = win(age, 0.04, 0.07) * (1 - win(age, end, end + 0.04));
        if (k > 0) {
            const jit = age < 0.12 ? Math.sin(a.frame * 1.9) * 1.5 : 0;
            text(ctx, tl('詠唱失敗…'), W / 2 + jit, H / 2 - 14, 18, '#c8b8ff', k, '#2a1040');
            text(ctx, tl(`{0}の番で、詠唱が途切れた`, c.names[c.upto] ?? ''), W / 2, H / 2 + 4, 8, '#ffffff', k, '#2a1040');
        }
    }
}
//# sourceMappingURL=scenes.js.map