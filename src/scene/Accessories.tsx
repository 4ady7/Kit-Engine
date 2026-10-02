import type { MeshStandardMaterial } from "three";
import type { Finish } from "../data/materials.ts";
import type { PlateLayout } from "../engine/layout.ts";
import { useAnimatedMaterial } from "./useAnimatedMaterial.ts";

interface AccessoriesProps {
  endGuards: PlateLayout[];
  labelRails: PlateLayout[];
  safetyBacks: PlateLayout[];
  guardFinish: Finish;
  railFinish: Finish;
  backFinish: Finish;
  highlightGuard: boolean;
  highlightRail: boolean;
  highlightBack: boolean;
}

function Plates({ plates, material }: { plates: PlateLayout[]; material: MeshStandardMaterial }) {
  return (
    <group>
      {plates.map((plate) => (
        <mesh key={plate.id} position={[plate.x, plate.y, plate.z]} material={material} castShadow receiveShadow>
          <boxGeometry args={[plate.width, plate.height, plate.depth]} />
        </mesh>
      ))}
    </group>
  );
}

export function Accessories({
  endGuards,
  labelRails,
  safetyBacks,
  guardFinish,
  railFinish,
  backFinish,
  highlightGuard,
  highlightRail,
  highlightBack,
}: AccessoriesProps) {
  const guardMaterial = useAnimatedMaterial(guardFinish, highlightGuard);
  const railMaterial = useAnimatedMaterial(railFinish, highlightRail);
  const backMaterial = useAnimatedMaterial(backFinish, highlightBack);
  return (
    <group>
      <Plates plates={endGuards} material={guardMaterial} />
      <Plates plates={labelRails} material={railMaterial} />
      <Plates plates={safetyBacks} material={backMaterial} />
    </group>
  );
}
