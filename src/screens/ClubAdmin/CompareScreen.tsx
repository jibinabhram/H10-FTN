import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Picker } from "@react-native-picker/picker";
import { db } from "../../db/sqlite";
import { useTheme } from "../../components/context/ThemeContext";

export default function CompareScreen() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [players, setPlayers] = useState<number[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<number>(0);
  const [a, setA] = useState<any>(null);
  const [b, setB] = useState<any>(null);

  /* ================= LOAD PLAYER IDS ================= */

  useEffect(() => {
    const res = db.execute(
      "SELECT DISTINCT player_id FROM calculated_data ORDER BY player_id"
    );

    const ids =
      res.rows?._array?.map((r: any) => Number(r.player_id)) || [];

    if (ids.length > 0) {
      setPlayers(ids);
      setSelectedPlayer(ids[0]);
    }
  }, []);

  /* ================= LOAD LAST 2 MATCHES ================= */

  useEffect(() => {
    if (!selectedPlayer) return;

    const res = db.execute(
      `SELECT * FROM calculated_data
       WHERE player_id = ?
       ORDER BY created_at`,
      [selectedPlayer]
    );

    const rows = res.rows?._array || [];

    if (rows.length >= 2) {
      setA(rows[rows.length - 2]);
      setB(rows[rows.length - 1]);
    } else {
      setA(null);
      setB(null);
    }
  }, [selectedPlayer]);

  if (players.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: isDark ? "#020617" : "#FFFFFF" }]}>
        <Text style={{ color: isDark ? "#fff" : "#000" }}>No players available</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? "#020617" : "#FFFFFF" }} edges={["top", "left", "right"]}>
      <ScrollView
        style={[styles.container, { backgroundColor: isDark ? "#020617" : "#FFFFFF" }]}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: isDark ? "#FFFFFF" : "#0f172a" }]}>Match Comparison</Text>

        {/* PLAYER SELECT */}
        <View style={[styles.selector, { backgroundColor: isDark ? "#1E293B" : "#ffffff" }]}>
          <Text style={[styles.label, { color: isDark ? "#94A3B8" : "#1e3a8a" }]}>Select Player</Text>

          <View style={[styles.pickerWrapper, { backgroundColor: isDark ? "#334155" : "#f8fafc", borderColor: isDark ? "#475569" : "#c7d2fe" }]}>
            <Picker
              selectedValue={selectedPlayer}
              onValueChange={(v) => setSelectedPlayer(Number(v))}
              style={[styles.picker, { color: isDark ? "#FFFFFF" : "#0f172a" }]}
              itemStyle={styles.pickerItem}
              dropdownIconColor={isDark ? "#FFFFFF" : "#1e3a8a"}
            >
              {players.map((id) => (
                <Picker.Item
                  key={id}
                  label={`Player ${id}`}
                  value={id}
                  style={{ backgroundColor: isDark ? '#334155' : '#f8fafc', color: isDark ? '#FFFFFF' : '#000000' }}
                />
              ))}
            </Picker>
          </View>
        </View>

        {!a || !b ? (
          <Text style={[styles.empty, { color: isDark ? "#94A3B8" : "#64748b" }]}>
            Not enough matches for this player
          </Text>
        ) : (
          <>
            <Metric label="Total Distance (m)" a={a.total_distance} b={b.total_distance} isDark={isDark} />
            <Metric label="HSR Distance (m)" a={a.hsr_distance} b={b.hsr_distance} isDark={isDark} />
            <Metric label="Sprint Distance (m)" a={a.sprint_distance} b={b.sprint_distance} isDark={isDark} />

            <Metric label="Top Speed (m/s)" a={a.top_speed} b={b.top_speed} isDark={isDark} />
            <Metric label="Sprint Count" a={a.sprint_count} b={b.sprint_count} isDark={isDark} />

            <Metric label="Accelerations" a={a.accelerations} b={b.accelerations} isDark={isDark} />
            <Metric label="Decelerations" a={a.decelerations} b={b.decelerations} isDark={isDark} />
            <Metric label="Max Acceleration" a={a.max_acceleration} b={b.max_acceleration} isDark={isDark} />
            <Metric label="Max Deceleration" a={a.max_deceleration} b={b.max_deceleration} isDark={isDark} />

            <Metric label="Player Load" a={a.player_load} b={b.player_load} isDark={isDark} />
            <Metric label="Power Score" a={a.power_score} b={b.power_score} isDark={isDark} />

            <Metric label="HR Max" a={a.hr_max} b={b.hr_max} isDark={isDark} />
            <Metric label="Time in Red Zone" a={a.time_in_red_zone} b={b.time_in_red_zone} isDark={isDark} />
            <Metric label="% Time in Red Zone" a={a.percent_in_red_zone} b={b.percent_in_red_zone} isDark={isDark} />
            <Metric label="HR Recovery Time" a={a.hr_recovery_time} b={b.hr_recovery_time} isDark={isDark} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ================= METRIC ================= */

const Metric = ({ label, a, b, isDark }: any) => {
  const valA = Number(a ?? 0);
  const valB = Number(b ?? 0);

  if (valA === 0 && valB === 0) return null;

  const diff = (valB - valA).toFixed(2);
  const color =
    Number(diff) > 0 ? "#16a34a" :
      Number(diff) < 0 ? "#dc2626" :
        (isDark ? "#94A3B8" : "#475569");

  return (
    <View style={[styles.card, { backgroundColor: isDark ? "#1E293B" : "#ffffff" }]}>
      <Text style={[styles.metric, { color: isDark ? "#E2E8F0" : "#0f172a" }]}>{label}</Text>
      <Text style={{ color: isDark ? "#CBD5E1" : "#000000" }}>Match A: {valA}</Text>
      <Text style={{ color: isDark ? "#CBD5E1" : "#000000" }}>Match B: {valB}</Text>
      <Text style={[styles.diff, { color }]}>
        Difference: {diff > 0 ? "+" : ""}{diff}
      </Text>
    </View>
  );
};

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 12,
    color: "#0f172a",
  },
  selector: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    elevation: 2,
  },
  label: {
    fontWeight: "700",
    marginBottom: 6,
    fontSize: 14,
    color: "#1e3a8a",
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#c7d2fe",
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    minHeight: 56,
    justifyContent: "center",
  },
  picker: {
    height: Platform.OS === "android" ? 56 : 48,
    color: "#0f172a",
  },
  pickerItem: {
    height: 56,
    fontSize: 16,
  },
  card: {
    backgroundColor: "#ffffff",
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
    elevation: 2,
  },
  metric: {
    fontWeight: "700",
    marginBottom: 6,
    fontSize: 15,
    color: "#0f172a",
  },
  diff: {
    marginTop: 6,
    fontWeight: "700",
    fontSize: 14,
  },
  empty: {
    textAlign: "center",
    color: "#64748b",
    marginTop: 20,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
