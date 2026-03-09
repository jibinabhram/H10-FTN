// src/screens/ClubAdmin/EventsScreen.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useTheme } from '../../components/context/ThemeContext';
import { useAlert } from '../../components/context/AlertContext';
import { sendTrigger } from '../../api/esp32';
import PerformanceScreen from './PerformanceScreen'; // 🔧 ADDED

interface Props {
  openCreateEvent: () => void;
}

const EventsScreen: React.FC<Props> = ({ openCreateEvent }) => {
  const { theme } = useTheme();
  const { showAlert } = useAlert();
  const isDark = theme === 'dark';
  const [loading, setLoading] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState(true);

  React.useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      // Use isInternetReachable to ensure real connectivity, 
      // but fallback to isConnected if reachability is still unknown (null)
      const online = !!state.isConnected && (state.isInternetReachable !== false);
      setIsOnline(online);
    });
    return () => unsubscribe();
  }, []);

  const handleCreateEvent = async () => {
    if (!isOnline) {
      showAlert({
        title: "Offline",
        message: "You are offline. Please connect to the internet to create an event.",
        type: "warning",
      });
      return;
    }
    try {
      setLoading(true);
      console.log("[EventsScreen] Sending device trigger...");
      await sendTrigger();
      console.log("[EventsScreen] Device trigger acknowledged by Podholder.");
      openCreateEvent();
    } catch (error) {
      console.error("[EventsScreen] Trigger failed:", error);
      const errAny = error as any;
      const errMsg =
        errAny?.name === 'AbortError'
          ? 'Please check your connection'
          : errAny?.response?.data?.message ||
          errAny?.message ||
          "Could not trigger the device.Please check your connection.";
      // Even if trigger fails, user might want to try anyway or see the error
      showAlert({
        title: "Connection error",
        message: String(errMsg),
        type: "error",
        buttons: [
          { text: "Continue Anyway", onPress: openCreateEvent },
          { text: "Cancel", style: "cancel" },
        ],
      });
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
          style={[styles.createBtn, (loading || !isOnline) && { opacity: 0.7 }]}
          onPress={handleCreateEvent}
          disabled={loading}
        >
          <Text style={styles.createText}>
            {loading ? "Connecting..." : (!isOnline ? "Offline" : "Create Event")}
          </Text>
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