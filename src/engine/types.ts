export const CONFIGURATION_VERSION = 1 as const;

export type FrameMaterial = "steel" | "reinforced-steel";
export type ShelfMaterial = "steel" | "timber";
export type Bracing = "standard" | "heavy-duty";

export interface Accessories {
  endGuard: boolean;
  labelRail: boolean;
  safetyBack: boolean;
}

/**
 * Every value the user can change. Accessories stay grouped because they are
 * optional add-ons, not structural dimensions. Rules address them by flat names
 * (`safetyBack`) through the evaluation context.
 */
export interface Configuration {
  bayCount: number;
  bayWidth: number;
  shelfDepth: number;
  overallHeight: number;
  shelfCount: number;
  frameMaterial: FrameMaterial;
  shelfMaterial: ShelfMaterial;
  loadRating: number;
  bracing: Bracing;
  accessories: Accessories;
}

export type Operator = "==" | "!=" | "<" | "<=" | ">" | ">=";
export type Severity = "error" | "warning";
export type RuleValue = number | string | boolean;

export interface Predicate {
  parameter: string;
  operator: Operator;
  value: RuleValue;
}

export interface RuleFix {
  parameter: string;
  value: RuleValue;
}

export interface Rule {
  id: string;
  severity: Severity;
  when: Predicate[];
  then: Predicate;
  message: string;
  explanation: string;
  suggestion: string;
  fixes: RuleFix[];
  sourceLine: number;
}

export interface IssueFix {
  parameter: string;
  value: RuleValue;
  label: string;
}

export interface IssueTraceInput {
  parameter: string;
  label: string;
  value: string;
}

export interface IssueTrace {
  ruleId: string;
  inputs: IssueTraceInput[];
  constraint: string;
  result: "fail";
}

export interface ValidationIssue {
  id: string;
  ruleId: string;
  severity: Severity;
  parameter: string;
  parameterLabel: string;
  message: string;
  explanation: string;
  suggestion: string;
  current: string;
  limitLabel: string;
  limit: string;
  fixes: IssueFix[];
  trace: IssueTrace;
}

export interface DerivedValues {
  totalWidthMm: number;
  totalDepthMm: number;
  totalHeightMm: number;
  frameCount: number;
  shelfPitchMm: number;
  shelvesTotal: number;
  shelfAreaM2: number;
  totalShelfAreaM2: number;
}

export interface PriceLine {
  id: string;
  label: string;
  amount: number;
}

export interface PriceBreakdown {
  currency: "GBP";
  lines: PriceLine[];
  total: number;
}

export interface ConfigStatus {
  code: "ready" | "warning" | "invalid";
  label: string;
  detail: string;
}

export interface EvaluationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  /** Rules whose WHEN clause matches the current configuration. */
  engagedRuleIds: string[];
  derived: DerivedValues;
  price: PriceBreakdown;
  status: ConfigStatus;
}

export interface ConfigurationDocument {
  version: typeof CONFIGURATION_VERSION;
  title?: string;
  parameters: Configuration;
}
