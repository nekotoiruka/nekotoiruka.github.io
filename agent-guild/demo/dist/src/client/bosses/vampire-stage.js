// ボス: vampire の舞台「月明かりの礼拝堂」（#119。BossModule の stage。受け口と部品は stagekit.ts）。
// 尖った窓から青い月光が床へ斜めに差す。燭台の小さな火、白黒の大理石の床、手前に暗いアーチの柱。
import { flick, leftTint, rect } from '../stagekit.js';
export const stage = {
    id: 'vampire-chapel', dark: 0.04,
    paint(g, W, H, rng) {
        rect(g, -40, 0, W + 80, 80, '#1c1a33');
        for (let y = 0; y < 76; y += 8)
            for (let x = (y / 8) % 2 ? -48 : -40; x < W + 40; x += 16)
                rect(g, x + 1, y + 1, 14, 6, rng.pick(['#24213f', '#211e3a', '#28244a']));
        for (const wx of [118, 206, 294, 382, 30]) { // 尖った窓（ステンドグラス）
            rect(g, wx - 13, 6, 26, 62, '#0f0d1e');
            for (let y = 8; y < 66; y++) {
                const half = y < 20 ? Math.round(Math.sqrt(Math.max(0, 1 - ((20 - y) / 12) ** 2)) * 10) : 10;
                rect(g, wx - half, y, half * 2, 1, y < 20 ? '#4a6fb3' : '#35558f');
            }
            for (let y = 22; y < 66; y += 9)
                for (let x = -9; x < 10; x += 6)
                    rect(g, wx + x, y, 5, 8, rng.pick(['#5b83c9', '#3d5fa0', '#8a3a6a', '#c9a24a', '#4a7fd0']));
            rect(g, wx - 1, 9, 2, 57, '#0f0d1e');
            rect(g, wx - 10, 40, 20, 2, '#0f0d1e');
            rect(g, wx - 15, 66, 30, 4, '#3a3558');
        }
        rect(g, -40, 72, W + 80, 8, '#16142a'); // 壁のすそ（床との境）
        // 大理石の市松
        for (let y = 80, r = 0; y < H; y += 10 + r, r++)
            for (let x = -40, k = 0; x < W + 40; x += 20, k++) {
                const t = (y - 80) / (H - 80);
                rect(g, x, y, 20, 10 + r, (k + r) % 2 ? '#8e8aa4' : '#3d3a52');
                rect(g, x, y, 20, 10 + r, `rgba(10,8,24,${0.62 - t * 0.38})`);
            }
        for (let i = 0; i < 40; i++)
            rect(g, rng.range(-40, W + 40), rng.range(84, H), rng.range(2, 6), 1, 'rgba(255,255,255,0.08)');
        // 月光のすじ（窓から床へ）
        g.save();
        g.globalCompositeOperation = 'lighter';
        for (const wx of [206, 294]) {
            g.fillStyle = 'rgba(110,150,230,0.10)';
            g.beginPath();
            g.moveTo(wx - 10, 30);
            g.lineTo(wx + 10, 30);
            g.lineTo(wx - 14, H);
            g.lineTo(wx - 60, H);
            g.closePath();
            g.fill();
        }
        g.restore();
        for (const cx of [160, 250, 340]) { // 燭台
            rect(g, cx - 1, 60, 2, 14, '#6b5a3a');
            rect(g, cx - 4, 72, 8, 2, '#6b5a3a');
            rect(g, cx - 5, 58, 10, 2, '#8a7448');
            for (const d of [-4, 0, 4]) {
                rect(g, cx + d - 1, 53, 2, 5, '#efe6cf');
                rect(g, cx + d - 1, 50, 2, 3, '#ffd27a');
            }
        }
        leftTint(g, H, '110,20,60', 0.4);
    },
    lights: (f) => [
        { x: 160, y: 52, r: 34 + flick(f, 1, 2), a: 0.8, col: '#ffc070' }, { x: 250, y: 52, r: 34 + flick(f, 2, 2), a: 0.8, col: '#ffc070' }, { x: 340, y: 52, r: 34 + flick(f, 3, 2), a: 0.8, col: '#ffc070' },
        { x: 206, y: 36, r: 46, a: 0.7, col: '#8fb0ff' }, { x: 294, y: 36, r: 46, a: 0.7, col: '#8fb0ff' },
        { x: 190, y: 160, r: 70, a: 0.5, col: '#8fb0ff' }, { x: 280, y: 170, r: 70, a: 0.5, col: '#8fb0ff' },
    ],
    front(g, { px, keep, H, W }) {
        if (keep <= 0)
            return;
        g.globalAlpha = keep;
        for (const [x0, wdt] of [[-16, 24], [W - 8, 26]]) {
            const x = Math.round(x0 + px);
            rect(g, x, -20, wdt, H + 40, '#0b0a16');
            rect(g, x + (x0 < 0 ? wdt - 3 : 0), -20, 3, H + 40, '#1d1a33');
            g.fillStyle = '#0b0a16';
            g.beginPath();
            if (x0 < 0) {
                g.moveTo(x + wdt, 0);
                g.quadraticCurveTo(x + wdt + 30, 2, x + wdt + 34, 26);
                g.lineTo(x + wdt, 26);
            }
            else {
                g.moveTo(x, 0);
                g.quadraticCurveTo(x - 30, 2, x - 34, 26);
                g.lineTo(x, 26);
            }
            g.fill();
        }
        g.globalAlpha = 1;
    },
    motes: { kind: 'dust', n: 26, col: '#cfe0ff' },
};
//# sourceMappingURL=vampire-stage.js.map