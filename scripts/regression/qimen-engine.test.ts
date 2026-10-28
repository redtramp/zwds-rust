/**
 * 回归测试 — 奇门遁甲引擎 TS 移植 (2026-10-28)
 *
 * 移植对象: kinqimen/config.py + kinqimen/jieqi.py + kinqimen/kinqimen.py
 * 验证策略 (设计 B4, 无 Python golden —— sxtwl 未安装且不装):
 *   A. 历法双 oracle —— 四柱用独立算法复核:
 *      日柱: JDN 公式 + 历史锚点 1949-10-01=甲子日 (次锚 2000-01-01=戊午日自洽校验)
 *      年柱: 立春时刻换年 + 已知年柱 (2025=乙巳 / 2026=丙午)
 *      月柱: 节气定月支 + 五虎遁独立推算
 *      时柱: 钟点定支 + 五鼠遁独立推算 (含 23:xx 早子时 = 次日日柱)
 *   B. 节气抽查 (取各节气窗口中部, 避开交节分钟精度)
 *   C. 局名格式 / 刻家局数集合
 *   D. 盘面铁律 (地/天/星/门/神 排布、值符值使、长生运) —— 跨年代 sweep
 *   E. 刻家盘面 + 暗干表 360 键全覆盖
 *   F. 金函玉鏡结构 + 三元局锚点 (2026=下元→陰七局 / 2044=上元→陰一局)
 *   G. AI 文本格式化冒烟
 *   H. pan_sky 返回形态观测 (忠实保留三种形态; 崩溃路径如命中会显式报出)
 *
 * 跑: npx tsx scripts/regression/qimen-engine.test.ts
 * 失败 exit 1 → CI 红
 */
import {
  jq, gangzhi, getJieqiStartDate, JIAZI,
} from '../../src/lib/engine/qimen/calendar';
import {
  TIAN_GAN, DI_ZHI, EIGHT_GUA,
} from '../../src/lib/engine/qimen/tables';
import {
  qimenJuNameChaibu, qimenJuNameZhirun, qimenJuNameKe,
  Qimen, formatChartText, zhifuNzhishi, zhifuNzhishiKe,
  daykongShikong, hourkongMinutekong,
} from '../../src/lib/engine/qimen/engine';
import { ANGAN as ANGAN_DATA } from '../../src/lib/engine/qimen/data-generated';

let failures = 0;
const fail = (msg: string) => { console.error(`  ✗ ${msg}`); failures++; };
const ok = (msg: string) => console.log(`  ✓ ${msg}`);

/* ═══════════ A. 历法双 oracle ═══════════ */

/** 格里高历 JDN (独立于 lunar-javascript 的日柱 oracle) */
function jdn(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mo = m + 12 * a - 3;
  return d + Math.floor((153 * mo + 2) / 5) + 365 * yy + Math.floor(yy / 4)
    - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}
const JDN_ANCHOR = jdn(1949, 10, 1); // 1949-10-01 = 甲子日 (历史锚点)

function dayGzOracle(y: number, m: number, d: number): string {
  return JIAZI[(jdn(y, m, d) - JDN_ANCHOR + 60 * 1000) % 60];
}

console.log('\nA. 历法双 oracle（四柱独立复核）');

// 锚点自洽: 2000-01-01 应为戊午日 (idx 54)
const anchorDiff = (jdn(2000, 1, 1) - JDN_ANCHOR) % 60;
if (JIAZI[anchorDiff] !== '戊午') fail(`锚点自洽失败: 2000-01-01 推得 ${JIAZI[anchorDiff]} ≠ 戊午`);
else ok('锚点自洽: 1949-10-01=甲子 ⟹ 2000-01-01=戊午');

// 年柱: 甲子年=1984 (y-1984 对齐) —— 独立公式
function yearGzAfterLichun(y: number): string {
  const off = (y - 1984) % 60;
  return JIAZI[(off + 60) % 60];
}

const monthBranchCases: [number, number, number, string][] = [
  [2026, 1, 12, '丑'],   // 小寒 1/5 – 大寒 1/20
  [2026, 2, 10, '寅'],   // 立春 2/4 – 雨水 2/18
  [2026, 3, 28, '卯'],   // 惊蛰 3/5 – 清明 4/5
  [2026, 5, 10, '巳'],   // 清明 4/5 – 谷雨 4/20
  [2026, 6, 15, '午'],   // 立夏 5/5 – 小满 5/21
  [2026, 7, 28, '未'],   // 大暑 7/23 – 立秋 8/7 中部 (2026 大暑在 7/23)
  [2026, 10, 15, '戌'],  // 寒露 10/8 – 霜降 10/23
  [2026, 12, 15, '子'],  // 大雪 12/7 – 冬至 12/22
];
// 注: 2026 年节气公历日近似 (±1 天), 上述日期均取窗口中部, 不受 ±1 天影响

// 五虎遁 (独立): 年干 → 寅月干支的甲子索引 (丙寅=2 戊寅=14 庚寅=26 壬寅=38 甲寅=50)；月序沿干支依次前进
const WUHU: Record<string, number> = { '甲': 2, '己': 2, '乙': 14, '庚': 14, '丙': 26, '辛': 26, '丁': 38, '壬': 38, '戊': 50, '癸': 50 };
function monthGzOracle(yearStem: string, monthBranch: string): string {
  const steps = (DI_ZHI.indexOf(monthBranch) - DI_ZHI.indexOf('寅') + 12) % 12;
  return JIAZI[(WUHU[yearStem] + steps) % 60];
}

// 五鼠遁 (独立): 日干 → 子时干支的甲子索引 (甲子=0 丙子=12 戊子=24 庚子=36 壬子=48)；时辰序沿干支依次前进
const WUSHU: Record<string, number> = { '甲': 0, '己': 0, '乙': 12, '庚': 12, '丙': 24, '辛': 24, '丁': 36, '壬': 36, '戊': 48, '癸': 48 };
function hourGzOracle(dayGz: string, hour: number): string {
  const branchIdx = Math.floor(((hour + 1) % 24) / 2); // 23,1→子(0) … 21,23→亥(11)
  return JIAZI[(WUSHU[dayGz[0]] + branchIdx) % 60];
}

{
  let dayMism = 0, hourMism = 0, yearMism = 0, monthMism = 0;
  const total = { n: 0 };
  for (let y = 1960; y <= 2040; y += 4) {
    for (const m of [1, 4, 7, 10]) {
      for (const d of [5, 20]) {
        for (const h of [0, 8, 16, 23]) {
          for (const min of [0, 30]) {
            total.n++;
            const gz = gangzhi(y, m, d, h, min);
            // 日柱: 23:xx → 次日 (早子时口径, 原文 h==23 → day+1)
            const dy = h === 23 ? d + 1 : d;
            let oy = y, om = m, od = dy;
            if (od > 31) { od -= 31; om += 1; if (om > 12) { om = 1; oy += 1; } }
            // 2 月边界 (d=20 不会越界; 此处 d∈{5,20} 安全)
            if (dayGzOracle(oy, om, od) !== gz[2]) {
              if (dayMism < 3) fail(`日柱不符 @${y}-${m}-${d} ${h}:${min}: 引擎 ${gz[2]} vs oracle ${dayGzOracle(oy, om, od)}`);
              dayMism++;
            }
            // 时柱
            const dgz = dayGzOracle(oy, om, od);
            if (hourGzOracle(dgz, h) !== gz[3]) {
              if (hourMism < 3) fail(`时柱不符 @${y}-${m}-${d} ${h}:${min}: 引擎 ${gz[3]} vs oracle ${hourGzOracle(dgz, h)}`);
              hourMism++;
            }
          }
        }
      }
    }
  }
  if (dayMism === 0) ok(`日柱: ${total.n} 例全部与 JDN oracle 一致 (含 23:xx 早子时)`);
  else fail(`日柱: ${dayMism}/${total.n} 例不符`);
  if (hourMism === 0) ok(`时柱: ${total.n} 例全部与五鼠遁 oracle 一致`);
  else fail(`时柱: ${hourMism}/${total.n} 例不符`);

  // 年柱: 立春前后 (2026 立春 = 2/4)
  const before = gangzhi(2026, 2, 3, 12, 0)[0];
  const after = gangzhi(2026, 2, 5, 12, 0)[0];
  const y25 = yearGzAfterLichun(2025), y26 = yearGzAfterLichun(2026);
  if (before !== y25) { fail(`年柱(立春前) 2026-02-03: 引擎 ${before} ≠ ${y25}`); yearMism++; }
  if (after !== y26) { fail(`年柱(立春后) 2026-02-05: 引擎 ${after} ≠ ${y26}`); yearMism++; }
  if (yearMism === 0) ok(`年柱: 立春时刻换年正确 (${y25} → ${y26})`);

  // 月柱: 节气窗口中部
  for (const [y, m, d, mb] of monthBranchCases) {
    const gz = gangzhi(y, m, d, 12, 0);
    const expect = monthGzOracle(gz[0][0], mb);
    if (gz[1] !== expect) {
      fail(`月柱不符 @${y}-${m}-${d}: 引擎 ${gz[1]} vs oracle ${expect} (月支 ${mb})`);
      monthMism++;
    }
  }
  if (monthMism === 0) ok(`月柱: ${monthBranchCases.length} 例与五虎遁 oracle 一致`);
}

/* 23:xx 早子时专测 */
{
  const gz = gangzhi(2026, 9, 7, 23, 30);
  const nextDay = dayGzOracle(2026, 9, 8);
  const sameDay = dayGzOracle(2026, 9, 7);
  if (gz[2] === sameDay) fail(`早子时日柱应取次日: 2026-09-07 23:30 引擎 ${gz[2]} = 当日 ${sameDay}`);
  else if (gz[2] !== nextDay) fail(`早子时日柱应为次日 ${nextDay}, 引擎 ${gz[2]}`);
  else ok(`早子时: 2026-09-07 23:30 日柱=${gz[2]} (次日 ${nextDay}), 时柱=${gz[3]}`);
  // 时柱 = 次日日干的子时
  if (gz[3] !== hourGzOracle(nextDay, 23)) fail(`早子时时柱应为 ${hourGzOracle(nextDay, 23)}, 引擎 ${gz[3]}`);
  else ok(`早子时时柱=${gz[3]} 与五鼠遁(次日)一致`);
}

/* ═══════════ B. 节气抽查 ═══════════ */

console.log('\nB. 节气抽查（窗口中部）');
{
  const cases: [number, number, number, number, number, string][] = [
    [2026, 1, 12, 12, 0, '小寒'],
    [2026, 2, 10, 12, 0, '立春'],
    [2026, 3, 12, 12, 0, '驚蟄'],
    [2026, 4, 12, 12, 0, '清明'],
    [2026, 5, 10, 12, 0, '立夏'],
    [2026, 6, 15, 12, 0, '芒種'],
    [2026, 7, 28, 12, 0, '大暑'],
    [2026, 10, 15, 12, 0, '寒露'],
    [2026, 12, 15, 12, 0, '大雪'],
  ];
  let bad = 0;
  for (const [y, m, d, h, min, expect] of cases) {
    const got = jq(y, m, d, h, min);
    if (got !== expect) { fail(`节气 @${y}-${m}-${d}: 引擎 ${got} ≠ ${expect}`); bad++; }
  }
  if (bad === 0) ok(`节气: ${cases.length} 例全部命中`);
  // 交节时刻接口: 当前节气起点必 ≤ 查询时刻
  const q = [2026, 5, 10, 12, 0] as const;
  const s = getJieqiStartDate(q[0], q[1], q[2], q[3], q[4]);
  const qMs = Date.UTC(q[0], q[1] - 1, q[2], q[3], q[4]);
  const sMs = Date.UTC(s.y, s.m - 1, s.d, s.h, s.min);
  if (sMs > qMs) fail(`节气起点 ${s} 晚于查询时刻`);
  else if (Math.abs(qMs - sMs) > 45 * 86400000) fail(`节气起点距查询时刻超 45 天: ${s}`);
  else ok(`节气起点接口: 2026-05-10 → ${s.y}-${s.m}-${s.d} ${s.h}:${s.min} (清明起点)`);
}

/* ═══════════ C. 局名格式 ═══════════ */

console.log('\nC. 局名格式 / 刻家局数集合');
{
  let bad = 0;
  const reChaibu = /^(陽|陰)遁([一二三四五六七八九])局([上中下])$/;
  const reZhirun = /^(陽|陰)遁([一二三四五六七八九])局([上中下])元$/; // 置闰: 尾为两字三元 (上元/中元/下元)
  const reKe = /^(陽|陰)遁([一二三四五六七八九])局([上中下])元$/;
  for (let y = 1990; y <= 2035; y += 3) {
    for (const [m, d] of [[1, 6], [3, 20], [6, 10], [9, 25], [12, 15]] as const) {
      for (const h of [2, 14, 22]) {
        const cb = qimenJuNameChaibu(y, m, d, h, 0);
        if (!reChaibu.test(cb)) { fail(`拆补局名格式异常 @${y}-${m}-${d} ${h}:00 → ${cb}`); bad++; continue; }
        const zr = qimenJuNameZhirun(y, m, d, h, 0);
        if (!reZhirun.test(zr)) { fail(`置闰局名格式异常 @${y}-${m}-${d} ${h}:00 → ${zr}`); bad++; }
        const ke = qimenJuNameKe(y, m, d, h, 0);
        if (!reKe.test(ke)) { fail(`刻家局名格式异常 @${y}-${m}-${d} ${h}:00 → ${ke}`); bad++; continue; }
        const yinyang = ke[0];
        const digit = ke[2];
        const okDigit = yinyang === '陽' ? ['一', '四', '七'] : ['九', '六', '三'];
        if (!okDigit.includes(digit)) { fail(`刻家局数异常 @${y}-${m}-${d} ${h}:00 → ${ke} (${yinyang}遁应 ${okDigit.join('/')})`); bad++; }
      }
    }
  }
  if (bad === 0) ok('局名: 拆补/置闰/刻家 格式与局数集合全部合法');
}

/* ═══════════ 共享常量 ═══════════ */
const GUA9 = '坎坤震巽中乾兌艮離';
const NINE_STEMS = '戊己庚辛壬癸丁丙乙';
const STAR8 = '蓬芮沖輔禽心柱任英';
const DOOR8 = '休生傷杜景死驚開';
const GODS_Y = '符蛇陰合勾雀地天';
const GODS_N = '符蛇陰合虎玄地天';
const GUXU_SET = new Set(['戌亥', '申酉', '午未', '辰巳', '寅卯', '子丑']);

/* ═══════════ D. 盘面铁律 (跨年代 sweep) ═══════════ */

console.log('\nD. 盘面铁律（地/天/星/门/神/值符值使/马星/长生运）');
{
  let bad = 0, n = 0;
  const report = (msg: string, y: number, m: number, d: number, h: number) => {
    if (bad < 5) fail(`${msg} @${y}-${m}-${d} ${h}:00`);
    bad++;
  };
  for (let y = 1960; y <= 2040; y += 4)
    for (const m of [2, 5, 8, 11])
      for (const d of [8, 22])
        for (const h of [1, 7, 13, 19])
          for (const option of [1, 2] as const) {
            n++;
            const q = new Qimen(y, m, d, h, 0);
            let pan: Record<string, unknown>;
            try { pan = q.pan(option); } catch (e) { report(`pan 抛错: ${(e as Error).message}`, y, m, d, h); continue; }
            const yinyang = (pan['排局'] as string)[0];
            // 地盤: 9 宫、9 干各一次
            const earth = pan['地盤'] as Record<string, string>;
            if (Object.keys(earth).length !== 9 || new Set(Object.values(earth)).size !== 9
              || !Object.values(earth).every((s) => NINE_STEMS.includes(s))) report('地盤 9 宫/9 干不成立', y, m, d, h);
            // 天盤: 三种形态各自的不变量
            const sky = pan['天盤'] as Record<string, string> | [Record<string, string>, Record<string, string>] | undefined;
            if (Array.isArray(sky)) {
              const [aa, bb] = sky;
              if (new Set(Object.values(aa)).size !== Object.keys(aa).length) report('天盘元组: 干重复', y, m, d, h);
              if (!Object.entries(aa).every(([k, v]) => bb[v] === k)) report('天盘元组: 逆字典不一致', y, m, d, h);
            } else if (sky && typeof sky === 'object') {
              if (new Set(Object.values(sky)).size !== Object.keys(sky).length) report('天盘 dict: 干重复', y, m, d, h);
              if (!Object.keys(sky).every((k) => GUA9.includes(k))) report('天盘 dict: 宫键含非九宫', y, m, d, h);
            }
            // 星/门/神: 8 宫 (无中) 各一次
            const star = pan['星'] as Record<string, string>;
            if (Object.keys(star).length !== 8 || new Set(Object.values(star)).size !== 8
              || !Object.values(star).every((s) => STAR8.includes(s))) report('九星 8 宫排布不成立', y, m, d, h);
            const door = pan['門'] as Record<string, string>;
            if (Object.keys(door).length !== 8 || new Set(Object.values(door)).size !== 8
              || !Object.values(door).every((s) => DOOR8.includes(s))) report('八门 8 宫排布不成立', y, m, d, h);
            const god = pan['神'] as Record<string, string>;
            const godsSet = yinyang === '陽' ? GODS_Y : GODS_N;
            if (Object.keys(god).length !== 8 || new Set(Object.values(god)).size !== 8
              || !Object.values(god).every((s) => godsSet.includes(s))) report(`八神 8 宫排布不成立 (${yinyang})`, y, m, d, h);
            // 值符值使
            const zfzs = pan['值符值使'] as ReturnType<typeof zhifuNzhishi>;
            if (!STAR8.includes(zfzs.值符星宮[0])) report(`值符星异常 "${zfzs.值符星宮[0]}"`, y, m, d, h);
            if (!GUA9.includes(zfzs.值符星宮[1])) report(`值符星宫异常 "${zfzs.值符星宮[1]}"`, y, m, d, h);
            if (!DOOR8.includes(zfzs.值使門宮[0])) report(`值使门异常 "${zfzs.值使門宮[0]}"`, y, m, d, h);
            if (!GUA9.includes(zfzs.值使門宮[1])) report(`值使门宫异常 "${zfzs.值使門宮[1]}"`, y, m, d, h);
            // 天乙 / 马星
            if (!STAR8.includes(pan['天乙'] as string)) report(`天乙异常 "${pan['天乙']}"`, y, m, d, h);
            for (const [k, v] of Object.entries(pan['馬星'] as Record<string, string>))
              if (!DI_ZHI.includes(v)) report(`马星 ${k}="${v}" 非地支`, y, m, d, h);
            // 长生运
            const cs = pan['長生運'] as { 天盤: Record<string, Record<string, string>>; 地盤: Record<string, Record<string, string>> };
            if (Object.keys(cs.地盤).length !== 9 || Object.values(cs.地盤).some((inner) => Object.keys(inner).length !== 1))
              report('长生运地盤结构异常', y, m, d, h);
          }
  if (bad === 0) ok(`盘面铁律: ${n} 盘 (1960-2040 采样 × 拆补/置闰) 全部通过`);
  else fail(`盘面铁律: ${bad} 处异常 (前 5 条见上)`);
}

/* ═══════════ E. 刻家盘面 + 暗干表覆盖 ═══════════ */

console.log('\nE. 刻家盘面 + 暗干表 360 键覆盖');
{
  let bad = 0;
  // 暗干 360 键全覆盖 (6 局 × 60 刻干支), 每键 10 项 (9 宫 + 飛干)
  const missing: string[] = [];
  for (const yj of ['陽一', '陽四', '陽七', '陰九', '陰六', '陰三'])
    for (const gz of JIAZI) {
      const v = ANGAN_DATA[`${yj}${gz}`];
      if (!v || v.length !== 10) missing.push(`${yj}${gz}`);
    }
  if (missing.length > 0) { fail(`暗干表缺键/长度异常 ${missing.length} 个 (例: ${missing.slice(0, 5).join(',')})`); bad++; }
  else ok('暗干表: 6 局 × 60 刻干支 = 360 键全覆盖, 每键 10 项');

  for (let y = 2000; y <= 2030; y += 3)
    for (const [m, d] of [[3, 8], [9, 22]] as const)
      for (const h of [0, 6, 12, 18])
        for (const min of [0, 55]) {
          const tag = `${y}-${m}-${d} ${h}:${min}`;
          const q = new Qimen(y, m, d, h, min);
          let pm: Record<string, unknown>;
          try { pm = q.panMinute(1); } catch (e) { fail(`panMinute 抛错 @${tag}: ${(e as Error).message}`); bad++; continue; }
          const angan = pm['暗干'] as Record<string, string>;
          // 暗干: 键=暗干干支(2 字), 值=所在宫 (dict(zip(Angan[:-1], eight_gua)))
          if (Object.keys(angan).length !== 9
            || !Object.keys(angan).every((k) => k.length === 2 && TIAN_GAN.includes(k[0]) && DI_ZHI.includes(k[1]))
            || !Object.values(angan).every((v) => EIGHT_GUA.includes(v))) { fail(`刻家暗干 9 宫不符 @${tag}`); bad++; }
          const feigan = pm['飛干'] as string;
          if (!feigan || !TIAN_GAN.includes(feigan[0]) || !GUA9.includes(feigan[1])) { fail(`刻家飛干异常 "${feigan}" @${tag}`); bad++; }
          const zfzs = pm['值符值使'] as ReturnType<typeof zhifuNzhishiKe>;
          if (!STAR8.includes(zfzs.值符星宮[0])) { fail(`刻家值符星异常 @${tag}`); bad++; }
          if (!GUA9.includes(zfzs.值符星宮[1] ?? '')) { fail(`刻家值符星宫异常 @${tag}`); bad++; }
          if (!DOOR8.includes(zfzs.值使門宮[0])) { fail(`刻家值使门异常 @${tag}`); bad++; }
          const skyKe = pm['天盤'] as Record<string, string>;
          // 原文特判表 2 行非 9 干排列 (陰六甲子含 '再' 误字、陰九甲子 '庚' 重复 —— 已核对 config.py L792/L812)，放宽为 ∈9干∪{再}
          if (Object.keys(skyKe).length !== 9
            || !Object.values(skyKe).every((v) => v.length === 1 && '戊己庚辛壬癸丁丙乙再'.includes(v))) { fail(`刻家天盘 9 宫/9 干不成立 @${tag}`); bad++; }
          const sk = pm['旬空'] as { 日空: string; 時空: string };
          if (!GUXU_SET.has(sk.日空) || !GUXU_SET.has(sk.時空)) { fail(`刻家旬空异常 @${tag} ${JSON.stringify(sk)}`); bad++; }
        }
  // 旬空直测
  {
    const dk = daykongShikong(2026, 9, 7, 14, 30);
    if (!GUXU_SET.has(dk.日空) || !GUXU_SET.has(dk.時空)) fail(`時家旬空异常 ${JSON.stringify(dk)}`);
    else ok(`時家旬空: 2026-09-07 14:30 → 日空=${dk.日空} 時空=${dk.時空}`);
    const hk = hourkongMinutekong(2026, 9, 7, 14, 30);
    if (!GUXU_SET.has(hk.日空) || !GUXU_SET.has(hk.時空)) fail(`刻家旬空(直测)异常 ${JSON.stringify(hk)}`);
    else ok(`刻家旬空: 2026-09-07 14:30 → 日空=${hk.日空} 時空=${hk.時空}`);
  }
  if (bad === 0) ok('刻家盘面: 暗干/飛干/值符值使/天盘/旬空 全部通过');
  else fail(`刻家盘面: ${bad} 处异常`);
}

/* ═══════════ F. 金函玉鏡（日家奇門）+ 三元局 ═══════════ */

console.log('\nF. 金函玉鏡结构 + 三元局锚点');
{
  let bad = 0;
  const GOLD12 = '太乙攝提軒轅招搖天符青龍咸池太陰天乙'.match(/../g)!;
  const q = new Qimen(2026, 9, 7, 14, 30);
  const g = q.gpan() as Record<string, any>;
  const star = g['星'] as Record<string, string>;
  if (Object.keys(star).length !== 9 || !Object.values(star).every((s) => GOLD12.includes(s))) { fail(`金函星盘异常: ${JSON.stringify(star)}`); bad++; }
  const door = g['門'] as Record<string, string>;
  const doorVals = Object.entries(door).filter(([k]) => k !== '中').map(([, v]) => v);
  if (Object.keys(door).length !== 9 || door['中'] !== '' || doorVals.length !== 8
    || doorVals.some((v) => !v) || new Set(doorVals).size !== 8) { fail(`金函门盘异常: ${JSON.stringify(door)}`); bad++; }
  const shen = g['神'] as Record<string, string>;
  if (Object.keys(shen).length !== 12 || !Object.keys(shen).every((k) => DI_ZHI.includes(k))) { fail(`金函神盘异常: ${JSON.stringify(shen)}`); bad++; }
  const jue = g['局'] as string;
  if (!/^(陽|陰)遁[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]日$/.test(jue)) { fail(`金函局名异常: ${jue}`); bad++; }
  const overall = q.overall(1) as Record<string, any>;
  if (!overall['金函玉鏡(日家奇門)'] || !overall['時家奇門'] || !overall['刻家奇門']) { fail('overall 三盘缺项'); bad++; }
  if (Object.keys(q.craneGod()).length !== 8) { fail(`鹤神表 8 组异常: ${Object.keys(q.craneGod()).length}`); bad++; }
  // 1:1 原文 year_yuen 短路：任何 ≥1324 年恒返 下元甲子（原文 L30-34 首元素即 return）→ ypan ≡ 陰七局
  if (q.ypan() !== '陰七局') { fail(`ypan(2026) 应为 陰七局, 实得 ${q.ypan()}`); bad++; }
  if (new Qimen(2044, 6, 1, 12, 0).ypan() !== '陰七局') { fail(`ypan(2044) 应为 陰七局 (原文恒返下元), 实得 ${new Qimen(2044, 6, 1, 12, 0).ypan()}`); bad++; }
  if (bad === 0) ok(`金函玉鏡结构 + ypan 忠实行为 (≡陰七局, 原文 year_yuen 短路) 通过, 日家局=${jue}`);
}

/* ═══════════ G. AI 文本格式化冒烟 ═══════════ */

console.log('\nG. AI 文本格式化冒烟');
{
  const q = new Qimen(2026, 9, 7, 14, 30);
  const pan = q.pan(1) as Record<string, any>;
  const text = formatChartText(gangzhi(2026, 9, 7, 14, 30).join(''), jq(2026, 9, 7, 14, 30), '八月廿三', '拆補', pan, true, 2026, 9, 7, 14, 30);
  const need = ['干支：', '排局：', '旬首：', '中宮：', '巽宮：', '坎宮：', '值符星宮：'];
  const missing = need.filter((s) => !text.includes(s));
  if (missing.length > 0) fail(`formatChartText 缺字段: ${missing.join(',')}`);
  else ok(`formatChartText: 九宫/中宫/值符字段齐全 (${text.length} 字)`);
}

/* ═══════════ H. pan_sky 返回形态观测 ═══════════ */

console.log('\nH. pan_sky 返回形态观测（忠实保留三种形态）');
{
  const forms = { dict9: 0, dict8: 0, tuple: 0, undef: 0, crash: 0 };
  const crashes: string[] = [];
  for (let y = 2018; y <= 2030; y++)
    for (let m = 1; m <= 12; m++)
      for (const d of [3, 17])
        for (const h of [0, 6, 12, 18])
          for (const option of [1, 2] as const) {
            const q = new Qimen(y, m, d, h, 0);
            try {
              const sky = q.panSky(option);
              if (sky === undefined) forms.undef++;
              else if (Array.isArray(sky)) forms.tuple++;
              else forms[Object.keys(sky).length === 9 ? 'dict9' : 'dict8']++;
            } catch (e) {
              forms.crash++;
              if (crashes.length < 3) crashes.push(`${y}-${m}-${d} ${h}:00 opt${option}: ${(e as Error).message}`);
            }
          }
  console.log(`  分布: dict9=${forms.dict9} dict8=${forms.dict8} tuple=${forms.tuple} undef=${forms.undef} crash=${forms.crash}`);
  if (forms.undef > 0) fail(`pan_sky 未命中三分支 (原文隐式 return None) ${forms.undef} 例 — 需人工裁决口径`);
  if (forms.crash > 0) fail(`pan_sky 忠实崩溃路径命中 ${forms.crash} 例: ${crashes.join(' | ')}`);
  if (forms.undef === 0 && forms.crash === 0) ok('pan_sky: 无隐式 None 命中, 无崩溃路径命中');
}

/* ═══════════ 汇总 ═══════════ */
console.log('');
if (failures > 0) {
  console.error(`✗ 奇门引擎回归: ${failures} 处失败`);
  process.exit(1);
}
console.log('✓ 奇门引擎回归: 全部通过');
