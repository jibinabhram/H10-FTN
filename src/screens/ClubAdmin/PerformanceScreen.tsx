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
import { db } from '../../db/sqlite';
import NetInfo from '@react-native-community/netinfo';
import HorizontalBarCompare from "../../components/HorizontalBarCompare";
import { useTheme } from "../../components/context/ThemeContext";
import { STORAGE_KEYS } from "../../utils/constants";

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

  /* --- SESSION FILTERS --- */
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [sessionSearch, setSessionSearch] = useState("");
  const [sessionType, setSessionType] = useState<"all" | "match" | "training">("all");
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [exerciseTypes, setExerciseTypes] = useState<any[]>([]);
  const [exerciseType, setExerciseType] = useState<string>("all");
  const [averageEnabled, setAverageEnabled] = useState(false);

  /* --- PLAYER FILTERS --- */
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerType, setPlayerType] = useState<string>("all");

  const [data, setData] = useState<any[]>([]);

  const [metric, setMetric] = useState("total_distance");
  const [metricOpen, setMetricOpen] = useState(false);
  const [exerciseTypeOpen, setExerciseTypeOpen] = useState(false);

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

      const [eventsRes, playersRes, metricsRes, exerciseTypesRes] = await Promise.all([
        api.get("/events"),
        api.get("/players"),
        api.get("/activity-metrics"),
        api.get(`/exercise-types${clubId ? `?club_id=${clubId}` : ""}`),
      ]);

      const eventsRaw = eventsRes.data?.data ?? eventsRes.data;
      const eventsList = Array.isArray(eventsRaw) ? eventsRaw : [];
      const filteredEvents = clubId ? eventsList.filter((e: any) => e.club_id === clubId) : eventsList;

      const playersRaw = playersRes.data?.data ?? playersRes.data;
      const playersList = Array.isArray(playersRaw) ? playersRaw : [];

      const metricsRaw = metricsRes.data?.data ?? metricsRes.data;
      const metricsList = Array.isArray(metricsRaw) ? metricsRaw : [];

      const exerciseTypesRaw = exerciseTypesRes.data?.data ?? exerciseTypesRes.data;
      const exerciseTypesList = Array.isArray(exerciseTypesRaw) ? exerciseTypesRaw : [];

      setEvents(filteredEvents);
      setAllPlayers(playersList);
      setExerciseTypes(exerciseTypesList);

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
    } catch (e: any) {
      console.log("[PerformanceScreen] Failed to load remote data, trying local fallback", e?.message || e);

      try {
        const clubId = await getClubId();

        // 1. Local Events (Sessions)
        const sessionsRes = db.execute(`SELECT * FROM sessions ORDER BY created_at DESC`);
        const localSessions = (sessionsRes as any)?.rows?._array || [];
        const mySessions = clubId ? localSessions.filter(s => s.club_id === clubId) : localSessions;
        const mappedEvents = mySessions.map(s => ({
          ...s,
          event_id: s.session_id,
          sessionId: s.session_id, // ensure compatible with metrics filter
          trim_start_ts: Number(s.trim_start_ts || 0),
          trim_end_ts: Number(s.trim_end_ts || 0),
        }));

        // 2. Local Players
        const playersRes = db.execute(`SELECT * FROM players`);
        const localPlayers = (playersRes as any)?.rows?._array || [];
        const myPlayers = clubId ? localPlayers.filter(p => p.club_id === clubId) : localPlayers;

        // 3. Local Metrics (Calculated Data)
        const metricsRes = db.execute(`SELECT * FROM calculated_data`);
        const localMetrics = (metricsRes as any)?.rows?._array || [];
        // Map to camelCase if needed, assuming calculated_data uses snake_case in column names but stored as camelCase?
        // Actually calculated_data columns are snake_case. Logic below expects camelCase properties like `sessionId`
        // Let's map them.
        const mappedMetrics = localMetrics.map(m => ({
          sessionId: m.session_id,
          playerId: m.player_id,
          totalDistance: m.total_distance,
          topSpeed: m.top_speed,
          sprintCount: m.sprint_count,
          // ... map other fields if used ... 
          // for now basic filter works on sessionId
        }));

        // 4. Exercise Types (Optional Fallback)
        // We can try fetching from local overrides or defaults if stored? 
        // Database schema for exercise_types is not clear if synced to local.
        // Fallback to empty or basic
        setExerciseTypes([]);

        setEvents(mappedEvents);
        setAllPlayers(myPlayers);

        // Initial filtering logic reused
        const sessionSet = new Set(
          mappedEvents
            .map((e: any) => normalizeSessionId(e.sessionId || e.session_id))
            .filter(Boolean)
        );
        const playerSet = new Set(myPlayers.map((p: any) => p.player_id));

        const filteredMetrics = mappedMetrics.filter((m: any) => {
          const sid = normalizeSessionId(m.sessionId);
          const pid = m.playerId; // mapped above
          if (!sid || (sessionSet.size > 0 && !sessionSet.has(sid))) return false;
          if (pid && playerSet.size > 0 && !playerSet.has(pid)) return false;
          return true;
        });

        setMetrics(filteredMetrics);

      } catch (localErr) {
        console.error("❌ Failed to load local fallback data", localErr);
        setEvents([]);
        setAllPlayers([]);
        setMetrics([]);
        setExerciseTypes([]);
      }
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

  const exerciseOptions = useMemo(() => {
    const map = new Map<string, string>();
    exerciseTypes.forEach((ex: any) => {
      const t = String(ex?.name ?? "").trim();
      if (!t) return;
      const key = t.toLowerCase();
      if (!map.has(key)) map.set(key, t);
    });
    const list = Array.from(map.values()).sort((a, b) => a.localeCompare(b));
    return ["all", ...list];
  }, [exerciseTypes]);

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

    if (exerciseType !== "all") {
      const wanted = exerciseType.toLowerCase();
      list = list.filter((s: any) =>
        Array.isArray(s.exercises) &&
        s.exercises.some((ex: any) => String(ex?.type || "").toLowerCase() === wanted)
      );
    }

    list.sort((a: any, b: any) => (b._sort_ts || 0) - (a._sort_ts || 0));

    setSessions(list);
  }, [events, sessionSearch, sessionType, selectedDate, exerciseType]);

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

  const chartRows = useMemo(() => {
    if (!data.length) return [];
    const playerMap = new Map(
      allPlayers.map((p: any) => [
        p.player_id,
        {
          name: p.player_name || p.player_id,
          jersey: p.jersey_number,
        },
      ])
    );
    const byPlayer = new Map<string, { sum: number; count: number }>();

    data.forEach((m: any) => {
      const pid = m.player_id;
      if (!pid) return;
      const val = Number(m?.[metric]) || 0;
      const agg = byPlayer.get(pid) || { sum: 0, count: 0 };
      agg.sum += val;
      agg.count += 1;
      byPlayer.set(pid, agg);
    });

    const palette = [
      "#B50002", "#2563EB", "#16A34A", "#F59E0B", "#7C3AED", "#0EA5E9", "#DC2626", "#14B8A6", "#F97316", "#22C55E",
      "#8B5CF6", "#06B6D4", "#E11D48", "#0F766E", "#A21CAF", "#EA580C", "#1D4ED8", "#059669", "#C2410C", "#65A30D",
      "#9333EA", "#0F172A", "#334155", "#64748B", "#94A3B8", "#EF4444", "#F97316", "#F59E0B", "#EAB308", "#84CC16",
      "#22C55E", "#14B8A6", "#06B6D4", "#0EA5E9", "#3B82F6", "#6366F1", "#8B5CF6", "#A855F7", "#D946EF", "#EC4899",
      "#F43F5E", "#881337", "#9F1239", "#BE123C", "#E11D48", "#FB7185", "#FDA4AF", "#FCE7F3", "#DB2777", "#BE185D",
      "#9D174D", "#831843", "#4C0519", "#701A75", "#86198F", "#A21CAF", "#C026D3", "#D946EF", "#E879F9", "#F0ABFC",
      "#F5D0FE", "#581C87", "#6B21A8", "#7E22CE", "#9333EA", "#A855F7", "#C084FC", "#DDD6FE", "#EDE9FE", "#4C1D95",
      "#312E81", "#1E3A8A", "#1D4ED8", "#2563EB", "#3B82F6", "#60A5FA", "#93C5FD", "#BFDBFE", "#DBEAFE", "#1E40AF",
      "#1E293B", "#0F172A", "#0C4A6E", "#075985", "#0284C7", "#0EA5E9", "#38BDF8", "#7DD3FC", "#BAE6FD", "#E0F2FE",
      "#14532D", "#166534", "#15803D", "#16A34A", "#22C55E", "#4ADE80", "#86EFAC", "#BBF7D0", "#DCFCE7", "#052E16",
    ];

    const colorForId = (id: string) => {
      let hash = 0;
      for (let i = 0; i < id.length; i++) {
        hash = (hash * 31 + id.charCodeAt(i)) | 0;
      }
      const idx = Math.abs(hash) % palette.length;
      return palette[idx];
    };

    const rows = Array.from(byPlayer.entries()).map(([pid, agg]) => {
      const info = playerMap.get(pid);
      const jersey = info?.jersey != null && info?.jersey !== "" ? ` (#${String(info.jersey).padStart(2, "0")})` : "";
      const label = `${info?.name || pid}${jersey}`;
      const value = averageEnabled ? (agg.count ? agg.sum / agg.count : 0) : agg.sum;
      return {
        id: pid,
        label,
        value,
        color: colorForId(pid),
      };
    });

    rows.sort((a, b) => b.value - a.value);
    return rows;
  }, [data, allPlayers, metric, averageEnabled]);

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

  const toggleSession = (sid: string) => {
    setSelectedSessions(prev =>
      prev.includes(sid)
        ? prev.filter(s => s !== sid)
        : [...prev, sid]
    );
  };

  const togglePlayer = (id: string) => {
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

          <ScrollView
            style={styles.listFlex}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
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
                    textDayFontSize: 12,
                    textMonthFontSize: 14,
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
                  name={selectedSessions.includes(s.session_id) ? "checkbox-marked" : "checkbox-blank-outline"}
                  size={22}
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

          <ScrollView
            style={styles.listFlex}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
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
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.rightContent, { flexGrow: 1 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* TOP BAR / TABS */}
          <View style={[styles.analyticsHeader, { backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: isDark ? '#1E293B' : '#E2E8F0' }]}>
            <Text style={[styles.analyticsTitle, { color: '#B50002' }]}>Compare Players</Text>

            <View style={styles.analyticsFiltersRow}>
              <TouchableOpacity
                style={[styles.avgToggle, averageEnabled && styles.avgToggleOn]}
                onPress={() => setAverageEnabled(!averageEnabled)}
              >
                <View style={[styles.avgDot, averageEnabled && styles.avgDotOn]} />
                <Text style={[styles.avgLabel, { color: averageEnabled ? '#B50002' : (isDark ? '#E2E8F0' : '#0F172A') }]}>
                  Average
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.dropdownTrigger, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E2E8F0' }]}
                onPress={() => setExerciseTypeOpen(true)}
              >
                <Text style={{ color: isDark ? '#F1F5F9' : '#0F172A' }}>
                  {exerciseType === "all" ? "All Exercises" : exerciseType}
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

            <View style={styles.graphContainer}>
              {chartRows.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Icon name="chart-bar-stacked" size={64} color="#E2E8F0" />
                  <Text style={[styles.empty, { color: isDark ? '#94A3B8' : '#64748b' }]}>Not enough data to compare</Text>
                </View>
              ) : (
                <HorizontalBarCompare
                  rows={chartRows}
                  accentColor="#B50002"
                  textColor={isDark ? "#E2E8F0" : "#0F172A"}
                  trackColor={isDark ? "#1E293B" : "#E5E7EB"}
                  xLabel={selectedMetricLabel}
                  yLabel="Player"
                />
              )}
            </View>

          </View>
        </ScrollView>
      </View>



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

      {/* EXERCISE FILTER MODAL */}
      <Modal transparent visible={exerciseTypeOpen} animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setExerciseTypeOpen(false)}>
          <Pressable style={[styles.modal, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}>
            <ScrollView>
              {exerciseOptions.map(type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.modalItem,
                    type === exerciseType && styles.modalActive,
                  ]}
                  onPress={() => {
                    setExerciseType(type);
                    setExerciseTypeOpen(false);
                  }}
                >
                  <Text style={[type === exerciseType && styles.modalTextActive, { color: isDark ? (type === exerciseType ? '#B50002' : '#E2E8F0') : (type === exerciseType ? '#B50002' : '#000') }]}>
                    {type === "all" ? "All Exercises" : type}
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

  analyticsFiltersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    flexWrap: 'wrap',
    gap: 12,
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

  avgToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },

  avgToggleOn: {
    borderColor: '#B50002',
    backgroundColor: 'rgba(181, 0, 2, 0.05)',
  },

  avgDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#94A3B8',
  },

  avgDotOn: {
    backgroundColor: '#B50002',
  },

  avgLabel: {
    fontSize: 13,
    fontWeight: '700',
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
