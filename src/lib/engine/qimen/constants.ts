/**
 * 奇门干支基础表 —— 与 kinqimen/config.py 的 tian_gan / di_zhi / jiazi 同值。
 * JIAZI 为 60 甲子循环（索引 0=甲子、10=甲戌、20=甲申、30=甲午、40=甲辰、50=甲寅）。
 */

export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

export const JIAZI: string[] = (() => {
  const out: string[] = [];
  for (let i = 0; i < 60; i++) out.push(STEMS[i % 10] + BRANCHES[i % 12]);
  return out;
})();
