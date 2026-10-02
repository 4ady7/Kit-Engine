import { useState } from "react";
import { benchmarkRules } from "../../engine/benchmark.ts";
import type { BenchmarkResult } from "../../engine/benchmark.ts";
import type { EvaluationResult, Rule } from "../../engine/types.ts";
import type { SpecificationModel } from "../../engine/specification.ts";
import { PriceBreakdown } from "../pricing/PriceBreakdown.tsx";
import { RuleAuthor } from "../rule-authoring/RuleAuthor.tsx";
import { RuleGraph } from "../rule-authoring/RuleGraph.tsx";
import { SpecSummary } from "../specification/SpecSummary.tsx";
import { ValidationPanel } from "../validation/ValidationPanel.tsx";
import { useConfigurationStore } from "../../store/configurationStore.ts";

type Tab = "summary" | "checks" | "rules";

interface SummaryPanelProps {
  evaluation: EvaluationResult;
  specification: SpecificationModel;
  rules: readonly Rule[];
  exporting: boolean;
  onExport: () => void;
}

export function SummaryPanel({ evaluation, specification, rules, exporting, onExport }: SummaryPanelProps) {
  const [tab, setTab] = useState<Tab>("summary");
  const [benchmark, setBenchmark] = useState<BenchmarkResult | null>(null);
  const config = useConfigurationStore((state) => state.config);
  const issues = [...evaluation.errors, ...evaluation.warnings];
  const failedIds = issues.map((issue) => issue.ruleId);

  return (
    <aside className="panel-scroll border-line bg-panel lg:border-l" aria-label="Summary">
      <div className="flex border-b border-line" role="tablist" aria-label="Configuration details">
        {(
          [
            ["summary", "Summary"],
            ["checks", `Checks${issues.length ? ` (${issues.length})` : ""}`],
            ["rules", "Rules"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            className={tab === id ? "border-b-2 border-ink px-3 py-2 text-[13px]" : "px-3 py-2 text-[13px] text-muted"}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="px-4 py-4">
        {tab === "summary" ? (
          <div role="tabpanel" id="panel-summary" aria-labelledby="tab-summary" className="flex flex-col gap-6">
            <SpecSummary model={specification} />
            <PriceBreakdown price={evaluation.price} estimate={!evaluation.valid} />
            <button
              type="button"
              className="border border-ink px-3 py-2 text-[13px] disabled:opacity-50"
              disabled={exporting}
              onClick={onExport}
            >
              {exporting ? "Preparing PDF…" : "Download specification"}
            </button>
          </div>
        ) : null}
        {tab === "checks" ? (
          <div role="tabpanel" id="panel-checks" aria-labelledby="tab-checks">
            <ValidationPanel issues={issues} />
          </div>
        ) : null}
        {tab === "rules" ? (
          <div role="tabpanel" id="panel-rules" aria-labelledby="tab-rules">
            <RuleGraph rules={rules} engagedIds={evaluation.engagedRuleIds} failedIds={failedIds} />
            <RuleAuthor rules={rules} />
            {import.meta.env.DEV ? (
              <div className="mt-6 border-t border-line pt-4">
                <button
                  type="button"
                  className="font-mono text-[11px] tracking-wide uppercase"
                  onClick={() => setBenchmark(benchmarkRules(config, rules, 400))}
                >
                  Run evaluation benchmark
                </button>
                {benchmark ? (
                  <p className="mt-2 font-mono text-[12px] leading-5 text-muted">
                    {benchmark.ruleCount} rules, {benchmark.parameterCount} parameters.
                    <br />
                    Average {benchmark.averageMs.toFixed(3)} ms, max {benchmark.maxMs.toFixed(3)} ms over {benchmark.iterations} runs.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
