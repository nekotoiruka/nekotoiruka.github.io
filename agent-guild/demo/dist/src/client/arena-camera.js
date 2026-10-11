import { bump, GAG, IMPACT, lerp, win01 } from './arena-common.js';
import { ultCam, ultShake } from './scenes.js';
import { shakeScale } from './motion.js';
export function updateCamera(c) {
    const s = this.script;
    const { w: AW, h: AH } = s.arena;
    const { w, phase, outro, wv, atk, views, strikeOf, chain, down, spot, ult } = c;
    // --- カメラ: 普段は全体、注目の反撃と決着はズーム ---
    let tz = 1, tx = AW / 2, ty = AH / 2;
    // 呪文の打ち消し・奥義・隙の大技は、画面全体で見せるのでズームしない
    const wide = ['spell', 'ougi', 'rush', 'summon', 'parry', 'seal', 'awaken', 'opening', 'chain'].includes(this.sceneOf(w) ?? '');
    if (spot && !wide) {
        const g = Math.min(1, bump(phase, spot.at.t - 0.16, spot.at.t + 0.08) * 1.5);
        if (g > 0) {
            const v = views[spot.f];
            tz = lerp(1, 1.6, g);
            tx = lerp(tx, (v.x + this.bossBody.x) / 2, g);
            ty = lerp(ty, v.y - 24, g);
        }
    }
    // 自分の冒険者を追う: 判断する瞬間・攻撃を受ける瞬間（幻術の回は声が届くまで）に寄る
    const me = [...this.mine].find((f) => !s.fighters[f].off && views[f]?.alive);
    if (me !== undefined && !chain && !(spot && bump(phase, spot.at.t - 0.16, spot.at.t + 0.08) > 0)) {
        const v = views[me], st = strikeOf.get(me);
        const sc = this.sceneOf(w);
        const shots = [];
        if (st)
            shots.push([bump(phase, st.t - 0.06, st.t + 0.12), 1.4, v.x - 20, v.y - 22]);
        if (this.gagOf(me)?.w === w)
            shots.push([bump(phase, GAG[0] - 0.02, GAG[1] + 0.02) * 1.2, 1.8, v.x - 6, v.y - 26]);
        if (sc === 'illusion')
            shots.push([bump(phase, 0.16, 0.52), 1.5, v.x - 26, v.y - 22]);
        else if (wv.attack !== 'treasure')
            shots.push([bump(phase, IMPACT - 0.07, IMPACT + 0.14) * 0.9, 1.3, (v.x + this.bossBody.x) / 2 + 30, v.y - 24]);
        const best = shots.sort((a, b) => b[0] - a[0])[0];
        if (best && best[0] > 0) {
            const g = Math.min(1, best[0] * 1.6);
            tz = lerp(1, best[1], g);
            tx = lerp(tx, best[2], g);
            ty = lerp(ty, best[3], g);
        }
    }
    // 巻物の大技カウンター: カメラが主役を追う（溜め → 跳躍 → 着弾）
    let camK = 0.07;
    if (ult?.f !== undefined && views[ult.f]?.alive) {
        const c = ultCam(ult.scene, phase, { x: views[ult.f].x, y: views[ult.f].y }, this.bossFoot, this.bossBody, AW, AH, this.ultWeapon(ult.f));
        if (c) {
            tz = lerp(tz, c[1], c[0]);
            tx = lerp(tx, c[2], c[0]);
            ty = lerp(ty, c[3], c[0]);
            camK = 0.07 + 0.08 * c[0];
        }
    }
    // 連携詠唱: 唱えている人に少し寄る（あなたの番はもっと寄る）。外した人の番は、その人の頭のまわりへ
    if (chain) {
        const c = chain.view;
        const i = Math.floor((phase - c.start) / c.verse);
        const lastI = c.full ? c.len - 1 : c.upto;
        if (phase >= c.start && i <= lastI && i < c.chanters.length) {
            const v = views[c.chanters[i]];
            const mineNow = this.mine.has(c.chanters[i]);
            const failNow = !c.full && i === c.upto;
            const g = Math.min(1, win01(phase, c.start - 0.01, c.start + 0.03)) * (failNow ? 1 - win01(phase, Math.min(c.breakT + 0.24, c.rally - 0.08), Math.min(c.breakT + 0.3, c.rally - 0.02)) : 1);
            if (v && g > 0 && !s.fighters[v.f].off) {
                // ふだんは空の魔法陣ごと全体を見せ、あなたの番と、外した人の番だけ寄る
                const z = failNow && phase > c.breakT ? 1.6 : mineNow ? 1.4 : 1;
                if (z > 1) {
                    tz = lerp(tz, z, g);
                    tx = lerp(tx, v.x - 10, g);
                    ty = lerp(ty, v.y - 40, g);
                }
            }
        }
    }
    const fin = this.finisher(w);
    if (fin !== null) {
        const g = bump(phase, fin - 0.12, fin + 0.2);
        if (g > 0 && down >= 0) {
            tz = lerp(tz, 1.5, g);
            tx = lerp(tx, this.bossBody.x + 30, g);
            ty = lerp(ty, this.bossBody.y, g);
        }
    }
    if (outro > 0 && this.winner !== null) {
        const v = views[this.winner];
        tz = 2.2;
        tx = v.x;
        ty = v.y - 28;
    }
    const kk = this.frame < 3 ? 1 : camK;
    this.cam.z = lerp(this.cam.z, tz, kk);
    const vw = AW / this.cam.z / 2, vh = AH / this.cam.z / 2;
    this.cam.x = Math.max(vw, Math.min(AW - vw, lerp(this.cam.x, tx, kk)));
    this.cam.y = Math.max(vh, Math.min(AH - vh, lerp(this.cam.y, ty, kk)));
    // 画面揺れ: 攻撃が届いた瞬間・会心・KO・ボス撃破
    let shake = 0;
    if (atk !== 'treasure' && phase >= IMPACT && phase < IMPACT + 0.05)
        shake = atk === 'nova' || atk === 'meteor' ? 3 : 2;
    for (const e of wv.events) {
        const age = phase - e.t;
        if (age >= 0 && age < 0.05 && ((e.type === 'attack' && e.crit) || e.type === 'death' || e.type === 'bossDown'))
            shake = Math.max(shake, e.type === 'bossDown' ? 4 : 2);
    }
    if (ult)
        shake = Math.max(shake, ultShake(ult.scene, phase, ult.f !== undefined, this.ultWeapon(ult.f)));
    if (chain) {
        shake = phase < chain.view.start + 0.02 && phase > 0.02 ? 0 : shake; // 並ぶあいだは揺らさない
        const c = chain.view;
        if (c.full) {
            const age = phase - c.impact;
            if (age >= 0 && age < 0.12)
                shake = Math.max(shake, 7 * (1 - age / 0.12));
            if (phase > c.doneT && phase < c.impact)
                shake = Math.max(shake, 1);
        }
        else {
            const age = phase - c.breakT;
            if (age >= 0 && age < 0.05)
                shake = Math.max(shake, 2);
        }
    }
    this.shakeXY = shake && shakeScale() ? { x: Math.round(Math.sin(this.frame * 2.3) * shake), y: Math.round(Math.cos(this.frame * 1.7) * shake) } : { x: 0, y: 0 };
}
//# sourceMappingURL=arena-camera.js.map