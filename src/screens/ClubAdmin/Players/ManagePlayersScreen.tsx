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
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../../components/context/ThemeContext';
import { useAlert } from '../../../components/context/AlertContext';
import {
    createPlayer,
    updatePlayer,
    getMyClubPods,
    getMyPodHolders,
    getPodsByHolder,
    assignPodToPlayer,
    unassignPodFromPlayer,
    deletePlayer,
    getMyClubPlayers,
} from '../../../api/players';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../../utils/constants';
import api from '../../../api/axios';
import { loadPlayersUnified } from '../../../services/playerSync.service';
import { upsertPlayersToSQLite, getPlayersFromSQLite } from '../../../services/playerCache.service';
import { db } from '../../../db/sqlite';
import { getClubZoneDefaults } from '../../../api/clubZones';
import NetInfo from '@react-native-community/netinfo';

type Mode = 'LIST' | 'CREATE' | 'EDIT';

const ManagePlayersScreen = () => {
    const { theme } = useTheme();
    const { showAlert } = useAlert();
    const isDark = theme === 'dark';

    const [mode, setMode] = useState<Mode>('LIST');
    const [players, setPlayers] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [showHowTo, setShowHowTo] = useState(false);

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

    // Pod Holders & Pods
    const [podHolders, setPodHolders] = useState<any[]>([]);
    const [selectedPodHolderId, setSelectedPodHolderId] = useState<string | null>(null);
    const [availablePods, setAvailablePods] = useState<any[]>([]);
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

    const loadPlayers = async (withCache = true) => {
        const clubId = await AsyncStorage.getItem(STORAGE_KEYS.CLUB_ID);

        if (withCache && players.length === 0) {
            const cached = getPlayersFromSQLite(clubId || undefined);
            if (cached && cached.length > 0) setPlayers(cached);
        }

        try {
            const net = await NetInfo.fetch();
            if (net.isConnected) {
                const freshData = await getMyClubPlayers();
                if (Array.isArray(freshData)) {
                    // Sync: Clear old and insert new
                    if (clubId) {
                        db.execute('DELETE FROM players WHERE club_id = ?', [clubId]);
                    } else {
                        // Fallback if clubId not found, potentially dangerous if multiple clubs used
                        // but safer than not clearing. Ideally clubId should exist.
                        db.execute('DELETE FROM players');
                    }
                    upsertPlayersToSQLite(freshData);
                    setPlayers(freshData);
                }
            } else {
                const data = await loadPlayersUnified();
                if (Array.isArray(data)) setPlayers(data);
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
            const clubId = await AsyncStorage.getItem(STORAGE_KEYS.CLUB_ID);
            const net = await NetInfo.fetch();
            if (net.isConnected) {
                // Force fresh fetch
                const freshData = await getMyClubPlayers();
                if (Array.isArray(freshData)) {
                    if (clubId) {
                        db.execute('DELETE FROM players WHERE club_id = ?', [clubId]);
                    } else {
                        db.execute('DELETE FROM players');
                    }
                    upsertPlayersToSQLite(freshData);
                    setPlayers(freshData);
                }
            } else {
                const data = await loadPlayersUnified();
                if (Array.isArray(data)) setPlayers(data);
            }
        } catch (e) {
            console.error('Refresh failed', e);
        } finally {
            setRefreshing(false);
        }
    }, []);

    const loadPodHolders = async () => {
        try {
            const holders = await getMyPodHolders();
            setPodHolders(Array.isArray(holders) ? holders : []);
        } catch (e) {
            console.error('Failed to load pod holders', e);
        }
    };

    const loadPodsByHolder = async (holderId: string) => {
        try {
            setLoading(true);
            const podsData = await getPodsByHolder(holderId);
            const filtered = (Array.isArray(podsData) ? podsData : []).filter((p: any) => {
                if (!p) return false;
                // Filter out pods assigned to ANY player
                const hasAssignment =
                    (Array.isArray(p.player_pods) && p.player_pods.length > 0) ||
                    Boolean(p.player_id) ||
                    Boolean(p.assigned_player_id);
                return !hasAssignment;
            });
            setAvailablePods(filtered);
        } catch (e) {
            console.error('Failed to load pods for holder', e);
            setAvailablePods([]);
        } finally {
            setLoading(false);
        }
    };

    const loadAvailablePodsForEdit = async () => {
        try {
            setLoading(true);
            setAvailablePods([]);
            const podsData = await getMyClubPods();

            let podsArray = podsData;
            if (!Array.isArray(podsArray) && podsArray?.data && Array.isArray(podsArray.data)) {
                podsArray = podsArray.data;
            }
            if (!Array.isArray(podsArray)) {
                podsArray = [];
            }

            const filtered = podsArray.filter((p: any) => {
                if (!p) return false;
                const currentPodId = assignedPod?.pod_id ?? editingPlayer?.pod_id ?? null;
                const currentPodSerial = assignedPod?.serial_number ?? editingPlayer?.pod_serial ?? null;

                if (currentPodId && String(p.pod_id) === String(currentPodId)) return false;
                if (currentPodSerial && String(p.serial_number) === String(currentPodSerial)) return false;

                // Filter out pods assigned to ANY player
                const hasAssignment =
                    (Array.isArray(p.player_pods) && p.player_pods.length > 0) ||
                    Boolean(p.player_id) ||
                    Boolean(p.assigned_player_id);
                return !hasAssignment;
            });

            setAvailablePods(filtered);

            // If player has an assigned pod, try to pre-select its holder
            if (assignedPod?.pod_holder_id || assignedPod?.pod_holder?.pod_holder_id) {
                const holderId = assignedPod?.pod_holder_id || assignedPod?.pod_holder?.pod_holder_id;
                setSelectedPodHolderId(holderId);
            }
        } catch (e) {
            console.error('Failed to load available pods', e);
            setAvailablePods([]);
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
        setSelectedPodHolderId(null);
        setAvailablePods([]);
        setAssignedPod(null);
        setZones([]);
    };

    const handleCreate = () => {
        resetForm();
        setMode('CREATE');
        loadPodHolders();
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
        setSelectedPodHolderId(null);
        setSelectedPodId(null);
        setAvailablePods([]);
        setMode('EDIT');
        loadPodHolders();
    };

    const handleDelete = (player: any) => {
        showAlert({
            title: 'Delete Player',
            message: `Are you sure you want to delete ${player.player_name}? This action cannot be undone.`,
            type: 'warning',
            buttons: [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            if (!player.player_id) {
                                console.error('❌ Deletion failed: player_id is null/undefined', player);
                                showAlert({
                                    title: 'Error',
                                    message: 'Player ID missing. Try refreshing.',
                                    type: 'error',
                                });
                                return;
                            }
                            await deletePlayer(player.player_id);
                            db.execute(`DELETE FROM players WHERE player_id = ?`, [player.player_id]);
                            setPlayers(prev => prev.filter(p => p.player_id !== player.player_id));
                            showAlert({
                                title: 'Success',
                                message: 'Player deleted',
                                type: 'success',
                            });
                        } catch (e: any) {
                            console.error('❌ Failed to delete player:', e);
                            showAlert({
                                title: 'Error',
                                message: e?.response?.data?.message || 'Failed to delete player from server',
                                type: 'error',
                            });
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        });
    };

    const handleSave = async () => {
        if (!form.player_name) {
            showAlert({
                title: 'Error',
                message: 'Player name is required',
                type: 'warning',
            });
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
                showAlert({
                    title: 'Success',
                    message: 'Player registered',
                    type: 'success',
                });
            } else {
                const updated = await updatePlayer(editingPlayer.player_id, payload);
                // Update local SQLite HR zones
                db.execute(
                    `UPDATE players SET hr_zones=? WHERE player_id=?`,
                    [JSON.stringify(zones), editingPlayer.player_id]
                );
                upsertPlayersToSQLite([updated]);
                showAlert({
                    title: 'Success',
                    message: 'Player updated',
                    type: 'success',
                });
            }
            setMode('LIST');
        } catch (e: any) {
            showAlert({
                title: 'Error',
                message: e?.response?.data?.message || 'Failed to save player',
                type: 'error',
            });
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
        } catch (e) {
            showAlert({
                title: 'Error',
                message: 'Failed to assign pod',
                type: 'error',
            });
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
            showAlert({
                title: 'Error',
                message: 'Failed to unassign pod',
                type: 'error',
            });
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

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 120}
        >
            {mode === 'LIST' ? (
                <View style={[styles.container, { backgroundColor: 'transparent' }]}>
                    {/* TOP BAR / SEARCH */}
                    <View style={styles.topActions}>
                        <View style={styles.headerRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <Text style={[styles.title, { color: isDark ? '#fff' : '#000', fontSize: 28, fontWeight: '900' }]}>Players</Text>
                                <TouchableOpacity onPress={() => setShowHowTo(true)}>
                                    <Ionicons name="information-circle-outline" size={26} color={isDark ? '#94A3B8' : '#64748B'} />
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity onPress={handleCreate} style={styles.addBtnRed}>
                                <Ionicons name="add" size={22} color="#fff" />
                                <Text style={styles.addBtnText}>Add Player</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={[styles.searchContainer, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9', marginTop: 16 }]}>
                            <Ionicons name="search" size={20} color={isDark ? '#94A3B8' : '#64748B'} />
                            <TextInput
                                placeholder="Search by name, position, or pod..."
                                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                                style={[styles.searchInput, { color: isDark ? '#FFF' : '#000' }]}
                                value={search}
                                onChangeText={setSearch}
                            />
                        </View>
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
                        contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}
                        keyboardShouldPersistTaps="handled"
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
                                <Text style={[styles.tdText, { flex: 1, color: isDark ? '#94A3B8' : '#64748B' }]}>{item.age || '-'}</Text>

                                {/* POSITION */}
                                <Text style={[styles.tdText, { flex: 1.5, color: isDark ? '#94A3B8' : '#64748B' }]}>{item.position || '-'}</Text>

                                {/* HEIGHT/WEIGHT */}
                                <Text style={[styles.tdText, { flex: 2.2, color: isDark ? '#94A3B8' : '#64748B' }]}>
                                    {item.height ? `${item.height}cm` : '-'} / {item.weight ? `${item.weight}kg` : '-'}
                                </Text>

                                {/* POD */}
                                <Text style={[styles.tdText, { flex: 2, color: '#DC2626', fontWeight: '500' }]}>
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
            ) : (
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={[styles.formContent, { paddingBottom: 20, flexGrow: 1 }]}
                    keyboardShouldPersistTaps="handled"
                    automaticallyAdjustKeyboardInsets={true}
                >
                    {renderBackHeader(mode === 'CREATE' ? 'Add New Player' : 'Edit Player')}
                    {/* PLAYER NAME & JERSEY NUMBER */}
                    <View style={styles.row}>
                        <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                            <Text style={[styles.label, { color: isDark ? '#94a3b8' : '#64748B' }]}>
                                <Ionicons name="person-outline" size={14} color="#DC2626" /> Player Name
                            </Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#fff' : '#000' }]}
                                value={form.player_name}
                                onChangeText={v => setForm({ ...form, player_name: v })}
                                placeholder="Full Name"
                                placeholderTextColor="#94a3b8"
                            />
                        </View>
                        <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                            <Text style={[styles.label, { color: isDark ? '#94a3b8' : '#64748B' }]}>
                                <Ionicons name="shirt-outline" size={14} color="#DC2626" /> Jersey Number
                            </Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#fff' : '#000' }]}
                                value={form.jersey_number}
                                keyboardType="numeric"
                                onChangeText={v => setForm({ ...form, jersey_number: v })}
                                placeholder="Number"
                                placeholderTextColor="#94a3b8"
                            />
                        </View>
                    </View>

                    {/* AGE & POSITION */}
                    <View style={styles.row}>
                        <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                            <Text style={[styles.label, { color: isDark ? '#94a3b8' : '#64748B' }]}>
                                <Ionicons name="calendar-outline" size={14} color="#DC2626" /> Age
                            </Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#fff' : '#000' }]}
                                value={form.age}
                                keyboardType="numeric"
                                onChangeText={v => setForm({ ...form, age: v })}
                                placeholder="26"
                                placeholderTextColor="#94a3b8"
                            />
                        </View>
                        <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                            <Text style={[styles.label, { color: isDark ? '#94a3b8' : '#64748B' }]}>
                                <Ionicons name="football-outline" size={14} color="#DC2626" /> Position
                            </Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#fff' : '#000' }]}
                                value={form.position}
                                onChangeText={v => setForm({ ...form, position: v })}
                                placeholder="e.g. Forward"
                                placeholderTextColor="#94a3b8"
                            />
                        </View>
                    </View>

                    {/* HEIGHT & WEIGHT */}
                    <View style={styles.row}>
                        <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                            <Text style={[styles.label, { color: isDark ? '#94a3b8' : '#64748B' }]}>
                                <Ionicons name="resize-outline" size={14} color="#DC2626" /> Height
                            </Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#fff' : '#000' }]}
                                value={form.height}
                                keyboardType="numeric"
                                onChangeText={v => setForm({ ...form, height: v })}
                                placeholder="185"
                                placeholderTextColor="#94a3b8"
                            />
                        </View>
                        <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                            <Text style={[styles.label, { color: isDark ? '#94a3b8' : '#64748B' }]}>
                                <Ionicons name="barbell-outline" size={14} color="#DC2626" /> Weight
                            </Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#fff' : '#000' }]}
                                value={form.weight}
                                keyboardType="numeric"
                                onChangeText={v => setForm({ ...form, weight: v })}
                                placeholder="85"
                                placeholderTextColor="#94a3b8"
                            />
                        </View>
                    </View>

                    {/* DIVIDER */}
                    <View style={{ height: 1, backgroundColor: isDark ? '#334155' : '#e2e8f0', marginVertical: 24 }} />

                    {/* POD ASSIGNMENT SECTION */}
                    {mode === 'CREATE' && (
                        <View style={styles.formGroup}>
                            <Text style={[styles.label, { color: isDark ? '#94a3b8' : '#64748B', marginBottom: 12 }]}>
                                <Ionicons name="radio-outline" size={14} color="#DC2626" /> Assign Hub Pod
                            </Text>

                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                                {podHolders.map(holder => (
                                    <TouchableOpacity
                                        key={holder.pod_holder_id}
                                        onPress={() => {
                                            setSelectedPodHolderId(holder.pod_holder_id);
                                            loadPodsByHolder(holder.pod_holder_id);
                                            setSelectedPodId(null);
                                        }}
                                        style={[
                                            styles.podHolderChip,
                                            {
                                                backgroundColor: selectedPodHolderId === holder.pod_holder_id ? '#DC2626' : (isDark ? '#1e293b' : '#fff'),
                                                borderColor: selectedPodHolderId === holder.pod_holder_id ? '#DC2626' : (isDark ? '#334155' : '#e2e8f0')
                                            }
                                        ]}
                                    >
                                        <Ionicons
                                            name="hardware-chip-outline"
                                            size={16}
                                            color={selectedPodHolderId === holder.pod_holder_id ? '#fff' : '#DC2626'}
                                        />
                                        <Text style={[
                                            styles.podHolderChipText,
                                            { color: selectedPodHolderId === holder.pod_holder_id ? '#fff' : (isDark ? '#94a3b8' : '#64748B') }
                                        ]}>
                                            {holder.serial_number || holder.holder_name || `Holder ${holder.pod_holder_id.slice(0, 8)}`}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            {selectedPodHolderId && (
                                <>
                                    {loading ? (
                                        <ActivityIndicator size="small" color="#DC2626" style={{ marginVertical: 20 }} />
                                    ) : (
                                        <View style={styles.podGrid}>
                                            {availablePods.map(p => (
                                                <TouchableOpacity
                                                    key={p.pod_id}
                                                    onPress={() => setSelectedPodId(p.pod_id)}
                                                    style={[
                                                        styles.podSelector,
                                                        {
                                                            backgroundColor: isDark ? '#1e293b' : '#fff',
                                                            borderColor: selectedPodId === p.pod_id ? '#DC2626' : (isDark ? '#334155' : '#e2e8f0'),
                                                            borderWidth: selectedPodId === p.pod_id ? 2 : 1
                                                        }
                                                    ]}
                                                >
                                                    <Ionicons
                                                        name={selectedPodId === p.pod_id ? "radio-button-on" : "radio-button-off"}
                                                        size={18}
                                                        color={selectedPodId === p.pod_id ? '#DC2626' : '#94a3b8'}
                                                    />
                                                    <Text style={[
                                                        styles.podSelectorText,
                                                        { color: selectedPodId === p.pod_id ? '#DC2626' : (isDark ? '#94a3b8' : '#64748B') }
                                                    ]}>
                                                        {p.serial_number}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}
                                </>
                            )}
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
                                <TouchableOpacity
                                    style={styles.emptyPodBtn}
                                    onPress={() => {
                                        setShowPodModal(true);
                                        loadAvailablePodsForEdit();
                                    }}
                                >
                                    <Ionicons name="add-circle-outline" size={24} color="#DC2626" />
                                    <Text style={styles.emptyPodText}>Link a Hardware Pod</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    <TouchableOpacity style={styles.saveBtnFull} onPress={handleSave} disabled={loading}>
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnTextFull}>{mode === 'CREATE' ? 'Register Player' : 'Confirm Updates'}</Text>}
                    </TouchableOpacity>
                </ScrollView>
            )}

            <Modal transparent visible={showPodModal} animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: isDark ? '#0F172A' : '#fff' }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#000' }]}>Link Hardware Pod</Text>
                            <TouchableOpacity onPress={() => {
                                setShowPodModal(false);
                                setSelectedPodHolderId(null);
                                setAvailablePods([]);
                            }}>
                                <Ionicons name="close" size={24} color={isDark ? '#fff' : '#000'} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                            {podHolders.map(holder => (
                                <TouchableOpacity
                                    key={holder.pod_holder_id}
                                    onPress={() => {
                                        setSelectedPodHolderId(holder.pod_holder_id);
                                        loadPodsByHolder(holder.pod_holder_id);
                                    }}
                                    style={[
                                        styles.podHolderChip,
                                        {
                                            backgroundColor: selectedPodHolderId === holder.pod_holder_id ? '#DC2626' : (isDark ? '#1e293b' : '#fff'),
                                            borderColor: selectedPodHolderId === holder.pod_holder_id ? '#DC2626' : (isDark ? '#334155' : '#e2e8f0')
                                        }
                                    ]}
                                >
                                    <Ionicons
                                        name="hardware-chip-outline"
                                        size={16}
                                        color={selectedPodHolderId === holder.pod_holder_id ? '#fff' : '#DC2626'}
                                    />
                                    <Text style={[
                                        styles.podHolderChipText,
                                        { color: selectedPodHolderId === holder.pod_holder_id ? '#fff' : (isDark ? '#94a3b8' : '#64748B') }
                                    ]}>
                                        {holder.serial_number || holder.holder_name || `Holder ${holder.pod_holder_id.slice(0, 8)}`}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {selectedPodHolderId && (
                            <FlatList
                                data={availablePods}
                                keyExtractor={p => p.pod_id}
                                renderItem={({ item }) => (
                                    <TouchableOpacity style={[styles.modalOption, { borderBottomColor: isDark ? '#1E293B' : '#F1F5F9' }]} onPress={() => handlePodAction(item)}>
                                        <Ionicons name="hardware-chip-outline" size={20} color="#DC2626" />
                                        <Text style={[styles.modalOptionText, { color: isDark ? '#fff' : '#000' }]}>{item.serial_number}</Text>
                                    </TouchableOpacity>
                                )}
                                ListEmptyComponent={<Text style={{ textAlign: 'center', padding: 40, color: '#64748B' }}>No available pods found in this holder.</Text>}
                            />
                        )}
                        {!selectedPodHolderId && (
                            <Text style={{ textAlign: 'center', padding: 40, color: '#64748B' }}>Please select a pod holder first.</Text>
                        )}
                    </View>
                </View>
            </Modal>

            <Modal
                visible={showHowTo}
                transparent
                animationType="fade"
                onRequestClose={() => setShowHowTo(false)}
            >
                <View style={styles.howToOverlay}>
                    <View style={[styles.howToContentCentered, { backgroundColor: isDark ? '#1e293b' : '#fff' }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.howToTitle, { color: isDark ? '#fff' : '#1e293b' }]}>How to Manage Players</Text>
                            <TouchableOpacity onPress={() => setShowHowTo(false)}>
                                <Ionicons name="close" size={24} color={isDark ? '#94a3b8' : '#64748B'} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={styles.step}>
                                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
                                <View style={styles.stepTextContainer}>
                                    <Text style={[styles.stepTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Register Players</Text>
                                    <Text style={[styles.stepDesc, { color: isDark ? '#94a3b8' : '#64748B' }]}>Tap the "+ Add Player" button to create a new profile for your team members.</Text>
                                </View>
                            </View>

                            <View style={styles.step}>
                                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
                                <View style={styles.stepTextContainer}>
                                    <Text style={[styles.stepTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Link Hardware Pods</Text>
                                    <Text style={[styles.stepDesc, { color: isDark ? '#94a3b8' : '#64748B' }]}>Every player needs a pod. Select a Pod Holder and choose an available pod from the list.</Text>
                                </View>
                            </View>

                            <View style={styles.step}>
                                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
                                <View style={styles.stepTextContainer}>
                                    <Text style={[styles.stepTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Switch or Unassign</Text>
                                    <Text style={[styles.stepDesc, { color: isDark ? '#94a3b8' : '#64748B' }]}>If you need to change a pod, just tap on the pencil icon to edit then manage pods.</Text>
                                </View>
                            </View>

                            <View style={styles.step}>
                                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>4</Text></View>
                                <View style={styles.stepTextContainer}>
                                    <Text style={[styles.stepTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Ready for Session</Text>
                                    <Text style={[styles.stepDesc, { color: isDark ? '#94a3b8' : '#64748B' }]}>Once assigned, the player's data will be tracked during your next monitored session.</Text>
                                </View>
                            </View>
                        </ScrollView>

                        <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowHowTo(false)}>
                            <Text style={styles.closeModalBtnText}>Got it!</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
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
        marginTop: 45, // Significant clearance for modal close button
        paddingRight: 60, // Clearance for modal close button
    },
    title: { fontSize: 22, fontWeight: '800' },
    backBtn: { padding: 8 },

    topActions: {
        padding: 20,
        paddingTop: 45, // Significant clearance for modal close button
        paddingRight: 60, // Clearance for modal close button
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
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
    },
    tdText: {
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
    subLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
    podHolderChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        marginRight: 10,
        gap: 6
    },
    podHolderChipText: { fontSize: 14, fontWeight: '600' },
    podGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    podSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        gap: 8,
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

    // HowTo Modal Styles (Centered)
    howToOverlay: {
        flex: 1,
        backgroundColor: 'rgba(2, 6, 23, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    howToContentCentered: {
        width: '100%',
        maxWidth: 500,
        borderRadius: 28,
        padding: 24,
        maxHeight: '85%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
    },
    howToTitle: { fontSize: 20, fontWeight: '900' },
    step: {
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
    stepTitle: {
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
