import { useState } from "react";
import { compileRule } from "../../api/client.ts";
import { ApiError } from "../../api/client.ts";
import { GRAMMAR_REJECTION } from "../../engine/compile.ts";
import { formatPredicate } from "../../engine/grammar.ts";
import { parameterLabel } from "../../engine/format.ts";
import { compileRuleSource } from "../../engine/ruleEngine.ts";
import { deleteRule, saveRule } from "../../api/client.ts";
import type { Rule } from "../../engine/types.ts";
import { useConfigurationStore } from "../../store/configurationStore.ts";

type Draft =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "proposed"; dsl: string; rule: Rule };

export function RuleAuthor({ rules }: { rules: readonly Rule[] }) {
  const customRules = useConfigurationStore((state) => state.customRules);
  const addCustomRule = useConfigurationStore((state) => state.addCustomRule);
  const removeCustomRule = useConfigurationStore((state) => state.removeCustomRule);
  const [instruction, setInstruction] = useState("Panel width must stay under 2.4 m if using a steel frame.");
  const [draft, setDraft] = useState<Draft>({ status: "idle" });
  const [notice, setNotice] = useState<string | null>(null);

  const propose = async () => {
    setNotice(null);
    setDraft({ status: "loading" });
    try {
      const response = await compileRule(instruction);
      const compiled = compileRuleSource(response.dsl);
      const rule = compiled.rules[0];
      if (compiled.errors.length > 0 || compiled.rules.length !== 1 || !rule) {
        setDraft({ status: "error", message: GRAMMAR_REJECTION });
        return;
      }
      setDraft({ status: "proposed", dsl: response.dsl, rule });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "The rule authoring service did not respond. Try again.";
      setDraft({ status: "error", message });
    }
  };

  const approve = async () => {
    if (draft.status !== "proposed") return;
    const added = addCustomRule(draft.rule);
    if (!added) {
      setDraft({ status: "error", message: GRAMMAR_REJECTION });
      return;
    }
    try {
      await saveRule(draft.dsl);
      setNotice("Rule approved and stored.");
    } catch {
      setNotice("Rule is active on this device. The server did not store it.");
    }
    setDraft({ status: "idle" });
  };

  const remove = async (id: string) => {
    try {
      await deleteRule(id);
    } catch {
      setNotice("Removed on this device. The server may still have this rule.");
    }
    removeCustomRule(id);
  };

  return (
    <section aria-label="AI rule author" className="mt-6 border-t border-line pt-4">
      <h2 className="font-mono text-[11px] tracking-wide text-muted uppercase">AI rule author</h2>
      <p className="mt-2 text-[12px] leading-5 text-muted">
        Describe a constraint. Claude proposes a rule. Nothing changes until you approve it.
      </p>
      <label htmlFor="rule-instruction" className="sr-only">
        Constraint in plain language
      </label>
      <textarea
        id="rule-instruction"
        className="mt-3 min-h-24 w-full border border-line bg-white p-2 text-[13px] leading-5"
        value={instruction}
        maxLength={500}
        onChange={(event) => setInstruction(event.target.value)}
      />
      <button
        type="button"
        className="mt-2 border border-ink px-3 py-2 text-[13px] disabled:opacity-50"
        disabled={draft.status === "loading" || instruction.trim().length < 8}
        onClick={() => void propose()}
      >
        {draft.status === "loading" ? "Proposing…" : "Propose rule"}
      </button>
      {draft.status === "error" ? <p className="mt-3 text-[13px] text-bad">{draft.message}</p> : null}
      {draft.status === "proposed" ? (
        <div className="mt-3 border border-line bg-white p-3">
          <p className="font-mono text-[11px] tracking-wide text-muted uppercase">New rule</p>
          <pre className="mt-2 overflow-x-auto font-mono text-[12px] leading-5 text-ok">
            {draft.dsl.split("\n").map((line, index) => (
              <div key={`${index}-${line}`}>+ {line}</div>
            ))}
          </pre>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
            <dt className="text-muted">Explanation</dt>
            <dd>{draft.rule.explanation}</dd>
            <dt className="text-muted">Affected</dt>
            <dd>{parameterLabel(draft.rule.then.parameter)}</dd>
            <dt className="text-muted">Constraint</dt>
            <dd className="font-mono text-[12px]">{formatPredicate(draft.rule.then)}</dd>
            <dt className="text-muted">Severity</dt>
            <dd className="uppercase">{draft.rule.severity}</dd>
          </dl>
          <div className="mt-3 flex gap-2">
            <button type="button" className="border border-line px-3 py-2 text-[13px]" onClick={() => setDraft({ status: "idle" })}>
              Reject
            </button>
            <button type="button" className="border border-ink bg-ink px-3 py-2 text-[13px] text-panel" onClick={() => void approve()}>
              Approve rule
            </button>
          </div>
        </div>
      ) : null}
      {notice ? <p className="mt-3 text-[13px]">{notice}</p> : null}
      {customRules.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {customRules.map((rule) => (
            <li key={rule.id} className="flex items-center justify-between gap-3 border border-line px-2 py-2 text-[13px]">
              <span>{rule.id}</span>
              <button type="button" className="font-mono text-[11px] tracking-wide uppercase" onClick={() => void remove(rule.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="sr-only">{rules.length} rules loaded</p>
    </section>
  );
}
