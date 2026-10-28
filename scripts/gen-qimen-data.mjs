#!/usr/bin/env node
/**
 * 从 kinqimen Python 源生成奇门引擎的纯数据段（1:1，无手工转录）。
 *
 * 用法: node scripts/gen-qimen-data.mjs <kinqimen目录> <输出.ts>
 *
 * 输出内容（含数量自检，任一不符即报错退出）：
 *   - KOOK_SETTING / SKYPAN_ORDERS / GET_ZF_ORDERS（config.py pan_sky_minute L734-767）
 *   - SKY_SPECIAL（config.py pan_sky_minute L775-866 特判列表，保持原顺序）
 *   - FS_ORDER_KE（config.py wuxing_strong_week_minute L683-706 的 24 行）
 *   - ZHIFU_PAI（config.py zhifu_pai L423-440 的排盘表，zhifu_pai_ke 同款）
 *   - ANGAN（angan.py 全表 180 项，保持原顺序；原文异体/笔误 己已/辛末/已卯 原样保留）
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [kinqimenDir, outTs] = process.argv.slice(2);
if (!kinqimenDir || !outTs) {
  console.error('用法: node gen-qimen-data.mjs <kinqimen目录> <输出.ts>');
  process.exit(1);
}
const configSrc = readFileSync(`${kinqimenDir}/config.py`, 'utf8');
const anganSrc = readFileSync(`${kinqimenDir}/angan.py`, 'utf8');

const fail = (msg) => { console.error(`✗ ${msg}`); process.exit(1); };
const block = (src, re, label) => {
  const m = src.match(re);
  if (!m) fail(`未找到 ${label} 块`);
  return m[1];
};

/* ---------- kook_setting / skypan_orders / orders ---------- */
// 注意：kinqimen 源文件为 CRLF 行尾，锚点一律用 \r?\n
const kookSettingBlock = block(configSrc, /kook_setting = (\[.*?\])\r?\n/, 'kook_setting');
const kookSetting = [...kookSettingBlock.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
if (kookSetting.length !== 6) fail(`kook_setting 应有 6 项，实得 ${kookSetting.length}`);

const skyBlock = block(configSrc, /skypan_orders = (\[\[[\s\S]*?\]\])\r?\n/, 'skypan_orders');
const skyRows = [...skyBlock.matchAll(/list\("([^"]+)"\)/g)].map((m) => m[1]);
if (skyRows.length !== 24) fail(`skypan_orders 应有 24 行，实得 ${skyRows.length}`);

const ordersBlock = block(configSrc, /orders = (\[\[\[[\s\S]*?\]\]\])\r?\n/, 'orders');
const numLists = [...ordersBlock.matchAll(/\[([\d,]+)\]/g)].map((m) => m[1].split(',').map(Number));
if (numLists.length !== 18) fail(`orders 应有 18 个数字表，实得 ${numLists.length}`);
for (const l of numLists) if (l.length !== 9) fail(`orders 数字表应 9 列，实得 ${l.length}`);

/* ---------- pan_sky_minute 特判列表 ---------- */
const special = [...configSrc.matchAll(
  /if kook1 in "([^"]+)"\.split\(","\):\s*\n\s*return dict\(zip\(eight_gua,list\("([^"]+)"\)\)\)/g,
)].map((m) => ({ list: m[1], row: m[2] }));
if (special.length !== 46) fail(`pan_sky_minute 特判应为 46 条，实得 ${special.length}`);
for (const s of special) if ([...s.row].length !== 9) fail(`特判行应 9 字：${s.row}`);

/* ---------- wuxing_strong_week_minute 的 fs_order（24 行） ---------- */
const keWxSection = configSrc.slice(configSrc.indexOf('def wuxing_strong_week_minute'));
const fsOrderBlock = block(keWxSection, /fs_order = (\[[^\]]*\])\r?\n/, 'wuxing_strong_week_minute.fs_order');
const fsOrderKe = [...fsOrderBlock.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
if (fsOrderKe.length !== 24) fail(`wuxing_strong_week_minute.fs_order 应 24 行，实得 ${fsOrderKe.length}`);
for (const s of fsOrderKe) if ([...s].length !== 5) fail(`fs_order 行应 5 字：${s}`);

/* ---------- zhifu_pai 排盘表 ---------- */
const paiBlock = block(configSrc, /pai = (\{"陽":\{[\s\S]*?\}\})\s*\.get/, 'zhifu_pai.pai');
const zhifuPai = {};
for (const yinYang of ['陽', '陰']) {
  // 阳/阴 两段分开取，避免交叉混入
  const part = yinYang === '陽'
    ? paiBlock.slice(paiBlock.indexOf('"陽":'), paiBlock.indexOf('"陰":'))
    : paiBlock.slice(paiBlock.indexOf('"陰":'));
  const pairs = [...part.matchAll(/"([一二三四五六七八九])"\s*:\s*"([一二三四五六七八九]+)"/g)];
  zhifuPai[yinYang] = Object.fromEntries(pairs.map((p) => [p[1], p[2]]));
  if (Object.keys(zhifuPai[yinYang]).length !== 9) fail(`zhifu_pai.${yinYang} 应 9 行`);
}

/* ---------- angan.py 暗干表 ---------- */
const anganEntries = [...anganSrc.matchAll(/'([^']+)':\s*\[([^\]]+)\]/g)];
if (anganEntries.length !== 360) fail(`ANGAN 应 360 项（6 局 × 60 时干支），实得 ${anganEntries.length}`);
const ANGAN = {};
for (const m of anganEntries) {
  const key = m[1];
  const vals = m[2].split(',').map((s) => s.trim().replace(/^'|"|'|"$/g, ''));
  if (vals.length !== 10) fail(`ANGAN[${key}] 应 10 项，实得 ${vals.length}`);
  if (key in ANGAN) fail(`ANGAN 键重复：${key}`);
  ANGAN[key] = vals;
}

/* ---------- 输出 ---------- */
const ts = [];
ts.push('/**');
ts.push(' * 奇门纯数据（由 scripts/gen-qimen-data.mjs 从 kinqimen Python 源生成，勿手工编辑）。');
ts.push(' * 1:1 保留原顺序与原文字形（含 angan.py 的 己已/辛末/已卯 等原文笔误）。');
ts.push(' */');
ts.push('');
ts.push(`export const KOOK_SETTING: [string, string][] = [${kookSetting.map((k, i) => (i % 2 === 0 ? `[${JSON.stringify(k)}` : `${JSON.stringify(k)}]`)).join(', ')}];`);
ts.push('');
ts.push('export const SKYPAN_ORDERS: { keys: [string, string]; rows: string[][] }[] = [');
for (let i = 0; i < 3; i++) {
  const rows = skyRows.slice(i * 8, i * 8 + 8).map((r) => `      [${[...r].map((c) => JSON.stringify(c)).join(', ')}],`).join('\n');
  ts.push(`  { keys: KOOK_SETTING[${i}], rows: [\n${rows}\n  ]},`);
}
ts.push('];');
ts.push('');
ts.push('export const GET_ZF_ORDERS: { keys: [string, string]; rows: number[][] }[] = [');
for (let i = 0; i < 3; i++) {
  const rows = numLists.slice(i * 6, i * 6 + 6).map((r) => `      [${r.join(', ')}],`).join('\n');
  ts.push(`  { keys: KOOK_SETTING[${i}], rows: [\n${rows}\n  ]},`);
}
ts.push('];');
ts.push('');
ts.push('export const SKY_SPECIAL: { list: string; row: string }[] = [');
for (const s of special) ts.push(`  { list: ${JSON.stringify(s.list)}, row: ${JSON.stringify(s.row)} },`);
ts.push('];');
ts.push('');
ts.push('export const FS_ORDER_KE: string[] = [');
for (const s of fsOrderKe) ts.push(`  ${JSON.stringify(s)},`);
ts.push('];');
ts.push('');
ts.push('export const ZHIFU_PAI: Record<string, Record<string, string>> = {');
for (const yinYang of ['陽', '陰']) {
  ts.push(`  ${JSON.stringify(yinYang)}: { ${Object.entries(zhifuPai[yinYang]).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ')} },`);
}
ts.push('};');
ts.push('');
ts.push('export const ANGAN: Record<string, string[]> = {');
for (const [key, vals] of Object.entries(ANGAN)) {
  ts.push(`  ${JSON.stringify(key)}: [${vals.map((v) => JSON.stringify(v)).join(', ')}],`);
}
ts.push('};');
ts.push('');

writeFileSync(outTs, ts.join('\n'));
console.log(`✓ 已生成 ${outTs}（skypan ${skyRows.length} 行 / orders ${numLists.length} 表 / 特判 ${special.length} 条 / fs_order ${fsOrderKe.length} 行 / zhifu_pai 18 行 / angan ${Object.keys(ANGAN).length} 项）`);
