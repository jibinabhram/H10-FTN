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
  const [sidebarVisible, setSidebarVisible] = useState(true);

  const selectedMetricLabel =
    METRICS.find(m => m.key === metric)?.label ?? "";

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
    } catch (e) {
      console.log("[PerformanceScreen] Failed to load remote data", e);
      setEvents([]);
      setAllPlayers([]);
      setMetrics([]);
      setExerciseTypes([]);
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
    if (exerciseType !== "all") {
      const wanted = exerciseType.toLowerCase();
      list = list.filter((s: any) => Array.isArray(s.exercises) && s.exercises.some((ex: any) => String(ex?.type || "").toLowerCase() === wanted));
    }
    list.sort((a: any, b: any) => (b._sort_ts || 0) - (a._sort_ts || 0));
    setSessions(list);
  }, [events, sessionSearch, sessionType, selectedDate, exerciseType]);

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
      if (participantIds.size > 0) list = list.filter((p: any) => participantIds.has(p.player_id));
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

  const chartRows = useMemo(() => {
    if (!data.length) return [];
    const playerMap = new Map(allPlayers.map((p: any) => [p.player_id, { name: p.player_name || p.player_id, jersey: p.jersey_number }]));

    // Create a map of session IDs to event names for labeling
    const sessionToEventName = new Map<string, string>();
    sessions.forEach((s: any) => {
      sessionToEventName.set(s.session_id, s.display_name || s.event_name || "Event");
    });

    // Group by player + session (event) combination
    const byPlayerAndSession = new Map<string, { player_id: string; session_id: string; sum: number; count: number }>();

    data.forEach((m: any) => {
      const pid = m.player_id;
      const sid = m.session_id;
      if (!pid || !sid) return;

      const key = `${pid}|||${sid}`; // Use a delimiter that won't appear in IDs
      const val = Number(m?.[metric]) || 0;
      const agg = byPlayerAndSession.get(key) || { player_id: pid, session_id: sid, sum: 0, count: 0 };
      agg.sum += val;
      agg.count += 1;
      byPlayerAndSession.set(key, agg);
    });

    const palette = ["#B50002", "#2563EB", "#16A34A", "#F59E0B", "#7C3AED", "#0EA5E9", "#DC2626", "#14B8A6", "#F97316", "#22C55E"];
    const colorForSession = (sessionId: string, index: number) => {
      return palette[index % palette.length];
    };

    // Convert to rows with player and event info
    const rows = Array.from(byPlayerAndSession.entries()).map(([key, agg]) => {
      const info = playerMap.get(agg.player_id);
      const value = averageEnabled ? (agg.count ? agg.sum / agg.count : 0) : agg.sum;
      const eventName = sessionToEventName.get(agg.session_id) || "Event";
      const sessionIndex = selectedSessions.indexOf(agg.session_id);

      return {
        id: key,
        player_id: agg.player_id,
        session_id: agg.session_id,
        name: info?.name || agg.player_id,
        jersey: info?.jersey != null && info?.jersey !== "" ? String(info.jersey).padStart(2, "0") : "",
        value,
        color: colorForSession(agg.session_id, sessionIndex),
        eventName: eventName
      };
    });

    // Sort by player name first, then by session order
    rows.sort((a, b) => {
      const nameCompare = a.name.localeCompare(b.name);
      if (nameCompare !== 0) return nameCompare;

      const aSessionIndex = selectedSessions.indexOf(a.session_id);
      const bSessionIndex = selectedSessions.indexOf(b.session_id);
      return aSessionIndex - bSessionIndex;
    });

    return rows;
  }, [data, allPlayers, metric, averageEnabled, sessions, selectedSessions]);

  useEffect(() => {
    if (!selectedPlayers.length || !selectedSessions.length) { setData([]); return; }
    const sessionSet = new Set(selectedSessions.map(s => normalizeSessionId(s)));
    const playerSet = new Set(selectedPlayers);
    const filtered = metrics.map(normalizeMetric).filter((m: any) => sessionSet.has(m.session_id) && playerSet.has(m.player_id));
    setData(filtered);
  }, [metrics, selectedSessions, selectedPlayers]);

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
      worksheet.addRow(["Selected Metric", selectedMetricLabel]);
      worksheet.addRow(["Aggregation", averageEnabled ? "Average" : "Sum"]);

      const eventNames = selectedEventsList.map(s => s.display_name).join("; ");
      worksheet.addRow(["Selected Events", eventNames]);
      worksheet.addRow([]);

      // 4. Add Data Table
      const headerRow = worksheet.addRow(["Player Name", "Jersey", `Value (${selectedMetricLabel})`, "Visual Graph"]);
      headerRow.font = { bold: true };

      // Set Column Widths
      worksheet.columns = [
        { key: 'name', width: 25 },
        { key: 'jersey', width: 10 },
        { key: 'value', width: 20 },
        { key: 'graph', width: 50 },
      ];

      const maxVal = Math.max(...chartRows.map(r => r.value), 1);

      chartRows.forEach(row => {
        const percentage = row.value / maxVal;
        const barLength = Math.round(percentage * 40); // Max 40 blocks
        const bar = '█'.repeat(barLength);

        const r = worksheet.addRow([row.name, row.jersey, Number(row.value.toFixed(2)), bar]);

        // Color the visual graph bar cell (using text color)
        r.getCell(4).font = { color: { argb: 'FFB50002' }, bold: true };
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
    <View style={[styles.root, { backgroundColor: isDark ? '#020617' : '#F8FAFC' }]}>
      {sidebarVisible && (
        <View style={[styles.leftPanel, { backgroundColor: isDark ? '#0F172A' : '#F1F5F9', borderRightColor: isDark ? '#1E293B' : '#E2E8F0' }]}>
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
                    theme={{ calendarBackground: isDark ? '#1E293B' : '#fff', textSectionTitleColor: isDark ? '#94A3B8' : '#64748B', selectedDayBackgroundColor: '#B50002', selectedDayTextColor: '#ffffff', todayTextColor: '#B50002', dayTextColor: isDark ? '#F1F5F9' : '#0F172A', monthTextColor: isDark ? '#F1F5F9' : '#0F172A', dayTextFontSize: 12, monthTextFontSize: 14, textDayHeaderFontSize: 12 }} style={{ width: '100%' }} />
                </View>
              )}
              {sessions.map((s, idx) => (
                <TouchableOpacity key={`${s.session_id}-${idx}`} style={[styles.listItem, { borderBottomWidth: 1, borderBottomColor: isDark ? '#1E293B' : '#F1F5F9' }]} onPress={() => toggleSession(s.session_id)}>
                  <Icon name={selectedSessions.includes(s.session_id) ? "checkbox-marked" : "checkbox-blank-outline"} size={22} color={selectedSessions.includes(s.session_id) ? "#B50002" : "#94A3B8"} />
                  <View style={[styles.listItemTextContainer, { marginLeft: 12 }]}><View style={styles.listItemTitleRow}>{s.display_time && <Text style={[styles.listItemTime, { color: isDark ? '#94A3B8' : '#64748B' }]}>{s.display_time}</Text>}<Text style={[styles.listItemName, { color: isDark ? '#F1F5F9' : '#0F172A' }]} numberOfLines={1}>{s.display_name}</Text></View><Text style={styles.listItemSub}>{s.display_sub}</Text></View>
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

            <TouchableOpacity style={styles.selectAllHeader} onPress={() => { if (selectedPlayers.length === players.length) setSelectedPlayers([]); else setSelectedPlayers(players.map(p => p.player_id)); }}>
              <Icon name={selectedPlayers.length === players.length ? "checkbox-marked" : "checkbox-blank-outline"} size={20} color={selectedPlayers.length === players.length ? "#B50002" : "#94A3B8"} />
              <Text style={[styles.selectAllLabel, { color: isDark ? '#F1F5F9' : '#0F172A' }]}>Select all players</Text>
            </TouchableOpacity>
            <ScrollView style={styles.listFlex} showsVerticalScrollIndicator={false}>
              {players.map((p, idx) => (
                <TouchableOpacity key={p.player_id} style={[styles.listItem, { borderBottomWidth: 1, borderBottomColor: isDark ? '#1E293B' : '#F1F5F9' }]} onPress={() => togglePlayer(p.player_id)}>
                  <Icon name={selectedPlayers.includes(p.player_id) ? "checkbox-marked" : "checkbox-blank-outline"} size={22} color={selectedPlayers.includes(p.player_id) ? "#B50002" : "#94A3B8"} />
                  <View style={[styles.playerAvatar, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9', marginLeft: 12 }]}><Icon name="account-outline" size={20} color="#94A3B8" /></View>
                  <View style={[styles.listItemTextContainer, { marginLeft: 12 }]}><Text style={[styles.listItemName, { color: isDark ? '#F1F5F9' : '#0F172A' }]} numberOfLines={1}>{p.player_name || "N/A"}</Text><Text style={styles.listItemSub}>#{String(p.jersey_number || (idx + 1)).padStart(2, '0')} {p.position || "N/A"}</Text></View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      <View style={styles.rightPanel}>
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 0, zIndex: 100 }}>
          <View style={[styles.topHeaderCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }, !sidebarVisible && { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center' }]}>
            <View style={[styles.headerSelectionInfo, !sidebarVisible && { flex: 0, minWidth: 'auto', marginRight: 40 }]}>
              <View style={styles.titleRow}>
                <TouchableOpacity style={styles.sidebarToggleBtn} onPress={() => setSidebarVisible(!sidebarVisible)}><Icon name={sidebarVisible ? "chevron-left" : "menu"} size={22} color="#B50002" /></TouchableOpacity>
                <Text style={[styles.headerSelectionTitle, { color: isDark ? '#F1F5F9' : '#1E293B' }]}>Total Selection</Text>
              </View>
              <Text style={styles.headerSelectionSub}>{selectedPlayers.length.toString().padStart(2, '0')} Players   {selectedSessions.length.toString().padStart(2, '0')} Events</Text>
            </View>
            <View style={[styles.headerControls, !sidebarVisible && { justifyContent: 'flex-end', flex: 1 }]}>
              {/* Metric Dropdown */}
              <View style={{ zIndex: 20 }}>
                <TouchableOpacity
                  style={[styles.roundedDropdown, { borderColor: metricOpen ? '#B50002' : '#E2E8F0', backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}
                  onPress={() => { setMetricOpen(!metricOpen); setExerciseTypeOpen(false); }}
                >
                  <Text style={[styles.roundedDropdownText, { color: isDark ? '#E2E8F0' : '#475569' }]}>{selectedMetricLabel}</Text>
                  <Icon name="chevron-down" size={18} color="#94A3B8" />
                </TouchableOpacity>
                {metricOpen && (
                  <View style={[styles.dropdownAbsolute, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
                    <FlatList
                      data={METRICS}
                      keyExtractor={(item) => item.key}
                      style={{ maxHeight: 220 }}
                      persistentScrollbar={true}
                      nestedScrollEnabled={true}
                      showsVerticalScrollIndicator={true}
                      keyboardShouldPersistTaps="handled"
                      removeClippedSubviews={false}
                      scrollEnabled={true}
                      renderItem={({ item }) => (
                        <TouchableOpacity style={[styles.dropdownItem, item.key === metric && styles.dropdownItemActive]} onPress={() => { setMetric(item.key); setMetricOpen(false); }}>
                          <Text style={[item.key === metric && styles.modalTextActive, { color: isDark ? (item.key === metric ? '#60A5FA' : '#E2E8F0') : (item.key === metric ? '#2563eb' : '#0F172A'), fontSize: 12 }]}>{item.label}</Text>
                        </TouchableOpacity>
                      )}
                    />
                  </View>
                )}
              </View>

              {/* Exercise Dropdown */}
              <View style={{ zIndex: 10 }}>
                <TouchableOpacity
                  style={[styles.roundedDropdown, { borderColor: exerciseTypeOpen ? '#B50002' : '#E2E8F0', backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}
                  onPress={() => { setExerciseTypeOpen(!exerciseTypeOpen); setMetricOpen(false); }}
                >
                  <Text style={[styles.roundedDropdownText, { color: isDark ? '#E2E8F0' : '#475569' }]}>{exerciseType === "all" ? "All Exercise" : exerciseType}</Text>
                  <Icon name="chevron-down" size={18} color="#94A3B8" />
                </TouchableOpacity>
                {exerciseTypeOpen && (
                  <View style={[styles.dropdownAbsolute, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
                    <FlatList
                      data={exerciseOptions}
                      keyExtractor={(item) => item}
                      style={{ maxHeight: 220 }}
                      persistentScrollbar={true}
                      nestedScrollEnabled={true}
                      showsVerticalScrollIndicator={true}
                      keyboardShouldPersistTaps="handled"
                      removeClippedSubviews={false}
                      scrollEnabled={true}
                      renderItem={({ item }) => (
                        <TouchableOpacity style={[styles.dropdownItem, item === exerciseType && styles.dropdownItemActive]} onPress={() => { setExerciseType(item); setExerciseTypeOpen(false); }}>
                          <Text style={[item === exerciseType && styles.modalTextActive, { color: isDark ? (item === exerciseType ? '#B50002' : '#E2E8F0') : (item === exerciseType ? '#B50002' : '#0F172A'), fontSize: 12 }]}>{item === "all" ? "All Exercises" : item}</Text>
                        </TouchableOpacity>
                      )}
                    />
                  </View>
                )}
              </View>

              <View style={styles.avgToggleGroup}>
                <Text style={[styles.avgTextLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>AVG</Text>
                <TouchableOpacity onPress={() => setAverageEnabled(!averageEnabled)} style={[styles.iosToggleFrame, averageEnabled && styles.iosToggleFrameOn]}>
                  <View style={[styles.iosToggleCircle, averageEnabled && styles.iosToggleCircleOn]} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={downloadXLSX} style={[styles.downloadBtn, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
                <Icon name="file-excel-outline" size={24} color="#16a34a" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          scrollEnabled={!metricOpen && !exerciseTypeOpen}   // 👈 KEY FIX
          style={{ zIndex: 1 }}
        >



          <View style={styles.graphWrapper}>
            {chartRows.length === 0 ? (
              <View style={styles.emptyContainer}><Icon name="chart-bar-stacked" size={64} color="#E2E8F0" /><Text style={[styles.empty, { color: isDark ? '#94A3B8' : '#64748b' }]}>Not enough data to compare</Text></View>
            ) : (
              <HorizontalBarCompare
                rows={chartRows}
                accentColor="#B50002"
                textColor={isDark ? "#E2E8F0" : "#1E293B"}
                xLabel={selectedMetricLabel}
                isDark={isDark}
                showAverageLine={averageEnabled}
                uniquePlayerCount={selectedPlayers.length}
                uniqueEventCount={selectedSessions.length}
              />
            )}
          </View>
        </ScrollView>
      </View>

      {/* Modal Definitions Removed - Replaced with Dropdowns */}

      {/* Removed the Player Position Modal from here as it's now inline */}

    </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    marginBottom: 20,
    elevation: 0,
    shadowColor: undefined,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 8,
    // overflow: 'hidden', // REMOVED to allow dropdowns to show
    zIndex: 10,
    rowGap: 12
  },
  headerSelectionInfo: {
    minWidth: 220, // Prevent crushing
    flexGrow: 1,
    marginRight: 10,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sidebarToggleBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(181, 0, 2, 0.08)', justifyContent: 'center', alignItems: 'center' },
  headerSelectionTitle: { fontSize: 18, fontWeight: '900', flexShrink: 0 }, // flexShrink 0 to prevent text wrapping/crushing
  headerSelectionSub: { fontSize: 11, color: '#94A3B8', fontWeight: '800', marginLeft: 42, marginTop: -2 },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-start', // Start aligning if wrapped, looks better
    flexGrow: 20, // Take up remaining space or forced to new line
  },
  roundedDropdown: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, justifyContent: 'space-between' },
  roundedDropdownText: { fontSize: 11, fontWeight: '700' },
  dropdownAbsolute: {
    position: 'absolute',
    top: 45,
    right: 0,
    width: 200,
    borderRadius: 12,
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
  graphWrapper: { flex: 1 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', height: 300 },
  empty: { textAlign: "center", marginTop: 10, fontSize: 16 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center", alignItems: 'center' },
  modal: { borderRadius: 12, width: '80%', maxHeight: "70%", padding: 10 },
  modalItem: { padding: 14 },
  modalActive: { backgroundColor: "#e0ecff" },
  modalTextActive: { fontWeight: "700", color: "#2563eb" },
  inlineCalendarContainer: { backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 8, padding: 0, marginBottom: 12, overflow: 'hidden', width: '100%' },
  inlineTypeSelection: { padding: 8, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  typeOption: { padding: 10, borderRadius: 6 },
  typeOptionActive: { backgroundColor: 'rgba(181, 0, 2, 0.05)' },
  typeOptionText: { fontSize: 13, fontWeight: '600' },
});