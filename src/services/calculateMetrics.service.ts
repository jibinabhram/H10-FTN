import { db } from "../db/sqlite";

/* ================= CONSTANTS ================= */

const IMU_RATE = 50;
const ACC_WINDOW_SEC = 0.3;
const ACC_RMS_THRESH = 0.15;
const BASELINE_INTENSITY = 0.095;
const MAX_SCALE = 4.8;

const g = 9.80665;

// Note: v_HSR and v_SPRINT moved inside main function to fetch from DB
const a_TH = 3.0;     // m/s²
const T_MIN = 1.0;   // seconds

const C0 = 3.6;
const C1 = 2.0;

const METERS_PER_DEG_LAT = 111132.92;

/* ---- HR CONSTANTS ---- */
const HR_RED_ZONE_FRAC = 0.85;
const HR_RECOVERY_DROP = 5;

/* ================= TYPES ================= */

type RawSample = {
  player_id: number;
  lat: number;
  lon: number;
  acc_x: number;
  acc_y: number;
  acc_z: number;
  quat_w: number;
  quat_x: number;
  quat_y: number;
  quat_z: number;
  heartrate: number;
  timestamp_ms: number;
};

/* ================= HELPERS ================= */

function metersPerDegLon(lat: number) {
  return 111412.84 * Math.cos((lat * Math.PI) / 180);
}

function rotateBodyToWorld(d: RawSample) {
  const { quat_w: w, quat_x: x, quat_y: y, quat_z: z } = d;
  const { acc_x: ax, acc_y: ay, acc_z: az } = d;

  const iw = -x * ax - y * ay - z * az;
  const ix = w * ax + y * az - z * ay;
  const iy = w * ay + z * ax - x * az;
  const iz = w * az + x * ay - y * ax;

  return {
    E: ix * w - iw * x - iy * z + iz * y,
    N: iy * w - iw * y - iz * x + ix * z,
    U: iz * w - iw * z - ix * y + iy * x,
  };
}

/* ================= MAIN ================= */

export async function calculateMetricsFromRaw(sessionId: string) {
  /* ================= FETCH RAW DATA ================= */
  const res = db.execute(
    `SELECT * FROM raw_data
     WHERE session_id = ?
     ORDER BY player_id, timestamp_ms`,
    [sessionId]
  );
  const rows = (res.rows?._array ?? []) as RawSample[];
  if (!rows.length) return;

  /* ================= GROUP BY PLAYER ================= */
  const playersMap = new Map<number, RawSample[]>();
  for (const r of rows) {
    if (!playersMap.has(r.player_id)) playersMap.set(r.player_id, []);
    playersMap.get(r.player_id)!.push(r);
  }

  // Recalculate safely
  db.execute(`DELETE FROM calculated_data WHERE session_id = ?`, [sessionId]);

  /* ================= PER PLAYER ================= */
  for (const [playerId, data] of Array.from(playersMap.entries())) {
    if (data.length < 5) continue;

    /* ================= FETCH THRESHOLDS (Player or Team) ================= */
    let threshRes = db.execute(`SELECT * FROM player_thresholds WHERE player_id = ? AND type = 'absolute'`, [playerId]);
    let threshArray = threshRes.rows?._array || [];

    if (threshArray.length === 0) {
      threshRes = db.execute(`SELECT * FROM team_thresholds WHERE type = 'absolute' ORDER BY id`);
      threshArray = threshRes.rows?._array || [];
    }

    const sprintZone = threshArray.find((t: any) => t.zone_name === 'Sprint');
    const hiSprintZone = threshArray.find((t: any) => t.zone_name === 'High Intensity Sprint');

    const v_HSR = (sprintZone?.min_val || 20) / 3.6;
    const v_SPRINT = (hiSprintZone?.min_val || 25) / 3.6;

    console.log(`📊 Player ${playerId}: HSR=${(v_HSR * 3.6).toFixed(1)} km/h, SPRINT=${(v_SPRINT * 3.6).toFixed(1)} km/h`);

    /* =====================================================
       PASS 1 — RMS-SCALED DISTANCE
    ===================================================== */

    const winLen = Math.round(IMU_RATE * ACC_WINDOW_SEC);
    const accWindow: number[] = [];

    let totalDistance = 0;
    let armed = false;
    let prevLat: number | null = null;
    let prevLon: number | null = null;

    for (const d of data) {
      const accMag = Math.sqrt(
        d.acc_x ** 2 + d.acc_y ** 2 + d.acc_z ** 2
      );

      accWindow.push(accMag);
      if (accWindow.length > winLen) accWindow.shift();

      if (accWindow.length < winLen) {
        armed = false;
        prevLat = d.lat;
        prevLon = d.lon;
        continue;
      }

      const mean =
        accWindow.reduce((s, v) => s + v, 0) / winLen;

      const rms = Math.sqrt(
        accWindow.reduce((s, v) => s + (v - mean) ** 2, 0) / winLen
      );

      if (rms <= ACC_RMS_THRESH) {
        armed = false;
        prevLat = d.lat;
        prevLon = d.lon;
        continue;
      }

      if (!armed) {
        armed = true;
        prevLat = d.lat;
        prevLon = d.lon;
        continue;
      }

      if (prevLat !== null && prevLon !== null) {
        const dx = (d.lon - prevLon) * metersPerDegLon(d.lat);
        const dy = (d.lat - prevLat) * METERS_PER_DEG_LAT;

        const gpsStep = Math.hypot(dx, dy);
        const scale = Math.min(
          MAX_SCALE,
          Math.max(1, rms / BASELINE_INTENSITY)
        );

        totalDistance += gpsStep * scale;
      }

      prevLat = d.lat;
      prevLon = d.lon;
    }

    /* =====================================================
       PASS 2 — SPEED + ACC / DEC + POWER
    ===================================================== */

    let hsrDistance = 0;
    let sprintDistance = 0;
    let topSpeed = 0;

    let sprintTimer = 0;
    let sprintCount = 0;

    let accelTimer = 0;
    let decelTimer = 0;

    let playerLoad = 0;
    let powerSum = 0;
    let timeSum = 0;

    let maxAccel = -Infinity;
    let maxDecel = Infinity;

    const aFwd: number[] = [];

    for (let k = 1; k < data.length - 1; k++) {
      const dt =
        (data[k].timestamp_ms - data[k - 1].timestamp_ms) / 1000;
      if (dt <= 0) continue;

      timeSum += dt;

      const dx =
        (data[k].lon - data[k - 1].lon) *
        metersPerDegLon(data[k].lat);
      const dy =
        (data[k].lat - data[k - 1].lat) *
        METERS_PER_DEG_LAT;

      const dist = Math.hypot(dx, dy);
      if (dist < 0.05) continue;

      const speed = dist / dt;
      topSpeed = Math.max(topSpeed, speed);

      if (speed >= v_HSR) hsrDistance += dist;

      if (speed >= v_SPRINT) {
        sprintDistance += dist;
        sprintTimer += dt;
      } else {
        if (sprintTimer >= T_MIN) sprintCount++;
        sprintTimer = 0;
      }

      const dax = data[k + 1].acc_x - data[k].acc_x;
      const day = data[k + 1].acc_y - data[k].acc_y;
      const daz = data[k + 1].acc_z - data[k].acc_z;
      playerLoad += Math.sqrt(dax * dax + day * day + daz * daz);

      if (speed < 0.5) continue;

      const uE = dx / dist;
      const uN = dy / dist;

      const aWorld = rotateBodyToWorld(data[k]);
      const aForward = aWorld.E * uE + aWorld.N * uN;

      aFwd.push(aForward);

      maxAccel = Math.max(maxAccel, aForward);
      maxDecel = Math.min(maxDecel, aForward);

      powerSum += speed * (C0 + C1 * (aForward / g)) * dt;
    }

    /* ================= PEAK COUNTS ================= */

    let accelPeakCount = 0;
    let decelPeakCount = 0;

    for (let i = 1; i < aFwd.length - 1; i++) {
      if (aFwd[i - 1] < aFwd[i] && aFwd[i] >= aFwd[i + 1] && aFwd[i] >= a_TH)
        accelPeakCount++;

      if (aFwd[i - 1] > aFwd[i] && aFwd[i] <= aFwd[i + 1] && aFwd[i] <= -a_TH)
        decelPeakCount++;
    }

    const meanPower = timeSum ? powerSum / timeSum : 0;

    /* ================= HEART RATE ================= */

    const hr = data.map(d => d.heartrate).filter(h => h > 0);
    const hrMax = hr.length ? Math.max(...hr) : null;

    let redZoneTime = 0;
    let recoveryTime: number | null = null;

    if (hrMax !== null) {
      const hrRed = HR_RED_ZONE_FRAC * hrMax;

      for (let k = 1; k < data.length; k++) {
        const dt =
          (data[k].timestamp_ms - data[k - 1].timestamp_ms) / 1000;
        if (data[k - 1].heartrate >= hrRed) redZoneTime += dt;
      }

      const peakIndex = hr.indexOf(hrMax);
      const targetHR = hrMax - HR_RECOVERY_DROP;

      for (let k = peakIndex; k < hr.length; k++) {
        if (hr[k] <= targetHR) {
          recoveryTime =
            (data[k].timestamp_ms - data[peakIndex].timestamp_ms) / 1000;
          break;
        }
      }
    }

    const percentRed = timeSum ? (redZoneTime / timeSum) * 100 : 0;

    /* ================= SAVE (SYNCED = 0) ================= */

    db.execute(
      `
      INSERT INTO calculated_data (
        session_id, player_id,
        total_distance, hsr_distance, sprint_distance,
        top_speed, sprint_count,
        acceleration, deceleration,
        max_acceleration, max_deceleration,
        player_load, power_score,
        hr_max, time_in_red_zone,
        percent_in_red_zone, hr_recovery_time,
        recorded_at, synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `,
      [
        sessionId,
        playerId,
        totalDistance,
        hsrDistance,
        sprintDistance,
        topSpeed,
        sprintCount,
        accelPeakCount,
        decelPeakCount,
        maxAccel,
        maxDecel,
        playerLoad,
        meanPower,
        hrMax,
        redZoneTime,
        percentRed,
        recoveryTime,
        Math.floor(Date.now() / 1000),
      ]
    );
  }
}
