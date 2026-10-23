import { MINE_BAND, bump, clamp01, ease, lerp } from './arena-common.js';
import { skillLook } from '../shared/build.js';
import { TOOL_BY_ID } from '../shared/catalog.js';
import { SKILL_WEIGHT } from '../shared/stats.js';
import { guardIcon, scrollIcon, toolIcon } from './toolIcons.js';
import { sceneBanner } from './scenes.js';
import { NOTE_MARK } from '../shared/types.js';
import { PIXEL_FONT, tl } from '../shared/i18n.js';
// 連携の表示: 続いた人数を「N 連携！」で数え、撃った仲間どうしを光の糸でつなぐ
export function comboHud(ctx, w, phase, views) {
    const cb = this.comboAt(w, phase);
    if (!cb || cb.n === 0 || phase > cb.last + 0.1)
        return;
    const p = this.proj(this.bossBody.x + 34, this.bossBody.y - 46);
    const fade = 1 - clamp01((phase - cb.last - 0.06) / 0.04);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const pop = 1 + 0.4 * (1 - clamp01(((phase - cb.last) * (cb.n === cb.total ? 1 : 0)) / 0.02));
    ctx.font = `bold ${Math.round(14 * (cb.n === cb.total && phase < cb.last + 0.02 ? pop : 1))}px ${PIXEL_FONT}`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#2a1030';
    const t1 = `${cb.n}`;
    ctx.strokeText(t1, Math.round(p.x), Math.round(p.y));
    ctx.fillStyle = '#ffd166';
    ctx.fillText(t1, Math.round(p.x), Math.round(p.y));
    const wN = ctx.measureText(t1).width;
    ctx.font = `8px ${PIXEL_FONT}`;
    ctx.strokeText(tl('連携！'), Math.round(p.x + wN + 3), Math.round(p.y + 2));
    ctx.fillStyle = '#ffffff';
    ctx.fillText(tl('連携！'), Math.round(p.x + wN + 3), Math.round(p.y + 2));
    ctx.restore();
}
// 画面下の進み具合: 仕掛けの数だけのブロック（巻物が要る場面は重いので幅が広い）。
// 自分の答えが出るたびに、正解の度合いで塗られ、右の数字（戦果）が積み上がる。
export function progressBar(w, phase, strikeOf) {
    const s = this.script, ctx = this.ctx;
    const mine = [...this.mine].find((f) => !s.fighters[f].off);
    if (mine === undefined || w >= s.waves.length)
        return;
    const waves = s.waves.map((wv, i) => ({ wv, i }));
    if (!waves.length)
        return;
    const wt = (i) => (s.cases[s.waves[i].caseIndex]?.keySkill ? SKILL_WEIGHT : 1);
    const total = waves.reduce((a, x) => a + wt(x.i), 0);
    const scoreOf = (i) => {
        if (i > w)
            return null;
        const st = i === w ? strikeOf.get(mine) : s.waves[i].events.find((e) => e.type === 'strike' && e.f === mine);
        if (!st)
            return i < w ? 0 : null;
        if (i === w && phase < st.t)
            return null;
        return st.charmed ? 0 : st.score;
    };
    const x0 = 8, x1 = s.arena.w - 40, y = 205, hgt = 5, gap = 1;
    const span = x1 - x0 - gap * (waves.length - 1);
    ctx.save();
    ctx.fillStyle = 'rgba(13,16,34,0.72)';
    ctx.fillRect(x0 - 3, y - 3, s.arena.w - x0 - 2, hgt + 6);
    let x = x0, got = 0;
    for (const { i } of waves) {
        const bw = (span * wt(i)) / total;
        const sc = scoreOf(i);
        ctx.fillStyle = '#262a48';
        ctx.fillRect(x, y, bw, hgt);
        if (sc !== null) {
            got += sc * wt(i);
            if (sc > 0) {
                ctx.fillStyle = sc >= 0.6 ? '#7bed9f' : '#c8b46a';
                ctx.fillRect(x, y, Math.max(1, bw * sc), hgt);
            }
            else {
                ctx.fillStyle = 'rgba(255,90,110,0.45)';
                ctx.fillRect(x, y + hgt - 1, bw, 1);
            }
        }
        if (i === w) {
            ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.frame / 6);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.strokeRect(x - 0.5, y - 0.5, bw + 1, hgt + 1);
            ctx.globalAlpha = 1;
        }
        x += bw + gap;
    }
    ctx.font = `8px ${PIXEL_FONT}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd166';
    ctx.fillText(`${Math.round((got / total) * 100)}%`, s.arena.w - 5, y + hgt / 2);
    ctx.restore();
}
// あなたの動き（青い帯）: 赤い帯（ボスの動き）が消えたあと、回避・反撃に移る前に、答えた技の名前を出す
export function mineBand(ctx, w, phase, strikeOf, scene) {
    const s = this.script;
    const mine = [...this.mine].find((f) => !s.fighters[f].off);
    if (mine === undefined || !scene)
        return;
    const st = strikeOf.get(mine);
    if (!st || phase < st.t)
        return;
    const [b0, b1] = MINE_BAND;
    if (phase < b0 || phase > b1)
        return;
    const act = (st.excerpt.split(NOTE_MARK)[0].split(/[：:]/)[0] || st.excerpt).trim().slice(0, 14);
    const name = s.fighters[mine].name;
    // sceneBanner は 0〜0.25 の進行度で出入りする
    sceneBanner(ctx, scene, tl('{0}（{1}）', name, this.mineLabel), ((phase - b0) / (b1 - b0)) * 0.25, s.arena.w, st.charmed ? '……' : tl('{0}！', act), '#6ab8ff');
}
// --- 画面上部: ボスの体力 ---
export function bossBar(time) {
    const ctx = this.ctx, s = this.script;
    const hp = this.bossHp(time), k = hp / s.boss.maxHp;
    const x = 96, y = 6, w = 192;
    ctx.save();
    ctx.fillStyle = 'rgba(13,16,34,0.85)';
    ctx.fillRect(x - 4, y - 2, w + 8, 17);
    ctx.font = `8px ${PIXEL_FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(s.boss.name, x, y + 4);
    ctx.fillStyle = '#2a1630';
    ctx.fillRect(x, y + 9, w, 4);
    ctx.fillStyle = k > 0.5 ? '#c77dff' : k > 0.2 ? '#ff8a3a' : '#ff3b3b';
    ctx.fillRect(x, y + 9, Math.round(w * k), 4);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#c9ced8';
    ctx.fillText(`${Math.ceil(hp)} / ${s.boss.maxHp}`, x + w, y + 4);
    ctx.restore();
}
// ボスの攻撃名と狙う列（構えの間だけ）
// --- 文字類（画面座標） ---
export function labelAt(text, x, y, color, size = 8) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = `${size}px ${PIXEL_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1a1c2c';
    ctx.fillText(text, Math.round(x) + 1, Math.round(y) + 1);
    ctx.fillStyle = color;
    ctx.fillText(text, Math.round(x), Math.round(y));
    ctx.restore();
}
export function youMarker(wx, wy) {
    const p = this.proj(wx, wy);
    this.uiTop.push(() => {
        const ctx = this.ctx;
        ctx.save();
        ctx.font = `8px ${PIXEL_FONT}`;
        ctx.textAlign = 'center';
        // 足元の下に、上向きの矢印つきの札
        const tw = Math.max(26, Math.ceil(ctx.measureText(this.mineLabel).width) + 8);
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(Math.round(p.x - 1), Math.round(p.y - 3), 3, 1);
        ctx.fillRect(Math.round(p.x - 2), Math.round(p.y - 2), 5, 2);
        ctx.fillRect(Math.round(p.x - tw / 2), Math.round(p.y), tw, 10);
        ctx.fillStyle = '#12152a';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.mineLabel, Math.round(p.x), Math.round(p.y + 5.5));
        ctx.restore();
    });
}
export function floatText(ctx, text, wx, wy, color, alpha, size0 = 8) {
    const { x, y } = this.proj(wx, wy);
    const size = Math.round(size0 * (1 + (this.cam.z - 1) * 0.25));
    this.ui.push(() => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.font = `${size}px ${PIXEL_FONT}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#1a1c2c';
        ctx.fillText(text, Math.round(x) + 1, Math.round(y) + 1);
        ctx.fillStyle = color;
        ctx.fillText(text, Math.round(x), Math.round(y));
        ctx.restore();
    });
}
export function tag(ctx, text, color, wx, wy, alpha, stack = 0) {
    const p = this.proj(wx, wy);
    this.ui.push(() => {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `7px ${PIXEL_FONT}`;
        const w = Math.ceil(ctx.measureText(text).width) + 6;
        const bx = Math.round(p.x - w / 2), by = Math.round(p.y - stack * 10 - 5);
        ctx.fillStyle = 'rgba(13,16,34,0.85)';
        ctx.fillRect(bx, by, w, 9);
        ctx.fillStyle = color;
        ctx.fillRect(bx, by, 1, 9);
        ctx.textBaseline = 'middle';
        ctx.fillText(text, bx + 3, by + 5);
        ctx.restore();
    });
}
export function bubble(ctx, text, wx, wy, ok) {
    const p = this.proj(wx, wy);
    this.ui.push(() => {
        ctx.save();
        ctx.font = `8px ${PIXEL_FONT}`;
        const t = text.length > 26 ? text.slice(0, 25) + '…' : text;
        const w = Math.ceil(ctx.measureText(t).width) + 8;
        const x = Math.max(w / 2 + 2, Math.min(this.script.arena.w - w / 2 - 2, p.x));
        const bx = Math.round(x - w / 2), by = Math.round(Math.max(2, p.y - 12));
        ctx.fillStyle = '#1a1c2c';
        ctx.fillRect(bx - 1, by - 1, w + 2, 14);
        ctx.fillStyle = ok ? '#ffffff' : '#ffe1e1';
        ctx.fillRect(bx, by, w, 12);
        ctx.fillRect(Math.round(p.x) - 1, by + 12, 3, 2);
        ctx.fillStyle = '#1a1c2c';
        ctx.textBaseline = 'middle';
        ctx.fillText(t, bx + 4, by + 6.5);
        ctx.restore();
    });
}
// ダメージの数字: ポンと大きく飛び出して弾み、縮んで消える。会心は金色で揺れ、「CRITICAL」の文字つき
export function damageNum(wx, wy, value, age01, crit, kind) {
    const p = this.proj(wx, wy);
    const k = age01;
    const pop = k < 0.12 ? 1 + (1 - k / 0.12) * (crit ? 1.2 : 0.7) : k < 0.22 ? 1 - Math.sin(((k - 0.12) / 0.1) * Math.PI) * 0.12 : 1;
    const rise = k < 0.2 ? -Math.sin((k / 0.2) * Math.PI / 2) * 10 : -10 + (k - 0.2) * 4;
    const alpha = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
    const base = kind === 'boss' ? (crit ? 15 : 11) : 10;
    const size = Math.round(base * pop * (1 + (this.cam.z - 1) * 0.25));
    const sx = crit && k < 0.3 ? Math.sin(this.frame * 2.1) * 1.5 : 0;
    this.uiTop.push(() => {
        const ctx = this.ctx;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${size}px ${PIXEL_FONT}`;
        const x = Math.round(p.x + sx), y = Math.round(p.y + rise);
        const text = kind === 'boss' ? String(Math.round(value)) : `-${Math.round(value)}`;
        ctx.lineJoin = 'round';
        ctx.lineWidth = crit ? 4 : 3;
        ctx.strokeStyle = crit ? '#5a1000' : '#14101e';
        ctx.strokeText(text, x, y);
        if (crit) {
            const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
            g.addColorStop(0, '#fffbe0');
            g.addColorStop(0.5, '#ffd23f');
            g.addColorStop(1, '#ff7b1a');
            ctx.fillStyle = g;
        }
        else
            ctx.fillStyle = kind === 'boss' ? '#ffffff' : '#ff6b6b';
        ctx.fillText(text, x, y);
        if (crit && k < 0.7) {
            ctx.font = `bold 7px ${PIXEL_FONT}`;
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = '#5a1000';
            ctx.strokeText('CRITICAL', x, y - size * 0.75);
            ctx.fillStyle = this.frame % 6 < 3 ? '#ffffff' : '#ffd23f';
            ctx.fillText('CRITICAL', x, y - size * 0.75);
        }
        ctx.restore();
    });
}
// 舞台に立たない参加者（控え）: 画面の下に小さな点で並べる。立っていれば明るく、倒れているあいだは暗く（討伐ではダウン＝次に正しく動けば起き上がる。チーム戦・1対1では脱落）
export function reserveStrip(ctx, views) {
    const off = views.filter((v) => this.script.fighters[v.f].off);
    if (!off.length)
        return;
    const cols = 18;
    const rowsN = Math.ceil(off.length / cols);
    const x0 = 6, y0 = 211 - rowsN * 5 - 8; // 画面の左下（ボスの足元）。人数が多ければ上へ伸ばす
    ctx.save();
    ctx.fillStyle = 'rgba(13,16,34,0.72)';
    ctx.fillRect(x0 - 3, y0 - 3, cols * 5 + 8, rowsN * 5 + 14);
    ctx.font = `7px ${PIXEL_FONT}`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#9aa0c8';
    ctx.fillText(tl(`控え {0}/{1}`, off.filter((v) => v.alive).length, off.length), x0, y0 - 1);
    off.forEach((v, i) => {
        const pal = this.script.fighters[v.f].loadout.palette;
        ctx.globalAlpha = v.alive ? 1 : 0.22;
        ctx.fillStyle = v.alive ? pal : '#666a88';
        ctx.fillRect(x0 + (i % cols) * 5, y0 + 9 + Math.floor(i / cols) * 5, 3, 3);
    });
    ctx.restore();
}
// 決め手の道具（自分だけ・正解のときだけ）: 答えた直後に頭上へ浮かび、光って、ボスが動く前に武器へ吸いこまれる
export function keyItem(ctx, w, vis, strikeOf, phase, ultHero) {
    const s = this.script, wv = s.waves[w];
    if (!wv)
        return;
    const cm = s.cases[wv.caseIndex];
    for (const v of vis) {
        if (!this.mine.has(v.f) || !v.alive || v.f === ultHero)
            continue;
        const st = strikeOf.get(v.f);
        if (!st || !st.success || st.charmed)
            continue;
        const l = s.fighters[v.f].loadout;
        let img = null, col = '#8fd3ff';
        const tool = st.used.tools.find((id) => cm.keyTools?.includes(id) && !TOOL_BY_ID[id]?.decoy);
        if (tool)
            img = toolIcon(tool);
        else if (st.used.tools.includes('guardrail') && (cm.scene === 'illusion' || cm.scene === 'ally')) {
            img = guardIcon();
            col = '#c8a8ff';
        }
        else if (cm.keySkill && st.used.skills.length) {
            const i = l.skills.indexOf(st.used.skills[0]);
            const sl = i >= 0 ? skillLook(l, i) : { color: '#ffd166' };
            img = scrollIcon(sl.color);
            col = '#ff9ce6';
        }
        if (!img)
            continue;
        const t0 = st.t + 0.03, tAbs = 0.36, tEnd = 0.41;
        if (phase < t0 || phase > tEnd)
            continue;
        const rise = ease(clamp01((phase - t0) / 0.05));
        const abs = ease(clamp01((phase - tAbs) / (tEnd - tAbs)));
        const hx = v.x, hy = v.y - 42 + Math.sin(this.frame / 7) * 1; // 頭上
        const wx = v.x - 7, wy = v.y - 12; // 手元（武器）
        const x = lerp(lerp(v.x, hx, rise), wx, abs), y = lerp(lerp(v.y - 16, hy, rise), wy, abs);
        const sc = (1 + 0.3 * bump(rise, 0.6, 1)) * (1 - abs * 0.8);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const r = 12 * sc;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `${col}cc`);
        g.addColorStop(1, `${col}00`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.imageSmoothingEnabled = false;
        const iw = Math.max(2, Math.round(img.width * sc)), ih = Math.max(2, Math.round(img.height * sc));
        ctx.drawImage(img, Math.round(x - iw / 2), Math.round(y - ih / 2), iw, ih);
        ctx.restore();
        this.lights.push({ x, y, r: 22, a: 0.6 * (1 - abs * 0.5), col });
        // 吸いこまれた瞬間、武器が光る
        if (phase > tEnd - 0.02)
            this.lights.push({ x: wx, y: wy, r: 26, a: 0.9, col: '#ffffff' });
    }
}
export function hpBar(ctx, v) {
    const x = Math.round(v.x - 8), y = Math.round(v.y + 4);
    ctx.fillStyle = '#1a1c2c';
    ctx.fillRect(x, y, 16, 3);
    const k = v.hp / 100;
    ctx.fillStyle = k > 0.5 ? '#63c74d' : k > 0.25 ? '#feae34' : '#e43b44';
    ctx.fillRect(x + 1, y + 1, Math.max(0, Math.round(14 * k)), 1);
}
//# sourceMappingURL=arena-hud.js.map