import { Canvas } from "@react-three/fiber";
import { RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { formatNumber } from "../../engine/format.ts";
import type { DerivedValues } from "../../engine/types.ts";
import type { HighlightPart } from "../../engine/highlight.ts";
import type { Configuration } from "../../engine/types.ts";
import { registerCapture } from "../../scene/capture.ts";
import { ShelfSystem } from "../../scene/ShelfSystem.tsx";

interface ViewportProps {
  config: Configuration;
  derived: DerivedValues;
  highlighted: ReadonlySet<HighlightPart>;
  resetSignal: number;
  suspended: boolean;
  onReset: () => void;
}

export function Viewport({ config, derived, highlighted, resetSignal, suspended, onReset }: ViewportProps) {
  useEffect(() => () => registerCapture(null), []);
  const label = `Shelving run ${formatNumber(derived.totalWidthMm)} millimetres wide, ${formatNumber(derived.totalDepthMm)} deep, ${formatNumber(derived.totalHeightMm)} high.`;

  return (
    <section className="relative h-full min-h-[320px] bg-studio" aria-label="3D configuration">
      <p className="sr-only">{label}</p>
      {suspended ? (
        <div className="flex h-full min-h-[320px] items-center justify-center text-[13px] text-muted">Loading configuration…</div>
      ) : (
        <Canvas
          className="h-full min-h-[320px]"
          shadows
          dpr={[1, 1.75]}
          camera={{ position: [4.2, 2.1, 5.4], fov: 35, near: 0.1, far: 80 }}
          gl={{ preserveDrawingBuffer: true, antialias: true }}
          onCreated={({ gl }) => {
            gl.toneMappingExposure = 1.12;
            registerCapture(() => gl.domElement.toDataURL("image/png"));
          }}
        >
          <ShelfSystem config={config} highlighted={highlighted} resetSignal={resetSignal} />
        </Canvas>
      )}
      <div className="pointer-events-none absolute bottom-3 left-3 bg-panel/90 px-2 py-1 font-mono text-[12px]">
        {formatNumber(derived.totalWidthMm)} × {formatNumber(derived.totalDepthMm)} × {formatNumber(derived.totalHeightMm)} mm
      </div>
      <button
        type="button"
        className="absolute top-3 right-3 flex items-center gap-2 border border-line bg-panel px-2 py-1 text-[12px]"
        onClick={onReset}
      >
        <RotateCcw size={14} aria-hidden="true" />
        Reset view
      </button>
    </section>
  );
}
