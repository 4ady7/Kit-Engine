import { useEffect, useState } from "react";
import { formatGbp } from "../../engine/format.ts";
import type { PriceBreakdown as PriceModel } from "../../engine/types.ts";

function useAnimatedInteger(target: number): number {
  const [display, setDisplay] = useState(target);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) {
      setDisplay(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const initial = display;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 280);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(initial + (target - initial) * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // The animation starts from the displayed value at the moment the target changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return display;
}

export function PriceBreakdown({ price, estimate }: { price: PriceModel; estimate: boolean }) {
  const total = useAnimatedInteger(price.total);
  return (
    <section aria-label="Price">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-mono text-[11px] tracking-wide text-muted uppercase">{estimate ? "Estimate" : "Quote"}</h2>
        <p className="font-mono text-[20px]">{formatGbp(total)}</p>
      </div>
      <table className="w-full text-[13px]">
        <tbody>
          {price.lines.map((line) => (
            <tr key={line.id} className="border-t border-line">
              <th scope="row" className="py-1.5 text-left font-normal">
                {line.label}
              </th>
              <td className="py-1.5 text-right font-mono">{formatGbp(line.amount)}</td>
            </tr>
          ))}
          <tr className="border-t border-ink">
            <th scope="row" className="py-2 text-left font-medium">
              Total
            </th>
            <td className="py-2 text-right font-mono">{formatGbp(price.total)}</td>
          </tr>
        </tbody>
      </table>
      {estimate ? (
        <p className="mt-2 text-[12px] leading-5 text-muted">Shown for reference. Resolve the errors before sending this as a quote.</p>
      ) : (
        <p className="mt-2 text-[12px] leading-5 text-muted">Excludes delivery and tax.</p>
      )}
    </section>
  );
}
