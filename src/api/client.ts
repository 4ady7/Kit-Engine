import { serializeConfiguration } from "../engine/serialize.ts";
import type { Configuration } from "../engine/types.ts";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface SavedConfigurationResponse {
  id: string;
  title: string;
  author: string | null;
  parameters: Configuration;
  createdAt: string;
  updatedAt: string;
}

export interface SavedRuleResponse {
  id: string;
  dsl: string;
  createdAt: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError("The server could not be reached.", 0);
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
      ? body.error
      : "The request failed.";
    throw new ApiError(message, response.status);
  }
  return body as T;
}

export function sessionAuthor(): string {
  const key = "kit-engine-author";
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  sessionStorage.setItem(key, created);
  return created;
}

export function saveConfiguration(config: Configuration, title: string): Promise<SavedConfigurationResponse> {
  return request("/api/configurations", {
    method: "POST",
    body: JSON.stringify({ ...serializeConfiguration(config, title), author: sessionAuthor() }),
  });
}

export function loadConfiguration(id: string): Promise<SavedConfigurationResponse> {
  return request(`/api/configurations/${id}`);
}

export function listRules(): Promise<{ rules: SavedRuleResponse[] }> {
  return request("/api/rules");
}

export function saveRule(dsl: string): Promise<SavedRuleResponse> {
  return request("/api/rules", { method: "POST", body: JSON.stringify({ dsl }) });
}

export function deleteRule(id: string): Promise<{ ok: boolean }> {
  return request(`/api/rules/${id}`, { method: "DELETE" });
}

export function compileRule(instruction: string): Promise<{ dsl: string }> {
  return request("/api/rules/compile", { method: "POST", body: JSON.stringify({ instruction }) });
}
