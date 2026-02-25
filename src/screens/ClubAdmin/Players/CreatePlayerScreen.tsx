import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  createPlayer,
  getMyClubPods,
  getMyPodHolders,
  getPodsByHolder,
} from '../../../api/players';
import { upsertPlayersToSQLite } from '../../../services/playerCache.service';
import { useTheme } from '../../../components/context/ThemeContext';
import { db } from '../../../db/sqlite';
import { getClubZoneDefaults } from '../../../api/clubZones';

const CreatePlayerScreen = ({ goBack }: { goBack: () => void }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [form, setForm] = useState({
    player_name: '',
    age: '',
    jersey_number: '',
    position: '',
    height: '',
    weight: '',
  });

  const [pods, setPods] = useState<any[]>([]);
  const [podHolders, setPodHolders] = useState<any[]>([]);
  const [selectedPodHolderId, setSelectedPodHolderId] = useState<string | null>(null);
  const [selectedPod, setSelectedPod] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [zones, setZones] = useState<Array<{ zone: number; min: number; max: number }>>([]);

  const defaultZones = [
    { zone: 1, min: 101, max: 120 },
    { zone: 2, min: 120, max: 140 },
    { zone: 3, min: 140, max: 160 },
    { zone: 4, min: 160, max: 180 },
    { zone: 5, min: 180, max: 200 },
  ];

  /* ===== LOAD DATA ===== */
  useEffect(() => {
    loadPods();
    loadPodHolders();
    loadDefaultZones();
  }, []);

  const loadDefaultZones = async () => {
    try {
      // 1️⃣ Try SQLite first (offline-first)
      const res = db.execute(`SELECT zone_number, min_hr, max_hr FROM hr_zones ORDER BY zone_number`);
      const rows = res?.rows?._array ?? [];
      if (rows.length > 0) {
        console.log('✅ Loaded default zones from SQLite');
        setZones(rows.map((r: any) => ({ zone: r.zone_number, min: r.min_hr, max: r.max_hr })));
        return;
      }

      // 2️⃣ SQLite empty, try backend
      try {
        const backendDefaults = await getClubZoneDefaults();
        if (Array.isArray(backendDefaults) && backendDefaults.length > 0) {
          console.log('✅ Loaded default zones from backend');
          const normalized = backendDefaults.map((z: any) => ({
            zone: Number(z.zone ?? z.zone_number ?? 0),
            min: Number(z.min ?? z.min_hr ?? 0),
            max: Number(z.max ?? z.max_hr ?? 0),
          }));
          setZones(normalized);
          // Cache to SQLite
          db.execute(`DELETE FROM hr_zones`);
          normalized.forEach(z => {
            db.execute(`INSERT INTO hr_zones (zone_number, min_hr, max_hr) VALUES (?, ?, ?)`, [z.zone, z.min, z.max]);
          });
          return;
        }
      } catch (e) {
        console.log('⚠️ Failed to load defaults from backend', e);
      }

      // 3️⃣ Use hardcoded defaults
      console.log('🆕 Using hardcoded default zones');
      setZones(defaultZones);
    } catch (e) {
      console.error('Failed to load default zones', e);
      setZones(defaultZones);
    }
  };

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadPods();
    } finally {
      setRefreshing(false);
    }
  }, []);

  const loadPods = async () => {
    try {
      const result = await getMyClubPods();

      let rawPods = [];
      if (Array.isArray(result)) {
        rawPods = result;
      } else if (Array.isArray(result?.data)) {
        rawPods = result.data;
      }

      const available = rawPods.filter((p: any) => {
        if (!p) return false;
        const hasAssignment =
          (Array.isArray(p.player_pods) && p.player_pods.length > 0) ||
          Boolean(p.player_id) ||
          Boolean(p.assigned_player_id);
        return !hasAssignment;
      });
      setPods(available);
    } catch (e: any) {
      console.log('LOAD PODS ERROR 👉', e);
      console.log('RESPONSE 👉', e?.response?.data);

      Alert.alert(
        'Error',
        e?.response?.data?.message ||
        e?.message ||
        'Failed to load pods'
      );
    }
  };

  const loadPodHolders = async () => {
    try {
      console.log('🔍 Loading pod holders for current club...');
      const holders = await getMyPodHolders();
      console.log('📦 Pod holders received:', holders);
      setPodHolders(Array.isArray(holders) ? holders : []);
      console.log('✅ Pod holders set:', Array.isArray(holders) ? holders.length : 0);
    } catch (e) {
      console.error('Failed to load pod holders', e);
    }
  };

  const loadPodsByHolder = async (holderId: string) => {
    try {
      console.log('📦 Loading pods for holder:', holderId);
      const podsData = await getPodsByHolder(holderId);
      console.log('📦 Pods data received:', podsData);

      const available = (Array.isArray(podsData) ? podsData : []).filter((p: any) => {
        if (!p) return false;

        const hasAssignment =
          (Array.isArray(p.player_pods) && p.player_pods.length > 0) ||
          Boolean(p.player_id) ||
          Boolean(p.assigned_player_id);

        console.log(`📦 Pod ${p.serial_number}:`, {
          player_pods: p.player_pods,
          player_id: p.player_id,
          assigned_player_id: p.assigned_player_id,
          hasAssignment,
        });

        return !hasAssignment;
      });

      console.log('✅ Available pods after filtering:', available.length, available);
      setPods(available);
      setSelectedPod(null);
    } catch (e) {
      console.error('Failed to load pods for holder', e);
      setPods([]);
    }
  };

  /* ===== SUBMIT ===== */
  const submit = async () => {
    if (!selectedPod) {
      Alert.alert('Missing', 'Please select a pod');
      return;
    }

    try {
      // 1️⃣ Create player in backend
      const createdPlayer = await createPlayer({
        player_name: form.player_name,
        age: Number(form.age),
        jersey_number: Number(form.jersey_number),
        position: form.position,
        pod_id: selectedPod,
        height: form.height ? Number(form.height) : undefined,
        weight: form.weight ? Number(form.weight) : undefined,
      });

      // 2️⃣ Cache immediately in SQLite ✅
      upsertPlayersToSQLite([createdPlayer]);

      // 3️⃣ Navigate back
      goBack();
    } catch (e: any) {
      console.log('CREATE PLAYER ERROR 👉', e);
      console.log('RESPONSE 👉', e?.response?.data);

      Alert.alert(
        'Error',
        e?.response?.data?.message ??
        e?.message ??
        'Failed to create player'
      );
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 120}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: isDark ? '#020617' : '#FFFFFF' }]}
        contentContainerStyle={{ paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? "#fff" : "#DC2626"}
          />
        }
      >
        <Text style={[styles.title, { color: isDark ? '#fff' : '#020617', marginTop: 15, paddingRight: 40 }]}>Register Player</Text>

        <TextInput
          placeholder="Player Name"
          placeholderTextColor={isDark ? "#94a3b8" : "#94A3B8"}
          style={[styles.input, { backgroundColor: isDark ? '#1e293b' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E5E7EB', color: isDark ? '#fff' : '#020617' }]}
          onChangeText={v => setForm({ ...form, player_name: v })}
        />

        <TextInput
          placeholder="Age"
          placeholderTextColor={isDark ? "#94a3b8" : "#94A3B8"}
          keyboardType="numeric"
          style={[styles.input, { backgroundColor: isDark ? '#1e293b' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E5E7EB', color: isDark ? '#fff' : '#020617' }]}
          onChangeText={v => setForm({ ...form, age: v })}
        />

        <TextInput
          placeholder="Jersey Number"
          placeholderTextColor={isDark ? "#94a3b8" : "#94A3B8"}
          keyboardType="numeric"
          style={[styles.input, { backgroundColor: isDark ? '#1e293b' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E5E7EB', color: isDark ? '#fff' : '#020617' }]}
          onChangeText={v => setForm({ ...form, jersey_number: v })}
        />

        <TextInput
          placeholder="Position"
          placeholderTextColor={isDark ? "#94a3b8" : "#94A3B8"}
          style={[styles.input, { backgroundColor: isDark ? '#1e293b' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E5E7EB', color: isDark ? '#fff' : '#020617' }]}
          onChangeText={v => setForm({ ...form, position: v })}
        />


        <TextInput
          placeholder="Height (cm)"
          placeholderTextColor={isDark ? "#94a3b8" : "#94A3B8"}
          keyboardType="numeric"
          style={[styles.input, { backgroundColor: isDark ? '#1e293b' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E5E7EB', color: isDark ? '#fff' : '#020617' }]}
          onChangeText={v => setForm({ ...form, height: v })}
        />

        <TextInput
          placeholder="Weight (kg)"
          placeholderTextColor={isDark ? "#94a3b8" : "#94A3B8"}
          keyboardType="numeric"
          style={[styles.input, { backgroundColor: isDark ? '#1e293b' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E5E7EB', color: isDark ? '#fff' : '#020617' }]}
          onChangeText={v => setForm({ ...form, weight: v })}
        />

        <Text style={[styles.label, { color: isDark ? '#e2e8f0' : '#334155' }]}>Select Pod Holder</Text>
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
                  backgroundColor: selectedPodHolderId === holder.pod_holder_id ? '#DC2626' : (isDark ? '#1e293b' : '#F3F4F6'),
                  borderColor: selectedPodHolderId === holder.pod_holder_id ? '#DC2626' : (isDark ? '#334155' : '#E5E7EB'),
                }
              ]}
            >
              <Text style={[
                styles.podHolderChipText,
                { color: selectedPodHolderId === holder.pod_holder_id ? '#fff' : (isDark ? '#fff' : '#000') }
              ]}>
                {holder.serial_number || `Holder ${holder.pod_holder_id.slice(0, 8)}`}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {selectedPodHolderId && (
          <>
            <Text style={[styles.label, { color: isDark ? '#e2e8f0' : '#334155' }]}>Select Pod</Text>
            {pods.length === 0 ? (
              <Text style={[styles.emptyText, { color: isDark ? '#94a3b8' : '#64748B' }]}>No available pods in this holder</Text>
            ) : (
              pods.map(p => (
                <TouchableOpacity
                  key={p.pod_id}
                  onPress={() => setSelectedPod(p.pod_id)}
                  style={[
                    styles.option,
                    { backgroundColor: isDark ? '#1e293b' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E5E7EB' },
                    selectedPod === p.pod_id && styles.selected,
                  ]}
                >
                  <Text style={{ color: isDark ? '#fff' : '#000' }}>{p.serial_number}</Text>
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        {/* Heart Rate Zones */}
        <View style={{ marginTop: 20 }}>
          <Text style={[styles.label, { color: isDark ? '#e2e8f0' : '#334155', fontSize: 16 }]}>❤️ HEART RATE ZONES</Text>
          {zones.length === 0 ? (
            <Text style={[styles.emptyText, { color: isDark ? '#94a3b8' : '#64748B' }]}>No zones defined</Text>
          ) : (
            zones.map(z => (
              <View key={z.zone} style={[styles.zoneRow, { backgroundColor: isDark ? '#1e293b' : '#F9FAFB', borderColor: isDark ? '#334155' : '#E5E7EB' }]}>
                <Text style={[styles.zoneLabel, { color: isDark ? '#fff' : '#111' }]}>Zone {z.zone}</Text>
                <Text style={[styles.zoneRange, { color: isDark ? '#94a3b8' : '#64748B' }]}>{z.min} to {z.max}</Text>
              </View>
            ))
          )}
        </View>

        <TouchableOpacity onPress={submit} style={styles.btn}>
          <Text style={styles.btnText}>Save Player</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default CreatePlayerScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    color: '#020617',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 12,
    color: '#020617',
  },
  label: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  option: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  selected: {
    backgroundColor: '#DBEAFE',
    borderColor: '#DC2626',
  },
  btn: {
    marginTop: 20,
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  podHolderChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  podHolderChipText: { fontSize: 13, fontWeight: '600' },
  emptyText: { fontSize: 13, color: '#64748B', textAlign: 'center', marginVertical: 16 },
  zoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  zoneLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  zoneRange: {
    fontSize: 13,
    color: '#64748B',
  },
});
