import type { Finish } from "../data/materials.ts";
import type { ShelfLayout } from "../engine/layout.ts";
import { useAnimatedMaterial } from "./useAnimatedMaterial.ts";

interface ShelvesProps {
  shelves: ShelfLayout[];
  finish: Finish;
  highlighted: boolean;
}

export function Shelves({ shelves, finish, highlighted }: ShelvesProps) {
  const material = useAnimatedMaterial(finish, highlighted);
  return (
    <group>
      {shelves.map((shelf) => (
        <mesh key={shelf.id} position={[shelf.x, shelf.y, shelf.z]} material={material} castShadow receiveShadow>
          <boxGeometry args={[shelf.width, shelf.thickness, shelf.depth]} />
        </mesh>
      ))}
    </group>
  );
}
