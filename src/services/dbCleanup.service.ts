import { db } from "../db/sqlite";

/**
 * Deletes sessions from SQLite that are fully synced (metadata + metrics)
 */
export async function cleanupSyncedSessions() {
    try {
        const res = db.execute(`SELECT session_id FROM sessions WHERE synced_backend = 1`);
        const syncedSessions = (res as any)?.rows?._array || [];

        for (const s of syncedSessions) {
            const sid = s.session_id;
            // If no metrics remaining for this session, we can delete the record
            const mRes = db.execute(`SELECT COUNT(*) as cnt FROM calculated_data WHERE session_id = ?`, [sid]);
            const count = (mRes as any)?.rows?._array?.[0]?.cnt || 0;

            if (count === 0) {
                console.log(`🧼 Cleaning up fully synced session ${sid} from SQLite`);
                db.execute(`DELETE FROM exercise_players WHERE exercise_id IN (SELECT exercise_id FROM exercises WHERE session_id = ?)`, [sid]);
                db.execute(`DELETE FROM exercises WHERE session_id = ?`, [sid]);
                db.execute(`DELETE FROM session_players WHERE session_id = ?`, [sid]);
                db.execute(`DELETE FROM session_pod_overrides WHERE session_id = ?`, [sid]);
                db.execute(`DELETE FROM sessions WHERE session_id = ?`, [sid]);
            }
        }
    } catch (err) {
        console.error("❌ Cleanup synced sessions failed:", err);
    }
}
