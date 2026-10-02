import type { SpecificationModel } from "../engine/specification.ts";

export async function downloadQuote(model: SpecificationModel, image: string | null): Promise<void> {
  const [{ pdf }, { SpecificationDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./SpecificationDocument.tsx"),
  ]);
  const blob = await pdf(<SpecificationDocument model={model} image={image} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `kit-engine-${model.idLabel.replace(/\s+/g, "-").toLowerCase()}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
