import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  TextInput,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../components/context/ThemeContext';
import { useAlert } from '../../components/context/AlertContext';
import PerformanceScreen from './PerformanceScreen';
import api from '../../api/axios';
import { db } from '../../db/sqlite';
import { STORAGE_KEYS } from '../../utils/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Props {
  openCreateEvent: () => void;
}

const EventsScreen: React.FC<Props> = ({ openCreateEvent }) => {
  const { theme } = useTheme();
  const { showAlert } = useAlert();
  const isDark = theme === 'dark';

  const [events, setEvents] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const formatDate = (val: any) => {
    if (!val) return '-';
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return '-';
  };

  const loadEvents = useCallback(async () => {
    try {
      const clubId = await AsyncStorage.getItem(STORAGE_KEYS.CLUB_ID);
      const res = await api.get('/events');
      const raw = res.data?.data ?? res.data;
      const list = Array.isArray(raw) ? raw : [];
      const filtered = clubId ? list.filter((e: any) => e.club_id === clubId) : list;

      const mapped = filtered.map((e: any) => ({
        session_id: e.sessionId || e.session_id || e.event_id,
        event_name: e.event_name || '-',
        event_type: e.event_type || '-',
        event_date: formatDate(e.event_date),
        location: e.location || '-',
        field: e.ground_name || e.field || '-',
      }));
      setEvents(mapped);
    } catch (err) {
      // Fallback to local
      try {
        const res = db.execute(`SELECT * FROM sessions ORDER BY created_at DESC`);
        const rows = (res as any)?.rows?._array || [];
        const mapped = rows.map((s: any) => ({
          session_id: s.session_id,
          event_name: s.event_name || 'Session',
          event_type: s.event_type || 'training',
          event_date: formatDate(s.event_date || s.created_at),
          location: s.location || '-',
          field: s.field || '-',
        }));
        setEvents(mapped);
      } catch (e) {
        setEvents([]);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  }, [loadEvents]);

  const filteredEvents = useMemo(() => {
    if (!search) return events;
    const q = search.toLowerCase();
    return events.filter(e =>
      e.event_name.toLowerCase().includes(q) ||
      e.location.toLowerCase().includes(q) ||
      e.event_type.toLowerCase().includes(q)
    );
  }, [events, search]);

  const toggleSession = (id: string) => {
    setSelectedSessions(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const renderEvent = ({ item }: { item: any }) => {
    const isSelected = selectedSessions.includes(item.session_id);
    return (
      <TouchableOpacity
        onPress={() => toggleSession(item.session_id)}
        activeOpacity={0.7}
      >
        <View style={[
          styles.card,
          {
            backgroundColor: isDark ? '#1e293b' : '#FFFFFF',
            borderColor: isSelected ? '#DC2626' : (isDark ? '#334155' : '#E5E7EB'),
            borderWidth: isSelected ? 2 : 1
          }
        ]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.name, { color: isDark ? '#fff' : '#000' }]} numberOfLines={1}>
              {item.event_name}
            </Text>
            <Ionicons
              name={isSelected ? "checkbox" : "square-outline"}
              size={24}
              color={isSelected ? '#DC2626' : (isDark ? '#94A3B8' : '#cbd5e1')}
            />
          </View>

          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: item.event_type?.toLowerCase().includes('match') ? 'rgba(245, 158, 11, 0.1)' : 'rgba(34, 197, 94, 0.1)' }]}>
              <Text style={[styles.badgeText, { color: item.event_type?.toLowerCase().includes('match') ? '#F59E0B' : '#22C55E' }]}>
                {item.event_type}
              </Text>
            </View>
            <Text style={[styles.line, { color: isDark ? '#94a3b8' : '#64748B', marginLeft: 8 }]}>
              {item.event_date}
            </Text>
          </View>

          <Text style={[styles.line, { color: isDark ? '#94a3b8' : '#334155' }]}>
            <Ionicons name="location-outline" size={14} /> {item.location} • {item.field}
          </Text>

          <View style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: isDark ? '#334155' : '#F1F5F9', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6 }}>
            <Text style={{ color: isDark ? '#fff' : '#475569', fontSize: 12, fontWeight: '600' }}>
              {isSelected ? 'Selected' : 'Click to select'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (showAnalysis) {
    return (
      <View style={{ flex: 1 }}>
        <View style={[styles.header, { backgroundColor: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? '#334155' : '#e5e7eb' }]}>
          <TouchableOpacity onPress={() => setShowAnalysis(false)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#000'} />
            <Text style={[styles.title, { color: isDark ? '#fff' : '#000', marginLeft: 12 }]}>Analysis</Text>
          </TouchableOpacity>
        </View>
        <PerformanceScreen />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#020617' : '#f5f7fa' }]}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>Compare Events</Text>
        <TouchableOpacity onPress={openCreateEvent} style={styles.btn}>
          <Text style={styles.btnText}>+ Add Event</Text>
        </TouchableOpacity>
      </View>

      {/* SEARCH */}
      <View style={[styles.searchContainer, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
        <Ionicons name="search" size={20} color={isDark ? '#94A3B8' : '#64748B'} />
        <TextInput
          placeholder="Search events, locations..."
          placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
          style={[styles.searchInput, { color: isDark ? '#FFF' : '#000' }]}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filteredEvents}
        keyExtractor={e => String(e.session_id)}
        renderItem={renderEvent}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#DC2626" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={64} color={isDark ? '#334155' : '#cbd5e1'} />
            <Text style={[styles.emptyText, { color: isDark ? '#64748B' : '#94a3b8' }]}>No events found</Text>
          </View>
        }
      />

      {/* FOOTER ACTION */}
      {selectedSessions.length > 0 && (
        <TouchableOpacity
          style={styles.compareFab}
          onPress={() => setShowAnalysis(true)}
        >
          <Ionicons name="stats-chart" size={24} color="#fff" />
          <Text style={styles.compareFabText}>Compare {selectedSessions.length} Events</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default EventsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    height: 56,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  btn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  line: {
    fontSize: 14,
    marginTop: 4,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  compareFab: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 30,
    elevation: 8,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    gap: 12,
  },
  compareFabText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
});

