import { cloneConfiguration, defaultConfiguration } from "./parameters.ts";
import type { Configuration } from "./types.ts";

export interface Preset {
  id: string;
  name: string;
  description: string;
  intent: "valid" | "warning" | "invalid";
  configuration: Configuration;
}

function withConfig(overrides: Partial<Configuration> & { accessories?: Partial<Configuration["accessories"]> }): Configuration {
  return {
    ...cloneConfiguration(defaultConfiguration),
    ...overrides,
    accessories: {
      ...defaultConfiguration.accessories,
      ...overrides.accessories,
    },
  };
}

export const presets: readonly Preset[] = [
  {
    id: "standard",
    name: "Standard warehouse",
    description: "Four steel bays at 400 kg. A complete, quote-ready run.",
    intent: "valid",
    configuration: cloneConfiguration(defaultConfiguration),
  },
  {
    id: "heavy-duty",
    name: "Heavy duty",
    description: "Reinforced frames, deep shelves, 800 kg, heavy-duty bracing.",
    intent: "valid",
    configuration: withConfig({
      bayWidth: 1200,
      shelfDepth: 1000,
      overallHeight: 3000,
      shelfCount: 4,
      frameMaterial: "reinforced-steel",
      shelfMaterial: "steel",
      loadRating: 800,
      bracing: "heavy-duty",
      accessories: { endGuard: true, labelRail: false, safetyBack: true },
    }),
  },
  {
    id: "compact",
    name: "Compact storage",
    description: "A short, shallow run for small parts.",
    intent: "valid",
    configuration: withConfig({
      bayCount: 3,
      bayWidth: 900,
      shelfDepth: 400,
      overallHeight: 1800,
      shelfCount: 4,
      loadRating: 250,
      bracing: "standard",
      accessories: { endGuard: false, labelRail: true, safetyBack: false },
    }),
  },
  {
    id: "high-bay",
    name: "High bay",
    description: "3.8 m frames. Heavy-duty bracing is mandatory at this height.",
    intent: "valid",
    configuration: withConfig({
      bayCount: 5,
      bayWidth: 1200,
      shelfDepth: 800,
      overallHeight: 3800,
      shelfCount: 7,
      frameMaterial: "reinforced-steel",
      loadRating: 500,
      bracing: "heavy-duty",
      accessories: { endGuard: true, labelRail: false, safetyBack: true },
    }),
  },
  {
    id: "retail",
    name: "Retail shelving",
    description: "Timber decks and label rails. The span is wide enough to raise a sag warning.",
    intent: "warning",
    configuration: withConfig({
      bayCount: 4,
      bayWidth: 1600,
      shelfDepth: 400,
      overallHeight: 2100,
      shelfCount: 5,
      frameMaterial: "steel",
      shelfMaterial: "timber",
      loadRating: 200,
      bracing: "standard",
      accessories: { endGuard: false, labelRail: true, safetyBack: false },
    }),
  },
  {
    id: "steel-overspan",
    name: "Steel overspan",
    description: "Standard steel with a 2200 mm bay. The span rule should fail.",
    intent: "invalid",
    configuration: withConfig({ bayWidth: 2200, frameMaterial: "steel" }),
  },
  {
    id: "overloaded",
    name: "High load, standard brace",
    description: "800 kg on standard bracing.",
    intent: "invalid",
    configuration: withConfig({ loadRating: 800, bracing: "standard" }),
  },
  {
    id: "tall-standard",
    name: "Tall frame, standard brace",
    description: "3.8 m height without heavy-duty bracing.",
    intent: "invalid",
    configuration: withConfig({ overallHeight: 3800, bracing: "standard", shelfCount: 6 }),
  },
  {
    id: "deep-bay",
    name: "Deep shelf, standard brace",
    description: "1100 mm depth on standard bracing.",
    intent: "invalid",
    configuration: withConfig({ shelfDepth: 1100, bracing: "standard" }),
  },
  {
    id: "multiple-issues",
    name: "Multiple issues",
    description: "Several structural rules fail at once, plus a safety-back warning.",
    intent: "invalid",
    configuration: withConfig({
      bayCount: 6,
      bayWidth: 2200,
      shelfDepth: 1000,
      overallHeight: 3600,
      shelfCount: 8,
      frameMaterial: "steel",
      shelfMaterial: "steel",
      loadRating: 800,
      bracing: "standard",
      accessories: { endGuard: false, labelRail: false, safetyBack: false },
    }),
  },
];

export function presetById(id: string): Preset | undefined {
  return presets.find((preset) => preset.id === id);
}
