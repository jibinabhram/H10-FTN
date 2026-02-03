import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  Modal,
  RefreshControl,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import api from '../../api/axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import { useTheme } from '../../components/context/ThemeContext';
import { generateClubPdf } from '../../utils/clubPdf';

/* ================= TYPES ================= */
interface Club {
  club_id: string;
  club_name: string;
  address?: string;
  sport?: string;

  admin?: {
    name?: string;
    email?: string;
    phone?: string;
    temp_password?: string;
  };

  pod_holders?: any[];

  pods_count: number;
  total_pods?: number;
  podholders_count: number;

  status: 'ACTIVE' | 'INACTIVE';
}


interface Props {
  openCreateClub: () => void;
}

/* ================= CONSTANTS ================= */
const PAGE_SIZE = 10;

const COL = {
  club: 2,
  sport: 1,
  admin: 1.2,
  pods: 0.8,
  podholders: 1.1,
  status: 1.3,
  actions: 1,
};

const ClubManagementScreen = ({ openCreateClub }: Props) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [clubs, setClubs] = useState<Club[]>([]);
  const [visible, setVisible] = useState<Club[]>([]);
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [filter, setFilter] =
    useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [filterOpen, setFilterOpen] = useState(false);

  const [statusModal, setStatusModal] = useState<Club | null>(null);

  /* ================= THEME COLORS ================= */
  const bg = isDark ? '#020617' : '#F8FAFC';
  const card = isDark ? '#0F172A' : '#FFFFFF';
  const text = isDark ? '#E5E7EB' : '#020617';
  const muted = '#64748B';
  const border = isDark ? '#1E293B' : '#E2E8F0';



  const CLUBS_CACHE_KEY = 'clubs_management_cache';

  /* ================= LOAD CLUBS ================= */
  const loadClubs = async () => {
    try {
      const res = await api.get('/clubs');

      const rawList = Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
        ? res.data
        : [];

      const normalized: Club[] = rawList.map((club: any) => ({
        club_id: club.club_id,
        club_name: club.club_name,
        address: club.address,
        sport: club.sport,
        admin: club.admin,
        pod_holders: club.pod_holders,

        pods_count: Number(club.pods_count ?? club.total_pods ?? 0),
        total_pods: Number(club.total_pods ?? club.pods_count ?? 0),
        podholders_count: Number(club.podholders_count ?? 0),

        status:
          club.status?.toUpperCase() === 'INACTIVE'
            ? 'INACTIVE'
            : 'ACTIVE',
      }));



      setClubs(normalized);
      setVisible(normalized.slice(0, PAGE_SIZE));
      setPage(1);

      // ✅ keep cache in sync
      await AsyncStorage.setItem(
        CLUBS_CACHE_KEY,
        JSON.stringify(normalized),
      );

      setPage(1);
    } catch (err) {
      console.error('LOAD CLUBS FAILED', err);
      Alert.alert('Error', 'Failed to load clubs');
    }
  };

    const onRefresh = async () => {
      try {
        setRefreshing(true);
        setPage(1);
        await loadClubs();
      } finally {
        setRefreshing(false);
      }
    };

  const loadCachedClubs = async () => {
    try {
      const cached = await AsyncStorage.getItem(CLUBS_CACHE_KEY);
      if (!cached) return;

      const parsed: Club[] = JSON.parse(cached);
      setClubs(parsed);
      setVisible(parsed.slice(0, PAGE_SIZE));
      setPage(1);
    } catch {
      await AsyncStorage.removeItem(CLUBS_CACHE_KEY);
    }
  };

  useEffect(() => {
    // 1️⃣ instant offline render
    loadCachedClubs();

    // 2️⃣ refresh only if online
    NetInfo.fetch().then(state => {
      if (state.isConnected) {
        loadClubs();
      }
    });
  }, []);


  /* ================= FILTER ================= */
  const filtered = useMemo(() => {
    return clubs.filter(c => {
      const nameOk = c.club_name
        .toLowerCase()
        .includes(search.toLowerCase());
      const statusOk =
        filter === 'ALL' ? true : c.status === filter;
      return nameOk && statusOk;
    });
  }, [clubs, search, filter]);

  useEffect(() => {
    setVisible(filtered.slice(0, PAGE_SIZE));
    setPage(1);
  }, [filtered]);

  /* ================= PAGINATION ================= */
  const loadMore = () => {
    const next = filtered.slice(0, (page + 1) * PAGE_SIZE);
    if (next.length > visible.length) {
      setVisible(next);
      setPage(p => p + 1);
    }
  };

  /* ================= STATUS CHANGE ================= */
  const confirmStatusChange = async () => {
    if (!statusModal) return;

    // 🔌 CHECK INTERNET FIRST
    const net = await NetInfo.fetch();

    if (!net.isConnected) {
      Alert.alert(
        'No Internet',
        'Internet connection is required to update club status.',
      );
      return;
    }

    const nextStatus =
      statusModal.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    try {
      await api.patch(
        `/clubs/${statusModal.club_id}/status`,
        { status: nextStatus },
      );

      setClubs(prev => {
        const updated = prev.map(c =>
          c.club_id === statusModal.club_id
            ? { ...c, status: nextStatus }
            : c,
        );

        AsyncStorage.setItem(
          CLUBS_CACHE_KEY,
          JSON.stringify(updated),
        );

        setVisible(updated.slice(0, page * PAGE_SIZE));
        return updated;
      });

      setStatusModal(null);

    } catch (err) {
      Alert.alert(
        'Update Failed',
        'Unable to update status. Please try again.',
      );
    }
  };



  /* ================= ACTIONS ================= */
  const deleteClub = async (club: Club) => {
    const net = await NetInfo.fetch();

    // 🚫 BLOCK OFFLINE DELETE
    if (!net.isConnected) {
      Alert.alert(
        'No Internet',
        'Internet connection is required to delete a club.',
      );
      return;
    }

    Alert.alert('Delete Club', `Delete ${club.club_name}?`, [
      { text: 'Cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/clubs/${club.club_id}`);

            setClubs(prev => {
              const updated = prev.filter(
                c => c.club_id !== club.club_id,
              );

              AsyncStorage.setItem(
                CLUBS_CACHE_KEY,
                JSON.stringify(updated),
              );

              setVisible(updated.slice(0, PAGE_SIZE));
              return updated;
            });
          } catch (e) {
            Alert.alert(
              'Delete Failed',
              'Unable to delete club. Please try again.',
            );
          }
        },
      },
    ]);
  };


  const downloadPdf = async (club: Club) => {
    try {
      await generateClubPdf(club);
    } catch (e) {
      console.error('PDF error', e);
      Alert.alert('Error', 'Failed to generate PDF');
    }
  };



  /* ================= TABLE HEADER ================= */
  const TableHeader = () => (
    <View
      style={[
        styles.row,
        styles.header,
        { backgroundColor: card, borderColor: border },
      ]}
    >
      <Text style={[styles.th, { flex: COL.club }]}>Club</Text>
      <Text style={[styles.th, { flex: COL.sport }]}>Sport</Text>
      <Text style={[styles.th, { flex: COL.admin }]}>Admin</Text>
      <Text style={[styles.th, { flex: COL.pods }]}>Pods</Text>
      <Text style={[styles.th, { flex: COL.podholders }]}>
        Podholders
      </Text>
      <View style={[styles.headerCenter, { flex: COL.status }]}>
        <Text style={styles.th}>Status</Text>
      </View>
      <View style={[styles.headerCenter, { flex: COL.actions }]}>
        <Text style={styles.th}>Actions</Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* HEADER */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.title, { color: text }]}>
            Club Management
          </Text>
          <Text style={{ color: muted }}>
            Manage clubs and configurations
          </Text>
        </View>

        <TouchableOpacity style={styles.createBtn} onPress={openCreateClub}>
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={styles.createText}>Create Club</Text>
        </TouchableOpacity>
      </View>

      {/* SEARCH + FILTER */}
      <View style={styles.filterRow}>
        <View
          style={[
            styles.searchBox,
            { backgroundColor: card, borderColor: border },
          ]}
        >
          <Ionicons name="search" size={16} color={muted} />
          <TextInput
            placeholder="Search club..."
            placeholderTextColor={muted}
            value={search}
            onChangeText={setSearch}
            style={[styles.searchInput, { color: text }]}
          />
        </View>

        <View>
          <TouchableOpacity
            style={[
              styles.filterBtn,
              { backgroundColor: card, borderColor: border },
            ]}
            onPress={() => setFilterOpen(!filterOpen)}
          >
            <Text style={{ fontWeight: '700', color: text }}>
              {filter}
            </Text>
            <Ionicons name="chevron-down" size={14} color={text} />
          </TouchableOpacity>

          {filterOpen && (
            <View
              style={[
                styles.dropdown,
                { backgroundColor: card, borderColor: border },
              ]}
            >
              {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map(v => (
                <TouchableOpacity
                  key={v}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setFilter(v);
                    setFilterOpen(false);
                  }}
                >
                  <Text style={{ color: text }}>{v}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* LIST */}
      <FlatList
        data={visible}
        keyExtractor={i => i.club_id}
        stickyHeaderIndices={[0]}
        ListHeaderComponent={TableHeader}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        renderItem={({ item }) => (
          <View
            style={[
              styles.row,
              { backgroundColor: card, borderColor: border },
            ]}
          >
            <Text style={[styles.cell, { flex: COL.club, color: text }]}>
              {item.club_name}
            </Text>
            <Text style={[styles.cell, { flex: COL.sport, color: text }]}>
              {item.sport}
            </Text>
            <Text style={[styles.cell, { flex: COL.admin, color: text }]}>
              {item.admin?.name ?? '-'}

            </Text>
            <Text style={[styles.cell, { flex: COL.pods, color: text }]}>
              {item.pods_count}
            </Text>
            <Text
              style={[styles.cell, { flex: COL.podholders, color: text }]}
            >
              {item.podholders_count}
            </Text>

            {/* STATUS */}
            <View style={[styles.statusCell, { flex: COL.status }]}>
              <View
                style={[
                  styles.statusPill,
                  item.status === 'ACTIVE'
                    ? styles.active
                    : styles.inactive,
                ]}
              >
                <Text
                  style={
                    item.status === 'ACTIVE'
                      ? styles.activeText
                      : styles.inactiveText
                  }
                >
                  {item.status}
                </Text>
              </View>

              <TouchableOpacity onPress={() => setStatusModal(item)}>
                <Ionicons name="pencil" size={16} color={muted} />
              </TouchableOpacity>
            </View>

            {/* ACTIONS */}
            <View style={[styles.actions, { flex: COL.actions }]}>
              <TouchableOpacity onPress={() => downloadPdf(item)}>
                <Ionicons name="download" size={18} color="#2563EB" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteClub(item)}>
                <Ionicons name="trash" size={18} color="#DC2626" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* STATUS CONFIRM BOX */}
      {statusModal && (
        <View style={styles.overlay}>
          <View style={[styles.modalCard, { backgroundColor: card }]}>
            {/* TITLE */}
            <Text style={[styles.modalTitle, { color: text }]}>
              Change Status
            </Text>

            {/* ONE LINE MESSAGE */}
            <Text style={{ color: muted, marginBottom: 24 }}>
              Change status from{' '}
              <Text style={{ fontWeight: '700', color: text }}>
                {statusModal.status}
              </Text>{' '}
              to{' '}
              <Text style={{ fontWeight: '700', color: text }}>
                {statusModal.status === 'ACTIVE'
                  ? 'INACTIVE'
                  : 'ACTIVE'}
              </Text>
              ?
            </Text>

            {/* BUTTONS */}
            <View style={styles.modalActions}>
              {/* LEFT – CANCEL */}
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setStatusModal(null)}
                activeOpacity={0.8}
              >

                <Text style={styles.cancelText}>
                    Cancel
                  </Text>
              </TouchableOpacity>

              {/* RIGHT – CONFIRM */}
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={confirmStatusChange}
              >
                <Text style={styles.confirmText}>
                  Confirm
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}


    </View>
  );
};

export default ClubManagementScreen;

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerCenter: { alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800' },

  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    padding: 10,
    borderRadius: 10,
    gap: 6,
  },
  createText: { color: '#fff', fontWeight: '700' },

  filterRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  searchInput: { flex: 1, marginLeft: 6 },

  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },

  dropdown: {
    position: 'absolute',
    top: 44,
    right: 0,
    borderWidth: 1,
    borderRadius: 8,
    zIndex: 50,
  },
  dropdownItem: { padding: 10, width: 100 },

  row: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    alignItems: 'center',
  },
  header: { marginBottom: 6 },

  th: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  cell: { fontSize: 13 },

  actions: { flexDirection: 'row', justifyContent: 'space-around' },

  statusCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  active: { backgroundColor: '#DCFCE7' },
  inactive: { backgroundColor: '#FEE2E2' },
  activeText: { color: '#15803D', fontWeight: '700' },
  inactiveText: { color: '#B91C1C', fontWeight: '700' },

  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    padding: 24,
    borderRadius: 14,
    width: 360,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155', // slate border
    backgroundColor: 'transparent',
  },

  cancelText: {
    fontWeight: '700',
    color: '#CBD5E1', // light slate for dark UI
  },

  confirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#2563EB',
  },

  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },

  confirmText: { color: '#fff', fontWeight: '700' },
});
