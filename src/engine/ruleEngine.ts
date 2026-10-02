import { derive } from "./derivedValues.ts";
import { issueFromRule } from "./explanations.ts";
import { describeFix, formatParameterValue } from "./format.ts";
import { BUILTIN_DSL } from "./builtin.dsl.ts";
import { formatRule, parseRules } from "./grammar.ts";
import { parameterByKey, PARAMETERS, readParameter } from "./parameters.ts";
import { priceConfiguration } from "./pricing.ts";
import type {
  ConfigStatus,
  Configuration,
  EvaluationResult,
  Operator,
  Predicate,
  Rule,
  RuleValue,
  Severity,
  ValidationIssue,
} from "./types.ts";

const parsedBuiltin = parseRules(BUILTIN_DSL);
if (parsedBuiltin.errors.length > 0) {
  throw new Error(`Built-in rules failed to parse:\n${parsedBuiltin.errors.join("\n")}`);
}

export const builtinRules: readonly Rule[] = parsedBuiltin.rules;

const NUMERIC_OPERATORS: readonly Operator[] = ["==", "!=", "<", "<=", ">", ">="];
const EQUALITY_OPERATORS: readonly Operator[] = ["==", "!="];

export function compare(left: RuleValue, operator: Operator, right: RuleValue): boolean {
  if (operator === "==") return left === right;
  if (operator === "!=") return left !== right;
  if (typeof left !== "number" || typeof right !== "number") return false;
  if (operator === "<") return left < right;
  if (operator === "<=") return left <= right;
  if (operator === ">") return left > right;
  if (operator === ">=") return left >= right;
  return false;
}

export function buildContext(config: Configuration, derived = derive(config)): Record<string, RuleValue> {
  return {
    bayCount: config.bayCount,
    bayWidth: config.bayWidth,
    shelfDepth: config.shelfDepth,
    overallHeight: config.overallHeight,
    shelfCount: config.shelfCount,
    frameMaterial: config.frameMaterial,
    shelfMaterial: config.shelfMaterial,
    loadRating: config.loadRating,
    bracing: config.bracing,
    endGuard: config.accessories.endGuard,
    labelRail: config.accessories.labelRail,
    safetyBack: config.accessories.safetyBack,
    shelfPitchMm: derived.shelfPitchMm,
  };
}

function valueFits(parameter: string, value: RuleValue): string | null {
  const spec = parameterByKey(parameter);
  if (!spec) return `Unknown parameter "${parameter}".`;
  if (spec.kind === "integer" || spec.kind === "number") {
    if (typeof value !== "number") return `${spec.label} expects a number.`;
    return null;
  }
  if (spec.kind === "boolean") {
    if (typeof value !== "boolean") return `${spec.label} expects true or false.`;
    return null;
  }
  if (typeof value !== "string" || !spec.options?.some((option) => option.value === value)) {
    const allowed = spec.options?.map((option) => option.value).join(", ") ?? "";
    return `${spec.label} must be one of: ${allowed}.`;
  }
  return null;
}

function operatorFits(parameter: string, operator: Operator): string | null {
  const spec = parameterByKey(parameter);
  if (!spec) return `Unknown parameter "${parameter}".`;
  const allowed = spec.kind === "number" || spec.kind === "integer" ? NUMERIC_OPERATORS : EQUALITY_OPERATORS;
  if (!allowed.includes(operator)) {
    return `${spec.label} does not support operator ${operator}.`;
  }
  return null;
}

export function semanticErrors(rule: Rule): string[] {
  const errors: string[] = [];
  if (rule.message.length < 8 || rule.explanation.length < 8 || rule.suggestion.length < 8) {
    errors.push(`Rule ${rule.id} needs a message, explanation, and suggestion of at least 8 characters.`);
  }
  const predicates = [...rule.when, rule.then];
  for (const predicate of predicates) {
    const unknown = valueFits(predicate.parameter, predicate.value);
    const operator = operatorFits(predicate.parameter, predicate.operator);
    if (!parameterByKey(predicate.parameter)) errors.push(`Rule ${rule.id} references unknown parameter "${predicate.parameter}".`);
    else {
      if (unknown) errors.push(`Rule ${rule.id}: ${unknown}`);
      if (operator) errors.push(`Rule ${rule.id}: ${operator}`);
    }
  }
  for (const fix of rule.fixes) {
    const spec = parameterByKey(fix.parameter);
    if (!spec) {
      errors.push(`Rule ${rule.id} fixes unknown parameter "${fix.parameter}".`);
      continue;
    }
    if (!spec.settable) {
      errors.push(`Rule ${rule.id} cannot fix derived parameter "${fix.parameter}".`);
      continue;
    }
    const invalid = valueFits(fix.parameter, fix.value);
    if (invalid) errors.push(`Rule ${rule.id}: ${invalid}`);
  }
  return errors;
}

export function compileRuleSource(source: string): { rules: Rule[]; errors: string[] } {
  const parsed = parseRules(source);
  const errors = [...parsed.errors];
  const rules: Rule[] = [];
  const seen = new Set<string>();
  for (const rule of parsed.rules) {
    if (seen.has(rule.id)) errors.push(`Duplicate rule id "${rule.id}".`);
    seen.add(rule.id);
    const semantic = semanticErrors(rule);
    if (semantic.length > 0) errors.push(...semantic);
    else rules.push(rule);
  }
  return { rules, errors };
}

const builtinCheck = compileRuleSource(BUILTIN_DSL);
if (builtinCheck.errors.length > 0) {
  throw new Error(`Built-in rules failed semantic checks:\n${builtinCheck.errors.join("\n")}`);
}

function predicateHolds(predicate: Predicate, context: Readonly<Record<string, RuleValue>>): boolean {
  const left = context[predicate.parameter];
  if (left === undefined) return false;
  return compare(left, predicate.operator, predicate.value);
}

function ruleApplies(rule: Rule, context: Readonly<Record<string, RuleValue>>): boolean {
  return rule.when.every((predicate) => predicateHolds(predicate, context));
}

function statusFor(errors: ValidationIssue[], warnings: ValidationIssue[]): ConfigStatus {
  if (errors.length > 0) {
    const count = errors.length + warnings.length;
    return {
      code: "invalid",
      label: "CONFIGURATION INVALID",
      detail: count === 1 ? "1 issue" : `${count} issues`,
    };
  }
  if (warnings.length > 0) {
    return {
      code: "warning",
      label: "VALID WITH WARNINGS",
      detail: warnings.length === 1 ? "1 warning" : `${warnings.length} warnings`,
    };
  }
  return {
    code: "ready",
    label: "READY TO QUOTE",
    detail: "Valid configuration",
  };
}

function rangeIssues(config: Configuration): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const spec of PARAMETERS) {
    if (!spec.settable || spec.kind === "enum" || spec.kind === "boolean") continue;
    const value = readParameter(config, spec.key);
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const below = spec.min !== undefined && value < spec.min;
    const above = spec.max !== undefined && value > spec.max;
    const fractional = spec.kind === "integer" && !Number.isInteger(value);
    if (!below && !above && !fractional) continue;

    let message = `${spec.label} must be a whole number.`;
    let explanation = "This parameter only accepts whole numbers.";
    let suggestion = "Enter a whole number inside the allowed range.";
    let limitLabel = "Required";
    let limit = "Whole number";
    let fixValue = Math.round(value);
    if (below && spec.min !== undefined) {
      message = `${spec.label} is ${formatParameterValue(spec.key, value)}, below the minimum of ${formatParameterValue(spec.key, spec.min)}.`;
      explanation = "The minimum is a limit of this product family, applied before structural rules.";
      suggestion = `Increase ${spec.label.toLowerCase()} to ${formatParameterValue(spec.key, spec.min)}.`;
      limitLabel = "Minimum";
      limit = formatParameterValue(spec.key, spec.min);
      fixValue = spec.min;
    } else if (above && spec.max !== undefined) {
      message = `${spec.label} is ${formatParameterValue(spec.key, value)}, above the maximum of ${formatParameterValue(spec.key, spec.max)}.`;
      explanation = "The maximum is a limit of this product family, applied before structural rules.";
      suggestion = `Reduce ${spec.label.toLowerCase()} to ${formatParameterValue(spec.key, spec.max)}.`;
      limitLabel = "Maximum";
      limit = formatParameterValue(spec.key, spec.max);
      fixValue = spec.max;
    }

    const severity: Severity = "error";
    issues.push({
      id: `parameter-range:${spec.key}`,
      ruleId: `parameter-range:${spec.key}`,
      severity,
      parameter: spec.key,
      parameterLabel: spec.label,
      message,
      explanation,
      suggestion,
      current: formatParameterValue(spec.key, value),
      limitLabel,
      limit,
      fixes: [
        {
          parameter: spec.key,
          value: fixValue,
          label: describeFix(spec.key, fixValue),
        },
      ],
      trace: {
        ruleId: `parameter-range:${spec.key}`,
        inputs: [{ parameter: spec.key, label: spec.label, value: formatParameterValue(spec.key, value) }],
        constraint: `${spec.label} between ${formatParameterValue(spec.key, spec.min ?? value)} and ${formatParameterValue(spec.key, spec.max ?? value)}`,
        result: "fail",
      },
    });
  }
  return issues;
}

/**
 * Evaluate a configuration against a rule list.
 * Range checks run first, then every rule. Nothing short-circuits:
 * the caller needs every simultaneous violation.
 * Price is always calculated, including when the configuration is invalid.
 */
export function evaluate(config: Configuration, rules: readonly Rule[] = builtinRules): EvaluationResult {
  const derived = derive(config);
  const context = buildContext(config, derived);
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const engagedRuleIds: string[] = [];

  for (const issue of rangeIssues(config)) {
    errors.push(issue);
  }

  for (const rule of rules) {
    if (!ruleApplies(rule, context)) continue;
    engagedRuleIds.push(rule.id);
    if (predicateHolds(rule.then, context)) continue;
    const issue = issueFromRule(rule, context);
    if (issue.severity === "warning") warnings.push(issue);
    else errors.push(issue);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    engagedRuleIds,
    derived,
    price: priceConfiguration(config, derived),
    status: statusFor(errors, warnings),
  };
}

export function formatRuleList(rules: readonly Rule[]): string {
  return rules.map(formatRule).join("\n\n");
}

export function parameterCount(): number {
  return PARAMETERS.length;
}

export function ruleById(rules: readonly Rule[], id: string): Rule | undefined {
  return rules.find((rule) => rule.id === id);
}
