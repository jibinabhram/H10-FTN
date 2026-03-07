import React, { useState } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";

type Row = {
  id: string;
  player_id?: string;
  session_id?: string;
  name: string;
  jersey: string;
  value: number;
  color?: string;
  eventName?: string;
  metricLabel?: string;
};

type Props = {
  rows: Row[];
  accentColor?: string;
  textColor?: string;
  trackColor?: string;
  xLabel?: string;
  isDark?: boolean;
  showAverageLine?: boolean;
  uniquePlayerCount?: number;
  uniqueEventCount?: number;
  height?: number;
  title?: string;
};

const HorizontalBarCompare = React.memo(({
  rows,
  accentColor = "#B50002",
  textColor = "#0f172a",
  trackColor = "#F1F5F9",
  xLabel,
  isDark = false,
  showAverageLine = false,
  uniquePlayerCount = 1,
  uniqueEventCount = 1,
  height,
  title,
}: Props) => {
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

  // Determine display mode
  const isSingleEvent = uniqueEventCount === 1;
  const isSinglePlayer = uniquePlayerCount === 1;
  const showEventNameOnce = isSingleEvent;

  // Group rows by player for better visual grouping
  const playerGroups = rows.reduce((acc, row) => {
    const pid = row.player_id || row.id;
    if (!acc[pid]) acc[pid] = [];
    acc[pid].push(row);
    return acc;
  }, {} as Record<string, Row[]>);

  const pids = Array.from(new Set(rows.map(r => r.player_id || r.id)));

  const [chartWidth, setChartWidth] = useState(0);

  // Constants for fixed vertical elements
  const HEADER_H = (showEventNameOnce || isSinglePlayer) ? 70 : 0;
  const FOOTER_H = xLabel ? 110 : 80;
  const CONTAINER_P = 40; // Total vertical padding (24 top + 16 bottom)
  const EXTRA_H = 50; // Safety and badge space

  // Calculate units needed for vertical space
  const totalBars = rows.length;
  const totalPlayerHeaders = isSinglePlayer ? 0 : pids.length;
  const totalGroupGaps = pids.length - 1;
  const totalUnits = totalBars + (totalPlayerHeaders * 1.3) + (totalGroupGaps * 0.5);

  // Determine total height and unit height
  // 1. If height is PASSED (e.g. from a popup), we MUST fit everything inside it.
  // 2. If height is NOT passed, we calculate a height that fits all items comfortably, min 550.
  let CHART_TOTAL_HEIGHT = height || 0;
  let unitHeight = 0;

  if (height) {
    CHART_TOTAL_HEIGHT = height;
    const available = CHART_TOTAL_HEIGHT - HEADER_H - FOOTER_H - CONTAINER_P - EXTRA_H;
    unitHeight = available / totalUnits;
  } else {
    const minUnitHeight = 45; // Comfortable height for each bar row
    const needed = (totalUnits * minUnitHeight) + HEADER_H + FOOTER_H + CONTAINER_P + EXTRA_H;
    CHART_TOTAL_HEIGHT = Math.max(needed, 550);
    unitHeight = (CHART_TOTAL_HEIGHT - HEADER_H - FOOTER_H - CONTAINER_P - EXTRA_H) / totalUnits;
  }

  const dynamicBarRowHeight = unitHeight;
  const dynamicGroupMargin = unitHeight * 0.5;
  const dynamicBarHeight = unitHeight * 0.8;
  const dynamicBarHeightConstrained = Math.min(dynamicBarHeight, 45); // Limit max thickness
  const dynamicHeaderHeight = unitHeight * 1.3;

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
        height: CHART_TOTAL_HEIGHT,
        justifyContent: 'space-between'
      }
    ]}>
      {/* Header Section - Fixed Height to prevent shifting */}
      <View style={{ height: HEADER_H, overflow: 'hidden' }}>
        {(title || showEventNameOnce || isSinglePlayer) && (
          <View style={[styles.header, { borderBottomColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
            {(title || showEventNameOnce) && (
              <Text style={[styles.headerTitle, { color: isDark ? '#F1F5F9' : '#0F172A' }]}>
                {title || (rows.length > 0 ? rows[0].eventName : "")}
              </Text>
            )}
            {isSinglePlayer && rows.length > 0 && !title && !showEventNameOnce && (
              <View style={styles.singlePlayerHeader}>
                <View style={[styles.jerseyBadgeSmall, { backgroundColor: rows[0].color || accentColor }]}>
                  <Text style={styles.jerseyTextSmall}>{rows[0].jersey || "00"}</Text>
                </View>
                <Text style={[styles.headerTitle, { color: isDark ? '#F1F5F9' : '#0F172A' }]}>
                  {rows[0].name}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      <View style={[styles.chartArea, { flex: 1 }]} onLayout={(e) => {
        const newWidth = e.nativeEvent.layout.width;
        if (newWidth !== chartWidth) setChartWidth(newWidth);
      }}>
        {/* Y-Axis (Vertical Line) */}
        <View style={[styles.verticalAxis, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0', left: 140 }]} />

        {pids.map((pid, groupIndex) => {
          const groupRows = playerGroups[pid];
          const firstRow = groupRows[0];

          return (
            <View key={pid} style={[styles.playerGroup, groupIndex < pids.length - 1 && { marginBottom: dynamicGroupMargin }]}>
              {/* Player Header - Only if multiple players */}
              {!isSinglePlayer && (
                <View style={[styles.groupInfo, { height: dynamicHeaderHeight, marginBottom: 0 }]}>
                  <View style={[styles.jerseyBadge, {
                    backgroundColor: firstRow.color || accentColor,
                    width: Math.min(28, unitHeight * 1.25),
                    height: Math.min(28, unitHeight * 1.25),
                  }]}>
                    <Text style={[styles.jerseyText, { fontSize: Math.min(12, unitHeight * 0.6) }]}>{firstRow.jersey || "00"}</Text>
                  </View>
                  <Text style={[styles.playerNameText, {
                    color: isDark ? '#F1F5F9' : '#0F172A',
                    fontSize: Math.min(15, unitHeight * 0.8)
                  }]} numberOfLines={1}>
                    {firstRow.name}
                  </Text>
                </View>
              )}

              {/* Bars within this player group */}
              <View style={styles.groupBarsContainer}>
                {groupRows.map((r) => {
                  const v = Number(r.value) || 0;
                  const widthPct = (v / safeMax) * 100;
                  const barColor = r.color || accentColor;

                  return (
                    <View key={r.id} style={[styles.barRow, { height: dynamicBarRowHeight }]}>
                      {/* Label Area (Indented event name or metric label) */}
                      <View style={styles.barLabelArea}>
                        {(!showEventNameOnce) ? (
                          r.eventName && (
                            <Text style={[styles.barEventText, {
                              color: isDark ? '#94A3B8' : '#64748B',
                              fontSize: Math.min(11, unitHeight * 0.5)
                            }]} numberOfLines={1}>
                              {r.eventName}
                            </Text>
                          )
                        ) : (
                          r.metricLabel && rows.some(other => other.player_id === r.player_id && other.metricLabel !== r.metricLabel) && (
                            <Text style={[styles.barEventText, {
                              color: isDark ? '#94A3B8' : '#64748B',
                              fontSize: Math.min(11, unitHeight * 0.5)
                            }]} numberOfLines={1}>
                              {r.metricLabel}
                            </Text>
                          )
                        )}
                      </View>

                      {/* Bar Visualization */}
                      <View style={styles.barVisualWrapper}>
                        <View
                          style={[
                            styles.bar,
                            {
                              width: `${widthPct}%`,
                              backgroundColor: barColor,
                              height: dynamicBarHeightConstrained,
                            }
                          ]}
                        />
                        <Text style={[styles.barValueText, {
                          color: isDark ? '#F1F5F9' : '#0F172A',
                          fontSize: Math.min(12, unitHeight * 0.6)
                        }]}>
                          {formatValue(v)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}

        {/* Global Average Line Overlay */}
        {showAverageLine && avgPosPct > 0 && chartWidth > 0 && (
          <View style={[styles.avgLineOverlay, { left: 140 + (avgPosPct * (chartWidth - 140 - 40) / 100) }]}>
            <View style={styles.avgLineBadge}>
              <Text style={styles.avgLineBadgeText}>AVG {formatValue(avgValue)}</Text>
            </View>
          </View>
        )}
      </View>

      {/* X-Axis Section - Fixed Height */}
      <View style={[styles.footer, { height: FOOTER_H }]}>
        <View style={[styles.xAxis, { marginLeft: 140 }]}>
          <View style={[styles.axisLine, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }]} />
          <View style={styles.ticksRow}>
            {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((p, i) => {
              const val = p * safeMax;
              return (
                <View key={i} style={styles.tick}>
                  <View style={[styles.tickMark, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }]} />
                  <Text style={styles.tickLabel}>{Math.round(val)}</Text>
                </View>
              );
            })}
          </View>
          {xLabel && (
            <Text style={[styles.xLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>{xLabel}</Text>
          )}
        </View>
      </View>
    </View>
  );
});

export default HorizontalBarCompare;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: 16,
    paddingTop: 24,
    borderRadius: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  header: {
    paddingBottom: 20,
    marginBottom: 24,
    borderBottomWidth: 1.5,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  singlePlayerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  jerseyBadgeSmall: {
    width: 24,
    height: 24,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  jerseyTextSmall: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFF',
  },
  chartArea: {
    width: '100%',
    position: 'relative',
    paddingTop: 40, // Space for the Average Badge to sit inside
    paddingBottom: 10,
  },
  verticalAxis: {
    position: 'absolute',
    top: 30, // Start below the average badge area
    bottom: -10,
    width: 2,
    zIndex: 1,
  },
  playerGroup: {
    width: '100%',
  },
  playerGroupMargin: {
    marginBottom: 28,
  },
  groupInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingLeft: 4,
  },
  jerseyBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  jerseyText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFF',
  },
  playerNameText: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  groupBarsContainer: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden', // Ensures bars are neatly contained
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
  },
  tightBar: {
    marginBottom: 0, // NO GAP between bars of the same set
  },
  barLabelArea: {
    width: 130,
    paddingRight: 14,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  barEventText: {
    fontSize: 11,
    fontWeight: '700',
    opacity: 0.8,
  },
  barVisualWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
  },
  bar: {
    height: 22, // Slightly thicker bars for better premium feel
    borderRadius: 2, // Sharp but subtly rounded ends
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  barValueText: {
    marginLeft: 10,
    fontSize: 12,
    fontWeight: '900',
  },
  avgLineOverlay: {
    position: 'absolute',
    top: 30, // Start below the average badge area
    bottom: -20,
    width: 1.5,
    borderWidth: 1.5,
    borderColor: '#B50002',
    borderStyle: 'dashed',
    zIndex: 20,
  },
  avgLineBadge: {
    position: 'absolute',
    top: -35, // Sits in the chartArea paddingTop
    left: -37.5, // Centered on the 1.5px line (75/2)
    backgroundColor: '#B50002',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    width: 75,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  avgLineBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
  },
  footer: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.1)',
    paddingTop: 16,
  },
  xAxis: {
    width: 'auto',
    marginRight: 60,
  },
  axisLine: {
    height: 2,
    width: '100%',
  },
  ticksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingTop: 10,
  },
  tick: {
    alignItems: 'center',
  },
  tickMark: {
    width: 2,
    height: 8,
    marginBottom: 6,
  },
  tickLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
  },
  xLabel: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
});