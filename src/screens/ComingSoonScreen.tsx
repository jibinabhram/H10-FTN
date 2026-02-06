import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useTheme } from '../components/context/ThemeContext';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface Props {
    title: string;
}

const ComingSoonScreen: React.FC<Props> = ({ title }) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    return (
        <View style={[styles.container, { backgroundColor: isDark ? '#020617' : '#FFFFFF' }]}>
            <View style={[styles.card, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: isDark ? '#1E293B' : '#E2E8F0' }]}>
                <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF' }]}>
                    <Ionicons
                        name="construct-outline"
                        size={48}
                        color={isDark ? '#B50002' : '#B50002'}
                    />
                </View>

                <Text style={[styles.title, { color: isDark ? '#F3F4F6' : '#111827' }]}>
                    {title}
                </Text>

                <Text style={[styles.subtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                    This feature is currently under development. Stay tuned for updates!
                </Text>

                <View style={[styles.badge, { backgroundColor: isDark ? '#374151' : '#E5E7EB' }]}>
                    <Text style={[styles.badgeText, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>
                        COMING SOON
                    </Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    card: {
        width: '100%',
        maxWidth: 400,
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 3,
    },
    iconBox: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        marginBottom: 12,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
        fontWeight: '500',
    },
    badge: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 100,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1,
    },
});

export default ComingSoonScreen;
