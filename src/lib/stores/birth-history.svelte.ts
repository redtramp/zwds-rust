// 出生信息历史：成功起盘后保存表单快照，供下次直接调回（localStorage 持久化）。
// 去重键 = 日期 + 时分 + 性别 + 城市；最多保留 30 条。

import type { BirthFormState } from "@/lib/engine/form-state";

export interface BirthHistoryEntry {
  id: string;
  savedAt: number;
  label: string;
  state: BirthFormState;
}

const KEY = "ziwei-birth-history";
const MAX = 30;

function load(): BirthHistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(list: BirthHistoryEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* 隐私模式等场景忽略 */
  }
}

function labelOf(state: BirthFormState): string {
  const when = `${state.year}年${state.month}月${state.day}日`;
  const place = state.city || state.province || "";
  const unknown = state.unknownTime;
  const time = unknown ? "时辰不详" : `${state.clockHour.padStart(2, "0")}:${state.clockMinute.padStart(2, "0")}`;
  const gender = state.gender === "male" ? "男" : "女";
  return [state.name?.trim() || "未命名", when, time, gender, place].filter(Boolean).join(" · ");
}

function dedupeKey(state: BirthFormState): string {
  return [
    state.year,
    state.month,
    state.day,
    state.unknownTime ? "u" : `${state.clockHour}:${state.clockMinute}`,
    state.gender,
    state.province,
    state.city,
  ].join("|");
}

export const birthHistory = $state<{ list: BirthHistoryEntry[] }>({ list: load() });

export function addBirthHistory(state: BirthFormState): void {
  const key = dedupeKey(state);
  const list = birthHistory.list.filter((h) => dedupeKey(h.state) !== key);
  list.unshift({
    id: crypto.randomUUID(),
    savedAt: Date.now(),
    label: labelOf(state),
    state: $state.snapshot(state) as BirthFormState,
  });
  birthHistory.list = list.slice(0, MAX);
  save(birthHistory.list);
}

export function removeBirthHistory(id: string): void {
  birthHistory.list = birthHistory.list.filter((h) => h.id !== id);
  save(birthHistory.list);
}

export function clearBirthHistory(): void {
  birthHistory.list = [];
  save(birthHistory.list);
}
