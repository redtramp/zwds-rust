// 全局外观设置：字体族 + 字号缩放。localStorage 持久化，改完即时生效。
// 字号用 html.zoom 实现（缩放整个 UI，与组件内 px 字号解耦）；字体族覆盖 --font 令牌。

export interface FontOption {
  label: string;
  /** CSS font-family 栈；空串 = 使用 app.css 默认 */
  value: string;
}

export const FONT_OPTIONS: FontOption[] = [
  { label: "系统默认", value: "" },
  {
    label: "思源黑体",
    value: '"Noto Sans CJK SC", "Noto Sans SC", "WenQuanYi Micro Hei", sans-serif',
  },
  {
    label: "思源宋体（衬线）",
    value: '"Noto Serif CJK SC", "Songti SC", "SimSun", serif',
  },
  {
    label: "等宽字体",
    value: '"Noto Sans Mono", "SF Mono", "Consolas", monospace',
  },
];

export interface Appearance {
  /** 字体族（FONT_OPTIONS.value），空串 = 默认 */
  fontFamily: string;
  /** 整体缩放 0.85–1.40，1 = 默认 */
  zoom: number;
}

const KEY = "ziwei-appearance";
const MIN = 0.85;
const MAX = 1.4;

function load(): Appearance {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { fontFamily: "", zoom: 1 };
    const p = JSON.parse(raw);
    return {
      fontFamily: typeof p?.fontFamily === "string" ? p.fontFamily : "",
      zoom: Math.min(MAX, Math.max(MIN, Number(p?.zoom) || 1)),
    };
  } catch {
    return { fontFamily: "", zoom: 1 };
  }
}

function save(a: Appearance) {
  try {
    localStorage.setItem(KEY, JSON.stringify(a));
  } catch {
    /* 隐私模式等场景忽略 */
  }
}

export const appearance = $state<Appearance>(load());

/** 把当前外观设置应用到 DOM（启动时与每次修改后调用） */
export function applyAppearance() {
  const root = document.documentElement;
  if (appearance.fontFamily) {
    root.style.setProperty("--font", appearance.fontFamily);
    root.style.setProperty("--font-mono", appearance.fontFamily);
  } else {
    root.style.removeProperty("--font");
    root.style.removeProperty("--font-mono");
  }
  root.style.zoom = appearance.zoom === 1 ? "" : String(appearance.zoom);
  syncShellHeight();
}

/** 实测根 zoom 的实际物理缩放因子：100px 探针的 getBoundingClientRect
    返回 zoom 后的物理像素，s = 物理高 / 100。不依赖各引擎对 vh/innerHeight
    在 CSS zoom 下的不同语义（启动前与运行中报告可能不一致）。 */
function rootZoomScale(): number {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:absolute;left:0;top:0;width:0;height:100px;visibility:hidden;pointer-events:none;";
  const root = document.documentElement;
  root.appendChild(probe);
  const phys = probe.getBoundingClientRect().height;
  root.removeChild(probe);
  return phys > 0 ? phys / 100 : 1;
}

/** 壳高度校正：html zoom>1 时 100vh 会被物理放大、超出窗口（右侧冒滚动条、布局错位），
    把壳高度校正为「窗口物理高度 / 实测缩放因子」（物理尺寸恰好等于窗口）；
    zoom=1 移除校正回退 100vh。每次改字号/窗口 resize 后重新实测。 */
function syncShellHeight() {
  const root = document.documentElement;
  if (appearance.zoom === 1) {
    root.style.removeProperty("--app-h");
    return;
  }
  const s = rootZoomScale();
  root.style.setProperty("--app-h", `${window.innerHeight / s}px`);
}

// 窗口尺寸变化时保持校正值最新
if (typeof window !== "undefined") {
  window.addEventListener("resize", () => {
    if (appearance.zoom !== 1) syncShellHeight();
  });
}

export function setFontFamily(value: string) {
  appearance.fontFamily = value;
  save({ ...appearance });
  applyAppearance();
}

export function setZoom(zoom: number) {
  appearance.zoom = Math.min(MAX, Math.max(MIN, zoom));
  save({ ...appearance });
  applyAppearance();
}

export function resetAppearance() {
  appearance.fontFamily = "";
  appearance.zoom = 1;
  save({ ...appearance });
  applyAppearance();
}
