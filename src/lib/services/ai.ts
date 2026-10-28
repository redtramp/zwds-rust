// AI 流式服务：Channel 事件流 + 取消。所有请求经 Rust 发出（前端无网络权限）。
import { Channel, invoke } from "@tauri-apps/api/core";

export type TopicKey =
  | "overview"
  | "love"
  | "career"
  | "wealth"
  | "health"
  | "personality";

/** 奇门 5 人设键（与 Rust QIMEN_PERSONA_KEYS 一一对应，逐字移植 kinqimen/data/system_prompts.json） */
export type QimenPersonaKey = "master" | "strategist" | "diviner" | "fashu" | "soccer";

export type InterpretIntent =
  | { topic: TopicKey }
  | { branch: number }
  | { starName: string; siHua: string; view: "daxian" | "liunian" };

export interface ChatMsg {
  role: "user" | "assistant" | "system";
  content: string;
}

export type AiRequest =
  | {
      kind: "interpret";
      intent: InterpretIntent | null;
      chart: unknown;
      patterns: unknown[];
      messages: ChatMsg[];
    }
  | {
      kind: "heming";
      chartA: unknown;
      chartB: unknown;
      question: string | null;
      messages: ChatMsg[];
    }
  | {
      kind: "qimen";
      persona: QimenPersonaKey;
      chartText: string;
      messages: ChatMsg[];
    };

export type AiEvent =
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; code: string; message: string };

/** 错误码 → 用户可读文案（与 Rust AiError 一一对应） */
export const AI_ERROR_TEXT: Record<string, string> = {
  no_active_provider: "尚未配置 AI 提供商",
  provider_not_found: "提供商不存在",
  invalid_config: "AI 配置有误",
  connect_timeout: "连接超时（10 秒未连上；Ollama 请确认已启动）",
  auth_failed: "API Key 无效或无权限",
  model_not_found: "模型不存在或端点路径不对",
  rate_limited: "请求过于频繁，稍后再试",
  server_error: "服务商服务异常",
  network: "网络错误",
  sse_parse: "响应格式异常",
  cancelled: "已停止生成",
};

export function aiErrorText(code: string, message?: string): string {
  const base = AI_ERROR_TEXT[code] ?? "解读失败";
  if (code === "no_active_provider") return base;
  return message ? `${base}：${message}` : base;
}

export interface AiSession {
  cancel: () => void;
}

/** 发起流式解读，返回可取消的会话句柄 */
export function aiChat(req: AiRequest, onEvent: (e: AiEvent) => void): AiSession {
  const requestId = crypto.randomUUID();
  const channel = new Channel<AiEvent>();
  channel.onmessage = onEvent;
  invoke("ai_chat", { requestId, req, onEvent: channel }).catch((e) => {
    onEvent({ type: "error", code: "network", message: String(e) });
  });
  return {
    cancel: () => {
      invoke("ai_cancel", { requestId }).catch(() => {});
    },
  };
}
