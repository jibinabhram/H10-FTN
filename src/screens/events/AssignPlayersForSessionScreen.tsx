import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  RefreshControl,
  Dimensions,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { getPlayersFromSQLite } from "../../services/playerCache.service";
import {
  saveSessionPlayers,
  saveSessionPodOverrides,
} from "../../services/sessionPlayer.service";
import { db } from "../../db/sqlite";
import { useTheme } from "../../components/context/ThemeContext";
import AssignPodModal from "../ClubAdmin/Players/AssignPodModal";

const { width } = Dimensions.get("window");

export default function AssignPlayersForSessionScreen({
  file,
  sessionId,
  eventDraft,
  goNext,
  goBack,
}: any) {
  const [players, setPlayers] = useState<any[]>([]);
  const [assigned, setAssigned] = useState<Record<string, boolean>>({});
  const [podMap, setPodMap] = useState<Record<string, string | null>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPlayerForPod, setSelectedPlayerForPod] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Theme
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const totalPlayers = players.length;
  const playingCount = Object.values(assigned).filter(v => v).length;
  const notPlayingCount = totalPlayers - playingCount;
  const allSelected = totalPlayers > 0 && playingCount === totalPlayers;

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const list = getPlayersFromSQLite();
    const assignedMap: Record<string, boolean> = {};
    const initialPodMap: Record<string, string | null> = {};

    list.forEach(p => {
      assignedMap[p.player_id] = true;
      if (p.pod_serial) {
        initialPodMap[p.pod_serial] = p.player_id;
      }
    });

    setPlayers(list);
    setAssigned(assignedMap);
    setPodMap(initialPodMap);
  };

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const toggle = (playerId: string) => {
    setAssigned(p => ({ ...p, [playerId]: !p[playerId] }));
  };

  const toggleSelectAll = () => {
    const newAssigned: Record<string, boolean> = {};
    players.forEach(p => {
      newAssigned[p.player_id] = !allSelected;
    });
    setAssigned(newAssigned);
  };

  const openSwitchPod = (player: any) => {
    setSelectedPlayerForPod(player);
    setModalVisible(true);
  };

  const handleAssignPod = (podSerial: string) => {
    if (!selectedPlayerForPod) return;
    setPodMap(prev => {
      const updated = { ...prev };
      // Remove this player from any other pod
      Object.entries(updated).forEach(([pod, owner]) => {
        if (owner === selectedPlayerForPod.player_id) updated[pod] = null;
      });
      updated[podSerial] = selectedPlayerForPod.player_id;
      return updated;
    });
    setModalVisible(false);
  };

  const handleUnassignPod = () => {
    if (!selectedPlayerForPod) return;
    setPodMap(prev => {
      const updated = { ...prev };
      Object.entries(updated).forEach(([pod, owner]) => {
        if (owner === selectedPlayerForPod.player_id) updated[pod] = null;
      });
      return updated;
    });
    setModalVisible(false);
  };

  const getEffectivePodForPlayer = (playerId: string) => {
    const entry = Object.entries(podMap).find(([, owner]) => owner === playerId);
    return entry?.[0] ?? null;
  };

  const onNext = async () => {
    try {
      await db.execute(
        `INSERT OR REPLACE INTO sessions (session_id, event_name, event_type, event_date, location, field, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [sessionId, eventDraft.eventName, eventDraft.eventType, eventDraft.eventDate, eventDraft.location || null, eventDraft.field || null, eventDraft.notes || null, Date.now()]
      );
      await saveSessionPlayers(sessionId, assigned);
      await saveSessionPodOverrides(sessionId, podMap);
      goNext({ step: "Trim", file, sessionId, eventDraft });
    } catch (e) {
      Alert.alert("Error", "Failed to save session setup");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? "#020617" : "#F8FAFC" }]}>
      {/* 🟢 HEADER WITH STEPPER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={isDark ? "#94A3B8" : "#475569"} />
          <Text style={[styles.backText, { color: isDark ? "#94A3B8" : "#475569" }]}>Back to event</Text>
        </TouchableOpacity>

        <View style={styles.stepperContainer}>
          <Step icon="calendar-outline" label="Event Details" active completed />
          <Line active />
          <Step icon="people" label="Add Players" active />
          <Line />
          <Step icon="cut-outline" label="Trim" />
          <Line />
          <Step icon="walk-outline" label="Add Exercise" />
          <Line />
          <Step icon="create-outline" label="Add Exercise" />
        </View>
      </View>

      {/* 🟢 STATS ROW */}
      <View style={styles.statsRow}>
        <StatBox label="Total no of players" value={totalPlayers} color="#EEF2FF" textColor="#4F46E5" />
        <StatBox label="No of players playing" value={playingCount} color="#F0FDF4" textColor="#16A34A" />
        <StatBox label="No of players not playing" value={notPlayingCount} color="#FEF2F2" textColor="#DC2626" />
      </View>

      {/* 🟢 SELECT ALL */}
      <View style={styles.selectAllRow}>
        <Text style={[styles.selectAllText, { color: isDark ? "#94A3B8" : "#64748B" }]}>Select all</Text>
        <TouchableOpacity onPress={toggleSelectAll} style={[styles.checkbox, allSelected && styles.checkboxActive, { borderColor: isDark ? "#334155" : "#CBD5E1" }]}>
          {allSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
        </TouchableOpacity>
      </View>

      {/* 🟢 PLAYER GRID */}
      <FlatList
        data={players}
        keyExtractor={p => p.player_id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />}
        renderItem={({ item }) => {
          const isAssigned = !!assigned[item.player_id];
          const effectivePod = getEffectivePodForPlayer(item.player_id);
          return (
            <View style={[styles.card, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF", borderColor: isDark ? "#334155" : "#E2E8F0" }]}>
              <TouchableOpacity onPress={() => toggle(item.player_id)} style={[styles.cardCheckbox, isAssigned && styles.cardCheckboxActive, { borderColor: isDark ? "#334155" : "#CBD5E1" }]}>
                {isAssigned && <Ionicons name="checkmark" size={14} color="#fff" />}
              </TouchableOpacity>

              <View style={[styles.jerseyCircle, { backgroundColor: isDark ? "#0F172A" : "#F8FAFC" }]}>
                <Text style={[styles.jerseyText, { color: isDark ? "#EF4444" : "#DC2626" }]}>{item.jersey_number || "00"}</Text>
              </View>

              <View style={styles.cardInfo}>
                <Text style={[styles.playerName, { color: isDark ? "#F8FAF8" : "#0F172A" }]} numberOfLines={1}>{item.player_name}</Text>
                <Text style={[styles.podId, { color: isDark ? "#94A3B8" : "#64748B" }]}>{effectivePod || "No Pod"}</Text>

                <View style={[styles.statusBadge, { backgroundColor: isAssigned ? "#F0FDF4" : "#F3F4F6" }]}>
                  <Text style={[styles.statusText, { color: isAssigned ? "#16A34A" : "#64748B" }]}>
                    {isAssigned ? "Playing" : "Not Playing"}
                  </Text>
                </View>
              </View>

              <TouchableOpacity style={[styles.switchPodBtn, { borderColor: isDark ? "#334155" : "#E2E8F0" }]} onPress={() => openSwitchPod(item)}>
                <Ionicons name="swap-horizontal" size={14} color={isDark ? "#94A3B8" : "#64748B"} />
                <Text style={[styles.switchPodText, { color: isDark ? "#94A3B8" : "#64748B" }]}>Switch pods</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />

      {/* 🟢 FOOTER */}
      <View style={[styles.footer, { backgroundColor: isDark ? "#020617" : "#FFFFFF", borderTopColor: isDark ? "#1E293B" : "#E2E8F0" }]}>
        <Text style={[styles.selectedCount, { color: "#16A34A" }]}>No of players Selected: {playingCount}</Text>
        <View style={styles.footerButtons}>
          <TouchableOpacity style={[styles.btnCancel, { backgroundColor: isDark ? "#1E293B" : "#E5E7EB" }]} onPress={goBack}>
            <Text style={[styles.btnCancelText, { color: isDark ? "#94A3B8" : "#475569" }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnNext} onPress={onNext}>
            <Text style={styles.btnNextText}>Next</Text>
          </TouchableOpacity>
        </View>
      </View>

      <AssignPodModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        playerName={selectedPlayerForPod?.player_name || ""}
        currentPod={getEffectivePodForPlayer(selectedPlayerForPod?.player_id)}
        availablePods={Object.entries(podMap).filter(([, v]) => v === null).map(([k]) => k)}
        onAssign={handleAssignPod}
        onUnassign={handleUnassignPod}
      />
    </View>
  );
}

const Step = ({ icon, label, active, completed }: any) => (
  <View style={styles.stepItem}>
    <View style={[styles.stepIcon, active && styles.stepIconActive, completed && styles.stepIconCompleted]}>
      <Ionicons name={icon} size={16} color={active || completed ? "#fff" : "#94A3B8"} />
    </View>
    <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text>
  </View>
);

const Line = ({ active }: any) => (
  <View style={[styles.stepLine, active && styles.stepLineActive]} />
);

const StatBox = ({ label, value, color, textColor }: any) => (
  <View style={[styles.statBox, { backgroundColor: color }]}>
    <Text style={[styles.statValue, { color: textColor }]}>{label}: {value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingTop: 8 },
  backBtn: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  backText: { marginLeft: 4, fontSize: 13, fontWeight: "600" },
  stepperContainer: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  stepItem: { alignItems: "center", width: 60 },
  stepIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  stepIconActive: { backgroundColor: "#EF4444", borderColor: "rgba(239, 68, 68, 0.2)" },
  stepIconCompleted: { backgroundColor: "#EF4444" },
  stepLabel: { fontSize: 9, color: "#94A3B8", marginTop: 4, textAlign: "center", fontWeight: "600" },
  stepLabelActive: { color: "#EF4444" },
  stepLine: { flex: 0.5, height: 2, backgroundColor: "#E5E7EB", marginTop: 15 },
  stepLineActive: { backgroundColor: "#EF4444" },

  statsRow: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  statBox: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  statValue: { fontSize: 10, fontWeight: "700" },

  selectAllRow: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", paddingHorizontal: 16, marginBottom: 12 },
  selectAllText: { fontSize: 13, fontWeight: "600", marginRight: 8 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  checkboxActive: { backgroundColor: "#94A3B8", borderColor: "#94A3B8" },

  listContainer: { paddingHorizontal: 12, paddingBottom: 120 },
  columnWrapper: { justifyContent: "space-between" },
  card: { width: (width - 32) / 2, borderRadius: 20, padding: 12, marginBottom: 12, borderWidth: 1, alignItems: "center" },
  cardCheckbox: { position: "absolute", left: 10, top: 10, width: 20, height: 20, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  cardCheckboxActive: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  jerseyCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  jerseyText: { fontSize: 18, fontWeight: "800" },
  cardInfo: { alignItems: "center", width: "100%" },
  playerName: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  podId: { fontSize: 11, fontWeight: "600", marginBottom: 6 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 10, fontWeight: "700" },
  switchPodBtn: { flexDirection: "row", alignItems: "center", marginTop: 10, borderTopWidth: 1, paddingTop: 10, width: "100%", justifyContent: "center" },
  switchPodText: { fontSize: 11, fontWeight: "700", marginLeft: 4 },

  footer: { padding: 20, borderTopWidth: 1 },
  selectedCount: { fontSize: 14, fontWeight: "700", textAlign: "right", marginBottom: 16 },
  footerButtons: { flexDirection: "row", gap: 12 },
  btnCancel: { flex: 1, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  btnCancelText: { fontSize: 15, fontWeight: "700" },
  btnNext: { flex: 1, height: 48, borderRadius: 12, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center" },
  btnNextText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
