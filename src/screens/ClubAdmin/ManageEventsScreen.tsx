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
import { STORAGE_KEYS } from '../../utils/constants';

const PRIMARY = '#16a34a'; // Green color from previous screen

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
        Alert.alert(
            'Delete Event',
            'Are you sure you want to delete this event? This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        Alert.alert('Not Available', 'Delete is not available for backend events yet.');
                    },
                },
            ],
        );
    };

    /* ===== RENDER ROW ===== */
    const renderItem = ({ item }: { item: EventData }) => {
        // Format Time: HH:MM - HH:MM
        const startTime = item.trim_start_ts
            ? new Date(item.trim_start_ts).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            })
            : '-';

        const endTime = item.trim_end_ts
            ? new Date(item.trim_end_ts).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            })
            : '-';

        const timeRange =
            startTime !== '-' && endTime !== '-' ? `${startTime} - ${endTime}` : '-';

        return (
            <View style={[styles.row, { borderColor: isDark ? '#1E293B' : '#f1f5f9' }]}>
                {/* Name & Type */}
                <View style={[styles.cell, { flex: 2 }]}>
                    <Text style={[styles.cellTextPrimary, { color: isDark ? '#FFFFFF' : '#0f172a' }]}>{item.event_name}</Text>
                    <Text style={[styles.cellTextSecondary, { color: isDark ? '#94A3B8' : '#64748b' }]}>{item.event_type}</Text>
                </View>

                {/* Date */}
                <View style={styles.cell}>
                    <Text style={[styles.cellText, { color: isDark ? '#CBD5E1' : '#334155' }]}>{item.event_date}</Text>
                </View>

                {/* Time */}
                <View style={styles.cell}>
                    <Text style={[styles.cellText, { color: isDark ? '#CBD5E1' : '#334155' }]}>{timeRange}</Text>
                </View>

                {/* Location */}
                <View style={styles.cell}>
                    <Text style={[styles.cellText, { color: isDark ? '#CBD5E1' : '#334155' }]}>{item.location || '-'}</Text>
                </View>

                {/* Notes */}
                <View style={[styles.cell, { flex: 2 }]}>
                    <Text style={[styles.cellText, { color: isDark ? '#CBD5E1' : '#334155' }]} numberOfLines={2}>
                        {item.notes || '-'}
                    </Text>
                </View>

                {/* Actions */}
                <View style={[styles.cell, styles.actions]}>
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: '#22c55e' }]}
                        onPress={() => onEditEvent(item)}
                    >
                        <Ionicons name="pencil" size={16} color="#fff" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: '#ef4444' }]}
                        onPress={() => handleDelete(item.session_id)}
                    >
                        <Ionicons name="trash" size={16} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    /* ===== HEADER COMPONENT ===== */
    const TableHeader = () => (
        <View style={[styles.headerRow, {
            backgroundColor: isDark ? '#1E293B' : '#f8fafc',
            borderColor: isDark ? '#334155' : '#e2e8f0'
        }]}>
            <Text style={[styles.headerCell, { flex: 2, color: isDark ? '#94A3B8' : '#64748b' }]}>Name</Text>
            <Text style={[styles.headerCell, { color: isDark ? '#94A3B8' : '#64748b' }]}>Date</Text>
            <Text style={[styles.headerCell, { color: isDark ? '#94A3B8' : '#64748b' }]}>Start & End Time</Text>
            <Text style={[styles.headerCell, { color: isDark ? '#94A3B8' : '#64748b' }]}>Location</Text>
            <Text style={[styles.headerCell, { flex: 2, color: isDark ? '#94A3B8' : '#64748b' }]}>Notes</Text>
            <Text style={[styles.headerCell, { textAlign: 'center', color: isDark ? '#94A3B8' : '#64748b' }]}>Actions</Text>
        </View>
    );

    return (
        <View style={[styles.screen, { backgroundColor: isDark ? '#020617' : '#FFFFFF' }]}>
            {/* ===== TOP BAR ===== */}
            <View style={styles.topBar}>
                <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#0f172a' }]}>Manage Events</Text>
                <TouchableOpacity style={styles.createBtn} onPress={openCreateEvent}>
                    <Ionicons name="add" size={20} color="#fff" />
                    <Text style={styles.createBtnText}>CREATE EVENT</Text>
                </TouchableOpacity>
            </View>

            {/* ===== TABLE ===== */}
            <View style={[styles.tableCard, {
                backgroundColor: isDark ? '#0F172A' : '#fff',
                borderColor: isDark ? '#1E293B' : '#e2e8f0'
            }]}>
                <TableHeader />
                <FlatList
                    data={events}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.session_id || item.event_id || Math.random().toString()}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor="#16a34a"
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyBox}>
                            <Text style={[styles.emptyText, { color: isDark ? '#94A3B8' : '#94a3b8' }]}>No events found.</Text>
                        </View>
                    }
                />
            </View>
        </View>
    );
};

export default ManageEventsScreen;

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        padding: 20,
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
    },
    createBtn: {
        backgroundColor: '#22c55e',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 8,
    },
    createBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },
    tableCard: {
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'hidden',
        flex: 1,
    },
    headerRow: {
        flexDirection: 'row',
        // We will style this inline or via dynamic style not shown in this block? 
        // Ah, I need to update the TableHeader implementation as well or the styles for it.
        // Let's rely on modifying the styles object if possible, BUT styles are static.
        // So I must modify the JSX of TableHeader and renderItem to accept styles.
    },
    headerCell: {
        flex: 1,
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        padding: 12,
    },
    cell: {
        flex: 1,
        paddingRight: 8,
    },
    cellText: {
        fontSize: 14,
    },
    cellTextPrimary: {
        fontSize: 14,
        fontWeight: '600',
    },
    cellTextSecondary: {
        fontSize: 12,
        marginTop: 2,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    actionBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyBox: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
    },
});
