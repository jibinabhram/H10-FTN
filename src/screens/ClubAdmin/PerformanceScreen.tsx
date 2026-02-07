import React, { useEffect, useState, useCallback } from "react";
import {
  ScrollView,
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Calendar } from "react-native-calendars";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { db } from "../../db/sqlite";
import PerformanceGraph from "../../components/PerformanceGraph";
import IndividualComparisonGraph from "../../components/IndividualComparisonGraph";
import { useTheme } from "../../components/context/ThemeContext";

/* ================= TYPES ================= */

type ComparisonMode = "team" | "individual";

/* ================= METRICS ================= */

const METRICS = [
  { key: "total_distance", label: "Total Distance (m)" },
  { key: "hsr_distance", label: "HSR Distance (m)" },
  { key: "sprint_distance", label: "Sprint Distance (m)" },
  { key: "top_speed", label: "Top Speed (m/s)" },
  { key: "sprint_count", label: "Sprint Count" },
  { key: "accelerations", label: "Accelerations" },
  { key: "decelerations", label: "Decelerations" },
  { key: "max_acceleration", label: "Max Acceleration (m/s²)" },
  { key: "max_deceleration", label: "Max Deceleration (m/s²)" },
  { key: "player_load", label: "Player Load" },
  { key: "power_score", label: "Power Score" },
  { key: "hr_max", label: "HR Max (bpm)" },
  { key: "time_in_red_zone", label: "Time in Red Zone (s)" },
  { key: "percent_in_red_zone", label: "% Time in Red Zone" },
  { key: "hr_recovery_time", label: "HR Recovery Time (s)" },
];

export default function PerformanceScreen() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [mode, setMode] = useState<ComparisonMode>("team");
  const [modeOpen, setModeOpen] = useState(false);

  /* --- SESSION FILTERS --- */
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [sessionSearch, setSessionSearch] = useState("");
  const [sessionType, setSessionType] = useState<"all" | "match" | "training">("all");
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  /* --- PLAYER FILTERS --- */
  const [players, setPlayers] = useState<any[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerType, setPlayerType] = useState<"all" | "Forward" | "Midfielder" | "Defender" | "Goalkeeper">("all");

  const [data, setData] = useState<any[]>([]);

  const [metric, setMetric] = useState("total_distance");
  const [metricOpen, setMetricOpen] = useState(false);

  const selectedMetricLabel =
    METRICS.find(m => m.key === metric)?.label ?? "";

  /* ================= HELPERS ================= */

  const formatSessionIdToTime = (id: string) => {
    // Expected ID format: YYYY-MM-DD-HH-MM-SS
    const parts = id.split('-');
    if (parts.length >= 6) {
      return `${parts[3]}:${parts[4]}`;
    }
    return "";
  };

  const extractDateFromId = (id: string) => {
    const match = id.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
  };

  const formatDisplayDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    try {
      const date = new Date(dateStr);
      const day = date.getDate();
      const month = date.toLocaleString('default', { month: 'short' });
      return `${day} ${month}`;
    } catch (e) {
      return dateStr;
    }
  };

  /* ================= LOAD SESSIONS ================= */

  const [markedDates, setMarkedDates] = useState<Record<string, any>>({});

  const loadSessions = useCallback(() => {
    let query = `
      SELECT 
        c.session_id, 
        s.event_name, 
        s.event_date, 
        s.event_type,
        MAX(c.recorded_at) as recorded_at
      FROM calculated_data c
      LEFT JOIN sessions s ON (s.session_id = c.session_id OR s.session_id = REPLACE(c.session_id, '.csv', ''))
      WHERE 1=1
    `;
    const params: any[] = [];

    if (sessionSearch) {
      query += ` AND (s.event_name LIKE ? OR c.session_id LIKE ?)`;
      params.push(`%${sessionSearch}%`, `%${sessionSearch}%`);
    }

    if (sessionType !== "all") {
      query += ` AND LOWER(s.event_type) = LOWER(?)`;
      params.push(sessionType);
    }

    if (selectedDate) {
      query += ` AND (s.event_date = ? OR c.session_id LIKE ? OR REPLACE(c.session_id, '.csv', '') = ?)`;
      params.push(selectedDate, `${selectedDate}%`, selectedDate);
    }

    query += ` GROUP BY c.session_id ORDER BY recorded_at DESC`;

    const res = db.execute(query, params);
    const list = res.rows?._array || [];

    // Debug log to help identify join issues
    if (list.length > 0) {
      console.log(`[PerformanceScreen] Found ${list.length} sessions in calculated_data.`);
      const withNames = list.filter((s: any) => s.event_name);
      console.log(`[PerformanceScreen] Sessions with event_name: ${withNames.length}/${list.length}`);
    } else {
      console.log(`[PerformanceScreen] No sessions found for current filters.`);
    }

    // Enrich with inferred data if needed
    const enriched = list.map((s: any) => {
      const datePart = s.event_date || extractDateFromId(s.session_id);

      return {
        ...s,
        display_name: (s.event_name && s.event_name.trim()) || (datePart ? datePart.split('-').reverse().join('/') : "Unnamed Event"),
        display_sub: formatDisplayDate(datePart)
      };
    });

    setSessions(enriched);

    // Auto-select first if none selected, OR clear if none found
    if (enriched.length > 0) {
      if (selectedSessions.length === 0) {
        setSelectedSessions([enriched[0].session_id]);
      }
    } else {
      setSelectedSessions([]);
    }
  }, [sessionSearch, sessionType, selectedDate]);

  const loadMarkers = useCallback(() => {
    try {
      const res = db.execute(`
        SELECT DISTINCT s.event_date as date
        FROM sessions s
        UNION
        SELECT DISTINCT SUBSTR(session_id, 1, 10) as date
        FROM calculated_data
      `, []);

      const list = res.rows?._array || [];
      const marks: Record<string, any> = {};
      list.forEach((item: any) => {
        if (item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date)) {
          marks[item.date] = { marked: true, dotColor: '#B50002' };
        }
      });
      setMarkedDates(marks);
    } catch (e) {
      console.error("Failed to load calendar markers", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSessions();
      loadMarkers();
    }, [loadSessions, loadMarkers])
  );

  // Trigger player reload whenever selection changes
  useEffect(() => {
    setSelectedPlayers([]); // Clear players when session selection changes
  }, [selectedSessions]);

  /* ================= LOAD PLAYERS ================= */

  useEffect(() => {
    if (!selectedSessions.length) {
      setPlayers([]);
      return;
    }

    const placeholders = selectedSessions.map(() => "?").join(",");
    let query = `
      SELECT DISTINCT c.player_id, p.player_name, p.position, p.jersey_number
      FROM calculated_data c
      JOIN players p ON p.player_id = c.player_id
      WHERE c.session_id IN (${placeholders})
    `;
    const params: any[] = [...selectedSessions];

    if (playerSearch) {
      query += ` AND p.player_name LIKE ?`;
      params.push(`%${playerSearch}%`);
    }

    if (playerType !== "all") {
      query += ` AND LOWER(p.position) = LOWER(?)`;
      params.push(playerType);
    }

    query += ` ORDER BY p.player_name`;

    const res = db.execute(query, params);
    const list = res.rows?._array || [];
    setPlayers(list);

    // If we have selected sessions but no players found, ensure we clear any stale selections
    if (list.length === 0) {
      setSelectedPlayers([]);
    }
  }, [selectedSessions, playerSearch, playerType]);

  /* ================= LOAD GRAPH DATA ================= */

  useEffect(() => {
    if (!selectedPlayers.length || !selectedSessions.length) {
      setData([]);
      return;
    }

    const sessionPH = selectedSessions.map(() => "?").join(",");
    const playerPH = selectedPlayers.map(() => "?").join(",");

    const res = db.execute(
      `
      SELECT c.*, p.player_name
      FROM calculated_data c
      JOIN players p ON p.player_id = c.player_id
      WHERE c.session_id IN (${sessionPH})
        AND c.player_id IN (${playerPH})
      ORDER BY c.player_id, c.recorded_at
      `,
      [...selectedSessions, ...selectedPlayers]
    );

    setData(res.rows?._array ?? []);
  }, [selectedSessions, selectedPlayers]);

  /* ================= MODE CHANGE ================= */

  const applyMode = (m: ComparisonMode) => {
    setMode(m);
    setSelectedPlayers([]);
    setData([]);

    if (m === "team") {
      setSelectedSessions(prev => prev.slice(0, 1));
    } else {
      setSelectedSessions(sessions.map(s => s.session_id));
    }
  };

  const toggleSession = (sid: string) => {
    if (mode === "team") {
      setSelectedSessions([sid]);
    } else {
      setSelectedSessions(prev =>
        prev.includes(sid)
          ? prev.filter(s => s !== sid)
          : [...prev, sid]
      );
    }
  };

  const togglePlayer = (id: string) => {
    if (mode === "individual") setSelectedPlayers([id]);
    else
      setSelectedPlayers(prev =>
        prev.includes(id)
          ? prev.filter(p => p !== id)
          : [...prev, id]
      );
  };

  /* ================= UI HELPERS ================= */

  const [sessionTypeOpen, setSessionTypeOpen] = useState(false);
  const [playerTypeOpen, setPlayerTypeOpen] = useState(false);

  /* ================= UI ================= */

  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#020617' : '#F8FAFC' }]}>
      {/* LEFT PANEL */}
      <View style={[styles.leftPanel, { width: 340, backgroundColor: isDark ? '#0F172A' : '#F1F5F9', borderRightColor: isDark ? '#1E293B' : '#E2E8F0' }]}>

        {/* EVENTS BOX */}
        <View style={[styles.filterBox, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }, { flex: 1 }]}>
          <View style={styles.boxHeader}>
            <Text style={[styles.boxTitle, { color: isDark ? '#F1F5F9' : '#0F172A' }]}>Events</Text>
            <TouchableOpacity
              style={[styles.miniDropdown, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}
              onPress={() => setSessionTypeOpen(!sessionTypeOpen)}
            >
              <Text style={[styles.miniDropdownText, { color: isDark ? '#F1F5F9' : '#0F172A' }]}>
                {sessionType === 'all' ? 'Type' : sessionType.charAt(0).toUpperCase() + sessionType.slice(1)}
              </Text>
              <Icon name={sessionTypeOpen ? "chevron-up" : "chevron-down"} size={14} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {sessionTypeOpen && (
            <View style={[styles.inlineTypeSelection, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
              {["all", "match", "training"].map(type => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeOption, sessionType === type && styles.typeOptionActive]}
                  onPress={() => { setSessionType(type as any); setSessionTypeOpen(false); }}
                >
                  <Text style={[styles.typeOptionText, { color: isDark ? '#F1F5F9' : '#0F172A' }, sessionType === type && { color: '#B50002' }]}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.timespanRow}>
            <View style={styles.timespanInput}>
              <Text style={styles.timespanPlaceholder} numberOfLines={1}>
                {selectedDate ? `Date: ${selectedDate}` : "Select timespan"}
              </Text>
              <TouchableOpacity onPress={() => setShowCalendar(!showCalendar)}>
                <Icon name={showCalendar ? "calendar-check" : "calendar-blank-outline"} size={20} color={isDark ? '#F1F5F9' : '#0F172A'} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.listFlex} showsVerticalScrollIndicator={false}>
            {showCalendar && (
              <View style={styles.inlineCalendarContainer}>
                <Calendar
                  onDayPress={(day: any) => {
                    setSelectedDate(day.dateString);
                    setShowCalendar(false);
                  }}
                  markedDates={{
                    ...markedDates,
                    ...(selectedDate ? {
                      [selectedDate]: {
                        ...(markedDates[selectedDate] || {}),
                        selected: true,
                        selectedColor: '#B50002'
                      }
                    } : {})
                  }}
                  theme={{
                    calendarBackground: isDark ? '#1E293B' : '#fff',
                    textSectionTitleColor: isDark ? '#94A3B8' : '#64748B',
                    selectedDayBackgroundColor: '#B50002',
                    selectedDayTextColor: '#ffffff',
                    todayTextColor: '#B50002',
                    dayTextColor: isDark ? '#F1F5F9' : '#0F172A',
                    monthTextColor: isDark ? '#F1F5F9' : '#0F172A',
                    dayTextFontSize: 12,
                    monthTextFontSize: 14,
                    textDayHeaderFontSize: 12,
                  }}
                  style={{ width: '100%' }}
                />
                {selectedDate && (
                  <TouchableOpacity style={styles.clearDateInline} onPress={() => { setSelectedDate(null); setShowCalendar(false); }}>
                    <Text style={{ color: '#EF4444', fontWeight: 'bold', fontSize: 13 }}>Clear Date Filter</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {sessions.length === 0 && !showCalendar && (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: isDark ? '#94A3B8' : '#64748B', fontStyle: 'italic' }}>
                  No events found
                </Text>
              </View>
            )}

            {sessions.map((s, idx) => (
              <TouchableOpacity
                key={`session-${s.session_id}-${idx}`}
                style={[styles.listItem, { borderBottomWidth: 1, borderBottomColor: isDark ? '#1E293B' : '#F1F5F9' }]}
                onPress={() => toggleSession(s.session_id)}
              >
                <Icon
                  name={selectedSessions.includes(s.session_id) ? "record-circle-outline" : "circle-outline"}
                  size={24}
                  color={selectedSessions.includes(s.session_id) ? "#B50002" : "#94A3B8"}
                />
                <View style={[styles.listItemTextContainer, { marginLeft: 12 }]}>
                  <Text style={[styles.listItemName, { color: isDark ? '#F1F5F9' : '#0F172A' }]} numberOfLines={1}>
                    {s.display_name}
                  </Text>
                  <Text style={styles.listItemSub}>{s.display_sub}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* PLAYERS BOX */}
        <View style={[styles.filterBox, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', marginTop: 16 }, { flex: 1 }]}>
          <View style={styles.boxHeader}>
            <Text style={[styles.boxTitle, { color: isDark ? '#F1F5F9' : '#0F172A' }]}>Players</Text>
            <TouchableOpacity
              style={[styles.miniDropdown, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}
              onPress={() => setPlayerTypeOpen(!playerTypeOpen)}
            >
              <Text style={[styles.miniDropdownText, { color: isDark ? '#F1F5F9' : '#0F172A' }]}>
                {playerType === 'all' ? 'Pos' : playerType.substring(0, 3)}
              </Text>
              <Icon name={playerTypeOpen ? "chevron-up" : "chevron-down"} size={14} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {playerTypeOpen && (
            <View style={[styles.inlineTypeSelection, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
              {["all", "Forward", "Midfielder", "Defender", "Goalkeeper"].map(type => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeOption, playerType === type && styles.typeOptionActive]}
                  onPress={() => { setPlayerType(type as any); setPlayerTypeOpen(false); }}
                >
                  <Text style={[styles.typeOptionText, { color: isDark ? '#F1F5F9' : '#0F172A' }, playerType === type && { color: '#B50002' }]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={styles.selectAllHeader}
            onPress={() => {
              if (selectedPlayers.length === players.length) setSelectedPlayers([]);
              else setSelectedPlayers(players.map(p => p.player_id));
            }}
          >
            <Icon
              name={selectedPlayers.length === players.length ? "checkbox-marked" : "checkbox-blank-outline"}
              size={20}
              color={selectedPlayers.length === players.length ? "#B50002" : "#94A3B8"}
            />
            <Text style={[styles.selectAllLabel, { color: isDark ? '#F1F5F9' : '#0F172A' }]}>Select all players</Text>
          </TouchableOpacity>

          <ScrollView style={styles.listFlex} showsVerticalScrollIndicator={false}>
            {players.length === 0 && (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: isDark ? '#94A3B8' : '#64748B', fontStyle: 'italic' }}>
                  No players found
                </Text>
              </View>
            )}
            {players.map((p, idx) => (
              <TouchableOpacity
                key={p.player_id}
                style={[styles.listItem, { borderBottomWidth: 1, borderBottomColor: isDark ? '#1E293B' : '#F1F5F9' }]}
                onPress={() => togglePlayer(p.player_id)}
              >
                <Icon
                  name={selectedPlayers.includes(p.player_id) ? "checkbox-marked" : "checkbox-blank-outline"}
                  size={22}
                  color={selectedPlayers.includes(p.player_id) ? "#B50002" : "#94A3B8"}
                />
                <View style={[styles.playerAvatar, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9', marginLeft: 12 }]}>
                  <Icon name="account-outline" size={20} color="#94A3B8" />
                </View>
                <View style={[styles.listItemTextContainer, { marginLeft: 12 }]}>
                  <Text style={[styles.listItemName, { color: isDark ? '#F1F5F9' : '#0F172A' }]} numberOfLines={1}>
                    {p.player_name || "N/A"}
                  </Text>
                  <Text style={styles.listItemSub}>
                    #{String(p.jersey_number || (idx + 1)).padStart(2, '0')} {p.position || "N/A"}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* RIGHT PANEL */}
      <View style={styles.rightPanel}>
        <ScrollView contentContainerStyle={styles.rightContent} showsVerticalScrollIndicator={false}>
          {/* TOP BAR / TABS */}
          <View style={[styles.analyticsHeader, { backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: isDark ? '#1E293B' : '#E2E8F0' }]}>
            <Text style={[styles.analyticsTitle, { color: isDark ? '#60A5FA' : '#2563EB' }]}>Compare Analytics</Text>

            <View style={styles.tabsRow}>
              <TouchableOpacity style={[styles.tabBtn, styles.tabBtnActive]}>
                <Text style={styles.tabTextActive}>Analysis</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tabBtn}>
                <Text style={[styles.tabText, { color: isDark ? '#94A3B8' : '#64748B' }]}>Progress Report</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tabBtn}>
                <Text style={[styles.tabText, { color: isDark ? '#94A3B8' : '#64748B' }]}>Weekly Report</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.analyticsFiltersRow}>
              <Text style={styles.analyticsSubText}>Compare Events in Last Month</Text>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[styles.dropdownTrigger, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E2E8F0' }]}
                  onPress={() => setModeOpen(true)}
                >
                  <Text style={{ color: isDark ? '#F1F5F9' : '#0F172A' }}>
                    {mode === "team" ? "Showing Team Average" : "Individual Comparison"}
                  </Text>
                  <Icon name="chevron-down" size={20} color="#94A3B8" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.dropdownTrigger, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E2E8F0' }]}
                  onPress={() => setMetricOpen(true)}
                >
                  <Text style={{ color: isDark ? '#F1F5F9' : '#0F172A' }}>{selectedMetricLabel}</Text>
                  <Icon name="chevron-down" size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.graphContainer}>
              {data.length < 2 ? (
                <View style={styles.emptyContainer}>
                  <Icon name="chart-bar-stacked" size={64} color="#E2E8F0" />
                  <Text style={[styles.empty, { color: isDark ? '#94A3B8' : '#64748b' }]}>Not enough data to compare</Text>
                </View>
              ) : mode === "team" ? (
                <PerformanceGraph data={data} metric={metric} />
              ) : (
                <IndividualComparisonGraph data={data} metric={metric} />
              )}
            </View>

            <View style={styles.legendRow}>
              <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: '#22C55E' }]} /><Text style={styles.legendLabel}>Excellent</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: '#F97316' }]} /><Text style={styles.legendLabel}>Good</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: '#FACC15' }]} /><Text style={styles.legendLabel}>Moderate</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: '#EF4444' }]} /><Text style={styles.legendLabel}>Low</Text></View>
            </View>
          </View>
        </ScrollView>
      </View>



      {/* MODE MODAL */}
      <Modal transparent visible={modeOpen} animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setModeOpen(false)}>
          <Pressable style={[styles.modal, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}>
            {(["team", "individual"] as ComparisonMode[]).map(m => (
              <TouchableOpacity
                key={m}
                style={[
                  styles.modalItem,
                  m === mode && styles.modalActive,
                ]}
                onPress={() => {
                  applyMode(m);
                  setModeOpen(false);
                }}
              >
                <Text style={[m === mode && styles.modalTextActive, { color: isDark ? (m === mode ? '#60A5FA' : '#E2E8F0') : (m === mode ? '#2563eb' : '#000') }]}>
                  {m === "team" ? "Team Comparison" : "Individual Comparison"}
                </Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* METRIC MODAL */}
      <Modal transparent visible={metricOpen} animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setMetricOpen(false)}>
          <Pressable style={[styles.modal, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}>
            <ScrollView>
              {METRICS.map(m => (
                <TouchableOpacity
                  key={m.key}
                  style={[
                    styles.modalItem,
                    m.key === metric && styles.modalActive,
                  ]}
                  onPress={() => {
                    setMetric(m.key);
                    setMetricOpen(false);
                  }}
                >
                  <Text style={[m.key === metric && styles.modalTextActive, { color: isDark ? (m.key === metric ? '#60A5FA' : '#E2E8F0') : (m.key === metric ? '#2563eb' : '#000') }]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: "row",
  },

  leftPanel: {
    width: 340,
    backgroundColor: "#F1F5F9",
    borderRightWidth: 1,
    padding: 12,
  },

  panelTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 20,
    marginLeft: 4,
  },

  filterBox: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
    borderWidth: 0,
    // Add shadow/card look
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },

  boxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  boxTitle: {
    fontSize: 18,
    fontWeight: "700",
  },

  miniDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },

  miniDropdownText: {
    fontSize: 12,
    fontWeight: '600',
  },

  timespanRow: {
    marginBottom: 16,
  },

  timespanInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 8,
  },

  timespanPlaceholder: {
    fontSize: 14,
    color: '#94A3B8',
  },

  listFlex: {
    flex: 1,
  },

  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },

  listItemTextContainer: {
    flex: 1,
  },

  listItemName: {
    fontSize: 14,
    fontWeight: '600',
  },

  listItemSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },

  selectAllHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 4,
  },

  selectAllLabel: {
    fontSize: 14,
    fontWeight: '600',
  },

  playerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  rightPanel: {
    flex: 1,
  },

  rightContent: {
    padding: 24,
  },

  analyticsHeader: {
    borderRadius: 32,
    borderWidth: 1,
    padding: 24,
  },

  analyticsTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },

  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
  },

  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },

  tabBtnActive: {
    backgroundColor: '#E0ECFF',
  },

  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },

  tabTextActive: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563EB',
  },

  analyticsFiltersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },

  analyticsSubText: {
    fontSize: 16,
    color: '#22C55E',
    fontWeight: '600',
  },

  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },

  graphContainer: {
    minHeight: 400,
    justifyContent: 'center',
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 300,
  },

  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 24,
  },

  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },

  legendLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: 'center',
  },

  modal: {
    backgroundColor: "#fff",
    borderRadius: 12,
    width: '80%',
    maxHeight: "70%",
    padding: 10,
  },

  modalItem: {
    padding: 14,
  },

  modalActive: {
    backgroundColor: "#e0ecff",
  },

  modalTextActive: {
    fontWeight: "700",
    color: "#2563eb",
  },

  inlineCalendarContainer: {
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 8,
    padding: 0,
    marginBottom: 12,
    overflow: 'hidden',
    width: '100%',
  },

  clearDateInline: {
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 4,
  },

  inlineTypeSelection: {
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  typeOption: {
    padding: 10,
    borderRadius: 6,
  },

  typeOptionActive: {
    backgroundColor: 'rgba(181, 0, 2, 0.05)',
  },

  typeOptionText: {
    fontSize: 13,
    fontWeight: '600',
  },

  empty: {
    textAlign: "center",
    marginTop: 10,
    fontSize: 16,
  },
});
