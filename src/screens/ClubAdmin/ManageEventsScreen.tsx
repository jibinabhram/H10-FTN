import React, { useCallback, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Alert,
    RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../api/axios';
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

    const loadEvents = useCallback(async () => {
        try {
            const clubId = await getClubId();
            const res = await api.get('/events');
            const raw = res.data?.data ?? res.data;
            const list = Array.isArray(raw) ? raw : [];
            const filtered = clubId ? list.filter((e: any) => e.club_id === clubId) : list;

            const mapped: EventData[] = filtered.map((e: any) => ({
                event_id: e.event_id,
                session_id: e.sessionId || e.session_id || e.event_id,
                event_name: e.event_name || '-',
                event_type: e.event_type || '-',
                event_date: formatDate(e.event_date),
                location: e.location || '-',
                field: e.field || '-',
                notes: e.notes || '-',
                trim_start_ts: Number(e.trim_start_ts || 0),
                trim_end_ts: Number(e.trim_end_ts || 0),
            }));

            setEvents(mapped);
        } catch (err) {
            console.error('Failed to load events', err);
        }
    }, [getClubId]);

    useFocusEffect(
        useCallback(() => {
            loadEvents();
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

    /* ===== DELETE ===== */
    const handleDelete = (sessionId: string) => {
        showAlert({
            title: 'Delete Event',
            message: 'Are you sure you want to delete this event? This cannot be undone.',
            type: 'warning',
            buttons: [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        showAlert({
                            title: 'Not Available',
                            message: 'Delete is not available for backend events yet.',
                            type: 'info',
                        });
                    },
                },
            ],
        });
    };

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
                    <TouchableOpacity style={styles.circBtn} onPress={() => handleDelete(item.session_id)}>
                        <Ionicons name="trash" size={14} color={PRIMARY} />
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
                <TouchableOpacity style={styles.createBtn} onPress={openCreateEvent}>
                    <Ionicons name="add" size={20} color="#fff" />
                    <Text style={styles.createBtnText}>Add New</Text>
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
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyBox}>
                            <Text style={[styles.emptyText, { color: isDark ? "#94A3B8" : "#64748B" }]}>No events found.</Text>
                        </View>
                    }
                />
            </View>
        </View>
    );
};

export default ManageEventsScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
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
});
