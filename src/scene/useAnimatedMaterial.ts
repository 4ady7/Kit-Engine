import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, MeshStandardMaterial } from "three";
import type { Finish } from "../data/materials.ts";

export function useAnimatedMaterial(finish: Finish, highlighted: boolean): MeshStandardMaterial {
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: finish.color,
        metalness: finish.metalness,
        roughness: finish.roughness,
        transparent: (finish.opacity ?? 1) < 1,
        opacity: finish.opacity ?? 1,
      }),
    // The material object stays alive so colour and roughness can lerp instead of snapping.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const targetColor = useRef(new Color(finish.color));
  const targetEmissive = useRef(new Color("#000000"));
  const latest = useRef({ finish, highlighted });
  latest.current = { finish, highlighted };

  useFrame((_, delta) => {
    const current = latest.current;
    const amount = 1 - Math.exp(-delta * 8);
    targetColor.current.set(current.finish.color);
    targetEmissive.current.set(current.highlighted ? "#8d2e2e" : "#000000");
    material.color.lerp(targetColor.current, amount);
    material.emissive.lerp(targetEmissive.current, amount);
    material.metalness += (current.finish.metalness - material.metalness) * amount;
    material.roughness += (current.finish.roughness - material.roughness) * amount;
    const opacity = current.finish.opacity ?? 1;
    material.opacity += (opacity - material.opacity) * amount;
    material.transparent = opacity < 1;
    const intensity = current.highlighted ? 0.38 : 0;
    material.emissiveIntensity += (intensity - material.emissiveIntensity) * amount;
  });

  useEffect(() => () => material.dispose(), [material]);
  return material;
}
