import { describeFix, formatParameterValue, parameterLabel } from "./format.ts";
import type { Operator, Predicate, Rule, RuleValue, ValidationIssue } from "./types.ts";

const OPERATOR_SYMBOL: Record<Operator, string> = {
  "==": "=",
  "!=": "≠",
  "<": "<",
  "<=": "≤",
  ">": ">",
  ">=": "≥",
};

export function describeConstraint(predicate: Predicate): string {
  return `${parameterLabel(predicate.parameter)} ${OPERATOR_SYMBOL[predicate.operator]} ${formatParameterValue(predicate.parameter, predicate.value)}`;
}

export function limitPhrase(predicate: Predicate): { label: string; value: string } {
  const value = formatParameterValue(predicate.parameter, predicate.value);
  switch (predicate.operator) {
    case "<":
    case "<=":
      return { label: "Maximum", value };
    case ">":
    case ">=":
      return { label: "Minimum", value };
    case "==":
      return { label: "Required", value };
    case "!=":
      return { label: "Excluded", value };
  }
}

export function issueFromRule(rule: Rule, context: Readonly<Record<string, RuleValue>>): ValidationIssue {
  const limit = limitPhrase(rule.then);
  const currentValue = context[rule.then.parameter];
  const seen = new Set<string>();
  const inputs = [];
  for (const predicate of [...rule.when, rule.then]) {
    if (seen.has(predicate.parameter)) continue;
    seen.add(predicate.parameter);
    const value = context[predicate.parameter];
    inputs.push({
      parameter: predicate.parameter,
      label: parameterLabel(predicate.parameter),
      value: value === undefined ? "—" : formatParameterValue(predicate.parameter, value),
    });
  }

  return {
    id: `${rule.id}:${rule.then.parameter}`,
    ruleId: rule.id,
    severity: rule.severity,
    parameter: rule.then.parameter,
    parameterLabel: parameterLabel(rule.then.parameter),
    message: rule.message,
    explanation: rule.explanation,
    suggestion: rule.suggestion,
    current: currentValue === undefined ? "—" : formatParameterValue(rule.then.parameter, currentValue),
    limitLabel: limit.label,
    limit: limit.value,
    fixes: rule.fixes.map((fix) => ({
      parameter: fix.parameter,
      value: fix.value,
      label: describeFix(fix.parameter, fix.value),
    })),
    trace: {
      ruleId: rule.id,
      inputs,
      constraint: describeConstraint(rule.then),
      result: "fail",
    },
  };
}
