// 主题状态（dark/light）：localStorage 持久化 + html[data-theme] 驱动 CSS 令牌。
// key 与原版一致（ziwei-theme），避免老用户主题丢失。

export type ThemeMode = "dark" | "light";

function initial(): ThemeMode {
  try {
    return localStorage.getItem("ziwei-theme") === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export const theme = $state<{ mode: ThemeMode }>({ mode: initial() });

export function applyTheme(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode;
}

export function setTheme(mode: ThemeMode) {
  theme.mode = mode;
  try {
    localStorage.setItem("ziwei-theme", mode);
  } catch {
    /* 私密模式等场景忽略 */
  }
  applyTheme(mode);
}

export function toggleTheme() {
  setTheme(theme.mode === "dark" ? "light" : "dark");
}
