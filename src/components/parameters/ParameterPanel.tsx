import { PARAMETERS, readParameter } from "../../engine/parameters.ts";
import { presetById, presets } from "../../engine/presets.ts";
import type { EvaluationResult } from "../../engine/types.ts";
import { useConfigurationStore } from "../../store/configurationStore.ts";
import { EnumParameter, NumberParameter, ToggleParameter } from "./Controls.tsx";

const GROUPS = ["Structure", "Materials", "Duty", "Accessories"] as const;

interface ParameterPanelProps {
  evaluation: EvaluationResult;
  onPreset: () => void;
}

export function ParameterPanel({ evaluation, onPreset }: ParameterPanelProps) {
  const config = useConfigurationStore((state) => state.config);
  const applyPreset = useConfigurationStore((state) => state.applyPreset);
  const issues = [...evaluation.errors, ...evaluation.warnings];

  return (
    <aside className="panel-scroll border-line bg-panel lg:border-r" aria-label="Parameters">
      <div className="border-b border-line px-4 py-3">
        <label htmlFor="preset" className="font-mono text-[11px] tracking-wide text-muted uppercase">
          Load configuration
        </label>
        <select
          id="preset"
          className="mt-1 w-full border border-line bg-white px-2 py-2 text-[13px]"
          value=""
          onChange={(event) => {
            const preset = presetById(event.target.value);
            if (!preset) return;
            applyPreset(preset);
            onPreset();
          }}
        >
          <option value="">Choose a preset or demo fault</option>
          <optgroup label="Presets">
            {presets.filter((preset) => preset.intent !== "invalid").map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Demo faults">
            {presets.filter((preset) => preset.intent === "invalid").map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </optgroup>
        </select>
      </div>
      <div className="px-4 pb-6">
        {GROUPS.map((group, index) => (
          <section key={group} aria-labelledby={`group-${group}`}>
            <h2 id={`group-${group}`} className="pt-4 font-mono text-[11px] tracking-wide text-muted uppercase">
              {String(index + 1).padStart(2, "0")} {group}
            </h2>
            {PARAMETERS.filter((parameter) => parameter.group === group).map((parameter) => {
              const value = readParameter(config, parameter.key);
              const issue = issues.find((item) => item.parameter === parameter.key);
              if ((parameter.kind === "integer" || parameter.kind === "number") && typeof value === "number") {
                return (
                  <NumberParameter
                    key={parameter.key}
                    parameter={parameter.key}
                    label={parameter.label}
                    description={parameter.description}
                    unit={parameter.unit}
                    min={parameter.min ?? 0}
                    max={parameter.max ?? 0}
                    step={parameter.step ?? 1}
                    value={value}
                    issue={issue}
                  />
                );
              }
              if (parameter.kind === "enum" && typeof value === "string" && parameter.options) {
                return (
                  <EnumParameter
                    key={parameter.key}
                    parameter={parameter.key}
                    label={parameter.label}
                    description={parameter.description}
                    value={value}
                    options={parameter.options}
                    issue={issue}
                  />
                );
              }
              if (parameter.kind === "boolean" && typeof value === "boolean") {
                return (
                  <ToggleParameter
                    key={parameter.key}
                    parameter={parameter.key}
                    label={parameter.label}
                    description={parameter.description}
                    checked={value}
                    issue={issue}
                  />
                );
              }
              return null;
            })}
          </section>
        ))}
        <p className="pt-4 text-[12px] leading-5 text-muted">
          Arrow keys adjust a focused slider. Command Z undoes a change. Shift Command Z redoes it. R resets the camera.
        </p>
      </div>
    </aside>
  );
}
