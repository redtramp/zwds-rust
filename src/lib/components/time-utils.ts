// 时间视图工具：流年天干索引 + 叠加四化映射（自 TimeNav 抽出供 ChartBoard/TimeNav 共用）
import { SI_HUA_TABLE } from "@/lib/engine/constants";

/** 由年份计算天干索引 (0-9) */
export function getYearStemIndex(year: number): number {
  return (((year - 4) % 10) + 10) % 10;
}

/** 根据天干索引返回四化映射：starName → '禄'/'权'/'科'/'忌' */
export function buildSiHuaOverlay(stemIndex: number): Record<string, string> {
  const stars = SI_HUA_TABLE[stemIndex];
  if (!stars) return {};
  return { [stars[0]]: "禄", [stars[1]]: "权", [stars[2]]: "科", [stars[3]]: "忌" };
}
