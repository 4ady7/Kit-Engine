import { describe, expect, it } from "vitest";
import { defaultConfiguration } from "../src/engine/parameters.ts";
import { serializeConfiguration } from "../src/engine/serialize.ts";
import { routeApi } from "./handlers.ts";
import { MemoryRepository } from "./memoryRepository.ts";

function post(path: string, body: unknown): Request {
  return new Request(`http://kit.local${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("configuration API", () => {
  it("stores a configuration and recomputes nothing about validity", async () => {
    const repository = new MemoryRepository();
    const document = serializeConfiguration(defaultConfiguration, "Shared run");
    const created = await routeApi(post("/api/configurations", { ...document, author: "session-1" }), repository);
    expect(created?.status).toBe(201);
    const saved = await created?.json() as { id: string; parameters: unknown; valid?: boolean };
    expect(saved.valid).toBeUndefined();
    expect(saved.parameters).toEqual(defaultConfiguration);

    const loaded = await routeApi(new Request(`http://kit.local/api/configurations/${saved.id}`), repository);
    expect(loaded?.status).toBe(200);
    const again = await loaded?.json() as { parameters: unknown };
    expect(again.parameters).toEqual(defaultConfiguration);
  });

  it("rejects a non-finite dimension instead of storing infinity", async () => {
    const repository = new MemoryRepository();
    const document = serializeConfiguration(defaultConfiguration);
    const body = JSON.stringify(document).replace(`"bayWidth":${defaultConfiguration.bayWidth}`, `"bayWidth":1e309`);
    const response = await routeApi(new Request("http://kit.local/api/configurations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    }), repository);
    expect(response?.status).toBe(400);
  });

  it("rejects a malformed configuration and an unknown id", async () => {
    const repository = new MemoryRepository();
    const bad = await routeApi(post("/api/configurations", { version: 1, parameters: {} }), repository);
    expect(bad?.status).toBe(400);
    const missing = await routeApi(new Request("http://kit.local/api/configurations/missingid"), repository);
    expect(missing?.status).toBe(404);
  });

  it("refuses to store a rule the grammar cannot compile", async () => {
    const repository = new MemoryRepository();
    const response = await routeApi(post("/api/rules", { dsl: "RULE nope ERROR\nTHEN mystery <= 1" }), repository);
    expect(response?.status).toBe(422);
    const body = await response?.json() as { error: string };
    expect(body.error).toMatch(/grammar/);
    expect(await repository.listRules()).toEqual([]);
  });

  it("stores a valid custom rule and will not overwrite a built-in id", async () => {
    const repository = new MemoryRepository();
    const dsl = [
      "RULE custom-depth WARNING",
      'WHEN shelfMaterial == "timber"',
      "THEN shelfDepth <= 600",
      'MESSAGE "Timber decks deeper than 600 mm need a review."',
      'EXPLAIN "This is an approved custom constraint."',
      'SUGGEST "Reduce the shelf depth or change the shelf material."',
    ].join("\n");
    const saved = await routeApi(post("/api/rules", { dsl }), repository);
    expect(saved?.status).toBe(201);
    const listed = await routeApi(new Request("http://kit.local/api/rules"), repository);
    const payload = await listed?.json() as { rules: Array<{ id: string }> };
    expect(payload.rules.map((rule) => rule.id)).toEqual(["custom-depth"]);

    const blocked = await routeApi(post("/api/rules", {
      dsl: dsl.replace("custom-depth", "steel-width-limit"),
    }), repository);
    expect(blocked?.status).toBe(409);
  });

  it("reports a missing Claude key instead of inventing a rule", async () => {
    const previous = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const response = await routeApi(
      post("/api/rules/compile", { instruction: "Steel bays must stay under 2 metres." }),
      new MemoryRepository(),
    );
    expect(response?.status).toBe(503);
    if (previous) process.env.ANTHROPIC_API_KEY = previous;
  });
});
