
import React, { useCallback, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { db } from '../../db/sqlite';
import { useTheme } from '../../components/context/ThemeContext';

const PRIMARY = '#16a34a'; // Green color from previous screen

interface EventData {
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

    /* ===== LOAD EVENTS ===== */
    const loadEvents = useCallback(() => {
        try {
            const res = db.execute(`
        SELECT * FROM sessions
        ORDER BY event_date DESC, created_at DESC
      `);
            setEvents(res.rows?._array || []);
        } catch (err) {
            console.error('Failed to load events', err);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadEvents();
        }, [loadEvents]),
    );

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
                        try {
                            // Delete from sessions
                            db.execute('DELETE FROM sessions WHERE session_id = ?', [sessionId]);
                            // Also delete associated data if needed (optional for now)
                            // db.execute('DELETE FROM calculated_data WHERE session_id = ?', [sessionId]);
                            loadEvents();
                        } catch (err) {
                            Alert.alert('Error', 'Failed to delete event');
                        }
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
            <View style={styles.row}>
                {/* Name & Type */}
                <View style={[styles.cell, { flex: 2 }]}>
                    <Text style={styles.cellTextPrimary}>{item.event_name}</Text>
                    <Text style={styles.cellTextSecondary}>{item.event_type}</Text>
                </View>

                {/* Date */}
                <View style={styles.cell}>
                    <Text style={styles.cellText}>{item.event_date}</Text>
                </View>

                {/* Time */}
                <View style={styles.cell}>
                    <Text style={styles.cellText}>{timeRange}</Text>
                </View>

                {/* Location */}
                <View style={styles.cell}>
                    <Text style={styles.cellText}>{item.location || '-'}</Text>
                </View>

                {/* Notes */}
                <View style={[styles.cell, { flex: 2 }]}>
                    <Text style={styles.cellText} numberOfLines={2}>
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
        <View style={styles.headerRow}>
            <Text style={[styles.headerCell, { flex: 2 }]}>Name</Text>
            <Text style={styles.headerCell}>Date</Text>
            <Text style={styles.headerCell}>Start & End Time</Text>
            <Text style={styles.headerCell}>Location</Text>
            <Text style={[styles.headerCell, { flex: 2 }]}>Notes</Text>
            <Text style={[styles.headerCell, { textAlign: 'center' }]}>Actions</Text>
        </View>
    );

    return (
        <View style={styles.screen}>
            {/* ===== TOP BAR ===== */}
            <View style={styles.topBar}>
                <Text style={styles.title}>Manage Events</Text>
                <TouchableOpacity style={styles.createBtn} onPress={openCreateEvent}>
                    <Ionicons name="add" size={20} color="#fff" />
                    <Text style={styles.createBtnText}>CREATE EVENT</Text>
                </TouchableOpacity>
            </View>

            {/* ===== TABLE ===== */}
            <View style={styles.tableCard}>
                <TableHeader />
                <FlatList
                    data={events}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.session_id}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    ListEmptyComponent={
                        <View style={styles.emptyBox}>
                            <Text style={styles.emptyText}>No events found.</Text>
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
        backgroundColor: '#f1f5f9',
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
        color: '#0f172a',
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
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
        flex: 1,
    },
    headerRow: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1,
        borderColor: '#e2e8f0',
        padding: 12,
    },
    headerCell: {
        flex: 1,
        fontSize: 12,
        fontWeight: '700',
        color: '#64748b',
        textTransform: 'uppercase',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderColor: '#f1f5f9',
        padding: 12,
    },
    cell: {
        flex: 1,
        paddingRight: 8,
    },
    cellText: {
        fontSize: 14,
        color: '#334155',
    },
    cellTextPrimary: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0f172a',
    },
    cellTextSecondary: {
        fontSize: 12,
        color: '#64748b',
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
        color: '#94a3b8',
        fontSize: 16,
    },
});
