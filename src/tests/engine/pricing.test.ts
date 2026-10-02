import { describe, expect, it } from "vitest";
import { derive } from "../../engine/derivedValues.ts";
import { defaultConfiguration } from "../../engine/parameters.ts";
import { priceConfiguration } from "../../engine/pricing.ts";
import { evaluate } from "../../engine/ruleEngine.ts";

describe("pricing", () => {
  it("calculates the standard warehouse price from published rates", () => {
    const config = defaultConfiguration;
    const derived = derive(config);
    const price = priceConfiguration(config, derived);

    // 5 upright lines × 2.4 m × £46
    const frames = Math.round(5 * 2.4 * 46);
    // 20 shelves × 1.2 m × £16
    const beams = Math.round(20 * 1.2 * 16);
    // 14.4 m² × £92
    const shelves = Math.round(14.4 * 92);
    // (400 - 300) / 100 × £28 × 4 bays
    const load = Math.round(1 * 28 * 4);
    const bracing = 4 * 32;
    const total = 480 + frames + beams + shelves + load + bracing + 90;

    expect(frames).toBe(552);
    expect(beams).toBe(384);
    expect(shelves).toBe(1325);
    expect(price.total).toBe(total);
    expect(price.total).toBe(3071);
    expect(price.lines.map((line) => line.id)).toEqual([
      "base",
      "frames",
      "beams",
      "shelves",
      "load",
      "bracing",
      "endGuard",
    ]);
  });

  it("uses the same price inside evaluation, including invalid configurations", () => {
    const result = evaluate({
      ...defaultConfiguration,
      bayWidth: 2200,
      loadRating: 800,
      bracing: "heavy-duty",
      accessories: { ...defaultConfiguration.accessories, labelRail: true, safetyBack: true },
    });
    expect(result.valid).toBe(false);
    expect(result.price.total).toBeGreaterThan(3071);
    expect(result.price.lines.some((line) => line.id === "safetyBack")).toBe(true);
    expect(result.price.currency).toBe("GBP");
  });

  it("charges reinforced frames and heavy-duty bracing at their own rates", () => {
    const steel = priceConfiguration(defaultConfiguration, derive(defaultConfiguration));
    const reinforced = priceConfiguration(
      {
        ...defaultConfiguration,
        frameMaterial: "reinforced-steel",
        bracing: "heavy-duty",
        overallHeight: 3000,
        accessories: { endGuard: false, labelRail: false, safetyBack: false },
      },
      derive({
        ...defaultConfiguration,
        frameMaterial: "reinforced-steel",
        bracing: "heavy-duty",
        overallHeight: 3000,
        accessories: { endGuard: false, labelRail: false, safetyBack: false },
      }),
    );
    const frameLine = reinforced.lines.find((line) => line.id === "frames");
    expect(frameLine?.amount).toBe(Math.round(5 * 3 * 68));
    expect(reinforced.lines.find((line) => line.id === "bracing")?.amount).toBe(Math.round(4 * 74 * 1.15));
    expect(reinforced.total).not.toBe(steel.total);
  });
});
