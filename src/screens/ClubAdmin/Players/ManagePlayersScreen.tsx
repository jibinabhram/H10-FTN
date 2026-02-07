import React, { useState, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    Alert,
    RefreshControl,
    TextInput,
    ScrollView,
    ActivityIndicator,
    Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../../components/context/ThemeContext';
import {
    createPlayer,
    updatePlayer,
    getMyClubPods,
    assignPodToPlayer,
    unassignPodFromPlayer,
    deletePlayer
} from '../../../api/players';
import api from '../../../api/axios';
import { loadPlayersUnified } from '../../../services/playerSync.service';
import { upsertPlayersToSQLite, getPlayersFromSQLite } from '../../../services/playerCache.service';
import { db } from '../../../db/sqlite';
import { getClubZoneDefaults } from '../../../api/clubZones';

type Mode = 'LIST' | 'CREATE' | 'EDIT';

const ManagePlayersScreen = () => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [mode, setMode] = useState<Mode>('LIST');
    const [players, setPlayers] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    // Form State
    const [editingPlayer, setEditingPlayer] = useState<any>(null);
    const [form, setForm] = useState({
        player_name: '',
        age: '',
        jersey_number: '',
        position: '',
        height: '',
        weight: '',
    });

    // Pods related
    const [pods, setPods] = useState<any[]>([]);
    const [selectedPodId, setSelectedPodId] = useState<string | null>(null);
    const [assignedPod, setAssignedPod] = useState<any | null>(null);
    const [showPodModal, setShowPodModal] = useState(false);

    // Zones
    const [zones, setZones] = useState<Array<{ zone: number; min: number; max: number }>>([]);
    const defaultZones = [
        { zone: 1, min: 101, max: 120 },
        { zone: 2, min: 120, max: 140 },
        { zone: 3, min: 140, max: 160 },
        { zone: 4, min: 160, max: 180 },
        { zone: 5, min: 180, max: 200 },
    ];

    /* ================= DATA LOADING ================= */

    const loadPlayers = async () => {
        const cached = getPlayersFromSQLite();
        if (cached && cached.length > 0) setPlayers(cached);

        try {
            const data = await loadPlayersUnified();
            if (Array.isArray(data)) {
                setPlayers(data);
                upsertPlayersToSQLite(data);
            }
        } catch (e) {
            console.error('Failed to load players', e);
        }
    };

    useFocusEffect(
        useCallback(() => {
            if (mode === 'LIST') loadPlayers();
        }, [mode])
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            const data = await loadPlayersUnified();
            if (Array.isArray(data)) setPlayers(data);
        } finally {
            setRefreshing(false);
        }
    }, []);

    const loadPods = async () => {
        try {
            setLoading(true);
            const allPodsData = await getMyClubPods();
            let podsArray = Array.isArray(allPodsData) ? allPodsData : (allPodsData?.data || []);

            const currentPodId = assignedPod?.pod_id || editingPlayer?.pod_id;
            const available = podsArray.filter((p: any) => !currentPodId || String(p.pod_id) !== String(currentPodId));
            setPods(available);
        } catch (e) {
            console.error('Failed to load pods', e);
        } finally {
            setLoading(false);
        }
    };

    /* ================= SEARCH & FILTER ================= */
    const filteredPlayers = useMemo(() => {
        if (!search) return players;
        const s = search.toLowerCase();
        return players.filter(p =>
            p.player_name?.toLowerCase().includes(s) ||
            p.position?.toLowerCase().includes(s) ||
            p.pod_serial?.toLowerCase().includes(s) ||
            p.jersey_number?.toString().includes(s)
        );
    }, [players, search]);

    /* ================= ACTIONS ================= */

    const resetForm = () => {
        setForm({
            player_name: '',
            age: '',
            jersey_number: '',
            position: '',
            height: '',
            weight: '',
        });
        setEditingPlayer(null);
        setSelectedPodId(null);
        setAssignedPod(null);
        setZones([]);
    };

    const handleCreate = () => {
        resetForm();
        setMode('CREATE');
        loadPods();
    };

    const handleEdit = (player: any) => {
        setEditingPlayer(player);
        setForm({
            player_name: player.player_name ?? '',
            age: String(player.age ?? ''),
            jersey_number: String(player.jersey_number ?? ''),
            position: player.position ?? '',
            height: String(player.height ?? ''),
            weight: String(player.weight ?? ''),
        });

        // Normalize zones
        let zonesData = player.hr_zones;
        if (typeof zonesData === 'string') {
            try { zonesData = JSON.parse(zonesData); } catch { zonesData = []; }
        }
        if (Array.isArray(zonesData) && zonesData.length > 0) {
            setZones(normalizeZones(zonesData));
        } else {
            loadDefaultZones();
        }

        const pod = player.player_pods?.[0]?.pod || (player.pod_id ? { pod_id: player.pod_id, serial_number: player.pod_serial } : null);
        setAssignedPod(pod);
        setMode('EDIT');
        loadPods();
    };

    const handleDelete = (player: any) => {
        Alert.alert(
            'Delete Player',
            `Are you sure you want to delete ${player.player_name}? This action cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            if (!player.player_id) {
                                console.error('❌ Deletion failed: player_id is null/undefined', player);
                                Alert.alert('Error', 'Player ID missing. Try refreshing.');
                                return;
                            }
                            await deletePlayer(player.player_id);
                            db.execute(`DELETE FROM players WHERE player_id = ?`, [player.player_id]);
                            setPlayers(prev => prev.filter(p => p.player_id !== player.player_id));
                            Alert.alert('Success', 'Player deleted');
                        } catch (e: any) {
                            console.error('❌ Failed to delete player:', e);
                            Alert.alert('Error', e?.response?.data?.message || 'Failed to delete player from server');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleSave = async () => {
        if (!form.player_name) {
            Alert.alert('Error', 'Player name is required');
            return;
        }

        setLoading(true);
        try {
            const payload: any = {
                player_name: form.player_name,
                age: Number(form.age) || undefined,
                jersey_number: Number(form.jersey_number) || undefined,
                position: form.position,
                height: Number(form.height) || undefined,
                weight: Number(form.weight) || undefined,
                hr_zones: zones.length ? zones : undefined,
            };

            if (mode === 'CREATE') {
                if (selectedPodId) payload.pod_id = selectedPodId;
                const created = await createPlayer(payload);
                upsertPlayersToSQLite([created]);
                Alert.alert('Success', 'Player registered');
            } else {
                const updated = await updatePlayer(editingPlayer.player_id, payload);
                // Update local SQLite HR zones
                db.execute(
                    `UPDATE players SET hr_zones=? WHERE player_id=?`,
                    [JSON.stringify(zones), editingPlayer.player_id]
                );
                upsertPlayersToSQLite([updated]);
                Alert.alert('Success', 'Player updated');
            }
            setMode('LIST');
        } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.message || 'Failed to save player');
        } finally {
            setLoading(false);
        }
    };

    const handlePodAction = async (pod: any) => {
        setLoading(true);
        try {
            const updated = await assignPodToPlayer(editingPlayer.player_id, pod.pod_id);
            if (updated) {
                upsertPlayersToSQLite([updated]);
                setAssignedPod(updated.player_pods?.[0]?.pod || { pod_id: updated.pod_id, serial_number: updated.pod_serial });
            }
            setShowPodModal(false);
        } catch (e) {
            Alert.alert('Error', 'Failed to assign pod');
        } finally {
            setLoading(false);
        }
    };

    const handleUnassign = async () => {
        setLoading(true);
        try {
            const updated = await unassignPodFromPlayer(editingPlayer.player_id);
            if (updated) {
                upsertPlayersToSQLite([updated]);
                setAssignedPod(null);
            }
        } catch (e) {
            Alert.alert('Error', 'Failed to unassign pod');
        } finally {
            setLoading(false);
        }
    };

    /* ================= HELPERS ================= */

    const normalizeZones = (data: any[]) => {
        return data.map((z: any) => ({
            zone: Number(z.zone ?? z.zone_number ?? 0),
            min: Number(z.min ?? z.min_hr ?? 0),
            max: Number(z.max ?? z.max_hr ?? 0),
        }));
    };

    const loadDefaultZones = async () => {
        try {
            const res = db.execute(`SELECT zone_number, min_hr, max_hr FROM hr_zones ORDER BY zone_number`);
            const rows = res?.rows?._array ?? [];
            if (rows.length > 0) {
                setZones(normalizeZones(rows));
            } else {
                try {
                    const backendDefaults = await getClubZoneDefaults();
                    if (Array.isArray(backendDefaults) && backendDefaults.length > 0) {
                        setZones(normalizeZones(backendDefaults));
                        return;
                    }
                } catch { }
                setZones(defaultZones);
            }
        } catch {
            setZones(defaultZones);
        }
    };

    /* ================= RENDERING ================= */

    const renderBackHeader = (title: string) => (
        <View style={styles.headerForm}>
            <TouchableOpacity onPress={() => setMode('LIST')} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#000'} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>{title}</Text>
            <View style={{ width: 40 }} />
        </View>
    );

    if (mode === 'LIST') {
        return (
            <View style={[styles.container, { backgroundColor: isDark ? '#020617' : '#FFFFFF' }]}>
                {/* TOP BAR / SEARCH */}
                <View style={styles.topActions}>
                    <View style={[styles.searchContainer, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
                        <Ionicons name="search" size={20} color={isDark ? '#94A3B8' : '#64748B'} />
                        <TextInput
                            placeholder="Search by name, position, or pod..."
                            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                            style={[styles.searchInput, { color: isDark ? '#FFF' : '#000' }]}
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>
                    <TouchableOpacity onPress={handleCreate} style={styles.addBtnRed}>
                        <Ionicons name="add" size={22} color="#fff" />
                        <Text style={styles.addBtnText}>Add Player</Text>
                    </TouchableOpacity>
                </View>

                {/* TABLE HEADER */}
                <View style={[styles.tableHeader, { borderBottomColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
                    <Text style={[styles.th, { flex: 2.5 }]}>Player</Text>
                    <Text style={[styles.th, { flex: 1 }]}>Age</Text>
                    <Text style={[styles.th, { flex: 1.5 }]}>Position</Text>
                    <Text style={[styles.th, { flex: 2.2 }]}>Height/Weight</Text>
                    <Text style={[styles.th, { flex: 2 }]}>Pod Serial</Text>
                    <Text style={[styles.th, { flex: 1.2, textAlign: 'right' }]}>Actions</Text>
                </View>

                <FlatList
                    data={filteredPlayers}
                    keyExtractor={p => String(p.player_id)}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#DC2626" />}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    renderItem={({ item }) => (
                        <View style={[styles.tableRow, { borderBottomColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
                            {/* PLAYER */}
                            <View style={[styles.td, { flex: 2.5, flexDirection: 'row', alignItems: 'center' }]}>
                                <View style={styles.jerseyCircle}>
                                    <Text style={styles.jerseyCircleText}>{item.jersey_number || '00'}</Text>
                                </View>
                                <Text style={[styles.playerNameTable, { color: isDark ? '#E2E8F0' : '#1E293B' }]} numberOfLines={1}>
                                    {item.player_name}
                                </Text>
                            </View>

                            {/* AGE */}
                            <Text style={[styles.td, { flex: 1, color: isDark ? '#94A3B8' : '#64748B' }]}>{item.age || '-'}</Text>

                            {/* POSITION */}
                            <Text style={[styles.td, { flex: 1.5, color: isDark ? '#94A3B8' : '#64748B' }]}>{item.position || '-'}</Text>

                            {/* HEIGHT/WEIGHT */}
                            <Text style={[styles.td, { flex: 2.2, color: isDark ? '#94A3B8' : '#64748B' }]}>
                                {item.height ? `${item.height}cm` : '-'} / {item.weight ? `${item.weight}kg` : '-'}
                            </Text>

                            {/* POD */}
                            <Text style={[styles.td, { flex: 2, color: '#DC2626', fontWeight: '500' }]}>
                                {item.pod_serial || item.player_pods?.[0]?.pod?.serial_number || 'None'}
                            </Text>

                            {/* ACTIONS */}
                            <View style={[styles.td, { flex: 1.2, flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }]}>
                                <TouchableOpacity onPress={() => handleEdit(item)}>
                                    <Ionicons name="pencil-outline" size={20} color={isDark ? '#94A3B8' : '#64748B'} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDelete(item)}>
                                    <Ionicons name="trash-outline" size={20} color={isDark ? '#F87171' : '#DC2626'} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="people-outline" size={64} color={isDark ? '#334155' : '#cbd5e1'} />
                            <Text style={[styles.emptyText, { color: isDark ? '#64748B' : '#94a3b8' }]}>No players found</Text>
                        </View>
                    }
                />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: isDark ? '#020617' : '#FFFFFF' }]}>
            {renderBackHeader(mode === 'CREATE' ? 'Add New Player' : 'Edit Player')}
            <ScrollView contentContainerStyle={styles.formContent}>
                <View style={styles.formGroup}>
                    <Text style={[styles.label, { color: isDark ? '#94a3b8' : '#64748B' }]}>Player Name</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#fff' : '#000' }]}
                        value={form.player_name}
                        onChangeText={v => setForm({ ...form, player_name: v })}
                        placeholder="e.g. Marcus Rashford"
                        placeholderTextColor="#94a3b8"
                    />
                </View>

                <View style={styles.row}>
                    <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                        <Text style={[styles.label, { color: isDark ? '#94a3b8' : '#64748B' }]}>Age</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#fff' : '#000' }]}
                            value={form.age}
                            keyboardType="numeric"
                            onChangeText={v => setForm({ ...form, age: v })}
                            placeholder="26"
                        />
                    </View>
                    <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                        <Text style={[styles.label, { color: isDark ? '#94a3b8' : '#64748B' }]}>Jersey Number</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#fff' : '#000' }]}
                            value={form.jersey_number}
                            keyboardType="numeric"
                            onChangeText={v => setForm({ ...form, jersey_number: v })}
                            placeholder="10"
                        />
                    </View>
                </View>

                <View style={styles.formGroup}>
                    <Text style={[styles.label, { color: isDark ? '#94a3b8' : '#64748B' }]}>Position</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#fff' : '#000' }]}
                        value={form.position}
                        onChangeText={v => setForm({ ...form, position: v })}
                        placeholder="e.g. Forward"
                    />
                </View>

                <View style={styles.row}>
                    <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                        <Text style={[styles.label, { color: isDark ? '#94a3b8' : '#64748B' }]}>Height (cm)</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#fff' : '#000' }]}
                            value={form.height}
                            keyboardType="numeric"
                            onChangeText={v => setForm({ ...form, height: v })}
                            placeholder="185"
                        />
                    </View>
                    <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                        <Text style={[styles.label, { color: isDark ? '#94a3b8' : '#64748B' }]}>Weight (kg)</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#fff' : '#000' }]}
                            value={form.weight}
                            keyboardType="numeric"
                            onChangeText={v => setForm({ ...form, weight: v })}
                            placeholder="85"
                        />
                    </View>
                </View>

                {/* Pod Selection for CREATE */}
                {mode === 'CREATE' && (
                    <View style={styles.formGroup}>
                        <Text style={[styles.label, { color: isDark ? '#94a3b8' : '#64748B' }]}>Assign Hub Pod (Optional)</Text>
                        <View style={styles.podGrid}>
                            {pods.map(p => (
                                <TouchableOpacity
                                    key={p.pod_id}
                                    onPress={() => setSelectedPodId(p.pod_id)}
                                    style={[
                                        styles.podSelector,
                                        { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0' },
                                        selectedPodId === p.pod_id && styles.podSelectorActive
                                    ]}
                                >
                                    <Text style={[styles.podSelectorText, { color: isDark ? '#fff' : '#0F172A' }, selectedPodId === p.pod_id && { color: '#fff' }]}>
                                        {p.serial_number}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                            {pods.length === 0 && <Text style={{ color: '#ef4444' }}>No available pods</Text>}
                        </View>
                    </View>
                )}

                {/* Pod Management for EDIT */}
                {mode === 'EDIT' && (
                    <View style={styles.formGroup}>
                        <Text style={[styles.label, { color: isDark ? '#94a3b8' : '#64748B' }]}>Connected Hub Pod</Text>
                        {assignedPod ? (
                            <View style={[styles.activePodCard, { backgroundColor: isDark ? '#1e293b' : '#FEE2E2', borderColor: '#DC2626' }]}>
                                <Ionicons name="hardware-chip" size={24} color="#DC2626" />
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={[styles.activePodTitle, { color: '#991B1B' }]}>{assignedPod.serial_number}</Text>
                                </View>
                                <TouchableOpacity style={styles.unassignBtn} onPress={handleUnassign}>
                                    <Text style={styles.unassignText}>Unassign</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity style={styles.emptyPodBtn} onPress={() => setShowPodModal(true)}>
                                <Ionicons name="add-circle-outline" size={24} color="#DC2626" />
                                <Text style={styles.emptyPodText}>Link a Hardware Pod</Text>
                            </TouchableOpacity>
                        )}
                        {assignedPod && (
                            <TouchableOpacity style={styles.changePodBtn} onPress={() => setShowPodModal(true)}>
                                <Text style={styles.changePodText}>Switch connection</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                <TouchableOpacity style={styles.saveBtnFull} onPress={handleSave} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnTextFull}>{mode === 'CREATE' ? 'Register Player' : 'Confirm Updates'}</Text>}
                </TouchableOpacity>
                <View style={{ height: 40 }} />
            </ScrollView>

            <Modal transparent visible={showPodModal} animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: isDark ? '#0F172A' : '#fff' }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#000' }]}>Link Hardware Pod</Text>
                            <TouchableOpacity onPress={() => setShowPodModal(false)}>
                                <Ionicons name="close" size={24} color={isDark ? '#fff' : '#000'} />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={pods}
                            keyExtractor={p => p.pod_id}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={[styles.modalOption, { borderBottomColor: isDark ? '#1E293B' : '#F1F5F9' }]} onPress={() => handlePodAction(item)}>
                                    <Ionicons name="hardware-chip-outline" size={20} color="#DC2626" />
                                    <Text style={[styles.modalOptionText, { color: isDark ? '#fff' : '#000' }]}>{item.serial_number}</Text>
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={<Text style={{ textAlign: 'center', padding: 40, color: '#64748B' }}>No available pods found in registry.</Text>}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
};

export default ManagePlayersScreen;

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerForm: {
        padding: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: { fontSize: 22, fontWeight: '800' },
    backBtn: { padding: 8 },

    topActions: {
        flexDirection: 'row',
        padding: 20,
        alignItems: 'center',
        gap: 12,
    },
    searchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        height: 52,
        borderRadius: 26,
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 14,
    },
    addBtnRed: {
        backgroundColor: '#DC2626',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 22,
        height: 52,
        borderRadius: 14,
    },
    addBtnText: { color: '#fff', fontWeight: '700', marginLeft: 8 },

    tableHeader: {
        flexDirection: 'row',
        paddingVertical: 14,
        borderBottomWidth: 1,
        marginHorizontal: 20,
    },
    th: {
        fontSize: 11,
        fontWeight: '700',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 18,
        borderBottomWidth: 1,
        marginHorizontal: 20,
    },
    td: {
        fontSize: 14,
    },
    jerseyCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    jerseyCircleText: {
        color: '#991B1B',
        fontSize: 12,
        fontWeight: '900',
    },
    playerNameTable: {
        fontSize: 14,
        fontWeight: '700',
    },

    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 },
    emptyText: { marginTop: 16, fontSize: 16, fontWeight: '600' },

    // Form Styles
    formContent: { paddingHorizontal: 20 },
    formGroup: { marginBottom: 20 },
    label: { fontSize: 13, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.3 },
    input: {
        height: 52,
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 16,
        fontSize: 15,
    },
    row: { flexDirection: 'row' },
    podGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    podSelector: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
    },
    podSelectorActive: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
    podSelectorText: { fontSize: 13, fontWeight: '700' },

    activePodCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 18,
        borderRadius: 16,
        borderWidth: 1.5,
    },
    activePodTitle: { fontSize: 16, fontWeight: '800' },
    unassignBtn: { backgroundColor: '#ef4444', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
    unassignText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    emptyPodBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 22,
        borderRadius: 16,
        borderStyle: 'dashed',
        borderWidth: 2,
        borderColor: '#DC2626',
        justifyContent: 'center',
    },
    emptyPodText: { marginLeft: 10, color: '#DC2626', fontWeight: '800' },
    changePodBtn: { alignSelf: 'flex-start', marginTop: 10, padding: 6 },
    changePodText: { color: '#DC2626', fontWeight: '700', fontSize: 14 },

    saveBtnFull: {
        backgroundColor: '#DC2626',
        height: 60,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 30,
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    saveBtnTextFull: { color: '#fff', fontSize: 17, fontWeight: '800' },

    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(2, 6, 23, 0.6)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        width: '100%',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 24,
        maxHeight: '70%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: { fontSize: 20, fontWeight: '900' },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 18,
        borderBottomWidth: 1,
        gap: 12,
    },
    modalOptionText: { fontSize: 16, fontWeight: '700' },
});
