import React, { useEffect, useState, useCallback } from "react";
import {
  ScrollView,
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  Modal,
  Pressable,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { db } from "../../db/sqlite";
import PerformanceGraph from "../../components/PerformanceGraph";
import IndividualComparisonGraph from "../../components/IndividualComparisonGraph";
import { useTheme } from "../../components/context/ThemeContext";

/* ================= TYPES ================= */

type ComparisonMode = "team" | "individual";

/* ================= METRICS ================= */

const METRICS = [
  { key: "total_distance", label: "Total Distance (m)" },
  { key: "hsr_distance", label: "HSR Distance (m)" },
  { key: "sprint_distance", label: "Sprint Distance (m)" },
  { key: "top_speed", label: "Top Speed (m/s)" },
  { key: "sprint_count", label: "Sprint Count" },
  { key: "accelerations", label: "Accelerations" },
  { key: "decelerations", label: "Decelerations" },
  { key: "max_acceleration", label: "Max Acceleration (m/s²)" },
  { key: "max_deceleration", label: "Max Deceleration (m/s²)" },
  { key: "player_load", label: "Player Load" },
  { key: "power_score", label: "Power Score" },
  { key: "hr_max", label: "HR Max (bpm)" },
  { key: "time_in_red_zone", label: "Time in Red Zone (s)" },
  { key: "percent_in_red_zone", label: "% Time in Red Zone" },
  { key: "hr_recovery_time", label: "HR Recovery Time (s)" },
];

export default function PerformanceScreen() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [mode, setMode] = useState<ComparisonMode>("team");
  const [modeOpen, setModeOpen] = useState(false);

  const [sessions, setSessions] = useState<string[]>([]);
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);

  const [players, setPlayers] = useState<number[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);

  const [data, setData] = useState<any[]>([]);

  const [metric, setMetric] = useState("total_distance");
  const [metricOpen, setMetricOpen] = useState(false);

  const selectedMetricLabel =
    METRICS.find(m => m.key === metric)?.label ?? "";

  /* ================= LOAD SESSIONS ================= */

  useFocusEffect(
    useCallback(() => {
      const res = db.execute(`
        SELECT DISTINCT session_id
        FROM calculated_data
        ORDER BY created_at DESC
      `);

      const list =
        res.rows?._array?.map((r: any) => String(r.session_id)) || [];

      setSessions(list);
      setSelectedSessions(list.length ? [list[0]] : []);
      setSelectedPlayers([]);
      setData([]);
    }, [])
  );

  /* ================= LOAD PLAYERS ================= */

  useEffect(() => {
    if (!selectedSessions.length) {
      setPlayers([]);
      return;
    }

    const placeholders = selectedSessions.map(() => "?").join(",");

    const res = db.execute(
      `
      SELECT DISTINCT player_id
      FROM calculated_data
      WHERE session_id IN (${placeholders})
      ORDER BY player_id
      `,
      selectedSessions
    );

    setPlayers(res.rows?._array?.map((r: any) => Number(r.player_id)) || []);
    setSelectedPlayers([]);
    setData([]);
  }, [selectedSessions]);

  /* ================= LOAD GRAPH DATA ================= */

  useEffect(() => {
    if (!selectedPlayers.length || !selectedSessions.length) {
      setData([]);
      return;
    }

    const sessionPH = selectedSessions.map(() => "?").join(",");
    const playerPH = selectedPlayers.map(() => "?").join(",");

    const res = db.execute(
      `
      SELECT *
      FROM calculated_data
      WHERE session_id IN (${sessionPH})
        AND player_id IN (${playerPH})
      ORDER BY player_id, created_at
      `,
      [...selectedSessions, ...selectedPlayers]
    );

    setData(res.rows?._array ?? []);
  }, [selectedSessions, selectedPlayers]);

  /* ================= MODE CHANGE ================= */

  const applyMode = (m: ComparisonMode) => {
    setMode(m);
    setSelectedPlayers([]);
    setData([]);

    if (m === "team") {
      setSelectedSessions(prev => prev.slice(0, 1));
    } else {
      setSelectedSessions(sessions);
    }
  };

  const toggleSession = (sid: string) => {
    if (mode === "team") setSelectedSessions([sid]);
    else
      setSelectedSessions(prev =>
        prev.includes(sid)
          ? prev.filter(s => s !== sid)
          : [...prev, sid]
      );
  };

  const togglePlayer = (id: number) => {
    if (mode === "individual") setSelectedPlayers([id]);
    else
      setSelectedPlayers(prev =>
        prev.includes(id)
          ? prev.filter(p => p !== id)
          : [...prev, id]
      );
  };

  /* ================= UI ================= */

  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#020617' : '#FFFFFF' }]}>
      {/* LEFT PANEL */}
      <ScrollView style={[styles.leftPanel, { backgroundColor: isDark ? '#0F172A' : '#fff', borderColor: isDark ? '#1E293B' : '#e5e7eb' }]}>
        <View style={[styles.box, { backgroundColor: isDark ? '#1E293B' : '#ffffff' }]}>
          <Text style={[styles.label, { color: isDark ? '#fff' : '#000' }]}>
            {mode === "team" ? "Select Match" : "Select Matches"}
          </Text>

          {sessions.map(sid => (
            <TouchableOpacity
              key={sid}
              style={[
                styles.item,
                { backgroundColor: isDark ? '#334155' : '#e5e7eb' },
                selectedSessions.includes(sid) && { backgroundColor: '#2563eb' },
              ]}
              onPress={() => toggleSession(sid)}
            >
              <Text style={[{ color: isDark ? '#E2E8F0' : '#000' }, selectedSessions.includes(sid) && styles.activeText]}>
                {sid}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.box, { backgroundColor: isDark ? '#1E293B' : '#ffffff' }]}>
          <Text style={[styles.label, { color: isDark ? '#fff' : '#000' }]}>
            {mode === "team" ? "Select Players" : "Select Player"}
          </Text>

          {players.map(id => (
            <TouchableOpacity
              key={id}
              style={[
                styles.item,
                { backgroundColor: isDark ? '#334155' : '#e5e7eb' },
                selectedPlayers.includes(id) && { backgroundColor: '#2563eb' },
              ]}
              onPress={() => togglePlayer(id)}
            >
              <Text style={[{ color: isDark ? '#E2E8F0' : '#000' }, selectedPlayers.includes(id) && styles.activeText]}>
                Player {id}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* RIGHT PANEL (NOW SCROLLABLE ✅) */}
      <ScrollView
        style={styles.rightPanel}
        contentContainerStyle={styles.rightContent}
        showsVerticalScrollIndicator={true}
      >
        {/* TOP FILTER BAR */}
        <View style={styles.topBar}>
          <Pressable style={[styles.selectBox, { backgroundColor: isDark ? '#1E293B' : '#fff', borderColor: isDark ? '#334155' : '#c7d2fe' }]} onPress={() => setModeOpen(true)}>
            <Text style={{ color: isDark ? '#E2E8F0' : '#000' }}>
              {mode === "team"
                ? "Team Comparison"
                : "Individual Comparison"}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.selectBox, { backgroundColor: isDark ? '#1E293B' : '#fff', borderColor: isDark ? '#334155' : '#c7d2fe' }]}
            onPress={() => setMetricOpen(true)}
          >
            <Text style={{ color: isDark ? '#E2E8F0' : '#000' }}>{selectedMetricLabel}</Text>
          </Pressable>
        </View>

        {/* GRAPH */}
        <View style={[styles.graphBox, { backgroundColor: isDark ? '#1E293B' : '#ffffff' }]}>
          {data.length < 2 ? (
            <Text style={[styles.empty, { color: isDark ? '#94A3B8' : '#64748b' }]}>Not enough data</Text>
          ) : mode === "team" ? (
            <PerformanceGraph data={data} metric={metric} />
          ) : (
            <IndividualComparisonGraph data={data} metric={metric} />
          )}
        </View>
      </ScrollView>

      {/* MODE MODAL */}
      <Modal transparent visible={modeOpen} animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setModeOpen(false)}>
          <Pressable style={[styles.modal, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}>
            {(["team", "individual"] as ComparisonMode[]).map(m => (
              <TouchableOpacity
                key={m}
                style={[
                  styles.modalItem,
                  m === mode && styles.modalActive,
                ]}
                onPress={() => {
                  applyMode(m);
                  setModeOpen(false);
                }}
              >
                <Text style={[m === mode && styles.modalTextActive, { color: isDark ? (m === mode ? '#60A5FA' : '#E2E8F0') : (m === mode ? '#2563eb' : '#000') }]}>
                  {m === "team" ? "Team Comparison" : "Individual Comparison"}
                </Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* METRIC MODAL */}
      <Modal transparent visible={metricOpen} animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setMetricOpen(false)}>
          <Pressable style={[styles.modal, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}>
            <ScrollView>
              {METRICS.map(m => (
                <TouchableOpacity
                  key={m.key}
                  style={[
                    styles.modalItem,
                    m.key === metric && styles.modalActive,
                  ]}
                  onPress={() => {
                    setMetric(m.key);
                    setMetricOpen(false);
                  }}
                >
                  <Text style={[m.key === metric && styles.modalTextActive, { color: isDark ? (m.key === metric ? '#60A5FA' : '#E2E8F0') : (m.key === metric ? '#2563eb' : '#000') }]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
  },

  leftPanel: {
    width: 260,
    padding: 12,
    backgroundColor: "#fff",
    borderRightWidth: 1,
    borderColor: "#e5e7eb",
  },

  rightPanel: {
    flex: 1,
    paddingHorizontal: 16,
  },

  rightContent: {
    paddingVertical: 16,
  },

  topBar: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },

  box: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },

  label: {
    fontWeight: "700",
    marginBottom: 8,
  },

  item: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: "#e5e7eb",
  },

  itemActive: {
    backgroundColor: "#2563eb",
  },

  activeText: {
    color: "#fff",
    fontWeight: "700",
  },

  selectBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#fff",
    borderColor: "#c7d2fe",
  },

  graphBox: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    minHeight: 400,
  },

  empty: {
    textAlign: "center",
    color: "#64748b",
    marginTop: 20,
  },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
  },

  modal: {
    backgroundColor: "#fff",
    borderRadius: 12,
    margin: 20,
    maxHeight: "70%",
  },

  modalItem: {
    padding: 14,
  },

  modalActive: {
    backgroundColor: "#e0ecff",
  },

  modalTextActive: {
    fontWeight: "700",
    color: "#2563eb",
  },
});
