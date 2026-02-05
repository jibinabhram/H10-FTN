
import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Alert,
    Switch,
    FlatList,
    Modal,
    ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../../db/sqlite';
import { useTheme } from '../../components/context/ThemeContext';
import api from '../../api/axios';
import NetInfo from '@react-native-community/netinfo';

const PRIMARY = '#16a34a';

/* ================= TYPES ================= */

type Tab = 'Exercises' | 'HR Zones' | 'Speed Thresholds';

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
    id: number;
    name: string;
    event_type: 'match' | 'training';
    is_system: number;
}

/* ================= MAIN SCREEN ================= */

export default function TeamSettingsScreen() {
    const { theme } = useTheme();
    const isDark = theme === "dark";

    const navigation = useNavigation();
    const [activeTab, setActiveTab] = useState<Tab>('Exercises');
    const [clubId, setClubId] = useState<string | null>(null);

    // Load Club ID from cached profile
    useEffect(() => {
        const fetchClubId = async () => {
            try {
                const profileCache = await AsyncStorage.getItem('CACHED_PROFILE');
                if (profileCache) {
                    const profile = JSON.parse(profileCache);
                    if (profile?.club_id) {
                        setClubId(profile.club_id);
                        console.log('✅ TeamSettingsScreen: Club ID loaded:', profile.club_id);
                    } else {
                        console.warn('⚠️ No club_id in profile cache');
                    }
                } else {
                    console.warn('⚠️ No cached profile found');
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
            // Fallback if no history
            navigation.navigate('ClubAdminProfile' as never);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: isDark ? "#020617" : "#FFFFFF" }]}>
            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={24} color={isDark ? "#fff" : "#0f172a"} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: isDark ? "#fff" : "#0f172a" }]}>Team Settings</Text>
            </View>

            {/* TABS */}
            <View style={[styles.tabContainer, { borderColor: isDark ? "#334155" : "#e2e8f0" }]}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'Exercises' && styles.tabActive, { flex: 1, alignItems: 'center' }]}
                    onPress={() => setActiveTab('Exercises')}
                >
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === 'Exercises' && styles.tabTextActive,
                            activeTab !== 'Exercises' && { color: isDark ? "#94A3B8" : "#64748b" }
                        ]}
                    >
                        Exercises
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tab, activeTab === 'HR Zones' && styles.tabActive, { flex: 1, alignItems: 'center' }]}
                    onPress={() => setActiveTab('HR Zones')}
                >
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === 'HR Zones' && styles.tabTextActive,
                            activeTab !== 'HR Zones' && { color: isDark ? "#94A3B8" : "#64748b" }
                        ]}
                    >
                        HR Zones
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tab, activeTab === 'Speed Thresholds' && styles.tabActive, { flex: 1, alignItems: 'center' }]}
                    onPress={() => setActiveTab('Speed Thresholds')}
                >
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === 'Speed Thresholds' && styles.tabTextActive,
                            activeTab !== 'Speed Thresholds' && { color: isDark ? "#94A3B8" : "#64748b" }
                        ]}
                    >
                        Speed Thresholds
                    </Text>
                </TouchableOpacity>
            </View>

            {/* CONTENT */}
            <View style={styles.content}>
                {activeTab === 'Exercises' && <ExercisesView isDark={isDark} clubId={clubId} />}
                {activeTab === 'HR Zones' && <ThresholdsView isDark={isDark} clubId={clubId} type="hr" />}
                {activeTab === 'Speed Thresholds' && <ThresholdsView isDark={isDark} clubId={clubId} type="speed" />}
            </View>
        </View>
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

const ThresholdsView = ({ isDark, clubId, type }: { isDark: boolean; clubId: string | null; type: 'speed' | 'hr' }) => {
    const [absThresholds, setAbsThresholds] = useState<Threshold[]>([]);
    const [relThresholds, setRelThresholds] = useState<Threshold[]>([]);
    const [useDefaultAbs, setUseDefaultAbs] = useState(true);
    const [useDefaultRel, setUseDefaultRel] = useState(true);

    const [hrThresholds, setHrThresholds] = useState<any[]>([]);
    const [useDefaultHr, setUseDefaultHr] = useState(true);
    const [editValues, setEditValues] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const DEFAULT_HR = [
        { zone_number: 1, min_hr: 101, max_hr: 120 },
        { zone_number: 2, min_hr: 120, max_hr: 140 },
        { zone_number: 3, min_hr: 140, max_hr: 160 },
        { zone_number: 4, min_hr: 160, max_hr: 180 },
        { zone_number: 5, min_hr: 180, max_hr: 200 },
    ];

    const loadData = useCallback(async (localOnly = false) => {
        if (!clubId) return;
        try {
            // 1. Initial Load from local SQLite (for immediate speed)
            const res = db.execute(`SELECT * FROM team_thresholds WHERE club_id = ? ORDER BY id`, [clubId]);
            let allLocal: Threshold[] = res.rows?._array || [];
            if (allLocal.length > 0) {
                const abs = allLocal.filter(t => t.type === 'absolute');
                const rel = allLocal.filter(t => t.type === 'relative');
                setAbsThresholds(abs);
                setRelThresholds(rel);
                setUseDefaultAbs(abs.every(t => t.is_default === 1));
                setUseDefaultRel(rel.every(t => t.is_default === 1));
            }
            const hrLocal = db.execute(`SELECT * FROM hr_zones ORDER BY zone_number`);
            if (hrLocal.rows?._array?.length > 0) {
                setHrThresholds(hrLocal.rows._array);
            }

            // 2. Direct Background Sync from Backend
            if (!localOnly) {
                const net = await NetInfo.fetch();
                if (net.isConnected) {
                    try {
                        const [thresholdsRes, hrRes] = await Promise.all([
                            api.get(`/team-thresholds?club_id=${clubId}`),
                            api.get('/club-zones/defaults')
                        ]);

                        if (Array.isArray(thresholdsRes.data)) {
                            for (const bt of thresholdsRes.data) {
                                db.execute(
                                    `INSERT INTO team_thresholds (club_id, type, zone_name, min_val, max_val, is_default) 
                                     VALUES (?, ?, ?, ?, ?, ?) 
                                     ON CONFLICT(club_id, type, zone_name) DO UPDATE SET 
                                     min_val=excluded.min_val, max_val=excluded.max_val, is_default=excluded.is_default`,
                                    [clubId, bt.type, bt.zone_name, bt.min_val, bt.max_val, bt.is_default ? 1 : 0]
                                );
                            }
                            // Re-filter and update state
                            const abs = thresholdsRes.data.filter((t: any) => t.type === 'absolute');
                            const rel = thresholdsRes.data.filter((t: any) => t.type === 'relative');
                            setAbsThresholds(abs);
                            setRelThresholds(rel);
                        }

                        if (Array.isArray(hrRes.data)) {
                            for (const z of hrRes.data) {
                                db.execute(
                                    `INSERT INTO hr_zones (zone_number, min_hr, max_hr) VALUES (?, ?, ?)
                                     ON CONFLICT(zone_number) DO UPDATE SET min_hr=excluded.min_hr, max_hr=excluded.max_hr`,
                                    [z.zone_number, z.min_hr, z.max_hr]
                                );
                            }
                            setHrThresholds(hrRes.data);
                        }
                    } catch (apiErr) { console.warn("Sync error:", apiErr); }
                }
            }

            // Fallback Seed if still empty
            if (absThresholds.length === 0 && !localOnly) {
                // ... same seeding logic if needed ...
            }

        } catch (e) {
            console.error('❌ loadData error:', e);
        }
    }, [clubId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSave = async () => {
        if (!clubId) return;

        // Offline check REMOVED to allow local save
        // const net = await NetInfo.fetch();
        // if (!net.isConnected) { ... }

        Alert.alert(
            'Confirm Save',
            'Are you sure you want to save these threshold changes for the entire team?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    onPress: async () => {
                        setSaving(true);
                        try {
                            // 1. Save locally with a more robust query (by club_id, type, zone_name)
                            // This part is very fast as it's local DB.
                            for (const t of absThresholds) {
                                db.execute(
                                    `UPDATE team_thresholds SET min_val=?, max_val=?, is_default=? 
                                     WHERE club_id=? AND type='absolute' AND zone_name=?`,
                                    [t.min_val, t.max_val, useDefaultAbs ? 1 : 0, clubId, t.zone_name]
                                );
                            }
                            for (const t of relThresholds) {
                                db.execute(
                                    `UPDATE team_thresholds SET min_val=?, max_val=?, is_default=? 
                                     WHERE club_id=? AND type='relative' AND zone_name=?`,
                                    [t.min_val, t.max_val, useDefaultRel ? 1 : 0, clubId, t.zone_name]
                                );
                            }
                            for (const h of hrThresholds) {
                                db.execute(`UPDATE hr_zones SET min_hr=?, max_hr=? WHERE zone_number=?`, [h.min_hr, h.max_hr, h.zone_number]);
                            }

                            // 2. QUICK UI REFRESH: Reload from local SQLite only (very quicly comed custom values)
                            await loadData(true);
                            setEditValues({});
                            setSaving(false);
                            Alert.alert('Success', 'Team thresholds updated successfully');

                            // 3. BACKGROUND SYNC: Send to cloud in parallel
                            const net = await NetInfo.fetch();
                            if (net.isConnected) {
                                const allT = [...absThresholds, ...relThresholds];
                                const syncPromises = allT.map(t =>
                                    api.post('/team-thresholds', {
                                        club_id: clubId,
                                        type: t.type,
                                        zone_name: t.zone_name,
                                        min_val: t.min_val,
                                        max_val: t.max_val,
                                        is_default: t.type === 'absolute' ? useDefaultAbs : useDefaultRel
                                    }).catch(e => console.warn(`Sync fail for ${t.zone_name}:`, e))
                                );

                                syncPromises.push(
                                    api.post('/club-zones/defaults', { zones: hrThresholds })
                                        .catch(e => console.warn("HR sync fail:", e))
                                );

                                Promise.allSettled(syncPromises).then(() => {
                                    console.log("✅ Team thresholds cloud sync completed");
                                });
                            } else {
                                console.log("⚠️ Offline: Saved locally only. Will sync on next online load.");
                            }

                        } catch (e) {
                            console.error('Save error:', e);
                            setSaving(false);
                            Alert.alert('Error', 'Failed to save thresholds locally');
                        }
                    }
                }
            ]
        );
    };

    const updateVal = (
        type: 'absolute' | 'relative' | 'hr',
        id: number,
        field: 'min_val' | 'max_val' | 'min_hr' | 'max_hr',
        text: string
    ) => {
        // Store the string version for the UI input
        setEditValues(prev => ({ ...prev, [`${id}_${field}`]: text }));

        // If empty, we can treat it as 0 for the numeric state, but keep the string as empty for typing
        const val = text === '' ? 0 : parseFloat(text);
        if (isNaN(val) && text !== '') return;

        if (type === 'absolute') {
            setAbsThresholds((prev) =>
                prev.map((t) => (t.id === id ? { ...t, [field]: val } : t))
            );
        } else if (type === 'relative') {
            setRelThresholds((prev) =>
                prev.map((t) => (t.id === id ? { ...t, [field]: val } : t))
            );
        } else {
            // HR Update - use the exact field passed (min_hr or max_hr)
            setHrThresholds((prev) =>
                prev.map((t) => (t.zone_number === id ? { ...t, [field]: val } : t))
            );
        }
    };

    const toggleDefault = (tType: 'absolute' | 'relative' | 'hr', value: boolean) => {
        // Offline check removed to allow local toggling
        if (tType === 'absolute') {
            setUseDefaultAbs(value);
            if (value) {
                // Reset to system defaults
                setAbsThresholds(prev => prev.map(t => {
                    const def = DEFAULT_ABS.find(d => d.zone_name === t.zone_name);
                    return def ? { ...t, min_val: def.min_val, max_val: def.max_val } : t;
                }));
                setEditValues({});
            }
        } else if (tType === 'relative') {
            setUseDefaultRel(value);
            if (value) {
                setRelThresholds(prev => prev.map(t => {
                    const def = DEFAULT_REL.find(d => d.zone_name === t.zone_name);
                    return def ? { ...t, min_val: def.min_val, max_val: def.max_val } : t;
                }));
                setEditValues({});
            }
        } else {
            // HR Defaults reset
            setUseDefaultHr(value);
            if (value) {
                setHrThresholds(DEFAULT_HR);
                setEditValues({});
            }
        }
    };

    const renderSection = (title: string, tType: 'absolute' | 'relative' | 'hr', data: any[], isDefault: boolean) => (
        <View style={[styles.card, { backgroundColor: isDark ? "#1E293B" : "#fff", borderColor: isDark ? "#334155" : "#e2e8f0" }]}>
            <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: isDark ? "#fff" : "#0f172a" }]}>{title}</Text>
                {/* Mode description */}
                <Text style={[styles.cardDesc, { color: isDark ? "#94A3B8" : "#64748b" }]}>
                    {isDefault ? `Using system default ${title.toLowerCase()}` : `Using custom ${title.toLowerCase()}`}
                </Text>
            </View>

            <View style={styles.radioRow}>
                <TouchableOpacity
                    style={styles.radioBtn}
                    onPress={() => toggleDefault(tType, true)}
                >
                    <View
                        style={[styles.radioOuter, { borderColor: isDark ? "#94A3B8" : "#cbd5e1" }, isDefault && styles.radioOuterSelected]}
                    >
                        {isDefault && <View style={styles.radioInner} />}
                    </View>
                    <Text style={[styles.radioLabel, { color: isDark ? "#E2E8F0" : "#334155" }]}>Use system defaults</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.radioBtn}
                    onPress={() => toggleDefault(tType, false)}
                >
                    <View
                        style={[styles.radioOuter, { borderColor: isDark ? "#94A3B8" : "#cbd5e1" }, !isDefault && styles.radioOuterSelected]}
                    >
                        {!isDefault && <View style={styles.radioInner} />}
                    </View>
                    <Text style={[styles.radioLabel, { color: isDark ? "#E2E8F0" : "#334155" }]}>Use custom thresholds</Text>
                </TouchableOpacity>
            </View>

            {data.map((item) => {
                const itemId = tType === 'hr' ? item.zone_number : item.id;
                const zoneName = tType === 'hr' ? `Zone ${item.zone_number}` : item.zone_name;
                const minVal = tType === 'hr' ? item.min_hr : item.min_val;
                const maxVal = tType === 'hr' ? item.max_hr : item.max_val;
                const unit = tType === 'absolute' ? 'km/h' : (tType === 'relative' ? '%' : 'bpm');

                return (
                    <View key={`${tType}_${itemId}`} style={[styles.inputRow, { borderBottomColor: isDark ? "#334155" : "#f1f5f9" }]}>
                        <View style={styles.zoneHeader}>
                            <Text style={[styles.zoneLabel, { color: isDark ? "#E2E8F0" : "#0f172a" }]}>{zoneName}</Text>
                            <Text style={[styles.zoneValue, { color: isDark ? "#94A3B8" : "#64748b" }]}>
                                {editValues[`${itemId}_${tType === 'hr' ? 'min_hr' : 'min_val'}`] ?? minVal} - {editValues[`${itemId}_${tType === 'hr' ? 'max_hr' : 'max_val'}`] ?? maxVal} {unit}
                            </Text>
                        </View>
                        <View style={styles.inputs}>
                            <View style={styles.inputGroup}>
                                <TextInput
                                    style={[
                                        styles.input,
                                        { color: isDark ? "#fff" : "#000", backgroundColor: isDark ? "#0F172A" : "#fff", borderColor: isDark ? "#334155" : "#cbd5e1" },
                                        isDefault ? { opacity: 0.5, backgroundColor: isDark ? "#334155" : "#f1f5f9" } : {}
                                    ]}
                                    editable={!isDefault}
                                    keyboardType="numeric"
                                    placeholder="Min"
                                    placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                                    value={editValues[`${itemId}_${tType === 'hr' ? 'min_hr' : 'min_val'}`] ?? String(minVal)}
                                    onChangeText={(t) => updateVal(tType, itemId, tType === 'hr' ? 'min_hr' : 'min_val' as any, t)}
                                />
                            </View>
                            <View style={styles.inputGroup}>
                                <TextInput
                                    style={[
                                        styles.input,
                                        { color: isDark ? "#fff" : "#000", backgroundColor: isDark ? "#0F172A" : "#fff", borderColor: isDark ? "#334155" : "#cbd5e1" },
                                        isDefault ? { opacity: 0.5, backgroundColor: isDark ? "#334155" : "#f1f5f9" } : {}
                                    ]}
                                    editable={!isDefault}
                                    keyboardType="numeric"
                                    placeholder="Max"
                                    placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                                    value={editValues[`${itemId}_${tType === 'hr' ? 'max_hr' : 'max_val'}`] ?? String(maxVal)}
                                    onChangeText={(t) => updateVal(tType, itemId, tType === 'hr' ? 'max_hr' : 'max_val' as any, t)}
                                />
                            </View>
                        </View>
                    </View>
                );
            })}
        </View>
    );

    return (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {type === 'speed' ? (
                <>
                    <View style={[styles.sectionMainHeader, { backgroundColor: isDark ? "#1e293b" : "#f1f5f9", borderColor: isDark ? "#334155" : "#e2e8f0", paddingBottom: 16 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                            <Ionicons name="speedometer-outline" size={20} color={PRIMARY} />
                            <Text style={[styles.sectionMainHeaderText, { color: isDark ? "#fff" : "#0f172a" }]}>
                                Speed Thresholds & HR Defaults
                            </Text>
                        </View>

                        {/* HR COMPACT TABLE IN HEADER */}
                        <View style={[styles.hrCompactTable, { backgroundColor: isDark ? "#0f172a" : "#fff", borderColor: isDark ? "#334155" : "#cbd5e1" }]}>
                            <View style={styles.hrCompactHeader}>
                                <Text style={styles.hrCompactHeaderText}>Heart Rate Zone Defaults (BPM)</Text>
                            </View>
                            <View style={styles.hrCompactRow}>
                                {hrThresholds.map((z, idx) => (
                                    <View key={`hr_summary_${z.zone_number}`} style={[styles.hrCompactCell, idx === hrThresholds.length - 1 && { borderRightWidth: 0 }]}>
                                        <Text style={[styles.hrCompactCellTitle, { color: isDark ? PRIMARY : PRIMARY }]}>Zone {z.zone_number}</Text>
                                        <Text style={[styles.hrCompactCellValue, { color: isDark ? "#fff" : "#0f172a" }]}>{z.min_hr}-{z.max_hr}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    </View>

                    {renderSection('Absolute Speed Thresholds (km/h)', 'absolute', absThresholds, useDefaultAbs)}
                    <View style={{ height: 16 }} />
                    {renderSection('Relative Speed Thresholds (%)', 'relative', relThresholds, useDefaultRel)}
                </>
            ) : (
                <>
                    <View style={[styles.sectionMainHeader, { backgroundColor: isDark ? "#1e293b" : "#f1f5f9", borderColor: isDark ? "#334155" : "#e2e8f0" }]}>
                        <Ionicons name="heart-outline" size={20} color={PRIMARY} />
                        <Text style={[styles.sectionMainHeaderText, { color: isDark ? "#fff" : "#0f172a" }]}>
                            Heart Rate Zone Defaults
                        </Text>
                    </View>
                    {renderSection('Heart Rate Zone Defaults', 'hr', hrThresholds, useDefaultHr)}
                </>
            )}

            <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.7 }, { marginTop: 32 }]}
                onPress={handleSave}
                disabled={saving}
            >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save Changes</Text>}
            </TouchableOpacity>
        </ScrollView>
    );
};

const ExercisesView = ({ isDark, clubId }: { isDark: boolean; clubId: string | null }) => {
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [type, setType] = useState<'match' | 'training'>('training');

    // List of system names that cannot be deleted or whose cloud association might be special
    const SYSTEM_EXERCISES = ['Warm Up', 'Drill', 'Small Sided Game', 'Match Play'];

    const loadExercises = useCallback(async () => {
        if (!clubId) return;
        try {
            // 1. Immediate load from local SQLite
            const localRes = db.execute(`SELECT * FROM exercise_types WHERE club_id = ? ORDER BY created_at DESC, id DESC`, [clubId]);
            if (localRes.rows?._array?.length > 0) {
                setExercises(localRes.rows._array);
            }

            // 2. Direct Background Sync from Backend
            const net = await NetInfo.fetch();
            if (net.isConnected) {
                // A. PUSH: Sync local items missing backend_id
                try {
                    const unsynced = db.execute(`SELECT * FROM exercise_types WHERE club_id = ? AND backend_id IS NULL AND is_system = 0`, [clubId]);
                    if (unsynced.rows?._array) {
                        for (const u of unsynced.rows._array) {
                            try {
                                console.log(`📤 Pushing unsynced exercise: ${u.name}`);
                                const res = await api.post('/exercise-types', {
                                    name: u.name, event_type: u.event_type || 'training', club_id: clubId
                                });
                                console.log("📥 Push response data:", JSON.stringify(res.data));

                                // FIX: Backend returns { status: true, data: { exercise_type_id: ... } }
                                const backendData = res.data?.data || res.data;

                                if (backendData?.exercise_type_id) {
                                    const updateRes = db.execute(`UPDATE exercise_types SET backend_id = ? WHERE id = ?`, [backendData.exercise_type_id, u.id]);
                                    console.log(`✅ Linked local '${u.name}' to backend_id: ${backendData.exercise_type_id}. Rows affected: ${JSON.stringify(updateRes)}`);
                                } else {
                                    console.warn(`⚠️ Push succeeded but no exercise_type_id returned for ${u.name}`);
                                }
                            } catch (puErr) { console.warn("Push sync failed for " + u.name, puErr); }
                        }
                    }
                } catch (err) { console.warn("Push sync error:", err); }

                // B. PULL: Fetch latest from backend
                try {
                    const response = await api.get(`/exercise-types?club_id=${clubId}`);
                    if (Array.isArray(response.data)) {
                        // --- AUTO-DEDUPLICATION START ---
                        const groups: { [key: string]: any[] } = {};
                        response.data.forEach((e: any) => {
                            if (!groups[e.name]) groups[e.name] = [];
                            groups[e.name].push(e);
                        });

                        for (const name in groups) {
                            if (groups[name].length > 1) {
                                // Sort by created_at desc, keep index 0
                                groups[name].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                                const [keep, ...remove] = groups[name];
                                console.log(`🧹 Auto-cleaning ${remove.length} duplicates for '${name}'`);

                                await Promise.all(remove.map((r) =>
                                    api.delete(`/exercise-types/${r.exercise_type_id}`).catch(e => console.warn("Cleanup fail", e))
                                ));
                            }
                        }
                        // Refresh list after cleanup? No, strictly speaking we can just process the "keep" ones, 
                        // but re-fetching ensures we have the final clean state. 
                        // For efficiency, we will just filter the response.data to only include "kept" ones? 
                        // Actually, easiest is to just proceed. The Deleted ones will just be updated locally 
                        // and then disappear on next full load, or we can just let them be. 
                        // Better: allow the loop below to update them (harmless) and next load they are gone.
                        // --- AUTO-DEDUPLICATION END ---

                        for (const ex of response.data) {
                            // 1. Check if we have this backend_id locally
                            const matchId = db.execute(`SELECT id FROM exercise_types WHERE backend_id = ?`, [ex.exercise_type_id]);
                            if (matchId.rows?._array?.length > 0) {
                                // Update existing by ID
                                db.execute(
                                    `UPDATE exercise_types SET name = ?, event_type = ? WHERE backend_id = ?`,
                                    [ex.name, ex.event_type || 'training', ex.exercise_type_id]
                                );
                            } else {
                                // 2. If not, try safe insert (handles name conflict)
                                db.execute(
                                    `INSERT INTO exercise_types (club_id, name, event_type, is_system, backend_id, created_at) 
                                    VALUES (?, ?, ?, ?, ?, ?)
                                    ON CONFLICT(club_id, name) DO UPDATE SET 
                                    backend_id = excluded.backend_id,
                                    event_type = excluded.event_type`,
                                    [clubId, ex.name, ex.event_type || 'training', ex.is_system ? 1 : 0, ex.exercise_type_id, Date.now()]
                                );
                            }
                        }
                    }
                } catch (err) { console.warn("Exercise sync skip:", err); }
            }

            // Seed defaults logic REMOVED. 
            // We now rely solely on what comes from Backend or User creation.

            // 3. ENFORCE LOCAL ID: Always fetch from local DB to ensure Edit/Delete have primary keys
            const finalRes = db.execute(`SELECT * FROM exercise_types WHERE club_id = ? ORDER BY created_at DESC, id DESC`, [clubId]);
            setExercises(finalRes.rows?._array || []);

        } catch (e) {
            console.error("❌ loadExercises error:", e);
        }
    }, [clubId]);

    useEffect(() => {
        loadExercises();
    }, [loadExercises]);

    const handleSave = async () => {
        console.log("🛠️ [ExercisesView] handleSave. editingId:", editingId, "name:", name);

        const net = await NetInfo.fetch();
        if (!net.isConnected) {
            Alert.alert('Offline', 'Internet connection required to create or edit exercises.');
            return;
        }

        const cleanedName = name.trim();
        if (!cleanedName) {
            Alert.alert('Validation Error', 'Exercise name is required');
            return;
        }

        try {
            if (editingId !== null) {
                // UPDATE LOGIC
                console.log("📝 DB UPDATE for ID:", editingId);
                const localRes = db.execute(
                    `UPDATE exercise_types SET name=?, event_type=? WHERE id=? AND club_id=?`,
                    [cleanedName, type, editingId, clubId]
                );
                console.log("✅ Local update status:", JSON.stringify(localRes));

                if (clubId) {
                    let bId = null;
                    const row = db.execute(`SELECT backend_id FROM exercise_types WHERE id=?`, [editingId]);
                    bId = row.rows?._array?.[0]?.backend_id;

                    // If no backend_id, try to find one by name on the server to 'heal' the link
                    if (!bId) {
                        try {
                            console.log("⚠️ Missing backend_id, searching server for match...");
                            const check = await api.get(`/exercise-types?club_id=${clubId}`);
                            const data = Array.isArray(check.data) ? check.data : [];
                            const match = data.find((e: any) => e.name === cleanedName && e.exercise_type_id);
                            if (match) {
                                bId = match.exercise_type_id;
                                // Save this link locally
                                db.execute(`UPDATE exercise_types SET backend_id=? WHERE id=?`, [bId, editingId]);
                                console.log("🔗 Healed link found:", bId);
                            }
                        } catch (err) { console.log("Heal check failed", err); }
                    }

                    if (bId) {
                        console.log("📤 Syncing update to cloud. backend_id:", bId);
                        try {
                            await api.patch(`/exercise-types/${bId}`, {
                                name: cleanedName,
                                event_type: type,
                                club_id: clubId
                            });
                        } catch (apiErr: any) {
                            console.warn("❌ Cloud update failed:", apiErr?.response?.data || apiErr.message);
                        }
                    } else {
                        console.warn("⚠️ No backend_id found despite check. Will push as new on next sync.");
                    }
                }
            } else {
                // CREATE LOGIC
                console.log("➕ DB INSERT for club:", clubId);

                // check duplicate name locally first
                const exists = db.execute(`SELECT id FROM exercise_types WHERE club_id=? AND name=?`, [clubId, cleanedName]);
                if (exists.rows?._array?.length > 0) {
                    Alert.alert('Error', 'Exercise with this name already exists.');
                    return;
                }

                db.execute(
                    `INSERT INTO exercise_types (club_id, name, event_type, is_system, created_at) VALUES (?, ?, ?, 0, ?)`,
                    [clubId, cleanedName, type, Date.now()]
                );

                // We do NOT wait for API here. loadExercises() will pick it up.
            }

            loadExercises();
            setModalVisible(false);
            setEditingId(null);
            setName('');
            setType('training');
        } catch (err) {
            console.error('❌ Exercise save failed:', err);
            Alert.alert('Error', 'Failed to save changes');
        }
    };

    const handleDelete = async (id: number, isSystem: number) => {
        // ALLOW DELETE OF ALL: We removed the system check protection here.

        const net = await NetInfo.fetch();
        if (!net.isConnected) {
            Alert.alert('Offline', 'Internet connection required to delete exercises.');
            return;
        }

        Alert.alert(
            'Delete Exercise',
            'Are you sure you want to delete this exercise?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // 1. Fetch details to clean up ALL duplicates on backend
                            const row = db.execute('SELECT name, club_id FROM exercise_types WHERE id=?', [id]);
                            const exName = row.rows?._array?.[0]?.name;
                            const exClubId = row.rows?._array?.[0]?.club_id;

                            // 2. Delete from local DB immediately
                            await db.execute(`DELETE FROM exercise_types WHERE id=?`, [id]);

                            // 3. Nuclear Backend Cleanup: Find and Delete ALL valid duplicates
                            if (exName && exClubId) {
                                try {
                                    const res = await api.get(`/exercise-types?club_id=${exClubId}`);
                                    const backendData = res.data?.data || res.data; // Handle { data: [...] } structure
                                    const allBackend = Array.isArray(backendData) ? backendData : [];
                                    // Match by trimmed name to catch "Running " vs "Running" issues
                                    const toDelete = allBackend.filter((e: any) => e.name.trim() === exName.trim());

                                    if (toDelete.length > 0) {
                                        console.log(`🗑️ Deleting ${toDelete.length} instance(s) of '${exName}' from backend...`);
                                        await Promise.all(toDelete.map((d: any) => api.delete(`/exercise-types/${d.exercise_type_id}`)));
                                        console.log("✅ Backend cleanup complete.");
                                    }
                                } catch (bkErr) {
                                    console.warn("⚠️ Backend cleanup partial failure:", bkErr);
                                    Alert.alert("Notice", "Deleted locally. Sync pending for server side.");
                                }
                            }

                            loadExercises();
                        } catch (e) {
                            console.error("Failed to delete exercise:", e);
                            Alert.alert('Error', 'Failed to delete exercise');
                        }
                    },
                },
            ]
        );
    };

    const openEdit = (ex: Exercise) => {
        setName(ex.name);
        setType(ex.event_type);
        setEditingId(ex.id);
        setModalVisible(true);
    };

    const resetForm = () => {
        setName('');
        setType('training');
        setEditingId(null);
    };

    return (
        <View style={{ flex: 1 }}>
            <View style={styles.topActions}>
                <Text style={[styles.sectionHeader, { color: isDark ? "#fff" : "#334155" }]}>Manage Exercise Types</Text>
                <TouchableOpacity
                    style={styles.createBtn}
                    onPress={() => {
                        resetForm();
                        setModalVisible(true);
                    }}
                >
                    <Ionicons name="add" size={18} color="#fff" />
                    <Text style={styles.createBtnText}>CREATE</Text>
                </TouchableOpacity>
            </View>

            <View style={[styles.tableHeader, { backgroundColor: isDark ? "#1E293B" : "#e2e8f0", borderColor: isDark ? "#334155" : "#cbd5e1" }]}>
                <Text style={[styles.headerText, { flex: 2, color: isDark ? "#94A3B8" : "#475569" }]}>EXERCISE NAME</Text>
                <Text style={[styles.headerText, { flex: 1, color: isDark ? "#94A3B8" : "#475569" }]}>EVENT TYPE</Text>
                <Text style={[styles.headerText, { width: 80, textAlign: 'right', color: isDark ? "#94A3B8" : "#475569" }]}>ACTIONS</Text>
            </View>

            <FlatList
                data={exercises}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={{ paddingBottom: 60 }}
                renderItem={({ item }) => (
                    <View style={[styles.row, { backgroundColor: isDark ? "#334155" : "#fff", borderColor: isDark ? "#475569" : "#f1f5f9" }]}>
                        <View style={{ flex: 2 }}>
                            <Text style={[styles.rowTitle, { color: isDark ? "#fff" : "#0f172a" }]}>{item.name}</Text>
                            {item.is_system === 1 && <Text style={[styles.rowSystemTag, { color: isDark ? "#94A3B8" : "#64748b" }]}>(Default)</Text>}
                        </View>

                        <View style={{ flex: 1 }}>
                            <View style={[styles.typeBadge, item.event_type === 'match' ? styles.badgeMatch : styles.badgeTraining]}>
                                <Text style={[styles.typeBadgeText, item.event_type === 'match' ? styles.badgeTextMatch : styles.badgeTextTraining]}>
                                    {item.event_type === 'match' ? 'Match' : 'Training'}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.actions}>
                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: '#22c55e' }]}
                                onPress={() => openEdit(item)}
                            >
                                <Ionicons name="pencil" size={14} color="#fff" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.actionBtn,
                                    { backgroundColor: '#ef4444' }, // Always red
                                ]}
                                onPress={() => handleDelete(item.id, item.is_system)}
                            // Enabled for all
                            >
                                <Ionicons name="trash" size={14} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
                ListEmptyComponent={
                    <Text style={styles.emptyText}>No exercises found.</Text>
                }
            />

            {/* MODAL */}
            <Modal visible={modalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: isDark ? "#1E293B" : "#fff" }]}>
                        <Text style={[styles.modalTitle, { color: isDark ? "#fff" : "#000" }]}>
                            {editingId ? 'Edit Exercise' : 'Create Exercise'}
                        </Text>

                        <Text style={[styles.fieldLabel, { color: isDark ? "#E2E8F0" : "#334155" }]}>Name</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: isDark ? "#0F172A" : "#fff", borderColor: isDark ? "#334155" : "#cbd5e1", color: isDark ? "#fff" : "#000" }]}
                            value={name}
                            onChangeText={setName}
                            placeholder="Ex: Warm Up"
                            placeholderTextColor={isDark ? "#94A3B8" : "#9ca3af"}
                        />

                        <Text style={[styles.fieldLabel, { color: isDark ? "#E2E8F0" : "#334155" }]}>Type</Text>
                        <View style={styles.typeRow}>
                            {['training', 'match'].map((t) => (
                                <TouchableOpacity
                                    key={t}
                                    style={[
                                        styles.typeOption,
                                        { borderColor: isDark ? "#334155" : "#cbd5e1" },
                                        type === t && styles.typeOptionActive,
                                    ]}
                                    onPress={() => setType(t as any)}
                                >
                                    <Text
                                        style={[
                                            styles.typeText,
                                            { color: isDark ? "#94A3B8" : "#64748b" },
                                            type === t && styles.typeTextActive,
                                        ]}
                                    >
                                        {t === 'training' ? 'Training' : 'Match'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.cancelBtn, { backgroundColor: isDark ? "#334155" : "#f1f5f9" }]}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={[styles.cancelText, { color: isDark ? "#94A3B8" : "#64748b" }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSave}>
                                <Text style={styles.saveText}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

/* ================= STYLES ================= */

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        gap: 12,
    },
    backButton: {
        padding: 8,
        marginRight: 8,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#0f172a',
    },
    tabContainer: {
        flexDirection: 'row',
        marginBottom: 16,
        borderBottomWidth: 1,
        borderColor: '#e2e8f0',
    },
    tab: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabActive: {
        borderBottomColor: PRIMARY,
    },
    tabText: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '600',
    },
    tabTextActive: {
        color: PRIMARY,
    },
    sectionMainHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 10,
        marginBottom: 20,
        borderWidth: 1,
        gap: 10,
    },
    sectionMainHeaderText: {
        fontSize: 15,
        fontWeight: '700',
    },
    hrCompactTable: {
        width: '100%',
        borderWidth: 1,
        borderRadius: 8,
        overflow: 'hidden',
    },
    hrCompactHeader: {
        backgroundColor: PRIMARY,
        paddingVertical: 4,
        paddingHorizontal: 8,
        alignItems: 'center',
    },
    hrCompactHeaderText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '700',
    },
    hrCompactRow: {
        flexDirection: 'row',
        paddingVertical: 6,
    },
    hrCompactCell: {
        flex: 1,
        alignItems: 'center',
        borderRightWidth: 1,
        borderRightColor: '#e2e8f0',
    },
    hrCompactCellTitle: {
        fontSize: 9,
        fontWeight: '600',
    },
    hrCompactCellValue: {
        fontSize: 10,
        fontWeight: '700',
    },
    content: {
        flex: 1,
    },

    /* CARD STYLES */
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    pickerContainer: {
        height: 50,
        justifyContent: 'center',
    },
    cardHeader: {
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 8,
    },
    cardDesc: {
        fontSize: 13,
        color: '#64748b',
        marginBottom: 16,
        lineHeight: 20,
    },
    radioRow: {
        flexDirection: 'row',
        gap: 24,
        marginBottom: 24,
    },
    radioBtn: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    radioOuter: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#cbd5e1',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    radioOuterSelected: {
        borderColor: PRIMARY,
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: PRIMARY,
    },
    radioLabel: {
        fontSize: 14,
        color: '#334155',
    },

    /* INPUT ROWS */
    inputRow: {
        marginBottom: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
    },
    zoneHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    zoneLabel: {
        fontSize: 15,
        fontWeight: '700',
    },
    zoneValue: {
        fontSize: 13,
        fontWeight: '600',
    },
    inputs: {
        flexDirection: 'row',
        gap: 12,
    },
    inputGroup: {
        flex: 1,
    },
    inputLabel: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 4,
    },
    input: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        padding: 10,
        fontSize: 14,
        backgroundColor: '#fff',
    },
    inputDisabled: {
        backgroundColor: '#f1f5f9',
        color: '#94a3b8',
    },

    /* SAVE BTN */
    saveBtn: {
        backgroundColor: PRIMARY,
        padding: 16,
        borderRadius: 10,
        alignItems: 'center',
    },
    saveText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },

    /* EXERCISES */
    topActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionHeader: {
        fontSize: 16,
        fontWeight: '700',
        color: '#334155',
    },
    createBtn: {
        backgroundColor: PRIMARY,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 6,
    },
    createBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 12,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderColor: '#f1f5f9',
    },
    rowTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a',
    },
    rowSubtitle: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2,
        textTransform: 'capitalize',
    },
    actions: {
        flexDirection: 'row',
        gap: 10,
    },
    actionBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        textAlign: 'center',
        color: '#94a3b8',
        marginTop: 30,
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
        backgroundColor: '#fff',
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
        color: '#334155',
        marginBottom: 6,
        marginTop: 10,
    },
    typeRow: {
        flexDirection: 'row',
        gap: 12,
    },
    typeOption: {
        flex: 1,
        padding: 12,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        alignItems: 'center',
    },
    typeOptionActive: {
        borderColor: PRIMARY,
        backgroundColor: '#f0fdf4',
    },
    typeText: {
        fontWeight: '600',
        color: '#64748b',
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
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
    },
    cancelText: {
        color: '#64748b',
        fontWeight: '700',
    },
    modalSaveBtn: {
        flex: 1,
        padding: 14,
        borderRadius: 10,
        backgroundColor: PRIMARY,
        alignItems: 'center',
    },

    /* TABLE STYLES */
    tableHeader: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: '#e2e8f0',
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
        borderBottomWidth: 1,
        borderColor: '#cbd5e1',
    },
    headerText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748b',
        letterSpacing: 0.5,
    },
    rowSystemTag: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
        fontStyle: 'italic',
    },
    typeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    badgeTraining: {
        backgroundColor: '#dbeafe',
    },
    badgeMatch: {
        backgroundColor: '#fef3c7',
    },
    typeBadgeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    badgeTextTraining: {
        color: '#1e40af',
    },
    badgeTextMatch: {
        color: '#92400e',
    },
});
