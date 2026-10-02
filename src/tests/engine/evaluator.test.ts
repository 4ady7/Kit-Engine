import { describe, expect, it } from "vitest";
import { defaultConfiguration } from "../../engine/parameters.ts";
import { builtinRules, compare, evaluate } from "../../engine/ruleEngine.ts";
import type { Configuration } from "../../engine/types.ts";

function config(overrides: Partial<Configuration> = {}, accessories: Partial<Configuration["accessories"]> = {}): Configuration {
  return {
    ...defaultConfiguration,
    ...overrides,
    accessories: { ...defaultConfiguration.accessories, ...accessories },
  };
}

describe("numeric and conditional rules", () => {
  it("accepts steel at the 1800 mm span limit", () => {
    const result = evaluate(config({ frameMaterial: "steel", bayWidth: 1800 }));
    expect(result.errors.map((issue) => issue.ruleId)).not.toContain("steel-width-limit");
    expect(result.valid).toBe(true);
  });

  it("rejects steel at 1801 mm and explains the limit", () => {
    const result = evaluate(config({ frameMaterial: "steel", bayWidth: 1801 }));
    const issue = result.errors.find((item) => item.ruleId === "steel-width-limit");
    expect(result.valid).toBe(false);
    expect(issue?.parameter).toBe("bayWidth");
    expect(issue?.current).toBe("1,801 mm");
    expect(issue?.limitLabel).toBe("Maximum");
    expect(issue?.limit).toBe("1,800 mm");
    expect(issue?.suggestion).toMatch(/1800 mm/);
    expect(issue?.fixes.map((fix) => fix.parameter)).toEqual(["bayWidth", "frameMaterial"]);
    expect(issue?.trace.result).toBe("fail");
    expect(issue?.trace.inputs.map((input) => input.parameter)).toEqual(["frameMaterial", "bayWidth"]);
  });

  it("accepts reinforced steel at 2400 mm", () => {
    const result = evaluate(config({ frameMaterial: "reinforced-steel", bayWidth: 2400 }));
    expect(result.errors.map((issue) => issue.ruleId)).not.toContain("reinforced-width-limit");
  });

  it("rejects reinforced steel at 2401 mm", () => {
    const result = evaluate(config({ frameMaterial: "reinforced-steel", bayWidth: 2401 }));
    expect(result.errors.some((issue) => issue.ruleId === "reinforced-width-limit")).toBe(true);
    expect(result.errors.some((issue) => issue.ruleId === "parameter-range:bayWidth")).toBe(true);
  });

  it("requires heavy-duty bracing when the load is above 600 kg", () => {
    const invalid = evaluate(config({ loadRating: 601, bracing: "standard" }));
    expect(invalid.errors.some((issue) => issue.ruleId === "load-bracing")).toBe(true);
    const valid = evaluate(config({ loadRating: 600, bracing: "standard" }));
    expect(valid.errors.some((issue) => issue.ruleId === "load-bracing")).toBe(false);
  });

  it("requires heavy-duty bracing for deep shelves and tall frames", () => {
    expect(evaluate(config({ shelfDepth: 900, bracing: "standard" })).errors.some((issue) => issue.ruleId === "deep-shelf-bracing")).toBe(true);
    expect(evaluate(config({ shelfDepth: 899, bracing: "standard" })).errors.some((issue) => issue.ruleId === "deep-shelf-bracing")).toBe(false);
    expect(evaluate(config({ overallHeight: 3001, bracing: "standard" })).errors.some((issue) => issue.ruleId === "height-bracing")).toBe(true);
    expect(evaluate(config({ overallHeight: 3000, bracing: "standard" })).errors.some((issue) => issue.ruleId === "height-bracing")).toBe(false);
  });

  it("keeps every simultaneous violation", () => {
    const result = evaluate(
      config(
        {
          bayCount: 6,
          bayWidth: 2200,
          shelfDepth: 1000,
          overallHeight: 3600,
          shelfCount: 8,
          frameMaterial: "steel",
          loadRating: 800,
          bracing: "standard",
        },
        { safetyBack: false },
      ),
    );
    const ids = [...result.errors, ...result.warnings].map((issue) => issue.ruleId);
    expect(ids).toEqual(expect.arrayContaining([
      "steel-width-limit",
      "deep-shelf-bracing",
      "load-bracing",
      "height-bracing",
      "wide-run-safety-back",
    ]));
    expect(result.warnings).toHaveLength(1);
    expect(result.valid).toBe(false);
  });

  it("treats a missing safety back on a long run as a warning", () => {
    const result = evaluate(config({ bayCount: 6 }, { safetyBack: false }));
    expect(result.valid).toBe(true);
    expect(result.status.code).toBe("warning");
    expect(result.warnings[0]?.ruleId).toBe("wide-run-safety-back");
  });

  it("rejects shelf pitches below 250 mm", () => {
    const result = evaluate(config({ overallHeight: 1800, shelfCount: 12 }));
    const issue = result.errors.find((item) => item.ruleId === "shelf-pitch");
    expect(issue).toBeDefined();
    expect(issue?.parameter).toBe("shelfPitchMm");
    expect(result.derived.shelfPitchMm).toBeLessThan(250);
  });

  it("derives run width, frame count, and shelf area", () => {
    const result = evaluate(config({ bayCount: 4, bayWidth: 1200, shelfDepth: 600, shelfCount: 5 }));
    expect(result.derived.totalWidthMm).toBe(4800);
    expect(result.derived.frameCount).toBe(5);
    expect(result.derived.shelvesTotal).toBe(20);
    expect(result.derived.shelfAreaM2).toBeCloseTo(0.72);
    expect(result.derived.totalShelfAreaM2).toBeCloseTo(14.4);
  });
});

describe("compare", () => {
  it("does not coerce strings into numbers", () => {
    expect(compare("1800", "<=", 1800)).toBe(false);
    expect(compare(1800, "==", 1800)).toBe(true);
    expect(compare(true, "==", true)).toBe(true);
  });
});

describe("builtin catalogue", () => {
  it("ships the structural rules the product depends on", () => {
    expect(builtinRules.map((rule) => rule.id)).toEqual([
      "steel-width-limit",
      "reinforced-width-limit",
      "deep-shelf-bracing",
      "load-bracing",
      "height-bracing",
      "wide-run-safety-back",
      "shelf-pitch",
      "timber-span",
      "timber-load",
    ]);
  });
});
