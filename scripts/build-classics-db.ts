#!/usr/bin/env -S npx tsx
/**
 * 古籍原典库 SQLite 构建器
 *
 * 从 shushubook 术数书库（201 个 .txt：UTF-16LE 为主 / 6 个 UTF-8）+ 现有 3 本精选
 * 生成 src-tauri/resources/classics.db（纯表 + LIKE 检索；FTS5 索引实测 123MB 已弃，见设计文档 R6）。
 *
 * 用法：
 *   npx tsx scripts/build-classics-db.ts
 *   SHUSHUBOOK_DIR=/path/to/shushubook npx tsx scripts/build-classics-db.ts
 *
 * 幂等：每次全量重建（先 DROP 再建）。
 * 来源标注：shushubook 术数书库 + 少量现代著作（用户已确认全量入库）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import initSqlJs from '@sqlite.org/sqlite-wasm';
import type { Sqlite3Static, SqlValue } from '@sqlite.org/sqlite-wasm';
import type { Book } from '../../src/lib/classics/types';
import { guSuiFu } from './classics-data/gusuifu';
import { ziWeiQuanJi } from './classics-data/quanji';
import { ziWeiQuanShu } from './classics-data/quanshu';

const here = path.dirname(fileURLToPath(import.meta.url));
const SHUSHUBOOK_DIR = process.env.SHUSHUBOOK_DIR
  ? path.resolve(process.env.SHUSHUBOOK_DIR)
  : path.resolve(here, '../../../shushubook');
const OUT_FILE = path.resolve(here, '../src-tauri/resources/classics.db');
const SCHEMA_VERSION = '1';
const CONTENT_VERSION = '1';

/** 分类顺序（「紫微斗数」精选排最前） */
export const CATEGORIES = [
  '紫微斗数', '周易', '命理', '奇门遁甲', '六壬',
  '堪舆风水', '占卜', '相术', '其他', '现代',
] as const;
export type Category = (typeof CATEGORIES)[number];

/** shushubook 目录名 → 库内分类（現代目录名用繁体，库内统一简体） */
const DIR_TO_CATEGORY: Record<string, Category> = {
  '周易': '周易',
  '命理': '命理',
  '奇门遁甲': '奇门遁甲',
  '六壬': '六壬',
  '堪舆风水': '堪舆风水',
  '占卜': '占卜',
  '相术': '相术',
  '其他': '其他',
  '現代': '现代',
};

/** 现有 3 本精选（TS 数据原样迁入，锚点不变） */
const CURATED: Book[] = [guSuiFu, ziWeiQuanJi, ziWeiQuanShu];

/* ============================== 解码 ============================== */

interface Decoded {
  text: string;
  enc: 'utf16le' | 'utf16be' | 'utf8-bom' | 'utf8' | 'gbk';
}

/** BOM 探测 + 严格 UTF-8 优先 + GBK 防御性回退（实测分布：utf16le 195 / utf8 6 / gbk 0） */
function decode(buf: Buffer): Decoded {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return { text: buf.subarray(2).toString('utf16le').replace(/^\uFEFF/, ''), enc: 'utf16le' };
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return { text: buf.subarray(2).toString('utf16be').replace(/^\uFEFF/, ''), enc: 'utf16be' };
  }
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return { text: buf.subarray(3).toString('utf8'), enc: 'utf8-bom' };
  }
  try {
    const s = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(buf));
    return { text: s, enc: 'utf8' };
  } catch {
    const s = new TextDecoder('gbk').decode(new Uint8Array(buf));
    return { text: s, enc: 'gbk' };
  }
}

/** CJK 占比 sanity check（前 1000 字，低于 20% 告警——防止解码选错产生乱码） */
function cjkRatio(s: string): number {
  const head = s.slice(0, 1000);
  if (head.length === 0) return 0;
  let cjk = 0;
  for (const ch of head) {
    const cp = ch.codePointAt(0)!;
    if ((cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3400 && cp <= 0x4dbf)) cjk++;
  }
  return cjk / head.length;
}

/* ============================== 元数据 ============================== */

interface Meta {
  title: string;
  dynasty: string;
  author: string;
}

/** 文件名惯例：书名-朝代-作者 / 书名--作者 / 书名-- / 书名 */
function parseMeta(stem: string): Meta {
  const parts = stem.split('-');
  let title = stem;
  let dynasty = '不详';
  let author = '佚名';
  if (parts.length >= 3) {
    title = parts[0];
    dynasty = parts[1] || '不详';
    author = parts.slice(2).join('-') || '佚名';
  } else if (parts.length === 2) {
    title = parts[0];
    author = parts[1] || '佚名';
  }
  return { title, dynasty, author };
}

/** 手工覆盖：文件名解析失败或需消歧的书（重复书保留两本、加区分，不静默去重） */
const META_OVERRIDE: Record<string, Partial<Meta>> = {
  // 現代目录名（文件内含空格与全角破折号，无法按惯例解析）；作者据卷首「黎光先生…」
  '京房遗法 筮法巅峰——《易隐》高层断法破解': { dynasty: '现代', author: '黎光' },
  // 无后缀版与「皇极经世书-宋-邵雍」书名冲突；出版信息取自卷首（九州出版社 王鹤鸣 殷子和 整理）
  '皇极经世书': { title: '皇极经世书（王鹤鸣、殷子和 整理）', dynasty: '宋', author: '邵雍' },
};

/** 名著简介（手写；其余自动生成） */
const INTRO_OVERRIDE: Record<string, string> = {
  '三命通会': '明万民英编，集子平命理之大成，以日干为中心论五行生克、格局用神，为命理学最系统的百科全书。',
  '渊海子平': '宋徐子平著，子平法开山之作，确立年月日时四柱推命体系。',
  '滴天髓阐微': '相传京图撰、清任铁樵阐微，精论日干旺衰与格局成败，为命学理论最高峰之一。',
  '穷通宝鉴': '明余春台整理，专论十天干生于十二月之调候用神，寒暖燥湿、穷通得失。',
  '子平真诠评注': '清沈孝瞻原著，评注本详阐格局成败与取用之道，格局派必读。',
  '神峰通考': '明张楠著，批判性总结子平诸说，发明“病药说”，重实证验案。',
  '兰台妙选': '明西窗老人著，以纳音取象论命，风格独特，流传颇广。',
  '玉照神应真经': '托名晋郭璞，赋体论命理神煞，文字古奥。',
  '命理探源': '民国袁树珊撰，近代命理集大成之著，体系完备、论证翔实。',
  '千里命稿': '民国韦千里撰，近代命理教材经典，由浅入深、例证丰富。',
  '奇门遁甲统宗': '托名诸葛亮，集奇门理论、局例、应验于一体，为奇门遁甲最通行的统编本。',
  '奇门法窍': '清锡孟樨撰，奇门理论辨析精详，为奇门进阶要籍。',
  '奇门遁甲秘笈大全': '托名刘伯温，汇奇门各家秘笈，卷帙浩繁。',
  '遁甲演义': '明程道生撰，论遁甲源流与九星八门八神之理，条理清晰。',
  '太乙金镜式经': '唐王希明撰，太乙神数（三式之一）的奠基之作。',
  '梅花易数': '托名邵雍，以象数起卦、体用生克断事，为易占最易上手之法。',
  '卜筮正宗': '清王洪绪著，六爻纳甲占法权威教材，附断易天机精髓。',
  '增删卜易': '清野鹤老人著，删补《卜筮正宗》并附大量验案，六爻实践必读。',
  '火珠林': '托名麻衣道者，六爻纳甲法最早专书。',
  '断易天机': '明初编，六爻占法要诀汇编。',
  '皇极经世书（王鹤鸣、殷子和 整理）': '宋邵雍著，以元会运世推衍历数、观物内外篇，象数学巅峰之作。',
  '周易本义': '宋朱熹注，象数义理并重，为朱子易学代表作。',
  '周易正义': '唐孔颖达疏，汉代象数与魏晋义理之集大成，注疏传统标准本。',
  '伊川易传': '宋程颐著，义理易学巅峰，以《系辞》释经、阐发天人之际。',
  '焦氏易林': '汉焦延寿作，六十四卦变六十四卦、每卦四句诗，辞藻丰富、占验备载。',
  '葬书': '托名晋郭璞，堪舆理论奠基之作，“气”论为风水学总纲。',
  '撼龙经': '唐杨筠松著，峦头派开山经典，论龙脉形势。',
  '冰鉴': '托名清曾国藩，相法名篇，以神骨气色论人。',
  '神相全编': '托名宋陈抟（后世增补），相术集大成之作。',
  '推背图': '托名唐李淳风、袁天罡，象纬谶纬名书。',
  '太玄经': '汉扬雄仿《易》所作，以九六代阴阳、八十一首推天道。',
  '六壬大全': '明郭载騋编，大六壬集大成之作，课式占断完备。',
  '六壬指南': '明陈公献著，大六壬精要，注释心印赋、指掌赋。',
  '人子须知': '明徐继善著，堪舆峦头理气入门必读，体系完整。',
  '青囊序': '托名唐杨筠松，理气风水核心口诀。',
  '天元五歌': '明蒋大鸿著，理气派重要文献。',
};

function makeIntro(meta: Meta, category: Category, chapterCount: number): string {
  return INTRO_OVERRIDE[meta.title]
    ?? `${category}类古籍，${meta.dynasty} ${meta.author} 撰，共 ${chapterCount} 章。`;
}

/* ============================== 章节切分 ============================== */

interface Chapter {
  title: string;
  subtitle?: string;
  lines: string[];
}

// 句读（，。；？！）出现在行内即视为正文残句而非标题；卷/第X 级允许冒号、括号、空格（奇门统宗实测）
export const RE_PRIMARY = new RegExp(
  [
    '^卷[上中下之一二三四五六七八九十0-9]{1,4}[^，。；？！]{0,30}$', // 卷一 / 卷之上 / 卷之一 / 卷一（上经之一）　坤 / 卷之四：奇门遁甲阳局
    '^第[一二三四五六七八九十百0-9]{1,4}[卷章回篇部集][^，。；？！]{0,25}$', // 第一卷论六十甲子上 / 第一章　青囊奥语
    '^第[一二三四五六七八九十百0-9]{1,3}节[、:：\\s]?[^，。；？！]{0,25}$', // 第二节、《易隐》的独特断卦法 / 第一节
    '^(?:上|中|下)篇[\\u4e00-\\u9fff\\u3400-\\u4dbf\\s]{0,12}$', // 上篇 / 上篇　卷三
    '^[0-9]{1,3}、[\\u4e00-\\u9fff\\u3400-\\u4dbf《》]{1,20}$', // 1、總斷千金賦（黃金策数字编号）
    '^《[^》]{1,20}》卷[上中下之一二三四五六七八九十0-9]{1,4}$', // 《东坡易传》卷之一
    '^[\\u4e00-\\u9fff]{1,2}\\s*卦\\s*[(（]\\s*第\\s*[一二三四五六七八九十]{1,3}\\s*[)）]$', // 乾 卦 (第一) / 坤  卦（第 二）（易传式卦题，OCR 空格不一）
  ].join('|'),
);
// 节级：全书无卷级结构时才作为切分点（论X 主题行 / 总论X）
export const RE_SECONDARY = new RegExp(
  ['^总论(?:$|[\\u4e00-\\u9fff\\u3400-\\u4dbf]{1,10}$)', '^论[\\u4e00-\\u9fff\\u3400-\\u4dbf]{1,14}$'].join('|'),
);
export const RE_XU = /^(?:序|自序|引|序言|[\u4e00-\u9fff]{2,6}序)$/; // 含「易冒王序」「易冒顾序」式具名序
export const RE_SECTION = /^(?:上经|下经|系辞上|系辞下|说卦|序卦|杂卦|文言)$/; // 易经大篇（恒切）

/** 中文数字 1-99（等分标题用） */
function cn(n: number): string {
  const d = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  if (n < 10) return d[n];
  if (n < 20) return '十' + (n % 10 ? d[n % 10] : '');
  return d[Math.floor(n / 10)] + '十' + (n % 10 ? d[n % 10] : '');
}

/**
 * 两级启发式切分：
 * - 卷级标题 ≥2 → 按卷级切分（序/自序 恒切）；
 * - 否则节级标题 ≥2 → 按节级切分；
 * - 否则按 ~300 行等分（保证可阅读粒度）。
 * 未选为切分点的标题行保留为正文段落（原样入库，不静默改写）。
 */
export function splitChapters(allLines: string[], bookTitle: string): Chapter[] {
  const lines = allLines.map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  let primary = 0;
  let secondary = 0;
  for (const l of lines) {
    if (RE_PRIMARY.test(l)) primary++;
    else if (RE_SECONDARY.test(l)) secondary++;
  }
  const useSecondary = primary < 2 && secondary >= 2;
  const cutIdx = lines.map((l) =>
    RE_XU.test(l) || RE_SECTION.test(l) || RE_PRIMARY.test(l) || (useSecondary && RE_SECONDARY.test(l)),
  );

  // 目录降权：前 150 行内出现 ≥3 个连续标题行 = 目录块，降为正文
  //（目录条目与正文真实标题同形，「连续 + 顶部位置」是唯一可靠判别）
  const demoted = new Set<number>();
  {
    let i = 0;
    const lim = Math.min(lines.length, 150);
    while (i < lim) {
      if (!cutIdx[i]) { i++; continue; }
      let j = i;
      while (j < lines.length && cutIdx[j]) j++;
      if (j - i >= 3) for (let k = i; k < j; k++) demoted.add(k);
      i = j;
    }
  }

  const PREAMBLE = '__preamble__';
  const chapters: Chapter[] = [];
  let cur: Chapter | null = null;
  lines.forEach((l, idx) => {
    if (cutIdx[idx] && !demoted.has(idx)) {
      cur = { title: l, lines: [] };
      chapters.push(cur);
    } else {
      if (!cur) {
        cur = { title: PREAMBLE, lines: [] };
        chapters.unshift(cur);
      }
      cur.lines.push(l);
    }
  });

  // 无有效标题 → 等分
  if (chapters.length === 0 || (chapters.length === 1 && chapters[0].title === PREAMBLE)) {
    return equalSplit(lines);
  }

  // 前言：仅书名一行则丢弃（与页面标题重复）；其余为「卷首」章
  if (chapters[0].title === PREAMBLE) {
    const ls = chapters[0].lines;
    if (ls.length === 1 && (ls[0] === bookTitle || ls[0] === `《${bookTitle}》`)) {
      chapters.shift();
    } else {
      chapters[0].title = '卷首';
    }
  }

  // 无正文的标题（目录残留 / 标题紧邻标题）：直接丢弃
  for (let i = chapters.length - 1; i >= 0; i--) {
    if (chapters[i].lines.length === 0) chapters.splice(i, 1);
  }
  if (chapters.length === 0) return equalSplit(lines);
  // 仅剩一章（如目录降权后只剩「序」）→ 全书等分
  if (chapters.length === 1) return equalSplit(lines);

  // 超大章（>600 行）→ 拆为 ~300 行小节，标题冠「第N部分」
  const out: Chapter[] = [];
  for (const ch of chapters) {
    out.push(...(ch.lines.length > 600 ? equalSplit(ch.lines, ch.title) : [ch]));
  }
  return out;
}

/** 等分兜底（约 300 行/节；尾节 <40 行并入前节；base 给出「base 第N部分」前缀） */
function equalSplit(lines: string[], base?: string): Chapter[] {
    const SIZE = 300;
    const n = Math.max(1, Math.round(lines.length / SIZE));
    const step = Math.ceil(lines.length / n);
    const chapters: Chapter[] = [];
    for (let i = 0; i < n; i++) {
      const slice = lines.slice(i * step, (i + 1) * step);
      if (slice.length === 0) break;
      const title = n === 1 ? (base ?? '全文') : base ? `${base} 第${cn(i + 1)}部分` : `第${cn(i + 1)}部分`;
      chapters.push({ title, lines: slice });
    }
  if (chapters.length > 1 && chapters[chapters.length - 1].lines.length < 40) {
    const last = chapters.pop()!;
    chapters[chapters.length - 1].lines.push(...last.lines);
  }
  return chapters;
}

/* ============================== 收书 ============================== */

interface NewBook {
  title: string;
  dynasty: string;
  author: string;
  category: Category;
  wordCount: number;
  chapters: Chapter[];
  source: string;
}

function collectNewBooks(): { books: NewBook[]; encDist: Record<string, number>; skipped: string[]; crLineEndFiles: number } {
  const books: NewBook[] = [];
  const encDist: Record<string, number> = {};
  const skipped: string[] = [];
  let crLineEndFiles = 0;
  if (!fs.existsSync(SHUSHUBOOK_DIR)) {
    console.error(`shushubook 目录不存在：${SHUSHUBOOK_DIR}`);
    process.exit(1);
  }
  const dirs = fs.readdirSync(SHUSHUBOOK_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name in DIR_TO_CATEGORY)
    .sort((a, b) => CATEGORIES.indexOf(DIR_TO_CATEGORY[a.name]) - CATEGORIES.indexOf(DIR_TO_CATEGORY[b.name]));
  for (const d of dirs) {
    const category = DIR_TO_CATEGORY[d.name];
    const files = fs.readdirSync(path.join(SHUSHUBOOK_DIR, d.name), { withFileTypes: true })
      .filter((f) => f.isFile())
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)); // 码元序，跨平台稳定
    for (const f of files) {
      const full = path.join(SHUSHUBOOK_DIR, d.name, f.name);
      if (!f.name.endsWith('.txt')) {
        skipped.push(`${d.name}/${f.name}（非 txt，跳过）`);
        continue;
      }
      const { text, enc } = decode(fs.readFileSync(full));
      encDist[enc] = (encDist[enc] ?? 0) + 1;
      const ratio = cjkRatio(text);
      if (ratio < 0.2) console.warn(`[warn] CJK 占比低（${(ratio * 100).toFixed(1)}%）：${d.name}/${f.name}`);
      const crCount = (text.match(/\r(?!\n)/g) ?? []).length;
      if (crCount > 0) crLineEndFiles++;
      const stem = f.name.slice(0, -4);
      const meta = { ...parseMeta(stem), ...META_OVERRIDE[stem] };
      // 行尾归一：源文件存在纯 CR 及 CR/LF 混合行尾（实测 易原 等），\r?\n 切不开纯 CR
      const chapters = splitChapters(text.split(/[\r\n]+/), meta.title);
      if (chapters.length === 0) {
        skipped.push(`${d.name}/${f.name}（无正文内容）`);
        continue;
      }
      const wordCount = chapters.reduce((s, c) => s + c.lines.reduce((x, l) => x + l.length, 0), 0);
      books.push({
        title: meta.title,
        dynasty: meta.dynasty,
        author: meta.author,
        category,
        wordCount,
        chapters,
        source: `${d.name}/${f.name}`,
      });
    }
  }
  return { books, encDist, skipped, crLineEndFiles };
}

/* ============================== 建库 ============================== */

type DB = InstanceType<Sqlite3Static['oo1']['DB']>;

const SCHEMA = `
PRAGMA journal_mode = OFF;
DROP TABLE IF EXISTS paragraphs;
DROP TABLE IF EXISTS chapters;
DROP TABLE IF EXISTS books;
DROP TABLE IF EXISTS meta;
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE books (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  dynasty TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '佚名',
  category TEXT NOT NULL,
  intro TEXT NOT NULL DEFAULT '',
  word_count INTEGER NOT NULL DEFAULT 0,
  chapter_count INTEGER NOT NULL DEFAULT 0,
  paragraph_count INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL
);
CREATE TABLE chapters (
  id INTEGER PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES books(id),
  idx INTEGER NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT ''
);
CREATE TABLE paragraphs (
  id INTEGER PRIMARY KEY,
  chapter_id INTEGER NOT NULL REFERENCES chapters(id),
  idx INTEGER NOT NULL,
  anchor TEXT UNIQUE NOT NULL,
  text TEXT NOT NULL,
  translation TEXT NOT NULL DEFAULT '',
  ni_note TEXT NOT NULL DEFAULT ''
);
-- 不建 FTS5 索引：FTS 版实测 123MB 远超目标；LIKE 全文扫描在 21.9 万段规模下 <100ms（桌面端可接受）
CREATE INDEX idx_books_category ON books(category, sort);
`;

interface ParaRow {
  anchor: string;
  text: string;
  translation?: string;
  niNote?: string;
}

function insertAll(db: DB, newBooks: NewBook[]): void {
  const insBook = db.prepare(
    'INSERT INTO books (id, slug, title, dynasty, author, category, intro, word_count, chapter_count, paragraph_count, sort) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
  );
  const insChapter = db.prepare('INSERT INTO chapters (id, book_id, idx, title, subtitle) VALUES ($1,$2,$3,$4,$5)');
  const insPara = db.prepare(
    'INSERT INTO paragraphs (chapter_id, idx, anchor, text, translation, ni_note) VALUES ($1,$2,$3,$4,$5,$6)',
  );
  db.exec('BEGIN');

  let seq = 0;
  const putBook = (
    slug: string, title: string, dynasty: string, author: string, category: string,
    intro: string, wordCount: number,
    chapters: { title: string; subtitle?: string; paragraphs: ParaRow[] }[],
  ): void => {
    seq++;
    const chapterRows = chapters.map((c, ci) => ({ id: seq * 10000 + ci, ...c })); // 章 id = 书id*10000+序（书≤999、章≤9999）
    const paragraphCount = chapters.reduce((s, c) => s + c.paragraphs.length, 0);
    insBook.bind([seq, slug, title, dynasty, author, category, intro, wordCount, chapters.length, paragraphCount, seq]);
    insBook.step(); insBook.reset(true);
    for (const c of chapterRows) {
      insChapter.bind([c.id, seq, c.id % 10000, c.title, c.subtitle ?? '']);
      insChapter.step(); insChapter.reset(true);
      c.paragraphs.forEach((p, pi) => {
        insPara.bind([c.id, pi, p.anchor, p.text, p.translation ?? '', p.niNote ?? '']);
        insPara.step(); insPara.reset(true);
      });
    }
  };

  // 1) 现有 3 本精选（锚点/正文原样迁移）
  for (const b of CURATED) {
    putBook(
      b.slug, b.title, b.dynasty, b.author, '紫微斗数', b.intro, b.wordCount,
      b.chapters.map((c) => ({
        title: c.title,
        subtitle: c.subtitle,
        // 精选数据用 id 作锚点，此处映射为 ParaRow.anchor
        paragraphs: c.paragraphs.map((p) => ({ anchor: p.id, text: p.text, translation: p.translation, niNote: p.niNote })),
      })),
    );
  }
  // 2) shushubook 201 本（锚点 {slug}-{章序+1}-{段序+1}）
  newBooks.forEach((b, i) => {
    const slug = `sb-${String(i + 1).padStart(3, '0')}`;
    putBook(
      slug, b.title, b.dynasty, b.author, b.category,
      makeIntro({ title: b.title, dynasty: b.dynasty, author: b.author }, b.category, b.chapters.length),
      b.wordCount,
      b.chapters.map((c, ci) => ({
        title: c.title,
        subtitle: c.subtitle,
        paragraphs: c.lines.map((l, li) => ({ anchor: `${slug}-${ci + 1}-${li + 1}`, text: l })),
      })),
    );
  });

  const insMeta = db.prepare('INSERT INTO meta (key, value) VALUES ($1,$2)');
  const q = makeQuery(db);
  const bookCount = q('SELECT COUNT(*) FROM books')[0][0] as number;
  const paraCount = q('SELECT COUNT(*) FROM paragraphs')[0][0] as number;
  const metas: [string, string][] = [
    ['schema_version', SCHEMA_VERSION],
    ['content_version', CONTENT_VERSION],
    ['built_at', new Date().toISOString()],
    ['source', 'shushubook + 3 curated'],
    ['book_count', String(bookCount)],
    ['paragraph_count', String(paraCount)],
  ];
  for (const [k, v] of metas) {
    insMeta.bind([k, v]); insMeta.step(); insMeta.reset(true);
  }
  insBook.finalize(); insChapter.finalize(); insPara.finalize(); insMeta.finalize();
  db.exec('COMMIT');
}

/* ============================== 自检与统计 ============================== */

function makeQuery(db: DB): (sql: string, ...params: SqlValue[]) => unknown[][] {
  return (sql, ...params) => {
    const s = db.prepare(sql);
    if (params.length > 0) s.bind(params);
    const rows: unknown[][] = [];
    while (s.step()) rows.push(s.get([]) as unknown[]);
    s.finalize();
    return rows;
  };
}

/** A6.1 自检：失败即退出，不产出坏库 */
function selfCheck(db: DB): void {
  const q = makeQuery(db);
  const fail = (label: string, actual: unknown, expected: unknown): never => {
    console.error(`SELF-CHECK FAIL [${label}]: actual=${String(actual)} expected=${String(expected)}`);
    process.exit(1);
  };

  const bookCount = q('SELECT COUNT(*) FROM books')[0][0] as number;
  if (bookCount !== 204) fail('book_count', bookCount, 204);
  console.log(`  ✓ books = ${bookCount}`);

  // 3 本精选：锚点/正文/译注/倪注无损
  for (const b of CURATED) {
    const rows = q(
      `SELECT p.anchor, p.text, p.translation, p.ni_note FROM paragraphs p
       JOIN chapters c ON p.chapter_id = c.id
       JOIN books bk ON c.book_id = bk.id
       WHERE bk.slug = $1
       ORDER BY c.idx, p.idx`,
      b.slug,
    );
    const src = b.chapters.flatMap((c) => c.paragraphs);
    if (rows.length !== src.length) fail(`${b.slug}.count`, rows.length, src.length);
    for (let i = 0; i < src.length; i++) {
      const [anchor, text, tr, note] = rows[i] as [string, string, string, string];
      const p = src[i];
      if (anchor !== p.id || text !== p.text || tr !== (p.translation ?? '') || note !== (p.niNote ?? '')) {
        fail(`${b.slug}.para[${i}]`, { anchor, head: text.slice(0, 16) }, { anchor: p.id, head: p.text.slice(0, 16) });
      }
    }
    console.log(`  ✓ ${b.slug}（${b.title}）${src.length} 段无损`);
  }

  // 样章断言（期望值取自源文件实测，2026-10-28）
  const chapterTitle = (slug: string, idx: number): string =>
    (q('SELECT c.title FROM chapters c JOIN books b ON c.book_id = b.id WHERE b.slug = $1 AND c.idx = $2', slug, idx)[0][0] ?? '') as string;
  const firstPara = (slug: string, chIdx: number): string =>
    (q(
      `SELECT p.text FROM paragraphs p JOIN chapters c ON p.chapter_id = c.id JOIN books b ON c.book_id = b.id
       WHERE b.slug = $1 AND c.idx = $2 ORDER BY p.idx LIMIT 1`,
      slug, chIdx,
    )[0][0] ?? '') as string;

  const tshSlug = (q('SELECT slug FROM books WHERE title = $1', '三命通会')[0][0] ?? '') as string;
  if (chapterTitle(tshSlug, 0) !== '卷一') fail('三命通会.ch0', chapterTitle(tshSlug, 0), '卷一');
  if (!firstPara(tshSlug, 0).startsWith('论五行生成')) fail('三命通会.ch0.p0', firstPara(tshSlug, 0).slice(0, 16), '论五行生成…');
  console.log('  ✓ 三命通会：ch0=卷一，首段「论五行生成」');

  // 统宗顶部为目录（卷目已降权）且正文无真实卷标题 → 全书等分（第一部分/第二部分）
  const qmtzSlug = (q('SELECT slug FROM books WHERE title = $1', '奇门遁甲统宗')[0][0] ?? '') as string;
  if (chapterTitle(qmtzSlug, 0) !== '第一部分') fail('奇门遁甲统宗.ch0', chapterTitle(qmtzSlug, 0), '第一部分');
  const dunjiaHits = q(
    "SELECT COUNT(*) FROM paragraphs p JOIN chapters c ON p.chapter_id = c.id JOIN books b ON c.book_id = b.id WHERE b.slug = $1 AND p.text LIKE '遁甲为兵而设%'",
    qmtzSlug,
  )[0][0] as number;
  if (dunjiaHits !== 1) fail('奇门遁甲统宗.遁甲段', dunjiaHits, 1);
  console.log('  ✓ 奇门遁甲统宗：全书等分（第一部分/第二部分），「遁甲为兵而设」段在库');

  // 检索冒烟：已知句子经 LIKE 可检索（运行期数据层同法）
  const likeHits = q("SELECT COUNT(*) FROM paragraphs WHERE text LIKE '%遁甲为兵而设%'")[0][0] as number;
  if (likeHits < 1) fail('LIKE 遁甲为兵而设', likeHits, '≥1');
  console.log(`  ✓ LIKE「遁甲为兵而设」命中 ${likeHits} 段`);

  console.log(`  ✓ paragraphs 总计 = ${q('SELECT SUM(paragraph_count) FROM books')[0][0]}`);
}

function printStats(db: DB, encDist: Record<string, number>, skipped: string[]): void {
  const q = makeQuery(db);
  console.log('\n== 分类统计 ==');
  for (const row of q('SELECT category, COUNT(*), SUM(chapter_count), SUM(paragraph_count), SUM(word_count) FROM books GROUP BY category ORDER BY MIN(sort)')) {
    console.log(`  ${String(row[0])}: ${String(row[1])} 本 / ${String(row[2])} 章 / ${String(row[3])} 段 / ${String(row[4])} 字`);
  }
  console.log('== 编码分布 ==');
  for (const [k, v] of Object.entries(encDist)) console.log(`  ${k}: ${v}`);
  if (skipped.length > 0) {
    console.log('== 跳过 ==');
    for (const s of skipped) console.log(`  ${s}`);
  }
  console.log('\n== 逐书章节数（供抽样审查） ==');
  for (const row of q('SELECT category, title, chapter_count, paragraph_count FROM books ORDER BY sort')) {
    console.log(`  [${String(row[0])}] ${String(row[1])}: ${String(row[2])} 章 / ${String(row[3])} 段`);
  }
}

/* ============================== 入口 ============================== */

async function main(): Promise<void> {
  console.log(`shushubook: ${SHUSHUBOOK_DIR}`);
  const { books: newBooks, encDist, skipped, crLineEndFiles } = collectNewBooks();
  console.log(`收书 ${newBooks.length} 本（期望 201；跳过 ${skipped.length}）`);
  if (crLineEndFiles > 0) console.log(`含 CR 行尾文件 ${crLineEndFiles} 个（行尾已归一化）`);
  if (newBooks.length !== 201) {
    console.error('书目数量不符（期望 201）');
    process.exit(1);
  }

  const SQL = await initSqlJs();
  const db = new SQL.oo1.DB();
  db.exec(SCHEMA);
  insertAll(db, newBooks);
  selfCheck(db);
  printStats(db, encDist, skipped);

  const bytes = SQL.capi.sqlite3_js_db_export(db);
  db.close();
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  console.log(`\n写出 ${OUT_FILE}（${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB）`);
}

// 仅作为入口运行时执行构建（被 import 时只导出函数，便于调试/复用）
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  });
}
