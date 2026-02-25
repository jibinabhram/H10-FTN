import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import api from '../../api/axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useTheme } from '../../components/context/ThemeContext';

type Props = {
  onNavigate?: (screen: any) => void;
};

type DashboardStats = {
  totalClubs: number;
  totalPodholders: number;
  totalPods: number;
  clubGrowth?: number;
  podholderGrowth?: number;
  podGrowth?: number;
};

const DashboardScreen: React.FC<Props> = ({ onNavigate }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const colors = {
    bg: isDark ? '#020617' : '#F8FAFC',
    card: isDark ? '#0F172A' : '#FFFFFF',
    text: isDark ? '#E5E7EB' : '#0F172A',
    subText: isDark ? '#94A3B8' : '#475569',
    border: isDark ? '#1E293B' : '#E5E7EB',
    green: '#22C55E',
    blue: '#DC2626',
    cyan: '#06B6D4',
  };


  const DASHBOARD_CACHE_KEY = 'dashboard_stats_cache';


  const [stats, setStats] = useState<DashboardStats>({
    totalClubs: 0,
    totalPodholders: 0,
    totalPods: 0,
    clubGrowth: 0,
    podholderGrowth: 0,
    podGrowth: 0,
  });

  const [loading, setLoading] = useState(true);



  const loadCachedStats = async () => {
    try {
      const cached = await AsyncStorage.getItem(DASHBOARD_CACHE_KEY);
      if (!cached) return;

      const parsed: DashboardStats = JSON.parse(cached);
      setStats(parsed);
      setLoading(false); // show cached data immediately
    } catch {
      await AsyncStorage.removeItem(DASHBOARD_CACHE_KEY);
    }
  };


  useEffect(() => {
    // 1️⃣ show cached stats instantly
    loadCachedStats();

    // 2️⃣ fetch fresh data only if online
    NetInfo.fetch().then(state => {
      if (state.isConnected) {
        loadStats();
      }
    });
  }, []);


  const loadStats = async () => {
    try {
      const res = await api.get('/super-admin/dashboard/stats');
      const data = res.data?.data;

      if (!data) return;

      setStats(data);

      // ✅ sync cache
      await AsyncStorage.setItem(
        DASHBOARD_CACHE_KEY,
        JSON.stringify(data),
      );
    } catch {
      console.warn('Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  };



  return (
    <View style={[styles.page, { backgroundColor: colors.bg }]}>
      <View style={styles.container}>
        {/* HEADER */}
        <Text style={[styles.title, { color: colors.text }]}>
          Super Admin Dashboard
        </Text>
        <Text style={[styles.subtitle, { color: colors.subText }]}>
          Manage your health monitoring app
        </Text>

        {/* STATS */}
        <View style={styles.statsRow}>
          <StatCard
            title="Total Clubs"
            value={stats.totalClubs}
            growth={stats.clubGrowth}
            icon="business-outline"
            accent={colors.blue}
            colors={colors}
            loading={loading}
          />
          <StatCard
            title="Total Podholders"
            value={stats.totalPodholders}
            growth={stats.podholderGrowth}
            icon="people-outline"
            accent={colors.green}
            colors={colors}
            loading={loading}
          />
          <StatCard
            title="Total Pods"
            value={stats.totalPods}
            growth={stats.podGrowth}
            icon="hardware-chip-outline"
            accent={colors.cyan}
            colors={colors}
            loading={loading}
          />
        </View>

        {/* QUICK ACTIONS */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Quick Actions
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.subText }]}>
          Manage key areas instantly
        </Text>

        <View style={styles.actionsGrid}>
          <QuickAction
            icon="business-outline"
            title="Club Management"
            desc="Create and manage clubs"
            onPress={() => onNavigate?.('ClubManagement')}
            colors={colors}
          />
          <QuickAction
            icon="people-outline"
            title="Podholder Management"
            desc="Manage podholders"
            onPress={() => onNavigate?.('PodholderManagement')}
            colors={colors}
          />
          <QuickAction
            icon="hardware-chip-outline"
            title="Pod Management"
            desc="Register and assign pods"
            onPress={() => onNavigate?.('PodManagement')}
            colors={colors}
          />
          <QuickAction
            icon="card-outline"
            title="Payments & Plans"
            desc="Subscriptions & billing"
            onPress={() => onNavigate?.('Payment')}
            colors={colors}
          />
          <QuickAction
            icon="help-circle-outline"
            title="Support Tickets"
            desc="Handle support requests"
            onPress={() => onNavigate?.('SupportTickets')}
            colors={colors}
          />
          <QuickAction
            icon="settings-outline"
            title="Settings"
            desc="System configuration"
            onPress={() => onNavigate?.('Settings')}
            colors={colors}
          />
        </View>
      </View>
    </View>
  );
};

export default DashboardScreen;

/* ================= COMPONENTS ================= */

const StatCard = ({
  title,
  value,
  growth,
  icon,
  accent,
  colors,
  loading,
}: any) => (
  <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <View style={styles.statHeader}>
      <Text style={[styles.statTitle, { color: colors.subText }]}>
        {title}
      </Text>
      <View style={[styles.iconBox, { backgroundColor: `${accent}22` }]}>
        <Ionicons name={icon} size={20} color={accent} />
      </View>
    </View>

    <Text style={[styles.statValue, { color: colors.text }]}>
      {loading ? '—' : value}
    </Text>

    <Text style={[styles.statTrend, { color: colors.green }]}>
      ↑ {growth || 0}% vs last month
    </Text>
  </View>
);

const QuickAction = ({
  icon,
  title,
  desc,
  onPress,
  colors,
}: any) => (
  <TouchableOpacity
    style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <View style={styles.actionIcon}>
      <Ionicons name={icon} size={22} color={colors.green} />
    </View>

    <View style={{ flex: 1 }}>
      <Text style={[styles.actionTitle, { color: colors.text }]}>
        {title}
      </Text>
      <Text style={[styles.actionDesc, { color: colors.subText }]}>
        {desc}
      </Text>
    </View>
  </TouchableOpacity>
);

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  page: { flex: 1 },
  container: { flex: 1, padding: 24 },

  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { marginTop: 6, fontSize: 14 },

  statsRow: {
    marginTop: 24,
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },

  statCard: {
    flex: 1,
    minWidth: 260,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },

  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  statTitle: {
    fontSize: 14,
    fontWeight: '600',
  },

  statValue: {
    marginTop: 12,
    fontSize: 30,
    fontWeight: '800',
  },

  statTrend: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
  },

  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionTitle: {
    marginTop: 36,
    fontSize: 18,
    fontWeight: '700',
  },

  sectionSubtitle: {
    marginTop: 4,
    fontSize: 13,
  },

  actionsGrid: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },

  actionCard: {
    width: '48%',
    flexDirection: 'row',
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },

  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },

  actionDesc: {
    marginTop: 4,
    fontSize: 12,
  },
});
