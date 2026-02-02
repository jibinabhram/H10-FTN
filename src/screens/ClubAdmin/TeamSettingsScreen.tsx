
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
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { db } from '../../db/sqlite';
import { useTheme } from '../../components/context/ThemeContext';
import api from '../../api/axios';

const PRIMARY = '#16a34a';

/* ================= TYPES ================= */

type Tab = 'Thresholds' | 'Exercises';

interface Threshold {
    id: number;
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
    const [activeTab, setActiveTab] = useState<Tab>('Thresholds');

    return (
        <View style={styles.container}>
            {/* HEADER */}
            <View style={styles.header}>
                <Text style={styles.title}>Team Settings</Text>
            </View>

            {/* TABS */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'Thresholds' && styles.tabActive]}
                    onPress={() => setActiveTab('Thresholds')}
                >
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === 'Thresholds' && styles.tabTextActive,
                        ]}
                    >
                        Speed Thresholds
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tab, activeTab === 'Exercises' && styles.tabActive]}
                    onPress={() => setActiveTab('Exercises')}
                >
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === 'Exercises' && styles.tabTextActive,
                        ]}
                    >
                        Exercise Types
                    </Text>
                </TouchableOpacity>
            </View>

            {/* CONTENT */}
            <View style={styles.content}>
                {activeTab === 'Thresholds' ? <ThresholdsView /> : <ExercisesView />}
            </View>
        </View>
    );
}
/* ================= THRESHOLDS VIEW ================= */

const ThresholdsView = () => {
    const [absThresholds, setAbsThresholds] = useState<Threshold[]>([]);
    const [relThresholds, setRelThresholds] = useState<Threshold[]>([]);

    const [useDefaultAbs, setUseDefaultAbs] = useState(true);
    const [useDefaultRel, setUseDefaultRel] = useState(true);

    const loadData = useCallback(() => {
        try {
            const res = db.execute(`SELECT * FROM team_thresholds ORDER BY id`);
            const all: Threshold[] = res.rows?._array || [];

            const abs = all.filter((t) => t.type === 'absolute');
            const rel = all.filter((t) => t.type === 'relative');

            setAbsThresholds(abs);
            setRelThresholds(rel);

            setUseDefaultAbs(abs.every((t) => t.is_default === 1));
            setUseDefaultRel(rel.every((t) => t.is_default === 1));
        } catch (e) {
            console.error(e);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSave = async () => {
        try {
            for (const t of absThresholds) {
                await db.execute(
                    `UPDATE team_thresholds SET min_val=?, max_val=?, is_default=? WHERE id=?`,
                    [t.min_val, t.max_val, useDefaultAbs ? 1 : 0, t.id]
                );
            }
            for (const t of relThresholds) {
                await db.execute(
                    `UPDATE team_thresholds SET min_val=?, max_val=?, is_default=? WHERE id=?`,
                    [t.min_val, t.max_val, useDefaultRel ? 1 : 0, t.id]
                );
            }
            Alert.alert('Success', 'Thresholds saved successfully');
            loadData();
        } catch (e) {
            Alert.alert('Error', 'Failed to save thresholds');
        }
    };

    const updateVal = (
        type: 'absolute' | 'relative',
        id: number,
        field: 'min_val' | 'max_val',
        text: string
    ) => {
        const val = parseFloat(text);
        if (isNaN(val)) return;

        if (type === 'absolute') {
            setAbsThresholds((prev) =>
                prev.map((t) => (t.id === id ? { ...t, [field]: val } : t))
            );
        } else {
            setRelThresholds((prev) =>
                prev.map((t) => (t.id === id ? { ...t, [field]: val } : t))
            );
        }
    };

    const renderSection = (
        title: string,
        data: Threshold[],
        isDefault: boolean,
        setDefault: (v: boolean) => void,
        type: 'absolute' | 'relative'
    ) => (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardDesc}>
                {type === 'absolute'
                    ? 'Set the absolute speed thresholds for each speed zone in kilometers per hour (km/h).'
                    : 'Set the relative speed thresholds for each speed zone as a percentage of each player\'s speed max.'}
            </Text>

            <View style={styles.radioRow}>
                <TouchableOpacity
                    style={styles.radioBtn}
                    onPress={() => setDefault(true)}
                >
                    <View style={[styles.radioOuter, isDefault && styles.radioOuterSelected]}>
                        {isDefault && <View style={styles.radioInner} />}
                    </View>
                    <Text style={styles.radioLabel}>Use default thresholds</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.radioBtn}
                    onPress={() => setDefault(false)}
                >
                    <View
                        style={[styles.radioOuter, !isDefault && styles.radioOuterSelected]}
                    >
                        {!isDefault && <View style={styles.radioInner} />}
                    </View>
                    <Text style={styles.radioLabel}>Use custom thresholds</Text>
                </TouchableOpacity>
            </View>

            {data.map((item) => (
                <View key={item.id} style={styles.inputRow}>
                    <Text style={styles.zoneLabel}>{item.zone_name}</Text>
                    <View style={styles.inputs}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Min {type === 'absolute' ? '(km/h)' : '(%)'}</Text>
                            <TextInput
                                style={[styles.input, isDefault && styles.inputDisabled]}
                                editable={!isDefault}
                                keyboardType="numeric"
                                value={String(item.min_val)}
                                onChangeText={(t) => updateVal(type, item.id, 'min_val', t)}
                            />
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Max {type === 'absolute' ? '(km/h)' : '(%)'}</Text>
                            <TextInput
                                style={[styles.input, isDefault && styles.inputDisabled]}
                                editable={!isDefault}
                                keyboardType="numeric"
                                value={String(item.max_val)}
                                onChangeText={(t) => updateVal(type, item.id, 'max_val', t)}
                            />
                        </View>
                    </View>
                </View>
            ))}
        </View>
    );

    return (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
            {renderSection(
                'Absolute Speed Thresholds',
                absThresholds,
                useDefaultAbs,
                setUseDefaultAbs,
                'absolute'
            )}
            {renderSection(
                'Relative Speed Thresholds',
                relThresholds,
                useDefaultRel,
                setUseDefaultRel,
                'relative'
            )}

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveText}>SAVE CHANGES</Text>
            </TouchableOpacity>
        </ScrollView>
    );
};

const ExercisesView = () => {
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [type, setType] = useState<'match' | 'training'>('training');

    // ... [rest of the hook logic was accidentally removed or misplaced in previous edits, restoring structure]

    const [clubId, setClubId] = useState<string | null>(null);

    // Load Club ID
    useEffect(() => {
        const fetchClubId = async () => {
            try {
                const res = await db.execute('SELECT club_id FROM club_admins LIMIT 1');
                if (res.rows?._array?.length > 0) {
                    setClubId(res.rows._array[0].club_id);
                }
            } catch (e) { console.log("Failed to fetch club ID", e); }
        };
        fetchClubId();
    }, []);

    const loadExercises = useCallback(() => {
        try {
            const res = db.execute(`SELECT * FROM exercise_types ORDER BY created_at DESC, id DESC`);
            setExercises(res.rows?._array || []);
        } catch (e) {
            console.error(e);
        }
    }, []);

    useEffect(() => {
        loadExercises();
    }, [loadExercises]);

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert('Validation Error', 'Exercise name is required');
            return;
        }

        try {
            if (editingId) {
                // Update
                await db.execute(
                    `UPDATE exercise_types SET name=?, event_type=? WHERE id=?`,
                    [name, type, editingId]
                );
            } else {
                // Create
                const isSystem = 0;
                const createdAt = Date.now();

                // 1. Local Save
                await db.execute(
                    `INSERT INTO exercise_types (name, event_type, is_system, created_at) VALUES (?, ?, ?, ?)`,
                    [name, type, isSystem, createdAt]
                );

                // 2. Backend Save (Fire and forget or await)
                if (clubId) {
                    try {
                        await api.post('/exercise-types', {
                            name,
                            event_type: type,
                            club_id: clubId
                        });
                        console.log("Synced exercise type to backend");
                    } catch (apiErr) {
                        console.warn("Backend sync failed for exercise type", apiErr);
                        Alert.alert("Notice", "Saved locally, but failed to sync to server. Check connection.");
                    }
                }
            }
            setModalVisible(false);
            resetForm();
            loadExercises();
        } catch (e) {
            Alert.alert('Error', 'Failed to save exercise');
        }
    };

    const handleDelete = (id: number, isSystem: number) => {
        if (isSystem === 1) {
            Alert.alert('Action Denied', 'System default exercises cannot be deleted.');
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
                            await db.execute(`DELETE FROM exercise_types WHERE id=?`, [id]);
                            loadExercises();
                        } catch (e) {
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
                <Text style={styles.sectionHeader}>Manage Exercise Types</Text>
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

            <View style={styles.tableHeader}>
                <Text style={[styles.headerText, { flex: 2 }]}>EXERCISE NAME</Text>
                <Text style={[styles.headerText, { flex: 1 }]}>EVENT TYPE</Text>
                <Text style={[styles.headerText, { width: 80, textAlign: 'right' }]}>ACTIONS</Text>
            </View>

            <FlatList
                data={exercises}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={{ paddingBottom: 60 }}
                renderItem={({ item }) => (
                    <View style={styles.row}>
                        <View style={{ flex: 2 }}>
                            <Text style={styles.rowTitle}>{item.name}</Text>
                            {item.is_system === 1 && <Text style={styles.rowSystemTag}>(Default)</Text>}
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
                                    { backgroundColor: item.is_system === 1 ? '#cbd5e1' : '#ef4444' },
                                ]}
                                onPress={() => handleDelete(item.id, item.is_system)}
                                disabled={item.is_system === 1}
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
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>
                            {editingId ? 'Edit Exercise' : 'Create Exercise'}
                        </Text>

                        <Text style={styles.fieldLabel}>Name</Text>
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholder="Ex: Warm Up"
                        />

                        <Text style={styles.fieldLabel}>Type</Text>
                        <View style={styles.typeRow}>
                            {['training', 'match'].map((t) => (
                                <TouchableOpacity
                                    key={t}
                                    style={[
                                        styles.typeOption,
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
                                        {t === 'training' ? 'Training' : 'Match'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={styles.cancelText}>Cancel</Text>
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
        backgroundColor: '#f1f5f9',
        padding: 16,
    },
    header: {
        marginBottom: 16,
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
    },
    zoneLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0f172a',
        marginBottom: 8,
    },
    inputs: {
        flexDirection: 'row',
        gap: 16,
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
