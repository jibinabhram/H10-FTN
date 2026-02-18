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

    const [podHolders, setPodHolders] = useState<PodHolder[]>([]);
    const [loading, setLoading] = useState(true);

    const loadPodHolders = useCallback(async () => {
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
            setLoading(true);
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
        }
    }, []);

    const checkConnectivity = async (holders: PodHolder[]) => {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 2000);
            const res = await fetch(`${POD_HOLDER_URL}/files`, { signal: controller.signal });
            clearTimeout(timeout);

            if (res.ok) {
                setPodHolders(prev => prev.map(ph => ({ ...ph, isConnected: true })));
            }
        } catch (err) {
            setPodHolders(prev => prev.map(ph => ({ ...ph, isConnected: false })));
        }
    };

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
            <View style={[styles.statusDot, { backgroundColor: item.isConnected ? '#16A34A' : '#B50002' }]} />
            <View style={{ flex: 1 }}>
                <Text style={[styles.serialText, { color: isDark ? '#F1F5F9' : '#0F172A' }]}>
                    {item.serial_number || 'Unnamed Holder'}
                </Text>
                <Text style={styles.modelText}>{item.model || 'Standard Model'}</Text>
            </View>
            <Icon
                name={item.isConnected ? "wifi-check" : "wifi-off"}
                size={20}
                color={item.isConnected ? "#16A34A" : "#94A3B8"}
            />
        </TouchableOpacity>
    );

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
                    data={podHolders}
                    keyExtractor={item => item.pod_holder_id}
                    renderItem={renderItem}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>No pod holders found</Text>
                    }
                    style={{ maxHeight: 300 }}
                />
            )}

            <TouchableOpacity style={styles.settingsBtn} onPress={handleOpenSystemWifi}>
                <Icon name="cog-outline" size={16} color="#FFF" />
                <Text style={styles.settingsBtnText}>WiFi Settings</Text>
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
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 10,
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
});
