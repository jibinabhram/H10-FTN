import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { getMyClubPlayers } from '../../../api/players';
import { loadPlayersUnified } from '../../../services/playerSync.service';
import { getPlayersFromSQLite } from '../../../services/playerCache.service';
import { useTheme } from '../../../components/context/ThemeContext';


const PlayersListScreen = ({ openCreate, onEdit }: { openCreate: () => void; onEdit: (player: any) => void }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [players, setPlayers] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);


  const loadPlayers = async () => {
    // 1️⃣ LOAD FROM CACHE FIRST (Instant)
    const cached = getPlayersFromSQLite();
    if (cached && cached.length > 0) {
      setPlayers(cached);
    }

    try {
      // 2️⃣ SYNC FROM API (Background/Async)
      const data = await loadPlayersUnified();

      if (Array.isArray(data)) {
        setPlayers(data);
      }
    } catch (e: any) {
      if (e?.isOffline) {
        Alert.alert('Offline', 'You are offline. Showing last available data.');
        return;
      }

      Alert.alert('Error', 'Failed to load players');
    }
  };

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await loadPlayersUnified();

      if (Array.isArray(data)) {
        setPlayers(data);
      } else {
        setPlayers([]);
      }
    } catch (e: any) {
      if (!e?.isOffline) {
        Alert.alert(
          'Error',
          'Failed to refresh players',
        );
      }
    } finally {
      setRefreshing(false);
    }
  }, []);
  // 🔥 THIS is the key fix
  useFocusEffect(
    useCallback(() => {
      loadPlayers();
    }, [])
  );
  const memoizedPlayers = useMemo(() => players, [players]);

  const renderPlayer = useCallback(({ item }: { item: any }) => {
    const podSerial =
      item.pod_serial ??
      item.player_pods?.[0]?.pod?.serial_number ??
      'Unassigned';

    const podHolderSerial =
      item.pod_holder_serial ??
      item.player_pods?.[0]?.pod?.pod_holder?.serial_number ??
      'Unassigned';

    const clubName =
      item.club_name ??
      item.club?.club_name ??
      '—';

    return (
      <TouchableOpacity onPress={() => onEdit(item)} activeOpacity={0.7}>
        <PlayerCard
          player={item}
          podSerial={podSerial}
          podHolderSerial={podHolderSerial}
          clubName={clubName}
        />
      </TouchableOpacity>
    );
  }, [onEdit]);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#020617' : '#f5f7fa' }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>Players</Text>

        <TouchableOpacity onPress={openCreate} style={styles.btn}>
          <Text style={styles.btnText}>+ Add Player</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={memoizedPlayers}
        keyExtractor={p => String(p.player_id)}
        renderItem={renderPlayer}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={true}
        getItemLayout={(data, index) => ({ length: 110, offset: 110 * index, index })}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? "#fff" : "#2563EB"}
          />
        }
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', color: isDark ? '#94a3b8' : '#000' }}>No players yet</Text>
        }
      />
    </View>
  );
};

const PlayerCard = React.memo(({ player, podSerial, podHolderSerial, clubName }: any) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <View style={[styles.card, { backgroundColor: isDark ? '#1e293b' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E5E7EB' }]}>
      <Text style={[styles.name, { color: isDark ? '#fff' : '#000' }]}>{player.player_name}</Text>

      <Text style={[styles.line, { color: isDark ? '#94a3b8' : '#334155' }]}>Age: {player.age}</Text>

      <Text style={[styles.line, { color: isDark ? '#94a3b8' : '#334155' }]}>#{player.jersey_number} • {player.position}</Text>

      <Text style={[styles.line, { color: isDark ? '#94a3b8' : '#334155' }]}>Pod: {podSerial}</Text>

      <Text style={[styles.line, { color: isDark ? '#94a3b8' : '#334155' }]}>Pod Holder: {podHolderSerial}</Text>

      <Text style={[styles.line, { color: isDark ? '#94a3b8' : '#334155' }]}>Club: {clubName}</Text>

      <Text style={[styles.line, { color: isDark ? '#94a3b8' : '#334155' }]}>Height: {player.height ? `${player.height} cm` : '—'}</Text>

      <Text style={[styles.line, { color: isDark ? '#94a3b8' : '#334155' }]}>Weight: {player.weight ? `${player.weight} kg` : '—'}</Text>

      <View style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: isDark ? '#334155' : '#E0F2FE', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6 }}>
        <Text style={{ color: isDark ? '#fff' : '#0369A1', fontSize: 12, fontWeight: '600' }}>Edit Player</Text>
      </View>
    </View>
  );
});

export default PlayersListScreen;
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  title: {
    fontSize: 20,
    fontWeight: '700',
  },

  btn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },

  btnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  card: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  line: {
    fontSize: 13,
    color: '#334155',
    marginTop: 2,
  },
});
