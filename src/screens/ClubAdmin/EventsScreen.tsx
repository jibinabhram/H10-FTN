// src/screens/ClubAdmin/EventsScreen.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import PerformanceScreen from './PerformanceScreen'; // 🔧 ADDED

interface Props {
  openCreateEvent: () => void;
}

const EventsScreen: React.FC<Props> = ({ openCreateEvent }) => {
  return (
    <View style={styles.container}>
      {/* ===== HEADER ===== */}
      <View style={styles.header}>
        <Text style={styles.title}>Events</Text>

        <TouchableOpacity
          style={styles.createBtn}
          onPress={openCreateEvent}
        >
          <Text style={styles.createText}>Create Event</Text>
        </TouchableOpacity>
      </View>

      {/* ===== BODY (EVENTS LIST / ANALYSIS) ===== */}
      <View style={styles.body}>
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
    backgroundColor: '#16a34a',
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
