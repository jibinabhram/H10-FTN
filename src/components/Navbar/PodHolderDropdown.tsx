import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    Platform,
    Linking,
    Dimensions,
    NativeModules,
    PermissionsAndroid,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import NetInfo from '@react-native-community/netinfo';
import api from '../../api/axios';
import { db } from '../../db/sqlite';
import { useTheme } from '../../components/context/ThemeContext';
import { POD_HOLDER_URL } from '../../utils/constants';

interface PodHolder {
    pod_holder_id: string;
    serial_number: string;
    device_id: string;
    model: string;
    isConnected?: boolean;
    connectedAt?: number | null; // unix ms when first detected connected
}

interface Props {
    onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip surrounding and embedded quotes from SSIDs */
const cleanSsid = (raw: string | null | undefined): string | null => {
    if (!raw || raw.trim() === '<unknown ssid>' || raw.trim() === 'WIFI_NO_SSID') return null;
    // Remove ALL double-quotes (not just surrounding ones) and trim
    return raw.replace(/"/g, '').trim();
};

// ──────────────────────────────────────────────────────────────────────────────

const PodHolderDropdown: React.FC<Props> = ({ onClose }) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const { WifiModule } = NativeModules;

    const [podHolders, setPodHolders] = useState<PodHolder[]>([]);
    const [loading, setLoading] = useState(true);
    const [ssidUnavailable, setSsidUnavailable] = useState(false); // true when location is off
    const [, setTick] = useState(0);                        // force re-render for timer
    const connectedAtMap = useRef<Record<string, number>>({}); // persist timestamps

    // ── Permission ─────────────────────────────────────────────────────────────
    const requestLocation = async (): Promise<boolean> => {
        if (Platform.OS !== 'android') return true;
        try {
            const result = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            );
            return result === PermissionsAndroid.RESULTS.GRANTED;
        } catch {
            return false;
        }
    };

    // ── Strategy 1: SSID from WifiModule, then NetInfo fallback ───────────────
    const getSsid = async (): Promise<string | null> => {
        // Try WifiModule first
        if (WifiModule?.getCurrentSsid) {
            try {
                const hasPerm = await requestLocation();
                if (hasPerm) {
                    const raw = await WifiModule.getCurrentSsid();
                    const ssid = cleanSsid(raw);
                    console.log('[PodHolder] WifiModule SSID:', raw, '→', ssid);
                    if (ssid) return ssid;
                }
            } catch (e) {
                console.log('[PodHolder] SSID error:', e);
            }
        }

        // Fallback: try NetInfo (sometimes returns SSID even without GPS)
        try {
            const state = await NetInfo.fetch();
            const netSsid = cleanSsid((state.details as any)?.ssid);
            console.log('[PodHolder] NetInfo SSID:', netSsid);
            if (netSsid) return netSsid;
        } catch (e) {
            console.log('[PodHolder] NetInfo error:', e);
        }

        return null;
    };

    /** Ping the pod holder local service – resolves true if reachable */
    const pingPodHolder = async (): Promise<boolean> => {
        try {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 2500);
            const res = await fetch(`${POD_HOLDER_URL}/status`, {
                method: 'GET',
                signal: controller.signal,
            });
            clearTimeout(tid);
            return res.ok || res.status < 500;
        } catch {
            return false;
        }
    };

    // ── Main connectivity check ────────────────────────────────────────────────
    // Uses prev state internally so it is safe to call from intervals without stale closures
    const checkConnectivityNow = useCallback(async () => {
        const ssid = await getSsid();
        const now = Date.now();
        console.log('[PodHolder] Checking connectivity. SSID:', ssid);

        // If SSID unavailable, try a ping to see if any pod holder is reachable
        let serviceAlive = false;
        if (!ssid) {
            setSsidUnavailable(true);
            serviceAlive = await pingPodHolder();
            console.log('[PodHolder] SSID null, ping result:', serviceAlive);
        } else {
            setSsidUnavailable(false);
        }

        setPodHolders(prev => {
            if (prev.length === 0) return prev;
            return prev.map(ph => {
                let isConnected = false;

                if (ssid) {
                    const ssidU = ssid.toUpperCase();
                    const serialU = ph.serial_number?.toUpperCase().trim() ?? '';
                    const deviceU = ph.device_id?.toUpperCase().trim() ?? '';

                    // Exact match OR substring match (handles prefix variations)
                    isConnected =
                        ssidU === serialU ||
                        ssidU === deviceU ||
                        ssidU.includes(serialU) ||
                        (serialU.length > 4 && serialU.includes(ssidU)) ||
                        ssidU.includes(deviceU) ||
                        (deviceU.length > 4 && deviceU.includes(ssidU));
                } else if (serviceAlive) {
                    // Ping fallback: service is alive but we can't ID which PH.
                    // Keep previously connected ones connected; otherwise mark first.
                    const wasConnected = !!connectedAtMap.current[ph.pod_holder_id];
                    isConnected = wasConnected || prev.indexOf(ph) === 0;
                }

                if (isConnected) {
                    if (!connectedAtMap.current[ph.pod_holder_id]) {
                        connectedAtMap.current[ph.pod_holder_id] = now;
                    }
                } else {
                    delete connectedAtMap.current[ph.pod_holder_id];
                }

                return {
                    ...ph,
                    isConnected,
                    connectedAt: connectedAtMap.current[ph.pod_holder_id] ?? null,
                };
            });
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Keep a ref to always have the latest checker without recreating intervals
    const checkRef = useRef(checkConnectivityNow);
    useEffect(() => { checkRef.current = checkConnectivityNow; }, [checkConnectivityNow]);

    // Stable polling: interval created once, uses ref so no stale closures
    useEffect(() => {
        const tickId = setInterval(() => setTick(n => n + 1), 15000);
        const pollId = setInterval(() => { checkRef.current(); }, 5000);
        return () => {
            clearInterval(tickId);
            clearInterval(pollId);
        };
    }, []); // ← empty deps: created once, never restarted

    // ── Load pod holders from local DB + API ───────────────────────────────────
    const loadPodHolders = useCallback(async () => {
        // 1. Local DB first (fast display)
        try {
            const local = db.execute(`SELECT * FROM pod_holders`);
            const rows: any[] = local.rows?._array || [];
            if (rows.length > 0) {
                const holders = rows.map(ph => ({ ...ph, isConnected: false, connectedAt: null }));
                setPodHolders(holders);
                checkConnectivityNow();
            }
        } catch (e) {
            console.error('[PodHolder] Local DB error:', e);
        }

        // 2. Fetch fresh from API
        try {
            setLoading(true);
            const res = await api.get('/pod-holders');
            const data: any[] = res.data?.data || res.data || [];
            const holders = data.map(ph => ({ ...ph, isConnected: false, connectedAt: null }));

            setPodHolders(holders);
            checkConnectivityNow();

            // Persist to local cache
            db.execute(`DELETE FROM pod_holders`);
            for (const ph of holders) {
                db.execute(
                    `INSERT INTO pod_holders (pod_holder_id, serial_number, device_id, model) VALUES (?,?,?,?)`,
                    [ph.pod_holder_id, ph.serial_number, ph.device_id, ph.model],
                );
            }
        } catch {
            console.log('[PodHolder] Offline – using cached data');
        } finally {
            setLoading(false);
        }
    }, [checkConnectivityNow]);

    useEffect(() => {
        loadPodHolders();
    }, [loadPodHolders]);

    // ── Handlers ───────────────────────────────────────────────────────────────
    const handleOpenWifi = () => {
        if (Platform.OS === 'android') {
            Linking.sendIntent('android.settings.WIFI_SETTINGS');
        } else {
            Linking.openURL('App-Prefs:root=WIFI');
        }
        onClose();
    };

    // ── Render each row ────────────────────────────────────────────────────────
    const renderItem = ({ item }: { item: PodHolder }) => (
        <TouchableOpacity
            style={[
                styles.item,
                { borderBottomColor: isDark ? '#1E293B' : '#F1F5F9' },
                item.isConnected && styles.itemConnected,
            ]}
            onPress={handleOpenWifi}
            activeOpacity={0.75}
        >
            {/* Left content */}
            <View style={{ flex: 1 }}>
                <View style={styles.rowTitle}>
                    {/* Status dot */}
                    <View style={[
                        styles.statusDot,
                        { backgroundColor: item.isConnected ? '#16A34A' : '#94A3B8' },
                    ]} />

                    <Text style={[
                        styles.serialText,
                        { color: item.isConnected ? '#16A34A' : (isDark ? '#F1F5F9' : '#0F172A') },
                    ]}>
                        {item.serial_number || 'Unnamed Holder'}
                    </Text>
                </View>

                {item.model ? (
                    <Text style={[styles.modelText, { marginLeft: 14 }]}>{item.model}</Text>
                ) : null}

                {/* ✅ Connected-time badge – only when connected */}
                {item.isConnected && item.connectedAt ? (
                    <View style={styles.connectedBadge}>


                    </View>
                ) : null}
            </View>

            {/* Right icon */}
            <Icon
                name={item.isConnected ? 'wifi-check' : 'wifi-off'}
                size={20}
                color={item.isConnected ? '#16A34A' : '#CBD5E1'}
            />
        </TouchableOpacity>
    );

    // Connected first
    const sorted = [...podHolders].sort((a, b) => {
        if (a.isConnected === b.isConnected) return 0;
        return a.isConnected ? -1 : 1;
    });

    const anyConnected = podHolders.some(ph => ph.isConnected);

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <View style={[styles.dropdown, { backgroundColor: isDark ? '#0F172A' : '#FFFFFF' }]}>

            {/* Header */}
            <View style={styles.header}>
                <Text style={[styles.title, { color: isDark ? '#F1F5F9' : '#0F172A' }]}>
                    Pod Holders
                </Text>
                <TouchableOpacity onPress={loadPodHolders} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Icon name="refresh" size={18} color="#B50002" />
                </TouchableOpacity>
            </View>

            {/* Body */}
            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="small" color="#B50002" />
                </View>
            ) : (
                <FlatList
                    data={sorted}
                    keyExtractor={item => item.pod_holder_id}
                    renderItem={renderItem}
                    scrollEnabled={false}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>No pod holders found</Text>
                    }
                    ListFooterComponent={() => {
                        if (podHolders.length === 0) return null;

                        return (
                            <View>
                                {ssidUnavailable && (
                                    <View style={[styles.footerBox, { backgroundColor: 'rgba(234, 179, 8, 0.08)', marginBottom: 4 }]}>
                                        <Icon name="map-marker-off-outline" size={12} color="#CA8A04" />
                                        <Text style={[styles.footerTextRed, { color: '#CA8A04' }]}>
                                            Enable Location for exact device match
                                        </Text>
                                    </View>
                                )}
                                {!anyConnected ? (
                                    <View style={styles.footerBox}>
                                        <Icon name="alert-circle-outline" size={12} color="#B50002" />
                                        <Text style={styles.footerTextRed}>
                                            None of your Pod Holders are connected
                                        </Text>
                                    </View>
                                ) : (
                                    <View style={[styles.footerBox, styles.footerGreen]}>
                                        <Icon name="check-circle-outline" size={12} color="#16A34A" />
                                        <Text style={styles.footerTextGreen}>
                                            Pod Holder connected via WiFi
                                        </Text>
                                    </View>
                                )}
                            </View>
                        );
                    }}
                />
            )}

            {/* Open WiFi Settings button */}
            <TouchableOpacity style={styles.settingsBtn} onPress={handleOpenWifi}>
                <Icon name="cog-outline" size={16} color="#FFF" />
                <Text style={styles.settingsBtnText}>Open WiFi Settings</Text>
            </TouchableOpacity>
        </View>
    );
};

export default PodHolderDropdown;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    dropdown: {
        position: 'absolute',
        top: 56 + 6,
        right: 140,
        width: 270,
        borderRadius: 16,
        padding: 12,
        elevation: 18,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
        zIndex: 1001,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        paddingHorizontal: 4,
    },
    title: {
        fontSize: 16,
        fontWeight: '800',
    },
    center: {
        padding: 20,
        alignItems: 'center',
    },

    // Row
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 6,
        borderBottomWidth: 1,
        borderRadius: 8,
        marginVertical: 1,
    },
    itemConnected: {
        backgroundColor: 'rgba(22, 163, 74, 0.07)',
        borderBottomWidth: 0,
        borderWidth: 1,
        borderColor: 'rgba(22, 163, 74, 0.25)',
    },
    rowTitle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    statusDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
    },
    serialText: {
        fontSize: 14,
        fontWeight: '700',
    },
    modelText: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 1,
    },

    // Connected time badge
    connectedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
        marginLeft: 14,
        backgroundColor: 'rgba(22, 163, 74, 0.14)',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 5,
        alignSelf: 'flex-start',
    },
    connectedBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#16A34A',
    },

    // Empty
    emptyText: {
        textAlign: 'center',
        color: '#94A3B8',
        paddingVertical: 20,
        fontSize: 13,
    },

    // Footer
    footerBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 7,
        marginTop: 6,
        backgroundColor: 'rgba(181, 0, 2, 0.05)',
        borderRadius: 8,
    },
    footerGreen: {
        backgroundColor: 'rgba(22, 163, 74, 0.08)',
    },
    footerTextRed: {
        color: '#B50002',
        fontSize: 10,
        fontWeight: '700',
    },
    footerTextGreen: {
        color: '#16A34A',
        fontSize: 10,
        fontWeight: '700',
    },

    // Settings button
    settingsBtn: {
        backgroundColor: '#B50002',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        marginTop: 10,
        gap: 6,
    },
    settingsBtnText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '700',
    },
});
