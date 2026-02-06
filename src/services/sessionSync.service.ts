import { db } from "../db/sqlite";
import { uploadCsv } from "../api/esp32";
import { getAssignedPlayersForSession } from "./sessionPlayer.service";

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
        // Format: session_id,player_id,device_id,starting_time,ending_time
        let csvContent = "session_id,player_id,device_id,starting_time,ending_time\n";

        activePlayers.forEach(p => {
            const line = `${sessionId},${p.player_id},${p.effective_pod_serial},${startTs},${endTs}`;
            csvContent += line + "\n";
        });

        // 4️⃣ LOG FOR DEVELOPER CHECKS
        console.log("---------------- SYNC LOG ----------------");
        console.log(`Session: ${sessionId}`);
        console.log(`Time Range: ${startTs} - ${endTs}`);
        console.log(`Players Count: ${activePlayers.length}`);
        console.log("Generated Data:");
        console.log(csvContent);
        console.log("------------------------------------------");

        // 5️⃣ UPLOAD TO PODHOLDER (ESP32)
        const filename = `${sessionId}_config.csv`; // using _config to denote this is configuration/mapping data
        try {
            await uploadCsv(filename, csvContent);
            console.log(`✅ Session configuration sent to Podholder: ${filename}`);
            console.log("DATA SENT SUCCESSFULLY"); // Explicit confirmation as requested
        } catch (espErr) {
            console.warn("⚠️ ESP32 Upload failed (check connection):", espErr);
            throw espErr; // Re-throw to alert the UI
        }

        return true;

    } catch (error) {
        console.error("❌ Sync to Podholder Failed:", error);
        throw error;
    }
}
