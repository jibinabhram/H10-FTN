import { db } from "../db/sqlite";
import api from "../api/axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../utils/constants";

export async function hydrateSessionHistory() {
    try {
        const clubId = await AsyncStorage.getItem(STORAGE_KEYS.CLUB_ID);
        if (!clubId) {
            console.log("⚠️ No club_id found for session history hydration");
            return;
        }

        console.log("⬇️ Hydrating session history from backend...");
        const res = await api.get("/events");
        const sessions = Array.isArray(res.data?.data ?? res.data) ? (res.data?.data ?? res.data) : [];

        if (sessions.length === 0) {
            console.log("ℹ️ No remote sessions found");
            return;
        }

        await db.execute("BEGIN");

        for (const s of sessions) {
            const sessionId = s.sessionId || s.event_id;
            if (!sessionId) continue;

            const existing = db.execute("SELECT session_id FROM sessions WHERE session_id = ?", [sessionId]);
            const rowCount = (existing as any)?.rows?.length || 0;

            if (rowCount > 0) {
                // Update existing record with backend data (location/ground might have changed)
                await db.execute(
                    `UPDATE sessions SET 
                        location = ?, 
                        field = ?, 
                        notes = ?, 
                        event_name = ?, 
                        event_type = ?, 
                        event_date = ?, 
                        club_id = ?,
                        synced_backend = 1 
                     WHERE session_id = ?`,
                    [
                        s.location || null,
                        s.ground_name || s.field || null,
                        s.notes || null,
                        s.event_name || 'Session',
                        s.event_type || 'training',
                        s.event_date || s.created_at,
                        s.club_id || clubId,
                        sessionId
                    ]
                );
            } else {
                // Insert new record from backend
                await db.execute(
                    `INSERT INTO sessions (
                        session_id, club_id, event_name, event_type, event_date, 
                        location, field, notes, created_at, synced_backend
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                    [
                        sessionId,
                        s.club_id || clubId,
                        s.event_name || 'Session',
                        s.event_type || 'training',
                        s.event_date || s.created_at,
                        s.location || null,
                        s.ground_name || s.field || null,
                        s.notes || null,
                        new Date(s.created_at || Date.now()).getTime()
                    ]
                );
            }
        }

        await db.execute("COMMIT");
        console.log(`✅ ${sessions.length} sessions hydrated from backend`);
    } catch (err) {
        try { await db.execute("ROLLBACK"); } catch { }
        console.error("❌ Failed to hydrate session history:", err);
    }
}
