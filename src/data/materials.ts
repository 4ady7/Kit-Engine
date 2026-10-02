import type { FrameMaterial, ShelfMaterial } from "../engine/types.ts";

export interface Finish {
  color: string;
  metalness: number;
  roughness: number;
  opacity?: number;
}

export const frameFinish: Record<FrameMaterial, Finish> = {
  steel: { color: "#5e6770", metalness: 0.84, roughness: 0.34 },
  "reinforced-steel": { color: "#3d4c45", metalness: 0.8, roughness: 0.28 },
};

export const shelfFinish: Record<ShelfMaterial, Finish> = {
  steel: { color: "#9aa1a8", metalness: 0.72, roughness: 0.4 },
  timber: { color: "#b08968", metalness: 0.05, roughness: 0.76 },
};

export const braceFinish: Finish = { color: "#4c564e", metalness: 0.62, roughness: 0.4 };
export const accessoryFinish: Finish = { color: "#6e6248", metalness: 0.42, roughness: 0.5 };
export const backFinish: Finish = { color: "#8d8478", metalness: 0.18, roughness: 0.68, opacity: 0.62 };
