import { db } from "../db/sqlite";
import { fetchAllActivityMetrics } from "../api/activityMetrics";
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

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
  try {
    const net = await NetInfo.fetch();
    const hasInternet = net.isConnected && net.isInternetReachable !== false;

    if (!hasInternet) {
      console.log('📴 Offline - skipping SQLite hydration');
      return;
    }

    console.log('⬇️ Hydrating SQLite from backend...');

    try {
      const remoteMetrics = await fetchAllActivityMetrics();

      if (!remoteMetrics || remoteMetrics.length === 0) {
        console.log('⚠️ No backend metrics found, clearing old synced cache');
        await db.execute('DELETE FROM calculated_data WHERE synced = 1');
        return;
      }

      await db.execute('BEGIN');

      // Remove all old cached metrics purely downloaded from backend
      await db.execute('DELETE FROM calculated_data WHERE synced = 1');

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
  } catch (e) {
    console.error('❌ Hydration process failed entirely', e);
  }
}
