import { db } from "../db/sqlite";
import { uploadCsv, triggerDeviceProcessing } from "../api/esp32";
import { getAssignedPlayersForSession } from "./sessionPlayer.service";
import { syncPendingMetrics } from "./syncMetrics.service";

export async function syncSessionToPodholder(sessionId: string) {
    console.log(`🚀 Starting sync for session: ${sessionId}`);

    try {
        // 1️⃣ Fetch Session Metadata for Times
        const sessionRes = await db.execute(
            `SELECT * FROM sessions WHERE session_id = ?`,
            [sessionId]
        );
        const session = sessionRes.rows?._array?.[0];
        if (!session) throw new Error("Session not found in DB");

        const startTs = session.trim_start_ts || session.file_start_ts || 0;
        const endTs = session.trim_end_ts || session.file_end_ts || 0;

        // 2️⃣ Fetch Players with effective Pods
        const assignedPlayers = getAssignedPlayersForSession(sessionId);
        const activePlayers = assignedPlayers.filter(p => p.assigned && p.effective_pod_serial);

        if (activePlayers.length === 0) {
            console.warn("⚠️ No assigned players with pods found for this session.");
        }

        // 3️⃣ BUILD CSV CONTENT
        // Format: player_id, device_id, session_id, starting_time, ending_time
        let csvContent = "player_id,device_id,session_id,starting_time,ending_time\n";

        activePlayers.forEach(p => {
            const line = `${p.player_id},${p.effective_pod_serial},${sessionId},${startTs},${endTs}`;
            csvContent += line + "\n";
        });

        // 4️⃣ LOG FOR DEVELOPER CHECKS
        console.log("---------------- SYNC LOG ----------------");
        console.log(`Session: ${sessionId}`);
        console.log("Generated Config CSV:");
        console.log(csvContent);

        // 5️⃣ UPLOAD TO PODHOLDER (ESP32)
        const filename = `${sessionId}_config.csv`;
        await uploadCsv(filename, csvContent);
        console.log(`✅ Config sent to Podholder: ${filename}`);

        // 6️⃣ WAIT 1 SECOND (As requested)
        console.log("⏳ Waiting 1s before triggering...");
        await new Promise(r => setTimeout(() => r(undefined), 1000));

        // 7️⃣ SEND POST TRIGGER & GET RESPONSE
        console.log("⚡ Sending POST Trigger...");
        const responseData = await triggerDeviceProcessing();

        console.log("------------------------------------------");
        console.log("📥 RECEIVED PROCESSED DATA FROM DEVICE:");
        console.log(responseData);
        console.log("------------------------------------------");

        // 8️⃣ PARSE & SAVE TO SQLITE
        try {
            const rows = responseData.split('\n').filter(r => r.trim() !== '');
            // CSV Header (19 cols): 
            // session_id, player_id, device_id, total_distance, hsr_distance, sprint_distance, 
            // top_speed, sprint_count, acceleration, deceleration, max_acceleration, max_deceleration, 
            // player_load, power_score, hr_max, time_in_red_zone, percent_in_red_zone, hr_recovery_time, recorded_at

            for (let i = 1; i < rows.length; i++) {
                const cols = rows[i].split(',');
                if (cols.length < 19) {
                    console.warn(`⚠️ Skipping row ${i}: insufficient columns (${cols.length})`);
                    continue;
                }

                // Map columns by index based on Python script order
                const playerId = cols[1].trim();
                const deviceId = cols[2].trim();

                const totalDist = parseFloat(cols[3] || '0');
                const hsrDist = parseFloat(cols[4] || '0');
                const sprintDist = parseFloat(cols[5] || '0');
                const topSpeed = parseFloat(cols[6] || '0');
                const sprintCount = parseInt(cols[7] || '0');

                const acc = parseFloat(cols[8] || '0');
                const dec = parseFloat(cols[9] || '0');
                const maxAcc = parseFloat(cols[10] || '0');
                const maxDec = parseFloat(cols[11] || '0');

                const pLoad = parseFloat(cols[12] || '0');
                const pScore = parseFloat(cols[13] || '0');
                const hrMax = parseInt(cols[14] || '0');
                const timeRed = parseFloat(cols[15] || '0');
                const pctRed = parseFloat(cols[16] || '0');
                const hrRec = parseFloat(cols[17] || '0');

                const recAt = parseInt(cols[18] || Date.now().toString());

                console.log(`💾 Saving metrics for Player ${playerId} (Device: ${deviceId})`);

                await db.execute(`
                 INSERT INTO calculated_data (
                   session_id, player_id, device_id,
                   total_distance, hsr_distance, sprint_distance, top_speed, sprint_count,
                   acceleration, deceleration, max_acceleration, max_deceleration,
                   player_load, power_score, hr_max, time_in_red_zone, percent_in_red_zone, hr_recovery_time,
                   recorded_at, synced
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
               `, [
                    sessionId, playerId, deviceId,
                    totalDist, hsrDist, sprintDist, topSpeed, sprintCount,
                    acc, dec, maxAcc, maxDec,
                    pLoad, pScore, hrMax, timeRed, pctRed, hrRec,
                    recAt
                ]);
            }
            console.log("✅ Processed data saved to SQLite");

        } catch (parseErr) {
            console.error("❌ Error parsing/saving device data:", parseErr);
            // Don't throw here? Or throw? If saving fails, maybe we should alert.
            throw parseErr;
        }

        // 9️⃣ SYNC TO BACKEND (When Net Available)
        // Trigger the sync service immediately
        syncPendingMetrics().catch(err => console.log("🔄 Background sync error:", err));

        return responseData;

    } catch (error) {
        console.error("❌ Sync/Trigger Failed:", error);
        throw error;
    }
}
