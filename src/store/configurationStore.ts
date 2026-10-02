import { create } from "zustand";
import { formatRule } from "../engine/grammar.ts";
import { applyValue, cloneConfiguration, defaultConfiguration, sameConfiguration } from "../engine/parameters.ts";
import type { Preset } from "../engine/presets.ts";
import { builtinRules, compileRuleSource } from "../engine/ruleEngine.ts";
import type { Configuration, Rule, RuleValue } from "../engine/types.ts";

const HISTORY_LIMIT = 80;
const RULES_KEY = "kit-engine-rules-v1";

function loadLocalRules(): Rule[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(RULES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const rules: Rule[] = [];
    for (const entry of parsed) {
      if (typeof entry !== "string") continue;
      const compiled = compileRuleSource(entry);
      const rule = compiled.rules[0];
      if (compiled.errors.length === 0 && compiled.rules.length === 1 && rule) rules.push(rule);
    }
    return rules;
  } catch {
    return [];
  }
}

function saveLocalRules(rules: readonly Rule[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(RULES_KEY, JSON.stringify(rules.map((rule) => formatRule(rule))));
}

function signature(config: Configuration, title: string): string {
  return JSON.stringify({ title, parameters: config });
}

interface ConfigurationState {
  config: Configuration;
  past: Configuration[];
  future: Configuration[];
  gestureBase: Configuration | null;
  customRules: Rule[];
  configurationId: string | null;
  title: string;
  savedSignature: string | null;
  beginGesture: () => void;
  endGesture: () => void;
  setParameter: (key: string, value: RuleValue, mode: "live" | "commit") => void;
  undo: () => void;
  redo: () => void;
  applyPreset: (preset: Preset) => void;
  replaceConfiguration: (config: Configuration, meta: { id: string | null; title: string }) => void;
  setTitle: (title: string) => void;
  markSaved: (id: string) => void;
  setCustomRules: (rules: Rule[]) => void;
  addCustomRule: (rule: Rule) => boolean;
  removeCustomRule: (id: string) => void;
}

export const useConfigurationStore = create<ConfigurationState>((set, get) => {
  const pushHistory = (snapshot: Configuration) =>
    [...get().past, cloneConfiguration(snapshot)].slice(-HISTORY_LIMIT);

  return {
    config: cloneConfiguration(defaultConfiguration),
    past: [],
    future: [],
    gestureBase: null,
    customRules: loadLocalRules(),
    configurationId: null,
    title: "Standard warehouse",
    savedSignature: null,

    beginGesture: () => {
      if (get().gestureBase) return;
      set({ gestureBase: cloneConfiguration(get().config) });
    },

    endGesture: () => {
      const base = get().gestureBase;
      if (!base) return;
      if (sameConfiguration(base, get().config)) {
        set({ gestureBase: null });
        return;
      }
      set({ gestureBase: null, past: pushHistory(base), future: [] });
    },

    setParameter: (key, value, mode) => {
      const next = applyValue(get().config, key, value);
      if (!next || sameConfiguration(next, get().config)) return;
      if (mode === "live" && get().gestureBase) {
        set({ config: next });
        return;
      }
      set({
        config: next,
        past: pushHistory(get().config),
        future: [],
        gestureBase: null,
      });
    },

    undo: () => {
      const { gestureBase, past, future, config } = get();
      if (gestureBase) {
        set({ config: cloneConfiguration(gestureBase), gestureBase: null });
        return;
      }
      const previous = past.at(-1);
      if (!previous) return;
      set({
        config: cloneConfiguration(previous),
        past: past.slice(0, -1),
        future: [cloneConfiguration(config), ...future].slice(0, HISTORY_LIMIT),
      });
    },

    redo: () => {
      const { future, config, gestureBase } = get();
      if (gestureBase) return;
      const next = future[0];
      if (!next) return;
      set({
        config: cloneConfiguration(next),
        future: future.slice(1),
        past: pushHistory(config),
      });
    },

    applyPreset: (preset) => {
      const { config, gestureBase, past, title } = get();
      const snapshot = gestureBase ?? config;
      if (!gestureBase && sameConfiguration(config, preset.configuration) && title === preset.name) return;
      set({
        config: cloneConfiguration(preset.configuration),
        title: preset.name,
        past: [...past, cloneConfiguration(snapshot)].slice(-HISTORY_LIMIT),
        future: [],
        gestureBase: null,
      });
    },

    replaceConfiguration: (config, meta) => {
      set({
        config: cloneConfiguration(config),
        title: meta.title,
        configurationId: meta.id,
        savedSignature: meta.id ? signature(config, meta.title) : null,
        past: [],
        future: [],
        gestureBase: null,
      });
    },

    setTitle: (title) => set({ title: title.slice(0, 80) }),

    markSaved: (id) => {
      const { config, title } = get();
      set({ configurationId: id, savedSignature: signature(config, title) });
    },

    setCustomRules: (rules) => {
      saveLocalRules(rules);
      set({ customRules: rules });
    },

    addCustomRule: (rule) => {
      const taken = builtinRules.some((item) => item.id === rule.id) || get().customRules.some((item) => item.id === rule.id);
      if (taken) return false;
      const customRules = [...get().customRules, rule];
      saveLocalRules(customRules);
      set({ customRules });
      return true;
    },

    removeCustomRule: (id) => {
      const customRules = get().customRules.filter((rule) => rule.id !== id);
      saveLocalRules(customRules);
      set({ customRules });
    },
  };
});

export function selectDirty(state: {
  config: Configuration;
  title: string;
  savedSignature: string | null;
}): boolean {
  return signature(state.config, state.title) !== state.savedSignature;
}

export function selectCanUndo(state: { past: Configuration[]; gestureBase: Configuration | null }): boolean {
  return state.past.length > 0 || state.gestureBase !== null;
}
