import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../../components/context/ThemeContext';

interface AssignPodModalProps {
  visible: boolean;
  onClose: () => void;
  playerName: string;
  currentPod: string | null;
  availablePods: string[];
  onAssign: (podSerial: string) => void;
  onUnassign: () => void;
}

const AssignPodModal: React.FC<AssignPodModalProps> = ({
  visible,
  onClose,
  playerName,
  currentPod,
  availablePods,
  onAssign,
  onUnassign,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

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
                Switch Pods - {playerName}
              </Text>
              <Ionicons name="swap-horizontal" size={20} color="#ef4444" style={{ marginLeft: 8 }} />
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={isDark ? '#94a3b8' : '#64748B'} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {currentPod && (
              <View style={styles.currentPodRow}>
                <Text style={[styles.currentLabel, { color: isDark ? '#94a3b8' : '#64748B' }]}>
                  Current Pod : <Text style={{ color: '#ef4444', fontWeight: '800' }}>{currentPod}</Text>
                </Text>
                <TouchableOpacity style={styles.unassignBtn} onPress={onUnassign}>
                  <Text style={styles.unassignText}>Unassign</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={[styles.availableSection, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="card-outline" size={20} color={isDark ? '#94a3b8' : '#64748B'} />
                <Text style={[styles.sectionTitle, { color: isDark ? '#f8fafc' : '#0F172A' }]}>
                  Available Pods : ({availablePods.length})
                </Text>
              </View>

              <Text style={[styles.hint, { color: isDark ? '#94a3b8' : '#64748B' }]}>Select a new pod</Text>

              <View style={[styles.dropdown, { borderColor: isDark ? '#334155' : '#E5E7EB' }]}>
                <FlatList
                  data={availablePods}
                  keyExtractor={item => item}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.podItem}
                      onPress={() => onAssign(item)}
                    >
                      <Text style={[styles.podItemText, { color: isDark ? '#f8fafc' : '#0F172A' }]}>{item}</Text>
                      <Ionicons name="chevron-forward" size={16} color={isDark ? '#475569' : '#94a3b8'} />
                    </TouchableOpacity>
                  )}
                  maxHeight={200}
                  ListEmptyComponent={<Text style={styles.emptyText}>No available pods</Text>}
                />
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.switchBtn} onPress={onClose}>
              <Ionicons name="swap-horizontal" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.switchBtnText}>Switch Pod</Text>
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
    width: '100%',
    borderRadius: 24,
    padding: 24,
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
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginLeft: 10,
  },
  hint: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  dropdown: {
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  podItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  podItemText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    padding: 20,
    color: '#94a3b8',
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
    backgroundColor: '#ef4444',
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
