import React, { useEffect, useState, useMemo } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    Alert,
    TextInput,
    ScrollView,
    ActivityIndicator,
    Platform,
    RefreshControl,
    Dimensions,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { getPlayersFromSQLite } from "../../services/playerCache.service";
import {
    saveSessionPlayers,
    saveSessionPodOverrides,
    getAssignedPlayersForSession,
    getSessionPodOverrides,
} from "../../services/sessionPlayer.service";
import { db } from "../../db/sqlite";
import { useTheme } from "../../components/context/ThemeContext";
import AssignPodModal from "../ClubAdmin/Players/AssignPodModal";

const { width } = Dimensions.get("window");

export default function AssignPlayersForSessionScreen({
    file,
    sessionId,
    eventDraft,
    initialSearch,
    goNext,
    goBack,
}: any) {
    const [players, setPlayers] = useState<any[]>([]);
    const [assigned, setAssigned] = useState<Record<string, boolean>>({});
    const [podMap, setPodMap] = useState<Record<string, string | null>>({});
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedPlayerForPod, setSelectedPlayerForPod] = useState<any>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState(initialSearch || "");

    const { theme } = useTheme();
    const isDark = theme === "dark";
    const PRIMARY = "#DC2626";

    const filteredPlayers = useMemo(() => {
        if (!search) return players;
        const s = search.toLowerCase();
        return players.filter(p =>
            p.player_name?.toLowerCase().includes(s) ||
            p.jersey_number?.toString().includes(s) ||
            p.pod_serial?.toLowerCase().includes(s)
        );
    }, [players, search]);

    const totalPlayers = players.length;
    const playingCount = Object.values(assigned).filter(v => v).length;
    const notPlayingCount = totalPlayers - playingCount;

    const allFilteredSelected = useMemo(() => {
        if (filteredPlayers.length === 0) return false;
        return filteredPlayers.every(p => assigned[p.player_id]);
    }, [filteredPlayers, assigned]);

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        const list = getPlayersFromSQLite();

        // 1. Try to load previously saved assignments for this session
        const existingAssignmentsRes = db.execute(
            `SELECT player_id, assigned FROM session_players WHERE session_id = ?`,
            [sessionId]
        );
        const existingAssignments = (existingAssignmentsRes as any)?.rows?._array || [];

        // 2. Try to load existing pod overrides
        const existingPodOverrides = getSessionPodOverrides(sessionId);

        const assignedMap: Record<string, boolean> = {};
        const initialPodMap: Record<string, string | null> = {};

        // If we have previous assignments, use them. Otherwise default to all assigned.
        if (existingAssignments.length > 0) {
            const assignmentLookup: Record<string, boolean> = {};
            existingAssignments.forEach((a: any) => {
                assignmentLookup[a.player_id] = !!a.assigned;
            });

            list.forEach(p => {
                assignedMap[p.player_id] = assignmentLookup.hasOwnProperty(p.player_id) ? assignmentLookup[p.player_id] : true;
            });
        } else {
            list.forEach(p => {
                assignedMap[p.player_id] = true;
            });
        }

        // If we have pod overrides, use them. Otherwise default to player default pods.
        if (Object.keys(existingPodOverrides).length > 0) {
            Object.assign(initialPodMap, existingPodOverrides);

            // Also ensure any default pods of players that AREN'T overridden are in the map
            // BUT wait, initialPodMap key is podSerial.
            // Let's rebuild the initialPodMap accurately.
            // If session has overrides, we use them as the base.
            // Players that were NOT in the override list should use their defaults IF those defaults weren't taken.

            list.forEach(p => {
                // Find if this player has an override
                const playerOverride = Object.entries(existingPodOverrides).find(([, pid]) => pid === p.player_id);
                if (!playerOverride && p.pod_serial) {
                    // If player has no override and their default pod isn't assigned to someone else
                    if (!existingPodOverrides.hasOwnProperty(p.pod_serial)) {
                        initialPodMap[p.pod_serial] = p.player_id;
                    }
                }
            });
        } else {
            list.forEach(p => {
                if (p.pod_serial) {
                    initialPodMap[p.pod_serial] = p.player_id;
                }
            });
        }

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

    /* 🟢 AUTO-SAVE ON UNMOUNT (Sidebar Click) */
    const latestState = React.useRef({ assigned, podMap });
    useEffect(() => {
        latestState.current = { assigned, podMap };
    }, [assigned, podMap]);

    useEffect(() => {
        return () => {
            // This runs if user switches sidebar menus
            (async () => {
                try {
                    console.log("[AssignPlayers] Auto-saving to DB...");
                    await saveSessionPlayers(sessionId, latestState.current.assigned);
                    await saveSessionPodOverrides(sessionId, latestState.current.podMap);
                } catch (e) {
                    console.error("[AssignPlayers] Auto-save failed", e);
                }
            })();
        };
    }, [sessionId]);

    const toggle = (playerId: string) => {
        setAssigned(p => ({ ...p, [playerId]: !p[playerId] }));
    };

    const toggleSelectAll = () => {
        const newAssigned = { ...assigned };
        const targetState = !allFilteredSelected;
        filteredPlayers.forEach(p => {
            newAssigned[p.player_id] = targetState;
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
            // 1. Ensure record exists (INSERT IGNORE)
            await db.execute(
                `INSERT OR IGNORE INTO sessions (session_id, event_name, event_type, event_date, created_at) VALUES (?, ?, ?, ?, ?)`,
                [sessionId, eventDraft.eventName, eventDraft.eventType, eventDraft.eventDate, Date.now()]
            );
            // 2. Update descriptive fields (preserve trim_start_ts, etc)
            await db.execute(
                `UPDATE sessions SET event_name=?, event_type=?, event_date=?, location=?, field=?, notes=? WHERE session_id=?`,
                [eventDraft.eventName, eventDraft.eventType, eventDraft.eventDate, eventDraft.location || null, eventDraft.field || null, eventDraft.notes || null, sessionId]
            );
            await saveSessionPlayers(sessionId, assigned);
            await saveSessionPodOverrides(sessionId, podMap);
            goNext({ step: "Trim", file, sessionId, eventDraft, search });
        } catch (e) {
            Alert.alert("Error", "Failed to save session setup");
        }
    };

    const handleBack = async () => {
        try {
            await saveSessionPlayers(sessionId, assigned);
            await saveSessionPodOverrides(sessionId, podMap);
        } catch { }
        goBack({ search });
    };

    return (
        <View style={[styles.container, { backgroundColor: isDark ? "#020617" : "#F8FAFC" }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
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
                </View>
            </View>

            <View style={styles.statsRow}>
                <StatBox label="Total no of players" value={totalPlayers} color="#EEF2FF" textColor="#4F46E5" />
                <StatBox label="No of players playing" value={playingCount} color="#F0FDF4" textColor="#16A34A" />
                <StatBox label="No of players not playing" value={notPlayingCount} color="#FEF2F2" textColor="#DC2626" />
            </View>

            <View style={styles.controlsRow}>
                <View style={[styles.searchContainer, { backgroundColor: isDark ? "#F8FAFC" : "#fff", borderColor: isDark ? "#334155" : "#E2E8F0" }]}>
                    <Ionicons name="search" size={18} color="#94A3B8" />
                    <TextInput
                        placeholder="Search players..."
                        placeholderTextColor="#94A3B8"
                        style={[styles.searchInput, { color: isDark ? "#fff" : "#000" }]}
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>

                <TouchableOpacity onPress={toggleSelectAll} style={styles.selectAllBtn}>
                    <Text style={[styles.selectAllText, { color: isDark ? "#94A3B8" : "#64748B" }]}>Select all</Text>
                    <View style={[styles.checkbox, allFilteredSelected && styles.checkboxActive, { borderColor: isDark ? "#334155" : "#CBD5E1" }]}>
                        {allFilteredSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                </TouchableOpacity>
            </View>

            <FlatList
                data={filteredPlayers}
                keyExtractor={p => p.player_id}
                numColumns={2}
                columnWrapperStyle={styles.columnWrapper}
                contentContainerStyle={styles.listContainer}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
                renderItem={({ item }) => {
                    const isAssigned = !!assigned[item.player_id];
                    const effectivePod = getEffectivePodForPlayer(item.player_id);
                    return (
                        <View style={[styles.card, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF", borderColor: isDark ? "#334155" : "#E2E8F0" }]}>
                            <View style={styles.cardHeader}>
                                <TouchableOpacity onPress={() => toggle(item.player_id)} style={[styles.inlineCheckbox, isAssigned && styles.checkboxActiveSmall, { borderColor: isDark ? "#334155" : "#CBD5E1" }]}>
                                    {isAssigned && <Ionicons name="checkmark" size={10} color="#fff" />}
                                </TouchableOpacity>

                                <View style={styles.jerseyCircle}>
                                    <Text style={styles.jerseyText}>{item.jersey_number || "00"}</Text>
                                </View>

                                <View style={styles.playerMeta}>
                                    <Text style={[styles.pName, { color: isDark ? "#F8FAF8" : "#1E293B" }]} numberOfLines={1}>{item.player_name}</Text>
                                    <Text style={styles.pPod} numberOfLines={1}>{effectivePod || "No Pod"}</Text>
                                </View>

                                <View style={[styles.miniStatusBadge, { backgroundColor: isAssigned ? "#F0FDF4" : "#F3F4F6" }]}>
                                    <Text style={[styles.miniStatusText, { color: isAssigned ? "#16A34A" : "#64748B" }]}>
                                        {isAssigned ? "Playing" : "Not Playing"}
                                    </Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={styles.switchBtnCompact}
                                onPress={() => openSwitchPod(item)}
                            >
                                <Ionicons name="swap-horizontal" size={12} color="#64748B" />
                                <Text style={styles.switchBtnText}>Switch pods</Text>
                            </TouchableOpacity>
                        </View>
                    );
                }}
                ListEmptyComponent={
                    <View style={styles.emptyWrap}>
                        <Ionicons name="people-outline" size={48} color="#CBD5E1" />
                        <Text style={styles.emptyMsg}>No players found</Text>
                    </View>
                }
            />

            <View style={[styles.footer, { backgroundColor: isDark ? "#020617" : "#FFFFFF", borderTopColor: isDark ? "#1E293B" : "#E2E8F0" }]}>
                <Text style={[styles.selectedTxt, { color: "#16A34A" }]}>No of players Selected: {playingCount}</Text>
                <View style={styles.footerBtns}>
                    <TouchableOpacity style={[styles.btnSec, { backgroundColor: isDark ? "#1E293B" : "#F1F5F9" }]} onPress={goBack}>
                        <Text style={[styles.btnSecTxt, { color: isDark ? "#94A3B8" : "#475569" }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnPrim} onPress={onNext}>
                        <Text style={styles.btnPrimTxt}>Next</Text>
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
        <View style={[styles.stepOuter, active && styles.stepOuterActive, completed && styles.stepOuterCompleted]}>
            <Ionicons name={icon} size={14} color={active || completed ? "#fff" : "#94A3B8"} />
        </View>
        <Text style={[styles.stepTxt, active && styles.stepTxtActive]}>{label}</Text>
    </View>
);

const Line = ({ active }: any) => (
    <View style={[styles.sLine, active && styles.sLineActive]} />
);

const StatBox = ({ label, value, color, textColor }: any) => (
    <View style={[styles.sBox, { backgroundColor: color }]}>
        <Text style={[styles.sVal, { color: textColor }]}>{label}: {value}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { padding: 16, paddingTop: 8 },
    backBtn: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
    backText: { marginLeft: 4, fontSize: 13, fontWeight: "600" },
    stepperContainer: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
    stepItem: { alignItems: "center", width: 55 },
    stepOuter: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
    stepOuterActive: { backgroundColor: "#EF4444", borderColor: "rgba(239, 68, 68, 0.2)" },
    stepOuterCompleted: { backgroundColor: "#EF4444" },
    stepTxt: { fontSize: 8, color: "#94A3B8", marginTop: 4, textAlign: "center", fontWeight: "600" },
    stepTxtActive: { color: "#EF4444" },
    sLine: { flex: 0.4, height: 2, backgroundColor: "#E5E7EB", marginTop: 15 },
    sLineActive: { backgroundColor: "#EF4444" },

    statsRow: { flexDirection: "row", paddingHorizontal: 16, gap: 6, marginVertical: 10 },
    sBox: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center", justifyContent: 'center' },
    sVal: { fontSize: 9, fontWeight: "700", textAlign: 'center' },

    controlsRow: { flexDirection: 'row', paddingHorizontal: 16, alignItems: 'center', marginBottom: 10, gap: 10 },
    searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, height: 38, borderRadius: 10, borderWidth: 1 },
    searchInput: { flex: 1, marginLeft: 6, fontSize: 13, padding: 0 },
    selectAllBtn: { flexDirection: "row", alignItems: "center" },
    selectAllText: { fontSize: 12, fontWeight: "600", marginRight: 6 },
    checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, alignItems: "center", justifyContent: "center" },
    checkboxActive: { backgroundColor: "#94A3B8", borderColor: "#94A3B8" },

    listContainer: { paddingHorizontal: 10, paddingBottom: 20 },
    columnWrapper: { justifyContent: "space-between", gap: 8 },
    card: {
        flex: 1,
        borderRadius: 14,
        padding: 8,
        marginBottom: 6,
        borderWidth: 1,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center' },
    inlineCheckbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 2, alignItems: "center", justifyContent: "center" },
    checkboxActiveSmall: { backgroundColor: "#DC2626", borderColor: "#DC2626" },
    jerseyCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 8,
        borderWidth: 1,
        borderColor: '#FCA5A5'
    },
    jerseyText: { fontSize: 11, fontWeight: '800', color: '#DC2626' },
    playerMeta: { flex: 1, marginRight: 4 },
    pName: { fontSize: 11, fontWeight: "700" },
    pPod: { fontSize: 9, color: "#64748B", marginTop: 1 },
    miniStatusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
    miniStatusText: { fontSize: 8, fontWeight: "700" },
    switchBtnCompact: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 6,
        paddingTop: 6,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        justifyContent: "center",
        gap: 4
    },
    switchBtnText: { fontSize: 9, fontWeight: "600", color: "#64748B" },

    footer: { padding: 12, borderTopWidth: 1 },
    selectedTxt: { fontSize: 13, fontWeight: "700", textAlign: "right", marginBottom: 8 },
    footerBtns: { flexDirection: "row", gap: 10 },
    btnSec: { flex: 1, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    btnSecTxt: { fontSize: 14, fontWeight: "700" },
    btnPrim: { flex: 1, height: 44, borderRadius: 12, backgroundColor: "#DC2626", alignItems: "center", justifyContent: "center" },
    btnPrimTxt: { color: "#fff", fontSize: 14, fontWeight: "700" },

    emptyWrap: { padding: 40, alignItems: 'center' },
    emptyMsg: { color: '#94A3B8', marginTop: 10, fontSize: 13 },
});
