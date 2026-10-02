import { formatPredicate } from "../../engine/grammar.ts";
import { parameterLabel } from "../../engine/format.ts";
import type { Rule } from "../../engine/types.ts";

interface RuleGraphProps {
  rules: readonly Rule[];
  engagedIds: readonly string[];
  failedIds: readonly string[];
}

export function RuleGraph({ rules, engagedIds, failedIds }: RuleGraphProps) {
  const engaged = new Set(engagedIds);
  const failed = new Set(failedIds);
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[1fr_16px_1fr_16px_auto] gap-2 font-mono text-[10px] tracking-wide text-muted uppercase">
        <span>Input</span>
        <span />
        <span>Constraint</span>
        <span />
        <span>Result</span>
      </div>
      <ul className="flex flex-col gap-2">
        {rules.map((rule) => {
          const state = failed.has(rule.id) ? "fail" : engaged.has(rule.id) ? "pass" : "idle";
          const row =
            state === "fail" ? "border-bad bg-bad-soft" : state === "pass" ? "border-ok bg-ok-soft" : "border-line bg-white";
          return (
            <li key={rule.id} className={`grid grid-cols-[1fr_16px_1fr_16px_auto] items-center gap-2 border px-2 py-2 text-[12px] ${row}`}>
              <span>{rule.when.length > 0 ? rule.when.map((item) => parameterLabel(item.parameter)).join(" + ") : "Always"}</span>
              <span aria-hidden="true" className="text-center text-muted">→</span>
              <span>{formatPredicate(rule.then)}</span>
              <span aria-hidden="true" className="text-center text-muted">→</span>
              <span className="font-mono text-[10px] tracking-wide uppercase">
                {state === "fail" ? rule.severity : state === "pass" ? "Pass" : "Idle"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
