import { ContactShadows, OrbitControls } from "@react-three/drei";
import { useMemo } from "react";
import { accessoryFinish, backFinish, braceFinish, frameFinish, shelfFinish } from "../data/materials.ts";
import type { HighlightPart } from "../engine/highlight.ts";
import { buildLayout } from "../engine/layout.ts";
import type { Configuration } from "../engine/types.ts";
import { Accessories } from "./Accessories.tsx";
import { Braces } from "./Brace.tsx";
import { CameraController } from "./CameraController.tsx";
import { Frames } from "./Frame.tsx";
import { Ground } from "./Ground.tsx";
import { Lighting } from "./Lighting.tsx";
import { Shelves } from "./Shelf.tsx";

interface ShelfSystemProps {
  config: Configuration;
  highlighted: ReadonlySet<HighlightPart>;
  resetSignal: number;
}

export function ShelfSystem({ config, highlighted, resetSignal }: ShelfSystemProps) {
  const layout = useMemo(() => buildLayout(config), [config]);
  const span = Math.max(layout.width, layout.depth, layout.height);
  return (
    <>
      <color attach="background" args={["#d9d4cc"]} />
      <Lighting />
      <Ground />
      <Frames
        uprights={layout.uprights}
        beams={layout.beams}
        finish={frameFinish[config.frameMaterial]}
        highlightUprights={highlighted.has("upright")}
        highlightBeams={highlighted.has("beam")}
      />
      <Shelves shelves={layout.shelves} finish={shelfFinish[config.shelfMaterial]} highlighted={highlighted.has("shelf")} />
      <Braces braces={layout.braces} finish={braceFinish} highlighted={highlighted.has("brace")} />
      <Accessories
        endGuards={layout.endGuards}
        labelRails={layout.labelRails}
        safetyBacks={layout.safetyBacks}
        guardFinish={accessoryFinish}
        railFinish={accessoryFinish}
        backFinish={backFinish}
        highlightGuard={highlighted.has("guard")}
        highlightRail={highlighted.has("rail")}
        highlightBack={highlighted.has("back")}
      />
      <ContactShadows position={[0, 0.001, 0]} opacity={0.38} scale={Math.max(10, span * 3)} blur={2.2} far={4} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI / 2.02}
        minDistance={1.5}
        maxDistance={18}
      />
      <CameraController resetSignal={resetSignal} span={span} />
    </>
  );
}
