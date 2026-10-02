import { builtinRules, evaluate, parameterCount } from "./ruleEngine.ts";
import { defaultConfiguration } from "./parameters.ts";
import type { Configuration, Rule } from "./types.ts";

export interface BenchmarkResult {
  iterations: number;
  averageMs: number;
  maxMs: number;
  ruleCount: number;
  parameterCount: number;
}

export function benchmarkRules(
  config: Configuration = defaultConfiguration,
  rules: readonly Rule[] = builtinRules,
  iterations = 1000,
): BenchmarkResult {
  let maxMs = 0;
  const started = performance.now();
  for (let index = 0; index < iterations; index += 1) {
    const tick = performance.now();
    evaluate(config, rules);
    const elapsed = performance.now() - tick;
    if (elapsed > maxMs) maxMs = elapsed;
  }
  const total = performance.now() - started;
  return {
    iterations,
    averageMs: total / iterations,
    maxMs,
    ruleCount: rules.length,
    parameterCount: parameterCount(),
  };
}
