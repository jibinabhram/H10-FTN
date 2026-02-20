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
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Modal,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTheme } from "../../components/context/ThemeContext";
import { parseFileTimeRange } from "../../utils/parseFileTimeRange";
import { db } from "../../db/sqlite";
import { useSnackbar } from "../../components/context/SnackbarContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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

/* ================= COMPONENTS ================= */

const Step = ({ icon, label, active, completed }: any) => (
  <View style={styles.stepItem}>
    <View style={[styles.stepOuter, active && styles.stepOuterActive, completed && styles.stepOuterCompleted]}>
      <Ionicons name={icon} size={14} color={active || completed ? "#fff" : "#94A3B8"} />
    </View>
    <Text style={[styles.stepTxt, active && styles.stepTxtActive]}>{label}</Text>
  </View>
);

const StepLine = ({ active }: any) => (
  <View style={[styles.sLine, active && styles.sLineActive]} />
);

const StatBox = ({ label, value, color, textColor }: any) => (
  <View style={[styles.sBox, { backgroundColor: color }]}>
    <Text style={[styles.sVal, { color: textColor }]}>{label}: {value}</Text>
  </View>
);

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
  const { showSnackbar } = useSnackbar();
  const isDark = theme === "dark";
  const PRIMARY = "#DC2626";
  const [showHowTo, setShowHowTo] = useState(false);

  // Parse file times
  const timeRange = useMemo(() => parseFileTimeRange(file), [file]);
  const originalStart = useMemo(() => {
    const ms = timeRange?.fileStartMs || Date.now();
    const d = new Date(ms);
    d.setMilliseconds(0);
    return d.getTime();
  }, [timeRange]);

  const originalEnd = useMemo(() => {
    const ms = timeRange?.fileEndMs || originalStart + 3600000;
    const d = new Date(ms);
    d.setMilliseconds(0);
    return d.getTime();
  }, [timeRange, originalStart]);

  const totalDuration = originalEnd - originalStart;

  // Trimming state (Ratios 0-1)
  const [startRatio, setStartRatio] = useState(0);
  const [endRatio, setEndRatio] = useState(1);

  // Load existing trim from DB if any
  useEffect(() => {
    (async () => {
      try {
        const res = db.execute(`SELECT trim_start_ts, trim_end_ts FROM sessions WHERE session_id = ?`, [sessionId]);
        const row = (res as any)?.rows?._array?.[0];
        if (row && row.trim_start_ts && row.trim_end_ts && totalDuration > 0) {
          const s = (Number(row.trim_start_ts) - originalStart) / totalDuration;
          const e = (Number(row.trim_end_ts) - originalStart) / totalDuration;
          setStartRatio(Math.max(0, Math.min(1, s)));
          setEndRatio(Math.max(0, Math.min(1, e)));
        }
      } catch (e) {
        console.log("[TrimSession] Load trim failed", e);
      }
    })();
  }, [sessionId, originalStart, totalDuration]);

  // Manual input state
  const [startInput, setStartInput] = useState(formatTime(originalStart));
  const [endInput, setEndInput] = useState(formatTime(originalEnd));

  const containerWidth = useRef(0);
  const startRatioRef = useRef(0);
  const endRatioRef = useRef(1);
  const initialRatioRef = useRef(0);

  // Sync refs with state for PanResponder
  useEffect(() => { startRatioRef.current = startRatio; }, [startRatio]);
  useEffect(() => { endRatioRef.current = endRatio; }, [endRatio]);

  // Derived Values
  const trimStartTs = Math.round(originalStart + totalDuration * startRatio);
  const trimEndTs = Math.round(originalStart + totalDuration * endRatio);
  const trimmedDuration = trimEndTs - trimStartTs;
  const dataRemoved = totalDuration - trimmedDuration;

  useEffect(() => {
    setStartInput(formatTime(trimStartTs));
  }, [startRatio, trimStartTs]);

  useEffect(() => {
    setEndInput(formatTime(trimEndTs));
  }, [endRatio, trimEndTs]);

  /* 🟢 AUTO-SAVE ON UNMOUNT (Sidebar Click) */
  const trimStateRef = useRef({ start: trimStartTs, end: trimEndTs });
  useEffect(() => {
    trimStateRef.current = { start: trimStartTs, end: trimEndTs };
  }, [trimStartTs, trimEndTs]);

  useEffect(() => {
    return () => {
      (async () => {
        try {
          console.log("[TrimSession] Auto-saving trim points...");
          await db.execute(
            `UPDATE sessions SET trim_start_ts = ?, trim_end_ts = ? WHERE session_id = ?`,
            [trimStateRef.current.start, trimStateRef.current.end, sessionId]
          );
        } catch (e) {
          console.error("[TrimSession] Auto-save failed", e);
        }
      })();
    };
  }, [sessionId]);

  /* ===== KEYBOARD VISIBILITY ===== */
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  /* ================= SLIDER LOGIC ================= */

  const startResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        initialRatioRef.current = startRatioRef.current;
      },
      onPanResponderMove: (_, gesture) => {
        if (containerWidth.current <= 0) return;
        const delta = gesture.dx / containerWidth.current;
        const minGapRatio = 1000 / totalDuration;
        const next = Math.max(0, Math.min(endRatioRef.current - minGapRatio, initialRatioRef.current + delta));
        setStartRatio(next);
      },
    })
  ).current;

  const endResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        initialRatioRef.current = endRatioRef.current;
      },
      onPanResponderMove: (_, gesture) => {
        if (containerWidth.current <= 0) return;
        const delta = gesture.dx / containerWidth.current;
        const minGapRatio = 1000 / totalDuration;
        const next = Math.min(1, Math.max(startRatioRef.current + minGapRatio, initialRatioRef.current + delta));
        setEndRatio(next);
      },
    })
  ).current;

  /* ================= ACTION HANDLERS ================= */

  const handleManualApply = (type: "start" | "end", val: string) => {
    const ms = parseInputToMs(val, originalStart);
    if (ms === null) {
      showSnackbar({ message: "Invalid time format. Please use HH:MM:SS", type: "error" });
      return;
    }

    if (ms < originalStart || ms > originalEnd) {
      showSnackbar({
        message: `Time entered is outside range (${formatTime(originalStart)} - ${formatTime(originalEnd)})`,
        type: "error"
      });
      return;
    }

    const minGapMs = 1000; // 1 second min gap

    if (type === "start") {
      const clamped = Math.max(originalStart, Math.min(trimEndTs - minGapMs, ms));
      setStartRatio((clamped - originalStart) / totalDuration);
    } else {
      const clamped = Math.min(originalEnd, Math.max(trimStartTs + minGapMs, ms));
      setEndRatio((clamped - originalStart) / totalDuration);
    }
  };

  const handleApplyBoth = () => {
    const sMs = parseInputToMs(startInput, originalStart);
    const eMs = parseInputToMs(endInput, originalStart);
    const minGapMs = 1000;

    let nextS = sMs !== null && sMs >= originalStart && sMs <= originalEnd ? sMs : trimStartTs;
    let nextE = eMs !== null && eMs >= originalStart && eMs <= originalEnd ? eMs : trimEndTs;

    if (nextS > nextE - minGapMs) {
      if (sMs !== null && eMs === null) nextS = nextE - minGapMs;
      else if (eMs !== null && sMs === null) nextE = nextS + minGapMs;
      else {
        // both changed or neither, just ensure gap
        nextS = nextE - minGapMs;
      }
    }

    setStartRatio((nextS - originalStart) / totalDuration);
    setEndRatio((nextE - originalStart) / totalDuration);
  };

  const handleBack = async () => {
    // 🟠 Save current state before going back
    let finalStart = trimStartTs;
    let finalEnd = trimEndTs;
    const sMs = parseInputToMs(startInput, originalStart);
    const eMs = parseInputToMs(endInput, originalStart);
    if (sMs !== null && sMs >= originalStart && sMs <= originalEnd && sMs < finalEnd - 1000) finalStart = sMs;
    if (eMs !== null && eMs >= originalStart && eMs <= originalEnd && eMs > finalStart + 1000) finalEnd = eMs;

    try {
      await db.execute(
        `UPDATE sessions SET trim_start_ts = ?, trim_end_ts = ? WHERE session_id = ?`,
        [finalStart, finalEnd, sessionId]
      );
    } catch (e) { }
    goBack();
  };

  const onNext = async () => {
    // 🟠 Ensure latest manual input is applied before saving
    let finalStart = trimStartTs;
    let finalEnd = trimEndTs;

    const sMs = parseInputToMs(startInput, originalStart);
    const eMs = parseInputToMs(endInput, originalStart);

    if (sMs !== null && sMs >= originalStart && sMs <= originalEnd) {
      // Valid start
      if (sMs < finalEnd - 1000) finalStart = sMs;
    }
    if (eMs !== null && eMs >= originalStart && eMs <= originalEnd) {
      // Valid end
      if (eMs > finalStart + 1000) finalEnd = eMs;
    }

    try {
      await db.execute(
        `UPDATE sessions SET trim_start_ts = ?, trim_end_ts = ? WHERE session_id = ?`,
        [finalStart, finalEnd, sessionId]
      );
      goNext({ trimStartTs: finalStart, trimEndTs: finalEnd, sessionId, file });
    } catch (error) {
      console.error(`[TrimSession] Failed to save to SQLite:`, error);
      goNext({ trimStartTs: finalStart, trimEndTs: finalEnd, sessionId, file });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? "#020617" : "#F8FAFC" }]}>
      {/* 🟢 HEADER WITH STEPPER - Show only when keyboard is hidden */}
      {!isKeyboardVisible && (
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtnStepper}>
            <Ionicons name="chevron-back" size={24} color={isDark ? "#94A3B8" : "#475569"} />
            <Text style={[styles.backTextStepper, { color: isDark ? "#94A3B8" : "#475569" }]}>Back to players</Text>
          </TouchableOpacity>

          <View style={styles.stepperContainer}>
            <Step icon="calendar-outline" label="Event Details" active completed />
            <StepLine active />
            <Step icon="people" label="Add Players" active completed />
            <StepLine active />
            <Step icon="cut-outline" label="Trim" active />
            <StepLine />
            <Step icon="walk-outline" label="Add Session" />
          </View>
        </View>
      )}

      {/* TOP BAR REPLACEMENT FOR WHEN KEYBOARD IS OPEN */}
      {isKeyboardVisible && (
        <View style={[styles.kTopBar, { backgroundColor: isDark ? '#020617' : '#FFFFFF', borderBottomWidth: 1, borderColor: isDark ? '#1E293B' : '#E2E8F0' }]}>
          <TouchableOpacity onPress={handleBack} style={styles.kBackBtn}>
            <Ionicons name="chevron-back" size={18} color={isDark ? "#94A3B8" : "#64748B"} />
            <Text style={[styles.kBackText, { color: isDark ? "#94A3B8" : "#64748B" }]}>Back</Text>
          </TouchableOpacity>
          <Text style={{ fontWeight: '700', color: isDark ? '#fff' : '#000' }}>Trim Session</Text>
          <View style={{ width: 40 }} />
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* 🟠 STATS ROW */}
          <View style={styles.statsRow}>
            <StatBox label="Original Duration" value={formatDuration(totalDuration)} color="#EEF2FF" textColor="#4F46E5" />
            <StatBox label="Trimmed Duration" value={formatDuration(trimmedDuration)} color="#F0FDF4" textColor="#16A34A" />
            <StatBox label="Data Removed" value={formatDuration(dataRemoved)} color="#FEF2F2" textColor={PRIMARY} />
          </View>

          {/* 🟢 TITLE SECTION */}
          <View style={styles.titleSection}>
            <View style={[styles.iconBox, { backgroundColor: isDark ? "#1E293B" : "#FEE2E2" }]}>
              <Ionicons name="cut-outline" size={24} color={PRIMARY} />
            </View>
            <View style={{ marginLeft: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.title, { color: isDark ? "#fff" : "#0F172A" }]}>Data Trimming</Text>
                <TouchableOpacity onPress={() => setShowHowTo(true)} style={{ marginLeft: 8 }}>
                  <Ionicons name="information-circle-outline" size={22} color={isDark ? "#94A3B8" : "#64748B"} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.subtitle, { color: isDark ? "#94A3B8" : "#64748B" }]}>Fine-tune the session timeframe</Text>
            </View>
          </View>

          {/* 🟢 VISUAL RANGE SLIDER */}
          <View style={[styles.visualBox, { backgroundColor: isDark ? "#1E293B" : "#fff", borderColor: isDark ? "#334155" : "#E2E8F0" }]}>
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
                <View style={[styles.unselectedArea, { left: 0, width: (startRatio * 100) + ("%" as any) }]} />
                <View style={[styles.unselectedArea, { left: (endRatio * 100) + ("%" as any), right: 0 }]} />

                <View
                  style={[
                    styles.activeRangeHighlight,
                    {
                      left: (startRatio * 100) + ("%" as any),
                      width: ((endRatio - startRatio) * 100) + ("%" as any),
                      borderColor: PRIMARY,
                    }
                  ]}
                />

                {/* Start Handle */}
                <View
                  {...startResponder.panHandlers}
                  style={[styles.handleContainer, { left: (startRatio * 100) + ("%" as any), marginLeft: -15 }]}
                >
                  <View style={[styles.premiumHandle, { borderColor: PRIMARY }]}>
                    <View style={[styles.gripperLine, { backgroundColor: PRIMARY }]} />
                    <View style={[styles.gripperLine, { backgroundColor: PRIMARY }]} />
                  </View>
                </View>

                {/* End Handle */}
                <View
                  {...endResponder.panHandlers}
                  style={[styles.handleContainer, { left: (endRatio * 100) + ("%" as any), marginLeft: -15 }]}
                >
                  <View style={[styles.premiumHandle, { borderColor: PRIMARY }]}>
                    <View style={[styles.gripperLine, { backgroundColor: PRIMARY }]} />
                    <View style={[styles.gripperLine, { backgroundColor: PRIMARY }]} />
                  </View>
                </View>
              </View>
            </View>

            {/* AXIS TICKS */}
            <View style={styles.axis}>
              {[0, 0.5, 1].map((p, i) => (
                <Text key={i} style={[styles.axisTick, { color: isDark ? "#475569" : "#94A3B8" }]}>
                  {formatTime(originalStart + totalDuration * p)}
                </Text>
              ))}
            </View>
          </View>

          {/* 🟢 MANUAL INPUTS */}
          <View style={styles.inputsRow}>
            <View style={[styles.inputCard, { backgroundColor: isDark ? "#1E293B" : "#fff", borderColor: isDark ? "#334155" : "#E2E8F0" }]}>
              <Text style={[styles.inputLabel, { color: isDark ? "#94A3B8" : "#64748B" }]}>Start Time</Text>
              <View style={[styles.inputWrapper, { backgroundColor: isDark ? "#020617" : "#F8FAFC" }]}>
                <TextInput
                  style={[styles.timeInput, { color: isDark ? "#fff" : "#0F172A" }]}
                  value={startInput}
                  onChangeText={setStartInput}
                  onBlur={() => handleManualApply("start", startInput)}
                  onSubmitEditing={() => handleManualApply("start", startInput)}
                  placeholder="00:00:00"
                  placeholderTextColor={isDark ? "#475569" : "#94A3B8"}
                />
                <Ionicons name="time-outline" size={18} color={PRIMARY} />
              </View>
            </View>

            <View style={[styles.inputCard, { backgroundColor: isDark ? "#1E293B" : "#fff", borderColor: isDark ? "#334155" : "#E2E8F0" }]}>
              <Text style={[styles.inputLabel, { color: isDark ? "#94A3B8" : "#64748B" }]}>End Time</Text>
              <View style={[styles.inputWrapper, { backgroundColor: isDark ? "#020617" : "#F8FAFC" }]}>
                <TextInput
                  style={[styles.timeInput, { color: isDark ? "#fff" : "#0F172A" }]}
                  value={endInput}
                  onChangeText={setEndInput}
                  onBlur={() => handleManualApply("end", endInput)}
                  onSubmitEditing={() => handleManualApply("end", endInput)}
                  placeholder="00:00:00"
                  placeholderTextColor={isDark ? "#475569" : "#94A3B8"}
                />
                <Ionicons name="time-outline" size={18} color={PRIMARY} />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.applyBtn, { backgroundColor: PRIMARY, width: 80 }]}
              onPress={handleApplyBoth}
            >
              <Text style={styles.applyBtnText}>APPLY</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        <View style={[styles.footer, { backgroundColor: isDark ? "#020617" : "#FFFFFF", borderTopColor: isDark ? "#1E293B" : "#E2E8F0" }]}>
          <View style={styles.footerBtns}>
            <TouchableOpacity style={[styles.btnSec, { backgroundColor: isDark ? "#1E293B" : "#F1F5F9" }]} onPress={handleBack}>
              <Text style={[styles.btnSecTxt, { color: isDark ? "#94A3B8" : "#475569" }]}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnPrim, { backgroundColor: PRIMARY }]} onPress={onNext}>
              <Text style={styles.btnPrimTxt}>Next</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={showHowTo}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHowTo(false)}
      >
        <View style={styles.howToOverlay}>
          <View style={[styles.howToContentCentered, { backgroundColor: isDark ? '#1e293b' : '#fff' }]}>
            <View style={styles.modalHowToHeader}>
              <Text style={[styles.howToTitle, { color: isDark ? '#fff' : '#1e293b' }]}>How to Trim Session</Text>
              <TouchableOpacity onPress={() => setShowHowTo(false)}>
                <Ionicons name="close" size={24} color={isDark ? '#94a3b8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.howToStep}>
                <View style={styles.stepNumBox}><Text style={styles.stepNumTxt}>1</Text></View>
                <View style={styles.stepContentBox}>
                  <Text style={[styles.stepTitleLabel, { color: isDark ? '#fff' : '#1e293b' }]}>Visual Trimming</Text>
                  <Text style={[styles.stepDescLabel, { color: isDark ? '#94a3b8' : '#64748B' }]}>Drag the white handles on the timeline to exclude warm-ups or breaks from the main session.</Text>
                </View>
              </View>

              <View style={styles.howToStep}>
                <View style={styles.stepNumBox}><Text style={styles.stepNumTxt}>2</Text></View>
                <View style={styles.stepContentBox}>
                  <Text style={[styles.stepTitleLabel, { color: isDark ? '#fff' : '#1e293b' }]}>Precision Control</Text>
                  <Text style={[styles.stepDescLabel, { color: isDark ? '#94a3b8' : '#64748B' }]}>Use the manual time inputs at the bottom for exact second-by-second adjustment.</Text>
                </View>
              </View>

              <View style={styles.howToStep}>
                <View style={styles.stepNumBox}><Text style={styles.stepNumTxt}>3</Text></View>
                <View style={styles.stepContentBox}>
                  <Text style={[styles.stepTitleLabel, { color: isDark ? '#fff' : '#1e293b' }]}>Data Validation</Text>
                  <Text style={[styles.stepDescLabel, { color: isDark ? '#94a3b8' : '#64748B' }]}>The stats row at the top shows exactly how much data is being removed. Ensure only pure activity is included.</Text>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.closeHowToBtn} onPress={() => setShowHowTo(false)}>
              <Text style={styles.closeHowToBtnText}>Got it!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingTop: 8 },
  backBtnStepper: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  backTextStepper: { marginLeft: 4, fontSize: 13, fontWeight: "600" },
  stepperContainer: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  stepItem: { alignItems: "center", width: 55 },
  stepOuter: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  stepOuterActive: { backgroundColor: "#EF4444", borderColor: "rgba(239, 68, 68, 0.2)" },
  stepOuterCompleted: { backgroundColor: "#EF4444" },
  stepTxt: { fontSize: 8, color: "#94A3B8", marginTop: 4, textAlign: "center", fontWeight: "600" },
  stepTxtActive: { color: "#EF4444" },
  sLine: { flex: 0.4, height: 2, backgroundColor: "#E5E7EB", marginTop: 15 },
  sLineActive: { backgroundColor: "#EF4444" },

  scrollContent: { paddingBottom: 32 },
  statsRow: { flexDirection: "row", paddingHorizontal: 16, gap: 6, marginVertical: 12 },
  sBox: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", justifyContent: 'center' },
  sVal: { fontSize: 9, fontWeight: "700", textAlign: 'center' },

  titleSection: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginVertical: 16 },
  iconBox: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "800" },
  subtitle: { fontSize: 13, marginTop: 2 },

  visualBox: { marginHorizontal: 16, borderRadius: 20, padding: 20, borderWidth: 1 },
  waveformContainer: { height: 80, justifyContent: "center", position: "relative" },
  rulerContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: 'flex-end', height: 40, position: 'absolute', top: 20, left: 0, right: 0 },
  rulerTick: { width: 1.5, borderRadius: 1 },
  sliderOverlay: { ...StyleSheet.absoluteFillObject, height: 80 },
  unselectedArea: { position: 'absolute', top: 15, bottom: 15, backgroundColor: 'rgba(0,0,0,0.1)' },
  activeRangeHighlight: { position: "absolute", top: 15, bottom: 15, backgroundColor: 'rgba(220, 38, 38, 0.05)', borderLeftWidth: 2, borderRightWidth: 2, borderTopWidth: 1, borderBottomWidth: 1 },
  handleContainer: { position: "absolute", top: 0, width: 30, height: 80, alignItems: "center", zIndex: 10 },
  premiumHandle: { width: 14, height: 44, borderRadius: 4, backgroundColor: '#fff', borderWidth: 2, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, justifyContent: 'center', alignItems: 'center', gap: 3 },
  gripperLine: { width: 6, height: 1.5, opacity: 0.5, borderRadius: 1 },

  axis: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  axisTick: { fontSize: 10, fontWeight: "700" },

  inputsRow: { flexDirection: "row", paddingHorizontal: 16, marginTop: 24, marginBottom: 4, gap: 12 },
  inputCard: { flex: 1, borderRadius: 16, padding: 12, borderWidth: 1 },
  inputLabel: { fontSize: 12, fontWeight: "700", marginBottom: 8 },
  inputWrapper: { flexDirection: "row", alignItems: "center", borderRadius: 10, paddingHorizontal: 10, minHeight: 40 },
  timeInput: { flex: 1, fontSize: 14, fontWeight: "700" },
  applyBtn: {
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  applyBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  footer: { padding: 16, borderTopWidth: 1 },
  footerBtns: { flexDirection: "row", gap: 12 },
  btnSec: { flex: 1, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  btnSecTxt: { fontSize: 15, fontWeight: "700" },
  btnPrim: { flex: 1, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  btnPrimTxt: { color: "#fff", fontSize: 15, fontWeight: "700" },

  /* Keyboard Top Bar */
  kTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 56,
  },
  kBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  kBackText: {
    fontSize: 14,
    fontWeight: "600",
  },

  /* HowTo Modal Styles (Centered) */
  howToOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 9999
  },
  howToContentCentered: {
    width: '100%',
    maxWidth: 450,
    borderRadius: 28,
    padding: 24,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHowToHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  howToTitle: { fontSize: 20, fontWeight: '900' },
  howToStep: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 16,
  },
  stepNumBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumTxt: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  stepContentBox: {
    flex: 1,
  },
  stepTitleLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  stepDescLabel: {
    fontSize: 13,
    lineHeight: 18,
  },
  closeHowToBtn: {
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  closeHowToBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
