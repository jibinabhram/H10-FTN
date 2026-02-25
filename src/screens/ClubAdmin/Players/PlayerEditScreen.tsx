import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, FlatList, RefreshControl } from 'react-native';
import { updatePlayer, getMyClubPods, assignPodToPlayer, unassignPodFromPlayer, getMyPodHolders, getPodsByHolder } from '../../../api/players';
import { upsertPlayersToSQLite, getPlayerFromSQLite } from '../../../services/playerCache.service';
import { db } from '../../../db/sqlite';
import { getClubZoneDefaults } from '../../../api/clubZones';
import { useTheme } from '../../../components/context/ThemeContext';
import api from '../../../api/axios';


const PlayerEditScreen = ({ player, goBack }: { player: any; goBack: () => void }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [form, setForm] = useState({
    player_name: player.player_name ?? '',
    age: String(player.age ?? ''),
    jersey_number: String(player.jersey_number ?? ''),
    position: player.position ?? '',
    height: String(player.height ?? ''),
    weight: String(player.weight ?? ''),
  });

  const [pods, setPods] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showPodModal, setShowPodModal] = useState(false);
  const [allPods, setAllPods] = useState<any[]>([]);
  const [podHolders, setPodHolders] = useState<any[]>([]);
  const [selectedPodHolderId, setSelectedPodHolderId] = useState<string | null>(null);
  const [zones, setZones] = useState<Array<{ zone: number; min: number; max: number }>>([]);
  const defaultZones = [
    { zone: 1, min: 101, max: 120 },
    { zone: 2, min: 120, max: 140 },
    { zone: 3, min: 140, max: 160 },
    { zone: 4, min: 160, max: 180 },
    { zone: 5, min: 180, max: 200 },
  ];


  // Normalize zones from any source (backend/SQLite/defaults) to consistent { zone, min, max } format
  const normalizeZones = (zonesData: any[]): Array<{ zone: number; min: number; max: number }> => {
    if (!Array.isArray(zonesData)) return [];
    return zonesData.map((z: any) => ({
      zone: Number(z.zone ?? z.zone_number ?? 0),
      min: Number(z.min ?? z.min_hr ?? 0),
      max: Number(z.max ?? z.max_hr ?? 0),
    }));
  };

  // Current pod assignment - check both player_pods (from server) and pod_id (from SQLite)
  const currentPod = player.player_pods?.[0]?.pod || (player.pod_id ? { pod_id: player.pod_id, serial_number: 'Pod ' + player.pod_serial } : null);
  const [assignedPod, setAssignedPod] = useState<any | null>(currentPod);

  useEffect(() => {
    loadPods();
  }, []);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadPods();
    } finally {
      setRefreshing(false);
    }
  }, []);


  useEffect(() => {
    // initialize per-player zones: use player's own zones if present, otherwise load defaults from backend/SQLite
    try {
      if (player?.hr_zones) {
        // Handle both JSON string (from SQLite) and array (from backend)
        let zonesData = player.hr_zones;
        if (typeof zonesData === 'string') {
          try {
            zonesData = JSON.parse(zonesData);
          } catch {
            zonesData = [];
          }
        }
        if (Array.isArray(zonesData) && zonesData.length > 0) {
          const normalized = normalizeZones(zonesData);
          if (normalized.length > 0) {
            setZones(normalized);
            return;
          }
        }
      }
      // load defaults: SQLite first (offline), then backend (synced per club), then hardcoded
      const loadDefaults = async () => {
        try {
          // 1️⃣ Try SQLite first (offline-first)
          const res = db.execute(`SELECT zone_number, min_hr, max_hr FROM hr_zones ORDER BY zone_number`);
          const rows = res?.rows?._array ?? [];
          if (rows.length > 0) {
            console.log('✅ Loaded default zones from SQLite for player');
            setZones(normalizeZones(rows));
            return;
          }

          // 2️⃣ SQLite empty, try backend (synced to club_id)
          try {
            const backendDefaults = await getClubZoneDefaults();
            if (Array.isArray(backendDefaults) && backendDefaults.length > 0) {
              console.log('✅ Loaded default zones from backend for player');
              const normalized = normalizeZones(backendDefaults);
              setZones(normalized);
              // Sync to SQLite for offline
              db.execute(`DELETE FROM hr_zones`);
              normalized.forEach(z => {
                db.execute(`INSERT INTO hr_zones (zone_number, min_hr, max_hr) VALUES (?, ?, ?)`, [z.zone, z.min, z.max]);
              });
              return;
            }
          } catch (e) {
            console.log('⚠️ Failed to load defaults from backend', e);
          }

          // 3️⃣ Both empty, use hardcoded defaults
          console.log('🆕 Using hardcoded default zones for player');
          setZones(defaultZones);
        } catch (e) {
          console.error('Failed to load zones for player', e);
          setZones(defaultZones);
        }
      };
      loadDefaults();
    } catch (e) {
      console.error('Failed to init zones for player', e);
    }
  }, [player]);

  const loadPods = async () => {
    try {
      setLoading(true);
      const allPodsData = await getMyClubPods();
      console.log('All pods loaded:', allPodsData?.length, 'data:', allPodsData);

      // Handle both direct array and nested {data: Array} response
      let podsArray = allPodsData;
      if (!Array.isArray(podsArray) && podsArray?.data && Array.isArray(podsArray.data)) {
        podsArray = podsArray.data;
      }
      if (!Array.isArray(podsArray)) {
        podsArray = [];
      }
      setAllPods(podsArray);

      // Filter out the current pod by id or serial (robust against different sources)
      const currentPodId = assignedPod?.pod_id ?? currentPod?.pod_id ?? player.pod_id ?? null;
      const currentPodSerial = assignedPod?.serial_number ?? currentPod?.serial_number ?? player.pod_serial ?? null;
      console.log('Current pod id:', currentPodId, 'serial:', currentPodSerial);
      const available = podsArray.filter((p: any) => {
        if (!p) return false;
        // If it's the current player's pod, filter it out (already assigned)
        if (currentPodId && String(p.pod_id) === String(currentPodId)) return false;
        if (currentPodSerial && String(p.serial_number) === String(currentPodSerial)) return false;

        // Filter out pods assigned to ANY player
        const hasAssignment =
          (Array.isArray(p.player_pods) && p.player_pods.length > 0) ||
          Boolean(p.player_id) ||
          Boolean(p.assigned_player_id);
        return !hasAssignment;
      });
      console.log('Available pods after filter:', available.length);
      setPods(available);
    } catch (e) {
      console.error('Failed to load pods', e);
      setAllPods([]);
      setPods([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPodHolders = async () => {
    try {
      console.log('🔍 Loading pod holders for current club...');
      const holders = await getMyPodHolders();
      console.log('📦 Pod holders received:', holders);
      setPodHolders(Array.isArray(holders) ? holders : []);
      console.log('✅ Pod holders set:', Array.isArray(holders) ? holders.length : 0);
    } catch (e) {
      console.error('Failed to load pod holders', e);
    }
  };

  const loadPodsByHolder = async (holderId: string) => {
    try {
      setLoading(true);
      console.log('📦 Loading pods for holder:', holderId);
      const podsData = await getPodsByHolder(holderId);
      console.log('📦 Pods data received:', podsData);

      // Filter out current pod
      const currentPodId = assignedPod?.pod_id ?? currentPod?.pod_id ?? player.pod_id ?? null;
      const filtered = (Array.isArray(podsData) ? podsData : []).filter((p: any) => {
        if (!p) return false;

        // Even if it's the player's OWN assigned pod, we filter it from the selection list
        // because the user wants to pick a NEW (available) pod.
        if (currentPodId && String(p.pod_id) === String(currentPodId)) {
          console.log(`📦 Skipping current pod: ${p.serial_number}`);
          return false;
        }

        // Filter out pods assigned to ANY player
        const hasAssignment =
          (Array.isArray(p.player_pods) && p.player_pods.length > 0) ||
          Boolean(p.player_id) ||
          Boolean(p.assigned_player_id);

        console.log(`📦 Pod ${p.serial_number}:`, {
          player_pods: p.player_pods,
          player_id: p.player_id,
          assigned_player_id: p.assigned_player_id,
          hasAssignment,
        });

        return !hasAssignment;
      });

      console.log('✅ Available pods after filtering:', filtered.length, filtered);
      setPods(filtered);
    } catch (e) {
      console.error('Failed to load pods for holder', e);
      setPods([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showPodModal) {
      loadPodHolders();
      // If player has an assigned pod, try to pre-select its holder
      if (assignedPod?.pod_holder_id || assignedPod?.pod_holder?.pod_holder_id) {
        const holderId = assignedPod?.pod_holder_id || assignedPod?.pod_holder?.pod_holder_id;
        setSelectedPodHolderId(holderId);
        loadPodsByHolder(holderId);
      }
    }
  }, [showPodModal, assignedPod]);

  const save = async () => {
    try {
      const payload: any = {
        player_name: form.player_name,
        age: Number(form.age) || undefined,
        jersey_number: Number(form.jersey_number) || undefined,
        position: form.position,
        height: form.height ? Number(form.height) : undefined,
        weight: form.weight ? Number(form.weight) : undefined,
        hr_zones: zones && zones.length ? zones : undefined,
      };

      const updated = await updatePlayer(player.player_id, payload);

      // update local cache
      const result = upsertPlayersToSQLite([updated]);
      if (!result || !result.success) {
        const local = getPlayerFromSQLite(updated.player_id);
        console.error('Upsert result:', result, 'localRow:', local);
        Alert.alert('Warning', 'Saved to server but failed to persist locally');
        goBack();
        return;
      }

      const persisted = getPlayerFromSQLite(updated.player_id);
      if (!persisted) {
        console.error('Player not found in SQLite after upsert', updated.player_id);
        Alert.alert('Warning', 'Saved to server but local persistence failed');
      } else {
        Alert.alert('Success', 'Player updated');
      }

      goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || e?.message || 'Failed to update player');
    }
  };

  const handleAssignPod = async (pod: any) => {
    try {
      setLoading(true);
      const updatedPlayer = await assignPodToPlayer(player.player_id, pod.pod_id);
      // updatedPlayer is the player object returned by backend
      if (updatedPlayer) {
        upsertPlayersToSQLite([updatedPlayer]);
        const newAssigned = updatedPlayer.player_pods?.[0]?.pod ?? (updatedPlayer.pod_id ? { pod_id: updatedPlayer.pod_id, serial_number: updatedPlayer.pod_serial } : null);
        setAssignedPod(newAssigned);
        // if player has no hr_zones, set defaults from sqlite and persist locally
        try {
          const hasZones = updatedPlayer.hr_zones && Array.isArray(updatedPlayer.hr_zones) && updatedPlayer.hr_zones.length > 0;
          if (!hasZones) {
            const res = db.execute(`SELECT zone_number, min_hr, max_hr FROM hr_zones ORDER BY zone_number`);
            const rows = res?.rows?._array ?? [];
            const defaults = normalizeZones(rows);
            if (defaults.length > 0) {
              // persist to local sqlite for this player
              upsertPlayersToSQLite([{ ...updatedPlayer, hr_zones: JSON.stringify(defaults) }]);
              setZones(defaults);
            }
          } else {
            const normalized = normalizeZones(updatedPlayer.hr_zones);
            setZones(normalized);
          }
        } catch (e) {
          console.error('Failed to persist default zones after assign', e);
        }
      }
      Alert.alert('Success', `Pod ${pod.serial_number} assigned`);
      setShowPodModal(false);
      // Update available pods list
      const remaining = allPods.filter((p: any) => p.pod_id !== pod.pod_id);
      setPods(remaining);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to assign pod');
    } finally {
      setLoading(false);
    }
  };

  const handleUnassignPod = async () => {
    try {
      setLoading(true);
      const updatedPlayer = await unassignPodFromPlayer(player.player_id);
      if (updatedPlayer) {
        upsertPlayersToSQLite([updatedPlayer]);
        setAssignedPod(null);
        // ensure player has zones set after unassign
        try {
          const hasZones = updatedPlayer.hr_zones && Array.isArray(updatedPlayer.hr_zones) && updatedPlayer.hr_zones.length > 0;
          if (!hasZones) {
            const res = db.execute(`SELECT zone_number, min_hr, max_hr FROM hr_zones ORDER BY zone_number`);
            const rows = res?.rows?._array ?? [];
            const defaults = normalizeZones(rows);
            if (defaults.length > 0) {
              upsertPlayersToSQLite([{ ...updatedPlayer, hr_zones: JSON.stringify(defaults) }]);
              setZones(defaults);
            }
          } else {
            const normalized = normalizeZones(updatedPlayer.hr_zones);
            setZones(normalized);
          }
        } catch (e) {
          console.error('Failed to persist default zones after unassign', e);
        }
      }
      Alert.alert('Success', 'Pod unassigned');
      // After unassign, all pods become available again
      setPods(allPods);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to unassign pod');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 80}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: isDark ? '#020617' : '#FFFFFF' }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? "#fff" : "#DC2626"}
          />
        }
      >
        <Text style={[styles.title, { color: isDark ? '#fff' : '#111', marginTop: 15, paddingRight: 40 }]}>Edit Player</Text>

        <TextInput
          placeholder="Player Name"
          placeholderTextColor={isDark ? "#9CA3AF" : "#9CA3AF"}
          style={[styles.input, { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#E5E7EB', color: isDark ? '#fff' : '#000' }]}
          value={form.player_name}
          onChangeText={v => setForm({ ...form, player_name: v })}
        />
        <TextInput
          placeholder="Age"
          placeholderTextColor={isDark ? "#9CA3AF" : "#9CA3AF"}
          style={[styles.input, { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#E5E7EB', color: isDark ? '#fff' : '#000' }]}
          keyboardType="numeric"
          value={form.age}
          onChangeText={v => setForm({ ...form, age: v })}
        />
        <TextInput
          placeholder="Jersey Number"
          placeholderTextColor={isDark ? "#9CA3AF" : "#9CA3AF"}
          style={[styles.input, { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#E5E7EB', color: isDark ? '#fff' : '#000' }]}
          keyboardType="numeric"
          value={form.jersey_number}
          onChangeText={v => setForm({ ...form, jersey_number: v })}
        />
        <TextInput
          placeholder="Position"
          placeholderTextColor={isDark ? "#9CA3AF" : "#9CA3AF"}
          style={[styles.input, { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#E5E7EB', color: isDark ? '#fff' : '#000' }]}
          value={form.position}
          onChangeText={v => setForm({ ...form, position: v })}
        />

        <TextInput
          placeholder="Height (cm)"
          placeholderTextColor={isDark ? "#9CA3AF" : "#9CA3AF"}
          style={[styles.input, { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#E5E7EB', color: isDark ? '#fff' : '#000' }]}
          keyboardType="numeric"
          value={form.height}
          onChangeText={v => setForm({ ...form, height: v })}
        />
        <TextInput
          placeholder="Weight (kg)"
          placeholderTextColor={isDark ? "#9CA3AF" : "#9CA3AF"}
          style={[styles.input, { backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#E5E7EB', color: isDark ? '#fff' : '#000' }]}
          keyboardType="numeric"
          value={form.weight}
          onChangeText={v => setForm({ ...form, weight: v })}
        />

        {/* Pod Assignment Section */}
        <View style={styles.sectionSpacer} />
        <Text style={[styles.sectionTitle, { color: isDark ? '#e2e8f0' : '#111' }]}>Pod Assignment</Text>

        {assignedPod ? (
          <View style={[styles.podCard, { backgroundColor: isDark ? '#1e3a8a' : '#DBEAFE', borderLeftColor: isDark ? '#60a5fa' : '#DC2626' }]}>
            <View>
              <Text style={[styles.podSerial, { color: isDark ? '#bfdbfe' : '#1E40AF' }]}>{assignedPod.serial_number}</Text>
              <Text style={[styles.podInfo, { color: isDark ? '#93c5fd' : '#64748B' }]}>{assignedPod.pod_holder?.serial_number ?? 'Unknown holder'}</Text>
            </View>
            <TouchableOpacity style={styles.unassignBtn} onPress={handleUnassignPod} disabled={loading}>
              <Text style={styles.unassignBtnText}>Unassign</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={[styles.noPod, { color: isDark ? '#94a3b8' : '#64748B' }]}>No pod assigned</Text>
        )}

        <TouchableOpacity
          style={styles.assignPodBtn}
          onPress={() => setShowPodModal(true)}
          disabled={loading}
        >
          <Text style={styles.assignPodBtnText}>
            {assignedPod ? 'Reassign Pod' : 'Assign Pod'}
          </Text>
        </TouchableOpacity>

        {/* Pod Selection Modal */}
        {showPodModal && (
          <View style={styles.modal}>
            <View style={[styles.modalContent, { backgroundColor: isDark ? '#1e293b' : '#fff' }]}>
              <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#111' }]}>Select Pod</Text>
              {loading ? (
                <ActivityIndicator color="#DC2626" size="large" />
              ) : (
                <>
                  <Text style={[styles.modalSubTitle, { color: isDark ? '#94a3b8' : '#64748B' }]}>Select Pod Holder</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                    {podHolders.map(holder => (
                      <TouchableOpacity
                        key={holder.pod_holder_id}
                        onPress={() => {
                          setSelectedPodHolderId(holder.pod_holder_id);
                          loadPodsByHolder(holder.pod_holder_id);
                        }}
                        style={[
                          styles.podHolderChip,
                          {
                            backgroundColor: selectedPodHolderId === holder.pod_holder_id ? '#DC2626' : (isDark ? '#334155' : '#F3F4F6'),
                          }
                        ]}
                      >
                        <Text style={[
                          styles.podHolderChipText,
                          { color: selectedPodHolderId === holder.pod_holder_id ? '#fff' : (isDark ? '#fff' : '#111') }
                        ]}>
                          {holder.serial_number || `Holder ${holder.pod_holder_id.slice(0, 8)}`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {selectedPodHolderId && (
                    <>
                      <Text style={[styles.modalSubTitle, { color: isDark ? '#94a3b8' : '#64748B' }]}>Select Pod</Text>
                      {pods.length === 0 ? (
                        <Text style={[styles.emptyText, { color: isDark ? '#94a3b8' : '#64748B' }]}>No available pods in this holder</Text>
                      ) : (
                        <FlatList
                          data={pods}
                          keyExtractor={p => p.pod_id}
                          scrollEnabled={false}
                          renderItem={({ item }) => (
                            <TouchableOpacity
                              style={[styles.podOption, { backgroundColor: isDark ? '#0f172a' : '#F3F4F6' }]}
                              onPress={() => handleAssignPod(item)}
                            >
                              <View>
                                <Text style={[styles.podOptionSerial, { color: isDark ? '#fff' : '#111' }]}>{item.serial_number}</Text>
                                <Text style={[styles.podOptionHolder, { color: isDark ? '#94a3b8' : '#64748B' }]}>{item.pod_holder?.serial_number ?? 'Unknown'}</Text>
                              </View>
                            </TouchableOpacity>
                          )}
                        />
                      )}
                    </>
                  )}
                </>
              )}
              <TouchableOpacity
                style={[styles.closeModalBtn, { backgroundColor: isDark ? '#334155' : '#E5E7EB' }]}
                onPress={() => {
                  setShowPodModal(false);
                  setSelectedPodHolderId(null);
                  setPods([]);
                }}
              >
                <Text style={[styles.closeModalBtnText, { color: isDark ? '#fff' : '#111' }]}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}


        {/* HR Zones per player */}
        <View style={{ marginTop: 12 }}>
          <Text style={[styles.sectionTitle, { marginBottom: 8, color: isDark ? '#e2e8f0' : '#111' }]}>Heart Rate Zones</Text>
          {zones.length === 0 ? (
            <Text style={[styles.emptyText, { color: isDark ? '#94a3b8' : '#64748B' }]}>No zones defined</Text>
          ) : (
            zones.map(z => (
              <React.Fragment key={String(z.zone)}>
                <View style={{ marginBottom: 8 }}>
                  <Text style={{ fontWeight: '700', color: isDark ? '#fff' : '#000' }}>Zone {z.zone}</Text>
                  <View style={{ flexDirection: 'row', marginTop: 6 }}>
                    <TextInput
                      style={[styles.input, { width: 120, backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#E5E7EB', color: isDark ? '#fff' : '#000' }]}
                      keyboardType="numeric"
                      value={String(z.min)}
                      onChangeText={v => setZones(prev => prev.map(p => p.zone === z.zone ? { ...p, min: Number(v) || 0 } : p))}
                    />
                    <Text style={{ alignSelf: 'center', marginHorizontal: 8, color: isDark ? '#fff' : '#000' }}>to</Text>
                    <TextInput
                      style={[styles.input, { width: 120, backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: isDark ? '#334155' : '#E5E7EB', color: isDark ? '#fff' : '#000' }]}
                      keyboardType="numeric"
                      value={String(z.max)}
                      onChangeText={v => setZones(prev => prev.map(p => p.zone === z.zone ? { ...p, max: Number(v) || 0 } : p))}
                    />
                  </View>
                </View>
              </React.Fragment>
            ))
          )}
        </View>

        {/* Action Buttons */}
        <TouchableOpacity style={styles.btn} onPress={save} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Save Player</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.btn, { backgroundColor: isDark ? '#334155' : '#E5E7EB', marginTop: 8 }]} onPress={goBack} disabled={loading}>
          <Text style={[styles.btnText, { color: isDark ? '#fff' : '#111' }]}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default PlayerEditScreen;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#FFFFFF' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 16, color: '#111' },
  input: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionSpacer: { height: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: '#111' },
  podCard: {
    backgroundColor: '#DBEAFE',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  podSerial: { fontSize: 14, fontWeight: '600', color: '#1E40AF' },
  podInfo: { fontSize: 12, color: '#64748B', marginTop: 4 },
  unassignBtn: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  unassignBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  noPod: { fontSize: 13, color: '#64748B', fontStyle: 'italic', marginBottom: 8 },
  assignPodBtn: {
    backgroundColor: '#DC2626',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  assignPodBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  modal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: 16,
    maxHeight: '70%',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, color: '#111' },
  podOption: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  podOptionSerial: { fontSize: 14, fontWeight: '600', color: '#111' },
  podOptionHolder: { fontSize: 12, color: '#64748B', marginTop: 2 },
  modalSubTitle: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 8 },
  podHolderChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  podHolderChipText: { fontSize: 13, fontWeight: '600' },
  emptyText: { fontSize: 13, color: '#64748B', textAlign: 'center', marginVertical: 16 },
  closeModalBtn: {
    backgroundColor: '#E5E7EB',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  closeModalBtnText: { color: '#111', fontWeight: '600' },
  btn: {
    backgroundColor: '#DC2626',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  btnText: { color: '#fff', fontWeight: '700' },
});
