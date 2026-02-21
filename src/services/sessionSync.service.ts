import { db } from "../db/sqlite";
import { uploadCsv, triggerDeviceProcessing } from "../api/esp32";
import { getAssignedPlayersForSession } from "./sessionPlayer.service";
import { syncPendingMetrics } from "./syncMetrics.service";
import { syncPendingSessions } from "./sessionMetadataSync.service";

type ParsedMetricRow = {
    sessionId: string;
    playerId: string;
    deviceId: string;
    totalDistance: number;
    hsrDistance: number;
    sprintDistance: number;
    topSpeed: number;
    sprintCount: number;
    acceleration: number;
    deceleration: number;
    maxAcceleration: number;
    maxDeceleration: number;
    playerLoad: number;
    powerScore: number;
    hrMax: number;
    timeInRedZone: number;
    percentInRedZone: number;
    hrRecoveryTime: number;
    recordedAt: number;
    exrId: string | null;
};

function csvEscape(value: any) {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (/[",\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function normalizeHeaderKey(value: string) {
    return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isNumericLike(value: string) {
    return /^-?\d+(\.\d+)?$/.test(value.trim());
}

function detectNonHeaderOffset(cols: string[]) {
    if (cols.length < 19) return 0;
    const col0 = (cols[0] || "").trim();
    const col1 = (cols[1] || "").trim();
    // If col0 looks like a session_id (e.g. 2026-02-21...) or uuid
    if (col0.includes("-") || col0.length > 10) return 0;
    // If col1 looks like the start of data instead
    if (col1.includes("-") || col1.length > 10) return 1;
    return 0;
}

function parseFloatSafe(value: string, fallback = 0) {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
}

function parseIntSafe(value: string, fallback = 0) {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : fallback;
}

function sanitizeSessionId(value: string) {
    return String(value || "").trim().replace(/\.csv$/i, "");
}

function parseDeviceMetricsCsv(payload: string, fallbackSessionId: string): ParsedMetricRow[] {
    const normalized = payload.replace(/\r/g, "").trim();
    if (!normalized) return [];

    const lines = normalized.split("\n").map(l => l.trim()).filter(Boolean);
    if (!lines.length) return [];

    const headerCols = lines[0].split(",").map(c => c.trim());
    const headerMap: Record<string, number> = {};
    headerCols.forEach((h, i) => {
        headerMap[normalizeHeaderKey(h)] = i;
    });

    const hasHeader = ["sessionid", "playerid", "deviceid"].some(k => k in headerMap);
    const startIndex = hasHeader ? 1 : 0;
    const fallbackOffset = hasHeader ? 0 : detectNonHeaderOffset(lines[startIndex]?.split(",") ?? []);

    const idx = (name: string, fallback?: number) => {
        const key = normalizeHeaderKey(name);
        if (hasHeader && headerMap[key] !== undefined) return headerMap[key];
        if (fallback === undefined) return -1;
        return fallback + fallbackOffset;
    };

    const getValue = (cols: string[], name: string, fallback?: number) => {
        const i = idx(name, fallback);
        if (i >= 0 && i < cols.length) return cols[i].trim();
        return "";
    };

    const out: ParsedMetricRow[] = [];

    for (let i = startIndex; i < lines.length; i++) {
        const cols = lines[i].split(",");
        if (cols.length < 4) continue;

        const sessionIdRaw = getValue(cols, "session_id", hasHeader ? undefined : 0) || fallbackSessionId;
        const sessionId = sanitizeSessionId(sessionIdRaw || fallbackSessionId);
        const playerId = getValue(cols, "player_id", hasHeader ? undefined : 1);
        if (!playerId) {
            console.warn(`⚠️ Skipping row ${i}: missing player_id`);
            continue;
        }

        const deviceId = getValue(cols, "device_id", hasHeader ? undefined : 2);

        const totalDistance = parseFloatSafe(getValue(cols, "total_distance", hasHeader ? undefined : 3));
        const hsrDistance = parseFloatSafe(getValue(cols, "hsr_distance", hasHeader ? undefined : 4));
        const sprintDistance = parseFloatSafe(getValue(cols, "sprint_distance", hasHeader ? undefined : 5));
        const topSpeed = parseFloatSafe(getValue(cols, "top_speed", hasHeader ? undefined : 6));
        const sprintCount = parseIntSafe(getValue(cols, "sprint_count", hasHeader ? undefined : 7));

        const acceleration = parseFloatSafe(getValue(cols, "acceleration", hasHeader ? undefined : 8));
        const deceleration = parseFloatSafe(getValue(cols, "deceleration", hasHeader ? undefined : 9));
        const maxAcceleration = parseFloatSafe(getValue(cols, "max_acceleration", hasHeader ? undefined : 10));
        const maxDeceleration = parseFloatSafe(getValue(cols, "max_deceleration", hasHeader ? undefined : 11));

        const playerLoad = parseFloatSafe(getValue(cols, "player_load", hasHeader ? undefined : 12));
        const powerScore = parseFloatSafe(getValue(cols, "power_score", hasHeader ? undefined : 13));
        const hrMax = parseIntSafe(getValue(cols, "hr_max", hasHeader ? undefined : 14));
        const timeInRedZone = parseFloatSafe(getValue(cols, "time_in_red_zone", hasHeader ? undefined : 15));
        const percentInRedZone = parseFloatSafe(getValue(cols, "percent_in_red_zone", hasHeader ? undefined : 16));
        const hrRecoveryTime = parseFloatSafe(getValue(cols, "hr_recovery_time", hasHeader ? undefined : 17));

        const recordedAtRaw = getValue(cols, "recorded_at", hasHeader ? undefined : 18);
        const recordedAt = parseIntSafe(recordedAtRaw, Date.now());

        // exrId is either named 'exr_id' or at index 19 (if appended) or index 0 (if prepended)
        const exrId = getValue(cols, "exr_id", hasHeader ? undefined : (cols.length >= 20 && detectNonHeaderOffset(cols) === 1 ? 0 : 19)) || null;

        out.push({
            sessionId,
            playerId,
            deviceId,
            totalDistance,
            hsrDistance,
            sprintDistance,
            topSpeed,
            sprintCount,
            acceleration,
            deceleration,
            maxAcceleration,
            maxDeceleration,
            playerLoad,
            powerScore,
            hrMax,
            timeInRedZone,
            percentInRedZone,
            hrRecoveryTime,
            recordedAt,
            exrId
        });
    }

    return out;
}

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

        // Ensure event + exercise metadata are marked as pending for backend sync
        try {
            await db.execute(`UPDATE sessions SET synced_backend = 0 WHERE session_id = ?`, [sessionId]);
            await db.execute(`UPDATE exercises SET synced = 0 WHERE session_id = ?`, [sessionId]);
        } catch { }

        const startTs = session.trim_start_ts || session.file_start_ts || 0;
        const endTs = session.trim_end_ts || session.file_end_ts || 0;

        // 2️⃣ Fetch Players with effective Pods
        const assignedPlayers = getAssignedPlayersForSession(sessionId);
        const activePlayers = assignedPlayers.filter(p => p.assigned && p.effective_pod_serial);

        if (activePlayers.length === 0) {
            console.warn("⚠️ No assigned players with pods found for this session.");
        }

        // 3️⃣ BUILD CSV CONTENT
        // Fetch all exercises and their participants for this session
        const exercisesRes = await db.execute(`SELECT exercise_id, exrId, start_ts, end_ts FROM exercises WHERE session_id = ?`, [sessionId]);
        const allExercises = (exercisesRes as any).rows?._array || [];

        const assignmentsRes = await db.execute(`
            SELECT ep.exercise_id, ep.player_id 
            FROM exercise_players ep
            JOIN exercises e ON ep.exercise_id = e.exercise_id
            WHERE e.session_id = ?
        `, [sessionId]);
        const allAssignments = (assignmentsRes as any).rows?._array || [];

        // Format: player_id, device_id, session_id, starting_time, ending_time, exr_id
        let csvContent = "player_id,device_id,session_id,starting_time,ending_time,exr_id\n";

        activePlayers.forEach(p => {
            const playerExercises = allAssignments
                .filter(a => a.player_id === p.player_id)
                .map(a => allExercises.find(ex => ex.exercise_id === a.exercise_id))
                .filter(Boolean);

            if (playerExercises.length > 0) {
                // Generate a row for EACH exercise the player is in
                playerExercises.forEach(ex => {
                    const line = `${p.player_id},${p.effective_pod_serial},${sessionId},${ex.start_ts},${ex.end_ts},${ex.exrId || ""}`;
                    csvContent += line + "\n";
                });
            } else {
                // If player is not in any specific exercise, use overall session trim
                const line = `${p.player_id},${p.effective_pod_serial},${sessionId},${startTs},${endTs},""`;
                csvContent += line + "\n";
            }
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

        // 6️⃣b SEND EVENT DETAILS AS STRING (after delay, before trigger)
        // Fetch exercises for this session to send to device
        const exRes = await db.execute(`SELECT exrId, start_ts, end_ts FROM exercises WHERE session_id = ?`, [sessionId]);
        const dbExercises = (exRes as any).rows?._array || [];

        const eventDetails = {
            session_id: sessionId,
            trim_start_ts: session.trim_start_ts ?? 0,
            trim_end_ts: session.trim_end_ts ?? 0,
            exercises: dbExercises.map((ex: any) => ({
                exr_id: ex.exrId,
                start: ex.start_ts,
                end: ex.end_ts
            }))
        };
        const eventDetailsPayload = JSON.stringify(eventDetails);
        const detailsFilename = `${sessionId}_event_details.csv`;
        await uploadCsv(detailsFilename, eventDetailsPayload);
        console.log(`✅ Event details sent to Podholder: ${detailsFilename}`);

        // 7️⃣ SEND POST TRIGGER & GET RESPONSE
        console.log("⚡ Sending POST Trigger...");
        const responseData = await triggerDeviceProcessing();

        console.log("------------------------------------------");
        console.log("📥 RECEIVED PROCESSED DATA FROM DEVICE:");
        console.log(responseData);
        console.log("------------------------------------------");

        // 8️⃣ PARSE & SAVE TO SQLITE
        try {
            const parsedRows = parseDeviceMetricsCsv(responseData, sessionId);
            if (!parsedRows.length) {
                console.warn("⚠️ No metrics rows detected in device response");
            }

            for (const row of parsedRows) {
                console.log(`💾 Saving metrics for Player ${row.playerId} (Device: ${row.deviceId}) in ${row.sessionId} [Ex: ${row.exrId || "N/A"}]`);

                await db.execute(`
                 INSERT INTO calculated_data (
                   session_id, player_id, device_id,
                   total_distance, hsr_distance, sprint_distance, top_speed, sprint_count,
                    acceleration, deceleration, max_acceleration, max_deceleration,
                    player_load, power_score, hr_max, time_in_red_zone, percent_in_red_zone, hr_recovery_time,
                    recorded_at, synced, exrId
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
                `, [
                    row.sessionId, row.playerId, row.deviceId,
                    row.totalDistance, row.hsrDistance, row.sprintDistance, row.topSpeed, row.sprintCount,
                    row.acceleration, row.deceleration, row.maxAcceleration, row.maxDeceleration,
                    row.playerLoad, row.powerScore, row.hrMax, row.timeInRedZone, row.percentInRedZone, row.hrRecoveryTime,
                    row.recordedAt, row.exrId
                ]);
            }
            console.log("✅ Processed data saved to SQLite");

        } catch (parseErr) {
            console.error("❌ Error parsing/saving device data:", parseErr);
            // Don't throw here? Or throw? If saving fails, maybe we should alert.
            throw parseErr;
        }

        // 9️⃣ SYNC TO BACKEND (When Net Available)
        // Trigger the sync service immediately (sessions first, then metrics)
        syncPendingSessions()
            .then(() => syncPendingMetrics())
            .catch(err => console.log("🔄 Background sync error:", err));

        return responseData;

    } catch (error) {
        console.error("❌ Sync/Trigger Failed:", error);
        throw error;
    }
}
