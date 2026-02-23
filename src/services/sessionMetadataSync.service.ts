import { db } from "../db/sqlite";
import api from "../api/axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../utils/constants";
import { cleanupSyncedSessions } from "./dbCleanup.service";

let isSyncing = false;

export async function syncPendingSessions() {
    if (isSyncing) return;
    isSyncing = true;

    try {
        let clubId = await AsyncStorage.getItem(STORAGE_KEYS.CLUB_ID);
        if (!clubId) {
            try {
                const profile = await api.get("/auth/profile");
                const fetchedClubId = profile?.data?.user?.club_id;
                if (fetchedClubId) {
                    const cid: string = fetchedClubId;
                    await AsyncStorage.setItem(STORAGE_KEYS.CLUB_ID, cid);
                    clubId = cid;
                    console.log("✅ club_id recovered from profile");
                }
            } catch (e: any) {
                const msg = e?.response?.data?.message || e?.message || "Unknown error";
                console.log(`⚠️ Failed to recover club_id from profile: ${msg}`);

                // FALLBACK: Try to get club_id from local players table
                try {
                    const pRes = db.execute(`SELECT club_id FROM players WHERE club_id IS NOT NULL LIMIT 1`);
                    const rows = (pRes as any)?.rows?._array || [];
                    if (rows.length > 0 && rows[0].club_id) {
                        const localClubId: string = rows[0].club_id;
                        await AsyncStorage.setItem(STORAGE_KEYS.CLUB_ID, localClubId);
                        clubId = localClubId;
                        console.log("✅ club_id recovered from local players table");
                    }
                } catch (err) {
                    console.log("⚠️ Failed to recover club_id from local players table", err);
                }
            }
        }

        if (!clubId) {
            console.log("⚠️ No club_id found in AsyncStorage for session sync");
            isSyncing = false;
            return;
        }

        const cid: string = clubId; // Local cast to string for TS

        // 1️⃣ Find sessions that haven't been synced to backend
        const res = db.execute(`SELECT * FROM sessions WHERE synced_backend = 0 OR synced_backend IS NULL`);
        const sessions = (res as any)?.rows?._array || [];

        if (sessions.length === 0) {
            console.log("✅ No pending sessions to sync to backend");
            isSyncing = false;
            return;
        }

        console.log(`⏫ Syncing ${sessions.length} sessions to backend...`);
        let syncCount = 0;

        for (const session of sessions) {
            try {
                // 2️⃣ Fetch Exercises for this session
                const exRes = db.execute(
                    `SELECT exercise_id as id, type, exrId, start_ts as start, end_ts as end, color 
                     FROM exercises WHERE session_id = ?`,
                    [session.session_id]
                );
                const exercisesRaw = (exRes as any)?.rows?._array || [];
                const exercises = [];

                for (const ex of exercisesRaw) {
                    const epRes = db.execute(
                        `SELECT player_id FROM exercise_players WHERE exercise_id = ?`,
                        [ex.id]
                    );
                    const players = ((epRes as any)?.rows?._array || []).map((p: any) => p.player_id);

                    // Normalize exercise timestamps to integers
                    exercises.push({
                        ...ex,
                        start: ex.start ? Math.floor(Number(ex.start)) : 0,
                        end: ex.end ? Math.floor(Number(ex.end)) : 0,
                        players
                    });
                }

                // 3️⃣ Normalize session timestamps for BigInt backend
                const payload = {
                    event_id: session.session_id,
                    club_id: cid,
                    event_name: session.event_name,
                    event_type: session.event_type,
                    event_date: session.event_date,
                    location: session.location,
                    field: session.field,
                    notes: session.notes,
                    file_start_ts: session.file_start_ts ? Math.floor(Number(session.file_start_ts)) : null,
                    file_end_ts: session.file_end_ts ? Math.floor(Number(session.file_end_ts)) : null,
                    trim_start_ts: session.trim_start_ts ? Math.floor(Number(session.trim_start_ts)) : null,
                    trim_end_ts: session.trim_end_ts ? Math.floor(Number(session.trim_end_ts)) : null,
                    recorded_at: session.created_at ? Math.floor(Number(session.created_at)) : null,
                    exercises,
                    participants: ((db.execute(
                        `SELECT player_id FROM session_players WHERE session_id = ? AND assigned = 1`,
                        [session.session_id]
                    ) as any).rows?._array || []).map((p: any) => p.player_id)
                };

                await api.post("/events/sync", payload);

                // Mark as synced locally
                db.execute(`UPDATE sessions SET synced_backend = 1 WHERE session_id = ?`, [session.session_id]);
                console.log(`✅ Session ${session.event_name || session.session_id} synced to backend`);
                syncCount++;
            } catch (err: any) {
                const errMsg = err?.response?.data?.message || err?.message || "Unknown error";
                console.error(`❌ Failed to sync session ${session.event_name || session.session_id} to backend:`, errMsg);

                // Show transient snackbar
                import("../components/context/SnackbarContext").then(({ showGlobalSnackbar }) => {
                    showGlobalSnackbar({
                        message: `Failed to sync ${session.event_name || 'Session'}: Connection error.`,
                        type: 'error',
                        skipNotification: true
                    });
                });

                if (err?.response?.status === 401) console.log("🔑 Auth expired, please log in again");
            }
        }

        if (syncCount > 0) {
            import("../components/context/SnackbarContext").then(({ showGlobalSnackbar }) => {
                showGlobalSnackbar({
                    message: `Backend sync successful`,
                    type: 'success'
                });
            });
            await cleanupSyncedSessions();
        }
    } catch (err) {
        console.error("❌ Session sync failed", err);
    } finally {
        isSyncing = false;
    }
}
