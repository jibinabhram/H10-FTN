import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { fetchMyClubCoaches } from '../../api/coaches';
import { useTheme } from '../../components/context/ThemeContext';

const MyClubCoaches = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [coaches, setCoaches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCoaches();
  }, []);

  const loadCoaches = async () => {
    try {
      const data = await fetchMyClubCoaches();
      setCoaches(Array.isArray(data) ? data : []);
    } catch (err) {
      console.log('❌ LOAD COACH ERROR:', err);
      setCoaches([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: isDark ? '#020617' : '#FFFFFF' }]}>
        <ActivityIndicator size="large" color={isDark ? '#FFFFFF' : '#0000ff'} />
      </View>
    );
  }

  if (coaches.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: isDark ? '#020617' : '#FFFFFF' }]}>
        <Text style={{ fontSize: 16, color: isDark ? '#94A3B8' : '#000000' }}>No coaches found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#020617' : '#FFFFFF' }]}>
      <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#000000' }]}>My Club Coaches</Text>

      <FlatList
        data={coaches}
        keyExtractor={item => item.coach_id}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: isDark ? '#1E293B' : '#EEF2FF' }]}>
            <Text style={[styles.name, { color: isDark ? '#FFFFFF' : '#000000' }]}>{item.coach_name}</Text>
            <Text style={{ color: isDark ? '#CBD5E1' : '#000000' }}>Email: {item.email}</Text>
            <Text style={{ color: isDark ? '#CBD5E1' : '#000000' }}>Phone: {item.phone || 'Not Provided'}</Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 18 },
  card: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  name: { fontWeight: '700', fontSize: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

export default MyClubCoaches;
