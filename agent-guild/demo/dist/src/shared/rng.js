// シード付き乱数（同じシードなら必ず同じ戦闘になる）
export function hashString(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
}
export class Rng {
    s;
    constructor(seed) {
        // 似たシード（末尾だけ違う文字列など）から似た乱数列が出ないよう、よく攪拌してから使う
        let h = (typeof seed === 'string' ? hashString(seed) : seed >>> 0) ^ 0x9e3779b9;
        h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
        h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
        this.s = (h ^ (h >>> 16)) >>> 0 || 0x9e3779b9;
        for (let i = 0; i < 4; i++)
            this.next();
    }
    next() {
        // mulberry32
        let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    range(a, b) {
        return a + (b - a) * this.next();
    }
    int(a, b) {
        return Math.floor(this.range(a, b + 1));
    }
    pick(arr) {
        return arr[Math.floor(this.next() * arr.length)];
    }
}
//# sourceMappingURL=rng.js.map