import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Alert,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import api from '../../api/axios';
import { useTheme } from '../../components/context/ThemeContext';

const AssignPodHolder = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [coaches, setCoaches] = useState<any[]>([]);
  const [podHolders, setPodHolders] = useState<any[]>([]);
  const [selectedCoach, setSelectedCoach] = useState<string | null>(null);
  const [selectedPodHolder, setSelectedPodHolder] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const coachRes = await api.get('/coaches/my-club');
      const podRes = await api.get('/pod-holders');

      setCoaches(coachRes.data?.data || coachRes.data || []);
      setPodHolders(podRes.data?.data || podRes.data || []);
    } catch (e) {
      Alert.alert('Error', 'Failed to load data');
    }
  };

  const handleAssign = async () => {
    if (!selectedCoach || !selectedPodHolder) {
      return Alert.alert('Error', 'Select Coach & Pod Holder');
    }

    try {
      await api.post('/coaches/assign-pod-holder', {
        coach_id: selectedCoach,
        pod_holder_id: selectedPodHolder,
      });

      Alert.alert('Success', 'Pod Holder assigned to Coach');
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        'Assignment failed';

      Alert.alert('Error', msg);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#020617' : '#FFFFFF', flex: 1 }]}>
      <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#000000' }]}>Assign Pod Holder to Coach</Text>

      <Text style={[styles.label, { color: isDark ? '#94A3B8' : '#000000' }]}>Select Coach</Text>
      {coaches.map(coach => (
        <TouchableOpacity
          key={coach.coach_id}
          style={[
            styles.item,
            { borderColor: isDark ? '#334155' : '#000000', backgroundColor: isDark ? '#0F172A' : '#FFFFFF' },
            selectedCoach === coach.coach_id && { backgroundColor: isDark ? '#1e3a8a' : '#BFDBFE' },
          ]}
          onPress={() => setSelectedCoach(coach.coach_id)}
        >
          <Text style={{ color: isDark ? '#E2E8F0' : '#000000' }}>{coach.coach_name || 'Unnamed Coach'}</Text>
        </TouchableOpacity>
      ))}

      <Text style={[styles.label, { color: isDark ? '#94A3B8' : '#000000' }]}>Select Pod Holder</Text>
      {podHolders.map(pod => (
        <TouchableOpacity
          key={pod.pod_holder_id}
          style={[
            styles.item,
            { borderColor: isDark ? '#334155' : '#000000', backgroundColor: isDark ? '#0F172A' : '#FFFFFF' },
            selectedPodHolder === pod.pod_holder_id && { backgroundColor: isDark ? '#1e3a8a' : '#BFDBFE' },
          ]}
          onPress={() => setSelectedPodHolder(pod.pod_holder_id)}
        >
          <Text style={{ color: isDark ? '#E2E8F0' : '#000000' }}>{pod.serial_number || 'Unknown Pod'}</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.button} onPress={handleAssign}>
        <Text style={styles.btnText}>Assign</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  label: { fontWeight: '600', marginTop: 16, marginBottom: 6 },
  item: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 6,
  },
  selected: { backgroundColor: '#BFDBFE' },
  button: {
    marginTop: 20,
    backgroundColor: '#2563EB',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700' },
});

export default AssignPodHolder;
