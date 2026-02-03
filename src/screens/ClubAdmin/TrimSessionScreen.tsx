import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  Dimensions,
  ScrollView,
  TextInput,
} from "react-native";
import Svg, { Polyline } from "react-native-svg";
import { db } from "../../db/sqlite";
import { useTheme } from "../../components/context/ThemeContext";
import { parseFileTimeRange } from "../../utils/parseFileTimeRange";
import { getAssignedPlayersForSession } from "../../services/sessionPlayer.service";
/* =====================================================
   HELPERS
===================================================== */

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
function formatOffset(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function parseOffsetToMs(time: string) {
  const parts = time.split(":").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;

  const [h, m, s] = parts;
  return ((h * 60 + m) * 60 + s) * 1000;
}


const HANDLE_GAP = 0.02;
const GRAPH_VIEWPORT_HEIGHT = 220;
const GRAPH_RIGHT_GUTTER = 14;
/* =====================================================
   WAVEFORM
===================================================== */

function PlayerActivityGraph({
  width,
  height,
  seed,
  points = 180,
  isDark
}: {
  width: number;
  height: number;
  seed: string;
  points?: number;
  isDark: boolean;
}) {
  const polyline = useMemo(() => {
    // deterministic RNG per player
    let s = 0;
    for (let i = 0; i < seed.length; i++) {
      s = (s + seed.charCodeAt(i) * 13) % 100000;
    }

    const rand = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };

    const center = height * 0.5;
    const calmNoise = height * 0.015;
    const activeNoise = height * 0.12;

    let y = center;
    let activity = false;
    let activityTimer = 0;

    return Array.from({ length: points }, (_, i) => {
      const x = (i / (points - 1)) * width;

      // toggle activity clusters
      if (!activity && rand() < 0.02) {
        activity = true;
        activityTimer = 8 + rand() * 20;
      }

      if (activity) {
        y += (rand() - 0.5) * activeNoise;
        activityTimer--;
        if (activityTimer <= 0) activity = false;
      } else {
        y += (rand() - 0.5) * calmNoise;
      }

      // clamp to keep it visually calm like the screenshot
      y = Math.max(height * 0.25, Math.min(height * 0.75, y));

      return `${x},${y}`;
    }).join(" ");
  }, [width, height, seed, points]);

  return (
    <Svg width={width} height={height}>
      <Polyline
        points={polyline}
        stroke={isDark ? "#A7F3D0" : "#3E5C5A"}
        strokeWidth={1.2}
        fill="none"
      />
    </Svg>
  );
}

/* =====================================================
   SCREEN
===================================================== */

export default function TrimSessionScreen({
  file,
  sessionId,
  eventDraft,
  goBack,
  goNext,
}: any) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const parsed = parseFileTimeRange(file);

  if (!parsed) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? "#020617" : "#FFFFFF" }]}>
        <Text style={styles.error}>Invalid or missing session file</Text>
        <TouchableOpacity onPress={goBack}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { fileStartMs, fileEndMs, durationMs } = parsed;
  const graphWidth = Dimensions.get("window").width * 0.6;
  const effectiveGraphWidth = graphWidth - GRAPH_RIGHT_GUTTER;

  /* ================= PLAYERS ================= */

  const [players, setPlayers] = useState<any[]>([]);

  useEffect(() => {
    const list = getAssignedPlayersForSession(sessionId).filter(
      p => p.assigned
    );
    setPlayers(list);
  }, [sessionId]);

  /* ================= TRIM STATE ================= */

  const [startRatio, setStartRatio] = useState(0);
  const [endRatio, setEndRatio] = useState(1);
  const [manualStart, setManualStart] = useState("");
  const [manualEnd, setManualEnd] = useState("");
  const [isEditingManual, setIsEditingManual] = useState(false);

  const startRef = useRef(0);
  const endRef = useRef(1);

  const ROW_HEIGHT = 52;
  const HEADER_HEIGHT = 24;
  const graphHeight =
    HEADER_HEIGHT + players.length * ROW_HEIGHT;

  /* ================= PAN HANDLERS ================= */

  const startPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => {
        let next = startRef.current + g.dx / effectiveGraphWidth;
        next = Math.max(0, Math.min(next, endRef.current - HANDLE_GAP));
        setStartRatio(next);
      },
      onPanResponderRelease: () => {
        startRef.current = startRatio;
      },
    })
  ).current;

  const endPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => {
        let next = endRef.current + g.dx / effectiveGraphWidth;
        next = Math.min(1, Math.max(next, startRef.current + HANDLE_GAP));
        setEndRatio(next);
      },
      onPanResponderRelease: () => {
        endRef.current = endRatio;
      },
    })
  ).current;

  /* ================= TIMES ================= */

  const trimStartTs = fileStartMs + durationMs * startRatio;
  const trimEndTs = fileStartMs + durationMs * endRatio;
  useEffect(() => {
    if (isEditingManual) return;

    setManualStart(formatOffset(trimStartTs - fileStartMs));
    setManualEnd(formatOffset(trimEndTs - fileStartMs));
  }, [trimStartTs, trimEndTs, isEditingManual, fileStartMs]);

  const applyManualTrim = () => {
    const startOffsetMs = parseOffsetToMs(manualStart);
    const endOffsetMs = parseOffsetToMs(manualEnd);

    if (
      startOffsetMs == null ||
      endOffsetMs == null ||
      endOffsetMs <= startOffsetMs
    ) {
      return;
    }

    const newStartRatio = startOffsetMs / durationMs;
    const newEndRatio = endOffsetMs / durationMs;

    const clampedStart = Math.max(0, Math.min(newStartRatio, 1));
    const clampedEnd = Math.max(0, Math.min(newEndRatio, 1));

    setStartRatio(clampedStart);
    setEndRatio(clampedEnd);

    startRef.current = clampedStart;
    endRef.current = clampedEnd;

    setIsEditingManual(false);
  };

  /* ================= SAVE ================= */

  const onNext = async () => {
    console.log("✂️ TRIM SAVE (intent)", {
      sessionId,
      fileStartMs,
      fileEndMs,
      trimStartTs: Math.round(trimStartTs),
      trimEndTs: Math.round(trimEndTs),
    });

    const result = await db.execute(
      `
      UPDATE sessions
      SET
        file_start_ts = ?,
        file_end_ts = ?,
        trim_start_ts = ?,
        trim_end_ts = ?
      WHERE session_id = ?
      `,
      [
        fileStartMs,
        fileEndMs,
        Math.round(trimStartTs),
        Math.round(trimEndTs),
        sessionId,
      ]
    );

    // 🔍 Verify update actually hit a row
    const rowsAffected = result?.rowsAffected ?? 0;
    if (rowsAffected === 0) {
      console.error("❌ TRIM SAVE FAILED — session does not exist", sessionId);
      return;
    }

    const res = await db.execute(
      `SELECT * FROM sessions WHERE session_id = ?`,
      [sessionId]
    );

    const sessionData = (res && res.rows && res.rows._array) ? res.rows._array[0] : (Array.isArray(res) ? res[0] : null);

    console.log(
      "✅ TRIM SAVE (sqlite confirmed)",
      sessionData
    );

    goNext({
      file,
      sessionId,
      eventDraft,
      trimStartTs: Math.round(trimStartTs),
      trimEndTs: Math.round(trimEndTs),
    });
  };

  /* ================= UI ================= */

  return (
    <View style={[styles.container, { backgroundColor: isDark ? "#020617" : "#FFFFFF" }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? "#fff" : "#111827" }]}>Trim Session</Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={[styles.hint, { color: isDark ? "#94A3B8" : "#64748B" }]}>
        Drag the triangles to select the event time range
      </Text>

      <View style={[styles.graphWrapper, { borderColor: isDark ? "#334155" : "#E5E7EB" }]}>

        {/* 🔒 STICKY HANDLE OVERLAY */}
        <View style={styles.handleOverlay}>
          <View style={styles.playerSpacer} />

          <View style={styles.timelineGraph}>
            <View
              {...startPan.panHandlers}
              style={[
                styles.trimHandle,
                {
                  left: `${startRatio * 100}%`,
                  height: graphHeight,
                },
              ]}
            >
              <View style={[styles.handleTriangle, { borderTopColor: isDark ? "#fff" : "#111827" }]} />
              <View style={[styles.handleLine, { backgroundColor: isDark ? "rgba(255,255,255,0.6)" : "rgba(17,24,39,0.6)" }]} />
            </View>

            <View
              {...endPan.panHandlers}
              style={[
                styles.trimHandle,
                {
                  left: `${endRatio * 100}%`,
                  height: graphHeight,
                },
              ]}
            >
              <View style={[styles.handleTriangle, { borderTopColor: isDark ? "#fff" : "#111827" }]} />
              <View style={[styles.handleLine, { backgroundColor: isDark ? "rgba(255,255,255,0.6)" : "rgba(17,24,39,0.6)" }]} />
            </View>
          </View>
        </View>

        {/* 📜 SCROLLING CONTENT */}
        <ScrollView showsVerticalScrollIndicator>
          {players.map(p => (
            <View key={p.player_id} style={styles.row}>
              <View style={styles.playerCell}>
                <Text style={[styles.playerName, { color: isDark ? "#E2E8F0" : "#111827" }]}>{p.player_name}</Text>
              </View>

              <View style={styles.graphCell}>
                <View style={[styles.waveBg, { backgroundColor: isDark ? "#064E3B" : "#E6FAF0" }]} />

                <View
                  style={[
                    styles.activeRange,
                    {
                      left: `${Math.max(startRatio * 100, 1)}%`,
                      width: `${(endRatio - startRatio) * 100}%`,
                    },
                  ]}
                />

                <PlayerActivityGraph
                  width={graphWidth}
                  height={52}
                  seed={p.player_id}
                  isDark={isDark}
                />
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
      {/* ⌨️ MANUAL TRIM INPUT */}
      <View style={styles.manualTrimRow}>
        <Text style={[styles.manualLabel, { color: isDark ? "#94A3B8" : "#334155" }]}>Manual trim:</Text>

        <TextInput
          value={manualStart}
          onFocus={() => setIsEditingManual(true)}
          onChangeText={setManualStart}
          placeholder="HH:MM:SS"
          placeholderTextColor={isDark ? "#64748B" : "#9CA3AF"}
          style={[styles.timeInput, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF", color: isDark ? "#fff" : "#000", borderColor: isDark ? "#334155" : "#CBD5E1" }]}
        />

        <TextInput
          value={manualEnd}
          onFocus={() => setIsEditingManual(true)}
          onChangeText={setManualEnd}
          placeholder="HH:MM:SS"
          placeholderTextColor={isDark ? "#64748B" : "#9CA3AF"}
          style={[styles.timeInput, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF", color: isDark ? "#fff" : "#000", borderColor: isDark ? "#334155" : "#CBD5E1" }]}
        />

        <TouchableOpacity
          onPress={applyManualTrim}
          style={styles.applyBtn}
        >
          <Text style={styles.applyText}>APPLY</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.rangeText, { color: isDark ? "#94A3B8" : "#334155" }]}>
        Event time range: {formatTime(trimStartTs)} – {formatTime(trimEndTs)}
      </Text>

      <View style={styles.footer}>
        <TouchableOpacity onPress={goBack}>
          <Text style={styles.back}>BACK</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.nextBtn} onPress={onNext}>
          <Text style={styles.nextText}>NEXT</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* =====================================================
   STYLES
===================================================== */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 16,
  },
  error: {
    color: "#DC2626",
    fontWeight: "700",
    textAlign: "center",
    marginTop: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  back: {
    color: "#2563EB",
    fontWeight: "700",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  hint: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 8,
  },
  graphWrapper: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
    height: GRAPH_VIEWPORT_HEIGHT,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    height: 52,
    alignItems: "center",
  },
  playerCell: {
    width: "40%",
    paddingLeft: 8,
  },
  playerName: {
    fontSize: 13,
    color: "#111827",
  },
  graphCell: {
    width: "60%",
    height: "100%",
    justifyContent: "center",
    position: "relative",
  },
  waveBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#E6FAF0",
  },
  activeRange: {
    position: "absolute",
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(34,197,94,0.35)",
  },
  verticalLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 0.75,
    backgroundColor: "rgba(17,24,39,0.6)",
    zIndex: 5,
  },
  rangeText: {
    marginTop: 8,
    fontSize: 13,
    textAlign: "center",
    fontWeight: "600",
    color: "#334155",
  },
  footer: {
    marginTop: "auto",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  nextBtn: {
    backgroundColor: "#16A34A",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
  },
  nextText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  handleOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 24,
    flexDirection: "row",
    zIndex: 50,
    pointerEvents: "box-none",
  },
  playerSpacer: {
    width: "40%",
  },
  timelineGraph: {
    width: "60%",
    position: "relative",
    paddingRight: GRAPH_RIGHT_GUTTER,
  },
  trimHandle: {
    position: "absolute",
    top: 0,
    alignItems: "center",
    zIndex: 50,
    pointerEvents: "box-none",
  },
  handleTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#111827",
  },
  handleLine: {
    flex: 1,
    width: 0.75,
    backgroundColor: "rgba(17,24,39,0.6)",
    marginTop: 2,
  },
  manualTrimRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    gap: 6,
  },

  manualLabel: {
    fontSize: 12,
    color: "#334155",
    marginRight: 6,
  },

  timeInput: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    width: 90,
    fontSize: 12,
    backgroundColor: "#FFFFFF",
  },

  applyBtn: {
    marginLeft: 8,
    backgroundColor: "#2563EB",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },

  applyText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
  },
});
