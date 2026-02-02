import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { getMyClubPlayers } from '../../../api/players';
import { loadPlayersUnified } from '../../../services/playerSync.service';


const PlayersListScreen = ({ openCreate }: { openCreate: () => void }) => {
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);


  const loadPlayers = async () => {
    try {
      setLoading(true);
      const data = await loadPlayersUnified();

      if (Array.isArray(data)) {
        setPlayers(data);
      } else {
        setPlayers([]);
      }
    } catch (e: any) {
      if (e?.isOffline) {
        Alert.alert(
          'Offline',
          'You are offline. Showing last available data.',
        );
        return;
      }

      Alert.alert(
        'Error',
        'Failed to load players',
      );
    } finally {
      setLoading(false);
    }
  };
  // 🔥 THIS is the key fix
  useFocusEffect(
    useCallback(() => {
      loadPlayers();
    }, [])
  );
  const memoizedPlayers = useMemo(() => players, [players]);

  const renderPlayer = useCallback(({ item }) => {
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
      <PlayerCard
        player={item}
        podSerial={podSerial}
        podHolderSerial={podHolderSerial}
        clubName={clubName}
      />
    );
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Players</Text>

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
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="small" />
          ) : (
            <Text style={{ textAlign: 'center' }}>No players yet</Text>
          )
        }
      />
    </View>
  );
};

const PlayerCard = React.memo(({ player, podSerial, podHolderSerial, clubName }: any) => {
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{player.player_name}</Text>

      <Text style={styles.line}>Age: {player.age}</Text>

      <Text style={styles.line}>#{player.jersey_number} • {player.position}</Text>

      <Text style={styles.line}>Pod: {podSerial}</Text>

      <Text style={styles.line}>Pod Holder: {podHolderSerial}</Text>

      <Text style={styles.line}>Club: {clubName}</Text>
      
          <Text style={styles.line}>Height: {player.height ? `${player.height} cm` : '—'}</Text>

          <Text style={styles.line}>Weight: {player.weight ? `${player.weight} kg` : '—'}</Text>
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
