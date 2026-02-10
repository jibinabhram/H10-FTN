import { db } from "../db/sqlite";
import { fetchAllActivityMetrics } from "../api/activityMetrics";
import AsyncStorage from '@react-native-async-storage/async-storage';

/* -------------------------------
   Session reconstruction helper
-------------------------------- */

function buildSessionId(date: Date) {
  // Example: 2024-03-18_10AM
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hour = d.getHours();

  return `${y}-${m}-${day}_H${hour}`;
}

/* -------------------------------
   Hydration logic
-------------------------------- */

export async function hydrateSQLiteFromBackend() {
  const count = db.execute(
    `SELECT COUNT(*) as c FROM calculated_data`
  ).rows._array[0].c;

  if (count > 0) {
    console.log('ℹ️ SQLite already hydrated');
    return;
  }

  console.log('⬇️ Hydrating SQLite from backend...');

  try {
    const remoteMetrics = await fetchAllActivityMetrics();

    if (!remoteMetrics.length) {
      console.log('⚠️ No backend metrics found');
      return;
    }

    await db.execute('BEGIN');

    for (const m of remoteMetrics) {
      const sessionId = buildSessionId(new Date(m.recorded_at));

      await db.execute(
        `
        INSERT INTO calculated_data (
          session_id,
          player_id,
          device_id,
          total_distance,
          hsr_distance,
          sprint_distance,
          top_speed,
          sprint_count,
          acceleration,
          deceleration,
          max_acceleration,
          max_deceleration,
          player_load,
          power_score,
          hr_max,
          time_in_red_zone,
          percent_in_red_zone,
          hr_recovery_time,
          recorded_at,
          synced
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `,
        [
          m.sessionId || sessionId,
          m.playerId || m.player_id,
          m.deviceId || m.device_id,
          m.totalDistance || m.total_distance,
          m.hsrDistance || m.hsr_distance,
          m.sprintDistance || m.sprint_distance,
          m.topSpeed || m.top_speed,
          m.sprintCount || m.sprint_count,
          m.acceleration,
          m.deceleration,
          m.maxAcceleration || m.max_acceleration,
          m.maxDeceleration || m.max_deceleration,
          m.playerLoad || m.player_load,
          m.powerScore || m.power_score,
          m.hrMax || m.hr_max,
          m.timeInRedZone || m.time_in_red_zone,
          m.percentInRedZone || m.percent_in_red_zone,
          m.hrRecoveryTime || m.hr_recovery_time,
          m.recordedAt ? new Date(m.recordedAt).getTime() : new Date(m.recorded_at).getTime(),
        ]
      );
    }

    await db.execute('COMMIT');
    console.log('✅ SQLite hydration completed');
  } catch (e) {
    // Only rollback if a transaction was actually started
    try {
      await db.execute('ROLLBACK');
    } catch (rbError) {
      // Ignore rollback errors if no transaction was active
    }
    console.error('❌ Hydration failed', e);
  }
}


