import React from "react";
import { View, Text, StyleSheet } from "react-native";

type Row = {
  id: string;
  label: string;
  value: number;
  color?: string;
};

type Props = {
  rows: Row[];
  accentColor?: string;
  textColor?: string;
  trackColor?: string;
  xLabel?: string;
  yLabel?: string;
  showTicks?: boolean;
  valueFormatter?: (v: number) => string;
  showLegend?: boolean;
};

export default function HorizontalBarCompare({
  rows,
  accentColor = "#B50002",
  textColor = "#0f172a",
  trackColor = "#E5E7EB",
  xLabel,
  yLabel,
  showTicks = true,
  valueFormatter,
  showLegend = true,
}: Props) {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const maxValue = Math.max(...rows.map(r => Number(r.value) || 0), 0);
  const safeMax = maxValue > 0 ? maxValue : 1;
  const tickValues = [0, 0.25, 0.5, 0.75, 1].map(p => p * safeMax);

  const formatValue = (v: number) => {
    if (valueFormatter) return valueFormatter(v);
    if (safeMax >= 1000) return Math.round(v).toString();
    if (safeMax >= 100) return v.toFixed(1);
    return v.toFixed(2);
  };

  return (
    <View style={styles.container}>
      {(xLabel || yLabel) ? (
        <View style={styles.axisHeader}>
          <Text style={[styles.axisLabel, { color: textColor }]} numberOfLines={1}>
            {yLabel || ""}
          </Text>
          <Text style={[styles.axisLabel, styles.axisLabelCenter, { color: textColor }]} numberOfLines={1}>
            {xLabel || ""}
          </Text>
          <Text style={[styles.axisLabel, styles.axisLabelRight, { color: textColor }]} numberOfLines={1}>
            Value
          </Text>
        </View>
      ) : null}

      {showTicks ? (
        <View style={styles.ticksRow}>
          <View style={styles.labelSpacer} />
          <View style={styles.ticksTrack}>
            {tickValues.map((t, idx) => (
              <Text key={`tick-${idx}`} style={[styles.tickLabel, { color: textColor }]}>
                {formatValue(t)}
              </Text>
            ))}
          </View>
          <View style={styles.valueSpacer} />
        </View>
      ) : null}

      {rows.map((r) => {
        const v = Number(r.value) || 0;
        const widthPct = Math.min(100, (v / safeMax) * 100);
        const barColor = r.color || accentColor;
        return (
          <View key={r.id} style={styles.row}>
            <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
              {r.label}
            </Text>
            <View style={[styles.track, { backgroundColor: trackColor }]}>
              <View style={[styles.bar, { width: `${widthPct}%`, backgroundColor: barColor }]} />
            </View>
            <Text style={[styles.value, { color: textColor }]}>
              {Number.isFinite(v) ? formatValue(v) : "0.00"}
            </Text>
          </View>
        );
      })}

      {showLegend ? (
        <View style={styles.legend}>
          {rows.map((r) => {
            const barColor = r.color || accentColor;
            return (
              <View key={`legend-${r.id}`} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: barColor }]} />
                <Text style={[styles.legendLabel, { color: textColor }]} numberOfLines={1}>
                  {r.label}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
    paddingBottom: 8,
    gap: 10,
  },
  axisHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 6,
  },
  axisLabel: {
    width: 140,
    fontSize: 11,
    fontWeight: "700",
    opacity: 0.8,
  },
  axisLabelCenter: {
    flex: 1,
    textAlign: "center",
  },
  axisLabelRight: {
    width: 64,
    textAlign: "right",
  },
  ticksRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  labelSpacer: {
    width: 140,
  },
  valueSpacer: {
    width: 64,
  },
  ticksTrack: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  tickLabel: {
    fontSize: 10,
    fontWeight: "600",
    opacity: 0.8,
  },
  legend: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "48%",
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  label: {
    width: 140,
    fontSize: 12,
    fontWeight: "700",
  },
  track: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
  },
  bar: {
    height: "100%",
    borderRadius: 999,
  },
  value: {
    width: 64,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "700",
  },
});
