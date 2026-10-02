import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

interface OrbitLike {
  target: { set: (x: number, y: number, z: number) => void };
  update: () => void;
}

interface CameraControllerProps {
  resetSignal: number;
  span: number;
}

export function CameraController({ resetSignal, span }: CameraControllerProps) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as OrbitLike | null;
  const pending = useRef(true);

  useEffect(() => {
    pending.current = true;
  }, [resetSignal]);

  useFrame(() => {
    if (!pending.current || !controls) return;
    const distance = Math.max(3.4, span * 1.45 + 1.6);
    camera.position.set(distance * 0.78, Math.max(1.4, span * 0.42), distance * 0.92);
    controls.target.set(0, Math.max(0.8, span * 0.32), 0);
    controls.update();
    pending.current = false;
  });

  return null;
}
