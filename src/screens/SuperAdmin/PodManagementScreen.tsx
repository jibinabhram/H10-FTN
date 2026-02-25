import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react';


import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  ScrollView,
  useWindowDimensions,
  UIManager,
  findNodeHandle,
  Dimensions,
  Alert,
} from 'react-native';

import Ionicons from 'react-native-vector-icons/Ionicons';

import RegisterPodModal from '../../components/RegisterPodModal';
import { downloadPods } from '../../utils/podExport';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { fetchPods } from '../../api/pods';
import { useTheme } from '../../components/context/ThemeContext';
import { updatePodStatus } from '../../api/pods';


/* ================= TYPES ================= */

type PodStatus = 'ALL' | 'ACTIVE' | 'ASSIGNED' | 'MAINTENANCE' | 'DAMAGED' | 'LOST' | 'REPAIRED';

type Pod = {
  id: string;
  serial: string;
  deviceId: string;
  status: Exclude<PodStatus, 'ALL'>;
  batchId: string;
};


/* ================= PAGINATION (ADDED) ================= */
const ITEMS_PER_PAGE = 9;

/* ================= CACHE KEY ================= */
const PODS_CACHE_KEY = 'pods_management_cache';
/* ================= COLORS ================= */

const COLORS = {
  light: {
    bg: '#F8FAFC',
    card: '#FFFFFF',
    text: '#0F172A',
    border: '#E5E7EB',
    muted: '#64748B',
  },
  dark: {
    bg: '#020617',
    card: '#020617',
    text: '#E5E7EB',
    border: '#1E293B',
    muted: '#94A3B8',
  },
};

const FILTER_STATUS_OPTIONS: PodStatus[] = [
  'ALL',
  'ACTIVE',
  'ASSIGNED',
  'MAINTENANCE',
  'DAMAGED',
  'LOST',
  'REPAIRED',
];


const ROW_STATUS_OPTIONS: Exclude<PodStatus, 'ALL'>[] = [
  'ACTIVE',
  'ASSIGNED',
  'MAINTENANCE',
  'DAMAGED',
  'LOST',
  'REPAIRED',
];



/* ================= SCREEN ================= */

const PodManagementScreen = () => {
  const { theme } = useTheme();
  const colors = COLORS[theme];



  const measure = (
    ref: React.RefObject<View>,
    cb: (pos: { x: number; y: number; w: number }) => void,
  ) => {
    const node = findNodeHandle(ref.current);
    if (!node) return;

    UIManager.measureInWindow(node, (x, y, w) => {
      cb({ x, y, w });
    });
  };


  const [pods, setPods] = useState<Pod[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const [batches, setBatches] = useState<string[]>([]);
  const [selectedBatch, setSelectedBatch] = useState('ALL');

  const [batchOpen, setBatchOpen] = useState(false);
  const [batchSearch, setBatchSearch] = useState('');

  const [rowMenuOpen, setRowMenuOpen] = useState(false);
  const [rowMenuPos, setRowMenuPos] = useState({ x: 0, y: 0 });
  const [selectedPod, setSelectedPod] = useState<Pod | null>(null);

  const [statusFilter, setStatusFilter] = useState<PodStatus>('ALL');
  const [filterOpen, setFilterOpen] = useState(false);


  const [editingPodId, setEditingPodId] = useState<string | null>(null);


  const [showBackdrop, setShowBackdrop] = useState(false);

  const batchBtnRef = useRef<View>(null);
  const statusBtnRef = useRef<View>(null);

  const [batchPos, setBatchPos] = useState({ x: 0, y: 0, w: 0 });
  const [statusPos, setStatusPos] = useState({ x: 0, y: 0, w: 0 });


  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingChange, setPendingChange] = useState<{
    podId: string;
    newStatus: Exclude<PodStatus, 'ALL'>;
    oldStatus: Exclude<PodStatus, 'ALL'>;
  } | null>(null);


  /* ================= PAGE STATE (ADDED) ================= */
  const [page, setPage] = useState(1);


  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  useEffect(() => {
    loadCachedPods(); // show cached data instantly

    NetInfo.fetch().then(state => {
      if (state.isConnected) {
        loadPods();        // online → API + cache
      }
    });
  }, []);


  const loadPods = async () => {
    try {
      const data = await fetchPods();

      const mapped: Pod[] = data.map((p: any) => ({
        id: p.pod_id,
        serial: p.serial_number,
        deviceId: p.device_id,
        status: p.lifecycle_status,
        batchId: p.batch_id,
      }));

      setPods(mapped);

      await AsyncStorage.setItem(
        PODS_CACHE_KEY,
        JSON.stringify(mapped),
      );

    } catch (err: any) {
      // ✅ OFFLINE HANDLING (THIS IS THE FIX)
      if (err?.isOffline) {
        Alert.alert(
          'Offline',
          'No internet connection. Showing saved data.',
        );
        return;
      }

      console.error('❌ loadPods failed:', err);
      Alert.alert('Error', 'Failed to load pods from server');
    }
  };

  const loadCachedPods = async () => {
    const cached = await AsyncStorage.getItem(PODS_CACHE_KEY);
    if (!cached) return;

    const mapped: Pod[] = JSON.parse(cached);
    setPods(mapped);

    const uniqueBatches = Array.from(
      new Set(mapped.map(p => p.batchId)),
    ).sort((a, b) => b.localeCompare(a));

    setBatches(['ALL', ...uniqueBatches]);
  };


  /* ================= FILTER ================= */

  const filteredPods = useMemo(() => {
    return pods
      .filter(p => {
        if (selectedBatch !== 'ALL' && p.batchId !== selectedBatch) return false;
        if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
        if (
          search &&
          !`${p.serial}${p.deviceId}${p.status}`
            .toLowerCase()
            .includes(search.toLowerCase())
        )
          return false;
        return true;
      })
      .sort((a, b) => {
        const aNum = Number(a.serial.replace('PD', ''));
        const bNum = Number(b.serial.replace('PD', ''));
        return aNum - bNum;
      });
  }, [pods, selectedBatch, statusFilter, search]);


  const filteredBatches = useMemo(() => {
    if (!batchSearch) return batches;
    return batches.filter(b =>
      b.toLowerCase().includes(batchSearch.toLowerCase()),
    );
  }, [batches, batchSearch]);



  /* ================= PAGINATED DATA (ADDED) ================= */

  const totalPages = Math.ceil(filteredPods.length / ITEMS_PER_PAGE);



  const paginatedPods = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredPods.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredPods, page]);

  /* RESET PAGE ON FILTER CHANGE (ADDED) */
  useEffect(() => {
    setPage(1);
  }, [selectedBatch, statusFilter, search]);


  const counts = useMemo(
    () => ({
      ACTIVE: pods.filter(p => p.status === 'ACTIVE').length,
      MAINTENANCE: pods.filter(p => p.status === 'MAINTENANCE').length,
      DAMAGED: pods.filter(p => p.status === 'DAMAGED').length,
      LOST: pods.filter(p => p.status === 'LOST').length,
      REPAIRED: pods.filter(p => p.status === 'REPAIRED').length,
    }),
    [pods],
  );


  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* ================= FIXED CONTENT ================= */}

      <View style={{ padding: 16 }}>
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            Pod Management
          </Text>

          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => downloadPods(filteredPods)}
              style={styles.iconBtn}
            >
              <Ionicons name="download-outline" size={24} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.registerBtn}
              onPress={() => setOpen(true)}
            >
              <Text style={styles.registerText}>Register</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* COUNT CARDS */}
        <View style={styles.cards}>
          {[
            { k: 'ACTIVE', v: counts.ACTIVE, c: '#22C55E' },
            { k: 'MAINTENANCE', v: counts.MAINTENANCE, c: '#F97316' },
            { k: 'DAMAGED', v: counts.DAMAGED, c: '#EF4444' },
            { k: 'LOST', v: counts.LOST, c: '#6B7280' },
          ].map(s => (
            <View
              key={s.k}
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={{ color: s.c, fontSize: 18, fontWeight: '700' }}>
                {s.v}
              </Text>
              <Text style={{ color: colors.text }}>{s.k}</Text>
            </View>
          ))}
        </View>

        {/* ================= SEARCH | BATCH | STATUS ================= */}
        <View style={{ marginBottom: -13 }}>

          <View style={{ flexDirection: 'row', gap: 12 }}>

            {/* SEARCH */}
            <View
              style={[
                styles.searchBox,
                { flex: 2, backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Ionicons name="search-outline" size={18} color={colors.muted} />
              <TextInput
                placeholder="Search pods"
                placeholderTextColor={colors.muted}
                value={search}
                onChangeText={setSearch}
                style={[styles.searchInput, { color: colors.text }]}
              />
            </View>

            {/* BATCH BUTTON */}
            <View style={{ flex: 1 }} ref={batchBtnRef}>
              <TouchableOpacity
                style={[
                  styles.searchBox,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
                onPress={() => {
                  measure(batchBtnRef, setBatchPos);
                  setBatchOpen(true);
                  setFilterOpen(false);
                }}
              >
                <Ionicons name="layers-outline" size={18} color={colors.muted} />
                <Text style={{ marginLeft: 8, color: colors.text, flex: 1 }}>
                  {selectedBatch === 'ALL' ? 'All Batches' : selectedBatch}
                </Text>
                <Ionicons name="chevron-down" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>


            {/* STATUS BUTTON */}
            <View style={{ flex: 1 }} ref={statusBtnRef}>

              <TouchableOpacity
                style={[
                  styles.searchBox,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
                onPress={() => {
                  measure(statusBtnRef, setStatusPos);
                  setFilterOpen(true);
                  setBatchOpen(false);
                }}

              >
                <Ionicons name="filter-outline" size={18} color={colors.muted} />
                <Text style={{ marginLeft: 8, color: colors.text, flex: 1 }}>
                  {statusFilter}
                </Text>
                <Ionicons name="chevron-down" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>

          </View>
        </View>

        {/* ================= BATCH MODAL ================= */}
        <Modal visible={batchOpen} transparent animationType="fade">
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setBatchOpen(false)}
          />

          <View
            style={{
              position: 'absolute',
              top: batchPos.y + 44,
              left: batchPos.x,
              width: batchPos.w,
              maxHeight: 260,
              backgroundColor: colors.card,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              elevation: 40,
            }}
          >

            <TextInput
              placeholder="Search batch"
              placeholderTextColor={colors.muted}
              value={batchSearch}
              onChangeText={setBatchSearch}
              style={{
                padding: 12,
                color: colors.text,
                borderBottomWidth: 1,
                borderColor: colors.border,
              }}
            />

            <ScrollView keyboardShouldPersistTaps="handled">
              {filteredBatches.map(b => (
                <TouchableOpacity
                  key={b}
                  style={{ padding: 12 }}
                  onPress={() => {
                    setSelectedBatch(b);
                    setBatchOpen(false);
                    setBatchSearch('');
                    setPage(1);
                  }}
                >
                  <Text style={{ color: colors.text }}>
                    {b === 'ALL' ? 'All Batches' : b}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Modal>


        {/* ================= ROW EDIT STATUS MODAL ================= */}
        <Modal visible={rowMenuOpen} transparent animationType="fade">
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => {
              setRowMenuOpen(false);
              setSelectedPod(null);
            }}
          />

          {(() => {
            const MENU_HEIGHT = 260;
            const SCREEN_HEIGHT = Dimensions.get('window').height;

            const openUpwards =
              rowMenuPos.y + MENU_HEIGHT > SCREEN_HEIGHT;

            return (
              <View
                style={{
                  position: 'absolute',
                  top: openUpwards
                    ? rowMenuPos.y - MENU_HEIGHT
                    : rowMenuPos.y + 4,
                  left: Math.max(12, rowMenuPos.x - 140),
                  width: 160,
                  backgroundColor: colors.card,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  elevation: 100,
                }}
              >
                {ROW_STATUS_OPTIONS
                  .filter(status => status !== selectedPod?.status)
                  .map(status => (
                    <TouchableOpacity
                      key={status}
                      style={{ padding: 12 }}
                      onPress={() => {
                        if (!selectedPod) return;

                        setPendingChange({
                          podId: selectedPod.id,
                          oldStatus: selectedPod.status,
                          newStatus: status,
                        });

                        setRowMenuOpen(false);
                        setConfirmOpen(true);
                      }}
                    >
                      <Text style={styles[`status_${status}`]}>
                        {status}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>
            );
          })()}

        </Modal>


        {/* ================= TOP STATUS FILTER MODAL ================= */}
        <Modal visible={filterOpen} transparent animationType="fade">
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setFilterOpen(false)}
          />

          <View
            style={{
              position: 'absolute',
              top: statusPos.y + 44,
              left: statusPos.x,
              width: statusPos.w,
              backgroundColor: colors.card,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              elevation: 40,
            }}
          >
            {FILTER_STATUS_OPTIONS.map(s => (
              <TouchableOpacity
                key={s}
                style={{
                  padding: 12,
                  backgroundColor:
                    statusFilter === s ? '#DC262622' : 'transparent',
                }}
                onPress={() => {
                  setStatusFilter(s);
                  setFilterOpen(false);
                  setPage(1);
                }}
              >
                <Text style={{ color: colors.text }}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Modal>





        <Modal visible={confirmOpen} transparent animationType="fade">
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.4)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: 320,
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 20,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                Confirm Status Change
              </Text>

              <Text style={{ marginTop: 10, color: colors.muted }}>
                Change status to <Text style={{ fontWeight: '700' }}>
                  {pendingChange?.newStatus}
                </Text>?
              </Text>

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'flex-end',
                  gap: 12,
                  marginTop: 20,
                }}
              >
                {/* CANCEL */}
                <TouchableOpacity
                  onPress={() => {
                    setConfirmOpen(false);
                    setPendingChange(null);
                  }}
                >
                  <Text style={{ color: colors.muted }}>Cancel</Text>
                </TouchableOpacity>

                {/* CONFIRM */}
                <TouchableOpacity
                  onPress={async () => {
                    if (!pendingChange) return;

                    const { podId, newStatus, oldStatus } = pendingChange;

                    setConfirmOpen(false);
                    setEditingPodId(null);
                    setPendingChange(null);

                    try {
                      // ✅ Update state + cache together
                      setPods(prev => {
                        const updated = prev.map(p =>
                          p.id === podId ? { ...p, status: newStatus } : p
                        );

                        // ✅ Save to AsyncStorage
                        AsyncStorage.setItem(
                          PODS_CACHE_KEY,
                          JSON.stringify(updated),
                        );

                        return updated;
                      });

                      // ✅ Call API
                      await updatePodStatus(podId, newStatus);

                    } catch {
                      // ❌ Rollback if API fails
                      setPods(prev =>
                        prev.map(p =>
                          p.id === podId ? { ...p, status: oldStatus } : p
                        ),
                      );

                      alert('Status update failed');
                    }
                  }}
                >

                  <Text style={{ color: '#DC2626', fontWeight: '700' }}>
                    Confirm
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>

      {/* ================= ONLY THIS SCROLLS ================= */}
      <View style={{ paddingHorizontal: 16 }}>

        {isTablet && (
          <View
            style={[
              styles.tableHeader,
              {
                borderColor: colors.border,
                backgroundColor: colors.card,
              },
            ]}
          >
            <Text style={[styles.th, styles.colSno, { color: colors.muted }]}>
              S.No
            </Text>

            <Text style={[styles.th, styles.colSerial, { color: colors.muted }]}>
              Serial
            </Text>


            <Text
              style={[
                styles.th,
                styles.colDevice,
                {
                  color: colors.muted,
                  textAlign: 'left',
                  paddingLeft: 8,
                },
              ]}
            >
              Device ID
            </Text>


            <Text
              style={[
                styles.th,
                styles.colStatus,
                {
                  color: colors.muted,
                  textAlign: 'left',
                  paddingLeft: 24,
                },
              ]}
            >
              Status
            </Text>
          </View>
        )}



        <FlatList
          data={paginatedPods}
          keyExtractor={item => item.id}
          scrollEnabled={false}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={false}
          contentContainerStyle={{ paddingBottom: 80 }}
          renderItem={({ item, index }) => (
            <View style={[styles.row, { borderColor: colors.border }]}>
              <Text style={[styles.colSno, { color: colors.text }]}>
                {(page - 1) * ITEMS_PER_PAGE + index + 1}
              </Text>

              <Text style={[styles.colSerial, { color: colors.text }]}>
                {item.serial}
              </Text>

              <Text style={[styles.colDevice, { color: colors.text }]}>
                {item.deviceId}
              </Text>

              <View style={[styles.colStatus, { alignItems: 'center' }]}>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  onPress={e => {
                    e.currentTarget.measureInWindow((x, y, w, h) => {
                      setRowMenuPos({ x, y: y + h });
                      setSelectedPod(item);
                      setRowMenuOpen(true);
                    });
                  }}
                >
                  <Text style={styles[`status_${item.status}`]}>
                    {item.status}
                  </Text>
                  <Ionicons name="create-outline" size={14} color={colors.muted} />
                </TouchableOpacity>
              </View>




            </View>
          )}
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={styles.pagination}>
                {/* PREVIOUS */}
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
            ) : null
          }

        />
      </View>

      <RegisterPodModal
        visible={open}
        onClose={() => setOpen(false)}
        onRegistered={loadPods}
      />
    </View>
  );

};

export default PodManagementScreen;

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  /* ================= HEADER ================= */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },

  registerBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  registerText: {
    color: '#fff',
    fontWeight: '600',
  },

  /* ================= BATCH CHIPS ================= */
  batchChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },

  /* ================= COUNT CARDS ================= */
  cards: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 16,
  },
  card: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },

  /* ================= SEARCH ================= */
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
  },

  /* ================= FILTER DROPDOWN ================= */
  filterBtn: {
    padding: 6,
  },

  filterDropdown: {
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    maxHeight: 260,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 6,

    zIndex: 5001,
    elevation: 5001,
  },



  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },



  filterItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },

  filterItemActive: {
    backgroundColor: '#DC262622',
  },

  /* ================= TABLE ================= */
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },

  row: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },

  th: {
    fontWeight: '700',
  },

  colSno: { width: 60 },
  colSerial: { flex: 1 },
  colDevice: { flex: 1 },
  colStatus: {
    width: 140,
    justifyContent: 'center',
  },

  /* ================= PAGINATION ================= */
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    paddingVertical: 14,
    marginTop: 8,
  },

  paginationBtn: {
    padding: 6,
    borderRadius: 6,
  },

  paginationText: {
    fontSize: 14,
    fontWeight: '600',
  },


  /* ================= STATUS COLORS ================= */
  status_ACTIVE: {
    color: '#22C55E',
    fontWeight: '600',
  },
  status_ASSIGNED: {
    color: '#3B82F6',
    fontWeight: '600',
  },

  status_MAINTENANCE: {
    color: '#F97316',
    fontWeight: '600',
  },
  status_DAMAGED: {
    color: '#EF4444',
    fontWeight: '600',
  },
  status_LOST: {
    color: '#6B7280',
    fontWeight: '600',
  },
  status_REPAIRED: {
    color: '#14B8A6',
    fontWeight: '600',
  },
});
