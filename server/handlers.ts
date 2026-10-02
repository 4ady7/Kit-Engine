import { randomBytes } from "node:crypto";
import { compileProposedRule, extractJson, GRAMMAR_REJECTION } from "../src/engine/compile.ts";
import { compileRuleSource, builtinRules } from "../src/engine/ruleEngine.ts";
import { parseConfigurationDocument } from "../src/engine/serialize.ts";
import { ClaudeError, requestRuleProposal } from "./claude.ts";
import type { Repository } from "./repository.ts";

const ID_ALPHABET = "abcdefghijkmnopqrstuvwxyz23456789";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function createConfigurationId(): string {
  const bytes = randomBytes(8);
  let id = "";
  for (const byte of bytes) id += ID_ALPHABET[byte % ID_ALPHABET.length];
  return id;
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > 100_000) {
    throw new Error("body-too-large");
  }
  if (!text.trim()) return null;
  return JSON.parse(text);
}

function builtinIds(): string[] {
  return builtinRules.map((rule) => rule.id);
}

export async function routeApi(request: Request, repository: Repository): Promise<Response | null> {
  const url = new URL(request.url);
  const { pathname } = url;
  if (!pathname.startsWith("/api/")) return null;

  try {
    if (request.method === "POST" && pathname === "/api/configurations") {
      return await createConfiguration(request, repository);
    }
    const configurationMatch = /^\/api\/configurations\/([a-z0-9]+)$/.exec(pathname);
    if (request.method === "GET" && configurationMatch?.[1]) {
      return await readConfiguration(configurationMatch[1], repository);
    }
    if (request.method === "POST" && pathname === "/api/rules/compile") {
      return await compileInstruction(request, repository);
    }
    if (request.method === "GET" && pathname === "/api/rules") {
      const rules = await repository.listRules();
      return json(200, { rules });
    }
    if (request.method === "POST" && pathname === "/api/rules") {
      return await saveRule(request, repository);
    }
    const ruleMatch = /^\/api\/rules\/([a-z0-9-]+)$/.exec(pathname);
    if (request.method === "DELETE" && ruleMatch?.[1]) {
      if (builtinIds().includes(ruleMatch[1])) return json(403, { error: "Built-in rules cannot be removed." });
      const removed = await repository.deleteRule(ruleMatch[1]);
      return removed ? json(200, { ok: true }) : json(404, { error: "Rule not found." });
    }
    return json(404, { error: "Not found." });
  } catch (error) {
    if (error instanceof Error && error.message === "body-too-large") {
      return json(413, { error: "The request body is too large." });
    }
    if (error instanceof SyntaxError) return json(400, { error: "The request body is not valid JSON." });
    console.error(error);
    return json(500, { error: "The server could not complete that request." });
  }
}

function asRecord(body: unknown): Record<string, unknown> | null {
  return typeof body === "object" && body !== null ? body as Record<string, unknown> : null;
}

async function createConfiguration(request: Request, repository: Repository): Promise<Response> {
  const body = await readJson(request);
  const payload = asRecord(body);
  const candidate: Record<string, unknown> = {
    version: payload?.version,
    parameters: payload?.parameters,
  };
  if (typeof payload?.title === "string") candidate.title = payload.title;
  const parsed = parseConfigurationDocument(candidate);
  if (!parsed.ok) return json(400, { error: parsed.message });
  const author = typeof payload?.author === "string" ? payload.author.slice(0, 80) : null;
  const record = await repository.insertConfiguration({
    id: createConfigurationId(),
    title: parsed.document.title ?? "Untitled configuration",
    author,
    parameters: parsed.document.parameters,
  });
  return json(201, record);
}

async function readConfiguration(id: string, repository: Repository): Promise<Response> {
  const record = await repository.getConfiguration(id);
  if (!record) return json(404, { error: "Configuration not found." });
  return json(200, record);
}

async function saveRule(request: Request, repository: Repository): Promise<Response> {
  const body = await readJson(request);
  const dsl = typeof body === "object" && body !== null && "dsl" in body && typeof body.dsl === "string" ? body.dsl : "";
  const compiled = compileRuleSource(dsl);
  const rule = compiled.rules[0];
  if (!dsl || compiled.errors.length > 0 || compiled.rules.length !== 1 || !rule) {
    return json(422, { error: GRAMMAR_REJECTION });
  }
  if (builtinIds().includes(rule.id)) return json(409, { error: "A built-in rule already uses that id." });
  const existing = await repository.listRules();
  if (existing.some((item) => item.id === rule.id)) return json(409, { error: "A custom rule already uses that id." });
  const stored = { id: rule.id, dsl, createdAt: new Date().toISOString() };
  await repository.insertRule(stored);
  return json(201, stored);
}

async function compileInstruction(request: Request, repository: Repository): Promise<Response> {
  const body = await readJson(request);
  const instruction = typeof body === "object" && body !== null && "instruction" in body && typeof body.instruction === "string"
    ? body.instruction.trim()
    : "";
  if (instruction.length < 8) return json(400, { error: "Describe the constraint in a sentence." });
  if (instruction.length > 500) return json(400, { error: "Keep the instruction under 500 characters." });

  try {
    const text = await requestRuleProposal(instruction);
    let payload: unknown;
    try {
      payload = extractJson(text);
    } catch {
      return json(422, { error: GRAMMAR_REJECTION });
    }
    const existing = [...builtinIds(), ...(await repository.listRules()).map((rule) => rule.id)];
    const compiled = compileProposedRule(payload, existing);
    if (!compiled.ok) return json(422, { error: compiled.error });
    return json(200, { dsl: compiled.dsl });
  } catch (error) {
    if (error instanceof ClaudeError) return json(error.status, { error: error.message });
    return json(502, { error: "The rule authoring service did not respond. Try again." });
  }
}
