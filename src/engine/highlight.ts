import type { ValidationIssue } from "./types.ts";

export type HighlightPart = "upright" | "beam" | "shelf" | "brace" | "back" | "guard" | "rail";

const PARTS: Record<string, readonly HighlightPart[]> = {
  bayWidth: ["beam", "shelf"],
  shelfDepth: ["shelf"],
  overallHeight: ["upright"],
  shelfCount: ["shelf"],
  shelfPitchMm: ["shelf"],
  frameMaterial: ["upright", "beam"],
  shelfMaterial: ["shelf"],
  loadRating: ["brace", "shelf"],
  bracing: ["brace"],
  bayCount: ["upright", "shelf"],
  safetyBack: ["back"],
  endGuard: ["guard"],
  labelRail: ["rail"],
};

export function highlightedParts(issues: readonly ValidationIssue[]): Set<HighlightPart> {
  const parts = new Set<HighlightPart>();
  for (const issue of issues) {
    for (const part of PARTS[issue.parameter] ?? []) parts.add(part);
  }
  return parts;
}
