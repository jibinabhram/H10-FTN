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

    try { db.execute(`ALTER TABLE players ADD COLUMN heartrate INTEGER`); } catch { }
    try { db.execute(`ALTER TABLE players ADD COLUMN height REAL`); } catch { }
    try { db.execute(`ALTER TABLE players ADD COLUMN weight REAL`); } catch { }
    try { db.execute(`ALTER TABLE players ADD COLUMN hr_zones TEXT`); } catch { }

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
        player_id TEXT,
        device_id TEXT,

        total_distance REAL,
        hsr_distance REAL,
        sprint_distance REAL,
        top_speed REAL,
        sprint_count INTEGER,

        acceleration REAL,
        deceleration REAL,
        max_acceleration REAL,
        max_deceleration REAL,

        player_load REAL,
        power_score REAL,

        hr_max INTEGER,
        time_in_red_zone REAL,
        percent_in_red_zone REAL,
        hr_recovery_time REAL,

        recorded_at INTEGER,
        synced INTEGER DEFAULT 0
      );
    `);

    // Migrations
    try { db.execute(`ALTER TABLE calculated_data ADD COLUMN device_id TEXT`); } catch { }
    try { db.execute(`ALTER TABLE calculated_data ADD COLUMN acceleration REAL`); } catch { }
    try { db.execute(`ALTER TABLE calculated_data ADD COLUMN deceleration REAL`); } catch { }
    try { db.execute(`ALTER TABLE calculated_data ADD COLUMN recorded_at INTEGER`); } catch { }
    try { db.execute(`ALTER TABLE calculated_data ADD COLUMN synced INTEGER DEFAULT 0`); } catch { }

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

        created_at INTEGER,
        synced_backend INTEGER DEFAULT 0
      );
    `);
    try { db.execute(`ALTER TABLE sessions ADD COLUMN file_start_ts INTEGER`); } catch { }
    try { db.execute(`ALTER TABLE sessions ADD COLUMN file_end_ts INTEGER`); } catch { }
    try { db.execute(`ALTER TABLE sessions ADD COLUMN trim_start_ts INTEGER`); } catch { }
    try { db.execute(`ALTER TABLE sessions ADD COLUMN trim_end_ts INTEGER`); } catch { }
    try { db.execute(`ALTER TABLE sessions ADD COLUMN synced_backend INTEGER DEFAULT 0`); } catch { }

    /* ================= TEAM SETTINGS (THRESHOLDS) ================= */

    db.execute(`
      CREATE TABLE IF NOT EXISTS team_thresholds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        club_id TEXT, -- Relation to club
        type TEXT CHECK(type IN ('absolute', 'relative')) NOT NULL,
        zone_name TEXT NOT NULL, -- Walk, Jog, Run, Sprint, High Intensity Sprint
        min_val REAL,
        max_val REAL,
        is_default INTEGER DEFAULT 1, -- 1=Default, 0=Custom
        UNIQUE(club_id, type, zone_name)
      );
    `);

    // Migration for existing tables
    try { db.execute(`ALTER TABLE team_thresholds ADD COLUMN club_id TEXT`); } catch { }
    try {
      db.execute(`DROP INDEX IF EXISTS threshold_unique_idx`);
      db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS threshold_unique_idx ON team_thresholds(club_id, type, zone_name)`);
    } catch { }

    // Note: Default thresholds are now seeded per-club in TeamSettingsScreen.tsx 
    // to ensure they are correctly associated with a club_id.


    db.execute(`
      CREATE TABLE IF NOT EXISTS player_thresholds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id TEXT,
        type TEXT CHECK(type IN ('absolute', 'relative')) NOT NULL,
        zone_name TEXT NOT NULL,
        min_val REAL,
        max_val REAL,
        UNIQUE(player_id, type, zone_name)
      );
    `);

    /* ================= EXERCISE TYPES ================= */

    db.execute(`
      CREATE TABLE IF NOT EXISTS exercise_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        club_id TEXT,
        name TEXT NOT NULL,
        event_type TEXT CHECK(event_type IN ('match', 'training')) NOT NULL,
        is_system INTEGER DEFAULT 0, -- 0=User Created, 1=System Default
        created_at INTEGER,
        UNIQUE(club_id, name)
      );
    `);

    // Default exercises are now seeded per-club in TeamSettingsScreen.tsx

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

    // Add backend_id to exercise_types for sync tracking
    try {
      db.execute(`ALTER TABLE exercise_types ADD COLUMN backend_id TEXT`);
    } catch { }

    // Add club_id to exercise_types for multi-club support
    try {
      db.execute(`ALTER TABLE exercise_types ADD COLUMN club_id TEXT`);
    } catch { }


    /* ================= EXERCISES (SESSION-SPECIFIC) ================= */

    db.execute(`
      CREATE TABLE IF NOT EXISTS exercises (
        exercise_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL,
        start_ts INTEGER NOT NULL,
        end_ts INTEGER NOT NULL,
        synced INTEGER DEFAULT 0,
        FOREIGN KEY(session_id) REFERENCES sessions(session_id)
      );
    `);
    try { db.execute(`ALTER TABLE exercises ADD COLUMN synced INTEGER DEFAULT 0`); } catch { }
    try { db.execute(`ALTER TABLE exercises ADD COLUMN color TEXT`); } catch { }

    db.execute(`
      CREATE TABLE IF NOT EXISTS exercise_players (
        exercise_id TEXT NOT NULL,
        player_id TEXT NOT NULL,
        PRIMARY KEY (exercise_id, player_id),
        FOREIGN KEY(exercise_id) REFERENCES exercises(exercise_id)
      );
    `);

    /* ================= HEART RATE ZONES ================= */

    db.execute(`
      CREATE TABLE IF NOT EXISTS hr_zones (
        zone_number INTEGER PRIMARY KEY,
        min_hr INTEGER NOT NULL,
        max_hr INTEGER NOT NULL
      );
    `);

    console.log("✅ SQLite tables ready");

  } catch (err) {
    console.error("❌ DB INIT FAILED:", err);
  }
}
