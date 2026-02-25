import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';

/* ================= TYPES ================= */

type PodStatus = 'ACTIVE' | 'REPAIRED';

type Pod = {
  pod_id: string;
  serial_number: string;
  lifecycle_status: PodStatus;
};

type Props = {
  visible: boolean;
  pods?: Pod[];
  onClose: () => void;
  onRegister: (payload: {
    podIds: string[];
  }) => void;
};


const MAX_PODS = 24;
const NUM_COLUMNS = 6;

/* ================= COMPONENT ================= */

const RegisterPodholderModal = ({
  visible,
  pods = [],
  onClose,
  onRegister,
}: Props) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | PodStatus>('ALL');

  const filteredPods = useMemo(() => {
    if (filter === 'ALL') return pods;
    return pods.filter(p => p.lifecycle_status === filter);
  }, [pods, filter]);

  const togglePod = (id: string) => {
    setSelected(prev => {
      if (prev.includes(id)) {
        return prev.filter(p => p !== id);
      }

      return [...prev, id];
    });
  };

  const handleSubmit = async () => {
    if (selected.length < MAX_PODS) {
      setError('Please select at least 24 pods');
      return;
    }

    setError(null);

    try {
      await onRegister({
        podIds: selected,
      });

      setSelected([]);
    } catch (err: any) {
      if (err?.isOffline) {
        setError('No internet connection. Please try again.');
        return;
      }

      setError('Failed to register podholder');
    }
  };



  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}>
          {/* HEADER */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Register Podholder</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={isDark ? '#F8FAFC' : '#000'} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.serialHint, { color: isDark ? '#94A3B8' : '#6B7280' }]}>Serial Number: Auto generated</Text>



          {/* FILTER */}
          <View style={styles.filterRow}>
            {['ALL', 'ACTIVE', 'REPAIRED'].map(f => (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f as any)}
                style={[
                  styles.filterBtn,
                  filter === f && styles.filterBtnActive,
                  { borderColor: isDark ? '#334155' : '#E5E7EB' },
                  filter === f && { backgroundColor: isDark ? '#1E3A8A' : '#EEF2FF' }
                ]}
              >
                <Text style={[filter === f ? styles.filterActiveText : styles.filterText, { color: isDark && filter !== f ? '#F8FAFC' : (filter === f ? '#7C3AED' : '#374151') }]}>
                  {f}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {error && (
            <Text style={{ color: '#DC2626', fontSize: 12, marginBottom: 6 }}>
              {error}
            </Text>
          )}


          <Text style={[styles.subText, { color: isDark ? '#94A3B8' : '#6B7280' }]}>
            Available: {filteredPods.length} | Selected {selected.length} (min {MAX_PODS})
          </Text>


          {/* GRID */}
          <FlatList
            data={filteredPods}
            keyExtractor={i => i.pod_id}
            numColumns={NUM_COLUMNS}
            columnWrapperStyle={{ gap: 8 }}
            style={{ maxHeight: 300 }}
            renderItem={({ item }) => {
              const isSelected = selected.includes(item.pod_id);
              const isActive = item.lifecycle_status === 'ACTIVE';

              return (
                <TouchableOpacity
                  onPress={() => togglePod(item.pod_id)}
                  style={[
                    styles.podBox,
                    isActive ? [styles.activeBox, isDark && { backgroundColor: '#064E3B', borderColor: '#10B981' }] : [styles.repairedBox, isDark && { backgroundColor: '#7F1D1D', borderColor: '#EF4444' }],
                    isSelected && [styles.selectedBox, isDark && { backgroundColor: '#312E81', borderColor: '#818CF8' }],
                  ]}
                >
                  <Text
                    style={[
                      styles.podText,
                      isActive ? [styles.activeText, isDark && { color: '#34D399' }] : [styles.repairedText, isDark && { color: '#F87171' }],
                      isSelected && isDark && { color: '#A5B4FC' }
                    ]}
                  >
                    {item.serial_number}
                  </Text>

                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color="#7C3AED"
                      style={styles.checkIcon}
                    />
                  )}
                </TouchableOpacity>
              );
            }}
          />

          {/* BUTTON */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={selected.length < MAX_PODS}
            style={[
              styles.btn,
              selected.length < MAX_PODS && { opacity: 0.5 },
            ]}
          >


            <Text style={styles.btnText}>Register Podholder</Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
};

export default RegisterPodholderModal;

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  card: {
    width: '75%',
    maxWidth: 640,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  title: { fontSize: 18, fontWeight: '700' },

  serialHint: {
    fontSize: 12,
    color: '#6B7280',
    marginVertical: 6,
  },


  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },

  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  filterBtnActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#7C3AED',
  },

  filterText: { fontSize: 12, color: '#374151' },
  filterActiveText: { fontSize: 12, fontWeight: '700', color: '#7C3AED' },

  subText: { fontSize: 12, color: '#6B7280', marginBottom: 6 },

  podBox: {
    width: '15%',
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  activeBox: {
    backgroundColor: '#ECFDF5',
    borderColor: '#22C55E',
  },

  repairedBox: {
    backgroundColor: '#EFF6FF',
    borderColor: '#DC2626',
  },

  selectedBox: {
    borderColor: '#7C3AED',
    backgroundColor: '#F5F3FF',
  },

  podText: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  activeText: { color: '#16A34A' },
  repairedText: { color: '#DC2626' },

  checkIcon: { position: 'absolute', bottom: 4, right: 4 },

  btn: {
    marginTop: 12,
    backgroundColor: '#7C3AED',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },

  btnText: { color: '#fff', fontWeight: '700' },
});
