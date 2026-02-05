import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../../components/context/ThemeContext';
import { getMyClubPlayers, createPlayer, updatePlayer, getMyClubPods, assignPodToPlayer, unassignPodFromPlayer } from '../../../api/players';
import api from '../../../api/axios';
import { loadPlayersUnified } from '../../../services/playerSync.service';
import { getPlayersFromSQLite, upsertPlayersToSQLite, getPlayerFromSQLite } from '../../../services/playerCache.service';
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
    const [allPods, setAllPods] = useState<any[]>([]);
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


    /* ================= LIST LOGIC ================= */

    const loadPlayers = async () => {
        const cached = getPlayersFromSQLite();
        if (cached && cached.length > 0) {
            setPlayers(cached);
        }
        try {
            const data = await loadPlayersUnified();
            if (Array.isArray(data)) {
                setPlayers(data);
            }
        } catch (e: any) {
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

    /* ================= FORM LOGIC ================= */

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
        loadPods();
    };


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

    const loadPods = async () => {
        try {
            setLoading(true);
            const allPodsData = await getMyClubPods();
            let podsArray = Array.isArray(allPodsData) ? allPodsData : (allPodsData?.data || []);
            setAllPods(podsArray);

            const currentPodId = assignedPod?.pod_id || editingPlayer?.pod_id;
            const available = podsArray.filter((p: any) => !currentPodId || String(p.pod_id) !== String(currentPodId));
            setPods(available);
        } catch (e) {
            console.error('Failed to load pods', e);
        } finally {
            setLoading(false);
        }
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
                height: form.height ? Number(form.height) : undefined,
                weight: form.weight ? Number(form.weight) : undefined,
                hr_zones: zones.length ? zones : undefined,
            };

            if (mode === 'CREATE') {
                if (!selectedPodId) {
                    Alert.alert('Missing', 'Please select a pod');
                    setLoading(false);
                    return;
                }
                payload.pod_id = selectedPodId;
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
        } catch (e: any) {
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
        } catch (e: any) {
            Alert.alert('Error', 'Failed to unassign pod');
        } finally {
            setLoading(false);
        }
    };

    /* ================= RENDERING ================= */

    const renderBackHeader = (title: string) => (
        <View style={styles.header}>
            <TouchableOpacity onPress={() => setMode('LIST')} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#000'} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>{title}</Text>
            <View style={{ width: 40 }} />
        </View>
    );

    if (mode === 'LIST') {
        return (
            <View style={[styles.container, { backgroundColor: isDark ? '#020617' : '#f8fafc' }]}>
                <View style={styles.header}>
                    <Text style={[styles.title, { color: isDark ? '#fff' : '#0F172A' }]}>Players Management</Text>
                    <TouchableOpacity onPress={handleCreate} style={styles.addBtn}>
                        <Ionicons name="add" size={20} color="#fff" />
                        <Text style={styles.addBtnText}>Add Player</Text>
                    </TouchableOpacity>
                </View>

                <FlatList
                    data={players}
                    keyExtractor={p => String(p.player_id)}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[styles.playerCard, { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0' }]}
                            onPress={() => handleEdit(item)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.playerInfo}>
                                <View style={styles.avatar}>
                                    <Text style={styles.avatarText}>{item.player_name?.charAt(0).toUpperCase()}</Text>
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={[styles.playerName, { color: isDark ? '#f8fafc' : '#0F172A' }]}>{item.player_name}</Text>
                                    <Text style={[styles.playerMeta, { color: isDark ? '#94a3b8' : '#64748B' }]}>
                                        #{item.jersey_number} • {item.position} • Pod: {item.pod_serial || item.player_pods?.[0]?.pod?.serial_number || 'None'}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={isDark ? '#475569' : '#94a3b8'} />
                            </View>
                        </TouchableOpacity>
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
        <View style={[styles.container, { backgroundColor: isDark ? '#020617' : '#f8fafc' }]}>
            {renderBackHeader(mode === 'CREATE' ? 'Register New Player' : 'Edit Player')}
            <ScrollView contentContainerStyle={styles.formContent}>
                <View style={styles.formGroup}>
                    <Text style={[styles.label, { color: isDark ? '#94a3b8' : '#64748B' }]}>Full Name</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#fff' : '#000' }]}
                        value={form.player_name}
                        onChangeText={v => setForm({ ...form, player_name: v })}
                        placeholder="John Doe"
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
                            placeholder="0"
                        />
                    </View>
                    <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                        <Text style={[styles.label, { color: isDark ? '#94a3b8' : '#64748B' }]}>Jersey #</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#fff' : '#000' }]}
                            value={form.jersey_number}
                            keyboardType="numeric"
                            onChangeText={v => setForm({ ...form, jersey_number: v })}
                            placeholder="00"
                        />
                    </View>
                </View>

                <View style={styles.formGroup}>
                    <Text style={[styles.label, { color: isDark ? '#94a3b8' : '#64748B' }]}>Position</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#fff' : '#000' }]}
                        value={form.position}
                        onChangeText={v => setForm({ ...form, position: v })}
                        placeholder="Midfielder"
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
                            placeholder="180"
                        />
                    </View>
                    <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                        <Text style={[styles.label, { color: isDark ? '#94a3b8' : '#64748B' }]}>Weight (kg)</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#fff' : '#000' }]}
                            value={form.weight}
                            keyboardType="numeric"
                            onChangeText={v => setForm({ ...form, weight: v })}
                            placeholder="75"
                        />
                    </View>
                </View>

                {/* Pod Selection for CREATE */}
                {mode === 'CREATE' && (
                    <View style={styles.formGroup}>
                        <Text style={[styles.label, { color: isDark ? '#94a3b8' : '#64748B' }]}>Assign Initial Pod</Text>
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
                            {pods.length === 0 && <Text style={{ color: '#ef4444' }}>No pods available</Text>}
                        </View>
                    </View>
                )}

                {/* Pod Management for EDIT */}
                {mode === 'EDIT' && (
                    <View style={styles.formGroup}>
                        <Text style={[styles.label, { color: isDark ? '#94a3b8' : '#64748B' }]}>Current Pod</Text>
                        {assignedPod ? (
                            <View style={[styles.activePodCard, { backgroundColor: isDark ? '#1e3a8a' : '#dbeafe', borderColor: isDark ? '#3b82f6' : '#2563EB' }]}>
                                <Ionicons name="hardware-chip" size={24} color={isDark ? '#fff' : '#2563EB'} />
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={[styles.activePodTitle, { color: isDark ? '#fff' : '#1e40af' }]}>{assignedPod.serial_number}</Text>
                                </View>
                                <TouchableOpacity style={styles.unassignBtn} onPress={handleUnassign}>
                                    <Text style={styles.unassignText}>Unassign</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity style={styles.emptyPodBtn} onPress={() => setShowPodModal(true)}>
                                <Ionicons name="add-circle-outline" size={24} color="#2563EB" />
                                <Text style={styles.emptyPodText}>Assign a pod</Text>
                            </TouchableOpacity>
                        )}
                        {assignedPod && (
                            <TouchableOpacity style={styles.changePodBtn} onPress={() => setShowPodModal(true)}>
                                <Text style={styles.changePodText}>Change Pod</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* Heart Rate Zones Section */}
                {mode === 'EDIT' && (
                    <View style={styles.formGroup}>
                        <Text style={[styles.label, { color: isDark ? '#94a3b8' : '#64748B' }]}>Heart Rate Zones (BPM)</Text>
                        {zones.map((z, idx) => (
                            <View key={`hr_zone_${z.zone}`} style={styles.speedRow}>
                                <Text style={[styles.zoneLabel, { color: isDark ? '#f8fafc' : '#0F172A', width: 60 }]}>Zone {z.zone}</Text>
                                <TextInput
                                    style={[styles.zoneInput, { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#fff' : '#000' }]}
                                    value={String(z.min)}
                                    keyboardType="numeric"
                                    onChangeText={v => setZones(prev => prev.map((p, i) => i === idx ? { ...p, min: Number(v) || 0 } : p))}
                                    placeholder="Min"
                                />
                                <Text style={{ color: isDark ? '#94a3b8' : '#64748B' }}>-</Text>
                                <TextInput
                                    style={[styles.zoneInput, { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#fff' : '#000' }]}
                                    value={String(z.max)}
                                    keyboardType="numeric"
                                    onChangeText={v => setZones(prev => prev.map((p, i) => i === idx ? { ...p, max: Number(v) || 0 } : p))}
                                    placeholder="Max"
                                />
                            </View>
                        ))}
                    </View>
                )}


                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{mode === 'CREATE' ? 'Register Player' : 'Save Changes'}</Text>}
                </TouchableOpacity>
                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Pod Selection Modal Overlay */}
            {showPodModal && (
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: isDark ? '#0F172A' : '#fff' }]}>
                        <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#000' }]}>Available Pods</Text>
                        <FlatList
                            data={pods}
                            keyExtractor={p => p.pod_id}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.modalOption} onPress={() => handlePodAction(item)}>
                                    <Text style={[styles.modalOptionText, { color: isDark ? '#fff' : '#000' }]}>{item.serial_number}</Text>
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={<Text style={{ textAlign: 'center', padding: 20 }}>No available pods</Text>}
                        />
                        <TouchableOpacity style={styles.modalClose} onPress={() => setShowPodModal(false)}>
                            <Text style={styles.modalCloseText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </View>
    );
};

export default ManagePlayersScreen;

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        padding: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: { fontSize: 24, fontWeight: '800' },
    backBtn: { padding: 8 },
    addBtn: {
        backgroundColor: '#2563EB',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
    },
    addBtnText: { color: '#fff', fontWeight: '700', marginLeft: 4 },
    playerCard: {
        marginHorizontal: 16,
        marginBottom: 12,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
    },
    playerInfo: { flexDirection: 'row', alignItems: 'center' },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#dbeafe',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: { color: '#2563EB', fontSize: 20, fontWeight: '800' },
    playerName: { fontSize: 16, fontWeight: '700' },
    playerMeta: { fontSize: 12, marginTop: 4 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 },
    emptyText: { marginTop: 16, fontSize: 16 },

    // Form Styles
    formContent: { paddingHorizontal: 20 },
    formGroup: { marginBottom: 20 },
    label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
    input: {
        height: 48,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 15,
    },
    row: { flexDirection: 'row' },
    podGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    podSelector: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
    },
    podSelectorActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    podSelectorText: { fontSize: 13, fontWeight: '600' },

    activePodCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
    },
    activePodTitle: { fontSize: 16, fontWeight: '700' },
    unassignBtn: { backgroundColor: '#ef4444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    unassignText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    emptyPodBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        borderRadius: 12,
        borderStyle: 'dashed',
        borderWidth: 2,
        borderColor: '#2563EB',
    },
    emptyPodText: { marginLeft: 8, color: '#2563EB', fontWeight: '700' },
    changePodBtn: { alignSelf: 'flex-start', marginTop: 8, padding: 4 },
    changePodText: { color: '#2563EB', fontWeight: '600', fontSize: 13 },

    zoneRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 12 },
    zoneLabel: { width: 50, fontWeight: '700', fontSize: 11 },
    zoneInput: { flex: 1, height: 40, borderWidth: 1, borderRadius: 8, textAlign: 'center' },
    speedRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 12 },

    saveBtn: {
        backgroundColor: '#2563EB',
        height: 56,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
    },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

    modalOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: { width: '100%', borderRadius: 20, padding: 24, maxHeight: '80%' },
    modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 20 },
    modalOption: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    modalOptionText: { fontSize: 16, fontWeight: '600' },
    modalClose: { marginTop: 20, padding: 12, alignItems: 'center' },
    modalCloseText: { color: '#64748B', fontWeight: '700' },
});
