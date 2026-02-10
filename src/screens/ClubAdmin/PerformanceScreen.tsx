import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  ScrollView,
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  Modal,
  Pressable,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Calendar } from "react-native-calendars";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../../api/axios";
import PerformanceGraph from "../../components/PerformanceGraph";
import IndividualComparisonGraph from "../../components/IndividualComparisonGraph";
import { useTheme } from "../../components/context/ThemeContext";
import { STORAGE_KEYS } from "../../utils/constants";

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
  const [events, setEvents] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);

  /* --- PLAYER FILTERS --- */
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerType, setPlayerType] = useState<string>("all");

  const [data, setData] = useState<any[]>([]);

  const [metric, setMetric] = useState("total_distance");
  const [metricOpen, setMetricOpen] = useState(false);

  const selectedMetricLabel =
    METRICS.find(m => m.key === metric)?.label ?? "";

  /* ================= HELPERS ================= */

  const formatSessionIdToTime = (id: string) => {
    if (!id) return "";
    // Supported formats:
    // YYYY-MM-DD-HH-MM-SS
    // YYYY-MM-DDTHH-MM-SS
    const tMatch = id.match(/^\d{4}-\d{2}-\d{2}T(\d{2})-(\d{2})/);
    if (tMatch) return `${tMatch[1]}:${tMatch[2]}`;

    const parts = id.split("-");
    if (parts.length >= 6) return `${parts[3]}:${parts[4]}`;
    return "";
  };

  const normalizeSessionId = (id?: string | null) => {
    if (!id) return "";
    return id.replace(".csv", "");
  };


  const getEventDateKey = (event: any) => {
    const raw = event?.event_date || event?.eventDate;
    if (!raw) return null;
    if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  };

  const formatEventTime = (event: any, sessionId?: string) => {
    const ts = event?.file_start_ts ?? event?.fileStartTs;
    if (ts) {
      const d = new Date(Number(ts));
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
    }

    if (event?.event_date || event?.eventDate) {
      const d = new Date(event?.event_date || event?.eventDate);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
    }

    return sessionId ? formatSessionIdToTime(sessionId) : "";
  };

  const getClubId = useCallback(async () => {
    let clubId = await AsyncStorage.getItem(STORAGE_KEYS.CLUB_ID);
    if (!clubId) {
      try {
        const profile = await api.get("/auth/profile");
        clubId = profile?.data?.user?.club_id || null;
        if (clubId) {
          await AsyncStorage.setItem(STORAGE_KEYS.CLUB_ID, clubId);
        }
      } catch { }
    }
    return clubId;
  }, []);

  /* ================= LOAD REMOTE DATA ================= */

  const loadRemoteData = useCallback(async () => {
    try {
      const clubId = await getClubId();

      const [eventsRes, playersRes, metricsRes] = await Promise.all([
        api.get("/events"),
        api.get("/players"),
        api.get("/activity-metrics"),
      ]);

      const eventsRaw = eventsRes.data?.data ?? eventsRes.data;
      const eventsList = Array.isArray(eventsRaw) ? eventsRaw : [];
      const filteredEvents = clubId ? eventsList.filter((e: any) => e.club_id === clubId) : eventsList;

      const playersRaw = playersRes.data?.data ?? playersRes.data;
      const playersList = Array.isArray(playersRaw) ? playersRaw : [];

      const metricsRaw = metricsRes.data?.data ?? metricsRes.data;
      const metricsList = Array.isArray(metricsRaw) ? metricsRaw : [];

      setEvents(filteredEvents);
      setAllPlayers(playersList);

      const sessionSet = new Set(
        filteredEvents
          .map((e: any) => normalizeSessionId(e.sessionId || e.session_id))
          .filter(Boolean)
      );
      const playerSet = new Set(playersList.map((p: any) => p.player_id));

      const filteredMetrics = metricsList.filter((m: any) => {
        const sid = normalizeSessionId(m.sessionId || m.session_id);
        const pid = m.playerId || m.player_id;
        if (!sid || (sessionSet.size > 0 && !sessionSet.has(sid))) return false;
        if (pid && playerSet.size > 0 && !playerSet.has(pid)) return false;
        return true;
      });

      setMetrics(filteredMetrics);
    } catch (e) {
      console.log("[PerformanceScreen] Failed to load remote data", e?.message || e);
      setEvents([]);
      setAllPlayers([]);
      setMetrics([]);
    }
  }, [getClubId]);

  const extractDateFromId = (id: string) => {
    const match = id.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
  };

  const formatDisplayDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`; // DD/MM/YYYY
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const dd = String(date.getDate()).padStart(2, '0');
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const yyyy = date.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
    return dateStr;
  };

  const formatEventTypeLabel = (type?: string | null) => {
    if (!type) return "";
    const t = String(type).toLowerCase();
    return t.charAt(0).toUpperCase() + t.slice(1);
  };

  const positionOptions = useMemo(() => {
    const map = new Map<string, string>();
    allPlayers.forEach((p: any) => {
      const pos = String(p?.position ?? "").trim();
      if (!pos) return;
      const key = pos.toLowerCase();
      if (!map.has(key)) map.set(key, pos);
    });
    const list = Array.from(map.values()).sort((a, b) => a.localeCompare(b));
    return ["all", ...list];
  }, [allPlayers]);

  const normalizeMetric = (m: any) => {
    const sessionId = normalizeSessionId(m.sessionId || m.session_id);
    const playerId = m.playerId || m.player_id;
    const recordedRaw = m.recordedAt || m.recorded_at || m.created_at;
    const createdAt = recordedRaw ? new Date(recordedRaw).getTime() : Date.now();

    return {
      session_id: sessionId,
      player_id: playerId,
      recorded_at: recordedRaw,
      created_at: createdAt,

      total_distance: m.totalDistance ?? m.total_distance ?? 0,
      hsr_distance: m.hsrDistance ?? m.hsr_distance ?? 0,
      sprint_distance: m.sprintDistance ?? m.sprint_distance ?? 0,
      top_speed: m.topSpeed ?? m.top_speed ?? 0,
      sprint_count: m.sprintCount ?? m.sprint_count ?? 0,

      acceleration: m.acceleration ?? m.accelerations ?? 0,
      deceleration: m.deceleration ?? m.decelerations ?? 0,
      accelerations: m.acceleration ?? m.accelerations ?? 0,
      decelerations: m.deceleration ?? m.decelerations ?? 0,

      max_acceleration: m.maxAcceleration ?? m.max_acceleration ?? 0,
      max_deceleration: m.maxDeceleration ?? m.max_deceleration ?? 0,

      player_load: m.playerLoad ?? m.player_load ?? 0,
      power_score: m.powerScore ?? m.power_score ?? 0,

      hr_max: m.hrMax ?? m.hr_max ?? 0,
      time_in_red_zone: m.timeInRedZone ?? m.time_in_red_zone ?? 0,
      percent_in_red_zone: m.percentInRedZone ?? m.percent_in_red_zone ?? 0,
      hr_recovery_time: m.hrRecoveryTime ?? m.hr_recovery_time ?? 0,
    };
  };

  /* ================= LOAD SESSIONS ================= */

  const [markedDates, setMarkedDates] = useState<Record<string, any>>({});

  const loadSessions = useCallback(() => {
    let list = events.map((e: any) => {
      const sessionId = normalizeSessionId(e.sessionId || e.session_id || e.event_id);
      const dateKey = getEventDateKey(e) || extractDateFromId(sessionId);
      const displayName = (e.event_name && String(e.event_name).trim()) || formatEventTypeLabel(e.event_type) || "Session";
      const displayTime = formatEventTime(e, sessionId);

      const eventTs = e.event_date || e.eventDate;
      const eventMs = eventTs ? new Date(eventTs).getTime() : 0;
      const sortBase =
        Number(e.file_start_ts ?? e.fileStartTs ?? 0) ||
        eventMs ||
        Number(e.created_at ?? e.createdAt ?? 0) ||
        0;

      return {
        ...e,
        session_id: sessionId,
        display_name: displayName,
        display_time: displayTime,
        display_sub: formatDisplayDate(dateKey),
        _date_key: dateKey,
        _sort_ts: sortBase,
      };
    });

    if (sessionSearch) {
      const q = sessionSearch.toLowerCase();
      list = list.filter((s: any) =>
        String(s.display_name || "").toLowerCase().includes(q) ||
        String(s.session_id || "").toLowerCase().includes(q)
      );
    }

    if (sessionType !== "all") {
      list = list.filter((s: any) => String(s.event_type || "").toLowerCase() === sessionType);
    }

    if (selectedDate) {
      list = list.filter((s: any) => s._date_key === selectedDate);
    }

    list.sort((a: any, b: any) => (b._sort_ts || 0) - (a._sort_ts || 0));

    setSessions(list);
  }, [events, sessionSearch, sessionType, selectedDate]);

  const loadMarkers = useCallback(() => {
    const marks: Record<string, any> = {};
    events.forEach((e: any) => {
      const dateKey = getEventDateKey(e) || extractDateFromId(normalizeSessionId(e.sessionId || e.session_id || e.event_id));
      if (dateKey) {
        marks[dateKey] = { marked: true, dotColor: '#B50002' };
      }
    });
    setMarkedDates(marks);
  }, [events]);

  useFocusEffect(
    useCallback(() => {
      loadRemoteData();
    }, [loadRemoteData])
  );

  useEffect(() => {
    loadSessions();
    loadMarkers();
  }, [loadSessions, loadMarkers]);

  useEffect(() => {
    if (sessions.length === 0) {
      if (selectedSessions.length > 0) setSelectedSessions([]);
      return;
    }
    const ids = new Set(sessions.map(s => s.session_id));
    const hasAny = selectedSessions.some(id => ids.has(id));
    if (!hasAny) {
      setSelectedSessions([sessions[0].session_id]);
    }
  }, [sessions, selectedSessions]);

  // Trigger player reload whenever selection changes
  useEffect(() => {
    setSelectedPlayers([]); // Clear players when session selection changes
  }, [selectedSessions]);

  /* ================= LOAD PLAYERS ================= */

  useEffect(() => {
    let list = allPlayers;

    if (selectedSessions.length > 0) {
      const eventsBySession = new Map<string, any>();
      events.forEach((e: any) => {
        const sid = normalizeSessionId(e.sessionId || e.session_id || e.event_id);
        if (sid) eventsBySession.set(sid, e);
      });

      const participantIds = new Set<string>();
      selectedSessions.forEach(sid => {
        const ev = eventsBySession.get(sid);
        const participants = ev?.event_participants || [];
        participants.forEach((p: any) => {
          const pid = p.player_id || p.player?.player_id;
          if (pid) participantIds.add(pid);
        });
      });

      if (participantIds.size > 0) {
        list = list.filter((p: any) => participantIds.has(p.player_id));
      }
    }

    if (playerSearch) {
      const q = playerSearch.toLowerCase();
      list = list.filter((p: any) => String(p.player_name || "").toLowerCase().includes(q));
    }

    if (playerType !== "all") {
      const wanted = String(playerType).trim().toLowerCase();
      list = list.filter((p: any) => String(p.position || "").trim().toLowerCase() === wanted);
    }

    setPlayers(list);

    if (list.length === 0) {
      setSelectedPlayers([]);
    }
  }, [allPlayers, events, selectedSessions, playerSearch, playerType]);

  /* ================= LOAD GRAPH DATA ================= */

  useEffect(() => {
    if (!selectedPlayers.length || !selectedSessions.length) {
      setData([]);
      return;
    }

    const sessionSet = new Set(selectedSessions.map(s => normalizeSessionId(s)));
    const playerSet = new Set(selectedPlayers);

    const filtered = metrics
      .map(normalizeMetric)
      .filter((m: any) => sessionSet.has(m.session_id) && playerSet.has(m.player_id));

    setData(filtered);
  }, [metrics, selectedSessions, selectedPlayers]);

  /* ================= MODE CHANGE ================= */

  const applyMode = (m: ComparisonMode) => {
    setMode(m);
    setSelectedPlayers([]);
    setData([]);

    if (m === "team") {
      setSelectedSessions(sessions.length > 0 ? [sessions[0].session_id] : []);
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
                {sessionType === 'all' ? 'All' : sessionType.charAt(0).toUpperCase() + sessionType.slice(1)}
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
                  <View style={styles.listItemTitleRow}>
                    {s.display_time ? (
                      <Text style={[styles.listItemTime, { color: isDark ? '#94A3B8' : '#64748B' }]}>{s.display_time}</Text>
                    ) : null}
                    <Text style={[styles.listItemName, { color: isDark ? '#F1F5F9' : '#0F172A' }]} numberOfLines={1}>
                      {s.display_name}
                    </Text>
                  </View>
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
                {playerType === 'all' ? 'All' : playerType}
              </Text>
              <Icon name={playerTypeOpen ? "chevron-up" : "chevron-down"} size={14} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {playerTypeOpen && (
            <View style={[styles.inlineTypeSelection, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
              {positionOptions.map(type => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeOption, playerType === type && styles.typeOptionActive]}
                  onPress={() => { setPlayerType(type as any); setPlayerTypeOpen(false); }}
                >
                  <Text style={[styles.typeOptionText, { color: isDark ? '#F1F5F9' : '#0F172A' }, playerType === type && { color: '#B50002' }]}>
                    {type === 'all' ? 'All' : type}
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

  listItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  listItemTime: {
    fontSize: 12,
    fontWeight: '700',
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
