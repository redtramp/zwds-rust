/**
 * 奇门排盘引擎 —— 1:1 移植 kinqimen/config.py 排盘核心 + kinqimen.py Qimen 类。
 *
 * 口径说明（移植决议）：
 *   · 局名串布局：拆補/置閏 返回 "陽遁X局Y"（[0]=阴阳、[0:2]="陽遁"/"陰遁"、[2]=局数字、[4]=元）；
 *     刻家返回 "陽遁X局Y元"（[0]=阴阳、[2]=局数字、[4]=元）。
 *   · pan_sky（時家天盘）三种返回形态忠实保留：8 宫 dict / 8 宫 dict（含中）/ (dict, 逆dict) 元组。
 *   · 原文潜在缺陷（pan_sky 禽+中分支的 pan_earth()[0]、zhifu_n_zhishi_ke 刻干支 16 键落空）按原行为保留。
 *   · pan_html/gpan_html 为 Streamlit 渲染层，由 Svelte 盘面组件等价替代，不移植。
 *   · 历法（节气/四柱）见 calendar.ts；纯数据表见 tables.ts 与 data-generated.ts。
 */
import {
  jq, gangzhi, lunarDateD, getJieqiStartDate, JieqiMoment,
  JIAZI, newList, newListStrict, newListR, multiKeyDictGet,
} from './calendar';
import {
  CNUMBER, EIGHT_GUA, CLOCKWISE_EIGHTGUA, YIN_EIGHTGUA_ORDER, JJ, CNUMBER_TO_GUA,
  DOOR_R, TIAN_GAN, DI_ZHI, JIEQI_NAME,
  jieqicodeJq, shun, liujiashunDict, findyuenDict, GUXU, findShierLuck, getgtw,
} from './tables';
import { SKYPAN_ORDERS, GET_ZF_ORDERS, SKY_SPECIAL, ZHIFU_PAI, ANGAN } from './data-generated';

export type QmOption = 1 | 2; // 1=拆補 2=置閏

export interface ZfZs {
  值符天干: [string, string];
  值符星宮: [string, string];
  值使門宮: [string, string];
}

export interface ZfZsKe {
  值符天干: string;
  值符星宮: [string, string | undefined];
  值使門宮: [string, string | undefined];
}

export interface ZhirunRaw {
  日期時間: string;
  農曆: ReturnType<typeof lunarDateD>;
  節氣: string;
  距節氣差日數: number;
  三元: string;
  當前節氣日期: JieqiMoment;
  值符天干: string;
  節氣排局: string;
  陰陽局: string;
  當前排局: string;
  超神接氣正授排局: string;
  其他排局: string;
  其他排局1: string;
}

type YmD = [number, number, number, number, number]; // [year, month, day, hour, minute]

const yangDun12 = newList(JIEQI_NAME, '冬至').slice(0, 12).join('');
const yinDun12 = newList(JIEQI_NAME, '夏至').slice(0, 12).join('');
const YDUN_MAP = new Map<string, string>([[yangDun12, '陽遁'], [yinDun12, '陰遁']]);

const yuenIdx = (code: string, yuen: string): string =>
  ({ 上元: code[0], 中元: code[1], 下元: code[2] } as Record<string, string>)[yuen] ?? '';

/* ---------- config.py：局判定 ---------- */

/** qimen_ju_name_chaibu（L169-181）：拆補局名 "陽遁X局Y"（Y=上/中/下 单字，与置闰法两字三元不同） */
export function qimenJuNameChaibu(year: number, month: number, day: number, hour: number, minute: number): string {
  const jieqi = jq(year, month, day, hour, minute);
  const findYingyang = multiKeyDictGet(YDUN_MAP, jieqi) ?? '';
  const findYuen = findyuen(year, month, day, hour, minute);
  const jieqiCode = jieqicodeJq(jieqi) ?? '';
  // 原文 1:1：{"上":code[0],"中":code[1],"下":code[2]}.get(find_yuen)（单字键）
  const digit = ({ 上: jieqiCode[0], 中: jieqiCode[1], 下: jieqiCode[2] } as Record<string, string>)[findYuen] ?? '';
  return `${findYingyang}${digit}局${findYuen}`;
}

/** findyuen（L89-91）：日柱定上中下元 */
export function findyuen(year: number, month: number, day: number, hour: number, minute: number): string {
  const gz = gangzhi(year, month, day, hour, minute);
  return multiKeyDictGet(findyuenDict(), gz[2]) ?? '';
}

/** findyuen_minute（L93-95）：时柱定上中下元（刻家用） */
export function findyuenMinute(year: number, month: number, day: number, hour: number, minute: number): string {
  const gz = gangzhi(year, month, day, hour, minute);
  return multiKeyDictGet(findyuenDict(), gz[3]) ?? '';
}

/** zhifu_tiangan（L628-632）：时柱旬首 → 值符天干（遁甲） */
export function zhifuTiangan(year: number, month: number, day: number, hour: number, minute: number): string {
  const gz = gangzhi(year, month, day, hour, minute);
  const chour = multiKeyDictGet(liujiashunDict(), gz[3]) ?? '';
  return JJ[chour] ?? '';
}

/** qimen_ju_name_zhirun_raw（L185-237）：置闰法原始量（含距节气差日数精确到时刻） */
export function qimenJuNameZhirunRaw(year: number, month: number, day: number, hour: number, minute: number): ZhirunRaw {
  const Jieqi = jq(year, month, day, hour, minute);
  const newJq = newList(JIEQI_NAME, Jieqi)[1];
  const newJq1 = newList(JIEQI_NAME, Jieqi)[0];
  const newJq2 = newList(JIEQI_NAME, Jieqi)[JIEQI_NAME.length - 1];
  const fuhead = new Map<string, string>();
  for (let i = 0; i < 60; i += 5) fuhead.set(newList(JIAZI, JIAZI[i]).slice(0, 5).join(''), JIAZI[i]);
  const yinYang = multiKeyDictGet(YDUN_MAP, newJq1) ?? '';
  const jieqiCode = jieqicodeJq(Jieqi) ?? '';
  const dgz = gangzhi(year, month, day, hour, minute)[2];
  const fd = multiKeyDictGet(fuhead, dgz) ?? '';
  const zftg = zhifuTiangan(year, month, day, hour, minute);
  const juDayDict = new Map<string, string>([
    ['甲子甲午己卯己酉', '上元'],
    ['甲寅甲申己巳己亥', '中元'],
    ['甲辰甲戌己丑己未', '下元'],
  ]);
  const threeYuen = multiKeyDictGet(juDayDict, fd) ?? '';

  // === 關鍵修正：更精準的距節氣日數（L205-212：同一天已過節氣時刻 → 算 d=1）===
  const jqDisance = getJieqiStartDate(year, month, day, hour, minute);
  const deltaMs = Date.UTC(year, month - 1, day, hour, minute)
    - Date.UTC(jqDisance.y, jqDisance.m - 1, jqDisance.d, jqDisance.h, jqDisance.min);
  const days = Math.floor(deltaMs / 86400000);
  let difference = days;
  if (deltaMs - days * 86400000 > 0) difference += days === 0 ? 1 : 0;

  const kooks = yuenIdx(jieqiCode, threeYuen);
  const jieqiCode1 = jieqicodeJq(newJq) ?? '';
  const jieqiCode2 = jieqicodeJq(newJq1) ?? '';
  const jieqiCode0 = jieqicodeJq(newJq2) ?? '';
  const kooks1 = yuenIdx(jieqiCode1, threeYuen);
  const kooks2 = yuenIdx(jieqiCode2, threeYuen);
  const kooks3 = yuenIdx(jieqiCode0, threeYuen);
  const lr = lunarDateD(year, month, day);
  return {
    日期時間: `${year}年${month}月${day}日${hour}時${minute}分`,
    農曆: lr,
    節氣: Jieqi,
    距節氣差日數: difference,
    三元: threeYuen,
    當前節氣日期: jqDisance,
    值符天干: zftg,
    節氣排局: jieqiCode2,
    陰陽局: yinYang,
    當前排局: `${yinYang}${kooks2}局`,
    超神接氣正授排局: `${multiKeyDictGet(YDUN_MAP, newJq) ?? ''}${kooks1}局`,
    其他排局: `${yinYang}${kooks3}局`,
    其他排局1: `${multiKeyDictGet(YDUN_MAP, newJq) ?? ''}${kooks}局`,
  };
}

/** qimen_ju_name_zhirun（L240-372）：置闰法分支树（1:1，含芒種/大雪置闰窗口与腊月/冬月/正月特判） */
export function qimenJuNameZhirun(year: number, month: number, day: number, hour: number, minute: number): string {
  const qdict = qimenJuNameZhirunRaw(year, month, day, hour, minute);
  const jQ = qdict.節氣;
  const d = qdict.距節氣差日數;
  const tgft = qdict.值符天干;
  const lunarMonth = qdict.農曆.lunarMonth;
  const solarMonth = qdict.農曆.month;
  const lunarDay = qdict.農曆.day;
  const isWuji = ['戊', '己', '庚', '辛', '壬', '癸'].includes(tgft);
  const pick = (k: '當前排局' | '其他排局' | '其他排局1' | '超神接氣正授排局') => `${qdict[k]}${qdict.三元}`;
  if (jQ === '芒種' && d >= 1 && d <= 15) return pick('當前排局');
  if (jQ === '大雪' && d >= 1 && d <= 15) return pick('其他排局1');
  if (d === 0) {
    if (lunarMonth === '腊月' || lunarMonth === '冬月') return pick(lunarMonth === '腊月' ? '其他排局1' : '當前排局');
    return pick(solarMonth > 9 ? '超神接氣正授排局' : '當前排局');
  }
  if (d === 1) return pick('當前排局');
  if (d >= 2 && d <= 6) {
    if (lunarMonth === '腊月' || lunarMonth === '冬月') {
      return pick(lunarMonth === '腊月' ? '其他排局1' : (jQ === '冬至' ? '其他排局' : '當前排局'));
    }
    if (solarMonth >= 9) {
      if (lunarDay < 15) return pick('其他排局1');
      return pick(isWuji ? '當前排局' : '其他排局');
    }
    if (lunarMonth === '正月') {
      if (lunarDay < 10 && !isWuji) return pick('其他排局');
      if (isWuji) {
        if (lunarDay < 20) return pick('其他排局1');
        if (lunarDay > 20 && lunarDay <= 26) return pick('其他排局');
        return pick('其他排局1');
      }
      return pick('超神接氣正授排局');
    }
    if (solarMonth <= 6) {
      if (lunarDay < 15) return pick('超神接氣正授排局');
      return pick('當前排局');
    }
    if (lunarDay < 15) return pick('當前排局');
    return pick('其他排局1');
  }
  if (d >= 7 && d <= 9) {
    if (lunarMonth === '腊月' || lunarMonth === '冬月') {
      return pick(lunarMonth === '腊月' ? '當前排局' : '其他排局1');
    }
    if (lunarMonth === '正月') {
      return pick((solarMonth <= 9 && lunarDay >= 15) || isWuji ? '其他排局1' : '超神接氣正授排局');
    }
    if (solarMonth <= 6) {
      if (lunarDay <= 10) return pick('其他排局1');
      if (isWuji) return pick(lunarDay < 20 ? '超神接氣正授排局' : '其他排局1');
      return pick('當前排局');
    }
    if (solarMonth <= 9) {
      if (lunarDay < 15) return pick('超神接氣正授排局');
      return pick(isWuji || lunarDay >= 20 ? '其他排局1' : '當前排局');
    }
    return pick('超神接氣正授排局');
  }
  if (d >= 10 && d < 15) {
    if (lunarMonth === '腊月' || lunarMonth === '冬月') {
      return pick((lunarMonth === '腊月' || jQ !== '冬至') ? '其他排局1' : (d <= 12 ? '其他排局1' : '當前排局'));
    }
    if (solarMonth > 9) return pick('其他排局1');
    if (lunarMonth === '正月') return pick('當前排局');
    if (lunarMonth !== '正月' && lunarMonth !== '腊月' && lunarMonth !== '冬月') {
      return pick(lunarDay <= 15 ? '當前排局' : '其他排局1');
    }
    return pick('超神接氣正授排局');
  }
  if (d === 15) return pick('超神接氣正授排局');
  if (d < 0) return pick('超神接氣正授排局');
  return pick('當前排局');
}

/** qimen_ju_name_ke（L375-390）：刻家局名 "陽遁X局Y元"（时支定阴阳、时柱定元） */
export function qimenJuNameKe(year: number, month: number, day: number, hour: number, minute: number): string {
  const hgz = gangzhi(year, month, day, hour, minute)[3];
  const findYingyang = multiKeyDictGet(new Map<string, string>([
    ['子丑寅卯辰巳', '陽遁'], ['午未申酉戌亥', '陰遁'],
  ]), hgz[1]) ?? '';
  // Python qu 表：陽遁两组 12 元组同映 "一七四"、陰遁同映 "九三六"（节气必落其中一组）
  const qu = findYingyang === '陽遁' ? '一七四' : '九三六';
  const findYuen = findyuenMinute(year, month, day, hour, minute);
  const digit = ({ 上: 0, 中: 1, 下: 2 } as Record<string, number>)[findYuen];
  return `${findYingyang}${qu[digit]}局${findYuen}元`;
}

/* ---------- 地盤 / 值符 / 值使 / 門星神（config.py L398-660） ---------- */

const EARTH_PALACE: Record<string, string> = {
  陽遁: '戊己庚辛壬癸丁丙乙',
  陰遁: '戊乙丙丁癸壬辛庚己',
};

const JIA_HEADS = JIAZI.filter((_, i) => i % 10 === 0); // 甲子 甲戌 甲申 甲午 甲辰 甲寅

function juNameByOption(y: YmD, option: QmOption): string {
  return option === 1 ? qimenJuNameChaibu(...y) : qimenJuNameZhirun(...y);
}

function earthFromJu(juName: string): Record<string, string> {
  const guaOrder = newList(CNUMBER, juName[2]).map((c) => CNUMBER_TO_GUA[c]);
  const stems = EARTH_PALACE[juName.slice(0, 2)].split('');
  return Object.fromEntries(guaOrder.map((g, i) => [g, stems[i]]));
}

/** pan_earth_minute（L398-408）：刻家地盤 */
export function panEarthMinute(year: number, month: number, day: number, hour: number, minute: number): Record<string, string> {
  return earthFromJu(qimenJuNameKe(year, month, day, hour, minute));
}

/** pan_earth_min_r（L411-415）：刻家地盤（逆，干 → 宫） */
export function panEarthMinR(year: number, month: number, day: number, hour: number, minute: number): Record<string, string> {
  const p = panEarthMinute(year, month, day, hour, minute);
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [v, k]));
}

/**
 * zhifu_pai（L418-444）：旬首 → 值符星序（10 字值 = 起宫 + 九宫序）。
 * zhifu_pai_ke（L446-474）与其表、运算完全相同，别名保留 1:1 调用点。
 */
export function zhifuPai(year: number, month: number, day: number, hour: number, minute: number, option: QmOption): Record<string, string> {
  const qmju = juNameByOption([year, month, day, hour, minute], option);
  const yinyang = qmju[0];
  const kook = qmju[2];
  const pai = ZHIFU_PAI[yinyang][kook];
  const yinList = newListR(CNUMBER, kook).slice(0, 6).map((x) => x + pai);
  const yangList = newList(CNUMBER, kook).slice(0, 6).map((x) => x + pai);
  const list = yinyang === '陰' ? yinList : yangList;
  return Object.fromEntries(JIA_HEADS.map((k, i) => [k, list[i]]));
}
export const zhifuPaiKe = zhifuPai;

/**
 * zhishi_pai（L476-488）：旬首 → 值使宫序（12 字值 = 起宫 + 11 宫序）。
 * zhishi_pai_ke（L490-502）与其运算完全相同，别名保留 1:1 调用点。
 */
export function zhishiPai(year: number, month: number, day: number, hour: number, minute: number, option: QmOption): Record<string, string> {
  const qmju = juNameByOption([year, month, day, hour, minute], option);
  const yinyang = qmju[0];
  const kook = qmju[2];
  const newKook = newList(CNUMBER, kook);
  const newRkook = newListR(CNUMBER, kook);
  const yangList = newKook.join('') + newKook.join('') + newKook.join('');
  const yinList = newRkook.join('') + newRkook.join('') + newRkook.join('');
  const slice11 = (s: string, i: string) => s.slice(s.indexOf(i) + 1, s.indexOf(i) + 12);
  const yinList1 = newRkook.slice(0, 6).map((i) => i + slice11(yinList, i));
  const yangList1 = newKook.slice(0, 6).map((i) => i + slice11(yangList, i));
  const list = yinyang === '陰' ? yinList1 : yangList1;
  return Object.fromEntries(JIA_HEADS.map((k, i) => [k, list[i]]));
}
export const zhishiPaiKe = zhishiPai;

/** pan_door（L504-521）：八門排布（時家；陰遁用置闰序 yin_eightgua_order） */
export function panDoor(year: number, month: number, day: number, hour: number, minute: number, option: QmOption): Record<string, string> {
  const qmju = juNameByOption([year, month, day, hour, minute], option);
  const zfnzs = zhifuNzhishi(year, month, day, hour, minute, option);
  const startingDoor = zfnzs.值使門宮[0];
  const startingGong = zfnzs.值使門宮[1];
  const rotate = qmju[0] === '陰' ? YIN_EIGHTGUA_ORDER : CLOCKWISE_EIGHTGUA;
  const gongReorder = startingGong === '中' ? newList(rotate, '坤') : newList(rotate, startingGong);
  const doorList = qmju[0] === '陽' ? newList(DOOR_R, startingDoor) : newList([...DOOR_R].reverse(), startingDoor);
  return Object.fromEntries(gongReorder.map((g, i) => [g, doorList[i]]));
}

/** pan_door_minute（L523-536）：八門排布（刻家；陰遁用 reversed clockwise） */
export function panDoorMinute(year: number, month: number, day: number, hour: number, minute: number): Record<string, string> {
  const qmke = qimenJuNameKe(year, month, day, hour, minute);
  const zfnzs = zhifuNzhishiKe(year, month, day, hour, minute);
  const startingDoor = zfnzs.值使門宮[0];
  const startingGong = zfnzs.值使門宮[1];
  const rotate = qmke[0] === '陽' ? CLOCKWISE_EIGHTGUA : [...CLOCKWISE_EIGHTGUA].reverse();
  const gongReorder = startingGong === '中' ? newList(rotate, '坤') : newList(rotate, startingGong);
  const doorList = qmke[0] === '陽' ? newList(DOOR_R, startingDoor) : newList([...DOOR_R].reverse(), startingDoor);
  return Object.fromEntries(gongReorder.map((g, i) => [g, doorList[i]]));
}

/** pan_star（L538-556）：九星排布（時家）；返回 [宫→星, 星→宫] */
export function panStar(year: number, month: number, day: number, hour: number, minute: number, option: QmOption): [Record<string, string>, Record<string, string>] {
  const qmju = juNameByOption([year, month, day, hour, minute], option);
  const zfNzs = zhifuNzhishi(year, month, day, hour, minute, option);
  const starR = '蓬任沖輔英禽柱心'.split('');
  const startingStar = zfNzs.值符星宮[0].replace('芮', '禽');
  const startingGong = zfNzs.值符星宮[1];
  const rotate = qmju[0] === '陰' ? YIN_EIGHTGUA_ORDER : CLOCKWISE_EIGHTGUA;
  const starReorder = qmju[0] === '陽' ? newList(starR, startingStar) : newList([...starR].reverse(), startingStar);
  const gongReorder = startingGong === '中' ? newList(rotate, '坤') : newList(rotate, startingGong);
  return [
    Object.fromEntries(gongReorder.map((g, i) => [g, starReorder[i]])),
    Object.fromEntries(starReorder.map((s, i) => [s, gongReorder[i]])),
  ];
}

/** pan_star_minute（L558-573）：九星排布（刻家） */
export function panStarMinute(year: number, month: number, day: number, hour: number, minute: number, _option: QmOption): [Record<string, string>, Record<string, string>] {
  const zfNzs = zhifuNzhishiKe(year, month, day, hour, minute);
  const qmke = qimenJuNameKe(year, month, day, hour, minute);
  const starR = '蓬任沖輔英禽柱心'.split('');
  const startingStar = zfNzs.值符星宮[0].replace('芮', '禽');
  const startingGong = zfNzs.值符星宮[1];
  const rotate = qmke[0] === '陽' ? CLOCKWISE_EIGHTGUA : [...CLOCKWISE_EIGHTGUA].reverse();
  const starReorder = qmke[0] === '陽' ? newList(starR, startingStar) : newList([...starR].reverse(), startingStar);
  const gongReorder = startingGong === '中' ? newList(rotate, '坤') : newList(rotate, startingGong);
  return [
    Object.fromEntries(gongReorder.map((g, i) => [g, starReorder[i]!] as [string, string])),
    Object.fromEntries(starReorder.map((s, i) => [s, gongReorder[i]!] as [string, string])),
  ];
}

/** pan_god（L575-590）：八神排布（時家） */
export function panGod(year: number, month: number, day: number, hour: number, minute: number, option: QmOption): Record<string, string> {
  const qmju = juNameByOption([year, month, day, hour, minute], option);
  const zfzs = zhifuNzhishi(year, month, day, hour, minute, option);
  const startingGong = zfzs.值符星宮[1];
  const rotate = qmju[0] === '陰' ? YIN_EIGHTGUA_ORDER : CLOCKWISE_EIGHTGUA;
  const gongReorder = startingGong === '中' ? newList(rotate, '坤') : newList(rotate, startingGong);
  const gods = qmju[0] === '陽' ? '符蛇陰合勾雀地天'.split('') : '符蛇陰合虎玄地天'.split('');
  return Object.fromEntries(gongReorder.map((g, i) => [g, gods[i]]));
}

/** pan_god_minute（L592-603）：八神排布（刻家） */
export function panGodMinute(year: number, month: number, day: number, hour: number, minute: number): Record<string, string> {
  const zfzs = zhifuNzhishiKe(year, month, day, hour, minute);
  const qmke = qimenJuNameKe(year, month, day, hour, minute);
  const startingGong = zfzs.值符星宮[1];
  const rotate = qmke[0] === '陽' ? CLOCKWISE_EIGHTGUA : [...CLOCKWISE_EIGHTGUA].reverse();
  const gongReorder = startingGong === '中' ? newList(rotate, '坤') : newList(rotate, startingGong);
  const gods = qmke[0] === '陽' ? '符蛇陰合勾雀地天'.split('') : '符蛇陰合虎玄地天'.split('');
  return Object.fromEntries(gongReorder.map((g, i) => [g, gods[i]]));
}

/** zhifu_n_zhishi（L606-626）：找值符星 / 值使門（時家） */
export function zhifuNzhishi(year: number, month: number, day: number, hour: number, minute: number, option: QmOption): ZfZs {
  const gz = gangzhi(year, month, day, hour, minute);
  const hgan = TIAN_GAN.indexOf(gz[3][0]);
  const chour = multiKeyDictGet(liujiashunDict(), gz[3]) ?? '';
  const eg = '休死傷杜中開驚生景'.split('');
  const eightGods = '蓬芮沖輔禽心柱任英'.split('');
  const cnumberToDoor = Object.fromEntries(CNUMBER.map((c, i) => [c, eg[i]]));
  const zspai = zhishiPai(year, month, day, hour, minute, option);
  const zfPai = zhifuPai(year, month, day, hour, minute, option);
  const a = Object.values(zspai).map((v) => cnumberToDoor[v[0]]);
  const b = Object.values(zfPai).map((v) => eightGods[CNUMBER.indexOf(v[0])]!);
  const c = Object.values(zfPai).map((v) => CNUMBER_TO_GUA[v[hgan]]!);
  const d = Object.values(zspai).map((v) => CNUMBER_TO_GUA[v[hgan]]!);
  let door = a[JIA_HEADS.indexOf(chour)];
  if (door === '中') door = '死';
  const i = JIA_HEADS.indexOf(chour);
  return {
    值符天干: [chour, JJ[chour] ?? ''],
    值符星宮: [b[i], c[i]],
    值使門宮: [door, d[i]],
  };
}

/** zhifu_tiangan 已在上方（L628-632 移植） */

/** zhifu_n_zhishi_ke（L634-660）：找值符星 / 值使門（刻家） */
export function zhifuNzhishiKe(year: number, month: number, day: number, hour: number, minute: number): ZfZsKe {
  const gz = gangzhi(year, month, day, hour, minute);
  const qmke = qimenJuNameKe(year, month, day, hour, minute);
  const chour = multiKeyDictGet(liujiashunDict(), gz[4]) ?? '';
  const ep = panEarthMinR(year, month, day, hour, minute);
  const zftg = JJ[chour] ?? '';
  const kook = '陽一陽四陽七陰九陰六陰三'.match(/../g)!;
  const liujia = '甲子甲戌甲申甲午甲辰甲寅'.match(/../g)!;
  const stars = ['蓬芮沖輔禽心', '輔禽心柱任英', '柱任英蓬芮沖', '英任柱心禽輔', '心禽輔沖芮蓬', '沖芮蓬英任柱'].map((s) => s.split(''));
  const doors = ['休坎死坤傷震杜巽死中開乾', '杜巽死中開乾驚兌生艮景離', '驚兌生艮景離休坎死坤傷震',
    '景離生艮驚兌開乾死中杜巽', '開乾死中杜巽傷震死坤休坎', '傷震死坤休坎景離生艮驚兌'].map((s) => s.match(/../g)!);
  const kookKey = qmke[0] + qmke[2];
  const kookIdx = kook.indexOf(kookKey);
  const liujiaIdx = liujia.indexOf(chour);
  const starsZhifu = stars[kookIdx][liujiaIdx];
  const shiDoor = doors[kookIdx][liujiaIdx][0];
  const shiDoorHead = doors[kookIdx][liujiaIdx][1];
  const fifteenKeGz = newList(JIAZI, chour).slice(0, 16);
  const doorOrder = qmke[0] === '陽' ? newList(EIGHT_GUA, shiDoorHead) : newList([...EIGHT_GUA].reverse(), shiDoorHead);
  let fu = ep[gz[4][0]];
  if (fu === undefined) fu = ep[zftg];
  // 16 键循环映射落空 → undefined（忠实原文 dict.get 返回 None 的行为）
  const doorIdx = fifteenKeGz.indexOf(gz[4]);
  return {
    值符天干: zftg,
    值符星宮: [starsZhifu, fu],
    值使門宮: [shiDoor, doorIdx === -1 ? undefined : doorOrder[doorIdx % doorOrder.length]],
  };
}

/**
 * pan_sky_minute（L727-869）：刻家天盘。
 * 46 条 kook1（局+刻干支）特判先行（顺序忠实原文），未命中走 sky_pan_orders 通用表。
 */
export function panSkyMinute(year: number, month: number, day: number, hour: number, minute: number): Record<string, string> {
  const kgz = gangzhi(year, month, day, hour, minute)[4];
  const zfzs = zhifuNzhishiKe(year, month, day, hour, minute);
  const zftg = zfzs.值符天干;
  const zfgong = zfzs.值符星宮[1];
  const ke = qimenJuNameKe(year, month, day, hour, minute);
  const kook = `${ke[0]}${ke[2]}`;
  const kook1 = kook + kgz;
  for (const s of SKY_SPECIAL) {
    if (s.list.split(',').includes(kook1)) {
      return Object.fromEntries(EIGHT_GUA.map((g, i) => [g, s.row[i]]));
    }
  }
  // 通用表：sky_pan_orders[kook][ get_zf_orders[kook][值符天干序][ 值符星宫序 ] ]
  const liujia = '戊己庚辛壬癸'.split('');
  const getZf = GET_ZF_ORDERS.find((e) => e.keys.includes(kook))!.rows;
  const getHumhead = getZf[liujia.indexOf(zftg)];
  const skyOrders = SKYPAN_ORDERS.find((e) => e.keys.includes(kook))!.rows;
  const row = skyOrders[getHumhead[EIGHT_GUA.indexOf(zfgong ?? '')]];
  return Object.fromEntries(EIGHT_GUA.map((g, i) => [g, row[i]]));
}

/* ---------- 孤虚 / 空亡（config.py L130-157） ---------- */

/** daykong_shikong（L130-143）：日空/时空（時家） */
export function daykongShikong(year: number, month: number, day: number, hour: number, minute: number): { 日空: string; 時空: string } {
  const gz = gangzhi(year, month, day, hour, minute);
  const dk = multiKeyDictGet(liujiashunDict(), gz[2]) ?? '';
  const sk = multiKeyDictGet(liujiashunDict(), gz[3]) ?? '';
  return { 日空: GUXU[dk]?.孤 ?? '', 時空: GUXU[sk]?.孤 ?? '' };
}

/** hourkong_minutekong（L145-157）：时空/刻空（刻家） */
export function hourkongMinutekong(year: number, month: number, day: number, hour: number, minute: number): { 日空: string; 時空: string } {
  const gz = gangzhi(year, month, day, hour, minute);
  const g3 = multiKeyDictGet(liujiashunDict(), gz[3]) ?? '';
  const g4 = multiKeyDictGet(liujiashunDict(), gz[4]) ?? '';
  return { 日空: GUXU[g3]?.孤 ?? '', 時空: GUXU[g4]?.孤 ?? '' };
}

/* ---------- kinqimen.py Qimen 类 ---------- */

export class Qimen {
  constructor(
    readonly year: number,
    readonly month: number,
    readonly day: number,
    readonly hour: number,
    readonly minute: number,
  ) {}

  private ym(): YmD {
    return [this.year, this.month, this.day, this.hour, this.minute];
  }

  /** year_yuen（L26-35）：搵上中下元（1324 年起 60 甲子周） */
  yearYuen(): [string, number] | null {
    const yuenList: number[] = [];
    for (let i = 22; i < 100; i++) yuenList.push(i * 60 + 4);
    const threeYuen = ['上元甲子', '中元甲子', '下元甲子'];
    for (let idx = 0; idx < yuenList.length; idx++) {
      if (this.year < yuenList[idx]) break;
      // 1:1 原文：idx=0 时 Python yuen_list[-1] = 5944（JS 负索引在此回绕）
      return [threeYuen[((idx - 1) % 3 + 3) % 3], yuenList[((idx - 1) % yuenList.length + yuenList.length) % yuenList.length]];
    }
    return null;
  }

  /** qimen_ju_day（L37-53）：局日（日干配对） */
  qimenJuDay(): string {
    const juDayDict = new Map<string, string>([
      ['甲己', '甲己日'], ['乙庚', '乙庚日'], ['丙辛', '丙辛日'], ['丁壬', '丁壬日'], ['戊癸', '戊癸日'],
    ]);
    const gz = gangzhi(...this.ym());
    return multiKeyDictGet(juDayDict, gz[2][0]) ?? multiKeyDictGet(juDayDict, gz[2][1]) ?? '';
  }

  /** hourganghzi_zhifu（L55-66）：时干支值符（旬首 + 遁干，如「甲子戊」） */
  hourganghziZhifu(): string {
    const gz = gangzhi(...this.ym());
    const a = JIA_HEADS.map((h) => newList(JIAZI, h).slice(0, 10).join(''));
    const b = [0, 1, 2, 3, 4, 5].map((x) => JIA_HEADS[x] + TIAN_GAN.slice(4, 10)[x]);
    return multiKeyDictGet(new Map(a.map((k, i) => [k, b[i]])), gz[3]) ?? '';
  }

  /** hourganghzi_zhifu_minute（L68-78）：刻家值符（刻干支查旬） */
  hourganghziZhifuMinute(): string {
    const gz = gangzhi(...this.ym());
    const a = JIA_HEADS.map((h) => newList(JIAZI, h).slice(0, 10).join(''));
    const b = [0, 1, 2, 3, 4, 5].map((x) => JIA_HEADS[x] + TIAN_GAN.slice(4, 10)[x]);
    return multiKeyDictGet(new Map(a.map((k, i) => [k, b[i]])), gz[4]) ?? '';
  }

  /** pan_earth（L80-96）：時家地盤（option 1=拆補 2=置閏） */
  panEarth(option: QmOption): Record<string, string> {
    return earthFromJu(juNameByOption(this.ym(), option));
  }

  /** pan_earth_minute（L98-108）：刻家地盤 */
  panEarthMinute(): Record<string, string> {
    return earthFromJu(qimenJuNameKe(...this.ym()));
  }

  /** pan_earth_r（L110-114）：地盤逆（干 → 宫） */
  panEarthR(option: QmOption): Record<string, string> {
    const p = this.panEarth(option);
    return Object.fromEntries(Object.entries(p).map(([k, v]) => [v, k]));
  }

  /** pan_earth_min_r（L116-120）：刻家地盤逆 */
  panEarthMinR(): Record<string, string> {
    const p = this.panEarthMinute();
    return Object.fromEntries(Object.entries(p).map(([k, v]) => [v, k]));
  }

  /**
   * pan_sky（L122-203）：時家天盘。三种返回形态忠实保留：
   * 8 宫 dict（含中）/ (dict, 逆dict) 元组 / 未命中三分支时 undefined（原文隐式 return None）。
   */
  panSky(option: QmOption): Record<string, string> | [Record<string, string>, Record<string, string>] | undefined {
    const ym = this.ym();
    const qmju = juNameByOption(ym, option);
    const rotate = qmju[0] === '陽' ? CLOCKWISE_EIGHTGUA : [...CLOCKWISE_EIGHTGUA].reverse();
    const zfNzs = zhifuNzhishi(...ym, option);
    const fuHead = this.hourganghziZhifu()[2];
    const gz = gangzhi(...ym);
    const earthR = this.panEarthR(option);
    const fuLocation = earthR[gz[3][0]];
    const fuHeadLocation = zfNzs.值符星宮[1];
    const fuHeadLocation2 = earthR[fuHead];
    const ganHead = zfNzs.值符天干[1];
    const zhifu = zfNzs.值符星宮[0];
    const earth = this.panEarth(option);
    let gongReorder = newList(rotate, '坤');
    if (fuHeadLocation === '中') {
      const a = rotate.map((g) => earth[g]);
      try {
        const ganReorder = newListStrict(a, fuHead);
        gongReorder = newList(rotate, fuHeadLocation);
        return Object.fromEntries(gongReorder.map((g, i) => [g, ganReorder[i]]));
      } catch {
        // 原文 except ValueError：gong_reorder 保持 try 前的 new_list(rotate, "坤")
        if (panGod(...ym, option)['坤'] !== '符') {
          const a2 = rotate.map((g) => earth[g]);
          return Object.fromEntries(gongReorder.map((g, i) => [g, newListStrict(a2, earth['坤'])[i]]));
        }
        if (earth['坤'] === ganHead) {
          const a2 = rotate.map((g) => earth[g]);
          const revHead = [...a2].reverse()[0];
          return Object.fromEntries(gongReorder.map((g, i) => [g, newListStrict(a2, revHead)[i]]));
        }
        try {
          return Object.fromEntries(gongReorder.map((g, i) => [g, newListStrict(a, ganHead)[i]]));
        } catch {
          const a2 = rotate.map((g) => earth[g]);
          return Object.fromEntries(gongReorder.map((g, i) => [g, newListStrict(a2, earth['坤'])[i]]));
        }
      }
    }
    if (fuHeadLocation !== '中' && zhifu !== '禽' && fuHeadLocation2 !== '中') {
      const newlist = rotate.map((g) => earth[g]);
      const ganReorder = newListStrict(newlist, fuHead);
      gongReorder = newList(rotate, fuHeadLocation);
      if (!ganReorder.includes(fuHead)) {
        const start = ganReorder[CNUMBER.indexOf(qmju[2])];
        const rganReorder = newListStrict(ganReorder, start);
        // R-DEV: 原文此处置 fu_location=中 时 new_list(8 宫, '中') 抛未捕获 ValueError（原文崩溃）；
        // 移植按本库 中→坤 惯例（pan_door/pan_star/pan_god）回退，回归命中约 1.2% 盘面。
        const rgongReorder = newListStrict(gongReorder, fuLocation === '中' ? '坤' : fuLocation);
        const aa = Object.fromEntries(rgongReorder.map((g, i) => [g, rganReorder[i]]));
        const bb = Object.fromEntries(rganReorder.map((s, i) => [s, rgongReorder[i]]));
        return [aa, bb];
      }
      if (ganReorder.includes(fuHead)) {
        if (fuLocation === undefined) return earth;
        return { ...Object.fromEntries(gongReorder.map((g, i) => [g, ganReorder[i]])), 中: earth['中'] };
      }
    }
    if (fuHeadLocation !== '中' && zhifu === '禽' && fuHeadLocation2 === '中') {
      const gg = rotate.map((g) => earth[g]);
      const ganReorder = newListStrict(gg, earth['坤']);
      gongReorder = newList(rotate, fuHeadLocation);
      if (!ganReorder.includes(fuHead)) {
        // R-DEV: 同上 —— 中→坤 回退（原文此处未捕获 ValueError）
        const rgongReorder = newListStrict(gongReorder, fuLocation === '中' ? '坤' : fuLocation);
        return Object.fromEntries(rgongReorder.map((g, i) => [g, ganReorder[i]]));
      }
      // 原文潜在缺陷：self.pan_earth(option)[0].get("中")（dict[0] → KeyError）；
      // 此处忠实保留同类崩溃（undefined 上取「中」→ TypeError）。
      const zero: unknown = (earth as unknown as Record<number, Record<string, string>>)[0];
      return {
        ...Object.fromEntries(gongReorder.map((g, i) => [g, ganReorder[i]])),
        中: (zero as Record<string, string>)['中'],
      };
    }
    return undefined;
  }

  /** gong_chengsun（L206-225）：九宮長生十二神（dict / 元组两条路径忠实保留） */
  gongChengsun(option: QmOption): { 天盤: Record<string, Record<string, string>>; 地盤: Record<string, Record<string, string>> } {
    const sky = this.panSky(option);
    const gz = gangzhi(...this.ym());
    const findTwelveLuck = findShierLuck(gz[2][0]) ?? {};
    const diZhiMapping: Record<string, string> = Object.fromEntries(DI_ZHI.map((b, i) => [b, '癸己甲乙戊丙丁己庚辛戊壬'[i]]));
    const findTwelveLuckNew: Record<string, string> = {};
    for (const [k, v] of Object.entries(findTwelveLuck)) findTwelveLuckNew[diZhiMapping[k] ?? k] = v;
    let skyPanNew: Record<string, Record<string, string>>;
    if (Array.isArray(sky)) {
      // 正常路径：sky[0] → {k: {v: luck(k)}}
      const sp = sky[0];
      skyPanNew = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, { [v]: findTwelveLuckNew[k] ?? '' }]));
    } else if (sky === undefined) {
      // 原文 sky 为 None 时 sky[0] → TypeError（未捕获），忠实保留
      throw new TypeError('pan_sky 返回空（原文 None[0] TypeError 等价）');
    } else {
      // KeyError 路径：sky 为 dict → {k: {v: luck(v)}}
      skyPanNew = Object.fromEntries(Object.entries(sky).map(([k, v]) => [k, { [v]: findTwelveLuckNew[v] ?? '' }]));
    }
    const earthPan = this.panEarth(option);
    const earthPanNew = Object.fromEntries(Object.entries(earthPan).map(([k, v]) => [k, { [v]: findTwelveLuckNew[v] ?? '' }]));
    return { 天盤: skyPanNew, 地盤: earthPanNew };
  }

  /** gong_chengsun_minute（L227-252）：刻家長生（宫 → {地支: 长生阶段}） */
  gongChengsunMinute(_option: QmOption): Record<string, Record<string, string>> {
    const sky = { ...panSkyMinute(...this.ym()) };
    delete sky['中'];
    const gongMapping: Record<string, string | string[]> = {
      坎: '子', 艮: ['丑', '寅'], 震: '卯', 巽: ['辰', '巳'],
      離: '午', 坤: ['未', '申'], 兌: '酉', 乾: ['戌', '亥'],
    };
    // 原文 v[1] = find_shier_luck(z)：z 为地支/元组、永非天干 → 恒 None → b[k] = find_shier_luck(天盘干)
    const b: Record<string, Record<string, string> | undefined> = {};
    for (const [k, gan] of Object.entries(sky)) {
      const z = gongMapping[k];
      const luckZ = Array.isArray(z) ? undefined : findShierLuck(z);
      if (luckZ === undefined) b[k] = findShierLuck(gan);
    }
    const d: Record<string, Record<string, string>> = {};
    for (const [key, value] of Object.entries(gongMapping)) {
      if (Array.isArray(value)) {
        d[key] = Object.fromEntries(value.map((v) => [v, b[key]?.[v] ?? '']));
      } else {
        d[key] = { [value]: b[key]?.[value] ?? '' };
      }
    }
    return d;
  }

  /** pan（L254-324）：時家奇門盤面总装 */
  pan(option: QmOption): Record<string, unknown> {
    const ym = this.ym();
    const gz = gangzhi(...ym);
    const gzd = `${gz[0]}年${gz[1]}月${gz[2]}日${gz[3]}時`;
    const qmju = juNameByOption(ym, option);
    const shunhead = shun(gz[2]) ?? '';
    const shunkong = daykongShikong(...ym);
    const paiju = qmju;
    const jQ = jq(...ym);
    const zfzs = zhifuNzhishi(...ym, option);
    const star = panStar(...ym, option)[0];
    const door = panDoor(...ym, option);
    const god = panGod(...ym, option);
    return {
      排盤方式: { 1: '拆補', 2: '置閏' }[option],
      干支: gzd,
      旬首: shunhead,
      旬空: shunkong,
      局日: this.qimenJuDay(),
      排局: paiju,
      節氣: jQ,
      值符值使: zfzs,
      天乙: this.tianyi(option),
      天盤: this.panSky(option),
      地盤: this.panEarth(option),
      門: door,
      星: star,
      神: god,
      馬星: { 天馬: this.moonhorse(), 丁馬: this.dinhorse(), 驛馬: this.hourhorse() },
      長生運: this.gongChengsun(option),
    };
  }

  /** pan_minute（L326-406）：刻家奇門盤面总装 */
  panMinute(option: QmOption): Record<string, unknown> {
    const ym = this.ym();
    const gz = gangzhi(...ym);
    const gzd = `${gz[0]}年${gz[1]}月${gz[2]}日${gz[3]}時${gz[4]}分`;
    const qmju = qimenJuNameKe(...ym);
    const shunhead = shun(gz[3]) ?? '';
    const shunkong = hourkongMinutekong(...ym);
    const paiju = qmju;
    const jQ = jq(...ym);
    const zfzs = zhifuNzhishiKe(...ym);
    const star = panStarMinute(...ym, option)[0];
    const door = panDoorMinute(...ym);
    const god = panGodMinute(...ym);
    // 暗干表键 = 阴阳 + 局数字 + 刻干支（360 键全覆盖）
    const anganKey = `${paiju[0]}${paiju[2]}${gz[4]}`;
    const angan = ANGAN[anganKey] ?? [];
    return {
      排盤方式: { 1: '拆補', 2: '置閏' }[option],
      干支: gzd,
      旬首: shunhead,
      旬空: shunkong,
      局日: this.qimenJuDay(),
      排局: paiju,
      節氣: jQ,
      值符值使: zfzs,
      天乙: this.tianyi(option),
      天盤: panSkyMinute(...ym),
      地盤: panEarthMinute(...ym),
      門: door,
      星: star,
      神: god,
      馬星: { 天馬: this.moonhorse(), 丁馬: this.dinhorse(), 驛馬: this.hourhorse() },
      暗干: Object.fromEntries(angan.slice(0, -1).map((g, i) => [g, EIGHT_GUA[i]])),
      飛干: angan[angan.length - 1],
    };
  }

  /** tianyi（L529-541）：天乙贵人（值符星落宫） */
  tianyi(option: QmOption): string {
    const zfNzs = zhifuNzhishi(...this.ym(), option);
    const zhifuDict: Record<string, string> = Object.fromEntries(EIGHT_GUA.map((g, i) => [g, '蓬芮沖輔禽心柱任英'[i]]));
    return zhifuDict[zfNzs.值符星宮[1]] ?? '禽';
  }

  /** dinhorse（L543-552）：丁馬（日柱旬首） */
  dinhorse(): string {
    const gz = gangzhi(...this.ym());
    const tg = ['甲子', '甲戌', '甲申', '甲午', '甲辰', '甲寅'];
    const newDict = new Map(tg.map((k, i) => [k, '卯丑亥酉未巳'[i]]));
    const xunHead = multiKeyDictGet(liujiashunDict(), gz[2]) ?? '';
    return newDict.get(xunHead) ?? '';
  }

  /** moonhorse（L554-563）：天馬（日支） */
  moonhorse(): string {
    const gz = gangzhi(...this.ym());
    return multiKeyDictGet(new Map<string, string>([
      ['寅申', '午'], ['卯酉', '申'], ['辰戌', '戌'], ['巳亥', '子'], ['午子', '寅'], ['丑未', '辰'],
    ]), gz[2][1]) ?? '';
  }

  /** hourhorse（L565-574）：驛馬（时支） */
  hourhorse(): string {
    const gz = gangzhi(...this.ym());
    return multiKeyDictGet(new Map<string, string>([
      ['申子辰', '寅'], ['寅午戌', '申'], ['亥卯未', '巳'], ['巳酉丑', '亥'],
    ]), gz[3][1]) ?? '';
  }

  /** green_dragon（L576-618）：青龍返首格 */
  greenDragon(option: QmOption): Record<string, string> {
    const ym = this.ym();
    const hg = gangzhi(...ym)[3][0];
    const sky = this.panSky(option);
    if (sky === undefined || Array.isArray(sky)) {
      // 原文 sky 为元组/None 时 bidict(sky) 抛 TypeError（未捕获）；
      // 忠实口径：元组按第一字典处理，None 抛错。
      if (sky === undefined) throw new TypeError('pan_sky 返回空（原文 None 上 bidict TypeError 等价）');
      return this.greenDragonDict(sky[0], this.panEarth(option), zhifuNzhishi(...ym, option), hg);
    }
    return this.greenDragonDict(sky, this.panEarth(option), zhifuNzhishi(...ym, option), hg);
  }

  private greenDragonDict(sky: Record<string, string>, earth: Record<string, string>, zfNzs: ZfZs, hg: string): Record<string, string> {
    const zhishi = zfNzs.值符天干[1];
    const zfGong = zfNzs.值符星宮[1];
    const gongOf = (p: Record<string, string>, stem: string) => Object.keys(p).find((k) => p[k] === stem);
    const zhishiGong = gongOf(earth, zhishi) ?? '';
    const skyGong = gongOf(sky, '戊');
    const earthGong = gongOf(earth, '丙');
    if (skyGong === undefined || earthGong === undefined) {
      // KeyError 路径
      if (hg === '戊' || hg === '丙') {
        if (zhishiGong === '中') return { 青龍返首: zfGong };
        if (zfGong === '中') return { 青龍返首: gongOf(sky, earth['坤']) ?? '' };
      }
      return { 青龍返首: '沒有' };
    }
    if (earthGong === skyGong) return { 青龍返首: skyGong };
    if (zhishiGong === earthGong) return { 青龍返首: earthGong };
    if (skyGong === '中') return { 青龍返首: earthGong };
    return { 青龍返首: '沒有' };
  }

  /** fly_bird（L620-658）：飛鳥跌穴格 */
  flyBird(option: QmOption): Record<string, string> {
    const ym = this.ym();
    const sky = this.panSky(option);
    if (sky === undefined) throw new TypeError('pan_sky 返回空（原文 None 上 bidict TypeError 等价）');
    const skyDict = Array.isArray(sky) ? sky[0] : sky;
    const earth = this.panEarth(option);
    const zfNzs = zhifuNzhishi(...ym, option);
    const zhishi = zfNzs.值符天干[1];
    const zfGong = zfNzs.值符星宮[1];
    const gongOf = (p: Record<string, string>, stem: string) => Object.keys(p).find((k) => p[k] === stem);
    // 原文 zhishi_gong 在 try 内第一行恒成功（地盤 9 干齐全），except 分支仅可能由 戊/丙 落空触发
    const zhishiGong = gongOf(earth, zhishi) ?? '';
    const earthGong = gongOf(earth, '戊');
    const skyGong = gongOf(skyDict, '丙');
    if (earthGong === undefined || skyGong === undefined) {
      return { 飛鳥跌穴: zhishiGong === '中' ? zfGong : '沒有' };
    }
    if (earthGong === skyGong) return { 飛鳥跌穴: skyGong };
    if (skyGong === zhishiGong) return { 飛鳥跌穴: skyGong };
    return { 飛鳥跌穴: '沒有' };
  }

  /** jade_girl（L659-676）：玉女守門格 */
  jadeGirl(option: QmOption): Record<string, string> {
    const earth = this.panEarth(option);
    const earthGong = Object.keys(earth).find((k) => earth[k] === '丁');
    if (earthGong === undefined) return { 玉女守門: '沒有' };
    const zhishi = zhifuNzhishi(...this.ym(), option).值使門宮[1];
    return zhishi === earthGong ? { 玉女守門: zhishi } : { 玉女守門: '沒有' };
  }

  /** ypan（L459-463）：三元局（金函玉鏡辅助） */
  ypan(): string | undefined {
    const kok: Record<string, string> = { '上元甲子': '陰一局', '中元甲子': '陰四局', '下元甲子': '陰七局' };
    const yy = this.yearYuen();
    return yy ? kok[yy[0]] : undefined;
  }

  /** gpan（L465-502）：金函玉鏡（日家奇門）盤面 */
  gpan(): Record<string, unknown> {
    const ym = this.ym();
    const jQ = jq(...ym);
    const dgz = gangzhi(...ym)[2];
    const dh = multiKeyDictGet(new Map<string, string>([
      [newList(JIEQI_NAME, '冬至').slice(0, 12).join(''), '冬至'],
      [newList(JIEQI_NAME, '夏至').slice(0, 12).join(''), '夏至'],
    ]), jQ) ?? '';
    const yy = ({ 冬至: '陽遁', 夏至: '陰遁' } as Record<string, string>)[dh];
    // ty_doors：60 甲子 zip cycle(9 門)
    const doorCycle = dh === '冬至' ? '艮離坎坤震巽中乾兌'.split('') : '坤坎離艮兌乾中巽震'.split('');
    const gong = doorCycle[JIAZI.indexOf(dgz) % 9];
    const eightGua = '坎坤震巽中乾兌艮離'.split('');
    const rotateOrder = yy === '陽遁' ? eightGua : [...eightGua].reverse();
    const aGong = newList(rotateOrder, gong);
    const goldG = '太乙攝提軒轅招搖天符青龍咸池太陰天乙'.match(/../g)!;
    const starPai = Object.fromEntries(aGong.map((g, i) => [g, goldG[i]]));
    // rest_doors_setting：甲子 3 个一组 × 20，cycle(eg) 逐组赋值
    const egBase = yy === '陽遁' ? '坎坤震巽中乾兌艮離'.split('') : [...'坎坤震巽中乾兌艮離'.split('')].reverse();
    const restMap = new Map<string, string>();
    let di = 0;
    for (let i = 0; i < 20; i++) {
      restMap.set(JIAZI.slice(i * 3, i * 3 + 3).join(''), egBase[di++ % egBase.length]);
    }
    const rest = multiKeyDictGet(restMap, dgz) ?? '';
    const clockwise = '坎艮震巽離坤兌乾'.split('');
    const doorR = '休生傷杜景死驚開'.split('');
    const theDoors = yy === '陽遁'
      ? Object.fromEntries(newList(clockwise, rest).map((g, i) => [g, doorR[i]]))
      : Object.fromEntries(newList([...clockwise].reverse(), rest).map((g, i) => [g, doorR[i]]));
    return {
      局: `${yy}${dgz}日`,
      鶴神: this.craneGod()[dgz] ?? '',
      星: starPai,
      門: { ...theDoors, 中: '' },
      神: getgtw()[dgz[0]] ?? {},
    };
  }

  /** crane_god（L504-508）：鶴神表（庚申起 8 组；原文 zip 截断为 8） */
  craneGod(): Record<string, string[]> {
    const d = '巽離坤兌乾坎天艮震'.split('');
    const dd = [6, 5, 6, 5, 6, 5, 16, 6, 5];
    const newcList: string[][] = [];
    for (let i = 0; i < 8; i++) newcList.push(Array(dd[i]).fill(d[i]));
    const rotated = newList(JIAZI, '庚申');
    return Object.fromEntries(rotated.slice(0, 8).map((k, i) => [k, newcList[i]]));
  }

  /** overall（L679-683）：三盘总装（金函玉鏡日家 + 時家 + 刻家） */
  overall(option: QmOption): Record<string, unknown> {
    return {
      '金函玉鏡(日家奇門)': this.gpan(),
      時家奇門: this.pan(option),
      刻家奇門: this.panMinute(option),
    };
  }
}

/**
 * format_qimen_results_for_prompt（kinqimen/app.py L179-212 移植）：
 * 盘面 → AI 解读用结构化文本（五神/九宫逐宫/中宫）。
 */
export function formatChartText(
  _gzStr: string,
  _jqStr: string,
  _lunarInfo: string,
  _paipanInfo: string,
  q: Record<string, any>,
  isShijia: boolean,
  y: number, m: number, d: number, h: number, minute: number,
): string {
  const egKeys = '巽離坤震兌艮坎乾'.split('');
  const lines: string[] = [
    '以下是奇門遁甲排盤的計算結果，請根據這些數據提供詳細的分析和解釋：',
    `${y}年${m}月${d}日 ${h}時${minute}分`,
    `起盤方式：${isShijia ? '時家奇門' : '刻家奇門'} | 排盤方式：${_paipanInfo}`,
    `干支：${q['干支'] ?? ''}`,
    `排局：${q['排局'] ?? ''}`,
    `節氣：${_jqStr}`,
    `農曆：${_lunarInfo}`,
  ];
  const zfzs = (q['值符值使'] ?? {}) as Partial<ZfZs>;
  const zf = zfzs.值符星宮 ?? ['', ''];
  const zs = zfzs.值使門宮 ?? ['', ''];
  if (zf.length > 1) lines.push(`值符星宮：天${zf[1]}宮`);
  if (zs.length > 1) lines.push(`值使門宮：${zs[0]}門${zs[1]}宮`);
  lines.push(`\n旬首：${q['旬首'] ?? ''}`);
  lines.push('\n【九宮盤局】');
  for (const gua of egKeys) {
    lines.push(`  ${gua}宮：地盤=${q['地盤']?.[gua] ?? ''}，天盤=${q['天盤']?.[gua] ?? ''}，九星=${q['星']?.[gua] ?? ''}，八門=${q['門']?.[gua] ?? ''}，八神=${q['神']?.[gua] ?? ''}`);
  }
  lines.push(`  中宮：地盤=${q['地盤']?.['中'] ?? ''}`);
  return lines.join('\n\n');
}

/**
 * formatJinyinChartText：金函玉镜（日家）盘面 → AI 文本（项目扩展，R14：T1 反转后日家/整体也提供解读）。
 * 结构跟 gpan() 输出：局 / 鹤神 / 九宫星门 / 十二神（地支键）。
 */
export function formatJinyinChartText(
  q: Record<string, any>,
  y: number, m: number, d: number, h: number, minute: number,
): string {
  const egKeys = '巽離坤震兌艮坎乾'.split('');
  const bz = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const lines: string[] = [
    '以下是金函玉鏡（日家奇門）排盤的計算結果，請根據這些數據提供詳細的分析和解釋：',
    `${y}年${m}月${d}日 ${h}時${minute}分`,
    `局：${q['局'] ?? ''}`,
    `鶴神：${(q['鶴神'] ?? []).join('')}`,
    '\n【九宮盤局】',
  ];
  for (const gua of egKeys) {
    lines.push(`  ${gua}宮：九星=${q['星']?.[gua] ?? ''}，八門=${q['門']?.[gua] ?? ''}`);
  }
  lines.push('\n【十二神】');
  lines.push(bz.map((b) => `${b}=${(q['神'] ?? {})[b] ?? ''}`).join('，'));
  return lines.join('\n');
}
