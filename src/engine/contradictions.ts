import { describeConstraint } from "./explanations.ts";
import { parameterLabel } from "./format.ts";
import { parameterByKey } from "./parameters.ts";
import type { Predicate, Rule, ValidationIssue } from "./types.ts";

function tightenLower(current: number, currentInclusive: boolean, next: number, nextInclusive: boolean): [number, boolean] {
  if (next > current) return [next, nextInclusive];
  if (next === current && currentInclusive && !nextInclusive) return [next, false];
  return [current, currentInclusive];
}

function tightenUpper(current: number, currentInclusive: boolean, next: number, nextInclusive: boolean): [number, boolean] {
  if (next < current) return [next, nextInclusive];
  if (next === current && currentInclusive && !nextInclusive) return [next, false];
  return [current, currentInclusive];
}

function numericPairIsPossible(left: Predicate, right: Predicate): boolean {
  let lower = Number.NEGATIVE_INFINITY;
  let lowerInclusive = true;
  let upper = Number.POSITIVE_INFINITY;
  let upperInclusive = true;
  const required: number[] = [];
  const excluded: number[] = [];

  for (const predicate of [left, right]) {
    if (typeof predicate.value !== "number" || !Number.isFinite(predicate.value)) return false;
    const value = predicate.value;
    if (predicate.operator === ">") [lower, lowerInclusive] = tightenLower(lower, lowerInclusive, value, false);
    else if (predicate.operator === ">=") [lower, lowerInclusive] = tightenLower(lower, lowerInclusive, value, true);
    else if (predicate.operator === "<") [upper, upperInclusive] = tightenUpper(upper, upperInclusive, value, false);
    else if (predicate.operator === "<=") [upper, upperInclusive] = tightenUpper(upper, upperInclusive, value, true);
    else if (predicate.operator === "==") required.push(value);
    else excluded.push(value);
  }

  if (required.length > 0) {
    const target = required[0];
    if (target === undefined || required.some((value) => value !== target)) return false;
    if (target < lower || target > upper) return false;
    if (target === lower && !lowerInclusive) return false;
    if (target === upper && !upperInclusive) return false;
    if (excluded.includes(target)) return false;
    return true;
  }

  if (lower > upper) return false;
  if (lower === upper && (!lowerInclusive || !upperInclusive)) return false;
  if (lower === upper && excluded.includes(lower)) return false;
  return true;
}

function discretePairIsPossible(left: Predicate, right: Predicate): boolean {
  if (!["==", "!="].includes(left.operator) || !["==", "!="].includes(right.operator)) return false;
  const spec = parameterByKey(left.parameter);
  const domain = spec?.kind === "boolean"
    ? [true, false]
    : spec?.options?.map((option) => option.value) ?? [];
  return domain.some((candidate) => holds(left, candidate) && holds(right, candidate));
}

function holds(predicate: Predicate, candidate: string | number | boolean): boolean {
  if (predicate.operator === "==") return candidate === predicate.value;
  if (predicate.operator === "!=") return candidate !== predicate.value;
  if (typeof candidate !== "number" || typeof predicate.value !== "number") return false;
  if (predicate.operator === "<") return candidate < predicate.value;
  if (predicate.operator === "<=") return candidate <= predicate.value;
  if (predicate.operator === ">") return candidate > predicate.value;
  if (predicate.operator === ">=") return candidate >= predicate.value;
  return false;
}

/** True when no single value can satisfy both constraints. */
export function constraintsConflict(left: Predicate, right: Predicate): boolean {
  if (left.parameter !== right.parameter) return false;
  if (typeof left.value === "number" && typeof right.value === "number") return !numericPairIsPossible(left, right);
  return !discretePairIsPossible(left, right);
}

export function contradictionIssues(engaged: readonly Rule[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (let index = 0; index < engaged.length; index += 1) {
    for (let other = index + 1; other < engaged.length; other += 1) {
      const left = engaged[index];
      const right = engaged[other];
      if (!left || !right || !constraintsConflict(left.then, right.then)) continue;
      const [first, second] = [left, right].sort((a, b) => a.id.localeCompare(b.id));
      if (!first || !second) continue;
      issues.push({
        id: `rule-contradiction:${first.then.parameter}:${first.id}:${second.id}`,
        ruleId: `rule-contradiction:${first.then.parameter}:${first.id}:${second.id}`,
        severity: "error",
        parameter: first.then.parameter,
        parameterLabel: parameterLabel(first.then.parameter),
        message: `Rules ${first.id} and ${second.id} contradict each other.`,
        explanation: `${first.id} requires ${describeConstraint(first.then)}. ${second.id} requires ${describeConstraint(second.then)}. No value satisfies both, so this rule set is inconsistent.`,
        suggestion: "Remove or edit one of these rules. Changing the configuration cannot satisfy both.",
        current: "—",
        limitLabel: "Conflict",
        limit: `${describeConstraint(first.then)} and ${describeConstraint(second.then)}`,
        fixes: [],
        trace: {
          ruleId: `rule-contradiction:${first.id}:${second.id}`,
          inputs: [
            { parameter: first.id, label: first.id, value: describeConstraint(first.then) },
            { parameter: second.id, label: second.id, value: describeConstraint(second.then) },
          ],
          constraint: "The engaged rules must be jointly satisfiable",
          result: "fail",
        },
      });
    }
  }
  return issues;
}
