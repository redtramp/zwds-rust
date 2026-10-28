/**
 * 奇门模块级常量与纯表构建器 —— 1:1 移植 kinqimen/config.py 的常量部分（L13-167、L391-396、L662-725）。
 * 大表（天盘 orders / 特判 / 暗干 / 值符排盘）在 data-generated.ts（机器生成，见 scripts/gen-qimen-data.mjs）。
 * 排盘逻辑在 engine.ts。
 */
import { STEMS, BRANCHES } from './constants';
import { JIAZI, newList, multiKeyDictGet } from './calendar';
import { FS_ORDER_KE } from './data-generated';

/* ---------- 基础常量（config.py L13-34） ---------- */

export const TIAN_GAN = STEMS; // 复用 constants.ts（与 config.tian_gan 同值）
export const DI_ZHI = BRANCHES;
export const CNUMBER = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
export const DOOR_R = ['休', '生', '傷', '杜', '景', '死', '驚', '開'];
export const STAR_R = ['蓬', '任', '沖', '輔', '英', '禽', '柱', '心'];
export const EIGHT_GUA = ['坎', '坤', '震', '巽', '中', '乾', '兌', '艮', '離'];
export const CLOCKWISE_EIGHTGUA = ['坎', '艮', '震', '巽', '離', '坤', '兌', '乾'];
/** 陰遁置閏專用遍历序（config.py 註釋：匹配傳統盤 艮->乾->兌->坤->離->巽->震->坎） */
export const YIN_EIGHTGUA_ORDER = ['艮', '乾', '兌', '坤', '離', '巽', '震', '坎'];
export const GOLEN_D = '太乙攝提軒轅招搖天符青龍咸池太陰天乙'.match(/../g)!;
export const JIEQI_NAME = '春分清明穀雨立夏小滿芒種夏至小暑大暑立秋處暑白露秋分寒露霜降立冬小雪大雪冬至小寒大寒立春雨水驚蟄'.match(/../g)!;
export const JJ: Record<string, string> = {
  '甲子': '戊', '甲戌': '己', '甲申': '庚', '甲午': '辛', '甲辰': '壬', '甲寅': '癸',
};

/** 宫位序 → 卦名（dict(zip(cnumber, eight_gua))，engine 高频使用，预建） */
export const CNUMBER_TO_GUA: Record<string, string> = Object.fromEntries(
  CNUMBER.map((c, i) => [c, EIGHT_GUA[i]]),
);

/* ---------- 五行关系（config.py L25-33、L63-99） ---------- */

const WUXING_RAW = '火水金火木金水土土木,水火火金金木土水木土,火火金金木木土土水水,火木水金木水土火金土,木火金水水木火土土金';
/** config.wuxing_relation_2：五行对 → 尅我/我尅/比和/生我/我生 */
export const WUXING_RELATION_2 = new Map<string, string>();
WUXING_RAW.split(',').forEach((seg, i) => {
  const rel = '尅我,我尅,比和,生我,我生'.split(',')[i];
  for (let j = 0; j + 2 <= seg.length; j += 2) WUXING_RELATION_2.set(seg.slice(j, j + 2), rel);
});

export const DOOR_WUXING = new Map(DOOR_R.map((d, i) => [d, '水土木木火土金金'[i]]));
export const STAR_WUXING = new Map(STAR_R.map((s, i) => [s, '水土木木火土金金'[i]]));

/** ganzhi/卦 → 五行（config.Ganzhiwuxing；Python 元组成员判定：单字命中、双字输入必落空，忠实保留） */
export function ganzhiwuxing(gangorzhi: string): string | undefined {
  if (gangorzhi.length !== 1) return undefined;
  const d: [string, string][] = [
    ['甲寅乙卯震巽', '木'], ['丙巳丁午離', '火'], ['壬亥癸子坎', '水'],
    ['庚申辛酉乾兌', '金'], ['未丑戊己未辰戌艮坤', '土'],
  ];
  for (const [chars, wx] of d) if (chars.includes(gangorzhi)) return wx;
  return undefined;
}

/** find_wx_relation（config.py L97-99）：两字五行关系（单字输入口径） */
export function findWxRelation(zhi1: string, zhi2: string): string | undefined {
  const combine = `${ganzhiwuxing(zhi1) ?? ''}${ganzhiwuxing(zhi2) ?? ''}`;
  return WUXING_RELATION_2.get(combine);
}

/** jieqicode_jq（config.py L69-87）：节气 → 上中下元局码（三字） */
export function jieqicodeJq(jqName: string): string | undefined {
  return multiKeyDictGet(new Map<string, string>([
    ['冬至驚蟄', '一七四'], ['小寒', '二八五'], ['大寒春分', '三九六'], ['立春', '八五二'],
    ['雨水', '九六三'], ['清明立夏', '四一七'], ['穀雨小滿', '五二八'], ['芒種', '六三九'],
    ['夏至白露', '九三六'], ['小暑', '八二五'], ['大暑秋分', '七一四'], ['立秋', '二五八'],
    ['處暑', '一四七'], ['霜降小雪', '五八二'], ['寒露立冬', '六九三'], ['大雪', '四七一'],
  ]), jqName);
}

/** shun（config.py L101-107）：干支 → 旬首（值符天干） */
export function shun(gz: string): string | undefined {
  const d1 = DI_ZHI.indexOf(gz[1]) + 1;
  const d2 = TIAN_GAN.indexOf(gz[0]) + 1;
  let v = d1 - d2;
  if (v < 0) v += 12;
  return ({ 0: '戊', 10: '己', 8: '庚', 6: '辛', 4: '壬', 2: '癸' } as Record<number, string>)[v];
}

/** gendatetime（config.py L59-60） */
export function gendatetime(year: number, month: number, day: number, hour: number): string {
  return `${year}年${month}月${day}日${hour}時`;
}

/* ---------- 旬 / 元 表（config.py L110-126） ---------- */

/** liujiashun_dict（L110-114）：旬内 10 干支 → 旬首（甲X） */
export function liujiashunDict(): Map<string, string> {
  const m = new Map<string, string>();
  for (let i = 0; i < 60; i += 10) {
    m.set(newList(JIAZI, JIAZI[i]).slice(0, 10).join(''), JIAZI[i]);
  }
  return m;
}

/** findyuen_dict（L116-120）：旬内 5 干支 → 上/中/下元 */
export function findyuenDict(): Map<string, string> {
  const labels = ['上', '中', '下', '上', '中', '下', '上', '中', '下', '上', '中', '下'];
  const m = new Map<string, string>();
  let gi = 0;
  for (let i = 0; i < 60; i += 5) {
    m.set(newList(JIAZI, JIAZI[i]).slice(0, 5).join(''), labels[gi++]);
  }
  return m;
}

/** minutes_jiazi_d（L123-126）：时:分 → 干支（120 循环） */
export function minutesJiaziD(): Map<string, string> {
  const seq: string[] = [];
  for (const g of JIAZI) seq.push(g, g); // repeat_list(2, jiazi())
  const m = new Map<string, string>();
  let i = 0;
  for (let h = 0; h < 24; h++) {
    for (let min = 0; min < 60; min++) {
      m.set(`${h}:${min}`, seq[i % seq.length]);
      i++;
    }
  }
  return m;
}

/** 孤虚表（config.py daykong_shikong L131-136 / hourkong_minutekong L149-154 同款） */
export const GUXU: Record<string, { 孤: string; 虛: string }> = {
  '甲子': { 孤: '戌亥', 虛: '辰巳' }, '甲戌': { 孤: '申酉', 虛: '寅卯' },
  '甲申': { 孤: '午未', 虛: '子丑' }, '甲午': { 孤: '辰巳', 虛: '戌亥' },
  '甲辰': { 孤: '寅卯', 虛: '申酉' }, '甲寅': { 孤: '子丑', 虛: '午未' },
};

/** find_shier_luck（L159-167）：天干 → 地支十二长生宫（忠实保留原文「臨冠」笔误） */
export function findShierLuck(gan: string): Record<string, string> | undefined {
  const cs = '長生沐浴冠帶臨冠帝旺'.match(/../g)!; // 5 项
  const starts = ['亥', '寅', '寅', '巳', '申'];
  const nlist = starts.map((b) => newList(DI_ZHI, b));
  const tail = '衰病死墓絕胎養'.split('');
  const cslist2 = nlist.map((y) => Object.fromEntries(y.map((b, i) => [b, cs[i] + tail[i]])));
  const cheungsunlist = ['死', '病', '衰', ...'帝旺臨冠冠帶沐浴長生'.match(/../g)!, '養', '胎', '絕', '墓'];
  const cslist = nlist.map((y) => Object.fromEntries(y.map((b, i) => [b, cheungsunlist[i]])));
  const evens = TIAN_GAN.filter((_, i) => i % 2 === 0);
  const odds = TIAN_GAN.filter((_, i) => i % 2 === 1);
  const d: Record<string, Record<string, string>> = {};
  evens.forEach((g, i) => { d[g] = cslist2[i]; });
  odds.forEach((g, i) => { d[g] = cslist[i]; });
  return d[gan];
}

/* ---------- 金函玉鏡神（config.py getgtw L391-396） ---------- */

/** getgtw：日干 → {地支: 神}（12 神轮转） */
export function getgtw(): Record<string, Record<string, string>> {
  const gtw = '地籥六賊五符天曹地符風伯雷公雨師風雲唐符國印天關'.match(/../g)!;
  const gg = '地籥天關唐符風雲唐符風雲雷公風伯天曹五符'.match(/../g)!;
  const d: Record<string, Record<string, string>> = {};
  TIAN_GAN.forEach((g, i) => {
    const rotated = newList(gtw, gg[i]);
    d[g] = Object.fromEntries(DI_ZHI.map((b, k) => [b, rotated[k]]));
  });
  return d;
}

/* ---------- 五行旺衰（config.py L662-725） ---------- */

const WUXING_SEASON_ORDER = ['木火水金土', '火土木水金', '金水土火木', '水木金土火'];

/** wuxing_strong_week（L711-725）：节气（時家）→ 五行旺相休囚死 */
export function wuxingStrongWeek(jqName: string): Record<string, string> | undefined {
  const season = multiKeyDictGet(new Map<string, string>([
    ['立春雨水驚蟄春分清明穀雨', '春'],
    ['立夏小滿芒種夏至小暑大暑', '夏'],
    ['立秋處暑白露秋分寒露霜降', '秋'],
    ['立冬小雪大雪冬至小寒大寒', '冬'],
  ]), jqName);
  if (!season) return undefined;
  const order = WUXING_SEASON_ORDER[['春', '夏', '秋', '冬'].indexOf(season)];
  return Object.fromEntries(order.split('').map((w, i) => [w, '旺相休囚死'[i]]));
}

/** wuxing_strong_week_minute（L680-708）：节气（刻家）→ 五行旺相休囚死（24 行表） */
export function wuxingStrongWeekMinute(jqName: string): Record<string, string> | undefined {
  const j = newList(JIEQI_NAME, '小寒');
  const map = Object.fromEntries(j.map((n, i) => [
    n, Object.fromEntries(FS_ORDER_KE[i].split('').map((w, k) => [w, '旺相休囚死'[k]])),
  ]));
  return map[jqName];
}

/**
 * gong_wangzhuai（L662-676）：宫旺衰表。
 * 注意：原文查表键硬编码为「霜降」（原函数签名无当前节气参数），忠实保留。
 */
export function gongWangzhuai(): Record<string, string> {
  const wangzhuai = '旺相胎沒死囚休廢'.split('');
  const wangzhuaiNum = [3, 4, 9, 2, 7, 6, 1, 8];
  const wzhuai = multiKeyDictGet(new Map<string, string>([
    ['春分清明穀雨', '春分'], ['立夏小滿芒種', '立夏'], ['夏至小暑大暑', '夏至'],
    ['立秋處暑白露', '立秋'], ['秋分寒露霜降', '秋分'], ['立冬小雪大雪', '立冬'],
    ['冬至小寒大寒', '冬至'], ['立春雨水驚蟄', '立春'],
  ]), '霜降');
  const wz = Object.fromEntries(JIEQI_NAME.filter((_, i) => i % 3 === 0).map((n, i) => [n, wangzhuaiNum[i]]))[wzhuai ?? ''];
  const newDict = newList(wangzhuaiNum, wz);
  return Object.fromEntries(newDict.map((n, i) => [n, wangzhuai[i]]));
}
