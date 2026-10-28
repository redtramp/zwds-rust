/**
 * 古籍原典库 — 入口
 *
 * 数据存于 SQLite（classics.db，随包携带；由 scripts/build-classics-db.ts 构建）。
 * 本模块重导出异步数据层 API（db.ts）；页面层只应使用这些函数。
 * 精选 3 本的原始 TS 数据（./data/）已迁入数据库，仅作为构建脚本的数据源，
 * 不再进入前端运行时 bundle。
 */
export {
  getDb,
  listBooks,
  getBookSummary,
  listChapters,
  getChapterContent,
  getStats,
  getParagraphChapterIdx,
  getParagraphChapterIdxs,
  searchClassics,
  searchTerms,
  getMeta,
} from './db';
export type { BookSummary, ChapterSummary, LibraryStats } from './db';
export type { Book, Chapter, Paragraph, SearchHit } from './types';
