import type { Configuration } from "./types.ts";
import { SHELF_CLEARANCE_MM, shelfPitchMm } from "./derivedValues.ts";

export interface UprightLayout {
  id: string;
  x: number;
  z: number;
  height: number;
  section: number;
}

export interface BeamLayout {
  id: string;
  x: number;
  y: number;
  z: number;
  length: number;
  height: number;
  depth: number;
}

export interface ShelfLayout {
  id: string;
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  thickness: number;
}

export interface BraceLayout {
  id: string;
  x: number;
  y: number;
  z: number;
  length: number;
  angle: number;
  thickness: number;
}

export interface PlateLayout {
  id: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
}

export interface SystemLayout {
  width: number;
  depth: number;
  height: number;
  uprights: UprightLayout[];
  beams: BeamLayout[];
  shelves: ShelfLayout[];
  braces: BraceLayout[];
  endGuards: PlateLayout[];
  labelRails: PlateLayout[];
  safetyBacks: PlateLayout[];
}

const POST = { steel: 0.055, reinforced: 0.078 };
const SHELF_THICKNESS = { steel: 0.028, timber: 0.042 };
const BEAM_HEIGHT = 0.05;
const BEAM_DEPTH = 0.04;
const BRACE = { standard: 0.012, heavy: 0.026 };

function visualInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function visualLength(valueMm: number, fallback: number): number {
  if (!Number.isFinite(valueMm)) return fallback;
  return Math.max(0.05, valueMm / 1000);
}

/**
 * Map a configuration to scene geometry in metres.
 * Counts follow the configuration. A hard cap only exists so a typed value
 * like 100000 cannot allocate unbounded meshes. Validation still reports the real number.
 */
export function buildLayout(config: Configuration): SystemLayout {
  const bayCount = visualInteger(config.bayCount, 1, 16);
  const shelfCount = visualInteger(config.shelfCount, 1, 24);
  const bayWidth = visualLength(config.bayWidth, 1.2);
  const depth = visualLength(config.shelfDepth, 0.6);
  const height = visualLength(config.overallHeight, 2.4);
  const section = config.frameMaterial === "reinforced-steel" ? POST.reinforced : POST.steel;
  const thickness = config.shelfMaterial === "timber" ? SHELF_THICKNESS.timber : SHELF_THICKNESS.steel;
  const braceThickness = config.bracing === "heavy-duty" ? BRACE.heavy : BRACE.standard;
  const width = bayCount * bayWidth;
  const origin = -width / 2;
  const clearWidth = Math.max(0.05, bayWidth - section);
  const shelfDepth = Math.max(0.05, depth - 0.04);
  const pitchM = shelfPitchMm(config.overallHeight, shelfCount) / 1000;
  const bottom = SHELF_CLEARANCE_MM.bottom / 1000;

  const uprights: UprightLayout[] = [];
  for (let frame = 0; frame <= bayCount; frame += 1) {
    const x = origin + frame * bayWidth;
    for (const z of [depth / 2, -depth / 2]) {
      uprights.push({
        id: `upright-${frame}-${z > 0 ? "front" : "back"}`,
        x,
        z,
        height,
        section,
      });
    }
  }

  const beams: BeamLayout[] = [];
  const shelves: ShelfLayout[] = [];
  const braces: BraceLayout[] = [];
  const labelRails: PlateLayout[] = [];
  const safetyBacks: PlateLayout[] = [];

  for (let bay = 0; bay < bayCount; bay += 1) {
    const x = origin + (bay + 0.5) * bayWidth;
    for (let level = 0; level < shelfCount; level += 1) {
      const surface = bottom + pitchM * level;
      const shelfY = surface - thickness / 2;
      shelves.push({
        id: `shelf-${bay}-${level}`,
        x,
        y: Math.max(thickness / 2, shelfY),
        z: 0,
        width: clearWidth,
        depth: shelfDepth,
        thickness,
      });
      const beamY = Math.max(BEAM_HEIGHT / 2, surface - thickness - BEAM_HEIGHT / 2);
      for (const side of ["front", "back"] as const) {
        beams.push({
          id: `beam-${bay}-${level}-${side}`,
          x,
          y: beamY,
          z: side === "front" ? depth / 2 - BEAM_DEPTH / 2 : -depth / 2 + BEAM_DEPTH / 2,
          length: clearWidth,
          height: BEAM_HEIGHT,
          depth: BEAM_DEPTH,
        });
      }
      if (config.accessories.labelRail) {
        labelRails.push({
          id: `rail-${bay}-${level}`,
          x,
          y: surface + 0.012,
          z: depth / 2 + 0.008,
          width: clearWidth,
          height: 0.024,
          depth: 0.012,
        });
      }
    }

    const diagonal = Math.hypot(bayWidth, height);
    const angle = Math.atan2(height, bayWidth);
    for (const [name, signed] of [
      ["up", 1],
      ["down", -1],
    ] as const) {
      braces.push({
        id: `brace-${bay}-${name}`,
        x,
        y: height / 2,
        z: -depth / 2 - 0.02,
        length: diagonal,
        angle: signed * angle,
        thickness: braceThickness,
      });
    }
    if (config.bracing === "heavy-duty") {
      braces.push({
        id: `brace-${bay}-mid`,
        x,
        y: height / 2,
        z: -depth / 2 - 0.02,
        length: clearWidth,
        angle: 0,
        thickness: braceThickness,
      });
    }

    if (config.accessories.safetyBack) {
      safetyBacks.push({
        id: `back-${bay}`,
        x,
        y: height / 2,
        z: -depth / 2 - 0.008,
        width: clearWidth,
        height: Math.max(0.2, height - 0.12),
        depth: 0.008,
      });
    }
  }

  const endGuards: PlateLayout[] = [];
  if (config.accessories.endGuard) {
    for (const side of [-1, 1] as const) {
      endGuards.push({
        id: `guard-${side > 0 ? "right" : "left"}`,
        x: side * (width / 2 + 0.03),
        y: height / 2,
        z: 0,
        width: 0.012,
        height: Math.max(0.2, height - 0.08),
        depth: Math.max(0.1, depth * 0.92),
      });
    }
  }

  return {
    width,
    depth,
    height,
    uprights,
    beams,
    shelves,
    braces,
    endGuards,
    labelRails,
    safetyBacks,
  };
}
