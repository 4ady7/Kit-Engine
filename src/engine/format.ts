import { parameterByKey } from "./parameters.ts";
import type { RuleValue } from "./types.ts";

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export function formatGbp(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatParameterValue(parameter: string, value: RuleValue): string {
  const spec = parameterByKey(parameter);
  if (typeof value === "boolean") {
    if (spec?.kind === "boolean") return value ? "On" : "Off";
    return value ? "true" : "false";
  }
  if (typeof value === "string") {
    const option = spec?.options?.find((item) => item.value === value);
    return option?.label ?? value;
  }
  const digits = Number.isInteger(value) ? 0 : 1;
  const rendered = formatNumber(value, digits);
  return spec?.unit ? `${rendered} ${spec.unit}` : rendered;
}

export function parameterLabel(parameter: string): string {
  return parameterByKey(parameter)?.label ?? parameter;
}

export function describeFix(parameter: string, value: RuleValue): string {
  const name = parameterLabel(parameter).toLowerCase();
  if (typeof value === "boolean") {
    return value ? `Enable ${name}` : `Disable ${name}`;
  }
  return `Set ${parameterLabel(parameter).toLowerCase()} to ${formatParameterValue(parameter, value)}`;
}
