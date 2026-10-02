import { describe, expect, it } from "vitest";
import { compileRuleSource } from "../../engine/ruleEngine.ts";
import { formatRule, parseRules } from "../../engine/grammar.ts";
import { BUILTIN_DSL } from "../../engine/builtin.dsl.ts";
import { compileProposedRule, GRAMMAR_REJECTION } from "../../engine/compile.ts";

const sample = `
RULE example-limit ERROR
WHEN frameMaterial == "steel" AND loadRating > 100
THEN bayWidth <= 1500
MESSAGE "Example span limit for the grammar test."
EXPLAIN "This rule exists so the parser can be tested without the product catalogue."
SUGGEST "Reduce the bay width."
FIX bayWidth = 1500
`;

describe("rule DSL", () => {
  it("parses a conditional rule and prints it back", () => {
    const parsed = parseRules(sample);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rules).toHaveLength(1);
    const rule = parsed.rules[0];
    expect(rule?.when).toHaveLength(2);
    expect(rule?.then).toMatchObject({ parameter: "bayWidth", operator: "<=", value: 1500 });
    const again = parseRules(formatRule(rule!));
    expect(again.errors).toEqual([]);
    expect(again.rules[0]).toMatchObject({
      id: "example-limit",
      severity: "error",
      message: rule?.message,
      fixes: [{ parameter: "bayWidth", value: 1500 }],
    });
  });

  it("parses the built-in catalogue without errors", () => {
    const parsed = compileRuleSource(BUILTIN_DSL);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rules.length).toBeGreaterThanOrEqual(9);
  });

  it("rejects syntax the grammar does not allow", () => {
    const parsed = parseRules(`
RULE bad-rule ERROR
WHEN bayWidth OR shelfDepth
THEN bayWidth <= 1000
MESSAGE "Too wide."
EXPLAIN "Not a real rule."
SUGGEST "No."
`);
    expect(parsed.errors.length).toBeGreaterThan(0);
    expect(parsed.rules).toHaveLength(0);
  });

  it("rejects an unknown parameter during compilation", () => {
    const compiled = compileRuleSource(`
RULE mystery ERROR
THEN panelWidth <= 1000
MESSAGE "Panel width is not a parameter."
EXPLAIN "The catalogue does not include panel width."
SUGGEST "Use bay width instead."
`);
    expect(compiled.rules).toHaveLength(0);
    expect(compiled.errors.join(" ")).toMatch(/unknown parameter/i);
  });

  it("rejects a fix aimed at a derived value", () => {
    const compiled = compileRuleSource(`
RULE pitch-fix ERROR
THEN shelfPitchMm >= 250
MESSAGE "Shelves are too close together."
EXPLAIN "Pitch is calculated from height and shelf count."
SUGGEST "Remove a shelf."
FIX shelfPitchMm = 250
`);
    expect(compiled.rules).toHaveLength(0);
    expect(compiled.errors.join(" ")).toMatch(/derived/);
  });
});

describe("proposed rule compilation", () => {
  it("accepts a schema-valid proposal and returns DSL", () => {
    const result = compileProposedRule({
      id: "custom-span",
      severity: "error",
      when: [{ parameter: "frameMaterial", operator: "==", value: "steel" }],
      then: { parameter: "bayWidth", operator: "<=", value: 1600 },
      message: "Custom steel bays must stay within 1600 mm.",
      explanation: "A reviewer added a tighter span for this installation.",
      suggestion: "Reduce bay width to 1600 mm.",
      fixes: [{ parameter: "bayWidth", value: 1600 }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.dsl).toContain('WHEN frameMaterial == "steel"');
      expect(result.dsl).toContain("THEN bayWidth <= 1600");
      expect(result.rule.id).toBe("custom-span");
    }
  });

  it("rejects proposals that are not in the grammar", () => {
    expect(compileProposedRule({ id: "nope", javascript: "alert(1)" }).ok).toBe(false);
    expect(compileProposedRule({
      id: "bad-op",
      severity: "error",
      then: { parameter: "bayWidth", operator: "≈", value: 10 },
      message: "This operator is not supported by the grammar.",
      explanation: "The compiler should reject it before it reaches the store.",
      suggestion: "Use a supported comparison.",
    })).toMatchObject({ ok: false, error: GRAMMAR_REJECTION });
  });

  it("rejects a proposal that collides with an existing rule id", () => {
    const result = compileProposedRule(
      {
        id: "steel-width-limit",
        severity: "warning",
        then: { parameter: "bayWidth", operator: "<=", value: 1000 },
        message: "Trying to replace a built-in rule.",
        explanation: "Ids must stay unique so explanations remain stable.",
        suggestion: "Choose a new id.",
      },
      ["steel-width-limit"],
    );
    expect(result).toMatchObject({ ok: false, error: GRAMMAR_REJECTION });
  });

  it("reads JSON wrapped in a fence", async () => {
    const { extractJson } = await import("../../engine/compile.ts");
    expect(extractJson('```json\n{"id":"a"}\n```')).toEqual({ id: "a" });
  });
});
