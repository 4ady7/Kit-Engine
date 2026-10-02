import type { Operator, Predicate, Rule, RuleFix, RuleValue, Severity } from "./types.ts";

export interface ParseResult {
  rules: Rule[];
  errors: string[];
}

interface Draft {
  broken: boolean;
  id: string;
  severity: Severity;
  line: number;
  when: Predicate[];
  then: Predicate | null;
  message: string | null;
  explanation: string | null;
  suggestion: string | null;
  fixes: RuleFix[];
}

const PREDICATE_PATTERN = /^([A-Za-z][A-Za-z0-9]*)\s*(<=|>=|==|!=|<|>)\s*(.+)$/;

export function parseValue(text: string): RuleValue | undefined {
  if (text === "true") return true;
  if (text === "false") return false;
  if (text.length >= 2 && text.startsWith("\"") && text.endsWith("\"")) {
    const inner = text.slice(1, -1);
    if (inner.includes("\"")) return undefined;
    return inner;
  }
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  return undefined;
}

export function formatLiteral(value: RuleValue): string {
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

export function formatPredicate(predicate: Predicate): string {
  return `${predicate.parameter} ${predicate.operator} ${formatLiteral(predicate.value)}`;
}

export function parsePredicate(text: string): Predicate | null {
  const match = PREDICATE_PATTERN.exec(text.trim());
  if (!match) return null;
  const parameter = match[1];
  const operator = match[2] as Operator;
  const rawValue = match[3];
  if (!parameter || !operator || rawValue === undefined) return null;
  const value = parseValue(rawValue.trim());
  if (value === undefined) return null;
  return { parameter, operator, value };
}

function emptyDraft(line: number): Draft {
  return {
    broken: true,
    id: "",
    severity: "error",
    line,
    when: [],
    then: null,
    message: null,
    explanation: null,
    suggestion: null,
    fixes: [],
  };
}

function parseHeader(line: string, lineNumber: number): { draft: Draft; error?: string } {
  const match = /^RULE\s+([^\s]+)\s+(ERROR|WARNING)$/.exec(line);
  if (!match?.[1] || !match[2]) {
    return {
      draft: emptyDraft(lineNumber),
      error: `Line ${lineNumber}: a rule starts with RULE <id> ERROR|WARNING.`,
    };
  }
  const id = match[1];
  if (!/^[a-z][a-z0-9-]{2,48}$/.test(id)) {
    return {
      draft: emptyDraft(lineNumber),
      error: `Line ${lineNumber}: rule id "${id}" must be lowercase kebab-case, 3–49 characters.`,
    };
  }
  return {
    draft: {
      broken: false,
      id,
      severity: match[2] === "WARNING" ? "warning" : "error",
      line: lineNumber,
      when: [],
      then: null,
      message: null,
      explanation: null,
      suggestion: null,
      fixes: [],
    },
  };
}

function parseWhen(body: string, lineNumber: number, draft: Draft): string | null {
  if (draft.when.length > 0) return `Line ${lineNumber}: WHEN is already set on ${draft.id}.`;
  const parts = body.split(/\s+AND\s+/);
  if (parts.length > 4) return `Line ${lineNumber}: WHEN supports at most 4 conditions.`;
  const predicates: Predicate[] = [];
  for (const part of parts) {
    const predicate = parsePredicate(part);
    if (!predicate) return `Line ${lineNumber}: invalid condition "${part.trim()}".`;
    predicates.push(predicate);
  }
  draft.when = predicates;
  return null;
}

function parseThen(body: string, lineNumber: number, draft: Draft): string | null {
  if (draft.then) return `Line ${lineNumber}: THEN is already set on ${draft.id}.`;
  const predicate = parsePredicate(body);
  if (!predicate) return `Line ${lineNumber}: invalid constraint "${body.trim()}".`;
  draft.then = predicate;
  return null;
}

function parseQuoted(kind: string, body: string, lineNumber: number): { value: string } | { error: string } {
  const value = parseValue(body.trim());
  if (typeof value !== "string") {
    return { error: `Line ${lineNumber}: ${kind} must be a double-quoted string.` };
  }
  return { value };
}

function parseFix(body: string, lineNumber: number, draft: Draft): string | null {
  const match = /^([A-Za-z][A-Za-z0-9]*)\s*=\s*(.+)$/.exec(body.trim());
  if (!match?.[1] || match[2] === undefined) {
    return `Line ${lineNumber}: FIX must look like FIX parameter = value.`;
  }
  const value = parseValue(match[2].trim());
  if (value === undefined) return `Line ${lineNumber}: FIX has an invalid value.`;
  draft.fixes.push({ parameter: match[1], value });
  return null;
}

function parseClause(line: string, lineNumber: number, draft: Draft): string | null {
  if (line.startsWith("WHEN ")) return parseWhen(line.slice(5), lineNumber, draft);
  if (line.startsWith("THEN ")) return parseThen(line.slice(5), lineNumber, draft);
  if (line.startsWith("MESSAGE ")) {
    if (draft.message !== null) return `Line ${lineNumber}: MESSAGE is already set.`;
    const parsed = parseQuoted("MESSAGE", line.slice(8), lineNumber);
    if ("error" in parsed) return parsed.error;
    draft.message = parsed.value;
    return null;
  }
  if (line.startsWith("EXPLAIN ")) {
    if (draft.explanation !== null) return `Line ${lineNumber}: EXPLAIN is already set.`;
    const parsed = parseQuoted("EXPLAIN", line.slice(8), lineNumber);
    if ("error" in parsed) return parsed.error;
    draft.explanation = parsed.value;
    return null;
  }
  if (line.startsWith("SUGGEST ")) {
    if (draft.suggestion !== null) return `Line ${lineNumber}: SUGGEST is already set.`;
    const parsed = parseQuoted("SUGGEST", line.slice(8), lineNumber);
    if ("error" in parsed) return parsed.error;
    draft.suggestion = parsed.value;
    return null;
  }
  if (line.startsWith("FIX ")) return parseFix(line.slice(4), lineNumber, draft);
  return `Line ${lineNumber}: unrecognised clause. The grammar allows WHEN, THEN, MESSAGE, EXPLAIN, SUGGEST, and FIX.`;
}

function finish(draft: Draft | null, rules: Rule[], errors: string[]) {
  if (!draft || draft.broken) return;
  const missing: string[] = [];
  if (!draft.then) missing.push("THEN");
  if (draft.message === null) missing.push("MESSAGE");
  if (draft.explanation === null) missing.push("EXPLAIN");
  if (draft.suggestion === null) missing.push("SUGGEST");
  if (missing.length > 0 || !draft.then || draft.message === null || draft.explanation === null || draft.suggestion === null) {
    errors.push(`Line ${draft.line}: rule ${draft.id} is missing ${missing.join(", ")}.`);
    return;
  }
  rules.push({
    id: draft.id,
    severity: draft.severity,
    when: draft.when,
    then: draft.then,
    message: draft.message,
    explanation: draft.explanation,
    suggestion: draft.suggestion,
    fixes: draft.fixes,
    sourceLine: draft.line,
  });
}

/** Syntax parse only. Call `compileRuleSource` before a rule enters the engine. */
export function parseRules(source: string): ParseResult {
  const rules: Rule[] = [];
  const errors: string[] = [];
  let draft: Draft | null = null;
  const lines = source.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const line = (lines[index] ?? "").trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("RULE ")) {
      finish(draft, rules, errors);
      const header = parseHeader(line, lineNumber);
      draft = header.draft;
      if (header.error) errors.push(header.error);
      continue;
    }
    if (!draft) {
      errors.push(`Line ${lineNumber}: expected a RULE header.`);
      continue;
    }
    if (draft.broken) continue;
    const error = parseClause(line, lineNumber, draft);
    if (error) {
      errors.push(error);
      draft.broken = true;
    }
  }

  finish(draft, rules, errors);
  return { rules, errors };
}

export function formatRule(rule: Rule): string {
  const lines = [`RULE ${rule.id} ${rule.severity === "warning" ? "WARNING" : "ERROR"}`];
  if (rule.when.length > 0) {
    lines.push(`WHEN ${rule.when.map(formatPredicate).join(" AND ")}`);
  }
  lines.push(`THEN ${formatPredicate(rule.then)}`);
  lines.push(`MESSAGE "${rule.message}"`);
  lines.push(`EXPLAIN "${rule.explanation}"`);
  lines.push(`SUGGEST "${rule.suggestion}"`);
  for (const fix of rule.fixes) {
    lines.push(`FIX ${fix.parameter} = ${formatLiteral(fix.value)}`);
  }
  return lines.join("\n");
}
