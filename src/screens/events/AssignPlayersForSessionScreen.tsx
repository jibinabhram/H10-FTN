import React, { useEffect, useState, useMemo } from "react";
import NetInfo from "@react-native-community/netinfo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../../utils/constants";
import { getMyClubPods } from "../../api/players";
import { syncClubPodsToSQLite } from "../../services/playerCache.service";
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
    Modal,
    NativeModules,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { getPlayersFromSQLite, getPodsFromSQLite, getPodHoldersFromSQLite } from "../../services/playerCache.service";
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
    initialValues, // added to support memory persistence
    goNext,
    goBack,
    onStateChange,
}: any) {
    const [players, setPlayers] = useState<any[]>([]);
    const [assigned, setAssigned] = useState<Record<string, boolean>>({});
    const [podMap, setPodMap] = useState<Record<string, string | null>>({});
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedPlayerForPod, setSelectedPlayerForPod] = useState<any>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState(initialSearch || "");
    const [showHowTo, setShowHowTo] = useState(false);
    const [podHolders, setPodHolders] = useState<any[]>([]);

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

    const [podToHolder, setPodToHolder] = useState<Record<string, string | null>>({});
    const [connectedPhSerial, setConnectedPhSerial] = useState<string | null>(null);

    const normalize = (s: string) => (s || "").toUpperCase().replace(/PH-/g, "").replace(/PD-/g, "").replace(/[^A-Z0-9]/g, "").trim();

    const load = async () => {
        const list = getPlayersFromSQLite();
        const allPods = getPodsFromSQLite();
        const holders = getPodHoldersFromSQLite();
        setPodHolders(holders);
        console.log("📦 [AssignPlayers] Pods in SQLite:", allPods.length, "Holders:", holders.length);

        // Detect connected Pod Holder serial via SSID (matching what PodHolderDropdown does)
        try {
            const { WifiModule } = NativeModules as any;
            if (WifiModule?.getCurrentSsid) {
                const rawSsid = await WifiModule.getCurrentSsid();
                const ssid = (rawSsid || "").replace(/"/g, "").trim().toUpperCase();
                console.log("📡 SSID detected:", ssid);

                if (ssid && ssid !== "<UNKNOWN SSID>" && ssid !== "WIFI_NO_SSID") {
                    const normalizedSsid = ssid.replace(/^PH-/, "");

                    // Search in pods first (for holder serial)
                    let matchingSerial = allPods.find((p: any) => {
                        const sU = (p.pod_holder_serial || "").toUpperCase().trim();
                        const dU = (p.device_id || "").toUpperCase().trim();
                        return (ssid === sU || normalizedSsid === sU || ssid === dU || normalizedSsid === dU || ssid.includes(sU) || sU.includes(normalizedSsid));
                    })?.pod_holder_serial;

                    // If not found in pods, search in holders directly
                    if (!matchingSerial) {
                        matchingSerial = holders.find((h: any) => {
                            const sU = (h.serial_number || "").toUpperCase().trim();
                            const dU = (h.device_id || "").toUpperCase().trim();
                            const nU = (h.serial_number || "").replace(/^PH-/, "").toUpperCase().trim();
                            return (ssid === sU || normalizedSsid === sU || ssid === dU || normalizedSsid === dU || ssid === nU || normalizedSsid === nU);
                        })?.serial_number;
                    }

                    if (matchingSerial) {
                        console.log("✅ Matched connected PH:", matchingSerial);
                        setConnectedPhSerial(matchingSerial);
                    } else {
                        console.log("❌ No pod holder matched SSID:", ssid, "Normalized:", normalizedSsid);
                    }
                }
            }
        } catch (e) {
            console.log("Failed to detect connected PH serial:", e);
        }

        // --- NEW: Try to sync pods online to ensure unassigned pods are visible ---
        try {
            const net = await NetInfo.fetch();
            const hasInternet = net.isConnected && (net.isInternetReachable !== false);
            if (hasInternet) {
                const clubId = await AsyncStorage.getItem(STORAGE_KEYS.CLUB_ID);
                if (clubId) {
                    const onlinePods = await getMyClubPods().catch(() => []);
                    if (onlinePods.length > 0) {
                        syncClubPodsToSQLite(clubId, onlinePods);
                        // Refresh allPods and holders after sync
                        const refreshedPods = getPodsFromSQLite();
                        const refreshedHolders = getPodHoldersFromSQLite();
                        setPodHolders(refreshedHolders);
                        // Update allPods in scope
                        allPods.length = 0;
                        allPods.push(...refreshedPods);
                    }
                }
            }
        } catch (e) {
            console.log("Failed to sync pods online in AssignPlayers:", e);
        }

        // 1. Priority: check if we already have these in memory (from previous step or back navigation)
        const memoryAssigned = (initialValues as any)?.assigned;
        const memoryPodMap = (initialValues as any)?.podMap;
        const memoryPodToHolder = (initialValues as any)?.podToHolder;

        if (memoryAssigned && memoryPodMap && Object.keys(memoryAssigned).length > 0) {
            setPlayers(list);
            setAssigned(memoryAssigned);
            setPodMap(memoryPodMap);
            // Ensure podToHolder is always populated
            if (memoryPodToHolder && Object.keys(memoryPodToHolder).length > 0) {
                setPodToHolder(memoryPodToHolder);
            } else {
                const pth: Record<string, string | null> = {};
                // Strategy: build from pods first, then fallback to player defaults
                allPods.forEach((p: any) => { if (p.serial_number) pth[p.serial_number] = p.pod_holder_serial || null; });
                list.forEach((p: any) => { if (p.pod_serial && !pth[p.pod_serial]) pth[p.pod_serial] = p.pod_holder_serial || null; });

                console.log("🛠️ Re-mapped podToHolder from SQLite (Pods + Players):", Object.keys(pth).length);
                setPodToHolder(pth);
            }
            return;
        }

        // 2. Fallback: Try to load previously saved assignments for this session (only if editing existing)
        const existingAssignmentsRes = db.execute(
            `SELECT player_id, assigned FROM session_players WHERE session_id = ?`,
            [sessionId]
        );
        const existingAssignments = (existingAssignmentsRes as any)?.rows?._array || [];

        // 3. Try to load existing pod overrides
        const existingPodOverrides = getSessionPodOverrides(sessionId);

        const assignedMap: Record<string, boolean> = {};
        const initialPodMap: Record<string, string | null> = {};
        const tempPodToHolder: Record<string, string | null> = {};

        // Pre-fill podMap with ALL pods belonging to the club
        const podMasterList = allPods.filter(p => !!p.serial_number);
        podMasterList.forEach((p: any) => {
            initialPodMap[p.serial_number] = null;
            tempPodToHolder[p.serial_number] = p.pod_holder_serial || null;
        });

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

        // Apply owner logic (overrides or player defaults)
        const applyOwner = (playerId: string, podSerial: string) => {
            const normSerial = normalize(podSerial);
            const match = podMasterList.find(pm => normalize(pm.serial_number) === normSerial);
            if (match) {
                initialPodMap[match.serial_number] = playerId;
            } else {
                initialPodMap[podSerial] = playerId;
            }
        };

        if (Object.keys(existingPodOverrides).length > 0) {
            // Apply overrides
            Object.entries(existingPodOverrides).forEach(([serial, playerId]) => {
                applyOwner(playerId as string, serial);
            });

            // For players not in overrides, use their default pod IF it doesn't conflict with an existing override
            list.forEach(p => {
                const isOverridden = Object.values(existingPodOverrides).includes(p.player_id);
                if (!isOverridden && p.pod_serial) {
                    const normDefault = normalize(p.pod_serial);
                    const podAlreadyTakenByOverride = Object.keys(existingPodOverrides).some(s => normalize(s) === normDefault);
                    if (!podAlreadyTakenByOverride) {
                        applyOwner(p.player_id, p.pod_serial);
                    }
                }
            });
        } else {
            // Default: use player default pods
            list.forEach(p => {
                if (p.pod_serial) {
                    applyOwner(p.player_id, p.pod_serial);
                }
            });
        }

        setPlayers(list);
        setAssigned(assignedMap);
        setPodMap(initialPodMap);

        // Final podToHolder population for non-memory path
        const finalPth = { ...tempPodToHolder };
        list.forEach((p: any) => {
            const serial = p.pod_serial || p.pod?.serial_number;
            const holderSerial = p.pod_holder_serial || p.pod?.pod_holder?.serial_number;
            if (serial && !finalPth[serial]) {
                finalPth[serial] = holderSerial || null;
            }
        });
        setPodToHolder(finalPth);
        console.log("🛠️ finalPth count:", Object.keys(finalPth).length);
    };

    const onRefresh = async () => {
        try {
            setRefreshing(true);
            await load();
        } finally {
            setRefreshing(false);
        }
    };

    /* 🟢 KEEP MEMORY SYNCED SO TAB CHANGES DON'T LOSE STATE */
    useEffect(() => {
        if (onStateChange && Object.keys(assigned).length > 0) {
            onStateChange({ assigned, podMap, podToHolder });
        }
    }, [assigned, podMap, podToHolder]);

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
    };

    const getEffectivePodForPlayer = (playerId: string) => {
        const entry = Object.entries(podMap).find(([, owner]) => owner === playerId);
        return entry?.[0] ?? null;
    };

    const onNext = async () => {
        try {
            goNext({ step: "Trim", file, sessionId, eventDraft, search, assigned, podMap, podToHolder });
        } catch (e) {
            Alert.alert("Error", "Failed to navigate to next step");
        }
    };

    const handleBack = async () => {
        goBack({ search, assigned, podMap, podToHolder });
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
                    <Step icon="walk-outline" label="Add Session" />
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

                <TouchableOpacity onPress={() => setShowHowTo(true)} style={{ padding: 4 }}>
                    <Ionicons name="information-circle-outline" size={24} color={isDark ? "#94A3B8" : "#64748B"} />
                </TouchableOpacity>

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
                podMap={podMap}
                podToHolder={podToHolder}
                assigned={assigned}
                podHolders={podHolders}
                initialHolderSerial={connectedPhSerial}
                onAssign={handleAssignPod}
                onUnassign={handleUnassignPod}
            />

            <Modal
                visible={showHowTo}
                transparent
                animationType="fade"
                onRequestClose={() => setShowHowTo(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.howToContent, { backgroundColor: isDark ? '#1e293b' : '#fff' }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.howToTitle, { color: isDark ? '#fff' : '#1e293b' }]}>How to Manage Players</Text>
                            <TouchableOpacity onPress={() => setShowHowTo(false)}>
                                <Ionicons name="close" size={24} color={isDark ? '#94a3b8' : '#64748B'} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={styles.howToStep}>
                                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
                                <View style={styles.stepTextContainer}>
                                    <Text style={[styles.stepTitleTxt, { color: isDark ? '#fff' : '#1e293b' }]}>Select Players</Text>
                                    <Text style={[styles.stepDesc, { color: isDark ? '#94a3b8' : '#64748B' }]}>Tap the checkbox next to each player who will be participating in this session.</Text>
                                </View>
                            </View>

                            <View style={styles.howToStep}>
                                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
                                <View style={styles.stepTextContainer}>
                                    <Text style={[styles.stepTitleTxt, { color: isDark ? '#fff' : '#1e293b' }]}>Assign Hub Pods</Text>
                                    <Text style={[styles.stepDesc, { color: isDark ? '#94a3b8' : '#64748B' }]}>If a player needs a different pod for this session, tap "Switch pods" on their card.</Text>
                                </View>
                            </View>

                            <View style={styles.howToStep}>
                                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
                                <View style={styles.stepTextContainer}>
                                    <Text style={[styles.stepTitleTxt, { color: isDark ? '#fff' : '#1e293b' }]}>Save and Continue</Text>
                                    <Text style={[styles.stepDesc, { color: isDark ? '#94a3b8' : '#64748B' }]}>Once everyone is ready, tap "Next" to proceed to the session details.</Text>
                                </View>
                            </View>
                        </ScrollView>

                        <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowHowTo(false)}>
                            <Text style={styles.closeModalBtnText}>Got it!</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View >
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

    // HowTo Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    howToContent: {
        width: '100%',
        maxWidth: 450,
        borderRadius: 24,
        padding: 24,
        maxHeight: '80%'
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24
    },
    howToTitle: { fontSize: 20, fontWeight: '900' },
    howToStep: {
        flexDirection: 'row',
        marginBottom: 20,
        gap: 16,
    },
    stepNumber: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#DC2626',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepNumberText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '800',
    },
    stepTextContainer: {
        flex: 1,
    },
    stepTitleTxt: {
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 4,
    },
    stepDesc: {
        fontSize: 13,
        lineHeight: 18,
    },
    closeModalBtn: {
        backgroundColor: '#DC2626',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10,
    },
    closeModalBtnText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
});
