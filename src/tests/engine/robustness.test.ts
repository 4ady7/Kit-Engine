import { describe, expect, it } from "vitest";
import { constraintsConflict } from "../../engine/contradictions.ts";
import { derive } from "../../engine/derivedValues.ts";
import { compileRuleSource, builtinRules, evaluate } from "../../engine/ruleEngine.ts";
import { buildLayout } from "../../engine/layout.ts";
import { applyValue, cloneConfiguration, defaultConfiguration, settableParameters } from "../../engine/parameters.ts";
import { parseConfigurationDocument, serializeConfiguration } from "../../engine/serialize.ts";
import { buildSpecification } from "../../engine/specification.ts";
import { formatGbp } from "../../engine/format.ts";
import { presets } from "../../engine/presets.ts";
import { mergeRemoteRules, saveMatchesScreen, useConfigurationStore } from "../../store/configurationStore.ts";
import { sharedRouteState } from "../../app/routeState.ts";
import type { Configuration, Rule } from "../../engine/types.ts";

function config(overrides: Partial<Configuration> = {}): Configuration {
  return {
    ...cloneConfiguration(defaultConfiguration),
    ...overrides,
    accessories: { ...defaultConfiguration.accessories, ...overrides.accessories },
  };
}

function rule(source: string): Rule {
  const compiled = compileRuleSource(source);
  const parsed = compiled.rules[0];
  if (!parsed || compiled.errors.length > 0) throw new Error(compiled.errors.join("\n"));
  return parsed;
}

describe("parameter boundaries", () => {
  it("accepts each numeric limit and rejects the value just outside it", () => {
    for (const spec of settableParameters()) {
      if (spec.kind !== "integer" && spec.kind !== "number") continue;
      const min = spec.min ?? 0;
      const max = spec.max ?? 0;
      const atMin = applyValue(defaultConfiguration, spec.key, min);
      const atMax = applyValue(defaultConfiguration, spec.key, max);
      const below = applyValue(defaultConfiguration, spec.key, min - 1);
      const above = applyValue(defaultConfiguration, spec.key, max + 1);
      const zero = applyValue(defaultConfiguration, spec.key, 0);
      const negative = applyValue(defaultConfiguration, spec.key, -1);
      expect(atMin && evaluate(atMin).errors.some((issue) => issue.ruleId === `parameter-range:${spec.key}`)).toBe(false);
      expect(atMax && evaluate(atMax).errors.some((issue) => issue.ruleId === `parameter-range:${spec.key}`)).toBe(false);
      expect(below && evaluate(below).errors.some((issue) => issue.ruleId === `parameter-range:${spec.key}`)).toBe(true);
      expect(above && evaluate(above).errors.some((issue) => issue.ruleId === `parameter-range:${spec.key}`)).toBe(true);
      if (min > 0) {
        expect(zero && evaluate(zero).errors.some((issue) => issue.ruleId === `parameter-range:${spec.key}`)).toBe(true);
        expect(negative && evaluate(negative).errors.some((issue) => issue.ruleId === `parameter-range:${spec.key}`)).toBe(true);
      }
      for (const candidate of [atMin, atMax, below, above, zero, negative]) {
        if (!candidate) continue;
        const price = evaluate(candidate).price;
        expect(Number.isFinite(price.total)).toBe(true);
        expect(price.total).toBeGreaterThanOrEqual(0);
        expect(price.lines.every((line) => Number.isFinite(line.amount) && line.amount >= 0)).toBe(true);
      }
    }
  });

  it("rejects a fractional bay count and a non-finite width", () => {
    const fractional = applyValue(defaultConfiguration, "bayCount", 1.5);
    expect(fractional && evaluate(fractional).errors.some((issue) => issue.message.includes("whole number"))).toBe(true);
    const infinite = config({ bayWidth: Number.POSITIVE_INFINITY });
    const result = evaluate(infinite);
    expect(result.errors.some((issue) => issue.ruleId === "parameter-range:bayWidth")).toBe(true);
    expect(Number.isFinite(result.price.total)).toBe(true);
  });
});

describe("rule combinations", () => {
  it("keeps the same violations and price when rule order changes", () => {
    const sample = config({ bayWidth: 2200, loadRating: 800, bracing: "standard", shelfDepth: 1000 });
    const forward = evaluate(sample, builtinRules);
    const reverse = evaluate(sample, [...builtinRules].reverse());
    expect(reverse.valid).toBe(forward.valid);
    expect(reverse.price).toEqual(forward.price);
    expect(reverse.derived).toEqual(forward.derived);
    expect(new Set(reverse.errors.map((issue) => issue.ruleId))).toEqual(new Set(forward.errors.map((issue) => issue.ruleId)));
    expect(new Set(reverse.warnings.map((issue) => issue.ruleId))).toEqual(new Set(forward.warnings.map((issue) => issue.ruleId)));
  });

  it("is deterministic for the same configuration and rule set", () => {
    const sample = config({ bayCount: 6, overallHeight: 3600, bracing: "heavy-duty" });
    expect(evaluate(sample)).toEqual(evaluate(sample));
  });

  it("leaves the other violations in place when one is fixed", () => {
    const broken = config({ bayWidth: 2200, loadRating: 800, bracing: "standard" });
    const braced = applyValue(broken, "bracing", "heavy-duty");
    expect(braced).not.toBeNull();
    if (!braced) return;
    const result = evaluate(braced);
    expect(result.errors.some((issue) => issue.ruleId === "load-bracing")).toBe(false);
    expect(result.errors.some((issue) => issue.ruleId === "steel-width-limit")).toBe(true);
  });

  it("reports a rule set that cannot be satisfied", () => {
    const wide = rule(`
RULE force-wide ERROR
THEN bayWidth >= 2200
MESSAGE "Bays must be at least 2200 mm wide."
EXPLAIN "This extra rule disagrees with the steel span limit."
SUGGEST "Remove this rule or change the steel span rule."
`);
    const result = evaluate(defaultConfiguration, [...builtinRules, wide]);
    const contradiction = result.errors.find((issue) => issue.ruleId.startsWith("rule-contradiction:"));
    expect(contradiction?.message).toMatch(/contradict/);
    expect(contradiction?.explanation).toMatch(/steel-width-limit/);
    expect(contradiction?.explanation).toMatch(/force-wide/);
    expect(result.valid).toBe(false);
    expect(constraintsConflict(builtinRules[0]!.then, wide.then)).toBe(true);
  });

  it("does not call compatible limits a contradiction", () => {
    expect(constraintsConflict(
      { parameter: "bayWidth", operator: "<=", value: 1800 },
      { parameter: "bayWidth", operator: "<=", value: 2400 },
    )).toBe(false);
    expect(evaluate(defaultConfiguration).errors.some((issue) => issue.ruleId.startsWith("rule-contradiction:"))).toBe(false);
  });
});

describe("derived values and geometry", () => {
  it("uses the same shelf pitch as the derived value, including above the mesh cap", () => {
    const crowded = config({ shelfCount: 30, overallHeight: 2400 });
    const pitchM = derive(crowded).shelfPitchMm / 1000;
    const layout = buildLayout(crowded);
    const first = layout.shelves.find((shelf) => shelf.id === "shelf-0-0");
    const second = layout.shelves.find((shelf) => shelf.id === "shelf-0-1");
    expect(first && second).toBeTruthy();
    if (!first || !second) return;
    expect(second.y - first.y).toBeCloseTo(pitchM);
    expect(layout.shelves.filter((shelf) => shelf.id.startsWith("shelf-0-")).length).toBeLessThan(30);
  });

  it("does not build negative or inverted parts from negative dimensions", () => {
    const layout = buildLayout(config({ bayWidth: -500, shelfDepth: -100, overallHeight: -20, bayCount: -3 }));
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.depth).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
    expect(layout.shelves.every((shelf) => shelf.width > 0 && shelf.depth > 0 && shelf.thickness > 0)).toBe(true);
  });
});

describe("history", () => {
  it("can undo back through a value typed during a gesture when another edit is committed", () => {
    useConfigurationStore.setState({
      config: cloneConfiguration(defaultConfiguration),
      past: [],
      future: [],
      gestureBase: null,
    });
    const store = useConfigurationStore.getState();
    store.beginGesture();
    store.setParameter("bayWidth", 1800, "live");
    store.setParameter("frameMaterial", "reinforced-steel", "commit");
    useConfigurationStore.getState().undo();
    expect(useConfigurationStore.getState().config.bayWidth).toBe(1800);
    expect(useConfigurationStore.getState().config.frameMaterial).toBe("steel");
    useConfigurationStore.getState().undo();
    expect(useConfigurationStore.getState().config.bayWidth).toBe(defaultConfiguration.bayWidth);
  });

  it("records one history entry for a rapid slider gesture", () => {
    useConfigurationStore.setState({
      config: cloneConfiguration(defaultConfiguration),
      past: [],
      future: [],
      gestureBase: null,
    });
    const store = useConfigurationStore.getState();
    store.beginGesture();
    for (const width of [1800, 1900, 2000, 2100, 2200, 2300, 2400]) {
      useConfigurationStore.getState().setParameter("bayWidth", width, "live");
    }
    useConfigurationStore.getState().endGesture();
    const state = useConfigurationStore.getState();
    expect(state.config.bayWidth).toBe(2400);
    expect(state.past).toHaveLength(1);
    expect(state.past[0]?.bayWidth).toBe(defaultConfiguration.bayWidth);
    expect(evaluate(state.config).errors.some((issue) => issue.ruleId === "steel-width-limit")).toBe(true);
  });

  it("restores a preset exactly on undo", () => {
    useConfigurationStore.setState({
      config: cloneConfiguration(defaultConfiguration),
      past: [],
      future: [],
      gestureBase: null,
      title: "Standard warehouse",
    });
    const heavy = presets.find((preset) => preset.id === "heavy-duty");
    expect(heavy).toBeDefined();
    if (!heavy) return;
    useConfigurationStore.getState().applyPreset(heavy);
    useConfigurationStore.getState().undo();
    expect(useConfigurationStore.getState().config).toEqual(defaultConfiguration);
  });
});

describe("sharing and remote rules", () => {
  it("rejects a non-finite dimension instead of storing it", () => {
    const document = serializeConfiguration(defaultConfiguration);
    const poisoned = {
      ...document,
      parameters: { ...document.parameters, bayWidth: Number.POSITIVE_INFINITY },
    };
    expect(parseConfigurationDocument(poisoned).ok).toBe(false);
  });

  it("prices a reloaded configuration from the engine, not from a stored total", () => {
    const document = serializeConfiguration(config({ bayWidth: 2200 }), "Steel overspan");
    const parsed = parseConfigurationDocument(JSON.parse(JSON.stringify(document)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const evaluation = evaluate(parsed.document.parameters);
    const specification = buildSpecification({
      id: "abc",
      title: parsed.document.title ?? "",
      config: parsed.document.parameters,
      evaluation,
      generatedAt: new Date("2026-10-05T00:00:00Z"),
    });
    expect(specification.total).toBe(formatGbp(evaluation.price.total));
    expect(specification.statusLabel).toBe(evaluation.status.label);
    expect("price" in parsed.document).toBe(false);
  });

  it("drops a stale rule-list response after a local deletion", () => {
    const kept = rule(`
RULE kept-rule WARNING
THEN bayCount <= 8
MESSAGE "Bay count stays within the catalogue."
EXPLAIN "This rule is still on the server."
SUGGEST "Leave the bay count unchanged."
`);
    const removed = rule(`
RULE removed-rule WARNING
THEN bayCount >= 1
MESSAGE "There is at least one bay."
EXPLAIN "The user removed this rule locally."
SUGGEST "No change is required."
`);
    expect(mergeRemoteRules([kept], [kept, removed], 1, 2)).toBeNull();
    expect(mergeRemoteRules([kept], [kept, removed], 2, 2)?.map((item) => item.id)).toEqual(["kept-rule", "removed-rule"]);
  });

  it("does not treat a newer edit as the configuration that was saved", () => {
    expect(saveMatchesScreen(defaultConfiguration, "Standard warehouse", defaultConfiguration, "Standard warehouse")).toBe(true);
    expect(saveMatchesScreen(defaultConfiguration, "Standard warehouse", config({ bayWidth: 1500 }), "Standard warehouse")).toBe(false);
  });

  it("does not present another configuration while a share is loading or has failed", () => {
    expect(sharedRouteState(undefined, null, null)).toBe("ready");
    expect(sharedRouteState("abc", "abc", null)).toBe("ready");
    expect(sharedRouteState("abc", null, null)).toBe("loading");
    expect(sharedRouteState("abc", "previous", "abc")).toBe("failed");
  });
});
