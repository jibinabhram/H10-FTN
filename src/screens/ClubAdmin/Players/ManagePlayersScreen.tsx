import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { getPlayersFromSQLite } from '../../../services/playerCache.service';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../../components/context/ThemeContext';

const ManagePlayersScreen = ({ onEdit }: { onEdit: (player: any) => void }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [players, setPlayers] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadPlayers = useCallback(() => {
    const list = getPlayersFromSQLite();
    setPlayers(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPlayers();
    }, [loadPlayers])
  );

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      loadPlayers();
    } finally {
      setRefreshing(false);
    }
  }, [loadPlayers]);

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 12, color: isDark ? '#fff' : '#000' }}>Manage Players</Text>

      <FlatList
        data={players}
        keyExtractor={p => String(p.player_id)}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.row, { backgroundColor: isDark ? '#1e293b' : '#fff' }]} onPress={() => onEdit(item)}>
            <View>
              <Text style={[styles.name, { color: isDark ? '#fff' : '#000' }]}>{item.player_name}</Text>
              <Text style={[styles.sub, { color: isDark ? '#94a3b8' : '#64748B' }]}>{item.club_name ?? '—'}</Text>
            </View>
            <Text style={styles.action}>Edit</Text>
          </TouchableOpacity>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? "#fff" : "#2563EB"}
          />
        }
      />
    </View>
  );
};

export default ManagePlayersScreen;

const styles = StyleSheet.create({
  row: {
    padding: 12,
    backgroundColor: '#fff',
    marginBottom: 8,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: { fontSize: 16, fontWeight: '600' },
  sub: { color: '#64748B', fontSize: 13 },
  action: { color: '#2563EB', fontWeight: '700' },
});
