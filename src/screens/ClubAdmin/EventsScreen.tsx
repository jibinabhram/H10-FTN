// src/screens/ClubAdmin/EventsScreen.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../../components/context/ThemeContext';
import { sendTrigger } from '../../api/esp32';
import PerformanceScreen from './PerformanceScreen'; // 🔧 ADDED

interface Props {
  openCreateEvent: () => void;
}

const EventsScreen: React.FC<Props> = ({ openCreateEvent }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [loading, setLoading] = React.useState(false);

  const handleCreateEvent = async () => {
    try {
      setLoading(true);
      console.log("[EventsScreen] Sending device trigger...");
      await sendTrigger();
      openCreateEvent();
    } catch (error) {
      console.error("[EventsScreen] Trigger failed:", error);
      // Even if trigger fails, user might want to try anyway or see the error
      Alert.alert(
        "Device Error",
        "Could not trigger the device. Please check connection.",
        [{ text: "Continue Anyway", onPress: openCreateEvent }, { text: "Cancel", style: "cancel" }]
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* ===== HEADER ===== */}
      <View style={[styles.header, { backgroundColor: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? '#334155' : '#e5e7eb' }]}>
        <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>Events</Text>

        <TouchableOpacity
          style={[styles.createBtn, loading && { opacity: 0.7 }]}
          onPress={handleCreateEvent}
          disabled={loading}
        >
          <Text style={styles.createText}>{loading ? "Connecting..." : "Create Event"}</Text>
        </TouchableOpacity>
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
