import React from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Pressable,
    Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';

interface AlertButton {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
}

interface Props {
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    buttons: AlertButton[];
    onClose: () => void;
}

const { width } = Dimensions.get('window');

const CustomAlert = ({ visible, title, message, type, buttons, onClose }: Props) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const getIcon = () => {
        switch (type) {
            case 'success':
                return { name: 'checkmark-circle', color: '#10B981' };
            case 'error':
                return { name: 'close-circle', color: '#EF4444' };
            case 'warning':
                return { name: 'warning', color: '#F59E0B' };
            default:
                return { name: 'information-circle', color: '#175aeaff' };
        }
    };

    const icon = getIcon();

    const handleButtonPress = (onPress?: () => void) => {
        if (onPress) onPress();
        onClose();
    };

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.overlay} onPress={onClose}>
                <View
                    style={[
                        styles.container,
                        { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' },
                    ]}
                >
                    <View style={styles.iconContainer}>
                        <Ionicons name={icon.name} size={48} color={icon.color} />
                    </View>

                    <Text
                        style={[
                            styles.title,
                            { color: isDark ? '#F8FAFC' : '#0F172A' },
                        ]}
                    >
                        {title}
                    </Text>

                    <Text
                        style={[
                            styles.message,
                            { color: isDark ? '#94A3B8' : '#64748B' },
                        ]}
                    >
                        {message}
                    </Text>

                    <View style={styles.buttonRow}>
                        {buttons.map((btn, idx) => {
                            const isCancel = btn.style === 'cancel';
                            const isDestructive = btn.style === 'destructive';

                            let btnBg = isDark ? '#334155' : '#F1F5F9';
                            let textColor = isDark ? '#F8FAFC' : '#0F172A';

                            if (!isCancel) {
                                btnBg = isDestructive ? '#EF4444' : '#DC2626';
                                textColor = '#FFFFFF';
                            }

                            return (
                                <TouchableOpacity
                                    key={idx}
                                    style={[
                                        styles.button,
                                        { backgroundColor: btnBg },
                                        buttons.length > 2 && styles.fullWidthButton,
                                    ]}
                                    onPress={() => handleButtonPress(btn.onPress)}
                                >
                                    <Text style={[styles.buttonText, { color: textColor }]}>
                                        {btn.text}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    container: {
        width: width > 400 ? 380 : '90%',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 15,
        elevation: 10,
    },
    iconContainer: {
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 10,
    },
    message: {
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 24,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: 12,
        width: '100%',
    },
    button: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 14,
        minWidth: 100,
        alignItems: 'center',
    },
    fullWidthButton: {
        width: '100%',
    },
    buttonText: {
        fontSize: 15,
        fontWeight: '700',
    },
});

export default CustomAlert;
