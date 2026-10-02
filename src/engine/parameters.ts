import type { Configuration, RuleValue } from "./types.ts";

export interface ParameterOption {
  value: string;
  label: string;
}

export interface ParameterSpec {
  key: string;
  label: string;
  description: string;
  group: "Structure" | "Materials" | "Duty" | "Accessories" | "Derived";
  kind: "integer" | "number" | "enum" | "boolean";
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: readonly ParameterOption[];
  /** False for values the engine calculates. Rules may read them, but fixes cannot write them. */
  settable: boolean;
}

export const PARAMETERS: readonly ParameterSpec[] = [
  {
    key: "bayCount",
    label: "Bay count",
    description: "Number of storage bays in the run. Each bay adds a pair of beams and a set of shelves.",
    group: "Structure",
    kind: "integer",
    min: 1,
    max: 8,
    step: 1,
    settable: true,
  },
  {
    key: "bayWidth",
    label: "Bay width",
    description: "Clear span between upright frames. Steel frames are further limited by a structural rule.",
    group: "Structure",
    kind: "integer",
    unit: "mm",
    min: 600,
    max: 2400,
    step: 10,
    settable: true,
  },
  {
    key: "shelfDepth",
    label: "Shelf depth",
    description: "Front-to-back depth of each shelf. Deeper shelves increase the moment on the frame.",
    group: "Structure",
    kind: "integer",
    unit: "mm",
    min: 300,
    max: 1200,
    step: 10,
    settable: true,
  },
  {
    key: "overallHeight",
    label: "Overall height",
    description: "Height of the uprights from the floor to the top of the frame.",
    group: "Structure",
    kind: "integer",
    unit: "mm",
    min: 1000,
    max: 4000,
    step: 10,
    settable: true,
  },
  {
    key: "shelfCount",
    label: "Shelf count",
    description: "Shelves in each bay, including the lowest level. Spacing is derived from the frame height.",
    group: "Structure",
    kind: "integer",
    min: 2,
    max: 12,
    step: 1,
    settable: true,
  },
  {
    key: "frameMaterial",
    label: "Frame material",
    description: "Upright and beam stock. Reinforced steel allows a longer bay span.",
    group: "Materials",
    kind: "enum",
    options: [
      { value: "steel", label: "Steel" },
      { value: "reinforced-steel", label: "Reinforced steel" },
    ],
    settable: true,
  },
  {
    key: "shelfMaterial",
    label: "Shelf material",
    description: "Decking on each level. Timber is lighter but spans and loads are more restricted.",
    group: "Materials",
    kind: "enum",
    options: [
      { value: "steel", label: "Steel" },
      { value: "timber", label: "Timber" },
    ],
    settable: true,
  },
  {
    key: "loadRating",
    label: "Load rating",
    description: "Uniformly distributed load allowed on each shelf level.",
    group: "Duty",
    kind: "integer",
    unit: "kg",
    min: 100,
    max: 1000,
    step: 10,
    settable: true,
  },
  {
    key: "bracing",
    label: "Bracing",
    description: "Rear bracing that resists racking. Several rules require heavy-duty bracing.",
    group: "Duty",
    kind: "enum",
    options: [
      { value: "standard", label: "Standard" },
      { value: "heavy-duty", label: "Heavy duty" },
    ],
    settable: true,
  },
  {
    key: "endGuard",
    label: "End guards",
    description: "Protective plates on both ends of the run.",
    group: "Accessories",
    kind: "boolean",
    settable: true,
  },
  {
    key: "labelRail",
    label: "Label rails",
    description: "Front rail on every shelf for location labels.",
    group: "Accessories",
    kind: "boolean",
    settable: true,
  },
  {
    key: "safetyBack",
    label: "Safety back",
    description: "Rear mesh that stops goods passing through the frame.",
    group: "Accessories",
    kind: "boolean",
    settable: true,
  },
  {
    key: "shelfPitchMm",
    label: "Shelf pitch",
    description: "Vertical distance between shelf surfaces, calculated from height and shelf count.",
    group: "Derived",
    kind: "number",
    unit: "mm",
    settable: false,
  },
];

const BY_KEY = new Map(PARAMETERS.map((parameter) => [parameter.key, parameter]));

export function parameterByKey(key: string): ParameterSpec | undefined {
  return BY_KEY.get(key);
}

export function settableParameters(): ParameterSpec[] {
  return PARAMETERS.filter((parameter) => parameter.settable);
}

export const defaultConfiguration: Configuration = {
  bayCount: 4,
  bayWidth: 1200,
  shelfDepth: 600,
  overallHeight: 2400,
  shelfCount: 5,
  frameMaterial: "steel",
  shelfMaterial: "steel",
  loadRating: 400,
  bracing: "standard",
  accessories: {
    endGuard: true,
    labelRail: false,
    safetyBack: false,
  },
};

export function cloneConfiguration(config: Configuration): Configuration {
  return {
    ...config,
    accessories: { ...config.accessories },
  };
}

export function readParameter(config: Configuration, key: string): RuleValue | undefined {
  switch (key) {
    case "bayCount":
      return config.bayCount;
    case "bayWidth":
      return config.bayWidth;
    case "shelfDepth":
      return config.shelfDepth;
    case "overallHeight":
      return config.overallHeight;
    case "shelfCount":
      return config.shelfCount;
    case "frameMaterial":
      return config.frameMaterial;
    case "shelfMaterial":
      return config.shelfMaterial;
    case "loadRating":
      return config.loadRating;
    case "bracing":
      return config.bracing;
    case "endGuard":
      return config.accessories.endGuard;
    case "labelRail":
      return config.accessories.labelRail;
    case "safetyBack":
      return config.accessories.safetyBack;
    default:
      return undefined;
  }
}

export function applyValue(config: Configuration, key: string, value: RuleValue): Configuration | null {
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  const next = cloneConfiguration(config);
  switch (key) {
    case "bayCount":
      return typeof value === "number" ? { ...next, bayCount: value } : null;
    case "bayWidth":
      return typeof value === "number" ? { ...next, bayWidth: value } : null;
    case "shelfDepth":
      return typeof value === "number" ? { ...next, shelfDepth: value } : null;
    case "overallHeight":
      return typeof value === "number" ? { ...next, overallHeight: value } : null;
    case "shelfCount":
      return typeof value === "number" ? { ...next, shelfCount: value } : null;
    case "frameMaterial":
      return value === "steel" || value === "reinforced-steel" ? { ...next, frameMaterial: value } : null;
    case "shelfMaterial":
      return value === "steel" || value === "timber" ? { ...next, shelfMaterial: value } : null;
    case "loadRating":
      return typeof value === "number" ? { ...next, loadRating: value } : null;
    case "bracing":
      return value === "standard" || value === "heavy-duty" ? { ...next, bracing: value } : null;
    case "endGuard":
      return typeof value === "boolean"
        ? { ...next, accessories: { ...next.accessories, endGuard: value } }
        : null;
    case "labelRail":
      return typeof value === "boolean"
        ? { ...next, accessories: { ...next.accessories, labelRail: value } }
        : null;
    case "safetyBack":
      return typeof value === "boolean"
        ? { ...next, accessories: { ...next.accessories, safetyBack: value } }
        : null;
    default:
      return null;
  }
}

export function sameConfiguration(a: Configuration, b: Configuration): boolean {
  return (
    a.bayCount === b.bayCount &&
    a.bayWidth === b.bayWidth &&
    a.shelfDepth === b.shelfDepth &&
    a.overallHeight === b.overallHeight &&
    a.shelfCount === b.shelfCount &&
    a.frameMaterial === b.frameMaterial &&
    a.shelfMaterial === b.shelfMaterial &&
    a.loadRating === b.loadRating &&
    a.bracing === b.bracing &&
    a.accessories.endGuard === b.accessories.endGuard &&
    a.accessories.labelRail === b.accessories.labelRail &&
    a.accessories.safetyBack === b.accessories.safetyBack
  );
}
