import { z } from "zod";
import { formatRule, parseRules } from "./grammar.ts";
import { semanticErrors } from "./ruleEngine.ts";
import type { Rule, RuleValue } from "./types.ts";

export const GRAMMAR_REJECTION = "Unable to compile this rule using the current rule grammar.";

const literalValue = z.union([z.number(), z.string().max(80), z.boolean()]);

const predicateSchema = z
  .object({
    parameter: z.string().max(40),
    operator: z.enum(["==", "!=", "<", "<=", ">", ">="]),
    value: literalValue,
  })
  .strict();

const proposedRuleSchema = z
  .object({
    id: z.string(),
    severity: z.enum(["error", "warning"]),
    when: z.array(predicateSchema).max(4).optional(),
    then: predicateSchema,
    message: z.string().max(280),
    explanation: z.string().max(400),
    suggestion: z.string().max(280),
    fixes: z
      .array(
        z
          .object({
            parameter: z.string().max(40),
            value: literalValue,
          })
          .strict(),
      )
      .max(3)
      .optional(),
  })
  .strict();

export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)```$/.exec(trimmed);
  const body = fenced?.[1] ?? trimmed;
  return JSON.parse(body);
}

function sameValue(a: RuleValue, b: RuleValue): boolean {
  return a === b;
}

function sameRule(a: Rule, b: Rule): boolean {
  const predicate = (left: Rule["then"], right: Rule["then"]) =>
    left.parameter === right.parameter && left.operator === right.operator && sameValue(left.value, right.value);
  if (a.id !== b.id || a.severity !== b.severity) return false;
  if (a.message !== b.message || a.explanation !== b.explanation || a.suggestion !== b.suggestion) return false;
  if (a.when.length !== b.when.length || !a.when.every((item, index) => predicate(item, b.when[index]!))) return false;
  if (!predicate(a.then, b.then)) return false;
  if (a.fixes.length !== b.fixes.length) return false;
  return a.fixes.every((fix, index) => {
    const other = b.fixes[index];
    return other !== undefined && fix.parameter === other.parameter && sameValue(fix.value, other.value);
  });
}

/**
 * Turn a model payload into a rule. The payload is schema-checked, printed as DSL,
 * then parsed again. Only the parsed rule is returned, so unsupported syntax never
 * reaches the rule store.
 */
export function compileProposedRule(
  raw: unknown,
  existingIds: readonly string[] = [],
): { ok: true; dsl: string; rule: Rule } | { ok: false; error: string } {
  const parsed = proposedRuleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: GRAMMAR_REJECTION };

  const draft: Rule = {
    id: parsed.data.id,
    severity: parsed.data.severity,
    when: parsed.data.when ?? [],
    then: parsed.data.then,
    message: parsed.data.message,
    explanation: parsed.data.explanation,
    suggestion: parsed.data.suggestion,
    fixes: parsed.data.fixes ?? [],
    sourceLine: 1,
  };

  if (existingIds.includes(draft.id)) return { ok: false, error: GRAMMAR_REJECTION };
  if (semanticErrors(draft).length > 0) return { ok: false, error: GRAMMAR_REJECTION };

  const dsl = formatRule(draft);
  const roundTrip = parseRules(dsl);
  const rule = roundTrip.rules[0];
  if (roundTrip.errors.length > 0 || roundTrip.rules.length !== 1 || !rule || semanticErrors(rule).length > 0) {
    return { ok: false, error: GRAMMAR_REJECTION };
  }
  if (!sameRule(draft, rule)) return { ok: false, error: GRAMMAR_REJECTION };
  return { ok: true, dsl, rule };
}
