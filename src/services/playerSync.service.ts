import NetInfo from '@react-native-community/netinfo';
import { getMyClubPlayers, getMyClubPods, createPlayer, updatePlayer, getMyPodHolders } from '../api/players';
import { db } from '../db/sqlite';
import {
  upsertPlayersToSQLite,
  getPlayersFromSQLite,
  syncClubPlayersToSQLite,
  syncClubPodsToSQLite,
  syncClubPodHoldersToSQLite,
} from './playerCache.service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../utils/constants';

export const loadPlayersUnified = async () => {
  const net = await NetInfo.fetch();
  const clubId = await AsyncStorage.getItem(STORAGE_KEYS.CLUB_ID);

  // 🟢 ONLINE (Any source with internet reachability)
  const hasInternet = net.isConnected && (net.isInternetReachable !== false);
  if (hasInternet) {
    try {
      await syncPendingPlayers();
      const players = await getMyClubPlayers();
      const pods = await getMyClubPods().catch(() => []); // Fallback to empty if pods API fails
      const holders = await getMyPodHolders().catch(() => []);

      if (clubId) {
        if (players && players.length > 0) syncClubPlayersToSQLite(clubId, players);
        if (pods && pods.length > 0) syncClubPodsToSQLite(clubId, pods);
        if (holders && holders.length > 0) syncClubPodHoldersToSQLite(clubId, holders);
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

export const syncPendingPlayers = async () => {
  const net = await NetInfo.fetch();
  const hasInternet = net.isConnected && (net.isInternetReachable !== false);
  if (!hasInternet) return;

  try {
    const res = db.execute(`SELECT * FROM players WHERE sync_status != 0`);
    const pending = res?.rows?._array ?? [];
    if (pending.length === 0) return;

    console.log(`🔄 Syncing ${pending.length} pending players...`);

    for (const p of pending) {
      try {
        let payload = {
          player_name: p.player_name,
          age: p.age,
          jersey_number: p.jersey_number,
          position: p.position,
          height: p.height,
          weight: p.weight,
          hr_zones: p.hr_zones ? JSON.parse(p.hr_zones) : undefined,
          pod_id: p.pod_id,
        };

        if (p.sync_status === 1) {
          // PENDING CREATE
          console.log(`➕ Creating player: ${p.player_name}`);
          const created = await createPlayer(payload);
          const oldId = p.player_id;
          const newId = created.player_id;

          // 1. Delete temp record
          db.execute(`DELETE FROM players WHERE player_id = ?`, [oldId]);
          // 2. Save new record
          upsertPlayersToSQLite([created]);

          // 3. Update references in other tables
          if (oldId !== newId) {
            console.log(`🔄 Updating references: ${oldId} -> ${newId}`);
            try { db.execute(`UPDATE session_players SET player_id = ? WHERE player_id = ?`, [newId, oldId]); } catch { }
            try { db.execute(`UPDATE session_pod_overrides SET player_id = ? WHERE player_id = ?`, [newId, oldId]); } catch { }
            try { db.execute(`UPDATE calculated_data SET player_id = ? WHERE player_id = ?`, [newId, oldId]); } catch { }
            try { db.execute(`UPDATE player_thresholds SET player_id = ? WHERE player_id = ?`, [newId, oldId]); } catch { }
            try { db.execute(`UPDATE exercise_players SET player_id = ? WHERE player_id = ?`, [newId, oldId]); } catch { }
          }
        } else if (p.sync_status === 2) {
          // PENDING UPDATE
          console.log(`📝 Updating player: ${p.player_name} (${p.player_id})`);
          const updated = await updatePlayer(p.player_id, payload);
          upsertPlayersToSQLite([updated]);
        }
      } catch (err: any) {
        console.error(`❌ Failed to sync player ${p.player_name}:`, err?.message || err);
      }
    }
    console.log('✅ Sync pending players finished');
  } catch (e) {
    console.error('❌ Error in syncPendingPlayers:', e);
  }
};
