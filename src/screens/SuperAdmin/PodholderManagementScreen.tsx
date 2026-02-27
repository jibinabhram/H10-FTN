import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  FlatList,
  Modal,
  useWindowDimensions,
  Pressable,
  Alert,
  ScrollView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { exportPodholdersCsv } from '../../utils/exportPodholdersCsv';
import api from '../../api/axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { getAvailablePods, createPodHolder } from '../../api/pods';
import RegisterPodholderModal from '../../components/Podholder/RegisterPodholderModal';
import PodholderDetailModal from './PodholderDetailModal';
import { useTheme } from '../../components/context/ThemeContext';
import { useAlert } from '../../components/context/AlertContext';

/* ================= TYPES ================= */

type PodStatus =
  | 'ALL'
  | 'ASSIGNED'
  | 'ACTIVE'
  | 'MAINTENANCE'
  | 'REPAIRED'
  | 'DAMAGED';

type PodHolder = {
  pod_holder_id: string;
  serial_number: string | null;
  device_id: string | null;
  club?: {
    club_id: string;
    club_name: string;
  } | null;

  pods?: { lifecycle_status: PodStatus }[];
};


type Pod = {
  pod_id: string;
  serial_number: string;
  lifecycle_status: 'ACTIVE' | 'MAINTENANCE' | 'REPAIRED';
};




type Club = {
  club_id: string;
  club_name: string;
};


const CARD_COLORS = {
  light: {
    ASSIGNED: { bg: '#DCFCE7', text: '#16A34A' },
    ACTIVE: { bg: '#E5E7EB', text: '#6B7280' },
    MAINTENANCE: { bg: '#FFEDD5', text: '#EA580C' },
    DAMAGED: { bg: '#FEE2E2', text: '#DC2626' },
  },
  dark: {
    ASSIGNED: { bg: '#052E16', text: '#4ADE80' },
    ACTIVE: { bg: '#1F2933', text: '#9CA3AF' },
    MAINTENANCE: { bg: '#431407', text: '#FDBA74' },
    DAMAGED: { bg: '#450A0A', text: '#FCA5A5' },
  },
};



/* ================= STATUS CONFIG ================= */

const STATUS_LABEL: Record<Exclude<PodStatus, 'ALL'>, string> = {
  ASSIGNED: 'Assigned',
  ACTIVE: 'Unassigned',
  MAINTENANCE: 'Under Repair',
  REPAIRED: 'Repaired',
  DAMAGED: 'Lost / Damaged',
};


const STATUS_BG: Record<Exclude<PodStatus, 'ALL'>, string> = {
  ASSIGNED: '#DCFCE7',
  ACTIVE: '#E5E7EB',
  MAINTENANCE: '#FFEDD5',
  REPAIRED: '#FFEDD5',
  DAMAGED: '#FEE2E2',
};


const STATUS_TEXT: Record<Exclude<PodStatus, 'ALL'>, string> = {
  ASSIGNED: '#16A34A',
  ACTIVE: '#6B7280',
  MAINTENANCE: '#EA580C',
  REPAIRED: '#EA580C',
  DAMAGED: '#DC2626',
};


/* ================= HELPERS ================= */

const getStatus = (h: PodHolder): Exclude<PodStatus, 'ALL'> => {
  const pods = h.pods ?? [];

  if (pods.some(p => p.lifecycle_status === 'DAMAGED')) return 'DAMAGED';
  if (pods.some(p => p.lifecycle_status === 'REPAIRED')) return 'REPAIRED'; // higher priority
  if (pods.some(p => p.lifecycle_status === 'MAINTENANCE')) return 'MAINTENANCE';
  if (h.club) return 'ASSIGNED';
  return 'ACTIVE';

};



const COL = {
  SNO: 0.6,
  SERIAL: 2.2,
  MODEL: 1.4,
  STATUS: 1.8,
  ASSIGNED: 2.2,
  ACTION: 1,
};


const PODHOLDERS_CACHE_KEY = 'podholders_management_cache';



/* ================= SCREEN ================= */

const PodholderManagementScreen = () => {
  const { theme } = useTheme();
  const { showAlert } = useAlert();
  const { width } = useWindowDimensions();
  const isCompact = width < 900;
  const colors =
    theme === 'dark'
      ? {
        bg: '#020617',
        card: '#020617',
        text: '#E5E7EB',
        border: '#1E293B',
        muted: '#94A3B8',
      }
      : {
        bg: '#F9FAFB',
        card: '#FFFFFF',
        text: '#0F172A',
        border: '#E5E7EB',
        muted: '#64748B',
      };

  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PodStatus>('ALL');
  const [showFilter, setShowFilter] = useState(false);

  const [podholders, setPodholders] = useState<PodHolder[]>([]);
  const [availablePods, setAvailablePods] = useState<Pod[]>([]);
  const [selected, setSelected] = useState<PodHolder | null>(null);
  const [openRegister, setOpenRegister] = useState(false);

  const [editHolder, setEditHolder] = useState<PodHolder | null>(null);
  const [editType, setEditType] = useState<'STATUS' | 'CLUB' | null>(null);
  const [confirmValue, setConfirmValue] = useState<string | null>(null);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [confirming, setConfirming] = useState(false);



  /* ---------- LOAD DATA ---------- */

  const loadCachedPodholders = async () => {
    try {
      const cached = await AsyncStorage.getItem(PODHOLDERS_CACHE_KEY);
      if (!cached) return;

      const parsed: PodHolder[] = JSON.parse(cached);
      setPodholders(parsed);
    } catch (e) {
      console.warn('Invalid podholder cache, clearing');
      await AsyncStorage.removeItem(PODHOLDERS_CACHE_KEY);
    }
  };


  const loadClubs = async () => {
    // 🌐 CHECK INTERNET FIRST
    const net = await NetInfo.fetch();

    if (!net.isConnected) {
      showAlert({
        title: 'No Internet Connection',
        message: 'Internet is required to load clubs.',
        type: 'error',
      });
      return;
    }

    try {
      const res = await api.get('/clubs');

      const normalized: Club[] = (res.data?.data ?? []).map((c: any) => ({
        club_id: c.club_id,
        club_name: c.club_name,
      }));

      setClubs(normalized);
    } catch (err) {
      console.error('Failed to load clubs', err);

      showAlert({
        title: 'Failed to Load Clubs',
        message: 'Something went wrong. Please try again.',
        type: 'error',
      });

      setClubs([]);
    }
  };




  const loadAvailablePods = async () => {
    try {
      const pods = await getAvailablePods();


      const normalized = pods.map((p: any) => ({
        pod_id: p.pod_id,
        serial_number: p.serial_number,
        lifecycle_status: p.lifecycle_status,
      }));

      setAvailablePods(normalized);
    } catch (err) {
      console.error('Failed to load available pods', err);
      setAvailablePods([]);
    }
  };



  const loadPodholders = async () => {
    try {
      setLoading(true);

      const res = await api.get('/pod-holders');
      const data = res.data?.data ?? [];

      setPodholders(data);

      // ✅ keep cache in sync
      await AsyncStorage.setItem(
        PODHOLDERS_CACHE_KEY,
        JSON.stringify(data),
      );
    } catch (err) {
      console.error('Failed to load podholders', err);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    // 1️⃣ Load cached data instantly
    loadCachedPodholders();

    // 2️⃣ Fetch fresh data only if online
    NetInfo.fetch().then(state => {
      if (state.isConnected) {
        loadPodholders();
      }
    });
  }, []);




  useEffect(() => {
    if (editType === 'CLUB') {
      loadClubs();
    }
  }, [editType]);



  const confirmChange = async () => {
    if (confirming) return;
    if (!editHolder || !confirmValue) return;

    // 🔌 CHECK INTERNET FIRST
    const net = await NetInfo.fetch();

    if (!net.isConnected) {
      showAlert({
        title: 'No Internet Connection',
        message: 'Internet is required to update podholder details.',
        type: 'error',
      });
      return;
    }

    try {
      setConfirming(true);

      if (editType === 'CLUB') {
        await api.patch(
          `/pod-holders/${editHolder.pod_holder_id}/assign/${confirmValue}`,
        );
      }

      if (editType === 'STATUS') {
        await api.patch(
          `/pod-holders/${editHolder.pod_holder_id}/status`,
          { status: confirmValue },
        );
      }

      // ✅ UPDATE UI + CACHE ONLY AFTER SUCCESS
      setPodholders(prev => {
        const updated = prev.map(h =>
          h.pod_holder_id === editHolder.pod_holder_id
            ? editType === 'CLUB'
              ? {
                ...h,
                club: {
                  club_id: confirmValue,
                  club_name:
                    clubs.find(c => c.club_id === confirmValue)?.club_name ??
                    h.club?.club_name ??
                    '',
                },
              }
              : {
                ...h,
                pods: [{ lifecycle_status: confirmValue as PodStatus }],
              }
            : h
        );

        AsyncStorage.setItem(
          PODHOLDERS_CACHE_KEY,
          JSON.stringify(updated),
        );

        return updated;
      });

    } catch (err) {
      showAlert({
        title: 'Update Failed',
        message: 'Unable to update. Please try again.',
        type: 'error',
      });
    } finally {
      setConfirming(false);
      setEditHolder(null);
      setEditType(null);
      setConfirmValue(null);
    }
  };






  /* ---------- COUNTS ---------- */

  const counts = useMemo(() => {
    const s = podholders.map(getStatus);
    return {
      assigned: s.filter(x => x === 'ASSIGNED').length,
      unassigned: s.filter(x => x === 'ACTIVE').length,
      repair: s.filter(x => x === 'MAINTENANCE').length,
      repaired: s.filter(x => x === 'REPAIRED').length,
      damaged: s.filter(x => x === 'DAMAGED').length,
    };
  }, [podholders]);

  /* ---------- FILTERING ---------- */

  const filtered = podholders.filter(h => {
    const matchesSearch =
      `${h.serial_number ?? ''} ${h.device_id ?? ''}`
        .toLowerCase()
        .includes(search.toLowerCase());

    const status = getStatus(h);
    const matchesStatus =
      statusFilter === 'ALL' || status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  /* ---------- PAGINATION ---------- */

  const ITEMS_PER_PAGE = 10;
  const [page, setPage] = useState(1);

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / ITEMS_PER_PAGE)
  );

  const paginated = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);


  /* ================= RENDER ================= */

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          Podholder Management
        </Text>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >





          {/* REGISTER */}
          <TouchableOpacity
            style={styles.registerBtn}
            onPress={async () => {
              await loadAvailablePods();
              setOpenRegister(true);
            }}
          >
            <Text style={styles.registerText}>Register</Text>
          </TouchableOpacity>
        </View>
      </View>


      {/* COUNT CARDS */}
      <View style={[styles.cards, { flexWrap: 'wrap' }]}>

        <CountCard label="Assigned" value={counts.assigned} bg="#DCFCE7" color="#16A34A" />
        <CountCard label="Unassigned" value={counts.unassigned} bg="#E5E7EB" color="#6B7280" />
        <CountCard label="Under Repair" value={counts.repair} bg="#FFEDD5" color="#EA580C" />
        <CountCard label="Lost / Damaged" value={counts.damaged} bg="#FEE2E2" color="#DC2626" />
      </View>

      {/* SEARCH + FILTER */}
      <View style={styles.searchRow}>
        <View style={[styles.search, { borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            placeholder="Search clubs..."
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>

        <TouchableOpacity
          style={[styles.filterBtn, { borderColor: colors.border }]}
          onPress={() => setShowFilter(true)}
        >
          <Ionicons name="filter" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* TABLE HEADER */}

      {/* ===== FIXED TABLE HEADER (DESKTOP ONLY) ===== */}
      {!isCompact && !loading && (
        <View
          style={[
            styles.tableHeader,
            {
              borderColor: colors.border,
              backgroundColor: colors.card,
            },
          ]}
        >
          <Text style={[styles.th, { flex: COL.SNO, color: colors.muted }]}>
            S.No
          </Text>
          <Text style={[styles.th, { flex: COL.SERIAL, color: colors.muted }]}>
            Serial Number
          </Text>
          <Text
            style={[
              styles.th,
              {
                flex: COL.MODEL,
                color: colors.muted,
                paddingLeft: 8,
                textAlign: 'left',
              },
            ]}
          >
            Device ID
          </Text>

          <Text
            style={[
              styles.th,
              {
                flex: COL.STATUS,
                color: colors.muted,
                paddingLeft: 66,
                textAlign: 'left',
              },
            ]}
          >
            Status
          </Text>

          <Text style={[styles.th, { flex: COL.ASSIGNED, color: colors.muted }]}>
            Assigned To
          </Text>
          <Text
            style={[
              styles.th,
              { flex: COL.ACTION, color: colors.muted, textAlign: 'center' },
            ]}
          >
            Action
          </Text>
        </View>
      )}





      {/* ================= LIST ================= */}
      <View style={{ flex: 1 }}>
        {loading ? (
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <ActivityIndicator size="large" />
          </View>
        ) : isCompact ? (
          /* ================= MOBILE / COMPACT CARD VIEW ================= */
          <FlatList
            data={paginated}

            keyExtractor={item => item.pod_holder_id}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
            style={{ flex: 1 }}
            renderItem={({ item }) => {
              const status = getStatus(item);

              return (
                <View
                  style={[
                    styles.cardItem,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  {/* Header */}
                  <View style={styles.cardHeader}>
                    <Text style={[styles.cardSerial, { color: colors.text }]}>
                      {item.serial_number ?? '-'}
                    </Text>

                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: STATUS_BG[status] },
                      ]}
                    >
                      <Text style={{ color: STATUS_TEXT[status], fontSize: 12 }}>
                        {STATUS_LABEL[status]}
                      </Text>
                    </View>
                  </View>

                  {/* Body */}
                  <Text style={[styles.cardText, { color: colors.muted }]}>
                    Device ID:{' '}
                    <Text style={{ color: colors.text }}>
                      {item.device_id ?? '-'}
                    </Text>
                  </Text>


                  <Text style={[styles.cardText, { color: colors.muted }]}>
                    Assigned To:{' '}
                    <Text style={{ color: colors.text }}>
                      {item.club?.club_name ?? '-'}
                    </Text>
                  </Text>

                  {/* Actions */}
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      onPress={() => {
                        setEditHolder(item);
                        setEditType('STATUS');
                        setConfirmValue(null);
                      }}
                    >
                      <Ionicons name="pencil-outline" size={18} color="#DC2626" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={async () => {
                        setEditHolder(item);
                        setConfirmValue(null);

                        if (clubs.length === 0) {
                          await loadClubs();
                        }

                        if (item.club?.club_id) {
                          setConfirmValue(item.club.club_id);
                        }

                        setEditType('CLUB');
                      }}


                    >
                      <Ionicons
                        name="business-outline"
                        size={18}
                        color="#DC2626"
                      />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setSelected(item)}>
                      <Text style={styles.viewText}>View</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        ) : (
          /* ================= DESKTOP / TABLE VIEW ================= */
          <FlatList
            data={paginated}
            keyExtractor={item => item.pod_holder_id}
            extraData={theme}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}

            /*  THIS LINE FIXES HEADER SCROLLING */



            renderItem={({ item, index }) => {
              const status = getStatus(item);

              return (
                <View style={[styles.row, { borderColor: colors.border }]}>
                  <Text style={[styles.td, { flex: COL.SNO, color: colors.text }]}>
                    {(page - 1) * ITEMS_PER_PAGE + index + 1}

                  </Text>

                  <Text
                    style={[styles.td, { flex: COL.SERIAL, color: colors.text }]}
                  >
                    {item.serial_number ?? '-'}
                  </Text>

                  <Text
                    style={[styles.td, { flex: COL.MODEL, color: colors.text }]}
                  >
                    {item.device_id ?? '-'}
                  </Text>

                  <View style={{ flex: COL.STATUS }}>
                    <View style={styles.statusInner}>
                      <View
                        style={[
                          styles.badge,
                          styles.statusBadge,
                          { backgroundColor: STATUS_BG[status] },
                        ]}
                      >
                        <Text style={{ color: STATUS_TEXT[status], fontSize: 12 }}>
                          {STATUS_LABEL[status]}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={styles.editIcon}
                        onPress={() => {
                          setEditHolder(item);
                          setEditType('STATUS');
                          setConfirmValue(null);
                        }}
                      >
                        <Ionicons
                          name="pencil-outline"
                          size={16}

                          color="#DC2626"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={[styles.assignedCell, { flex: COL.ASSIGNED }]}>
                    <Text
                      style={[
                        styles.td,
                        styles.assignedText,
                        { color: item.club ? colors.text : colors.muted },
                      ]}
                    >
                      {item.club?.club_name ?? '-'}
                    </Text>

                    <TouchableOpacity
                      onPress={async () => {
                        setEditHolder(item);
                        setConfirmValue(null);

                        if (clubs.length === 0) {
                          await loadClubs();
                        }

                        if (item.club?.club_id) {
                          setConfirmValue(item.club.club_id);
                        }

                        setEditType('CLUB');
                      }}



                    >
                      <Ionicons
                        name="pencil-outline"
                        size={16}
                        color="#DC2626"
                      />
                    </TouchableOpacity>
                  </View>

                  <View
                    style={{
                      flex: COL.ACTION,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {/* EXPORT SINGLE PODHOLDER */}
                    <TouchableOpacity
                      style={styles.rowExportBtn}
                      onPress={() => exportPodholdersCsv([item])}
                    >
                      <Ionicons
                        name="download-outline"
                        size={16}
                        color="#DC2626"
                      />
                    </TouchableOpacity>

                    {/* SPACE */}
                    <View style={{ width: 12 }} />

                    {/* VIEW */}
                    <TouchableOpacity onPress={() => setSelected(item)}>
                      <Text style={styles.viewText}>View</Text>
                    </TouchableOpacity>
                  </View>

                </View>
              );
            }}
          />
        )}
      </View>

      {/* ===== PAGINATION ===== */}
      {!loading && totalPages > 1 && (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: 12,
            gap: 16,
          }}
        >
          <TouchableOpacity
            disabled={page === 1}
            onPress={() => setPage(p => Math.max(1, p - 1))}
          >
            <Text
              style={{
                color: page === 1 ? colors.muted : '#DC2626',
                fontWeight: '600',
              }}
            >
              Prev
            </Text>
          </TouchableOpacity>

          {/* PAGE INFO */}
          <Text
            style={{
              color: colors.text,
              fontWeight: '600',
            }}
          >
            Page {page} / {totalPages}
          </Text>

          {/* NEXT */}
          <TouchableOpacity
            disabled={page === totalPages}
            onPress={() => setPage(p => Math.min(totalPages, p + 1))}
          >
            <Text
              style={{
                color: page === totalPages ? colors.muted : '#DC2626',
                fontWeight: '600',
              }}
            >
              Next
            </Text>
          </TouchableOpacity>
        </View>
      )}



      {/* FILTER MODAL */}
      <Modal visible={showFilter} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.filterCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.filterTitle, { color: colors.text }]}>
              Filter by Status
            </Text>

            {(['ALL', 'ASSIGNED', 'ACTIVE', 'MAINTENANCE', 'REPAIRED', 'DAMAGED'] as PodStatus[]).map(s => (
              <TouchableOpacity
                key={s}
                style={styles.filterOption}
                onPress={() => {
                  setStatusFilter(s);
                  setShowFilter(false);
                }}
              >
                <Text style={{ color: colors.text }}>
                  {s === 'ALL' ? 'All' : STATUS_LABEL[s]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>




      {/* CONFIRM STATUS / CLUB CHANGE */}
      <Modal visible={!!editType && !!editHolder} transparent animationType="fade">
        <View style={styles.modalBackdrop}>

          {/* Backdrop */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              setEditType(null);
              setConfirmValue(null);
            }}
          />

          {/* Card */}
          <View
            style={[
              styles.confirmCard,
              { backgroundColor: theme === 'dark' ? '#020617' : '#FFFFFF' },
            ]}
          >



            <Text style={[styles.confirmTitle, { color: colors.text }]}>
              Confirm Change
            </Text>


            {/* OPTIONS */}
            <View style={styles.optionList}>
              {editType === 'STATUS' && (
                <>
                  {(['ACTIVE', 'MAINTENANCE', 'REPAIRED', 'DAMAGED'] as const).map(s => (
                    <TouchableOpacity
                      key={`status-${s}`}
                      style={[
                        styles.optionItem,
                        confirmValue === s && styles.optionSelected,
                      ]}
                      onPress={() => setConfirmValue(s)}
                    >
                      <Text style={{ color: colors.text }}>
                        {STATUS_LABEL[s]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}



              {editType === 'CLUB' && (
                <>
                  {clubs.filter(c => c.club_id).length === 0 ? (
                    <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 8 }}>
                      No clubs available
                    </Text>
                  ) : (
                    clubs
                      .filter(c => c.club_id)
                      .map(c => (
                        <TouchableOpacity
                          key={`club-${c.club_id}`}
                          style={[
                            styles.optionItem,
                            confirmValue === c.club_id && styles.optionSelected,
                          ]}
                          onPress={() => setConfirmValue(c.club_id)}
                        >
                          <Text style={{ color: colors.text }}>
                            {c.club_name}
                          </Text>
                        </TouchableOpacity>
                      ))
                  )}
                </>
              )}


            </View>

            {/* ACTION BUTTONS */}
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setEditType(null);
                  setConfirmValue(null);
                }}
              >
                <Text style={[styles.cancelText, { color: '#EF4444' }]}>
                  Cancel
                </Text>

              </TouchableOpacity>

              <TouchableOpacity

                disabled={!confirmValue || confirming}

                onPress={() => {
                  console.log('CONFIRM BUTTON PRESSED', {
                    confirmValue,
                    editHolder,
                    editType,
                  });

                  if (!confirmValue || !editHolder) {
                    console.warn('Blocked confirm click', { confirmValue, editHolder });
                    return;
                  }

                  confirmChange();
                }}

                style={[
                  styles.confirmBtn,
                  {
                    backgroundColor: confirmValue
                      ? theme === 'dark'
                        ? '#16A34A'   // solid green (dark mode)
                        : '#DCFCE7'   // light green (light mode)
                      : theme === 'dark'
                        ? '#064E3B'
                        : '#E5E7EB',
                  },
                ]}
              >
                <Text
                  style={{
                    color: theme === 'dark' ? '#FFFFFF' : '#16A34A',
                    fontWeight: '700',
                  }}
                >
                  Confirm
                </Text>
              </TouchableOpacity>

            </View>
          </View>
        </View>
      </Modal>



      {/* DETAIL */}
      <PodholderDetailModal
        visible={!!selected}
        podHolder={selected}
        onClose={() => setSelected(null)}
      />

      {/* REGISTER */}
      <RegisterPodholderModal
        visible={openRegister}
        pods={availablePods as any}
        onClose={() => setOpenRegister(false)}
        onRegister={async payload => {
          try {
            console.log('📤 REGISTER PODHOLDER PAYLOAD:', payload);

            if (!payload.podIds || payload.podIds.length === 0) {
              showAlert({
                title: 'Selection Required',
                message: 'Select at least one pod',
                type: 'warning',
              });
              return;
            }

            await createPodHolder({
              podIds: payload.podIds,
            } as any);

            setOpenRegister(false);

            // reload API + cache
            loadPodholders();

          } catch (e: any) {
            console.error('❌ Register failed', e);

            const message =
              e?.response?.data?.message ||
              e?.message ||
              'Registration failed';

            showAlert({
              title: 'Registration Failed',
              message: String(message),
              type: 'error',
            });
          }
        }}


      />

    </View>
  );
};

export default PodholderManagementScreen;

/* ================= COMPONENTS ================= */

const CountCard = ({ label, value, bg, color, textColor }: any) => {
  return (
    <View style={[styles.stat, { backgroundColor: bg }]}>
      <Text style={[styles.statLabel, { color: textColor }]}>
        {label}
      </Text>
      <Text style={[styles.statValue, { color }]}>
        {value}
      </Text>
    </View>
  );
};



/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },


  title: { fontSize: 22, fontWeight: '700' },

  registerBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },

  registerText: { color: '#fff', fontWeight: '600' },

  cards: { flexDirection: 'row', gap: 12, marginVertical: 16 },

  stat: { flex: 1, padding: 16, borderRadius: 16 },
  statLabel: { fontSize: 12 },
  statValue: { fontSize: 26, fontWeight: '700' },

  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },

  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
  },

  searchInput: { flex: 1, marginLeft: 8 },

  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },


  th: {
    fontSize: 12,
    fontWeight: '600',
  },

  td: {
    fontSize: 13,
  },

  statusCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cell: {
    paddingHorizontal: 8,
    justifyContent: 'center',
  },

  assignedCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 24,
    paddingRight: 8,
  },

  statusInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },

  statusBadge: {
    width: 120,
  },

  assignedText: {
    flex: 1,
    textAlign: 'left',
  },

  editIcon: {
    padding: 4,
  },

  confirmCard: {
    width: 320,
    borderRadius: 16,
    padding: 16,
  },

  confirmTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },

  optionList: {
    gap: 6,
  },

  optionItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },

  optionSelected: {
    backgroundColor: 'rgba(37,99,235,0.2)',
  },


  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },

  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
  },

  cancelText: {
    color: '#DC2626',
    fontWeight: '600',
  },

  confirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },


  confirmText: {
    color: '#16A34A',
    fontWeight: '700',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },

  badge: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    alignItems: 'center',
  },

  viewText: { color: '#DC2626', fontWeight: '600' },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  filterCard: {
    width: 260,
    borderRadius: 12,
    padding: 16,
  },

  filterTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },

  filterOption: {
    paddingVertical: 10,
  },

  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DC2626',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  rowExportBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
  },


  exportText: {
    color: '#DC2626',
    fontWeight: '600',
  },

  /* Added Missing Styles for Mobile Layout */
  cardItem: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardSerial: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardText: {
    fontSize: 14,
    marginBottom: 4,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
  },

});