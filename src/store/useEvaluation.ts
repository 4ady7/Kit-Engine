import { useMemo } from "react";
import { builtinRules, evaluate } from "../engine/ruleEngine.ts";
import type { EvaluationResult } from "../engine/types.ts";
import { useConfigurationStore } from "./configurationStore.ts";

export function useEvaluation(): EvaluationResult {
  const config = useConfigurationStore((state) => state.config);
  const customRules = useConfigurationStore((state) => state.customRules);
  return useMemo(
    () => evaluate(config, [...builtinRules, ...customRules]),
    [config, customRules],
  );
}
