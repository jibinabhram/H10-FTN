import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from "react-native";
import { getPlayersFromSQLite } from "../../services/playerCache.service";
import {
  saveSessionPlayers,
  saveSessionPodOverrides,
} from "../../services/sessionPlayer.service";
import { db } from "../../db/sqlite";

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
  const [activePodMenu, setActivePodMenu] = useState<string | null>(null);

  const freePods = Object.entries(podMap)
    .filter(([, v]) => v === null)
    .map(([k]) => k);

  useEffect(() => {
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

    load();
  }, []);

  const getEffectivePodForPlayer = (playerId: string) => {
    const entry = Object.entries(podMap).find(
      ([, owner]) => owner === playerId
    );

    return entry?.[0] ?? null;
  };

  const toggle = (playerId: string) => {
    setAssigned(p => ({ ...p, [playerId]: !p[playerId] }));
  };

  const onNext = async () => {
    // 1️⃣ CREATE SESSION (ONCE)
    const result = await db.execute(
      `
      INSERT OR REPLACE INTO sessions (
        session_id,
        event_name,
        event_type,
        event_date,
        location,
        field,
        notes,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        sessionId,
        eventDraft.eventName,
        eventDraft.eventType,
        eventDraft.eventDate,
        eventDraft.location || null,
        eventDraft.field || null,
        eventDraft.notes || null,
        Date.now(),
      ]
    );
    console.log("🆕 SESSION INSERT rowsAffected:", result.rowsAffected);
    console.log("🆕 SESSION CREATED / VERIFIED:", sessionId);

    // 2️⃣ SAVE ASSIGNMENTS
    await saveSessionPlayers(sessionId, assigned);
    await saveSessionPodOverrides(sessionId, podMap);

    // 3️⃣ GO TO TRIM
    goNext({
      step: "Trim",
      file,
      sessionId,
      eventDraft,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Assign Players</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={players}
        keyExtractor={p => p.player_id}
        contentContainerStyle={{ paddingBottom: 80 }}
        renderItem={({ item }) => {
          const effectivePod = getEffectivePodForPlayer(item.player_id);
          const originalPod = item.pod_serial;
          return (
            <TouchableOpacity
              onPress={() => {
                if (activePodMenu) return;
                toggle(item.player_id);
              }}
              style={[
                styles.row,
                !assigned[item.player_id] && styles.unassigned,
              ]}
            >

              <Text style={styles.name}>{item.player_name}</Text>

              <Text style={styles.meta}>
                Pod: {effectivePod || "—"}
                {effectivePod && effectivePod !== originalPod && " (swapped)"}
              </Text>

              <Text
                style={[
                  styles.status,
                  { color: assigned[item.player_id] ? SUCCESS : DANGER },
                ]}
              >
                {assigned[item.player_id] ? "✓ Playing" : "✗ Not Playing"}
              </Text>


              {originalPod && (
                <>
                  <TouchableOpacity
                    onPress={() =>
                      setActivePodMenu(
                        activePodMenu === item.player_id
                          ? null
                          : item.player_id
                      )
                    }
                  >
                    <Text style={styles.link}>Switch Pod</Text>
                  </TouchableOpacity>

                  {activePodMenu === item.player_id && (
                    <View style={styles.switchMenu}>
                      <TouchableOpacity
                        onPress={() => {
                          setPodMap(prev => {
                            const updated = { ...prev };

                            // Remove any existing pod owned by this player
                            Object.entries(updated).forEach(([pod, owner]) => {
                              if (owner === item.player_id) {
                                updated[pod] = null;
                              }
                            });

                            return updated;
                          });

                          setActivePodMenu(null);
                        }}
                      >
                        <Text style={styles.disable}>Unassign Pod</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => {
                          if (!freePods.length) {
                            Alert.alert(
                              "No Pods Available",
                              "Unassign a pod first"
                            );
                            return;
                          }

                          Alert.alert(
                            "Assign Pod",
                            "Select a pod",
                            freePods.map(ps => ({
                              text: ps,
                              onPress: () => {
                                setPodMap(prev => {
                                  const updated = { ...prev };
                                  Object.entries(updated).forEach(([pod, owner]) => {
                                    if (owner === item.player_id) {
                                      updated[pod] = null;
                                    }
                                  });
                                  updated[ps] = item.player_id;
                                  return updated;
                                });
                                setActivePodMenu(null);
                              },
                            }))
                          );
                        }}
                      >
                        <Text style={styles.link}>Assign Pod</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </TouchableOpacity>
          );
        }}
      />

      <View style={{ paddingTop: 8 }}>
        <TouchableOpacity style={styles.nextBtn} onPress={onNext}>
          <Text style={styles.nextText}>NEXT</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const PRIMARY = "#2563EB";
const SUCCESS = "#16A34A";
const DANGER = "#DC2626";
const BORDER = "#E5E7EB";
const BG = "#F8FAFC";
const TEXT_MUTED = "#475569";

const styles = StyleSheet.create({
  /* ===== SCREEN ===== */
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: BG,
  },

  /* ===== HEADER ===== */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  backText: {
    color: PRIMARY,
    fontWeight: "700",
  },

  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },

  /* ===== PLAYER ROW ===== */
  row: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },

  unassigned: {
    backgroundColor: "#FEF2F2",
    borderColor: DANGER,
    opacity: 0.9,
  },

  /* ===== PLAYER TEXT ===== */
  name: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },

  meta: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginBottom: 6,
  },

  status: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },

  /* ===== LINKS / ACTIONS ===== */
  link: {
    color: PRIMARY,
    fontWeight: "600",
    marginTop: 6,
  },

  disable: {
    color: DANGER,
    fontWeight: "600",
    marginTop: 6,
  },

  /* ===== SWITCH POD MENU ===== */
  switchMenu: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: BORDER,
  },

  /* ===== NEXT BUTTON ===== */
  nextBtn: {
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },

  nextText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.5,
  },
});
