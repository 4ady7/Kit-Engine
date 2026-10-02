import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { SpecificationModel } from "../engine/specification.ts";

const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: "Helvetica", color: "#1c1b19", fontSize: 10 },
  brand: { fontFamily: "Helvetica-Bold", fontSize: 11, letterSpacing: 2 },
  subtitle: { marginTop: 2, color: "#5e594f" },
  rule: { marginTop: 12, marginBottom: 12, height: 2, backgroundColor: "#8d4312" },
  title: { fontFamily: "Helvetica-Bold", fontSize: 16 },
  meta: { marginTop: 4, color: "#5e594f" },
  status: { marginTop: 10, fontFamily: "Helvetica-Bold", fontSize: 11 },
  heading: { marginTop: 16, marginBottom: 6, fontFamily: "Helvetica-Bold", fontSize: 11 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#d3cdc3",
    borderTopStyle: "solid",
    paddingVertical: 4,
  },
  label: { color: "#5e594f" },
  image: { marginTop: 8, width: 220, height: 140 },
  note: { marginTop: 8, color: "#5e594f" },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, color: "#5e594f", fontSize: 8 },
});

export function SpecificationDocument({ model, image }: { model: SpecificationModel; image: string | null }) {
  return (
    <Document title={`Kit Engine ${model.idLabel}`} author="Kit Engine">
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>KIT ENGINE</Text>
        <Text style={styles.subtitle}>Configuration specification</Text>
        <View style={styles.rule} />
        <Text style={styles.title}>{model.title}</Text>
        <Text style={styles.meta}>
          {model.idLabel} · {model.dateLabel}
        </Text>
        <Text style={styles.status}>
          {model.statusLabel} — {model.statusDetail}
        </Text>
        {image ? <Image src={image} style={styles.image} /> : null}
        {!model.ready ? (
          <Text style={styles.note}>This configuration does not pass structural checks and is not ready to order.</Text>
        ) : null}
        <Text style={styles.heading}>Dimensions</Text>
        {model.dimensions.map((row) => (
          <View key={row.label} style={styles.row}>
            <Text style={styles.label}>{row.label}</Text>
            <Text>{row.value}</Text>
          </View>
        ))}
        <Text style={styles.heading}>Configuration</Text>
        {model.configuration.map((row) => (
          <View key={row.label} style={styles.row}>
            <Text style={styles.label}>{row.label}</Text>
            <Text>{row.value}</Text>
          </View>
        ))}
        <View style={styles.row}>
          <Text style={styles.label}>Accessories</Text>
          <Text>{model.accessories.join(", ")}</Text>
        </View>
        <Text style={styles.heading}>Checks</Text>
        {model.issues.length === 0 ? <Text>No issues.</Text> : null}
        {model.issues.map((issue) => (
          <Text key={`${issue.severity}-${issue.message}`}>
            {issue.severity === "error" ? "Error" : "Warning"}: {issue.message}
          </Text>
        ))}
        <Text style={styles.heading}>Price</Text>
        {model.priceLines.map((line) => (
          <View key={line.label} style={styles.row}>
            <Text>{line.label}</Text>
            <Text>{line.amount}</Text>
          </View>
        ))}
        <View style={styles.row}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Total</Text>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>{model.total}</Text>
        </View>
        <Text style={styles.footer}>
          Prices are deterministic estimates from the Kit Engine rule set, in GBP, excluding delivery and tax. Validation is
          recomputed when the configuration is opened. It is not stored with the share.
        </Text>
      </Page>
    </Document>
  );
}
