import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Modal,
    TextInput,
    ActivityIndicator,
    Alert,
    Dimensions,
    Pressable,
    NativeModules,
    PermissionsAndroid,
    Platform,
    Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api from '../../api/axios';
import { db } from '../../db/sqlite';
import { useTheme } from '../../components/context/ThemeContext';
import { useAlert } from '../../components/context/AlertContext';
import { POD_HOLDER_URL } from '../../utils/constants';

interface PodHolder {
    pod_holder_id: string;
    serial_number: string;
    device_id: string;
    model: string;
    wifi_ssid?: string;
    wifi_password?: string;
    isConnected?: boolean;
}

const { width } = Dimensions.get('window');

const PodHolderManagementScreen = () => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const { showAlert } = useAlert();
    const { WifiModule } = NativeModules;

    const [podHolders, setPodHolders] = useState<PodHolder[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    /* ================= LOAD DATA ================= */

    const loadPodHolders = useCallback(async (showLoading = true) => {
        if (showLoading) setLoading(true);

        // 1. Load from local DB first (for offline support)
        try {
            const local = db.execute(`SELECT * FROM pod_holders`);
            const localRows = local.rows?._array || [];
            if (localRows.length > 0) {
                const holders = localRows.map((ph: any) => ({ ...ph, isConnected: false }));
                setPodHolders(holders);
                checkConnectivity(holders);
            }
        } catch (e) {
            console.error('Failed to load local pod holders', e);
        }

        // 2. Fetch from API if possible and update local cache
        try {
            const res = await api.get('/pod-holders');
            const data = res.data?.data || res.data || [];
            const holders = data.map((ph: any) => ({ ...ph, isConnected: false }));

            setPodHolders(holders);
            checkConnectivity(holders);

            // Update local cache
            try {
                db.execute(`DELETE FROM pod_holders`);
                for (const ph of holders) {
                    db.execute(
                        `INSERT INTO pod_holders (pod_holder_id, serial_number, device_id, model) VALUES (?,?,?,?)`,
                        [ph.pod_holder_id, ph.serial_number, ph.device_id, ph.model]
                    );
                }
            } catch (dbErr) {
                console.error("Failed to cache pod holders", dbErr);
            }
        } catch (e) {
            console.log('App is offline or API unreachable - using cached pod holders');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        requestLocationPermission();
        loadPodHolders();
    }, []); // Run once on mount to avoid flickering loops

    /* ================= CONNECTIVITY CHECK ================= */

    const requestLocationPermission = async () => {
        if (Platform.OS === 'android') {
            try {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
                );
                return granted === PermissionsAndroid.RESULTS.GRANTED;
            } catch (err) {
                return false;
            }
        }
        return true;
    };

    const checkConnectivity = async (holders: PodHolder[]) => {
        let currentSsid: string | null = null;

        try {
            if (WifiModule && WifiModule.getCurrentSsid) {
                const hasPerm = await requestLocationPermission();
                if (hasPerm) {
                    currentSsid = await WifiModule.getCurrentSsid();
                }
            }
        } catch (e) { }

        // Set connected status based on SSID match
        setPodHolders(prev => prev.map(ph => {
            const isNameMatch = currentSsid && (
                currentSsid.toUpperCase().trim() === ph.serial_number?.toUpperCase().trim() ||
                currentSsid.toUpperCase().trim() === ph.device_id?.toUpperCase().trim()
            );

            return {
                ...ph,
                isConnected: !!isNameMatch
            };
        }));

        // Optional: Verify reachability independently
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 1500);
            await fetch(`${POD_HOLDER_URL}/status`, { signal: controller.signal });
            clearTimeout(timeout);
        } catch (err) { }
    };

    /* ================= ACTIONS ================= */

    const handleOpenSystemWifi = () => {
        if (Platform.OS === 'android') {
            Linking.sendIntent("android.settings.WIFI_SETTINGS");
        } else {
            Linking.openURL('App-Prefs:root=WIFI');
        }
    };

    const toggleConnection = async (ph: PodHolder) => {
        if (ph.isConnected) {
            Alert.alert(
                "Currently Connected",
                "Your phone is already linked to a pod holder. To disconnect or switch devices, please use your system WiFi settings.",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Open WiFi Settings", onPress: handleOpenSystemWifi }
                ]
            );
        } else {
            Alert.alert(
                "Connect to Device",
                "Please select your Pod Holder's WiFi signal in the next screen. (Note: Stay connected even if Android says there is no internet).",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Open WiFi Settings", onPress: handleOpenSystemWifi }
                ]
            );
        }
    };

    /* ================= RENDER ================= */

    const renderItem = ({ item }: { item: PodHolder }) => (
        <View style={[styles.card, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
            <View style={styles.cardInfo}>
                <View style={[styles.iconBox, { backgroundColor: item.isConnected ? 'rgba(22, 163, 74, 0.1)' : 'rgba(148, 163, 184, 0.1)' }]}>
                    <Icon
                        name={item.isConnected ? "wifi-check" : "wifi-off"}
                        size={24}
                        color={item.isConnected ? "#16A34A" : "#94A3B8"}
                    />
                </View>
                <View style={styles.textDetails}>
                    <Text style={[styles.serialText, { color: isDark ? '#F1F5F9' : '#0F172A' }]}>
                        {item.serial_number || 'Unnamed Holder'}
                    </Text>
                    <Text style={styles.metaText}>
                        ID: {item.device_id || 'N/A'} • {item.model || 'Standard Model'}
                    </Text>
                </View>

                <TouchableOpacity
                    style={[
                        styles.statusBadge,
                        { backgroundColor: item.isConnected ? 'rgba(22, 163, 74, 0.1)' : 'rgba(181, 0, 2, 0.05)' }
                    ]}
                    onPress={() => toggleConnection(item)}
                >
                    <View style={[styles.dot, { backgroundColor: item.isConnected ? '#16A34A' : '#B50002' }]} />
                    <Text style={[styles.statusText, { color: item.isConnected ? '#16A34A' : '#B50002' }]}>
                        {item.isConnected ? 'CONNECTED' : 'CONNECT'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const sortedHolders = [...podHolders].sort((a, b) => {
        if (a.isConnected === b.isConnected) return 0;
        return a.isConnected ? -1 : 1;
    });

    return (
        <View style={[styles.container, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
            <View style={styles.header}>
                <View>
                    <Text style={[styles.title, { color: isDark ? '#F1F5F9' : '#0F172A' }]}>Pod Holders</Text>
                    <Text style={[styles.subtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>Manage device connections</Text>
                </View>
                <TouchableOpacity style={styles.refreshBtn} onPress={() => loadPodHolders()}>
                    <Icon name="refresh" size={22} color="#B50002" />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#B50002" />
                </View>
            ) : (
                <FlatList
                    data={sortedHolders}
                    keyExtractor={item => item.pod_holder_id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    refreshing={refreshing}
                    onRefresh={() => { setRefreshing(true); loadPodHolders(false); }}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Icon name="wifi-off" size={64} color={isDark ? '#334155' : '#E2E8F0'} />
                            <Text style={[styles.emptyText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                                No pod holders assigned to your club
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
};

export default PodHolderManagementScreen;

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
    subtitle: { fontSize: 13, fontWeight: '500', marginTop: 2 },
    refreshBtn: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: 'rgba(181, 0, 2, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    list: { paddingHorizontal: 20, paddingBottom: 40 },
    card: {
        borderRadius: 20,
        padding: 18,
        marginBottom: 16,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        flexDirection: 'column',
    },
    cardInfo: { flexDirection: 'row', alignItems: 'center' },
    iconBox: {
        width: 56,
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textDetails: { marginLeft: 16, flex: 1 },
    serialText: { fontSize: 18, fontWeight: '900', marginBottom: 2 },
    metaText: { fontSize: 12, color: '#94A3B8', fontWeight: '500', marginBottom: 6 },
    wifiLabel: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },

    actions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 18,
        borderTopWidth: 1,
        borderTopColor: 'rgba(148, 163, 184, 0.1)',
        paddingTop: 16,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
    },
    dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    statusText: { fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
    settingsBtn: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: 'rgba(148, 163, 184, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 },
    emptyText: { marginTop: 16, fontSize: 16, fontWeight: '500' },

    /* MODAL */
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
    modalContent: {
        width: width * 0.85,
        borderRadius: 28,
        padding: 24,
        elevation: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: { fontSize: 22, fontWeight: '900' },
    modalBody: {},
    inputLabel: { fontSize: 13, fontWeight: '700', marginBottom: 8, marginLeft: 4 },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 56,
        marginBottom: 16,
    },
    input: { flex: 1, marginLeft: 12, fontSize: 16, fontWeight: '600' },
    saveBtn: {
        backgroundColor: '#B50002',
        height: 60,
        borderRadius: 18,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 12,
        gap: 10,
    },
    saveBtnText: { color: '#FFF', fontSize: 17, fontWeight: '900' },
    noteText: {
        fontSize: 11,
        color: '#94A3B8',
        textAlign: 'center',
        marginTop: 16,
        lineHeight: 16,
        paddingHorizontal: 10,
    }
});
