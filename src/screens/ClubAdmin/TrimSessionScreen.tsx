import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  PanResponder,
  Dimensions,
  ScrollView,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import Svg, { Path, Rect, G, Line, Text as SvgText } from "react-native-svg";
import { useTheme } from "../../components/context/ThemeContext";
import { parseFileTimeRange } from "../../utils/parseFileTimeRange";
import { db } from "../../db/sqlite";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PRIMARY_RED = "#B50002";
const HANDLE_WIDTH = 24;
const GRAPH_PADDING = 20;

/* ================= HELPERS ================= */

function formatDuration(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatTime(ms: number) {
  if (!ms || isNaN(ms)) return "00:00:00";
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function parseInputToMs(input: string, baseDateMs: number) {
  const parts = input.split(":").map(Number);
  if (parts.length < 2) return null;
  const hh = parts[0];
  const mm = parts[1];
  const ss = parts[2] || 0;

  if (isNaN(hh) || isNaN(mm) || isNaN(ss)) return null;
  const d = new Date(baseDateMs);
  d.setHours(hh, mm, ss, 0);
  return d.getTime();
}

const Step = ({ icon, label, active, completed, isDark }: any) => (
  <View style={styles.stepItem}>
    <View style={[styles.stepIcon, active && styles.stepIconActive, completed && styles.stepIconCompleted]}>
      <Ionicons name={icon} size={16} color={active || completed ? "#fff" : (isDark ? "#475569" : "#94A3B8")} />
    </View>
    <Text style={[styles.stepLabel, active && styles.stepLabelActive, { color: active ? PRIMARY_RED : (isDark ? "#94A3B8" : "#64748B") }]}>{label}</Text>
  </View>
);

const StepLine = ({ active }: any) => (
  <View style={[styles.stepLine, active && styles.stepLineActive]} />
);

/* ================= COMPONENT ================= */

export default function TrimSessionScreen({
  file,
  sessionId,
  goNext,
  goBack,
}: {
  file: string;
  sessionId: string;
  goNext: (params: any) => void;
  goBack: () => void;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Parse file times
  const timeRange = useMemo(() => parseFileTimeRange(file), [file]);
  const originalStart = timeRange?.fileStartMs || Date.now();
  const originalEnd = timeRange?.fileEndMs || Date.now() + 3600000;
  const totalDuration = originalEnd - originalStart;

  // Trimming state (Ratios 0-1)
  const [startRatio, setStartRatio] = useState(0);
  const [endRatio, setEndRatio] = useState(1);

  // Manual input state
  const [startInput, setStartInput] = useState(formatTime(originalStart));
  const [endInput, setEndInput] = useState(formatTime(originalEnd));

  const containerWidth = useRef(0);

  // Derived Values
  const trimStartTs = originalStart + totalDuration * startRatio;
  const trimEndTs = originalStart + totalDuration * endRatio;
  const trimmedDuration = trimEndTs - trimStartTs;
  const dataRemoved = totalDuration - trimmedDuration;

  useEffect(() => {
    setStartInput(formatTime(trimStartTs));
  }, [startRatio]);

  useEffect(() => {
    setEndInput(formatTime(trimEndTs));
  }, [endRatio]);

  /* ================= SLIDER LOGIC ================= */

  const startResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        if (containerWidth.current <= 0) return;
        const delta = gesture.dx / containerWidth.current;
        const minGapRatio = 1000 / totalDuration; // 1 second min gap
        let next = Math.max(0, Math.min(endRatio - minGapRatio, startRatio + delta));
        setStartRatio(next);
      },
    })
  ).current;

  const endResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        if (containerWidth.current <= 0) return;
        const delta = gesture.dx / containerWidth.current;
        const minGapRatio = 1000 / totalDuration; // 1 second min gap
        let next = Math.min(1, Math.max(startRatio + minGapRatio, endRatio + delta));
        setEndRatio(next);
      },
    })
  ).current;

  /* ================= ACTION HANDLERS ================= */

  const handleManualApply = (type: "start" | "end", val: string) => {
    const ms = parseInputToMs(val, originalStart);
    if (ms === null) return;

    const minGapMs = 1000; // 1 second min gap

    if (type === "start") {
      const clamped = Math.max(originalStart, Math.min(trimEndTs - minGapMs, ms));
      setStartRatio((clamped - originalStart) / totalDuration);
    } else {
      const clamped = Math.min(originalEnd, Math.max(trimStartTs + minGapMs, ms));
      setEndRatio((clamped - originalStart) / totalDuration);
    }
  };

  const onNext = async () => {
    try {
      console.log(`[TrimSession] Saving trim points for session: ${sessionId}`);
      console.log(`[TrimSession] Start: ${formatTime(trimStartTs)} (${trimStartTs})`);
      console.log(`[TrimSession] End: ${formatTime(trimEndTs)} (${trimEndTs})`);

      await db.execute(
        `UPDATE sessions SET trim_start_ts = ?, trim_end_ts = ? WHERE session_id = ?`,
        [trimStartTs, trimEndTs, sessionId]
      );

      console.log(`[TrimSession] Successfully updated SQLite for ${sessionId}`);

      goNext({
        trimStartTs,
        trimEndTs,
      });
    } catch (error) {
      console.error(`[TrimSession] Failed to save to SQLite:`, error);
      // Still proceed but alert might be good
      goNext({
        trimStartTs,
        trimEndTs,
      });
    }
  };

  /* ================= RENDER ================= */

  return (
    <ScrollView style={[styles.container, { backgroundColor: isDark ? "#020617" : "#FFFFFF" }]}>
      {/* 🟠 TOP STEPPER HEADER */}
      <View style={[styles.stepperHeader, { backgroundColor: isDark ? "#0F172A" : "#fff", borderBottomColor: isDark ? "#1E293B" : "#E2E8F0" }]}>
        <TouchableOpacity onPress={() => {
          console.log("[TrimSession] Back to players pressed");
          goBack();
        }} style={styles.backBtnStepper}>
          <Ionicons name="chevron-back" size={24} color={isDark ? "#94A3B8" : "#475569"} />
          <Text style={[styles.backTextStepper, { color: isDark ? "#94A3B8" : "#475569" }]}>Back to players</Text>
        </TouchableOpacity>

        <View style={styles.stepperContainer}>
          <Step icon="calendar-outline" label="Event Details" active completed isDark={isDark} />
          <StepLine active />
          <Step icon="people" label="Add Players" active completed isDark={isDark} />
          <StepLine active />
          <Step icon="cut" label="Trim" active isDark={isDark} />
          <StepLine />
          <Step icon="walk-outline" label="Add Exercise" isDark={isDark} />
        </View>
      </View>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBox, { backgroundColor: isDark ? "#311" : "#FEE2E2" }]}>
            <Ionicons name="cut-outline" size={20} color={PRIMARY_RED} />
          </View>
          <View style={{ marginLeft: 12 }}>
            <Text style={[styles.title, { color: isDark ? "#fff" : "#0F172A" }]}>Data Trimming</Text>
            <Text style={[styles.subtitle, { color: isDark ? "#94A3B8" : "#64748B" }]}>Select the time range for data collection</Text>
          </View>
        </View>
        <View style={[styles.durationBadge, { borderColor: isDark ? "#444" : "#E2E8F0" }]}>
          <Ionicons name="time-outline" size={14} color={PRIMARY_RED} />
          <Text style={[styles.durationText, { color: PRIMARY_RED }]}>{formatDuration(trimmedDuration)} selected</Text>
        </View>
      </View>

      {/* VISUAL RANGE SLIDER */}
      <View style={[styles.visualBox, { backgroundColor: isDark ? "#0F172A" : "#F8FAFC", borderColor: isDark ? "#1E293B" : "#E2E8F0" }]}>
        <View
          style={styles.waveformContainer}
          onLayout={(e) => (containerWidth.current = e.nativeEvent.layout.width)}
        >
          {/* RULER BACKGROUND */}
          <View style={styles.rulerContainer}>
            {Array.from({ length: 41 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.rulerTick,
                  {
                    height: i % 5 === 0 ? 12 : 6,
                    backgroundColor: isDark ? "#334155" : "#CBD5E1",
                    opacity: 0.8
                  }
                ]}
              />
            ))}
          </View>

          {/* SLIDER OVERLAY */}
          <View style={styles.sliderOverlay}>
            {/* Darkened unselected areas */}
            <View style={[styles.unselectedArea, { left: 0, width: (startRatio * 100) + ("%" as any), borderTopLeftRadius: 10, borderBottomLeftRadius: 10 }]} />
            <View style={[styles.unselectedArea, { left: (endRatio * 100) + ("%" as any), right: 0, borderTopRightRadius: 10, borderBottomRightRadius: 10 }]} />

            {/* Active Range selection highlight */}
            <View
              style={[
                styles.activeRangeHighlight,
                {
                  left: (startRatio * 100) + ("%" as any),
                  width: ((endRatio - startRatio) * 100) + ("%" as any),
                  borderColor: PRIMARY_RED,
                }
              ]}
            />

            {/* Start Handle */}
            <View
              {...startResponder.panHandlers}
              style={[styles.handleContainer, { left: (startRatio * 100) + ("%" as any), marginLeft: -15 }]}
            >
              <View style={styles.premiumHandle}>
                <View style={styles.gripperLine} />
                <View style={styles.gripperLine} />
                <View style={styles.gripperLine} />
              </View>
            </View>

            {/* End Handle */}
            <View
              {...endResponder.panHandlers}
              style={[styles.handleContainer, { left: (endRatio * 100) + ("%" as any), marginLeft: -15 }]}
            >
              <View style={styles.premiumHandle}>
                <View style={styles.gripperLine} />
                <View style={styles.gripperLine} />
                <View style={styles.gripperLine} />
              </View>
            </View>
          </View>
        </View>

        {/* AXIS TICKS */}
        <View style={styles.axis}>
          {[0, 0.2, 0.4, 0.6, 0.8, 1].map((p, i) => (
            <Text key={i} style={[styles.axisTick, { color: isDark ? "#475569" : "#94A3B8" }]}>
              {formatTime(originalStart + totalDuration * p)}
            </Text>
          ))}
        </View>
      </View>

      {/* MANUAL INPUTS */}
      <View style={styles.inputsRow}>
        {/* Start Time */}
        <View style={[styles.inputCard, { backgroundColor: isDark ? "#0F172A" : "#FFF5F5", borderColor: isDark ? "#311" : "#FEE2E2" }]}>
          <Text style={[styles.inputLabel, { color: PRIMARY_RED }]}>Start Time</Text>
          <View style={[styles.inputWrapper, { backgroundColor: isDark ? "#1E293B" : "#F8FAFC" }]}>
            <TextInput
              style={[styles.timeInput, { color: isDark ? "#fff" : "#000" }]}
              value={startInput}
              onChangeText={setStartInput}
              onBlur={() => handleManualApply("start", startInput)}
              onSubmitEditing={() => handleManualApply("start", startInput)}
              placeholder="00:00:00"
              placeholderTextColor={isDark ? "#475569" : "#94A3B8"}
            />
            <Ionicons name="time-outline" size={18} color={isDark ? "#94A3B8" : "#64748B"} />
          </View>
          <Text style={[styles.originalHint, { color: isDark ? "#475569" : "#94A3B8" }]}>Original: {formatTime(originalStart)}</Text>
        </View>

        {/* End Time */}
        <View style={[styles.inputCard, { backgroundColor: isDark ? "#0F172A" : "#FFF5F5", borderColor: isDark ? "#311" : "#FEE2E2" }]}>
          <Text style={[styles.inputLabel, { color: PRIMARY_RED }]}>End Time</Text>
          <View style={[styles.inputWrapper, { backgroundColor: isDark ? "#1E293B" : "#F8FAFC" }]}>
            <TextInput
              style={[styles.timeInput, { color: isDark ? "#fff" : "#000" }]}
              value={endInput}
              onChangeText={setEndInput}
              onBlur={() => handleManualApply("end", endInput)}
              onSubmitEditing={() => handleManualApply("end", endInput)}
              placeholder="00:00:00"
              placeholderTextColor={isDark ? "#475569" : "#94A3B8"}
            />
            <Ionicons name="time-outline" size={18} color={isDark ? "#94A3B8" : "#64748B"} />
          </View>
          <Text style={[styles.originalHint, { color: isDark ? "#475569" : "#94A3B8" }]}>Original: {formatTime(originalEnd)}</Text>
        </View>
      </View>

      {/* STATS BAR */}
      <View style={[styles.statsBar, { borderTopColor: isDark ? "#1E293B" : "#E2E8F0" }]}>
        <View style={styles.statBox}>
          <Text style={[styles.statLabel, { color: isDark ? "#94A3B8" : "#64748B" }]}>Original Duration</Text>
          <Text style={[styles.statValue, { color: isDark ? "#fff" : "#0F172A" }]}>{formatDuration(totalDuration)}</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: isDark ? "#1E293B" : "#E2E8F0" }]} />
        <View style={styles.statBox}>
          <Text style={[styles.statLabel, { color: PRIMARY_RED }]}>Trimmed Duration</Text>
          <Text style={[styles.statValue, { color: PRIMARY_RED }]}>{formatDuration(trimmedDuration)}</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: isDark ? "#1E293B" : "#E2E8F0" }]} />
        <View style={styles.statBox}>
          <Text style={[styles.statLabel, { color: PRIMARY_RED }]}>Data Removed</Text>
          <Text style={[styles.statValue, { color: PRIMARY_RED }]}>{formatDuration(dataRemoved)}</Text>
        </View>
      </View>

      {/* FOOTER */}
      <View style={[styles.footer, { borderTopColor: isDark ? "#1E293B" : "#E2E8F0" }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: isDark ? "#1E293B" : "#fff", borderColor: isDark ? "#334155" : "#E2E8F0" }]} onPress={goBack}>
          <Text style={[styles.backBtnText, { color: isDark ? "#94A3B8" : "#475569" }]}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.nextBtn} onPress={onNext}>
          <Text style={styles.nextBtnText}>Next</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 24 },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "800" },
  subtitle: { fontSize: 13, marginTop: 2 },
  durationBadge: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
  durationText: { fontSize: 13, fontWeight: "700" },

  visualBox: { marginHorizontal: 24, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 24, borderWidth: 1, overflow: 'hidden' },
  waveformContainer: { height: 100, justifyContent: "center", position: "relative" },
  rulerContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: 'flex-end', height: 40, position: 'absolute', top: 30, left: 0, right: 0 },
  rulerTick: { width: 1.5, borderRadius: 1 },
  sliderOverlay: { ...StyleSheet.absoluteFillObject, height: 100 },
  unselectedArea: { position: 'absolute', top: 25, bottom: 25, backgroundColor: 'rgba(0,0,0,0.1)' },
  activeRangeHighlight: { position: "absolute", top: 25, bottom: 25, backgroundColor: 'rgba(181, 0, 2, 0.03)', borderLeftWidth: 2, borderRightWidth: 2, borderTopWidth: 1, borderBottomWidth: 1 },
  handleContainer: { position: "absolute", top: 10, width: 30, height: 80, alignItems: "center", zIndex: 10 },
  premiumHandle: { width: 14, height: 50, borderRadius: 4, backgroundColor: '#fff', borderWidth: 1, borderColor: PRIMARY_RED, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 4, elevation: 5, justifyContent: 'center', alignItems: 'center', gap: 3 },
  gripperLine: { width: 6, height: 1.5, backgroundColor: PRIMARY_RED, opacity: 0.5, borderRadius: 1 },

  axis: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  axisTick: { fontSize: 10, fontWeight: "600" },

  inputsRow: { flexDirection: "row", padding: 24, gap: 16 },
  inputCard: { flex: 1, borderRadius: 20, padding: 16, borderWidth: 1 },
  inputLabel: { fontSize: 14, fontWeight: "700", marginBottom: 12 },
  inputWrapper: { flexDirection: "row", alignItems: "center", borderRadius: 12, paddingHorizontal: 12, height: 44 },
  timeInput: { flex: 1, fontSize: 15, fontWeight: "700" },
  originalHint: { fontSize: 11, marginTop: 8, fontWeight: "500" },

  statsBar: { flexDirection: "row", paddingVertical: 24, marginHorizontal: 24, borderTopWidth: 1 },
  statBox: { flex: 1 },
  statLabel: { fontSize: 13, fontWeight: "600", marginBottom: 4 },
  statValue: { fontSize: 15, fontWeight: "800" },
  statDivider: { width: 1, height: "100%", marginHorizontal: 16 },

  footer: { flexDirection: "row", justifyContent: "space-between", padding: 24, borderTopWidth: 1 },
  backBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  backBtnText: { fontWeight: "700" },
  nextBtn: { backgroundColor: PRIMARY_RED, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12 },
  nextBtnText: { color: "#fff", fontWeight: "800" },

  /* STEPPER STYLES */
  stepperHeader: { padding: 16, borderBottomWidth: 1 },
  backBtnStepper: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  backTextStepper: { marginLeft: 4, fontSize: 13, fontWeight: "600" },
  stepperContainer: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  stepItem: { alignItems: "center", width: 60 },
  stepIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  stepIconActive: { backgroundColor: PRIMARY_RED, borderColor: "rgba(181, 0, 2, 0.2)" },
  stepIconCompleted: { backgroundColor: PRIMARY_RED },
  stepLabel: { fontSize: 9, marginTop: 4, textAlign: "center", fontWeight: "600" },
  stepLabelActive: { color: PRIMARY_RED },
  stepLine: { flex: 0.5, height: 2, backgroundColor: "#E5E7EB", marginTop: -15 },
  stepLineActive: { backgroundColor: PRIMARY_RED },
});
