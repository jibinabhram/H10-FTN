
import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Switch,
    FlatList,
    Modal,
    ActivityIndicator,
    Platform,
    KeyboardAvoidingView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../../db/sqlite';
import { useTheme } from '../../components/context/ThemeContext';
import api from '../../api/axios';
import NetInfo from '@react-native-community/netinfo';
import { useAlert } from '../../components/context/AlertContext';
import { STORAGE_KEYS } from '../../utils/constants';

const PRIMARY = '#DC2626'; // Red/Coral

/* ================= TYPES ================= */

type Tab = 'Thresholds' | 'Exercises';

interface Threshold {
    id: number;
    club_id?: string;
    player_id?: string;
    type: 'absolute' | 'relative';
    zone_name: string;
    min_val: number;
    max_val: number;
    is_default: number;
}

interface Exercise {
    id: string;
    backend_id?: string;
    name: string;
    event_type: 'match' | 'training';
    is_system: number | boolean;
}

/* ================= MAIN SCREEN ================= */

export default function TeamSettingsScreen() {
    const { theme } = useTheme();
    const isDark = theme === "dark";

    const navigation = useNavigation();
    const [activeTab, setActiveTab] = useState<Tab>('Thresholds');
    const [clubId, setClubId] = useState<string | null>(null);

    // Load Club ID from cached profile / storage
    useEffect(() => {
        const fetchClubId = async () => {
            try {
                const storedClubId = await AsyncStorage.getItem(STORAGE_KEYS.CLUB_ID);
                if (storedClubId) {
                    setClubId(storedClubId);
                    return;
                }

                const profileCache = await AsyncStorage.getItem('CACHED_PROFILE');
                if (profileCache) {
                    const profile = JSON.parse(profileCache);
                    const cid = profile?.club_id || profile?.data?.user?.club_id || profile?.user?.club_id || null;
                    if (cid) {
                        setClubId(cid);
                        await AsyncStorage.setItem(STORAGE_KEYS.CLUB_ID, cid);
                    }
                }
            } catch (e) {
                console.error('❌ Failed to fetch club ID', e);
            }
        };
        fetchClubId();
    }, []);

    const handleBack = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            navigation.navigate('ClubAdminProfile' as never);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
        >
            <ScrollView
                style={{ flex: 1, backgroundColor: 'transparent' }}
                contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
            >
                {/* HEADER */}
                <View style={styles.header}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.title, { color: isDark ? "#fff" : "#0f172a" }]}>Team Settings</Text>
                    </View>
                </View>

                {/* TABS - Updated to match mockup pills */}
                <View style={styles.tabWrapper}>
                    <View style={[styles.tabContainer, { backgroundColor: isDark ? "#1E293B" : "#F1F5F9" }]}>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'Thresholds' && styles.tabActive]}
                            onPress={() => setActiveTab('Thresholds')}
                        >
                            <Ionicons name="speedometer-outline" size={18} color={activeTab === 'Thresholds' ? "#fff" : (isDark ? "#94A3B8" : "#64748B")} />
                            <Text style={[styles.tabText, activeTab === 'Thresholds' && styles.tabTextActive]}>
                                Speed Threshold
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'Exercises' && styles.tabActive]}
                            onPress={() => setActiveTab('Exercises')}
                        >
                            <Ionicons name="walk-outline" size={18} color={activeTab === 'Exercises' ? "#fff" : (isDark ? "#94A3B8" : "#64748B")} />
                            <Text style={[styles.tabText, activeTab === 'Exercises' && styles.tabTextActive]}>
                                Exercise Type
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.content}>
                    {activeTab === 'Thresholds' && <ThresholdsView isDark={isDark} clubId={clubId} />}
                    {activeTab === 'Exercises' && <ExercisesView isDark={isDark} clubId={clubId} />}
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
/* ================= THRESHOLDS VIEW ================= */

const DEFAULT_ABS = [
    { zone_name: 'Walk', min_val: 0, max_val: 7 },
    { zone_name: 'Jog', min_val: 7, max_val: 14 },
    { zone_name: 'Run', min_val: 14, max_val: 20 },
    { zone_name: 'Sprint', min_val: 20, max_val: 25 },
    { zone_name: 'High Intensity Sprint', min_val: 25, max_val: 999 },
];

const DEFAULT_REL = [
    { zone_name: 'Walk', min_val: 0, max_val: 20 },
    { zone_name: 'Jog', min_val: 20, max_val: 40 },
    { zone_name: 'Run', min_val: 40, max_val: 60 },
    { zone_name: 'Sprint', min_val: 60, max_val: 80 },
    { zone_name: 'High Intensity Sprint', min_val: 80, max_val: 100 },
];

const ThresholdsView = ({ isDark, clubId }: { isDark: boolean; clubId: string | null }) => {
    const { showAlert } = useAlert();
    const [absThresholds, setAbsThresholds] = useState<Threshold[]>(() =>
        DEFAULT_ABS.map((d, idx) => ({
            id: idx + 1,
            club_id: clubId ?? undefined,
            type: 'absolute',
            zone_name: d.zone_name,
            min_val: d.min_val,
            max_val: d.max_val,
            is_default: 1,
        }))
    );
    const [relThresholds, setRelThresholds] = useState<Threshold[]>(() =>
        DEFAULT_REL.map((d, idx) => ({
            id: idx + 1,
            club_id: clubId ?? undefined,
            type: 'relative',
            zone_name: d.zone_name,
            min_val: d.min_val,
            max_val: d.max_val,
            is_default: 1,
        }))
    );
    const [useDefaultAbs, setUseDefaultAbs] = useState(true);
    const [useDefaultRel, setUseDefaultRel] = useState(true);

    const DEFAULT_HR = [
        { zone_number: 1, min_hr: 101, max_hr: 120 },
        { zone_number: 2, min_hr: 120, max_hr: 140 },
        { zone_number: 3, min_hr: 140, max_hr: 160 },
        { zone_number: 4, min_hr: 160, max_hr: 180 },
        { zone_number: 5, min_hr: 180, max_hr: 200 },
    ];

    const [hrThresholds, setHrThresholds] = useState<any[]>(DEFAULT_HR);
    const [useDefaultHr, setUseDefaultHr] = useState(true);
    const [editValues, setEditValues] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const resolveClubId = useCallback(async () => {
        if (clubId) return clubId;
        const storedClubId = await AsyncStorage.getItem(STORAGE_KEYS.CLUB_ID);
        if (storedClubId) return storedClubId;
        return null;
    }, [clubId]);

    const loadData = useCallback(async (localOnly = false) => {
        const cid = await resolveClubId();
        if (!cid) return;
        try {
            const res = db.execute(`SELECT * FROM team_thresholds WHERE club_id = ? ORDER BY id`, [cid]);
            const allLocal: Threshold[] = res.rows?._array || [];
            if (allLocal.length > 0) {
                const abs = allLocal.filter(t => t.type === 'absolute');
                const rel = allLocal.filter(t => t.type === 'relative');
                setAbsThresholds(abs);
                setRelThresholds(rel);
                setUseDefaultAbs(abs.every(t => t.is_default === 1));
                setUseDefaultRel(rel.every(t => t.is_default === 1));
            }

            const hrLocal = db.execute(`SELECT * FROM hr_zones ORDER BY zone_number`);
            if (hrLocal?.rows?._array && hrLocal.rows._array.length > 0) {
                setHrThresholds(hrLocal.rows._array);
            }

            if (!localOnly) {
                const net = await NetInfo.fetch();
                if (net.isConnected) {
                    const [thresholdsRes, hrRes] = await Promise.all([
                        api.get(`/team-thresholds?club_id=${cid}`),
                        api.get('/club-zones/defaults')
                    ]);

                    const thresholdsData = thresholdsRes.data?.data?.data ?? thresholdsRes.data?.data ?? thresholdsRes.data;
                    if (Array.isArray(thresholdsData) && thresholdsData.length > 0) {
                        const abs = thresholdsData.filter((t: any) => t.type === 'absolute');
                        const rel = thresholdsData.filter((t: any) => t.type === 'relative');
                        setAbsThresholds(abs);
                        setRelThresholds(rel);
                        setUseDefaultAbs(abs.every((t: any) => t.is_default === 1 || t.is_default === true));
                        setUseDefaultRel(rel.every((t: any) => t.is_default === 1 || t.is_default === true));
                    }

                    const hrData = hrRes.data?.data?.data ?? hrRes.data?.data ?? hrRes.data?.zones ?? hrRes.data;
                    if (Array.isArray(hrData) && hrData.length > 0) {
                        setHrThresholds(hrData);
                    }
                }
            }
        } catch (e) { console.error('❌ loadData error:', e); }
    }, [resolveClubId]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleSave = async () => {
        const cid = await resolveClubId();
        if (!cid) return;

        showAlert({
            title: 'Confirm Save',
            message: 'Update team thresholds?',
            type: 'warning',
            buttons: [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    onPress: async () => {
                        setSaving(true);
                        try {
                            // Show processing message
                            showAlert({
                                title: "Processing",
                                message: "Saving changes...",
                                type: 'info',
                            });

                            for (const t of absThresholds) {
                                db.execute(
                                    `INSERT INTO team_thresholds (club_id, type, zone_name, min_val, max_val, is_default)
                                 VALUES (?, 'absolute', ?, ?, ?, ?)
                                 ON CONFLICT(club_id, type, zone_name) DO UPDATE SET
                                 min_val=excluded.min_val, max_val=excluded.max_val, is_default=excluded.is_default`,
                                    [cid, t.zone_name, Number(t.min_val), Number(t.max_val), useDefaultAbs ? 1 : 0]
                                );
                            }
                            for (const t of relThresholds) {
                                db.execute(
                                    `INSERT INTO team_thresholds (club_id, type, zone_name, min_val, max_val, is_default)
                                 VALUES (?, 'relative', ?, ?, ?, ?)
                                 ON CONFLICT(club_id, type, zone_name) DO UPDATE SET
                                 min_val=excluded.min_val, max_val=excluded.max_val, is_default=excluded.is_default`,
                                    [cid, t.zone_name, Number(t.min_val), Number(t.max_val), useDefaultRel ? 1 : 0]
                                );
                            }
                            for (const h of hrThresholds) {
                                db.execute(
                                    `INSERT INTO hr_zones (zone_number, min_hr, max_hr)
                                 VALUES (?, ?, ?)
                                 ON CONFLICT(zone_number) DO UPDATE SET
                                 min_hr=excluded.min_hr, max_hr=excluded.max_hr`,
                                    [h.zone_number, Number(h.min_hr), Number(h.max_hr)]
                                );
                            }

                            // Send to API ...
                            const allT = [...absThresholds, ...relThresholds];
                            const thresholdPayloads = allT.map(t => ({
                                club_id: cid,
                                type: t.type,
                                zone_name: t.zone_name,
                                min_val: Number(t.min_val),
                                max_val: Number(t.max_val),
                                is_default: t.type === 'absolute' ? useDefaultAbs : useDefaultRel,
                            }));
                            const hrPayload = hrThresholds.map((z) => ({
                                zone_number: z.zone_number,
                                min_hr: Number(z.min_hr),
                                max_hr: Number(z.max_hr),
                            }));

                            await Promise.all([
                                ...thresholdPayloads.map((p) => api.post('/team-thresholds', p)),
                                api.post('/club-zones/defaults', { zones: hrPayload }),
                            ]);

                            showAlert({
                                title: 'Success',
                                message: 'Team thresholds updated successfully',
                                type: 'success',
                            });
                            setEditValues({});
                        } catch (e) {
                            console.error('Save error:', e);
                            showAlert({
                                title: 'Error',
                                message: 'Failed to save changes',
                                type: 'error',
                            });
                        } finally { setSaving(false); }
                    }
                }
            ]
        });
    };

    const updateVal = (type: 'absolute' | 'relative' | 'hr', id: number | string, field: any, text: string) => {
        setEditValues(prev => ({ ...prev, [`${id}_${field}`]: text }));
        const val = text === '' ? 0 : parseFloat(text);
        if (isNaN(val) && text !== '') return;

        if (type === 'absolute') {
            setAbsThresholds(prev => prev.map(t => (t.id === id || t.zone_name === id) ? { ...t, [field]: val } : t));
        } else if (type === 'relative') {
            setRelThresholds(prev => prev.map(t => (t.id === id || t.zone_name === id) ? { ...t, [field]: val } : t));
        } else {
            setHrThresholds(prev => prev.map(t => t.zone_number === id ? { ...t, [field]: val } : t));
        }
    };

    const toggleDefault = (tType: 'absolute' | 'relative' | 'hr', value: boolean) => {
        if (tType === 'absolute') {
            setUseDefaultAbs(value);
            if (value) {
                setAbsThresholds(prev => prev.map(t => {
                    const def = DEFAULT_ABS.find(d => d.zone_name === t.zone_name);
                    return def ? { ...t, min_val: def.min_val, max_val: def.max_val } : t;
                }));
                setEditValues({});
            } else {
                // Reload custom values from local DB when switching back to Custom mode
                loadData(true);
            }
        } else if (tType === 'relative') {
            setUseDefaultRel(value);
            if (value) {
                setRelThresholds(prev => prev.map(t => {
                    const def = DEFAULT_REL.find(d => d.zone_name === t.zone_name);
                    return def ? { ...t, min_val: def.min_val, max_val: def.max_val } : t;
                }));
                setEditValues({});
            } else {
                loadData(true);
            }
        } else {
            setUseDefaultHr(value);
            if (value) {
                setHrThresholds(DEFAULT_HR);
                setEditValues({});
            } else {
                loadData(true);
            }
        }
    };

    const renderCard = (title: string, sub: string, icon: string, tType: 'absolute' | 'relative' | 'hr', data: any[], isDefault: boolean) => (
        <View style={[styles.card, { backgroundColor: isDark ? "#1E293B" : "#fff", borderColor: isDark ? "#334155" : "#E2E8F0" }]}>
            <View style={styles.cardTop}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name={icon as any} size={20} color={PRIMARY} />
                    <View>
                        <Text style={[styles.cardTitle, { color: isDark ? "#fff" : "#1E293B" }]}>{title}</Text>
                        <Text style={[styles.cardSubTitle, { color: isDark ? "#94A3B8" : "#64748B" }]}>{sub}</Text>
                    </View>
                </View>

                <View style={styles.switchRow}>
                    <TouchableOpacity onPress={() => toggleDefault(tType, true)} style={styles.switchOption}>
                        <Ionicons name={isDefault ? "checkbox" : "square-outline"} size={20} color={isDefault ? PRIMARY : "#94A3B8"} />
                        <Text style={[styles.switchText, isDefault && { color: PRIMARY }]}>Use Default Values</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => toggleDefault(tType, false)} style={styles.switchOption}>
                        <Ionicons name={!isDefault ? "checkbox" : "square-outline"} size={20} color={!isDefault ? PRIMARY : "#94A3B8"} />
                        <Text style={[styles.switchText, !isDefault && { color: PRIMARY }]}>custom Values</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={[styles.divider, { backgroundColor: isDark ? "#334155" : "#E2E8F0" }]} />

            <View style={styles.gridContainer}>
                {data.map((item, idx) => {
                    const itemId = tType === 'hr' ? item.zone_number : (item.id || item.zone_name || `idx-${idx}`);
                    const zoneName = tType === 'hr' ? `Zone ${item.zone_number}` : item.zone_name;
                    const minVal = tType === 'hr' ? item.min_hr : item.min_val;
                    const maxVal = tType === 'hr' ? item.max_hr : item.max_val;
                    const unit = tType === 'hr' ? 'bpm' : 'km/h';

                    return (
                        <View key={`${tType}_${itemId}`} style={[styles.gridItem, idx % 2 !== 0 ? { marginLeft: '5%' } : {}] as any}>
                            <View style={styles.labelRow}>
                                <Text style={[styles.itemLabel, { color: isDark ? "#E2E8F0" : "#64748B" }]}>{zoneName}</Text>
                                <Text style={styles.unitText}>{unit}</Text>
                            </View>
                            <View style={styles.pillRow}>
                                <View style={[styles.pill, { backgroundColor: isDark ? "#0F172A" : "#F1F5F9" }]}>
                                    <TextInput
                                        style={[styles.pillInput, { color: PRIMARY }]}
                                        keyboardType="numeric"
                                        value={editValues[`${itemId}_${tType === 'hr' ? 'min_hr' : 'min_val'}`] ?? String(minVal)}
                                        onChangeText={v => updateVal(tType, itemId, tType === 'hr' ? 'min_hr' : 'min_val', v)}
                                        editable={!isDefault}
                                    />
                                </View>
                                <View style={styles.pillDash} />
                                <View style={[styles.pill, { backgroundColor: isDark ? "#0F172A" : "#F1F5F9" }]}>
                                    <TextInput
                                        style={[styles.pillInput, { color: PRIMARY }]}
                                        keyboardType="numeric"
                                        value={editValues[`${itemId}_${tType === 'hr' ? 'max_hr' : 'max_val'}`] ?? String(maxVal)}
                                        onChangeText={v => updateVal(tType, itemId, tType === 'hr' ? 'max_hr' : 'max_val', v)}
                                        editable={!isDefault}
                                    />
                                </View>
                            </View>
                        </View>
                    );
                })}
            </View>
        </View>
    );

    return (
        <View style={{ flex: 1, padding: 16 }}>
            {renderCard('Absolute Speed Thresholds', 'Speed values in km/hr', 'speedometer-outline', 'absolute', absThresholds, useDefaultAbs)}
            {renderCard('Relative Speed Thresholds', 'Speed values in km/hr', 'speedometer-outline', 'relative', relThresholds, useDefaultRel)}
            {renderCard('Heart Rate Zone Default', 'Heart rate zones in bpm', 'heart-outline', 'hr', hrThresholds, useDefaultHr)}

            <TouchableOpacity style={styles.saveActionBtn} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : (
                    <>
                        <Ionicons name="save-outline" size={20} color="#fff" />
                        <Text style={styles.saveActionText}>Save Changes</Text>
                    </>
                )}
            </TouchableOpacity>
        </View>
    );
};

const ExercisesView = ({ isDark, clubId }: { isDark: boolean; clubId: string | null }) => {
    const { showAlert } = useAlert();
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [type, setType] = useState<'match' | 'training'>('training');

    const loadExercises = useCallback(async () => {
        if (!clubId) return;
        setLoading(true);
        try {
            // 1) Load from local SQLite first (offline-friendly)
            const localRes = db.execute(
                `SELECT * FROM exercise_types WHERE club_id = ? ORDER BY created_at DESC, id DESC`,
                [clubId]
            );
            const localList = localRes.rows?._array || [];
            if (localList.length > 0) {
                const localMapped: Exercise[] = localList.map((ex: any) => ({
                    id: ex.backend_id ? String(ex.backend_id) : `local-${ex.id}`,
                    backend_id: ex.backend_id ?? undefined,
                    name: ex.name ?? '',
                    event_type: ex.event_type === 'match' ? 'match' : 'training',
                    is_system: ex.is_system ?? 0,
                }));
                setExercises(localMapped);
            }

            // 2) If online, hydrate SQLite from backend and refresh UI
            const net = await NetInfo.fetch();
            if (!net.isConnected) return;

            const response = await api.get(`/exercise-types?club_id=${clubId}`);
            const data = response.data?.data ?? response.data;
            const list = Array.isArray(data) ? data : [];

            if (list.length > 0) {
                for (const ex of list) {
                    const createdAt = ex.created_at ? new Date(ex.created_at).getTime() : Date.now();
                    db.execute(
                        `INSERT INTO exercise_types (club_id, name, event_type, is_system, backend_id, created_at)
                         VALUES (?, ?, ?, ?, ?, ?)
                         ON CONFLICT(club_id, name) DO UPDATE SET
                         event_type = excluded.event_type,
                         is_system = excluded.is_system,
                         backend_id = excluded.backend_id`,
                        [
                            clubId,
                            ex.name,
                            ex.event_type || 'training',
                            ex.is_system ? 1 : 0,
                            ex.exercise_type_id,
                            createdAt,
                        ]
                    );
                }

                const mapped: Exercise[] = (list as any[])
                    .map((ex: any) => ({
                        id: String(ex.exercise_type_id ?? ex.id ?? ''),
                        backend_id: ex.exercise_type_id ?? ex.id ?? undefined,
                        name: ex.name ?? '',
                        event_type: (ex.event_type === 'match' ? 'match' : 'training') as 'match' | 'training',
                        is_system: ex.is_system ?? 0,
                    }))
                    .filter((ex: Exercise) => Boolean(ex.id));

                setExercises(mapped);
            }
        } catch (e) {
            console.error('loadExercises error:', e);
        } finally {
            setLoading(false);
        }
    }, [clubId]);

    useEffect(() => {
        loadExercises();
    }, [loadExercises]);

    const handleSave = async () => {
        if (!clubId) {
            showAlert({
                title: 'Missing Club',
                message: 'Club ID not found.',
                type: 'error',
            });
            return;
        }

        const cleanedName = name.trim();
        if (!cleanedName) {
            showAlert({
                title: 'Validation Error',
                message: 'Exercise name is required',
                type: 'warning',
            });
            return;
        }

        try {
            // Show processing message
            showAlert({
                title: "Processing",
                message: "Saving exercise...",
                type: 'info',
            });

            if (editingId) {
                await api.patch(`/exercise-types/${editingId}`, {
                    name: cleanedName,
                    event_type: type,
                    club_id: clubId,
                });
            } else {
                await api.post('/exercise-types', {
                    name: cleanedName,
                    event_type: type,
                    club_id: clubId,
                });
            }

            await loadExercises();
            setModalVisible(false);
            setEditingId(null);
            setName('');
            setType('training');

            showAlert({
                title: 'Success',
                message: editingId ? 'Exercise updated' : 'Exercise created',
                type: 'success',
            });
        } catch (err) {
            console.error('Exercise save failed:', err);
            showAlert({
                title: 'Error',
                message: 'Failed to save changes',
                type: 'error',
            });
        }
    };

    const handleDelete = async (id?: string) => {
        if (!id) {
            showAlert({
                title: 'Unavailable',
                message: 'This exercise is not synced yet. Connect to the internet and try again.',
                type: 'info',
            });
            return;
        }
        showAlert({
            title: 'Delete Exercise',
            message: 'Are you sure you want to delete this exercise?',
            type: 'warning',
            buttons: [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.delete(`/exercise-types/${id}`);
                            await loadExercises();
                        } catch (e) {
                            console.error('Failed to delete exercise:', e);
                            showAlert({
                                title: 'Error',
                                message: 'Failed to delete exercise',
                                type: 'error',
                            });
                        }
                    },
                },
            ],
        });
    };

    const openEdit = (ex: Exercise) => {
        if (!ex.backend_id) {
            showAlert({
                title: 'Unavailable',
                message: 'This exercise is not synced yet. Connect to the internet and try again.',
                type: 'info',
            });
            return;
        }
        setName(ex.name);
        setType(ex.event_type);
        setEditingId(ex.backend_id);
        setModalVisible(true);
    };

    const resetForm = () => {
        setName('');
        setType('training');
        setEditingId(null);
    };

    return (
        <View style={{ flex: 1 }}>
            <View style={styles.exerciseHeader}>
                <View style={styles.headerMain}>
                    <Text style={[styles.headerTitle, { color: isDark ? "#fff" : "#1E293B" }]}>Exercise Management</Text>
                    <Text style={[styles.headerSub, { color: isDark ? "#94A3B8" : "#64748B" }]}>Manage and organize your exercise types</Text>
                </View>
                <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => {
                        resetForm();
                        setModalVisible(true);
                    }}
                >
                    <Ionicons name="add" size={20} color="#fff" />
                    <Text style={styles.addBtnText}>ADD NEW</Text>
                </TouchableOpacity>
            </View>

            <View style={[styles.table, { backgroundColor: isDark ? "#1E293B" : "#fff", borderColor: isDark ? "#334155" : "#E2E8F0" }]}>
                <View style={[styles.tableHead, { backgroundColor: isDark ? "#0F172A" : "#F8FAFC" }]}>
                    <Text style={[styles.headText, { flex: 2.5 }]}>EXERCISE INFORMATION</Text>
                    <Text style={[styles.headText, { flex: 1.5 }]}>EVENT TYPE</Text>
                    <Text style={[styles.headText, { width: 80, textAlign: 'center' }]}>ACTION</Text>
                </View>

                <FlatList
                    data={exercises}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                    renderItem={({ item }) => (
                        <View style={[styles.tableRow, { borderColor: isDark ? "#334155" : "#F1F5F9" }]}>
                            <View style={{ flex: 2.5 }}>
                                <Text style={[styles.cellName, { color: isDark ? "#fff" : "#1E293B" }]}>{item.name}</Text>
                                <View style={styles.cellIconRow}>
                                    <Ionicons name="time-outline" size={12} color={isDark ? "#94A3B8" : "#64748B"} />
                                    <Text style={[styles.cellSub, { color: isDark ? "#94A3B8" : "#64748B" }]}>System Default</Text>
                                </View>
                            </View>

                            <View style={{ flex: 1.5 }}>
                                <View style={[styles.badge, { backgroundColor: item.event_type === 'match' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)' }]}>
                                    <Text style={[styles.badgeText, { color: item.event_type === 'match' ? '#D97706' : '#059669' }]}>
                                        {item.event_type === 'match' ? 'Match' : 'Training'}
                                    </Text>
                                </View>
                            </View>

                            <View style={[styles.actionRow, { width: 80, justifyContent: 'center' }]}>
                                <TouchableOpacity style={styles.circBtn} onPress={() => openEdit(item)}>
                                    <Ionicons name="pencil-outline" size={16} color={PRIMARY} />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.circBtn} onPress={() => handleDelete(item.backend_id)}>
                                    <Ionicons name="trash-outline" size={16} color={PRIMARY} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                    ListEmptyComponent={
                        loading ? (
                            <ActivityIndicator style={{ padding: 20 }} color={PRIMARY} />
                        ) : (
                            <Text style={[styles.emptyText, { padding: 20, color: isDark ? "#94A3B8" : "#64748B" }]}>No exercises found.</Text>
                        )
                    }
                />
            </View>

            {/* MODAL */}
            <Modal visible={modalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={{ width: '100%', alignItems: 'center' }}
                    >
                        <View style={[styles.modalContent, { backgroundColor: isDark ? "#1E293B" : "#fff" }]}>
                            <Text style={[styles.modalTitle, { color: isDark ? "#fff" : "#1E293B" }]}>
                                {editingId ? 'Update Exercise' : 'Create New Exercise'}
                            </Text>

                            <Text style={[styles.fieldLabel, { color: isDark ? "#E2E8F0" : "#64748B" }]}>Exercise Name</Text>
                            <TextInput
                                style={[styles.input, {
                                    backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
                                    borderColor: isDark ? "#334155" : "#E2E8F0",
                                    color: isDark ? "#fff" : "#1E293B"
                                }]}
                                value={name}
                                onChangeText={setName}
                                placeholder="Enter exercise name..."
                                placeholderTextColor={isDark ? "#475569" : "#94A3B8"}
                            />

                            <Text style={[styles.fieldLabel, { color: isDark ? "#E2E8F0" : "#64748B" }]}>Select Type</Text>
                            <View style={styles.typeRow}>
                                {['training', 'match'].map((t) => (
                                    <TouchableOpacity
                                        key={t}
                                        style={[
                                            styles.typeOption,
                                            { borderColor: isDark ? "#334155" : "#E2E8F0" },
                                            type === t && styles.typeOptionActive,
                                        ]}
                                        onPress={() => setType(t as any)}
                                    >
                                        <Text
                                            style={[
                                                styles.typeText,
                                                type === t && styles.typeTextActive,
                                            ]}
                                        >
                                            {t.charAt(0).toUpperCase() + t.slice(1)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <View style={styles.modalActions}>
                                <TouchableOpacity
                                    style={[styles.cancelBtn, { backgroundColor: isDark ? "#334155" : "#F1F5F9" }]}
                                    onPress={() => {
                                        setModalVisible(false);
                                        resetForm();
                                    }}
                                >
                                    <Text style={[styles.cancelText, { color: isDark ? "#94A3B8" : "#64748B" }]}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSave}>
                                    <Text style={styles.saveText}>Save Exercise</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </View>
    );
};

/* ================= STYLES ================= */

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        marginBottom: 20,
        marginTop: 15,    // Clearance for modal close button
        paddingRight: 40, // Clearance for modal close button
    },
    backButton: {
        padding: 4,
        marginRight: 8,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
    },
    tabWrapper: {
        paddingHorizontal: 16,
        marginBottom: 20,
    },
    tabContainer: {
        flexDirection: 'row',
        padding: 4,
        borderRadius: 10,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 8,
        gap: 8,
    },
    tabActive: {
        backgroundColor: PRIMARY,
        shadowColor: PRIMARY,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
    },
    tabTextActive: {
        color: '#fff',
    },
    content: {
        flex: 1,
    },

    /* CARD STYLES */
    card: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
    },
    cardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    cardSubTitle: {
        fontSize: 12,
        marginTop: 2,
    },
    switchRow: {
        flexDirection: 'row',
        gap: 12,
    },
    switchOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    switchText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#94A3B8',
        textTransform: 'uppercase',
    },
    divider: {
        height: 1,
        marginBottom: 16,
    },

    /* GRID LAYOUT */
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    gridItem: {
        width: '45%',
        marginBottom: 16,
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    itemLabel: {
        fontSize: 12,
        fontWeight: '600',
    },
    unitText: {
        fontSize: 10,
        color: '#94A3B8',
    },
    pillRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    pill: {
        flex: 1,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 10,
    },
    pillInput: {
        fontSize: 13,
        fontWeight: '700',
        textAlign: 'center',
        width: '100%',
        padding: 0,
    },
    pillDash: {
        width: 6,
        height: 2,
        backgroundColor: '#94A3B8',
        borderRadius: 1,
    },

    /* SAVE ACTION */
    saveActionBtn: {
        backgroundColor: PRIMARY,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        marginTop: 10,
        marginBottom: 40,
        gap: 10,
    },
    saveActionText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },

    /* EXERCISES VIEW */
    exerciseHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: 16,
        marginBottom: 20,
    },
    headerMain: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    headerSub: {
        fontSize: 13,
        marginTop: 2,
    },
    addBtn: {
        backgroundColor: PRIMARY,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 20,
        gap: 6,
    },
    addBtnText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },

    /* TABLE STYLES */
    table: {
        marginHorizontal: 16,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
    },
    tableHead: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 10,
    },
    headText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B',
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 14,
        paddingHorizontal: 10,
        borderTopWidth: 1,
        alignItems: 'center',
    },
    cellName: {
        fontSize: 14,
        fontWeight: '600',
    },
    cellSub: {
        fontSize: 10,
        marginTop: 2,
    },
    cellIconRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    cellIconText: {
        fontSize: 12,
        fontWeight: '600',
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    actionRow: {
        flexDirection: 'row',
        gap: 8,
    },
    circBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(220, 38, 38, 0.1)',
    },

    /* MODAL */
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '90%',
        maxWidth: 400,
        borderRadius: 16,
        padding: 24,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 20,
        textAlign: 'center',
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 6,
        marginTop: 10,
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        fontSize: 14,
    },
    typeRow: {
        flexDirection: 'row',
        gap: 12,
    },
    typeOption: {
        flex: 1,
        padding: 12,
        borderWidth: 1,
        borderRadius: 8,
        alignItems: 'center',
    },
    typeOptionActive: {
        borderColor: PRIMARY,
        backgroundColor: 'rgba(220, 38, 38, 0.05)',
    },
    typeText: {
        fontWeight: '600',
        color: '#64748B',
    },
    typeTextActive: {
        color: PRIMARY,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 24,
    },
    cancelBtn: {
        flex: 1,
        padding: 14,
        borderRadius: 10,
        alignItems: 'center',
    },
    cancelText: {
        fontWeight: '700',
    },
    modalSaveBtn: {
        flex: 1,
        padding: 14,
        borderRadius: 10,
        backgroundColor: PRIMARY,
        alignItems: 'center',
    },
    saveText: {
        color: '#fff',
        fontWeight: '700',
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 30,
        fontSize: 14,
    },
});
