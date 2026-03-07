import { db } from "../db/sqlite";

/* =====================================================
   SESSION PLAYERS (ASSIGN / UNASSIGN)
   ===================================================== */

export const saveSessionPlayers = (
  sessionId: string,
  assignedMap: Record<string, boolean>
) => {
  try {
    // 1. Map all players in assignedMap to their assigned status
    // We don't DELETE because we want to preserve trim_start_ts/trim_end_ts columns

    Object.entries(assignedMap).forEach(([playerId, assigned]) => {
      // Ensure record exists
      db.execute(
        `INSERT OR IGNORE INTO session_players (session_id, player_id, assigned) VALUES (?, ?, ?)`,
        [sessionId, playerId, 0]
      );

      // Update assigned status
      db.execute(
        `UPDATE session_players SET assigned = ? WHERE session_id = ? AND player_id = ?`,
        [assigned ? 1 : 0, sessionId, playerId]
      );
    });

    console.log("✅ Session players saved (preserved trim points)");
  } catch (err) {
    console.error("❌ Failed to save session players", err);
  }
};

/* =====================================================
   SESSION POD OVERRIDES (SWAP / DISABLE)
   ===================================================== */

export const saveSessionPodOverrides = (
  sessionId: string,
  podMap: Record<string, string | null>
) => {
  try {
    db.execute(
      `DELETE FROM session_pod_overrides WHERE session_id = ?`,
      [sessionId]
    );

    Object.entries(podMap).forEach(([podSerial, playerId]) => {
      db.execute(
        `
        INSERT INTO session_pod_overrides (
          session_id,
          pod_serial,
          player_id
        )
        VALUES (?, ?, ?)
        `,
        [sessionId, podSerial, playerId]
      );
    });

    console.log("💾 SAVE POD OVERRIDES:", JSON.stringify(podMap, null, 2));
    console.log("✅ Session pod overrides saved");
  } catch (err) {
    console.error("❌ Failed to save pod overrides", err);
  }
};

/* =====================================================
   READ: PLAYERS + ASSIGNMENT + POD OVERRIDES
   ===================================================== */

export const getAssignedPlayersForSession = (sessionId: string) => {
  try {
    /* =============================
       1️⃣ Load players + assignment
       ============================= */

    const playersRes = db.execute(
      `
      SELECT
        p.player_id,
        p.player_name,
        p.jersey_number,
        p.position,
        p.pod_serial AS default_pod_serial,
        p.pod_device_id AS default_pod_device_id,
        sp.assigned,
        sp.trim_start_ts,
        sp.trim_end_ts
      FROM session_players sp
      JOIN players p ON p.player_id = sp.player_id
      WHERE sp.session_id = ?
      ORDER BY p.jersey_number ASC
      `,
      [sessionId]
    );

    const players = playersRes?.rows?._array ?? [];

    /* =============================
       2️⃣ Load pod overrides
       ============================= */

    const overridesRes = db.execute(
      `
      SELECT pod_serial, player_id
      FROM session_pod_overrides
      WHERE session_id = ?
      `,
      [sessionId]
    );

    const podToPlayer: Record<string, string | null> = {};
    (overridesRes?.rows?._array ?? []).forEach(r => {
      podToPlayer[r.pod_serial] = r.player_id; // null = disabled
    });

    /* =============================
       3️⃣ Build player → effective pod
       ============================= */

    const playerToOverridePod: Record<string, string> = {};
    Object.entries(podToPlayer).forEach(([podSerial, playerId]) => {
      if (playerId) {
        playerToOverridePod[playerId] = podSerial;
      }
    });

    // We need to resolve device IDs for ALL pods involved (defaults and overrides)
    const serialToDeviceId: Record<string, string> = {};

    // 1️⃣ Seed from ALL known players in the DB to resolve overridden pods
    try {
      const allPlayersRes = db.execute(`SELECT pod_serial, pod_device_id FROM players WHERE pod_serial IS NOT NULL AND pod_device_id IS NOT NULL`);
      (allPlayersRes?.rows?._array ?? []).forEach((r: any) => {
        serialToDeviceId[r.pod_serial] = r.pod_device_id;
      });
    } catch (err) { }

    // 2️⃣ Fallback to pods table for any remaining unknown serials
    const allSerials = new Set<string>();
    players.forEach(p => { if (p.default_pod_serial) allSerials.add(p.default_pod_serial); });
    Object.keys(podToPlayer).forEach(s => allSerials.add(s));

    const missingSerials = Array.from(allSerials).filter(s => !serialToDeviceId[s]);

    if (missingSerials.length > 0) {
      try {
        const placeholders = missingSerials.map(() => '?').join(',');
        const podsRes = db.execute(`SELECT serial_number, device_id FROM pods WHERE serial_number IN (${placeholders})`, missingSerials);
        (podsRes?.rows?._array ?? []).forEach(row => {
          if (row.device_id) serialToDeviceId[row.serial_number] = row.device_id;
        });
      } catch (err) {
        console.error("❌ Failed to resolve device IDs from pods table", err);
      }
    }

    /* =============================
       4️⃣ Final normalized output
       ============================= */

    return players.map(p => {
      let effectivePod = null;

      // 1. Is there an explicit positive override for this player?
      if (playerToOverridePod[p.player_id]) {
        effectivePod = playerToOverridePod[p.player_id];
      }
      // 2. If not, do they have a default pod?
      else if (p.default_pod_serial) {
        // 3. Is the default pod "touched" by overrides? (Reassigned or Disabled)
        if (podToPlayer.hasOwnProperty(p.default_pod_serial)) {
          // Yes, it was overridden (to someone else OR to null).
          // Since step 1 didn't find a new pod for this player, they have NO pod.
          effectivePod = null;
        } else {
          // No, default stands.
          effectivePod = p.default_pod_serial;
        }
      }

      const swapped =
        effectivePod !== null &&
        effectivePod !== p.default_pod_serial;

      return {
        ...p,
        jersey_number: p.jersey_number ? Number(p.jersey_number) : null,
        trim_start_ts: p.trim_start_ts ? Number(p.trim_start_ts) : null,
        trim_end_ts: p.trim_end_ts ? Number(p.trim_end_ts) : null,
        assigned: !!p.assigned,
        effective_pod_serial: effectivePod,
        effective_pod_device_id: effectivePod
          ? (serialToDeviceId[effectivePod] || (effectivePod === p.default_pod_serial ? p.default_pod_device_id : effectivePod))
          : null,
        swapped,
        pod_disabled: effectivePod === null,
      };
    });

  } catch (err) {
    console.error("❌ Failed to read session players", err);
    return [];
  }
};

/* =====================================================
   READ: POD OVERRIDES (USED DURING IMPORT)
   ===================================================== */

export const getSessionPodOverrides = (sessionId: string) => {
  try {
    const res = db.execute(
      `
      SELECT pod_serial, player_id
      FROM session_pod_overrides
      WHERE session_id = ?
      `,
      [sessionId]
    );

    const map: Record<string, string | null> = {};
    (res?.rows?._array ?? []).forEach(r => {
      map[r.pod_serial] = r.player_id; // null = disabled
    });

    return map;
  } catch (err) {
    console.error("❌ Failed to read pod overrides", err);
    return {};
  }
};
