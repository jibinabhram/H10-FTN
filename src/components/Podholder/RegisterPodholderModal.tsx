import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Pressable,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';

/* ================= TYPES ================= */

type PodStatus = 'ACTIVE' | 'REPAIRED' | 'SCRAP';

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


const MIN_PODS = 0;

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
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}>
          {/* HEADER */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Register Podholder</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={isDark ? '#F8FAFC' : '#000'} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.serialHint, { color: isDark ? '#94A3B8' : '#6B7280' }]}>Serial Number: Auto generated</Text>



          <View style={styles.filterRow}>
            {['ALL', 'ACTIVE', 'REPAIRED'].map(f => (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f as any)}
                style={[
                  styles.filterBtn,
                  filter === f && styles.filterBtnActive,
                  { borderColor: isDark ? '#334155' : '#E5E7EB' },
                  filter === f && { backgroundColor: isDark ? '#B91C1C' : '#DC2626' }
                ]}
              >
                <Text style={[filter === f ? styles.filterActiveText : styles.filterText, { color: filter === f ? '#FFFFFF' : (isDark ? '#F8FAFC' : '#374151') }]}>
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
            Available: {filteredPods.length} | Selected {selected.length}
          </Text>


          {/* GRID */}
          <ScrollView style={{ minHeight: 100, maxHeight: 300, flexShrink: 1 }}>
            <View style={styles.gridContainer}>
              {filteredPods.map(item => {
                const isSelected = selected.includes(item.pod_id);
                const isActive = item.lifecycle_status === 'ACTIVE';
                const isRepaired = item.lifecycle_status === 'REPAIRED';

                return (
                  <TouchableOpacity
                    key={item.pod_id}
                    onPress={() => togglePod(item.pod_id)}
                    style={[
                      styles.podBox,
                      isActive ? [styles.activeBox, isDark && { backgroundColor: '#064E3B', borderColor: '#10B981' }] :
                        isRepaired ? [styles.repairedBox, isDark && { backgroundColor: '#075985', borderColor: '#0EA5E9' }] :
                          [{ backgroundColor: '#E5E7EB', borderColor: '#9CA3AF' }, isDark && { backgroundColor: '#374151', borderColor: '#6B7280' }],
                      isSelected && [styles.selectedBox, isDark && { backgroundColor: '#312E81', borderColor: '#818CF8' }],
                    ]}
                  >
                    <Text
                      style={[
                        styles.podText,
                        isActive ? [styles.activeText, isDark && { color: '#34D399' }] :
                          isRepaired ? [styles.repairedText, isDark && { color: '#7DD3FC' }] :
                            [{ color: '#6B7280' }, isDark && { color: '#9CA3AF' }],
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
              })}
            </View>
          </ScrollView>

          {/* BUTTON */}
          <TouchableOpacity
            onPress={handleSubmit}
            style={styles.btn}
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
    width: '90%',
    maxWidth: 600,
    maxHeight: '85%',
    flexShrink: 1,
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
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },

  filterText: { fontSize: 12, color: '#374151' },
  filterActiveText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  subText: { fontSize: 12, color: '#6B7280', marginBottom: 6 },

  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  podBox: {
    width: 60,
    height: 60,
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
    backgroundColor: '#E0F2FE',
    borderColor: '#0284C7',
  },

  selectedBox: {
    borderColor: '#7C3AED',
    backgroundColor: '#F5F3FF',
  },

  podText: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  activeText: { color: '#16A34A' },
  repairedText: { color: '#0284C7' },

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
