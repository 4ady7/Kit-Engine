import { z } from "zod";
import type { Configuration, ConfigurationDocument } from "./types.ts";
import { CONFIGURATION_VERSION } from "./types.ts";

const finiteNumber = z.number().finite();

const configurationSchema = z
  .object({
    bayCount: finiteNumber,
    bayWidth: finiteNumber,
    shelfDepth: finiteNumber,
    overallHeight: finiteNumber,
    shelfCount: finiteNumber,
    frameMaterial: z.enum(["steel", "reinforced-steel"]),
    shelfMaterial: z.enum(["steel", "timber"]),
    loadRating: finiteNumber,
    bracing: z.enum(["standard", "heavy-duty"]),
    accessories: z
      .object({
        endGuard: z.boolean(),
        labelRail: z.boolean(),
        safetyBack: z.boolean(),
      })
      .strict(),
  })
  .strict();

export const configurationDocumentSchema = z
  .object({
    version: z.literal(CONFIGURATION_VERSION),
    title: z.string().trim().min(1).max(80).optional(),
    parameters: configurationSchema,
  })
  .strict();

export function serializeConfiguration(config: Configuration, title?: string): ConfigurationDocument {
  const document: ConfigurationDocument = {
    version: CONFIGURATION_VERSION,
    parameters: {
      ...config,
      accessories: { ...config.accessories },
    },
  };
  if (title) document.title = title;
  return document;
}

export function parseConfigurationDocument(input: unknown): { ok: true; document: ConfigurationDocument } | { ok: false; message: string } {
  const parsed = configurationDocumentSchema.safeParse(input);
  if (parsed.success) return { ok: true, document: parsed.data };
  const version = typeof input === "object" && input !== null && "version" in input ? input.version : undefined;
  if (version !== undefined && version !== CONFIGURATION_VERSION) {
    return { ok: false, message: "This configuration was saved by a different version of Kit Engine." };
  }
  return { ok: false, message: "This shared configuration is incomplete or malformed." };
}
