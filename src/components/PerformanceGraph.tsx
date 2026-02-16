import React from "react";
import {
  View,
  Text,
  Dimensions,
  StyleSheet,
  ScrollView,
} from "react-native";
import { BarChart } from "react-native-chart-kit";

const screenWidth = Dimensions.get("window").width;
const BAR_WIDTH = 70;

type Props = {
  data: any[];
  metric: string;
  unit?: string;
};

export default function PerformanceGraph({
  data,
  metric,
  unit = "",
}: Props) {
  if (!Array.isArray(data) || data.length === 0) return null;

  // ✅ Sort by player id (or any stable player field)
  const sorted = [...data].sort(
    (a, b) => Number(a.player_id ?? 0) - Number(b.player_id ?? 0)
  );

  // ✅ FORCE PLAYER LABELS
  const labels = sorted.map((_, i) => `P${i + 1}`);

  const values = sorted.map(r => {
    const v = Number(r?.[metric]);
    return Number.isFinite(v) ? Number(v.toFixed(2)) : 0;
  });

  const chartWidth = Math.max(
    screenWidth - 32,
    values.length * BAR_WIDTH
  );

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Player-wise Comparison</Text>

      <Text style={styles.subtitle}>
        {metric.replaceAll("_", " ").toUpperCase()} {unit}
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <BarChart
          key={`team-player-${labels.length}`} // 🔥 force remount
          data={{
            labels,
            datasets: [{ data: values }],
          }}
          width={chartWidth}
          height={320}
          fromZero
          showValuesOnTopOfBars
          chartConfig={{
            backgroundGradientFrom: "#ffffff",
            backgroundGradientTo: "#ffffff",
            color: (opacity = 1) =>
              `rgba(37, 99, 235, ${opacity})`,

            labelColor: () => "#334155",
            barPercentage: 0.6,
            propsForBackgroundLines: { stroke: "#e5e7eb" },
            propsForLabels: { fontWeight: "700" },
          }}
          style={styles.chart}
        />
      </ScrollView>

      <Text style={styles.legend}>
        Each bar represents one player
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    paddingTop: 18,
    paddingBottom: 48,
    paddingHorizontal: 12,
    marginVertical: 16,
    elevation: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
    color: "#0f172a",
  },
  subtitle: {
    textAlign: "center",
    color: "#64748b",
    marginTop: 4,
    marginBottom: 14,
    fontSize: 13,
    fontWeight: "600",
  },
  chart: {
    borderRadius: 14,
    marginTop: 8,
    paddingBottom: 28,
  },
  legend: {
    textAlign: "center",
    marginTop: 12,
    fontSize: 12,
    color: "#64748b",
  },
});