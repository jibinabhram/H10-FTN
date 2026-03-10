import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../../components/context/ThemeContext';

const { width } = Dimensions.get('window');

interface AssignPodModalProps {
  visible: boolean;
  onClose: () => void;
  playerName: string;
  currentPod: string | null;
  podMap: Record<string, string | null>;
  podToHolder: Record<string, string | null>;
  assigned: Record<string, boolean>;
  podHolders: any[];
  initialHolderSerial: string | null;
  onAssign: (podSerial: string) => void;
  onUnassign: () => void;
}

const AssignPodModal: React.FC<AssignPodModalProps> = ({
  visible,
  onClose,
  playerName,
  currentPod,
  podMap,
  podToHolder,
  assigned,
  podHolders,
  initialHolderSerial,
  onAssign,
  onUnassign,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const PRIMARY = '#DC2626';

  const normalize = (s: string) => (s || "").toUpperCase().replace(/PH-/g, "").replace(/PD-/g, "").replace(/[^A-Z0-9]/g, "").trim();

  const visibleHolders = useMemo(() => {
    if (initialHolderSerial) {
      const match = podHolders.filter(h => normalize(h.serial_number) === normalize(initialHolderSerial));
      if (match.length > 0) return match;
    }
    return podHolders;
  }, [podHolders, initialHolderSerial]);

  const [selectedHolderSerial, setSelectedHolderSerial] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      if (initialHolderSerial && visibleHolders.some(h => normalize(h.serial_number) === normalize(initialHolderSerial))) {
        const match = visibleHolders.find(h => normalize(h.serial_number) === normalize(initialHolderSerial));
        setSelectedHolderSerial(match?.serial_number || visibleHolders[0]?.serial_number);
      } else if (visibleHolders.length > 0) {
        setSelectedHolderSerial(visibleHolders[0].serial_number);
      }
    }
  }, [visible, initialHolderSerial, visibleHolders]);

  const podsInSelectedHolder = useMemo(() => {
    if (!selectedHolderSerial) {
      console.log("🟠 No holder selected yet");
      return [];
    }
    const normSelected = normalize(selectedHolderSerial);
    console.log("🔍 Filtering pods for holder:", selectedHolderSerial, " (Norm:", normSelected, ")");

    const allPodSerials = Object.keys(podMap);
    console.log("📦 Total pods in podMap:", allPodSerials.length);

    const filtered = allPodSerials.filter(serial => {
      const holderOfThisPod = podToHolder[serial];
      if (!holderOfThisPod) {
        // If we have only one holder and it's selected, maybe show pods with NO holder?
        // For now, just log it.
        return false;
      }
      const normPodHolder = normalize(holderOfThisPod);
      const match = normPodHolder === normSelected;
      return match;
    }).map(serial => {
      const ownerId = podMap[serial];
      const isActuallyUnassigned = ownerId === null || (!!ownerId && assigned[ownerId] === false);
      return {
        serial,
        ownerId,
        isUnassigned: isActuallyUnassigned,
        isCurrent: serial === currentPod
      };
    })
      .filter(p => p.isUnassigned || p.isCurrent) // Show only Unassigned or the current player's pod
      .sort((a, b) => {
        // Current pod first
        if (a.isCurrent) return -1;
        if (b.isCurrent) return 1;
        // Unassigned pods next
        if (a.isUnassigned !== b.isUnassigned) return a.isUnassigned ? -1 : 1;
        // Then by serial
        return a.serial.localeCompare(b.serial);
      });

    console.log("✅ Pods found for this holder:", filtered.length);
    if (filtered.length === 0 && allPodSerials.length > 0) {
      console.log("ℹ️ Sample first pod holder in mapping:", podToHolder[allPodSerials[0]]);
    }

    return filtered;
  }, [selectedHolderSerial, podMap, podToHolder, assigned, currentPod]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: isDark ? '#1e293b' : '#FFFFFF' }]}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: isDark ? '#f8fafc' : '#0F172A' }]}>
                ASSIGN HUB POD
              </Text>
              <Ionicons name="radio-outline" size={20} color={PRIMARY} style={{ marginLeft: 8 }} />
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={isDark ? '#94a3b8' : '#64748B'} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {currentPod && (
              <View style={styles.currentPodRow}>
                <Text style={[styles.currentLabel, { color: isDark ? '#94a3b8' : '#64748B' }]}>
                  Selected : <Text style={{ color: PRIMARY, fontWeight: '800' }}>{currentPod}</Text>
                </Text>
                <TouchableOpacity style={styles.unassignBtn} onPress={() => { onUnassign(); }}>
                  <Text style={styles.unassignText}>Unassign</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={[styles.availableSection, { backgroundColor: isDark ? '#0f172a' : '#0f172a', padding: 12 }]}>
              {visibleHolders.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.holderTabs}>
                  {visibleHolders.map(holder => (
                    <TouchableOpacity
                      key={holder.pod_holder_id}
                      onPress={() => setSelectedHolderSerial(holder.serial_number)}
                      style={[
                        styles.holderTab,
                        {
                          backgroundColor: selectedHolderSerial === holder.serial_number ? PRIMARY : (isDark ? '#1e293b' : '#1e293b'),
                          borderColor: selectedHolderSerial === holder.serial_number ? PRIMARY : (isDark ? '#334155' : '#334155'),
                          flexDirection: 'row',
                          gap: 8
                        }
                      ]}
                    >
                      <Ionicons name="hardware-chip-outline" size={14} color={selectedHolderSerial === holder.serial_number ? '#fff' : PRIMARY} />
                      <Text style={[
                        styles.holderTabText,
                        { color: selectedHolderSerial === holder.serial_number ? '#fff' : (isDark ? '#94a3b8' : '#64748B') }
                      ]}>
                        {holder.serial_number || 'Unnamed'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <ScrollView style={{ maxHeight: 350 }}>
                <View style={styles.podGrid}>
                  {podsInSelectedHolder.length === 0 ? (
                    <Text style={styles.emptyText}>No pods found in this holder</Text>
                  ) : (
                    podsInSelectedHolder.map(p => (
                      <TouchableOpacity
                        key={p.serial}
                        style={[
                          styles.podBox,
                          {
                            backgroundColor: p.isCurrent ? (isDark ? '#3b0f0f' : '#fee2e2') : (isDark ? '#1e293b' : '#fff'),
                            borderColor: p.isCurrent ? PRIMARY : (isDark ? '#334155' : '#e2e8f0'),
                            opacity: (!p.isUnassigned && !p.isCurrent) ? 0.6 : 1
                          }
                        ]}
                        onPress={() => { onAssign(p.serial); }}
                      >
                        <Ionicons
                          name={p.isCurrent ? "radio-button-on" : (p.isUnassigned ? "radio-button-off" : "ban-outline")}
                          size={14}
                          color={p.isCurrent ? PRIMARY : (p.isUnassigned ? '#16a34a' : '#94a3b8')}
                        />
                        <Text style={[
                          styles.podText,
                          { color: p.isCurrent ? PRIMARY : (isDark ? '#f8fafc' : '#374151') }
                        ]} numberOfLines={1}>
                          {p.serial}
                        </Text>
                        {!p.isUnassigned && !p.isCurrent && (
                          <Text style={styles.busyLabel}>Busy</Text>
                        )}
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              </ScrollView>
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.switchBtn, { backgroundColor: PRIMARY }]} onPress={onClose}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.switchBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '90%',
    maxWidth: 550,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  content: {},
  currentPodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  currentLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  unassignBtn: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  unassignText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  availableSection: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 24,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginLeft: 10,
  },
  holderTabs: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  holderTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    minWidth: 100,
    alignItems: 'center',
  },
  holderTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  podGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  podBox: {
    width: '31%', // roughly 3 columns
    minWidth: 80,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  podText: {
    fontSize: 11,
    fontWeight: '800',
  },
  busyLabel: {
    fontSize: 9,
    color: '#94a3b8',
    fontWeight: '700',
  },
  emptyText: {
    textAlign: 'center',
    padding: 20,
    color: '#94a3b8',
    width: '100%',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#64748B',
    fontWeight: '800',
    fontSize: 14,
  },
  switchBtn: {
    flex: 1.5,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
});

export default AssignPodModal;
