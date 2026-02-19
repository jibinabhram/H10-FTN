import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    Alert,
    Platform,
    Linking,
    Pressable,
    Dimensions,
    NativeModules,
    PermissionsAndroid,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
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
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
    onClose: () => void;
}

const PodHolderDropdown: React.FC<Props> = ({ onClose }) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const { WifiModule } = NativeModules;

    const [podHolders, setPodHolders] = useState<PodHolder[]>([]);
    const [loading, setLoading] = useState(true);

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

    const checkConnectivity = useCallback(async (holders: PodHolder[]) => {
        let currentSsid: string | null = null;

        try {
            if (WifiModule && WifiModule.getCurrentSsid) {
                const hasPerm = await requestLocationPermission();
                if (hasPerm) {
                    currentSsid = await WifiModule.getCurrentSsid();
                    console.log("Detected SSID:", currentSsid);
                }
            }
        } catch (e) {
            console.log("SSID detection error:", e);
        }

        // 2. Set connected status based on SSID match
        setPodHolders(prev => prev.map(ph => {
            const isNameMatch = currentSsid && (
                currentSsid.toUpperCase().trim() === ph.serial_number?.toUpperCase().trim() ||
                currentSsid.toUpperCase().trim() === ph.device_id?.toUpperCase().trim()
            );
            return { ...ph, isConnected: !!isNameMatch };
        }));

        // 3. Optional: Verify service reachability (ping)
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 1500);
            await fetch(`${POD_HOLDER_URL}/status`, { signal: controller.signal });
            clearTimeout(timeout);
            // We could add a 'isServiceAlive' flag here if needed later
        } catch (err) {
            console.log("Pod Holder Service not reachable at", POD_HOLDER_URL);
        }
    }, [WifiModule]);

    const loadPodHolders = useCallback(async () => {
        // 1. Load from local DB first
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

        // 2. Fetch from API
        try {
            setLoading(true);
            const res = await api.get('/pod-holders');
            const data = res.data?.data || res.data || [];
            const holders = data.map((ph: any) => ({ ...ph, isConnected: false }));

            setPodHolders(holders);
            checkConnectivity(holders);

            // Update cache
            try {
                db.execute(`DELETE FROM pod_holders`);
                for (const ph of holders) {
                    db.execute(
                        `INSERT INTO pod_holders (pod_holder_id, serial_number, device_id, model) VALUES (?,?,?,?)`,
                        [ph.pod_holder_id, ph.serial_number, ph.device_id, ph.model]
                    );
                }
            } catch (dbErr) { }
        } catch (e) {
            console.log('App is offline or API unreachable');
        } finally {
            setLoading(false);
        }
    }, [checkConnectivity]);

    useEffect(() => {
        loadPodHolders();
    }, [loadPodHolders]);

    const handleOpenSystemWifi = () => {
        if (Platform.OS === 'android') {
            Linking.sendIntent("android.settings.WIFI_SETTINGS");
        } else {
            Linking.openURL('App-Prefs:root=WIFI');
        }
        onClose();
    };

    const renderItem = ({ item }: { item: PodHolder }) => (
        <TouchableOpacity
            style={[styles.item, { borderBottomColor: isDark ? '#1E293B' : '#F1F5F9' }]}
            onPress={handleOpenSystemWifi}
        >
            <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.statusDotMini, { backgroundColor: item.isConnected ? '#16A34A' : '#B50002' }]} />
                    <Text style={[styles.serialText, { color: isDark ? '#F1F5F9' : '#0F172A' }]}>
                        {item.serial_number || 'Unnamed Holder'}
                    </Text>

                </View>
                {item.model && (
                    <Text style={[styles.modelText, { marginLeft: 16 }]}>{item.model}</Text>
                )}
            </View>
            <Icon
                name={item.isConnected ? "wifi-check" : "wifi-off"}
                size={20}
                color={item.isConnected ? "#16A34A" : "#94A3B8"}
            />
        </TouchableOpacity>
    );

    const sortedPodHolders = [...podHolders].sort((a, b) => {
        if (a.isConnected === b.isConnected) return 0;
        return a.isConnected ? -1 : 1;
    });

    return (
        <View style={[styles.dropdown, { backgroundColor: isDark ? '#0F172A' : '#FFFFFF' }]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: isDark ? '#F1F5F9' : '#0F172A' }]}>Pod Holders</Text>
                <TouchableOpacity onPress={loadPodHolders}>
                    <Icon name="refresh" size={18} color="#B50002" />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="small" color="#B50002" />
                </View>
            ) : (
                <FlatList
                    data={sortedPodHolders}
                    keyExtractor={item => item.pod_holder_id}
                    renderItem={renderItem}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>No pod holders found</Text>
                    }
                    ListFooterComponent={() => {
                        const anyConnected = podHolders.some(ph => ph.isConnected);
                        if (podHolders.length > 0 && !anyConnected) {
                            return (
                                <View style={styles.notConnectedBox}>
                                    <View style={styles.notConnectedBadge}>
                                        <Icon name="alert-circle-outline" size={12} color="#B50002" />
                                        <Text style={styles.notConnectedText}>None of your Pod Holders are connected</Text>
                                    </View>
                                </View>
                            );
                        }
                        return null;
                    }}
                    style={{ maxHeight: 300 }}
                />
            )}

            <TouchableOpacity style={styles.settingsBtn} onPress={handleOpenSystemWifi}>
                <Icon name="cog-outline" size={16} color="#FFF" />
                <Text style={styles.settingsBtnText}>Open WiFi Settings</Text>
            </TouchableOpacity>
        </View>
    );
};

export default PodHolderDropdown;

const styles = StyleSheet.create({
    dropdown: {
        position: 'absolute',
        top: 56 + 6,
        right: 140, // Adjust based on user icon position
        width: 260,
        borderRadius: 16,
        padding: 12,
        elevation: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
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
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
    },
    statusDotMini: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    serialText: {
        fontSize: 14,
        fontWeight: '700',
    },
    modelText: {
        fontSize: 11,
        color: '#94A3B8',
    },
    emptyText: {
        textAlign: 'center',
        color: '#94A3B8',
        padding: 20,
        fontSize: 13,
    },
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
    notConnectedBox: {
        paddingVertical: 10,
        alignItems: 'center',
    },
    notConnectedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(181, 0, 2, 0.05)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        gap: 6,
    },
    notConnectedText: {
        color: '#B50002',
        fontSize: 10,
        fontWeight: '700',
    },
    statusTextMini: {
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.2,
    },
});
