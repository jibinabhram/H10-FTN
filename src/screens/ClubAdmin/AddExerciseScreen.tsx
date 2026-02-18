import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    PanResponder,
    Dimensions,
    TextInput,
    Alert,
    Platform,
    KeyboardAvoidingView,
    ScrollView,
    ActivityIndicator,
    RefreshControl,
    Keyboard,
} from "react-native";
import Svg, { Path, G, Line, Text as SvgText, Circle, Rect } from "react-native-svg";
import Ionicons from "react-native-vector-icons/Ionicons";
import NetInfo from "@react-native-community/netinfo";
import { db } from "../../db/sqlite";
import { getAssignedPlayersForSession } from "../../services/sessionPlayer.service";
import { syncSessionToPodholder } from "../../services/sessionSync.service";
import { useTheme } from "../../components/context/ThemeContext";
import { useAlert } from "../../components/context/AlertContext";
import { useSnackbar } from "../../components/context/SnackbarContext";

const PRIMARY_RED = "#DC2626";

const HANDLE_GAP = 0.01;
// REMOVE HARDCODED EXERCISE_TYPES
// const EXERCISE_TYPES = ["Select Exercise", "Warmup", ...];
const DEFAULT_COLORS = ["transparent", "#10B981", "#EF4444", "#F59E0B", "#3b83f64b", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316", "#84CC16", "#6366F1"];

const PLAYER_ROW_H = 84;
const LANE_INNER_H = 64;
const NAME_COL_WIDTH = 140;
const BASE_GRAPH_HEIGHT = 420;

function getColorForExercise(name: string, allTypes: string[]) {
    // Basic cycling of colors based on index in avail list
    const idx = allTypes.indexOf(name);
    if (idx === -1) return "#999";
    // If it's "Select Exercise" (usually index 0), we might want separate logic, but usually it's excluded from visualization
    // index 0 of DEFAULT_COLORS is transparent, which is good for "Select Exercise" if it ends up there
    return DEFAULT_COLORS[idx % DEFAULT_COLORS.length] || "#999";
}

/* ================= HELPERS ================= */

function formatTimeMs(ms: number) {
    if (!ms || isNaN(ms)) return "--:--:--";
    const d = new Date(ms);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
}

function formatDuration(ms: number) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

function parseTimeFlexible(input: string, baseDateMs: number) {
    const s = (input || "").trim();
    if (!s) return { ok: false } as const;
    const base = new Date(baseDateMs);
    try {
        const cand = new Date(`${base.toDateString()} ${s}`);
        if (!isNaN(cand.getTime())) return { ok: true, type: "absolute", ms: cand.getTime() } as const;
    } catch { }
    const parts = s.split(":").map((p) => Number(p));
    if (parts.some((p) => isNaN(p))) return { ok: false } as const;
    if (parts.length === 3) {
        const [hh, mm, ss] = parts;
        const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hh, mm, ss);
        if (!isNaN(d.getTime())) return { ok: true, type: "absolute", ms: d.getTime() } as const;
    }
    if (parts.length === 2) return { ok: true, type: "duration", seconds: parts[0] * 60 + parts[1] } as const;
    return { ok: true, type: "duration", seconds: parts[0] } as const;
}

function hexToRgba(hex: string | undefined | null, alpha = 0.22) {
    if (hex === "transparent") return "transparent";
    const safeHex = typeof hex === "string" && hex ? hex : "#999999";
    const h = safeHex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const bigint = parseInt(full, 16) || 0x999999;
    const r = (bigint >> 16) & 255,
        g = (bigint >> 8) & 255,
        b = bigint & 255;
    return `rgba(${r},${g},${b},${alpha})`;
}

function prng(seed: number) {
    let state = (Math.abs(seed) % 2147483647) || 1;
    return () => {
        state = (state * 16807) % 2147483647;
        return (state - 1) / 2147483646;
    };
}

function generateMarketWave(seed: number, segments = 300) {
    const rnd = prng(seed + 999);
    const out: number[] = [];
    const trendStrength = 0.3 + rnd() * 0.4;
    const volatility = 0.15 + rnd() * 0.25;
    const cycleFreq = 2 + rnd() * 4;
    const noiseLevel = 0.08 + rnd() * 0.12;
    let value = 0.5;
    for (let i = 0; i < segments; i++) {
        const t = i / (segments - 1);
        const trend = Math.sin(t * Math.PI * 0.5) * trendStrength;
        const cycle = Math.sin(t * Math.PI * cycleFreq) * volatility * 0.6;
        const randomWalk = (rnd() - 0.5) * volatility;
        const noise = (rnd() - 0.5) * noiseLevel;
        value += randomWalk + noise;
        const combined = value + trend + cycle;
        const clamped = Math.max(0, Math.min(1, combined));
        out.push(clamped);
        value = Math.max(0.2, Math.min(0.8, value));
    }
    return out;
}

function catmullRom2bezier(points: { x: number; y: number }[], tension = 0.5) {
    if (!points.length) return "";
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    const d: string[] = [];
    d.push(`M ${points[0].x} ${points[0].y}`);
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i - 1] ?? points[i];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2] ?? p2;
        const t = tension;
        const cp1x = p1.x + ((p2.x - p0.x) / 6) * t;
        const cp1y = p1.y + ((p2.y - p0.y) / 6) * t;
        const cp2x = p2.x - ((p3.x - p1.x) / 6) * t;
        const cp2y = p2.y - ((p3.y - p1.y) / 6) * t;
        d.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`);
    }
    return d.join(" ");
}

/* ================= COMPONENTS ================= */

/* ================= COMPONENTS ================= */

const Step = ({ icon, label, active, completed }: any) => (
    <View style={styles.stepItem}>
        <View style={[styles.stepOuter, active && styles.stepOuterActive, completed && styles.stepOuterCompleted]}>
            <Ionicons name={icon} size={14} color={active || completed ? "#fff" : "#94A3B8"} />
        </View>
        <Text style={[styles.stepTxt, active && styles.stepTxtActive]}>{label}</Text>
    </View>
);

const StepLine = ({ active }: any) => (
    <View style={[styles.sLine, active && styles.sLineActive]} />
);

const StatBox = ({ label, value, color, textColor }: any) => (
    <View style={[styles.sBox, { backgroundColor: color }]}>
        <Text style={[styles.sVal, { color: textColor }]}>{label}: {value}</Text>
    </View>
);

function GraphXAxis({ width, startMs, endMs, isDark }: { width: number, startMs: number, endMs: number, isDark?: boolean }) {
    const ticks = 6;
    const dur = endMs - startMs;
    const items = [];
    for (let i = 0; i < ticks; i++) {
        const pct = i / (ticks - 1);
        const time = formatTimeMs(startMs + dur * pct);
        items.push({ time, x: pct * width });
    }
    return (
        <View style={{ width, height: 32, justifyContent: 'center' }}>
            <Svg width={width} height={32}>
                {items.map((it, i) => (
                    <G key={i}>
                        <Line x1={it.x} y1={0} x2={it.x} y2={8} stroke={isDark ? "#475569" : "#CBD5E1"} strokeWidth={1.5} />
                        <SvgText x={it.x} y={24} fontSize="10" fill={isDark ? "#94A3B8" : "#64748B"} textAnchor={i === 0 ? "start" : i === ticks - 1 ? "end" : "middle"} fontWeight="800">
                            {it.time}
                        </SvgText>
                    </G>
                ))}
            </Svg>
        </View>
    );
}

/* ================= LANE COMPONENT ================= */

interface LaneProps {
    playerId: string;
    exList: any[];
    isPreview?: boolean;
    effectiveStart: number;
    trimDuration: number;
    mStartMs?: number;
    mEndMs?: number;
    exerciseType?: string;
    availableTypes: string[];
    pStartMs?: number; // Player's specific trim start
    pEndMs?: number;   // Player's specific trim end
}

function LaneView({ playerId, exList, isPreview, effectiveStart, trimDuration, mStartMs, mEndMs, exerciseType, availableTypes, pStartMs, pEndMs }: LaneProps) {
    const [w, setW] = useState(0);
    const { theme } = useTheme();
    const isDark = theme === "dark";

    const currentPreview = isPreview && mStartMs && mEndMs && exerciseType && exerciseType !== "Select Exercise" ? {
        start: mStartMs,
        end: mEndMs,
        color: getColorForExercise(exerciseType, availableTypes)
    } : null;

    return (
        <View
            style={{ flex: 1, height: LANE_INNER_H, overflow: 'hidden', backgroundColor: 'transparent' }}
            onLayout={(e) => {
                const lWidth = e.nativeEvent.layout.width;
                if (lWidth > 0 && lWidth !== w) setW(lWidth);
            }}
        >
            {w > 0 && (
                <>
                    {/* DEFAULT TRACK BACKGROUND */}
                    <View style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: 14,
                        bottom: 14,
                        backgroundColor: isDark ? "#131c2dff" : "#F1F5F9",
                        borderRadius: 8,
                        zIndex: 0
                    }} />

                    {/* PLAYER TRIM HIGHLIGHT (OVER BACKGROUND, UNDER EXERCISES) */}
                    {pStartMs && pEndMs && (
                        <View
                            style={{
                                position: 'absolute',
                                left: ((pStartMs - effectiveStart) / trimDuration) * w,
                                width: ((pEndMs - pStartMs) / trimDuration) * w,
                                top: 14,
                                bottom: 14,
                                backgroundColor: isDark ? "rgba(220, 38, 38, 0.15)" : "rgba(220, 38, 38, 0.08)",
                                borderLeftWidth: 2,
                                borderRightWidth: 2,
                                borderColor: PRIMARY_RED,
                                opacity: 1,
                                zIndex: 1
                            }}
                        />
                    )}

                    {/* RULER BACKGROUND */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: '100%', position: 'absolute', top: 0, left: 0, right: 0, paddingBottom: 16 }}>
                        {Array.from({ length: 21 }).map((_, i) => (
                            <View
                                key={i}
                                style={{
                                    width: 1.5,
                                    borderRadius: 1,
                                    height: i % 5 === 0 ? 12 : 6,
                                    backgroundColor: isDark ? "#767d87ff" : "#797f86ff",
                                    opacity: 0.6
                                }}
                            />
                        ))}
                    </View>

                    {/* EXERCISE BLOCKS */}
                    <View style={StyleSheet.absoluteFill}>
                        {[...exList, ...(currentPreview ? [currentPreview] : [])].map((ex, i) => {
                            const l = ((ex.start - effectiveStart) / trimDuration) * w;
                            const widthPx = ((ex.end - ex.start) / trimDuration) * w;
                            if (l >= w || l + widthPx <= 0 || ex.color === "transparent" || !ex.color) return null;
                            return (
                                <View
                                    key={i}
                                    style={{
                                        position: 'absolute',
                                        left: Math.max(0, l),
                                        width: Math.min(w - l, widthPx),
                                        top: 14,
                                        bottom: 14,
                                        backgroundColor: hexToRgba(ex.color, 0.25),
                                        borderWidth: 2,
                                        borderColor: ex.color,
                                        borderRadius: 8,
                                        zIndex: 1
                                    }}
                                />
                            );
                        })}
                    </View>
                </>
            )}
        </View>
    );
}

/* ================= MAIN SCREEN ================= */

export default function AddExerciseScreen(props: any) {
    const { sessionId, trimStartTs, trimEndTs, goBack, goNext, navigation } = props;
    const { theme } = useTheme();
    const { showAlert } = useAlert();
    const { showSnackbar } = useSnackbar();
    const isDark = theme === "dark";
    const [mainMeasuredWidth, setMainMeasuredWidth] = useState(0);
    const [modalMeasuredWidth, setModalMeasuredWidth] = useState(0);

    const [players, setPlayers] = useState<any[]>([]);
    const [recentExercises, setRecentExercises] = useState<any[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [modalSearch, setModalSearch] = useState("");
    const [modalSelected, setModalSelected] = useState<string[]>([]);
    const [showExerciseList, setShowExerciseList] = useState(false);
    const [listingSearch, setListingSearch] = useState("");
    const [dbTrim, setDbTrim] = useState<{ start: number, end: number } | null>(null);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    /* ===== KEYBOARD VISIBILITY ===== */
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);

    useEffect(() => {
        const showSubscription = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
        const hideSubscription = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    // Player-wise Trim State
    const [trimModalVisible, setTrimModalVisible] = useState(false);
    const [selectedPlayerToTrim, setSelectedPlayerToTrim] = useState<any>(null);
    const [pStartRatio, setPStartRatio] = useState(0);
    const [pEndRatio, setPEndRatio] = useState(1);
    const [pStartInput, setPStartInput] = useState("");
    const [pEndInput, setPEndInput] = useState("");

    const pWidthRef = useRef(0);
    const pStartRef = useRef(0);
    const pEndRef = useRef(1);
    const pStartRatioRef = useRef(0);
    const pEndRatioRef = useRef(1);

    useEffect(() => { pStartRatioRef.current = pStartRatio; }, [pStartRatio]);
    useEffect(() => { pEndRatioRef.current = pEndRatio; }, [pEndRatio]);

    // Dynamic Exercise Types
    const [availableTypes, setAvailableTypes] = useState<string[]>(["Select Exercise"]);
    const [exerciseType, setExerciseType] = useState("Select Exercise");
    const FALLBACK_EXERCISE_TYPES = ["Warm Up", "Drill", "Small Sided Game", "Match Play"];

    // Fetch Exercise Types
    useEffect(() => {
        const fetchTypes = async () => {
            try {
                // Get session event type to filter exercises
                const sessRes: any = await db.execute('SELECT event_type FROM sessions WHERE session_id = ?', [sessionId]);
                const sType = sessRes?.rows?._array?.[0]?.event_type || 'training'; // default to training if unknown

                const res: any = await db.execute('SELECT name FROM exercise_types WHERE event_type = ? ORDER BY name', [sType]);
                const rows = res?.rows?._array || [];
                const names = rows.map((r: any) => r.name);

                // Construct list: "Select Exercise" + fetched names
                const final = names.length
                    ? ["Select Exercise", ...names]
                    : ["Select Exercise", ...FALLBACK_EXERCISE_TYPES];
                setAvailableTypes(final);
                setExerciseType(final[0]);
            } catch (e) {
                console.warn("Failed to load exercises", e);
            }
        }
        fetchTypes();
    }, [sessionId]);


    useEffect(() => {
        async function fetchSession() {
            try {
                const res: any = await db.execute(`SELECT trim_start_ts, trim_end_ts FROM sessions WHERE session_id = ?`, [sessionId]);
                const rows = res?.rows?._array || res || [];
                if (rows?.[0]?.trim_start_ts) {
                    const s = Number(rows[0].trim_start_ts);
                    const e = Number(rows[0].trim_end_ts);
                    console.log(`[AddExercise] Loaded trim points from SQLite:`);
                    console.log(`[AddExercise] Start: ${formatTimeMs(s)} (${s})`);
                    console.log(`[AddExercise] End: ${formatTimeMs(e)} (${e})`);
                    setDbTrim({ start: s, end: e });
                } else {
                    console.log(`[AddExercise] No trim points found in SQLite for ${sessionId}, using passed params.`);
                }
            } catch (e) { }
            const list = getAssignedPlayersForSession(sessionId).filter(p => p.assigned);
            setPlayers(list);
            loadExercises();
        }
        fetchSession();
    }, [sessionId]);

    const onRefresh = async () => {
        try {
            setRefreshing(true);
            try {
                const res: any = await db.execute(`SELECT trim_start_ts, trim_end_ts FROM sessions WHERE session_id = ?`, [sessionId]);
                const rows = res?.rows?._array || res || [];
                if (rows?.[0]?.trim_start_ts) {
                    setDbTrim({ start: Number(rows[0].trim_start_ts), end: Number(rows[0].trim_end_ts) });
                }
            } catch (e) { }
            const list = getAssignedPlayersForSession(sessionId).filter(p => p.assigned);
            setPlayers(list);
            await loadExercises();
        } finally {
            setRefreshing(false);
        }
    };

    async function loadExercises() {
        try {
            const res: any = await db.execute(`SELECT exercise_id AS id, type, start_ts AS start, end_ts AS end, color FROM exercises WHERE session_id = ? ORDER BY start_ts ASC`, [sessionId]);
            const rows = res?.rows?._array || res || [];
            const out = [];
            for (const ex of rows) {
                const epsRes: any = await db.execute(`SELECT player_id FROM exercise_players WHERE exercise_id = ?`, [ex.id]);
                const eps = epsRes?.rows?._array || epsRes || [];
                out.push({ ...ex, players: eps.map((r: any) => r.player_id) });
            }
            setRecentExercises(out);
        } catch (e) { }
    }

    const effectiveStart = dbTrim ? dbTrim.start : (Number(trimStartTs) || Date.now());
    const effectiveEnd = dbTrim ? dbTrim.end : (Number(trimEndTs) || (effectiveStart + 3600000));
    const trimDuration = Math.max(1, effectiveEnd - effectiveStart);

    const [mStartRatio, setMStartRatio] = useState(0);
    const [mEndRatio, setMEndRatio] = useState(1);
    const mStartRef = useRef(0);
    const mEndRef = useRef(1);
    const mWidthRef = useRef(0);
    const mEndRatioRef = useRef(1);
    const mStartRatioRef = useRef(0);

    useEffect(() => { mWidthRef.current = modalMeasuredWidth; }, [modalMeasuredWidth]);
    useEffect(() => { mEndRatioRef.current = mEndRatio; }, [mEndRatio]);
    useEffect(() => { mStartRatioRef.current = mStartRatio; }, [mStartRatio]);
    const [mManualStart, setMManualStart] = useState("");
    const [mManualEnd, setMManualEnd] = useState("");

    const mStartMs = Math.round(effectiveStart + trimDuration * mStartRatio);
    const mEndMs = Math.round(effectiveStart + trimDuration * mEndRatio);

    useEffect(() => {
        setMManualStart(formatTimeMs(mStartMs));
        setMManualEnd(formatTimeMs(mEndMs));
    }, [mStartMs, mEndMs]);



    const startResponder = useRef(PanResponder.create({
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => { mStartRef.current = mStartRatioRef.current; },
        onPanResponderMove: (_, g) => {
            if (mWidthRef.current <= 0) return;
            const next = Math.max(0, Math.min(mStartRef.current + g.dx / mWidthRef.current, mEndRatioRef.current - HANDLE_GAP));
            setMStartRatio(next);
        },
        onPanResponderRelease: () => { mStartRef.current = mStartRatioRef.current; }
    })).current;

    const endResponder = useRef(PanResponder.create({
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => { mEndRef.current = mEndRatioRef.current; },
        onPanResponderMove: (_, g) => {
            if (mWidthRef.current <= 0) return;
            const next = Math.min(1, Math.max(mEndRef.current + g.dx / mWidthRef.current, mStartRatioRef.current + HANDLE_GAP));
            setMEndRatio(next);
        },
        onPanResponderRelease: () => { mEndRef.current = mEndRatioRef.current; }
    })).current;

    /* ================= PLAYER TRIM RESPONDERS ================= */

    const pStartResponder = useRef(PanResponder.create({
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => { pStartRef.current = pStartRatioRef.current; },
        onPanResponderMove: (_, g) => {
            if (pWidthRef.current <= 0) return;
            const next = Math.max(0, Math.min(pStartRef.current + g.dx / pWidthRef.current, pEndRatioRef.current - HANDLE_GAP));
            setPStartRatio(next);
        },
        onPanResponderRelease: () => { pStartRef.current = pStartRatioRef.current; }
    })).current;

    const pEndResponder = useRef(PanResponder.create({
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => { pEndRef.current = pEndRatioRef.current; },
        onPanResponderMove: (_, g) => {
            if (pWidthRef.current <= 0) return;
            const next = Math.min(1, Math.max(pEndRef.current + g.dx / pWidthRef.current, pStartRatioRef.current + HANDLE_GAP));
            setPEndRatio(next);
        },
        onPanResponderRelease: () => { pEndRef.current = pEndRatioRef.current; }
    })).current;

    useEffect(() => {
        const s = Math.round(effectiveStart + trimDuration * pStartRatio);
        const e = Math.round(effectiveStart + trimDuration * pEndRatio);
        setPStartInput(formatTimeMs(s));
        setPEndInput(formatTimeMs(e));
    }, [pStartRatio, pEndRatio, effectiveStart, trimDuration]);


    const modalPlayersFiltered = useMemo(() => players.filter(p => p.player_name.toLowerCase().includes(modalSearch.toLowerCase())), [players, modalSearch]);
    const listingFiltered = useMemo(() => players.filter(p => p.player_name.toLowerCase().includes(listingSearch.toLowerCase())), [players, listingSearch]);


    const addExercise = async () => {
        if (!modalSelected.length) {
            showAlert({
                title: "No players",
                message: "Select players first.",
                type: 'warning',
            });
            return;
        }

        // 1. Validation: Check if exercise time is within each player's trim range
        for (const pid of modalSelected) {
            const p = players.find(x => x.player_id === pid);
            if (!p) continue;

            const pTrimStart = Number(p.trim_start_ts) || effectiveStart;
            const pTrimEnd = Number(p.trim_end_ts) || effectiveEnd;

            if (mStartMs < pTrimStart || mEndMs > pTrimEnd) {
                showSnackbar({
                    message: `${p.player_name}'s exercise range is invalid. Range: ${formatTimeMs(pTrimStart)} - ${formatTimeMs(pTrimEnd)}`,
                    type: 'error',
                });
                return;
            }
        }

        try {
            const id = `ex_${Date.now()}`;
            if (exerciseType === "Select Exercise") {
                showAlert({
                    title: "Required",
                    message: "Please select an exercise type.",
                    type: 'warning',
                });
                return;
            }
            const color = getColorForExercise(exerciseType, availableTypes);
            await db.execute(`INSERT INTO exercises (exercise_id, session_id, type, start_ts, end_ts, color) VALUES (?,?,?,?,?,?)`, [id, sessionId, exerciseType, mStartMs, mEndMs, color]);
            for (const pid of modalSelected) {
                await db.execute(`INSERT INTO exercise_players (exercise_id, player_id) VALUES (?,?)`, [id, pid]);
            }
            console.log(`✅ Exercise ${id} saved with ${modalSelected.length} players`);
            loadExercises();
            setModalVisible(false);
            setModalSelected([]);
        } catch (e: any) {
            console.error("❌ Add Exercise Failed:", e);
            showAlert({
                title: "Error",
                message: "Could not save exercise: " + (e.message || "Unknown error"),
                type: 'error',
            });
        }
    };

    const applyManual = () => {
        const s = parseTimeFlexible(mManualStart, effectiveStart);
        const e = parseTimeFlexible(mManualEnd, effectiveStart);
        if (!s.ok || !e.ok) {
            showSnackbar({ message: "Invalid time format. Please use HH:MM:SS", type: 'error' });
            return;
        }
        const sMs = s.type === "absolute" ? s.ms! : effectiveStart + (s.seconds || 0) * 1000;
        const eMs = e.type === "absolute" ? (e.ms! > sMs ? e.ms! : sMs + 1000) : (sMs + (e.seconds || 0) * 1000);

        if (sMs < effectiveStart || sMs > effectiveEnd || eMs < effectiveStart || eMs > effectiveEnd) {
            showSnackbar({
                message: `Time entered is outside range (${formatTimeMs(effectiveStart)} - ${formatTimeMs(effectiveEnd)})`,
                type: 'error'
            });
            return;
        }

        const ns = (Math.max(effectiveStart, Math.min(effectiveEnd, sMs)) - effectiveStart) / trimDuration;
        const ne = (Math.max(effectiveStart, Math.min(effectiveEnd, eMs)) - effectiveStart) / trimDuration;
        setMStartRatio(ns); setMEndRatio(ne); mStartRef.current = ns; mEndRef.current = ne;
    };

    const openTrimPlayer = (player: any) => {
        setSelectedPlayerToTrim(player);
        const s = player.trim_start_ts || effectiveStart;
        const e = player.trim_end_ts || effectiveEnd;
        const sRatio = (s - effectiveStart) / trimDuration;
        const eRatio = (e - effectiveStart) / trimDuration;
        setPStartRatio(Math.max(0, Math.min(1, sRatio)));
        setPEndRatio(Math.max(0, Math.min(1, eRatio)));
        pStartRef.current = Math.max(0, Math.min(1, sRatio));
        pEndRef.current = Math.max(0, Math.min(1, eRatio));
        setTrimModalVisible(true);
    };

    const applyPlayerManual = () => {
        const s = parseTimeFlexible(pStartInput, effectiveStart);
        const e = parseTimeFlexible(pEndInput, effectiveStart);
        if (!s.ok || !e.ok) {
            showSnackbar({ message: "Invalid time format. Please use HH:MM:SS", type: 'error' });
            return;
        }
        const sMs = s.type === "absolute" ? s.ms! : effectiveStart + (s.seconds || 0) * 1000;
        const eMs = e.type === "absolute" ? (e.ms! > sMs ? e.ms! : sMs + 1000) : (effectiveStart + (e.seconds || 0) * 1000);

        if (sMs < effectiveStart || sMs > effectiveEnd || eMs < effectiveStart || eMs > effectiveEnd) {
            showSnackbar({
                message: `Time entered is outside range (${formatTimeMs(effectiveStart)} - ${formatTimeMs(effectiveEnd)})`,
                type: 'error'
            });
            return;
        }

        const ns = Math.max(0, Math.min(1, (sMs - effectiveStart) / trimDuration));
        const ne = Math.max(ns + HANDLE_GAP, Math.min(1, (eMs - effectiveStart) / trimDuration));
        setPStartRatio(ns); setPEndRatio(ne); pStartRef.current = ns; pEndRef.current = ne;
    };

    const savePlayerTrim = async () => {
        if (!selectedPlayerToTrim) return;
        const s = Math.round(effectiveStart + trimDuration * pStartRatio);
        const e = Math.round(effectiveStart + trimDuration * pEndRatio);

        // 1. Validation: Check if new trim excludes any existing exercises for this player
        const playerExercises = recentExercises.filter(ex => ex.players.includes(selectedPlayerToTrim.player_id));
        const outOfBounds = playerExercises.some(ex => ex.start < s || ex.end > e);

        if (outOfBounds) {
            showSnackbar({
                message: `${selectedPlayerToTrim.player_name} has exercises outside this range. Adjust exercises first.`,
                type: 'error',
            });
            return;
        }

        try {
            console.log(`[AddExercise] Saving player trim: ${s} - ${e} for ${selectedPlayerToTrim.player_name}`);
            await db.execute(
                `UPDATE session_players SET trim_start_ts = ?, trim_end_ts = ? WHERE session_id = ? AND player_id = ?`,
                [s, e, sessionId, selectedPlayerToTrim.player_id]
            );
            showSnackbar({ message: `Trim saved for ${selectedPlayerToTrim.player_name}`, type: 'success' });
            setTrimModalVisible(false);
            await onRefresh();
        } catch (err) {
            console.error("❌ Save Player Trim Failed:", err);
            showAlert({ title: "Error", message: "Failed to save player trim", type: 'error' });
        }
    };

    const handleFinish = async () => {
        try {
            setLoading(true);

            // Check internet connectivity
            const netState = await NetInfo.fetch();
            if (!netState.isConnected) {
                showSnackbar({
                    message: "Please connect to the internet to upload data.",
                    type: 'warning',
                });
                setLoading(false);
                return;
            }

            // Show processing message
            showSnackbar({
                message: "Processing...",
                type: 'info',
            });

            const result = await syncSessionToPodholder(sessionId);
            console.log("[AddExercise] Sync Result:", result);

            // Show success message
            showSnackbar({
                message: "Data received from Podholder. Event successfully created!",
                type: 'success',
            });

            // Navigate back to ManageEventsScreen
            if (goNext) goNext(); else navigation?.goBack();
        } catch (e) {
            showSnackbar({
                message: "Could not send data back to Podholder. Please check connection.",
                type: 'error',
            });
            // Navigate back anyway
            if (goNext) goNext(); else navigation?.goBack();
        } finally {
            setLoading(false);
        }
    };



    return (
        <View style={[styles.container, { backgroundColor: isDark ? "#020617" : "#F8FAFC" }]}>
            {/* 🟢 HEADER WITH STEPPER - Hide only when keyboard is hidden */}
            {!isKeyboardVisible && (
                <View style={styles.headerStepper}>
                    <TouchableOpacity onPress={goBack} style={styles.backBtnStepper}>
                        <Ionicons name="chevron-back" size={24} color={isDark ? "#94A3B8" : "#475569"} />
                        <Text style={[styles.backTextStepper, { color: isDark ? "#94A3B8" : "#475569" }]}>Back to players</Text>
                    </TouchableOpacity>

                    <View style={styles.stepperContainer}>
                        <Step icon="calendar-outline" label="Event Details" active completed />
                        <StepLine active />
                        <Step icon="people" label="Add Players" active completed />
                        <StepLine active />
                        <Step icon="cut-outline" label="Trim" active completed />
                        <StepLine active />
                        <Step icon="walk-outline" label="Add Exercise" active />
                    </View>
                </View>
            )}

            {/* TOP BAR REPLACEMENT FOR WHEN KEYBOARD IS OPEN */}
            {isKeyboardVisible && (
                <View style={[styles.kTopBar, { backgroundColor: isDark ? '#020617' : '#FFFFFF', borderBottomWidth: 1, borderColor: isDark ? '#1E293B' : '#E2E8F0' }]}>
                    <TouchableOpacity onPress={goBack} style={styles.kBackBtn}>
                        <Ionicons name="chevron-back" size={18} color={isDark ? "#94A3B8" : "#64748B"} />
                        <Text style={[styles.kBackText, { color: isDark ? "#94A3B8" : "#64748B" }]}>Back</Text>
                    </TouchableOpacity>
                    <Text style={{ fontWeight: '700', color: isDark ? '#fff' : '#000' }}>Add Exercise</Text>
                    <View style={{ width: 40 }} />
                </View>
            )}

            <View style={styles.titleSection}>
                <View style={styles.headerLeft}>
                    <View style={[styles.iconBox, { backgroundColor: isDark ? "#1E293B" : "#FEE2E2" }]}>
                        <Ionicons name="walk-outline" size={24} color={PRIMARY_RED} />
                    </View>
                    <View style={{ marginLeft: 16 }}>
                        <Text style={[styles.title, { color: isDark ? "#fff" : "#0F172A" }]}>Add Exercise</Text>
                        <Text style={[styles.subtitle, { color: isDark ? "#94A3B8" : "#64748B" }]}>Assign exercises to players</Text>
                    </View>
                </View>
            </View>

            <View style={styles.body}>
                <View style={[styles.searchContainer, { backgroundColor: isDark ? "#1E293B" : "#fff", borderColor: isDark ? "#334155" : "#E2E8F0" }]}>
                    <Ionicons name="search" size={18} color="#94A3B8" />
                    <TextInput
                        value={listingSearch}
                        onChangeText={setListingSearch}
                        placeholder="Search Players..."
                        placeholderTextColor="#94A3B8"
                        style={[styles.searchInput, { color: isDark ? "#fff" : "#000" }]}
                    />
                </View>

                <View style={[styles.mainBox, { backgroundColor: isDark ? "#0F172A" : "#fff", borderColor: isDark ? "#1E293B" : "#E2E8F0" }]}>
                    <View style={[styles.mainBoxLabelHeader, { backgroundColor: isDark ? "#1E293B" : "#F8FAFC", borderColor: isDark ? "#334155" : "#F1F5F9" }]}>
                        <View style={styles.mainBoxHeaderNamePart}>
                            <Text style={[styles.sessionRangeLabel, { color: isDark ? "#94A3B8" : "#000" }]}>SESSION RANGE</Text>
                            <Text style={[styles.sessionRangeVal, { color: isDark ? "#94A3B8" : "#64748B" }]}>{formatTimeMs(effectiveStart)} - {formatTimeMs(effectiveEnd)}</Text>
                        </View>
                        <View style={styles.mainBoxHeaderGraphPart} onLayout={(e) => setMainMeasuredWidth(e.nativeEvent.layout.width)}>
                            <GraphXAxis width={mainMeasuredWidth} startMs={effectiveStart} endMs={effectiveEnd} isDark={isDark} />
                        </View>
                    </View>
                    <FlatList
                        data={listingFiltered}
                        keyExtractor={p => "mainRow-" + p.player_id}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => (
                            <View style={[styles.mainRow, { borderColor: isDark ? "#1E293B" : "#F1F5F9" }]}>
                                <View style={styles.mainNameCol}>
                                    <View style={styles.nameActionRow}>
                                        <Text style={[styles.playerNameText, { color: isDark ? "#E2E8F0" : "#334155" }]} numberOfLines={1}>{item.player_name}</Text>
                                        <TouchableOpacity onPress={() => openTrimPlayer(item)} style={styles.trimMiniBtn}>
                                            <Ionicons name="cut-outline" size={14} color={PRIMARY_RED} />
                                            <Text style={styles.trimMiniText}>Trim</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                                <View style={styles.mainGraphCol}>
                                    <LaneView
                                        playerId={item.player_id}
                                        exList={recentExercises.filter(ex => ex.players.includes(item.player_id))}
                                        effectiveStart={effectiveStart}
                                        trimDuration={trimDuration}
                                        availableTypes={availableTypes}
                                        pStartMs={item.trim_start_ts ? Number(item.trim_start_ts) : undefined}
                                        pEndMs={item.trim_end_ts ? Number(item.trim_end_ts) : undefined}
                                    />
                                </View>
                            </View>
                        )}
                    />
                </View>
            </View>

            {/* 🟢 PLAYER TRIM MODAL */}
            {trimModalVisible && selectedPlayerToTrim && (() => {
                const pStart = Math.round(effectiveStart + trimDuration * pStartRatio);
                const pEnd = Math.round(effectiveStart + trimDuration * pEndRatio);
                const pDur = pEnd - pStart;
                const pOrig = trimDuration;
                const pRem = pOrig - pDur;

                return (
                    <View style={styles.fullOverlay} pointerEvents="box-none">
                        <KeyboardAvoidingView
                            behavior="padding"
                            style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}
                            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 60}
                        >
                            <View style={[styles.modalCard, { height: 'auto', maxHeight: '90%', width: '92%', backgroundColor: isDark ? "#1E293B" : "#fff", padding: 0 }]}>
                                <ScrollView
                                    contentContainerStyle={{ flexGrow: 1, padding: 16 }}
                                    keyboardShouldPersistTaps="handled"
                                    showsVerticalScrollIndicator={false}
                                >
                                    <View style={styles.modalHeaderRow}>
                                        <View>
                                            <Text style={[styles.modalTitle, { fontSize: 24, color: isDark ? "#fff" : "#0F172A" }]}>Trim {selectedPlayerToTrim.player_name}</Text>
                                            <Text style={[styles.modalSubtitle, { color: isDark ? "#94A3B8" : "#64748B" }]}>Adjust session timeframe for this player</Text>
                                        </View>
                                        <TouchableOpacity onPress={() => setTrimModalVisible(false)}>
                                            <Ionicons name="close" size={24} color={isDark ? "#fff" : "#000"} />
                                        </TouchableOpacity>
                                    </View>

                                    {/* 🟠 PLAYER STATS ROW */}
                                    <View style={[styles.statsRow, { marginBottom: 12, paddingHorizontal: 0 }]}>
                                        <StatBox label="Original Duration" value={formatDuration(pOrig)} color={isDark ? "#1E1B4B" : "#EEF2FF"} textColor={isDark ? "#A5B4FC" : "#4F46E5"} />
                                        <StatBox label="Trimmed Duration" value={formatDuration(pDur)} color={isDark ? "#064E3B" : "#F0FDF4"} textColor={isDark ? "#6EE7B7" : "#16A34A"} />
                                        <StatBox label="Data Removed" value={formatDuration(pRem)} color={isDark ? "#450A0A" : "#FEF2F2"} textColor={isDark ? "#F87171" : PRIMARY_RED} />
                                    </View>

                                    {/* 🟢 TITLE SECTION */}
                                    <View style={[styles.titleSection, { paddingHorizontal: 0, marginVertical: 12 }]}>
                                        <View style={[styles.iconBox, { backgroundColor: isDark ? "#1E293B" : "#FEE2E2", width: 42, height: 42, borderRadius: 10 }]}>
                                            <Ionicons name="cut-outline" size={20} color={PRIMARY_RED} />
                                        </View>
                                        <View style={{ marginLeft: 12 }}>
                                            <Text style={[styles.title, { color: isDark ? "#fff" : "#0F172A", fontSize: 18 }]}>Data Trimming</Text>
                                            <Text style={[styles.subtitle, { color: isDark ? "#94A3B8" : "#64748B", fontSize: 12 }]}>Fine-tune the session timeframe</Text>
                                        </View>
                                    </View>

                                    <View style={[styles.modalListBox, { height: 160, marginBottom: 20, backgroundColor: isDark ? "#1E293B" : "#fff", borderColor: isDark ? "#334155" : "#E2E8F0", padding: 16 }]}>
                                        <View style={{ flex: 1 }}>
                                            <View style={[styles.waveformContainer, { height: 80, backgroundColor: isDark ? "#020617" : "#F8FAFC", borderRadius: 12, overflow: 'visible' }]} onLayout={(e) => pWidthRef.current = e.nativeEvent.layout.width}>
                                                {/* RULER BACKGROUND */}
                                                <View style={[styles.rulerContainer, { height: 40, top: 20 }]}>
                                                    {Array.from({ length: 41 }).map((_, i) => (
                                                        <View key={i} style={[styles.rulerTick, { height: i % 5 === 0 ? 12 : 6, backgroundColor: isDark ? "#334155" : "#CBD5E1", opacity: 0.8 }]} />
                                                    ))}
                                                </View>

                                                <View style={styles.sliderOverlay}>
                                                    <View style={[styles.unselectedArea, { left: 0, width: (pStartRatio * 100) + ("%" as any), top: 15, bottom: 15, backgroundColor: isDark ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.1)" }]} />
                                                    <View style={[styles.unselectedArea, { left: (pEndRatio * 100) + ("%" as any), right: 0, top: 15, bottom: 15, backgroundColor: isDark ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.1)" }]} />

                                                    <View
                                                        style={[
                                                            styles.activeRangeHighlight,
                                                            {
                                                                left: (pStartRatio * 100) + ("%" as any),
                                                                width: ((pEndRatio - pStartRatio) * 100) + ("%" as any),
                                                                borderColor: PRIMARY_RED,
                                                                backgroundColor: isDark ? "rgba(220, 38, 38, 0.08)" : "rgba(220, 38, 38, 0.05)",
                                                                top: 15,
                                                                bottom: 15,
                                                                borderTopWidth: 1,
                                                                borderBottomWidth: 1
                                                            }
                                                        ]}
                                                    />

                                                    {/* Handlers */}
                                                    <View {...pStartResponder.panHandlers} style={[styles.handleContainer, { left: (pStartRatio * 100) + ("%" as any), marginLeft: -15, height: 80, zIndex: 999 }]}>
                                                        <View style={[styles.premiumHandle, { height: 44, width: 14, borderColor: PRIMARY_RED, backgroundColor: '#fff', borderRadius: 4, gap: 3 }]}>
                                                            <View style={[styles.gripperLine, { width: 6, height: 1.5, backgroundColor: PRIMARY_RED }]} />
                                                            <View style={[styles.gripperLine, { width: 6, height: 1.5, backgroundColor: PRIMARY_RED }]} />
                                                        </View>
                                                    </View>
                                                    <View {...pEndResponder.panHandlers} style={[styles.handleContainer, { left: (pEndRatio * 100) + ("%" as any), marginLeft: -15, height: 80, zIndex: 999 }]}>
                                                        <View style={[styles.premiumHandle, { height: 44, width: 14, borderColor: PRIMARY_RED, backgroundColor: '#fff', borderRadius: 4, gap: 3 }]}>
                                                            <View style={[styles.gripperLine, { width: 6, height: 1.5, backgroundColor: PRIMARY_RED }]} />
                                                            <View style={[styles.gripperLine, { width: 6, height: 1.5, backgroundColor: PRIMARY_RED }]} />
                                                        </View>
                                                    </View>
                                                </View>
                                            </View>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                                                {[0, 0.5, 1].map((p, i) => (
                                                    <Text key={i} style={[styles.axisTick, { color: isDark ? "#475569" : "#94A3B8" }]}>
                                                        {formatTimeMs(effectiveStart + trimDuration * p)}
                                                    </Text>
                                                ))}
                                            </View>
                                        </View>
                                    </View>


                                </ScrollView>

                                <View style={[styles.footerInputsRow, { borderTopWidth: 1, borderTopColor: isDark ? "#1E293B" : "#E2E8F0", padding: 16, paddingTop: 16, marginTop: 0, gap: 12 }]}>
                                    <View style={[styles.inputCard, { flex: 1, borderRadius: 16, padding: 12, borderWidth: 1, backgroundColor: isDark ? "#1E293B" : "#fff", borderColor: isDark ? "#334155" : "#E2E8F0" }]}>
                                        <Text style={[styles.inputLabel, { fontSize: 12, fontWeight: "700", marginBottom: 8, color: isDark ? "#94A3B8" : "#64748B" }]}>Start Time</Text>
                                        <View style={{ flexDirection: "row", alignItems: "center", borderRadius: 10, paddingHorizontal: 10, minHeight: 40, backgroundColor: isDark ? "#020617" : "#F8FAFC" }}>
                                            <TextInput value={pStartInput} onChangeText={setPStartInput} style={{ flex: 1, fontSize: 14, fontWeight: "700", color: isDark ? "#fff" : "#0F172A" }} />
                                            <Ionicons name="time-outline" size={18} color={PRIMARY_RED} />
                                        </View>
                                    </View>

                                    <View style={[styles.inputCard, { flex: 1, borderRadius: 16, padding: 12, borderWidth: 1, backgroundColor: isDark ? "#1E293B" : "#fff", borderColor: isDark ? "#334155" : "#E2E8F0" }]}>
                                        <Text style={[styles.inputLabel, { fontSize: 12, fontWeight: "700", marginBottom: 8, color: isDark ? "#94A3B8" : "#64748B" }]}>End Time</Text>
                                        <View style={{ flexDirection: "row", alignItems: "center", borderRadius: 10, paddingHorizontal: 10, minHeight: 40, backgroundColor: isDark ? "#020617" : "#F8FAFC" }}>
                                            <TextInput value={pEndInput} onChangeText={setPEndInput} style={{ flex: 1, fontSize: 14, fontWeight: "700", color: isDark ? "#fff" : "#0F172A" }} />
                                            <Ionicons name="time-outline" size={18} color={PRIMARY_RED} />
                                        </View>
                                    </View>

                                    <View style={{ gap: 8 }}>
                                        <TouchableOpacity onPress={applyPlayerManual} style={[styles.applyBtn, { backgroundColor: isDark ? "#3B82F6" : "#0F172A", height: 40, paddingVertical: 0, justifyContent: 'center' }]}>
                                            <Text style={styles.applyBtnText}>APPLY</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={savePlayerTrim} style={[styles.btnPrim, { flex: 0, width: 120, backgroundColor: PRIMARY_RED, height: 48, borderRadius: 12 }]}>
                                            <Text style={styles.btnPrimTxt}>SAVE TRIM</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        </KeyboardAvoidingView>
                    </View >
                );
            })()}
            <View style={[styles.footer, { backgroundColor: isDark ? "#020617" : "#FFFFFF", borderTopColor: isDark ? "#1E293B" : "#E2E8F0" }]}>
                <View style={styles.footerBtns}>
                    <TouchableOpacity
                        onPress={() => { setModalSelected(players.map(p => p.player_id)); setModalVisible(true); }}
                        style={[styles.btnSec, { backgroundColor: isDark ? "#1E293B" : "#F1F5F9" }]}
                    >
                        <Text style={[styles.btnSecTxt, { color: isDark ? "#94A3B8" : "#475569" }]}>ADD EXERCISE</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleFinish}
                        style={[styles.btnPrim, { backgroundColor: PRIMARY_RED }]}
                        disabled={loading}
                    >
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimTxt}>FINISH & UPLOAD</Text>}
                    </TouchableOpacity>
                </View>
            </View>

            {
                modalVisible && (
                    <View style={styles.fullOverlay}>
                        <KeyboardAvoidingView style={styles.overlayInner} behavior="padding">
                            <View style={[styles.modalCard, { backgroundColor: isDark ? "#1E293B" : "#fff" }]}>
                                <View style={styles.modalHeaderRow}>
                                    <View>
                                        <Text style={[styles.modalTitle, { fontSize: 24, color: isDark ? "#FFFFFF" : "#0F172A" }]}>Add Exercise</Text>
                                        <Text style={[styles.modalSubtitle, { color: isDark ? "#94A3B8" : "#64748B", marginTop: 1 }]}>Select players and define the time range for this exercise</Text>
                                    </View>

                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? "#1E293B" : "#fff", borderRadius: 10, borderWidth: 1, borderColor: isDark ? "#334155" : "#E2E8F0", paddingHorizontal: 10, height: 38, width: 220 }}>
                                            <Ionicons name="search" size={16} color="#94A3B8" />
                                            <TextInput
                                                value={modalSearch}
                                                onChangeText={setModalSearch}
                                                placeholder="Search Players"
                                                placeholderTextColor="#94A3B8"
                                                style={{ flex: 1, marginLeft: 8, fontSize: 13, color: isDark ? "#fff" : "#000", padding: 0 }}
                                            />
                                        </View>
                                        <TouchableOpacity onPress={() => setModalVisible(false)} style={{ padding: 4, backgroundColor: isDark ? "#334155" : "#F1F5F9", borderRadius: 12 }}>
                                            <Ionicons name="close" size={20} color={isDark ? "#94A3B8" : "#64748B"} />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View style={styles.modalListBox}>
                                    {/* HEADER ROW: SELECT ALL & SEARCH (ALIGNED TO PLAYER COLUMN) */}
                                    {/* COMBINED HEADER ROW: SELECT ALL, SEARCH & X-AXIS */}
                                    <View style={[styles.modalCombinedHeader, { backgroundColor: isDark ? "#0F172A" : "#F8FAFC", borderColor: isDark ? "#1E293B" : "#E2E8F0", height: 64 }]}>
                                        <View style={[styles.modalSubHeaderPlayerPart, { width: 280, paddingLeft: 20 }]}>
                                            <TouchableOpacity
                                                style={[styles.masterCheck, { backgroundColor: isDark ? "#1E293B" : "#fff", borderColor: isDark ? "#334155" : "#E2E8F0", paddingHorizontal: 8, paddingVertical: 6 }]}
                                                onPress={() => setModalSelected(modalSelected.length === players.length ? [] : players.map(p => p.player_id))}
                                            >
                                                <View style={[styles.customCheck, modalSelected.length === players.length && styles.customCheckActive, { borderColor: isDark ? "#475569" : "#CBD5E1", backgroundColor: modalSelected.length === players.length ? "#10B981" : "transparent" }]}>
                                                    {modalSelected.length === players.length && <Ionicons name="checkmark" size={12} color="#fff" />}
                                                </View>
                                            </TouchableOpacity>
                                            <Text style={[styles.masterCheckLabel, { color: isDark ? "#94A3B8" : "#64748B", fontSize: 13, marginLeft: 10 }]}>Select all players</Text>
                                        </View>
                                        <View style={{ flex: 1, justifyContent: 'center' }} onLayout={(e) => setModalMeasuredWidth(e.nativeEvent.layout.width)}>
                                            <GraphXAxis width={modalMeasuredWidth} startMs={effectiveStart} endMs={effectiveEnd} isDark={isDark} />
                                        </View>
                                    </View>
                                    <View style={{ flex: 1, position: 'relative' }}>
                                        <FlatList
                                            data={modalPlayersFiltered}
                                            keyExtractor={p => "modalRow-" + p.player_id}
                                            showsVerticalScrollIndicator={false}
                                            renderItem={({ item }) => (
                                                <View style={[styles.modalRow, { borderColor: isDark ? "#334155" : "#F1F5F9" }]}>
                                                    <TouchableOpacity style={styles.modalNameCol} onPress={() => setModalSelected(prev => prev.includes(item.player_id) ? prev.filter(id => id !== item.player_id) : [...prev, item.player_id])}>
                                                        <View style={[styles.customCheck, modalSelected.includes(item.player_id) && styles.customCheckActive, { borderColor: isDark ? "#64748B" : "#CBD5E1", backgroundColor: modalSelected.includes(item.player_id) ? "#10B981" : (isDark ? "#334155" : "#fff") }]}>
                                                            {modalSelected.includes(item.player_id) && <View style={styles.checkInner} />}
                                                        </View>
                                                        <Text style={[styles.modalPlayerName, { color: isDark ? "#E2E8F0" : "#334155" }]} numberOfLines={1}>{item.player_name}</Text>
                                                    </TouchableOpacity>
                                                    <View style={styles.modalGraphCol}>
                                                        <LaneView
                                                            playerId={item.player_id}
                                                            exList={recentExercises.filter(ex => ex.players.includes(item.player_id))}
                                                            isPreview={modalSelected.length === 0 || modalSelected.includes(item.player_id)}
                                                            effectiveStart={effectiveStart}
                                                            trimDuration={trimDuration}
                                                            mStartMs={mStartMs}
                                                            mEndMs={mEndMs}
                                                            exerciseType={exerciseType}
                                                            availableTypes={availableTypes}
                                                        />
                                                    </View>
                                                </View>
                                            )}
                                        />
                                        {/* Draggable handles and selection overlay */}
                                        {/* Draggable handles and selection overlay */}
                                        {modalMeasuredWidth > 0 && (
                                            <View style={[styles.trimOverlay, { left: 280, width: modalMeasuredWidth }]} pointerEvents="box-none">
                                                {/* SELECTION OVERLAY */}
                                                <View
                                                    style={{
                                                        position: 'absolute',
                                                        top: 0,
                                                        bottom: 0,
                                                        left: mStartRatio * modalMeasuredWidth,
                                                        width: (mEndRatio - mStartRatio) * modalMeasuredWidth,
                                                        backgroundColor: 'rgba(181, 0, 2, 0.05)',
                                                        borderLeftWidth: 1,
                                                        borderRightWidth: 1,
                                                        borderColor: PRIMARY_RED
                                                    }}
                                                    pointerEvents="none"
                                                />

                                                <View {...startResponder.panHandlers} style={[styles.handleContainer, { left: mStartRatio * modalMeasuredWidth, marginLeft: -15 }]}>
                                                    <View style={styles.premiumHandle}>
                                                        <View style={styles.gripperLine} />
                                                        <View style={styles.gripperLine} />
                                                        <View style={styles.gripperLine} />
                                                    </View>
                                                </View>
                                                <View {...endResponder.panHandlers} style={[styles.handleContainer, { left: mEndRatio * modalMeasuredWidth, marginLeft: -15 }]}>
                                                    <View style={styles.premiumHandle}>
                                                        <View style={styles.gripperLine} />
                                                        <View style={styles.gripperLine} />
                                                        <View style={styles.gripperLine} />
                                                    </View>
                                                </View>
                                            </View>
                                        )}
                                    </View>
                                </View>

                                <View style={[styles.modalFooter, { borderTopWidth: 1, borderTopColor: isDark ? "#1E293B" : "#F1F5F9", paddingTop: 12 }]}>
                                    <View style={[styles.footerInputsRow, { marginBottom: 6 }]}>
                                        <View style={styles.timeInputGroup}>
                                            <Text style={[styles.entryLabel, { color: "#94A3B8", fontSize: 11 }]}>START TIME</Text>
                                            <TextInput value={mManualStart} onChangeText={setMManualStart} style={[styles.entryInput, { backgroundColor: isDark ? "#0F172A" : "#F8FAFC", borderColor: isDark ? "#334155" : "#E2E8F0", color: isDark ? "#fff" : "#0F172A", height: 46 }]} />
                                        </View>
                                        <View style={styles.timeInputGroup}>
                                            <Text style={[styles.entryLabel, { color: "#94A3B8", fontSize: 11 }]}>END TIME</Text>
                                            <TextInput value={mManualEnd} onChangeText={setMManualEnd} style={[styles.entryInput, { backgroundColor: isDark ? "#0F172A" : "#F8FAFC", borderColor: isDark ? "#334155" : "#E2E8F0", color: isDark ? "#fff" : "#0F172A", height: 46 }]} />
                                        </View>
                                        <TouchableOpacity onPress={applyManual} style={[styles.applyBtn, { backgroundColor: "#EF4444", height: 46, justifyContent: 'center' }]}>
                                            <Text style={[styles.applyBtnText, { fontSize: 12 }]}>Apply</Text>
                                        </TouchableOpacity>

                                        <View style={[styles.exerciseSelectionCol, { flex: 1 }]}>
                                            <Text style={[styles.entryLabel, { color: "#94A3B8", fontSize: 11 }]}>EXERCISE TYPE</Text>
                                            <TouchableOpacity style={[styles.typeSelectorBtn, { backgroundColor: isDark ? "#0F172A" : "#F8FAFC", borderColor: isDark ? "#334155" : "#E2E8F0", height: 46, width: '100%' }]} onPress={() => setShowExerciseList(!showExerciseList)}>
                                                <View style={[styles.colorIndicator, { backgroundColor: getColorForExercise(exerciseType, availableTypes) }]} />
                                                <Text style={[styles.typeSelectorText, { color: isDark ? "#fff" : "#0F172A", fontSize: 14, flex: 1 }]}>{exerciseType}</Text>
                                                <Ionicons name={showExerciseList ? "chevron-up" : "chevron-down"} size={16} color={isDark ? "#94A3B8" : "#64748B"} />
                                            </TouchableOpacity>

                                            {showExerciseList && (
                                                <View style={[styles.exerciseTypeMenu, { backgroundColor: isDark ? "#1E293B" : "#fff", borderColor: isDark ? "#334155" : "#E2E8F0", bottom: 55, width: '100%' }]}>
                                                    <View style={{ maxHeight: 200 }}>
                                                        <ScrollView nestedScrollEnabled={true} showsVerticalScrollIndicator={false}>
                                                            {availableTypes.map((t) => (
                                                                <TouchableOpacity key={t} onPress={() => { setExerciseType(t); setShowExerciseList(false); }} style={[styles.typeMenuOption, { backgroundColor: hexToRgba(getColorForExercise(t, availableTypes), 0.1), marginBottom: 6 }]}>
                                                                    <View style={[styles.menuColorDot, { backgroundColor: getColorForExercise(t, availableTypes) }]} />
                                                                    <Text style={[styles.typeMenuText, { color: isDark ? "#E2E8F0" : "#334155", fontSize: 12 }]}>{t}</Text>
                                                                </TouchableOpacity>
                                                            ))}
                                                        </ScrollView>
                                                    </View>
                                                </View>
                                            )}
                                        </View>
                                    </View>

                                    <View style={[styles.footerFinalRow, { marginTop: 10 }]}>
                                        <TouchableOpacity onPress={() => setModalVisible(false)} style={[styles.modalCancelBtn, { paddingHorizontal: 20 }]}>
                                            <Text style={[styles.modalCancelBtnText, { color: isDark ? "#94A3B8" : "#64748B" }]}>Cancel</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={addExercise} style={[styles.saveBtn, { backgroundColor: "#EF4444", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 30, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                                            <Text style={[styles.saveBtnText, { fontSize: 16 }]}>Save Exercise</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        </KeyboardAvoidingView>
                    </View>
                )
            }
        </View >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerStepper: { padding: 16, paddingTop: 8 },
    backBtnStepper: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
    backTextStepper: { marginLeft: 4, fontSize: 13, fontWeight: "600" },
    stepperContainer: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
    stepItem: { alignItems: "center", width: 55 },
    stepOuter: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
    stepOuterActive: { backgroundColor: "#EF4444", borderColor: "rgba(239, 68, 68, 0.2)" },
    stepOuterCompleted: { backgroundColor: "#EF4444" },
    stepTxt: { fontSize: 8, color: "#94A3B8", marginTop: 4, textAlign: "center", fontWeight: "600" },
    stepTxtActive: { color: "#EF4444" },
    sLine: { flex: 0.4, height: 2, backgroundColor: "#E5E7EB", marginTop: 15 },
    sLineActive: { backgroundColor: "#EF4444" },

    titleSection: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginVertical: 12 },
    headerLeft: { flexDirection: "row", alignItems: "center" },
    iconBox: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    title: { fontSize: 18, fontWeight: "800" },
    subtitle: { fontSize: 13, marginTop: 2 },

    body: { flex: 1, paddingHorizontal: 16 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 40, borderRadius: 10, borderWidth: 1, marginBottom: 16 },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 14, padding: 0 },

    mainBox: { flex: 1, borderRadius: 20, borderWidth: 1, overflow: "hidden" },
    mainBoxLabelHeader: { height: 52, flexDirection: "row", alignItems: "stretch", borderBottomWidth: 1 },
    mainBoxHeaderNamePart: { width: NAME_COL_WIDTH, paddingLeft: 18, justifyContent: 'center' },
    mainBoxHeaderGraphPart: { flex: 1, justifyContent: 'center' },
    sessionRangeLabel: { fontSize: 10, fontWeight: "800" },
    sessionRangeVal: { fontSize: 10, fontWeight: "700" },
    mainRow: { height: PLAYER_ROW_H, flexDirection: "row", alignItems: "stretch", borderBottomWidth: 1 },
    mainNameCol: { width: NAME_COL_WIDTH, justifyContent: "center", paddingLeft: 20 },
    mainGraphCol: { flex: 1, overflow: "hidden" },
    playerNameText: { fontWeight: "700", fontSize: 15 },
    nameActionRow: { alignItems: 'flex-start', gap: 4 },
    trimMiniBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(220, 38, 38, 0.08)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 },
    trimMiniText: { fontSize: 10, fontWeight: '800', color: "#DC2626" },

    statsRow: { flexDirection: "row", gap: 6, marginVertical: 8 },
    sBox: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", justifyContent: 'center' },
    sVal: { fontSize: 9, fontWeight: "700", textAlign: 'center' },

    footer: { padding: 16, borderTopWidth: 1 },
    footerBtns: { flexDirection: "row", gap: 12 },
    btnSec: { flex: 1, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    btnSecTxt: { fontSize: 15, fontWeight: "700" },
    btnPrim: { flex: 1, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    btnPrimTxt: { color: "#fff", fontSize: 15, fontWeight: "700" },

    fullOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(15,23,42,0.8)", justifyContent: "center", alignItems: "center", zIndex: 1000 },
    overlayInner: { width: "98%", height: "98%", justifyContent: "center", alignItems: "center" },
    modalCard: { width: "95%", height: "94%", borderRadius: 24, padding: 16, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
    modalHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    modalTitle: { fontSize: 24, fontWeight: "800" },
    modalSubtitle: { fontSize: 13, color: "#94A3B8" },
    modalCombinedHeader: { flexDirection: "row", borderBottomWidth: 1, alignItems: 'center' },
    modalSubHeaderPlayerPart: { width: 280, flexDirection: 'row', alignItems: 'center', gap: 12 },
    masterCheck: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    customCheck: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    customCheckActive: { borderColor: "#10B981", backgroundColor: "#10B981" },
    checkInner: { width: 8, height: 8, borderRadius: 1.5, backgroundColor: '#fff' },
    masterCheckLabel: { marginLeft: 6, fontWeight: "800", fontSize: 13 },
    modalSearchInputCompact: { flex: 1, padding: 10, borderWidth: 1, borderRadius: 12, fontSize: 14, height: 42 },
    modalListBox: { flex: 1, borderWidth: 1, borderRadius: 20, overflow: 'hidden', position: "relative", backgroundColor: 'transparent', marginBottom: 10 },
    modalRow: { height: PLAYER_ROW_H, flexDirection: "row", alignItems: "stretch", borderBottomWidth: 1 },
    modalNameCol: { width: 280, flexDirection: "row", alignItems: "center", paddingLeft: 20 },
    modalPlayerName: { marginLeft: 14, fontSize: 15, fontWeight: "700", flex: 1 },
    modalGraphCol: { flex: 1, overflow: "hidden" },
    trimOverlay: { position: "absolute", top: 0, bottom: 0 },
    handleContainer: { position: "absolute", top: 0, width: 30, height: "100%", alignItems: "center", zIndex: 10, justifyContent: 'center' },
    premiumHandle: { width: 12, height: 50, borderRadius: 4, backgroundColor: '#fff', borderWidth: 2, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, justifyContent: 'center', alignItems: 'center', gap: 3 },
    gripperLine: { width: 4, height: 1.5, opacity: 0.5, borderRadius: 1 },

    waveformContainer: { height: 80, justifyContent: "center", position: "relative" },
    rulerContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: 'flex-end', height: 40, position: 'absolute', top: 20, left: 0, right: 0 },
    rulerTick: { width: 1.5, borderRadius: 1 },
    sliderOverlay: { ...StyleSheet.absoluteFillObject, height: 80 },
    unselectedArea: { position: 'absolute', top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.1)' },
    activeRangeHighlight: { position: "absolute", top: 0, bottom: 0, backgroundColor: 'rgba(220, 38, 38, 0.05)', borderLeftWidth: 2, borderRightWidth: 2, borderTopWidth: 1, borderBottomWidth: 1 },
    axisTick: { fontSize: 10, fontWeight: "700", color: "#94A3B8" },
    inputCard: { flex: 1, borderRadius: 16, padding: 12, borderWidth: 1 },
    inputLabel: { fontSize: 12, fontWeight: "700", marginBottom: 8 },

    modalFooter: { gap: 16 },
    footerInputsRow: { flexDirection: "row", alignItems: "flex-end", gap: 16 },
    timeInputGroup: { width: 140 },
    entryLabel: { fontSize: 13, fontWeight: "900", marginBottom: 8, marginLeft: 4 },
    entryInput: { padding: 12, borderWidth: 1, borderRadius: 12, fontSize: 15, fontWeight: '600', minHeight: 46 },
    applyBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
    applyBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
    exerciseSelectionCol: { position: "relative", marginLeft: 'auto' },
    typeSelectorBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, borderRadius: 12, borderWidth: 1 },
    colorIndicator: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
    typeSelectorText: { fontWeight: "700", fontSize: 15 },
    exerciseTypeMenu: {
        position: "absolute",
        padding: 8,
        borderRadius: 14,
        elevation: 10,
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowRadius: 12,
        borderWidth: 1,
        zIndex: 5000,
    },
    typeMenuOption: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    menuColorDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
    typeMenuText: { fontSize: 13, fontWeight: "800" },

    footerFinalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    modalCancelBtn: { paddingVertical: 12 },
    modalCancelBtnText: { fontWeight: "700", fontSize: 16 },
    saveBtn: { shadowColor: "#10B981", shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
    saveBtnText: { color: "#fff", fontWeight: "800" },

    /* Keyboard Top Bar */
    kTopBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        height: 56,
    },
    kBackBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    kBackText: {
        fontSize: 14,
        fontWeight: "600",
    },
});

