import { db } from "../db/sqlite";
import { uploadCsv } from "../api/esp32";

export async function syncSessionToPodholder(sessionId: string) {
    console.log(`🚀 Starting sync for session: ${sessionId}`);

    try {
        // 1️⃣ Fetch Session Metadata
        const sessionRes = await db.execute(
            `SELECT * FROM sessions WHERE session_id = ?`,
            [sessionId]
        );
        const session = sessionRes.rows?._array?.[0];
        if (!session) throw new Error("Session not found in DB");

        // 2️⃣ Fetch Exercises
        const exercisesRes = await db.execute(
            `SELECT * FROM exercises WHERE session_id = ? ORDER BY start_ts ASC`,
            [sessionId]
        );
        const exercises = exercisesRes.rows?._array ?? [];

        // 3️⃣ Fetch Players for each exercise
        const fullExercises = [];
        for (const ex of exercises) {
            const epRes = await db.execute(
                `SELECT player_id FROM exercise_players WHERE exercise_id = ?`,
                [ex.exercise_id]
            );
            const players = (epRes.rows?._array ?? []).map((r: any) => r.player_id);
            fullExercises.push({ ...ex, players });
        }

        // 4️⃣ Fetch Raw Data
        const rawDataRes = await db.execute(
            `
      SELECT 
        player_id, 
        timestamp_ms, 
        acc_x, acc_y, acc_z, 
        quat_w, quat_x, quat_y, quat_z, 
        lat, lon, 
        heartrate 
      FROM raw_data 
      WHERE session_id = ? 
      ORDER BY timestamp_ms ASC
      `,
            [sessionId]
        );
        const rawRows = rawDataRes.rows?._array ?? [];

        // 5️⃣ BUILD CSV CONTENT
        let csvContent = "";

        // -- Section: SESSION METADATA --
        csvContent += "### SESSION METADATA ###\n";
        csvContent += `Session ID: ${session.session_id}\n`;
        csvContent += `Event Name: ${session.event_name}\n`;
        csvContent += `Event Type: ${session.event_type}\n`;
        csvContent += `Event Date: ${session.event_date}\n`;
        csvContent += `Location: ${session.location || ""}\n`;
        csvContent += `Field: ${session.field || ""}\n`;
        csvContent += `Notes: ${session.notes || ""}\n`;
        csvContent += `Trim Start: ${session.trim_start_ts || ""}\n`;
        csvContent += `Trim End: ${session.trim_end_ts || ""}\n`;
        csvContent += "\n";

        // -- Section: EXERCISES --
        csvContent += "### EXERCISES ###\n";
        csvContent += "Type,Start_TS,End_TS,Players\n";
        fullExercises.forEach(ex => {
            csvContent += `${ex.type},${ex.start_ts},${ex.end_ts},"${ex.players.join(";")}"\n`;
        });
        csvContent += "\n";

        // -- Section: RAW DATA --
        csvContent += "### RAW DATA ###\n";
        const header = [
            "player_id",
            "timestamp_ms",
            "acc_x", "acc_y", "acc_z",
            "quat_w", "quat_x", "quat_y", "quat_z",
            "lat", "lon",
            "heartrate"
        ].join(",");
        csvContent += header + "\n";

        rawRows.forEach(r => {
            csvContent += [
                r.player_id,
                r.timestamp_ms,
                r.acc_x, r.acc_y, r.acc_z,
                r.quat_w, r.quat_x, r.quat_y, r.quat_z,
                r.lat, r.lon,
                r.heartrate
            ].join(",") + "\n";
        });

        // 6️⃣ LOG FOR DEVELOPER CHECKS
        console.log("---------------- SYNC LOG ----------------");
        console.log(`Session: ${session.event_name} (${sessionId})`);
        console.log(`Exercises Count: ${fullExercises.length}`);
        console.log(`Raw Data Points: ${rawRows.length}`);
        console.log("Added Metadata Lines:");
        console.log(csvContent.split("\n").slice(0, 15).join("\n") + "\n...");
        console.log("------------------------------------------");

        // 7️⃣ UPLOAD TO PODHOLDER (ESP32)
        const filename = `${sessionId}_synced.csv`;
        try {
            await uploadCsv(filename, csvContent);
            console.log(`✅ Session ${sessionId} synced successfully to ESP32 as ${filename}`);
        } catch (espErr) {
            console.warn("⚠️ ESP32 Upload failed (may be offline):", espErr);
        }

        // 8️⃣ UPLOAD TO BACKEND API (Postgres)
        // Ensure you have an endpoint POST /events/sync configured in your backend
        // We send the structured session object + exercises list
        try {
            const payload = {
                session: {
                    ...session,
                    // Ensure dates are ISO strings if needed, though usually string in DB is fine
                },
                exercises: fullExercises,
                // We typically DO NOT send raw data here as it's too large, 
                // but if needed, you can include specific metrics or summary stats.
            };

            // Uncomment this when your backend endpoint is ready
            // await api.post('/events/sync', payload);
            console.log("✅ Session synced to Backend API (simulated)");

        } catch (apiErr) {
            console.error("❌ Backend Sync Failed:", apiErr);
            // We don't throw here to ensure local flow completes if needed
        }

        return true;

    } catch (error) {
        console.error("❌ Sync to Podholder Failed:", error);
        throw error;
    }
}
