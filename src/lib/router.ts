// 极简 hash 路由：解析 location.hash 为路径段数组。
// 路由表由 App.svelte 持有；hash 变化经 hashchange 通知。

export interface RouteInfo {
  /** 路径段，如 #/library/search → ["library","search"]；根为 [] */
  segments: string[];
}

export function parseHash(): RouteInfo {
  const raw = window.location.hash.replace(/^#\/?/, "");
  // hash 中的非 ASCII（如中文星名）会被浏览器百分号编码，必须解码后再查表
  const segments = raw
    .split("/")
    .filter(Boolean)
    .map((seg) => {
      try {
        return decodeURIComponent(seg);
      } catch {
        return seg; // 孤立 % 等畸形输入按原文处理
      }
    });
  return { segments };
}

export function navigate(path: string) {
  window.location.hash = path.startsWith("/") ? path : `/${path}`;
}
