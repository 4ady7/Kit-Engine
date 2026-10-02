import type { Finish } from "../data/materials.ts";
import type { BraceLayout } from "../engine/layout.ts";
import { useAnimatedMaterial } from "./useAnimatedMaterial.ts";

interface BracesProps {
  braces: BraceLayout[];
  finish: Finish;
  highlighted: boolean;
}

export function Braces({ braces, finish, highlighted }: BracesProps) {
  const material = useAnimatedMaterial(finish, highlighted);
  return (
    <group>
      {braces.map((brace) => (
        <mesh
          key={brace.id}
          position={[brace.x, brace.y, brace.z]}
          rotation={[0, 0, brace.angle]}
          material={material}
          castShadow
        >
          <boxGeometry args={[brace.length, brace.thickness, brace.thickness]} />
        </mesh>
      ))}
    </group>
  );
}
