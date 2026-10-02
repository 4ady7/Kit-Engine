import { useState } from "react";
import type { RuleValue, ValidationIssue } from "../../engine/types.ts";
import { useConfigurationStore } from "../../store/configurationStore.ts";

function IssueCard({ issue }: { issue: ValidationIssue }) {
  const [open, setOpen] = useState(false);
  const setParameter = useConfigurationStore((state) => state.setParameter);
  const tone = issue.severity === "error" ? "border-bad bg-bad-soft" : "border-warn bg-warn-soft";
  const label = issue.severity === "error" ? "Error" : "Warning";

  return (
    <article className={`border ${tone} px-3 py-3`} aria-labelledby={`${issue.id}-title`}>
      <p className="font-mono text-[11px] tracking-wide uppercase">{label}</p>
      <h3 id={`${issue.id}-title`} className="mt-1 text-[14px] font-medium leading-5">
        {issue.message}
      </h3>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-[12px]">
        <dt className="text-muted">Current</dt>
        <dd>{issue.current}</dd>
        <dt className="text-muted">{issue.limitLabel}</dt>
        <dd>{issue.limit}</dd>
      </dl>
      <p className="mt-3 text-[13px] leading-5">
        <span className="text-muted">Why. </span>
        {issue.explanation}
      </p>
      <p className="mt-2 text-[13px] leading-5">{issue.suggestion}</p>
      {issue.fixes.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2">
          {issue.fixes.map((fix) => (
            <button
              key={`${fix.parameter}-${String(fix.value)}`}
              type="button"
              className="border border-ink bg-white px-2 py-2 text-left text-[13px] hover:bg-ink hover:text-panel"
              onClick={() => setParameter(fix.parameter, fix.value as RuleValue, "commit")}
            >
              {fix.label}
            </button>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        className="mt-3 font-mono text-[11px] tracking-wide uppercase"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Hide trace" : "Why?"}
      </button>
      {open ? (
        <div className="mt-2 border border-line bg-panel px-3 py-2 font-mono text-[12px] leading-5">
          <p>Rule {issue.trace.ruleId}</p>
          {issue.trace.inputs.map((input) => (
            <p key={input.parameter}>
              Input: {input.label} = {input.value}
            </p>
          ))}
          <p>Constraint: {issue.trace.constraint}</p>
          <p>Result: FAIL</p>
        </div>
      ) : null}
    </article>
  );
}

export function ValidationPanel({ issues }: { issues: ValidationIssue[] }) {
  if (issues.length === 0) {
    return <p className="text-[13px] text-muted">No structural issues. This configuration can be quoted.</p>;
  }
  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite">
      {issues.map((issue) => (
        <IssueCard key={issue.id} issue={issue} />
      ))}
    </div>
  );
}
