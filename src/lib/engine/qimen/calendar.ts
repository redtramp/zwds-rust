/**
 * 奇门历法桥接 —— 1:1 移植 kinqimen/jieqi.py（节气 / 四柱 / 农历月时刻）。
 *
 * 原版用 sxtwl（节气时刻、四柱）+ ephem（仅日期规整）；本项目统一用
 * lunar-javascript 1.7.3（设计决定：历法桥接换用 lunar-javascript）。桥接口径：
 *   · 节气时刻：取前/本/后三个农历年节气表之并集（每表 24 节气，覆盖上一年冬至
 *     至当年大雪；并集保证任意日期可取「上一节气」与「下一节气」），按分钟比较。
 *   · 年柱：按立春**时刻**（分钟级，sxtwl 口径）换年——不可用 Lunar.getYearGan()
 *     （该库按正月初一换年，正月初一至立春之间两口径年干差一位）。
 *   · 日柱：以公历日为单位（sxtwl Day.getDayGZ 口径）；23:xx 属次日日柱（早子时，
 *     与原文 gangzhi 的 h==23 → day+1 特例一致）。
 *   · 时柱：支由钟点定、干用五鼠遁（原文同样以五鼠遁结果 hTG1 为输出）。
 *   · 农历月/时/刻：保留原文五虎遁/五鼠遁/五马遁与刻干支表。
 *
 * lunar-javascript 与 sxtwl 的分钟级差异是已知风险（设计 R1）：由 B4 验证矩阵
 * 钉住（不变量 + 经典钉盘 + 独立 Meeus 节气 oracle + 23:xx 早子时用例）。
 *
 * ⚠️ 与 lunar-solar.ts 一样只放历法换算，不得出现任何排盘逻辑。
 */
import { Solar } from 'lunar-javascript';
import { STEMS, BRANCHES } from './constants';

/* ---------- 基础表（jieqi.py L20-43） ---------- */

/** 二十四节气（sxtwl 索引序，自小寒起；jieqi.py jqmc） */
export const JQMC = [
  '小寒', '大寒', '立春', '雨水', '驚蟄', '春分', '清明', '穀雨',
  '立夏', '小滿', '芒種', '夏至', '小暑', '大暑', '立秋', '處暑',
  '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至',
] as const;

// lunar-javascript 节气表键为简体（并混有少量英文别名键）；统一归一为繁（仅 5 字有差异）
const SQ_TO_TRAD: Record<string, string> = {
  '惊蛰': '驚蟄', '谷雨': '穀雨', '小满': '小滿', '芒种': '芒種', '处暑': '處暑',
};
export function toTradJq(name: string): string {
  return SQ_TO_TRAD[name] ?? name;
}

/** 节气 → 月支（以「節」為準）（jieqi.py JIEQI_TO_YUEZHI） */
export const JIEQI_TO_YUEZHI: Record<string, string> = {
  '立春': '寅', '雨水': '寅', '驚蟄': '卯', '春分': '卯', '清明': '辰', '穀雨': '辰',
  '立夏': '巳', '小滿': '巳', '芒種': '午', '夏至': '午', '小暑': '未', '大暑': '未',
  '立秋': '申', '處暑': '申', '白露': '酉', '秋分': '酉', '寒露': '戌', '霜降': '戌',
  '立冬': '亥', '小雪': '亥', '大雪': '子', '冬至': '子', '小寒': '丑', '大寒': '丑',
};

/** 月支 → 月序（1=寅月）（jieqi.py YUEZHI_TO_NUM） */
export const YUEZHI_TO_NUM: Record<string, number> = {};
for (let i = 0; i < 12; i++) {
  YUEZHI_TO_NUM['寅卯辰巳午未申酉戌亥子丑'[i]] = i + 1;
}

/** 六十甲子（jieqi.py jiazi()） */
export const JIAZI: string[] = [];
for (let i = 0; i < 60; i++) JIAZI.push(STEMS[i % 10] + BRANCHES[i % 12]);

/** 列表轮转：o 提到队首（config/jieqi.py new_list） */
export function newList<T>(olist: readonly T[], o: T): T[] {
  const a = olist.indexOf(o);
  return olist.slice(a).concat(olist.slice(0, a));
}

/** 列表轮转（严格版）：o 不在列表中时抛错（对应 Python list.index 的 ValueError，engine 的 try/except 分支依赖此语义） */
export function newListStrict<T>(olist: readonly T[], o: T): T[] {
  const a = olist.indexOf(o);
  if (a === -1) throw new RangeError(`new_list: 元素不在列表中: ${String(o)}`);
  return olist.slice(a).concat(olist.slice(0, a));
}

/** 列表轮转：o 提到队首、其余逆序（config.py new_list_r；负数取模忠实 Python） */
export function newListR<T>(olist: readonly T[], o: T): T[] {
  const n = olist.length;
  const mod = (x: number) => ((x % n) + n) % n;
  let head = olist.indexOf(o);
  const res: T[] = [];
  for (let i = 0; i < n; i++) {
    res.push(olist[mod(head)]);
    head -= 1;
  }
  return res;
}

/** 每个元素重复 n 次（jieqi.py repeat_list） */
export function repeatList<T>(n: number, thelist: readonly T[]): T[] {
  const out: T[] = [];
  for (const i of thelist) for (let j = 0; j < n; j++) out.push(i);
  return out;
}

/**
 * config.py / jieqi.py multi_key_dict_get 的忠实移植：按插入序遍历、首个命中即返回；
 * Python 的 `k in keys`（元组=成员、字符串=子串）。本库键均为二字（或二字拼接）串，
 * 对二字的 k 子串 ≡ 成员判定，统一以 includes 实现。
 */
export function multiKeyDictGet<K>(m: Map<string, K>, k: string): K | undefined {
  for (const key of m.keys()) {
    if (key.includes(k)) return m.get(key);
  }
  return undefined;
}

/* ---------- 节气时刻（sxtwl → lunar-javascript 桥接） ---------- */

/** 一个节气交节时刻（分钟精度，与原文 round(m) 口径一致） */
export interface JieqiMoment {
  y: number;
  m: number;
  d: number;
  h: number;
  min: number;
  /** 繁体节气名（JQMC 词表） */
  name: string;
}

/** 比较用时间键（毫秒键，分钟粒度） */
function momentKey(t: JieqiMoment): number {
  return Date.UTC(t.y, t.m - 1, t.d, t.h, t.min);
}

/* ---------- 记忆化缓存（lunar-javascript 建对象开销大；天文数据对同日期恒定） ---------- */

/** 公历年 L → 农历 L 年 6/15 的节气表（原始表，含英文别名键） */
const jqTableCache = new Map<number, Record<string, any>>();
/** 公历日期 → 农历日期所属农历年 */
const lunarYearCache = new Map<string, number>();
/** 公历日期 → 排序后的节气并集 */
const momentsCache = new Map<string, JieqiMoment[]>();
/** 公历日期 → Lunar 对象（日柱/农历日用） */
const lunarForCache = new Map<string, any>();

function lunarFor(y: number, m: number, d: number): any {
  const k = `${y}-${m}-${d}`;
  let l = lunarForCache.get(k);
  if (!l) {
    l = Solar.fromYmd(y, m, d).getLunar();
    lunarForCache.set(k, l);
  }
  return l;
}

function jqTableFor(gregYear: number): Record<string, any> {
  let table = jqTableCache.get(gregYear);
  if (!table) {
    // 公历 L 年 6 月 15 日必落在农历 L 年内（农历年跨 1 月~1 月）
    table = Solar.fromYmd(gregYear, 6, 15).getLunar().getJieQiTable();
    jqTableCache.set(gregYear, table);
  }
  return table;
}

/**
 * 该日期附近的节气并集（前/本/后三个农历年）：
 * 每农历年表含 24 节气（跨上一年冬至至当年大雪），并集保证任意日期的
 * 「上一节气」与「下一节气」都取得到。升序返回。
 */
function collectMoments(y: number, m: number, d: number): JieqiMoment[] {
  const ck = `${y}-${m}-${d}`;
  const hit = momentsCache.get(ck);
  if (hit) return hit;
  const ly = lunarYearFor(y, m, d);
  const seen = new Map<number, JieqiMoment>();
  for (const L of [ly - 1, ly, ly + 1]) {
    const table = jqTableFor(L);
    for (const key of Object.keys(table)) {
      if (!/^[\u4e00-\u9fff]{2}$/.test(key)) continue; // 过滤英文别名键（如 DA_XUE）
      const s = table[key];
      const t: JieqiMoment = {
        y: s.getYear(), m: s.getMonth(), d: s.getDay(),
        h: s.getHour(), min: s.getMinute(),
        name: toTradJq(key),
      };
      const k = momentKey(t);
      if (!seen.has(k)) seen.set(k, t);
    }
  }
  const out = [...seen.values()].sort((a, b) => momentKey(a) - momentKey(b));
  momentsCache.set(ck, out);
  return out;
}

/** 公历日期所属农历年（缓存） */
function lunarYearFor(y: number, m: number, d: number): number {
  const k = `${y}-${m}-${d}`;
  const hit = lunarYearCache.get(k);
  if (hit !== undefined) return hit;
  const ly = lunarFor(y, m, d).getYear() as number;
  lunarYearCache.set(k, ly);
  return ly;
}

/**
 * 「当前时间所属」节气的开始时刻（精确到时分）（jieqi.py get_jieqi_start_date）：
 * 当天有节气且当前时刻已达交节 → 该节气；否则最近一个已过去的节气。
 */
export function getJieqiStartDate(year: number, month: number, day: number, hour: number, minute: number): JieqiMoment {
  const now = Date.UTC(year, month - 1, day, hour, minute);
  let best: JieqiMoment | null = null;
  for (const t of collectMoments(year, month, day)) {
    const k = momentKey(t);
    if (k <= now && (!best || momentKey(best) < k)) best = t;
  }
  if (!best) throw new Error(`找不到之前节气：${year}-${month}-${day} ${hour}:${minute}`);
  return best;
}

/** 再前一个节气（jieqi.py get_before_jieqi_start_date；等价于当前节气的上一节气） */
export function getBeforeJieqiStartDate(year: number, month: number, day: number, hour: number, minute: number): JieqiMoment {
  const moments = collectMoments(year, month, day);
  const cur = getJieqiStartDate(year, month, day, hour, minute);
  const idx = moments.findIndex((t) => momentKey(t) === momentKey(cur));
  if (idx <= 0) throw new Error(`找不到再前一个节气：${year}-${month}-${day} ${hour}:${minute}`);
  return moments[idx - 1];
}

/** 下一个节气开始时刻（jieqi.py get_next_jieqi_start_date） */
export function getNextJieqiStartDate(year: number, month: number, day: number, hour: number, minute: number): JieqiMoment {
  const now = Date.UTC(year, month - 1, day, hour, minute);
  for (const t of collectMoments(year, month, day)) {
    if (momentKey(t) > now) return t;
  }
  throw new Error(`找不到下一节气：${year}-${month}-${day} ${hour}:${minute}`);
}

/** 当前节气名（精确到时分）（jieqi.py jq） */
export function jq(year: number, month: number, day: number, hour: number, minute: number): string {
  const now = Date.UTC(year, month - 1, day, hour, minute);
  const t0 = getJieqiStartDate(year, month, day, hour, minute);
  const t1 = getNextJieqiStartDate(year, month, day, hour, minute);
  if (momentKey(t0) <= now && now < momentKey(t1)) return t0.name;
  if (now < momentKey(t0)) return getBeforeJieqiStartDate(year, month, day, hour, minute).name;
  throw new Error(`当前时刻不在任何有效节气区间内：${year}-${month}-${day} ${hour}:${minute}`);
}

/* ---------- 四柱（jieqi.py gangzhi / gangzhi1） ---------- */

/** 年柱：按立春时刻换年（分钟级，sxtwl 口径） */
export function yearGzAt(year: number, month: number, day: number, hour: number, minute: number): string {
  const now = Date.UTC(year, month - 1, day, hour, minute);
  const moments = collectMoments(year, month, day);
  const lichun = moments.find((t) => t.name === '立春' && t.y === year) ?? moments.find((t) => t.name === '立春');
  if (!lichun) throw new Error(`找不到立春时刻：${year}-${month}-${day} ${hour}:${minute}`);
  const gy = momentKey(lichun) <= now ? year : year - 1;
  const i = ((gy - 4) % 60 + 60) % 60;
  return STEMS[i % 10] + BRANCHES[i % 12];
}

/** 日柱：以公历日为单位（sxtwl Day.getDayGZ 口径） */
function dayGzAt(year: number, month: number, day: number): string {
  const l = lunarFor(year, month, day);
  return l.getDayGan() + l.getDayZhi();
}

/** 钟点 → 时辰支序号（子时 23:00-00:59 → 0，丑时 01:00-02:59 → 1，…） */
function hourToBranch(h: number): number {
  return Math.floor(((h + 1) % 24) / 2);
}

/** 五虎遁，起正月（jieqi.py find_lunar_month）：月序 1..12 → 月柱干支 */
export function findLunarMonth(yearGz: string): Map<number, string> {
  const fivetigers = new Map<string, string>([
    ['甲己', '丙寅'], ['乙庚', '戊寅'], ['丙辛', '庚寅'], ['丁壬', '壬寅'], ['戊癸', '甲寅'],
  ]);
  const result = multiKeyDictGet(fivetigers, yearGz[0]) ?? multiKeyDictGet(fivetigers, yearGz[1]) ?? '';
  const rotated = newList(JIAZI, result).slice(0, 12);
  const m = new Map<number, string>();
  for (let i = 1; i <= 12; i++) m.set(i, rotated[i - 1]);
  return m;
}

/** 五鼠遁，起子时（jieqi.py find_lunar_hour）：时辰支 → 时柱干支 */
export function findLunarHour(dayGz: string): Map<string, string> {
  const fiverats = new Map<string, string>([
    ['甲己', '甲子'], ['乙庚', '丙子'], ['丙辛', '戊子'], ['丁壬', '庚子'], ['戊癸', '壬子'],
  ]);
  const result = multiKeyDictGet(fiverats, dayGz[0]) ?? multiKeyDictGet(fiverats, dayGz[1]) ?? '';
  const rotated = newList(JIAZI, result).slice(0, 12);
  return new Map(BRANCHES.map((b, i) => [b, rotated[i]]));
}

/** 五马遁，起子刻（jieqi.py find_lunar_ke）：60 干支刻序 */
export function findLunarKe(hourGz: string): string[] {
  const fivehourses = new Map<string, string>([
    ['丙辛', '甲午'], ['丁壬', '丙午'], ['戊癸', '戊午'], ['甲己', '庚午'], ['乙庚', '壬午'],
  ]);
  const result = multiKeyDictGet(fivehourses, hourGz[0]) ?? multiKeyDictGet(fivehourses, hourGz[1]) ?? '';
  return newList(JIAZI, result);
}

/** 刻干支表："时:刻0"（刻=10 分钟，0..5）→ 干支（jieqi.py ke_jiazi_d，60 干支循环） */
export function keJiaziD(hourGz: string): Map<string, string> {
  const seq = findLunarKe(hourGz);
  const m = new Map<string, string>();
  let i = 0;
  for (let h = 0; h < 24; h++) {
    for (let k = 0; k < 6; k++) {
      m.set(`${h}:${k}0`, seq[i % seq.length]);
      i++;
    }
  }
  return m;
}

const LUNAR_MONTH_NAMES = ['占位', '正月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '冬月', '腊月'];

/** 农历日期（jieqi.py lunar_date_d） */
export function lunarDateD(year: number, month: number, day: number): {
  year: number;
  lunarMonth: string;
  month: number;
  day: number;
} {
  const l = lunarFor(year, month, day);
  const mi = l.getMonth();
  // 忠实原文 Python 列表负索引回绕（闰月）
  const name = LUNAR_MONTH_NAMES[mi >= 0 ? mi : LUNAR_MONTH_NAMES.length + mi];
  return { year: l.getYear(), lunarMonth: name, month: mi, day: l.getDay() };
}

/** 依精确节气计算月柱（jieqi.py _get_month_gz_by_jieqi；交节当天日级误差的核心修正点） */
export function getMonthGzByJieqi(
  year: number, month: number, day: number, hour: number, minute: number, yTG: string,
): string {
  const currentJq = jq(year, month, day, hour, minute);
  const yuezhi = JIEQI_TO_YUEZHI[currentJq];
  const monthNum = YUEZHI_TO_NUM[yuezhi];
  return findLunarMonth(yTG).get(monthNum) ?? '';
}

/** 23 时（早子时）口径：日柱换次日（忠实原文 gangzhi 的 h==23 → day+1） */
function fourPillarBase(year: number, month: number, day: number, hour: number): { Y: number; M: number; D: number; H: number } {
  if (hour === 23) {
    const dt = new Date(Date.UTC(year, month - 1, day + 1));
    return { Y: dt.getUTCFullYear(), M: dt.getUTCMonth() + 1, D: dt.getUTCDate(), H: 0 };
  }
  return { Y: year, M: month, D: day, H: hour };
}

/** 四柱（无刻）（jieqi.py gangzhi1）：[年柱, 月柱, 日柱, 时柱] */
export function gangzhi1(year: number, month: number, day: number, hour: number, minute: number): [string, string, string, string] {
  const b = fourPillarBase(year, month, day, hour);
  const yTG = yearGzAt(b.Y, b.M, b.D, b.H, 0);
  const dTG = dayGzAt(b.Y, b.M, b.D);
  const hTG1 = findLunarHour(dTG).get(BRANCHES[hourToBranch(b.H)]) ?? '';
  const mTG1 = getMonthGzByJieqi(year, month, day, hour, minute, yTG);
  return [yTG, mTG1, dTG, hTG1];
}

/** 五柱含刻（jieqi.py gangzhi）：[年柱, 月柱, 日柱, 时柱, 刻干支] */
export function gangzhi(year: number, month: number, day: number, hour: number, minute: number): [string, string, string, string, string] {
  const b = fourPillarBase(year, month, day, hour);
  const yTG = yearGzAt(b.Y, b.M, b.D, b.H, 0);
  const dTG = dayGzAt(b.Y, b.M, b.D);
  const hTG1 = findLunarHour(dTG).get(BRANCHES[hourToBranch(b.H)]) ?? '';
  const mTG1 = getMonthGzByJieqi(year, month, day, hour, minute, yTG);
  const zi = gangzhi1(year, month, day, 0, 0)[3];
  const reminute = String(Math.floor(minute / 10) * 10).padStart(2, '0');
  const gangzhiMinute = keJiaziD(zi).get(`${hour}:${reminute}`) ?? '';
  return [yTG, mTG1, dTG, hTG1, gangzhiMinute];
}
