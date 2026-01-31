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
} from "react-native";
import Svg, { Path, G, Line, Text as SvgText, Circle, Rect } from "react-native-svg";
import { db } from "../../db/sqlite";
import { getAssignedPlayersForSession } from "../../services/sessionPlayer.service";
import { syncSessionToPodholder } from "../../services/sessionSync.service";

const HANDLE_GAP = 0.01;
const EXERCISE_TYPES = ["Select Exercise", "Warmup", "10vs10", "11vs11", "1vs1", "20m sprint", "30m sprint", "3vs3", "50m sprint", "Technical", "Tactical"];
const DEFAULT_COLORS = ["transparent", "#10B981", "#EF4444", "#F59E0B", "#3B82F6", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316", "#84CC16", "#6366F1"];

const PLAYER_ROW_H = 84;
const LANE_INNER_H = 64;
const NAME_COL_WIDTH = 140;
const BASE_GRAPH_HEIGHT = 420;

/* ================= HELPERS ================= */

function formatTimeMs(ms: number) {
    if (!ms || isNaN(ms)) return "--:--:--";
    const d = new Date(ms);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
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

function ScientificGrid({ width, height }: any) {
    return (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
            {/* Top & Bottom horizontal lines (like SD lines) */}
            <Line x1="0" y1={2} x2={width} y2={2} stroke="#CBD5E1" strokeWidth={1} />
            <Line x1="0" y1={height - 2} x2={width} y2={height - 2} stroke="#CBD5E1" strokeWidth={1} />

            <Line x1="0" y1={height * 0.1} x2={width} y2={height * 0.1} stroke="#E2E8F0" strokeWidth={0.8} strokeDasharray="4,4" />
            <Line x1="0" y1={height * 0.9} x2={width} y2={height * 0.9} stroke="#E2E8F0" strokeWidth={0.8} strokeDasharray="4,4" />

            {[0.2, 0.4, 0.6, 0.8].map((p, i) => (
                <Line key={`v-${i}`} x1={width * p} y1="0" x2={width * p} y2={height} stroke="#F1F5F9" strokeWidth={0.8} />
            ))}
        </Svg>
    );
}

function WaveSvg({ width, height, samples, stroke = "#DC2626", strokeWidth = 1.6 }: any) {
    if (!samples || samples.length < 2 || !width || !height) return null;
    const pts = samples.map((v: number, i: number) => {
        const x = (i / (samples.length - 1)) * width;
        const y = (1 - v) * (height - 6) + 3;
        return { x, y };
    });
    const d = catmullRom2bezier(pts);
    return (
        <Svg width={width} height={height}>
            <Path d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
        </Svg>
    );
}

function GraphXAxis({ width, startMs, endMs }: { width: number, startMs: number, endMs: number }) {
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
                        <Line x1={it.x} y1={0} x2={it.x} y2={8} stroke="#CBD5E1" strokeWidth={1.5} />
                        <SvgText x={it.x} y={24} fontSize="10" fill="#64748B" textAnchor={i === 0 ? "start" : i === ticks - 1 ? "end" : "middle"} fontWeight="800">
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
}

function LaneView({ playerId, exList, isPreview, effectiveStart, trimDuration, mStartMs, mEndMs, exerciseType }: LaneProps) {
    const [w, setW] = useState(0);
    const seed = useMemo(() => playerId.split("").reduce((a, c) => a + c.charCodeAt(0), 0), [playerId]);
    const samples = useMemo(() => generateMarketWave(seed), [seed]);

    const currentPreview = isPreview && mStartMs && mEndMs && exerciseType && exerciseType !== "Select Exercise" ? {
        start: mStartMs,
        end: mEndMs,
        color: DEFAULT_COLORS[EXERCISE_TYPES.indexOf(exerciseType)]
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
                    <View style={StyleSheet.absoluteFill}><ScientificGrid width={w} height={LANE_INNER_H} /></View>
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
                                        top: 0,
                                        bottom: 0,
                                        backgroundColor: hexToRgba(ex.color, 0.28),
                                        borderLeftWidth: 2,
                                        borderRightWidth: 2,
                                        borderColor: ex.color,
                                        zIndex: 1
                                    }}
                                />
                            );
                        })}
                    </View>
                    <View style={StyleSheet.absoluteFill}><WaveSvg width={w} height={LANE_INNER_H} samples={samples} /></View>
                </>
            )}
        </View>
    );
}

/* ================= MAIN SCREEN ================= */

export default function AddExerciseScreen(props: any) {
    const { sessionId, trimStartTs, trimEndTs, goBack, goNext, navigation } = props;
    const [mainMeasuredWidth, setMainMeasuredWidth] = useState(0);
    const [modalMeasuredWidth, setModalMeasuredWidth] = useState(0);

    const [players, setPlayers] = useState<any[]>([]);
    const [recentExercises, setRecentExercises] = useState<any[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [modalSearch, setModalSearch] = useState("");
    const [modalSelected, setModalSelected] = useState<string[]>([]);
    const [showExerciseList, setShowExerciseList] = useState(false);
    const [exerciseType, setExerciseType] = useState(EXERCISE_TYPES[0]);
    const [listingSearch, setListingSearch] = useState("");
    const [dbTrim, setDbTrim] = useState<{ start: number, end: number } | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        async function fetchSession() {
            try {
                const res: any = await db.execute(`SELECT trim_start_ts, trim_end_ts FROM sessions WHERE session_id = ?`, [sessionId]);
                const rows = res?.rows?._array || res || [];
                if (rows?.[0]?.trim_start_ts) {
                    setDbTrim({ start: Number(rows[0].trim_start_ts), end: Number(rows[0].trim_end_ts) });
                }
            } catch (e) { }
            const list = getAssignedPlayersForSession(sessionId).filter(p => p.assigned);
            setPlayers(list);
            loadExercises();
        }
        fetchSession();
    }, [sessionId]);

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
            setMManualStart(formatTimeMs(Math.round(effectiveStart + trimDuration * next)));
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
            setMManualEnd(formatTimeMs(Math.round(effectiveStart + trimDuration * next)));
        },
        onPanResponderRelease: () => { mEndRef.current = mEndRatioRef.current; }
    })).current;


    const modalPlayersFiltered = useMemo(() => players.filter(p => p.player_name.toLowerCase().includes(modalSearch.toLowerCase())), [players, modalSearch]);
    const listingFiltered = useMemo(() => players.filter(p => p.player_name.toLowerCase().includes(listingSearch.toLowerCase())), [players, listingSearch]);


    const addExercise = async () => {
        if (!modalSelected.length) return Alert.alert("No players", "Select players first.");
        try {
            const id = `ex_${Date.now()}`;
            if (exerciseType === "Select Exercise") return Alert.alert("Required", "Please select an exercise type.");
            const color = DEFAULT_COLORS[EXERCISE_TYPES.indexOf(exerciseType)];
            await db.execute(`INSERT INTO exercises (exercise_id, session_id, type, start_ts, end_ts, color) VALUES (?,?,?,?,?,?)`, [id, sessionId, exerciseType, mStartMs, mEndMs, color]);
            for (const pid of modalSelected) await db.execute(`INSERT INTO exercise_players (exercise_id, player_id) VALUES (?,?)`, [id, pid]);
            loadExercises();
            setModalVisible(false);
            setModalSelected([]);
        } catch (e) { }
    };

    const applyManual = () => {
        const s = parseTimeFlexible(mManualStart, effectiveStart);
        const e = parseTimeFlexible(mManualEnd, effectiveStart);
        if (!s.ok || !e.ok) return Alert.alert("Error", "Check manual time format.");
        const sMs = s.type === "absolute" ? s.ms! : effectiveStart + (s.seconds || 0) * 1000;
        const eMs = e.type === "absolute" ? (e.ms! > sMs ? e.ms! : sMs + 1000) : (sMs + (e.seconds || 0) * 1000);
        const ns = (Math.max(effectiveStart, Math.min(effectiveEnd, sMs)) - effectiveStart) / trimDuration;
        const ne = (Math.max(effectiveStart, Math.min(effectiveEnd, eMs)) - effectiveStart) / trimDuration;
        setMStartRatio(ns); setMEndRatio(ne); mStartRef.current = ns; mEndRef.current = ne;
    };

    const handleFinish = async () => {
        try {
            setLoading(true);
            await syncSessionToPodholder(sessionId);
            Alert.alert("Success", "Session details synced to Podholder.");
            if (goNext) goNext(); else navigation?.goBack();
        } catch (e) {
            Alert.alert("Sync Error", "Could not send data back to Podholder. Please check connection.");
            // navigate anyway or let them retry? User said "when finish is clicked... should get added" 
            // so maybe we still allow them to finish.
            if (goNext) goNext(); else navigation?.goBack();
        } finally {
            setLoading(false);
        }
    };



    return (
        <View style={styles.container}>
            <View style={styles.header}><Text style={styles.title}>Add Exercise</Text></View>
            <View style={styles.body}>
                <TextInput value={listingSearch} onChangeText={setListingSearch} placeholder="Search Players" style={styles.mainSearch} />
                <View style={styles.mainBox}>
                    <View style={styles.mainBoxLabelHeader}>
                        <View style={styles.mainBoxHeaderNamePart}>
                            <Text style={styles.sessionRangeLabel}>SESSION RANGE</Text>
                            <Text style={styles.sessionRangeVal}>{formatTimeMs(effectiveStart)} - {formatTimeMs(effectiveEnd)}</Text>
                        </View>
                        <View style={styles.mainBoxHeaderGraphPart} onLayout={(e) => setMainMeasuredWidth(e.nativeEvent.layout.width)}>
                            <GraphXAxis width={mainMeasuredWidth} startMs={effectiveStart} endMs={effectiveEnd} />
                        </View>
                    </View>
                    <FlatList
                        data={listingFiltered}
                        keyExtractor={p => "mainRow-" + p.player_id}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => (
                            <View style={styles.mainRow}>
                                <View style={styles.mainNameCol}>
                                    <Text style={styles.playerNameText} numberOfLines={1}>{item.player_name}</Text>
                                </View>
                                <View style={styles.mainGraphCol}>
                                    <LaneView
                                        playerId={item.player_id}
                                        exList={recentExercises.filter(ex => ex.players.includes(item.player_id))}
                                        effectiveStart={effectiveStart}
                                        trimDuration={trimDuration}
                                    />
                                </View>
                            </View>
                        )}
                    />
                </View>
            </View>
            <View style={styles.footer}>
                <TouchableOpacity onPress={goBack}><Text style={styles.footerCancel}>BACK</Text></TouchableOpacity>
                <View style={styles.footerActions}>
                    <TouchableOpacity onPress={() => { setModalSelected([]); setModalVisible(true); }} style={styles.primaryAddBtn}><Text style={styles.primaryAddBtnText}>ADD EXERCISE</Text></TouchableOpacity>
                    <TouchableOpacity onPress={handleFinish} style={styles.primaryDoneBtn} disabled={loading}>
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryAddBtnText}>FINISH</Text>}
                    </TouchableOpacity>
                </View>
            </View>

            {modalVisible && (
                <View style={styles.fullOverlay}>
                    <KeyboardAvoidingView style={styles.overlayInner} behavior="padding">
                        <View style={styles.modalCard}>
                            <View style={styles.modalHeaderRow}>
                                <View>
                                    <Text style={styles.modalTitle}>New Exercise</Text>
                                    <Text style={styles.modalSubtitle}>Drag handles to define the exercise period</Text>
                                </View>
                            </View>

                            <View style={styles.modalListBox}>
                                {/* HEADER ROW: SELECT ALL & SEARCH (ALIGNED TO PLAYER COLUMN) */}
                                {/* COMBINED HEADER ROW: SELECT ALL, SEARCH & X-AXIS */}
                                <View style={styles.modalCombinedHeader}>
                                    <View style={styles.modalSubHeaderPlayerPart}>
                                        <TouchableOpacity
                                            style={styles.masterCheck}
                                            onPress={() => setModalSelected(modalSelected.length === players.length ? [] : players.map(p => p.player_id))}
                                        >
                                            <View style={[styles.customCheck, modalSelected.length === players.length && styles.customCheckActive]}>
                                                {modalSelected.length === players.length && <View style={styles.checkInner} />}
                                            </View>
                                            <Text style={styles.masterCheckLabel}></Text>
                                        </TouchableOpacity>
                                        <TextInput
                                            value={modalSearch}
                                            onChangeText={setModalSearch}
                                            placeholder="Search..."
                                            style={styles.modalSearchInputCompact}
                                        />
                                    </View>
                                    <View style={{ flex: 1, justifyContent: 'center' }} onLayout={(e) => setModalMeasuredWidth(e.nativeEvent.layout.width)}>
                                        <GraphXAxis width={modalMeasuredWidth} startMs={effectiveStart} endMs={effectiveEnd} />
                                    </View>
                                </View>
                                <View style={{ flex: 1, position: 'relative' }}>
                                    <FlatList
                                        data={modalPlayersFiltered}
                                        keyExtractor={p => "modalRow-" + p.player_id}
                                        showsVerticalScrollIndicator={false}
                                        renderItem={({ item }) => (
                                            <View style={styles.modalRow}>
                                                <TouchableOpacity style={styles.modalNameCol} onPress={() => setModalSelected(prev => prev.includes(item.player_id) ? prev.filter(id => id !== item.player_id) : [...prev, item.player_id])}>
                                                    <View style={[styles.customCheck, modalSelected.includes(item.player_id) && styles.customCheckActive]}>
                                                        {modalSelected.includes(item.player_id) && <View style={styles.checkInner} />}
                                                    </View>
                                                    <Text style={styles.modalPlayerName} numberOfLines={1}>{item.player_name}</Text>
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
                                                    />
                                                </View>
                                            </View>
                                        )}
                                    />
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
                                                    backgroundColor: 'rgba(34, 197, 94, 0.15)',
                                                    borderLeftWidth: 1,
                                                    borderRightWidth: 1,
                                                    borderColor: 'rgba(34, 197, 94, 0.5)'
                                                }}
                                                pointerEvents="none"
                                            />

                                            <View {...startResponder.panHandlers} style={[styles.pinHandle, { left: mStartRatio * modalMeasuredWidth - 30 }]}>
                                                <View style={styles.handleTriangle} />
                                                <View style={styles.handleLine} />
                                            </View>
                                            <View {...endResponder.panHandlers} style={[styles.pinHandle, { left: mEndRatio * modalMeasuredWidth - 30 }]}>
                                                <View style={styles.handleTriangle} />
                                                <View style={styles.handleLine} />
                                            </View>
                                        </View>
                                    )}
                                </View>
                            </View>

                            <View style={styles.modalFooter}>
                                <View style={styles.footerInputsRow}>
                                    <View style={styles.timeInputGroup}>
                                        <Text style={styles.entryLabel}>START</Text>
                                        <TextInput value={mManualStart} onChangeText={setMManualStart} style={styles.entryInput} />
                                    </View>
                                    <View style={styles.timeInputGroup}>
                                        <Text style={styles.entryLabel}>END</Text>
                                        <TextInput value={mManualEnd} onChangeText={setMManualEnd} style={styles.entryInput} />
                                    </View>
                                    <TouchableOpacity onPress={applyManual} style={styles.applyBtn}><Text style={styles.applyBtnText}>APPLY</Text></TouchableOpacity>

                                    <View style={styles.exerciseSelectionCol}>
                                        <TouchableOpacity style={styles.typeSelectorBtn} onPress={() => setShowExerciseList(!showExerciseList)}>
                                            <View style={[styles.colorIndicator, { backgroundColor: DEFAULT_COLORS[EXERCISE_TYPES.indexOf(exerciseType)] }]} />
                                            <Text style={styles.typeSelectorText}>{exerciseType} ▼</Text>
                                        </TouchableOpacity>

                                        {showExerciseList && (
                                            <View style={styles.exerciseTypeMenu}>
                                                <View style={{ maxHeight: 240 }}>
                                                    <ScrollView
                                                        nestedScrollEnabled={true}
                                                        showsVerticalScrollIndicator={true}
                                                    >
                                                        {EXERCISE_TYPES.map((t, idx) => (
                                                            <TouchableOpacity key={t} onPress={() => { setExerciseType(t); setShowExerciseList(false); }} style={[styles.typeMenuOption, { backgroundColor: hexToRgba(DEFAULT_COLORS[idx], 0.12), marginBottom: 8 }]}>
                                                                <View style={[styles.menuColorDot, { backgroundColor: DEFAULT_COLORS[idx] }]} />
                                                                <Text style={styles.typeMenuText}>{t}</Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </ScrollView>
                                                </View>
                                            </View>
                                        )}
                                    </View>
                                </View>

                                <View style={styles.footerFinalRow}>
                                    <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCancelBtn}><Text style={styles.modalCancelBtnText}>Cancel</Text></TouchableOpacity>
                                    <TouchableOpacity onPress={addExercise} style={styles.saveBtn}><Text style={styles.saveBtnText}>SAVE EXERCISE</Text></TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: { padding: 20, borderBottomWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#fff" },
    title: { fontSize: 24, fontWeight: "900", color: "#0F172A", letterSpacing: -0.5 },
    body: { flex: 1, padding: 16 },
    mainSearch: { padding: 16, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 16, backgroundColor: "#fff", marginBottom: 16, fontSize: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
    mainBox: { flex: 1, backgroundColor: "#fff", borderRadius: 24, borderWidth: 1, borderColor: "#E2E8F0", overflow: "hidden", shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 15, elevation: 3 },
    mainBoxLabelHeader: { height: 52, flexDirection: "row", alignItems: "stretch", borderBottomWidth: 1, borderColor: "#F1F5F9", backgroundColor: "#F8FAFC" },
    mainBoxHeaderNamePart: { width: NAME_COL_WIDTH, paddingLeft: 18, justifyContent: 'center' },
    mainBoxHeaderGraphPart: { flex: 1, justifyContent: 'center' },
    sessionRangeLabel: { fontSize: 10, fontWeight: "800" },
    sessionRangeVal: { fontSize: 11, fontWeight: "700", color: "#64748B" },
    mainRow: { height: PLAYER_ROW_H, flexDirection: "row", alignItems: "stretch", borderBottomWidth: 1, borderColor: "#F1F5F9" },
    mainNameCol: { width: NAME_COL_WIDTH, justifyContent: "center", paddingLeft: 20 },
    mainGraphCol: { flex: 1, overflow: "hidden" },
    playerNameText: { fontWeight: "700", color: "#334155", fontSize: 15 },
    footer: { flexDirection: "row", padding: 20, borderTopWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#fff", alignItems: "center", justifyContent: "space-between" },
    footerActions: { flexDirection: "row", gap: 16 },
    primaryAddBtn: { backgroundColor: "#10B981", paddingHorizontal: 24, paddingVertical: 16, borderRadius: 14, shadowColor: "#10B981", shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    primaryDoneBtn: { backgroundColor: "#0F172A", paddingHorizontal: 24, paddingVertical: 16, borderRadius: 14, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
    primaryAddBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
    footerCancel: { color: "#64748B", fontWeight: "700", fontSize: 16 },

    fullOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(15,23,42,0.8)", justifyContent: "center", alignItems: "center", zIndex: 1000 },
    overlayInner: { width: "98%", height: "98%", justifyContent: "center", alignItems: "center" },
    modalCard: { width: "96%", height: "94%", backgroundColor: "#fff", borderRadius: 32, padding: 32, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 30, elevation: 20 },
    modalHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    modalTitle: { fontSize: 32, fontWeight: "900", color: "#0F172A", letterSpacing: -0.5 },
    modalSubtitle: { fontSize: 14, color: "#64748B", marginTop: 4, fontWeight: "500" },
    modalCombinedHeader: { flexDirection: "row", height: 72, borderBottomWidth: 1, borderColor: '#F1F5F9', alignItems: 'center', backgroundColor: '#F8FAFC' },
    modalSubHeaderPlayerPart: { width: 280, flexDirection: 'row', alignItems: 'center', paddingLeft: 24, paddingRight: 12, gap: 10 },
    masterCheck: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0" },
    customCheck: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: "#CBD5E1", alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
    customCheckActive: { borderColor: "#10B981", backgroundColor: "#10B981" },
    checkInner: { width: 8, height: 8, borderRadius: 1.5, backgroundColor: '#fff' },
    masterCheckLabel: { marginLeft: 6, fontWeight: "800", color: "#475569", fontSize: 13 },
    modalSearchInputCompact: { flex: 1, padding: 10, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, backgroundColor: "#F8FAFC", fontSize: 14, height: 42 },
    modalListBox: { flex: 1, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 28, overflow: 'hidden', position: "relative", backgroundColor: '#fff', marginBottom: 20 },
    modalRow: { height: PLAYER_ROW_H, flexDirection: "row", alignItems: "stretch", borderBottomWidth: 1, borderColor: "#F1F5F9" },
    modalNameCol: { width: 280, flexDirection: "row", alignItems: "center", paddingLeft: 24 },
    modalPlayerName: { marginLeft: 18, fontSize: 17, fontWeight: "700", color: "#334155", flex: 1 },
    modalGraphCol: { flex: 1, overflow: "hidden" },
    trimOverlay: { position: "absolute", top: 0, bottom: 0 },
    pinHandle: { position: "absolute", top: 0, width: 60, alignItems: "center", height: "100%", zIndex: 10, backgroundColor: 'transparent' },
    handleTriangle: { width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 14, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: "#0F172A" },
    handleLine: { width: 2, flex: 1, backgroundColor: "rgba(15,23,42,0.8)", marginTop: 2 },

    modalFooter: { gap: 16 },
    footerInputsRow: { flexDirection: "row", alignItems: "flex-end", gap: 16 },
    timeInputGroup: { width: 140 },
    entryLabel: { fontSize: 13, fontWeight: "900", color: "#94A3B8", marginBottom: 8, marginLeft: 4 },
    entryInput: { padding: 12, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, backgroundColor: "#F8FAFC", fontSize: 15, fontWeight: '600', color: '#0F172A' },
    applyBtn: { backgroundColor: "#0F172A", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
    applyBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
    exerciseSelectionCol: { position: "relative", marginLeft: 'auto' },
    typeSelectorBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", width: 240 },
    colorIndicator: { width: 14, height: 14, borderRadius: 7, marginRight: 10 },
    typeSelectorText: { fontWeight: "800", color: "#0F172A", fontSize: 16 },
    exerciseTypeMenu: {
        position: "absolute",
        bottom: 60,
        right: 0,
        backgroundColor: "#fff",
        padding: 12,
        borderRadius: 18,
        elevation: 20,
        shadowColor: "#000",
        shadowOpacity: 0.3,
        shadowRadius: 20,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        width: 300,
        zIndex: 5000, // Higher zIndex to ensure it stays on top
        maxHeight: 264
    },
    typeMenuOption: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
    menuColorDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
    typeMenuText: { fontSize: 13, fontWeight: "800", color: "#334155" },

    footerFinalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    modalCancelBtn: { paddingVertical: 12 },
    modalCancelBtnText: { color: "#64748B", fontWeight: "800", fontSize: 17 },
    saveBtn: { backgroundColor: "#10B981", paddingHorizontal: 40, paddingVertical: 16, borderRadius: 18, shadowColor: "#10B981", shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 },
    saveBtnText: { color: "#fff", fontWeight: "900", fontSize: 18 }
});