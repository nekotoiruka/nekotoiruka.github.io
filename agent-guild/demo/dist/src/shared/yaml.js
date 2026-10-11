// 提出ビルド用の最小 YAML パーサー（依存ゼロ）。
// 対応: マップ / シーケンス / ブロックスカラー（| |- > >-）/ フロー形式 [a, b] {a: b} /
//       クォート文字列 / 数値・真偽値・null / コメント。アンカーや複数ドキュメントは非対応。
import { tl } from './i18n.js';
export class YamlError extends Error {
    line;
    constructor(message, line) {
        super(tl(`{0}行目: {1}`, line, message));
        this.line = line;
    }
}
function stripComment(s) {
    let inS = false, inD = false;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === "'" && !inD)
            inS = !inS;
        else if (c === '"' && !inS && s[i - 1] !== '\\')
            inD = !inD;
        else if (c === '#' && !inS && !inD && (i === 0 || /\s/.test(s[i - 1])))
            return s.slice(0, i).trimEnd();
    }
    return s.trimEnd();
}
function toLines(src) {
    return src.replace(/\r\n?/g, '\n').split('\n').map((raw, i) => {
        if (/^\t+/.test(raw))
            throw new YamlError(tl('インデントにタブは使えません'), i + 1);
        const indent = raw.length - raw.trimStart().length;
        return { indent, text: stripComment(raw.trimStart()), raw, no: i + 1 };
    });
}
class Parser {
    lines;
    i = 0;
    constructor(lines) {
        this.lines = lines;
    }
    skipBlank() {
        while (this.i < this.lines.length && this.lines[this.i].text === '')
            this.i++;
    }
    peek() {
        this.skipBlank();
        return this.lines[this.i];
    }
    parseNode(minIndent) {
        const l = this.peek();
        if (!l || l.indent < minIndent)
            return null;
        if (isSeqItem(l.text))
            return this.parseSeq(l.indent);
        if (findMapColon(l.text) >= 0)
            return this.parseMap(l.indent);
        this.i++;
        return parseScalar(l.text, l.no);
    }
    parseMap(indent) {
        const out = {};
        for (;;) {
            const l = this.peek();
            if (!l || l.indent < indent)
                break;
            if (l.indent > indent)
                throw new YamlError(tl('インデントが揃っていません'), l.no);
            if (isSeqItem(l.text))
                break;
            const ci = findMapColon(l.text);
            if (ci < 0)
                throw new YamlError(tl('「キー: 値」の形式になっていません'), l.no);
            const key = unquoteKey(l.text.slice(0, ci).trim(), l.no);
            if (key in out)
                throw new YamlError(tl(`キー「{0}」が重複しています`, key), l.no);
            const rest = l.text.slice(ci + 1).trim();
            this.i++;
            out[key] = this.parseValueAfterKey(rest, indent, l.no);
        }
        return out;
    }
    parseValueAfterKey(rest, indent, no) {
        if (/^[|>][+-]?$/.test(rest))
            return this.parseBlockScalar(rest, indent);
        if (rest !== '')
            return parseScalar(rest, no);
        const next = this.peek();
        if (!next)
            return null;
        if (next.indent > indent)
            return this.parseNode(indent + 1);
        if (next.indent === indent && isSeqItem(next.text))
            return this.parseSeq(indent);
        return null;
    }
    parseSeq(indent) {
        const out = [];
        for (;;) {
            const l = this.peek();
            if (!l || l.indent < indent)
                break;
            if (l.indent > indent)
                throw new YamlError(tl('インデントが揃っていません'), l.no);
            if (!isSeqItem(l.text))
                break;
            const content = l.text.replace(/^-\s?/, '');
            const contentIndent = indent + (l.text.length - content.length);
            if (content.trim() === '') {
                this.i++;
                out.push(this.parseNode(indent + 1));
            }
            else if (/^[|>][+-]?$/.test(content.trim())) {
                this.i++;
                out.push(this.parseBlockScalar(content.trim(), indent));
            }
            else if (isSeqItem(content) || (findMapColon(content) >= 0 && !/^[[{"']/.test(content))) {
                // 「- key: v」形式: 行を書き換えて内側のブロックとして読む
                this.lines[this.i] = { ...l, indent: contentIndent, text: content };
                out.push(this.parseNode(contentIndent));
            }
            else {
                this.i++;
                out.push(parseScalar(content, l.no));
            }
        }
        return out;
    }
    parseBlockScalar(header, parentIndent) {
        const folded = header[0] === '>';
        const chomp = header[1] === '-' ? 'strip' : header[1] === '+' ? 'keep' : 'clip';
        const body = [];
        let blockIndent = -1;
        while (this.i < this.lines.length) {
            const l = this.lines[this.i];
            const isBlank = l.raw.trim() === '';
            if (!isBlank) {
                if (l.indent <= parentIndent)
                    break;
                if (blockIndent < 0)
                    blockIndent = l.indent;
                if (l.indent < blockIndent)
                    break;
            }
            body.push(isBlank ? '' : l.raw.slice(blockIndent));
            this.i++;
        }
        // 末尾の空行を整理
        let trailing = 0;
        while (body.length && body[body.length - 1] === '') {
            body.pop();
            trailing++;
        }
        let text = folded ? foldLines(body) : body.join('\n');
        if (chomp === 'clip' && body.length)
            text += '\n';
        if (chomp === 'keep')
            text += '\n'.repeat(trailing + 1);
        return text;
    }
}
function foldLines(lines) {
    let out = '';
    for (let k = 0; k < lines.length; k++) {
        const cur = lines[k];
        if (k === 0) {
            out = cur;
            continue;
        }
        if (cur === '')
            out += '\n';
        else if (lines[k - 1] === '' || /^\s/.test(cur))
            out += cur;
        else
            out += ' ' + cur;
    }
    return out;
}
function isSeqItem(t) {
    return t === '-' || t.startsWith('- ');
}
// 「key: value」のコロン位置（クォート・フロー内は無視）。なければ -1
function findMapColon(t) {
    if (/^[[{]/.test(t))
        return -1;
    let inS = false, inD = false;
    for (let i = 0; i < t.length; i++) {
        const c = t[i];
        if (c === "'" && !inD)
            inS = !inS;
        else if (c === '"' && !inS && t[i - 1] !== '\\')
            inD = !inD;
        else if (c === ':' && !inS && !inD && (i === t.length - 1 || t[i + 1] === ' '))
            return i;
    }
    return -1;
}
function unquoteKey(k, no) {
    if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
        return parseScalar(k, no);
    }
    if (k === '')
        throw new YamlError(tl('キーが空です'), no);
    return k;
}
export function parseScalar(s, no) {
    const t = s.trim();
    if (t.startsWith('[') || t.startsWith('{')) {
        const fp = new FlowParser(t, no);
        const v = fp.value();
        fp.ws();
        if (fp.p !== t.length)
            throw new YamlError(tl('フロー形式の後ろに余分な文字があります'), no);
        return v;
    }
    if (t.startsWith('"')) {
        if (!t.endsWith('"') || t.length < 2)
            throw new YamlError(tl('ダブルクォートが閉じていません'), no);
        try {
            return JSON.parse(t);
        }
        catch {
            throw new YamlError(tl('文字列のエスケープが不正です'), no);
        }
    }
    if (t.startsWith("'")) {
        if (!t.endsWith("'") || t.length < 2)
            throw new YamlError(tl('シングルクォートが閉じていません'), no);
        return t.slice(1, -1).replace(/''/g, "'");
    }
    return plainScalar(t);
}
function plainScalar(t) {
    if (t === '' || t === '~' || t === 'null')
        return null;
    if (t === 'true')
        return true;
    if (t === 'false')
        return false;
    if (/^-?\d+(\.\d+)?$/.test(t))
        return Number(t);
    return t;
}
class FlowParser {
    s;
    no;
    p = 0;
    constructor(s, no) {
        this.s = s;
        this.no = no;
    }
    ws() { while (this.p < this.s.length && /\s/.test(this.s[this.p]))
        this.p++; }
    err(m) { throw new YamlError(m, this.no); }
    value() {
        this.ws();
        const c = this.s[this.p];
        if (c === '[')
            return this.seq();
        if (c === '{')
            return this.map();
        return this.scalar(false);
    }
    seq() {
        this.p++;
        const out = [];
        this.ws();
        if (this.s[this.p] === ']') {
            this.p++;
            return out;
        }
        for (;;) {
            out.push(this.value());
            this.ws();
            const c = this.s[this.p++];
            if (c === ']')
                return out;
            if (c !== ',')
                this.err(tl('[ ] の中の区切りが不正です'));
            this.ws();
            if (this.s[this.p] === ']') {
                this.p++;
                return out;
            }
        }
    }
    map() {
        this.p++;
        const out = {};
        this.ws();
        if (this.s[this.p] === '}') {
            this.p++;
            return out;
        }
        for (;;) {
            this.ws();
            const k = this.scalar(true);
            this.ws();
            if (this.s[this.p] !== ':')
                this.err(tl('{ } の中は「キー: 値」で書いてください'));
            this.p++;
            out[String(k)] = this.value();
            this.ws();
            const c = this.s[this.p++];
            if (c === '}')
                return out;
            if (c !== ',')
                this.err(tl('{ } の中の区切りが不正です'));
            this.ws();
            if (this.s[this.p] === '}') {
                this.p++;
                return out;
            }
        }
    }
    scalar(isKey) {
        const c = this.s[this.p];
        if (c === '"' || c === "'") {
            let j = this.p + 1;
            while (j < this.s.length) {
                if (this.s[j] === c && !(c === '"' && this.s[j - 1] === '\\')) {
                    if (c === "'" && this.s[j + 1] === "'") {
                        j += 2;
                        continue;
                    }
                    break;
                }
                j++;
            }
            if (j >= this.s.length)
                this.err(tl('クォートが閉じていません'));
            const raw = this.s.slice(this.p, j + 1);
            this.p = j + 1;
            return parseScalar(raw, this.no);
        }
        const stop = isKey ? /[:,}\]]/ : /[,}\]]/;
        let j = this.p;
        while (j < this.s.length && !stop.test(this.s[j]))
            j++;
        const raw = this.s.slice(this.p, j).trim();
        this.p = j;
        return plainScalar(raw);
    }
}
export function parseYaml(src) {
    const p = new Parser(toLines(src));
    const first = p.peek();
    if (!first)
        return null;
    const v = p.parseNode(first.indent);
    const rest = p.peek();
    if (rest)
        throw new YamlError(tl('解釈できない行があります（インデントを確認してください）'), rest.no);
    return v;
}
// --- 書き出し（提出テンプレートやアバター行の更新に使用） ---
function needsQuote(s) {
    return s === '' || /^[\s\-?:,[\]{}#&*!|>'"%@`]/.test(s) || /:\s|\s#|\n|\s$/.test(s) ||
        /^(true|false|null|~|-?\d+(\.\d+)?)$/.test(s);
}
export function scalarToYaml(v) {
    if (v === null)
        return 'null';
    if (typeof v === 'string')
        return needsQuote(v) ? JSON.stringify(v) : v;
    if (typeof v === 'number' || typeof v === 'boolean')
        return String(v);
    if (Array.isArray(v))
        return '[' + v.map(scalarToYaml).join(', ') + ']';
    return '{ ' + Object.entries(v).map(([k, x]) => `${k}: ${scalarToYaml(x)}`).join(', ') + ' }';
}
export function toYaml(v, indent = 0) {
    const pad = ' '.repeat(indent);
    if (Array.isArray(v)) {
        if (v.length === 0)
            return pad + '[]\n';
        return v.map((item) => {
            if (item && typeof item === 'object' && !Array.isArray(item)) {
                const inner = toYaml(item, indent + 2);
                return pad + '- ' + inner.slice(indent + 2);
            }
            return pad + '- ' + valueInline(item, indent + 2);
        }).join('');
    }
    if (v && typeof v === 'object') {
        return Object.entries(v).map(([k, x]) => {
            if (Array.isArray(x)) {
                if (x.length === 0 || x.every((e) => e === null || typeof e !== 'object'))
                    return `${pad}${k}: ${scalarToYaml(x)}\n`;
                return `${pad}${k}:\n` + toYaml(x, indent + 2);
            }
            if (x && typeof x === 'object') {
                const flat = Object.values(x).every((e) => e === null || typeof e !== 'object');
                if (flat && Object.keys(x).length <= 4 && !Object.values(x).some((e) => typeof e === 'string' && e.includes('\n'))) {
                    return `${pad}${k}: ${scalarToYaml(x)}\n`;
                }
                return `${pad}${k}:\n` + toYaml(x, indent + 2);
            }
            return `${pad}${k}: ${valueInline(x, indent + 2)}`;
        }).join('');
    }
    return pad + valueInline(v, indent);
}
function valueInline(v, childIndent) {
    if (typeof v === 'string' && v.includes('\n')) {
        const body = v.replace(/\n$/, '');
        const header = v.endsWith('\n') ? '|' : '|-';
        return header + '\n' + body.split('\n').map((ln) => (ln === '' ? '' : ' '.repeat(childIndent) + ln)).join('\n') + '\n';
    }
    return scalarToYaml(v) + '\n';
}
//# sourceMappingURL=yaml.js.map