import { db } from "./sqlite";

export function initDB() {
  try {

    db.execute(`
      CREATE TABLE IF NOT EXISTS players (
        player_id TEXT PRIMARY KEY,
        player_name TEXT,
        jersey_number INTEGER
      );
    `);

    // 2️⃣ SAFE MIGRATIONS (existing installs)
    try { db.execute(`ALTER TABLE players ADD COLUMN club_id TEXT`); } catch { }
    try { db.execute(`ALTER TABLE players ADD COLUMN age INTEGER`); } catch { }
    try { db.execute(`ALTER TABLE players ADD COLUMN position TEXT`); } catch { }

    try { db.execute(`ALTER TABLE players ADD COLUMN pod_id TEXT`); } catch { }
    try { db.execute(`ALTER TABLE players ADD COLUMN pod_serial TEXT`); } catch { }
    try { db.execute(`ALTER TABLE players ADD COLUMN pod_holder_serial TEXT`); } catch { }

    try { db.execute(`ALTER TABLE players ADD COLUMN club_name TEXT`); } catch { }
    try { db.execute(`ALTER TABLE players ADD COLUMN updated_at INTEGER`); } catch { }

    /* ================= SESSION PLAYER ASSIGNMENTS (FILE-SCOPED) ================= */

    db.execute(`
      CREATE TABLE IF NOT EXISTS session_players (
        session_id TEXT,
        player_id TEXT,
        assigned INTEGER, -- 1 = participating, 0 = not participating

        PRIMARY KEY (session_id, player_id)
      );
    `);

    /* ================= SESSION POD OVERRIDES (FILE-SCOPED) ================= */

    db.execute(`
      CREATE TABLE IF NOT EXISTS session_pod_overrides (
        session_id TEXT,
        pod_serial TEXT,
        player_id TEXT NULL, -- NULL = pod disabled for this file

        PRIMARY KEY (session_id, pod_serial)
      );
    `);

    /* ================= RAW SENSOR DATA ================= */

    db.execute(`
      CREATE TABLE IF NOT EXISTS raw_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        player_id INTEGER,

        lat REAL,
        lon REAL,

        acc_x REAL,
        acc_y REAL,
        acc_z REAL,

        quat_w REAL,
        quat_x REAL,
        quat_y REAL,
        quat_z REAL,

        heartrate INTEGER,
        timestamp_ms INTEGER
      );
    `);

    /* ================= CALCULATED METRICS ================= */

    db.execute(`
      CREATE TABLE IF NOT EXISTS calculated_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        player_id INTEGER,

        total_distance REAL,
        hsr_distance REAL,
        sprint_distance REAL,
        top_speed REAL,
        sprint_count INTEGER,

        accelerations INTEGER,
        decelerations INTEGER,
        max_acceleration REAL,
        max_deceleration REAL,

        player_load REAL,
        power_score REAL,

        hr_max INTEGER,
        time_in_red_zone REAL,
        percent_in_red_zone REAL,
        hr_recovery_time REAL,

        created_at INTEGER
      );
    `);

    /* ================= EVENT / SESSION METADATA ================= */

    db.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        event_name TEXT NOT NULL,
        event_type TEXT CHECK(event_type IN ('match','training')) NOT NULL,
        event_date TEXT NOT NULL,

        location TEXT,
        field TEXT,
        notes TEXT,

        created_at INTEGER
      );
    `);
    try { db.execute(`ALTER TABLE sessions ADD COLUMN file_start_ts INTEGER`); } catch { }
    try { db.execute(`ALTER TABLE sessions ADD COLUMN file_end_ts INTEGER`); } catch { }
    try { db.execute(`ALTER TABLE sessions ADD COLUMN trim_start_ts INTEGER`); } catch { }
    try { db.execute(`ALTER TABLE sessions ADD COLUMN trim_end_ts INTEGER`); } catch { }

    /* ================= SAFE MIGRATIONS ================= */

    // Add synced flag to calculated_data (runs once)
    try {
      db.execute(`
        ALTER TABLE calculated_data
        ADD COLUMN synced INTEGER DEFAULT 0
      `);
      console.log("🆕 'synced' column added");
    } catch {
      // already exists → ignore
    }

    console.log("✅ SQLite tables ready");

  } catch (err) {
    console.error("❌ DB INIT FAILED:", err);
  }
}
