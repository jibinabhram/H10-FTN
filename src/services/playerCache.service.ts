import { db } from '../db/sqlite';

/* ================= WRITE ================= */
export const upsertPlayersToSQLite = (players: any[]) => {
  const failed: string[] = [];
  try {
    players.forEach(p => {
      const pod = p.player_pods?.[0]?.pod;

      try {
        db.execute(
          `
        INSERT OR REPLACE INTO players (
          player_id,
          club_id,
          player_name,
          jersey_number,
          age,
          position,
          pod_id,
          pod_serial,
          pod_device_id,
          pod_holder_serial,
          heartrate,
          height,
          weight,
          hr_zones,
          club_name,
          updated_at,
          sync_status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          [
            p.player_id,
            p.club_id,
            p.player_name,
            p.jersey_number,
            p.age ?? p.age_years ?? null,
            p.position,
            pod?.pod_id ?? p.pod_id ?? null,
            pod?.serial_number ?? p.pod_serial ?? null,
            pod?.device_id ?? p.pod_device_id ?? null,
            pod?.pod_holder?.serial_number ?? p.pod_holder_serial ?? null,
            p.heartrate ?? null,
            p.height ?? null,
            p.weight ?? null,
            p.hr_zones ? (typeof p.hr_zones === 'string' ? p.hr_zones : JSON.stringify(p.hr_zones)) : null,
            p.club?.club_name ?? p.club_name ?? null,
            Date.now(),
            p.sync_status ?? 0,
          ]
        );
        // success for this row
        // console.debug('✅ Upserted player to SQLite', p.player_id);
      } catch (err) {
        console.error('❌ Failed to upsert player to SQLite', p.player_id, err);
        failed.push(p.player_id);
      }
    });

    if (failed.length === 0) {
      console.log('✅ Players cached to SQLite');
    } else {
      console.warn('⚠️ Some players failed to cache to SQLite', failed);
    }

    return { success: failed.length === 0, failed };
  } catch (err) {
    console.error('❌ Failed to cache players', err);
    return { success: false, failed: players.map(p => p.player_id) };
  }
};

export const syncClubPlayersToSQLite = (clubId: string, players: any[]) => {
  if (!clubId) return false;
  try {
    // 1. Delete all players for this club
    db.execute('DELETE FROM players WHERE club_id = ?', [clubId]);

    // 2. Insert new list if not empty
    if (players && players.length > 0) {
      return upsertPlayersToSQLite(players);
    }
    return { success: true, failed: [] };
  } catch (e) {
    console.error('❌ Failed to sync club players to SQLite', e);
    return false;
  }
};

export const syncClubPodsToSQLite = (clubId: string, pods: any[]) => {
  if (!clubId) return false;
  try {
    if (pods && pods.length > 0) {
      db.execute('DELETE FROM pods WHERE club_id = ?', [clubId]);

      // Map holder IDs to Serials for lookup
      const holderRes = db.execute(`SELECT pod_holder_id, serial_number FROM pod_holders WHERE club_id = ?`, [clubId]);
      const holderMap: Record<string, string> = {};
      (holderRes?.rows?._array || []).forEach((h: any) => {
        if (h.pod_holder_id && h.serial_number) holderMap[h.pod_holder_id] = h.serial_number;
      });

      pods.forEach(p => {
        try {
          // Robust serial resolution
          const holderSerial = p.pod_holder_serial || p.pod_holder?.serial_number || (p.pod_holder_id ? holderMap[p.pod_holder_id] : null);

          db.execute(
            `INSERT OR REPLACE INTO pods (pod_id, serial_number, device_id, pod_holder_serial, club_id) VALUES (?,?,?,?,?)`,
            [p.pod_id, p.serial_number, p.device_id, holderSerial, clubId]
          );
        } catch (err) {
          console.error('❌ Failed to cache individual pod', p.pod_id, err);
        }
      });
      console.log('✅ Pods cached to SQLite:', pods.length);
    }
    return true;
  } catch (e) {
    console.error('❌ Failed to sync club pods to SQLite', e);
    return false;
  }
};

export const syncClubPodHoldersToSQLite = (clubId: string, holders: any[]) => {
  if (!clubId) return false;
  try {
    if (holders && holders.length > 0) {
      db.execute('DELETE FROM pod_holders WHERE club_id = ?', [clubId]);
      holders.forEach(h => {
        db.execute(
          `INSERT OR REPLACE INTO pod_holders (pod_holder_id, serial_number, device_id, model, club_id) VALUES (?,?,?,?,?)`,
          [h.pod_holder_id, h.serial_number, h.device_id, h.model, clubId]
        );
      });
    }
    console.log('✅ Pod holders cached to SQLite');
    return true;
  } catch (e) {
    console.error('❌ Failed to sync club pod holders to SQLite', e);
    return false;
  }
};

/* ================= READ ================= */
/* ================= READ ================= */
export const getPlayersFromSQLite = (clubId?: string) => {
  try {
    const query = clubId
      ? `SELECT * FROM players WHERE club_id = ? ORDER BY updated_at DESC`
      : `SELECT * FROM players ORDER BY updated_at DESC`;
    const params = clubId ? [clubId] : [];

    const result = db.execute(query, params);

    // ✅ quick-sqlite returns rows directly
    const rows = result?.rows?._array ?? [];

    // avoid logging full rows (can be very large and block JS thread)
    console.log('📦 SQLite players count:', rows.length);

    return rows;
  } catch (err) {
    console.error('❌ Failed to read players from SQLite', err);
    return [];
  }
};

/* ================= CLEAR (optional) ================= */
export const clearPlayersSQLite = () => {
  db.execute(`DELETE FROM players`);
};

export const getPlayerFromSQLite = (playerId: string) => {
  try {
    const res = db.execute(`SELECT * FROM players WHERE player_id = ?`, [playerId]);
    return res?.rows?._array?.[0] ?? null;
  } catch (err) {
    console.error('❌ Failed to read player from SQLite', playerId, err);
    return null;
  }
};

export const getPodsFromSQLite = (clubId?: string) => {
  try {
    const query = clubId
      ? `SELECT * FROM pods WHERE club_id = ?`
      : `SELECT * FROM pods`;
    const params = clubId ? [clubId] : [];
    const res = db.execute(query, params);
    return res?.rows?._array ?? [];
  } catch (err) {
    console.error('❌ Failed to read pods from SQLite', err);
    return [];
  }
};

export const getPodHoldersFromSQLite = (clubId?: string) => {
  try {
    const query = clubId
      ? `SELECT * FROM pod_holders WHERE club_id = ?`
      : `SELECT * FROM pod_holders`;
    const params = clubId ? [clubId] : [];
    const res = db.execute(query, params);
    return res?.rows?._array ?? [];
  } catch (err) {
    console.error('❌ Failed to read pod holders from SQLite', err);
    return [];
  }
};
