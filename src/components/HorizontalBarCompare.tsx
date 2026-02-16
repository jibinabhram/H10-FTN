import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";

type Row = {
  id: string;
  name: string;
  jersey: string;
  value: number;
  color?: string;
};

type Props = {
  rows: Row[];
  accentColor?: string;
  textColor?: string;
  trackColor?: string;
  xLabel?: string;
  isDark?: boolean;
  showAverageLine?: boolean;
};

export default function HorizontalBarCompare({
  rows,
  accentColor = "#B50002",
  textColor = "#0f172a",
  trackColor = "#F1F5F9",
  xLabel,
  isDark = false,
  showAverageLine = false,
}: Props) {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const maxValue = Math.max(...rows.map(r => Number(r.value) || 0), 0);
  const safeMax = maxValue > 0 ? maxValue * 1.1 : 50; // Add some padding

  const formatValue = (v: number) => {
    if (v >= 1000) return Math.round(v).toLocaleString();
    if (v === 0) return "0";
    return v.toFixed(1);
  };

  const avgValue = rows.reduce((acc, r) => acc + (Number(r.value) || 0), 0) / rows.length;
  const avgPosPct = (avgValue / safeMax) * 100;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#1E293B' : '#FFF' }]}>
      {rows.map((r) => {
        const v = Number(r.value) || 0;
        const widthPct = (v / safeMax) * 100;
        const barColor = r.color || accentColor;

        return (
          <View key={r.id} style={styles.row}>
            {/* Player Info Section */}
            <View style={styles.playerInfo}>
              <View style={[styles.jerseyBadge, { backgroundColor: barColor }]}>
                <Text style={styles.jerseyText}>{r.jersey || "00"}</Text>
              </View>
              <Text style={[styles.playerName, { color: isDark ? '#E2E8F0' : '#475569' }]} numberOfLines={1}>
                {r.name}
              </Text>
            </View>

            {/* Bar Section */}
            <View style={styles.barArea}>
              {/* Vertical Separator Line */}
              <View style={[styles.verticalAxis, { backgroundColor: isDark ? '#334155' : '#CBD5E1' }]} />

              <View style={styles.barWrapper}>
                <View
                  style={[
                    styles.bar,
                    {
                      width: `${widthPct}%`,
                      backgroundColor: barColor,
                      shadowColor: barColor,
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.3,
                      shadowRadius: 4,
                    }
                  ]}
                />
                <Text style={[styles.valueText, { color: isDark ? '#94A3B8' : '#1E293B' }]}>
                  {formatValue(v)}
                </Text>
              </View>

              {/* Average Squad Threshold Line */}
              {showAverageLine && avgPosPct > 0 && (
                <View
                  style={[
                    styles.avgLine,
                    { left: `${avgPosPct}%`, height: rows.length > 5 ? '120%' : '140%' }
                  ]}
                >
                  <View style={styles.avgLineBadge}>
                    <Text style={styles.avgLineBadgeText}>AVG: {formatValue(avgValue)}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        );
      })}

      {/* X-Axis Section */}
      <View style={styles.footer}>
        <View style={styles.xAxis}>
          <View style={[styles.axisLine, { backgroundColor: isDark ? '#334155' : '#CBD5E1' }]} />
          <View style={styles.ticksRow}>
            {[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].filter((_, i) => i % 2 === 0).map((p, i) => {
              const val = p * safeMax;
              return (
                <View key={i} style={styles.tick}>
                  <View style={[styles.tickMark, { backgroundColor: isDark ? '#334155' : '#CBD5E1' }]} />
                  <Text style={styles.tickLabel}>
                    {Math.round(val)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
        {xLabel && (
          <Text style={[styles.xLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>{xLabel}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: 20,
    borderRadius: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    height: 36,
  },
  playerInfo: {
    width: 78,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  jerseyBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  jerseyText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFF',
  },
  playerName: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  barArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  verticalAxis: {
    width: 2,
    height: '110%',
    position: 'absolute',
    left: 0,
    zIndex: 1,
  },
  barWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10, // space from vertical line
  },
  bar: {
    height: 18,
    borderRadius: 9,
  },
  valueText: {
    marginLeft: 8,
    fontSize: 11,
    fontWeight: '800',
  },
  footer: {
    marginTop: 10,
    marginLeft: 110, // matches playerInfo width
  },
  xAxis: {
    width: '100%',
  },
  axisLine: {
    height: 2,
    width: '100%',
  },
  ticksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 4,
  },
  tick: {
    alignItems: 'center',
    minWidth: 20,
  },
  tickMark: {
    width: 2,
    height: 8,
    marginBottom: 4,
  },
  tickLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  xLabel: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 16,
  },
  avgLine: {
    position: 'absolute',
    width: 2,
    borderWidth: 1.5,
    borderColor: '#B50002',
    borderStyle: 'dashed',
    zIndex: 10,
    opacity: 0.6,
  },
  avgLineBadge: {
    position: 'absolute',
    top: -22,
    left: -35,
    backgroundColor: '#B50002',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    width: 70,
    alignItems: 'center',
  },
  avgLineBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
  }
});