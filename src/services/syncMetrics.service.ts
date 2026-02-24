import { db } from "../db/sqlite";
import { syncActivityMetric } from "../api/sync";
import { cleanupSyncedSessions } from "./dbCleanup.service";

let isSyncing = false;
export async function syncPendingMetrics() {
  if (isSyncing) {
    console.log("⏸️ Sync already running");
    return;
  }

  isSyncing = true;
  try {
    const res = db.execute(
      `SELECT c.*, s.event_name FROM calculated_data c
       JOIN sessions s ON s.session_id = c.session_id
       WHERE c.synced = 0 AND s.synced_backend = 1`
    );

    const rows = res.rows?._array || [];

    if (!rows.length) {
      const pendingRes = db.execute(
        `SELECT COUNT(*) as cnt FROM calculated_data WHERE synced = 0`
      );
      const pending = pendingRes.rows?._array?.[0]?.cnt ?? 0;
      if (pending > 0) {
        console.log("⏳ Metrics pending but sessions not synced yet");
      } else {
        console.log("✅ No pending metrics to sync");
      }
      // Still attempt cleanup for already finished sessions
      await cleanupSyncedSessions();
      return;
    }

    console.log(`⏫ Syncing ${rows.length} metrics`);
    let syncCount = 0;

    for (const row of rows) {
      try {
        await syncActivityMetric({
          session_id: row.session_id,
          player_id: row.player_id,
          metrics: {
            ...row,
            recorded_at: row.recorded_at ? Math.floor(Number(row.recorded_at)) : Date.now()
          },
        });

        // ✅ DELETE from SQLite ONLY after success
        await db.execute(
          `DELETE FROM calculated_data WHERE id = ?`,
          [row.id]
        );
        syncCount++;
      } catch (err: any) {
        const errMsg = err?.response?.data?.message || err?.message || "Unknown error";
        console.log(`❌ Failed to sync metric for Player ${row.player_id} in Session ${row.event_name || row.session_id}: ${errMsg}`);

        // Show transient snackbar
        console.log(`❌ Failed to sync metrics for ${row.event_name || 'Session'}: ${errMsg}`);

        if (!err.response) break;
      }
    }

    if (syncCount > 0) {
      import("../components/context/SnackbarContext").then(({ showGlobalSnackbar }) => {
        showGlobalSnackbar({
          message: `Backend sync successful`,
          type: 'success'
        });
      });
    }

    // --- CLEANUP SYNCED SESSIONS ---
    await cleanupSyncedSessions();

    console.log("✅ Metrics sync batch finished");
  } catch (err) {
    const errMsg = (err as any)?.response?.data?.message || (err as any)?.message || "Unknown error";
    console.log(`❌ Metrics Sync overall failure: ${errMsg}`);
  } finally {
    isSyncing = false;
  }
}
