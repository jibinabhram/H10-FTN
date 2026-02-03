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
} from 'react-native';
import {
  createPlayer,
  getMyClubPods,
} from '../../../api/players';
import { upsertPlayersToSQLite } from '../../../services/playerCache.service';
import { useTheme } from '../../../components/context/ThemeContext';

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
  const [selectedPod, setSelectedPod] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /* ===== LOAD PODS FOR CLUB ===== */
  useEffect(() => {
    loadPods();
  }, []);

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

      if (Array.isArray(result)) {
        setPods(result);
      } else if (Array.isArray(result?.data)) {
        setPods(result.data);
      } else {
        setPods([]);
      }
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
    <ScrollView
      style={[styles.container, { backgroundColor: isDark ? '#020617' : '#FFFFFF' }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={isDark ? "#fff" : "#2563EB"}
        />
      }
    >
      <Text style={[styles.title, { color: isDark ? '#fff' : '#020617' }]}>Register Player</Text>

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

      <Text style={[styles.label, { color: isDark ? '#e2e8f0' : '#334155' }]}>Select Pod</Text>

      {pods.map(p => (
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
      ))}

      <TouchableOpacity onPress={submit} style={styles.btn}>
        <Text style={styles.btnText}>Save Player</Text>
      </TouchableOpacity>
    </ScrollView>
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
    paddingBottom: 32, // ✅ ensures button is reachable
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
    borderColor: '#2563EB',
  },

  btn: {
    marginTop: 20,
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },

  btnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
