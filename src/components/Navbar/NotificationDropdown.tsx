import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    Modal,
    Pressable,
    ScrollView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNotifications } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
    visible: boolean;
    onClose: () => void;
}

const NotificationDropdown: React.FC<Props> = ({ visible, onClose }) => {
    const { notifications, clearNotifications, markAsRead } = useNotifications();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const formatTimestamp = (ts: number) => {
        const date = new Date(ts);
        const h = date.getHours().toString().padStart(2, '0');
        const m = date.getMinutes().toString().padStart(2, '0');
        return `${h}:${m}`;
    };

    const getIconColor = (type: string) => {
        switch (type) {
            case 'success': return '#10B981';
            case 'error': return '#EF4444';
            case 'warning': return '#F59E0B';
            default: return '#175aeaff';
        }
    };

    const getIconName = (type: string) => {
        switch (type) {
            case 'success': return 'checkmark-circle-outline';
            case 'error': return 'close-circle-outline';
            case 'warning': return 'warning-outline';
            default: return 'information-circle-outline';
        }
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.overlay} onPress={onClose}>
                <View
                    style={[
                        styles.dropdownContainer,
                        { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E2E8F0' }
                    ]}
                >
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Notifications</Text>
                        <View style={styles.headerRight}>
                            {notifications.length > 0 && (
                                <TouchableOpacity onPress={clearNotifications} style={styles.clearBtn}>
                                    <Text style={styles.clearText}>Clear all</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={onClose}>
                                <Ionicons name="close" size={20} color={isDark ? '#94A3B8' : '#64748B'} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={[styles.divider, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]} />

                    <ScrollView
                        style={styles.list}
                        contentContainerStyle={{ paddingBottom: 10 }}
                        showsVerticalScrollIndicator={true}
                    >
                        {notifications.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="notifications-off-outline" size={30} color={isDark ? '#475569' : '#94A3B8'} />
                                <Text style={[styles.emptyText, { color: isDark ? '#94A3B8' : '#64748B' }]}>No records</Text>
                            </View>
                        ) : (
                            notifications.map((notif) => (
                                <TouchableOpacity
                                    key={notif.id}
                                    style={[
                                        styles.notifItem,
                                        { borderBottomColor: isDark ? '#334155' : '#F1F5F9' },
                                        !notif.read && { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }
                                    ]}
                                    onPress={() => markAsRead(notif.id)}
                                >
                                    <View style={[styles.iconBox, { backgroundColor: getIconColor(notif.type) + '15' }]}>
                                        <Ionicons name={getIconName(notif.type)} size={18} color={getIconColor(notif.type)} />
                                    </View>
                                    <View style={styles.notifContent}>
                                        <Text style={[styles.notifMessage, { color: isDark ? '#F8FAFC' : '#0F172A' }]} numberOfLines={2}>
                                            {notif.message}
                                        </Text>
                                        <Text style={styles.notifTime}>{formatTimestamp(notif.timestamp)}</Text>
                                    </View>
                                    {!notif.read && <View style={styles.unreadDot} />}
                                </TouchableOpacity>
                            ))
                        )}
                    </ScrollView>
                </View>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'transparent', // Fully transparent overlay to allow seeing the background
    },
    dropdownContainer: {
        position: 'absolute',
        top: 60, // Positioned right under the navbar icon
        right: 15,
        width: 300,
        maxHeight: SCREEN_HEIGHT * 0.5,
        borderRadius: 16,
        borderWidth: 1,
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    title: {
        fontSize: 15,
        fontWeight: '800',
    },
    clearBtn: {
        paddingVertical: 2,
    },
    clearText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#DC2626',
    },
    divider: {
        height: 1,
    },
    list: {
        flex: 1,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        marginTop: 8,
        fontSize: 13,
        fontWeight: '600',
    },
    notifItem: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        alignItems: 'center',
    },
    iconBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    notifContent: {
        flex: 1,
    },
    notifMessage: {
        fontSize: 12,
        fontWeight: '600',
        lineHeight: 18,
    },
    notifTime: {
        marginTop: 4,
        fontSize: 10,
        color: '#94A3B8',
        fontWeight: '700',
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#DC2626',
        marginLeft: 8,
    },
});

export default NotificationDropdown;
