import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";

import { fetchCsvFiles, downloadCsv } from "../../api/esp32";
import { importCsvToSQLite } from "../../services/csv.service";
import { calculateMetricsFromRaw } from "../../services/calculateMetrics.service";
import { exportTrimmedCsv } from "../../services/exportCsv.service";
import { debugDatabase } from "../../services/debug.service";
import { safeAlert } from "../../services/safeAlert.service";
import { getAssignedPlayersForSession } from "../../services/sessionPlayer.service";
import { ScrollView } from "react-native";
import { useTheme } from "../../components/context/ThemeContext";

/* ================= TIME HELPERS ================= */

// HH:MM:SS → milliseconds OFFSET (RELATIVE)
function timeToMs(timeStr: string): number {
  const parts = timeStr.split(":").map(Number);
  if (parts.length !== 3) throw new Error("Invalid time");

  const [h, m, s] = parts;

  if (
    isNaN(h) || isNaN(m) || isNaN(s) ||
    h < 0 || m < 0 || s < 0 ||
    m > 59 || s > 59
  ) {
    throw new Error("Invalid time");
  }

  return (h * 3600 + m * 60 + s) * 1000;
}

/* =====================================================
   🔧 FIXED: switched from useRoute() to props
===================================================== */

export default function ImportFromESP32({
  file,
  eventDraft,
  goBack,
}: {
  file?: string;
  eventDraft?: any;
  goBack: () => void;
}) {
  const mountedRef = useRef(true);

  /* ===== INIT FROM PROPS (EDIT MODE) ===== */
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(true);

  const [loading, setLoading] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [importedSession, setImportedSession] = useState<string | null>(null);

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [sessionPlayers, setSessionPlayers] = useState<any[]>([]);

  /* =====================================================
     🔧 FIXED: derived from props instead of route.params
  ===================================================== */

  const comingFromEvent = !!file;

  useEffect(() => {
    if (file) {
      setSelected(file);
      setDropdownOpen(false); // auto hide dropdown
    } else {
      loadFiles(); // load file list if NOT coming from event
    }
  }, [file]);

  useEffect(() => {
    if (!selected) return;

    const sessionId = selected.replace(".csv", "");
    const players = getAssignedPlayersForSession(sessionId);

    setSessionPlayers(players);
  }, [selected]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadFiles = async () => {
    try {
      setLoadingFiles(true);
      const list = await fetchCsvFiles();

      if (mountedRef.current) {
        setFiles(list);
        setDropdownOpen(true);
      }
    } catch {
      Alert.alert("ESP32 Not Reachable", "Connect phone to ESP32 Wi-Fi");
    } finally {
      if (mountedRef.current) setLoadingFiles(false);
    }
  };

  /* ================= IMPORT ================= */

  const importFile = async () => {
    if (!selected) {
      Alert.alert("Select CSV file");
      return;
    }

    try {
      const hasStart = startTime.trim().length > 0;
      const hasEnd = endTime.trim().length > 0;

      if (!hasStart || !hasEnd) {
        Alert.alert("Time Required", "Please fill BOTH start and end time");
        return;
      }

      const trimStartMs = timeToMs(startTime);
      const trimEndMs = timeToMs(endTime);

      if (trimStartMs >= trimEndMs) {
        Alert.alert("Invalid Range", "Start time must be before End time");
        return;
      }

      setLoading(true);
      setImportedSession(null);

      const sessionId = selected.replace(".csv", "");
      const csvText = await downloadCsv(selected);

      const assignedPlayers = getAssignedPlayersForSession(sessionId);

      await importCsvToSQLite(
        csvText,
        sessionId,
        trimStartMs,
        trimEndMs,
        {
          ...eventDraft,
          assignedPlayers, // 🔑 CRITICAL
        }
      );

      await calculateMetricsFromRaw(sessionId);
      debugDatabase(sessionId);

      setImportedSession(sessionId);
      Alert.alert("Success", "CSV imported & calculated successfully");
    } catch (err) {
      console.error("❌ IMPORT ERROR:", err);
      Alert.alert(
        "Invalid Time Format",
        "Please use HH:MM:SS (example: 00:10:30)"
      );
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  /* ================= EXPORT ================= */

  const downloadTrimmed = async () => {
    if (!importedSession) return;

    try {
      const path = await exportTrimmedCsv(importedSession);
      safeAlert("CSV Downloaded", `Saved to Downloads:\n${path}`);
    } catch {
      safeAlert("Download Failed", "No trimmed data found");
    }
  };

  /* ================= UI ================= */

  return (
    <View style={[styles.container, { backgroundColor: isDark ? "#020617" : "#FFFFFF" }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.box, { backgroundColor: isDark ? "#1E293B" : "#fff" }]}>
          {/* 🔧 FIXED: back navigation via props */}
          <TouchableOpacity onPress={goBack} style={{ marginBottom: 12 }}>
            <Text style={{ color: "#0284c7", fontWeight: "700" }}>← Back</Text>
          </TouchableOpacity>

          {eventDraft && (
            <View style={[styles.eventBox, { backgroundColor: isDark ? "#334155" : "#f8fafc" }]}>
              <Text style={[styles.eventTitle, { color: isDark ? "#fff" : "#000" }]}>Event Details</Text>

              <Text style={[styles.eventField, { color: isDark ? "#CBD5E1" : "#334155" }]}>
                Event Name: {eventDraft.eventName || "—"}
              </Text>

              <Text style={[styles.eventField, { color: isDark ? "#CBD5E1" : "#334155" }]}>
                Event Date: {eventDraft.eventDate || "—"}
              </Text>

              <Text style={[styles.eventField, { color: isDark ? "#CBD5E1" : "#334155" }]}>
                Event Type: {eventDraft.eventType || "—"}
              </Text>

              <Text style={[styles.eventField, { color: isDark ? "#CBD5E1" : "#334155" }]}>
                Location: {eventDraft.location || "—"}
              </Text>

              <Text style={[styles.eventField, { color: isDark ? "#CBD5E1" : "#334155" }]}>
                Field: {eventDraft.field || "—"}
              </Text>

              <Text style={[styles.eventField, { color: isDark ? "#CBD5E1" : "#334155" }]}>
                Notes: {eventDraft.notes || "—"}
              </Text>
            </View>
          )}

          {sessionPlayers.length > 0 && (
            <View style={[styles.playersBox, { backgroundColor: isDark ? "#334155" : "#F8FAFC" }]}>
              <Text style={[styles.eventTitle, { color: isDark ? "#fff" : "#000" }]}>Players (This Session)</Text>

              {sessionPlayers.map(p => (
                <View
                  key={p.player_id}
                  style={[
                    styles.playerRow,
                    { borderColor: isDark ? "#475569" : "#E5E7EB" },
                    !p.assigned && styles.playerUnassigned,
                  ]}
                >
                  <Text style={[styles.playerName, { color: isDark ? "#E2E8F0" : "#000" }]}>
                    {p.player_name}
                    {p.jersey_number != null && `  #${p.jersey_number}`}
                  </Text>

                  <Text style={[styles.playerMeta, { color: isDark ? "#94A3B8" : "#475569" }]}>
                    {p.position || "—"} • Pod: {p.effective_pod_serial || "Unassigned"}
                    {p.swapped && " (swapped)"}
                  </Text>

                  <Text
                    style={{
                      fontWeight: "700",
                      color: p.assigned ? "#16A34A" : "#DC2626",
                    }}
                  >
                    {p.assigned ? "PLAYING" : "NOT PLAYING"}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <Text style={[styles.label, { color: isDark ? "#fff" : "#000" }]}>Select Match</Text>

          {dropdownOpen && !comingFromEvent && (
            <View style={[styles.dropdownList, { borderColor: isDark ? "#475569" : "#cbd5e1" }]}>
              {loadingFiles ? (
                <ActivityIndicator />
              ) : (
                <FlatList
                  data={files}
                  keyExtractor={(i) => i}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.dropdownItem,
                        { borderColor: isDark ? "#475569" : "#e5e7eb", backgroundColor: isDark ? "#1E293B" : "#fff" },
                        selected === item && { backgroundColor: isDark ? "#334155" : "#e0f2fe" },
                      ]}
                      onPress={() => setSelected(item)}
                    >
                      <Text style={{ color: isDark ? "#E2E8F0" : "#000" }}>{item}</Text>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          )}

          {selected && (
            <>
              <Text style={[styles.trimTitle, { color: isDark ? "#fff" : "#000" }]}>Trim by Time (HH:MM:SS)</Text>

              <View style={styles.trimRow}>
                <TextInput
                  style={[styles.trimInput, { color: isDark ? "#fff" : "#000", borderColor: isDark ? "#475569" : "#000", backgroundColor: isDark ? "#334155" : "#fff" }]}
                  placeholder="Start (HH:MM:SS)"
                  placeholderTextColor={isDark ? "#94A3B8" : "#9ca3af"}
                  value={startTime}
                  onChangeText={setStartTime}
                />
                <TextInput
                  style={[styles.trimInput, { color: isDark ? "#fff" : "#000", borderColor: isDark ? "#475569" : "#000", backgroundColor: isDark ? "#334155" : "#fff" }]}
                  placeholder="End (HH:MM:SS)"
                  placeholderTextColor={isDark ? "#94A3B8" : "#9ca3af"}
                  value={endTime}
                  onChangeText={setEndTime}
                />
              </View>

              <TouchableOpacity
                style={[styles.importBtn, loading && { opacity: 0.6 }]}
                onPress={importFile}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.importText}>IMPORT & CALCULATE</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
      {importedSession && (
        <TouchableOpacity style={styles.downloadBtn} onPress={downloadTrimmed}>
          <Text style={styles.downloadText}>DOWNLOAD TRIMMED CSV</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#FFFFFF" },
  box: { backgroundColor: "#fff", borderRadius: 12, padding: 14 },
  label: { fontWeight: "700", marginBottom: 6 },

  dropdownList: {
    maxHeight: 220,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    marginTop: 6,
  },

  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
  },

  trimTitle: { marginTop: 16, fontWeight: "700" },
  trimRow: { flexDirection: "row", gap: 8, marginTop: 8 },

  trimInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },

  importBtn: {
    backgroundColor: "#16a34a",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 14,
  },

  importText: { color: "#fff", fontWeight: "700" },

  downloadBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 16,
  },

  downloadText: { color: "#fff", fontWeight: "700" },

  eventBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },

  eventTitle: {
    fontWeight: "700",
    marginBottom: 6,
  },

  eventField: {
    fontSize: 14,
    marginBottom: 4,
    color: "#334155",
  },
  playersBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },

  playerRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
  },

  playerUnassigned: {
    opacity: 0.5,
  },

  playerName: {
    fontWeight: "700",
    fontSize: 14,
  },

  playerMeta: {
    fontSize: 12,
    color: "#475569",
    marginTop: 2,
  },
  scrollContent: {
    paddingBottom: 120,
  },
});
