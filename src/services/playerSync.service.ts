import NetInfo from '@react-native-community/netinfo';
import { getMyClubPlayers, getMyClubPods } from '../api/players';
import {
  upsertPlayersToSQLite,
  getPlayersFromSQLite,
  syncClubPlayersToSQLite,
  syncClubPodsToSQLite,
} from './playerCache.service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../utils/constants';

export const loadPlayersUnified = async () => {
  const net = await NetInfo.fetch();
  const clubId = await AsyncStorage.getItem(STORAGE_KEYS.CLUB_ID);

  // 🟢 ONLINE
  if (net.isConnected) {
    try {
      const players = await getMyClubPlayers();
      const pods = await getMyClubPods().catch(() => []); // Fallback to empty if pods API fails

      if (clubId) {
        syncClubPlayersToSQLite(clubId, players);
        syncClubPodsToSQLite(clubId, pods);
      } else {
        upsertPlayersToSQLite(players);
      }

      return players;
    } catch (e) {
      console.log('⚠️ Online but API failed, using SQLite cache');

      const cached = getPlayersFromSQLite(clubId || undefined);
      console.log('📦 SQLite players count (from cache):', cached.length);

      return cached;
    }
  }

  // 🔴 OFFLINE
  console.log('📴 Offline → loading players from SQLite');

  const cached = getPlayersFromSQLite(clubId || undefined);
  console.log('📦 SQLite players count (from cache):', cached.length);

  return cached;
};
