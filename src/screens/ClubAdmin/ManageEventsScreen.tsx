import React, { useCallback, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    RefreshControl,
    Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import api from '../../api/axios';
import { db } from '../../db/sqlite';
import { sendTrigger } from '../../api/esp32';
import { useTheme } from '../../components/context/ThemeContext';
import { useAlert } from '../../components/context/AlertContext';
import { STORAGE_KEYS } from '../../utils/constants';

const PRIMARY = '#DC2626'; // Red/Coral

interface EventData {
    event_id?: string;
    session_id: string;
    event_name: string;
    event_type: string;
    event_date: string;
    location: string;
    field: string;
    notes: string;
    trim_start_ts: number;
    trim_end_ts: number;
}

interface Props {
    openCreateEvent: () => void;
    onEditEvent: (event: EventData) => void;
}

const ManageEventsScreen: React.FC<Props> = ({ openCreateEvent, onEditEvent }) => {
    const { theme } = useTheme();
    const { showAlert } = useAlert();
    const isDark = theme === 'dark';

    const [events, setEvents] = useState<EventData[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingTrigger, setLoadingTrigger] = useState(false);
    const [isOnline, setIsOnline] = useState(true);
    const [showOfflineWarning, setShowOfflineWarning] = useState(false);

    React.useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsOnline(!!state.isConnected);
        });
        return () => unsubscribe();
    }, []);

    const handleCreateEvent = async () => {
        // Removed strict isOnline check to allow offline event creation (local pod holder trigger)
        try {
            setLoadingTrigger(true);
            console.log("[ManageEvents] Sending device trigger...");
            await sendTrigger();
            openCreateEvent();
        } catch (error) {
            console.error("[ManageEvents] Trigger failed:", error);
            const errAny = error as any;
            const errMsg =
                errAny?.name === 'AbortError'
                    ? 'Please check your connection with podholder.'
                    : errAny?.response?.data?.message ||
                    errAny?.message ||
                    "Could not trigger the device. Please check connection.";

            // Allow user to continue anyway if trigger fails but they want to enter manually?
            // The previous screen allowed "Continue Anyway".
            showAlert({
                title: "Connection Error",
                message: String(errMsg),
                type: "error",
                buttons: [
                    { text: "Continue Anyway", onPress: openCreateEvent },
                    { text: "Cancel", style: "cancel" },
                ],
            });
        } finally {
            setLoadingTrigger(false);
        }
    };

    /* ===== LOAD EVENTS ===== */
    const formatDate = (val: any) => {
        if (!val) return '-';
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
        if (typeof val === 'string') return val;
        return '-';
    };

    const getClubId = useCallback(async () => {
        let clubId = await AsyncStorage.getItem(STORAGE_KEYS.CLUB_ID);
        if (!clubId) {
            try {
                const profile = await api.get('/auth/profile');
                clubId = profile?.data?.user?.club_id || null;
                if (clubId) {
                    await AsyncStorage.setItem(STORAGE_KEYS.CLUB_ID, clubId);
                }
            } catch { }
        }
        return clubId;
    }, []);

    const loadEvents = useCallback(async (silent = false) => {
        if (!silent) setRefreshing(true);
        try {
            const clubId = await getClubId();

            // 1. Fetch Local Events First (Fast UI)
            let localMapped: EventData[] = [];
            try {
                const localRes = db.execute(`SELECT * FROM sessions WHERE (synced_backend = 0 OR synced_backend IS NULL) ORDER BY created_at DESC`);
                const rows = (localRes as any)?.rows?._array || [];
                localMapped = rows.map((s: any) => ({
                    event_id: s.session_id,
                    session_id: s.session_id,
                    club_id: s.club_id,
                    event_name: s.event_name || 'Session',
                    event_type: s.event_type || 'training',
                    event_date: formatDate(s.event_date || s.created_at),
                    location: s.location || '-',
                    field: s.field || '-',
                    notes: s.notes || '-',
                    trim_start_ts: Number(s.trim_start_ts || 0),
                    trim_end_ts: Number(s.trim_end_ts || 0),
                    is_local: true,
                }));
                if (clubId) {
                    localMapped = localMapped.filter((e: any) => e.club_id === clubId || !e.club_id);
                }

                // Set local data immediately so it renders fast
                setEvents(localMapped);
            } catch (dbErr) {
                console.error('❌ Failed to load local events:', dbErr);
            }

            // 2. Fetch Remote Events
            let remoteMapped: EventData[] = [];
            try {
                // Quick connectivity check before waiting 5 seconds for a timeout
                const net = await NetInfo.fetch();
                if (!net.isConnected) {
                    throw new Error('Offline');
                }

                const res = await api.get('/events', { timeout: 5000 });
                const remoteData = Array.isArray(res.data?.data ?? res.data) ? (res.data?.data ?? res.data) : [];
                remoteMapped = remoteData.map((e: any) => ({
                    event_id: e.event_id || e.sessionId,
                    session_id: e.sessionId || e.event_id,
                    club_id: e.club_id,
                    event_name: e.event_name || 'Session',
                    event_type: e.event_type || 'training',
                    event_date: formatDate(e.event_date || e.created_at),
                    location: e.location || '-',
                    field: e.ground_name || e.field || '-',
                    notes: e.notes || '-',
                    is_local: false,
                }));
                if (clubId) {
                    remoteMapped = remoteMapped.filter((e: any) => e.club_id === clubId);
                }

                // 3. Merge and Sort
                const eventMap = new Map();
                remoteMapped.forEach(e => eventMap.set(e.session_id, e));
                localMapped.forEach(e => eventMap.set(e.session_id, e));

                const finalEvents = Array.from(eventMap.values()).sort((a: any, b: any) => {
                    return new Date(b.event_date).getTime() - new Date(a.event_date).getTime();
                });

                setEvents(finalEvents);
            } catch (err) {
                console.log('⚠️ Failed to fetch remote events, showing local only');
                if (!silent) {
                    showAlert({
                        title: 'Offline',
                        message: 'To see the full list of events, please ensure your internet connection is turned on.',
                        type: 'warning',
                    });
                }
                setShowOfflineWarning(true);
            }
        } catch (err) {
            console.error('❌ Critical error in loadEvents:', err);
        } finally {
            setRefreshing(false);
        }
    }, [getClubId]);

    useFocusEffect(
        useCallback(() => {
            loadEvents(true); // Silent load on focus
        }, [loadEvents]),
    );

    const onRefresh = useCallback(async () => {
        try {
            setRefreshing(true);
            await loadEvents();
        } finally {
            setRefreshing(false);
        }
    }, [loadEvents]);



    /* ===== RENDER ROW ===== */
    const renderItem = ({ item }: { item: EventData }) => {
        const startTime = item.trim_start_ts
            ? new Date(item.trim_start_ts).toLocaleTimeString([], {
                hour: '2-digit', minute: '2-digit', hour12: false,
            }) : '-';
        const endTime = item.trim_end_ts
            ? new Date(item.trim_end_ts).toLocaleTimeString([], {
                hour: '2-digit', minute: '2-digit', hour12: false,
            }) : '-';
        const timeRange = startTime !== '-' && endTime !== '-' ? `${startTime} - ${endTime}` : '-';

        const isMatch = item.event_type?.toLowerCase().includes('match');

        return (
            <View style={[styles.row, { borderBottomColor: isDark ? "#1E293B" : "#F1F5F9" }]}>
                {/* Name & Type */}
                <View style={[styles.cell, { flex: 2 }]}>
                    <Text style={[styles.rowTitle, { color: isDark ? "#fff" : "#1E293B" }]}>{item.event_name}</Text>
                    <View style={[styles.badge, { backgroundColor: isMatch ? "rgba(245, 158, 11, 0.1)" : "rgba(34, 197, 94, 0.1)" }]}>
                        <Text style={[styles.badgeText, { color: isMatch ? "#F59E0B" : "#22C55E" }]}>
                            {item.event_type}
                        </Text>
                    </View>
                </View>

                {/* Date & Time */}
                <View style={[styles.cell, { flex: 1.5 }]}>
                    <Text style={[styles.cellText, { color: isDark ? "#CBD5E1" : "#475569" }]}>{item.event_date}</Text>
                    <Text style={[styles.cellSub, { color: isDark ? "#94A3B8" : "#64748B" }]}>{timeRange}</Text>
                </View>

                {/* Location */}
                <View style={[styles.cell, { flex: 1.5 }]}>
                    <Text style={[styles.cellText, { color: isDark ? "#CBD5E1" : "#475569" }]} numberOfLines={1}>
                        {item.location || '-'}
                    </Text>
                    <Text style={[styles.cellSub, { color: isDark ? "#94A3B8" : "#64748B" }]} numberOfLines={1}>
                        {item.field || '-'}
                    </Text>
                </View>

                {/* Actions */}
                <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.circBtn} onPress={() => onEditEvent(item)}>
                        <Ionicons name="pencil" size={14} color={PRIMARY} />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: isDark ? "#0F172A" : "#F8FAF9" }]}>
            {/* HEADER */}
            <View style={styles.header}>
                <View>
                    <Text style={[styles.headerTitle, { color: isDark ? "#fff" : "#1E293B" }]}>Manage Events</Text>
                    <Text style={[styles.headerSub, { color: isDark ? "#94A3B8" : "#64748B" }]}>Organize and track your team sessions</Text>
                </View>
                <TouchableOpacity
                    style={[styles.createBtn, loadingTrigger && { opacity: 0.7 }]}
                    onPress={handleCreateEvent}
                    disabled={loadingTrigger}
                >
                    <Ionicons name="add" size={20} color="#fff" />
                    <Text style={styles.createBtnText}>
                        {loadingTrigger ? "Connecting..." : "Create Event"}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* TABLE */}
            <View style={[styles.tableContainer, { backgroundColor: isDark ? "#1E293B" : "#fff", borderColor: isDark ? "#334155" : "#E2E8F0" }]}>
                <View style={[styles.tableHeader, { backgroundColor: isDark ? "rgba(15, 23, 42, 0.5)" : "#F8FAFC" }]}>
                    <Text style={[styles.headerLabel, { flex: 2, color: isDark ? "#94A3B8" : "#64748B" }]}>Session Details</Text>
                    <Text style={[styles.headerLabel, { flex: 1.5, color: isDark ? "#94A3B8" : "#64748B" }]}>Date & Time</Text>
                    <Text style={[styles.headerLabel, { flex: 1.5, color: isDark ? "#94A3B8" : "#64748B" }]}>Location</Text>
                    <Text style={[styles.headerLabel, { width: 80, textAlign: 'center', color: isDark ? "#94A3B8" : "#64748B" }]}>Actions</Text>
                </View>

                <FlatList
                    data={events}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.session_id || item.event_id || Math.random().toString()}
                    contentContainerStyle={{ flexGrow: 1 }}
                    keyboardShouldPersistTaps="handled"
                    ListEmptyComponent={
                        <View style={styles.emptyBox}>
                            <Text style={[styles.emptyText, { color: isDark ? "#94A3B8" : "#64748B" }]}>No events found.</Text>
                        </View>
                    }
                />
            </View>

            {/* Offline Warning Modal */}
            <Modal
                visible={showOfflineWarning}
                transparent
                animationType="fade"
                onRequestClose={() => setShowOfflineWarning(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}>
                        <View style={[styles.modalIconBox, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEE2E2' }]}>
                            <Ionicons name="wifi-outline" size={32} color={PRIMARY} />
                        </View>
                        <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#0F172A' }]}>Network Offline</Text>
                        <Text style={[styles.modalMessage, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                            To see the full list of events, please ensure your internet connection is turned on.
                        </Text>
                        <TouchableOpacity
                            style={[styles.modalBtn, { backgroundColor: PRIMARY }]}
                            onPress={() => setShowOfflineWarning(false)}
                        >
                            <Text style={styles.modalBtnText}>Got it</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

export default ManageEventsScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 12, // Reduced from 24
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12, // Reduced from 24
        marginTop: 0,
        // paddingRight: 0, // No longer needed as it's not a modal
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '800',
    },
    headerSub: {
        fontSize: 13,
        marginTop: 2,
    },
    createBtn: {
        backgroundColor: PRIMARY,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        gap: 8,
        elevation: 2,
        shadowColor: PRIMARY,
        shadowOffset: { width: 0, height: 4 }, 
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    createBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },
    tableContainer: {
        flex: 1,
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden',
    },
    tableHeader: {
        flexDirection: 'row',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    headerLabel: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
    },
    cell: {
        paddingRight: 10,
    },
    rowTitle: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 4,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    cellText: {
        fontSize: 14,
        fontWeight: '500',
    },
    cellSub: {
        fontSize: 12,
        marginTop: 2,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 8,
        width: 80,
        justifyContent: 'center',
    },
    circBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(220, 38, 38, 0.1)',
    },
    emptyBox: {
        padding: 60,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 14,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(2, 6, 23, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        width: '100%',
        maxWidth: 400,
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
    },
    modalIconBox: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        marginBottom: 8,
        textAlign: 'center',
    },
    modalMessage: {
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 24,
    },
    modalBtn: {
        width: '100%',
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});
