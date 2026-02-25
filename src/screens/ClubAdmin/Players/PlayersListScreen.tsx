import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { getMyClubPlayers } from '../../../api/players';
import { loadPlayersUnified } from '../../../services/playerSync.service';
import { getPlayersFromSQLite } from '../../../services/playerCache.service';
import { useTheme } from '../../../components/context/ThemeContext';
import { useAlert } from '../../../components/context/AlertContext';


const PlayersListScreen = ({ openCreate, onEdit }: { openCreate: () => void; onEdit: (player: any) => void }) => {
  const { theme } = useTheme();
  const { showAlert } = useAlert();
  const isDark = theme === "dark";
  const [players, setPlayers] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);


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
        showAlert({
          title: 'Offline',
          message: 'You are offline. Showing last available data.',
          type: 'info',
        });
        return;
      }

      showAlert({
        title: 'Error',
        message: 'Failed to load players',
        type: 'error',
      });
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
        showAlert({
          title: 'Error',
          message: 'Failed to refresh players',
          type: 'error',
        });
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>Players</Text>
          <TouchableOpacity onPress={() => setShowHowTo(true)}>
            <Ionicons name="information-circle-outline" size={26} color={isDark ? '#94A3B8' : '#64748B'} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={openCreate} style={[styles.btn, { backgroundColor: '#DC2626', flexDirection: 'row', alignItems: 'center' }]}>
          <Ionicons name="add" size={20} color="#fff" style={{ marginRight: 4 }} />
          <Text style={styles.btnText}>Add Player</Text>
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
            tintColor={isDark ? "#fff" : "#DC2626"}
          />
        }
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', color: isDark ? '#94a3b8' : '#000' }}>No players yet</Text>
        }
      />

      <Modal
        visible={showHowTo}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHowTo(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#1e293b' : '#fff' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#1e293b' }]}>How to Manage Players</Text>
              <TouchableOpacity onPress={() => setShowHowTo(false)}>
                <Ionicons name="close" size={24} color={isDark ? '#94a3b8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.step}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
                <View style={styles.stepTextContainer}>
                  <Text style={[styles.stepTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Register Players</Text>
                  <Text style={[styles.stepDesc, { color: isDark ? '#94a3b8' : '#64748B' }]}>Tap the "+ Add Player" button to create a new profile for your team members.</Text>
                </View>
              </View>

              <View style={styles.step}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
                <View style={styles.stepTextContainer}>
                  <Text style={[styles.stepTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Link Hardware Pods</Text>
                  <Text style={[styles.stepDesc, { color: isDark ? '#94a3b8' : '#64748B' }]}>Every player needs a pod. Select a Pod Holder and choose an available pod from the list.</Text>
                </View>
              </View>

              <View style={styles.step}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
                <View style={styles.stepTextContainer}>
                  <Text style={[styles.stepTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Switch or Unassign</Text>
                  <Text style={[styles.stepDesc, { color: isDark ? '#94a3b8' : '#64748B' }]}>If you need to change a pod, just tap on the player card to open the assignment popup.</Text>
                </View>
              </View>

              <View style={styles.step}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>4</Text></View>
                <View style={styles.stepTextContainer}>
                  <Text style={[styles.stepTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Ready for Session</Text>
                  <Text style={[styles.stepDesc, { color: isDark ? '#94a3b8' : '#64748B' }]}>Once assigned, the player's data will be tracked during your next monitored session.</Text>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowHowTo(false)}>
              <Text style={styles.closeModalBtnText}>Got it!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    marginTop: 45,
    paddingRight: 60,
  },

  title: {
    fontSize: 20,
    fontWeight: '700',
  },

  btn: {
    backgroundColor: '#DC2626',
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

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  step: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 16,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  stepTextContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  stepDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  closeModalBtn: {
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  closeModalBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
