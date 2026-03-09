import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, RefreshControl, KeyboardAvoidingView, Platform } from 'react-native';
import { db } from '../../db/sqlite';
import { getClubZoneDefaults, setClubZoneDefaults } from '../../api/clubZones';
import { useTheme } from '../../components/context/ThemeContext';
import { useAlert } from '../../components/context/AlertContext';

const defaultZones = [
  { zone: 1, min: 101, max: 120 },
  { zone: 2, min: 120, max: 140 },
  { zone: 3, min: 140, max: 160 },
  { zone: 4, min: 160, max: 180 },
  { zone: 5, min: 180, max: 200 },
];

const ZoneSettingsScreen = () => {
  const { theme } = useTheme();
  const { showAlert } = useAlert();
  const isDark = theme === "dark";

  const [zones, setZones] = useState(defaultZones.map(z => ({ ...z })));
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Try to load from backend first, then SQLite
    loadZones();
  }, []);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      // Force reload from backend
      try {
        const backendZones = await getClubZoneDefaults();
        if (Array.isArray(backendZones) && backendZones.length > 0) {
          console.log('✅ Refreshed zones from backend:', backendZones.length);
          const normalized = backendZones.map(z => ({ zone: z.zone_number, min: z.min_hr, max: z.max_hr }));
          setZones(normalized);
          // Sync backend zones to SQLite
          db.execute(`DELETE FROM hr_zones`);
          normalized.forEach(z => {
            db.execute(`INSERT INTO hr_zones (zone_number, min_hr, max_hr) VALUES (?, ?, ?)`, [z.zone, z.min, z.max]);
          });
          return;
        }
      } catch (e) {
        console.log('⚠️ Failed to refresh zones from backend:', e);
      }
      // If refresh fails, just reload local zones
      loadZones();
    } finally {
      setRefreshing(false);
    }
  };

  const loadZones = async () => {
    try {
      setLoading(true);

      // 1️⃣ PRIORITY: Load from SQLite first (offline-first, always fast)
      const res = db.execute(`SELECT * FROM hr_zones ORDER BY zone_number LIMIT 5`);
      const rows = res?.rows?._array ?? [];
      if (rows.length > 0) {
        console.log('✅ Loaded zones from SQLite:', rows.length);
        setZones(rows.map(r => ({ zone: r.zone_number, min: r.min_hr, max: r.max_hr })));
        return;
      }

      // 2️⃣ SQLite empty, try loading from backend (syncs to club_id)
      try {
        const backendZones = await getClubZoneDefaults();
        if (Array.isArray(backendZones) && backendZones.length > 0) {
          console.log('✅ Loaded zones from backend:', backendZones.length);
          const normalized = backendZones.map(z => ({ zone: z.zone_number, min: z.min_hr, max: z.max_hr }));
          setZones(normalized);
          // Sync backend zones to SQLite for offline access
          db.execute(`DELETE FROM hr_zones`);
          normalized.forEach(z => {
            db.execute(`INSERT INTO hr_zones (zone_number, min_hr, max_hr) VALUES (?, ?, ?)`, [z.zone, z.min, z.max]);
          });
          return;
        }
      } catch (e) {
        console.log('⚠️ Failed to load zones from backend (offline or error):', e);
      }

      // 3️⃣ Both SQLite and backend empty, seed defaults only
      console.log('🆕 Seeding default zones');
      db.execute(`DELETE FROM hr_zones`);
      defaultZones.forEach(z => {
        db.execute(`INSERT INTO hr_zones (zone_number, min_hr, max_hr) VALUES (?, ?, ?)`, [z.zone, z.min, z.max]);
      });
      setZones(defaultZones);
    } catch (e) {
      console.log('ZONE LOAD ERROR', e);
      // Last resort: show defaults if anything goes wrong
      setZones(defaultZones);
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    try {
      setLoading(true);

      // Save to backend
      const result = await setClubZoneDefaults(zones);
      console.log('Zones saved to backend:', result);

      // Also sync to SQLite
      db.execute(`DELETE FROM hr_zones`);
      zones.forEach(z => {
        db.execute(`INSERT INTO hr_zones (zone_number, min_hr, max_hr) VALUES (?, ?, ?)`, [z.zone, z.min, z.max]);
      });

      showAlert({
        title: 'Saved',
        message: 'Zones saved to server and local storage',
        type: 'success',
      });
    } catch (e: any) {
      console.error('Error saving zones', e);
      showAlert({
        title: 'Error',
        message: e?.message || 'Error saving zones',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, padding: 16, backgroundColor: 'transparent' }}
      contentContainerStyle={{ paddingBottom: 80 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={isDark ? "#fff" : "#DC2626"}
        />
      }
    >
      <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 12, color: isDark ? '#fff' : '#000' }}>Heart Rate Zones</Text>
      {loading && zones.length === 0 ? (
        <ActivityIndicator size="large" color={isDark ? "#fff" : "#DC2626"} />
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 16 }}>
            {zones.map((z, idx) => (
              <View key={idx} style={{ width: '48%', marginBottom: 24 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#fff' : '#111' }}>Zone {z.zone}</Text>
                  <Text style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748B' }}>bpm</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <TextInput
                    style={[styles.input, { flex: 1, height: 46, borderRadius: 23, backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0', color: '#DC2626', textAlign: 'center', fontSize: 18, fontWeight: '900', paddingVertical: 0, width: 'auto' }]}
                    keyboardType="numeric"
                    value={String(z.min)}
                    onChangeText={v => setZones(prev => prev.map(p => p.zone === z.zone ? { ...p, min: Number(v.replace(/[^0-9]/g, '')) } : p))}
                  />
                  <Text style={{ color: isDark ? '#475569' : '#94a3b8', fontWeight: '800' }}>-</Text>
                  <TextInput
                    style={[styles.input, { flex: 1, height: 46, borderRadius: 23, backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0', color: '#DC2626', textAlign: 'center', fontSize: 18, fontWeight: '900', paddingVertical: 0, width: 'auto' }]}
                    keyboardType="numeric"
                    value={String(z.max)}
                    onChangeText={v => setZones(prev => prev.map(p => p.zone === z.zone ? { ...p, max: Number(v.replace(/[^0-9]/g, '')) } : p))}
                  />
                </View>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.btn} onPress={save} disabled={loading}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>{loading ? 'Saving...' : 'Save Zones'}</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
};

export default ZoneSettingsScreen;

const styles = StyleSheet.create({
  input: { backgroundColor: '#fff', padding: 8, borderRadius: 8, width: 120 },
  btn: { backgroundColor: '#DC2626', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 16 },
});
