/**
 * 古籍原典库 — SQLite 数据层（运行时）
 *
 * 数据库随包携带（src-tauri/resources/classics.db），运行时落点三级解析（Rust 侧，设计文档 R17）：
 * 程序同目录（主）→ 打包资源就地读 → 应用配置目录（兜底）。
 * 连接锚点由 Rust 命令 classics_db_path 返回绝对路径（plugin-sql 2.6 的相对路径钉死
 * app_config_dir，绝对路径经其 PathBuf::push 替换 base 后直达目标文件）。
 * 所有读取走本模块异步 API；页面层不直接写 SQL。只读纪律：仅发 SELECT。
 */
import Database from '@tauri-apps/plugin-sql';
import { invoke } from '@tauri-apps/api/core';
import type { Paragraph, SearchHit } from './types';

let dbPromise: Promise<Database> | null = null;

/** 惰性连接（setup 自动初始化的双保险：先确保文件就位，再取解析后的绝对路径连接；autoCreate=false → 缺文件时抛错而非静默建空库） */
export function getDb(): Promise<Database> {
  if (!dbPromise) {
    const p = (async () => {
      await invoke('classics_db_init');
      const dbPath = await invoke<string>('classics_db_path');
      return await Database.load(`sqlite:${dbPath}`, { autoCreate: false });
    })();
    p.catch(() => {
      dbPromise = null; // 失败允许下次调用重试
    });
    dbPromise = p;
  }
  return dbPromise;
}

/* ---------- 行形状（SQLite 列名） ---------- */

interface BookRow {
  slug: string;
  title: string;
  dynasty: string;
  author: string;
  category: string;
  intro: string;
  word_count: number;
  chapter_count: number;
  paragraph_count: number;
}

interface ChapterRow {
  idx: number;
  title: string;
  subtitle: string;
}

interface ParaRow {
  idx: number;
  anchor: string;
  text: string;
  translation: string;
  ni_note: string;
}

/* ---------- 页面层可见类型 ---------- */

/** 书目摘要（不含章节/段落载荷，列表页用） */
export interface BookSummary {
  slug: string;
  title: string;
  dynasty: string;
  author: string;
  category: string;
  intro: string;
  wordCount: number;
  chapterCount: number;
  paragraphCount: number;
}

/** 章节摘要 */
export interface ChapterSummary {
  idx: number;
  title: string;
  subtitle: string;
}

/** 全库统计（首页用） */
export interface LibraryStats {
  bookCount: number;
  paragraphCount: number;
  wordCount: number;
}

const BOOK_COLUMNS =
  'slug, title, dynasty, author, category, intro, word_count, chapter_count, paragraph_count';

function mapBook(r: BookRow): BookSummary {
  return {
    slug: r.slug,
    title: r.title,
    dynasty: r.dynasty,
    author: r.author,
    category: r.category,
    intro: r.intro,
    wordCount: r.word_count,
    chapterCount: r.chapter_count,
    paragraphCount: r.paragraph_count,
  };
}

/* ---------- 查询 API ---------- */

/** 书目（按 sort：精选在前，其后按分类）；category 缺省 = 全部 */
export async function listBooks(category?: string): Promise<BookSummary[]> {
  const db = await getDb();
  const rows = category
    ? await db.select<BookRow[]>(`SELECT ${BOOK_COLUMNS} FROM books WHERE category = $1 ORDER BY sort`, [category])
    : await db.select<BookRow[]>(`SELECT ${BOOK_COLUMNS} FROM books ORDER BY sort`);
  return rows.map(mapBook);
}

export async function getBookSummary(slug: string): Promise<BookSummary | null> {
  const db = await getDb();
  const rows = await db.select<BookRow[]>(`SELECT ${BOOK_COLUMNS} FROM books WHERE slug = $1`, [slug]);
  return rows.length > 0 ? mapBook(rows[0]) : null;
}

/** 某书的章节列表（目录页） */
export async function listChapters(slug: string): Promise<ChapterSummary[]> {
  const db = await getDb();
  const rows = await db.select<ChapterRow[]>(
    'SELECT c.idx, c.title, c.subtitle FROM chapters c JOIN books b ON c.book_id = b.id WHERE b.slug = $1 ORDER BY c.idx',
    [slug],
  );
  return rows;
}

/** 某章全文（阅读页） */
export async function getChapterContent(
  slug: string,
  chapterIdx: number,
): Promise<{ book: BookSummary; chapter: ChapterSummary; paragraphs: Paragraph[] } | null> {
  const db = await getDb();
  const bookRows = await db.select<BookRow[]>(
    `SELECT ${BOOK_COLUMNS} FROM books WHERE slug = $1`,
    [slug],
  );
  if (bookRows.length === 0) return null;
  const chRows = await db.select<ChapterRow[]>(
    'SELECT c.idx, c.title, c.subtitle FROM chapters c JOIN books b ON c.book_id = b.id WHERE b.slug = $1 AND c.idx = $2',
    [slug, chapterIdx],
  );
  if (chRows.length === 0) return null;
  const paraRows = await db.select<ParaRow[]>(
    'SELECT p.idx, p.anchor, p.text, p.translation, p.ni_note FROM paragraphs p JOIN chapters c ON p.chapter_id = c.id JOIN books b ON c.book_id = b.id WHERE b.slug = $1 AND c.idx = $2 ORDER BY p.idx',
    [slug, chapterIdx],
  );
  const paragraphs: Paragraph[] = paraRows.map((r) => ({
    id: r.anchor,
    idx: r.idx,
    text: r.text,
    ...(r.translation ? { translation: r.translation } : {}),
    ...(r.ni_note ? { niNote: r.ni_note } : {}),
  }));
  return { book: mapBook(bookRows[0]), chapter: chRows[0], paragraphs };
}

/** 全库统计（首页统计行） */
export async function getStats(): Promise<LibraryStats> {
  const db = await getDb();
  const rows = await db.select<Array<{ book_count: number; paragraph_count: number; word_count: number }>>(
    'SELECT COUNT(*) AS book_count, COALESCE(SUM(paragraph_count), 0) AS paragraph_count, COALESCE(SUM(word_count), 0) AS word_count FROM books',
  );
  return {
    bookCount: rows[0]?.book_count ?? 0,
    paragraphCount: rows[0]?.paragraph_count ?? 0,
    wordCount: rows[0]?.word_count ?? 0,
  };
}

/** 段落所属章节序号（搜索页「查看原文」跳转用） */
export async function getParagraphChapterIdx(anchor: string): Promise<number | null> {
  const db = await getDb();
  const rows = await db.select<Array<{ idx: number }>>(
    'SELECT c.idx FROM paragraphs p JOIN chapters c ON p.chapter_id = c.id WHERE p.anchor = $1',
    [anchor],
  );
  return rows.length > 0 ? rows[0].idx : null;
}

/** 批量：一组段落锚点对应的章节序号（搜索页跳转链接，单次往返） */
export async function getParagraphChapterIdxs(anchors: string[]): Promise<Record<string, number>> {
  if (anchors.length === 0) return {};
  const db = await getDb();
  const marks = anchors.map((_, i) => `$${i + 1}`).join(', ');
  const rows = await db.select<Array<{ anchor: string; idx: number }>>(
    `SELECT p.anchor, c.idx FROM paragraphs p JOIN chapters c ON p.chapter_id = c.id WHERE p.anchor IN (${marks})`,
    anchors,
  );
  const out: Record<string, number> = {};
  for (const r of rows) out[r.anchor] = r.idx;
  return out;
}

/* ---------- 全文检索（LIKE AND 语义） ---------- */

/**
 * 查询词切分：CJK 连续串 → 二元组；拉丁/数字串 → 小写整词（≥2 字符）。
 * AND 语义 = 各词须同段出现；去重并封顶 8 词（约束全表扫描次数，桌面端 <100ms）。
 */
export function searchTerms(query: string): string[] {
  const q = query.trim();
  const terms: string[] = [];
  const runs = q.match(/[\u3400-\u4dbf\u4e00-\u9fff]+|[A-Za-z0-9]+/g) ?? [];
  for (const r of runs) {
    if (/^[A-Za-z0-9]+$/.test(r)) {
      if (r.length >= 2) terms.push(r.toLowerCase());
    } else if (r.length === 1) {
      terms.push(r);
    } else {
      for (let i = 0; i + 1 < r.length; i++) terms.push(r.slice(i, i + 2));
    }
  }
  return [...new Set(terms)].slice(0, 8);
}

/** 全文检索（命中段落在库内按 书/章/段 顺序，limit 内截断） */
export async function searchClassics(query: string, limit = 30): Promise<SearchHit[]> {
  const terms = searchTerms(query);
  if (terms.length === 0) return [];
  const db = await getDb();
  const where = terms.map((_, i) => `p.text LIKE $${i + 1}`).join(' AND ');
  const params: (string | number)[] = [...terms.map((t) => `%${t}%`), limit];
  const rows = await db.select<
    Array<{ slug: string; title: string; chapter_title: string; anchor: string; text: string }>
  >(
    `SELECT b.slug, b.title, c.title AS chapter_title, p.anchor, p.text
     FROM paragraphs p
     JOIN chapters c ON p.chapter_id = c.id
     JOIN books b ON c.book_id = b.id
     WHERE ${where}
     ORDER BY b.sort, c.idx, p.idx
     LIMIT $${terms.length + 1}`,
    params,
  );
  return rows.map((r) => {
    const term = terms[0];
    const idx = r.text.indexOf(term);
    const start = Math.max(0, idx - 40);
    const end = Math.min(r.text.length, idx + term.length + 40);
    const snippet =
      (start > 0 ? '…' : '') +
      escapeHtml(r.text.slice(start, idx)) +
      `<mark>${escapeHtml(r.text.slice(idx, idx + term.length))}</mark>` +
      escapeHtml(r.text.slice(idx + term.length, end)) +
      (end < r.text.length ? '…' : '');
    return {
      bookSlug: r.slug,
      bookTitle: r.title,
      chapterTitle: r.chapter_title,
      paragraphId: r.anchor,
      snippet,
      text: r.text,
    };
  });
}

/** 库元数据（schema_version / content_version / built_at 等） */
export async function getMeta(): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.select<Array<{ key: string; value: string }>>('SELECT key, value FROM meta');
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
