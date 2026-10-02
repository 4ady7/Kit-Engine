import { formatGbp, formatNumber, formatParameterValue } from "./format.ts";
import type { Configuration, EvaluationResult } from "./types.ts";

export interface SpecificationRow {
  label: string;
  value: string;
}

export interface SpecificationModel {
  title: string;
  idLabel: string;
  dateLabel: string;
  statusLabel: string;
  statusDetail: string;
  statusCode: EvaluationResult["status"]["code"];
  ready: boolean;
  dimensions: SpecificationRow[];
  configuration: SpecificationRow[];
  accessories: string[];
  issues: Array<{ severity: "error" | "warning"; message: string }>;
  priceLines: Array<{ label: string; amount: string }>;
  total: string;
}

export function displayConfigurationId(id: string | null): string {
  return id ? `KE-${id}` : "Not saved";
}

export function buildSpecification(input: {
  id: string | null;
  title: string;
  config: Configuration;
  evaluation: EvaluationResult;
  generatedAt: Date;
}): SpecificationModel {
  const { config, evaluation } = input;
  const accessories: string[] = [];
  if (config.accessories.endGuard) accessories.push("End guards");
  if (config.accessories.labelRail) accessories.push("Label rails");
  if (config.accessories.safetyBack) accessories.push("Safety back");
  if (accessories.length === 0) accessories.push("None");

  const issues = [
    ...evaluation.errors.map((issue) => ({ severity: "error" as const, message: issue.message })),
    ...evaluation.warnings.map((issue) => ({ severity: "warning" as const, message: issue.message })),
  ];

  return {
    title: input.title,
    idLabel: displayConfigurationId(input.id),
    dateLabel: input.generatedAt.toLocaleDateString("en-GB", { dateStyle: "long" }),
    statusLabel: evaluation.status.label,
    statusDetail: evaluation.status.detail,
    statusCode: evaluation.status.code,
    ready: evaluation.valid,
    dimensions: [
      { label: "Width", value: `${formatNumber(evaluation.derived.totalWidthMm)} mm` },
      { label: "Depth", value: `${formatNumber(evaluation.derived.totalDepthMm)} mm` },
      { label: "Height", value: `${formatNumber(evaluation.derived.totalHeightMm)} mm` },
      { label: "Shelf pitch", value: `${formatNumber(evaluation.derived.shelfPitchMm, Number.isInteger(evaluation.derived.shelfPitchMm) ? 0 : 1)} mm` },
    ],
    configuration: [
      { label: "Bays", value: String(config.bayCount) },
      { label: "Bay width", value: formatParameterValue("bayWidth", config.bayWidth) },
      { label: "Shelves per bay", value: String(config.shelfCount) },
      { label: "Frame", value: formatParameterValue("frameMaterial", config.frameMaterial) },
      { label: "Shelving", value: formatParameterValue("shelfMaterial", config.shelfMaterial) },
      { label: "Load rating", value: formatParameterValue("loadRating", config.loadRating) },
      { label: "Bracing", value: formatParameterValue("bracing", config.bracing) },
    ],
    accessories,
    issues,
    priceLines: evaluation.price.lines.map((line) => ({ label: line.label, amount: formatGbp(line.amount) })),
    total: formatGbp(evaluation.price.total),
  };
}
