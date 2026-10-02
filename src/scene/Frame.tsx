import type { Finish } from "../data/materials.ts";
import type { BeamLayout, UprightLayout } from "../engine/layout.ts";
import { useAnimatedMaterial } from "./useAnimatedMaterial.ts";

interface FramesProps {
  uprights: UprightLayout[];
  beams: BeamLayout[];
  finish: Finish;
  highlightUprights: boolean;
  highlightBeams: boolean;
}

export function Frames({ uprights, beams, finish, highlightUprights, highlightBeams }: FramesProps) {
  const uprightMaterial = useAnimatedMaterial(finish, highlightUprights);
  const beamMaterial = useAnimatedMaterial(finish, highlightBeams);
  return (
    <group>
      {uprights.map((upright) => (
        <mesh
          key={upright.id}
          position={[upright.x, upright.height / 2, upright.z]}
          material={uprightMaterial}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[upright.section, upright.height, upright.section]} />
        </mesh>
      ))}
      {beams.map((beam) => (
        <mesh key={beam.id} position={[beam.x, beam.y, beam.z]} material={beamMaterial} castShadow receiveShadow>
          <boxGeometry args={[beam.length, beam.height, beam.depth]} />
        </mesh>
      ))}
    </group>
  );
}
