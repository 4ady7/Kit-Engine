import type { Configuration, DerivedValues, PriceBreakdown, PriceLine } from "./types.ts";

/**
 * Deterministic price model. Amounts are whole pounds.
 *
 * Base system is a fixed engineering charge.
 * Frames scale with upright count and height. Reinforced stock uses a higher rate.
 * Beams scale with shelf levels and bay span.
 * Shelves scale with deck area. Steel decking costs more than timber.
 * Load rating adds a surcharge above 300 kg, per bay.
 * Bracing is per bay, with a height factor above 2.5 m.
 * Accessories are flat or proportional as named on the line.
 */
const BASE_SYSTEM = 480;
const UPRIGHT_RATE = { steel: 46, "reinforced-steel": 68 } as const;
const BEAM_RATE_PER_METRE = 16;
const SHELF_RATE_PER_M2 = { steel: 92, timber: 70 } as const;
const LOAD_STEP_GBP = 28;
const BRACE_RATE = { standard: 32, "heavy-duty": 74 } as const;
const END_GUARD = 90;
const LABEL_RAIL_EACH = 8;
const SAFETY_BACK_PER_BAY_METRE = 36;

function pounds(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

export function priceConfiguration(config: Configuration, derived: DerivedValues): PriceBreakdown {
  const lines: PriceLine[] = [{ id: "base", label: "Base system", amount: BASE_SYSTEM }];

  lines.push({
    id: "frames",
    label: config.frameMaterial === "steel" ? "Steel frames" : "Reinforced frames",
    amount: pounds(derived.frameCount * (config.overallHeight / 1000) * UPRIGHT_RATE[config.frameMaterial]),
  });

  lines.push({
    id: "beams",
    label: "Beams",
    amount: pounds(derived.shelvesTotal * (config.bayWidth / 1000) * BEAM_RATE_PER_METRE),
  });

  lines.push({
    id: "shelves",
    label: config.shelfMaterial === "steel" ? "Steel shelves" : "Timber shelves",
    amount: pounds(derived.totalShelfAreaM2 * SHELF_RATE_PER_M2[config.shelfMaterial]),
  });

  const loadSteps = Math.max(0, config.loadRating - 300) / 100;
  const loadAmount = pounds(loadSteps * LOAD_STEP_GBP * config.bayCount);
  if (loadAmount > 0) {
    lines.push({ id: "load", label: "Load rating", amount: loadAmount });
  }

  const heightFactor = config.overallHeight > 2500 ? 1.15 : 1;
  lines.push({
    id: "bracing",
    label: config.bracing === "standard" ? "Standard bracing" : "Heavy-duty bracing",
    amount: pounds(config.bayCount * BRACE_RATE[config.bracing] * heightFactor),
  });

  if (config.accessories.endGuard) {
    lines.push({ id: "endGuard", label: "End guards", amount: END_GUARD });
  }
  if (config.accessories.labelRail) {
    lines.push({
      id: "labelRail",
      label: "Label rails",
      amount: LABEL_RAIL_EACH * derived.shelvesTotal,
    });
  }
  if (config.accessories.safetyBack) {
    lines.push({
      id: "safetyBack",
      label: "Safety back",
      amount: pounds(config.bayCount * (config.overallHeight / 1000) * SAFETY_BACK_PER_BAY_METRE),
    });
  }

  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  return { currency: "GBP", lines, total };
}
