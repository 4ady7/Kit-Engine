import { describe, expect, it } from "vitest";
import { builtinRules, evaluate } from "../../engine/ruleEngine.ts";
import { presets } from "../../engine/presets.ts";
import { parseConfigurationDocument, serializeConfiguration } from "../../engine/serialize.ts";
import { buildLayout } from "../../engine/layout.ts";
import { benchmarkRules } from "../../engine/benchmark.ts";
import { defaultConfiguration } from "../../engine/parameters.ts";

describe("presets", () => {
  it("matches the intended validity of every demo configuration", () => {
    for (const preset of presets) {
      const result = evaluate(preset.configuration);
      if (preset.intent === "invalid") {
        expect(result.valid, preset.id).toBe(false);
      } else if (preset.intent === "warning") {
        expect(result.valid, preset.id).toBe(true);
        expect(result.warnings.length, preset.id).toBeGreaterThan(0);
      } else {
        expect(result.valid, preset.id).toBe(true);
        expect(result.warnings, preset.id).toEqual([]);
      }
    }
  });
});

describe("serialisation", () => {
  it("round-trips a configuration document", () => {
    const document = serializeConfiguration(defaultConfiguration, "Standard warehouse");
    const parsed = parseConfigurationDocument(JSON.parse(JSON.stringify(document)));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.document.parameters).toEqual(defaultConfiguration);
      expect(parsed.document.title).toBe("Standard warehouse");
    }
  });

  it("rejects a malformed share and a future version", () => {
    expect(parseConfigurationDocument({ version: 1, parameters: { bayCount: 1 } }).ok).toBe(false);
    const future = parseConfigurationDocument({ version: 2, parameters: defaultConfiguration });
    expect(future.ok).toBe(false);
    if (!future.ok) expect(future.message).toMatch(/version/);
    expect(parseConfigurationDocument("nope").ok).toBe(false);
  });
});

describe("geometry", () => {
  it("grows frames, shelves, and braces with the bay and shelf counts", () => {
    const layout = buildLayout(defaultConfiguration);
    expect(layout.uprights).toHaveLength((defaultConfiguration.bayCount + 1) * 2);
    expect(layout.shelves).toHaveLength(defaultConfiguration.bayCount * defaultConfiguration.shelfCount);
    expect(layout.beams).toHaveLength(defaultConfiguration.bayCount * defaultConfiguration.shelfCount * 2);
    expect(layout.braces).toHaveLength(defaultConfiguration.bayCount * 2);
    expect(layout.width).toBeCloseTo(4.8);
    expect(layout.endGuards).toHaveLength(2);
  });

  it("thickens posts for reinforced steel and adds a mid-rail for heavy-duty bracing", () => {
    const reinforced = buildLayout({
      ...defaultConfiguration,
      frameMaterial: "reinforced-steel",
      bracing: "heavy-duty",
    });
    const standard = buildLayout(defaultConfiguration);
    expect(reinforced.uprights[0]?.section).toBeGreaterThan(standard.uprights[0]?.section ?? 0);
    expect(reinforced.braces.length).toBe(defaultConfiguration.bayCount * 3);
    expect(reinforced.shelves[0]?.thickness).toBe(standard.shelves[0]?.thickness);
    const timber = buildLayout({ ...defaultConfiguration, shelfMaterial: "timber" });
    expect(timber.shelves[0]?.thickness).toBeGreaterThan(standard.shelves[0]?.thickness ?? 0);
  });
});

describe("performance", () => {
  it("evaluates well under the 100 ms budget", () => {
    const result = benchmarkRules(defaultConfiguration, builtinRules, 200);
    expect(result.ruleCount).toBe(builtinRules.length);
    expect(result.parameterCount).toBeGreaterThanOrEqual(10);
    expect(result.averageMs).toBeLessThan(100);
    expect(result.maxMs).toBeLessThan(100);
  });
});
