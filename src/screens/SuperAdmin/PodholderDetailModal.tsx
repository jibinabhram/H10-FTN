import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  RefreshControl,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import api from '../../api/axios';
import { getAvailablePods } from '../../api/pods';
import { useTheme } from '../../components/context/ThemeContext';

/* ================= TYPES ================= */

type PodStatus = 'ACTIVE' | 'REPAIRED';

type Pod = {
  pod_id: string;
  serial_number: string;
  lifecycle_status: PodStatus;
};

type Props = {
  visible: boolean;
  podHolder: any;
  onClose: () => void;
};

const MIN_SLOTS = 24;
const BOX_SIZE = 56;

/* ================= COMPONENT ================= */

const PodholderDetailModal = ({ visible, podHolder, onClose }: Props) => {
  const [holder, setHolder] = useState<any>(null);
  const [availablePods, setAvailablePods] = useState<Pod[]>([]);
  const [filter, setFilter] = useState<'ALL' | PodStatus>('ALL');

  const [refreshing, setRefreshing] = useState(false);


  const [extraSlots, setExtraSlots] = useState<number[]>([]);
  const [selectedEmptyId, setSelectedEmptyId] = useState<number | null>(null);

  const { theme } = useTheme();
  const isDark = theme === 'dark';

  /* ---------- LOAD DATA ---------- */

  useEffect(() => {
    if (!visible || !podHolder) return;
    setExtraSlots([]);
    setSelectedEmptyId(null);
    loadAll();
  }, [visible]);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await loadAll();
    } finally {
      setRefreshing(false);
    }
  };

  const loadAll = async () => {
    const h = await api.get(`/pod-holders/${podHolder.pod_holder_id}`);
    setHolder(h.data?.data ?? h.data);

    const pods = await getAvailablePods();
    setAvailablePods(
      pods.filter(p =>
        ['ACTIVE', 'REPAIRED'].includes(p.lifecycle_status)
      )
    );
  };

  /* ---------- SLOTS (SAFE) ---------- */

  const slots = useMemo(() => {
    const filled = holder?.pods ?? [];
    const baseCount = Math.max(MIN_SLOTS, filled.length);
    const emptyBase = baseCount - filled.length;

    return [
      ...filled.map((p: any) => ({ type: 'POD', data: p })),
      ...Array.from({ length: emptyBase }).map(() => ({
        type: 'EMPTY',
        id: null,
      })),
      ...extraSlots.map(id => ({
        type: 'EMPTY',
        id,
      })),
    ];
  }, [holder, extraSlots]);

  /* ---------- FILTER ---------- */

  const filteredAvailable =
    filter === 'ALL'
      ? availablePods
      : availablePods.filter(p => p.lifecycle_status === filter);

  /* ---------- ACTIONS ---------- */

  const removePod = async (podId: string) => {
    await api.patch(
      `/pod-holders/${holder.pod_holder_id}/remove-pod/${podId}`
    );
    loadAll();
  };

  const addPodIntoSelectedEmpty = async (podId: string) => {
    if (selectedEmptyId === null) return;

    await api.patch(
      `/pod-holders/${holder.pod_holder_id}/add-pod/${podId}`
    );


    setExtraSlots(slots => slots.filter(id => id !== selectedEmptyId));
    setSelectedEmptyId(null);
    loadAll();
  };

  /* ================= UI ================= */

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}>
          {/* HEADER */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
              {holder?.serial_number} – {holder?.model}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={isDark ? '#F8FAFC' : '#000'} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.helper, { color: isDark ? '#94A3B8' : '#6B7280' }]}>
            Click Add → select empty slot → choose pod
          </Text>

          {/* REGISTERED + EMPTY */}
          <ScrollView style={{ minHeight: 100, maxHeight: 220, flexShrink: 1 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
            <View style={styles.selectedGrid}>
              {slots.map((slot: any, idx: number) => {
                if (slot.type === 'POD') {
                  return (
                    <View key={idx} style={[styles.box, { borderColor: isDark ? '#334155' : '#E5E7EB' }]}>
                      <Text style={[styles.boxText, { color: isDark ? '#F8FAFC' : '#000' }]}>
                        {slot.data.serial_number}
                      </Text>
                      <Text
                        style={styles.remove}
                        onPress={() => removePod(slot.data.pod_id)}
                      >
                        Remove
                      </Text>
                    </View>
                  );
                }

                return (
                  <TouchableOpacity
                    key={slot.id ?? idx}
                    style={[
                      styles.box,
                      selectedEmptyId === slot.id && styles.selectedBox,
                      { borderColor: isDark ? '#334155' : '#E5E7EB' }
                    ]}
                    onPress={() => {
                      if (slot.id !== null) {
                        setSelectedEmptyId(slot.id);
                      }
                    }}
                  >
                    <Text style={[styles.boxText, { color: isDark ? '#94A3B8' : '#000' }]}>EMPTY</Text>
                  </TouchableOpacity>
                );
              })}

              {/* ADD SLOT */}
              <TouchableOpacity
                style={[styles.box, styles.addBox]}
                onPress={() =>
                  setExtraSlots(s => [...s, Date.now()])
                }
              >
                <Ionicons name="add" size={24} color="#DC2626" />
                <Text style={styles.addText}>Add</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* FILTER */}
          <View style={styles.filterRow}>
            {['ALL', 'ACTIVE', 'REPAIRED'].map(f => (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f as any)}
                style={[
                  styles.filterBtn,
                  filter === f && styles.filterActive,
                  { borderColor: isDark ? '#334155' : '#E5E7EB' },
                  filter === f && { backgroundColor: isDark ? '#1E3A8A' : '#E0E7FF' }
                ]}
              >
                <Text style={{ color: isDark ? '#F8FAFC' : '#0F172A' }}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* AVAILABLE PODS */}
          <ScrollView style={{ minHeight: 100, maxHeight: 220, flexShrink: 1 }}>
            <View style={styles.selectedGrid}>
              {filteredAvailable.map(item => (
                <TouchableOpacity
                  key={item.pod_id}
                  style={[
                    styles.box,
                    item.lifecycle_status === 'ACTIVE'
                      ? [styles.activeBox, isDark && { backgroundColor: '#064E3B', borderColor: '#10B981' }]
                      : [styles.repairedBox, isDark && { backgroundColor: '#7F1D1D', borderColor: '#EF4444' }],
                  ]}
                  onPress={() => addPodIntoSelectedEmpty(item.pod_id)}
                >
                  <Text style={[styles.boxText, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                    {item.serial_number}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default PodholderDetailModal;

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
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexShrink: 1,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },

  title: {
    fontSize: 16,
    fontWeight: '700',
  },

  helper: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },

  selectedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  box: {
    width: BOX_SIZE,
    height: BOX_SIZE,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  selectedBox: {
    borderColor: '#7C3AED',
    backgroundColor: '#F5F3FF',
  },

  addBox: {
    borderStyle: 'dashed',
    borderColor: '#DC2626',
    backgroundColor: '#EFF6FF',
  },

  addText: {
    fontSize: 10,
    marginTop: 2,
    color: '#DC2626',
    fontWeight: '600',
  },

  boxText: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },

  remove: {
    fontSize: 9,
    color: '#DC2626',
    marginTop: 4,
  },

  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 8,
  },

  filterBtn: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },

  filterActive: {
    backgroundColor: '#E0E7FF',
  },

  activeBox: {
    borderColor: '#22C55E',
    backgroundColor: '#ECFDF5',
  },

  repairedBox: {
    borderColor: '#DC2626',
    backgroundColor: '#EFF6FF',
  },
});
