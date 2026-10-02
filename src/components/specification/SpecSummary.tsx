import type { SpecificationModel } from "../../engine/specification.ts";

export function SpecSummary({ model }: { model: SpecificationModel }) {
  return (
    <section aria-label="Specification">
      <h2 className="font-mono text-[11px] tracking-wide text-muted uppercase">Specification</h2>
      <p className="mt-2 text-[13px] font-medium">{model.title}</p>
      <p className="font-mono text-[12px] text-muted">{model.idLabel}</p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
        {model.dimensions.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-muted">{row.label}</dt>
            <dd className="font-mono">{row.value}</dd>
          </div>
        ))}
        {model.configuration.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-muted">{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
        <dt className="text-muted">Accessories</dt>
        <dd>{model.accessories.join(", ")}</dd>
      </dl>
    </section>
  );
}
