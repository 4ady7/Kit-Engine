import { useRef, useState } from "react";
import type { RuleValue, ValidationIssue } from "../../engine/types.ts";
import { useConfigurationStore } from "../../store/configurationStore.ts";

interface NumberParameterProps {
  parameter: string;
  label: string;
  description: string;
  unit?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  issue?: ValidationIssue;
}

export function NumberParameter({ parameter, label, description, unit, min, max, step, value, issue }: NumberParameterProps) {
  const setParameter = useConfigurationStore((state) => state.setParameter);
  const beginGesture = useConfigurationStore((state) => state.beginGesture);
  const endGesture = useConfigurationStore((state) => state.endGesture);
  const dragging = useRef(false);
  const [draft, setDraft] = useState<string | null>(null);
  const descriptionId = `${parameter}-description`;
  const issueId = `${parameter}-issue`;
  const sliderValue = Math.min(max, Math.max(min, value));
  const describedBy = issue ? `${descriptionId} ${issueId}` : descriptionId;
  const draftInvalid = draft !== null && (draft.trim() === "" || !Number.isFinite(Number(draft)));

  return (
    <div className="border-b border-line py-3">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <label htmlFor={`${parameter}-input`} className="text-[13px] font-medium">
          {label}
        </label>
        <span className="font-mono text-[12px] text-muted">
          {min}–{max}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <input
          id={`${parameter}-slider`}
          aria-label={`${label} slider`}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={Number.isFinite(value) ? value : undefined}
          aria-describedby={describedBy}
          aria-invalid={issue?.severity === "error" || undefined}
          type="range"
          min={min}
          max={max}
          step={step}
          value={Number.isFinite(sliderValue) ? sliderValue : min}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            dragging.current = true;
            beginGesture();
          }}
          onPointerUp={() => {
            dragging.current = false;
            endGesture();
          }}
          onLostPointerCapture={() => {
            if (!dragging.current) return;
            dragging.current = false;
            endGesture();
          }}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (!Number.isFinite(next)) return;
            setParameter(parameter, next, dragging.current ? "live" : "commit");
          }}
        />
        <input
          id={`${parameter}-input`}
          className="w-24 border border-line bg-white px-2 py-1 text-right font-mono text-[13px]"
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={draft ?? (Number.isFinite(value) ? String(value) : "")}
          aria-describedby={describedBy}
          aria-invalid={issue?.severity === "error" || draftInvalid || undefined}
          onFocus={() => {
            setDraft(String(value));
            beginGesture();
          }}
          onBlur={() => {
            if (draft !== null && draft.trim() !== "" && Number.isFinite(Number(draft))) {
              setParameter(parameter, Number(draft), "live");
            }
            setDraft(null);
            endGesture();
          }}
          onChange={(event) => {
            setDraft(event.target.value);
            const next = Number(event.target.value);
            if (event.target.value.trim() !== "" && Number.isFinite(next)) {
              setParameter(parameter, next, "live");
            }
          }}
        />
      </div>
      <p id={descriptionId} className="mt-1 text-[12px] leading-5 text-muted">
        {description}
      </p>
      {draftInvalid ? <p className="mt-1 text-[12px] text-bad">Enter a number.</p> : null}
      {issue ? (
        <p id={issueId} className={issue.severity === "error" ? "mt-1 text-[12px] text-bad" : "mt-1 text-[12px] text-warn"}>
          {issue.severity === "error" ? "Error" : "Warning"}: {issue.message}
        </p>
      ) : null}
    </div>
  );
}

interface EnumParameterProps {
  parameter: string;
  label: string;
  description: string;
  value: string;
  options: readonly { value: string; label: string }[];
  issue?: ValidationIssue;
}

export function EnumParameter({ parameter, label, description, value, options, issue }: EnumParameterProps) {
  const setParameter = useConfigurationStore((state) => state.setParameter);
  return (
    <fieldset className="border-b border-line py-3">
      <legend className="text-[13px] font-medium">{label}</legend>
      <div className="mt-2 grid grid-cols-2 gap-1" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className={
                selected
                  ? "border border-ink bg-ink px-2 py-2 text-[13px] text-panel"
                  : "border border-line bg-white px-2 py-2 text-[13px] hover:border-ink"
              }
              onClick={() => setParameter(parameter, option.value, "commit")}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-[12px] leading-5 text-muted">{description}</p>
      {issue ? (
        <p className={issue.severity === "error" ? "mt-1 text-[12px] text-bad" : "mt-1 text-[12px] text-warn"}>
          {issue.severity === "error" ? "Error" : "Warning"}: {issue.message}
        </p>
      ) : null}
    </fieldset>
  );
}

interface ToggleParameterProps {
  parameter: string;
  label: string;
  description: string;
  checked: boolean;
  issue?: ValidationIssue;
}

export function ToggleParameter({ parameter, label, description, checked, issue }: ToggleParameterProps) {
  const setParameter = useConfigurationStore((state) => state.setParameter);
  return (
    <label className="flex cursor-pointer gap-3 border-b border-line py-3">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 accent-copper"
        checked={checked}
        aria-invalid={issue?.severity === "error" || undefined}
        onChange={(event) => setParameter(parameter, event.target.checked satisfies RuleValue, "commit")}
      />
      <span>
        <span className="block text-[13px] font-medium">{label}</span>
        <span className="mt-1 block text-[12px] leading-5 text-muted">{description}</span>
        {issue ? (
          <span className={issue.severity === "error" ? "mt-1 block text-[12px] text-bad" : "mt-1 block text-[12px] text-warn"}>
            {issue.severity === "error" ? "Error" : "Warning"}: {issue.message}
          </span>
        ) : null}
      </span>
    </label>
  );
}
