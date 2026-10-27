// 提供商配置服务：Tauri 命令封装（Key 永不出现在前端，只见掩码）
import { invoke } from "@tauri-apps/api/core";

export interface ProviderView {
  id: string;
  name: string;
  baseUrl: string;
  apiKeyMasked: string;
  hasApiKey: boolean;
  model: string;
  maxTokens: number;
  temperature: number;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ProviderInput {
  id?: string | null;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  isActive?: boolean;
}

export interface PresetView {
  key: string;
  name: string;
  baseUrl: string;
  model: string;
  needsKey: boolean;
  hint: string;
}

export interface ProviderTestResult {
  ok: boolean;
  latencyMs?: number;
  code?: string;
  message?: string;
}

export const providersList = () => invoke<ProviderView[]>("providers_list");
export const providerSave = (input: ProviderInput) =>
  invoke<ProviderView>("provider_save", { input });
export const providerDelete = (id: string) =>
  invoke<boolean>("provider_delete", { id });
export const providerSetActive = (id: string) =>
  invoke<boolean>("provider_set_active", { id });
export const activeProviderId = () => invoke<string | null>("active_provider_id");
export const presetsList = () => invoke<PresetView[]>("presets_list");
export const providerTest = (id: string) =>
  invoke<ProviderTestResult>("provider_test", { id });
