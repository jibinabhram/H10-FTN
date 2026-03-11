import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  ScrollView,
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  Modal,
  Pressable,
  FlatList,
  Platform,
  ToastAndroid,
  Dimensions,
  useWindowDimensions,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Calendar } from "react-native-calendars";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import ExcelJS from 'exceljs';
import { Buffer } from 'buffer';
import api from "../../api/axios";
import { db } from "../../db/sqlite";
import HorizontalBarCompare from "../../components/HorizontalBarCompare";
import { useTheme } from "../../components/context/ThemeContext";
import { STORAGE_KEYS } from "../../utils/constants";

/* ================= METRICS ================= */

const METRICS = [
  { key: "total_distance", label: "Total Distance (m)", unit: "m" },
  { key: "hsr_distance", label: "HSR Distance (m)", unit: "m" },
  { key: "sprint_distance", label: "Sprint Distance (m)", unit: "m" },
  { key: "top_speed", label: "Top Speed (m/s)", unit: "m/s" },
  { key: "sprint_count", label: "Sprint Count(count)", unit: "count" },
  { key: "accelerations", label: "Accelerations(count)", unit: "count" },
  { key: "decelerations", label: "Decelerations(count)", unit: "count" },
  { key: "max_acceleration", label: "Max Acceleration (count)", unit: "count" },
  { key: "max_deceleration", label: "Max Deceleration (count)", unit: "count" },
  { key: "player_load", label: "Player Load(AU)", unit: "AU" },
  { key: "power_score", label: "Power Score(W)", unit: "W" },
];

const DropdownPicker = React.memo(({ visible, onClose, data, selectedKey, selectedKeys = [], onSelect, isDark, width = 220, position, isMulti = false, disabledKeys = [] }: any) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlayStandard} onPress={onClose} />
      <View
        style={[
          styles.standardDropdownContainer,
          {
            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
            width: width,
            borderColor: isDark ? '#334155' : '#E2E8F0',
            position: 'absolute',
            top: position?.y ?? 100,
            left: position?.x ?? 100,
          }
        ]}
      >
        <ScrollView style={{ maxHeight: 270 }} showsVerticalScrollIndicator={true} nestedScrollEnabled={true}>
          {data.map((item: any) => {
            const key = typeof item === 'string' ? item : item.key;
            const label = typeof item === 'string' ? (item === 'all' ? 'All Exercises' : item) : item.label;

            const isActive = isMulti ? selectedKeys.includes(key) : key === selectedKey;
            const isDisabled = !isActive && disabledKeys.includes(key);

            return (
              <TouchableOpacity
                key={key}
                disabled={isDisabled}
                style={[
                  styles.dropdownItemStandard,
                  isActive && styles.dropdownItemActiveStandard,
                  isDisabled && { opacity: 0.4 },
                  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }
                ]}
                onPress={() => {
                  onSelect(key);
                  if (!isMulti) onClose();
                }}
              >
                <Text style={[
                  styles.dropdownItemTextStandard,
                  {
                    color: isDark ? (isActive ? '#60A5FA' : '#E2E8F0') : (isActive ? '#DC2626' : '#0F172A'),
                    fontWeight: isActive ? '700' : '500',
                    flex: 1
                  }
                ]}>{label}</Text>
                {isMulti && (
                  <Icon name={isActive ? "checkbox-marked" : "checkbox-blank-outline"} size={18} color={isActive ? (isDark ? '#60A5FA' : '#DC2626') : '#94A3B8'} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {isMulti && (
          <TouchableOpacity onPress={onClose} style={{ padding: 12, borderTopWidth: 1, borderTopColor: isDark ? '#334155' : '#E2E8F0', alignItems: 'center' }}>
            <Text style={{ color: '#B50002', fontWeight: 'bold' }}>Done</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
});

export default function PerformanceScreen() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { width } = useWindowDimensions();
  const isPortrait = width < 768;

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
  const [allExercises, setAllExercises] = useState<any[]>([]);
  const [selectedExercises, setSelectedExercises] = useState<string[]>(["all"]);
  const [averageEnabled, setAverageEnabled] = useState(false);

  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerType, setPlayerType] = useState<string>("all");

  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [metricOpen, setMetricOpen] = useState(false);
  const [exerciseTypeOpen, setExerciseTypeOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [popupHeight, setPopupHeight] = useState(550);

  const disabledMetrics = useMemo(() => {
    if (selectedMetrics.length === 0) return [];
    const firstMetric = METRICS.find(m => m.key === selectedMetrics[0]);
    if (!firstMetric) return [];
    const currentUnit = firstMetric.unit;
    return METRICS.filter(m => m.unit !== currentUnit).map(m => m.key);
  }, [selectedMetrics]);

  /* --- DROPDOWN POSITIONING --- */
  const metricBtnRef = React.useRef<View>(null);
  const exerciseBtnRef = React.useRef<View>(null);
  const [dropdownPos, setDropdownPos] = useState({ x: 0, y: 0, w: 220, h: 0 });

  const selectedMetricLabel = (() => {
    if (selectedMetrics.length === 0) return "";
    const m = METRICS.find(m => m.key === selectedMetrics[0]);
    if (!m) return "";
    return `(${m.unit})`;
  })();

  /* ================= HELPERS ================= */
  const formatSessionIdToTime = (id: string) => {
    if (!id) return "";
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

  const loadRemoteData = useCallback(async () => {
    try {
      const clubId = await getClubId();

      // --- 1. LOAD LOCAL DATA (Baseline) ---
      let localEvents: any[] = [];
      let localPlayers: any[] = [];
      let localMetrics: any[] = [];
      let localExerciseTypes: any[] = [];
      let localExercises: any[] = [];

      try {
        const [eRes, pRes, mRes, etRes, spRes, exRes] = await Promise.all([
          db.execute(`SELECT * FROM sessions WHERE (synced_backend = 0 OR synced_backend IS NULL) ORDER BY created_at DESC`),
          db.execute(`SELECT * FROM players`),
          db.execute(`SELECT * FROM calculated_data WHERE synced = 0`),
          db.execute(`SELECT * FROM exercise_types`),
          db.execute(`SELECT * FROM session_players WHERE assigned = 1`),
          db.execute(`SELECT * FROM exercises`),
        ]);

        let localEventsRaw = (eRes as any)?.rows?._array || [];
        const localPlayersRaw = (pRes as any)?.rows?._array || [];
        localMetrics = (mRes as any)?.rows?._array || [];
        localExerciseTypes = (etRes as any)?.rows?._array || [];
        const spRows = (spRes as any)?.rows?._array || [];
        localExercises = (exRes as any)?.rows?._array || [];

        // Attach participants to local events
        localEvents = localEventsRaw.map((ev: any) => ({
          ...ev,
          event_participants: spRows.filter((sp: any) => sp.session_id === ev.session_id)
        }));
        localPlayers = localPlayersRaw;

        // Apply local filtering
        if (clubId) {
          localEvents = localEvents.filter(e => e.club_id === clubId || !e.club_id);
          localPlayers = localPlayers.filter(p => p.club_id === clubId || !p.club_id);
          localExerciseTypes = localExerciseTypes.filter(et => et.club_id === clubId || !et.club_id);
        }
      } catch (dbErr) {
        console.warn("⚠️ SQLite load failed in PerformanceScreen", dbErr);
      }

      // Initial set from local data to provide immediate UI feedback
      setEvents(localEvents || []);
      setAllPlayers(localPlayers || []);
      setExerciseTypes(localExerciseTypes || []);
      setMetrics(localMetrics || []);
      setAllExercises(localExercises || []);

      // --- 2. TRY REMOTE DATA (Update) ---
      try {
        const [eventsRes, playersRes, metricsRes, exerciseTypesRes] = await Promise.all([
          api.get("/events", { timeout: 4000 }),
          api.get("/players", { timeout: 4000 }),
          api.get("/activity-metrics", { timeout: 6000 }),
          api.get(`/exercise-types${clubId ? `?club_id=${clubId}` : ""}`, { timeout: 4000 }),
        ]);

        const remoteEvents = Array.isArray(eventsRes.data?.data ?? eventsRes.data) ? (eventsRes.data?.data ?? eventsRes.data) : [];
        const filteredRemoteEvents = clubId ? remoteEvents.filter((e: any) => e.club_id === clubId) : remoteEvents;

        const remotePlayers = Array.isArray(playersRes.data?.data ?? playersRes.data) ? (playersRes.data?.data ?? playersRes.data) : [];
        const remoteMetrics = Array.isArray(metricsRes.data?.data ?? metricsRes.data) ? (metricsRes.data?.data ?? metricsRes.data) : [];
        const remoteExerciseTypes = Array.isArray(exerciseTypesRes.data?.data ?? exerciseTypesRes.data) ? (exerciseTypesRes.data?.data ?? exerciseTypesRes.data) : [];

        // Merge Events (Remote prioritization)
        const eventMap = new Map();
        localEvents.forEach(e => eventMap.set(normalizeSessionId(e.session_id), e));
        filteredRemoteEvents.forEach((e: any) => eventMap.set(normalizeSessionId(e.sessionId || e.session_id), e));
        const mergedEvents = Array.from(eventMap.values());
        setEvents(mergedEvents);

        // Merge Players
        const playerMap = new Map();
        localPlayers.forEach(p => playerMap.set(p.player_id, p));
        remotePlayers.forEach((p: any) => playerMap.set(p.player_id, p));
        setAllPlayers(Array.from(playerMap.values()));

        // Merge Exercise Types
        const exrMap = new Map();
        localExerciseTypes.forEach(et => exrMap.set(et.name, et));
        remoteExerciseTypes.forEach((et: any) => exrMap.set(et.name, et));
        setExerciseTypes(Array.from(exrMap.values()));

        // Merge Exercises
        const mergedExercisesMap = new Map();
        localExercises.forEach((ex: any) => {
          const key = `${normalizeSessionId(ex.session_id)}-${ex.exrId || ex.exr_id}`;
          mergedExercisesMap.set(key, ex);
        });
        filteredRemoteEvents.forEach((e: any) => {
          (e.exercises || []).forEach((ex: any) => {
            const key = `${normalizeSessionId(e.sessionId || e.session_id)}-${ex.exrId || ex.exr_id}`;
            mergedExercisesMap.set(key, {
              session_id: normalizeSessionId(e.sessionId || e.session_id),
              exrId: ex.exrId || ex.exr_id,
              start_ts: ex.start_ts || ex.start,
              end_ts: ex.end_ts || ex.end
            });
          });
        });
        setAllExercises(Array.from(mergedExercisesMap.values()));

        // Merge Metrics (Strict dedup by player+session+recordedAt+exrId)
        const metricMap = new Map();
        localMetrics.forEach(m => {
          const sid = normalizeSessionId(m.session_id);
          const pid = m.player_id;
          const eid = m.exrId || m.exr_id || "none";
          const key = `${pid}-${sid}-${m.recorded_at}-${eid}`;
          metricMap.set(key, m);
        });
        remoteMetrics.forEach((m: any) => {
          const sid = normalizeSessionId(m.sessionId || m.session_id);
          const pid = m.playerId || m.player_id;
          const eid = m.exrId || m.exr_id || "none";
          const key = `${pid}-${sid}-${m.recordedAt || m.recorded_at}-${eid}`;
          metricMap.set(key, m);
        });

        const mergedMetrics = Array.from(metricMap.values());
        setMetrics(mergedMetrics);

      } catch (apiErr) {
        console.warn("⚠️ API fetch failed, keeping local data", apiErr);
      }

    } catch (e) {
      console.error("[PerformanceScreen] loadRemoteData critical failure", e);
    }
  }, [getClubId]);

  const extractDateFromId = (id: string) => {
    const match = id.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
  };

  const formatDisplayDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
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
    const list = exerciseTypes
      .map((ex: any) => String(ex?.name ?? "").trim())
      .filter(Boolean);
    const unique = Array.from(new Set(list)).sort((a, b) => a.localeCompare(b));
    return ["all", ...unique];
  }, [exerciseTypes]);

  const normalizeMetric = (m: any) => {
    const sessionId = normalizeSessionId(m.sessionId || m.session_id);
    const playerId = m.playerId || m.player_id;
    const recordedRaw = m.recordedAt || m.recorded_at || m.created_at;
    const createdAt = recordedRaw ? new Date(recordedRaw).getTime() : Date.now();

    return {
      session_id: sessionId,
      player_id: playerId,
      exrId: m.exrId || m.exr_id,
      recorded_at: recordedRaw,
      created_at: createdAt,
      total_distance: m.totalDistance ?? m.total_distance ?? 0,
      hsr_distance: m.hsrDistance ?? m.hsr_distance ?? 0,
      sprint_distance: m.sprintDistance ?? m.sprint_distance ?? 0,
      top_speed: m.topSpeed ?? m.top_speed ?? 0,
      sprint_count: m.sprintCount ?? m.sprint_count ?? 0,
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

  const [markedDates, setMarkedDates] = useState<Record<string, any>>({});

  const loadSessions = useCallback(() => {
    let list = events.map((e: any) => {
      const sessionId = normalizeSessionId(e.sessionId || e.session_id || e.event_id);
      const dateKey = getEventDateKey(e) || extractDateFromId(sessionId);
      const displayName = (e.event_name && String(e.event_name).trim()) || formatEventTypeLabel(e.event_type) || "Session";
      const displayTime = formatEventTime(e, sessionId);
      const eventTs = e.event_date || e.eventDate;
      const eventMs = eventTs ? new Date(eventTs).getTime() : 0;
      const sortBase = Number(e.file_start_ts ?? e.fileStartTs ?? 0) || eventMs || Number(e.created_at ?? e.createdAt ?? 0) || 0;

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
      list = list.filter((s: any) => String(s.display_name || "").toLowerCase().includes(q) || String(s.session_id || "").toLowerCase().includes(q));
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
      if (dateKey) marks[dateKey] = { marked: true, dotColor: '#B50002' };
    });
    setMarkedDates(marks);
  }, [events]);

  useFocusEffect(useCallback(() => { loadRemoteData(); }, [loadRemoteData]));

  useEffect(() => { loadSessions(); loadMarkers(); }, [loadSessions, loadMarkers]);

  useEffect(() => {
    if (sessions.length === 0) {
      if (selectedSessions.length > 0) setSelectedSessions([]);
      return;
    }
    const ids = new Set(sessions.map(s => s.session_id));
    const hasAny = selectedSessions.some(id => ids.has(id));
    if (!hasAny) setSelectedSessions([sessions[0].session_id]);
  }, [sessions]);

  useEffect(() => { setSelectedPlayers([]); }, [selectedSessions]);

  useEffect(() => {
    let list: any[] = [];
    if (selectedSessions.length > 0) {
      const eventsBySession = new Map<string, any>();
      events.forEach((e: any) => {
        const sid = normalizeSessionId(e.sessionId || e.session_id || e.event_id);
        if (sid) {
          // Merge participants if duplicate sid (though unlikely)
          const existing = eventsBySession.get(sid);
          if (existing) {
            existing.event_participants = [...(existing.event_participants || []), ...(e.event_participants || [])];
          } else {
            eventsBySession.set(sid, { ...e });
          }
        }
      });

      const participantIds = new Set<string>();
      selectedSessions.forEach(sid => {
        const ev = eventsBySession.get(sid);
        const participants = ev?.event_participants || [];
        participants.forEach((p: any) => {
          const pid = p.player_id || p.player?.player_id;
          if (pid) participantIds.add(String(pid));
        });
      });

      // Start with all players and filter by those in the selected sessions
      list = allPlayers.filter((p: any) => participantIds.has(String(p.player_id)));
    } else {
      // If no sessions are selected, show an empty player list
      list = [];
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
  }, [allPlayers, events, selectedSessions, playerSearch, playerType]);

  const filteredData = useMemo(() => {
    if (!selectedPlayers?.length || !selectedSessions?.length) return [];
    const sessionSet = new Set(selectedSessions.map(s => normalizeSessionId(s)));
    const playerSet = new Set(selectedPlayers);

    // Get exrId for filtering if needed
    let targetExrIdSet: Set<string> | null = null;
    if (!selectedExercises.includes("all")) {
      const matches = exerciseTypes.filter(et => selectedExercises.includes(String(et.name)));
      targetExrIdSet = new Set(matches.map(m => m.exrId || m.exr_id).filter(Boolean));
    }

    return metrics.map(normalizeMetric).filter((m: any) => {
      const matchesSess = sessionSet.has(m.session_id);
      const matchesPlayer = playerSet.has(m.player_id);
      const matchesEx = !targetExrIdSet || (m.exrId && targetExrIdSet.has(m.exrId));
      return matchesSess && matchesPlayer && matchesEx;
    });
  }, [metrics, selectedSessions, selectedPlayers, selectedExercises, exerciseTypes]);

  const isAverageAllowed = useMemo(() => {
    return selectedSessions.length > 0 && selectedPlayers.length > 0;
  }, [selectedSessions, selectedPlayers]);

  const chartRows = useMemo(() => {
    if (!selectedSessions?.length || !selectedPlayers?.length || !selectedMetrics?.length) return [];

    const playerMap = new Map(allPlayers.map((p: any) => [p.player_id, { name: p.player_name || p.player_id, jersey: p.jersey_number }]));

    const sessionToEventName = new Map<string, string>();
    sessions.forEach((s: any) => {
      sessionToEventName.set(s.session_id, s.display_name || s.event_name || "Event");
    });

    const aggregations = new Map<string, { player_id: string; session_id: string; metric_key: string; sum: number; count: number; max: number; weightedSum: number; totalDuration: number }>();

    // Pre-populate so all selected players show up even with 0 data
    selectedPlayers.forEach(pid => {
      selectedSessions.forEach(sid => {
        selectedMetrics.forEach(metricKey => {
          const key = `${pid}|||${sid}|||${metricKey}`;
          aggregations.set(key, {
            player_id: pid,
            session_id: sid,
            metric_key: metricKey,
            sum: 0,
            count: 0,
            max: 0,
            weightedSum: 0,
            totalDuration: 0
          });
        });
      });
    });

    if (filteredData && filteredData.length > 0) {
      filteredData.forEach((m: any) => {
        const pid = m.player_id;
        const sid = m.session_id;
        if (!pid || !sid) return;

        // Find player weight
        const playerObj = allPlayers.find(p => p.player_id === pid);
        const weight = Number(playerObj?.weight) || 75; // Default to 75 if missing

        // Find exercise duration
        const exInstance = allExercises.find(ex => ex.session_id === sid && (ex.exrId || ex.exr_id) === m.exrId);
        const durationMs = (exInstance && exInstance.end_ts && exInstance.start_ts)
          ? (Number(exInstance.end_ts) - Number(exInstance.start_ts))
          : 0;
        const durationSec = durationMs / 1000;

        selectedMetrics.forEach(metricKey => {
          const key = `${pid}|||${sid}|||${metricKey}`;
          const val = Number(m?.[metricKey]) || 0;

          const agg = aggregations.get(key) || {
            player_id: pid,
            session_id: sid,
            metric_key: metricKey,
            sum: 0,
            count: 0,
            max: 0,
            weightedSum: 0,
            totalDuration: 0
          };

          if (metricKey === "power_score") {
            // Rule: sum (powerscore * weight * duration) then divide by totalDuration
            agg.weightedSum += (val * weight * durationSec);
            agg.totalDuration += durationSec;
          } else if (metricKey === "top_speed") {
            agg.max = Math.max(agg.max, val);
          } else {
            agg.sum += val;
          }

          agg.count += 1;
          aggregations.set(key, agg);
        });
      });
    }

    const palette = ["#B50002", "#175aeaff", "#16A34A", "#F59E0B", "#7C3AED", "#0EA5E9", "#DC2626", "#14B8A6", "#F97316", "#22C55E"];
    const metricColors: Record<string, string> = {};
    selectedMetrics.forEach((m, i) => { metricColors[m] = palette[i % palette.length]; });

    const rows = Array.from(aggregations.values()).map((agg) => {
      const info = playerMap.get(agg.player_id);
      let value = 0;

      if (agg.metric_key === "power_score") {
        value = agg.totalDuration > 0 ? (agg.weightedSum / agg.totalDuration) : 0;
      } else if (agg.metric_key === "top_speed") {
        value = agg.max;
      } else {
        value = agg.sum;
      }

      const eventName = sessionToEventName.get(agg.session_id) || "Event";
      const metricLabel = METRICS.find(m => m.key === agg.metric_key)?.label.split('(')[0].trim() || agg.metric_key;

      return {
        id: `${agg.player_id}-${agg.session_id}-${agg.metric_key}`,
        player_id: agg.player_id,
        session_id: agg.session_id,
        name: info?.name || agg.player_id,
        jersey: info?.jersey != null && info?.jersey !== "" ? String(info.jersey).padStart(2, "0") : "",
        value,
        color: selectedMetrics.length > 1 ? metricColors[agg.metric_key] : palette[selectedSessions.indexOf(agg.session_id) % palette.length],
        eventName: eventName,
        metricLabel: metricLabel
      };
    });

    rows.sort((a, b) => {
      const nameComp = a.name.localeCompare(b.name);
      if (nameComp !== 0) return nameComp;

      const aSidIdx = selectedSessions.indexOf(a.session_id);
      const bSidIdx = selectedSessions.indexOf(b.session_id);
      if (aSidIdx !== bSidIdx) return aSidIdx - bSidIdx;

      const aMetricKey = a.id.split('-').slice(-1)[0];
      const bMetricKey = b.id.split('-').slice(-1)[0];
      return selectedMetrics.indexOf(aMetricKey) - selectedMetrics.indexOf(bMetricKey);
    });

    return rows;
  }, [filteredData, allPlayers, selectedMetrics, averageEnabled, sessions, selectedSessions]);

  useEffect(() => {
    if (!isAverageAllowed && averageEnabled) {
      setAverageEnabled(false);
    }
  }, [isAverageAllowed, averageEnabled]);

  const toggleSession = (sid: string) => { setSelectedSessions(prev => prev.includes(sid) ? prev.filter(s => s !== sid) : [...prev, sid]); };
  const togglePlayer = (id: string) => { setSelectedPlayers(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]); };

  const downloadXLSX = async () => {
    try {
      // 1. Generate Filename: EventName_Date_Time
      const now = new Date();
      const datePart = now.toISOString().split('T')[0].replace(/-/g, '');
      const timePart = now.toTimeString().split(' ')[0].replace(/:/g, '');

      let eventPart = "NoEvent";
      const selectedEventsList = sessions.filter(s => selectedSessions.includes(s.session_id));
      if (selectedEventsList.length > 0) {
        const firstEvent = selectedEventsList[0].display_name.replace(/[^a-zA-Z0-9]/g, '_');
        if (selectedEventsList.length > 1) {
          eventPart = `${firstEvent}_and_${selectedEventsList.length - 1}_others`;
        } else {
          eventPart = firstEvent;
        }
      }

      const filename = `${eventPart}_${datePart}_${timePart}.xlsx`;
      const dirPath = Platform.OS === 'android' ? RNFS.DownloadDirectoryPath : RNFS.DocumentDirectoryPath;
      const path = `${dirPath}/${filename}`;

      // 2. Create Workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'H10 App';
      workbook.created = now;
      const worksheet = workbook.addWorksheet('Performance Data');

      // 3. Add Metadata
      worksheet.addRow(["H10 PERFORMANCE REPORT"]);
      worksheet.mergeCells('A1:E1'); // Merged across 5 columns now
      worksheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
      worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB50002' } };
      worksheet.getCell('A1').alignment = { horizontal: 'center' };

      worksheet.addRow([]);
      worksheet.addRow(["Export Date", now.toLocaleString()]);
      const metricsSummary = selectedMetrics.map(mk => METRICS.find(m => m.key === mk)?.label).join(", ");
      worksheet.addRow(["Selected Metrics", metricsSummary]);
      worksheet.addRow(["Aggregation", averageEnabled ? "Average" : "Sum"]);

      const eventNames = selectedEventsList.map(s => s.display_name).join("; ");
      worksheet.addRow(["Selected Events", eventNames]);
      worksheet.addRow([]);

      // 4. Add Data Table
      const headerRow = worksheet.addRow(["Player Name", "Jersey", "Event / Metric", "Value", "Visual Graph"]);
      headerRow.font = { bold: true };

      // Set Column Widths
      worksheet.columns = [
        { key: 'name', width: 25 },
        { key: 'jersey', width: 10 },
        { key: 'event', width: 40 },
        { key: 'value', width: 15 },
        { key: 'graph', width: 50 },
      ];

      const maxVal = Math.max(...chartRows.map(r => r.value), 1);

      chartRows.forEach(row => {
        const percentage = row.value / maxVal;
        const barLength = Math.round(percentage * 40); // Max 40 blocks
        const bar = '█'.repeat(barLength);

        const r = worksheet.addRow([
          row.name,
          row.jersey,
          row.eventName || "Event",
          Number(row.value.toFixed(2)),
          bar
        ]);

        // Color the visual graph bar cell (using text color)
        r.getCell(5).font = { color: { argb: 'FFB50002' }, bold: true };
      });

      // 5. Write File
      const buffer = await workbook.xlsx.writeBuffer();
      const bufferBase64 = Buffer.from(buffer).toString('base64');

      await RNFS.writeFile(path, bufferBase64, 'base64');

      if (Platform.OS === 'android') {
        ToastAndroid.show(`Saved: ${filename}`, ToastAndroid.LONG);
      }

      // 6. Share
      const fileUrl = `file://${path}`;
      try {
        await Share.open({
          title: 'Export Performance Data',
          url: fileUrl,
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          filename: filename.replace('.xlsx', ''),
          failOnCancel: false,
        });
      } catch (shareError) {
        console.log("Share skipped", shareError);
      }

    } catch (error) {
      console.log('Error downloading XLSX:', error);
      if (Platform.OS === 'android') ToastAndroid.show("Export failed", ToastAndroid.SHORT);
    }
  };

  const [sessionTypeOpen, setSessionTypeOpen] = useState(false);
  const [playerTypeOpen, setPlayerTypeOpen] = useState(false);

  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#020617' : '#F8FAFC', flexDirection: isPortrait ? 'column' : 'row' }]}>
      {sidebarVisible && (
        <View style={[styles.leftPanel, {
          backgroundColor: isDark ? '#0F172A' : '#F1F5F9',
          borderRightColor: isDark ? '#1E293B' : '#E2E8F0',
          width: isPortrait ? '100%' : 300,
          borderRightWidth: isPortrait ? 0 : 1,
          borderBottomWidth: isPortrait ? 1 : 0,
          borderBottomColor: isDark ? '#1E293B' : '#E2E8F0',
          height: isPortrait ? 380 : undefined
        }]}>
          <View style={[styles.filterBox, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', flex: 1 }]}>
            <View style={styles.boxHeader}>
              <Text style={[styles.boxTitle, { color: isDark ? '#F1F5F9' : '#0F172A' }]}>Events</Text>
              <TouchableOpacity style={[styles.miniDropdown, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]} onPress={() => setSessionTypeOpen(!sessionTypeOpen)}>
                <Text style={[styles.miniDropdownText, { color: isDark ? '#F1F5F9' : '#0F172A' }]}>{sessionType === 'all' ? 'All' : sessionType.charAt(0).toUpperCase() + sessionType.slice(1)}</Text>
                <Icon name={sessionTypeOpen ? "chevron-up" : "chevron-down"} size={14} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            {sessionTypeOpen && (
              <View style={[styles.inlineTypeSelection, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
                {["all", "match", "training"].map(type => (
                  <TouchableOpacity key={type} style={[styles.typeOption, sessionType === type && styles.typeOptionActive]} onPress={() => { setSessionType(type as any); setSessionTypeOpen(false); }}>
                    <Text style={[styles.typeOptionText, { color: isDark ? '#F1F5F9' : '#0F172A' }, sessionType === type && { color: '#B50002' }]}>{type.charAt(0).toUpperCase() + type.slice(1)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={styles.timespanRow}>
              <View style={styles.timespanInput}>
                <Text style={styles.timespanPlaceholder} numberOfLines={1}>{selectedDate ? `Date: ${selectedDate}` : "Select timespan"}</Text>
                <TouchableOpacity onPress={() => setShowCalendar(!showCalendar)}><Icon name={showCalendar ? "calendar-check" : "calendar-blank-outline"} size={20} color={isDark ? '#F1F5F9' : '#0F172A'} /></TouchableOpacity>
              </View>
            </View>
            <ScrollView style={styles.listFlex} showsVerticalScrollIndicator={false}>
              {showCalendar && (
                <View style={styles.inlineCalendarContainer}>
                  <Calendar onDayPress={(day: any) => { setSelectedDate(day.dateString); setShowCalendar(false); }} markedDates={{ ...markedDates, ...(selectedDate ? { [selectedDate]: { ...(markedDates[selectedDate] || {}), selected: true, selectedColor: '#B50002' } } : {}) }}
                    theme={{ calendarBackground: isDark ? '#1E293B' : '#fff', textSectionTitleColor: isDark ? '#94A3B8' : '#64748B', selectedDayBackgroundColor: '#B50002', selectedDayTextColor: '#ffffff', todayTextColor: '#B50002', dayTextColor: isDark ? '#F1F5F9' : '#0F172A', monthTextColor: isDark ? '#F1F5F9' : '#0F172A', textDayFontSize: 12, textMonthFontSize: 14, textDayHeaderFontSize: 12 }} style={{ width: '100%' }} />
                </View>
              )}
              {sessions.map((s, idx) => (
                <TouchableOpacity key={`${s.session_id}-${idx}`} style={[styles.listItem, { borderBottomWidth: 1, borderBottomColor: isDark ? '#1E293B' : '#F1F5F9' }]} onPress={() => toggleSession(s.session_id)}>
                  <Icon name={selectedSessions.includes(s.session_id) ? "checkbox-marked" : "checkbox-blank-outline"} size={22} color={selectedSessions.includes(s.session_id) ? "#B50002" : "#94A3B8"} />
                  <View style={[styles.listItemTextContainer, { marginLeft: 12 }]}><View style={styles.listItemTitleRow}><Text style={[styles.listItemName, { color: isDark ? '#F1F5F9' : '#0F172A' }]} numberOfLines={1}>{s.display_name}</Text></View><Text style={styles.listItemSub}>{s.display_sub}</Text></View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <View style={[styles.filterBox, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', marginTop: 16, flex: 1 }]}>
            <View style={styles.boxHeader}>
              <Text style={[styles.boxTitle, { color: isDark ? '#F1F5F9' : '#0F172A' }]}>Players</Text>
              <TouchableOpacity style={[styles.miniDropdown, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]} onPress={() => setPlayerTypeOpen(!playerTypeOpen)}>
                <Text style={[styles.miniDropdownText, { color: isDark ? '#F1F5F9' : '#0F172A' }]}>{playerType === 'all' ? 'All' : playerType}</Text>
                <Icon name={playerTypeOpen ? "chevron-up" : "chevron-down"} size={14} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* INLINE PLAYER TYPE SELECTION - NEW */}
            {playerTypeOpen && (
              <View style={[styles.inlineTypeSelection, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={true} persistentScrollbar={true} style={{ maxHeight: 180 }}>
                  {positionOptions.map(type => (
                    <TouchableOpacity key={type} style={[styles.typeOption, playerType === type && styles.typeOptionActive]} onPress={() => { setPlayerType(type); setPlayerTypeOpen(false); }}>
                      <Text style={[styles.typeOptionText, { color: isDark ? '#F1F5F9' : '#0F172A' }, playerType === type && { color: '#B50002' }]}>{type === "all" ? "All Positions" : type}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {players.length > 0 && (
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
            )}
            <ScrollView style={styles.listFlex} showsVerticalScrollIndicator={false}>
              {players.length === 0 ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40, opacity: 0.6 }}>
                  <Icon name="account-search-outline" size={32} color={isDark ? '#475569' : '#94A3B8'} />
                  <Text style={{
                    color: isDark ? '#94A3B8' : '#64748B',
                    fontSize: 12,
                    textAlign: 'center',
                    marginTop: 8,
                    paddingHorizontal: 20
                  }}>
                    {selectedSessions.length === 0 ? "Select an event above to view players" : "No players found for this event"}
                  </Text>
                </View>
              ) : (
                players.map((p, idx) => (
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
                ))
              )}
            </ScrollView>
          </View>
        </View>
      )}

      <View style={styles.rightPanel}>
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 0 }}>
          <View style={[styles.topHeaderCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.headerSelectionContainerStacked}>
              {(() => {
                const pCount = selectedPlayers.length.toString().padStart(2, '0');
                const eCount = selectedSessions.length.toString().padStart(2, '0');
                let eventLabel = `${eCount} Events`;
                if (selectedSessions.length === 1) {
                  const sId = selectedSessions[0];
                  const s = sessions.find(ss => ss.session_id === sId);
                  if (s) eventLabel = s.display_name;
                }
                return (
                  <View style={{ minWidth: 90 }}>
                    <Text style={styles.headerSelectionSubInlineStacked} numberOfLines={1}>{pCount} Players</Text>
                    <Text style={styles.headerSelectionSubInlineStacked} numberOfLines={1}>{eventLabel}</Text>
                  </View>
                );
              })()}
            </View>

            <View style={styles.headerControlsInline}>
              {/* Metric Dropdown */}
              <View ref={metricBtnRef}>
                <TouchableOpacity
                  style={[styles.roundedDropdownCompact, { borderColor: metricOpen ? '#B50002' : (isDark ? '#334155' : '#E2E8F0'), backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}
                  onPress={() => {
                    metricBtnRef.current?.measureInWindow((x, y, w, h) => {
                      setDropdownPos({ x: x - 20, y: y + h + 8, w: 200, h });
                      setMetricOpen(true);
                      setExerciseTypeOpen(false);
                    });
                  }}
                >
                  <Text style={[styles.roundedDropdownText, { color: isDark ? '#E2E8F0' : '#475569' }]} numberOfLines={1} ellipsizeMode="tail">
                    {selectedMetrics.length === 0 ? "Select Metric" : selectedMetrics.length === 1 ? selectedMetricLabel : `${selectedMetrics.length} Metrics`}
                  </Text>
                  <Icon name="chevron-down" size={14} color="#94A3B8" />
                </TouchableOpacity>

                <DropdownPicker
                  visible={metricOpen}
                  onClose={() => setMetricOpen(false)}
                  data={METRICS}
                  isMulti={true}
                  selectedKeys={selectedMetrics}
                  disabledKeys={disabledMetrics}
                  onSelect={(key: string) => {
                    setSelectedMetrics(prev => {
                      if (prev.includes(key)) {
                        return prev.filter(k => k !== key);
                      } else {
                        // Check if the new metric has the same unit as the already selected ones
                        if (prev.length > 0) {
                          const firstMetric = METRICS.find(m => m.key === prev[0]);
                          const newMetric = METRICS.find(m => m.key === key);
                          if (firstMetric && newMetric && firstMetric.unit !== newMetric.unit) {
                            // If different unit, don't add (though UI should prevent this via disabledKeys)
                            return prev;
                          }
                        }
                        return [...prev, key];
                      }
                    });
                  }}
                  isDark={isDark}
                  position={dropdownPos}
                  width={200}
                />
              </View>

              {/* Exercise Dropdown */}
              <View ref={exerciseBtnRef}>
                <TouchableOpacity
                  style={[styles.roundedDropdownCompact, { borderColor: exerciseTypeOpen ? '#B50002' : (isDark ? '#334155' : '#E2E8F0'), backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}
                  onPress={() => {
                    exerciseBtnRef.current?.measureInWindow((x, y, w, h) => {
                      setDropdownPos({ x: x - 40, y: y + h + 8, w: 180, h });
                      setExerciseTypeOpen(true);
                      setMetricOpen(false);
                    });
                  }}
                >
                  <Text style={[styles.roundedDropdownText, { color: isDark ? '#E2E8F0' : '#475569' }]} numberOfLines={1} ellipsizeMode="tail">
                    {selectedExercises.includes("all") ? "All Exercise" : selectedExercises.length === 1 ? selectedExercises[0] : `${selectedExercises.length} Exercises`}
                  </Text>
                  <Icon name="chevron-down" size={14} color="#94A3B8" />
                </TouchableOpacity>

                <DropdownPicker
                  visible={exerciseTypeOpen}
                  onClose={() => setExerciseTypeOpen(false)}
                  data={exerciseOptions}
                  isMulti={true}
                  selectedKeys={selectedExercises}
                  onSelect={(key: string) => {
                    const allIndividualOptions = exerciseOptions.filter((opt: string) => opt !== "all");
                    if (key === "all") {
                      if (selectedExercises.includes("all")) {
                        setSelectedExercises([]);
                      } else {
                        setSelectedExercises(["all", ...allIndividualOptions]);
                      }
                    } else {
                      setSelectedExercises(prev => {
                        const filtered = prev.filter(k => k !== "all");
                        const next = filtered.includes(key) ? filtered.filter(k => k !== key) : [...filtered, key];
                        if (next.length === allIndividualOptions.length && allIndividualOptions.length > 0) {
                          return ["all", ...next];
                        }
                        return next;
                      });
                    }
                  }}
                  isDark={isDark}
                  position={dropdownPos}
                  width={180}
                />
              </View>

              <View style={[styles.avgToggleInline, !isAverageAllowed && { opacity: 0.3 }]}>
                <Text style={[styles.avgTextLabelInline, { color: isDark ? '#94A3B8' : '#64748B' }]}>AVG</Text>
                <TouchableOpacity
                  onPress={() => isAverageAllowed && setAverageEnabled(!averageEnabled)}
                  disabled={!isAverageAllowed}
                  style={[styles.iosToggleFrameSmall, averageEnabled && styles.iosToggleFrameOn]}
                >
                  <View style={[styles.iosToggleCircleSmall, averageEnabled && styles.iosToggleCircleOnSmall]} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          style={{ zIndex: 1 }}
        >



          <View style={styles.graphWrapper}>
            {chartRows.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Icon name="chart-bar-stacked" size={64} color="#E2E8F0" />
                <Text style={[styles.empty, { color: isDark ? '#94A3B8' : '#64748b' }]}>Not enough data to compare</Text>
              </View>
            ) : (
              <>
                <View style={styles.graphActionButtons}>
                  <TouchableOpacity
                    style={[styles.floatingActionBtn, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}
                    onPress={() => setIsFullScreen(true)}
                  >
                    <Icon name="arrow-expand" size={22} color={isDark ? '#F1F5F9' : '#1E293B'} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.floatingActionBtn, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}
                    onPress={downloadXLSX}
                  >
                    <Icon name="file-excel-outline" size={22} color="#16a34a" />
                  </TouchableOpacity>
                </View>

                <HorizontalBarCompare
                  rows={chartRows}
                  accentColor="#B50002"
                  textColor={isDark ? "#E2E8F0" : "#1E293B"}
                  xLabel={selectedMetricLabel}
                  isDark={isDark}
                  showAverageLine={averageEnabled}
                  uniquePlayerCount={selectedPlayers.length}
                  uniqueEventCount={selectedSessions.length}
                  title={selectedSessions.length === 1 ? sessions.find(s => s.session_id === selectedSessions[0])?.display_name : (selectedSessions.length > 1 ? "Event Comparison" : "")}
                />
              </>
            )}
          </View>
        </ScrollView>
      </View >

      {/* GRAPH POPUP MODAL */}
      < Modal
        visible={isFullScreen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsFullScreen(false)
        }
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.centeredPopup, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
            <TouchableOpacity
              style={[styles.popupCloseBtn, { padding: 6, backgroundColor: isDark ? "#334155" : "#F1F5F9", borderRadius: 12 }]}
              onPress={() => setIsFullScreen(false)}
            >
              <Icon name="close" size={24} color={isDark ? "#F1F5F9" : "#0F172A"} />
            </TouchableOpacity>

            <View
              style={styles.popupBody}
              onLayout={(e) => {
                const h = e.nativeEvent.layout.height;
                if (h > 0) setPopupHeight(h);
              }}
            >
              <HorizontalBarCompare
                rows={chartRows}
                accentColor="#B50002"
                textColor={isDark ? "#E2E8F0" : "#1E293B"}
                xLabel={selectedMetricLabel}
                isDark={isDark}
                showAverageLine={averageEnabled}
                uniquePlayerCount={selectedPlayers.length}
                uniqueEventCount={selectedSessions.length}
                height={popupHeight}
                title={selectedSessions.length === 1 ? sessions.find(s => s.session_id === selectedSessions[0])?.display_name : (selectedSessions.length > 1 ? "Event Comparison" : "")}
              />
            </View>
          </View>
        </View>
      </Modal >
    </View >
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  leftPanel: { width: 300, padding: 12, borderRightWidth: 1 },
  filterBox: { borderRadius: 12, padding: 12, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10 },
  boxHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  boxTitle: { fontSize: 18, fontWeight: "700" },
  miniDropdown: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
  miniDropdownText: { fontSize: 12, fontWeight: '600' },
  timespanRow: { marginBottom: 16 },
  timespanInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 8 },
  timespanPlaceholder: { fontSize: 14, color: '#94A3B8' },
  listFlex: { flex: 1 },
  listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  listItemTextContainer: { flex: 1 },
  listItemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  listItemTime: { fontSize: 12, fontWeight: '700' },
  listItemName: { fontSize: 14, fontWeight: '600' },
  listItemSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  selectAllHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', marginBottom: 4 },
  selectAllLabel: { fontSize: 14, fontWeight: '600' },
  playerAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  rightPanel: { flex: 1 },
  rightContent: { padding: 24 },
  topHeaderCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14, // Increased from 10
    borderRadius: 16,
    marginBottom: 16,
    elevation: 0,
    shadowColor: undefined,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 8,
  },
  headerSelectionContainerStacked: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    flexShrink: 1,
  },
  headerSelectionSubInlineStacked: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '800',
    lineHeight: 14,
  },
  headerSelectionTitle: {
    fontSize: 16, // Scaled up slightly
    fontWeight: '900',
  },
  verticalDivider: {
    width: 1,
    height: 14,
  },
  headerSelectionSubInline: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '800',
  },
  headerControlsInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  roundedDropdownCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 8, // Increased from 6
    borderRadius: 10,
    borderWidth: 1.2,
    justifyContent: 'space-between',
    width: 120, // Reduced slightly to ensure AVG fits
  },
  roundedDropdownText: {
    fontSize: 11, // Match design better
    fontWeight: '700',
    flex: 1,
  },
  avgToggleInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 4
  },
  avgTextLabelInline: {
    fontSize: 12, // More readable
    fontWeight: '900'
  },
  iosToggleFrameSmall: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    padding: 2,
    justifyContent: 'center'
  },
  iosToggleCircleSmall: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFF'
  },
  iosToggleCircleOnSmall: {
    alignSelf: 'flex-end'
  },
  /* OLD STYLES CLEANUP */
  headerSelectionInfo: { flexShrink: 1 },
  headerControls: { flexDirection: 'row' },
  roundedDropdown: { width: 160 },
  dropdownAbsolute: {
    position: 'absolute',
    top: 45,
    right: 0,
    width: 200,
    borderWidth: 1,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    zIndex: 9999,
    padding: 4,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  dropdownItemActive: {
    backgroundColor: 'rgba(181, 0, 2, 0.05)',
  },
  avgToggleGroup: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 2 },
  avgTextLabel: { fontSize: 11, fontWeight: '900' },
  iosToggleFrame: { width: 48, height: 26, borderRadius: 13, backgroundColor: '#E2E8F0', padding: 3, justifyContent: 'center' },
  iosToggleFrameOn: { backgroundColor: '#B50002' },
  iosToggleCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF' },
  iosToggleCircleOn: { alignSelf: 'flex-end' },
  downloadBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, marginLeft: 6 },
  graphWrapper: { flex: 1, position: 'relative' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', height: 300 },
  empty: { textAlign: "center", marginTop: 10, fontSize: 16 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center", alignItems: 'center' },
  modal: { borderRadius: 12, width: '80%', maxHeight: "70%", padding: 10 },
  modalItem: { padding: 14 },
  modalActive: { backgroundColor: "#e0ecff" },
  modalTextActive: { fontWeight: "700", color: "#DC2626" },
  graphActionButtons: {
    position: 'absolute',
    top: 15,
    right: 15,
    zIndex: 100,
    gap: 10,
    alignItems: 'center',
  },
  floatingActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  centeredPopup: {
    width: '95%',
    height: '80%',
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  popupCloseBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 100,
  },
  popupBody: {
    flex: 1,
    padding: 20,
    paddingTop: 20,
  },
  popupBodyScroll: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  inlineCalendarContainer: { backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 8, padding: 0, marginBottom: 12, overflow: 'hidden', width: '100%' },
  inlineTypeSelection: { padding: 8, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  typeOption: { padding: 10, borderRadius: 6 },
  typeOptionActive: { backgroundColor: 'rgba(181, 0, 2, 0.05)' },
  typeOptionText: { fontSize: 13, fontWeight: '600' },

  /* STANDARD DROPDOWN (Notification Style) */
  modalOverlayStandard: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.02)', // Nearly transparent
  },
  standardDropdownContainer: {
    maxHeight: '60%',
    borderRadius: 20,
    borderWidth: 1,
    elevation: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    overflow: 'hidden',
  },
  dropdownHeaderStandard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  dropdownTitleStandard: {
    fontSize: 16,
    fontWeight: '800',
  },
  dropdownCloseBtnStandard: {
    padding: 4,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
  },
  dropdownDividerStandard: {
    height: 1,
  },
  dropdownItemStandard: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dropdownItemActiveStandard: {
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
  },
  dropdownItemTextStandard: {
    fontSize: 14,
  },
  dropdownFooterStandard: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderTopWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownFooterTextStandard: {
    fontSize: 12,
    fontWeight: '600',
  },
});