import type { Configuration, DerivedValues } from "./types.ts";

/**
 * Clearances used to place shelves inside the upright.
 * Kept in one place so the rule `shelfPitchMm` and the 3D layout cannot drift.
 */
export const SHELF_CLEARANCE_MM = {
  bottom: 180,
  top: 40,
} as const;

export function shelfSpanMm(overallHeight: number): number {
  return overallHeight - SHELF_CLEARANCE_MM.bottom - SHELF_CLEARANCE_MM.top;
}

export function shelfPitchMm(overallHeight: number, shelfCount: number): number {
  const span = shelfSpanMm(overallHeight);
  if (shelfCount <= 1) return span;
  return span / (shelfCount - 1);
}

export function derive(config: Configuration): DerivedValues {
  const shelfAreaM2 = (config.bayWidth / 1000) * (config.shelfDepth / 1000);
  const shelvesTotal = config.bayCount * config.shelfCount;
  return {
    totalWidthMm: config.bayCount * config.bayWidth,
    totalDepthMm: config.shelfDepth,
    totalHeightMm: config.overallHeight,
    frameCount: config.bayCount + 1,
    shelfPitchMm: shelfPitchMm(config.overallHeight, config.shelfCount),
    shelvesTotal,
    shelfAreaM2,
    totalShelfAreaM2: shelfAreaM2 * shelvesTotal,
  };
}
