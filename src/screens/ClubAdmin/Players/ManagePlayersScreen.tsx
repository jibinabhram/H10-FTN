import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { getPlayersFromSQLite } from '../../../services/playerCache.service';
import { useFocusEffect } from '@react-navigation/native';

const ManagePlayersScreen = ({ onEdit }: { onEdit: (player: any) => void }) => {
  const [players, setPlayers] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      const list = getPlayersFromSQLite();
      setPlayers(list);
    }, [])
  );

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 12 }}>Manage Players</Text>

      <FlatList
        data={players}
        keyExtractor={p => String(p.player_id)}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => onEdit(item)}>
            <View>
              <Text style={styles.name}>{item.player_name}</Text>
              <Text style={styles.sub}>{item.club_name ?? '—'}</Text>
            </View>
            <Text style={styles.action}>Edit</Text>
          </TouchableOpacity>
        )}
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
