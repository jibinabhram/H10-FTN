import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../components/context/ThemeContext';
import PerformanceScreen from './PerformanceScreen'; // 🔧 ADDED

interface Props {
  openCreateEvent: () => void;
}

const EventsScreen: React.FC<Props> = ({ openCreateEvent }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <View style={styles.container}>
      {/* ===== HEADER ===== */}
      <View style={[styles.header, { backgroundColor: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? '#334155' : '#e5e7eb' }]}>
        <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>Compare</Text>
      </View>

      {/* ===== BODY (EVENTS LIST / ANALYSIS) ===== */}
      <View style={[styles.body, { backgroundColor: isDark ? '#020617' : '#f5f7fa' }]}>
        <PerformanceScreen />
      </View>
    </View>
  );
};

export default EventsScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 56,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  title: { fontSize: 18, fontWeight: '700' },
  createBtn: {
    backgroundColor: '#B50002',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createText: { color: '#fff', fontWeight: '700' },

  body: {
    flex: 1,          // 🔧 IMPORTANT: allow full height
    backgroundColor: '#f5f7fa',
  },
});
